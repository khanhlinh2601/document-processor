import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface TextractProcessorProps {
  documentBucket: s3.Bucket;
  metadataTable: dynamodb.Table;
  deadLetterQueue: sqs.Queue;
}

export class TextractProcessor extends Construct {
  public readonly processingQueue: sqs.Queue;
  public readonly resultsTopic: sns.Topic;
  public readonly textractRole: iam.Role;

  constructor(scope: Construct, id: string, props: TextractProcessorProps) {
    super(scope, id);

    // Create a queue for Textract processing tasks
    this.processingQueue = new sqs.Queue(this, 'TextractProcessingQueue', {
      visibilityTimeout: cdk.Duration.seconds(300),
      deadLetterQueue: {
        queue: props.deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // Create an SNS topic for Textract results
    this.resultsTopic = new sns.Topic(this, 'TextractResultsTopic', {
      displayName: 'Textract Processing Results',
    });

    // Create IAM role for Textract service
    this.textractRole = new iam.Role(this, 'TextractServiceRole', {
      assumedBy: new iam.ServicePrincipal('textract.amazonaws.com'),
      description: 'Role assumed by AWS Textract service',
    });

    // Add permissions for Textract to access S3
    props.documentBucket.grantRead(this.textractRole);
    
    // Allow Textract to publish to SNS topic
    this.resultsTopic.grantPublish(this.textractRole);

    // Add permissions for the queue to receive messages from Textract
    this.processingQueue.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('textract.amazonaws.com')],
        actions: ['sqs:SendMessage'],
        resources: [this.processingQueue.queueArn],
      })
    );

    // Add permissions for the metadata table to be updated with Textract results
    props.metadataTable.grantReadWriteData(this.textractRole);

    // Add Textract permissions to the role
    this.textractRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'textract:DetectDocumentText',
          'textract:AnalyzeDocument',
          'textract:StartDocumentTextDetection',
          'textract:GetDocumentTextDetection',
          'textract:StartDocumentAnalysis',
          'textract:GetDocumentAnalysis'
        ],
        resources: ['*'],
      })
    );
  }
} 