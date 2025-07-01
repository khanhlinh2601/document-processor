#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DocumentProcessorStack } from '../lib/document-processor-stack';

const app = new cdk.App();
new DocumentProcessorStack(app, 'DocumentProcessorStack', {}); 