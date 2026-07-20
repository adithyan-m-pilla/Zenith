import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompts: Record<string, string> = {
  basic:
    "You are a friendly AI tutor for students. Explain everything from the very fundamentals — assume the student knows nothing. Use simple language, analogies, and step-by-step breakdowns. Start from the basics even if the concept is advanced.",
  moderate:
    "You are a helpful AI tutor. Give clear, standard explanations with proper definitions, examples, and context. Be thorough but concise.",
  hard:
    "You are a challenging AI tutor. Instead of giving full answers, provide small clues, guiding questions, and hints so the student figures it out themselves. Only reveal more if they're truly stuck.",
  quiz:
    "You are a quiz master AI tutor. When a student mentions a topic or chapter, test them with questions of increasing difficulty. Give progressive hints if they struggle. After each answer, provide brief feedback before the next question.",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages, level } = await req.json();
    const ZAI_API_KEY = Deno.env.get("ZAI_API_KEY");
    if (!ZAI_API_KEY) throw new Error("ZAI_API_KEY is not configured");

    const systemPrompt = systemPrompts[level] || systemPrompts.moderate;

    const response = await fetch(
      "https://api.z.ai/api/paas/v4/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ZAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "glm-4.6",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited — please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits exhausted — please top up your z.ai account." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("z.ai error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
