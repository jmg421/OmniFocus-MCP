#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface RescheduleResult {
    success: boolean;
    message: string;
    details?: any;
}

async function rescheduleTask(taskId: string, newDueDate: string): Promise<RescheduleResult> {
    console.log(`Rescheduling task ${taskId} to ${newDueDate}...`);
    
    try {
        // Set up criteria for task rescheduling
        const criteria = {
            type: 'reschedule_task',
            taskId: taskId,
            newDueDate: newDueDate
        };

        console.log(`[RESCHEDULE_CLI] Criteria: ${JSON.stringify(criteria)}`);

        // Write criteria to temporary file
        const tempDir = '/Users/johnmuirhead-gould/MasterPlan/data';
        const criteriaFile = path.join(tempDir, 'reschedule_criteria.json');
        fs.writeFileSync(criteriaFile, JSON.stringify(criteria));

        // Simple AppleScript that reads the criteria file
        const appleScript = `
        set criteriaFile to "${criteriaFile}"
        set criteriaContent to do shell script "cat " & quoted form of criteriaFile
        
        tell application "OmniFocus"
            set pluginID to "taskModifications"
            
            set omniJSCode to "PlugIn.find('" & pluginID & "').actions[0].perform('" & criteriaContent & "');"
            
            set omniJSURL to "omnifocus://localhost/omnijs-run?script=" & my urlEncode(omniJSCode)
            
            open location omniJSURL
            
            delay 15
            
            set clipboardText to (the clipboard as string)
            return clipboardText
        end tell
        
        on urlEncode(input)
            set allowedChars to "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~"
            set encodedText to ""
            repeat with i from 1 to length of input
                set currentChar to character i of input
                if currentChar is in allowedChars then
                    set encodedText to encodedText & currentChar
                else
                    set encodedText to encodedText & "%" & my toHex(ASCII number currentChar)
                end if
            end repeat
            return encodedText
        end urlEncode
        
        on toHex(num)
            set hexChars to "0123456789ABCDEF"
            if num < 16 then
                return "0" & (character (num + 1) of hexChars)
            else
                return (character ((num div 16) + 1) of hexChars) & (character ((num mod 16) + 1) of hexChars)
            end if
        end toHex
        `;

        console.log('Executing task modification...');
        
        const result = execSync(`osascript -e '${appleScript.replace(/'/g, "'\"'\"'")}'`, {
            encoding: 'utf8',
            timeout: 30000
        });

        console.log(`[RESCHEDULE_CLI] Result: ${result}`);

        // Clean up temp file
        fs.unlinkSync(criteriaFile);

        let modificationResult: RescheduleResult;
        try {
            modificationResult = JSON.parse(result.trim());
        } catch (parseError) {
            console.error('Failed to parse modification result:', parseError);
            return {
                success: false,
                message: 'Failed to parse task modification result',
                details: { rawResult: result.trim() }
            };
        }

        // Write result to file for inspection
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = path.join(tempDir, `reschedule_result_${timestamp}.json`);
        fs.writeFileSync(outputFile, JSON.stringify(modificationResult, null, 2));
        console.log(`Task modification result written to: ${outputFile}`);

        return modificationResult;

    } catch (error) {
        console.error('Error during task rescheduling:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            message: `Task rescheduling failed: ${errorMessage}`,
            details: { error: String(error) }
        };
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('Usage: npx ts-node src/rescheduleTaskCli.ts <taskId> <newDueDate>');
        console.log('Example: npx ts-node src/rescheduleTaskCli.ts "nzm8-xOG1oi" "2025-07-11"');
        process.exit(1);
    }

    const taskId = args[0];
    const newDueDate = args[1];

    console.log('\n🔄 TASK RESCHEDULING TOOL');
    console.log(`Task ID: ${taskId}`);
    console.log(`New Due Date: ${newDueDate}`);
    console.log('');

    const result = await rescheduleTask(taskId, newDueDate);

    console.log('\n📊 RESCHEDULING RESULT:');
    if (result.success) {
        console.log(`✅ SUCCESS: ${result.message}`);
        if (result.details) {
            console.log(`📝 Task: "${result.details.taskName}"`);
            console.log(`📅 Old Date: ${result.details.originalDueDate || 'None'}`);
            console.log(`📅 New Date: ${result.details.newDueDate}`);
        }
    } else {
        console.log(`❌ FAILED: ${result.message}`);
        if (result.details) {
            console.log(`🔍 Details:`, result.details);
        }
    }
}

if (require.main === module) {
    main().catch(console.error);
} 