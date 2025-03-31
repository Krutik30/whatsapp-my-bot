import { Request, Response, NextFunction } from "express";
import { sessionExist } from "../wa";
import { logger } from "../shared";

const validateSession = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const sessionId = req.query.sessionId as string;
        
        if (!sessionId) {
            logger.warn('No sessionId provided');
            res.status(400).json({ error: 'Session ID is required' });
            return;
        }

        if (!sessionExist(sessionId)) {
            logger.warn({ sessionId }, 'Session not found');
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        next();
    } catch (error) {
        logger.error({ error }, 'Error validating session');
        res.status(500).json({ error: 'Internal server error' });
    }
};

export default validateSession;