import { S3Client, PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
import { Logger } from '../utils/logger';

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
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;
  private logger: Logger;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bucketName = process.env.S3_BUCKET_NAME || '';
    this.logger = new Logger('S3UploadService');
    
    if (!this.bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set');
    }
    
    this.s3Client = new S3Client({ region: this.region });
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
    
    await this.s3Client.send(new PutObjectCommand(params));
    
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