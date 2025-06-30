import { SqsService } from '../infrastructure/sqs/sqs.service';
import { IngestionDto } from '../shared/dtos/ingestion.dto';

export class IngestionService {
  constructor(private readonly sqsService: SqsService) {}

  async sendIngestionMessage(dto: IngestionDto): Promise<void> {
    // TODO: Implement logic to serialize and send message to SQS
    await this.sqsService.sendMessage(JSON.stringify(dto));
  }
} 