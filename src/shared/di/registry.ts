import { Container, ServiceFactory, withLogContext } from './container';
import { SQSService } from '../../services/sqs.service';
import { IngestionService } from '../../services/ingestion.service';
import { IMessageQueueService } from '../../services/sqs.service';
import { IIngestionService } from '../../services/ingestion.service';
import { Logger, LogContext } from '../logger/logger';

/**
 * Service registry for the application
 * Configures the dependency injection container
 */
export class ServiceRegistry {
  private container: Container;
  private logger: Logger;
  
  constructor() {
    this.container = Container.getInstance();
    this.logger = new Logger('ServiceRegistry');
  }
  
  /**
   * Initialize services with environment configuration
   */
  public initialize(): void {
    this.logger.debug('Initializing service registry');
    
    // Register factories
    this.registerFactories();
    
    this.logger.info('Service registry initialized');
  }
  
  /**
   * Register all service factories
   */
  private registerFactories(): void {
    // Register SQS service factory
    this.container.registerFactory<IMessageQueueService>(
      'messageQueueService', 
      (logContext: LogContext, queueUrl: string) => {
        return new SQSService(queueUrl, logContext);
      }
    );
    
    // Register ingestion service factory
    this.container.registerFactory<IIngestionService>(
      'ingestionService',
      (logContext: LogContext, messageQueueService: IMessageQueueService) => {
        return new IngestionService(messageQueueService, logContext);
      }
    );
  }
  
  /**
   * Get a message queue service
   * @param queueUrl SQS queue URL
   * @param logContext Logging context
   * @returns Message queue service
   */
  public getMessageQueueService(queueUrl: string, logContext?: LogContext): IMessageQueueService {
    return this.container.resolve<IMessageQueueService>(
      'messageQueueService',
      logContext,
      queueUrl
    );
  }
  
  /**
   * Get an ingestion service
   * @param messageQueueService Message queue service
   * @param logContext Logging context
   * @returns Ingestion service
   */
  public getIngestionService(
    messageQueueService: IMessageQueueService, 
    logContext?: LogContext
  ): IIngestionService {
    return this.container.resolve<IIngestionService>(
      'ingestionService',
      logContext,
      messageQueueService
    );
  }
}

// Create a singleton instance
export const serviceRegistry = new ServiceRegistry(); 