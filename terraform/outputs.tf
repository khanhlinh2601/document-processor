output "s3_bucket" {
  value = aws_s3_bucket.bucket.bucket
}
output "sqs_queue_url" {
  value = aws_sqs_queue.queue.id
}
output "lambda_upload_arn" {
  value = aws_lambda_function.upload.arn
}
output "api_gateway_url" {
  value = "${aws_api_gateway_deployment.deployment.invoke_url}/upload"
  description = "API Gateway endpoint for uploading documents"
}