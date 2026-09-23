import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { API_BASE } from "../config";
import { useHistory } from "react-router-dom";
import {
  IonPage,
  IonContent,
  IonIcon
} from "@ionic/react";
import {
  documentTextOutline,
  warningOutline
} from "ionicons/icons";
import {
  ChevronLeft,
  Search,
  X,
  PlusCircle,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Calendar,
  ExternalLink,
  Eye,
  Printer,
  User,
  RefreshCw,
  FileSpreadsheet,
  ChevronRight,
  Bot,
  UserCheck,
  Paperclip,
  CheckCircle,
  FileText,
  Upload
} from "lucide-react";

import "./WorkReports.css";
import "./RequestsPage.css";
import "./Stock.css";
import "./PenaltyList.css";

interface EmployeeSummary {
  EMPCODE: string;
  EMPNAME: string;
  YellowSlips: number;
  RedSlips: number;
  OrangeSlips?: number;
  GreenSlips?: number;
  EscalationStatus: string;
  Designation?: string;
  Department?: string;
  Branch?: string;
  TotalViolations?: number;
}

interface ViolationDetail {
  Id: number;
  EmpCode: string;
  PenaltyId: number;
  PenaltyDate: string;
  ViolationTime: any;
  Remarks: string;
  SlipType: string;
  SlipCount: number;
  Status: string;
  AppliedBy: string;
  AppliedDate: string;
  ProofFileName: string | null;
  ProofFilePath: any;
  ProofFileType: string | null;
}

interface PenaltyMasterItem {
  Id: number;
  PenaltyType: string;
  FrequencyType?: string;
  SlipType: string;
  SlipCount: number;
}

interface AllEmployeeItem {
  EmpCode: string;
  EmpName: string;
  Designation?: string;
  BranchDept?: string;
}

