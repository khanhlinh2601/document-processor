import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Logger } from '../shared/logger/logger';
import { environment } from '../configs/environment';
import { randomUUID } from 'crypto';

/**
 * Handler for generating pre-signed URLs for direct S3 uploads
 * This bypasses API Gateway payload size limits by allowing direct uploads to S3
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Create logger with correlation ID from request
  const requestId = event.requestContext?.requestId;
  const logger = new Logger('PresignedUrlHandler', { 
    requestId, 
    path: event.path
  });

  logger.info('Processing presigned URL request', { 
    headers: event.headers,
    queryStringParameters: event.queryStringParameters
  });
  
  try {
    // Get required parameters
    const filename = event.queryStringParameters?.filename;
    const contentType = event.queryStringParameters?.contentType || 'application/octet-stream';
    
    if (!filename) {
      logger.warn('Missing required parameters');
      return {
        statusCode: 400,
        headers: {
          'X-Correlation-ID': logger.getCorrelationId(),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
        },
        body: JSON.stringify({ 
          message: 'Missing required parameters: filename',
          correlationId: logger.getCorrelationId()
        }),
      };
    }
    
    // Generate a unique key for the file
    const bucketName = process.env.S3_BUCKET_NAME || environment.aws.s3.bucketName;
    const key = `${environment.aws.s3.uploadPrefix}${randomUUID()}-${filename}`;
    
    logger.debug('Generating presigned URL', {
      bucket: bucketName,
      key,
      contentType
    });
    
    // Create S3 client
    const s3Client = new S3Client({ region: environment.aws.region });
    
    // Create put object command
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
      Metadata: {
        'original-name': encodeURIComponent(filename),
        'content-type': contentType,
      },
    });
    
    // Generate presigned URL with the proper AWS SDK method
    const expiresIn = 900; // 15 minutes
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
    
    logger.info('Generated presigned URL', {
      bucket: bucketName,
      key
    });
    
    // Return the presigned URL
    return {
      statusCode: 200,
      headers: {
        'X-Correlation-ID': logger.getCorrelationId(),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
      },
      body: JSON.stringify({
        uploadUrl,
        key,
        bucket: bucketName,
        expiresIn,
        correlationId: logger.getCorrelationId()
      }),
    };
  } catch (error) {
    logger.error('Error generating presigned URL', error);
    
    return {
      statusCode: 500,
      headers: {
        'X-Correlation-ID': logger.getCorrelationId(),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
      },
      body: JSON.stringify({ 
        message: 'Error generating presigned URL',
        correlationId: logger.getCorrelationId()
      }),
    };
  }
}; 