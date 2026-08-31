import React, { useEffect, useState } from "react";
import axios from "axios";
import moment from "moment";
import { useHistory } from "react-router-dom";
import DaTaSettlementModal from "../DaTaSettlementModal";
import { API_BASE } from "../../config";
import "./RequestList.css";
import { speedometerOutline } from "ionicons/icons";

import {
  IonIcon,
  IonSelect,
  IonSelectOption,
  useIonAlert,
} from "@ionic/react";

import {
  personOutline,
  calendarOutline,
  layersOutline,
  searchOutline,
  closeCircle,
  checkmarkCircle,
  timeOutline,
  pricetagOutline,
  cashOutline,
  locationOutline,
  documentTextOutline,
  alertCircleOutline,
  busOutline,
  hardwareChipOutline
} from "ionicons/icons";

import { createPortal } from "react-dom";
import { useRef } from "react";

/* ================= TYPES ================= */
interface Props {
  type: string;
  view: string;
  status: string;
}

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



const getAuthHeaders = () => {
  const token = localStorage.getItem("token")?.replace(/"/g, "");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// 🔥 SAFE FIX (NO OBJECT CRASH EVER)
const safeText = (val: any) => {
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && Object.keys(val).length === 0) return "";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
};

// Workreport/load_duties_full and load_my_duties serialize these fields
// with inconsistent casing (ASP.NET Core's default camelCase policy only
// lowercases the FIRST letter, so "CurrentRA" becomes "currentRA" but
// "RA1_Status" can come through as "rA1_Status" depending on the endpoint) -
// check every casing variant we've seen rather than trusting one.
const pick = (d: any, ...keys: string[]) => {
  for (const k of keys) {
    if (d[k] !== undefined && d[k] !== null && d[k] !== "") {
      if (typeof d[k] === 'object' && Object.keys(d[k]).length === 0) continue;
      return d[k];
    }
  }
  return undefined;
};

// The duty's own team roster ("1501-PAMARTHI SIVA PRASAD,1509-...") into
// [{code, name}] pairs - same parsing convention OnDuties.tsx's
// formatEmployeeNames uses - so a visit's Emp_Codes can be resolved to
// readable names without a second API round trip.
const parseEmpNames = (value: any) => {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((x) => {
      const parts = x.split("-");
      if (parts.length >= 2) {
        return { code: parts[0]?.trim(), name: parts.slice(1).join("-").trim() };
      }
      return { code: "", name: x.trim() };
    })
    .filter((x) => x.name);
};

// Visit slip / reading photos come back from the API as a bare relative path (e.g.
// "/Uploads/Visits/xyz.jpg"), same as every other uploaded-image field in
// this app. Resolve it against the API's origin (not API_BASE itself, which
// already ends in "/api") so it opens as a real image URL in a new tab.
const getUploadedImageUrl = (path: any) => {
  if (!path || typeof path !== "string") return "";
  const p = path.trim();
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  const base = API_BASE.replace(/\/api\/?$/i, "").replace(/\/$/, "");
  return `${base}${p.startsWith("/") ? p : `/${p}`}`;
};

// Reading photos and the client visit slip are the images crew use to mark
// start-camp / end-camp for day trips, so showing WHEN each was actually
// uploaded (not just that it exists) matters. These come back as plain
// datetime strings/Date-ish values from the API - format defensively so a
// null/invalid value just renders nothing instead of "Invalid date".
const formatUploadedOn = (value: any) => {
  if (!value) return "";
  const m = moment(value);
  return m.isValid() ? m.format("DD-MM-YYYY hh:mm A") : "";
};


// The overall verdict worked out from the approval chain, for a record that
// carries no usable status of its own. tbl_On_Duties keeps TWO status columns
// and only one of them is ever written, so the one the API reads can come back
// empty on a duty that has actually cleared every level - and calling that
// "Pending" puts the waiting-on-someone badge on a finished request. People
// then go chasing approvals that already happened.
//
// Slots named "" or "-" are not real approvers and are not waited on. Returns
// "" for a chain still genuinely in progress, so the caller's "Pending"
// default still wins - this only ever speaks when the answer is unambiguous.
const statusFromChain = (x: any): string => {
  const norm = (s: any) => String(s ?? "").trim().toLowerCase();
  const slots = [
    { ra: pick(x, "rA1", "ra1", "RA1"), st: pick(x, "rA1_Status", "ra1_Status", "RA1_Status", "ra1Status", "rA1Status") },
    { ra: pick(x, "rA2", "ra2", "RA2"), st: pick(x, "rA2_Status", "ra2_Status", "RA2_Status", "ra2Status", "rA2Status") },
    { ra: pick(x, "rA3", "ra3", "RA3"), st: pick(x, "rA3_Status", "ra3_Status", "RA3_Status", "ra3Status", "rA3Status") },
    { ra: pick(x, "rA4", "ra4", "RA4"), st: pick(x, "rA4_Status", "ra4_Status", "RA4_Status", "ra4Status", "rA4Status") },
  ].filter((s) => {
    const v = String(s.ra ?? "").trim();
    return v !== "" && v !== "-";
  });
  if (slots.length === 0) return "";
  if (slots.some((s) => norm(s.st) === "rejected")) return "Rejected";
  if (slots.every((s) => norm(s.st) === "approved")) return "Approved";
  return "";
};


// The AttDays_at_Branch column stores day-of-month numbers only ("02,05,06");
// the month is pinned by the duty's own date range. Pairing them back up here
// means a bare "03" on a duty that crosses a month boundary can still name its
// month in the tooltip. A stored day outside the range still renders, showing
// the number on its own - dropping it would look like it was never marked.
const attDayPills = (item: any): { day: string; full: string }[] => {
  const wanted = String(item?.AttDays ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (wanted.length === 0) return [];

  const from = moment(item.DateFrom);
  const to = item.DateTo ? moment(item.DateTo) : from.clone();
  if (!from.isValid() || !to.isValid() || to.isBefore(from, "day")) {
    return wanted.map((x) => ({ day: x, full: x }));
  }

  const byDay: Record<string, string> = {};
  // The 62 is only so a corrupt range cannot spin here; the picker caps a
  // duty at 15 days.
  let guard = 0;
  for (
    const d = from.clone().startOf("day");
    !d.isAfter(to, "day") && guard < 62;
    d.add(1, "day")
  ) {
    guard++;
    const k = d.format("DD");
    if (!(k in byDay)) byDay[k] = d.format("DD MMM YYYY");
  }

  return wanted.map((x) => ({ day: x, full: byDay[x] || x }));
};

const generateMonthList = () => {
  const months: string[] = [];
  const current = moment().add(1, "month");

  for (let y = current.year(); y >= 2024; y--) {
    const endMonth = y === current.year() ? current.month() : 11;
    for (let m = endMonth; m >= 0; m--) {
      months.push(moment().year(y).month(m).format("MMM-YYYY"));
    }
  }
  return months;
};



const getRejectionInfo = (item: any) => {
  if (!item?.L_status) return null;

  const status = String(item.L_status);

  if (status.toLowerCase().includes("rejected")) {
    // 🔥 SHOW EXACT BACKEND MESSAGE
    return status;
  }

  return null;
};
const RequestList: React.FC<Props> = ({ type, view, status }) => {
  const history = useHistory();
  // Which duty (if any) the "DA / TA" popup is open for. Set instead of
  // history.push("/datasettlement?duty=...") so the settlement numbers
  // show in a popup over whatever list the user was already looking at,
  // rather than navigating them away to a separate page.
  const [dataDutyId, setDataDutyId] = useState<string | number | null>(null);
  // Whether the currently-open DA/TA popup should show every camp
  // member (an RA on that duty) or just the viewer's own row (a plain
  // team member) - set alongside dataDutyId at whichever link opened it.
  const [dataCanViewAll, setDataCanViewAll] = useState<boolean>(false);
  const [presentAlert] = useIonAlert();
  const [amountMap, setAmountMap] = useState<{ [key: string]: string }>({});
  const [commentMap, setCommentMap] = useState<{ [key: string]: string }>({});
  const handleAmountChange = (id: string, value: string) => {
    setAmountMap((prev) => ({ ...prev, [id]: value }));
  };

  const handleCommentChange = (id: string, value: string) => {
    setCommentMap((prev) => ({ ...prev, [id]: value }));
  };
  const baseUrl = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;

  const [data, setData] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [months] = useState(generateMonthList());
  const [selectedMonth, setSelectedMonth] = useState(
    moment().format("MMM-YYYY")
  );
  const [tripDaysByDuty, setTripDaysByDuty] = useState<{ [key: number]: any[] }>({});
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedDuty, setSelectedDuty] = useState<any>(null);
  // Which day-cards are expanded in the "On Duty Details" popup. A duty that
  // runs several days (and each day several visits) makes for a very long
  // scroll, so only the first day opens by default and the rest start
  // collapsed - reset to that every time a fresh duty is opened below.
  const [expandedTripDays, setExpandedTripDays] = useState<Set<number>>(new Set([0]));
  const toggleTripDay = (index: number) => {
    setExpandedTripDays((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [selectedEmpCode, setSelectedEmpCode] = useState<string>("0");

  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const triggerRef = useRef<HTMLDivElement>(null);

  // Remembers on-screen card order across reloads so that approving/rejecting
  // one item doesn't reshuffle the whole list - the backend can return a
  // different order on refetch (e.g. sorted by status/updated time), which
  // otherwise made the just-actioned card jump to the first slot.
  const prevOrderRef = useRef<string[]>([]);

  const [dropdownPos, setDropdownPos] = useState({
    top: 0,
    left: 0,
    width: 0
  });

  const [editOtModal, setEditOtModal] = useState(false);

  const [editOT, setEditOT] = useState<any>({
    lid: "",
    empcode: "",
    date: "",
    client: "",
    fromtime: "",
    totime: "",
    description: "",
    minDiff: 0,
    finMinDiff: 0,
  });
  const [permissionModal, setPermissionModal] = useState(false);

  const [permissionData, setPermissionData] = useState<any[]>([]);
  const [equipmentCodeMap, setEquipmentCodeMap] = useState<{ [key: string]: string }>({});
  // tracks per-item onduty action: 'approved' | 'rejected' | undefined
  const [ondutyActionMap, setOndutyActionMap] = useState<Record<string, 'approved' | 'rejected'>>({});

  const normalize = (x: any, fallbackMgr: string = "") => {
    if (!x) return null;

    // ✅ ONDUTY
    if (type === "onduty") {
      return {
        id: x.id,
        lid: x.id,

        empNames: safeText(
          x.empNames ||   // ✅ FIX
          x.EmpNames ||
          x.empnames ||
          x.Empname ||
          x.empname
        ),

        empcode: safeText(x.empcode),

        College: x.college,
        Description: x.description,
        Mode_of_Trans: x.mode || x.mode_of_Trans,
        Vehicle_No: x.vehicle_No,
        Location: x.location,

        // The three branch-visit columns, served alongside the duty by
        // load_my_duties / load_duties_full. Same defensive casing lookup as
        // the RA fields below.
        OnDutyType: pick(x, "onDutyType", "OnDutyType", "ondutyType"),
        Branch: pick(x, "branch", "Branch"),
        AttDays: pick(x, "attDays", "AttDays", "attDays_at_Branch"),
        TripType: pick(x, "tripType", "TripType"),
        BranchChangeType: pick(x, "branchChangeType", "BranchChangeType"),

        // Who filed the request, which is not always one of the people on
        // it: a manager can put a team on duty without going himself. Kept
        // apart from empcode above, which the employee filter reads -
        // repurposing that would quietly change which cards the filter
        // matches, for a display change that has nothing to do with it.
        AppliedBy: pick(x, "empCode", "EmpCode", "appliedBy", "AppliedBy"),

        DateFrom: x.dateFrom,
        DateTo: x.dateTo,
        StartTime: pick(x, "startTime", "StartTime"),
        EndTime: pick(x, "endTime", "EndTime"),

        // load_duties_full/load_my_duties often leave Status blank while a
        // request is still pending (it only gets set once a decision is made)
        // - default it to "Pending" like the Duty Manager page does, otherwise
        // the Pending filter tab's substring check finds nothing and the card
        // silently disappears from that tab.
        // The chain is asked FIRST. What this endpoint calls "status" is not
        // the stored verdict - it is a progress sentence built from CurrentRA
        // ("Pending at In-Charge F&A"), and it keeps saying that after the
        // approvals have finished because CurrentLevel is never advanced past
        // the final approver. Being truthy, it used to win, and a completed
        // request sat in the Pending tab indefinitely.
        //
        // statusFromChain answers only when every real slot agrees, so a
        // genuinely mid-flight request still falls through to the server's
        // sentence, which is the case where that sentence is worth reading.
        L_status: statusFromChain(x) || safeText(x.status) || "Pending",

        CurrentLevel: pick(x, "currentLevel", "CurrentLevel"),
        MaxLevel: pick(x, "maxLevel", "MaxLevel"),
        CurrentRA: pick(x, "currentRA", "CurrentRA", "currentRa"),

        RA1: pick(x, "rA1", "ra1", "RA1"),
        RA2: pick(x, "rA2", "ra2", "RA2"),
        RA3: pick(x, "rA3", "ra3", "RA3"),
        RA4: pick(x, "rA4", "ra4", "RA4"),

        RA1_Status: pick(x, "rA1_Status", "ra1_Status", "RA1_Status", "ra1Status", "rA1Status"),
        RA2_Status: pick(x, "rA2_Status", "ra2_Status", "RA2_Status", "ra2Status", "rA2Status"),
        RA3_Status: pick(x, "rA3_Status", "ra3_Status", "RA3_Status", "ra3Status", "rA3Status"),
        RA4_Status: pick(x, "rA4_Status", "ra4_Status", "RA4_Status", "ra4Status", "rA4Status"),

        dayTrips: x.dayTrips || [],
      };
    }

    // ✅ OVERTIME
    if (type === "overtime") {
      return {

        lid: x[0],
        empcode: x[1],
        Empname: x[2],
        lfrom: x[3],
        College: x[4],
        Fromtime: x[5],
        Totime: x[6],
        Remarks: x[7],
        MinDiff: x[8],

        CurrentLevel: x[11],
        MaxLevel: x[12],
        CurrentRA: x[13],

        RA1: x[15],
        RA2: x[16],
        RA3: x[17],
        RA4: x[18],

        RA1_Status: x[19],
        RA2_Status: x[20],
        RA3_Status: x[21],
        RA4_Status: x[22],
        L_status: x[23] || "Pending",
      };
    }

    // ✅ EQUIPMENT
    if (type === "equipment") {
      return {
        lid: x.id || x.Id,
        empcode: x.empcode || x.EmpCode,
        Empname: safeText(x.Empname),
        Remarks: safeText(x.Remarks),
        Priority: x.Priority,
        FilePath: x.FilePath,
        Amount: x.Amount,
        lfrom: x.lfrom || x.AppliedOn,
        L_status: safeText(x.L_status || x.Status),
        RA1_Status: x.RA1_Status,
        RA2_Status: x.RA2_Status,
        RA3_Status: x.RA3_Status,
        RA4_Status: x.RA4_Status,
        RA1: x.RA1,
        RA2: x.RA2,
        RA3: x.RA3,
        RA4: x.RA4,
        RA1_Comment: x.RA1_Comment,
        RA2_Comment: x.RA2_Comment,
        RA3_Comment: x.RA3_Comment,
        RA4_Comment: x.RA4_Comment,
        CurrentLevel: x.CurrentLevel,
        CurrentRA: x.CurrentRA,
        ECode: x.ECode,
        AssignStatus: x.AssignStatus,
        ReceiveStatus: x.ReceiveStatus,
        AssignedBy: x.AssignedBy,
        AssignedOn: x.AssignedOn,
        ReceivedBy: x.ReceivedBy,
        ReceivedOn: x.ReceivedOn,
        RequestType: x.RequestType,
      };
    }

    // ✅ LEAVE / PERMISSION
    let itemObj = x;
    if (Array.isArray(x)) {
      if (x.length === 30) {
        itemObj = {
          lid: x[0],
          empcode: x[1],
          lfrom: x[2],
          lto: x[3],
          AppliedOn: x[4],
          ptime: x[5],
          ltype: x[6],
          L_status: x[7],
          Days: x[8],
          Remarks: x[9],
          Leavemode: x[10],
          LeaveCategory: x[11],
          Empname: x[12],
          RA1: x[13],
          RA2: x[14],
          RA3: x[15],
          RA4: x[16],
          RA1_Status: x[17],
          RA2_Status: x[18],
          RA3_Status: x[19],
          RA4_Status: x[20],
          CurrentLevel: x[21],
          MaxLevel: x[22],
          CurrentRA: x[23],
          Slip: x[24],
          InTime: x[25],
          RA1Name: x[26],
          RA2Name: x[27],
          RA3Name: x[28],
          RA4Name: x[29],
        };
      } else if (x.length === 32) {
        itemObj = {
          lid: x[0],
          empcode: x[1],
          lfrom: x[2],
          lto: x[3],
          AppliedOn: x[4],
          ptime: x[5],
          ltype: x[6],
          L_status: x[7],
          Days: x[8],
          Remarks: x[9],
          P_Out: x[10],
          P_In: x[11],
          Empname: x[12],
          RA1: x[13],
          RA2: x[14],
          RA3: x[15],
          RA4: x[16],
          RA1_Status: x[17],
          RA2_Status: x[18],
          RA3_Status: x[19],
          RA4_Status: x[20],
          CurrentLevel: x[21],
          MaxLevel: x[22],
          CurrentRA: x[23],
          Leavemode: x[24],
          LeaveCategory: x[25],
          Slip: x[26],
          InTime: x[27],
          RA1Name: x[28],
          RA2Name: x[29],
          RA3Name: x[30],
          RA4Name: x[31],
        };
      } else {
        itemObj = {
          lid: x[0],
          empcode: x[1],
          lfrom: x[2],
          lto: x[3],
          AppliedOn: x[4],
          ptime: x[5],
          ltype: x[6],
          L_status: x[7],
          Days: x[8],
          Remarks: x[9],
          Leavemode: x[10],
          LeaveCategory: x[11],
          Empname: x[12] || x[10],
          RA1: x[13] || x[11],
          RA2: x[14] || x[12],
          RA3: x[15] || x[13],
          RA4: x[16] || x[14],
          RA1_Status: x[17] || x[15],
          RA2_Status: x[18] || x[16],
          RA3_Status: x[19] || x[17],
          RA4_Status: x[20] || x[18],
          CurrentLevel: x[21],
          MaxLevel: x[22],
          CurrentRA: x[23],
        };
      }
    }

    let deducedRA = pick(itemObj, "CurrentRA", "currentRA", "currentRa");
    let deducedStatus = safeText(pick(itemObj, "L_status", "Status", "l_status", "status"));

    if (!deducedRA && deducedStatus.toLowerCase().includes("pending")) {
      const r1 = pick(itemObj, "RA1", "rA1", "ra1");
      const r2 = pick(itemObj, "RA2", "rA2", "ra2");
      const r3 = pick(itemObj, "RA3", "rA3", "ra3");
      const r4 = pick(itemObj, "RA4", "rA4", "ra4");
      const rs1 = safeText(pick(itemObj, "RA1_Status", "ra1_Status", "rA1_Status", "ra1Status", "rA1Status"));
      const rs2 = safeText(pick(itemObj, "RA2_Status", "ra2_Status", "rA2_Status", "ra2Status", "rA2Status"));
      const rs3 = safeText(pick(itemObj, "RA3_Status", "ra3_Status", "rA3_Status", "ra3Status", "rA3Status"));

      const isP = (s: string) => !s || (!s.toLowerCase().includes("accepted") && !s.toLowerCase().includes("approved") && !s.toLowerCase().includes("rejected"));

      if (r1 && isP(rs1)) deducedRA = r1;
      else if (r2 && isP(rs2)) deducedRA = r2;
      else if (r3 && isP(rs3)) deducedRA = r3;
      else if (r4) deducedRA = r4;

      if (!deducedRA) {
        if (view !== "my") {
          deducedRA = getUser()?.designation || "";
        } else {
          deducedRA = fallbackMgr;
        }
      }
    }

    if (deducedRA && deducedStatus.toLowerCase().includes("pending")) {
      const trimmed = deducedStatus.trim().toLowerCase();
      if (trimmed === "pending" || trimmed === "pending at") {
        deducedStatus = "Pending at " + deducedRA;
      }
    } else if (!deducedRA && deducedStatus.toLowerCase().includes("pending")) {
      if (deducedStatus.trim().toLowerCase() === "pending at") {
        deducedStatus = "Pending";
      }
    }

    return {
      lid: pick(itemObj, "lid", "Id", "id"),
      empcode: pick(itemObj, "empcode", "EmpCode", "empCode"),
      Empname: safeText(pick(itemObj, "Empname", "empname", "EmpCode", "empName", "empCode")),
      InTime: safeText(pick(itemObj, "InTime", "inTime")),

      // ✅ EQUIPMENT FIX
      Remarks: safeText(pick(itemObj, "Remarks", "Purpose", "remarks", "purpose")),
      Priority: pick(itemObj, "Priority", "priority"),
      FilePath: pick(itemObj, "FilePath", "filePath"),
      Amount: pick(itemObj, "Amount", "amount"),

      // ✅ DATE
      lfrom: safeText(pick(itemObj, "lfrom", "lFrom", "LFrom")),
      ltype: safeText(pick(itemObj, "ltype", "LType", "lType")),
      lto: safeText(pick(itemObj, "lto", "lTo", "LTo")),
      AppliedOn: safeText(pick(itemObj, "AppliedOn", "appliedOn")),
      // ✅ STATUS FIX
      L_status: deducedStatus,
      LeaveCategory: safeText(pick(itemObj, "LeaveCategory", "leaveCategory")),
      Leavemode: safeText(pick(itemObj, "Leavemode", "leavemode", "LeaveMode", "leaveMode")),
      ptime: safeText(pick(itemObj, "ptime", "pTime")),
      // ✅ APPROVAL
      RA1_Status: pick(itemObj, "RA1_Status", "ra1_Status", "rA1_Status", "ra1Status", "rA1Status"),
      RA2_Status: pick(itemObj, "RA2_Status", "ra2_Status", "rA2_Status", "ra2Status", "rA2Status"),
      RA3_Status: pick(itemObj, "RA3_Status", "ra3_Status", "rA3_Status", "ra3Status", "rA3Status"),
      RA4_Status: pick(itemObj, "RA4_Status", "ra4_Status", "rA4_Status", "ra4Status", "rA4Status"),

      CurrentLevel: pick(itemObj, "CurrentLevel", "currentLevel"),
      MaxLevel: pick(itemObj, "MaxLevel", "maxLevel"),
      CurrentRA: deducedRA,

      Slip: pick(itemObj, "Slip", "slip"),

      RA1: pick(itemObj, "RA1", "rA1", "ra1"),
      RA2: pick(itemObj, "RA2", "rA2", "ra2"),
      RA3: pick(itemObj, "RA3", "rA3", "ra3"),
      RA4: pick(itemObj, "RA4", "rA4", "ra4"),

      RA1_Comment: pick(itemObj, "RA1_Comment", "ra1_Comment", "rA1_Comment", "ra1Comment", "rA1Comment"),
      RA2_Comment: pick(itemObj, "RA2_Comment", "ra2_Comment", "rA2_Comment", "ra2Comment", "rA2Comment"),
      RA3_Comment: pick(itemObj, "RA3_Comment", "ra3_Comment", "rA3_Comment", "ra3Comment", "rA3Comment"),
      RA4_Comment: pick(itemObj, "RA4_Comment", "ra4_Comment", "rA4_Comment", "ra4Comment", "rA4Comment"),
    };
  };

  useEffect(() => {
    loadData();
  }, [type, view, selectedMonth]);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    const refreshList = () => {
      loadData();
    };

    window.addEventListener(
      "leaveRequestAdded",
      refreshList
    );

    return () => {
      window.removeEventListener(
        "leaveRequestAdded",
        refreshList
      );
    };
  }, []);

  useEffect(() => {
    if (isSearchModalOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();

      setDropdownPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [isSearchModalOpen]);

  const formatEmployeeNames = (value: any) => {
    if (!value) return [];

    const str = String(value);

    return str
      .split(",")
      .map((x) => {
        const parts = x.split("-");

        if (parts.length >= 2) {
          const empCode = parts[0]?.trim();

          const empNames = parts
            .slice(1)
            .join("-")
            .trim();

          return {
            code: empCode,
            // Upper case throughout, so a name entered as "y r m raju" and one
            // entered as "SATTIBABU" look like entries in the same list rather
            // than like two different systems talking.
            name: empNames.toUpperCase(),
          };
        }

        return {
          code: "",
          name: x.trim().toUpperCase(),
        };
      })
      .filter((x) => x.name);
  };

  // The applicant arrives as a bare code, because that is all the duty row
  // stores. The employee list loaded for the filter is the only place here
  // a code can be turned into a name, and it does not always hold the
  // person, so the code stands in when the lookup misses - a number is a
  // poor answer to "who arranged this", but it is still an answer.
  const nameForCode = (code: any) => {
    const c = String(code ?? "").trim();
    if (!c) return "";
    const who = employees.find((e: any) => String(e?.id ?? "").trim() === c);
    const raw = String(who?.name ?? "").trim();
    if (!raw) return c;
    // The list stores the code glued onto the front of the name -
    // "1501-PAMARTHI SIVA PRASAD" - so printing it raw shows the code twice,
    // once inside the name and once in the brackets this chip adds. Only a
    // leading run of digits and a dash is stripped; a hyphenated surname
    // keeps its own.
    const name = raw.replace(/^\s*\d+\s*-\s*/, "").trim();
    if (!name) return c;
    // Cased the same way the employee chips beside it are cased, so the two
    // do not read as having come from different systems.
    return name.toUpperCase() + " (" + c + ")";
  };

  // Two questions, one row of chips: who is out, and who said so. When the
  // person who filed the request is also on it - the ordinary case, someone
  // booking their own duty - their chip is tinted rather than captioned,
  // since a label reading "applicant" beside a lone name says nothing. When
  // they are not on it, nothing else on the card would reveal who arranged
  // it, so it gets a chip of its own.
  const dutyPeople = (item: any) => {
    const chips = formatEmployeeNames(item?.empNames);
    // Compared on the code alone. The two sources spell names differently
    // often enough - casing, initials, spacing - that matching on the name
    // would quietly fail on exactly the rows it matters for.
    const applicant = String(item?.AppliedBy ?? "").trim();
    const onIt =
      !!applicant &&
      chips.some((c: any) => String(c.code ?? "").trim() === applicant);
    return { chips, applicant, assignedBy: applicant && !onIt ? applicant : "" };
  };

  // Same chip, two very different surrounding layouts, so it lives here
  // rather than being written out twice and drifting apart later.
  const assignedByChip = (code: string) => (
    <div
      title="Applied for this request on their behalf"
      style={{
        background: "#fff7ed",
        color: "#9a3412",
        border: "1px dashed #fdba74",
        padding: "6px 10px",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: 600,
      }}
    >
      <span style={{ opacity: 0.75, fontWeight: 500 }}>Applied by </span>
      {nameForCode(code)}
    </div>
  );

  const loadEmployees = async () => {
    try {
      const res = await axios.get(
        `${baseUrl}Employee/Load_Employees?SearchEmp=`,
        {
          headers: getAuthHeaders(),
        }
      );

      const mapped = (res.data || []).map((emp: any[]) => ({
        id: emp[0]?.toString(),
        name: emp[1],
      }));

      setEmployees([
        { id: "0", name: "All Employees" },
        ...mapped,
      ]);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!search) {
      setFiltered(data);
      return;
    }

    const s = search.toLowerCase();

    setFiltered(
      data.filter(
        (x) =>
          safeText(x?.Empname).toLowerCase().includes(s) ||
          safeText(x?.empcode).toLowerCase().includes(s)
      )
    );
  }, [search, data]);




  // `silent` skips the loading placeholder so a background refresh (e.g.
  // right after approving/rejecting a card) doesn't unmount the whole card
  // list - that swap-to-"Loading..."-and-back is what made the page jump to
  // the top card, since the list collapses to a single line and the browser
  // doesn't restore the old scroll position once it re-expands.
  const loadData = async (silent: boolean = false) => {
    const empCode = getUser()?.empCode;

    let fbManager = "";
    if (view === "my" && empCode) {
      try {
        const baseUrl = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
        const res = await axios.get(`${baseUrl}/Employee/Get_Employee?_Ecode=${empCode}`, {
          headers: getAuthHeaders()
        });
        
        let data = res.data;
        if (typeof data === "string") {
          try { data = JSON.parse(data); } catch(e) {}
        }
        
        const row = Array.isArray(data) ? data[0] : (data?.data ? data.data[0] : data);
        if (row) {
          fbManager = row[15] || row._RequestTo || row.RequestTo || row.requestTo || row.RA1 || "Business Manager";
        } else {
          fbManager = "Business Manager";
        }
      } catch (e) {
        console.error("Failed to fetch fallback manager", e);
        fbManager = "Business Manager";
      }
    }

    const normalizedType = (type || "").toLowerCase().trim();

    let leaveType = "";

    if (normalizedType === "permission") {
      leaveType = "Permission";
    }
    else if (
      normalizedType === "leave" ||
      normalizedType === "half day" ||
      normalizedType === "halfday"
    ) {
      leaveType = ""; // 👈 IMPORTANT: do NOT filter Half Day here
    }

    if (!silent) setLoading(true);



    try {
      let url = "";

      if (type === "onduty") {
        url =
          view === "my"
            ? `${baseUrl}OnDuty/load_my_duties?empCode=${empCode}`
            : `${baseUrl}OnDuty/load_duties_full?empCode=${empCode}`;
      } else if (type === "overtime") {
        url =
          view === "my"
            ? `${baseUrl}OverTime/load_overtime_duties?EmpCode=${empCode}`
            : `${baseUrl}OverTime/load_team_overtime_duties?EmpCode=${empCode}`;
      }

      //  EQUIPMENT API
      else if (type === "equipment") {
        url =
          view === "my"
            ? `${baseUrl}EquipmentRequests/MyRequests?empCode=${empCode}`
            : `${baseUrl}EquipmentRequests/TeamRequests?empCode=${empCode}`;
      } else {
        const controller = type === "permission" ? "Permission" : "Leave";
        url =
          view === "my"
            ? `${baseUrl}Permission/Load_Leave_Permission?Empcode=${empCode}&Seachdate=${selectedMonth}&LType=${type}`
            : `${baseUrl}Leave/loadrequests_leave_permission?Empcode=${empCode}&Seachdate=${selectedMonth}&LType=${type}`;
      }

      const res = await axios.get(url, { headers: getAuthHeaders() });

      let result = (Array.isArray(res.data) ? res.data : [])
        .map((x: any) => normalize(x, fbManager))
        .filter(Boolean);



      // Preserve the previous card order: keep items where they were, and
      // append any newly-seen items at the end in the order the server sent
      // them, instead of trusting the server's (possibly re-sorted) order.
      const byId = new Map(result.map((it: any) => [String(it.lid), it]));
      const orderedResult: any[] = [];

      prevOrderRef.current.forEach((id) => {
        const item = byId.get(id);
        if (item) {
          orderedResult.push(item);
          byId.delete(id);
        }
      });

      result.forEach((it: any) => {
        const lidStr = String(it.lid);
        if (byId.has(lidStr)) {
          orderedResult.push(byId.get(lidStr));
          byId.delete(lidStr);
        }
      });

      // On duty rows are always read newest first.  Holding the previous
      // order steady is right for a list somebody is working down, but a
      // duty is looked up by its number, and the one just raised is the
      // one being looked for.
      if (type === "onduty") {
        const idNum = (v: any): number => {
          const n = parseInt(String(v ?? "").replace(/[^0-9]/g, ""), 10);
          return isNaN(n) ? 0 : n;
        };
        orderedResult.sort((a: any, b: any) => idNum(b.lid) - idNum(a.lid));
      }

      prevOrderRef.current = orderedResult.map((it: any) => String(it.lid));

      setData(orderedResult);
      setFiltered(orderedResult);
      if (type === "onduty") {
        //loadTripDays(result);
      }
    } catch (e) {
      console.error(e);
      if (!silent) {
        setData([]);
        setFiltered([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const filterByStatus = (item: any) => {
    const selected = (status || "all").toLowerCase();
    const raw = (item?.L_status || "").toLowerCase();

    if (selected === "all") return true;

    const approved = raw.includes("approved") || raw.includes("accepted");
    const rejected = raw.includes("rejected");

    // On Duty's tabs are viewer-centric rather than overall-status-based:
    // "Pending" means it's pending AT ME right now (my turn to act), not
    // just that the request overall isn't finished; "Accepted"/"Rejected"
    // mean *I* approved/rejected it at my RA level, regardless of whether
    // later levels have since finished the chain.
    if (type === "onduty") {
      const myDecision = getOnDutyMyDecision(item);

      if (selected === "pending") return isOnDutyMyTurn(item);
      if (selected === "accepted") return myDecision === "approved" || myDecision === "accepted";
      if (selected === "rejected") return myDecision === "rejected";
      return true;
    }

    if (selected === "pending") {
      return raw.includes("pending");
    }

    if (selected === "accepted") {
      return approved;
    }

    if (selected === "rejected") {
      return rejected;
    }

    return true;
  };

  const finalData = filtered
    .filter(Boolean)
    .filter(filterByStatus)
    .filter((x) => {
      if (selectedEmpCode === "0") return true;

      return String(x.empcode) === String(selectedEmpCode);
    })
    .filter((x) => {
      if (type !== "overtime") return true;
      if (!x.lfrom) return true;
      return moment(x.lfrom, "YYYY-MM-DD").format("MMM-YYYY") === selectedMonth;
    });
  //  const finalData = filtered.filter(Boolean).filter(filterByStatus);
  const updateOnDuty = async (item: any, status: string) => {
    try {
      const payload = {
        _id: String(item.lid),
        Status: status === "Accepted" ? "APPROVE" : "REJECT",
        // @ActionBy is compared to CurrentRA (designation) in the stored procedure
        _empcode: getUser()?.designation || getUser()?.Designation || "",
      };

      const res = await axios.post(
        `${baseUrl}OnDuty/approve_onduty`,
        payload,
        { headers: getAuthHeaders() }
      );

      // SP returns rows serialized as [[Success, Message, id, Status, ...], ...]
      // Message is at index [1] of the first row
      let displayMsg = status === "Accepted"
        ? "On Duty request approved successfully."
        : "On Duty request rejected successfully.";

      try {
        const rows = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
        if (Array.isArray(rows) && rows.length > 0 && rows[0][1]) {
          displayMsg = String(rows[0][1]);
        }
      } catch { /* keep default msg */ }

      presentAlert({
        header: "Status Update",
        message: displayMsg,
        buttons: ["OK"],
      });
      // Mark this item locally so buttons update immediately without waiting for reload
      setOndutyActionMap(prev => ({
        ...prev,
        [String(item.lid)]: status === "Accepted" ? "approved" : "rejected",
      }));
      loadData(true);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.title ||
        (typeof e?.response?.data === "string" ? e.response.data : null) ||
        e?.message ||
        "Action failed. Please try again.";
      presentAlert({
        header: "Error",
        message: msg,
        buttons: ["OK"],
      });
      console.error("updateOnDuty error:", e?.response ?? e);
    }
  };

  const formatTime = (time: any) => {
    if (!time) return "";

    let timeStr = String(time);

    // If the server returns a full ISO date (e.g., "2026-07-18T17:30:00Z"),
    // extract just the time portion to prevent JS Date from applying timezone shifts.
    if (timeStr.includes("T")) {
      timeStr = timeStr.split("T")[1];
      // Strip any timezone indicators (Z, +, -)
      timeStr = timeStr.split(/[Z\+\-]/)[0];
    }

    return moment(timeStr, ["HH:mm:ss.SSSSSSS", "HH:mm:ss", "HH:mm"]).format("hh:mm A");
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      // Point Leave/Permission updates to Permission controller (since Leave controller calls non-existent SP)
      const controller = "Permission";
      await axios.post(
        `${baseUrl}${controller}/update_Leave_Permission`,
        {
          RequestId: String(id),
          Status: status,
          EmpCode: getUser()?.empCode,
        },
        { headers: getAuthHeaders() }
      );

      loadData(true);
    } catch (e) {
      console.error(e);
    }
  };


  const handleApprove = async (item: any) => {
    try {
      await axios.post(`${baseUrl}EquipmentRequests/UpdateStatus`, {
        RequestId: item.lid,
        Status: "Accepted",
        Amount: amountMap[item.lid] || 0,
        Comment: commentMap[item.lid] || "",
        EmpCode: getUser()?.empCode,
      }, { headers: getAuthHeaders() });

      loadData(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (item: any) => {
    try {
      await axios.post(`${baseUrl}EquipmentRequests/UpdateStatus`, {
        RequestId: item.lid,
        Status: "Rejected",
        Comment: commentMap[item.lid] || "",
        EmpCode: getUser()?.empCode,
      }, { headers: getAuthHeaders() });

      loadData(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssignEquipment = async (item: any) => {
    try {

      await axios.post(
        `${baseUrl}EquipmentRequests/UpdateStatus`,
        {
          RequestId: item.lid,
          Status: "Assigned",
          EmpCode: getUser()?.empCode,
          ECode: equipmentCodeMap[item.lid]
        },
        { headers: getAuthHeaders() }
      );

      loadData(true);

    } catch (e) {
      console.error(e);
    }
  };

  const handleReceiveEquipment = async (item: any) => {
    try {

      await axios.post(
        `${baseUrl}EquipmentRequests/UpdateStatus`,
        {
          RequestId: item.lid,
          Status: "Received",
          EmpCode: getUser()?.empCode
        },
        { headers: getAuthHeaders() }
      );

      loadData(true);

    } catch (e) {
      console.error(e);
    }
  };

  const updateOvertime = async (item: any, status: string) => {
    try {
      await axios.post(`${baseUrl}OverTime/UpdateOvertimeStatus`, {
        Id: item.lid,
        Status: status,
        EmpCode: getUser()?.empCode,
        FinMinDiff: item.MinDiff
      }, { headers: getAuthHeaders() });

      loadData(true);
    } catch (e) {
      console.error(e);
    }
  };

  const openOvertimeEdit = (item: any) => {
    const fromMinutes =
      Number(item.Fromtime.split(":")[0]) * 60 +
      Number(item.Fromtime.split(":")[1]);

    const toMinutes =
      Number(item.Totime.split(":")[0]) * 60 +
      Number(item.Totime.split(":")[1]);

    const diff = toMinutes - fromMinutes;

    setEditOT({
      lid: item.lid,
      empcode: item.empcode,
      date: moment(item.lfrom).format("YYYY-MM-DD"),
      client: item.College,
      fromtime: item.Fromtime,
      totime: item.Totime,
      description: item.Remarks,
      minDiff: diff,
      finMinDiff: diff,
    });

    setEditOtModal(true);
  };

  const saveEditedOvertime = async () => {
    try {
      const fromMinutes =
        Number(editOT.fromtime.split(":")[0]) * 60 +
        Number(editOT.fromtime.split(":")[1]);

      const toMinutes =
        Number(editOT.totime.split(":")[0]) * 60 +
        Number(editOT.totime.split(":")[1]);

      if (toMinutes <= fromMinutes) {
        presentAlert({
          header: "Validation Error",
          message: "To time should be greater than From time",
          buttons: ["OK"],
        });
        return;
      }

      const totalMinutes = toMinutes - fromMinutes;

      const payload = {
        _empcode: editOT.empcode,
        _date: editOT.date,
        _Client: editOT.client,
        _Fromtime: editOT.fromtime,
        _Totime: editOT.totime,
        _Description: editOT.description,
        _minDiff: String(totalMinutes),
        _FinMinDiff: String(totalMinutes),
        _Otid: String(editOT.lid),
      };
      console.log("BASE URL", baseUrl);

      console.log("SAVE OT PAYLOAD", payload);
      await axios.post(
        `${baseUrl}Workreport/save_overtime_duties`,
        payload,
        {
          headers: getAuthHeaders(),
        }
      );

      setEditOtModal(false);

      loadData(true);

      presentAlert({
        header: "Success",
        message: "Overtime updated successfully",
        buttons: ["OK"],
      });
    } catch (e: any) {
      console.error("SAVE OT ERROR", e);

      console.log("Response:", e?.response?.data);

      const errorMsg =
        e?.response?.data?.errors?.["$._Otid"]?.[0] ||
        e?.response?.data?.title ||
        "Failed to update overtime";

      presentAlert({
        header: "Error",
        message: errorMsg,
        buttons: ["OK"],
      });
    }
  };

  const updateEquipment = async (item: any, status: string) => {
    const payload = {
      RequestId: item.lid,
      Status: status,
      EmpCode: getUser()?.empCode,
      Amount: amountMap[item.lid] || 0,
      Comment: commentMap[item.lid] || "",
    };

    await axios.post(`${baseUrl}EquipmentRequests/UpdateStatus`, payload, { headers: getAuthHeaders() });
    loadData(true);
  };
  const getStatusLabel = (item: any) => {
    // 🔥 SHOW EXACT BACKEND VALUE
    return item?.L_status || "";
  };

  const getApprovedBy = (item: any) => {
    if (!item) return null;

    if (item?.L_status?.toLowerCase().includes("rejected")) {
      return null;
    }

    const list: string[] = [];

    const isApproved = (statusStr: any) => {
      const s = String(statusStr || "").toLowerCase();
      return s === "accepted" || s === "approved";
    };

    if (isApproved(item?.RA1_Status) && item?.RA1)
      list.push(item.RA1);

    if (isApproved(item?.RA2_Status) && item?.RA2)
      list.push(item.RA2);

    if (isApproved(item?.RA3_Status) && item?.RA3)
      list.push(item.RA3);

    if (isApproved(item?.RA4_Status) && item?.RA4)
      list.push(item.RA4);

    return list.length > 0 ? list.join(" → ") : "Not Approved Yet";
  };

  function getPermissionApprovedBy(item: any) {
  const ra1Status = normalizeText(item?.RA1_Status);
  const ra2Status = normalizeText(item?.RA2_Status);

  if (
    ra1Status === "accepted" ||
    ra1Status === "approved"
  ) {
    return item?.RA1 || "RA1";
  }

  if (
    ra2Status === "accepted" ||
    ra2Status === "approved"
  ) {
    return item?.RA2 || "RA2";
  }

  return "-";
}

  // Hoisted function declarations (not `const`) on purpose: filterByStatus /
  // finalData - defined earlier in this component - call these during
  // render, and a `const` here would leave them in the temporal dead zone
  // at that point since JS doesn't hoist `const` initializers, only the
  // binding. Function declarations are fully hoisted, so this works
  // regardless of where in the file they're written.
  function normalizeText(val: any) {
    return safeText(val).toLowerCase().replace(/\s/g, "");
  }


  const canAct = (item: any) => {
    if (!item) return false;

    const status = normalizeText(item.L_status);

    if (
      status.includes("approved") ||
      status.includes("accepted") ||
      status.includes("rejected")
    ) {
      return false;
    }

    // ✅ OnDuty: any team-view manager/TL can approve pending items
    if (type === "onduty") {
      return status.includes("pending") || status === "";
    }

    const user = normalizeText(getUser()?.designation);

    if (normalizeText(item.ltype) === "permission") {
    const ra1 = normalizeText(item.RA1);
    const ra2 = normalizeText(item.RA2);

    const ra1Status = normalizeText(item.RA1_Status);
    const ra2Status = normalizeText(item.RA2_Status);

    const user = normalizeText(getUser()?.designation);

    const ra1Responded =
        ra1Status === "accepted" ||
        ra1Status === "approved" ||
        ra1Status === "rejected";

    const ra2Responded =
        ra2Status === "accepted" ||
        ra2Status === "approved" ||
        ra2Status === "rejected";

    /*
       If either RA has already responded,
       nobody else can act.
    */
    if (ra1Responded || ra2Responded) {
        return false;
    }

    /*
       Both RA1 and RA2 can act while
       the permission is still pending.
    */
    return user === ra1 || user === ra2;
}

    // if (normalizeText(item.ltype) === "permission") {
    //   const ra1Status = normalizeText(item.RA1_Status);
    //   const ra1Approved = ra1Status === "accepted" || ra1Status === "approved";

    //   if (user === normalizeText(item.RA1) && !ra1Approved) {
    //     return true;
    //   }
    //   if (user === normalizeText(item.RA2) && ra1Approved) {
    //     return true;
    //   }
      
    //   // Fallback for old requests missing RA1
    //   if (!item.RA1 || normalizeText(item.RA1) === "") {
    //     return normalizeText(item.CurrentRA) === user;
    //   }

    //   return false;
    // }

    // Existing flow for leave/permission
    const current = normalizeText(item?.CurrentRA);
    return current === user;
  };

  // OnDuty team-view: has the logged-in user's own designation already
  // recorded a decision (Approved/Rejected) at any RA1..RA4 level for this
  // request? Needed because canAct()/the overall L_status only reflect the
  // FINAL outcome once every level has acted - a Business Manager who already
  // approved at RA1 would otherwise still see Approve/Reject buttons while the
  // request sits pending at RA2/RA3/RA4, including cases where "Business
  // Manager" happens to be listed at more than one RA slot for the same
  // request. Matching is by designation text, same as the rest of this file.
  function getOnDutyMyDecision(item: any): string {
    const userDesig = normalizeText(getUser()?.designation);
    if (!userDesig) return "";

    const raSlots = [item?.RA1, item?.RA2, item?.RA3, item?.RA4];
    const raStatuses = [
      item?.RA1_Status,
      item?.RA2_Status,
      item?.RA3_Status,
      item?.RA4_Status,
    ];

    for (let i = 0; i < raSlots.length; i++) {
      const raNorm = normalizeText(raSlots[i]);
      if (!raNorm || raNorm === "-") continue;
      if (raNorm !== userDesig) continue;

      const s = normalizeText(raStatuses[i]);
      if (s === "approved" || s === "accepted" || s === "rejected") return s;
    }

    return "";
  }

  // Builds the "Approved By: Business Manager → HR" trail for an On Duty
  // team-view card - one entry per populated RA1..RA4 slot, colored by that
  // slot's own status (approved = green, rejected = red, still pending =
  // blue), independent of the other status flags used elsewhere.
  function getOnDutyChain(item: any) {
    const slots = [
      { role: item?.RA1, status: item?.RA1_Status },
      { role: item?.RA2, status: item?.RA2_Status },
      { role: item?.RA3, status: item?.RA3_Status },
      { role: item?.RA4, status: item?.RA4_Status },
    ];

    return slots
      .filter((s) => {
        const roleNorm = normalizeText(s.role);
        return roleNorm && roleNorm !== "-";
      })
      .map((s) => {
        const st = normalizeText(s.status);
        const color =
          st === "approved" || st === "accepted"
            ? "approved"
            : st === "rejected"
              ? "rejected"
              : "pending";
        return { role: String(s.role).trim(), color };
      });
  }

  // Is it currently this viewer's own turn to act on this On Duty request -
  // i.e. the "PENDING AT" role matches their own designation. Shared between
  // the card's button gating and the status filter's "Pending" tab.
  function isOnDutyMyTurn(item: any) {
    return !!item?.CurrentRA && normalizeText(item.CurrentRA) === normalizeText(getUser()?.designation);
  }

  // Is the viewer ANY of this duty's RAs, not just whoever's turn it is
  // right now - matches OnDuties.tsx's own canAmendDuty, which is what
  // gates its "DA / TA" link.
  function isAnyRAForOnDuty(item: any) {
    const me = normalizeText(getUser()?.designation);
    if (!me) return false;
    return [item?.RA1, item?.RA2, item?.RA3, item?.RA4].some(
      (ra) => !!ra && normalizeText(ra) === me
    );
  }

  // const canAct = (item: any) => {
  //   if (!item) return false;

  //   const status = normalizeText(item.L_status);

  //   // ❌ already completed
  //   if (
  //     status.includes("approved") ||
  //     status.includes("accepted") ||
  //     status.includes("rejected")
  //   ) {
  //     return false;
  //   }

  //   const user = normalizeText(getUser()?.designation);
  //   const current = normalizeText(item?.CurrentRA);

  //   return current === user;
  // };
  const cleanDate = (val: any) => {
    if (!val) return "";

    // if object → invalid backend junk
    if (typeof val === "object") return "";

    const str = String(val).trim();

    if (str === "{}" || str === "null" || str === "undefined") return "";

    return str;
  };

  const fmtDate = (val?: string) => {
    if (!val) return "";
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return moment(d).format("DD-MM-YYYY");
  };

  const formatLeaveCategory = (value: any) => {
    if (!value) return "-";

    const v = String(value).trim();

    if (v.toLowerCase() === "forenoon") {
      return "Casual (Forenoon)";
    }

    if (v.toLowerCase() === "afternoon") {
      return "Casual (Afternoon)";
    }

    return v;
  };

  if (type === "onduty" && view === "my") {
    return null; // 🔥 completely hide OnDuty in My Requests
  }

  const loadPermissionDashboard = async (empcode?: string) => {
    try {
      const m =
        moment(selectedMonth, "MMM-YYYY").month() + 1;

      const y =
        moment(selectedMonth, "MMM-YYYY").year();

      let finalEmp = "";

      // ✅ MY REQUESTS
      if (view === "my") {
        finalEmp = getUser()?.empCode;
      }

      // ✅ TEAM REQUESTS
      else {
        // selected employee
        if (
          selectedEmpCode &&
          selectedEmpCode !== "0"
        ) {
          finalEmp = selectedEmpCode;
        }

        // all reporting employees
        else {
          finalEmp = "";
        }
      }

      const res = await axios.get(
        `${baseUrl}Permission/GetPermissionDashboard?EmpCode=${finalEmp}&Month=${m}&Year=${y}`,
        {
          headers: getAuthHeaders(),
        }
      );

      setPermissionData(res.data || []);

      setPermissionModal(true);

    } catch (e) {
      console.error(e);
    }
  };

  const loadTeamPermissionDashboard = async () => {
    try {

      const m =
        moment(selectedMonth, "MMM-YYYY").month() + 1;

      const y =
        moment(selectedMonth, "MMM-YYYY").year();

      const res = await axios.get(
        `${baseUrl}Permission/GetTeamPermissionDashboard?EmpCode=${getUser()?.empCode}&Month=${m}&Year=${y}`,
        {
          headers: getAuthHeaders(),
        }
      );

      setPermissionData(res.data || []);

      setPermissionModal(true);

    } catch (e) {
      console.error(e);
    }
  };
  return (
    <div style={{ width: '100%' }}>



      {/* FILTERS */}
      {view !== "my" ? (
        <div className="filters-grid">

          {/* EMPLOYEE FILTER */}
          <div className="custom-dropdown-container" ref={triggerRef}>
            <div
              className={`premium-filter-trigger ${isSearchModalOpen ? "active" : ""
                }`}
              onClick={() => setIsSearchModalOpen(!isSearchModalOpen)}
            >
              <div className="trigger-content">
                <div className="trigger-icon-box">
                  <IonIcon icon={personOutline} />
                </div>

                <div className="trigger-text-sec">
                  <span className="trigger-sub">Employee</span>

                  <span className="trigger-main">
                    {employees.find((e) => e.id === selectedEmpCode)?.name ||
                      "Select Employee"}
                  </span>
                </div>
              </div>

              <IonIcon
                icon={layersOutline}
                className="trigger-icon-arrow"
              />
            </div>

            {isSearchModalOpen &&
              createPortal(
                <>
                  <div
                    className="dropdown-outside-click-layer"
                    onClick={() => setIsSearchModalOpen(false)}
                  />

                  <div
                    className="custom-inline-dropdown"
                    style={{
                      position: "absolute",
                      top: `${dropdownPos.top}px`,
                      left: `${dropdownPos.left}px`,
                      width: `${dropdownPos.width}px`,
                    }}
                  >
                    <div className="dropdown-search-sec">
                      <IonIcon
                        icon={searchOutline}
                        className="dropdown-search-icon"
                      />

                      <input
                        type="text"
                        className="dropdown-pure-input"
                        placeholder="Search employee..."
                        value={searchTerm}
                        onChange={(e) =>
                          setSearchTerm(e.target.value)
                        }
                        autoFocus
                      />

                      {searchTerm && (
                        <button
                          className="dropdown-clear-btn"
                          onClick={() => setSearchTerm("")}
                        >
                          <IonIcon icon={closeCircle} />
                        </button>
                      )}
                    </div>

                    <div className="dropdown-body">
                      {employees
                        .filter(
                          (emp) =>
                            emp.name
                              .toLowerCase()
                              .includes(searchTerm.toLowerCase()) ||
                            emp.id
                              .toLowerCase()
                              .includes(searchTerm.toLowerCase())
                        )
                        .map((emp) => {
                          const isSelected =
                            selectedEmpCode === emp.id;

                          const nameWithoutId = emp.name.includes("-")
                            ? emp.name.split("-")[1].trim()
                            : emp.name;

                          const initials =
                            nameWithoutId.charAt(0).toUpperCase();

                          return (
                            <div
                              key={emp.id}
                              className={`dropdown-emp-item ${isSelected ? "selected" : ""
                                }`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();

                                setSelectedEmpCode(emp.id);

                                setIsSearchModalOpen(false);

                                setSearchTerm("");
                              }}
                            >
                              <div
                                className={`dr-avatar grad-${(parseInt(emp.id) % 5) || 0
                                  }`}
                              >
                                {emp.id === "0" ? (
                                  <IonIcon icon={layersOutline} />
                                ) : (
                                  initials
                                )}
                              </div>

                              <div className="dr-info">
                                <span className="dr-name">
                                  {emp.name}
                                </span>

                                <span className="dr-id">
                                  {emp.id === "0"
                                    ? "Global"
                                    : `ID: ${emp.id}`}
                                </span>
                              </div>

                              {isSelected && (
                                <IonIcon
                                  icon={checkmarkCircle}
                                  className="dr-check"
                                />
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </>,
                document.body
              )}
          </div>

          {/* MONTH FILTER */}
          <div className="custom-dropdown-container">
            <div className="premium-filter-trigger">
              <div className="trigger-content">
                <div className="trigger-icon-box">
                  <IonIcon icon={calendarOutline} />
                </div>

                <div className="trigger-text-sec">
                  <span className="trigger-sub">Period</span>
                  <span className="trigger-main">
                    {selectedMonth}
                  </span>
                </div>
              </div>

              <IonIcon
                icon={layersOutline}
                className="trigger-icon-arrow"
              />

              <IonSelect
                className="hidden-select-overlay"
                interface="popover"
                value={selectedMonth}
                onIonChange={(e) =>
                  setSelectedMonth(e.detail.value)
                }
              >
                {months.map((m) => (
                  <IonSelectOption key={m} value={m}>
                    {m}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </div>
          </div>
          {type === "permission" && (
            <button
              className="permission-dashboard-btn top-dashboard-btn"
              onClick={() => {
                if (view === "my") {
                  loadPermissionDashboard();
                } else {
                  loadTeamPermissionDashboard();
                }
              }}
            >
              <IonIcon icon={speedometerOutline} />
            </button>
          )}
        </div>
      ) : (
        /* ONLY MONTH FILTER FOR "my" VIEW */
        <div className="filters-grid">

          <div className="custom-dropdown-container">
            <div className="premium-filter-trigger">
              <div className="trigger-content">
                <div className="trigger-icon-box">
                  <IonIcon icon={calendarOutline} />
                </div>

                <div className="trigger-text-sec">
                  <span className="trigger-sub">Period</span>
                  <span className="trigger-main">
                    {selectedMonth}
                  </span>
                </div>
              </div>

              <IonIcon
                icon={layersOutline}
                className="trigger-icon-arrow"
              />

              <IonSelect
                className="hidden-select-overlay"
                interface="popover"
                value={selectedMonth}
                onIonChange={(e) =>
                  setSelectedMonth(e.detail.value)
                }
              >
                {months.map((m) => (
                  <IonSelectOption key={m} value={m}>
                    {m}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </div>
          </div>
          {type === "permission" && (
            <button
              className="permission-dashboard-btn top-dashboard-btn"
              onClick={() => loadPermissionDashboard()}
            >
              <IonIcon icon={speedometerOutline} />
            </button>
          )}
        </div>
      )}
      {loading && <p>Loading...</p>}

      {!loading &&
        finalData
          .map((item) => {
            // On Duty (Team Requests) uses the same "premium-card" look as
            // the Duty Manager page's My Requests cards, rather than the
            // generic lr-history-card layout used by the other request types.
            if (type === 'onduty') {
              const localAction = ondutyActionMap[String(item.lid)];
              const serverStatus = (item.L_status || '').toLowerCase();
              const myDecision = getOnDutyMyDecision(item);

              // Overall outcome of the whole approval chain - drives the
              // top-right status tag ONLY. This must stay independent of
              // whether the current viewer personally already acted, since
              // other RA levels can still be pending after that.
              const overallApproved = serverStatus.includes('approved') || serverStatus.includes('accepted');
              const overallRejected = serverStatus.includes('rejected');

              // Has the current viewer already acted (personally, or via a
              // matching RA slot)? Drives the Approve/Reject buttons vs. the
              // pill underneath - separate from the overall tag above.
              const isApproved =
                localAction === 'approved' ||
                myDecision === 'approved' ||
                myDecision === 'accepted' ||
                (!localAction && !myDecision && overallApproved);

              const isRejected =
                localAction === 'rejected' ||
                myDecision === 'rejected' ||
                (!localAction && !myDecision && overallRejected);

              // Only show Approve/Reject when the "PENDING AT" role actually
              // matches the viewer's own designation - being an approver
              // somewhere in the chain isn't enough, it has to be their turn.
              const isMyTurn = isOnDutyMyTurn(item);

              const approvalChain = getOnDutyChain(item);

              return (
                <div key={`${item.lid}-${item.empcode}`} className="dm-card">
                  <span
                    className={`dm-side-flag ${overallApproved ? "approved" : overallRejected ? "rejected" : "pending"
                      }`}
                  />
                  <div className="dm-card-header">
                    <div style={{ flex: 1 }}>
                      {/* Same heading as the Duty Manager card: the id leads,
                          then the duty itself - type and branch - which used
                          to cost two labelled boxes down in the grid. "Party"
                          stood in for a column most duties never fill, so it
                          survives only as the fallback for a duty carrying
                          neither a type nor a branch. */}
                      <div className="dm-college-name">
                        <span className="dm-id-badge lead">#{item.lid}</span>
                        {(() => {
                          const t = String(item.OnDutyType || "").trim();
                          const b = String(item.Branch || "").trim();
                          const head = [t, b].filter(Boolean).join(" - ");
                          return head || String(item.College || "").trim() || "Duty";
                        })()}
                        {/* Why they are at that branch travelled with the
                            branch in the old box, so it travels with it
                            here too. */}
                        {!!item.BranchChangeType && (
                          <span style={{ color: "#64748b", fontWeight: 600 }}>
                            {" "}
                            &bull; {item.BranchChangeType}
                          </span>
                        )}
                      </div>
                      <div className="dm-subtitle">{item.Description}</div>
                    </div>

                    {/* The approval trail rides up here beside the status
                        pill rather than sitting at the foot of the card, so
                        how far a request has got costs no scrolling. */}
                    <div className="dm-head-right">
                      {approvalChain.length > 0 && (
                        <div className="dm-chain">
                          <span className="dm-chain-label">Approval Status:</span>{" "}
                          {approvalChain.map((step, idx) => (
                            <React.Fragment key={idx}>
                              <span className={`dm-chain-role ${step.color}`}>{step.role}</span>
                              {idx < approvalChain.length - 1 && (
                                <span className="dm-chain-arrow"> → </span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      )}

                      <span
                        className={`dm-status-dot ${overallApproved ? "approved" : overallRejected ? "rejected" : "pending"
                          }`}
                      >
                        {overallApproved ? "Approved" : overallRejected ? "Rejected" : "Pending"}
                      </span>
                    </div>
                  </div>

                  <div className="dm-grid">
                    <div className="dm-info-box dm-full-width">
                      <span className="dm-item-label">Employees</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
                        {(() => {
                          const { chips, applicant, assignedBy } = dutyPeople(item);

                          return (
                            <>
                              {chips.map((emp: any, idx: number) => {
                                const isApplicant =
                                  !!applicant &&
                                  String(emp.code ?? "").trim() === applicant;

                                return (
                                  <div
                                    key={idx}
                                    className="dm-emp-chip"
                                    title={
                                      isApplicant
                                        ? "Applied for this duty themselves"
                                        : undefined
                                    }
                                    // Inline rather than a modifier class: an
                                    // earlier rule appended to this stylesheet
                                    // never took effect for reasons that were
                                    // never explained, and a tint that silently
                                    // does nothing is worse than no tint.
                                    style={
                                      isApplicant
                                        ? {
                                            background: "#ecfdf5",
                                            color: "#065f46",
                                            border: "1px solid #6ee7b7",
                                          }
                                        : undefined
                                    }
                                  >
                                    {emp.name}
                                    {emp.code && <span style={{ opacity: 0.7 }}> ({emp.code})</span>}
                                  </div>
                                );
                              })}

                              {assignedBy && assignedByChip(assignedBy)}
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="dm-info-box">
                      <span className="dm-item-label">Transport</span>
                      <span className="dm-item-value">
                        {item.Mode_of_Trans}
                        {item.Vehicle_No && <span style={{ color: "#64748b" }}> • {item.Vehicle_No}</span>}
                        {/* Part of the same answer as the mode, so it shares
                            the box rather than taking a column of its own. */}
                        {item.TripType && <span style={{ color: "#64748b" }}> • {item.TripType}</span>}
                      </span>
                    </div>

                    <div className="dm-info-box">
                      <span className="dm-item-label">Timeline</span>
                      <span className="dm-item-value">{fmtDate(item.DateFrom)}{item.StartTime ? ` ${String(item.StartTime).slice(0, 5)}` : ""} → {fmtDate(item.DateTo)}{item.EndTime ? ` ${String(item.EndTime).slice(0, 5)}` : ""}</span>
                    </div>

                    {/* Branch visits carry no location by design, so this
                        box was rendering as an empty labelled slot on every
                        one of them. A missing box reads as "not applicable";
                        an empty one reads as "we lost it". */}
                    {!!item.Location && (
                      <div className="dm-info-box">
                        <span className="dm-item-label">Location</span>
                        <span className="dm-item-value">{item.Location}</span>
                      </div>
                    )}

                    {/* Only marked days are stored, so unlike the entry form
                        there is no unmarked counterpart to show - every pill
                        here is a green one and the count carries the rest.
                        This is the number an approver is actually checking,
                        so it goes in the label rather than being left to be
                        counted off the row. */}
                    {attDayPills(item).length > 0 && (
                      <div className="dm-info-box">
                        <span className="dm-item-label">
                          Reporting Dates at Branch ({attDayPills(item).length})
                        </span>
                        <div
                          className="dm-item-value"
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "4px",
                          }}
                        >
                          {attDayPills(item).map((d) => (
                            <span
                              key={d.day}
                              title={`${d.full} - marked for attendance`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxSizing: "border-box",
                                // Matched to the entry form's pills so the
                                // same day looks like the same thing in both
                                // places.
                                minWidth: "20px",
                                height: "20px",
                                padding: "0 5px",
                                borderRadius: "999px",
                                background: "#dcfce7",
                                color: "#15803d",
                                border: "1px solid #86efac",
                                fontSize: "10px",
                                fontWeight: 600,
                                lineHeight: 1,
                              }}
                            >
                              {d.day}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="dm-info-box">
                      <span className="dm-item-label">Details</span>
                      <a
                        href="#"
                        className="dm-view-link"
                        onClick={(e) => { e.preventDefault(); setSelectedDuty(item); setExpandedTripDays(new Set([0])); setViewModalOpen(true); }}
                      >
                        View
                      </a>
                    </div>

                    {/* Read-only on the settlement page itself for anyone
                        who isn't Accountant/Director - this link just gets
                        an RA there. */}
                    {overallApproved && isAnyRAForOnDuty(item) && (
                      <div className="dm-info-box">
                        <span className="dm-item-label">DA / TA</span>
                        <a
                          href="#"
                          className="dm-view-link"
                          onClick={(e) => { e.preventDefault(); setDataDutyId(item.lid); setDataCanViewAll(true); }}
                        >
                          View
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Approve/Reject only when it's actually this viewer's
                    turn - being an approver in the chain isn't enough. */}
                  {view !== 'my' && isMyTurn && !isApproved && !isRejected && (
                    <div className="dm-action-row">
                      <button className="dm-approve-btn" onClick={() => updateOnDuty(item, 'Accepted')}>
                        Approve
                      </button>
                      <button className="dm-reject-btn" onClick={() => updateOnDuty(item, 'Rejected')}>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={`${item.lid}-${item.empcode}`} className={`lr-history-card status-${(item.L_status || '').toLowerCase().replace(/\s/g, '')}`}>
                <div className="lr-card-inner">
                  <div className="lr-card-header-row">
                    <div className="lr-card-main">
                      {/* <div className="lr-card-title">
                    {type === 'equipment' ? item.Remarks : type === 'overtime' ? item.Empname : type === 'onduty' ? item.College : (item.empcode + ' : ' + item.Empname)}
                  </div> */}
                      <div className="lr-card-title">
                        {type === "equipment"
                          ? item.Remarks
                          : type === "onduty"
                            ? item.College : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{
                                    background: '#fff7ed',
                                    color: 'var(--ion-color-primary, #e2711d)',
                                    border: '1px solid #fed7aa',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 800
                                  }}>
                                    ID {item.empcode}
                                  </span>
                                  <span>{item.Empname}</span>
                                </span>
                              )}
                      </div>
                      <div className="lr-card-subtitle">
                        {type === 'equipment' ? 'Raised by : ' + (item.Empname + ' (' + item.empcode + ')') : type === 'onduty' ? item.Description : 'Purpose : ' + item.Remarks}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>


                      <div
                        className={`lr-status-indicator lr-status-${(item.L_status || '')
                          .toLowerCase()
                          .replace(/\s/g, '')}`}
                      >
                        {item.L_status}
                      </div>

                    </div>

                  </div>

                  <div className="lr-card-grid">
                    {type === 'equipment' && (
                      <>
                        <div className="lr-grid-item"><span className="lr-grid-label">Priority</span><span className="lr-grid-value priority">{item.Priority}</span></div>
                        <div className="lr-grid-item"><span className="lr-grid-label">Applied On</span><span className="lr-grid-value">{cleanDate(item.lfrom)}</span></div>
                        <div className="lr-grid-item"><span className="lr-grid-label">Amount</span><span className="lr-grid-value">{item.Amount ? '₹ ' + item.Amount : '-'}</span></div>
                        {item.FilePath && (
                          <div className="lr-grid-item">
                            <span className="lr-grid-label">File</span>
                            <a href={item.FilePath} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 600, fontSize: '13px' }}>Download</a>
                          </div>
                        )}
                        <div className="lr-grid-item">
                          <span className="lr-grid-label">Equipment Code</span>
                          <span className="lr-grid-value">
                            {item.ECode || "-"}
                          </span>
                        </div>

                        <div className="lr-grid-item">
                          <span className="lr-grid-label">Assign Status</span>
                          <span className="lr-grid-value">
                            {item.AssignStatus || "Pending"}
                          </span>
                        </div>

                        <div className="lr-grid-item">
                          <span className="lr-grid-label">Receive Status</span>
                          <span className="lr-grid-value">
                            {item.ReceiveStatus || "Pending"}
                          </span>
                        </div>
                      </>
                    )}
                    {type === 'overtime' && (
                      <>
                        <div className="lr-grid-item"><span className="lr-grid-label">Date</span><span className="lr-grid-value">{item.lfrom}</span></div>
                        <div className="lr-grid-item"><span className="lr-grid-label">Time</span><span className="lr-grid-value">{item.Fromtime} → {item.Totime}</span></div>
                        <div className="lr-grid-item"><span className="lr-grid-label">Duration</span><span className="lr-grid-value">{item.MinDiff} mins</span></div>
                      </>
                    )}
                    {type === 'onduty' && (
                      <>
                        <div className="lr-grid-item full-width">
                          <span className="lr-grid-label">Employees</span>

                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "8px",
                              marginTop: "6px",
                            }}
                          >
                            {(() => {
                              const { chips, applicant, assignedBy } =
                                dutyPeople(item);

                              return (
                                <>
                                  {chips.map((emp: any, idx: number) => {
                                    const isApplicant =
                                      !!applicant &&
                                      String(emp.code ?? "").trim() === applicant;

                                    return (
                                      <div
                                        key={idx}
                                        title={
                                          isApplicant
                                            ? "Applied for this duty themselves"
                                            : undefined
                                        }
                                        style={{
                                          background: isApplicant
                                            ? "#ecfdf5"
                                            : "#eef2ff",
                                          color: isApplicant
                                            ? "#065f46"
                                            : "#3730a3",
                                          border:
                                            "1px solid " +
                                            (isApplicant ? "#6ee7b7" : "#c7d2fe"),
                                          padding: "6px 10px",
                                          borderRadius: "20px",
                                          fontSize: "12px",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {emp.name}
                                        {emp.code && (
                                          <span style={{ opacity: 0.7 }}>
                                            {" "}
                                            ({emp.code})
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}

                                  {assignedBy && assignedByChip(assignedBy)}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="lr-grid-item"><span className="lr-grid-label">Transport</span><span className="lr-grid-value">{item.Mode_of_Trans} {item.Vehicle_No && `• ${item.Vehicle_No}`}</span></div>
                        <div className="lr-grid-item"><span className="lr-grid-label">Timeline</span><span className="lr-grid-value">{fmtDate(item.DateFrom)}{item.StartTime ? ` ${String(item.StartTime).slice(0, 5)}` : ""} → {fmtDate(item.DateTo)}{item.EndTime ? ` ${String(item.EndTime).slice(0, 5)}` : ""}</span></div>
                        <div className="lr-grid-item"><span className="lr-grid-label">Location</span><span className="lr-grid-value">{item.Location}</span></div>
                        <div className="lr-grid-item">
                          <span className="lr-grid-label">Details</span>
                          <a href="#" onClick={(e) => { e.preventDefault(); setSelectedDuty(item); setExpandedTripDays(new Set([0])); setViewModalOpen(true); }} style={{ color: '#2563eb', fontWeight: 600, fontSize: '13px' }}>View</a>
                        </div>
                      </>
                    )}
                    {(type !== 'equipment' && type !== 'overtime' && type !== 'onduty') && (
                      <>
                        <div className="lr-grid-item">
                          <span className="lr-grid-label">Category</span>
                          <span className="lr-grid-value">
                            {item?.ltype?.toLowerCase() === "permission"
                              ? item.LeaveCategory === "LOP"
                                ? "Permission (LOP)"
                                : item.Leavemode
                              : `${item.Leavemode} (${item.LeaveCategory})`}
                          </span>
                        </div>
                        <div className="lr-grid-item"><span className="lr-grid-label">Applied On</span><span className="lr-grid-value">{item.AppliedOn}</span></div>
                        {item?.ltype?.toLowerCase() === 'permission' ? (
                          <>
                            <div className="lr-row">
                              <div className="lr-grid-item">
                                <span className="lr-grid-label">Permission Time</span>
                                <span className="lr-grid-value permission-time">
                                  {cleanDate(item.lfrom)}
                                  {item.InTime ? ` (${formatTime(item.InTime)})` : ""}
                                  {item.ptime ? ` (${item.ptime})` : ""}
                                </span>
                              </div>

                              {typeof item.Slip === "string" &&
                                item.Slip.trim() !== "" && (
                                  <div className="lr-grid-item">
                                    <span className="lr-grid-label">Slip</span>
                                    <span className="lr-grid-value">{item.Slip}</span>
                                  </div>
                                )}
                            </div>
                          </>
                        ) : (
                          <div className="lr-grid-item"><span className="lr-grid-label">Leave Dates</span><span className="lr-grid-value">{cleanDate(item.lfrom)} {cleanDate(item.lto) && cleanDate(item.lto) !== cleanDate(item.lfrom) ? `- ${cleanDate(item.lto)}` : ''}</span></div>
                        )}
                      </>
                    )}
                  </div>

                  {((item.RA1_Comment || item.RA2_Comment || item.RA3_Comment || item.RA4_Comment) && type === 'equipment') && (
                    <div style={{ marginTop: '14px', fontSize: '13px' }}>
                      <b style={{ color: '#64748b' }}>Comments</b>
                      {item.RA1_Comment && <p style={{ margin: '4px 0' }}>💬 {item.RA1}: {item.RA1_Comment}</p>}
                      {item.RA2_Comment && <p style={{ margin: '4px 0' }}>💬 {item.RA2}: {item.RA2_Comment}</p>}
                      {item.RA3_Comment && <p style={{ margin: '4px 0' }}>💬 {item.RA3}: {item.RA3_Comment}</p>}
                      {item.RA4_Comment && <p style={{ margin: '4px 0' }}>💬 {item.RA4}: {item.RA4_Comment}</p>}
                    </div>
                  )}

                  {getRejectionInfo(item) && <p style={{ color: 'red', fontWeight: 'bold', fontSize: '12px', marginTop: '8px' }}>{getRejectionInfo(item)}</p>}
                  {/* {!item?.L_status?.toLowerCase().includes('rejected') && type !== 'equipment' && type !== 'onduty' && (
                    <div className="lr-approved-stepper-box">
                      <span className="lr-stepper-check-badge">✓</span>
                      <span><b>Approved By:</b> <span style={{ color: '#0f172a', fontWeight: 700 }}>{getApprovedBy(item)}</span></span>
                    </div>
                  )} */}

                  {!item?.L_status?.toLowerCase().includes('rejected') &&
  type !== 'equipment' &&
  type !== 'onduty' && (
    <div className="lr-approved-stepper-box">
      <span className="lr-stepper-check-badge">✓</span>

      <span>
        <b>Approved By:</b>{" "}
        <span
          style={{
            color: "#0f172a",
            fontWeight: 700
          }}
        >
          {item?.ltype?.toLowerCase() === "permission"
            ? getPermissionApprovedBy(item)
            : getApprovedBy(item)}
        </span>
      </span>
    </div>
  )}

                  {/* ── OnDuty team-view: always show status-driven action buttons ── */}
                  {type === 'onduty' && view !== 'my' && (() => {
                    // Priority: local optimistic state → then server L_status
                    const localAction = ondutyActionMap[String(item.lid)];
                    const serverStatus = (item.L_status || '').toLowerCase();

                    // Already decided by the logged-in user's own designation at
                    // an RA1..RA4 level (e.g. a Business Manager slot already
                    // approved) - hide the buttons even if L_status is still
                    // pending at a later level.
                    const myDecision = getOnDutyMyDecision(item);

                    const isApproved =
                      localAction === 'approved' ||
                      myDecision === 'approved' ||
                      myDecision === 'accepted' ||
                      (!localAction && (serverStatus.includes('approved') || serverStatus.includes('accepted')));

                    const isRejected =
                      localAction === 'rejected' ||
                      myDecision === 'rejected' ||
                      (!localAction && serverStatus.includes('rejected'));

                    const isPending = !isApproved && !isRejected;

                    return (
                      <div className="lr-card-actions">
                        <button
                          className="lr-action-btn approve"
                          disabled={isApproved}
                          style={isApproved ? { opacity: 0.65, cursor: 'not-allowed' } : {}}
                          onClick={() => !isApproved && updateOnDuty(item, 'Accepted')}
                        >
                          {isApproved ? '✅ Approved' : '✅ Approve'}
                        </button>

                        {isPending && (
                          <button
                            className="lr-action-btn reject"
                            onClick={() => updateOnDuty(item, 'Rejected')}
                          >
                            ❌ Reject
                          </button>
                        )}

                        {isRejected && (
                          <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600, alignSelf: 'center' }}>
                            ❌ Rejected
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── All other types: standard canAct gate ── */}
                  {((type !== 'onduty' && view !== "my" && canAct(item)) || (type === "overtime" && view === "my")) && (
                    <div className="lr-card-actions">
                      {type === 'onduty' ? (
                        <></>
                      ) : type === 'equipment' ? (
                        <>

                          {/* NORMAL APPROVAL FLOW */}

                          {canAct(item) && (
                            <>
                              {item.CurrentLevel === 1 &&
                                item.RequestType !== "Replacement" && (
                                  <input
                                    type="number"
                                    placeholder="Amount"
                                    value={amountMap[item.lid] || ''}
                                    onChange={(e) =>
                                      handleAmountChange(item.lid, e.target.value)
                                    }
                                  />
                                )}

                              <input
                                type="text"
                                placeholder="Comment"
                                value={commentMap[item.lid] || ''}
                                onChange={(e) =>
                                  handleCommentChange(item.lid, e.target.value)
                                }
                              />

                              <button
                                className="lr-action-btn approve"
                                onClick={() => handleApprove(item)}
                              >
                                ✅ Approve
                              </button>

                              <button
                                className="lr-action-btn reject"
                                onClick={() => handleReject(item)}
                              >
                                ❌ Reject
                              </button>
                            </>
                          )}

                          {/* 
  

    {item.L_status === "Approved" &&
      item.AssignStatus !== "Assigned" &&
      getUser()?.designation === item.RA1 && (
console.log(item.RA1, getUser()?.designation, item.CurrentLevel),
        <div style={{ marginTop: "10px" }}>

          <input
            type="text"
            placeholder="Enter Equipment Code"
            value={equipmentCodeMap[item.lid] || ""}
            onChange={(e) =>
              setEquipmentCodeMap({
                ...equipmentCodeMap,
                [item.lid]: e.target.value
              })
            }
          />

          <button
            className="lr-action-btn approve"
            onClick={() => handleAssignEquipment(item)}
          >
            Assign Equipment
          </button>

        </div>
      )}


   

    {item.AssignStatus === "Assigned" &&
      item.ReceiveStatus !== "Received" &&
      view === "my" &&
      item.empcode === getUser()?.empCode && (

        <button
          className="lr-action-btn approve"
          onClick={() => handleReceiveEquipment(item)}
        >
          Receive Equipment
        </button>
      )} */}

                        </>
                      ) : type === 'overtime' ? (
                        <>
                          {view !== "my" && canAct(item) && (
                            <>
                              <button
                                className="lr-action-btn approve"
                                onClick={() => updateOvertime(item, 'Accepted')}
                              >
                                ✅ Approve
                              </button>

                              <button
                                className="lr-action-btn reject"
                                onClick={() => updateOvertime(item, 'Rejected')}
                              >
                                ❌ Reject
                              </button>
                            </>
                          )}

                          {/* 🔥 SHOW EDIT ONLY BEFORE RA1 ACTION */}
                          {view === "my" &&
                            (!item.RA1_Status ||
                              item.RA1_Status.toLowerCase() === "pending") && (
                              <button
                                className="lr-action-btn edit"
                                onClick={() => openOvertimeEdit(item)}
                              >
                                ✏️ Edit
                              </button>
                            )}
                        </>
                      ) : (
                        <>
                          <button className="lr-action-btn approve" onClick={() => updateStatus(item.lid, 'Accepted')}>✅ Approve</button>
                          <button className="lr-action-btn reject" onClick={() => updateStatus(item.lid, 'Rejected')}>❌ Reject</button>
                        </>
                      )}
                    </div>
                  )}
                  {/* NETWORK ADMIN ASSIGN */}

                  {type === "equipment" &&
                    item.L_status === "Approved" &&
                    item.AssignStatus !== "Assigned" &&
                    getUser()?.designation === item.RA1 && (

                      <div className="lr-card-actions">

                        <input
                          type="text"
                          placeholder="Enter Equipment Code"
                          value={equipmentCodeMap[item.lid] || ""}
                          onChange={(e) =>
                            setEquipmentCodeMap({
                              ...equipmentCodeMap,
                              [item.lid]: e.target.value
                            })
                          }
                        />

                        <button
                          className="lr-action-btn approve"
                          onClick={() => handleAssignEquipment(item)}
                        >
                          Assign Equipment
                        </button>

                      </div>
                    )}

                  {/* EMPLOYEE RECEIVE */}

                  {type === "equipment" &&
                    item.AssignStatus === "Assigned" &&
                    item.ReceiveStatus !== "Received" &&
                    view === "my" &&
                    item.empcode === getUser()?.empCode && (

                      <div className="lr-card-actions">

                        <button
                          className="lr-action-btn approve"
                          onClick={() => handleReceiveEquipment(item)}
                        >
                          Receive Equipment
                        </button>

                      </div>
                    )}
                </div>{/* end lr-card-inner */}
              </div>
            );
          })}
      {viewModalOpen && selectedDuty && (
        <div className="modal-overlay">
          <div className="modal-container">

            {/* HEADER */}
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <h3>On Duty Details</h3>
                {selectedDuty.lid && (
                  <a
                    href="#"
                    className="dm-view-link"
                    onClick={(e) => {
                      e.preventDefault();
                      setDataDutyId(selectedDuty.lid);
                      setDataCanViewAll(isAnyRAForOnDuty(selectedDuty));
                    }}
                  >
                    DA / TA
                  </a>
                )}
              </div>
              <button onClick={() => setViewModalOpen(false)}>✖</button>
            </div>

            {/* BODY */}
            <div className="modal-body">

              {(selectedDuty.dayTrips || []).length === 0 && (
                <p>No trip data available</p>
              )}

              {(selectedDuty.dayTrips || []).map((trip: any, index: number) => {
                const isDayExpanded = expandedTripDays.has(index);
                return (
                <div key={trip.dayTrip_Id || index} className="trip-card">

                  <div
                    className="trip-header"
                    onClick={() => toggleTripDay(index)}
                    style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                  >
                    <b>{moment(trip.dutyDate).format("DD-MM-YYYY")}</b>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      {(trip.visits || []).length} visit{(trip.visits || []).length === 1 ? "" : "s"}{" "}
                      {isDayExpanded ? "▲" : "▼"}
                    </span>
                  </div>

                  {isDayExpanded && (
                  <div className="trip-body">
                    <p>
                      <b>Reading:</b>{" "}
                      {trip.readingFromImagePath ? (
                        <span
                          style={{ color: "blue", cursor: "pointer", textDecoration: "underline" }}
                          onClick={() =>
                            window.open(getUploadedImageUrl(trip.readingFromImagePath), "_blank")
                          }
                        >
                          {trip.readingFrom}
                        </span>
                      ) : (
                        trip.readingFrom
                      )}
                      {" → "}
                      {trip.readingToImagePath ? (
                        <span
                          style={{ color: "blue", cursor: "pointer", textDecoration: "underline" }}
                          onClick={() =>
                            window.open(getUploadedImageUrl(trip.readingToImagePath), "_blank")
                          }
                        >
                          {trip.readingTo}
                        </span>
                      ) : (
                        trip.readingTo
                      )}
                      {" "}({trip.distance} Km)
                    </p>
                    {(trip.readingFromUploadedOn || trip.readingToUploadedOn) && (
                      <p className="upload-time-note" style={{ fontSize: "11px", color: "#64748b", margin: "-6px 0 8px" }}>
                        {trip.readingFromUploadedOn && (
                          <>Reading From uploaded {formatUploadedOn(trip.readingFromUploadedOn)}</>
                        )}
                        {trip.readingFromUploadedOn && trip.readingToUploadedOn && " · "}
                        {trip.readingToUploadedOn && (
                          <>Reading To uploaded {formatUploadedOn(trip.readingToUploadedOn)}</>
                        )}
                      </p>
                    )}

                    {trip.fuelAmount ? (
                      <p>
                        <b>Fuel:</b>{" "}
                        {trip.fuelImagePath ? (
                          <span
                            style={{ color: "blue", cursor: "pointer", textDecoration: "underline" }}
                            onClick={() =>
                              window.open(getUploadedImageUrl(trip.fuelImagePath), "_blank")
                            }
                          >
                            ₹{trip.fuelAmount}
                          </span>
                        ) : (
                          `₹${trip.fuelAmount}`
                        )}
                      </p>
                    ) : null}
                  </div>
                  )}

                  {isDayExpanded && (trip.visits || []).map((visit: any, vIndex: number) => (
                    <div key={vIndex} className="visit-card">

                      <div className="visit-card-grid">
                      <p>
                        <b>Client:</b>{" "}
                        {visit.visit_ImagePath ? (
                          <span
                            style={{ color: "blue", cursor: "pointer", textDecoration: "underline" }}
                            onClick={() =>
                              window.open(getUploadedImageUrl(visit.visit_ImagePath), "_blank")
                            }
                          >
                            {visit.client_Name}
                          </span>
                        ) : (
                          visit.client_Name
                        )}
                      </p>

                      {visit.visit_ImagePathUploadedOn && (
                        <p className="upload-time-note" style={{ fontSize: "11px", color: "#64748b", margin: "-6px 0 8px" }}>
                          Client slip uploaded {formatUploadedOn(visit.visit_ImagePathUploadedOn)}
                        </p>
                      )}

                      <p>
                        <b>Location:</b>{" "}
                        {visit.latitude && visit.longitude ? (
                          <span
                            style={{ color: "blue", cursor: "pointer", textDecoration: "underline" }}
                            onClick={() =>
                              window.open(
                                `https://www.google.com/maps?q=${visit.latitude},${visit.longitude}`
                              )
                            }
                          >
                            {visit.location || "View Map"}
                          </span>
                        ) : (
                          visit.location
                        )}
                      </p>

                      <p>
                        <b>Time:</b> {visit.visit_FromTime} → {visit.visit_ToTime}
                      </p>

                      {visit.projects && (
                        <p>
                          <b>Demo Project:</b>{" "}
                          {String(visit.projects)
                            .split(",")
                            .map((p: string) => p.trim())
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}

                      {visit.empCodes && (
                        <p>
                          <b>Employees:</b>{" "}
                          {(() => {
                            const codes = String(visit.empCodes)
                              .split(",")
                              .map((c: string) => c.trim())
                              .filter(Boolean);
                            if (codes.length === 0) return "-";
                            const names = parseEmpNames(selectedDuty?.empNames)
                              .filter((e: any) => codes.includes(e.code))
                              .map((e: any) => e.name);
                            return names.length > 0 ? names.join(", ") : codes.join(", ");
                          })()}
                        </p>
                      )}

                      {(visit.contact_Person || visit.mobile_Number) && (
                        <p>
                          <b>Contact:</b> {visit.contact_Person}
                          {visit.mobile_Number ? ` (${visit.mobile_Number})` : ""}
                        </p>
                      )}

                      <p>
                        <b>Remarks:</b> {visit.remarks}
                      </p>

                      {visit.localTransportImagePath && (
                        <p>
                          <b>Local Transport:</b>{" "}
                          <span
                            style={{ color: "blue", cursor: "pointer", textDecoration: "underline" }}
                            onClick={() =>
                              window.open(getUploadedImageUrl(visit.localTransportImagePath), "_blank")
                            }
                          >
                            {visit.localTransportAmount ? `₹${visit.localTransportAmount}` : "View"}
                          </span>
                        </p>
                      )}
                      </div>

                    </div>
                  ))}
                </div>
                );
              })}

            </div>
          </div>
        </div>
      )}

      <DaTaSettlementModal
        isOpen={!!dataDutyId}
        dutyId={dataDutyId}
        canViewAll={dataCanViewAll}
        onClose={() => setDataDutyId(null)}
      />

      {editOtModal && (
        <div className="modal-overlay">
          <div className="modal-container">

            <div className="modal-header">
              <h3>Edit Overtime</h3>

              <button onClick={() => setEditOtModal(false)}>
                ✖
              </button>
            </div>

            <div className="modal-body">

              <div className="form-group">
                <label>From Time</label>

                <input
                  type="time"
                  value={editOT.fromtime}
                  onChange={(e) =>
                    setEditOT({
                      ...editOT,
                      fromtime: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>To Time</label>

                <input
                  type="time"
                  value={editOT.totime}
                  onChange={(e) =>
                    setEditOT({
                      ...editOT,
                      totime: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>Description</label>

                <textarea
                  value={editOT.description}
                  onChange={(e) =>
                    setEditOT({
                      ...editOT,
                      description: e.target.value,
                    })
                  }
                />
              </div>

              <button
                className="lr-action-btn approve"
                onClick={saveEditedOvertime}
              >
                Save Changes
              </button>

            </div>
          </div>
        </div>
      )}
      {permissionModal && (
        <div className="modal-overlay center-modal">

          <div className="permission-modal-container">

            <div className="modal-header">
              <h3>Permission Dashboard</h3>

              <button
                onClick={() => setPermissionModal(false)}
              >
                ✖
              </button>
            </div>

            <div className="modal-body">
              <div className="team-permission-grid">

                {permissionData.map((x: any, idx: number) => {

                  // const usedPercent =
                  //   Number(x.usedPercent || 0);
                  const totalMinutes =
                    Number(x.totalAvailableMin || 0);

                  const usedMinutes =
                    Number(x.usedMin || 0);

                  const usedPercent =
                    totalMinutes > 0
                      ? (usedMinutes / totalMinutes) * 100
                      : 0;

                  const rowClass =
                    usedPercent >= 100
                      ? "danger-row"
                      : usedPercent >= 70
                        ? "warning-row"
                        : usedPercent >= 40
                          ? "medium-row"
                          : "safe-row";

                  return (
                    <div
                      key={idx}
                      className={`team-permission-card ${rowClass}`}
                    >

                      <div className="team-card-left">

                        <div className="team-avatar">
                          {x.empName?.charAt(0)}
                        </div>

                        <div>
                          <div className="team-name">
                            {x.empName}
                          </div>

                          <div className="team-code">
                            EMP ID : {x.empCode}
                          </div>
                        </div>

                      </div>

                      <div className="team-card-right">

                        <div className="team-stat">
                          <span>Total</span>
                          <strong>
                            {x.totalAvailableDisplay}
                          </strong>
                        </div>

                        <div className="team-stat">
                          <span>Used</span>
                          <strong>
                            {x.usedDisplay}
                          </strong>
                        </div>

                        <div className="team-stat">
                          <span>Balance</span>
                          <strong>
                            {x.balanceDisplay}
                          </strong>
                        </div>

                        <div className="team-stat">
                          <span>OT Earned</span>
                          <strong>
                            {x.earnedOTMin}m
                          </strong>
                        </div>

                      </div>

                      <div className="team-progress-section">

                        <div className="team-progress-top">
                          <span>Usage</span>

                          <span>
                            {usedPercent.toFixed(0)}%
                          </span>
                        </div>

                        <div className="team-progress-bar">
                          <div
                            className="team-progress-fill"
                            style={{
                              width: `${Math.min(
                                usedPercent,
                                100
                              )}%`,
                            }}
                          />
                        </div>

                      </div>

                    </div>
                  );
                })}
              </div>


            </div>

          </div>

        </div>
      )}
      {!loading && finalData.length === 0 && <p>No data found</p>}
    </div>
  );
};

export default RequestList;