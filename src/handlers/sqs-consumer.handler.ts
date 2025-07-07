import { SQSEvent, SQSRecord } from '../dtos/sqs-message.dto';
import { DocumentMessage } from '../dtos/document-message.dto';
import { DocumentExtractorService } from '../services/documents/document-extractor.service';

/**
 * SQS Consumer Lambda Handler
 * Processes SQS messages and stores document metadata in DynamoDB
 * @param event The SQS event containing messages
 * @returns Response indicating success or failure
 */
export const handler = async (event: SQSEvent): Promise<{ batchItemFailures: { itemIdentifier: string }[] }> => {
  console.log('Received SQS event:', JSON.stringify(event, null, 2));
  
  const documentExtractorService = new DocumentExtractorService();
  const failedMessageIds: string[] = [];
  
  try {
    // Process records in batches to optimize DynamoDB writes
    const parsedRecords = event.Records.map(parseSQSRecord);
    
    // Group valid messages to process in batch
    const validMessages: DocumentMessage[] = [];
    
    for (const record of parsedRecords) {
      if (record.error) {
        console.error(`Failed to process message ${record.messageId}: ${record.error}`);
        failedMessageIds.push(record.messageId);
        continue;
      }
      
      if (record.body) {
        validMessages.push(record.body);
      }
    }
    
    // Process valid messages in batch if any exist
    if (validMessages.length > 0) {
      console.log(`Processing ${validMessages.length} valid messages in batch`);
      await documentExtractorService.processBatchMessages(validMessages);
      
      // After storing metadata, initiate document processing workflow
      // This demonstrates the state machine workflow in action
      await initiateDocumentProcessing(documentExtractorService, validMessages);
    }
    
  } catch (error) {
    console.error('Error in SQS consumer handler:', error);
    // In case of an unhandled error, mark all messages as failed
    // so they can be retried according to SQS retry policy
    failedMessageIds.push(...event.Records.map(record => record.messageId));
  }
  
  // Return failed message IDs for SQS partial batch processing
  return {
    batchItemFailures: failedMessageIds.map(id => ({ itemIdentifier: id })),
  };
};

/**
 * Parse an SQS record, extracting and validating the message body
 * @param record The SQS record to parse
 * @returns The parsed record with message body or error
 */
function parseSQSRecord(record: SQSRecord): { 
  messageId: string, 
  body?: DocumentMessage, 
  error?: string 
} {
  try {
    const parsedBody: DocumentMessage = JSON.parse(record.body);
    
    // Validate required fields
    if (!parsedBody.bucket || !parsedBody.key) {
      return {
        messageId: record.messageId,
        error: 'Missing required fields in message body',
      };
    }
    
    // If timestamp is missing, use current time
    if (!parsedBody.timestamp) {
      parsedBody.timestamp = new Date().toISOString();
    }
    
    return {
      messageId: record.messageId,
      body: parsedBody,
    };
  } catch (error) {
    return {
      messageId: record.messageId,
      error: `Failed to parse message body: ${(error as Error).message}`,
    };
  }
}

/**
 * Initiate document processing workflow for newly stored documents
 * @param metadataService Metadata service instance
 * @param messages Document messages
 */
async function initiateDocumentProcessing(documentExtractorService: DocumentExtractorService, messages: DocumentMessage[]): Promise<void> {
  try {
    // Process a batch of documents that are in METADATA_STORED state
    // This would typically be done by a separate scheduled Lambda function
    // but we're doing it here to demonstrate the workflow
    const processedIds = await documentExtractorService.processBatch(messages.length);
    
    if (processedIds.length > 0) {
      console.log(`Initiated processing workflow for ${processedIds.length} documents`);
    }
  } catch (error) {
    console.error('Error initiating document processing workflow:', error);
    // We don't fail the SQS processing for workflow errors
    // The documents are already stored in DynamoDB and can be processed later
  }
} 