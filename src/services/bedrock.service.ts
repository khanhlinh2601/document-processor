import {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateCommand,
  RetrieveAndGenerateCommandInput
} from '@aws-sdk/client-bedrock-agent-runtime';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput
} from '@aws-sdk/client-bedrock-runtime';
import { bedrockAgentClient } from '../clients/bedrock-agent-client';
import { bedrockClient } from '../clients/bedrock-client';
import { LogContext, Logger } from '../shared/logger/logger';

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

interface ModelRequestBody {
  [key: string]: any;
}

export class BedrockService {
  private client: BedrockRuntimeClient;
  private agentClient: BedrockAgentRuntimeClient;
  private logger: Logger;
  private modelId: string;

  constructor(
    modelId: string = 'anthropic.claude-3-sonnet-20240229-v1:0', 
    client: BedrockRuntimeClient = bedrockClient,
    agentClient: BedrockAgentRuntimeClient = bedrockAgentClient,
    logContext?: LogContext
  ) {
    this.client = client;
    this.agentClient = agentClient;
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
  ): Promise<string> {
    try {
      this.logger.debug('Invoking Bedrock model', {
        modelId: this.modelId,
        promptLength: prompt.length
      });

      // Create request body based on model type
      const requestBody = this.createModelRequestBody(prompt, params);

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

      // Extract response content based on model type
      return this.extractModelResponse(parsedResponse);
    } catch (error) {
      this.logger.error('Error invoking Bedrock model', error, {
        modelId: this.modelId
      });
      throw error;
    }
  }

  /**
   * Creates the request body for the model based on model type
   * @param prompt The text prompt to send to the model
   * @param params Model parameters
   * @returns Model-specific request body
   */
  private createModelRequestBody(prompt: string, params: ModelParams): ModelRequestBody {
    // For Anthropic Claude models
    if (this.modelId.startsWith('anthropic.claude')) {
      return {
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
    // For Amazon Titan models
    else if (this.modelId.startsWith('amazon.titan')) {
      return {
        inputText: prompt,
        textGenerationConfig: {
          maxTokenCount: params.maxTokens || 4096,
          temperature: params.temperature || 0.7,
          topP: params.topP || 0.9,
          stopSequences: params.stopSequences || []
        }
      };
    } 
    // Default fallback - throw error for unsupported models
    else {
      throw new Error(`Unsupported model: ${this.modelId}`);
    }
  }

  /**
   * Extracts the response content from the model output based on model type
   * @param parsedResponse The parsed JSON response from the model
   * @returns Extracted response text
   */
  private extractModelResponse(parsedResponse: any): string {
    if (this.modelId.startsWith('anthropic.claude')) {
      return parsedResponse.content?.[0]?.text || '';
    } else if (this.modelId.startsWith('amazon.titan')) {
      return parsedResponse.results?.[0]?.outputText || '';
    } else {
      return JSON.stringify(parsedResponse);
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
  ): Promise<{
    output: string;
    citations: any[];
    sessionId?: string;
  }> {
    try {
      this.validateKnowledgeBaseId(params.knowledgeBaseId);

      this.logger.debug('Querying knowledge base with Bedrock', {
        modelId: this.modelId,
        knowledgeBaseId: params.knowledgeBaseId,
        queryLength: query.length
      });

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
   * Validates knowledge base ID format
   * @param knowledgeBaseId The knowledge base ID to validate
   * @throws Error if knowledge base ID format is invalid
   */
  private validateKnowledgeBaseId(knowledgeBaseId: string): void {
    if (!knowledgeBaseId || !/^[0-9a-zA-Z]+$/.test(knowledgeBaseId)) {
      throw new Error(`Invalid knowledge base ID format: ${knowledgeBaseId}. Must be alphanumeric.`);
    }
  }

  /**
   * Create a banking document classification prompt
   * @param documentContent The extracted document content
   * @returns Formatted prompt for banking document classification
   */
  createBankingClassificationPrompt(documentContent: any): string {
    const documentTypes = [
      "KYC_FORM", "CREDIT_APPLICATION", "LOAN_CONTRACT", "BANK_STATEMENT", 
      "TRANSACTION_RECEIPT", "ID_CARD", "PASSPORT", "UTILITY_BILL", 
      "SALARY_SLIP", "OTHER"
    ];
    
    return `
You are a banking document expert AI assistant.

Classify the following document content and return a structured JSON response matching this schema:

{
  "overallConfidence": number, // 0 to 1
  "documentType": {
    "type": "string", // Primary type - MUST be one of: ${documentTypes.map(t => `"${t}"`).join(", ")}
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

IMPORTANT: The "documentType.type" field MUST be exactly one of these values: ${documentTypes.join(", ")}.

Analyze this content:
${JSON.stringify(documentContent)}

Return only the JSON object without any extra explanation.
`;
  }
} 