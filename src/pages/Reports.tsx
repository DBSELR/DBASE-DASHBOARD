import React, { useState, useEffect, useRef } from "react";
import moment from "moment";
import { API_BASE } from "../config";
import { useHistory } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search, X, Check } from "lucide-react";
import { IonPage, IonContent, IonIcon } from "@ionic/react";
import {
  documentTextOutline,
  downloadOutline,
  refreshOutline,
  printOutline,
  calendarOutline,
  timeOutline,
  checkmarkCircleOutline,
  personOutline
} from "ionicons/icons";
import { createPortal } from "react-dom";

import "./Stock.css";
import "./Meetings/MeetingMaster.css";
import "../components/requests/RequestList.css";
import "./Reports.css";

const LOG = (...args: any[]) => console.log("[Reports]", ...args);
const GROUP = (title: string) => console.group("[Reports]", title);
const GROUP_END = () => console.groupEnd();

const monthsList = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December"
];

const Reports: React.FC = () => {
  const history = useHistory();
  const [userData, setUserData] = useState<any>(null);
  const [reportType, setReportType] = useState<string>();
  const [fromDate, setFromDate] = useState<string>(moment().format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState<string>(moment().format("YYYY-MM-DD"));
  const [monthYear, setMonthYear] = useState<string>(moment().format("YYYY-MM"));
  const [status, setStatus] = useState<string>("Regular");

  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [showPdf, setShowPdf] = useState<boolean>(false);

  // ── Dropdown States ──────────────────────────────────────────────
  const [isReportDropdownOpen, setIsReportDropdownOpen] = useState(false);
  const [reportSearchTerm, setReportSearchTerm] = useState("");
  const [reportDropdownPos, setReportDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const reportTriggerRef = useRef<HTMLDivElement>(null);

  const [isFromDateOpen, setIsFromDateOpen] = useState(false);
  const [fromDateDropdownPos, setFromDateDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const fromDateTriggerRef = useRef<HTMLDivElement>(null);
  const [fromCalViewDate, setFromCalViewDate] = useState<Date>(new Date());

  const [isToDateOpen, setIsToDateOpen] = useState(false);
  const [toDateDropdownPos, setToDateDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const toDateTriggerRef = useRef<HTMLDivElement>(null);
  const [toCalViewDate, setToCalViewDate] = useState<Date>(new Date());

  const [isMonthYearOpen, setIsMonthYearOpen] = useState(false);
  const [monthYearDropdownPos, setMonthYearDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const monthYearTriggerRef = useRef<HTMLDivElement>(null);
  const [monthYearViewYear, setMonthYearViewYear] = useState<number>(new Date().getFullYear());

  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [statusDropdownPos, setStatusDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const statusTriggerRef = useRef<HTMLDivElement>(null);

  const openDropdown = (type: 'report' | 'fromDate' | 'toDate' | 'monthYear' | 'status') => {
    setIsReportDropdownOpen(type === 'report' ? !isReportDropdownOpen : false);
    setIsFromDateOpen(type === 'fromDate' ? !isFromDateOpen : false);
    setIsToDateOpen(type === 'toDate' ? !isToDateOpen : false);
    setIsMonthYearOpen(type === 'monthYear' ? !isMonthYearOpen : false);
    setIsStatusOpen(type === 'status' ? !isStatusOpen : false);
  };

  // Sync calendar views on open
  useEffect(() => {
    if (isFromDateOpen && fromDate) {
      setFromCalViewDate(new Date(fromDate));
    }
  }, [isFromDateOpen]);

  useEffect(() => {
    if (isToDateOpen && toDate) {
      setToCalViewDate(new Date(toDate));
    }
  }, [isToDateOpen]);

  useEffect(() => {
    if (isMonthYearOpen && monthYear) {
      const parts = monthYear.split("-");
      if (parts[0]) setMonthYearViewYear(parseInt(parts[0]) || new Date().getFullYear());
    }
  }, [isMonthYearOpen]);

  // Position calculation
  useEffect(() => {
    const calcPos = (ref: React.RefObject<HTMLDivElement>, targetWidth = 320, height = 390, matchTriggerWidth = false) => {
      if (!ref.current) return { top: 0, left: 0, width: 0 };
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      let top = rect.bottom + 6;
      if (spaceBelow < 260 && rect.top > height) {
        top = Math.max(10, rect.top - height - 6);
      }
      const width = matchTriggerWidth
        ? Math.max(rect.width, targetWidth)
        : Math.min(targetWidth, window.innerWidth - 20);
      return {
        top,
        left: Math.max(10, Math.min(rect.left, window.innerWidth - width - 10)),
        width
      };
    };

    const updatePositions = () => {
      if (isReportDropdownOpen) setReportDropdownPos(calcPos(reportTriggerRef, 280, 320, true));
      if (isFromDateOpen) setFromDateDropdownPos(calcPos(fromDateTriggerRef, 320, 380, false));
      if (isToDateOpen) setToDateDropdownPos(calcPos(toDateTriggerRef, 320, 380, false));
      if (isMonthYearOpen) setMonthYearDropdownPos(calcPos(monthYearTriggerRef, 320, 340, false));
      if (isStatusOpen) setStatusDropdownPos(calcPos(statusTriggerRef, 280, 200, true));
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);
    window.addEventListener('scroll', updatePositions, true);
    return () => {
      window.removeEventListener('resize', updatePositions);
      window.removeEventListener('scroll', updatePositions, true);
    };
  }, [isReportDropdownOpen, isFromDateOpen, isToDateOpen, isMonthYearOpen, isStatusOpen]);

  /* ---------------- init ---------------- */
  useEffect(() => {
    GROUP("init");
    const user = localStorage.getItem("user");
    if (user) {
      try {
        const parsed = JSON.parse(user);
        setUserData(parsed);
        if (
          parsed.designation !== "Director" &&
          parsed.designation !== "HR" &&
          parsed.designation !== "In-Charge F&A"
        ) {
          setReportType("Salary Generation Details");
        }
        LOG("User loaded:", parsed);
      } catch (e) {
        console.error("[Reports] Failed to parse user from localStorage:", e);
      }
    } else {
      console.warn("[Reports] No user found in localStorage");
    }
    GROUP_END();
  }, []);

  /* ------------- cleanup ------------- */
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  // Calendar Helpers
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const getReportAbbr = (name: string) => {
    if (!name) return "RP";
    const words = name.split(" ").filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getApiUrl = () => {
    const empCode = userData?.empCode || "";
    const userDesig = userData?.designation;
    const formattedFrom = moment(fromDate).format("MM-DD-YYYY");
    const formattedTo = moment(toDate).format("MM-DD-YYYY");
    const monthYearSend = moment(monthYear).format("MM-YYYY");
    const Empcode = userDesig === "Director" || userDesig === "HR" || userDesig === "In-Charge F&A" ? "" : empCode;

    GROUP("build api url");
    LOG("Report Type Selected:", reportType);
    let url = "";
    switch (reportType) {
      case "Employee List":
        url = `ProxyReports/Load_EmployeeList?EMPCODE=${empCode}`;
        break;
      case "Work Report":
        url = `ProxyReports/Load_WorkReport?EMPCODE=${empCode}&FDate=${formattedFrom}&TDate=${formattedTo}`;
        break;
      case "Salary Statement":
        url = `ProxyReports/Load_SalaryStatement?EMPCODE=${Empcode}&MY=${monthYearSend}`;
        break;
      case "Salary Generation Details":
        url = `ProxyReports/Load_SalaryGenerationDetails?EMPCODE=${Empcode}&MY=${monthYearSend}`;
        break;
      case "Salary Generation Abstract":
        url = `ProxyReports/Load_SalaryGenerationAbstract?EMPCODE=${Empcode}&MY=${monthYearSend}`;
        break;
      case "Timings & Leaves":
        url = `ProxyReports/Load_TimingsandLeaves?EMPCODE=${empCode}&FDate=${formattedFrom}&TDate=${formattedTo}`;
        break;
      case "stock":
        url = `ProxyReports/Load_Stock?EMPCODE=${empCode}`;
        break;
      default:
        url = "";
    }
    LOG("Built URL:", url);
    GROUP_END();
    return url;
  };

  const handlePrint = async () => {
    if (!reportType) {
      alert("No Report Option Is Selected...!");
      return;
    }

    const path = getApiUrl();
    const token = (localStorage.getItem("token") || "").replace(/"/g, "");

    try {
      const fullPath = API_BASE.endsWith('/') && path.startsWith('/')
        ? API_BASE + path.slice(1)
        : API_BASE + path;

      const res = await fetch(fullPath, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/pdf"
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Report failed.");
      }

      const blob = await res.blob();
      if (blob.size === 0) throw new Error("Empty PDF received.");

      const pdfUrl = URL.createObjectURL(blob);
      setPdfUrl(pdfUrl);
      setShowPdf(true);

    } catch (error: any) {
      alert("Error loading report: " + error.message);
    }
  };

  const handleClear = () => {
    setReportType(undefined);
    setStatus("Regular");
    setFromDate(moment().format("YYYY-MM-DD"));
    setToDate(moment().format("YYYY-MM-DD"));
    setMonthYear(moment().format("YYYY-MM"));
    setShowPdf(false);
    setPdfUrl("");
  };

  const handleFormat = async () => {
    try {
      const monthYearSend = moment(monthYear).format("MM-YYYY");
      const path = `Reports/Load_TextExport?MY=${monthYearSend}`;

      const token = (localStorage.getItem("token") || "").replace(/"/g, "");

      const fullPath = API_BASE.endsWith("/") && path.startsWith("/")
        ? API_BASE + path.slice(1)
        : API_BASE + path;

      const res = await fetch(fullPath, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("HDFC export failed.");

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition");
      let fileName = `HDFCFORMAT-${monthYearSend}.txt`;

      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          fileName = match[1];
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert("Error exporting HDFC format: " + error.message);
    }
  };

  const handleNonHDFCFormat = async () => {
    try {
      const monthYearSend = moment(monthYear).format("MM-YYYY");
      const path = `Reports/Load_NonHDFCTextExport?MY=${monthYearSend}`;
      const token = (localStorage.getItem("token") || "").replace(/"/g, "");
      const fullPath = API_BASE.endsWith("/") && path.startsWith("/")
        ? API_BASE + path.slice(1)
        : API_BASE + path;

      const res = await fetch(fullPath, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Non HDFC export failed.");

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition");
      let fileName = `NONHDFCFORMAT-${monthYearSend}.txt`;

      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          fileName = match[1];
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert("Error exporting Non HDFC format: " + error.message);
    }
  };

  const userDesig = userData?.designation;

  const reportOptions =
    userDesig === "Director" ||
    userDesig === "HR" ||
    userDesig === "In-Charge F&A"
      ? [
          "Employee List",
          "Salary Statement",
          "Salary Generation Details",
          "Salary Generation Abstract",
          "Work Report",
          "Timings & Leaves",
          "stock",
          "Vouchers",
          "Employee Check-In/s"
        ]
      : [
          "Salary Generation Details"
        ];

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
                <h1 className="page-wr-title">Report Center</h1>
                <p className="page-wr-subtitle">Generate and view your professional reports</p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <div className="page-wr-header-icon-box">
                <IonIcon icon={documentTextOutline} style={{ color: 'var(--ion-color-primary)', fontSize: '24px' }} />
              </div>
            </div>
          </div>

          <div className="stock-panel" style={{ margin: '0 16px 20px 16px' }}>
            <div className="stock-grid">
              
              {/* Employee Input */}
              <div className="stock-field">
                <label>Employee</label>
                <input
                  type="text"
                  className="stock-input"
                  value={userData ? `${userData.empCode} - ${userData.empName}` : ""}
                  readOnly
                  style={{ backgroundColor: 'var(--stock-elevated-bg)' }}
                />
              </div>

              {/* Report Selection */}
              <div className="stock-field">
                <label>Select Report</label>
                <div
                  ref={reportTriggerRef}
                  className={`dbase-inline-select searchable-trigger ${isReportDropdownOpen ? 'active' : ''}`}
                  onClick={() => openDropdown('report')}
                  style={{ width: '100%', minHeight: '38px', background: 'var(--stock-panel-bg)', border: '1px solid var(--stock-border)', borderRadius: 'var(--stock-radius-md)', cursor: 'pointer' }}
                >
                  <span className="dbase-select-text" style={{ fontSize: '13px', fontWeight: reportType ? '700' : '600', color: reportType ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                    {reportType || "--- Choose Report ---"}
                  </span>
                  <IonIcon icon={documentTextOutline} className="select-chevron" />
                </div>
              </div>

              {/* From Date */}
              <div className="stock-field">
                <label>From Date</label>
                <div
                  ref={fromDateTriggerRef}
                  className={`dbase-inline-select searchable-trigger ${isFromDateOpen ? 'active' : ''}`}
                  onClick={() => openDropdown('fromDate')}
                  style={{ width: '100%', minHeight: '38px', background: 'var(--stock-panel-bg)', border: '1px solid var(--stock-border)', borderRadius: 'var(--stock-radius-md)', cursor: 'pointer' }}
                >
                  <span className="dbase-select-text" style={{ fontSize: '13px', fontWeight: fromDate ? '700' : '600', color: fromDate ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                    {fromDate ? moment(fromDate).format("DD-MM-YYYY (ddd)") : "Pick From Date"}
                  </span>
                  <IonIcon icon={calendarOutline} className="select-chevron" />
                </div>
              </div>

              {/* To Date */}
              <div className="stock-field">
                <label>To Date</label>
                <div
                  ref={toDateTriggerRef}
                  className={`dbase-inline-select searchable-trigger ${isToDateOpen ? 'active' : ''}`}
                  onClick={() => openDropdown('toDate')}
                  style={{ width: '100%', minHeight: '38px', background: 'var(--stock-panel-bg)', border: '1px solid var(--stock-border)', borderRadius: 'var(--stock-radius-md)', cursor: 'pointer' }}
                >
                  <span className="dbase-select-text" style={{ fontSize: '13px', fontWeight: toDate ? '700' : '600', color: toDate ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                    {toDate ? moment(toDate).format("DD-MM-YYYY (ddd)") : "Pick To Date"}
                  </span>
                  <IonIcon icon={calendarOutline} className="select-chevron" />
                </div>
              </div>

              {/* Month & Year */}
              <div className="stock-field">
                <label>Month & Year</label>
                <div
                  ref={monthYearTriggerRef}
                  className={`dbase-inline-select searchable-trigger ${isMonthYearOpen ? 'active' : ''}`}
                  onClick={() => openDropdown('monthYear')}
                  style={{ width: '100%', minHeight: '38px', background: 'var(--stock-panel-bg)', border: '1px solid var(--stock-border)', borderRadius: 'var(--stock-radius-md)', cursor: 'pointer' }}
                >
                  <span className="dbase-select-text" style={{ fontSize: '13px', fontWeight: monthYear ? '700' : '600', color: monthYear ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                    {monthYear ? moment(monthYear, "YYYY-MM").format("MMMM YYYY") : "Select Month & Year"}
                  </span>
                  <IonIcon icon={calendarOutline} className="select-chevron" />
                </div>
              </div>

              {/* Status */}
              <div className="stock-field">
                <label>Status</label>
                <div
                  ref={statusTriggerRef}
                  className={`dbase-inline-select searchable-trigger ${isStatusOpen ? 'active' : ''}`}
                  onClick={() => openDropdown('status')}
                  style={{ width: '100%', minHeight: '38px', background: 'var(--stock-panel-bg)', border: '1px solid var(--stock-border)', borderRadius: 'var(--stock-radius-md)', cursor: 'pointer' }}
                >
                  <span className="dbase-select-text" style={{ fontSize: '13px', fontWeight: status ? '700' : '600', color: status ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                    {status || "Select Status"}
                  </span>
                  <IonIcon icon={checkmarkCircleOutline} className="select-chevron" />
                </div>
              </div>
              
            </div>

            {/* Action Buttons */}
            <div className="stock-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: '24px' }}>
              <button className="stock-button" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <IonIcon icon={printOutline} style={{ fontSize: '18px' }} /> Print Report
              </button>
              
              <button className="stock-button stock-button--secondary" onClick={handleClear} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <IonIcon icon={refreshOutline} style={{ fontSize: '18px' }} /> Clear
              </button>

              {(userDesig === "Director" || userDesig === "HR" || userDesig === "In-Charge F&A") && (
                <>
                  <button className="stock-button stock-button--secondary" onClick={handleFormat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <IonIcon icon={downloadOutline} style={{ fontSize: '18px' }} /> HDFC Format
                  </button>
                  <button className="stock-button stock-button--secondary" onClick={handleNonHDFCFormat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <IonIcon icon={downloadOutline} style={{ fontSize: '18px' }} /> Non-HDFC Format
                  </button>
                </>
              )}
            </div>
          </div>

          {/* PDF View Section */}
          {showPdf && (
            <div className="stock-panel" style={{ margin: '0 16px 20px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--stock-border)', marginBottom: '16px' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--stock-text)' }}>Report Preview</span>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ion-color-primary)', fontWeight: 600, fontSize: '13px', textDecoration: 'none' }}>Open in New Tab</a>
              </div>
              
              <iframe src={pdfUrl} title="PDF Preview" style={{ width: '100%', height: '65vh', border: 'none', borderRadius: 'var(--stock-radius-md)', backgroundColor: '#fff' }} />

              <div className="stock-actions" style={{ marginTop: '20px' }}>
                <button
                  className="stock-button"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = pdfUrl;
                    a.download = "report.pdf";
                    a.click();
                  }}
                >
                  <IonIcon icon={downloadOutline} style={{ fontSize: '18px' }} /> Download PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </IonContent>

      {/* ── Report Type Dropdown Portal ── */}
      {isReportDropdownOpen && createPortal(
        <>
          <div
            className="dropdown-outside-click-layer"
            onClick={(e) => {
              e.stopPropagation();
              setIsReportDropdownOpen(false);
            }}
          />
          <div
            className="custom-inline-dropdown"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${reportDropdownPos.top}px`,
              left: `${reportDropdownPos.left}px`,
              width: `${reportDropdownPos.width}px`,
              zIndex: 99999
            }}
          >
            <div className="dropdown-search-sec">
              <Search size={16} className="dropdown-search-icon" />
              <input
                type="text"
                placeholder="Search report..."
                value={reportSearchTerm}
                onChange={(e) => setReportSearchTerm(e.target.value)}
                autoFocus
                className="dropdown-pure-input"
              />
              {reportSearchTerm && (
                <button
                  type="button"
                  className="dropdown-clear-btn"
                  onClick={() => setReportSearchTerm("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="dropdown-body">
              {reportOptions
                .filter((r) => r.toLowerCase().includes(reportSearchTerm.toLowerCase()))
                .map((r, index) => {
                  const isSelected = reportType === r;
                  return (
                    <div
                      key={index}
                      className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setReportType(r);
                        setIsReportDropdownOpen(false);
                        setReportSearchTerm("");
                      }}
                    >
                      <div className={`dr-avatar grad-${index % 5}`}>
                        {getReportAbbr(r)}
                      </div>
                      <div className="dr-info">
                        <span className="dr-name">{r}</span>
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

      {/* ── From Date Dropdown Portal ── */}
      {isFromDateOpen && createPortal(
        <>
          <div
            className="dropdown-outside-click-layer"
            onClick={(e) => {
              e.stopPropagation();
              setIsFromDateOpen(false);
            }}
          />
          <div
            className="custom-inline-dropdown"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${fromDateDropdownPos.top}px`,
              left: `${fromDateDropdownPos.left}px`,
              width: `${fromDateDropdownPos.width}px`,
              zIndex: 99999
            }}
          >
            <div className="dropdown-calendar-container">
              {/* Quick Presets */}
              <div className="dropdown-quick-presets">
                <button
                  type="button"
                  className="dropdown-preset-pill"
                  onClick={() => {
                    setFromDate(moment().format("YYYY-MM-DD"));
                    setIsFromDateOpen(false);
                  }}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="dropdown-preset-pill"
                  onClick={() => {
                    setFromDate(moment().subtract(1, 'day').format("YYYY-MM-DD"));
                    setIsFromDateOpen(false);
                  }}
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  className="dropdown-preset-pill"
                  onClick={() => {
                    setFromDate(moment().subtract(7, 'days').format("YYYY-MM-DD"));
                    setIsFromDateOpen(false);
                  }}
                >
                  7 Days Ago
                </button>
                <button
                  type="button"
                  className="dropdown-preset-pill"
                  onClick={() => {
                    setFromDate(moment().startOf('month').format("YYYY-MM-DD"));
                    setIsFromDateOpen(false);
                  }}
                >
                  Month Start
                </button>
              </div>

              {/* Month Header */}
              <div className="dropdown-calendar-header">
                <button
                  type="button"
                  className="dropdown-cal-nav-btn"
                  onClick={() => {
                    setFromCalViewDate(prev => {
                      const next = new Date(prev);
                      next.setMonth(next.getMonth() - 1);
                      return next;
                    });
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="dropdown-cal-month-title">
                  {moment(fromCalViewDate).format("MMMM YYYY")}
                </span>
                <button
                  type="button"
                  className="dropdown-cal-nav-btn"
                  onClick={() => {
                    setFromCalViewDate(prev => {
                      const next = new Date(prev);
                      next.setMonth(next.getMonth() + 1);
                      return next;
                    });
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Weekdays Row */}
              <div className="dropdown-cal-weekdays">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => (
                  <span key={day} className="dropdown-cal-weekday">{day}</span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="dropdown-cal-days-grid">
                {Array.from({ length: getFirstDayOfMonth(fromCalViewDate.getFullYear(), fromCalViewDate.getMonth()) }).map((_, i) => (
                  <div key={`empty-${i}`} className="dropdown-cal-day-cell empty" />
                ))}

                {Array.from({ length: getDaysInMonth(fromCalViewDate.getFullYear(), fromCalViewDate.getMonth()) }).map((_, i) => {
                  const dayNum = i + 1;
                  const currentMonthYearStr = `${fromCalViewDate.getFullYear()}-${String(fromCalViewDate.getMonth() + 1).padStart(2, '0')}`;
                  const dayDateStr = `${currentMonthYearStr}-${String(dayNum).padStart(2, '0')}`;
                  const isSelected = fromDate === dayDateStr;
                  const isToday = moment().format("YYYY-MM-DD") === dayDateStr;

                  return (
                    <button
                      key={dayNum}
                      type="button"
                      className={`dropdown-cal-day-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                      onClick={() => {
                        setFromDate(dayDateStr);
                        setIsFromDateOpen(false);
                      }}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="dropdown-cal-footer">
              <button
                type="button"
                className="dropdown-action-btn"
                onClick={() => {
                  setFromDate("");
                  setIsFromDateOpen(false);
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="dropdown-done-btn"
                style={{ width: 'auto', padding: '6px 16px' }}
                onClick={() => setIsFromDateOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── To Date Dropdown Portal ── */}
      {isToDateOpen && createPortal(
        <>
          <div
            className="dropdown-outside-click-layer"
            onClick={(e) => {
              e.stopPropagation();
              setIsToDateOpen(false);
            }}
          />
          <div
            className="custom-inline-dropdown"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${toDateDropdownPos.top}px`,
              left: `${toDateDropdownPos.left}px`,
              width: `${toDateDropdownPos.width}px`,
              zIndex: 99999
            }}
          >
            <div className="dropdown-calendar-container">
              {/* Quick Presets */}
              <div className="dropdown-quick-presets">
                <button
                  type="button"
                  className="dropdown-preset-pill"
                  onClick={() => {
                    setToDate(moment().format("YYYY-MM-DD"));
                    setIsToDateOpen(false);
                  }}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="dropdown-preset-pill"
                  onClick={() => {
                    setToDate(moment().add(1, 'day').format("YYYY-MM-DD"));
                    setIsToDateOpen(false);
                  }}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  className="dropdown-preset-pill"
                  onClick={() => {
                    setToDate(moment().endOf('month').format("YYYY-MM-DD"));
                    setIsToDateOpen(false);
                  }}
                >
                  Month End
                </button>
                <button
                  type="button"
                  className="dropdown-preset-pill"
                  onClick={() => {
                    setToDate(moment().add(7, 'days').format("YYYY-MM-DD"));
                    setIsToDateOpen(false);
                  }}
                >
                  +7 Days
                </button>
              </div>

              {/* Month Header */}
              <div className="dropdown-calendar-header">
                <button
                  type="button"
                  className="dropdown-cal-nav-btn"
                  onClick={() => {
                    setToCalViewDate(prev => {
                      const next = new Date(prev);
                      next.setMonth(next.getMonth() - 1);
                      return next;
                    });
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="dropdown-cal-month-title">
                  {moment(toCalViewDate).format("MMMM YYYY")}
                </span>
                <button
                  type="button"
                  className="dropdown-cal-nav-btn"
                  onClick={() => {
                    setToCalViewDate(prev => {
                      const next = new Date(prev);
                      next.setMonth(next.getMonth() + 1);
                      return next;
                    });
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Weekdays Row */}
              <div className="dropdown-cal-weekdays">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => (
                  <span key={day} className="dropdown-cal-weekday">{day}</span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="dropdown-cal-days-grid">
                {Array.from({ length: getFirstDayOfMonth(toCalViewDate.getFullYear(), toCalViewDate.getMonth()) }).map((_, i) => (
                  <div key={`empty-${i}`} className="dropdown-cal-day-cell empty" />
                ))}

                {Array.from({ length: getDaysInMonth(toCalViewDate.getFullYear(), toCalViewDate.getMonth()) }).map((_, i) => {
                  const dayNum = i + 1;
                  const currentMonthYearStr = `${toCalViewDate.getFullYear()}-${String(toCalViewDate.getMonth() + 1).padStart(2, '0')}`;
                  const dayDateStr = `${currentMonthYearStr}-${String(dayNum).padStart(2, '0')}`;
                  const isSelected = toDate === dayDateStr;
                  const isToday = moment().format("YYYY-MM-DD") === dayDateStr;

                  return (
                    <button
                      key={dayNum}
                      type="button"
                      className={`dropdown-cal-day-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                      onClick={() => {
                        setToDate(dayDateStr);
                        setIsToDateOpen(false);
                      }}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="dropdown-cal-footer">
              <button
                type="button"
                className="dropdown-action-btn"
                onClick={() => {
                  setToDate("");
                  setIsToDateOpen(false);
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="dropdown-done-btn"
                style={{ width: 'auto', padding: '6px 16px' }}
                onClick={() => setIsToDateOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── Month & Year Dropdown Portal ── */}
      {isMonthYearOpen && createPortal(
        <>
          <div
            className="dropdown-outside-click-layer"
            onClick={(e) => {
              e.stopPropagation();
              setIsMonthYearOpen(false);
            }}
          />
          <div
            className="custom-inline-dropdown"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${monthYearDropdownPos.top}px`,
              left: `${monthYearDropdownPos.left}px`,
              width: `${monthYearDropdownPos.width}px`,
              zIndex: 99999
            }}
          >
            <div className="dropdown-monthyear-container">
              {/* Quick Presets */}
              <div className="dropdown-quick-presets" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <button
                  type="button"
                  className="dropdown-preset-pill"
                  onClick={() => {
                    setMonthYear(moment().format("YYYY-MM"));
                    setIsMonthYearOpen(false);
                  }}
                >
                  This Month
                </button>
                <button
                  type="button"
                  className="dropdown-preset-pill"
                  onClick={() => {
                    setMonthYear(moment().subtract(1, 'month').format("YYYY-MM"));
                    setIsMonthYearOpen(false);
                  }}
                >
                  Last Month
                </button>
                <button
                  type="button"
                  className="dropdown-preset-pill"
                  onClick={() => {
                    setMonthYear(moment().add(1, 'month').format("YYYY-MM"));
                    setIsMonthYearOpen(false);
                  }}
                >
                  Next Month
                </button>
              </div>

              {/* Year Navigator */}
              <div className="dropdown-calendar-header" style={{ marginBottom: '8px' }}>
                <button
                  type="button"
                  className="dropdown-cal-nav-btn"
                  onClick={() => setMonthYearViewYear(prev => prev - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="dropdown-cal-month-title">
                  Year {monthYearViewYear}
                </span>
                <button
                  type="button"
                  className="dropdown-cal-nav-btn"
                  onClick={() => setMonthYearViewYear(prev => prev + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Months Grid (12 Months) */}
              <div className="dropdown-months-grid">
                {monthsList.map((m, index) => {
                  const mVal = `${monthYearViewYear}-${String(index + 1).padStart(2, '0')}`;
                  const isSelected = monthYear === mVal;
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`dropdown-month-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setMonthYear(mVal);
                        setIsMonthYearOpen(false);
                      }}
                    >
                      {m.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="dropdown-cal-footer">
              <button
                type="button"
                className="dropdown-action-btn"
                onClick={() => {
                  setMonthYear("");
                  setIsMonthYearOpen(false);
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="dropdown-done-btn"
                style={{ width: 'auto', padding: '6px 16px' }}
                onClick={() => setIsMonthYearOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── Status Dropdown Portal ── */}
      {isStatusOpen && createPortal(
        <>
          <div
            className="dropdown-outside-click-layer"
            onClick={(e) => {
              e.stopPropagation();
              setIsStatusOpen(false);
            }}
          />
          <div
            className="custom-inline-dropdown"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${statusDropdownPos.top}px`,
              left: `${statusDropdownPos.left}px`,
              width: `${statusDropdownPos.width}px`,
              zIndex: 99999
            }}
          >
            <div className="dropdown-body">
              {["Regular", "Irregular"].map((s, index) => {
                const isSelected = status === s;
                return (
                  <div
                    key={s}
                    className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setStatus(s);
                      setIsStatusOpen(false);
                    }}
                  >
                    <div className={`dr-avatar grad-${index % 5}`}>
                      {s.charAt(0)}
                    </div>
                    <div className="dr-info">
                      <span className="dr-name">{s}</span>
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
    </IonPage>
  );
};

export default Reports;
