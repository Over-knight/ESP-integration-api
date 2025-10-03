export interface ESPCredentials {
    provider: 'mailchimp' | 'getresponse';
    apiKey: string;
    dataCenter?: string; // For Mailchimp
}

export interface ESPIntegration {
    _id?: string;
    provider: 'mailchimp' | 'getresponse';
    apiKey: string;
    dataCenter?: string;
    isActive: boolean;
    lastVerified?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface MailchimpList {
    id: string;
    name: string;
    memberCount: number;
    subscribeUrlLong?: string;
    dateCreated?: string;
}

export interface GetResponseList {
    campaignId: string;
    name: string;
    description?: string;
    createdOn?: string;
}

export interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    meta?: {
        timestamp: string;
        requestId?: string;
    };
}

export interface ValidationError {
    field: string;
    message: string;
    value?: any;
}

export interface ESPValidationResult {
    isValid: boolean;
    provider: 'mailchimp' | 'getresponse';
    error?: string;
    accountInfo?: any;
}
