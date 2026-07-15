import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerUserClient } from "@/lib/supabase/server";
import {
  loadAiSettings,
  unavailableMessage,
  type AiRuntimeSettings,
} from "@/lib/ai/settings";
import { BASE_SYSTEM_PROMPT, buildAcademyContext } from "@/lib/ai/context";
import {
  callAiProvider,
  ProviderError,
  type ChatTurn,
} from "@/lib/ai/providers";
import type { PortalProfile } from "@/lib/portal/types";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HISTORY_TURNS = 12;

type ChatErrorCode =
  | "unauthorized"
  | "unavailable"
  | "invalid"
  | "message_too_long"
  | "rate_limited"
  | "duplicate"
  | "provider_error";

function chatError(code: ChatErrorCode, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

async function checkRateLimit(
  service: SupabaseClient,
  userId: string,
  settings: AiRuntimeSettings
): Promise<boolean> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [hourly, daily] = await Promise.all([
    service
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", hourAgo),
    service
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", dayAgo),
  ]);

  return (
    (hourly.count ?? 0) < settings.hourlyLimit &&
    (daily.count ?? 0) < settings.dailyLimit
  );
}

async function logUsage(
  service: SupabaseClient,
  entry: {
    userId: string;
    conversationId: string | null;
    provider: string;
    model: string;
    ok: boolean;
    errorCategory?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    latencyMs: number;
    usedFallback?: boolean;
  }
) {
  await service.from("ai_usage_logs").insert({
    user_id: entry.userId,
    conversation_id: entry.conversationId,
    provider: entry.provider,
    model: entry.model,
    ok: entry.ok,
    error_category: entry.errorCategory ?? null,
    input_tokens: entry.inputTokens ?? null,
    output_tokens: entry.outputTokens ?? null,
    latency_ms: entry.latencyMs,
    request_kind: "chat",
    used_fallback: entry.usedFallback ?? false,
  });
}

