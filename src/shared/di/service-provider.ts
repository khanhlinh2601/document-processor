import { AppFactory } from './app.factory';
import { TOKENS } from './tokens';
import { LogContext, Logger } from '../logger/logger';
import { IMessageQueueService } from 'src/services/sqs.service';
import { IIngestionService } from 'src/services/ingestion.service';

/**
 * Service provider for the application
 * Provides access to services through NestJS DI container
 */
export class ServiceProvider {
  private static logger = new Logger('ServiceProvider');

  /**
   * Initialize the service provider
   */
  public static async initialize(): Promise<void> {
    this.logger.debug('Initializing service provider');
    await AppFactory.initialize();
    this.logger.info('Service provider initialized');
  }

  /**
   * Get a message queue service
   * @param queueUrl SQS queue URL
   * @param logContext Logging context
   * @returns Message queue service
   */
  public static async getMessageQueueService(
    queueUrl?: string,
    logContext?: LogContext
  ): Promise<IMessageQueueService> {
    try {
      const factory = await AppFactory.getService<(queueUrl?: string, logContext?: LogContext) => IMessageQueueService>(
        TOKENS.MESSAGE_QUEUE_SERVICE
      );
      return factory(queueUrl, logContext);
    } catch (error) {
      this.logger.error('Failed to get message queue service', error);
      throw error;
    }
  }

  /**
   * Get an ingestion service
   * @param messageQueueService Message queue service
   * @param logContext Logging context
   * @returns Ingestion service
   */
  public static async getIngestionService(
    messageQueueService: IMessageQueueService,
    logContext?: LogContext
  ): Promise<IIngestionService> {
    try {
      const factory = await AppFactory.getService<
        (messageQueueService: IMessageQueueService, logContext?: LogContext) => IIngestionService
      >(TOKENS.INGESTION_SERVICE);
      return factory(messageQueueService, logContext);
    } catch (error) {
      this.logger.error('Failed to get ingestion service', error);
      throw error;
    }
  }
}