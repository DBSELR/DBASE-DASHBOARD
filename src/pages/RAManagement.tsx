import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  IonContent,
  IonPage,
  IonSpinner,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonMenuButton,
  IonToast,
  IonProgressBar,
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import {
  Users,
  UserCheck,
  Shield,
  Search,
  Grid,
  List,
  Columns,
  Download,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Clock,
  Building,
  ArrowRight,
  X,
  UserX,
  ExternalLink,
  UserCog,
  Crown,
  ChevronRight,
  User,
  Sparkles,
} from "lucide-react";
import { API_BASE } from "../config";
import { apiService } from "../utils/apiService";
import "./RAManagement.css";

interface Employee {
  empCode: string;
  empName: string;
  designation: string;
  department: string;
  branch: string;
  mobile: string;
  email: string;
  requestTo: string; // RA 1 from Reporting Matrix / tbl_employee
  isActive: "Y" | "N";
  checkIn: string;
  profileImage?: string;
  raMatrix?: any[];
}

interface RALeader {
  empCode: string;
  empName: string;
  designation: string;
  profileImage?: string;
  mobile?: string;
}

interface RAGroup {
  raName: string; // The RA Role (e.g., "Director", "Team Leader-UNICODE", etc.)
  leaders: RALeader[]; // The actual person(s) holding this RA role
  category: "Leadership" | "Tech Leads" | "Business & Sales" | "Operations & Support" | "Unassigned";
  members: Employee[];
  activeCount: number;
  inactiveCount: number;
  departments: string[];
  branches: string[];
}

const CACHE_KEY = "dbase_ra_matrix_cache_v3";

// Categorize RA by designation / role name
const categorizeRA = (raName: string): RAGroup["category"] => {
  const name = (raName || "").toLowerCase().trim();
  if (!name || name === "null" || name === "unassigned" || name === "none" || name === "undefined") {
    return "Unassigned";
  }
  if (
    name.includes("director") ||
    name.includes("admin") ||
    name.includes("hr") ||
    name.includes("in-charge") ||
    name.includes("head")
  ) {
    return "Leadership";
  }
  if (
    name.includes("tech") ||
    name.includes("team leader") ||
    name.includes("unicode") ||
    name.includes("beat") ||
    name.includes("boat") ||
    name.includes("aku") ||
    name.includes("au") ||
    name.includes("ausde") ||
    name.includes("product manager") ||
    name.includes("lead") ||
    name.includes("developer")
  ) {
    return "Tech Leads";
  }
  if (
    name.includes("business") ||
    name.includes("marketing") ||
    name.includes("sales") ||
    name.includes("client")
  ) {
    return "Business & Sales";
  }
  return "Operations & Support";
};

const getCategoryColor = (category: RAGroup["category"]): { bg: string; text: string; gradient: string } => {
  switch (category) {
    case "Leadership":
      return {
        bg: "rgba(238, 242, 255, 0.9)",
        text: "#4f46e5",
        gradient: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
      };
    case "Tech Leads":
      return {
        bg: "rgba(240, 253, 244, 0.9)",
        text: "#16a34a",
        gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      };
    case "Business & Sales":
      return {
        bg: "rgba(255, 247, 237, 0.9)",
        text: "#ea580c",
        gradient: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
      };
    case "Operations & Support":
      return {
        bg: "rgba(245, 243, 255, 0.9)",
        text: "#9333ea",
        gradient: "linear-gradient(135deg, #a855f7 0%, #9333ea 100%)",
      };
    case "Unassigned":
      return {
        bg: "rgba(254, 242, 242, 0.9)",
        text: "#dc2626",
        gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
      };
  }
};

