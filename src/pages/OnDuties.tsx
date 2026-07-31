// src/pages/OnDuties.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { addOutline } from "ionicons/icons";
import {
  IonPage,
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
  IonDatetimeButton,
  IonToast,
  IonTextarea,
  IonSegment,
  IonSegmentButton,
} from "@ionic/react";
import {
  calendarOutline,
  businessOutline,
  timeOutline,
  pencilOutline,
  personCircleOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  locationOutline,
  peopleOutline,
  carOutline,
  documentTextOutline,
  refreshOutline,
} from "ionicons/icons";
import axios from "axios";
import "./OnDuties.css";
import "../components/requests/RequestList.css";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X, Check } from "lucide-react";
import moment from "moment";
import { API_BASE } from "../config";
import { useHistory } from "react-router-dom";

type ClientItem = { Client_ID: string; Client_Name: string };

type EmployeeItem = {
  EmpCode: string;
  EmpName?: string;
  Mobile?: string;
  Role?: string;
  Designation?: string;
  Ischeck?: string | boolean;
  RequestTo?: string;
};

type DutyRow = {
  id: string;

  Date?: string;
  DateFrom?: string;
  DateTo?: string;

  College: string;
  Description: string;
  empNames?: string;
  Mode_of_Trans: string;

  Start_Time?: string;
  End_Time?: string;
  Vehicle_No?: string;
  Start_Reading?: string;
  End_Reading?: string;
  Kms?: string;

  Status?: string;
  EmpCodes?: string;
  Location?: string;

  // Multi-level approval matrix (from load_duties_full / load_my_duties).
  // Semantics assumed: CurrentLevel/MaxLevel track how far the request has
  // progressed through RA1..RA4; CurrentRA names whoever's turn it is next;
  // RA{n}_Status is that level's own decision (Approved/Rejected/Pending).
  CurrentLevel?: string;
  MaxLevel?: string;
  CurrentRA?: string;
  MatrixType?: string;
  RA1?: string;
  RA2?: string;
  RA3?: string;
  RA4?: string;
  RA1_Status?: string;
  RA2_Status?: string;
  RA3_Status?: string;
  RA4_Status?: string;

  // true = the logged-in user's own submitted duty; false = a team member's
  // duty loaded in because the user can approve it. Used to split the list
  // into "My Requests" / "Team Requests" sections.
  isOwn?: boolean;

  dayTrips?: TripDayItem[];
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

type VisitItem = {
  visit_Id?: number;
  partyName: string;
  location: string;
  latitude?: string;
  longitude?: string;
  demoProjects: string[];
  contactPerson: string;
  mobile: string;
  visitFromTime: string;
  visitToTime: string;
  localTransportAmount?: string;
  localTransportImage?: File | string | null;
  visitSlipImage: File | string | null;
  remarks: string,
};
type TripDayItem = {
  dayTrip_Id?: number;
  dutyDate: string;
  readingFrom: string;
  readingTo: string;
  readingFromImage: File | string | null;
  readingToImage: File | string | null;

  distance: string;
  fuelAmount: string;
  fuelImage: File | string | null;
  visits: VisitItem[];
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

const generateDaysBetween = (from?: string, to?: string) => {
  if (!from || !to) return [];
  const start = moment(from);
  const end = moment(to);
  const days: string[] = [];
  const current = start.clone();

  while (current.isSameOrBefore(end, "day")) {
    days.push(current.format("YYYY-MM-DD"));
    current.add(1, "day");
  }

  return days;
};

const ymdToDdMmYy = (ymd: string) => {
  if (!ymd) return "";
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
  const diff = (end.getTime() - start.getTime()) / 60000;
  return diff < 0 ? 0 : Math.floor(diff);
};

const asBool = (v: any) =>
  typeof v === "string" ? v.toLowerCase() === "true" : !!v;

const fmtDate = (val?: string) => {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return moment(d).format("DD-MM-YYYY HH:mm");
};

// Combines a date value with a separately-fetched HH:mm(:ss) time value
// (e.g. Start_Time/End_Time from the db) so the Timeline display reflects
// the actual logged time rather than whatever midnight/placeholder time
// may be embedded in DateFrom/DateTo. Falls back to fmtDate(dateVal) when
// no usable time value is available.
const fmtDateWithTime = (dateVal?: string, timeVal?: string) => {
  if (!dateVal) return "";
  const datePart = moment(dateVal).isValid()
    ? moment(dateVal).format("YYYY-MM-DD")
    : String(dateVal).split("T")[0];
  const t = (timeVal || "").trim();
  const timeMatch = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (datePart && timeMatch) {
    const hh = timeMatch[1].padStart(2, "0");
    const mm = timeMatch[2];
    const combined = moment(`${datePart} ${hh}:${mm}`, "YYYY-MM-DD HH:mm");
    if (combined.isValid()) return combined.format("DD-MM-YYYY HH:mm");
  }
  return fmtDate(dateVal);
};

// defaultFromTime pre-fills Visit From Time with the On Duty's own applied
// Timeline start (Start_Time, fetched from the db) so a new visit already
// shows the right time instead of opening the picker at 00:00 and forcing
// the user to roll the wheel all the way up to find it.
const emptyVisit = (defaultFromTime: string = ""): VisitItem => ({
  partyName: "",
  location: "",
  latitude: "",
  longitude: "",
  demoProjects: [],
  contactPerson: "",
  mobile: "",
  visitFromTime: defaultFromTime,
  visitToTime: "",

  localTransportAmount: "",
  localTransportImage: null,

  visitSlipImage: null,
  remarks: "",
});
const emptyTripDay = (date: string, defaultVisitFromTime: string = ""): TripDayItem => ({
  dutyDate: date,
  readingFrom: "",
  readingTo: "",
  readingFromImage: null,
  readingToImage: null,
  distance: "",
  fuelAmount: "",
  fuelImage: null,
  visits: [emptyVisit(defaultVisitFromTime)],
});

type OnDutiesProps = {
  // Passed down from the Requests page's All/Pending/Accepted/Rejected
  // filter bar when this component is embedded there for the "My
  // Requests" view - that filter bar previously had no effect here at all.
  statusFilter?: string;
};

const OnDuties: React.FC<OnDutiesProps> = ({ statusFilter }) => {
  const [empCode, setEmpCode] = useState<string>("");
  const [empName, setEmpName] = useState<string>("");
  const [userDesig, setUserDesig] = useState<string>("");
  const [userLoaded, setUserLoaded] = useState<boolean>(false);
  const didInitRef = useRef(false);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const modalContentRef = useRef<HTMLIonContentElement>(null);
  const savedScrollTop = useRef<number>(0);

  const saveModalScroll = async () => {
    if (modalContentRef.current) {
      try {
        const el = await modalContentRef.current.getScrollElement();
        savedScrollTop.current = el.scrollTop;
      } catch (e) {
        console.warn("Failed to get scroll elementS:", e);
      }
    }
  };

  const restoreModalScroll = () => {
    if (modalContentRef.current && savedScrollTop.current > 0) {
      const currentScroll = savedScrollTop.current;
      setTimeout(async () => {
        try {
          if (modalContentRef.current) {
            await modalContentRef.current.scrollToPoint(0, currentScroll, 0);
          }
        } catch (e) {
          console.warn("Failed to restore scroll (50ms):", e);
        }
      }, 50);

      setTimeout(async () => {
        try {
          if (modalContentRef.current) {
            await modalContentRef.current.scrollToPoint(0, currentScroll, 0);
          }
        } catch (e) {
          console.warn("Failed to restore scroll (150ms):", e);
        }
      }, 150);
    }
  };


  const api = useMemo(() => {
    return axios.create({ baseURL: API_BASE});
  }, []);

  const isAccountant = empCode === "1541";
  const isDirector = empCode === "1501";
  const canEdit = isAccountant || isDirector;
  const canApprove =
    isAccountant ||
    userDesig.includes("Team Leader") ||
    userDesig.includes("Manager");

  const [dateModalType, setDateModalType] = useState<"from" | "to" | null>(null);
  const [visitTimeModal, setVisitTimeModal] = useState<{ visitIndex: number; field: "visitFromTime" | "visitToTime" } | null>(null);


  const [institution, setInstitution] = useState<string>("");
  const [dutiesDesc, setDutiesDesc] = useState<string>("");
  const [transportMode, setTransportMode] = useState<string>("");
  const [kms, setKms] = useState<string>("");
  const [vehicleNo, setVehicleNo] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [sReading, setSReading] = useState<string>("");
  const [eReading, setEReading] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [team, setTeam] = useState<EmployeeItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [dutiesList, setDutiesList] = useState<DutyRow[]>([]);
  const [editingId, setEditingId] = useState<string>("");
  const [tripDaysByDuty, setTripDaysByDuty] = useState<Record<string, TripDayItem[]>>({});
  const [showDayTripModal, setShowDayTripModal] = useState(false);
  const [editingTripIndex, setEditingTripIndex] = useState<number | null>(null);
  const [selectedDutyRow, setSelectedDutyRow] = useState<DutyRow | null>(null);
  const [selectedDutyId, setSelectedDutyId] = useState<string>("");
  const [toast, setToast] = useState<{ msg: string; color?: string } | null>(null);
  const [expandedTrips, setExpandedTrips] = useState<Record<string, boolean>>({});
  const [activeDutyTab, setActiveDutyTab] = useState<"my" | "team">("my");

// The device/browser's own system timezone can't be trusted to be IST (dev
// machines and emulators are frequently left on UTC), and this app's camp
// scheduling is always meant in IST regardless of the device - so "now" is
// always computed as the true current instant re-expressed with a fixed
// +05:30 offset, never via plain `new Date()`/`moment()` (which silently
// follow whatever timezone the OS happens to be set to).
const IST_OFFSET_MIN = 330; // +05:30, no DST in India
const nowIST = () => moment().utcOffset(IST_OFFSET_MIN);
// Re-expresses an already-correct stored instant in the IST offset context,
// so "same day"/hour/minute reads use IST's calendar boundaries rather than
// whatever offset moment would otherwise default to when parsing the string.
const toIST = (val: string) => moment(val).utcOffset(IST_OFFSET_MIN);

const today = nowIST().format("YYYY-MM-DD");

const [unlockRange, setUnlockRange] = useState({
  approved: false,
  fromDate: "",
  toDate: ""
});



const [dutyFromDate, setDutyFromDate] = useState<string>(nowIST().toISOString(true));
const [dutyToDate, setDutyToDate] = useState<string | null>(null);


const maxDateObj = new Date(dutyFromDate || today);
maxDateObj.setDate(maxDateObj.getDate() + 6);
const maxDate = maxDateObj.toISOString().split("T")[0];
const [tripModalMode, setTripModalMode] =
  useState<"add" | "edit">("add");

  

const [fromModal, setFromModal] = useState(false);
const [toModal, setToModal] = useState(false);

// custom dropdown states
const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);
const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
const [isTransportDropdownOpen, setIsTransportDropdownOpen] = useState(false);

const [teamSearchTerm, setTeamSearchTerm] = useState("");
const [clientSearchTerm, setClientSearchTerm] = useState("");

const [teamDropdownPos, setTeamDropdownPos] = useState({ top: 0, left: 0, width: 0 });
const [clientDropdownPos, setClientDropdownPos] = useState({ top: 0, left: 0, width: 0 });
const [transportDropdownPos, setTransportDropdownPos] = useState({ top: 0, left: 0, width: 0 });

const teamTriggerRef = useRef<HTMLDivElement>(null);
const clientTriggerRef = useRef<HTMLDivElement>(null);
const transportTriggerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const updateDropdownPositions = () => {
    if (isTeamDropdownOpen && teamTriggerRef.current) {
      const rect = teamTriggerRef.current.getBoundingClientRect();
      setTeamDropdownPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
    }
    if (isClientDropdownOpen && clientTriggerRef.current) {
      const rect = clientTriggerRef.current.getBoundingClientRect();
      setClientDropdownPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
    }
    if (isTransportDropdownOpen && transportTriggerRef.current) {
      const rect = transportTriggerRef.current.getBoundingClientRect();
      setTransportDropdownPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
    }
  };

  window.addEventListener('resize', updateDropdownPositions);
  const container = contentRef.current;
  if (container) {
    container.addEventListener('scroll', updateDropdownPositions);
  }
  updateDropdownPositions();

  return () => {
    window.removeEventListener('resize', updateDropdownPositions);
    if (container) container.removeEventListener('scroll', updateDropdownPositions);
  };
}, [isTeamDropdownOpen, isClientDropdownOpen, isTransportDropdownOpen]);

