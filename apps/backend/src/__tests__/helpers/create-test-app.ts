/**
 * Creates a lean Express application for integration tests.
 * Does NOT call startServer() / testConnection() — the database and
 * external services are mocked at the repository / service layer.
 */
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import '../../config/passport';
import router from '../../routers/index.router';

export function createTestApp() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(passport.initialize());

  app.use('/api/v1', router);

  // 404
  app.use((req: Request, res: Response) => {
    res.status(404).json({ status: 'error', message: `Cannot ${req.method} ${req.path}` });
  });

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.status ?? 500).json({ status: 'error', message: err.message ?? 'Internal server error' });
  });

  return app;
}
