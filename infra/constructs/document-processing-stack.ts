import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { TextractService } from './textract-service';
import { DocumentProcessor } from './document-processor-lambda';
import { DocumentJobTable } from './document-job-table';
import { DocumentStorage } from './document-storage';
import { IngestionQueue } from './ingestion-queue';
import { UploadIngestionHandler } from './upload-integestion-lambda';
import { TextractCompletionHandler } from './textract-completion-lambda';

export interface DocumentProcessingStackProps extends cdk.StackProps {
  stage: string;
}

export class DocumentProcessingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DocumentProcessingStackProps) {
    super(scope, id, props);

    // Create S3 bucket for document storage
    const documentStorage = new DocumentStorage(this, 'DocumentStorage', {
      bucketName: `document-processing-${props.stage}-${this.account}`,
    });

    // Create DynamoDB table for document metadata
    const documentTable = new DocumentJobTable(this, 'DocumentJobTable', {
      tableName: `document-jobs-${props.stage}`,
    });

    // Create SQS queue for document ingestion
    const ingestionQueue = new IngestionQueue(this, 'IngestionQueue', {
      queueName: `document-ingestion-${props.stage}`,
      visibilityTimeout: cdk.Duration.seconds(300), // Match Lambda timeout
    });

    // Create Textract service construct
    const textractService = new TextractService(this, 'TextractService', {
      documentBucket: documentStorage.bucket,
    });

    // Create document upload and ingestion handlers
    const uploadIngestionHandler = new UploadIngestionHandler(this, 'UploadIngestionHandler', {
      documentBucket: documentStorage.bucket,
      ingestionQueue: ingestionQueue.queue,
    });

    // Create document processor Lambda
    const documentProcessor = new DocumentProcessor(this, 'DocumentProcessor', {
      documentBucket: documentStorage.bucket,
      processingQueue: ingestionQueue.queue,
      documentTable: documentTable.table,
      textractService: textractService,
    });

    // Create Textract completion handler
    const textractCompletionHandler = new TextractCompletionHandler(this, 'TextractCompletionHandler', {
      documentBucket: documentStorage.bucket,
      documentTable: documentTable.table,
      textractService: textractService,
    });

    // Output the API endpoint
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: uploadIngestionHandler.api.url,
      description: 'Document Upload API Endpoint',
    });

    // Output the S3 bucket name
    new cdk.CfnOutput(this, 'DocumentBucket', {
      value: documentStorage.bucket.bucketName,
      description: 'Document Storage Bucket Name',
    });
  }
} 