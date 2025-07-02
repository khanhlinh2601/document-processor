export * from './base-error';
export * from './app-errors';
export * from './error-handler';

import { ErrorHandler } from './error-handler';

// Export a singleton instance of the error handler
export const errorHandler = ErrorHandler.getInstance(); 