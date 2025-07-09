import { 
  DynamoDBClient, 
  PutItemCommand, 
  GetItemCommand,
  UpdateItemCommand,
  QueryCommand,
  ReturnValue,
  ScanCommand
} from '@aws-sdk/client-dynamodb';
import { 
  marshall, 
  unmarshall
} from '@aws-sdk/util-dynamodb';
import { Logger, LogContext } from '../shared/logger/logger';
import { dynamoDBClient } from '../clients/dynamodb-client';
import { DatabaseError } from '../shared/errors';
import { DocumentProcessingStatus } from '../services/textract.service';
import { environment } from '../configs/environment';

/**
 * Document job tracking entry
 */
export interface DocumentJob {
  jobId: string;
  documentId: string;
  bucket: string;
  key: string;
  status: DocumentProcessingStatus;
  createdAt: string;
  updatedAt: string;
  timestamp: string; // Add timestamp field for DynamoDB sort key
  completedAt?: string;
  errorMessage?: string;
  textractFeatures?: string[];
  textractJobId?: string; // ID from AWS Textract service
}

/**
 * Repository for document processing job tracking
 */
export class DocumentJobRepository {
  private dynamoClient: DynamoDBClient;
  private tableName: string;
  private logger: Logger;

  constructor(
    dynamoClient?: DynamoDBClient,
    tableName?: string,
    logContext?: LogContext
  ) {
    this.dynamoClient = dynamoClient || dynamoDBClient;
    this.tableName = tableName || environment.aws.dynamodb.tableName;
    this.logger = new Logger('DocumentJobRepository', logContext);
  }

  /**
   * Create a new document job
   * @param job Document job to create
   * @returns Created document job
   */
  async createJob(job: Omit<DocumentJob, 'createdAt' | 'updatedAt' | 'timestamp'>): Promise<DocumentJob> {
    try {
      const now = new Date().toISOString();
      
      const fullJob: DocumentJob = {
        ...job,
        createdAt: now,
        updatedAt: now,
        timestamp: now // Add timestamp for the sort key
      };
      
      const params = {
        TableName: this.tableName,
        Item: marshall(fullJob, { removeUndefinedValues: true }),
        ConditionExpression: 'attribute_not_exists(jobId)'
      };
      
      this.logger.debug('Creating document job', { 
        jobId: job.jobId, 
        documentId: job.documentId,
        tableName: this.tableName
      });
      
      await this.dynamoClient.send(new PutItemCommand(params));
      
      this.logger.info('Document job created successfully', { 
        jobId: job.jobId, 
        documentId: job.documentId
      });
      
      return fullJob;
    } catch (error) {
      this.logger.error('Error creating document job', error, { 
        jobId: job.jobId,
        tableName: this.tableName
      });
      throw new DatabaseError(
        `Failed to create document job: ${error instanceof Error ? error.message : String(error)}`,
        { jobId: job.jobId, originalError: error }
      );
    }
  }

  /**
   * Get a document job by its ID
   * @param jobId The job ID to retrieve
   * @returns Document job or null if not found
   */
  async getJob(jobId: string): Promise<DocumentJob | null> {
    try {
      // Create a secondary index on jobId to look up jobs directly
      const params = {
        TableName: this.tableName,
        KeyConditionExpression: 'jobId = :jobId',
        ExpressionAttributeValues: marshall({ ':jobId': jobId }),
        IndexName: 'JobIdIndex' // We'll need to add this index to the table
      };
      
      this.logger.debug('Getting document job', { jobId, tableName: this.tableName });
      
      try {
        // Try to query using the index
        const result = await this.dynamoClient.send(new QueryCommand(params));
        
        if (!result.Items || result.Items.length === 0) {
          this.logger.info('Document job not found', { jobId });
          return null;
        }
        
        const job = unmarshall(result.Items[0]) as DocumentJob;
        return job;
      } catch (indexError) {
        // If the index doesn't exist yet, fall back to scanning
        this.logger.warn('JobIdIndex not found, falling back to scan', { 
          jobId, 
          error: indexError instanceof Error ? indexError.message : String(indexError) 
        });
        
        const scanParams = {
          TableName: this.tableName,
          FilterExpression: 'jobId = :jobId',
          ExpressionAttributeValues: marshall({ ':jobId': jobId })
        };
        
        const scanResult = await this.dynamoClient.send(new ScanCommand(scanParams));
        
        if (!scanResult.Items || scanResult.Items.length === 0) {
          this.logger.info('Document job not found', { jobId });
          return null;
        }
        
        const job = unmarshall(scanResult.Items[0]) as DocumentJob;
        return job;
      }
    } catch (error) {
      this.logger.error('Error getting document job', error, { jobId, tableName: this.tableName });
      throw new DatabaseError(
        `Failed to get document job: ${error instanceof Error ? error.message : String(error)}`,
        { jobId, originalError: error }
      );
    }
  }

