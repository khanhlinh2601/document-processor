import { Logger, LogContext } from '../shared/logger/logger';
import Ajv from 'ajv';

export class SchemaValidatorService {
  private logger: Logger;
  private ajv: Ajv;

  constructor(logContext?: LogContext) {
    this.logger = new Logger('SchemaValidatorService', logContext);
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      coerceTypes: true,
    });
  }

  /**
   * Validate data against a JSON schema
   * @param data The data to validate
   * @param schema JSON schema to validate against
   * @returns Valid data or throws error
   */
  validate<T>(data: any, schema: object): T {
    try {
      const validate = this.ajv.compile(schema);
      const valid = validate(data);

      if (!valid) {
        const errors = validate.errors || [];
        this.logger.warn('Schema validation failed', {
          errors: errors.map(e => ({
            path: e.instancePath,
            message: e.message
          }))
        });

        throw new Error(`Schema validation failed: ${this.ajv.errorsText(validate.errors)}`);
      }

      this.logger.debug('Schema validation successful');
      return data as T;
    } catch (error) {
      this.logger.error('Error during schema validation', error);
      throw error;
    }
  }

  /**
   * Get the classification schema
   * @returns Classification schema
   */
  getClassificationSchema(): object {
    return {
      type: 'object',
      required: ['documentType', 'confidence'],
      properties: {
        documentType: {
          type: 'string',
          minLength: 1,
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
        },
        metadata: {
          type: 'object',
          additionalProperties: true,
        },
        entities: {
          type: 'array',
          items: {
            type: 'object',
            required: ['type', 'text', 'confidence'],
            properties: {
              type: {
                type: 'string',
                minLength: 1,
              },
              text: {
                type: 'string',
              },
              confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1,
              },
            },
          },
        },
      },
    };
  }

  /**
   * Get the banking document classification schema
   * @returns Banking classification schema
   */
  getBankingClassificationSchema(): object {
    return {
      type: 'object',
      required: ['overallConfidence', 'documentType', 'summary'],
      properties: {
        overallConfidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
        },
        documentType: {
          type: 'object',
          required: ['type', 'confidence'],
          properties: {
            type: {
              type: 'string',
              enum: [
                'KYC_FORM',
                'CREDIT_APPLICATION',
                'LOAN_CONTRACT',
                'BANK_STATEMENT',
                'TRANSACTION_RECEIPT',
                'ID_CARD',
                'PASSPORT',
                'UTILITY_BILL',
                'SALARY_SLIP',
                'OTHER'
              ],
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
            },
            alternatives: {
              type: 'object',
              additionalProperties: {
                type: 'number',
                minimum: 0,
                maximum: 1
              }
            }
          }
        },
        summary: {
          type: 'string',
          minLength: 1,
        },
        entities: {
          type: 'array',
          items: {
            type: 'object',
            required: ['type', 'value', 'confidence'],
            properties: {
              type: {
                type: 'string',
                minLength: 1,
              },
              value: {
                type: 'string',
              },
              confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1,
              },
            },
          },
        },
        metadata: {
          type: 'object',
          additionalProperties: {
            type: 'string'
          }
        }
      },
    };
  }

  /**
   * Try to parse JSON from LLM response
   * @param response LLM text response
   * @returns Parsed JSON object
   */
  parseJsonFromLlmResponse(response: string): any {
    try {
      // Find JSON content in the string (might be surrounded by explanations)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }

      const jsonStr = jsonMatch[0];
      return JSON.parse(jsonStr);
    } catch (error) {
      this.logger.error('Error parsing JSON from LLM response', error);
      throw new Error(`Failed to parse JSON from LLM response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 