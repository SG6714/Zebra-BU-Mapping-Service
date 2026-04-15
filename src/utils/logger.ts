import winston from 'winston';
import config from '../config';

const logger = winston.createLogger({
  level: config.nodeEnv === 'test' ? 'error' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      silent: config.nodeEnv === 'test',
    }),
  ],
});

export default logger;
