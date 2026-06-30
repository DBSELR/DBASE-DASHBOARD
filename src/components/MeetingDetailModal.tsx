import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import axios from "axios";
import { API_BASE } from "../config";

// ── Types (camelCase matches ASP.NET Core JSON serialisation) ────────

interface DetailData {
  allParticipants: string[];
  attended: AttendedRow[];
  absent: { empCode: number }[];
  transcript: TranscriptRow[];
  attendedCount: number;
  absentCount: number;
  totalParticipants: number;
}

interface AISummaryData {
  summary: {
    summaryText?: string | null;
    actionItems?: string | null;
    decisions?: string | null;
    risks?: string | null;
    generatedDate?: string | null;
    modelUsed?: string | null;
  } | null;
  actionItems: ActionItemRow[];
}

interface ActionItemRow {
  id: number;
  assignedTo?: string | null;
  taskDescription?: string | null;
  dueDate?: string | null;
  status: string;
}

interface AttendedRow {
  empCode?: number | null;
  displayName?: string | null;
  email?: string | null;
  joinTime?: string | null;
  leaveTime?: string | null;
  durationSeconds?: number | null;
  source?: string;
  joinCount?: number;
}

interface TranscriptRow {
  speakerName: string;
  transcriptText: string;
  startTime?: string | null;
}

export interface MeetingInfo {
  id?: number;
  meetingType?: string;
  financialYear?: string;
  monthName?: string;
  frequencyType?: string;
  meetingStatus?: string;
  transcriptSyncStatus?: string;
  attendanceSyncStatus?: string;
  graphMeetingId?: string;
  aiSummaryAvailable?: boolean;
  attendancePercent?: number | null;
}

interface Props {
  meetingId: number | null;
  meeting: MeetingInfo | null;
  onClose: () => void;
  onSyncAttendance?: (id: number, graphMeetingId?: string) => Promise<void>;
  onSyncTranscript?: (id: number, graphMeetingId?: string) => Promise<void>;
}

// ── Helpers ──────────────────────────────────────────────────────────

const SPEAKER_COLORS = [
  "#2563eb", "#7c3aed", "#059669", "#dc2626",
  "#d97706", "#0891b2", "#be185d", "#65a30d",
];

function speakerColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return SPEAKER_COLORS[Math.abs(h) % SPEAKER_COLORS.length];
}

