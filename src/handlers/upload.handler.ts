import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../utils/logger';
import { S3UploadService } from '../services/s3upload.service';
import { MultipartParser } from '../utils/multipart-parser';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Parse multipart/form-data
    const files = await MultipartParser.parse(event);
    
    if (files.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'No files were uploaded' }),
      };
    }
    
    // Upload files to S3
    const uploadService = new S3UploadService();
    const uploadResults = await uploadService.uploadFiles(files);
    
    // Return uploaded file URLs
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: `Successfully uploaded ${files.length} file(s)`,
        files: uploadResults 
      }),
    };
  } catch (error) {
    logger.error('Upload failed', error);
    return {
      statusCode: error.message.includes('Content-Type') ? 400 : 500,
      body: JSON.stringify({ message: 'Upload failed', error: error.message }),
    };
  }
}; 