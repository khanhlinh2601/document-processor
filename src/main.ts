import { Handler, Context, Callback, APIGatewayProxyEvent } from 'aws-lambda';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import express from 'express';
import { SqsEventHandler } from './interfaces/sqs.handler';
import { handler } from './interfaces/upload.handler';

let cachedServer;

async function bootstrapServer() {
  if (!cachedServer) {
    const expressApp = express();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
    await app.init();
    cachedServer = expressApp;
  }
  return cachedServer;
}

export const httpHandler: Handler = async (
  event,
  context,
  callback
) => {
  const server = await bootstrapServer();
  return server(event, context, callback);
};

export { SqsEventHandler } from './interfaces/sqs.handler';
export { handler }; 