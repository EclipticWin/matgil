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

// Speech-recognition language codes the frontend's language picker can send
// (see VoiceHelpPlaceholder.jsx's SPEECH_LANGUAGE_OPTIONS) — deliberately a
// closed set, not free-form BCP-47, so an unrecognized/spoofed value always
// falls back to something safe instead of ever reaching the LLM prompt as-is.
const ALLOWED_SOURCE_LANGUAGES = ["ko-KR", "en-US", "zh-CN"] as const;
type SourceLanguage = typeof ALLOWED_SOURCE_LANGUAGES[number];

const SOURCE_LANGUAGE_NAMES: Record<SourceLanguage, string> = {
    "ko-KR": "Korean",
    "en-US": "English",
    "zh-CN": "Simplified Chinese",
};

// Only used when the request's sourceLanguage is missing/invalid — mirrors
// VoiceHelpPlaceholder.jsx's per-locale default speech language, so a
// malformed request still gets the same default the UI itself would have used.
const USER_LANGUAGE_TO_SOURCE: Record<string, SourceLanguage> = {
    ko: "ko-KR",
    en: "en-US",
    "zh-CN": "zh-CN",
};

function normalizeSourceLanguage(raw: unknown, userLanguage: string): SourceLanguage {
    if (typeof raw === "string" && (ALLOWED_SOURCE_LANGUAGES as readonly string[]).includes(raw)) {
        return raw as SourceLanguage;
    }
    return USER_LANGUAGE_TO_SOURCE[userLanguage] ?? "ko-KR";
}

/** The short app-locale code (ko/en/zh-CN — see src/shared/i18n/localeFallback.js's
 *  SUPPORTED_LOCALES) that "meaning" and "suggestedReply" must be written in:
 *  - source is Korean → the user's own app language (translating FOR them)
 *  - source is the user's own app language → Korean (translating FOR the Korean worker)
 *  This is the one piece of "which language goes where" logic the LLM is not
 *  trusted to decide — it's computed here and only ever handed to the prompt
 *  as a concrete instruction. */
function resolveTargetLanguageCode(sourceLanguage: SourceLanguage, userLanguage: string): string {
    return sourceLanguage === "ko-KR" ? userLanguage : "ko";
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
    // Already normalized to one of ALLOWED_SOURCE_LANGUAGES by the time this
    // is built (see the request handler) — nothing downstream needs to
    // re-validate it.
    sourceLanguage: SourceLanguage;
    context: string;
}

// General, direction-agnostic response shape — replaces the old
// suggestedReplyKo/suggestedReplyRomanization fields, which assumed the
// suggested reply was always Korean and so couldn't represent "reply in
// Chinese/English to a Korean worker" at all.
interface AnalyzeResult {
    originalPhrase: string;
    sourceLanguage: string;
    meaning: string;
    meaningLanguage: string;
    suggestedReply: string;
    suggestedReplyLanguage: string;
    suggestedReplyPronunciation: string;
    suggestedReplyMeaning: string;
    note: string;
}

