import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-seed-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOUR_ENG_API_BASE_URL = "https://apis.data.go.kr/B551011/EngService2";
const MATCH_RADIUS_KM = 0.15;

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, "Content-Type": "application/json" },
    });
}

function cleanText(text: unknown) {
    if (!text) return null;
    return String(text)
        .replaceAll("<br>", "\n")
        .replaceAll("<br/>", "\n")
        .replaceAll("<br />", "\n")
        .trim();
}

function hasValue(value: unknown) {
    return value !== undefined && value !== null && String(value).trim() !== "";
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && error !== null) return JSON.stringify(error);
    return String(error);
}

function parseTourDateTime(value: unknown) {
    if (!value) return null;
    const text = String(value).trim();
    if (text.length !== 14) return null;
    const year = text.slice(0, 4);
    const month = text.slice(4, 6);
    const day = text.slice(6, 8);
    const hour = text.slice(8, 10);
    const minute = text.slice(10, 12);
    const second = text.slice(12, 14);
    return `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`;
}

function getItems(data: any) {
    const item = data?.response?.body?.items?.item;
    if (!item) return [];
    if (Array.isArray(item)) return item;
    return [item];
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function makeDescriptionEn(listItem: any, introItem: any) {
    const name = listItem.title;
    const address = [listItem.addr1, listItem.addr2].filter(Boolean).join(" ");
    const firstMenu = introItem?.firstmenu;
    if (hasValue(firstMenu)) {
        return `${name} is a restaurant located at ${address}. A signature menu item is ${firstMenu}.`;
    }
    return `${name} is a restaurant located at ${address}.`;
}

function makeTagsEn(listItem: any, introItem: any) {
    const tags = ["restaurant"];
    if (hasValue(listItem.firstimage)) tags.push("has photo");
    if (hasValue(listItem.mapx) && hasValue(listItem.mapy)) tags.push("has location");
    if (hasValue(introItem?.firstmenu) || hasValue(introItem?.treatmenu)) tags.push("has menu info");
    return tags;
}

async function fetchEngApi(endpoint: string, params: Record<string, string | number>) {
    const serviceKey = (Deno.env.get("TOUR_ENG_API_SERVICE_KEY") ?? "").trim();

    if (!serviceKey) {
        throw new Error("TOUR_ENG_API_SERVICE_KEY가 설정되지 않았습니다.");
    }

    const url = new URL(`${TOUR_ENG_API_BASE_URL}/${endpoint}`);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("MobileOS", "ETC");
    url.searchParams.set("MobileApp", "matgil");
    url.searchParams.set("_type", "json");

    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
    });

    const res = await fetch(url);

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`EngService2 HTTP 오류: ${res.status} ${text}`);
    }

    const data = await res.json();
    const header = data?.response?.header;

    if (header?.resultCode !== "0000") {
        throw new Error(`EngService2 응답 오류: ${header?.resultCode} ${header?.resultMsg}`);
    }

    return data;
}

async function fetchRestaurantList(numOfRows: number, pageNo: number) {
    const data = await fetchEngApi("areaBasedList2", {
        numOfRows,
        pageNo,
        contentTypeId: 82,
        lDongRegnCd: 11,
    });
    return getItems(data);
}

async function fetchRestaurantIntro(contentId: string, contentTypeId: string) {
    const data = await fetchEngApi("detailIntro2", {
        contentId,
        contentTypeId,
        numOfRows: 1,
        pageNo: 1,
    });
    const items = getItems(data);
    return { raw: data, item: items[0] ?? null };
}

async function findMatchingPlace(supabase: any, lat: number, lon: number) {
    // Bounding box narrowing before exact Haversine distance check
    const latDelta = MATCH_RADIUS_KM / 111.0;
    const lonDelta = MATCH_RADIUS_KM / (111.0 * Math.cos(lat * Math.PI / 180));

    const { data, error } = await supabase
        .from("mg_places")
        .select("id, latitude, longitude")
        .gte("latitude", lat - latDelta)
        .lte("latitude", lat + latDelta)
        .gte("longitude", lon - lonDelta)
        .lte("longitude", lon + lonDelta)
        .eq("is_active", true);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    let best: { id: number; distanceKm: number } | null = null;

    for (const place of data) {
        if (!place.latitude || !place.longitude) continue;
        const dist = haversineKm(lat, lon, place.latitude, place.longitude);
        if (dist <= MATCH_RADIUS_KM && (!best || dist < best.distanceKm)) {
            best = { id: place.id, distanceKm: dist };
        }
    }

    return best;
}

