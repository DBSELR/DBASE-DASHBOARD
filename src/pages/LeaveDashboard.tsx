import React, { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useHistory } from "react-router-dom";
import {
  IonContent,
  IonPage,
  IonIcon,
  IonSpinner,
  IonToast
} from "@ionic/react";
import {
  arrowBackOutline,
  calendarOutline,
  searchOutline,
  closeCircle,
  checkmarkCircle,
  downloadOutline,
  timeOutline,
  alertCircleOutline,
  layersOutline,
  informationCircleOutline,
  personOutline,
  closeOutline,
  refreshOutline,
  medkitOutline,
  chevronDownOutline,
  hourglassOutline
} from "ionicons/icons";
import axios from "axios";
import moment from "moment";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { API_BASE } from "../config";
import "./LeaveDashboard.css";

/* ---------------- helpers ---------------- */
const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const getAuthHeaders = () => {
  const token = localStorage.getItem("token")?.replace(/"/g, "");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const checkIsAdmin = (user: any) => {
  if (!user) return false;
  const designation = String(user.designation || user.Designation || user.UserDesig || "").trim().toLowerCase();
  return designation === "hr" || designation === "in-charge f&a";
};

const generateMonthList = () => {
  const months: string[] = [];
  const startYear = 2026;
  const current = moment().add(1, "month");
  const currentYear = current.year();

  for (let y = currentYear; y >= startYear; y--) {
    // Add the yearly report option for the year y
    months.push(`Year-${y}`);

    const endMonth = y === currentYear ? current.month() : 11;
    for (let m = endMonth; m >= 0; m--) {
      months.push(moment().year(y).month(m).format("MMM-YYYY"));
    }
  }
  return months;
};

const getApiDateFromMonthStr = (monthStr: string) => {
  const parts = monthStr.split("-");
  if (parts.length === 2) {
    const monthIndex = moment().month(parts[0]).month();
    const year = parseInt(parts[1], 10);
    const m = String(monthIndex + 1).padStart(2, "0");
    return `${year}-${m}-01`;
  }
  return moment().format("YYYY-MM-DD");
};

const safeStr = (v: any) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return "";
  return String(v);
};

const getCategoryTypeDisplay = (typeDisp: string, leaveCategory: string) => {
  if (!typeDisp) return "";
  const cleanType = typeDisp.trim();
  const cleanCat = leaveCategory ? leaveCategory.trim() : "";

  if (!cleanCat) return cleanType;

  if (cleanType.toLowerCase().includes(cleanCat.toLowerCase())) {
    return cleanType;
  }

  const capitalizedCat = cleanCat.charAt(0).toUpperCase() + cleanCat.slice(1);
  return `${cleanType}(${capitalizedCat})`;
};

const deduceStatus = (x: any, fallbackMgr: string = "Team. Manager") => {
  if (!x) return "Pending";
  
  let rawStatus = "";
  if (Array.isArray(x)) {
    rawStatus = safeStr(x[7]);
  } else {
    rawStatus = safeStr(x.L_status || x.L_Status || x.status || x.Status || "");
  }
  
  let statusStr = rawStatus.trim();
  if (statusStr.toLowerCase() === "pending at") {
    statusStr = "Pending";
  }
  
  if (!statusStr.toLowerCase().includes("pending")) {
    return statusStr || "Pending";
  }
  
  let pendingRA: any = "";
  if (Array.isArray(x)) {
    pendingRA = x.length > 23 ? x[23] : "";
    if (!pendingRA) {
      const r1 = x.length > 13 ? x[13] : "";
      const r2 = x.length > 14 ? x[14] : "";
      const r3 = x.length > 15 ? x[15] : "";
      const r4 = x.length > 16 ? x[16] : "";
      const rs1 = safeStr(x.length > 17 ? x[17] : "");
      const rs2 = safeStr(x.length > 18 ? x[18] : "");
      const rs3 = safeStr(x.length > 19 ? x[19] : "");
      
      const isP = (s: string) => !s || (!s.toLowerCase().includes("accepted") && !s.toLowerCase().includes("approved") && !s.toLowerCase().includes("rejected"));
      
      if (r1 && isP(rs1)) pendingRA = r1;
      else if (r2 && isP(rs2)) pendingRA = r2;
      else if (r3 && isP(rs3)) pendingRA = r3;
      else if (r4) pendingRA = r4;
    }
  } else {
    pendingRA = x.PendingAt || x.pendingAt || x.PendingRA || x.pendingRA || x.CurrentRA || x.currentRA || x.currentRa || "";
    
    if (!pendingRA) {
      const r1 = x.RA1 || x.ra1 || x.rA1 || "";
      const r2 = x.RA2 || x.ra2 || x.rA2 || "";
      const r3 = x.RA3 || x.ra3 || x.rA3 || "";
      const r4 = x.RA4 || x.ra4 || x.rA4 || "";
      const rs1 = safeStr(x.RA1_Status || x.ra1_Status || x.RA1Status || x.ra1Status || "");
      const rs2 = safeStr(x.RA2_Status || x.ra2_Status || x.RA2Status || x.ra2Status || "");
      const rs3 = safeStr(x.RA3_Status || x.ra3_Status || x.RA3Status || x.ra3Status || "");
      
      const isP = (s: string) => !s || (!s.toLowerCase().includes("accepted") && !s.toLowerCase().includes("approved") && !s.toLowerCase().includes("rejected"));
      
      if (r1 && isP(rs1)) pendingRA = r1;
      else if (r2 && isP(rs2)) pendingRA = r2;
      else if (r3 && isP(rs3)) pendingRA = r3;
      else if (r4) pendingRA = r4;
    }
  }
  
  let raString = "";
  if (pendingRA) {
    if (typeof pendingRA === "object") {
      raString = safeStr(pendingRA.designation || pendingRA.Designation || pendingRA.name || pendingRA.empName || pendingRA.role || "");
    } else {
      raString = String(pendingRA);
      if (raString.startsWith("{") && raString.endsWith("}")) {
        try {
          const parsed = JSON.parse(raString);
          raString = parsed.designation || parsed.Designation || parsed.name || parsed.empName || parsed.role || "";
        } catch {}
      }
    }
  }
  
  raString = raString.trim();
  
  if (raString.toLowerCase() === "[object object]" || raString === "") {
    if (statusStr.toLowerCase().startsWith("pending at ")) {
      return statusStr;
    }
    return `Pending at ${fallbackMgr}`;
  }
  
  return `Pending at ${raString}`;
};

