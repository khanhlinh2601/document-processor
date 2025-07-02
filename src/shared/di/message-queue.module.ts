import { Module } from '@nestjs/common';
import { SQSService } from '../../services/queue/sqs.service';
import { IMessageQueueService } from '../../services/queue/message-queue.interface';
import { TOKENS } from './tokens';

/**
 * Module for message queue services
 */
@Module({
  providers: [
    {
      provide: TOKENS.MESSAGE_QUEUE_SERVICE,
      useFactory: () => {
        // SQSService will use environment variables if no queueUrl is provided
        return (queueUrl?: string, logContext?: any) => {
          return new SQSService(queueUrl, logContext);
        };
      },
    },
  ],
  exports: [TOKENS.MESSAGE_QUEUE_SERVICE],
})
export class MessageQueueModule {} 