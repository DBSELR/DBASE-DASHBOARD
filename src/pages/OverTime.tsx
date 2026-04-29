import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IonPage,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonModal,
  IonButton,
  IonIcon,
  IonDatetime,
  IonDatetimeButton,
  IonToast,
} from "@ionic/react";
import {
  timeOutline,
  pencilOutline,
  personCircleOutline,
} from "ionicons/icons";
import axios from "axios";
import {
  
  calendarOutline,
} from "ionicons/icons";
import moment from "moment";
import { API_BASE } from "../config";
import "./OverTime.css";

type ClientItem = { Client_ID: string; Client_Name: string };

type OTrow = {
  id: string;
  EmpCodeName?: string;
  EmpCode?: string;
  Date: string;
  College: string;
  Description: string;
  Fromtime: string;
  Totime: string;
  MinDiff?: string | number | null;
  FinMinDiff?: string | number | null;
  PendingAt?: string | null;
  Status?: string | null;
};

const isoToYmd = (val?: string) => {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return val;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return val || "";
  }
};

const ymdToDdMmYy = (ymd: string) => {
  if (!ymd) return "";
  const parts = ymd.includes("-") ? ymd.split("-") : ymd.split("/");
  const [y, m, d] = parts;
  if (!y || !m || !d) return ymd;
  return `${d}-${m}-${y}`;
};

const minutesBetween = (fromHHmm: string, toHHmm: string) => {
  if (!fromHHmm || !toHHmm) return 0;
  const start = new Date(`2000-01-01T${fromHHmm}:00`);
  const end = new Date(`2000-01-01T${toHHmm}:00`);
  const diff = (end.getTime() - start.getTime()) / 60000;
  return diff < 0 ? 0 : Math.floor(diff);
};

const isSaveOk = (data: any) => {
  if (data == null) return false;
  const s = String(data).toLowerCase();
  return s.includes("success") || s.includes("successfully") || parseInt(s, 10) > 0;
};

const OverTime: React.FC = () => {
  const [empCode, setEmpCode] = useState<string>("");
  const [userDesig, setUserDesig] = useState<string>("");
  const [userLoaded, setUserLoaded] = useState<boolean>(false);
  const didInitRef = useRef(false);

  const api = useMemo(() => {
    return axios.create({ baseURL: API_BASE, timeout: 30000 });
  }, []);

  const canApprove =
    empCode === "1541" ||
    userDesig.includes("Team Leader") ||
    userDesig.includes("Manager");

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [otDate, setOTDate] = useState<string>(isoToYmd(new Date().toISOString()));
  const [otClient, setOTClient] = useState<string>("");
  const [otFrom, setOTFrom] = useState<string>("");
  const [otTo, setOTTo] = useState<string>("");
  const [otActualMin, setOTActualMin] = useState<number>(0);
  const [otFinalMin, setOTFinalMin] = useState<number>(0);
  const [otDesc, setOTDesc] = useState<string>("");
  const [otList, setOTList] = useState<OTrow[]>([]);
  const [otEditingId, setOTEditingId] = useState<string>("");
  const [toast, setToast] = useState<{ msg: string; color?: string } | null>(null);

  const notify = (msg: string, color: string = "primary") =>
    setToast({ msg, color });

  const postWithFallback = async (
    endpoint: string,
    data: any,
    contentType: string = "application/json"
  ): Promise<any> => {
    try {
      let payload = data;
      if (
        contentType === "application/x-www-form-urlencoded" ||
        contentType === "multipart/form-data"
      ) {
        const fd =
          contentType === "multipart/form-data"
            ? new FormData()
            : new URLSearchParams();

        Object.entries(data).forEach(([k, v]) => {
          fd.append(k, String(v ?? ""));
        });
        payload = fd;
      }

      return await api.post(endpoint, payload, {
        headers: { "Content-Type": contentType },
      });
    } catch (e: any) {
      if (e.response?.status === 400 || e.response?.status === 415) {
        if (contentType === "application/json") {
          return await postWithFallback(
            endpoint,
            data,
            "application/x-www-form-urlencoded"
          );
        }
        if (contentType === "application/x-www-form-urlencoded") {
          return await postWithFallback(endpoint, data, "multipart/form-data");
        }
      }
      throw e;
    }
  };
useEffect(() => {
  if (otFrom && otTo) {
    const fromMinutes =
      Number(otFrom.split(":")[0]) * 60 +
      Number(otFrom.split(":")[1]);

    const toMinutes =
      Number(otTo.split(":")[0]) * 60 +
      Number(otTo.split(":")[1]);

    const diff = toMinutes > fromMinutes ? toMinutes - fromMinutes : 0;

    setOTActualMin(diff);
    setOTFinalMin(diff);
  } else {
    setOTActualMin(0);
    setOTFinalMin(0);
  }
}, [otFrom, otTo]);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    try {
      const stored =
        localStorage.getItem("storedUser") ||
        localStorage.getItem("user") ||
        localStorage.getItem("userData");

      if (stored) {
        const s = JSON.parse(stored);
        setEmpCode(String(s.empCode || s.username || ""));
        setUserDesig(String(s.designation || ""));
      }
    } catch (e) {
      console.warn("User parse error", e);
    } finally {
      setUserLoaded(true);
    }
  }, []);

  useEffect(() => {
    const mins = minutesBetween(otFrom, otTo);
    setOTActualMin(mins);
    setOTFinalMin(mins);
  }, [otFrom, otTo]);

  const loadClients = async (search: string = "") => {
    try {
      const res = await api.get("Workreport/Load_Clients", {
        params: { College: search },
      });
      const raw = Array.isArray(res.data) ? res.data : [];
      setClients(
        raw.map((x: any) => ({
          Client_ID: String(x[0]),
          Client_Name: x[1],
        }))
      );
    } catch {
      setClients([]);
    }
  };
