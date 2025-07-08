import { z } from 'zod';
import { Request, Notification } from '@modelcontextprotocol/sdk/types.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";

export const schema = z.object({
  random_string: z.string().optional().describe("A random string to include in the log")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra) {
  const message = `Minimal dummy handler executed. Input: ${args.random_string || 'N/A'}`;
  
  console.error("Tool: dummy_log_test_v2 (using console.error), Result:", message); 
  
  // Log the 'extra' object to see its structure
  // console.error("[dummyLogTestHandler] Logging 'extra' object:", JSON.stringify(extra, null, 2));

  // Attempt to use extra.logger if it looks like it might exist and have methods
  // This is speculative and needs to be checked based on the output of the above log
  // This section should be removed or updated once proper logger access is determined
  /*
  if (extra && typeof (extra as any).logger === 'object' && typeof (extra as any).logger.error === 'function') {
    (extra as any).logger.error("Tool: dummy_log_test_v2 (using extra.logger.error), Result:", message);
  } else {
    console.error("[dummyLogTestHandler] extra.logger.error is not available.");
  }
  */

  return {
    content: [{
      type: "text" as const,
      text: message
    }]
  };
}

// New function for direct testing
export function directLogTest(message: string) {
  console.error(`[DIRECT_LOG_TEST_FROM_MODULE] ${message}`);
} 