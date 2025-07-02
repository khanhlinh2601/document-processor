# Document Processor Architecture

## Architecture Diagram

```mermaid
graph TD
    Client[Client] -->|Upload Document| API[API Gateway]
    API -->|Forward Request| UploadLambda[Upload Lambda]
    UploadLambda -->|Store Document| S3[S3 Bucket]
    S3 -->|Object Created Event| S3EventLambda[S3 Event Lambda]
    S3EventLambda -->|Send Message| SQS[SQS Queue]
    SQS -->|Trigger| ConsumerLambda[Consumer Lambda]
    ConsumerLambda -->|Read Document| S3
    ConsumerLambda -->|Process Document| ConsumerLambda
    SQS -->|Failed Messages| DLQ[Dead Letter Queue]
    
    classDef aws fill:#FF9900,stroke:#232F3E,color:#232F3E;
    class S3,SQS,DLQ,API aws;
    classDef lambda fill:#6BAFBD,stroke:#232F3E,color:#232F3E;
    class UploadLambda,S3EventLambda,ConsumerLambda lambda;
    classDef client fill:#D9DDDC,stroke:#232F3E,color:#232F3E;
    class Client client;
```

## Component Details

### API Gateway
- Handles HTTP requests for document uploads
- Supports multipart/form-data for file uploads

### Upload Lambda
- Processes upload requests
- Stores documents in S3 bucket
- Returns upload confirmation to client

### S3 Bucket
- Stores uploaded documents
- Triggers events on document creation

### S3 Event Lambda
- Triggered by S3 ObjectCreated events
- Creates ingestion tasks
- Sends messages to SQS queue

### SQS Queue
- Decouples document ingestion from processing
- Provides buffering and retry capabilities
- Routes failed messages to Dead Letter Queue

### Consumer Lambda
- Processes documents from the queue
- Reads documents from S3
- Implements document processing logic

### Dead Letter Queue
- Stores failed messages for debugging
- Allows manual reprocessing of failed messages 