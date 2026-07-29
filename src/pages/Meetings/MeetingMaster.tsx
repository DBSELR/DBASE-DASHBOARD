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

  // Portal Dropdown States for Multi-selects
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
      if (isPartDropdownOpen && partTriggerRef.current) {
        const rect = partTriggerRef.current.getBoundingClientRect();
        setPartDropdownPos({ top: rect.bottom + 8, left: rect.left, width: Math.max(rect.width, 300) });
      }
      if (isOwnerDropdownOpen && ownerTriggerRef.current) {
        const rect = ownerTriggerRef.current.getBoundingClientRect();
        setOwnerDropdownPos({ top: rect.bottom + 8, left: rect.left, width: Math.max(rect.width, 300) });
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
  }, [isPartDropdownOpen, isOwnerDropdownOpen]);

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
                <select
                  className="stock-select"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                >
                  <option value="">Select Year</option>
                  {years.map((y, index) => (
                    <option key={index} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* MONTH */}
              <div className="stock-field">
                <label>Month</label>
                <select
                  className="stock-select"
                  value={form.month}
                  onChange={(e) => setForm({ ...form, month: e.target.value })}
                >
                  <option value="">Select Month</option>
                  {months.map((m, index) => (
                    <option key={index} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* FREQUENCY */}
              <div className="stock-field">
                <label>Frequency</label>
                <select
                  className="stock-select"
                  value={form.frequencyType}
                  onChange={(e) => setForm({ ...form, frequencyType: e.target.value })}
                >
                  <option value="">Select Frequency</option>
                  {frequencies.map((f, index) => (
                    <option key={index} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              {/* PROJECT */}
              <div className="stock-field">
                <label>Project</label>
                <select
                  className="stock-select"
                  value={form.projectName}
                  onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                >
                  <option value="">Select Project</option>
                  {projects.map((p, index) => (
                    <option key={index} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* DATE */}
              {form.frequencyType !== "Every Day" && (
                <div className="stock-field">
                  <label>Meeting Date</label>
                  <div id="meeting-date-trigger" className="stock-input" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', minHeight: '38px', color: form.meetingDate ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                    {form.meetingDate ? moment(form.meetingDate).format("DD-MM-YYYY") : "Pick Date"}
                  </div>
                  <IonPopover trigger="meeting-date-trigger" triggerAction="click" alignment="start">
                    <IonDatetime
                      presentation="date"
                      value={form.meetingDate}
                      onIonChange={(e) => setForm({ ...form, meetingDate: (e.detail.value as string).split('T')[0] })}
                    />
                  </IonPopover>
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPartDropdownOpen(!isPartDropdownOpen);
                  }}
                  style={{ width: '100%', minHeight: '38px', background: 'var(--stock-panel-bg)', border: '1px solid var(--stock-border)', borderRadius: 'var(--stock-radius-md)' }}
                >
                  <span className="dbase-select-text" style={{ fontSize: '13px', fontWeight: '600' }}>
                    {form.participants.length > 0 ? `${form.participants.length} Selected` : "Select Participants"}
                  </span>
                  <IonIcon icon={peopleOutline} className="select-chevron" />
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
              <div className="stock-field">
                <label>Meeting Owner</label>
                <div
                  ref={ownerTriggerRef}
                  className={`dbase-inline-select searchable-trigger ${isOwnerDropdownOpen ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOwnerDropdownOpen(!isOwnerDropdownOpen);
                  }}
                  style={{ width: '100%', minHeight: '38px', background: 'var(--stock-panel-bg)', border: '1px solid var(--stock-border)', borderRadius: 'var(--stock-radius-md)' }}
                >
                  <span className="dbase-select-text" style={{ fontSize: '13px', fontWeight: '600' }}>
                    {form.meetingOwner.length > 0 ? `${form.meetingOwner.length} Selected` : "Select Meeting Owner"}
                  </span>
                  <IonIcon icon={personCircleOutline} className="select-chevron" />
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
    </IonPage>
  );
}

export default MeetingMaster;