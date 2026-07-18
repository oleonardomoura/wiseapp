import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { text, speakingRate = 1.0, voice = "en-US-Neural2-D" } = await req.json();

    if (!text || typeof text !== "string") {
      return respond({ error: "text is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Build cache key from text + rate + voice
    const encoder = new TextEncoder();
    const data = encoder.encode(`${text}__${speakingRate.toFixed(2)}__${voice}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const cacheKey = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    const filePath = `${cacheKey}.mp3`;

    // ── 1. Check Supabase Storage cache ──
    const { data: existingFile } = await supabase.storage
      .from("tts-cache")
      .createSignedUrl(filePath, 3600);

    if (existingFile?.signedUrl) {
      console.log("Cache hit:", filePath);
      return respond({ audioUrl: existingFile.signedUrl, cached: true });
    }

    // ── 2. Get Google TTS API key ──
    const apiKey = Deno.env.get("GOOGLE_TTS_API_KEY");
    if (!apiKey) {
      return respond({ error: "Google TTS API key not configured" }, 500);
    }

    console.log("Calling Google TTS for:", text.substring(0, 50));

    // ── 3. Call Google TTS API ──
    const ttsResponse = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: "en-US",
            name: voice,
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate,
            pitch: 0,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errData = await ttsResponse.text();
      console.error("Google TTS error:", errData);

      if (ttsResponse.status === 429) {
        return respond({ error: "Cota da API atingida. Tente novamente mais tarde." }, 429);
      }

      return respond({ error: "Falha ao gerar áudio", details: errData }, 500);
    }

    const ttsData = await ttsResponse.json();
    const audioContent: string = ttsData.audioContent; // base64

    if (!audioContent) {
      return respond({ error: "Google TTS não retornou áudio" }, 500);
    }

    // ── 4. Decode base64 and upload to Supabase Storage cache ──
    const binaryString = atob(audioContent);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const { error: uploadError } = await supabase.storage
      .from("tts-cache")
      .upload(filePath, bytes, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      console.warn("Cache upload failed, returning base64 data URL:", uploadError.message);
      // Fallback: return base64 as data URL (always valid for browser Audio)
      const dataUrl = `data:audio/mpeg;base64,${audioContent}`;
      return respond({ audioUrl: dataUrl, cached: false });
    }

    // ── 5. Return public URL of cached file ──
    const { data: publicData } = supabase.storage
      .from("tts-cache")
      .getPublicUrl(filePath);

    return respond({ audioUrl: publicData.publicUrl, cached: false });

  } catch (error) {
    console.error("TTS Error:", error);
    return respond({ error: "Erro interno ao processar áudio" }, 500);
  }
});