async function loadKnowledge(service: SupabaseClient): Promise<string> {
  const { data } = await service
    .from("ai_knowledge_items")
    .select("title, body, category")
    .eq("enabled", true)
    .order("sort_order", { ascending: true })
    .limit(30);
  if (!data?.length) return "";
  return data
    .map((i) => `[${i.category}] ${i.title}\n${String(i.body).slice(0, 1000)}`)
    .join("\n\n")
    .slice(0, 6000);
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return chatError("unauthorized", "Please sign in again.", 401);
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, tier, status, batch")
    .eq("id", user.id)
    .maybeSingle<PortalProfile>();

  if (profileRow && profileRow.status !== "active") {
    return chatError(
      "unavailable",
      "The AI Assistant is not available for this account.",
      403
    );
  }

  const profile: PortalProfile = profileRow ?? {
    id: user.id,
    full_name: null,
    email: user.email ?? null,
    role: "student",
    tier: null,
    status: "active",
    batch: null,
  };

  const config = await loadAiSettings();
  if (!config.ok) {
    return chatError(
      "unavailable",
      unavailableMessage(config.reason, config.settings),
      503
    );
  }
  const { settings, service } = config;

  let body: {
    conversationId?: unknown;
    message?: unknown;
    escalate?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return chatError("invalid", "Invalid request.");
  }

  const message =
    typeof body.message === "string" ? body.message.trim() : "";
  const requestedConversationId =
    typeof body.conversationId === "string" ? body.conversationId : null;
  const wantsEscalate = body.escalate === true;

  if (!message && !wantsEscalate) {
    return chatError("invalid", "Please type a message first.");
  }
  if (message.length > settings.maxMessageLength) {
    return chatError(
      "message_too_long",
      `Messages are limited to ${settings.maxMessageLength} characters.`
    );
  }
  if (requestedConversationId && !UUID_RE.test(requestedConversationId)) {
    return chatError("invalid", "Invalid conversation.");
  }

  // Human escalation creates a support ticket and returns safely.
  if (wantsEscalate && settings.escalationEnabled) {
    const subject =
      message.length > 0
        ? `AI Assistant escalation: ${message.slice(0, 80)}`
        : "Help requested from AI Assistant";
    const ticketBody =
      message.length > 0
        ? message
        : "Student requested human support from the AI Assistant.";

    const { data: ticket, error: ticketError } = await supabase
      .from("support_requests")
      .insert({
        user_id: user.id,
        subject,
        category: "ai_assistant",
        message: ticketBody,
        status: "open",
        priority: "normal",
      })
      .select("id, reference_code")
      .single();

    if (ticketError || !ticket) {
      return chatError(
        "provider_error",
        "We couldn't create a support ticket right now. Please open Support from the menu.",
        500
      );
    }

    return NextResponse.json({
      ok: true,
      escalated: true,
      ticketId: ticket.id,
      referenceCode: ticket.reference_code,
      reply: `I've created a support ticket (${ticket.reference_code ?? "submitted"}) for the academy team. You can continue the conversation under Support.`,
      conversationId: requestedConversationId,
    });
  }

  const withinLimits = await checkRateLimit(service, user.id, settings);
  if (!withinLimits) {
    return chatError(
      "rate_limited",
      "You've reached the current chat limit. Please try again later or contact support.",
      429
    );
  }

  let conversationId: string | null = null;
  let history: ChatTurn[] = [];

  if (settings.historyEnabled) {
    if (requestedConversationId) {
      const { data: conversation } = await service
        .from("ai_conversations")
        .select("id, user_id")
        .eq("id", requestedConversationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!conversation) {
        return chatError("invalid", "Conversation not found.", 404);
      }
      conversationId = conversation.id as string;

      const { data: rows } = await service
        .from("ai_messages")
        .select("role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_TURNS);

      history = (rows ?? [])
        .reverse()
        .map((row) => ({
          role: row.role as "user" | "assistant",
          content: String(row.content).slice(0, settings.maxMessageLength),
        }));

      const lastUser = [...(rows ?? [])].find((r) => r.role === "user");
      if (
        lastUser &&
        lastUser.content === message &&
        Date.now() - new Date(lastUser.created_at as string).getTime() < 10_000
      ) {
        return chatError(
          "duplicate",
          "That message was just sent. Give me a moment to answer.",
          429
        );
      }
    } else {
      const { data: created, error: createError } = await service
        .from("ai_conversations")
        .insert({
          user_id: user.id,
          title: message.slice(0, 80),
        })
        .select("id")
        .single();

      if (createError || !created) {
        return chatError(
          "provider_error",
          "We couldn't start a conversation right now. Please try again.",
          500
        );
      }
      conversationId = created.id as string;
    }
  }

  let system = BASE_SYSTEM_PROMPT;
  if (settings.systemInstructions?.trim()) {
    system += `\n\nAcademy-specific instructions from the AIvanza Academy team:\n${settings.systemInstructions.trim()}`;
  }

  if (settings.contextEnabled) {
    try {
      const knowledgeText = settings.knowledgeEnabled
        ? await loadKnowledge(service)
        : null;
      const context = await buildAcademyContext(supabase, profile, {
        injectPht: settings.injectPht,
        injectBatchContext: settings.injectBatchContext,
        knowledgeText,
        includeSourceRefs: settings.includeSourceRefs,
      });
      system += `\n\nACADEMY CONTEXT (verified records this student is authorized to see):\n${context}`;
    } catch {
      // best-effort
    }
  }

  const startedAt = Date.now();
  let usedFallback = false;
  let provider = settings.provider;
  let model = settings.model;
  let apiKey = settings.apiKey as string;
  let baseUrl = settings.baseUrl;

  try {
    let response;
    try {
      response = await callAiProvider({
        provider,
        baseUrl,
        model,
        apiKey,
        system,
        messages: [...history, { role: "user", content: message }],
        maxOutputTokens: settings.maxOutputTokens,
        temperature: settings.temperature,
      });
    } catch (primaryError) {
      if (
        settings.fallbackProvider &&
        settings.fallbackModel &&
        settings.fallbackApiKey
      ) {
        usedFallback = true;
        provider = settings.fallbackProvider;
        model = settings.fallbackModel;
        apiKey = settings.fallbackApiKey;
        baseUrl = settings.fallbackBaseUrl;
        response = await callAiProvider({
          provider,
          baseUrl,
          model,
          apiKey,
          system,
          messages: [...history, { role: "user", content: message }],
          maxOutputTokens: settings.maxOutputTokens,
          temperature: settings.temperature,
        });
      } else {
        throw primaryError;
      }
    }

    const latencyMs = Date.now() - startedAt;

    if (settings.historyEnabled && conversationId) {
      await service.from("ai_messages").insert([
        {
          conversation_id: conversationId,
          role: "user",
          content: message,
        },
        {
          conversation_id: conversationId,
          role: "assistant",
          content: response.text,
          provider,
          model,
          input_tokens: response.inputTokens,
          output_tokens: response.outputTokens,
        },
      ]);
      await service
        .from("ai_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    await logUsage(service, {
      userId: user.id,
      conversationId,
      provider,
      model,
      ok: true,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      latencyMs,
      usedFallback,
    });

    return NextResponse.json({
      ok: true,
      conversationId,
      reply: response.text,
      voiceAvailable: Boolean(
        settings.voiceEnabled &&
          settings.elevenlabsApiKey &&
          settings.elevenlabsVoiceId
      ),
    });
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const category =
      error instanceof ProviderError ? error.category : "unknown";

    await logUsage(service, {
      userId: user.id,
      conversationId,
      provider,
      model,
      ok: false,
      errorCategory: category,
      latencyMs,
      usedFallback,
    });

    return chatError(
      "provider_error",
      "We couldn't get an answer right now. Please try again or contact support.",
      502
    );
  }
}
