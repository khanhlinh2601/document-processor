import { Module } from '@nestjs/common';
import { MessageQueueModule } from './message-queue.module';
import { DocumentsModule } from './documents.module';

/**
 * Main application module that brings together all feature modules
 */
@Module({
  imports: [
    MessageQueueModule,
    DocumentsModule,
  ],
  exports: [
    MessageQueueModule,
    DocumentsModule,
  ],
})
export class AppModule {} 