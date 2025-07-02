
# Project: S3 Ingestion Trigger → Amazon SQS Pipeline (AWS Lambda, TypeScript)

## 🧩 Goal

Implement a clean, modular Lambda function in **TypeScript** that listens to **S3 ObjectCreated events**, and publishes ingestion tasks to **Amazon SQS**.

---

## 🧱 Architecture

### Lambda: Ingestion Trigger (Step 1)

- Triggered automatically by **S3 Event Notification** on `ObjectCreated`.
- Reads object metadata (bucket name, key, etc.).
- Sends a structured message to **Amazon SQS** containing:
  - File path (S3 key)
  - Bucket name
  - Timestamp
  - Any other relevant metadata

### Amazon SQS (Step 2)

- Receives messages from the ingestion Lambda.
- (Optional) Additional Lambdas or workers will consume these messages downstream.

---

## 📦 Technologies

- **TypeScript**
- **AWS Lambda**
- **Amazon S3 (trigger source)**
- **Amazon SQS (message target)**
- **AWS SDK v3**
- Designed using **Clean Architecture principles**

---

## 🧱 Project Structure

---

## 🔁 Data Flow

1. **S3 uploads** a new file.
2. **S3 triggers Lambda (s3-event.handler.ts)** on `ObjectCreated`.
3. Lambda uses **`IngestionService`** to send a message to **SQS** via `SQSService`.

---

## 🔗 S3 Trigger Event Sample (s3-event.json)

```json
{
  "Records": [
    {
      "s3": {
        "bucket": {
          "name": "my-bucket"
        },
        "object": {
          "key": "uploads/2025-06-30/contract.pdf"
        }
      }
    }
  ]
}
```

---

## 🎯 Objective

Write clean, testable, modular TypeScript code for this Lambda:
- `s3-event.handler.ts` receives and parses the S3 event.
- Calls `IngestionService`, which prepares a DTO and publishes to SQS.
- `SQSService` encapsulates the actual AWS SDK logic.

