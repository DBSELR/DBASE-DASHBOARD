import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonContent,
  IonSelect,
  IonSelectOption,
  IonToast,
  IonModal,
  IonDatetime,
  IonButton,
} from "@ionic/react";
import axios from "axios";
import {
  ClipboardCheck,
  History,
  PlusCircle,
  FileText,
  MapPin,
  User,
  Calendar,
  Send,
  RefreshCcw,
  Search,
  Layout,
  Edit2,
  ChevronDown,
  XCircle,
  Check,
  X,
  ChevronLeft,
  ShieldAlert
} from "lucide-react";
import {
  personOutline,
  layersOutline,
  searchOutline,
  closeCircle,
  checkmarkCircle,
  calendarOutline
} from "ionicons/icons";
import { IonIcon } from "@ionic/react";
import moment from "moment";
import { API_BASE } from "../config";
import "./WorkReports.css";
import { useHistory } from "react-router-dom";

const generateMonthList = () => {
  const months: string[] = [];
  const startYear = 2014;
  const current = moment().add(1, 'month');
  const currentYear = current.year();

  for (let y = currentYear; y >= startYear; y--) {
    const endMonth = y === currentYear ? current.month() : 11;
    for (let m = endMonth; m >= 0; m--) {
      months.push(moment().year(y).month(m).format("MMM-YYYY"));
    }
  }
  return months;
};


