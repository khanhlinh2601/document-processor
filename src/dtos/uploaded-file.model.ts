/**
 * Represents an uploaded file from a multipart request
 */
export interface UploadedFile {
  /** The field name from the form */
  fieldname: string;
  
  /** The original filename */
  originalname: string;
  
  /** The MIME type of the file */
  mimetype: string;
  
  /** The file content as a buffer */
  buffer: Buffer;
  
  /** The size of the file in bytes */
  size: number;
} 