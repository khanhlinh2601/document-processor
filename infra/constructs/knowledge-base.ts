import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface KnowledgeBaseProps {
  bucket: s3.Bucket;
  knowledgeBaseId?: string;
}

export class KnowledgeBase extends Construct {
  public readonly knowledgeBaseId: string;

  constructor(scope: Construct, id: string, props: KnowledgeBaseProps) {
    super(scope, id);

    // Use provided ID, environment variable, or generate a new one
    // AWS Bedrock knowledge base IDs should be alphanumeric
    const providedId = props.knowledgeBaseId || process.env.KNOWLEDGE_BASE_ID;
    
    if (providedId && /^[0-9a-zA-Z]+$/.test(providedId)) {
      this.knowledgeBaseId = providedId;
    } else {
      // Generate a valid alphanumeric ID if not provided or invalid
      // Using a consistent format: kb + 8 random alphanumeric chars
      this.knowledgeBaseId = 'kb' + Math.random().toString(36).substring(2, 10);
      console.warn(`Using generated knowledge base ID: ${this.knowledgeBaseId}`);
    }

    // Output the knowledge base ID
    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: this.knowledgeBaseId,
      description: 'The ID of the Amazon Bedrock Knowledge Base'
    });

    // Grant the bucket permissions for the knowledge base service
    props.bucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: [
        's3:GetObject',
        's3:ListBucket'
      ],
      principals: [
        new iam.ServicePrincipal('bedrock.amazonaws.com')
      ],
      resources: [
        props.bucket.bucketArn,
        `${props.bucket.bucketArn}/formatted/*`
      ]
    }));
  }
} 