// src/pages/OnDuties.tsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { apiService } from "../utils/apiService";

// "branch|dept", case- and whitespace-insensitive, so a row read out of
// tbl_Branch and a value read off Tbl_Employee still compare equal when
// they differ only in casing or a stray trailing space.
const branchKey = (branch: string, dept: string) =>
  `${String(branch ?? "").trim().toLowerCase()}|${String(dept ?? "").trim().toLowerCase()}`;

type ClientItem = { Client_ID: string; Client_Name: string };

// One row of tbl_Branch. `label` is both what the user reads and what
// gets saved, so the stored text is never a code nobody can decode.
type BranchOption = { id: string; branch: string; dept: string; label: string };

// Sources/* is [Authorize]d (the Workreport/OnDuty endpoints this page
// otherwise uses are not), so requests to it must carry the bearer token.
const authHeaders = () => {
  const raw =
    localStorage.getItem("token") ||
    localStorage.getItem("Token") ||
    sessionStorage.getItem("token") ||
    "";
  const token = raw.replace(/^"|"$/g, "");
  return token
    ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
    : {};
};

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

  // The code of whoever filed the request, which is not always one of the
  // people on it: a manager can put a team on duty without going himself.
  // Optional because an API that predates the field just omits it, and the
  // chips then render the way they always did.
  AppliedBy?: string;

  // The three branch-visit columns on tbl_On_Duties, served by
  // load_my_duties / load_duties_full. All optional: an API that predates
  // them simply omits them, and the card renders as it did before rather
  // than sprouting three empty labelled boxes.
  OnDutyType?: string;
  Branch?: string;
  // Day-of-month numbers only, "02,05,06" - the month is pinned by
  // DateFrom/DateTo. "" is a real answer meaning nothing was marked;
  // undefined means the record predates the column.
  AttDays?: string;
  // "Round Trip" / "Daily Shuttle". "" on office-vehicle duties, where the
  // form never asks.
  TripType?: string;
  // "Official Assignment" / "Employee Request". Only ever set on a plain
  // "Branch" duty.
  BranchChangeType?: string;

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

  // What the two date boxes held when the picker was opened.
  //
  // The picker no longer waits for Done before committing - it has to commit as
  // the wheels turn, because that is the only moment the 9:30 default can be
  // put on screen for the user to see. Which means Cancel has to actually undo
  // rather than just close, and this is what it undoes to.
  const dateModalSnapshot = useRef<{ from: string; to: string | null } | null>(null);

  // Bumped once per opening. The picker keeps its own copy of the value, so it
  // has to be rebuilt each time it is shown or it reappears on whatever the
  // last visit left on the wheels.
  const [dateModalOpenSeq, setDateModalOpenSeq] = useState(0);
  const [visitTimeModal, setVisitTimeModal] = useState<{ visitIndex: number; field: "visitFromTime" | "visitToTime" } | null>(null);


  const [institution, setInstitution] = useState<string>("");
  // What KIND of on-duty this is, kept separate from WHO it is for.
  // "Branch & Party" as a client name would be a client nobody can
  // invoice; as a type it is exactly the distinction the approver needs.
  const [onDutyType, setOnDutyType] = useState<string>("");
  // The chosen "Branch (Dept)" label. WHERE the duty starts from, as
  // opposed to onDutyType (what kind) and institution (who it is for).
  const [branchName, setBranchName] = useState<string>("");

  // Why the employee is at a different branch: sent there by the company, or
  // there at their own asking. Same facts on the duty either way - it is the
  // approver's read of it that changes, which is why it is stored rather than
  // inferred.
  const [branchChangeType, setBranchChangeType] = useState<string>("");

  // A plain "Branch" duty only. The two combined types are a branch visit with
  // client or party work attached, and the reason for the branch half of those
  // is already carried by the client or party being there - asking again would
  // be asking about something the form has already answered.
  const showBranchChangeType = onDutyType === "Branch";

  // An "Employee Request" branch change is the employee choosing to be at the
  // other branch rather than the company sending them, so there is no company
  // journey to account for: no transport to declare, no vehicle to record, no
  // days to claim attendance against. The three hide together because they are
  // three parts of one answer - hiding transport but still asking which days
  // were spent travelling would be asking about a journey the form has just
  // said does not exist.
  const showTravelFields = !(
    showBranchChangeType && branchChangeType === "Employee Request"
  );

  // Which of the two "where / who" fields the chosen type actually needs.
  // Branch shows for anything containing "Branch"; the client picker only
  // for the two Client variants. "Party" and "Official" need neither.
  // Nothing chosen yet shows both, so a fresh form and any record saved
  // before this field existed still offer every option.
  const showBranchField = onDutyType === "" || onDutyType.includes("Branch");
  const showClientField =
    onDutyType === "" || onDutyType === "Client" || onDutyType === "Branch & Client";

  // Day pills are only meaningful for a branch visit, where the point is which
  // days were spent away. Unlike the two flags above, an unchosen type hides
  // them: an empty form has no range worth spelling out day by day yet.
  const showDayPills = onDutyType.includes("Branch") && showTravelFields;

  // A branch visit already says where it went - the Branch field names the
  // place, and repeating it as free text only invites the two to disagree.
  // Same rule as showDayPills, inverted: any type containing "Branch" hides it.
  const showLocationField = !onDutyType.includes("Branch");
  const dayPillsRef = useRef<HTMLDivElement>(null);

  // Which days are marked for attendance. Keyed by the pill's own YYYY-MM-DD
  // rather than by index, so shifting the From date by a day cannot silently
  // re-point a selection at a different date.
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  // Day numbers loaded from a saved record ("02,05,06"), parked here until the
  // pills exist to attach them to. They cannot be applied inside editOnDuty:
  // the pills are derived from the date range that same call is still setting,
  // so at that moment there is nothing to match against. null means "nothing
  // to restore" and is what an unedited form, a cleared form, and a record
  // saved before this column existed all look like.
  const [pendingAttDays, setPendingAttDays] = useState<string | null>(null);

  // Set by the drag-scroll handler when the pointer actually travelled. A drag
  // across the strip ends in a click on whichever pill is under the finger, and
  // without this every scroll would toggle a day the user never aimed at.
  const dayDragMovedRef = useRef(false);

  // Exactly "Branch" means the whole stretch was spent at the branch, so every
  // day counts and pre-ticking them saves fifteen taps. "Branch & Client" and
  // "Branch & Party" mean the days were split between two places, so they start
  // empty and the user ticks only the ones that were actually at the branch -
  // guessing would put attendance nobody claimed into the record.
  const autoSelectAllDays = onDutyType === "Branch";

  // Once the user has touched a pill, the auto-fill stops overriding them -
  // otherwise un-ticking a day the pre-fill added would silently undo itself
  // the next time the date range moved.
  const daysTouchedRef = useRef(false);

  // The camp day the form assumes until told otherwise: in at 9:30, out at
  // 6:30. Held as numbers rather than a "09:30" string so no parsing has to
  // happen on the way to the picker, which wants a full timestamp anyway.
  const CAMP_DEFAULT_FROM_H = 9,  CAMP_DEFAULT_FROM_M = 30;   // 09:30
  const CAMP_DEFAULT_TO_H   = 18, CAMP_DEFAULT_TO_M   = 30;   // 18:30

  // Same idea as daysTouchedRef, for the two date boxes. Once either picker
  // has been used - or an existing duty has been opened for editing - the
  // default stops applying, so adding a second person to the team cannot
  // quietly undo a time somebody chose on purpose.
  const campTimesTouchedRef = useRef(false);

  const toggleDay = (key: string) => {
    if (dayDragMovedRef.current) return;
    daysTouchedRef.current = true;
    setSelectedDays((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };
  const [dutiesDesc, setDutiesDesc] = useState<string>("");
  const [transportMode, setTransportMode] = useState<string>("");

  // Out and back in one go, or the same hop repeated every day of the duty.
  // It changes what the mileage on the claim is supposed to look like, which
  // is why it sits next to Transport rather than in the trip details.
  const [tripType, setTripType] = useState<string>("");

  // Only asked for when the traveller is the one arranging the journey - own
  // vehicle or public transport. An office vehicle is booked, and the booking
  // already says whether the driver is coming back or shuttling, so asking
  // again here would just be a second answer that can disagree with the first.
  // The showTravelFields term is belt and braces: transportMode is cleared
  // when travel is hidden, but without this the trip type would still render
  // for the one frame between the branch change type changing and that clear
  // landing.
  // Note this is eligibility, not visibility: a duty can have a trip type and
  // still not be asked for one. See showTripType, further down.
  const tripTypeApplies =
    showTravelFields &&
    (transportMode === "PublicTransport" ||
      transportMode === "Own 2 Wheeler" ||
      transportMode === "Own 4 Wheeler");
  const [kms, setKms] = useState<string>("");
  const [vehicleNo, setVehicleNo] = useState<string>("");

  // The vehicles master, read once. This box used to be free text, which is
  // how one bike reached the claims desk as "AP16 1234", "ap161234" and
  // "AP-16-1234" on three different duties. It is a list now, narrowed to the
  // vehicles that could actually be on this duty.
  const [vehicleMaster, setVehicleMaster] = useState<any[]>([]);
  const [location, setLocation] = useState<string>("");
  const [sReading, setSReading] = useState<string>("");
  const [eReading, setEReading] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [team, setTeam] = useState<EmployeeItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  // The logged-in user's own branch|dept, normalized. Stays empty until it
  // resolves, and an empty key excludes nothing - a failed lookup leaves the
  // full list rather than a mysteriously short one.
  const [profileBranchKey, setProfileBranchKey] = useState<string>("");

  // You do not go on duty to the desk you already sit at, so the user's own
  // branch/dept is dropped from the picker. If the dept could not be resolved
  // the whole branch goes: without it there is no way to tell which of that
  // branch's rows is theirs, and offering all of them is the worse guess.
  const selectableBranches = useMemo(() => {
    if (!profileBranchKey) return branches;
    const [pBranch, pDept] = profileBranchKey.split("|");
    return branches.filter((b) =>
      pDept
        ? branchKey(b.branch, b.dept) !== profileBranchKey
        : b.branch.trim().toLowerCase() !== pBranch
    );
  }, [branches, profileBranchKey]);
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

// The To picker gets its own, wider ceiling: always 15 days past whatever the
// From date currently is, so a camp can run a fortnight without the wheel
// stopping dead at day 7. Built with moment rather than toISOString() because
// toISOString() converts to UTC first, which rolls the date back a day for any
// IST time before 05:30 - the exact bug maxDate above still has.
const maxToDate = moment(dutyFromDate || today).add(15, "days").format("YYYY-MM-DD");

// One entry per calendar day the duty spans. Derived from the From/To pair
// rather than held in its own state, so it can never drift out of step with
// the range the user actually picked.
const dutyDayPills = useMemo(() => {
  const from = moment(dutyFromDate);
  // No To date yet is a one-day duty, not an error - the form opens that way.
  const to = dutyToDate ? moment(dutyToDate) : from.clone();
  if (!from.isValid() || !to.isValid()) return [];

  const start = from.clone().startOf("day");
  const end = to.clone().startOf("day");
  // A backwards range is a half-finished edit, not something to render.
  if (end.isBefore(start)) return [];

  const days: { key: string; day: string; full: string }[] = [];
  // The picker caps a duty at 15 days past the From date; the 62 is only so a
  // mistyped year
  // cannot lock the page up building thousands of nodes.
  for (let d = start.clone(); !d.isAfter(end) && days.length < 62; d.add(1, "day")) {
    days.push({
      key: d.format("YYYY-MM-DD"),
      day: d.format("DD"),
      full: d.format("DD MMM YYYY"),
    });
  }
  return days;
}, [dutyFromDate, dutyToDate]);

// A duty that begins and ends on the same calendar day cannot be a shuttle:
// there is no second day to shuttle on. Round Trip is the only answer the
// form could accept, so it fills it in rather than putting up a dropdown whose
// one valid option is already chosen.
// No To date is a same-day duty, not an unfinished one - the form opens that
// way and a duty saved without ever touching the To picker is a single day.
const isSingleDayDuty = useMemo(() => {
  const from = moment(dutyFromDate);
  const to = dutyToDate ? moment(dutyToDate) : from.clone();
  // A half-typed date is not a same-day duty; better to leave the question on
  // screen than to silently answer it from a value that is not a date yet.
  if (!from.isValid() || !to.isValid()) return false;
  return from.isSame(to, "day");
}, [dutyFromDate, dutyToDate]);

// Eligible AND worth asking. Everything on screen keys off this; the payload
// and the pinning effect key off tripTypeApplies, because a single-day duty
// still carries a trip type - it just is not asked for one.
// "8 hrs 30 min", "45 min", "9 hrs". Minutes are dropped when there are none
// rather than printed as "9 hrs 0 min", which reads like a rounding artefact.
const fmtHM = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr${h === 1 ? "" : "s"}`;
  return `${h} hr${h === 1 ? "" : "s"} ${m} min`;
};

// How long the camp day actually runs, shown under the To picker.
//
// Only two shapes have an answer worth stating. A single-day duty, where From
// and To are the two ends of one stretch. And a Daily Shuttle, where the same
// clock window repeats on every day of the run. A multi-day Round Trip is one
// continuous absence rather than a daily window - the hours between leaving on
// Monday and returning on Thursday are not a working duration - so nothing is
// worked out for it and nothing is shown.
const campDuration = useMemo(() => {
  const from = dutyFromDate ? toIST(dutyFromDate) : null;
  const to = dutyToDate ? toIST(dutyToDate) : null;
  if (!from || !to || !from.isValid() || !to.isValid()) return null;

  const shuttle = tripTypeApplies && tripType === "Daily Shuttle";
  if (!isSingleDayDuty && !shuttle) return null;

  // Clock times only, never the whole timestamps. On a shuttle the two dates
  // are the first and last day of the run, so subtracting them would give the
  // length of the entire camp where what is wanted is one day of it. On a
  // single-day duty the dates are equal anyway, so the same arithmetic is
  // right for both.
  let mins = (to.hour() * 60 + to.minute()) - (from.hour() * 60 + from.minute());
  // Ending "before" it began means the day crosses midnight.
  if (mins < 0) mins += 24 * 60;
  // Same time in both boxes is a range nobody has filled in yet, not a camp of
  // no length. Better to show nothing than to announce "0 min".
  if (mins === 0) return null;

  // Per day only. A camp-wide total was there and has been taken out: it is
  // the same figure multiplied by a day count already visible in the pills,
  // and it invited being read as time owed rather than as a working window.
  return { mins, perDay: fmtHM(mins) };
}, [dutyFromDate, dutyToDate, isSingleDayDuty, tripType, tripTypeApplies]);

const showTripType = tripTypeApplies && !isSingleDayDuty;
const [tripModalMode, setTripModalMode] =
  useState<"add" | "edit">("add");

  

const [fromModal, setFromModal] = useState(false);
const [toModal, setToModal] = useState(false);

// custom dropdown states
const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);
const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
const [isTransportDropdownOpen, setIsTransportDropdownOpen] = useState(false);
const [isOnDutyTypeDropdownOpen, setIsOnDutyTypeDropdownOpen] = useState(false);
const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
const [isTripTypeDropdownOpen, setIsTripTypeDropdownOpen] = useState(false);
const [isBranchChangeTypeDropdownOpen, setIsBranchChangeTypeDropdownOpen] = useState(false);
const [isVehicleDropdownOpen, setIsVehicleDropdownOpen] = useState(false);

// Closed set. "Official Assignment" is the company moving someone;
// "Employee Request" is the employee asking to be moved.
const BRANCH_CHANGE_TYPE_OPTIONS = ["Official Assignment", "Employee Request"];

// Closed set, same as the on-duty types below. "Round Trip" is one journey
// out and one back; "Daily Shuttle" is that journey repeated on each day of
// the duty - the distinction the mileage is worked out from.
const TRIP_TYPE_OPTIONS = ["Round Trip", "Daily Shuttle"];

// Closed set, no free text. Anything outside these six is not a
// state this form is allowed to produce.
// Order is the one the user specified. It is not alphabetical and not
// singles-then-combinations, so do not "tidy" it into either.
const ONDUTY_TYPE_OPTIONS = [
  "Party",
  "Client",
  "Branch",
  "Branch & Party",
  "Branch & Client",
  // Duty that is none of the above - a court date, a government office, a
  // training session. Deliberately last rather than first: it is the
  // catch-all, and putting a catch-all at the top of a list makes people
  // stop reading before they reach the specific option they wanted.
  // Contains no "Branch", so it behaves exactly like "Party": free-text
  // Location, no branch picker, no day pills.
  "Official",
];

const [teamSearchTerm, setTeamSearchTerm] = useState("");
const [clientSearchTerm, setClientSearchTerm] = useState("");
const [branchSearchTerm, setBranchSearchTerm] = useState("");

const [teamDropdownPos, setTeamDropdownPos] = useState({ top: 0, left: 0, width: 0 });
const [clientDropdownPos, setClientDropdownPos] = useState({ top: 0, left: 0, width: 0 });
const [transportDropdownPos, setTransportDropdownPos] = useState({ top: 0, left: 0, width: 0 });
const [onDutyTypeDropdownPos, setOnDutyTypeDropdownPos] = useState({ top: 0, left: 0, width: 0 });
const [branchDropdownPos, setBranchDropdownPos] = useState({ top: 0, left: 0, width: 0 });
const [tripTypeDropdownPos, setTripTypeDropdownPos] = useState({ top: 0, left: 0, width: 0 });
const [branchChangeTypeDropdownPos, setBranchChangeTypeDropdownPos] = useState({ top: 0, left: 0, width: 0 });
const [vehicleDropdownPos, setVehicleDropdownPos] = useState({ top: 0, left: 0, width: 0 });

const teamTriggerRef = useRef<HTMLDivElement>(null);
const clientTriggerRef = useRef<HTMLDivElement>(null);
const transportTriggerRef = useRef<HTMLDivElement>(null);
const onDutyTypeTriggerRef = useRef<HTMLDivElement>(null);
const branchTriggerRef = useRef<HTMLDivElement>(null);
const tripTypeTriggerRef = useRef<HTMLDivElement>(null);
const branchChangeTypeTriggerRef = useRef<HTMLDivElement>(null);
const vehicleTriggerRef = useRef<HTMLDivElement>(null);

// useLayoutEffect, not useEffect. Every one of these dropdowns starts life at
// {top: 0, left: 0, width: 0}, and a portal renders into document.body the
// moment it opens - so with a plain effect the browser painted the list in the
// top left corner at zero width before the measurement landed, and it visibly
// jumped down to its field. Laying out before paint means the first frame is
// already in the right place; there is nothing to see jump.
useLayoutEffect(() => {
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
    if (isOnDutyTypeDropdownOpen && onDutyTypeTriggerRef.current) {
      const rect = onDutyTypeTriggerRef.current.getBoundingClientRect();
      setOnDutyTypeDropdownPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
    }
    if (isBranchDropdownOpen && branchTriggerRef.current) {
      const rect = branchTriggerRef.current.getBoundingClientRect();
      setBranchDropdownPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
    }
    if (isTripTypeDropdownOpen && tripTypeTriggerRef.current) {
      const rect = tripTypeTriggerRef.current.getBoundingClientRect();
      setTripTypeDropdownPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
    }
    if (isBranchChangeTypeDropdownOpen && branchChangeTypeTriggerRef.current) {
      const rect = branchChangeTypeTriggerRef.current.getBoundingClientRect();
      setBranchChangeTypeDropdownPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
    }
    if (isVehicleDropdownOpen && vehicleTriggerRef.current) {
      const rect = vehicleTriggerRef.current.getBoundingClientRect();
      setVehicleDropdownPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
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
}, [isTeamDropdownOpen, isClientDropdownOpen, isTransportDropdownOpen, isOnDutyTypeDropdownOpen, isBranchDropdownOpen, isTripTypeDropdownOpen, isBranchChangeTypeDropdownOpen, isVehicleDropdownOpen]);

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
  const loadBranches = async () => {
    try {
      const res = await api.get("Sources/Load_Branch", { headers: authHeaders() });
      // The controller returns Ok(JsonConvert.SerializeObject(...)) - a JSON
      // *string* - which axios only parses when the content type says so.
      const rows = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
      const raw = Array.isArray(rows) ? rows : [];
      setBranches(
        raw
          .map((x: any) => {
            // Positional, per the controller comment:
            // [0]=lid  [1]=Branch  [2]=BranchDept
            const branch = String(x[1] ?? "").trim();
            const dept = String(x[2] ?? "").trim();
            return {
              id: String(x[0]),
              branch,
              dept,
              // No dangling "()" for a branch with no dept recorded.
              label: dept ? `${branch} (${dept})` : branch,
            };
          })
          .filter((b: BranchOption) => b.branch !== "")
          // A-Z on the label, so a branch and its depts stay together and
          // the picker reads the same way every time regardless of what
          // order the proc happens to return rows in. numeric:true keeps
          // "Branch 10" after "Branch 2" instead of before it.
          .sort((a: BranchOption, b: BranchOption) =>
            a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" })
          )
      );
    } catch {
      // An empty table comes back as 400 from this endpoint, so no rows
      // is a normal outcome here rather than something worth shouting about.
      setBranches([]);
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

  // Stored day numbers paired back up with the duty's own date range, so a
  // bare "03" on a duty that crosses a month boundary can still say which
  // month it belongs to in its tooltip. Deliberately tolerant: a stored day
  // that falls outside the range still renders, showing the number alone,
  // because dropping it silently would look like the day was never marked.
  const attDayPills = (row: DutyRow): { day: string; full: string }[] => {
    const wanted = (row.AttDays || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (wanted.length === 0) return [];

    const from = moment(row.DateFrom);
    const to = row.DateTo ? moment(row.DateTo) : from.clone();
    if (!from.isValid() || !to.isValid() || to.isBefore(from, "day")) {
      return wanted.map((x) => ({ day: x, full: x }));
    }

    const byDay: Record<string, string> = {};
    // The 62 is only so a corrupt date range cannot spin here; a duty is
    // capped at 15 days by the picker.
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

  const mapDutyRows = (rawData: any[]): DutyRow[] =>
    rawData.map((d: any) => ({
      id: String(d.id),
      College: d.college || "",
      Description: d.description || "",
      Mode_of_Trans: d.mode || "",
      Vehicle_No: d.vehicle_No || "",
      Location: d.location || "",
      // Same defensive casing lookup as the RA fields below - these come
      // from an anonymous projection whose serialization we do not control.
      OnDutyType: pick(d, "onDutyType", "OnDutyType", "ondutyType"),
      Branch: pick(d, "branch", "Branch"),
      AttDays: pick(d, "attDays", "AttDays", "attDays_at_Branch"),
      TripType: pick(d, "tripType", "TripType"),
      BranchChangeType: pick(d, "branchChangeType", "BranchChangeType"),
      EmpCodes: pick(d, "empCodes", "EmpCodes"),
      AppliedBy: pick(d, "empCode", "EmpCode", "appliedBy", "AppliedBy"),
      // Same defensive casing lookup as the RA fields below: this
      // endpoint has been seen serializing the overall verdict as
      // "Status", and a bare d.status then falls through to "Pending"
      // on a record whose approval chain has actually completed.
      Status: pick(d, "status", "Status", "dutyStatus", "DutyStatus") || "Pending",
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

  // The applicant arrives from the API as a bare code, because that is all
  // tbl_On_Duties stores. The team list is the only place on this page a
  // code can be turned into a name, and it does not always hold the person
  // - an approver sees duties filed by people outside his own team - so the
  // code stands in when the lookup misses. A number on screen is poor, but
  // it is still an answer to "who arranged this", which is the question the
  // chip exists to answer.
  const nameForCode = (code: any) => {
    const c = String(code ?? "").trim();
    if (!c) return "";
    const who = team.find((e) => String(e.EmpCode ?? "").trim() === c);
    const raw = String(who?.EmpName ?? "").trim();
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
  const dutyPeople = (row: any) => {
    const chips = formatEmployeeNames(row?.empNames);
    // Compared on the code alone. The two sources spell names differently
    // often enough - casing, initials, spacing - that matching on the name
    // would quietly fail on exactly the rows it matters for.
    const applicant = String(row?.AppliedBy ?? "").trim();
    const onIt =
      !!applicant &&
      chips.some((c: any) => String(c.code ?? "").trim() === applicant);
    return { chips, applicant, assignedBy: applicant && !onIt ? applicant : "" };
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
  // The whole master, filtered on the screen rather than in a query: both
  // things that narrow it - the transport line and who is applying - change
  // while the form is open, and neither is worth a round trip.
  useEffect(() => {
    if (dateModalType) {
      dateModalSnapshot.current = { from: dutyFromDate, to: dutyToDate };
      setDateModalOpenSeq((n) => n + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateModalType]);

  const loadVehicleMaster = async () => {
    try {
      const res = await api.get("Sources/Load_Vehicles", { headers: authHeaders() });
      let raw: any = res.data;
      if (typeof raw === "string") {
        try {
          raw = JSON.parse(raw);
        } catch {
          raw = [];
        }
      }
      // Positional, the same contract the master screen reads it on:
      // [0]=VehId [1]=OwnedBy [2]=VehType [3]=VehNo [4]=VehModel [5]=PerKm
      setVehicleMaster(
        (Array.isArray(raw) ? raw : [])
          .map((r: any) => ({
            OwnedBy: String(r?.[1] ?? "").trim(),
            VehType: String(r?.[2] ?? "").trim(),
            VehNo: String(r?.[3] ?? "").trim(),
            VehModel: String(r?.[4] ?? "").trim(),
          }))
          .filter((v: any) => v.VehNo !== "")
      );
    } catch {
      // Quiet on purpose. An empty master is not an error the applicant can do
      // anything about, and the field handles it by letting them type instead.
      setVehicleMaster([]);
    }
  };

  // Codes are what the form stores and names are what people recognise, so
  // the translation happens in one place rather than at each spot that shows a
  // member. Falls back to the bare code while the roll is still loading.
  const nameForTeamCode = (code: string) => {
    const who = team.find((t: any) => String(t.EmpCode) === String(code));
    return String(who?.EmpName ?? "").trim() || String(code);
  };

  const selectedNames = useMemo(
    () => selectedCodes.map((c) => nameForTeamCode(c)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCodes, team]
  );

  // Which vehicles this duty could be on.
  //
  // "Office 4 Wheeler" means the office's four wheelers and nobody else's.
  // "Own 2 Wheeler" means the two wheelers belonging to the people actually
  // going: whoever is applying, plus anyone they have added to the duty. A
  // duty is often raised by one person for a group, and the bike that gets
  // ridden is not always the applicant's - restricting the list to the
  // applicant would leave the real vehicle untypeable.
  //
  // Public transport has no vehicle to pick, so the list is empty and the
  // field never opens.
  const vehicleOptions = useMemo(() => {
    const mode = String(transportMode ?? "").trim();
    if (!mode || mode === "PublicTransport") return [];
    const wantOffice = mode.toLowerCase().startsWith("office");
    const wantType = mode.includes("2 Wheeler") ? "2 wheeler" : "4 wheeler";

    const me = String(empCode ?? "").trim().toLowerCase();
    const travellers = new Set<string>([me, ...selectedCodes.map((c) => String(c ?? "").trim().toLowerCase())]);
    travellers.delete("");

    // Code -> name, so a list holding three people's bikes says whose is
    // whose. Falls back to the bare code when the roll has not loaded.
    const nameOf = (code: string) => {
      const who = team.find((t: any) => String(t.EmpCode ?? "").trim().toLowerCase() === code);
      return String(who?.EmpName ?? "").trim();
    };

    return vehicleMaster
      .filter((v: any) => {
        const owner = String(v.OwnedBy ?? "").trim().toLowerCase();
        const isOffice = owner === "office";
        if (isOffice !== wantOffice) return false;
        // A vehicle belonging to somebody who is not on this duty is not a
        // vehicle this duty can be taken in.
        if (!wantOffice && !travellers.has(owner)) return false;
        return String(v.VehType ?? "").trim().toLowerCase() === wantType;
      })
      .map((v: any) => {
        const owner = String(v.OwnedBy ?? "").trim().toLowerCase();
        return {
          ...v,
          _isMine: !wantOffice && owner === me,
          _ownerLabel: wantOffice ? "" : owner === me ? "Yours" : nameOf(owner) || String(v.OwnedBy ?? ""),
        };
      })
      // The applicant's own vehicles first - the common answer should not have
      // to be hunted for among the colleagues'.
      .sort((a: any, b: any) => (a._isMine === b._isMine ? 0 : a._isMine ? -1 : 1));
  }, [vehicleMaster, transportMode, empCode, selectedCodes, team]);

  useEffect(() => {
    if (userLoaded && empCode) {
      loadTeam();
      loadClients();
      loadBranches();
      loadDuties();
      loadVehicleMaster();

    }
  }, [userLoaded, empCode]);

  // A hidden field must stop contributing to the payload. Without this,
  // picking Branch, then switching the type to Party, would still save the
  // branch the user can no longer see - and no screen would ever show why.
  useEffect(() => {
    if (!showBranchField && branchName) setBranchName("");
    if (!showClientField && institution) setInstitution("");
    if (!showLocationField && location) setLocation("");
    // Switching Branch -> Branch & Client must not leave behind a reason for a
    // question the form has stopped asking.
    if (!showBranchChangeType && branchChangeType) setBranchChangeType("");
    // Changing the type re-opens the question of which days count, so the
    // user's earlier pill edits stop suppressing the auto-fill.
    daysTouchedRef.current = false;
    // Clients are fetched once on mount; if that call failed, this is the
    // moment it matters, so retry rather than open an empty picker.
    if (showClientField && clients.length === 0) loadClients();
  }, [onDutyType]);

  // A hidden field must stop contributing to the payload - same rule as the
  // effect above, applied to the whole travel block at once.
  useEffect(() => {
    if (showTravelFields) return;
    if (transportMode) setTransportMode("");
    if (vehicleNo) setVehicleNo("");
    if (tripType) setTripType("");
    if (kms) setKms("");
    if (sReading) setSReading("");
    if (eReading) setEReading("");
    if (selectedDays.length) setSelectedDays([]);
    // Reset alongside the clear, not instead of it: leaving this true would
    // mean switching back to Official Assignment brings the pills back empty,
    // because the auto-fill would read the days as deliberately unchosen.
    daysTouchedRef.current = false;
  }, [showTravelFields]);

  // Same rule as above, for the other question that hides itself: switching
  // from Own 4 Wheeler to Office 4 Wheeler must not leave a Daily Shuttle
  // behind on a journey the form has stopped asking about.
  //
  // The single-day branch is the opposite move - it writes a value into a
  // field nobody can see. That is deliberate: the trip type still has to reach
  // the database, and "Round Trip" is not a guess on a one-day duty, it is the
  // only thing it can be. A Daily Shuttle left over from when the range was
  // longer gets overwritten, which is the same answer that would have saved.
  useEffect(() => {
    if (!tripTypeApplies) {
      if (tripType) setTripType("");
      return;
    }
    if (isSingleDayDuty && tripType !== "Round Trip") setTripType("Round Trip");
  }, [transportMode, showTravelFields, isSingleDayDuty]);

  // The user's own branch comes off their employee record - the login payload
  // carries only code, name and designation. This waits on the branch list
  // because the dept has no fixed ordinal in the row and is found by matching
  // against depts we already know exist.
  useEffect(() => {
    if (!empCode || branches.length === 0) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await apiService.getEmployee(empCode);
        const row = Array.isArray(data)
          ? data[0]
          : data && Array.isArray(data.data)
            ? data.data[0]
            : data;
        if (!row || cancelled) return;

        // 53 = Location1, the branch NAME. Stable, unlike the dept below.
        const branch = Array.isArray(row)
          ? String(row[53] ?? "").trim()
          : String(row.Location1 ?? row._Location1 ?? "").trim();
        if (!branch) return;

        // BranchDept was appended to the END of Tbl_Employee, so its ordinal
        // moves with the next ALTER TABLE. Scan the tail for a value that is
        // a dept of THIS branch rather than hard-coding an index; 62 is the
        // highest ordinal anything relies on, so past it is newer columns.
        let dept = "";
        if (Array.isArray(row)) {
          const known = branches
            .filter((b) => b.branch.trim().toLowerCase() === branch.toLowerCase())
            .map((b) => b.dept.trim().toLowerCase())
            .filter((d) => d !== "");
          for (let i = row.length - 1; i > 62; i--) {
            const cell = String(row[i] ?? "").trim().toLowerCase();
            if (cell && known.includes(cell)) {
              dept = cell;
              break;
            }
          }
        } else {
          dept = String(row.BranchDept ?? row._BranchDept ?? "").trim();
        }

        if (!cancelled) setProfileBranchKey(branchKey(branch, dept));
      } catch {
        // No profile read, no exclusion. A full list beats a wrong one.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [empCode, branches]);

  useEffect(() => {
    if (team.length === 1) {
      setSelectedCodes([team[0].EmpCode]);
    }
  }, [team]);

  // Picking a team is the point where the form stops being empty, so that is
  // where the camp day gets its default hours: 9:30 in, 6:30 out. Only the
  // TIME is decided here - the date stays whatever is already in the box, so
  // choosing a date first and a team second does not throw the date away.
  useEffect(() => {
    if (!selectedCodes.length) return;
    // An existing duty already has its own times; they arrived from the
    // database and are not ours to replace.
    if (editingId) return;
    if (campTimesTouchedRef.current) return;

    const base = dutyFromDate && toIST(dutyFromDate).isValid() ? toIST(dutyFromDate) : nowIST();
    const from = base.clone()
      .hour(CAMP_DEFAULT_FROM_H).minute(CAMP_DEFAULT_FROM_M).second(0).millisecond(0);
    // 9:30 that has already gone by is not a default anybody can use - saving
    // is blocked on a From time in the past - so it moves to the next day
    // instead of filling the box with something that has to be fixed first.
    if (!unlockRange.approved && from.isBefore(nowIST())) from.add(1, "day");
    const to = from.clone()
      .hour(CAMP_DEFAULT_TO_H).minute(CAMP_DEFAULT_TO_M).second(0).millisecond(0);

    setDutyFromDate(from.toISOString(true));
    setDutyToDate(to.toISOString(true));
    // Deliberately NOT depending on dutyFromDate: this writes to it, and
    // watching what it writes would be a loop. Re-running on a team change
    // recomputes the same two moments anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCodes.length, editingId, unlockRange.approved]);

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
    // Transport and vehicle are only required while they are on screen - an
    // Employee Request branch change has neither, and demanding them would
    // make it unsavable with no visible field to fix.
    if ((showClientField && !institution) || !dutiesDesc || (showTravelFields && !transportMode) || (showLocationField && !location) || !empCode || !dutyFromDate || !dutyToDate
      || (
      showTravelFields &&
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
      notify("Camp From must be a future time", "warning");
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
      _OnDutyType: onDutyType,
      _Branch: branchName,
      // Day numbers only, ascending, taken from the pill list rather than from
      // selectedDays directly - the pills are already in date order and already
      // carry the zero-padded DD, so this cannot emit "2,10,3". Non-branch
      // types send "" rather than being left out, so that re-saving an old
      // branch duty as a client duty actually clears the days it used to have.
      _AttDaysAtBranch: showDayPills
        ? dutyDayPills
            .filter((d) => selectedDays.includes(d.key))
            .map((d) => d.day)
            .join(",")
        : "",
      // "" on an office-vehicle duty rather than omitted, so re-saving a duty
      // whose transport changed actually clears the trip type it used to have.
      _TripType: tripTypeApplies ? tripType : "",
      // Same reasoning as _TripType: "" rather than omitted, so re-saving a
      // duty as a different type clears a reason that no longer applies.
      _BranchChangeType: showBranchChangeType ? branchChangeType : "",
    };

    try {
      const res = await postWithFallback("OnDuty/saveduties", payload);

      // A double booking comes back as 200 with a CONFLICT: prefix rather than
      // an error status, because postWithFallback retries and then discards
      // non-2xx bodies - which would reduce this to "Submission failed" and
      // leave nobody knowing which day or whose duty. Nothing is cleared: the
      // dates should be correctable without retyping the whole request.
      const body = String(res.data ?? "");
      if (body.startsWith("CONFLICT:")) {
        // The API only knows employee codes. Names live in the team list here,
        // so the swap happens on this side, and only on the codes ahead of
        // " on request" - a request number is digits too, and so is a year.
        const detail = body
          .slice("CONFLICT:".length)
          .split("; ")
          .map((seg) => {
            const at = seg.indexOf(" on request");
            if (at < 0) return seg;
            const named = seg
              .slice(0, at)
              .split(",")
              .map((c) => c.trim())
              .map((c) => {
                const who = team.find((e) => String(e.EmpCode) === c);
                return who ? `${who.EmpName} (${c})` : c;
              })
              .join(", ");
            return named + seg.slice(at);
          })
          .join("; ");

        notify(`Already on duty for these dates: ${detail}`, "danger");
        return;
      }

      if (isSaveOk(res.data)) {
        // The duty row itself saved, but the branch columns did not - almost
        // always AttDays_at_Branch being too narrow for a long camp. Saying
        // "submitted successfully" here would send someone away believing
        // attendance was recorded when none of it was.
        const warn = String(res.data ?? "").split("|WARN:")[1];
        if (warn) {
          notify(`Saved, but branch details were not stored: ${warn}`, "warning");
        } else {
          notify("On-Duty request submitted successfully", "success");
        }
        clearOnDutyForm();
        loadDuties();
      } else {
        // Previously silent: a save the API declined left the button looking
        // like it had worked and the form still full.
        notify("Could not save the request - please try again", "danger");
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

      // Type, branch and marked days come from their own endpoint keyed by
      // name, not from extra positions on the row above - App_Get_Duties'
      // column order is not ours to depend on. Awaited before any setState so
      // the whole record lands in one render: split across two commits, the
      // type change would reset daysTouchedRef after the days were restored
      // and the auto-fill would immediately overwrite them.
      let extra: any = null;
      try {
        const ex = await api.get("OnDuty/get_onduty_extra", {
          params: { id },
          headers: authHeaders(),
        });
        extra = ex.data ?? null;
      } catch {
        // An API build without this endpoint yet. Fall back to the row values
        // rather than failing the whole edit.
      }

      const row = Array.isArray(res.data) && res.data[0] ? res.data[0] : null;

      if (row) {
        setEditingId(String(row[0]));
        // Belt and braces with the editingId guard in the defaults effect:
        // the stored times win, whichever order the two states commit in.
        campTimesTouchedRef.current = true;
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
        setOnDutyType(extra ? extra.onDutyType || "" : row[16] || "");
        setBranchName(extra ? extra.branch || "" : row[17] || "");
        // undefined (no endpoint) and null (column never written for this row)
        // both mean "no stored answer", so leave the defaults to decide. Only a
        // real string - including "" - counts as a selection to restore.
        setPendingAttDays(
          extra && typeof extra.attDays === "string" ? extra.attDays : null
        );
        // Safe to set before setTransportMode below: both land in the same
        // commit, so the effect that clears a trip type on a hidden field
        // sees the restored transport mode, not the one being replaced.
        setTripType(extra ? extra.tripType || "" : "");
        setBranchChangeType(extra ? extra.branchChangeType || "" : "");
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
    setSelectedDays([]);
    setPendingAttDays(null);
    daysTouchedRef.current = false;
    campTimesTouchedRef.current = false;
    setInstitution("");
    setOnDutyType("");
    setBranchName("");
    setBranchChangeType("");
    setDutiesDesc("");
    setTransportMode("");
    setTripType("");
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
  // The pill strip scrolls sideways, but overflow-x alone only gets you there on
  // a touchscreen. Its scrollbar is hidden (a normal one is wider than the strip
  // is tall), so on desktop there is no visible handle to drag and a mouse wheel
  // only ever produces deltaY, which a horizontal scroller ignores - the row
  // looks frozen with its last pills cut off. These two listeners give the strip
  // the gestures it is missing: a vertical wheel scrolls it sideways, and it can
  // be dragged directly like a map.
  useEffect(() => {
    const el = dayPillsRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Nothing to scroll: leave the page's own scroll alone.
      if (el.scrollWidth <= el.clientWidth) return;
      // A trackpad already sends deltaX for a sideways swipe; only translate the
      // gesture when the wheel is genuinely vertical, or two-finger scrolling
      // over this strip would move it twice as fast as the finger.
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      el.scrollLeft += e.deltaY;
      // Without this the page scrolls too, and the strip appears to fight it.
      // Requires the passive:false below - preventDefault is a no-op otherwise.
      e.preventDefault();
    };

    let startX = 0;
    let startLeft = 0;
    let dragging = false;
    let captured = false;

    const onPointerDown = (e: PointerEvent) => {
      // Touch is left to the browser's native momentum scrolling, which feels
      // better than anything reconstructed from pointer deltas.
      if (e.pointerType === "touch") return;
      if (el.scrollWidth <= el.clientWidth) return;
      dragging = true;
      captured = false;
      dayDragMovedRef.current = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
      el.style.cursor = "grabbing";
      // Deliberately NOT capturing the pointer here. Capturing on pointerdown
      // retargets everything that follows - including the click - to this
      // container, so the click never reaches the pill underneath and a plain
      // tap on a day did nothing at all. Capture is deferred to the moment the
      // pointer has actually moved, below, where it earns its keep by keeping
      // the drag alive if the cursor leaves the strip.
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      // 4px of slack: a click is never perfectly still, and treating the
      // shake of a mouse press as a drag would swallow legitimate taps.
      if (!dayDragMovedRef.current && Math.abs(dx) > 4) {
        dayDragMovedRef.current = true;
        // Past the threshold this is unambiguously a drag, so there is no
        // click left to protect and capture is safe to take.
        el.setPointerCapture(e.pointerId);
        captured = true;
      }
      if (!dayDragMovedRef.current) return;
      el.scrollLeft = startLeft - dx;
    };

    const endDrag = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      // releasePointerCapture throws if the pointer is already gone.
      // Only release what was actually taken - releasePointerCapture throws
      // for a pointer that was never captured, which is now the common case.
      if (captured) {
        try { el.releasePointerCapture(e.pointerId); } catch { /* already released */ }
        captured = false;
      }
      el.style.cursor = "";
      // The click event fires after pointerup, so the flag has to survive just
      // long enough to be read by it and no longer.
      window.setTimeout(() => { dayDragMovedRef.current = false; }, 0);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
    };
    // Re-binds when the strip mounts or its contents change length, since the
    // element is unmounted entirely whenever the type is not a branch visit.
  }, [showDayPills, dutyDayPills.length]);

  // Second half of the edit-time restore. Stored day numbers are matched back
  // against the pills rather than parsed into dates directly, so a stored day
  // that is not in the loaded range simply does not come back instead of
  // becoming a selection for a date the form cannot show.
  // Declared above the auto-fill below on purpose: effects run in source order
  // within a commit, so this marks the days as user-chosen before the auto-fill
  // gets its turn to decide they are not.
  useEffect(() => {
    if (pendingAttDays === null) return;
    if (dutyDayPills.length === 0) return;

    const wanted = new Set(
      pendingAttDays
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );

    daysTouchedRef.current = true;
    setSelectedDays(
      dutyDayPills.filter((d) => wanted.has(d.day)).map((d) => d.key)
    );
    setPendingAttDays(null);
  }, [pendingAttDays, dutyDayPills]);

  // Narrowing the date range has to take its days' selections with it, or the
  // form would keep marking attendance for dates that are no longer part of the
  // duty and that nobody can see to un-mark. Pruning rather than clearing means
  // widening a range, or nudging one end, leaves the other days alone.
  useEffect(() => {
    // Both defaults run here rather than on the type change alone, so that
    // extending the range afterwards brings the new days in matching whatever
    // the type implies instead of arriving in the opposite state.
    if (!daysTouchedRef.current && showDayPills) {
      // An explicit empty set for the combined types, not just "leave it
      // alone": switching from Branch to Branch & Client has to drop the days
      // the pre-fill added, or the user would silently keep a full month of
      // branch attendance they never chose under a type that contradicts it.
      setSelectedDays(autoSelectAllDays ? dutyDayPills.map((d) => d.key) : []);
      return;
    }
    const valid = new Set(dutyDayPills.map((d) => d.key));
    setSelectedDays((prev) => {
      const kept = prev.filter((k) => valid.has(k));
      // Same contents means same array - returning a fresh one every render
      // would re-trigger anything downstream that watches this state.
      return kept.length === prev.length ? prev : kept;
    });
  }, [dutyDayPills, autoSelectAllDays, showDayPills]);

  const history = useHistory();
  return (
    <div className="onduties-page">
      <div className="onduties-content">
        <div style={{ display: "flex", gap: "1px", marginTop: "5px" }}>
        </div>


        <div className="page-container">
          <h2 style={{ margin: 0, fontWeight: 700 }}>On Duty Manager</h2>
          <div>

            <div className="lr-bento-grid" style={{ alignItems: "start", marginBottom: "20px" }}>
              {/* Team Members */}
              <div className="lr-field-box" onClick={() => setIsTeamDropdownOpen(!isTeamDropdownOpen)}>
                {/* The count sits on the label, the way Days carries its own.
                    The field line underneath shows who; this shows how many at
                    a glance, without the eye having to travel down and count
                    "+2" back into a total. Hidden at zero rather than showing
                    (0) - an empty count is noise, and "Select Team" below is
                    already saying the same thing. */}
                <label className="lr-field-label">
                  Team Members
                  {selectedCodes.length > 0 && (
                    <span style={{ marginLeft: "4px", opacity: 0.75 }}>
                      ({selectedCodes.length})
                    </span>
                  )}
                </label>
                <div className="lr-field-content" ref={teamTriggerRef}>
                  <IonIcon icon={peopleOutline} className="lr-field-icon" />
                  {team.length > 1 ? (
                    <>
                      {/* Who, not how many. "2 Selected" meant opening the
                          list again just to remember which two people it was. */}
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: "14px",
                          fontWeight: "500",
                          color: selectedCodes.length ? "#1e293b" : "#94a3b8",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={selectedNames.join(", ")}
                      >
                        {selectedCodes.length === 0
                          ? "Select Team"
                          : selectedCodes.length === 1
                          ? selectedNames[0]
                          : `${selectedNames[0]}  +${selectedCodes.length - 1}`}
                      </span>
                      <ChevronDown size={16} style={{ opacity: 0.7, color: "#94a3b8" }} />

                      {isTeamDropdownOpen && createPortal(
                        <>
                          <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsTeamDropdownOpen(false); }} />
                          {/* A click inside a portal still travels up the React
                              tree to the field box, whose onClick toggles this
                              list - so ticking one person closed the list and
                              the next person meant opening it again. Stopped
                              here, because this is a multi-select: it should
                              close when the user says so, not on every tick. */}
                          <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${teamDropdownPos.top}px`, left: `${teamDropdownPos.left}px`, width: `${teamDropdownPos.width}px`, visibility: teamDropdownPos.width ? 'visible' : 'hidden' }}>
                            <div className="dropdown-search-sec">
                              <Search size={16} className="dropdown-search-icon" />
                              <input type="text" placeholder="Search team..." value={teamSearchTerm} onChange={(e) => setTeamSearchTerm(e.target.value)} autoFocus className="dropdown-pure-input" />
                              {teamSearchTerm && <button className="dropdown-clear-btn" onClick={() => setTeamSearchTerm("")}><X size={16} /></button>}
                            </div>
                            {/* The people already on the duty, spelled out.
                                Removing somebody here does not need them found
                                in the list below first - which is how the wrong
                                name ends up staying on a duty. */}
                            {selectedCodes.length > 0 && (
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "6px",
                                  padding: "8px 10px",
                                  borderBottom: "1px solid rgba(0,0,0,0.06)",
                                  maxHeight: "92px",
                                  overflowY: "auto",
                                }}
                              >
                                {selectedCodes.map((code) => (
                                  <span
                                    key={code}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      maxWidth: "100%",
                                      background: "#eef2ff",
                                      color: "#3730a3",
                                      border: "1px solid #c7d2fe",
                                      borderRadius: "20px",
                                      padding: "3px 6px 3px 10px",
                                      fontSize: "11px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {nameForTeamCode(code)}
                                    </span>
                                    <button
                                      type="button"
                                      aria-label={`Remove ${nameForTeamCode(code)}`}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setSelectedCodes(selectedCodes.filter((c) => c !== code));
                                      }}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        border: "none",
                                        background: "transparent",
                                        color: "inherit",
                                        cursor: "pointer",
                                        padding: 0,
                                        lineHeight: 0,
                                      }}
                                    >
                                      <X size={12} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
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

              {/* On-duty Type */}
              <div className="lr-field-box" onClick={() => setIsOnDutyTypeDropdownOpen(!isOnDutyTypeDropdownOpen)}>
                <label className="lr-field-label">On-duty Type</label>
                <div className="lr-field-content" ref={onDutyTypeTriggerRef}>
                  <IonIcon icon={businessOutline} className="lr-field-icon" />
                  <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: onDutyType ? "#1e293b" : "#94a3b8" }}>
                    {onDutyType || "Select On-duty Type"}
                  </span>
                  <ChevronDown size={16} style={{ opacity: 0.7, color: "#94a3b8" }} />

                  {isOnDutyTypeDropdownOpen && createPortal(
                    <>
                      <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsOnDutyTypeDropdownOpen(false); }} />
                      <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${onDutyTypeDropdownPos.top}px`, left: `${onDutyTypeDropdownPos.left}px`, width: `${onDutyTypeDropdownPos.width}px`, visibility: onDutyTypeDropdownPos.width ? 'visible' : 'hidden' }}>
                        {/* No search box - a short fixed list does not need one,
                            and an empty search field reads as "more to find". */}
                        <div className="dropdown-body">
                          {ONDUTY_TYPE_OPTIONS.map((name, index) => {
                            const isSelected = onDutyType === name;
                            return (
                              <div
                                key={name}
                                className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setOnDutyType(name);
                                  setIsOnDutyTypeDropdownOpen(false);
                                }}
                              >
                                <div className={`dr-avatar grad-${(index % 5) || 0}`}>{name.charAt(0).toUpperCase()}</div>
                                <div className="dr-info">
                                  <span className="dr-name">{name}</span>
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

              {/* Branch Change Type - plain "Branch" duties only, see
                  showBranchChangeType. Directly after On-duty Type because it
                  only exists as a follow-up to one of its answers. */}
              {showBranchChangeType && (
                <div className="lr-field-box" onClick={() => setIsBranchChangeTypeDropdownOpen(!isBranchChangeTypeDropdownOpen)}>
                  <label className="lr-field-label">Branch Change Type</label>
                  <div className="lr-field-content" ref={branchChangeTypeTriggerRef}>
                    <IonIcon icon={documentTextOutline} className="lr-field-icon" />
                    <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: branchChangeType ? "#1e293b" : "#94a3b8" }}>
                      {branchChangeType || "Select Change Type"}
                    </span>
                    <ChevronDown size={16} style={{ opacity: 0.7, color: "#94a3b8" }} />

                    {isBranchChangeTypeDropdownOpen && createPortal(
                      <>
                        <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsBranchChangeTypeDropdownOpen(false); }} />
                        <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${branchChangeTypeDropdownPos.top}px`, left: `${branchChangeTypeDropdownPos.left}px`, width: `${branchChangeTypeDropdownPos.width}px`, visibility: branchChangeTypeDropdownPos.width ? 'visible' : 'hidden' }}>
                          <div className="dropdown-body" style={{ height: 'auto', maxHeight: '180px' }}>
                            {BRANCH_CHANGE_TYPE_OPTIONS.map((name, index) => {
                              const isSelected = branchChangeType === name;
                              return (
                                <div
                                  key={name}
                                  className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setBranchChangeType(name);
                                    setIsBranchChangeTypeDropdownOpen(false);
                                  }}
                                >
                                  <div className={`dr-avatar grad-${(index % 5) || 0}`}>{name.charAt(0).toUpperCase()}</div>
                                  <div className="dr-info">
                                    <span className="dr-name">{name}</span>
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
              )}

              {/* Branch */}
              {showBranchField && (
              <div className="lr-field-box" onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}>
                <label className="lr-field-label">Branch</label>
                <div className="lr-field-content" ref={branchTriggerRef}>
                  <IonIcon icon={businessOutline} className="lr-field-icon" />
                  <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: branchName ? "#1e293b" : "#94a3b8" }}>
                    {branchName || "Select Branch"}
                  </span>
                  <ChevronDown size={16} style={{ opacity: 0.7, color: "#94a3b8" }} />

                  {isBranchDropdownOpen && createPortal(
                    <>
                      <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsBranchDropdownOpen(false); }} />
                      <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${branchDropdownPos.top}px`, left: `${branchDropdownPos.left}px`, width: `${branchDropdownPos.width}px`, visibility: branchDropdownPos.width ? 'visible' : 'hidden' }}>
                        <div className="dropdown-search-sec">
                          <Search size={16} className="dropdown-search-icon" />
                          <input type="text" placeholder="Search branch..." value={branchSearchTerm} onChange={(e) => setBranchSearchTerm(e.target.value)} autoFocus className="dropdown-pure-input" />
                          {branchSearchTerm && <button className="dropdown-clear-btn" onClick={() => setBranchSearchTerm("")}><X size={16} /></button>}
                        </div>
                        <div className="dropdown-body">
                          {(() => {
                            const term = branchSearchTerm.toLowerCase();
                            // Match on the label so typing either the branch
                            // or the dept narrows the list.
                            const options = selectableBranches.filter((b) => b.label.toLowerCase().includes(term));
                            return options.length > 0 ? (
                              options.map((b, index) => {
                                const isSelected = branchName === b.label;
                                return (
                                  <div
                                    key={`${b.id}-${index}`}
                                    className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setBranchName(b.label);
                                      setIsBranchDropdownOpen(false);
                                    }}
                                  >
                                    <div className={`dr-avatar grad-${(index % 5) || 0}`}>{(b.branch.charAt(0) || "?").toUpperCase()}</div>
                                    <div className="dr-info">
                                      <span className="dr-name">{b.branch}</span>
                                      {b.dept && <span className="dr-id">{b.dept}</span>}
                                    </div>
                                    {isSelected && <Check size={18} className="dr-check" />}
                                  </div>
                                );
                              })
                            ) : <div className="dr-no-results">No branches found</div>;
                          })()}
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              </div>
              )}

              {/* Client / Institution */}
              {showClientField && (
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
                      <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${clientDropdownPos.top}px`, left: `${clientDropdownPos.left}px`, width: `${clientDropdownPos.width}px`, visibility: clientDropdownPos.width ? 'visible' : 'hidden' }}>
                        <div className="dropdown-search-sec">
                          <Search size={16} className="dropdown-search-icon" />
                          <input type="text" placeholder="Search client..." value={clientSearchTerm} onChange={(e) => setClientSearchTerm(e.target.value)} autoFocus className="dropdown-pure-input" />
                          {clientSearchTerm && <button className="dropdown-clear-btn" onClick={() => setClientSearchTerm("")}><X size={16} /></button>}
                        </div>
                        <div className="dropdown-body">
                          {(() => {
                            const term = clientSearchTerm.toLowerCase();
                            // Real clients only. Branch / Party / the combinations
                            // are the On-duty Type now, not names of a client.
                            const options = clients.filter((c: any) =>
                              String(c.Client_Name ?? "").toLowerCase().includes(term)
                            );
                            return options.length > 0 ? (
                            options.map((c: any, index: number) => {
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
                          ) : <div className="dr-no-results">No clients found</div>;
                          })()}
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              </div>
              )}

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
                <label className="lr-field-label">Camp From</label>
                <div className="lr-field-content">
                  <IonIcon icon={calendarOutline} className="lr-field-icon" />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: dutyFromDate ? "#1e293b" : "#94a3b8" }}>
                    {dutyFromDate ? moment(dutyFromDate).format("DD-MM-YYYY HH:mm") : "Pick From Date & Time"}
                  </span>
                </div>
              </div>

              <div className="lr-field-box" onClick={() => setDateModalType("to")} style={{ cursor: "pointer" }}>
                {/* Duration sits on the label line rather than under the
                    field, so the box itself stays the same height as Camp
                    From beside it and the two rows do not go ragged. */}
                <label className="lr-field-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  Camp To
                  {campDuration && (
                    <span style={{ marginLeft: "auto", textTransform: "none", letterSpacing: "normal", color: "#64748b" }}>
                      {campDuration.perDay} a day
                    </span>
                  )}
                </label>
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
                  {/* IonDatetime keeps its own copy of the value, and this
                      modal is mounted for the life of the page rather than
                      created per open - so a value written from outside leaves
                      the wheels sitting where the user last left them. The key
                      forces a rebuild at the two moments that matters.

                      Every opening, via the counter: whichever box is being
                      shown starts from what it actually holds.

                      And, for Camp From only, whenever its date changes - that
                      is the moment its time is being overridden to 9:30, and a
                      rebuild is what puts that on the wheels.

                      Camp To is deliberately NOT keyed on its date. Nothing
                      overrides its time while it is open, so rebuilding it
                      mid-scroll would only interrupt the drag - which is what
                      made its date wheel stutter and snap back. */}
                  <IonDatetime
                    key={`${dateModalType ?? "none"}|${dateModalOpenSeq}|${
                      dateModalType === "from"
                        ? String(dutyFromDate || "").split("T")[0]
                        : ""
                    }`}
                    presentation="date-time"
                    hourCycle="h23"
                    preferWheel={true}
                    value={dateModalType === "from" ? dutyFromDate : dutyToDate}
                    min={dateModalType === "from" ? (unlockRange.approved ? unlockRange.fromDate : nowIST().toISOString(true)) : (dutyFromDate === unlockRange.fromDate ? unlockRange.fromDate : (dutyFromDate || nowIST().toISOString(true)))}
                    max={dateModalType === "from" ? maxDate : (dutyFromDate === unlockRange.fromDate ? unlockRange.toDate : maxToDate)}
                    isDateEnabled={dateModalType === "from" ? ((dateString) => {
                      const date = dateString.split("T")[0];
                      if (date === dutyFromDate) return true;
                      const todayStr = nowIST().format("YYYY-MM-DD");
                      if (unlockRange.approved && date >= unlockRange.fromDate && date <= unlockRange.toDate) return true;
                      return date >= todayStr;
                    }) : undefined}
                    onIonChange={(e) => {
                      const val = String(e.detail.value || "");
                      // From here on the times are the user's, not the form's.
                      campTimesTouchedRef.current = true;
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
                          // Picking a date resets the clock to the standard camp
                          // day - 9:30 out, 6:30 back - rather than to midnight.
                          // Today is the one exception: half of 9:30 may already
                          // be gone, and the picker refuses a From in the past,
                          // so today starts from the current moment instead.
                          //
                          // Order matters for anyone wanting a time of their
                          // own: pick the date first, then the time. The snap
                          // only fires when the date part actually changes, so
                          // scrolling the hour afterwards is left alone.
                          const isToday = newDatePart === nowIST().format("YYYY-MM-DD");
                          const next = isToday
                            ? nowIST()
                            : toIST(`${newDatePart}T00:00:00+05:30`)
                                .hour(CAMP_DEFAULT_FROM_H)
                                .minute(CAMP_DEFAULT_FROM_M)
                                .second(0)
                                .millisecond(0);
                          finalVal = next.toISOString(true);

                          // The other half of the camp day. Its time goes back to
                          // 6:30 with the same reasoning, but its DATE is only
                          // pulled onto the new day when it would otherwise end
                          // before the duty starts - a camp already running to
                          // Friday should not silently become a one day trip
                          // because the start moved.
                          const prevTo = dutyToDate ? toIST(dutyToDate) : null;
                          const keepToDate =
                            prevTo && prevTo.isValid() && prevTo.format("YYYY-MM-DD") > newDatePart
                              ? prevTo.format("YYYY-MM-DD")
                              : newDatePart;
                          let nextTo = toIST(`${keepToDate}T00:00:00+05:30`)
                            .hour(CAMP_DEFAULT_TO_H)
                            .minute(CAMP_DEFAULT_TO_M)
                            .second(0)
                            .millisecond(0);
                          // A day that ends before it starts is not a day - which
                          // is what today after 6:30pm would produce.
                          if (!nextTo.isAfter(next)) nextTo = next.clone();
                          setDutyToDate(nextTo.toISOString(true));
                        } else if (!dutyToDate || moment(finalVal).isAfter(dutyToDate)) {
                          // Time-only change that has overrun the end of the
                          // camp day: drag the end along rather than leaving a
                          // duty that finishes before it begins.
                          setDutyToDate(finalVal);
                        }
                        setDutyFromDate(finalVal);
                      } else {
                        setDutyToDate(val);
                      }
                    }}
                  />

                  {/* Ionic's own Cancel/Done only hand the value over once Done
                      is pressed, which is too late to show the 9:30 default on
                      the wheels. These do the same two jobs against a value
                      that is already live: Cancel puts the boxes back to what
                      they held when the picker opened, Done simply closes. */}
                  <div className="native-date-modal-actions">
                    <button
                      type="button"
                      onClick={() => {
                        const snap = dateModalSnapshot.current;
                        if (snap) {
                          setDutyFromDate(snap.from);
                          setDutyToDate(snap.to);
                        }
                        setDateModalType(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="is-primary"
                      onClick={() => setDateModalType(null)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              </IonModal>

              {/* Location - hidden for branch visits, see showLocationField */}
              {showLocationField && (
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
              )}

              {/* Transport and the vehicle it implies, side by side on one
                  row: the second question only exists because of the first
                  answer, and a full field width apart they read as two
                  unrelated things. Sizing lives in .od-pair-row so it can hold
                  two ordinary tiles rather than stretching across the whole
                  form - see the note there.

                  Public transport has no vehicle to name, so the pair shrinks
                  to a single tile and the next field closes up beside it.
                  Holding the empty half open just left a hole in the middle of
                  the row. Transport itself is one tile wide either way, so
                  nothing appears to resize - the gap simply goes. */}
              {showTravelFields && (
              <div className={`od-pair-row${transportMode === "PublicTransport" ? " od-pair-row-solo" : ""}`}>
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
                      <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${transportDropdownPos.top}px`, left: `${transportDropdownPos.left}px`, width: `${transportDropdownPos.width}px`, visibility: transportDropdownPos.width ? 'visible' : 'hidden' }}>
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
                                  // A vehicle chosen under the old transport
                                  // line is not a vehicle under the new one -
                                  // an office car must not stay selected once
                                  // the answer becomes "own two wheeler".
                                  if (loc !== transportMode) setVehicleNo("");
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
              {/* Vehicle No - the vehicles master, narrowed by the transport
                  line and by who is applying. It falls back to a typed box
                  when that master has nothing for this combination, so a duty
                  is never blocked by a list somebody has not filled in yet. */}
              {transportMode !== "PublicTransport" && (
                <div
                  className="lr-field-box"
                  onClick={() => {
                    if (vehicleOptions.length > 0) setIsVehicleDropdownOpen(!isVehicleDropdownOpen);
                  }}
                >
                  <label className="lr-field-label">Vehicle No</label>
                  <div className="lr-field-content" ref={vehicleTriggerRef}>
                    <IonIcon icon={carOutline} className="lr-field-icon" />

                    {vehicleOptions.length > 0 ? (
                      <>
                        <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: vehicleNo ? "#1e293b" : "#94a3b8" }}>
                          {vehicleNo || "Select Vehicle No"}
                        </span>
                        <ChevronDown size={16} style={{ opacity: 0.7, color: "#94a3b8" }} />
                      </>
                    ) : (
                      <input
                        type="text"
                        placeholder={transportMode ? "Not in vehicles master - type it" : "AP16..."}
                        value={vehicleNo}
                        onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                        style={{ border: "none", outline: "none", background: "transparent", flex: 1, color: "#1e293b", fontSize: "14px", fontWeight: "500" }}
                      />
                    )}

                    {isVehicleDropdownOpen && vehicleOptions.length > 0 && createPortal(
                      <>
                        <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsVehicleDropdownOpen(false); }} />
                        <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${vehicleDropdownPos.top}px`, left: `${vehicleDropdownPos.left}px`, width: `${vehicleDropdownPos.width}px`, visibility: vehicleDropdownPos.width ? 'visible' : 'hidden' }}>
                          <div className="dropdown-body" style={{ height: 'auto', maxHeight: '220px' }}>
                            {vehicleOptions.map((v: any, index: number) => {
                              const isSelected =
                                String(vehicleNo ?? "").trim().toLowerCase() ===
                                String(v.VehNo ?? "").trim().toLowerCase();
                              return (
                                <div
                                  key={`${v.VehNo}-${index}`}
                                  className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setVehicleNo(String(v.VehNo ?? ""));
                                    setIsVehicleDropdownOpen(false);
                                  }}
                                >
                                  <div className={`dr-avatar grad-${(index % 5) || 0}`}>{String(v.VehNo ?? "?").charAt(0)}</div>
                                  <div className="dr-info">
                                    <span className="dr-name">{v.VehNo}</span>
                                    {/* The model is what people recognise a
                                        vehicle by; the number is what the
                                        claim needs. Both, so neither has to be
                                        remembered. */}
                                    <span className="dr-id">
                                      {[v.VehModel || v.VehType, v._ownerLabel]
                                        .filter(Boolean)
                                        .join("  \u00b7  ")}
                                    </span>
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
              )}
              </div>
              )}

              {/* Trip Type - own vehicle / public transport only, see
                  showTripType. Sits directly after Transport so the two read
                  as one question and its answer. */}
              {showTripType && (
                <div className="lr-field-box" onClick={() => setIsTripTypeDropdownOpen(!isTripTypeDropdownOpen)}>
                  <label className="lr-field-label">Trip Type</label>
                  <div className="lr-field-content" ref={tripTypeTriggerRef}>
                    <IonIcon icon={refreshOutline} className="lr-field-icon" />
                    <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: tripType ? "#1e293b" : "#94a3b8" }}>
                      {tripType || "Select Trip Type"}
                    </span>
                    <ChevronDown size={16} style={{ opacity: 0.7, color: "#94a3b8" }} />

                    {isTripTypeDropdownOpen && createPortal(
                      <>
                        <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsTripTypeDropdownOpen(false); }} />
                        <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${tripTypeDropdownPos.top}px`, left: `${tripTypeDropdownPos.left}px`, width: `${tripTypeDropdownPos.width}px`, visibility: tripTypeDropdownPos.width ? 'visible' : 'hidden' }}>
                          <div className="dropdown-body" style={{ height: 'auto', maxHeight: '180px' }}>
                            {TRIP_TYPE_OPTIONS.map((name, index) => {
                              const isSelected = tripType === name;
                              return (
                                <div
                                  key={index}
                                  className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setTripType(name);
                                    setIsTripTypeDropdownOpen(false);
                                  }}
                                >
                                  <div className={`dr-avatar grad-${(index % 5) || 0}`}>{name.charAt(0)}</div>
                                  <div className="dr-info">
                                    <span className="dr-name">{name}</span>
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
              )}

              {/* Work Description */}
              <div className="lr-field-box od-line-box">
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

              {/* Day pills - one per date covered by the From/To range, so the
                  span is readable at a glance without re-reading both dates. */}
              {showDayPills && dutyDayPills.length > 0 && (
                <div className="lr-field-box od-line-box">
                  <label
                    className="lr-field-label od-day-label"
                    // Inline, not in the stylesheet: the class-based version of
                    // this rule was not winning against something in the cascade
                    // and the label kept flowing as plain inline text, breaking
                    // "Days" and "(2)" across two lines. An inline style cannot
                    // be outranked, and this is a one-off label, so the cost of
                    // hard-coding it here is small next to hunting the override.
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "6px",
                      minWidth: 0,
                    }}
                  >
                    {/* nowrap so the count never gets orphaned onto its own
                        line - "Days" and "(2)" are one token to the reader. */}
                    <span style={{ flex: "0 0 auto", whiteSpace: "nowrap" }}>
                      Days ({dutyDayPills.length})
                    </span>
                    {/* Fixed wording, not the branch name: the name is already
                        on screen in the Branch field right above, and dropping
                        it keeps this short enough to actually fit. The label
                        line is only ~167px wide, so the hint still truncates
                        rather than wraps - wrapping would push this box taller
                        than Work Description and undo the matched height next
                        door. title carries the full sentence when it is cut. */}
                    <span
                      className="od-day-hint"
                      title="Select days to mark attendance at branch"
                    >
                      Select days to mark attendance at branch
                    </span>
                  </label>
                  <div
                    ref={dayPillsRef}
                    className="lr-field-content od-day-pills"
                    style={{ gap: "4px" }}
                  >
                    {dutyDayPills.map((d) => {
                      const isSelected = selectedDays.includes(d.key);
                      return (
                      <span
                        key={d.key}
                        // The pill shows only the day number, so the full date
                        // lives in the tooltip - a bare "03" is ambiguous the
                        // moment a range crosses a month boundary. The state is
                        // spelled out too: colour alone carries it otherwise,
                        // and red/green is the one pair a colour-blind user is
                        // least likely to be able to tell apart.
                        title={`${d.full} - ${isSelected ? "marked for attendance" : "not marked"}`}
                        onClick={() => toggleDay(d.key)}
                        // A span is not focusable or keyboard-operable on its
                        // own; these three lines are what stop this from being
                        // a mouse-only control.
                        role="checkbox"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            // Space would scroll the page underneath.
                            e.preventDefault();
                            toggleDay(d.key);
                          }
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          // The strip drags to scroll; without this the browser
                          // starts a text selection instead of a drag.
                          userSelect: "none",
                          // minWidth keeps "02" and "12" the same width so the
                          // row reads as a row. It has to stay >= the height or
                          // the pill turns into an oval instead of a circle.
                          // Sized to fill .od-line-box's 20px content row
                          // exactly. That row is what keeps Days level with
                          // Work Description, and overflow-y is hidden, so a
                          // taller pill would just get its top and bottom
                          // shaved off rather than making the box grow. The
                          // pills answer to the row, never the other way round.
                          boxSizing: "border-box",
                          minWidth: "20px",
                          height: "20px",
                          padding: "0 5px",
                          borderRadius: "999px",
                          // Red is the resting state and green is the marked
                          // one, per the request. Worth being aware that this
                          // inverts the usual reading: an untouched form is a
                          // wall of red, which looks like fifteen errors rather
                          // than fifteen days waiting to be chosen. The tints
                          // are kept soft for that reason - alarm colours at
                          // full strength would make the form feel broken.
                          background: isSelected ? "#dcfce7" : "#fee2e2",
                          color: isSelected ? "#15803d" : "#b91c1c",
                          border: `1px solid ${isSelected ? "#86efac" : "#fecaca"}`,
                          fontSize: "10px",
                          fontWeight: 600,
                          lineHeight: 1,
                          transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
                        }}
                      >
                        {d.day}
                      </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex" }}>
              <button
                className="lr-gradient-btn"
                style={{ flex: 1, padding: "14px", borderRadius: "14px", fontSize: "15px", fontWeight: "700" }}
                onClick={saveOnDuty}
              >
                Submit Request
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
                    {(() => {
                      const { chips, applicant, assignedBy } = dutyPeople(row);

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
                                  background: isApplicant ? "#ecfdf5" : "#eef2ff",
                                  color: isApplicant ? "#065f46" : "#3730a3",
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
                                  <span style={{ opacity: 0.7 }}> ({emp.code})</span>
                                )}
                              </div>
                            );
                          })}

                          {assignedBy && (
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
                              <span style={{ opacity: 0.75, fontWeight: 500 }}>
                                Applied by{" "}
                              </span>
                              {nameForCode(assignedBy)}
                            </div>
                          )}
                        </>
                      );
                    })()}
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
                    {/* Part of the same answer as the mode, so it shares the
                        box rather than taking a fifth column of its own. */}
                    {row.TripType && (
                      <span style={{ color: "#64748b" }}> • {row.TripType}</span>
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

                {/* Branch visits carry no location by design, so this box
                    was rendering as an empty labelled slot on every one of
                    them. A missing box reads as "not applicable"; an empty
                    one reads as "we lost it". */}
                {!!row.Location && (
                  <div className="duty-info-box" style={{ minWidth: 0 }}>
                    <span className="item-label">Location</span>
                    <span
                      className="item-value"
                      style={{ wordBreak: "break-word", overflowWrap: "anywhere", lineHeight: "20px" }}
                    >
                      {row.Location}
                    </span>
                  </div>
                )}

                {!!row.OnDutyType && (
                  <div className="duty-info-box" style={{ minWidth: 0 }}>
                    <span className="item-label">Duty Type</span>
                    <span
                      className="item-value"
                      style={{ wordBreak: "break-word", overflowWrap: "anywhere", lineHeight: "20px" }}
                    >
                      {row.OnDutyType}
                    </span>
                  </div>
                )}

                {!!row.Branch && (
                  <div className="duty-info-box" style={{ minWidth: 0 }}>
                    <span className="item-label">Branch</span>
                    <span
                      className="item-value"
                      style={{ wordBreak: "break-word", overflowWrap: "anywhere", lineHeight: "20px" }}
                    >
                      {row.Branch}
                      {/* Why they are at that branch belongs with the branch,
                          not in a box of its own two columns away. */}
                      {row.BranchChangeType && (
                        <span style={{ color: "#64748b" }}> • {row.BranchChangeType}</span>
                      )}
                    </span>
                  </div>
                )}

                {/* Only the marked days are stored, so unlike the form there
                    is no unmarked counterpart to show here - every pill is a
                    green one, and the count carries the rest of the meaning. */}
                {attDayPills(row).length > 0 && (
                  <div className="duty-info-box" style={{ minWidth: 0 }}>
                    <span className="item-label">
                      Reporting Dates at Branch ({attDayPills(row).length})
                    </span>
                    <div
                      className="item-value"
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "4px",
                        lineHeight: "20px",
                      }}
                    >
                      {attDayPills(row).map((d) => (
                        <span
                          key={d.day}
                          title={`${d.full} - marked for attendance`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxSizing: "border-box",
                            // Matched to the form's pills so the same day
                            // looks like the same thing in both places.
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

              {/* Once the whole chain has approved the duty, the DA / TA
                  settlement becomes payable - the side menu is DB driven so
                  this deep link is the reliable way in for approvers.
                  Gated on isFullyApproved rather than the overall Status
                  string: every real RA slot reading "Approved" is the same
                  thing, and it keeps the button visible when the rolled-up
                  Status column lags behind the chain that produced it. */}
              {(canEdit || canApprove) && isFullyApproved(row) && (
                <IonButton
                  fill="clear"
                  color="success"
                  className="ion-no-margin"
                  onClick={() => history.push("/datasettlement?duty=" + row.id)}
                >
                  DA / TA
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