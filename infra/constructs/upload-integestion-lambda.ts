import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface UploadIngestionHandlerProps {
  documentBucket: s3.Bucket;
  ingestionQueue: sqs.Queue;
}

export class UploadIngestionHandler extends Construct {
  public readonly ingestionTriggerFunction: lambda.Function;
  public readonly uploadFunction: lambda.Function;
  public readonly presignedUrlFunction: lambda.Function;
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: UploadIngestionHandlerProps) {
    super(scope, id);

    // Create the S3 event handler Lambda
    this.ingestionTriggerFunction = new lambdaNodejs.NodejsFunction(this, 'IngestionTriggerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../src/handlers/ingestion-trigger.handler.ts'),
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
      entry: path.join(__dirname, '../../src/handlers/upload.handler.ts'),
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

    // Create the presigned URL handler Lambda
    this.presignedUrlFunction = new lambdaNodejs.NodejsFunction(this, 'PresignedUrlFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../src/handlers/presigned-url.handler.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
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
    
    // Add explicit S3 permissions for presigned URL generation
    const presignedUrlPolicy = new iam.PolicyStatement({
      actions: [
        's3:PutObject',
        's3:PutObjectAcl',
        's3:GetObject',
        's3:ListBucket'
      ],
      resources: [
        props.documentBucket.bucketArn,
        `${props.documentBucket.bucketArn}/*`
      ],
    });
    
    // Add the policy to the presigned URL function
    this.presignedUrlFunction.addToRolePolicy(presignedUrlPolicy);

    // Grant permissions
    props.documentBucket.grantRead(this.ingestionTriggerFunction);
    props.ingestionQueue.grantSendMessages(this.ingestionTriggerFunction);
    props.documentBucket.grantReadWrite(this.uploadFunction);
    props.documentBucket.grantWrite(this.presignedUrlFunction);

    // Configure S3 event notifications to trigger the Lambda
    props.documentBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED, 
      new s3n.LambdaDestination(this.ingestionTriggerFunction)
    );

    // Create API Gateway for the upload function
    this.api = new apigateway.RestApi(this, 'DocumentAPI', {
      restApiName: 'Document Processing API',
      description: 'API for document processing and uploads',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
        maxAge: cdk.Duration.days(1)
      },
      binaryMediaTypes: ['*/*'], // Support all binary media types
      minimumCompressionSize: 0, // Enable compression for all responses
    });

    // Create API Gateway account settings with higher limits
    new apigateway.CfnAccount(this, 'ApiGatewayAccount', {
      cloudWatchRoleArn: new cdk.aws_iam.Role(this, 'ApiGatewayCloudWatchRole', {
        assumedBy: new cdk.aws_iam.ServicePrincipal('apigateway.amazonaws.com'),
        managedPolicies: [
          cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayPushToCloudWatchLogs')
        ]
      }).roleArn
    });

    // Add upload resource and method
    const uploadResource = this.api.root.addResource('upload');
    uploadResource.addMethod('POST', new apigateway.LambdaIntegration(this.uploadFunction, {
      contentHandling: apigateway.ContentHandling.CONVERT_TO_BINARY, // Handle binary data
    }));

    // Add presigned URL resource and method
    const presignedUrlResource = this.api.root.addResource('presigned-url');
    presignedUrlResource.addMethod('GET', new apigateway.LambdaIntegration(this.presignedUrlFunction));
  }
} 