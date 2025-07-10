import { BedrockAgentRuntimeClient } from '@aws-sdk/client-bedrock-agent-runtime';
import { environment } from '../configs/environment';

/**
 * Creates and configures a Bedrock Agent Runtime client for knowledge base interactions
 * @returns Configured Bedrock Agent Runtime client
 */
export const createBedrockAgentClient = (): BedrockAgentRuntimeClient => {
  return new BedrockAgentRuntimeClient({
    region: environment.aws.region
  });
};

// Create a BedrockAgentRuntimeClient instance
export const bedrockAgentClient = createBedrockAgentClient(); 