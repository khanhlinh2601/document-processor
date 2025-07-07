import { environment } from './environment';
import { Logger } from '../shared/logger/logger';

const logger = new Logger('DynamoDBConfig');

export const dynamoDBConfig = {
  tableName: process.env.DOCUMENT_METADATA_TABLE_NAME || 'DocumentMetadata',
  region: environment.aws.region,
};

export const getTableName = (): string => {
  if (!process.env.DOCUMENT_METADATA_TABLE_NAME) {
    logger.warn('DOCUMENT_METADATA_TABLE_NAME environment variable is not set. Using default "DocumentMetadata"');
  }
  return dynamoDBConfig.tableName;
}; 