const loadUnlockRange = async () => {
  const res = await fetch(
    `${API_BASE}ApprovalRequest/GetApprovedUnlockRequest?empCode=${empCode}&requestType=On%20Duty`
  );

  const data = await res.json();

  setUnlockRange(data);
};
useEffect(() => {
  if (!empCode) return;

  loadUnlockRange();
}, [empCode]);

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


  const getTripDatesForDuty = (row: DutyRow) => {
    const fromDate = row.DateFrom
      ? moment(row.DateFrom).format("YYYY-MM-DD")
      : row.Date
        ? moment(row.Date).format("YYYY-MM-DD")
        : "";

    const toDate = row.DateTo
      ? moment(row.DateTo).format("YYYY-MM-DD")
      : fromDate;

    return generateDaysBetween(fromDate, toDate);
  };

  // A duty must have cleared at least ONE approval stage (any RA slot
  // "Approved", or an overall approved/ongoing status) before day trips can
  // be logged against it - a freshly-submitted, fully-pending request
  // shouldn't accumulate trip data that might never be sanctioned.
  const hasAnyApproval = (row: DutyRow) => {
    const approved = (s?: string) =>
      String(s || "").trim().toLowerCase() === "approved";
    if (
      approved(row.RA1_Status) ||
      approved(row.RA2_Status) ||
      approved(row.RA3_Status) ||
      approved(row.RA4_Status)
    )
      return true;
    return String(row.Status || "").toLowerCase().includes("approved");
  };

  // Stricter gate for visit entries (+ Add Party): the request must have
  // cleared EVERY real approval slot ("-" / empty slots don't count as
  // pending), or carry an overall "Approved" status. One-stage approval is
  // enough to open a duty day and log the journey-start reading, but the
  // actual client visits shouldn't be recorded until the request is fully
  // sanctioned.
  const isFullyApproved = (row?: DutyRow | null) => {
    if (!row) return false;
    const approved = (s?: string) =>
      String(s || "").trim().toLowerCase() === "approved";
    const realSlots = [
      [row.RA1, row.RA1_Status],
      [row.RA2, row.RA2_Status],
      [row.RA3, row.RA3_Status],
      [row.RA4, row.RA4_Status],
    ].filter(([ra]) => {
      const v = String(ra || "").trim();
      return v !== "" && v !== "-";
    });
    if (realSlots.length > 0 && realSlots.every(([, st]) => approved(st as string)))
      return true;
    return String(row.Status || "").trim().toLowerCase() === "approved";
  };

  const openAddDayTripModal = (row: DutyRow) => {
  setTripModalMode("add");

  const allTripDates = getTripDatesForDuty(row);

  const normalize = (d: string) =>
    d ? new Date(d).toISOString().split("T")[0] : "";

  const currentTrips = tripDaysByDuty[row.id] || [];

  const existingDates = currentTrips.map((x) =>
    normalize(x.dutyDate)
  );

  const nextDate = allTripDates.find(
    (d) => !existingDates.includes(normalize(d))
  );

  if (!nextDate) {
    notify("All day trips already added", "warning");
    return;
  }

  // Note: adding a duty day for a FUTURE date is deliberately allowed - an
  // employee may start the journey the evening before the camp day and needs
  // to record the vehicle's start reading then. Only VISIT entries stay
  // blocked on future dates (see + Add Party / addTripVisit / edit-mode save
  // guards).
  const defaultVisitFromTime = row.Start_Time ? String(row.Start_Time).slice(0, 5) : "";
  const newTrip = emptyTripDay(normalize(nextDate), defaultVisitFromTime);

  const newIndex = currentTrips.length;

  setTripDaysByDuty((prev) => ({
    ...prev,
    [row.id]: [...(prev[row.id] || []), newTrip],
  }));

  setSelectedDutyRow(row);
  setSelectedDutyId(row.id);
  setEditingTripIndex(newIndex);
  setShowDayTripModal(true);
};

  const openEditDayTripModal = (
  row: DutyRow,
  index: number
) => {
  setTripModalMode("edit");

  setSelectedDutyRow(row);
  setSelectedDutyId(row.id);
  setEditingTripIndex(index);
  setShowDayTripModal(true);
};

  const closeDayTripModal = () => {
    setShowDayTripModal(false);
    setEditingTripIndex(null);
  };
  const updateTripDay = (index: number, key: keyof TripDayItem, value: any) => {
    if (!selectedDutyId) return;

    setTripDaysByDuty((prev) => {
      const current = [...(prev[selectedDutyId] || [])];
      current[index] = {
        ...current[index],
        [key]: value,
      };
      return {
        ...prev,
        [selectedDutyId]: current,
      };
    });
  };
  const autoFillDistance = (tripIndex: number, fromVal: string, toVal: string) => {
    const fromNum = parseFloat(fromVal || "0");
    const toNum = parseFloat(toVal || "0");

    if (fromVal === "" || toVal === "") {
      updateTripDay(tripIndex, "distance", "");
      return;
    }

    if (isNaN(fromNum) || isNaN(toNum)) return;

    if (toNum < fromNum) {
      notify("Reading To should be greater than or equal to Reading From", "warning");
      return;
    }

    const distance = Math.round((toNum - fromNum) * 100) / 100;
    updateTripDay(tripIndex, "distance", String(distance));
  };
  const updateTripVisit = (
    tripIndex: number,
    visitIndex: number,
    key: keyof VisitItem,
    value: any
  ) => {
    if (!selectedDutyId) return;

    setTripDaysByDuty((prev) => {
      const current = [...(prev[selectedDutyId] || [])];
      current[tripIndex].visits[visitIndex] = {
        ...current[tripIndex].visits[visitIndex],
        [key]: value,
      };
      return {
        ...prev,
        [selectedDutyId]: current,
      };
    });
  };
  const mapTripRow = (r: any) => {
    if (Array.isArray(r)) {
      return {
        DayTrip_ID: r[0],
        Duty_Id: r[1],
        Duty_Date: r[2],
        Reading_From: r[3],
        Reading_To: r[4],
        Distance: r[5],
        Fuel_Amount: r[6],
        ReadingFrom_ImagePath: r[7],
        ReadingTo_ImagePath: r[8],
        Fuel_ImagePath: r[9],
        Visit_ID: r[10],
        Client_Name: r[11],
        VisitLocation: r[12],
        Latitude: r[13],
        Longitude: r[14],
        Visit_FromTime: r[15],
        Visit_ToTime: r[16],
        Projects: r[17],
        Contact_Person: r[18],
        Mobile_Number: r[19],
        Remarks: r[20],
        LocalTransportAmount: r[21],
        LocalTransportImagePath: r[22],
        Visit_ImagePath: r[23],
      };
    }

    return r;
  };

  const buildTripsFromRows = (rows: any[]): TripDayItem[] => {
    const grouped: Record<number, TripDayItem> = {};

    rows.forEach((raw: any) => {
      const r = mapTripRow(raw);

      const id = Number(r.DayTrip_ID ?? r.DayTrip_Id ?? r.dayTrip_Id ?? 0);
      if (!id) return;

      if (!grouped[id]) {
        grouped[id] = {
          dayTrip_Id: id,
          dutyDate: moment(r.Duty_Date ?? r.duty_Date).format("YYYY-MM-DD"),
          readingFrom: String(r.Reading_From ?? ""),
          readingTo: String(r.Reading_To ?? ""),
          distance: String(r.Distance ?? "0"),
          fuelAmount: String(r.Fuel_Amount ?? ""),
          readingFromImage: r.ReadingFrom_ImagePath || null,
          readingToImage: r.ReadingTo_ImagePath || null,
          fuelImage: r.Fuel_ImagePath || null,
          visits: [],
        };
      }

      const visitId = Number(r.Visit_ID ?? 0);
      if (visitId) {
        grouped[id].visits.push({
          visit_Id: visitId,
          partyName: r.Client_Name || "",
          location: r.VisitLocation || "",
          latitude: r.Latitude || "",
          longitude: r.Longitude || "",
          demoProjects: r.Projects ? String(r.Projects).split(",") : [],
          contactPerson: r.Contact_Person || "",
          mobile: r.Mobile_Number || "",
          visitFromTime: r.Visit_FromTime || "",
          visitToTime: r.Visit_ToTime || "",
          remarks: r.Remarks || "",
          localTransportAmount:
            r.LocalTransportAmount != null ? String(r.LocalTransportAmount) : "",
          visitSlipImage: r.Visit_ImagePath || null,
          localTransportImage: r.LocalTransportImagePath || null,
        });
      }
    });

    return Object.values(grouped);
  };
  const addTripVisit = (tripIndex: number) => {
    if (!selectedDutyId) return;

    // Visit entries require FULL approval (one-stage approval only unlocks
    // the duty day / journey-start reading, not client visits).
    if (!isFullyApproved(selectedDutyRow)) {
      notify(
        "Visit entries can be added only after the request is fully approved",
        "warning"
      );
      return;
    }

    // No visit entries for a date that hasn't arrived yet (IST) - mirrors
    // the same guard in openAddDayTripModal/saveDayTripModal.
    const targetTripDate = (tripDaysByDuty[selectedDutyId] || [])[tripIndex]?.dutyDate;
    if (
      targetTripDate &&
      String(targetTripDate).slice(0, 10) > nowIST().format("YYYY-MM-DD")
    ) {
      notify("Visit entries are not allowed for future dates", "warning");
      return;
    }

    const campStartFallback = selectedDutyRow?.Start_Time
      ? String(selectedDutyRow.Start_Time).slice(0, 5)
      : "";

    setTripDaysByDuty((prev) => {
      const currentTrips = [...(prev[selectedDutyId] || [])];
      const targetTrip = currentTrips[tripIndex];

      if (!targetTrip) return prev;

      // Chain the new visit's From Time to start right where the last
      // already-saved visit's To Time left off (searching backwards for the
      // nearest visit that actually has a To Time set), instead of
      // defaulting to the camp's own start time every time - avoids the new
      // visit opening pre-filled with a time that already overlaps an
      // existing one.
      let defaultVisitFromTime = campStartFallback;
      for (let i = targetTrip.visits.length - 1; i >= 0; i--) {
        if (targetTrip.visits[i]?.visitToTime) {
          // Saved visits carry HH:mm:ss - normalize to HH:mm so downstream
          // picker min/max ISO templates stay valid.
          defaultVisitFromTime = String(targetTrip.visits[i].visitToTime).slice(0, 5);
          break;
        }
      }

      currentTrips[tripIndex] = {
        ...targetTrip,
        visits: [...targetTrip.visits, emptyVisit(defaultVisitFromTime)],
      };

      return {
        ...prev,
        [selectedDutyId]: currentTrips,
      };
    });
  };



  const loadDayTrips = async (dutyId: string) => {
    try {
      const res = await api.get("OnDuty/get_daytrips", {
        params: { dutyId },
      });

      const rows =
        typeof res.data === "string" ? JSON.parse(res.data) : res.data;

      const trips = buildTripsFromRows(Array.isArray(rows) ? rows : []);

      setTripDaysByDuty((prev) => ({
        ...prev,
        [dutyId]: trips,
      }));
      return true;
    } catch (error) {
      console.error("loadDayTrips error:", error);
      notify("Failed to load day trips", "danger");
      return false;
    }
  };

  // Tracks which duty's day-trip list is currently being re-fetched via the
  // Refresh link, so the link can show a disabled/loading state and ignore
  // repeat clicks while a request is in flight.
  const [refreshingTripsDutyId, setRefreshingTripsDutyId] = useState<string | null>(null);
  const refreshDayTrips = async (dutyId: string) => {
    if (refreshingTripsDutyId) return;
    setRefreshingTripsDutyId(dutyId);
    try {
      const ok = await loadDayTrips(dutyId);
      if (ok) notify("Duty days refreshed", "success");
    } finally {
      setRefreshingTripsDutyId(null);
    }
  };

  const isSavingTrip = useRef(false);

  const saveDayTripModal = async () => {
    if (isSavingTrip.current) return;
    isSavingTrip.current = true;
    if (
      !selectedDutyId ||
      editingTripIndex === null ||
      editingTripIndex === undefined
    ) {
      notify("Invalid trip state", "warning");
      isSavingTrip.current = false;
      return;
    }

    const trips = tripDaysByDuty[selectedDutyId] || [];
    const trip =
      editingTripIndex != null &&
      editingTripIndex >= 0 &&
      editingTripIndex < trips.length
        ? trips[editingTripIndex]
        : null;

    if (!trip) {
      notify("Trip data missing", "danger");
      isSavingTrip.current = false;
      return;
    }

    // Saving a future-dated day trip is allowed only in ADD mode (recording
    // the vehicle's start reading before the journey day begins). VISIT
    // entries (edit mode) stay blocked until the date actually arrives.
    if (
      tripModalMode === "edit" &&
      trip.dutyDate &&
      String(trip.dutyDate).slice(0, 10) > nowIST().format("YYYY-MM-DD")
    ) {
      notify("Visit entries are not allowed for future dates", "warning");
      isSavingTrip.current = false;
      return;
    }

    // ===== VALIDATION =====

    // Public Transport → only distance required
    if (isPublicTransport) {
      if (!trip.distance || Number(trip.distance) <= 0) {
        notify("Distance is required for Public Transport", "warning");
        isSavingTrip.current = false;
        return;
      }
    }

    // Office / Own Vehicle → reading required
    if (!isPublicTransport) {
      if (
        !trip.readingFrom ||
        !trip.readingFromImage
      ) {
        notify("Reading values and images are required", "warning");
        isSavingTrip.current = false;
        return;
      }
    }

    // At least one visit required (Only in EDIT mode)
    if (tripModalMode === "edit") {
      if (!trip.visits || !trip.visits.length) {
        notify("At least one visit required", "warning");
        isSavingTrip.current = false;
        return;
      }

      // Visit From Time must not be earlier than the On Duty's own applied
      // Timeline start (selectedDutyRow.Start_Time, fetched from the db -
      // see the mapDutyRows/backend fix). Visit To Time has no Timeline
      // ceiling - it only needs to be at/after that SAME visit's own From
      // Time (a visit can legitimately run past the On Duty's nominal end).
      // Skip gracefully if Start_Time isn't available (older duties saved
      // before this field existed).
      const campStart = selectedDutyRow?.Start_Time
        ? moment(selectedDutyRow.Start_Time, ["HH:mm:ss", "HH:mm"])
        : null;
      if (campStart && campStart.isValid()) {
        const earlyVisit = trip.visits.find((v) => {
          if (!v.visitFromTime) return false;
          const vTime = moment(v.visitFromTime, ["HH:mm:ss", "HH:mm"]);
          return vTime.isValid() && vTime.isBefore(campStart);
        });
        if (earlyVisit) {
          notify(
            `Visit From Time must be ${campStart.format("HH:mm")} or later (On Duty start time)`,
            "warning"
          );
          isSavingTrip.current = false;
          return;
        }
      }

      const backwardsVisit = trip.visits.find((v) => {
        if (!v.visitFromTime || !v.visitToTime) return false;
        const fromTime = moment(v.visitFromTime, ["HH:mm:ss", "HH:mm"]);
        const toTime = moment(v.visitToTime, ["HH:mm:ss", "HH:mm"]);
        return fromTime.isValid() && toTime.isValid() && toTime.isBefore(fromTime);
      });
      if (backwardsVisit) {
        notify("Visit To Time must be at or after Visit From Time", "warning");
        isSavingTrip.current = false;
        return;
      }

      // Visit To Time can't be later than the current real-world time when
      // this day trip's date is today - you can't log a visit that hasn't
      // happened yet. Past-dated day trips have no such cap. Compare as
      // plain HH:mm (both sides parsed the same way, no real date attached)
      // rather than against a live nowIST() moment directly, to avoid the
      // system-timezone-vs-IST mismatch bug documented elsewhere in this
      // file (moment(str, "HH:mm") anchors to the parser's own "today",
      // which could differ from IST's today if compared against a real
      // datetime moment).
      if (trip.dutyDate === nowIST().format("YYYY-MM-DD")) {
        const nowTimeOnly = moment(nowIST().format("HH:mm"), ["HH:mm"]);
        const futureVisit = trip.visits.find((v) => {
          if (!v.visitToTime) return false;
          const toTime = moment(v.visitToTime, ["HH:mm:ss", "HH:mm"]);
          return toTime.isValid() && toTime.isAfter(nowTimeOnly);
        });
        if (futureVisit) {
          notify(
            `Visit To Time must be ${nowIST().format("HH:mm")} or earlier (current time)`,
            "warning"
          );
          isSavingTrip.current = false;
          return;
        }
      }

      // Safety net: no two visits on the same day trip may have overlapping
      // [From, To] time ranges, regardless of how they were entered (the
      // picker already discourages this via adjacent-visit min/max bounds,
      // but this catches anything that slips through - e.g. a visit edited
      // out of its original chronological position).
      const parseRange = (v: (typeof trip.visits)[number]) => {
        if (!v.visitFromTime || !v.visitToTime) return null;
        const from = moment(v.visitFromTime, ["HH:mm:ss", "HH:mm"]);
        const to = moment(v.visitToTime, ["HH:mm:ss", "HH:mm"]);
        if (!from.isValid() || !to.isValid()) return null;
        return { from, to };
      };
      let overlapFound = false;
      for (let i = 0; i < trip.visits.length && !overlapFound; i++) {
        const rangeA = parseRange(trip.visits[i]);
        if (!rangeA) continue;
        for (let j = i + 1; j < trip.visits.length; j++) {
          const rangeB = parseRange(trip.visits[j]);
          if (!rangeB) continue;
          if (rangeA.from.isBefore(rangeB.to) && rangeB.from.isBefore(rangeA.to)) {
            overlapFound = true;
            break;
          }
        }
      }
      if (overlapFound) {
        notify("Visit times must not overlap with another visit on the same day", "warning");
        isSavingTrip.current = false;
        return;
      }
    }

    const formData = new FormData();

    formData.append("duty_Id", selectedDutyId);
    formData.append("duty_Date", trip.dutyDate);

    // Transport based data handling
    if (isPublicTransport) {
      // Public Transport
      formData.append("reading_From", "0");
      formData.append("reading_To", "0");
      formData.append("distance", trip.distance || "0");
      formData.append("fuel_Amount", "0");
    } else {
      // Office / Own Vehicle
      formData.append("reading_From", trip.readingFrom || "0");
      formData.append("reading_To", trip.readingTo || "0");
      formData.append("distance", trip.distance || "0");

      // Fuel only for Office vehicle
      if (isOfficeVehicle) {
        formData.append("fuel_Amount", trip.fuelAmount || "0");
      } else {
        formData.append("fuel_Amount", "0");
      }
    }
    formData.append("created_By", empCode);

    // images 
    if (!isPublicTransport) {
      if (trip.readingFromImage instanceof File) {
        formData.append("ReadingFrom_Image", trip.readingFromImage);
      } else if (typeof trip.readingFromImage === "string" && trip.readingFromImage.trim() !== "") {
        formData.append("ReadingFrom_ImagePath", trip.readingFromImage);
      }

      if (trip.readingToImage instanceof File) {
        formData.append("ReadingTo_Image", trip.readingToImage);
      } else if (typeof trip.readingToImage === "string" && trip.readingToImage.trim() !== "") {
        formData.append("ReadingTo_ImagePath", trip.readingToImage);
      }
    }

    // Fuel image only for Office vehicle
    if (isOfficeVehicle) {
      if (trip.fuelImage instanceof File) {
        formData.append("Fuel_Image", trip.fuelImage);
      } else if (typeof trip.fuelImage === "string" && trip.fuelImage.trim() !== "") {
        formData.append("Fuel_ImagePath", trip.fuelImage);
      }
    }

    // visits (Only in EDIT mode)
    if (tripModalMode === "edit") {
      trip.visits.forEach((v, i) => {
        formData.append(`visits[${i}].visit_Id`, String(v.visit_Id || 0));
        formData.append(`visits[${i}].client_Name`, v.partyName);
        formData.append(`visits[${i}].location`, v.location);
        formData.append(`visits[${i}].latitude`, v.latitude || "");
        formData.append(`visits[${i}].longitude`, v.longitude || "");
        formData.append(`visits[${i}].visit_FromTime`, v.visitFromTime);
        formData.append(`visits[${i}].visit_ToTime`, v.visitToTime);
        formData.append(`visits[${i}].projects`, (v.demoProjects || []).join(","));
        formData.append(`visits[${i}].contact_Person`, v.contactPerson);
        formData.append(`visits[${i}].mobile_Number`, v.mobile);
        formData.append(`visits[${i}].remarks`, v.remarks);
        formData.append(`visits[${i}].localTransportAmount`, v.localTransportAmount || "");

        if (v.visitSlipImage instanceof File) {
          formData.append(`visits[${i}].visit_Image`, v.visitSlipImage);
        } else if (typeof v.visitSlipImage === "string" && v.visitSlipImage.trim() !== "") {
          formData.append(`visits[${i}].visit_ImagePath`, v.visitSlipImage);
        }

        if (v.localTransportImage instanceof File) {
          formData.append(`visits[${i}].localTransportImage`, v.localTransportImage);
        } else if (
          typeof v.localTransportImage === "string" &&
          v.localTransportImage.trim() !== ""
        ) {
          formData.append(`visits[${i}].localTransportImagePath`, v.localTransportImage);
        }
      });
    }

    try {
      const res = await api.post("OnDuty/save_daytrip", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      notify("Trip Saved Successfully", "success");
      await loadDuties();

      closeDayTripModal();

    } catch (error: any) {
      let errorMsg = "Save failed";
      if (error?.response?.data) {
        if (typeof error.response.data === "string") {
          errorMsg = error.response.data;
        } else if (typeof error.response.data === "object") {
          errorMsg = error.response.data.message || error.response.data.error || JSON.stringify(error.response.data);
        }
      } else if (error?.message) {
        errorMsg = error.message;
      }

      notify(errorMsg, "danger");
    } finally {
      isSavingTrip.current = false;
    }
  };
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
        setUserDesig(String(s.designation || ""));
      }
    } catch (e) {
      console.warn("User parse error", e);
    } finally {
      setUserLoaded(true);
    }
  }, []);

  const loadTeam = async () => {
    try {
      const res = await api.get("OnDuty/load_employees_duties", {
        params: { empCode, designation: userDesig },
      });

      const raw = Array.isArray(res.data) ? res.data : [];
      setTeam(
        raw.map((x: any) => ({
          EmpCode: x[0],
          EmpName: x[1],
          Role: x[2],
          Designation: x[3],
          Ischeck: asBool(x[4]),
          Mobile: x[5],
          RequestTo: x[5],
        }))
      );
    } catch {
      notify("Failed to load employees", "danger");
    }
  };
  const removeTripVisit = async (tripIndex: number, visitIndex: number) => {
    if (!selectedDutyId) return;

    const trip = (tripDaysByDuty[selectedDutyId] || [])[tripIndex];
    const visit = trip?.visits?.[visitIndex];

    if (!visit) return;

    // saved visit -> delete from DB
    if (visit.visit_Id && visit.visit_Id > 0) {
      try {
        await api.delete("OnDuty/delete_visit", {
          params: { visitId: visit.visit_Id },
        });

        setTripDaysByDuty((prev) => {
          const current = [...(prev[selectedDutyId] || [])];
          current[tripIndex] = {
            ...current[tripIndex],
            visits: current[tripIndex].visits.filter((_, i) => i !== visitIndex),
          };
          return {
            ...prev,
            [selectedDutyId]: current,
          };
        });

        notify("Visit deleted successfully", "success");
        return;
      } catch {
        notify("Failed to delete visit", "danger");
        return;
      }
    }

    // unsaved visit -> remove only from state
    setTripDaysByDuty((prev) => {
      const current = [...(prev[selectedDutyId] || [])];
      if (current[tripIndex].visits.length === 1) return prev;

      current[tripIndex] = {
        ...current[tripIndex],
        visits: current[tripIndex].visits.filter((_, i) => i !== visitIndex),
      };

      return {
        ...prev,
        [selectedDutyId]: current,
      };
    });
  };
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
  const loadAllTrips = async (duties: DutyRow[]) => {
    const result: Record<string, TripDayItem[]> = {};

    await Promise.all(
      duties.map(async (duty) => {
        try {
          const res = await api.get("OnDuty/get_daytrips", {
            params: { dutyId: duty.id },
          });

          const rows =
            typeof res.data === "string" ? JSON.parse(res.data) : res.data;

          result[duty.id] = buildTripsFromRows(Array.isArray(rows) ? rows : []);
        } catch (error) {
          console.error("loadAllTrips error for duty:", duty.id, error);
          result[duty.id] = [];
        }
      })
    );

    setTripDaysByDuty(result);
  };

  // The backend serializes these anonymous objects inconsistently (some
  // camelCase, some PascalCase depending on the endpoint), so pick whichever
  // casing shows up rather than assuming one.
  const pick = (d: any, ...keys: string[]) => {
    for (const k of keys) {
      if (d[k] !== undefined && d[k] !== null && d[k] !== "") return d[k];
    }
    return undefined;
  };

  const mapDutyRows = (rawData: any[]): DutyRow[] =>
    rawData.map((d: any) => ({
      id: String(d.id),
      College: d.college || "",
      Description: d.description || "",
      Mode_of_Trans: d.mode || "",
      Vehicle_No: d.vehicle_No || "",
      Location: d.location || "",
      Status: d.status || "Pending",
      DateFrom: d.dateFrom || "",
      DateTo: d.dateTo || "",
      // Same defensive casing lookup as Vehicle_No -> vehicle_No below:
      // covers whichever variant this endpoint actually serializes.
      Start_Time: pick(d, "start_Time", "startTime", "StartTime", "Start_Time"),
      End_Time: pick(d, "end_Time", "endTime", "EndTime", "End_Time"),
      empNames:
        d.empNames ||
        d.EmpNames ||
        d.empnames ||
        d.Empname ||
        d.empname,
      // Note: ASP.NET Core's default camelCase JSON policy only lowercases
      // the FIRST letter of a property name, so "RA1" serializes as "rA1"
      // (capital A kept) and "RA1_Status" as "rA1_Status" - not "ra1"/
      // "ra1_Status" as you'd expect from a normal camelCase conversion.
      // Checking all variants defensively since we've seen this backend mix
      // casing conventions across endpoints.
      CurrentLevel: pick(d, "currentLevel", "CurrentLevel"),
      MaxLevel: pick(d, "maxLevel", "MaxLevel"),
      CurrentRA: pick(d, "currentRA", "CurrentRA", "currentRa"),
      MatrixType: pick(d, "matrixType", "MatrixType"),
      RA1: pick(d, "rA1", "ra1", "RA1"),
      RA2: pick(d, "rA2", "ra2", "RA2"),
      RA3: pick(d, "rA3", "ra3", "RA3"),
      RA4: pick(d, "rA4", "ra4", "RA4"),
      RA1_Status: pick(d, "rA1_Status", "ra1_Status", "RA1_Status", "ra1Status", "rA1Status"),
      RA2_Status: pick(d, "rA2_Status", "ra2_Status", "RA2_Status", "ra2Status", "rA2Status"),
      RA3_Status: pick(d, "rA3_Status", "ra3_Status", "RA3_Status", "ra3Status", "rA3Status"),
      RA4_Status: pick(d, "rA4_Status", "ra4_Status", "RA4_Status", "ra4Status", "rA4Status"),
    }));

  const loadDuties = async () => {
    try {
      const res = await api.get("OnDuty/load_my_duties", {
        params: { EmpCode: empCode },
      });

      const rawData = Array.isArray(res.data) ? res.data : [];
      const mapped: DutyRow[] = mapDutyRows(rawData).map((row) => ({
        ...row,
        isOwn: true,
      }));

      // Approvers (accountant / team leader / manager) also see their team's
      // duty requests, with status, so they can act on them below. These are
      // tagged isOwn: false and always appended after the user's own rows,
      // so the render below can split them into a separate section.
      if (canApprove) {
        try {
          const teamRes = await api.get("OnDuty/load_duties_full", {
            params: { EmpCode: empCode },
          });

          const teamRaw = Array.isArray(teamRes.data) ? teamRes.data : [];
          const teamMapped = mapDutyRows(teamRaw).map((row) => ({
            ...row,
            isOwn: false,
          }));

          const seenIds = new Set(mapped.map((row) => row.id));
          teamMapped.forEach((row) => {
            if (!seenIds.has(row.id)) {
              mapped.push(row);
              seenIds.add(row.id);
            }
          });
        } catch (teamErr) {
          console.error("loadTeamDuties error:", teamErr);
        }
      }

      setDutiesList(mapped);
      await loadAllTrips(mapped);
    } catch (err) {
      console.error("loadDuties error:", err);
      setDutiesList([]);
      setTripDaysByDuty({});
    }
  };

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
          name:
            empNames.charAt(0).toUpperCase() +
            empNames.slice(1).toLowerCase(),
        };
      }

      return {
        code: "",
        name: x.trim(),
      };
    })
    .filter((x) => x.name);
};





  const [previewFile, setPreviewFile] = useState<File | string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const openFilePreview = (file: File | string | null | undefined) => {
    if (!file) return;
    setPreviewFile(file);
    setPreviewOpen(true);
  };
  const removeTripDay = async (dutyId: string, tripIndex: number) => {
    const trip = tripDaysByDuty[dutyId][tripIndex];

    if (!trip?.dayTrip_Id) {
      notify("Trip not saved yet", "warning");
      return;
    }

    try {
      await api.delete("OnDuty/delete_daytrip", {
        params: { dayTripId: trip.dayTrip_Id },
      });

      await loadDayTrips(dutyId);

      notify("Deleted Successfully", "success");
    } catch {
      notify("Delete failed", "danger");
    }
  };
  useEffect(() => {
    if (userLoaded && empCode) {
      loadTeam();
      loadClients();
      loadDuties();

    }
  }, [userLoaded, empCode]);

  useEffect(() => {
    if (team.length === 1) {
      setSelectedCodes([team[0].EmpCode]);
    }
  }, [team]);

  const onEndReadingChange = (val: string) => {
    setEReading(val);
    const s = parseFloat(sReading || "0");
    const e = parseFloat(val || "0");

    if (val && !isNaN(s) && !isNaN(e)) {
      if (e < s) {
        notify("End reading must be more than start", "warning");
        setKms("");
      } else {
        setKms(`${e - s}Kms`);
      }
    }
  };

  const saveOnDuty = async () => {
    if (!institution || !dutiesDesc || !transportMode || !location || !empCode || !dutyFromDate || !dutyToDate
      || (
      transportMode !== "PublicTransport" &&
      !vehicleNo
    )
  ) {
      notify("Please fill all required fields", "warning");
      return;
    }

    // Camp From Date & Time must be a real future moment, not just "today" -
    // the wheel picker's min already steers users away from past times, but
    // this is the hard backstop that actually blocks the save.
    if (!unlockRange.approved && moment(dutyFromDate).isBefore(nowIST())) {
      notify("Camp From Date & Time must be a future time", "warning");
      return;
    }

    const payload = {
      _id: editingId || "0",
      _empcode: empCode,
      _EmpCodes: selectedCodes.join(",") || empCode,
      _FromDate: moment(dutyFromDate).format("YYYY-MM-DD"),
      _ToDate: moment(dutyToDate).format("YYYY-MM-DD"),
      _Client: institution,
      _Description: dutiesDesc,
      _TransportMode: transportMode,
      _Starttime: moment(dutyFromDate).format("HH:mm"),
      _Endtime: moment(dutyToDate).format("HH:mm"),
      _VehicleNo: vehicleNo,
      _StartReading: sReading,
      _EndReading: eReading,
      _KMS: kms.replace("Kms", ""),
      _Location: location,
    };

    try {
      const res = await postWithFallback("OnDuty/saveduties", payload);
      if (isSaveOk(res.data)) {
        notify("On-Duty request submitted successfully", "success");
        clearOnDutyForm();
        loadDuties();
      }
    } catch {
      notify("Submission failed", "danger");
    }
  };

  const editOnDuty = async (id: string) => {
    if (!canEdit && !canApprove) {
      notify("Permission Denied", "danger");
      return;
    }

    try {
      const res = await api.get("OnDuty/edit_onduties", {
        params: { EmpCode: empCode, id },
      });

      const row = Array.isArray(res.data) && res.data[0] ? res.data[0] : null;

      if (row) {
        setEditingId(String(row[0]));
        setSelectedCodes(String(row[1]).split(",").filter(Boolean));
        setDutyFromDate(
          row[13]
            ? new Date(row[13]).toISOString()
            : row[2]
              ? new Date(row[2]).toISOString()
              : nowIST().toISOString(true)
        );
        setDutyToDate(
          row[14]
            ? new Date(row[14]).toISOString()
            : row[2]
              ? new Date(row[2]).toISOString()
              : nowIST().toISOString(true)
        );
        setInstitution(row[3]);
        setLocation(row[15] || "");
        setDutiesDesc(row[4]);
        setTransportMode(row[5]);
        setKms(row[6]);
        setStartTime(row[7]);
        setEndTime(row[8]);
        setVehicleNo(row[9]);
        setSReading(row[10]);
        setEReading(row[11]);
        contentRef.current?.scrollToTop(500);
        notify("Record loaded for editing");
      }
    } catch (e) {
      console.error("editOnDuty error:", e);
      notify("Failed to load record", "danger");
    }
  };

  // Which RA slot (1-4), if any, belongs to the logged-in user. Matches by
  // exact empCode first, falling back to a loose designation match since RA
  // values may be stored as either employee codes or role names.
  // Collapse whitespace and case so "Business  Manager" / "business manager"
  // / "Business Manager" all compare equal.
  const normalizeRole = (s: any) =>
    (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");

  const roleMatchesUser = (ra: any) => {
    const raNorm = normalizeRole(ra);
    if (!raNorm || raNorm === "-") return false;
    if (ra === empCode) return true;

    const desigNorm = normalizeRole(userDesig);
    if (!desigNorm) return false;

    return (
      raNorm === desigNorm ||
      desigNorm.includes(raNorm) ||
      raNorm.includes(desigNorm)
    );
  };

  // A role title (e.g. "Business Manager") can appear in more than one RA
  // slot, or the same person's decision can live at whichever slot number
  // was assigned to them for THIS record - so we check every slot that
  // matches the user's role, not just the first one, and treat the row as
  // "already decided by me" if any of those matched slots has a verdict.
  const getMyDecisionStatus = (row: DutyRow): string => {
    const raSlots = [row.RA1, row.RA2, row.RA3, row.RA4];
    const statuses = [row.RA1_Status, row.RA2_Status, row.RA3_Status, row.RA4_Status];

    for (let i = 0; i < raSlots.length; i++) {
      if (!roleMatchesUser(raSlots[i])) continue;

      const s = normalizeRole(statuses[i]);
      if (s === "approved" || s === "rejected") return s;
    }

    return "";
  };

  // Builds the "Approved By: Business Manager → HR" trail - one entry per
  // populated RA1..RA4 slot, colored by that slot's own status (approved =
  // green, rejected = red, still pending = blue).
  const getDutyChain = (row: DutyRow) => {
    const slots = [
      { role: row.RA1, status: row.RA1_Status },
      { role: row.RA2, status: row.RA2_Status },
      { role: row.RA3, status: row.RA3_Status },
      { role: row.RA4, status: row.RA4_Status },
    ];

    return slots
      .filter((s) => {
        const roleNorm = normalizeRole(s.role);
        return roleNorm && roleNorm !== "-";
      })
      .map((s) => {
        const st = normalizeRole(s.status);
        const color =
          st === "approved" || st === "accepted"
            ? "approved"
            : st === "rejected"
            ? "rejected"
            : "pending";
        return { role: String(s.role).trim(), color };
      });
  };

  // Whether it's currently the logged-in user's turn: CurrentLevel names a
  // slot number, and that specific slot's RA value must match the user -
  // matching some OTHER slot doesn't make it their turn.
  const isMyTurn = (row: DutyRow): boolean => {
    const currentLevel = row.CurrentLevel ? parseInt(String(row.CurrentLevel), 10) : null;
    if (!currentLevel || currentLevel < 1 || currentLevel > 4) return false;

    const raSlots = [row.RA1, row.RA2, row.RA3, row.RA4];
    return roleMatchesUser(raSlots[currentLevel - 1]);
  };

  const isFinalStatus = (row: DutyRow) => {
    const s = (row.Status || "").toLowerCase();
    return s === "approved" || s === "rejected";
  };

  // Per-card approve/reject for the team-duties list. Reject only needs the
  // id, but approve's stored proc expects the full duty payload, so we fetch
  // it fresh from edit_onduties rather than relying on the top form's state
  // (which may hold an unrelated record the user is mid-editing).
  // approve_onduty is the RA-chain-aware endpoint: it advances CurrentLevel/
  // RA{n}_Status server-side based on _empcode's position in RA1..RA4,
  // rather than force-completing the whole request like SaveDuties_Approve
  // does. The controller only ever returns Ok(...) on success and throws
  // (caught below) on failure, so reaching past the await means it worked.
  const approveDutyRow = async (row: DutyRow) => {
    try {
      await postWithFallback("OnDuty/approve_onduty", {
        _id: row.id,
        Status: "Approve",
        _empcode: empCode,
      });
      notify("Approved successfully", "success");
      loadDuties();
    } catch {
      notify("Approval failed", "danger");
    }
  };

  const rejectDutyRow = async (row: DutyRow) => {
    try {
      await postWithFallback("OnDuty/approve_onduty", {
        _id: row.id,
        Status: "Reject",
        _empcode: empCode,
      });
      notify("Request rejected", "warning");
      loadDuties();
    } catch {
      notify("Rejection failed", "danger");
    }
  };

  const minCampDate = moment().format("YYYY-MM-DD");
  const maxCampDate = moment().add(1, "month").format("YYYY-MM-DD");

  const clearOnDutyForm = () => {
    setEditingId("");
    setInstitution("");
    setDutiesDesc("");
    setTransportMode("");
    setKms("");
    setVehicleNo("");
    setLocation("");
    setSReading("");
    setEReading("");
    setStartTime("");
    setEndTime("");
    setSelectedCodes([]);
    setDutyFromDate(nowIST().toISOString(true));
    setDutyToDate(nowIST().toISOString(true));
    setDateModalType(null);
    setTripDaysByDuty({});
    setShowDayTripModal(false);
    setEditingTripIndex(null);
    setSelectedDutyRow(null);
    setSelectedDutyId("");
  };

  const getFileName = (file: File | string | null | undefined) => {
    if (!file) return "";
    if (file instanceof File) return file.name;
    if (typeof file === "string") return file.split("/").pop() || "";
    return "";
  };
  const tagVisitLocation = (tripIndex: number, visitIndex: number) => {
    if (!navigator.geolocation) {
      notify("Geolocation not supported", "danger");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);

        updateTripVisit(tripIndex, visitIndex, "latitude", lat);
        updateTripVisit(tripIndex, visitIndex, "longitude", lng);

        notify("Geo Tagged Successfully", "success");
      },
      () => notify("Permission denied", "warning"),
      { enableHighAccuracy: true }
    );
  };
  const currentModalTrip =
    selectedDutyId && editingTripIndex !== null
      ? (tripDaysByDuty[selectedDutyId] || [])[editingTripIndex]
      : null;

  const transportModeModal = selectedDutyRow?.Mode_of_Trans || "";

  const isPublicTransport = transportModeModal === "PublicTransport";

  const isOfficeVehicle =
    transportModeModal === "Office 4 Wheeler" ||
    transportModeModal === "Office 2 Wheeler";

  const isOwnVehicle =
    transportModeModal === "Own 2 Wheeler" ||
    transportModeModal === "Own 4 Wheeler";

  const getFileLabel = (file: File | string | null | undefined) => {
    if (!file) return "";
    if (file instanceof File) return file.name;
    if (typeof file === "string") return "View";
    return "";
  };
  const getGeoLabel = (lat?: string, lng?: string) => {
    return lat && lng ? "View" : "";
  };
  const viewLinkStyle: React.CSSProperties = {
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "underline",
    lineHeight: "20px",
  };

  const getPreviewUrl = (file: File | string | null | undefined) => {
    if (!file) return "";

    if (file instanceof File) {
      return URL.createObjectURL(file);
    }

    if (typeof file === "string") {
      let path = file.trim();

      if (/^https?:\/\//i.test(path)) {
        return path;
      }

      path = path.replace(/^\/?api\//i, "/");

      const base = API_BASE.replace(/\/api\/?$/i, "").replace(/\/$/, "");
      return `${base}${path.startsWith("/") ? path : `/${path}`}`;
    }

    return "";
  };

  // Tried constraining hourValues/minuteValues (plus a key-based remount) to
  // gray out past hours on "Today" - but forcing the wheel to remount every
  // time the date column crosses the today/future boundary fought the
  // user's own scroll gesture, making times feel unavailable/laggy right
  // after picking a future date. Dropped that entirely: the wheel now always
  // offers the full 24h/60m range on every date with zero restriction lag,
  // and saveOnDuty's check below is the sole (and reliable) enforcement of
  // "Camp From can't be in the past."
  const history = useHistory();
  return (
    <div className="onduties-page">
      <div className="onduties-content">
        <div style={{ display: "flex", gap: "1px", marginTop: "5px" }}>
        </div>


        <div className="page-container">
          <h2 style={{ margin: 0, fontWeight: 700 }}>Duty Manager</h2>
          <div>

            <div className="lr-bento-grid" style={{ alignItems: "start", marginBottom: "20px" }}>
              {/* Team Members */}
              <div className="lr-field-box" onClick={() => setIsTeamDropdownOpen(!isTeamDropdownOpen)}>
                <label className="lr-field-label">Team Members</label>
                <div className="lr-field-content" ref={teamTriggerRef}>
                  <IonIcon icon={peopleOutline} className="lr-field-icon" />
                  {team.length > 1 ? (
                    <>
                      <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: selectedCodes.length ? "#1e293b" : "#94a3b8" }}>
                        {selectedCodes.length > 0 ? `${selectedCodes.length} Selected` : "Select Team"}
                      </span>
                      <ChevronDown size={16} style={{ opacity: 0.7, color: "#94a3b8" }} />

                      {isTeamDropdownOpen && createPortal(
                        <>
                          <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsTeamDropdownOpen(false); }} />
                          <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${teamDropdownPos.top}px`, left: `${teamDropdownPos.left}px`, width: `${teamDropdownPos.width}px` }}>
                            <div className="dropdown-search-sec">
                              <Search size={16} className="dropdown-search-icon" />
                              <input type="text" placeholder="Search team..." value={teamSearchTerm} onChange={(e) => setTeamSearchTerm(e.target.value)} autoFocus className="dropdown-pure-input" />
                              {teamSearchTerm && <button className="dropdown-clear-btn" onClick={() => setTeamSearchTerm("")}><X size={16} /></button>}
                            </div>
                            <div className="dropdown-body">
                              {team.filter(t => (t.EmpName || "").toLowerCase().includes(teamSearchTerm.toLowerCase())).length > 0 ? (
                                team.filter(t => (t.EmpName || "").toLowerCase().includes(teamSearchTerm.toLowerCase())).map((emp, index) => {
                                  const isSelected = selectedCodes.includes(emp.EmpCode);
                                  const initials = (emp.EmpName?.charAt(0) || "?").toUpperCase();
                                  return (
                                    <div
                                      key={index}
                                      className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (isSelected) {
                                          setSelectedCodes(selectedCodes.filter(c => c !== emp.EmpCode));
                                        } else {
                                          setSelectedCodes([...selectedCodes, emp.EmpCode]);
                                        }
                                      }}
                                    >
                                      <div className={`dr-avatar grad-${(index % 5) || 0}`}>{initials}</div>
                                      <div className="dr-info">
                                        <span className="dr-name">{emp.EmpName}</span>
                                        <span className="dr-id">ID: {emp.EmpCode}</span>
                                      </div>
                                      {isSelected && <Check size={18} className="dr-check" />}
                                    </div>
                                  );
                                })
                              ) : <div className="dr-no-results">No members found</div>}
                            </div>
                          </div>
                        </>,
                        document.body
                      )}
                    </>
                  ) : (
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "#1e293b" }}>
                      {team[0]?.EmpName || "-"}
                    </span>
                  )}
                </div>
              </div>

              {/* Client / Institution */}
              <div className="lr-field-box" onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}>
                <label className="lr-field-label">Client / Institution</label>
                <div className="lr-field-content" ref={clientTriggerRef}>
                  <IonIcon icon={businessOutline} className="lr-field-icon" />
                  <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: institution ? "#1e293b" : "#94a3b8" }}>
                    {institution || "Search Party / Client"}
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
                          {[{ Client_Name: "Party" }, ...clients].filter(c => c.Client_Name.toLowerCase().includes(clientSearchTerm.toLowerCase())).length > 0 ? (
                            [{ Client_Name: "Party" }, ...clients].filter(c => c.Client_Name.toLowerCase().includes(clientSearchTerm.toLowerCase())).map((c, index) => {
                              const isSelected = institution === c.Client_Name;
                              const initials = (c.Client_Name.charAt(0) || "?").toUpperCase();
                              return (
                                <div
                                  key={index}
                                  className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setInstitution(c.Client_Name);
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

              {/* Camp From Date & To Date Wrapper */}
              <div
                className="lr-field-box"
                onClick={() => {
                  // The picker's value only gets re-synced to "now" when the
                  // date column itself changes - if it's just been sitting
                  // on Today since page load (or since it was last touched),
                  // that captured timestamp goes stale. Refresh it to the
                  // live current time right before opening, whenever Today
                  // is still the selected date.
                  if (dutyFromDate && toIST(dutyFromDate).isSame(nowIST(), "day")) {
                    setDutyFromDate(nowIST().toISOString(true));
                  }
                  setDateModalType("from");
                }}
                style={{ cursor: "pointer" }}
              >
                <label className="lr-field-label">Camp From Date & Time</label>
                <div className="lr-field-content">
                  <IonIcon icon={calendarOutline} className="lr-field-icon" />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: dutyFromDate ? "#1e293b" : "#94a3b8" }}>
                    {dutyFromDate ? moment(dutyFromDate).format("DD-MM-YYYY HH:mm") : "Pick From Date & Time"}
                  </span>
                </div>
              </div>

              <div className="lr-field-box" onClick={() => setDateModalType("to")} style={{ cursor: "pointer" }}>
                <label className="lr-field-label">Camp To Date & Time</label>
                <div className="lr-field-content">
                  <IonIcon icon={calendarOutline} className="lr-field-icon" />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: dutyToDate ? "#1e293b" : "#94a3b8" }}>
                    {dutyToDate ? moment(dutyToDate).format("DD-MM-YYYY HH:mm") : "Pick To Date & Time"}
                  </span>
                </div>
              </div>

              {/* Modals for Dates */}
              <IonModal isOpen={!!dateModalType} onDidDismiss={() => setDateModalType(null)} className="native-date-modal">
                <div className="native-date-modal-wrapper">
                  <IonDatetime
                    presentation="date-time"
                    hourCycle="h23"
                    preferWheel={true}
                    showDefaultButtons={true}
                    value={dateModalType === "from" ? dutyFromDate : dutyToDate}
                    min={dateModalType === "from" ? (unlockRange.approved ? unlockRange.fromDate : nowIST().toISOString(true)) : (dutyFromDate === unlockRange.fromDate ? unlockRange.fromDate : (dutyFromDate || nowIST().toISOString(true)))}
                    max={dateModalType === "from" ? maxDate : (dutyFromDate === unlockRange.fromDate ? unlockRange.toDate : maxDate)}
                    isDateEnabled={dateModalType === "from" ? ((dateString) => {
                      const date = dateString.split("T")[0];
                      if (date === dutyFromDate) return true;
                      const todayStr = nowIST().format("YYYY-MM-DD");
                      if (unlockRange.approved && date >= unlockRange.fromDate && date <= unlockRange.toDate) return true;
                      return date >= todayStr;
                    }) : undefined}
                    onIonChange={(e) => {
                      const val = String(e.detail.value || "");
                      if (dateModalType === "from") {
                        // Only snap the time portion when the DATE itself just
                        // changed (not on every hour/minute scroll, which
                        // would fight the user's own time pick). Today ->
                        // start the time wheel from the current IST moment;
                        // any future date -> start from 00:00 IST.
                        const newDatePart = val.split("T")[0];
                        const prevDatePart = dutyFromDate ? String(dutyFromDate).split("T")[0] : "";
                        let finalVal = val;
                        if (newDatePart && newDatePart !== prevDatePart) {
                          const isToday = newDatePart === nowIST().format("YYYY-MM-DD");
                          const istTimePart = isToday ? nowIST().format("HH:mm:ss") : "00:00:00";
                          finalVal = `${newDatePart}T${istTimePart}+05:30`;
                        }
                        setDutyFromDate(finalVal);
                        if (!dutyToDate || moment(finalVal).isAfter(dutyToDate)) setDutyToDate(finalVal);
                      } else {
                        setDutyToDate(val);
                      }
                    }}
                    onIonCancel={() => setDateModalType(null)}
                  />
                </div>
              </IonModal>

              {/* Location */}
              <div className="lr-field-box">
                <label className="lr-field-label">Location</label>
                <div className="lr-field-content">
                  <IonIcon icon={locationOutline} className="lr-field-icon" />
                  <input
                    type="text"
                    placeholder="Vijayawada"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    style={{ border: "none", outline: "none", background: "transparent", flex: 1, color: "#1e293b", fontSize: "14px", fontWeight: "500" }}
                  />
                </div>
              </div>

              {/* Transport */}
              <div className="lr-field-box" onClick={() => setIsTransportDropdownOpen(!isTransportDropdownOpen)}>
                <label className="lr-field-label">Transport</label>
                <div className="lr-field-content" ref={transportTriggerRef}>
                  <IonIcon icon={carOutline} className="lr-field-icon" />
                  <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: transportMode ? "#1e293b" : "#94a3b8" }}>
                    {transportMode || "Select Transport"}
                  </span>
                  <ChevronDown size={16} style={{ opacity: 0.7, color: "#94a3b8" }} />

                  {isTransportDropdownOpen && createPortal(
                    <>
                      <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsTransportDropdownOpen(false); }} />
                      <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${transportDropdownPos.top}px`, left: `${transportDropdownPos.left}px`, width: `${transportDropdownPos.width}px` }}>
                        <div className="dropdown-body" style={{ height: 'auto', maxHeight: '180px' }}>
                          {["PublicTransport", "Office 4 Wheeler", "Office 2 Wheeler", "Own 2 Wheeler", "Own 4 Wheeler"].map((loc, index) => {
                            const isSelected = transportMode === loc;
                            const initials = loc.charAt(0);
                            return (
                              <div
                                key={index}
                                className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setTransportMode(loc);
                                  setIsTransportDropdownOpen(false);
                                }}
                              >
                                <div className={`dr-avatar grad-${(index % 5) || 0}`}>{initials}</div>
                                <div className="dr-info">
                                  <span className="dr-name">{loc}</span>
                                </div>
                                {isSelected && <Check size={18} className="dr-check" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              </div>

              {/* Vehicle No */}
              {transportMode !== "PublicTransport" && (
                <div className="lr-field-box">
                  <label className="lr-field-label">Vehicle No</label>
                  <div className="lr-field-content">
                    <IonIcon icon={carOutline} className="lr-field-icon" />
                    <input
                      type="text"
                      placeholder="AP16..."
                      value={vehicleNo}
                      onChange={(e) => setVehicleNo(e.target.value)}
                      style={{ border: "none", outline: "none", background: "transparent", flex: 1, color: "#1e293b", fontSize: "14px", fontWeight: "500" }}
                    />
                  </div>
                </div>
              )}

              {/* Work Description */}
              <div className="lr-field-box">
                <label className="lr-field-label">Work Description</label>
                <div className="lr-field-content">
                  <input
                    type="text"
                    placeholder="Ex: System installation..."
                    value={dutiesDesc}
                    onChange={(e) => setDutiesDesc(e.target.value)}
                    style={{ border: "none", outline: "none", background: "transparent", flex: 1, color: "#1e293b", fontSize: "14px", fontWeight: "500" }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex" }}>
              <button
                className="lr-gradient-btn"
                style={{ flex: 1, padding: "14px", borderRadius: "14px", fontSize: "15px", fontWeight: "700" }}
                onClick={saveOnDuty}
              >
                Submit Report
              </button>
            </div>
          </div>
          <div className="history-section-title">On Duty Logs</div>

          {canApprove && (
            <IonSegment
              value={activeDutyTab}
              onIonChange={(e) =>
                setActiveDutyTab((e.detail.value as "my" | "team") || "my")
              }
              style={{ marginBottom: "14px" }}
            >
              <IonSegmentButton value="my">
                <IonLabel>My Requests</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="team">
                <IonLabel>Team Requests</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          )}

          {dutiesList
            .filter((row) =>
              !canApprove
                ? true
                : activeDutyTab === "team"
                  ? row.isOwn === false
                  : row.isOwn !== false
            )
            .filter((row) => {
              const selected = (statusFilter || "all").toLowerCase();
              if (selected === "all") return true;

              // On Duty Logs is based on the request's overall/final
              // outcome (all RA levels done), unlike the Requests page's
              // Team Requests tab which is viewer-centric.
              const approved = isFinalStatus(row) && row.Status?.toLowerCase() === "approved";
              const rejected = isFinalStatus(row) && row.Status?.toLowerCase() === "rejected";

              if (selected === "pending") return !approved && !rejected;
              if (selected === "accepted") return approved;
              if (selected === "rejected") return rejected;
              return true;
            })
            .map((row, idx) => {
              const rowApproved = isFinalStatus(row) && row.Status?.toLowerCase() === "approved";
              const rowRejected = isFinalStatus(row) && row.Status?.toLowerCase() === "rejected";
              const rowChain = getDutyChain(row);

              return (
            <div key={`${row.id}-${idx}`} className="premium-card">
              <span
                className={`dm-side-flag ${rowApproved ? "approved" : rowRejected ? "rejected" : "pending"}`}
              />
              <div
                className="card-header"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
              >
                <div style={{ flex: 1 }}>
                  <div className="college-name">
                    {row.College || "Party"}
                    <span className="dm-id-badge">#{row.id}</span>
                  </div>
                  <div className="duty-subtitle">{row.Description}</div>
                </div>

                <span
                  className={`dm-status-dot ${rowApproved ? "approved" : rowRejected ? "rejected" : "pending"}`}
                >
                  {rowApproved ? "Approved" : rowRejected ? "Rejected" : "Pending"}
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    window.innerWidth <= 768
                      ? "1fr"
                      : "repeat(4, minmax(0, 1fr))",
                  gap: "14px",
                  alignItems: "start",
                  marginTop: "14px",
                }}
              >
                <div className="duty-info-box full-width">
                  <span className="item-label">Employees</span>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      marginTop: "6px",
                    }}
                  >
                    {formatEmployeeNames(row.empNames).map(
                      (emp: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            background: "#eef2ff",
                            color: "#3730a3",
                            padding: "6px 10px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: 600,
                            border: "1px solid #c7d2fe",
                          }}
                        >
                          {emp.name}
                          {emp.code && (
                            <span style={{ opacity: 0.7 }}> ({emp.code})</span>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div className="duty-info-box" style={{ minWidth: 0 }}>
                  <span className="item-label">Transport</span>
                  <span
                    className="item-value"
                    style={{ wordBreak: "break-word", overflowWrap: "anywhere", lineHeight: "20px" }}
                  >
                    {row.Mode_of_Trans}
                    {row.Vehicle_No && (
                      <span style={{ color: "#64748b" }}> • {row.Vehicle_No}</span>
                    )}
                  </span>
                </div>

                <div className="duty-info-box" style={{ minWidth: 0 }}>
                  <span className="item-label">Timeline</span>
                  <span
                    className="item-value"
                    style={{
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                      fontSize: "0.7rem",
                      lineHeight: "20px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.DateFrom && row.DateTo
                      ? `${fmtDateWithTime(row.DateFrom, row.Start_Time)} → ${fmtDateWithTime(row.DateTo, row.End_Time)}`
                      : row.Date}
                  </span>
                </div>

                <div className="duty-info-box" style={{ minWidth: 0 }}>
                  <span className="item-label">Location</span>
                  <span
                    className="item-value"
                    style={{ wordBreak: "break-word", overflowWrap: "anywhere", lineHeight: "20px" }}
                  >
                    {row.Location}
                  </span>
                </div>

                <div className="duty-info-box" style={{ minWidth: 0 }}>
                  <span className="item-label">Details</span>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setExpandedTrips((prev) => ({
                        ...prev,
                        [row.id]: !prev[row.id],
                      }));
                    }}
                    className="duty-view-link"
                    style={{ lineHeight: "20px" }}
                  >
                    {expandedTrips[row.id] ? "Hide" : "View"}
                  </a>
                </div>
              </div>

              {expandedTrips[row.id] && (
              <div style={{ marginTop: "16px", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "10px" }}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (!hasAnyApproval(row)) {
                        notify(
                          "Duty days can be added only after the request is approved at least at one stage",
                          "warning"
                        );
                        return;
                      }
                      openAddDayTripModal(row);
                    }}
                    className="duty-view-link"
                    style={{
                      opacity: hasAnyApproval(row) ? 1 : 0.4,
                      cursor: hasAnyApproval(row) ? "pointer" : "not-allowed",
                    }}
                  >
                    + Add Duty Day
                  </a>

                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      refreshDayTrips(row.id);
                    }}
                    className="duty-view-link"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      opacity: refreshingTripsDutyId === row.id ? 0.5 : 1,
                      pointerEvents: refreshingTripsDutyId ? "none" : "auto",
                    }}
                  >
                    <IonIcon icon={refreshOutline} style={{ fontSize: "15px" }} />
                    {refreshingTripsDutyId === row.id ? "Refreshing..." : "Refresh"}
                  </a>
                </div>

                {(tripDaysByDuty[row.id] || []).length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                      gap: "12px",
                      alignItems: "start",
                    }}
                  >
                    {(tripDaysByDuty[row.id] || []).map((trip, index) => (
                      <div
                        key={trip.dayTrip_Id || `${trip.dutyDate}-${index}`}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: "14px",
                          padding: "14px",
                          background: "#fafafa",
                          color: "#1f2937",
                          height: "100%",
                          boxSizing: "border-box",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "10px",
                            flexWrap: "nowrap",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              color: "#1f2937",
                              fontSize: "15px",
                              lineHeight: 1.3,
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {moment(trip.dutyDate).format("DD-MM-YYYY")}
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "2px",
                              flexShrink: 0,
                              marginLeft: "auto",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <IonButton
                              fill="clear"
                              size="small"
                              color="primary"
                              style={{
                                margin: 0,
                                minHeight: "24px",
                                fontSize: "11px",
                              }}
                              onClick={() => openEditDayTripModal(row, index)}
                            >
                              EDIT
                            </IonButton>

                            <IonButton
                              fill="clear"
                              size="small"
                              color="danger"
                              style={{
                                margin: 0,
                                minHeight: "24px",
                                fontSize: "11px",
                              }}
                              onClick={() => removeTripDay(row.id, index)}
                            >
                              DELETE
                            </IonButton>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            fontSize: "13px",
                            marginBottom: "8px",
                          }}
                        >
                          <div>
                            <strong>Reading :</strong>{" "}

                            {/* Reading From */}
                            <span
                              role="button"
                              tabIndex={0}
                              style={{
                                color: trip.readingFromImage ? "#2563eb" : "#111827",
                                cursor: trip.readingFromImage ? "pointer" : "default",
                                fontWeight: 600,
                                userSelect: "none",
                                padding: "2px 6px",
                                borderRadius: "6px",
                                background: trip.readingFromImage ? "#e0f2fe" : "transparent",
                                display: "inline-block",
                              }}
                              onClick={() => {
                                if (trip.readingFromImage) {
                                  openFilePreview(trip.readingFromImage);
                                }
                              }}
                            >
                              {trip.readingFrom || "-"}
                            </span>

                            {"  →  "}

                            {/* Reading To */}
                            <span
                              role="button"
                              tabIndex={0}
                              style={{
                                color: trip.readingToImage ? "#2563eb" : "#111827",
                                cursor: trip.readingToImage ? "pointer" : "default",
                                fontWeight: 600,
                                userSelect: "none",
                                padding: "2px 6px",
                                borderRadius: "6px",
                                background: trip.readingToImage ? "#e0f2fe" : "transparent",
                                display: "inline-block",
                              }}
                              onClick={() => {
                                if (trip.readingToImage) {
                                  openFilePreview(trip.readingToImage);
                                }
                              }}
                            >
                              {trip.readingTo || "-"}
                            </span>

                            {" "}
                            <span style={{ color: "#475569" }}>
                              ({trip.distance || 0} Kms)
                            </span>
                          </div>
                          {/* ROW 2 — Fuel (Only for Office Vehicles) */}
                          {(row.Mode_of_Trans === "Office 4 Wheeler" ||
                            row.Mode_of_Trans === "Office 2 Wheeler") && (
                              <div>
                                <strong>Fuel :</strong>{" "}
                                <span
                                  style={{
                                    color: trip.fuelImage ? "#2563eb" : "#111827",
                                    textDecoration: trip.fuelImage ? "underline" : "none",
                                    cursor: trip.fuelImage ? "pointer" : "default",
                                    fontWeight: 600,
                                  }}
                                  onClick={() => {
                                    if (trip.fuelImage) {
                                      openFilePreview(trip.fuelImage);
                                    }
                                  }}
                                >
                                  {trip.fuelAmount ? `${trip.fuelAmount}/-` : "-"}
                                </span>
                              </div>
                            )}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            marginTop: "8px",
                          }}
                        >
                          {(trip.visits || []).map((visit: VisitItem, vIndex: number) => (
                            <div
                              key={vIndex}
                              style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: "12px",
                                padding: "10px",
                                background: "#ffffff",
                                fontSize: "13px",
                                lineHeight: "1.6",
                              }}
                            >
                              {/* Client */}
                              <div>
                                <strong>Client :</strong>{" "}
                                <span
                                  style={{
                                    color: visit.visitSlipImage ? "#2563eb" : "#111827",
                                    cursor: visit.visitSlipImage ? "pointer" : "default",
                                    textDecoration: visit.visitSlipImage ? "underline" : "none",
                                  }}
                                  onClick={() => {
                                    if (visit.visitSlipImage) {
                                      openFilePreview(visit.visitSlipImage);
                                    }
                                  }}
                                >
                                  {visit.partyName || "-"}
                                </span>
                              </div>

                              {/* Location */}
                              <div>
                                <strong>Location :</strong>{" "}
                                {visit.latitude && visit.longitude ? (
                                  <span
                                    style={{
                                      color: "#2563eb",
                                      textDecoration: "underline",
                                      cursor: "pointer",
                                      fontWeight: 600,
                                    }}
                                    onClick={() =>
                                      window.open(
                                        `https://www.google.com/maps?q=${visit.latitude},${visit.longitude}`,
                                        "_blank"
                                      )
                                    }
                                  >
                                    {visit.location || "View Map"}
                                  </span>
                                ) : (
                                  visit.location || "-"
                                )}
                              </div>
                              {/* Local Transport */}
                              {visit.localTransportAmount && (
                                <div>
                                  <strong>Local Transport :</strong>{" "}
                                  <span
                                    style={{
                                      color: visit.localTransportImage ? "#2563eb" : "#111827",
                                      textDecoration: visit.localTransportImage ? "underline" : "none",
                                      cursor: visit.localTransportImage ? "pointer" : "default",
                                      fontWeight: 600,
                                    }}
                                    onClick={() => {
                                      if (visit.localTransportImage) {
                                        openFilePreview(visit.localTransportImage);
                                      }
                                    }}
                                  >
                                    ₹ {visit.localTransportAmount}
                                  </span>
                                </div>
                              )}
                              {/* Visiting Time */}
                              <div>
                                <strong>Visiting Time :</strong>{" "}
                                {visit.visitFromTime || "-"} → {visit.visitToTime || "-"}
                              </div>

                              {/* Projects */}
                              <div>
                                <strong>Projects :</strong>{" "}
                                {visit.demoProjects && visit.demoProjects.length > 0
                                  ? visit.demoProjects.join(", ")
                                  : "-"}
                              </div>

                              {/* Contact */}
                              <div>
                                <strong>Contact :</strong>{" "}
                                {visit.contactPerson || "-"}{" "}
                                {visit.mobile ? `(${visit.mobile})` : ""}
                              </div>

                              {/* Remarks */}
                              <div>
                                <strong>Remarks :</strong>{" "}
                                {visit.remarks || "-"}
                              </div>

                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}
              {/* Approval trail instead of a pill - the status dot up top
                  already shows the overall outcome, so this just lists who
                  acted (or still needs to), colored per RA slot. */}
              {rowChain.length > 0 && (
                <div className="dm-chain">
                  <span className="dm-chain-label">Approval Status:</span>{" "}
                  {rowChain.map((step, idx) => (
                    <React.Fragment key={idx}>
                      <span className={`dm-chain-role ${step.color}`}>{step.role}</span>
                      {idx < rowChain.length - 1 && (
                        <span className="dm-chain-arrow"> → </span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}

              {canApprove && isMyTurn(row) && (
                <div className="duty-action-row">
                  <IonButton className="compact-duty-approve" onClick={() => approveDutyRow(row)}>
                    Approve
                  </IonButton>
                  <IonButton className="compact-duty-reject" onClick={() => rejectDutyRow(row)}>
                    Reject
                  </IonButton>
                </div>
              )}

              {/* edit_onduties looks the record up by the VIEWER's own
                  empCode + id, so it only ever finds rows that viewer
                  actually owns - showing the pencil on a team member's card
                  (row.isOwn === false) let approvers click it and always hit
                  "Failed to load record". Admin roles (Accountant/Director)
                  are the exception and can edit any record. */}
              {(canEdit || (canApprove && row.isOwn !== false)) && (
                <IonButton
                  fill="clear"
                  color="primary"
                  className="ion-no-margin"
                  onClick={() => editOnDuty(row.id)}
                >
                  <IonIcon icon={pencilOutline} />
                </IonButton>
              )}
            </div>
              );
            })}

        </div>

        <IonModal isOpen={showDayTripModal} onDidDismiss={closeDayTripModal}>
          <IonContent className="ion-padding" ref={modalContentRef}>
            {editingTripIndex !== null && currentModalTrip && (() => {
              const trip = currentModalTrip;
              const hasReadingFromImage = !!trip.readingFromImage;
              const hasReadingToImage = !!trip.readingToImage;
              const hasFuelImage = !!trip.fuelImage;
              // Normalized HH:mm bounds (from the On Duty's own applied
              // Timeline) used to restrict the Visit Time wheel picker below
              // so out-of-range hours/minutes aren't even selectable.
              const campStartTimeStr = selectedDutyRow?.Start_Time
                ? String(selectedDutyRow.Start_Time).slice(0, 5)
                : null;
              const campEndTimeStr = selectedDutyRow?.End_Time
                ? String(selectedDutyRow.End_Time).slice(0, 5)
                : null;

              // Visit From Time is floored/ceilinged by the On Duty's own
              // Timeline (campStartTimeStr / campEndTimeStr). Visit To Time
              // floors at that SAME visit's own From Time (no ceiling from
              // the Timeline's End_Time - a visit can legitimately run past
              // the On Duty's nominal end time) and is capped at the current
              // real-world time whenever this day trip's date is today (past-
              // dated day trips get no such cap).
              //
              // On top of those, visits within the SAME day trip must not
              // overlap each other. Visits are treated as a simple ordered
              // list by their index (matching how "+ Add Party" always
              // appends at the end) - each visit's floor also considers the
              // nearest PRIOR visit's own To Time, and each visit's ceiling
              // also considers the nearest FOLLOWING visit's own From Time.
              const isTripToday = trip.dutyDate === nowIST().format("YYYY-MM-DD");
              const isTripFuture =
                String(trip.dutyDate || "").slice(0, 10) > nowIST().format("YYYY-MM-DD");
              const nowTimeStr = nowIST().format("HH:mm");
              // Normalize any time string to plain HH:mm. Saved visits come
              // back from the db as "HH:mm:ss" - feeding that into the
              // `2000-01-01T${t}:00` templates below would produce an
              // invalid ISO string ("...T17:40:00:00") that IonDatetime
              // silently ignores, leaving the wheel unbounded/mispositioned.
              const hhmm = (t?: string | null): string | null =>
                t ? String(t).slice(0, 5) : null;
              const laterOf = (a: string | null, b: string | null) => {
                if (!a) return b;
                if (!b) return a;
                return moment(a, ["HH:mm:ss", "HH:mm"]).isAfter(moment(b, ["HH:mm:ss", "HH:mm"])) ? a : b;
              };
              const earlierOf = (a: string | null, b: string | null) => {
                if (!a) return b;
                if (!b) return a;
                return moment(a, ["HH:mm:ss", "HH:mm"]).isBefore(moment(b, ["HH:mm:ss", "HH:mm"])) ? a : b;
              };
              // Nearest prior visit (by index) that already has a To Time set.
              const prevVisitEndTimeStr = (idx: number): string | null => {
                for (let i = idx - 1; i >= 0; i--) {
                  if (trip.visits[i]?.visitToTime) return hhmm(trip.visits[i].visitToTime);
                }
                return null;
              };
              // Nearest following visit (by index) that already has a From Time set.
              const nextVisitStartTimeStr = (idx: number): string | null => {
                for (let i = idx + 1; i < trip.visits.length; i++) {
                  if (trip.visits[i]?.visitFromTime) return hhmm(trip.visits[i].visitFromTime);
                }
                return null;
              };
              const visitFromTimeMin = (idx: number) => laterOf(campStartTimeStr, prevVisitEndTimeStr(idx));
              const visitFromTimeMax = () => campEndTimeStr;
              const visitToTimeMin = (idx: number) =>
                hhmm(trip.visits[idx]?.visitFromTime) || campStartTimeStr || null;
              const visitToTimeMax = (idx: number) =>
                earlierOf(isTripToday ? nowTimeStr : null, nextVisitStartTimeStr(idx));

              // Opens the Visit Time wheel picker, but first snaps the field
              // to its min/max bound whenever the current value is empty or
              // already outside that bound - so the picker always reflects
              // the fetched Timeline (or, for "to", the visit's own From Time
              // / the current time / the next visit's start) immediately
              // instead of showing an old/blank value that still needs to be
              // rolled into range by hand, and never opens already
              // overlapping an adjacent visit.
              const openVisitTimePicker = (
                idx: number,
                field: "visitFromTime" | "visitToTime"
              ) => {
                const minBound = field === "visitFromTime" ? visitFromTimeMin(idx) : visitToTimeMin(idx);
                const maxBound = field === "visitFromTime" ? visitFromTimeMax() : visitToTimeMax(idx);
                const currentVal = trip.visits[idx]?.[field] || "";
                const currentMoment = currentVal
                  ? moment(currentVal, ["HH:mm:ss", "HH:mm"])
                  : null;
                let snapTo: string | null = null;
                if (!currentMoment || !currentMoment.isValid()) {
                  snapTo = minBound || maxBound || null;
                } else if (minBound && currentMoment.isBefore(moment(minBound, ["HH:mm:ss", "HH:mm"]))) {
                  snapTo = minBound;
                } else if (maxBound && currentMoment.isAfter(moment(maxBound, ["HH:mm:ss", "HH:mm"]))) {
                  snapTo = maxBound;
                } else if (currentVal !== hhmm(currentVal)) {
                  // In-range but stored with seconds (HH:mm:ss from the db) -
                  // rewrite as HH:mm so the picker's ISO templates stay valid.
                  snapTo = hhmm(currentVal);
                }
                if (snapTo) {
                  updateTripVisit(editingTripIndex!, idx, field, snapTo);
                }
                setVisitTimeModal({ visitIndex: idx, field });
              };

              return (
                <>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      alignItems: "start",
                      columnGap: "12px",
                      marginBottom: "18px",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        color: "#1e3a5f",
                        fontSize: "18px",
                        fontWeight: 700,
                        lineHeight: 1.25,
                        wordBreak: "break-word",
                      }}
                    >{moment(trip.dutyDate).format("DD-MM-YYYY")} Day Trip
                    </div>

                    <IonButton
                      fill="clear"
                      onClick={closeDayTripModal}
                      style={{
                        margin: 0,
                        justifySelf: "end",
                        alignSelf: "start",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        minHeight: "32px",
                      }}
                    >
                      Close
                    </IonButton>
                  </div>

                  <div
                    style={{
                      marginTop: "6px",
                      marginBottom: "12px",
                      padding: "12px 14px",
                      border: "1px solid #d8dee8",
                      borderRadius: "16px",
                      background: "#ffffff",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "#1e3a5f",
                        marginBottom: "2px",
                      }}
                    >
                      Trip Details
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                      }}
                    >
                      Reading and fuel details for this trip
                    </div>
                  </div>


                  <div
                    style={{
                      border: "1px solid #d8dee8",
                      borderRadius: "18px",
                      padding: "12px",
                      background: "#f8fafc",
                      marginBottom: "18px",
                    }}
                  >
                    {!isPublicTransport && (
                      <div
                        style={{
                          display: "grid",
                        gridTemplateColumns:
  window.innerWidth <= 768
    ? "1fr"
    : tripModalMode === "add"
    ? "1fr"
    : "1fr 1fr",
                          gap: "10px",
                          alignItems: "start",
                        }}
                      >
                        <div
                          style={{
                            border: "1px solid #d8dee8",
                            borderRadius: "16px",
                            padding: "12px",
                            background: "#ffffff",
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                            justifyContent: "flex-start",
                            alignSelf: "start",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "6px",
                              flexWrap: "wrap",
                              minHeight: "24px",
                            }}
                          >
                           <label
  style={{
    fontSize: "14px",
    fontWeight: 700,
    color: "#334155",
    cursor: "pointer",
    textDecoration: "underline",
    lineHeight: "20px",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  }}
>
  Reading From
  <input
    hidden
    type="file"
    accept="image/*"
    onClick={saveModalScroll}
    onChange={(e) => {
      const file = e.target.files?.[0] || null;

      updateTripDay(
        editingTripIndex!,
        "readingFromImage",
        file
      );

      if (tripModalMode === "add") {
        updateTripDay(
          editingTripIndex!,
          "readingTo",
          trip.readingFrom
        );
      }
      restoreModalScroll();
    }}
  />
</label>

                            {trip.readingFromImage && (
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "#0f172a",
                                  fontWeight: 500,
                                  lineHeight: "20px",
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                }}
                                onClick={() => openFilePreview(trip.readingFromImage)}
                              >
                                {getFileLabel(trip.readingFromImage)}
                              </span>
                            )}
                          </div>

                        <input
  value={trip.readingFrom}
  disabled={!hasReadingFromImage}
  placeholder={
    hasReadingFromImage
      ? "Reading From"
      : "Upload image to enable"
  }
  onChange={(e) => {
    const value = e.target.value;

    updateTripDay(
      editingTripIndex!,
      "readingFrom",
      value
    );

    if (tripModalMode === "add") {
      updateTripDay(
        editingTripIndex!,
        "readingTo",
        value
      );
    }

    autoFillDistance(
      editingTripIndex!,
      value,
      trip.readingTo
    );
  }}
  style={{
    width: "100%",
    height: "46px",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "0 14px",
    fontSize: "14px",
    background: hasReadingFromImage ? "#fff" : "#f1f5f9",
  }}
/>
                        </div>

                      {tripModalMode === "edit" && (
  <div
    style={{
      border: "1px solid #d8dee8",
      borderRadius: "16px",
      padding: "12px",
      background: "#ffffff",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      justifyContent: "flex-start",
      alignSelf: "start",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "8px",
        minHeight: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          minWidth: 0,
          flex: 1,
        }}
      >
        <label
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#334155",
            cursor: "pointer",
            textDecoration: "underline",
            lineHeight: "20px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          Reading To
          <input
            hidden
            type="file"
            accept="image/*"
            onClick={saveModalScroll}
            onChange={(e) => {
              updateTripDay(
                editingTripIndex!,
                "readingToImage",
                e.target.files?.[0] || null
              );
              restoreModalScroll();
            }}
          />
        </label>

        {trip.readingToImage && (
          <span
            style={{
              fontSize: "12px",
              color: "#0f172a",
              fontWeight: 500,
              lineHeight: "20px",
              cursor: "pointer",
              textDecoration: "underline",
            }}
            onClick={() => openFilePreview(trip.readingToImage)}
          >
            {getFileLabel(trip.readingToImage)}
          </span>
        )}
      </div>
    </div>

    <input
      value={trip.readingTo}
      disabled={!trip.readingToImage}
      placeholder={
        trip.readingToImage
          ? "Reading To"
          : "Upload image to enable"
      }
      onChange={(e) => {
        const value = e.target.value;

       if (editingTripIndex === undefined) return;

updateTripDay(
  editingTripIndex,
  "readingTo",
  value
);

        autoFillDistance(
          editingTripIndex!,
          trip.readingFrom,
          value
        );
      }}
      style={{
        width: "100%",
        height: "46px",
        border: "1px solid #cbd5e1",
        borderRadius: "12px",
        padding: "0 14px",
        fontSize: "14px",
        background: trip.readingToImage
          ? "#fff"
          : "#f1f5f9",
      }}
    />
  </div>
)}
                      </div>
                    )}

                    {tripModalMode === "edit" && (
<div
  style={{
    display: "grid",
    gridTemplateColumns:
      window.innerWidth <= 768
        ? "1fr"
        : isOfficeVehicle
        ? "1fr 1fr"
        : "1fr",
    gap: "12px",
    marginTop: "14px",
  }}
>
                      {/* DISTANCE */}
                      <div
                        style={{
                          border: "1px solid #d8dee8",
                          borderRadius: "16px",
                          padding: "12px",
                          background: "#ffffff",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "#334155",
                          }}
                        >
                          Distance (Kms)
                        </div>

                        <input
                          type="number"
                          value={trip.distance}
                          disabled={!isPublicTransport}
                          placeholder={
                            isPublicTransport
                              ? "Enter Distance"
                              : "Auto calculated from readings"
                          }
                          onChange={(e) =>
                            updateTripDay(
                              editingTripIndex!,
                              "distance",
                              e.target.value || ""
                            )
                          }
                          style={{
                            width: "100%",
                            height: "46px",
                            border: "1px solid #cbd5e1",
                            borderRadius: "12px",
                            padding: "0 14px",
                            fontSize: "14px",
                            background: isPublicTransport ? "#fff" : "#f1f5f9",
                          }}
                        />
                      </div>

                      {/* FUEL (Only Office Vehicles) */}
                      {isOfficeVehicle && (
                        <div
                          style={{
                            border: "1px solid #d8dee8",
                            borderRadius: "16px",
                            padding: "12px",
                            background: "#ffffff",
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <label
                              style={{
                                fontSize: "14px",
                                fontWeight: 700,
                                color: "#334155",
                                cursor: "pointer",
                                textDecoration: "underline",
                              }}
                            >
                              Fuel Amount
                              <input
                                hidden
                                type="file"
                                accept="image/*"
                                onClick={saveModalScroll}
                                onChange={(e) => {
                                  updateTripDay(
                                    editingTripIndex!,
                                    "fuelImage",
                                    e.target.files?.[0] || null
                                  );
                                  restoreModalScroll();
                                }}
                              />
                            </label>

                            {trip.fuelImage && (
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "#0f172a",
                                  fontWeight: 500,
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                }}
                                onClick={() => openFilePreview(trip.fuelImage)}
                              >
                                {getFileLabel(trip.fuelImage)}
                              </span>
                            )}
                          </div>

                          <input
                            value={trip.fuelAmount}
                            disabled={!trip.fuelImage}
                            placeholder={
                              trip.fuelImage
                                ? "Enter Fuel Amount"
                                : "Upload bill image to enable"
                            }
                            onChange={(e) =>
                              updateTripDay(
                                editingTripIndex!,
                                "fuelAmount",
                                e.target.value || ""
                              )
                            }
                            style={{
                              width: "100%",
                              height: "46px",
                              border: "1px solid #cbd5e1",
                              borderRadius: "12px",
                              padding: "0 14px",
                              fontSize: "14px",
                              background: trip.fuelImage
                                ? "#fff"
                                : "#f1f5f9",
                            }}
                          />
                        </div>
                      )}
                    </div>
)}
                  </div>

                 {tripModalMode === "edit" && (
<div
  style={{
    marginTop: "8px",
    marginBottom: "12px",
    padding: "12px 14px",
    border: "1px solid #d8dee8",
    borderRadius: "16px",
    background: "#ffffff",
  }}
>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "#1e3a5f",
                        marginBottom: "2px",
                      }}
                    >
                      Visit Details
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                      }}
                    >
                      Add one or more client / party visit entries
                    </div>
                  </div>
                  )}
                 {tripModalMode === "edit" &&
  trip.visits.map((visit, visitIndex) => {

                    const isGeoTagged =
                      visit.latitude &&
                      visit.longitude &&
                      visit.latitude !== "" &&
                      visit.longitude !== "";


                    const hasVisitImage = !!visit.visitSlipImage;
                    const hasLocalTransportImage = !!visit.localTransportImage;
                    const hasGeo = !!visit.latitude && !!visit.longitude;
                    return (

                      <div
                        key={visitIndex}
                        style={{
                          border: "1px solid #d8dee8",
                          borderRadius: "16px",
                          padding: "12px",
                          background: "#f8fafc",
                          marginBottom: "10px",
                        }}

                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            alignItems: "center",
                            width: "100%",
                            marginBottom: "14px",
                            columnGap: "10px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "15px",
                              fontWeight: 700,
                              color: "#1e293b",
                              minWidth: 0,
                            }}
                          >
                            Client / Party {visitIndex + 1}
                          </div>

                          {trip.visits.length > 1 ? (
                            <IonButton
                              size="small"
                              color="danger"
                              fill="clear"
                              style={{
                                margin: 0,
                                justifySelf: "end",
                                minWidth: "70px",
                              }}
                              onClick={() => removeTripVisit(editingTripIndex, visitIndex)}
                            >
                              Remove
                            </IonButton>
                          ) : (
                            <div />
                          )}
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gap: "10px",
                          }}
                        >


                          <div
                            style={{
                              display: "grid",
                              gap: "10px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "10px",
                                  flexWrap: "wrap",
                                  minHeight: "24px",
                                }}
                              >
                                <label
                                  style={{
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    color: "#334155",
                                    cursor: "pointer",
                                    textDecoration: "underline",
                                    lineHeight: "20px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    marginRight: "4px",
                                  }}
                                >
                                  Client / Party Name
                                  <input
                                    hidden
                                    type="file"
                                    accept="image/*"
                                    onClick={saveModalScroll}
                                    onChange={(e) => {
                                      updateTripVisit(
                                        editingTripIndex!,
                                        visitIndex,
                                        "visitSlipImage",
                                        e.target.files?.[0] || null
                                      );
                                      restoreModalScroll();
                                    }}
                                  />
                                </label>

                                {visit.visitSlipImage && (
                                  <span
                                    style={{
                                      fontSize: "12px",
                                      color: "#0f172a",
                                      fontWeight: 500,
                                      lineHeight: "20px",
                                      cursor: "pointer",
                                      textDecoration: "underline",
                                    }}
                                    onClick={() => openFilePreview(visit.visitSlipImage)}
                                  >
                                    {getFileLabel(visit.visitSlipImage)}
                                  </span>
                                )}
                              </div>

                              <div style={{ width: "100%" }}>
                                <input
                                  value={visit.partyName}
                                  disabled={!visit.visitSlipImage}
                                  placeholder={
                                    visit.visitSlipImage
                                      ? "Enter Client / Party Name"
                                      : "Upload image to enable"
                                  }
                                  onChange={(e) =>
                                    updateTripVisit(
                                      editingTripIndex!,
                                      visitIndex,
                                      "partyName",
                                      e.target.value || ""
                                    )
                                  }
                                  style={{
                                    width: "100%",
                                    height: "46px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "12px",
                                    padding: "0 14px",
                                    fontSize: "14px",
                                    background: visit.visitSlipImage ? "#fff" : "#f1f5f9",
                                  }}
                                />
                              </div>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                                marginBottom: "12px",
                                width: "100%",
                              }}
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    window.innerWidth <= 768 ? "1fr" : "2fr 1fr",
                                  gap: "10px",
                                }}
                              >
                                {/* Location with Geo Tag */}
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "10px",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: "8px",
                                      flexWrap: "wrap",
                                      minHeight: "24px",
                                    }}
                                  >
                                    <label
                                      style={{
                                        fontSize: "14px",
                                        fontWeight: 700,
                                        color: "#334155",
                                        cursor: "pointer",
                                        textDecoration: "underline",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                      }}
                                      onClick={() => tagVisitLocation(editingTripIndex!, visitIndex)}
                                    >
                                      Location
                                    </label>

                                    {hasGeo && (
                                      <span
                                        style={{
                                          fontSize: "12px",
                                          color: "#0f172a",
                                          fontWeight: 500,
                                          lineHeight: "20px",
                                          cursor: "pointer",
                                          textDecoration: "underline",
                                        }}
                                        onClick={() =>
                                          window.open(
                                            `https://www.google.com/maps?q=${visit.latitude},${visit.longitude}`,
                                            "_blank"
                                          )
                                        }
                                      >
                                        {getGeoLabel(visit.latitude, visit.longitude)}
                                      </span>
                                    )}
                                  </div>

                                  <input
                                    value={visit.location}
                                    disabled={!hasGeo}
                                    placeholder={
                                      hasGeo ? "Enter Location" : "Click label to Geo Tag"
                                    }
                                    onChange={(e) =>
                                      updateTripVisit(
                                        editingTripIndex!,
                                        visitIndex,
                                        "location",
                                        e.target.value || ""
                                      )
                                    }
                                    style={{
                                      width: "100%",
                                      height: "46px",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: "12px",
                                      padding: "0 14px",
                                      fontSize: "14px",
                                      background: hasGeo ? "#fff" : "#f1f5f9",
                                    }}
                                  />
                                </div>

                                {/* Local Transport */}
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "10px",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: "8px",
                                      flexWrap: "wrap",
                                      minHeight: "24px",
                                    }}
                                  >
                                    <label
                                      style={{
                                        fontSize: "14px",
                                        fontWeight: 700,
                                        color: "#334155",
                                        cursor: "pointer",
                                        textDecoration: "underline",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                      }}
                                    >
                                      Loc Tran
                                      <input
                                        hidden
                                        type="file"
                                        accept="image/*"
                                        onClick={saveModalScroll}
                                        onChange={(e) => {
                                          updateTripVisit(
                                            editingTripIndex!,
                                            visitIndex,
                                            "localTransportImage",
                                            e.target.files?.[0] || null
                                          );
                                          restoreModalScroll();
                                        }}
                                      />
                                    </label>

                                    {visit.localTransportImage && (
                                      <span
                                        style={{
                                          fontSize: "12px",
                                          color: "#0f172a",
                                          fontWeight: 500,
                                          lineHeight: "20px",
                                          cursor: "pointer",
                                          textDecoration: "underline",
                                        }}
                                        onClick={() => openFilePreview(visit.localTransportImage)}
                                      >
                                        {getFileLabel(visit.localTransportImage)}
                                      </span>
                                    )}
                                  </div>

                                  <input
                                    type="number"
                                    value={visit.localTransportAmount || ""}
                                    disabled={!visit.localTransportImage}
                                    placeholder={
                                      visit.localTransportImage
                                        ? "Enter Amount"
                                        : "Upload bill to enable"
                                    }
                                    onChange={(e) =>
                                      updateTripVisit(
                                        editingTripIndex!,
                                        visitIndex,
                                        "localTransportAmount",
                                        e.target.value || ""
                                      )
                                    }
                                    style={{
                                      width: "100%",
                                      height: "46px",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: "12px",
                                      padding: "0 14px",
                                      fontSize: "14px",
                                      background: visit.localTransportImage ? "#fff" : "#f1f5f9",
                                    }}
                                  />
                                </div>
                              </div>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr",
                                  gap: "10px",
                                  width: "100%",
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      color: "#334155",
                                      marginBottom: "8px",
                                    }}
                                  >
                                    Visit From Time
                                  </div>

                                  <div
                                    onClick={() =>
                                      openVisitTimePicker(visitIndex, "visitFromTime")
                                    }
                                    style={{
                                      width: "100%",
                                      height: "46px",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: "12px",
                                      padding: "0 10px",
                                      outline: "none",
                                      fontSize: "14px",
                                      background: "#fff",
                                      color: visit.visitFromTime ? "#0f172a" : "#94a3b8",
                                      boxSizing: "border-box",
                                      display: "flex",
                                      alignItems: "center",
                                      cursor: "pointer",
                                    }}
                                  >
                                    {visit.visitFromTime || "Select time"}
                                  </div>
                                </div>

                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      color: "#334155",
                                      marginBottom: "8px",
                                    }}
                                  >
                                    Visit To Time
                                  </div>

                                  <div
                                    onClick={() =>
                                      openVisitTimePicker(visitIndex, "visitToTime")
                                    }
                                    style={{
                                      width: "100%",
                                      height: "46px",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: "12px",
                                      padding: "0 10px",
                                      outline: "none",
                                      fontSize: "14px",
                                      background: "#fff",
                                      color: visit.visitToTime ? "#0f172a" : "#94a3b8",
                                      boxSizing: "border-box",
                                      display: "flex",
                                      alignItems: "center",
                                      cursor: "pointer",
                                    }}
                                  >
                                    {visit.visitToTime || "Select time"}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gap: "10px",
                                marginTop: "2px",
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    color: "#334155",
                                    marginBottom: "8px",
                                  }}
                                >
                                  Demo Project
                                </div>

                                <IonSelect
                                  multiple
                                  interface="popover"
                                  value={visit.demoProjects}
                                  selectedText={
                                    !visit.demoProjects || visit.demoProjects.length === 0
                                      ? ""
                                      : visit.demoProjects.length <= 2
                                        ? visit.demoProjects.join(", ")
                                        : `${visit.demoProjects.slice(0, 2).join(", ")} +${visit.demoProjects.length - 2
                                        } more`
                                  }
                                  placeholder="Select Demo Project"
                                  onIonChange={(e) =>
                                    updateTripVisit(
                                      editingTripIndex,
                                      visitIndex,
                                      "demoProjects",
                                      e.detail.value || []
                                    )
                                  }
                                  style={{
                                    width: "100%",
                                    minHeight: "46px",
                                    height: "46px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "12px",
                                    padding: "0 12px",
                                    background: "#fff",
                                    color: "#0f172a",
                                    boxSizing: "border-box",
                                    overflow: "hidden",
                                  }}
                                >
                                  <IonSelectOption value="BEAT Visit">BEAT Visit</IonSelectOption>
                                  <IonSelectOption value="BOAT Visit">BOAT Visit</IonSelectOption>
                                  <IonSelectOption value="Skill Ascent  Visit">Skill Ascent Visit</IonSelectOption>
                                  <IonSelectOption value="Edvedha  Visit">Edvedha Visit</IonSelectOption>
                                  <IonSelectOption value="UNICODE  Visit">UNICODE Visit</IonSelectOption>
                                  <IonSelectOption value="BEAT Demo">BEAT Demo</IonSelectOption>
                                  <IonSelectOption value="BOAT Demo">BOAT Demo</IonSelectOption>
                                  <IonSelectOption value="Skill Ascent  Demo">Skill Ascent Demo</IonSelectOption>
                                  <IonSelectOption value="Edvedha  Demo">Edvedha Demo</IonSelectOption>
                                  <IonSelectOption value="UNICODE  Demo">UNICODE Demo</IonSelectOption>
                                  <IonSelectOption value="BEAT Serv.">BEAT Serv.</IonSelectOption>
                                  <IonSelectOption value="BOAT Serv.">BOAT Serv.</IonSelectOption>
                                  <IonSelectOption value="Skill Ascent  Serv.">Skill Ascent Serv.</IonSelectOption>
                                  <IonSelectOption value="Edvedha  Serv.">Edvedha Serv.</IonSelectOption>
                                  <IonSelectOption value="UNICODE  Serv.">UNICODE Serv.</IonSelectOption>

                                </IonSelect>
                              </div>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr",
                                  gap: "10px",
                                  alignItems: "end",
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      color: "#334155",
                                      marginBottom: "8px",
                                    }}
                                  >
                                    Contact Person Name
                                  </div>
                                  <input
                                    value={visit.contactPerson}
                                    placeholder="Enter Contact Person Name"
                                    onChange={(e) =>
                                      updateTripVisit(
                                        editingTripIndex,
                                        visitIndex,
                                        "contactPerson",
                                        e.target.value || ""
                                      )
                                    }
                                    style={{
                                      width: "100%",
                                      height: "46px",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: "12px",
                                      padding: "0 14px",
                                      outline: "none",
                                      fontSize: "14px",
                                      background: "#fff",
                                      color: "#0f172a",
                                      boxSizing: "border-box",
                                    }}
                                  />
                                </div>

                                <div>
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      color: "#334155",
                                      marginBottom: "8px",
                                    }}
                                  >
                                    Mobile Number
                                  </div>
                                  <input
                                    value={visit.mobile}
                                    placeholder="Enter Mobile Number"
                                    onChange={(e) =>
                                      updateTripVisit(
                                        editingTripIndex,
                                        visitIndex,
                                        "mobile",
                                        e.target.value || ""
                                      )
                                    }
                                    style={{
                                      width: "100%",
                                      height: "46px",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: "12px",
                                      padding: "0 14px",
                                      outline: "none",
                                      fontSize: "14px",
                                      background: "#fff",
                                      color: "#0f172a",
                                      boxSizing: "border-box",
                                    }}
                                  />
                                </div>
                              </div>
                              <div style={{ width: "100%" }}>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    color: "#334155",
                                    marginBottom: "8px",
                                  }}
                                >
                                  Remarks
                                </div>

                                <input
                                  value={visit.remarks}
                                  placeholder="Enter Remarks"
                                  onChange={(e) =>
                                    updateTripVisit(
                                      editingTripIndex,
                                      visitIndex,
                                      "remarks",
                                      e.target.value || ""
                                    )
                                  }
                                  style={{
                                    width: "100%",
                                    height: "46px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "12px",
                                    padding: "0 14px",
                                    outline: "none",
                                    fontSize: "14px",
                                    background: "#fff",
                                    color: "#0f172a",
                                    boxSizing: "border-box",
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      marginTop: "18px",
                      alignItems: "stretch",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                       gridTemplateColumns:
  tripModalMode === "add"
    ? "1fr"
    : "1fr 1fr",
                        gap: "10px",
                        marginTop: "18px",
                        width: "100%",
                      }}
                    >
                     {tripModalMode === "edit" && (
  <IonButton
    type="button"
    fill="outline"
    disabled={isTripFuture || !isFullyApproved(selectedDutyRow)}
    style={{
      margin: 0,
      width: "100%",
      minHeight: "46px",
      fontSize: "12px",
      opacity: isTripFuture || !isFullyApproved(selectedDutyRow) ? 0.5 : 1,
    }}
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isTripFuture) {
        notify("Visit entries are not allowed for future dates", "warning");
        return;
      }
      if (!isFullyApproved(selectedDutyRow)) {
        notify(
          "Visit entries can be added only after the request is fully approved",
          "warning"
        );
        return;
      }
      addTripVisit(editingTripIndex);
    }}
  >
    + Add Party
  </IonButton>
)}
                      <IonButton
                        style={{
                          margin: 0,
                          width: "100%",
                          minHeight: "46px",
                          fontSize: "12px",
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          saveDayTripModal();
                        }}
                        disabled={isSavingTrip.current}
                      >
                        Save Trip
                      </IonButton>
                    </div>
                  </div>

                  {/* Visit From/To Time picker - wheel modal, matching the
                      Camp From/To Date & Time picker's look/feel instead of
                      relying on the native <input type="time"> (which some
                      Android WebViews render as a bare text box with no
                      picker affordance). */}
                  <IonModal
                    isOpen={!!visitTimeModal}
                    onDidDismiss={() => setVisitTimeModal(null)}
                    className="native-date-modal"
                  >
                    <div className="native-date-modal-wrapper">
                      <IonDatetime
                        presentation="time"
                        hourCycle="h23"
                        preferWheel={true}
                        showDefaultButtons={true}
                        min={
                          visitTimeModal
                            ? (() => {
                                const b =
                                  visitTimeModal.field === "visitFromTime"
                                    ? visitFromTimeMin(visitTimeModal.visitIndex)
                                    : visitToTimeMin(visitTimeModal.visitIndex);
                                return b ? `2000-01-01T${b}:00` : undefined;
                              })()
                            : undefined
                        }
                        max={
                          visitTimeModal
                            ? (() => {
                                const b =
                                  visitTimeModal.field === "visitFromTime"
                                    ? visitFromTimeMax()
                                    : visitToTimeMax(visitTimeModal.visitIndex);
                                return b ? `2000-01-01T${b}:00` : undefined;
                              })()
                            : undefined
                        }
                        value={
                          visitTimeModal
                            ? `2000-01-01T${
                                hhmm(trip.visits[visitTimeModal.visitIndex]?.[visitTimeModal.field]) ||
                                (visitTimeModal.field === "visitFromTime"
                                  ? visitFromTimeMin(visitTimeModal.visitIndex)
                                  : visitToTimeMin(visitTimeModal.visitIndex)) ||
                                "00:00"
                              }:00`
                            : undefined
                        }
                        onIonChange={(e) => {
                          if (!visitTimeModal) return;
                          const val = String(e.detail.value || "");
                          const timePart = val.split("T")[1]?.slice(0, 5) || "";
                          updateTripVisit(
                            editingTripIndex!,
                            visitTimeModal.visitIndex,
                            visitTimeModal.field,
                            timePart
                          );
                        }}
                        onIonCancel={() => setVisitTimeModal(null)}
                      />
                    </div>
                  </IonModal>
                </>
              );
            })()}
          </IonContent>
        </IonModal>
        <IonModal
          isOpen={previewOpen}
          onDidDismiss={() => {
            setPreviewOpen(false);
            setPreviewFile(null);
          }}
        >
          <IonContent className="ion-padding">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#1f2937",
                }}
              >
                Image Preview
              </div>

              <IonButton
                fill="clear"
                size="small"
                onClick={() => {
                  setPreviewOpen(false);
                  setPreviewFile(null);
                }}
              >
                Close
              </IonButton>
            </div>

            {previewFile && (
              <img
                src={getPreviewUrl(previewFile)}
                alt="Preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: "80vh",
                  borderRadius: "12px",
                  display: "block",
                  margin: "0 auto",
                  objectFit: "contain",
                }}
              />
            )}
          </IonContent>
        </IonModal>
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

export default OnDuties;