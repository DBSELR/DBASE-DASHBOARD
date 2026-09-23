import React, { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  Clock,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Eye,
  Video,
  FileText,
  Sparkles,
  Check,
  X
} from "lucide-react";
import axios from "axios";
import moment from "moment";
import { API_BASE } from "../../config";
import { IonIcon, IonSelect, IonSelectOption, IonPage, IonContent } from "@ionic/react";
import { layersOutline } from "ionicons/icons";
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

const safeStr = (val: any, fallback = ""): string => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "object") return fallback;
  const s = String(val).trim();
  return s === "" || s === "null" || s === "undefined" ? fallback : s;
};

const MeetingList: React.FC = () => {
  const history = useHistory();
  const [meetings, setMeetings]                   = useState<Meeting[]>([]);
  const [loading, setLoading]                     = useState(false);
  const [error, setError]                         = useState<string | null>(null);
  const [monthsList, setMonthsList]               = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth]         = useState<string>(() => moment().format("MMM-YYYY"));
  const [selectedDate, setSelectedDate]           = useState<string>(() => moment().format("YYYY-MM-DD"));
  const [showAllDates, setShowAllDates]           = useState<boolean>(false);
  const [searchQuery, setSearchQuery]             = useState<string>("");
  const [statusFilter, setStatusFilter]           = useState<string>("ALL");
  const [editStates, setEditStates]               = useState<Record<number, { status: string; remarks: string; file: File | null }>>({});
  const [expandedOwnerEdit, setExpandedOwnerEdit] = useState<Record<number, boolean>>({});
  const [expandedAttendees, setExpandedAttendees] = useState<Record<number, boolean>>({});
  const [viewDetailId, setViewDetailId]           = useState<number | null>(null);
  const [viewDetailMeeting, setViewDetailMeeting] = useState<Meeting | null>(null);

  // Time editing state
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const base  = API_BASE ? API_BASE.replace(/\/$/, "") : "";
      const token = localStorage.getItem("token") || "";
      const res   = await axios.get(`${base}/Meeting/GetMeetings`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const rawData = res?.data ?? [];
      const data: Meeting[] = (Array.isArray(rawData) ? rawData : []).map((m: any) => ({
        ...m,
        id: Number(m.id || m.Id) || 0,
        meetingType: safeStr(m.meetingType || m.MeetingType, "Meeting"),
        financialYear: safeStr(m.financialYear || m.FinancialYear, ""),
        monthName: safeStr(m.monthName || m.MonthName, ""),
        frequencyType: safeStr(m.frequencyType || m.FrequencyType, "One-time"),
        meetingStatus: safeStr(m.meetingStatus || m.MeetingStatus, "Pending"),
        remarks: safeStr(m.remarks || m.Remarks, ""),
        escalationRemarks: safeStr(m.escalationRemarks || m.EscalationRemarks, ""),
        meetingOwner: safeStr(m.meetingOwner || m.MeetingOwner, "-"),
        participants: safeStr(m.participants || m.Participants, "-"),
        projectName: safeStr(m.projectName || m.ProjectName, ""),
        weekName: safeStr(m.weekName || m.WeekName, ""),
        teamsMeetingUrl: safeStr(m.teamsMeetingUrl || m.TeamsMeetingUrl, ""),
        meetingDate: m.meetingDate || m.MeetingDate || null,
        meetingStartTime: m.meetingStartTime || m.MeetingStartTime || null,
        meetingEndTime: m.meetingEndTime || m.MeetingEndTime || null,
      }));
      setMeetings(data);
      const init: Record<number, { status: string; remarks: string; file: File | null }> = {};
      data.forEach((m: Meeting) => {
        if (m.id) {
          init[m.id] = {
            status: safeStr(m.meetingStatus, "Pending"),
            remarks: safeStr(m.remarks, ""),
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

  const toggleOwnerEdit = (id: number) => {
    setExpandedOwnerEdit(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAttendees = (id: number) => {
    setExpandedAttendees(prev => ({ ...prev, [id]: !prev[id] }));
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
      alert("Meeting status updated successfully!");
      setExpandedOwnerEdit(prev => ({ ...prev, [meetingId]: false }));
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

  const getMeetingDateStr = (m: Meeting): string | null => {
    const raw = m.meetingDate || (m as any).MeetingDate || m.meetingStartTime || (m as any).MeetingStartTime;
    if (!raw) return null;
    const mObj = moment(raw);
    return mObj.isValid() ? mObj.format("YYYY-MM-DD") : null;
  };

  // Base list filtered by role and selected month
  const monthMeetings = useMemo(() => {
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
        const dateStr = getMeetingDateStr(m);
        if (dateStr) {
          return moment(dateStr).format("MMM-YYYY").toLowerCase() === selectedMonth.toLowerCase();
        }
        return mMonth?.toLowerCase() === fullFilterMonth && mYear === filterYear;
      });
    }
    return result;
  }, [meetings, selectedMonth, empCode, isAdmin]);

  // KPI Counters for Month
  const kpiStats = useMemo(() => {
    const total = monthMeetings.length;
    const completed = monthMeetings.filter(m => m.meetingStatus?.toLowerCase() === "completed").length;
    const pending = monthMeetings.filter(m => m.meetingStatus?.toLowerCase() === "pending").length;
    const escalated = monthMeetings.filter(m => m.meetingStatus?.toLowerCase() === "escalated").length;
    const mine = monthMeetings.filter(m => isOwner(getMeetingOwner(m))).length;
    return { total, completed, pending, escalated, mine };
  }, [monthMeetings, empCode]);

  // Final Filtered Meetings with Date, Status Tab & Search
  const filteredMeetings = useMemo(() => {
    let result = monthMeetings;

    // 1. Date filter
    if (!showAllDates && selectedDate) {
      result = result.filter(m => {
        const dStr = getMeetingDateStr(m);
        return dStr === selectedDate;
      });
    }

    // 2. Status Filter
    if (statusFilter === "COMPLETED") {
      result = result.filter(m => m.meetingStatus?.toLowerCase() === "completed");
    } else if (statusFilter === "PENDING") {
      result = result.filter(m => m.meetingStatus?.toLowerCase() === "pending");
    } else if (statusFilter === "ESCALATED") {
      result = result.filter(m => m.meetingStatus?.toLowerCase() === "escalated");
    } else if (statusFilter === "MINE") {
      result = result.filter(m => isOwner(getMeetingOwner(m)));
    }

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(m => {
        const type = (m.meetingType || "").toLowerCase();
        const owner = (m.meetingOwner || "").toLowerCase();
        const parts = (m.participants || "").toLowerCase();
        const remarks = (m.remarks || "").toLowerCase();
        const id = String(m.id);
        return type.includes(q) || owner.includes(q) || parts.includes(q) || remarks.includes(q) || id.includes(q);
      });
    }

    return result;
  }, [monthMeetings, showAllDates, selectedDate, statusFilter, searchQuery, empCode]);

  /* ── Time & Duration Calculator ── */
  const getTimeInfo = (start?: string | null, end?: string | null) => {
    if (!start && !end) return null;
    const formatSingle = (val?: string | null) => {
      if (!val) return "";
      try {
        if (val.includes("T") || val.includes("-")) {
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
          }
        }
        const m = moment(val, ["HH:mm:ss", "HH:mm", "hh:mm A"]);
        if (m.isValid()) return m.format("hh:mm A");
      } catch { }
      return val;
    };

    const sStr = formatSingle(start);
    const eStr = formatSingle(end);

    let duration: string | null = null;
    if (start && end) {
      try {
        const mStart = moment(start);
        const mEnd = moment(end);
        if (mStart.isValid() && mEnd.isValid()) {
          const diffMins = mEnd.diff(mStart, "minutes");
          if (diffMins > 0) {
            if (diffMins < 60) duration = `${diffMins}m`;
            else {
              const hrs = Math.floor(diffMins / 60);
              const mins = diffMins % 60;
              duration = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
            }
          }
        }
      } catch { }
    }

    let slotText = "";
    if (sStr && eStr) slotText = `${sStr} – ${eStr}`;
    else if (sStr) slotText = `Starts at ${sStr}`;
    else if (eStr) slotText = `Ends at ${eStr}`;

    return { slotText, duration };
  };

  /* ── Parse Attendees into individual badge tokens ── */
  const parseAttendees = (raw?: string) => {
    if (!raw || raw === "-") return [];
    return raw.split(",").map(s => s.trim()).filter(Boolean);
  };

  return (
    <IonPage>
      <IonContent>
        <div className="mlist-page" style={{ padding: "16px 20px 100px", maxWidth: "1300px", margin: "0 auto" }}>
          
          {/* ── Custom Header ── */}
          <div className="page-wr-header">
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()} title="Go Back">
                <ChevronLeft size={22} color="white" />
              </button>
              <div>
                <h1 className="page-wr-title">Meeting List</h1>
                <p className="page-wr-subtitle">View, schedule, and track organizational meetings</p>
              </div>
            </div>
          </div>

          {/* ── KPI Summary Counter Ribbon ── */}
          <div className="mlist-kpi-bar">
            <div className="mlist-kpi-card kpi-total">
              <span>Total Month Meetings</span>
              <span className="mlist-kpi-badge">{kpiStats.total}</span>
            </div>
            <div className="mlist-kpi-card kpi-completed">
              <span>Completed</span>
              <span className="mlist-kpi-badge">{kpiStats.completed}</span>
            </div>
            <div className="mlist-kpi-card kpi-pending">
              <span>Pending</span>
              <span className="mlist-kpi-badge">{kpiStats.pending}</span>
            </div>
            {kpiStats.escalated > 0 && (
              <div className="mlist-kpi-card kpi-escalated">
                <span>Escalated</span>
                <span className="mlist-kpi-badge">{kpiStats.escalated}</span>
              </div>
            )}
            {kpiStats.mine > 0 && (
              <div className="mlist-kpi-card">
                <span>Created by You</span>
                <span className="mlist-kpi-badge" style={{ background: "#e0e7ff", color: "#3730a3" }}>{kpiStats.mine}</span>
              </div>
            )}
          </div>

          {/* ── Unified Command Toolbar (Fixed 44px Height & Alignments) ── */}
          <div className="mlist-command-toolbar">
            <div className="mlist-toolbar-row">
              {/* 1. Date Picker Card */}
              <div className="mlist-picker-card" title="Click to choose a date">
                <div className="mlist-picker-icon date-icon">
                  <Calendar size={16} />
                </div>
                <div className="mlist-picker-info">
                  <span className="mlist-picker-label">Meeting Date</span>
                  <span className="mlist-picker-value">
                    {showAllDates
                      ? "All Dates in Month"
                      : (selectedDate ? moment(selectedDate).format("ddd, DD MMM YYYY") : "Select Date")}
                  </span>
                </div>
                <input
                  type="date"
                  className="mlist-native-input"
                  value={selectedDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      setSelectedDate(val);
                      setShowAllDates(false);
                      const mStr = moment(val).format("MMM-YYYY");
                      if (mStr !== selectedMonth) setSelectedMonth(mStr);
                    }
                  }}
                />
              </div>

              {/* 2. Unified Stepper / Navigation Group */}
              <div className="mlist-stepper-group">
                <button
                  type="button"
                  className="mlist-step-btn"
                  title="Previous Day"
                  onClick={() => {
                    const prev = moment(selectedDate || undefined).subtract(1, "day").format("YYYY-MM-DD");
                    setSelectedDate(prev);
                    setShowAllDates(false);
                    const mStr = moment(prev).format("MMM-YYYY");
                    if (mStr !== selectedMonth) setSelectedMonth(mStr);
                  }}
                >
                  <ChevronLeft size={16} />
                  <span>Prev</span>
                </button>

                <div className="mlist-stepper-divider" />

                <button
                  type="button"
                  className={`mlist-step-btn ${!showAllDates && selectedDate === moment().format("YYYY-MM-DD") ? 'is-active-today' : ''}`}
                  onClick={() => {
                    const todayStr = moment().format("YYYY-MM-DD");
                    setSelectedDate(todayStr);
                    setShowAllDates(false);
                    const mStr = moment(todayStr).format("MMM-YYYY");
                    if (mStr !== selectedMonth) setSelectedMonth(mStr);
                  }}
                >
                  Today
                </button>

                <div className="mlist-stepper-divider" />

                <button
                  type="button"
                  className="mlist-step-btn"
                  title="Next Day"
                  onClick={() => {
                    const next = moment(selectedDate || undefined).add(1, "day").format("YYYY-MM-DD");
                    setSelectedDate(next);
                    setShowAllDates(false);
                    const mStr = moment(next).format("MMM-YYYY");
                    if (mStr !== selectedMonth) setSelectedMonth(mStr);
                  }}
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>

                <div className="mlist-stepper-divider" />

                <button
                  type="button"
                  className={`mlist-step-btn ${showAllDates ? 'is-active-all' : ''}`}
                  onClick={() => setShowAllDates(prev => !prev)}
                >
                  {showAllDates ? "Filtered by Day" : "Show All Month"}
                </button>
              </div>

              {/* 3. Period / Month Selector */}
              <div className="mlist-picker-card" style={{ flex: "0 1 200px", minWidth: "180px" }}>
                <div className="mlist-picker-icon period-icon">
                  <IonIcon icon={layersOutline} />
                </div>
                <div className="mlist-picker-info">
                  <span className="mlist-picker-label">Period</span>
                  <span className="mlist-picker-value">{selectedMonth || "Select Month"}</span>
                </div>
                <IonSelect
                  className="mlist-native-input"
                  interface="popover"
                  value={selectedMonth}
                  onIonChange={e => {
                    const newMonth = e.detail.value;
                    if (newMonth) {
                      setSelectedMonth(newMonth);
                      const currentMonthFormat = moment(selectedDate).format("MMM-YYYY");
                      if (currentMonthFormat !== newMonth) {
                        const firstDay = moment(newMonth, "MMM-YYYY").startOf("month").format("YYYY-MM-DD");
                        setSelectedDate(firstDay);
                      }
                    }
                  }}
                >
                  {monthsList.map(m => (
                    <IonSelectOption key={m} value={m}>{m}</IonSelectOption>
                  ))}
                </IonSelect>
              </div>

              {/* 4. Instant Search Bar */}
              <div className="mlist-search-container">
                <Search size={16} color="#94a3b8" />
                <input
                  type="text"
                  className="mlist-search-input"
                  placeholder="Search meeting, host, attendees..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
                  >
                    <X size={15} color="#94a3b8" />
                  </button>
                )}
              </div>
            </div>

            {/* Status Filter Tab Pills */}
            <div className="mlist-filter-ribbon">
              <button
                type="button"
                className={`mlist-filter-tab ${statusFilter === "ALL" ? "active" : ""}`}
                onClick={() => setStatusFilter("ALL")}
              >
                All Meetings
                <span className="mlist-filter-count">{monthMeetings.length}</span>
              </button>

              <button
                type="button"
                className={`mlist-filter-tab ${statusFilter === "COMPLETED" ? "active" : ""}`}
                onClick={() => setStatusFilter("COMPLETED")}
              >
                <span className="mlist-pulse-dot" style={{ background: "#10b981", width: 6, height: 6 }} />
                Completed
                <span className="mlist-filter-count">{kpiStats.completed}</span>
              </button>

              <button
                type="button"
                className={`mlist-filter-tab ${statusFilter === "PENDING" ? "active" : ""}`}
                onClick={() => setStatusFilter("PENDING")}
              >
                <span className="mlist-pulse-dot" style={{ background: "#f59e0b", width: 6, height: 6 }} />
                Pending
                <span className="mlist-filter-count">{kpiStats.pending}</span>
              </button>

              {kpiStats.escalated > 0 && (
                <button
                  type="button"
                  className={`mlist-filter-tab ${statusFilter === "ESCALATED" ? "active" : ""}`}
                  onClick={() => setStatusFilter("ESCALATED")}
                >
                  <span className="mlist-pulse-dot" style={{ background: "#ef4444", width: 6, height: 6 }} />
                  Escalated
                  <span className="mlist-filter-count">{kpiStats.escalated}</span>
                </button>
              )}

              {kpiStats.mine > 0 && (
                <button
                  type="button"
                  className={`mlist-filter-tab ${statusFilter === "MINE" ? "active" : ""}`}
                  onClick={() => setStatusFilter("MINE")}
                >
                  <User size={13} />
                  My Meetings
                  <span className="mlist-filter-count">{kpiStats.mine}</span>
                </button>
              )}
            </div>
          </div>

          {/* ── Loading Skeleton State ── */}
          {loading && (
            <div className="mlist-skeleton-grid">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="mlist-skeleton-card">
                  <div className="mlist-shimmer-bar" style={{ height: "24px", width: "65%" }} />
                  <div className="mlist-shimmer-bar" style={{ height: "36px", width: "100%", borderRadius: "8px" }} />
                  <div className="mlist-shimmer-bar" style={{ height: "80px", width: "100%", borderRadius: "8px" }} />
                  <div style={{ marginTop: "auto", display: "flex", gap: "8px" }}>
                    <div className="mlist-shimmer-bar" style={{ height: "40px", flex: 1, borderRadius: "8px" }} />
                    <div className="mlist-shimmer-bar" style={{ height: "40px", flex: 1, borderRadius: "8px" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Error State ── */}
          {!loading && error && (
            <div className="mlist-empty-state">
              <div className="mlist-empty-icon-circle" style={{ background: "#fef2f2", color: "#dc2626" }}>
                <AlertCircle size={32} />
              </div>
              <h3 className="mlist-empty-title">Failed to load meetings</h3>
              <p className="mlist-empty-desc">{error}</p>
              <button
                type="button"
                className="mlist-btn-save-status"
                style={{ width: "auto", padding: "8px 20px" }}
                onClick={loadData}
              >
                <RefreshCw size={15} style={{ marginRight: 6 }} />
                Retry
              </button>
            </div>
          )}

          {/* ── Empty State ── */}
          {!loading && !error && filteredMeetings.length === 0 && (
            <div className="mlist-empty-state">
              <div className="mlist-empty-icon-circle">
                <Calendar size={32} />
              </div>
              <h3 className="mlist-empty-title">
                {!showAllDates && selectedDate
                  ? `No meetings on ${moment(selectedDate).format("ddd, DD MMM YYYY")}`
                  : `No meetings found for ${selectedMonth}`}
              </h3>
              <p className="mlist-empty-desc">
                {searchQuery
                  ? `No meetings match "${searchQuery}". Try searching with another keyword or reset filters.`
                  : "There are no scheduled meetings for this view."}
              </p>
              <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                {!showAllDates && (
                  <button
                    type="button"
                    className="mlist-btn-details"
                    style={{ padding: "0 18px", height: "38px" }}
                    onClick={() => setShowAllDates(true)}
                  >
                    View All for {selectedMonth}
                  </button>
                )}
                {searchQuery && (
                  <button
                    type="button"
                    className="mlist-btn-details"
                    style={{ padding: "0 18px", height: "38px" }}
                    onClick={() => setSearchQuery("")}
                  >
                    Clear Search
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Meeting Cards Grid ── */}
          {!loading && !error && filteredMeetings.length > 0 && (
            <div className="mlist-cards-grid">
              {filteredMeetings.map((item, idx) => {
                const userIsOwner = isOwner(getMeetingOwner(item));
                const edit        = editStates[item.id] || { status: "", remarks: "", file: null };
                const mFrequency  = safeStr(item.frequencyType || (item as any).FrequencyType, "One-time");
                const mMeetingType = safeStr(item.meetingType  || (item as any).MeetingType, "Meeting");
                const mStatus     = safeStr(item.meetingStatus || (item as any).MeetingStatus, "Pending");
                const mRemarks    = safeStr(item.remarks       || (item as any).Remarks, "");
                const mAttachment = item.attachment            || (item as any).Attachment;
                const mOwnerRaw   = safeStr(getMeetingOwner(item), "-");
                const teamsUrl    = safeStr(item.teamsMeetingUrl || (item as any).TeamsMeetingUrl, "");
                const isCompleted = mStatus.toLowerCase() === "completed";
                const isEscalated = mStatus.toLowerCase() === "escalated";
                const isPending   = !isCompleted && !isEscalated;
                
                const timeInfo = getTimeInfo(
                  item.meetingStartTime || (item as any).MeetingStartTime,
                  item.meetingEndTime   || (item as any).MeetingEndTime
                );

                const attendeesList = parseAttendees(getParticipants(item));
                const isAttendeesExpanded = Boolean(expandedAttendees[item.id]);
                const displayedAttendees = isAttendeesExpanded ? attendeesList : attendeesList.slice(0, 4);
                const remainingCount = attendeesList.length - 4;
                const isOwnerDrawerOpen = Boolean(expandedOwnerEdit[item.id]);

                return (
                  <div key={`${item.id}-${idx}`} className="mlist-card">
                    {/* Visual Status Stripe */}
                    <div className={`mlist-status-stripe ${isCompleted ? 'completed' : isEscalated ? 'escalated' : 'pending'}`} />

                    <div className="mlist-card-inner">
                      {/* 1. Header: Title, ID & Status Badge */}
                      <div className="mlist-card-head">
                        <div className="mlist-title-section">
                          <div className="mlist-title-row">
                            <h3 className="mlist-title">{mMeetingType}</h3>
                            <span className="mlist-id-tag">#{item.id}</span>
                            <span className="mlist-type-chip">{mFrequency}</span>
                          </div>
                        </div>

                        <span className={`mlist-status-badge ${isCompleted ? 'completed' : isEscalated ? 'escalated' : 'pending'}`}>
                          <span className="mlist-pulse-dot" />
                          {mStatus}
                        </span>
                      </div>

                      {/* 2. Schedule Banner (Single Non-Redundant Time Capsule) */}
                      <div className="mlist-schedule-capsule">
                        <div className="mlist-schedule-left">
                          <Clock size={15} />
                          <span>
                            {timeInfo?.slotText || "Time not specified"}
                          </span>
                        </div>
                        {timeInfo?.duration && (
                          <span className="mlist-schedule-duration">
                            {timeInfo.duration}
                          </span>
                        )}
                      </div>

                      {/* 3. Metadata Tile */}
                      <div className="mlist-meta-box">
                        <div className="mlist-meta-row">
                          <div className="mlist-meta-label">
                            <User size={14} />
                            <span>Host / Owner</span>
                          </div>
                          <span className="mlist-meta-val">
                            Emp #{mOwnerRaw} {userIsOwner ? <strong style={{ color: "#2563eb" }}>(You)</strong> : ""}
                          </span>
                        </div>

                        {/* Smart Attendee Avatars */}
                        <div className="mlist-attendees-box">
                          <div className="mlist-attendees-header">
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <Users size={13} />
                              <span>Attendees ({attendeesList.length})</span>
                            </div>
                            {attendeesList.length > 4 && (
                              <button
                                type="button"
                                className="mlist-avatar-more-btn"
                                onClick={() => toggleAttendees(item.id)}
                              >
                                {isAttendeesExpanded ? "Show Less" : `+${remainingCount} more`}
                              </button>
                            )}
                          </div>

                          <div className="mlist-avatar-cluster">
                            {displayedAttendees.map((att, aIdx) => {
                              const isCurUser = att.toLowerCase() === empCode.toLowerCase();
                              return (
                                <span
                                  key={aIdx}
                                  className={`mlist-avatar-bubble ${isCurUser ? 'is-user' : ''}`}
                                  title={`Employee Code: ${att}`}
                                >
                                  {att} {isCurUser ? "★" : ""}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {/* Remarks */}
                        {Boolean(mRemarks && mRemarks !== "-") && (
                          <div className="mlist-remarks-quote">
                            "{mRemarks}"
                          </div>
                        )}
                      </div>

                      {/* 4. Feature & AI Badges */}
                      {((item.attendancePercent != null && item.attendanceSyncStatus === "Completed") || item.transcriptSyncStatus === "Completed" || item.aiSummaryAvailable) && (
                        <div className="mlist-feature-ribbon">
                          {item.attendancePercent != null && item.attendanceSyncStatus === "Completed" && (
                            <span className="mlist-feature-chip attendance">
                              <CheckCircle2 size={12} />
                              {item.attendancePercent}% Attended
                            </span>
                          )}
                          {item.transcriptSyncStatus === "Completed" && (
                            <span className="mlist-feature-chip transcript">
                              <FileText size={12} />
                              Transcript Ready
                            </span>
                          )}
                          {item.aiSummaryAvailable && (
                            <span className="mlist-feature-chip ai">
                              <Sparkles size={12} />
                              AI Summary Ready
                            </span>
                          )}
                        </div>
                      )}

                      {/* 5. Aligned Push-Bottom Container */}
                      <div className="mlist-card-bottom">
                        {/* Admin Time Editing */}
                        {(isAdmin || isTeamLeader) && (
                          <div style={{ width: "100%" }}>
                            {timeEditId !== item.id ? (
                              <div className="mlist-time-row">
                                <span style={{ fontSize: "11.5px", color: "#64748b" }}>Schedule Settings</span>
                                <button
                                  type="button"
                                  className="mlist-edit-time-btn"
                                  onClick={() => openTimeEdit(item)}
                                >
                                  <Clock size={13} />
                                  Edit Time
                                </button>
                              </div>
                            ) : (
                              <div className="mlist-time-form">
                                <div style={{ display: "flex", gap: "8px" }}>
                                  <div style={{ flex: 1 }}>
                                    <label className="mlist-form-label">Start</label>
                                    <input
                                      type="time"
                                      className="mlist-form-input"
                                      value={timeForm.startTime}
                                      onChange={e => setTimeForm(f => ({ ...f, startTime: e.target.value }))}
                                    />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <label className="mlist-form-label">End</label>
                                    <input
                                      type="time"
                                      className="mlist-form-input"
                                      value={timeForm.endTime}
                                      onChange={e => setTimeForm(f => ({ ...f, endTime: e.target.value }))}
                                    />
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button
                                    type="button"
                                    className="mlist-btn-save-status"
                                    onClick={() => handleUpdateTime(item)}
                                    disabled={timeSaving}
                                    style={{ flex: 1 }}
                                  >
                                    {timeSaving ? "Saving…" : "Save Time"}
                                  </button>
                                  <button
                                    type="button"
                                    className="mlist-btn-details"
                                    style={{ padding: "0 12px", height: "36px" }}
                                    onClick={() => setTimeEditId(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Primary Action Buttons */}
                        <div className="mlist-action-deck">
                          {teamsUrl && (
                            <button
                              type="button"
                              className="mlist-btn-join"
                              onClick={() => handleJoinMeeting(item.id, teamsUrl)}
                              title="Join Microsoft Teams Meeting"
                            >
                              <Video size={16} />
                              <span>Join Teams</span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="mlist-btn-details"
                            onClick={() => openDetail(item)}
                            title="View full meeting details and transcript"
                          >
                            <Eye size={16} />
                            <span>Details</span>
                          </button>

                          {mAttachment && (
                            <a
                              href={getFileUrl(mAttachment)}
                              target="_blank"
                              rel="noreferrer"
                              className="mlist-btn-file"
                              title="Download attached meeting file"
                            >
                              <Paperclip size={15} />
                            </a>
                          )}
                        </div>

                        {/* 6. Collapsible Status Drawer for Owners (Solves Height Distortion) */}
                        {userIsOwner && (
                          <div style={{ width: "100%", marginTop: "4px" }}>
                            <button
                              type="button"
                              className="mlist-owner-toggle-btn"
                              onClick={() => toggleOwnerEdit(item.id)}
                            >
                              <span>Update Meeting Status</span>
                              {isOwnerDrawerOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>

                            {isOwnerDrawerOpen && (
                              <div className="mlist-owner-drawer">
                                <div className="mlist-form-group">
                                  <label className="mlist-form-label">Status</label>
                                  <select
                                    className="mlist-form-select"
                                    value={edit.status}
                                    onChange={e => handleEditChange(item.id, "status", e.target.value)}
                                  >
                                    <option value="Pending">Pending</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Escalated">Escalated</option>
                                  </select>
                                </div>

                                <div className="mlist-form-group">
                                  <label className="mlist-form-label">Remarks</label>
                                  <input
                                    type="text"
                                    className="mlist-form-input"
                                    value={edit.remarks}
                                    onChange={e => handleEditChange(item.id, "remarks", e.target.value)}
                                    placeholder="Add meeting notes or outcome…"
                                  />
                                </div>

                                <div className="mlist-form-group">
                                  <label className="mlist-form-label">Attachment</label>
                                  <div className="mlist-custom-file-box">
                                    <Paperclip size={14} color="#64748b" />
                                    <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                                      {edit.file ? edit.file.name : "Choose file (minutes, doc, pdf)..."}
                                    </span>
                                    <input
                                      type="file"
                                      className="mlist-custom-file-input"
                                      onChange={e => {
                                        if (e.target.files?.[0]) handleEditChange(item.id, "file", e.target.files[0]);
                                      }}
                                    />
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  className="mlist-btn-save-status"
                                  onClick={() => handleSave(item.id)}
                                >
                                  <Check size={14} style={{ marginRight: 5, verticalAlign: "middle" }} />
                                  Save Status
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
};

export default MeetingList;
