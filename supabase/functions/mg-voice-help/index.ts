import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_TRANSCRIPT_LENGTH = 500;
const PROVIDER_TIMEOUT_MS = 10000;

// Maps the app's locale code (see src/shared/i18n/localeFallback.js's
// SUPPORTED_LOCALES) to a human-readable language name for the LLM prompt.
// Sending the raw code (e.g. "zh-CN") instead of a name is ambiguous to the
// model and was producing English explanations even when userLanguage was
// "zh-CN" — this table is the fix. Unmapped locales (e.g. before a future
// "ja" is added here) fall back to the raw code, same as elsewhere in the
// project's locale-mapping convention.
const LOCALE_LANGUAGE_NAMES: Record<string, string> = {
    ko: "Korean",
    en: "English",
    "zh-CN": "Simplified Chinese",
};

function resolveLanguageName(userLanguage: string): string {
    return LOCALE_LANGUAGE_NAMES[userLanguage] ?? userLanguage;
}

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
    // Short gloss of suggestedReplyKo's meaning in the user's language. Additive
    // field (not in REQUIRED_STRING_FIELDS) — older clients that don't read it
    // are unaffected, and a provider response missing it doesn't fail validation.
    suggestedReplyMeaning: string;
    note: string;
}

type Provider = "solar" | "openai";

// Failure kinds that are eligible for Solar → OpenAI fallback (see analyzeVoiceHelp).
type ProviderFailureKind =
    | "config"
    | "network"
    | "timeout"
    | "auth"
    | "rate_limit"
    | "server"
    | "http_error"
    | "empty_response"
    | "parse_error"
    | "invalid_shape";

class ProviderError extends Error {
    provider: Provider;
    kind: ProviderFailureKind;
    status?: number;

    constructor(provider: Provider, kind: ProviderFailureKind, message: string, status?: number) {
        super(message);
        this.provider = provider;
        this.kind = kind;
        this.status = status;
    }
}

function logProviderOutcome(
    provider: Provider,
    outcome: "success" | "failure",
    detail?: { kind?: string; status?: number },
) {
    const parts = [`provider=${provider}`, `outcome=${outcome}`];
    if (detail?.kind) parts.push(`kind=${detail.kind}`);
    if (detail?.status) parts.push(`status=${detail.status}`);
    console.log(`[mg-voice-help] ${parts.join(" ")}`);
}

function buildPrompt(input: AnalyzeInput): string {
    const languageName = resolveLanguageName(input.userLanguage);

    return `You are a helpful assistant for foreign tourists visiting Korean restaurants.

The user heard or wants to say the following text in a Korean restaurant.
Analyze the input and return a JSON object.

Input: "${input.transcript}"
User's language: ${languageName}
Context: ${input.context}

Rules:
- Detect if the input is Korean (ko) or another language.
- If the input is Korean, explain the meaning in ${languageName}. Write the "meaning" field entirely in ${languageName} — never leave it in English if the user's language is something else.
- If the input is in another language (e.g. English), provide the natural Korean equivalent as the meaning.
- Provide a short, natural Korean reply (suggestedReplyKo) that the user can say in the restaurant.
- Provide romanization of the Korean reply (suggestedReplyRomanization).
- Provide a short gloss of what suggestedReplyKo means, written entirely in ${languageName} (suggestedReplyMeaning).
- Keep all text concise. No long explanations.
- If the input is unrelated to a restaurant situation, set meaning to a polite message (in ${languageName}) asking to try again, and set suggestedReplyKo to an empty string.
- Return ONLY valid JSON. No markdown, no code fences, no extra text outside the JSON.

Return this exact JSON structure:
{
  "originalPhrase": "<the input text, unchanged>",
  "detectedLanguage": "<language code, e.g. ko or en>",
  "meaning": "<meaning or translation, written in ${languageName}>",
  "suggestedReplyKo": "<short natural Korean reply>",
  "suggestedReplyRomanization": "<romanization of the Korean reply>",
  "suggestedReplyMeaning": "<gloss of suggestedReplyKo, written in ${languageName}>",
  "note": "<brief optional note, or empty string>"
}`;
}

function classifyHttpStatus(status: number): ProviderFailureKind {
    if (status === 401 || status === 403) return "auth";
    if (status === 429) return "rate_limit";
    if (status >= 500) return "server";
    return "http_error";
}

/** Shared OpenAI-compatible chat completions caller (used for both Solar and OpenAI). */
async function callChatCompletions(
    provider: Provider,
    url: string,
    apiKey: string,
    model: string,
    prompt: string,
): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

    let res: Response;
    try {
        res = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.3,
                response_format: { type: "json_object" },
            }),
            signal: controller.signal,
        });
    } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") {
            throw new ProviderError(provider, "timeout", `${provider} request timed out.`);
        }
        throw new ProviderError(provider, "network", `${provider} network error.`);
    } finally {
        clearTimeout(timer);
    }

    if (!res.ok) {
        // Response body is not logged/forwarded — it may contain provider-internal detail.
        throw new ProviderError(provider, classifyHttpStatus(res.status), `${provider} HTTP ${res.status}`, res.status);
    }

    const data = await res.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
        throw new ProviderError(provider, "empty_response", `${provider} returned an empty response.`);
    }

    return content;
}

