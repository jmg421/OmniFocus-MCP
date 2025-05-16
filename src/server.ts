#!/usr/bin/env node

console.error("MCP Server restarted - Handler Log Test 1"); // Changed to console.error

import { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types";

// Import tool definitions
import * as dumpDatabaseTool from './tools/definitions/dumpDatabase.js';
import * as addOmniFocusTaskTool from './tools/definitions/addOmniFocusTask.js';
import * as addProjectTool from './tools/definitions/addProject.js';
import * as removeItemTool from './tools/definitions/removeItem.js';
import * as editItemTool from './tools/definitions/editItem.js';
import * as batchAddItemsTool from './tools/definitions/batchAddItems.js';
import * as batchRemoveItemsTool from './tools/definitions/batchRemoveItems.js';
// import * as dummyLogTestTool from './tools/definitions/dummyLogTest.js'; // We'll use a more specific import below

// Import for the new getNextActionsReport tool
import { handler as getNextActionsReportHandler, schema as getNextActionsReportSchema } from './tools/definitions/getNextActionsReport.js';

// Import specific exports from dummyLogTest.js
import { 
  handler as dummyLogTestHandler, 
  schema as dummyLogTestSchema, 
  directLogTest as dummyDirectLogTest // Importing the new function
} from './tools/definitions/dummyLogTest.js';

// Create an MCP server
const server = new McpServer({
  name: "OmniFocus MCP",
  version: "1.0.0"
});

// Perform a direct log test before tool registrations
console.error("[SERVER_TS] About to call dummyDirectLogTest from server.ts...");
dummyDirectLogTest("This is a direct call during server startup.");
console.error("[SERVER_TS] Finished calling dummyDirectLogTest from server.ts.");

// Register tools
console.error("[SERVER_DEBUG] Attempting to register get_full_omnifocus_report...");

const typedDumpDatabaseHandler: ToolCallback<typeof dumpDatabaseTool.schema.shape> = dumpDatabaseTool.handler;
const dumpDatabaseRegResult = server.tool(
  "get_full_omnifocus_report",
  "Gets the current state of your OmniFocus database",
  dumpDatabaseTool.schema.shape,
  typedDumpDatabaseHandler
);
console.error("[SERVER_DEBUG] Registration result for get_full_omnifocus_report:", dumpDatabaseRegResult);

// Register the new dev_get_next_actions_omnifocus_report tool
console.error("[SERVER_DEBUG] Attempting to register dev_get_next_actions_omnifocus_report...");
const typedGetNextActionsReportHandler: ToolCallback<typeof getNextActionsReportSchema.shape> = getNextActionsReportHandler;
const getNextActionsRegResult = server.tool(
  "dev_get_next_actions_omnifocus_report",
  "Gets the next actions report from your OmniFocus database using filterType: 'next_actions'",
  getNextActionsReportSchema.shape,
  typedGetNextActionsReportHandler
);
console.error("[SERVER_DEBUG] Registration result for dev_get_next_actions_omnifocus_report:", getNextActionsRegResult);

const typedAddOmniFocusTaskHandler: ToolCallback<typeof addOmniFocusTaskTool.schema.shape> = addOmniFocusTaskTool.handler;
server.tool(
  "add_omnifocus_task",
  "Add a new task to OmniFocus",
  addOmniFocusTaskTool.schema.shape,
  typedAddOmniFocusTaskHandler
);

const typedAddProjectHandler: ToolCallback<typeof addProjectTool.schema.shape> = addProjectTool.handler;
server.tool(
  "add_project",
  "Add a new project to OmniFocus",
  addProjectTool.schema.shape,
  typedAddProjectHandler
);

const typedRemoveItemHandler: ToolCallback<typeof removeItemTool.schema.shape> = removeItemTool.handler;
server.tool(
  "remove_item",
  "Remove a task or project from OmniFocus",
  removeItemTool.schema.shape,
  typedRemoveItemHandler
);

const typedEditItemHandler: ToolCallback<typeof editItemTool.schema.shape> = editItemTool.handler;
server.tool(
  "edit_item",
  "Edit a task or project in OmniFocus",
  editItemTool.schema.shape,
  typedEditItemHandler
);

const typedBatchAddItemsHandler: ToolCallback<typeof batchAddItemsTool.schema.shape> = batchAddItemsTool.handler;
server.tool(
  "batch_add_items",
  "Add multiple tasks or projects to OmniFocus in a single operation",
  batchAddItemsTool.schema.shape,
  typedBatchAddItemsHandler
);

const typedBatchRemoveItemsHandler: ToolCallback<typeof batchRemoveItemsTool.schema.shape> = batchRemoveItemsTool.handler;
server.tool(
  "batch_remove_items",
  "Remove multiple tasks or projects from OmniFocus in a single operation",
  batchRemoveItemsTool.schema.shape,
  typedBatchRemoveItemsHandler
);

try {
  console.error("[SERVER_DEBUG] Attempting to register dummy_log_test_v2...");
  const typedDummyLogTestHandler: ToolCallback<typeof dummyLogTestSchema.shape> = dummyLogTestHandler;
  const registrationResult = server.tool(
    "dummy_log_test_v2", 
    "A simple tool to test logging.",
    dummyLogTestSchema.shape,
    typedDummyLogTestHandler
  );
  console.error("[SERVER_DEBUG] Registration result for dummy_log_test_v2:", registrationResult);
} catch (regError) {
  console.error("[SERVER_DEBUG] ERROR REGISTERING dummy_log_test_v2:", regError);
}

// Start the MCP server
const transport = new StdioServerTransport();

// Use await with server.connect to ensure proper connection
(async function() {
  try {
    console.error("Starting MCP server...");
    await server.connect(transport);
    console.error("MCP Server connected and ready to accept commands from Cursor");
  } catch (err) {
    console.error(`Failed to start MCP server: ${err}`);
  }
})();

// For a cleaner shutdown if the process is terminated
