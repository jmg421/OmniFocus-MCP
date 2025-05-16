import { exec } from 'child_process';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
// import { McpContext, Logger } from '@mcp/core'; // Temporarily commented out

// --- Start of Local Type Definitions ---
// If these types exist centrally, these local definitions can be removed later
// and replaced with imports once the central paths/exports are confirmed.

// Parameters for the main function (simplified if import fails)
export interface McpOmnifocusDevGetFullOmnifocusReportParams {
  hideCompleted?: boolean;
  hideRecurringDuplicates?: boolean;
  // Add other params if any
  filterType?: 'full_dump' | 'next_actions'; // Added for explicit control
  omnijsAppleScriptDelay?: number; // Added to control AppleScript delay
}

// Interface for criteria passed to OmniJS
interface OmniJSFilterCriteria {
  type: 'full_dump' | 'next_actions';
  hideCompleted?: boolean;
  // Future criteria can be added here, e.g.:
  // includeFlagged?: boolean;
  // dueBefore?: string; // ISO date string
  // projectIds?: string[];
  // tagIds?: string[];
}

export interface OmnifocusTag {
  id: string;
  name: string;
  // Add other relevant tag properties
}

export interface OmnifocusTaskTag {
    taskId: string;
    tagId: string;
}

export interface OmnifocusTask {
  id: string;
  name: string;
  status: string; // Crucial for filtering logic
  // Add other relevant task properties like notes, dates, projectID, parentID, childrenIDs, tags (array of tag IDs or names)
  note?: string;
  dueDate?: string | null;
  deferDate?: string | null;
  completedDate?: string | null;
  projectId?: string | null;
  parentId?: string | null;
  childIds?: string[];
  tagIds?: string[];
  flagged?: boolean;
  estimatedMinutes?: number | null;
  // ... other properties based on what your plugin actually provides and what you need
}

export interface OmnifocusProject {
  id: string;
  name: string;
  status: string; // e.g., 'Active', 'Completed', 'OnHold', 'Dropped'
  tasks: OmnifocusTask[]; // Tasks belonging to this project
  note?: string; // Added to match usage
  dueDate?: string | null; // Added to match usage
  deferDate?: string | null; // Added to match usage
  completedDate?: string | null; // Added to match usage
  flagged?: boolean; // Added to match usage
}

export interface OmnifocusFolder {
  id: string;
  name: string;
  parentFolderID?: string | null; // Added to match usage
}

// This is the structure the AppleScript/OmniJS is expected to return (a JSON string of this)
export interface OmnifocusDumpData {
  version: string;
  timestamp: string;
  folders: Record<string, OmnifocusFolder>;
  projects: Record<string, OmnifocusProject>;
  tasks: OmnifocusTask[]; 
  inboxTasks: OmnifocusTask[]; 
  tags: Record<string, OmnifocusTag>;
  taskTags: OmnifocusTaskTag[]; // If you have a separate mapping for task-tag relations
}

// This is the final structure this MCP tool will return
export interface OmnifocusDatabase extends OmnifocusDumpData {}

// --- End of Local Type Definitions ---


