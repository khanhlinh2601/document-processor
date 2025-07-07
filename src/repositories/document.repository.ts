import { 
  PutCommand, 
  BatchWriteCommand,
  PutCommandInput,
  BatchWriteCommandInput,
  GetCommand,
  GetCommandInput,
  ScanCommand,
  ScanCommandInput
} from '@aws-sdk/lib-dynamodb';
import { DocumentMetadata, DocumentStatus } from '../dtos/document-metadata.dto';
import { getTableName } from '../configs/dynamodb.config';
import { dynamoDBClient } from '../clients/dynamodb-client';
import { Logger } from '../shared/logger/logger';

export class DynamoDBService {
  private tableName: string;
  private logger: Logger;

  constructor() {
    this.tableName = getTableName();
    this.logger = new Logger('DynamoDBService');
  }

  /**
   * Save a single document metadata item to DynamoDB
   * @param metadata Document metadata to store
   * @returns Promise that resolves with the result
   */
  async saveMetadata(metadata: DocumentMetadata): Promise<void> {
    const params: PutCommandInput = {
      TableName: this.tableName,
      Item: {
        ...metadata,
        updatedAt: new Date().toISOString(),
      },
    };

    try {
      await dynamoDBClient.send(new PutCommand(params));
      this.logger.debug('Saved metadata to DynamoDB', { documentId: metadata.documentId });
    } catch (error) {
      this.logger.error('Error saving metadata to DynamoDB:', error);
      throw error;
    }
  }

  /**
   * Save multiple document metadata items in a batch to DynamoDB
   * @param metadataList Array of document metadata to store
   * @returns Promise that resolves with the result
   */
  async batchSaveMetadata(metadataList: DocumentMetadata[]): Promise<void> {
    if (metadataList.length === 0) {
      return;
    }

    // DynamoDB batch write has a limit of 25 items per request
    const batchSize = 25;
    const now = new Date().toISOString();
    
    for (let i = 0; i < metadataList.length; i += batchSize) {
      const batch = metadataList.slice(i, i + batchSize);
      
      const params: BatchWriteCommandInput = {
        RequestItems: {
          [this.tableName]: batch.map(item => ({
            PutRequest: {
              Item: {
                ...item,
                updatedAt: now,
              },
            },
          })),
        },
      };

      try {
        await dynamoDBClient.send(new BatchWriteCommand(params));
        this.logger.debug(`Batch saved ${batch.length} items to DynamoDB`, { batchNumber: i / batchSize + 1 });
      } catch (error) {
        this.logger.error(`Error batch saving metadata to DynamoDB (batch ${i / batchSize + 1}):`, error);
        throw error;
      }
    }
  }

  /**
   * Get document metadata by ID
   * @param documentId Document ID to retrieve
   * @returns Document metadata or null if not found
   */
  async getDocumentMetadata(documentId: string): Promise<DocumentMetadata | null> {
    const params: GetCommandInput = {
      TableName: this.tableName,
      Key: {
        documentId
      }
    };

    try {
      const response = await dynamoDBClient.send(new GetCommand(params));
      return response.Item as DocumentMetadata || null;
    } catch (error) {
      this.logger.error(`Error retrieving document metadata for ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Get documents by status
   * @param status Status to filter by
   * @param limit Maximum number of documents to retrieve
   * @returns Array of document metadata
   */
  async getDocumentsByStatus(status: DocumentStatus, limit: number = 10): Promise<DocumentMetadata[]> {
    // Note: In a real implementation, you would use a GSI (Global Secondary Index)
    // for status-based queries. This implementation uses a scan with a filter for simplicity.
    const params: ScanCommandInput = {
      TableName: this.tableName,
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': status
      },
      Limit: limit
    };

    try {
      const response = await dynamoDBClient.send(new ScanCommand(params));
      return (response.Items || []) as DocumentMetadata[];
    } catch (error) {
      this.logger.error(`Error retrieving documents with status ${status}:`, error);
      throw error;
    }
  }
} 