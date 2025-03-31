import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import sessionRouter from './router/session';
import { logger, prisma } from './shared';
import messageRoutes from './router/message';
import { init } from './wa';
import { authMiddleware } from './middleware/auth-middleware';

require('dotenv').config();

const app = express();

// CORS configuration
const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json());

// Auth middleware
app.use(authMiddleware);

// Routes
app.use('/session', sessionRouter);
app.use('/messages', messageRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize WhatsApp and start server
(async () => {
    try {
        await init();
        logger.info('WhatsApp initialized successfully');
        
        const port = process.env.PORT || 3000;
        app.listen(port, () => {
            logger.info(`Server is running on port ${port}`);
        });
    } catch (error) {
        logger.error({ error }, 'Failed to initialize WhatsApp');
        process.exit(1);
    }
})();

export default app;