  /**
   * Update document job status
   * @param jobId The job ID to update
   * @param status New status
   * @param errorMessage Optional error message if status is FAILED
   * @returns Updated document job
   */
  async updateJobStatus(
    jobId: string, 
    status: DocumentProcessingStatus, 
    errorMessage?: string
  ): Promise<DocumentJob | null> {
    try {
      // First, get the job to find its documentId and timestamp
      const job = await this.getJob(jobId);
      
      if (!job) {
        this.logger.warn('Document job not found for update', { jobId });
        return null;
      }
      
      const now = new Date().toISOString();
      
      // Use expression attribute names to handle reserved keywords
      const updateExpression = ['set #updatedAt = :updatedAt', '#status = :status'];
      const expressionAttributeValues: any = {
        ':updatedAt': { S: now },
        ':status': { S: status }
      };
      
      // Define expression attribute names for reserved keywords
      const expressionAttributeNames: any = {
        '#updatedAt': 'updatedAt',
        '#status': 'status'
      };
      
      // Add completedAt if the job is finished
      if (status === DocumentProcessingStatus.SUCCEEDED || 
          status === DocumentProcessingStatus.FAILED || 
          status === DocumentProcessingStatus.PARTIAL_SUCCESS) {
        updateExpression.push('#completedAt = :completedAt');
        expressionAttributeValues[':completedAt'] = { S: now };
        expressionAttributeNames['#completedAt'] = 'completedAt';
      }
      
      // Add error message if provided
      if (errorMessage) {
        updateExpression.push('#errorMessage = :errorMessage');
        expressionAttributeValues[':errorMessage'] = { S: errorMessage };
        expressionAttributeNames['#errorMessage'] = 'errorMessage';
      }
      
      const params = {
        TableName: this.tableName,
        Key: marshall({ 
          documentId: job.documentId, 
          timestamp: job.timestamp 
        }),
        UpdateExpression: `${updateExpression.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ReturnValues: ReturnValue.ALL_NEW
      };
      
      this.logger.debug('Updating document job status', { 
        jobId, 
        documentId: job.documentId,
        timestamp: job.timestamp,
        status 
      });
      
      const result = await this.dynamoClient.send(new UpdateItemCommand(params));
      
      if (!result.Attributes) {
        this.logger.warn('Document job not found for update after retrieval', { jobId });
        return null;
      }
      
      const updatedJob = unmarshall(result.Attributes) as DocumentJob;
      this.logger.info('Document job status updated', { 
        jobId, 
        status,
        documentId: updatedJob.documentId
      });
      
      return updatedJob;
    } catch (error) {
      this.logger.error('Error updating document job status', error, { 
        jobId,
        tableName: this.tableName
      });
      throw new DatabaseError(
        `Failed to update document job status: ${error instanceof Error ? error.message : String(error)}`,
        { jobId, status, originalError: error }
      );
    }
  }

  /**
   * Update job attributes
   * @param jobId The job ID to update
   * @param attributes Object with attributes to update
   * @returns Updated document job or null if not found
   */
  async updateJob(
    jobId: string,
    attributes: Partial<DocumentJob>
  ): Promise<DocumentJob | null> {
    try {
      // First, get the job to find its documentId and timestamp
      const job = await this.getJob(jobId);
      
      if (!job) {
        this.logger.warn('Document job not found for update', { jobId });
        return null;
      }
      
      const now = new Date().toISOString();
      
      // Prepare update expression
      const updateExpressionParts: string[] = ['#updatedAt = :updatedAt'];
      const expressionAttributeValues: any = {
        ':updatedAt': { S: now }
      };
      
      // Define expression attribute names for reserved keywords
      const expressionAttributeNames: any = {
        '#updatedAt': 'updatedAt'
      };
      
      // Add all attributes to update
      Object.entries(attributes).forEach(([key, value]) => {
        if (value !== undefined) {
          updateExpressionParts.push(`#${key} = :${key}`);
          expressionAttributeValues[`:${key}`] = marshall({ [key]: value })[key];
          expressionAttributeNames[`#${key}`] = key;
        }
      });
      
