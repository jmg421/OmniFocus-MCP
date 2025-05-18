/**
 * Utility functions for handling date formatting in OmniFocus
 */

/**
 * Formats a date string into an AppleScript-compatible format
 * @param dateStr ISO date string (YYYY-MM-DD or full ISO date)
 * @returns AppleScript-compatible date string
 */
export function formatDateForAppleScript(dateStr: string): string {
    if (!dateStr) return '';
    
    // If it's just a date (YYYY-MM-DD), set time to midnight
    if (dateStr.length === 10) {
        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);
        return formatDateToAppleScriptString(date);
    }
    
    // For full ISO dates, parse the time components directly to preserve exact time
    const [datePart, timePart] = dateStr.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    
    const date = new Date(year, month - 1, day, hours, minutes);
    return formatDateToAppleScriptString(date);
}

/**
 * Helper function to format a Date object to AppleScript string format
 */
function formatDateToAppleScriptString(date: Date): string {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    
    // Format time in 12-hour format with AM/PM
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert 0 to 12
    
    return `${month} ${day}, ${year} ${hours}:${minutes} ${ampm}`;
}

/**
 * Validates and normalizes a date string
 * @param dateStr Date string to validate (YYYY-MM-DD or ISO format)
 * @returns normalized ISO date string or null if invalid
 */
export function normalizeDate(dateStr: string): string | null {
    if (!dateStr) return null;
    
    try {
        // Handle YYYY-MM-DD format
        if (dateStr.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [year, month, day] = dateStr.split('-').map(Number);
            // Check if it's a valid date (e.g., not 2024-02-31)
            const date = new Date(year, month - 1, day);
            if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
                return dateStr;
            }
            return null;
        }
        
        // Handle full ISO format
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return dateStr; // Return the original string to preserve exact time
        }
    } catch {
        return null;
    }
    
    return null;
}

/**
 * Validates if a string is a valid date format
 * @param dateStr Date string to validate
 * @returns boolean indicating if the date is valid
 */
export function isValidDate(dateStr: string): boolean {
    return normalizeDate(dateStr) !== null;
} 