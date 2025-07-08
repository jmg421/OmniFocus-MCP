import { exec } from 'child_process';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
// import { McpContext, Logger } from '@mcp/core'; // Temporarily commented out

// MCP_PLUGIN_ID_INSERTION_POINT_AUG_2024
const OMNIFOCUS_PLUGIN_ID = "com.jmg.exportmasterplan.v11.final";

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

// New interface for the GetNextActionsReport tool
export interface McpOmnifocusDevGetNextActionsReportParams {
  hideCompleted?: boolean;
  omnijsAppleScriptDelay?: number;
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
  const normalizedScriptBody = scriptBody.replace(/\\r\\n/g, "\\n").replace(/\\r/g, "\\n");
  const tempFileName = `mcp_applescript_temp_${Date.now()}.applescript`;
  
  const currentDir = __dirname;

  const tempDir = path.join(currentDir, '..', 'tmp_applescripts_mcp'); 

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const tempFilePath = path.join(tempDir, tempFileName);

  // ---- START MCP DEBUG LOGGING (using console.error) ----
  console.error(`---> [MCP_EXEC_APPLE_SCRIPT_DEBUG] Writing to temp file: ${tempFilePath}`);
  console.error(`---> [MCP_EXEC_APPLE_SCRIPT_DEBUG] Script body first 100 chars: ${normalizedScriptBody.substring(0, 100)}...`);
  // ---- END MCP DEBUG LOGGING ----

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
      // ---- START MCP DEBUG LOGGING (using console.error) ----
      const fullStdoutForLog = Buffer.concat(stdoutChunks).toString('utf8');
      console.error(`---> [MCP_EXEC_APPLE_SCRIPT_DEBUG] Process closed.`);
      console.error(`---> [MCP_EXEC_APPLE_SCRIPT_DEBUG] Exit code: ${code}`);
      console.error(`---> [MCP_EXEC_APPLE_SCRIPT_DEBUG] Stderr: "${stderr.trim()}"`);
      console.error(`---> [MCP_EXEC_APPLE_SCRIPT_DEBUG] Stdout: "${fullStdoutForLog.trim()}"`);
      // ---- END MCP DEBUG LOGGING ----
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

// Internal function to handle common logic for fetching and processing data from OmniFocus plugin
async function executeOmniFocusPluginAndGetData(
  filterTypeForPlugin: 'full_dump' | 'next_actions',
  params: McpOmnifocusDevGetFullOmnifocusReportParams | McpOmnifocusDevGetNextActionsReportParams,
  _mcpContext: any,
  _logger: any,
): Promise<OmnifocusDatabase> {
  // ---- START MCP DEBUG LOGGING (using console.error) ----
  console.error(`---> [MCP_EXECUTE_PLUGIN_DEBUG] Attempting to dump OmniFocus database with filterType: ${filterTypeForPlugin}`);
  // ---- END MCP DEBUG LOGGING ----

  try {
    await new Promise<void>((resolve, reject) => {
        spawn('pgrep', ['-x', 'OmniFocus']).on('close', code => code === 0 ? resolve() : reject(new Error('OmniFocus process not found by pgrep.')));
    });
  } catch (error) {
    console.error("[DUMPDB_CORE] OmniFocus does not appear to be running or pgrep failed.");
    throw new Error("OmniFocus is not running or process check failed. Please start OmniFocus and try again.");
  }

  const filterCriteria: OmniJSFilterCriteria = {
    type: filterTypeForPlugin,
    hideCompleted: params.hideCompleted === true,
  };

  // This produces a string like "{\"type\":\"next_actions\",\"hideCompleted\":true}"
  // which is suitable for direct embedding into an AppleScript string literal.
  const escapedJsonCriteriaForAppleScriptString = JSON.stringify(filterCriteria)
    .replace(/\\/g, '\\\\') // Correctly escape backslashes first
    .replace(/"/g, '\\\"');   // Then correctly escape double quotes

  let appleScriptDelay: number;
  if (params.omnijsAppleScriptDelay !== undefined) {
    appleScriptDelay = params.omnijsAppleScriptDelay;
    console.error(`---> [MCP_DEBUG] Using user-provided AppleScript delay: ${appleScriptDelay}s`);
  } else {
    if (filterTypeForPlugin === 'next_actions') {
      appleScriptDelay = 60; // Longer default delay for next_actions
      console.error(`---> [MCP_DEBUG] Using default AppleScript delay for next_actions: ${appleScriptDelay}s`);
    } else {
      appleScriptDelay = 20; // Default delay for other types (e.g., full_dump)
      console.error(`---> [MCP_DEBUG] Using default AppleScript delay for ${filterTypeForPlugin}: ${appleScriptDelay}s`);
    }
  }

  // --- START REPLACEMENT OF appleScriptBody --- 
  const currentDir = __dirname;
  const appleScriptFilePath = path.join(currentDir, '..', '..', 'scripts', 'omnifocus_plugin_runner.applescript');
    
  let appleScriptTemplate: string;
  try {
    appleScriptTemplate = fs.readFileSync(appleScriptFilePath, 'utf8');
  } catch (readError: any) {
    console.error(`[DUMPDB_CORE] Failed to read AppleScript template file at ${appleScriptFilePath}. Error: ${readError.message}`);
    throw new Error(`Failed to read AppleScript template file at ${appleScriptFilePath}. Error: ${readError.message}`);
  }

  const appleScriptBody = appleScriptTemplate
    .replace(/__PLUGIN_ID__/g, OMNIFOCUS_PLUGIN_ID)
    .replace(/__ESCAPED_JSON_CRITERIA_FOR_APPLESCRIPT_STRING__/g, escapedJsonCriteriaForAppleScriptString)
    .replace(/__DELAY_SECONDS__/g, appleScriptDelay.toString());
  // --- END REPLACEMENT OF appleScriptBody --- 

  // ---- START MCP DEBUG LOGGING (using console.error) ----
  console.error(`---> [MCP_PRE_EXEC_APPLESCRIPT_DEBUG] About to call execAppleScript. filterTypeForPlugin: ${filterTypeForPlugin}`);
  // ---- END MCP DEBUG LOGGING ----
  const jsonResult = await execAppleScript(appleScriptBody);
  // ---- START MCP DEBUG LOGGING (using console.error) ----
  console.error(`---> [MCP_POST_EXEC_APPLESCRIPT_DEBUG] execAppleScript returned. jsonResult (raw): "${jsonResult}"`);
  // ---- END MCP DEBUG LOGGING ----

  let dataFromOmniJS: any;
  try {
      dataFromOmniJS = JSON.parse(jsonResult);
  } catch (parseError: any) {
      console.error(`[DUMPDB_CORE] JSON.parse failed. Original AppleScript output was: "${jsonResult}". Error: ${parseError.message}`);
      throw new Error(`Failed to parse AppleScript output as JSON. Output: "${jsonResult}". Parse Error: ${parseError.message}`);
  }
 
  let transformedFoldersMap: Record<string, OmnifocusFolder> = {};
  let transformedProjectsMap: Record<string, OmnifocusProject> = {};
  let transformedInboxTasks: OmnifocusTask[] = [];
  let allTransformedTasks: OmnifocusTask[] = [];
  let transformedTagsMap: Record<string, OmnifocusTag> = {};

  const isFilteredPayload = dataFromOmniJS.criteriaUsed && dataFromOmniJS.version?.startsWith('omni-js-filtered');

  if (isFilteredPayload && filterCriteria.type === 'next_actions') {
    //console.debug("[DUMPDB_CORE] Processing optimized/filtered payload from OmniJS plugin for 'next_actions'.");

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

    if (dataFromOmniJS.projects) {
        for (const projectId in dataFromOmniJS.projects) {
            const omniJsProject = dataFromOmniJS.projects[projectId];
            transformedProjectsMap[projectId] = {
                id: omniJsProject.id || projectId,
                name: omniJsProject.name || 'Untitled Project',
                status: omniJsProject.status || 'Unknown',
                tasks: (omniJsProject.tasks || []).map(transformOmniJsTaskToOmnifocusTask), // these tasks are already filtered by plugin
                note: omniJsProject.note,
                dueDate: omniJsProject.dueDate,
                deferDate: omniJsProject.deferDate,
                completedDate: omniJsProject.completionDate,
                flagged: omniJsProject.flagged === undefined ? false : omniJsProject.flagged,
            };
        }
    }
    
    transformedInboxTasks = (dataFromOmniJS.inboxTasks || []).map(transformOmniJsTaskToOmnifocusTask);

    // For 'next_actions', the `dataFromOmniJS.tasks` should already be the filtered list of project tasks
    // and `dataFromOmniJS.inboxTasks` is the filtered list of inbox tasks.
    // The transformOmniJsTaskToOmnifocusTask is applied to ensure structure consistency.
    // The OmniJS plugin itself is responsible for the filtering logic for 'next_actions'.
    allTransformedTasks = (dataFromOmniJS.tasks || []).map(transformOmniJsTaskToOmnifocusTask).concat(transformedInboxTasks);
    
    // The `tasks` property within `transformedProjectsMap` for `next_actions` might be misleading if populated above,
    // as `allTransformedTasks` should be the comprehensive list. Let's ensure project tasks are not duplicated or missed.
    // The OmniJS 'next_actions' payload has top-level 'tasks' and 'inboxTasks'.
    // Projects in 'next_actions' payload typically don't list their tasks again if those tasks are already in the top-level lists.
    // So, tasks within transformedProjectsMap[projectId].tasks should generally be empty or not used for assembling allTransformedTasks for next_actions.
    // We'll rely on the top-level `dataFromOmniJS.tasks` and `dataFromOmniJS.inboxTasks`.
    // Let's clear project.tasks to avoid confusion for 'next_actions' mode if populated from a non-empty omniJsProject.tasks
     for (const projectId in transformedProjectsMap) {
        transformedProjectsMap[projectId].tasks = []; // Tasks are flat in `allTransformedTasks` for next_actions
    }


    if (dataFromOmniJS.tags) {
        for (const tagId in dataFromOmniJS.tags) {
            const omniJsTag = dataFromOmniJS.tags[tagId];
            transformedTagsMap[tagId] = {
                id: omniJsTag.id || tagId,
                name: omniJsTag.name || "Untitled Tag",
            };
        }
    }

  } else { // Handles 'full_dump' or if isFilteredPayload is false
    //console.debug("[DUMPDB_CORE] Processing full payload from OmniJS plugin (legacy or 'full_dump' mode).");
    (dataFromOmniJS.structure?.topLevelFolders || []).forEach((f: any) => {
      if (f && f.id) {
        transformedFoldersMap[f.id] = {
          id: f.id,
          name: f.name || "Untitled Folder",
          parentFolderID: f.parentFolder?.id || null, // Assuming structure from full dump
        };
      }
    });
    const allOmniJsFoldersList: any[] = [];
    function collectFoldersRecursive(items: any[]) {
      items.forEach(item => {
        if (item.type === "Folder") {
          allOmniJsFoldersList.push(item);
          if (item.folders) collectFoldersRecursive(item.folders);
        }
      });
    }
    if (dataFromOmniJS.structure?.topLevelFolders) {
      collectFoldersRecursive(dataFromOmniJS.structure.topLevelFolders);
    }
    allOmniJsFoldersList.forEach((f: any) => {
        if (f && f.id && !transformedFoldersMap[f.id]) { // Check if already added
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
          status: p.status || 'Unknown', // Align with OmnifocusProject status
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
    Object.values(transformedProjectsMap).forEach(proj => { // Renamed 'p' to 'proj' for clarity
      if (proj && proj.tasks) {
          allTransformedTasks = allTransformedTasks.concat(proj.tasks);
      }
    });
    
    // For full dump, tags might be part of individual tasks or projects, or a separate top-level list if plugin provides
    // The current full dump OmniJS payload seems to put tags inside task objects (task.tags as array of names)
    // The transformOmniJsTaskToOmnifocusTask extracts tagIds from task.tags (array of tag objects).
    // We need to populate transformedTagsMap from a comprehensive list of tags if available from the full dump.
    // If the full dump provides a global 'tags' map/array, use that. Otherwise, build from tasks.
    if (dataFromOmniJS.tags && typeof dataFromOmniJS.tags === 'object') { // Assuming tags is a map like in filtered payload
        for (const tagId in dataFromOmniJS.tags) {
            const omniJsTag = dataFromOmniJS.tags[tagId];
            transformedTagsMap[tagId] = {
                id: omniJsTag.id || tagId,
                name: omniJsTag.name || "Untitled Tag",
            };
        }
    } else {
        // Fallback: collect tags from all tasks if no global tag list in full dump
        allTransformedTasks.forEach(task => {
            if (task.tagIds && dataFromOmniJS.tasks) { // Assuming tasks have full tag objects in original OmniJS data
                const originalTask = dataFromOmniJS.tasks.find((t:any) => t.id === task.id) || dataFromOmniJS.inboxItems?.find((t:any) => t.id === task.id);
                if (originalTask && originalTask.tags) {
                    originalTask.tags.forEach((tagObj: any) => {
                        if (tagObj.id && tagObj.name && !transformedTagsMap[tagObj.id]) {
                            transformedTagsMap[tagObj.id] = { id: tagObj.id, name: tagObj.name };
                        }
                    });
                }
            }
        });
    }
  }

  const database: OmnifocusDumpData = {
    version: dataFromOmniJS.version || (isFilteredPayload ? 'mcp-filtered-1.0' : 'mcp-transformed-1.5'),
    timestamp: dataFromOmniJS.timestamp || new Date().toISOString(),
    folders: transformedFoldersMap,
    projects: transformedProjectsMap,
    inboxTasks: transformedInboxTasks,
    tasks: allTransformedTasks,
    tags: transformedTagsMap,
    taskTags: dataFromOmniJS.taskTags || [], // Use if provided, common for filtered, might be empty for full
  };

  //console.debug(`[DUMPDB_CORE] FINAL database object being returned to caller: ${JSON.stringify(database, null, 2)}`);
  return database;
}


// Main function to dump the database (now for GetFullOmnifocusReport)
export async function dumpDatabase(
  params: McpOmnifocusDevGetFullOmnifocusReportParams,
  _mcpContext: any,
  _logger: any,
): Promise<OmnifocusDatabase> {
  //console.debug("[DUMPDB_FULL] Attempting to dump OmniFocus database (full report)...", params);
  const filterType = params.filterType || 'full_dump'; // Default to full_dump for this function
  return executeOmniFocusPluginAndGetData(filterType, params, _mcpContext, _logger);
}

// New exported function for GetNextActionsReport
export async function fetchNextActionsReport(
  params: McpOmnifocusDevGetNextActionsReportParams,
  _mcpContext: any, 
  _logger: any,
): Promise<OmnifocusDatabase> {
  //console.debug("[DUMPDB_NEXT_ACTIONS] Attempting to fetch next actions report...", params);
  // For next actions, filterType is fixed, hideCompleted defaults to true if not specified.
  const effectiveParams: McpOmnifocusDevGetNextActionsReportParams = {
    hideCompleted: params.hideCompleted === undefined ? true : params.hideCompleted,
    omnijsAppleScriptDelay: params.omnijsAppleScriptDelay, // Pass through if specified
  };
  return executeOmniFocusPluginAndGetData('next_actions', effectiveParams, _mcpContext, _logger);
}

