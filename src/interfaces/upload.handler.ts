import { UploadRequestDto } from '../shared/dtos/upload-request.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FileEntity } from '../domain/models/file.entity';
import { S3Service } from '../infrastructure/s3/s3.service';
import { UploadFileService } from '../application/upload-file.service';

export const handler = async (event: any) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const dto = plainToInstance(UploadRequestDto, body);
    const errors = await validate(dto);
    if (errors.length) {
      return { statusCode: 400, body: JSON.stringify({ success: false, errors }) };
    }
    const files = dto.files.map(f => new FileEntity(f.fileName, f.contentType, f.base64));
    const s3Service = new S3Service();
    const uploadService = new UploadFileService(s3Service);
    const uploadedFiles = await uploadService.uploadFiles(files);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, uploadedFiles }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: err.message }),
    };
  }
}; 