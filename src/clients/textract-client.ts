import { TextractClient } from '@aws-sdk/client-textract';
import { SNSClient } from '@aws-sdk/client-sns';
import { SQSClient } from '@aws-sdk/client-sqs';
import { environment } from '../configs/environment';

/**
 * Creates and configures a Textract client
 * @returns Configured Textract client
 */
export const createTextractClient = (): TextractClient => {
  return new TextractClient({
    region: environment.aws.region
  });
};

/**
 * Creates and configures an SNS client for Textract notifications
 * @returns Configured SNS client
 */
export const createSNSClient = (): SNSClient => {
  return new SNSClient({
    region: environment.aws.region
  });
};

/**
 * Creates and configures an SQS client for Textract notifications
 * @returns Configured SQS client
 */
export const createSQSClient = (): SQSClient => {
  return new SQSClient({
    region: environment.aws.region
  });
};

// Export singleton instances
export const textractClient = createTextractClient();
export const snsClient = createSNSClient();
export const sqsClient = createSQSClient(); 