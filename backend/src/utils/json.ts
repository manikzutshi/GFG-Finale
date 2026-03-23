export function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("Empty model response.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenceMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) ?? trimmed.match(/```\s*([\s\S]*?)```/i);
    if (fenceMatch?.[1]) {
      return JSON.parse(fenceMatch[1].trim());
    }

    const firstObject = trimmed.indexOf("{");
    const lastObject = trimmed.lastIndexOf("}");

    if (firstObject !== -1 && lastObject !== -1 && lastObject > firstObject) {
      return JSON.parse(trimmed.slice(firstObject, lastObject + 1));
    }

    const firstArray = trimmed.indexOf("[");
    const lastArray = trimmed.lastIndexOf("]");

    if (firstArray !== -1 && lastArray !== -1 && lastArray > firstArray) {
      return JSON.parse(trimmed.slice(firstArray, lastArray + 1));
    }

    throw new Error("Model response did not contain valid JSON.");
  }
}