async function enrichPlace(supabase: any, listItem: any, introRaw: any, introItem: any) {
    const lat = hasValue(listItem.mapy) ? Number(listItem.mapy) : null;
    const lon = hasValue(listItem.mapx) ? Number(listItem.mapx) : null;

    if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) {
        return {
            status: "skipped",
            title: listItem.title,
            contentId: listItem.contentid,
            matchedPlaceId: null,
            distanceKm: null,
            reason: "좌표 없음",
        };
    }

    const match = await findMatchingPlace(supabase, lat, lon);

    if (!match) {
        return {
            status: "skipped",
            title: listItem.title,
            contentId: listItem.contentid,
            matchedPlaceId: null,
            distanceKm: null,
            reason: "150m 이내 매칭 장소 없음",
        };
    }

    const address = [listItem.addr1, listItem.addr2].filter(Boolean).join(" ");

    const { error: textError } = await supabase
        .from("mg_place_texts")
        .upsert(
            {
                place_id: match.id,
                locale: "en",
                name: listItem.title,
                address,
                description: makeDescriptionEn(listItem, introItem),
                first_menu: introItem?.firstmenu || null,
                treat_menu: introItem?.treatmenu || null,
                open_time: cleanText(introItem?.opentimefood),
                rest_date: introItem?.restdatefood || null,
                parking: introItem?.parkingfood || null,
                packing: introItem?.packing || null,
                tags: makeTagsEn(listItem, introItem),
                translation_status: "source",
            },
            { onConflict: "place_id,locale" }
        );

    if (textError) throw textError;

    const { error: sourceError } = await supabase
        .from("mg_place_sources")
        .upsert(
            {
                place_id: match.id,
                source: "TOUR_API_EN",
                source_language: "en",
                external_id: listItem.contentid,
                external_content_type_id: listItem.contenttypeid,
                license_type: "공공데이터",
                attribution: "한국관광공사 TourAPI",
                cache_policy: "stored",
                source_modified_at: parseTourDateTime(listItem.modifiedtime),
                raw_list: listItem,
                raw_intro: introRaw,
            },
            { onConflict: "source,source_language,external_id,external_content_type_id" }
        );

    if (sourceError) throw sourceError;

    return {
        status: "matched",
        title: listItem.title,
        contentId: listItem.contentid,
        matchedPlaceId: match.id,
        distanceKm: Math.round(match.distanceKm * 1000) / 1000,
        reason: null,
    };
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS });
    }

    if (req.method !== "POST") {
        return jsonResponse({ error: "POST 요청만 허용됩니다." }, 405);
    }

    try {
        const adminToken = req.headers.get("x-admin-seed-token");
        const expectedToken = (Deno.env.get("ADMIN_SEED_TOKEN") ?? "").trim();

        if (!expectedToken) {
            return jsonResponse({ error: "ADMIN_SEED_TOKEN이 설정되지 않았습니다." }, 500);
        }

        if (!adminToken || adminToken !== expectedToken) {
            return jsonResponse({ error: "권한이 없습니다." }, 401);
        }

        const body = await req.json().catch(() => ({}));
        const numOfRows = Number(body.numOfRows ?? 10);
        const pageNo = Number(body.pageNo ?? 1);
        const safeNumOfRows = Math.min(Math.max(numOfRows, 1), 30);
        const safePageNo = Math.max(pageNo, 1);

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            { auth: { persistSession: false } }
        );

        const items = await fetchRestaurantList(safeNumOfRows, safePageNo);

        const results = [];

        for (const item of items) {
            try {
                const { raw: introRaw, item: introItem } = await fetchRestaurantIntro(
                    item.contentid,
                    item.contenttypeid
                );
                const result = await enrichPlace(supabase, item, introRaw, introItem);
                results.push(result);
            } catch (error) {
                results.push({
                    status: "failed",
                    title: item.title,
                    contentId: item.contentid,
                    matchedPlaceId: null,
                    distanceKm: null,
                    reason: getErrorMessage(error),
                });
            }
        }

        const matchedCount = results.filter((r) => r.status === "matched").length;
        const skippedCount = results.filter((r) => r.status === "skipped").length;
        const failedCount = results.filter((r) => r.status === "failed").length;

        await supabase.from("mg_api_fetch_logs").insert({
            source: "TOUR_API_EN",
            endpoint: "areaBasedList2 + detailIntro2",
            request_params: {
                numOfRows: safeNumOfRows,
                pageNo: safePageNo,
                contentTypeId: 82,
                lDongRegnCd: 11,
            },
            response_status: 200,
            result_code: "0000",
            result_message: "OK",
            success: failedCount === 0,
            fetched_count: matchedCount,
            error_message: failedCount > 0 ? `${failedCount}개 처리 실패` : null,
        });

        return jsonResponse({
            message: "TourAPI 영문 음식점 데이터 보강 완료",
            requestedCount: items.length,
            matchedCount,
            upsertedTextCount: matchedCount,
            upsertedSourceCount: matchedCount,
            skippedCount,
            failedCount,
            results,
        });
    } catch (error) {
        return jsonResponse({ error: getErrorMessage(error) }, 500);
    }
});
