import { IsString, IsNotEmpty, IsOptional, IsObject, ValidateNested, validate } from 'class-validator';
import { ValidationError } from '../shared/errors/app-errors';

/**
 * Document metadata class with validation
 */
export class DocumentMetadata {
  @IsString()
  @IsOptional()
  eventTime?: string;

  @IsString()
  @IsOptional()
  eventName?: string;

  @IsString()
  @IsOptional()
  fileSize?: string;

  @IsString()
  @IsOptional()
  contentType?: string;

  // Allow additional properties
  [key: string]: string | undefined;

  constructor(data?: Record<string, string>) {
    if (data) {
      Object.assign(this, data);
    }
  }
}

/**
 * Unified document message DTO used throughout the system
 * for consistent message format between services.
 * 
 * Includes runtime validation using class-validator
 */
export class DocumentMessage {
  @IsString()
  @IsNotEmpty()
  bucket: string;

  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  timestamp: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  metadata?: DocumentMetadata;

  constructor(data?: Partial<DocumentMessage>) {
    if (data) {
      this.bucket = data.bucket || '';
      this.key = data.key || '';
      this.timestamp = data.timestamp || new Date().toISOString();
      
      if (data.metadata) {
        this.metadata = new DocumentMetadata(data.metadata);
      }
    }
  }

  /**
   * Validate the document message
   * @throws ValidationError if validation fails
   */
  async validate(): Promise<void> {
    const errors = await validate(this);
    
    if (errors.length > 0) {
      throw new ValidationError(
        'Document message validation failed',
        errors,
        { message: this }
      );
    }
  }

  /**
   * Create a DocumentMessage from plain object with validation
   * @param data Plain object data
   * @returns Validated DocumentMessage
   */
  static async fromObject(data: Record<string, any>): Promise<DocumentMessage> {
    const message = new DocumentMessage(data);
    await message.validate();
    return message;
  }

  /**
   * Create a DocumentMessage from JSON string with validation
   * @param json JSON string
   * @returns Validated DocumentMessage
   */
  static async fromJson(json: string): Promise<DocumentMessage> {
    try {
      const data = JSON.parse(json);
      return DocumentMessage.fromObject(data);
    } catch (error) {
      throw new ValidationError(
        'Invalid JSON for document message',
        [],
        { error, json }
      );
    }
  }
}