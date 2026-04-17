import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Wandbox API endpoint
const WANDBOX_API = "https://wandbox.org/api/compile.json";

// Language mapping for Wandbox API compilers
const LANGUAGE_CONFIG: Record<string, string> = {
  javascript: "nodejs-head",
  typescript: "typescript-head",
  python: "cpython-head",
  cpp: "gcc-head",
  c: "gcc-head-c",
  java: "openjdk-head",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, language, stdin: userStdin } = await req.json();

    console.log(`[execute-code] Received request for language: ${language}`);
    console.log(`[execute-code] Code length: ${code?.length || 0} chars`);

    if (!code || !language) {
      console.error("[execute-code] Missing code or language");
      return new Response(
        JSON.stringify({ error: "Missing code or language" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const compiler = LANGUAGE_CONFIG[language];
    if (!compiler) {
      console.error(`[execute-code] Unsupported language: ${language}`);
      return new Response(
        JSON.stringify({ error: `Unsupported language: ${language}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[execute-code] Calling Wandbox API with compiler:`, compiler);

    // Call Wandbox API
    const response = await fetch(WANDBOX_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compiler: compiler,
        code: code,
        stdin: userStdin || "",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[execute-code] Wandbox API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Execution service error: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log(`[execute-code] Wandbox API response format status:`, result.status);

    // Format output
    const output: string[] = [];

    // Add compile output/error if present
    if (result.compiler_error) {
      output.push(`❌ Compilation Error:`);
      output.push(result.compiler_error.trim());
    }

    // Add run output
    if (result.program_output) {
      output.push(result.program_output.trim());
    }
    
    if (result.program_error) {
      output.push(`⚠️ stderr: ${result.program_error.trim()}`);
    }
    
    if (result.status !== "0" && !result.program_output && !result.program_error) {
      output.push(`❌ Process exited with status ${result.status}`);
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
