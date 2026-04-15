import mongoose from 'mongoose';
import config from './index';
import logger from '../utils/logger';

export async function connectDatabase(uri?: string): Promise<void> {
  const mongoUri = uri || config.mongodbUri;
  try {
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('Disconnected from MongoDB');
}
