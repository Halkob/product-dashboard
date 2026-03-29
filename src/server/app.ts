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

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
