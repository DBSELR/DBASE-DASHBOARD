import React, { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import axios from "axios";
import moment from "moment";
import { API_BASE } from "../../config";
import { IonIcon, IonSelect, IonSelectOption, IonPage, IonContent } from "@ionic/react";
import { calendarOutline, documentTextOutline, layersOutline, personOutline, syncOutline, peopleOutline, chatbubbleEllipsesOutline } from "ionicons/icons";
import "./MeetingList.css";
import MeetingDetailModal from "../../components/MeetingDetailModal";

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
  weekName?: string;
  meetingDate?: string;
  meetingType?: string;
  participants?: string;
  frequencyType?: string;
  meetingOwner?: string;
  meetingStatus?: string;
  remarks?: string;
  createdBy?: string;
  attachment?: string;
  teamsMeetingUrl?: string;
  graphMeetingId?: string;
  transcriptSyncStatus?: string;
  attendanceSyncStatus?: string;
  // Phase A/E/F
  attendancePercent?: number | null;
  aiSummaryAvailable?: boolean;
  autoCompleted?: boolean;
  meetingStartTime?: string | null;
  meetingEndTime?: string | null;
}

const getUser = () => {
  try {
    const stored = localStorage.getItem("user") || localStorage.getItem("userData");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

function MeetingList() {
  const history = useHistory();
  const [meetings, setMeetings]   = useState<Meeting[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [monthsList, setMonthsList] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => moment().format("MMM-YYYY"));
  const [editStates, setEditStates] = useState<Record<number, { status: string; remarks: string; file: File | null }>>({});
  const [viewDetailId, setViewDetailId]       = useState<number | null>(null);
  const [viewDetailMeeting, setViewDetailMeeting] = useState<Meeting | null>(null);
  const [timeEditId, setTimeEditId]   = useState<number | null>(null);
  const [timeForm, setTimeForm]       = useState<{ startTime: string; endTime: string }>({ startTime: "", endTime: "" });
  const [timeSaving, setTimeSaving]   = useState(false);

  const user    = getUser();
  const empCode = String(user.EmpCode || user.empCode || user.Username || user.username || "");

  const isAdmin = useMemo(() => {
    const role = String(user.userType || user.UserType || user.Username || "").toLowerCase();
    return role === "admin" || role === "accountant" || role === "manager";
  }, [user]);

  const isTeamLeader = useMemo(() => {
    const desig = String(user.Designation || user.designation || "");
    return desig.toLowerCase().startsWith("team leader");
  }, [user]);

  useEffect(() => {
    const list = generateMonthList();
    setMonthsList(list);
    if (!selectedMonth) setSelectedMonth(list[0]);
  }, [selectedMonth]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const base  = API_BASE ? API_BASE.replace(/\/$/, "") : "";
      const token = localStorage.getItem("token") || "";
      const res   = await axios.get(`${base}/Meeting/GetMeetings`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data  = res?.data ?? [];
      setMeetings(data);
      const init: Record<number, { status: string; remarks: string; file: File | null }> = {};
      data.forEach((m: Meeting) => {
        if (m.id) {
          init[m.id] = {
            status: m.meetingStatus || (m as any).MeetingStatus || "Pending",
            remarks: m.remarks || (m as any).Remarks || "",
            file: null,
          };
        }
      });
      setEditStates(init);
    } catch (err: any) {
      setError(err?.message || "Failed to load meetings.");
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  const getParticipants = (m: Meeting) => String(m.participants || (m as any).Participants || "");
  const getMeetingOwner = (m: Meeting) => String(m.meetingOwner || (m as any).MeetingOwner || "");

  const isOwner = (owner?: string) => {
    if (!owner || !empCode) return false;
    return owner.split(",").map(o => o.trim().toLowerCase()).includes(empCode.toLowerCase());
  };

  const isParticipant = (participants?: string) => {
    if (!participants || !empCode) return false;
    return participants.split(",").map(p => p.trim().toLowerCase()).includes(empCode.toLowerCase());
  };

  const getFileUrl = (path?: string) => {
    if (!path) return "#";
    const root = API_BASE ? API_BASE.replace(/\/api\/?$/i, "") : "";
    return `${root}${path}`;
  };

  const handleEditChange = (id: number, key: string, value: any) => {
    setEditStates(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
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

  const handleSave = async (meetingId: number) => {
    const edit = editStates[meetingId];
    if (!edit) return;
    const formData = new FormData();
    formData.append("Id", String(meetingId));
    formData.append("MeetingStatus", edit.status);
    formData.append("Remarks", edit.remarks);
    if (edit.file) formData.append("Attachment", edit.file);
    try {
      const base  = API_BASE ? API_BASE.replace(/\/$/, "") : "";
      const token = localStorage.getItem("token") || "";
      await axios.post(`${base}/Meeting/UpdateMeetingStatus`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      alert("Updated successfully!");
      loadData();
    } catch (err: any) {
      const msg = typeof err.response?.data === "string"
        ? err.response.data
        : err.response?.data?.message || err.message || "Unknown error";
      alert("Failed to update: " + msg);
    }
  };

  const openDetail = (item: Meeting) => {
    setViewDetailId(item.id);
    setViewDetailMeeting(item);
  };

  const closeDetail = () => {
    setViewDetailId(null);
    setViewDetailMeeting(null);
  };

  const openTimeEdit = (item: Meeting) => {
    const toTime = (iso?: string | null) => {
      if (!iso) return "";
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toTimeString().substring(0, 5);
    };
    setTimeForm({ startTime: toTime(item.meetingStartTime), endTime: toTime(item.meetingEndTime) });
    setTimeEditId(item.id);
  };

  const handleUpdateTime = async (item: Meeting) => {
    setTimeSaving(true);
    const base  = API_BASE ? API_BASE.replace(/\/$/, "") : "";
    const token = localStorage.getItem("token") || "";
    const baseDate = item.meetingDate
      ? new Date(item.meetingDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];
    const params = new URLSearchParams({ meetingId: String(item.id) });
    if (timeForm.startTime) params.set("meetingStartTime", `${baseDate}T${timeForm.startTime}:00`);
    if (timeForm.endTime)   params.set("meetingEndTime",   `${baseDate}T${timeForm.endTime}:00`);
    try {
      await axios.post(`${base}/Meeting/UpdateMeetingTime?${params}`, {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setTimeEditId(null);
      loadData();
    } catch (err: any) {
      alert("Failed to update time: " + (err?.response?.data?.message || err?.message || "error"));
    }
    setTimeSaving(false);
  };

  const handleSyncAttendance = async (meetingId: number) => {
    const base  = API_BASE ? API_BASE.replace(/\/$/, "") : "";
    const token = localStorage.getItem("token") || "";
    await axios.post(`${base}/Meeting/SyncAttendance?meetingMasterId=${meetingId}`, {}, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  };

  const handleSyncTranscript = async (meetingId: number) => {
    const base  = API_BASE ? API_BASE.replace(/\/$/, "") : "";
    const token = localStorage.getItem("token") || "";
    await axios.post(`${base}/Meeting/SyncTranscript?meetingMasterId=${meetingId}`, {}, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  };

  const filteredMeetings = useMemo(() => {
    let result = meetings;
    if (!isAdmin) {
      result = result.filter(m => isOwner(getMeetingOwner(m)) || isParticipant(getParticipants(m)));
    }
    if (selectedMonth) {
      const [filterMonth, filterYear] = selectedMonth.split("-");
      const fullFilterMonth = moment(filterMonth, "MMM").format("MMMM").toLowerCase();
      result = result.filter(m => {
        const mMonth = m.monthName || (m as any).MonthName;
        const mYear  = m.financialYear || (m as any).FinancialYear;
        return mMonth?.toLowerCase() === fullFilterMonth && mYear === filterYear;
      });
    }
    return result;
  }, [meetings, selectedMonth, empCode, isAdmin]);

  const hasOwnerMeeting = filteredMeetings.some(m => isOwner(getMeetingOwner(m)));

  /* ── badge class helper ── */
  const badgeClass = (status: string) => {
    const s = status.toLowerCase();
    if (s === "completed") return "mlist-badge mlist-badge-completed";
    if (s === "escalated") return "mlist-badge mlist-badge-escalated";
    if (s === "pending")   return "mlist-badge mlist-badge-pending";
    return "mlist-badge mlist-badge-default";
  };

  /* ── parse date for cards ── */
  const parseMeetingDate = (rawDate?: string | null) => {
    if (!rawDate) return null;
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return null;
    return {
      day: d.toLocaleDateString("en-GB", { day: "2-digit" }),
      mon: d.toLocaleDateString("en-GB", { month: "short" }),
      fmt: d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }),
    };
  };

  return (
    <IonPage>
      <IonContent>
        <div className="mlist-page" style={{ padding: "16px", paddingBottom: "100px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* ── Custom Premium Header ── */}
      <div className="page-wr-header" style={{ marginBottom: '16px' }}>
        <div className="page-wr-header-left">
          <button className="page-wr-back-btn" onClick={() => history.goBack()}>
            <ChevronLeft size={22} color="white" />
          </button>
          <div>
            <h1 className="page-wr-title">Meeting List</h1>
            <p className="page-wr-subtitle">View and manage scheduled meetings</p>
          </div>
        </div>
      </div>

      {/* ── Period Selector Below Header ── */}
      <div style={{ marginBottom: '20px', display: 'flex', overflowX: 'auto', paddingBottom: '4px' }}>
        <div className="custom-dropdown-container" style={{ minWidth: '180px' }}>
          <div className="premium-filter-trigger">
            <div className="trigger-content">
              <div className="trigger-icon-box">
                <IonIcon icon={calendarOutline} />
              </div>
              <div className="trigger-text-sec">
                <span className="trigger-sub">PERIOD</span>
                <span className="trigger-main">{selectedMonth || "Select Month"}</span>
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
      </div>

      {/* ── States ── */}
      {loading && <div className="mlist-loading">Loading meetings…</div>}
      {error   && <div className="mlist-error">{error}</div>}

      {!loading && !error && filteredMeetings.length === 0 && (
        <div className="mlist-empty">
          <span className="mlist-empty-icon">📅</span>
          <span className="mlist-empty-title">No meetings found</span>
        </div>
      )}

      {!loading && !error && filteredMeetings.length > 0 && (
        <>
          <div className="mlist-count">
            Showing <strong>{filteredMeetings.length}</strong> meeting{filteredMeetings.length !== 1 ? "s" : ""} for <strong>{selectedMonth}</strong>
          </div>

          <div className="meeting-list-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', paddingBottom: '80px' }}>
            {filteredMeetings.map((item, idx) => {
              const userIsOwner = isOwner(getMeetingOwner(item));
              const edit        = editStates[item.id] || { status: "", remarks: "", file: null };
              const mYear       = item.financialYear || (item as any).FinancialYear || "";
              const mMonth      = item.monthName     || (item as any).MonthName     || "";
              const mFrequency  = item.frequencyType || (item as any).FrequencyType || "-";
              const mMeetingType = item.meetingType  || (item as any).MeetingType   || "-";
              const mStatus     = item.meetingStatus || (item as any).MeetingStatus || "Pending";
              const mRemarks    = item.remarks       || (item as any).Remarks       || "";
              const mAttachment = item.attachment    || (item as any).Attachment;
              const mOwnerRaw   = getMeetingOwner(item) || "-";
              const mPartRaw    = getParticipants(item) || "-";
              const teamsUrl    = item.teamsMeetingUrl || (item as any).TeamsMeetingUrl || "";
              const rawDate     = item.meetingDate || (item as any).MeetingDate || null;
              const dateInfo    = parseMeetingDate(rawDate);
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
                      {mRemarks && mRemarks !== "-" && (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginTop: "4px", paddingTop: "8px", borderTop: "1px dashed #e2e8f0" }}>
                          <IonIcon icon={chatbubbleEllipsesOutline} style={{ color: "#64748b", fontSize: "14px", marginTop: "1px", flexShrink: 0 }} />
                          <span style={{ fontSize: "12px", color: "#475569", fontStyle: "italic", lineHeight: 1.3 }}>"{mRemarks}"</span>
                        </div>
                      )}
                    </div>

                    {((item.attendancePercent != null && item.attendanceSyncStatus === "Completed") || item.transcriptSyncStatus === "Completed" || item.aiSummaryAvailable) && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "4px 0" }}>
                        {item.attendancePercent != null && item.attendanceSyncStatus === "Completed" && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                            background: item.attendancePercent >= 75 ? "#dcfce7" : item.attendancePercent >= 50 ? "#fef9c3" : "#fee2e2",
                            color:      item.attendancePercent >= 75 ? "#15803d" : item.attendancePercent >= 50 ? "#92400e" : "#b91c1c",
                          }}>
                            {item.attendancePercent}% attended
                          </span>
                        )}
                        {item.transcriptSyncStatus === "Completed" && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#ede9fe", color: "#7c3aed" }}>📝 Transcript</span>
                        )}
                        {item.aiSummaryAvailable && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#fef3c7", color: "#92400e" }}>🤖 AI Ready</span>
                        )}
                      </div>
                    )}

                    {(isAdmin || isTeamLeader) && (
                      <div style={{ padding: "4px 0 2px" }}>
                        {timeEditId !== item.id ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {(item.meetingStartTime || item.meetingEndTime) && (
                              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                                🕐 {item.meetingStartTime ? new Date(item.meetingStartTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "?"}
                                {" – "}
                                {item.meetingEndTime ? new Date(item.meetingEndTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "?"}
                              </span>
                            )}
                            <button onClick={() => openTimeEdit(item)}
                              style={{
                                padding: "5px 12px", background: "#fff7ed", color: "#c2410c",
                                border: "1px solid #fed7aa", borderRadius: 7, cursor: "pointer",
                                fontWeight: 700, fontSize: 12, fontFamily: "inherit",
                              }}>
                              🕐 Edit Time
                            </button>
                          </div>
                        ) : (
                          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", width: 40 }}>Start</label>
                              <input type="time" value={timeForm.startTime}
                                onChange={e => setTimeForm(f => ({ ...f, startTime: e.target.value }))}
                                style={{ flex: 1, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1" }} />
                            </div>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", width: 40 }}>End</label>
                              <input type="time" value={timeForm.endTime}
                                onChange={e => setTimeForm(f => ({ ...f, endTime: e.target.value }))}
                                style={{ flex: 1, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1" }} />
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                              <button onClick={() => handleUpdateTime(item)} disabled={timeSaving}
                                style={{ flex: 1, padding: "8px 0", background: "#059669", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                                {timeSaving ? "Saving…" : "Save Time"}
                              </button>
                              <button onClick={() => setTimeEditId(null)}
                                style={{ padding: "8px 16px", background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, cursor: "pointer" }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div
                      style={{
                        paddingTop: "14px",
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
                            padding: "10px 14px", background: "#f8fafc", color: "#334155",
                            border: "1px solid #e2e8f0", borderRadius: "10px",
                            fontWeight: 700, fontSize: "13px", textDecoration: "none"
                          }}
                        >
                          <IonIcon icon={documentTextOutline} />
                          File
                        </a>
                      )}
                      {teamsUrl && (
                        <button
                          style={{
                            flex: 1, padding: "10px 16px", background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                            color: "#fff", border: "none", borderRadius: "10px",
                            fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                          }}
                          onClick={() => handleJoinMeeting(item.id, teamsUrl)}
                        >
                          🔗 Join
                        </button>
                      )}
                      <button
                        onClick={() => openDetail(item)}
                        style={{
                          padding: "10px 16px",
                          background: "#eff6ff",
                          color: "#2563eb",
                          border: "1px solid #bfdbfe",
                          borderRadius: "10px",
                          fontWeight: 700,
                          fontSize: "13px",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          flex: teamsUrl ? "0 0 auto" : 1,
                        }}
                      >
                        👁 Details
                      </button>
                    </div>

                    {userIsOwner && (
                      <div
                        style={{
                          padding: "14px",
                          background: "#f8fafc",
                          borderRadius: "12px",
                          border: "1px dashed #cbd5e1",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        <div>
                          <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "4px", textTransform: "uppercase" }}>Status</label>
                          <select
                            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "14px", color: "#0f172a", fontFamily: "inherit" }}
                            value={edit.status}
                            onChange={e => handleEditChange(item.id, "status", e.target.value)}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Completed">Completed</option>
                            <option value="Escalated">Escalated</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "4px", textTransform: "uppercase" }}>Remarks</label>
                          <input
                            type="text"
                            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "14px", color: "#0f172a", fontFamily: "inherit", boxSizing: "border-box" }}
                            value={edit.remarks}
                            onChange={e => handleEditChange(item.id, "remarks", e.target.value)}
                            placeholder="Add remark…"
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "4px", textTransform: "uppercase" }}>Attachment</label>
                          <input
                            type="file"
                            style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "12px" }}
                            onChange={e => {
                              if (e.target.files?.[0]) handleEditChange(item.id, "file", e.target.files[0]);
                            }}
                          />
                        </div>
                        <button
                          style={{ padding: "10px", background: "#059669", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
                          onClick={() => handleSave(item.id)}
                        >
                          ✓ Save
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {/* ── Meeting Detail Modal ── */}
      <MeetingDetailModal
        meetingId={viewDetailId}
        meeting={viewDetailMeeting ? {
          id: viewDetailMeeting.id,
          meetingType:          viewDetailMeeting.meetingType          || (viewDetailMeeting as any).MeetingType,
          financialYear:        viewDetailMeeting.financialYear        || (viewDetailMeeting as any).FinancialYear,
          monthName:            viewDetailMeeting.monthName            || (viewDetailMeeting as any).MonthName,
          frequencyType:        viewDetailMeeting.frequencyType        || (viewDetailMeeting as any).FrequencyType,
          meetingStatus:        viewDetailMeeting.meetingStatus        || (viewDetailMeeting as any).MeetingStatus,
          transcriptSyncStatus: viewDetailMeeting.transcriptSyncStatus || (viewDetailMeeting as any).TranscriptSyncStatus,
          attendanceSyncStatus: viewDetailMeeting.attendanceSyncStatus || (viewDetailMeeting as any).AttendanceSyncStatus,
          graphMeetingId:       viewDetailMeeting.graphMeetingId       || (viewDetailMeeting as any).GraphMeetingId,
          aiSummaryAvailable:   viewDetailMeeting.aiSummaryAvailable   ?? (viewDetailMeeting as any).AiSummaryAvailable ?? false,
          attendancePercent:    viewDetailMeeting.attendancePercent    ?? (viewDetailMeeting as any).AttendancePercent ?? null,
        } : null}
        onClose={closeDetail}
        onSyncAttendance={isAdmin ? handleSyncAttendance : undefined}
        onSyncTranscript={isAdmin ? handleSyncTranscript : undefined}
      />
      </div>
      </IonContent>
    </IonPage>
  );
}

export default MeetingList;
