import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export interface DocumentMetadataTableProps {
  tableName: string;
  removalPolicy?: cdk.RemovalPolicy;
}

export class DocumentMetadataTable extends Construct {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DocumentMetadataTableProps) {
    super(scope, id);

    this.table = new dynamodb.Table(this, 'DocumentMetadataTable', {
      tableName: props.tableName,
      partitionKey: {
        name: 'documentId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: props.removalPolicy || cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // Add GSI for querying by bucket and key
    this.table.addGlobalSecondaryIndex({
      indexName: 'BucketKeyIndex',
      partitionKey: {
        name: 'bucket',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'key',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Add GSI for querying by status
    this.table.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });
  }
}