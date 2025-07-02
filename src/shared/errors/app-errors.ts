import { BaseError } from './base-error';

/**
 * HTTP Status codes
 */
export enum HttpStatusCode {
  OK = 200,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  INTERNAL_SERVER = 500,
  SERVICE_UNAVAILABLE = 503,
}

/**
 * API Error - Base class for all API related errors
 */
export class ApiError extends BaseError {
  constructor(
    name: string,
    httpCode: HttpStatusCode = HttpStatusCode.INTERNAL_SERVER,
    description: string = 'Internal Server Error',
    isOperational: boolean = true,
    context: Record<string, any> = {}
  ) {
    super(name, httpCode, description, isOperational, context);
  }
}

/**
 * Bad Request Error - For invalid client requests
 */
export class BadRequestError extends ApiError {
  constructor(description: string, context: Record<string, any> = {}) {
    super('BAD_REQUEST_ERROR', HttpStatusCode.BAD_REQUEST, description, true, context);
  }
}

/**
 * Not Found Error - When a resource is not found
 */
export class NotFoundError extends ApiError {
  constructor(description: string, context: Record<string, any> = {}) {
    super('NOT_FOUND_ERROR', HttpStatusCode.NOT_FOUND, description, true, context);
  }
}

/**
 * Unauthorized Error - When authentication is required
 */
export class UnauthorizedError extends ApiError {
  constructor(description: string = 'Authentication required', context: Record<string, any> = {}) {
    super('UNAUTHORIZED_ERROR', HttpStatusCode.UNAUTHORIZED, description, true, context);
  }
}

/**
 * Forbidden Error - When user doesn't have permission
 */
export class ForbiddenError extends ApiError {
  constructor(description: string = 'Access denied', context: Record<string, any> = {}) {
    super('FORBIDDEN_ERROR', HttpStatusCode.FORBIDDEN, description, true, context);
  }
}

/**
 * Service Error - Base class for service-related errors
 */
export class ServiceError extends BaseError {
  constructor(
    name: string,
    httpCode: HttpStatusCode = HttpStatusCode.INTERNAL_SERVER,
    description: string = 'Service Error',
    isOperational: boolean = true,
    context: Record<string, any> = {}
  ) {
    super(name, httpCode, description, isOperational, context);
  }
}

/**
 * Database Error - For database operation errors
 */
export class DatabaseError extends ServiceError {
  constructor(description: string, context: Record<string, any> = {}) {
    super('DATABASE_ERROR', HttpStatusCode.INTERNAL_SERVER, description, true, context);
  }
}

/**
 * Queue Error - For message queue operation errors
 */
export class QueueError extends ServiceError {
  constructor(description: string, context: Record<string, any> = {}) {
    super('QUEUE_ERROR', HttpStatusCode.INTERNAL_SERVER, description, true, context);
  }
}

/**
 * Storage Error - For storage operation errors (S3, etc.)
 */
export class StorageError extends ServiceError {
  constructor(description: string, context: Record<string, any> = {}) {
    super('STORAGE_ERROR', HttpStatusCode.INTERNAL_SERVER, description, true, context);
  }
}

/**
 * Validation Error - For data validation errors
 */
export class ValidationError extends ApiError {
  public readonly validationErrors: any[];
  
  constructor(description: string, validationErrors: any[] = [], context: Record<string, any> = {}) {
    super(
      'VALIDATION_ERROR', 
      HttpStatusCode.BAD_REQUEST, 
      description, 
      true, 
      { ...context, validationErrors }
    );
    this.validationErrors = validationErrors;
  }
} 