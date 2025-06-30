
# Lambda Function: Upload Documents to S3 (Clean Code – TypeScript)

## ✅ Objective
Generate a **clean and modular AWS Lambda function in TypeScript** that uploads single or multiple documents to **Amazon S3**, following best practices and clean code principles.

---

## 🔧 Functionality
- Lambda should **upload one or multiple documents to Amazon S3**.
- Accept a **JSON payload** containing:
  - One or more base64-encoded files
  - Metadata like file name, content type, etc.
- Return the **S3 object URLs** or keys after successful upload.

---

## 🧱 Code Structure & Architecture

Follow **Clean Code** and **Separation of Concerns** principles:

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

- Use **dependency injection** pattern if appropriate.
- Avoid putting logic in the handler. Handlers should delegate to services.

---

## 📦 Tech Stack

- **Language**: TypeScript
- **Deployment Target**: AWS Lambda
- **AWS SDK**: Use modular AWS SDK v3 (`@aws-sdk/client-s3`)
- **Validation**: Optionally use `class-validator` for input validation
- Environment variables for configuration:
  - AWS Region
  - S3 Bucket name

---

## 🧪 Code Quality

- Clean naming, proper error handling, async/await usage
- Use `try/catch` with descriptive error messages
- Include **mock event.json** and local test instructions (e.g., using `ts-node`)

---

## 📝 Expected Files

```
src/
├── main.ts
├── app.module.ts
├── config/
│   └── aws.config.ts
├── interfaces/
│   └── upload.handler.ts
├── application/
│       └── upload-file.service.ts
├── domain/
│   └── models/
│       └── file.entity.ts
├── infrastructure/
│   └── s3/
│       └── s3.service.ts
│   └── sqs/
│       └── sqs.service.ts
|__ utils/
|        |__file.util.ts
└── shared/
    ├── dtos/
    │   └── upload-request.dto.ts
    ├── 
    └── event.json
```

---

## 📄 Example Input Payload

```json
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

---

## ✅ Output

```json
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
