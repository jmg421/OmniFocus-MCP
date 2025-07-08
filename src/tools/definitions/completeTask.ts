import { z } from 'zod';
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { spawn } from 'child_process';
import * as path from 'path';
// import * as fs from 'fs'; // fs.existsSync is removed for now

// __dirname is globally available in CommonJS, no need for custom implementation.

// Define the schema for the input parameters
export const schema = z.object({
  task_id: z.string().describe("The ID of the OmniFocus task to mark as complete."),
});

// Define the type for the input parameters based on the schema
type Params = z.infer<typeof schema>;

// Define the MCP-compliant response structure
interface McpToolResponse {
  [x: string]: unknown; // Added index signature to match expected type for ToolCallback
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
  // We can add other MCP-standard fields here if needed, like _meta
}

export async function handle(
  params: Params,
  extra: RequestHandlerExtra
): Promise<McpToolResponse> {
  const { task_id } = params;
  
  console.error(`[MCPTool:completeTask] Attempting to complete OmniFocus task with ID: ${task_id}`);
  // const currentCwd = process.cwd(); // Removed, as it was misleading
  // console.error(`[MCPTool:completeTask] Current process.cwd(): ${currentCwd}`);
  console.error(`[MCPTool:completeTask] Calculated __dirname: ${__dirname}`);

  const SCRIPT_NAME = 'complete_task_reference.applescript';
  
  // Resolve a base path for the OmniFocus-MCP module using the new __dirname
  const moduleRoot = path.resolve(__dirname, '..', '..', '..'); 
  const scriptPath = path.join(moduleRoot, 'scripts', SCRIPT_NAME);

  console.error(`[MCPTool:completeTask] Resolved moduleRoot (from __dirname): ${moduleRoot}`);
  console.error(`[MCPTool:completeTask] Attempting to use scriptPath (from __dirname): ${scriptPath}`);

  // Basic check if script exists - KEEPING THIS COMMENTED OUT FOR NOW
  // console.error(`[MCPTool:completeTask] Value of scriptPath just before fs.existsSync: ${scriptPath}`); 
  // if (!fs.existsSync(scriptPath)) {
  //   console.error(`[MCPTool:completeTask] fs.existsSync returned false for: ${scriptPath}`); 
  //   const errorMsg = `AppleScript file not found at: ${scriptPath}`;
  //   console.error(`[MCPTool:completeTask] Error: ${errorMsg}`);
  //   return { content: [{ type: 'text', text: errorMsg }], isError: true };
  // }

  return new Promise<McpToolResponse>((resolve) => {
    const process = spawn('osascript', [scriptPath, task_id]);

    let stdoutData = '';
    let stderrData = '';

    process.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error(`[MCPTool:completeTask] AppleScript STDERR: ${data.toString().trim()}`); // Log AppleScript 'log' statements
    });

    process.on('close', (code) => {
      console.error(`[MCPTool:completeTask] AppleScript process closed with code ${code}`);
      console.error(`[MCPTool:completeTask] AppleScript STDOUT: ${stdoutData.trim()}`);
      // stderrData has already been logged chunk by chunk

      if (code === 0) {
        // AppleScript executed successfully, now parse its string output
        const scriptOutput = stdoutData.trim();
        if (scriptOutput.startsWith("Success:")) {
          resolve({ content: [{ type: 'text', text: scriptOutput }] });
        } else if (scriptOutput.startsWith("Error:")) {
          resolve({ content: [{ type: 'text', text: scriptOutput }], isError: true });
        } else if (scriptOutput === "" && stderrData.match(/(error|ExecutionError)/i)){
           resolve({ content: [{ type: 'text', text: `AppleScript execution error. STDERR: ${stderrData.trim()}` }], isError: true });
        } else {
          // Unexpected output from AppleScript
          resolve({ content: [{ type: 'text', text: `Unexpected output from AppleScript: ${scriptOutput || '[No STDOUT]'}. STDERR: ${stderrData.trim() || '[No STDERR]'}` }], isError: true });
        }
      } else {
        // osascript itself failed (e.g., script not found, syntax error before execution)
        resolve({ content: [{ type: 'text', text: `osascript failed with code ${code}. STDERR: ${stderrData.trim()}` }], isError: true });
      }
    });

    process.on('error', (err) => {
      console.error(`[MCPTool:completeTask] Failed to start AppleScript process: ${err.message}`);
      resolve({ content: [{ type: 'text', text: `Failed to start AppleScript process: ${err.message}` }], isError: true });
    });
  });
} 