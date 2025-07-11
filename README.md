# Document Processor

A serverless document processing pipeline built with AWS CDK, Lambda, S3, SQS, DynamoDB, Textract, and Bedrock.

## Architecture

This project implements a complete serverless document processing pipeline:

1. **Upload API**: API Gateway + Lambda for uploading documents to S3
2. **S3 Storage**: Stores documents and processed results
3. **Ingestion Queue**: SQS queue for document processing tasks
4. **Document Processor**: Lambda function that processes documents from S3 using Textract
5. **Textract Integration**: Service for document text extraction
6. **Classification**: Lambda function for document classification using Amazon Bedrock
7. **Knowledge Base**: Bedrock knowledge base for document search and retrieval
8. **Vector Search**: OpenSearch Serverless for vector embeddings storage

![Architecture Diagram](architecture.md)

## Prerequisites

- Node.js 20.x or later
- AWS CLI configured with appropriate credentials
- AWS CDK v2 installed (`npm install -g aws-cdk`)
- Permissions to create/manage AWS resources including S3, Lambda, SQS, DynamoDB, API Gateway, Textract, Bedrock, and OpenSearch Serverless

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
# Deploy to the default 'dev' environment
cdk deploy

# Deploy to a specific environment
cdk deploy --context stage=dev
```

After deployment, the CDK will output:
- API URL for document uploads
- S3 bucket name for document storage
- SQS queue URLs for document ingestion and classification

## Testing the Pipeline

1. Upload a document using the API:

```bash
curl -X POST \
  -F "file=@/path/to/your/document.pdf" \
  https://your-api-id.execute-api.region.amazonaws.com/prod/presigned-url/
```

2. The document will be stored in S3, triggering the ingestion pipeline
3. The document processor will extract text using Textract
4. The classification service will analyze and categorize the document
5. Document metadata and embeddings will be stored for search and retrieval


- FYI: You're running document processing from the examples/ folder with:
```bash
cd examples/ && node server.js
```

## Monitoring

You can monitor the pipeline using AWS CloudWatch:

- Lambda function logs (DocumentProcessor, UploadIngestion, TextractCompletion, Classification)
- SQS queue metrics (Ingestion, Classification)
- S3 bucket metrics
- DynamoDB metrics (Document Job Table)

## Clean Up

To remove all resources:

```bash
cdk destroy
```

## Development

### Project Structure

- `bin/` - CDK app entry point
- `infra/` - CDK infrastructure definitions
  - `constructs/` - CDK constructs for each service
- `src/` - Application code
  - `handlers/` - Lambda function handlers
  - `services/` - Business logic
  - `repositories/` - Data access layer
  - `clients/` - AWS service client wrappers
  - `dtos/` - Data transfer objects
  - `configs/` - Configuration
  - `shared/` - Utilities and shared code

### Adding a New Lambda Function

1. Create a new handler in `src/handlers/`
2. Create a new construct in `infra/constructs/`
3. Add the construct to the stack in `infra/constructs/document-processing-stack.ts`
4. Configure appropriate permissions and event sources 