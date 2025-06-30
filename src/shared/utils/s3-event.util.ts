import { IngestionDto } from '../dtos/ingestion.dto';

export function parseS3Event(event: any): IngestionDto[] {
  if (!event.Records) return [];
  return event.Records.map((record: any) => ({
    bucket: record.s3.bucket.name,
    key: record.s3.object.key,
    timestamp: record.eventTime || new Date().toISOString(),
    metadata: {}, // Add more extraction if needed
  }));
} 