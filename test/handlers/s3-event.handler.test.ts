import { S3Event, Context, Callback } from 'aws-lambda';
import { handler } from '../../src/handlers/s3-event.handler';
import { SQSService } from '../../src/services/sqs.service';
import { IngestionService } from '../../src/services/ingestion.service';
import { environment, setEnvironmentForTesting } from '../../src/config/environment';
import { Logger } from '../../src/utils/logger';

// Mocks
jest.mock('../../src/services/sqs.service');
jest.mock('../../src/services/ingestion.service');
jest.mock('../../src/utils/logger', () => {
  return {
    Logger: jest.fn().mockImplementation(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    })),
    LogLevel: {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    }
  };
});

// Add static methods to Logger mock
(Logger as any).initializeFromEnvironment = jest.fn();
(Logger as any).setLogLevel = jest.fn();

describe('S3 Event Handler', () => {
  let mockContext: Context;
  let mockCallback: Callback;
  const testQueueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue';

  beforeEach(() => {
    // Set up environment
    setEnvironmentForTesting({
      aws: {
        region: 'us-east-1',
        sqs: {
          queueUrl: testQueueUrl
        }
      },
      logger: {
        level: 'INFO'
      }
    });
    
    // Mock implementation for IngestionService
    (IngestionService as jest.Mock).mockImplementation(() => ({
      processS3Event: jest.fn().mockResolvedValue(['message-id-1', 'message-id-2'])
    }));

    // Mock Lambda context and callback
    mockContext = {} as Context;
    mockCallback = jest.fn();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    // Reset environment
    setEnvironmentForTesting({
      aws: {
        region: 'us-east-1',
        sqs: {
          queueUrl: ''
        }
      },
      logger: {
        level: 'INFO'
      }
    });
  });
  
  it('should process S3 events and return message IDs', async () => {
    // Arrange
    const s3Event: S3Event = {
      Records: [
        {
          eventSource: 'aws:s3',
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'test-object.pdf', size: 1024 }
          }
        } as any
      ]
    };
    
    // Act
    const result = await handler(s3Event, mockContext, mockCallback);
    
    // Assert
    expect(SQSService).toHaveBeenCalledWith(
      testQueueUrl,
      expect.any(String)
    );
    expect(IngestionService).toHaveBeenCalledWith(expect.any(SQSService));
    expect(result).toEqual({
      messageIds: ['message-id-1', 'message-id-2']
    });
  });
  
  it('should throw an error if SQS queue URL is not defined', async () => {
    // Arrange
    // Set empty queue URL explicitly for this test
    setEnvironmentForTesting({
      aws: {
        region: 'us-east-1',
        sqs: {
          queueUrl: ''
        }
      },
      logger: {
        level: 'INFO'
      }
    });
    
    const s3Event: S3Event = { Records: [] };
    
    // Act & Assert
    await expect(handler(s3Event, mockContext, mockCallback)).rejects.toThrow(
      'SQS_QUEUE_URL environment variable is not defined'
    );
  });
}); 