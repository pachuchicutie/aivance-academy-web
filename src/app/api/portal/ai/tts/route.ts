import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerUserClient } from "@/lib/supabase/server";
import { loadAiSettings } from "@/lib/ai/settings";
import { synthesizeElevenLabsSpeech, ProviderError } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

/**
 * Server-side TTS. Never exposes ElevenLabs key to the browser.
 * Raw audio is not persisted by default.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Please sign in again." },
      { status: 401 }
    );
  }

  const config = await loadAiSettings();
  if (!config.ok) {
    return NextResponse.json(
      { ok: false, message: "Voice is not available." },
      { status: 503 }
    );
  }

  const { settings, service } = config;
  if (
    !settings.voiceEnabled ||
    !settings.elevenlabsApiKey ||
    !settings.elevenlabsVoiceId
  ) {
    return NextResponse.json(
      { ok: false, message: "Voice responses are not enabled." },
      { status: 403 }
    );
  }

  let body: { text?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid request." },
      { status: 400 }
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json(
      { ok: false, message: "Nothing to speak." },
      { status: 400 }
    );
  }

  const started = Date.now();
  try {
    const audio = await synthesizeElevenLabsSpeech({
      apiKey: settings.elevenlabsApiKey,
      voiceId: settings.elevenlabsVoiceId,
      text: text.slice(0, 2000),
      modelId: settings.elevenlabsModelId,
      stability: settings.ttsStability,
      similarity: settings.ttsSimilarity,
      style: settings.ttsStyle,
    });

    await service.from("ai_usage_logs").insert({
      user_id: user.id,
      provider: "elevenlabs",
      model: settings.elevenlabsModelId,
      ok: true,
      latency_ms: Date.now() - started,
      request_kind: "voice_tts",
    });

    // Intentionally do not store raw audio unless storeRawAudio is true
    // (storage path not implemented — privacy default is no persistence).

    return new NextResponse(audio, {
      status: 200,
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const category =
      error instanceof ProviderError ? error.category : "unknown";
    await service.from("ai_usage_logs").insert({
      user_id: user.id,
      provider: "elevenlabs",
      model: settings.elevenlabsModelId,
      ok: false,
      error_category: category,
      latency_ms: Date.now() - started,
      request_kind: "voice_tts",
    });
    return NextResponse.json(
      { ok: false, message: "Could not generate voice audio." },
      { status: 502 }
    );
  }
}
