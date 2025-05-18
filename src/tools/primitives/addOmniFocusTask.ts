import { exec } from 'child_process';
import { promisify } from 'util';
import { formatDateForAppleScript, isValidDate, normalizeDate } from '../../utils/dateFormatting.js';
const execAsync = promisify(exec);

// Interface for task creation parameters
export interface AddOmniFocusTaskParams {
  name: string;
  note?: string;
  dueDate?: string; // ISO date string (YYYY-MM-DD or full ISO)
  deferDate?: string; // ISO date string (YYYY-MM-DD or full ISO)
  flagged?: boolean;
  estimatedMinutes?: number;
  tags?: string[]; // Tag names
  projectName?: string; // Project name to add task to
}

/**
 * Generate pure AppleScript for task creation
 */
function generateAppleScript(params: AddOmniFocusTaskParams): string {
  // Validate and normalize dates
  let normalizedDueDate: string | undefined;
  let normalizedDeferDate: string | undefined;
  
  if (params.dueDate) {
    const normalized = normalizeDate(params.dueDate);
    if (normalized === null) {
      throw new Error(`Invalid due date format: ${params.dueDate}`);
    }
    normalizedDueDate = normalized;
  }
  
  if (params.deferDate) {
    const normalized = normalizeDate(params.deferDate);
    if (normalized === null) {
      throw new Error(`Invalid defer date format: ${params.deferDate}`);
    }
    normalizedDeferDate = normalized;
  }

  // Sanitize and prepare parameters for AppleScript
  const name = params.name.replace(/['"\\]/g, '\\$&'); // Escape quotes and backslashes
  const note = params.note?.replace(/['"\\]/g, '\\$&') || '';
  const dueDate = normalizedDueDate ? formatDateForAppleScript(normalizedDueDate) : '';
  const deferDate = normalizedDeferDate ? formatDateForAppleScript(normalizedDeferDate) : '';
  const flagged = params.flagged === true;
  const estimatedMinutes = params.estimatedMinutes?.toString() || '';
  const tags = params.tags || [];
  const projectName = params.projectName?.replace(/['"\\]/g, '\\$&') || '';
  
  // Construct AppleScript with error handling
  let script = `
  try
    tell application "OmniFocus"
      tell front document
        -- Determine the container (inbox or project)
        if "${projectName}" is "" then
          -- Use inbox of the document
          set newTask to make new inbox task with properties {name:"${name}"}
        else
          -- Use specified project
          try
            set theProject to first flattened project where name = "${projectName}"
            set newTask to make new task with properties {name:"${name}"} at end of tasks of theProject
          on error
            return "{\\\"success\\\":false,\\\"error\\\":\\\"Project not found: ${projectName}\\\"}"
          end try
        end if
        
        -- Set task properties
        ${note ? `set note of newTask to "${note}"` : ''}
        ${dueDate ? `set due date of newTask to date "${dueDate}"` : ''}
        ${deferDate ? `set defer date of newTask to date "${deferDate}"` : ''}
        ${flagged ? `set flagged of newTask to true` : ''}
        ${estimatedMinutes ? `set estimated minutes of newTask to ${estimatedMinutes}` : ''}
        
        -- Add tags if specified
        ${tags.length > 0 ? `
          repeat with tagName in {"${tags.join('","')}"}
            try
              set theTag to first flattened tag where name = tagName
              assign theTag to newTask
            end try
          end repeat
        ` : ''}
        
        return "{\\\"success\\\":true,\\\"message\\\":\\\"Task created successfully\\\"}"
      end tell
    end tell
  on error errMsg
    return "{\\\"success\\\":false,\\\"error\\\":\\\"" & errMsg & "\\\"}"
  end try`
  
  return script;
}

/**
 * Add a task to OmniFocus
 */
export async function addOmniFocusTask(params: AddOmniFocusTaskParams): Promise<{ success: boolean, error?: string }> {
  try {
    const script = generateAppleScript(params);
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    
    try {
      const result = JSON.parse(stdout);
      return result;
    } catch (e: Error | unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      return { success: false, error: `Failed to parse AppleScript result: ${stdout}. Error: ${errorMessage}` };
    }
  } catch (e: Error | unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return { success: false, error: errorMessage };
  }
} 