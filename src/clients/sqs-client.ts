import { SQSClient } from '@aws-sdk/client-sqs';
import { environment } from '../configs/environment'; 

/**
 * Creates and configures an SQS client
 * @returns Configured SQS client
 */
export const createSQSClient = (): SQSClient => {
  return new SQSClient({
    region: environment.aws.region
  });
};

/**
 * Get the configured SQS client
 */
export const sqsClient = createSQSClient(); 