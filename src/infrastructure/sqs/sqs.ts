import { Duration } from 'aws-cdk-lib';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface IngestionQueueProps {
  queueName?: string;
  visibilityTimeout?: Duration;
  retentionPeriod?: Duration;
}

export class IngestionQueue extends Construct {
  public readonly queue: Queue;
  public readonly deadLetterQueue: Queue;

  constructor(scope: Construct, id: string, props: IngestionQueueProps = {}) {
    super(scope, id);

    // Create a dead letter queue for failed messages
    this.deadLetterQueue = new Queue(this, 'DeadLetterQueue', {
      queueName: props.queueName ? `${props.queueName}-dlq` : undefined,
      encryption: QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(14), // Keep failed messages for 14 days
    });

    // Create the main ingestion queue
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