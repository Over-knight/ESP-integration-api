import mongoose, { Document, Schema } from 'mongoose';
import { ESPIntegration } from '../types';

// Use intersection for type compatibility
export type IESPIntegration = ESPIntegration & Document;

const ESPIntegrationSchema: Schema = new Schema({
    provider: {
        type: String,
        required: true,
        enum: ['mailchimp', 'getresponse'],
        index: true
    },
    apiKey: {
        type: String,
        required: true,
        select: false // Don't include in queries by default for security
    },
    dataCenter: {
        type: String,
        required: function(this: IESPIntegration) {
            return this.provider === 'mailchimp';
        },
        default: undefined // Ensure undefined, not null
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    lastVerified: {
        type: Date,
        default: undefined // Use undefined instead of null
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt automatically
    toJSON: {
        transform: (doc, ret) => {
            // Use type assertion to handle the delete operations
            const result = ret as any;
            delete result.__v;
            delete result.apiKey; // Never expose API key in JSON responses
            return result;
        }
    }
});

// Indexes for better query performance
ESPIntegrationSchema.index({ provider: 1, isActive: 1 });
ESPIntegrationSchema.index({ createdAt: -1 });

// Instance methods
ESPIntegrationSchema.methods.maskApiKey = function(): string {
    if (!this.apiKey) return '';
    const key = this.apiKey;
    if (key.length <= 8) return '*'.repeat(key.length);
    return key.substring(0, 4) + '*'.repeat(key.length - 8) + key.substring(key.length - 4);
};

// Static methods
ESPIntegrationSchema.statics.findActiveIntegrations = function(provider?: string) {
    const filter: any = { isActive: true };
    if (provider) filter.provider = provider;
    return this.find(filter);
};

export const ESPIntegrationModel = mongoose.model<IESPIntegration>('ESPIntegration', ESPIntegrationSchema);
