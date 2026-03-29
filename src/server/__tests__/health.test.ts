import request from 'supertest';
import app from '../app';

describe('Health Check Endpoint', () => {
  it('should return 200 status with healthy response', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toHaveProperty('status', 'healthy');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('environment');
    expect(res.body).toHaveProperty('version');
  });

  it('should have valid timestamp format', async () => {
    const res = await request(app).get('/api/health');

    const timestamp = new Date(res.body.timestamp);
    expect(timestamp.toString()).not.toBe('Invalid Date');
  });

  it('should have positive uptime', async () => {
    const res = await request(app).get('/api/health');

    expect(res.body.uptime).toBeGreaterThan(0);
  });
});
