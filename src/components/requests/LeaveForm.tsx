import React, { useEffect, useState } from "react";
import {
  IonModal,
  IonSelect,
  IonSelectOption,
  IonToast,
  IonDatetime,
  IonButton,
  IonIcon
} from "@ionic/react";
import { calendarOutline, documentTextOutline, optionsOutline, timeOutline, informationCircleOutline } from "ionicons/icons";
import axios from "axios";
import moment from "moment";
import { API_BASE } from "../../config";
import { apiService } from "../../utils/apiService";
import "./RequestList.css";

const getUser = () => JSON.parse(localStorage.getItem("user") || "{}");

const fmtDMY = (iso: string | null) =>
  iso ? moment(iso).format("DD-MM-YYYY") : "";

const LeaveForm: React.FC<{ defaultType?: string }> = ({ defaultType }) => {
  const [requestType, setRequestType] = useState("Leave");
  const [leaveMode, setLeaveMode] = useState("");
  const [leaveCategory, setLeaveCategory] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [permTime, setPermTime] = useState("");

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const [startModal, setStartModal] = useState(false);
  const [endModal, setEndModal] = useState(false);


  // 🔥 NEW STATES
  const [balance, setBalance] = useState<any>(null);
  const [existingDates, setExistingDates] = useState<string[]>([]);

  // ✅ LOP STATES
  const [confirmLOP, setConfirmLOP] = useState(false);
  const [lopMessage, setLopMessage] = useState("");
  const [singleDateMode, setSingleDateMode] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showPreviousDateRequest, setShowPreviousDateRequest] = useState(false);
  const [unlockFromDate, setUnlockFromDate] = useState<string | null>(null);
  const [unlockToDate, setUnlockToDate] = useState<string | null>(null);
  const [unlockReason, setUnlockReason] = useState("");

  const [unlockRange, setUnlockRange] = useState({
  approved: false,
  fromDate: "",
  toDate: ""
});
const loadApprovedUnlockRequest = async () => {
  try {
    const empCode = getUser()?.empCode;

    const res = await axios.get(
      `${API_BASE}Leave/Leave/GetApprovedUnlockRequest`,
      {
        params: {
          empCode,
          requestType
        }
      }
    );

    setUnlockRange({
      approved: res.data?.approved || false,
      fromDate: res.data?.fromDate || "",
      toDate: res.data?.toDate || ""
    });

  } catch (err) {
    console.error("Unlock Request Error", err);

    setUnlockRange({
      approved: false,
      fromDate: "",
      toDate: ""
    });
  }
};
useEffect(() => {
  loadApprovedUnlockRequest();
}, [requestType]);


  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
  };

  const submitPreviousDateRequest = async () => {
    const empCode = getUser()?.empCode;

    if (!unlockFromDate) return showToast("Select From Date");
    if (!unlockToDate) return showToast("Select To Date");
    if (!unlockReason.trim()) return showToast("Enter Reason");

    try {
      await axios.post(
        `${API_BASE}Leave/SaveApprovalRequest`,
        null,
        {
          params: {
            EmpCode: empCode,
            RequestType: "PreviousDateUnlock",
            FromDate: fmtDMY(unlockFromDate),
            ToDate: fmtDMY(unlockToDate),
            Remarks: unlockReason,
            Status: "Pending"
          }
        }
      );
      showToast("Request sent to manager");
    } catch (err: any) {
      showToast(
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Unable to submit request"
      );
    }
  };
  useEffect(() => {
    setRequestType(defaultType === "permission" ? "Permission" : "Leave");
    loadExistingLeaves();
  }, [defaultType]);



  const clearForm = () => {
    setStartDate(null);
    setEndDate(null);
    setRemarks("");
    setPermTime("");
    setLeaveCategory("");
    setLeaveMode("Leave");
    setBalance(null);
  };

  // =========================================
  // 🔥 LOAD EXISTING LEAVE DATES (DUPLICATE PREVENT)
  // =========================================
  const loadExistingLeaves = async () => {
    try {
      const empCode = getUser()?.empCode;

      const res = await axios.get(
        `${API_BASE}Leave/GetEmployeeLeaveDates?empCode=${empCode}`
      );

      setExistingDates(res.data || []);
    } catch (e) {
      console.error("Error loading existing leaves");
    }
  };

  // =========================================
  // 🔥 CHECK DUPLICATE DATE
  // =========================================
  const isDuplicateDate = (date: string) => {
    return existingDates.includes(moment(date).format("YYYY-MM-DD"));
  };

  // =========================================
  // 🔥 REAL-TIME BALANCE API
  // =========================================
  //   const checkBalance = async () => {
  //   const empCode = getUser()?.empCode;

  //   if (!startDate) return;

  //   let finalCategory =
  //     leaveMode === "Leave" ? leaveCategory : leaveMode;

  //   // ✅ FIX: Map to Casual
  //   if (finalCategory === "Forenoon" || finalCategory === "Afternoon") {
  //     finalCategory = "Casual";
  //   }

  //   if (!finalCategory) {
  //     return showToast("Select leave category");
  //   }

  //   try {
  //     const res = await axios.get(
  //       `${API_BASE}Leave/GetLeaveBalance?empCode=${empCode}&leaveCategory=${finalCategory}&date=${startDate}`
  //     );

  //     setBalance({
  //       eligibleMonths: res.data?.eligibleMonths || 0,
  //       used: res.data?.used || 0,
  //       balance: res.data?.balance || 0,
  //     });
  //   } catch (err: any) {
  //     showToast(err?.response?.data || "Error fetching balance");
  //   }
  // };

  // const checkBalance = async () => {
  //   const empCode = getUser()?.empCode;

  //   if (!startDate) return;

  //   let finalCategory =
  //     requestType === "Permission"
  //       ? "Permission"
  //       : leaveMode === "Leave"
  //       ? leaveCategory
  //       : leaveMode;

  //   if (finalCategory === "Forenoon" || finalCategory === "Afternoon") {
  //     finalCategory = "Casual";
  //   }

  //   if (!finalCategory) {
  //     return showToast("Select category");
  //   }

  //   try {
  //     const res = await axios.get(
  //       `${API_BASE}Leave/GetLeaveBalance?empCode=${empCode}&leaveCategory=${finalCategory}&date=${startDate}`
  //     );

  //     setBalance({
  //       used: res.data?.used || 0,
  //       balance: res.data?.balance || 0,
  //       usedSessions: res.data?.usedSessions || 0,
  //       maxSessions: res.data?.maxSessions || 0,
  //     });
  //   } catch (err: any) {
  //     showToast(err?.response?.data || "Error fetching balance");
  //   }
  // };

  const checkBalance = async () => {
    const empCode = getUser()?.empCode;

    if (!startDate) return;

    let finalCategory = "";

    if (requestType === "Permission") {
      finalCategory = "Permission";
    } else if (leaveMode === "Leave") {
      finalCategory = leaveCategory;
    } else if (leaveMode === "Forenoon" || leaveMode === "Afternoon") {
      finalCategory = "Casual";
    } else {
      finalCategory = leaveMode;
    }


    //  if (finalCategory === "Forenoon" || finalCategory === "Afternoon") {
    //   finalCategory = "Casual";
    // }

    if (!finalCategory) return;

    try {
      const res = await axios.get(
        `${API_BASE}Leave/GetLeaveBalance`,
        {
          params: {
            empCode,
            leaveCategory: finalCategory,
            date: startDate,
          },
        }
      );

      setBalance({
        used: res.data?.used || 0,
        balance: res.data?.balance || 0,
        usedSessions: res.data?.usedSessions || 0,
        maxSessions: res.data?.maxSessions || 0,
      });

    } catch (err) {
      console.error(err);
      setBalance(null);
    }
  };

  // 🔥 AUTO TRIGGER BALANCE
  //   useEffect(() => {
  //   const finalCategory =
  //     leaveMode === "Leave" ? leaveCategory : leaveMode;

  //   if (startDate && finalCategory) {
  //     checkBalance();
  //   }
  // }, [startDate, leaveCategory, leaveMode]);

  useEffect(() => {
    if (!startDate) return;

    let finalCategory = "";

    if (requestType === "Permission") {
      finalCategory = "Permission";
    } else if (leaveMode === "Leave") {
      finalCategory = leaveCategory;
    } else {
      finalCategory = leaveMode;
    }

    if (!finalCategory) return;

    checkBalance();
  }, [startDate, leaveCategory, leaveMode, requestType]);

  // =========================================
  // 🔥 SUBMIT
  // =========================================
  //   const onSubmit = async () => {
  //     const empCode = getUser()?.empCode;

  //     if (!startDate) return showToast("Select date");
  //     if (!remarks) return showToast("Enter remarks");

  //     // 🔥 DUPLICATE CHECK
  //     if (isDuplicateDate(startDate)) {
  //       clearForm();
  //       return showToast("Leave already applied for this date");
  //     }

  //     // 🔥 BALANCE CHECK
  //     if (leaveCategory === "Casual" && balance && balance.balance <= 0) {
  //       clearForm();
  //       return showToast("No leave balance available");
  //     }

  //     const finalCategory =
  //       leaveMode === "Leave" ? leaveCategory : leaveMode;



  //     const payload = {
  //       _fromdate: fmtDMY(startDate),
  //       _todate:
  //         requestType === "Permission"
  //           ? fmtDMY(startDate)
  //           : fmtDMY(endDate),

  //       _remarks: remarks,
  //       _PermTime: requestType === "Permission" ? permTime : "",
  //       _requesttype: requestType,
  //       _empcode: empCode,

  //       _leaveMode: leaveMode,
  //       _leaveCategory: finalCategory,
  //     };

  //     try {
  //       await axios.post(`${API_BASE}Leave/saveleaverequest`, payload);

  //       showToast("Submitted Successfully");

  //       window.dispatchEvent(new Event("refreshRequests"));

  //       clearForm();
  //       loadExistingLeaves();
  //     } catch (err: any) {
  //       // 🔥 SHOW BACKEND ERROR
  //       const msg =
  //         err?.response?.data ||
  //         err?.response?.data?.message ||
  //         "Error submitting request";

  //       showToast(msg);
  //       clearForm();
  //     }
  //   };

  const onSubmit = async () => {
    if (loading) return; // Prevent double click
    const empCode = getUser()?.empCode;

    //if (!startDate) return showToast("Select date");
    if (unlockRange.approved) {

  const selectedDate = moment(startDate);

  const unlockFrom = moment(unlockRange.fromDate);
  const unlockTo = moment(unlockRange.toDate);

  if (
    selectedDate.isBefore(unlockFrom) ||
    selectedDate.isAfter(unlockTo)
  ) {
    return showToast(
      `Allowed dates: ${unlockRange.fromDate} to ${unlockRange.toDate}`
    );
  }
}
    if (!remarks) return showToast("Enter remarks");
    // ✅ Leave Type Validation
    if (requestType === "Leave" && !leaveMode) {
      return showToast("Select leave type");
    }

    // ✅ Category Validation
    if (
      requestType === "Leave" &&
      leaveMode === "Leave" &&
      !leaveCategory
    ) {
      return showToast("Select leave category");
    }

    const isDuplicateDate = (date: string | null) => {
  if (!date) return false;

  return existingDates.includes(
    moment(date).format("YYYY-MM-DD")
  );
};
    if (isDuplicateDate(startDate)) {
      clearForm();
      return showToast("Leave already applied for this date");
    } //not null

    let finalCategory =
      leaveMode === "Leave" ? leaveCategory : leaveMode;

    if (finalCategory === "Forenoon" || finalCategory === "Afternoon") {
      finalCategory = "Casual";
    }
    // ✅ LOP CHECK (FIXED)
    if (finalCategory === "Casual" && balance && balance.balance <= 0) {
      setLopMessage("Auto converted to LOP - Exceeded CL balance");
      setConfirmLOP(true);
      return;
    }

    if (finalCategory === "Sick" && balance && balance.balance <= 0) {
      setLopMessage("Auto converted to LOP - Sick limit exceeded");
      setConfirmLOP(true);
      return;
    }

    // 🔥 PERMISSION VALIDATION
    if (requestType === "Permission" && balance) {
      const minutes = parseFloat(permTime || "0");

      if (balance.usedSessions >= balance.maxSessions) {
        setLopMessage("Session limit exceeded → Convert to LOP?");
        setConfirmLOP(true);
        return;
      }

      if (minutes > balance.balance) {
        setLopMessage("Permission minutes exceeded → Convert to LOP?");
        setConfirmLOP(true);
        return;
      }
    }

    submitToServer(finalCategory);
  };

  // const submitToServer = async (category: string) => {
  //   const empCode = getUser()?.empCode;

  //   const payload = {
  //     _fromdate: fmtDMY(startDate),
  //     _todate:
  // singleDateMode
  //   ? fmtDMY(startDate)
  //   : fmtDMY(endDate),

  //     _remarks: remarks,
  //     _PermTime: requestType === "Permission" ? permTime : "",
  //     _requesttype: requestType,
  //     _empcode: empCode,
  //     _leaveMode: requestType === "Permission" ? "Permission" : leaveMode,
  //     _leaveCategory: requestType === "Permission" ? "Permission" : category,
  //   };

  //   try {
  //     await axios.post(`${API_BASE}Leave/saveleaverequest`, payload);
  //     showToast("Submitted Successfully");
  //     clearForm();
  //     loadExistingLeaves();
  //   } catch (err: any) {
  //     showToast(err?.response?.data || "Error");
  //   }
  // };

  const submitToServer = async (category: string) => {
    if (loading) return;

    setLoading(true);

    const empCode = getUser()?.empCode;

    const payload = {
      _fromdate: fmtDMY(startDate),
      _todate: singleDateMode
        ? fmtDMY(startDate)
        : fmtDMY(endDate),

      _remarks: remarks,
      _PermTime: requestType === "Permission" ? permTime : "",
      _requesttype: requestType,
      _empcode: empCode,
      _leaveMode:
        requestType === "Permission"
          ? "Permission"
          : leaveMode,

      _leaveCategory:
        requestType === "Permission"
          ? "Permission"
          : category,
    };

    try {
      const res = await axios.post(
        `${API_BASE}Leave/saveleaverequest`,
        payload
      );

      const newLid = typeof res.data === "number" ? res.data : null;

      window.dispatchEvent(new Event("refreshRequests"));
      window.dispatchEvent(new CustomEvent("leaveRequestAdded"));

      showToast("Submitted Successfully");
      clearForm();
      loadExistingLeaves();

      // ── Send WhatsApp template to RA1 with Approve / Reject buttons ─
      if (newLid) {
        try {
          const token = localStorage.getItem("token")?.replace(/"/g, "");
          const ra1Res = await axios.get(
            `${API_BASE}Leave/GetRA1Mobile`,
            {
              params: { lid: newLid },
              headers: { Authorization: `Bearer ${token}` }
            }
          );
          const { mobile, empName: ra1Name, empCode: ra1EmpCode } = ra1Res.data;
          if (mobile) {
            const user = getUser();
            const leaveType = payload._leaveMode +
              (payload._leaveCategory ? ` / ${payload._leaveCategory}` : "");

            await axios.post(
              `${API_BASE}Leave/SendLeaveWhatsApp`,
              {
                Lid:       newLid,
                Ra1Mobile: mobile,
                EmpName:   user.empName || user.empCode,
                FromDate:  payload._fromdate,
                ToDate:    payload._todate,
                LeaveType: leaveType,
                Reason:    payload._remarks,
                RaEmpCode: ra1EmpCode
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
          }
        } catch (waErr) {
          console.error("[WhatsApp] Leave RA1 notify failed:", waErr);
        }
      }
    }
    catch (err: any) {
      showToast(
        err?.response?.data ||
        err?.response?.data?.message ||
        "Error submitting request"
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (requestType === "Permission") {
      setSingleDateMode(true);
      setEndDate(null);
    } else if (leaveMode === "Leave") {
      setSingleDateMode(false);
    }
  }, [requestType, leaveMode]);

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>

      {/* ── FORM GRID ── */}
      <div className="lr-bento-grid" style={requestType === 'Permission' ? { gridTemplateColumns: 'repeat(3, 1fr)' } : {}}>

        {/* Row 1: Leave Type | Category */}
        {requestType === "Leave" && (
          <div className="lr-field-box">
            <label className="lr-field-label">Leave Type</label>
            <div className="lr-field-content">
              <IonIcon icon={optionsOutline} className="lr-field-icon" />
              <IonSelect
                value={leaveMode}
                onIonChange={(e) => {
                  const v = e.detail.value;
                  setLeaveMode(v);
                  if (v !== "Leave") setLeaveCategory("");
                  if (v === "Forenoon" || v === "Afternoon") {
                    setSingleDateMode(true);
                    setEndDate(null);
                  } else {
                    setSingleDateMode(false);
                  }
                }}
                interface="popover"
                className="lr-popover-select"
              >
                <IonSelectOption value="">Select Leave Type</IonSelectOption>
                <IonSelectOption value="Leave">Leave</IonSelectOption>
                <IonSelectOption value="Forenoon">Forenoon</IonSelectOption>
                <IonSelectOption value="Afternoon">Afternoon</IonSelectOption>
                <IonSelectOption value="Maternity">Maternity</IonSelectOption>
                <IonSelectOption value="Paternity">Paternity</IonSelectOption>
              </IonSelect>
            </div>
          </div>
        )}

        {requestType === "Leave" && leaveMode === "Leave" ? (
          <div className="lr-field-box">
            <label className="lr-field-label">Category</label>
            <div className="lr-field-content">
              <IonIcon icon={optionsOutline} className="lr-field-icon" />
              <IonSelect
                placeholder="Select Category"
                value={leaveCategory}
                onIonChange={(e) => setLeaveCategory(e.detail.value)}
                interface="popover"
                className="lr-popover-select"
              >
                <IonSelectOption value="">Select Category</IonSelectOption>
                <IonSelectOption value="Casual">Casual</IonSelectOption>
                <IonSelectOption value="Sick">Sick</IonSelectOption>
              </IonSelect>
            </div>
          </div>
        ) : requestType === "Leave" ? (
          <div className="lr-field-box">
            <label className="lr-field-label">Category</label>
            <div className="lr-field-content">
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{leaveMode}</span>
            </div>
          </div>
        ) : null}

        {/* Row 2: Start Date | Minutes (permission) */}
        <div className="lr-field-box" onClick={() => setStartModal(true)}
          style={(requestType !== "Leave" && requestType !== "Permission") ? { gridColumn: '1 / -1' } : {}}>
          {/* <label className="lr-field-label">Start Date</label> */}
          <label className="lr-field-label">
            {singleDateMode ? "Select Date" : "Start Date"}
          </label>
          <div className="lr-field-content">
            <IonIcon icon={calendarOutline} className="lr-field-icon" />
            <span style={{ fontSize: 14, fontWeight: 500, color: startDate ? '#1e293b' : '#cbd5e1' }}>
              {startDate ? fmtDMY(startDate) : 'Select'}
            </span>
          </div>
        </div>
        

        {requestType === "Permission" && (
          <div className="lr-field-box">
            <label className="lr-field-label">Minutes</label>
            <div className="lr-field-content">
              <IonIcon icon={timeOutline} className="lr-field-icon" />
              <input
                type="number"
                placeholder="e.g. 60"
                value={permTime}
                onChange={(e) => setPermTime(e.target.value)}
                style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, fontWeight: 500, outline: 'none', color: '#1e293b', width: '100%' }}
              />
            </div>
          </div>
        )}

        {/* Row 3: End Date | Remarks (same row) */}
        {requestType === "Leave" && !singleDateMode && (
          <div className="lr-field-box" onClick={() => setEndModal(true)}>
            <label className="lr-field-label">End Date</label>
            <div className="lr-field-content">
              <IonIcon icon={calendarOutline} className="lr-field-icon" />
              <span style={{ fontSize: 14, fontWeight: 500, color: endDate ? '#1e293b' : '#cbd5e1' }}>
                {endDate ? fmtDMY(endDate) : 'Select'}
              </span>
            </div>
          </div>
        )}

        <div className="lr-field-box"
          style={(requestType !== "Leave" && requestType !== "Permission") ? { gridColumn: '1 / -1' } : {}}>
          <label className="lr-field-label">Remarks</label>
          <div className="lr-field-content" style={{ alignItems: 'flex-start' }}>
            <IonIcon icon={documentTextOutline} className="lr-field-icon" style={{ marginTop: 3 }} />
            <textarea
              placeholder="Enter details..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              style={{
                flex: 1, border: 'none', background: 'transparent',
                fontSize: 14, fontWeight: 500, outline: 'none',
                resize: 'none', color: '#1e293b', fontFamily: 'inherit', width: '100%'
              }}
            />
          </div>
        </div>

      </div>

      {/* ── Show Balance Button ── */}
      {leaveCategory === "Casual" && !balance && (
        <button
          onClick={checkBalance}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            margin: '0 14px 12px', background: 'transparent',
            border: 'none', color: 'var(--ion-color-primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer'
          }}
        >
          <IonIcon icon={informationCircleOutline} /> Show Leave Balance
        </button>
      )}

      {/* ── Balance Widget ── */}
      {balance && startDate && (
        <div style={{
          display: 'flex', justifyContent: 'space-around',
          margin: '0 14px 14px', background: '#f8fafc',
          border: '1px solid #e2e8f0', borderRadius: 14, padding: 14
        }}>
          {requestType === "Permission" ? (
            <>
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Used</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#ef4444' }}>{balance.used}m</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Available</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{balance.balance}m</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Sessions</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{balance.usedSessions}/{balance.maxSessions}</span>
              </div>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Used</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#ef4444' }}>{balance.used}</span>
              </div>
              <div style={{ width: 1, background: '#e2e8f0' }} />
              <div style={{ textAlign: 'center', flex: 1 }}>
                <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Available</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{balance.balance}</span>
              </div>
            </>
          )}
        </div>
      )}
      {/* <IonButton
        expand="block"
        fill="outline"
        onClick={() =>
          setShowPreviousDateRequest(!showPreviousDateRequest)
        }
      >
        {showPreviousDateRequest
          ? "Hide Previous Date Request"
          : "Request Previous Date Access"}
      </IonButton>

      {showPreviousDateRequest && (
        <div
          style={{
            marginTop: 12,
            marginBottom: 16,
            padding: 16,
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            background: "#f8fafc"
          }}
        >
          <h4>Previous Date Unlock Request</h4>

          <div className="lr-field-box">
            <label className="lr-field-label">
              Employee Code
            </label>
            <input
              value={getUser()?.empCode || ""}
              disabled
            />
          </div>

          <div className="lr-field-box">
            <label className="lr-field-label">Request Type</label>
            <div className="lr-field-content">
              <IonIcon icon={optionsOutline} className="lr-field-icon" />
              <IonSelect
                value={requestType}
                onIonChange={(e) => {
                  const value = e.detail.value;
                  setRequestType(value);

                  // reset fields when changing request type
                  setLeaveMode("");
                  setLeaveCategory("");
                  setStartDate(null);
                  setEndDate(null);
                  setPermTime("");
                }}
                interface="popover"
                className="lr-popover-select"
              >
                <IonSelectOption value="Leave">Leave</IonSelectOption>
                <IonSelectOption value="Permission">Permission</IonSelectOption>
                <IonSelectOption value="HalfDay">Half Day</IonSelectOption>
                <IonSelectOption value="FullDay">Full Day</IonSelectOption>
              </IonSelect>
            </div>
          </div>

          <div className="lr-field-box">
            <label className="lr-field-label">
              From Date
            </label>
            <input
              type="date"
              value={unlockFromDate || ""}
              max={moment()
                .subtract(1, "day")
                .format("YYYY-MM-DD")}
              onChange={(e) =>
                setUnlockFromDate(e.target.value)
              }
            />
          </div>

          <div className="lr-field-box">
            <label className="lr-field-label">
              To Date
            </label>
            <input
              type="date"
              value={unlockToDate || ""}
              max={moment()
                .subtract(1, "day")
                .format("YYYY-MM-DD")}
              onChange={(e) =>
                setUnlockToDate(e.target.value)
              }
            />
          </div>

          <div className="lr-field-box">
            <label className="lr-field-label">
              Reason
            </label>
            <textarea
              rows={3}
              value={unlockReason}
              onChange={(e) =>
                setUnlockReason(e.target.value)
              }
            />
          </div>

          <IonButton
            expand="block"
            onClick={submitPreviousDateRequest}
          >
            Submit Unlock Request
          </IonButton>
        </div>
      )} */}
      
      <button
        className="lr-gradient-btn"
        onClick={onSubmit}
        disabled={loading}
        style={{
          opacity: loading ? 0.7 : 1,
          cursor: loading ? "not-allowed" : "pointer",
          margin: "16px 14px",
          width: "calc(100% - 28px)"
        }}
      >
        {loading ? (
          <>
            <span
              className="spinner-border spinner-border-sm"
              style={{ marginRight: "8px" }}
            />
            Submitting...
          </>
        ) : (
          "Submit Request"
        )}
      </button>

      {/* ✅ START DATE MODAL */}
    <IonModal
  isOpen={startModal}
  className="small-datetime-modal"
  onDidDismiss={() => setStartModal(false)}
