import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DocumentMetadataTable } from '../infra/constructs/document-metadata-table';
import { IngestionQueue } from '../infra/constructs/ingestion-queue';
import { DocumentStorage } from '../infra/constructs/document-storage';
import { DocumentProcessorLambda } from '../infra/constructs/sqs-consumer-lambda';
import { DocumentHandlers } from '../infra/constructs/upload-integestion-lambda';
import { TextractProcessor } from '../infra/constructs/textract-processor';

export class DocumentProcessorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the document storage (S3 bucket)
    const documentStorage = new DocumentStorage(this, 'DocumentStorage');

    // Create the document metadata table (DynamoDB) with a unique name
    const timestamp = new Date().getTime();
    const documentMetadataTable = new DocumentMetadataTable(this, 'DocumentMetadataTable', {
      tableName: `DocumentMetadata-${timestamp}`
    });

    // Create the ingestion queue (SQS)
    const ingestionQueue = new IngestionQueue(this, 'IngestionQueue');

    // Create the Textract processor
    const textractProcessor = new TextractProcessor(this, 'TextractProcessor', {
      documentBucket: documentStorage.bucket,
      metadataTable: documentMetadataTable.table,
      deadLetterQueue: ingestionQueue.deadLetterQueue,
    });

    // Create the document processor Lambda
    const documentProcessor = new DocumentProcessorLambda(this, 'DocumentProcessor', {
      queue: ingestionQueue.queue,
      deadLetterQueue: ingestionQueue.deadLetterQueue,
      metadataTable: documentMetadataTable.table,
      documentBucket: documentStorage.bucket,
    });

    // Create the document handlers (S3 event and upload)
    const documentHandlers = new DocumentHandlers(this, 'DocumentHandlers', {
      documentBucket: documentStorage.bucket,
      ingestionQueue: ingestionQueue.queue,
    });

    // Output the resources
    new cdk.CfnOutput(this, 'BucketName', {
      value: documentStorage.bucket.bucketName,
      description: 'The name of the S3 bucket for document storage',
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: documentMetadataTable.table.tableName,
      description: 'The name of the DynamoDB table for document metadata',
    });

    new cdk.CfnOutput(this, 'QueueUrl', {
      value: ingestionQueue.queue.queueUrl,
      description: 'The URL of the SQS queue for document ingestion',
    });

    new cdk.CfnOutput(this, 'DeadLetterQueueUrl', {
      value: ingestionQueue.deadLetterQueue.queueUrl,
      description: 'The URL of the dead-letter queue for failed messages',
    });

    new cdk.CfnOutput(this, 'LambdaFunction', {
      value: documentProcessor.function.functionName,
      description: 'The name of the Lambda function for document processing',
    });

    new cdk.CfnOutput(this, 'S3EventFunction', {
      value: documentHandlers.s3EventFunction.functionName,
      description: 'The name of the Lambda function for S3 event processing',
    });

    new cdk.CfnOutput(this, 'UploadFunction', {
      value: documentHandlers.uploadFunction.functionName,
      description: 'The name of the Lambda function for document uploads',
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: documentHandlers.api.url,
      description: 'The URL of the API Gateway endpoint for document uploads',
    });
  }
} 