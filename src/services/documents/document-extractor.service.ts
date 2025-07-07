import { v4 as uuidv4 } from 'uuid';
import { DocumentMetadata, DocumentStatus, LLMProcessingResult } from '../../dtos/document-metadata.dto';
import { DocumentMessage } from '../../dtos/document-message.dto';
import { DynamoDBService } from '../../repositories/document.repository';
import { TextractProcessorService } from './textract.service';

export class DocumentExtractorService {
  private dynamoDBService: DynamoDBService;
  private textractProcessorService: TextractProcessorService;

  constructor(
    dynamoDBService = new DynamoDBService(),
    textractProcessorService = new TextractProcessorService()
  ) {
    this.dynamoDBService = dynamoDBService;
    this.textractProcessorService = textractProcessorService;
  }

  /**
   * Process document message and create document metadata
   * @param message The document message
   * @returns Document metadata object
   */
  processMessageToMetadata(message: DocumentMessage): DocumentMetadata {
    const now = new Date().toISOString();
    const key = message.key;
    
    // Extract file type from the key (file path)
    const fileType = this.extractFileType(key);
    
    // In a real implementation, we might get the file size from S3
    // For now, we'll set it to 0
    const fileSize = 0;

    return {
      documentId: uuidv4(), // Generate a unique ID for the document
      timestamp: message.timestamp,
      bucket: message.bucket,
      key: key,
      fileType,
      fileSize,
      status: DocumentStatus.METADATA_STORED,
      createdAt: now,
      updatedAt: now
    };
  }
  
  /**
   * Save document metadata to DynamoDB
   * @param metadata Document metadata to save
   */
  async saveMetadata(metadata: DocumentMetadata): Promise<void> {
    return this.dynamoDBService.saveMetadata(metadata);
  }
  
  /**
   * Process and save multiple document metadata objects in batch
   * @param messages Array of document messages
   */
  async processBatchMessages(messages: DocumentMessage[]): Promise<void> {
    const metadataList: DocumentMetadata[] = messages.map(
      message => this.processMessageToMetadata(message)
    );
    
    return this.dynamoDBService.batchSaveMetadata(metadataList);
  }
  
  /**
   * Extract file type from file path/key
   * @param key S3 object key (file path)
   * @returns File type/extension
   */
  private extractFileType(key: string): string {
    const parts = key.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : 'unknown';
  }

  /**
   * Process a document through the workflow state machine
   * @param documentId Document ID to process
   * @returns Updated document metadata
   */
  async processDocumentWorkflow(documentId: string): Promise<DocumentMetadata> {
    // Get document metadata
    const metadata = await this.dynamoDBService.getDocumentMetadata(documentId);
    if (!metadata) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Process document based on current status
    let currentStatus = metadata.status as DocumentStatus;
    let currentMetadata = metadata;
    
    // Process the document through its workflow states
    switch (currentStatus) {
      case DocumentStatus.METADATA_STORED:
        currentMetadata = await this.transitionToProcessing(currentMetadata);
        break;
      
      case DocumentStatus.PROCESSING:
        currentMetadata = await this.transitionToProcessed(currentMetadata);
        break;
      
      case DocumentStatus.PROCESSED:
        // Already processed, nothing to do
        
        break;
      
      case DocumentStatus.ERROR:
        // In error state, would need manual intervention or retry logic
        break;
      
      default:
        throw new Error(`Unknown document status: ${currentStatus}`);
    }
    
    return currentMetadata;
  }

  /**
   * Transition document from METADATA_STORED to PROCESSING
   * @param metadata Document metadata
   * @returns Updated document metadata
   */
  private async transitionToProcessing(metadata: DocumentMetadata): Promise<DocumentMetadata> {
    const updatedMetadata: DocumentMetadata = {
      ...metadata,
      status: DocumentStatus.PROCESSING,
      updatedAt: new Date().toISOString()
    };
    
    await this.saveMetadata(updatedMetadata);
    return updatedMetadata;
  }

  /**
   * Transition document from PROCESSING to PROCESSED
   * @param metadata Document metadata
   * @returns Updated document metadata
   */
  private async transitionToProcessed(metadata: DocumentMetadata): Promise<DocumentMetadata> {
    try {

      // Determine which processor to use based on file type
      let llmResults: LLMProcessingResult;
        // Process document with Textract for PDFs and images
        llmResults = await this.textractProcessorService.processDocumentWithTextract(metadata);
      
      
      // Update metadata with processing results
      const updatedMetadata: DocumentMetadata = {
        ...metadata,
        status: DocumentStatus.PROCESSED,
        updatedAt: new Date().toISOString(),
        llmResults
      };
      
      await this.saveMetadata(updatedMetadata);
      return updatedMetadata;
    } catch (error) {
      // If processing fails, transition to ERROR state
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const updatedMetadata: DocumentMetadata = {
        ...metadata,
        status: DocumentStatus.ERROR,
        updatedAt: new Date().toISOString(),
        errorDetails: errorMessage
      };
      
      await this.saveMetadata(updatedMetadata);
      return updatedMetadata;
    }
  }

  /**
   * Process a batch of documents in METADATA_STORED state
   * @param batchSize Maximum number of documents to process
   * @returns List of processed document IDs
   */
  async processBatch(batchSize: number = 10): Promise<string[]> {
    try {
      // Get documents in METADATA_STORED state
      const documents = await this.dynamoDBService.getDocumentsByStatus(
        DocumentStatus.METADATA_STORED, 
        batchSize
      );
      
      const processedIds: string[] = [];
      
      // Process each document
      for (const document of documents) {
        try {
          await this.processDocumentWorkflow(document.documentId);
          processedIds.push(document.documentId);
        } catch (error) {
          console.error(`Failed to process document ${document.documentId}:`, error);
        }
      }
      
      return processedIds;
    } catch (error) {
      throw new Error(`Failed to process batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retry processing for documents in ERROR state
   * @param batchSize Maximum number of documents to retry
   * @returns List of retried document IDs
   */
  async retryFailedDocuments(batchSize: number = 10): Promise<string[]> {
    try {
      // Get documents in ERROR state
      const documents = await this.dynamoDBService.getDocumentsByStatus(
        DocumentStatus.ERROR, 
        batchSize
      );
      
      const retriedIds: string[] = [];
      
      // Retry each document by resetting to METADATA_STORED state
      for (const document of documents) {
        try {
          const updatedMetadata: DocumentMetadata = {
            ...document,
            status: DocumentStatus.METADATA_STORED,
            updatedAt: new Date().toISOString()
          };
          
          await this.saveMetadata(updatedMetadata);
          retriedIds.push(document.documentId);
        } catch (error) {
          console.error(`Failed to retry document ${document.documentId}:`, error);
        }
      }
      
      return retriedIds;
    } catch (error) {
      throw new Error(`Failed to retry documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 