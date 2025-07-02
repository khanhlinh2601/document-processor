import { 
  SendMessageCommand,
  SendMessageCommandInput,
  ReceiveMessageCommand,
  ReceiveMessageCommandInput,
  DeleteMessageCommand,
  DeleteMessageCommandInput
} from '@aws-sdk/client-sqs';
import { Logger, LogContext } from '../../shared/logger/logger';
import { sqsClient } from '../../data/clients/sqs-client';
import { IMessageQueueService } from './message-queue.interface';
import { DocumentMessage } from '../../data/models/document-message.dto';
import { QueueError } from '../../shared/errors';
import { environment } from '../../shared/config/environment';

// SQS implementation of message queue service
export class SQSService implements IMessageQueueService {
  private queueUrl: string;
  private logger: Logger;

  constructor(queueUrl?: string, logContext?: LogContext) {
    // Use provided queueUrl or get from environment
    this.queueUrl = queueUrl || process.env.SQS_QUEUE_URL || environment.aws.sqs.queueUrl;
    
    if (!this.queueUrl) {
      throw new Error('QueueUrl is required for SQSService. Set SQS_QUEUE_URL environment variable or provide it in the constructor.');
    }
    
    this.logger = new Logger('SQSService', logContext);
  }

  async sendMessage<T>(message: T): Promise<string> {
    try {
      // Handle DocumentMessage instances specially
      if (message instanceof DocumentMessage) {
        // Validate the message first
        await message.validate();
      }
      
      const params: SendMessageCommandInput = {
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
        MessageAttributes: {
          'MessageType': {
            DataType: 'String',
            StringValue: message instanceof DocumentMessage ? 'DocumentMessage' : 'GenericMessage'
          },
          'Timestamp': {
            DataType: 'String',
            StringValue: new Date().toISOString()
          }
        }
      };

      const command = new SendMessageCommand(params);
      this.logger.debug('Sending message to SQS', { 
        queueUrl: this.queueUrl,
        messageType: message instanceof DocumentMessage ? 'DocumentMessage' : 'GenericMessage'
      });
      
      const response = await sqsClient.send(command);
      
      if (!response.MessageId) {
        throw new QueueError('Failed to get MessageId from SQS response', {
          queueUrl: this.queueUrl,
          response
        });
      }
      
      this.logger.debug('Message sent successfully', { messageId: response.MessageId });
      return response.MessageId;
    } catch (error) {
      this.logger.error('Error sending message to SQS', error, { queueUrl: this.queueUrl });
      throw new QueueError(
        `Failed to send message to SQS: ${error instanceof Error ? error.message : String(error)}`,
        { queueUrl: this.queueUrl, originalError: error }
      );
    }
  }
  
  async receiveMessages(maxMessages: number = 10): Promise<any[]> {
    const params: ReceiveMessageCommandInput = {
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: 5,
      MessageAttributeNames: ['All'],
      AttributeNames: ['All']
    };
    
    try {
      const command = new ReceiveMessageCommand(params);
      this.logger.debug('Receiving messages from SQS', { 
        queueUrl: this.queueUrl,
        maxMessages 
      });
      
      const response = await sqsClient.send(command);
      
      if (!response.Messages || response.Messages.length === 0) {
        this.logger.debug('No messages received from queue');
        return [];
      }
      
      this.logger.info(`Received ${response.Messages.length} messages`);
      
      // Parse and validate messages
      const parsedMessages = [];
      
      for (const message of response.Messages) {
        try {
          const messageType = message.MessageAttributes?.MessageType?.StringValue;
          
          if (messageType === 'DocumentMessage' && message.Body) {
            // Validate and parse as DocumentMessage
            const documentMessage = await DocumentMessage.fromJson(message.Body);
            parsedMessages.push({
              messageId: message.MessageId,
              receiptHandle: message.ReceiptHandle,
              body: documentMessage,
              attributes: message.Attributes,
              messageAttributes: message.MessageAttributes
            });
          } else {
            // Regular message
            parsedMessages.push({
              messageId: message.MessageId,
              receiptHandle: message.ReceiptHandle,
              body: message.Body ? JSON.parse(message.Body) : {},
              attributes: message.Attributes,
              messageAttributes: message.MessageAttributes
            });
          }
        } catch (error) {
          this.logger.error('Error parsing message', error, { 
            messageId: message.MessageId 
          });
          
          // Include the message anyway with raw body
          parsedMessages.push({
            messageId: message.MessageId,
            receiptHandle: message.ReceiptHandle,
            body: message.Body,
            attributes: message.Attributes,
            messageAttributes: message.MessageAttributes,
            parseError: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      return parsedMessages;
    } catch (error) {
      this.logger.error('Error receiving messages from SQS', error, { queueUrl: this.queueUrl });
      throw new QueueError(
        `Failed to receive messages from SQS: ${error instanceof Error ? error.message : String(error)}`,
        { queueUrl: this.queueUrl, originalError: error }
      );
    }
  }
  
  async deleteMessage(receiptHandle: string): Promise<boolean> {
    if (!receiptHandle) {
      throw new QueueError('ReceiptHandle is required to delete a message', {
        queueUrl: this.queueUrl
      });
    }
    
    const params: DeleteMessageCommandInput = {
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle
    };
    
    try {
      const command = new DeleteMessageCommand(params);
      this.logger.debug('Deleting message from SQS', { receiptHandle });
      
      await sqsClient.send(command);
      this.logger.debug('Message deleted successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Error deleting message from SQS', error, { 
        queueUrl: this.queueUrl,
        receiptHandle
      });
      
      throw new QueueError(
        `Failed to delete message from SQS: ${error instanceof Error ? error.message : String(error)}`,
        { queueUrl: this.queueUrl, receiptHandle, originalError: error }
      );
    }
  }
} 