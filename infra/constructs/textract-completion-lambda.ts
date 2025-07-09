import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as path from 'path';
import { TextractService } from './textract-service';
import { SnsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export interface TextractCompletionHandlerProps {
  documentBucket: s3.Bucket;
  documentTable: dynamodb.Table;
  textractService: TextractService;
}

export class TextractCompletionHandler extends Construct {
  public readonly completionFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: TextractCompletionHandlerProps) {
    super(scope, id);

    // Create the Textract completion Lambda function
    this.completionFunction = new lambdaNodejs.NodejsFunction(this, 'TextractCompletionHandlerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../src/handlers/textract-completion.handler.ts'),
      handler: 'handler',
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        DOCUMENTS_TABLE: props.documentTable.tableName,
        DOCUMENT_BUCKET: props.documentBucket.bucketName,
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

    // Add SNS event source
    this.completionFunction.addEventSource(new SnsEventSource(props.textractService.TextractCompletionHandlerTopic));

    // Grant permissions
    props.documentBucket.grantReadWrite(this.completionFunction);
    props.documentTable.grantReadWriteData(this.completionFunction);
    
    // Grant permissions to call Textract services for getting results
    this.completionFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'textract:GetDocumentAnalysis',
        'textract:GetDocumentTextDetection'
      ],
      resources: ['*'], // Textract doesn't support resource-level permissions
    }));
  }
} 