import { MailchimpService } from './mailchimp.service';
import { GetResponseService } from './getresponse.service';
import { ESPCredentials } from '../types';
import { AppError } from '../middleware/errorHandler';

export class ESPServiceFactory {
    static createService(credentials: ESPCredentials): MailchimpService | GetResponseService {
        switch (credentials.provider) {
            case 'mailchimp':
                return new MailchimpService(credentials.apiKey, credentials.dataCenter);
            
            case 'getresponse':
                return new GetResponseService(credentials.apiKey);
            
            default:
                throw new AppError(
                    `Unsupported ESP provider: ${credentials.provider}`,
                    400,
                    'UNSUPPORTED_PROVIDER'
                );
        }
    }

    static extractDataCenterFromMailchimpKey(apiKey: string): string | null {
        const parts = apiKey.split('-');
        return parts.length === 2 ? parts[1] : null;
    }

    static validateApiKeyFormat(provider: string, apiKey: string): boolean {
        switch (provider) {
            case 'mailchimp':
                // Mailchimp format: 32-char-hex-us10
                return /^[a-fA-F0-9]{32}-us\d+$/.test(apiKey);
            
            case 'getresponse':
                // GetResponse format: alphanumeric string, typically 20+ chars
                return /^[a-zA-Z0-9]{20,}$/.test(apiKey);
            
            default:
                return false;
        }
    }
}
