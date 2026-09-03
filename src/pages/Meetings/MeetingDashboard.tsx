import React, { useEffect, useState, useMemo } from "react";
import { useHistory } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import axios from "axios";
import moment from "moment";
import { API_BASE } from "../../config";
import { IonIcon, IonSelect, IonSelectOption, IonPage, IonContent } from "@ionic/react";
import { calendarOutline, documentTextOutline, layersOutline, personOutline, syncOutline, peopleOutline } from "ionicons/icons";
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

const safeStr = (val: any, fallback = ""): string => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "object") return fallback;
  const s = String(val).trim();
  return s === "" || s === "null" || s === "undefined" ? fallback : s;
};

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

      const rawMeetings = meetingsRes?.data ?? [];
      const safeMeetings: Meeting[] = (Array.isArray(rawMeetings) ? rawMeetings : []).map((m: any) => ({
        ...m,
        id: Number(m.id || m.Id) || 0,
        meetingType: safeStr(m.meetingType || m.MeetingType, "-"),
        financialYear: safeStr(m.financialYear || m.FinancialYear, ""),
        monthName: safeStr(m.monthName || m.MonthName, ""),
        frequencyType: safeStr(m.frequencyType || m.FrequencyType, "-"),
        meetingStatus: safeStr(m.meetingStatus || m.MeetingStatus, "Pending"),
        remarks: safeStr(m.remarks || m.Remarks, ""),
        escalationRemarks: safeStr(m.escalationRemarks || m.EscalationRemarks, ""),
        meetingOwner: safeStr(m.meetingOwner || m.MeetingOwner, "-"),
        participants: safeStr(m.participants || m.Participants, "-"),
        projectName: safeStr(m.projectName || m.ProjectName, ""),
        weekName: safeStr(m.weekName || m.WeekName, ""),
        teamsMeetingUrl: safeStr(m.teamsMeetingUrl || m.TeamsMeetingUrl, ""),
      }));
      setMeetings(safeMeetings);

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
        <div className="mdash-page">

          {/* ── Custom Premium Header ── */}
          <div className="page-wr-header">
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()} title="Go Back">
                <ChevronLeft size={22} color="white" />
              </button>
              <div>
                <h1 className="page-wr-title">Meeting Dashboard</h1>
                <p className="page-wr-subtitle">Analytics and status tracking</p>
              </div>
            </div>
          </div>

          {/* ── Filters ── */}
          <div className="mdash-filters-wrapper">
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
              <div className={`premium-filter-trigger ${selectedProject ? 'has-value' : ''}`}>
                <div className="trigger-content">
                  <div className="trigger-icon-box trigger-icon-project">
                    <IonIcon icon={layersOutline} />
                  </div>
                  <div className="trigger-text-sec">
                    <span className="trigger-sub">PROJECT</span>
                    <span className="trigger-main project-name-text">
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

        {loading && (
          <div className="mdash-loading-state">
            <div className="mdash-spinner"></div>
            <span>Loading dashboard data…</span>
          </div>
        )}
        
        {error && (
          <div className="mdash-error-state">
            <span className="mdash-error-icon">⚠️</span>
            <span className="mdash-error-text">{error}</span>
            <button className="mdash-retry-btn" onClick={loadDashboard}>Retry</button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ── Stat Cards ── */}
            <div className="mdash-stat-row">
              <div
                className={`mdash-stat mdash-stat-total${selectedCard === "Total" ? " mdash-active" : ""}`}
                onClick={() => setSelectedCard("Total")}
              >
                <div className="mdash-stat-icon-wrapper">
                  <span className="mdash-stat-emoji">📋</span>
                </div>
                <div className="mdash-stat-info">
                  <div className="mdash-stat-label">Total Meetings</div>
                  <div className="mdash-stat-num">{dashboard.totalMeetings}</div>
                </div>
              </div>

              <div
                className={`mdash-stat mdash-stat-done${selectedCard === "Completed" ? " mdash-active" : ""}`}
                onClick={() => setSelectedCard("Completed")}
              >
                <div className="mdash-stat-icon-wrapper">
                  <span className="mdash-stat-emoji">✅</span>
                </div>
                <div className="mdash-stat-info">
                  <div className="mdash-stat-label">Completed</div>
                  <div className="mdash-stat-num">{dashboard.completedMeetings}</div>
                </div>
              </div>

              <div
                className={`mdash-stat mdash-stat-pend${selectedCard === "Pending" ? " mdash-active" : ""}`}
                onClick={() => setSelectedCard("Pending")}
              >
                <div className="mdash-stat-icon-wrapper">
                  <span className="mdash-stat-emoji">⏳</span>
                </div>
                <div className="mdash-stat-info">
                  <div className="mdash-stat-label">Pending</div>
                  <div className="mdash-stat-num">{dashboard.pendingMeetings}</div>
                </div>
              </div>

              <div
                className={`mdash-stat mdash-stat-esc${selectedCard === "Escalated" ? " mdash-active" : ""}`}
                onClick={() => setSelectedCard("Escalated")}
              >
                <div className="mdash-stat-icon-wrapper">
                  <span className="mdash-stat-emoji">🚨</span>
                </div>
                <div className="mdash-stat-info">
                  <div className="mdash-stat-label">Escalated</div>
                  <div className="mdash-stat-num">{dashboard.escalatedMeetings}</div>
                </div>
              </div>
            </div>

            {/* ── Section header ── */}
            <div className="mdash-section-hdr">
              <div className="mdash-section-title-wrap">
                <h2 className="mdash-section-title">{selectedCard} Meetings</h2>
                <span className="mdash-section-chip">{displayedMeetings.length}</span>
              </div>
            </div>

            {displayedMeetings.length === 0 ? (
              <div className="mdash-empty">
                <div className="mdash-empty-icon">📭</div>
                <div className="mdash-empty-title">No meetings found</div>
                <div className="mdash-empty-subtitle">There are no {selectedCard.toLowerCase()} meetings matching the selected filters.</div>
              </div>
            ) : (
              <div className="mdash-meeting-grid">
                {displayedMeetings.map((item, idx) => {
                  const mAttachment = item.attachment || (item as any).Attachment;
                  const mYear       = safeStr(item.financialYear || (item as any).FinancialYear);
                  const mMonth      = safeStr(item.monthName     || (item as any).MonthName);
                  const mFrequency  = safeStr(item.frequencyType || (item as any).FrequencyType, "-");
                  const mMeetingType = safeStr(item.meetingType  || (item as any).MeetingType, "-");
                  const mOwnerRaw   = safeStr(item.meetingOwner || (item as any).MeetingOwner, "-");
                  const mPartRaw    = safeStr(item.participants || (item as any).Participants, "-");
                  const teamsUrl    = safeStr(item.teamsMeetingUrl || (item as any).TeamsMeetingUrl, "");
                  const rawDate     = item.meetingDate || (item as any).MeetingDate || null;
                  const dateInfo    = parseMeetingDate(rawDate);
                  
                  const attStatus   = (item as any).AttendanceSyncStatus || (item as any).attendanceSyncStatus || null;
                  const txStatus    = (item as any).TranscriptSyncStatus  || (item as any).transcriptSyncStatus  || null;
                  const attBadge    = STATUS_BADGE[attStatus] ?? null;
                  const txBadge     = STATUS_BADGE[txStatus]  ?? null;
                  
                  const mStatus     = safeStr(item.meetingStatus, "Pending");
                  const mStatusLower = mStatus.toLowerCase();
                  const statusVariant = mStatusLower === 'completed' ? 'completed' : mStatusLower === 'escalated' ? 'escalated' : 'pending';

                  return (
                    <div key={`${item.id}-${idx}`} className={`mdash-card mdash-card-${statusVariant}`}>
                      <div className="mdash-card-accent-bar" />
                      
                      <div className="mdash-card-header">
                        <div className="mdash-card-title-group">
                          <div className="mdash-card-title-row">
                            <h3 className="mdash-card-type">{mMeetingType}</h3>
                            <span className="mdash-card-id">#{item.id}</span>
                          </div>
                          <div className="mdash-card-date">
                            <IonIcon icon={calendarOutline} className="mdash-date-icon" />
                            <span>{dateInfo ? dateInfo.fmt : `${mMonth} ${mYear}`}</span>
                          </div>
                        </div>

                        <span className={`mdash-status-badge mdash-status-${statusVariant}`}>
                          {mStatus}
                        </span>
                      </div>
                      
                      <div className="mdash-card-body">
                        <div className="mdash-meta-box">
                          <div className="mdash-meta-row">
                            <IonIcon icon={personOutline} className="mdash-meta-icon" />
                            <span className="mdash-meta-label">Owner</span>
                            <span className="mdash-meta-value mdash-meta-owner">{mOwnerRaw}</span>
                          </div>
                          <div className="mdash-meta-row">
                            <IonIcon icon={syncOutline} className="mdash-meta-icon" />
                            <span className="mdash-meta-label">Freq</span>
                            <span className="mdash-meta-value">{mFrequency}</span>
                          </div>
                          <div className="mdash-meta-row mdash-meta-people-row">
                            <IonIcon icon={peopleOutline} className="mdash-meta-icon" />
                            <span className="mdash-meta-label">People</span>
                            <span className="mdash-meta-value mdash-meta-people">{mPartRaw}</span>
                          </div>
                          {Boolean(item.projectName && typeof item.projectName === "string") && (
                            <div className="mdash-meta-project-row">
                              <IonIcon icon={layersOutline} className="mdash-meta-icon" />
                              <span className="mdash-meta-project-text">Project: <strong>{item.projectName}</strong></span>
                            </div>
                          )}
                        </div>

                        {/* Sync Buttons */}
                        {((item as any).GraphMeetingId || item.teamsMeetingUrl) && (
                          <div className="mdash-sync-grid">
                            <button
                              onClick={() => handleSyncAttendance(item.id)}
                              title="Sync attendance"
                              className="mdash-sync-btn mdash-sync-att"
                            >
                              ↑ Sync Att.
                            </button>
                            <button
                              onClick={() => setViewAttendanceId(item.id)}
                              className="mdash-view-btn"
                              style={{
                                background: attBadge?.bg ?? "#ede9fe",
                                color: attBadge?.color ?? "#7c3aed",
                                border: `1px solid ${attBadge?.border ?? "#c4b5fd"}`
                              }}
                            >
                              👥 {attendanceCounts[item.id] ?? 0} {attBadge?.label ?? "View"}
                            </button>
                            <button
                              onClick={() => handleSyncTranscript(item.id)}
                              title="Sync transcript"
                              className="mdash-sync-btn mdash-sync-tx"
                            >
                              ↑ Sync Tx.
                            </button>
                            <button
                              onClick={() => setViewTranscriptId(item.id)}
                              className="mdash-view-btn"
                              style={{
                                background: txBadge?.bg ?? "#e0f2fe",
                                color: txBadge?.color ?? "#0891b2",
                                border: `1px solid ${txBadge?.border ?? "#7dd3fc"}`
                              }}
                            >
                              📝 {txBadge?.label ?? "View"}
                            </button>
                          </div>
                        )}

                        {/* Card Action Footer */}
                        {(mAttachment || teamsUrl) && (
                          <div className="mdash-card-footer">
                            {mAttachment && (
                              <a
                                href={getFileUrl(mAttachment)}
                                target="_blank"
                                rel="noreferrer"
                                className="mdash-file-btn"
                              >
                                <IonIcon icon={documentTextOutline} />
                                <span>File</span>
                              </a>
                            )}
                            {teamsUrl && (
                              <button
                                className="mdash-join-btn"
                                onClick={() => handleJoinMeeting(item.id, teamsUrl)}
                              >
                                <span>🔗</span>
                                <span>Join</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
