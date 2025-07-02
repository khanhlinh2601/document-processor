import { randomUUID } from 'crypto';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogContext {
  correlationId?: string;
  requestId?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context: string;
  correlationId?: string;
  requestId?: string;
  data?: any;
  error?: any;
}

export class Logger {
  private static logLevel: LogLevel = LogLevel.INFO;
  private context: string;
  private logContext: LogContext;

  constructor(context: string, logContext: LogContext = {}) {
    this.context = context;
    this.logContext = { 
      correlationId: logContext.correlationId || randomUUID(),
      ...logContext
    };
  }

  static setLogLevel(level: LogLevel | string): void {
    if (typeof level === 'string') {
      const levelKey = level.toUpperCase() as keyof typeof LogLevel;
      if (LogLevel[levelKey] !== undefined) {
        Logger.logLevel = LogLevel[levelKey];
      }
    } else {
      Logger.logLevel = level;
    }
  }

  static initializeFromEnvironment(): void {
    const logLevelString = process.env.LOG_LEVEL;
    if (logLevelString) {
      Logger.setLogLevel(logLevelString);
    }
  }

  private createLogEntry(level: string, message: string, data?: any, error?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      ...this.logContext,
      ...(data ? { data } : {}),
      ...(error ? { error: this.formatError(error) } : {})
    };
  }

  private formatError(error: any): any {
    if (!error) return undefined;
    
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error as any)
      };
    }
    
    return error;
  }

  // Create a child logger with additional context
  withContext(additionalContext: LogContext): Logger {
    return new Logger(this.context, {
      ...this.logContext,
      ...additionalContext
    });
  }
  
  // Set a request ID for the current request
  setRequestId(requestId: string): void {
    this.logContext.requestId = requestId;
  }

  // Get the correlation ID
  getCorrelationId(): string {
    return this.logContext.correlationId;
  }

  debug(message: string, data?: any): void {
    if (Logger.logLevel <= LogLevel.DEBUG) {
      const logEntry = this.createLogEntry('DEBUG', message, data);
      console.debug(JSON.stringify(logEntry));
    }
  }

  info(message: string, data?: any): void {
    if (Logger.logLevel <= LogLevel.INFO) {
      const logEntry = this.createLogEntry('INFO', message, data);
      console.info(JSON.stringify(logEntry));
    }
  }

  warn(message: string, data?: any): void {
    if (Logger.logLevel <= LogLevel.WARN) {
      const logEntry = this.createLogEntry('WARN', message, data);
      console.warn(JSON.stringify(logEntry));
    }
  }

  error(message: string, error?: any, data?: any): void {
    if (Logger.logLevel <= LogLevel.ERROR) {
      const logEntry = this.createLogEntry('ERROR', message, data, error);
      console.error(JSON.stringify(logEntry));
    }
  }
} 