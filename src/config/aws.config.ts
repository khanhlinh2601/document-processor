export const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  s3Bucket: process.env.S3_BUCKET_NAME || 'my-bucket',
}; 