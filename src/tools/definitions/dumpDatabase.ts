import { z } from 'zod';
import { dumpDatabase } from '../dumpDatabase.js'; // Ensure this is uncommented
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types"; // Back to ServerRequest
import { spawn } from 'child_process'; // Added for local execAppleScript
import * as fs from 'fs'; // Added import
import * as path from 'path'; // Added import

// Local execAppleScript function using spawn
function execAppleScript(scriptBody: string): Promise<string> {
  // ---- START MCP DEBUG LOGGING (using console.error) ----
  console.error(`---> [MCP_SIMPLE_EXEC_APPLE_SCRIPT_DEBUG] Script body first 100 chars: ${scriptBody.substring(0, 100)}...`);
  // ---- END MCP DEBUG LOGGING ----
  return new Promise((resolve, reject) => {
    const process = spawn('osascript', ['-e', scriptBody]);
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      // ---- START MCP DEBUG LOGGING (using console.error) ----
      console.error(`---> [MCP_SIMPLE_EXEC_APPLE_SCRIPT_DEBUG] Process closed.`);
      console.error(`---> [MCP_SIMPLE_EXEC_APPLE_SCRIPT_DEBUG] Exit code: ${code}`);
      console.error(`---> [MCP_SIMPLE_EXEC_APPLE_SCRIPT_DEBUG] Stderr: "${stderr.trim()}"`);
      console.error(`---> [MCP_SIMPLE_EXEC_APPLE_SCRIPT_DEBUG] Stdout: "${stdout.trim()}"`);
      // ---- END MCP DEBUG LOGGING ----
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        // Try to parse AppleScript error from stderr
        const appleScriptErrorMatch = stderr.match(/script error:(.*)number(.*)/s) || stderr.match(/execution error:(.*)number(.*)/s);
        let errorMessage = stderr.trim();
        if (appleScriptErrorMatch && appleScriptErrorMatch[1]) {
            errorMessage = `AppleScript Error: ${appleScriptErrorMatch[1].trim()}`;
            if (appleScriptErrorMatch[2] && appleScriptErrorMatch[2].trim() !== "") {
                 errorMessage += ` (Error Number: ${appleScriptErrorMatch[2].trim()})`;
            }
        } else if (stderr.includes("osascript: ")) { // Catch direct osascript errors not fitting the pattern
            errorMessage = stderr.substring(stderr.indexOf("osascript: ") + "osascript: ".length).trim();
        }

        const error = new Error(`AppleScript execution failed with code ${code}. ${errorMessage}`);
        (error as any).stderr = stderr.trim();
        (error as any).stdout = stdout.trim(); 
        reject(error);
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
}


// Original schema - restored
export const schema = z.object({
  hideCompleted: z.boolean().optional().describe("Set to false to show completed and dropped tasks (default: true)"),
  hideRecurringDuplicates: z.boolean().optional().default(true).describe("Set to true to hide duplicate instances of recurring tasks (default: true)")
});

// Minimal schema for testing - commented out
// export const schema = z.object({
//   testParam: z.string().optional().describe("A dummy parameter for testing")
// });


// Original handler - restored
export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  // Logging needs to be addressed. For now, console.error is a placeholder.
  // The 'extra' object does not directly contain a logger or mcpContext.
  try {
    // TODO: Determine how to get McpContext and Logger to pass to dumpDatabase.
    // For now, passing undefined to allow compilation, assuming dumpDatabase can handle it or uses its own fallbacks.
    const database = await dumpDatabase(args, undefined /* McpContext */, undefined /* Logger */);
    
    // ---- START: Write database to omnifocus_export.json ----
    try {
      const workspaceRoot = process.cwd(); // Assume cwd is workspace root when handler runs
      const exportFilePath = path.join(workspaceRoot, 'data', 'omnifocus_export.json');
      // const exportFilePath = '/Users/johnmuirhead-gould/MasterPlan/data/omnifocus_export.json'; // REMOVED HARDCODED PATH
      const jsonString = JSON.stringify(database, null, 2);
      fs.writeFileSync(exportFilePath, jsonString, 'utf8');
      // console.error(`---> [MCP_HANDLER_DEBUG] Successfully wrote database to ${exportFilePath}`); // REMOVED DIAGNOSTIC LOG
    } catch (writeError: any) {
      console.error(`---> [MCP_HANDLER_ERROR] Failed to write omnifocus_export.json: ${writeError.message}`); // Kept error log
      // We'll log the error but not fail the whole report generation for now
      // extra.sendNotification({ type: 'warning', message: `Failed to update data/omnifocus_export.json: ${writeError.message}`});
    }
    // ---- END: Write database to omnifocus_export.json ----
    
    const report = formatCompactReport(database, {
      hideCompleted: args.hideCompleted !== false,
      hideRecurringDuplicates: args.hideRecurringDuplicates !== false
    });
    
    return {
      content: [{
        type: "text" as const,
        text: report
      }]
    };
  } catch (err: unknown) {
    let errorMessage = "Error generating report. Please ensure OmniFocus is running and try again.";
    if (err instanceof Error) {
      errorMessage = `Handler Error: ${err.message}. Stack: ${err.stack}`;
    } else if (typeof err === 'string') {
      errorMessage = `Handler Error: ${err}`;
    } else {
      try {
        errorMessage = `Handler Error: ${JSON.stringify(err, null, 2)}`
      } catch (stringifyError) {
        errorMessage = `Handler Error: Could not stringify error object.`
      }
    }
    
    return {
      content: [{
        type: "text" as const,
        text: errorMessage // Return the detailed error message
      }],
      isError: true
    };
  }
}

// Minimal handler for testing - commented out
// export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra) {
//   console.error("MINIMAL DUMPDB HANDLER CALLED (using console.error) with args:", args);
//   // For now, just return a success message to see if this handler is reached
//   return {
//     content: [{
//       type: "text" as const,
//       text: "Minimal dumpDatabase handler executed successfully."
//     }]
//   };
// }

// Helper functions (uncommented)
// Function to format date in compact format (M/D)
function formatCompactDate(isoDate: string | null): string {
  if (!isoDate) return '';
  
  const date = new Date(isoDate);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// Function to format the database in the compact report format
function formatCompactReport(database: any, options: { hideCompleted: boolean, hideRecurringDuplicates: boolean }): string {
  const { hideCompleted, hideRecurringDuplicates } = options;
  
  // Get current date for the header
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  
  let output = `# OMNIFOCUS [${dateStr}]\n\n`;
  
  // Add legend
  output += `FORMAT LEGEND:\nF: Folder | P: Project | •: Task | 🚩: Flagged\nDates: [M/D] | Duration: (30m) or (2h) | Tags: <tag1,tag2>\nStatus: #next #avail #block #due #over #compl #drop\n\n`;
  
  // Map of folder IDs to folder objects for quick lookup
  const folderMap = new Map();
  Object.values(database.folders).forEach((folder: any) => {
    folderMap.set(folder.id, folder);
  });
  
  // Get all tag names to compute minimum unique prefixes
  const allTagNames = Object.values(database.tags).map((tag: any) => tag.name);
  const tagPrefixMap = computeMinimumUniquePrefixes(allTagNames);
  
  // Function to get folder hierarchy path 
  function getFolderPath(folderId: string): string[] {
    const path = [];
    let currentId = folderId;
    
    while (currentId) {
      const folder = folderMap.get(currentId);
      if (!folder) break;
      
      path.unshift(folder.name);
      currentId = folder.parentFolderID;
    }
    
    return path;
  }
  
  // Get root folders (no parent)
  const rootFolders = Object.values(database.folders).filter((folder: any) => !folder.parentFolderID);
  
  // Process folders recursively
  function processFolder(folder: any, level: number): string {
    const indent = '   '.repeat(level);
    let folderOutput = `${indent}F: ${folder.name}\n`;
    
    // Process subfolders
    if (folder.subfolders && folder.subfolders.length > 0) {
      for (const subfolderId of folder.subfolders) {
        const subfolder = database.folders[subfolderId];
        if (subfolder) {
          folderOutput += `${processFolder(subfolder, level + 1)}`;
        }
      }
    }
    
    // Process projects in this folder
    if (folder.projects && folder.projects.length > 0) {
      for (const projectId of folder.projects) {
        const project = database.projects[projectId];
        if (project) {
          folderOutput += processProject(project, level + 1);
        }
      }
    }
    
    return folderOutput;
  }
  
  // Process a project
  function processProject(project: any, level: number): string {
    const indent = '   '.repeat(level);
    
    // Skip if it\'s completed or dropped and we\'re hiding completed items
    if (hideCompleted && (project.status === 'Done' || project.status === 'Dropped')) {
      return '';
    }
    
    // Format project status info
    let statusInfo = '';
    if (project.status === 'OnHold') {
      statusInfo = ' [OnHold]';
    } else if (project.status === 'Dropped') {
      statusInfo = ' [Dropped]';
    }
    
    // Add due date if present
    if (project.dueDate) {
      const dueDateStr = formatCompactDate(project.dueDate);
      statusInfo += statusInfo ? ` [DUE:${dueDateStr}]` : ` [DUE:${dueDateStr}]`;
    }
    
    // Add flag if present
    const flaggedSymbol = project.flagged ? ' 🚩' : '';
    
    let projectOutput = `${indent}P: ${project.name}${flaggedSymbol}${statusInfo}\n`;
    
    // Process tasks in this project
    const projectTasks = database.tasks.filter((task: any) => 
      task.projectId === project.id && !task.parentId
    );
    
    if (projectTasks.length > 0) {
      for (const task of projectTasks) {
        projectOutput += processTask(task, level + 1);
      }
    }
    
    return projectOutput;
  }
  
  // Process a task
  function processTask(task: any, level: number): string {
    const indent = '   '.repeat(level);
    
    // Skip if it\'s completed or dropped and we\'re hiding completed items
    if (hideCompleted && (task.completed || task.taskStatus === 'Completed' || task.taskStatus === 'Dropped')) {
      return '';
    }
    
    // Flag symbol
    const flagSymbol = task.flagged ? '🚩 ' : '';
    
    // Format dates
    let dateInfo = '';
    if (task.dueDate) {
      const dueDateStr = formatCompactDate(task.dueDate);
      dateInfo += ` [DUE:${dueDateStr}]`;
    }
    if (task.deferDate) {
      const deferDateStr = formatCompactDate(task.deferDate);
      dateInfo += ` [defer:${deferDateStr}]`;
    }
    
    // Format duration
    let durationStr = '';
    if (task.estimatedMinutes) {
      // Convert to hours if >= 60 minutes
      if (task.estimatedMinutes >= 60) {
        const hours = Math.floor(task.estimatedMinutes / 60);
        durationStr = ` (${hours}h)`;
      } else {
        durationStr = ` (${task.estimatedMinutes}m)`;
      }
    }
    
    // Format tags
    let tagsStr = '';
    if (task.tagNames && task.tagNames.length > 0) {
      // Use minimum unique prefixes for tag names
      const abbreviatedTags = task.tagNames.map((tag: string) => {
        return tagPrefixMap.get(tag) || tag;
      });
      
      tagsStr = ` <${abbreviatedTags.join(',')}>`;
    }
    
    // Format status
    let statusStr = '';
    switch (task.taskStatus) {
      case 'Next':
        statusStr = ' #next';
        break;
      case 'Available':
        statusStr = ' #avail';
        break;
      case 'Blocked':
        statusStr = ' #block';
        break;
      case 'DueSoon':
        statusStr = ' #due';
        break;
      case 'Overdue':
        statusStr = ' #over';
        break;
      case 'Completed':
        statusStr = ' #compl';
        break;
      case 'Dropped':
        statusStr = ' #drop';
        break;
    }
    
    let taskOutput = `${indent}• ${flagSymbol}${task.name}${dateInfo}${durationStr}${tagsStr}${statusStr}\n`;
    
    // Process subtasks
    if (task.childIds && task.childIds.length > 0) {
      const childTasks = database.tasks.filter((t: any) => task.childIds.includes(t.id));
      
      for (const childTask of childTasks) {
        taskOutput += processTask(childTask, level + 1);
      }
    }
    
    return taskOutput;
  }
  
  // Process all root folders
  for (const folder of rootFolders) {
    output += processFolder(folder, 0);
  }
  
  // Process projects not in any folder (if any)
  const rootProjects = Object.values(database.projects).filter((project: any) => !project.folderID);
  
  for (const project of rootProjects) {
    output += processProject(project, 0);
  }
  
  return output;
}

// Compute minimum unique prefixes for all tags (minimum 3 characters)
function computeMinimumUniquePrefixes(tagNames: string[]): Map<string, string> {
  const prefixMap = new Map<string, string>();
  
  // For each tag name
  for (const tagName of tagNames) {
    // Start with minimum length of 3
    let prefixLength = 3;
    let isUnique = false;
    
    // Keep increasing prefix length until we find a unique prefix
    while (!isUnique && prefixLength <= tagName.length) {
      const prefix = tagName.substring(0, prefixLength);
      
      // Check if this prefix uniquely identifies the tag
      isUnique = tagNames.every(otherTag => {
        // If it\'s the same tag, skip comparison
        if (otherTag === tagName) return true;
        
        // If the other tag starts with the same prefix, it\'s not unique
        return !otherTag.startsWith(prefix);
      });
      
      if (isUnique) {
        prefixMap.set(tagName, prefix);
      } else {
        prefixLength++;
      }
    }
    
    // If we couldn\'t find a unique prefix, use the full tag name
    if (!isUnique) {
      prefixMap.set(tagName, tagName);
    }
  }
  
  return prefixMap;
} 