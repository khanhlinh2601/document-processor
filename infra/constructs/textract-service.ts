import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

export interface TextractServiceProps {
  documentBucket: s3.Bucket;
}

export class TextractService extends Construct {
  public readonly textractRole: iam.Role;
  public readonly TextractCompletionHandlerTopic: sns.Topic;
  public readonly TextractCompletionHandlerQueue: sqs.Queue;
  
  constructor(scope: Construct, id: string, props: TextractServiceProps) {
    super(scope, id);

    // Create IAM role for Textract service to use
    this.textractRole = new iam.Role(this, 'TextractServiceRole', {
      assumedBy: new iam.ServicePrincipal('textract.amazonaws.com'),
      description: 'Role for Amazon Textract to access resources',
    });

    // Add permissions to read from S3
    props.documentBucket.grantRead(this.textractRole);

    // Create SNS topic for Textract to publish completion notifications
    this.TextractCompletionHandlerTopic = new sns.Topic(this, 'TextractCompletionHandlerTopic', {
      displayName: 'Textract Job Completion Notifications',
    });

    // Grant Textract permission to publish to the SNS topic
    this.TextractCompletionHandlerTopic.grantPublish(this.textractRole);

    // Create a dead letter queue for failed processing
    const dlq = new sqs.Queue(this, 'TextractCompletionHandlerDLQ', {
      retentionPeriod: cdk.Duration.days(14),
    });

    // Create SQS queue to subscribe to the SNS topic
    this.TextractCompletionHandlerQueue = new sqs.Queue(this, 'TextractCompletionHandlerQueue', {
      visibilityTimeout: cdk.Duration.minutes(5),
      retentionPeriod: cdk.Duration.days(7),
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });

    // Subscribe the SQS queue to the SNS topic
    this.TextractCompletionHandlerTopic.addSubscription(
      new cdk.aws_sns_subscriptions.SqsSubscription(this.TextractCompletionHandlerQueue)
    );
  }

  /**
   * Add a lambda function as a subscriber to Textract completion notifications
   */
  public addCompletionNotificationSubscriber(lambda: lambda.Function): void {
    // Subscribe the Lambda to the SNS topic
    this.TextractCompletionHandlerTopic.addSubscription(
      new sns_subscriptions.LambdaSubscription(lambda)
    );
  }
} 