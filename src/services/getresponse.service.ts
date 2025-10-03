import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { ESPValidationResult, GetResponseList } from '../types';

export class GetResponseService {
    private apiClient: AxiosInstance;

    constructor(apiKey: string) {
        this.apiClient = axios.create({
            baseURL: 'https://api.getresponse.com/v3',
            timeout: 30000,
            headers: {
                'X-Auth-Token': `api-key ${apiKey}`,
                'Content-Type': 'application/json',
            }
        });

        // Request interceptor for logging
        this.apiClient.interceptors.request.use(
            (config) => {
                logger.info(`GetResponse API Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                logger.error('GetResponse API Request Error:', error);
                return Promise.reject(error);
            }
        );

        // Response interceptor for error handling
        this.apiClient.interceptors.response.use(
            (response) => {
                logger.info(`GetResponse API Response: ${response.status} ${response.config.url}`);
                return response;
            },
            (error) => {
                logger.error('GetResponse API Error:', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    url: error.config?.url
                });
                return Promise.reject(this.handleApiError(error));
            }
        );
    }

    private handleApiError(error: any): AppError {
        if (error.response) {
            const { status, data } = error.response;
            
            switch (status) {
                case 401:
                    return new AppError(
                        'Invalid GetResponse API key or insufficient permissions',
                        401,
                        'GETRESPONSE_UNAUTHORIZED'
                    );
                case 404:
                    return new AppError(
                        'GetResponse resource not found',
                        404,
                        'GETRESPONSE_NOT_FOUND'
                    );
                case 429:
                    return new AppError(
                        'GetResponse API rate limit exceeded',
                        429,
                        'GETRESPONSE_RATE_LIMIT'
                    );
                case 400:
                    return new AppError(
                        data?.message || 'Bad request to GetResponse API',
                        400,
                        'GETRESPONSE_BAD_REQUEST'
                    );
                default:
                    return new AppError(
                        data?.message || 'GetResponse API error',
                        status,
                        'GETRESPONSE_API_ERROR'
                    );
            }
        }

        if (error.code === 'ECONNABORTED') {
            return new AppError(
                'GetResponse API request timeout',
                408,
                'GETRESPONSE_TIMEOUT'
            );
        }

        return new AppError(
            'GetResponse service unavailable',
            503,
            'GETRESPONSE_SERVICE_ERROR'
        );
    }

    async validateConnection(): Promise<ESPValidationResult> {
        try {
            const response = await this.apiClient.get('/accounts');
            
            return {
                isValid: true,
                provider: 'getresponse',
                accountInfo: {
                    accountId: response.data.accountId,
                    email: response.data.email,
                    firstName: response.data.firstName,
                    lastName: response.data.lastName,
                    phone: response.data.phone,
                    state: response.data.state,
                    zipCode: response.data.zipCode
                }
            };
        } catch (error) {
            logger.error('GetResponse connection validation failed:', error);
            
            return {
                isValid: false,
                provider: 'getresponse',
                error: error instanceof AppError ? error.message : 'Connection validation failed'
            };
        }
    }

    async getLists(): Promise<GetResponseList[]> {
        try {
            // GetResponse calls them campaigns, but they're essentially mailing lists
            const response = await this.apiClient.get('/campaigns?fields=campaignId,name,description,createdOn');
            
            // Handle both array and object responses
            const campaigns = Array.isArray(response.data) ? response.data : Object.values(response.data);
            
            return campaigns.map((campaign: any) => ({
                campaignId: campaign.campaignId,
                name: campaign.name,
                description: campaign.description || '',
                createdOn: campaign.createdOn
            }));
        } catch (error) {
            logger.error('Failed to fetch GetResponse campaigns:', error);
            throw error;
        }
    }

    async getListById(campaignId: string): Promise<GetResponseList> {
        try {
            const response = await this.apiClient.get(`/campaigns/${campaignId}?fields=campaignId,name,description,createdOn`);
            
            return {
                campaignId: response.data.campaignId,
                name: response.data.name,
                description: response.data.description || '',
                createdOn: response.data.createdOn
            };
        } catch (error) {
            logger.error(`Failed to fetch GetResponse campaign ${campaignId}:`, error);
            throw error;
        }
    }

    async getContacts(campaignId?: string, page: number = 1, perPage: number = 100): Promise<any[]> {
        try {
            let url = `/contacts?page=${page}&perPage=${perPage}`;
            if (campaignId) {
                url += `&query[campaignId]=${campaignId}`;
            }

            const response = await this.apiClient.get(url);
            
            // Handle both array and object responses
            return Array.isArray(response.data) ? response.data : Object.values(response.data);
        } catch (error) {
            logger.error('Failed to fetch GetResponse contacts:', error);
            throw error;
        }
    }
}
