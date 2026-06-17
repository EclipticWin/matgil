import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-seed-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOUR_API_BASE_URL = "https://apis.data.go.kr/B551011/KorService2";

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...CORS,
            "Content-Type": "application/json",
        },
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

    if (typeof error === "object" && error !== null) {
        return JSON.stringify(error);
    }

    return String(error);
}

function parseTourDateTime(value: unknown) {
    if (!value) return null;

    const text = String(value).trim();

    // TourAPI modifiedtime 예: 20250618095454
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

function makeDescriptionKo(listItem: any, introItem: any) {
    const name = listItem.title;
    const address = [listItem.addr1, listItem.addr2].filter(Boolean).join(" ");
    const firstMenu = introItem?.firstmenu;

    if (hasValue(firstMenu)) {
        return `${name}은(는) ${address}에 위치한 음식점입니다. 대표 메뉴는 ${firstMenu}입니다.`;
    }

    return `${name}은(는) ${address}에 위치한 음식점입니다.`;
}

function makeTagsKo(listItem: any, introItem: any) {
    const tags = ["음식점"];

    if (hasValue(listItem.firstimage)) tags.push("사진 있음");
    if (hasValue(listItem.mapx) && hasValue(listItem.mapy)) tags.push("위치 있음");
    if (hasValue(introItem?.firstmenu) || hasValue(introItem?.treatmenu)) tags.push("메뉴 정보 있음");
    if (introItem?.parkingfood === "가능") tags.push("주차 가능");
    if (introItem?.packing === "가능") tags.push("포장 가능");

    return tags;
}

async function fetchTourApi(endpoint: string, params: Record<string, string | number>) {
    const serviceKey = (Deno.env.get("TOUR_KOR_API_SERVICE_KEY") ?? "").trim();

    if (!serviceKey) {
        throw new Error("TOUR_KOR_API_SERVICE_KEY가 설정되지 않았습니다.");
    }

    const url = new URL(`${TOUR_API_BASE_URL}/${endpoint}`);

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
        throw new Error(`TourAPI HTTP 오류: ${res.status} ${text}`);
    }

    const data = await res.json();
    const header = data?.response?.header;

    if (header?.resultCode !== "0000") {
        throw new Error(`TourAPI 응답 오류: ${header?.resultCode} ${header?.resultMsg}`);
    }

    return data;
}

async function fetchRestaurantList(numOfRows: number, pageNo: number) {
    const data = await fetchTourApi("areaBasedList2", {
        numOfRows,
        pageNo,
        contentTypeId: 39,
        lDongRegnCd: 11,
    });

    return getItems(data);
}

async function fetchRestaurantIntro(contentId: string, contentTypeId: string) {
    const data = await fetchTourApi("detailIntro2", {
        contentId,
        contentTypeId,
        numOfRows: 1,
        pageNo: 1,
    });

    const items = getItems(data);

    return {
        raw: data,
        item: items[0] ?? null,
    };
}

