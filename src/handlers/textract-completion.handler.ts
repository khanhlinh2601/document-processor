import { SNSEvent, Context } from 'aws-lambda';
import { GetDocumentAnalysisCommand, GetDocumentTextDetectionCommand } from '@aws-sdk/client-textract';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { Logger } from '../shared/logger/logger';
import { DocumentProcessingStatus, TextractError } from '../services/textract.service';
import { DocumentJobRepository } from '../repositories/document-job.repository';
import { textractClient } from '../clients/textract-client';
import { s3Client } from '../clients/s3-client';
import { dynamoDBClient } from '../clients/dynamodb-client';
import { environment } from '../configs/environment';
import { StorageError } from '../shared/errors';
/**
 * Lambda handler for Textract job completion notifications via SNS
 */
export async function handler(event: SNSEvent, context: Context): Promise<void> {
  const logger = new Logger('TextractCompletionHandlerHandler', { 
    requestId: context.awsRequestId 
  });
  
  logger.info('Processing SNS event', { 
    recordCount: event.Records?.length || 0 
  });
  
  if (!event.Records || event.Records.length === 0) {
    logger.warn('No records found in SNS event');
    return;
  }
  
  // Process each SNS notification
  for (const record of event.Records) {
    try {
      await processTextractCompletionHandler(record, logger);
    } catch (error) {
      logger.error('Error processing Textract completion notification', error, {
        messageId: record.Sns.MessageId
      });
      // Continue processing other records
    }
  }
  
  logger.info('SNS event processing completed');
}

/**
 * Process a single Textract completion notification
 */
async function processTextractCompletionHandler(record: SNSEvent['Records'][0], logger: Logger): Promise<void> {
  const startTime = Date.now();
  const logContext = { messageId: record.Sns.MessageId };
  const recordLogger = logger.withContext(logContext);
  
  try {
    recordLogger.debug('Processing SNS record', { 
      messageId: record.Sns.MessageId,
      timestamp: record.Sns.Timestamp
    });
    
    // Parse the SNS message
    const message = JSON.parse(record.Sns.Message);
    
    // Extract the Textract JobId
    const jobId = message.JobId;
    if (!jobId) {
      throw new TextractError('No JobId found in Textract notification', { message });
    }
    
    recordLogger.info('Received Textract job completion notification', { 
      jobId, 
      status: message.Status 
    });
    
    // Initialize repository
    const jobRepository = new DocumentJobRepository(
      dynamoDBClient,
      environment.aws.dynamodb.tableName,
      { requestId: record.Sns.MessageId }
    );
    
    // Find job by Textract job ID
    const jobs = await jobRepository.findJobsByTextractJobId(jobId);
    
    if (!jobs || jobs.length === 0) {
      throw new TextractError('Job not found in database', { jobId });
    }
    
    const job = jobs[0]; // Use the first matching job
    
    recordLogger.info('Found job metadata', { 
      jobId: job.jobId,
      textractJobId: jobId,
      documentId: job.documentId,
      bucket: job.bucket,
      key: job.key
    });
    
    // Determine which Textract API to call based on job features
    const hasFeatures = job.textractFeatures && job.textractFeatures.length > 0;
    
    // Get the complete Textract results
    const textractResults = await getTextractResults(jobId, hasFeatures, recordLogger);
    
    // Store results in S3
    const resultKey = `extracted/${job.documentId}.json`;
    await storeResultsInS3(job.bucket, resultKey, textractResults, recordLogger);
    
    
    // Update job status in DynamoDB
    await jobRepository.updateJobStatus(job.jobId, DocumentProcessingStatus.EXTRACTED);
    
    const duration = Date.now() - startTime;
    recordLogger.info('Textract job processing completed successfully', {
      textractJobId: jobId,
      jobId: job.jobId,
      documentId: job.documentId,
      duration: `${duration}ms`
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    recordLogger.error('Error processing Textract completion', error, {
      duration: `${duration}ms`
    });
    throw error;
  }
}

/**
 * Get complete results from Textract API
 */
async function getTextractResults(jobId: string, hasFeatures: boolean, logger: Logger): Promise<any> {
  logger.debug('Getting Textract results', { jobId, hasFeatures });
  
  try {
    const results: any[] = [];
    let nextToken: string | undefined;
    
    // Use appropriate API based on whether job has features
    do {
      if (hasFeatures) {
        // For document analysis (with features like TABLES, FORMS)
        const command = new GetDocumentAnalysisCommand({
          JobId: jobId,
          MaxResults: 1000,
          ...(nextToken ? { NextToken: nextToken } : {})
        });
        
        const response = await textractClient.send(command);
        results.push(response);
        nextToken = response.NextToken;
      } else {
        // For plain text detection
        const command = new GetDocumentTextDetectionCommand({
          JobId: jobId,
          MaxResults: 1000,
          ...(nextToken ? { NextToken: nextToken } : {})
        });
        
        const response = await textractClient.send(command);
        results.push(response);
        nextToken = response.NextToken;
      }
    } while (nextToken);
    
    logger.info('Retrieved all Textract results', { 
      jobId, 
      pageCount: results.length 
    });
    
    return results;
  } catch (error) {
    logger.error('Error getting Textract results', error, { jobId });
    throw new TextractError(
      `Failed to get Textract results: ${error instanceof Error ? error.message : String(error)}`,
      { jobId, originalError: error }
    );
  }
}

/**
 * Store Textract results in S3
 */
async function storeResultsInS3(bucket: string, key: string, results: any, logger: Logger): Promise<void> {
  logger.debug('Storing Textract results in S3', { bucket, key });
  
  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(results, null, 2),
      ContentType: 'application/json'
    });
    
    await s3Client.send(command);
    
    logger.info('Successfully stored Textract results in S3', { bucket, key });
  } catch (error) {
    logger.error('Error storing Textract results in S3', error, { bucket, key });
    throw new StorageError(
      `Failed to store Textract results: ${error instanceof Error ? error.message : String(error)}`,
      { bucket, key, originalError: error }
    );
  }
}
