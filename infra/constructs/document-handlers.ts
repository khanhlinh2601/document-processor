import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';
import * as path from 'path';

export interface DocumentHandlersProps {
  documentBucket: s3.Bucket;
  ingestionQueue: sqs.Queue;
}

export class DocumentHandlers extends Construct {
  public readonly s3EventFunction: lambda.Function;
  public readonly uploadFunction: lambda.Function;
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: DocumentHandlersProps) {
    super(scope, id);

    // Create the S3 event handler Lambda
    this.s3EventFunction = new lambdaNodejs.NodejsFunction(this, 'S3EventFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../src/handlers/documents/s3-event.handler.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        SQS_QUEUE_URL: props.ingestionQueue.queueUrl,
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

    // Create the upload handler Lambda
    this.uploadFunction = new lambdaNodejs.NodejsFunction(this, 'UploadFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../src/handlers/documents/upload.handler.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        S3_BUCKET_NAME: props.documentBucket.bucketName,
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

    // Grant permissions
    props.documentBucket.grantRead(this.s3EventFunction);
    props.ingestionQueue.grantSendMessages(this.s3EventFunction);
    props.documentBucket.grantReadWrite(this.uploadFunction);

    // Configure S3 event notifications to trigger the Lambda
    props.documentBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED, 
      new s3n.LambdaDestination(this.s3EventFunction)
    );

    // Create API Gateway for the upload function
    this.api = new apigateway.RestApi(this, 'DocumentAPI', {
      restApiName: 'Document Processing API',
      description: 'API for document processing and uploads',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Add upload resource and method
    const uploadResource = this.api.root.addResource('upload');
    uploadResource.addMethod('POST', new apigateway.LambdaIntegration(this.uploadFunction));
  }
} 