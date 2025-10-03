import { Router } from 'express';
import { IntegrationController } from '../controllers/integration.controller';
import { validateESPIntegration } from '../middleware/validation';

const router = Router();

/**
 * @route   POST /api/integrations/esp
 * @desc    Save and integrate ESP API key
 * @access  Public
 * @body    { provider: 'mailchimp' | 'getresponse', apiKey: string }
 */
router.post('/esp', validateESPIntegration, IntegrationController.createESPIntegration);

/**
 * @route   GET /api/integrations/esp/lists
 * @desc    Get all audiences/lists from connected ESP accounts
 * @access  Public
 * @query   ?provider=mailchimp|getresponse (optional)
 */
router.get('/esp/lists', IntegrationController.getESPLists);

/**
 * @route   GET /api/integrations/esp
 * @desc    Get all active integrations
 * @access  Public
 */
router.get('/esp', IntegrationController.getIntegrations);

/**
 * @route   DELETE /api/integrations/esp/:id
 * @desc    Deactivate an integration
 * @access  Public
 */
router.delete('/esp/:id', IntegrationController.deleteIntegration);

/**
 * @route   POST /api/integrations/esp/:id/test
 * @desc    Test integration connection
 * @access  Public
 */
router.post('/esp/:id/test', IntegrationController.testIntegration);

export default router;
