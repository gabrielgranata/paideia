// Minimal Anthropic client + structured-call helper.
//
// Pattern: forced single-tool output. The Zod schema converts to JSON
// Schema (Zod v4's `z.toJSONSchema`) and gets passed as the tool's
// `input_schema`. tool_choice forces the model to emit exactly that
// shape. We then validate the tool_use input back through Zod — the
// boundary is the boundary; trust nothing across it.
//
// One strict-mode retry on Zod failure, then throw. Per the
// paideia-prompt skill: validation must be loud, not silently rendered
// as half-broken substrate.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 4096;

let _client: Anthropic | null = null;
export function getAnthropicClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export type StructuredCallOpts<T> = {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  schemaName: string;       // becomes the tool name
  schemaDescription: string; // tool description
  model?: string;
  maxTokens?: number;
};

export async function structuredCall<T>(opts: StructuredCallOpts<T>): Promise<T> {
  const {
    system,
    user,
    schema,
    schemaName,
    schemaDescription,
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
  } = opts;

  // Convert Zod → JSON Schema. Zod v4 native.
  const jsonSchema = z.toJSONSchema(schema, { target: "draft-7" });

  const callOnce = async (extraSystem?: string): Promise<unknown> => {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: extraSystem ? `${system}\n\n${extraSystem}` : system,
      tools: [
        {
          name: schemaName,
          description: schemaDescription,
          input_schema: jsonSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: schemaName },
      messages: [{ role: "user", content: user }],
    });

    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      const stop = (response as { stop_reason?: string }).stop_reason ?? "unknown";
      throw new Error(
        `[anthropic.structuredCall] no tool_use block (stop_reason=${stop})`,
      );
    }
    return toolBlock.input;
  };

  const first = await callOnce();
  const parsed = schema.safeParse(first);
  if (parsed.success) return parsed.data;

  // One strict-mode retry with the validation errors as feedback.
  const issues = parsed.error.issues
    .slice(0, 6) // cap to keep the retry message tight
    .map((e) => `  - ${e.path.join(".") || "(root)"}: ${e.message}`)
    .join("\n");
  const retryReminder = `Your previous output failed schema validation:\n${issues}\n\nRe-emit a valid output that matches the tool's input_schema exactly. Do not add fields. Do not omit required fields.`;
  const second = await callOnce(retryReminder);
  return schema.parse(second); // throws ZodError if still invalid
}
