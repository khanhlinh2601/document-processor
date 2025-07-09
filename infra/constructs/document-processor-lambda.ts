import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as path from 'path';
import { TextractService } from './textract-service';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export interface DocumentProcessorProps {
  documentBucket: s3.Bucket;
  processingQueue: sqs.Queue;
  documentTable: dynamodb.Table;
  textractService: TextractService;
}

export class DocumentProcessor extends Construct {
  public readonly processorFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: DocumentProcessorProps) {
    super(scope, id);

    // Create the document processor Lambda function
    this.processorFunction = new lambdaNodejs.NodejsFunction(this, 'DocumentProcessorFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../src/handlers/document-processor.handler.ts'),
      handler: 'handler',
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        DOCUMENTS_TABLE: props.documentTable.tableName,
        DYNAMODB_TABLE: props.documentTable.tableName, // Add this line to match environment.ts config
        DOCUMENT_BUCKET: props.documentBucket.bucketName,
        TEXTRACT_SNS_TOPIC_ARN: props.textractService.TextractCompletionHandlerTopic.topicArn,
        TEXTRACT_ROLE_ARN: props.textractService.textractRole.roleArn,
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

    // Add event source mapping from SQS to Lambda
    this.processorFunction.addEventSource(new SqsEventSource(props.processingQueue, {
      batchSize: 10,
      maxBatchingWindow: cdk.Duration.seconds(30),
      reportBatchItemFailures: true, // Enables partial batch response
    }));

    // Grant permissions
    props.documentBucket.grantReadWrite(this.processorFunction);
    props.documentTable.grantReadWriteData(this.processorFunction);
    
    // Allow Lambda to pass the Textract role
    this.processorFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [props.textractService.textractRole.roleArn],
    }));
    
    // Grant permissions to call Textract services
    this.processorFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'textract:StartDocumentAnalysis',
        'textract:StartDocumentTextDetection',
        'textract:AnalyzeDocument',
        'textract:DetectDocumentText',
        'textract:GetDocumentAnalysis',
        'textract:GetDocumentTextDetection'
      ],
      resources: ['*'], // Textract doesn't support resource-level permissions
    }));
  }
} 