async function placeAlreadyExists(supabase: any, contentId: string, contentTypeId: string) {
    const { data, error } = await supabase
        .from("mg_place_sources")
        .select("id, place_id")
        .eq("source", "TOUR_API_KO")
        .eq("source_language", "ko")
        .eq("external_id", contentId)
        .eq("external_content_type_id", contentTypeId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}

async function insertPlace(supabase: any, listItem: any, introRaw: any, introItem: any) {
    const existing = await placeAlreadyExists(
        supabase,
        listItem.contentid,
        listItem.contenttypeid
    );

    if (existing) {
        return {
            status: "skipped",
            placeId: existing.place_id,
            title: listItem.title,
            reason: "이미 저장된 TourAPI 장소입니다.",
        };
    }

    const latitude = hasValue(listItem.mapy) ? Number(listItem.mapy) : null;
    const longitude = hasValue(listItem.mapx) ? Number(listItem.mapx) : null;

    let createdPlaceId: number | null = null;

    try {
        const { data: place, error: placeError } = await supabase
            .from("mg_places")
            .insert({
                primary_source: "TOUR_API_KO",
                place_type: "restaurant",
                content_type_id: listItem.contenttypeid ?? null,

                latitude,
                longitude,

                area_code: listItem.areacode || null,
                sigungu_code: listItem.sigungucode || null,
                ldong_regn_cd: listItem.lDongRegnCd || null,
                ldong_signgu_cd: listItem.lDongSignguCd || null,

                category_code_1: listItem.cat1 || null,
                category_code_2: listItem.cat2 || null,
                category_code_3: listItem.cat3 || null,

                food_category_code_1: listItem.lclsSystm1 || null,
                food_category_code_2: listItem.lclsSystm2 || null,
                food_category_code_3: listItem.lclsSystm3 || null,

                default_image_url: listItem.firstimage || null,
                is_active: true,
                data_quality_score: 0,
            })
            .select()
            .single();

        if (placeError) throw placeError;

        const placeId = place.id;
        createdPlaceId = placeId;

        const { error: sourceError } = await supabase
            .from("mg_place_sources")
            .insert({
                place_id: placeId,
                source: "TOUR_API_KO",
                source_language: "ko",
                external_id: listItem.contentid,
                external_content_type_id: listItem.contenttypeid,
                license_type: "공공데이터",
                attribution: "한국관광공사 TourAPI",
                cache_policy: "stored",
                source_modified_at: parseTourDateTime(listItem.modifiedtime),
                raw_list: listItem,
                raw_intro: introRaw,
            });

        if (sourceError) throw sourceError;

        const { error: textError } = await supabase
            .from("mg_place_texts")
            .insert({
                place_id: placeId,
                locale: "ko",

                name: listItem.title,
                address: [listItem.addr1, listItem.addr2].filter(Boolean).join(" "),
                description: makeDescriptionKo(listItem, introItem),

                first_menu: introItem?.firstmenu || null,
                treat_menu: introItem?.treatmenu || null,
                open_time: cleanText(introItem?.opentimefood),
                rest_date: introItem?.restdatefood || null,
                parking: introItem?.parkingfood || null,
                packing: introItem?.packing || null,

                tags: makeTagsKo(listItem, introItem),
                translation_status: "source",
            });

        if (textError) throw textError;

        const { error: detailError } = await supabase
            .from("mg_place_food_details")
            .insert({
                place_id: placeId,

                tel: introItem?.infocenterfood || listItem.tel || null,

                has_parking: introItem?.parkingfood === "가능" ? true : null,
                has_packing: introItem?.packing === "가능" ? true : null,
                has_open_time: hasValue(introItem?.opentimefood),
                has_menu_info: hasValue(introItem?.firstmenu) || hasValue(introItem?.treatmenu),
                has_image: hasValue(listItem.firstimage),
                has_location: hasValue(listItem.mapx) && hasValue(listItem.mapy),

                kids_facility:
                    introItem?.kidsfacility === "1"
                        ? true
                        : introItem?.kidsfacility === "0"
                            ? false
                            : null,

                smoking_info: introItem?.smoking || null,
                credit_card_info: introItem?.chkcreditcardfood || null,
                reservation_info: introItem?.reservationfood || null,
                license_no: introItem?.lcnsno || null,

                price_level: null,
                is_halal_friendly: null,
                is_vegetarian_friendly: null,
                has_english_menu: null,
            });

        if (detailError) throw detailError;

        if (hasValue(listItem.firstimage)) {
            const { error: imageError } = await supabase
                .from("mg_place_images")
                .insert({
                    place_id: placeId,
                    image_url: listItem.firstimage,
                    thumbnail_url: listItem.firstimage2 || null,
                    source: "TOUR_API_KO",
                    license_type: "공공데이터",
                    attribution: "한국관광공사 TourAPI",
                    sort_order: 0,
                });

            if (imageError) throw imageError;
        }

        return {
            status: "inserted",
            placeId,
            title: listItem.title,
        };
    } catch (error) {
        // 중간에 실패하면 mg_places 찌꺼기 방지
        if (createdPlaceId) {
            await supabase
                .from("mg_places")
                .delete()
                .eq("id", createdPlaceId);
        }

        throw error;
    }
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

                const result = await insertPlace(supabase, item, introRaw, introItem);
                results.push(result);
            } catch (error) {
                results.push({
                    status: "failed",
                    title: item.title,
                    contentId: item.contentid,
                    error: getErrorMessage(error),
                });
            }
        }

        const insertedCount = results.filter((item) => item.status === "inserted").length;
        const skippedCount = results.filter((item) => item.status === "skipped").length;
        const failedCount = results.filter((item) => item.status === "failed").length;

        await supabase.from("mg_api_fetch_logs").insert({
            source: "TOUR_API_KO",
            endpoint: "areaBasedList2 + detailIntro2",
            request_params: {
                numOfRows: safeNumOfRows,
                pageNo: safePageNo,
                contentTypeId: 39,
                lDongRegnCd: 11,
            },
            response_status: 200,
            result_code: "0000",
            result_message: "OK",
            success: failedCount === 0,
            fetched_count: insertedCount,
            error_message: failedCount > 0 ? `${failedCount}개 저장 실패` : null,
        });

        return jsonResponse({
            message: "TourAPI 음식점 데이터 수집 완료",
            requestedCount: items.length,
            insertedCount,
            skippedCount,
            failedCount,
            results,
        });
    } catch (error) {
        return jsonResponse(
            {
                error: getErrorMessage(error),
            },
            500
        );
    }
});