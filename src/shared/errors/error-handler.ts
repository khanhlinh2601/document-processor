import { Logger } from '../logger/logger';
import { BaseError } from './base-error';
import { ApiError, HttpStatusCode } from './app-errors';

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  correlationId?: string;
  details?: any;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private logger: Logger;
  
  private constructor() {
    this.logger = new Logger('ErrorHandler');
  }
  
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }
  
  /**
   * Handle any error and return appropriate response
   */
  public handleError(error: Error | any, correlationId?: string): ErrorResponse {
    // Log the error
    if (error instanceof BaseError) {
      this.logger.error(error.message, error, { correlationId });
    } else {
      this.logger.error('Unhandled error', error, { correlationId });
    }
    
    // Return appropriate response
    return this.createErrorResponse(error, correlationId);
  }
  
  /**
   * Create a standardized error response
   */
  private createErrorResponse(error: any, correlationId?: string): ErrorResponse {
    // Handle BaseError types
    if (error instanceof BaseError) {
      return {
        error: error.name,
        message: error.message,
        statusCode: error.httpCode,
        correlationId,
        details: error.isOperational ? error.context : undefined
      };
    }
    
    // Handle standard Error
    if (error instanceof Error) {
      return {
        error: error.name || 'InternalServerError',
        message: error.message || 'An unexpected error occurred',
        statusCode: HttpStatusCode.INTERNAL_SERVER,
        correlationId
      };
    }
    
    // Handle unknown error types
    return {
      error: 'UnknownError',
      message: String(error) || 'An unknown error occurred',
      statusCode: HttpStatusCode.INTERNAL_SERVER,
      correlationId
    };
  }
  
  /**
   * Utility to wrap an async handler with error handling
   */
  public wrapHandler<T, R>(
    handler: (input: T) => Promise<R>,
    correlationId?: string
  ): (input: T) => Promise<R> {
    return async (input: T): Promise<R> => {
      try {
        return await handler(input);
      } catch (error) {
        // Handle the error
        const errorResponse = this.handleError(error, correlationId);
        
        // Convert to API error and rethrow
        throw new ApiError(
          errorResponse.error,
          errorResponse.statusCode as HttpStatusCode,
          errorResponse.message,
          true,
          { correlationId, details: errorResponse.details }
        );
      }
    };
  }
} 