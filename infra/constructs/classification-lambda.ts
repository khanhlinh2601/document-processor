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
  knowledgeBaseId: string;
  openSearchCollectionArn: string;
  stage?: string;
}

export class ClassificationLambda extends Construct {
  public readonly classificationFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: ClassificationLambdaProps) {
    super(scope, id);

    // Create a role for the knowledge base operations
    const bedrockKnowledgeBaseRole = new iam.Role(this, 'BedrockKnowledgeBaseRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Role for Bedrock to access resources for knowledge base operations',
    });

    // Grant permissions to access S3 bucket
    props.documentBucket.grantRead(bedrockKnowledgeBaseRole, 'formatted/*');

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
        SQS_CLASSIFICATION_QUEUE_URL: props.classificationQueue.queueUrl,
        KNOWLEDGE_BASE_ID: props.knowledgeBaseId,
        FORMATTED_PREFIX: 'formatted/',
        KNOWLEDGE_BASE_ROLE_ARN: bedrockKnowledgeBaseRole.roleArn,
        EMBEDDING_MODEL_ARN: 'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1',
        OPENSEARCH_COLLECTION_ARN: props.openSearchCollectionArn,
        DYNAMODB_TABLE: `document-jobs-${props.stage || process.env.STAGE || 'dev'}`
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
    
    // Grant explicit permissions for the formatted/ prefix
    this.classificationFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        's3:PutObject',
        's3:GetObject',
        's3:ListBucket'
      ],
      resources: [
        props.documentBucket.bucketArn,
        `${props.documentBucket.bucketArn}/formatted/*`
      ]
    }));
    
    // Grant permissions to use Amazon Bedrock
    this.classificationFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: ['*'], // Ideally scope this to specific model ARNs
    }));
    
    // Grant DynamoDB permissions for document jobs table
    this.classificationFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:Query',
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem'
      ],
      resources: [
        `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/document-jobs-*`,
        `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/document-jobs-*/index/*`
      ]
    }));
    
    // Grant comprehensive permissions for Bedrock knowledge base access
    this.classificationFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'bedrock:RetrieveAndGenerate',
        'bedrock-agent-runtime:RetrieveAndGenerate',
        'bedrock:Retrieve',
        'bedrock:GetKnowledgeBase',
        'bedrock:ListKnowledgeBases',
        'bedrock-agent:RetrieveAndGenerate',
        'bedrock:CreateKnowledgeBase',
        'bedrock:DeleteKnowledgeBase',
        'bedrock:UpdateKnowledgeBase',
        'iam:PassRole'
      ],
      resources: ['*']
    }));
    
    // Add specific permissions for the knowledge base if ID is provided
    if (props.knowledgeBaseId) {
      const region = cdk.Stack.of(this).region;
      const account = cdk.Stack.of(this).account;
      
      this.classificationFunction.addToRolePolicy(new iam.PolicyStatement({
        actions: [
          'bedrock:RetrieveAndGenerate',
          'bedrock-agent-runtime:RetrieveAndGenerate',
          'bedrock:Retrieve',
          'bedrock:GetKnowledgeBase'
        ],
        resources: [
          `arn:aws:bedrock:${region}:${account}:knowledge-base/${props.knowledgeBaseId}`
        ]
      }));
    }
    
    // Allow the Lambda to pass the knowledge base role to Bedrock
    this.classificationFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [bedrockKnowledgeBaseRole.roleArn]
    }));
  }
} 