// Promisified version of exec
function execAsyncAndCapture(command: string): Promise<string> { // Removed logger argument
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        const message = stdout && stdout.trim().toLowerCase().includes("error")
          ? `AppleScript execution failed: ${stdout.trim()}. stderr: ${stderr.trim()}`
          : `Failed to execute AppleScript process: ${error.message}. stderr: ${stderr.trim()}`;
        reject(new Error(message));
        return;
      }
      if (stderr && !stderr.toLowerCase().includes('running in background')) { 
        //console.debug(`[execAsyncAndCapture] AppleScript stderr: ${stderr.trim()}`); // Changed to //console.debug
        if (stderr.toLowerCase().includes("error:")) {
            reject(new Error(`AppleScript stderr reported an error: ${stderr.trim()}`));
            return;
        }
      }
      if (stdout.trim().toLowerCase().startsWith("applescript error") || stdout.trim().toLowerCase().startsWith("omnijs_error:")) {
        reject(new Error(`${stdout.trim()}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

// Promisified version of spawn for osascript, now using a temporary file
async function execAppleScript(scriptBody: string): Promise<string> {
  const normalizedScriptBody = scriptBody.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const tempFileName = `mcp_applescript_temp_${Date.now()}.applescript`;
  
  const currentModulePath = new URL(import.meta.url).pathname;
  const currentDir = path.dirname(currentModulePath);

  const tempDir = path.join(currentDir, '..', 'tmp_applescripts_mcp'); 

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const tempFilePath = path.join(tempDir, tempFileName);

  try {
    fs.writeFileSync(tempFilePath, normalizedScriptBody, { encoding: 'utf8' });
  } catch (writeError: any) {
    return Promise.reject(new Error(`Failed to write temporary AppleScript file: ${writeError.message}`));
  }
  
  return new Promise<string>((resolve, reject) => {
    const process = spawn('osascript', [tempFilePath]);
    const stdoutChunks: Buffer[] = [];
    let stderr = '';

    process.stdout.on('data', (data: Buffer) => { stdoutChunks.push(data); });
    process.stderr.on('data', (data) => { stderr += data.toString(); });

    process.on('close', (code) => {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupError: any) {
        console.error(`Failed to delete temporary AppleScript file: ${tempFilePath}. Error: ${cleanupError.message}`); // Keep this error log
      }

      const fullStdout = Buffer.concat(stdoutChunks).toString('utf8');

      if (stderr.trim() && !stderr.toLowerCase().includes('running in background')) {
        //console.debug(`[execAppleScript] AppleScript stderr: ${stderr.trim()}`); // Changed to //console.debug
        if (stderr.toLowerCase().includes("error:") || stderr.toLowerCase().includes("(-2741)") || stderr.toLowerCase().includes("(-1728)")) {
          reject(new Error(`AppleScript process reported an error in stderr: ${stderr.trim()}`));
          return;
        }
      }
      if (code !== 0) {
        if (fullStdout.trim().toLowerCase().startsWith("applescript error")) {
          reject(new Error(fullStdout.trim()));
        } else {
          reject(new Error(`osascript process exited with code ${code}. stderr: ${stderr.trim()}. stdout: ${fullStdout.trim()}`));
        }
        return;
      }
      if (fullStdout.trim().toLowerCase().startsWith("applescript error") || fullStdout.trim().toLowerCase().startsWith("omnijs_error:")) {
        reject(new Error(`${fullStdout.trim()}`));
        return;
      }
      resolve(fullStdout.trim());
    });

    process.on('error', (err) => {
      try { 
        if (fs.existsSync(tempFilePath)) { 
          fs.unlinkSync(tempFilePath); 
        }
      } catch (cleanupError: any) {
        console.error(`Failed to delete temporary AppleScript file on process error: ${tempFilePath}. Error: ${cleanupError.message}`); // Keep this error log
      }
      reject(new Error(`Failed to start osascript process: ${err.message}`));
    });
  });
}

// Helper function to transform OmniJS task-like objects to OmnifocusTask
function transformOmniJsTaskToOmnifocusTask(jsTask: any): OmnifocusTask {
  if (!jsTask) {
    return {
      id: `invalid-task-${Date.now()}-${Math.random()}`,
      name: 'Invalid Task Data (jsTask was null/undefined)',
      status: 'Unknown',
      childIds: [],
      tagIds: [],
      flagged: false,
    };
  }
  return {
    id: jsTask.id || `generated-task-id-${Math.random()}`,
    name: jsTask.name || 'Untitled Task',
    // OmniJS status seems to be taskStatus like "Active", "Completed", etc.
    // formatCompactReport uses task.completed (boolean) OR task.taskStatus === 'Completed'/'Dropped'
    // It also uses task.taskStatus for #next, #avail etc.
    // Let's try to align with what formatCompactReport might look for in task.status or task.taskStatus
    status: jsTask.taskStatus || jsTask.status || 'Unknown', // Prefer taskStatus if present
    note: jsTask.note || jsTask.notes, // OmniJS might use 'notes'
    dueDate: jsTask.dueDate,
    deferDate: jsTask.deferDate,
    completedDate: jsTask.completionDate, // OmniJS uses 'completionDate'
    projectId: jsTask.containingProject?.id || jsTask.projectId, // OmniJS structure might have project in `containingProject`
    parentId: jsTask.parentTask?.id || jsTask.parentId,
    childIds: (jsTask.tasks || jsTask.subTasks || []).map((t: any) => t.id).filter(Boolean), // Ensure IDs are valid
    tagIds: (jsTask.tags || []).map((t: any) => t.id).filter(Boolean), // OmniJS tags are objects with id
    estimatedMinutes: jsTask.estimatedMinutes,
    flagged: jsTask.flagged === undefined ? false : jsTask.flagged, // Default to false
  };
}

// Main function to dump the database
export async function dumpDatabase(
  params: McpOmnifocusDevGetFullOmnifocusReportParams,
  _mcpContext: any, // Reverted to any
  _logger: any, // Reverted to any
): Promise<OmnifocusDatabase> {
  //console.debug("[DUMPDB] Attempting to dump OmniFocus database...");

  try {
    // For pgrep, exec is still fine as it's a simple command.
    // We need a separate simple exec promise for this, or adapt execAppleScript.
    // For simplicity, let's use a quick promisified exec for pgrep.
    await new Promise<void>((resolve, reject) => {
        spawn('pgrep', ['-x', 'OmniFocus']).on('close', code => code === 0 ? resolve() : reject(new Error('OmniFocus process not found by pgrep.')));
    });
    //console.debug("[DUMPDB] OmniFocus process found."); // Changed to //console.debug
  } catch (error) {
    console.error("[DUMPDB] OmniFocus does not appear to be running or pgrep failed."); // Keep this as error
    throw new Error("OmniFocus is not running or process check failed. Please start OmniFocus and try again.");
  }

  const filterTypeForPlugin = params.filterType || 'next_actions'; // Default to 'next_actions' for optimization

  const filterCriteria: OmniJSFilterCriteria = {
    type: filterTypeForPlugin,
    hideCompleted: params.hideCompleted === true,
  };

  // Escape the JSON string for safe inclusion in an AppleScript string literal
  const filterCriteriaJSONString = JSON.stringify(filterCriteria)
    .replace(/\\/g, '\\\\\\\\') // Escape backslashes
    .replace(/"/g, '\\\\"');   // Escape double quotes

  const appleScriptDelay = params.omnijsAppleScriptDelay !== undefined ? params.omnijsAppleScriptDelay : (filterTypeForPlugin === 'next_actions' ? 5 : 30);


  // The AppleScript body.
  const appleScriptBody = `
on encode_text(theText)
    set oldDelimiters to AppleScript's text item delimiters
    set AppleScript's text item delimiters to ""
    set theChars to characters of theText
    set theResult to ""
    set HCHARS to "0123456789ABCDEF" -- Hex characters for percent encoding
    repeat with aChar in theChars
        set cID to id of aChar
        if (cID ≥ 48 and cID ≤ 57) or ¬
           (cID ≥ 65 and cID ≤ 90) or ¬
           (cID ≥ 97 and cID ≤ 122) or ¬
           cID = 45 or cID = 46 or cID = 95 or cID = 126 then -- Unreserved character
            set theResult to theResult & aChar as string
        else
            set H to (cID div 16) + 1
            set L to (cID mod 16) + 1
            set theResult to theResult & "%" & (character H of HCHARS) & (character L of HCHARS)
        end if
    end repeat
    set AppleScript's text item delimiters to oldDelimiters
    return theResult
end encode_text

try
    set pluginId to "com.jmg.exportmasterplan.v11.final"
    set DQUOTE to character id 34

    -- The JSON criteria string, already escaped for AppleScript from TypeScript
    set jsCriteriaString to "${filterCriteriaJSONString}"
    
    tell application "OmniFocus"
        if not (exists front document) then
            error "OmniFocus has no front document. Please open a window to run the script."
        end if
        
        -- Pass the criteria JSON string to the OmniJS plugin's perform method.
        -- The plugin's perform(arg) method will receive this string and should JSON.parse(arg).
        set jsCore to "PlugIn.find(" & DQUOTE & pluginId & DQUOTE & ").actions[0].perform(" & DQUOTE & jsCriteriaString & DQUOTE & ");"
        set encodedOmniJs to my encode_text(jsCore)
        set theURL to "omnifocus://localhost/omnijs-run?script=" & encodedOmniJs

        -- Try to execute GetURL
        try
            GetURL theURL
        on error errMsgOpen number errNumOpen
            error "AppleScript Error during GetURL: " & errMsgOpen & " (Number: " & errNumOpen & ")"
        end try
        
    end tell

    -- Wait for the plugin to execute and copy to clipboard.
    -- Reduced delay significantly if 'next_actions' is requested, assuming faster plugin execution.
    delay ${appleScriptDelay}

    -- Get the contents from the clipboard
    try
        set clipboardContent to (the clipboard as text) -- Ensure it's treated as text
        
        if clipboardContent is "" then
            error "AppleScript Error: Clipboard was empty after plugin execution and delay."
        end if
        
        -- Check if the clipboard content is the specific success message from the plugin
        -- This indicates the plugin ran but didn't output the JSON as expected (e.g. an error occurred within the plugin before JSON generation)
        if clipboardContent starts with "SUCCESS: JSON data copied to clipboard" then
            -- This is a bit of a special case. The plugin itself signals success in copying,
            -- but this AppleScript is supposed to return the *JSON data itself*.
            -- This state indicates the clipboard *was* written to by the plugin, but not with the JSON.
            -- Or, more likely, this script ran *too fast* and got the *previous* clipboard content
            -- if the plugin hadn't updated it yet. The delay above should help, but this check is a safeguard.
            -- For now, we'll treat this as an error because we expect the JSON.
            error "AppleScript Error: Clipboard contained plugin success message, not JSON data. Plugin might have errored internally or clipboard not updated in time. Content: " & clipboardContent
        end if

        return clipboardContent
        
    on error errMsgClipboard number errNumClipboard
        error "AppleScript Error: Could not read from clipboard or clipboard content was invalid. Error (" & errNumClipboard & "): " & errMsgClipboard
    end try

on error errorMessage number errorNumber
    return "AppleScript Error (Number: " & errorNumber & "): " & errorMessage
end try
`;

  //console.debug("[DUMPDB] AppleScript body prepared. Executing via spawn..."); // Changed to //console.debug
  // Moved logging here
  // console.error("--- BEGIN AppleScript Body ---"); // Removing this block
  // console.error(appleScriptBody); 
  // console.error("--- END AppleScript Body ---");

  const jsonResult = await execAppleScript(appleScriptBody);
  // console.error(`[DUMPDB_DEBUG] Raw result from AppleScript: "${jsonResult}"`); // Already removed this type of log

  let dataFromOmniJS: any;
  try {
      // console.error(`[DUMPDB_DEBUG] Attempting to parse result from AppleScript: "${jsonResult}"`);
      dataFromOmniJS = JSON.parse(jsonResult);
  } catch (parseError: any) {
      console.error(`[DUMPDB_DEBUG] JSON.parse failed. Original AppleScript output was: "${jsonResult}". Error: ${parseError.message}`); // Keep critical error
      throw new Error(`Failed to parse AppleScript output as JSON. Output: "${jsonResult}". Parse Error: ${parseError.message}`);
  }
 
  // --- BEGIN Adapted Transformation Logic ---
  let transformedFoldersMap: Record<string, OmnifocusFolder> = {};
  let transformedProjectsMap: Record<string, OmnifocusProject> = {};
  let transformedInboxTasks: OmnifocusTask[] = [];
  let allTransformedTasks: OmnifocusTask[] = [];
  let transformedTagsMap: Record<string, OmnifocusTag> = {};

  // Check if data seems to be from an updated plugin returning filtered data directly
  // The OmniJS plugin, when updated, should return a structure like:
  // { version: "omni-js-filtered-...", timestamp: "...", criteriaUsed: { ... }, 
  //   tasks: [], projects: {}, folders: {}, tags: {}, inboxTasks: [] }
  const isFilteredPayload = dataFromOmniJS.criteriaUsed && dataFromOmniJS.version?.startsWith('omni-js-filtered');

  if (isFilteredPayload && filterCriteria.type === 'next_actions') {
    //console.debug("[DUMPDB] Processing optimized/filtered payload from OmniJS plugin.");

    // Directly use folders if provided in the expected format, or transform if needed
    if (dataFromOmniJS.folders) {
        for (const folderId in dataFromOmniJS.folders) {
            const omniJsFolder = dataFromOmniJS.folders[folderId];
            transformedFoldersMap[folderId] = {
                id: omniJsFolder.id || folderId,
                name: omniJsFolder.name || "Untitled Folder",
                parentFolderID: omniJsFolder.parentFolderID || omniJsFolder.parent?.id || null,
            };
        }
    }

    // Directly use projects, transform their tasks
    if (dataFromOmniJS.projects) {
        for (const projectId in dataFromOmniJS.projects) {
            const omniJsProject = dataFromOmniJS.projects[projectId];
            transformedProjectsMap[projectId] = {
                id: omniJsProject.id || projectId,
                name: omniJsProject.name || 'Untitled Project',
                status: omniJsProject.status || 'Unknown',
                tasks: (omniJsProject.tasks || []).map(transformOmniJsTaskToOmnifocusTask),
                note: omniJsProject.note,
                dueDate: omniJsProject.dueDate,
                deferDate: omniJsProject.deferDate,
                completedDate: omniJsProject.completionDate,
                flagged: omniJsProject.flagged === undefined ? false : omniJsProject.flagged,
            };
        }
    }
    
    transformedInboxTasks = (dataFromOmniJS.inboxTasks || []).map(transformOmniJsTaskToOmnifocusTask);

    allTransformedTasks = [...transformedInboxTasks];
    Object.values(transformedProjectsMap).forEach(p => {
        if (p && p.tasks) {
            allTransformedTasks = allTransformedTasks.concat(p.tasks);
        }
    });
    
    // Directly use tags if provided
    if (dataFromOmniJS.tags) {
        for (const tagId in dataFromOmniJS.tags) {
            const omniJsTag = dataFromOmniJS.tags[tagId];
            transformedTagsMap[tagId] = {
                id: omniJsTag.id || tagId,
                name: omniJsTag.name || "Untitled Tag",
            };
        }
    }
    // TaskTags would also need to be sourced if the filtered payload provides them
    // For now, assuming dataFromOmniJS.taskTags if present, or an empty array.
    // This part might need more fleshing out based on what the OmniJS plugin returns for taskTags.


  } else {
    //console.debug("[DUMPDB] Processing full payload from OmniJS plugin (legacy or 'full_dump' mode).");
    // Fallback to existing transformation logic for full dump
    (dataFromOmniJS.structure?.topLevelFolders || []).forEach((f: any) => {
      if (f && f.id) {
        transformedFoldersMap[f.id] = {
          id: f.id,
          name: f.name || "Untitled Folder",
          parentFolderID: f.parentFolder?.id || null,
        };
      }
    });
    const allOmniJsFoldersList: any[] = [];
    function collectFoldersRecursive(items: any[]) {
      items.forEach(item => {
        if (item.type === "Folder") {
          allOmniJsFoldersList.push(item);
          if (item.folders) collectFoldersRecursive(item.folders);
          if (item.projects) { 
              item.projects.forEach((proj: any) => {
                  // Simplified: Relies on parentFolderID for hierarchy later
              });
          }
        }
      });
    }
    if (dataFromOmniJS.structure?.topLevelFolders) {
      collectFoldersRecursive(dataFromOmniJS.structure.topLevelFolders);
    }
    allOmniJsFoldersList.forEach((f: any) => {
        if (f && f.id && !transformedFoldersMap[f.id]) {
             transformedFoldersMap[f.id] = {
                  id: f.id,
                  name: f.name || "Untitled Folder",
                  parentFolderID: f.parentFolder?.id || f.parent?.id || null,
             };
        }
    });

    const allOmniJsProjectsSource = [
      ...(dataFromOmniJS.structure?.topLevelProjects || []),
      ...(allOmniJsFoldersList.flatMap((folder: any) => folder.projects || []))
    ];
    const uniqueOmniJsProjects = Array.from(new Map(allOmniJsProjectsSource.filter(p => p && p.id).map(p => [p.id, p])).values());

    uniqueOmniJsProjects.forEach(p => {
      if (p && p.id) {
        transformedProjectsMap[p.id] = {
          id: p.id,
          name: p.name || 'Untitled Project',
          status: p.status || 'Unknown',
          tasks: (p.tasks || []).map(transformOmniJsTaskToOmnifocusTask),
          note: p.note,
          dueDate: p.dueDate,
          deferDate: p.deferDate,
          completedDate: p.completionDate,
          flagged: p.flagged === undefined ? false : p.flagged,
        };
      }
    });

    transformedInboxTasks = (dataFromOmniJS.inboxItems || []).map(transformOmniJsTaskToOmnifocusTask);

    allTransformedTasks = [...transformedInboxTasks];
    Object.values(transformedProjectsMap).forEach(p => {
      if (p && p.tasks) {
          allTransformedTasks = allTransformedTasks.concat(p.tasks);
      }
    });
    
    // Tags would be processed from the full dump if available (current code initializes to {})
    // This part is not explicitly in the old code for populating transformedTagsMap,
    // so it would default to empty or rely on how formatCompactReport handles it.
    // For consistency, if dataFromOmniJS.tags exists in a full dump, we could process it.
    // For now, it will remain {} unless explicitly populated by OmniJS.
  }
  // --- END Adapted Transformation Logic ---

  const database: OmnifocusDumpData = {
    version: dataFromOmniJS.version || (isFilteredPayload ? 'mcp-filtered-1.0' : 'mcp-transformed-1.5'),
    timestamp: dataFromOmniJS.timestamp || new Date().toISOString(),
    folders: transformedFoldersMap,
    projects: transformedProjectsMap,
    inboxTasks: transformedInboxTasks, // These are already OmnifocusTask[]
    tasks: allTransformedTasks,       // These are already OmnifocusTask[]
    tags: transformedTagsMap, // Now populated if plugin provides it
    taskTags: dataFromOmniJS.taskTags || [], // Use if provided, else empty
  };

  // Filtering logic (hideCompleted, hideRecurringDuplicates) is now primarily pushed to the OmniJS plugin.
  // If hideCompleted was requested in params, the plugin should have handled it.
  // The params.hideRecurringDuplicates is still a placeholder for future implementation.

  //console.debug(`[DUMPDB_DEBUG] FINAL database object being returned to caller: ${JSON.stringify(database, null, 2)}`);
  return database;
}

