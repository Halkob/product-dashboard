import { Request, Response, NextFunction } from 'express';

/**
 * Global error handler middleware
 * 
 * Catches all errors and returns consistent error responses
 */
export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('❌ Error:', {
    message: error.message,
    stack: error.stack,
    path: _req.path,
    method: _req.method,
  });

  const statusCode = 500;
  const errorResponse = {
    error: {
      message: error.message || 'Internal Server Error',
      statusCode,
      timestamp: new Date().toISOString(),
    },
  };

  res.status(statusCode).json(errorResponse);
};
