import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { AppError } from './errorHandler';

// Validation error handler
export const handleValidationErrors = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const validationErrors = errors.array().map(error => ({
            field: error.type === 'field' ? (error as any).path : 'unknown',
            message: error.msg,
            value: error.type === 'field' ? (error as any).value : undefined
        }));
        
        const error = new AppError(
            'Validation failed',
            400,
            'VALIDATION_ERROR'
        );
        (error as any).details = validationErrors;
        
        return next(error);
    }
    
    next();
};

// ESP Integration validation rules
export const validateESPIntegration = [
    body('provider')
        .isIn(['mailchimp', 'getresponse'])
        .withMessage('Provider must be either "mailchimp" or "getresponse"'),
    
    body('apiKey')
        .isString()
        .trim()
        .isLength({ min: 10 })
        .withMessage('API key must be at least 10 characters long'),
    
    body('dataCenter')
        .optional()
        .isString()
        .trim()
        .matches(/^us\d+$/)
        .withMessage('Data center must be in format "usXX" (e.g., "us10")'),
    
    handleValidationErrors
];

// Custom validation for Mailchimp
export const validateMailchimpIntegration = [
    body('provider')
        .equals('mailchimp')
        .withMessage('Provider must be "mailchimp"'),
    
    body('apiKey')
        .matches(/^[a-fA-F0-9]{32}-us\d+$/)
        .withMessage('Mailchimp API key must be in format "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-usXX"'),
    
    handleValidationErrors
];

// Custom validation for GetResponse
export const validateGetResponseIntegration = [
    body('provider')
        .equals('getresponse')
        .withMessage('Provider must be "getresponse"'),
    
    body('apiKey')
        .isAlphanumeric()
        .isLength({ min: 20 })
        .withMessage('GetResponse API key must be alphanumeric and at least 20 characters'),
    
    handleValidationErrors
];
