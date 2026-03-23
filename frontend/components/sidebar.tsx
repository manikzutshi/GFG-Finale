import React, { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bookmark, Clock, ServerCrash } from "lucide-react";

export function Sidebar({
  onSelectBookmark,
  triggerRefresh
}: {
  onSelectBookmark: (result: any, url: string, text: string) => void;
  triggerRefresh?: number;
}) {
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchBookmarks() {
      try {
        setLoading(true);
        const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4311";
        const res = await fetch(`${API_URL}/api/bookmarks`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        // Reverse so newest are at the top
        setBookmarks(Array.isArray(data) ? data.reverse() : []);
        setError(false);
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchBookmarks();
  }, [triggerRefresh]);

  return (
    <aside className="sidebar animate-slide-in-left">
      <div className="sidebar-header">
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Bookmark size={20} className="primary-icon" style={{ stroke: "var(--accent)" }} />
          <h2 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>Saved Analyses</h2>
        </div>
        <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>
          Your history from Neon Postgres
        </p>
      </div>

      <div className="sidebar-content">
        {loading ? (
          <>
            <div className="claim-skeleton" style={{ height: "70px", minHeight: "70px" }} />
            <div className="claim-skeleton" style={{ height: "70px", minHeight: "70px" }} />
            <div className="claim-skeleton" style={{ height: "70px", minHeight: "70px" }} />
          </>
        ) : error ? (
          <div className="panel empty-state" style={{ padding: "24px 16px" }}>
            <ServerCrash size={24} style={{ color: "var(--danger)", marginBottom: "8px" }} />
            <p className="eyebrow" style={{ color: "var(--danger)" }}>Connection Error</p>
            <p style={{ fontSize: "12px" }}>Could not fetch history.</p>
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="panel empty-state" style={{ padding: "24px 16px" }}>
            <p className="eyebrow">No bookmarks</p>
            <p style={{ fontSize: "12px" }}>Saved investigations will appear here.</p>
          </div>
        ) : (
          bookmarks.map((bm, i) => {
            const dateStr = formatDistanceToNow(new Date(bm.createdAt), { addSuffix: true });
            // Animation stagger for up to 4 items initially
            const staggerClass = i < 4 ? `animate-pop-in stagger-${i + 1}` : "";
            
            // Derive a title from what was input
            let title = "Fact Check";
            if (bm.inputUrl) {
              try {
                const url = new URL(bm.inputUrl);
                title = url.hostname.replace("www.", "");
              } catch (_) {
                title = bm.inputUrl;
              }
            } else if (bm.inputText) {
              title = bm.inputText.slice(0, 40) + "...";
            }

            return (
              <div 
                key={bm.id} 
                className={`history-card ${staggerClass}`}
                onClick={() => onSelectBookmark(bm.analysisResult, bm.inputUrl || "", bm.inputText || "")}
              >
                <div className="history-card-title">{title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Clock size={12} color="var(--muted)" />
                  <span className="history-card-date">{dateStr}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
