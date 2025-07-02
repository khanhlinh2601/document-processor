import { Module } from '@nestjs/common';
import { IngestionService } from '../../services/documents/ingestion.service';
import { IIngestionService } from '../../services/documents/ingestion.service';
import { IMessageQueueService } from '../../services/queue/message-queue.interface';
import { TOKENS } from './tokens';
import { MessageQueueModule } from './message-queue.module';

/**
 * Module for document processing services
 */
@Module({
  imports: [MessageQueueModule],
  providers: [
    {
      provide: TOKENS.INGESTION_SERVICE,
      useFactory: () => {
        return (messageQueueService: IMessageQueueService, logContext?: any) => {
          return new IngestionService(messageQueueService, logContext);
        };
      },
    },
  ],
  exports: [TOKENS.INGESTION_SERVICE],
})
export class DocumentsModule {} 