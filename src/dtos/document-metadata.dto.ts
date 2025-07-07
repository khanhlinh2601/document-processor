/**
 * LLM processing result structure
 */
export interface LLMProcessingResult {
  summary: string;
  entities: Array<{
    type: string;
    text: string;
    confidence: number;
  }>;
  sentiment: string;
  keywords: string[];
  processingTime: number;
  textractData?: {
    forms: Record<string, string>;
    tables: any[];
    pageCount: number;
  };
}

export interface DocumentMetadata {
  documentId: string;  // Primary key
  timestamp: string;   // Sort key
  bucket: string;      // S3 bucket name
  key: string;         // S3 object key
  fileType: string;    // Type/extension of document
  fileSize: number;    // Size of document in bytes
  status: string;      // Processing status
  createdAt: string;   // Creation timestamp
  updatedAt: string;   // Last update timestamp
  llmResults?: LLMProcessingResult;    // LLM processing results
  errorDetails?: string; // Error details if processing failed
}

export enum DocumentStatus {
  METADATA_STORED = 'METADATA_STORED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  ERROR = 'ERROR'
} 