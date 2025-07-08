import { z } from 'zod';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

export const schema = z.object({
  title: z.string(),
  startDate: z.string(), // ISO or natural language
  endDate: z.string(),   // ISO or natural language
  notes: z.string().optional(),
  calendarName: z.string().optional(),
});

function escapeAppleScriptString(str: string = ''): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function formatDateForAppleScript(dateStr: string): string {
  // Accepts ISO or 'YYYY-MM-DD HH:MM' and returns AppleScript date string
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toLocaleString('en-US', {
      month: 'long', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).replace(',', '');
  }
  return dateStr; // fallback
}

function generateAppleScript({ title, startDate, endDate, notes, calendarName }: any): string {
  const s_title = escapeAppleScriptString(title);
  const s_notes = escapeAppleScriptString(notes || '');
  const s_calendar = escapeAppleScriptString(calendarName || '');
  const s_start = formatDateForAppleScript(startDate);
  const s_end = formatDateForAppleScript(endDate);
  return `
tell application "Calendar"
  try
    set targetCalendar to ${s_calendar ? `first calendar whose name is "${s_calendar}"` : 'first calendar whose writable is true'}
  on error
    return "Error: Calendar '${s_calendar || '(default writable)'}' not found."
  end try
  tell targetCalendar
    make new event with properties {summary:"${s_title}", start date:date "${s_start}", end date:date "${s_end}", description:"${s_notes}"}
  end tell
  return "Event '${s_title}' created successfully."
end tell
`;
}

export async function handler(args: z.infer<typeof schema>) {
  const script = generateAppleScript(args);
  // Write to temp file
  const tempFile = path.join(process.cwd(), `add_calendar_event_${Date.now()}.applescript`);
  fs.writeFileSync(tempFile, script, 'utf8');
  return new Promise((resolve) => {
    exec(`osascript "${tempFile}"`, (error, stdout, stderr) => {
      fs.unlinkSync(tempFile);
      if (error) {
        resolve({ content: [{ type: 'text', text: `Error: ${stderr || error.message}` }], isError: true });
      } else {
        resolve({ content: [{ type: 'text', text: stdout.trim() }] });
      }
    });
  });
} 