export interface IngestionDto {
  bucket: string;
  key: string;
  timestamp: string;
  metadata?: Record<string, any>;
} 