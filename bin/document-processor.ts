#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DocumentProcessingStack } from '../infra/constructs/document-processing-stack';

const app = new cdk.App();

// Get stage from context or default to 'dev'
const stage = app.node.tryGetContext('stage') || 'dev';

new DocumentProcessingStack(app, `DocumentProcessing-${stage}`, {
  stage: stage,
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1' 
  },
  description: `Document Processing Stack (${stage})`,
  tags: {
    Environment: stage,
    Project: 'DocumentProcessor',
    Owner: 'Data Engineering Team'
  }
}); 