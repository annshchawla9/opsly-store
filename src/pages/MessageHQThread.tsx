// src/pages/MessageHQThread.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw, Send, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  PremiumCard,
  PremiumCardHeader,
  PremiumCardTitle,
  PremiumCardContent,
} from "@/components/ui/premium-card";

type DbHQThread = {
  id: string;
  store_id: string;
  subject: string;
  status: string | null;
  created_by_user_id: string | null;
  created_at: string;
  last_message_at: string | null;
};

type DbHQMessage = {
  id: string;
  thread_id: string;
  sender_role: string; // 'store' | 'hq'
  sender_user_id: string | null;
  body: string;
  created_at: string;
  hq_read_at: string | null;
  store_read_at: string | null;
};

function formatDateTime(ts?: string | null) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts ?? "—";
  }
}

export default function MessageHQThread() {
  const navigate = useNavigate();
  const { threadId } = useParams();
  const { user, appUser } = useAuth() as any;

  const [loading, setLoading] = useState(true);
  const [thread, setThread] = useState<DbHQThread | null>(null);
  const [messages, setMessages] = useState<DbHQMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const [storeLabel, setStoreLabel] = useState<string>("");

  useEffect(() => {
    const loadStoreLabel = async () => {
      if (!user?.id) return;
      const { data, error } = await (supabase as any)
        .from("user_store_access")
        .select("stores:store_id(code, name)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!error) {
        const s = data?.stores;
        setStoreLabel(s ? `${s.code ?? ""} — ${s.name ?? ""}`.trim() : "");
      }
    };
    loadStoreLabel();
  }, [user?.id]);

  async function loadThread() {
    if (!threadId) return;
    setLoading(true);

    try {
      const { data: tRow, error: tErr } = await (supabase as any)
        .from("hq_threads")
        .select("id,store_id,subject,status,created_by_user_id,created_at,last_message_at")
        .eq("id", threadId)
        .maybeSingle();

      if (tErr) throw tErr;
      if (!tRow) {
        setThread(null);
        setMessages([]);
        return;
      }

      const t: DbHQThread = {
        id: tRow.id,
        store_id: tRow.store_id,
        subject: tRow.subject,
        status: tRow.status ?? null,
        created_by_user_id: tRow.created_by_user_id ?? null,
        created_at: tRow.created_at,
        last_message_at: tRow.last_message_at ?? null,
      };
      setThread(t);

      // ✅ NEW: If HQ resolved this thread, don’t show conversation/reply in store app
      // (Store should not have power to reopen; HQ decides.)
      if ((t.status || "").toLowerCase() === "resolved") {
        setMessages([]); // keep it clean
        return;
      }

      const { data: msgRows, error: mErr } = await (supabase as any)
        .from("hq_messages")
        .select("id,thread_id,sender_role,sender_user_id,body,created_at,hq_read_at,store_read_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (mErr) throw mErr;

      const msgs = (msgRows || []) as DbHQMessage[];
      setMessages(msgs);

      const unreadHQMsgIds = msgs
        .filter((m) => m.sender_role === "hq" && !m.store_read_at)
        .map((m) => m.id);

      if (unreadHQMsgIds.length) {
        const now = new Date().toISOString();

        const { error: updErr } = await (supabase as any)
          .from("hq_messages")
          .update({ store_read_at: now })
          .in("id", unreadHQMsgIds);

        if (updErr) console.warn("Failed to mark store_read_at:", updErr);

        setMessages((prev) =>
          prev.map((m) => (unreadHQMsgIds.includes(m.id) ? { ...m, store_read_at: now } : m))
        );
      }
    } catch (e) {
      console.error("MessageHQThread load error:", e);
      setThread(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const titleStore = useMemo(() => {
    if (storeLabel) return storeLabel;
    return thread?.store_id ?? "";
  }, [storeLabel, thread?.store_id]);

  const isResolved = useMemo(
    () => ((thread?.status || "").toLowerCase() === "resolved"),
    [thread?.status]
  );

  async function sendReply() {
    if (!threadId) return;
    if (!appUser?.id) return alert("Not logged in.");

    // ✅ NEW: block replies when resolved
    if (isResolved) {
      alert("This thread has been resolved by HQ.");
      return;
    }

    const bodyText = reply.trim();
    if (!bodyText) return;

    setSending(true);
    try {
      const { error: insErr } = await (supabase as any)
        .from("hq_messages")
        .insert({
          thread_id: threadId,
          sender_role: "store",
          sender_user_id: appUser.id,
          body: bodyText,
        });

      if (insErr) throw insErr;

      const now = new Date().toISOString();

      const { error: thrErr } = await (supabase as any)
        .from("hq_threads")
        .update({ last_message_at: now, status: "open" })
        .eq("id", threadId);

      if (thrErr) console.warn("Failed to update thread:", thrErr);

      setReply("");
      await loadThread();
    } catch (e) {
      console.error("Store reply error:", e);
      alert("Failed to send. Check console.");
    } finally {
      setSending(false);
    }
  }

  if (!user) return <div className="p-6 text-sm text-muted-foreground">Please sign in.</div>;

  return (
    <div className="p-4 space-y-5 animate-fade-in pb-24">
      {/* Header */}
      <div className="pt-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/message-hq")}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h1 className="text-2xl font-bold text-foreground break-words">
                  {thread?.subject || "Thread"}
                </h1>
                {thread?.status && <Badge variant="secondary">{thread.status}</Badge>}
                {titleStore && (
                  <Badge variant="outline" className="max-w-full truncate">
                    {titleStore}
                  </Badge>
                )}
              </div>

              <p className="text-muted-foreground text-sm mt-1 break-words">
                Created: {formatDateTime(thread?.created_at)} · Last:{" "}
                {formatDateTime(thread?.last_message_at)}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            className="gap-2 shrink-0"
            onClick={loadThread}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* ✅ NEW: Resolved Banner */}
      {!loading && isResolved && (
        <PremiumCard className="animate-slide-up">
          <PremiumCardContent className="p-4">
            <div className="text-sm font-medium">This thread has been resolved by HQ.</div>
            <div className="text-xs text-muted-foreground mt-1">
              It will no longer appear in your Messages list.
            </div>
            <div className="mt-3">
              <Button variant="outline" onClick={() => navigate("/message-hq")}>
                Back to Messages
              </Button>
            </div>
          </PremiumCardContent>
        </PremiumCard>
      )}

      {/* Conversation */}
      {!isResolved && (
        <PremiumCard className="animate-slide-up">
          <PremiumCardHeader>
            <PremiumCardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Conversation
            </PremiumCardTitle>
          </PremiumCardHeader>

          <PremiumCardContent className="space-y-3">
            {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
            {!loading && messages.length === 0 && (
              <div className="text-sm text-muted-foreground">No messages yet.</div>
            )}

            {!loading &&
              messages.map((m) => {
                const fromHQ = m.sender_role === "hq";

                return (
                  <div
                    key={m.id}
                    className={[
                      "rounded-2xl border p-3 transition-all",
                      fromHQ ? "bg-muted/40" : "bg-background",
                      "hover:shadow-sm hover:border-primary/20",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant={fromHQ ? "secondary" : "default"}>
                          {fromHQ ? "HQ" : "Store"}
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(m.created_at)}
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground text-right max-w-[55%] break-words">
                        {m.sender_role === "store" && (
                          <span>HQ read: {m.hq_read_at ? formatDateTime(m.hq_read_at) : "—"}</span>
                        )}
                        {m.sender_role === "hq" && (
                          <span>
                            Store read: {m.store_read_at ? formatDateTime(m.store_read_at) : "—"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
                  </div>
                );
              })}
          </PremiumCardContent>
        </PremiumCard>
      )}

      {/* Reply */}
      {!isResolved && (
        <PremiumCard className="animate-slide-up">
          <PremiumCardHeader>
            <PremiumCardTitle>Reply</PremiumCardTitle>
          </PremiumCardHeader>

          <PremiumCardContent className="space-y-3">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
              placeholder="Type your message to HQ…"
            />

            <div className="flex justify-end">
              <Button className="gap-2" onClick={sendReply} disabled={sending || !reply.trim()}>
                <Send className="h-4 w-4" />
                {sending ? "Sending…" : "Send"}
              </Button>
            </div>
          </PremiumCardContent>
        </PremiumCard>
      )}
    </div>
  );
}
