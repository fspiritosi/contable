/**
 * Converts a date string from an input[type="date"] to a Date object
 * without timezone conversion issues.
 * 
 * Input date strings are in format "YYYY-MM-DD" and should be treated
 * as local dates, not UTC.
 */
export function parseLocalDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

/**
 * Formats a Date object to "YYYY-MM-DD" string for input[type="date"]
 */
export function formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
