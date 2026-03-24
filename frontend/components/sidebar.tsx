import React, { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bookmark, Clock, ServerCrash, Trash2 } from "lucide-react";

export function Sidebar({
  onSelectBookmark,
  triggerRefresh
}: {
  onSelectBookmark: (result: any, url: string, text: string, id: string) => void;
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
    fetchBookmarks();
  }, [triggerRefresh]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4311";
      const res = await fetch(`${API_URL}/api/bookmarks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      setBookmarks(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      console.error("Failed to delete", err);
      alert("Failed to delete from the database. Make sure your local backend (npm run dev) was restarted to load the new DELETE route!");
    }
  }

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
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "24px" }}>
            {/* EXTENSION SYNCS */}
            <div>
              <p className="eyebrow" style={{ padding: "0 16px", marginBottom: "12px", color: "#34C759" }}>Extension Syncs</p>
              {bookmarks.filter(b => b.source === "extension").length === 0 ? (
                <p style={{ padding: "0 16px", fontSize: "12px", color: "var(--muted)" }}>No synced analyses yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {bookmarks.filter(b => b.source === "extension").map((bm, i) => {
                    const dateStr = formatDistanceToNow(new Date(bm.createdAt), { addSuffix: true });
                    const staggerClass = i < 4 ? `animate-pop-in stagger-${i + 1}` : "";
                    
                    let title = "Fact Check";
                    if (bm.inputUrl) {
                      try { title = new URL(bm.inputUrl).hostname.replace("www.", ""); } catch (_) { title = bm.inputUrl; }
                    } else if (bm.inputText) {
                      title = bm.inputText.slice(0, 40) + "...";
                    }

                    return (
                      <div key={bm.id} className={`history-card ${staggerClass}`} onClick={() => onSelectBookmark(bm.analysisResult, bm.inputUrl || "", bm.inputText || "", bm.id)}>
                        <div className="history-card-title">{title}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "8px" }}>
                          <Clock size={12} color="var(--muted)" />
                          <span className="history-card-date">{dateStr}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <span className="query-chip" style={{ fontSize: "10px", padding: "2px 6px", background: "rgba(52, 199, 89, 0.1)", color: "#34C759", border: "1px solid rgba(52, 199, 89, 0.2)" }}>Extension</span>
                            <span className="query-chip" style={{ fontSize: "10px", padding: "2px 6px", background: "rgba(255, 255, 255, 0.05)", color: "var(--muted)", border: "1px solid var(--line)" }}>{(bm.type || (bm.inputUrl ? "url" : "text")).toUpperCase()}</span>
                          </div>
                          <button onClick={(e) => handleDelete(e, bm.id)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px", color: "var(--muted)", transition: "color 0.2s" }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")} title="Delete Bookmark">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* WEB DASHBOARD */}
            <div>
              <p className="eyebrow" style={{ padding: "0 16px", marginBottom: "12px" }}>Web Dashboard</p>
              {bookmarks.filter(b => b.source !== "extension").length === 0 ? (
                <p style={{ padding: "0 16px", fontSize: "12px", color: "var(--muted)" }}>No saved web analyses.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {bookmarks.filter(b => b.source !== "extension").map((bm, i) => {
                    const dateStr = formatDistanceToNow(new Date(bm.createdAt), { addSuffix: true });
                    const staggerClass = i < 4 ? `animate-pop-in stagger-${i + 1}` : "";
                    
                    let title = "Fact Check";
                    if (bm.inputUrl) {
                      try { title = new URL(bm.inputUrl).hostname.replace("www.", ""); } catch (_) { title = bm.inputUrl; }
                    } else if (bm.inputText) {
                      title = bm.inputText.slice(0, 40) + "...";
                    }

                    return (
                      <div key={bm.id} className={`history-card ${staggerClass}`} onClick={() => onSelectBookmark(bm.analysisResult, bm.inputUrl || "", bm.inputText || "", bm.id)}>
                        <div className="history-card-title">{title}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "8px" }}>
                          <Clock size={12} color="var(--muted)" />
                          <span className="history-card-date">{dateStr}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <span className="query-chip" style={{ fontSize: "10px", padding: "2px 6px", background: "rgba(255, 255, 255, 0.05)", color: "var(--muted)", border: "1px solid var(--line)" }}>{(bm.type || (bm.inputUrl ? "url" : "text")).toUpperCase()}</span>
                          </div>
                          <button onClick={(e) => handleDelete(e, bm.id)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px", color: "var(--muted)", transition: "color 0.2s" }} onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")} title="Delete Bookmark">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
