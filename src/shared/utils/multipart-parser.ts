import { APIGatewayProxyEvent } from 'aws-lambda';
import { UploadedFile } from '../../dtos/uploaded-file.model';
import { Logger } from '../../shared/logger/logger';

export class MultipartParser {
  private static logger = new Logger('MultipartParser');

  /**
   * Parse multipart/form-data from API Gateway event
   * 
   * @param event The API Gateway event
   * @returns An array of parsed files
   */
  static async parse(event: APIGatewayProxyEvent): Promise<UploadedFile[]> {
    if (!event.body) {
      this.logger.error('Request body is empty');
      throw new Error('Request body is empty');
    }

    if (!event.headers['content-type']?.includes('multipart/form-data')) {
      this.logger.error('Invalid content type', { contentType: event.headers['content-type'] });
      throw new Error('Content-Type must be multipart/form-data');
    }

    const boundary = this.extractBoundary(event.headers['content-type']);
    if (!boundary) {
      this.logger.error('Boundary not found in Content-Type header');
      throw new Error('Boundary not found in Content-Type header');
    }

    this.logger.debug('Parsing multipart/form-data', { boundary });

    // Decode the base64 body if it's base64 encoded
    const body = event.isBase64Encoded 
      ? Buffer.from(event.body, 'base64').toString('binary')
      : event.body;

    const parts = this.getParts(body, boundary);
    this.logger.debug(`Found ${parts.length} parts in request`);
    
    const files: UploadedFile[] = [];

    for (const part of parts) {
      const { headers, content } = this.parsePart(part);
      const contentDisposition = headers['content-disposition'];
      
      if (contentDisposition && contentDisposition.includes('filename=')) {
        const fieldname = this.extractFieldname(contentDisposition);
        const filename = this.extractFilename(contentDisposition);
        const contentType = headers['content-type'] || 'application/octet-stream';
        const buffer = Buffer.from(content, 'binary');

        this.logger.debug(`Parsed file from request`, { 
          fieldname, 
          filename, 
          contentType, 
          size: buffer.length 
        });

        files.push({
          fieldname,
          originalname: filename,
          mimetype: contentType,
          buffer,
          size: buffer.length,
        });
      }
    }

    this.logger.info(`Successfully parsed ${files.length} files from request`);
    return files;
  }

  private static extractBoundary(contentType: string): string | null {
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    return boundaryMatch ? boundaryMatch[1] || boundaryMatch[2] : null;
  }

  private static extractFieldname(contentDisposition: string): string {
    const nameMatch = contentDisposition.match(/name="([^"]+)"/i);
    return nameMatch ? nameMatch[1] : '';
  }

  private static extractFilename(contentDisposition: string): string {
    const filenameMatch = contentDisposition.match(/filename="([^"]+)"/i);
    return filenameMatch ? filenameMatch[1] : '';
  }

  private static getParts(body: string, boundary: string): string[] {
    const result: string[] = [];
    const boundaryChars = `--${boundary}`;
    
    // Split by boundary
    const parts = body.split(new RegExp(`${boundaryChars}(?:--)?\r\n?`));
    
    // Filter out empty parts and the last part (which is typically empty)
    for (let i = 1; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part && part.trim().length > 0) {
        result.push(part);
      }
    }
    
    return result;
  }

  private static parsePart(part: string): { headers: Record<string, string>, content: string } {
    const headerEndIndex = part.indexOf('\r\n\r\n');
    
    if (headerEndIndex === -1) {
      return { headers: {}, content: part };
    }
    
    const headersPart = part.substring(0, headerEndIndex);
    const content = part.substring(headerEndIndex + 4);
    
    const headers: Record<string, string> = {};
    const headerLines = headersPart.split('\r\n');
    
    for (const line of headerLines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const name = line.substring(0, colonIndex).trim().toLowerCase();
        const value = line.substring(colonIndex + 1).trim();
        headers[name] = value;
      }
    }
    
    return { headers, content };
  }
} 