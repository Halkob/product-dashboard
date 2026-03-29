import request from 'supertest';
import express from 'express';
import { errorHandler } from '../middleware/errorHandler';

// Minimal test app that triggers errors
const errorApp = express();
errorApp.get('/error', (_req, _res, next) => {
  next(new Error('Test error'));
});
errorApp.get('/error-no-message', (_req, _res, next) => {
  const err = new Error();
  err.message = '';
  next(err);
});
errorApp.use(errorHandler);

// Suppress console.error — the error handler intentionally logs,
// which would pollute test output with stack traces.
beforeAll(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterAll(() => jest.restoreAllMocks());

describe('Error Handler Middleware', () => {
  it('should return 500 with error details on unhandled error', async () => {
    const res = await request(errorApp)
      .get('/error')
      .expect('Content-Type', /json/)
      .expect(500);

    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('message', 'Test error');
    expect(res.body.error).toHaveProperty('statusCode', 500);
    expect(res.body.error).toHaveProperty('timestamp');
  });

  it('should include a valid timestamp in the error response', async () => {
    const res = await request(errorApp).get('/error');

    const ts = new Date(res.body.error.timestamp);
    expect(ts.toString()).not.toBe('Invalid Date');
  });

  it('should fall back to default message when error has no message', async () => {
    const res = await request(errorApp)
      .get('/error-no-message')
      .expect(500);

    expect(res.body.error.message).toBe('Internal Server Error');
  });
});
