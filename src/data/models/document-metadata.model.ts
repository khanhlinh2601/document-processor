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
}

export enum DocumentStatus {
  METADATA_STORED = 'METADATA_STORED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  ERROR = 'ERROR'
} 