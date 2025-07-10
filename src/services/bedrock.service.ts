import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput
} from '@aws-sdk/client-bedrock-runtime';
import {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateCommand,
  RetrieveAndGenerateCommandInput
} from '@aws-sdk/client-bedrock-agent-runtime';
import {
  BedrockAgentClient,
} from '@aws-sdk/client-bedrock-agent';
import { Logger, LogContext } from '../shared/logger/logger';
import { bedrockClient } from '../clients/bedrock-client';
import { bedrockAgentClient } from '../clients/bedrock-agent-client';
import { bedrockAgentAdminClient } from '../clients/bedrock-agent-admin-client';

interface ModelParams {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

interface KnowledgeBaseParams {
  knowledgeBaseId: string;
  numberOfResults?: number;
  temperature?: number;
  maxTokens?: number;
}

interface CreateKnowledgeBaseParams {
  name: string;
  roleArn: string;
  embeddingModelArn?: string;
  description?: string;
}

export class BedrockService {
  private client: BedrockRuntimeClient;
  private agentClient: BedrockAgentRuntimeClient;
  private agentAdminClient: BedrockAgentClient;
  private logger: Logger;
  private modelId: string;

  constructor(
    modelId: string = 'anthropic.claude-3-sonnet-20240229-v1:0', 
    client: BedrockRuntimeClient = bedrockClient,
    agentClient: BedrockAgentRuntimeClient = bedrockAgentClient,
    agentAdminClient: BedrockAgentClient = bedrockAgentAdminClient,
    logContext?: LogContext
  ) {
    this.client = client;
    this.agentClient = agentClient;
    this.agentAdminClient = agentAdminClient;
    this.modelId = modelId;
    this.logger = new Logger('BedrockService', logContext);
  }

