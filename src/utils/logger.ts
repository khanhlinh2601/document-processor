export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private static logLevel: LogLevel = LogLevel.INFO;
  private context: string;

  constructor(context: string) {
    this.context = context;
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

  static initializeFromEnvironment(logLevelString?: string): void {
    if (logLevelString) {
      Logger.setLogLevel(logLevelString);
    }
  }

  private formatMessage(message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${this.context}] ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (Logger.logLevel <= LogLevel.DEBUG) {
      console.debug(this.formatMessage(message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (Logger.logLevel <= LogLevel.INFO) {
      console.info(this.formatMessage(message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (Logger.logLevel <= LogLevel.WARN) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  error(message: string, error?: any, ...args: any[]): void {
    if (Logger.logLevel <= LogLevel.ERROR) {
      console.error(this.formatMessage(message), error, ...args);
    }
  }
} 