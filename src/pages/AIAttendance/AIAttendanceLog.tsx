import { IonContent, IonPage, IonIcon, IonSpinner } from "@ionic/react";
import {
  arrowBackOutline, calendarOutline, searchOutline,
  personOutline, timeOutline, checkmarkCircleOutline,
  closeCircleOutline, refreshOutline, chevronBackOutline,
  chevronForwardOutline, documentTextOutline
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
  { key: 'Morning In' as const, short: 'M-IN', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  { key: 'Lunch Out' as const, short: 'L-OUT', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  { key: 'Lunch In' as const, short: 'L-IN', color: '#10b981', bg: '#f0fdf4', border: '#a7f3d0' },
  { key: 'Evening Out' as const, short: 'E-OUT', color: '#f43f5e', bg: '#fff1f2', border: '#fecdd3' },
];

const AIAttendanceLog: React.FC = () => {
  const { mode } = useParams<{ mode: string }>();
  const [selectedBranch, setSelectedBranch] = useState("ALL");
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [branches, setBranches] = useState<string[]>(["ALL"]);

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

  // Security console (all employees' logs) is ONLY accessible by ADMIN_IDS.
  // All regular employees strictly view their own personal attendance logs.
  const effectiveMode = isAdmin ? (mode === "user" ? "user" : "security") : "user";
  const history = useHistory();
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [userLogs, setUserLogs] = useState<AttendanceRecord[]>([]);
  const [securityLogs, setSecurityLogs] = useState<AttendanceRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => todayStr());
  const [companyHolidays, setCompanyHolidays] = useState<{ date: string; remark: string }[]>([]);

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

  /* ── initial user load ── */
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) { try { setCurrentUser(JSON.parse(stored)); } catch { } }
  }, []);

  /* ── load branches dynamically ── */
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

  /* ── re-fetch when mode or date changes ── */
  useEffect(() => {
    fetchLogs(true);
  }, [effectiveMode, selectedDate, selectedBranch]);

  /* ── auto-sync in security mode (only when viewing today) ── */
  useEffect(() => {
    if (effectiveMode !== "security" || !isToday) return;
    const iv = setInterval(() => {
      setIsSyncing(true);
      fetchLogs(false).finally(() => setIsSyncing(false));
    }, 10000);
    return () => clearInterval(iv);
  }, [effectiveMode, selectedDate, selectedBranch]);

  /* ─────────────────────────────────────────
     FETCH
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
        // Generate 7 days ending at the selected date
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

        const map = (r: any, date: string): AttendanceRecord => {
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
                .map((r: any) => map(r, date));
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
                branch: emp.branch || selectedBranch
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

  /* ── helpers ── */
  function cleanTime(t?: string) {
    if (!t || t === '-') return '--:--';
    if (t.includes('1900-01-01')) { const p = t.split(/[ T]/); return p.length > 1 ? p[1].substring(0, 5) : '--:--'; }
    return t.substring(0, 5);
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

  /* ── stats ── */
  const totalV = securityLogs.length;
  const mornV = securityLogs.filter(l => l['Morning In'] !== '-').length;
  const lunchV = securityLogs.filter(l => l['Lunch Out'] !== '-' || l['Lunch In'] !== '-').length;
  const eveningV = securityLogs.filter(l => l['Evening Out'] !== '-').length;

  const filtered = securityLogs.filter(log => {
    const q = searchQuery.toLowerCase();
    return (log.Name || '').toLowerCase().includes(q) ||
      (log['Emp ID'] || '').toLowerCase().includes(q);
  });

  /* ─────────────────────────────────────────
     RENDER
  ───────────────────────────────────────── */
  return (
    <IonPage className="log-page-container">
      <IonContent fullscreen className="log-page-content" scrollY>

        {/* ── HEADER ── */}
        <div className="log-header">
          <button className="back-btn" onClick={() => history.goBack()}>
            <IonIcon icon={arrowBackOutline} />
          </button>
          <div className="title-area">
            <h1 className="title-text">
              {effectiveMode === "user" ? "MY ATTENDANCE" : "ATTENDANCE RECORDS"}
            </h1>
            <p className="subtitle-text">
              <span className="subtitle-pulse-dot" />
              <span>
                {effectiveMode === "user"
                  ? `${currentUser?.empName || currentUser?.EmpName || "Employee"} — 7-Day Log`
                  : "Live verification console"}
              </span>
            </p>
          </div>
          {effectiveMode === "security" && (
            <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ position: 'relative' }}>
                <button
                  className="branch-btn"
                  onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                  style={{ background: 'var(--ion-color-primary, #0d9488)', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '24px', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(13, 148, 136, 0.2)' }}
                >
                  {selectedBranch}
                  <IonIcon icon={chevronForwardOutline} style={{ transform: showBranchDropdown ? 'rotate(-90deg)' : 'rotate(90deg)', fontSize: '12px', transition: 'transform 0.2s' }} />
                </button>
                {showBranchDropdown && (
                  <div className="branch-dropdown" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#ffffff', borderRadius: '14px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '6px', zIndex: 100, minWidth: '140px', border: '1px solid #e2e8f0' }}>
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
                )}
              </div>

              {/* Leave Report Button */}
              <button
                onClick={() => history.push('/leave-report')}
                style={{
                  background: 'var(--ion-color-primary, #0d9488)',
                  color: '#fff',
                  border: 'none',
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

              {/* HR Monthly Matrix Button */}
              {/* <button
                onClick={() => history.push('/hr-attendance-matrix')}
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '24px',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                  whiteSpace: 'nowrap'
                }}
              >
                <IonIcon icon={calendarOutline} style={{ fontSize: '14px' }} />
                HR Late Matrix
              </button> */}

              <div className="live-sync-indicator">
                <span className={`sync-dot ${isSyncing ? "syncing" : ""}`} />
                <span className="sync-text">{isToday ? (isSyncing ? "SYNC…" : "LIVE") : "HISTORY"}</span>
                <button className="sync-now-btn" onClick={() => fetchLogs(true)}>
                  <IonIcon icon={refreshOutline} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="log-body">
          {loading ? (
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
                      value={selectedDate}
                      max={todayStr()}
                      onChange={e => e.target.value && setSelectedDate(e.target.value)}
                    />
                  </div>

                  <button className="dnav-arrow" onClick={() => shiftDay(1)} disabled={isToday}>
                    <IonIcon icon={chevronForwardOutline} />
                  </button>

                  {!isToday && (
                    <button className="today-btn" onClick={() => setSelectedDate(todayStr())} style={{ background: 'linear-gradient(135deg, var(--ion-color-primary) 0%, #0d9488 100%)' }}>
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
                const late = parseInt(selectedLog.lateMinutes || '0');

                return (
                  <div className={`emp-card ${sc} animate-fade-in`} style={{ marginBottom: '24px', borderLeftWidth: '6px' }}>
                    <div className="emp-card-head" style={{ marginBottom: '18px' }}>
                      <div className="emp-avatar-circle" style={{
                        background: 'linear-gradient(145deg, var(--ion-color-primary) 0%, #a855f7 100%)',
                        boxShadow: `0 6px 20px rgba(99,102,241,0.25)`,
                        width: '48px', height: '48px', fontSize: '16px'
                      }}>
                        {getInitials(selectedLog.Name || currentUser?.empName || currentUser?.EmpName || "E")}
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
                        return (
                          <div key={s.key} className="att-slot-wrap">
                            <div className="att-slot">
                              <div
                                className={`att-node ${filled ? 'att-node-on' : 'att-node-off'}`}
                                style={filled ? { background: s.color, borderColor: s.color } as any : {}}
                              >
                                {filled ? '✓' : ''}
                              </div>
                              <div
                                className="att-time-text"
                                style={filled ? { color: s.color, fontWeight: 800 } as any : {}}
                              >
                                {cleanTime(val)}
                              </div>
                              <div className="att-slot-key">{s.short}</div>
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
                <span style={{ width: '4px', height: '14px', borderRadius: '2px', background: 'var(--ion-color-primary)', display: 'inline-block' }}></span>
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
                        border: isCurrent ? '1.5px solid var(--ion-color-primary)' : '1px solid #e2e8f0',
                        boxShadow: isCurrent ? '0 4px 12px rgba(var(--ion-color-primary-rgb), 0.1)' : '0 2px 8px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div className="timeline-date-header">
                        <div className="date-pill" style={{ background: isCurrent ? 'var(--ion-color-primary)' : '#eff6ff', color: isCurrent ? '#ffffff' : '#2563eb', border: isCurrent ? '1px solid var(--ion-color-primary)' : '1px solid #bfdbfe' }}>
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
                        <div className="timeline-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                          {SLOTS.map(({ key, short, color }) => {
                            const val = log[key];
                            const filled = val && val !== '-';

                            let city = "";
                            let lat = 0;
                            let lng = 0;
                            if (key === 'Morning In') { city = log.morningInCity || ""; lat = log.morningInLat || 0; lng = log.morningInLng || 0; }
                            else if (key === 'Lunch Out') { city = log.lunchOutCity || ""; lat = log.lunchOutLat || 0; lng = log.lunchOutLng || 0; }
                            else if (key === 'Lunch In') { city = log.lunchInCity || ""; lat = log.lunchInLat || 0; lng = log.lunchInLng || 0; }
                            else if (key === 'Evening Out') { city = log.eveningOutCity || ""; lat = log.eveningOutLat || 0; lng = log.eveningOutLng || 0; }

                            return (
                              <div key={key} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '6px',
                                borderRadius: '10px',
                                background: filled ? '#f8fafc' : '#f1f5f9',
                                border: '1px solid #e2e8f0'
                              }}>
                                <span style={{ fontSize: '8px', fontWeight: 800, color: '#94a3b8' }}>{short}</span>
                                <span style={{ fontSize: '11px', fontWeight: 800, color: filled ? color : '#cbd5e1', marginTop: '2px' }}>
                                  {filled ? cleanTime(val) : '--:--'}
                                </span>
                                {filled && city && (
                                  <span style={{ fontSize: '8px', fontWeight: 600, color: '#64748b', marginTop: '2px', textAlign: 'center', wordBreak: 'break-all' }} title={`${city} (${lat}, ${lng})`}>
                                    📍 {city}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {(() => {
                        const mLate = parseInt(String(log.morningLateMinutes || log.lateMinutes || '0'), 10) || 0;
                        const lLate = parseInt(String(log.lunchLateMinutes || '0'), 10) || 0;
                        let tLate = parseInt(String(log.totalLateMinutes || '0'), 10) || 0;
                        if (tLate === 0) tLate = mLate + lLate;

                        if (mLate === 0 && lLate === 0 && tLate === 0 && (!log.graceType || log.graceType === '-')) {
                          return null;
                        }

                        return (
                          <div className="emp-late-bar" style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '4px 8px', borderRadius: '8px' }}>
                            <span className="late-icon">⏱</span>
                            <span className="late-text" style={{ fontSize: '10px' }}>
                              Morning: <strong>{mLate}m</strong>
                              {lLate > 0 && <> | Lunch: <strong>{lLate}m</strong></>}
                              <> | Total: <strong>{tLate}m</strong></>
                            </span>
                            {log.graceType && log.graceType !== '-' && (
                              <span className={`grace-chip ${sc}`} style={{ fontSize: '9px' }}>{log.graceType}</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>

            </div>

          ) : (

            /* ════════════════════════════════════════
               SECURITY — ATTENDANCE BOARD
            ════════════════════════════════════════ */
            <div className="security-console-wrapper">

              {/* STATS STRIP */}
              <div className="console-stats-grid">
                {([
                  { label: 'TOTAL', count: totalV, cls: 'stat-total', icon: personOutline },
                  { label: 'MORNING IN', count: mornV, cls: 'stat-morning', icon: checkmarkCircleOutline },
                  { label: 'LUNCH', count: lunchV, cls: 'stat-break', icon: timeOutline },
                  { label: 'SHIFT END', count: eveningV, cls: 'stat-evening', icon: closeCircleOutline },
                ] as const).map(({ label, count, cls, icon }) => (
                  <div key={label} className={`stat-widget-card ${cls}`}>
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
                    {/* Hidden native date picker */}
                    <input
                      ref={dateInputRef}
                      type="date"
                      className="hidden-date-input"
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
                <div className="search-pill">
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

              {/* META ROW */}
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
                    const late = parseInt(log.lateMinutes || '0');
                    const checkedIn = SLOTS.filter(s => log[s.key] && log[s.key] !== '-').length;

                    return (
                      <div key={idx} className={`emp-card ${sc} animate-fade-in`}>

                        {/* ── CARD HEADER ── */}
                        <div className="emp-card-head">
                          <div className="emp-avatar-circle" style={{
                            background: cfg.grad,
                            boxShadow: `0 6px 20px ${cfg.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.67)`,
                          }}>
                            {inits}
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

                        {/* ── ATTENDANCE TIMELINE ── */}
                        <div className="att-timeline">
                          {SLOTS.map((s, si) => {
                            const val = log[s.key];
                            const filled = val && val !== '-';
                            const isLast = si === SLOTS.length - 1;

                            let city = "";
                            let lat = 0;
                            let lng = 0;
                            if (s.key === 'Morning In') { city = log.morningInCity || ""; lat = log.morningInLat || 0; lng = log.morningInLng || 0; }
                            else if (s.key === 'Lunch Out') { city = log.lunchOutCity || ""; lat = log.lunchOutLat || 0; lng = log.lunchOutLng || 0; }
                            else if (s.key === 'Lunch In') { city = log.lunchInCity || ""; lat = log.lunchInLat || 0; lng = log.lunchInLng || 0; }
                            else if (s.key === 'Evening Out') { city = log.eveningOutCity || ""; lat = log.eveningOutLat || 0; lng = log.eveningOutLng || 0; }

                            return (
                              <div key={s.key} className="att-slot-wrap">
                                <div className="att-slot" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <div
                                    className={`att-node ${filled ? 'att-node-on' : 'att-node-off'}`}
                                    style={filled ? { background: s.color, borderColor: s.color } as any : {}}
                                  >
                                    {filled ? '✓' : ''}
                                  </div>
                                  <div
                                    className="att-time-text"
                                    style={filled ? { color: s.color, fontWeight: 800 } as any : {}}
                                  >
                                    {cleanTime(val)}
                                  </div>
                                  <div className="att-slot-key">{s.short}</div>
                                  {filled && city && (
                                    <div style={{ fontSize: '8px', fontWeight: 600, color: '#64748b', marginTop: '2px', textAlign: 'center', maxWidth: '80px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={`${city} (${lat}, ${lng})`}>
                                      📍 {city}
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

                        {/* ── LATE FOOTER ── */}
                        {(() => {
                          const mLate = parseInt(String(log.morningLateMinutes || log.lateMinutes || '0'), 10) || 0;
                          const lLate = parseInt(String(log.lunchLateMinutes || '0'), 10) || 0;
                          let tLate = parseInt(String(log.totalLateMinutes || '0'), 10) || 0;
                          if (tLate === 0) tLate = mLate + lLate;

                          if (mLate === 0 && lLate === 0 && tLate === 0 && (!log.graceType || log.graceType === '-')) {
                            return null;
                          }

                          return (
                            <div className="emp-late-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AIAttendanceLog;
