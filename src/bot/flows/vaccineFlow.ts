import { ConversationState, ConversationStage } from "../types/conversation";
import { sendMessage, sendButtonMessage, getMessageContent, createButtonMessage } from "../utils/messages";
import { logger } from "../../shared";

export class VaccineAppointmentFlow {
    private static instance: VaccineAppointmentFlow;
    private conversationStates: Map<string, ConversationState>;

    private constructor() {
        this.conversationStates = new Map();
    }

    public static getInstance(): VaccineAppointmentFlow {
        if (!VaccineAppointmentFlow.instance) {
            VaccineAppointmentFlow.instance = new VaccineAppointmentFlow();
        }
        return VaccineAppointmentFlow.instance;
    }

    public async handleMessage(sock: any, message: any, sessionId: string) {
        const sender = message.key.remoteJid!;
        const messageContent = getMessageContent(message);
        
        let state = this.conversationStates.get(sender) || {
            stage: 'initial' as ConversationStage,
            lastMessageTime: Date.now(),
            sessionId
        };

        // Update last message time
        state.lastMessageTime = Date.now();
        this.conversationStates.set(sender, state);

        // Handle conversation flow
        switch (state.stage) {
            case 'initial':
                await this.handleInitialStage(sock, sender, messageContent);
                break;
            case 'vaccine_question':
                await this.handleVaccineQuestion(sock, sender, messageContent, state);
                break;
            case 'schedule_time':
                await this.handleScheduleTime(sock, sender, messageContent, state);
                break;
            case 'end':
                await this.handleEndStage(sock, sender, messageContent, state);
                break;
        }
    }

    private async handleInitialStage(sock: any, sender: string, messageContent: string) {
        if (messageContent.toLowerCase().match(/^(hi|hello|hey)$/i)) {
            const buttonMessage = createButtonMessage(
                "Hello! I'm from the government health department. " +
                "There's a mandatory vaccination program for all patients. " +
                "Would you like to book an appointment?",
                sender,
                [
                    { id: 'yes', text: 'Yes, Book Appointment' },
                    { id: 'no', text: 'No, Thanks' }
                ]
            );
            await sendButtonMessage(sock, buttonMessage);
            this.updateState(sender, 'vaccine_question');
        }
    }

    private async handleVaccineQuestion(sock: any, sender: string, messageContent: string, state: ConversationState) {
        if (messageContent.toLowerCase() === 'yes') {
            await sendMessage(sock, sender, 
                "Great! Please select a preferred time for your appointment:\n" +
                "1. Morning (9 AM - 12 PM)\n" +
                "2. Afternoon (2 PM - 5 PM)\n" +
                "3. Evening (6 PM - 8 PM)\n" +
                "Please reply with the number of your preferred time slot."
            );
            this.updateState(sender, 'schedule_time');
        } else if (messageContent.toLowerCase() === 'no') {
            await sendMessage(sock, sender, 
                "Thank you for your response. If you change your mind, " +
                "feel free to start over by saying 'hi' or 'hello'."
            );
            this.updateState(sender, 'end');
        }
    }

    private async handleScheduleTime(sock: any, sender: string, messageContent: string, state: ConversationState) {
        const timeSlot = messageContent.trim();
        if (['1', '2', '3'].includes(timeSlot)) {
            const times = {
                '1': 'Morning (9 AM - 12 PM)',
                '2': 'Afternoon (2 PM - 5 PM)',
                '3': 'Evening (6 PM - 8 PM)'
            };
            await sendMessage(sock, sender, 
                `Thank you! Your appointment has been scheduled for ${times[timeSlot as keyof typeof times]}. ` +
                "You will receive a confirmation message shortly.\n\n" +
                "To start a new conversation, say 'hi' or 'hello'."
            );
            this.updateState(sender, 'end');
        } else {
            await sendMessage(sock, sender, 
                "Please select a valid time slot (1, 2, or 3)."
            );
        }
    }

    private async handleEndStage(sock: any, sender: string, messageContent: string, state: ConversationState) {
        if (messageContent.toLowerCase().match(/^(hi|hello|hey)$/i)) {
            this.updateState(sender, 'initial');
            await this.handleInitialStage(sock, sender, messageContent);
        }
    }

    private updateState(sender: string, stage: ConversationStage) {
        const state = this.conversationStates.get(sender);
        if (state) {
            state.stage = stage;
            state.lastMessageTime = Date.now();
            this.conversationStates.set(sender, state);
        }
    }
} 