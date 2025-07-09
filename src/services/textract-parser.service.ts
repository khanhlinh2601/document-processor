import { Logger, LogContext } from '../shared/logger/logger';

export interface TextractBlock {
  Id: string;
  BlockType: string;
  Text?: string;
  Confidence?: number;
  Relationships?: {
    Type: string;
    Ids: string[];
  }[];
  Page?: number;
  EntityTypes?: string[];
  RowIndex?: number;
  ColumnIndex?: number;
  RowSpan?: number;
  ColumnSpan?: number;
  [key: string]: any;
}

export interface TextractForm {
  key: string;
  value: string;
  confidence: number;
}

export interface TextractTable {
  rows: string[][];
  confidence: number;
}

export interface ParsedDocument {
  text: string;
  forms: TextractForm[];
  tables: TextractTable[];
  blocks: TextractBlock[];
}

export class TextractParser {
  private logger: Logger;

  constructor(logContext?: LogContext) {
    this.logger = new Logger('TextractParser', logContext);
  }

  /**
   * Parse raw Textract JSON results into a structured format
   * @param textractResults Raw Textract results
   * @returns Parsed document structure
   */
  parseTextractResults(textractResults: any[]): ParsedDocument {
    try {
      this.logger.debug('Parsing Textract results', {
        pages: textractResults.length
      });

      // Combine all blocks from all pages
      const allBlocks: TextractBlock[] = [];
      for (const page of textractResults) {
        if (page.Blocks) {
          allBlocks.push(...page.Blocks);
        }
      }

      // Extract text, forms, and tables
      const text = this.extractText(allBlocks);
      const forms = this.extractForms(allBlocks);
      const tables = this.extractTables(allBlocks);

      this.logger.info('Successfully parsed Textract results', {
        blockCount: allBlocks.length,
        textLength: text.length,
        formCount: forms.length,
        tableCount: tables.length
      });

      return {
        text,
        forms,
        tables,
        blocks: allBlocks
      };
    } catch (error) {
      this.logger.error('Error parsing Textract results', error);
      throw error;
    }
  }

  /**
   * Extract human-readable text from Textract blocks
   * @param blocks Array of Textract blocks
   * @returns Concatenated text
   */
  private extractText(blocks: TextractBlock[]): string {
    // Get all LINE blocks and sort them by Page and then position
    const lineBlocks = blocks
      .filter(block => block.BlockType === 'LINE' && block.Text)
      .sort((a, b) => {
        if (a.Page !== b.Page) {
          return (a.Page || 0) - (b.Page || 0);
        }
        
        // Within the same page, sort by vertical position (top to bottom)
        const aTop = a.Geometry?.BoundingBox?.Top || 0;
        const bTop = b.Geometry?.BoundingBox?.Top || 0;
        if (Math.abs(aTop - bTop) > 0.01) { // Allow small vertical variance
          return aTop - bTop;
        }
        
        // If at similar vertical position, sort left to right
        const aLeft = a.Geometry?.BoundingBox?.Left || 0;
        const bLeft = b.Geometry?.BoundingBox?.Left || 0;
        return aLeft - bLeft;
      });

    // Concatenate text from all line blocks, separating by newlines
    let text = '';
    let currentPage = -1;
    for (const block of lineBlocks) {
      // Add page separators
      if (block.Page !== currentPage && currentPage !== -1) {
        text += '\n\n--- Page ' + block.Page + ' ---\n\n';
      }
      currentPage = block.Page || 0;
      
      text += (block.Text || '') + '\n';
    }

    return text;
  }

