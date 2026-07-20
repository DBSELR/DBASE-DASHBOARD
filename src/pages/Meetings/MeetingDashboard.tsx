import React, { useEffect, useState, useMemo } from "react";
import { useHistory } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import axios from "axios";
import moment from "moment";
import { API_BASE } from "../../config";
import { IonIcon, IonSelect, IonSelectOption, IonPage, IonContent } from "@ionic/react";
import { calendarOutline, documentTextOutline, layersOutline, personOutline, syncOutline, peopleOutline, chatbubbleEllipsesOutline } from "ionicons/icons";
import TranscriptModal from "../../components/TranscriptModal";
import AttendanceModal from "../../components/AttendanceModal";
import "./MeetingList.css";
import "./MeetingDashboard.css";

const generateMonthList = () => {
  const months: string[] = [];
  const startYear = 2014;
  const current = moment().add(1, "month");
  const currentYear = current.year();
  for (let y = currentYear; y >= startYear; y--) {
    const endMonth = y === currentYear ? current.month() : 11;
    for (let m = endMonth; m >= 0; m--) {
      months.push(moment().year(y).month(m).format("MMM-YYYY"));
    }
  }
  return months;
};

interface Meeting {
  id: number;
  financialYear?: string;
  monthName?: string;
  meetingDate?: string;
  meetingStatus?: string;
  projectName?: string;
  meetingType?: string;
  meetingOwner?: string;
  attachment?: string;
  frequencyType?: string;
  participants?: string;
  teamsMeetingUrl?: string;
}

const getFileUrl = (path?: string) => {
  if (!path) return "#";
  const root = API_BASE ? API_BASE.replace(/\/api\/?$/i, "") : "";
  return `${root}${path}`;
};

const getUser = () => {
  try {
    const stored = localStorage.getItem("user") || localStorage.getItem("userData");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  Completed:    { label: "✓",        bg: "#dcfce7", color: "#15803d", border: "#86efac" },
  Failed:       { label: "✗ Fail",   bg: "#fef2f2", color: "#dc2626", border: "#fca5a5" },
  NoAttendance: { label: "None",     bg: "#fef9c3", color: "#92400e", border: "#fde68a" },
  NoTranscript: { label: "None",     bg: "#fef9c3", color: "#92400e", border: "#fde68a" },
  Pending:      { label: "Pending",  bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1" },
};

function parseMeetingDate(rawDate?: string | null) {
  if (!rawDate) return null;
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return null;
  return {
    day: d.toLocaleDateString("en-GB", { day: "2-digit" }),
    mon: d.toLocaleDateString("en-GB", { month: "short" }),
    fmt: d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }),
  };
}

function statusBadgeClass(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "completed") return "mdash-status-badge mdash-status-completed";
  if (s === "escalated") return "mdash-status-badge mdash-status-escalated";
  if (s === "pending")   return "mdash-status-badge mdash-status-pending";
  return "mdash-status-badge mdash-status-default";
}

