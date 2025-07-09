import { randomUUID } from 'crypto';
import { Logger, LogContext } from '../shared/logger/logger';
import { DocumentMessage } from '../dtos/document-message.dto';
import { ITextractService, DocumentProcessingStatus, FeatureType } from './textract.service';
import { DocumentJobRepository, DocumentJob } from '../repositories/document-job.repository';
import { ValidationError, StorageError } from '../shared/errors';
import { TextractError } from '../services/textract.service';
import * as path from 'path';

// Supported file formats for Textract
const SUPPORTED_TEXTRACT_FORMATS = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif'];

// Interface for document processor service
export interface IDocumentProcessorService {
  /**
   * Process a document message
   * @param message The document message to process
   * @returns Document job ID for tracking
   */
  processDocument(message: DocumentMessage): Promise<string>;
  
  /**
   * Get document job status
   * @param jobId The job ID to check
   * @returns Current job status
   */
  getJobStatus(jobId: string): Promise<DocumentJob | null>;
}

// Configuration for document processing
export interface DocumentProcessorConfig {
  // Size threshold for sync vs async processing (in bytes)
  syncSizeThresholdBytes?: number;
  // Default features to extract if not specified
  defaultFeatures?: FeatureType[];
  // Maximum document size to process (in bytes)
  maxDocumentSizeBytes?: number;
}

// Implementation of document processor service
export class DocumentProcessorService implements IDocumentProcessorService {
  private textractService: ITextractService;
  private jobRepository: DocumentJobRepository;
  private logger: Logger;
  private config: DocumentProcessorConfig;
  
  // Default configuration
  private static DEFAULT_CONFIG: DocumentProcessorConfig = {
    syncSizeThresholdBytes: 5 * 1024 * 1024, // 5MB
    defaultFeatures: [FeatureType.TABLES, FeatureType.FORMS],
    maxDocumentSizeBytes: 500 * 1024 * 1024 // 500MB (Textract limit)
  };
  
  constructor(
    textractService: ITextractService,
    jobRepository: DocumentJobRepository,
    config?: Partial<DocumentProcessorConfig>,
    logContext?: LogContext
  ) {
    this.textractService = textractService;
    this.jobRepository = jobRepository;
    this.logger = new Logger('DocumentProcessorService', logContext);
    
    // Merge provided config with defaults
    this.config = {
      ...DocumentProcessorService.DEFAULT_CONFIG,
      ...config
    };
  }
  
  /**
   * Check if the file format is supported by Textract
   * @param key S3 object key
   * @returns True if supported, false otherwise
   */
  private isFormatSupported(key: string): boolean {
    const extension = path.extname(key).toLowerCase();
    return SUPPORTED_TEXTRACT_FORMATS.includes(extension);
  }
  
