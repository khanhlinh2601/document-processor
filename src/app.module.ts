import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3Module } from './infrastructure/s3/s3.module';
import { SqsModule } from './infrastructure/sqs/sqs.module';
import { ExampleHttpController } from './interfaces/example-http.controller';
import { SqsEventHandler } from './interfaces/sqs.handler';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    S3Module,
    SqsModule,
  ],
  controllers: [ExampleHttpController],
  providers: [SqsEventHandler],
})
export class AppModule {} 