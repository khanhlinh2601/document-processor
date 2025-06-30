import { S3Service } from '../infrastructure/s3/s3.service';
import { FileEntity } from '../domain/models/file.entity';

export class UploadFileService {
  constructor(private readonly s3Service: S3Service) {}

  async uploadFiles(files: FileEntity[]): Promise<{ key: string; url: string }[]> {
    const results = [];
    for (const file of files) {
      const buffer = Buffer.from(file.base64, 'base64');
      const key = `uploads/${file.fileName}`;
      const url = await this.s3Service.uploadFile(key, buffer, file.contentType);
      results.push({ key, url });
    }
    return results;
  }
} 