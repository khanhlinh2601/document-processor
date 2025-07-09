import {
  StartDocumentAnalysisCommand,
  StartDocumentAnalysisCommandInput,
  GetDocumentAnalysisCommand,
  GetDocumentAnalysisCommandInput,
  AnalyzeDocumentCommand,
  AnalyzeDocumentCommandInput,
  TextractClient,
  DocumentLocation,
  FeatureType,
  NotificationChannel
} from '@aws-sdk/client-textract';
import { Logger, LogContext } from '../shared/logger/logger';
import { textractClient } from '../clients/textract-client';
import { ServiceError } from '../shared/errors';
import { environment } from '../configs/environment';

// Re-export FeatureType for use in other modules
export { FeatureType } from '@aws-sdk/client-textract';

// Status of document processing
export enum DocumentProcessingStatus {
  SUBMITTED = 'SUBMITTED',
  IN_PROGRESS = 'IN_PROGRESS',
  FAILED = 'FAILED',
  SUCCEEDED = 'SUCCEEDED',
  PARTIAL_SUCCESS = 'PARTIAL_SUCCESS',
  EXTRACTED = 'EXTRACTED'
}

// Custom error type for Textract operations
export class TextractError extends ServiceError {
  constructor(description: string, context: Record<string, any> = {}) {
    super('TEXTRACT_ERROR', 500, description, true, context);
  }
}

// Interface for the Textract service
export interface ITextractService {
  /**
   * Analyze document synchronously (for small documents)
   * @param bucket The S3 bucket name
   * @param key The S3 object key
   * @param featureTypes Features to extract (e.g. TABLES, FORMS)
   * @returns Analysis results
   */
  analyzeDocumentSync(bucket: string, key: string, featureTypes?: FeatureType[]): Promise<any>;
  
  /**
   * Start asynchronous document analysis
   * @param bucket The S3 bucket name
   * @param key The S3 object key
   * @param featureTypes Features to extract (e.g. TABLES, FORMS)
   * @returns Job ID for the started analysis job
   */
  startDocumentAnalysis(bucket: string, key: string, featureTypes?: FeatureType[]): Promise<string>;
  
  /**
   * Get results of an asynchronous document analysis
   * @param jobId The job ID from startDocumentAnalysis
   * @returns Analysis results and job status
   */
  getDocumentAnalysisResults(jobId: string): Promise<{
    jobStatus: string;
    results: any;
    nextToken?: string;
  }>;
}

// Implementation of the Textract service
export class TextractService implements ITextractService {
  private textractClient: TextractClient;
  private logger: Logger;
  private snsTopicArn?: string;
  private snsRoleArn?: string;

  constructor(
    textractClient?: TextractClient, 
    logContext?: LogContext,
    snsTopicArn?: string,
    snsRoleArn?: string
  ) {
    this.textractClient = textractClient || textractClient;
    this.logger = new Logger('TextractService', logContext);
    
    // Get SNS configuration from environment or parameters
    this.snsTopicArn = snsTopicArn || process.env.TEXTRACT_SNS_TOPIC_ARN;
    this.snsRoleArn = snsRoleArn || environment.aws.textract?.roleArn;
  }

  async analyzeDocumentSync(bucket: string, key: string, featureTypes: FeatureType[] = [FeatureType.TABLES, FeatureType.FORMS]): Promise<any> {
    try {
      const startTime = Date.now();
      this.logger.debug('Starting synchronous document analysis', { bucket, key, featureTypes });
      
      const params: AnalyzeDocumentCommandInput = {
        Document: {
          S3Object: {
            Bucket: bucket,
            Name: key
          }
        },
        FeatureTypes: featureTypes
      };

      const command = new AnalyzeDocumentCommand(params);
      const response = await this.textractClient.send(command);
      
      const duration = Date.now() - startTime;
      this.logger.info('Completed synchronous document analysis', { 
        bucket, 
        key, 
        duration: `${duration}ms`,
        documentMetadata: response.DocumentMetadata
      });
      
      return response;
    } catch (error) {
      this.logger.error('Error in synchronous document analysis', error, { bucket, key });
      throw new TextractError(
        `Failed to analyze document: ${error instanceof Error ? error.message : String(error)}`,
        { bucket, key, originalError: error }
      );
    }
  }

  async startDocumentAnalysis(bucket: string, key: string, featureTypes: FeatureType[] = [FeatureType.TABLES, FeatureType.FORMS]): Promise<string> {
    try {
      this.logger.debug('Starting asynchronous document analysis', { bucket, key, featureTypes });
      
      const documentLocation: DocumentLocation = {
        S3Object: {
          Bucket: bucket,
          Name: key
        }
      };

      const params: StartDocumentAnalysisCommandInput = {
        DocumentLocation: documentLocation,
        FeatureTypes: featureTypes
      };
      
      // Add notification channel if SNS configuration is available
      if (this.snsTopicArn && this.snsRoleArn) {
        const notificationChannel: NotificationChannel = {
          SNSTopicArn: this.snsTopicArn,
          RoleArn: this.snsRoleArn
        };
        
        params.NotificationChannel = notificationChannel;
        this.logger.debug('Using SNS notification channel', { 
          snsTopicArn: this.snsTopicArn
        });
      } else {
        this.logger.warn('SNS notification configuration not found, will need to poll for results');
      }

      const command = new StartDocumentAnalysisCommand(params);
      const response = await this.textractClient.send(command);
      
      if (!response.JobId) {
        throw new TextractError('No JobId returned from Textract', { bucket, key });
      }
      
      this.logger.info('Started asynchronous document analysis job', { 
        bucket, 
        key,
        jobId: response.JobId 
      });
      
      return response.JobId;
    } catch (error) {
      this.logger.error('Error starting document analysis', error, { bucket, key });
      throw new TextractError(
        `Failed to start document analysis: ${error instanceof Error ? error.message : String(error)}`,
        { bucket, key, originalError: error }
      );
    }
  }

  async getDocumentAnalysisResults(jobId: string, nextToken?: string): Promise<{ 
    jobStatus: string;
    results: any;
    nextToken?: string;
  }> {
    try {
      this.logger.debug('Getting document analysis results', { jobId, nextToken });
      
      const params: GetDocumentAnalysisCommandInput = {
        JobId: jobId,
        MaxResults: 1000
      };

      if (nextToken) {
        params.NextToken = nextToken;
      }

      const command = new GetDocumentAnalysisCommand(params);
      const response = await this.textractClient.send(command);
      
      this.logger.info('Retrieved document analysis results', { 
        jobId, 
        status: response.JobStatus,
        hasMorePages: !!response.NextToken
      });
      
      return {
        jobStatus: response.JobStatus || 'UNKNOWN',
        results: response,
        nextToken: response.NextToken
      };
    } catch (error) {
      this.logger.error('Error getting document analysis results', error, { jobId });
      throw new TextractError(
        `Failed to get document analysis results: ${error instanceof Error ? error.message : String(error)}`,
        { jobId, originalError: error }
      );
    }
  }
} 