// src/services/storeMessages.ts
import { supabase } from "@/integrations/supabase/client";

/** TEMP escape hatch until Supabase types are regenerated */
const sb = supabase as any;

function friendlyError(e: unknown) {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return "Unknown error";
  }
}

/**
 * What the Store UI needs per message
 * - read_at: set when store OPENS the message
 * - acknowledged_at: set when store clicks Acknowledge (only if requires_ack)
 */
export type InboxMessage = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  is_announcement: boolean;
  requires_ack: boolean;

  sender_user_id: string | null;
  sender_name?: string | null;

  // per-store state (from message_reads)
  read_at: string | null;
  acknowledged_at: string | null;
};

export type InboxResult =
  | { ok: true; messages: InboxMessage[] }
  | { ok: false; error: string; messages: InboxMessage[] };

type ReadRow = {
  message_id: string;
  store_id: string;
  read_at: string | null;
  acknowledged_at: string | null;
};

export async function getInboxForStore(storeId: string): Promise<InboxResult> {
  try {
    // -----------------------------
    // Query 1: targets for this store (NO EMBEDS)
    // -----------------------------
    const { data: targetRows, error: targetErr } = await sb
      .from("message_targets")
      .select("message_id")
      .eq("store_id", storeId);

    if (targetErr) throw targetErr;

    const messageIds = (targetRows || [])
      .map((r: any) => r.message_id)
      .filter(Boolean);

    if (messageIds.length === 0) {
      return { ok: true, messages: [] };
    }

    // -----------------------------
    // Query 2: fetch message rows
    // ✅ IMPORTANT: hide resolved messages for stores
    // -----------------------------
    const { data: msgRows, error: msgErr } = await sb
      .from("messages")
      .select("id,title,body,created_at,is_announcement,requires_ack,sender_user_id,resolved_at")
      .in("id", messageIds)
      .is("resolved_at", null) // ✅ this is the key line
      .order("created_at", { ascending: false });

    if (msgErr) throw msgErr;

    const baseMessages: InboxMessage[] = (msgRows || []).map((m: any) => ({
      id: m.id,
      title: m.title,
      body: m.body,
      created_at: m.created_at,
      is_announcement: !!m.is_announcement,
      requires_ack: !!m.requires_ack,
      sender_user_id: m.sender_user_id ?? null,
      sender_name: null, // we fill this below (separate query)
      read_at: null,
      acknowledged_at: null,
    }));

    // If everything got resolved, return empty inbox
    if (baseMessages.length === 0) {
      return { ok: true, messages: [] };
    }

    // -----------------------------
    // Optional Query 2b: sender names (separate query to avoid recursion)
    // -----------------------------
    const senderIds = Array.from(
      new Set(baseMessages.map((m) => m.sender_user_id).filter(Boolean))
    ) as string[];

    if (senderIds.length > 0) {
      const { data: userRows, error: userErr } = await sb
        .from("users")
        .select("id,name")
        .in("id", senderIds);

      if (!userErr) {
        const nameMap = new Map<string, string>();
        (userRows || []).forEach((u: any) => nameMap.set(u.id, u.name));
        baseMessages.forEach((m) => {
          if (m.sender_user_id) {
            m.sender_name = nameMap.get(m.sender_user_id) ?? null;
          }
        });
      } else {
        // don't fail inbox if names fail
        console.warn("getInboxForStore: sender name fetch failed:", userErr);
      }
    }

    // -----------------------------
    // Query 3: read/ack state for this store
    // -----------------------------
    const visibleMessageIds = baseMessages.map((m) => m.id);

    const { data: readRows, error: readErr } = await sb
      .from("message_reads")
      .select("message_id, store_id, read_at, acknowledged_at")
      .eq("store_id", storeId)
      .in("message_id", visibleMessageIds);

    if (readErr) throw readErr;

    const readMap = new Map<string, ReadRow>();
    (readRows || []).forEach((rr: ReadRow) => {
      readMap.set(rr.message_id, rr);
    });

    const merged: InboxMessage[] = baseMessages.map((m) => {
      const rr = readMap.get(m.id);
      return {
        ...m,
        read_at: rr?.read_at ?? null,
        acknowledged_at: rr?.acknowledged_at ?? null,
      };
    });

    return { ok: true, messages: merged };
  } catch (e) {
    console.error("getInboxForStore error:", e);
    return { ok: false, error: friendlyError(e), messages: [] };
  }
}

export async function markMessageRead(storeId: string, messageId: string) {
  try {
    const now = new Date().toISOString();

    const { error } = await sb
      .from("message_reads")
      .upsert(
        {
          message_id: messageId,
          store_id: storeId,
          read_at: now,
        },
        { onConflict: "message_id,store_id" }
      );

    if (error) throw error;
    return { ok: true as const };
  } catch (e) {
    console.error("markMessageRead error:", e);
    return { ok: false as const, error: friendlyError(e) };
  }
}

export async function acknowledgeMessage(storeId: string, messageId: string) {
  try {
    const now = new Date().toISOString();

    const { error } = await sb
      .from("message_reads")
      .upsert(
        {
          message_id: messageId,
          store_id: storeId,
          acknowledged_at: now,
        },
        { onConflict: "message_id,store_id" }
      );

    if (error) throw error;
    return { ok: true as const };
  } catch (e) {
    console.error("acknowledgeMessage error:", e);
    return { ok: false as const, error: friendlyError(e) };
  }
}