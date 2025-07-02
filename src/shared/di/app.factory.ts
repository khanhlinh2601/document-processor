import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplicationContext } from '@nestjs/common';
import { Logger } from '../../shared/logger/logger';

/**
 * Application factory for initializing NestJS DI container
 */
export class AppFactory {
  private static app: INestApplicationContext;
  private static logger = new Logger('AppFactory');

  /**
   * Initialize the NestJS application
   */
  public static async initialize(): Promise<INestApplicationContext> {
    if (!this.app) {
      this.logger.debug('Initializing NestJS application');
      this.app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn'],
      });
      this.logger.info('NestJS application initialized');
    }
    return this.app;
  }

  /**
   * Get a service from the container
   * @param token Service token
   * @returns Service instance
   */
  public static async getService<T>(token: string): Promise<T> {
    if (!this.app) {
      await this.initialize();
    }
    return this.app.get<T>(token);
  }
} 