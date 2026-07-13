import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// The account being deleted always gets this exact, locale-neutral literal — the
// frontend maps it to a translated label (see placeDetail.deletedUserAuthor in
// dictionary.js) rather than storing per-language text server-side.
const DELETED_USER_LABEL = "Deleted user";
const COMMUNITY_IMAGE_BUCKET = "community-post-images";

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

/** Extracts the bucket-relative Storage path from a stored community post image
 *  value. The normal case (see uploadPostImages in communityService.js) is a full
 *  encoded public URL; older rows may hold a bare path, still possibly carrying the
 *  bucket-name prefix. Returns null for anything that isn't a real Storage object
 *  (e.g. a stray blob: URL that should never have been persisted, or an
 *  unrecognized URL shape we shouldn't guess about). */
function extractCommunityImagePath(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith("blob:")) return null;

    const marker = `${COMMUNITY_IMAGE_BUCKET}/`;
    const markerIndex = trimmed.indexOf(marker);
    if (markerIndex === -1) {
        if (trimmed.startsWith("http")) return null;
        return trimmed;
    }

    const path = trimmed.slice(markerIndex + marker.length);
    try {
        return decodeURIComponent(path);
    } catch {
        return path;
    }
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS });
    }

    if (req.method !== "POST") {
        return jsonResponse({ error: "POST requests only." }, 405);
    }

    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    const jwt = authHeader?.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7).trim()
        : null;

    if (!jwt) {
        return jsonResponse({ error: "Authentication required." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
        console.error("delete-my-account: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret");
        return jsonResponse({ error: "Account deletion is not available right now." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    // Validate the caller's JWT server-side and resolve the current user id from it.
    // The request body's user_id (if any) is never trusted or even read.
    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData?.user) {
        return jsonResponse({ error: "Authentication required." }, 401);
    }
    const userId = userData.user.id;

    try {
        // 1) Anonymize this caller's own reviews — set user_id to null AND author_name
        //    to the neutral label in the SAME statement. This matters: mg_place_reviews
        //    has a before-write trigger that unconditionally recomputes author_name from
        //    auth.users.raw_user_meta_data.display_name whenever new.user_id is not
        //    null. Updating author_name on its own, before the account is deleted, would
        //    silently be overwritten back to the user's real (still-live) nickname by
        //    that trigger. Nulling user_id here too makes new.user_id null within this
        //    same statement, so the trigger skips that recompute and this author_name
        //    value sticks. (This also means auth.admin.deleteUser's own on-delete-set-null
        //    cascade below has nothing left to do for these rows — already satisfied.)
        //    Always scoped to the validated user id above — never touches another
        //    user's rows. Safe to re-run: a review with user_id already null won't
        //    match `eq('user_id', userId)` again, so a retry is just a no-op here.
        const { error: reviewError } = await admin
            .from("mg_place_reviews")
            .update({ user_id: null, author_name: DELETED_USER_LABEL })
            .eq("user_id", userId);
        if (reviewError) {
            console.error("delete-my-account: review anonymization failed:", reviewError.message);
            throw new Error("review_anonymize_failed");
        }

        // 2) Best-effort cleanup of this caller's community post images in Storage,
        //    done before the post rows themselves are cascade-deleted by the auth
        //    user deletion below (their image paths need to be read first).
        const { data: posts, error: postsError } = await admin
            .from("mg_community_posts")
            .select("image_url, image_urls")
            .eq("user_id", userId);
        if (postsError) {
            console.error("delete-my-account: fetching post images failed:", postsError.message);
            throw new Error("post_image_lookup_failed");
        }

        const imagePaths = new Set<string>();
        for (const post of posts ?? []) {
            const single = extractCommunityImagePath((post as { image_url?: unknown }).image_url);
            if (single) imagePaths.add(single);

            const many = (post as { image_urls?: unknown }).image_urls;
            if (Array.isArray(many)) {
                for (const url of many) {
                    const path = extractCommunityImagePath(url);
                    if (path) imagePaths.add(path);
                }
            }
        }

        if (imagePaths.size > 0) {
            const { error: removeError } = await admin.storage
                .from(COMMUNITY_IMAGE_BUCKET)
                .remove([...imagePaths]);
            // Best-effort: an already-missing file (e.g. a retried call) is not a
            // reason to abort account deletion, so this is logged, not thrown.
            if (removeError) {
                console.error("delete-my-account: storage cleanup had errors:", removeError.message);
            }
        }

        // 3) Explicit delete for the one personal table whose ON DELETE behavior on
        //    user_id isn't confirmed to cascade (see docs/38 audit notes). Everything
        //    else — mg_place_bookmarks, mg_phrase_bookmarks, mg_user_profiles,
        //    mg_community_posts/comments and their like tables — has a confirmed
        //    `on delete cascade` on user_id, so it's intentionally left to step 4
        //    instead of being duplicated here.
        const { error: coursesError } = await admin
            .from("mg_saved_courses")
            .delete()
            .eq("user_id", userId);
        if (coursesError) {
            console.error("delete-my-account: saved courses cleanup failed:", coursesError.message);
            throw new Error("saved_courses_delete_failed");
        }

        // 4) Delete the Auth account last, once every step above has succeeded.
        //    mg_place_reviews rows already survive with user_id cleared and
        //    author_name anonymized from step 1 above; every other personal table's
        //    `on delete cascade` on user_id (mg_place_bookmarks, mg_phrase_bookmarks,
        //    mg_user_profiles, community posts/comments and their like tables) is
        //    removed by this call.
        const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
        if (deleteUserError) {
            console.error("delete-my-account: auth.admin.deleteUser failed:", deleteUserError.message);
            throw new Error("auth_delete_failed");
        }

        return jsonResponse({ success: true });
    } catch (error) {
        // Internal step name only in the log; the client always gets one generic
        // message regardless of which step failed (no stack traces, no user details).
        console.error("delete-my-account: account deletion failed:", getErrorMessage(error));
        return jsonResponse({ error: "We couldn't delete your account. Please try again." }, 500);
    }
});
