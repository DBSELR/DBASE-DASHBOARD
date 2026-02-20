// src/pages/Timings.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonGrid,
  IonRow,
  IonCol,
  IonLoading,
  IonToast,
  IonCard,
  IonCardHeader,
  IonCardContent,
  IonButton,
} from "@ionic/react";
import axios from "axios";
import Chart from "chart.js/auto";
import moment from "moment";

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
  TOTALCHECKINS: number;
  INTIMECHECKINS: number;
  CHECKINPERCENTAGE: number;
};

const Timings: React.FC = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // default to 1509 so you see data immediately like your example
  const [empCode] = useState<string>(user?.empCode || "1509");
  const [year, setYear] = useState<string>("2025"); // kept for API param
  const [month, setMonth] = useState<string>("9");  // kept for API param

  const [loading, setLoading] = useState<boolean>(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [empTimings, setEmpTimings] = useState<EmpTiming[]>([]);
  const [totalCheckins, setTotalCheckins] = useState<string>("0");
  const [inTimeCheckins, setInTimeCheckins] = useState<string>("0");
  const [checkinsPer, setCheckinsPer] = useState<string>("0");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "danger">("danger");
  const [securityLogin, setSecurityLogin] = useState<boolean>(false);

  const lineCanvasRef = useRef<HTMLCanvasElement>(null);
  const doubleBarCanvasRef = useRef<HTMLCanvasElement>(null);
  const lineChartInstanceRef = useRef<Chart | null>(null);
  const doubleBarChartInstanceRef = useRef<Chart | null>(null);

  // If you don't proxy /api -> https://api.dbasesolutions.in/API, change this to the full origin.
  const baseUrl = "/api";

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token")?.replace(/"/g, "");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    console.log("[auth] headers:", headers);
    return headers as Record<string, string>;
  };

  // ---------- NORMALIZERS ----------
  const normalizePermissions = (raw: any[]): Permission[] => {
    if (Array.isArray(raw) && raw.length && Array.isArray(raw[0])) {
      const mapped = raw.map((a: any[]) => ({
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
      })) as Permission[];
      console.log("[permissions] normalized from array-of-arrays:", mapped);
      return mapped;
    }
    const mapped = (raw || []).map((o: any) => ({
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
    })) as Permission[];
    console.log("[permissions] normalized from objects:", mapped);
    return mapped;
  };

  const normalizeEmpTimings = (raw: any[]): EmpTiming[] => {
    if (Array.isArray(raw) && raw.length && Array.isArray(raw[0])) {
      // Expect: [EMPID, TOTALCHECKINS, INTIMECHECKINS, CHECKINPERCENTAGE]
      const mapped = raw.map((r: any[]) => ({
        EMPID: String(r[0]),
        TOTALCHECKINS: Number(r[1] ?? 0),
        INTIMECHECKINS: Number(r[2] ?? 0),
        CHECKINPERCENTAGE: Number(r[3] ?? 0),
      })) as EmpTiming[];
      console.log("[empTimings] normalized from array-of-arrays:", mapped);
      return mapped;
    }
    const mapped = (raw || []).map((o: any) => ({
      EMPID: String(o.EMPID ?? o.EmpId ?? o.empid ?? ""),
      TOTALCHECKINS: Number(o.TOTALCHECKINS ?? o.TotalCheckins ?? o.TOTAL ?? 0),
      INTIMECHECKINS: Number(o.INTIMECHECKINS ?? o.InTimeCheckins ?? o.INTIME ?? 0),
      CHECKINPERCENTAGE: Number(o.CHECKINPERCENTAGE ?? o.CheckinPercentage ?? o.PERCENTAGE ?? 0),
    })) as EmpTiming[];
    console.log("[empTimings] normalized from objects:", mapped);
    return mapped;
  };

  // ---------- API CALLS ----------
  const loadPermissions = async () => {
    setLoading(true);
    const url = `${baseUrl}/Leave/Load_Permissions?Empcode=${empCode}`;
    console.log("[loadPermissions] GET", url, { empCode });
    try {
      const res = await axios.get(url, { headers: getAuthHeaders() });
      console.log("[loadPermissions] raw response:", res.status, res.data);
      const perms = normalizePermissions(res.data);
      setPermissions(perms);
      console.table(perms.slice(0, 10));
    } catch (err: any) {
      console.error("[loadPermissions] error:", err?.response || err);
      setToastMessage("Failed to load permissions.");
      setToastType("danger");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const loadEmpTimings = async () => {
    setLoading(true);
    const url = `${baseUrl}/Timings/Load_EMP_Timings?EmpCode=${empCode}&Year=${year}&Month=${month}`;
    console.log("[loadEmpTimings] GET", url, { empCode, year, month });
    try {
      const res = await axios.get(url, { headers: getAuthHeaders() });
      console.log("[loadEmpTimings] raw response:", res.status, res.data);

      const normalized = normalizeEmpTimings(res.data);
      setEmpTimings(normalized);
      console.table(normalized.slice(0, 10));

      loadEmpTimingsStats(normalized);
      doubleBarChartMethod(normalized);
    } catch (err: any) {
      console.error("[loadEmpTimings] error:", err?.response || err);
      setToastMessage("Failed to load employee timings.");
      setToastType("danger");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const loadTimingsPercentage = async () => {
    setLoading(true);
    const url = `${baseUrl}/Timings/Load_Timings_Percentage`;
    console.log("[loadTimingsPercentage] GET", url);
    try {
      const res = await axios.get(url, { headers: getAuthHeaders() });
      console.log("[loadTimingsPercentage] raw response:", res.status, res.data);

      const raw = res.data;
      let years: string[] = [];
      let checkins: number[] = [];

      if (Array.isArray(raw) && raw.length > 0) {
        if (Array.isArray(raw[0])) {
          // rows like [year, total, intime, percentage]
          years = raw.map((r: any[]) => String(r[0]));
          checkins = raw.map((r: any[]) => Number(r[3]));
        } else {
          years = raw.map((x: any) => String(x.YEAR));
          checkins = raw.map((x: any) => Number(x.CHECKINPERCENTAGE));
        }
      }

      const validPairs = years
        .map((y, i) => ({ y, p: checkins[i] }))
        .filter((row) => row.y !== undefined && !Number.isNaN(row.p));

      console.table(validPairs);
      lineChartMethod(validPairs.map((r) => r.y), validPairs.map((r) => r.p));
    } catch (err: any) {
      console.error("[loadTimingsPercentage] error:", err?.response || err);
      setToastMessage("Failed to load timings percentage.");
      setToastType("danger");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // ---------- CHARTS ----------
  const lineChartMethod = (years: string[], percentages: number[]) => {
    try {
      if (lineChartInstanceRef.current) {
        console.log("[lineChart] destroying existing instance");
        lineChartInstanceRef.current.destroy();
      }
      if (!lineCanvasRef.current) {
        console.warn("[lineChart] canvas missing");
        return;
      }
      console.log("[lineChart] creating instance");
      lineChartInstanceRef.current = new Chart(lineCanvasRef.current, {
        type: "line",
        data: {
          labels: years,
          datasets: [
            {
              label: "In Time Check-In (%)",
              data: percentages,
              backgroundColor: "rgba(34,139,34,0.4)",
              borderColor: "rgba(34,139,34,1)",
              fill: false,
              tension: 0.1,
            },
          ],
        },
        options: {
          responsive: true,
          scales: {
            y: { beginAtZero: true, max: 100 },
          },
        },
      });
    } catch (e) {
      console.error("[lineChart] error:", e);
    }
  };

  const doubleBarChartMethod = (data: EmpTiming[]) => {
    try {
      if (doubleBarChartInstanceRef.current) {
        console.log("[barChart] destroying existing instance");
        doubleBarChartInstanceRef.current.destroy();
      }
      if (!doubleBarCanvasRef.current) {
        console.warn("[barChart] canvas missing");
        return;
      }

      const labels = data.map((d) => String(d.EMPID));
      const totals = data.map((d) => Number(d.TOTALCHECKINS || 0));
      const inTimes = data.map((d) => Number(d.INTIMECHECKINS || 0));
      const noTimes = data.map((_, i) => Math.max(0, totals[i] - inTimes[i]));

      console.log("[barChart] labels:", labels);
      console.log("[barChart] totals:", totals);
      console.log("[barChart] inTimes:", inTimes);
      console.log("[barChart] noTimes:", noTimes);

      doubleBarChartInstanceRef.current = new Chart(doubleBarCanvasRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Total",
              data: totals,
              backgroundColor: "rgba(255, 99, 132, 0.25)",
              borderColor: "rgba(255, 99, 132, 1)",
              borderWidth: 1,
              barThickness: 10,
              grouped: false, // overlay, not side-by-side
              order: 0,
              borderRadius: 6,
            },
            {
              label: "In Time",
              data: inTimes,
              backgroundColor: "rgba(60, 179, 113, 0.25)",
              borderColor: "rgba(60, 179, 113, 1)",
              borderWidth: 1,
              barThickness: 8,
              grouped: false,
              order: 1,
              borderRadius: 6,
            },
            {
              label: "No Time",
              data: noTimes,
              backgroundColor: "rgba(54, 162, 235, 0.25)",
              borderColor: "rgba(54, 162, 235, 1)",
              borderWidth: 1,
              barThickness: 6,
              grouped: false,
              order: 2,
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: "y",
          animation: false,
          plugins: {
            legend: {
              position: "top",
              labels: { usePointStyle: true, boxWidth: 12, padding: 16 },
            },
            tooltip: {
              mode: "index",
              intersect: false,
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.x}`,
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: "rgba(0,0,0,0.08)" },
            },
            y: {
              grid: { display: false },
            },
          },
        },
      });
    } catch (e) {
      console.error("[barChart] error:", e);
    }
  };

  // ---------- STATS ----------
  const loadEmpTimingsStats = (data: EmpTiming[]) => {
    try {
      console.log("[stats] computing for", { empCode, role: user?.designation });
      if (user?.designation === "Director" || empCode === "2001") {
        setTotalCheckins(String(data[0]?.TOTALCHECKINS ?? "0"));
        setInTimeCheckins(String(data[0]?.INTIMECHECKINS ?? "0"));
        setCheckinsPer(String(data[0]?.CHECKINPERCENTAGE ?? "0"));
        console.log("[stats] Director/security view:", {
          total: data[0]?.TOTALCHECKINS,
          intime: data[0]?.INTIMECHECKINS,
          per: data[0]?.CHECKINPERCENTAGE,
        });
      } else {
        const emp = data.find((x) => x.EMPID === empCode);
        setTotalCheckins(String(emp?.TOTALCHECKINS ?? "0"));
        setInTimeCheckins(String(emp?.INTIMECHECKINS ?? "0"));
        setCheckinsPer(String(emp?.CHECKINPERCENTAGE ?? "0"));
        console.log("[stats] Employee view:", { empCode, emp });
      }
    } catch (e) {
      console.error("[stats] error:", e);
    }
  };

  // ---------- SAVE PERMISSION TIME ----------
  const savePermTime = async (lid: number, tm: string, tmType: "OT" | "IT") => {
    setLoading(true);
    const url = `${baseUrl}/Timings/SavePermTime`;
    const body = new URLSearchParams();
    body.append("_Lid", String(lid));
    body.append("_Tm", tm);
    body.append("_TmType", tmType);

    console.log("[savePermTime] POST", url, { _Lid: lid, _Tm: tm, _TmType: tmType, encoded: body.toString() });
    try {
      const res = await axios.post(url, body.toString(), {
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      console.log("[savePermTime] response:", res.status, res.data);
      setToastMessage("Saved successfully.");
      setToastType("success");
      setShowToast(true);
      await loadPermissions();
    } catch (err: any) {
      console.error("[savePermTime] error:", err?.response || err);
      setToastMessage("Failed to save permission time.");
      setToastType("danger");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // ---------- TIME INPUT HANDLER ----------
  const handleTimeChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    pOut: string,
    pIn: string,
    lid: number,
    type: "OT" | "IT"
  ) => {
    const value = e.target.value;
    console.log("[handleTimeChange] value:", value, { type, lid, pOut, pIn });
    if (!value) return;

    const curr = moment(value, "HH:mm", true);
    const out = moment(pOut, "HH:mm", true);
    const st = moment("09:30", "HH:mm", true);
    const en = moment("18:30", "HH:mm", true);
    const brs = moment("13:30", "HH:mm", true);
    const bre = moment("14:30", "HH:mm", true);

    const parsedOk =
      curr.isValid() &&
      (!pOut || out.isValid()) &&
      st.isValid() &&
      en.isValid() &&
      brs.isValid() &&
      bre.isValid();

    if (!parsedOk) {
      console.warn("[handleTimeChange] invalid parsing for one of the times");
      setToastMessage("Invalid Time!");
      setToastType("danger");
      setShowToast(true);
      e.target.value = "";
      return;
    }

    const invalid =
      curr.isBefore(st) ||
      curr.isAfter(en) ||
      (curr.isAfter(brs) && curr.isBefore(bre)) ||
      (type === "IT" && pOut && curr.isBefore(out));

    if (invalid) {
      console.warn("[handleTimeChange] rejected by business rules", {
        curr: curr.format("HH:mm"),
        st: st.format("HH:mm"),
        en: en.format("HH:mm"),
        brs: brs.format("HH:mm"),
        bre: bre.format("HH:mm"),
        type,
        pOut,
      });
      setToastMessage("Invalid Time!");
      setToastType("danger");
      setShowToast(true);
      e.target.value = "";
      return;
    }

    await savePermTime(lid, value, type);
  };

  // ---------- EFFECT ----------
  useEffect(() => {
    const isSec = empCode === "2001";
    setSecurityLogin(isSec);
    console.log("[init] securityLogin:", isSec, "empCode:", empCode);
    loadPermissions();
    loadEmpTimings();
    loadTimingsPercentage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empCode, year, month]);

  // ---------- UI ----------
  return (
    <IonPage>
      <IonHeader>
              <IonToolbar>
                <IonToolbar className="menu-toolbar">
                  <img
                    src="./images/dbase.png"
                    alt="DBase Logo"
                    className="menu-logo"
                  />
                </IonToolbar>
              </IonToolbar>
            </IonHeader>
      <IonContent className="ion-padding">
        <IonLoading isOpen={loading} message="Loading..." />
        <IonToast
          isOpen={showToast}
          message={toastMessage}
          duration={3000}
          color={toastType}
          onDidDismiss={() => setShowToast(false)}
        />

        <IonGrid>
          <IonRow>
            <IonCol size="12" sizeLg="6" className="permission-list">
              <div className="div-header-new">Permissions</div>
              <div style={{ maxHeight: 450, overflowY: "auto" }}>
                {permissions.map((perm, idx) => (
                  <div key={idx} className="card-style" style={{ padding: 10 }}>
                    <div>
                      {perm.PDATE} - {perm.PTIME || (perm.Duration ? `${perm.Duration} Min` : "")}
                    </div>
                    <IonButton size="small" fill="clear">
                      {perm.EMPCODE}-{perm.EMPNAME}
                    </IonButton>
                    <div>
                      <label>From:</label>
                      <input
                        type="time"
                        value={perm.P_Out || ""}
                        onChange={(e) =>
                          handleTimeChange(e, perm.P_Out || "", perm.P_In || "", Number(perm.lid), "OT")
                        }
                        disabled={!securityLogin}
                      />
                      <label style={{ marginLeft: 8 }}>To:</label>
                      <input
                        type="time"
                        value={perm.P_In || ""}
                        onChange={(e) =>
                          handleTimeChange(e, perm.P_Out || "", perm.P_In || "", Number(perm.lid), "IT")
                        }
                        disabled={!perm.P_Out || !securityLogin}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </IonCol>

            <IonCol size="12" sizeLg="6">
              <IonCard>
                <IonCardHeader>Check-In Summary</IonCardHeader>
                <IonCardContent>
                  <p>Total Check-Ins: {totalCheckins}</p>
                  <p>In Time Check-Ins: {inTimeCheckins}</p>
                  <p>%: {checkinsPer}</p>
                </IonCardContent>
              </IonCard>

              <IonCard>
                <IonCardHeader>Yearly Check-In Status</IonCardHeader>
                <IonCardContent>
                  <canvas ref={lineCanvasRef} style={{ height: "40vh", width: "100%" }} />
                </IonCardContent>
              </IonCard>

              <IonCard>
                <IonCardHeader>Check-In Status</IonCardHeader>
                <IonCardContent>
                  <div style={{ background: "#eaf3fb", borderRadius: 8, padding: 8 }}>
                    <canvas ref={doubleBarCanvasRef} style={{ height: "40vh", width: "100%" }} />
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>
      </IonContent>
    </IonPage>
  );
};

export default Timings;
