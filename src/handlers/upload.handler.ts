import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Logger } from '../utils/logger';
import { S3UploadService } from '../services/s3upload.service';
import { MultipartParser } from '../utils/multipart-parser';

// Initialize logger
const logger = new Logger('UploadHandler');

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Parse multipart/form-data
    const files = await MultipartParser.parse(event);
    
    if (files.length === 0) {
      logger.warn('No files were uploaded');
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'No files were uploaded' }),
      };
    }
    
    logger.info(`Processing ${files.length} file(s) for upload`);
    
    // Upload files to S3
    const uploadService = new S3UploadService();
    const uploadResults = await uploadService.uploadFiles(files);
    
    logger.info(`Successfully uploaded ${files.length} file(s)`);
    
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