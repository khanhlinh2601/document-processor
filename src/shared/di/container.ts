import { LogContext } from '../logger/logger';

/**
 * Simple dependency injection container
 */
export class Container {
  private static instance: Container;
  private services: Map<string, any> = new Map();
  private factories: Map<string, Function> = new Map();

  private constructor() { }

  /**
   * Get singleton instance
   */
  public static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  /**
   * Register a service instance
   * @param name Service name
   * @param instance Service instance
   */
  public register<T>(name: string, instance: T): void {
    this.services.set(name, instance);
  }

  /**
   * Register a factory function
   * @param name Service name
   * @param factory Factory function
   */
  public registerFactory<T>(name: string, factory: (...args: any[]) => T): void {
    this.factories.set(name, factory);
  }

  /**
   * Get a service
   * @param name Service name
   * @param args Arguments to pass to factory if service doesn't exist
   * @returns Service instance
   */
  public resolve<T>(name: string, ...args: any[]): T {
    // Return existing instance if available
    if (this.services.has(name)) {
      return this.services.get(name) as T;
    }
    
    // Create new instance using factory
    if (this.factories.has(name)) {
      const factory = this.factories.get(name) as Function;
      const instance = factory(...args);
      this.services.set(name, instance);
      return instance as T;
    }
    
    throw new Error(`Service "${name}" not found`);
  }
  
  /**
   * Clear all registered services and factories
   */
  public clear(): void {
    this.services.clear();
    this.factories.clear();
  }
}

/**
 * Type for service factory
 */
export type ServiceFactory<T> = (...args: any[]) => T;

/**
 * Create a service factory with logging context
 * @param Factory Factory function
 * @returns Factory function that includes logging context
 */
export function withLogContext<T>(Factory: new (...args: any[]) => T): ServiceFactory<T> {
  return (logContext?: LogContext, ...args: any[]) => {
    return new Factory(logContext, ...args);
  };
} 