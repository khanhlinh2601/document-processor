import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import * as path from 'path';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export interface ClassificationLambdaProps {
  documentBucket: s3.Bucket;
  classificationQueue: sqs.Queue;
}

export class ClassificationLambda extends Construct {
  public readonly classificationFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: ClassificationLambdaProps) {
    super(scope, id);

    // Create the Classification Lambda function
    this.classificationFunction = new lambdaNodejs.NodejsFunction(this, 'ClassificationFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../src/handlers/classification.handler.ts'),
      handler: 'handler',
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        DOCUMENT_BUCKET: props.documentBucket.bucketName,
        BEDROCK_MODEL_ID: 'anthropic.claude-3-sonnet-20240229-v1:0',
        SQS_CLASSIFICATION_QUEUE_URL: props.classificationQueue.queueUrl
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/*',
          '@nestjs/platform-express',
          '@nestjs/websockets',
          '@nestjs/microservices',
        ]
      },
    });

    // Add SQS event source
    this.classificationFunction.addEventSource(new SqsEventSource(props.classificationQueue, {
      batchSize: 1, // Process one message at a time
      maxBatchingWindow: cdk.Duration.seconds(10),
    }));

    // Grant permissions
    props.documentBucket.grantReadWrite(this.classificationFunction);
    
    // Grant permissions to use Amazon Bedrock
    this.classificationFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: ['*'], // Ideally scope this to specific model ARNs
    }));
  }
} 