import { IonContent, IonPage, IonIcon, IonSpinner } from "@ionic/react";
import {
  arrowBackOutline, calendarOutline, searchOutline,
  personOutline, timeOutline, checkmarkCircleOutline,
  closeCircleOutline, refreshOutline, chevronBackOutline,
  chevronForwardOutline
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
  graceType?: string;
  attendanceStatus?: string;
}

const AVATAR_CONFIG = [
  { grad: 'linear-gradient(145deg,#312e81 0%,#4f46e5 45%,#818cf8 100%)', glow: 'rgba(79,70,229,0.50)'  }, // deep indigo
  { grad: 'linear-gradient(145deg,#4c1d95 0%,#7c3aed 45%,#a78bfa 100%)', glow: 'rgba(124,58,237,0.50)' }, // deep violet
  { grad: 'linear-gradient(145deg,#831843 0%,#be185d 45%,#f472b6 100%)', glow: 'rgba(190,24,93,0.50)'  }, // deep pink
  { grad: 'linear-gradient(145deg,#881337 0%,#be123c 45%,#fb7185 100%)', glow: 'rgba(190,18,60,0.50)'  }, // deep rose
  { grad: 'linear-gradient(145deg,#7c2d12 0%,#c2410c 45%,#fb923c 100%)', glow: 'rgba(194,65,12,0.50)'  }, // deep orange
  { grad: 'linear-gradient(145deg,#78350f 0%,#b45309 45%,#fcd34d 100%)', glow: 'rgba(180,83,9,0.50)'   }, // deep amber
  { grad: 'linear-gradient(145deg,#14532d 0%,#15803d 45%,#4ade80 100%)', glow: 'rgba(21,128,61,0.50)'  }, // deep green
  { grad: 'linear-gradient(145deg,#134e4a 0%,#0f766e 45%,#2dd4bf 100%)', glow: 'rgba(15,118,110,0.50)' }, // deep teal
  { grad: 'linear-gradient(145deg,#1e3a8a 0%,#1d4ed8 45%,#60a5fa 100%)', glow: 'rgba(29,78,216,0.50)'  }, // deep blue
  { grad: 'linear-gradient(145deg,#0c4a6e 0%,#0369a1 45%,#38bdf8 100%)', glow: 'rgba(3,105,161,0.50)'  }, // deep sky
];

