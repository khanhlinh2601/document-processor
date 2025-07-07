import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { environment } from "../configs/environment"

/**
 * Creates and configures a DynamoDB client
 * @returns Configured DynamoDB document client
 */
export const createDynamoDBClient = (): DynamoDBDocumentClient => {
  const client = new DynamoDBClient({
    region: environment.aws.region
  });
  
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
    }
  });
};

/**
 * Get the configured DynamoDB document client
 */
export const dynamoDBClient = createDynamoDBClient();