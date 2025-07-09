/**
 * Environment configuration system
 * Provides proper environment-specific configuration
 */

// Define environment types
export enum Environment {
  DEVELOPMENT = 'development',
  TEST = 'test',
  STAGING = 'staging',
  PRODUCTION = 'production'
}

// Base configuration interface
export interface Config {
  env: Environment;
  aws: {
    region: string;
    s3: {
      bucketName: string;
      uploadPrefix: string;
    };
    sqs: {
      queueUrl: string;
      deadLetterQueueUrl: string;
      classificationQueueUrl: string;  // Added classification queue URL
      maxRetries: number;
    };
    dynamodb: {
      tableName: string;
    };
    textract?: {
      roleArn: string;
    };
  };
  logger: {
    level: string;
    rotation: {
      enabled: boolean;
      maxFiles: number;
      maxSize: number;
    };
  };
  api: {
    cors: {
      allowOrigin: string;
      allowMethods: string;
    };
  };
}

// Configuration for each environment
const configs: Record<Environment, Config> = {
  [Environment.DEVELOPMENT]: {
    env: Environment.DEVELOPMENT,
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      s3: {
        bucketName: process.env.S3_BUCKET_NAME || 'document-processor-dev',
        uploadPrefix: 'uploads/',
      },
      sqs: {
        queueUrl: process.env.SQS_QUEUE_URL || '',
        deadLetterQueueUrl: process.env.SQS_DLQ_URL || '',
        classificationQueueUrl: process.env.SQS_CLASSIFICATION_QUEUE_URL || '',
        maxRetries: 3,
      },
      dynamodb: {
        tableName: process.env.DYNAMODB_TABLE || 'document-jobs-dev',
      },
      textract: {
        roleArn: process.env.TEXTRACT_ROLE_ARN || '',
      },
    },
    logger: {
      level: process.env.LOG_LEVEL || 'DEBUG',
      rotation: {
        enabled: false,
        maxFiles: 5,
        maxSize: 10 * 1024 * 1024, // 10MB
      },
    },
    api: {
      cors: {
        allowOrigin: '*',
        allowMethods: 'GET,POST,PUT,DELETE',
      },
    },
  },
  [Environment.TEST]: {
    env: Environment.TEST,
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      s3: {
        bucketName: process.env.S3_BUCKET_NAME || 'document-processor-test',
        uploadPrefix: 'uploads/',
      },
      sqs: {
        queueUrl: process.env.SQS_QUEUE_URL || '',
        deadLetterQueueUrl: process.env.SQS_DLQ_URL || '',
        classificationQueueUrl: process.env.SQS_CLASSIFICATION_QUEUE_URL || '',
        maxRetries: 1,
      },
      dynamodb: {
        tableName: process.env.DYNAMODB_TABLE || 'document-jobs-test',
      },
      textract: {
        roleArn: process.env.TEXTRACT_ROLE_ARN || '',
      },
    },
    logger: {
      level: process.env.LOG_LEVEL || 'INFO',
      rotation: {
        enabled: false,
        maxFiles: 2,
        maxSize: 1 * 1024 * 1024, // 1MB
      },
    },
    api: {
      cors: {
        allowOrigin: '*',
        allowMethods: 'GET,POST,PUT,DELETE',
      },
    },
  },
  [Environment.STAGING]: {
    env: Environment.STAGING,
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      s3: {
        bucketName: process.env.S3_BUCKET_NAME || 'document-processor-staging',
        uploadPrefix: 'uploads/',
      },
      sqs: {
        queueUrl: process.env.SQS_QUEUE_URL || '',
        deadLetterQueueUrl: process.env.SQS_DLQ_URL || '',
        classificationQueueUrl: process.env.SQS_CLASSIFICATION_QUEUE_URL || '',
        maxRetries: 3,
      },
      dynamodb: {
        tableName: process.env.DYNAMODB_TABLE || 'document-jobs-staging',
      },
      textract: {
        roleArn: process.env.TEXTRACT_ROLE_ARN || '',
      },
    },
    logger: {
      level: process.env.LOG_LEVEL || 'INFO',
      rotation: {
        enabled: true,
        maxFiles: 10,
        maxSize: 20 * 1024 * 1024, // 20MB
      },
    },
    api: {
      cors: {
        allowOrigin: 'https://staging-app.example.com',
        allowMethods: 'GET,POST,PUT,DELETE',
      },
    },
  },
  [Environment.PRODUCTION]: {
    env: Environment.PRODUCTION,
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      s3: {
        bucketName: process.env.S3_BUCKET_NAME || 'document-processor-prod',
        uploadPrefix: 'uploads/',
      },
      sqs: {
        queueUrl: process.env.SQS_QUEUE_URL || '',
        deadLetterQueueUrl: process.env.SQS_DLQ_URL || '',
        classificationQueueUrl: process.env.SQS_CLASSIFICATION_QUEUE_URL || '',
        maxRetries: 5,
      },
      dynamodb: {
        tableName: process.env.DYNAMODB_TABLE || 'document-metadata-prod',
      },
      textract: {
        roleArn: process.env.TEXTRACT_ROLE_ARN || '',
      },
    },
    logger: {
      level: process.env.LOG_LEVEL || 'WARN',
      rotation: {
        enabled: true,
        maxFiles: 30,
        maxSize: 50 * 1024 * 1024, // 50MB
      },
    },
    api: {
      cors: {
        allowOrigin: 'https://app.example.com',
        allowMethods: 'GET,POST,PUT,DELETE',
      },
    },
  },
};

// Get current environment
const getEnvironment = (): Environment => {
  const env = process.env.NODE_ENV?.toLowerCase();
  if (env === 'production') return Environment.PRODUCTION;
  if (env === 'staging') return Environment.STAGING;
  if (env === 'test') return Environment.TEST;
  return Environment.DEVELOPMENT;
};

// Get configuration for current environment
const currentEnv = getEnvironment();
export const environment = configs[currentEnv];

// Utility function to check if we're in a specific environment
export const isEnvironment = (env: Environment): boolean => currentEnv === env;

// Add convenience checks
export const isDevelopment = (): boolean => isEnvironment(Environment.DEVELOPMENT);
export const isTest = (): boolean => isEnvironment(Environment.TEST);
export const isStaging = (): boolean => isEnvironment(Environment.STAGING);
export const isProduction = (): boolean => isEnvironment(Environment.PRODUCTION);

// Helper to override environment values for testing
export const setEnvironmentForTesting = (overrides: Partial<typeof environment>) => {
  Object.keys(overrides).forEach(key => {
    if (typeof overrides[key as keyof typeof environment] === 'object') {
      Object.assign(environment[key as keyof typeof environment], 
        overrides[key as keyof typeof environment]);
    } else {
      (environment as any)[key] = overrides[key as keyof typeof environment];
    }
  });
}; 