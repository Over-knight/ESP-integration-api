import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export const connectDatabase = async (): Promise<void> => {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/esp-integration';
        
        const options = {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferCommands: false
        };

        await mongoose.connect(mongoUri, options);
        
        logger.info(' Connected to MongoDB successfully');
        
        // Handle connection events
        mongoose.connection.on('disconnected', () => {
            logger.warn(' MongoDB disconnected');
        });
        
        mongoose.connection.on('error', (err) => {
            logger.error(' MongoDB connection error:', err);
        });
        
        mongoose.connection.on('reconnected', () => {
            logger.info(' MongoDB reconnected');
        });
        
    } catch (error) {
        logger.error(' Failed to connect to MongoDB:', error);
        throw error;
    }
};

export const closeDatabase = async (): Promise<void> => {
    try {
        await mongoose.connection.close();
        logger.info(' MongoDB connection closed');
    } catch (error) {
        logger.error(' Error closing MongoDB connection:', error);
        throw error;
    }
};
