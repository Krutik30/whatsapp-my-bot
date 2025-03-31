import { Request, Response } from "express";
import { getSession, jidExist } from "../wa";
import { logger } from "../shared";
import { proto } from "@whiskeysockets/baileys";
import { delay as delayMS } from "@whiskeysockets/baileys";

const messageController = {
    send: async (req: Request, res: Response): Promise<void> => {
        try {
            const { jid, type = 'number', message, options } = req.body;
            const newMsg = { text: `Following msg was sent to the ${jid.slice(2,12)} \n ${message.text}` };
            
            const session = getSession(req.query.sessionId as string);
            if (!session) {
                res.status(400).json({ error: 'Invalid session' });
                return;
            }

            const exists = await jidExist(session, jid, type);
            if (!exists) {
                res.status(400).json({ error: 'JID does not exist' });
                return;
            }

            logger.info({ jid, type }, 'Sending message');
            const result = await session.sendMessage(jid, message, options);
            const msgSelf = await session.sendMessage(session.user.id, newMsg, options);
            
            res.status(200).json({ result, msgSelf });
        } catch (error) {
            logger.error({ error }, 'Error sending message');
            res.status(500).json({ error: 'An error occurred during message send' });
        }
    },

    sendBulk: async (req: Request, res: Response): Promise<void> => {
        try {
            const sessionId = req.query.sessionId as string;
            const session = getSession(sessionId);
            
            if (!session) {
                res.status(400).json({ error: 'Invalid session' });
                return;
            }

            const results: { index: number; result: proto.WebMessageInfo | undefined }[] = [];
            const selfMsgResults: { index: number; selfMsgresult: proto.WebMessageInfo | undefined }[] = [];
            const errors: { index: number; error: string }[] = [];

            for (const [
                index,
                { jid, type = 'number', delay = 1000, message, options }
            ] of req.body.entries()) {
                try {
                    const exists = await jidExist(session, jid, type);
                    if (!exists) {
                        errors.push({ index, error: 'JID does not exist' });
                        continue;
                    }

                    if (index > 0) await delayMS(delay);
                    
                    const newMsg = { 
                        text: `Following msg was sent to the ${jid.slice(2,12)}\n\n${message.text}` 
                    };
                    
                    const result = await session.sendMessage(jid, message, options);
                    const selfMsgresult = await session.sendMessage(session.user.id, newMsg, options);
                    
                    results.push({ index, result });
                    selfMsgResults.push({ index, selfMsgresult });
                } catch (error) {
                    logger.error({ error, index }, 'Error sending bulk message');
                    errors.push({ index, error: 'An error occurred during message send' });
                }
            }

            res.status(req.body.length !== 0 && errors.length === req.body.length ? 500 : 200)
               .json({ results, selfMsgResults, errors });
        } catch (error) {
            logger.error({ error }, 'Error in bulk message operation');
            res.status(500).json({ error: 'An error occurred during bulk message operation' });
        }
    }
};

export default messageController;