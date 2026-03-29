import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Health check endpoint
 * GET /api/health
 * 
 * Returns basic health status of the application.
 * Used for monitoring and load balancer health checks.
 */
router.get('/', (_req: Request, res: Response) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '0.1.0-alpha',
  };

  res.status(200).json(healthStatus);
});

export default router;