const WorkReports: React.FC = () => {
  const [activeSection, setActiveSection] = useState<"submit" | "reports">(
    "submit"
  );
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [workLocation, setWorkLocation] = useState<string>("In-House");
  const [reportContent, setReportContent] = useState<string>("");
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString());
  const [showDateModal, setShowDateModal] = useState(false);

  const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
  // ... (rest of states remain same)
  const [employees, setEmployees] = useState<
    { empCode: string; name: string }[]
  >([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [months, setMonths] = useState<string[]>([]);
  const [reportList, setReportList] = useState<any[]>([]);

  const _user = JSON.parse(localStorage.getItem("user") || "{}");
  const canViewAllEmployees =
    _user?.designation === "HR" ||
    _user?.designation === "Director" ||
    _user?.designation === "In-Charge F&A";

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "danger">("success");

  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingReportId, setEditingReportId] = useState<number | null>(null);
  const [editingReportContent, setEditingReportContent] = useState<string>("");
  const history = useHistory();

  const [isTodayReportSubmitted, setIsTodayReportSubmitted] = useState<boolean>(() => {
    try {
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      return localStorage.getItem(`work_report_submitted_${todayKey}`) === "true";
    } catch {
      return false;
    }
  });

  const markTodaySubmitted = () => {
    try {
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      const slot = now.getMinutes() >= 20 ? "18_20" : "18_00";
      localStorage.setItem(`work_report_submitted_${todayKey}`, "true");
      localStorage.setItem("work_report_dismissed_time", `${todayKey}_${slot}`);
      setIsTodayReportSubmitted(true);
      window.dispatchEvent(new CustomEvent("work-report-submitted"));
    } catch (err) {
      console.error("Error setting work report submitted state", err);
    }
  };
  // Searchable Dropdown States
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [empSearchTerm, setEmpSearchTerm] = useState("");
  const triggerRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [showTeamReports, setShowTeamReports] = useState(false);

  // Client & Location Dropdown States
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [clientDropdownPos, setClientDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const clientTriggerRef = useRef<HTMLDivElement>(null);

  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [locationDropdownPos, setLocationDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const locationTriggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isClientDropdownOpen && clientTriggerRef.current) {
      const rect = clientTriggerRef.current.getBoundingClientRect();
      setClientDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isClientDropdownOpen]);

  useEffect(() => {
    if (isLocationDropdownOpen && locationTriggerRef.current) {
      const rect = locationTriggerRef.current.getBoundingClientRect();
      setLocationDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isLocationDropdownOpen]);

  // Filtering for Client Dropdown
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
    String(c.id).toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  useEffect(() => {
    if (isEmployeeDropdownOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isEmployeeDropdownOpen]);

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(empSearchTerm.toLowerCase()) ||
    emp.empCode.toLowerCase().includes(empSearchTerm.toLowerCase())
  );

  const baseUrl = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token")?.replace(/"/g, "");
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      await loadTeamReportAccess();
      try {
        const clientsRes = await axios.get(
          `${baseUrl}/Workreport/Load_Clients?College`,
          { headers: getAuthHeaders() }
        );
        setClients(
          clientsRes.data.map(([id, name]: [number, string]) => ({
            id,
            name: name || `Client ${id}`,
          }))
        );
      } catch (error) {
        console.error("Error loading clients", error);
      }

      try {
        const user = JSON.parse(
          localStorage.getItem("user") || "{}"
        );

        const designation =
          user?.designation || "";

        const isAdminUser =
          designation === "HR" ||
          designation === "Director" ||
          designation === "In-Charge F&A";

        if (isAdminUser) {

          const empRes = await axios.get(
            `${baseUrl}/Employee/Load_Employees?SearchEmp`,
            {
              headers: getAuthHeaders()
            }
          );

          const formatted = empRes.data.map(
            (e: string[]) => ({
              empCode: e[0],
              name: e[1]
            })
          );

          setEmployees(formatted);

        } else {

          setEmployees([
            {
              empCode: user.empCode,
              name: `${user.empCode} - ${user.empName}`
            }
          ]);
        }

        if (user?.empCode) {

          const defaultEmpCode =
            user.empCode;

          const defaultMonth =
            getCurrentMonthYear();

          setSelectedEmployee(
            defaultEmpCode
          );

          setSelectedMonth(
            defaultMonth
          );

          await fetchMonths(
            defaultEmpCode
          );

          await fetchReports(
            defaultEmpCode,
            defaultMonth
          );
        }
      } catch (err) {
        console.error("Error loading employees", err);
      }
    };

    fetchInitialData();
  }, []);

  const loadTeamReportAccess = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");

      const res = await axios.get(
        `${baseUrl}/Sources/Load_GETRAS`,
        {
          headers: getAuthHeaders()
        }
      );

      const allowedDesignations = res.data.map(
        (x: any) => x.name?.trim().toLowerCase()
      );

      const userDesignation =
        user?.designation?.trim().toLowerCase();

      setShowTeamReports(
        allowedDesignations.includes(userDesignation)
      );
    } catch (err) {
      console.error("Error loading designation access", err);
      setShowTeamReports(false);
    }
  };

  const getCurrentMonthYear = (): string => {
    const now = new Date();
    const month = now.toLocaleString("default", { month: "short" });
    const year = now.getFullYear();
    return `${month}-${year}`;
  };

  const fetchMonths = async (empCode: string) => {
    const list = generateMonthList();
    setMonths(list);
  };

  const fetchReports = async (empCode: string, month: string) => {
    console.log("Fetching reports for:", { empCode, month });
    try {
      const res = await axios.get(`${baseUrl}/Workreport/Load_WorkReport`, {
        params: new URLSearchParams({ EmpCode: empCode, SearchDate: month }),
        headers: getAuthHeaders(),
      });
      console.log("Fetch Reports Response:", res.data);
      const reports = res.data || [];
      setReportList(reports);

      const loginEmpCode = _user?.empCode || _user?.EmpCode;
      if (reports.length > 0 && empCode === loginEmpCode) {
        const hasTodayReport = reports.some((r: any) => {
          const rDate = r[5];
          return rDate && moment(rDate).isSame(moment(), 'day');
        });
        if (hasTodayReport) {
          markTodaySubmitted();
        }
      }

      if (reports.length === 0) {
        setToastMessage(`No work reports found for ${month}`);
        setToastType("danger");
        setShowToast(true);
      }
    } catch (err) {
      console.error("Error loading reports", err);
      setReportList([]);
      setToastMessage("No work reports found.");
      setToastType("danger");
      setShowToast(true);
    }
  };

  const handleSubmit = async () => {
    if (!selectedClient || !workLocation || !reportContent.trim()) {
      setToastType("danger");
      setToastMessage("All fields are required!");
      setShowToast(true);
      return;
    }

    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const empCode = userData?.empCode;

    if (!empCode) {
      setToastType("danger");
      setToastMessage("Employee Code not found!");
      setShowToast(true);
      return;
    }

    const payload = {
      _clientId: Number(selectedClient),
      _work_location: workLocation,
      _work_report: reportContent,
      _empcode: empCode
    };

    console.log("Submitting Work Report Payload:", payload);

    try {
      const url = `${baseUrl}/Workreport/saveworkReport`;

      const response = await axios.post(url, payload, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json; charset=utf-8'
        },
      });

      console.log("Submission Response:", response.data);

      if (response.data && (typeof response.data === 'string' ? (response.data.includes("saved successfully") || response.data.includes("Save successfully")) : response.data.message?.includes("success"))) {
        markTodaySubmitted();
        setToastType("success");
        setToastMessage("Work report submitted successfully!");
        handleClear();

        const currentMonth = getCurrentMonthYear();
        setSelectedMonth(currentMonth);
        await fetchMonths(empCode);
        await fetchReports(empCode, currentMonth);

        // Fun haptic feedback!
        try {
          Haptics.impact({ style: ImpactStyle.Heavy });
          setTimeout(() => Haptics.impact({ style: ImpactStyle.Medium }), 150);
          setTimeout(() => Haptics.impact({ style: ImpactStyle.Light }), 300);
        } catch (e) { console.log('Haptics not available'); }

        setShowSuccessModal(true);
        setTimeout(() => setShowSuccessModal(false), 3500);
      } else {
        console.warn("Unexpected response format or content:", response.data);
        // Fallback for different responses
        if (response.data === "Save successfully" || response.data?.status === "success") {
          markTodaySubmitted();
          // still treat as success if it matches somehow
          setToastType("success");
          setToastMessage("Work report submitted successfully!");
          handleClear();

          try {
            Haptics.impact({ style: ImpactStyle.Heavy });
            setTimeout(() => Haptics.impact({ style: ImpactStyle.Medium }), 150);
            setTimeout(() => Haptics.impact({ style: ImpactStyle.Light }), 300);
          } catch (e) { console.log('Haptics not available'); }

          setShowSuccessModal(true);
          setTimeout(() => setShowSuccessModal(false), 3500);
        } else {
          setToastType("danger");
          setToastMessage(typeof response.data === 'string' ? response.data : "Submission failed.");
        }
      }
    } catch (error: any) {
      console.error("Submit error detail:", {
        message: error.message,
        data: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
        requestConfig: error.config
      });

      let errorMsg = "Error submitting report.";
      if (error.response?.data) {
        if (typeof error.response.data === 'string') errorMsg = error.response.data;
        else if (error.response.data.message) errorMsg = error.response.data.message;
      }

      setToastType("danger");
      setToastMessage(errorMsg);
    }

    setShowToast(true);
  };

  const handleClear = () => {
    setSelectedClient(null);
    setWorkLocation("In-House");
    setReportContent("");
    setReportDate(new Date().toISOString());
  };

  const handleEditClick = (report: any) => {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const loginEmpCode = userData?.empCode;

    if (loginEmpCode !== selectedEmployee) {
      setToastType("danger");
      setToastMessage("You can't edit others work report!");
      setShowToast(true);
      return;
    }

    console.log("Report selected for editing:", report);
    setEditingReportId(report[0]); // Assuming report[0] is workId
    setEditingReportContent(report[4]); // Assuming report[4] is _work_report
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editingReportContent.trim() || !editingReportId) {
      setToastType("danger");
      setToastMessage("Report content cannot be empty!");
      setShowToast(true);
      return;
    }

    const userData =
      JSON.parse(
        localStorage.getItem("user") || "{}"
      );

    const canViewAllEmployees =
      userData?.designation === "HR" ||
      userData?.designation === "Director" ||
      userData?.designation === "In-Charge F&A";
    const empCode = userData?.empCode;

    if (!empCode) {
      setToastType("danger");
      setToastMessage("Employee Code not found!");
      setShowToast(true);
      return;
    }

    if (empCode !== selectedEmployee) {
      setToastType("danger");
      setToastMessage("You can't edit others work report!");
      setShowToast(true);
      setShowEditModal(false);
      return;
    }

    const payload = {
      workId: editingReportId,
      _empcode: empCode,
      _work_report: editingReportContent
    };

    console.log("Updating Work Report Payload:", payload);

    try {
      const url = `${baseUrl}/Workreport/Update_WorkReport`;
      console.log("Update API URL:", url);
      console.log("Update Payload:", payload);

      const response = await axios.post(url, payload, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json; charset=utf-8'
        },
      });

      console.log("Update Response Received:", {
        status: response.status,
        data: response.data,
        headers: response.headers
      });

      if (response.data === "Updated Successfully!" || response.data?.includes("Successfully")) {
        setToastType("success");
        setToastMessage("Work report updated successfully!");
        setShowEditModal(false);

        // Refresh reports
        if (selectedEmployee && selectedMonth) {
          await fetchReports(selectedEmployee, selectedMonth);
        }
      } else {
        setToastType("danger");
        setToastMessage(typeof response.data === 'string' ? response.data : "Update failed.");
      }
    } catch (error: any) {
      console.error("Update operation failed:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });
      setToastType("danger");
      setToastMessage(error.response?.data || "Error updating report.");
    }
    setShowToast(true);
  };

  const formatDate = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const defaultMonths = [
    "Aug-2024", "Sep-2024", "Oct-2024", "Nov-2024", "Dec-2024",
    "Jan-2025", "Feb-2025", "Mar-2025", "Apr-2025",
  ];



  return (
    <IonPage>
      <IonContent className="ion-padding" style={{ "--background": "var(--ion-background-color)" }}>
        <div className="wr-container">
          {/* Custom Premium Header */}
          <div className="page-wr-header">
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()}>
                <ChevronLeft size={22} color="white" />
              </button>
              <div>
                <h1 className="page-wr-title">Work Reports</h1>
                <p className="page-wr-subtitle">Submit and review your daily activities</p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <div className="page-wr-header-icon-box">
                <FileText size={26} color="var(--ion-color-primary)" />
              </div>
            </div>
          </div>



          {/* TEST BUTTONS BAR FOR WORK REPORT REMINDER */}
          {/* <div style={{
            background: "rgba(220, 38, 38, 0.08)",
            border: "1.5px dashed rgba(220, 38, 38, 0.4)",
            borderRadius: "16px",
            padding: "14px 18px",
            marginBottom: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "10px"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                🧪 Notification Testing Toolbar
              </span>
              <span style={{ fontSize: "12px", color: "#888" }}>Test Red Alert & Push System</span>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("test-work-report-alert", { detail: { isUrgent: false } }))}
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  padding: "10px 16px",
                  borderRadius: "10px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)"
                }}
              >
                <ShieldAlert size={16} />
                Test 6:00 PM Red Alert Modal
              </button>

              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("test-work-report-alert", { detail: { isUrgent: true } }))}
                style={{
                  background: "linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)",
                  color: "#ffffff",
                  border: "none",
                  padding: "10px 16px",
                  borderRadius: "10px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 4px 12px rgba(185, 28, 28, 0.4)"
                }}
              >
                <ShieldAlert size={16} />
                Test 6:20 PM Final Red Alert Modal
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    setToastMessage("Triggering Server Push to All Employees...");
                    setToastType("success");
                    setShowToast(true);
                    await axios.post(`${baseUrl}/Notifications/SendWorkReportReminderAll?isSecondReminder=false`, {}, { headers: getAuthHeaders() });
                    setToastMessage("✅ Server Push Notification dispatched!");
                  } catch (e: any) {
                    console.error("Test push error:", e);
                    setToastMessage("Server push sent (check browser/mobile push)");
                  }
                  setShowToast(true);
                }}
                style={{
                  background: "#1e293b",
                  color: "#ffffff",
                  border: "none",
                  padding: "10px 16px",
                  borderRadius: "10px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                📡 Trigger Server Push (FCM + SignalR)
              </button>
            </div>
          </div> */}

          {/* Custom Segments - Visible only on Mobile via CSS */}
          <div className="wr-segment-container">
            <div
              className={`wr-segment-btn ${activeSection === "submit" ? "active" : ""}`}
              onClick={() => setActiveSection("submit")}
            >
              <PlusCircle size={18} />
              <span>Submit</span>
            </div>
            <div
              className={`wr-segment-btn ${activeSection === "reports" ? "active" : ""}`}
              onClick={() => setActiveSection("reports")}
            >
              <History size={18} />
              <span>History</span>
            </div>
          </div>

          <div className="wr-main-grid">
            {/* Submit Section */}
            <div className={`wr-side-section ${activeSection === "submit" ? "wr-show" : "wr-hide-on-mobile"}`}>
              <div className="wr-card">
                <div className="wr-section-title">
                  <ClipboardCheck size={24} />
                  Submit Daily Report
                </div>

                {/* <div className="wr-input-group">
                  <label className="wr-label">Report Date</label>
                  <div className="wr-input-wrapper" onClick={() => setShowDateModal(true)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px' }}>
                    <span style={{ fontSize: '15px' }}>{formatDate(reportDate)}</span>
                    <Calendar size={18} color="var(--ion-color-primary)" />
                  </div>
                </div> */}

                {/* Tab 2 Field 1: Client Name (Custom Dropdown) */}
                {(() => {
                  const selectedClientObj = clients.find(c => String(c.id) === String(selectedClient));
                  return (
                    <div className="ntv-form-group">
                      <label className="ntv-form-label">Client Name</label>
                      <div
                        className={`ntv-form-input-wrapper ${isClientDropdownOpen ? 'active' : ''}`}
                        ref={clientTriggerRef}
                        onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                      >
                        <User size={18} className="ntv-form-input-icon" />
                        <span className="ntv-form-text-display">
                          {selectedClientObj ? selectedClientObj.name : "Choose Client"}
                        </span>
                        <ChevronDown size={16} style={{ marginLeft: 'auto', opacity: 0.7 }} />

                        {isClientDropdownOpen && createPortal(
                          <>
                            <div
                              className="dropdown-outside-click-layer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsClientDropdownOpen(false);
                              }}
                            />
                            <div
                              className="custom-inline-dropdown"
                              onMouseDown={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                top: `${clientDropdownPos.top}px`,
                                left: `${clientDropdownPos.left}px`,
                                width: `${clientDropdownPos.width}px`
                              }}
                            >
                              <div className="dropdown-search-sec">
                                <Search size={16} className="dropdown-search-icon" />
                                <input
                                  type="text"
                                  className="dropdown-pure-input"
                                  placeholder="Search client name..."
                                  value={clientSearchTerm}
                                  onChange={(e) => setClientSearchTerm(e.target.value)}
                                  autoFocus
                                  onMouseDown={(e) => e.stopPropagation()}
                                />
                                {clientSearchTerm && (
                                  <button
                                    className="dropdown-clear-btn"
                                    onClick={() => setClientSearchTerm("")}
                                  >
                                    <X size={16} />
                                  </button>
                                )}
                              </div>

                              <div className="dropdown-body">
                                {filteredClients.length > 0 ? (
                                  filteredClients.map((c, index) => {
                                    const isSelected = String(selectedClient) === String(c.id);
                                    const initials = (c.name.charAt(0) || "?").toUpperCase();
                                    return (
                                      <div
                                        key={index}
                                        className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setSelectedClient(String(c.id));
                                          setIsClientDropdownOpen(false);
                                          setClientSearchTerm("");
                                        }}
                                      >
                                        <div className={`dr-avatar grad-${(c.id % 5) || 0}`}>
                                          {initials}
                                        </div>
                                        <div className="dr-info">
                                          <span className="dr-name">{c.name}</span>
                                          <span className="dr-id">ID: {c.id}</span>
                                        </div>
                                        {isSelected && <Check size={18} className="dr-check" />}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="dr-no-results">No clients found</div>
                                )}
                              </div>
                            </div>
                          </>,
                          document.body
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Tab 2 Field 2: Work Location (Custom Dropdown) */}
                <div className="ntv-form-group">
                  <label className="ntv-form-label">Work Location</label>
                  <div
                    className={`ntv-form-input-wrapper ${isLocationDropdownOpen ? 'active' : ''}`}
                    ref={locationTriggerRef}
                    onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
                  >
                    <MapPin size={18} className="ntv-form-input-icon" />
                    <span className="ntv-form-text-display">
                      {workLocation || "Choose Location"}
                    </span>
                    <ChevronDown size={16} style={{ marginLeft: 'auto', opacity: 0.7 }} />

                    {isLocationDropdownOpen && createPortal(
                      <>
                        <div
                          className="dropdown-outside-click-layer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsLocationDropdownOpen(false);
                          }}
                        />
                        <div
                          className="custom-inline-dropdown"
                          onMouseDown={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            top: `${locationDropdownPos.top}px`,
                            left: `${locationDropdownPos.left}px`,
                            width: `${locationDropdownPos.width}px`
                          }}
                        >
                          <div className="dropdown-body" style={{ height: 'auto', maxHeight: '180px' }}>
                            {["In-House", "On-Site"].map((loc, index) => {
                              const isSelected = workLocation === loc;
                              const initials = loc.charAt(0);
                              return (
                                <div
                                  key={index}
                                  className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setWorkLocation(loc);
                                    setIsLocationDropdownOpen(false);
                                  }}
                                >
                                  <div className={`dr-avatar grad-${(index % 5) || 0}`}>
                                    {initials}
                                  </div>
                                  <div className="dr-info">
                                    <span className="dr-name">{loc}</span>
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
                  </div>
                </div>

                <div className="wr-input-group">
                  <label className="wr-label">Description</label>
                  <textarea
                    className="wr-textarea"
                    value={reportContent}
                    onChange={(e) => setReportContent(e.target.value)}
                    rows={6}
                    placeholder="Tell us what you worked on today..."
                  />
                </div>

                <div className="wr-button-group">
                  <button className="wr-btn wr-btn-primary" onClick={handleSubmit}>
                    <Send size={20} />
                    Submit
                  </button>
                  <button className="wr-btn wr-btn-outline" onClick={handleClear}>
                    <RefreshCcw size={15} />
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* History Section */}
            <div className={`wr-main-section ${activeSection === "reports" ? "wr-show" : "wr-hide-on-mobile"}`}>
              <div className="wr-view-section">
                <div className="wr-card" style={{ marginBottom: '24px' }}>
                  <div className="wr-history-header">
                    <div className="wr-section-title">
                      <Search size={22} />
                      Work History
                    </div>

                    {showTeamReports && (
                      <button
                        className="team-report-btn"
                        onClick={() => history.push("/workreport-dashboard")}
                      >
                        Team Work Reports
                      </button>
                    )}
                  </div>

                  <div className="workrp-wh" >
                    {canViewAllEmployees && (
                      <div className="wr-input-group" style={{ marginBottom: 0 }}>
                        <div className="custom-dropdown-container" ref={triggerRef}>
                          <div
                            className={`premium-filter-trigger ${isEmployeeDropdownOpen ? 'active' : ''}`}
                            onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                          >
                            <div className="trigger-content">
                              <div className="trigger-icon-box">
                                <IonIcon icon={personOutline} />
                              </div>
                              <div className="trigger-text-sec">
                                <span className="trigger-sub">Employee</span>
                                <span className="trigger-main">
                                  {employees.find(e => e.empCode === selectedEmployee)?.name || "Select Employee"}
                                </span>
                              </div>
                            </div>
                            <IonIcon icon={layersOutline} className="trigger-icon-arrow" />
                          </div>

                          {isEmployeeDropdownOpen && createPortal(
                            <>
                              <div className="dropdown-outside-click-layer" onClick={() => setIsEmployeeDropdownOpen(false)} />
                              <div
                                className="custom-inline-dropdown"
                                style={{
                                  position: 'absolute',
                                  top: `${dropdownPos.top}px`,
                                  left: `${dropdownPos.left}px`,
                                  width: `${dropdownPos.width}px`
                                }}
                              >
                                <div className="dropdown-search-sec">
                                  <IonIcon icon={searchOutline} className="dropdown-search-icon" />
                                  <input
                                    type="text"
                                    className="dropdown-pure-input"
                                    placeholder="Search name or code..."
                                    value={empSearchTerm}
                                    onChange={(e) => setEmpSearchTerm(e.target.value)}
                                    autoFocus
                                  />
                                  {empSearchTerm && (
                                    <button className="dropdown-clear-btn" onClick={() => setEmpSearchTerm("")}>
                                      <IonIcon icon={closeCircle} />
                                    </button>
                                  )}
                                </div>

                                <div className="dropdown-body">
                                  {filteredEmployees.map((emp) => {
                                    const isSelected = selectedEmployee === emp.empCode;

                                    // Extract actual name by removing ID prefix (e.g., 1501-NAME)
                                    const nameWithoutId = emp.name.includes("-") ? emp.name.split("-")[1].trim() : emp.name;
                                    const initials = nameWithoutId.charAt(0).toUpperCase();

                                    return (
                                      <div
                                        key={emp.empCode}
                                        className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                        onMouseDown={async (e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setSelectedEmployee(emp.empCode);
                                          setReportList([]);
                                          setSelectedMonth(null);
                                          setIsEmployeeDropdownOpen(false);
                                          setEmpSearchTerm("");
                                          await fetchMonths(emp.empCode);
                                        }}
                                      >
                                        <div className={`dr-avatar grad-${(parseInt(emp.empCode) % 5) || 0}`}>
                                          {initials}
                                        </div>
                                        <div className="dr-info">
                                          <span className="dr-name">{emp.name}</span>
                                          <span className="dr-id">ID: {emp.empCode}</span>
                                        </div>
                                        {isSelected && <IonIcon icon={checkmarkCircle} className="dr-check" />}
                                      </div>
                                    );
                                  })}
                                  {filteredEmployees.length === 0 && (
                                    <div className="dr-no-results">
                                      <p>No matches for "{empSearchTerm}"</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>,
                            document.body
                          )}
                        </div>
                      </div>
                    )}
                    <div className="wr-input-group" style={{ marginBottom: 0 }}>
                      <div className="custom-dropdown-container">
                        <div className="premium-filter-trigger">
                          <div className="trigger-content">
                            <div className="trigger-icon-box">
                              <IonIcon icon={calendarOutline} />
                            </div>
                            <div className="trigger-text-sec">
                              <span className="trigger-sub">Month</span>
                              <span className="trigger-main">{selectedMonth || "Select Month"}</span>
                            </div>
                          </div>
                          <IonIcon icon={layersOutline} className="trigger-icon-arrow" />

                          <IonSelect
                            className="hidden-select-overlay"
                            interface="popover"
                            value={selectedMonth}
                            onIonChange={(e) => {
                              const month = e.detail.value;
                              setSelectedMonth(month);
                              if (selectedEmployee) {
                                fetchReports(selectedEmployee, month);
                              }
                            }}
                          >
                            {months.map((month, idx) => (
                              <IonSelectOption key={idx} value={month}>
                                {month}
                              </IonSelectOption>
                            ))}
                          </IonSelect>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="wr-reports-list">
                  {reportList.length > 0 ? (
                    reportList.map((report: any, index: number) => (
                      <div className={`wr-premium-card ${report[7]}`} key={index}>
                        <div className="wr-premium-card-header">
                          <div className="wr-header-left">
                            <div className="wr-date-wrap">
                              <Calendar size={13} className="wr-header-icon" />
                              <span>{report[5]}</span>
                            </div>
                            <div className="wr-premium-location">
                              <MapPin size={12} className="wr-header-icon" />
                              <span>{report[2]}</span>
                            </div>
                          </div>
                          <div className="wr-status-wrap" style={{ backgroundColor: report[8] }}>
                            <span className="wr-status-dot"></span>
                            {report[6]}
                          </div>
                        </div>
                        <div className="wr-premium-card-body">
                          <h3 className="wr-premium-title">{report[1]}</h3>
                          <div className="wr-premium-desc-box">
                            <FileText size={14} className="wr-desc-icon" />
                            <p className="wr-premium-text">{report[4]}</p>
                            {report[6] === "Pending" && JSON.parse(localStorage.getItem("user") || "{}")?.empCode === selectedEmployee && (
                              <button className="wr-edit-btn-small" onClick={() => handleEditClick(report)}>
                                <Edit2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="wr-empty-state">
                      <FileText className="wr-empty-icon" />
                      <p>No reports found for the selected period.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2000}
          color={toastType}
          position="bottom"
          style={{ "--border-radius": "12px", "--margin": "16px" }}
        />

        <IonModal
          isOpen={showDateModal}
          onDidDismiss={() => setShowDateModal(false)}
          className="pwt-date-modal"
        >
          <div className="pwt-modal-content">
            <h3 className="pwt-modal-title">Select Report Date</h3>
            <IonDatetime
              presentation="date"
              value={reportDate}
              onIonChange={(e) => {
                if (typeof e.detail.value === "string") {
                  setReportDate(e.detail.value);
                }
                setShowDateModal(false);
              }}
            />
            <div style={{ marginTop: '16px' }}>
              <IonButton
                expand="block"
                mode="ios"
                fill="outline"
                onClick={() => setShowDateModal(false)}
              >
                Cancel
              </IonButton>
            </div>
          </div>
        </IonModal>

        {/* Simple & Ultra-Premium Success Message Modal */}
        <IonModal 
          isOpen={showSuccessModal} 
          className="premium-success-modal" 
          backdropDismiss={true}
          onDidDismiss={() => setShowSuccessModal(false)}
        >
          <div className="us-content" onClick={() => setShowSuccessModal(false)}>
            {/* Glossy Right-Tick Ball with Soft Pulse */}
            <div className="us-ball-wrapper">
              <div className="us-pulse-ring us-pulse-1"></div>
              <div className="us-pulse-ring us-pulse-2"></div>

              <div className="us-tick-ball">
                <svg className="us-checkmark-svg" viewBox="0 0 52 52">
                  <path className="us-checkmark-check" fill="none" d="M14.5 27.2l7.6 7.6 15.4-15.6" />
                </svg>
              </div>
            </div>

            <div className="us-text-wrapper">
              <h2 className="us-success-title">Work Report Submitted Successfully</h2>
            </div>
          </div>
        </IonModal>

        {/* Edit Report Modal */}
        <IonModal
          isOpen={showEditModal}
          onDidDismiss={() => setShowEditModal(false)}
          className="wr-edit-modal"
        >
          <div className="wr-modal-content">
            <h3 className="wr-modal-title">Edit Work Report</h3>
            <div className="wr-input-group" style={{ width: '100%' }}>
              <label className="wr-label">Description</label>
              <textarea
                className="wr-textarea"
                value={editingReportContent}
                onChange={(e) => setEditingReportContent(e.target.value)}
                rows={8}
                placeholder="Update your work report..."
              />
            </div>
            <div className="wr-button-group" style={{ width: '100%' }}>
              <button className="wr-btn wr-btn-outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button className="wr-btn wr-btn-primary" onClick={handleUpdate}>
                Update
              </button>
            </div>
          </div>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default WorkReports;
