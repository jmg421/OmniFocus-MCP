import { z } from 'zod';
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { addOmniFocusTask } from '../primitives/addOmniFocusTask.js';

export const schema = z.object({
  name: z.string().describe("The name of the task"),
  note: z.string().optional().describe("Additional notes for the task"),
  dueDate: z.string().optional().describe("The due date of the task in ISO format (YYYY-MM-DD or full ISO date)"),
  deferDate: z.string().optional().describe("The defer date of the task in ISO format (YYYY-MM-DD or full ISO date)"),
  flagged: z.boolean().optional().describe("Whether the task is flagged or not"),
  estimatedMinutes: z.number().optional().describe("Estimated time to complete the task, in minutes"),
  tags: z.array(z.string()).optional().describe("Tags to assign to the task"),
  projectName: z.string().optional().describe("The name of the project to add the task to (will add to inbox if not specified)")
});

export const handler = async (args: z.infer<typeof schema>, extra: RequestHandlerExtra) => {
  console.error("TEST LOG FROM ADD_TASK HANDLER ENTRY (using console.error)");
  console.error("[ADD_TASK_HANDLER_DEBUG] addOmniFocusTask handler entered with args (using console.error):", args);
  try {
    // Call the addOmniFocusTask function 
    const result = await addOmniFocusTask(args);
    
    if (result.success) {
      // Task was added successfully
      let locationText = args.projectName 
        ? `in project "${args.projectName}"` 
        : "in your inbox";
        
      let tagText = args.tags && args.tags.length > 0
        ? ` with tags: ${args.tags.join(', ')}`
        : "";
        
      let dueDateText = args.dueDate
        ? ` due on ${new Date(args.dueDate).toLocaleDateString()}`
        : "";
        
      return {
        content: [{
          type: "text" as const,
          text: `✅ Task "${args.name}" created successfully ${locationText}${dueDateText}${tagText}.`
        }]
      };
    } else {
      // Task creation failed
      return {
        content: [{
          type: "text" as const,
          text: `Failed to create task: ${result.error}`
        }],
        isError: true
      };
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[ADD_TASK_HANDLER_DEBUG] Tool execution error (using console.error): ${error.message}`);
    return {
      content: [{
        type: "text" as const,
        text: `Error creating task: ${error.message}`
      }],
      isError: true
    };
  }
} 