function MeetingDashboard() {
  const history = useHistory();
  const [meetings, setMeetings]             = useState<Meeting[]>([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [attendanceCounts, setAttendanceCounts] = useState<Record<number, number>>({});
  const [viewTranscriptId, setViewTranscriptId] = useState<number | null>(null);
  const [viewAttendanceId, setViewAttendanceId] = useState<number | null>(null);

  const user    = getUser();
  const empCode = String(user.EmpCode || user.empCode || user.Username || user.username || "");

  const [monthsList, setMonthsList]     = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => moment().format("MMM-YYYY"));
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedCard, setSelectedCard]   = useState<string>("Total");

  const projects = ["Beat", "Boat", "Unicode", "React"];

  useEffect(() => {
    const list = generateMonthList();
    setMonthsList(list);
    if (!selectedMonth) setSelectedMonth(list[0]);
  }, [selectedMonth]);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const base  = API_BASE ? API_BASE.replace(/\/$/, "") : "";
      const token = localStorage.getItem("token") || "";
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [meetingsRes, countsRes] = await Promise.all([
        axios.get(`${base}/Meeting/GetMeetings`, { headers }),
        axios.get(`${base}/Meeting/GetAttendanceCounts`, { headers }),
      ]);

      setMeetings(meetingsRes?.data ?? []);

      const countsMap: Record<number, number> = {};
      (countsRes?.data ?? []).forEach((c: any) => {
        countsMap[Number(c.meetingId)] = c.count;
      });
      setAttendanceCounts(countsMap);
    } catch (err: any) {
      setError((err && err.message) || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAttendance = async (meetingId: number) => {
    try {
      const base  = API_BASE ? API_BASE.replace(/\/$/, "") : "";
      const token = localStorage.getItem("token") || "";
      const res   = await axios.post(
        `${base}/Meeting/SyncAttendance?meetingMasterId=${meetingId}`,
        {},
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      alert(res?.data?.message || "Sync complete");
      loadDashboard();
    } catch (err: any) {
      alert("Sync failed: " + (err?.response?.data?.message || err?.message));
    }
  };

  const handleSyncTranscript = async (meetingId: number) => {
    try {
      const base  = API_BASE ? API_BASE.replace(/\/$/, "") : "";
      const token = localStorage.getItem("token") || "";
      const res   = await axios.post(
        `${base}/Meeting/SyncTranscript?meetingMasterId=${meetingId}`,
        {},
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      alert(res?.data?.message || "Transcript sync complete");
    } catch (err: any) {
      alert("Transcript sync failed: " + (err?.response?.data?.message || err?.message));
    }
  };

  const handleJoinMeeting = async (meetingId: number, teamsUrl: string) => {
    try {
      const base  = API_BASE ? API_BASE.replace(/\/$/, "") : "";
      const token = localStorage.getItem("token") || "";
      await axios.post(
        `${base}/Meeting/MarkAttendance`,
        { meetingId, empCode: Number(empCode) || 0 },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
    } catch (err) {
      console.error("Attendance mark failed:", err);
    }
    window.open(teamsUrl, "_blank");
  };

  const dashboard = useMemo(() => {
    let filtered = meetings;
    if (selectedMonth) {
      const [filterMonth, filterYear] = selectedMonth.split("-");
      const fullFilterMonth = moment(filterMonth, "MMM").format("MMMM").toLowerCase();
      filtered = filtered.filter(
        m => m.monthName?.toLowerCase() === fullFilterMonth && m.financialYear === filterYear,
      );
    }
    if (selectedProject) {
      filtered = filtered.filter(m => m.projectName === selectedProject);
    }
    return {
      filteredMeetings:  filtered,
      totalMeetings:     filtered.length,
      completedMeetings: filtered.filter(m => m.meetingStatus === "Completed").length,
      pendingMeetings:   filtered.filter(m => m.meetingStatus === "Pending").length,
      escalatedMeetings: filtered.filter(m => m.meetingStatus === "Escalated").length,
    };
  }, [meetings, selectedMonth, selectedProject]);

  const displayedMeetings = useMemo(() => {
    if (selectedCard === "Total")     return dashboard.filteredMeetings;
    if (selectedCard === "Completed") return dashboard.filteredMeetings.filter(m => m.meetingStatus === "Completed");
    if (selectedCard === "Pending")   return dashboard.filteredMeetings.filter(m => m.meetingStatus === "Pending");
    if (selectedCard === "Escalated") return dashboard.filteredMeetings.filter(m => m.meetingStatus === "Escalated");
    return [];
  }, [dashboard, selectedCard]);

  return (
    <>
    <IonPage>
      <IonContent>
        <div className="mdash-page" style={{ padding: "16px", paddingBottom: "100px", maxWidth: "1200px", margin: "0 auto" }}>

          {/* ── Custom Premium Header ── */}
          <div className="page-wr-header" style={{ marginBottom: '16px' }}>
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()}>
                <ChevronLeft size={22} color="white" />
              </button>
              <div>
                <h1 className="page-wr-title">Meeting Dashboard</h1>
                <p className="page-wr-subtitle">Analytics and status tracking</p>
              </div>
            </div>
          </div>

          {/* ── Filters ── */}
          <div style={{ marginBottom: '20px', display: 'flex', overflowX: 'auto', paddingBottom: '4px', gap: '16px' }}>
            <div className="custom-dropdown-container" style={{ minWidth: '180px' }}>
              <div className="premium-filter-trigger">
                <div className="trigger-content">
                  <div className="trigger-icon-box">
                    <IonIcon icon={calendarOutline} />
                  </div>
                  <div className="trigger-text-sec">
                    <span className="trigger-sub">PERIOD</span>
                    <span className="trigger-main">{selectedMonth}</span>
                  </div>
                </div>
                <IonIcon icon={layersOutline} className="trigger-icon-arrow" />
                <IonSelect
                  className="hidden-select-overlay"
                  interface="popover"
                  value={selectedMonth}
                  onIonChange={e => { if (e.detail.value) setSelectedMonth(e.detail.value); }}
                >
                  {monthsList.map(m => (
                    <IonSelectOption key={m} value={m}>{m}</IonSelectOption>
                  ))}
                </IonSelect>
              </div>
            </div>

            <div className="custom-dropdown-container" style={{ minWidth: '180px' }}>
              <div className="premium-filter-trigger">
                <div className="trigger-content">
                  <div className="trigger-text-sec">
                    <span className="trigger-sub">PROJECT</span>
                    <span className="trigger-main" style={{ color: selectedProject ? "#f97316" : "#0f172a" }}>
                      {selectedProject || "All Projects"}
                    </span>
                  </div>
                </div>
                <IonIcon icon={layersOutline} className="trigger-icon-arrow" />
                <IonSelect
                  className="hidden-select-overlay"
                  interface="popover"
                  value={selectedProject}
                  onIonChange={e => setSelectedProject(e.detail.value)}
                >
                  <IonSelectOption value="">All Projects</IonSelectOption>
                  {projects.map(p => (
                    <IonSelectOption key={p} value={p}>{p}</IonSelectOption>
                  ))}
                </IonSelect>
              </div>
            </div>
          </div>

        {loading && <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading dashboard…</div>}
        {error   && <div style={{ padding: "16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, color: "#dc2626" }}>{error}</div>}

        {!loading && !error && (
          <>
            {/* ── Stat Cards ── */}
            <div className="mdash-stat-row">
              <div
                className={`mdash-stat mdash-stat-total${selectedCard === "Total" ? " mdash-active" : ""}`}
                onClick={() => setSelectedCard("Total")}
              >
                <span className="mdash-stat-emoji">📋</span>
                <div className="mdash-stat-label">Total Meetings</div>
                <div className="mdash-stat-num">{dashboard.totalMeetings}</div>
              </div>

              <div
                className={`mdash-stat mdash-stat-done${selectedCard === "Completed" ? " mdash-active" : ""}`}
                onClick={() => setSelectedCard("Completed")}
              >
                <span className="mdash-stat-emoji">✅</span>
                <div className="mdash-stat-label">Completed</div>
                <div className="mdash-stat-num">{dashboard.completedMeetings}</div>
              </div>

              <div
                className={`mdash-stat mdash-stat-pend${selectedCard === "Pending" ? " mdash-active" : ""}`}
                onClick={() => setSelectedCard("Pending")}
              >
                <span className="mdash-stat-emoji">⏳</span>
                <div className="mdash-stat-label">Pending</div>
                <div className="mdash-stat-num">{dashboard.pendingMeetings}</div>
              </div>

              <div
                className={`mdash-stat mdash-stat-esc${selectedCard === "Escalated" ? " mdash-active" : ""}`}
                onClick={() => setSelectedCard("Escalated")}
              >
                <span className="mdash-stat-emoji">🚨</span>
                <div className="mdash-stat-label">Escalated</div>
                <div className="mdash-stat-num">{dashboard.escalatedMeetings}</div>
              </div>
            </div>

            {/* ── Section header ── */}
            <div className="mdash-section-hdr">
              <h2 className="mdash-section-title">{selectedCard} Meetings</h2>
              <span className="mdash-section-chip">{displayedMeetings.length}</span>
            </div>

            {displayedMeetings.length === 0 ? (
              <div className="mdash-empty">No meetings found for {selectedCard}.</div>
            ) : (
              <>
                {/* ════════════════════════════════════════
                    RESPONSIVE PREMIUM CARDS
                    ════════════════════════════════════════ */}
                <div className="meeting-list-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', paddingBottom: '80px' }}>
                  {displayedMeetings.map((item, idx) => {
                    const mAttachment = item.attachment || (item as any).Attachment;
                    const mYear       = item.financialYear || (item as any).FinancialYear || "";
                    const mMonth      = item.monthName     || (item as any).MonthName     || "";
                    const mFrequency  = item.frequencyType || (item as any).FrequencyType || "-";
                    const mMeetingType = item.meetingType  || (item as any).MeetingType   || "-";
                    const mOwnerRaw   = item.meetingOwner || "-";
                    const mPartRaw    = item.participants || (item as any).Participants || "-";
                    const teamsUrl    = item.teamsMeetingUrl || (item as any).TeamsMeetingUrl || "";
                    const rawDate     = item.meetingDate || (item as any).MeetingDate || null;
                    const dateInfo    = parseMeetingDate(rawDate);
                    
                    const attStatus   = (item as any).AttendanceSyncStatus || (item as any).attendanceSyncStatus || null;
                    const txStatus    = (item as any).TranscriptSyncStatus  || (item as any).transcriptSyncStatus  || null;
                    const attBadge    = STATUS_BADGE[attStatus] ?? null;
                    const txBadge     = STATUS_BADGE[txStatus]  ?? null;
                    
                    const mStatus     = item.meetingStatus || "Pending";
                    const mApproved   = mStatus.toLowerCase() === 'completed';
                    const mRejected   = mStatus.toLowerCase() === 'escalated';

                    return (
                      <div key={`${item.id}-${idx}`} style={{ padding: "12px", background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "3px", background: mApproved ? "#10b981" : mRejected ? "#ef4444" : "#f59e0b" }} />
                        
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingLeft: "6px" }}>
                          <div style={{ flex: 1, paddingRight: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.2px" }}>{mMeetingType}</h3>
                              <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", background: "#f1f5f9", padding: "2px 5px", borderRadius: "4px" }}>#{item.id}</span>
                            </div>
                            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
                              <IonIcon icon={calendarOutline} style={{ fontSize: "12px", color: "#94a3b8" }} />
                              {dateInfo ? dateInfo.fmt : `${mMonth} ${mYear}`}
                            </div>
                          </div>

                          <span
                            style={{
                              fontSize: "10px", fontWeight: 700, textTransform: "uppercase", padding: "4px 8px", borderRadius: "12px",
                              background: mApproved ? "#dcfce7" : mRejected ? "#fee2e2" : "#fef9c3",
                              color: mApproved ? "#059669" : mRejected ? "#dc2626" : "#b45309",
                              letterSpacing: "0.3px", flexShrink: 0
                            }}
                          >
                            {mStatus}
                          </span>
                        </div>
                        
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            alignItems: "stretch",
                            paddingLeft: "6px"
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px", background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <IonIcon icon={personOutline} style={{ color: "#64748b", fontSize: "14px" }} />
                              <span style={{ fontSize: "12px", color: "#64748b", width: "65px", fontWeight: 600 }}>Owner</span>
                              <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: 700 }}>{mOwnerRaw}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <IonIcon icon={syncOutline} style={{ color: "#64748b", fontSize: "14px" }} />
                              <span style={{ fontSize: "12px", color: "#64748b", width: "65px", fontWeight: 600 }}>Freq</span>
                              <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: 600 }}>{mFrequency}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                              <IonIcon icon={peopleOutline} style={{ color: "#64748b", fontSize: "14px", marginTop: "1px" }} />
                              <span style={{ fontSize: "12px", color: "#64748b", width: "65px", fontWeight: 600, flexShrink: 0 }}>People</span>
                              <span style={{ fontSize: "12px", color: "#0f172a", fontWeight: 600, lineHeight: 1.3 }}>{mPartRaw}</span>
                            </div>
                            {item.projectName && (
                              <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginTop: "4px", paddingTop: "8px", borderTop: "1px dashed #e2e8f0" }}>
                                <IonIcon icon={layersOutline} style={{ color: "#64748b", fontSize: "14px", marginTop: "1px", flexShrink: 0 }} />
                                <span style={{ fontSize: "12px", color: "#475569", fontStyle: "italic", lineHeight: 1.3 }}>Project: {item.projectName}</span>
                              </div>
                            )}
                          </div>

                          {/* Sync Buttons */}
                          {((item as any).GraphMeetingId || item.teamsMeetingUrl) && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, paddingTop: "8px" }}>
                              <button
                                onClick={() => handleSyncAttendance(item.id)}
                                title="Sync attendance"
                                style={{ padding: "6px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: "bold" }}
                              >
                                ↑ Sync Att.
                              </button>
                              <button
                                onClick={() => setViewAttendanceId(item.id)}
                                style={{ padding: "6px", background: attBadge?.bg ?? "#ede9fe", color: attBadge?.color ?? "#7c3aed", border: `1px solid ${attBadge?.border ?? "#c4b5fd"}`, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: "bold" }}
                              >
                                👥 {attendanceCounts[item.id] ?? 0} {attBadge?.label ?? "View"}
                              </button>
                              <button
                                onClick={() => handleSyncTranscript(item.id)}
                                title="Sync transcript"
                                style={{ padding: "6px", background: "#0891b2", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: "bold" }}
                              >
                                ↑ Sync Tx.
                              </button>
                              <button
                                onClick={() => setViewTranscriptId(item.id)}
                                style={{ padding: "6px", background: txBadge?.bg ?? "#e0f2fe", color: txBadge?.color ?? "#0891b2", border: `1px solid ${txBadge?.border ?? "#7dd3fc"}`, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: "bold" }}
                              >
                                📝 {txBadge?.label ?? "View"}
                              </button>
                            </div>
                          )}

                          <div
                            style={{
                              paddingTop: "8px",
                              borderTop: "1px solid #f1f5f9",
                              display: "flex",
                              gap: "8px",
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            {mAttachment && (
                              <a
                                href={getFileUrl(mAttachment)}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: "6px",
                                  padding: "8px 12px", background: "#f8fafc", color: "#334155",
                                  border: "1px solid #e2e8f0", borderRadius: "8px",
                                  fontWeight: 700, fontSize: "12px", textDecoration: "none"
                                }}
                              >
                                <IonIcon icon={documentTextOutline} />
                                File
                              </a>
                            )}
                            {teamsUrl && (
                              <button
                                style={{
                                  flex: 1, padding: "8px 12px", background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                                  color: "#fff", border: "none", borderRadius: "8px",
                                  fontWeight: 700, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                                }}
                                onClick={() => handleJoinMeeting(item.id, teamsUrl)}
                              >
                                🔗 Join
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
        </div>
      </IonContent>
    </IonPage>

    <TranscriptModal  meetingId={viewTranscriptId}  onClose={() => setViewTranscriptId(null)} />
    <AttendanceModal  meetingId={viewAttendanceId}  onClose={() => setViewAttendanceId(null)} />
    </>
  );
}

export default MeetingDashboard;
