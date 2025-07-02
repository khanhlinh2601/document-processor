import { v4 as uuidv4 } from 'uuid';
import { DocumentMetadata, DocumentStatus } from '../../data/models/document-metadata.model';
import { DocumentMessage } from '../../data/models/document-message.dto';
import { DynamoDBService } from '../../data/repositories/document-repository';

export class MetadataService {
  private dynamoDBService: DynamoDBService;

  constructor(dynamoDBService = new DynamoDBService()) {
    this.dynamoDBService = dynamoDBService;
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
} 