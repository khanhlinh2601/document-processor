import { S3Event } from 'aws-lambda';
import { SQSService } from './sqs.service';
import { IngestionMessage } from '../models/ingestion-message';
import { Logger } from '../utils/logger';

export class IngestionService {
  private sqsService: SQSService;
  private logger: Logger;

  constructor(sqsService: SQSService) {
    this.sqsService = sqsService;
    this.logger = new Logger('IngestionService');
  }

  async processS3Event(s3Event: S3Event): Promise<string[]> {
    if (!s3Event.Records || s3Event.Records.length === 0) {
      this.logger.warn('No records found in S3 event');
      return [];
    }

    const messageIds: string[] = [];

    for (const record of s3Event.Records) {
      try {
        const bucketName = record.s3.bucket.name;
        const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
        
        this.logger.debug('Processing S3 record', { bucketName, objectKey });
        
        // Create ingestion message
        const message: IngestionMessage = {
          bucketName,
          objectKey,
          timestamp: new Date().toISOString(),
          metadata: {
            eventTime: record.eventTime || new Date().toISOString(),
            eventName: record.eventName || 'ObjectCreated',
            fileSize: record.s3.object.size?.toString() || '0',
          }
        };

        // Send to SQS
        const messageId = await this.sqsService.sendMessage(message);
        messageIds.push(messageId);
        
        this.logger.info(`Successfully queued ingestion task for ${bucketName}/${objectKey}`, { messageId });
      } catch (error) {
        this.logger.error('Error processing S3 record', error);
        throw error;
      }
    }

    return messageIds;
  }
} 