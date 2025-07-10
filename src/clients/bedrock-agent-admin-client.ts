import { BedrockAgentClient } from '@aws-sdk/client-bedrock-agent';
import { environment } from '../configs/environment';

/**
 * Creates and configures a Bedrock Agent client for knowledge base administration
 * @returns Configured Bedrock Agent client
 */
export const createBedrockAgentAdminClient = (): BedrockAgentClient => {
  return new BedrockAgentClient({
    region: environment.aws.region
  });
};

// Create a BedrockAgentClient instance
export const bedrockAgentAdminClient = createBedrockAgentAdminClient(); 