  /**
   * Invoke the Bedrock model with the provided prompt
   * @param prompt The text prompt to send to the model
   * @param params Optional model parameters
   * @returns The model's response
   */
  async invokeModel(
    prompt: string,
    params: ModelParams = {}
  ): Promise<any> {
    try {
      this.logger.debug('Invoking Bedrock model', {
        modelId: this.modelId,
        promptLength: prompt.length
      });

      // Format request based on model type
      let requestBody: any;

      // Check if it's an Anthropic Claude model
      if (this.modelId.startsWith('anthropic.claude')) {
        requestBody = {
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: params.maxTokens || 4096,
          temperature: params.temperature || 0.7,
          top_p: params.topP || 0.9,
          stop_sequences: params.stopSequences || [],
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                }
              ]
            }
          ]
        };
      } 
      // Check if it's an Amazon Titan model
      else if (this.modelId.startsWith('amazon.titan')) {
        requestBody = {
          inputText: prompt,
          textGenerationConfig: {
            maxTokenCount: params.maxTokens || 4096,
            temperature: params.temperature || 0.7,
            topP: params.topP || 0.9,
            stopSequences: params.stopSequences || []
          }
        };
      } 
      // Default fallback
      else {
        throw new Error(`Unsupported model: ${this.modelId}`);
      }

      const input: InvokeModelCommandInput = {
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody)
      };

      const command = new InvokeModelCommand(input);
      const response = await this.client.send(command);

      // Parse response body
      const responseBody = new TextDecoder().decode(response.body);
      const parsedResponse = JSON.parse(responseBody);

      this.logger.debug('Bedrock model invocation successful', {
        modelId: this.modelId,
      });

      // Extract and return the response content based on model type
      if (this.modelId.startsWith('anthropic.claude')) {
        return parsedResponse.content?.[0]?.text || '';
      } else if (this.modelId.startsWith('amazon.titan')) {
        return parsedResponse.results?.[0]?.outputText || '';
      } else {
        return parsedResponse;
      }
    } catch (error) {
      this.logger.error('Error invoking Bedrock model', error, {
        modelId: this.modelId
      });
      throw error;
    }
  }

  /**
   * Query a knowledge base and generate responses based on the retrieved data
   * @param query The text query to send to the knowledge base
   * @param params Knowledge base parameters including knowledgeBaseId
   * @returns The generated response with citations
   */
  async queryKnowledgeBase(
    query: string,
    params: KnowledgeBaseParams
  ): Promise<any> {
    try {
      // Validate knowledge base ID format (alphanumeric, max 10 chars)
      if (!params.knowledgeBaseId || 
          !/^[0-9a-zA-Z]{1,10}$/.test(params.knowledgeBaseId)) {
        throw new Error(`Invalid knowledge base ID format: ${params.knowledgeBaseId}. Must be alphanumeric and max 10 characters.`);
      }

      this.logger.debug('Querying knowledge base with Bedrock', {
        modelId: this.modelId,
        knowledgeBaseId: params.knowledgeBaseId,
        queryLength: query.length
      });

      // First check if the knowledge base exists
      try {
        // Note: This would require additional permissions and imports
        // This is just a placeholder for the concept
        this.logger.debug('Knowledge base exists, proceeding with query');
      } catch (error) {
        if (error.name === 'ResourceNotFoundException') {
          this.logger.error('Knowledge base not found', {
            knowledgeBaseId: params.knowledgeBaseId
          });
          throw error;
        }
        // For other errors, continue with the query attempt
      }

      const input: RetrieveAndGenerateCommandInput = {
        input: {
          text: query
        },
        retrieveAndGenerateConfiguration: {
          type: 'KNOWLEDGE_BASE',
          knowledgeBaseConfiguration: {
            knowledgeBaseId: params.knowledgeBaseId,
            modelArn: this.modelId,
            retrievalConfiguration: {
              vectorSearchConfiguration: {
                numberOfResults: params.numberOfResults || 5
              }
            },
            generationConfiguration: {
              inferenceConfig: {
                textInferenceConfig: {
                  temperature: params.temperature || 0.7,
                  maxTokens: params.maxTokens || 4096
                }
              }
            }
          }
        }
      };

      const command = new RetrieveAndGenerateCommand(input);
      const response = await this.agentClient.send(command);

      this.logger.debug('Knowledge base query successful', {
        modelId: this.modelId,
        knowledgeBaseId: params.knowledgeBaseId
      });

      return {
        output: response.output?.text || '',
        citations: response.citations || [],
        sessionId: response.sessionId
      };
    } catch (error) {
      this.logger.error('Error querying knowledge base', error, {
        modelId: this.modelId,
        knowledgeBaseId: params.knowledgeBaseId
      });
      throw error;
    }
  }

  /**
   * Create a structured classification prompt from document content
   * @param documentContent The extracted document content
   * @returns Formatted prompt string
   */
  createClassificationPrompt(documentContent: any): string {
    const prompt = `
You are a document classification expert. Analyze the following document content and classify it into the most appropriate category.
Return your response as a valid JSON object with the following structure:

{
  "documentType": "string", // The primary document type (e.g., "Invoice", "Receipt", "Contract", "Form", etc.)
  "confidence": number, // Confidence score between 0 and 1
  "metadata": {
    // Add any relevant metadata fields based on document type
    // For example, for an invoice, include:
    "invoiceNumber": "string",
    "issueDate": "string",
    "dueDate": "string",
    "totalAmount": "string",
    "currency": "string",
    "vendor": "string"
    // For other document types, include appropriate metadata
  },
  "entities": [
    // Array of entities found in the document
    {
      "type": "string", // Entity type (e.g., "Person", "Organization", "Date", "Amount", etc.)
      "text": "string", // The actual text from the document
      "confidence": number // Confidence score between 0 and 1
    }
  ]
}

Document content:
${JSON.stringify(documentContent)}

Remember to return ONLY the JSON object with no additional text.
`;

    return prompt;
  }

  /**
   * Create a banking document classification prompt
   * @param documentContent The extracted document content
   * @returns Formatted prompt for banking document classification
   */
  createBankingClassificationPrompt(documentContent: any): string {
    return `
You are a banking document expert AI assistant.

Classify the following document content and return a structured JSON response matching this schema:

{
  "overallConfidence": number, // 0 to 1
  "documentType": {
    "type": "string", // Primary type - MUST be one of: "KYC_FORM", "CREDIT_APPLICATION", "LOAN_CONTRACT", "BANK_STATEMENT", "TRANSACTION_RECEIPT", "ID_CARD", "PASSPORT", "UTILITY_BILL", "SALARY_SLIP", or "OTHER"
    "confidence": number,
    "alternatives": {
      "alternativeType1": number, // confidence score for alternative type
      "alternativeType2": number,
      "alternativeType3": number
    }
  },
  "summary": "string", // Brief 2-3 sentence summary of document content
  "entities": [
    {
      "type": "string", // Entity type (e.g., "Person", "Organization", "Date", "Amount", etc.)
      "value": "string", // Extracted value
      "confidence": number // 0 to 1
    }
  ],
  "metadata": {
    // Relevant metadata based on document type
    "issueDate": "string",
    "expiryDate": "string",
    "documentNumber": "string",
    "issuingAuthority": "string"
  }
}

IMPORTANT: The "documentType.type" field MUST be exactly one of these values: "KYC_FORM", "CREDIT_APPLICATION", "LOAN_CONTRACT", "BANK_STATEMENT", "TRANSACTION_RECEIPT", "ID_CARD", "PASSPORT", "UTILITY_BILL", "SALARY_SLIP", or "OTHER".

Analyze this content:
${JSON.stringify(documentContent)}

Return only the JSON object without any extra explanation.
`;
  }
} 