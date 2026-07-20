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
import { createPortal } from "react-dom";
import { ChevronDown, Search, X, Check } from "lucide-react";
import moment from "moment";
import { API_BASE } from "../config";
import "./OverTime.css";
import "../components/requests/RequestList.css";

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

const OverTime: React.FC<{ view: "my" | "raised" }> = ({ view }) => {
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
  
  // Custom Dropdown State
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [clientDropdownPos, setClientDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const clientTriggerRef = useRef<HTMLDivElement>(null);

  const currentYear = new Date().getFullYear();
  const [unlockRange, setUnlockRange] = useState({
    approved: false,
    fromDate: "",
    toDate: ""
  });
  const today = new Date();

  // ✅ max = today (no future allowed)
  const maxOtDate = today.toISOString().split("T")[0];

  // ✅ min = last 7 days (including today)
  const minDateObj = new Date();
  minDateObj.setDate(today.getDate() - 2);
  const minOtDate = minDateObj.toISOString().split("T")[0];

  // ✅ default selected date = today


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
    //setOTDate(maxOtDate);
  }, [otFrom, otTo]);

  // Handle dropdown positioning on scroll/resize
  useEffect(() => {
    const updatePositions = () => {
      if (isClientDropdownOpen && clientTriggerRef.current) {
        const rect = clientTriggerRef.current.getBoundingClientRect();
        setClientDropdownPos({ top: rect.bottom + 8, left: rect.left, width: rect.width });
      }
    };
    updatePositions();
    window.addEventListener('resize', updatePositions);
    const scrollParents = [document.querySelector('ion-content')?.shadowRoot?.querySelector('.inner-scroll'), window];
    scrollParents.forEach(p => p?.addEventListener('scroll', updatePositions));
    return () => {
      window.removeEventListener('resize', updatePositions);
      scrollParents.forEach(p => p?.removeEventListener('scroll', updatePositions));
    };
  }, [isClientDropdownOpen]);

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

  const loadOT = async () => {
    try {
      const res = await api.get(
        view === "my"
          ? "OverTime/load_overtime_duties"
          : "OverTime/load_team_overtime_duties",
        {
          params: { EmpCode: empCode },
        }
      );
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

  const loadUnlockRequest = async () => {
    if (!empCode) return;
    try {
      // Need to include headers for the GetApprovedUnlockRequest which requires [Authorize]
      const token = localStorage.getItem("token")?.replace(/"/g, "");
      const res = await api.get("ApprovalRequest/GetApprovedUnlockRequest", {
        params: { empCode, requestType: "OverTime" },
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data && res.data.approved) {
        setUnlockRange({
          approved: true,
          fromDate: res.data.fromDate,
          toDate: res.data.toDate
        });
      }
    } catch (e) {
      console.warn("Failed to load unlock request", e);
    }
  };

  useEffect(() => {
    if (userLoaded && empCode) {
      loadClients();
      loadOT();
      loadUnlockRequest();
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
    if (!otClient || !otDesc || !otFrom || !otTo || !otDesc) {
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
        "OverTime/save_overtime_duties",
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
      const res = await api.get("OverTime/edit_OverTime", {
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
        "OverTime/approve_overtime",
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
    <div className="onduties-page">
      <div className="onduties-content">
        <div style={{ padding: "20px 16px 10px" }}>
          <h2 style={{ margin: 0, fontWeight: 700 }}>Over-Time Manager</h2>
        </div>

        <div className="ion-padding-horizontal">
          <div style={{ width: "100%", overflowX: "hidden" }} className="overtime-form-container">
            <div className="overtime-form-title compact-title" style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", fontWeight: "700" }}>
              <IonIcon icon={timeOutline} style={{ color: "var(--ion-color-primary)", fontSize: "20px" }} />
              <span style={{ color: "#334155" }}>{otEditingId ? "Edit OT Record" : "Add OT Record"}</span>
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
                  doneText="Done"
                  cancelText="Cancel"
                  value={otDate || undefined}
                  min={unlockRange.approved ? unlockRange.fromDate : minOtDate}
                  max={maxOtDate}
                  isDateEnabled={(dateString) => {
                    const date = dateString.split("T")[0];
                    const today = new Date();
                    const weekAgo = new Date();
                    weekAgo.setDate(today.getDate() - 2);
                    const weekAgoStr = weekAgo.toISOString().split("T")[0];

                    if (date === otDate) return true;
                    if (unlockRange.approved && date >= unlockRange.fromDate && date <= unlockRange.toDate) return true;
                    return date >= weekAgoStr;
                  }}
                  onIonChange={(e) => {
                    const value = e.detail.value as string;
                    if (value) {
                      setOTDate(value.split("T")[0]);
                      setDateModalOpen(false);
                    }
                  }}
                />
              </IonContent>
            </IonModal>

            <div className="lr-bento-grid" style={{ alignItems: "start", marginBottom: "20px" }}>
              {/* OT Date */}
              <div
                className="lr-field-box"
                onClick={() => setDateModalOpen(true)}
                style={{ cursor: "pointer" }}
              >
                <label className="lr-field-label">OT Date</label>
                <div className="lr-field-content">
                  <IonIcon icon={calendarOutline} className="lr-field-icon" />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: otDate ? "#1e293b" : "#94a3b8" }}>
                    {otDate ? moment(otDate).format("DD-MM-YYYY") : "Pick OT Date"}
                  </span>
                </div>
              </div>

              {/* Client / College */}
              <div className="lr-field-box" onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}>
                <label className="lr-field-label">Client / College</label>
                <div className="lr-field-content" ref={clientTriggerRef}>
                  <IonIcon icon={personCircleOutline} className="lr-field-icon" />
                  <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: otClient ? "#1e293b" : "#94a3b8" }}>
                    {otClient || "Select Client"}
                  </span>
                  <ChevronDown size={16} style={{ opacity: 0.7, color: "#94a3b8" }} />

                  {isClientDropdownOpen && createPortal(
                    <>
                      <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsClientDropdownOpen(false); }} />
                      <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${clientDropdownPos.top}px`, left: `${clientDropdownPos.left}px`, width: `${clientDropdownPos.width}px` }}>
                        <div className="dropdown-search-sec">
                          <Search size={16} className="dropdown-search-icon" />
                          <input type="text" placeholder="Search client..." value={clientSearchTerm} onChange={(e) => setClientSearchTerm(e.target.value)} autoFocus className="dropdown-pure-input" />
                          {clientSearchTerm && <button className="dropdown-clear-btn" onClick={() => setClientSearchTerm("")}><X size={16} /></button>}
                        </div>
                        <div className="dropdown-body">
                          {clients.filter(c => c.Client_Name.toLowerCase().includes(clientSearchTerm.toLowerCase())).length > 0 ? (
                            clients.filter(c => c.Client_Name.toLowerCase().includes(clientSearchTerm.toLowerCase())).map((c, index) => {
                              const isSelected = otClient === c.Client_Name;
                              const initials = (c.Client_Name.charAt(0) || "?").toUpperCase();
                              return (
                                <div
                                  key={index}
                                  className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setOTClient(c.Client_Name);
                                    setIsClientDropdownOpen(false);
                                  }}
                                >
                                  <div className={`dr-avatar grad-${(index % 5) || 0}`}>{initials}</div>
                                  <div className="dr-info">
                                    <span className="dr-name">{c.Client_Name}</span>
                                  </div>
                                  {isSelected && <Check size={18} className="dr-check" />}
                                </div>
                              );
                            })
                          ) : <div className="dr-no-results">No clients found</div>}
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              </div>

              {/* FROM TIME */}
              <div className="lr-field-box">
                <label className="lr-field-label">From</label>
                <div className="lr-field-content">
                  <input
                    type="time"
                    value={otFrom}
                    onChange={(e) => setOTFrom(e.target.value)}
                    style={{ border: "none", outline: "none", background: "transparent", flex: 1, color: "#1e293b", fontSize: "14px", fontWeight: "600" }}
                  />
                </div>
              </div>

              {/* TO TIME */}
              <div className="lr-field-box">
                <label className="lr-field-label">To</label>
                <div className="lr-field-content">
                  <input
                    type="time"
                    value={otTo}
                    onChange={(e) => setOTTo(e.target.value)}
                    style={{ border: "none", outline: "none", background: "transparent", flex: 1, color: "#1e293b", fontSize: "14px", fontWeight: "600" }}
                  />
                </div>
              </div>

              {/* Actual */}
              <div className="lr-field-box">
                <label className="lr-field-label">Actual</label>
                <div className="lr-field-content" style={{ justifyContent: "center" }}>
                  <span style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a" }}>{otActualMin} Min</span>
                </div>
              </div>

              {/* Approved */}
              <div className="lr-field-box">
                <label className="lr-field-label">Approved</label>
                <div className="lr-field-content">
                  <input
                    type="number"
                    value={otFinalMin}
                    onChange={(e) => setOTFinalMin(Number(e.target.value || 0))}
                    style={{ border: "none", outline: "none", background: "transparent", flex: 1, color: "#6366f1", fontSize: "16px", fontWeight: "700", textAlign: "center" }}
                  />
                </div>
              </div>

              {/* Work Summary */}
              <div className="lr-field-box">
                <label className="lr-field-label">Work Summary</label>
                <div className="lr-field-content" style={{ alignItems: "flex-start", padding: "12px 16px" }}>
                  <textarea
                    placeholder="Describe OT work done..."
                    value={otDesc}
                    onChange={(e) => setOTDesc(e.target.value)}
                    rows={2}
                    style={{
                      flex: 1, border: "none", background: "transparent",
                      fontSize: 14, fontWeight: 500, outline: "none",
                      resize: "none", color: "#1e293b", fontFamily: "inherit", width: "100%",
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                className="lr-gradient-btn"
                style={{ flex: 1, padding: "14px", borderRadius: "14px", fontSize: "15px", fontWeight: "700" }}
                onClick={saveOT}
              >
                {otEditingId ? "Update OT" : "Save OT"}
              </button>
              {canApprove && otEditingId && (
                <button
                  className="lr-gradient-btn"
                  style={{ flex: 1, padding: "14px", borderRadius: "14px", fontSize: "15px", fontWeight: "700", background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
                  onClick={approveOT}
                >
                  Approve
                </button>
              )}
            </div>
            </div>
          {/* <div className="history-section-title">Over-Time Logs</div>
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
          ))} */}
        </div>

        <IonToast
          isOpen={!!toast}
          message={toast?.msg}
          color={toast?.color as any}
          duration={2500}
          onDidDismiss={() => setToast(null)}
          position="top"
        />
      </div>
    </div>
  );
};

export default OverTime;