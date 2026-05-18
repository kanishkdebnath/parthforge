/**
 * Inline JSON example shown to the LLM and copyable on its own as a fallback
 * for users who want to build a custom prompt around the schema.
 */
export const JSON_TEMPLATE = `{
  "roadmap": {
    "title": "...",
    "description": "...",
    "deadline": "YYYY-MM-DD"
  },
  "milestones": [
    {
      "title": "...",
      "description": "...",
      "deadline": "YYYY-MM-DD",
      "steps": [
        {
          "title": "...",
          "links": [{ "url": "https://...", "label": "..." }]
        }
      ]
    }
  ]
}`;

const GOAL_PLACEHOLDER =
  '[Describe your goal here, e.g. "Learn Rust in 3 months while building a CLI tool"]';

/**
 * Builds the full LLM prompt with the user's goal interpolated. When the goal
 * is empty the placeholder remains, so the prompt is always copy-able (even if
 * the result will be generic). Callers should still gate the "Copy prompt"
 * button on a non-empty goal — the empty fallback exists for the preview only.
 */
export function buildPrompt(goal: string): string {
  const goalLine = goal.length > 0 ? goal : GOAL_PLACEHOLDER;
  return `You are helping me plan a roadmap. Generate a JSON object that strictly matches the schema below. Do not include any explanation, prose, or markdown fences — output only the raw JSON object so I can paste it into an app.

Goal: ${goalLine}

Rules:
- Every roadmap, milestone, and step must have a non-empty title.
- Use 3-6 milestones unless the goal explicitly warrants more.
- Each milestone should have 3-8 concrete, actionable steps.
- Set deadlines (ISO format: YYYY-MM-DD) only when they would be meaningful and realistic.
- Include 1-3 reference links per step when you can cite an authoritative source. Skip otherwise.
- Output must be valid JSON. Do not wrap it in \`\`\`json fences.

Schema:
${JSON_TEMPLATE}`;
}
