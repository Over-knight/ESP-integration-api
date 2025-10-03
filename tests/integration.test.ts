import request from 'supertest';
import app from '../src/index';
import { connectDatabase, closeDatabase } from '../src/config/database';

describe('ESP Integration API', () => {
    beforeAll(async () => {
        await connectDatabase();
    });

    afterAll(async () => {
        await closeDatabase();
    });

    describe('Health Check', () => {
        it('should return 200 OK', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body.status).toBe('OK');
        });
    });

    describe('ESP Integrations', () => {
        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/integrations/esp')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should validate provider field', async () => {
            const response = await request(app)
                .post('/api/integrations/esp')
                .send({
                    provider: 'invalid',
                    apiKey: 'test-key'
                })
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });
    });
});