      const params = {
        TableName: this.tableName,
        Key: marshall({ 
          documentId: job.documentId, 
          timestamp: job.timestamp 
        }),
        UpdateExpression: `set ${updateExpressionParts.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ReturnValues: ReturnValue.ALL_NEW
      };
      
      this.logger.debug('Updating document job', { 
        jobId,
        documentId: job.documentId,
        attributes: Object.keys(attributes).join(', ')
      });
      
      const result = await this.dynamoClient.send(new UpdateItemCommand(params));
      
      if (!result.Attributes) {
        this.logger.warn('Document job not found for update after retrieval', { jobId });
        return null;
      }
      
      const updatedJob = unmarshall(result.Attributes) as DocumentJob;
      this.logger.info('Document job updated', { 
        jobId,
        documentId: updatedJob.documentId
      });
      
      return updatedJob;
    } catch (error) {
      this.logger.error('Error updating document job', error, { 
        jobId,
        tableName: this.tableName
      });
      throw new DatabaseError(
        `Failed to update document job: ${error instanceof Error ? error.message : String(error)}`,
        { jobId, originalError: error }
      );
    }
  }

  /**
   * Get all jobs for a document
   * @param documentId The document ID
   * @returns Array of document jobs
   */
  async getJobsByDocumentId(documentId: string): Promise<DocumentJob[]> {
    try {
      const params = {
        TableName: this.tableName,
        IndexName: 'DocumentIdIndex',
        KeyConditionExpression: 'documentId = :documentId',
        ExpressionAttributeValues: marshall({ ':documentId': documentId })
      };
      
      this.logger.debug('Getting jobs by document ID', { documentId });
      const result = await this.dynamoClient.send(new QueryCommand(params));
      
      if (!result.Items || result.Items.length === 0) {
        this.logger.info('No jobs found for document', { documentId });
        return [];
      }
      
      const jobs = result.Items.map(item => unmarshall(item)) as DocumentJob[];
      
      this.logger.info(`Found ${jobs.length} jobs for document`, { documentId });
      return jobs;
    } catch (error) {
      this.logger.error('Error getting jobs by document ID', error, { documentId });
      throw new DatabaseError(
        `Failed to get jobs by document ID: ${error instanceof Error ? error.message : String(error)}`,
        { documentId, originalError: error }
      );
    }
  }

  /**
   * Find jobs by Textract job ID
   * @param textractJobId The Textract job ID
   * @returns Array of document jobs with the given Textract job ID
   */
  async findJobsByTextractJobId(textractJobId: string): Promise<DocumentJob[]> {
    try {
      // Try to use the global secondary index if available
      const params = {
        TableName: this.tableName,
        IndexName: 'TextractJobIdIndex',
        KeyConditionExpression: 'textractJobId = :textractJobId',
        ExpressionAttributeValues: marshall({ ':textractJobId': textractJobId })
      };
      
      this.logger.debug('Finding jobs by Textract job ID', { 
        textractJobId,
        tableName: this.tableName 
      });
      
      try {
        // Try to query using the index
        const result = await this.dynamoClient.send(new QueryCommand(params));
        
        if (!result.Items || result.Items.length === 0) {
          this.logger.info('No jobs found with the Textract job ID', { textractJobId });
          return [];
        }
        
        const jobs = result.Items.map(item => unmarshall(item) as DocumentJob);
        return jobs;
      } catch (indexError) {
        // If the index doesn't exist yet, fall back to scanning
        this.logger.warn('TextractJobIdIndex not found, falling back to scan', { 
          textractJobId, 
          error: indexError instanceof Error ? indexError.message : String(indexError) 
        });
        
        const scanParams = {
          TableName: this.tableName,
          FilterExpression: 'textractJobId = :textractJobId',
          ExpressionAttributeValues: marshall({ ':textractJobId': textractJobId })
        };
        
        const scanResult = await this.dynamoClient.send(new ScanCommand(scanParams));
        
        if (!scanResult.Items || scanResult.Items.length === 0) {
          this.logger.info('No jobs found with the Textract job ID', { textractJobId });
          return [];
        }
        
        const jobs = scanResult.Items.map(item => unmarshall(item) as DocumentJob);
        return jobs;
      }
    } catch (error) {
      this.logger.error('Error finding jobs by Textract job ID', error, { 
        textractJobId, 
        tableName: this.tableName 
      });
      throw new DatabaseError(
        `Failed to find jobs by Textract job ID: ${error instanceof Error ? error.message : String(error)}`,
        { textractJobId, originalError: error }
      );
    }
  }
} 