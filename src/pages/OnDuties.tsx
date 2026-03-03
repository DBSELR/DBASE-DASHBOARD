// src/pages/OnDuties.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonContent,
  IonLabel,
  IonSegment,
  IonSegmentButton,
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
} from "@ionic/react";
import { arrowForwardOutline, calendarOutline, peopleOutline } from "ionicons/icons";
import axios from "axios";

const ENABLE_SMS = false;
// ====== API base ======
const API_BASE = "http://localhost:25918/api/";

// ====== Types ======
type ClientItem = { Client_ID: string; Client_Name: string };
type EmployeeItem = {
  EmpCode: string;
  EmpName?: string;
  Mobile?: string;
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
  Status?: "S" | "P" | "V" | "A" | string | null;
  TL_Verified?: string | null;
  Accnt_Verified?: string | null;
  Director_Verified?: string | null;
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
    return `${y}-${m}-${day}`;
  } catch {
    return val;
  }
};
const ymdToDdMmYy = (ymd: string) => {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}-${m}-${y}`;
};
const isSaveOk = (data: any) => {
  if (data == null) return false;
  if (typeof data === "number") return data > 0;
  const s = String(data).toLowerCase();
  if (s.includes("success")) return true;
  const n = parseInt(s, 10);
  return !Number.isNaN(n) && n > 0;
};
const minutesBetween = (fromHHmm: string, toHHmm: string) => {
  if (!fromHHmm || !toHHmm) return 0;
  const start = new Date(`2000-01-01T${fromHHmm}:00`);
  const end = new Date(`2000-01-01T${toHHmm}:00`);
  let diff = (end.getTime() - start.getTime()) / 60000;
  if (diff < 0) diff = 0;
  return Math.floor(diff);
};
const asBool = (v: any) => (typeof v === "string" ? v.toLowerCase() === "true" : !!v);

// ====== Page ======
const OnDuties: React.FC = () => {
  // ----- user context (from storage) -----
  const [empCode, setEmpCode] = useState<string>("");
  const [empName, setEmpName] = useState<string>("");
  const [userDesig, setUserDesig] = useState<string>("");
  const [userLoaded, setUserLoaded] = useState<boolean>(false);
  
const didInitRef = useRef(false);


  // ----- tab -----
  const [activeTab, setActiveTab] = useState<"onduty" | "overtime">("onduty");

  // ----- common axios with logs -----
  const api = useMemo(() => {
    const instance = axios.create({ baseURL: API_BASE, timeout: 30000 });

  instance.interceptors.request.use((config: any) => {
    if (!config.headers?.["x-quiet"]) {
      console.log(
        "[duties][request]",
        (config.method || "GET").toUpperCase(),
        (config.baseURL || "") + (config.url || ""),
        { params: config.params, data: config.data, headers: config.headers }
      );
    }
    return config;
  });

  instance.interceptors.response.use(
    (res) => {
      if (!res.config?.headers?.["x-quiet"]) {
        console.log("[duties][response]", res.status, res.config.url, res.data);
      }
      return res;
    },
    (error) => {
      if (!error?.config?.headers?.["x-quiet"]) {
        console.error(
          "[duties][error]",
          error?.response?.status,
          error?.config?.url,
          error?.response?.data || error.message
        );
      }
      return Promise.reject(error);
    }
  );
  return instance;
}, []);

// after: const api = useMemo(() => { ... }, []);


// ✅ place right below: const api = useMemo(() => { ... }, []);
const postWithFallback = async (url: string, payload: Record<string, any>) => {
  // 1) JSON
  try {
    return await api.post(url, payload, { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    const s = e?.response?.status;
    if (s !== 415 && s !== 400) throw e; // only fall back on media/validation issues
  }

  // 2) x-www-form-urlencoded
  try {
    const form = new URLSearchParams();
    Object.entries(payload).forEach(([k, v]) => form.append(k, v == null ? "" : String(v)));
    return await api.post(url, form, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  } catch (e: any) {
    const s = e?.response?.status;
    if (s !== 415 && s !== 400) throw e;
  }

  // 3) multipart/form-data
  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => fd.append(k, v == null ? "" : String(v)));
  return api.post(url, fd); // let browser set boundary
};





  // ====== On-Duty state ======
  const [showEmpModal, setShowEmpModal] = useState(false);

  const [dutiesDate, setDutiesDate] = useState<string>("");
  const [institution, setInstitution] = useState<string>("");
  const [dutiesDesc, setDutiesDesc] = useState<string>("");
  const [transportMode, setTransportMode] = useState<string>("");
  const [kms, setKms] = useState<string>("");
  const [vehicleNo, setVehicleNo] = useState<string>("");
  const [sReading, setSReading] = useState<string>("");
  const [eReading, setEReading] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");

  // Controls
  const [disableVehicle, setDisableVehicle] = useState<boolean>(false);
  const [disableKms, setDisableKms] = useState<boolean>(true);
  const [transportMsg, setTransportMsg] = useState<string>("");

  // Employees
  const [allEmployees, setAllEmployees] = useState<EmployeeItem[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const selectedCodesStr = selectedCodes.length ? selectedCodes.join(",") : "Select Employees";

  // Clients (for both Institution and OT client dropdowns)
  const [clients, setClients] = useState<ClientItem[]>([]);

  // Grid + editing
  const [dutiesList, setDutiesList] = useState<DutyRow[]>([]);
  const [editingId, setEditingId] = useState<string>("");

  // ====== Over-Time state ======
  const [otDate, setOTDate] = useState<string>("");
  const [otClient, setOTClient] = useState<string>("");
  const [otFrom, setOTFrom] = useState<string>("");
  const [otTo, setOTTo] = useState<string>("");
  const [otActualMin, setOTActualMin] = useState<number>(0);
  const [otFinalMin, setOTFinalMin] = useState<number>(0);
  const [otDesc, setOTDesc] = useState<string>("");
  const [otList, setOTList] = useState<OTrow[]>([]);
  const [otEditingId, setOTEditingId] = useState<string>("");

  // state + helper
const [toast, setToast] = useState<{ msg: string; color?: string } | null>(null);
const notify = (msg: string, color: string = "primary") => setToast({ msg, color });


  // Approvals toggles
  const canApproveDuties = userDesig === "Director" || userDesig === "In-Charge F&A";


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
      setEmpName(String(s.empName || ""));
      setUserDesig(String(s.designation || s.userType || ""));
      console.log("[duties][init] stored user:", s);
    } else {
      console.log("[duties][init] no stored user");
    }
  } catch (e) {
    console.warn("[duties][init] failed to parse stored user", e);
  } finally {
    setUserLoaded(true);
  }
}, []);


  // Default today’s date for convenience
  useEffect(() => {
    const today = isoToYmd(new Date().toISOString());
    setDutiesDate((d) => d || today);
    setOTDate((d) => d || today);
  }, []);

  // ====== LOADERS ======
  const normalizeClients = (raw: any): ClientItem[] => {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((x: any) => ({
        Client_ID: String(x?.Client_ID ?? x?.[0] ?? ""),
        Client_Name: String(x?.Client_Name ?? x?.[1] ?? ""),
      }))
      .filter((c) => c.Client_ID && c.Client_Name && c.Client_Name !== "null" && c.Client_Name.trim() !== "");
  };

  const normalizeEmployees = (raw: any): EmployeeItem[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((x: any) => ({
      EmpCode: String(x?.EmpCode ?? x?.[0] ?? ""),
      EmpName: x?.EmpName ?? x?.[1],
      Mobile: x?.Mobile ?? x?.[5] ?? x?.[2],
      Ischeck: asBool(x?.Ischeck ?? x?.[4] ?? false),
    }));
  };

  const normalizeDuties = (raw: any): DutyRow[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((r: any) => {
      if (Array.isArray(r)) {
        return {
          id: String(r[0] ?? ""),
          Date: r[12] || r[10] || r[1],
          College: r[2] || r[5] || "",
          Description: r[3] || r[6] || "",
          Mode_of_Trans: r[4] || "",
          Start_Time: r[5] || r[8] || "",
          End_Time: r[6] || r[9] || "",
          Vehicle_No: r[7] || "",
          Start_Reading: r[8] || "",
          End_Reading: r[9] || "",
          Kms: r[10] || "",
          Status: r[11] || "",
          EmpCodes: r[12] || "",
        } as DutyRow;
      }
      return {
        id: String(r?.id ?? r?.RID ?? ""),
        Date: r?.Date,
        College: r?.College,
        Description: r?.Description,
        Mode_of_Trans: r?.Mode_of_Trans,
        Start_Time: r?.Start_Time,
        End_Time: r?.End_Time,
        Vehicle_No: r?.Vehicle_No,
        Start_Reading: r?.Start_Reading,
        End_Reading: r?.End_Reading,
        Kms: r?.Kms,
        Status: r?.Status,
        EmpCodes: r?.EmpCodes,
      } as DutyRow;
    });
  };

  const normalizeOT = (raw: any): OTrow[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((r: any) => {
      if (Array.isArray(r)) {
        const empCode = String(r[1] ?? "");
        const empName = String(r[12] ?? "");
        const empCodeName = (r[15] as string) || (empCode && empName ? `${empCode}-${empName}` : empCode);
        const pendingAt = (r[14] && String(r[14])) || (r[10] && String(r[10])) || null;
        return {
          id: String(r[0] ?? ""),
          EmpCode: empCode,
          EmpCodeName: empCodeName,
          Date: String(r[2] ?? ""),
          College: String(r[3] ?? ""),
          Fromtime: String(r[4] ?? ""),
          Totime: String(r[5] ?? ""),
          Description: String(r[6] ?? ""),
          TL_Verified: r[7] ?? null,
          Accnt_Verified: r[8] ?? null,
          Director_Verified: r[9] ?? null,
          MinDiff: r[11] ?? null,
          Status: r[13] ?? null,
          PendingAt: pendingAt,
        } as OTrow;
      }
      return {
        id: String(r?.id ?? ""),
        EmpCodeName: r?.EmpCodeName ?? r?.EmpCode,
        EmpCode: r?.EmpCode,
        Date: r?.Date,
        College: r?.College,
        Description: r?.Description,
        Fromtime: r?.Fromtime,
        Totime: r?.Totime,
        MinDiff: r?.MinDiff ?? null,
        FinMinDiff: r?.FinMinDiff ?? null,
        PendingAt: r?.PendingAt ?? null,
        Status: r?.Status ?? null,
        TL_Verified: r?.TL_Verified ?? r?.TL_Ver ?? null,
        Accnt_Verified: r?.Accnt_Verified ?? r?.Accnt_Ver ?? null,
        Director_Verified: r?.Director_Verified ?? r?.dir_Ver ?? null,
      } as OTrow;
    });
  };

  const loadClients = async () => {
    try {
      const res = await api.get("Workreport/Load_Clients", { params: { College: "" } });
      setClients(normalizeClients(res.data));
    } catch {
      setClients([]);
    }
  };

  const loadEmployees = async (id: string) => {
    try {
      const _id = id && id !== "" ? id : "0";
      const res = await api.get("Employee/load_employees_duties", {
        params: { SearchEmp: "Active", id: _id },
      });
      const list = normalizeEmployees(res.data);
      setAllEmployees(list);
      const preselected = list.filter((x) => asBool(x.Ischeck)).map((x) => x.EmpCode);
      if (preselected.length) setSelectedCodes(preselected);
    } catch {
      setAllEmployees([]);
      setSelectedCodes([]);
    }
  };

  const loadDuties = async () => {
    try {
      const res = await api.get("Workreport/load_duties", { params: { EmpCode: empCode } });
      setDutiesList(normalizeDuties(res.data));
    } catch {
      setDutiesList([]);
    }
  };

  const loadOT = async () => {
    try {
      const res = await api.get("Workreport/load_overtime_duties", { params: { EmpCode: empCode } });
      setOTList(normalizeOT(res.data));
    } catch {
      setOTList([]);
    }
  };

  // Initial load
  useEffect(() => {
    if (!userLoaded || !empCode) return;
    loadClients();
    loadEmployees("");
    loadDuties();
    loadOT();
  }, [userLoaded, empCode]); // eslint-disable-line

  // ====== Handlers ======
  const onTransportChange = (val: string) => {
    setTransportMode(val);
    setDisableVehicle(val !== "OfficeVehicle");
    setDisableKms(!(val === "PublicTransport" || val === "Twowheeler"));
    if (val === "OnSite") setTransportMsg("Only DA will be calculated");
    else if (val === "PublicTransport") setTransportMsg("DA and TA will be calculated");
    else if (val === "Twowheeler") setTransportMsg("DA and TA will be calculated");
    else if (val === "OfficeVehicle") setTransportMsg("Only DA will be calculated");
    else setTransportMsg("");
  };

  const onEndReadingChange = (val: string) => {
    setEReading(val);
    const s = parseFloat(sReading || "0");
    const e = parseFloat(val || "0");
    if (val && !Number.isNaN(s) && !Number.isNaN(e)) {
      if (e < s) {
        alert("End-Reading must be greater than Start-Reading");
        setEReading("");
        setKms("");
      } else {
        const diff = e - s;
        setKms(`${diff}Kms`);
      }
    }
  };

  const toggleEmp = (code: string, checked: boolean) => {
    setSelectedCodes((prev) => {
      const set = new Set(prev);
      if (checked) set.add(code);
      else set.delete(code);
      return Array.from(set);
    });
  };

  // ====== Save / Approve / Reject (On-Duty) ======
const sendSMS_OnDutySubmitted = async (codesCsv: string, dateYmd: string, clientName: string) => {
  if (!ENABLE_SMS) return; // 🚫 dev off
  try {
    const acct = allEmployees.find((x) => x.EmpCode === "1541");
    const mobile = acct?.Mobile;
    if (!mobile) return;
    const raised = ymdToDdMmYy(dateYmd);
    const msg = `On-Duty Request Submitted For Approval // Employee Codes : ${codesCsv} // Date : ${raised} // Client : ${clientName}`;
    await api.get("Sources/sendMessage", {
      params: { phoneNo: mobile, message: msg },
      headers: { "x-quiet": "1" }, // 🤫 no console error even if 404
    });
  } catch { /* ignore */ }
};


  const sendSMS_OnDutyApproved = async (dateYmd: string) => {
    try {
      const raised = ymdToDdMmYy(dateYmd);
      console.log("[duties][sms][approved] prepared:", `Your On-Duty Request Has Been Approved // Raised Date : ${raised}`);
    } catch {}
  };

  const saveOnDuty = async () => {
    const dateYmd = dutiesDate || isoToYmd(new Date().toISOString());
    const codesCsv = selectedCodes.join(",");
    const payload = {
      _id: editingId || "",
      _empcode: codesCsv,
      _date: dateYmd,
      _Client: institution,
      _Description: dutiesDesc,
      _TransportMode: transportMode,
      _Starttime: startTime,
      _Endtime: endTime,
      _VehicleNo: vehicleNo,
      _StartReading: sReading,
      _EndReading: eReading,
      _KMS: kms,
    };
    console.log("[duties][save OnDuty] payload:", payload);

    if (!dateYmd || !institution || !dutiesDesc || !transportMode) {
      alert("All required fields must be filled (date, institution, description, transport mode).");
      return;
    }
    try {
      const res = await api.post("Workreport/saveduties", payload, {
        headers: { "Content-Type": "application/json" },
      });
      if (isSaveOk(res.data)) {
        notify("✅ Saved Successfully!");
        try {
          await sendSMS_OnDutySubmitted(codesCsv, dateYmd, institution);
        } catch {}
        await loadDuties();
        clearOnDutyForm(false);
        return;
      }
      alert(`❌ Save Error. Server said: ${String(res.data)}`);
    } catch (e: any) {
      // Fallback to form-urlencoded
      const form = new URLSearchParams();
      Object.entries(payload).forEach(([k, v]) => form.append(k, String(v ?? "")));
      try {
        const res2 = await api.post("Workreport/saveduties", form, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        if (isSaveOk(res2.data)) {
          alert("✅ Saved Successfully!");
          try {
            await sendSMS_OnDutySubmitted(codesCsv, dateYmd, institution);
          } catch {}
          await loadDuties();
          clearOnDutyForm(false);
          return;
        }
        alert(`❌ Save Error. Server said: ${String(res2.data)}`);
      } catch (e2) {
        console.error("[duties][save OnDuty][form] failed", e2);
        alert("❌ API Error");
      }
    }
  };

  const approveOnDuty = async () => {
    const dateYmd = dutiesDate || isoToYmd(new Date().toISOString());
    const codesCsv = selectedCodes.join(",");
    const payload = {
      _id: editingId || "",
      _empcode: codesCsv,
      _date: dateYmd,
      _Client: institution,
      _Description: dutiesDesc,
      _TransportMode: transportMode,
      _Starttime: startTime,
      _Endtime: endTime,
      _VehicleNo: vehicleNo,
      _StartReading: sReading,
      _EndReading: eReading,
      _KMS: kms,
    };
    if (!editingId) {
      alert("Open a record (Edit) before approving.");
      return;
    }
    try {
      const res = await api.post("Workreport/saveduties_approve", payload, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (isSaveOk(res.data)) {
        notify("✅ Approved!");
        try {
          await sendSMS_OnDutyApproved(dateYmd);
        } catch {}
        await loadDuties();
        clearOnDutyForm(true);
      } else {
        alert("❌ Approve Error.");
      }
    } catch {
      alert("❌ API Error");
    }
  };

  const rejectOnDuty = async () => {
    if (!editingId) {
      alert("Open a record (Edit) before rejecting.");
      return;
    }
    try {
      const form = new URLSearchParams();
      form.append("_id", editingId);
      const res = await api.post("Workreport/onduty_rejected", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (isSaveOk(res.data)) {
        notify("✅ On-Duty Request Rejected!");
        await loadDuties();
        clearOnDutyForm(true);
      } else {
        alert("❌ Reject Error.");
      }
    } catch {
      alert("❌ API Error");
    }
  };

  // ====== Edit (On-Duty) ======
  const editOnDuty = async (id: string) => {
    try {
      const res = await api.get("Workreport/edit_onduties", {
        params: { EmpCode: empCode, id },
      });
      const row = Array.isArray(res.data) && res.data[0] ? res.data[0] : null;
      if (!row) return;

      setEditingId(String(row["id"] ?? id));
      setDutiesDate(isoToYmd(String(row["Date"])));
      setInstitution(String(row["College"] ?? ""));
      setDutiesDesc(String(row["Description"] ?? ""));
      const _mode = String(row["Mode_of_Trans"] ?? "");
      setTransportMode(_mode);
      onTransportChange(_mode);

      setStartTime(String(row["Start_Time"] ?? ""));
      setEndTime(String(row["End_Time"] ?? ""));
      setVehicleNo(String(row["Vehicle_No"] ?? ""));
      setSReading(String(row["Start_Reading"] ?? ""));
      setEReading(String(row["End_Reading"] ?? ""));
      setKms(String(row["Kms"] ?? ""));
      const codesStr = String(row["EmpCodes"] ?? "");
      const codesArr = codesStr ? codesStr.split(",").filter(Boolean) : [];
      setSelectedCodes(codesArr);

      await loadEmployees(String(row["id"] ?? id));

      const status = String(row["Status"] ?? "");
      if (status === "Y") {
        alert("Already Approved.");
      }
    } catch (e) {
      console.error("[duties][edit OnDuty] failed", e);
    }
  };

  const clearOnDutyForm = (clearEditing: boolean) => {
    if (clearEditing) setEditingId("");
    setInstitution("");
    setDutiesDesc("");
    setTransportMode("");
    setTransportMsg("");
    setStartTime("");
    setEndTime("");
    setVehicleNo("");
    setSReading("");
    setEReading("");
    setKms("");
    setSelectedCodes([]);
  };

  // ====== Over-Time actions ======
  useEffect(() => {
    const mins = minutesBetween(otFrom, otTo);
    setOTActualMin(mins);
    setOTFinalMin(mins);
  }, [otFrom, otTo]);

const saveOvertime = async () => {
  const dateYmd = otDate || isoToYmd(new Date().toISOString());

  const payload = {
    _empcode: String(empCode),
    _date: String(dateYmd),
    _Client: String(otClient),
    _Description: String(otDesc),
    _Fromtime: String(otFrom).trim(),
    _Totime:   String(otTo).trim(),
    _minDiff:  String(otActualMin),    // stringify to satisfy model binders
    _FinMinDiff: String(otFinalMin),
    _id: String(otEditingId || ""),    // ✅ include _id
    _Otid: String(otEditingId || ""),  // keep this too (harmless if unused)
  };

  if (!dateYmd || !otClient || !otDesc || !otFrom || !otTo || !otActualMin) {
    notify("Fields should not be blank.", "danger");
    return;
  }

  try {
    const res = await postWithFallback("Workreport/save_overtime_duties", payload);
    if (isSaveOk(res.data)) {
      notify("OverTime reported!", "success");
      await loadOT();
      clearOTForm();
    } else {
      notify("Save error.", "danger");
    }
  } catch (e: any) {
    const lines = extractValidation(e);
    if (lines) notify(lines.join(" | "), "danger");
    else notify("API error while saving OT.", "danger");
  }
};




  // put near the top of the file
const toForm = (obj: Record<string, any>) => {
  const form = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => form.append(k, v == null ? "" : String(v)));
  return form;
};


  const editOvertime = async (id: string) => {
    try {
      const res = await api.get("Workreport/edit_OverTime", { params: { id, Empcode: empCode } });
      const r = Array.isArray(res.data) && res.data[0] ? res.data[0] : null;
      if (!r) return;

      setOTEditingId(String(r["id"] ?? id));
      setOTDate(isoToYmd(String(r["Date"])));
      setOTClient(String(r["College"] ?? ""));
      setOTDesc(String(r["Description"] ?? ""));
      setOTFrom(String(r["Fromtime"] ?? ""));
      setOTTo(String(r["Totime"] ?? ""));
      setOTActualMin(Number(r["MinDiff"] ?? 0));
      setOTFinalMin(Number(r["FinMinDiff"] ?? 0));
    } catch (e) {
      console.error("[duties][edit OT] failed", e);
    }
  };

const approveOvertime = async () => {
  if (!otEditingId) { notify("Open an OT record before approving.", "warning"); return; }
  if (otFinalMin > otActualMin) { notify("Approved minutes cannot exceed actual.", "warning"); return; }

  const payload = {
    _id: otEditingId,
    _desig: userDesig,
    _Fromtime: otFrom,
    _Totime: otTo,
    _minDiff: otActualMin,
    _FinMinDiff: otFinalMin,
  };

  try {
    const res = await postWithFallback("Workreport/approve_overtime", payload);
    if (isSaveOk(res.data)) {
      notify("OverTime approved!", "success");
      await loadOT();
      clearOTForm();
    } else {
      notify("Approve error.", "danger");
    }
  } catch {
    notify("API error while approving OT.", "danger");
  }
};



  const clearOTForm = () => {
    setOTEditingId("");
    setOTClient("");
    setOTDesc("");
    setOTFrom("");
    setOTTo("");
    setOTActualMin(0);
    setOTFinalMin(0);
  };


  

  // ====== UI ======
  return (
    <IonPage>

      <IonToast
  isOpen={!!toast}
  message={toast?.msg}
  color={toast?.color as any}
  duration={2200}
  onDidDismiss={() => setToast(null)}
/>

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
        <IonSegment
          value={activeTab}
          onIonChange={(e) => setActiveTab(e.detail.value as any)}
          className="custom-segment"
        >
          <IonSegmentButton value="onduty">
            <IonLabel>On-Duty</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="overtime">
            <IonLabel>Over-Time</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {activeTab === "onduty" && (
          <>
            <IonGrid className="form-grid">
              <IonRow>
                {/* Employees multi-select (modal) */}
                <IonCol size="12" sizeMd="2">
                  <IonItem button onClick={() => setShowEmpModal(true)}>
                    <IonIcon icon={peopleOutline} slot="start" />
                    <IonInput value={selectedCodesStr} readonly />
                  </IonItem>
                </IonCol>

                {/* Date */}
                <IonCol size="12" sizeMd="2">
                  <IonItem lines="none">
                    <IonIcon icon={calendarOutline} slot="start" />
                    <IonInput readonly value={dutiesDate ? ymdToDdMmYy(dutiesDate) : "Date*"} />
                    <IonDatetimeButton datetime="od-date" slot="end" />
                  </IonItem>
                  <IonModal keepContentsMounted={true}>
                    <IonDatetime
                      id="od-date"
                      presentation="date"
                      onIonChange={(e) => {
                        const val = typeof e.detail.value === "string" ? e.detail.value : undefined;
                        if (!val) return;
                        setDutiesDate(isoToYmd(val));
                      }}
                    />
                  </IonModal>
                </IonCol>

                {/* Institution DROPDOWN */}
                <IonCol size="12" sizeMd="3">
                  <IonItem>
                    <IonSelect
                      interface="alert"
                      interfaceOptions={{ header: "Select Institution" }}
                      placeholder="Select Institution"
                      value={institution || undefined}           
                      onIonFocus={() => !clients.length && loadClients()}
                      onIonChange={(e) => setInstitution(e.detail.value)}
                    >
                      {clients.map((c) => (
                        <IonSelectOption key={c.Client_ID} value={c.Client_Name}>
                          {c.Client_Name}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                  <IonNote color="medium">{!clients.length ? "Loading institutions..." : ""}</IonNote>
                </IonCol>

                {/* Description */}
                <IonCol size="12" sizeMd="3">
                  <IonItem>
                    <IonInput
                      placeholder="Description*"
                      value={dutiesDesc}
                      onIonInput={(e) => setDutiesDesc(e.detail.value || "")}
                    />
                  </IonItem>
                </IonCol>

                {/* Transport mode */}
                <IonCol size="12" sizeMd="2">
                  <IonItem>
                    <IonSelect
                      key={`mode-${activeTab}-${editingId}`}
                      interface="alert"
                      interfaceOptions={{ header: "Mode of Transport" }}
                      placeholder="Mode of Transport"
                      value={transportMode || undefined}
                      onIonChange={(e) => onTransportChange(e.detail.value)}
                    >
                      <IonSelectOption value="OnSite">On-Site</IonSelectOption>
                      <IonSelectOption value="PublicTransport">Public Transport</IonSelectOption>
                      <IonSelectOption value="Twowheeler">Two wheeler</IonSelectOption>
                      <IonSelectOption value="OfficeVehicle">Office Vehicle</IonSelectOption>
                    </IonSelect>
                  </IonItem>
                  {!!transportMsg && <IonNote color="medium">{transportMsg}</IonNote>}
                </IonCol>
              </IonRow>

              <IonRow>
                <IonCol size="6" sizeMd="2">
                  <IonItem>
                    <IonInput
                      placeholder="Kms"
                      value={kms}
                      onIonInput={(e) => setKms(e.detail.value || "")}
                      readonly={disableKms}
                    />
                  </IonItem>
                </IonCol>
                <IonCol size="6" sizeMd="2">
                  <IonItem>
                    <IonInput
                      placeholder="Vehicle No"
                      value={vehicleNo}
                      onIonInput={(e) => setVehicleNo(e.detail.value || "")}
                      // readonly={disableVehicle}
                    />
                  </IonItem>
                </IonCol>
                <IonCol size="6" sizeMd="2">
                  <IonItem>
                    <IonInput
                      placeholder="S-Reading"
                      value={sReading}
                      onIonInput={(e) => setSReading(e.detail.value || "")}
                      // readonly={disableVehicle}
                    />
                  </IonItem>
                </IonCol>
                <IonCol size="6" sizeMd="2">
                  <IonItem>
                    <IonInput
                      placeholder="E-Reading"
                      value={eReading}
                      onIonInput={(e) => onEndReadingChange(e.detail.value || "")}
                      // readonly={disableVehicle}
                    />
                  </IonItem>
                </IonCol>
                <IonCol size="6" sizeMd="2">
                  <IonItem>
                    <IonInput
                      placeholder="Start"
                      type="time"
                      value={startTime}
                      onIonInput={(e) => setStartTime(e.detail.value || "")}
                    />
                  </IonItem>
                </IonCol>
                <IonCol size="6" sizeMd="2">
                  <IonItem>
                    <IonInput
                      placeholder="End"
                      type="time"
                      value={endTime}
                      onIonInput={(e) => setEndTime(e.detail.value || "")}
                    />
                  </IonItem>
                </IonCol>

                <IonCol size="12" sizeMd="2" className="ion-text-end">
                  <IonButton expand="block" className="primary-btn" onClick={saveOnDuty}>
                    <IonIcon icon={arrowForwardOutline} slot="start" /> Submit
                  </IonButton>
                </IonCol>
                {canApproveDuties && (
                  <>
                    <IonCol size="6" sizeMd="2" className="ion-text-end">
                      <IonButton expand="block" color="success" onClick={approveOnDuty}>
                        Approve
                      </IonButton>
                    </IonCol>
                    <IonCol size="6" sizeMd="2" className="ion-text-end">
                      <IonButton expand="block" color="danger" onClick={rejectOnDuty}>
                        Reject
                      </IonButton>
                    </IonCol>
                  </>
                )}
              </IonRow>
            </IonGrid>

            {/* Duties table */}
            <IonGrid className="table-container" style={{ marginTop: 16 }}>
              <IonRow className="table-header">
                <IonCol size="2">Date</IonCol>
                <IonCol size="2">College</IonCol>
                <IonCol size="2">Description</IonCol>
                <IonCol size="2">Mode</IonCol>
                <IonCol size="1">S_Time</IonCol>
                <IonCol size="1">E_Time</IonCol>
                <IonCol size="1">KMS</IonCol>
                <IonCol size="1">Status</IonCol>
                <IonCol size="0.5">Edit</IonCol>
              </IonRow>
              {dutiesList.map((x) => (
                <IonRow key={x.id} className="table-row">
                  <IonCol size="2">{ymdToDdMmYy(isoToYmd(String(x.Date)))}</IonCol>
                  <IonCol size="2">{x.College}</IonCol>
                  <IonCol size="2">{x.Description}</IonCol>
                  <IonCol size="2">{x.Mode_of_Trans}</IonCol>
                  <IonCol size="1">{x.Start_Time}</IonCol>
                  <IonCol size="1">{x.End_Time}</IonCol>
                  <IonCol size="1">{x.Kms}</IonCol>
                  <IonCol size="1" style={{ color: x.Status === "REJECTED" ? "var(--ion-color-danger)" as any : undefined }}>
                    {x.Status}
                  </IonCol>
                  <IonCol size="0.5">
                    {x.Status !== "REJECTED" && (
                      <IonButton size="small" onClick={() => editOnDuty(x.id)}>
                        Edit
                      </IonButton>
                    )}
                  </IonCol>
                </IonRow>
              ))}
              {!dutiesList.length && (
                <IonRow>
                  <IonCol className="ion-text-center" style={{ opacity: 0.6 }}>
                    No On-Duty rows
                  </IonCol>
                </IonRow>
              )}
            </IonGrid>
          </>
        )}

        {activeTab === "overtime" && (
          <>
            <IonGrid className="form-grid">
              <IonRow>
                {/* Date */}
                <IonCol size="12" sizeMd="2">
                  <IonItem lines="none">
                    <IonIcon icon={calendarOutline} slot="start" />
                    <IonInput readonly value={otDate ? ymdToDdMmYy(otDate) : "Date*"} />
                    <IonDatetimeButton datetime="ot-date" slot="end" />
                  </IonItem>
                  <IonModal keepContentsMounted={true}>
                    <IonDatetime
                      id="ot-date"
                      presentation="date"
                      onIonChange={(e) => {
                        const val = typeof e.detail.value === "string" ? e.detail.value : undefined;
                        if (!val) return;
                        setOTDate(isoToYmd(val));
                      }}
                    />
                  </IonModal>
                </IonCol>

                {/* Client DROPDOWN */}
                <IonCol size="12" sizeMd="3">
                  <IonItem>
                    <IonSelect
                      interface="alert"
                      interfaceOptions={{ header: "Select Client" }}
                      placeholder="Select Client"
                      value={otClient || undefined}
                      onIonFocus={() => !clients.length && loadClients()}
                      onIonChange={(e) => setOTClient(e.detail.value)}
                    >
                      {clients.map((c) => (
                        <IonSelectOption key={c.Client_ID} value={c.Client_Name}>
                          {c.Client_Name}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                  <IonNote color="medium">{!clients.length ? "Loading clients..." : ""}</IonNote>
                </IonCol>

                <IonCol size="6" sizeMd="2">
                  <IonItem>
                    <IonInput placeholder="From" type="time" value={otFrom} onIonInput={(e) => setOTFrom(e.detail.value || "")} />
                  </IonItem>
                </IonCol>
                <IonCol size="6" sizeMd="2">
                  <IonItem>
                    <IonInput placeholder="To" type="time" value={otTo} onIonInput={(e) => setOTTo(e.detail.value || "")} />
                  </IonItem>
                </IonCol>
                <IonCol size="6" sizeMd="1.5">
                  <IonItem>
                    <IonInput placeholder="Actual Min." value={String(otActualMin || "")} readonly />
                  </IonItem>
                </IonCol>
                <IonCol size="6" sizeMd="1.5">
                  <IonItem>
                    <IonInput
                      placeholder="Final Min."
                      value={String(otFinalMin || "")}
                      onIonInput={(e) => setOTFinalMin(Number(e.detail.value || 0))}
                    />
                  </IonItem>
                </IonCol>
              </IonRow>
              <IonRow>
                <IonCol size="12" sizeMd="10">
                  <IonItem>
                    <IonInput placeholder="Description*" value={otDesc} onIonInput={(e) => setOTDesc(e.detail.value || "")} />
                  </IonItem>
                </IonCol>
                <IonCol size="12" sizeMd="2" className="ion-text-end">
                  <IonButton
                    expand="block"
                    className="primary-btn"
                    onClick={saveOvertime}
                  >
                    <IonIcon icon={arrowForwardOutline} slot="start" /> Submit
                  </IonButton>
                </IonCol>
              </IonRow>
            </IonGrid>

            {/* OT table */}
            <IonGrid className="table-container" style={{ marginTop: 16 }}>
              <IonRow className="table-header">
                <IonCol size="2">Emp</IonCol>
                <IonCol size="1.5">Date</IonCol>
                <IonCol size="2">College</IonCol>
                <IonCol size="1">From</IonCol>
                <IonCol size="1">To</IonCol>
                <IonCol size="3">Description</IonCol>
                <IonCol size="0.8">Edit</IonCol>
                <IonCol size="1.2">PendingAt</IonCol>
              </IonRow>
              {otList.map((x) => (
                <IonRow key={x.id} className="table-row">
                  <IonCol size="2">{x.EmpCodeName || x.EmpCode}</IonCol>
                  <IonCol size="1.5">{ymdToDdMmYy(isoToYmd(String(x.Date)))}</IonCol>
                  <IonCol size="2">{x.College}</IonCol>
                  <IonCol size="1">{x.Fromtime}</IonCol>
                  <IonCol size="1">{x.Totime}</IonCol>
                  <IonCol size="3">{x.Description}</IonCol>
                  <IonCol size="0.8">
                    <IonButton size="small" onClick={() => editOvertime(x.id)}>
                      Edit
                    </IonButton>
                  </IonCol>
                  <IonCol size="1.2" style={{ color: x.PendingAt === "Approved" ? "var(--ion-color-success)" as any : undefined }}>
                    {x.PendingAt}
                  </IonCol>
                </IonRow>
              ))}
              {!otList.length && (
                <IonRow>
                  <IonCol className="ion-text-center" style={{ opacity: 0.6 }}>
                    No OT rows
                  </IonCol>
                </IonRow>
              )}
            </IonGrid>

            {/* Simple approve button (visible when editing an OT row) */}
            <IonRow className="ion-justify-content-end ion-padding">
              <IonCol size="12" sizeMd="3">
                <IonButton expand="block" color="success" disabled={!otEditingId} onClick={approveOvertime}>
                  Approve Selected OT
                </IonButton>
              </IonCol>
            </IonRow>
          </>
        )}

        {/* Employees Modal (multi-select) */}
        <IonModal isOpen={showEmpModal} onDidDismiss={() => setShowEmpModal(false)} keepContentsMounted={true}>
          <div className="ion-padding employee-modal">
            <h2 className="modal-title">Select Employees</h2>
            <IonList>
              {allEmployees.map((emp) => {
                const checked = selectedCodes.includes(emp.EmpCode);
                return (
                  <IonItem key={emp.EmpCode}>
                    <IonCheckbox slot="start" checked={checked} onIonChange={(e) => toggleEmp(emp.EmpCode, e.detail.checked)} />
                    <IonLabel>{emp.EmpName || emp.EmpCode}</IonLabel>
                  </IonItem>
                );
              })}
            </IonList>
            <IonButton expand="block" className="primary-btn" onClick={() => setShowEmpModal(false)}>
              Done
            </IonButton>
          </div>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default OnDuties;
function extractValidation(e: any): string[] | null {
  if (!e) return null;
  // Axios error with response data
  if (e.response && e.response.data) {
    const data = e.response.data;
    if (typeof data === "string") {
      // Try to split by line or sentence
      return data.split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
    }
    if (Array.isArray(data)) {
      return data.map((x) => String(x)).filter(Boolean);
    }
    if (typeof data === "object") {
      // Collect all string values
      return Object.values(data).map((v) => String(v)).filter(Boolean);
    }
  }
  // Fallback: error message
  if (e.message) return [String(e.message)];
  return null;
}

