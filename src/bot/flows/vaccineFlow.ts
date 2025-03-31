import { ConversationState, ConversationStage } from "../types/conversation";
import { sendMessage, getMessageContent } from "../utils/messages";
import { logger } from "../../shared";
import { PrismaClient } from "@prisma/client";
import { IntentClassifier, Intent } from "../utils/nlp";

export class VaccineAppointmentFlow {
    private static instance: VaccineAppointmentFlow;
    private conversationStates: Map<string, ConversationState>;
    private readonly CONVERSATION_TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout
    private prisma: PrismaClient;
    private intentClassifier: IntentClassifier;

    // Dynamic response templates
    private readonly greetings = [
        "Hello! 👋 I'm from the government health department.",
        "Hi there! 👋 I'm your health department assistant.",
        "Welcome! 👋 I'm here to help with vaccination appointments.",
        "Greetings! 👋 I'm from the health department."
    ];

    private readonly vaccineIntros = [
        "There's an important vaccination program we'd like to discuss with you.",
        "We're conducting a mandatory vaccination program for all patients.",
        "We need to schedule you for an important vaccination.",
        "There's a vaccination program we need to schedule for you."
    ];

    private readonly timeSlots = {
        '1': { time: 'Morning (9 AM - 12 PM)', emoji: '🌅' },
        '2': { time: 'Afternoon (2 PM - 5 PM)', emoji: '☀️' },
        '3': { time: 'Evening (6 PM - 8 PM)', emoji: '🌙' }
    };

    private constructor() {
        this.conversationStates = new Map();
        this.prisma = new PrismaClient();
        this.intentClassifier = IntentClassifier.getInstance();
        // Start cleanup interval
        setInterval(() => this.cleanupInactiveConversations(), 60000);
    }

    public static getInstance(): VaccineAppointmentFlow {
        if (!VaccineAppointmentFlow.instance) {
            VaccineAppointmentFlow.instance = new VaccineAppointmentFlow();
        }
        return VaccineAppointmentFlow.instance;
    }

    private async getOrCreateUserPreference(phoneNumber: string) {
        try {
            let userPref = await this.prisma.userPreference.findUnique({
                where: { phoneNumber }
            });

            if (!userPref) {
                userPref = await this.prisma.userPreference.create({
                    data: {
                        phoneNumber,
                        lastInteraction: new Date(),
                        lastStage: 'initial'
                    }
                });
            }

            return userPref;
        } catch (error) {
            logger.error({ error, phoneNumber }, 'Error getting/creating user preference');
            return null;
        }
    }

    private async updateUserPreference(phoneNumber: string, data: any) {
        try {
            await this.prisma.userPreference.update({
                where: { phoneNumber },
                data: {
                    ...data,
                    lastInteraction: new Date()
                }
            });
        } catch (error) {
            logger.error({ error, phoneNumber, data }, 'Error updating user preference');
        }
    }

    private cleanupInactiveConversations() {
        const now = Date.now();
        for (const [sender, state] of this.conversationStates.entries()) {
            if (now - state.lastMessageTime > this.CONVERSATION_TIMEOUT) {
                logger.info({ sender }, 'Cleaning up inactive conversation');
                this.conversationStates.delete(sender);
            }
        }
    }

    private async getOrCreateState(sender: string, sessionId: string): Promise<ConversationState> {
        let existingState = this.conversationStates.get(sender);
        
        if (existingState) {
            existingState.lastMessageTime = Date.now();
            return existingState;
        }

        // Load last stage from database if available
        const userPref = await this.prisma.userPreference.findUnique({ 
            where: { phoneNumber: sender } 
        });

        const newState: ConversationState = {
            stage: (userPref?.lastStage as ConversationStage) || 'initial',
            lastMessageTime: Date.now(),
            sessionId
        };

        this.conversationStates.set(sender, newState);
        return newState;
    }

    private getRandomResponse(responses: string[]): string {
        return responses[Math.floor(Math.random() * responses.length)];
    }

