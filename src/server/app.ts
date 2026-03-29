import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import issueRoutes from './routes/issues';
import sprintRoutes from './routes/sprints';
import commentRoutes from './routes/comments';
import searchRoutes from './routes/search';
import { errorHandler } from './middleware/errorHandler';

const app: Application = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: process.env['CORS_ORIGIN'] /* istanbul ignore next */ ?? 'http://localhost:3000',
  credentials: true,
}));

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId/issues', issueRoutes);
app.use('/api/projects/:projectId/sprints', sprintRoutes);
app.use('/api/projects/:projectId/issues/:issueId/comments', commentRoutes);
app.use('/api/search', searchRoutes);

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
