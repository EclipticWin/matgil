import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-seed-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
    });
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && error !== null) return JSON.stringify(error);
    return String(error);
}

interface KoTextRow {
    place_id: number;
    name: string | null;
    address: string | null;
    description: string | null;
    first_menu: string | null;
    treat_menu: string | null;
    open_time: string | null;
    rest_date: string | null;
    parking: string | null;
    packing: string | null;
    tags: string[] | null;
}

interface TranslatedText {
    name: string | null;
    address: string | null;
    description: string | null;
    first_menu: string | null;
    treat_menu: string | null;
    open_time: string | null;
    rest_date: string | null;
    parking: string | null;
    packing: string | null;
    tags: string[] | null;
}

interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

interface TranslationResult {
    translated: TranslatedText;
    provider: "openai" | "solar";
    usage: TokenUsage;
}

function extractUsage(data: any): TokenUsage {
    return {
        promptTokens: data?.usage?.prompt_tokens ?? 0,
        completionTokens: data?.usage?.completion_tokens ?? 0,
        totalTokens: data?.usage?.total_tokens ?? 0,
    };
}

function buildTranslationPrompt(row: KoTextRow): string {
    const input = {
        name: row.name,
        address: row.address,
        description: row.description,
        first_menu: row.first_menu,
        treat_menu: row.treat_menu,
        open_time: row.open_time,
        rest_date: row.rest_date,
        parking: row.parking,
        packing: row.packing,
        tags: row.tags,
    };

    return `You are a Korean-to-English translator for a restaurant recommendation app for foreign tourists visiting Seoul, Korea.

Translate the following Korean restaurant data fields to English.
Return ONLY valid JSON matching the exact structure below. No markdown, no code fences, no extra text outside the JSON.

Translation rules:
- name: Write the restaurant name in romanized English pronunciation, followed by the original Korean in parentheses.
  Examples: 남포면옥 → "Nampomyeonok (남포면옥)", 무교동 북어국집 → "Mugyodong Bugeogukjip (무교동 북어국집)", 가나돈까스의집 → "Gana Donkatsu House (가나돈까스의집)"
  Do not fully replace the brand name with an English translation — keep the original Korean in parentheses.
- address: Convert to natural English address format. Example: 서울특별시 강남구 언주로 608 → "608 Eonju-ro, Gangnam-gu, Seoul"
- description: Translate to 1-2 natural English sentences. If null or empty, generate a brief description using name and address only.
- first_menu, treat_menu: Translate food names to English. IMPORTANT: Do not invent an English dish name if you are not sure. For Korean, Chinese-Korean, or Japanese-Korean dish names that may not have a widely recognized English name, use a romanized name and keep the original Korean in parentheses. Prefer practical restaurant-menu English over literal translation. Never translate 난자완스 as "egg waffle" — it should be "Nanjawanse (난자완스)". Examples: 난자완스 → "Nanjawanse (난자완스)", 고추탕수육 → "Gochu Tangsuyuk, spicy sweet and sour pork (고추탕수육)", 육개장 → "Yukgaejang, spicy beef soup (육개장)", 회덮밥 → "Hoedeopbap, raw fish rice bowl (회덮밥)", 돈까스 → "Donkatsu (돈까스)", 생선까스 → "Fish cutlet (생선까스)". Return null if original is null.
- open_time, rest_date: Translate briefly and consistently. 연중무휴 → "Open year-round", 명절 → "Holidays", 전화문의 → "Call to confirm", 매주 일요일 → "Every Sunday". Return null if original is null.
- parking, packing: 가능 → "Available", 불가능/불가 → "Not available". Keep brief. Return null if original is null.
- tags: Translate each tag to English. Common mappings: 음식점 → "restaurant", 사진 있음 → "has photo", 위치 있음 → "has location", 메뉴 정보 있음 → "has menu info", 주차 가능 → "parking available", 포장 가능 → "takeout available". Return as array, or null if original is null.

Korean data to translate:
${JSON.stringify(input, null, 2)}

Return this exact JSON structure (use null for fields where original is null and no meaningful value can be generated):
{
  "name": "...",
  "address": "...",
  "description": "...",
  "first_menu": null,
  "treat_menu": null,
  "open_time": null,
  "rest_date": null,
  "parking": null,
  "packing": null,
  "tags": []
}`;
}

