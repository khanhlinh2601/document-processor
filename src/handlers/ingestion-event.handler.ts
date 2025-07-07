import { S3Event, Context, Handler, Callback } from 'aws-lambda';
import { Logger } from '../shared/logger/logger';
import { errorHandler, StorageError, QueueError } from '../shared/errors';
import { SQSService } from '../services/queue/sqs.service';
import { IngestionService } from '../services/documents/ingestion.service';

export const handler = async (
  event: S3Event, 
  context: Context,
  callback?: Callback
): Promise<{ messageIds: string[] }> => {
  // Create logger with request context
  const logger = new Logger('S3EventHandler', { 
    requestId: context.awsRequestId,
    functionName: context.functionName
  });

  // Get correlation ID from request or generate new one
  const correlationId = context.awsRequestId;
  
  try {
    logger.info('S3 event received', { 
      recordCount: event.Records?.length || 0,
      remainingTime: context.getRemainingTimeInMillis()
    });
    
    // Get queue URL from environment
    const queueUrl = process.env.SQS_QUEUE_URL;
    
    if (!queueUrl) {
      throw new QueueError('SQS_QUEUE_URL environment variable is not defined', {
        availableEnvVars: Object.keys(process.env)
      });
    }
    
    // Check if event has records
    if (!event.Records || event.Records.length === 0) {
      throw new StorageError('No records found in S3 event', { event });
    }
    
    // Create log context for services
    const logContext = { 
      requestId: context.awsRequestId,
      correlationId
    };
    
    // Create services directly instead of using ServiceProvider
    // This avoids NestJS dependency injection issues in Lambda environment
    logger.debug('Creating SQS service', { queueUrl });
    const messageQueueService = new SQSService(queueUrl, logContext);
    
    logger.debug('Creating ingestion service');
    const ingestionService = new IngestionService(messageQueueService, logContext);
    
    // Process S3 event and send messages to queue
    const messageIds = await ingestionService.processS3Event(event);
    
    logger.info(`Successfully processed records`, {
      totalRecords: event.Records.length,
      processedCount: messageIds.length
    });
    
    const response = { 
      messageIds,
      correlationId
    };
    
    // If a callback is provided, call it with the response
    if (callback) {
      callback(null, response);
    }
    
    return response;
  } catch (error) {
    // Use error handler to process the error
    const errorResponse = errorHandler.handleError(error, correlationId);
    
    logger.error('Handler execution failed', {
      errorName: errorResponse.error,
      errorMessage: errorResponse.message,
      statusCode: errorResponse.statusCode,
    });
    
    // Return error response
    const response = { 
      error: errorResponse.error,
      message: errorResponse.message,
      correlationId
    };
    
    if (callback) {
      callback(error instanceof Error ? error : new Error(String(error)));
    }
    
    throw error;
  }
}; 