import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { awsConfig } from '../../config/aws.config';
import { Readable } from 'stream';

export class S3Service {
  private s3: S3Client;
  private bucket: string;

  constructor() {
    this.s3 = new S3Client({ region: awsConfig.region });
    this.bucket = awsConfig.s3Bucket;
  }

  async uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    await this.s3.send(command);
    return `https://s3.amazonaws.com/${this.bucket}/${key}`;
  }

  async readFile(key) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    const response = await this.s3.send(command);
    return response.Body as Readable;
  }
} 