async function translateWithSolar(row: KoTextRow): Promise<TranslationResult> {
    const apiKey = Deno.env.get("SOLAR_API_KEY");
    if (!apiKey) throw new Error("SOLAR_API_KEY is not configured.");

    const res = await fetch("https://api.upstage.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "solar-pro",
            messages: [{ role: "user", content: buildTranslationPrompt(row) }],
            temperature: 0.3,
            response_format: { type: "json_object" },
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Solar error: ${res.status} ${text}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from Solar.");

    return {
        translated: JSON.parse(content) as TranslatedText,
        provider: "solar",
        usage: extractUsage(data),
    };
}

async function translateWithOpenAI(row: KoTextRow): Promise<TranslationResult> {
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
            messages: [{ role: "user", content: buildTranslationPrompt(row) }],
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

    return {
        translated: JSON.parse(content) as TranslatedText,
        provider: "openai",
        usage: extractUsage(data),
    };
}

// OpenAI first → Solar fallback.
// Throws only if both fail.
async function translateText(row: KoTextRow): Promise<TranslationResult> {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (openaiKey) {
        try {
            return await translateWithOpenAI(row);
        } catch (_openaiErr) {
            // fall through to Solar
        }
    }
    return await translateWithSolar(row);
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS });
    }

    if (req.method !== "POST") {
        return jsonResponse({ error: "POST requests only." }, 405);
    }

    try {
        // ── Auth ──────────────────────────────────────────────────────────────
        const adminToken = req.headers.get("x-admin-seed-token");
        const expectedToken = (Deno.env.get("ADMIN_SEED_TOKEN") ?? "").trim();

        if (!expectedToken) {
            return jsonResponse({ error: "ADMIN_SEED_TOKEN is not configured." }, 500);
        }

        if (!adminToken || adminToken !== expectedToken) {
            return jsonResponse({ error: "Unauthorized." }, 401);
        }

        // ── Parse body ────────────────────────────────────────────────────────
        const body = await req.json().catch(() => ({}));
        const rawLimit = Number(body.limit ?? 5);
        const safeLimit = Math.min(Math.max(rawLimit, 1), 50);
        const dryRun: boolean = body.dryRun !== false; // default true

        // ── Supabase client ───────────────────────────────────────────────────
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            { auth: { persistSession: false } }
        );

        // ── Step 1: collect place_ids that already have an en row ─────────────
        const { data: enRows, error: enQueryError } = await supabase
            .from("mg_place_texts")
            .select("place_id")
            .eq("locale", "en");

        if (enQueryError) throw enQueryError;

        const enPlaceIds: number[] = (enRows ?? []).map((r: { place_id: number }) => r.place_id);

        // ── Step 2: fetch ko rows with no en counterpart ──────────────────────
        let koQuery = supabase
            .from("mg_place_texts")
            .select("place_id, name, address, description, first_menu, treat_menu, open_time, rest_date, parking, packing, tags")
            .eq("locale", "ko")
            .limit(safeLimit);

        if (enPlaceIds.length > 0) {
            koQuery = koQuery.not("place_id", "in", `(${enPlaceIds.join(",")})`);
        }

        const { data: koRows, error: koQueryError } = await koQuery;

        if (koQueryError) throw koQueryError;

        if (!koRows || koRows.length === 0) {
            return jsonResponse({
                message: dryRun
                    ? "No untranslated records found (preview)."
                    : "No untranslated records found.",
                dryRun,
                requestedCount: safeLimit,
                translatedCount: 0,
                savedCount: 0,
                failedCount: 0,
                results: [],
            });
        }

        // ── Step 3: translate + (optionally) save ────────────────────────────
        const results: Array<{
            placeId: number;
            koName: string | null;
            enName: string | null;
            provider: "openai" | "solar" | null;
            status: "preview" | "saved" | "skipped" | "failed";
            error: string | null;
            translated?: TranslatedText;
        }> = [];

        let translatedCount = 0;
        let savedCount = 0;
        let failedCount = 0;

        const usageByProvider = {
            openai: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            solar: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };

        for (const row of koRows as KoTextRow[]) {
            try {
                const { translated, provider, usage: callUsage } = await translateText(row);
                translatedCount++;

                usageByProvider[provider].promptTokens += callUsage.promptTokens;
                usageByProvider[provider].completionTokens += callUsage.completionTokens;
                usageByProvider[provider].totalTokens += callUsage.totalTokens;

                if (dryRun) {
                    results.push({
                        placeId: row.place_id,
                        koName: row.name,
                        enName: translated.name,
                        provider,
                        status: "preview",
                        error: null,
                        translated,
                    });
                    continue;
                }

                // Safety re-check: confirm no en row was inserted since the initial query
                const { data: existingEn, error: existingCheckError } = await supabase
                    .from("mg_place_texts")
                    .select("place_id")
                    .eq("place_id", row.place_id)
                    .eq("locale", "en")
                    .maybeSingle();

                if (existingCheckError) throw existingCheckError;

                if (existingEn) {
                    results.push({
                        placeId: row.place_id,
                        koName: row.name,
                        enName: translated.name,
                        provider,
                        status: "skipped",
                        error: "en row already exists",
                    });
                    continue;
                }

                const { error: upsertError } = await supabase
                    .from("mg_place_texts")
                    .upsert(
                        {
                            place_id: row.place_id,
                            locale: "en",
                            name: translated.name,
                            address: translated.address,
                            description: translated.description,
                            first_menu: translated.first_menu,
                            treat_menu: translated.treat_menu,
                            open_time: translated.open_time,
                            rest_date: translated.rest_date,
                            parking: translated.parking,
                            packing: translated.packing,
                            tags: translated.tags,
                            translation_status: "machine",
                        },
                        { onConflict: "place_id,locale" }
                    );

                if (upsertError) throw upsertError;

                savedCount++;
                results.push({
                    placeId: row.place_id,
                    koName: row.name,
                    enName: translated.name,
                    provider,
                    status: "saved",
                    error: null,
                });
            } catch (error) {
                failedCount++;
                results.push({
                    placeId: row.place_id,
                    koName: row.name,
                    enName: null,
                    provider: null,
                    status: "failed",
                    error: getErrorMessage(error),
                });
            }
        }

        const totalPromptTokens = usageByProvider.openai.promptTokens + usageByProvider.solar.promptTokens;
        const totalCompletionTokens = usageByProvider.openai.completionTokens + usageByProvider.solar.completionTokens;

        return jsonResponse({
            message: dryRun
                ? "English machine translation preview complete"
                : "English machine translation enrichment complete",
            dryRun,
            requestedCount: koRows.length,
            translatedCount,
            savedCount,
            failedCount,
            usage: {
                totalPromptTokens,
                totalCompletionTokens,
                totalTokens: totalPromptTokens + totalCompletionTokens,
                byProvider: usageByProvider,
            },
            results,
        });
    } catch (error) {
        return jsonResponse({ error: getErrorMessage(error) }, 500);
    }
});
