import { Module } from '@nestjs/common';
import { TextractService } from '../../services/textract/textract.service';
import { TextractNotificationService } from '../../services/textract/textract-notification.service';
import { ITextractService } from '../../services/textract/textract.interface';
import { ITextractNotificationService } from '../../services/textract/textract-notification.interface';
import { TOKENS } from './tokens';
import { LogContext } from '../logger/logger';

/**
 * Module for Textract document processing services
 */
@Module({
  providers: [
    {
      provide: TOKENS.TEXTRACT_SERVICE,
      useFactory: () => {
        return (logContext?: LogContext) => {
          return new TextractService(logContext);
        };
      },
    },
    {
      provide: TOKENS.TEXTRACT_NOTIFICATION_SERVICE,
      useFactory: () => {
        return (logContext?: LogContext) => {
          return new TextractNotificationService(logContext);
        };
      },
    },
  ],
  exports: [
    TOKENS.TEXTRACT_SERVICE,
    TOKENS.TEXTRACT_NOTIFICATION_SERVICE
  ],
})
export class TextractModule {}
