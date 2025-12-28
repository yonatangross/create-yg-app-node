import pino, { type LoggerOptions } from 'pino';
import { config } from '../config/env.js';

const options: LoggerOptions = {
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  base: {
    env: config.NODE_ENV,
    version: config.VERSION,
  },
};

// Only use pino-pretty in development
if (config.NODE_ENV === 'development') {
  options.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'HH:MM:ss',
    },
  };
}

export const logger = pino(options);
