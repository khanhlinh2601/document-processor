provider "aws" {
  region = var.aws_region
}

resource "aws_s3_bucket" "bucket" {
  bucket = var.s3_bucket_name
}

resource "aws_sqs_queue" "queue" {
  name = var.sqs_queue_name
}

resource "aws_lambda_function" "upload" {
  function_name = "upload"
  handler       = "upload.handler"
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_exec.arn
  filename      = "${path.module}/lambda/upload.zip"
  environment {
    variables = {
      S3_BUCKET_NAME = aws_s3_bucket.bucket.bucket
      SQS_QUEUE_URL  = aws_sqs_queue.queue.id
    }
  }
}

# Repeat aws_lambda_function for other handlers

resource "aws_iam_role" "lambda_exec" {
  name = "lambda_exec_role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role_policy.json
}

data "aws_iam_policy_document" "lambda_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "lambda_policy" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}