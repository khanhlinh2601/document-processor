import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { S3UploadService, UploadedFile } from '../src/services/s3upload.service';

// Mock the AWS SDK
jest.mock('@aws-sdk/client-s3');

describe('S3UploadService', () => {
  let service: S3UploadService;
  
  // Save original env
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Setup test environment
    process.env.S3_BUCKET_NAME = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Create a new service instance for each test
    service = new S3UploadService();
    
    // Mock S3 client implementation
    (S3Client as jest.Mock).mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({})
    }));
  });
  
  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });
  
  describe('uploadFile', () => {
    it('should upload a file to S3 and return the result', async () => {
      // Arrange
      const testFile: UploadedFile = {
        fieldname: 'document',
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('test content'),
        size: 12
      };
      
      // Act
      const result = await service.uploadFile(testFile);
      
      // Assert
      expect(S3Client).toHaveBeenCalledWith({ region: 'us-east-1' });
      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        Bucket: 'test-bucket',
        Key: expect.stringContaining('test.pdf'),
        Body: testFile.buffer,
        ContentType: 'application/pdf'
      }));
      
      expect(result).toEqual({
        key: expect.stringContaining('test.pdf'),
        url: expect.stringContaining('test-bucket.s3.us-east-1.amazonaws.com'),
        filename: 'test.pdf'
      });
    });
  });
  
  describe('uploadFiles', () => {
    it('should upload multiple files to S3', async () => {
      // Arrange
      const testFiles: UploadedFile[] = [
        {
          fieldname: 'document1',
          originalname: 'test1.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.from('test content 1'),
          size: 14
        },
        {
          fieldname: 'document2',
          originalname: 'test2.txt',
          mimetype: 'text/plain',
          buffer: Buffer.from('test content 2'),
          size: 14
        }
      ];
      
      // Act
      const results = await service.uploadFiles(testFiles);
      
      // Assert
      expect(results.length).toBe(2);
      expect(results[0].filename).toBe('test1.pdf');
      expect(results[1].filename).toBe('test2.txt');
    });
  });
}); 