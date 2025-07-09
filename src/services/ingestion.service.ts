import { S3Event } from 'aws-lambda';
import { Logger, LogContext } from '../shared/logger/logger';
import { DocumentMessage } from '../dtos/document-message.dto';
import { StorageError, ValidationError } from '../shared/errors';
import { IMessageQueueService } from './sqs.service';

// Interface for the ingestion service following Interface Segregation
export interface IIngestionService {
  processS3Event(s3Event: S3Event): Promise<string[]>;
}

// Main implementation of ingestion service with Single Responsibility
export class IngestionService implements IIngestionService {
  private messageQueueService: IMessageQueueService;
  private logger: Logger;

  constructor(messageQueueService: IMessageQueueService, logContext?: LogContext) {
    this.messageQueueService = messageQueueService;
    this.logger = new Logger('IngestionService', logContext);
  }

  async processS3Event(s3Event: S3Event): Promise<string[]> {
    this.logger.info('Processing S3 event', { recordCount: s3Event.Records?.length || 0 });
    
    if (!s3Event.Records || s3Event.Records.length === 0) {
      throw new StorageError('No records found in S3 event', { event: s3Event });
    }

    const messageIds: string[] = [];
    const messagePromises = s3Event.Records.map(record => this.processS3Record(record));
    
    const results = await Promise.allSettled(messagePromises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        messageIds.push(result.value);
      } else {
        this.logger.error(`Failed to process record at index ${index}`, result.reason);
      }
    });

    this.logger.info('S3 event processing completed', { 
      totalRecords: s3Event.Records.length,
      successCount: messageIds.length,
      failureCount: s3Event.Records.length - messageIds.length
    });

    return messageIds;
  }
  
  private async processS3Record(record: any): Promise<string> {
    try {
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
      
      this.logger.debug('Processing S3 record', { bucket, key });
      
      // Create document message with validation
      const messageData = {
        bucket,
        key,
        timestamp: new Date().toISOString(),
        metadata: {
          eventTime: record.eventTime || new Date().toISOString(),
          eventName: record.eventName || 'ObjectCreated',
          fileSize: record.s3.object.size?.toString() || '0',
        }
      };
      
      // Validate the message using class-validator
      try {
        const message = await DocumentMessage.fromObject(messageData);
        
        // Send validated message to queue service
        const messageId = await this.messageQueueService.sendMessage(message);
        
        this.logger.info(`Successfully queued ingestion task`, { 
          messageId,
          bucket,
          key
        });
        
        return messageId;
      } catch (validationError) {
        throw new ValidationError(
          'Failed to validate document message',
          validationError instanceof ValidationError ? validationError.validationErrors : [],
          { messageData }
        );
      }
    } catch (error) {
      this.logger.error('Error processing S3 record', error);
      throw error;
    }
  }
} 