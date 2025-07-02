import { 
  SQSClient, 
  SendMessageCommand,
  SendMessageCommandInput 
} from '@aws-sdk/client-sqs';
import { Logger } from '../utils/logger';

export class SQSService {
  private client: SQSClient;
  private queueUrl: string;
  private logger: Logger;

  constructor(queueUrl: string, region: string = 'us-east-1') {
    this.client = new SQSClient({ region });
    this.queueUrl = queueUrl;
    this.logger = new Logger('SQSService');
  }

  async sendMessage<T>(message: T): Promise<string> {
    const params: SendMessageCommandInput = {
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        'MessageType': {
          DataType: 'String',
          StringValue: 'IngestionMessage'
        }
      }
    };

    try {
      const command = new SendMessageCommand(params);
      this.logger.debug('Sending message to SQS', { queueUrl: this.queueUrl });
      const response = await this.client.send(command);
      this.logger.debug('Message sent successfully', { messageId: response.MessageId });
      return response.MessageId || '';
    } catch (error) {
      this.logger.error('Error sending message to SQS', error);
      throw error;
    }
  }
} 