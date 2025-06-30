import { Injectable } from '@nestjs/common';
import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { ConfigService } from '@nestjs/config';
import { AwsCredentialIdentity } from '@aws-sdk/types';

@Injectable()
export class SqsService {
  private readonly sqs;
  private readonly queueUrl;
  private readonly dlqUrl;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get('AWS_REGION');
    const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY');
    const queueUrl = this.configService.get('SQS_QUEUE_URL');
    const dlqUrl = this.configService.get('SQS_DLQ_URL');
    if (!region || !accessKeyId || !secretAccessKey || !queueUrl || !dlqUrl) {
      throw new Error('Missing AWS SQS configuration in environment variables');
    }
    this.sqs = new SQSClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      } as AwsCredentialIdentity,
    });
    this.queueUrl = queueUrl;
    this.dlqUrl = dlqUrl;
  }

  async sendMessage(messageBody, useDLQ = false) {
    const command = new SendMessageCommand({
      QueueUrl: useDLQ ? this.dlqUrl : this.queueUrl,
      MessageBody: messageBody,
    });
    return this.sqs.send(command);
  }

  async receiveMessages(maxNumberOfMessages = 1) {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: maxNumberOfMessages,
    });
    return this.sqs.send(command);
  }

  async deleteMessage(receiptHandle) {
    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle,
    });
    return this.sqs.send(command);
  }
} 