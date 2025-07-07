import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Logger } from '../shared/logger/logger';
import { MultipartParser } from '../shared/utils/multipart-parser';
import { S3UploadService } from '../repositories/storage.repository';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Create logger with correlation ID from request
  const requestId = event.requestContext?.requestId;
  const logger = new Logger('UploadHandler', { 
    requestId, 
    path: event.path
  });

  logger.info('Processing upload request', { 
    headers: event.headers,
    queryStringParameters: event.queryStringParameters
  });
  
  try {
    // Parse multipart/form-data
    const files = await MultipartParser.parse(event);
    
    if (files.length === 0) {
      logger.warn('No files were uploaded');
      return {
        statusCode: 400,
        headers: {
          'X-Correlation-ID': logger.getCorrelationId(),
        },
        body: JSON.stringify({ 
          message: 'No files were uploaded',
          correlationId: logger.getCorrelationId()
        }),
      };
    }
    
    logger.info(`Processing ${files.length} file(s) for upload`, { fileCount: files.length });
    
    // Upload files to S3
    const uploadService = new S3UploadService();
    const uploadResults = await uploadService.uploadFiles(files);
    
    logger.info(`Successfully uploaded ${files.length} file(s)`, { results: uploadResults });
    
    // Return uploaded file URLs with correlation ID
    return {
      statusCode: 200,
      headers: {
        'X-Correlation-ID': logger.getCorrelationId(),
      },
      body: JSON.stringify({ 
        message: `Successfully uploaded ${files.length} file(s)`,
        files: uploadResults,
        correlationId: logger.getCorrelationId()
      }),
    };
  } catch (error) {
    logger.error('Upload failed', error, {
      errorType: error.name,
      errorMessage: error.message
    });
    
    return {
      statusCode: error.message?.includes('Content-Type') ? 400 : 500,
      headers: {
        'X-Correlation-ID': logger.getCorrelationId(),
      },
      body: JSON.stringify({ 
        message: 'Upload failed', 
        error: error.message,
        correlationId: logger.getCorrelationId()
      }),
    };
  }
}; 