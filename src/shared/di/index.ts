import 'reflect-metadata';

export * from './app.module';
export * from './documents.module';
export * from './message-queue.module';
export * from './textract.module';
export * from './tokens';
export * from './app.factory';
export * from './service-provider';

// Re-export for backward compatibility
export { ServiceProvider as serviceRegistry } from './service-provider';
