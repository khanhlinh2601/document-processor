import {
  CreateTopicCommand,
  SubscribeCommand,
  DeleteTopicCommand
} from '@aws-sdk/client-sns';
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  SetQueueAttributesCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  DeleteQueueCommand
} from '@aws-sdk/client-sqs';
import { Logger, LogContext } from '../../shared/logger/logger';
import { snsClient, sqsClient } from '../../clients/textract-client';
import { ITextractNotificationService } from './textract-notification.interface';

/**
 * Service for managing Textract notifications via SNS and SQS
 */
export class TextractNotificationService implements ITextractNotificationService {
  private logger: Logger;
  
  constructor(logContext?: LogContext) {
    this.logger = new Logger('TextractNotificationService', logContext);
  }

  /**
   * Set up SNS topic and SQS queue for async processing
   * @returns Object containing topicArn and queueUrl
   */
  async setupNotifications(jobName: string): Promise<{ topicArn: string, queueUrl: string }> {
    try {
      // Create SNS topic
      const topicName = `TextractTopic-${jobName}-${Date.now()}`;
      const createTopicResponse = await snsClient.send(
        new CreateTopicCommand({ Name: topicName })
      );
      
      const topicArn = createTopicResponse.TopicArn!;
      this.logger.info(`Created SNS topic: ${topicArn}`);
      
      // Create SQS queue
      const queueName = `TextractQueue-${jobName}-${Date.now()}`;
      const createQueueResponse = await sqsClient.send(
        new CreateQueueCommand({ QueueName: queueName })
      );
      
      const queueUrl = createQueueResponse.QueueUrl!;
      this.logger.info(`Created SQS queue: ${queueUrl}`);
      
      // Get queue ARN
      const queueAttributesResponse = await sqsClient.send(
        new GetQueueAttributesCommand({
          QueueUrl: queueUrl,
          AttributeNames: ['QueueArn']
        })
      );
      
      const queueArn = queueAttributesResponse.Attributes!.QueueArn;
      
      // Subscribe queue to topic
      await snsClient.send(
        new SubscribeCommand({
          TopicArn: topicArn,
          Protocol: 'sqs',
          Endpoint: queueArn
        })
      );
      
      this.logger.info(`Subscribed queue ${queueArn} to topic ${topicArn}`);
      
      // Set queue policy to allow SNS to send messages
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: 'sns.amazonaws.com' },
            Action: 'sqs:SendMessage',
            Resource: queueArn,
            Condition: {
              ArnEquals: {
                'aws:SourceArn': topicArn
              }
            }
          }
        ]
      };
      
      await sqsClient.send(
        new SetQueueAttributesCommand({
          QueueUrl: queueUrl,
          Attributes: {
            Policy: JSON.stringify(policy)
          }
        })
      );
      
      this.logger.info(`Set policy on queue ${queueUrl}`);
      
      return { topicArn, queueUrl };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to set up notifications: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Clean up SNS topic and SQS queue
   * @param topicArn SNS topic ARN
   * @param queueUrl SQS queue URL
   */
  async cleanupResources(topicArn: string, queueUrl: string): Promise<void> {
    try {
      // Delete SNS topic
      await snsClient.send(
        new DeleteTopicCommand({ TopicArn: topicArn })
      );
      this.logger.info(`Deleted SNS topic: ${topicArn}`);
      
      // Delete SQS queue
      await sqsClient.send(
        new DeleteQueueCommand({ QueueUrl: queueUrl })
      );
      this.logger.info(`Deleted SQS queue: ${queueUrl}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to clean up resources: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get completion notification from SQS queue
   * @param queueUrl SQS queue URL
   * @param expectedJobId Expected JobId to match
   * @param maxWaitTimeSeconds Maximum time to wait for a message
   * @param maxAttempts Maximum number of polling attempts
   * @returns JobId and status, or null if not found
   */
  async getCompletionStatus(
    queueUrl: string,
    expectedJobId: string,
    maxWaitTimeSeconds: number = 30,
    maxAttempts: number = 10
  ): Promise<{ jobId: string, status: string } | null> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await sqsClient.send(
          new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 5,
            WaitTimeSeconds: maxWaitTimeSeconds / maxAttempts
          })
        );
        
        if (response.Messages) {
          for (const message of response.Messages) {
            // Parse message body
            const body = JSON.parse(message.Body!);
            // For SNS notifications, the message is nested
            const snsMessage = JSON.parse(body.Message);
            
            const jobId = snsMessage.JobId;
            const status = snsMessage.Status;
            
            // Delete message from queue
            await sqsClient.send(
              new DeleteMessageCommand({
                QueueUrl: queueUrl,
                ReceiptHandle: message.ReceiptHandle!
              })
            );
            
            if (jobId === expectedJobId) {
              this.logger.info(`Found matching job ID ${jobId} with status ${status}`);
              return { jobId, status };
            } else {
              this.logger.info(`Skipping non-matching job ID: ${jobId}`);
            }
          }
        }
        
        this.logger.info(`No matching messages found, attempt ${attempt + 1}/${maxAttempts}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Error polling SQS: ${errorMessage}`);
      }
    }
    
    this.logger.warn(`No matching completion notification found after ${maxAttempts} attempts`);
    return null;
  }
} 