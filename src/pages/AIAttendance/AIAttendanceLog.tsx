import { IonContent, IonPage, IonIcon, IonSpinner, IonPopover } from "@ionic/react";
import {
  arrowBackOutline, calendarOutline, searchOutline,
  personOutline, timeOutline, checkmarkCircleOutline,
  closeCircleOutline, refreshOutline, chevronBackOutline,
  chevronForwardOutline, documentTextOutline, locationOutline,
  gridOutline, listOutline, appsOutline
} from "ionicons/icons";
import { useEffect, useState, useRef } from "react";
import { useHistory, useParams } from "react-router";
import { API_BASE } from "../../config";
import "./AIAttendanceLog.css";

interface AttendanceRecord {
  'Emp ID'?: string;
  Name: string;
  'Morning In': string;
  'Lunch Out': string;
  'Lunch In': string;
  'Evening Out': string;
  date?: string;
  officeName?: string;
  lateMinutes?: string;
  morningLateMinutes?: string | number;
  lunchLateMinutes?: string | number;
  totalLateMinutes?: string | number;
  graceType?: string;
  attendanceStatus?: string;
  branch?: string;

  morningInLat?: number;
  morningInLng?: number;
  morningInCity?: string;

  lunchOutLat?: number;
  lunchOutLng?: number;
  lunchOutCity?: string;

  lunchInLat?: number;
  lunchInLng?: number;
  lunchInCity?: string;

  eveningOutLat?: number;
  eveningOutLng?: number;
  eveningOutCity?: string;

  morningInPhoto?: string;
  lunchOutPhoto?: string;
  lunchInPhoto?: string;
  eveningOutPhoto?: string;
  permissionOutPhoto?: string;
  permissionInPhoto?: string;
}

const AVATAR_CONFIG = [
  { grad: 'linear-gradient(145deg,#312e81 0%,#4f46e5 45%,#818cf8 100%)', glow: 'rgba(79,70,229,0.50)' }, // deep indigo
  { grad: 'linear-gradient(145deg,#4c1d95 0%,#7c3aed 45%,#a78bfa 100%)', glow: 'rgba(124,58,237,0.50)' }, // deep violet
  { grad: 'linear-gradient(145deg,#831843 0%,#be185d 45%,#f472b6 100%)', glow: 'rgba(190,24,93,0.50)' }, // deep pink
  { grad: 'linear-gradient(145deg,#881337 0%,#be123c 45%,#fb7185 100%)', glow: 'rgba(190,18,60,0.50)' }, // deep rose
  { grad: 'linear-gradient(145deg,#7c2d12 0%,#c2410c 45%,#fb923c 100%)', glow: 'rgba(194,65,12,0.50)' }, // deep orange
  { grad: 'linear-gradient(145deg,#78350f 0%,#b45309 45%,#fcd34d 100%)', glow: 'rgba(180,83,9,0.50)' }, // deep amber
  { grad: 'linear-gradient(145deg,#14532d 0%,#15803d 45%,#4ade80 100%)', glow: 'rgba(21,128,61,0.50)' }, // deep green
  { grad: 'linear-gradient(145deg,#134e4a 0%,#0f766e 45%,#2dd4bf 100%)', glow: 'rgba(15,118,110,0.50)' }, // deep teal
  { grad: 'linear-gradient(145deg,#1e3a8a 0%,#1d4ed8 45%,#60a5fa 100%)', glow: 'rgba(29,78,216,0.50)' }, // deep blue
  { grad: 'linear-gradient(145deg,#0c4a6e 0%,#0369a1 45%,#38bdf8 100%)', glow: 'rgba(3,105,161,0.50)' }, // deep sky
];

