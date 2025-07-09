import { SQSEvent, SQSRecord, Context } from 'aws-lambda';
import { Logger } from '../shared/logger/logger';
import { DocumentMessage } from '../dtos/document-message.dto';
import { TextractService } from '../services/textract.service';
import { SQSService } from '../services/sqs.service';
import { DocumentProcessorService } from '../services/document-processor.service';
import { DocumentJobRepository } from '../repositories/document-job.repository';
import { ValidationError } from '../shared/errors';
import { textractClient } from '../clients/textract-client';
import { dynamoDBClient } from '../clients/dynamodb-client';
import { environment } from '../configs/environment';

// Initialize services with dependency injection
const initializeServices = (requestId: string) => {
  const logContext = { requestId };
  
  // Create service instances with proper dependency injection
  const textractService = new TextractService(
    textractClient,
    logContext,
    process.env.TEXTRACT_SNS_TOPIC_ARN,
    environment.aws.textract?.roleArn
  );
  
  const jobRepository = new DocumentJobRepository(
    dynamoDBClient,
    environment.aws.dynamodb.tableName,
    logContext
  );
  
  // Configure document processor
  const processorConfig = {
    syncSizeThresholdBytes: 5 * 1024 * 1024, // 5MB
    maxDocumentSizeBytes: 500 * 1024 * 1024 // 500MB
  };
  
  return new DocumentProcessorService(
    textractService,
    jobRepository,
    processorConfig,
    logContext
  );
};

/**
 * Process a single SQS record
 */
export async function processRecord(record: SQSRecord, logger: Logger): Promise<string> {
  const startTime = Date.now();
  
  try {
    // Parse message body
    if (!record.body) {
      throw new ValidationError('Empty message body', [], { record });
    }
    
    logger.debug('Processing SQS record', {
      messageId: record.messageId,
      eventSource: record.eventSource
    });
    
    // Check message type from attributes
    const messageType = record.messageAttributes?.MessageType?.stringValue;
    
    // Parse the message
    let documentMessage: DocumentMessage;
    
    if (messageType === 'DocumentMessage') {
      documentMessage = await DocumentMessage.fromJson(record.body);
    } else {
      // Try to parse as generic JSON
      try {
        const data = JSON.parse(record.body);
        documentMessage = await DocumentMessage.fromObject(data);
      } catch (error) {
        throw new ValidationError(
          'Invalid document message format',
          [],
          { messageId: record.messageId, body: record.body }
        );
      }
    }
    
    // Initialize services with request context
    const documentProcessor = initializeServices(record.messageId);
    
    // Process the document
    const jobId = await documentProcessor.processDocument(documentMessage);
    
    const duration = Date.now() - startTime;
    
    logger.info('Document processing initiated successfully', {
      messageId: record.messageId,
      jobId,
      duration: `${duration}ms`,
      bucket: documentMessage.bucket,
      key: documentMessage.key
    });
    
    return jobId;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Error processing SQS record', error, {
      messageId: record.messageId,
      duration: `${duration}ms`
    });
    
    throw error;
  }
}

/**
 * Lambda handler for SQS events
 */
export async function handler(event: SQSEvent, context: Context): Promise<{ 
  batchItemFailures: { itemIdentifier: string }[] 
}> {
  const logger = new Logger('DocumentProcessorHandler', { 
    requestId: context.awsRequestId 
  });
  
  logger.info('Processing SQS event', { 
    recordCount: event.Records?.length || 0 
  });
  
  // Track success and failures
  const successfulMessageIds: string[] = [];
  const failedMessageIds: string[] = [];
  
  // Process all records
  const processPromises = event.Records.map(async (record) => {
    try {
      await processRecord(record, logger.withContext({ messageId: record.messageId }));
      successfulMessageIds.push(record.messageId);
      return { success: true, messageId: record.messageId };
    } catch (error) {
      failedMessageIds.push(record.messageId);
      return { success: false, messageId: record.messageId, error };
    }
  });
  
  const results = await Promise.allSettled(processPromises);
  
  // Count successful and failed records
  const successful = results.filter(
    r => r.status === 'fulfilled' && r.value.success
  ).length;
  
  const failed = results.filter(
    r => r.status === 'fulfilled' && !r.value.success || r.status === 'rejected'
  ).length;
  
  logger.info('SQS batch processing completed', {
    totalRecords: event.Records.length,
    successful,
    failed,
    successRate: `${(successful / event.Records.length * 100).toFixed(1)}%`
  });
  
  // Return list of failed message IDs for SQS to retry
  return {
    batchItemFailures: failedMessageIds.map(itemIdentifier => ({ itemIdentifier }))
  };
} 