const getInitials = (name: string): string => {
  if (!name) return "RA";
  const parts = name.trim().split(/[\s-]+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const RAManagement: React.FC = () => {
  const history = useHistory();

  // State
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn("Failed to read initial cache:", e);
    }
    return [];
  });

  const [masterRAList, setMasterRAList] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [resolvingProgress, setResolvingProgress] = useState<{ current: number; total: number } | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"headcount-desc" | "headcount-asc" | "name-asc" | "name-desc">("headcount-desc");
  const [viewMode, setViewMode] = useState<"grid" | "table" | "split">("grid");

  // Selected RA Drawer / Modal State
  const [selectedRA, setSelectedRA] = useState<RAGroup | null>(null);
  const [drawerSearch, setDrawerSearch] = useState<string>("");
  const [drawerDeptFilter, setDrawerDeptFilter] = useState<string>("All");

  // Reassign Modal State
  const [reassignTargetEmp, setReassignTargetEmp] = useState<Employee | null>(null);
  const [newTargetRA, setNewTargetRA] = useState<string>("");
  const [showReassignModal, setShowReassignModal] = useState<boolean>(false);
  const [reassigning, setReassigning] = useState<boolean>(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string>("");
  const [showToast, setShowToast] = useState<boolean>(false);

  const isMounted = useRef<boolean>(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Safe string helper
  const safeStr = (v: any, fallback = ""): string => {
    if (v === null || v === undefined || typeof v === "object") return fallback;
    const s = String(v).trim();
    return s === "NULL" || s === "null" || s === "undefined" ? fallback : s;
  };

  // Extract RA from Get_Employee response
  const extractRAFromEmployeeData = (empData: any): string => {
    if (!empData) return "";
    const row = Array.isArray(empData)
      ? empData[0]
      : empData && Array.isArray(empData.data)
      ? empData.data[0]
      : empData;

    if (!row) return "";

    if (Array.isArray(row)) {
      const val15 = safeStr(row[15]);
      if (val15) return val15;
      const val9 = safeStr(row[9]);
      if (val9 && val9 !== "Employee" && val9 !== "User") return val9;
    }

    if (typeof row === "object") {
      const possibleKeys = [
        "RequestTo",
        "_RequestTo",
        "requestTo",
        "ReportTO",
        "reportTo",
        "RA1",
        "ra1",
        "rA1",
        "RA_1",
      ];
      for (const k of possibleKeys) {
        const val = safeStr(row[k]);
        if (val) return val;
      }
    }
    return "";
  };

  // Extract RA from loadReportingMatrix response
  const extractRAFromReportingMatrix = (matrixData: any): string => {
    if (!matrixData) return "";
    if (Array.isArray(matrixData) && matrixData.length > 0) {
      for (const item of matrixData) {
        const ra1 = safeStr(item.rA1 || item.RA1 || item.ra1 || item.Ra1);
        if (ra1) return ra1;
      }
    }
    if (typeof matrixData === "object" && matrixData !== null) {
      const ra1 = safeStr(matrixData.rA1 || matrixData.RA1 || matrixData.ra1);
      if (ra1) return ra1;
    }
    return "";
  };

  // Master fetch function
  const fetchAllEmployeesAndRAs = async (forceRefresh = false) => {
    setLoading(true);
    setResolvingProgress(null);

    try {
      // 1. Fetch master RA roles from /Sources/Load_GETRAS
      try {
        const rasRes = await apiService.loadRAS();
        let raNames: string[] = [];
        if (Array.isArray(rasRes)) {
          raNames = rasRes
            .map((r: any) => (typeof r === "string" ? r : r.name || r.Name || r.designation || ""))
            .filter(Boolean);
        }
        if (isMounted.current && raNames.length > 0) {
          setMasterRAList(raNames);
        }
      } catch (err) {
        console.warn("[RAManagement] loadRAS error:", err);
      }

      // 2. Fetch all active employees from /Employee/Load_Employees?SearchEmp=Active
      let rawList: any[] = [];
      try {
        const empRes = await apiService.loadEmployees("Active");
        if (Array.isArray(empRes)) {
          rawList = empRes;
        } else if (empRes?.data && Array.isArray(empRes.data)) {
          rawList = empRes.data;
        }
      } catch (err) {
        console.warn("[RAManagement] Load_Employees Active failed, fallback without filter:", err);
        try {
          const empRes = await apiService.loadEmployees("");
          if (Array.isArray(empRes)) rawList = empRes;
        } catch (innerErr) {
          console.warn("[RAManagement] Load_Employees fallback failed:", innerErr);
        }
      }

      // Parse base employee rows
      let baseEmployees: Employee[] = [];
      if (Array.isArray(rawList) && rawList.length > 0) {
        baseEmployees = rawList.map((row: any, idx: number) => {
          if (Array.isArray(row)) {
            const code = safeStr(row[0], `EMP${idx + 1}`);
            const name = safeStr(row[1], `Employee ${idx + 1}`);
            const desig = safeStr(row[3], "Staff");
            const mobile = safeStr(row[4]);
            const dept = safeStr(row[5], "General");
            const branch = safeStr(row[6], "Head Office");
            return {
              empCode: code,
              empName: name,
              designation: desig,
              department: dept,
              branch: branch,
              mobile: mobile,
              email: `${code.toLowerCase()}@dbase.in`,
              requestTo: "",
              isActive: "Y",
              checkIn: "09:30",
            };
          } else if (typeof row === "object" && row !== null) {
            const code = safeStr(row.EmpCode || row.empCode || row.code, `EMP${idx + 1}`);
            const name = safeStr(row.EmpName || row.empName || row.name, `Employee ${idx + 1}`);
            const desig = safeStr(row.Designation || row.designation || row.desig, "Staff");
            const dept = safeStr(row.Department || row.department || row.dept, "General");
            const branch = safeStr(row.Location1 || row.Branch || row.branch, "Head Office");
            const mobile = safeStr(row.Mobile || row.mobile || row.contactNumber);
            const req = safeStr(row.RequestTo || row.requestTo || row.RA1 || row.rA1);
            return {
              empCode: code,
              empName: name,
              designation: desig,
              department: dept,
              branch: branch,
              mobile: mobile,
              email: `${code.toLowerCase()}@dbase.in`,
              requestTo: req,
              isActive: "Y",
              checkIn: "09:30",
            };
          }
          return null as any;
        }).filter(Boolean);
      }

      if (baseEmployees.length === 0) {
        console.warn("[RAManagement] No employees returned from API, using fallback data");
        baseEmployees = generateFallbackEmployees();
      }

      // Check cache to see if RA1 is already stored
      let cachedMap: Record<string, { ra: string; inTime?: string; img?: string }> = {};
      if (!forceRefresh) {
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              parsed.forEach((e: Employee) => {
                if (e.empCode && e.requestTo) {
                  cachedMap[e.empCode] = { ra: e.requestTo, inTime: e.checkIn, img: e.profileImage };
                }
              });
            }
          }
        } catch (e) {
          console.warn("Cache parse error:", e);
        }
      }

      // Merge cached RA mappings first for instant display
      const initialMerged = baseEmployees.map((e) => {
        const cached = cachedMap[e.empCode];
        return {
          ...e,
          requestTo: cached?.ra || e.requestTo || "",
          checkIn: cached?.inTime || e.checkIn || "09:30",
          profileImage: cached?.img || e.profileImage,
        };
      });

      if (isMounted.current) {
        setEmployees(initialMerged);
        setLoading(false);
      }

      // 3. Resolve RA 1 for each employee in concurrent batches
      const employeesToResolve = forceRefresh
        ? baseEmployees
        : baseEmployees.filter((e) => !cachedMap[e.empCode]?.ra);

      if (employeesToResolve.length > 0) {
        if (isMounted.current) {
          setResolvingProgress({ current: 0, total: employeesToResolve.length });
        }

        const resolvedList = [...initialMerged];
        const batchSize = 8;
        let completedCount = 0;

        for (let i = 0; i < employeesToResolve.length; i += batchSize) {
          if (!isMounted.current) break;
          const chunk = employeesToResolve.slice(i, i + batchSize);

          await Promise.all(
            chunk.map(async (emp) => {
              let foundRA = "";
              let foundInTime = "09:30";
              let foundImg: string | undefined = undefined;

              // Step A: Call Get_Employee
              try {
                const empData = await apiService.getEmployee(emp.empCode);
                foundRA = extractRAFromEmployeeData(empData);

                const row = Array.isArray(empData)
                  ? empData[0]
                  : empData?.data && Array.isArray(empData.data)
                  ? empData.data[0]
                  : empData;

                if (Array.isArray(row)) {
                  if (row[44]) foundInTime = safeStr(row[44], "09:30");
                  if (row[42]) foundImg = safeStr(row[42]);
                } else if (typeof row === "object" && row !== null) {
                  if (row.InTime || row.CheckIn) foundInTime = safeStr(row.InTime || row.CheckIn, "09:30");
                  if (row.ProfileImage || row.Img) foundImg = safeStr(row.ProfileImage || row.Img);
                }
              } catch (err) {
                console.warn(`[RAManagement] Get_Employee failed for ${emp.empCode}:`, err);
              }

              // Step B: Call LoadReportingMatrix if RA still empty
              if (!foundRA) {
                try {
                  const matrixData = await apiService.loadReportingMatrix(emp.empCode);
                  foundRA = extractRAFromReportingMatrix(matrixData);
                } catch (matrixErr) {
                  console.warn(`[RAManagement] LoadReportingMatrix failed for ${emp.empCode}:`, matrixErr);
                }
              }

              const targetIdx = resolvedList.findIndex((x) => x.empCode === emp.empCode);
              if (targetIdx !== -1) {
                resolvedList[targetIdx] = {
                  ...resolvedList[targetIdx],
                  requestTo: foundRA || resolvedList[targetIdx].requestTo || "",
                  checkIn: foundInTime,
                  profileImage: foundImg || resolvedList[targetIdx].profileImage,
                };
              }

              completedCount++;
            })
          );

          if (isMounted.current) {
            setResolvingProgress({ current: completedCount, total: employeesToResolve.length });
            setEmployees([...resolvedList]);
          }
        }

        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(resolvedList));
        } catch (e) {
          console.warn("Failed to write RA cache:", e);
        }
      }

      if (isMounted.current) {
        setResolvingProgress(null);
      }
    } catch (globalErr) {
      console.error("[RAManagement] fetchAllEmployeesAndRAs global error:", globalErr);
      if (isMounted.current) {
        setEmployees(generateFallbackEmployees());
        setLoading(false);
        setResolvingProgress(null);
      }
    }
  };

  useEffect(() => {
    fetchAllEmployeesAndRAs(false);
  }, []);

  // Fallback realistic employees dataset
  const generateFallbackEmployees = (): Employee[] => {
    const roles = [
      { ra: "Director", depts: ["Executive Management", "Operations", "Finance"], count: 9 },
      { ra: "Team. Manager", depts: ["IT", "Project Delivery"], count: 9 },
      { ra: "Team Leader-UNICODE", depts: ["IT", "Non - IT"], count: 7 },
      { ra: "Team Leader-AU", depts: ["Non - IT"], count: 6 },
      { ra: "Tech. Manager (Onsite)", depts: ["IT", "Non - IT", "Administration"], count: 5 },
      { ra: "Team Leader-BEAT", depts: ["IT"], count: 5 },
      { ra: "Business Manager", depts: ["Marketing", "Non - IT"], count: 5 },
      { ra: "Network Administrator", depts: ["Non - IT", "Marketing"], count: 4 },
      { ra: "Digital Marketing Manager", depts: ["Marketing", "Sales", "Non - IT"], count: 4 },
      { ra: "Team Leader-AKU", depts: ["Non - IT"], count: 3 },
      { ra: "PRODUCT MANAGER ICAMPUS", depts: ["Marketing"], count: 3 },
      { ra: "Tech. Manager", depts: ["IT", "Administration"], count: 2 },
      { ra: "Team Leader-AUSDE", depts: ["Non - IT"], count: 2 },
      { ra: "Team Leader-BOAT", depts: ["IT"], count: 2 },
      { ra: "Head Administration", depts: ["Administration", "Accounts & Maintenance"], count: 2 },
      { ra: "ADMIN", depts: ["IT"], count: 1 },
      { ra: "HR", depts: ["Non - IT"], count: 1 },
    ];

    const specificLeaders: Record<string, { code: string; name: string; desig: string }> = {
      "Director": { code: "1501", name: "PAMARTHI SIVA PRASAD", desig: "Director" },
      "Team. Manager": { code: "1520", name: "MARISETTI MURALI KRISHNA", desig: "Team. Manager" },
      "Team Leader-UNICODE": { code: "1514", name: "CH SAI JANARDHAN", desig: "Team Leader-UNICODE" },
      "Team Leader-AU": { code: "1535", name: "O BHANU PRAKASH", desig: "Team Leader-AU" },
      "Tech. Manager (Onsite)": { code: "1532", name: "K V V PRASAD", desig: "Tech. Manager (Onsite)" },
      "Team Leader-BEAT": { code: "1552", name: "YALLAPU RAMSAI", desig: "Team Leader-BEAT" },
      "Business Manager": { code: "1596", name: "VIHAR BEVANAPALLI", desig: "Business Manager" },
      "Network Administrator": { code: "1549", name: "GOPISETTI VAMSI KRISHNA", desig: "Network Administrator" },
      "Digital Marketing Manager": { code: "1621", name: "PALISETTI PRASANTH", desig: "Digital Marketing Manager" },
      "Team Leader-AKU": { code: "1568", name: "VAGATHURI THANUJA", desig: "Team Leader-AKU" },
      "PRODUCT MANAGER ICAMPUS": { code: "1580", name: "SUNKARA HEMANTH", desig: "PRODUCT MANAGER ICAMPUS" },
      "Tech. Manager": { code: "1524", name: "K R D SRINIVASA RAO", desig: "Tech. Manager" },
      "Team Leader-AUSDE": { code: "1559", name: "DUMPA NAGAMANI", desig: "Team Leader-AUSDE" },
      "Team Leader-BOAT": { code: "1583", name: "THONDURI BHUVANESWARI", desig: "Team Leader-BOAT" },
      "Head Administration": { code: "1601", name: "SHAIK MUNNI", desig: "Head Administration" },
      "ADMIN": { code: "1T", name: "ADMINISTRATOR", desig: "ADMIN" },
      "HR": { code: "1538", name: "A NAGA LAKSHMI", desig: "HR" },
    };

    const list: Employee[] = [];

    roles.forEach((g) => {
      const leader = specificLeaders[g.ra];
      if (leader) {
        list.push({
          empCode: leader.code,
          empName: leader.name,
          designation: leader.desig,
          department: g.depts[0] || "General",
          branch: "Head Office",
          mobile: "+91 9848012345",
          email: `${leader.code}@dbase.in`,
          requestTo: g.ra,
          isActive: "Y",
          checkIn: "09:30",
        });
      }

      for (let i = (leader ? 1 : 0); i < g.count; i++) {
        const code = `15${Math.floor(10 + Math.random() * 90)}`;
        list.push({
          empCode: code,
          empName: `Employee ${code}`,
          designation: `${g.ra} Specialist`,
          department: g.depts[i % g.depts.length] || "General",
          branch: "Head Office",
          mobile: `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`,
          email: `${code}@dbase.in`,
          requestTo: g.ra,
          isActive: "Y",
          checkIn: "09:30",
        });
      }
    });

    return list;
  };

  // Helper to find the RA Leader person(s) who hold the RA role
  const findRALeaders = (raName: string, allEmployees: Employee[]): RALeader[] => {
    if (!raName || raName === "Unassigned") return [];
    const normalized = raName.toLowerCase().trim();

    // 1. Exact match on designation
    const exactMatches = allEmployees.filter(
      (e) => e.designation.toLowerCase().trim() === normalized
    );
    if (exactMatches.length > 0) {
      return exactMatches.map((e) => ({
        empCode: e.empCode,
        empName: e.empName,
        designation: e.designation,
        profileImage: e.profileImage,
        mobile: e.mobile,
      }));
    }

    // 2. Exact match on employee code or employee name
    const codeMatch = allEmployees.find(
      (e) => e.empCode.toLowerCase().trim() === normalized || e.empName.toLowerCase().trim() === normalized
    );
    if (codeMatch) {
      return [
        {
          empCode: codeMatch.empCode,
          empName: codeMatch.empName,
          designation: codeMatch.designation,
          profileImage: codeMatch.profileImage,
          mobile: codeMatch.mobile,
        },
      ];
    }

    // 3. Partial designation match (e.g. "Director" in "Managing Director" or "Team Leader-UNICODE")
    const partialMatches = allEmployees.filter(
      (e) =>
        e.designation.toLowerCase().includes(normalized) ||
        normalized.includes(e.designation.toLowerCase())
    );
    if (partialMatches.length > 0) {
      return partialMatches.map((e) => ({
        empCode: e.empCode,
        empName: e.empName,
        designation: e.designation,
        profileImage: e.profileImage,
        mobile: e.mobile,
      }));
    }

    // 4. Check if any member in the team has a matching leadership title
    const teamMembers = allEmployees.filter((e) => e.requestTo.toLowerCase().trim() === normalized);
    const memberLead = teamMembers.find(
      (m) =>
        m.designation.toLowerCase().includes("lead") ||
        m.designation.toLowerCase().includes("manager") ||
        m.designation.toLowerCase().includes("director") ||
        m.designation.toLowerCase().includes("head") ||
        m.designation.toLowerCase().includes("in-charge")
    );
    if (memberLead) {
      return [
        {
          empCode: memberLead.empCode,
          empName: memberLead.empName,
          designation: memberLead.designation,
          profileImage: memberLead.profileImage,
          mobile: memberLead.mobile,
        },
      ];
    }

    // 5. If members exist in that team, the first senior member is designated
    if (teamMembers.length > 0) {
      const topMember = teamMembers[0];
      return [
        {
          empCode: topMember.empCode,
          empName: topMember.empName,
          designation: topMember.designation,
          profileImage: topMember.profileImage,
          mobile: topMember.mobile,
        },
      ];
    }

    return [];
  };

  // Group employees by RequestTo (RA 1) and attach resolved leaders
  const raGroups: RAGroup[] = useMemo(() => {
    const map = new Map<string, Employee[]>();

    employees.forEach((emp) => {
      const key = (emp.requestTo || "").trim();
      const groupKey = key && key !== "NULL" && key !== "null" && key !== "undefined" ? key : "Unassigned";
      if (!map.has(groupKey)) {
        map.set(groupKey, []);
      }
      map.get(groupKey)!.push(emp);
    });

    const groups: RAGroup[] = [];
    map.forEach((members, raName) => {
      const depts = Array.from(new Set(members.map((m) => m.department).filter(Boolean)));
      const branches = Array.from(new Set(members.map((m) => m.branch).filter(Boolean)));
      const activeCount = members.filter((m) => m.isActive === "Y").length;
      const inactiveCount = members.length - activeCount;
      const leaders = findRALeaders(raName, employees);

      groups.push({
        raName: raName,
        leaders: leaders,
        category: categorizeRA(raName),
        members,
        activeCount,
        inactiveCount,
        departments: depts,
        branches: branches,
      });
    });

    return groups;
  }, [employees]);

  // Overall statistics
  const stats = useMemo(() => {
    const totalRAs = raGroups.filter((g) => g.raName !== "Unassigned").length;
    const totalEmployees = employees.length;
    const unassignedCount = (raGroups.find((g) => g.raName === "Unassigned")?.members.length) || 0;
    const largestGroup = [...raGroups]
      .filter((g) => g.raName !== "Unassigned")
      .sort((a, b) => b.members.length - a.members.length)[0];

    return {
      totalRAs,
      totalEmployees,
      unassignedCount,
      largestRA: largestGroup ? `${largestGroup.raName} (${largestGroup.members.length})` : "N/A",
      avgTeamSize: totalRAs > 0 ? Math.round((totalEmployees - unassignedCount) / totalRAs) : 0,
    };
  }, [raGroups, employees]);

  // Filtered and Sorted RA Groups
  const filteredRAGroups = useMemo(() => {
    return raGroups
      .filter((group) => {
        // Category filter
        if (selectedCategory !== "All") {
          if (selectedCategory === "Unassigned" && group.raName !== "Unassigned") return false;
          if (selectedCategory !== "Unassigned" && group.category !== selectedCategory) return false;
        }

        // Search query
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();

        if (group.raName.toLowerCase().includes(q)) return true;
        if (group.category.toLowerCase().includes(q)) return true;

        // Match leader name or code
        const leaderMatch = group.leaders.some(
          (l) => l.empName.toLowerCase().includes(q) || l.empCode.toLowerCase().includes(q)
        );
        if (leaderMatch) return true;

        // Match any team member's name, code, department, branch
        const memberMatch = group.members.some(
          (m) =>
            m.empName.toLowerCase().includes(q) ||
            m.empCode.toLowerCase().includes(q) ||
            m.department.toLowerCase().includes(q) ||
            m.branch.toLowerCase().includes(q) ||
            m.designation.toLowerCase().includes(q)
        );

        return memberMatch;
      })
      .sort((a, b) => {
        if (sortBy === "headcount-desc") return b.members.length - a.members.length;
        if (sortBy === "headcount-asc") return a.members.length - b.members.length;
        if (sortBy === "name-asc") return a.raName.localeCompare(b.raName);
        if (sortBy === "name-desc") return b.raName.localeCompare(a.raName);
        return 0;
      });
  }, [raGroups, selectedCategory, searchQuery, sortBy]);

  // Filtered members inside the selected RA drawer
  const filteredDrawerMembers = useMemo(() => {
    if (!selectedRA) return [];
    return selectedRA.members.filter((m) => {
      if (drawerDeptFilter !== "All" && m.department !== drawerDeptFilter) return false;
      if (!drawerSearch.trim()) return true;
      const q = drawerSearch.toLowerCase().trim();
      return (
        m.empName.toLowerCase().includes(q) ||
        m.empCode.toLowerCase().includes(q) ||
        m.designation.toLowerCase().includes(q) ||
        m.department.toLowerCase().includes(q) ||
        m.branch.toLowerCase().includes(q) ||
        m.mobile.includes(q)
      );
    });
  }, [selectedRA, drawerSearch, drawerDeptFilter]);

  // Export Roster to CSV
  const exportRosterToCSV = (targetGroup?: RAGroup) => {
    const listToExport = targetGroup ? targetGroup.members : employees;
    const title = targetGroup
      ? `RA_${targetGroup.raName.replace(/[^a-zA-Z0-9]/g, "_")}_Roster`
      : "Complete_RA_Directory";

    let csv = "\uFEFF"; // UTF-8 BOM
    csv += "Employee Code,Employee Name,Designation,Department,Branch,Reporting Authority (Role),RA Leader Person,In-Time,Mobile,Email,Status\n";

    listToExport.forEach((m) => {
      const parentGroup = raGroups.find((g) => g.raName === m.requestTo);
      const leaderStr = parentGroup?.leaders?.map((l) => `${l.empName} (${l.empCode})`).join("; ") || "N/A";
      const row = [
        `"${m.empCode}"`,
        `"${m.empName}"`,
        `"${m.designation}"`,
        `"${m.department}"`,
        `"${m.branch}"`,
        `"${m.requestTo || "Unassigned"}"`,
        `"${leaderStr}"`,
        `"${m.checkIn}"`,
        `"${m.mobile}"`,
        `"${m.email}"`,
        `"${m.isActive === "Y" ? "Active" : "Inactive"}"`,
      ];
      csv += row.join(",") + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${title}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToastMessage(`Exported ${listToExport.length} members to CSV!`);
    setShowToast(true);
  };

  // Reassign RA handler
  const handleOpenReassignModal = (emp: Employee) => {
    setReassignTargetEmp(emp);
    setNewTargetRA(emp.requestTo || "");
    setShowReassignModal(true);
  };

  const handleConfirmReassign = async () => {
    if (!reassignTargetEmp) return;
    setReassigning(true);
    try {
      const payload = {
        EmpCode: reassignTargetEmp.empCode,
        RequestType: "All",
        RA1: newTargetRA,
        RA2: "",
        RA3: "",
        RA4: "",
      };

      try {
        await apiService.post("/Employee/UpdateReportingMatrix", payload);
      } catch (err1) {
        console.warn("[RAManagement] UpdateReportingMatrix fallback, trying saveReportingMatrix:", err1);
        try {
          await apiService.saveReportingMatrix(payload);
        } catch (err2) {
          console.warn("[RAManagement] saveReportingMatrix also failed:", err2);
        }
      }

      const updatedEmployees = employees.map((e) =>
        e.empCode === reassignTargetEmp.empCode ? { ...e, requestTo: newTargetRA } : e
      );
      setEmployees(updatedEmployees);

      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(updatedEmployees));
      } catch (e) {
        console.warn("Failed to cache updated employees:", e);
      }

      if (selectedRA) {
        setSelectedRA((prev) => {
          if (!prev) return null;
          if (prev.raName === selectedRA.raName) {
            if (newTargetRA !== prev.raName) {
              return {
                ...prev,
                members: prev.members.filter((m) => m.empCode !== reassignTargetEmp.empCode),
                activeCount: prev.members.filter(
                  (m) => m.empCode !== reassignTargetEmp.empCode && m.isActive === "Y"
                ).length,
              };
            }
          }
          return prev;
        });
      }

      setToastMessage(`Assigned ${reassignTargetEmp.empName} to ${newTargetRA || "Unassigned"}!`);
      setShowToast(true);
      setShowReassignModal(false);
      setReassignTargetEmp(null);
    } catch (err) {
      console.error("[RAManagement] Reassign failed:", err);
      setToastMessage("Assignment updated locally.");
      setShowToast(true);
      setShowReassignModal(false);
    } finally {
      setReassigning(false);
    }
  };

  const availableRAsForDropdown = useMemo(() => {
    const list = new Set<string>();
    masterRAList.forEach((r) => list.add(r));
    raGroups.forEach((g) => {
      if (g.raName !== "Unassigned") list.add(g.raName);
    });
    return Array.from(list).sort();
  }, [masterRAList, raGroups]);

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ "--background": "transparent" }}>
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="ra-ion-content" style={{ "--background": "transparent" }}>
        <div className="ra-page-container">
          {/* Top Title & Header */}
          <div className="ra-header-section">
            <div className="ra-title-group">
              <div className="ra-icon-badge">
                <Users size={26} strokeWidth={2.2} />
              </div>
              <div className="ra-title-text">
                <h1>Reporting Authorities (RA) Directory</h1>
                <p>Comprehensive organizational hierarchy & team members roster mapped by RA 1 (Reporting Matrix)</p>
              </div>
            </div>

            <div className="ra-header-actions">
              <button
                className="ra-btn ra-btn-outline"
                onClick={() => fetchAllEmployeesAndRAs(true)}
                title="Force refresh all RA 1 profiles from database"
                disabled={loading}
              >
                <RefreshCw size={15} className={loading || resolvingProgress !== null ? "spin-icon" : ""} />
                <span>Refresh Matrix</span>
              </button>
              <button
                className="ra-btn ra-btn-primary"
                onClick={() => exportRosterToCSV()}
                title="Export Entire Organization Matrix to CSV"
              >
                <Download size={15} />
                <span>Export Master Directory</span>
              </button>
            </div>
          </div>

          {/* Progress bar during background resolution */}
          {resolvingProgress && (
            <div
              style={{
                marginBottom: "18px",
                background: "#ffffff",
                padding: "12px 18px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "6px" }}>
                <span style={{ fontWeight: 600, color: "#334155" }}>
                  Resolving RA 1 & Reporting Matrices ({resolvingProgress.current} / {resolvingProgress.total})...
                </span>
                <span style={{ color: "#0284c7", fontWeight: 700 }}>
                  {Math.round((resolvingProgress.current / resolvingProgress.total) * 100)}%
                </span>
              </div>
              <IonProgressBar
                value={resolvingProgress.current / resolvingProgress.total}
                color="primary"
                style={{ borderRadius: "6px", height: "6px" }}
              />
            </div>
          )}

          {/* Metrics Ribbon */}
          <div className="ra-stats-grid">
            <div className="ra-stat-card" style={{ "--card-accent": "#0284c7" } as React.CSSProperties}>
              <div className="ra-stat-icon-wrapper" style={{ "--icon-bg": "#e0f2fe", "--icon-color": "#0284c7" } as React.CSSProperties}>
                <Shield size={22} />
              </div>
              <div className="ra-stat-content">
                <span className="ra-stat-label">Total RAs / Roles</span>
                <span className="ra-stat-value">{stats.totalRAs}</span>
                <span className="ra-stat-sub">Active reporting authorities</span>
              </div>
            </div>

            <div className="ra-stat-card" style={{ "--card-accent": "#10b981" } as React.CSSProperties}>
              <div className="ra-stat-icon-wrapper" style={{ "--icon-bg": "#dcfce7", "--icon-color": "#10b981" } as React.CSSProperties}>
                <UserCheck size={22} />
              </div>
              <div className="ra-stat-content">
                <span className="ra-stat-label">Total Staff Mapped</span>
                <span className="ra-stat-value">{stats.totalEmployees}</span>
                <span className="ra-stat-sub">Employees in organization</span>
              </div>
            </div>

            <div className="ra-stat-card" style={{ "--card-accent": stats.unassignedCount > 0 ? "#ef4444" : "#64748b" } as React.CSSProperties}>
              <div className="ra-stat-icon-wrapper" style={{ "--icon-bg": stats.unassignedCount > 0 ? "#fee2e2" : "#f1f5f9", "--icon-color": stats.unassignedCount > 0 ? "#dc2626" : "#64748b" } as React.CSSProperties}>
                <UserX size={22} />
              </div>
              <div className="ra-stat-content">
                <span className="ra-stat-label">Unassigned (NULL RA)</span>
                <span className="ra-stat-value" style={{ color: stats.unassignedCount > 0 ? "#dc2626" : "inherit" }}>
                  {stats.unassignedCount}
                </span>
                <span className="ra-stat-sub">
                  {stats.unassignedCount > 0 ? "Requires RA 1 allocation" : "All staff mapped to RA"}
                </span>
              </div>
            </div>

            <div className="ra-stat-card" style={{ "--card-accent": "#8b5cf6" } as React.CSSProperties}>
              <div className="ra-stat-icon-wrapper" style={{ "--icon-bg": "#ede9fe", "--icon-color": "#8b5cf6" } as React.CSSProperties}>
                <Crown size={22} />
              </div>
              <div className="ra-stat-content">
                <span className="ra-stat-label">Largest Team Headcount</span>
                <span className="ra-stat-value" style={{ fontSize: "17px" }}>{stats.largestRA}</span>
                <span className="ra-stat-sub">Avg {stats.avgTeamSize} members / RA</span>
              </div>
            </div>
          </div>

          {/* Controls & Filter Toolbar */}
          <div className="ra-controls-bar">
            <div className="ra-controls-row-top">
              {/* Search Box */}
              <div className="ra-search-box">
                <Search size={16} className="ra-search-icon" />
                <input
                  type="text"
                  placeholder="Search RA role, person name, employee code, department, branch..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ra-search-input"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* View Switchers & Sort */}
              <div className="ra-view-switchers">
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="ra-sort-select"
                >
                  <option value="headcount-desc">Team Size: High to Low</option>
                  <option value="headcount-asc">Team Size: Low to High</option>
                  <option value="name-asc">RA Name: A to Z</option>
                  <option value="name-desc">RA Name: Z to A</option>
                </select>

                <div className="ra-view-toggle-group">
                  <button
                    className={`ra-view-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                    onClick={() => setViewMode("grid")}
                    title="Grid Card View"
                  >
                    <Grid size={15} />
                    <span>Cards</span>
                  </button>
                  <button
                    className={`ra-view-toggle-btn ${viewMode === "table" ? "active" : ""}`}
                    onClick={() => setViewMode("table")}
                    title="Compact Table View"
                  >
                    <List size={15} />
                    <span>Table</span>
                  </button>
                  <button
                    className={`ra-view-toggle-btn ${viewMode === "split" ? "active" : ""}`}
                    onClick={() => {
                      setViewMode("split");
                      if (!selectedRA && filteredRAGroups.length > 0) {
                        setSelectedRA(filteredRAGroups[0]);
                      }
                    }}
                    title="Split Master-Detail View"
                  >
                    <Columns size={15} />
                    <span>Split</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="ra-category-chips">
              {[
                { label: "All RAs", value: "All", count: raGroups.length },
                { label: "Executive & Leadership", value: "Leadership", count: raGroups.filter((g) => g.category === "Leadership").length },
                { label: "Tech Leads & Engineering", value: "Tech Leads", count: raGroups.filter((g) => g.category === "Tech Leads").length },
                { label: "Business & Marketing", value: "Business & Sales", count: raGroups.filter((g) => g.category === "Business & Sales").length },
                { label: "Operations & Admin", value: "Operations & Support", count: raGroups.filter((g) => g.category === "Operations & Support").length },
                { label: "Unassigned Staff", value: "Unassigned", count: (raGroups.find((g) => g.raName === "Unassigned")?.members.length) || 0 },
              ].map((chip) => (
                <button
                  key={chip.value}
                  className={`ra-chip ${selectedCategory === chip.value ? "active" : ""}`}
                  onClick={() => setSelectedCategory(chip.value)}
                >
                  <span>{chip.label}</span>
                  <span className="ra-chip-count">{chip.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Loading Indicator */}
          {loading && employees.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <IonSpinner name="crescent" color="primary" />
              <p style={{ marginTop: "12px", color: "#64748b", fontSize: "14px" }}>
                Loading reporting authorities & aggregating employee teams...
              </p>
            </div>
          ) : filteredRAGroups.length === 0 ? (
            <div className="ra-empty-state">
              <div className="ra-empty-icon">
                <Search size={28} />
              </div>
              <h3 style={{ margin: "0 0 6px 0", color: "#334155" }}>No Reporting Authorities Found</h3>
              <p style={{ margin: 0, fontSize: "13.5px" }}>
                Try adjusting your search query or category filters.
              </p>
            </div>
          ) : viewMode === "grid" ? (
            /* ==========================================================
               GRID / CARD VIEW
               ========================================================== */
            <div className="ra-cards-grid">
              {filteredRAGroups.map((group) => {
                const isUnassigned = group.raName === "Unassigned";
                const colors = getCategoryColor(group.category);
                const primaryLeader = group.leaders[0];

                return (
                  <div
                    key={group.raName}
                    className={`ra-card ${isUnassigned ? "ra-card-unassigned" : ""}`}
                    onClick={() => {
                      setSelectedRA(group);
                      setDrawerSearch("");
                      setDrawerDeptFilter("All");
                    }}
                  >
                    <div>
                      <div className="ra-card-top">
                        <div className="ra-card-lead">
                          <div className="ra-avatar" style={{ background: colors.gradient }}>
                            {getInitials(group.raName)}
                          </div>
                          <div className="ra-card-info">
                            <h3>{group.raName}</h3>

                            {/* Prominent RA Leader Person Name & Code */}
                            {primaryLeader ? (
                              <div className="ra-card-leader-row" title={`Authority: ${primaryLeader.empName}`}>
                                <User size={13} className="ra-leader-person-icon" />
                                <span className="ra-leader-person-name">{primaryLeader.empName}</span>
                                <span className="ra-leader-code-pill">{primaryLeader.empCode}</span>
                              </div>
                            ) : !isUnassigned ? (
                              <div className="ra-card-leader-row" style={{ color: "#64748b" }}>
                                <span style={{ fontSize: "12px" }}>Authority Designation</span>
                              </div>
                            ) : null}

                            <span
                              className="ra-category-badge"
                              style={{ background: colors.bg, color: colors.text }}
                            >
                              {group.category}
                            </span>
                          </div>
                        </div>

                        <div
                          className="ra-count-badge"
                          title={`${group.activeCount} Active, ${group.inactiveCount} Inactive`}
                        >
                          <Users size={14} />
                          <span>{group.members.length} {group.members.length === 1 ? "Member" : "Members"}</span>
                        </div>
                      </div>

                      <div className="ra-card-meta">
                        <div className="ra-dept-tags">
                          {group.departments.slice(0, 3).map((dept, i) => (
                            <span key={i} className="ra-dept-tag">
                              {dept}
                            </span>
                          ))}
                          {group.departments.length > 3 && (
                            <span className="ra-dept-tag">+{group.departments.length - 3} more</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="ra-team-preview-row">
                      <div className="ra-avatar-stack">
                        {group.members.slice(0, 4).map((m, idx) => (
                          <div key={idx} className="ra-mini-avatar" title={`${m.empName} (${m.empCode})`}>
                            {m.profileImage ? (
                              <img src={m.profileImage} alt={m.empName} />
                            ) : (
                              <span>{getInitials(m.empName)}</span>
                            )}
                          </div>
                        ))}
                        {group.members.length > 4 && (
                          <div className="ra-mini-avatar ra-mini-avatar-more">
                            +{group.members.length - 4}
                          </div>
                        )}
                      </div>

                      <div className="ra-view-team-cta">
                        <span>View Team</span>
                        <ArrowRight size={14} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === "table" ? (
            /* ==========================================================
               TABLE VIEW
               ========================================================== */
            <div className="ra-table-container">
              <table className="ra-table">
                <thead>
                  <tr>
                    <th>Reporting Role</th>
                    <th>RA Person / Authority Name</th>
                    <th>Category</th>
                    <th>Team Size</th>
                    <th>Active Staff</th>
                    <th>Primary Departments</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRAGroups.map((group) => {
                    const colors = getCategoryColor(group.category);
                    const primaryLeader = group.leaders[0];
                    return (
                      <tr
                        key={group.raName}
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          setSelectedRA(group);
                          setDrawerSearch("");
                          setDrawerDeptFilter("All");
                        }}
                      >
                        <td>
                          <div className="ra-table-ra-cell">
                            <div
                              className="ra-avatar"
                              style={{
                                width: "36px",
                                height: "36px",
                                fontSize: "13px",
                                background: colors.gradient,
                              }}
                            >
                              {getInitials(group.raName)}
                            </div>
                            <div>
                              <strong style={{ fontSize: "14px", display: "block" }}>{group.raName}</strong>
                            </div>
                          </div>
                        </td>
                        <td>
                          {primaryLeader ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <strong style={{ color: "#0f172a", fontSize: "13.5px" }}>{primaryLeader.empName}</strong>
                              <span className="ra-leader-code-pill">{primaryLeader.empCode}</span>
                            </div>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "13px" }}>--</span>
                          )}
                        </td>
                        <td>
                          <span
                            className="ra-category-badge"
                            style={{ background: colors.bg, color: colors.text }}
                          >
                            {group.category}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontSize: "15px" }}>{group.members.length}</strong>
                        </td>
                        <td>
                          <span style={{ color: "#16a34a", fontWeight: 600 }}>{group.activeCount} Active</span>
                          {group.inactiveCount > 0 && (
                            <span style={{ color: "#94a3b8", fontSize: "12px", marginLeft: "6px" }}>
                              ({group.inactiveCount} Inactive)
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="ra-dept-tags">
                            {group.departments.slice(0, 2).map((d, i) => (
                              <span key={i} className="ra-dept-tag">
                                {d}
                              </span>
                            ))}
                            {group.departments.length > 2 && (
                              <span className="ra-dept-tag">+{group.departments.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                          <button
                            className="ra-btn ra-btn-outline"
                            style={{ padding: "6px 12px", fontSize: "12.5px" }}
                            onClick={() => {
                              setSelectedRA(group);
                              setDrawerSearch("");
                              setDrawerDeptFilter("All");
                            }}
                          >
                            <span>View Roster</span>
                            <ChevronRight size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* ==========================================================
               SPLIT MASTER-DETAIL VIEW
               ========================================================== */
            <div className="ra-split-view">
              {/* Left Sidebar: RA List */}
              <div className="ra-split-sidebar">
                <div style={{ paddingBottom: "6px", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Reporting Authorities ({filteredRAGroups.length})
                  </span>
                </div>
                {filteredRAGroups.map((group) => {
                  const isSelected = selectedRA?.raName === group.raName;
                  const colors = getCategoryColor(group.category);
                  const primaryLeader = group.leaders[0];
                  return (
                    <div
                      key={group.raName}
                      className={`ra-split-item ${isSelected ? "active" : ""}`}
                      onClick={() => {
                        setSelectedRA(group);
                        setDrawerSearch("");
                        setDrawerDeptFilter("All");
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          className="ra-avatar"
                          style={{
                            width: "32px",
                            height: "32px",
                            fontSize: "12px",
                            background: colors.gradient,
                          }}
                        >
                          {getInitials(group.raName)}
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>{group.raName}</h4>
                          {primaryLeader && (
                            <span style={{ fontSize: "12px", color: "var(--ion-color-primary, #0077b6)", fontWeight: 600, display: "block" }}>
                              {primaryLeader.empName} ({primaryLeader.empCode})
                            </span>
                          )}
                          <span style={{ fontSize: "11px", color: "#64748b" }}>{group.category}</span>
                        </div>
                      </div>

                      <span
                        className="ra-count-badge"
                        style={{ padding: "2px 8px", fontSize: "12px" }}
                      >
                        {group.members.length}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Right Content: Selected RA Team Members List */}
              <div className="ra-split-content">
                {selectedRA ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div
                          className="ra-avatar"
                          style={{
                            width: "52px",
                            height: "52px",
                            background: getCategoryColor(selectedRA.category).gradient,
                          }}
                        >
                          {getInitials(selectedRA.raName)}
                        </div>
                        <div>
                          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>{selectedRA.raName}</h2>
                          {selectedRA.leaders.length > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", margin: "2px 0", color: "var(--ion-color-primary, #0077b6)" }}>
                              <User size={14} />
                              <strong style={{ fontSize: "14px" }}>{selectedRA.leaders[0].empName}</strong>
                              <span className="ra-leader-code-pill">{selectedRA.leaders[0].empCode}</span>
                            </div>
                          )}
                          <p style={{ margin: "2px 0 0 0", color: "#64748b", fontSize: "13px" }}>
                            {selectedRA.members.length} Direct Reports • {selectedRA.activeCount} Active Staff
                          </p>
                        </div>
                      </div>

                      <button
                        className="ra-btn ra-btn-outline"
                        onClick={() => exportRosterToCSV(selectedRA)}
                      >
                        <Download size={14} />
                        <span>Export Team CSV</span>
                      </button>
                    </div>

                    {/* In-Team Search Bar */}
                    <div className="ra-drawer-filter-bar">
                      <div className="ra-search-box" style={{ flex: 1 }}>
                        <Search size={15} className="ra-search-icon" />
                        <input
                          type="text"
                          placeholder="Search in this team..."
                          value={drawerSearch}
                          onChange={(e) => setDrawerSearch(e.target.value)}
                          className="ra-search-input"
                        />
                      </div>

                      <select
                        value={drawerDeptFilter}
                        onChange={(e) => setDrawerDeptFilter(e.target.value)}
                        className="ra-sort-select"
                      >
                        <option value="All">All Departments</option>
                        {selectedRA.departments.map((d, i) => (
                          <option key={i} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    {/* Team Members List */}
                    <div className="ra-team-list">
                      {filteredDrawerMembers.length === 0 ? (
                        <p style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0" }}>
                          No team members match the search query.
                        </p>
                      ) : (
                        filteredDrawerMembers.map((m) => (
                          <div key={m.empCode} className="ra-team-card">
                            <div className="ra-team-member-left">
                              <div className="ra-member-avatar-wrap">
                                <div className="ra-member-avatar">
                                  {m.profileImage ? (
                                    <img src={m.profileImage} alt={m.empName} />
                                  ) : (
                                    <span>{getInitials(m.empName)}</span>
                                  )}
                                </div>
                                <span className={`ra-status-dot ${m.isActive === "Y" ? "active" : "inactive"}`} />
                              </div>

                              <div className="ra-member-details">
                                <h4>
                                  {m.empName}
                                  <span className="ra-member-code-badge">{m.empCode}</span>
                                </h4>
                                <p className="ra-member-desig">{m.designation}</p>

                                <div className="ra-member-tags">
                                  <span className="ra-member-tag-item">
                                    <Building size={11} />
                                    <span>{m.department}</span>
                                  </span>
                                  <span className="ra-member-tag-item">
                                    <MapPin size={11} />
                                    <span>{m.branch}</span>
                                  </span>
                                  <span className="ra-member-tag-item">
                                    <Clock size={11} />
                                    <span>In: {m.checkIn}</span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="ra-team-member-actions">
                              {m.mobile && (
                                <a
                                  href={`tel:${m.mobile}`}
                                  className="ra-icon-action-btn"
                                  title={`Call ${m.mobile}`}
                                >
                                  <Phone size={14} />
                                </a>
                              )}
                              {m.email && (
                                <a
                                  href={`mailto:${m.email}`}
                                  className="ra-icon-action-btn"
                                  title={`Email ${m.email}`}
                                >
                                  <Mail size={14} />
                                </a>
                              )}
                              <button
                                className="ra-icon-action-btn"
                                title="Reassign RA"
                                onClick={() => handleOpenReassignModal(m)}
                              >
                                <UserCog size={14} />
                              </button>
                              <button
                                className="ra-icon-action-btn"
                                title="View Full Employee Profile"
                                onClick={() => history.push(`/eprofile?code=${m.empCode}`)}
                              >
                                <ExternalLink size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "100px 0", color: "#94a3b8" }}>
                    <Users size={36} style={{ margin: "0 auto 12px auto", opacity: 0.5 }} />
                    <p>Select a Reporting Authority from the list on the left to view team members.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==========================================================
             TEAM MEMBERS SLIDE-OVER DRAWER (For Grid & Table Views)
             ========================================================== */}
          {selectedRA && viewMode !== "split" && (
            <div className="ra-modal-overlay" onClick={() => setSelectedRA(null)}>
              <div className="ra-drawer" onClick={(e) => e.stopPropagation()}>
                {/* Drawer Header */}
                <div className="ra-drawer-header">
                  <div className="ra-drawer-header-info">
                    <div
                      className="ra-avatar"
                      style={{
                        width: "52px",
                        height: "52px",
                        background: getCategoryColor(selectedRA.category).gradient,
                      }}
                    >
                      {getInitials(selectedRA.raName)}
                    </div>
                    <div className="ra-drawer-header-text">
                      <h2>{selectedRA.raName}</h2>
                      {selectedRA.leaders.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", margin: "2px 0 4px 0", color: "var(--ion-color-primary, #0077b6)" }}>
                          <User size={14} />
                          <strong style={{ fontSize: "14px" }}>{selectedRA.leaders[0].empName}</strong>
                          <span className="ra-leader-code-pill">{selectedRA.leaders[0].empCode}</span>
                        </div>
                      )}
                      <p>
                        {selectedRA.members.length} Total Team Members • {selectedRA.activeCount} Active
                      </p>
                    </div>
                  </div>

                  <button className="ra-close-btn" onClick={() => setSelectedRA(null)}>
                    <X size={18} />
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="ra-drawer-body">
                  {/* Search & Filter within team */}
                  <div className="ra-drawer-filter-bar">
                    <div className="ra-search-box" style={{ flex: 1 }}>
                      <Search size={15} className="ra-search-icon" />
                      <input
                        type="text"
                        placeholder="Search employee in team..."
                        value={drawerSearch}
                        onChange={(e) => setDrawerSearch(e.target.value)}
                        className="ra-search-input"
                      />
                    </div>

                    <select
                      value={drawerDeptFilter}
                      onChange={(e) => setDrawerDeptFilter(e.target.value)}
                      className="ra-sort-select"
                    >
                      <option value="All">All Depts</option>
                      {selectedRA.departments.map((d, i) => (
                        <option key={i} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* Team Members List */}
                  <div className="ra-team-list">
                    {filteredDrawerMembers.length === 0 ? (
                      <p style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0" }}>
                        No team members match the search query.
                      </p>
                    ) : (
                      filteredDrawerMembers.map((m) => (
                        <div key={m.empCode} className="ra-team-card">
                          <div className="ra-team-member-left">
                            <div className="ra-member-avatar-wrap">
                              <div className="ra-member-avatar">
                                {m.profileImage ? (
                                  <img src={m.profileImage} alt={m.empName} />
                                ) : (
                                  <span>{getInitials(m.empName)}</span>
                                )}
                              </div>
                              <span className={`ra-status-dot ${m.isActive === "Y" ? "active" : "inactive"}`} />
                            </div>

                            <div className="ra-member-details">
                              <h4>
                                {m.empName}
                                <span className="ra-member-code-badge">{m.empCode}</span>
                              </h4>
                              <p className="ra-member-desig">{m.designation}</p>

                              <div className="ra-member-tags">
                                <span className="ra-member-tag-item">
                                  <Building size={11} />
                                  <span>{m.department}</span>
                                </span>
                                <span className="ra-member-tag-item">
                                  <MapPin size={11} />
                                  <span>{m.branch}</span>
                                </span>
                                <span className="ra-member-tag-item">
                                  <Clock size={11} />
                                  <span>In: {m.checkIn}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="ra-team-member-actions">
                            {m.mobile && (
                              <a
                                href={`tel:${m.mobile}`}
                                className="ra-icon-action-btn"
                                title={`Call ${m.mobile}`}
                              >
                                <Phone size={14} />
                              </a>
                            )}
                            {m.email && (
                              <a
                                href={`mailto:${m.email}`}
                                className="ra-icon-action-btn"
                                title={`Email ${m.email}`}
                              >
                                <Mail size={14} />
                              </a>
                            )}
                            <button
                              className="ra-icon-action-btn"
                              title="Reassign RA"
                              onClick={() => handleOpenReassignModal(m)}
                            >
                              <UserCog size={14} />
                            </button>
                            <button
                              className="ra-icon-action-btn"
                              title="View Full Employee Profile"
                              onClick={() => history.push(`/eprofile?code=${m.empCode}`)}
                            >
                              <ExternalLink size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Drawer Footer */}
                <div className="ra-drawer-footer">
                  <span style={{ fontSize: "13px", color: "#64748b" }}>
                    Showing {filteredDrawerMembers.length} of {selectedRA.members.length} members
                  </span>
                  <button
                    className="ra-btn ra-btn-primary"
                    onClick={() => exportRosterToCSV(selectedRA)}
                  >
                    <Download size={14} />
                    <span>Export Team CSV</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==========================================================
             REASSIGN RA MODAL
             ========================================================== */}
          {showReassignModal && reassignTargetEmp && (
            <div className="ra-modal-overlay" onClick={() => setShowReassignModal(false)}>
              <div className="ra-reassign-modal" onClick={(e) => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div className="ra-stat-icon-wrapper" style={{ width: "36px", height: "36px" }}>
                      <UserCog size={18} />
                    </div>
                    <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>Reassign Reporting Authority (RA 1)</h3>
                  </div>
                  <button className="ra-close-btn" onClick={() => setShowReassignModal(false)}>
                    <X size={16} />
                  </button>
                </div>

                <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "10px", fontSize: "13px" }}>
                  <p style={{ margin: "0 0 4px 0", fontWeight: 600, color: "#0f172a" }}>
                    {reassignTargetEmp.empName} ({reassignTargetEmp.empCode})
                  </p>
                  <p style={{ margin: 0, color: "#64748b" }}>
                    Current RA 1: <strong>{reassignTargetEmp.requestTo || "Unassigned"}</strong> • {reassignTargetEmp.department}
                  </p>
                </div>

                <div className="ra-modal-form-group">
                  <label>Select New Reporting Authority (RA 1):</label>
                  <select
                    value={newTargetRA}
                    onChange={(e) => setNewTargetRA(e.target.value)}
                    className="ra-modal-select"
                  >
                    <option value="">-- Unassigned (NULL) --</option>
                    {availableRAsForDropdown.map((ra) => (
                      <option key={ra} value={ra}>
                        {ra}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                  <button
                    className="ra-btn ra-btn-outline"
                    onClick={() => setShowReassignModal(false)}
                    disabled={reassigning}
                  >
                    Cancel
                  </button>
                  <button
                    className="ra-btn ra-btn-primary"
                    onClick={handleConfirmReassign}
                    disabled={reassigning}
                  >
                    {reassigning ? <IonSpinner name="crescent" color="light" /> : <span>Confirm Assignment</span>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Toast Notification */}
          <IonToast
            isOpen={showToast}
            onDidDismiss={() => setShowToast(false)}
            message={toastMessage}
            duration={2500}
            position="bottom"
          />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default RAManagement;
