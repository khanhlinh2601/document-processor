import { DocumentExtractorService } from '../services/documents/document-extractor.service';
import { Logger } from '../shared/logger/logger';

/**
 * Process documents in batch
 * This handler is triggered by a scheduled event to process documents
 * @param event CloudWatch scheduled event
 */
export const handler = async (event: { batchSize?: number }): Promise<{ 
  statusCode: number;
  body: string;
}> => {
  const logger = new Logger('ProcessBatchHandler');
  logger.info('Processing documents batch', { event });
  
  try {
    const documentExtractorService = new DocumentExtractorService();
    
    // Get batch size from event or use default
    const batchSize = event.batchSize || 10;
    
    // Process documents in batch
    const processedIds = await documentExtractorService.processBatch(batchSize);
    
    logger.info(`Successfully processed ${processedIds.length} documents`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully processed ${processedIds.length} documents`,
        processedDocuments: processedIds
      })
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error processing documents batch:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error processing documents batch',
        error: errorMessage
      })
    };
  }
};

/**
 * Retry failed documents
 * This handler is triggered by a scheduled event to retry failed documents
 * @param event CloudWatch scheduled event
 */
export const retryFailedHandler = async (event: { batchSize?: number }): Promise<{
  statusCode: number;
  body: string;
}> => {
  const logger = new Logger('RetryFailedHandler');
  logger.info('Retrying failed documents', { event });
  
  try {
    const documentExtractorService = new DocumentExtractorService();  
    
    // Get batch size from event or use default
    const batchSize = event.batchSize || 10;
    
    // Retry failed documents
    const retriedIds = await documentExtractorService.retryFailedDocuments(batchSize);
    
    logger.info(`Successfully retried ${retriedIds.length} documents`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully retried ${retriedIds.length} documents`,
        retriedDocuments: retriedIds
      })
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error retrying failed documents:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error retrying failed documents',
        error: errorMessage
      })
    };
  }
}; 