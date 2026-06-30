import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";

interface AttendeeRow {
  DisplayName: string;
  Email: string;
  JoinTime?: string | null;
  LeaveTime?: string | null;
  DurationSeconds?: number | null;
  EmpCode?: number | null;
  Source?: string;
}

interface Props {
  meetingId: number | null;
  onClose: () => void;
}

function fmtTime(ts?: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(secs?: number | null): string {
  if (secs == null || secs < 0) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m} min`;
}

function AttendanceModal({ meetingId, onClose }: Props) {
  const [rows, setRows] = useState<AttendeeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (meetingId === null) return;
    setLoading(true);
    setError(null);
    setRows([]);
    const base = API_BASE ? API_BASE.replace(/\/$/, "") : "";
    const token = localStorage.getItem("token") || "";
    axios
      .get(`${base}/Meeting/GetAttendanceDetails?meetingMasterId=${meetingId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then((res) => setRows(res.data ?? []))
      .catch((err) =>
        setError(err?.response?.data?.message || "Failed to load attendance.")
      )
      .finally(() => setLoading(false));
  }, [meetingId]);

  if (meetingId === null) return null;

  const totalMinutes = rows.reduce((sum, r) => sum + (r.DurationSeconds ?? 0), 0);
  const avgMinutes = rows.length > 0 ? Math.round(totalMinutes / rows.length / 60) : 0;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15,23,42,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(2px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff", borderRadius: 16, width: "min(680px, 96vw)",
          maxHeight: "85vh", display: "flex", flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "16px 20px", borderBottom: "1px solid #e2e8f0",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "#dcfce7", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 18,
          }}>
            👥
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>
              Teams Attendance
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Meeting #{meetingId}</div>
          </div>
          {!loading && !error && rows.length > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{
                fontSize: 11, background: "#dcfce7", color: "#16a34a",
                borderRadius: 20, padding: "3px 10px", fontWeight: 600,
              }}>
                {rows.length} attendee{rows.length !== 1 ? "s" : ""}
              </span>
              {avgMinutes > 0 && (
                <span style={{
                  fontSize: 11, background: "#e0f2fe", color: "#0369a1",
                  borderRadius: 20, padding: "3px 10px", fontWeight: 600,
                }}>
                  avg {avgMinutes} min
                </span>
              )}
            </div>
          )}
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 18, color: "#94a3b8", lineHeight: 1, padding: "4px 6px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0" }}>
          {loading && (
            <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>
              Loading attendance...
            </div>
          )}
          {error && (
            <div style={{
              margin: 20, background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 8, padding: 16, color: "#ef4444",
            }}>
              {error}
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No attendance data</div>
              <div style={{ fontSize: 13 }}>
                Sync attendance first. Make sure the meeting is completed in Teams.
              </div>
            </div>
          )}
          {!loading && !error && rows.length > 0 && (
            <table style={{
              width: "100%", borderCollapse: "collapse",
              fontSize: 13,
            }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  <th style={th}>#</th>
                  <th style={th}>Name</th>
                  <th style={th}>Join</th>
                  <th style={th}>Leave</th>
                  <th style={th}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const dur = row.DurationSeconds ?? 0;
                  const maxDur = Math.max(...rows.map((r) => r.DurationSeconds ?? 0));
                  const pct = maxDur > 0 ? Math.round((dur / maxDur) * 100) : 0;
                  return (
                    <tr key={i} style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: i % 2 === 0 ? "#fff" : "#fafafa",
                    }}>
                      <td style={{ ...td, color: "#94a3b8", width: 32 }}>{i + 1}</td>
                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: "50%",
                            background: "#e0f2fe", color: "#0369a1",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700, flexShrink: 0,
                          }}>
                            {(row.DisplayName || row.Email || "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "#0f172a" }}>
                              {row.DisplayName || "—"}
                            </div>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>
                              {row.Email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...td, color: "#059669", fontWeight: 600 }}>
                        {fmtTime(row.JoinTime)}
                      </td>
                      <td style={{ ...td, color: "#dc2626", fontWeight: 600 }}>
                        {fmtTime(row.LeaveTime)}
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 600, minWidth: 48 }}>
                            {fmtDuration(row.DurationSeconds)}
                          </span>
                          <div style={{
                            flex: 1, height: 4, background: "#e2e8f0", borderRadius: 2, minWidth: 40,
                          }}>
                            <div style={{
                              height: 4, background: "#10b981", borderRadius: 2,
                              width: `${pct}%`,
                            }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "10px 14px", textAlign: "left",
  fontSize: 11, fontWeight: 700,
  color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px",
};

const td: React.CSSProperties = {
  padding: "10px 14px", verticalAlign: "middle",
};

export default AttendanceModal;
