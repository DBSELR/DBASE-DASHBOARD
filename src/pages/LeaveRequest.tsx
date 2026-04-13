// src/pages/LeaveRequest.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  IonButton,
  IonContent,
  IonDatetime,
  IonInput,
  IonModal,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonToast,
  IonIcon,
} from "@ionic/react";
import axios from "axios";
import {
  calendarOutline,
  chatbubbleEllipsesOutline,
  closeCircle,
  timeOutline,
  documentTextOutline,
  optionsOutline,
  chevronForwardOutline,
} from "ionicons/icons";
import moment from "moment";
import "./LeaveRequest.css";

/* ---------------- mini helpers (no new files) ---------------- */
import { API_BASE } from "../config";

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const getAuthHeaders = () => {
  const token = localStorage.getItem("token")?.replace(/"/g, "");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const fmtDMY = (iso: string | null) => (iso ? moment(iso).format("DD-MM-YYYY") : "");
const fmtYMD = (iso: string | null) => (iso ? moment(iso).format("YYYY-MM-DD") : "");

const safeStr = (v: any) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return "";
  return String(v);
};

const generateMonthList = () => {
  const months: string[] = [];
  const startYear = 2014;
  const current = moment().add(1, 'month');
  const currentYear = current.year();

  for (let y = currentYear; y >= startYear; y--) {
    const endMonth = y === currentYear ? current.month() : 11;
    for (let m = endMonth; m >= 0; m--) {
      months.push(moment().year(y).month(m).format("MMM-YYYY"));
    }
  }
  return months;
};

const LEAVE_MEMES = [
  { img: "/images/leave_success.png", msg: "Apply chesav… kani neku leave avasaram aa nijanga? 😏" },
  { img: "/images/manager_smirk.png", msg: "Baane apply chesav… kani work evaru chestharu chuddam le 😏" },
  { img: "/images/work_pile.png", msg: "Perfect ga apply chesav… kani work matram alage undi 😅" },
  { img: "/images/vacation_plan.png", msg: "Baane plan chesav… kani work ki plan enti cheppu 😂" },
  { img: "/images/handover.png", msg: "Apply chesav… kani work ni handover chesava leda adhi twist 😏" },
];

/* ---------------- component ---------------- */
const LeaveRequest: React.FC = () => {
  // form
  const [reason, setReason] = useState<string>("Select");
  const [startDate, setStartDate] = useState<string | null>(null); // ISO
  const [endDate, setEndDate] = useState<string | null>(null); // ISO
  const [remarks, setRemarks] = useState<string>("");
  const [permTime, setPermTime] = useState<string>("");

  const [singleDateMode, setSingleDateMode] = useState<boolean>(false);
  const [permBalMin, setPermBalMin] = useState<number | null>(null);
  const [displayMin, setDisplayMin] = useState<string | null>(null);

  // month + data
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [rows, setRows] = useState<any[]>([]);

  // ui states
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastColor, setToastColor] = useState<"success" | "danger">("success");
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [currentMeme, setCurrentMeme] = useState(LEAVE_MEMES[0]);

  const currentMY = useMemo(() => moment().format("MMM-YYYY"), []);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Randomize meme whenever modal is opened
  useEffect(() => {
    if (successOpen) {
      const randomIdx = Math.floor(Math.random() * LEAVE_MEMES.length);
      setCurrentMeme(LEAVE_MEMES[randomIdx]);
    }
  }, [successOpen]);

  const init = async () => {
    const user = getUser();
    const empCode = user?.empCode;
    if (!empCode) return showToast("User not found in storage. Please login.", "danger");

    try {
      const list = generateMonthList();
      const defMY = list.includes(currentMY) ? currentMY : (list[0] || currentMY);
      setMonths(list);
      setSelectedMonth(defMY);
      await loadCards(empCode, defMY);
    } catch (e) {
      console.error("[API][GET] init failed", e);
      showToast("Failed to load initial data.", "danger");
    }
  };

  const loadCards = async (empCode: string, month: string) => {
    try {
      const lType = "A";
      const url = `${API_BASE}Leave/Load_Leave_Permission?Empcode=${empCode}&Seachdate=${month}&LType=${lType}`;
      const r = await axios.get(url, { headers: getAuthHeaders() });
      console.log(`[API][GET] Leave History loaded for ${month}: ${r.data?.length || 0} items`, r.data);
      setRows(r.data || []);
    } catch (e) {
      console.error("[API][GET] loadCards failed", e);
      setRows([]);
      showToast("Failed to load leave data.", "danger");
    }
  };

  const showToast = (msg: string, color: "success" | "danger" = "success") => {
    setToastMsg(msg);
    setToastColor(color);
    setToastOpen(true);
  };

  const normalizeLeaveEntry = (x: any) => {
    if (!x) return null;
    const from = safeStr(x.lfrom || (Array.isArray(x) ? x[2] : ""));
    const to = safeStr(x.lto || (Array.isArray(x) ? x[3] : ""));
    const typeDisp = x.ltype || (Array.isArray(x) ? x[9] : "");
    const status = safeStr(x.L_status || (Array.isArray(x) ? x[6] : ""));
    const ptime = safeStr(x.Ptime || (Array.isArray(x) ? x[11] : ""));
    const remarks = safeStr(x.Remarks || (Array.isArray(x) ? (x[10] || x[5]) : ""));

    const isSameDay = !to || from === to;

    const colors =
      status.toLowerCase() === "accepted"
        ? { dot: "#28a745", bg: "#eef9f1", text: "#1e7e34" }
        : status.toLowerCase() === "rejected"
          ? { dot: "#dc3545", bg: "#fef1f2", text: "#bd2130" }
          : { dot: "#ffc107", bg: "#fff9eb", text: "#856404" };

    return {
      id: x.lid || (Array.isArray(x) ? x[0] : ""),
      from,
      to,
      isSameDay,
      typeDisp,
      status,
      ptime,
      remarks,
      __colors: colors,
    };
  };

  const onChangeLeaveType = (val: string) => {
    setReason(val);
    setStartDate(null);
    setEndDate(null);
    setPermTime("");
    setPermBalMin(null);
    setDisplayMin(null);
    const single = val === "Permission" || val === "Forenoon Leave" || val === "Afternoon Leave";
    setSingleDateMode(single);
    if (val === "Permission" && startDate) fetchPermissionBalance(startDate);
  };

  const fetchPermissionBalance = async (pickedISO: string | null, retryFormat?: string) => {
    if (reason !== "Permission" || !pickedISO) return;
    const empCode = getUser()?.empCode;
    if (!empCode) return;

    const dateStr = retryFormat === "YMD" ? fmtYMD(pickedISO) : fmtDMY(pickedISO);
    try {
      const url = `${API_BASE}Leave/Load_Perm_BalMin?Empcode=${empCode}&Pdate=${dateStr}`;
      const r = await axios.get(url, { headers: getAuthHeaders() });
      const raw = r.data;
      // Correct extraction for [[value]] structure
      const value = (Array.isArray(raw) && Array.isArray(raw[0])) ? raw[0][0] : null;
      console.log(`[API][GET] Permission Balance (${dateStr}): ${value} minutes`, raw);
      setPermBalMin(value);
      setDisplayMin("Min");
    } catch (e: any) {
      const errMsg = e.response?.data || e.message;
      console.error(`[API][GET] fetchPermissionBalance failed for ${dateStr}`, errMsg);

      // Fallback: If DD-MM-YYYY (default) fails with 500, try YYYY-MM-DD
      if (!retryFormat && e.response?.status === 500) {
        console.warn("[API][GET] Retrying Permission Balance with YYYY-MM-DD format...");
        return fetchPermissionBalance(pickedISO, "YMD");
      }

      setPermBalMin(null);
      setDisplayMin(null);
    }
  };

  const checkPendingPermission = async (pickedISO: string | null) => {
    if (!pickedISO) return [];
    const empCode = getUser()?.empCode;
    if (!empCode) return [];
    const dmy = fmtDMY(pickedISO);
    try {
      const url = `${API_BASE}Leave/Load_Pending_Permission?Empcode=${empCode}&PDate=${dmy}`;
      const r = await axios.get(url, { headers: getAuthHeaders() });
      console.log("[API][GET] Pending Permission Check:", r.data);
      return Array.isArray(r.data) ? r.data : [];
    } catch (e: any) {
      const errMsg = e.response?.data || e.message;
      console.error("[API][GET] checkPendingPermission failed", errMsg);
      return [];
    }
  };

  const clearForm = () => {
    setReason("Select");
    setStartDate(null);
    setEndDate(null);
    setPermTime("");
    setRemarks("");
    setPermBalMin(null);
    setDisplayMin(null);
  };

  const onSubmit = async () => {
    const user = getUser();
    const empCode = user?.empCode;
    if (!empCode) return showToast("User not found.", "danger");

    if (reason === "Select") return showToast("Choose Leave Type.", "danger");
    if (!startDate) return showToast("Choose a date.", "danger");
    if (!remarks?.trim()) return showToast("Enter Remarks.", "danger");

    if (reason === "Permission") {
      const pending = await checkPendingPermission(startDate);
      if (pending.length > 0) return showToast("Request already pending.", "danger");
      const mins = Number(permTime);
      if (!mins || mins < 5 || mins > 90) return showToast("Mins must be 5-90.", "danger");
      if (permBalMin !== null && mins > permBalMin) return showToast("Exceeds balance.", "danger");
    } else if (!singleDateMode) {
      if (!endDate) return showToast("Choose an end date.", "danger");
      if (moment(startDate).isAfter(moment(endDate))) return showToast("End date invalid.", "danger");
    }

    const payload = {
      _fromdate: fmtDMY(startDate),
      _todate: singleDateMode ? fmtDMY(startDate) : fmtDMY(endDate),
      _remarks: remarks,
      _PermTime: reason === "Permission" ? permTime : "",
      _requesttype: reason,
      _empcode: empCode,
    };

    try {
      console.log("[API][POST] Submitting Leave Request Payload:", payload);
      const res = await axios.post(`${API_BASE}Leave/saveleaverequest`, payload, {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      console.log("[API][POST] saveleaverequest Response:", res.data);
      showToast("Submitted successfully.", "success");
      setSuccessOpen(true);
      clearForm();
      await loadCards(empCode, selectedMonth || currentMY);
    } catch (e) {
      console.error("[API][POST] saveleaverequest failed", e);
      showToast("Submission failed.", "danger");
    }
  };

  return (
    <IonPage>
      <IonContent className="lr-page-container">
        {/* Trendy Minimalist Header */}
        <header className="lr-trendy-header premium-trendy-bg">
          <h1 className="lr-main-title">New Request</h1>
          <p className="lr-main-subtitle">Apply for leave or permissions quickly.</p>
        </header>

        {/* Bento Grid Form */}
        <div className="lr-bento-grid">
          {/* Leave Type */}
          <div className="lr-field-box">
            <label className="lr-field-label">Leave Type</label>
            <div className="lr-field-content">
              <IonIcon icon={optionsOutline} className="lr-field-icon" />
              <IonSelect
                value={reason}
                onIonChange={(e) => onChangeLeaveType(e.detail.value)}
                interface="popover"
                className="lr-popover-select"
                color="dark"

                placeholder="Select"
              >
                <IonSelectOption value="Leave">Leave</IonSelectOption>
                <IonSelectOption value="Permission">Permission</IonSelectOption>
                <IonSelectOption value="Forenoon Leave">Forenoon Leave</IonSelectOption>
                <IonSelectOption value="Afternoon Leave">Afternoon Leave</IonSelectOption>
              </IonSelect>
            </div>
          </div>

          {/* Start Date */}
          <div className="lr-field-box" onClick={() => setStartModalOpen(true)}>
            <label className="lr-field-label">{singleDateMode ? "Select Date" : "Start Date"}</label>
            <div className="lr-field-content">
              <IonIcon icon={calendarOutline} className="lr-field-icon" />
              <div className="lr-clean-input" style={{ color: startDate ? '#1d1d1f' : '#c1c1c6' }}>
                {startDate ? fmtDMY(startDate) : "Pick Date"}
              </div>
            </div>
          </div>

          {/* End Date */}
          {!singleDateMode && (
            <div className="lr-field-box" onClick={() => setEndModalOpen(true)}>
              <label className="lr-field-label">End Date</label>
              <div className="lr-field-content">
                <IonIcon icon={calendarOutline} className="lr-field-icon" />
                <div className="lr-clean-input" style={{ color: endDate ? '#1d1d1f' : '#c1c1c6' }}>
                  {endDate ? fmtDMY(endDate) : "Pick Date"}
                </div>
              </div>
            </div>
          )}

          {/* Perm Minutes */}
          {reason === "Permission" && (
            <div className="lr-field-box">
              <label className="lr-field-label">Minutes</label>
              <div className="lr-field-content">
                <IonIcon icon={timeOutline} className="lr-field-icon" />
                <IonInput
                  type="number"
                  value={permTime}
                  onIonChange={(e) => setPermTime(e.detail.value || "")}
                  placeholder="5-90"
                  className="lr-clean-input"
                />
                {permBalMin !== null && (
                  <span style={{ fontSize: '10px', color: '#f15a24', fontWeight: 800 }}>
                    {permBalMin} {displayMin}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Remarks */}
          <div className="lr-field-box">
            <label className="lr-field-label">Remarks</label>
            <div className="lr-field-content" style={{ alignItems: 'flex-start' }}>
              <IonIcon icon={documentTextOutline} className="lr-field-icon" style={{ marginTop: '2px' }} />
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Tell us why..."
                className="lr-clean-input"
                rows={2}
                style={{ resize: 'none' }}
              />
            </div>
          </div>
        </div>

        <button className="lr-gradient-btn premium-trendy-bg" onClick={onSubmit}>Submit Request</button>

        {/* History Section */}
        <div className="lr-history-section">
          <div className="lr-section-header">
            <h2 className="lr-section-title">History</h2>
            <div className="lr-month-pill">
              <IonSelect
                interface="popover"
                value={selectedMonth}

                onIonChange={async (e) => {
                  const m = e.detail.value;
                  setSelectedMonth(m);
                  const empCode = getUser()?.empCode;
                  if (empCode) await loadCards(empCode, m);
                }}
                className="lr-popover-select"

                style={{ fontSize: '12px', color: '#000' }}
              >
                {months.map((m, i) => <IonSelectOption color="#000" key={i} value={m}>{m}</IonSelectOption>)}
              </IonSelect>
            </div>
          </div>

          <div className="lr-list">
            {rows.length ? (
              rows.map((r, i) => {
                const x = normalizeLeaveEntry(r);
                if (!x) return null;
                return (
                  <div key={i} className="lr-history-card themed-bg">
                    <div className="lr-card-main">
                      <span className="lr-card-date-txt">{x.isSameDay ? x.from : `${x.from} - ${x.to}`}</span>
                      <span className="lr-card-type-txt">{x.typeDisp} {x.ptime ? `${x.ptime}` : ""}</span>
                    </div>
                    <div className="lr-status-indicator" style={{ backgroundColor: x.__colors.bg, color: x.__colors.text }}>
                      {x.status}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <IonIcon icon={closeCircle} style={{ fontSize: '32px', color: '#eee' }} />
                <p style={{ fontSize: '13px', color: '#aaa' }}>No history found.</p>
              </div>
            )}
          </div>
        </div>

        {/* Date Modals (User requested centered pattern) */}
        <IonModal isOpen={startModalOpen} onDidDismiss={() => setStartModalOpen(false)} className="pwt-date-modal">
          <div className="pwt-modal-content">
            <h3 className="pwt-modal-title">Select Date</h3>
            <IonDatetime
              presentation="date"
              onIonChange={(e) => {
                const v = e.detail.value;
                if (typeof v === "string") {
                  const cleanV = v.split('T')[0];
                  setStartDate(cleanV);
                  fetchPermissionBalance(cleanV);
                  if (singleDateMode) setEndDate(cleanV);
                }
                setStartModalOpen(false);
              }}
            />
            <IonButton expand="block" mode="ios" onClick={() => setStartModalOpen(false)}>Close</IonButton>
          </div>
        </IonModal>

        <IonModal isOpen={endModalOpen} onDidDismiss={() => setEndModalOpen(false)} className="pwt-date-modal">
          <div className="pwt-modal-content">
            <h3 className="pwt-modal-title">Select End Date</h3>
            <IonDatetime
              presentation="date"
              onIonChange={(e) => {
                const v = e.detail.value;
                if (typeof v === "string") setEndDate(v.split('T')[0]);
                setEndModalOpen(false);
              }}
            />
            <IonButton expand="block" mode="ios" onClick={() => setEndModalOpen(false)}>Close</IonButton>
          </div>
        </IonModal>

        {/* Success Modal - Redesigned for "Crazy Creative" Meme Vibe */}
        <IonModal
          isOpen={successOpen}
          onDidDismiss={() => setSuccessOpen(false)}
          className="lr-success-modal"
          style={{ '--height': 'auto', '--width': '90%', '--max-width': '400px', '--border-radius': '24px' }}
        >
          <div className="lr-success-modal-content" style={{
            padding: '30px 20px',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
          }}>
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <img
                key={currentMeme.img}
                src={currentMeme.img}
                alt="Success"
                style={{
                  width: '100%',
                  maxWidth: '220px',
                  borderRadius: '20px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                  transform: 'rotate(-2deg)'
                }}
              />
              <div style={{
                position: 'absolute',
                top: '-10px',
                right: '10px',
                background: '#f15a24',
                color: 'white',
                padding: '5px 12px',
                borderRadius: '50px',
                fontSize: '12px',
                fontWeight: '900',
                transform: 'rotate(10deg)',
                boxShadow: '0 5px 10px rgba(241, 90, 36, 0.4)'
              }}>
                APPROVED? 🤞
              </div>
            </div>

            <h2 style={{
              margin: '0 0 10px 0',
              fontSize: '28px',
              fontWeight: '900',
              color: '#1d1d1f',
              letterSpacing: '-1px',
              textTransform: 'uppercase'
            }}>
              FREEDOM!
            </h2>

            <p style={{
              margin: '0 0 25px 0',
              fontSize: '15px',
              lineHeight: '1.5',
              color: '#424245',
              fontWeight: '500'
            }}>
              {currentMeme.msg}
            </p>

            <button
              onClick={() => setSuccessOpen(false)}
              style={{
                width: '100%',
                padding: '16px',
                background: 'linear-gradient(135deg, #f15a24 0%, #ff8a00 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                fontSize: '16px',
                fontWeight: '800',
                boxShadow: '0 10px 20px rgba(241, 90, 36, 0.3)',
                transition: 'transform 0.2s active'
              }}
            >
              YAY! TAKE ME BACK
            </button>
          </div>
        </IonModal>

        <IonToast
          isOpen={toastOpen}
          onDidDismiss={() => setToastOpen(false)}
          message={toastMsg}
          duration={2000}
          color={toastColor}
          position="top"
        />
      </IonContent>
    </IonPage>
  );
};

export default LeaveRequest;
