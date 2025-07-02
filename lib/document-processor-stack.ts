import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as path from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { DocumentStorage } from '../src/infrastructure/s3/s3';
import { IngestionQueue } from '../src/infrastructure/sqs/sqs';
import { LogLevel } from '../src/utils/logger';

export class DocumentProcessorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create document storage bucket
    const documentStorage = new DocumentStorage(this, 'DocumentStorage');
    const bucket = documentStorage.bucket;

    // Create SQS queue for document ingestion
    const ingestionQueue = new IngestionQueue(this, 'IngestionQueue', {
      queueName: 'document-ingestion-queue',
      visibilityTimeout: cdk.Duration.seconds(60),
    });

    const envVariables = {
      LOG_LEVEL: LogLevel[LogLevel.INFO],
    };

    const esBuildSettings = {
      minify: true
    };

    const functionSettings = {
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        S3_BUCKET_NAME: bucket.bucketName,
        ...envVariables
      },
      bundling: esBuildSettings
    };

    // Create upload Lambda function
    const uploadLambda = new NodejsFunction(this, 'UploadHandler', {
      entry: path.join(__dirname, '../src/handlers/upload.handler.ts'),
      ...functionSettings
    });

    // Create S3 event Lambda function
    const s3EventLambda = new NodejsFunction(this, 'S3EventHandler', {
      entry: path.join(__dirname, '../src/handlers/s3-event.handler.ts'),
      ...functionSettings,
      environment: {
        ...functionSettings.environment,
        SQS_QUEUE_URL: ingestionQueue.queue.queueUrl,
      }
    });

    // Create SQS consumer Lambda function
    const sqsConsumerLambda = new NodejsFunction(this, 'SQSConsumerHandler', {
      entry: path.join(__dirname, '../src/handlers/sqs-consumer.handler.ts'),
      ...functionSettings,
      timeout: cdk.Duration.seconds(60), // Longer timeout for processing
    });

    // Add SQS as an event source for the consumer Lambda
    sqsConsumerLambda.addEventSource(
      new SqsEventSource(ingestionQueue.queue, {
        batchSize: 10, // Process up to 10 messages at once
        maxBatchingWindow: cdk.Duration.seconds(5), // Wait up to 5 seconds to gather messages
      })
    );

    // Grant permissions
    bucket.grantPut(uploadLambda);
    bucket.grantRead(s3EventLambda);
    bucket.grantRead(sqsConsumerLambda); // Consumer needs to read files from S3
    ingestionQueue.queue.grantSendMessages(s3EventLambda);
    ingestionQueue.queue.grantConsumeMessages(sqsConsumerLambda);

    uploadLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: [bucket.bucketArn + '/*'],
    }));

    s3EventLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [bucket.bucketArn + '/*'],
    }));

    sqsConsumerLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [bucket.bucketArn + '/*'],
    }));

    // Add S3 event notification to trigger Lambda
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(s3EventLambda)
    );

    // Create API Gateway with binary media types support for multipart/form-data
    const api = new apigateway.RestApi(this, 'ApiGateway', {
      restApiName: 'DocumentProcessorApi',
      binaryMediaTypes: ['multipart/form-data'],
      defaultMethodOptions: {
        apiKeyRequired: false
      }
    });

    const uploadIntegration = new apigateway.LambdaIntegration(uploadLambda, {
      contentHandling: apigateway.ContentHandling.CONVERT_TO_BINARY,
    });

    const upload = api.root.addResource('upload');
    upload.addMethod('POST', uploadIntegration, {
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
        {
          statusCode: '400',
          responseModels: {
            'application/json': apigateway.Model.ERROR_MODEL,
          },
        },
        {
          statusCode: '500',
          responseModels: {
            'application/json': apigateway.Model.ERROR_MODEL,
          },
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiURL', {
      value: `${api.url}upload`,
      description: 'URL for uploading documents via API Gateway',
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'S3 bucket for document storage',
    });

    new cdk.CfnOutput(this, 'QueueUrl', {
      value: ingestionQueue.queue.queueUrl,
      description: 'SQS queue URL for document ingestion',
    });

    new cdk.CfnOutput(this, 'DeadLetterQueueUrl', {
      value: ingestionQueue.deadLetterQueue.queueUrl,
      description: 'Dead letter queue URL for failed messages',
    });
  }
} 