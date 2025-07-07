import { S3Client } from '@aws-sdk/client-s3';
import { environment } from "../configs/environment"

/**
 * Creates and configures an S3 client
 * @returns Configured S3 client
 */
export const createS3Client = (): S3Client => {
  return new S3Client({
    region: environment.aws.region
  });
};

/**
 * Get the configured S3 client
 */
export const s3Client = createS3Client();