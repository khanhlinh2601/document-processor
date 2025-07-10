import { 
  GetObjectCommand, 
  ListObjectsV2Command, 
  PutObjectCommand, 
  DeleteObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { s3Client } from '../clients/s3-client';
import { Logger } from '../shared/logger/logger';
import { environment } from '../configs/environment';

export interface KnowledgeBaseEntry {
  id: string;
  title: string;
  content: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export class KnowledgeBaseRepository {
  private s3Client: S3Client;
  private bucketName: string;
  private prefix: string;
  private logger: Logger;

  constructor(client: S3Client = s3Client) {
    this.s3Client = client;
    this.bucketName = process.env.DOCUMENT_BUCKET || environment.aws.s3.bucketName;
    this.prefix = process.env.FORMATTED_PREFIX || 'formatted/';
    this.logger = new Logger('KnowledgeBaseRepository');
    
    this.logger.debug('Initialized KnowledgeBaseRepository', {
      bucket: this.bucketName,
      prefix: this.prefix
    });
  }

  /**
   * Store a knowledge base entry in S3
   * @param entry The knowledge base entry to store
   * @returns The stored entry with its S3 location
   */
  async storeEntry(entry: KnowledgeBaseEntry): Promise<KnowledgeBaseEntry> {
    try {
      const key = `${this.prefix}${entry.id}.json`;
      
      this.logger.debug('Storing knowledge base entry in S3', { 
        bucket: this.bucketName, 
        key,
        entryId: entry.id
      });

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: JSON.stringify(entry),
        ContentType: 'application/json',
        Metadata: {
          'entry-id': entry.id,
          'title': encodeURIComponent(entry.title),
          'created-at': entry.createdAt,
          'updated-at': entry.updatedAt
        },
      });

      await this.s3Client.send(command);
      
      this.logger.info('Successfully stored knowledge base entry in S3', { 
        bucket: this.bucketName, 
        key,
        entryId: entry.id
      });

      return entry;
    } catch (error) {
      this.logger.error('Error storing knowledge base entry in S3', error, {
        entryId: entry.id
      });
      throw error;
    }
  }

  /**
   * Get a knowledge base entry from S3
   * @param id The ID of the entry to retrieve
   * @returns The retrieved knowledge base entry or null if not found
   */
  async getEntry(id: string): Promise<KnowledgeBaseEntry | null> {
    try {
      const key = `${this.prefix}${id}.json`;
      
      this.logger.debug('Getting knowledge base entry from S3', { 
        bucket: this.bucketName, 
        key,
        entryId: id
      });

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        return null;
      }
      
      const bodyContents = await response.Body.transformToString();
      const entry = JSON.parse(bodyContents) as KnowledgeBaseEntry;
      
      this.logger.info('Successfully retrieved knowledge base entry from S3', { 
        bucket: this.bucketName, 
        key,
        entryId: id
      });

      return entry;
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        this.logger.warn('Knowledge base entry not found in S3', { 
          bucket: this.bucketName, 
          entryId: id
        });
        return null;
      }
      
      this.logger.error('Error getting knowledge base entry from S3', error, {
        entryId: id
      });
      throw error;
    }
  }

  /**
   * List all knowledge base entries
   * @returns Array of knowledge base entries
   */
  async listEntries(): Promise<KnowledgeBaseEntry[]> {
    try {
      this.logger.debug('Listing knowledge base entries from S3', { 
        bucket: this.bucketName, 
        prefix: this.prefix
      });

      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.prefix
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Contents || response.Contents.length === 0) {
        return [];
      }
      
      const entries: KnowledgeBaseEntry[] = [];
      
      for (const object of response.Contents) {
        if (!object.Key) continue;
        
        try {
          const getCommand = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: object.Key
          });
          
          const getResponse = await this.s3Client.send(getCommand);
          
          if (getResponse.Body) {
            const bodyContents = await getResponse.Body.transformToString();
            const entry = JSON.parse(bodyContents) as KnowledgeBaseEntry;
            entries.push(entry);
          }
        } catch (error) {
          this.logger.error('Error retrieving knowledge base entry', error, {
            key: object.Key
          });
          // Continue with other entries
        }
      }
      
      this.logger.info('Successfully listed knowledge base entries from S3', { 
        bucket: this.bucketName, 
        prefix: this.prefix,
        count: entries.length
      });

      return entries;
    } catch (error) {
      this.logger.error('Error listing knowledge base entries from S3', error, {
        bucket: this.bucketName,
        prefix: this.prefix
      });
      throw error;
    }
  }

  /**
   * Delete a knowledge base entry
   * @param id The ID of the entry to delete
   */
  async deleteEntry(id: string): Promise<void> {
    try {
      const key = `${this.prefix}${id}.json`;
      
      this.logger.debug('Deleting knowledge base entry from S3', { 
        bucket: this.bucketName, 
        key,
        entryId: id
      });

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.s3Client.send(command);
      
      this.logger.info('Successfully deleted knowledge base entry from S3', { 
        bucket: this.bucketName, 
        key,
        entryId: id
      });
    } catch (error) {
      this.logger.error('Error deleting knowledge base entry from S3', error, {
        entryId: id
      });
      throw error;
    }
  }
} 