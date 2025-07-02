import { PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
import { Logger } from '../../shared/logger/logger';
import { s3Client } from '../clients/s3-client';
import { environment } from '../../shared/config/environment';

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface UploadResult {
  key: string;
  url: string;
  filename: string;
}

export class S3UploadService {
  private bucketName: string;
  private region: string;
  private logger: Logger;

  constructor() {
    this.region = environment.aws.region;
    this.bucketName = process.env.S3_BUCKET_NAME || '';
    this.logger = new Logger('S3UploadService');
    
    if (!this.bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set');
    }
  }

  async uploadFile(file: UploadedFile): Promise<UploadResult> {
    const timestamp = Date.now();
    const key = `uploads/${timestamp}-${file.originalname}`;
    
    this.logger.debug(`Uploading file: ${file.originalname}`, { 
      size: file.size, 
      mimetype: file.mimetype 
    });
    
    const params: PutObjectCommandInput = {
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };
    
    await s3Client.send(new PutObjectCommand(params));
    
    this.logger.info(`Successfully uploaded file: ${file.originalname}`, { key });
    
    return {
      key,
      url: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`,
      filename: file.originalname,
    };
  }
  
  async uploadFiles(files: UploadedFile[]): Promise<UploadResult[]> {
    this.logger.info(`Uploading ${files.length} file(s)`);
    const uploadPromises = files.map(file => this.uploadFile(file));
    return Promise.all(uploadPromises);
  }
} 