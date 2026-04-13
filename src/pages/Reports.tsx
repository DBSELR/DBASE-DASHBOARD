import React, { useState, useEffect } from "react";
import moment from "moment";
import { API_BASE } from "../config";
import "./Reports.css";

const LOG = (...args: any[]) => console.log("[Reports]", ...args);
const GROUP = (title: string) => console.group("[Reports]", title);
const GROUP_END = () => console.groupEnd();

const Reports: React.FC = () => {
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
    const Empcode = userDesig === "Director" || userDesig === "In-Charge F&A" ? "" : empCode;

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

      const fullPath = API_BASE.endsWith('/') && path.startsWith('/')
        ? API_BASE + path.slice(1)
        : API_BASE + path;

      const res = await fetch(fullPath, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Format export failed.");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url);
    } catch (error: any) {
      alert("Error exporting format: " + error.message);
    }
  };

  return (
    <div className="rpt-main-container">
      <header className="rpt-header rpt-fade-in stagger-1 premium-trendy-bg">
        <h2>Report Center</h2>
        <p>Generate and view your professional reports</p>
      </header>

      <div className="rpt-card rpt-fade-in stagger-2">
        <div className="rpt-form-grid">
          {/* User Info */}
          <div className="rpt-input-group">
            <label className="rpt-label">Employee</label>
            <input
              type="text"
              className="rpt-input"
              value={userData ? `${userData.empCode} - ${userData.empName}` : ""}
              readOnly
            />
          </div>

          {/* Report Selection */}
          <div className="rpt-input-group">
            <label className="rpt-label">Select Report</label>
            <select
              className="rpt-select"
              value={reportType || ""}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="" disabled>--- Choose Report ---</option>
              <option value="Employee List">Employee List</option>
              <option value="Salary Statement">Salary Statement</option>
              <option value="Salary Generation Details">Salary Generation Details</option>
              <option value="Salary Generation Abstract">Salary Generation Abstract</option>
              <option value="Work Report">Work Report</option>
              <option value="Timings & Leaves">Timings & Leaves</option>
              <option value="stock">Stock</option>
              <option value="Vouchers">Vouchers</option>
              <option value="Employee Check-In/s">Employee Check-In/s</option>
            </select>
          </div>

          {/* From Date */}
          <div className="rpt-input-group">
            <label className="rpt-label">From Date</label>
            <input
              type="date"
              className="rpt-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          {/* To Date */}
          <div className="rpt-input-group">
            <label className="rpt-label">To Date</label>
            <input
              type="date"
              className="rpt-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          {/* Month & Year */}
          <div className="rpt-input-group">
            <label className="rpt-label">Month & Year</label>
            <input
              type="month"
              className="rpt-input"
              value={monthYear}
              onChange={(e) => setMonthYear(e.target.value)}
            />
          </div>

          {/* Status */}
          <div className="rpt-input-group">
            <label className="rpt-label">Status</label>
            <select
              className="rpt-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="Regular">Regular</option>
              <option value="Irregular">Irregular</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="rpt-actions rpt-fade-in stagger-3">
          <button className="rpt-btn rpt-btn-primary premium-trendy-bg" onClick={handlePrint}>
            <span style={{ color: '#fff' }}>Print Report</span>
          </button>
          <button className="rpt-btn rpt-btn-secondary" onClick={handleClear}>
            <span>Clear Fields</span>
          </button>
          <button className="rpt-btn rpt-btn-tertiary" onClick={handleFormat}>
            <span>Export Format</span>
          </button>
        </div>
      </div>

      {/* PDF View Section */}
      {showPdf && (
        <div className="rpt-preview-section rpt-fade-in">
          <div className="rpt-preview-header">
            <span>Report Preview</span>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">Open in New Tab</a>
          </div>
          <iframe src={pdfUrl} className="rpt-iframe" title="PDF Preview" />

          <div style={{ padding: "10px 24px 24px" }}>
            <button
              className="rpt-btn rpt-btn-primary"
              style={{ width: "100%" }}
              onClick={() => {
                const a = document.createElement("a");
                a.href = pdfUrl;
                a.download = "report.pdf";
                a.click();
              }}
            >
              Download PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
