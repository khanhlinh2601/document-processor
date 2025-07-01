
# Clean AWS Lambda Project (S3 Upload) – Based on aws-samples/serverless-typescript-demo

Create a **clean, modular AWS Lambda function in TypeScript** that uploads one or multiple documents to **Amazon S3**, following clean code and SOLID principles. The architecture should reflect the style of the [AWS Serverless TypeScript Demo](https://github.com/aws-samples/serverless-typescript-demo/tree/main), but adapted with the following structure:


## ✅ Features

- Use **AWS Lambda** + **API Gateway** to accept `multipart/form-data`
- Upload to **Amazon S3** with **@aws-sdk/client-s3 v3**
- Return uploaded file URLs to the client
- Keep code clean, testable, and aligned with **SOLID principles**
- Optionally include basic Jest test for the service