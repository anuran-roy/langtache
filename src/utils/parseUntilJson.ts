import { ALL, parseJSON } from "partial-json";

// Helper to check if a value is a non-null object
export function isObjectorArray(
  value: any,
): value is Record<string, any> | Array<any> {
  return Array.isArray(value) || (typeof value === "object" && value !== null);
}

export function parseUntilJson(jsonstr: string): Record<string, any> {
  let textToParse: string = jsonstr.trim();
  let parsedJson: any = null;

  // --- Stage 1: Handle potential string literal representation ---
  // Check if the string looks like a JSON string literal (starts/ends with double quotes)
  if (textToParse.startsWith('"') && textToParse.endsWith('"')) {
    const potentialJsonContent = textToParse.slice(1, -1);
    try {
      // Attempt to parse the content within the quotes
      // JSON.parse handles internal escapes like \n or \" correctly
      parsedJson = JSON.parse(potentialJsonContent);
      if (isObjectorArray(parsedJson)) {
        console.info("Parsed successfully after removing outer quotes.");
        return parsedJson;
      } else {
        console.warn(
          "Parsed after removing outer quotes, but result is not an object:",
          parsedJson,
        );
        parsedJson = null; // Reset for subsequent stages
        textToParse = potentialJsonContent; // Use the inner content for further processing
      }
    } catch (e) {
      console.info(
        "Failed to parse content within outer quotes, proceeding to cleanup.",
      );
      // Use the inner content for further processing
      textToParse = potentialJsonContent;
    }
  }

  // --- Stage 2: Attempt standard JSON.parse on the current text ---
  // Handles cases where input was valid JSON, or became valid after Stage 1
  if (parsedJson === null) {
    try {
      parsedJson = JSON.parse(textToParse);
      if (isObjectorArray(parsedJson)) {
        console.info("Parsed successfully using standard JSON.parse.");
        return parsedJson;
      } else {
        console.warn(
          "Standard JSON.parse succeeded, but result is not an object:",
          parsedJson,
        );
        parsedJson = null; // Reset for subsequent stages
      }
    } catch (error) {
      console.info(
        "Standard JSON.parse failed, proceeding to cleanup and partial parsing.",
      );
    }
  }

  // --- Stage 3: Cleanup and Partial Parsing ---
  if (parsedJson === null) {
    // Remove markdown code fences
    if (textToParse.startsWith("```json")) {
      textToParse = textToParse.substring(7);
    }
    if (textToParse.endsWith("```")) {
      textToParse = textToParse.slice(0, -3);
    }
    textToParse = textToParse.trim();

    // Find the start of the actual JSON object or array
    const curlIndex = textToParse.indexOf("{");
    const sqIndex = textToParse.indexOf("[");
    let startIndex = -1;

    if (curlIndex !== -1 && sqIndex !== -1) {
      startIndex = Math.min(curlIndex, sqIndex);
    } else if (curlIndex !== -1) {
      startIndex = curlIndex;
    } else if (sqIndex !== -1) {
      startIndex = sqIndex;
    }

    if (startIndex > 0) {
      console.info(
        `Trimming content before first '{' or '[' at index ${startIndex}`,
      );
      textToParse = textToParse.substring(startIndex);
    } else if (
      startIndex === -1 &&
      !textToParse.startsWith("{") &&
      !textToParse.startsWith("[")
    ) {
      // If no '{' or '[' found, and doesn't start with one, it's not JSON.
      console.error(
        "No JSON object or array start found in the string after cleanup.",
      );
      return {};
    }

    // --- Final Attempt 1: Use standard JSON.parse ---
    try {
      parsedJson = JSON.parse(textToParse);
      if (isObjectorArray(parsedJson)) {
        console.info("Parsed successfully using standard JSON.parse.");
        return parsedJson;
      } else {
        console.warn(
          "Standard JSON.parse succeeded, but result is not an object:",
          parsedJson,
        );
        parsedJson = null; // Reset for subsequent stages
      }
    } catch (error) {
      console.info(
        "Standard JSON.parse failed, proceeding to cleanup and partial parsing.",
      );
    }

    // --- Final Attempt 2: Use partial-json parser ---
    try {
      parsedJson = parseJSON(textToParse, ALL);
      if (isObjectorArray(parsedJson)) {
        console.info("Successfully parsed JSON using partial JSON parser.");
        return parsedJson;
      } else {
        console.error(
          "Partial JSON parser did not return an object:",
          parsedJson,
        );
        console.info("Final string attempted by partial parser:", textToParse);
        return {};
      }
    } catch (error) {
      console.error("Error parsing the JSON even with partial parser:", error);
      console.info("Final string attempted by partial parser:", textToParse);
      return {};
    }
  }

  // Fallback in case logic above has gaps, though it shouldn't be reached.
  console.error("Parsing failed through all stages unexpectedly.");
  return {};
}

