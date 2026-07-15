import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { decryptSecret } from "./crypto";
import type { AiProvider } from "./providers";

export type AiRuntimeSettings = {
  enabled: boolean;
  provider: AiProvider;
  baseUrl: string | null;
  model: string;
  fallbackProvider: AiProvider | null;
  fallbackModel: string | null;
  assistantName: string;
  systemInstructions: string | null;
  temperature: number | null;
  maxOutputTokens: number;
  maxMessageLength: number;
  hourlyLimit: number;
  dailyLimit: number;
  contextEnabled: boolean;
  historyEnabled: boolean;
  knowledgeEnabled: boolean;
  injectPht: boolean;
  injectBatchContext: boolean;
  includeSourceRefs: boolean;
  escalationEnabled: boolean;
  fallbackMessage: string | null;
  supportContact: string | null;
  welcomeMessage: string | null;
  voiceEnabled: boolean;
  elevenlabsVoiceId: string | null;
  elevenlabsModelId: string | null;
  ttsStability: number | null;
  ttsSimilarity: number | null;
  ttsStyle: number | null;
  sttEnabled: boolean;
  storeRawAudio: boolean;
  apiKey: string | null;
  fallbackApiKey: string | null;
  fallbackBaseUrl: string | null;
  elevenlabsApiKey: string | null;
};

export type AiUnavailableReason =
  | "not_configured"
  | "disabled"
  | "missing_key";

export type AiSettingsResult =
  | { ok: true; settings: AiRuntimeSettings; service: SupabaseClient }
  | {
      ok: false;
      reason: AiUnavailableReason;
      settings: AiRuntimeSettings | null;
    };

const DEFAULTS: Omit<
  AiRuntimeSettings,
  "apiKey" | "fallbackApiKey" | "fallbackBaseUrl" | "elevenlabsApiKey"
> = {
  enabled: false,
  provider: "anthropic",
  baseUrl: null,
  model: "claude-haiku-4-5-20251001",
  fallbackProvider: null,
  fallbackModel: null,
  assistantName: "AIvanza Academy Assistant",
  systemInstructions: null,
  temperature: null,
  maxOutputTokens: 1024,
  maxMessageLength: 4000,
  hourlyLimit: 20,
  dailyLimit: 150,
  contextEnabled: true,
  historyEnabled: true,
  knowledgeEnabled: true,
  injectPht: true,
  injectBatchContext: true,
  includeSourceRefs: true,
  escalationEnabled: true,
  fallbackMessage: null,
  supportContact: null,
  welcomeMessage: null,
  voiceEnabled: false,
  elevenlabsVoiceId: null,
  elevenlabsModelId: "eleven_multilingual_v2",
  ttsStability: 0.5,
  ttsSimilarity: 0.75,
  ttsStyle: 0,
  sttEnabled: true,
  storeRawAudio: false,
};

async function resolveProviderKey(
  service: SupabaseClient,
  provider: string,
  legacyCiphertext?: string | null,
  legacyBaseUrl?: string | null
) {
  const { data } = await service
    .from("ai_provider_secrets")
    .select("api_key_ciphertext, base_url")
    .eq("provider", provider)
    .maybeSingle();

  const cipher = data?.api_key_ciphertext || legacyCiphertext || null;
  return {
    apiKey: cipher ? decryptSecret(cipher) : null,
    baseUrl: data?.base_url ?? legacyBaseUrl ?? null,
  };
}

/**
 * Loads AI configuration with the service-role client (students cannot read
 * ai_settings) and decrypts keys server-side.
 */
