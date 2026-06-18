import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, "Content-Type": "application/json" },
    });
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

interface AnalyzeInput {
    transcript: string;
    userLanguage: string;
    context: string;
}

interface AnalyzeResult {
    originalPhrase: string;
    detectedLanguage: string;
    meaning: string;
    suggestedReplyKo: string;
    suggestedReplyRomanization: string;
    note: string;
}

function buildPrompt(input: AnalyzeInput): string {
    return `You are a helpful assistant for foreign tourists visiting Korean restaurants.

The user heard or wants to say the following text in a Korean restaurant.
Analyze the input and return a JSON object.

Input: "${input.transcript}"
User's language: ${input.userLanguage}
Context: ${input.context}

Rules:
- Detect if the input is Korean (ko) or another language.
- If the input is Korean, explain the meaning in ${input.userLanguage}.
- If the input is in another language (e.g. English), provide the natural Korean equivalent as the meaning.
- Provide a short, natural Korean reply (suggestedReplyKo) that the user can say in the restaurant.
- Provide romanization of the Korean reply (suggestedReplyRomanization).
- Keep all text concise. No long explanations.
- If the input is unrelated to a restaurant situation, set meaning to a polite message asking to try again, and set suggestedReplyKo to an empty string.
- Return ONLY valid JSON. No markdown, no code fences, no extra text outside the JSON.

Return this exact JSON structure:
{
  "originalPhrase": "<the input text, unchanged>",
  "detectedLanguage": "<language code, e.g. ko or en>",
  "meaning": "<meaning or translation>",
  "suggestedReplyKo": "<short natural Korean reply>",
  "suggestedReplyRomanization": "<romanization of the Korean reply>",
  "note": "<brief optional note, or empty string>"
}`;
}

async function analyzeWithOpenAI(input: AnalyzeInput): Promise<AnalyzeResult> {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: buildPrompt(input) }],
            temperature: 0.3,
            response_format: { type: "json_object" },
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenAI error: ${res.status} ${text}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from OpenAI.");

    return JSON.parse(content) as AnalyzeResult;
}

// Solar provider stub — reserved for future migration
// To switch: replace analyzeWithOpenAI(input) in analyzeVoiceHelp with analyzeWithSolar(input)
async function analyzeWithSolar(_input: AnalyzeInput): Promise<AnalyzeResult> {
    // TODO: implement when switching to Solar LLM
    // const apiKey = Deno.env.get("SOLAR_API_KEY");
    throw new Error("Solar provider is not yet implemented.");
}

async function analyzeVoiceHelp(input: AnalyzeInput): Promise<AnalyzeResult> {
    return analyzeWithOpenAI(input);
    // To switch provider: return analyzeWithSolar(input);
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS });
    }

    if (req.method !== "POST") {
        return jsonResponse({ error: "POST requests only." }, 405);
    }

    try {
        const body = await req.json().catch(() => null);

        if (!body || typeof body.transcript !== "string" || !body.transcript.trim()) {
            return jsonResponse({ error: "'transcript' is required." }, 400);
        }

        const input: AnalyzeInput = {
            transcript: body.transcript.trim(),
            userLanguage: typeof body.userLanguage === "string" ? body.userLanguage : "en",
            context: typeof body.context === "string" ? body.context : "Korean restaurant",
        };

        const result = await analyzeVoiceHelp(input);
        return jsonResponse(result);
    } catch (error) {
        return jsonResponse({ error: getErrorMessage(error) }, 500);
    }
});
