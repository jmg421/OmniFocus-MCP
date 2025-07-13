#!/usr/bin/env ts-node
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Same plugin ID as the working export system
const OMNIFOCUS_PLUGIN_ID = "com.jmg.exportmasterplan.v11.final";

async function execAppleScript(scriptBody: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tempFileName = `flagged_analysis_temp_${Date.now()}.applescript`;
    const currentDir = __dirname;
    const tempDir = path.join(currentDir, '..', 'tmp_applescripts_mcp');
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tempDir, tempFileName);
    
    try {
      fs.writeFileSync(tempFilePath, scriptBody, { encoding: 'utf8' });
    } catch (writeError: any) {
      return reject(new Error(`Failed to write temporary AppleScript file: ${writeError.message}`));
    }
    
    exec(`osascript ${tempFilePath}`, { maxBuffer: 10 * 1024 * 1024 }, (error: any, stdout: string, stderr: string) => {
      // Cleanup temp file
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupError: any) {
        console.error(`Failed to delete temporary AppleScript file: ${tempFilePath}. Error: ${cleanupError.message}`);
      }
      
      if (error) {
        reject(new Error(`AppleScript execution failed: ${error.message}. stderr: ${stderr.trim()}`));
        return;
      }
      
      if (stderr && !stderr.toLowerCase().includes('running in background')) {
        console.error(`[FLAGGED_CLI] AppleScript stderr: ${stderr.trim()}`);
        if (stderr.toLowerCase().includes("error:")) {
          reject(new Error(`AppleScript stderr reported an error: ${stderr.trim()}`));
          return;
        }
      }
      
      if (stdout.trim().toLowerCase().startsWith("applescript error")) {
        reject(new Error(`${stdout.trim()}`));
        return;
      }
      
      resolve(stdout.trim());
    });
  });
}

async function main() {
  try {
    console.log('Analyzing flagged items in OmniFocus...');
    
    // Set up criteria for flagged analysis
    const criteria = {
        type: 'flagged_analysis',
        hideCompleted: false  // Show ALL flagged items, including completed ones
    };
    
    const escapedJsonCriteria = JSON.stringify(criteria)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
    
    // Read the flagged analysis AppleScript template
    const scriptPath = path.join(__dirname, '..', 'scripts', 'flagged_analysis_runner.applescript');
    let appleScriptTemplate: string;
    
    try {
      appleScriptTemplate = fs.readFileSync(scriptPath, 'utf8');
    } catch (readError: any) {
      console.error(`Failed to read AppleScript template: ${readError.message}`);
      throw new Error(`Failed to read AppleScript template at ${scriptPath}`);
    }
    
    // Replace placeholders in the template
    const appleScriptBody = appleScriptTemplate
      .replace(/__PLUGIN_ID__/g, OMNIFOCUS_PLUGIN_ID)
      .replace(/__ESCAPED_JSON_CRITERIA_FOR_APPLESCRIPT_STRING__/g, escapedJsonCriteria)
      .replace(/__DELAY_SECONDS__/g, '15'); // 15 second delay for flagged analysis
    
    console.log('Executing flagged analysis...');
    const jsonResult = await execAppleScript(appleScriptBody);
    
    // Parse and save the result
    let flaggedAnalysisData: any;
    try {
      flaggedAnalysisData = JSON.parse(jsonResult);
    } catch (parseError: any) {
      console.error(`Failed to parse flagged analysis result: ${parseError.message}`);
      console.error(`Raw output: ${jsonResult}`);
      throw new Error(`Failed to parse AppleScript output as JSON`);
    }
    
    // Save to file
    const workspaceRoot = path.resolve(__dirname, '..', '..');
    const exportFilePath = path.join(workspaceRoot, 'data', 'flagged_analysis.json');
    fs.writeFileSync(exportFilePath, JSON.stringify(flaggedAnalysisData, null, 2), 'utf8');
    
    console.log(`Flagged analysis complete! Data written to: ${exportFilePath}`);
    
    // Print summary
    const summary = flaggedAnalysisData.summary;
    console.log(`\n📊 FLAGGED ITEMS ANALYSIS:`);
    console.log(`Total flagged tasks: ${summary.totalFlaggedTasks}`);
    console.log(`Total flagged projects: ${summary.totalFlaggedProjects}`);
    console.log(`Actionable next actions: ${summary.actionableNextActions}`);
    console.log(`Overdue items: ${summary.overdueItems}`);
    console.log(`Due today: ${summary.dueTodayItems}`);
    console.log(`Reference categories: ${summary.referenceCategories}`);
    console.log(`Weston Healing items: ${summary.westonHealingItems}`);
    console.log(`Inbox items: ${summary.inboxItems}`);
    
    // Print recommendations
    console.log(`\n💡 RECOMMENDATIONS:`);
    const rec = flaggedAnalysisData.recommendations;
    if (rec.shouldUnflagReferenceCategories) {
      console.log(`• Unflag ${summary.referenceCategories} reference categories - they should not be flagged`);
    }
    if (rec.shouldProcessInboxItems) {
      console.log(`• Process ${summary.inboxItems} flagged inbox items - organize into projects`);
    }
    if (rec.shouldAddresOverdueItems) {
      console.log(`• Address ${summary.overdueItems} overdue flagged items - reschedule or complete`);
    }
    if (rec.shouldFocusOnActionableItems) {
      console.log(`• Focus on ${summary.actionableNextActions} actionable next actions`);
    }
    
  } catch (err: any) {
    console.error('Failed to analyze flagged items:', err.message || err);
    process.exit(1);
  }
}

main(); 