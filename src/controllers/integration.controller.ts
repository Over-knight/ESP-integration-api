import { Request, Response, NextFunction } from 'express';
import { ESPIntegrationModel } from '../models/Integration';
import { ESPServiceFactory } from '../services/esp-service.factory';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { APIResponse, ESPCredentials } from '../types';
import { logger } from '../utils/logger';

export class IntegrationController {
    // POST /api/integrations/esp - Save and integrate ESP API key
    static createESPIntegration = asyncHandler(async (req: Request, res: Response<APIResponse>) => {
        const { provider, apiKey }: ESPCredentials = req.body;

        // Extract data center for Mailchimp
        let dataCenter: string | undefined;
        if (provider === 'mailchimp') {
            dataCenter = ESPServiceFactory.extractDataCenterFromMailchimpKey(apiKey) || undefined;
            if (!dataCenter) {
                throw new AppError(
                    'Invalid Mailchimp API key format. Expected format: xxxxxxxx-usXX',
                    400,
                    'INVALID_MAILCHIMP_KEY'
                );
            }
        }

        // Validate API key format
        if (!ESPServiceFactory.validateApiKeyFormat(provider, apiKey)) {
            throw new AppError(
                `Invalid ${provider} API key format`,
                400,
                'INVALID_API_KEY_FORMAT'
            );
        }

        // Test connection with the ESP service
        const service = ESPServiceFactory.createService({ provider, apiKey, dataCenter });
        const validationResult = await service.validateConnection();

        if (!validationResult.isValid) {
            throw new AppError(
                validationResult.error || 'Failed to validate ESP connection',
                401,
                'ESP_CONNECTION_FAILED'
            );
        }

        // Check if integration already exists for this provider
        const existingIntegration = await ESPIntegrationModel.findOne({ 
            provider,
            isActive: true
        });

        let integration;

        if (existingIntegration) {
            // Update existing integration
            existingIntegration.apiKey = apiKey;
            existingIntegration.dataCenter = dataCenter;
            existingIntegration.lastVerified = new Date();
            integration = await existingIntegration.save();

            logger.info(`Updated ${provider} integration`, {
                integrationId: integration._id,
                provider
            });
        } else {
            // Create new integration
            integration = new ESPIntegrationModel({
                provider,
                apiKey,
                dataCenter,
                isActive: true,
                lastVerified: new Date()
            });
            
            await integration.save();

            logger.info(`Created new ${provider} integration`, {
                integrationId: integration._id,
                provider
            });
        }

        // Return response without sensitive data
        const response: APIResponse = {
            success: true,
            data: {
                id: integration._id,
                provider: integration.provider,
                dataCenter: integration.dataCenter,
                isActive: integration.isActive,
                lastVerified: integration.lastVerified,
                createdAt: integration.createdAt,
                updatedAt: integration.updatedAt,
                accountInfo: validationResult.accountInfo
            },
            meta: {
                timestamp: new Date().toISOString()
            }
        };

        res.status(existingIntegration ? 200 : 201).json(response);
    });

    // GET /api/integrations/esp/lists - Get all audiences
    static getESPLists = asyncHandler(async (req: Request, res: Response<APIResponse>) => {
        const { provider } = req.query as { provider?: string };

        // Get all active integrations or filter by provider
        const filter: any = { isActive: true };
        if (provider) {
            if (!['mailchimp', 'getresponse'].includes(provider)) {
                throw new AppError(
                    'Invalid provider. Must be "mailchimp" or "getresponse"',
                    400,
                    'INVALID_PROVIDER'
                );
            }
            filter.provider = provider;
        }

        const integrations = await ESPIntegrationModel.find(filter).select('+apiKey');

        if (integrations.length === 0) {
            throw new AppError(
                provider ? `No active ${provider} integrations found` : 'No active integrations found',
                404,
                'NO_INTEGRATIONS'
            );
        }

        const allLists: any[] = [];

        // Fetch lists from each integration
        for (const integration of integrations) {
            try {
                const service = ESPServiceFactory.createService({
                    provider: integration.provider,
                    apiKey: integration.apiKey,
                    dataCenter: integration.dataCenter
                });

                const lists = await service.getLists();
                
                // Add provider info to each list
                const listsWithProvider = lists.map(list => ({
                    ...list,
                    provider: integration.provider,
                    integrationId: integration._id
                }));

                allLists.push(...listsWithProvider);

                logger.info(`Fetched ${lists.length} lists from ${integration.provider}`, {
                    integrationId: integration._id,
                    provider: integration.provider,
                    listCount: lists.length
                });

            } catch (error) {
                logger.error(`Failed to fetch lists from ${integration.provider}:`, {
                    integrationId: integration._id,
                    provider: integration.provider,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });

                // Don't fail the entire request if one provider fails
                allLists.push({
                    provider: integration.provider,
                    integrationId: integration._id,
                    error: 'Failed to fetch lists from this provider'
                });
            }
        }

        const response: APIResponse = {
            success: true,
            data: {
                lists: allLists,
                totalCount: allLists.length,
                providers: [...new Set(allLists.map(list => list.provider))]
            },
            meta: {
                timestamp: new Date().toISOString()
            }
        };

        res.status(200).json(response);
    });

    // GET /api/integrations/esp - Get all integrations
    static getIntegrations = asyncHandler(async (req: Request, res: Response<APIResponse>) => {
        const integrations = await ESPIntegrationModel.find({ isActive: true });

        const response: APIResponse = {
            success: true,
            data: {
                integrations,
                totalCount: integrations.length
            },
            meta: {
                timestamp: new Date().toISOString()
            }
        };

        res.status(200).json(response);
    });

    // DELETE /api/integrations/esp/:id - Delete integration
    static deleteIntegration = asyncHandler(async (req: Request, res: Response<APIResponse>) => {
        const { id } = req.params;

        const integration = await ESPIntegrationModel.findById(id);
        if (!integration) {
            throw new AppError(
                'Integration not found',
                404,
                'INTEGRATION_NOT_FOUND'
            );
        }

        integration.isActive = false;
        await integration.save();

        logger.info(`Deactivated ${integration.provider} integration`, {
            integrationId: integration._id,
            provider: integration.provider
        });

        const response: APIResponse = {
            success: true,
            data: {
                message: 'Integration deactivated successfully'
            },
            meta: {
                timestamp: new Date().toISOString()
            }
        };

        res.status(200).json(response);
    });

    // POST /api/integrations/esp/:id/test - Test integration connection
    static testIntegration = asyncHandler(async (req: Request, res: Response<APIResponse>) => {
        const { id } = req.params;

        const integration = await ESPIntegrationModel.findById(id).select('+apiKey');
        if (!integration || !integration.isActive) {
            throw new AppError(
                'Integration not found or inactive',
                404,
                'INTEGRATION_NOT_FOUND'
            );
        }

        const service = ESPServiceFactory.createService({
            provider: integration.provider,
            apiKey: integration.apiKey,
            dataCenter: integration.dataCenter
        });

        const validationResult = await service.validateConnection();

        if (validationResult.isValid) {
            integration.lastVerified = new Date();
            await integration.save();
        }

        const response: APIResponse = {
            success: true,
            data: {
                isValid: validationResult.isValid,
                provider: validationResult.provider,
                error: validationResult.error,
                accountInfo: validationResult.accountInfo,
                lastVerified: integration.lastVerified
            },
            meta: {
                timestamp: new Date().toISOString()
            }
        };

        res.status(200).json(response);
    });
}
