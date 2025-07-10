export const parseInputToArray = (input) =>{
    // Normalize line endings
    input = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    let items;

    if (!input.includes('\n') && input.includes(',')) {
        // If no newlines but contains commas
        items = input.split(',');
    } else {
        // Otherwise split by new lines
        items = input.split('\n');
    }

    // Trim each item and remove empty strings
    return items.map(item => item.trim()).filter(item => item.length > 0);
}