const SLOTS = [
  { key: 'Morning In' as const, short: 'M-IN',  color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  { key: 'Lunch Out'  as const, short: 'L-OUT', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  { key: 'Lunch In'   as const, short: 'L-IN',  color: '#10b981', bg: '#f0fdf4', border: '#a7f3d0' },
  { key: 'Evening Out'as const, short: 'E-OUT', color: '#f43f5e', bg: '#fff1f2', border: '#fecdd3' },
];

const AIAttendanceLog: React.FC = () => {
  const { mode } = useParams<{ mode: string }>();

  const loggedInId = (() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const p = JSON.parse(stored);
        return String(p?.empCode || p?.EmpCode || p?.empId || p?.Emp_ID || p?.emp_id || "").trim();
      } catch {}
    }
    return "";
  })();

  const ADMIN_IDS = ["1501", "1509", "1601"];
  const isAdmin = ADMIN_IDS.includes(loggedInId);
  const effectiveMode = isAdmin ? "security" : "user";
  const history = useHistory();
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading]           = useState(true);
  const [searchQuery, setSearchQuery]   = useState("");
  const [userLogs, setUserLogs]         = useState<AttendanceRecord[]>([]);
  const [securityLogs, setSecurityLogs] = useState<AttendanceRecord[]>([]);
  const [currentUser, setCurrentUser]   = useState<any>(null);
  const [isSyncing, setIsSyncing]       = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => todayStr());

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function dateOffset(daysAgo: number) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  }

  function displayLabel(dateStr: string) {
    if (dateStr === todayStr())         return "Today";
    if (dateStr === dateOffset(1))      return "Yesterday";
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric'
    });
  }

  const isToday = selectedDate === todayStr();

  function shiftDay(delta: number) {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const next = d.toISOString().split('T')[0];
    if (next <= todayStr()) setSelectedDate(next);
  }

  /* ── initial user load ── */
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) { try { setCurrentUser(JSON.parse(stored)); } catch {} }
  }, []);

  /* ── re-fetch when mode or date changes ── */
  useEffect(() => { fetchLogs(true); }, [effectiveMode, selectedDate]);

  /* ── auto-sync in security mode (only when viewing today) ── */
  useEffect(() => {
    if (effectiveMode !== "security" || !isToday) return;
    const iv = setInterval(() => {
      setIsSyncing(true);
      fetchLogs(false).finally(() => setIsSyncing(false));
    }, 10000);
    return () => clearInterval(iv);
  }, [effectiveMode, selectedDate]);

  /* ─────────────────────────────────────────
     FETCH
  ───────────────────────────────────────── */
  async function fetchLogs(showLoader = false) {
    if (showLoader) setLoading(true);
    const token = localStorage.getItem("token") || "";
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      if (effectiveMode === "user") {
        // Generate 7 days ending at the selected date
        const base = new Date(selectedDate + 'T00:00:00');
        const dates: string[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(base);
          d.setDate(base.getDate() - i);
          dates.push(d.toISOString().split('T')[0]);
        }
        let empCode = "", empName = "";
        const stored = localStorage.getItem("user");
        if (stored) {
          try {
            const p = JSON.parse(stored);
            empCode = String(p?.empCode || p?.EmpCode || p?.empId || p?.Emp_ID || p?.emp_id || "").trim();
            empName = String(p?.empName || p?.EmpName || p?.emp_name || "").trim();
          } catch {}
        }

        const map = (r: any, date: string): AttendanceRecord => ({
          'Emp ID': r.empId || '-',
          Name: r.name || '',
          'Morning In': r.morningIn || '-',
          'Lunch Out':  r.lunchOut  || '-',
          'Lunch In':   r.lunchIn   || '-',
          'Evening Out':r.eveningOut|| '-',
          lateMinutes: r.lateMinutes || '0',
          graceType: r.graceType || '',
          attendanceStatus: r.attendanceStatus || '',
          date,
        });

        const all = await Promise.all(dates.map(async date => {
          try {
            const res = await fetch(`${API_BASE}Checkin/AIGetAttendanceByDate?date=${date}`, { headers });
            if (!res.ok) return [];
            const d = await res.json();
            if (d.success && Array.isArray(d.data)) {
              return d.data
                .filter((r: any) => {
                  const n = (r.name || "").toLowerCase();
                  const id = (r.empId || "").toLowerCase();
                  return (empCode && id === empCode.toLowerCase()) ||
                         (empName && n.includes(empName.toLowerCase()));
                })
                .map((r: any) => map(r, date));
            }
          } catch {}
          return [];
        }));

        const flat = all.flat();
        setUserLogs(dates.map(date =>
          flat.find(l => l.date === date) || {
            Name: empName, 'Emp ID': empCode,
            'Morning In': '-', 'Lunch Out': '-', 'Lunch In': '-', 'Evening Out': '-', date
          }
        ));

      } else {
        const res = await fetch(`${API_BASE}Checkin/AIGetAttendanceByDate?date=${selectedDate}`, { headers });
        if (!res.ok) { console.error("[AIAttendanceLog] fetch", res.status); return; }
        const d = await res.json();
        if (d.success && Array.isArray(d.data)) {
          const mapped: AttendanceRecord[] = d.data.map((r: any) => ({
            'Emp ID': r.empId || '-',
            Name: r.name || 'Unknown',
            'Morning In': r.morningIn || '-',
            'Lunch Out':  r.lunchOut  || '-',
            'Lunch In':   r.lunchIn   || '-',
            'Evening Out':r.eveningOut|| '-',
            lateMinutes: r.lateMinutes || '0',
            graceType: r.graceType || '-',
            attendanceStatus: r.attendanceStatus || '-',
          }));
          const sorted = [...mapped].sort((a, b) => {
            const latest = (rec: AttendanceRecord) =>
              SLOTS.map(s => rec[s.key]).filter(t => t && t !== '-').sort().reverse()[0] || '';
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
    if (l === 'lop')     return 'sc-lop';
    return 'sc-grace';
  }

  /* ── stats ── */
  const totalV   = securityLogs.length;
  const mornV    = securityLogs.filter(l => l['Morning In'] !== '-').length;
  const lunchV   = securityLogs.filter(l => l['Lunch Out'] !== '-' || l['Lunch In'] !== '-').length;
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
              {effectiveMode === "user"
                ? `${currentUser?.empName || currentUser?.EmpName || "Employee"} — 7-Day Log`
                : "Live verification console"}
            </p>
          </div>
          {effectiveMode === "security" && (
            <div className="live-sync-indicator">
              <span className={`sync-dot ${isSyncing ? "syncing" : ""}`} />
              <span className="sync-text">{isToday ? (isSyncing ? "SYNC…" : "LIVE") : "HISTORY"}</span>
              <button className="sync-now-btn" onClick={() => fetchLogs(true)}>
                <IonIcon icon={refreshOutline} />
              </button>
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
                const selectedLog = userLogs.find(l => l.date === selectedDate) || {
                  Name: currentUser?.empName || currentUser?.EmpName || "Employee",
                  'Emp ID': loggedInId,
                  'Morning In': '-', 'Lunch Out': '-', 'Lunch In': '-', 'Evening Out': '-',
                  date: selectedDate, lateMinutes: '0', graceType: '', attendanceStatus: ''
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
                    {(late > 0 || (selectedLog.graceType && selectedLog.graceType !== '-')) && (
                      <div className="emp-late-bar" style={{ marginTop: '16px' }}>
                        <span className="late-icon">⏱</span>
                        <span className="late-text">
                          {late > 0 ? <>Late by <strong>{late} min</strong></> : "On-Time Status"}
                        </span>
                        {selectedLog.graceType && selectedLog.graceType !== '-' && (
                          <span className={`grace-chip ${sc}`}>{selectedLog.graceType}</span>
                        )}
                      </div>
                    )}
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
            <div className="security-console-wrapper">

              {/* STATS STRIP */}
              <div className="console-stats-grid">
                {([
                  { label: 'TOTAL',      count: totalV,   cls: 'stat-total',   icon: personOutline },
                  { label: 'MORNING IN', count: mornV,    cls: 'stat-morning', icon: checkmarkCircleOutline },
                  { label: 'LUNCH',      count: lunchV,   cls: 'stat-break',   icon: timeOutline },
                  { label: 'SHIFT END',  count: eveningV, cls: 'stat-evening', icon: closeCircleOutline },
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
                    const sc        = statusClass(log.attendanceStatus);
                    const cfg       = avatarCfg(log.Name);
                    const inits     = getInitials(log.Name);
                    const late      = parseInt(log.lateMinutes || '0');
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
                            const val    = log[s.key];
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

                        {/* ── LATE FOOTER ── */}
                        {late > 0 && (
                          <div className="emp-late-bar">
                            <span className="late-icon">⏱</span>
                            <span className="late-text">Late by <strong>{late} min</strong></span>
                            {log.graceType && log.graceType !== '-' && (
                              <span className={`grace-chip ${sc}`}>{log.graceType}</span>
                            )}
                          </div>
                        )}
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
