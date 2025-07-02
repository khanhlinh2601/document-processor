import { S3Event, Context, Handler, Callback } from 'aws-lambda';
import { SQSService } from '../services/sqs.service';
import { IngestionService } from '../services/ingestion.service';
import { environment } from '../config/environment';
import { Logger, LogLevel } from '../utils/logger';

// Initialize logger
const logger = new Logger('S3EventHandler');

// Set log level from environment if available
if (environment.logger?.level) {
  try {
    const levelKey = environment.logger.level.toUpperCase() as keyof typeof LogLevel;
    if (LogLevel[levelKey] !== undefined) {
      Logger.setLogLevel(LogLevel[levelKey]);
    }
  } catch (error) {
    logger.warn(`Invalid log level: ${environment.logger.level}`);
  }
}

export const handler = async (
  event: S3Event, 
  context: Context,
  callback?: Callback
): Promise<{ messageIds: string[] }> => {
  logger.info('S3 event received', { event });
  
  try {
    // Validate SQS queue URL
    if (!environment.aws.sqs.queueUrl) {
      throw new Error('SQS_QUEUE_URL environment variable is not defined');
    }
    
    // Initialize services
    const sqsService = new SQSService(
      environment.aws.sqs.queueUrl,
      environment.aws.region
    );
    const ingestionService = new IngestionService(sqsService);
    
    // Process S3 event and send messages to SQS
    const messageIds = await ingestionService.processS3Event(event);
    
    logger.info(`Successfully processed ${messageIds.length} records`);
    
    const response = { messageIds };
    
    // If a callback is provided, call it with the response
    if (callback) {
      callback(null, response);
    }
    
    return response;
  } catch (error) {
    logger.error('Error in S3 event handler', error);
    if (callback) {
      callback(error as Error);
    }
    throw error;
  }
}; 