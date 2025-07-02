export * from './logger';
export * from './log-rotation';

import { Logger } from './logger';
import { initializeLogRotation } from './log-rotation';

export function initializeLogging(): void {
  // Initialize log level from environment
  Logger.initializeFromEnvironment();
  
  // Initialize log rotation if enabled
  initializeLogRotation();
} 