export interface IngestionMessage {
  bucketName: string;
  objectKey: string;
  timestamp: string;
  metadata?: Record<string, string>;
} 