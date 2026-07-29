import React, { useState, useEffect } from "react";
import moment from "moment";
import { API_BASE } from "../config";
import { useHistory } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { IonPage, IonContent, IonIcon } from "@ionic/react";
import { documentTextOutline, downloadOutline, refreshOutline, printOutline } from "ionicons/icons";
import "./Stock.css";

const LOG = (...args: any[]) => console.log("[Reports]", ...args);
const GROUP = (title: string) => console.group("[Reports]", title);
const GROUP_END = () => console.groupEnd();

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
                <div className="stock-select-wrapper">
                  <select
                    className="stock-select"
                    value={reportType || ""}
                    onChange={(e) => setReportType(e.target.value)}
                  >
                    <option value="" disabled>--- Choose Report ---</option>
                    {reportOptions.map((report) => (
                      <option key={report} value={report}>{report}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* From Date */}
              <div className="stock-field">
                <label>From Date</label>
                <input
                  type="date"
                  className="stock-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              {/* To Date */}
              <div className="stock-field">
                <label>To Date</label>
                <input
                  type="date"
                  className="stock-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>

              {/* Month & Year */}
              <div className="stock-field">
                <label>Month & Year</label>
                <input
                  type="month"
                  className="stock-input"
                  value={monthYear}
                  onChange={(e) => setMonthYear(e.target.value)}
                />
              </div>

              {/* Status */}
              <div className="stock-field">
                <label>Status</label>
                <div className="stock-select-wrapper">
                  <select
                    className="stock-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="Regular">Regular</option>
                    <option value="Irregular">Irregular</option>
                  </select>
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
    </IonPage>
  );
};

export default Reports;
