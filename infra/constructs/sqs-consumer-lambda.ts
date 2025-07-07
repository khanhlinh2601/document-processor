import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import * as path from 'path';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';

export interface DocumentProcessorLambdaProps {
  queue: sqs.Queue;
  deadLetterQueue: sqs.Queue;
  metadataTable: dynamodb.Table;
  documentBucket: s3.Bucket;
}

export class DocumentProcessorLambda extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: DocumentProcessorLambdaProps) {
    super(scope, id);

    // Create the Lambda function using NodejsFunction for bundling
    this.function = new lambdaNodejs.NodejsFunction(this, 'SQSConsumerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../src/handlers/sqs-consumer.handler.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        DOCUMENT_METADATA_TABLE_NAME: props.metadataTable.tableName,
        DOCUMENT_BUCKET_NAME: props.documentBucket.bucketName,
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/*',
          '@nestjs/platform-express',
          '@nestjs/websockets',
          '@nestjs/microservices',
          'kafkajs',
          '@grpc/grpc-js',
          '@grpc/proto-loader'
        ]
      },
    });

    // Grant the Lambda function permissions to read from SQS
    props.queue.grantConsumeMessages(this.function);
    props.deadLetterQueue.grantSendMessages(this.function);

    // Grant the Lambda function permissions to write to DynamoDB
    props.metadataTable.grantReadWriteData(this.function);

    // Grant the Lambda function permissions to access the S3 bucket
    props.documentBucket.grantRead(this.function);

    // Create event source mapping to trigger Lambda from SQS
    new lambda.EventSourceMapping(this, 'SQSEventSource', {
      target: this.function,
      eventSourceArn: props.queue.queueArn,
      batchSize: 10,
      maxBatchingWindow: cdk.Duration.seconds(5),
    });
  }
} 