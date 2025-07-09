import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';

export interface ClassificationQueueProps {
  /**
   * Optional queue name
   */
  queueName?: string;
  
  /**
   * Visibility timeout for messages in the queue
   * @default Duration.seconds(30)
   */
  visibilityTimeout?: Duration;
  
  /**
   * How long to retain messages in the queue
   * @default Duration.days(4)
   */
  retentionPeriod?: Duration;
}

/**
 * Construct for a classification queue with a dead letter queue
 * Used to trigger document classification after extraction
 */
export class ClassificationQueue extends Construct {
  public readonly queue: Queue;
  public readonly deadLetterQueue: Queue;

  constructor(scope: Construct, id: string, props: ClassificationQueueProps = {}) {
    super(scope, id);

    // Create a dead letter queue for failed messages
    this.deadLetterQueue = new Queue(this, 'DeadLetterQueue', {
      queueName: props.queueName ? `${props.queueName}-dlq` : undefined,
      encryption: QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(14), // Keep failed messages for 14 days
    });

    // Create the main classification queue
    this.queue = new Queue(this, 'Queue', {
      queueName: props.queueName,
      encryption: QueueEncryption.SQS_MANAGED,
      visibilityTimeout: props.visibilityTimeout || Duration.seconds(30),
      retentionPeriod: props.retentionPeriod || Duration.days(4),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3, // Move to DLQ after 3 failed processing attempts
      },
    });
  }
} 