import { Context, SQSEvent } from 'aws-lambda';
import { Logger } from '../shared/logger/logger';
import { GetKnowledgeBaseCommand, KnowledgeBaseStatus } from '@aws-sdk/client-bedrock-agent';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { BedrockService } from '../services/bedrock.service';
import { bedrockAgentAdminClient } from '../clients/bedrock-agent-admin-client';
import { s3Client } from '../clients/s3-client';
import { environment } from '../configs/environment';
import { DocumentJobRepository } from '../repositories/document-job.repository';
import { KnowledgeBaseRepository, KnowledgeBaseEntry } from '../repositories/knowledge-base.repository';
import { dynamoDBClient } from '../clients/dynamodb-client';
import { SchemaValidatorService } from '../services/schema-validator.service';
import { bedrockClient } from '../clients/bedrock-client';
import { bedrockAgentClient } from '../clients/bedrock-agent-client';
import { DocumentProcessingStatus } from '../services/textract.service';
import { SQSRecord } from 'src/dtos/sqs-message.dto';

// Interface for banking classification results
interface BankingClassificationResult {
  overallConfidence: number;
  documentType: {
    type: string;
    confidence: number;
    alternatives: Record<string, number>;
  };
  summary: string;
  entities: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
  metadata: Record<string, string>;
}

// Interface for standard classification results
interface ClassificationResult {
  documentType: string;
  confidence: number;
  metadata: Record<string, string>;
  entities: Array<{
    type: string;
    text: string;
    confidence: number;
  }>;
}

interface StoredClassificationResult {
  documentId: string;
  classification: ClassificationResult | BankingClassificationResult;
  extractedAt: string;
}

/**
 * Lambda handler for processing SQS events to classify documents
 */
export async function handler(event: SQSEvent, context: Context): Promise<void> {
  const logger = new Logger('ClassificationHandler', { 
    requestId: context.awsRequestId 
  });
  
  logger.info('Processing SQS event', { 
    recordCount: event.Records?.length || 0 
  });
  
  if (!event.Records || event.Records.length === 0) {
    logger.warn('No records found in SQS event');
    return;
  }
  
  // Process each SQS record
  for (const record of event.Records) {
    try {
      await processClassificationRecord(record, logger);
    } catch (error) {
      try {
        // Try to extract document info from SQS message for logging
        const message = JSON.parse(record.body);
        logger.error('Error processing SQS record', error, {
          documentId: message.documentId,
          bucket: message.bucket,
          key: message.key
        });
      } catch (parseError) {
        logger.error('Error processing SQS record', error, {
          messageId: record.messageId
        });
      }
    }
  }
  
  logger.info('SQS event processing completed');
}

/**
 * Process a single classification record
 */
async function processClassificationRecord(record: SQSRecord, logger: Logger): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Parse message body
    const message = JSON.parse(record.body);
    const documentId = message.documentId;
    const bucket = message.bucket;
    const key = message.key;
    
    // Validate required fields
    if (!documentId || !bucket || !key) {
      logger.error('Invalid message structure in SQS record', { message });
      throw new Error('Invalid message structure: Missing documentId, bucket, or key properties');
    }
    
    const logContext = { documentId, bucket, key };
    const recordLogger = logger.withContext(logContext);
    
    recordLogger.info('Processing document classification', {
      documentId,
      bucket,
      key
    });
    
    // Check if document exists in S3
    await validateDocument(bucket, key, recordLogger);
    
    // Check if we can use an existing knowledge base
    let knowledgeBaseId = await getExistingKnowledgeBase(recordLogger);
    
    // Get document content
    const documentContent = await getDocumentContent(bucket, key, recordLogger);
    
    // Perform classification - either with knowledge base or directly
    let classificationResult;
    if (knowledgeBaseId) {
      classificationResult = await classifyDocumentWithKnowledgeBase(
        knowledgeBaseId, 
        documentId,
        documentContent,
        recordLogger
      );
    } else {
      classificationResult = await classifyDocumentDirectly(
        documentId, 
        documentContent, 
        recordLogger
      );
    }
    
    // Store results
    await storeClassificationResults(bucket, documentId, classificationResult, recordLogger);
    
    const duration = Date.now() - startTime;
    recordLogger.info('Document classification completed successfully', {
      documentId,
      duration: `${duration}ms`
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error processing document classification', error);
    throw error;
  }
}

/**
 * Validate that the document exists in S3
 */
