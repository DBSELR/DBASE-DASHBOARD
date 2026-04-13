// src/pages/Timings.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonLoading,
  IonToast,
} from "@ionic/react";
import {
  Clock,
  User,
  Calendar,
  TrendingUp,
  AlertCircle,
  BarChart3,
  LogOut,
  LogIn,
  CheckCircle2
} from "lucide-react";
import axios from "axios";
import Chart from "chart.js/auto";
import { API_BASE } from "../config";
import moment from "moment";
import "./Timings.css";

type Permission = {
  lid: number | string;
  EMPCODE: string;
  EMPNAME: string;
  TYPE?: string;
  PDATE: string;
  STATUS: string | null;
  P_Out: string | null;
  P_In: string | null;
  Duration?: number | null;
  PTIME: string | null;
};

type EmpTiming = {
  EMPID: string;
  EMPNAME: string;
  TOTALCHECKINS: number;
  INTIMECHECKINS: number;
  CHECKINPERCENTAGE: number;
};

const Timings: React.FC = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  // Determine if admin based on common codes or designation
  const isAdmin = user?.designation === "Director" || user?.empCode === "1509" || user?.empCode === "2001";

  // If admin, they see ALL permissions by default
  const [empCode] = useState<string>(isAdmin ? "ALL" : (user?.empCode || "1509"));
  const [year] = useState<string>(new Date().getFullYear().toString());
  const [month] = useState<string>("0");

  const [loading, setLoading] = useState<boolean>(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [totalCheckins, setTotalCheckins] = useState<string>("0");
  const [inTimeCheckins, setInTimeCheckins] = useState<string>("0");
  const [checkinsPer, setCheckinsPer] = useState<string>("0");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "danger">("danger");

  const lineCanvasRef = useRef<HTMLCanvasElement>(null);
  const doubleBarCanvasRef = useRef<HTMLCanvasElement>(null);
  const lineChartInstanceRef = useRef<Chart | null>(null);
  const doubleBarChartInstanceRef = useRef<Chart | null>(null);

  const baseUrl = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token")?.replace(/"/g, "");
    return (token ? { Authorization: `Bearer ${token}` } : {}) as Record<string, string>;
  };

  // ---------- NORMALIZERS ----------
  const normalizePermissions = (raw: any[]): Permission[] => {
    if (Array.isArray(raw) && raw.length && Array.isArray(raw[0])) {
      return raw.map((a: any[]) => ({
        lid: a[0],
        EMPCODE: String(a[1]),
        EMPNAME: String(a[2]),
        TYPE: a[3] ?? "Permission",
        PDATE: String(a[4]),
        STATUS: a[5],
        P_Out: a[6],
        P_In: a[7],
        Duration: a[8],
        PTIME: a[9],
      }));
    }
    return (raw || []).map((o: any) => ({
      lid: o.lid ?? o.LID ?? o.Id,
      EMPCODE: o.EMPCODE ?? o.EmpCode ?? o.empcode,
      EMPNAME: o.EMPNAME ?? o.EmpName ?? o.empname,
      TYPE: o.TYPE ?? o.Type ?? "Permission",
      PDATE: o.PDATE ?? o.PDate ?? o.pdate,
      STATUS: o.STATUS ?? o.Status ?? null,
      P_Out: o.P_Out ?? o.POUT ?? o.POut ?? null,
      P_In: o.P_In ?? o.PIN ?? o.PIn ?? null,
      Duration: o.Duration ?? o.DURATION ?? o.PMin ?? null,
      PTIME: o.PTIME ?? o.PTime ?? (o.PMin ? `${o.PMin} Min` : null),
    }));
  };

  const normalizeEmpTimings = (raw: any[]): EmpTiming[] => {
    if (Array.isArray(raw) && raw.length && Array.isArray(raw[0])) {
      return raw.map((r: any[]) => ({
        EMPID: String(r[0]),
        EMPNAME: String(r[1]),
        TOTALCHECKINS: Number(r[2] ?? 0),
        INTIMECHECKINS: Number(r[3] ?? 0),
        CHECKINPERCENTAGE: Number(r[4] ?? 0),
      }));
    }
    return (raw || []).map((o: any) => ({
      EMPID: String(o.EMPID ?? o.EmpId ?? o.empid ?? ""),
      EMPNAME: String(o.EMPNAME ?? o.EmpName ?? o.empname ?? ""),
      TOTALCHECKINS: Number(o.TOTALCHECKINS ?? o.TotalCheckins ?? o.TOTAL ?? 0),
      INTIMECHECKINS: Number(o.INTIMECHECKINS ?? o.InTimeCheckins ?? o.INTIME ?? 0),
      CHECKINPERCENTAGE: Number(o.CHECKINPERCENTAGE ?? o.CheckinPercentage ?? o.PERCENTAGE ?? 0),
    }));
  };

  // ---------- API CALLS ----------
  const loadPermissions = async () => {
    setLoading(true);
    const url = `${baseUrl}/Leave/Load_Permissions?Empcode=${empCode}`;
    try {
      const res = await axios.get(url, { headers: getAuthHeaders() });
      setPermissions(normalizePermissions(res.data));
    } catch (err: any) {
      console.error("[loadPermissions] error:", err);
      setToastMessage("Failed to load permissions.");
      setToastType("danger");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const loadEmpTimings = async () => {
    setLoading(true);
    const filterCode = isAdmin ? "All" : (user?.empCode || "1509");
    const url = `${baseUrl}/Timings/Load_EMP_Timings?EmpCode=${filterCode}&Year=${year}&Month=${month}`;
    try {
      const res = await axios.get(url, { headers: getAuthHeaders() });
      const normalized = normalizeEmpTimings(res.data);

      if (normalized.length > 0) {
        let statsData = normalized[0];
        if (!isAdmin) {
          statsData = normalized.find(e => e.EMPID === user?.empCode) || normalized[0];
        }
        setTotalCheckins(String(statsData.TOTALCHECKINS));
        setInTimeCheckins(String(statsData.INTIMECHECKINS));
        setCheckinsPer(String(statsData.CHECKINPERCENTAGE));
      }

      renderDoubleBarChart(normalized.slice(0, 15));
    } catch (err: any) {
      console.error("[loadEmpTimings] error:", err);
      setToastMessage("Failed to load timings data.");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const loadTimingsPercentage = async () => {
    const url = `${baseUrl}/Timings/Load_Timings_Percentage`;
    try {
      const res = await axios.get(url, { headers: getAuthHeaders() });
      const raw = res.data;
      let years: string[] = [];
      let checkins: number[] = [];

      if (Array.isArray(raw) && raw.length > 0) {
        if (Array.isArray(raw[0])) {
          years = raw.map((r: any[]) => String(r[0]));
          checkins = raw.map((r: any[]) => Number(r[3]));
        } else {
          years = raw.map((x: any) => String(x.YEAR));
          checkins = raw.map((x: any) => Number(x.CHECKINPERCENTAGE));
        }
      }
      renderLineChart(years, checkins);
    } catch (err: any) {
      console.error("[loadTimingsPercentage] error:", err);
    }
  };

  const savePermTime = async (lid: string | number, tm: string, tmType: "OT" | "IT") => {
    setLoading(true);
    const url = `${baseUrl}/Timings/SavePermTime`;
    const payload = {
      _Lid: String(lid),
      _Tm: tm,
      _TmType: tmType
    };

    try {
      await axios.post(url, payload, {
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
      });
      setToastMessage("Timing updated successfully.");
      setToastType("success");
      setShowToast(true);
      loadPermissions();
    } catch (err: any) {
      console.error("[savePermTime] error:", err);
      setToastMessage("Failed to save timing.");
      setToastType("danger");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // ---------- CHARTS ----------
  const renderLineChart = (years: string[], percentages: number[]) => {
    if (lineChartInstanceRef.current) lineChartInstanceRef.current.destroy();
    if (!lineCanvasRef.current) return;

    lineChartInstanceRef.current = new Chart(lineCanvasRef.current, {
      type: "line",
      data: {
        labels: years,
        datasets: [{
          label: "In Time %",
          data: percentages,
          borderColor: "#6366f1",
          backgroundColor: "rgba(99, 102, 241, 0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: "#6366f1"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, max: 100 } }
      }
    });
  };

  const renderDoubleBarChart = (data: EmpTiming[]) => {
    if (doubleBarChartInstanceRef.current) doubleBarChartInstanceRef.current.destroy();
    if (!doubleBarCanvasRef.current) return;

    doubleBarChartInstanceRef.current = new Chart(doubleBarCanvasRef.current, {
      type: "bar",
      data: {
        labels: data.map(d => d.EMPID),
        datasets: [
          {
            label: "Total",
            data: data.map(d => d.TOTALCHECKINS),
            backgroundColor: "rgba(99, 102, 241, 0.2)",
            borderColor: "#6366f1",
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: "In Time",
            data: data.map(d => d.INTIMECHECKINS),
            backgroundColor: "#10b981",
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { position: 'top' as const } }
      }
    });
  };

  const handleTimeEdit = async (lid: string | number, type: "OT" | "IT", value: string) => {
    if (!value) return;
    const time = moment(value, "HH:mm");
    if (!time.isValid()) return;
    await savePermTime(lid, value, type);
  };

  useEffect(() => {
    loadPermissions();
    loadEmpTimings();
    loadTimingsPercentage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <IonPage>


      <IonContent>
        <div className="tm-page-content">
          <IonLoading isOpen={loading} message="Fetching latest data..." />
          <IonToast
            isOpen={showToast}
            message={toastMessage}
            duration={2000}
            color={toastType}
            onDidDismiss={() => setShowToast(false)}
          />

          <div className="tm-grid">
            {/* Left Column: Permissions */}
            <div className="tm-card tm-animate">
              <div className="tm-card-header">
                <h3 className="tm-card-title">
                  <Clock className="tm-icon" size={20} />
                  Employee Permissions
                </h3>
                <div className="tm-emp-code">{isAdmin ? "ADMIN VIEW" : "MY REQUESTS"}</div>
              </div>

              <div className="tm-permission-list">
                {permissions.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    <AlertCircle style={{ width: '48px', height: '48px', marginBottom: '12px', margin: '0 auto' }} />
                    <p>No permission records found.</p>
                  </div>
                )}
                {permissions.map((perm) => (
                  <div key={perm.lid} className="tm-perm-item">
                    <div className="tm-perm-header">
                      <div className="tm-emp-info">
                        <span className="tm-emp-name">{perm.EMPNAME}</span>
                        <span className="tm-emp-code">{perm.EMPCODE} • {perm.TYPE}</span>
                      </div>
                      <span className={`tm-perm-status tm-status-${perm.STATUS?.toLowerCase() || 'pending'}`}>
                        {perm.STATUS || 'Pending'}
                      </span>
                    </div>

                    <div className="tm-perm-time-row">
                      <Calendar size={14} />
                      <span>{perm.PDATE}</span>
                      <Clock size={14} style={{ marginLeft: '8px' }} />
                      <span>{perm.PTIME || (perm.Duration ? `${perm.Duration} Min` : 'N/A')}</span>
                    </div>

                    <div className="tm-time-controls">
                      <div className="tm-input-group">
                        <label className="tm-input-label">
                          <LogOut size={10} style={{ marginRight: 4 }} />
                          Out Time
                        </label>
                        <input
                          type="time"
                          className="tm-time-input"
                          value={perm.P_Out || ""}
                          disabled={!isAdmin}
                          onChange={(e) => handleTimeEdit(perm.lid, "OT", e.target.value)}
                        />
                      </div>
                      <div className="tm-input-group">
                        <label className="tm-input-label">
                          <LogIn size={10} style={{ marginRight: 4 }} />
                          In Time
                        </label>
                        <input
                          type="time"
                          className="tm-time-input"
                          value={perm.P_In || ""}
                          disabled={!isAdmin || !perm.P_Out}
                          onChange={(e) => handleTimeEdit(perm.lid, "IT", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Stats & Charts */}
            <div className="tm-animate" style={{ animationDelay: '0.1s' }}>
              <div className="tm-stats-container">
                <div className="tm-stat-item tm-card">
                  <BarChart3 className="tm-icontm-icon" color="#10b981" size={20} style={{ marginBottom: 4 }} />
                  <span className="tm-stat-value">{totalCheckins}</span>
                  <span className="tm-stat-label">Total</span>
                </div>
                <div className="tm-stat-item tm-card">
                  <CheckCircle2 className="tm-icon" color="#10b981" size={20} style={{ marginBottom: 4 }} />
                  <span className="tm-stat-value" style={{ color: '#10b981' }}>{inTimeCheckins}</span>
                  <span className="tm-stat-label">In-Time</span>
                </div>
                <div className="tm-stat-item tm-card">
                  <TrendingUp className="tm-icon" color="#6366f1" size={20} style={{ marginBottom: 4 }} />
                  <span className="tm-stat-value" style={{ color: '#6366f1' }}>{checkinsPer}%</span>
                  <span className="tm-stat-label">Score</span>
                </div>
              </div>

              <div className="tm-card" style={{ marginBottom: '24px' }}>
                <div className="tm-card-header">
                  <h3 className="tm-card-title">
                    <TrendingUp className="tm-icon" size={20} />
                    Punctuality Trends (Yearly)
                  </h3>
                </div>
                <div className="tm-chart-container" style={{ height: '200px' }}>
                  <canvas ref={lineCanvasRef} />
                </div>
              </div>

              <div className="tm-card">
                <div className="tm-card-header">
                  <h3 className="tm-card-title">
                    <User className="tm-icon" size={20} />
                    Leaderboard / Activity
                  </h3>
                </div>
                <div className="tm-chart-container" style={{ height: '300px' }}>
                  <canvas ref={doubleBarCanvasRef} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Timings;