const minOtDate = moment().format("YYYY-MM-DD");
const maxOtDate = moment().add(7, "days").format("YYYY-MM-DD");
  const loadOT = async () => {
    try {
      const res = await api.get("Workreport/load_overtime_duties", {
        params: { EmpCode: empCode },
      });
      const raw = Array.isArray(res.data) ? res.data : [];

      setOTList(
        raw.map((r: any) => ({
          id: String(r[0]),
          EmpCode: String(r[1]),
          Date: String(r[2]),
          College: String(r[3]),
          Fromtime: String(r[4]),
          Totime: String(r[5]),
          Description: String(r[6]),
          MinDiff: String(r[11] || "0"),
          Status: r[14] || "Pending",
          EmpCodeName: String(r[15] || ""),
        }))
      );
    } catch {
      setOTList([]);
    }
  };

  useEffect(() => {
    if (userLoaded && empCode) {
      loadClients();
      loadOT();
    }
  }, [userLoaded, empCode]);

  const clearOTForm = () => {
    setOTEditingId("");
    setOTDate(isoToYmd(new Date().toISOString()));
    setOTClient("");
    setOTFrom("");
    setOTTo("");
    setOTActualMin(0);
    setOTFinalMin(0);
    setOTDesc("");
  };

const saveOT = async () => {
  if (!otClient || !otDesc || !otFrom || !otTo|| !otDesc) {
    notify("Please fill all OT details", "warning");
    return;
  }

  if (!empCode) {
    notify("Employee session missing", "danger");
    return;
  }

  const fromMinutes =
    Number(otFrom.split(":")[0]) * 60 +
    Number(otFrom.split(":")[1]);

  const toMinutes =
    Number(otTo.split(":")[0]) * 60 +
    Number(otTo.split(":")[1]);

  if (toMinutes <= fromMinutes) {
    notify("To time should be greater than From time", "warning");
    return;
  }

  const totalMinutes = toMinutes - fromMinutes;

  if (totalMinutes < 90) {
    notify("Minimum overtime duration should be 90 minutes", "warning");
    return;
  }

  const payload = {
    _empcode: String(empCode),
    _date: String(otDate),
    _Client: String(otClient),
    _Fromtime: String(otFrom),
    _Totime: String(otTo),
    _Description: String(otDesc),
    _minDiff: String(totalMinutes),
    _FinMinDiff: String(otFinalMin || totalMinutes),
    _Otid: String(otEditingId || ""),
  };

  try {
    const res = await postWithFallback(
      "Workreport/save_overtime_duties",
      payload
    );

    if (isSaveOk(res.data)) {
      notify("Overtime saved successfully", "success");
      clearOTForm();
      loadOT();
    }
  } catch {
    notify("OT Save failed", "danger");
  }
};

  const editOT = async (id: string) => {
    try {
      const res = await api.get("Workreport/edit_OverTime", {
        params: { id, EmpCode: empCode },
      });

      const r = Array.isArray(res.data) && res.data[0] ? res.data[0] : null;

      if (r) {
        setOTEditingId(String(r[0]));
        setOTDate(isoToYmd(r[2]));
        setOTClient(r[3]);
        setOTFrom(r[4]);
        setOTTo(r[5]);
        setOTDesc(r[6]);
        notify("OT record loaded");
      }
    } catch {
      notify("Edit failed", "danger");
    }
  };

  const approveOT = async () => {
    if (!otEditingId) return;

    const payload = {
      _id: String(otEditingId),
      _desig: String(userDesig),
      _Fromtime: String(otFrom),
      _Totime: String(otTo),
      _minDiff: String(otActualMin),
      _FinMinDiff: String(otFinalMin),
    };

    try {
      const res = await postWithFallback(
        "Workreport/approve_overtime",
        payload
      );

      if (isSaveOk(res.data)) {
        notify("Overtime Approved", "success");
        clearOTForm();
        loadOT();
      }
    } catch {
      notify("OT Approve failed", "danger");
    }
  };
