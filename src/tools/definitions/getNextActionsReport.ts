import { z } from 'zod';
import { fetchNextActionsReport, McpOmnifocusDevGetNextActionsReportParams, OmnifocusDatabase } from '../dumpDatabase.js';
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js"; // ToolCallback is likely the main type needed.

// Define the Zod schema for the parameters
export const schema = z.object({
  hideCompleted: z.boolean().optional().describe("Set to false to show completed and dropped tasks (default: true)"),
  omnijsAppleScriptDelay: z.number().optional().describe("Override the default AppleScript delay for OmniJS plugin execution (default: 5 seconds for next_actions)")
});

// Infer the type of the parameters from the Zod schema
type ParamsType = z.infer<typeof schema>;

// Define the expected structure for the content part of the response
interface TextContent {
  type: "text";
  text: string;
  [key: string]: unknown; // MCP content items often allow arbitrary extra properties
}

// Define the expected overall structure of the tool's response
interface ToolResponse {
  content: TextContent[];
  [key: string]: unknown; // MCP responses might also allow arbitrary extra properties
}

// The RequestHandlerExtra, ServerRequest, ServerNotification types are inferred by TypeScript
// from the SDK's ToolCallback definition if they are part of it, even if not directly exportable.
export const handler: ToolCallback<typeof schema.shape> = async (
  args: ParamsType, 
  extra: any // Using 'any' for the 'extra' parameter as its precise type from SDK is unclear / not directly importable
): Promise<ToolResponse> => {
  // Assuming mcpContext and logger are properties of the 'extra' object.
  // This is a common pattern in SDKs.
  const mcpContext = extra.mcpContext;
  const logger = extra.logger;

  const result: OmnifocusDatabase = await fetchNextActionsReport(args as McpOmnifocusDevGetNextActionsReportParams, mcpContext, logger);
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
}; 