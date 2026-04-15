import { connectDatabase } from './config/database';
import config from './config';
import app from './app';
import logger from './utils/logger';

async function start(): Promise<void> {
  await connectDatabase();
  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
