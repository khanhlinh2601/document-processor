# Document Processor

A serverless document processing pipeline built with AWS CDK, Lambda, S3, and SQS.

## Architecture

This project implements a complete serverless document processing pipeline:

1. **Upload API**: API Gateway + Lambda for uploading documents to S3
2. **S3 Trigger**: Lambda function triggered by S3 events that sends messages to SQS
3. **Processing Queue**: SQS queue for document processing tasks
4. **Consumer**: Lambda function that processes messages from the SQS queue

## Prerequisites

- Node.js 18.x or later
- AWS CLI configured with appropriate credentials
- AWS CDK v2 installed (`npm install -g aws-cdk`)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Build the TypeScript code:

```bash
npm run build
```

3. Bootstrap your AWS environment (if you haven't already):

```bash
cdk bootstrap
```

## Deployment

Deploy the entire stack:

```bash
cdk deploy
```

After deployment, the CDK will output:
- API URL for document uploads
- S3 bucket name for document storage
- SQS queue URL for document ingestion
- Dead letter queue URL for failed messages

## Testing the Pipeline

1. Upload a document using the API:

```bash
curl -X POST \
  -F "file=@/path/to/your/document.pdf" \
  https://your-api-id.execute-api.region.amazonaws.com/prod/upload
```

2. The document will be stored in S3, triggering the S3 event Lambda
3. The S3 event Lambda will send a message to SQS
4. The SQS consumer Lambda will process the message

## Monitoring

You can monitor the pipeline using AWS CloudWatch:

- Lambda function logs
- SQS metrics
- S3 bucket metrics

## Clean Up

To remove all resources:

```bash
cdk destroy
```

## Development

### Project Structure

- `bin/` - CDK app entry point
- `lib/` - CDK stack definition
- `src/` - Application code
  - `handlers/` - Lambda function handlers
  - `services/` - Business logic
  - `models/` - Data models
  - `utils/` - Utilities
  - `infrastructure/` - Infrastructure constructs

### Adding a New Lambda Function

1. Create a new handler in `src/handlers/`
2. Add the Lambda to the stack in `lib/document-processor-stack.ts`
3. Configure appropriate permissions and event sources

---

# Original Documentation

## Project Structure

```
src/
├── main.ts                         # Lambda entry point
├── app.module.ts                  # Root module
├── config/                        # Configuration files
├── interfaces/                    # Controllers (HTTP or Lambda handlers)
├── application/                   # Use cases, business logic
├── domain/                        # Entities, domain models
├── infrastructure/
│   ├── s3/                        # S3 service wrapper
│   └── sqs/                       # SQS service wrapper
└── shared/                        # Shared DTOs, utils, interceptors
```

## Environment Setup

Copy `.env.example` to `.env` and fill in your AWS credentials, S3 bucket, and SQS queue URLs.

## Build & Deploy

- Build: `npm run build`
- Test: `npm run test`
- Deploy: Use AWS Lambda with the output in `dist/` or integrate with the Serverless Framework/CDK.

## Lambda Handlers

- `httpHandler` (API Gateway proxy)
- `SqsEventHandler` (SQS event)

## AWS Integration

- S3: Upload and read files
- SQS: Send and consume messages (with DLQ support)

## Extending

- Add new features in a feature-first manner under `src/`
- Use Dependency Injection for all services
- Use DTOs and validation for all inputs

# Lambda Upload to S3 (TypeScript)

This project is a clean, modular AWS Lambda function (TypeScript) for uploading one or more base64-encoded files to Amazon S3.

## 🛠️ Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Set environment variables:**
   - `AWS_REGION` (e.g., `us-east-1`)
   - `S3_BUCKET_NAME` (your S3 bucket)
   - (If running locally, also set AWS credentials via environment or AWS CLI)

## 🏗️ Build

```bash
npm run build
```

## 🚀 Local Test

You can test the Lambda handler locally using `ts-node`:

```bash
AWS_REGION=us-east-1 S3_BUCKET_NAME=your-bucket-name ts-node src/interfaces/upload.handler.ts
```

Or invoke with a mock event:

```bash
npx ts-node -e 'require("./src/interfaces/upload.handler").handler(require("./src/shared/event.json"))'
```

## 📦 Example Input

```
{
  "files": [
    {
      "fileName": "doc1.pdf",
      "contentType": "application/pdf",
      "base64": "JVBERi0xLjMKJ... (truncated)"
    },
    {
      "fileName": "image1.jpg",
      "contentType": "image/jpeg",
      "base64": "/9j/4AAQSkZJR... (truncated)"
    }
  ]
}
```

## ✅ Example Output

```
{
  "success": true,
  "uploadedFiles": [
    {
      "key": "uploads/doc1.pdf",
      "url": "https://s3.amazonaws.com/my-bucket/uploads/doc1.pdf"
    },
    {
      "key": "uploads/image1.jpg",
      "url": "https://s3.amazonaws.com/my-bucket/uploads/image1.jpg"
    }
  ]
}
```

---

**Clean code, modular structure, and error handling included!** 