function PenaltyList() {
  const history = useHistory();
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("SEVERITY_DESC");

  // Master Data
  const [penaltiesMaster, setPenaltiesMaster] = useState<PenaltyMasterItem[]>([]);
  const [allEmployeesList, setAllEmployeesList] = useState<AllEmployeeItem[]>([]);

  // Selected employee for the console drawer
  const [selectedEmp, setSelectedEmp] = useState<EmployeeSummary | null>(null);
  const [details, setDetails] = useState<{ [empCode: string]: ViolationDetail[] }>({});
  const [drawerLoading, setDrawerLoading] = useState<boolean>(false);

  // Evidence Lightbox modal
  const [lightboxEvidence, setLightboxEvidence] = useState<{
    url: string;
    title: string;
    remarks?: string;
    date?: string;
  } | null>(null);

  // Integrated Issue Penalty Modal State
  const [isIssueModalOpen, setIsIssueModalOpen] = useState<boolean>(false);
  const [submittingPenalty, setSubmittingPenalty] = useState<boolean>(false);
  const [issueForm, setIssueForm] = useState({
    penaltyId: "",
    penaltyDate: new Date().toISOString().slice(0, 10),
    violationTime: "",
    employeeCodes: [] as string[],
    remarks: ""
  });
  const [issueProofFile, setIssueProofFile] = useState<File | null>(null);

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentEmpCode = currentUser.empCode || currentUser.EMPCODE || "Admin";

  useEffect(() => {
    loadSummary();
    loadMasterData();
  }, []);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}Penalty/GetEmployeeSlipSummary`);
      setEmployees(res.data || []);
    } catch (err) {
      console.error("Failed to load penalty summary:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadMasterData = async () => {
    try {
      const token = localStorage.getItem("token");
      // Load Penalty Master
      const penRes = await axios.get(`${API_BASE}Penalty/GetPenaltyMaster`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPenaltiesMaster(penRes.data || []);

      // Load All Employees for assignment picker
      const empRes = await axios.get(`${API_BASE}Employee/Load_Employees`);
      setAllEmployeesList(empRes.data || []);
    } catch (err) {
      console.error("Failed to load penalty master or employee list:", err);
    }
  };

  // Build lookup map for penalty type by PenaltyId
  const penaltyMap = useMemo(() => {
    const map: { [id: number]: { PenaltyType: string; SlipType: string; SlipCount: number } } = {};
    (penaltiesMaster || []).forEach((p: any) => {
      const id = Number(p.id !== undefined ? p.id : p.Id);
      const penaltyType = p.penaltyType || p.PenaltyType || "";
      const slipType = p.slipType || p.SlipType || "Yellow Slip";
      const slipCount = Number(p.slipCount !== undefined ? p.slipCount : (p.SlipCount ?? 1));
      if (id) {
        map[id] = { PenaltyType: penaltyType, SlipType: slipType, SlipCount: slipCount };
      }
    });
    return map;
  }, [penaltiesMaster]);

  // Open employee console drawer and load violation history
  const openEmployeeConsole = async (emp: EmployeeSummary) => {
    setSelectedEmp(emp);
    const empCode = emp.EMPCODE;

    if (!details[empCode]) {
      setDrawerLoading(true);
      try {
        const res = await axios.get(`${API_BASE}Penalty/GetEmployeePenaltyDetails/${empCode}`);
        setDetails((prev) => ({
          ...prev,
          [empCode]: res.data || []
        }));
      } catch (err) {
        console.error("Failed to load violation details for " + empCode, err);
      } finally {
        setDrawerLoading(false);
      }
    }
  };

  const refreshSelectedEmpDetails = async (empCode: string) => {
    setDrawerLoading(true);
    try {
      const res = await axios.get(`${API_BASE}Penalty/GetEmployeePenaltyDetails/${empCode}`);
      setDetails((prev) => ({
        ...prev,
        [empCode]: res.data || []
      }));
    } catch (err) {
      console.error("Failed to refresh details for " + empCode, err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const closeEmployeeConsole = () => {
    setSelectedEmp(null);
  };

  // Open Issue Penalty Modal
  const openIssuePenaltyModal = (preselectedEmpCode?: string) => {
    const firstP: any = penaltiesMaster[0];
    const firstId = firstP ? String(firstP.id ?? firstP.Id ?? "") : "";
    setIssueForm({
      penaltyId: firstId,
      penaltyDate: new Date().toISOString().slice(0, 10),
      violationTime: "",
      employeeCodes: preselectedEmpCode
        ? [preselectedEmpCode]
        : selectedEmp
        ? [selectedEmp.EMPCODE]
        : [],
      remarks: ""
    });
    setIssueProofFile(null);
    setIsIssueModalOpen(true);
  };

  // Submit Issue Penalty
  const handleIssuePenaltySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!issueForm.penaltyId) {
      alert("Please select a Penalty Type");
      return;
    }
    if (!issueForm.penaltyDate) {
      alert("Please select a Penalty Date");
      return;
    }
    if (issueForm.employeeCodes.length === 0) {
      alert("Please select at least one Employee");
      return;
    }

    setSubmittingPenalty(true);
    try {
      const data = new FormData();
      data.append("PenaltyId", issueForm.penaltyId);
      data.append("PenaltyDate", issueForm.penaltyDate);
      if (issueForm.violationTime) {
        data.append("ViolationTime", issueForm.violationTime);
      }
      data.append("Remarks", issueForm.remarks || "");
      data.append("AppliedBy", currentEmpCode);

      issueForm.employeeCodes.forEach((emp) => {
        data.append("EmployeeCodes", emp);
      });

      if (issueProofFile) {
        data.append("ProofFile", issueProofFile);
      }

      await axios.post(`${API_BASE}Penalty/ApplyPenalty`, data, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      alert("Penalty Applied Successfully");
      setIsIssueModalOpen(false);

      // Refresh list & current employee details
      loadSummary();
      if (selectedEmp) {
        refreshSelectedEmpDetails(selectedEmp.EMPCODE);
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.message || err?.response?.data || "Error Applying Penalty");
    } finally {
      setSubmittingPenalty(false);
    }
  };

  // ── Bulletproof Date & Time Parsers (NO MORE [object Object] OR Invalid Date) ──
  const formatViolationTime = (timeVal: any, penaltyDateVal?: string): string => {
    if (!timeVal) return "-";

    // Handle .NET TimeSpan serialized object { hours, minutes, seconds, ticks, ... }
    if (typeof timeVal === "object" && timeVal !== null) {
      if (timeVal.hours !== undefined && timeVal.minutes !== undefined) {
        const h = Number(timeVal.hours);
        const m = Number(timeVal.minutes);
        const s = Number(timeVal.seconds || 0);
        if (h === 0 && m === 0 && s === 0 && (!timeVal.ticks || timeVal.ticks === 0)) {
          return "Policy Trigger";
        }
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
      }
      if (timeVal.value && typeof timeVal.value === "string") {
        timeVal = timeVal.value;
      } else {
        return "Policy Trigger";
      }
    }

    let timeStr = typeof timeVal === "string" ? timeVal.trim() : String(timeVal).trim();
    if (
      !timeStr ||
      timeStr === "null" ||
      timeStr === "undefined" ||
      timeStr === "[object Object]" ||
      timeStr.startsWith("0001-01-01")
    ) {
      return "-";
    }

    // Pure time format e.g. "14:30" or "14:30:00"
    const timeOnlyMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeOnlyMatch) {
      let hours = parseInt(timeOnlyMatch[1], 10);
      const minutes = timeOnlyMatch[2];
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      return `${hours}:${minutes} ${ampm}`;
    }

    // Standard ISO/Date parsing
    const parsed = new Date(timeStr);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      if (year > 1900) {
        return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
      }
    }

    // Try combining with penaltyDateVal
    if (penaltyDateVal) {
      const datePart = penaltyDateVal.split("T")[0];
      const combined = new Date(`${datePart}T${timeStr}`);
      if (!isNaN(combined.getTime())) {
        return combined.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
      }
    }

    return timeStr === "[object Object]" ? "-" : (timeStr || "-");
  };

  const formatViolationDate = (dateVal: string): string => {
    if (!dateVal) return "-";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return dateVal;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  // Helper to resolve the Penalty Type title from PenaltyId or Remarks
  const getPenaltyTypeName = (item: ViolationDetail): string => {
    // 1. Direct match with PenaltyId in Penalty Master
    const pid = Number(item.PenaltyId);
    if (pid && penaltyMap[pid] && penaltyMap[pid].PenaltyType) {
      return penaltyMap[pid].PenaltyType;
    }

    // 2. Direct property from backend if provided
    if ((item as any).PenaltyType || (item as any).penaltyType) {
      return (item as any).PenaltyType || (item as any).penaltyType;
    }

    // 3. Fallback matching against specific policy triggers in remarks
    const rem = (item.Remarks || "").toLowerCase();
    if (rem.includes("late occasions") || rem.includes("exceeded monthly 10 late") || rem.includes("late threshold")) {
      return "Late Arrival / Policy Violation";
    }
    if (rem.includes("permission") || rem.includes("excess permission")) {
      return "Excess Permissions";
    }
    if (rem.includes("mobile") || rem.includes("phone")) {
      return "Personal Mobile Misuse";
    }
    if (rem.includes("id card") || rem.includes("wear id")) {
      return "Failure to Wear ID Card";
    }
    if (rem.includes("dress") || rem.includes("uniform")) {
      return "Dress Code Violation";
    }
    if (rem.includes("gathering")) {
      return "Unnecessary Gatherings";
    }
    if (rem.includes("food") || rem.includes("hygiene")) {
      return "Food / Hygiene Violation";
    }
    if (rem.includes("misconduct") || rem.includes("client")) {
      return "Client / On-site Misconduct";
    }
    if (rem.includes("sleep") || rem.includes("duty")) {
      return "Sleeping During Duty";
    }
    if (rem.includes("fraud") || rem.includes("data breach")) {
      return "Data Breach / Fraud";
    }
    if (rem.includes("quarrel") || rem.includes("disobedience")) {
      return "Disobedience / Quarrel";
    }
    if (rem.includes("english")) {
      return "Failure to Comms in English";
    }
    if (rem.includes("unauthorized") || rem.includes("leave") || rem.includes("od")) {
      return "Unauthorized Leave / OD";
    }
    if (rem.includes("double lop")) {
      return "Double LOP Penalty";
    }

    return "Late Coming";
  };

  // Helper to summarize Penalty Type for an employee card
  const getEmployeePenaltyTypeSummary = (emp: EmployeeSummary): string => {
    const empDetails = details[emp.EMPCODE];
    if (empDetails && empDetails.length > 0) {
      const types = Array.from(new Set(empDetails.map((d) => getPenaltyTypeName(d))));
      return types.slice(0, 2).join(", ") + (types.length > 2 ? ` (+${types.length - 2} more)` : "");
    }
    if ((emp.YellowSlips || 0) >= 4) {
      return "Late Arrival / Policy Violation";
    }
    if ((emp.RedSlips || 0) > 0) {
      return "Client / Misconduct";
    }
    return "Late Coming";
  };

  // ── Robust Proof URL Sanitizer ──
  const getProofUrl = (path: any): string => {
    if (!path) return "";
    let clean = "";
    if (typeof path === "string") {
      clean = path.trim();
    } else if (typeof path === "object") {
      clean = (path.filePath || path.url || path.ProofFilePath || path.fileName || path.path || "").toString().trim();
    }

    if (!clean || clean.includes("[object Object]") || clean.includes("[object%20Object]")) {
      return "";
    }

    if (clean.startsWith("http://") || clean.startsWith("https://")) {
      return clean;
    }

    const base = API_BASE.replace("api/", "");
    const normalized = clean.startsWith("/") ? clean.slice(1) : clean;
    return `${base}${normalized}`;
  };

  const isImageFile = (url: string): boolean => {
    return /\.(jpe?g|png|webp|gif|bmp)(\?.*)?$/i.test(url);
  };

  const isAutoSlip = (remarks?: string): boolean => {
    if (!remarks) return false;
    const lower = remarks.toLowerCase();
    return (
      lower.includes("automatic") ||
      lower.includes("late occasions") ||
      lower.includes("threshold") ||
      lower.includes("excess permission") ||
      lower.includes("double lop") ||
      lower.includes("system policy")
    );
  };

  // ── KPI Calculations ──
  const kpis = useMemo(() => {
    const totalStaff = employees.length;
    let disciplinaryCount = 0;
    let managerEscCount = 0;
    let hrWarningCount = 0;
    let totalYellow = 0;
    let totalRed = 0;

    employees.forEach((emp) => {
      totalYellow += emp.YellowSlips || 0;
      totalRed += emp.RedSlips || 0;
      const status = (emp.EscalationStatus || "").toLowerCase();
      if (status.includes("disciplinary")) {
        disciplinaryCount++;
      } else if (status.includes("manager")) {
        managerEscCount++;
      } else if (status.includes("hr warning")) {
        hrWarningCount++;
      }
    });

    const totalEscalations = disciplinaryCount + managerEscCount + hrWarningCount;

    return {
      totalStaff,
      totalEscalations,
      disciplinaryCount,
      hrWarningCount,
      totalYellow,
      totalRed
    };
  }, [employees]);

  // ── Filtering and Sorting ──
  const filteredEmployees = useMemo(() => {
    let result = employees.filter((e) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        (e.EMPNAME && e.EMPNAME.toLowerCase().includes(q)) ||
        (e.EMPCODE && e.EMPCODE.toLowerCase().includes(q)) ||
        (e.Department && e.Department.toLowerCase().includes(q));

      if (!matchSearch) return false;

      const status = (e.EscalationStatus || "").toLowerCase();
      if (statusFilter === "CRITICAL") {
        return status.includes("disciplinary") || status.includes("manager");
      }
      if (statusFilter === "HR_WARNING") {
        return status.includes("hr warning");
      }
      if (statusFilter === "NORMAL") {
        return status.includes("normal") || !status;
      }
      if (statusFilter === "RED_SLIPS") {
        return (e.RedSlips || 0) > 0;
      }
      if (statusFilter === "YELLOW_SLIPS") {
        return (e.YellowSlips || 0) > 0;
      }
      return true;
    });

    result.sort((a, b) => {
      if (sortBy === "SLIPS_DESC") {
        const totalA = (a.YellowSlips || 0) + (a.RedSlips || 0) * 3;
        const totalB = (b.YellowSlips || 0) + (b.RedSlips || 0) * 3;
        return totalB - totalA;
      }
      if (sortBy === "SEVERITY_DESC") {
        const rank = (status: string) => {
          const s = (status || "").toLowerCase();
          if (s.includes("disciplinary")) return 4;
          if (s.includes("manager")) return 3;
          if (s.includes("hr warning")) return 2;
          return 1;
        };
        return rank(b.EscalationStatus) - rank(a.EscalationStatus);
      }
      if (sortBy === "NAME_ASC") {
        return (a.EMPNAME || "").localeCompare(b.EMPNAME || "");
      }
      return 0;
    });

    return result;
  }, [employees, search, statusFilter, sortBy]);

  // ── CSV Export Functionality ──
  const exportSummaryCsv = () => {
    if (filteredEmployees.length === 0) {
      alert("No employee records to export.");
      return;
    }

    const headers = ["Employee Code", "Employee Name", "Yellow Slips", "Red Slips", "Escalation Status"];
    const rows = filteredEmployees.map((e) => [
      `"${e.EMPCODE}"`,
      `"${(e.EMPNAME || "").replace(/"/g, '""')}"`,
      e.YellowSlips || 0,
      e.RedSlips || 0,
      `"${e.EscalationStatus || "Normal"}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Penalty_Records_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Printable Disciplinary Sheet ──
  const printEmployeeRecord = (emp: EmployeeSummary) => {
    const empDetails = details[emp.EMPCODE] || [];
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the disciplinary sheet.");
      return;
    }

    const rowsHtml = empDetails.length > 0
      ? empDetails
          .map(
            (d) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${getPenaltyTypeName(d)}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formatViolationDate(d.PenaltyDate)}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formatViolationTime(d.ViolationTime, d.PenaltyDate)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${d.SlipType} (x${d.SlipCount})</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${d.Remarks || "-"}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${d.AppliedBy || "System"}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${d.Status || "Applied"}</td>
        </tr>
      `
          )
          .join("")
      : `<tr><td colspan="7" style="text-align:center; padding: 12px; color: #888;">No details available</td></tr>`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Disciplinary Record - ${emp.EMPNAME} (${emp.EMPCODE})</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; }
            h2 { margin-bottom: 4px; }
            .header-box { border-bottom: 2px solid #334155; padding-bottom: 12px; margin-bottom: 20px; }
            .meta { font-size: 13px; color: #64748b; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
            th { background: #f1f5f9; padding: 8px; border: 1px solid #ddd; text-align: left; }
          </style>
        </head>
        <body>
          <div class="header-box">
            <h2>Employee Disciplinary Record</h2>
            <div class="meta">
              <strong>Employee:</strong> ${emp.EMPNAME} (${emp.EMPCODE}) &nbsp;|&nbsp;
              <strong>Status:</strong> ${emp.EscalationStatus || "Normal"} &nbsp;|&nbsp;
              <strong>Yellow Slips:</strong> ${emp.YellowSlips || 0} &nbsp;|&nbsp;
              <strong>Red Slips:</strong> ${emp.RedSlips || 0}
            </div>
          </div>
          <h3>Violation History &amp; Audit Trail</h3>
          <table>
            <thead>
              <tr>
                <th>Penalty Type</th>
                <th>Penalty Date</th>
                <th>Violation Time</th>
                <th>Slip Type</th>
                <th>Remarks</th>
                <th>Applied By</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div style="margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #eee; padding-top: 8px;">
            Generated on ${new Date().toLocaleString()} &bull; DBS Disciplinary Operations Console
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getEscClass = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s.includes("disciplinary")) return "esc-disciplinary";
    if (s.includes("manager")) return "esc-manager";
    if (s.includes("hr warning")) return "esc-hr-warning";
    return "esc-normal";
  };

  return (
    <IonPage>
      <IonContent className="page-content" fullscreen>
        <div className="penalty-console-root">

          {/* ── Top Header ── */}
          <div className="p-console-header">
            <div className="p-console-header-top">
              <div className="p-header-left">
                <button
                  className="p-back-btn"
                  onClick={() => history.goBack()}
                  title="Go back"
                >
                  <ChevronLeft size={22} />
                </button>
                <div>
                  <h1 className="p-header-title">Penalty Console</h1>
                  <p className="p-header-subtitle">
                    Employee disciplinary &amp; slip monitoring console
                  </p>
                </div>
              </div>

              <div className="p-header-actions">
                <button
                  className="p-action-btn p-action-btn--glass"
                  onClick={exportSummaryCsv}
                  title="Export to CSV"
                >
                  <FileSpreadsheet size={15} />
                  <span>Export</span>
                </button>
                <button
                  className="p-action-btn p-action-btn--primary"
                  onClick={() => openIssuePenaltyModal()}
                  title="Issue new penalty slip"
                >
                  <PlusCircle size={15} />
                  <span>Issue Slip</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Executive KPI Grid ── */}
          <div className="p-kpi-grid">
            <div className="p-kpi-card staff">
              <div className="p-kpi-info">
                <span className="p-kpi-label">Penalized Staff</span>
                <span className="p-kpi-value">{kpis.totalStaff}</span>
                <span className="p-kpi-sub">Active staff on record</span>
              </div>
              <div className="p-kpi-icon-box staff">
                <User size={20} />
              </div>
            </div>

            <div className="p-kpi-card escalation">
              <div className="p-kpi-info">
                <span className="p-kpi-label">Critical Escalations</span>
                <span className="p-kpi-value">{kpis.totalEscalations}</span>
                <span className="p-kpi-sub">{kpis.hrWarningCount} HR Warnings</span>
              </div>
              <div className="p-kpi-icon-box escalation">
                <ShieldAlert size={20} />
              </div>
            </div>

            <div className="p-kpi-card yellow">
              <div className="p-kpi-info">
                <span className="p-kpi-label">Total Yellow</span>
                <span className="p-kpi-value">{kpis.totalYellow}</span>
                <span className="p-kpi-sub">Standard infractions</span>
              </div>
              <div className="p-kpi-icon-box yellow">
                <AlertTriangle size={20} />
              </div>
            </div>

            <div className="p-kpi-card red">
              <div className="p-kpi-info">
                <span className="p-kpi-label">Total Red Slips</span>
                <span className="p-kpi-value">{kpis.totalRed}</span>
                <span className="p-kpi-sub">Severe violations</span>
              </div>
              <div className="p-kpi-icon-box red">
                <IonIcon icon={warningOutline} style={{ fontSize: "20px" }} />
              </div>
            </div>
          </div>

          {/* ── Control Panel: Search, Filter Chips, Sort ── */}
          <div className="p-control-panel">
            <div className="p-search-wrapper">
              <Search size={18} color="#94a3b8" />
              <input
                type="text"
                className="p-search-input"
                placeholder="Search by employee name, code, or department..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="p-clear-btn"
                  onClick={() => setSearch("")}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="p-filter-row">
              <div className="p-chips-group">
                <button
                  className={`p-chip ${statusFilter === "ALL" ? "active" : ""}`}
                  onClick={() => setStatusFilter("ALL")}
                >
                  All ({employees.length})
                </button>
                <button
                  className={`p-chip ${statusFilter === "CRITICAL" ? "active critical" : ""}`}
                  onClick={() => setStatusFilter("CRITICAL")}
                >
                  <ShieldAlert size={13} />
                  Disciplinary / Mgr
                </button>
                <button
                  className={`p-chip ${statusFilter === "HR_WARNING" ? "active warning" : ""}`}
                  onClick={() => setStatusFilter("HR_WARNING")}
                >
                  <AlertTriangle size={13} />
                  HR Warning
                </button>
                <button
                  className={`p-chip ${statusFilter === "RED_SLIPS" ? "active" : ""}`}
                  onClick={() => setStatusFilter("RED_SLIPS")}
                >
                  Has Red Slips
                </button>
                <button
                  className={`p-chip ${statusFilter === "NORMAL" ? "active" : ""}`}
                  onClick={() => setStatusFilter("NORMAL")}
                >
                  Normal
                </button>
              </div>

              <select
                className="p-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="SEVERITY_DESC">Severity (High to Low)</option>
                <option value="SLIPS_DESC">Most Slips</option>
                <option value="NAME_ASC">Name (A &rarr; Z)</option>
              </select>
            </div>
          </div>

          {/* ── Employee Penalty Cards List ── */}
          <div className="p-list-container">
            {loading ? (
              <div className="p-empty-state">
                <RefreshCw size={28} className="animate-spin" color="#3b82f6" />
                <h4 className="p-empty-title">Loading Penalty Records...</h4>
                <p className="p-empty-desc">Fetching live penalty and slip summaries.</p>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="p-empty-state">
                <IonIcon
                  icon={warningOutline}
                  style={{ fontSize: "42px", color: "#94a3b8" }}
                />
                <h4 className="p-empty-title">No Matching Records</h4>
                <p className="p-empty-desc">
                  No penalty records found matching the current search query or filter.
                </p>
                {(search || statusFilter !== "ALL") && (
                  <button
                    className="p-chip"
                    style={{ marginTop: "12px", background: "#1e293b", color: "#ffffff" }}
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("ALL");
                    }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              filteredEmployees.map((emp) => {
                const escClass = getEscClass(emp.EscalationStatus);
                const isSelected = selectedEmp?.EMPCODE === emp.EMPCODE;

                return (
                  <div
                    key={emp.EMPCODE}
                    className={`p-emp-card ${escClass} ${isSelected ? "active-card" : ""}`}
                    onClick={() => openEmployeeConsole(emp)}
                  >
                    <div className="p-emp-card-content">
                      {/* Avatar & Info */}
                      <div className="p-emp-profile">
                        <div className={`p-avatar ${escClass}`}>
                          {emp.EMPNAME?.charAt(0) || "E"}
                        </div>
                        <div className="p-emp-info">
                          <span className="p-emp-name">{emp.EMPNAME}</span>
                          <div className="p-emp-meta">
                            <span className="p-emp-code-badge">{emp.EMPCODE}</span>
                            {emp.Department && (
                              <span>&bull; {emp.Department}</span>
                            )}
                          </div>
                          <div className="p-emp-penalty-type-chip" title="Primary Penalty Type">
                            <span className="p-emp-pt-tag">Penalty Type:</span>
                            <span>{getEmployeePenaltyTypeSummary(emp)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Slips & Status */}
                      <div className="p-emp-stats">
                        <div className="p-slips-badge-group">
                          <div className="p-slips-chips">
                            <span className="p-slip-chip yellow" title="Yellow Slips">
                              {emp.YellowSlips || 0} Y
                            </span>
                            <span className="p-slip-chip red" title="Red Slips">
                              {emp.RedSlips || 0} R
                            </span>
                          </div>
                          <span className={`p-escalation-badge ${escClass}`}>
                            {emp.EscalationStatus || "Normal"}
                          </span>
                        </div>
                        <div className="p-emp-chevron">
                          <ChevronRight size={18} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── DISCIPLINARY CONSOLE SLIDE-OVER DRAWER ── */}
          {selectedEmp && (
            <div className="p-drawer-overlay" onClick={closeEmployeeConsole}>
              <div
                className="p-drawer-content"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="p-drawer-header">
                  <div className="p-drawer-title-area">
                    <div className={`p-avatar ${getEscClass(selectedEmp.EscalationStatus)}`}>
                      {selectedEmp.EMPNAME?.charAt(0) || "E"}
                    </div>
                    <div>
                      <h3 className="p-drawer-emp-name">{selectedEmp.EMPNAME}</h3>
                      <div className="p-drawer-emp-meta">
                        <span>Code: <strong>{selectedEmp.EMPCODE}</strong></span>
                        {selectedEmp.Department && (
                          <span>&bull; {selectedEmp.Department}</span>
                        )}
                      </div>
                      <div style={{ marginTop: "4px" }}>
                        <span style={{ fontSize: "11px", background: "rgba(255,255,255,0.18)", padding: "2px 8px", borderRadius: "6px", color: "#ffffff", fontWeight: "700" }}>
                          Penalty Type: {getEmployeePenaltyTypeSummary(selectedEmp)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    className="p-drawer-close-btn"
                    onClick={closeEmployeeConsole}
                    title="Close Console"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="p-drawer-body">
                  {/* HR Advisory Banner */}
                  {selectedEmp.EscalationStatus === "Disciplinary Review" ? (
                    <div className="p-advisory-alert danger">
                      <ShieldAlert size={20} color="#dc2626" style={{ flexShrink: 0 }} />
                      <div>
                        <div className="p-advisory-title">Immediate Disciplinary Review Required</div>
                        <div className="p-advisory-desc">
                          Employee has received Red Slips or reached maximum disciplinary threshold. Requires formal management committee hearing.
                        </div>
                      </div>
                    </div>
                  ) : selectedEmp.EscalationStatus === "HR Warning" ? (
                    <div className="p-advisory-alert warning">
                      <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0 }} />
                      <div>
                        <div className="p-advisory-title">HR Written Warning Threshold Reached</div>
                        <div className="p-advisory-desc">
                          Employee accumulated 4 or more Yellow Slips. Issue a formal written counseling notice or schedule an HR session.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-advisory-alert normal">
                      <UserCheck size={20} color="#059669" style={{ flexShrink: 0 }} />
                      <div>
                        <div className="p-advisory-title">Status: Normal Monitoring</div>
                        <div className="p-advisory-desc">
                          Infractions are currently below escalation thresholds. Continue regular attendance and conduct monitoring.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bento Summary inside Drawer */}
                  <div className="p-drawer-bento">
                    <div className="p-bento-item">
                      <div className="p-bento-label">Yellow Slips</div>
                      <div className="p-bento-value yellow">{selectedEmp.YellowSlips || 0}</div>
                    </div>
                    <div className="p-bento-item">
                      <div className="p-bento-label">Red Slips</div>
                      <div className="p-bento-value red">{selectedEmp.RedSlips || 0}</div>
                    </div>
                    <div className="p-bento-item">
                      <div className="p-bento-label">Total Records</div>
                      <div className="p-bento-value blue">
                        {details[selectedEmp.EMPCODE]?.length ?? "..."}
                      </div>
                    </div>
                  </div>

                  {/* Violation Audit Timeline (EVERY DETAIL SHOWN EXPLICITLY) */}
                  <div>
                    <div className="p-timeline-section-title">
                      <span>Violation Audit Timeline</span>
                      <span className="p-timeline-badge-count">
                        {details[selectedEmp.EMPCODE]?.length || 0} events
                      </span>
                    </div>

                    {drawerLoading ? (
                      <div className="p-empty-state" style={{ padding: "30px" }}>
                        <RefreshCw size={24} className="animate-spin" color="#3b82f6" />
                        <span style={{ fontSize: "12px", color: "#64748b", marginTop: "8px" }}>
                          Loading audit trail...
                        </span>
                      </div>
                    ) : !details[selectedEmp.EMPCODE] || details[selectedEmp.EMPCODE].length === 0 ? (
                      <div className="p-empty-state" style={{ padding: "30px" }}>
                        <IonIcon icon={warningOutline} style={{ fontSize: "32px", color: "#94a3b8" }} />
                        <h4 className="p-empty-title">No Detailed History</h4>
                        <p className="p-empty-desc">
                          No itemized violations were recorded for this employee.
                        </p>
                      </div>
                    ) : (
                      <div className="p-timeline-container">
                        {details[selectedEmp.EMPCODE].map((item) => {
                          const isAuto = isAutoSlip(item.Remarks);
                          const proofUrl = getProofUrl(item.ProofFilePath);
                          const isImg = proofUrl ? isImageFile(proofUrl) : false;
                          const slipLower = (item.SlipType || "").toLowerCase();
                          const slipTypeClass = slipLower.includes("red")
                            ? "red"
                            : slipLower.includes("yellow")
                            ? "yellow"
                            : slipLower.includes("orange")
                            ? "orange"
                            : "green";
                          const penaltyTypeName = getPenaltyTypeName(item);

                          return (
                            <div key={item.Id} className="p-violation-detail-card">
                              {/* Top Banner: Prominent Penalty Type & Badges */}
                              <div className="p-vcard-penalty-type-banner">
                                <div className="p-vcard-pt-label">
                                  <AlertTriangle size={15} color="#2563eb" />
                                  <span>PENALTY TYPE:</span>
                                  <span className="p-vcard-pt-value">{penaltyTypeName}</span>
                                </div>
                                <div className="p-vcard-badges">
                                  <span className={`p-slip-type-pill ${slipTypeClass}`}>
                                    {item.SlipType || "Slip"} &times;{item.SlipCount || 1}
                                  </span>
                                  <span
                                    className={`p-status-tag ${
                                      item.Status?.toLowerCase() === "approved" ? "approved" : ""
                                    }`}
                                  >
                                    {item.Status || "Applied"}
                                  </span>
                                </div>
                              </div>

                              {/* Grid showing ALL explicit fields */}
                              <div className="p-detail-grid">
                                <div
                                  className="p-detail-item"
                                  style={{
                                    gridColumn: "span 2",
                                    background: "#eff6ff",
                                    border: "1px solid #bfdbfe",
                                    padding: "8px 12px",
                                    borderRadius: "8px"
                                  }}
                                >
                                  <span className="p-detail-label" style={{ color: "#1e40af" }}>
                                    Penalty Type
                                  </span>
                                  <span
                                    className="p-detail-val"
                                    style={{
                                      color: "#1d4ed8",
                                      fontSize: "14px",
                                      fontWeight: "800",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px"
                                    }}
                                  >
                                    <AlertTriangle size={15} color="#d97706" />
                                    {penaltyTypeName}
                                  </span>
                                </div>

                                <div className="p-detail-item">
                                  <span className="p-detail-label">Penalty Date</span>
                                  <span className="p-detail-val">
                                    {formatViolationDate(item.PenaltyDate)}
                                  </span>
                                </div>

                                <div className="p-detail-item">
                                  <span className="p-detail-label">Violation Time</span>
                                  <span className="p-detail-val">
                                    {formatViolationTime(item.ViolationTime, item.PenaltyDate)}
                                  </span>
                                </div>

                                <div className="p-detail-item">
                                  <span className="p-detail-label">Employee</span>
                                  <span className="p-detail-val">
                                    {selectedEmp.EMPNAME} ({selectedEmp.EMPCODE})
                                  </span>
                                </div>

                                <div className="p-detail-item">
                                  <span className="p-detail-label">Applied By / Source</span>
                                  <span className="p-detail-val">
                                    {isAuto ? (
                                      <span className="p-source-tag auto">
                                        <Bot size={12} />
                                        <span>Attendance Policy Engine</span>
                                      </span>
                                    ) : (
                                      <span className="p-source-tag manual">
                                        <User size={12} />
                                        <span>{item.AppliedBy ? `Supervisor (${item.AppliedBy})` : "Supervisor"}</span>
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>

                              {/* Remarks */}
                              <div className="p-timeline-remarks">
                                <div className="p-timeline-remarks-label">Remarks</div>
                                <div>{item.Remarks || "No remarks provided"}</div>
                              </div>

                              {/* Violation Proof / Evidence */}
                              <div className="p-detail-item">
                                <span className="p-detail-label">Violation Proof / Evidence</span>
                                {proofUrl ? (
                                  <div className="p-evidence-box" style={{ marginTop: "4px" }}>
                                    <div className="p-evidence-left">
                                      {isImg ? (
                                        <img
                                          src={proofUrl}
                                          alt="Evidence"
                                          className="p-evidence-thumb"
                                          onClick={() =>
                                            setLightboxEvidence({
                                              url: proofUrl,
                                              title: `Evidence: ${penaltyTypeName} - ${selectedEmp.EMPNAME}`,
                                              remarks: item.Remarks,
                                              date: formatViolationDate(item.PenaltyDate)
                                            })
                                          }
                                          onError={(e) => {
                                            (e.target as HTMLElement).style.display = "none";
                                          }}
                                        />
                                      ) : (
                                        <IonIcon
                                          icon={documentTextOutline}
                                          style={{ fontSize: "24px", color: "#3b82f6" }}
                                        />
                                      )}
                                      <div className="p-evidence-text">
                                        <span className="p-evidence-filename">
                                          {item.ProofFileName || "Evidence Attached"}
                                        </span>
                                        <span className="p-evidence-hint">
                                          {isImg ? "Click image to enlarge" : "PDF / Document evidence"}
                                        </span>
                                      </div>
                                    </div>

                                    <button
                                      className="p-view-evidence-btn"
                                      onClick={() => {
                                        if (isImg) {
                                          setLightboxEvidence({
                                            url: proofUrl,
                                            title: `Evidence: ${penaltyTypeName} - ${selectedEmp.EMPNAME}`,
                                            remarks: item.Remarks,
                                            date: formatViolationDate(item.PenaltyDate)
                                          });
                                        } else {
                                          window.open(proofUrl, "_blank");
                                        }
                                      }}
                                    >
                                      <Eye size={14} />
                                      <span>View</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      color: "#94a3b8",
                                      fontStyle: "italic",
                                      marginTop: "4px"
                                    }}
                                  >
                                    No file chosen &bull; No evidence attached
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Drawer Footer Actions */}
                <div className="p-drawer-footer">
                  <button
                    className="p-drawer-btn secondary"
                    onClick={() => printEmployeeRecord(selectedEmp)}
                    title="Print disciplinary summary"
                  >
                    <Printer size={15} />
                    <span>Print Record</span>
                  </button>

                  <button
                    className="p-drawer-btn primary"
                    onClick={() => openIssuePenaltyModal(selectedEmp.EMPCODE)}
                    title="Issue new penalty slip for this employee"
                  >
                    <PlusCircle size={15} />
                    <span>Issue Penalty</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── INTEGRATED ISSUE PENALTY MODAL (ALL REQUESTED FIELDS) ── */}
          {isIssueModalOpen && (
            <div
              className="p-modal-overlay"
              onClick={() => setIsIssueModalOpen(false)}
            >
              <div
                className="p-modal-content"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-modal-header">
                  <h3 className="p-modal-title">Issue Penalty Slip</h3>
                  <button
                    className="p-drawer-close-btn"
                    onClick={() => setIsIssueModalOpen(false)}
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleIssuePenaltySubmit} className="p-modal-body">
                  {/* 1. Penalty Type */}
                  <div className="p-form-group">
                    <label className="p-form-label">
                      Penalty Type <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <select
                      className="p-form-select"
                      value={issueForm.penaltyId}
                      onChange={(e) =>
                        setIssueForm({ ...issueForm, penaltyId: e.target.value })
                      }
                      required
                    >
                      <option value="">-- Select Penalty --</option>
                      {penaltiesMaster.map((p: any) => {
                        const id = p.id ?? p.Id;
                        const pType = p.penaltyType ?? p.PenaltyType;
                        const sType = p.slipType ?? p.SlipType;
                        const sCount = p.slipCount ?? p.SlipCount ?? 1;
                        return (
                          <option key={id} value={id}>
                            {pType} ({sType} &times;{sCount})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* 2. Penalty Date */}
                  <div className="p-form-group">
                    <label className="p-form-label">
                      Penalty Date <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      type="date"
                      className="p-form-input"
                      value={issueForm.penaltyDate}
                      onChange={(e) =>
                        setIssueForm({ ...issueForm, penaltyDate: e.target.value })
                      }
                      required
                    />
                  </div>

                  {/* 3. Violation Date & Time */}
                  <div className="p-form-group">
                    <label className="p-form-label">Violation Date &amp; Time</label>
                    <input
                      type="datetime-local"
                      className="p-form-input"
                      value={issueForm.violationTime}
                      onChange={(e) =>
                        setIssueForm({ ...issueForm, violationTime: e.target.value })
                      }
                    />
                  </div>

                  {/* 4. Employees */}
                  <div className="p-form-group">
                    <label className="p-form-label">
                      Employees <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <select
                      className="p-form-select"
                      value={issueForm.employeeCodes[0] || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setIssueForm({
                          ...issueForm,
                          employeeCodes: val ? [val] : []
                        });
                      }}
                      required
                    >
                      <option value="">-- Select Employee --</option>
                      {allEmployeesList.map((emp) => (
                        <option key={emp.EmpCode} value={emp.EmpCode}>
                          {emp.EmpName} ({emp.EmpCode}) {emp.BranchDept ? `- ${emp.BranchDept}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 5. Violation Proof */}
                  <div className="p-form-group">
                    <label className="p-form-label">Violation Proof / Evidence</label>
                    <div className="p-file-input-wrapper">
                      <label htmlFor="issue-proof-file" style={{ cursor: "pointer" }}>
                        <div className="p-file-input-info">
                          <Upload size={22} color="#3b82f6" />
                          <span>Click to upload Image or PDF Evidence</span>
                          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                            {issueProofFile ? issueProofFile.name : "No file chosen"}
                          </span>
                        </div>
                      </label>
                      <input
                        id="issue-proof-file"
                        type="file"
                        accept="image/*,.pdf"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setIssueProofFile(e.target.files[0]);
                          }
                        }}
                      />
                    </div>
                    {issueProofFile && (
                      <div className="p-file-preview-pill">
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                          📎 {issueProofFile.name} ({(issueProofFile.size / 1024).toFixed(1)} KB)
                        </span>
                        <button
                          type="button"
                          className="p-clear-btn"
                          onClick={() => setIssueProofFile(null)}
                          title="Remove file"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 6. Remarks */}
                  <div className="p-form-group">
                    <label className="p-form-label">Remarks</label>
                    <textarea
                      className="p-form-textarea"
                      placeholder="Enter detailed violation remarks, observations, or policy breach context..."
                      value={issueForm.remarks}
                      onChange={(e) =>
                        setIssueForm({ ...issueForm, remarks: e.target.value })
                      }
                    />
                  </div>

                  <div className="p-modal-footer">
                    <button
                      type="button"
                      className="p-action-btn"
                      style={{ background: "#f1f5f9", color: "#334155" }}
                      onClick={() => setIsIssueModalOpen(false)}
                      disabled={submittingPenalty}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="p-action-btn p-action-btn--primary"
                      disabled={submittingPenalty}
                    >
                      {submittingPenalty ? "Submitting..." : "Apply Penalty"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── Evidence Lightbox Modal ── */}
          {lightboxEvidence && (
            <div
              className="p-lightbox-overlay"
              onClick={() => setLightboxEvidence(null)}
            >
              <div
                className="p-lightbox-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-lightbox-header">
                  <div>
                    <div className="p-lightbox-title">{lightboxEvidence.title}</div>
                    {lightboxEvidence.date && (
                      <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                        Recorded on {lightboxEvidence.date}
                      </span>
                    )}
                  </div>
                  <div className="p-lightbox-actions">
                    <a
                      href={lightboxEvidence.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-action-btn p-action-btn--glass"
                      title="Open in new window"
                    >
                      <ExternalLink size={14} />
                      <span>Full Res</span>
                    </a>
                    <button
                      className="p-drawer-close-btn"
                      onClick={() => setLightboxEvidence(null)}
                      title="Close"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div className="p-lightbox-img-wrap">
                  <img
                    src={lightboxEvidence.url}
                    alt="Violation Evidence"
                    className="p-lightbox-img"
                  />
                </div>

                {lightboxEvidence.remarks && (
                  <div
                    style={{
                      padding: "12px 20px",
                      background: "rgba(0,0,0,0.4)",
                      color: "#cbd5e1",
                      fontSize: "12px",
                      borderTop: "1px solid rgba(255,255,255,0.1)"
                    }}
                  >
                    <strong>Remarks:</strong> {lightboxEvidence.remarks}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </IonContent>
    </IonPage>
  );
}

export default PenaltyList;