/** Strip markdown code fences / surrounding prose and return the JSON substring. */
function extractJsonText(raw: string): string {
    let text = raw.trim();

    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch) {
        text = fenceMatch[1].trim();
    }

    if (!text.startsWith("{")) {
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) {
            text = text.slice(start, end + 1);
        }
    }

    return text;
}

const REQUIRED_STRING_FIELDS = [
    "originalPhrase",
    "detectedLanguage",
    "meaning",
    "suggestedReplyKo",
    "suggestedReplyRomanization",
] as const;

/** Shared normalizer: parses + validates a provider's raw text into the existing response contract. */
function normalizeAnalyzeResult(provider: Provider, raw: string): AnalyzeResult {
    const jsonText = extractJsonText(raw);

    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonText);
    } catch {
        throw new ProviderError(provider, "parse_error", `${provider} response was not valid JSON.`);
    }

    if (!parsed || typeof parsed !== "object") {
        throw new ProviderError(provider, "invalid_shape", `${provider} response was not a JSON object.`);
    }

    const record = parsed as Record<string, unknown>;

    for (const field of REQUIRED_STRING_FIELDS) {
        if (typeof record[field] !== "string") {
            throw new ProviderError(provider, "invalid_shape", `${provider} response missing field: ${field}`);
        }
    }

    return {
        originalPhrase: record.originalPhrase as string,
        detectedLanguage: record.detectedLanguage as string,
        meaning: record.meaning as string,
        suggestedReplyKo: record.suggestedReplyKo as string,
        suggestedReplyRomanization: record.suggestedReplyRomanization as string,
        suggestedReplyMeaning: typeof record.suggestedReplyMeaning === "string" ? record.suggestedReplyMeaning : "",
        note: typeof record.note === "string" ? record.note : "",
    };
}

async function analyzeWithSolar(input: AnalyzeInput): Promise<AnalyzeResult> {
    const apiKey = Deno.env.get("SOLAR_API_KEY");
    if (!apiKey) {
        throw new ProviderError("solar", "config", "SOLAR_API_KEY is not configured.");
    }

    const content = await callChatCompletions(
        "solar",
        "https://api.upstage.ai/v1/chat/completions",
        apiKey,
        "solar-pro",
        buildPrompt(input),
    );

    return normalizeAnalyzeResult("solar", content);
}

async function analyzeWithOpenAI(input: AnalyzeInput): Promise<AnalyzeResult> {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
        throw new ProviderError("openai", "config", "OPENAI_API_KEY is not configured.");
    }

    const content = await callChatCompletions(
        "openai",
        "https://api.openai.com/v1/chat/completions",
        apiKey,
        "gpt-4o-mini",
        buildPrompt(input),
    );

    return normalizeAnalyzeResult("openai", content);
}

// Solar 1st (max 1 call) → OpenAI fallback only on Solar failure (max 1 call). Total ≤ 2 LLM calls.
// Solar success (parsed + validated) short-circuits — OpenAI is never called in that case.
async function analyzeVoiceHelp(input: AnalyzeInput): Promise<AnalyzeResult> {
    try {
        const result = await analyzeWithSolar(input);
        logProviderOutcome("solar", "success");
        return result;
    } catch (solarError) {
        const kind = solarError instanceof ProviderError ? solarError.kind : "unknown";
        const status = solarError instanceof ProviderError ? solarError.status : undefined;
        logProviderOutcome("solar", "failure", { kind, status });

        try {
            const result = await analyzeWithOpenAI(input);
            logProviderOutcome("openai", "success");
            return result;
        } catch (openaiError) {
            const openaiKind = openaiError instanceof ProviderError ? openaiError.kind : "unknown";
            const openaiStatus = openaiError instanceof ProviderError ? openaiError.status : undefined;
            logProviderOutcome("openai", "failure", { kind: openaiKind, status: openaiStatus });

            throw new Error("Voice help analysis is temporarily unavailable. Please try again.");
        }
    }
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

        const transcript = body.transcript.trim();
        if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
            return jsonResponse({ error: `'transcript' must be ${MAX_TRANSCRIPT_LENGTH} characters or fewer.` }, 400);
        }

        const input: AnalyzeInput = {
            transcript,
            userLanguage: typeof body.userLanguage === "string" ? body.userLanguage : "en",
            context: typeof body.context === "string" ? body.context : "Korean restaurant",
        };

        const result = await analyzeVoiceHelp(input);
        return jsonResponse(result);
    } catch (error) {
        return jsonResponse({ error: getErrorMessage(error) }, 500);
    }
});