async function validateDocument(bucket: string, key: string, logger: Logger): Promise<void> {
  logger.debug('Validating document exists in S3', { bucket, key });
  
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });
    
    await s3Client.send(command);
    logger.info('Document validation successful', { bucket, key });
  } catch (error) {
    logger.error('Document validation failed', error, { bucket, key });
    throw new Error(`Document not found: ${bucket}/${key}`);
  }
}

/**
 * Get document content from S3
 */
async function getDocumentContent(bucket: string, key: string, logger: Logger): Promise<any> {
  logger.debug('Getting document content from S3', { bucket, key });
  
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });
    
    const response = await s3Client.send(command);
    const documentContent = await response.Body?.transformToString();
    
    if (!documentContent) {
      throw new Error('Empty document content');
    }
    
    // Parse document content
    const documentData = JSON.parse(documentContent);
    
    logger.info('Successfully retrieved document content', { 
      bucket, 
      key,
      contentSize: documentContent.length
    });
    
    return documentData;
  } catch (error) {
    logger.error('Error getting document content', error, { bucket, key });
    throw error;
  }
}

/**
 * Check for an existing knowledge base ID
 */
async function getExistingKnowledgeBase(logger: Logger): Promise<string | null> {
  const existingKnowledgeBaseId = process.env.KNOWLEDGE_BASE_ID || environment.aws.bedrock?.knowledgeBaseId;
  
  if (existingKnowledgeBaseId && /^[0-9a-zA-Z]+$/.test(existingKnowledgeBaseId)) {
    try {
      // Verify the knowledge base exists and is active
      const command = new GetKnowledgeBaseCommand({
        knowledgeBaseId: existingKnowledgeBaseId
      });
      
      const response = await bedrockAgentAdminClient.send(command);
      
      if (response.knowledgeBase?.status === KnowledgeBaseStatus.ACTIVE) {
        logger.info('Using existing active knowledge base', { 
          knowledgeBaseId: existingKnowledgeBaseId 
        });
        return existingKnowledgeBaseId;
      } else {
        logger.warn('Existing knowledge base is not active', { 
          knowledgeBaseId: existingKnowledgeBaseId,
          status: response.knowledgeBase?.status
        });
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`Error checking existing knowledge base: ${errorMessage}`, {
        knowledgeBaseId: existingKnowledgeBaseId
      });
      return null;
    }
  }
  
  logger.info('No valid knowledge base ID configured');
  return null;
}

/**
 * Classify a document directly using Bedrock without knowledge base
 */
async function classifyDocumentDirectly(
  documentId: string,
  documentData: any,
  logger: Logger
): Promise<BankingClassificationResult> {
  logger.info('Classifying document directly with Bedrock', { documentId });
  
  try {
    const modelId = environment.aws.bedrock?.modelId || process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';
    
    // Create Bedrock service instance
    const bedrockService = new BedrockService(
      modelId,
      bedrockClient,
      bedrockAgentClient,
      { requestId: documentId }
    );
    
    // Create classification prompt with allowed document type values
    const prompt = bedrockService.createBankingClassificationPrompt(documentData);
    const enhancedPrompt = `${prompt}\n\nIMPORTANT: The "documentType.type" field MUST be exactly one of these values: "KYC_FORM", "CREDIT_APPLICATION", "LOAN_CONTRACT", "BANK_STATEMENT", "TRANSACTION_RECEIPT", "ID_CARD", "PASSPORT", "UTILITY_BILL", "SALARY_SLIP", or "OTHER". Any other value will cause a validation error.`;
    
    // Invoke Bedrock model
    const llmResponse = await bedrockService.invokeModel(enhancedPrompt, {
      temperature: 0.1,
      maxTokens: 2048
    });
    
    // Parse and validate LLM response
    const validator = new SchemaValidatorService({ documentId });
    const rawJsonResponse = validator.parseJsonFromLlmResponse(llmResponse);
    const schema = validator.getBankingClassificationSchema();
    const classificationResult = validator.validate<BankingClassificationResult>(rawJsonResponse, schema);
    
    logger.info('Banking document classified successfully', {
      documentId,
      documentType: classificationResult.documentType.type,
      confidence: classificationResult.overallConfidence
    });
    
    return classificationResult;
  } catch (error) {
    logger.error('Error classifying document directly', error, { documentId });
    throw error;
  }
}

/**
 * Classify a document using the knowledge base and Bedrock Agent RAG
 */
