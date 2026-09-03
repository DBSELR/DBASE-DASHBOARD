import React, { useState, useRef, useEffect, useMemo } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../../config";
import {
  IonToast,
  IonIcon,
  IonPage,
  IonContent,
} from "@ionic/react";

import {
  calendarOutline,
  peopleOutline,
  businessOutline,
  saveOutline,
  timeOutline,
  personCircleOutline,
  shieldCheckmarkOutline,
  refreshOutline,
} from "ionicons/icons";
import { createPortal } from "react-dom";
import { Search, X, Check, ChevronLeft, Calendar, Shield, Users, User, Clock, FileText } from "lucide-react";
import moment from "moment";
import { apiService } from "../../utils/apiService";

import "./MeetingMaster.css";

// Standard Master RA Roles & Leaders lookup
const RA_LEADER_ROLES_MAP: Record<string, string> = {
  "1501": "Director",
  "1524": "Team. Manager",
  "1520": "Team Leader-UNICODE",
  "1532": "Team Leader-AU",
  "1513": "Tech. Manager (Onsite)",
  "1539": "Team Leader-BEAT",
  "1633": "Business Manager",
  "1531": "Network Administrator",
  "1616": "Digital Marketing Manager",
  "1543": "Team Leader-AKU",
  "1596": "PRODUCT MANAGER ICAMPUS",
  "1509": "Tech. Manager",
  "1542": "Team Leader-AUSDE",
  "1547": "Team Leader-BOAT",
  "1615": "Head Administration",
  "1601": "HR",
  "1538": "HR",
};

// Direct mapping from RA Role to Designated Leader EmpCode
const RA_ROLE_TO_LEADER_CODE: Record<string, string> = {
  "director": "1501",
  "team. manager": "1524",
  "team manager": "1524",
  "team leader-unicode": "1520",
  "team leader-au": "1532",
  "tech. manager (onsite)": "1513",
  "tech. manager(onsite)": "1513",
  "team leader-beat": "1539",
  "business manager": "1633",
  "network administrator": "1531",
  "admin": "1531",
  "digital marketing manager": "1616",
  "team leader-aku": "1543",
  "product manager icampus": "1596",
  "tech. manager": "1509",
  "team leader-ausde": "1542",
  "team leader-boat": "1547",
  "head administration": "1615",
  "hr": "1601",
};

