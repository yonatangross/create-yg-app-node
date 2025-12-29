/**
 * Type augmentations for @langfuse/langchain
 *
 * The CallbackHandler class has properties that exist at runtime
 * but are not fully typed in the library's declarations.
 */

import '@langfuse/langchain';

declare module '@langfuse/langchain' {
  interface CallbackHandler {
    /**
     * Trace ID for the current trace session
     */
    traceId: string;

    /**
     * Langfuse client instance
     */
    langfuse: import('langfuse').Langfuse;

    /**
     * Flush pending events to Langfuse
     */
    flushAsync(): Promise<void>;

    /**
     * Shutdown and flush
     */
    shutdownAsync(): Promise<void>;
  }
}