const [dateModalOpen, setDateModalOpen] = useState(false);
  return (
    <IonPage className="onduties-page">
      <IonContent className="onduties-content">
        <div style={{ padding: "20px 16px 10px" }}>
          <h2 style={{ margin: 0, fontWeight: 700 }}>Over-Time Manager</h2>
        </div>

        <div className="ion-padding-horizontal">
         <div className="overtime-form-container compact-form" >
  <div className="overtime-form-title compact-title">
    <IonIcon icon={timeOutline} />
    <span>{otEditingId ? "Edit OT Record" : "Add OT Record"}</span>
  </div>

<IonModal
  isOpen={dateModalOpen}
  onDidDismiss={() => setDateModalOpen(false)}
  className="native-date-modal"
>
  <IonContent>
  <IonDatetime
  presentation="date"
  preferWheel={true}
  showDefaultButtons={true}
  value={otDate}
  min={minOtDate}
  max={maxOtDate}
  onIonChange={(e) => {
    setOTDate(String(e.detail.value || ""));
  }}
  onIonCancel={() => setDateModalOpen(false)}
/>
  </IonContent>
</IonModal>
<IonGrid className="ion-no-padding compact-grid">
  <IonRow className="compact-row">
    <IonCol size="12" sizeMd="3">
      <div
        className="compact-input-card"
        onClick={() => setDateModalOpen(true)}
      >
        <label className="compact-label">OT Date</label>

        <div className="compact-date-display">
          <IonIcon icon={calendarOutline} className="compact-date-icon" />
          <span className="compact-date-text">
            {otDate
              ? moment(otDate).format("DD-MM-YYYY")
              : "Pick OT Date"}
          </span>
        </div>
      </div>

     
    </IonCol>

    <IonCol size="12" sizeMd="5">
      <div className="compact-input-card">
        <label className="compact-label">Client / College</label>

        <IonSelect
          interface="popover"
          className="compact-select"
          value={otClient}
          placeholder="Select Client"
          onIonChange={(e) => setOTClient(e.detail.value)}
        >
          {clients.map((c, idx) => (
            <IonSelectOption
              key={`${c.Client_ID}-${idx}`}
              value={c.Client_Name}
            >
              {c.Client_Name}
            </IonSelectOption>
          ))}
        </IonSelect>
      </div>
    </IonCol>

    <IonCol size="6" sizeMd="2">
      <div className="compact-input-card">
        <label className="compact-label">From</label>
        <IonInput
          type="time"
          className="compact-time-input"
          value={otFrom}
          onIonInput={(e) => setOTFrom(String(e.detail.value || ""))}
        />
      </div>
    </IonCol>

    <IonCol size="6" sizeMd="2">
      <div className="compact-input-card">
        <label className="compact-label">To</label>
        <IonInput
          type="time"
          className="compact-time-input"
          value={otTo}
          onIonInput={(e) => setOTTo(String(e.detail.value || ""))}
        />
      </div>
    </IonCol>
  </IonRow>

  <IonRow className="compact-row compact-second-row">
    <IonCol size="6" sizeMd="2">
      <div className="compact-stat-card">
        <span className="compact-stat-label">Actual</span>
        <span className="compact-stat-value">{otActualMin} Min</span>
      </div>
    </IonCol>

    <IonCol size="6" sizeMd="2">
      <div className="compact-input-card">
        <label className="compact-label">Approved</label>
        <IonInput
          className="compact-number-input"
          value={otFinalMin}
          onIonInput={(e) =>
            setOTFinalMin(Number(e.detail.value || 0))
          }
        />
      </div>
    </IonCol>

    <IonCol size="12" sizeMd="8">
      <div className="compact-input-card compact-summary-card">
        <label className="compact-label">Work Summary</label>
        <IonInput
          className="compact-summary-input"
          placeholder="Describe OT work done..."
          value={otDesc}
          onIonInput={(e) => setOTDesc(e.detail.value || "")}
        />
      </div>
    </IonCol>
  </IonRow>

  <div className="compact-btn-row">
    <IonButton
      className="compact-save-btn"
      expand="block"
      onClick={saveOT}
    >
      {otEditingId ? "Update OT" : "Save OT"}
    </IonButton>

    {canApprove && otEditingId && (
      <IonButton
        className="compact-approve-btn"
        color="success"
        expand="block"
        onClick={approveOT}
      >
        Approve
      </IonButton>
    )}
  </div>
</IonGrid>
</div>
          <div className="history-section-title">Over-Time Logs</div>
          {otList.map((row, idx) => (
            <div key={`${row.id}-${idx}`} className="premium-card">
              <div className="card-header">
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "4px",
                      fontSize: "0.85rem",
                      color: "#000",
                      fontWeight: 600,
                    }}
                  >
                    <IonIcon icon={personCircleOutline} style={{ fontSize: "1.1rem", color: "#6366f1" }} />
                    <span>{row.EmpCodeName}</span>
                  </div>
                  <div className="college-name">{row.College}</div>
                  <div className="entry-date">{ymdToDdMmYy(row.Date)}</div>
                </div>

                <div
                  className={`badge-pill pill-${
                    String(row.Status).toLowerCase().includes("pending")
                      ? "pending"
                      : String(row.Status).toLowerCase().includes("rejected")
                      ? "rejected"
                      : "approved"
                  }`}
                >
                  {row.Status}
                </div>
              </div>

              <div className="desc-box">{row.Description}</div>

              <div className="card-footer-grid">
                <div className="footer-item">
                  <span className="item-label">Timeline</span>
                  <span className="item-value">
                    {row.Fromtime} - {row.Totime}
                  </span>
                </div>

                <div className="footer-item">
                  <span className="item-label">Total Minutes</span>
                  <span className="item-value">{row.MinDiff || "0"} Mins</span>
                </div>

                <IonButton fill="clear" color="primary" onClick={() => editOT(row.id)}>
                  <IonIcon icon={pencilOutline} />
                </IonButton>
              </div>
            </div>
          ))}
        </div>

        <IonToast
          isOpen={!!toast}
          message={toast?.msg}
          color={toast?.color as any}
          duration={2500}
          onDidDismiss={() => setToast(null)}
          position="top"
        />
      </IonContent>
    </IonPage>
  );
};

export default OverTime;