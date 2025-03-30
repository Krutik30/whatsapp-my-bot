export type ConversationStage = 'initial' | 'vaccine_question' | 'schedule_time' | 'end';

export interface ConversationState {
    stage: ConversationStage;
    lastMessageTime: number;
    sessionId: string;
}

export interface ButtonMessage {
    text: string;
    buttons: {
        buttonId: string;
        buttonText: { displayText: string };
        type: 1;
    }[];
    headerType: 1;
    to: string;
} 