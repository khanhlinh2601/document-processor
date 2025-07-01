import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { DocumentStorage } from '../src/infrastructure/s3/s3';

export class DocumentProcessorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create document storage bucket
    const documentStorage = new DocumentStorage(this, 'DocumentStorage');
    const bucket = documentStorage.bucket;

    const envVariables = {
      // Add any global environment variables here if needed
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

    const uploadLambda = new NodejsFunction(this, 'UploadHandler', {
      entry: path.join(__dirname, '../src/handlers/upload.handler.ts'),
      ...functionSettings
    });

    bucket.grantPut(uploadLambda);

    uploadLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: [bucket.bucketArn + '/*'],
    }));

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

    new cdk.CfnOutput(this, 'ApiURL', {
      value: `${api.url}upload`,
    });
  }
} 