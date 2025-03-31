import natural from 'natural';
import { logger } from '../../shared';

export type Intent = 
    | 'greeting' 
    | 'booking' 
    | 'farewell' 
    | 'question' 
    | 'confirmation' 
    | 'rejection' 
    | 'time_selection' 
    | 'unknown';

export class IntentClassifier {
    private static instance: IntentClassifier;
    private classifier: natural.BayesClassifier;
    private tokenizer: natural.WordTokenizer;

    private constructor() {
        this.classifier = new natural.BayesClassifier();
        this.tokenizer = new natural.WordTokenizer();
        this.trainClassifier();
    }

    public static getInstance(): IntentClassifier {
        if (!IntentClassifier.instance) {
            IntentClassifier.instance = new IntentClassifier();
        }
        return IntentClassifier.instance;
    }

    private trainClassifier() {
        // Greetings
        this.classifier.addDocument('hello', 'greeting');
        this.classifier.addDocument('hi', 'greeting');
        this.classifier.addDocument('hey', 'greeting');
        this.classifier.addDocument('good morning', 'greeting');
        this.classifier.addDocument('good afternoon', 'greeting');
        this.classifier.addDocument('good evening', 'greeting');
        this.classifier.addDocument('greetings', 'greeting');
        this.classifier.addDocument('hello there', 'greeting');
        this.classifier.addDocument('hi there', 'greeting');
        this.classifier.addDocument('hey there', 'greeting');

        // Booking Intent
        this.classifier.addDocument('book appointment', 'booking');
        this.classifier.addDocument('schedule vaccine', 'booking');
        this.classifier.addDocument('need vaccination', 'booking');
        this.classifier.addDocument('want to get vaccinated', 'booking');
        this.classifier.addDocument('book vaccine', 'booking');
        this.classifier.addDocument('schedule appointment', 'booking');
        this.classifier.addDocument('book a slot', 'booking');
        this.classifier.addDocument('get vaccinated', 'booking');
        this.classifier.addDocument('take vaccine', 'booking');
        this.classifier.addDocument('vaccination appointment', 'booking');

        // Confirmation
        this.classifier.addDocument('yes', 'confirmation');
        this.classifier.addDocument('sure', 'confirmation');
        this.classifier.addDocument('okay', 'confirmation');
        this.classifier.addDocument('alright', 'confirmation');
        this.classifier.addDocument('fine', 'confirmation');
        this.classifier.addDocument('that works', 'confirmation');
        this.classifier.addDocument('yes please', 'confirmation');
        this.classifier.addDocument('ok', 'confirmation');
        this.classifier.addDocument('yeah', 'confirmation');
        this.classifier.addDocument('yep', 'confirmation');

        // Rejection
        this.classifier.addDocument('no', 'rejection');
        this.classifier.addDocument('not interested', 'rejection');
        this.classifier.addDocument('maybe later', 'rejection');
        this.classifier.addDocument('not now', 'rejection');
        this.classifier.addDocument('i will think about it', 'rejection');
        this.classifier.addDocument('no thanks', 'rejection');
        this.classifier.addDocument('not today', 'rejection');
        this.classifier.addDocument('i am busy', 'rejection');
        this.classifier.addDocument('cant do it', 'rejection');
        this.classifier.addDocument('dont want to', 'rejection');

        // Time Selection
        this.classifier.addDocument('morning', 'time_selection');
        this.classifier.addDocument('afternoon', 'time_selection');
        this.classifier.addDocument('evening', 'time_selection');
        this.classifier.addDocument('9 am', 'time_selection');
        this.classifier.addDocument('2 pm', 'time_selection');
        this.classifier.addDocument('6 pm', 'time_selection');
        this.classifier.addDocument('early morning', 'time_selection');
        this.classifier.addDocument('late morning', 'time_selection');
        this.classifier.addDocument('early afternoon', 'time_selection');
        this.classifier.addDocument('late afternoon', 'time_selection');
        this.classifier.addDocument('early evening', 'time_selection');
        this.classifier.addDocument('late evening', 'time_selection');

        // Questions
        this.classifier.addDocument('what is this', 'question');
        this.classifier.addDocument('tell me more', 'question');
        this.classifier.addDocument('explain', 'question');
        this.classifier.addDocument('how does it work', 'question');
        this.classifier.addDocument('what do i need', 'question');
        this.classifier.addDocument('can you explain', 'question');
        this.classifier.addDocument('i have questions', 'question');
        this.classifier.addDocument('what should i know', 'question');
        this.classifier.addDocument('tell me about it', 'question');
        this.classifier.addDocument('what are the details', 'question');

        // Farewell
        this.classifier.addDocument('bye', 'farewell');
        this.classifier.addDocument('goodbye', 'farewell');
        this.classifier.addDocument('see you', 'farewell');
        this.classifier.addDocument('thanks', 'farewell');
        this.classifier.addDocument('thank you', 'farewell');
        this.classifier.addDocument('bye bye', 'farewell');
        this.classifier.addDocument('see you later', 'farewell');
        this.classifier.addDocument('thank you very much', 'farewell');
        this.classifier.addDocument('thanks a lot', 'farewell');
        this.classifier.addDocument('good night', 'farewell');

        // Train the classifier
        this.classifier.train();
        logger.info('NLP classifier trained successfully');
    }

    public classify(text: string): Intent {
        try {
            const intent = this.classifier.classify(text.toLowerCase()) as Intent;
            const confidence = this.classifier.getClassifications(text.toLowerCase())
                .find(c => c.label === intent)?.value || 0;

            logger.info({ 
                text, 
                intent, 
                confidence,
                tokens: this.tokenizer.tokenize(text)
            }, 'Intent classification result');

            // Lower confidence threshold for better recognition
            if (confidence < 0.2) {
                return 'unknown';
            }

            return intent;
        } catch (error) {
            logger.error({ error, text }, 'Error in intent classification');
            return 'unknown';
        }
    }

    public getConfidence(text: string, intent: Intent): number {
        try {
            const classifications = this.classifier.getClassifications(text.toLowerCase());
            const classification = classifications.find(c => c.label === intent);
            return classification?.value || 0;
        } catch (error) {
            logger.error({ error, text, intent }, 'Error getting confidence');
            return 0;
        }
    }
} 