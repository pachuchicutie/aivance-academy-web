export type AiProvider =
  | "anthropic"
  | "openai"
  | "openai_compatible"
  | "xai"
  | "deepseek"
  | "gemini";

export type ProviderErrorCategory =
  | "auth"
  | "rate_limited"
  | "invalid_request"
  | "timeout"
  | "unavailable"
  | "unknown";

export class ProviderError extends Error {
  category: ProviderErrorCategory;

  constructor(category: ProviderErrorCategory, message: string) {
    super(message);
    this.category = category;
  }
}

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type ProviderRequest = {
  provider: AiProvider;
  baseUrl?: string | null;
  model: string;
  apiKey: string;
  system: string;
  messages: ChatTurn[];
  maxOutputTokens: number;
  temperature?: number | null;
  timeoutMs?: number;
};

export type ProviderResponse = {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export const MODEL_PATTERN = /^[\w.\-:/]{2,120}$/;

function categorizeStatus(status: number): ProviderErrorCategory {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limited";
  if (status >= 400 && status < 500) return "invalid_request";
  if (status >= 500) return "unavailable";
  return "unknown";
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError("timeout", "The AI provider timed out.");
    }
    throw new ProviderError(
      "unavailable",
      "The AI provider could not be reached."
    );
  } finally {
    clearTimeout(timer);
  }
}

function normalizeBaseUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "https:") return null;
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function defaultBase(provider: AiProvider, baseUrl?: string | null) {
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1";
    case "xai":
      return "https://api.x.ai/v1";
    case "deepseek":
      return "https://api.deepseek.com/v1";
    case "openai_compatible":
      return baseUrl ? normalizeBaseUrl(baseUrl) : null;
    default:
      return null;
  }
}

async function callAnthropic(
  request: ProviderRequest
): Promise<ProviderResponse> {
  const response = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": request.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxOutputTokens,
        system: request.system,
        messages: request.messages,
        ...(request.temperature != null
          ? { temperature: request.temperature }
          : {}),
      }),
    },
    request.timeoutMs ?? 60_000
  );

  if (!response.ok) {
    throw new ProviderError(
      categorizeStatus(response.status),
      `Anthropic request failed with status ${response.status}.`
    );
  }

  const data = (await response.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const text = (data.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new ProviderError("unknown", "The AI provider returned no text.");
  }

  return {
    text,
    inputTokens: data.usage?.input_tokens ?? null,
    outputTokens: data.usage?.output_tokens ?? null,
  };
}

async function callOpenAi(request: ProviderRequest): Promise<ProviderResponse> {
  const base = defaultBase(request.provider, request.baseUrl);
  if (!base) {
    throw new ProviderError(
      "invalid_request",
      "The configured base URL is invalid."
    );
  }

  const response = await fetchWithTimeout(
    `${base}/chat/completions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${request.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxOutputTokens,
        messages: [
          { role: "system", content: request.system },
          ...request.messages,
        ],
        ...(request.temperature != null
          ? { temperature: request.temperature }
          : {}),
      }),
    },
    request.timeoutMs ?? 60_000
  );

  if (!response.ok) {
    throw new ProviderError(
      categorizeStatus(response.status),
      `Provider request failed with status ${response.status}.`
    );
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new ProviderError("unknown", "The AI provider returned no text.");
  }

  return {
    text,
    inputTokens: data.usage?.prompt_tokens ?? null,
    outputTokens: data.usage?.completion_tokens ?? null,
  };
}

async function callGemini(
  request: ProviderRequest
): Promise<ProviderResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(request.apiKey)}`;

  const contents = request.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents,
        generationConfig: {
          maxOutputTokens: request.maxOutputTokens,
          ...(request.temperature != null
            ? { temperature: request.temperature }
            : {}),
        },
      }),
    },
    request.timeoutMs ?? 60_000
  );

  if (!response.ok) {
    throw new ProviderError(
      categorizeStatus(response.status),
      `Gemini request failed with status ${response.status}.`
    );
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
  };

  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";

  if (!text) {
    throw new ProviderError("unknown", "The AI provider returned no text.");
  }

  return {
    text,
    inputTokens: data.usageMetadata?.promptTokenCount ?? null,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
  };
}

export async function callAiProvider(
  request: ProviderRequest
): Promise<ProviderResponse> {
  if (!MODEL_PATTERN.test(request.model)) {
    throw new ProviderError("invalid_request", "Invalid model name.");
  }

  switch (request.provider) {
    case "anthropic":
      return callAnthropic(request);
    case "gemini":
      return callGemini(request);
    case "openai":
    case "xai":
    case "deepseek":
    case "openai_compatible":
      return callOpenAi(request);
    default:
      throw new ProviderError("invalid_request", "Unsupported provider.");
  }
}

export async function synthesizeElevenLabsSpeech(input: {
  apiKey: string;
  voiceId: string;
  text: string;
  modelId?: string | null;
  stability?: number | null;
  similarity?: number | null;
  style?: number | null;
}): Promise<ArrayBuffer> {
  const response = await fetchWithTimeout(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(input.voiceId)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "xi-api-key": input.apiKey,
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: input.text.slice(0, 2500),
        model_id: input.modelId || "eleven_multilingual_v2",
        voice_settings: {
          stability: input.stability ?? 0.5,
          similarity_boost: input.similarity ?? 0.75,
          style: input.style ?? 0,
        },
      }),
    },
    45_000
  );

  if (!response.ok) {
    throw new ProviderError(
      categorizeStatus(response.status),
      `ElevenLabs TTS failed (${response.status}).`
    );
  }

  return response.arrayBuffer();
}
