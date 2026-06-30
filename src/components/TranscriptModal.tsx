import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";

interface TranscriptLine {
  SpeakerName: string;
  TranscriptText: string;
  StartTime?: string | null;
}

interface Props {
  meetingId: number | null;
  onClose: () => void;
}

const SPEAKER_COLORS = [
  "#2563eb", "#7c3aed", "#059669", "#dc2626",
  "#d97706", "#0891b2", "#be185d", "#65a30d",
];

function getSpeakerColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SPEAKER_COLORS[Math.abs(hash) % SPEAKER_COLORS.length];
}

function fmtVttTime(ts?: string | null): string {
  if (!ts) return "";
  // stored as "1900-01-01T00:02:15" — extract HH:MM:SS
  const t = ts.split("T")[1];
  return t ? t.substring(0, 8) : "";
}

function TranscriptModal({ meetingId, onClose }: Props) {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (meetingId === null) return;
    setLoading(true);
    setError(null);
    setLines([]);
    const base = API_BASE ? API_BASE.replace(/\/$/, "") : "";
    const token = localStorage.getItem("token") || "";
    axios
      .get(`${base}/Meeting/GetTranscript?meetingMasterId=${meetingId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then((res) => setLines(res.data ?? []))
      .catch((err) =>
        setError(err?.response?.data?.message || "Failed to load transcript.")
      )
      .finally(() => setLoading(false));
  }, [meetingId]);

  if (meetingId === null) return null;

  // Group consecutive lines by same speaker
  const grouped: { speaker: string; entries: TranscriptLine[] }[] = [];
  for (const ln of lines) {
    const speaker = ln.SpeakerName || "Unknown";
    const prev = grouped[grouped.length - 1];
    if (prev && prev.speaker === speaker) {
      prev.entries.push(ln);
    } else {
      grouped.push({ speaker, entries: [ln] });
    }
  }

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
          background: "#fff", borderRadius: 16, width: "min(700px, 96vw)",
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
            background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>
            📝
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>
              Meeting Transcript
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Meeting #{meetingId}</div>
          </div>
          {!loading && !error && lines.length > 0 && (
            <div style={{
              fontSize: 11, color: "#7c3aed", background: "#ede9fe",
              borderRadius: 20, padding: "3px 10px", fontWeight: 600,
            }}>
              {grouped.length} speaker{grouped.length !== 1 ? "s" : ""} · {lines.length} line{lines.length !== 1 ? "s" : ""}
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
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {loading && (
            <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>
              Loading transcript...
            </div>
          )}
          {error && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 8, padding: 16, color: "#ef4444",
            }}>
              {error}
            </div>
          )}
          {!loading && !error && lines.length === 0 && (
            <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎙️</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No transcript available</div>
              <div style={{ fontSize: 13 }}>
                Sync first, or ensure transcription was enabled during the meeting
                (More Options → Start Transcription).
              </div>
            </div>
          )}
          {!loading && !error && grouped.map((group, gi) => {
            const color = getSpeakerColor(group.speaker);
            const initials = group.speaker
              .split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
            return (
              <div key={gi} style={{ marginBottom: 20 }}>
                {/* Speaker */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%",
                    background: color, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>
                    {initials || "?"}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, color }}>
                    {group.speaker}
                  </span>
                </div>
                {/* Lines */}
                <div style={{ marginLeft: 38 }}>
                  {group.entries.map((ln, li) => (
                    <div key={li} style={{
                      display: "flex", gap: 8, alignItems: "baseline",
                      marginBottom: 5,
                    }}>
                      {fmtVttTime(ln.StartTime) && (
                        <span style={{
                          fontSize: 10, color: "#94a3b8",
                          fontFamily: "monospace", flexShrink: 0, minWidth: 56,
                        }}>
                          {fmtVttTime(ln.StartTime)}
                        </span>
                      )}
                      <span style={{
                        fontSize: 13, color: "#334155", lineHeight: 1.55,
                        background: "#f8fafc",
                        borderRadius: 8, padding: "6px 12px",
                        borderLeft: `3px solid ${color}`,
                        flex: 1,
                      }}>
                        {ln.TranscriptText}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default TranscriptModal;
