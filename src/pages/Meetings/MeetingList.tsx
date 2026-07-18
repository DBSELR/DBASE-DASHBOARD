import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import moment from "moment";
import { API_BASE } from "../../config";
import { IonIcon, IonSelect, IonSelectOption } from "@ionic/react";
import { calendarOutline, documentTextOutline, layersOutline } from "ionicons/icons";
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
    <div className="mlist-page">
      {/* ── Header ── */}
      <div className="mlist-hdr">
        <h2 className="mlist-title">Meeting List</h2>

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
      </div>

      {/* ── States ── */}
      {loading && <div className="mlist-loading">Loading meetings…</div>}
      {error   && <div className="mlist-error">{error}</div>}

      {!loading && !error && filteredMeetings.length === 0 && (
        <div className="mlist-empty">
          <span className="mlist-empty-icon">📅</span>
          <span className="mlist-empty-title">No meetings found</span>
          <span className="mlist-empty-sub">Try selecting a different period</span>
        </div>
      )}

      {!loading && !error && filteredMeetings.length > 0 && (
        <>
          <div className="mlist-count">
            Showing <strong>{filteredMeetings.length}</strong> meeting{filteredMeetings.length !== 1 ? "s" : ""} for <strong>{selectedMonth}</strong>
          </div>

          {/* ════════════════════════════════════════
              DESKTOP TABLE
              ════════════════════════════════════════ */}
          <div className="meeting-table-wrapper mlist-tbl-wrap">
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
                  <th>Remarks</th>
                  <th>Attachment</th>
                  <th>Teams</th>
                  <th>Details</th>
                  {hasOwnerMeeting && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredMeetings.map(item => {
                  const userIsOwner = isOwner(getMeetingOwner(item));
                  const edit        = editStates[item.id] || { status: "", remarks: "", file: null };
                  const mYear       = item.financialYear || (item as any).FinancialYear || "";
                  const mMonth      = item.monthName     || (item as any).MonthName     || "";
                  const mFrequency  = item.frequencyType || (item as any).FrequencyType || "-";
                  const mMeetingType = item.meetingType  || (item as any).MeetingType   || "-";
                  const mStatus     = item.meetingStatus || (item as any).MeetingStatus || "Pending";
                  const mRemarks    = item.remarks       || (item as any).Remarks       || "-";
                  const mAttachment = item.attachment    || (item as any).Attachment;
                  const mOwnerRaw   = getMeetingOwner(item) || "-";
                  const mPartRaw    = getParticipants(item) || "-";
                  const teamsUrl    = item.teamsMeetingUrl || (item as any).TeamsMeetingUrl || "";
                  const rawDate     = item.meetingDate || (item as any).MeetingDate || null;
                  const dateInfo    = parseMeetingDate(rawDate);

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
                      <td style={{ fontWeight: 600 }}>{mMeetingType}</td>
                      <td>{mOwnerRaw}</td>
                      <td style={{ color: "#64748b" }}>{mPartRaw}</td>

                      {/* Status */}
                      <td>
                        {userIsOwner ? (
                          <select
                            value={edit.status}
                            onChange={e => handleEditChange(item.id, "status", e.target.value)}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Completed">Completed</option>
                            <option value="Escalated">Escalated</option>
                          </select>
                        ) : (
                          <span className={badgeClass(mStatus)}>{mStatus}</span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td>
                        {userIsOwner ? (
                          <input
                            type="text"
                            value={edit.remarks}
                            onChange={e => handleEditChange(item.id, "remarks", e.target.value)}
                            placeholder="Add remark…"
                          />
                        ) : (
                          <span style={{ color: "#64748b" }}>{mRemarks}</span>
                        )}
                      </td>

                      {/* Attachment */}
                      <td>
                        {mAttachment && (
                          <a
                            href={getFileUrl(mAttachment)}
                            target="_blank"
                            rel="noreferrer"
                            className="view-file-btn"
                            style={{ marginBottom: 6, display: "inline-flex" }}
                          >
                            <IonIcon icon={documentTextOutline} />
                            View
                          </a>
                        )}
                        {userIsOwner && (
                          <input
                            type="file"
                            className="mlist-file-input"
                            onChange={e => {
                              if (e.target.files?.[0]) handleEditChange(item.id, "file", e.target.files[0]);
                            }}
                          />
                        )}
                        {!userIsOwner && !mAttachment && (
                          <span style={{ color: "#94a3b8", fontSize: 12 }}>No file</span>
                        )}
                      </td>

                      {/* Teams */}
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
                          <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Details */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                          {item.attendancePercent != null && item.attendanceSyncStatus === "Completed" && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                              background: item.attendancePercent >= 75 ? "#dcfce7" : item.attendancePercent >= 50 ? "#fef9c3" : "#fee2e2",
                              color:      item.attendancePercent >= 75 ? "#15803d" : item.attendancePercent >= 50 ? "#92400e" : "#b91c1c",
                            }}>
                              {item.attendancePercent}% attended
                            </span>
                          )}
                          {item.transcriptSyncStatus === "Completed" && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "#ede9fe", color: "#7c3aed" }}>
                              📝 Transcript
                            </span>
                          )}
                          {/* Time display */}
                          {(item.meetingStartTime || item.meetingEndTime) && timeEditId !== item.id && (
                            <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>
                              🕐 {item.meetingStartTime ? new Date(item.meetingStartTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "?"}
                              {" – "}
                              {item.meetingEndTime   ? new Date(item.meetingEndTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "?"}
                            </span>
                          )}
                          {/* Inline time editor (Team Leaders + Admins) */}
                          {(isAdmin || isTeamLeader) && timeEditId === item.id && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", minWidth: 170 }}>
                              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b" }}>Start</label>
                              <input type="time" value={timeForm.startTime}
                                onChange={e => setTimeForm(f => ({ ...f, startTime: e.target.value }))}
                                style={{ fontSize: 12, padding: "3px 6px", borderRadius: 5, border: "1px solid #cbd5e1" }} />
                              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b" }}>End</label>
                              <input type="time" value={timeForm.endTime}
                                onChange={e => setTimeForm(f => ({ ...f, endTime: e.target.value }))}
                                style={{ fontSize: 12, padding: "3px 6px", borderRadius: 5, border: "1px solid #cbd5e1" }} />
                              <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                                <button onClick={() => handleUpdateTime(item)} disabled={timeSaving}
                                  style={{ flex: 1, padding: "4px 0", background: "#059669", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                  {timeSaving ? "…" : "Save"}
                                </button>
                                <button onClick={() => setTimeEditId(null)}
                                  style={{ padding: "4px 8px", background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>
                                  ✕
                                </button>
                              </div>
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              onClick={() => openDetail(item)}
                              style={{
                                padding: "5px 10px", background: "#eff6ff", color: "#2563eb",
                                border: "1px solid #bfdbfe", borderRadius: 7, cursor: "pointer",
                                fontWeight: 700, fontSize: 12, fontFamily: "inherit", whiteSpace: "nowrap",
                              }}
                            >
                              👁 View
                            </button>
                            {(isAdmin || isTeamLeader) && timeEditId !== item.id && (
                              <button onClick={() => openTimeEdit(item)}
                                style={{
                                  padding: "5px 8px", background: "#fff7ed", color: "#c2410c",
                                  border: "1px solid #fed7aa", borderRadius: 7, cursor: "pointer",
                                  fontWeight: 700, fontSize: 12, fontFamily: "inherit", whiteSpace: "nowrap",
                                }}>
                                🕐 Time
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Owner actions */}
                      {userIsOwner && (
                        <td>
                          <button
                            onClick={() => handleSave(item.id)}
                            style={{
                              padding: "6px 12px", background: "#059669", color: "#fff",
                              border: "none", borderRadius: 7, cursor: "pointer",
                              fontWeight: 700, fontSize: 12, fontFamily: "inherit",
                            }}
                          >
                            Save
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ════════════════════════════════════════
              MOBILE CARDS
              ════════════════════════════════════════ */}
          <div className="mlist-cards">
            {filteredMeetings.map(item => {
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
              const teamsUrl    = item.teamsMeetingUrl || (item as any).TeamsMeetingUrl || "";
              const rawDate     = item.meetingDate || (item as any).MeetingDate || null;
              const dateInfo    = parseMeetingDate(rawDate);

              return (
                <div className="mlist-card" key={item.id}>
                  {/* Card top: date badge + type + status */}
                  <div className="mlist-card-top">
                    {dateInfo ? (
                      <div className="mlist-date-badge">
                        <span className="mlist-date-day">{dateInfo.day}</span>
                        <span className="mlist-date-mon">{dateInfo.mon}</span>
                      </div>
                    ) : (
                      <div className="mlist-date-badge mlist-date-badge-none">
                        <span className="mlist-date-day" style={{ fontSize: 14 }}>—</span>
                      </div>
                    )}
                    <div className="mlist-card-identity">
                      <div className="mlist-card-type">{mMeetingType}</div>
                      <div className="mlist-card-period">{mMonth} {mYear}</div>
                    </div>
                    <span className={badgeClass(mStatus)}>{mStatus}</span>
                  </div>

                  {/* Meta grid */}
                  <div className="mlist-card-meta">
                    <div className="mlist-meta-item">
                      <span className="mlist-meta-label">Owner</span>
                      <span className="mlist-meta-val">{mOwnerRaw}</span>
                    </div>
                    <div className="mlist-meta-item">
                      <span className="mlist-meta-label">Frequency</span>
                      <span className="mlist-meta-val">{mFrequency}</span>
                    </div>
                    {mRemarks && mRemarks !== "-" && (
                      <div className="mlist-meta-item mlist-meta-span2">
                        <span className="mlist-meta-label">Remarks</span>
                        <span className="mlist-meta-val">{mRemarks}</span>
                      </div>
                    )}
                  </div>

                  {/* Status badges for mobile */}
                  {((item.attendancePercent != null && item.attendanceSyncStatus === "Completed") || item.transcriptSyncStatus === "Completed" || item.aiSummaryAvailable) && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "6px 0 2px" }}>
                      {item.attendancePercent != null && item.attendanceSyncStatus === "Completed" && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                          background: item.attendancePercent >= 75 ? "#dcfce7" : item.attendancePercent >= 50 ? "#fef9c3" : "#fee2e2",
                          color:      item.attendancePercent >= 75 ? "#15803d" : item.attendancePercent >= 50 ? "#92400e" : "#b91c1c",
                        }}>
                          {item.attendancePercent}% attended
                        </span>
                      )}
                      {item.transcriptSyncStatus === "Completed" && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#ede9fe", color: "#7c3aed" }}>📝 Transcript</span>
                      )}
                      {item.aiSummaryAvailable && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#fef3c7", color: "#92400e" }}>🤖 AI Ready</span>
                      )}
                    </div>
                  )}

                  {/* Time display + inline editor for mobile (Team Leaders + Admins) */}
                  {(isAdmin || isTeamLeader) && (
                    <div style={{ padding: "4px 0 2px" }}>
                      {timeEditId !== item.id ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {(item.meetingStartTime || item.meetingEndTime) && (
                            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
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
                        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", width: 36 }}>Start</label>
                            <input type="time" value={timeForm.startTime}
                              onChange={e => setTimeForm(f => ({ ...f, startTime: e.target.value }))}
                              style={{ flex: 1, fontSize: 13, padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1" }} />
                          </div>
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", width: 36 }}>End</label>
                            <input type="time" value={timeForm.endTime}
                              onChange={e => setTimeForm(f => ({ ...f, endTime: e.target.value }))}
                              style={{ flex: 1, fontSize: 13, padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1" }} />
                          </div>
                          <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                            <button onClick={() => handleUpdateTime(item)} disabled={timeSaving}
                              style={{ flex: 1, padding: "7px 0", background: "#059669", color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                              {timeSaving ? "Saving…" : "Save Time"}
                            </button>
                            <button onClick={() => setTimeEditId(null)}
                              style={{ padding: "7px 14px", background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, cursor: "pointer" }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer: file + join + view */}
                  <div className="mlist-card-footer">
                    {mAttachment && (
                      <a
                        href={getFileUrl(mAttachment)}
                        target="_blank"
                        rel="noreferrer"
                        className="mlist-file-link"
                      >
                        <IonIcon icon={documentTextOutline} />
                        View File
                      </a>
                    )}
                    {teamsUrl && (
                      <button
                        className="mlist-btn-join"
                        onClick={() => handleJoinMeeting(item.id, teamsUrl)}
                      >
                        🔗 Join Meeting
                      </button>
                    )}
                    <button
                      onClick={() => openDetail(item)}
                      style={{
                        padding: "9px 16px",
                        background: "#eff6ff", color: "#2563eb",
                        border: "1px solid #bfdbfe", borderRadius: 9,
                        fontWeight: 700, fontSize: 13, cursor: "pointer",
                        fontFamily: "inherit", flex: teamsUrl ? "0 0 auto" : 1,
                      }}
                    >
                      👁 Details
                    </button>
                  </div>

                  {/* Owner edit section */}
                  {userIsOwner && (
                    <div className="mlist-card-edit">
                      <div>
                        <label className="mlist-edit-label">Status</label>
                        <select
                          className="mlist-edit-select"
                          value={edit.status}
                          onChange={e => handleEditChange(item.id, "status", e.target.value)}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Completed">Completed</option>
                          <option value="Escalated">Escalated</option>
                        </select>
                      </div>
                      <div>
                        <label className="mlist-edit-label">Remarks</label>
                        <input
                          type="text"
                          className="mlist-edit-input"
                          value={edit.remarks}
                          onChange={e => handleEditChange(item.id, "remarks", e.target.value)}
                          placeholder="Add remark…"
                        />
                      </div>
                      <div>
                        <label className="mlist-edit-label">Attachment</label>
                        <input
                          type="file"
                          onChange={e => {
                            if (e.target.files?.[0]) handleEditChange(item.id, "file", e.target.files[0]);
                          }}
                        />
                      </div>
                      <button className="mlist-btn-save" onClick={() => handleSave(item.id)}>
                        ✓ Save
                      </button>
                    </div>
                  )}
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
  );
}

export default MeetingList;
