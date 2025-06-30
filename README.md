# Document Processor (NestJS Clean Architecture for AWS Lambda)

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