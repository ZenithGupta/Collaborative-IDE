import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ModelConfig {
  provider: "gemini" | "openrouter";
  modelId: string;
  label: string;
}

const MODELS: Record<string, ModelConfig> = {
  "gemini-2.5-flash": { provider: "gemini", modelId: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  "gemini-2.0-flash": { provider: "gemini", modelId: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  "qwen3-coder": { provider: "openrouter", modelId: "qwen/qwen3-coder:free", label: "Qwen3 Coder" },
  "gemma-4-26b": { provider: "openrouter", modelId: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B" },
};

const FALLBACK_ORDER = ["gemini-2.0-flash", "qwen3-coder", "gemma-4-26b"];

const SYSTEM_PROMPT = `You are an expert AI coding assistant integrated into a collaborative IDE. Users give you prompts, and you generate or modify code.

CRITICAL RULES:
1. Return your response as a JSON object with this EXACT structure:
{
  "plan": "Brief description of what you'll do",
  "file_changes": [
    {
      "action": "edit" | "create",
      "file_id": "uuid-of-existing-file (required for edit, null for create)",
      "file_name": "filename.ext",
      "file_path": "path/to/file",
      "content": "complete file content here"
    }
  ]
}
2. For "edit" actions, replace the ENTIRE file content with the updated version.
3. For "create" actions, set file_id to null and provide the new file's name, path, and content.
4. Always return valid JSON. No markdown fences, no explanations outside the JSON.
5. Write clean, production-ready code.
6. Preserve existing code structure and style when editing.
7. IMPORTANT: Your entire response must be ONLY the JSON object. Nothing else.`;

function callGemini(modelId: string, systemPrompt: string, userMessage: string): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 65536, responseMimeType: "text/plain" },
    }),
  });
}

function callOpenRouter(modelId: string, systemPrompt: string, userMessage: string): Promise<Response> {
  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": SUPABASE_URL,
      "X-Title": "CodeVibe IDE",
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 16384,
      stream: true,
    }),
  });
}

async function readGeminiStream(
  response: Response,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  sessionId: string,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<{ fullText: string; totalTokens: number }> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullResponse = "";
  let totalTokens = 0;

  while (true) {
    const { data: cur } = await supabaseAdmin.from("ai_sessions").select("status").eq("id", sessionId).single();
    if (cur?.status === "cancelled") {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "cancelled" })}\n\n`));
      reader.cancel();
      return { fullText: fullResponse, totalTokens };
    }
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (text) {
          fullResponse += text;
          totalTokens += text.length / 4;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "chunk", text })}\n\n`));
        }
        if (parsed?.usageMetadata) {
          totalTokens = (parsed.usageMetadata.promptTokenCount || 0) + (parsed.usageMetadata.candidatesTokenCount || 0);
        }
      } catch { /* skip */ }
    }
  }
  return { fullText: fullResponse, totalTokens };
}

async function readOpenRouterStream(
  response: Response,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  sessionId: string,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<{ fullText: string; totalTokens: number }> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullResponse = "";
  let totalTokens = 0;

  while (true) {
    const { data: cur } = await supabaseAdmin.from("ai_sessions").select("status").eq("id", sessionId).single();
    if (cur?.status === "cancelled") {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "cancelled" })}\n\n`));
      reader.cancel();
      return { fullText: fullResponse, totalTokens };
    }
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const text = parsed?.choices?.[0]?.delta?.content || "";
        if (text) {
          fullResponse += text;
          totalTokens += text.length / 4;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "chunk", text })}\n\n`));
        }
      } catch { /* skip */ }
    }
  }
  return { fullText: fullResponse, totalTokens };
}

