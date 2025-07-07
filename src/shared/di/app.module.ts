import { Module } from '@nestjs/common';
import { MessageQueueModule } from './message-queue.module';
import { DocumentsModule } from './documents.module';
import { TextractModule } from './textract.module';

/**
 * Main application module that brings together all feature modules
 */
@Module({
  imports: [
    MessageQueueModule,
    DocumentsModule,
    TextractModule,
  ],
  exports: [
    MessageQueueModule,
    DocumentsModule,
    TextractModule,
  ],
})
export class AppModule {} 