// What's actually trusted from the LLM — just the four text fields. Every
// language-label field on AnalyzeResult (originalPhrase, sourceLanguage,
// meaningLanguage, suggestedReplyLanguage) is computed server-side instead
// (see analyzeVoiceHelp) so the model can't translate/rewrite the original
// phrase or mislabel which language something is in.
interface AnalyzeContent {
    meaning: string;
    suggestedReply: string;
    suggestedReplyPronunciation: string;
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

/** Same prompt rules for Solar and OpenAI (both call this). `sourceLanguage`/
 *  `targetLanguageCode` are already resolved (see analyzeVoiceHelp) — the
 *  model is never asked to detect or choose either one, only to write the
 *  actual text content in the languages it's told to use. originalPhrase and
 *  the language-label fields are deliberately NOT part of the JSON schema
 *  requested here — the model has no way to "rewrite" a field it's never
 *  asked to produce (see analyzeVoiceHelp for how the full result is assembled). */
function buildPrompt(input: AnalyzeInput, sourceLanguage: SourceLanguage, targetLanguageCode: string): string {
    const sourceLanguageName = SOURCE_LANGUAGE_NAMES[sourceLanguage];
    const userLanguageName = resolveLanguageName(input.userLanguage);
    const targetLanguageName = resolveLanguageName(targetLanguageCode);
    const replyIsKorean = targetLanguageCode === "ko";

    return `You are a helpful assistant for foreign tourists visiting Korean restaurants.

The user heard or wants to say the following text in a Korean restaurant.
Analyze the input and return a JSON object.

Input: "${input.transcript}"
The selected source language is ${sourceLanguageName}.
The conversation is between a Korean restaurant worker and a user whose selected app language is ${userLanguageName}.
Context: ${input.context}

Rules:
- Do not transliterate Chinese into Hangul.
- Do not transliterate English into Hangul.
- Do not transliterate Korean into Latin letters as the original phrase.
- Do not rewrite originalPhrase.
- If the source language is Korean, translate meaning into the user's app language and write the suggested reply in the user's app language.
- If the source language is the user's app language, translate meaning into Korean and write the suggested reply in Korean.
- Write the "meaning" field entirely in ${targetLanguageName}.
- Write the "suggestedReply" field entirely in ${targetLanguageName}.
- suggestedReplyMeaning must be written in the original speaker's language (${sourceLanguageName}).
- suggestedReplyPronunciation is only required for a Korean suggested reply. Otherwise return an empty string.${replyIsKorean ? " Provide romanization of the Korean suggested reply." : ""}
- Keep all text concise. No long explanations.
- If the input is unrelated to a restaurant situation, set meaning to a polite message (in ${targetLanguageName}) explaining that this isn't a restaurant phrase, and still set suggestedReply to a short natural message (in ${targetLanguageName}) asking the user to say something they'd use in a Korean restaurant instead.
- suggestedReply must NEVER be an empty string or contain only whitespace, in every case — including when the input is unrelated to a restaurant situation. The same applies to meaning and suggestedReplyMeaning.
- Return only valid JSON. No markdown, no code fences, no extra text outside the JSON.

Return this exact JSON structure:
{
  "meaning": "<meaning or translation, written in ${targetLanguageName}>",
  "suggestedReply": "<short natural reply, written in ${targetLanguageName}>",
  "suggestedReplyPronunciation": "<romanization if the suggested reply is Korean, otherwise an empty string>",
  "suggestedReplyMeaning": "<gloss of suggestedReply, written in ${sourceLanguageName}>",
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

const REQUIRED_STRING_FIELDS = ["meaning", "suggestedReply", "suggestedReplyMeaning"] as const;

/** Shared normalizer: parses + validates a provider's raw text into its content-only shape.
 *
 *  meaning/suggestedReply/suggestedReplyMeaning must be non-empty after
 *  trimming — not just present and string-typed. The prompt (buildPrompt)
 *  now always asks for a non-empty suggestedReply, even for restaurant-
 *  irrelevant input (a short "please say a restaurant phrase" redirect
 *  instead of an empty string), so a blank/whitespace-only value here means
 *  the provider didn't follow that instruction — treated as invalid_shape,
 *  same as a missing field, which is what makes it eligible for the
 *  Solar → OpenAI fallback in analyzeVoiceHelp instead of silently reaching
 *  the UI as a "successful" result with a blank suggested-reply area.
 *
 *  suggestedReplyPronunciation/note stay optional (default "") — a reply in
 *  a non-Korean language legitimately has no pronunciation to give, and
 *  requiring pronunciation only when the reply happens to be Korean would
 *  add a second, harder-to-satisfy condition that risks tripping an
 *  otherwise-good response into an unnecessary fallback. */
function normalizeAnalyzeContent(provider: Provider, raw: string): AnalyzeContent {
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
        const value = record[field];
        if (typeof value !== "string" || !value.trim()) {
            throw new ProviderError(provider, "invalid_shape", `${provider} response has an empty/invalid field: ${field}`);
        }
    }

    return {
        meaning: (record.meaning as string).trim(),
        suggestedReply: (record.suggestedReply as string).trim(),
        suggestedReplyPronunciation: typeof record.suggestedReplyPronunciation === "string" ? record.suggestedReplyPronunciation : "",
        suggestedReplyMeaning: (record.suggestedReplyMeaning as string).trim(),
        note: typeof record.note === "string" ? record.note : "",
    };
}

async function analyzeWithSolar(
    input: AnalyzeInput,
    sourceLanguage: SourceLanguage,
    targetLanguageCode: string,
): Promise<AnalyzeContent> {
    const apiKey = Deno.env.get("SOLAR_API_KEY");
    if (!apiKey) {
        throw new ProviderError("solar", "config", "SOLAR_API_KEY is not configured.");
    }

    const content = await callChatCompletions(
        "solar",
        "https://api.upstage.ai/v1/chat/completions",
        apiKey,
        "solar-pro",
        buildPrompt(input, sourceLanguage, targetLanguageCode),
    );

    return normalizeAnalyzeContent("solar", content);
}

async function analyzeWithOpenAI(
    input: AnalyzeInput,
    sourceLanguage: SourceLanguage,
    targetLanguageCode: string,
): Promise<AnalyzeContent> {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
        throw new ProviderError("openai", "config", "OPENAI_API_KEY is not configured.");
    }

    const content = await callChatCompletions(
        "openai",
        "https://api.openai.com/v1/chat/completions",
        apiKey,
        "gpt-4o-mini",
        buildPrompt(input, sourceLanguage, targetLanguageCode),
    );

    return normalizeAnalyzeContent("openai", content);
}

// Solar 1st (max 1 call) → OpenAI fallback only on Solar failure (max 1 call). Total ≤ 2 LLM calls.
// Solar success (parsed + validated) short-circuits — OpenAI is never called in that case.
async function analyzeVoiceHelp(input: AnalyzeInput): Promise<AnalyzeResult> {
    const sourceLanguage = input.sourceLanguage;
    const targetLanguageCode = resolveTargetLanguageCode(sourceLanguage, input.userLanguage);

    let contentResult: AnalyzeContent;
    try {
        contentResult = await analyzeWithSolar(input, sourceLanguage, targetLanguageCode);
        logProviderOutcome("solar", "success");
    } catch (solarError) {
        const kind = solarError instanceof ProviderError ? solarError.kind : "unknown";
        const status = solarError instanceof ProviderError ? solarError.status : undefined;
        logProviderOutcome("solar", "failure", { kind, status });

        try {
            contentResult = await analyzeWithOpenAI(input, sourceLanguage, targetLanguageCode);
            logProviderOutcome("openai", "success");
        } catch (openaiError) {
            const openaiKind = openaiError instanceof ProviderError ? openaiError.kind : "unknown";
            const openaiStatus = openaiError instanceof ProviderError ? openaiError.status : undefined;
            logProviderOutcome("openai", "failure", { kind: openaiKind, status: openaiStatus });

            throw new Error("Voice help analysis is temporarily unavailable. Please try again.");
        }
    }

    // originalPhrase/sourceLanguage/meaningLanguage/suggestedReplyLanguage are
    // always these server-computed values, never anything the LLM returned —
    // the model isn't even asked to produce them (see buildPrompt). This is
    // what stops Chinese/English input from being transliterated into Hangul
    // (or Korean input from being romanized) as the "original phrase".
    return {
        originalPhrase: input.transcript,
        sourceLanguage,
        meaning: contentResult.meaning,
        meaningLanguage: targetLanguageCode,
        suggestedReply: contentResult.suggestedReply,
        suggestedReplyLanguage: targetLanguageCode,
        suggestedReplyPronunciation: contentResult.suggestedReplyPronunciation,
        suggestedReplyMeaning: contentResult.suggestedReplyMeaning,
        note: contentResult.note,
    };
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

        const userLanguage = typeof body.userLanguage === "string" ? body.userLanguage : "en";
        const input: AnalyzeInput = {
            transcript,
            userLanguage,
            sourceLanguage: normalizeSourceLanguage(body.sourceLanguage, userLanguage),
            context: typeof body.context === "string" ? body.context : "Korean restaurant",
        };

        const result = await analyzeVoiceHelp(input);
        return jsonResponse(result);
    } catch (error) {
        return jsonResponse({ error: getErrorMessage(error) }, 500);
    }
});
