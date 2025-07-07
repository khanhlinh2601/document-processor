import { DocumentMessage } from './document-message.dto';

export interface SQSMessageAttributes {
  ApproximateReceiveCount: string;
  SentTimestamp: string;
  SenderId: string;
  ApproximateFirstReceiveTimestamp: string;
}

export interface SQSRecord {
  messageId: string;
  receiptHandle: string;
  body: string; // JSON string of DocumentMessage
  attributes: SQSMessageAttributes;
  messageAttributes: Record<string, any>;
  md5OfBody: string;
  eventSource: string;
  eventSourceARN: string;
  awsRegion: string;
}

export interface SQSEvent {
  Records: SQSRecord[];
}

export interface ParsedSQSRecord extends Omit<SQSRecord, 'body'> {
  body: DocumentMessage;
} 