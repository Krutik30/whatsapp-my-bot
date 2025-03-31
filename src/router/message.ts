import { Router } from "express";
import { body, query } from "express-validator";
import requestValidator from "../middleware/RequestValidator";
import validateSession from "../middleware/validateSession";
import messageController from "../controller/messageController";

const messageRoutes = Router();

// Send single message
messageRoutes.post(
    '/send',
    [
        body('jid').isString().notEmpty(),
        body('type').isString().isIn(['group', 'number']).optional(),
        body('message').isObject().notEmpty(),
        body('options').isObject().optional(),
        query('sessionId').isString().notEmpty(),
        requestValidator,
        validateSession
    ],
    messageController.send
);

// Send bulk messages
messageRoutes.post(
    '/send/bulk',
    [
        body().isArray().notEmpty(),
        query('sessionId').isString().notEmpty(),
        requestValidator,
        validateSession
    ],
    messageController.sendBulk
);

export default messageRoutes;