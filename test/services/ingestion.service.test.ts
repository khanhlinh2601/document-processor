import { S3Event } from 'aws-lambda';
import { IngestionService } from '../../src/services/ingestion.service';
import { SQSService } from '../../src/services/sqs.service';
import { Logger } from '../../src/utils/logger';

// Mock the SQS service and Logger
jest.mock('../../src/services/sqs.service');
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

describe('IngestionService', () => {
  let ingestionService: IngestionService;
  let mockSqsService: jest.Mocked<SQSService>;
  
  beforeEach(() => {
    mockSqsService = new SQSService('dummy-url') as jest.Mocked<SQSService>;
    mockSqsService.sendMessage = jest.fn().mockResolvedValue('mock-message-id');
    
    ingestionService = new IngestionService(mockSqsService);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  it('should process an S3 event and send a message to SQS', async () => {
    // Arrange
    const s3Event: S3Event = {
      Records: [
        {
          eventSource: 'aws:s3',
          eventTime: '2023-10-15T12:34:56.000Z',
          eventName: 'ObjectCreated:Put',
          s3: {
            bucket: {
              name: 'test-bucket'
            },
            object: {
              key: 'test-file.pdf',
              size: 1024
            }
          }
        } as any
      ]
    };
    
    // Act
    const messageIds = await ingestionService.processS3Event(s3Event);
    
    // Assert
    expect(mockSqsService.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockSqsService.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      bucketName: 'test-bucket',
      objectKey: 'test-file.pdf',
      metadata: expect.objectContaining({
        fileSize: '1024'
      })
    }));
    expect(messageIds).toEqual(['mock-message-id']);
  });
  
  it('should handle empty records gracefully', async () => {
    // Arrange
    const s3Event: S3Event = { Records: [] };
    
    // Act
    const messageIds = await ingestionService.processS3Event(s3Event);
    
    // Assert
    expect(mockSqsService.sendMessage).not.toHaveBeenCalled();
    expect(messageIds).toEqual([]);
  });
}); 