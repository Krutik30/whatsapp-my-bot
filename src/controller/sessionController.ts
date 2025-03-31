import { Request, Response } from "express";
import { createSession, deleteSession, getSession, getSessionStatus, listSessions, sessionExist } from "../wa";

const sessionController = {
    add: async (req: Request, res: Response): Promise<void> => {
        try {
            // if session exist return 
            if (sessionExist(req.body.sessionId)) {
                res.status(200).json({ error: 'Session already exist!' });
                return;
            }
            
            await createSession({
                sessionId: req.body.sessionId,
                res,
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to create session' });
        }
    },
    
    list: (req: Request, res: Response): void => {
        res.status(200).json(listSessions());
    },
    
    status: (req: Request, res: Response): void => {
        const sessionId = req.query.sessionId as string;
        const session = getSession(sessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }
        res.status(200).json({ status: getSessionStatus(session) });
    },
    
    delete: async (req: Request, res: Response): Promise<void> => {
        try {
            await deleteSession(req.query.sessionId as string);
            res.status(200).json({ message: 'Session deleted' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete session' });
        }
    }
};

export default sessionController;