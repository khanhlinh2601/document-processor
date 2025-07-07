import { ITextractService, TextractService } from '../textract';
import { ITextractNotificationService, TextractNotificationService } from '../textract';
import { DocumentMetadata, LLMProcessingResult } from '../../dtos/document-metadata.dto';
import { Logger } from '../../shared/logger/logger';

/**
 * Service to process documents using Amazon Textract
 */
export class TextractProcessorService {
  private textractService: ITextractService;
  private notificationService: ITextractNotificationService;
  private logger: Logger;

  constructor(
    textractService = new TextractService(),
    notificationService = new TextractNotificationService()
  ) {
    this.textractService = textractService;
    this.notificationService = notificationService;
    this.logger = new Logger('TextractProcessorService');
  }

  /**
   * Process document with Amazon Textract
   * @param documentMetadata Document metadata
   * @returns LLM processing result
   */
  async processDocumentWithTextract(documentMetadata: DocumentMetadata): Promise<LLMProcessingResult> {
    const { bucket, key, documentId, fileType } = documentMetadata;
    this.logger.info(`Processing document ${documentId} with Textract`);

    let topicArn: string | undefined;
    let queueUrl: string | undefined;

    try {
      // 1. Set up SNS topic and SQS queue
      const resources = await this.notificationService.setupNotifications(documentId);
      topicArn = resources.topicArn;
      queueUrl = resources.queueUrl;
      
      // 2. Start document processing based on file type and desired analysis
      let jobId: string;

      if (['pdf', 'png', 'jpg', 'jpeg', 'tiff'].includes(fileType.toLowerCase())) {
        // Choose either text detection or document analysis based on needs
        if (this.shouldPerformFullAnalysis(fileType)) {
          jobId = await this.textractService.startDocumentAnalysis(
            bucket,
            key,
            topicArn
          );
        } else {
          jobId = await this.textractService.startDocumentTextDetection(
            bucket,
            key,
            topicArn
          );
        }
        
        // 3. Wait for completion via SQS
        const completionStatus = await this.notificationService.getCompletionStatus(
          queueUrl,
          jobId,
          120, // Wait up to 2 minutes
          20 // In 20 attempts
        );
        
        if (!completionStatus || completionStatus.status !== 'SUCCEEDED') {
          throw new Error(`Document processing failed or timed out: ${JSON.stringify(completionStatus)}`);
        }
        
        // 4. Get results
        let results;
        if (this.shouldPerformFullAnalysis(fileType)) {
          results = await this.textractService.getDocumentAnalysis(jobId);
        } else {
          results = await this.textractService.getDocumentTextDetection(jobId);
        }
        
        // 5. Transform Textract results to LLM format
        return this.transformTextractResults(results);
      } else {
        throw new Error(`Unsupported file type for Textract: ${fileType}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Textract processing failed: ${errorMessage}`);
      throw error;
    } finally {
      // 6. Clean up resources
      if (topicArn && queueUrl) {
        try {
          await this.notificationService.cleanupResources(topicArn, queueUrl);
        } catch (cleanupError) {
          this.logger.error('Failed to clean up resources:', cleanupError);
        }
      }
    }
  }

  /**
   * Determine if we should use full document analysis vs. text detection
   * @param fileType Document file type
   * @returns True if full analysis should be performed
   */
  private shouldPerformFullAnalysis(fileType: string): boolean {
    // For PDFs, typically we want to analyze forms and tables
    // For images, it might depend on content type, but we'll simplify for now
    return fileType.toLowerCase() === 'pdf';
  }

  /**
   * Transform Textract results to LLM format
   * @param textractResults Raw Textract results
   * @returns Formatted LLM processing results
   */
  private transformTextractResults(textractResults: any): LLMProcessingResult {
    try {
      // Extract text content from Textract blocks
      const blocks = textractResults.Blocks || [];
      
      // Extract all text blocks
      const textBlocks = blocks.filter((block: any) => 
        block.BlockType === 'LINE' || block.BlockType === 'WORD');
      
      // Concatenate the text
      const fullText = textBlocks
        .map((block: any) => block.Text)
        .filter(Boolean)
        .join(' ');
      
      // Extract form elements (key-value pairs)
      const forms = this.extractForms(blocks);
      
      // Extract tables
      const tables = this.extractTables(blocks);
      
      // Generate summary from first part of text
      const summary = fullText.length > 200 
        ? `${fullText.substring(0, 200)}...` 
        : fullText;
      
      // Extract possible entities
      const entities = this.extractEntities(blocks, forms);
      
      // Generate keywords from text content
      const keywords = this.extractKeywords(fullText);
      
      return {
        summary,
        entities,
        sentiment: 'neutral', // Simplified - would need separate sentiment analysis
        keywords,
        processingTime: 0, // No accurate timing information from Textract
        textractData: {
          forms,
          tables,
          pageCount: textractResults.DocumentMetadata?.Pages || 1
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to transform Textract results: ${errorMessage}`);
      throw error;
    }
  }
  
  /**
   * Extract form key-value pairs
   * @param blocks Textract blocks
   * @returns Map of form key-values
   */
  private extractForms(blocks: any[]): Record<string, string> {
    const forms: Record<string, string> = {};
    
    // Get key-value pairs
    const keyValueSets = blocks.filter(block => 
      block.BlockType === 'KEY_VALUE_SET');
      
    // Process key-value sets
    for (const kvBlock of keyValueSets) {
      if (kvBlock.EntityTypes && kvBlock.EntityTypes.includes('KEY')) {
        const keyText = this.getTextFromRelationships(kvBlock, blocks);
        const valueBlock = this.findValueBlock(kvBlock, blocks);
        if (valueBlock) {
          const valueText = this.getTextFromRelationships(valueBlock, blocks);
          if (keyText && valueText) {
            forms[keyText] = valueText;
          }
        }
      }
    }
    
    return forms;
  }
  
  /**
   * Extract tables from Textract blocks
   * @param blocks Textract blocks
   * @returns Array of tables with cell data
   */
  private extractTables(blocks: any[]): any[] {
    const tables = [];
    
    // Find table blocks
    const tableBlocks = blocks.filter(block => 
      block.BlockType === 'TABLE');
      
    for (const tableBlock of tableBlocks) {
      const tableData: any = {
        rows: [],
        columnCount: tableBlock.RowCount,
        rowCount: tableBlock.ColumnCount
      };
      
      // Get cell blocks for this table
      if (tableBlock.Relationships) {
        const cellIds = tableBlock.Relationships
          .filter((rel: any) => rel.Type === 'CHILD')
          .flatMap((rel: any) => rel.Ids);
          
        const cellBlocks = blocks.filter(block => 
          cellIds.includes(block.Id) && block.BlockType === 'CELL');
          
        // Group cells by row
        const rowMap: Record<number, any[]> = {};
        
        for (const cell of cellBlocks) {
          const rowIndex = cell.RowIndex;
          const columnIndex = cell.ColumnIndex;
          
          if (!rowMap[rowIndex]) {
            rowMap[rowIndex] = [];
          }
          
          // Get cell content
          const cellText = this.getTextFromRelationships(cell, blocks);
          
          rowMap[rowIndex][columnIndex] = cellText || '';
        }
        
        // Convert row map to array
        for (let i = 1; i <= tableBlock.RowCount; i++) {
          if (rowMap[i]) {
            tableData.rows.push(rowMap[i]);
          }
        }
      }
      
      tables.push(tableData);
    }
    
    return tables;
  }
  
  /**
   * Extract possible entities from Textract results
   * @param blocks Textract blocks
   * @param forms Form key-value pairs
   * @returns Extracted entities
   */
  private extractEntities(blocks: any[], forms: Record<string, string>): Array<{type: string; text: string; confidence: number}> {
    const entities = [];
    
    // Look for date patterns in text
    const dateRegex = /\b\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}\b/g;
    const currencyRegex = /\$\d+(?:\.\d+)?|\d+(?:\.\d+)?\s?(?:USD|EUR|GBP)/g;
    
    // Check text blocks for patterns
    const textBlocks = blocks.filter(block => 
      block.BlockType === 'LINE' && block.Text);
      
    for (const block of textBlocks) {
      const text = block.Text;
      
      // Check for dates
      const dateMatches = text.match(dateRegex);
      if (dateMatches) {
        for (const match of dateMatches) {
          entities.push({
            type: 'date',
            text: match,
            confidence: block.Confidence / 100
          });
        }
      }
      
      // Check for currency
      const currencyMatches = text.match(currencyRegex);
      if (currencyMatches) {
        for (const match of currencyMatches) {
          entities.push({
            type: 'currency',
            text: match,
            confidence: block.Confidence / 100
          });
        }
      }
    }
    
    // Add form keys as potential entities
    for (const [key, value] of Object.entries(forms)) {
      // Check if key contains common entity names
      if (key.toLowerCase().includes('name')) {
        entities.push({
          type: 'person',
          text: value,
          confidence: 0.8 // Assuming form fields are generally reliable
        });
      } else if (key.toLowerCase().includes('company') || key.toLowerCase().includes('organization')) {
        entities.push({
          type: 'organization',
          text: value,
          confidence: 0.8
        });
      } else if (key.toLowerCase().includes('address')) {
        entities.push({
          type: 'location',
          text: value,
          confidence: 0.8
        });
      }
    }
    
    return entities;
  }
  
  /**
   * Extract keywords from text
   * @param text Text to extract keywords from
   * @returns Array of keywords
   */
  private extractKeywords(text: string): string[] {
    // Simple implementation - in a real app, use NLP
    const commonKeywords = [
      'invoice', 'receipt', 'payment', 'total', 
      'date', 'address', 'phone', 'email',
      'customer', 'order', 'product', 'service',
      'amount', 'tax', 'price', 'quantity'
    ];
    
    return commonKeywords.filter(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );
  }
  
  /**
   * Get text from block relationships
   * @param block Textract block
   * @param allBlocks All Textract blocks
   * @returns Extracted text
   */
  private getTextFromRelationships(block: any, allBlocks: any[]): string {
    if (!block.Relationships) {
      return '';
    }
    
    const childIds = block.Relationships
      .filter((rel: any) => rel.Type === 'CHILD')
      .flatMap((rel: any) => rel.Ids);
      
    const childBlocks = allBlocks.filter(b => 
      childIds.includes(b.Id) && b.Text);
      
    return childBlocks
      .map(b => b.Text)
      .filter(Boolean)
      .join(' ');
  }
  
  /**
   * Find value block for a key block
   * @param keyBlock Key block
   * @param allBlocks All Textract blocks
   * @returns Value block
   */
  private findValueBlock(keyBlock: any, allBlocks: any[]): any {
    if (!keyBlock.Relationships) {
      return null;
    }
    
    const valueIds = keyBlock.Relationships
      .filter((rel: any) => rel.Type === 'VALUE')
      .flatMap((rel: any) => rel.Ids);
      
    if (valueIds.length === 0) {
      return null;
    }
    
    return allBlocks.find(b => 
      valueIds.includes(b.Id) && 
      b.BlockType === 'KEY_VALUE_SET' &&
      b.EntityTypes &&
      b.EntityTypes.includes('VALUE'));
  }
} 