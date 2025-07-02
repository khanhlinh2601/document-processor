export const dynamoDBConfig = {
  tableName: process.env.DOCUMENT_METADATA_TABLE_NAME || 'DocumentMetadata',
  region: process.env.AWS_REGION || 'us-east-1',
};

export const getTableName = (): string => {
  if (!process.env.DOCUMENT_METADATA_TABLE_NAME) {
    console.warn('DOCUMENT_METADATA_TABLE_NAME environment variable is not set. Using default "DocumentMetadata"');
  }
  return dynamoDBConfig.tableName;
}; 