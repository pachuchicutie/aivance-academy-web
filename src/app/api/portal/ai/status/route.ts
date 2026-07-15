import { NextResponse } from "next/server";
import { createSupabaseServerUserClient } from "@/lib/supabase/server";
import { loadAiSettings, unavailableMessage } from "@/lib/ai/settings";

export const dynamic = "force-dynamic";

/** Availability + safe display settings for the chat widget. Auth required. */
export async function GET() {
  const supabase = await createSupabaseServerUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile && profile.status !== "active") {
    return NextResponse.json({
      available: false,
      assistantName: "AI Assistant",
      message: "The AI Assistant is not available for this account.",
      historyEnabled: false,
      maxMessageLength: 0,
      supportContact: null,
      voiceEnabled: false,
      sttEnabled: false,
      escalationEnabled: false,
      welcomeMessage: null,
    });
  }

  const result = await loadAiSettings();

  if (!result.ok) {
    return NextResponse.json({
      available: false,
      assistantName: result.settings?.assistantName ?? "AI Assistant",
      message: unavailableMessage(result.reason, result.settings),
      historyEnabled: false,
      maxMessageLength: 0,
      supportContact: result.settings?.supportContact ?? null,
      voiceEnabled: false,
      sttEnabled: false,
      escalationEnabled: result.settings?.escalationEnabled ?? true,
      welcomeMessage: null,
    });
  }

  const s = result.settings;
  const voiceReady = Boolean(
    s.voiceEnabled && s.elevenlabsApiKey && s.elevenlabsVoiceId
  );

  return NextResponse.json({
    available: true,
    assistantName: s.assistantName,
    historyEnabled: s.historyEnabled,
    maxMessageLength: s.maxMessageLength,
    supportContact: s.supportContact,
    voiceEnabled: voiceReady,
    sttEnabled: s.sttEnabled,
    escalationEnabled: s.escalationEnabled,
    welcomeMessage: s.welcomeMessage,
  });
}
