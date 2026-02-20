// src/pages/LeaveRequest.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  IonButton,
  IonContent,
  IonDatetime,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonPage,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import axios from "axios";
import moment from "moment";

/* ---------------- mini helpers (no new files) ---------------- */
const API_BASE =
  (window as any).__API_BASE__ ||
  import.meta.env.VITE_API_BASE ||
  "/api"; // works with Vite dev proxy or your IIS rewrite

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

/* ---------------- component ---------------- */
const LeaveRequest: React.FC = () => {
  // form
  const [reason, setReason] = useState<string>("Select");
  const [startDate, setStartDate] = useState<string | null>(null); // ISO
  const [endDate, setEndDate] = useState<string | null>(null); // ISO
  const [remarks, setRemarks] = useState<string>("");
  const [permTime, setPermTime] = useState<string>("");

  const [singleDateMode, setSingleDateMode] = useState<boolean>(false); // Permission/FN/AN
  const [permBalMin, setPermBalMin] = useState<number | null>(null);
  const [displayMin, setDisplayMin] = useState<string | null>(null);

  // month + data
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [rows, setRows] = useState<any[]>([]);

  // ui
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastColor, setToastColor] = useState<"success" | "danger">("success");
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const currentMY = useMemo(() => moment().format("MMM-YYYY"), []);

  useEffect(() => {
    console.log("[leave][init] stored user:", getUser());
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const init = async () => {
    const user = getUser();
    const empCode = user?.empCode;
    if (!empCode) return showToast("User not found in storage. Please login.", "danger");

    try {
      // Months
      console.log("[leave][months] GET", `${API_BASE}/Leave/Load_Leave_MY?Empcode=${empCode}`);
      const r1 = await axios.get(`${API_BASE}/Leave/Load_Leave_MY?Empcode=${empCode}`, {
        headers: getAuthHeaders(),
      });
      const list: string[] = (r1.data || []).map((x: any) =>
        typeof x === "object" && x?.MY ? x.MY : x?.[0]
      );
      const defMY = list.includes(currentMY) ? currentMY : (list[0] || currentMY);
      setMonths(list);
      setSelectedMonth(defMY);

      await loadCards(empCode, defMY);
    } catch (e) {
      console.error(e);
      showToast("Failed to load initial data.", "danger");
    }
  };

  const loadCards = async (empCode: string, month: string) => {
    try {
      const url = `${API_BASE}/Leave/Load_Leave_Permission?Empcode=${empCode}&Seachdate=${encodeURIComponent(
        month
      )}&LType=A`;
      console.log("[leave][cards] GET", url);
      const r = await axios.get(url, { headers: getAuthHeaders() });
      setRows(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      console.error(e);
      setRows([]);
      showToast("Failed to load leave data.", "danger");
    }
  };

  const showToast = (msg: string, color: "success" | "danger" = "success") => {
    setToastMsg(msg);
    setToastColor(color);
    setToastOpen(true);
  };

  const normalizeLeaveEntry = (entry: any) => {
    const obj = Array.isArray(entry)
      ? {
          lfrom: entry[2] ?? entry[0] ?? "",
          lto: entry[3] ?? entry[1] ?? "",
          ltype: entry[5] ?? entry[4] ?? "",
          L_status: (entry[6] ?? entry[7] ?? "").toString().trim(),
          Remarks: entry[10] ?? entry[8] ?? entry[9] ?? "",
          Ptime: entry[11] ?? entry[12] ?? "",
        }
      : {
          lfrom: entry.lfrom ?? "",
          lto: entry.lto ?? "",
          ltype: entry.ltype ?? "",
          L_status: (entry.L_status ?? "").toString().trim(),
          Remarks: entry.Remarks ?? "",
          Ptime: entry.Ptime ?? "",
        };

    const status = (obj.L_status || "").toLowerCase();
    const colors =
      status === "accepted"
        ? { stripe: "#28a745", bg: "rgba(155, 238, 155, 0.06)" }
        : status === "rejected"
        ? { stripe: "#dc3545", bg: "rgba(244, 146, 146, 0.07)" }
        : { stripe: "#ffc107", bg: "#FFFACD" };

    return { ...obj, __colors: colors };
  };

  const onChangeLeaveType = (val: string) => {
    console.log("[leave][type]", val);
    setReason(val);
    setStartDate(null);
    setEndDate(null);
    setPermTime("");
    setPermBalMin(null);
    setDisplayMin(null);

    const single = val === "Permission" || val === "Forenoon Leave" || val === "Afternoon Leave";
    setSingleDateMode(single);
  };

  const fetchPermissionBalance = async (pickedISO: string | null) => {
    if (reason !== "Permission" || !pickedISO) return;
    const user = getUser();
    const empCode = user?.empCode;
    if (!empCode) return;

    const ymd = fmtYMD(pickedISO);
    try {
      const url = `${API_BASE}/Leave/Load_Perm_BalMin?Empcode=${empCode}&Pdate=${ymd}`;
      console.log("[leave][perm-bal] GET", url);
      const r = await axios.get(url, { headers: getAuthHeaders() });
      const value = r.data?.[0]?.BalMin ?? null;
      setPermBalMin(value);
      setDisplayMin("Min");
    } catch (e) {
      console.error(e);
      setPermBalMin(null);
      setDisplayMin(null);
    }
  };

const checkPendingPermission = async (pickedISO: string | null) => {
  if (!pickedISO) return [];
  const empCode = getUser()?.empCode;
  if (!empCode) return [];

  // Use YYYY-MM-DD (same as Load_Perm_BalMin)
  const ymd = fmtYMD(pickedISO);

  try {
    const url = `${API_BASE}/Leave/Load_Pending_Permission?Empcode=${empCode}&PDate=${ymd}`;
    console.log("[leave][pending] GET", url);
    const r = await axios.get(url, { headers: getAuthHeaders() });
    return Array.isArray(r.data) ? r.data : [];
  } catch (e) {
    console.error(e);
    return [];
  }
};


  const sendSMS = async (pickedStartISO: string, pickedEndISO: string | null) => {
    const user = getUser();
    const empCode = user?.empCode;
    const empName = user?.empName || "Employee";
    if (!empCode) return;

    let message = "";
    if (reason === "Permission" || reason === "Forenoon Leave" || reason === "Afternoon Leave") {
      message = `${reason} Request // Employee Name : ${empName} // Leave Description : ${remarks} // Date : ${fmtDMY(
        pickedStartISO
      )} // ${reason}`;
    } else {
      const days = moment(pickedEndISO).diff(moment(pickedStartISO), "days") + 1;
      message = `Leave Request // Employee Name : ${empName} // Leave Description : ${remarks} // From Date : ${fmtDMY(
        pickedStartISO
      )} // To Date : ${fmtDMY(pickedEndISO!)} // Days : ${days} days`;
    }

    try {
      const mobileRes = await axios.get(
        `${API_BASE}/Leave/get_mobileno?Empcode=${empCode}`,
        { headers: getAuthHeaders() }
      );
      const mobile = mobileRes.data?.[0]?.Mobile;
      if (mobile) {
        const url = `${API_BASE}/Sources/sendMessage?phoneNo=${encodeURIComponent(
          mobile
        )}&&message=${encodeURIComponent(message)}`;
        console.log("[leave][sms] GET", url);
        await axios.get(url, { headers: getAuthHeaders() });
      }
    } catch (e) {
      console.warn("SMS sending failed", e);
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
    if (!empCode) return showToast("User not found in storage. Please login.", "danger");

    if (reason === "Select") return showToast("Please select Leave Type.", "danger");
    if (!startDate) return showToast("Please choose a Start Date.", "danger");
    if (!remarks?.trim()) return showToast("Please enter Remarks.", "danger");

    if (reason === "Permission") {
      const pending = await checkPendingPermission(startDate);
      if (pending.length > 0) return showToast("Permission Request already pending.", "danger");

      const mins = Number(permTime);
      if (!mins || mins < 5 || mins > 90) {
        return showToast("Invalid Minutes. Should be between 5 and 90.", "danger");
      }
      if (permBalMin !== null && mins > permBalMin) {
        return showToast("Minutes exceed available balance.", "danger");
      }
    } else if (!singleDateMode) {
      if (!endDate) return showToast("Please choose an End Date.", "danger");
      if (moment(startDate).isAfter(moment(endDate))) {
        return showToast("From Date cannot be after To Date.", "danger");
      }
    }

    const _from = fmtDMY(startDate);
    const _to =
      reason === "Permission" || reason === "Forenoon Leave" || reason === "Afternoon Leave"
        ? fmtDMY(startDate)
        : fmtDMY(endDate);

    const payload = {
      _fromdate: _from,
      _todate: _to,
      _remarks: remarks,
      _PermTime: reason === "Permission" ? permTime : "",
      _requesttype: reason,
      _empcode: empCode, // keep lower 'c' to match Angular
    };

    console.log("[leave][submit] payload:", payload);

    try {
      await axios.post(`${API_BASE}/Leave/saveleaverequest`, payload, {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });

      await sendSMS(startDate, singleDateMode ? startDate : endDate);
      showToast("Request submitted successfully.", "success");
      setSuccessOpen(true);
      clearForm();
      await loadCards(empCode, selectedMonth || currentMY);
    } catch (e) {
      console.error(e);
      showToast("Failed to submit request.", "danger");
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="menu-toolbar">
          <img src="./images/dbase.png" alt="DBase" className="menu-logo" />
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <h2 className="pg-title">Apply Leave / Permissions</h2>
        <p className="pg-sub">Select type, duration and add remarks.</p>

        {/* Leave Type */}
        <IonItem className="field">
          <IonLabel>Leave Type</IonLabel>
          <IonSelect
            value={reason}
            onIonChange={(e) => onChangeLeaveType(e.detail.value)}
            interface="popover"
            placeholder="Select"
          >
            <IonSelectOption value="Leave">Leave</IonSelectOption>
            <IonSelectOption value="Permission">Permission</IonSelectOption>
            <IonSelectOption value="Forenoon Leave">Forenoon Leave</IonSelectOption>
            <IonSelectOption value="Afternoon Leave">Afternoon Leave</IonSelectOption>
          </IonSelect>
        </IonItem>

        {/* Start Date */}
        <IonItem button className="field" onClick={() => setStartOpen(true)}>
          <IonLabel position="stacked">Date {singleDateMode ? "" : "(From)"}</IonLabel>
          <IonInput
            readonly
            value={startDate ? fmtDMY(startDate) : "Select Date"}
            className="readonly-input"
          />
        </IonItem>

        {/* End Date (only for full Leave) */}
        {!singleDateMode && (
          <IonItem button className="field" onClick={() => setEndOpen(true)}>
            <IonLabel position="stacked">To</IonLabel>
            <IonInput
              readonly
              value={endDate ? fmtDMY(endDate) : "Select End Date"}
              className="readonly-input"
            />
          </IonItem>
        )}

        {/* Remarks */}
        <IonItem className="field">
          <IonLabel position="stacked">Remarks*</IonLabel>
          <IonInput
            value={remarks}
            onIonChange={(e) => setRemarks(e.detail.value || "")}
            placeholder="Enter your remarks"
          />
        </IonItem>

        {/* Permission Minutes */}
        {reason === "Permission" && (
          <IonItem className="field">
            <IonLabel position="stacked">Minutes* (max 90)</IonLabel>
            <IonInput
              type="number"
              min="5"
              max="90"
              inputMode="numeric"
              value={permTime}
              onIonChange={(e) => setPermTime(e.detail.value || "")}
              placeholder="Enter minutes"
            />
            {permBalMin !== null && (
              <span className="perm-hint">
                {permBalMin} - {displayMin}
              </span>
            )}
          </IonItem>
        )}

        <IonRow className="button-row">
          <IonButton expand="block" color="primary" onClick={onSubmit}>
            Submit Request
          </IonButton>
        </IonRow>

        <hr className="divider" />

        {/* Month Filter */}
        <h2 className="pg-title">Leave / Permissions</h2>
        <IonItem className="field">
          <IonLabel>Month</IonLabel>
          <IonSelect
            interface="popover"
            value={selectedMonth}
            onIonChange={async (e) => {
              const month = e.detail.value as string;
              setSelectedMonth(month);
              const empCode = getUser()?.empCode;
              if (empCode) await loadCards(empCode, month);
            }}
          >
            {months.map((m, i) => (
              <IonSelectOption key={i} value={m}>
                {m}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>

        {/* Cards */}
        <div className="reports">
          {rows.length ? (
            rows.map((r, i) => {
              const x = normalizeLeaveEntry(r);
              return (
                <div
                  key={i}
                  className="report-card"
                  style={{
                    borderLeft: `6px solid ${x.__colors.stripe}`,
                    backgroundColor: x.__colors.bg,
                  }}
                >
                  <div className="card-header">
                    <span className="date-span">
                      {x.lfrom || "-"}{x.lto ? `  -  ${x.lto}` : ""}
                    </span>
                    <span className={`status-badge ${(x.L_status || "").toLowerCase()}`}>
                      {x.L_status || "—"}
                    </span>
                  </div>

                  <div className="card-content">
                    <strong className="title">{x.ltype || "—"}</strong>
                    <p className="desc">{x.Remarks || "No Description"}</p>
                    {x.Ptime ? <p className="muted">Minutes: {x.Ptime}</p> : null}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="empty">No data found.</p>
          )}
        </div>

        {/* Toast */}
        <IonToast
          isOpen={toastOpen}
          onDidDismiss={() => setToastOpen(false)}
          message={toastMsg}
          duration={2200}
          color={toastColor}
        />

        {/* Date Modals */}
        <IonModal isOpen={startOpen} onDidDismiss={() => setStartOpen(false)} className="date-modal">
          <div className="modal-content">
            <IonDatetime
              presentation="date"
              onIonChange={(e) => {
                const v = e.detail.value as string | null;
                if (typeof v === "string") {
                  setStartDate(v);
                  // auto fetch balance for permission day
                  fetchPermissionBalance(v);
                  if (singleDateMode) setEndDate(v);
                }
                setStartOpen(false);
              }}
            />
            <IonButton expand="full" onClick={() => setStartOpen(false)}>Close</IonButton>
          </div>
        </IonModal>

        <IonModal isOpen={endOpen} onDidDismiss={() => setEndOpen(false)} className="date-modal">
          <div className="modal-content">
            <IonDatetime
              presentation="date"
              onIonChange={(e) => {
                const v = e.detail.value as string | null;
                if (typeof v === "string") setEndDate(v);
                setEndOpen(false);
              }}
            />
            <IonButton expand="full" onClick={() => setEndOpen(false)}>Close</IonButton>
          </div>
        </IonModal>

        {/* Success Modal */}
        <IonModal
          isOpen={successOpen}
          onDidDismiss={() => setSuccessOpen(false)}
          className="success-tick-modal"
        >
          <div className="success-wrap">
            <img src="./images/check.gif" alt="Success" className="success-gif" />
            <p className="success-text">Request Submitted Successfully!</p>
          </div>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default LeaveRequest;
