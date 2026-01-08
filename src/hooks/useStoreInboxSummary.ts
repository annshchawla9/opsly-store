import { useEffect, useMemo, useState } from "react";
import { getInboxForStore, InboxMessage } from "@/services/storeMessages";

export function useStoreInboxSummary(storeId?: string | null) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeId) return;

    let cancelled = false;
    setLoading(true);

    getInboxForStore(storeId)
      .then((res) => {
        if (!res.ok || cancelled) return;
        setMessages(res.messages);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const total = messages.length;
  const unread = useMemo(
    () => messages.filter((m) => !m.read_at).length,
    [messages]
  );
  const read = total - unread;

  return {
    total,
    read,
    unread,
    loading,
  };
}