const SLOTS = [
  { key: 'Morning In' as const, photoKey: 'morningInPhoto' as const, latKey: 'morningInLat' as const, lngKey: 'morningInLng' as const, short: 'M-IN', label: 'Morning In', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  { key: 'Lunch Out' as const, photoKey: 'lunchOutPhoto' as const, latKey: 'lunchOutLat' as const, lngKey: 'lunchOutLng' as const, short: 'L-OUT', label: 'Lunch Out', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  { key: 'Lunch In' as const, photoKey: 'lunchInPhoto' as const, latKey: 'lunchInLat' as const, lngKey: 'lunchInLng' as const, short: 'L-IN', label: 'Lunch In', color: '#10b981', bg: '#f0fdf4', border: '#a7f3d0' },
  { key: 'Evening Out' as const, photoKey: 'eveningOutPhoto' as const, latKey: 'eveningOutLat' as const, lngKey: 'eveningOutLng' as const, short: 'E-OUT', label: 'Evening Out', color: '#f43f5e', bg: '#fff1f2', border: '#fecdd3' },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const AIAttendanceLog: React.FC = () => {
  const { mode } = useParams<{ mode: string }>();
  const [selectedBranch, setSelectedBranch] = useState("ALL");
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [branches, setBranches] = useState<string[]>(["ALL"]);

  // ── Mode & Role Check ──
  const loggedInId = (() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const p = JSON.parse(stored);
        return String(p?.empCode || p?.EmpCode || p?.empId || p?.Emp_ID || p?.emp_id || "").trim();
      } catch { }
    }
    return "";
  })();

  const ADMIN_IDS = ["1501", "1509", "1601", "1508"];
  const isAdmin = ADMIN_IDS.includes(loggedInId) || (Boolean(loggedInId) && ADMIN_IDS.includes(String(parseInt(loggedInId, 10))));

  const effectiveMode = isAdmin ? (mode === "user" ? "user" : "security") : "user";
  const history = useHistory();
  const dateInputRef = useRef<HTMLInputElement>(null);

  // ── View Mode Tabs: Daily vs Monthly ──
  const [viewTab, setViewTab] = useState<'daily' | 'monthly'>('daily');

  // ── Daily View State ──
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [userLogs, setUserLogs] = useState<AttendanceRecord[]>([]);
  const [securityLogs, setSecurityLogs] = useState<AttendanceRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => todayStr());
  const [companyHolidays, setCompanyHolidays] = useState<{ date: string; remark: string }[]>([]);

  // ── Monthly View State ──
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedEmpCode, setSelectedEmpCode] = useState<string>(loggedInId || "");
  const [monthlyEmployees, setMonthlyEmployees] = useState<any[]>([]);
  const [monthlyMatrix, setMonthlyMatrix] = useState<Record<string, any>>({});
  const [monthlyLeaves, setMonthlyLeaves] = useState<Record<string, any>>({});
  const [monthlyHolidays, setMonthlyHolidays] = useState<Record<string, string>>({});
  const [loadingMonthly, setLoadingMonthly] = useState<boolean>(false);
  const [monthlySubView, setMonthlySubView] = useState<'calendar' | 'table'>('calendar');

  // ── Modal Detail Popup ──
  const [selectedDayDetail, setSelectedDayDetail] = useState<{
    date: string;
    log?: AttendanceRecord;
    status: string;
    holidayRemark?: string;
    leaveInfo?: any;
    empName?: string;
    empCode?: string;
  } | null>(null);

  // ── Photo Zoom / Verification Modal State ──
  const [photoModal, setPhotoModal] = useState<{
    empName: string;
    empId: string;
    slotLabel: string;
    slotColor: string;
    time?: string;
    location?: string;
    photoUrl: string;
    lat?: number;
    lng?: number;
    status?: string;
  } | null>(null);

  const getFullPhotoUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image')) return url;
    const baseUrl = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
    const origin = baseUrl.replace(/\/api\/?$/i, '');
    return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const openPhotoModal = (
    log: AttendanceRecord | any,
    slotLabel: string,
    photoUrl: string,
    slotColor: string,
    time?: string,
    location?: string,
    lat?: number,
    lng?: number,
    status?: string
  ) => {
    if (!photoUrl) return;
    setPhotoModal({
      empName: log.Name || log.name || log.empName || "Employee",
      empId: log['Emp ID'] || log.empId || log.empCode || "-",
      slotLabel,
      slotColor,
      photoUrl,
      time: time || '-',
      location: location || log.officeName || log.OfficeName || '',
      lat: lat || 0,
      lng: lng || 0,
      status: status || log.attendanceStatus || log.AttendanceStatus || 'Verified'
    });
  };

  useEffect(() => {
    const token = localStorage.getItem("token") || "";
    const hdrs: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': 'dbase-ai-master-key-2026',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    fetch(API_BASE + 'Checkin/GetCompanyHolidays', { headers: hdrs })
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data)) setCompanyHolidays(d.data);
      })
      .catch(console.error);
  }, []);

  function getNonScanStatus(dateStr: string): string {
    if (!dateStr) return "Absent";
    const h = companyHolidays.find(x => x.date === dateStr);
    if (h && h.remark) {
      return h.remark;
    }
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (d.getDay() === 0) return "Sunday";
      }
    } catch { }
    return "Absent";
  }

  function formatDateLocal(d: Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function todayStr() {
    return formatDateLocal(new Date());
  }

  function dateOffset(daysAgo: number) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return formatDateLocal(d);
  }

  function displayLabel(dateStr: string) {
    if (dateStr === todayStr()) return "Today";
    if (dateStr === dateOffset(1)) return "Yesterday";
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric'
    });
  }

  const isToday = selectedDate === todayStr();

  function shiftDay(delta: number) {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const next = formatDateLocal(d);
    if (next <= todayStr()) setSelectedDate(next);
  }

  /* ── Initial user load ── */
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setCurrentUser(parsed);
        const code = String(parsed?.empCode || parsed?.EmpCode || parsed?.empId || parsed?.Emp_ID || parsed?.emp_id || "").trim();
        if (code && !selectedEmpCode) {
          setSelectedEmpCode(code);
        }
      } catch { }
    }
  }, []);

  /* ── Load branches dynamically ── */
  useEffect(() => {
    if (effectiveMode === "security") {
      const token = localStorage.getItem("token") || "";
      const hdrs: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': 'dbase-ai-master-key-2026',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
      fetch(API_BASE + 'Checkin/GetBranches', { headers: hdrs })
        .then(r => r.json())
        .then(d => {
          if (d.success && Array.isArray(d.data)) setBranches(["ALL", ...d.data]);
        })
        .catch(console.error);
    }
  }, [effectiveMode]);

  /* ── Re-fetch daily logs when mode, date, or branch changes ── */
  useEffect(() => {
    if (viewTab === 'daily') {
      fetchLogs(true);
    }
  }, [effectiveMode, selectedDate, selectedBranch, viewTab]);

  /* ── Auto-sync in security mode (only when viewing today) ── */
  useEffect(() => {
    if (effectiveMode !== "security" || !isToday || viewTab !== 'daily') return;
    const iv = setInterval(() => {
      setIsSyncing(true);
      fetchLogs(false).finally(() => setIsSyncing(false));
    }, 10000);
    return () => clearInterval(iv);
  }, [effectiveMode, selectedDate, selectedBranch, viewTab]);

  /* ── Fetch Monthly View Data ── */
  const fetchMonthlyData = async () => {
    setLoadingMonthly(true);
    try {
      const token = localStorage.getItem("token") || "";
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': 'dbase-ai-master-key-2026',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
      const url = `${API_BASE}Checkin/GetHRMonthlyAttendanceMatrix?year=${selectedYear}&month=${selectedMonth}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const d = await res.json();
        if (d.success) {
          setMonthlyMatrix(d.matrix || {});
          setMonthlyLeaves(d.leaves || {});
          setMonthlyHolidays(d.holidays || {});

          if (Array.isArray(d.employees)) {
            setMonthlyEmployees(d.employees);
            if (!selectedEmpCode || (!isAdmin && selectedEmpCode !== loggedInId)) {
              const mine = d.employees.find((e: any) => String(e.empCode).trim() === loggedInId);
              if (mine) {
                setSelectedEmpCode(mine.empCode);
              } else if (d.employees.length > 0) {
                setSelectedEmpCode(isAdmin ? d.employees[0].empCode : loggedInId);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("[AIAttendanceLog] fetchMonthlyData", e);
    } finally {
      setLoadingMonthly(false);
    }
  };

  useEffect(() => {
    if (viewTab === 'monthly') {
      fetchMonthlyData();
    }
  }, [viewTab, selectedYear, selectedMonth]);

  /* ─────────────────────────────────────────
     FETCH DAILY LOGS
  ───────────────────────────────────────── */
  async function fetchLogs(showLoader = false) {
    if (showLoader) setLoading(true);
    const token = localStorage.getItem("token") || "";
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': 'dbase-ai-master-key-2026',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    try {
      if (effectiveMode === "user") {
        const base = new Date(selectedDate + 'T00:00:00');
        const dates: string[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(base);
          d.setDate(base.getDate() - i);
          dates.push(formatDateLocal(d));
        }
        let empCode = "", empName = "";
        const stored = localStorage.getItem("user");
        if (stored) {
          try {
            const p = JSON.parse(stored);
            empCode = String(p?.empCode || p?.EmpCode || p?.empId || p?.Emp_ID || p?.emp_id || "").trim();
            empName = String(p?.empName || p?.EmpName || p?.emp_name || "").trim();
          } catch { }
        }

        const mapRecord = (r: any, date: string): AttendanceRecord => {
          const mLateVal = r.morningLateMinutes ?? r.MorningLateMinutes ?? r.lateMinutes ?? r.LateMinutes ?? '0';
          const lLateVal = r.lunchLateMinutes ?? r.LunchLateMinutes ?? r.lunch_late_minutes ?? r.LunchLateMins ?? '0';
          let tLateVal = r.totalLateMinutes ?? r.TotalLateMinutes ?? r.total_late_minutes ?? '0';

          const mNum = parseInt(String(mLateVal), 10) || 0;
          const lNum = parseInt(String(lLateVal), 10) || 0;
          let tNum = parseInt(String(tLateVal), 10) || 0;

          if (tNum === 0 && (mNum > 0 || lNum > 0)) {
            tNum = mNum + lNum;
            tLateVal = String(tNum);
          }

          return {
            'Emp ID': r.empId || r.Emp_ID || '-',
            Name: r.name || r.Emp_Name || '',
            'Morning In': r.morningIn || r.Morning_In || '-',
            'Lunch Out': r.lunchOut || r.Lunch_Out || '-',
            'Lunch In': r.lunchIn || r.Lunch_In || '-',
            'Evening Out': r.eveningOut || r.Evening_Out || '-',
            lateMinutes: String(mLateVal),
            morningLateMinutes: mNum,
            lunchLateMinutes: lNum,
            totalLateMinutes: tNum,
            graceType: r.graceType || r.GraceType || '',
            attendanceStatus: r.attendanceStatus || r.AttendanceStatus || '',
            date,
            officeName: r.officeName || r.OfficeName || '',
            morningInLat: r.morningInLat,
            morningInLng: r.morningInLng,
            morningInCity: r.morningInCity,
            lunchOutLat: r.lunchOutLat,
            lunchOutLng: r.lunchOutLng,
            lunchOutCity: r.lunchOutCity,
            lunchInLat: r.lunchInLat,
            lunchInLng: r.lunchInLng,
            lunchInCity: r.lunchInCity,
            eveningOutLat: r.eveningOutLat,
            eveningOutLng: r.eveningOutLng,
            eveningOutCity: r.eveningOutCity,
            morningInPhoto: r.morningInPhoto || r.Morning_In_Photo || '',
            lunchOutPhoto: r.lunchOutPhoto || r.Lunch_Out_Photo || '',
            lunchInPhoto: r.lunchInPhoto || r.Lunch_In_Photo || '',
            eveningOutPhoto: r.eveningOutPhoto || r.Evening_Out_Photo || '',
            permissionOutPhoto: r.permissionOutPhoto || r.Permission_Out_Photo || '',
            permissionInPhoto: r.permissionInPhoto || r.Permission_In_Photo || '',
          };
        };

        const all = await Promise.all(dates.map(async date => {
          try {
            const res = await fetch(
              `${API_BASE}Checkin/AIGetAttendanceByDate?date=${date}`,
              { headers }
            );
            if (!res.ok) return [];
            const d = await res.json();
            if (d.success && Array.isArray(d.data)) {
              return d.data
                .filter((r: any) => {
                  const n = String(r.name || "").trim().toLowerCase();
                  const id = String(r.empId || "").trim().toLowerCase();
                  const eCode = empCode.toLowerCase();
                  const eName = empName.toLowerCase();
                  const sameId = eCode && (id === eCode || (parseInt(id, 10) > 0 && parseInt(id, 10) === parseInt(eCode, 10)));
                  const sameName = eName && (n === eName || n.includes(eName) || eName.includes(n));
                  return sameId || sameName;
                })
                .map((r: any) => mapRecord(r, date));
            }
          } catch { }
          return [];
        }));

        const flat = all.flat();
        setUserLogs(dates.map((date): AttendanceRecord => {
          const found = flat.find(l => l.date === date);
          if (found) return found;
          return {
            Name: empName || "Employee", 'Emp ID': empCode || "-",
            'Morning In': '-', 'Lunch Out': '-', 'Lunch In': '-', 'Evening Out': '-',
            lateMinutes: '0', morningLateMinutes: '0', lunchLateMinutes: '0', totalLateMinutes: '0',
            graceType: '',
            attendanceStatus: getNonScanStatus(date), date
          };
        }));

      } else {
        let branchEmployees: any[] = [];
        let fetchedBranchRoster = false;

        if (selectedBranch !== "ALL") {
          try {
            const br = await fetch(API_BASE + `Checkin/GetEmployeesByBranch?branch=${encodeURIComponent(selectedBranch)}`, {
              headers
            });
            const bd = await br.json();
            if (bd.success && Array.isArray(bd.data)) {
              branchEmployees = bd.data;
              fetchedBranchRoster = true;
            }
          } catch (e) {
            console.error("Error fetching branch employees", e);
          }
        }

        let attendanceUrl = `${API_BASE}Checkin/AIGetAttendanceByDate?date=${selectedDate}`;
        if (selectedBranch !== "ALL") {
          attendanceUrl += `&branch=${encodeURIComponent(selectedBranch)}`;
        }

        const res = await fetch(attendanceUrl, { headers });
        if (!res.ok) { console.error("[AIAttendanceLog] fetch", res.status); return; }
        const d = await res.json();
        if (d.success && Array.isArray(d.data)) {

          const mapped: AttendanceRecord[] = d.data.map((r: any) => {
            const mLateVal = r.morningLateMinutes ?? r.MorningLateMinutes ?? r.lateMinutes ?? r.LateMinutes ?? '0';
            const lLateVal = r.lunchLateMinutes ?? r.LunchLateMinutes ?? r.lunch_late_minutes ?? r.LunchLateMins ?? '0';
            let tLateVal = r.totalLateMinutes ?? r.TotalLateMinutes ?? r.total_late_minutes ?? '0';

            const mNum = parseInt(String(mLateVal), 10) || 0;
            const lNum = parseInt(String(lLateVal), 10) || 0;
            let tNum = parseInt(String(tLateVal), 10) || 0;

            if (tNum === 0 && (mNum > 0 || lNum > 0)) {
              tNum = mNum + lNum;
              tLateVal = String(tNum);
            }

            return {
              'Emp ID': r.empId || r.Emp_ID || '-',
              Name: r.name || r.Emp_Name || 'Unknown',
              'Morning In': r.morningIn || r.Morning_In || '-',
              'Lunch Out': r.lunchOut || r.Lunch_Out || '-',
              'Lunch In': r.lunchIn || r.Lunch_In || '-',
              'Evening Out': r.eveningOut || r.Evening_Out || '-',
              lateMinutes: String(mLateVal),
              morningLateMinutes: mNum,
              lunchLateMinutes: lNum,
              totalLateMinutes: tNum,
              graceType: r.graceType || r.GraceType || '-',
              attendanceStatus: r.attendanceStatus || r.AttendanceStatus || '-',
              branch: r.branch ?? r.Branch ?? r.branchName ?? r.BranchName ?? r.RuleMaster ?? "",
              officeName: r.officeName || r.OfficeName || '',
              morningInLat: r.morningInLat,
              morningInLng: r.morningInLng,
              morningInCity: r.morningInCity,
              lunchOutLat: r.lunchOutLat,
              lunchOutLng: r.lunchOutLng,
              lunchOutCity: r.lunchOutCity,
              lunchInLat: r.lunchInLat,
              lunchInLng: r.lunchInLng,
              lunchInCity: r.lunchInCity,
              eveningOutLat: r.eveningOutLat,
              eveningOutLng: r.eveningOutLng,
              eveningOutCity: r.eveningOutCity,
              morningInPhoto: r.morningInPhoto || r.Morning_In_Photo || '',
              lunchOutPhoto: r.lunchOutPhoto || r.Lunch_Out_Photo || '',
              lunchInPhoto: r.lunchInPhoto || r.Lunch_In_Photo || '',
              eveningOutPhoto: r.eveningOutPhoto || r.Evening_Out_Photo || '',
              permissionOutPhoto: r.permissionOutPhoto || r.Permission_Out_Photo || '',
              permissionInPhoto: r.permissionInPhoto || r.Permission_In_Photo || '',
            };
          });

          let finalLogs: AttendanceRecord[] = [];

          if (selectedBranch === "ALL") {
            finalLogs = mapped;
          } else if (!fetchedBranchRoster) {
            finalLogs = mapped.filter(x => (x.branch || "").trim().toLowerCase() === selectedBranch.trim().toLowerCase());
          } else {
            finalLogs = branchEmployees.map((emp: any) => {
              const eCode = String(emp.empCode || "").trim().toLowerCase();
              const found = mapped.find(m => {
                const mId = String(m['Emp ID'] || "").trim().toLowerCase();
                const mName = String(m.Name || "").trim().toLowerCase();
                const eName = String(emp.empName || "").trim().toLowerCase();
                return (mId && (mId === eCode || (parseInt(mId, 10) > 0 && parseInt(mId, 10) === parseInt(eCode, 10)))) ||
                  (mName && eName && (mName === eName || mName.includes(eName) || eName.includes(mName)));
              });
              if (found) return found;

              return {
                'Emp ID': emp.empCode || '-',
                Name: emp.empName || 'Unknown',
                'Morning In': '-',
                'Lunch Out': '-',
                'Lunch In': '-',
                'Evening Out': '-',
                lateMinutes: '0', morningLateMinutes: '0', lunchLateMinutes: '0', totalLateMinutes: '0',
                graceType: '-',
                attendanceStatus: getNonScanStatus(selectedDate),
                branch: emp.branch || selectedBranch,
                officeName: emp.officeName || emp.branch || ''
              };
            });
          }

          const sorted = [...finalLogs].sort((a, b) => {
            const latest = (rec: AttendanceRecord) =>
              SLOTS
                .map(s => rec[s.key])
                .filter(t => t && t !== "-")
                .sort()
                .reverse()[0] || "";

            return latest(b).localeCompare(latest(a));
          });

          setSecurityLogs(sorted);
        }
      }
    } catch (err) {
      console.error("[AIAttendanceLog]", err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  /* ── Helpers ── */
  function cleanTime(t?: string) {
    if (!t || t === '-' || t === '--:--') return '--:--';
    const clean = t.trim();
    if (clean.includes('1900-01-01')) {
      const p = clean.split(/[ T]/);
      if (p.length > 1) return cleanTime(p[1]);
    }
    const ampmMatch = clean.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(AM|PM)$/i);
    if (ampmMatch) {
      const h = parseInt(ampmMatch[1], 10);
      const m = ampmMatch[2];
      const ap = ampmMatch[3].toUpperCase();
      const normH = h === 0 ? 12 : (h > 12 ? h % 12 || 12 : h);
      return `${normH.toString().padStart(2, '0')}:${m} ${ap}`;
    }
    const match = clean.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?/);
    if (match) {
      const h = parseInt(match[1], 10);
      const m = match[2];
      const ap = h >= 12 ? 'PM' : 'AM';
      const normH = h % 12 || 12;
      return `${normH.toString().padStart(2, '0')}:${m} ${ap}`;
    }
    return clean;
  }

  function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(n => n[0] || '').join('').toUpperCase() || '?';
  }

  function avatarCfg(name: string) {
    return AVATAR_CONFIG[(name.charCodeAt(0) || 0) % AVATAR_CONFIG.length];
  }

  function statusClass(s?: string) {
    if (!s || s === '-') return 'sc-unknown';
    const l = s.toLowerCase();
    if (l === 'present') return 'sc-present';
    if (l === 'lop') return 'sc-lop';
    if (l === 'absent') return 'sc-absent';
    if (l.includes('sunday') || l.includes('weekly off')) return 'sc-sunday';
    if (l.includes('holiday') || l.includes('saturday') || l.includes('bhogi') || l.includes('sankranthi') || l.includes('ugadi') || l.includes('ramzan') || l.includes('ram') || l.includes('friday') || l.includes('jayanti') || l.includes('republic') || l.includes('new year')) return 'sc-holiday';
    return 'sc-grace';
  }

  function shortStatus(s?: string) {
    if (!s) return "—";
    const u = s.toUpperCase().trim();
    if (u === "SECOND SATURDAY") return "2nd Sat";
    if (u === "FOURTH SATURDAY") return "4th Sat";
    if (u === "WEEKLY OFF") return "Off";
    if (u === "PERMISSION") return "Perm";
    if (u === "HALF DAY") return "Half Day";
    return s;
  }

  function getLocationName(slotKey: string, log: AttendanceRecord | any) {
    if (!log) return "";
    let city = "";
    if (slotKey === 'Morning In') city = log.morningInCity;
    else if (slotKey === 'Lunch Out') city = log.lunchOutCity;
    else if (slotKey === 'Lunch In') city = log.lunchInCity;
    else if (slotKey === 'Evening Out') city = log.eveningOutCity;

    return city || log.officeName || log.OfficeName || "";
  }

  /* ── Stats ── */
  const totalV = securityLogs.length;
  const mornV = securityLogs.filter(l => l['Morning In'] !== '-').length;
  const lunchV = securityLogs.filter(l => l['Lunch Out'] !== '-' || l['Lunch In'] !== '-').length;
  const eveningV = securityLogs.filter(l => l['Evening Out'] !== '-').length;

  const filtered = securityLogs.filter(log => {
    const q = searchQuery.toLowerCase();
    return (log.Name || '').toLowerCase().includes(q) ||
      (log['Emp ID'] || '').toLowerCase().includes(q);
  });

  /* ── Monthly Grid Days Calculation ── */
  const daysInSelectedMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const firstDayOfWeek = new Date(selectedYear, selectedMonth - 1, 1).getDay(); // 0 = Sun

  const shiftMonth = (delta: number) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  // Compute selected employee details for Monthly View
  const selectedEmpProfile = monthlyEmployees.find(e => String(e.empCode).trim() === String(selectedEmpCode).trim()) || {
    empCode: selectedEmpCode || loggedInId,
    empName: currentUser?.empName || currentUser?.EmpName || "Employee",
    branch: selectedBranch || "Head Office"
  };

  /* ─────────────────────────────────────────
     RENDER
  ───────────────────────────────────────── */
  return (
    <IonPage>
      <IonContent fullscreen scrollY className="log-page-content">
        <div className="wr-container stock-container" style={{ padding: '0', minHeight: 'auto', backgroundColor: 'transparent' }}>

          {/* ── Header ── */}
          <div className="page-wr-header" style={{ margin: '16px', borderRadius: '16px', padding: '16px', position: 'sticky', top: '16px', zIndex: 999 }}>
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()}>
                <IonIcon icon={arrowBackOutline} style={{ color: "white" }} />
              </button>
              <div>
                <h1 className="page-wr-title">
                  {effectiveMode === "user" ? "My Attendance" : "Attendance Records"}
                </h1>
                <p className="page-wr-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span className="subtitle-pulse-dot" />
                  <span>
                    {effectiveMode === "user"
                      ? `${currentUser?.empName || currentUser?.EmpName || "Employee"} — Attendance Logs`
                      : "Live verification console"}
                  </span>
                </p>
              </div>
            </div>

            <div className="page-wr-header-right page-wr-header-right-custom">
              {/* View Mode Toggle: Daily vs Monthly */}
              <div className="view-mode-tabs">
                <button
                  className={`tab-btn ${viewTab === 'daily' ? 'active' : ''}`}
                  onClick={() => setViewTab('daily')}
                >
                  <IonIcon icon={calendarOutline} />
                  <span>Daily Log</span>
                </button>
                <button
                  className={`tab-btn ${viewTab === 'monthly' ? 'active' : ''}`}
                  onClick={() => setViewTab('monthly')}
                >
                  <IonIcon icon={gridOutline} />
                  <span>Monthly View</span>
                </button>
              </div>

              {effectiveMode === "security" ? (
                <>
                  {viewTab === 'daily' && (
                    <div style={{ position: 'relative' }}>
                      <button
                        id="branch-btn"
                        className="branch-btn"

                        onClick={() => setShowBranchDropdown(true)}
                        style={{
                          background: '#ffffff',
                          color: 'var(--ion-color-primary, #0d9488)',
                          border: '1px solid #cbd5e1', padding: '6px 16px', borderRadius: '24px', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(13, 148, 136, 0.2)'
                        }}
                      >
                        {selectedBranch}
                        <IonIcon icon={chevronForwardOutline} style={{ transform: showBranchDropdown ? 'rotate(-90deg)' : 'rotate(90deg)', fontSize: '12px', transition: 'transform 0.2s' }} />
                      </button>
                      <IonPopover
                        trigger="branch-btn"
                        isOpen={showBranchDropdown}
                        onDidDismiss={() => setShowBranchDropdown(false)}
                        alignment="end"
                        side="bottom"
                        arrow={false}
                        style={{ '--background': 'transparent', '--box-shadow': 'none' }}
                      >
                        <div className="branch-dropdown" style={{ background: '#ffffff', borderRadius: '14px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', padding: '6px', minWidth: '140px', border: '1px solid #e2e8f0' }}>
                          {branches.map((branch) => (
                            <div
                              key={branch}
                              className={`branch-item ${selectedBranch === branch ? "active" : ""}`}
                              onClick={() => {
                                setSelectedBranch(branch);
                                setShowBranchDropdown(false);
                              }}
                              style={{ padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', background: selectedBranch === branch ? '#f1f5f9' : 'transparent', color: selectedBranch === branch ? 'var(--ion-color-primary, #0d9488)' : '#475569', fontWeight: selectedBranch === branch ? 700 : 600, fontSize: '13px', transition: 'all 0.2s' }}
                            >
                              {branch}
                            </div>
                          ))}
                        </div>
                      </IonPopover>
                    </div>
                  )}

                  <button
                    onClick={() => history.push('/leave-report')}
                    style={{
                      background: '#ffffff',
                      color: 'var(--ion-color-primary, #0d9488)',
                      border: '1px solid #cbd5e1',
                      padding: '6px 14px',
                      borderRadius: '24px',
                      fontWeight: 700,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(13, 148, 136, 0.2)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <IonIcon icon={documentTextOutline} style={{ fontSize: '14px' }} />
                    Absents Report
                  </button>

                  <button
                    onClick={() => history.push('/hr-attendance-matrix')}
                    style={{
                      background: '#ffffff',
                      color: 'var(--ion-color-primary, #0d9488)',
                      border: '1px solid #cbd5e1',
                      padding: '6px 14px',
                      borderRadius: '24px',
                      fontWeight: 700,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(13, 148, 136, 0.2)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <IonIcon icon={appsOutline} style={{ fontSize: '14px' }} />
                    HR Attendance Matrix
                  </button>

                  {viewTab === 'daily' && (
                    <div className="live-sync-indicator" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.15)', padding: '6px 12px', borderRadius: '16px' }}>
                      <span className={`sync-dot ${isSyncing ? "syncing" : ""}`} />
                      <span className="sync-text" style={{ fontSize: '11px', fontWeight: 800, color: 'white' }}>{isToday ? (isSyncing ? "SYNC…" : "LIVE") : "HISTORY"}</span>
                      <button className="sync-now-btn" onClick={() => fetchLogs(true)} style={{ background: 'transparent', border: 'none', color: 'white', display: 'flex', cursor: 'pointer' }}>
                        <IonIcon icon={refreshOutline} />
                      </button>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="log-body">
          {/* ════════════════════════════════════════════════════
             MONTHLY VIEW TAB
          ════════════════════════════════════════════════════ */}
          {viewTab === 'monthly' ? (
            <div className="monthly-view-wrapper animate-fade-in">

              {/* Monthly Controls Card (Clean 2-Row Layout) */}
              <div className="monthly-controls-card">

                {/* Row 1: EMPLOYEE DROPDOWN */}
                <div className="emp-select-row">
                  <label className="emp-select-label">
                    <IonIcon icon={personOutline} style={{ color: 'var(--ion-color-primary, #0d9488)' }} />
                    Employee:
                  </label>
                  <select
                    className="emp-select-dropdown"
                    value={selectedEmpCode}
                    disabled={!isAdmin}
                    onChange={(e) => setSelectedEmpCode(e.target.value)}
                  >
                    {isAdmin ? (
                      <>
                        <option value="">-- Select Employee --</option>
                        {monthlyEmployees.map((emp) => (
                          <option key={emp.empCode} value={emp.empCode}>
                            [{emp.empCode}] {emp.empName} {emp.branch ? `(${emp.branch})` : ''}
                          </option>
                        ))}
                      </>
                    ) : (
                      <option value={loggedInId}>
                        [{loggedInId}] {currentUser?.empName || currentUser?.EmpName || "My Attendance"}
                      </option>
                    )}
                  </select>
                </div>

                {/* Row 2: Month Navigation & Grid/Table Sub-View Toggle */}
                <div className="monthly-nav-row">
                  <div className="month-year-picker">
                    <button className="dnav-arrow" onClick={() => shiftMonth(-1)}>
                      <IonIcon icon={chevronBackOutline} />
                    </button>

                    <select
                      className="month-select"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                    >
                      {MONTH_NAMES.map((name, i) => (
                        <option key={name} value={i + 1}>{name}</option>
                      ))}
                    </select>

                    <select
                      className="year-select"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                    >
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>

                    <button className="dnav-arrow" onClick={() => shiftMonth(1)}>
                      <IonIcon icon={chevronForwardOutline} />
                    </button>
                  </div>

                  <div className="subview-toggle-group">
                    <button
                      className={`subview-btn ${monthlySubView === 'calendar' ? 'active' : ''}`}
                      onClick={() => setMonthlySubView('calendar')}
                    >
                      <IonIcon icon={gridOutline} /> Grid
                    </button>
                    <button
                      className={`subview-btn ${monthlySubView === 'table' ? 'active' : ''}`}
                      onClick={() => setMonthlySubView('table')}
                    >
                      <IonIcon icon={listOutline} /> Table
                    </button>
                  </div>
                </div>

              </div>

              {/* Monthly KPI Summary Cards */}
              {(() => {
                let presentCount = 0;
                let absentCount = 0;
                let totalLateMins = 0;

                for (let day = 1; day <= daysInSelectedMonth; day++) {
                  const dayStr = String(day).padStart(2, '0');
                  const mStr = String(selectedMonth).padStart(2, '0');
                  const dateKey = `${selectedEmpCode}_${selectedYear}-${mStr}-${dayStr}`;
                  const att = monthlyMatrix[dateKey];
                  const hol = monthlyHolidays[`${selectedYear}-${mStr}-${dayStr}`];
                  const dObj = new Date(selectedYear, selectedMonth - 1, day);
                  const isSunday = dObj.getDay() === 0;

                  if (att) {
                    if (att.attendanceStatus && att.attendanceStatus.toLowerCase().includes('present')) {
                      presentCount++;
                    }
                    totalLateMins += parseInt(att.totalLate || '0', 10) || 0;
                  } else if (!hol && !isSunday && dObj <= new Date()) {
                    absentCount++;
                  }
                }

                return (
                  <div className="console-stats-grid">
                    <div className="stock-panel stat-total" style={{ padding: '12px 16px', borderRadius: '16px' }}>
                      <div className="stat-info">
                        <span className="stat-num" style={{ fontSize: '20px' }}>{daysInSelectedMonth} Days</span>
                        <span className="stat-title">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</span>
                      </div>
                    </div>
                    <div className="stock-panel stat-morning" style={{ padding: '12px 16px', borderRadius: '16px' }}>
                      <div className="stat-info">
                        <span className="stat-num" style={{ fontSize: '20px', color: '#10b981' }}>{presentCount}</span>
                        <span className="stat-title">Days Present</span>
                      </div>
                    </div>
                    <div className="stock-panel stat-evening" style={{ padding: '12px 16px', borderRadius: '16px' }}>
                      <div className="stat-info">
                        <span className="stat-num" style={{ fontSize: '20px', color: '#ef4444' }}>{absentCount}</span>
                        <span className="stat-title">Absents / LOP</span>
                      </div>
                    </div>
                    <div className="stock-panel stat-break" style={{ padding: '12px 16px', borderRadius: '16px' }}>
                      <div className="stat-info">
                        <span className="stat-num" style={{ fontSize: '20px', color: '#f59e0b' }}>{totalLateMins}m</span>
                        <span className="stat-title">Total Late Mins</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {loadingMonthly ? (
                <div className="loader-block">
                  <IonSpinner name="crescent" color="primary" />
                  <p>Loading monthly attendance matrix…</p>
                </div>
              ) : monthlySubView === 'calendar' ? (

                /* CALENDAR GRID VIEW */
                <div className="monthly-calendar-container card-panel">
                  {/* Day Names Header */}
                  <div className="calendar-grid-header">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dName) => (
                      <div key={dName} className="calendar-day-head-cell">{dName}</div>
                    ))}
                  </div>

                  {/* Day Cells Grid */}
                  <div className="calendar-grid-body">
                    {/* Empty padding cells for first week */}
                    {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="calendar-day-cell empty-day" />
                    ))}

                    {/* Days of Month */}
                    {Array.from({ length: daysInSelectedMonth }).map((_, idx) => {
                      const day = idx + 1;
                      const dayStr = String(day).padStart(2, '0');
                      const mStr = String(selectedMonth).padStart(2, '0');
                      const fullDate = `${selectedYear}-${mStr}-${dayStr}`;
                      const dateKey = `${selectedEmpCode}_${fullDate}`;

                      const att = monthlyMatrix[dateKey];
                      const leave = monthlyLeaves[dateKey];
                      const holiday = monthlyHolidays[fullDate];

                      const dObj = new Date(selectedYear, selectedMonth - 1, day);
                      const isSunday = dObj.getDay() === 0;
                      const isTodayCell = fullDate === todayStr();

                      let statusText = "Absent";
                      let sc = "sc-absent";

                      if (holiday) {
                        statusText = holiday;
                        sc = "sc-holiday";
                      } else if (isSunday) {
                        statusText = "Sunday";
                        sc = "sc-sunday";
                      } else if (leave) {
                        statusText = leave.leaveType || "Leave";
                        sc = "sc-grace";
                      } else if (att) {
                        statusText = att.attendanceStatus || "Present";
                        sc = statusClass(statusText);
                      } else if (dObj > new Date()) {
                        statusText = "—";
                        sc = "sc-unknown";
                      }

                      const hasScans = att && (att.morningIn !== '--:--' || att.eveningOut !== '--:--' || att.lunchIn !== '--:--' || att.lunchOut !== '--:--');
                      const locName = att ? (att.morningInCity || att.eveningOutCity || att.officeName || "") : "";

                      return (
                        <div
                          key={fullDate}
                          className={`calendar-day-cell ${isTodayCell ? 'is-today-cell' : ''}`}
                          onClick={() => setSelectedDayDetail({
                            date: fullDate,
                            log: att ? {
                              Name: selectedEmpProfile.empName,
                              'Emp ID': selectedEmpProfile.empCode,
                              'Morning In': att.morningIn || '-',
                              'Lunch Out': att.lunchOut || '-',
                              'Lunch In': att.lunchIn || '-',
                              'Evening Out': att.eveningOut || '-',
                              date: fullDate,
                              lateMinutes: String(att.totalLate || 0),
                              morningLateMinutes: att.morningLate || 0,
                              lunchLateMinutes: att.lunchLate || 0,
                              totalLateMinutes: att.totalLate || 0,
                              graceType: att.graceType || '',
                              attendanceStatus: att.attendanceStatus || statusText,
                              officeName: att.officeName || '',
                              morningInCity: att.morningInCity,
                              lunchOutCity: att.lunchOutCity,
                              lunchInCity: att.lunchInCity,
                              eveningOutCity: att.eveningOutCity,
                              morningInLat: att.morningInLat,
                              morningInLng: att.morningInLng,
                              eveningOutLat: att.eveningOutLat,
                              eveningOutLng: att.eveningOutLng,
                              morningInPhoto: att.morningInPhoto,
                              lunchOutPhoto: att.lunchOutPhoto,
                              lunchInPhoto: att.lunchInPhoto,
                              eveningOutPhoto: att.eveningOutPhoto,
                              permissionOutPhoto: att.permissionOutPhoto,
                              permissionInPhoto: att.permissionInPhoto,
                            } : undefined,
                            status: statusText,
                            holidayRemark: holiday,
                            leaveInfo: leave,
                            empName: selectedEmpProfile.empName,
                            empCode: selectedEmpProfile.empCode
                          })}
                        >
                          <div className="cell-top-row">
                            <span className="cell-day-num">{day}</span>
                            <span className={`cell-status-badge ${sc}`} title={statusText}>
                              {shortStatus(statusText)}
                            </span>
                          </div>

                          {hasScans ? (
                            <div className="cell-scans-summary">
                              {att.morningIn && att.morningIn !== '--:--' && (
                                <div className="cell-scan-mini" style={{ color: '#6366f1' }}>
                                  <span>M-IN:</span> <span>{cleanTime(att.morningIn)}</span>
                                </div>
                              )}
                              {att.eveningOut && att.eveningOut !== '--:--' && (
                                <div className="cell-scan-mini" style={{ color: '#f43f5e' }}>
                                  <span>E-OUT:</span> <span>{cleanTime(att.eveningOut)}</span>
                                </div>
                              )}
                              {locName && (
                                <div className="cell-location-chip" title={locName}>
                                  📍 {locName}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ fontSize: '9px', color: '#94a3b8', fontStyle: 'italic', marginTop: 'auto' }}>
                              {isSunday || holiday ? shortStatus(statusText) : 'No scans'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (

                /* TABLE LIST VIEW */
                <div className="card-panel" style={{ padding: '0', overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                          <th style={{ padding: '12px 16px' }}>Date</th>
                          <th style={{ padding: '12px 16px' }}>Status</th>
                          <th style={{ padding: '12px 16px' }}>M-In</th>
                          <th style={{ padding: '12px 16px' }}>L-Out</th>
                          <th style={{ padding: '12px 16px' }}>L-In</th>
                          <th style={{ padding: '12px 16px' }}>E-Out</th>
                          <th style={{ padding: '12px 16px' }}>Location</th>
                          <th style={{ padding: '12px 16px' }}>Late</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: daysInSelectedMonth }).map((_, idx) => {
                          const day = idx + 1;
                          const dayStr = String(day).padStart(2, '0');
                          const mStr = String(selectedMonth).padStart(2, '0');
                          const fullDate = `${selectedYear}-${mStr}-${dayStr}`;
                          const dateKey = `${selectedEmpCode}_${fullDate}`;

                          const att = monthlyMatrix[dateKey];
                          const leave = monthlyLeaves[dateKey];
                          const holiday = monthlyHolidays[fullDate];

                          const dObj = new Date(selectedYear, selectedMonth - 1, day);
                          const isSunday = dObj.getDay() === 0;

                          let statusText = "Absent";
                          let sc = "sc-absent";

                          if (holiday) { statusText = holiday; sc = "sc-holiday"; }
                          else if (isSunday) { statusText = "Sunday"; sc = "sc-sunday"; }
                          else if (leave) { statusText = leave.leaveType || "Leave"; sc = "sc-grace"; }
                          else if (att) { statusText = att.attendanceStatus || "Present"; sc = statusClass(statusText); }

                          const loc = att ? (att.morningInCity || att.eveningOutCity || att.officeName || "-") : "-";

                          return (
                            <tr key={fullDate} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 16px', fontWeight: 700 }}>{fullDate}</td>
                              <td style={{ padding: '10px 16px' }}>
                                <span className={`status-badge ${sc}`}>{statusText}</span>
                              </td>
                              <td style={{ padding: '10px 16px', color: att?.morningIn !== '--:--' ? '#6366f1' : '#cbd5e1', fontWeight: 800 }}>
                                {cleanTime(att?.morningIn)}
                              </td>
                              <td style={{ padding: '10px 16px', color: att?.lunchOut !== '--:--' ? '#f59e0b' : '#cbd5e1', fontWeight: 800 }}>
                                {cleanTime(att?.lunchOut)}
                              </td>
                              <td style={{ padding: '10px 16px', color: att?.lunchIn !== '--:--' ? '#10b981' : '#cbd5e1', fontWeight: 800 }}>
                                {cleanTime(att?.lunchIn)}
                              </td>
                              <td style={{ padding: '10px 16px', color: att?.eveningOut !== '--:--' ? '#f43f5e' : '#cbd5e1', fontWeight: 800 }}>
                                {cleanTime(att?.eveningOut)}
                              </td>
                              <td style={{ padding: '10px 16px', color: '#475569', fontWeight: 600 }}>
                                {loc !== "-" ? `📍 ${loc}` : "-"}
                              </td>
                              <td style={{ padding: '10px 16px', fontWeight: 800, color: att?.totalLate > 0 ? '#ef4444' : '#64748b' }}>
                                {att?.totalLate ? `${att.totalLate}m` : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          ) : (

            /* ════════════════════════════════════════════════════
               DAILY VIEW TAB
            ════════════════════════════════════════════════════ */
            loading ? (
              <div className="loader-block">
                <IonSpinner name="crescent" color="primary" />
                <p>Fetching attendance records…</p>
              </div>
            ) : effectiveMode === "user" ? (

              <div className="user-console-wrapper">

                {/* DATE NAVIGATOR */}
                <div className="date-search-row" style={{ justifyContent: 'center' }}>
                  <div className="date-nav-pill">
                    <button className="dnav-arrow" onClick={() => shiftDay(-1)}>
                      <IonIcon icon={chevronBackOutline} />
                    </button>

                    <div className="dnav-center" onClick={() => dateInputRef.current?.showPicker?.()}>
                      <IonIcon icon={calendarOutline} className="dnav-cal-icon" style={{ color: 'var(--ion-color-primary)' }} />
                      <div className="dnav-text">
                        <span className="dnav-label">{displayLabel(selectedDate)}</span>
                        <span className="dnav-sub">{selectedDate}</span>
                      </div>
                      <input
                        ref={dateInputRef}
                        type="date"
                        className="hidden-date-input"
                        style={{ display: 'none' }}
                        value={selectedDate}
                        max={todayStr()}
                        onChange={e => e.target.value && setSelectedDate(e.target.value)}
                      />
                    </div>

                    <button className="dnav-arrow" onClick={() => shiftDay(1)} disabled={isToday}>
                      <IonIcon icon={chevronForwardOutline} />
                    </button>

                    {!isToday && (
                      <button className="today-btn" onClick={() => setSelectedDate(todayStr())}>
                        Today
                      </button>
                    )}
                  </div>
                </div>

                {/* SELECTED DAY SUMMARY CARD */}
                {(() => {
                  const selectedLog: AttendanceRecord = userLogs.find(l => l.date === selectedDate) || {
                    Name: currentUser?.empName || currentUser?.EmpName || "Employee",
                    'Emp ID': loggedInId,
                    'Morning In': '-', 'Lunch Out': '-', 'Lunch In': '-', 'Evening Out': '-',
                    date: selectedDate, lateMinutes: '0', morningLateMinutes: '0', lunchLateMinutes: '0', totalLateMinutes: '0', graceType: '', attendanceStatus: ''
                  };
                  const absent = SLOTS.every(s => selectedLog[s.key] === '-');
                  const checkedInScans = SLOTS.filter(s => selectedLog[s.key] && selectedLog[s.key] !== '-').length;
                  const status = selectedLog.attendanceStatus || (absent ? "Absent" : "Present");
                  const sc = statusClass(status);
                  const latestPhoto = selectedLog.morningInPhoto || selectedLog.lunchInPhoto || selectedLog.lunchOutPhoto || selectedLog.eveningOutPhoto;

                  return (
                    <div className={`stock-panel ${sc} animate-fade-in`} style={{ marginBottom: '24px', borderLeft: '6px solid', borderRadius: '16px' }}>
                      <div className="emp-card-head" style={{ marginBottom: '18px' }}>
                        <div
                          className={`emp-avatar-circle ${latestPhoto ? 'emp-avatar-has-photo' : ''}`}
                          style={{
                            background: 'linear-gradient(145deg, var(--ion-color-primary, #0d9488) 0%, #a855f7 100%)',
                            boxShadow: `0 6px 20px rgba(13,148,136,0.25)`,
                            width: '48px', height: '48px', fontSize: '16px',
                            cursor: latestPhoto ? 'pointer' : 'default'
                          }}
                          onClick={() => latestPhoto && openPhotoModal(selectedLog, 'Live Check-In Snapshot', latestPhoto, 'var(--ion-color-primary, #0d9488)')}
                          title={latestPhoto ? "Click to enlarge captured scan photo" : undefined}
                        >
                          {latestPhoto && (
                            <img
                              src={getFullPhotoUrl(latestPhoto)}
                              alt="Avatar"
                              className="emp-avatar-img"
                              onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                            />
                          )}
                          <span className="emp-avatar-fallback">
                            {getInitials(selectedLog.Name || currentUser?.empName || currentUser?.EmpName || "E")}
                          </span>
                          {latestPhoto && <span className="emp-avatar-cam-badge">📷</span>}
                        </div>
                        <div className="emp-meta">
                          <div className="emp-name-text" style={{ fontSize: '16px' }}>{selectedLog.Name || currentUser?.empName || currentUser?.EmpName}</div>
                          <div className="emp-id-text" style={{ fontSize: '11px' }}>Employee ID: #{loggedInId}</div>
                        </div>
                        <div className="emp-card-right">
                          <div className={`status-badge ${sc}`} style={{ fontSize: '11px', padding: '4px 12px' }}>
                            {status}
                          </div>
                          <div className="checkin-count" style={{ fontSize: '10px', marginTop: '4px' }}>
                            {checkedInScans}/4 Scans
                          </div>
                        </div>
                      </div>

                      {/* Timeline */}
                      <div className="att-timeline" style={{ padding: '8px 0' }}>
                        {SLOTS.map((s, si) => {
                          const val = selectedLog[s.key];
                          const filled = val && val !== '-';
                          const isLast = si === SLOTS.length - 1;
                          const location = getLocationName(s.key, selectedLog);
                          const slotPhoto = s.photoKey ? (selectedLog as any)[s.photoKey] : null;
                          const slotLat = s.latKey ? (selectedLog as any)[s.latKey] : 0;
                          const slotLng = s.lngKey ? (selectedLog as any)[s.lngKey] : 0;

                          return (
                            <div key={s.key} className="att-slot-wrap">
                              <div className="att-slot">
                                {filled && slotPhoto ? (
                                  <div
                                    className="att-node att-node-on att-node-photo"
                                    style={{ borderColor: s.color }}
                                    onClick={() => openPhotoModal(selectedLog, s.label, slotPhoto, s.color, val, location, slotLat, slotLng, selectedLog.attendanceStatus)}
                                    title={`Click to view ${s.label} scan photo`}
                                  >
                                    <img
                                      src={getFullPhotoUrl(slotPhoto)}
                                      alt={s.short}
                                      className="att-slot-photo-thumb"
                                      onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                    />
                                    <span className="att-slot-photo-badge">📷</span>
                                  </div>
                                ) : (
                                  <div
                                    className={`att-node ${filled ? 'att-node-on' : 'att-node-off'}`}
                                    style={filled ? { background: s.color, borderColor: s.color } as any : {}}
                                  >
                                    {filled ? '✓' : ''}
                                  </div>
                                )}
                                <div
                                  className="att-time-text"
                                  style={filled ? { color: s.color, fontWeight: 800 } as any : {}}
                                >
                                  {cleanTime(val)}
                                </div>
                                <div className="att-slot-key">{s.short}</div>
                                {filled && location && (
                                  <div className="cell-location-chip" title={location} style={{ marginTop: '4px' }}>
                                    📍 {location}
                                  </div>
                                )}
                              </div>
                              {!isLast && (
                                <div
                                  className="att-connector"
                                  style={filled ? { background: s.color, opacity: 0.35 } as any : {}}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Details footer */}
                      {(() => {
                        const mLate = parseInt(String(selectedLog.morningLateMinutes || selectedLog.lateMinutes || '0'), 10) || 0;
                        const lLate = parseInt(String(selectedLog.lunchLateMinutes || '0'), 10) || 0;
                        let tLate = parseInt(String(selectedLog.totalLateMinutes || '0'), 10) || 0;
                        if (tLate === 0) tLate = mLate + lLate;

                        if (mLate === 0 && lLate === 0 && tLate === 0 && (!selectedLog.graceType || selectedLog.graceType === '-')) {
                          return null;
                        }

                        return (
                          <div className="emp-late-bar" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span className="late-icon">⏱</span>
                            <span className="late-text">
                              Morning: <strong>{mLate}m</strong>
                              {lLate > 0 && <> | Lunch: <strong>{lLate}m</strong></>}
                              <> | Total: <strong>{tLate}m</strong></>
                            </span>
                            {selectedLog.graceType && selectedLog.graceType !== '-' && (
                              <span className={`grace-chip ${sc}`}>{selectedLog.graceType}</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* 7-DAY RECENT HISTORY LIST */}
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', marginBottom: '12px', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '4px', height: '14px', borderRadius: '2px', background: 'var(--ion-color-primary, #0d9488)', display: 'inline-block' }}></span>
                  Recent History (7 Days)
                </h3>

                <div className="timeline-container">
                  {userLogs.map(log => {
                    const absent = SLOTS.every(s => log[s.key] === '-');
                    const isCurrent = log.date === selectedDate;
                    const status = log.attendanceStatus || (absent ? "Absent" : "Present");
                    const sc = statusClass(status);

                    return (
                      <div
                        key={log.date}
                        className={`timeline-item card-panel animate-fade-in ${isCurrent ? 'active-history-item' : ''}`}
                        onClick={() => log.date && setSelectedDate(log.date)}
                        style={{
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          border: isCurrent ? '1.5px solid var(--ion-color-primary, #0d9488)' : '1px solid #e2e8f0',
                        }}
                      >
                        <div className="timeline-date-header">
                          <div className="date-pill" style={{ background: isCurrent ? 'var(--ion-color-primary, #0d9488)' : '#eff6ff', color: isCurrent ? '#ffffff' : '#2563eb', border: isCurrent ? '1px solid var(--ion-color-primary, #0d9488)' : '1px solid #bfdbfe' }}>
                            <IonIcon icon={calendarOutline} />
                            <span>{displayLabel(log.date || '')}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={`status-badge ${sc}`} style={{ fontSize: '9px', padding: '2px 8px' }}>
                              {status}
                            </span>
                            <span className="date-sub">{log.date}</span>
                          </div>
                        </div>

                        {absent ? (
                          <div className="absent-state">
                            <IonIcon icon={closeCircleOutline} className="absent-icon" />
                            <span>No logs recorded</span>
                          </div>
                        ) : (
                          <div className="timeline-grid">
                            {SLOTS.map(({ key, short, color }) => {
                              const val = log[key];
                              const filled = val && val !== '-';
                              const location = getLocationName(key, log);

                              return (
                                <div
                                  key={key}
                                  className={`timeline-slot-card ${filled ? 'filled' : 'empty'}`}
                                >
                                  <span className="timeline-slot-label">{short}</span>
                                  <span
                                    className="timeline-slot-time"
                                    style={{ color: filled ? color : '#94a3b8' }}
                                  >
                                    {filled ? cleanTime(val) : '--:--'}
                                  </span>
                                  {filled && location && (
                                    <span className="timeline-slot-loc" title={location}>
                                      📍 {location}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>

            ) : (

              /* ════════════════════════════════════════
                 SECURITY — ATTENDANCE BOARD
              ════════════════════════════════════════ */
              <div className="security-console-wrapper" style={{ position: 'relative', zIndex: 1 }}>

                {/* STATS STRIP */}
                <div className="console-stats-grid">
                  {([
                    { label: 'TOTAL', count: totalV, cls: 'stat-total', icon: personOutline },
                    { label: 'MORNING IN', count: mornV, cls: 'stat-morning', icon: checkmarkCircleOutline },
                    { label: 'LUNCH', count: lunchV, cls: 'stat-break', icon: timeOutline },
                    { label: 'SHIFT END', count: eveningV, cls: 'stat-evening', icon: closeCircleOutline },
                  ] as const).map(({ label, count, cls, icon }) => (
                    <div key={label} className={`stock-panel ${cls}`} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', borderRadius: '16px' }}>
                      <div className="stat-icon-wrapper"><IonIcon icon={icon} /></div>
                      <div className="stat-info">
                        <span className="stat-num">{count}</span>
                        <span className="stat-title">{label}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* DATE NAV + SEARCH ROW */}
                <div className="date-search-row">

                  {/* Date navigator */}
                  <div className="date-nav-pill">
                    <button className="dnav-arrow" onClick={() => shiftDay(-1)}>
                      <IonIcon icon={chevronBackOutline} />
                    </button>

                    <div className="dnav-center" onClick={() => dateInputRef.current?.showPicker?.()}>
                      <IonIcon icon={calendarOutline} className="dnav-cal-icon" />
                      <div className="dnav-text">
                        <span className="dnav-label">{displayLabel(selectedDate)}</span>
                        <span className="dnav-sub">{selectedDate}</span>
                      </div>
                      <input
                        ref={dateInputRef}
                        type="date"
                        className="hidden-date-input"
                        style={{ display: 'none' }}
                        value={selectedDate}
                        max={todayStr()}
                        onChange={e => e.target.value && setSelectedDate(e.target.value)}
                      />
                    </div>

                    <button className="dnav-arrow" onClick={() => shiftDay(1)} disabled={isToday}>
                      <IonIcon icon={chevronForwardOutline} />
                    </button>

                    {!isToday && (
                      <button className="today-btn" onClick={() => setSelectedDate(todayStr())}>
                        Today
                      </button>
                    )}
                  </div>

                  {/* Search */}
                  <div className="stock-input" style={{ flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', gap: '10px', background: '#fff' }}>
                    <IonIcon icon={searchOutline} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Name or Emp ID…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="search-input"
                    />
                    {searchQuery && (
                      <button className="search-clear-btn" onClick={() => setSearchQuery("")}>✕</button>
                    )}
                  </div>
                </div>

                {/* RESULTS META */}
                <div className="results-meta">
                  <span className="results-count">
                    <strong>{filtered.length}</strong> record{filtered.length !== 1 ? 's' : ''}
                  </span>
                  {searchQuery && <span className="results-query">matching "{searchQuery}"</span>}
                </div>

                {/* EMPLOYEE CARDS */}
                {filtered.length === 0 ? (
                  <div className="empty-state-block">
                    <div className="empty-emoji">🔍</div>
                    <p className="empty-title">No records found</p>
                    <p className="empty-sub">
                      {searchQuery ? `No match for "${searchQuery}"` : `No attendance data for ${selectedDate}`}
                    </p>
                  </div>
                ) : (
                  <div className="emp-cards-grid">
                    {filtered.map((log, idx) => {
                      const sc = statusClass(log.attendanceStatus);
                      const cfg = avatarCfg(log.Name);
                      const inits = getInitials(log.Name);
                      const checkedIn = SLOTS.filter(s => log[s.key] && log[s.key] !== '-').length;
                      const latestPhoto = log.morningInPhoto || log.lunchInPhoto || log.lunchOutPhoto || log.eveningOutPhoto;

                      return (
                        <div key={idx} className={`stock-panel ${sc} animate-fade-in`} style={{ borderLeft: '6px solid', borderRadius: '16px' }}>

                          <div className="emp-card-head">
                            <div
                              className={`emp-avatar-circle ${latestPhoto ? 'emp-avatar-has-photo' : ''}`}
                              style={{
                                background: cfg.grad,
                                boxShadow: `0 6px 20px ${cfg.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.67)`,
                                cursor: latestPhoto ? 'pointer' : 'default'
                              }}
                              onClick={() => latestPhoto && openPhotoModal(log, 'Live Check-In Snapshot', latestPhoto, '#4f46e5')}
                              title={latestPhoto ? "Click to enlarge captured scan photo" : undefined}
                            >
                              {latestPhoto && (
                                <img
                                  src={getFullPhotoUrl(latestPhoto)}
                                  alt={log.Name}
                                  className="emp-avatar-img"
                                  onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                />
                              )}
                              <span className="emp-avatar-fallback">{inits}</span>
                              {latestPhoto && <span className="emp-avatar-cam-badge">📷</span>}
                            </div>
                            <div className="emp-meta">
                              <div className="emp-name-text">{log.Name}</div>
                              <div className="emp-id-text">#{log['Emp ID']}</div>
                            </div>
                            <div className="emp-card-right">
                              <div className={`status-badge ${sc}`}>
                                {log.attendanceStatus || '—'}
                              </div>
                              <div className="checkin-count">
                                {checkedIn}/4 scans
                              </div>
                            </div>
                          </div>

                          <div className="att-timeline">
                            {SLOTS.map((s, si) => {
                              const val = log[s.key];
                              const filled = val && val !== '-';
                              const isLast = si === SLOTS.length - 1;
                              const location = getLocationName(s.key, log);
                              const slotPhoto = s.photoKey ? (log as any)[s.photoKey] : null;
                              const slotLat = s.latKey ? (log as any)[s.latKey] : 0;
                              const slotLng = s.lngKey ? (log as any)[s.lngKey] : 0;

                              return (
                                <div key={s.key} className="att-slot-wrap">
                                  <div className="att-slot" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    {filled && slotPhoto ? (
                                      <div
                                        className="att-node att-node-on att-node-photo"
                                        style={{ borderColor: s.color }}
                                        onClick={() => openPhotoModal(log, s.label, slotPhoto, s.color, val, location, slotLat, slotLng, log.attendanceStatus)}
                                        title={`Click to view ${s.label} scan photo`}
                                      >
                                        <img
                                          src={getFullPhotoUrl(slotPhoto)}
                                          alt={s.short}
                                          className="att-slot-photo-thumb"
                                          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                                        />
                                        <span className="att-slot-photo-badge">📷</span>
                                      </div>
                                    ) : (
                                      <div
                                        className={`att-node ${filled ? 'att-node-on' : 'att-node-off'}`}
                                        style={filled ? { background: s.color, borderColor: s.color } as any : {}}
                                      >
                                        {filled ? '✓' : ''}
                                      </div>
                                    )}
                                    <div
                                      className="att-time-text"
                                      style={filled ? { color: s.color, fontWeight: 800 } as any : {}}
                                    >
                                      {cleanTime(val)}
                                    </div>
                                    <div className="att-slot-key">{s.short}</div>
                                    {filled && location && (
                                      <div style={{ fontSize: '8px', fontWeight: 600, color: '#64748b', marginTop: '2px', textAlign: 'center', maxWidth: '80px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={location}>
                                        📍 {location}
                                      </div>
                                    )}
                                  </div>
                                  {!isLast && (
                                    <div
                                      className="att-connector"
                                      style={filled ? { background: s.color, opacity: 0.35 } as any : {}}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* LATE FOOTER */}
                          {(() => {
                            const mLate = parseInt(String(log.morningLateMinutes || log.lateMinutes || '0'), 10) || 0;
                            const lLate = parseInt(String(log.lunchLateMinutes || '0'), 10) || 0;
                            let tLate = parseInt(String(log.totalLateMinutes || '0'), 10) || 0;
                            if (tLate === 0) tLate = mLate + lLate;

                            if (mLate === 0 && lLate === 0 && tLate === 0 && (!log.graceType || log.graceType === '-')) {
                              return null;
                            }

                            return (
                              <div className="emp-late-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                                <span className="late-icon">⏱</span>
                                <span className="late-text">
                                  Morning: <strong>{mLate}m</strong>
                                  {lLate > 0 && <> | Lunch: <strong>{lLate}m</strong></>}
                                  <> | Total: <strong>{tLate}m</strong></>
                                </span>
                                {log.graceType && log.graceType !== '-' && (
                                  <span className={`grace-chip ${sc}`}>{log.graceType}</span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* ════════════════════════════════════════════════════
           DAY DETAIL MODAL POPUP
        ════════════════════════════════════════════════════ */}
        {selectedDayDetail && (
          <div className="modal-backdrop-custom" onClick={() => setSelectedDayDetail(null)}>
            <div className="modal-dialog-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-row">
                <div>
                  <div className="modal-title-text">
                    📅 {selectedDayDetail.date}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginTop: '2px' }}>
                    {selectedDayDetail.empName ? `${selectedDayDetail.empName} (#${selectedDayDetail.empCode})` : 'Attendance Breakdown'}
                  </div>
                </div>
                <button className="modal-close-icon" onClick={() => setSelectedDayDetail(null)}>✕</button>
              </div>

              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className={`status-badge ${statusClass(selectedDayDetail.status)}`} style={{ fontSize: '11px', padding: '6px 14px' }}>
                  {selectedDayDetail.status}
                </span>
                {selectedDayDetail.holidayRemark && (
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#4338ca' }}>
                    🌴 {selectedDayDetail.holidayRemark}
                  </span>
                )}
              </div>

              {selectedDayDetail.log ? (
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', marginBottom: '10px' }}>Scan Locations & Timing</h4>

                  {SLOTS.map((s) => {
                    const val = selectedDayDetail.log![s.key];
                    const filled = val && val !== '-';
                    const loc = getLocationName(s.key, selectedDayDetail.log);
                    const slotPhoto = s.photoKey ? (selectedDayDetail.log as any)[s.photoKey] : null;

                    let lat = 0, lng = 0;
                    if (s.key === 'Morning In') { lat = selectedDayDetail.log?.morningInLat || 0; lng = selectedDayDetail.log?.morningInLng || 0; }
                    else if (s.key === 'Lunch Out') { lat = selectedDayDetail.log?.lunchOutLat || 0; lng = selectedDayDetail.log?.lunchOutLng || 0; }
                    else if (s.key === 'Lunch In') { lat = selectedDayDetail.log?.lunchInLat || 0; lng = selectedDayDetail.log?.lunchInLng || 0; }
                    else if (s.key === 'Evening Out') { lat = selectedDayDetail.log?.eveningOutLat || 0; lng = selectedDayDetail.log?.eveningOutLng || 0; }

                    return (
                      <div key={s.key} className="modal-slot-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: '12px', marginBottom: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {filled && slotPhoto ? (
                            <div
                              className="att-node att-node-on att-node-photo"
                              style={{ width: '40px', height: '40px', borderColor: s.color, cursor: 'pointer', flexShrink: 0 }}
                              onClick={() => openPhotoModal(selectedDayDetail.log, s.label, slotPhoto, s.color, val, loc, lat, lng, selectedDayDetail.log?.attendanceStatus)}
                              title={`View ${s.label} scan photo`}
                            >
                              <img
                                src={getFullPhotoUrl(slotPhoto)}
                                alt={s.short}
                                className="att-slot-photo-thumb"
                                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                              />
                              <span className="att-slot-photo-badge">📷</span>
                            </div>
                          ) : (
                            <div
                              className={`att-node ${filled ? 'att-node-on' : 'att-node-off'}`}
                              style={{ width: '32px', height: '32px', fontSize: '12px', ...(filled ? { background: s.color, borderColor: s.color } : {}) }}
                            >
                              {filled ? '✓' : ''}
                            </div>
                          )}

                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 800, color: s.color, textTransform: uppercase }}>
                              {s.key}
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: 800, color: filled ? '#0f172a' : '#94a3b8', marginTop: '2px' }}>
                              {cleanTime(val)}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          {filled && loc ? (
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                                <IonIcon icon={locationOutline} style={{ color: varPrimary }} />
                                {loc}
                              </div>
                              {lat !== 0 && lng !== 0 && (
                                <a
                                  href={`https://maps.google.com/?q=${lat},${lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontSize: '10px', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                                >
                                  View on Map ({lat.toFixed(4)}, {lng.toFixed(4)})
                                </a>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>No location recorded</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Late minutes breakdown */}
                  {parseInt(String(selectedDayDetail.log.totalLateMinutes || '0')) > 0 && (
                    <div style={{ marginTop: '16px', background: '#fff1f2', border: '1px solid #fecdd3', padding: '12px 14px', borderRadius: '12px', color: '#991b1b', fontSize: '12px', fontWeight: 700 }}>
                      ⏱ Total Late: <strong>{selectedDayDetail.log.totalLateMinutes} minutes</strong>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                  No check-in/check-out logs recorded for this date.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
           HIGH-RESOLUTION ATTENDANCE PHOTO ZOOM MODAL
        ════════════════════════════════════════════════════ */}
        {photoModal && (
          <div className="photo-preview-backdrop" onClick={() => setPhotoModal(null)}>
            <div className="photo-preview-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="photo-preview-header">
                <div>
                  <div className="photo-preview-badge-slot" style={{ background: photoModal.slotColor || '#4f46e5' }}>
                    {photoModal.slotLabel}
                  </div>
                  <h3 className="photo-preview-emp-name">{photoModal.empName}</h3>
                  <div className="photo-preview-emp-code">Employee Code: #{photoModal.empId}</div>
                </div>
                <button className="modal-close-icon" onClick={() => setPhotoModal(null)}>✕</button>
              </div>

              <div className="photo-preview-body">
                <div className="photo-preview-img-container">
                  <img
                    src={getFullPhotoUrl(photoModal.photoUrl)}
                    alt={`${photoModal.empName} scan`}
                    className="photo-preview-big-img"
                  />
                  <div className="photo-preview-overlay-tag">
                    📸 Live Face Punch Verified
                  </div>
                </div>

                <div className="photo-preview-meta-grid">
                  <div className="photo-meta-card">
                    <span className="meta-card-label">Punch Time</span>
                    <span className="meta-card-value" style={{ color: photoModal.slotColor || '#1e293b' }}>
                      ⏱ {cleanTime(photoModal.time)}
                    </span>
                  </div>

                  <div className="photo-meta-card">
                    <span className="meta-card-label">Status</span>
                    <span className="meta-card-value">
                      {photoModal.status || 'Verified'}
                    </span>
                  </div>

                  <div className="photo-meta-card" style={{ gridColumn: '1 / -1' }}>
                    <span className="meta-card-label">Location / Geo Proof</span>
                    <div className="meta-location-box">
                      <span>📍 {photoModal.location || 'Office Premises'}</span>
                      {photoModal.lat !== 0 && photoModal.lng !== 0 && (
                        <a
                          href={`https://maps.google.com/?q=${photoModal.lat},${photoModal.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="photo-maps-link"
                        >
                          🌐 Open in Google Maps ({photoModal.lat?.toFixed(4)}, {photoModal.lng?.toFixed(4)})
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="photo-preview-footer">
                <button className="photo-preview-close-btn" onClick={() => setPhotoModal(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </IonContent>
    </IonPage>
  );
};

const uppercase = 'uppercase' as const;
const varPrimary = 'var(--ion-color-primary, #0d9488)';

export default AIAttendanceLog;
