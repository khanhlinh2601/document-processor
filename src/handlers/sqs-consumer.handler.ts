import { SQSEvent, SQSRecord, Context } from 'aws-lambda';
import { Logger } from '../utils/logger';
import { IngestionMessage } from '../models/ingestion-message';

// Initialize logger
const logger = new Logger('SQSConsumerHandler');

export const handler = async (event: SQSEvent, context: Context): Promise<void> => {
  logger.info(`Processing ${event.Records.length} messages from SQS`);

  for (const record of event.Records) {
    try {
      await processMessage(record);
    } catch (error) {
      logger.error(`Error processing message ${record.messageId}`, error);
      // Throwing the error will cause the message to be retried
      // After max retries, it will go to the DLQ
      throw error;
    }
  }

  logger.info('Successfully processed all messages');
};

async function processMessage(record: SQSRecord): Promise<void> {
  try {
    const body = JSON.parse(record.body) as IngestionMessage;
    
    logger.info(`Processing document from bucket: ${body.bucketName}, key: ${body.objectKey}`, {
      messageId: record.messageId,
      timestamp: body.timestamp
    });

    // Here you would implement document processing logic
    // For example:
    // 1. Download the file from S3
    // 2. Process the file (extract text, analyze content, etc.)
    // 3. Store results in a database or another S3 bucket

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 200));

    logger.info(`Successfully processed document: ${body.objectKey}`);
  } catch (error) {
    logger.error('Failed to process message', error);
    throw error; // Re-throw to trigger SQS retry
  }
} 