/* ---------------- component ---------------- */
const LeaveDashboard: React.FC = () => {
  const history = useHistory();
  const loggedInUser = useMemo(() => getUser(), []);
  const isAdmin = useMemo(() => checkIsAdmin(loggedInUser), [loggedInUser]);

  // Filters & State
  const [months] = useState<string[]>(generateMonthList());
  const [selectedMonth, setSelectedMonth] = useState<string>(
    moment().format("MMM-YYYY")
  );
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [selectedEmpCode, setSelectedEmpCode] = useState<string>("");
  const [selectedEmpName, setSelectedEmpName] = useState<string>("");
  const [fallbackManager, setFallbackManager] = useState("Team. Manager");

  // Loading & logs
  const [loading, setLoading] = useState<boolean>(false);
  const [rows, setRows] = useState<any[]>([]);

  // Balance states
  const [balances, setBalances] = useState({
    cl: { balance: 0, used: 0 },
    sl: { balance: 0, used: 0 },
    perm: { balance: 0, used: 0, usedSessions: 0, maxSessions: 0 },
    lop: { balance: 0, used: 0 },
    grace: { used: 0, max: 4, usedMins: 0, todayUsed: false, todayMins: 0 }
  });

  // UI Helpers & Grid filters
  const [searchTerm, setSearchTerm] = useState("");
  const [gridSearch, setGridSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Approved" | "Pending" | "Rejected">("ALL");

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastColor, setToastColor] = useState<"success" | "danger">("success");

  // Custom Dropdown States
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const [employeeDropdownPos, setEmployeeDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [periodDropdownPos, setPeriodDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const employeeTriggerRef = useRef<HTMLDivElement>(null);
  const periodTriggerRef = useRef<HTMLDivElement>(null);

  // Position logic for employee dropdown
  useEffect(() => {
    if (isEmployeeDropdownOpen && employeeTriggerRef.current) {
      const rect = employeeTriggerRef.current.getBoundingClientRect();
      setEmployeeDropdownPos({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 240)
      });
    }
  }, [isEmployeeDropdownOpen]);

  // Position logic for period dropdown
  useEffect(() => {
    if (isPeriodDropdownOpen && periodTriggerRef.current) {
      const rect = periodTriggerRef.current.getBoundingClientRect();
      setPeriodDropdownPos({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isPeriodDropdownOpen]);

  // Load employee list on mount (if admin/HR/manager)
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const url = `${API_BASE}Employee/Load_Employees?SearchEmp=`;
        const res = await axios.get(url, { headers: getAuthHeaders() });
        const mapped = (res.data || []).map((emp: any[]) => ({
          id: emp[0]?.toString() || "",
          name: emp[1] || ""
        }));
        setEmployees(mapped);
      } catch (err) {
        console.error("Error loading employees list:", err);
      }
    };

    if (isAdmin) {
      fetchEmployees();
    }

    const initialCode = loggedInUser?.empCode || loggedInUser?.EmpCode || "";
    const initialName = loggedInUser?.empName || loggedInUser?.EmpName || "Me";
    setSelectedEmpCode(initialCode);
    setSelectedEmpName(initialName);
  }, [isAdmin, loggedInUser]);

  // Load details and balance on employee or month change
  useEffect(() => {
    if (selectedEmpCode && selectedMonth) {
      loadEmployeeReport(selectedEmpCode, selectedMonth);
    }
  }, [selectedEmpCode, selectedMonth]);

  const showToast = (msg: string, color: "success" | "danger" = "success") => {
    setToastMsg(msg);
    setToastColor(color);
    setToastOpen(true);
  };

  const loadEmployeeReport = async (empCode: string, month: string) => {
    if (!empCode || empCode === "0") {
      setRows([]);
      setBalances({
        cl: { balance: 0, used: 0 },
        sl: { balance: 0, used: 0 },
        perm: { balance: 0, used: 0, usedSessions: 0, maxSessions: 6 },
        lop: { balance: 0, used: 0 },
        grace: { used: 0, max: 4, usedMins: 0, todayUsed: false, todayMins: 0 }
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      try {
        const empRes = await axios.get(`${API_BASE}Employee/Get_Employee?_Ecode=${empCode}`, {
          headers: getAuthHeaders()
        });
        const empData = empRes.data;
        const row = Array.isArray(empData) ? empData[0] : (empData?.data ? empData.data[0] : empData);
        if (row) {
          const mgr = row[15] || row._RequestTo || row.RequestTo || row.requestTo || row.RA1 || "Team. Manager";
          setFallbackManager(mgr);
        } else {
          setFallbackManager("Team. Manager");
        }
      } catch (e) {
        console.error("Failed to fetch employee manager", e);
        setFallbackManager("Team. Manager");
      }

      let rawLeaves: any[] = [];
      let rawPerms: any[] = [];
      const isYearly = month.startsWith("Year-");
      const yearVal = isYearly ? month.replace("Year-", "") : "";
      const targetMonths = months.filter(m => m.endsWith("-" + yearVal) && !m.startsWith("Year-"));

      if (isYearly) {
        const fetchPromises = targetMonths.map(async (mStr) => {
          const leavesUrl = `${API_BASE}Permission/Load_Leave_Permission?Empcode=${empCode}&Seachdate=${mStr}&LType=leave`;
          const permsUrl = `${API_BASE}Permission/Load_Leave_Permission?Empcode=${empCode}&Seachdate=${mStr}&LType=permission`;
          try {
            const [leavesRes, permsRes] = await Promise.all([
              axios.get(leavesUrl, { headers: getAuthHeaders() }).catch(() => ({ data: [] })),
              axios.get(permsUrl, { headers: getAuthHeaders() }).catch(() => ({ data: [] }))
            ]);
            return {
              leaves: Array.isArray(leavesRes.data) ? leavesRes.data : [],
              perms: Array.isArray(permsRes.data) ? permsRes.data : []
            };
          } catch {
            return { leaves: [], perms: [] };
          }
        });
        const results = await Promise.all(fetchPromises);
        results.forEach((res) => {
          rawLeaves.push(...res.leaves);
          rawPerms.push(...res.perms);
        });
      } else {
        const leavesUrl = `${API_BASE}Permission/Load_Leave_Permission?Empcode=${empCode}&Seachdate=${month}&LType=leave`;
        const permsUrl = `${API_BASE}Permission/Load_Leave_Permission?Empcode=${empCode}&Seachdate=${month}&LType=permission`;
        const [leavesRes, permsRes] = await Promise.all([
          axios.get(leavesUrl, { headers: getAuthHeaders() }).catch((err) => {
            console.error("Failed to load leaves for grid:", err);
            return { data: [] };
          }),
          axios.get(permsUrl, { headers: getAuthHeaders() }).catch((err) => {
            console.error("Failed to load permissions for grid:", err);
            return { data: [] };
          })
        ]);
        rawLeaves = Array.isArray(leavesRes.data) ? leavesRes.data : [];
        rawPerms = Array.isArray(permsRes.data) ? permsRes.data : [];
      }

      const rawRows = [...rawLeaves, ...rawPerms];

      rawRows.sort((a, b) => {
        const idA = parseInt(a.lid || (Array.isArray(a) ? a[0] : 0), 10) || 0;
        const idB = parseInt(b.lid || (Array.isArray(b) ? b[0] : 0), 10) || 0;
        return idB - idA;
      });

      setRows(rawRows);

      let clBalance = 0, clUsed = 0;
      let slBalance = 0, slUsed = 0;
      let permBalance = 0, permUsed = 0, permUsedSessions = 0, permMaxSessions = 0;
      let lopBalance = 0, lopUsed = 0;
      let graceUsed = 0, graceMax = 4, graceUsedMins = 0;
      let todayGraceUsed = false, todayGraceMins = 0;
      const todayStr = moment().format("YYYY-MM-DD");

      if (isYearly && targetMonths.length > 0) {
        const balancePromises = targetMonths.map((mStr) => {
          const mDate = getApiDateFromMonthStr(mStr);
          const categories = ["Casual", "Sick", "Permission", "LOP"];
          return Promise.all(
            categories.map((cat) =>
              axios.get(`${API_BASE}Leave/GetLeaveBalance`, {
                params: { empCode, leaveCategory: cat, date: mDate },
                headers: getAuthHeaders()
              }).catch(() => ({ data: null }))
            )
          );
        });

        const balanceResults = await Promise.all(balancePromises);
        
        const latestResult = balanceResults[0];
        if (latestResult) {
          clBalance = latestResult[0]?.data?.balance ?? 0;
          clUsed = latestResult[0]?.data?.used ?? 0;
          slBalance = latestResult[1]?.data?.balance ?? 0;
          slUsed = latestResult[1]?.data?.used ?? 0;
        }

        balanceResults.forEach((res) => {
          if (res) {
            permUsed += res[2]?.data?.used ?? 0;
            permUsedSessions += res[2]?.data?.usedSessions ?? 0;
            permMaxSessions += res[2]?.data?.maxSessions ?? 0;
            lopUsed += res[3]?.data?.used ?? 0;
          }
        });

        if (permMaxSessions === 0) {
          permMaxSessions = 6 * targetMonths.length;
        }
      } else {
        const apiDate = getApiDateFromMonthStr(month);
        const categories = ["Casual", "Sick", "Permission", "LOP"];
        const balancePromises = categories.map((cat) =>
          axios.get(`${API_BASE}Leave/GetLeaveBalance`, {
            params: { empCode, leaveCategory: cat, date: apiDate },
            headers: getAuthHeaders()
          }).catch(() => ({ data: null }))
        );

        const [clRes, slRes, permRes, lopRes] = await Promise.all(balancePromises);

        clBalance = clRes.data?.balance ?? 0;
        clUsed = clRes.data?.used ?? 0;
        slBalance = slRes.data?.balance ?? 0;
        slUsed = slRes.data?.used ?? 0;
        permBalance = permRes.data?.balance ?? 0;
        permUsed = permRes.data?.used ?? 0;
        permMaxSessions = permRes.data?.maxSessions ?? 0;
        const rawUsedSessions = permRes.data?.usedSessions ?? 0;
        permUsedSessions = permMaxSessions > 0 && rawUsedSessions > permMaxSessions ? permMaxSessions : rawUsedSessions;
        lopBalance = lopRes.data?.balance ?? 0;
        lopUsed = lopRes.data?.used ?? 0;
      }

      try {
        if (!isYearly) {
          const parts = month.split("-");
          if (parts.length === 2) {
            const mIndex = moment().month(parts[0]).month() + 1;
            const y = parts[1];
            const matrixUrl = `${API_BASE}Checkin/GetHRMonthlyAttendanceMatrix?year=${y}&month=${mIndex}`;
            const mRes = await axios.get(matrixUrl, { headers: getAuthHeaders() });
            const matrix = mRes.data?.matrix || {};
            Object.keys(matrix).forEach((key) => {
              if (key.startsWith(empCode + "_")) {
                const att = matrix[key];
                if (att && att.graceType && att.graceType !== "-" && att.graceType.trim() !== "") {
                  const gt = att.graceType.toLowerCase();
                  if (gt.includes("grace")) {
                    graceUsed++;
                    const mins = parseInt(String(att.totalLate || "0"), 10) || 0;
                    graceUsedMins += mins;
                    
                    if (key === `${empCode}_${todayStr}`) {
                      todayGraceUsed = true;
                      todayGraceMins = mins;
                    }
                  }
                }
              }
            });
          }
        } else {
          graceMax = 2 * targetMonths.length;
        }
      } catch (err) {
        console.error("Error fetching grace from matrix", err);
      }

      setBalances({
        cl: { balance: clBalance, used: clUsed },
        sl: { balance: slBalance, used: slUsed },
        perm: { balance: permBalance, used: permUsed, usedSessions: permUsedSessions, maxSessions: permMaxSessions },
        lop: { balance: lopBalance, used: lopUsed },
        grace: { used: graceUsed, max: graceMax, usedMins: graceUsedMins, todayUsed: todayGraceUsed, todayMins: todayGraceMins }
      });
    } catch (err) {
      console.error("Error loading report details:", err);
      showToast("Failed to retrieve dashboard details.", "danger");
    } finally {
      setLoading(false);
    }
  };

  const normalizeRow = (x: any) => {
    if (!x) return null;
    const from = safeStr(x.lfrom || (Array.isArray(x) ? x[2] : ""));
    const to = safeStr(x.lto || (Array.isArray(x) ? x[3] : ""));
    const typeDisp = x.ltype || x.LType || (Array.isArray(x) ? x[6] : "");
    const status = deduceStatus(x, fallbackManager);
    const ptime = safeStr(x.PTime || x.ptime || x.Ptime || (Array.isArray(x) ? x[5] : ""));
    const remarks = safeStr(x.Remarks || x.remarks || (Array.isArray(x) ? x[9] : ""));
    const days = x.Days || x.days || (Array.isArray(x) ? x[8] : 0);
    const leaveCategory = safeStr(x.LeaveCategory || x.leaveCategory || (Array.isArray(x) ? (x.length === 32 ? x[25] : x[11]) : ""));

    const isSameDay = !to || from === to;

    let statusClass = "pending";
    const lStatus = status.toLowerCase();
    if (lStatus === "accepted" || lStatus === "approved") {
      statusClass = "approved";
    } else if (lStatus === "rejected") {
      statusClass = "rejected";
    }

    const catLower = (leaveCategory || typeDisp || "").toLowerCase();
    let typeClass = "default";
    if (catLower.includes("casual")) typeClass = "casual";
    else if (catLower.includes("sick")) typeClass = "sick";
    else if (catLower.includes("permission") || catLower.includes("perm")) typeClass = "perm";
    else if (catLower.includes("lop") || catLower.includes("loss")) typeClass = "lop";

    return {
      id: x.lid || (Array.isArray(x) ? x[0] : ""),
      from,
      to,
      isSameDay,
      typeDisp,
      status,
      ptime,
      remarks,
      days,
      statusClass,
      typeClass,
      leaveCategory
    };
  };

  const filteredEmployees = useMemo(() => {
    if (!searchTerm.trim()) return employees;
    const term = searchTerm.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.id.toLowerCase().includes(term) ||
        emp.name.toLowerCase().includes(term)
    );
  }, [employees, searchTerm]);

  const displayedRows = useMemo(() => {
    return rows.filter((rowItem) => {
      const r = normalizeRow(rowItem);
      if (!r) return false;

      if (statusFilter !== "ALL") {
        const s = r.status.toLowerCase();
        if (statusFilter === "Approved" && !s.includes("approved") && !s.includes("accepted")) return false;
        if (statusFilter === "Pending" && !s.includes("pending")) return false;
        if (statusFilter === "Rejected" && !s.includes("rejected")) return false;
      }

      if (gridSearch.trim()) {
        const q = gridSearch.toLowerCase();
        const fullDate = `${r.from} ${r.to}`.toLowerCase();
        const fullCat = `${r.typeDisp} ${r.leaveCategory}`.toLowerCase();
        const fullRemarks = r.remarks.toLowerCase();
        const fullStatus = r.status.toLowerCase();
        return fullDate.includes(q) || fullCat.includes(q) || fullRemarks.includes(q) || fullStatus.includes(q);
      }

      return true;
    });
  }, [rows, statusFilter, gridSearch, fallbackManager]);

  const exportPDF = () => {
    if (rows.length === 0) {
      showToast("No logs available to export for this month.", "danger");
      return;
    }

    const doc = new jsPDF("portrait", "mm", "a4");

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("MONTH-END LEAVE REPORT", 14, 20);

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Employee Code : ${selectedEmpCode}`, 14, 28);
    doc.text(`Employee Name : ${selectedEmpName}`, 14, 34);
    doc.text(`Report Period : ${selectedMonth}`, 14, 40);
    doc.text(`Generated On  : ${moment().format("DD-MM-YYYY HH:mm:ss")}`, 14, 46);

    doc.setDrawColor(226, 232, 240);
    doc.line(14, 50, 196, 50);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Leave Balances & Totals Summary", 14, 58);

    const summaryData = [
      ["Casual Leave", `${balances.cl.balance} Days`, `${balances.cl.used} Days Used (Month)`],
      ["Sick Leave", `${balances.sl.balance} Days`, `${balances.sl.used} Days Used (Month)`],
      ["Permission time", `${balances.perm.balance} Mins`, `${balances.perm.used} Mins Used (${balances.perm.usedSessions}/${balances.perm.maxSessions} sessions)`],
      ["Loss of Pay (LOP)", "-", `${balances.lop.used} Days Used (Month)`]
    ];

    autoTable(doc, {
      startY: 62,
      head: [["Category", "Available Balance", "Used Metrics"]],
      body: summaryData,
      theme: "striped",
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [15, 23, 42] }
    });

    const nextY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Daily Leaves & Permissions Logs", 14, nextY);

    const logBody = rows.map((r) => {
      const normalized = normalizeRow(r);
      if (!normalized) return [];
      const pVal = parseInt(normalized.ptime, 10);
      const duration = (!isNaN(pVal) && pVal > 0) ? `${pVal} Mins` : `${normalized.days} Day(s)`;
      return [
        normalized.from === normalized.to ? normalized.from : `${normalized.from} to ${normalized.to}`,
        getCategoryTypeDisplay(normalized.typeDisp, normalized.leaveCategory) || "-",
        duration,
        normalized.status || "-",
        normalized.remarks || "-"
      ];
    }).filter((r) => r.length > 0);

    autoTable(doc, {
      startY: nextY + 4,
      head: [["Date(s)", "Category / Type", "Duration", "Status", "Remarks / Reason"]],
      body: logBody,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] }
    });

    doc.save(`Leave_Report_${selectedEmpCode}_${selectedMonth}.pdf`);
    showToast("PDF report downloaded successfully.", "success");
  };

  const selectedInitial = (selectedEmpName.replace(/^.*-\s*/, "").charAt(0) || "E").toUpperCase();

  return (
    <IonPage>
      <IonContent className="ld-page-container">
        {/* Sleek Dark-Accented Executive Header */}
        <div className="ld-header-card">
          <div className="ld-header-left">
            <button className="ld-back-btn" onClick={() => history.goBack()} title="Go Back">
              <IonIcon icon={arrowBackOutline} />
            </button>
            <div className="ld-title-group">
              <h1>
                Leave Dashboard
                <span className="ld-title-badge">Overview</span>
              </h1>
              <p>Real-time leave balance, utilization metrics & approval logs</p>
            </div>
          </div>
          <div className="ld-header-actions">
            <button
              className="ld-refresh-btn"
              onClick={() => selectedEmpCode && selectedMonth && loadEmployeeReport(selectedEmpCode, selectedMonth)}
              title="Refresh Data"
            >
              <IonIcon icon={refreshOutline} />
            </button>
            <button className="ld-header-action-btn" onClick={exportPDF}>
              <IonIcon icon={downloadOutline} />
              Export PDF
            </button>
          </div>
        </div>

        {/* Compact Filter Command Bar */}
        <div className="ld-controls-panel">
          {/* Employee Selector */}
          <div className="ld-control-group">
            <span className="ld-control-label">
              <IonIcon icon={personOutline} /> Employee
            </span>
            {isAdmin ? (
              <div
                className="ld-selector-trigger"
                ref={employeeTriggerRef}
                onClick={() => {
                  setSearchTerm("");
                  setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen);
                }}
              >
                <div className="ld-selector-value">
                  <div className="ld-selector-avatar">{selectedInitial}</div>
                  <div className="ld-selector-text-box">
                    <span className="ld-selector-main-text">{selectedEmpName || "Select Employee"}</span>
                    <span className="ld-selector-sub-text">Code: {selectedEmpCode || "N/A"}</span>
                  </div>
                </div>
                <div className="ld-selector-arrow-box">
                  <IonIcon icon={chevronDownOutline} />
                </div>
              </div>
            ) : (
              <div className="ld-selector-trigger" style={{ cursor: "default" }}>
                <div className="ld-selector-value">
                  <div className="ld-selector-avatar">{selectedInitial}</div>
                  <div className="ld-selector-text-box">
                    <span className="ld-selector-main-text">{selectedEmpName}</span>
                    <span className="ld-selector-sub-text">Code: {selectedEmpCode || "N/A"}</span>
                  </div>
                </div>
                <IonIcon icon={informationCircleOutline} style={{ color: "var(--ld-text-dim)" }} />
              </div>
            )}
          </div>

          {/* Period Selector */}
          <div className="ld-control-group">
            <span className="ld-control-label">
              <IonIcon icon={calendarOutline} /> Report Period
            </span>
            <div
              className="ld-inline-period-card"
              ref={periodTriggerRef}
              onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
            >
              <div className="ld-period-left-icon-box">
                <IonIcon icon={calendarOutline} />
              </div>
              <div className="ld-period-middle-content">
                <span className="ld-period-label">PERIOD</span>
                <span className="ld-period-value">{selectedMonth}</span>
              </div>
              <div className="ld-period-right-icon-box">
                <IonIcon icon={chevronDownOutline} />
              </div>
            </div>
          </div>
        </div>

        {/* Bento Metric KPI Cards (Small & Compact with Darker Side Effect) */}
        <div className="ld-summary-grid">
          {/* Casual Leave */}
          <div className="ld-card cl">
            <div className="ld-card-header">
              <div className="ld-card-title-wrap">
                <span className="ld-card-title">Casual Leave</span>
              </div>
              <div className="ld-card-icon-wrap">
                <IonIcon icon={calendarOutline} />
              </div>
            </div>
            <div className="ld-card-body">
              <div className="ld-card-value">
                {balances.cl.balance} <span className="ld-card-unit">Days</span>
              </div>
              <span className="ld-card-subvalue">Available</span>
            </div>
            <div className="ld-card-footer">
              <div className="ld-footer-row">
                <span>Month Used</span>
                <span className="ld-footer-highlight">{balances.cl.used} Day(s)</span>
              </div>
            </div>
          </div>

          {/* Sick Leave */}
          <div className="ld-card sl">
            <div className="ld-card-header">
              <div className="ld-card-title-wrap">
                <span className="ld-card-title">Sick Leave</span>
              </div>
              <div className="ld-card-icon-wrap">
                <IonIcon icon={medkitOutline} />
              </div>
            </div>
            <div className="ld-card-body">
              <div className="ld-card-value">
                {balances.sl.balance} <span className="ld-card-unit">Days</span>
              </div>
              <span className="ld-card-subvalue">Available</span>
            </div>
            <div className="ld-card-footer">
              <div className="ld-footer-row">
                <span>Month Used</span>
                <span className="ld-footer-highlight">{balances.sl.used} Day(s)</span>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="ld-card perm">
            <div className="ld-card-header">
              <div className="ld-card-title-wrap">
                <span className="ld-card-title">Permissions</span>
              </div>
              <div className="ld-card-icon-wrap">
                <IonIcon icon={timeOutline} />
              </div>
            </div>
            <div className="ld-card-body">
              <div className="ld-card-value">
                {balances.perm.balance} <span className="ld-card-unit">Min</span>
              </div>
              <span className="ld-card-subvalue">Remaining</span>
            </div>
            <div className="ld-card-footer">
              <div className="ld-footer-row">
                <span>Sessions</span>
                <span className="ld-footer-highlight">
                  {balances.perm.usedSessions}/{balances.perm.maxSessions} ({balances.perm.used}m)
                </span>
              </div>
              <div className="ld-footer-row">
                <span>Grace</span>
                <span className="ld-footer-highlight">
                  {balances.grace.used}/{balances.grace.max} ({balances.grace.usedMins}m)
                </span>
              </div>
              {balances.grace.todayUsed && (
                <div className="ld-grace-badge">
                  <IonIcon icon={hourglassOutline} />
                  <span>Today's Grace ({balances.grace.todayMins}m)</span>
                </div>
              )}
            </div>
          </div>

          {/* Loss of Pay (LOP) */}
          <div className="ld-card lop">
            <div className="ld-card-header">
              <div className="ld-card-title-wrap">
                <span className="ld-card-title">Loss of Pay</span>
              </div>
              <div className="ld-card-icon-wrap">
                <IonIcon icon={closeCircle} />
              </div>
            </div>
            <div className="ld-card-body">
              <div className="ld-card-value">
                {balances.lop.used} <span className="ld-card-unit">Days</span>
              </div>
              <span className="ld-card-subvalue">Deductions</span>
            </div>
            <div className="ld-card-footer">
              <div className="ld-footer-row">
                <span>Policy</span>
                <span className="ld-footer-highlight" style={{ color: "var(--ld-lop-accent)" }}>
                  Unpaid
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Data Grid Table */}
        <div className="ld-table-card">
          <div className="ld-table-header">
            <div className="ld-table-title-sec">
              <h2 className="ld-table-title">Leaves & Permissions History</h2>
              <span className="ld-table-count-chip">{rows.length} Total</span>
            </div>

            <div className="ld-table-toolbar">
              {/* Status Filter Pills */}
              <div className="ld-status-filter-pills">
                <button
                  className={`ld-status-tab ${statusFilter === "ALL" ? "active" : ""}`}
                  onClick={() => setStatusFilter("ALL")}
                >
                  All ({rows.length})
                </button>
                <button
                  className={`ld-status-tab ${statusFilter === "Approved" ? "active" : ""}`}
                  onClick={() => setStatusFilter("Approved")}
                >
                  Approved
                </button>
                <button
                  className={`ld-status-tab ${statusFilter === "Pending" ? "active" : ""}`}
                  onClick={() => setStatusFilter("Pending")}
                >
                  Pending
                </button>
                <button
                  className={`ld-status-tab ${statusFilter === "Rejected" ? "active" : ""}`}
                  onClick={() => setStatusFilter("Rejected")}
                >
                  Rejected
                </button>
              </div>

              {/* Instant Search Box */}
              <div className="ld-grid-search-box">
                <IonIcon icon={searchOutline} className="ld-grid-search-icon" />
                <input
                  type="text"
                  className="ld-grid-search-input"
                  placeholder="Filter logs..."
                  value={gridSearch}
                  onChange={(e) => setGridSearch(e.target.value)}
                />
                {gridSearch && (
                  <button className="ld-grid-search-clear" onClick={() => setGridSearch("")}>
                    <IonIcon icon={closeOutline} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="ld-loader-container">
              <IonSpinner name="crescent" color="primary" />
              <span>Fetching employee records...</span>
            </div>
          ) : displayedRows.length > 0 ? (
            <div className="ld-table-responsive">
              <table className="ld-table">
                <thead>
                  <tr>
                    <th>Date(s)</th>
                    <th>Category / Type</th>
                    <th>Duration</th>
                    <th>Approval Status</th>
                    <th>Remarks / Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map((rowItem, idx) => {
                    const r = normalizeRow(rowItem);
                    if (!r) return null;

                    const pVal = parseInt(r.ptime, 10);
                    const durationText = !isNaN(pVal) && pVal > 0 ? `${pVal} Mins` : `${r.days} Day(s)`;

                    return (
                      <tr key={r.id || idx}>
                        {/* Date */}
                        <td>
                          <div className="ld-date-badge">
                            <IonIcon icon={calendarOutline} />
                            <span>{r.isSameDay ? r.from : `${r.from} to ${r.to}`}</span>
                          </div>
                        </td>

                        {/* Category */}
                        <td>
                          <span className={`ld-type-chip ${r.typeClass}`}>
                            {getCategoryTypeDisplay(r.typeDisp, r.leaveCategory) || "Leave"}
                          </span>
                        </td>

                        {/* Duration */}
                        <td>
                          <span className="ld-duration-pill">{durationText}</span>
                        </td>

                        {/* Status */}
                        <td>
                          <span className={`ld-pill ${r.statusClass}`}>
                            <span className="ld-pill-dot" />
                            {r.status}
                          </span>
                        </td>

                        {/* Remarks */}
                        <td>
                          <div className="ld-remarks-cell" title={r.remarks}>
                            {r.remarks || "-"}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="ld-empty-state">
              <div className="ld-empty-icon-wrap">
                <IonIcon icon={layersOutline} />
              </div>
              <h3 className="ld-empty-title">No matching records found</h3>
              <p className="ld-empty-text">
                {gridSearch || statusFilter !== "ALL"
                  ? "Try resetting your search query or filter tab."
                  : `No leaves or permissions logged for ${selectedMonth}.`}
              </p>
            </div>
          )}
        </div>

        {/* Employee Dropdown Portal */}
        {isEmployeeDropdownOpen &&
          createPortal(
            <>
              <div
                className="ld-dropdown-outside-click-layer"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEmployeeDropdownOpen(false);
                }}
              />
              <div
                className="ld-custom-dropdown"
                style={{
                  position: "absolute",
                  top: `${employeeDropdownPos.top}px`,
                  left: `${employeeDropdownPos.left}px`,
                  width: `${employeeDropdownPos.width}px`
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="ld-dropdown-search-sec">
                  <IonIcon icon={searchOutline} className="ld-dropdown-search-icon" />
                  <input
                    type="text"
                    className="ld-dropdown-pure-input"
                    placeholder="Search name or code..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                  {searchTerm && (
                    <button className="ld-dropdown-clear-btn" onClick={() => setSearchTerm("")}>
                      <IonIcon icon={closeOutline} />
                    </button>
                  )}
                </div>
                <div className="ld-dropdown-body">
                  {filteredEmployees.map((emp) => {
                    const isSelected = selectedEmpCode === emp.id;
                    const cleanName = emp.name.includes("-") ? emp.name.split("-")[1].trim() : emp.name;
                    const initials = (cleanName.charAt(0) || "?").toUpperCase();
                    const gradIndex = parseInt(emp.id, 10) % 5 || 0;

                    return (
                      <div
                        key={emp.id}
                        className={`ld-dropdown-emp-item ${isSelected ? "selected" : ""}`}
                        onClick={() => {
                          setSelectedEmpCode(emp.id);
                          setSelectedEmpName(emp.name);
                          setIsEmployeeDropdownOpen(false);
                          setSearchTerm("");
                        }}
                      >
                        <div className={`ld-dr-avatar grad-${gradIndex}`}>
                          {emp.id === "0" ? <IonIcon icon={layersOutline} style={{ fontSize: "14px" }} /> : initials}
                        </div>
                        <div className="ld-dr-info">
                          <span className="ld-dr-name">{emp.name}</span>
                          <span className="ld-dr-code">ID: {emp.id}</span>
                        </div>
                        {isSelected && <IonIcon icon={checkmarkCircle} className="ld-dr-check" />}
                      </div>
                    );
                  })}
                  {filteredEmployees.length === 0 && (
                    <div className="ld-dr-no-results">No matches for "{searchTerm}"</div>
                  )}
                </div>
              </div>
            </>,
            document.body
          )}

        {/* Period Dropdown Portal */}
        {isPeriodDropdownOpen &&
          createPortal(
            <>
              <div
                className="ld-dropdown-outside-click-layer"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPeriodDropdownOpen(false);
                }}
              />
              <div
                className="ld-custom-dropdown"
                style={{
                  position: "absolute",
                  top: `${periodDropdownPos.top}px`,
                  left: `${periodDropdownPos.left}px`,
                  width: `${periodDropdownPos.width}px`
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="ld-dropdown-body">
                  {months.map((m, idx) => {
                    const isSelected = m === selectedMonth;
                    return (
                      <div
                        key={idx}
                        className={`ld-dropdown-item ${isSelected ? "selected" : ""}`}
                        onClick={() => {
                          setSelectedMonth(m);
                          setIsPeriodDropdownOpen(false);
                        }}
                      >
                        <span>{m}</span>
                        {isSelected && <IonIcon icon={checkmarkCircle} className="ld-dropdown-check" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>,
            document.body
          )}

        <IonToast
          isOpen={toastOpen}
          onDidDismiss={() => setToastOpen(false)}
          message={toastMsg}
          duration={2500}
          color={toastColor}
          position="top"
        />
      </IonContent>
    </IonPage>
  );
};

export default LeaveDashboard;
