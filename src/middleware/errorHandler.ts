import { Request, Response, NextFunction } from 'express';
import { ValidationError } from 'express-validator';
import { logger } from '../utils/logger';
import { APIResponse } from '../types';

// Custom error class
export class AppError extends Error {
    public statusCode: number;
    public code: string;
    public isOperational: boolean;

    constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

// Error handler middleware
export const errorHandler = (
    err: Error | AppError,
    req: Request,
    res: Response<APIResponse>,
    next: NextFunction
) => {
    let statusCode = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';

    // Log the error
    logger.error('API Error:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    // Handle different error types
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        code = err.code;
        message = err.message;
    } else if (err.name === 'ValidationError') {
        statusCode = 400;
        code = 'VALIDATION_ERROR';
        message = 'Validation failed';
    } else if (err.name === 'CastError') {
        statusCode = 400;
        code = 'INVALID_ID';
        message = 'Invalid ID format';
    } else if (err.name === 'MongoServerError' && (err as any).code === 11000) {
        statusCode = 409;
        code = 'DUPLICATE_ENTRY';
        message = 'Duplicate entry found';
    } else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        code = 'INVALID_TOKEN';
        message = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        code = 'TOKEN_EXPIRED';
        message = 'Token expired';
    }

    // Don't leak error details in production
    const response: APIResponse = {
        success: false,
        error: {
            code,
            message: process.env.NODE_ENV === 'production' && statusCode === 500 
                ? 'Internal server error' 
                : message
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    };

    // Include error details in development
    if (process.env.NODE_ENV !== 'production' && statusCode >= 500) {
        response.error!.details = {
            stack: err.stack,
            originalMessage: err.message
        };
    }

    res.status(statusCode).json(response);
};

// 404 handler
export const notFoundHandler = (
    req: Request,
    res: Response<APIResponse>,
    next: NextFunction
) => {
    const response: APIResponse = {
        success: false,
        error: {
            code: 'ROUTE_NOT_FOUND',
            message: `Route ${req.method} ${req.originalUrl} not found`
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    };

    res.status(404).json(response);
};

// Async error wrapper
export const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
