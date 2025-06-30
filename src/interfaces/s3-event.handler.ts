import { SqsService } from '../infrastructure/sqs/sqs.service';
import { IngestionService } from '../application/ingestion.service';
import { parseS3Event } from '../shared/utils/s3-event.util';
import { IngestionDto } from '../shared/dtos/ingestion.dto';

// Define a minimal S3 event type
interface S3EventRecord {
  s3: {
    bucket: { name: string };
    object: { key: string };
  };
  eventTime?: string;
}

interface S3Event {
  Records: S3EventRecord[];
}

// Simple config service for Lambda (mimics NestJS ConfigService)
class LambdaConfigService {
  get(key: string): string | undefined {
    return process.env[key];
  }
}

const configService = new LambdaConfigService() as any;
const sqsService = new SqsService(configService);
const ingestionService = new IngestionService(sqsService);

export const handler = async (event: S3Event): Promise<{ statusCode: number; body: string }> => {
  const ingestionDtos: IngestionDto[] = parseS3Event(event);
  for (const dto of ingestionDtos) {
    await ingestionService.sendIngestionMessage(dto);
  }
  return { statusCode: 200, body: 'Messages sent to SQS' };
}; 