import { LogLevel } from '../shared/logger/logger'; 

export const environment = {
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    sqs: {
      queueUrl: process.env.SQS_QUEUE_URL || ''
    }
  },
  logger: {
    level: (process.env.LOG_LEVEL as keyof typeof LogLevel) || 'INFO'
  }
};

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