const DEFAULT_RA_ROLES = [
  "Director",
  "Team. Manager",
  "Team Leader-UNICODE",
  "Team Leader-AU",
  "Tech. Manager (Onsite)",
  "Team Leader-BEAT",
  "Business Manager",
  "Network Administrator",
  "Digital Marketing Manager",
  "Team Leader-AKU",
  "PRODUCT MANAGER ICAMPUS",
  "Tech. Manager",
  "Team Leader-AUSDE",
  "Team Leader-BOAT",
  "Head Administration",
  "ADMIN",
  "HR"
];

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

  const [raList, setRaList] = useState<string[]>(DEFAULT_RA_ROLES);
  const [raMembersMap, setRaMembersMap] = useState<Record<string, string[]>>({});
  const [raLeadersInfo, setRaLeadersInfo] = useState<Record<string, { code: string; name: string }>>({});

  const initialForm = {
    year: String(currentYear),
    month: months[new Date().getMonth()],
    meetingDate: moment().format("YYYY-MM-DD"),
    weekName: "",
    meetingType: "",
    participants: [] as string[],
    frequencyType: "Every Day",
    projectName: "", // Stores selected RA name for backend compatibility
    raName: "",      // Selected Reporting Authority
    meetingOwner: [] as string[],
    meetingStatus: "Pending",
    remarks: "",
    createdBy: "Admin",
    teamsOrganizerEmail: "PSivaPrasaddbs@DBASESOLUTIONSPVTLTD.onmicrosoft.com",
    meetingStartTime: "09:30",
    meetingEndTime: "10:00",
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

  const [isRADropdownOpen, setIsRADropdownOpen] = useState(false);
  const [raSearchTerm, setRaSearchTerm] = useState("");
  const [raDropdownPos, setRaDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const raTriggerRef = useRef<HTMLDivElement>(null);

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
  const openDropdown = (type: 'year' | 'month' | 'freq' | 'ra' | 'date' | 'part' | 'owner') => {
    setIsYearDropdownOpen(type === 'year' ? !isYearDropdownOpen : false);
    setIsMonthDropdownOpen(type === 'month' ? !isMonthDropdownOpen : false);
    setIsFreqDropdownOpen(type === 'freq' ? !isFreqDropdownOpen : false);
    setIsRADropdownOpen(type === 'ra' ? !isRADropdownOpen : false);
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

  const changeCalMonth = (delta: number) => {
    setCalViewDate(prev => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  };

  const selectCalDate = (day: number) => {
    const y = calViewDate.getFullYear();
    const m = calViewDate.getMonth();
    const dateStr = moment(new Date(y, m, day)).format("YYYY-MM-DD");
    const mName = months[m];

    setForm(prev => ({
      ...prev,
      meetingDate: dateStr,
      year: String(y),
      month: mName
    }));
    setIsDateDropdownOpen(false);
  };

  const selectQuickDate = (offsetDays: number) => {
    const target = moment().add(offsetDays, 'days');
    const dateStr = target.format("YYYY-MM-DD");
    const y = target.year();
    const mName = months[target.month()];

    setForm(prev => ({
      ...prev,
      meetingDate: dateStr,
      year: String(y),
      month: mName
    }));
    setIsDateDropdownOpen(false);
  };

  // Dynamic portal positioning
  useEffect(() => {
    const calcPos = (ref: React.RefObject<HTMLDivElement>, minWidth: number = 0) => {
      if (!ref.current) return { top: 0, left: 0, width: 0 };
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 320;
      let top = rect.bottom + 4;
      if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
        top = rect.top - dropdownHeight - 4;
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
      if (isRADropdownOpen) setRaDropdownPos(calcPos(raTriggerRef, 300));
      if (isDateDropdownOpen) setDateDropdownPos(calcPos(dateTriggerRef, 310));
      if (isPartDropdownOpen) setPartDropdownPos(calcPos(partTriggerRef, 340));
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
    isRADropdownOpen,
    isDateDropdownOpen,
    isPartDropdownOpen,
    isOwnerDropdownOpen
  ]);

  // Load Employees and Resolve RA Hierarchy with Default Selection
  useEffect(() => {
    const loadAllData = async () => {
      try {
        // 1. Fetch raw employees list
        let rawEmployees: any[] = [];
        try {
          const response = await axios.get(`${API_BASE}Employee/Load_Employees`);
          if (response.data && Array.isArray(response.data)) {
            rawEmployees = response.data.filter((emp: any) => emp[0] !== "0" && emp[1] !== "All Employees");
            setEmployees(rawEmployees);
          }
        } catch (err) {
          console.error("Failed to load employees", err);
        }

        // 2. Fetch master RA list
        let masterRAs: string[] = DEFAULT_RA_ROLES;
        try {
          const rasRes = await apiService.loadRAS();
          if (Array.isArray(rasRes) && rasRes.length > 0) {
            const list = rasRes
              .map((r: any) => (typeof r === "string" ? r : r.name || r.Name || r.designation || "").trim())
              .filter(Boolean);
            if (list.length > 0) {
              masterRAs = Array.from(new Set([...DEFAULT_RA_ROLES, ...list]));
            }
          }
        } catch (err) {
          console.warn("loadRAS warning:", err);
        }
        setRaList(masterRAs);

        // 3. Resolve RA Members Matrix from Cache or Parallel fetch
        const membersMap: Record<string, string[]> = {};
        const leadersMap: Record<string, { code: string; name: string }> = {};

        // Seed leader defaults
        Object.entries(RA_LEADER_ROLES_MAP).forEach(([code, role]) => {
          const rKey = role.toLowerCase();
          leadersMap[rKey] = { code, name: code };
        });

        // Try reading cached RA matrix
        let cachedRows: any[] = [];
        try {
          const cached = localStorage.getItem("dbase_ra_matrix_cache_v3") || localStorage.getItem("dbase_ra_matrix_cache_v2");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              cachedRows = parsed;
            }
          }
        } catch (e) {
          console.warn("Cache parse error:", e);
        }

        // If no cache, build from raw employees
        if (cachedRows.length === 0 && rawEmployees.length > 0) {
          cachedRows = await Promise.all(
            rawEmployees.map(async (row: any) => {
              const code = String(row[0] || "").trim();
              const name = String(row[1] || "").trim();
              let reqTo = "";
              try {
                const empData = await apiService.getEmployee(code);
                const r = Array.isArray(empData) ? empData[0] : empData?.data?.[0] || empData;
                if (Array.isArray(r)) reqTo = String(r[15] || "").trim();
                else if (typeof r === "object" && r !== null) reqTo = String(r.RequestTo || r._RequestTo || r.RA1 || "").trim();
              } catch {}
              return { empCode: code, empName: name, requestTo: reqTo };
            })
          );
        }

        // Populate membersMap
        cachedRows.forEach((emp: any) => {
          const code = String(emp.empCode || emp.EmpCode || "").trim();
          const reqTo = String(emp.requestTo || emp.RequestTo || "").trim();
          if (!code || !reqTo || reqTo === "NULL" || reqTo === "null" || reqTo === "undefined") return;

          const rKey = reqTo.toLowerCase();
          if (!membersMap[rKey]) membersMap[rKey] = [];
          if (!membersMap[rKey].includes(code)) {
            membersMap[rKey].push(code);
          }
        });

        setRaMembersMap(membersMap);
        setRaLeadersInfo(leadersMap);

        // 4. Determine Logged-In User's Default RA
        let defaultRA = "";
        try {
          const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
          const myCode = String(currentUser.empCode || currentUser.EmpCode || "").trim();
          const myDesig = String(currentUser.designation || currentUser.Designation || "").trim();

          // A. Check if user's EmpCode is a designated RA lead
          if (myCode && RA_LEADER_ROLES_MAP[myCode]) {
            defaultRA = RA_LEADER_ROLES_MAP[myCode];
          }

          // B. Check if user's designation matches an RA role
          if (!defaultRA && myDesig) {
            const found = masterRAs.find((r) => r.toLowerCase() === myDesig.toLowerCase());
            if (found) defaultRA = found;
          }

          // C. Fallback default to Team Leader-UNICODE or first in list
          if (!defaultRA) {
            defaultRA = masterRAs.find((r) => r.toLowerCase().includes("unicode")) || masterRAs[0] || "Team Leader-UNICODE";
          }

          // Automatically select the default RA's team members and designated owner
          const rKey = defaultRA.toLowerCase().trim();
          const team = membersMap[rKey] || [];
          let leaderCode = RA_ROLE_TO_LEADER_CODE[rKey] || "";
          if (!leaderCode && myCode && RA_LEADER_ROLES_MAP[myCode]?.toLowerCase() === rKey) {
            leaderCode = myCode;
          }
          const defaultOwner = leaderCode ? [leaderCode] : (myCode ? [myCode] : []);

          setForm((prev) => ({
            ...prev,
            raName: defaultRA,
            projectName: defaultRA,
            participants: team.length > 0 ? team : prev.participants,
            meetingOwner: defaultOwner.length > 0 ? defaultOwner : prev.meetingOwner,
          }));
        } catch (e) {
          console.warn("Default RA assignment catch:", e);
        }
      } catch (globalErr) {
        console.error("MeetingMaster data load error:", globalErr);
      }
    };

    loadAllData();
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
    return `${name} (${empId})`;
  };

  // Handle Changing RA from Dropdown (Auto-preselects that RA's team members & designated owner!)
  const handleSelectRA = (selectedRole: string) => {
    const rKey = selectedRole.toLowerCase().trim();
    const teamMembers = raMembersMap[rKey] || [];

    // Automatically resolve designated leader/owner for this selected RA
    let leaderCode = RA_ROLE_TO_LEADER_CODE[rKey] || "";
    if (!leaderCode && raLeadersInfo[rKey]) {
      leaderCode = raLeadersInfo[rKey].code;
    }
    if (!leaderCode) {
      const matchEmp = employees.find((e) => {
        const desig = String(e[3] || "").toLowerCase().trim();
        return desig === rKey;
      });
      if (matchEmp) leaderCode = String(matchEmp[0]);
    }

    const owners = leaderCode ? [leaderCode] : [];

    setForm((prev) => ({
      ...prev,
      raName: selectedRole,
      projectName: selectedRole, // Preserves backend compatibility
      participants: teamMembers,  // By default, select all team members of this RA!
      meetingOwner: owners.length > 0 ? owners : prev.meetingOwner, // Auto-change Meeting Organizer / Owner!
    }));
    setIsRADropdownOpen(false);
    setRaSearchTerm("");

    const ownerName = leaderCode ? getEmpDisplayName(leaderCode) : "Designated Lead";
    showToast(`Selected "${selectedRole}" — Owner set to ${ownerName} & ${teamMembers.length} team members pre-selected.`, "primary");
  };

  // Split employees into (1) Current RA's Team Members and (2) Other Remaining Employees
  const currentRATeamCodes = useMemo(() => {
    if (!form.raName) return new Set<string>();
    const list = raMembersMap[form.raName.toLowerCase()] || [];
    return new Set(list.map(String));
  }, [form.raName, raMembersMap]);

  const { teamEmployees, otherEmployees } = useMemo(() => {
    const team: any[] = [];
    const others: any[] = [];

    employees.forEach((emp) => {
      const id = String(emp[0]);
      if (currentRATeamCodes.has(id)) {
        team.push(emp);
      } else {
        others.push(emp);
      }
    });

    return { teamEmployees: team, otherEmployees: others };
  }, [employees, currentRATeamCodes]);

  // Filtered Participants by Search Term
  const filterByTerm = (list: any[]) => {
    if (!partSearchTerm.trim()) return list;
    const term = partSearchTerm.toLowerCase().trim();
    return list.filter((emp) => {
      const id = String(emp[0]).toLowerCase();
      let name = String(emp[1] || "").toLowerCase();
      if (name.startsWith(id + "-")) {
        name = name.replace(id + "-", "").trim();
      }
      return name.includes(term) || id.includes(term);
    });
  };

  const filteredTeamParticipants = useMemo(() => filterByTerm(teamEmployees), [teamEmployees, partSearchTerm]);
  const filteredOtherParticipants = useMemo(() => filterByTerm(otherEmployees), [otherEmployees, partSearchTerm]);

  // Multi-select Handlers for Participants
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

  const selectOnlyTeamParticipants = () => {
    const teamIds = teamEmployees.map(e => String(e[0]));
    setForm(prev => {
      const current = new Set(prev.participants.map(String));
      teamIds.forEach(id => current.add(id));
      return { ...prev, participants: Array.from(current) };
    });
  };

  const selectAllParticipants = () => {
    const ids = employees.map(e => String(e[0]));
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

  // Reset Form
  const resetForm = () => {
    const rKey = (form.raName || "").toLowerCase().trim();
    const defaultTeam = form.raName ? (raMembersMap[rKey] || []) : [];
    const leaderCode = RA_ROLE_TO_LEADER_CODE[rKey] || "";
    setForm({
      ...initialForm,
      raName: form.raName,
      projectName: form.raName,
      participants: defaultTeam,
      meetingOwner: leaderCode ? [leaderCode] : [],
    });
    showToast("Form reset to defaults", "primary");
  };

  // Save Meeting Handler
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

      if (!form.raName && !form.projectName) {
        showToast("Please Select Reporting Authority (RA)", "warning");
        return;
      }

      if (
        form.frequencyType !== "Every Day" &&
        !form.meetingDate
      ) {
        showToast("Please Select Meeting Date", "warning");
        return;
      }

      if (form.participants.length === 0) {
        showToast("Please Select At Least One Participant", "warning");
        return;
      }

      const baseDate = form.meetingDate || new Date().toISOString().split("T")[0];
      const payload = {
        ...form,
        projectName: form.raName || form.projectName, // Keeps backend compatibility
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
          ? "Meeting scheduled! Teams meeting created with all participants."
          : resMessage || "Meeting Saved Successfully",
        teamsUrl ? "success" : "warning"
      );

      resetForm();

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
      <IonContent className="page-content" style={{ "--background": "var(--app-bg, #f8fafc)" }}>
        <div className="mm-page-wrapper">
          
          {/* ── Page Header ── */}
          <div className="page-wr-header" style={{ borderRadius: '16px', padding: '16px', marginBottom: '4px' }}>
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()} title="Go Back">
                <ChevronLeft size={22} color="white" />
              </button>
              <div>
                <h1 className="page-wr-title">Meeting Master</h1>
                <p className="page-wr-subtitle">Configure schedules, teams & attendee lists by Reporting Authority (RA)</p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <div className="page-wr-header-icon-box">
                <Calendar size={26} color="var(--ion-color-primary)" />
              </div>
            </div>
          </div>

          {/* ── SECTION 1: Authority & Meeting Classification ── */}
          <div className="mm-section-card">
            <div className="mm-section-header">
              <div className="mm-section-icon">
                <Shield size={16} />
              </div>
              <div>
                <h3>Meeting Authority & Title</h3>
                <p>Assign reporting authority team and specify meeting topic</p>
              </div>
            </div>

            <div className="mm-grid-2">
              {/* REPORTING AUTHORITY (RA) */}
              <div className="mm-field">
                <div className="mm-field-top">
                  <span className="mm-label">Reporting Authority (RA)</span>
                  {form.raName && (
                    <span className="mm-badge-tag">
                      {raMembersMap[form.raName.toLowerCase()]?.length || 0} Direct Members
                    </span>
                  )}
                </div>
                <div
                  ref={raTriggerRef}
                  className={`mm-select-trigger ${isRADropdownOpen ? 'active' : ''}`}
                  onClick={() => openDropdown('ra')}
                >
                  <span className={`mm-select-text ${!form.raName ? 'placeholder' : ''}`}>
                    {form.raName ? form.raName : "Select Reporting Authority"}
                  </span>
                  <IonIcon icon={shieldCheckmarkOutline} className="mm-select-icon" />
                </div>
              </div>

              {/* MEETING TYPE / TITLE */}
              <div className="mm-field">
                <div className="mm-field-top">
                  <span className="mm-label">Meeting Type / Subject</span>
                </div>
                <input
                  type="text"
                  name="meetingType"
                  placeholder="e.g. Daily Standup, Sprint Review, Project Sync"
                  value={form.meetingType}
                  onChange={handleChange}
                  className="mm-input"
                />
              </div>
            </div>
          </div>

          {/* ── SECTION 2: Date & Recurrence Schedule ── */}
          <div className="mm-section-card">
            <div className="mm-section-header">
              <div className="mm-section-icon">
                <Clock size={16} />
              </div>
              <div>
                <h3>Schedule & Recurrence</h3>
                <p>Define frequency, date calendar, and meeting time duration</p>
              </div>
            </div>

            <div className="mm-grid-4">
              {/* FREQUENCY */}
              <div className="mm-field">
                <div className="mm-field-top">
                  <span className="mm-label">Frequency</span>
                </div>
                <div
                  ref={freqTriggerRef}
                  className={`mm-select-trigger ${isFreqDropdownOpen ? 'active' : ''}`}
                  onClick={() => openDropdown('freq')}
                >
                  <span className={`mm-select-text ${!form.frequencyType ? 'placeholder' : ''}`}>
                    {form.frequencyType ? form.frequencyType : "Select Frequency"}
                  </span>
                  <IonIcon icon={timeOutline} className="mm-select-icon" />
                </div>
              </div>

              {/* MEETING DATE */}
              <div className="mm-field">
                <div className="mm-field-top">
                  <span className="mm-label">Meeting Date</span>
                  {form.frequencyType === "Every Day" && (
                    <span className="mm-badge-tag">Daily Recurring</span>
                  )}
                </div>
                <div
                  ref={dateTriggerRef}
                  className={`mm-select-trigger ${isDateDropdownOpen ? 'active' : ''}`}
                  onClick={() => openDropdown('date')}
                  style={{ opacity: form.frequencyType === "Every Day" ? 0.7 : 1 }}
                >
                  <span className={`mm-select-text ${!form.meetingDate ? 'placeholder' : ''}`}>
                    {form.meetingDate ? moment(form.meetingDate).format("DD-MM-YYYY (ddd)") : "Pick Meeting Date"}
                  </span>
                  <IonIcon icon={calendarOutline} className="mm-select-icon" />
                </div>
              </div>

              {/* START TIME */}
              <div className="mm-field">
                <div className="mm-field-top">
                  <span className="mm-label">Start Time</span>
                </div>
                <input
                  type="time"
                  name="meetingStartTime"
                  value={form.meetingStartTime}
                  onChange={handleChange}
                  className="mm-input"
                />
              </div>
              
              {/* END TIME */}
              <div className="mm-field">
                <div className="mm-field-top">
                  <span className="mm-label">End Time</span>
                </div>
                <input
                  type="time"
                  name="meetingEndTime"
                  value={form.meetingEndTime}
                  onChange={handleChange}
                  className="mm-input"
                />
              </div>
            </div>

            {/* Sub-row: Year & Month */}
            <div className="mm-grid-2" style={{ marginTop: '16px' }}>
              {/* YEAR */}
              <div className="mm-field">
                <div className="mm-field-top">
                  <span className="mm-label">Fiscal Year</span>
                </div>
                <div
                  ref={yearTriggerRef}
                  className={`mm-select-trigger ${isYearDropdownOpen ? 'active' : ''}`}
                  onClick={() => openDropdown('year')}
                >
                  <span className={`mm-select-text ${!form.year ? 'placeholder' : ''}`}>
                    {form.year ? form.year : "Select Year"}
                  </span>
                  <IonIcon icon={calendarOutline} className="mm-select-icon" />
                </div>
              </div>

              {/* MONTH */}
              <div className="mm-field">
                <div className="mm-field-top">
                  <span className="mm-label">Month</span>
                </div>
                <div
                  ref={monthTriggerRef}
                  className={`mm-select-trigger ${isMonthDropdownOpen ? 'active' : ''}`}
                  onClick={() => openDropdown('month')}
                >
                  <span className={`mm-select-text ${!form.month ? 'placeholder' : ''}`}>
                    {form.month ? form.month : "Select Month"}
                  </span>
                  <IonIcon icon={calendarOutline} className="mm-select-icon" />
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 3: Attendees & Leadership ── */}
          <div className="mm-section-card">
            <div className="mm-section-header">
              <div className="mm-section-icon">
                <Users size={16} />
              </div>
              <div>
                <h3>Participants & Organizers</h3>
                <p>Pre-selected team members of {form.raName || "selected RA"} with option to add organization staff</p>
              </div>
            </div>

            <div className="mm-grid-2">
              {/* PARTICIPANTS SELECTOR & CHIPS */}
              <div className="mm-field">
                <div className="mm-field-top">
                  <span className="mm-label">Participants List</span>
                  <span className="mm-badge-tag">
                    {form.participants.length} Selected
                  </span>
                </div>

                <div
                  ref={partTriggerRef}
                  className={`mm-select-trigger ${isPartDropdownOpen ? 'active' : ''}`}
                  onClick={() => openDropdown('part')}
                >
                  <span className="mm-select-text">
                    {form.participants.length > 0 ? `${form.participants.length} Participant(s) Selected` : "Select Participants"}
                  </span>
                  <IonIcon icon={peopleOutline} className="mm-select-icon" />
                </div>

                {/* Selected Participant Chips */}
                {form.participants.length > 0 && (
                  <div className="mm-chips-wrap">
                    {form.participants.map(empId => (
                      <span key={empId} className="mm-chip">
                        <span className="mm-chip-name">{getEmpDisplayName(empId)}</span>
                        <button
                          type="button"
                          className="mm-chip-del"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeParticipant(empId);
                          }}
                          title="Remove"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* MEETING OWNER SELECTOR & CHIPS */}
              <div className="mm-field">
                <div className="mm-field-top">
                  <span className="mm-label">Meeting Organizer / Owner</span>
                  <span className="mm-badge-tag">
                    {form.meetingOwner.length} Designated Lead
                  </span>
                </div>

                <div
                  ref={ownerTriggerRef}
                  className={`mm-select-trigger ${isOwnerDropdownOpen ? 'active' : ''}`}
                  onClick={() => openDropdown('owner')}
                >
                  <span className="mm-select-text">
                    {form.meetingOwner.length > 0 ? `${form.meetingOwner.length} Owner(s) Selected` : "Select Meeting Owner"}
                  </span>
                  <IonIcon icon={personCircleOutline} className="mm-select-icon" />
                </div>

                {/* Selected Owner Chips */}
                {form.meetingOwner.length > 0 && (
                  <div className="mm-chips-wrap">
                    {form.meetingOwner.map(empId => (
                      <span key={empId} className="mm-chip" style={{ borderColor: "#cbd5e1", background: "#f8fafc" }}>
                        <span className="mm-chip-name">{getEmpDisplayName(empId)}</span>
                        <button
                          type="button"
                          className="mm-chip-del"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeOwner(empId);
                          }}
                          title="Remove"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── SECTION 4: Meeting Agenda & Remarks ── */}
          <div className="mm-section-card">
            <div className="mm-section-header">
              <div className="mm-section-icon">
                <FileText size={16} />
              </div>
              <div>
                <h3>Meeting Agenda & Notes</h3>
                <p>Specify discussion topics, key deliverables, or Teams meeting instructions</p>
              </div>
            </div>

            <div className="mm-field">
              <textarea
                name="remarks"
                placeholder="Write meeting agenda, discussion topics, deliverables, or special instructions..."
                value={form.remarks}
                onChange={handleChange}
                className="mm-textarea"
                rows={3}
              />
            </div>
          </div>

          {/* ── Footer Actions ── */}
          <div className="mm-footer">
            <button
              type="button"
              className="mm-reset-btn"
              onClick={resetForm}
            >
              <IonIcon icon={refreshOutline} />
              <span>Reset</span>
            </button>
            <button
              type="button"
              className="mm-submit-btn"
              onClick={saveMeeting}
            >
              <IonIcon icon={saveOutline} />
              <span>Save & Schedule Meeting</span>
            </button>
          </div>
        </div>
      </IonContent>

      <IonToast
        isOpen={toast.open}
        message={toast.message}
        color={toast.color}
        duration={3000}
        onDidDismiss={() => setToast({ ...toast, open: false })}
        position="bottom"
      />

      {/* ══════════════════════════════════════════════════════════════════════════
          PORTAL DROPDOWNS
          ══════════════════════════════════════════════════════════════════════════ */}

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
                  const isSelected = String(form.year) === String(y);
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
                        <span className="dr-name">{y}</span>
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

      {/* ── Reporting Authority (RA) Dropdown Portal (Replacing Project) ── */}
      {isRADropdownOpen && createPortal(
        <>
          <div
            className="dropdown-outside-click-layer"
            onClick={(e) => {
              e.stopPropagation();
              setIsRADropdownOpen(false);
            }}
          />
          <div
            className="custom-inline-dropdown"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${raDropdownPos.top}px`,
              left: `${raDropdownPos.left}px`,
              width: `${raDropdownPos.width}px`,
              zIndex: 99999
            }}
          >
            <div className="dropdown-search-sec">
              <Search size={16} className="dropdown-search-icon" />
              <input
                type="text"
                placeholder="Search Reporting Authority..."
                value={raSearchTerm}
                onChange={(e) => setRaSearchTerm(e.target.value)}
                autoFocus
                className="dropdown-pure-input"
              />
              {raSearchTerm && (
                <button
                  type="button"
                  className="dropdown-clear-btn"
                  onClick={() => setRaSearchTerm("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="dropdown-body">
              {raList
                .filter((r) => r.toLowerCase().includes(raSearchTerm.toLowerCase()))
                .map((r, index) => {
                  const isSelected = form.raName === r;
                  const memberCount = (raMembersMap[r.toLowerCase()]?.length) || 0;
                  const leader = raLeadersInfo[r.toLowerCase()];
                  const initials = r.slice(0, 2).toUpperCase();

                  return (
                    <div
                      key={index}
                      className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectRA(r)}
                    >
                      <div className={`dr-avatar grad-${index % 5}`}>
                        {initials}
                      </div>
                      <div className="dr-info">
                        <span className="dr-name">{r}</span>
                        <div className="dr-ra-subtitle">
                          <Users size={11} />
                          <span>{memberCount} Team Member{memberCount === 1 ? '' : 's'}</span>
                          {leader && <span style={{ color: "#0284c7" }}>• Lead: {leader.code}</span>}
                        </div>
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
              <div className="dropdown-cal-weekdays">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
                  <span key={i} className="dropdown-cal-weekday">{d}</span>
                ))}
              </div>

              <div className="dropdown-cal-days-grid">
                {/* Blank cells for start offset */}
                {Array.from({ length: getFirstDayOfMonth(calViewDate.getFullYear(), calViewDate.getMonth()) }).map((_, i) => (
                  <div key={`blank-${i}`} className="dropdown-cal-day-cell empty" />
                ))}

                {/* Days in month */}
                {Array.from({ length: getDaysInMonth(calViewDate.getFullYear(), calViewDate.getMonth()) }).map((_, i) => {
                  const day = i + 1;
                  const cellDateStr = moment(new Date(calViewDate.getFullYear(), calViewDate.getMonth(), day)).format("YYYY-MM-DD");
                  const isSelected = form.meetingDate === cellDateStr;
                  const isToday = moment().format("YYYY-MM-DD") === cellDateStr;

                  return (
                    <button
                      key={day}
                      type="button"
                      className={`dropdown-cal-day-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                      onClick={() => selectCalDate(day)}
                    >
                      {day}
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

      {/* ── Participants Multi-select Portal (RA Team + Remaining Employees) ── */}
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
                placeholder="Search participant name or ID..."
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
                {teamEmployees.length > 0 && (
                  <button
                    type="button"
                    className="dropdown-action-btn"
                    onClick={selectOnlyTeamParticipants}
                    title="Select all direct team members"
                  >
                    Select Team ({teamEmployees.length})
                  </button>
                )}
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

            <div className="dropdown-body" style={{ maxHeight: '340px' }}>
              {/* SECTION 1: Current RA Team Members (Pre-selected by default!) */}
              {filteredTeamParticipants.length > 0 && (
                <>
                  <div className="dropdown-section-header">
                    <span>👥 {form.raName || "Direct"} Team ({filteredTeamParticipants.length})</span>
                    <span className="dr-team-pill">Auto-Selected</span>
                  </div>
                  {filteredTeamParticipants.map((emp, index) => {
                    const empId = String(emp[0]);
                    let empName = String(emp[1] || "");
                    if (empName.startsWith(empId + "-")) {
                      empName = empName.replace(empId + "-", "").trim();
                    }
                    const isSelected = form.participants.some(id => String(id) === empId);
                    const initials = (empName.charAt(0) || "?").toUpperCase();

                    return (
                      <div
                        key={`team-${empId}`}
                        className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleParticipant(empId)}
                        style={{ background: isSelected ? "rgba(2, 132, 199, 0.06)" : undefined }}
                      >
                        <div className={`dr-avatar grad-${(parseInt(empId) || index) % 5}`}>
                          {initials}
                        </div>
                        <div className="dr-info">
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span className="dr-name">{empName}</span>
                            <span className="dr-team-pill">Team</span>
                          </div>
                          <span className="dr-id">ID: {empId}</span>
                        </div>
                        <div className={`dr-checkbox ${isSelected ? 'checked' : ''}`}>
                          {isSelected ? <Check size={16} color="#ffffff" /> : null}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* SECTION 2: Other Remaining Employees in Organization */}
              {filteredOtherParticipants.length > 0 && (
                <>
                  <div className="dropdown-section-header">
                    <span>🌐 Other Employees ({filteredOtherParticipants.length})</span>
                  </div>
                  {filteredOtherParticipants.map((emp, index) => {
                    const empId = String(emp[0]);
                    let empName = String(emp[1] || "");
                    if (empName.startsWith(empId + "-")) {
                      empName = empName.replace(empId + "-", "").trim();
                    }
                    const isSelected = form.participants.some(id => String(id) === empId);
                    const initials = (empName.charAt(0) || "?").toUpperCase();

                    return (
                      <div
                        key={`other-${empId}`}
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
                  })}
                </>
              )}

              {filteredTeamParticipants.length === 0 && filteredOtherParticipants.length === 0 && (
                <div className="dr-no-results">No employees found matching search query</div>
              )}
            </div>

            <div className="dropdown-multiselect-footer">
              <button
                type="button"
                className="dropdown-done-btn"
                onClick={() => setIsPartDropdownOpen(false)}
              >
                Done ({form.participants.length} Selected)
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
                <div className="dr-no-results">No owners found</div>
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