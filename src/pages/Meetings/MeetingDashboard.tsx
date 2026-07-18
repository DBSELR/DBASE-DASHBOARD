import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import moment from "moment";
import { API_BASE } from "../../config";
import { IonIcon, IonSelect, IonSelectOption } from "@ionic/react";
import { calendarOutline, documentTextOutline, layersOutline } from "ionicons/icons";
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
      <div className="mdash-page">

        {/* ── Title ── */}
        <h1 className="mdash-title">Meeting Dashboard</h1>

        {/* ── Filters ── */}
        <div className="mdash-filters">
          <div className="custom-dropdown-container">
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

          <div className="custom-dropdown-container">
            <div className="premium-filter-trigger">
              <div className="trigger-content">
                <div className="trigger-text-sec">
                  <span className="trigger-sub">PROJECT</span>
                  <span className="trigger-main" style={{ color: selectedProject ? "#f97316" : "#64748b" }}>
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
                    DESKTOP TABLE
                    ════════════════════════════════════════ */}
                <div className="mdash-tbl-wrap">
                  <table className="meeting-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Period</th>
                        <th>Frequency</th>
                        <th>Meeting Type</th>
                        <th>Owner</th>
                        <th>Participants</th>
                        <th>Status</th>
                        <th>Project</th>
                        <th>Attachment</th>
                        <th>Teams</th>
                        <th>Attended</th>
                        <th>Sync</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedMeetings.map(item => {
                        const mAttachment = item.attachment || (item as any).Attachment;
                        const mYear       = item.financialYear || (item as any).FinancialYear || "";
                        const mMonth      = item.monthName     || (item as any).MonthName     || "";
                        const mFrequency  = item.frequencyType || (item as any).FrequencyType || "-";
                        const teamsUrl    = item.teamsMeetingUrl || (item as any).TeamsMeetingUrl || "";
                        const rawDate     = item.meetingDate || (item as any).MeetingDate || null;
                        const dateInfo    = parseMeetingDate(rawDate);
                        const attStatus   = (item as any).AttendanceSyncStatus || (item as any).attendanceSyncStatus || null;
                        const txStatus    = (item as any).TranscriptSyncStatus  || (item as any).transcriptSyncStatus  || null;
                        const attBadge    = STATUS_BADGE[attStatus] ?? null;
                        const txBadge     = STATUS_BADGE[txStatus]  ?? null;
                        const mStatus     = item.meetingStatus || "Pending";

                        return (
                          <tr key={item.id}>
                            <td style={{ color: "#94a3b8", fontWeight: 600, fontSize: 12 }}>{item.id}</td>
                            <td>
                              <div style={{ lineHeight: 1.5 }}>
                                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>
                                  {mMonth} {mYear}
                                </div>
                                {dateInfo && (
                                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                                    {dateInfo.fmt}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>{mFrequency}</td>
                            <td style={{ fontWeight: 600 }}>{item.meetingType}</td>
                            <td>{item.meetingOwner}</td>
                            <td style={{ color: "#64748b" }}>{item.participants || (item as any).Participants || "-"}</td>
                            <td>
                              <span style={{
                                padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                                background:
                                  mStatus === "Completed" ? "#dcfce7" :
                                  mStatus === "Escalated" ? "#fee2e2" : "#fef9c3",
                                color:
                                  mStatus === "Completed" ? "#15803d" :
                                  mStatus === "Escalated" ? "#b91c1c" : "#92400e",
                              }}>
                                {mStatus}
                              </span>
                            </td>
                            <td>{item.projectName || "-"}</td>
                            <td>
                              {mAttachment ? (
                                <a href={getFileUrl(mAttachment)} target="_blank" rel="noreferrer" className="view-file-btn">
                                  <IonIcon icon={documentTextOutline} />
                                  View
                                </a>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                              )}
                            </td>
                            <td>
                              {teamsUrl ? (
                                <button
                                  onClick={() => handleJoinMeeting(item.id, teamsUrl)}
                                  style={{
                                    padding: "6px 12px", background: "#2563eb", color: "#fff",
                                    border: "none", borderRadius: 7, cursor: "pointer",
                                    fontWeight: 700, fontSize: 12, fontFamily: "inherit",
                                  }}
                                >
                                  Join
                                </button>
                              ) : (
                                <span style={{ color: "#94a3b8" }}>—</span>
                              )}
                            </td>
                            <td>
                              <span style={{
                                display: "inline-block", padding: "3px 10px", borderRadius: 12,
                                background: attendanceCounts[item.id] ? "#dcfce7" : "#f1f5f9",
                                color: attendanceCounts[item.id] ? "#16a34a" : "#94a3b8",
                                fontWeight: "bold", fontSize: 13,
                              }}>
                                {attendanceCounts[item.id] ?? 0}
                              </span>
                            </td>
                            <td>
                              {((item as any).GraphMeetingId || item.teamsMeetingUrl) && (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, minWidth: 130 }}>
                                  <button
                                    onClick={() => handleSyncAttendance(item.id)}
                                    title="Sync attendance"
                                    style={{ padding: "4px 6px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 10, fontWeight: "bold" }}
                                  >
                                    ↑ Sync
                                  </button>
                                  <button
                                    onClick={() => setViewAttendanceId(item.id)}
                                    title={attStatus ? `Attendance: ${attStatus}` : "View attendance"}
                                    style={{ padding: "4px 6px", background: attBadge?.bg ?? "#ede9fe", color: attBadge?.color ?? "#7c3aed", border: `1px solid ${attBadge?.border ?? "#c4b5fd"}`, borderRadius: 5, cursor: "pointer", fontSize: 10, fontWeight: "bold" }}
                                  >
                                    👥 {attBadge?.label ?? "View"}
                                  </button>
                                  <button
                                    onClick={() => handleSyncTranscript(item.id)}
                                    title="Sync transcript"
                                    style={{ padding: "4px 6px", background: "#0891b2", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 10, fontWeight: "bold" }}
                                  >
                                    ↑ Sync
                                  </button>
                                  <button
                                    onClick={() => setViewTranscriptId(item.id)}
                                    title={txStatus ? `Transcript: ${txStatus}` : "View transcript"}
                                    style={{ padding: "4px 6px", background: txBadge?.bg ?? "#e0f2fe", color: txBadge?.color ?? "#0891b2", border: `1px solid ${txBadge?.border ?? "#7dd3fc"}`, borderRadius: 5, cursor: "pointer", fontSize: 10, fontWeight: "bold" }}
                                  >
                                    📝 {txBadge?.label ?? "View"}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ════════════════════════════════════════
                    MOBILE CARDS
                    ════════════════════════════════════════ */}
                <div className="mdash-cards">
                  {displayedMeetings.map(item => {
                    const mAttachment = item.attachment || (item as any).Attachment;
                    const mYear       = item.financialYear || (item as any).FinancialYear || "";
                    const mMonth      = item.monthName     || (item as any).MonthName     || "";
                    const teamsUrl    = item.teamsMeetingUrl || (item as any).TeamsMeetingUrl || "";
                    const rawDate     = item.meetingDate || (item as any).MeetingDate || null;
                    const dateInfo    = parseMeetingDate(rawDate);
                    const attStatus   = (item as any).AttendanceSyncStatus || (item as any).attendanceSyncStatus || null;
                    const txStatus    = (item as any).TranscriptSyncStatus  || (item as any).transcriptSyncStatus  || null;
                    const attBadge    = STATUS_BADGE[attStatus] ?? null;
                    const txBadge     = STATUS_BADGE[txStatus]  ?? null;
                    const hasSync     = !!(((item as any).GraphMeetingId || item.teamsMeetingUrl));

                    return (
                      <div className="mdash-card" key={item.id}>
                        {/* Top: date + type + status */}
                        <div className="mdash-card-top">
                          {dateInfo ? (
                            <div className="mdash-date-badge">
                              <span className="mdash-date-day">{dateInfo.day}</span>
                              <span className="mdash-date-mon">{dateInfo.mon}</span>
                            </div>
                          ) : (
                            <div className="mdash-date-badge mdash-date-badge-none">
                              <span className="mdash-date-day" style={{ fontSize: 14 }}>—</span>
                            </div>
                          )}
                          <div className="mdash-card-info">
                            <div className="mdash-card-type">
                              {item.meetingType || "-"}
                            </div>
                            <div className="mdash-card-period">{mMonth} {mYear}</div>
                          </div>
                          <span className={statusBadgeClass(item.meetingStatus)}>
                            {item.meetingStatus || "Pending"}
                          </span>
                        </div>

                        {/* Meta grid */}
                        <div className="mdash-card-meta">
                          <div className="mdash-meta-item">
                            <span className="mdash-meta-label">Owner</span>
                            <span className="mdash-meta-val">{item.meetingOwner || "-"}</span>
                          </div>
                          <div className="mdash-meta-item">
                            <span className="mdash-meta-label">Attended</span>
                            <span className="mdash-meta-val" style={{ color: attendanceCounts[item.id] ? "#16a34a" : "#94a3b8", fontWeight: 700 }}>
                              {attendanceCounts[item.id] ?? 0}
                            </span>
                          </div>
                          {item.projectName && (
                            <div className="mdash-meta-item">
                              <span className="mdash-meta-label">Project</span>
                              <span className="mdash-meta-val">{item.projectName}</span>
                            </div>
                          )}
                          {item.frequencyType && (
                            <div className="mdash-meta-item">
                              <span className="mdash-meta-label">Frequency</span>
                              <span className="mdash-meta-val">{item.frequencyType || (item as any).FrequencyType}</span>
                            </div>
                          )}
                        </div>

                        {/* Footer: file + join */}
                        <div className="mdash-card-footer">
                          {mAttachment && (
                            <a
                              href={getFileUrl(mAttachment)}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#2563eb", fontWeight: 600, textDecoration: "none", padding: "7px 12px", background: "#eff6ff", borderRadius: 9 }}
                            >
                              <IonIcon icon={documentTextOutline} />
                              File
                            </a>
                          )}
                          {teamsUrl && (
                            <button className="mdash-btn-join" onClick={() => handleJoinMeeting(item.id, teamsUrl)}>
                              🔗 Join
                            </button>
                          )}
                        </div>

                        {/* Sync section */}
                        {hasSync && (
                          <div className="mdash-card-sync">
                            <div className="mdash-card-sync-lbl">Sync</div>
                            <button className="mdash-btn-sync-att" onClick={() => handleSyncAttendance(item.id)}>
                              ↑ Attendance
                            </button>
                            <button
                              className="mdash-btn-view"
                              onClick={() => setViewAttendanceId(item.id)}
                              style={{ background: attBadge?.bg ?? "#ede9fe", color: attBadge?.color ?? "#7c3aed", borderColor: attBadge?.border ?? "#c4b5fd" }}
                            >
                              👥 {attBadge?.label ?? "View"}
                            </button>
                            <button className="mdash-btn-sync-tx" onClick={() => handleSyncTranscript(item.id)}>
                              ↑ Transcript
                            </button>
                            <button
                              className="mdash-btn-view"
                              onClick={() => setViewTranscriptId(item.id)}
                              style={{ background: txBadge?.bg ?? "#e0f2fe", color: txBadge?.color ?? "#0891b2", borderColor: txBadge?.border ?? "#7dd3fc" }}
                            >
                              📝 {txBadge?.label ?? "View"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <TranscriptModal  meetingId={viewTranscriptId}  onClose={() => setViewTranscriptId(null)} />
      <AttendanceModal  meetingId={viewAttendanceId}  onClose={() => setViewAttendanceId(null)} />
    </>
  );
}

export default MeetingDashboard;
