import makeWASocket, { ConnectionState, DisconnectReason, SocketConfig, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, proto, WAMessageUpdate, PresenceData, GroupMetadata } from "@whiskeysockets/baileys";
import { Boom } from '@hapi/boom';
import { Response } from "express";
import { logger, prisma } from "./shared";
import { useSession } from "./store/session";
import * as qrcode from 'qrcode';
import { VaccineAppointmentFlow } from "./bot/flows/vaccineFlow";

// Constants
const RECONNECT_INTERVAL = Number(process.env.RECONNECT_INTERVAL || 0);
const MAX_RECONNECT_RETRIES = Number(process.env.MAX_RECONNECT_RETRIES || 5);
export const SESSION_CONFIG_ID = 'session-config';

// State management
const retries = new Map<string, number>();
const sessions = new Map<string, any>();
const vaccineFlow = VaccineAppointmentFlow.getInstance();

// Session Management Functions
export const init = async () => {
    const sessionIds = await prisma.session.findMany({
        select: { sessionId: true },
        distinct: ['sessionId']
    });

    for(const { sessionId } of sessionIds) {
        createSession({ sessionId });
    }
};

export const sessionExist = (sessionId: string) => sessions.has(sessionId);
export const getSession = (sessionId: string) => sessions.get(sessionId);

export function getSessionStatus(session: any) {
    const state = ['CONNECTING', 'CONNECTED', 'DISCONNECTING', 'DISCONNECTED'];
    let status = state[(session.ws).socket.readyState];
    status = session.user ? 'AUTHENTICATED' : status;
    return status;
}

export function listSessions() {
    return Array.from(sessions.entries()).map(([id, session]) => ({
        id,
        status: getSessionStatus(session),
    }));
}

export async function deleteSession(sessionId: string) {
    sessions.get(sessionId)?.destroy();
}

// Connection Management
const shouldReconnect = (sessionId: string) => {
    let attempts = retries.get(sessionId) ?? 0;
    if (attempts < MAX_RECONNECT_RETRIES) {
        attempts += 1;
        retries.set(sessionId, attempts);
        return true;
    }
    return false;
};

// WhatsApp Number Validation
export const jidExist = async(session: any, jid: string, type: 'group' | 'number' = 'number') => {
    try {
        if (type === 'number') {
            const [result] = await session.onWhatsApp(jid);
            return !!result?.exists;
        }
        const groupMeta = await session.groupMetadata(jid);
        return !!groupMeta.id;
    } catch (error) {
        return Promise.reject(error);
    }
}

// Session Creation
type createSessionOptions = {
    sessionId: string;
    res?: Response;
    socketConfig?: SocketConfig;
}

export async function createSession(options: createSessionOptions) {
    const { sessionId, res, socketConfig } = options;
    logger.info({ sessionId }, 'Creating new session');
    
    let connectionState: Partial<ConnectionState> = { connection: 'close' };
    
    try {
        const { state, saveCreds } = await useSession(sessionId);
        const { version, isLatest } = await fetchLatestBaileysVersion();
        logger.info({ version, isLatest }, 'Using WhatsApp version');

        const destroy = async (logout = true) => {
            try {
                await Promise.all([
                    logout && sock?.logout(),
                    prisma.session.deleteMany({ where: { sessionId } }),
                ]);
            } catch (e) {
                logger.error(e, 'Error during session destroy');
            } finally {
                sessions.delete(sessionId);
            }
        };
        
        const handleConnectionClose = () => {
            const code = (connectionState.lastDisconnect?.error as Boom)?.output?.statusCode;
            const restartRequired = code === DisconnectReason.restartRequired;
            const doNotReconnect = !shouldReconnect(sessionId);

            if (code === DisconnectReason.loggedOut || doNotReconnect) {
                if (res) {
                    !res.headersSent && res.status(500).json({ error: 'Unable to create session' });
                    res.end();
                }
                destroy(doNotReconnect);
                return;
            }
            
            if (!restartRequired) {
                logger.info({ attempts: retries.get(sessionId) ?? 1, sessionId }, 'Reconnecting...');
            }
            setTimeout(() => createSession(options), restartRequired ? 0 : RECONNECT_INTERVAL);
        };
        
        const handleConnectionUpdate = async() => {
            if (connectionState.qr?.length) {
                if (res && !res.headersSent) {
                    try {
                        const qr = await qrcode.toDataURL(connectionState.qr);
                        res.status(200).json({ qr });
                        return;
                    } catch (e) {
                        logger.error(e, 'Error generating QR code');
                        res.status(500).json({ error: 'Unable to generate QR' });
                    }
                }
                destroy();
            }
        }
        
        const socketConfigForSocket = {
            version,
            logger,
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            generateHighQualityLinkPreview: true,
            connectTimeoutMs: 60000,
            retryRequestDelayMs: 250,
            maxRetries: 5,
        };

        const sock = makeWASocket(socketConfigForSocket);
        sessions.set(sessionId, { ...sock });

        // Event Handler
        sock.ev.process(async(events) => {
            // Connection Updates
            if(events['connection.update']) {
                const update = events['connection.update'];
                connectionState = update;
                const { connection } = update;

                if (connection === 'open') {
                    retries.delete(sessionId);
                    logger.info({ sessionId }, 'Connection opened successfully');
                }
                if (connection === 'close') handleConnectionClose();
                handleConnectionUpdate();
            }

            // Credentials Update
            if(events['creds.update']) {
                await saveCreds();
                logger.info({ sessionId }, 'Credentials updated');
            }

            // Message Handling
            if(events['messages.upsert']) {
                const upsert = events['messages.upsert'];
                if(upsert.type === 'notify') {
                    for(const msg of upsert.messages) {
                        await sock.readMessages([msg.key]);
                        
                        logger.info({
                            sessionId,
                            messageId: msg.key.id,
                            sender: msg.key.remoteJid,
                            timestamp: msg.messageTimestamp,
                            messageType: msg.message ? Object.keys(msg.message)[0] : 'unknown'
                        }, 'Message received');

                        await vaccineFlow.handleMessage(sock, msg, sessionId);
                    }
                }
            }

            // Message Status Updates
            if(events['messages.update']) {
                for(const update of events['messages.update']) {
                    logger.info({
                        sessionId,
                        messageId: update.key.id,
                        update: update
                    }, 'Message status update');
                }
            }

            // Presence Updates
            if(events['presence.update']) {
                const update = events['presence.update'];
                logger.info({
                    sessionId,
                    jid: update.id,
                    presences: update.presences
                }, 'Presence update');
            }

            // Group Updates
            if(events['groups.update']) {
                for(const update of events['groups.update']) {
                    logger.info({
                        sessionId,
                        groupId: update.id,
                        update: update
                    }, 'Group update');
                }
            }

            // Contact Updates
            if(events['contacts.update']) {
                for(const update of events['contacts.update']) {
                    logger.info({
                        sessionId,
                        contacts: update
                    }, 'Contact update');
                }
            }
        });

        return sock;
    } catch (error) {
        logger.error(error, 'Error creating session');
        if (res) {
            res.status(500).json({ error: 'Failed to create session' });
        }
        throw error;
    }
}