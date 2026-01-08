// src/pages/Communications.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Mail, MailOpen, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { PremiumCard } from "@/components/ui/premium-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { useAuth } from "@/contexts/AuthContext";
import {
  InboxMessage,
  acknowledgeMessage,
  getInboxForStore,
  markMessageRead,
} from "@/services/storeMessages";

const INBOX_CACHE_KEY = "opsly_store_inbox_cache_v1";

function safeParseInboxCache(): InboxMessage[] {
  try {
    const raw = sessionStorage.getItem(INBOX_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as InboxMessage[];
  } catch {
    return [];
  }
}

function writeInboxCache(messages: InboxMessage[]) {
  try {
    sessionStorage.setItem(INBOX_CACHE_KEY, JSON.stringify(messages));
  } catch {
    // ignore cache write errors
  }
}

const Communications: React.FC = () => {
  const { store, loading: authLoading } = useAuth();

  // ✅ Start with cached messages so UI isn't blank
  const [messages, setMessages] = useState<InboxMessage[]>(() => safeParseInboxCache());

  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<InboxMessage | null>(null);

  // Tracks whether we have ever finished a real load for THIS session
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const loadInbox = useCallback(async () => {
    // Don’t fetch while auth is still hydrating
    if (authLoading) return;

    if (!store?.id) {
      // Keep cached messages on screen (don’t blank it out)
      // If you DO want to blank on unmapped user, uncomment next line:
      // setMessages([]);
      setHasLoadedOnce(true);
      return;
    }

    setLoading(true);

    try {
      const res = await getInboxForStore(store.id);

      if (!res.ok) {
        console.error("[Inbox] getInboxForStore error:", (res as any).error, res);
        // Keep whatever is already shown (cache) instead of blanking
        setHasLoadedOnce(true);
        return;
      }

      setMessages(res.messages);
      writeInboxCache(res.messages);
      setHasLoadedOnce(true);
    } catch (e) {
      console.error("[Inbox] loadInbox exception:", e);
      setHasLoadedOnce(true);
    } finally {
      setLoading(false);
    }
  }, [store?.id, authLoading]);

  // ✅ Only load when auth is ready; avoids "blank → then load" feeling
  useEffect(() => {
    if (authLoading) return;
    loadInbox();
  }, [authLoading, loadInbox]);

  const todayMessages = useMemo(() => {
    const now = Date.now();
    return messages.filter((m) => now - new Date(m.created_at).getTime() < 24 * 60 * 60 * 1000);
  }, [messages]);

  const olderMessages = useMemo(() => {
    const now = Date.now();
    return messages.filter((m) => now - new Date(m.created_at).getTime() >= 24 * 60 * 60 * 1000);
  }, [messages]);

  const unreadCount = useMemo(() => messages.filter((m) => !m.read_at).length, [messages]);

  async function openMessage(msg: InboxMessage) {
    setActive(msg);
    setOpen(true);

    if (store?.id && !msg.read_at) {
      const r = await markMessageRead(store.id, msg.id);
      if (!r.ok) {
        console.error(r.error);
      } else {
        const nowIso = new Date().toISOString();
        setMessages((prev) => {
          const next = prev.map((m) => (m.id === msg.id ? { ...m, read_at: nowIso } : m));
          writeInboxCache(next);
          return next;
        });
        setActive((prev) => (prev?.id === msg.id ? { ...prev, read_at: nowIso } : prev));
      }
    }
  }

  async function onAcknowledge() {
    if (!store?.id || !active) return;

    const r = await acknowledgeMessage(store.id, active.id);
    if (!r.ok) {
      alert(r.error || "Failed to acknowledge.");
      return;
    }

    const nowIso = new Date().toISOString();
    setMessages((prev) => {
      const next = prev.map((m) => (m.id === active.id ? { ...m, acknowledged_at: nowIso } : m));
      writeInboxCache(next);
      return next;
    });
    setActive((prev) => (prev ? { ...prev, acknowledged_at: nowIso } : prev));
  }

  // ✅ When opening tab, show skeleton instead of empty white screen
  const showInitialSkeleton =
    authLoading || (!hasLoadedOnce && loading && messages.length === 0);

  return (
    <div className="p-4 space-y-5">
      <div className="pt-2 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Messages</h1>
            <p className="text-muted-foreground mt-1">Communications from HQ</p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={unreadCount > 0 ? "default" : "secondary"}>
              {unreadCount} unread
            </Badge>

            <Button
              variant="outline"
              onClick={loadInbox}
              disabled={loading || authLoading || !store?.id}
            >
              Refresh
            </Button>
          </div>
        </div>

        {authLoading && (
          <p className="text-sm text-muted-foreground mt-3">Loading your store…</p>
        )}

        {!authLoading && !store?.id && (
          <p className="text-sm text-destructive mt-3">
            No store mapped to this user (user_store_access). Please map and re-login.
          </p>
        )}
      </div>

      {/* ✅ Skeleton UI (so it doesn't look blank) */}
      {showInitialSkeleton && (
        <div className="space-y-3 animate-pulse">
          <div className="h-4 w-20 rounded bg-muted" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border bg-white p-3">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-24 rounded bg-muted" />
                  <div className="h-3 w-32 rounded bg-muted" />
                  <div className="flex gap-2 pt-1">
                    <div className="h-5 w-24 rounded bg-muted" />
                    <div className="h-5 w-28 rounded bg-muted" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Today */}
      {todayMessages.length > 0 && (
        <div className="animate-slide-up">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">TODAY</h2>
          <div className="space-y-2">
            {todayMessages.map((msg) => {
              const isRead = !!msg.read_at;
              const needsAck = msg.requires_ack && !msg.acknowledged_at;

              return (
                <PremiumCard
                  key={msg.id}
                  hover
                  className="!p-3 cursor-pointer"
                  onClick={() => openMessage(msg)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${isRead ? "bg-muted" : "bg-primary/10"}`}>
                      {isRead ? (
                        <MailOpen className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Mail className="h-4 w-4 text-primary" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm truncate ${isRead ? "font-medium" : "font-semibold"}`}>
                          {msg.title}
                        </p>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>

                      <p className="text-xs text-muted-foreground mt-0.5">
                        {msg.sender_name ? msg.sender_name : "HQ"}
                      </p>

                      <p className="text-2xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        {msg.is_announcement && <Badge variant="secondary">Announcement</Badge>}
                        {needsAck && <Badge variant="outline">Ack required</Badge>}
                        {msg.acknowledged_at && <Badge variant="secondary">Acknowledged</Badge>}
                      </div>
                    </div>
                  </div>
                </PremiumCard>
              );
            })}
          </div>
        </div>
      )}

      {/* Older */}
      {olderMessages.length > 0 && (
        <div className="animate-slide-up">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">EARLIER</h2>
          <div className="space-y-2">
            {olderMessages.map((msg) => {
              const isRead = !!msg.read_at;
              const needsAck = msg.requires_ack && !msg.acknowledged_at;

              return (
                <PremiumCard
                  key={msg.id}
                  hover
                  className="!p-3 cursor-pointer"
                  onClick={() => openMessage(msg)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${isRead ? "bg-muted" : "bg-primary/10"}`}>
                      {isRead ? (
                        <MailOpen className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Mail className="h-4 w-4 text-primary" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm truncate ${isRead ? "font-medium" : "font-semibold"}`}>
                          {msg.title}
                        </p>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>

                      <p className="text-xs text-muted-foreground mt-0.5">
                        {msg.sender_name ? msg.sender_name : "HQ"}
                      </p>

                      <p className="text-2xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        {msg.is_announcement && <Badge variant="secondary">Announcement</Badge>}
                        {needsAck && <Badge variant="outline">Ack required</Badge>}
                        {msg.acknowledged_at && <Badge variant="secondary">Acknowledged</Badge>}
                      </div>
                    </div>
                  </div>
                </PremiumCard>
              );
            })}
          </div>
        </div>
      )}

      {!loading && !authLoading && store?.id && messages.length === 0 && (
        <div className="text-sm text-muted-foreground">
          No messages yet. Ask HQ to send one to this store.
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setActive(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{active?.title || "Message"}</DialogTitle>
            <DialogDescription>
              {active?.sender_name ? `From ${active.sender_name}` : "From HQ"} •{" "}
              {active?.created_at ? new Date(active.created_at).toLocaleString() : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="text-sm whitespace-pre-wrap text-foreground">{active?.body || ""}</div>

          <div className="flex items-center justify-between pt-3">
            <div className="flex gap-2">
              {active?.is_announcement && <Badge variant="secondary">Announcement</Badge>}
              {active?.requires_ack && <Badge variant="outline">Ack required</Badge>}
              {active?.acknowledged_at && <Badge variant="secondary">Acknowledged</Badge>}
            </div>

            {active?.requires_ack && !active?.acknowledged_at ? (
              <Button onClick={onAcknowledge}>Acknowledge</Button>
            ) : (
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Communications;