  /**
   * Extract form key-value pairs from Textract blocks
   * @param blocks Array of Textract blocks
   * @returns Array of form entries
   */
  private extractForms(blocks: TextractBlock[]): TextractForm[] {
    const forms: TextractForm[] = [];
    const keyMap = new Map<string, TextractBlock>();
    
    // First pass: collect all KEY_VALUE_SET blocks
    for (const block of blocks) {
      if (block.BlockType === 'KEY_VALUE_SET') {
        if (block.EntityTypes?.includes('KEY')) {
          keyMap.set(block.Id, block);
        }
      }
    }
    
    // Second pass: match keys with values
    for (const block of blocks) {
      if (block.BlockType === 'KEY_VALUE_SET' && block.EntityTypes?.includes('VALUE')) {
        // Find the key that references this value
        for (const [keyId, keyBlock] of keyMap.entries()) {
          const valueIds = keyBlock.Relationships?.find(rel => rel.Type === 'VALUE')?.Ids || [];
          if (valueIds.includes(block.Id)) {
            // Extract the text for the key
            const keyText = this.getTextFromRelationship(blocks, keyBlock);
            // Extract the text for the value
            const valueText = this.getTextFromRelationship(blocks, block);
            
            forms.push({
              key: keyText,
              value: valueText,
              confidence: Math.min(keyBlock.Confidence || 0, block.Confidence || 0)
            });
            
            break;
          }
        }
      }
    }
    
    return forms;
  }

  /**
   * Extract tables from Textract blocks
   * @param blocks Array of Textract blocks
   * @returns Array of table structures
   */
  private extractTables(blocks: TextractBlock[]): TextractTable[] {
    const tables: TextractTable[] = [];
    const tableBlocks = blocks.filter(block => block.BlockType === 'TABLE');
    
    for (const tableBlock of tableBlocks) {
      const tableMatrix: string[][] = [];
      const cellBlocks = blocks.filter(block => 
        block.BlockType === 'CELL' && 
        tableBlock.Relationships?.some(rel => 
          rel.Type === 'CHILD' && rel.Ids.includes(block.Id)
        )
      );
      
      // Find table dimensions
      let maxRow = 0;
      let maxCol = 0;
      for (const cell of cellBlocks) {
        maxRow = Math.max(maxRow, (cell.RowIndex || 0) + (cell.RowSpan || 1) - 1);
        maxCol = Math.max(maxCol, (cell.ColumnIndex || 0) + (cell.ColumnSpan || 1) - 1);
      }
      
      // Initialize table matrix
      for (let i = 0; i < maxRow; i++) {
        tableMatrix.push(new Array(maxCol).fill(''));
      }
      
      // Populate table cells
      for (const cell of cellBlocks) {
        const rowIdx = (cell.RowIndex || 1) - 1; // 0-indexed
        const colIdx = (cell.ColumnIndex || 1) - 1; // 0-indexed
        const cellText = this.getTextFromRelationship(blocks, cell);
        
        // Ensure row exists
        while (tableMatrix.length <= rowIdx) {
          tableMatrix.push(new Array(maxCol).fill(''));
        }
        
        // Fill cell and handle spanning
        for (let r = 0; r < (cell.RowSpan || 1); r++) {
          for (let c = 0; c < (cell.ColumnSpan || 1); c++) {
            // Only set the main cell, mark spans with reference
            if (r === 0 && c === 0) {
              tableMatrix[rowIdx][colIdx] = cellText;
            }
          }
        }
      }
      
      tables.push({
        rows: tableMatrix,
        confidence: tableBlock.Confidence || 0
      });
    }
    
    return tables;
  }

  /**
   * Get the text content from a block's relationships
   * @param blocks All blocks
   * @param block The block with relationships
   * @returns Extracted text
   */
  private getTextFromRelationship(blocks: TextractBlock[], block: TextractBlock): string {
    const childIds = block.Relationships?.find(rel => rel.Type === 'CHILD')?.Ids || [];
    
    if (childIds.length === 0) return '';
    
    // Get WORD blocks that are children of this block
    const childBlocks = blocks.filter(b => 
      childIds.includes(b.Id) && 
      (b.BlockType === 'WORD' || b.BlockType === 'LINE')
    );
    
    // Sort by position (top to bottom, left to right)
    childBlocks.sort((a, b) => {
      const aTop = a.Geometry?.BoundingBox?.Top || 0;
      const bTop = b.Geometry?.BoundingBox?.Top || 0;
      if (Math.abs(aTop - bTop) > 0.01) { // Allow small vertical variance
        return aTop - bTop;
      }
      
      const aLeft = a.Geometry?.BoundingBox?.Left || 0;
      const bLeft = b.Geometry?.BoundingBox?.Left || 0;
      return aLeft - bLeft;
    });
    
    // Concatenate text from child blocks
    return childBlocks.map(b => b.Text || '').join(' ').trim();
  }
} 