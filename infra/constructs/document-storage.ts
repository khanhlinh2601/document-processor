import { RemovalPolicy } from 'aws-cdk-lib';
import { Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface DocumentStorageProps {
  bucketName?: string;
}

export class DocumentStorage extends Construct {
  public readonly bucket: Bucket;

  constructor(scope: Construct, id: string, props: DocumentStorageProps = {}) {
    super(scope, id);

    // Create an S3 bucket for document storage
    this.bucket = new Bucket(this, 'DocumentBucket', {
      bucketName: props.bucketName,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [
            HttpMethods.GET,
            HttpMethods.PUT,
            HttpMethods.POST,
            HttpMethods.HEAD
          ],
          allowedOrigins: ['*'], // Consider restricting this in production
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });
  }
}