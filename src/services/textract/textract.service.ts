import {
  StartDocumentTextDetectionCommand,
  StartDocumentAnalysisCommand,
  GetDocumentTextDetectionCommand,
  GetDocumentAnalysisCommand,
  DocumentLocation,
  FeatureType
} from '@aws-sdk/client-textract';
import { Logger, LogContext } from '../../shared/logger/logger';
import { textractClient } from '../../clients/textract-client';
import { ITextractService } from './textract.interface';
import { environment } from '../../configs/environment';

/**
 * Service for processing documents with Amazon Textract
 */
export class TextractService implements ITextractService {
  private logger: Logger;
  
  constructor(logContext?: LogContext) {
    this.logger = new Logger('TextractService', logContext);
  }

  /**
   * Start document text detection
   * @param bucket S3 bucket name
   * @param key S3 object key
   * @param topicArn SNS topic ARN for completion notification
   * @returns JobId for the detection task
   */
  async startDocumentTextDetection(bucket: string, key: string, topicArn: string): Promise<string> {
    try {
      const documentLocation: DocumentLocation = {
        S3Object: {
          Bucket: bucket,
          Name: key
        }
      };
      
      const response = await textractClient.send(
        new StartDocumentTextDetectionCommand({
          DocumentLocation: documentLocation,
          NotificationChannel: {
            SNSTopicArn: topicArn,
            RoleArn: environment.aws.textract?.roleArn
          }
        })
      );
      
      const jobId = response.JobId!;
      this.logger.info(`Started document text detection job: ${jobId}`);
      return jobId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to start document text detection: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Start document analysis
   * @param bucket S3 bucket name
   * @param key S3 object key
   * @param topicArn SNS topic ARN for completion notification
   * @param featureTypes Feature types to analyze
   * @returns JobId for the analysis task
   */
  async startDocumentAnalysis(
    bucket: string, 
    key: string, 
    topicArn: string, 
    featureTypes: FeatureType[] = ['TABLES', 'FORMS']
  ): Promise<string> {
    try {
      const documentLocation: DocumentLocation = {
        S3Object: {
          Bucket: bucket,
          Name: key
        }
      };
      
      const response = await textractClient.send(
        new StartDocumentAnalysisCommand({
          DocumentLocation: documentLocation,
          FeatureTypes: featureTypes,
          NotificationChannel: {
            SNSTopicArn: topicArn,
            RoleArn: environment.aws.textract?.roleArn
          }
        })
      );
      
      const jobId = response.JobId!;
      this.logger.info(`Started document analysis job: ${jobId}`);
      return jobId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to start document analysis: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get document text detection results
   * @param jobId Job ID returned by startDocumentTextDetection
   * @returns Text detection results
   */
  async getDocumentTextDetection(jobId: string) {
    let nextToken: string | undefined;
    const allResults = {
      DocumentMetadata: {},
      Blocks: [],
      Warnings: []
    };
    
    try {
      // Textract results may be paginated, collect all pages
      do {
        const response = await textractClient.send(
          new GetDocumentTextDetectionCommand({
            JobId: jobId,
            NextToken: nextToken
          })
        );
        
        if (response.DocumentMetadata) {
          allResults.DocumentMetadata = response.DocumentMetadata;
        }
        
        if (response.Blocks) {
          allResults.Blocks = [...allResults.Blocks, ...response.Blocks];
        }
        
        if (response.Warnings) {
          allResults.Warnings = [...allResults.Warnings, ...response.Warnings];
        }
        
        nextToken = response.NextToken;
      } while (nextToken);
      
      this.logger.info(`Retrieved text detection results for job ${jobId}, found ${allResults.Blocks.length} blocks`);
      return allResults;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get document text detection results: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get document analysis results
   * @param jobId Job ID returned by startDocumentAnalysis
   * @returns Document analysis results
   */
  async getDocumentAnalysis(jobId: string) {
    let nextToken: string | undefined;
    const allResults = {
      DocumentMetadata: {},
      Blocks: [],
      Warnings: []
    };
    
    try {
      // Textract results may be paginated, collect all pages
      do {
        const response = await textractClient.send(
          new GetDocumentAnalysisCommand({
            JobId: jobId,
            NextToken: nextToken
          })
        );
        
        if (response.DocumentMetadata) {
          allResults.DocumentMetadata = response.DocumentMetadata;
        }
        
        if (response.Blocks) {
          allResults.Blocks = [...allResults.Blocks, ...response.Blocks];
        }
        
        if (response.Warnings) {
          allResults.Warnings = [...allResults.Warnings, ...response.Warnings];
        }
        
        nextToken = response.NextToken;
      } while (nextToken);
      
      this.logger.info(`Retrieved analysis results for job ${jobId}, found ${allResults.Blocks.length} blocks`);
      return allResults;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get document analysis results: ${errorMessage}`);
      throw error;
    }
  }
} 