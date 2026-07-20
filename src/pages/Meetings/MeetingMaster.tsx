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
  IonPage
} from "@ionic/react";

import {
  calendarOutline,
  peopleOutline,
  businessOutline,
  clipboardOutline,
  saveOutline,
  timeOutline,
  personCircleOutline
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

  const projects = [
    "Beat",
    "Boat",
    "Unicode",
    "React"
  ];

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
  
  // Date Modal State
  const [dateModalOpen, setDateModalOpen] = useState(false);

  // Portal Dropdown States
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [yearDropdownPos, setYearDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const yearTriggerRef = useRef<HTMLDivElement>(null);

  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [monthDropdownPos, setMonthDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const monthTriggerRef = useRef<HTMLDivElement>(null);

  const [isFreqDropdownOpen, setIsFreqDropdownOpen] = useState(false);
  const [freqDropdownPos, setFreqDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const freqTriggerRef = useRef<HTMLDivElement>(null);

  const [isProjDropdownOpen, setIsProjDropdownOpen] = useState(false);
  const [projDropdownPos, setProjDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const projTriggerRef = useRef<HTMLDivElement>(null);

  const [isPartDropdownOpen, setIsPartDropdownOpen] = useState(false);
  const [partSearchTerm, setPartSearchTerm] = useState("");
  const [partDropdownPos, setPartDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const partTriggerRef = useRef<HTMLDivElement>(null);

  const [isOwnerDropdownOpen, setIsOwnerDropdownOpen] = useState(false);
  const [ownerSearchTerm, setOwnerSearchTerm] = useState("");
  const [ownerDropdownPos, setOwnerDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const ownerTriggerRef = useRef<HTMLDivElement>(null);

  // Scroll & Resize listeners for dropdown positioning
  useEffect(() => {
    const updatePositions = () => {
      if (isYearDropdownOpen && yearTriggerRef.current) {
        const rect = yearTriggerRef.current.getBoundingClientRect();
        setYearDropdownPos({ top: rect.bottom + 8, left: rect.left, width: rect.width });
      }
      if (isMonthDropdownOpen && monthTriggerRef.current) {
        const rect = monthTriggerRef.current.getBoundingClientRect();
        setMonthDropdownPos({ top: rect.bottom + 8, left: rect.left, width: rect.width });
      }
      if (isFreqDropdownOpen && freqTriggerRef.current) {
        const rect = freqTriggerRef.current.getBoundingClientRect();
        setFreqDropdownPos({ top: rect.bottom + 8, left: rect.left, width: rect.width });
      }
      if (isProjDropdownOpen && projTriggerRef.current) {
        const rect = projTriggerRef.current.getBoundingClientRect();
        setProjDropdownPos({ top: rect.bottom + 8, left: rect.left, width: rect.width });
      }
      if (isPartDropdownOpen && partTriggerRef.current) {
        const rect = partTriggerRef.current.getBoundingClientRect();
        setPartDropdownPos({ top: rect.bottom + 8, left: rect.left, width: rect.width });
      }
      if (isOwnerDropdownOpen && ownerTriggerRef.current) {
        const rect = ownerTriggerRef.current.getBoundingClientRect();
        setOwnerDropdownPos({ top: rect.bottom + 8, left: rect.left, width: rect.width });
      }
    };
    updatePositions();
    window.addEventListener('resize', updatePositions);
    const scrollParents = [document.querySelector('ion-content')?.shadowRoot?.querySelector('.inner-scroll'), window];
    scrollParents.forEach(p => p?.addEventListener('scroll', updatePositions));
    return () => {
      window.removeEventListener('resize', updatePositions);
      scrollParents.forEach(p => p?.removeEventListener('scroll', updatePositions));
    };
  }, [isYearDropdownOpen, isMonthDropdownOpen, isFreqDropdownOpen, isProjDropdownOpen, isPartDropdownOpen, isOwnerDropdownOpen]);

  React.useEffect(() => {
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
    fetchEmployees();
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

    }
    catch (err: any) {

      console.log(err);

      let errorMessage = "API Error";

      if (typeof err?.response?.data === "string") {

        errorMessage = err.response.data;

      }
      else if (
        err?.response?.data?.message
      ) {

        errorMessage =
          err.response.data.message;

      }
      else if (
        err?.response?.data?.title
      ) {

        errorMessage =
          err.response.data.title;

      }
      else if (err?.message) {

        errorMessage = err.message;

      }

      showToast(errorMessage, "danger");

    }

  };
  return (
    <IonPage>
      <IonContent style={{ "--background": "var(--ion-background-color)" }}>
        <div className="onduties-page" style={{ minHeight: "100vh", paddingBottom: "80px" }}>
          {/* Custom Premium Header */}
      <div className="page-wr-header" style={{ margin: '16px 16px 16px 16px' }}>
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

      <div className="onduties-content">
        <div className="ion-padding-horizontal">
          <div style={{ width: "100%", overflowX: "hidden" }} className="overtime-form-container">
            <div className="overtime-form-title compact-title" style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", fontWeight: "700" }}>
              <IonIcon icon={calendarOutline} style={{ color: "var(--ion-color-primary)", fontSize: "20px" }} />
              <span style={{ color: "#334155" }}>Create Meeting</span>
            </div>

            <IonModal isOpen={dateModalOpen} onDidDismiss={() => setDateModalOpen(false)} className="native-date-modal">
              <IonContent>
                <IonDatetime
                  presentation="date"
                  preferWheel={true}
                  showDefaultButtons={true}
                  doneText="Done"
                  cancelText="Cancel"
                  value={form.meetingDate || undefined}
                  onIonChange={(e) => {
                    const value = e.detail.value as string;
                    if (value) {
                      setForm({ ...form, meetingDate: value.split("T")[0] });
                      setDateModalOpen(false);
                    }
                  }}
                />
              </IonContent>
            </IonModal>

            <div className="lr-bento-grid" style={{ alignItems: "start", marginBottom: "20px" }}>
              {/* YEAR */}
              <div className="lr-field-box" onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}>
                <label className="lr-field-label">Year</label>
                <div className="lr-field-content" ref={yearTriggerRef}>
                  <IonIcon icon={calendarOutline} className="lr-field-icon" />
                  <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: form.year ? "#1e293b" : "#94a3b8" }}>
                    {form.year || "Select Year"}
                  </span>
                  <ChevronDown size={16} style={{ opacity: 0.7, color: "#94a3b8" }} />
                  {isYearDropdownOpen && createPortal(
                    <>
                      <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsYearDropdownOpen(false); }} />
                      <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${yearDropdownPos.top}px`, left: `${yearDropdownPos.left}px`, width: `${yearDropdownPos.width}px` }}>
                        <div className="dropdown-body">
                          {years.map((y, index) => {
                            const isSelected = String(form.year) === String(y);
                            return (
                              <div
                                key={index}
                                className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setForm({ ...form, year: String(y) });
                                  setIsYearDropdownOpen(false);
                                }}
                              >
                                <div className="dr-info"><span className="dr-name">{y}</span></div>
                                {isSelected && <Check size={18} className="dr-check" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              </div>

              {/* MONTH */}
              <div className="lr-field-box" onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}>
                <label className="lr-field-label">Month</label>
                <div className="lr-field-content" ref={monthTriggerRef}>
                  <IonIcon icon={calendarOutline} className="lr-field-icon" />
                  <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: form.month ? "#1e293b" : "#94a3b8" }}>
                    {form.month || "Select Month"}
                  </span>
                  <ChevronDown size={16} style={{ opacity: 0.7, color: "#94a3b8" }} />
                  {isMonthDropdownOpen && createPortal(
                    <>
                      <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsMonthDropdownOpen(false); }} />
                      <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${monthDropdownPos.top}px`, left: `${monthDropdownPos.left}px`, width: `${monthDropdownPos.width}px` }}>
                        <div className="dropdown-body" style={{ maxHeight: '200px' }}>
                          {months.map((m, index) => {
                            const isSelected = form.month === m;
                            return (
                              <div
                                key={index}
                                className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setForm({ ...form, month: m });
                                  setIsMonthDropdownOpen(false);
                                }}
                              >
                                <div className="dr-info"><span className="dr-name">{m}</span></div>
                                {isSelected && <Check size={18} className="dr-check" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              </div>

              {/* FREQUENCY */}
              <div className="lr-field-box" onClick={() => setIsFreqDropdownOpen(!isFreqDropdownOpen)}>
                <label className="lr-field-label">Frequency</label>
                <div className="lr-field-content" ref={freqTriggerRef}>
                  <IonIcon icon={calendarOutline} className="lr-field-icon" />
                  <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: form.frequencyType ? "#1e293b" : "#94a3b8" }}>
                    {form.frequencyType || "Select Frequency"}
                  </span>
                  <ChevronDown size={16} style={{ opacity: 0.7, color: "#94a3b8" }} />
                  {isFreqDropdownOpen && createPortal(
                    <>
                      <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsFreqDropdownOpen(false); }} />
                      <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${freqDropdownPos.top}px`, left: `${freqDropdownPos.left}px`, width: `${freqDropdownPos.width}px` }}>
                        <div className="dropdown-body">
                          {frequencies.map((f, index) => {
                            const isSelected = form.frequencyType === f;
                            return (
                              <div
                                key={index}
                                className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setForm({ ...form, frequencyType: f });
                                  setIsFreqDropdownOpen(false);
                                }}
                              >
                                <div className="dr-info"><span className="dr-name">{f}</span></div>
                                {isSelected && <Check size={18} className="dr-check" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              </div>

              {/* PROJECT */}
              <div className="lr-field-box" onClick={() => setIsProjDropdownOpen(!isProjDropdownOpen)}>
                <label className="lr-field-label">Project</label>
                <div className="lr-field-content" ref={projTriggerRef}>
                  <IonIcon icon={businessOutline} className="lr-field-icon" />
                  <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: form.projectName ? "#1e293b" : "#94a3b8" }}>
                    {form.projectName || "Select Project"}
                  </span>
                  <ChevronDown size={16} style={{ opacity: 0.7, color: "#94a3b8" }} />
                  {isProjDropdownOpen && createPortal(
                    <>
                      <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsProjDropdownOpen(false); }} />
                      <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${projDropdownPos.top}px`, left: `${projDropdownPos.left}px`, width: `${projDropdownPos.width}px` }}>
                        <div className="dropdown-body">
                          {projects.map((p, index) => {
                            const isSelected = form.projectName === p;
                            return (
                              <div
                                key={index}
                                className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setForm({ ...form, projectName: p });
                                  setIsProjDropdownOpen(false);
                                }}
                              >
                                <div className="dr-info"><span className="dr-name">{p}</span></div>
                                {isSelected && <Check size={18} className="dr-check" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              </div>

              {/* DATE */}
              {form.frequencyType !== "Every Day" && (
                <div className="lr-field-box" onClick={() => setDateModalOpen(true)} style={{ cursor: "pointer" }}>
                  <label className="lr-field-label">Meeting Date</label>
                  <div className="lr-field-content">
                    <IonIcon icon={calendarOutline} className="lr-field-icon" />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: form.meetingDate ? "#1e293b" : "#94a3b8" }}>
                      {form.meetingDate ? moment(form.meetingDate).format("DD-MM-YYYY") : "Pick Date"}
                    </span>
                  </div>
                </div>
              )}

              {/* MEETING TYPE */}
              <div className="lr-field-box">
                <label className="lr-field-label">Meeting Type</label>
                <div className="lr-field-content">
                  <IonIcon icon={calendarOutline} className="lr-field-icon" />
                  <input
                    type="text"
                    name="meetingType"
                    placeholder="Meeting Type"
                    value={form.meetingType}
                    onChange={handleChange}
                    style={{ border: "none", outline: "none", background: "transparent", flex: 1, color: "#1e293b", fontSize: "14px", fontWeight: "500" }}
                  />
                </div>
              </div>

              {/* START TIME */}
              <div className="lr-field-box">
                <label className="lr-field-label">Start Time</label>
                <div className="lr-field-content">
                  <input
                    type="time"
                    name="meetingStartTime"
                    value={form.meetingStartTime}
                    onChange={handleChange}
                    style={{ border: "none", outline: "none", background: "transparent", flex: 1, color: "#1e293b", fontSize: "14px", fontWeight: "600" }}
                  />
                </div>
              </div>
              
              {/* END TIME */}
              <div className="lr-field-box">
                <label className="lr-field-label">End Time</label>
                <div className="lr-field-content">
                  <input
                    type="time"
                    name="meetingEndTime"
                    value={form.meetingEndTime}
                    onChange={handleChange}
                    style={{ border: "none", outline: "none", background: "transparent", flex: 1, color: "#1e293b", fontSize: "14px", fontWeight: "600" }}
                  />
                </div>
              </div>

              {/* PARTICIPANTS */}
              <div className="lr-field-box" onClick={() => setIsPartDropdownOpen(!isPartDropdownOpen)}>
                <label className="lr-field-label">Participants</label>
                <div className="lr-field-content" ref={partTriggerRef}>
                  <IonIcon icon={peopleOutline} className="lr-field-icon" />
                  <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: form.participants.length ? "#1e293b" : "#94a3b8" }}>
                    {form.participants.length > 0 ? `${form.participants.length} Selected` : "Select Participants"}
                  </span>
                  <ChevronDown size={16} style={{ opacity: 0.7, color: "#94a3b8" }} />
                  {isPartDropdownOpen && createPortal(
                    <>
                      <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsPartDropdownOpen(false); }} />
                      <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${partDropdownPos.top}px`, left: `${partDropdownPos.left}px`, width: `${partDropdownPos.width}px` }}>
                        <div className="dropdown-search-sec">
                          <Search size={16} className="dropdown-search-icon" />
                          <input type="text" placeholder="Search participants..." value={partSearchTerm} onChange={(e) => setPartSearchTerm(e.target.value)} autoFocus className="dropdown-pure-input" />
                          {partSearchTerm && <button className="dropdown-clear-btn" onClick={() => setPartSearchTerm("")}><X size={16} /></button>}
                        </div>
                        <div className="dropdown-body">
                          {employees.filter(emp => (emp[1] || "").toLowerCase().includes(partSearchTerm.toLowerCase())).length > 0 ? (
                            employees.filter(emp => (emp[1] || "").toLowerCase().includes(partSearchTerm.toLowerCase())).map((emp, index) => {
                              const isSelected = form.participants.includes(emp[0]);
                              const initials = (emp[1]?.charAt(0) || "?").toUpperCase();
                              return (
                                <div
                                  key={index}
                                  className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const arr = form.participants;
                                    if (isSelected) {
                                      setForm({ ...form, participants: arr.filter(c => c !== emp[0]) });
                                    } else {
                                      setForm({ ...form, participants: [...arr, emp[0]] });
                                    }
                                  }}
                                >
                                  <div className={`dr-avatar grad-${(index % 5) || 0}`}>{initials}</div>
                                  <div className="dr-info">
                                    <span className="dr-name">{emp[1]}</span>
                                  </div>
                                  {isSelected && <Check size={18} className="dr-check" />}
                                </div>
                              );
                            })
                          ) : <div className="dr-no-results">No members found</div>}
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              </div>

              {/* MEETING OWNER */}
              <div className="lr-field-box" onClick={() => setIsOwnerDropdownOpen(!isOwnerDropdownOpen)}>
                <label className="lr-field-label">Meeting Owner</label>
                <div className="lr-field-content" ref={ownerTriggerRef}>
                  <IonIcon icon={personCircleOutline} className="lr-field-icon" />
                  <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: form.meetingOwner.length ? "#1e293b" : "#94a3b8" }}>
                    {form.meetingOwner.length > 0 ? `${form.meetingOwner.length} Selected` : "Select Meeting Owner"}
                  </span>
                  <ChevronDown size={16} style={{ opacity: 0.7, color: "#94a3b8" }} />
                  {isOwnerDropdownOpen && createPortal(
                    <>
                      <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsOwnerDropdownOpen(false); }} />
                      <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${ownerDropdownPos.top}px`, left: `${ownerDropdownPos.left}px`, width: `${ownerDropdownPos.width}px` }}>
                        <div className="dropdown-search-sec">
                          <Search size={16} className="dropdown-search-icon" />
                          <input type="text" placeholder="Search owner..." value={ownerSearchTerm} onChange={(e) => setOwnerSearchTerm(e.target.value)} autoFocus className="dropdown-pure-input" />
                          {ownerSearchTerm && <button className="dropdown-clear-btn" onClick={() => setOwnerSearchTerm("")}><X size={16} /></button>}
                        </div>
                        <div className="dropdown-body">
                          {employees.filter(emp => (emp[1] || "").toLowerCase().includes(ownerSearchTerm.toLowerCase())).length > 0 ? (
                            employees.filter(emp => (emp[1] || "").toLowerCase().includes(ownerSearchTerm.toLowerCase())).map((emp, index) => {
                              const isSelected = form.meetingOwner.includes(emp[0]);
                              const initials = (emp[1]?.charAt(0) || "?").toUpperCase();
                              return (
                                <div
                                  key={index}
                                  className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const arr = form.meetingOwner;
                                    if (isSelected) {
                                      setForm({ ...form, meetingOwner: arr.filter(c => c !== emp[0]) });
                                    } else {
                                      setForm({ ...form, meetingOwner: [...arr, emp[0]] });
                                    }
                                  }}
                                >
                                  <div className={`dr-avatar grad-${(index % 5) || 0}`}>{initials}</div>
                                  <div className="dr-info">
                                    <span className="dr-name">{emp[1]}</span>
                                  </div>
                                  {isSelected && <Check size={18} className="dr-check" />}
                                </div>
                              );
                            })
                          ) : <div className="dr-no-results">No members found</div>}
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              </div>

              {/* REMARKS */}
              <div className="lr-field-box">
                <label className="lr-field-label">Remarks</label>
                <div className="lr-field-content" style={{ alignItems: "flex-start", padding: "12px 16px" }}>
                  <textarea
                    name="remarks"
                    placeholder="Remarks"
                    value={form.remarks}
                    onChange={handleChange}
                    rows={2}
                    style={{
                      flex: 1, border: "none", background: "transparent",
                      fontSize: 14, fontWeight: 500, outline: "none",
                      resize: "none", color: "#1e293b", fontFamily: "inherit", width: "100%",
                    }}
                  />
                </div>
              </div>

            </div>

            <button
              className="lr-gradient-btn"
              onClick={saveMeeting}
              style={{ width: "100%", marginTop: "10px" }}
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
      </div>
      </IonContent>
    </IonPage>
  );
}

export default MeetingMaster;