function fmtTime(ts?: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(secs?: number | null) {
  if (secs == null || secs < 0) return "";
  const m = Math.floor(secs / 60), s = secs % 60;
  return m === 0 ? `${s}s` : s > 0 ? `${m}m ${s}s` : `${m} min`;
}

function vttTime(ts?: string | null) {
  if (!ts) return "";
  return (ts.split("T")[1] || "").substring(0, 8);
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "?";
}

// ── Component ────────────────────────────────────────────────────────

function MeetingDetailModal({ meetingId, meeting, onClose, onSyncAttendance, onSyncTranscript }: Props) {
  const [data, setData]           = useState<DetailData | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [tab, setTab]             = useState<"attendance" | "transcript" | "ai">("attendance");
  const [empMap, setEmpMap]       = useState<Record<string, string>>({});
  const [syncing, setSyncing]     = useState<"att" | "tx" | "ai" | null>(null);
  const [syncMsg, setSyncMsg]     = useState<string | null>(null);
  const [aiData, setAiData]       = useState<AISummaryData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Employee name lookup
  useEffect(() => {
    const base = API_BASE ? API_BASE.replace(/\/$/, "") : "";
    const token = localStorage.getItem("token") || "";
    axios.get(`${base}/Employee/Load_Employees`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(res => {
        const map: Record<string, string> = {};
        (res.data ?? []).forEach((emp: any) => {
          if (emp[0] && emp[1]) map[String(emp[0])] = emp[1];
        });
        setEmpMap(map);
      })
      .catch(() => {});
  }, []);

  const reload = () => {
    if (meetingId === null) return;
    setLoading(true);
    setError(null);
    const base  = API_BASE ? API_BASE.replace(/\/$/, "") : "";
    const token = localStorage.getItem("token") || "";
    axios.get(`${base}/Meeting/GetMeetingDetail?meetingMasterId=${meetingId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(res => setData(res.data))
      .catch(err => setError(err?.response?.data?.message || err?.message || "Failed to load"))
      .finally(() => setLoading(false));
  };

  const loadAI = () => {
    if (meetingId === null) return;
    setAiLoading(true);
    const base  = API_BASE ? API_BASE.replace(/\/$/, "") : "";
    const token = localStorage.getItem("token") || "";
    axios.get(`${base}/Meeting/GetMeetingSummary?meetingMasterId=${meetingId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(res => setAiData(res.data))
      .catch(() => {})
      .finally(() => setAiLoading(false));
  };

  useEffect(() => {
    if (meetingId !== null) {
      setData(null); setAiData(null); setTab("attendance"); reload();
      if (meeting?.aiSummaryAvailable) loadAI();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  // Group transcript lines by consecutive speaker — must be before early return (Rules of Hooks)
  const grouped = useMemo(() => {
    if (!data?.transcript?.length) return [];
    const result: { speaker: string; lines: TranscriptRow[] }[] = [];
    for (const ln of data.transcript) {
      const sp = ln.speakerName || "Unknown";
      const prev = result[result.length - 1];
      if (prev && prev.speaker === sp) prev.lines.push(ln);
      else result.push({ speaker: sp, lines: [ln] });
    }
    return result;
  }, [data?.transcript]);

  if (meetingId === null) return null;

  const empName = (code?: number | string | null) =>
    code != null ? (empMap[String(code)] || `Emp #${code}`) : "Unknown";

  const txStatus  = meeting?.transcriptSyncStatus || null;
  const attStatus = meeting?.attendanceSyncStatus || null;
  const hasGraph  = !!(meeting?.graphMeetingId);

  const handleSyncAtt = async () => {
    if (!onSyncAttendance || !meetingId) return;
    setSyncing("att"); setSyncMsg(null);
    try {
      await onSyncAttendance(meetingId, meeting?.graphMeetingId);
      setSyncMsg("Attendance synced!");
      reload();
    } catch (e: any) {
      setSyncMsg("Sync failed: " + (e?.response?.data?.message || e?.message || "unknown"));
    }
    setSyncing(null);
  };

  const handleSyncTx = async () => {
    if (!onSyncTranscript || !meetingId) return;
    setSyncing("tx"); setSyncMsg(null);
    try {
      await onSyncTranscript(meetingId, meeting?.graphMeetingId);
      setSyncMsg("Transcript synced!");
      reload();
    } catch (e: any) {
      setSyncMsg("Sync failed: " + (e?.response?.data?.message || e?.message || "unknown"));
    }
    setSyncing(null);
  };

  const handleGenerateAI = async () => {
    if (!meetingId) return;
    setSyncing("ai"); setSyncMsg(null);
    const base  = API_BASE ? API_BASE.replace(/\/$/, "") : "";
    const token = localStorage.getItem("token") || "";
    try {
      await axios.post(`${base}/Meeting/GenerateSummary?meetingMasterId=${meetingId}`, {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setSyncMsg("AI summary generated!");
      loadAI();
    } catch (e: any) {
      setSyncMsg("AI failed: " + (e?.response?.data?.message || e?.message || "unknown"));
    }
    setSyncing(null);
  };

  const handleUpdateActionItem = async (itemId: number, status: string) => {
    const base  = API_BASE ? API_BASE.replace(/\/$/, "") : "";
    const token = localStorage.getItem("token") || "";
    try {
      await axios.post(
        `${base}/Meeting/UpdateActionItemStatus?actionItemId=${itemId}&status=${encodeURIComponent(status)}`,
        {},
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      loadAI();
    } catch { }
  };

  const sc = {
    Completed: { bg: "#dcfce7", color: "#15803d" },
    Pending:   { bg: "#fef9c3", color: "#92400e" },
    Escalated: { bg: "#fee2e2", color: "#b91c1c" },
  }[meeting?.meetingStatus || "Pending"] ?? { bg: "#fef9c3", color: "#92400e" };

  return ReactDOM.createPortal(
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999,
        background: "rgba(15,23,42,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
        boxSizing: "border-box",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff", borderRadius: 20,
          width: "100%", maxWidth: 800, maxHeight: "90vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 24px 80px rgba(0,0,0,0.3)", overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ══ Header ══ */}
        <div style={{
          padding: "18px 20px", borderBottom: "1px solid #f1f5f9",
          background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: "#eff6ff", color: "#2563eb", fontSize: 22,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              📊
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>
                  {meeting?.meetingType || "Meeting"} #{meetingId}
                </span>
                <span style={{
                  padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: sc.bg, color: sc.color,
                }}>
                  {meeting?.meetingStatus || "Pending"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                {meeting?.monthName} {meeting?.financialYear}
                {meeting?.frequencyType ? ` · ${meeting.frequencyType}` : ""}
              </div>
            </div>

            {/* Stat chips */}
            {data && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                <span style={{ padding: "4px 10px", borderRadius: 20, background: "#dcfce7", color: "#15803d", fontSize: 12, fontWeight: 700 }}>
                  ✓ {data.attendedCount}
                </span>
                <span style={{ padding: "4px 10px", borderRadius: 20, background: "#fee2e2", color: "#b91c1c", fontSize: 12, fontWeight: 700 }}>
                  ✗ {data.absentCount}
                </span>
                {data.transcript.length > 0 && (
                  <span style={{ padding: "4px 10px", borderRadius: 20, background: "#ede9fe", color: "#7c3aed", fontSize: 12, fontWeight: 700 }}>
                    📝 {data.transcript.length}
                  </span>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              style={{
                background: "#f1f5f9", border: "none", cursor: "pointer",
                fontSize: 16, color: "#64748b", padding: "6px 9px", borderRadius: 8, lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginTop: 14, flexWrap: "wrap" }}>
            {([
              { key: "attendance", label: "👥 Attendance" },
              { key: "transcript", label: "📝 Transcript" },
              { key: "ai",         label: "🤖 AI (Soon)" },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => {
                setTab(key as any);
              }} style={{
                padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 700, transition: "all 0.15s",
                background: tab === key ? "#2563eb" : "transparent",
                color: tab === key ? "#fff" : "#64748b",
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ══ Body ══ */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

          {loading && (
            <div style={{ textAlign: "center", color: "#64748b", padding: 48, fontSize: 14 }}>
              Loading meeting details…
            </div>
          )}

          {error && (
            <div style={{ padding: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, color: "#dc2626", fontSize: 13 }}>
              {error}
            </div>
          )}

          {syncMsg && (
            <div style={{
              padding: "10px 16px", borderRadius: 10, marginBottom: 16, fontSize: 13,
              background: syncMsg.startsWith("Sync failed") ? "#fef2f2" : "#f0fdf4",
              color: syncMsg.startsWith("Sync failed") ? "#dc2626" : "#15803d",
              border: `1px solid ${syncMsg.startsWith("Sync failed") ? "#fecaca" : "#bbf7d0"}`,
            }}>
              {syncMsg}
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* ══ ATTENDANCE TAB ══ */}
              {tab === "attendance" && (
                <div>
                  {/* Summary bar */}
                  <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
                    {[
                      { n: data.attendedCount,    label: "Attended", bg: "#dcfce7", color: "#15803d" },
                      { n: data.absentCount,      label: "Absent",   bg: "#fee2e2", color: "#b91c1c" },
                      { n: data.totalParticipants, label: "Total",   bg: "#f1f5f9", color: "#0f172a" },
                    ].map(s => (
                      <div key={s.label} style={{ flex: 1, padding: "14px 16px", background: s.bg, borderRadius: 14, textAlign: "center" }}>
                        <div style={{ fontSize: 30, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.n}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: s.color, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.85 }}>
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ── Attended list ── */}
                  {data.attended.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <SectionHeading dot="#10b981" color="#15803d" label={`Attended (${data.attendedCount})`} />
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {data.attended.map((row, i) => {
                          const hasIdentity = !!(row.displayName || row.email || row.empCode);
                          const displayLabel = row.displayName || empName(row.empCode);
                          const subLabel = row.email || (row.empCode ? `Emp #${row.empCode}` : "Joined anonymously — no account");
                          return (
                          <div key={i} style={{
                            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                            background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12,
                          }}>
                            <Avatar name={hasIdentity ? displayLabel : `#${i + 1}`} color={hasIdentity ? "#10b981" : "#94a3b8"} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                                {hasIdentity ? displayLabel : "Anonymous Attendee"}
                                {!hasIdentity && (
                                  <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: "#f1f5f9", color: "#94a3b8" }}>
                                    no account
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: "#64748b" }}>{subLabel}</div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              {row.joinTime  && <div style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>In {fmtTime(row.joinTime)}</div>}
                              {row.leaveTime && <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>Out {fmtTime(row.leaveTime)}</div>}
                              {row.durationSeconds != null && <div style={{ fontSize: 11, color: "#64748b" }}>{fmtDuration(row.durationSeconds)}</div>}
                              {(row.joinCount ?? 0) > 1 && <div style={{ fontSize: 10, color: "#94a3b8" }}>{row.joinCount}× joins</div>}
                              <SourceChip source={row.source || "App"} />
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {data.attended.length === 0 && (
                    <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", background: "#f8fafc", borderRadius: 12, marginBottom: 16, fontSize: 14 }}>
                      No attendance recorded yet.{hasGraph ? " Click Sync to pull from Teams." : ""}
                    </div>
                  )}

                  {/* ── Absent list ── */}
                  {data.absent.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <SectionHeading dot="#ef4444" color="#b91c1c" label={`Absent (${data.absentCount})`} />
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {data.absent.map((row, i) => (
                          <div key={i} style={{
                            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                            background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 12,
                          }}>
                            <Avatar name={empName(row.empCode)} color="#fca5a5" textColor="#991b1b" />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{empName(row.empCode)}</div>
                              <div style={{ fontSize: 11, color: "#64748b" }}>Emp #{row.empCode}</div>
                            </div>
                            <span style={{ padding: "3px 9px", borderRadius: 6, background: "#fee2e2", color: "#b91c1c", fontSize: 11, fontWeight: 700 }}>
                              Absent
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sync button */}
                  {hasGraph && onSyncAttendance && (
                    <button onClick={handleSyncAtt} disabled={syncing === "att"} style={{
                      width: "100%", padding: 13, background: "#7c3aed", color: "#fff",
                      border: "none", borderRadius: 10, cursor: syncing === "att" ? "wait" : "pointer",
                      fontSize: 13, fontWeight: 700, opacity: syncing === "att" ? 0.6 : 1, marginTop: 4,
                    }}>
                      {syncing === "att" ? "Syncing…" : "↑ Sync Attendance from Teams"}
                    </button>
                  )}

                  {attStatus && (
                    <p style={{ marginTop: 10, fontSize: 12, color: "#64748b", textAlign: "center" }}>
                      Teams attendance sync: <strong>{attStatus}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* ══ TRANSCRIPT TAB ══ */}
              {tab === "transcript" && (
                <div>
                  {grouped.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#64748b", padding: "40px 20px" }}>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>🎙️</div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: "#334155" }}>No transcript available</div>
                      <div style={{ fontSize: 13, maxWidth: 400, margin: "0 auto 24px", lineHeight: 1.7 }}>
                        {txStatus === "NoTranscript"
                          ? "Teams returned no transcript for this meeting. You must click More options (···) → Start transcription in Teams before or during the meeting."
                          : txStatus === "Completed"
                            ? "Transcript was synced but no lines were found."
                            : txStatus === "Failed"
                              ? "Last sync attempt failed. Try again."
                              : "Not synced yet. Click the button below to pull from Teams."}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 22, marginBottom: 20 }}>
                      {grouped.map((g, gi) => {
                        const color = speakerColor(g.speaker);
                        return (
                          <div key={gi}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                              <div style={{
                                width: 30, height: 30, borderRadius: "50%",
                                background: color, color: "#fff", flexShrink: 0,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 11, fontWeight: 700,
                              }}>
                                {initials(g.speaker)}
                              </div>
                              <span style={{ fontWeight: 700, fontSize: 13, color }}>{g.speaker}</span>
                            </div>
                            <div style={{ marginLeft: 38, display: "flex", flexDirection: "column", gap: 5 }}>
                              {g.lines.map((ln, li) => (
                                <div key={li} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                                  {vttTime(ln.startTime) && (
                                    <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", flexShrink: 0, minWidth: 58 }}>
                                      {vttTime(ln.startTime)}
                                    </span>
                                  )}
                                  <span style={{
                                    fontSize: 13, color: "#334155", lineHeight: 1.6, flex: 1,
                                    background: "#f8fafc", borderRadius: 8, padding: "6px 12px",
                                    borderLeft: `3px solid ${color}`,
                                  }}>
                                    {ln.transcriptText}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {hasGraph && onSyncTranscript && (
                    <button onClick={handleSyncTx} disabled={syncing === "tx"} style={{
                      width: "100%", padding: 13, background: "#0891b2", color: "#fff",
                      border: "none", borderRadius: 10, cursor: syncing === "tx" ? "wait" : "pointer",
                      fontSize: 13, fontWeight: 700, opacity: syncing === "tx" ? 0.6 : 1, marginTop: 4,
                    }}>
                      {syncing === "tx" ? "Syncing…" : "↑ Sync Transcript from Teams"}
                    </button>
                  )}

                  {txStatus && (
                    <p style={{ marginTop: 10, fontSize: 12, color: "#64748b", textAlign: "center" }}>
                      Teams transcript sync: <strong>{txStatus}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* ══ AI SUMMARY TAB — Coming Soon ══ */}
              {tab === "ai" && (
                <div style={{ textAlign: "center", padding: "48px 24px" }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
                  <div style={{ fontWeight: 800, fontSize: 17, color: "#0f172a", marginBottom: 10 }}>
                    AI Summary — Coming Soon
                  </div>
                  <div style={{
                    fontSize: 13, color: "#64748b", maxWidth: 360, margin: "0 auto",
                    lineHeight: 1.75, background: "#f8fafc", borderRadius: 12,
                    padding: "14px 18px", border: "1px solid #e2e8f0",
                  }}>
                    AI-powered meeting summaries, key decisions, risks, and action items will be
                    available once the Groq API key is configured.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function SectionHeading({ dot, color, label }: { dot: string; color: string; label: string }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, display: "inline-block", flexShrink: 0 }} />
      {label}
    </div>
  );
}

function Avatar({ name, color, textColor }: { name: string; color: string; textColor?: string }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      background: color, color: textColor || "#fff", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, fontWeight: 700,
    }}>
      {initials(name)}
    </div>
  );
}

function SourceChip({ source }: { source: string }) {
  const isGraph = source === "Graph";
  return (
    <span style={{
      display: "inline-block", marginTop: 3, fontSize: 10, padding: "2px 7px",
      borderRadius: 6, fontWeight: 600,
      background: isGraph ? "#ede9fe" : "#e0f2fe",
      color: isGraph ? "#7c3aed" : "#0891b2",
    }}>
      {source}
    </span>
  );
}

export default MeetingDetailModal;
