import { FeatureType } from '@aws-sdk/client-textract';

/**
 * Interface for Textract document processing service
 */
export interface ITextractService {
  /**
   * Start document text detection
   * @param bucket S3 bucket name
   * @param key S3 object key
   * @param topicArn SNS topic ARN for completion notification
   * @returns JobId for the detection task
   */
  startDocumentTextDetection(bucket: string, key: string, topicArn: string): Promise<string>;
  
  /**
   * Start document analysis
   * @param bucket S3 bucket name
   * @param key S3 object key
   * @param topicArn SNS topic ARN for completion notification
   * @param featureTypes Feature types to analyze
   * @returns JobId for the analysis task
   */
  startDocumentAnalysis(
    bucket: string, 
    key: string, 
    topicArn: string, 
    featureTypes?: FeatureType[]
  ): Promise<string>;
  
  /**
   * Get document text detection results
   * @param jobId Job ID returned by startDocumentTextDetection
   * @returns Text detection results
   */
  getDocumentTextDetection(jobId: string): Promise<any>;
  
  /**
   * Get document analysis results
   * @param jobId Job ID returned by startDocumentAnalysis
   * @returns Document analysis results
   */
  getDocumentAnalysis(jobId: string): Promise<any>;
} 