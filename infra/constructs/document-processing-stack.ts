import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

import { TextractService } from './textract-service';
import { DocumentProcessor } from './document-processor-lambda';
import { DocumentJobTable } from './document-job-table';
import { DocumentStorage } from './document-storage';
import { IngestionQueue } from './ingestion-queue';
import { UploadIngestionHandler } from './upload-integestion-lambda';
import { TextractCompletionHandler } from './textract-completion-lambda';
import { ClassificationQueue } from './classification-queue';
import { ClassificationLambda } from './classification-lambda';
import { KnowledgeBase } from './knowledge-base';
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';

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
    
    // Create SQS queue for document classification
    const classificationQueue = new ClassificationQueue(this, 'ClassificationQueue', {
      queueName: `document-classification-${props.stage}`,
      visibilityTimeout: cdk.Duration.seconds(300), // Match Lambda timeout
    });

    // Create IAM role for Bedrock to access resources
    const bedrockKnowledgeBaseRole = new iam.Role(this, 'BedrockKnowledgeBaseRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Role for Bedrock to access resources for knowledge base operations',
    });

    // Grant permissions to access S3 bucket
    documentStorage.bucket.grantRead(bedrockKnowledgeBaseRole, 'formatted/*');

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
      classificationQueue: classificationQueue.queue,
    });
    
    //create knowledge base 
    const knowledgeBase = new KnowledgeBase(this, 'KnowledgeBase', {
      bucket: documentStorage.bucket,
      knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID
    });

    // Create OpenSearch Serverless Collection for vector storage
    const openSearchCollection = new opensearch.CfnCollection(this, 'VectorSearchCollection', {
      name: `docproc-${props.stage}-vector`.toLowerCase(),
      type: 'VECTORSEARCH',
      description: 'OpenSearch Serverless collection for document vector embeddings',
    });

    // Create access policy for the collection
    const openSearchAccessPolicy = new opensearch.CfnAccessPolicy(this, 'VectorSearchAccessPolicy', {
      name: `docproc-${props.stage}-access`.toLowerCase(),
      type: 'data',
      description: 'Access policy for vector search collection',
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: 'collection',
              Resource: [`collection/${openSearchCollection.name}`],
              Permission: [
                'aoss:CreateCollectionItems',
                'aoss:DeleteCollectionItems',
                'aoss:UpdateCollectionItems',
                'aoss:DescribeCollectionItems'
              ]
            }
            // You may omit index rules for now unless you use supported permissions.
          ],
          Principal: [
            bedrockKnowledgeBaseRole.roleArn
          ]
        }
      ])
    });
    

    // Create security policy for the collection
    const openSearchSecurityPolicy = new opensearch.CfnSecurityPolicy(this, 'VectorSearchSecurityPolicy', {
      name: `docproc-${props.stage}-security`.toLowerCase(),
      type: 'encryption',
      description: 'Security policy for vector search collection',
      policy: JSON.stringify({
        Rules: [
          {
            ResourceType: 'collection',
            Resource: [`collection/${openSearchCollection.name}`]
          }
        ],
        AWSOwnedKey: true
      })
    });

    // // Add dependencies to ensure proper creation order

    openSearchCollection.addDependency(openSearchAccessPolicy);
    openSearchCollection.addDependency(openSearchSecurityPolicy);


    // Create document classification handler
    const classificationHandler = new ClassificationLambda(this, 'ClassificationHandler', {
      documentBucket: documentStorage.bucket,
      classificationQueue: classificationQueue.queue,
      knowledgeBaseId: knowledgeBase.knowledgeBaseId,
      openSearchCollectionArn: `arn:aws:aoss:${this.region}:${this.account}:collection/${openSearchCollection.name}`,
      stage: props.stage
    });

    // Export queue URLs
    new cdk.CfnOutput(this, 'IngestionQueueUrl', {
      value: ingestionQueue.queue.queueUrl,
      description: 'Document Ingestion Queue URL',
      exportName: `${props.stage}-ingestion-queue-url`,
    });
    
    new cdk.CfnOutput(this, 'ClassificationQueueUrl', {
      value: classificationQueue.queue.queueUrl,
      description: 'Document Classification Queue URL',
      exportName: `${props.stage}-classification-queue-url`,
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