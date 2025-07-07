/**
 * Interface for Textract notification service
 * Responsible for setting up and managing SNS topics and SQS queues for Textract notifications
 */
export interface ITextractNotificationService {
  /**
   * Set up SNS topic and SQS queue for async processing
   * @param jobName Name for the Textract job
   * @returns Object containing topicArn and queueUrl
   */
  setupNotifications(jobName: string): Promise<{ topicArn: string, queueUrl: string }>;
  
  /**
   * Clean up SNS topic and SQS queue
   * @param topicArn SNS topic ARN
   * @param queueUrl SQS queue URL
   */
  cleanupResources(topicArn: string, queueUrl: string): Promise<void>;
  
  /**
   * Get completion notification from SQS queue
   * @param queueUrl SQS queue URL
   * @param expectedJobId Expected JobId to match
   * @param maxWaitTimeSeconds Maximum time to wait for a message
   * @param maxAttempts Maximum number of polling attempts
   * @returns JobId and status, or null if not found
   */
  getCompletionStatus(
    queueUrl: string,
    expectedJobId: string,
    maxWaitTimeSeconds?: number,
    maxAttempts?: number
  ): Promise<{ jobId: string, status: string } | null>;
} 