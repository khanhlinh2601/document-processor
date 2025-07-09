import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { environment } from "../configs/environment";

/**
 * Creates and configures a Bedrock Runtime client for LLM interactions
 * @returns Configured Bedrock Runtime client
 */
export const createBedrockClient = (): BedrockRuntimeClient => {
  return new BedrockRuntimeClient({
    region: environment.aws.region
  });
};

/**
 * Get the configured Bedrock client
 */
export const bedrockClient = createBedrockClient(); 