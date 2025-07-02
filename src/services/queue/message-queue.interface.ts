/**
 * Message Queue Service Interface
 * Defines the contract for any message queue implementation
 * Following the Dependency Inversion principle
 */
export interface IMessageQueueService {
  /**
   * Send a message to the queue
   * @param message The message object to send
   * @returns Promise with message ID
   */
  sendMessage(message: any): Promise<string>;
  
  /**
   * Receive messages from the queue
   * @param maxMessages Maximum number of messages to receive
   * @returns Promise with received messages
   */
  receiveMessages(maxMessages?: number): Promise<any[]>;
  
  /**
   * Delete a message from the queue
   * @param messageId The ID of the message to delete
   * @returns Promise indicating success
   */
  deleteMessage(messageId: string): Promise<boolean>;
} 