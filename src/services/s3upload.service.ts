import { S3Client, PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';

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

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bucketName = process.env.S3_BUCKET_NAME || '';
    
    if (!this.bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set');
    }
    
    this.s3Client = new S3Client({ region: this.region });
  }

  async uploadFile(file: UploadedFile): Promise<UploadResult> {
    const timestamp = Date.now();
    const key = `uploads/${timestamp}-${file.originalname}`;
    
    const params: PutObjectCommandInput = {
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };
    
    await this.s3Client.send(new PutObjectCommand(params));
    
    return {
      key,
      url: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`,
      filename: file.originalname,
    };
  }
  
  async uploadFiles(files: UploadedFile[]): Promise<UploadResult[]> {
    const uploadPromises = files.map(file => this.uploadFile(file));
    return Promise.all(uploadPromises);
  }
} 