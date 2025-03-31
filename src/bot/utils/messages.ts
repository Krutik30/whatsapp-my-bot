import { proto } from "@whiskeysockets/baileys";
import { ButtonMessage } from "../types/conversation";
import { logger } from "../../shared";

export async function sendMessage(sock: any, jid: string, text: string) {
    try {
        logger.info({ jid, text }, 'Attempting to send text message');
        await sock.sendMessage(jid, { text });
        logger.info({ jid }, 'Successfully sent text message');
    } catch (error) {
        logger.error({ error, jid, text }, 'Error sending text message');
        throw error;
    }
}

export async function sendButtonMessage(sock: any, message: any) {
    try {
        logger.info({ jid: message.recipient }, 'Attempting to send button message');
        await sock.sendMessage(message.recipient, message);
        logger.info({ jid: message.recipient }, 'Successfully sent button message');
    } catch (error) {
        logger.error({ error, jid: message.recipient }, 'Error sending button message');
        throw error;
    }
}

export function getMessageContent(message: proto.IWebMessageInfo): string {
    try {
        logger.info({ messageType: message.message ? Object.keys(message.message)[0] : 'unknown' }, 'Extracting message content');
        
        if (message.message?.conversation) {
            return message.message.conversation;
        }
        
        if (message.message?.extendedTextMessage?.text) {
            return message.message.extendedTextMessage.text;
        }
        
        if (message.message?.imageMessage?.caption) {
            return message.message.imageMessage.caption;
        }
        
        if (message.message?.videoMessage?.caption) {
            return message.message.videoMessage.caption;
        }
        
        if (message.message?.documentMessage?.caption) {
            return message.message.documentMessage.caption;
        }
        
        logger.warn({ messageType: message.message ? Object.keys(message.message)[0] : 'unknown' }, 'No text content found in message');
        return '';
    } catch (error) {
        logger.error({ error }, 'Error extracting message content');
        return '';
    }
}

export function createButtonMessage(
    text: string,
    to: string,
    buttons: { id: string; text: string }[]
): ButtonMessage {
    return {
        text,
        buttons: buttons.map(button => ({
            buttonId: button.id,
            buttonText: { displayText: button.text },
            type: 1
        })),
        headerType: 1,
        to
    };
} 