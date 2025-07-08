#!/usr/bin/env ts-node
const path = require('path');
const fs = require('fs');
const { dumpDatabase } = require('./tools/dumpDatabase');

async function main() {
  try {
    console.log('Exporting OmniFocus database...');
    const database = await dumpDatabase({}, undefined, undefined);
    const workspaceRoot = path.resolve(__dirname, '..', '..');
    const exportFilePath = path.join(workspaceRoot, 'data', 'omnifocus_export.json');
    fs.writeFileSync(exportFilePath, JSON.stringify(database, null, 2), 'utf8');
    console.log(`Export complete! Data written to: ${exportFilePath}`);
    // Print a summary (number of folders, projects, tasks, tags)
    const numFolders = Object.keys(database.folders || {}).length;
    const numProjects = Object.keys(database.projects || {}).length;
    const numTasks = (database.tasks || []).length;
    const numTags = Object.keys(database.tags || {}).length;
    console.log(`Summary: ${numFolders} folders, ${numProjects} projects, ${numTasks} tasks, ${numTags} tags.`);
  } catch (err: any) {
    console.error('Failed to export OmniFocus database:', err.message || err);
    process.exit(1);
  }
}

main(); 