>
<IonDatetime
  presentation="date"
  preferWheel={true}
  showDefaultButtons={true}
  doneText="Done"
  cancelText="Cancel"
  value={startDate || undefined}
  min={unlockRange.approved ? unlockRange.fromDate : new Date().toISOString().split("T")[0]}
  max={`${new Date().getFullYear()}-12-31`}
  isDateEnabled={(dateString) => {
    const date = dateString.split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    // Approved date
    if (
      unlockRange.approved &&
      date === unlockRange.fromDate
    ) {
      return true;
    }

    // Today and future
    return date >= today;
  }}
  onIonChange={(e) => {
    const value = e.detail.value;

    if (value) {
      const selected = String(value).split("T")[0];
      setStartDate(selected);
      setEndDate("");
    }
  }}
/>
</IonModal>



      {/* ✅ END DATE MODAL */}
      <IonModal
        isOpen={endModal}
        className="small-datetime-modal"
        onDidDismiss={() => setEndModal(false)}
      >
        <div className="datetime-card">
<IonDatetime
  presentation="date"
  preferWheel={true}
  showDefaultButtons={true}
  doneText="Done"
  cancelText="Cancel"
  value={endDate || undefined}
  min={
    startDate === unlockRange.fromDate
      ? unlockRange.fromDate
      : (startDate || new Date().toISOString().split("T")[0])
  }
  max={
    startDate === unlockRange.fromDate
      ? unlockRange.toDate
      : `${new Date().getFullYear()}-12-31`
  }
  isDateEnabled={(dateString) => {
    const date = dateString.split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    // If approved date selected as Start Date,
    // restrict End Date to approval range only
    if (startDate === unlockRange.fromDate) {
      return (
        date >= unlockRange.fromDate &&
        date <= unlockRange.toDate
      );
    }

    // Normal behavior
    return date >= (startDate || today);
  }}
  onIonChange={(e) => {
    const value = e.detail.value;

    if (value) {
      setEndDate(String(value).split("T")[0]);
    }
  }}