function extractJSON(raw: string): { plan: string; file_changes: any[] } {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  text = text.trim();

  try {
    const parsed = JSON.parse(text);
    if (parsed && (parsed.file_changes || parsed.plan)) return parsed;
  } catch { /* continue */ }

  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (parsed && (parsed.file_changes || parsed.plan)) return parsed;
    } catch {
      try {
        const fixed = match[0].replace(/,\s*([\]}])/g, "$1");
        const parsed = JSON.parse(fixed);
        if (parsed && (parsed.file_changes || parsed.plan)) return parsed;
      } catch { /* continue */ }
    }
  }
  throw new Error("Could not extract valid JSON from AI response");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { prompt, projectId, fileId, allFiles, model: requestedModel } = await req.json();

    if (!prompt || !projectId) {
      return new Response(
        JSON.stringify({ error: "Missing prompt or projectId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auto-clean stale sessions stuck in "running" for over 3 minutes
    const staleThreshold = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("ai_sessions")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("status", "running")
      .lt("created_at", staleThreshold);

    const { data: activeSessions } = await supabaseAdmin
      .from("ai_sessions")
      .select("id, file_id")
      .eq("project_id", projectId)
      .eq("status", "running");

    if (activeSessions && activeSessions.length > 0) {
      return new Response(
        JSON.stringify({ error: "AI is already running on this project. Wait for it to finish or cancel it." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("ai_sessions")
      .insert({
        project_id: projectId,
        file_id: fileId || null,
        user_id: user.id,
        prompt,
        status: "running",
      })
      .select()
      .single();

    if (sessionError) {
      console.error("[ai-generate] Failed to create session:", sessionError);
      return new Response(
        JSON.stringify({ error: "Failed to start AI session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let fileContext = "";
    if (allFiles && allFiles.length > 0) {
      fileContext = allFiles
        .map((f: { id: string; name: string; path: string; content: string | null }) =>
          `--- FILE: ${f.path || f.name} (id: ${f.id}) ---\n${f.content || "(empty)"}\n--- END FILE ---`
        )
        .join("\n\n");
    }

    const userMessage = `## Project Files\n${fileContext}\n\n## User Request\n${prompt}${
      fileId ? `\n\n## Primary Target File ID\n${fileId}` : ""
    }`;

    const selectedModelKey = requestedModel && MODELS[requestedModel] ? requestedModel : "gemini-2.5-flash";
    const canUseGemini = !!GEMINI_API_KEY;
    const canUseOpenRouter = !!OPENROUTER_API_KEY;

    if (!canUseGemini && !canUseOpenRouter) {
      await supabaseAdmin.from("ai_sessions").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", session.id);
      return new Response(
        JSON.stringify({ error: "No AI API keys configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const modelsToTry: string[] = [selectedModelKey];
    for (const fb of FALLBACK_ORDER) {
      if (!modelsToTry.includes(fb)) modelsToTry.push(fb);
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "session_start", sessionId: session.id })}\n\n`));

          let fullResponse = "";
          let totalTokens = 0;
          let usedModel = selectedModelKey;
          let succeeded = false;

          for (const modelKey of modelsToTry) {
            const modelCfg = MODELS[modelKey];
            if (!modelCfg) continue;
            if (modelCfg.provider === "gemini" && !canUseGemini) continue;
            if (modelCfg.provider === "openrouter" && !canUseOpenRouter) continue;

            try {
              const apiResponse = modelCfg.provider === "gemini"
                ? await callGemini(modelCfg.modelId, SYSTEM_PROMPT, userMessage)
                : await callOpenRouter(modelCfg.modelId, SYSTEM_PROMPT, userMessage);

              if (!apiResponse.ok) {
                const errText = await apiResponse.text();
                console.error(`[ai-generate] ${modelCfg.label} returned ${apiResponse.status}: ${errText.slice(0, 300)}`);
                if (modelKey === selectedModelKey) {
                  controller.enqueue(encoder.encode(
                    `data: ${JSON.stringify({ type: "chunk", text: `⚠️ ${modelCfg.label} unavailable (${apiResponse.status}), trying fallback...\n\n` })}\n\n`
                  ));
                }
                continue;
              }

              const result = modelCfg.provider === "gemini"
                ? await readGeminiStream(apiResponse, controller, encoder, session.id, supabaseAdmin)
                : await readOpenRouterStream(apiResponse, controller, encoder, session.id, supabaseAdmin);

              fullResponse = result.fullText;
              totalTokens = result.totalTokens;
              usedModel = modelKey;
              succeeded = true;
              break;
            } catch (modelErr) {
              console.error(`[ai-generate] ${modelCfg.label} error:`, modelErr);
              if (modelKey === selectedModelKey) {
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: "chunk", text: `⚠️ ${modelCfg.label} failed, trying fallback...\n\n` })}\n\n`
                ));
              }
              continue;
            }
          }

          if (!succeeded) {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: "All AI models are unavailable. Please try again later." })}\n\n`
            ));
            await supabaseAdmin.from("ai_sessions").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", session.id);
            controller.close();
            return;
          }

          try {
            const parsed = extractJSON(fullResponse);
            const fileChanges = parsed.file_changes || [];
            const affectedFiles: { id: string; name: string; action: string }[] = [];

            for (const change of fileChanges) {
              if (change.action === "edit" && change.file_id) {
                const { error: updateError } = await supabaseAdmin
                  .from("project_files")
                  .update({ content: change.content, updated_at: new Date().toISOString() })
                  .eq("id", change.file_id);
                if (updateError) {
                  console.error(`[ai-generate] Failed to update file ${change.file_id}:`, updateError);
                } else {
                  affectedFiles.push({ id: change.file_id, name: change.file_name, action: "edit" });
                }
              } else if (change.action === "create") {
                const { data: newFile, error: createError } = await supabaseAdmin
                  .from("project_files")
                  .insert({
                    project_id: projectId,
                    name: change.file_name,
                    path: change.file_path || change.file_name,
                    content: change.content,
                    is_folder: false,
                  })
                  .select()
                  .single();
                if (createError) {
                  console.error(`[ai-generate] Failed to create file ${change.file_name}:`, createError);
                } else {
                  affectedFiles.push({ id: newFile.id, name: change.file_name, action: "create" });
                }
              }
            }

            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: "complete", plan: parsed.plan || "", affectedFiles, tokensUsed: totalTokens, model: usedModel })}\n\n`
            ));

            await supabaseAdmin.from("ai_sessions").update({
              status: "completed",
              completed_at: new Date().toISOString(),
              tokens_used: Math.round(totalTokens),
              affected_files: JSON.stringify(affectedFiles),
            }).eq("id", session.id);
          } catch (parseError) {
            console.error("[ai-generate] Failed to parse AI response:", parseError);
            console.error("[ai-generate] Raw (first 1000):", fullResponse.slice(0, 1000));
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: "AI returned an invalid response. Try rephrasing your prompt or switching models.", rawResponse: fullResponse.slice(0, 500) })}\n\n`
            ));
            await supabaseAdmin.from("ai_sessions").update({
              status: "failed",
              completed_at: new Date().toISOString(),
              tokens_used: Math.round(totalTokens),
            }).eq("id", session.id);
          }

          controller.close();
        } catch (err) {
          console.error("[ai-generate] Stream error:", err);
          await supabaseAdmin.from("ai_sessions").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", session.id);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (error) {
    console.error("[ai-generate] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
