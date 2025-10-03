import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { ESPValidationResult, MailchimpList } from '../types';

export class MailchimpService {
    private apiClient: AxiosInstance;
    private dataCenter: string;

    constructor(apiKey: string, dataCenter?: string) {
        // Extract data center from API key if not provided
        this.dataCenter = dataCenter || this.extractDataCenter(apiKey);
        
        this.apiClient = axios.create({
            baseURL: `https://${this.dataCenter}.api.mailchimp.com/3.0`,
            timeout: 30000,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            }
        });

        // Request interceptor for logging
        this.apiClient.interceptors.request.use(
            (config) => {
                logger.info(`Mailchimp API Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                logger.error('Mailchimp API Request Error:', error);
                return Promise.reject(error);
            }
        );

        // Response interceptor for error handling
        this.apiClient.interceptors.response.use(
            (response) => {
                logger.info(`Mailchimp API Response: ${response.status} ${response.config.url}`);
                return response;
            },
            (error) => {
                logger.error('Mailchimp API Error:', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    url: error.config?.url
                });
                return Promise.reject(this.handleApiError(error));
            }
        );
    }

    private extractDataCenter(apiKey: string): string {
        const parts = apiKey.split('-');
        if (parts.length !== 2) {
            throw new AppError(
                'Invalid Mailchimp API key format. Expected format: xxxxxxxx-usXX',
                400,
                'INVALID_API_KEY_FORMAT'
            );
        }
        return parts[1];
    }

    private handleApiError(error: any): AppError {
        if (error.response) {
            const { status, data } = error.response;
            
            switch (status) {
                case 401:
                    return new AppError(
                        'Invalid Mailchimp API key or insufficient permissions',
                        401,
                        'MAILCHIMP_UNAUTHORIZED'
                    );
                case 404:
                    return new AppError(
                        'Mailchimp resource not found',
                        404,
                        'MAILCHIMP_NOT_FOUND'
                    );
                case 429:
                    return new AppError(
                        'Mailchimp API rate limit exceeded',
                        429,
                        'MAILCHIMP_RATE_LIMIT'
                    );
                default:
                    return new AppError(
                        data?.detail || 'Mailchimp API error',
                        status,
                        'MAILCHIMP_API_ERROR'
                    );
            }
        }

        if (error.code === 'ECONNABORTED') {
            return new AppError(
                'Mailchimp API request timeout',
                408,
                'MAILCHIMP_TIMEOUT'
            );
        }

        return new AppError(
            'Mailchimp service unavailable',
            503,
            'MAILCHIMP_SERVICE_ERROR'
        );
    }

    async validateConnection(): Promise<ESPValidationResult> {
        try {
            const response = await this.apiClient.get('/');
            
            return {
                isValid: true,
                provider: 'mailchimp',
                accountInfo: {
                    accountName: response.data.account_name,
                    email: response.data.email,
                    role: response.data.role,
                    accountId: response.data.account_id
                }
            };
        } catch (error) {
            logger.error('Mailchimp connection validation failed:', error);
            
            return {
                isValid: false,
                provider: 'mailchimp',
                error: error instanceof AppError ? error.message : 'Connection validation failed'
            };
        }
    }

    async getLists(): Promise<MailchimpList[]> {
        try {
            // Get total count first
            const countResponse = await this.apiClient.get('/lists?fields=total_items');
            const totalItems = countResponse.data.total_items;

            // Fetch all lists (max 1000 per request)
            const response = await this.apiClient.get(`/lists?count=${Math.min(totalItems, 1000)}&fields=lists.id,lists.name,lists.stats.member_count,lists.subscribe_url_long,lists.date_created`);
            
            return response.data.lists.map((list: any) => ({
                id: list.id,
                name: list.name,
                memberCount: list.stats?.member_count || 0,
                subscribeUrlLong: list.subscribe_url_long,
                dateCreated: list.date_created
            }));
        } catch (error) {
            logger.error('Failed to fetch Mailchimp lists:', error);
            throw error;
        }
    }

    async getListById(listId: string): Promise<MailchimpList> {
        try {
            const response = await this.apiClient.get(`/lists/${listId}?fields=id,name,stats.member_count,subscribe_url_long,date_created`);
            
            return {
                id: response.data.id,
                name: response.data.name,
                memberCount: response.data.stats?.member_count || 0,
                subscribeUrlLong: response.data.subscribe_url_long,
                dateCreated: response.data.date_created
            };
        } catch (error) {
            logger.error(`Failed to fetch Mailchimp list ${listId}:`, error);
            throw error;
        }
    }
}
