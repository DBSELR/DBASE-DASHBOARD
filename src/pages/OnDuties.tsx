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

// One person's stretch on a duty. FromDate / ToDate always come back
// filled in - the procedure substitutes the duty's own edges when no
// window row exists - so the screen never has to reason about nulls.
// `Partial` is the only thing that marks an exception worth showing.
type DutyMember = {
  EmpCode: string;
  EmpName: string;
  FromDate: string;
  ToDate: string;
  Partial: boolean;
};

type AttEditState = {
  open: boolean;
  row: any | null;
  /* Day-of-month strings, two digits, exactly as the column stores them. */
  days: string[];
  busy: boolean;
};
type TeamChangeState = {
  open: boolean;
  mode: "add" | "remove";
  row: any | null;
  empCode: string;
  date: string;
  busy: boolean;
};

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

  // ---- CAMP TRACKING (Start Camp / End Camp) --------------------------
  // "active" mirrors whether a live GPS tracking session is open for this
  // duty right now (Daily Shuttle: today's reporting day; Round Trip: the
  // whole duty). "locked" is Round Trip only - once its camp has ended the
  // duty is closed to visits, reading uploads, and team changes (enforced
  // server-side; this is only what the buttons show). Populated in one
  // batched call per duty-list load, not one round trip per card.
  const [campStatusByDuty, setCampStatusByDuty] = useState<
    Record<string, { tripType: string; active: boolean; locked: boolean }>
  >({});
  const [campBusy, setCampBusy] = useState<Record<string, boolean>>({});

  // Starting or ending a camp is not something a stray tap should be able
  // to do - starting one switches on live GPS tracking for someone, and
  // ending a Round Trip one locks the duty for good. So both go through a
  // Yes/No confirmation, and Yes stays disabled for a 5 second count-down
  // rather than being clickable the instant the dialog opens.
  const [campConfirm, setCampConfirm] = useState<{
    open: boolean;
    action: "start" | "end" | null;
    row: any | null;
    secondsLeft: number;
  }>({ open: false, action: null, row: null, secondsLeft: 5 });

  useEffect(() => {
    if (!campConfirm.open || campConfirm.secondsLeft <= 0) return;
    const t = setTimeout(() => {
      setCampConfirm((s) => ({ ...s, secondsLeft: s.secondsLeft - 1 }));
    }, 1000);
    return () => clearTimeout(t);
  }, [campConfirm.open, campConfirm.secondsLeft]);

  const openCampConfirm = (action: "start" | "end", row: any) => {
    setCampConfirm({ open: true, action, row, secondsLeft: 5 });
  };

  const closeCampConfirm = () => {
    setCampConfirm({ open: false, action: null, row: null, secondsLeft: 5 });
  };

  // Same Yes/No + 5 second wait, but for the day-trip modal's own reading
  // uploads on a Daily Shuttle own/office-vehicle duty - that combination
  // has no Start/End Camp button at all (see the card), so the upload
  // itself is what asks the question.
  const [dayTripCampConfirm, setDayTripCampConfirm] = useState<{
    open: boolean;
    kind: "start" | "end" | "both" | null;
    isRoundTrip: boolean;
    secondsLeft: number;
    readingFrom: string;
    readingTo: string;
  }>({ open: false, kind: null, isRoundTrip: false, secondsLeft: 5, readingFrom: "", readingTo: "" });

  useEffect(() => {
    if (!dayTripCampConfirm.open || dayTripCampConfirm.secondsLeft <= 0) return;
    const t = setTimeout(() => {
      setDayTripCampConfirm((s) => ({ ...s, secondsLeft: s.secondsLeft - 1 }));
    }, 1000);
    return () => clearTimeout(t);
  }, [dayTripCampConfirm.open, dayTripCampConfirm.secondsLeft]);

  // Asks the same "this starts/ends the camp" question dayTripCampConfirm
  // asks at Save Trip, but right at the Reading From/To upload click -
  // before the file picker even opens - since the photo itself can only be
  // replaced for 5 minutes after upload (see READING_EDIT_MS). Waiting
  // until Save Trip to ask meant the photo could already be locked in,
  // with visits/remarks still unsaved, by the time "No" was even an
  // option. refs below let "Yes" open the real file picker afterwards -
  // that click is its own fresh user gesture, so browsers allow it same as
  // any other button-triggered picker.
  const readingFromInputRef = useRef<HTMLInputElement>(null);
  const readingToInputRef = useRef<HTMLInputElement>(null);
  const readingUploadBypassRef = useRef<{ from: boolean; to: boolean }>({ from: false, to: false });
  // Tracks which (dutyDate|which) pairs already got a "yes" here, so
  // saveDayTripModal doesn't ask the same start/end question a second time
  // - it still separately validates the actual reading numbers at save
  // time (see dtBlockOnSameReading), which this click-time question can't
  // do yet since the closing number usually isn't typed in until after the
  // photo is picked.
  const confirmedReadingUploadsRef = useRef<Set<string>>(new Set());

  const [readingUploadConfirm, setReadingUploadConfirm] = useState<{
    open: boolean;
    which: "from" | "to" | null;
    dutyDate: string;
    title: string;
    text: string;
    secondsLeft: number;
  }>({ open: false, which: null, dutyDate: "", title: "", text: "", secondsLeft: 5 });

  useEffect(() => {
    if (!readingUploadConfirm.open || readingUploadConfirm.secondsLeft <= 0) return;
    const t = setTimeout(() => {
      setReadingUploadConfirm((s) => ({ ...s, secondsLeft: s.secondsLeft - 1 }));
    }, 1000);
    return () => clearTimeout(t);
  }, [readingUploadConfirm.open, readingUploadConfirm.secondsLeft]);

  const closeReadingUploadConfirm = () => {
    setReadingUploadConfirm({ open: false, which: null, dutyDate: "", title: "", text: "", secondsLeft: 5 });
  };

  const confirmReadingUploadAction = () => {
    const { which, dutyDate } = readingUploadConfirm;
    closeReadingUploadConfirm();
    if (!which) return;
    // Answering "Yes" only records that the camp question was already
    // asked for this upload (so saveDayTripModal/the next click don't ask
    // it again) - the actual 5 minute replace clock starts only once a
    // photo is really chosen (see the onChange handlers below), not here.
    // Starting it on "Yes" would mean cancelling the native picker with no
    // photo picked still burned part - or all - of the 5 minutes on a
    // photo that was never actually uploaded.
    confirmedReadingUploadsRef.current.add(`${dutyDate}|${which}`);
    readingUploadBypassRef.current[which] = true;
    (which === "from" ? readingFromInputRef : readingToInputRef).current?.click();
  };

  const confirmCampAction = async () => {
    const { action, row } = campConfirm;
    closeCampConfirm();
    if (!action || !row) return;
    if (action === "start") await handleStartCamp(row);
    else await handleEndCamp(row);
  };

  // Calendar days inside this duty's own approved DateFrom..DateTo range,
  // up to and including today, that have no day-trip record at all yet -
  // shown as a warning when someone tries to End Camp early on a Round
  // Trip, so ending before the approved period is over is an informed
  // choice rather than a silent gap in the log. Not a block: End Camp
  // always works (see EndCamp on the server) - this only tells the person
  // what ending now would leave unreported.
  const pendingOnDutyDays = (row: any): string[] => {
    const from = row?.DateFrom ? moment(row.DateFrom) : null;
    const to = row?.DateTo ? moment(row.DateTo) : null;
    if (!from || !to || !from.isValid() || !to.isValid()) return [];

    const reported = new Set(
      (tripDaysByDuty[row?.id] || [])
        .map((t: TripDayItem) => String(t.dutyDate || "").slice(0, 10))
        .filter(Boolean)
    );

    const today = nowIST().startOf("day");
    const cursor = from.clone().startOf("day");
    const end = to.clone().startOf("day");
    const pending: string[] = [];
    // A hard cap, not a real limit any duty should hit - just insurance
    // against an invalid/reversed date pair looping forever.
    let guard = 0;
    while (cursor.isSameOrBefore(end) && guard < 400) {
      if (!cursor.isAfter(today) && !reported.has(cursor.format("YYYY-MM-DD"))) {
        pending.push(cursor.format("DD-MM-YYYY"));
      }
      cursor.add(1, "day");
      guard += 1;
    }
    return pending;
  };

  // ---- TEAM CHANGES ON A LIVE DUTY ------------------------------------
  // People join a duty late and drop out of it early, and re-filing the
  // whole request to say so loses its approvals. Membership is therefore a
  // window with a start and an end, and somebody with no window row at all
  // is on the duty for the whole of it - which is why every duty raised
  // before this existed still reads exactly as it did.
  const [dutyMembers, setDutyMembers] = useState<Record<string, DutyMember[]>>({});
  const [teamChange, setTeamChange] = useState<TeamChangeState>({
    open: false,
    mode: "add",
    row: null,
    empCode: "",
    date: "",
    busy: false,
  });
  const [attEdit, setAttEdit] = useState<AttEditState>({
    open: false,
    row: null,
    days: [],
    busy: false,
  });
  // Amendments to an already-approved duty that have been written down and
  // are waiting for HR, keyed by the duty they belong to. Everybody who can
  // see the duty sees that a change is pending on it; only HR gets the two
  // buttons that decide it.
  const [changeReqs, setChangeReqs] = useState<Record<string, any[]>>({});
  // The id currently being decided, so one row's buttons grey out rather
  // than the whole strip.
  const [changeBusy, setChangeBusy] = useState<number>(0);
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
// "Employee Request" is the employee asking to be moved. "Mutual" is both
// at once - the company wanted them at the other branch and the employee
// asked to go - so it is settled halfway between the two: travel is paid
// for the journey one way only, because the return leg was the employee's
// own doing, while the daily allowance is paid in full exactly as it is on
// any other duty. Because this is not the literal string "Employee
// Request", the transport, vehicle and reporting-day fields below stay on
// screen for it - which is right, since there is still a company journey.
//
// The settlement procedure recognises this case by looking for the word
// "Mutual" in the saved value, so renaming it here means changing the
// matcher in APP_OnDuty_DA_TA_Setup.sql to suit.
const BRANCH_CHANGE_TYPE_OPTIONS = [
  "Official Assignment",
  "Employee Request",
  "Mutual",
];

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

  // ---- Odometer photos: uploaded once, replaceable for five minutes ----
  //
  // The photo of the odometer is the record of when this part of the day
  // actually happened - DA is now paid from the moment the opening one
  // landed - so it is not something that can be quietly swapped out later.
  // Five minutes of grace, because a shot that came out dark or caught the
  // wrong dial is a real thing that happens and there has to be a way back
  // from it.
  //
  // The API enforces this; nothing here is a security measure. What this
  // does is let the screen tell the truth in advance, so nobody picks a
  // file, waits, and is told afterwards that it was refused.
  //
  // Keyed by day and by which end of the trip, holding the moment the FIRST
  // photo of that kind was chosen in this session. A photo that came back
  // from the server has no entry, and that reads correctly: it was uploaded
  // on some earlier visit to this screen and its five minutes are long
  // gone. The entry deliberately survives the save-and-reload, or the grace
  // period would be over before it began.
  const READING_EDIT_MS = 5 * 60 * 1000;
  const readingLockRef = useRef<Record<string, number>>({});
  const readingLockKey = (dutyDate: string, which: "from" | "to") =>
    `${dutyDate}|${which}`;

  const isReadingLocked = (
    dutyDate: string,
    which: "from" | "to",
    hasImage: boolean
  ): boolean => {
    if (!hasImage) return false;
    const firstAt = readingLockRef.current[readingLockKey(dutyDate, which)];
    if (firstAt === undefined) return true;
    return Date.now() - firstAt > READING_EDIT_MS;
  };

  // Returns true if the file picker should be allowed to open. Called from
  // the file input's onClick, which is the last moment at which opening it
  // can still be prevented.
  const confirmReadingUpload = (
    dutyDate: string,
    which: "from" | "to",
    hasImage: boolean,
    // Folded into this same click's confirm(s) rather than shown later at
    // Save Trip - the reading photo itself can only be replaced within 5
    // minutes of upload (see isReadingLocked/READING_EDIT_MS above), so by
    // the time someone reaches Save Trip after also filling in the reading
    // number, visits, etc., that window may already be gone and there is
    // no real way back. Surfacing the camp consequence at the point the
    // photo is actually chosen - not after - is what gives the "No" here
    // any teeth.
    campConsequence?: string
  ): boolean => {
    const label = which === "from" ? "starting" : "closing";
    const suffix = campConsequence ? `\n\n${campConsequence}` : "";

    if (isReadingLocked(dutyDate, which, hasImage)) {
      notify(
        `The ${label} reading photo for this day has already been uploaded ` +
          `and can no longer be changed. It could only be replaced within ` +
          `5 minutes of the first upload.`,
        "warning"
      );
      return false;
    }

    const firstAt = readingLockRef.current[readingLockKey(dutyDate, which)];

    if (firstAt !== undefined) {
      const leftMin = Math.max(
        1,
        Math.ceil((READING_EDIT_MS - (Date.now() - firstAt)) / 60000)
      );
      return window.confirm(
        `This ${label} reading photo can still be replaced for about ` +
          `${leftMin} more minute${leftMin === 1 ? "" : "s"}, after which it ` +
          `is fixed.\n\nReplace it now?${suffix}`
      );
    }

    const ok = window.confirm(
      `The ${label} reading photo is the record of when this part of the ` +
        `day happened, so it cannot be edited once it has been uploaded.` +
        `\n\nIf it comes out wrong you can replace it, but only within ` +
        `5 minutes of uploading it.\n\nUpload now?${suffix}`
    );
    if (ok) readingLockRef.current[readingLockKey(dutyDate, which)] = Date.now();
    return ok;
  };

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

  // Why "+ Add Party" is unavailable right now, in words, or "" when it is
  // available. Same two gates the click handler enforces, in the same order,
  // so this can never disagree with what actually happens.
  //
  // The gates were already correct; what was missing is that a disabled
  // button never gets clicked, so the explanation the click handler carried
  // was the one thing nobody could ever reach. Someone looking at a request
  // whose approval line is entirely green, with a greyed-out button and no
  // reason given, has no way to tell a rule from a bug - and reasonably
  // reports it as a bug. Naming the slot still outstanding turns that into
  // something they can act on, usually by going and asking that person.
  const addPartyBlockReason = (row?: DutyRow | null, tripDate?: string): string => {
    if (!row) return 'Open a duty day first.';
    if (String(tripDate || '').slice(0, 10) > nowIST().format('YYYY-MM-DD'))
      return 'Visits can be recorded from the day itself - this day trip is still in the future.';
    if (isFullyApproved(row)) return '';

    const norm = (s: any) => String(s ?? '').trim().toLowerCase();
    // Slots named "" or "-" are placeholders, not people, and are not
    // waited on - exactly how isFullyApproved treats them.
    const outstanding = [
      [row.RA1, row.RA1_Status],
      [row.RA2, row.RA2_Status],
      [row.RA3, row.RA3_Status],
      [row.RA4, row.RA4_Status],
    ]
      .filter(([ra]) => {
        const v = String(ra || '').trim();
        return v !== '' && v !== '-';
      })
      .filter(([, st]) => norm(st) !== 'approved')
      .map(([ra, st]) =>
        String(ra).trim() + (norm(st) === 'rejected' ? ' (rejected)' : '')
      );

    if (outstanding.length > 0)
      return 'Waiting on ' + outstanding.join(', ') + ' before visits can be recorded.';

    // No named approver is outstanding, yet the request still does not read
    // as approved - so the blocker is the overall status string itself.
    // Showing it verbatim is the point: it is the only clue to why, and it
    // is what someone would otherwise have to open a console to see.
    return 'Request status is "' + (row.Status || 'unknown') +
      '" - visits can be recorded once it is fully approved.';
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

  // Block adding the next day until the immediately preceding day's
  // closing (Reading To) photo has actually been uploaded. The card list
  // can show "Reading X -> X (0 Kms)" for a day whose end reading was
  // never really uploaded - in "add" mode Reading To is auto-mirrored
  // from Reading From purely as a form default (see updateTripDay's
  // readingFrom handler), with no photo behind it - so checking
  // readingToImage (not readingTo, which can hold that mirrored text)
  // is the only reliable way to tell a real closing upload from the
  // placeholder. Without this, a new day could be opened and even saved
  // while the previous day's vehicle reading was never actually closed
  // out, leaving a gap in the reading trail and, for a same-day Round
  // Trip, silently skipping the auto-close/lock that closing reading
  // was supposed to trigger.
  //
  // Public Transport never has a Reading To photo at all - that mode
  // skips vehicle readings entirely and only ever asks for Distance (see
  // isPublicTransport throughout this file, e.g. the day-trip modal's
  // "only distance required" validation) - so this guard would otherwise
  // permanently block every Public Transport duty from adding a second
  // day. It only applies to duties that actually upload readings.
  const isPublicTransportRow = row.Mode_of_Trans === "PublicTransport";
  if (!isPublicTransportRow) {
    const previousTrip = [...currentTrips].sort((a, b) =>
      normalize(a.dutyDate).localeCompare(normalize(b.dutyDate))
    )[currentTrips.length - 1];
    if (previousTrip && !previousTrip.readingToImage) {
      notify(
        `Please upload the End Reading for ${moment(previousTrip.dutyDate).format("DD-MM-YYYY")} before adding the next day.`,
        "warning"
      );
      return;
    }
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

  const saveDayTripModal = async (skipReadingConfirm: boolean = false) => {
    if (isSavingTrip.current) return;
    isSavingTrip.current = true;
    try {
    // Everything below is wrapped in this outer try so that ANY
    // unexpected/uncaught exception (not just the API call itself,
    // which already has its own inner try/catch below) always shows
    // the user a toast and always resets isSavingTrip.current - a
    // silent throw here used to leave the ref stuck true forever,
    // which looks exactly like "nothing happens" on every future
    // click of Save Trip with zero error/success feedback.
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

    // A day trip can now be saved with zero visits recorded - the
    // reading upload (and, for Party/Client/Official work, the trip
    // itself) is already the record that the day happened; requiring a
    // visit on top of that blocked otherwise-valid saves (e.g. a day with
    // only travel and no client stop). The time-ordering checks below
    // still apply whenever visits ARE present, for any duty type - they
    // simply have nothing to check against an empty visits array.
    if (tripModalMode === "edit") {
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

    // Daily Shuttle never shows a manual Start/End Camp button on an
    // own/office vehicle (see the card) - every day's own reading upload
    // does that job instead. Round Trip only shows End Camp manually - the
    // trip itself still starts from a reading, same as Shuttle, just once
    // rather than every day. Both ask the same Yes/No + 5 second question
    // at the point the upload is about to happen, rather than doing it
    // silently:
    //   Daily Shuttle - every start reading opens that day's camp, every
    //     end reading closes it. Confirm on either.
    //   Round Trip - only the very FIRST start reading starts anything
    //     (campStatusByDuty says the camp is not active yet); a start
    //     reading on any day after that is just recording that day's
    //     numbers, the trip is already running, so no prompt. Round Trip
    //     never ends from a reading upload at all - only the End Camp
    //     button on the card does that (see openCampConfirm there), so an
    //     end reading here never prompts either.
    const dutyTripTypeLower = String(selectedDutyRow?.TripType || "").trim().toLowerCase();
    const isDailyShuttleDuty = dutyTripTypeLower === "daily shuttle";
    // The server's own camp-trigger gates (Save_DayTrip's isOwnOrOfficeVehicle,
    // and EndCamp's isRoundTrip) don't require an exact "Round Trip" match -
    // they trigger for ANY TripType that isn't "Daily Shuttle", blank
    // included. Office-vehicle duty types like "Party" never ask Round Trip
    // vs Daily Shuttle, so TripType is "" for them, yet the server still
    // auto-starts/closes their camp on a reading upload (and permanently
    // locks a same-day one) exactly as it does for an explicit "Round Trip".
    // Requiring an exact match here meant isVehicleDuty was false for every
    // blank-TripType duty, so this whole confirm-dialog block was skipped
    // for them: readings got uploaded and camps got started/closed/locked
    // server-side with no warning ever shown. Matching the server's own
    // proxy keeps what the user is told in sync with what actually happens.
    const isRoundTripDuty = !isDailyShuttleDuty;
    const isVehicleDuty = !isPublicTransport && (isDailyShuttleDuty || isRoundTripDuty);
    // A Round Trip whose own DateFrom/DateTo fall on the same calendar day
    // now auto-closes (and permanently locks) exactly like Daily Shuttle's
    // final reading does - see Save_DayTrip on the API. A multi-day Round
    // Trip still only ever ends from the explicit End Camp button.
    const isSameDayRoundTrip =
      isRoundTripDuty &&
      !!selectedDutyRow?.DateFrom &&
      !!selectedDutyRow?.DateTo &&
      String(selectedDutyRow.DateFrom).slice(0, 10) === String(selectedDutyRow.DateTo).slice(0, 10);

    if (isVehicleDuty && !skipReadingConfirm) {
      const uploadingStart = trip.readingFromImage instanceof File;
      const uploadingEnd = trip.readingToImage instanceof File;
      const campAlreadyActive = !!campStatusByDuty[String(selectedDutyId)]?.active;

      // If the Reading From/To upload click already asked (and got a yes
      // for) this exact question, don't ask it again here - see
      // confirmedReadingUploadsRef and the file inputs' onClick above.
      const alreadyConfirmedStart = confirmedReadingUploadsRef.current.has(`${trip.dutyDate}|from`);
      const alreadyConfirmedEnd = confirmedReadingUploadsRef.current.has(`${trip.dutyDate}|to`);

      const endReadingApplies = uploadingEnd && (isDailyShuttleDuty || isSameDayRoundTrip);

      // The click-time question can only ask "do you want to do this" -
      // the closing number usually isn't typed in until after that photo
      // is picked, so it can't check it yet. This is where that check
      // actually happens once the reading is final - skipping it just
      // because the click-time question was already answered would drop
      // the one check that actually looks at the numbers.
      if (endReadingApplies && alreadyConfirmedEnd) {
        const endRf = trip.readingFrom || "";
        const endRt = trip.readingTo || "";
        if (
          endRf !== "" &&
          endRt !== "" &&
          !Number.isNaN(Number(endRf)) &&
          Number(endRf) === Number(endRt)
        ) {
          isSavingTrip.current = false;
          notify(
            `Start and end reading are both ${endRf} - no distance recorded. Please re-check ` +
              `and update the closing reading before saving.`,
            "danger"
          );
          return;
        }
      }

      const needsStartConfirm =
        uploadingStart &&
        !alreadyConfirmedStart &&
        (isDailyShuttleDuty || (isRoundTripDuty && !campAlreadyActive));
      const needsEndConfirm = endReadingApplies && !alreadyConfirmedEnd;

      if (needsStartConfirm || needsEndConfirm) {
        isSavingTrip.current = false;
        setDayTripCampConfirm({
          open: true,
          kind: needsStartConfirm && needsEndConfirm ? "both" : needsStartConfirm ? "start" : "end",
          isRoundTrip: isRoundTripDuty,
          secondsLeft: 5,
          readingFrom: trip.readingFrom || "",
          readingTo: trip.readingTo || "",
        });
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
        {
          // Guard against a non-primitive ever being serialized here -
          // FormData silently stringifies any object to the literal text
          // "[object Object]", which the backend then rejects with a
          // validation error ("The value '[object Object]' is not valid
          // for LocalTransportAmount") that is meaningless to whoever is
          // filling out the trip. Only a string/number is ever sent;
          // anything else is treated as "not entered" instead of corrupting
          // the request.
          const rawAmount = v.localTransportAmount as unknown;
          const safeAmount =
            typeof rawAmount === "string" || typeof rawAmount === "number"
              ? String(rawAmount)
              : "";
          formData.append(`visits[${i}].localTransportAmount`, safeAmount);
        }

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

      // The trip itself always saved if execution reaches here - the
      // |WARN: suffix (same convention SaveDuties uses) only ever
      // covers the best-effort camp auto-close failing to find a
      // session to close, which used to be reported nowhere but the
      // server console. Surfacing it here is what makes "trip saved,
      // but live location never turned off" visible instead of silent.
      const campWarn = String(res?.data?.message ?? "").split("|WARN:")[1];
      if (campWarn) {
        notify(campWarn, "warning");
      } else if (res?.data?.campStartAttempted && Number(res?.data?.campStartedCount) > 0) {
        // Uploading the start reading auto-opens the camp for every
        // teammate on the duty (same as tapping Start Camp by hand) -
        // say so here instead of a generic "Trip Saved" that leaves the
        // team-wide effect invisible unless someone checks the map.
        const n = Number(res.data.campStartedCount);
        notify(
          `Trip Saved - Live location turned on for ${n} team member${n === 1 ? "" : "s"}`,
          "success"
        );
      } else {
        notify("Trip Saved Successfully", "success");
      }
      await loadDuties();

      // Refresh this duty's local trip/visit state from the server before
      // closing. save_daytrip assigns a real Visit_ID to every visit it
      // just inserted, but that ID never made it back into tripDaysByDuty -
      // only loadDuties() (the duties list) ran above, not loadDayTrips()
      // (the day-trip/visit rows). Reopening Edit for this same day without
      // this refresh reused the stale in-memory visits, still carrying
      // visit_Id: 0 for anything just saved, and the next save resent them
      // with no ID - app_Save_OnDuty_Visit treats that as a brand new visit
      // and inserts a duplicate row instead of updating the existing one.
      if (selectedDutyId) {
        await loadDayTrips(selectedDutyId);
      }

      closeDayTripModal();

    } catch (error: any) {
      let errorMsg = "Save failed";
      const data = error?.response?.data;
      if (data) {
        if (typeof data === "string") {
          errorMsg = data;
        } else if (typeof data === "object") {
          // ASP.NET's automatic [ApiController] model-validation response
          // (HTTP 400) is a ProblemDetails object: { errors: { "Visits[0].
          // LocalTransportAmount": ["message"], ... }, title, status, ... }.
          // Neither .message nor .error exists on it, so this used to fall
          // through to JSON.stringify(data) and show the raw payload -
          // type, title, status, traceId and all - in a danger toast. Pull
          // the field-level messages out instead so the person filling the
          // form sees "Local Transport Amount: The value ... is not valid"
          // rather than a wall of JSON they can't act on.
          const validationErrors = data.errors && typeof data.errors === "object" ? data.errors : null;
          if (validationErrors) {
            const messages = Object.entries(validationErrors)
              .map(([field, msgs]) => {
                const label = field
                  .replace(/^Visits\[\d+\]\./, "")
                  .replace(/([a-z])([A-Z])/g, "$1 $2");
                const text = Array.isArray(msgs) ? msgs.join(" ") : String(msgs);
                return `${label}: ${text}`;
              })
              .join("\n");
            errorMsg = messages || data.title || "Save failed";
          } else {
            errorMsg = data.message || data.error || data.title || "Save failed";
          }
        }
      } else if (error?.message) {
        errorMsg = error.message;
      }

      notify(errorMsg, "danger");
    } finally {
      isSavingTrip.current = false;
    }
    } catch (outerErr: any) {
      console.error("saveDayTripModal unexpected error", outerErr);
      notify(
        outerErr && outerErr.message
          ? `Save failed: ${outerErr.message}`
          : "Unexpected error while saving. Please try again.",
        "danger"
      );
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

    const ids = Array.from(
      new Set(duties.map((duty) => String(duty.id || "").trim()).filter(Boolean))
    );
    if (!ids.length) {
      setTripDaysByDuty(result);
      return;
    }

    // One bulk call instead of one get_daytrips call per duty (via
    // Promise.all). Firing a couple dozen individual requests at once,
    // right alongside everything else the page loads on mount, was the
    // main reason a reload could take tens of seconds before anything -
    // day trips, camp status badges, all of it - settled: the browser's
    // per-origin connection limit and the server's own request/connection
    // pool both queue up under that many simultaneous calls. This keeps
    // the same App_Get_DayTrips data per duty, just fetched over one round
    // trip instead of N.
    try {
      const res = await api.get("OnDuty/get_daytrips_bulk", {
        params: { dutyIds: ids.join(",") },
      });
      const data = res.data && typeof res.data === "object" ? res.data : {};
      ids.forEach((id) => {
        const rows = (data as any)[id];
        result[id] = buildTripsFromRows(Array.isArray(rows) ? rows : []);
      });
    } catch (error) {
      console.error("loadAllTrips (bulk) error:", error);
      ids.forEach((id) => {
        result[id] = [];
      });
    }

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

  // The overall verdict worked out from the approval chain, for the case where
  // the record carries no usable status of its own. The duty table keeps TWO
  // status columns and only one of them is ever written, so whichever one the
  // API happens to read can come back empty - and defaulting that to "Pending"
  // puts the waiting-on-someone badge on a request that has already cleared
  // every level. People then chase approvals that already happened.
  //
  // Slots named "" or "-" are not real approvers and are not waited on, which
  // is exactly how isFullyApproved already treats them. Returns "" for a chain
  // that is genuinely still in progress, so the caller's "Pending" still wins.
  const statusFromChain = (d: any): string => {
    const norm = (s: any) => String(s ?? "").trim().toLowerCase();
    const slots = [
      { ra: pick(d, "rA1", "ra1", "RA1"), st: pick(d, "rA1_Status", "ra1_Status", "RA1_Status", "ra1Status", "rA1Status") },
      { ra: pick(d, "rA2", "ra2", "RA2"), st: pick(d, "rA2_Status", "ra2_Status", "RA2_Status", "ra2Status", "rA2Status") },
      { ra: pick(d, "rA3", "ra3", "RA3"), st: pick(d, "rA3_Status", "ra3_Status", "RA3_Status", "ra3Status", "rA3Status") },
      { ra: pick(d, "rA4", "ra4", "RA4"), st: pick(d, "rA4_Status", "ra4_Status", "RA4_Status", "ra4Status", "rA4Status") },
    ].filter((s) => {
      const v = String(s.ra ?? "").trim();
      return v !== "" && v !== "-";
    });
    if (slots.length === 0) return "";
    if (slots.some((s) => norm(s.st) === "rejected")) return "Rejected";
    if (slots.every((s) => norm(s.st) === "approved")) return "Approved";
    return "";
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
      // The chain is consulted FIRST, not last. The status this endpoint
      // sends is not the stored verdict at all - it is a progress sentence
      // built from CurrentRA, and on a duty whose approvals have finished it
      // still reads "Pending at In-Charge F&A" because CurrentLevel was never
      // advanced past the last approver. That string is truthy, so preferring
      // it meant the card called a finished request pending forever.
      //
      // statusFromChain only speaks when the answer is unambiguous - every
      // real slot approved, or one rejected - and stays silent while a chain
      // is genuinely mid-flight, which is exactly when the server's sentence
      // is worth showing. So: chain if it knows, server's words if it does
      // not, "Pending" only if neither has anything to say.
      Status:
        statusFromChain(d) ||
        pick(d, "status", "Status", "dutyStatus", "DutyStatus") ||
        "Pending",
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

  // Duty numbers are digits held as text, so they have to be compared as
  // numbers or "#9" sorts above "#12013".
  const dutyIdNum = (v: any): number => {
    const n = parseInt(String(v ?? "").replace(/[^0-9]/g, ""), 10);
    return isNaN(n) ? 0 : n;
  };

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

      // Newest first, always.  The two sources arrive in whatever order
      // each returned and the team rows were simply appended after the
      // user's own, which put a duty raised this morning below one from
      // last month.  The duty number counts up, so sorting on it puts the
      // most recent at the top wherever the row came from.
      mapped.sort((a: any, b: any) => dutyIdNum(b.id) - dutyIdNum(a.id));

      setDutiesList(mapped);
      // Fire immediately, in parallel with loadAllTrips below - not after
      // it. loadAllTrips fires one get_daytrips call per duty (the bulk of
      // this page's request count), and awaiting that first was queuing
      // camp_status behind the entire waterfall: the badge was correct,
      // just stuck showing its "not active yet" default for however long
      // the day-trip calls took to finish, which on a list with many
      // duties could be many seconds. Camp status affects only a couple of
      // buttons and in no way depends on day-trip data, so there is no
      // reason for one to wait on the other.
      loadCampStatuses(mapped);
      await loadAllTrips(mapped);
    } catch (err) {
      console.error("loadDuties error:", err);
      setDutiesList([]);
      setTripDaysByDuty({});
    }
  };

  // Batched camp status for a set of duties - one call for the whole list
  // instead of one round trip per card. This fires alongside a dozen-plus
  // other calls the page makes on load (day trips, employees, sources,
  // change requests...), and under that load a single transient failure
  // (a connection-pool wait, a slow query) is common enough in practice
  // that Start Camp kept looking stuck on a fresh reload even though the
  // session really was active - retrying once, shortly after, catches
  // exactly that case instead of leaving the badge wrong until the next
  // 30s poll or a manual reload.
  const loadCampStatuses = async (rowsForStatus: DutyRow[], isRetry: boolean = false) => {
    const ids = Array.from(
      new Set(
        rowsForStatus.map((r: any) => String(r?.id || "").trim()).filter(Boolean)
      )
    );
    if (!ids.length) return;
    try {
      const res = await api.get("OnDuty/camp_status", {
        params: { dutyIds: ids.join(",") },
        headers: authHeaders(),
      });
      const list = Array.isArray(res.data) ? res.data : [];
      const next: Record<string, { tripType: string; active: boolean; locked: boolean }> = {};
      list.forEach((r: any) => {
        const dutyId = String(r?.dutyId ?? "").trim();
        if (!dutyId) return;
        next[dutyId] = {
          tripType: String(r?.tripType ?? ""),
          active: !!r?.active,
          locked: !!r?.locked,
        };
      });
      setCampStatusByDuty((prev) => ({ ...prev, ...next }));
    } catch (e) {
      console.error("loadCampStatuses failed:", e);
      if (!isRetry) {
        setTimeout(() => {
          loadCampStatuses(rowsForStatus, true);
        }, 1500);
      }
    }
  };

  // A duty can carry more than one employee, but a camp tracking session is
  // per person. Start/End Camp on the card targets whoever is first on the
  // duty's own employee list - the common case is one field officer per
  // duty, which is what both duties in this dataset actually look like. A
  // duty built around a whole team travelling together would need a picker
  // here instead; nothing today needs one, so this is deliberately simple
  // rather than speculative.
  const primaryEmpCodeForDuty = (row: any): string => {
    const codes = String(row?.EmpCodes || "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    return codes[0] || "";
  };

  const campActionErr = (e: any, fallback: string): string => {
    const d = e?.response?.data;
    if (typeof d === "string" && d.trim()) return d;
    if (d && typeof d === "object" && d.message) return String(d.message);
    return fallback;
  };

  const handleStartCamp = async (row: any) => {
    const dutyId = String(row?.id || "");
    const emp = primaryEmpCodeForDuty(row);
    if (!dutyId || !emp) {
      notify("No employee found on this duty to start a camp for.", "warning");
      return;
    }
    setCampBusy((s) => ({ ...s, [dutyId]: true }));
    try {
      const res = await api.post(
        "OnDuty/start_camp",
        { DutyId: dutyId, EmpCode: emp },
        { headers: authHeaders() }
      );
      // start_camp now isolates each teammate's session so one bad EmpCode
      // can't abort the rest of the team - but that also means it can come
      // back partially successful (2 of 3 started) instead of all-or-
      // nothing. Say so instead of a flat "Camp started" that would hide
      // exactly the "live location is No for one teammate" symptom this
      // was built to fix.
      const failedFor: string[] = Array.isArray(res?.data?.failedFor) ? res.data.failedFor : [];
      if (failedFor.length > 0) {
        notify(
          `Camp started, but live location could not be turned on for: ${failedFor.join(", ")}. Please check with your admin.`,
          "warning"
        );
      } else {
        notify("Camp started.", "success");
      }
      // start_camp's own response already IS the answer (it just created
      // the session(s) that make it true) - a whole extra camp_status
      // round trip right after it, only to re-derive what the POST already
      // told us, was most of why the badge felt slow to flip. Set it
      // straight from the response and let the periodic 30s poll (and the
      // next full reload) reconcile anything this optimistic update gets
      // wrong, rather than paying for a synchronous re-fetch on every tap.
      setCampStatusByDuty((prev) => ({
        ...prev,
        [dutyId]: {
          tripType: String(res?.data?.tripType ?? prev[dutyId]?.tripType ?? ""),
          active: true,
          locked: false,
        },
      }));
    } catch (e: any) {
      notify(campActionErr(e, "Could not start the camp."), "warning");
    } finally {
      setCampBusy((s) => ({ ...s, [dutyId]: false }));
    }
  };

  const handleEndCamp = async (row: any) => {
    const dutyId = String(row?.id || "");
    const emp = primaryEmpCodeForDuty(row);
    if (!dutyId || !emp) {
      notify("No employee found on this duty to end the camp for.", "warning");
      return;
    }
    setCampBusy((s) => ({ ...s, [dutyId]: true }));
    try {
      const res = await api.post(
        "OnDuty/end_camp",
        { DutyId: dutyId, EmpCode: emp },
        { headers: authHeaders() }
      );
      const locked = !!res?.data?.locked;
      notify(
        locked ? "Camp ended. This duty is now closed to further changes." : "Camp ended.",
        "success"
      );
      // Same reasoning as handleStartCamp above - end_camp's response
      // already says whether it locked the duty, so use it directly
      // instead of an extra camp_status round trip just to confirm it.
      setCampStatusByDuty((prev) => ({
        ...prev,
        [dutyId]: {
          tripType: String(prev[dutyId]?.tripType ?? ""),
          active: false,
          locked,
        },
      }));
    } catch (e: any) {
      notify(campActionErr(e, "Could not end the camp."), "warning");
    } finally {
      setCampBusy((s) => ({ ...s, [dutyId]: false }));
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

  // Dates reach this page in whatever shape the API felt like sending -
  // dd-MM-yyyy from the duty list, ISO from a picker - and the date input
  // and the API both want yyyy-MM-dd. An unreadable value returns blank
  // rather than today, because a silent wrong date is worse than none.
  const ymd = (v: any): string => {
    if (v === null || v === undefined) return "";
    const s = String(v).trim();
    if (!s) return "";
    const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmy)
      return (
        dmy[3] + "-" + dmy[2].padStart(2, "0") + "-" + dmy[1].padStart(2, "0")
      );
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[0];
    const d = new Date(s);
    return isNaN(d.getTime()) ? "" : moment(d).format("YYYY-MM-DD");
  };

  const prettyDay = (v: any) => {
    const y = ymd(v);
    // DD-MM-YYYY throughout, matching the timeline on the duty card
    // itself - a date that reads two ways on one screen is a date the
    // reader has to stop and decode.
    return y ? moment(y, "YYYY-MM-DD").format("DD-MM-YYYY") : "";
  };

  // The API answers with a list of dictionaries, and whether the keys come
  // back capitalised depends on the serializer settings rather than on
  // anything this page controls - so every read is case-insensitive.
  const readRows = (data: any): any[] => {
    let parsed: any = data;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        parsed = null;
      }
    }
    return Array.isArray(parsed) ? parsed : [];
  };

  // ASP.NET's BadRequest puts the real reason in the body, and a 404 puts
  // nothing there at all. Showing the status alone turns every different
  // failure into the same unactionable sentence, so the body is read first
  // and the status is only the fallback.
  const serverSaid = (e: any): string => {
    const d = e?.response?.data;
    let text = "";
    if (typeof d === "string") text = d;
    else if (d && typeof d === "object")
      text = String(d.Message ?? d.message ?? d.title ?? d.error ?? "");
    text = text.trim();
    if (text) return text.length > 300 ? text.slice(0, 300) + "..." : text;

    const status = e?.response?.status;
    if (status === 404)
      return "that endpoint is not there (404) - the API still needs rebuilding and restarting";
    if (status === 401 || status === 403)
      return "the server refused the request (" + status + ") - the login may have expired";
    if (status) return "the server answered " + status;
    return e?.message || "an unexpected error";
  };

  const field = (obj: any, name: string) => {
    if (!obj) return undefined;
    const want = name.toLowerCase();
    const hit = Object.keys(obj).find((k) => k.toLowerCase() === want);
    return hit === undefined ? undefined : obj[hit];
  };

  // Only fetched for duties the user actually opens a dialog on. A list of
  // a hundred duties would otherwise cost a hundred round trips to be told
  // "everybody, all of it" a hundred times over.
  const loadDutyMembers = async (dutyId: string) => {
    try {
      const res = await api.get("OnDuty/onduty_members", {
        params: { DutyId: dutyId },
        headers: authHeaders(),
      });
      const rows = readRows(res.data).map((r: any) => ({
        EmpCode: String(field(r, "EmpCode") ?? "").trim(),
        EmpName: String(field(r, "EmpName") ?? "").trim(),
        FromDate: ymd(field(r, "FromDate")),
        ToDate: ymd(field(r, "ToDate")),
        Partial: !!field(r, "Partial"),
      }));
      setDutyMembers((prev) => ({ ...prev, [dutyId]: rows }));
      return rows;
    } catch (e) {
      console.error("loadDutyMembers failed:", e);
      return [];
    }
  };

  const openTeamChange = (mode: "add" | "remove", row: any) => {
    setTeamChange({
      open: true,
      mode,
      row,
      empCode: "",
      // Defaulted to the duty's own first day, which is the answer for a
      // correction filed after the fact. Anyone changing it forward is
      // saying "from this day onwards", which is the whole point.
      date: ymd(row?.DateFrom) || "",
      busy: false,
    });
    if (row?.id) loadDutyMembers(String(row.id));
  };

  const closeTeamChange = () =>
    setTeamChange((s) => ({ ...s, open: false, busy: false }));

  const submitTeamChange = async () => {
    const { mode, row, empCode, date } = teamChange;
    if (!row?.id) return;
    if (!empCode) {
      notify("Pick the person first.", "warning");
      return;
    }
    if (!date) {
      notify("Pick the day the change takes effect.", "warning");
      return;
    }

    setTeamChange((s) => ({ ...s, busy: true }));
    try {
      const url =
        mode === "add" ? "OnDuty/onduty_add_member" : "OnDuty/onduty_remove_member";
      const res = await api.post(
        url,
        { DutyId: String(row.id), EmpCode: empCode, FromDate: date, By: empCode2() },
        { headers: authHeaders() }
      );

      const first = readRows(res.data)[0];
      const ok = !!field(first, "Ok");
      const message =
        String(field(first, "Message") ?? "").trim() ||
        (ok ? "Saved." : "That change was not accepted.");

      // A refusal is a normal answer here, not a failure: the procedure
      // knows things the screen does not - that the person is already on
      // for the whole duty, that they are the last one left on it - and
      // says so in words worth showing rather than a status code.
      notify(message, ok ? "success" : "warning");

      if (ok) {
        await loadDutyMembers(String(row.id));
        await loadDuties();
        await loadChangeRequests();
        closeTeamChange();
      } else {
        setTeamChange((s) => ({ ...s, busy: false }));
      }
    } catch (e: any) {
      console.error("submitTeamChange error:", e);
      notify("Could not save that change - " + serverSaid(e), "danger");
      setTeamChange((s) => ({ ...s, busy: false }));
    }
  };

  // The logged-in code, read through a function so the closure above does
  // not capture a stale render's value.
  const empCode2 = () => empCode;

  // Every day the duty spans, paired with the day-of-month string the
  // column stores. Built from the duty's own range so a day outside it
  // can never be marked, which is the failure the free text column
  // allowed and nobody could see afterwards.
  const dutyDayList = (row: any): { key: string; label: string }[] => {
    const from = moment(ymd(row?.DateFrom), "YYYY-MM-DD");
    const to = moment(ymd(row?.DateTo) || ymd(row?.DateFrom), "YYYY-MM-DD");
    if (!from.isValid() || !to.isValid() || to.isBefore(from, "day")) return [];

    const out: { key: string; label: string }[] = [];
    const seen = new Set<string>();
    const cur = from.clone();
    let guard = 0;
    while (cur.isSameOrBefore(to, "day") && guard < 62) {
      const k = cur.format("DD");
      // A duty that spans a month boundary can offer the same day number
      // twice, and the column has no way to tell them apart - so it is
      // listed once, labelled with the first date it means.
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ key: k, label: cur.format("DD-MM-YYYY") });
      }
      cur.add(1, "day");
      guard += 1;
    }
    return out;
  };

  const openAttEdit = (row: any) => {
    const current = String(row?.AttDays || "")
      .split(",")
      .map((x: string) => x.trim())
      .filter(Boolean)
      .map((x: string) => x.padStart(2, "0"));
    setAttEdit({ open: true, row, days: current, busy: false });
  };

  const closeAttEdit = () =>
    setAttEdit((s) => ({ ...s, open: false, busy: false }));

  const toggleAttDay = (key: string) =>
    setAttEdit((s) => ({
      ...s,
      days: s.days.includes(key)
        ? s.days.filter((d) => d !== key)
        : [...s.days, key].sort(),
    }));

  const submitAttEdit = async () => {
    const { row, days } = attEdit;
    if (!row?.id) return;
    if (days.length === 0) {
      notify("Mark at least one day, or cancel the duty instead.", "warning");
      return;
    }

    setAttEdit((s) => ({ ...s, busy: true }));
    try {
      const res = await api.post(
        "OnDuty/onduty_save_attdays",
        { DutyId: String(row.id), Days: days.join(","), By: empCode2() },
        { headers: authHeaders() }
      );
      const first = readRows(res.data)[0];
      const ok = field(first, "Ok") !== false;
      notify(
        String(field(first, "Message") ?? "").trim() ||
          (ok ? "Reporting days saved." : "That change was not accepted."),
        ok ? "success" : "warning"
      );
      if (ok) {
        await loadDuties();
        await loadChangeRequests();
        closeAttEdit();
      } else {
        setAttEdit((s) => ({ ...s, busy: false }));
      }
    } catch (e: any) {
      console.error("submitAttEdit error:", e);
      notify("Could not save the reporting days - " + serverSaid(e), "danger");
      setAttEdit((s) => ({ ...s, busy: false }));
    }
  };





  // Every amendment still waiting on HR, for every duty on screen, in one
  // call. Fetching per duty would cost a round trip per card to be told
  // "nothing pending" over and over, which is the usual answer.
  const loadChangeRequests = async () => {
    try {
      const res = await api.get("OnDuty/onduty_change_requests", {
        params: { By: empCode2(), Status: "Pending" },
        headers: authHeaders(),
      });
      const grouped: Record<string, any[]> = {};
      readRows(res.data).forEach((r: any) => {
        const k = String(field(r, "Duty_Id") ?? "").trim();
        if (!k) return;
        (grouped[k] = grouped[k] || []).push(r);
      });
      setChangeReqs(grouped);
    } catch (e) {
      // A database that has not had the new script run yet answers 404
      // here, and the rest of the screen must carry on exactly as before.
      console.error("loadChangeRequests failed:", e);
    }
  };

  const decideChange = async (id: number, approve: boolean) => {
    if (!id) return;
    setChangeBusy(id);
    try {
      const res = await api.post(
        "OnDuty/onduty_decide_change",
        {
          Id: id,
          Status: approve ? "Approve" : "Reject",
          By: empCode2(),
          Remarks: null,
        },
        { headers: authHeaders() }
      );
      const first = readRows(res.data)[0];
      const ok = field(first, "Ok") !== false;
      // The procedure answers in words - "Approved. Added to the duty.",
      // or the reason an approval could not be carried out - and those
      // words are worth more than a generic success line.
      notify(
        String(field(first, "Message") ?? "").trim() ||
          (ok ? "Done." : "That decision was not accepted."),
        ok ? "success" : "warning"
      );
      await loadChangeRequests();
      if (ok && approve) await loadDuties();
    } catch (e: any) {
      console.error("decideChange error:", e);
      notify("Could not record that decision - " + serverSaid(e), "danger");
    } finally {
      setChangeBusy(0);
    }
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

  // Which vehicles this duty could be on - straight off the vehicles master,
  // narrowed only by the transport line.
  //
  // "Office 4 Wheeler" means the office's four wheelers and nobody else's.
  // "Own 2 Wheeler" means every two wheeler on the master that belongs to a
  // person rather than to the office. It used to mean only the ones belonging
  // to people already added to the duty, which read well and worked badly: a
  // duty is often raised before the passengers are on it, and a vehicle that
  // is not on the list is a vehicle that has to be typed - which registers it
  // nowhere and leaves it with no per kilometre rate to be paid at. The
  // master is the list. Whose it is stays on the row, so the right one is
  // still easy to find.
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
        return String(v.VehType ?? "").trim().toLowerCase() === wantType;
      })
      .map((v: any) => {
        const owner = String(v.OwnedBy ?? "").trim().toLowerCase();
        const mine = !wantOffice && owner === me;
        return {
          ...v,
          _isMine: mine,
          // Yours, then the people already on this duty, then the rest of the
          // master. Nothing is hidden - the likely answer is just nearer the
          // top than the unlikely one.
          _rank: mine ? 0 : travellers.has(owner) ? 1 : 2,
          _ownerLabel: wantOffice ? "" : mine ? "Yours" : nameOf(owner) || String(v.OwnedBy ?? ""),
        };
      })
      .sort((a: any, b: any) => {
        if (a._rank !== b._rank) return a._rank - b._rank;
        return String(a.VehNo ?? "").localeCompare(String(b.VehNo ?? ""));
      });
  }, [vehicleMaster, transportMode, empCode, selectedCodes, team]);

  useEffect(() => {
    if (userLoaded && empCode) {
      loadTeam();
      loadClients();
      loadBranches();
      loadDuties();
      loadVehicleMaster();
      loadChangeRequests();

    }
  }, [userLoaded, empCode]);

  // Start/End Camp badges only ever reflect whatever camp_status answered
  // the one time loadDuties() ran (page load, or a manual list reload).
  // Start Camp tapped from another device - or even this same list screen
  // sitting open in the background - never updates the already-rendered
  // badge without a refetch, so a duty that is genuinely live can keep
  // showing "Start Camp" indefinitely. Re-polling camp status periodically
  // closes that gap without needing a full duty-list reload.
  useEffect(() => {
    if (!dutiesList.length) return;
    const campStatusInterval = setInterval(() => {
      loadCampStatuses(dutiesList);
    }, 30000);

    return () => clearInterval(campStatusInterval);
  }, [dutiesList]);

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

        // 📱 Dispatch WhatsApp notifications to assigned RAs
        (async () => {
          try {
            console.group("📱 [OnDuty WhatsApp Dispatcher]");
            const rawBody = typeof res?.data === "object" ? JSON.stringify(res?.data) : String(res?.data ?? "");
            let dutyId = rawBody.match(/\d+/)?.[0] || "";

            if (!dutyId || dutyId === "NEW") {
              try {
                const logsRes: any = await apiService.get(`/OnDuty/load_my_duties?empCode=${empCode}`);
                let list: any[] = [];
                if (typeof logsRes === "string") {
                  try { list = JSON.parse(logsRes); } catch { list = []; }
                } else if (Array.isArray(logsRes)) {
                  list = logsRes;
                } else if (logsRes?.data) {
                  list = Array.isArray(logsRes.data) ? logsRes.data : [];
                }
                if (list && list.length > 0) {
                  const topDuty = list[0];
                  if (Array.isArray(topDuty)) {
                    dutyId = String(topDuty[0] || "").trim();
                  } else {
                    dutyId = String(topDuty.id || topDuty.ID || topDuty.Id || topDuty.lid || topDuty.LID || "").trim();
                  }
                  console.log("🎯 Resolved latest Duty ID from On-Duty Logs:", dutyId);
                }
              } catch (e) {
                console.warn("⚠️ Could not fetch latest duty ID from load_my_duties:", e);
              }
            }
            if (!dutyId) dutyId = "NEW";

            console.log("🆔 Final Duty ID for WhatsApp links:", dutyId);
            console.log("👤 Submitted EmpCode:", empCode);

            const matrixRes = await apiService.loadReportingMatrix(empCode);
            console.log("🔍 Raw Reporting Matrix Response:", matrixRes);

            const getMatrixVal = (obj: any, ...keys: string[]) => {
              if (!obj || typeof obj !== "object") return "";
              for (const k of keys) {
                if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") {
                  return String(obj[k]).trim();
                }
              }
              const objKeys = Object.keys(obj);
              for (const targetKey of keys) {
                const matchedKey = objKeys.find((k) => k.toLowerCase() === targetKey.toLowerCase());
                if (
                  matchedKey &&
                  obj[matchedKey] !== undefined &&
                  obj[matchedKey] !== null &&
                  String(obj[matchedKey]).trim() !== ""
                ) {
                  return String(obj[matchedKey]).trim();
                }
              }
              return "";
            };

            let matrix: any = null;
            if (Array.isArray(matrixRes)) {
              // Try to find duty matrix row
              matrix =
                matrixRes.find((r: any) => {
                  const type = String(r.RequestType || r.requestType || r.Type || r[1] || "").toLowerCase();
                  return type.includes("duty") || type.includes("onduty") || type.includes("field");
                }) || matrixRes[0];
            } else if (matrixRes && typeof matrixRes === "object") {
              matrix = matrixRes;
            }
            console.log("🎯 Selected Matrix Row:", matrix);

            let ra1Code = getMatrixVal(matrix, "rA1", "RA1", "ra1");
            let ra2Code = getMatrixVal(matrix, "rA2", "RA2", "ra2");

            // Fallback: Query employee profile ONLY if matrix has no RA1
            if (!ra1Code) {
              console.log("🔍 Matrix row has no RA1. Querying Employee Profile for RA1 fallback...");
              try {
                const empDetails = await apiService.getEmployee(empCode);
                const empRow = Array.isArray(empDetails) ? empDetails[0] : empDetails;
                if (empRow) {
                  const possibleRA = String(
                    empRow.RA1 || empRow.ra1 || empRow.rA1 || empRow.ReportingManager || empRow.RA || ""
                  ).trim();
                  if (possibleRA && !possibleRA.includes("AB-") && possibleRA !== "-") {
                    ra1Code = possibleRA;
                    console.log("🎯 Fallback RA1 from Profile:", ra1Code);
                  }
                }
              } catch (profileErr) {
                console.warn("⚠️ Employee profile query error:", profileErr);
              }
            }

            const selectedEmpNames = team
              .filter((e) => selectedCodes.includes(String(e.EmpCode)))
              .map((e) => e.EmpName)
              .join(", ") || empCode;

            const details = {
              empNames: selectedEmpNames,
              dateFrom: moment(dutyFromDate).format("YYYY-MM-DD"),
              dateTo: moment(dutyToDate).format("YYYY-MM-DD"),
              location: location || institution || branchName || "Field Duty",
              onDutyType: onDutyType || "Field Duty",
              description: dutiesDesc,
              vehicle: vehicleNo,
            };

            const raSlots = [
              {
                code: ra1Code,
                name: getMatrixVal(matrix, "rA1_Name", "RA1_Name", "ra1Name") || "Reporting Manager (RA1)",
                mobile: getMatrixVal(matrix, "rA1_Mobile", "RA1_Mobile", "ra1Mobile", "RA1_Phone"),
              },
              {
                code: ra2Code,
                name: getMatrixVal(matrix, "rA2_Name", "RA2_Name", "ra2Name") || "Reporting Manager (RA2)",
                mobile: getMatrixVal(matrix, "rA2_Mobile", "RA2_Mobile", "ra2Mobile", "RA2_Phone"),
              },
            ].filter((r) => r.code && r.code !== "-" && !r.code.includes("AB-"));

            console.log("👥 Identified RA Slots:", raSlots);

            for (const ra of raSlots) {
              let targetMobile = ra.mobile;
              let targetName = ra.name;
              let targetCode = ra.code;

              // Resolve RA mobile & name using apiService helper
              if (!targetMobile && ra.code) {
                try {
                  const resolved = await apiService.resolveRAMobileAndName(String(ra.code));
                  if (resolved) {
                    targetMobile = resolved.mobile;
                    targetName = resolved.name;
                    targetCode = resolved.empCode;
                    console.log(`✅ Resolved RA "${ra.code}" -> Name: ${targetName}, Mobile: ${targetMobile}`);
                  }
                } catch (e) {
                  console.warn("⚠️ Get RA profile error:", e);
                }
              }

              if (targetMobile) {
                console.log(`🚀 Dispatching WhatsApp to RA ${targetName} (${targetCode}) at ${targetMobile}`);
                await apiService.sendOnDutyRAApprovalNotification(
                  dutyId,
                  String(targetMobile),
                  String(targetName),
                  String(targetCode),
                  details
                );
              } else {
                console.warn(`⚠️ Could not resolve mobile number for RA Code/Designation: ${ra.code}`);
              }
            }

            if (raSlots.length === 0) {
              console.warn("⚠️ No Reporting Matrix slots found for employee:", empCode);
            }
            console.groupEnd();
          } catch (waErr) {
            console.warn("❌ [OnDuty WhatsApp] Auto notify RA error:", waErr);
          }
        })();

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

  // new Date() understands ISO and the American month-first order, and
  // nothing else. The camp start and end columns have been seen holding
  // "06-08-2026 09:30" - day first, the way the card itself prints it - and
  // on that string new Date() returns an Invalid Date, whose toISOString()
  // does not return a value but throws. That throw happened inside
  // editOnDuty's try block, so a record that had arrived complete and
  // correct was abandoned on the way to the form and the click reported a
  // load failure. The data was never the problem; reading it was.
  //
  // Returns null when there is genuinely nothing to read, so the caller can
  // fall through to its next choice instead of showing an invented date.
  const toIsoOrNull = (v: any): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s) return null;

    const direct = new Date(s);
    if (!isNaN(direct.getTime())) return direct.toISOString();

    // dd-MM-yyyy or dd/MM/yyyy, with an optional time after it.
    const m = s.match(
      /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
    );
    if (m) {
      const d = new Date(
        Number(m[3]),
        Number(m[2]) - 1,
        Number(m[1]),
        Number(m[4] || 0),
        Number(m[5] || 0),
        Number(m[6] || 0)
      );
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    return null;
  };

  // The camp from and to controls carry the time as well as the date - the
  // save reads _Starttime and _Endtime straight off them - so restoring only
  // a date quietly rewrites a 09:30 start as 00:00 the next time the record
  // is saved. Date and time are stored in separate columns and have to be put
  // back together here, or editing a duty to change one field would silently
  // destroy its timeline.
  const composeDateTime = (dateVal: any, timeVal: any): string | null => {
    const iso = toIsoOrNull(dateVal);
    if (!iso) return null;

    const m = String(timeVal ?? "").trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return moment(iso).toISOString(true);

    return moment(iso)
      .hours(Number(m[1]))
      .minutes(Number(m[2]))
      .seconds(0)
      .milliseconds(0)
      .toISOString(true);
  };

  const editOnDuty = async (id: string, ownerHint?: any, card?: DutyRow) => {
    if (!canEdit && !canApprove) {
      notify("Permission Denied", "danger");
      return;
    }

    try {
      // App_Get_Duties matches on the empCode handed to it as well as on the
      // id. Someone opening their own request passes their own code and the
      // record comes straight back. An Accountant or a Director, though, is
      // shown the pencil on every card on the page - other people's requests
      // included - and asking for one of those under the viewer's own code
      // matches nothing at all, which is the whole of the failure being
      // reported. So the applicant's own code is tried second, and only an
      // admin's click can ever reach that second try.
      const fetchRow = async (code: string) => {
        const r = await api.get("OnDuty/edit_onduties", {
          params: { EmpCode: code, id },
          headers: authHeaders(),
        });
        // The controller answers with Ok(JsonConvert.SerializeObject(...)),
        // which is a JSON *string*. Axios parses it back for us when the
        // response is labelled as JSON and hands it over untouched when it is
        // not, so both shapes have to be expected here. A string that will not
        // parse is treated as no record rather than allowed to throw - a
        // malformed answer is still an answer, and it is not a fault of the
        // click.
        let parsed: any = r.data;
        if (typeof parsed === "string") {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            parsed = null;
          }
        }
        return Array.isArray(parsed) && parsed[0] ? parsed[0] : null;
      };

      let row = await fetchRow(empCode);

      const ownerCode = String(ownerHint ?? "").trim();
      if (!row && canEdit && ownerCode && ownerCode !== empCode) {
        row = await fetchRow(ownerCode);
      }

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

      if (!row) {
        // Neither code found it, so the record is not this person's to open.
        // That is a rule, not a fault, and saying which one it is spares
        // somebody hunting for a breakage that never happened.
        notify(
          "That request could not be opened for editing - it is not one of your own records.",
          "warning"
        );
        return;
      }

      {
        setEditingId(String(row[0]));
        // Belt and braces with the editingId guard in the defaults effect:
        // the stored times win, whichever order the two states commit in.
        campTimesTouchedRef.current = true;
        setSelectedCodes(String(row[1]).split(",").filter(Boolean));
        // The card in the list already holds this duty's real range and its
        // real times - it is what draws "04-08-2026 09:30 -> 05-08-2026 18:30"
        // on the screen the pencil sits on - so it is read first. The row from
        // App_Get_Duties stays as a fallback, but its fourteenth and fifteenth
        // columns have been seen arriving empty, and when they did both ends
        // of the form fell back to the single start date. A two-day duty then
        // reopened as a one-day duty, and the second reporting day disappeared
        // with it, because the day pills only offer days inside the range.
        setDutyFromDate(
          composeDateTime(card?.DateFrom, card?.Start_Time) ??
            toIsoOrNull(row[13]) ??
            composeDateTime(row[2], row[7]) ??
            nowIST().toISOString(true)
        );
        setDutyToDate(
          composeDateTime(card?.DateTo, card?.End_Time) ??
            composeDateTime(card?.DateFrom, card?.End_Time) ??
            toIsoOrNull(row[14]) ??
            composeDateTime(row[2], row[8]) ??
            nowIST().toISOString(true)
        );
        setInstitution(row[3]);
        setLocation(row[15] || "");
        // Three sources for the same answer, in order of how much they can
        // be trusted: the endpoint that serves these columns by name, the
        // card that is already showing them correctly, and finally the row's
        // positional columns.
        setOnDutyType(
          (extra ? extra.onDutyType : "") || card?.OnDutyType || row[16] || ""
        );
        setBranchName(
          (extra ? extra.branch : "") || card?.Branch || row[17] || ""
        );
        // undefined (no endpoint) and null (column never written for this row)
        // both mean "no stored answer", so leave the defaults to decide. Only a
        // real string - including "" - counts as a selection to restore.
        setPendingAttDays(
          extra && typeof extra.attDays === "string"
            ? extra.attDays
            : typeof card?.AttDays === "string"
              ? card.AttDays
              : null
        );
        // Safe to set before setTransportMode below: both land in the same
        // commit, so the effect that clears a trip type on a hidden field
        // sees the restored transport mode, not the one being replaced.
        setTripType((extra ? extra.tripType : "") || card?.TripType || "");
        setBranchChangeType(
          (extra ? extra.branchChangeType : "") || card?.BranchChangeType || ""
        );
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
    } catch (e: any) {
      console.error("editOnDuty error:", e);
      // "Failed to load record" on its own describes the symptom and names no
      // cause, so every report of it arrives with nothing to act on. The
      // status code, or failing that the error's own words, is usually enough
      // to tell a rejected request from an unreachable server.
      const why = e?.response?.status
        ? "the server answered " + e.response.status
        : e?.message || "an unexpected error";
      notify("Failed to load record - " + why, "danger");
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

  // A duty whose last day is behind us is history, and history is not
  // amended - it is settled.  Adding somebody to a duty that finished
  // last week would invent attendance for days that have already been
  // punched or not punched, and moving its branch-reporting days would
  // move the geofence a punch was already judged against.  So the three
  // amendment controls come off the card once the duty has ended, while
  // DA / TA stays - reading what happened is the whole point of a duty
  // that is over.
  const dutyHasEnded = (row: any): boolean => {
    const end = ymd(row?.DateTo) || ymd(row?.DateFrom);
    if (!end) return false;
    const d = moment(end, "YYYY-MM-DD");
    return d.isValid() && d.isBefore(moment(), "day");
  };

  // A Round Trip's camp can be ended manually (End Camp) at any point, well
  // before the duty's own scheduled last day - once it has, the server
  // refuses further visits, reading uploads, and team changes on the whole
  // duty right along with it (see EndCamp / RunTeamChange / Save_DayTrip's
  // lock check on the API). dutyHasEnded alone only catches the scheduled
  // date passing, so a duty ended early would still show live Add/Remove/
  // Edit controls that the server would just reject anyway - this also
  // catches that case.
  const campHasLocked = (row: any): boolean =>
    !!campStatusByDuty[String(row?.id || "")]?.locked;

  // Who may amend an approved duty, and who may open its settlement.
  //
  // The blanket designation test these buttons used to lean on asks whether
  // the viewer is a Team Leader or a Manager in general, which is a different
  // question from the one actually being asked. An HR named on this very
  // request's approval line failed it, and so did every approver reading the
  // Team Requests tab, whose rows are by definition not their own. Yet the
  // request already names the people entitled to decide it, so that is what
  // gets asked here: does the viewer hold one of the roles standing in
  // RA1..RA4. Alongside them sit the accountant and the director, who may act
  // on any duty at all, and the person who raised the request, who assembled
  // the team in the first place and is usually the one who notices somebody
  // missing from it.
  const canAmendDuty = (row: DutyRow): boolean => {
    if (canEdit) return true;
    if ([row.RA1, row.RA2, row.RA3, row.RA4].some((ra) => roleMatchesUser(ra)))
      return true;
    if (canApprove && row.isOwn !== false) return true;
    const applicant = String((row as any)?.AppliedBy ?? "").trim();
    return !!applicant && applicant === String(empCode || "").trim();
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
                      // Nothing to pick, and nothing to type either. A plate
                      // that is not on the master has no owner and no per
                      // kilometre rate behind it, so a duty carrying one is
                      // approved and then quietly pays no TA at all. Better to
                      // say the vehicle is not registered than to accept a
                      // number that will not be honoured. It gets added on the
                      // vehicles master, and then it is here.
                      <span
                        style={{
                          flex: 1,
                          fontSize: "13px",
                          fontWeight: "500",
                          color: vehicleNo ? "#1e293b" : "#94a3b8",
                        }}
                      >
                        {vehicleNo
                          ? vehicleNo
                          : !transportMode
                          ? "Select the transport first"
                          : String(transportMode).toLowerCase().startsWith("office")
                          ? "No office vehicle is registered"
                          : "No vehicle is registered"}
                      </span>
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
                  {/* The heading is the duty itself now: type and branch,
                      which used to cost two labelled boxes down in the grid.
                      "Party" was a placeholder standing in for a column most
                      duties never fill, so it survives only as the fallback
                      for a duty that has neither a type nor a branch. */}
                  <div className="college-name" data-probe="dm-head-title">
                    {/* The id leads. It is the thing anyone quotes back in a
                        message or a phone call, so it should not have to be
                        hunted for at the end of a branch name that varies in
                        length from card to card. */}
                    <span className="dm-id-badge lead">#{row.id}</span>
                    {(() => {
                      const t = String(row.OnDutyType || "").trim();
                      const b = String(row.Branch || "").trim();
                      const head = [t, b].filter(Boolean).join(" - ");
                      return head || String(row.College || "").trim() || "Duty";
                    })()}
                    {/* Why they are at that branch travelled with the branch
                        in the old box, so it travels with it here too. */}
                    {!!row.BranchChangeType && (
                      <span style={{ color: "#64748b", fontWeight: 600 }}>
                        {" "}
                        &bull; {row.BranchChangeType}
                      </span>
                    )}
                  </div>
                  <div className="duty-subtitle">{row.Description}</div>
                </div>

                {/* Hovering the badge says where this verdict came from. The
                    duty table keeps two status columns and only one of them is
                    ever written, so "why does an approved duty say Pending" is
                    a question this badge gets asked - it should be able to
                    answer it without a rebuild and a console. The tooltip is
                    also the marker for whether the running bundle has this fix
                    in it at all: no tooltip, old bundle. */}
                {/* The two things anyone scanning a duty actually wants -
                    how far the approval has got, and whether there is money
                    left to settle - now travel with the id instead of
                    sitting at the foot of the card, so neither costs a
                    scroll past everything in between. */}
                <div className="dm-head-right">
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

                  {/* A plain button, not an IonButton: an IonButton carries
                      its own height and margins and would set the header
                      row's height all by itself. */}
                  {canAmendDuty(row) && isFullyApproved(row) && (
                    <button
                      type="button"
                      className="dm-data-link"
                      onClick={() => history.push("/datasettlement?duty=" + row.id)}
                    >
                      DA / TA
                    </button>
                  )}

                  {/* Only offered once a duty is actually approved - a camp
                      for a duty that might still be rejected is not a thing.
                      Round Trip's ended camp shows as a plain badge instead
                      of a button: it cannot be restarted (see EndCamp on the
                      server), so there is nothing left to tap.

                      How much of this is a BUTTON at all depends on trip
                      type and vehicle, same rule the server enforces:
                        - Daily Shuttle on an own/office vehicle: no button
                          at all. That day's own start/end reading upload
                          opens and closes the camp automatically (with its
                          own confirmation, in the day-trip modal).
                        - Round Trip on an own/office vehicle: Start Camp is
                          never shown - the opening reading starts it. End
                          Camp still shows, but stays disabled until a
                          closing reading has actually been uploaded for
                          some day of the trip.
                        - Public Transport, or a trip type/mode this card
                          does not recognise: both buttons work exactly as
                          before - there is no reading upload to do the job
                          instead, so a person has to. */}
                  {rowApproved &&
                    (() => {
                      const campStatus = campStatusByDuty[String(row.id)];
                      const busy = !!campBusy[String(row.id)];
                      const tripTypeRow = String(row.TripType || "").trim().toLowerCase();
                      const modeRow = String(row.Mode_of_Trans || "").trim();
                      const isShuttleRow = tripTypeRow === "daily shuttle";
                      const isRoundTripRow = tripTypeRow === "round trip";
                      const isVehicleRow =
                        modeRow === "Own 4 Wheeler" ||
                        modeRow === "Own 2 Wheeler" ||
                        modeRow === "Office 4 Wheeler" ||
                        modeRow === "Office 2 Wheeler";

                      if (isShuttleRow && isVehicleRow) return null;

                      // campStatusByDuty has no entry for this duty until
                      // camp_status actually answers for it - undefined is
                      // "not known yet", not "not active". Falling through
                      // to the Start Camp default while that answer is
                      // still in flight is exactly the misleading flash
                      // this was hiding: a camp that is genuinely already
                      // running would show "Start Camp" for however long
                      // the fetch takes, on every single reload. Showing
                      // nothing until the real answer arrives is honest
                      // about not knowing yet, instead of guessing wrong.
                      if (campStatus === undefined) {
                        return (
                          <span className="dm-camp-loading" title="Checking camp status...">
                            &hellip;
                          </span>
                        );
                      }

                      if (campStatus?.locked) {
                        return (
                          <span
                            className="dm-camp-locked"
                            title="Round Trip camp has ended - no further visits, reading uploads, or team changes on this duty."
                          >
                            Camp Ended
                          </span>
                        );
                      }

                      if (campStatus?.active) {
                        return (
                          <button
                            type="button"
                            className="dm-data-link dm-camp-end"
                            disabled={busy}
                            onClick={() => openCampConfirm("end", row)}
                          >
                            {busy ? "Ending…" : "End Camp"}
                          </button>
                        );
                      }

                      // Not active yet. Round Trip on an own/office vehicle
                      // only ever starts from the opening reading - there is
                      // no manual Start Camp for that combination.
                      if (isRoundTripRow && isVehicleRow) return null;

                      return (
                        <button
                          type="button"
                          className="dm-data-link"
                          disabled={busy}
                          onClick={() => openCampConfirm("start", row)}
                        >
                          {busy ? "Starting…" : "Start Camp"}
                        </button>
                      );
                    })()}

                  <span
                    className={`dm-status-dot ${rowApproved ? "approved" : rowRejected ? "rejected" : "pending"}`}
                    data-probe="dm-status-probe"
                    title={`status = ${row.Status || "(none)"} | RA: ${[row.RA1_Status, row.RA2_Status, row.RA3_Status, row.RA4_Status]
                      .map((s) => String(s ?? "-"))
                      .join(", ")}`}
                  >
                    {rowApproved ? "Approved" : rowRejected ? "Rejected" : "Pending"}
                  </span>
                </div>
              </div>
              {/* An amendment to an approved duty is a request, not an act,
                  so the card has to say out loud that something has been
                  asked for and has not happened yet. Without this strip the
                  person who pressed the button sees a duty that looks
                  exactly as it did, and reasonably concludes the button is
                  broken. The two decision buttons appear only for HR. */}
              {(changeReqs[String(row.id)] || []).length > 0 && (
                <div className="od-chg-strip">
                  <div className="od-chg-head">
                    Waiting for approval ({(changeReqs[String(row.id)] || []).length})
                    {/* Without this the strip reads as a broken control to
                        everyone who is not HR: something is clearly waiting,
                        and there is nothing to press. */}
                    {!(changeReqs[String(row.id)] || []).some(
                      (cr: any) => !!field(cr, "CanDecide")
                    ) && (
                      <span className="od-chg-note">
                        one of this duty's approvers, or HR, decides this
                      </span>
                    )}
                  </div>
                  {(changeReqs[String(row.id)] || []).map((cr: any, ci: number) => (
                    <div className="od-chg-row" key={String(field(cr, "ID") ?? ci)}>
                      <div className="od-chg-text">
                        <span>{String(field(cr, "Summary") ?? "").trim()}</span>
                        <span className="od-chg-by">
                          asked by{" "}
                          {String(
                            field(cr, "RequestedByName") ??
                              field(cr, "Requested_By") ??
                              "someone"
                          ).trim()}
                        </span>
                        {!!String(field(cr, "Outcome") ?? "").trim() && (
                          <span className="od-chg-why">
                            {String(field(cr, "Outcome")).trim()}
                          </span>
                        )}
                      </div>
                      {!!field(cr, "CanDecide") && (
                        <div className="od-chg-acts">
                          <button
                            type="button"
                            className="od-team-btn add"
                            disabled={changeBusy === Number(field(cr, "ID"))}
                            onClick={() => decideChange(Number(field(cr, "ID")), true)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="od-team-btn remove"
                            disabled={changeBusy === Number(field(cr, "ID"))}
                            onClick={() => decideChange(Number(field(cr, "ID")), false)}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    window.innerWidth <= 768
                      ? "1fr"
                      : "repeat(4, minmax(0, 1fr))",
                  gap: "10px",
                  alignItems: "start",
                  marginTop: "10px",
                }}
              >
                <div className="duty-info-box full-width">
                  {/* Once a duty is approved the pencil is the wrong tool -
                      re-opening the whole request to move one person would
                      put its approvals back in play. Add and Remove change
                      one membership from a stated day and leave everything
                      else, including the approval chain, alone. While the
                      duty is still pending the pencil is still the right
                      answer, so the two never appear together. */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="item-label">Employees</span>

                    {canAmendDuty(row) &&
                      rowApproved &&
                      !dutyHasEnded(row) && (
                        <>
                          <button
                            type="button"
                            className="od-team-btn add"
                            disabled={campHasLocked(row)}
                            title={
                              campHasLocked(row)
                                ? "Camp has ended - team changes are closed on this duty."
                                : undefined
                            }
                            onClick={() => !campHasLocked(row) && openTeamChange("add", row)}
                          >
                            + Add
                          </button>
                          <button
                            type="button"
                            className="od-team-btn remove"
                            disabled={campHasLocked(row)}
                            title={
                              campHasLocked(row)
                                ? "Camp has ended - team changes are closed on this duty."
                                : undefined
                            }
                            onClick={() => !campHasLocked(row) && openTeamChange("remove", row)}
                          >
                            &minus; Remove
                          </button>
                        </>
                      )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      marginTop: "4px",
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
                                  padding: "4px 9px",
                                  borderRadius: "20px",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                }}
                              >
                                {emp.name}
                                {emp.code && (
                                  <span style={{ opacity: 0.7 }}> ({emp.code})</span>
                                )}
                                {/* Shown only for the exceptions. Marking
                                    every chip with the duty's own dates
                                    would bury the one person whose stretch
                                    is actually different. */}
                                {(() => {
                                  const w = (dutyMembers[String(row.id)] || []).find(
                                    (m) =>
                                      m.EmpCode ===
                                      String(emp.code ?? "").trim()
                                  );
                                  if (!w || !w.Partial) return null;
                                  return (
                                    <span
                                      style={{
                                        display: "block",
                                        fontSize: "10px",
                                        fontWeight: 600,
                                        opacity: 0.85,
                                        marginTop: "2px",
                                      }}
                                    >
                                      {prettyDay(w.FromDate)} &rarr;{" "}
                                      {prettyDay(w.ToDate)}
                                    </span>
                                  );
                                })()}
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
                                padding: "4px 9px",
                                borderRadius: "20px",
                                fontSize: "11px",
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

                {/* Only the marked days are stored, so unlike the form there
                    is no unmarked counterpart to show here - every pill is a
                    green one, and the count carries the rest of the meaning. */}
                {(attDayPills(row).length > 0 ||
                  (canAmendDuty(row) &&
                    rowApproved &&
                    !dutyHasEnded(row) &&
                    !!row.OnDutyType &&
                    String(row.OnDutyType).toLowerCase().includes("branch"))) && (
                  <div className="duty-info-box" style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span className="item-label">
                        Reporting Dates at Branch ({attDayPills(row).length})
                      </span>

                      {/* Same gate as Add and Remove: while the duty is still
                          pending the pencil opens the whole form, so a second
                          way in would only be a second thing to keep in step. */}
                      {canAmendDuty(row) &&
                        rowApproved &&
                        !dutyHasEnded(row) && (
                          <button
                            type="button"
                            className="od-team-btn"
                            disabled={campHasLocked(row)}
                            title={
                              campHasLocked(row)
                                ? "Camp has ended - reporting dates are closed on this duty."
                                : undefined
                            }
                            onClick={() => !campHasLocked(row) && openAttEdit(row)}
                          >
                            Edit
                          </button>
                        )}
                    </div>
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
                              disabled={campHasLocked(row)}
                              title={
                                campHasLocked(row)
                                  ? "Camp has ended - this trip's log is closed to further edits."
                                  : undefined
                              }
                              style={{
                                margin: 0,
                                minHeight: "24px",
                                fontSize: "11px",
                              }}
                              onClick={() => !campHasLocked(row) && openEditDayTripModal(row, index)}
                            >
                              EDIT
                            </IonButton>

                            <IonButton
                              fill="clear"
                              size="small"
                              color="danger"
                              disabled={campHasLocked(row)}
                              title={
                                campHasLocked(row)
                                  ? "Camp has ended - this trip's log is closed to further edits."
                                  : undefined
                              }
                              style={{
                                margin: 0,
                                minHeight: "24px",
                                fontSize: "11px",
                              }}
                              onClick={() => !campHasLocked(row) && removeTripDay(row.id, index)}
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
              {(canEdit || (canApprove && row.isOwn !== false)) && !rowApproved && (
                <IonButton
                  fill="clear"
                  color="primary"
                  className="ion-no-margin"
                  onClick={() => editOnDuty(row.id, row.AppliedBy, row)}
                >
                  <IonIcon icon={pencilOutline} />
                </IonButton>
              )}

            </div>
              );
            })}

        </div>

        {/* One question: which of the duty's days are branch days. Days
            that are not marked are still on duty, they are just not
            reporting at the branch - so this is a set of toggles rather
            than a range, and there is no way to pick a day the duty does
            not cover. */}
        <IonModal
          isOpen={attEdit.open}
          onDidDismiss={closeAttEdit}
          className="od-team-modal"
        >
          <div className="od-team-sheet">
            {(() => {
              const row = attEdit.row;
              if (!row) return null;
              const all = dutyDayList(row);

              return (
                <>
                  <h2 style={{ margin: "0 0 4px", fontSize: "19px", fontWeight: 700 }}>
                    Reporting days at the branch
                  </h2>
                  <p style={{ margin: "0 0 18px", color: "#64748b", fontSize: "13px" }}>
                    Duty #{String(row?.id ?? "")} &middot; {prettyDay(row?.DateFrom)}
                    {ymd(row?.DateTo) && ymd(row?.DateTo) !== ymd(row?.DateFrom)
                      ? " to " + prettyDay(row?.DateTo)
                      : ""}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    {all.map((d) => {
                      const on = attEdit.days.includes(d.key);
                      return (
                        <button
                          key={d.key}
                          type="button"
                          className={"od-attday-chip" + (on ? " on" : "")}
                          onClick={() => toggleAttDay(d.key)}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>

                  {all.length === 0 && (
                    <p style={{ color: "#b91c1c", fontSize: "13px", margin: "6px 2px 0" }}>
                      This duty has no usable date range, so its days cannot be
                      listed.
                    </p>
                  )}

                  <p style={{ color: "#64748b", fontSize: "12px", margin: "16px 2px 0" }}>
                    A marked day is a day at the branch, where the branch
                    check-in rule and its geofence apply. An unmarked day is
                    still on duty, with neither.
                  </p>

                  <div style={{ display: "flex", gap: "10px", marginTop: "22px" }}>
                    <IonButton
                      expand="block"
                      style={{ flex: 1 }}
                      disabled={attEdit.busy || all.length === 0}
                      onClick={submitAttEdit}
                    >
                      {attEdit.busy ? "Saving..." : "Save"}
                    </IonButton>
                    <IonButton
                      expand="block"
                      fill="outline"
                      color="medium"
                      style={{ flex: 1 }}
                      disabled={attEdit.busy}
                      onClick={closeAttEdit}
                    >
                      Cancel
                    </IonButton>
                  </div>
                </>
              );
            })()}
          </div>
        </IonModal>

        {/* Two questions and nothing else: who, and from which day. The
            date is bounded to the duty's own range because a membership
            that starts outside the duty means nothing. */}
        <IonModal
          isOpen={teamChange.open}
          onDidDismiss={closeTeamChange}
          className="od-team-modal"
        >
          {/* A plain div, not an IonContent. IonContent is a flex child that
              reports no intrinsic height, so pairing it with --height: auto
              collapses the sheet to nothing and the modal opens invisible -
              which reads exactly like the buttons doing nothing at all. */}
          <div className="od-team-sheet">
            {(() => {
              const row = teamChange.row;
              if (!row) return null;
              const dFrom = ymd(row?.DateFrom);
              const dTo = ymd(row?.DateTo) || dFrom;
              // A duty row that does not parse must not throw here - an
              // exception inside the modal body unmounts the whole page.
              let onDuty: any[] = [];
              try {
                onDuty = dutyPeople(row || {}).chips || [];
              } catch (err) {
                console.error("dutyPeople failed for team dialog:", err);
              }
              const onCodes = new Set(
                onDuty.map((c: any) => String(c.code ?? "").trim()).filter(Boolean)
              );

              // The duty's own days, spelled the way the rest of the app
              // spells a date. A native date input renders in whatever
              // format the browser's locale prefers - 08/06/2026 for the
              // 6th of August - and there is no attribute that changes
              // that, so the field is a list rather than a date input.
              const dayChoices: { value: string; label: string }[] = [];
              if (dFrom) {
                const cur = moment(dFrom, "YYYY-MM-DD");
                const end = moment(dTo || dFrom, "YYYY-MM-DD");
                let guard = 0;
                while (cur.isSameOrBefore(end, "day") && guard < 400) {
                  dayChoices.push({
                    value: cur.format("YYYY-MM-DD"),
                    label: cur.format("DD-MM-YYYY"),
                  });
                  cur.add(1, "day");
                  guard += 1;
                }
              }

              const options =
                teamChange.mode === "add"
                  ? team
                      .filter(
                        (t: any) => !onCodes.has(String(t.EmpCode ?? "").trim())
                      )
                      .map((t: any) => ({
                        code: String(t.EmpCode ?? "").trim(),
                        name: String(t.EmpName ?? "")
                          .replace(/^\s*\d+\s*-\s*/, "")
                          .trim()
                          .toUpperCase(),
                      }))
                      .filter((o: any) => o.code)
                  : onDuty.map((c: any) => ({
                      code: String(c.code ?? "").trim(),
                      name: c.name,
                    }));

              return (
                <>
                  <h2 style={{ margin: "4px 0 2px", fontSize: "18px" }}>
                    {teamChange.mode === "add"
                      ? "Add someone to this duty"
                      : "Take someone off this duty"}
                  </h2>
                  <p style={{ margin: "0 0 14px", color: "#64748b", fontSize: "13px" }}>
                    Duty #{String(row?.id ?? "")} &middot; {prettyDay(dFrom)}
                    {dTo && dTo !== dFrom ? " to " + prettyDay(dTo) : ""}
                  </p>

                  <IonItem>
                    <IonLabel position="stacked">
                      {teamChange.mode === "add" ? "Who joins" : "Who drops"}
                    </IonLabel>
                    <IonSelect
                      value={teamChange.empCode}
                      placeholder="Select employee"
                      interface="popover"
                      onIonChange={(e) =>
                        setTeamChange((s) => ({
                          ...s,
                          empCode: String(e.detail.value ?? ""),
                        }))
                      }
                    >
                      {options.map((o: any) => (
                        <IonSelectOption key={o.code} value={o.code}>
                          {o.name} ({o.code})
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>

                  <IonItem lines="none">
                    <IonLabel position="stacked">
                      {teamChange.mode === "add"
                        ? "On the duty from"
                        : "Off the duty from"}
                    </IonLabel>
                    {/* A list of the duty's own days rather than a date
                        input: the range is at most a few days, every one
                        of them reads DD-MM-YYYY, and a day outside the
                        duty cannot be picked at all. */}
                    <IonSelect
                      value={teamChange.date}
                      placeholder="Select date"
                      interface="popover"
                      onIonChange={(e) =>
                        setTeamChange((s) => ({
                          ...s,
                          date: String(e.detail.value ?? ""),
                        }))
                      }
                    >
                      {dayChoices.map((d) => (
                        <IonSelectOption key={d.value} value={d.value}>
                          {d.label}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>

                  <p style={{ color: "#64748b", fontSize: "12px", margin: "10px 2px 0" }}>
                    {teamChange.mode === "add"
                      ? "They count as on duty from this day onwards, and DA and TA are worked out from it."
                      : "This is the first day they are no longer on the duty. Pick the duty's own first day to take them off it altogether."}
                  </p>

                  <div style={{ display: "flex", gap: "10px", marginTop: "22px" }}>
                    <IonButton
                      expand="block"
                      style={{ flex: 1 }}
                      disabled={teamChange.busy}
                      onClick={submitTeamChange}
                    >
                      {teamChange.busy
                        ? "Saving..."
                        : teamChange.mode === "add"
                          ? "Add"
                          : "Remove"}
                    </IonButton>
                    <IonButton
                      expand="block"
                      fill="outline"
                      color="medium"
                      style={{ flex: 1 }}
                      disabled={teamChange.busy}
                      onClick={closeTeamChange}
                    >
                      Cancel
                    </IonButton>
                  </div>
                </>
              );
            })()}
          </div>
        </IonModal>

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
    ref={readingFromInputRef}
    type="file"
    accept="image/*"
    onClick={(e) => {
      // A bypass "Yes" click on readingUploadConfirm below re-triggers
      // this same input via the ref - let that one through untouched, the
      // question has already been asked and answered.
      if (readingUploadBypassRef.current.from) {
        readingUploadBypassRef.current.from = false;
        saveModalScroll();
        return;
      }

      if (isReadingLocked(trip.dutyDate, "from", !!trip.readingFromImage)) {
        e.preventDefault();
        notify(
          "The starting reading photo for this day has already been uploaded " +
            "and can no longer be changed. It could only be replaced within " +
            "5 minutes of the first upload.",
          "warning"
        );
        return;
      }

      const rfFirstAt = readingLockRef.current[readingLockKey(trip.dutyDate, "from")];
      if (rfFirstAt !== undefined || confirmedReadingUploadsRef.current.has(`${trip.dutyDate}|from`)) {
        // Already asked once (either replacing within the window, or this
        // exact upload was already confirmed here) - the plain lock-replace
        // confirm still applies, nothing more to ask about camp.
        if (!confirmReadingUpload(trip.dutyDate, "from", !!trip.readingFromImage)) {
          e.preventDefault();
          return;
        }
        saveModalScroll();
        return;
      }

      // First-time upload. Mirrors needsStartConfirm in saveDayTripModal -
      // Daily Shuttle asks every day; a Round-Trip-like duty (blank
      // TripType included, same "not Daily Shuttle" proxy used throughout
      // this session) only asks on the very first reading of the whole
      // trip - once the camp is already active, later days' Reading From
      // uploads are just recording that day's numbers.
      const rfDutyTypeLower = String(selectedDutyRow?.TripType || "").trim().toLowerCase();
      const rfIsDailyShuttle = rfDutyTypeLower === "daily shuttle";
      const rfCampAlreadyActive = !!campStatusByDuty[String(selectedDutyId)]?.active;
      const rfNeedsConfirm = rfIsDailyShuttle || !rfCampAlreadyActive;

      if (!rfNeedsConfirm) {
        if (!confirmReadingUpload(trip.dutyDate, "from", !!trip.readingFromImage)) {
          e.preventDefault();
          return;
        }
        saveModalScroll();
        return;
      }

      // Stop here and ask with the same styled dialog Save Trip used to
      // wait until Save Trip for - before the photo (and its 5 minute
      // replace clock) exists at all, not after.
      e.preventDefault();
      setReadingUploadConfirm({
        open: true,
        which: "from",
        dutyDate: trip.dutyDate,
        title: rfIsDailyShuttle ? "Start today's camp?" : "Start this trip's camp?",
        text: rfIsDailyShuttle
          ? "This opening reading will start today's camp and switch on live location tracking for it. The photo can only be replaced within 5 minutes of uploading it."
          : "This opening reading will start the camp for this whole trip and switch on live location tracking for it. Later days' readings will not ask again. The photo can only be replaced within 5 minutes of uploading it.",
        secondsLeft: 5,
      });
    }}
    onChange={(e) => {
      const file = e.target.files?.[0] || null;

      if (file && readingLockRef.current[readingLockKey(trip.dutyDate, "from")] === undefined) {
        readingLockRef.current[readingLockKey(trip.dutyDate, "from")] = Date.now();
      }

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
  // Locked on the same clock as the photo it was read off. Leaving the
  // number editable while the image behind it is frozen would let the two
  // drift apart, which is the one thing the photo exists to prevent.
  disabled={
    !hasReadingFromImage ||
    isReadingLocked(trip.dutyDate, "from", hasReadingFromImage)
  }
  placeholder={
    isReadingLocked(trip.dutyDate, "from", hasReadingFromImage)
      ? "Locked - uploaded over 5 minutes ago"
      : hasReadingFromImage
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
      // In "add" mode, readingTo was just mirrored to this same
      // keystroke's value two lines up via updateTripDay - but that
      // update goes through setState, so `trip.readingTo` here is
      // still the PREVIOUS keystroke's value (stale closure), one
      // character behind. Comparing a fresh multi-digit "from"
      // against a lagging single-digit "to" made toNum < fromNum
      // true on almost every keystroke, firing a false "Reading To
      // should be greater than or equal to Reading From" warning
      // while the user was still typing a normal number. Compare
      // against the same fresh value instead of the stale one.
      tripModalMode === "add" ? value : trip.readingTo
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
            ref={readingToInputRef}
            type="file"
            accept="image/*"
            onClick={(e) => {
              // A bypass "Yes" click on readingUploadConfirm below
              // re-triggers this same input via the ref - let it through.
              if (readingUploadBypassRef.current.to) {
                readingUploadBypassRef.current.to = false;
                saveModalScroll();
                return;
              }

              if (isReadingLocked(trip.dutyDate, "to", !!trip.readingToImage)) {
                e.preventDefault();
                notify(
                  "The closing reading photo for this day has already been uploaded " +
                    "and can no longer be changed. It could only be replaced within " +
                    "5 minutes of the first upload.",
                  "warning"
                );
                return;
              }

              const rtFirstAt = readingLockRef.current[readingLockKey(trip.dutyDate, "to")];
              if (rtFirstAt !== undefined || confirmedReadingUploadsRef.current.has(`${trip.dutyDate}|to`)) {
                if (!confirmReadingUpload(trip.dutyDate, "to", !!trip.readingToImage)) {
                  e.preventDefault();
                  return;
                }
                saveModalScroll();
                return;
              }

              // Same "not Daily Shuttle" proxy used everywhere else this
              // session (Save_DayTrip/EndCamp on the API, isVehicleDuty
              // above) - a blank TripType office-vehicle duty (e.g.
              // "Party") is Round-Trip-like here too, not exempt.
              const rtDutyTypeLower = String(selectedDutyRow?.TripType || "").trim().toLowerCase();
              const rtIsDailyShuttle = rtDutyTypeLower === "daily shuttle";
              const rtIsSameDay =
                !!selectedDutyRow?.DateFrom &&
                !!selectedDutyRow?.DateTo &&
                String(selectedDutyRow.DateFrom).slice(0, 10) === String(selectedDutyRow.DateTo).slice(0, 10);
              const rtIsSameDayRoundTrip = !rtIsDailyShuttle && rtIsSameDay;
              const rtNeedsConfirm = rtIsDailyShuttle || rtIsSameDayRoundTrip;

              if (!rtNeedsConfirm) {
                // Multi-day Round Trip - a reading upload never ends camp
                // here, only the explicit End Camp button does.
                if (!confirmReadingUpload(trip.dutyDate, "to", !!trip.readingToImage)) {
                  e.preventDefault();
                  return;
                }
                saveModalScroll();
                return;
              }

              // Stop here and ask before the photo (and its 5 minute
              // replace clock) exists at all, not after - the actual
              // reading-value check (same start/end reading) still runs
              // again at Save Trip, once the closing number is known.
              e.preventDefault();
              setReadingUploadConfirm({
                open: true,
                which: "to",
                dutyDate: trip.dutyDate,
                title: rtIsDailyShuttle ? "End today's camp?" : "End this trip's camp?",
                text: rtIsDailyShuttle
                  ? "This closing reading will end today's camp and stop live location tracking for it. The photo can only be replaced within 5 minutes of uploading it."
                  : "This closing reading will permanently end this trip's camp and lock the duty - no more visits, reading uploads, or team changes will be possible afterwards. The photo can only be replaced within 5 minutes of uploading it.",
                secondsLeft: 5,
              });
            }}
            onChange={(e) => {
              const toFile = e.target.files?.[0] || null;

              if (toFile && readingLockRef.current[readingLockKey(trip.dutyDate, "to")] === undefined) {
                readingLockRef.current[readingLockKey(trip.dutyDate, "to")] = Date.now();
              }

              updateTripDay(
                editingTripIndex!,
                "readingToImage",
                toFile
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
      disabled={
        !trip.readingToImage ||
        isReadingLocked(trip.dutyDate, "to", !!trip.readingToImage)
      }
      placeholder={
        isReadingLocked(trip.dutyDate, "to", !!trip.readingToImage)
          ? "Locked - uploaded over 5 minutes ago"
          : trip.readingToImage
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
                     {tripModalMode === "edit" && (() => {
  const gate = addPartyBlockReason(selectedDutyRow, trip.dutyDate);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <IonButton
        type="button"
        fill="outline"
        disabled={!!gate}
        style={{
          margin: 0,
          width: "100%",
          minHeight: "46px",
          fontSize: "12px",
          opacity: gate ? 0.5 : 1,
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (gate) {
            notify(gate, "warning");
            return;
          }
          addTripVisit(editingTripIndex);
        }}
      >
        + Add Party
      </IonButton>
      {gate && (
        <div
          style={{
            fontSize: "11px",
            lineHeight: 1.35,
            textAlign: "center",
            color: "var(--ion-color-medium, #8a8a8a)",
          }}
        >
          {gate}
        </div>
      )}
    </div>
  );
})()}
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
        <IonModal
          isOpen={campConfirm.open}
          onDidDismiss={closeCampConfirm}
          className="camp-confirm-modal"
        >
          <div className="camp-confirm-wrapper">
            {(() => {
              const row = campConfirm.row;
              const isStart = campConfirm.action === "start";
              const tripType = row ? campStatusByDuty[String(row.id)]?.tripType : "";
              // Blank TripType counts as Round Trip here, not "neither" -
              // office-vehicle duties (e.g. "Party") never ask Round Trip
              // vs Daily Shuttle, so TripType is "" for them (see the
              // DutyRow comment on TripType), and the server's own EndCamp
              // permanent-lock gate already treats "not Daily Shuttle" as
              // Round Trip for exactly that reason (isRoundTrip in
              // OnDutyController.cs). Requiring !!tripType here meant a
              // blank-TripType duty fell through to the plain "stops
              // tracking for today's camp" copy - implying a reversible,
              // single-day action - while the server was about to
              // permanently lock the whole duty underneath it. Matching
              // the server's proxy keeps the dialog from understating what
              // Yes is about to do.
              const isRoundTrip = !isStart
                && (tripType || "").toLowerCase() !== "daily shuttle";
              const ready = campConfirm.secondsLeft <= 0;
              // Only worth computing for the case it was built for: ending a
              // Round Trip early. Starting, or ending a Daily Shuttle's own
              // single day, has nothing "still pending" to warn about.
              const pendingDays = !isStart && isRoundTrip && row ? pendingOnDutyDays(row) : [];
              // Ending a Round Trip is a permanent, whole-duty lock (see
              // isRoundTrip's copy above) - if the duty's own approved
              // DateTo hasn't arrived yet, tapping End Camp today closes
              // and locks the whole thing before its scheduled finish, not
              // just before "all days reported" (pendingDays already
              // covers that separately). Surfacing this explicitly stops
              // an early tap from silently pre-closing a trip that still
              // has scheduled days left on it.
              const todayStart = nowIST().startOf("day");
              const dateToStart = row?.DateTo ? moment(row.DateTo).startOf("day") : null;
              const endsBeforeScheduledDate =
                !isStart && isRoundTrip && !!dateToStart && dateToStart.isValid() && todayStart.isBefore(dateToStart);
              // Ending camp always checks the actual odometer trail, not
              // just whether readings exist - Public Transport never
              // records readings at all (it only ever asks for Distance),
              // so it's excluded outright. For everyone else, "start
              // reading" is the very first day's Reading From and "end
              // reading" is the most recent day's Reading To (falling back
              // to that day's own Reading From if its closing reading was
              // never uploaded) - same reading on both ends means either
              // nothing actually moved or the closing figure is still just
              // the mirrored placeholder Reading To defaults to (see
              // updateTripDay), not a real recorded value. Shown here, and
              // blocked on, before Yes can be tapped - not after.
              const endCampIsPublicTransport = row?.Mode_of_Trans === "PublicTransport";
              const endCampTrips = row ? (tripDaysByDuty[row.id] || []) : [];
              const endCampSortedTrips = [...endCampTrips].sort((a, b) =>
                String(a.dutyDate).localeCompare(String(b.dutyDate))
              );
              const endCampFirstTrip = endCampSortedTrips[0];
              const endCampLastTrip = endCampSortedTrips[endCampSortedTrips.length - 1];
              const endCampReadingFrom = endCampFirstTrip?.readingFrom || "";
              const endCampReadingTo = endCampLastTrip?.readingTo || endCampLastTrip?.readingFrom || "";
              const endCampHasBothReadings = endCampReadingFrom !== "" && endCampReadingTo !== "";
              const endCampReadingsSame =
                endCampHasBothReadings &&
                !Number.isNaN(Number(endCampReadingFrom)) &&
                Number(endCampReadingFrom) === Number(endCampReadingTo);
              const endCampBlockOnSameReading =
                !isStart && !endCampIsPublicTransport && endCampReadingsSame;
              return (
                <div className="camp-confirm-body">
                  <div className="camp-confirm-title">
                    {isStart ? "Start Camp?" : "End Camp?"}
                  </div>
                  <div className="camp-confirm-text">
                    {isStart
                      ? "This switches on live location tracking for this employee for the duration of the camp."
                      : isRoundTrip
                        ? "This stops live location tracking and closes this duty for good – no more visits, reading uploads, or team changes afterwards. It cannot be undone."
                        : "This stops live location tracking for today's camp."}
                  </div>
                  {!!row && (
                    <div className="camp-confirm-sub">
                      #{row.id} – {row.OnDutyType || "Duty"}
                      {row.Branch ? ` – ${row.Branch}` : ""}
                    </div>
                  )}
                  {endsBeforeScheduledDate && (
                    <div className="camp-confirm-warn">
                      This duty is scheduled to run through {dateToStart.format("DD-MM-YYYY")}, but today is{" "}
                      {todayStart.format("DD-MM-YYYY")}. Ending now closes and permanently locks the whole duty
                      before its scheduled end date.
                    </div>
                  )}
                  {pendingDays.length > 0 && (
                    <div className="camp-confirm-warn">
                      Still no reading logged for {pendingDays.length === 1 ? "this day" : "these days"}{" "}
                      within the approved period: {pendingDays.join(", ")}. Ending now leaves{" "}
                      {pendingDays.length === 1 ? "it" : "them"} unreported.
                    </div>
                  )}
                  {!isStart && !endCampIsPublicTransport && endCampHasBothReadings && (
                    <div className="camp-confirm-sub">
                      Reading: {endCampReadingFrom} &rarr; {endCampReadingTo}
                    </div>
                  )}
                  {endCampBlockOnSameReading && (
                    <div className="camp-confirm-warn">
                      Start and end reading are both {endCampReadingFrom} - no distance recorded. Please
                      re-check and upload the actual closing reading before ending camp.
                    </div>
                  )}
                  <div className="camp-confirm-actions">
                    <button type="button" className="camp-confirm-no" onClick={closeCampConfirm}>
                      No
                    </button>
                    <button
                      type="button"
                      className="camp-confirm-yes"
                      disabled={!ready || endCampBlockOnSameReading}
                      onClick={confirmCampAction}
                    >
                      {ready ? "Yes" : `Yes (${campConfirm.secondsLeft})`}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </IonModal>
        <IonModal
          isOpen={dayTripCampConfirm.open}
          onDidDismiss={() =>
            setDayTripCampConfirm({ open: false, kind: null, isRoundTrip: false, secondsLeft: 5, readingFrom: "", readingTo: "" })
          }
          className="camp-confirm-modal"
        >
          <div className="camp-confirm-wrapper">
            {(() => {
              const ready = dayTripCampConfirm.secondsLeft <= 0;
              const kind = dayTripCampConfirm.kind;
              const isRT = dayTripCampConfirm.isRoundTrip;
              const dtReadingFrom = dayTripCampConfirm.readingFrom;
              const dtReadingTo = dayTripCampConfirm.readingTo;
              // "end"/"both" is exactly the case that closes (and, for a
              // same-day Round Trip, permanently locks) the camp off this
              // reading upload - Public Transport never reaches this dialog
              // at all (isVehicleDuty excludes it in saveDayTripModal), so
              // no separate check is needed for that here. Showing the
              // actual readings, and refusing to proceed when they're
              // identical, catches the exact failure mode this whole
              // feature exists to prevent: a closing reading that was never
              // really re-entered (Reading To just mirrors Reading From as
              // a form default - see updateTripDay) silently ending and
              // locking a trip with 0 Kms recorded.
              const dtInvolvesEnd = kind === "end" || kind === "both";
              const dtHasBothReadings = dtReadingFrom !== "" && dtReadingTo !== "";
              const dtReadingsSame =
                dtHasBothReadings &&
                !Number.isNaN(Number(dtReadingFrom)) &&
                Number(dtReadingFrom) === Number(dtReadingTo);
              const dtBlockOnSameReading = dtInvolvesEnd && dtReadingsSame;
              // Round Trip reaches "start" for the trip-opening reading, and
              // now also "end"/"both" for a SAME-DAY Round Trip's closing
              // reading (see isSameDayRoundTrip in saveDayTripModal) - a
              // multi-day Round Trip still only ever ends from the explicit
              // End Camp button, so it never reaches "end"/"both" here.
              // Round Trip's end is a permanent, whole-duty lock (no more
              // visits, reading uploads, or team changes), unlike Daily
              // Shuttle's end which only closes that one day - the copy
              // below says so explicitly rather than implying it is
              // reversible the way "today's camp" would.
              const title =
                kind === "end"
                  ? (isRT ? "End this trip's camp?" : "End today's camp?")
                  : kind === "both"
                    ? (isRT ? "Start and permanently end this trip's camp?" : "Start and end today's camp?")
                    : isRT
                      ? "Start this trip's camp?"
                      : "Start today's camp?";
              const text =
                kind === "end"
                  ? (isRT
                      ? "This closing reading will permanently end this trip's camp and lock the duty - no more visits, reading uploads, or team changes will be possible afterwards. The photo can only be replaced within 5 minutes of uploading it."
                      : "This closing reading will end today's camp and stop live location tracking for it. The photo can only be replaced within 5 minutes of uploading it.")
                  : kind === "both"
                    ? (isRT
                        ? "These readings will start this trip's camp and immediately end it again, since the trip is scheduled for a single day - the duty will be permanently locked afterwards: no more visits, reading uploads, or team changes."
                        : "These readings will both start and end today's camp in one save.")
                    : isRT
                      ? "This opening reading will start the camp for this whole trip and switch on live location tracking for it. Later days' readings will not ask again. The photo can only be replaced within 5 minutes of uploading it."
                      : "This opening reading will start today's camp and switch on live location tracking for it. The photo can only be replaced within 5 minutes of uploading it.";
              return (
                <div className="camp-confirm-body">
                  <div className="camp-confirm-title">{title}</div>
                  <div className="camp-confirm-text">{text}</div>
                  {dtInvolvesEnd && dtHasBothReadings && (
                    <div className="camp-confirm-sub">
                      Reading: {dtReadingFrom} &rarr; {dtReadingTo}
                    </div>
                  )}
                  {dtBlockOnSameReading && (
                    <div className="camp-confirm-warn">
                      Start and end reading are both {dtReadingFrom} - no distance recorded. Please re-check
                      and upload the actual closing reading before {isRT ? "ending and permanently locking this trip" : "ending today's camp"}.
                    </div>
                  )}
                  <div className="camp-confirm-actions">
                    <button
                      type="button"
                      className="camp-confirm-no"
                      onClick={() =>
                        setDayTripCampConfirm({ open: false, kind: null, isRoundTrip: false, secondsLeft: 5, readingFrom: "", readingTo: "" })
                      }
                    >
                      No
                    </button>
                    <button
                      type="button"
                      className="camp-confirm-yes"
                      disabled={!ready || dtBlockOnSameReading}
                      onClick={() => {
                        setDayTripCampConfirm({ open: false, kind: null, isRoundTrip: false, secondsLeft: 5, readingFrom: "", readingTo: "" });
                        saveDayTripModal(true);
                      }}
                    >
                      {ready ? "Yes" : `Yes (${dayTripCampConfirm.secondsLeft})`}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </IonModal>
        <IonModal
          isOpen={readingUploadConfirm.open}
          onDidDismiss={closeReadingUploadConfirm}
          className="camp-confirm-modal"
        >
          <div className="camp-confirm-wrapper">
            {(() => {
              const ready = readingUploadConfirm.secondsLeft <= 0;
              return (
                <div className="camp-confirm-body">
                  <div className="camp-confirm-title">{readingUploadConfirm.title}</div>
                  <div className="camp-confirm-text">{readingUploadConfirm.text}</div>
                  <div className="camp-confirm-actions">
                    <button type="button" className="camp-confirm-no" onClick={closeReadingUploadConfirm}>
                      No
                    </button>
                    <button
                      type="button"
                      className="camp-confirm-yes"
                      disabled={!ready}
                      onClick={confirmReadingUploadAction}
                    >
                      {ready ? "Yes" : `Yes (${readingUploadConfirm.secondsLeft})`}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
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