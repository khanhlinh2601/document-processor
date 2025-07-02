# Project: SQS Consumer → DynamoDB Metadata Storage (AWS Lambda, TypeScript)

## 🧩 Goal

Implement a clean, modular Lambda function in **TypeScript** that consumes messages from **Amazon SQS** and stores document metadata in **Amazon DynamoDB**.

---

## 🧱 Architecture

### Lambda: SQS Consumer (Step 3)

- Triggered by messages in the **SQS queue** (from ingestion trigger Lambda).
- Processes document metadata from the message.
- Stores metadata in a **DynamoDB table** with:
  - Primary key: A unique identifier (generated or from metadata)
  - Sort key: Timestamp or other relevant field
  - Document attributes: file path, bucket name, file size, file type, etc.

### Amazon DynamoDB (Step 4)

- Stores document metadata in a structured format.
- Enables efficient querying for document management.
- Scales automatically with the volume of processed documents.

---

## 📦 Technologies

- **TypeScript**
- **AWS Lambda**
- **Amazon SQS (trigger source)**
- **Amazon DynamoDB (data store)**
- **AWS SDK v3**
- Designed using **Clean Architecture principles**

---

## 🧱 Project Structure

Suggested structure:
```
src/
├── handlers/
│   └── sqs-consumer.handler.ts
├── services/
│   ├── dynamodb.service.ts
│   └── metadata.service.ts
├── models/
│   ├── document-metadata.model.ts
│   └── sqs-message.model.ts
├── config/
│   └── dynamodb.config.ts
└── utils/
    └── error-handler.ts
```

---

## 🔁 Data Flow

1. **SQS message** is received by the Lambda function.
2. Lambda **parses the message** to extract document metadata.
3. **MetadataService** processes and enriches the metadata if needed.
4. **DynamoDBService** stores the metadata in DynamoDB.
5. Lambda returns success or handles errors appropriately.

---

## 🔗 SQS Message Sample

```json
{
  "Records": [
    {
      "messageId": "059f36b4-87a3-44ab-83d2-661975830a7d",
      "receiptHandle": "AQEBwJnKyrHigUMZj6rYigCgxlaS3SLy0a...",
      "body": "{\"bucket\":\"my-bucket\",\"key\":\"uploads/2025-06-30/contract.pdf\",\"timestamp\":\"2025-06-30T12:34:56Z\"}",
      "attributes": {
        "ApproximateReceiveCount": "1",
        "SentTimestamp": "1545082649183",
        "SenderId": "AIDAIENQZJOLO23YVJ4VO",
        "ApproximateFirstReceiveTimestamp": "1545082649185"
      },
      "messageAttributes": {},
      "md5OfBody": "e4e68fb7bd0e697a0ae8f1bb342846b3",
      "eventSource": "aws:sqs",
      "eventSourceARN": "arn:aws:sqs:us-east-1:123456789012:my-queue",
      "awsRegion": "us-east-1"
    }
  ]
}
```

---

## 📊 DynamoDB Table Structure

```
Table Name: DocumentMetadata

Attributes:
- documentId (S): Primary key, unique identifier for the document
- timestamp (S): Sort key, when the document was processed
- bucket (S): S3 bucket name where the document is stored
- key (S): S3 object key for the document
- fileType (S): Type/extension of the document
- fileSize (N): Size of the document in bytes
- status (S): Processing status (e.g., "METADATA_STORED")
- createdAt (S): When this record was created
- updatedAt (S): When this record was last updated
```

---

## 🎯 Objective

Write clean, testable, modular TypeScript code for this Lambda:
- `sqs-consumer.handler.ts` receives and processes SQS messages.
- `metadata.service.ts` handles business logic for metadata processing.
- `dynamodb.service.ts` encapsulates the DynamoDB operations via AWS SDK.
- Implement proper error handling and retries.
- Ensure efficient DynamoDB operations (batch writes for multiple messages).
