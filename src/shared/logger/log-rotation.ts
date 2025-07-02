import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

export interface LogRotationConfig {
  enabled: boolean;
  logDirectory: string;
  maxLogFiles: number;
  maxLogSize: number; // in bytes
  logFilePrefix: string;
}

export class LogRotationManager {
  private config: LogRotationConfig;
  private logger: Logger;
  private currentLogFile: string;
  private currentLogStream: fs.WriteStream | null = null;
  private currentLogSize: number = 0;

  constructor(config: LogRotationConfig) {
    this.config = config;
    this.logger = new Logger('LogRotationManager');
    this.currentLogFile = this.generateLogFileName();

    if (this.config.enabled) {
      this.ensureLogDirectory();
      this.setupLogRotation();
    }
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.config.logDirectory)) {
      fs.mkdirSync(this.config.logDirectory, { recursive: true });
    }
  }

  private generateLogFileName(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(
      this.config.logDirectory, 
      `${this.config.logFilePrefix}-${timestamp}.log`
    );
  }

  private setupLogRotation(): void {
    this.currentLogStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
    
    // Override console methods to write to file
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };

    // Redirect console output to log file
    console.log = (...args) => {
      this.writeToLog(args);
      originalConsole.log(...args);
    };

    console.info = (...args) => {
      this.writeToLog(args);
      originalConsole.info(...args);
    };

    console.warn = (...args) => {
      this.writeToLog(args);
      originalConsole.warn(...args);
    };

    console.error = (...args) => {
      this.writeToLog(args);
      originalConsole.error(...args);
    };

    console.debug = (...args) => {
      this.writeToLog(args);
      originalConsole.debug(...args);
    };
  }

  private writeToLog(args: any[]): void {
    if (!this.config.enabled || !this.currentLogStream) return;

    const logLine = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ') + '\n';
    
    this.currentLogStream.write(logLine);
    this.currentLogSize += logLine.length;
    
    if (this.currentLogSize >= this.config.maxLogSize) {
      this.rotateLog();
    }
  }

  private rotateLog(): void {
    if (this.currentLogStream) {
      this.currentLogStream.end();
    }
    
    this.currentLogFile = this.generateLogFileName();
    this.currentLogStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
    this.currentLogSize = 0;
    
    this.logger.info(`Rotated log file to: ${this.currentLogFile}`);
    this.enforceRetentionPolicy();
  }

  private enforceRetentionPolicy(): void {
    try {
      const files = fs.readdirSync(this.config.logDirectory)
        .filter(file => file.startsWith(this.config.logFilePrefix))
        .map(file => path.join(this.config.logDirectory, file))
        .map(file => ({
          path: file,
          mtime: fs.statSync(file).mtime.getTime()
        }))
        .sort((a, b) => b.mtime - a.mtime);
      
      if (files.length > this.config.maxLogFiles) {
        const filesToDelete = files.slice(this.config.maxLogFiles);
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
          this.logger.debug(`Deleted old log file: ${file.path}`);
        }
      }
    } catch (error) {
      this.logger.error('Error enforcing log retention policy', error);
    }
  }
}

// Initialize from environment
export function initializeLogRotation(): LogRotationManager | null {
  const enabled = process.env.LOG_ROTATION_ENABLED === 'true';
  
  if (!enabled) return null;
  
  return new LogRotationManager({
    enabled,
    logDirectory: process.env.LOG_DIRECTORY || './logs',
    maxLogFiles: parseInt(process.env.MAX_LOG_FILES || '10', 10),
    maxLogSize: parseInt(process.env.MAX_LOG_SIZE || '10485760', 10), // 10MB default
    logFilePrefix: process.env.LOG_FILE_PREFIX || 'application'
  });
} 