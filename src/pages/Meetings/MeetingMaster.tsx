import React, { useState, useRef, useEffect } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../../config";
import {
  IonToast,
  IonIcon,
  IonModal,
  IonContent,
  IonDatetime,
  IonPage,
  IonPopover
} from "@ionic/react";

import {
  calendarOutline,
  peopleOutline,
  businessOutline,
  clipboardOutline,
  saveOutline,
  timeOutline,
  personCircleOutline,
  repeatOutline,
  folderOutline
} from "ionicons/icons";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X, Check, ChevronLeft, Calendar } from "lucide-react";
import moment from "moment";

import "./MeetingMaster.css";
import "../../components/requests/RequestList.css";

function MeetingMaster() {
  const history = useHistory();

  const currentYear = new Date().getFullYear();

  const years = [
    currentYear,
    currentYear + 1,
    currentYear + 2
  ];

  const months = [
    "January", "February", "March", "April",
    "May", "June", "July", "August",
    "September", "October", "November", "December"
  ];

  const frequencies = [
    "Every Day",
    "Every Week",
    "Bi-monthly",
    "Monthly"
  ];

  const [projects, setProjects] = useState<string[]>([
    "Beat",
    "Boat",
    "Unicode",
    "React"
  ]);

  const initialForm = {
    year: "",
    month: "",
    meetingDate: "",
    weekName: "",
    meetingType: "",
    participants: [] as string[],
    frequencyType: "",
    projectName: "",
    meetingOwner: [] as string[],
    meetingStatus: "Pending",
    remarks: "",
    createdBy: "Admin",
    teamsOrganizerEmail: "PSivaPrasaddbs@DBASESOLUTIONSPVTLTD.onmicrosoft.com",
    // Phase A: timing for auto-complete
    meetingStartTime: "",
    meetingEndTime: "",
  };

  const [form, setForm] = useState(initialForm);
  const [employees, setEmployees] = useState<any[]>([]);

  // ── Dropdown Open States ──────────────────────────────────────────
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [yearSearchTerm, setYearSearchTerm] = useState("");
  const [yearDropdownPos, setYearDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const yearTriggerRef = useRef<HTMLDivElement>(null);

  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [monthSearchTerm, setMonthSearchTerm] = useState("");
  const [monthDropdownPos, setMonthDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const monthTriggerRef = useRef<HTMLDivElement>(null);

  const [isFreqDropdownOpen, setIsFreqDropdownOpen] = useState(false);
  const [freqSearchTerm, setFreqSearchTerm] = useState("");
  const [freqDropdownPos, setFreqDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const freqTriggerRef = useRef<HTMLDivElement>(null);

  const [isProjDropdownOpen, setIsProjDropdownOpen] = useState(false);
  const [projSearchTerm, setProjSearchTerm] = useState("");
  const [projDropdownPos, setProjDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const projTriggerRef = useRef<HTMLDivElement>(null);

  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [dateDropdownPos, setDateDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const dateTriggerRef = useRef<HTMLDivElement>(null);
  const [calViewDate, setCalViewDate] = useState<Date>(new Date());

  const [isPartDropdownOpen, setIsPartDropdownOpen] = useState(false);
  const [partSearchTerm, setPartSearchTerm] = useState("");
  const [partDropdownPos, setPartDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const partTriggerRef = useRef<HTMLDivElement>(null);

  const [isOwnerDropdownOpen, setIsOwnerDropdownOpen] = useState(false);
  const [ownerSearchTerm, setOwnerSearchTerm] = useState("");
  const [ownerDropdownPos, setOwnerDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const ownerTriggerRef = useRef<HTMLDivElement>(null);

  // Helper to open one dropdown and close others
  const openDropdown = (type: 'year' | 'month' | 'freq' | 'proj' | 'date' | 'part' | 'owner') => {
    setIsYearDropdownOpen(type === 'year' ? !isYearDropdownOpen : false);
    setIsMonthDropdownOpen(type === 'month' ? !isMonthDropdownOpen : false);
    setIsFreqDropdownOpen(type === 'freq' ? !isFreqDropdownOpen : false);
    setIsProjDropdownOpen(type === 'proj' ? !isProjDropdownOpen : false);
    setIsDateDropdownOpen(type === 'date' ? !isDateDropdownOpen : false);
    setIsPartDropdownOpen(type === 'part' ? !isPartDropdownOpen : false);
    setIsOwnerDropdownOpen(type === 'owner' ? !isOwnerDropdownOpen : false);
  };

  // Sync calendar view month/year when date dropdown opens
  useEffect(() => {
    if (isDateDropdownOpen) {
      if (form.meetingDate) {
        setCalViewDate(new Date(form.meetingDate));
      } else if (form.year && form.month) {
        const mIdx = months.indexOf(form.month);
        if (mIdx !== -1) {
          setCalViewDate(new Date(parseInt(form.year) || currentYear, mIdx, 1));
        }
      }
    }
  }, [isDateDropdownOpen]);

  // Calendar calculations
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const changeCalMonth = (offset: number) => {
    setCalViewDate(prev => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + offset);
      return next;
    });
  };

  const handleSelectDate = (year: number, month: number, day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setForm(prev => ({
      ...prev,
      meetingDate: dateStr,
      year: String(year),
      month: months[month]
    }));
    setIsDateDropdownOpen(false);
  };

  const selectQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const dateStr = moment(d).format("YYYY-MM-DD");
    setForm(prev => ({
      ...prev,
      meetingDate: dateStr,
      year: String(d.getFullYear()),
      month: months[d.getMonth()]
    }));
    setCalViewDate(d);
    setIsDateDropdownOpen(false);
  };

  // Scroll & Resize listeners for dropdown positioning
  useEffect(() => {
    const calcPos = (ref: React.RefObject<HTMLDivElement>, minWidth = 280) => {
      if (!ref.current) return { top: 0, left: 0, width: 0 };
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 390;
      let top = rect.bottom + 6;
      if (spaceBelow < 260 && rect.top > dropdownHeight) {
        top = Math.max(10, rect.top - dropdownHeight - 6);
      }
      return {
        top,
        left: Math.max(10, Math.min(rect.left, window.innerWidth - Math.max(rect.width, minWidth) - 10)),
        width: Math.max(rect.width, minWidth)
      };
    };

    const updatePositions = () => {
      if (isYearDropdownOpen) setYearDropdownPos(calcPos(yearTriggerRef));
      if (isMonthDropdownOpen) setMonthDropdownPos(calcPos(monthTriggerRef));
      if (isFreqDropdownOpen) setFreqDropdownPos(calcPos(freqTriggerRef));
      if (isProjDropdownOpen) setProjDropdownPos(calcPos(projTriggerRef));
      if (isDateDropdownOpen) setDateDropdownPos(calcPos(dateTriggerRef, 310));
      if (isPartDropdownOpen) setPartDropdownPos(calcPos(partTriggerRef, 320));
      if (isOwnerDropdownOpen) setOwnerDropdownPos(calcPos(ownerTriggerRef, 320));
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);
    window.addEventListener('scroll', updatePositions, true);
    return () => {
      window.removeEventListener('resize', updatePositions);
      window.removeEventListener('scroll', updatePositions, true);
    };
  }, [
    isYearDropdownOpen,
    isMonthDropdownOpen,
    isFreqDropdownOpen,
    isProjDropdownOpen,
    isDateDropdownOpen,
    isPartDropdownOpen,
    isOwnerDropdownOpen
  ]);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await axios.get(`${API_BASE}Employee/Load_Employees`);
        if (response.data && Array.isArray(response.data)) {
          const filteredEmployees = response.data.filter((emp: any) => emp[0] !== "0" && emp[1] !== "All Employees");
          setEmployees(filteredEmployees);
        }
      } catch (error) {
        console.error("Failed to load employees", error);
      }
    };

    const fetchProjects = async () => {
      try {
        const res = await axios.get(`${API_BASE}Sources/Load_ProjectMaster`);
        if (Array.isArray(res.data) && res.data.length > 0) {
          const projNames = res.data.map((p: any) => p[1] || p.Project).filter(Boolean);
          if (projNames.length > 0) {
            setProjects(Array.from(new Set(projNames)));
          }
        }
      } catch (e) {
        // Fallback to default projects
      }
    };

    fetchEmployees();
    fetchProjects();
  }, []);

  const [toast, setToast] = useState({
    open: false,
    message: "",
    color: "success"
  });

  const handleChange = (e: any) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const showToast = (
    message: string,
    color: string = "success"
  ) => {
    setToast({
      open: true,
      message,
      color
    });
  };

  // Helper to format employee display name cleanly
  const getEmpDisplayName = (empId: string | number) => {
    const emp = employees.find(e => String(e[0]) === String(empId));
    if (!emp) return String(empId);
    let name = String(emp[1] || "");
    if (name.startsWith(String(emp[0]) + "-")) {
      name = name.replace(String(emp[0]) + "-", "").trim();
    }
    return name;
  };

  // Participant Filter & Multi-select Handlers
  const filteredParticipants = employees.filter((emp) => {
    const term = partSearchTerm.toLowerCase();
    const id = String(emp[0]).toLowerCase();
    let name = String(emp[1] || "");
    if (name.startsWith(emp[0] + "-")) {
      name = name.replace(emp[0] + "-", "").trim();
    }
    return name.toLowerCase().includes(term) || id.includes(term);
  });

  const toggleParticipant = (empId: string | number) => {
    const idStr = String(empId);
    setForm(prev => {
      const arr = prev.participants.map(String);
      const isSelected = arr.includes(idStr);
      return {
        ...prev,
        participants: isSelected ? arr.filter(id => id !== idStr) : [...arr, idStr]
      };
    });
  };

  const selectAllParticipants = () => {
    const ids = filteredParticipants.map(e => String(e[0]));
    setForm(prev => {
      const current = new Set(prev.participants.map(String));
      ids.forEach(id => current.add(id));
      return { ...prev, participants: Array.from(current) };
    });
  };

  const clearAllParticipants = () => {
    setForm(prev => ({ ...prev, participants: [] }));
  };

  const removeParticipant = (empId: string | number) => {
    const idStr = String(empId);
    setForm(prev => ({
      ...prev,
      participants: prev.participants.filter(id => String(id) !== idStr)
    }));
  };

  // Meeting Owner Filter & Multi-select Handlers
  const filteredOwners = employees.filter((emp) => {
    const term = ownerSearchTerm.toLowerCase();
    const id = String(emp[0]).toLowerCase();
    let name = String(emp[1] || "");
    if (name.startsWith(emp[0] + "-")) {
      name = name.replace(emp[0] + "-", "").trim();
    }
    return name.toLowerCase().includes(term) || id.includes(term);
  });

  const toggleOwner = (empId: string | number) => {
    const idStr = String(empId);
    setForm(prev => {
      const arr = prev.meetingOwner.map(String);
      const isSelected = arr.includes(idStr);
      return {
        ...prev,
        meetingOwner: isSelected ? arr.filter(id => id !== idStr) : [...arr, idStr]
      };
    });
  };

  const selectAllOwners = () => {
    const ids = filteredOwners.map(e => String(e[0]));
    setForm(prev => {
      const current = new Set(prev.meetingOwner.map(String));
      ids.forEach(id => current.add(id));
      return { ...prev, meetingOwner: Array.from(current) };
    });
  };

  const clearAllOwners = () => {
    setForm(prev => ({ ...prev, meetingOwner: [] }));
  };

  const removeOwner = (empId: string | number) => {
    const idStr = String(empId);
    setForm(prev => ({
      ...prev,
      meetingOwner: prev.meetingOwner.filter(id => String(id) !== idStr)
    }));
  };

  const saveMeeting = async () => {
    try {
      if (!form.year) {
        showToast("Please Select Year", "warning");
        return;
      }

      if (!form.month) {
        showToast("Please Select Month", "warning");
        return;
      }

      if (!form.frequencyType) {
        showToast("Please Select Frequency", "warning");
        return;
      }

      if (!form.projectName) {
        showToast("Please Select Project", "warning");
        return;
      }

      if (
        form.frequencyType !== "Every Day" &&
        !form.meetingDate
      ) {
        showToast("Please Select Meeting Date", "warning");
        return;
      }

      const baseDate = form.meetingDate || new Date().toISOString().split("T")[0];
      const payload = {
        ...form,
        participants: Array.isArray(form.participants)
          ? form.participants.join(",")
          : form.participants,
        meetingOwner: Array.isArray(form.meetingOwner)
          ? form.meetingOwner.join(",")
          : form.meetingOwner,
        meetingDate:      form.frequencyType === "Every Day" ? null : form.meetingDate,
        meetingStartTime: form.meetingStartTime ? `${baseDate}T${form.meetingStartTime}:00` : null,
        meetingEndTime:   form.meetingEndTime   ? `${baseDate}T${form.meetingEndTime}:00`   : null,
      };

      console.log("[MeetingMaster] Saving payload:", payload);

      const response = await axios.post(
        `${API_BASE}Meeting/SaveMeeting`,
        payload
      );

      console.log("[MeetingMaster] SaveMeeting response:", response.data);

      const teamsUrl = response?.data?.teamsUrl;
      const resMessage = response?.data?.message || "";

      if (!teamsUrl) {
        console.warn("[MeetingMaster] No Teams URL returned. Full message:", resMessage);
      } else {
        console.log("[MeetingMaster] Teams URL created:", teamsUrl);
      }

      showToast(
        teamsUrl
          ? "Meeting saved! Teams meeting created automatically."
          : resMessage || "Meeting Saved Successfully",
        teamsUrl ? "success" : "warning"
      );

      // ✅ CLEAR FORM
      setForm(initialForm);

    } catch (err: any) {
      console.log(err);
      let errorMessage = "API Error";

      if (typeof err?.response?.data === "string") {
        errorMessage = err.response.data;
      } else if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.response?.data?.title) {
        errorMessage = err.response.data.title;
      } else if (err?.message) {
        errorMessage = err.message;
      }

      showToast(errorMessage, "danger");
    }
  };

  return (
    <IonPage>
      <IonContent className="page-content">
        <div className="wr-container stock-container" style={{ padding: 0, minHeight: 'auto', backgroundColor: 'transparent' }}>
          
          {/* ── Premium Header ── */}
          <div className="page-wr-header" style={{ margin: '16px', borderRadius: '16px', padding: '16px' }}>
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()}>
                <ChevronLeft size={22} color="white" />
              </button>
              <div>
                <h1 className="page-wr-title">Meeting Master</h1>
                <p className="page-wr-subtitle">Schedule and organize team meetings</p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <div className="page-wr-header-icon-box">
                <Calendar size={26} color="var(--ion-color-primary)" />
              </div>
            </div>
          </div>

          <div className="stock-panel" style={{ margin: '0 16px 20px 16px' }}>
            <div className="overtime-form-title compact-title" style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", fontWeight: "700" }}>
              <IonIcon icon={calendarOutline} style={{ color: "var(--ion-color-primary)", fontSize: "20px", strokeWidth: "32px" }} />
              <span style={{ color: "var(--ion-color-primary)", fontWeight: "bold", fontSize: "16px" }}>Create Meeting</span>
            </div>

            <div className="stock-grid">
              {/* YEAR */}
              <div className="stock-field">
                <label>Year</label>
                <div
                  ref={yearTriggerRef}
                  className={`dbase-inline-select searchable-trigger ${isYearDropdownOpen ? 'active' : ''}`}
                  onClick={() => openDropdown('year')}
                  style={{ width: '100%', minHeight: '38px', background: 'var(--stock-panel-bg)', border: '1px solid var(--stock-border)', borderRadius: 'var(--stock-radius-md)', cursor: 'pointer' }}
                >
                  <span className="dbase-select-text" style={{ fontSize: '13px', fontWeight: form.year ? '700' : '600', color: form.year ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                    {form.year ? form.year : "Select Year"}
                  </span>
                  <IonIcon icon={calendarOutline} className="select-chevron" />
                </div>
              </div>

              {/* MONTH */}
              <div className="stock-field">
                <label>Month</label>
                <div
                  ref={monthTriggerRef}
                  className={`dbase-inline-select searchable-trigger ${isMonthDropdownOpen ? 'active' : ''}`}
                  onClick={() => openDropdown('month')}
                  style={{ width: '100%', minHeight: '38px', background: 'var(--stock-panel-bg)', border: '1px solid var(--stock-border)', borderRadius: 'var(--stock-radius-md)', cursor: 'pointer' }}
                >
                  <span className="dbase-select-text" style={{ fontSize: '13px', fontWeight: form.month ? '700' : '600', color: form.month ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                    {form.month ? form.month : "Select Month"}
                  </span>
                  <IonIcon icon={calendarOutline} className="select-chevron" />
                </div>
              </div>

              {/* FREQUENCY */}
              <div className="stock-field">
                <label>Frequency</label>
                <div
                  ref={freqTriggerRef}
                  className={`dbase-inline-select searchable-trigger ${isFreqDropdownOpen ? 'active' : ''}`}
                  onClick={() => openDropdown('freq')}
                  style={{ width: '100%', minHeight: '38px', background: 'var(--stock-panel-bg)', border: '1px solid var(--stock-border)', borderRadius: 'var(--stock-radius-md)', cursor: 'pointer' }}
                >
                  <span className="dbase-select-text" style={{ fontSize: '13px', fontWeight: form.frequencyType ? '700' : '600', color: form.frequencyType ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                    {form.frequencyType ? form.frequencyType : "Select Frequency"}
                  </span>
                  <IonIcon icon={timeOutline} className="select-chevron" />
                </div>
              </div>

              {/* PROJECT */}
              <div className="stock-field">
                <label>Project</label>
                <div
                  ref={projTriggerRef}
                  className={`dbase-inline-select searchable-trigger ${isProjDropdownOpen ? 'active' : ''}`}
                  onClick={() => openDropdown('proj')}
                  style={{ width: '100%', minHeight: '38px', background: 'var(--stock-panel-bg)', border: '1px solid var(--stock-border)', borderRadius: 'var(--stock-radius-md)', cursor: 'pointer' }}
                >
                  <span className="dbase-select-text" style={{ fontSize: '13px', fontWeight: form.projectName ? '700' : '600', color: form.projectName ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                    {form.projectName ? form.projectName : "Select Project"}
                  </span>
                  <IonIcon icon={businessOutline} className="select-chevron" />
                </div>
              </div>

              {/* MEETING DATE */}
              {form.frequencyType !== "Every Day" && (
                <div className="stock-field">
                  <label>Meeting Date</label>
                  <div
                    ref={dateTriggerRef}
                    className={`dbase-inline-select searchable-trigger ${isDateDropdownOpen ? 'active' : ''}`}
                    onClick={() => openDropdown('date')}
                    style={{ width: '100%', minHeight: '38px', background: 'var(--stock-panel-bg)', border: '1px solid var(--stock-border)', borderRadius: 'var(--stock-radius-md)', cursor: 'pointer' }}
                  >
                    <span className="dbase-select-text" style={{ fontSize: '13px', fontWeight: form.meetingDate ? '700' : '600', color: form.meetingDate ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                      {form.meetingDate ? moment(form.meetingDate).format("DD-MM-YYYY (ddd)") : "Pick Meeting Date"}
                    </span>
                    <IonIcon icon={calendarOutline} className="select-chevron" />
                  </div>
                </div>
              )}

              {/* MEETING TYPE */}
              <div className="stock-field">
                <label>Meeting Type</label>
                <input
                  type="text"
                  name="meetingType"
                  placeholder="Meeting Type"
                  value={form.meetingType}
                  onChange={handleChange}
                  className="stock-input"
                />
              </div>

              {/* START TIME */}
              <div className="stock-field">
                <label>Start Time</label>
                <input
                  type="time"
                  name="meetingStartTime"
                  value={form.meetingStartTime}
                  onChange={handleChange}
                  className="stock-input"
                />
              </div>
              
              {/* END TIME */}
              <div className="stock-field">
                <label>End Time</label>
                <input
                  type="time"
                  name="meetingEndTime"
                  value={form.meetingEndTime}
                  onChange={handleChange}
                  className="stock-input"
                />
              </div>

              {/* PARTICIPANTS */}
              <div className="stock-field">
                <label>Participants</label>
                <div
                  ref={partTriggerRef}
                  className={`dbase-inline-select searchable-trigger ${isPartDropdownOpen ? 'active' : ''}`}
                  onClick={() => openDropdown('part')}
                  style={{ width: '100%', minHeight: '38px', background: 'var(--stock-panel-bg)', border: '1px solid var(--stock-border)', borderRadius: 'var(--stock-radius-md)', cursor: 'pointer' }}
                >
                  <span className="dbase-select-text" style={{ fontSize: '13px', fontWeight: '600' }}>
                    {form.participants.length > 0 ? `${form.participants.length} Participant(s) Selected` : "Select Participants"}
                  </span>
                  <IonIcon icon={peopleOutline} className="select-chevron" />
                </div>
                {form.participants.length > 0 && (
                  <div className="participant-chips-container">
                    {form.participants.map(empId => (
                      <span key={empId} className="participant-chip">
                        <span className="participant-chip-name">{getEmpDisplayName(empId)}</span>
                        <button
                          type="button"
                          className="participant-chip-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeParticipant(empId);
                          }}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* MEETING OWNER */}
              <div className="stock-field">
                <label>Meeting Owner</label>
                <div
                  ref={ownerTriggerRef}
                  className={`dbase-inline-select searchable-trigger ${isOwnerDropdownOpen ? 'active' : ''}`}
                  onClick={() => openDropdown('owner')}
                  style={{ width: '100%', minHeight: '38px', background: 'var(--stock-panel-bg)', border: '1px solid var(--stock-border)', borderRadius: 'var(--stock-radius-md)', cursor: 'pointer' }}
                >
                  <span className="dbase-select-text" style={{ fontSize: '13px', fontWeight: '600' }}>
                    {form.meetingOwner.length > 0 ? `${form.meetingOwner.length} Owner(s) Selected` : "Select Meeting Owner"}
                  </span>
                  <IonIcon icon={personCircleOutline} className="select-chevron" />
                </div>
                {form.meetingOwner.length > 0 && (
                  <div className="participant-chips-container">
                    {form.meetingOwner.map(empId => (
                      <span key={empId} className="participant-chip">
                        <span className="participant-chip-name">{getEmpDisplayName(empId)}</span>
                        <button
                          type="button"
                          className="participant-chip-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeOwner(empId);
                          }}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* REMARKS */}
              <div className="stock-field stock-field--wide">
                <label>Remarks</label>
                <textarea
                  name="remarks"
                  placeholder="Remarks"
                  value={form.remarks}
                  onChange={handleChange}
                  rows={3}
                  className="stock-input"
                  style={{ resize: "vertical" }}
                />
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                className="stock-button stock-button--primary"
                onClick={saveMeeting}
                style={{ minWidth: '150px' }}
              >
                <IonIcon icon={saveOutline} style={{ marginRight: "8px" }} />
                Save Meeting
              </button>
            </div>
          </div>
        </div>

        <IonToast
          isOpen={toast.open}
          message={toast.message}
          duration={2500}
          color={toast.color as any}
          position="top"
          onDidDismiss={() => setToast({ ...toast, open: false })}
        />
      </IonContent>

      {/* ── Year Dropdown Portal ── */}
      {isYearDropdownOpen && createPortal(
        <>
          <div
            className="dropdown-outside-click-layer"
            onClick={(e) => {
              e.stopPropagation();
              setIsYearDropdownOpen(false);
            }}
          />
          <div
            className="custom-inline-dropdown"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${yearDropdownPos.top}px`,
              left: `${yearDropdownPos.left}px`,
              width: `${yearDropdownPos.width}px`,
              zIndex: 99999
            }}
          >
            <div className="dropdown-search-sec">
              <Search size={16} className="dropdown-search-icon" />
              <input
                type="text"
                placeholder="Search year..."
                value={yearSearchTerm}
                onChange={(e) => setYearSearchTerm(e.target.value)}
                autoFocus
                className="dropdown-pure-input"
              />
              {yearSearchTerm && (
                <button
                  type="button"
                  className="dropdown-clear-btn"
                  onClick={() => setYearSearchTerm("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="dropdown-body">
              {years
                .filter((y) => String(y).includes(yearSearchTerm))
                .map((y, index) => {
                  const isSelected = form.year === String(y);
                  return (
                    <div
                      key={index}
                      className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setForm({ ...form, year: String(y) });
                        setIsYearDropdownOpen(false);
                        setYearSearchTerm("");
                      }}
                    >
                      <div className={`dr-avatar grad-${index % 5}`}>
                        {String(y).slice(-2)}
                      </div>
                      <div className="dr-info">
                        <span className="dr-name">Year {y}</span>
                      </div>
                      {isSelected && <Check size={18} className="dr-check" />}
                    </div>
                  );
                })}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── Month Dropdown Portal ── */}
      {isMonthDropdownOpen && createPortal(
        <>
          <div
            className="dropdown-outside-click-layer"
            onClick={(e) => {
              e.stopPropagation();
              setIsMonthDropdownOpen(false);
            }}
          />
          <div
            className="custom-inline-dropdown"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${monthDropdownPos.top}px`,
              left: `${monthDropdownPos.left}px`,
              width: `${monthDropdownPos.width}px`,
              zIndex: 99999
            }}
          >
            <div className="dropdown-search-sec">
              <Search size={16} className="dropdown-search-icon" />
              <input
                type="text"
                placeholder="Search month..."
                value={monthSearchTerm}
                onChange={(e) => setMonthSearchTerm(e.target.value)}
                autoFocus
                className="dropdown-pure-input"
              />
              {monthSearchTerm && (
                <button
                  type="button"
                  className="dropdown-clear-btn"
                  onClick={() => setMonthSearchTerm("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="dropdown-body">
              {months
                .filter((m) => m.toLowerCase().includes(monthSearchTerm.toLowerCase()))
                .map((m, index) => {
                  const isSelected = form.month === m;
                  return (
                    <div
                      key={index}
                      className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setForm({ ...form, month: m });
                        setIsMonthDropdownOpen(false);
                        setMonthSearchTerm("");
                      }}
                    >
                      <div className={`dr-avatar grad-${index % 5}`}>
                        {m.slice(0, 3).toUpperCase()}
                      </div>
                      <div className="dr-info">
                        <span className="dr-name">{m}</span>
                      </div>
                      {isSelected && <Check size={18} className="dr-check" />}
                    </div>
                  );
                })}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── Frequency Dropdown Portal ── */}
      {isFreqDropdownOpen && createPortal(
        <>
          <div
            className="dropdown-outside-click-layer"
            onClick={(e) => {
              e.stopPropagation();
              setIsFreqDropdownOpen(false);
            }}
          />
          <div
            className="custom-inline-dropdown"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${freqDropdownPos.top}px`,
              left: `${freqDropdownPos.left}px`,
              width: `${freqDropdownPos.width}px`,
              zIndex: 99999
            }}
          >
            <div className="dropdown-search-sec">
              <Search size={16} className="dropdown-search-icon" />
              <input
                type="text"
                placeholder="Search frequency..."
                value={freqSearchTerm}
                onChange={(e) => setFreqSearchTerm(e.target.value)}
                autoFocus
                className="dropdown-pure-input"
              />
              {freqSearchTerm && (
                <button
                  type="button"
                  className="dropdown-clear-btn"
                  onClick={() => setFreqSearchTerm("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="dropdown-body">
              {frequencies
                .filter((f) => f.toLowerCase().includes(freqSearchTerm.toLowerCase()))
                .map((f, index) => {
                  const isSelected = form.frequencyType === f;
                  return (
                    <div
                      key={index}
                      className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setForm({ ...form, frequencyType: f });
                        setIsFreqDropdownOpen(false);
                        setFreqSearchTerm("");
                      }}
                    >
                      <div className={`dr-avatar grad-${index % 5}`}>
                        {f.charAt(0)}
                      </div>
                      <div className="dr-info">
                        <span className="dr-name">{f}</span>
                      </div>
                      {isSelected && <Check size={18} className="dr-check" />}
                    </div>
                  );
                })}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── Project Dropdown Portal ── */}
      {isProjDropdownOpen && createPortal(
        <>
          <div
            className="dropdown-outside-click-layer"
            onClick={(e) => {
              e.stopPropagation();
              setIsProjDropdownOpen(false);
            }}
          />
          <div
            className="custom-inline-dropdown"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${projDropdownPos.top}px`,
              left: `${projDropdownPos.left}px`,
              width: `${projDropdownPos.width}px`,
              zIndex: 99999
            }}
          >
            <div className="dropdown-search-sec">
              <Search size={16} className="dropdown-search-icon" />
              <input
                type="text"
                placeholder="Search project..."
                value={projSearchTerm}
                onChange={(e) => setProjSearchTerm(e.target.value)}
                autoFocus
                className="dropdown-pure-input"
              />
              {projSearchTerm && (
                <button
                  type="button"
                  className="dropdown-clear-btn"
                  onClick={() => setProjSearchTerm("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="dropdown-body">
              {projects
                .filter((p) => p.toLowerCase().includes(projSearchTerm.toLowerCase()))
                .map((p, index) => {
                  const isSelected = form.projectName === p;
                  return (
                    <div
                      key={index}
                      className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setForm({ ...form, projectName: p });
                        setIsProjDropdownOpen(false);
                        setProjSearchTerm("");
                      }}
                    >
                      <div className={`dr-avatar grad-${index % 5}`}>
                        {p.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="dr-info">
                        <span className="dr-name">{p}</span>
                      </div>
                      {isSelected && <Check size={18} className="dr-check" />}
                    </div>
                  );
                })}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── Meeting Date Dropdown Portal ── */}
      {isDateDropdownOpen && createPortal(
        <>
          <div
            className="dropdown-outside-click-layer"
            onClick={(e) => {
              e.stopPropagation();
              setIsDateDropdownOpen(false);
            }}
          />
          <div
            className="custom-inline-dropdown"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${dateDropdownPos.top}px`,
              left: `${dateDropdownPos.left}px`,
              width: `${dateDropdownPos.width}px`,
              zIndex: 99999
            }}
          >
            <div className="dropdown-calendar-container">
              {/* Quick Presets */}
              <div className="dropdown-quick-presets">
                <button
                  type="button"
                  className="dropdown-preset-pill"
                  onClick={() => selectQuickDate(0)}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="dropdown-preset-pill"
                  onClick={() => selectQuickDate(1)}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  className="dropdown-preset-pill"
                  onClick={() => selectQuickDate(2)}
                >
                  In 2 Days
                </button>
                <button
                  type="button"
                  className="dropdown-preset-pill"
                  onClick={() => selectQuickDate(7)}
                >
                  Next Week
                </button>
              </div>

              {/* Month Navigation Header */}
              <div className="dropdown-calendar-header">
                <button
                  type="button"
                  className="dropdown-cal-nav-btn"
                  onClick={() => changeCalMonth(-1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="dropdown-cal-month-title">
                  {moment(calViewDate).format("MMMM YYYY")}
                </span>
                <button
                  type="button"
                  className="dropdown-cal-nav-btn"
                  onClick={() => changeCalMonth(1)}
                >
                  <ChevronLeft size={16} style={{ transform: 'rotate(180deg)' }} />
                </button>
              </div>

              {/* Days Grid */}
              <div className="dropdown-cal-grid">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => (
                  <div key={day} className="dropdown-cal-day-name">{day}</div>
                ))}

                {/* Empty cells before month start */}
                {Array.from({ length: getFirstDayOfMonth(calViewDate.getFullYear(), calViewDate.getMonth()) }).map((_, i) => (
                  <div key={`empty-${i}`} className="dropdown-cal-day-cell empty" />
                ))}

                {/* Days of month */}
                {Array.from({ length: getDaysInMonth(calViewDate.getFullYear(), calViewDate.getMonth()) }).map((_, i) => {
                  const dayNum = i + 1;
                  const currentMonthYearStr = `${calViewDate.getFullYear()}-${String(calViewDate.getMonth() + 1).padStart(2, '0')}`;
                  const dayDateStr = `${currentMonthYearStr}-${String(dayNum).padStart(2, '0')}`;
                  const isSelected = form.meetingDate === dayDateStr;
                  const isToday = moment().format("YYYY-MM-DD") === dayDateStr;

                  return (
                    <div
                      key={dayNum}
                      className={`dropdown-cal-day-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                      onClick={() => handleSelectDate(calViewDate.getFullYear(), calViewDate.getMonth(), dayNum)}
                    >
                      {dayNum}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="dropdown-cal-footer">
              <button
                type="button"
                className="dropdown-action-btn"
                onClick={() => {
                  setForm(prev => ({ ...prev, meetingDate: "" }));
                  setIsDateDropdownOpen(false);
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="dropdown-done-btn"
                style={{ width: 'auto', padding: '6px 16px' }}
                onClick={() => setIsDateDropdownOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── Participants Multi-select Portal ── */}
      {isPartDropdownOpen && createPortal(
        <>
          <div
            className="dropdown-outside-click-layer"
            onClick={(e) => {
              e.stopPropagation();
              setIsPartDropdownOpen(false);
            }}
          />
          <div
            className="custom-inline-dropdown"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${partDropdownPos.top}px`,
              left: `${partDropdownPos.left}px`,
              width: `${partDropdownPos.width}px`,
              zIndex: 99999
            }}
          >
            <div className="dropdown-search-sec">
              <Search size={16} className="dropdown-search-icon" />
              <input
                type="text"
                placeholder="Search participants..."
                value={partSearchTerm}
                onChange={(e) => setPartSearchTerm(e.target.value)}
                autoFocus
                className="dropdown-pure-input"
              />
              {partSearchTerm && (
                <button
                  type="button"
                  className="dropdown-clear-btn"
                  onClick={() => setPartSearchTerm("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="dropdown-multiselect-actions">
              <span className="dropdown-selected-count">
                {form.participants.length} selected
              </span>
              <div className="dropdown-btn-group">
                <button
                  type="button"
                  className="dropdown-action-btn"
                  onClick={selectAllParticipants}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="dropdown-action-btn"
                  onClick={clearAllParticipants}
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="dropdown-body">
              {filteredParticipants.length > 0 ? (
                filteredParticipants.map((emp, index) => {
                  const empId = String(emp[0]);
                  let empName = String(emp[1] || "");
                  if (empName.startsWith(empId + "-")) {
                    empName = empName.replace(empId + "-", "").trim();
                  }
                  const isSelected = form.participants.some(id => String(id) === empId);
                  const initials = (empName.charAt(0) || "?").toUpperCase();

                  return (
                    <div
                      key={empId}
                      className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleParticipant(empId)}
                    >
                      <div className={`dr-avatar grad-${(parseInt(empId) || index) % 5}`}>
                        {initials}
                      </div>
                      <div className="dr-info">
                        <span className="dr-name">{empName}</span>
                        <span className="dr-id">ID: {empId}</span>
                      </div>
                      <div className={`dr-checkbox ${isSelected ? 'checked' : ''}`}>
                        {isSelected ? <Check size={16} color="#ffffff" /> : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="dr-no-results">No participants found</div>
              )}
            </div>

            <div className="dropdown-multiselect-footer">
              <button
                type="button"
                className="dropdown-done-btn"
                onClick={() => setIsPartDropdownOpen(false)}
              >
                Done ({form.participants.length})
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── Meeting Owner Multi-select Portal ── */}
      {isOwnerDropdownOpen && createPortal(
        <>
          <div
            className="dropdown-outside-click-layer"
            onClick={(e) => {
              e.stopPropagation();
              setIsOwnerDropdownOpen(false);
            }}
          />
          <div
            className="custom-inline-dropdown"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${ownerDropdownPos.top}px`,
              left: `${ownerDropdownPos.left}px`,
              width: `${ownerDropdownPos.width}px`,
              zIndex: 99999
            }}
          >
            <div className="dropdown-search-sec">
              <Search size={16} className="dropdown-search-icon" />
              <input
                type="text"
                placeholder="Search owner..."
                value={ownerSearchTerm}
                onChange={(e) => setOwnerSearchTerm(e.target.value)}
                autoFocus
                className="dropdown-pure-input"
              />
              {ownerSearchTerm && (
                <button
                  type="button"
                  className="dropdown-clear-btn"
                  onClick={() => setOwnerSearchTerm("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="dropdown-multiselect-actions">
              <span className="dropdown-selected-count">
                {form.meetingOwner.length} selected
              </span>
              <div className="dropdown-btn-group">
                <button
                  type="button"
                  className="dropdown-action-btn"
                  onClick={selectAllOwners}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="dropdown-action-btn"
                  onClick={clearAllOwners}
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="dropdown-body">
              {filteredOwners.length > 0 ? (
                filteredOwners.map((emp, index) => {
                  const empId = String(emp[0]);
                  let empName = String(emp[1] || "");
                  if (empName.startsWith(empId + "-")) {
                    empName = empName.replace(empId + "-", "").trim();
                  }
                  const isSelected = form.meetingOwner.some(id => String(id) === empId);
                  const initials = (empName.charAt(0) || "?").toUpperCase();

                  return (
                    <div
                      key={empId}
                      className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleOwner(empId)}
                    >
                      <div className={`dr-avatar grad-${(parseInt(empId) || index) % 5}`}>
                        {initials}
                      </div>
                      <div className="dr-info">
                        <span className="dr-name">{empName}</span>
                        <span className="dr-id">ID: {empId}</span>
                      </div>
                      <div className={`dr-checkbox ${isSelected ? 'checked' : ''}`}>
                        {isSelected ? <Check size={16} color="#ffffff" /> : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="dr-no-results">No members found</div>
              )}
            </div>

            <div className="dropdown-multiselect-footer">
              <button
                type="button"
                className="dropdown-done-btn"
                onClick={() => setIsOwnerDropdownOpen(false)}
              >
                Done ({form.meetingOwner.length})
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </IonPage>
  );
}

export default MeetingMaster;