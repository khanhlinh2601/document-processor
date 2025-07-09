import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { Logger } from '../shared/logger/logger';
import { UploadedFile } from '../dtos/uploaded-file.model';
import { environment } from '../configs/environment';

export interface S3UploadResult {
  key: string;
  bucket: string;
  url: string;
  contentType: string;
  size: number;
}

export class S3UploadService {
  private s3Client: S3Client;
  private bucketName: string;
  private logger: Logger;

  constructor() {
    this.bucketName = process.env.S3_BUCKET_NAME || environment.aws.s3.bucketName;
    this.s3Client = new S3Client({ region: environment.aws.region });
    this.logger = new Logger('S3UploadService');
  }

  /**
   * Upload files to S3
   * @param files Array of files to upload
   * @returns Array of upload results
   */
  async uploadFiles(files: UploadedFile[]): Promise<S3UploadResult[]> {
    const results: S3UploadResult[] = [];

    for (const file of files) {
      try {
        const key = `${environment.aws.s3.uploadPrefix}${randomUUID()}-${file.originalname}`;
        
        this.logger.debug('Uploading file to S3', { 
          bucket: this.bucketName, 
          key, 
          contentType: file.mimetype, 
          size: file.size 
        });

        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          Metadata: {
            'original-name': encodeURIComponent(file.originalname),
            'content-type': file.mimetype,
            'file-size': file.size.toString(),
          },
        });

        await this.s3Client.send(command);
        
        const url = `https://${this.bucketName}.s3.amazonaws.com/${key}`;
        
        results.push({
          key,
          bucket: this.bucketName,
          url,
          contentType: file.mimetype,
          size: file.size,
        });

        this.logger.info('Successfully uploaded file to S3', { 
          bucket: this.bucketName, 
          key, 
          size: file.size 
        });
      } catch (error) {
        this.logger.error('Error uploading file to S3', error, { 
          filename: file.originalname,
          size: file.size
        });
        throw error;
      }
    }

    return results;
  }
} 