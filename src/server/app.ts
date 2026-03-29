import express, { Application } from 'express';
import cors from 'cors';
import healthRoutes from './routes/health';
import { errorHandler } from './middleware/errorHandler';

const app: Application = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// Routes
app.use('/api/health', healthRoutes);

// 404 handler — catches any request that didn't match a route above
app.use((_req, res) => {
  res.status(404).json({
    error: {
      message: 'Not Found',
      statusCode: 404,
      timestamp: new Date().toISOString(),
    },
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
