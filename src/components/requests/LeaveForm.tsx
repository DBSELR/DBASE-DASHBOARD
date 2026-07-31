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
import { calendarOutline, documentTextOutline, optionsOutline, timeOutline, informationCircleOutline, alertCircleOutline } from "ionicons/icons";
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
  const [inTime, setInTime] = useState("");

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const [startModal, setStartModal] = useState(false);
  const [endModal, setEndModal] = useState(false);


  // 🔥 NEW STATES
  const [balance, setBalance] = useState<any>(null);
  const [existingDates, setExistingDates] = useState<any[]>([]);

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
        `${API_BASE}ApprovalRequest/GetApprovedUnlockRequest`,
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
        `${API_BASE}ApprovalRequest/SaveApprovalRequest`,
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

      // Normalize items: support both the older string array and the newer object array formats
      const data = (res.data || []).map((item: any) => {
        if (typeof item === "string") {
          return { date: item, leaveMode: "", leaveCategory: "", lType: "", pOut: "" };
        }
        return item;
      });

      setExistingDates(data);
    } catch (e) {
      console.error("Error loading existing leaves");
    }
  };

  // =========================================
  // 🔥 CHECK DUPLICATE DATE
  // =========================================
  const isDuplicateDate = (date: string) => {
    const formatted = moment(date).format("YYYY-MM-DD");
    return existingDates.some((item: any) => item?.date === formatted);
  };

  // =========================================
  // 🔥 REAL-TIME BALANCE API
  // =========================================


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



  const onSubmit = async () => {
    if (loading) return; // Prevent double click
    const empCode = getUser()?.empCode;


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

    const getDuplicateConflict = (date: string | null): string | null => {
      if (!date) return null;
      const formattedDate = moment(date).format("YYYY-MM-DD");

      const matchingLeaves = existingDates.filter(
        (item: any) => item.date === formattedDate
      );

      if (matchingLeaves.length === 0) return null;

      // Permissions are handled via separate backend checks, don't block on frontend duplicate dates
      if (requestType === "Permission") {
        return null;
      }

      if (requestType === "Leave") {
        const isHalfDayRequest = leaveMode === "Forenoon" || leaveMode === "Afternoon";

        // Check for existing permissions on the same date
        const existingPermission = matchingLeaves.find(
          (item: any) => item.leaveMode === "Permission" || item.lType === "Permission"
        );

        if (existingPermission) {
          const isMorningPermission = (pOut: string | null) => {
            if (!pOut) return true; // Default to morning if no time is specified
            const parts = pOut.split(":");
            if (parts.length > 0) {
              const hour = parseInt(parts[0], 10);
              if (!isNaN(hour)) {
                return hour < 13; // Before 1:00 PM is morning/Forenoon
              }
            }
            return true;
          };

          if (isHalfDayRequest) {
            const isMorningPerm = isMorningPermission(existingPermission.pOut);
            if (leaveMode === "Forenoon" && isMorningPerm) {
              return "Permission already applied for forenoon on this date";
            }
            if (leaveMode === "Afternoon" && !isMorningPerm) {
              return "Permission already applied for afternoon on this date";
            }
          } else {
            // Full day leave request conflicts with any permission
            return "Permission already applied for this date";
          }
        }

        if (isHalfDayRequest) {
          // Block if the exact same half-day leave exists
          const sameHalfDay = matchingLeaves.find(
            (item: any) => item.leaveMode === leaveMode
          );
          if (sameHalfDay) {
            return "Same half-day leave already applied";
          }

          // Block if a full-day leave already exists
          const fullDay = matchingLeaves.find(
            (item: any) =>
              item.leaveMode !== "Forenoon" &&
              item.leaveMode !== "Afternoon" &&
              item.leaveMode !== "Permission"
          );
          if (fullDay) {
            return "Full-day leave already exists for this date";
          }
        } else {
          // Block if any leave exists on this date for a full-day request
          // (Filtering out permission since we checked it above)
          const nonPermissionLeaves = matchingLeaves.filter(
            (item: any) => item.leaveMode !== "Permission" && item.lType !== "Permission"
          );
          if (nonPermissionLeaves.length > 0) {
            return "Leave already applied for this date";
          }
        }
      }

      return null;
    };

    const conflictMessage = getDuplicateConflict(startDate);
    if (conflictMessage) {
      clearForm();
      return showToast(conflictMessage);
    }

    let finalCategory =
      leaveMode === "Leave" ? leaveCategory : leaveMode;

    let requestedDays = 1;
    if (finalCategory === "Forenoon" || finalCategory === "Afternoon") {
      finalCategory = "Casual";
      requestedDays = 0.5;
    } else if (!singleDateMode && startDate && endDate) {
      requestedDays = moment(endDate).diff(moment(startDate), "days") + 1;
    }

    if (
      finalCategory === "Casual" &&
      requestedDays > Number(balance?.balance ?? 0)
    ) {
      setLopMessage(
        Number(balance?.balance ?? 0) <= 0
          ? "CL balance exhausted. Convert to LOP."
          : `You requested ${requestedDays} days but only have ${balance?.balance} CL available. Remaining ${requestedDays - Number(balance?.balance)} CL Convert to LOP.`
      );
      setConfirmLOP(true);
      return;
    }

    if (
      finalCategory === "Sick" &&
      requestedDays > Number(balance?.balance ?? 0)
    ) {
      setLopMessage(
        Number(balance?.balance ?? 0) <= 0
          ? "SL balance exhausted. Convert to LOP."
          : `You requested ${requestedDays} days but only have ${balance?.balance} SL available. Remaining ${requestedDays - Number(balance?.balance)} SL Convert to LOP.`
      );
      setConfirmLOP(true);
      return;
    }

    // 🔥 PERMISSION VALIDATION
    if (requestType === "Permission" && balance) {
      const minutes = parseFloat(permTime || "0");

      if (balance.usedSessions >= balance.maxSessions) {
        setLopMessage("Session limit exceeded → Convert to LOP.");
        setConfirmLOP(true);
        return;
      }

      if (minutes > balance.balance) {
        setLopMessage("Permission minutes exceeded → Convert to LOP.");
        setConfirmLOP(true);
        return;
      }
    }

    submitToServer(finalCategory);
  };


  const submitSplitLeave = async () => {
    if (loading) return;

    const available = Number(balance?.balance ?? 0);
    if (available <= 0 || !startDate || !endDate || singleDateMode) {
      submitToServer("LOP");
      return;
    }

    let originalCategory = leaveMode === "Leave" ? leaveCategory : leaveMode;
    if (originalCategory === "Forenoon" || originalCategory === "Afternoon") {
      originalCategory = "Casual";
    }

    const requestedDays = moment(endDate).diff(moment(startDate), "days") + 1;

    let requests: any[] = [];
    let currentDate = moment(startDate);
    let remainingCasual = available;

    for (let i = 0; i < requestedDays; i++) {
      let dateStr = currentDate.format("YYYY-MM-DD");
      if (remainingCasual >= 1) {
        requests.push({ date: dateStr, mode: "Leave", cat: originalCategory });
        remainingCasual -= 1;
      } else if (remainingCasual === 0.5) {
        requests.push({ date: dateStr, mode: "Forenoon", cat: originalCategory });
        requests.push({ date: dateStr, mode: "Afternoon", cat: "LOP" });
        remainingCasual -= 0.5;
      } else {
        requests.push({ date: dateStr, mode: "Leave", cat: "LOP" });
      }
      currentDate.add(1, 'days');
    }

    let groups: any[] = [];
    let currentGroup: any = null;

    for (let req of requests) {
      if (!currentGroup || currentGroup.cat !== req.cat) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = {
          start: req.date,
          end: req.date,
          mode: "Leave",
          cat: req.cat,
          count: req.mode === "Leave" ? 1 : 0.5
        };
      } else {
        currentGroup.end = req.date;
        currentGroup.count += req.mode === "Leave" ? 1 : 0.5;
        currentGroup.mode = "Leave";
      }
    }
    if (currentGroup) groups.push(currentGroup);

    setLoading(true);

    try {
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const isLast = i === groups.length - 1;
        const remarkText = group.cat === "LOP" ? `(${group.count} Days Converted to LOP)` : `(${group.count} Days ${group.cat})`;
        await submitToServer(group.cat, group.start, group.end, remarks + " " + remarkText, !isLast, group.mode, group.count);
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const submitToServer = async (
    category: string,
    overrideFrom?: string,
    overrideTo?: string,
    overrideRemarks?: string,
    skipClear?: boolean,
    overrideMode?: string,
    overrideDays?: number
  ) => {
    if (loading && !overrideFrom) return;

    if (!overrideFrom) setLoading(true);

    const empCode = getUser()?.empCode;

    const payload = {
      _fromdate: fmtDMY(overrideFrom || startDate),
      _todate: singleDateMode
        ? fmtDMY(overrideFrom || startDate)
        : fmtDMY(overrideTo || endDate),

      _remarks: overrideRemarks || remarks,
      _PermTime:
        requestType === "Permission"
          ? permTime
          : overrideDays !== undefined
          ? String(overrideDays)
          : "",
      _InTime:
        requestType === "Permission"
          ? moment(inTime, "HH:mm").format("HH:mm")
          : null,
      _requesttype: requestType,
      _empcode: empCode,
      _leaveMode:
        requestType === "Permission"
          ? "Permission"
          : overrideMode || leaveMode,

      _leaveCategory:
        requestType === "Permission"
          ? "Permission"
          : category,
    };

    try {
      const saveUrl = requestType === "Permission"
        ? `${API_BASE}Permission/savepermissionrequest`
        : `${API_BASE}Leave/saveleaverequest`;
      const res = await axios.post(
        saveUrl,
        payload
      );
      console.log("================================");
      console.log("[SAVE LEAVE SUCCESS]");
      console.log("Payload:", payload);
      console.log("Response:", res.data);
      console.log("Response Type:", typeof res.data);
      console.log("================================");

      const newLid = typeof res.data === "number" ? res.data : null;

      window.dispatchEvent(new Event("refreshRequests"));
      window.dispatchEvent(new CustomEvent("leaveRequestAdded"));

      showToast("Submitted Successfully");

      if (!skipClear) {
        clearForm();
        loadExistingLeaves();
      }



      // ── Send WhatsApp template to RA1 ──
      if (newLid) {
        try {
          const token = localStorage.getItem("token")?.replace(/"/g, "");

          console.log("====================================");
          console.log("[WHATSAPP FLOW START]");
          console.log("Leave Id:", newLid);
          console.log("Token Exists:", !!token);
          console.log("API_BASE:", API_BASE);
          console.log("====================================");

          const ra1Url =
            `${API_BASE}Leave/GetRA1Mobile?lid=${newLid}`;

          console.log("[STEP-1] Calling RA1 API");
          console.log("URL:", ra1Url);

          const ra1Res = await axios.get(
            `${API_BASE}Leave/GetRA1Mobile`,
            {
              params: { lid: newLid },
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          );

          console.log("[STEP-1 SUCCESS]");
          console.log("Status:", ra1Res.status);
          console.log("Response:", ra1Res.data);

          const {
            mobile,
            empName: ra1Name,
            empCode: ra1EmpCode
          } = ra1Res.data;

          console.log("RA1 Mobile:", mobile);
          console.log("RA1 Name:", ra1Name);
          console.log("RA1 EmpCode:", ra1EmpCode);

          if (!mobile) {
            console.warn(
              "[WHATSAPP SKIPPED] RA1 not configured or mobile missing for RA:",
              ra1Res.data?.message || "No mobile number found"
            );
            showToast("Leave submitted! Manager mobile number missing in records, WhatsApp alert skipped.");
            return;
          }

          const user = getUser();

          const leaveType =
            requestType === "Permission"
              ? `Permission${permTime ? ` (${permTime} mins)` : ""}`
              : payload._leaveMode +
              (payload._leaveCategory && payload._leaveCategory !== payload._leaveMode
                ? ` / ${payload._leaveCategory}`
                : "");

          const whatsappPayload = {
            Lid: newLid,
            Ra1Mobile: mobile,
            EmpName: user.empName || user.empCode,
            FromDate: payload._fromdate,
            ToDate: payload._todate,
            LeaveType: leaveType,
            Reason: payload._remarks,
            RaEmpCode: ra1EmpCode || user.ra1 || user.reportingAuthority || "",
            RequestType: requestType
          };

          console.log("====================================");
          console.log("[STEP-2] Sending WhatsApp");
          console.log("Payload:");
          console.log(JSON.stringify(whatsappPayload, null, 2));
          console.log("====================================");

          const waRes = await axios.post(
            `${API_BASE}Leave/SendLeaveWhatsApp`,
            whatsappPayload,
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          );

          console.log("[STEP-2 SUCCESS]");
          console.log("Status:", waRes.status);
          console.log("Response:", waRes.data);

          console.log("[WHATSAPP FLOW COMPLETED]");
        } catch (waErr: any) {
          console.error("====================================");
          console.error("[WHATSAPP ERROR]");
          console.error("Message:", waErr.message);
          console.error("Status:", waErr?.response?.status);
          console.error("StatusText:", waErr?.response?.statusText);
          console.error("Response Data:", waErr?.response?.data);
          console.error("Request URL:", waErr?.config?.url);
          console.error("Request Params:", waErr?.config?.params);
          console.error("====================================");
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
      if (!skipClear) setLoading(false);
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
            <label className="lr-field-label">Time</label>
            <div className="lr-field-content">
              <IonIcon icon={timeOutline} className="lr-field-icon" />

              <input
                type="time"
                value={inTime}
                onChange={(e) => setInTime(e.target.value)}
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  outline: "none"
                }}
              />
            </div>
          </div>
        )}

        {requestType === "Permission" && (
          <div className="lr-field-box">
            <label className="lr-field-label">Minutes</label>
            <div className="lr-field-content">
              <IonIcon icon={timeOutline} className="lr-field-icon" />
              <input
                type="number"
                placeholder="E.x. 60"
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
          max={`${new Date().getFullYear() + 1}-12-31`}
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
                : `${new Date().getFullYear() + 1}-12-31`
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
      <IonModal
        isOpen={confirmLOP}
        onDidDismiss={() => setConfirmLOP(false)}
        style={{
          '--border-radius': '25px',
          '--height': 'auto',
          '--width': '90%',
          '--max-width': '400px'
        }}
      >
        <div style={{
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          fontFamily: 'inherit',
          background: '#ffffff'
        }}>
          {/* Alert Icon */}
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px'
          }}>
            <IonIcon icon={alertCircleOutline} style={{ fontSize: '32px', color: '#dc2626' }} />
          </div>

          <h3 style={{ margin: '0 0 12px', fontSize: '22px', fontWeight: '700', color: '#1e293b' }}>
            Confirmation
          </h3>

          <p style={{ margin: '0 0 32px', fontSize: '15px', color: '#64748b', lineHeight: '1.5' }}>
            {lopMessage}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '12px' }}>
            <button
              onClick={() => {
                setConfirmLOP(false);
                submitSplitLeave();
              }}
              style={{
                width: '100%',
                padding: '14px',
                background: '#761f1fff',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontWeight: '600',
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              YES CONTINUE (LOP)
            </button>

            <button
              onClick={() => {
                setConfirmLOP(false);
                clearForm();
              }}
              style={{
                width: '100%',
                padding: '14px',
                background: '#5c805a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontWeight: '600',
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              CANCEL
            </button>
          </div>
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



