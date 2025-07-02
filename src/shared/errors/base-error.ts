/**
 * Base error class for all application errors
 * Extends the standard Error class with additional properties
 */
export class BaseError extends Error {
  public readonly name: string;
  public readonly httpCode: number;
  public readonly isOperational: boolean;
  public readonly context: Record<string, any>;
  public readonly timestamp: string;

  constructor(
    name: string,
    httpCode: number,
    description: string,
    isOperational: boolean,
    context: Record<string, any> = {}
  ) {
    super(description);
    
    this.name = name;
    this.httpCode = httpCode;
    this.isOperational = isOperational;
    this.context = context;
    this.timestamp = new Date().toISOString();
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
  
  /**
   * Convert the error to a plain object for logging or serialization
   */
  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      httpCode: this.httpCode,
      isOperational: this.isOperational,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
  
  /**
   * Determine if the error is operational or programmer error
   */
  public static isOperationalError(error: Error): boolean {
    if (error instanceof BaseError) {
      return error.isOperational;
    }
    return false;
  }
} 