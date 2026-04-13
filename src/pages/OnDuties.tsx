// src/pages/OnDuties.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonContent,
  IonLabel,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonDatetime,
  IonModal,
  IonButton,
  IonIcon,
  IonList,
  IonCheckbox,
  IonNote,
  IonDatetimeButton,
  IonToast,
  IonSearchbar,
} from "@ionic/react";
import {
  arrowForwardOutline,
  calendarOutline,
  peopleOutline,
  businessOutline,
  createOutline,
  carOutline,
  timeOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  pencilOutline,
  chevronForwardOutline,
  personCircleOutline,
  locationOutline,
  speedometerOutline,
  documentTextOutline,
  flashOutline
} from "ionicons/icons";
import axios from "axios";
import "./OnDuties.css";

const ENABLE_SMS = true;
import { API_BASE } from "../config";

// ====== Types ======
type ClientItem = { Client_ID: string; Client_Name: string };
type EmployeeItem = {
  EmpCode: string;
  EmpName?: string;
  Mobile?: string;
  Role?: string;
  Designation?: string;
  Ischeck?: string | boolean;
};

type DutyRow = {
  id: string;
  Date: string;
  College: string;
  Description: string;
  Mode_of_Trans: string;
  Start_Time: string;
  End_Time: string;
  Vehicle_No: string;
  Start_Reading: string;
  End_Reading: string;
  Kms: string;
  Status?: string;
  EmpCodes?: string;
};

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