    public async handleMessage(sock: any, message: any, sessionId: string) {
        const sender = message.key.remoteJid!;
        const messageContent = getMessageContent(message);
        
        logger.info({ 
            sender, 
            messageContent, 
            messageType: message.message ? Object.keys(message.message)[0] : 'unknown',
            sessionId 
        }, 'Received message');

        // Check for restart command first
        if (messageContent.toLowerCase() === 'restart') {
            await this.handleRestart(sock, sender);
            return;
        }

        // Get or create user preference
        const userPref = await this.getOrCreateUserPreference(sender);
        if (!userPref) {
            logger.error({ sender }, 'Failed to get/create user preference');
            return;
        }

        // Get or create state for this sender
        const state = await this.getOrCreateState(sender, sessionId);
        logger.info({ sender, currentStage: state.stage }, 'Current conversation state');

        // Handle conversation flow
        switch (state.stage) {
            case 'initial':
                await this.handleInitialStage(sock, sender, messageContent, state, userPref);
                break;
            case 'vaccine_question':
                await this.handleVaccineQuestion(sock, sender, messageContent, state, userPref);
                break;
            case 'schedule_time':
                await this.handleScheduleTime(sock, sender, messageContent, state, userPref);
                break;
            case 'no_response':
                await this.handleNoResponse(sock, sender, messageContent, state, userPref);
                break;
            case 'completed':
                if (messageContent.toLowerCase().match(/^(hi|hello|hey|good\s*(morning|afternoon|evening))$/i)) {
                    await this.handleRestart(sock, sender);
                } else {
                    await sendMessage(sock, sender, 
                        "Type 'restart' to book another appointment or 'hi' to start a new conversation!"
                    );
                }
                break;
            case 'end':
                if (messageContent.toLowerCase().match(/^(hi|hello|hey|good\s*(morning|afternoon|evening))$/i)) {
                    await this.handleRestart(sock, sender);
                } else {
                    await sendMessage(sock, sender, 
                        "Type 'restart' to book another appointment or 'hi' to start a new conversation!"
                    );
                }
                break;
        }
    }

    private async handleInitialStage(sock: any, sender: string, messageContent: string, state: ConversationState, userPref: any) {
        logger.info({ sender, messageContent }, 'Handling initial stage');
        const intent = this.intentClassifier.classify(messageContent);
        const confidence = this.intentClassifier.getConfidence(messageContent, intent);
        
        logger.info({ sender, intent, confidence }, 'Intent classification result');
        
        // Handle greetings and booking intents
        if (intent === 'greeting' || intent === 'booking' || 
            (intent === 'unknown' && messageContent.toLowerCase().match(/^(hi|hello|hey|good\s*(morning|afternoon|evening))$/i))) {
            logger.info({ sender, intent }, 'Greeting or booking intent detected');
            try {
                const greeting = this.getRandomResponse(this.greetings);
                const intro = this.getRandomResponse(this.vaccineIntros);
                
                // If user has previous preference, personalize the message
                let personalizedMessage = `${greeting}\n\n${intro}\n\n`;
                if (userPref.preferredTime) {
                    personalizedMessage += `I notice you previously preferred ${userPref.preferredTime}. Would you like to book for the same time?\n\n`;
                } else {
                    personalizedMessage += "Would you like to book an appointment? (Reply with 'yes' or 'no')\n\n";
                }
                personalizedMessage += "💉 This is a mandatory program for all patients.";

                await sendMessage(sock, sender, personalizedMessage);
                
                // Update state and save it
                state.stage = 'vaccine_question';
                this.conversationStates.set(sender, state);
                await this.updateUserPreference(sender, { lastStage: 'vaccine_question' });
                
                logger.info({ sender, newStage: state.stage }, 'Successfully updated conversation state');
            } catch (error) {
                logger.error({ error, sender }, 'Failed to send initial message');
            }
        } else if (intent === 'question') {
            await sendMessage(sock, sender, 
                "I'm here to help with vaccination appointments. " +
                "This is a government-mandated program for all citizens. " +
                "Would you like to know more about it? (yes/no)"
            );
        } else {
            // For any other message, treat it as a greeting attempt
            await sendMessage(sock, sender, 
                "Hi! 👋 I'm here to help with vaccination appointments. " +
                "Just say 'hi' or 'hello' to get started! " +
                "Or type 'restart' to start over."
            );
        }
    }

    private async handleVaccineQuestion(sock: any, sender: string, messageContent: string, state: ConversationState, userPref: any) {
        logger.info({ sender, messageContent }, 'Handling vaccine question stage');
        const intent = this.intentClassifier.classify(messageContent);
        
        if (intent === 'confirmation' || messageContent.toLowerCase().includes('yes')) {
            logger.info({ sender, intent }, 'Confirmation detected');
            await this.updateUserPreference(sender, { wantsVaccine: true });
            await sendMessage(sock, sender, 
                "Great! 🎉 Let's schedule your appointment.\n\n" +
                "Please select your preferred time slot:\n\n" +
                "1️⃣ Morning (9 AM - 12 PM) 🌅\n" +
                "2️⃣ Afternoon (2 PM - 5 PM) ☀️\n" +
                "3️⃣ Evening (6 PM - 8 PM) 🌙\n\n" +
                "Just reply with the number (1, 2, or 3) of your preferred time."
            );
            state.stage = 'schedule_time';
            this.conversationStates.set(sender, state);
            await this.updateUserPreference(sender, { lastStage: 'schedule_time' });
        } else if (intent === 'rejection' || messageContent.toLowerCase().includes('no')) {
            logger.info({ sender, intent }, 'Rejection detected');
            await this.updateUserPreference(sender, { wantsVaccine: false });
            await sendMessage(sock, sender, 
                "I understand you're not interested right now. 🤔\n\n" +
                "However, this is a mandatory program. Would you like to:\n" +
                "1. Schedule now\n" +
                "2. Learn more about the program\n" +
                "3. Speak to a human representative\n\n" +
                "Just reply with the number of your choice."
            );
            state.stage = 'no_response';
            this.conversationStates.set(sender, state);
            await this.updateUserPreference(sender, { lastStage: 'no_response' });
        } else if (intent === 'question') {
            await sendMessage(sock, sender, 
                "This is a mandatory vaccination program for all citizens. " +
                "The vaccine is free of cost and takes about 30 minutes to complete. " +
                "Would you like to schedule an appointment? (yes/no)"
            );
        } else {
            await sendMessage(sock, sender, 
                "I didn't quite catch that. 🤔\n\n" +
                "Please reply with either 'yes' or 'no' to proceed."
            );
        }
    }

