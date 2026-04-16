import express, { Request, Response, NextFunction } from 'express';
import logger from './utils/logger';
import userRoutes from './routes/users';
import hierarchyRoutes from './routes/hierarchy';
import uiRoutes from './routes/ui';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/users', userRoutes);
app.use('/api/hierarchy', hierarchyRoutes);
app.use('/ui', uiRoutes);

// Redirect root to UI
app.get('/', (_req: Request, res: Response) => {
  res.redirect('/ui');
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

export default app;
