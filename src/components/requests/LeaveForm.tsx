import React, { useEffect, useState } from "react";
import {
  IonInput,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonToast,
  IonDatetime,
  IonButton,
} from "@ionic/react";
import axios from "axios";
import moment from "moment";
import { API_BASE } from "../../config";

const getUser = () => JSON.parse(localStorage.getItem("user") || "{}");

const fmtDMY = (iso: string | null) =>
  iso ? moment(iso).format("DD-MM-YYYY") : "";

const LeaveForm: React.FC<{ defaultType?: string }> = ({ defaultType }) => {
  const [requestType, setRequestType] = useState("Leave");
  const [leaveMode, setLeaveMode] = useState("Leave");
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

  useEffect(() => {
    setRequestType(defaultType === "permission" ? "Permission" : "Leave");
    loadExistingLeaves();
  }, [defaultType]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
  };

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
  } else {
    finalCategory = leaveMode;
  }

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
    const empCode = getUser()?.empCode;

    if (!startDate) return showToast("Select date");
    if (!remarks) return showToast("Enter remarks");

    if (isDuplicateDate(startDate)) {
      clearForm();
      return showToast("Leave already applied for this date");
    }

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

  const submitToServer = async (category: string) => {
    const empCode = getUser()?.empCode;

    const payload = {
      _fromdate: fmtDMY(startDate),
      _todate:
        requestType === "Permission"
          ? fmtDMY(startDate)
          : fmtDMY(endDate),

      _remarks: remarks,
      _PermTime: requestType === "Permission" ? permTime : "",
      _requesttype: requestType,
      _empcode: empCode,
      _leaveMode: requestType === "Permission" ? "Permission" : leaveMode,
      _leaveCategory: requestType === "Permission" ? "Permission" : category,
    };

    try {
      await axios.post(`${API_BASE}Leave/saveleaverequest`, payload);
      showToast("Submitted Successfully");
      clearForm();
      loadExistingLeaves();
    } catch (err: any) {
      showToast(err?.response?.data || "Error");
    }
  };

  return (
    <div className="form-card">

      {/* LEAVE MODE */}
      {requestType === "Leave" && (
        <div className="form-row">
          <IonSelect
            value={leaveMode}
            onIonChange={(e) => {
              const value = e.detail.value;
              setLeaveMode(value);

              if (value !== "Leave") {
                setLeaveCategory("");
              }
            }}
          >
            <IonSelectOption value="Leave">Leave</IonSelectOption>
            <IonSelectOption value="Forenoon">Forenoon</IonSelectOption>
            <IonSelectOption value="Afternoon">Afternoon</IonSelectOption>
            <IonSelectOption value="Maternity">Maternity</IonSelectOption>
            <IonSelectOption value="Paternity">Paternity</IonSelectOption>
          </IonSelect>

          {leaveMode === "Leave" ? (
            <IonSelect
              placeholder="Category"
              value={leaveCategory}
              onIonChange={(e) => setLeaveCategory(e.detail.value)}
            >
              <IonSelectOption value="Casual">Casual</IonSelectOption>
              <IonSelectOption value="Sick">Sick</IonSelectOption>
            </IonSelect>
          ) : (
            <div className="auto-category">
              Category Auto: <b>{leaveMode}</b>
            </div>
          )}
        </div>
      )}

      {/* DATES */}
      <div className="form-row">
        <div className="date-box" onClick={() => setStartModal(true)}>
          {startDate ? fmtDMY(startDate) : "Start Date"}
        </div>

        {requestType === "Leave" && (
          <div className="date-box" onClick={() => setEndModal(true)}>
            {endDate ? fmtDMY(endDate) : "End Date"}
          </div>
        )}

        {requestType === "Permission" && (
          <IonInput
            type="number"
            placeholder="Minutes"
            value={permTime}
            onIonChange={(e) => setPermTime(e.detail.value!)}
          />
        )}
      </div>

      {/* 🔥 SHOW BALANCE BUTTON */}
      {leaveCategory === "Casual" && (
        <button className="balance-btn" onClick={checkBalance}>
          🔍 Show Balance
        </button>
      )}

      {/* 🔥 BALANCE DISPLAY */}
     {balance && startDate && (
  <div className="balance-box">
    {requestType === "Permission" ? (
      <>
        <p>⏱ Used Minutes: {balance.used}</p>
        <p>✅ Available Minutes: {balance.balance}</p>
        <p>📊 Sessions: {balance.usedSessions} / {balance.maxSessions}</p>
      </>
    ) : (
      <>
        <p>📊 Used: {balance.used}</p>
        <p>✅ Available: {balance.balance}</p>
      </>
    )}
  </div>
)}

      {/* REMARKS */}
      <textarea
        className="remarks-box"
        placeholder="Remarks"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
      />

      <button className="submit-btn" onClick={onSubmit}>
        Submit
      </button>

       {/* ✅ START DATE MODAL */}
      <IonModal isOpen={startModal} className="pwt-date-modal">
        <div className="pwt-modal-content">
          <h3>Select Date</h3>
          <IonDatetime
            presentation="date"
            onIonChange={(e) => {
              const v = e.detail.value as string;
              setStartDate(v.split("T")[0]);
              setStartModal(false);
            }}
          />
          <IonButton expand="block" onClick={() => setStartModal(false)}>
            Close
          </IonButton>
        </div>
      </IonModal>

      {/* ✅ END DATE MODAL */}
      <IonModal isOpen={endModal} className="pwt-date-modal">
        <div className="pwt-modal-content">
          <h3>Select End Date</h3>
          <IonDatetime
            presentation="date"
            onIonChange={(e) => {
              const v = e.detail.value as string;
              setEndDate(v.split("T")[0]);
              setEndModal(false);
            }}
          />
          <IonButton expand="block" onClick={() => setEndModal(false)}>
            Close
          </IonButton>
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
              submitToServer("LOP");
            }}
          >
            Yes Continue (LOP)
          </IonButton>

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
    </div>
  );
};

export default LeaveForm;



