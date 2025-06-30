import { Injectable, Logger } from '@nestjs/common';
import { SQSEvent, SQSHandler } from 'aws-lambda';

@Injectable()
export class SqsEventHandler {
  private readonly logger = new Logger(SqsEventHandler.name);

  public handler: SQSHandler = async (event) => {
    this.logger.log(`Received SQS event with ${event.Records.length} records`);
    // Example: process each record
    for (const record of event.Records) {
      this.logger.log(`Processing message: ${record.body}`);
      // ... business logic here ...
    }
    // No return value needed for SQSHandler
  };
} 