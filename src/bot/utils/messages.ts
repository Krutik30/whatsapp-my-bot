import { proto } from "@whiskeysockets/baileys";
import { ButtonMessage } from "../types/conversation";
import { logger } from "../../shared";

export async function sendMessage(sock: any, jid: string, text: string) {
    try {
        await sock.sendMessage(jid, { text });
    } catch (error) {
        logger.error(error, 'Error sending message');
    }
}

export async function sendButtonMessage(sock: any, message: ButtonMessage) {
    try {
        await sock.sendMessage(message.to, {
            text: message.text,
            buttons: message.buttons,
            headerType: message.headerType
        });
    } catch (error) {
        logger.error(error, 'Error sending button message');
    }
}

export function getMessageContent(message: proto.IWebMessageInfo): string {
    return message.message?.conversation || 
           message.message?.extendedTextMessage?.text ||
           message.message?.imageMessage?.caption ||
           message.message?.videoMessage?.caption || '';
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