// ====== Helpers ======
const isoToYmd = (val?: string) => {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return val;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`; // Reverted to dashes based on successful Swagger log
  } catch {
    return val;
  }
};
const ymdToDdMmYy = (ymd: string) => {
  if (!ymd) return "";
  // Handles both separators
  const parts = ymd.includes("-") ? ymd.split("-") : ymd.split("/");
  const [y, m, d] = parts;
  if (!y || !m || !d) return ymd;
  return `${d}-${m}-${y}`;
};
const isSaveOk = (data: any) => {
  if (data == null) return false;
  const s = String(data).toLowerCase();
  return s.includes("success") || s.includes("successfully") || parseInt(s, 10) > 0;
};
const minutesBetween = (fromHHmm: string, toHHmm: string) => {
  if (!fromHHmm || !toHHmm) return 0;
  const start = new Date(`2000-01-01T${fromHHmm}:00`);
  const end = new Date(`2000-01-01T${toHHmm}:00`);
  let diff = (end.getTime() - start.getTime()) / 60000;
  return diff < 0 ? 0 : Math.floor(diff);
};
const asBool = (v: any) => (typeof v === "string" ? v.toLowerCase() === "true" : !!v);

const OnDuties: React.FC = () => {
  const [empCode, setEmpCode] = useState<string>("");
  const [empName, setEmpName] = useState<string>("");
  const [userDesig, setUserDesig] = useState<string>("");
  const [userLoaded, setUserLoaded] = useState<boolean>(false);
  const didInitRef = useRef(false);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const [activeTab, setActiveTab] = useState<"onduty" | "overtime">("onduty");

  const api = useMemo(() => {
    const instance = axios.create({ baseURL: API_BASE, timeout: 30000 });
    return instance;
  }, []);

  const isAccountant = empCode === "1541";
  const isDirector = empCode === "1501";
  const canEdit = isAccountant || isDirector;
  const canApprove = isAccountant || userDesig.includes("Team Leader") || userDesig.includes("Manager");

  const postWithFallback = async (endpoint: string, data: any, contentType: string = "application/json"): Promise<any> => {
    try {
      console.log(`[POST][${contentType}] Attempting ${endpoint}`, data);
      let payload = data;
      if (contentType === "application/x-www-form-urlencoded" || contentType === "multipart/form-data") {
        const fd = contentType === "multipart/form-data" ? new FormData() : new URLSearchParams();
        Object.entries(data).forEach(([k, v]) => fd.append(k, String(v ?? "")));
        payload = fd;
      }
      return await api.post(endpoint, payload, { headers: { "Content-Type": contentType } });
    } catch (e: any) {
      const errMsg = e.response?.data || e.message;
      if (e.response?.status === 400 || e.response?.status === 415) {
        if (contentType === "application/json") {
          console.warn(`[POST][JSON] Failed for ${endpoint} with status ${e.response?.status}:`, errMsg);
          return await postWithFallback(endpoint, data, "application/x-www-form-urlencoded");
        }
        if (contentType === "application/x-www-form-urlencoded") {
          console.warn(`[POST][Form] Failed for ${endpoint}, trying multipart/form-data...`);
          return await postWithFallback(endpoint, data, "multipart/form-data");
        }
      }
      throw e;
    }
  };

  const [dutiesDate, setDutiesDate] = useState<string>(isoToYmd(new Date().toISOString()));
  const [institution, setInstitution] = useState<string>("");
  const [dutiesDesc, setDutiesDesc] = useState<string>("");
  const [transportMode, setTransportMode] = useState<string>("");
  const [kms, setKms] = useState<string>("");
  const [vehicleNo, setVehicleNo] = useState<string>("");
  const [sReading, setSReading] = useState<string>("");
  const [eReading, setEReading] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [allEmployees, setAllEmployees] = useState<EmployeeItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [dutiesList, setDutiesList] = useState<DutyRow[]>([]);
  const [editingId, setEditingId] = useState<string>("");

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
  const notify = (msg: string, color: string = "primary") => setToast({ msg, color });

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    try {
      const stored = localStorage.getItem("storedUser") || localStorage.getItem("user") || localStorage.getItem("userData");
      if (stored) {
        const s = JSON.parse(stored);
        setEmpCode(String(s.empCode || s.username || ""));
        setEmpName(String(s.empName || ""));
        setUserDesig(String(s.designation || s.userType || ""));
      }
    } catch (e) {
      console.warn("User parse error", e);
    } finally {
      setUserLoaded(true);
    }
  }, []);

  const loadEmployees = async () => {
    try {
      const res = await api.get("Employee/load_employees_duties", { params: { id: "0" } });
      const raw = Array.isArray(res.data) ? res.data : [];
      console.log(`[API][GET] Employees loaded: ${raw.length} items`, raw);
      setAllEmployees(raw.map((x: any) => ({
        EmpCode: x[0], EmpName: x[1], Role: x[2], Designation: x[3], Ischeck: asBool(x[4]), Mobile: x[5]
      })));
    } catch (e) {
      console.error("[API][GET] Failed to load employees", e);
      notify("Failed to load employees", "danger");
    }
  };

  const loadClients = async (search: string = "") => {
    try {
      const res = await api.get("Workreport/Load_Clients", { params: { College: search } });
      const raw = Array.isArray(res.data) ? res.data : [];
      console.log(`[API][GET] Clients loaded: ${raw.length} items`, raw);
      setClients(raw.map((x: any) => ({ Client_ID: String(x[0]), Client_Name: x[1] })));
    } catch (e) {
      console.error("[API][GET] Load_Clients failed", e);
      setClients([]);
    }
  };

  const loadDuties = async () => {
    try {
      const res = await api.get("Workreport/load_duties", { params: { EmpCode: empCode } });
      const raw = Array.isArray(res.data) ? res.data : [];
      console.log(`[API][GET] On-Duty Logs loaded: ${raw.length} items`, raw);
      setDutiesList(raw.map((r: any) => ({
        id: String(r[0]), EmpCodes: String(r[1]), Date: String(r[2]), Description: String(r[3]), College: String(r[4]),
        Mode_of_Trans: String(r[5]), Kms: String(r[6]), Start_Time: String(r[7]), End_Time: String(r[8]),
        Vehicle_No: String(r[9]), Start_Reading: String(r[10]), End_Reading: String(r[11]),
        Status: r[12] === "Y" ? "Approved" : r[12] === "REJECTED" ? "Rejected" : "Pending"
      })));
    } catch (e) {
      console.error("[API][GET] load_duties failed", e);
      setDutiesList([]);
    }
  };

  const loadOT = async () => {
    try {
      const res = await api.get("Workreport/load_overtime_duties", { params: { EmpCode: empCode } });
      const raw = Array.isArray(res.data) ? res.data : [];
      console.log(`[API][GET] OT Logs loaded: ${raw.length} items`, raw);
      setOTList(raw.map((r: any) => ({
        id: String(r[0]), EmpCode: String(r[1]), Date: String(r[2]), College: String(r[3]), Fromtime: String(r[4]),
        Totime: String(r[5]), Description: String(r[6]), MinDiff: String(r[11] || "0"), Status: r[14] || "Pending",
        EmpCodeName: String(r[15] || "")
      })));
    } catch (e) {
      console.error("[API][GET] load_overtime_duties failed", e);
      setOTList([]);
    }
  };

  useEffect(() => {
    if (userLoaded && empCode) {
      loadEmployees(); loadClients(); loadDuties(); loadOT();
    }
  }, [userLoaded, empCode]);

  const onEndReadingChange = (val: string) => {
    setEReading(val);
    const s = parseFloat(sReading || "0");
    const e = parseFloat(val || "0");
    if (val && !isNaN(s) && !isNaN(e)) {
      if (e < s) { notify("End reading must be more than start", "warning"); setKms(""); }
      else { setKms(`${e - s}Kms`); }
    }
  };

  const saveOnDuty = async () => {
    if (!institution || !dutiesDesc || !transportMode) { notify("Please fill all required fields", "warning"); return; }
    const currentEmpCode = selectedCodes.join(",") || empCode;
    if (!currentEmpCode) { notify("No employee selected or logged in", "danger"); return; }

    const payload = {
      _id: editingId || "0", _empcode: currentEmpCode, _date: dutiesDate, _Client: institution,
      _Description: dutiesDesc, _TransportMode: transportMode, _Starttime: startTime, _Endtime: endTime,
      _VehicleNo: vehicleNo, _StartReading: sReading, _EndReading: eReading, _KMS: kms.replace("Kms", "")
    };
    try {
      const res = await postWithFallback("Workreport/saveduties", payload);
      console.log("[API][POST] saveOnDuty Response:", res.data);
      if (isSaveOk(res.data)) { notify("On-Duty request submitted successfully", "success"); clearOnDutyForm(); loadDuties(); }
    } catch (e) {
      console.error("[API][POST] saveOnDuty failed", e);
      notify("Submission failed", "danger");
    }
  };

  const editOnDuty = async (id: string) => {
    if (!canEdit) { notify("Permission Denied", "danger"); return; }
    try {
      const res = await api.get("Workreport/edit_onduties", { params: { EmpCode: empCode, id } });
      const row = Array.isArray(res.data) && res.data[0] ? res.data[0] : null;
      if (row) {
        setEditingId(String(row[0])); setSelectedCodes(String(row[1]).split(",").filter(Boolean));
        setDutiesDate(isoToYmd(row[2])); setInstitution(row[3]); setDutiesDesc(row[4]); setTransportMode(row[5]);
        setKms(row[6]); setStartTime(row[7]); setEndTime(row[8]); setVehicleNo(row[9]); setSReading(row[10]); setEReading(row[11]);
        contentRef.current?.scrollToTop(500);
        notify("Record loaded for editing");
      }
    } catch (e) { notify("Failed to load record", "danger"); }
  };

  const approveOnDuty = async () => {
    if (!editingId) return;
    const payload = {
      _id: editingId, _empcode: empCode, _date: dutiesDate, _Client: institution, _Description: dutiesDesc,
      _TransportMode: transportMode, _Starttime: startTime, _Endtime: endTime, _VehicleNo: vehicleNo,
      _StartReading: sReading, _EndReading: eReading, _KMS: kms.replace("Kms", "")
    };
    try {
      const res = await postWithFallback("Workreport/SaveDuties_Approve", payload);
      if (isSaveOk(res.data)) { notify("Approved successfully", "success"); clearOnDutyForm(); loadDuties(); }
    } catch (e) { notify("Approval failed", "danger"); }
  };

  const rejectOnDuty = async () => {
    if (!editingId) return;
    try {
      const res = await postWithFallback("Workreport/onduty_rejected", { _id: editingId });
      console.log("[API][POST] rejectOnDuty Response:", res.data);
      if (isSaveOk(res.data)) { notify("Request rejected", "warning"); clearOnDutyForm(); loadDuties(); }
    } catch (e) {
      console.error("[API][POST] rejectOnDuty failed", e);
      notify("Rejection failed", "danger");
    }
  };

  const clearOnDutyForm = () => {
    setEditingId(""); setInstitution(""); setDutiesDesc(""); setTransportMode(""); setKms(""); setVehicleNo("");
    setSReading(""); setEReading(""); setStartTime(""); setEndTime(""); setSelectedCodes([]);
  };

  useEffect(() => {
    const mins = minutesBetween(otFrom, otTo); setOTActualMin(mins); setOTFinalMin(mins);
  }, [otFrom, otTo]);

  const saveOT = async () => {
    if (!otClient || !otDesc || !otFrom || !otTo) { notify("Please fill all OT details", "warning"); return; }
    if (!empCode) { notify("Employee session missing", "danger"); return; }

    const payload = {
      _empcode: String(empCode), _date: String(otDate), _Client: String(otClient), _Fromtime: String(otFrom), _Totime: String(otTo),
      _Description: String(otDesc), _minDiff: String(otActualMin), _FinMinDiff: String(otFinalMin), _Otid: String(otEditingId || "")
    };
    try {
      const res = await postWithFallback("Workreport/save_overtime_duties", payload);
      console.log("[API][POST] saveOT Response:", res.data);
      if (isSaveOk(res.data)) { notify("Overtime saved successfully", "success"); clearOTForm(); loadOT(); }
    } catch (e) {
      console.error("[API][POST] saveOT failed", e);
      notify("OT Save failed", "danger");
    }
  };

  const editOT = async (id: string) => {
    try {
      const res = await api.get("Workreport/edit_OverTime", { params: { id, EmpCode: empCode } });
      const r = Array.isArray(res.data) && res.data[0] ? res.data[0] : null;
      if (r) {
        setOTEditingId(String(r[0])); setOTDate(isoToYmd(r[2])); setOTClient(r[3]); setOTFrom(r[4]); setOTTo(r[5]); setOTDesc(r[6]);
        contentRef.current?.scrollToTop(500);
        notify("OT record loaded");
      }
    } catch (e) { notify("Edit failed", "danger"); }
  };

  const approveOT = async () => {
    if (!otEditingId) return;
    const payload = {
      _id: String(otEditingId), _desig: String(userDesig), _Fromtime: String(otFrom), _Totime: String(otTo),
      _minDiff: String(otActualMin), _FinMinDiff: String(otFinalMin)
    };
    try {
      const res = await postWithFallback("Workreport/approve_overtime", payload);
      console.log("[API][POST] approveOT Response:", res.data);
      if (isSaveOk(res.data)) { notify("Overtime Approved", "success"); clearOTForm(); loadOT(); }
    } catch (e) {
      console.error("[API][POST] approveOT failed", e);
      notify("OT Approve failed", "danger");
    }
  };

  const clearOTForm = () => {
    setOTEditingId(""); setOTClient(""); setOTDesc(""); setOTFrom(""); setOTTo(""); setOTActualMin(0); setOTFinalMin(0);
  };


  return (
    <IonPage className="onduties-page">
      <IonContent className="onduties-content" ref={contentRef} scrollEvents={true}>
        {/* Animated Background Elements */}
        <div className="bg-shape bg-shape-1"></div>
        <div className="bg-shape bg-shape-2"></div>

        {/* Hero Section */}
        <div className="header-container">
          <div className="page-title">Duty Manager</div>
          <div className="custom-tabs">
            <div className={`tab-btn ${activeTab === "onduty" ? "active" : ""}`} onClick={() => setActiveTab("onduty")}>
              On-Duty
            </div>
            <div className={`tab-btn ${activeTab === "overtime" ? "active" : ""}`} onClick={() => setActiveTab("overtime")}>
              Over-Time
            </div>
          </div>
        </div>

        <div className="ion-padding-horizontal">
          {activeTab === "onduty" ? (
            <>
              {/* ON-DUTY FORM */}
              <div className="form-container">
                <div className="form-title">
                  <IonIcon icon={flashOutline} style={{ color: "#6366f1" }} />
                  {editingId ? "Modify Duty Request" : "Register On-Duty"}
                </div>

                <IonGrid className="ion-no-padding">
                  <IonRow>
                    {/* Native side-by-side on Web, stack on Mobile via sizeMd="6" */}
                    <IonCol size="12" sizeMd="6" className="ion-padding-vertical">
                      <div className="input-wrapper">
                        <label className="wrapper-label">Team Members</label>
                        <IonSelect
                          multiple={true}
                          interface="popover"
                          className="lr-popover-select"
                          value={selectedCodes}
                          onIonChange={e => setSelectedCodes(e.detail.value)}
                          placeholder="Select Team"
                        >
                          {allEmployees.map((emp, idx) => (
                            <IonSelectOption key={`${emp.EmpCode}-${idx}`} value={emp.EmpCode}>
                              {emp.EmpName}
                            </IonSelectOption>
                          ))}
                        </IonSelect>
                      </div>
                    </IonCol>

                    <IonCol size="12" sizeMd="6" className="ion-padding-vertical ion-padding-start-md">
                      <div className="input-wrapper">
                        <label className="wrapper-label">Duty Date</label>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 700 }}>{ymdToDdMmYy(dutiesDate)}</span>
                          <IonDatetimeButton datetime="od-date" />
                        </div>
                        <IonModal keepContentsMounted={true} className="native-modal">
                          <IonDatetime id="od-date" presentation="date" value={dutiesDate} onIonChange={e => setDutiesDate(isoToYmd(e.detail.value as string))} />
                        </IonModal>
                      </div>
                    </IonCol>
                  </IonRow>

                  <IonRow>
                    <IonCol size="12" sizeMd="6" className="ion-padding-vertical">
                      <div className="input-wrapper">
                        <label className="wrapper-label">Client / Institution</label>
                        <IonSelect interface="popover" toggleIcon={businessOutline} className="lr-popover-select" placeholder="Search College" value={institution} onIonChange={e => setInstitution(e.detail.value)}>
                          {clients.map((c, idx) => <IonSelectOption key={`${c.Client_ID}-${idx}`} value={c.Client_Name}>{c.Client_Name}</IonSelectOption>)}
                        </IonSelect>
                      </div>
                    </IonCol>
                    <IonCol size="12" sizeMd="6" className="ion-padding-vertical ion-padding-start-md">
                      <div className="input-wrapper">
                        <label className="wrapper-label">Work Description</label>
                        <IonInput className="glass-input-field" placeholder="Ex: System installation..." value={dutiesDesc} onIonInput={e => setDutiesDesc(e.detail.value || "")} />
                      </div>
                    </IonCol>
                  </IonRow>

                  <IonRow>
                    <IonCol size="12" sizeMd="4" className="ion-padding-vertical">
                      <div className="input-wrapper">
                        <label className="wrapper-label">Transport</label>
                        <IonSelect interface="popover" className="lr-popover-select" value={transportMode} onIonChange={e => setTransportMode(e.detail.value)}>
                          <IonSelectOption value="OnSite">On-Site Work</IonSelectOption>
                          <IonSelectOption value="PublicTransport">Public Transport</IonSelectOption>
                          <IonSelectOption value="Twowheeler">Two Wheeler</IonSelectOption>
                          <IonSelectOption value="OfficeVehicle">Office Vehicle</IonSelectOption>
                        </IonSelect>
                      </div>
                    </IonCol>
                    <IonCol size="6" sizeMd="4" className="ion-padding-vertical ion-padding-start-md">
                      <div className="input-wrapper">
                        <label className="wrapper-label">Times (S / E)</label>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <IonInput type="time" className="glass-input-field" value={startTime} onIonInput={e => setStartTime(e.detail.value || "")} />
                          <IonInput type="time" className="glass-input-field" value={endTime} onIonInput={e => setEndTime(e.detail.value || "")} />
                        </div>
                      </div>
                    </IonCol>
                    <IonCol size="6" sizeMd="4" className="ion-padding-vertical ion-padding-start-md">
                      <div className="input-wrapper">
                        <label className="wrapper-label">Vehicle No</label>
                        <IonInput className="glass-input-field" placeholder="AP16..." value={vehicleNo} onIonInput={e => setVehicleNo(e.detail.value || "")} />
                      </div>
                    </IonCol>
                  </IonRow>

                  <IonRow>
                    <IonCol size="12" className="ion-padding-vertical">
                      <div className="input-wrapper">
                        <label className="wrapper-label">Log Readings (Start • End • Total KMS)</label>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <IonInput className="glass-input-field" placeholder="Start" value={sReading} onIonInput={e => setSReading(e.detail.value || "")} />
                          <div style={{ color: "#cbd5e1" }}>•</div>
                          <IonInput className="glass-input-field" placeholder="End" value={eReading} onIonInput={e => onEndReadingChange(e.detail.value || "")} />
                          <div className="badge-pill pill-approved" style={{ marginLeft: "auto" }}>
                            <IonIcon icon={speedometerOutline} /> {kms || "0 KMS"}
                          </div>
                        </div>
                      </div>
                    </IonCol>
                  </IonRow>

                  <div className="action-buttons" style={{ marginTop: "20px" }}>
                    <IonButton className="premium-action-btn" expand="block" onClick={saveOnDuty}>
                      Submit Report
                    </IonButton>

                    {isAccountant && editingId && (
                      <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                        <IonButton color="success" style={{ flex: 1, borderRadius: "16px" }} onClick={approveOnDuty}>
                          Approve
                        </IonButton>
                        <IonButton color="danger" style={{ flex: 1, borderRadius: "16px" }} onClick={rejectOnDuty}>
                          Reject
                        </IonButton>
                      </div>
                    )}
                  </div>
                </IonGrid>
              </div>

              {/* ON-DUTY HISTORY */}
              <div className="history-section-title">Verified Duty Logs</div>
              {dutiesList.map((row, idx) => (
                <div key={`${row.id}-${idx}`} className="premium-card">
                  <div className="card-accent"></div>
                  <div className="card-header">
                    <div style={{ flex: 1 }}>
                      <div className="college-name">{row.College}</div>
                      <div className="entry-date">{ymdToDdMmYy(row.Date)}</div>
                    </div>
                    <div className={`badge-pill pill-${row.Status?.toLowerCase()}`}>
                      {row.Status}
                    </div>
                  </div>
                  <div className="desc-box">{row.Description}</div>
                  <div className="card-footer-grid">
                    <div className="footer-item">
                      <span className="item-label">Transport</span>
                      <span className="item-value">{row.Mode_of_Trans}</span>
                    </div>
                    <div className="footer-item">
                      <span className="item-label">Timeline</span>
                      <span className="item-value">{row.Start_Time} - {row.End_Time}</span>
                    </div>
                    <div className="footer-item">
                      <span className="item-label">Distance</span>
                      <span className="item-value">{row.Kms}</span>
                    </div>
                    {canEdit && (
                      <IonButton fill="clear" color="primary" className="ion-no-margin" onClick={() => editOnDuty(row.id)}>
                        <IonIcon icon={pencilOutline} />
                      </IonButton>
                    )}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              {/* OVER-TIME FORM */}
              <div className="form-container">
                <div className="form-title">
                  <IonIcon icon={timeOutline} style={{ color: "#6366f1" }} />
                  {otEditingId ? "Edit OT Records" : "Record Over-Time"}
                </div>

                <IonGrid className="ion-no-padding">
                  <IonRow>
                    <IonCol size="12" sizeMd="6" className="ion-padding-vertical">
                      <div className="input-wrapper">
                        <label className="wrapper-label">OT Date</label>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 700 }}>{ymdToDdMmYy(otDate)}</span>
                          <IonDatetimeButton datetime="ot-date" />
                        </div>
                        <IonModal keepContentsMounted={true} className="native-modal">
                          <IonDatetime id="ot-date" presentation="date" value={otDate} onIonChange={e => setOTDate(isoToYmd(e.detail.value as string))} />
                        </IonModal>
                      </div>
                    </IonCol>
                    <IonCol size="12" sizeMd="6" className="ion-padding-vertical ion-padding-start-md">
                      <div className="input-wrapper">
                        <label className="wrapper-label">Client / College</label>
                        <IonSelect interface="popover" className="glass-input-field" value={otClient} onIonChange={e => setOTClient(e.detail.value)}>
                          {clients.map((c, idx) => <IonSelectOption key={`${c.Client_ID}-${idx}`} value={c.Client_Name}>{c.Client_Name}</IonSelectOption>)}
                        </IonSelect>
                      </div>
                    </IonCol>
                  </IonRow>

                  <IonRow>
                    <IonCol size="12" sizeMd="4" className="ion-padding-vertical">
                      <div className="input-wrapper">
                        <label className="wrapper-label">Duration (From - To)</label>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <IonInput type="time" className="glass-input-field" value={otFrom} onIonInput={e => setOTFrom(String(e.detail.value || ""))} />
                          <div style={{ color: "#cbd5e1" }}>•</div>
                          <IonInput type="time" className="glass-input-field" value={otTo} onIonInput={e => setOTTo(String(e.detail.value || ""))} />
                        </div>
                      </div>
                    </IonCol>
                    <IonCol size="6" sizeMd="4" className="ion-padding-vertical ion-padding-start-md">
                      <div className="input-wrapper">
                        <label className="wrapper-label">Actual Minutes</label>
                        <IonInput className="glass-input-field" value={otActualMin} readonly />
                      </div>
                    </IonCol>
                    <IonCol size="6" sizeMd="4" className="ion-padding-vertical ion-padding-start-md">
                      <div className="input-wrapper">
                        <label className="wrapper-label">Approved Min.</label>
                        <IonInput className="glass-input-field" placeholder="Final min..." value={otFinalMin} onIonInput={e => setOTFinalMin(Number(e.detail.value || 0))} />
                      </div>
                    </IonCol>
                  </IonRow>

                  <IonRow>
                    <IonCol size="12" className="ion-padding-vertical">
                      <div className="input-wrapper">
                        <label className="wrapper-label">Work Summary</label>
                        <IonInput className="glass-input-field" placeholder="What was achieved during OT?" value={otDesc} onIonInput={e => setOTDesc(e.detail.value || "")} />
                      </div>
                    </IonCol>
                  </IonRow>

                  <div className="action-buttons" style={{ marginTop: "20px" }}>
                    <IonButton className="premium-action-btn" expand="block" onClick={saveOT}>
                      Submit OT Record
                    </IonButton>
                    {canApprove && otEditingId && (
                      <IonButton color="success" style={{ marginTop: "15px", borderRadius: "16px" }} expand="block" onClick={approveOT}>
                        Approve Minutes
                      </IonButton>
                    )}
                  </div>
                </IonGrid>
              </div>

              {/* OT HISTORY */}
              <div className="history-section-title">Over-Time Logs</div>
              {otList.map((row, idx) => (
                <div key={`${row.id}-${idx}`} className="premium-card">
                  <div className="card-header">
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", fontSize: "0.85rem", color: "#000", fontWeight: 600 }}>
                        <IonIcon icon={personCircleOutline} style={{ fontSize: "1.1rem", color: "#6366f1" }} />
                        <span>{row.EmpCodeName}</span>
                      </div>
                      <div className="college-name">{row.College}</div>
                      <div className="entry-date">{ymdToDdMmYy(row.Date)}</div>
                    </div>
                    <div className={`badge-pill pill-${String(row.Status).toLowerCase().includes("pending") ? "pending" : String(row.Status).toLowerCase().includes("rejected") ? "rejected" : "approved"}`}>
                      {row.Status}
                    </div>
                  </div>
                  <div className="desc-box">{row.Description}</div>
                  <div className="card-footer-grid">
                    <div className="footer-item">
                      <span className="item-label">Timeline</span>
                      <span className="item-value">{row.Fromtime} - {row.Totime}</span>
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
            </>
          )}
        </div>



        <IonToast isOpen={!!toast} message={toast?.msg} color={toast?.color as any} duration={2500} onDidDismiss={() => setToast(null)} position="top" />
      </IonContent>
    </IonPage>
  );
};

export default OnDuties;