export async function loadAiSettings(): Promise<AiSettingsResult> {
  const service = createSupabaseServiceClient();
  if (!service) {
    return { ok: false, reason: "not_configured", settings: null };
  }

  const { data, error } = await service
    .from("ai_settings")
    .select(
      `enabled, provider, base_url, model, fallback_provider, fallback_model,
       assistant_name, system_instructions, temperature, max_output_tokens,
       max_message_length, hourly_limit, daily_limit, context_enabled,
       history_enabled, knowledge_enabled, inject_pht, inject_batch_context,
       include_source_refs, escalation_enabled, fallback_message, support_contact,
       welcome_message, voice_enabled, elevenlabs_voice_id, elevenlabs_model_id,
       tts_stability, tts_similarity, tts_style, stt_enabled, store_raw_audio,
       api_key_ciphertext, elevenlabs_api_key_ciphertext, published_prompt_version`
    )
    .eq("id", "default")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, reason: "not_configured", settings: null };
  }

  // Prefer published prompt version body when available
  let systemInstructions = data.system_instructions ?? null;
  if (data.published_prompt_version != null) {
    const { data: prompt } = await service
      .from("ai_prompt_versions")
      .select("body")
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prompt?.body) systemInstructions = prompt.body;
  }

  const provider = (data.provider as AiProvider) ?? DEFAULTS.provider;
  const primary = await resolveProviderKey(
    service,
    provider,
    data.api_key_ciphertext,
    data.base_url
  );

  let fallbackApiKey: string | null = null;
  let fallbackBaseUrl: string | null = null;
  const fallbackProvider = (data.fallback_provider as AiProvider | null) ?? null;
  if (fallbackProvider && data.fallback_model) {
    const fb = await resolveProviderKey(service, fallbackProvider);
    fallbackApiKey = fb.apiKey;
    fallbackBaseUrl = fb.baseUrl;
  }

  const eleven = await resolveProviderKey(
    service,
    "elevenlabs",
    data.elevenlabs_api_key_ciphertext
  );

  const settings: AiRuntimeSettings = {
    enabled: Boolean(data.enabled),
    provider,
    baseUrl: primary.baseUrl,
    model: data.model ?? DEFAULTS.model,
    fallbackProvider,
    fallbackModel: data.fallback_model ?? null,
    assistantName: data.assistant_name ?? DEFAULTS.assistantName,
    systemInstructions,
    temperature:
      data.temperature != null ? Number(data.temperature) : null,
    maxOutputTokens: data.max_output_tokens ?? DEFAULTS.maxOutputTokens,
    maxMessageLength: data.max_message_length ?? DEFAULTS.maxMessageLength,
    hourlyLimit: data.hourly_limit ?? DEFAULTS.hourlyLimit,
    dailyLimit: data.daily_limit ?? DEFAULTS.dailyLimit,
    contextEnabled: data.context_enabled ?? DEFAULTS.contextEnabled,
    historyEnabled: data.history_enabled ?? DEFAULTS.historyEnabled,
    knowledgeEnabled: data.knowledge_enabled ?? DEFAULTS.knowledgeEnabled,
    injectPht: data.inject_pht ?? DEFAULTS.injectPht,
    injectBatchContext:
      data.inject_batch_context ?? DEFAULTS.injectBatchContext,
    includeSourceRefs:
      data.include_source_refs ?? DEFAULTS.includeSourceRefs,
    escalationEnabled:
      data.escalation_enabled ?? DEFAULTS.escalationEnabled,
    fallbackMessage: data.fallback_message ?? null,
    supportContact: data.support_contact ?? null,
    welcomeMessage: data.welcome_message ?? null,
    voiceEnabled: Boolean(data.voice_enabled),
    elevenlabsVoiceId: data.elevenlabs_voice_id ?? null,
    elevenlabsModelId:
      data.elevenlabs_model_id ?? DEFAULTS.elevenlabsModelId,
    ttsStability:
      data.tts_stability != null ? Number(data.tts_stability) : 0.5,
    ttsSimilarity:
      data.tts_similarity != null ? Number(data.tts_similarity) : 0.75,
    ttsStyle: data.tts_style != null ? Number(data.tts_style) : 0,
    sttEnabled: data.stt_enabled ?? true,
    storeRawAudio: Boolean(data.store_raw_audio),
    apiKey: primary.apiKey,
    fallbackApiKey,
    fallbackBaseUrl,
    elevenlabsApiKey: eleven.apiKey,
  };

  if (!settings.enabled) {
    return { ok: false, reason: "disabled", settings };
  }
  if (!settings.apiKey) {
    return { ok: false, reason: "missing_key", settings };
  }

  return { ok: true, settings, service };
}

export function unavailableMessage(
  reason: AiUnavailableReason,
  settings: AiRuntimeSettings | null
) {
  if (settings?.fallbackMessage?.trim()) {
    return settings.fallbackMessage.trim();
  }
  if (reason === "disabled") {
    return "The AI Assistant is temporarily unavailable.";
  }
  return "The AI Assistant is not available yet. Please contact academy support if you need help.";
}

export function philippineNowString() {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(new Date());
}
