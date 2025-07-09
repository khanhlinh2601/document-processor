import { SQSEvent, SQSRecord, Context } from 'aws-lambda';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { Logger } from '../shared/logger/logger';
import { s3Client } from '../clients/s3-client';
import { TextractParser, ParsedDocument } from '../services/textract-parser.service';
import { BedrockService } from '../services/bedrock.service';
import { SchemaValidatorService } from '../services/schema-validator.service';

// Interfaces for classification results
interface Entity {
  type: string;
  text: string;
  confidence: number;
}

interface ClassificationResult {
  documentType: string;
  confidence: number;
  metadata: Record<string, string>;
  entities: Entity[];
}

// Interface for banking classification results
interface BankingClassificationResult {
  summary: string;
  category: string;
  confidence: number;
}

interface StoredClassificationResult {
  documentId: string;
  classification: ClassificationResult | BankingClassificationResult;
  extractedAt: string;
}

/**
 * Handler for the document classification Lambda
 * Processes SQS messages, extracts Textract results, and calls Bedrock for classification
 */
export async function handler(event: SQSEvent, context: Context): Promise<void> {
  const logger = new Logger('ClassificationHandler', {
    requestId: context.awsRequestId
  });

  logger.info('Processing classification SQS event', {
    recordCount: event.Records?.length || 0
  });

  if (!event.Records || event.Records.length === 0) {
    logger.warn('No records found in SQS event');
    return;
  }

  // Process each SQS message
  for (const record of event.Records) {
    try {
      await processClassificationRecord(record, logger);
    } catch (error) {
      logger.error('Error processing classification record', error, {
        messageId: record.messageId
      });
      // Continue processing other records
    }
  }

  logger.info('SQS event processing completed');
}

/**
 * Process a single SQS record for document classification
 */
async function processClassificationRecord(record: SQSRecord, logger: Logger): Promise<void> {
  const startTime = Date.now();
  const logContext = { messageId: record.messageId };
  const recordLogger = logger.withContext(logContext);

  try {
    recordLogger.debug('Processing SQS record', {
      messageId: record.messageId,
      body: record.body
    });

    // Parse message body
    const message = JSON.parse(record.body);
    const documentId = message.documentId;
    const bucket = message.bucket;
    const key = message.key;
    // Check if we should use banking classification
    const useBankingClassification = true;

    if (!documentId || !bucket || !key) {
      throw new Error('Invalid message format: missing required fields');
    }

    recordLogger.info('Processing document classification', {
      documentId,
      bucket,
      key,
      useBankingClassification
    });

    // 1. Download Textract results from S3
    const textractResults = await downloadTextractResults(bucket, key, recordLogger);

    // 2. Parse Textract results
    const parser = new TextractParser({ documentId });
    const parsedDocument = parser.parseTextractResults(textractResults);

    recordLogger.info('Document parsed successfully', {
      documentId,
      textLength: parsedDocument.text.length,
      formCount: parsedDocument.forms.length,
      tableCount: parsedDocument.tables.length
    });

    // 3. Create structured document representation
    const documentRepresentation = createStructuredRepresentation(parsedDocument);

    // 4. Send to Bedrock LLM for classification
    const bedrock = new BedrockService(process.env.BEDROCK_MODEL_ID, undefined, { documentId });
    
    let llmResponse;
    let classificationResult;
    
    if (useBankingClassification) {
      // Use banking-specific classification
      const prompt = bedrock.createBankingClassificationPrompt(documentRepresentation);
      llmResponse = await bedrock.invokeModel(prompt, {
        temperature: 0.1, // Low temperature for factual extraction
        maxTokens: 2048
      });
      
      // 5. Parse and validate LLM response with banking schema
      const validator = new SchemaValidatorService({ documentId });
      const rawJsonResponse = validator.parseJsonFromLlmResponse(llmResponse);
      const schema = validator.getBankingClassificationSchema();
      classificationResult = validator.validate<BankingClassificationResult>(rawJsonResponse, schema);
      
      recordLogger.info('Banking document classified successfully', {
        documentId,
        category: classificationResult.category,
        confidence: classificationResult.confidence
      });
    } else {
      // Use general document classification
      const prompt = bedrock.createClassificationPrompt(documentRepresentation);
      llmResponse = await bedrock.invokeModel(prompt, {
        temperature: 0.1, // Low temperature for factual extraction
        maxTokens: 2048
      });
      
      // 5. Parse and validate LLM response with general schema
      const validator = new SchemaValidatorService({ documentId });
      const rawJsonResponse = validator.parseJsonFromLlmResponse(llmResponse);
      const schema = validator.getClassificationSchema();
      classificationResult = validator.validate<ClassificationResult>(rawJsonResponse, schema);
      
      recordLogger.info('Document classified successfully', {
        documentId,
        documentType: classificationResult.documentType,
        confidence: classificationResult.confidence
      });
    }

    // 6. Store classification result in S3
    const classifiedKey = `classified/${documentId}.json`;
    const resultToStore: StoredClassificationResult = {
      documentId,
      classification: classificationResult,
      extractedAt: new Date().toISOString()
    };
    await storeClassificationResult(bucket, classifiedKey, resultToStore, recordLogger);

    const duration = Date.now() - startTime;
    recordLogger.info('Document classification completed', {
      documentId,
      duration: `${duration}ms`,
      resultLocation: `s3://${bucket}/${classifiedKey}`
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    recordLogger.error('Error processing document classification', error, {
      duration: `${duration}ms`
    });
    throw error;
  }
}

/**
 * Download Textract results from S3
 */
async function downloadTextractResults(bucket: string, key: string, logger: Logger): Promise<any[]> {
  logger.debug('Downloading Textract results', { bucket, key });

  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });

    const response = await s3Client.send(command);
    const bodyContents = await response.Body?.transformToString();

    if (!bodyContents) {
      throw new Error('Empty response body from S3');
    }

    const textractResults = JSON.parse(bodyContents);
    logger.debug('Successfully downloaded Textract results', {
      bucket,
      key,
      size: bodyContents.length
    });

    return textractResults;
  } catch (error) {
    logger.error('Error downloading Textract results', error, { bucket, key });
    throw new Error(`Failed to download Textract results: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create a structured representation of the document for the LLM
 */
function createStructuredRepresentation(parsedDocument: ParsedDocument): any {
  // Create a simplified representation that includes key information
  return {
    text: parsedDocument.text,
    forms: parsedDocument.forms.map(form => ({
      key: form.key,
      value: form.value
    })),
    tables: parsedDocument.tables.map(table => ({
      rows: table.rows
    }))
  };
}

/**
 * Store classification result in S3
 */
async function storeClassificationResult(
  bucket: string,
  key: string,
  result: StoredClassificationResult,
  logger: Logger
): Promise<void> {
  logger.debug('Storing classification result in S3', { bucket, key });

  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(result, null, 2),
      ContentType: 'application/json'
    });

    await s3Client.send(command);

    logger.info('Successfully stored classification result in S3', { bucket, key });
  } catch (error) {
    logger.error('Error storing classification result in S3', error, { bucket, key });
    throw new Error(
      `Failed to store classification result: ${error instanceof Error ? error.message : String(error)}`
    );
  }
} 