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
import {
  calendarOutline,
  documentTextOutline,
  optionsOutline,
  timeOutline,
  informationCircleOutline,
  alertCircleOutline,
  checkmarkCircleOutline,
  sparklesOutline,
  arrowForwardOutline,
  walletOutline
} from "ionicons/icons";
import axios from "axios";
import moment from "moment";
import { API_BASE } from "../../config";
import { apiService } from "../../utils/apiService";
import "./LeaveForm.css";

const getUser = () => {
  try {
    const stored =
      localStorage.getItem("storedUser") ||
      localStorage.getItem("user") ||
      localStorage.getItem("userData");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const fmtDMY = (iso: string | null) =>
  iso ? moment(iso).format("DD-MM-YYYY") : "";

const LeaveForm: React.FC<{ defaultType?: string }> = ({ defaultType }) => {
  const isDefaultPerm = (defaultType || "").toLowerCase() === "permission";
  const [requestType, setRequestType] = useState(isDefaultPerm ? "Permission" : "Leave");
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
    const isPerm = (defaultType || "").toLowerCase() === "permission";
    setRequestType(isPerm ? "Permission" : "Leave");
    loadExistingLeaves();
  }, [defaultType]);



  const clearForm = () => {
    setStartDate(null);
    setEndDate(null);
    setRemarks("");
    setPermTime("");
    setInTime("");
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
          return { date: item, leaveMode: "", leaveCategory: "", lType: "", pOut: "", remarks: "" };
        }
        const lType = String(item.lType || item.LType || item.ltype || item.requestType || item.RequestType || "").trim();
        const leaveMode = String(item.leaveMode || item.LeaveMode || item.leavemode || "").trim();
        const leaveCategory = String(item.leaveCategory || item.LeaveCategory || item.leavecategory || "").trim();
        const rawDate = item.date || item.Date || item.lfrom || item.LFrom || item.lFrom;
        const formattedDate = rawDate ? moment(rawDate).format("YYYY-MM-DD") : "";
        const remarks = String(item.remarks || item.Remarks || item.purpose || item.Purpose || "").trim();

        return {
          date: formattedDate,
          leaveMode,
          leaveCategory,
          lType,
          pOut: item.pOut || item.P_Out || item.p_out || "",
          remarks
        };
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


  const checkBalance = async (dateOverride?: string) => {
    const empCode = getUser()?.empCode;
    const targetDate = dateOverride || startDate;

    if (!targetDate) return;

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

    if (!finalCategory) return;

    try {
      const res = await axios.get(
        `${API_BASE}Leave/GetLeaveBalance`,
        {
          params: {
            empCode,
            leaveCategory: finalCategory,
            date: targetDate,
          },
        }
      );

      const rawMax = Number(res.data?.maxSessions || 0);
      const maxSessions = rawMax > 0 ? rawMax : (finalCategory === "Permission" ? 6 : 0);

      let usedSessions = Number(res.data?.usedSessions || 0);
      let permUsedMinutes = Number(res.data?.used || 0);
      let permBalanceMinutes = Number(res.data?.balance || 0);

      if (finalCategory === "Permission" && targetDate) {
        const targetMoment = moment(targetDate);
        const monthStr = targetMoment.format("MMM-YYYY");
        const monthIso = targetMoment.format("YYYY-MM");
        const prevMoment = targetMoment.clone().subtract(1, "month");
        const prevMonthStr = prevMoment.format("MMM-YYYY");
        const currM = targetMoment.month() + 1;
        const currY = targetMoment.year();
        const prevM = prevMoment.month() + 1;
        const prevY = prevMoment.year();

        const sumPermRows = (rows: any[]): number => {
          let total = 0;
          if (!Array.isArray(rows)) return 0;
          rows.forEach((row: any) => {
            const status = String(row?.L_status || row?.Status || (Array.isArray(row) ? row[7] : "") || "").toLowerCase();
            if (status === "rejected" || status === "cancelled") return;

            const cat = String(row?.LeaveCategory || row?.leaveCategory || (Array.isArray(row) ? row[11] : "") || "").toLowerCase();
            const rem = String(row?.Remarks || row?.remarks || (Array.isArray(row) ? (row[9] || row[10]) : "") || "").toLowerCase();
            if (cat.includes("lop") || rem.includes("converted to lop")) return;

            let m = parseFloat(String(row?.ptime || row?.pTime || row?.PTime || (Array.isArray(row) ? row[5] : "") || "0")) || 0;
            if (m === 0) {
              const match = rem.match(/(\d+(?:\.\d+)?)\s*(?:min|mins|minute|minutes)/i);
              if (match) m = parseFloat(match[1]) || 0;
            }
            total += m;
          });
          return total;
        };

        const isDateLike = (v: any) => /\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(String(v || "").trim());

        const parseOtHHmm = (t: string) => {
          if (!t) return "";
          const s = String(t).trim();
          if (/^\d{2}:\d{2}$/.test(s)) return s;
          if (/^\d{1}:\d{2}$/.test(s)) return `0${s}`;
          if (/^\d{2}:\d{2}:\d{2}/.test(s)) return s.substring(0, 5);
          const m = moment(s, ["hh:mm A", "h:mm A", "HH:mm:ss", "HH:mm"]);
          if (m.isValid()) return m.format("HH:mm");
          return s;
        };

        const getEligibleOTMins = (ot: any): number => {
          const is24Col = Array.isArray(ot) && (ot.length >= 20 || isDateLike(ot[3]));
          const rawStatus = String(
            (Array.isArray(ot) ? (is24Col ? ot[23] : ot[14]) : (ot?.L_status || ot?.Status || ot?.status)) || ""
          ).toLowerCase().trim();
          const rs1 = String((Array.isArray(ot) && is24Col ? ot[19] : ot?.RA1_Status) || "").toLowerCase().trim();
          const rs2 = String((Array.isArray(ot) && is24Col ? ot[20] : ot?.RA2_Status) || "").toLowerCase().trim();
          const rs3 = String((Array.isArray(ot) && is24Col ? ot[21] : ot?.RA3_Status) || "").toLowerCase().trim();
          const rs4 = String((Array.isArray(ot) && is24Col ? ot[22] : ot?.RA4_Status) || "").toLowerCase().trim();

          if (
            rawStatus.includes("reject") ||
            rawStatus.includes("cancel") ||
            rs1.includes("reject") ||
            rs2.includes("reject") ||
            rs3.includes("reject") ||
            rs4.includes("reject")
          ) {
            return 0;
          }

          const fromRaw = String(
            (Array.isArray(ot) ? (is24Col ? ot[5] : ot[4]) : (ot?.Fromtime || ot?.fromtime || ot?.FromTime)) || ""
          ).trim();
          const toRaw = String(
            (Array.isArray(ot) ? (is24Col ? ot[6] : ot[5]) : (ot?.Totime || ot?.totime || ot?.ToTime)) || ""
          ).trim();
          const rawMinDiff = parseFloat(
            String(
              (Array.isArray(ot) ? (is24Col ? ot[8] : (ot[11] ?? ot[8] ?? ot[7])) : (ot?.MinDiff || ot?.minDiff || ot?.OT_MIN)) || "0"
            )
          ) || 0;

          let workedMins = 0;
          const parsedFrom = parseOtHHmm(fromRaw);
          const parsedTo = parseOtHHmm(toRaw);
          if (parsedFrom && parsedTo && parsedFrom.includes(":") && parsedTo.includes(":")) {
            const [fH, fM] = parsedFrom.split(":").map(Number);
            const [tH, tM] = parsedTo.split(":").map(Number);
            if (!isNaN(fH) && !isNaN(fM) && !isNaN(tH) && !isNaN(tM)) {
              let diff = (tH * 60 + tM) - (fH * 60 + fM);
              if (diff < 0) diff += 24 * 60;
              workedMins = diff;
            }
          }

          // Rule: Only OT < 60 mins (worked < 120 mins) is added to Permission OT Earned
          if (workedMins >= 120) return 0;
          if (workedMins > 0 && workedMins < 120) {
            const halfMins = Math.floor(workedMins / 2);
            return (rawMinDiff > 0 && rawMinDiff < 60) ? rawMinDiff : (halfMins < 60 ? halfMins : 0);
          }
          return (rawMinDiff > 0 && rawMinDiff < 60) ? rawMinDiff : 0;
        };

        try {
          const [permListRes, prevPermListRes, otRes, currDashRes, prevDashRes] = await Promise.all([
            axios.get(
              `${API_BASE}Permission/Load_Leave_Permission?Empcode=${empCode}&Seachdate=${monthStr}&LType=permission`
            ).catch(() => null),
            axios.get(
              `${API_BASE}Permission/Load_Leave_Permission?Empcode=${empCode}&Seachdate=${prevMonthStr}&LType=permission`
            ).catch(() => null),
            axios.get(
              `${API_BASE}OverTime/load_overtime_duties?EmpCode=${empCode}`
            ).catch(() => null),
            axios.get(
              `${API_BASE}Permission/GetPermissionDashboard?EmpCode=${empCode}&Month=${currM}&Year=${currY}`
            ).catch(() => null),
            axios.get(
              `${API_BASE}Permission/GetPermissionDashboard?EmpCode=${empCode}&Month=${prevM}&Year=${prevY}`
            ).catch(() => null),
          ]);

          const currDashItem = Array.isArray(currDashRes?.data)
            ? (currDashRes.data.find((d: any) => String(d?.empCode || d?.EmpCode || "").trim() === String(empCode).trim()) || currDashRes.data[0])
            : null;
          const prevDashItem = Array.isArray(prevDashRes?.data)
            ? (prevDashRes.data.find((d: any) => String(d?.empCode || d?.EmpCode || "").trim() === String(empCode).trim()) || prevDashRes.data[0])
            : null;

          let currMonthOT = 0;
          let prevMonthOT = 0;
          let hasOtDutiesData = false;
          let earliestPrevOtMoment: moment.Moment | null = null;

          if (Array.isArray(otRes?.data)) {
            hasOtDutiesData = true;
            otRes.data.forEach((ot: any) => {
              const is24Col = Array.isArray(ot) && (ot.length >= 20 || isDateLike(ot[3]));
              const otEmp = String((Array.isArray(ot) ? ot[1] : (ot?.empcode || ot?.EmpCode)) || "").trim();
              if (otEmp && otEmp !== String(empCode).trim()) return;

              const otDateStr = String(
                (Array.isArray(ot) ? (is24Col ? ot[3] : ot[2]) : (ot?.lfrom || ot?.date || ot?.Date)) || ""
              ).trim();
              if (!otDateStr) return;

              const cleanOtDate = otDateStr.includes("T") ? otDateStr.split("T")[0] : otDateStr.split(" ")[0];
              const otMoment = moment(cleanOtDate, ["YYYY-MM-DD", "DD-MM-YYYY", "MM/DD/YYYY", "YYYY/MM/DD"], false);
              if (!otMoment.isValid()) return;

              const otMonthStr = otMoment.format("MMM-YYYY");
              const eligibleMins = getEligibleOTMins(ot);
              if (eligibleMins <= 0) return;

              if (otMonthStr === monthStr) {
                currMonthOT += eligibleMins;
              } else if (otMonthStr === prevMonthStr) {
                prevMonthOT += eligibleMins;
                if (!earliestPrevOtMoment || otMoment.isBefore(earliestPrevOtMoment, "day")) {
                  earliestPrevOtMoment = otMoment.clone().startOf("day");
                }
              }
            });
          }

          if (!hasOtDutiesData) {
            const rawCurrOT = Number(currDashItem?.earnedOTMin || 0);
            const rawPrevOT = Number(prevDashItem?.earnedOTMin || 0);
            if (rawCurrOT > 0 && rawCurrOT < 60) {
              currMonthOT = rawCurrOT;
            }
            if (rawPrevOT > 0 && rawPrevOT < 60) {
              prevMonthOT = rawPrevOT;
            }
          }

          const rawDashTotal = Number(currDashItem?.totalAvailableMin || 0);
          const rawDashEarned = Number(currDashItem?.earnedOTMin || 0);
          const basePermAllocated = Number(
            currDashItem?.defaultPermissionMin ||
            (rawDashTotal > rawDashEarned ? rawDashTotal - rawDashEarned : 0) ||
            ((permBalanceMinutes + permUsedMinutes > 0 && permBalanceMinutes + permUsedMinutes <= 90) ? (permBalanceMinutes + permUsedMinutes) : 60)
          );

          const prevBasePermAllocated = Number(prevDashItem?.defaultPermissionMin || basePermAllocated || 60);
          let usedFromPrevOT = 0;
          if (Array.isArray(prevPermListRes?.data)) {
            const prevPermRows = prevPermListRes.data;
            const prevAppliedMins = sumPermRows(prevPermRows);
            if (earliestPrevOtMoment) {
              const rowsAfterOt = prevPermRows.filter((row: any) => {
                const dStr = String(row?.lfrom || row?.LFrom || (Array.isArray(row) ? row[2] : "") || "").trim();
                if (!dStr) return false;
                const cleanD = dStr.includes("T") ? dStr.split("T")[0] : dStr.split(" ")[0];
                const m = moment(cleanD, ["YYYY-MM-DD", "DD-MM-YYYY", "MM/DD/YYYY", "YYYY/MM/DD"], false);
                return m.isValid() && m.isAfter(earliestPrevOtMoment, "day");
              });
              const minsAfterOt = sumPermRows(rowsAfterOt);
              const minsBeforeOrOnOt = Math.max(0, prevAppliedMins - minsAfterOt);
              const baseRemainingAfterOt = Math.max(0, prevBasePermAllocated - minsBeforeOrOnOt);
              usedFromPrevOT = Math.max(0, minsAfterOt - baseRemainingAfterOt);
            } else {
              usedFromPrevOT = Math.max(0, prevAppliedMins - prevBasePermAllocated);
            }
          } else {
            const fallbackPrevUsed = Number(prevDashItem?.usedMin || 0);
            usedFromPrevOT = Math.max(0, fallbackPrevUsed - prevBasePermAllocated);
          }
          const carryForwardOT = Math.max(0, prevMonthOT - usedFromPrevOT);

          const totalPermAllocated = basePermAllocated + currMonthOT + carryForwardOT;

          if (Array.isArray(permListRes?.data)) {
            // Count unique permission sessions for the month (excluding split secondary records)
            const count = permListRes.data.filter((row: any) => {
              const rem = String(row?.Remarks || (Array.isArray(row) ? (row[10] || row[9] || row[5]) : "") || "").toLowerCase();
              return !rem.includes("converted to lop");
            }).length;
            usedSessions = Math.max(usedSessions, count);

            // Sum permission minutes used for the month (excluding split secondary records converted to LOP)
            const minsUsed = sumPermRows(permListRes.data);

            permUsedMinutes = Math.min(totalPermAllocated, Math.max(permUsedMinutes, minsUsed));
            permBalanceMinutes = Math.max(0, totalPermAllocated - permUsedMinutes);
          } else {
            permUsedMinutes = Math.min(totalPermAllocated, permUsedMinutes);
            permBalanceMinutes = Math.max(0, totalPermAllocated - permUsedMinutes);
          }
        } catch (e) {
          const monthPerms = existingDates.filter((item: any) => {
            if (!item?.date || !item.date.startsWith(monthIso)) return false;
            const isPerm =
              String(item.leaveMode).toLowerCase() === "permission" ||
              String(item.lType).toLowerCase() === "permission" ||
              String(item.leaveCategory).toLowerCase() === "permission";
            const rem = String(item.remarks || "").toLowerCase();
            return isPerm && !rem.includes("converted to lop");
          }).length;
          usedSessions = Math.max(usedSessions, monthPerms);
        }
      }

      const displayedUsedSessions = maxSessions > 0 ? Math.min(usedSessions, maxSessions) : usedSessions;

      setBalance({
        used: finalCategory === "Permission" ? permUsedMinutes : (res.data?.used || 0),
        balance: finalCategory === "Permission" ? permBalanceMinutes : (res.data?.balance || 0),
        usedSessions: displayedUsedSessions,
        actualUsedSessions: usedSessions,
        maxSessions: maxSessions,
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

    const getDuplicateConflict = (fromDate: string | null, toDate: string | null): string | null => {
      if (!fromDate) return null;
      const start = moment(fromDate);
      const end = (!singleDateMode && toDate) ? moment(toDate) : start.clone();

      // ✅ Permissions are completely independent: allow multiple permissions on same day and allow permission alongside leaves
      if (requestType === "Permission") {
        return null;
      }

      // Check every date in the selected range (for Leaves only)
      const curr = start.clone();
      while (curr.isSameOrBefore(end, "day")) {
        const formattedDate = curr.format("YYYY-MM-DD");

        // Filter for existing LEAVE records only on that date (ignore permission records completely)
        const matchingLeaves = existingDates.filter((item: any) => {
          if (item.date !== formattedDate) return false;
          const isPerm =
            String(item.leaveMode).toLowerCase() === "permission" ||
            String(item.lType).toLowerCase() === "permission" ||
            String(item.leaveCategory).toLowerCase() === "permission";
          return !isPerm;
        });

        if (matchingLeaves.length > 0) {
          const isHalfDayRequest = leaveMode === "Forenoon" || leaveMode === "Afternoon";

          if (isHalfDayRequest) {
            // Block if the exact same half-day leave exists
            const sameHalfDay = matchingLeaves.find(
              (item: any) => item.leaveMode === leaveMode
            );
            if (sameHalfDay) {
              return `Same half-day leave already applied for ${curr.format("DD-MM-YYYY")}`;
            }

            // Block if a full-day leave already exists
            const fullDay = matchingLeaves.find(
              (item: any) =>
                item.leaveMode !== "Forenoon" &&
                item.leaveMode !== "Afternoon"
            );
            if (fullDay) {
              return `Full-day leave already exists for ${curr.format("DD-MM-YYYY")}`;
            }
          } else {
            // Full day leave request conflicts only with ANY existing leave on that date (NOT permissions)
            const existingLeave = matchingLeaves.find(
              (item: any) => item.leaveMode !== "Permission" && item.lType !== "Permission"
            );
            if (existingLeave) {
              return `Leave already applied for ${curr.format("DD-MM-YYYY")}`;
            }
          }
        }
        curr.add(1, "day");
      }

      return null;
    };

    const conflictMessage = getDuplicateConflict(startDate, endDate);
    if (conflictMessage) {
      return showToast(conflictMessage);
    }

    let finalCategory =
      requestType === "Permission"
        ? "Permission"
        : leaveMode === "Leave"
          ? leaveCategory
          : leaveMode;

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
      const maxSessions = Number(balance.maxSessions || 6);
      const usedSessions = Number(balance.actualUsedSessions ?? balance.usedSessions ?? 0);
      const isSessionExceeded = maxSessions > 0 && usedSessions >= maxSessions;

      if (isSessionExceeded) {
        setLopMessage("Session limit exceeded → Convert to LOP.");
        setConfirmLOP(true);
        return;
      }

      if (minutes > balance.balance) {
        const avail = Number(balance?.balance ?? 0);
        const excess = minutes - avail;
        setLopMessage(
          avail <= 0
            ? "Permission balance exhausted → Convert to LOP."
            : `You requested ${minutes} mins but only have ${avail} mins available. Remaining ${excess} min${excess === 1 ? "" : "s"} will be converted to LOP.`
        );
        setConfirmLOP(true);
        return;
      }
    }

    submitToServer(finalCategory);
  };


  const submitSplitLeave = async () => {
    if (loading) return;

    // 🔥 DEDICATED PERMISSION SUBMISSION
    if (requestType === "Permission") {
      const avail = Number(balance?.balance ?? 0);
      const maxSessions = Number(balance?.maxSessions || 6);
      const usedSessions = Number(balance?.actualUsedSessions ?? balance?.usedSessions ?? 0);
      const isSessionExceeded = maxSessions > 0 && usedSessions >= maxSessions;
      const requestedMinutes = parseFloat(permTime || "0");

      if (avail <= 0 || isSessionExceeded) {
        // Balance is 0 or sessions exhausted - submit directly as single LOP record without split text
        await submitToServer(
          "LOP",
          startDate || undefined,
          undefined,
          remarks,
          false,
          "Permission",
          undefined,
          permTime,
          inTime,
          false
        );
        return;
      }

      // If available balance covers all requested minutes, submit as single Permission request
      if (avail >= requestedMinutes) {
        await submitToServer("Permission");
        return;
      }

      const remainingLOP = requestedMinutes - avail;
      const availWord = avail === 1 ? "Min" : "Mins";
      const lopWord = remainingLOP === 1 ? "Min" : "Mins";

      setLoading(true);

      try {
        // 1. Available Permission portion (consumes available minutes and updates session count)
        await submitToServer(
          "Permission",
          startDate || undefined,
          undefined,
          remarks + ` (${avail} ${availWord} Permission)`,
          true,
          "Permission",
          undefined,
          String(avail),
          inTime,
          false
        );

        // 2. Excess portion converted to LOP (displays as LOP Permission card)
        await submitToServer(
          "LOP",
          startDate || undefined,
          undefined,
          remarks + ` (${remainingLOP} ${lopWord} Converted to LOP)`,
          false,
          "Permission",
          undefined,
          String(remainingLOP),
          inTime,
          false
        );
      } catch (error) {
        console.error("Split permission submission failed:", error);
      } finally {
        setLoading(false);
      }
      return;
    }

    // --- LEAVE SPLIT LOGIC ---
    const available = Number(balance?.balance ?? 0);
    const effEndDate = (!singleDateMode && endDate) ? endDate : startDate;
    if (!startDate || !effEndDate) return;

    let originalCategory = leaveMode === "Leave" ? leaveCategory : leaveMode;
    if (originalCategory === "Forenoon" || originalCategory === "Afternoon") {
      originalCategory = "Casual";
    }

    const requestedDays = moment(effEndDate).diff(moment(startDate), "days") + 1;

    if (available <= 0) {
      // Entire leave is LOP - submit as clean single record without split text
      await submitToServer(
        "LOP",
        startDate,
        effEndDate,
        remarks,
        false,
        leaveMode || "Leave",
        requestedDays
      );
      return;
    }

    // If available balance covers all requested days, submit as single request
    if (available >= requestedDays) {
      await submitToServer(originalCategory);
      return;
    }

    const remainingLOP = requestedDays - available;

    // Consolidate into EXACTLY 2 records:
    // 1. Available leave balance (Casual / Sick)
    // 2. Remaining LOP balance
    const firstPartStart = startDate;
    const firstPartEnd = moment(startDate)
      .add(Math.ceil(available) - 1, "days")
      .format("YYYY-MM-DD");

    const secondPartStart = moment(startDate)
      .add(Math.floor(available), "days")
      .format("YYYY-MM-DD");
    const secondPartEnd = effEndDate;

    const availWord = available === 1 ? "Day" : "Days";
    const lopWord = remainingLOP === 1 ? "Day" : "Days";

    setLoading(true);

    try {
      // 1. Available portion (Casual / Sick)
      await submitToServer(
        originalCategory,
        firstPartStart,
        firstPartEnd,
        remarks + ` (${available} ${availWord} ${originalCategory})`,
        true,
        available === 0.5 ? "Forenoon" : (leaveMode || "Leave"),
        available
      );

      // 2. LOP portion
      await submitToServer(
        "LOP",
        secondPartStart,
        secondPartEnd,
        remarks + ` (${remainingLOP} ${lopWord} Converted to LOP)`,
        false,
        remainingLOP === 0.5 ? "Afternoon" : (leaveMode || "Leave"),
        remainingLOP
      );
    } catch (error) {
      console.error("Split leave submission failed:", error);
    } finally {
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
    overrideDays?: number,
    overridePermTime?: string,
    overrideInTime?: string,
    forceLeaveEndpoint?: boolean
  ) => {
    if (loading && !overrideFrom && !overridePermTime) return;

    if (!overrideFrom && !overridePermTime) setLoading(true);

    const empCode = getUser()?.empCode;

    const isSingle =
      requestType === "Permission" ||
      singleDateMode ||
      overrideMode === "Forenoon" ||
      overrideMode === "Afternoon";

    const fromFormatted = fmtDMY(overrideFrom || startDate);
    const toFormatted = isSingle
      ? fromFormatted
      : fmtDMY(overrideTo || (overrideFrom || startDate));

    const finalPermTime =
      requestType === "Permission"
        ? (overridePermTime !== undefined ? overridePermTime : permTime)
        : "";

    const activeInTime = overrideInTime !== undefined ? overrideInTime : inTime;

    const payload = {
      _fromdate: fromFormatted,
      _todate: toFormatted,

      _remarks: overrideRemarks || remarks,
      _PermTime: finalPermTime,
      _InTime:
        requestType === "Permission"
          ? (activeInTime ? moment(activeInTime, "HH:mm").format("HH:mm") : null)
          : null,
      _requesttype: (requestType === "Permission" && forceLeaveEndpoint) ? "Leave" : requestType,
      _empcode: empCode,
      _leaveMode:
        requestType === "Permission"
          ? (overrideMode || "Permission")
          : overrideMode || leaveMode,

      _leaveCategory: category,
    };

    try {
      const saveUrl = (requestType === "Permission" && !forceLeaveEndpoint)
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

      if (!skipClear) {
        showToast("Submitted Successfully");
        const prevDate = startDate || undefined;
        clearForm();
        loadExistingLeaves();
        if (prevDate) checkBalance(prevDate);
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
      return res.data;
    }
    catch (err: any) {
      const errorMsg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Error submitting request";
      showToast(typeof errorMsg === "string" ? errorMsg : "Error submitting request");
      throw err;
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
    <div className="lf-v3-container">
      <div className="lf-v3-master-card">
        {/* ── HEADER ROW ── */}
        <div className="lf-v3-header-row">
          <div className="lf-v3-header-left">
            <div className="lf-v3-header-icon-chip">
              <IonIcon icon={requestType === "Permission" ? timeOutline : calendarOutline} />
            </div>
            <div>
              <h3 className="lf-v3-header-title">
                {requestType === "Permission" ? "Permission Request" : "Leave Application"}
              </h3>
              <p className="lf-v3-header-sub">
                {requestType === "Permission"
                  ? "Submit time permission for authority approval"
                  : "Apply for leaves with real-time balance tracking"}
              </p>
            </div>
          </div>
          <div className="lf-v3-header-pill">
            <IonIcon icon={sparklesOutline} />
            <span>{requestType} Mode</span>
          </div>
        </div>

        {/* ── FORM INPUTS GRID ── */}
        <div className={`lf-v3-grid ${requestType === "Leave" ? (singleDateMode ? "three-col" : "four-col") : "three-col"}`}>
          {requestType === "Leave" && (
            <>
              {/* Leave Type Select */}
              <div className="lf-v3-field">
                <label className="lf-v3-label">Leave Type</label>
                <div className="lf-v3-input-box">
                  <IonIcon icon={optionsOutline} className="lf-v3-input-icon" />
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
                    className="lf-v3-select"
                    placeholder="Select Type"
                  >
                    <IonSelectOption value="">Select Type</IonSelectOption>
                    <IonSelectOption value="Leave">Leave</IonSelectOption>
                    <IonSelectOption value="Forenoon">Forenoon</IonSelectOption>
                    <IonSelectOption value="Afternoon">Afternoon</IonSelectOption>
                    <IonSelectOption value="Maternity">Maternity</IonSelectOption>
                    <IonSelectOption value="Paternity">Paternity</IonSelectOption>
                  </IonSelect>
                </div>
              </div>

              {/* Category Select / Badge */}
              {leaveMode === "Leave" ? (
                <div className="lf-v3-field">
                  <label className="lf-v3-label">Category</label>
                  <div className="lf-v3-input-box">
                    <IonIcon icon={optionsOutline} className="lf-v3-input-icon" />
                    <IonSelect
                      placeholder="Select Category"
                      value={leaveCategory}
                      onIonChange={(e) => setLeaveCategory(e.detail.value)}
                      interface="popover"
                      className="lf-v3-select"
                    >
                      <IonSelectOption value="">Select Category</IonSelectOption>
                      <IonSelectOption value="Casual">Casual</IonSelectOption>
                      <IonSelectOption value="Sick">Sick</IonSelectOption>
                    </IonSelect>
                  </div>
                </div>
              ) : leaveMode ? (
                <div className="lf-v3-field">
                  <label className="lf-v3-label">Category</label>
                  <div className="lf-v3-input-box" style={{ background: '#f5f5f4', cursor: 'default' }}>
                    <IonIcon icon={sparklesOutline} className="lf-v3-input-icon" />
                    <span className="lf-v3-input-text">{leaveMode}</span>
                  </div>
                </div>
              ) : (
                <div className="lf-v3-field">
                  <label className="lf-v3-label">Category</label>
                  <div className="lf-v3-input-box" style={{ opacity: 0.6 }}>
                    <IonIcon icon={optionsOutline} className="lf-v3-input-icon" />
                    <span className="lf-v3-input-text placeholder">Select Type first</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Start Date / Date trigger */}
          <div className="lf-v3-field" onClick={() => setStartModal(true)}>
            <label className="lf-v3-label">
              {singleDateMode ? "Select Date" : "Start Date"}
            </label>
            <div className={`lf-v3-input-box ${startDate ? "active" : ""}`}>
              <IonIcon icon={calendarOutline} className="lf-v3-input-icon" />
              <span className={`lf-v3-input-text ${!startDate ? "placeholder" : ""}`}>
                {startDate ? fmtDMY(startDate) : "Select date"}
              </span>
            </div>
          </div>

          {/* End Date (if not single date mode & is Leave) */}
          {requestType === "Leave" && !singleDateMode && (
            <div className="lf-v3-field" onClick={() => setEndModal(true)}>
              <label className="lf-v3-label">End Date</label>
              <div className={`lf-v3-input-box ${endDate ? "active" : ""}`}>
                <IonIcon icon={calendarOutline} className="lf-v3-input-icon" />
                <span className={`lf-v3-input-text ${!endDate ? "placeholder" : ""}`}>
                  {endDate ? fmtDMY(endDate) : "Select date"}
                </span>
              </div>
            </div>
          )}

          {/* Permission InTime */}
          {requestType === "Permission" && (
            <div className="lf-v3-field">
              <label className="lf-v3-label">Time</label>
              <div className="lf-v3-input-box">
                <IonIcon icon={timeOutline} className="lf-v3-input-icon" />
                <input
                  type="time"
                  value={inTime}
                  onChange={(e) => setInTime(e.target.value)}
                  className="lf-v3-native-input"
                />
              </div>
            </div>
          )}

          {/* Permission Minutes */}
          {requestType === "Permission" && (
            <div className="lf-v3-field">
              <label className="lf-v3-label">Duration (Minutes)</label>
              <div className="lf-v3-input-box">
                <IonIcon icon={timeOutline} className="lf-v3-input-icon" />
                <input
                  type="number"
                  placeholder="e.g. 60"
                  value={permTime}
                  onChange={(e) => setPermTime(e.target.value)}
                  className="lf-v3-native-input"
                />
              </div>
            </div>
          )}

        </div>

        {/* ── HALF ROW FOR REMARKS AND BALANCE ── */}
        <div className="lf-v3-remarks-balance-row">
          {/* Remarks Field (Half width) */}
          <div className="lf-v3-field">
            <label className="lf-v3-label">Remarks / Purpose</label>
            <div className="lf-v3-input-box" style={{ flex: 1, minHeight: "72px", maxHeight: "none", alignItems: "flex-start", paddingTop: "10px" }}>
              <IonIcon icon={documentTextOutline} className="lf-v3-input-icon" style={{ marginTop: "2px" }} />
              <textarea
                placeholder="Enter details or purpose of request..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                className="lf-v3-textarea"
                style={{ height: "100%" }}
              />
            </div>
          </div>

          {/* HARMONIZED BALANCE BOX (Formatted like a form tab) */}
          <div className="lf-v3-field">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label className="lf-v3-label" style={{ marginBottom: 0 }}>Leave Balance</label>
              <span className="lf-v3-balance-badge" style={{ fontSize: '10px', padding: '2px 8px' }}>
                {requestType === "Permission" ? "Permission" : (leaveCategory || leaveMode || "Overview")}
              </span>
            </div>
            <div className="lf-v3-balance-box" style={{ margin: 0, flex: 1, padding: "10px 14px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              {balance && startDate ? (
                <>
                  <div className="lf-v3-metrics-row">
                    <div className="lf-v3-metric-item">
                      <span className="lf-v3-metric-label">Used</span>
                      <span className="lf-v3-metric-val used">
                        {balance.used}{requestType === "Permission" ? "m" : ""}
                      </span>
                    </div>
                    <div className="lf-v3-metric-item">
                      <span className="lf-v3-metric-label">Available</span>
                      <span className="lf-v3-metric-val available">
                        {balance.balance}{requestType === "Permission" ? "m" : ""}
                      </span>
                    </div>
                    {requestType === "Permission" && (
                      <div className="lf-v3-metric-item">
                        <span className="lf-v3-metric-label">Sessions</span>
                        <span
                          className="lf-v3-metric-val sessions"
                          style={
                            Number(balance.usedSessions) >= Number(balance.maxSessions) && Number(balance.maxSessions) > 0
                              ? { color: "#dc2626", fontWeight: 800 }
                              : undefined
                          }
                        >
                          {balance.usedSessions}/{balance.maxSessions}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="lf-v3-progress-track">
                    <div
                      className="lf-v3-progress-fill"
                      style={{
                        width: `${Math.min(
                          100,
                          (Number(balance.balance || 0) /
                            (Number(balance.balance || 0) + Number(balance.used || 1))) *
                          100
                        )}%`
                      }}
                    />
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
                  <span style={{ fontSize: '12px', color: 'var(--ion-color-primary, #1e293b)', fontWeight: 600 }}>
                    {startDate ? "Check real-time balance for selected category" : "Select date to view balance details"}
                  </span>
                  <button type="button" className="lf-v3-fetch-balance-btn" onClick={() => checkBalance()}>
                    <IonIcon icon={informationCircleOutline} />
                    <span>Fetch Balance</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── INTEGRATED BOTTOM SECTION (ACTION) ── */}
        <div className="lf-v3-bottom-section">
          {/* ACTION PANEL */}
          <div className="lf-v3-action-panel">
            <button
              className="lf-v3-submit-btn"
              onClick={onSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="lf-v3-btn-spinner" />
                  <span style={{ fontWeight: 'bold' }}>Submitting Request...</span>
                </>
              ) : (
                <>
                  <span style={{ color: '#ffffff', fontWeight: 'bold' }}>Submit Request</span>
                  <IonIcon icon={arrowForwardOutline} style={{ color: '#ffffff' }} />
                </>
              )}
            </button>
            <div className="lf-v3-info-note">
            </div>
          </div>
        </div>
      </div>

      {/* ── START DATE MODAL ── */}
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
          max={
            (leaveMode === "Leave" && leaveCategory === "Casual") || leaveMode === "Forenoon" || leaveMode === "Afternoon"
              ? moment().add(1, "month").endOf("month").format("YYYY-MM-DD")
              : `${new Date().getFullYear() + 1}-12-31`
          }
          isDateEnabled={(dateString) => {
            const date = dateString.split("T")[0];
            const today = new Date().toISOString().split("T")[0];
            if (unlockRange.approved && date === unlockRange.fromDate) return true;
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

      {/* ── END DATE MODAL ── */}
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
                : ((leaveMode === "Leave" && leaveCategory === "Casual") || leaveMode === "Forenoon" || leaveMode === "Afternoon")
                  ? moment().add(1, "month").endOf("month").format("YYYY-MM-DD")
                  : `${new Date().getFullYear() + 1}-12-31`
            }
            isDateEnabled={(dateString) => {
              const date = dateString.split("T")[0];
              const today = new Date().toISOString().split("T")[0];
              if (startDate === unlockRange.fromDate) {
                return date >= unlockRange.fromDate && date <= unlockRange.toDate;
              }
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

      {/* ── LOP CONFIRMATION MODAL ── */}
      <IonModal
        isOpen={confirmLOP}
        onDidDismiss={() => setConfirmLOP(false)}
        style={{
          '--border-radius': '24px',
          '--height': 'auto',
          '--width': '90%',
          '--max-width': '420px'
        }}
      >
        <div className="lf-v2-lop-dialog">
          <div className="lf-v2-lop-icon-wrap">
            <IonIcon icon={alertCircleOutline} />
          </div>

          <h3 className="lf-v2-lop-title">Confirmation</h3>

          <p className="lf-v2-lop-msg">{lopMessage}</p>

          <div className="lf-v2-lop-actions">
            <button
              className="lf-v2-lop-btn-confirm"
              onClick={() => {
                setConfirmLOP(false);
                submitSplitLeave();
              }}
            >
              YES CONTINUE (LOP)
            </button>

            <button
              className="lf-v2-lop-btn-cancel"
              onClick={() => {
                setConfirmLOP(false);
                clearForm();
              }}
            >
              CANCEL
            </button>
          </div>
        </div>
      </IonModal>

      {/* ── TOAST NOTIFICATION ── */}
      <IonToast
        isOpen={toastOpen}
        message={toastMsg}
        duration={2000}
        onDidDismiss={() => setToastOpen(false)}
      />

      {/* ── LOADING OVERLAY ── */}
      {loading && (
        <div className="lf-v2-loader-overlay">
          <div className="lf-v2-loader-box">
            <div className="lf-v2-loader-spinner" />
            <div className="lf-v2-loader-text">Submitting Request...</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveForm;