    private async handleScheduleTime(sock: any, sender: string, messageContent: string, state: ConversationState, userPref: any) {
        const intent = this.intentClassifier.classify(messageContent);
        const timeSlot = messageContent.trim();
        
        if (['1', '2', '3'].includes(timeSlot) || intent === 'time_selection') {
            const slot = this.timeSlots[timeSlot as keyof typeof this.timeSlots] || 
                        this.getTimeSlotFromIntent(messageContent);
            
            if (slot) {
                await this.updateUserPreference(sender, { 
                    preferredTime: slot.time,
                    lastStage: 'completed'
                });
                
                await sendMessage(sock, sender, 
                    `Perfect! 🎉 Your appointment has been scheduled for ${slot.time} ${slot.emoji}\n\n` +
                    "📋 Appointment Details:\n" +
                    `• Time: ${slot.time}\n` +
                    "• Location: Government Health Center\n" +
                    "• Please bring your ID proof\n\n" +
                    "You'll receive a confirmation message shortly.\n\n" +
                    "Type 'restart' to book another appointment or 'hi' to start a new conversation!"
                );
                
                // Update state to completed instead of end
                state.stage = 'completed';
                this.conversationStates.set(sender, state);
            } else {
                await sendMessage(sock, sender, 
                    "❌ Please select a valid time slot (1, 2, or 3).\n\n" +
                    "Here are the available slots again:\n" +
                    "1️⃣ Morning (9 AM - 12 PM) 🌅\n" +
                    "2️⃣ Afternoon (2 PM - 5 PM) ☀️\n" +
                    "3️⃣ Evening (6 PM - 8 PM) 🌙"
                );
            }
        } else {
            await sendMessage(sock, sender, 
                "❌ Please select a valid time slot (1, 2, or 3).\n\n" +
                "Here are the available slots again:\n" +
                "1️⃣ Morning (9 AM - 12 PM) 🌅\n" +
                "2️⃣ Afternoon (2 PM - 5 PM) ☀️\n" +
                "3️⃣ Evening (6 PM - 8 PM) 🌙"
            );
        }
    }

    private getTimeSlotFromIntent(text: string) {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('morning') || lowerText.includes('9')) {
            return this.timeSlots['1'];
        } else if (lowerText.includes('afternoon') || lowerText.includes('2')) {
            return this.timeSlots['2'];
        } else if (lowerText.includes('evening') || lowerText.includes('6')) {
            return this.timeSlots['3'];
        }
        return null;
    }

    private async handleNoResponse(sock: any, sender: string, messageContent: string, state: ConversationState, userPref: any) {
        const choice = messageContent.trim();
        switch (choice) {
            case '1':
                state.stage = 'schedule_time';
                await this.updateUserPreference(sender, { lastStage: 'schedule_time' });
                await this.handleScheduleTime(sock, sender, '', state, userPref);
                break;
            case '2':
                await sendMessage(sock, sender, 
                    "📚 Program Information:\n\n" +
                    "• This is a government-mandated vaccination program\n" +
                    "• Free of cost for all citizens\n" +
                    "• Takes approximately 30 minutes\n" +
                    "• No prior preparation needed\n\n" +
                    "Would you like to schedule now? (yes/no)"
                );
                state.stage = 'vaccine_question';
                await this.updateUserPreference(sender, { lastStage: 'vaccine_question' });
                break;
            case '3':
                await sendMessage(sock, sender, 
                    "I'll connect you with a human representative.\n\n" +
                    "Please wait while I transfer your call...\n" +
                    "(This is a demo - in production, this would connect to a real representative)\n\n" +
                    "Say 'hi' to start over if needed."
                );
                state.stage = 'end';
                await this.updateUserPreference(sender, { lastStage: 'end' });
                break;
            default:
                await sendMessage(sock, sender, 
                    "Please select a valid option (1, 2, or 3).\n\n" +
                    "1. Schedule now\n" +
                    "2. Learn more about the program\n" +
                    "3. Speak to a human representative"
                );
        }
    }

    private async handleRestart(sock: any, sender: string) {
        logger.info({ sender }, 'Handling conversation restart');
        this.conversationStates.delete(sender);
        await this.updateUserPreference(sender, { lastStage: 'initial' });
        await sendMessage(sock, sender, 
            "🔄 Conversation restarted! Say 'hi' or 'hello' to begin a new appointment booking."
        );
    }
} 