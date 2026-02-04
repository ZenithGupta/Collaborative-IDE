import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Piston API endpoint (public, no API key needed)
const PISTON_API = "https://emkc.org/api/v2/piston/execute";

// Language mapping for Piston API
const LANGUAGE_CONFIG: Record<string, { language: string; version: string; filename: string }> = {
  javascript: { language: "javascript", version: "18.15.0", filename: "main.js" },
  typescript: { language: "typescript", version: "5.0.3", filename: "main.ts" },
  python: { language: "python", version: "3.10.0", filename: "main.py" },
  cpp: { language: "c++", version: "10.2.0", filename: "main.cpp" },
  c: { language: "c", version: "10.2.0", filename: "main.c" },
  java: { language: "java", version: "15.0.2", filename: "Main.java" },
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, language } = await req.json();

    console.log(`[execute-code] Received request for language: ${language}`);
    console.log(`[execute-code] Code length: ${code?.length || 0} chars`);

    if (!code || !language) {
      console.error("[execute-code] Missing code or language");
      return new Response(
        JSON.stringify({ error: "Missing code or language" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = LANGUAGE_CONFIG[language];
    if (!config) {
      console.error(`[execute-code] Unsupported language: ${language}`);
      return new Response(
        JSON.stringify({ error: `Unsupported language: ${language}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[execute-code] Calling Piston API with config:`, config);

    // Call Piston API
    const pistonResponse = await fetch(PISTON_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: config.language,
        version: config.version,
        files: [
          {
            name: config.filename,
            content: code,
          },
        ],
        stdin: "",
        args: [],
        compile_timeout: 10000,
        run_timeout: 5000,
        compile_memory_limit: -1,
        run_memory_limit: -1,
      }),
    });

    if (!pistonResponse.ok) {
      const errorText = await pistonResponse.text();
      console.error(`[execute-code] Piston API error: ${pistonResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Execution service error: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await pistonResponse.json();
    console.log(`[execute-code] Piston API response:`, JSON.stringify(result));

    // Format output
    const output: string[] = [];
    
    // Add compile output if present
    if (result.compile && result.compile.output) {
      if (result.compile.code !== 0) {
        output.push(`❌ Compilation Error:`);
        output.push(result.compile.output.trim());
      }
    }

    // Add run output
    if (result.run) {
      if (result.run.output) {
        output.push(result.run.output.trim());
      }
      if (result.run.stderr && result.run.stderr.trim()) {
        output.push(`⚠️ stderr: ${result.run.stderr.trim()}`);
      }
      if (result.run.code !== 0 && !result.run.output && !result.run.stderr) {
        output.push(`❌ Process exited with code ${result.run.code}`);
      }
    }

    if (output.length === 0) {
      output.push("✓ Code executed successfully (no output)");
    }

    console.log(`[execute-code] Success - returning ${output.length} lines`);

    return new Response(
      JSON.stringify({ output, success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[execute-code] Error:`, error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
