import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";

const requestValidator = (req: Request, res: Response, next: NextFunction): void => {
    // console.log("req body",{body:req.body,params:req.params, query:req.query})
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    next();
};

export default requestValidator;