/>
        </div>
      </IonModal>
      {/* ✅ LOP CONFIRMATION MODAL */}
      <IonModal isOpen={confirmLOP}>
        <div style={{ padding: 20 }}>
          <h3>⚠️ Confirmation</h3>
          <p>{lopMessage}</p>

          <IonButton
            color="danger"
            expand="block"
            onClick={() => {
              setConfirmLOP(false);

              let finalCategory = "";

              if (requestType === "Permission") {
                finalCategory = "Permission";
              } else if (leaveMode === "Leave") {
                finalCategory = leaveCategory;
              } else if (
                leaveMode === "Forenoon" ||
                leaveMode === "Afternoon"
              ) {
                finalCategory = "Casual";
              } else {
                finalCategory = leaveMode;
              }

              submitToServer(finalCategory);
            }}
          >
            Yes Continue
          </IonButton>

          {/* <IonButton
            color="danger"
            expand="block"
            onClick={() => {
              setConfirmLOP(false);
              submitToServer("LOP");
            }}
          >
            Yes Continue (LOP)
          </IonButton> */}

          <IonButton
            expand="block"
            onClick={() => {
              setConfirmLOP(false);
              clearForm();
            }}
          >
            Cancel
          </IonButton>
        </div>
      </IonModal>

      <IonToast
        isOpen={toastOpen}
        message={toastMsg}
        duration={2000}
        onDidDismiss={() => setToastOpen(false)}
      />
      {loading && (
        <div className="leave-loader-overlay">
          <div className="leave-loader-box">
            <div className="leave-spinner"></div>
            <div className="leave-loader-text">
              Submitting Leave Request...
            </div>
          </div>
        </div>
      )}

    </div>


  );
};

export default LeaveForm;



