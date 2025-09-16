import { GenerateRequest } from './schemas'

export const SYSTEM_PROMPT = `You are a senior QA engineer with expertise in creating comprehensive test cases from user stories. Your task is to analyze user stories and generate detailed test cases.

CRITICAL INSTRUCTIONS:
1. Generate test cases ONLY for the specified categories in the request
2. Do NOT generate test cases for categories that weren't requested
3. Each test case MUST have a category that matches one of the requested categories exactly

Response must be valid JSON matching this schema:
{
  "cases": [
    {
      "id": "TC-001",
      "title": "string",
      "steps": ["string", "..."],
      "testData": "string (optional)",
      "expectedResult": "string",
      "category": "string (must match one of the requested categories)"
    }
  ],
  "model": "string (optional)",
  "promptTokens": 0,
  "completionTokens": 0
}

Guidelines:
- Generate test case IDs like TC-001, TC-002, etc.
- Write concise, imperative steps
- Category must be exactly one of the requested categories
- Steps should be actionable and specific
- Expected results should be clear and measurable

Return ONLY the JSON object, no additional text or formatting.`

export function buildPrompt(request: GenerateRequest): string {
  const { storyTitle, acceptanceCriteria, description, additionalInfo, selectedCategories } = request
  
  let userPrompt = `Generate test cases for this user story.
IMPORTANT: Generate ONLY test cases for these specific categories: ${selectedCategories.join(', ')}
Do NOT generate test cases for any other categories.

Story Title: ${storyTitle}

Acceptance Criteria:
${acceptanceCriteria}

Required Test Categories: ${selectedCategories.join(', ')}`

  if (description) {
    userPrompt += `\n\nDescription:\n${description}`
  }

  if (additionalInfo) {
    userPrompt += `\n\nAdditional Information:\n${additionalInfo}`
  }

  return userPrompt
}