async function classifyDocumentWithKnowledgeBase(
  knowledgeBaseId: string,
  documentId: string,
  documentData: any,
  logger: Logger
): Promise<BankingClassificationResult> {
  logger.info('Classifying document using knowledge base', {
    documentId,
    knowledgeBaseId
  });
  
  try {
    const modelId = environment.aws.bedrock?.modelId || process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';
    
    // Create Bedrock service instance
    const bedrockService = new BedrockService(
      modelId,
      bedrockClient,
      bedrockAgentClient,
      { requestId: documentId }
    );
    
    // Query the knowledge base for context
    const kbQuery = `Analyze and provide classification context for a document with the following structure: ${JSON.stringify(documentData).substring(0, 500)}...`;
    
    const kbResponse = await bedrockService.queryKnowledgeBase(kbQuery, {
      knowledgeBaseId,
      numberOfResults: 3,
      temperature: 0.1
    });
    
    logger.info('Knowledge base query successful', {
      documentId,
      citationsCount: kbResponse.citations?.length || 0
    });
    
    // Create classification prompt with KB context and allowed document type values
    const basePrompt = bedrockService.createBankingClassificationPrompt(documentData);
    const enhancedPrompt = `${basePrompt}\n\nAdditional context from knowledge base: ${kbResponse.output}\n\nIMPORTANT: The "documentType.type" field MUST be exactly one of these values: "KYC_FORM", "CREDIT_APPLICATION", "LOAN_CONTRACT", "BANK_STATEMENT", "TRANSACTION_RECEIPT", "ID_CARD", "PASSPORT", "UTILITY_BILL", "SALARY_SLIP", or "OTHER". Any other value will cause a validation error.`;
    
    // Invoke Bedrock model
    const llmResponse = await bedrockService.invokeModel(enhancedPrompt, {
      temperature: 0.1,
      maxTokens: 2048
    });
    
    // Parse and validate LLM response
    const validator = new SchemaValidatorService({ documentId });
    const rawJsonResponse = validator.parseJsonFromLlmResponse(llmResponse);
    const schema = validator.getBankingClassificationSchema();
    const classificationResult = validator.validate<BankingClassificationResult>(rawJsonResponse, schema);
    
    logger.info('Banking document classified successfully', {
      documentId,
      documentType: classificationResult.documentType.type,
      confidence: classificationResult.overallConfidence
    });
    
    return classificationResult;
  } catch (error) {
    logger.error('Error classifying document with knowledge base', error, {
      documentId,
      knowledgeBaseId
    });
    throw error;
  }
}

/**
 * Store classification results in S3 and knowledge base repository
 */
async function storeClassificationResults(
  bucket: string,
  documentId: string,
  classificationResult: BankingClassificationResult | ClassificationResult,
  logger: Logger
): Promise<void> {
  logger.debug('Storing classification results', { documentId });
  
  try {
    // Store in knowledge base repository
    const knowledgeBaseRepo = new KnowledgeBaseRepository();
    const entry: KnowledgeBaseEntry = {
      id: `${documentId}-classification`,
      title: `Classification for ${documentId}`,
      content: JSON.stringify(classificationResult),
      metadata: {
        documentId,
        classifiedAt: new Date().toISOString()
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await knowledgeBaseRepo.storeEntry(entry);
    
    // Store classification result in S3
    const classifiedKey = `classified/${documentId}.json`;
    const resultToStore: StoredClassificationResult = {
      documentId,
      classification: classificationResult,
      extractedAt: new Date().toISOString()
    };
    
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: classifiedKey,
      Body: JSON.stringify(resultToStore, null, 2),
      ContentType: 'application/json'
    });
    
    await s3Client.send(command);
    
    // Update document job status
    await updateJobStatus(documentId, logger);
    
    logger.info('Classification results stored successfully', { documentId });
  } catch (error) {
    logger.error('Error storing classification results', error);
    throw error;
  }
}

/**
 * Update job status after classification completes
 */
async function updateJobStatus(documentId: string, logger: Logger): Promise<void> {
  try {
    const jobRepository = new DocumentJobRepository(
      dynamoDBClient,
      environment.aws.dynamodb.tableName,
      { documentId }
    );
    
    const jobs = await jobRepository.getJobsByDocumentId(documentId);
    
    if (jobs && jobs.length > 0) {
      const job = jobs[0];
      
      await jobRepository.updateJob(job.jobId, {
        status: DocumentProcessingStatus.SUCCEEDED,
        completedAt: new Date().toISOString()
      });
      
      logger.info('Updated job status for document', { jobId: job.jobId });
    }
  } catch (error) {
    logger.warn('Could not update job status', { documentId });
    // Continue even if job update fails
  }
} 