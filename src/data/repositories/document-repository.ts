import { 
  PutCommand, 
  BatchWriteCommand,
  PutCommandInput,
  BatchWriteCommandInput
} from '@aws-sdk/lib-dynamodb';
import { DocumentMetadata } from '../models/document-metadata.model';
import { getTableName } from '../../shared/config/dynamodb.config';
import { dynamoDBClient } from '../clients/dynamodb-client';
import { Logger } from '../../shared/logger/logger';

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
} 