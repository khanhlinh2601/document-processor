import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput
} from '@aws-sdk/client-bedrock-runtime';
import { Logger, LogContext } from '../shared/logger/logger';
import { bedrockClient } from '../clients/bedrock-client';

interface ModelParams {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export class BedrockService {
  private client: BedrockRuntimeClient;
  private logger: Logger;
  private modelId: string;

  constructor(
    modelId: string = 'anthropic.claude-3-sonnet-20240229-v1:0', 
    client: BedrockRuntimeClient = bedrockClient,
    logContext?: LogContext
  ) {
    this.client = client;
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
    const systemPrompt = `You are a banking document expert AI assistant.

Your tasks:
1. Summarize the document's main purpose and content in 2–3 sentences.
2. Classify the document into one of the banking-related categories.
3. Return a confidence score between 0 and 1.

Always respond in structured JSON format.`;

    const userPrompt = `Given the extracted text from a scanned banking document, do the following:

1. Write a concise summary (2–3 sentences) of the document's content.
2. Classify the document into one of these categories:

[
  "KYC_FORM",
  "CREDIT_APPLICATION",
  "LOAN_CONTRACT",
  "BANK_STATEMENT",
  "TRANSACTION_RECEIPT",
  "ID_CARD",
  "PASSPORT",
  "UTILITY_BILL",
  "SALARY_SLIP",
  "OTHER"
]

3. Estimate a confidence score between 0 and 1.

Document Text:
---
${documentContent.text}
---

Respond in the following JSON format only:

{
  "summary": "<brief explanation of the document>",
  "category": "<one of the categories>",
  "confidence": <float between 0 and 1>
}`;

    // For Claude models, we can use system and user prompts
    if (this.modelId.startsWith('anthropic.claude')) {
      return `${systemPrompt}\n\n${userPrompt}`;
    } else {
      // For other models, combine the prompts
      return `${systemPrompt}\n\n${userPrompt}`;
    }
  }
} 