  async processDocument(message: DocumentMessage): Promise<string> {
    try {
      // Validate message
      await message.validate();
      
      const { bucket, key, metadata } = message;
      const documentId = randomUUID();
      
      this.logger.info('Processing document', { 
        documentId, 
        bucket, 
        key 
      });
      
      // Validate file format
      if (!this.isFormatSupported(key)) {
        throw new ValidationError('Unsupported document format for Textract', [], {
          key,
          supportedFormats: SUPPORTED_TEXTRACT_FORMATS.join(', ')
        });
      }
      
      // Determine processing method
      const fileSize = metadata?.fileSize ? parseInt(metadata.fileSize, 10) : 0;
      const useSync = fileSize > 0 && 
        fileSize < (this.config.syncSizeThresholdBytes || 0);
      
      // Validate document size
      if (fileSize > (this.config.maxDocumentSizeBytes || 0)) {
        throw new ValidationError('Document exceeds maximum size limit', [], {
          fileSize,
          maxSize: this.config.maxDocumentSizeBytes
        });
      }
      
      // Determine features to extract
      const features = this.getFeatures(message);
      
      // Create initial job record
      const job: Omit<DocumentJob, 'createdAt' | 'updatedAt'> = {
        jobId: randomUUID(),
        documentId,
        bucket,
        key,
        status: DocumentProcessingStatus.SUBMITTED,
        textractFeatures: features.map(f => f.toString()),
        timestamp: new Date().toISOString() // Add timestamp for the sort key
      };
      
      await this.jobRepository.createJob(job);
      
      try {
        if (useSync) {
          // Process synchronously
          this.logger.debug('Using synchronous processing', { 
            documentId, 
            fileSize 
          });
          
          // Update job status
          await this.jobRepository.updateJobStatus(
            job.jobId, 
            DocumentProcessingStatus.IN_PROGRESS
          );
          
          // Process the document synchronously
          const result = await this.textractService.analyzeDocumentSync(bucket, key, features);
          
          // Update job as succeeded
          await this.jobRepository.updateJobStatus(
            job.jobId, 
            DocumentProcessingStatus.SUCCEEDED
          );
          
          this.logger.info('Document processed synchronously', { 
            documentId, 
            jobId: job.jobId 
          });
          
          // Return the job ID
          return job.jobId;
        } else {
          // Process asynchronously
          this.logger.debug('Using asynchronous processing', { 
            documentId, 
            fileSize 
          });
          
          // Update job status
          await this.jobRepository.updateJobStatus(
            job.jobId, 
            DocumentProcessingStatus.IN_PROGRESS
          );
          
          // Start asynchronous job
          const textractJobId = await this.textractService.startDocumentAnalysis(
            bucket, 
            key, 
            features
          );
          
          // Update job with the Textract job ID
          await this.jobRepository.updateJob(
            job.jobId,
            { textractJobId }
          );
          
          this.logger.info('Asynchronous document processing started', { 
            documentId, 
            jobId: job.jobId,
            textractJobId 
          });
          
          // Return the job ID
          return job.jobId;
        }
      } catch (error) {
        // Update job as failed
        await this.jobRepository.updateJobStatus(
          job.jobId,
          DocumentProcessingStatus.FAILED,
          error instanceof Error ? error.message : String(error)
        );
        
        // Re-throw the error for upper layers
        throw error;
      }
    } catch (error) {
      this.logger.error('Error processing document', error, {
        bucket: message.bucket,
        key: message.key
      });
      
      if (error instanceof ValidationError || 
          error instanceof StorageError ||
          error instanceof TextractError) {
        throw error;
      }
      
      throw new TextractError(
        `Failed to process document: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  }
  
  async getJobStatus(jobId: string): Promise<DocumentJob | null> {
    try {
      const job = await this.jobRepository.getJob(jobId);
      
      if (!job) {
        this.logger.info('Job not found', { jobId });
        return null;
      }
      
      // If job is in progress, check the latest status from Textract
      if (job.status === DocumentProcessingStatus.IN_PROGRESS) {
        try {
          const textractStatus = await this.textractService.getDocumentAnalysisResults(jobId);
          
          // Map Textract status to our status
          let newStatus: DocumentProcessingStatus;
          switch (textractStatus.jobStatus) {
            case 'SUCCEEDED':
              newStatus = DocumentProcessingStatus.SUCCEEDED;
              break;
            case 'FAILED':
              newStatus = DocumentProcessingStatus.FAILED;
              break;
            case 'PARTIAL_SUCCESS':
              newStatus = DocumentProcessingStatus.PARTIAL_SUCCESS;
              break;
            default:
              // Still in progress, no update needed
              return job;
          }
          
          // Update job status
          const updatedJob = await this.jobRepository.updateJobStatus(
            jobId, 
            newStatus
          );
          
          return updatedJob || job;
        } catch (error) {
          this.logger.error('Error checking Textract job status', error, { jobId });
          // Return current job status, don't update it
          return job;
        }
      }
      
      return job;
    } catch (error) {
      this.logger.error('Error getting job status', error, { jobId });
      throw error;
    }
  }
  
  /**
   * Determine which Textract features to use based on message metadata
   */
  private getFeatures(message: DocumentMessage): FeatureType[] {
    // Default features
    const defaultFeatures = this.config.defaultFeatures || [];
    
    // Check if content type or metadata specifies features
    const contentType = message.metadata?.contentType?.toLowerCase();
    
    if (contentType) {
      if (contentType.includes('pdf')) {
        return [FeatureType.TABLES, FeatureType.FORMS, FeatureType.SIGNATURES];
      }
      
      if (contentType.includes('image')) {
        return [FeatureType.TABLES, FeatureType.FORMS];
      }
    }
    
    return defaultFeatures;
  }
} 