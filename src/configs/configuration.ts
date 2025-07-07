export default () => ({
  awsRegion: process.env.AWS_REGION,
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  s3Bucket: process.env.S3_BUCKET,
  sqsQueueUrl: process.env.SQS_QUEUE_URL,
  sqsDlqUrl: process.env.SQS_DLQ_URL,
}); 