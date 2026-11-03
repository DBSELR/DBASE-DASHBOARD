import React, { useEffect, useMemo, useState } from "react";
import {
  IonContent,
  IonHeader,
  IonLoading,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButton,
  IonItem,
  IonLabel,
  IonInput,
  IonPopover,
  IonDatetime,
  IonIcon
} from "@ionic/react";
import { calendarOutline, documentTextOutline, searchOutline } from "ionicons/icons";
import {
  Briefcase,
  ChevronLeft,
  Phone,
  CheckCircle2,
  BookOpen,
  Calendar,
  Check,
  Save,
  X,
  Search,
  ChevronDown,
  Building2,
  Clock,
  MapPin,
  User,
  Plus,
  Edit3,
  Lock,
  UserCheck
} from "lucide-react";
import { createPortal } from "react-dom";
import { useHistory } from "react-router-dom";
import "../../WorkReports.css";
import "../../Stock.css";
import "./VisitTickets.css";
import moment from "moment";
import { API_BASE } from "../../../config";

interface Ticket {
  ticketId: string;
  projectClient: string;
  mobileNo: string;
  date: string;
  remarks: string;
}

interface VisitTicket {
  duty_Date: string;
  client_Name: string;
  location: string;
  visit_FromTime: string;
  visit_ToTime: string;
  projects: string;
  contact_Person: string;
  mobile_Number: string;
  remarks: string;
  employees: string;
  visit_ID?: string | number;
  Visit_ID?: string | number;
  visitId?: string | number;
  id?: string | number;
  feedback_ID?: number | null;
  Feedback_ID?: number | null;
  coursesList?: string | null;
  CoursesList?: string | null;
  count01?: number | string | null;
  Count01?: number | string | null;
  eventRequirements?: string | null;
  EventRequirements?: string | null;
  eventDate?: string | null;
  EventDate?: string | null;
  eventToDate?: string | null;
  EventToDate?: string | null;
  count02?: number | string | null;
  Count02?: number | string | null;
  clientRemarks?: string | null;
  ClientRemarks?: string | null;
  nextFollowupDate?: string | null;
  NextFollowupDate?: string | null;
  [key: string]: any;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface CourseItem {
  name: string;
  duration: string;
}

interface CourseCategory {
  category: string;
  courses: CourseItem[];
}

// ── Complete Catalog of Courses Offered from SkillAscent Image ──
const COURSES_CATALOG: CourseCategory[] = [
  {
    category: "IT Courses",
    courses: [
      { name: "Data Science", duration: "120Days" },
      { name: "Data Analytics", duration: "45Days" },
      { name: "Devops with AWS", duration: "50Days" },
      { name: "Cyber Security", duration: "90Days" },
      { name: "Python Full Stack Development", duration: "90Days" },
      { name: "Java Full Stack Development", duration: "90Days" },
      { name: "Artificial Intelligence & Machine Learning", duration: "90Days" },
      { name: "MERN Stack Development", duration: "120Days" },
      { name: "Power BI with advanced Excel", duration: "90Days" },
      { name: "Internet of Things", duration: "90Days" },
      { name: "Robotics", duration: "90Days" },
    ],
  },
  {
    category: "Civil Courses",
    courses: [
      { name: "AutoCAD", duration: "45Days" },
      { name: "Revit Arctecture", duration: "45Days" },
      { name: "Sketch up", duration: "45Days" },
    ],
  },
  {
    category: "Electronics & Communication Engineering-ECE Courses",
    courses: [
      { name: "VLSI", duration: "45Days" },
      { name: "Embedded systems", duration: "45Days" },
    ],
  },
  {
    category: "Mechanical Courses",
    courses: [
      { name: "AutoCAD", duration: "45Days" },
      { name: "Catia", duration: "45Days" },
      { name: "Solid works", duration: "30Days" },
      { name: "Ansys", duration: "45Days" },
      { name: "3d printing", duration: "45Days" },
    ],
  },
  {
    category: "Agriculture Courses",
    courses: [
      { name: "Organic Farming", duration: "45Days" },
      { name: "Mushroom Cultivation", duration: "45Days" },
      { name: "Bee Keeping", duration: "45Days" },
      { name: "Terrace Gardening", duration: "45Days" },
      { name: "Drip Irrigation", duration: "45Days" },
      { name: "Vermi composting", duration: "45Days" },
      { name: "Millets Production", duration: "45Days" },
      { name: "Biofertilizers", duration: "45Days" },
      { name: "Pest Management", duration: "45Days" },
      { name: "Polyhouse Farming", duration: "45Days" },
      { name: "Seed Technology", duration: "45Days" },
      { name: "Drones in Indian agriculture", duration: "45Days" },
    ],
  },
  {
    category: "Creative, Business & Digital Courses",
    courses: [
      { name: "Digital Marketing", duration: "90Days" },
      { name: "Graphic Designing", duration: "45Days" },
      { name: "Video Editing", duration: "45Days" },
      { name: "Accounts and Tally", duration: "30Days" },
    ],
  },
  {
    category: "Healthcare Courses",
    courses: [
      { name: "Medical coding", duration: "45Days" },
    ],
  },
];

const EVENT_REQUIREMENTS_LIST = [
  "Orientation",
  "Seminar",
  "Workshop",
  "Hackathon",
  "Hands-on Training",
  "Guest Lecture",
  "Bootcamp",
  "Internship Drive",
  "Webinar",
  "Student Interaction",
];

// What is asked for against ONE course on a visit. A college can want 30
// students on Data Science in January and 15 on AutoCAD in March, which a
// single set of figures per visit could not express.
interface CourseFeedbackData {
  count1: string;
  eventRequirements: string[];
  eventDate: string;
  eventToDate: string;
}

const emptyCourseFeedback = (): CourseFeedbackData => ({
  count1: "",
  eventRequirements: [],
  eventDate: "",
  eventToDate: "",
});

// A follow-up already saved against this visit. A college visited in
// January and chased again in March has two of these, each with its own
// courses - the January entry is never rewritten by the March one.
interface SavedFollowup {
  feedbackId: number;
  // When this follow-up happened - what the history is dated by.
  followupDate: string;
  // What it set going forward.
  nextFollowupDate: string;
  nextVisitDate: string;
  clientRemarks: string;
  // Who recorded it. The column was always written on insert; it was
  // simply never read back, so the history said what was agreed but
  // not who had the conversation.
  createdBy?: string;
  courses: string[];
  courseData: Record<string, CourseFeedbackData>;
}

interface VisitFeedbackRowData {
  // Follow-ups already saved, oldest first.
  followups: SavedFollowup[];

  // The follow-up currently being written. draftOpen is what the
  // "Add follow-up" button toggles; editingId is null for a new one and
  // set when an existing entry was reopened.
  draftOpen: boolean;
  editingId: number | null;

  // Selected courses, in the order they were picked.
  courses: string[];
  // Per-course detail, keyed by course name.
  courseData: Record<string, CourseFeedbackData>;
  // This follow-up's own remarks, and the dates it sets going forward.
  clientRemarks: string;
  nextFollowupDate: string;
  nextVisitDate: string;
  // Set only when an existing entry was reopened, so saving a correction
  // keeps its original date instead of jumping to today.
  followupDate?: string;
  saved?: boolean;
}

const emptyDraft = () => ({
  draftOpen: false,
  editingId: null as number | null,
  courses: [] as string[],
  courseData: {} as Record<string, CourseFeedbackData>,
  clientRemarks: "",
  nextFollowupDate: "",
  nextVisitDate: "",
  saved: false,
});

// How one course reads on a history line: the count, what was asked for
// and when, in brackets after the name - "Data Science (20 · Workshop ·
// 29/10-30/10)". Whatever is missing is simply left out rather than
// leaving an empty separator behind.
const courseSummaryLine = (name: string, cc?: CourseFeedbackData): string => {
  if (!cc) return name;
  const bits = [
    cc.count1 ? String(cc.count1) : "",
    cc.eventRequirements.length > 0 ? cc.eventRequirements.join("/") : "",
    cc.eventDate
      ? (cc.eventToDate
          ? `${moment(cc.eventDate).format("DD/MM/YY")}-${moment(cc.eventToDate).format("DD/MM/YY")}`
          : moment(cc.eventDate).format("DD/MM/YY"))
      : (cc.eventToDate ? `to ${moment(cc.eventToDate).format("DD/MM/YY")}` : ""),
  ].filter(Boolean);
  return bits.length > 0 ? `${name} (${bits.join(" · ")})` : name;
};

// Build the per-course map for one follow-up coming back from the API.
const courseDataFromRows = (rows: any[]): { courses: string[]; courseData: Record<string, CourseFeedbackData> } => {
  const courses: string[] = [];
  const courseData: Record<string, CourseFeedbackData> = {};
  (Array.isArray(rows) ? rows : []).forEach((cr: any) => {
    const name = String(cr?.CourseName ?? cr?.courseName ?? "").trim();
    if (!name) return;
    const cnt = cr.Count01 ?? cr.count01;
    const from = cr.EventDate ?? cr.eventDate;
    const to = cr.EventToDate ?? cr.eventToDate;
    courses.push(name);
    courseData[name] = {
      count1: cnt !== undefined && cnt !== null ? String(cnt) : "",
      eventRequirements: String(cr.EventRequirements ?? cr.eventRequirements ?? "")
        .split(",").map((s: string) => s.trim()).filter(Boolean),
      eventDate: from ? moment(from).format("YYYY-MM-DD") : "",
      eventToDate: to ? moment(to).format("YYYY-MM-DD") : "",
    };
  });
  return { courses, courseData };
};

// Anything cached under the old flat shape (localStorage from a previous
// build, or a server row saved before the per-course table existed) is
// read as "these figures applied to every course on the visit", which is
// exactly what they meant at the time.
const normalizeFeedbackRow = (raw: any): VisitFeedbackRowData => {
  const courses: string[] = Array.isArray(raw?.courses) ? raw.courses : [];
  const courseData: Record<string, CourseFeedbackData> = {};

  if (raw?.courseData && typeof raw.courseData === "object") {
    courses.forEach((c) => {
      const d = raw.courseData[c];
      courseData[c] = {
        count1: d?.count1 ?? "",
        eventRequirements: Array.isArray(d?.eventRequirements) ? d.eventRequirements : [],
        eventDate: d?.eventDate ?? "",
        eventToDate: d?.eventToDate ?? "",
      };
    });
  } else {
    courses.forEach((c) => {
      courseData[c] = {
        count1: raw?.count1 ?? "",
        eventRequirements: Array.isArray(raw?.eventRequirements) ? raw.eventRequirements : [],
        eventDate: raw?.eventDate ?? "",
        eventToDate: raw?.eventToDate ?? "",
      };
    });
  }

  return {
    followups: Array.isArray(raw?.followups) ? raw.followups : [],
    draftOpen: Boolean(raw?.draftOpen),
    editingId: typeof raw?.editingId === "number" ? raw.editingId : null,
    courses,
    courseData,
    clientRemarks: raw?.clientRemarks ?? "",
    nextFollowupDate: raw?.nextFollowupDate ?? "",
    nextVisitDate: raw?.nextVisitDate ?? "",
    saved: Boolean(raw?.saved),
  };
};

type VisitTicketsProps = {
  // Show only one of the two feeds, and drop the tab strip with it.
  // Client Feedback passes "tickets"; the Visits Feedback tab on the
  // Visits Follow-up page passes "visits".
  only?: "tickets" | "visits";
  // Render without the IonPage/IonContent/page-header shell, for use
  // inside another page that already provides one.
  embedded?: boolean;
};

const VisitTickets: React.FC<VisitTicketsProps> = ({ only, embedded }) => {
  const history = useHistory();

  // The logged-in employee. Only the current follow-up owner may hand a
  // visit on, so the chips need to know who is looking at them.
  const currentEmpCode = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        return String(
          u.empCode || u.EmpCode || u.emp_code || u.Emp_Code ||
          u.username || u.Username || u.UserId || u.userid || u.id || ""
        ).trim();
      }
    } catch (e) { /* ignore */ }
    return String(localStorage.getItem("empCode") || "").trim();
  }, []);

  // Kept in step with FollowupAdminCodes on the server - that is the copy
  // that actually enforces anything; this one only decides what the screen
  // offers.
  const FOLLOWUP_ADMINS = ["1501"];
  const isFollowupAdmin = FOLLOWUP_ADMINS.includes(currentEmpCode);

  // Who may record a feedback call. Everyone else reads the list and
  // sees what was said; they just cannot put words in the party's
  // mouth.
  //
  // This is the screen being honest about what it offers, not a
  // security control - the browser can be told anything. If it has to
  // hold, Save_Visit_FeedbackCall needs the same list server-side,
  // the way FollowupAdminCodes backs the check above.
  const FEEDBACK_POSTERS = ["1501", "1508"];
  const canPostFeedback = FEEDBACK_POSTERS.includes(currentEmpCode);
  const [tickets, setTickets] = useState<VisitTicket[]>(() => {
    try {
      const cached = sessionStorage.getItem("visit_tickets_onduty_cache");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const today = moment().format("YYYY-MM-DD");
  const defaultFromDate = useMemo(() => moment().startOf("month").format("YYYY-MM-DD"), []);
  const defaultToDate = useMemo(() => moment().endOf("month").format("YYYY-MM-DD"), []);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [activeTab, setActiveTab] = useState<"tickets" | "visits">(() => {
    if (only) return only;
    try {
      const savedTab = sessionStorage.getItem("visit_tickets_active_tab");
      return (savedTab === "tickets" || savedTab === "visits") ? savedTab : "visits";
    } catch {
      return "visits";
    }
  });
  const [ticketList, setTicketList] = useState<Ticket[]>(() => {
    try {
      const cached = sessionStorage.getItem("visit_tickets_closed_cache");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // Projects dropdown state (form selection vs applied)
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("0");
  const [appliedProjectId, setAppliedProjectId] = useState<string>("0");

  // Applied date filters
  const [appliedFromDate, setAppliedFromDate] = useState<string>("");
  const [appliedToDate, setAppliedToDate] = useState<string>("");

  // Client Search state
  const [clientSearch, setClientSearch] = useState("");

  // View Mode state (Grid Cards / Table / grouped By Party)
  // Two jobs, each with its own states.
  //
  //   Feedback    Pending  - nobody has rung this party back
  //               Completed- somebody has, and what they said
  //
  //   Followups   Pending  - an owner was set, nothing recorded yet
  //               Handling - at least one follow-up recorded
  //               Left     - decided not worth chasing. Stored, not
  //                          inferred: an abandoned visit and a forgotten
  //                          one look identical in the data.
  //
  // Cards, Table and By Party were three ways of re-reading one list and
  // none of them was a job anyone came here to do.
  const [section, setSection] = useState<"feedback" | "followups">("feedback");
  const [fbTab, setFbTab] = useState<"pending" | "done">("pending");
  const [fuTab, setFuTab] = useState<"pending" | "handling" | "left">("pending");

  // Which way a college's timeline runs. Newest first by default: the
  // current state of a party is what you open it for, the history is
  // what you scroll to. Per college, because it is a property of the
  // timeline you are reading, not of the page.
  //
  // The colleges themselves are always ordered by their most recent
  // visit - "A-Z" over a list you have already narrowed with a search
  // was a sort nobody reached for.
  const [ctSort, setCtSort] = useState<Record<string, "desc" | "asc">>({});

  // Which college's Assign list is open, and where on screen to draw it.
  //
  // The list is positioned in page coordinates and rendered fixed,
  // because inside the card it was being clipped by an ancestor - on
  // the last college in the list you could see the first row of names
  // and nothing else. Fixed also means it flips above the button when
  // there is no room below.
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [assignAt, setAssignAt] = useState<{ top?: number; bottom?: number; right: number }>({
    top: 0,
    right: 0,
  });

  const openAssignAt = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const room = window.innerHeight - r.bottom;
    const right = Math.max(8, window.innerWidth - r.right);
    setAssignAt(
      room < 280 && r.top > room
        ? { bottom: window.innerHeight - r.top + 6, right }
        : { top: r.bottom + 6, right }
    );
  };

  // Click anywhere else, or press Escape, and it closes.
  //
  // The listener ignores anything inside .assign-wrap, which is what
  // lets the options still be clicked: mousedown runs before click, so
  // closing on every mousedown would unmount the row before the click
  // could land on it - the same way an eager blur breaks the search
  // dropdown.
  useEffect(() => {
    if (!assignFor) return;

    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      // .assign-pop as well as .assign-wrap: the list is portalled into
      // <body>, so it is no longer a descendant of the button. Without
      // this, mousedown on a name closed the list and unmounted the row
      // before the click could land on it - the control would look dead.
      if (
        el &&
        typeof el.closest === "function" &&
        (el.closest(".assign-wrap") || el.closest(".assign-pop"))
      ) {
        return;
      }
      setAssignFor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAssignFor(null);
    };

    // Positioned once, in page coordinates: if the page scrolls it no
    // longer points at its button, so it closes rather than floating.
    const onScroll = () => setAssignFor(null);

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [assignFor]);

  // The search box also offers the colleges it could match. Typing
  // still filters on everything - contact, location, remarks - but
  // picking a name from the list is exact, which is what people
  // actually want when they know which college they are after.
  const [searchOpen, setSearchOpen] = useState(false);

  // Who went is a question you ask occasionally; the remark is one you
  // read every time. So the employee pills are off until the "people who
  // visited" count in the college header is clicked - that number is
  // what they are the detail of.
  const [showVisitors, setShowVisitors] = useState<Record<string, boolean>>({});

  // Each number in a college header is a way into what it counts: visits
  // narrows the timeline to the visits, the book icon to the follow-ups,
  // the contact icon lists the people met. Clicking the active one puts
  // the whole timeline back.
  const [ctView, setCtView] = useState<Record<string, "all" | "visits" | "followups" | "contacts">>({});

  const setCollegeView = (client: string, view: "visits" | "followups" | "contacts") =>
    setCtView((p) => ({ ...p, [client]: p[client] === view ? "all" : view }));

  // The card body still gates on viewMode: "pending" shows the call and
  // hides the follow-up machinery, "followups" the reverse. That is
  // exactly the Feedback/Followups split, so it is derived rather than
  // tracked twice and left to drift.
  const viewMode: "pending" | "followups" =
    section === "feedback" ? "pending" : "followups";

  // Visits marked Left in this session, so a card moves without waiting
  // for a reload. null means it was put back.
  const [leftSaved, setLeftSaved] = useState<Record<string, string | null>>({});
  // The reason being typed. Open with an empty string, which is why this
  // is keyed presence rather than truthiness.
  const [leftDraft, setLeftDraft] = useState<Record<string, string>>({});
  const [leftSaving, setLeftSaving] = useState<Record<string, boolean>>({});
  const [leftError, setLeftError] = useState<Record<string, string>>({});

  // Party history: which client is open, and what came back for it.
  // Fetched per party on demand and NOT date filtered - the list above is
  // a window on a month or two, a party's history is the whole point.
  const [openParty, setOpenParty] = useState<string | null>(null);
  const [partyHistory, setPartyHistory] = useState<Record<string, any[]>>({});
  const [partyLoading, setPartyLoading] = useState<Record<string, boolean>>({});

  // Feedback State per visit row (persisted in localStorage)
  const [feedbackStore, setFeedbackStore] = useState<Record<string, VisitFeedbackRowData>>(() => {
    try {
      // Retire anything written under an older shape rather than letting
      // it linger half-readable.
      try { localStorage.removeItem("visits_feedback_store"); } catch {}
      const saved = localStorage.getItem("visits_feedback_store_v2");
      const parsed = saved ? JSON.parse(saved) : {};
      const out: Record<string, VisitFeedbackRowData> = {};
      Object.keys(parsed || {}).forEach((k) => { out[k] = normalizeFeedbackRow(parsed[k]); });
      return out;
    } catch {
      return {};
    }
  });

  // Modal dialog state for selecting Courses
  const [coursesModal, setCoursesModal] = useState<{
    open: boolean;
    visitKey: string;
    clientName: string;
  } | null>(null);

  // Modal dialog state for selecting Event Requirements
  const [eventsModal, setEventsModal] = useState<{
    open: boolean;
    visitKey: string;
    courseName: string;
    clientName: string;
  } | null>(null);

  // Modal dialog state for selecting Event Dates (From Date & To Date)
  const [eventDateModal, setEventDateModal] = useState<{
    open: boolean;
    visitKey: string;
    courseName: string;
    clientName: string;
  } | null>(null);

  const [courseSearch, setCourseSearch] = useState("");
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});
  // Why a save was refused, per row - e.g. an edit to a follow-up that
  // closed at the end of the day it was recorded.
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  // Which cards have their feedback box open. Closed by default: the list
  // is usually scanned, and only some rows are worked on.
  const [openFeedback, setOpenFeedback] = useState<Record<string, boolean>>({});

  // FollowUp_By per visit, keyed by Visit_ID. Seeded from the feed and
  // updated on click so the chip responds without a reload.
  const [followupBy, setFollowupBy] = useState<Record<string, string>>({});
  const [followupBySaving, setFollowupBySaving] = useState<Record<string, boolean>>({});
  const [followupByError, setFollowupByError] = useState<Record<string, string>>({});

  // Why the visit feed came back empty. A failed load and a genuinely
  // empty range used to look identical on screen, which is a bad way to
  // find out the API is erroring.
  const [loadError, setLoadError] = useState<string>("");

  // The feedback CALL being recorded, keyed by Visit_ID. A visit has one
  // call; follow-ups are the separate thing kept in feedbackStore.
  const [callDraft, setCallDraft] = useState<Record<string, { on: string; remarks: string }>>({});
  const [callSaving, setCallSaving] = useState<Record<string, boolean>>({});
  const [callError, setCallError] = useState<Record<string, string>>({});
  // Saved calls the server has confirmed this session, so a card updates
  // without waiting for a reload.
  const [callSaved, setCallSaved] = useState<Record<string, { on: string; by: string; remarks: string }>>({});

  /** Local datetime in the shape <input type="datetime-local"> wants. */
  const nowForInput = () => moment().format("YYYY-MM-DDTHH:mm");

  const openCallDraft = (visitId: number, existing?: string, remarks?: string) =>
    setCallDraft((p) => ({
      ...p,
      [String(visitId)]: {
        on: existing ? moment(existing).format("YYYY-MM-DDTHH:mm") : nowForInput(),
        remarks: remarks || "",
      },
    }));

  /** Feedback Pending types straight into one line - no accordion, no
   *  datetime picker. The call happened when it was typed, so saving
   *  stamps the moment rather than asking for it. */
  const setCallRemarks = (visitId: number, text: string) =>
    setCallDraft((p) => ({
      ...p,
      [String(visitId)]: { on: p[String(visitId)]?.on || "", remarks: text },
    }));

  const closeCallDraft = (visitId: number) =>
    setCallDraft((p) => {
      const next = { ...p };
      delete next[String(visitId)];
      return next;
    });

  const saveFeedbackCall = async (visitId: number, clear = false) => {
    const key = String(visitId);
    if (!canPostFeedback) {
      setCallError((p) => ({ ...p, [key]: "Only 1501 and 1508 can record a feedback call." }));
      return;
    }
    const draft = callDraft[key];
    if (!clear && !draft) return;
    // Typed inline, with no datetime field: the call is being recorded as
    // it happens, so now is the honest timestamp.
    const callOn = draft?.on || nowForInput();

    setCallSaving((p) => ({ ...p, [key]: true }));
    setCallError((p) => ({ ...p, [key]: "" }));

    try {
      const res = await fetchWithTimeout(
        `${API_BASE}Tickets/Save_Visit_FeedbackCall`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            Visit_ID: visitId,
            CallOn: clear ? null : callOn,
            CallBy: currentEmpCode,
            Remarks: clear ? "" : draft.remarks,
          }),
        },
        10000
      );
      const body = await res.json();

      if (!res.ok || body?.success === false) {
        setCallError((p) => ({ ...p, [key]: body?.message || "Could not save the feedback call" }));
        return;
      }

      if (clear) {
        setCallSaved((p) => {
          const next = { ...p };
          delete next[key];
          return next;
        });
      } else {
        setCallSaved((p) => ({
          ...p,
          [key]: {
            on: body?.Feedback_CallOn || callOn,
            by: body?.Feedback_CallBy || currentEmpCode,
            remarks: draft.remarks,
          },
        }));
      }
      closeCallDraft(visitId);
    } catch (err: any) {
      setCallError((p) => ({ ...p, [key]: err?.message || "Could not reach the server" }));
    } finally {
      setCallSaving((p) => ({ ...p, [key]: false }));
    }
  };

  /**
   * Stop chasing a visit, or put it back. The note is optional but
   * asked for, because "not interested" and "already placed elsewhere"
   * are the same status and completely different facts, and six months
   * from now the status alone will not say which happened.
   */
  const saveFollowupStatus = async (visitId: number, leave: boolean, note?: string) => {
    const key = String(visitId);
    setLeftSaving((p) => ({ ...p, [key]: true }));
    setLeftError((p) => ({ ...p, [key]: "" }));

    try {
      const res = await fetchWithTimeout(
        `${API_BASE}Tickets/Save_Visit_FollowupStatus`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            Visit_ID: visitId,
            Leave: leave,
            Note: note || "",
            StatusBy: currentEmpCode,
          }),
        },
        10000
      );
      const body = await res.json();

      if (!res.ok || body?.success === false) {
        setLeftError((p) => ({
          ...p,
          [key]: body?.message || "Could not save the follow-up status",
        }));
        return;
      }

      setLeftSaved((p) => ({ ...p, [key]: leave ? "LEFT" : null }));
    } catch (err: any) {
      setLeftError((p) => ({ ...p, [key]: err?.message || "Could not reach the server" }));
    } finally {
      setLeftSaving((p) => ({ ...p, [key]: false }));
    }
  };

  /**
   * Writing off a COLLEGE, not a visit.
   *
   * "Not needed" is a decision about the party - nobody is chasing St
   * Mary's - so it is asked once, on the college, and written to every
   * visit under it. The column lives on the visit because that is where
   * the rows are; the decision does not.
   *
   * Sequential on purpose. Thirteen parallel writes to thirteen rows of
   * one table is how you get deadlocks for no gain, and if one fails
   * half way the ones already done are still correct and visible.
   */
  const saveGroupFollowupStatus = async (
    client: string,
    visits: VisitTicket[],
    leave: boolean,
    note?: string
  ) => {
    const gKey = `grp:${client}`;
    setLeftSaving((p) => ({ ...p, [gKey]: true }));
    setLeftError((p) => ({ ...p, [gKey]: "" }));

    let failed = "";
    for (const v of visits) {
      const vId = Number((v as any)?.visit_ID ?? (v as any)?.Visit_ID ?? 0);
      if (!vId) continue;
      try {
        const res = await fetchWithTimeout(
          `${API_BASE}Tickets/Save_Visit_FollowupStatus`,
          {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({
              Visit_ID: vId,
              Leave: leave,
              Note: note || "",
              StatusBy: currentEmpCode,
            }),
          },
          10000
        );
        const body = await res.json();
        if (!res.ok || body?.success === false) {
          failed = body?.message || "Could not save the follow-up status";
          break;
        }
        setLeftSaved((p) => ({ ...p, [String(vId)]: leave ? "LEFT" : null }));
      } catch (err: any) {
        failed = err?.message || "Could not reach the server";
        break;
      }
    }

    if (failed) setLeftError((p) => ({ ...p, [gKey]: failed }));
    setLeftSaving((p) => ({ ...p, [gKey]: false }));
  };

  /** What was recorded when a visit was written off, if anything. */
  const leftDetailOf = (v: any) => {
    const vid = String(v?.visit_ID ?? v?.Visit_ID ?? 0);
    if (leftSaved[vid] === "LEFT") {
      return { by: currentEmpCode, on: "", note: "" };
    }
    if (String(v?.FollowUp_Status ?? v?.followUp_Status ?? "").toUpperCase() !== "LEFT") {
      return null;
    }
    return {
      by: String(v?.FollowUp_StatusBy ?? v?.followUp_StatusBy ?? ""),
      on: String(v?.FollowUp_StatusOn ?? v?.followUp_StatusOn ?? ""),
      note: String(v?.FollowUp_StatusNote ?? v?.followUp_StatusNote ?? ""),
    };
  };

  /** The call on a visit: what the server sent, or what we just saved. */
  const feedbackCallOf = (v: any) => {
    const key = String(v?.visit_ID ?? v?.Visit_ID ?? 0);
    if (callSaved[key]) return callSaved[key];
    const on = v?.Feedback_CallOn ?? v?.feedback_CallOn;
    if (!on) return null;
    return {
      on,
      by: String(v?.Feedback_CallBy ?? v?.feedback_CallBy ?? ""),
      remarks: String(v?.Feedback_Remarks ?? v?.feedback_Remarks ?? ""),
    };
  };

  const toggleFeedbackBox = (visitKey: string) =>
    setOpenFeedback((p) => ({ ...p, [visitKey]: !p[visitKey] }));

  const getHeaders = (isGet = false) => {
    const token = localStorage.getItem("token")?.replace(/"/g, "");
    const headers: any = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    if (!isGet) {
      headers["Content-Type"] = "application/json";
    }

    return headers;
  };

  const handleResponse = async (res: Response) => {
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(errorText || `API Error: ${res.status}`);
    }

    const text = await res.text().catch(() => "");
    if (!text) return [];

    try {
      const json = JSON.parse(text);
      if (typeof json === "string") {
        return JSON.parse(json);
      }
      return Array.isArray(json) ? json : [];
    } catch {
      return [];
    }
  };

  const mapTicketRow = (r: any): Ticket => {
    const ticketId = String(
      r?.TicketID ?? r?.TICKETID ?? r?.ticketId ?? r?.[1] ?? ""
    );

    const client = String(
      r?.Client ?? r?.CLIENT ?? r?.Client_Name ?? r?.[2] ?? r?.[28] ?? ""
    );

    const project = String(
      r?.Project ?? r?.PROJECT ?? r?.[3] ?? ""
    );

    const projectClient = [client, project].filter(Boolean).join(" - ");

    const mobileNo = String(
      r?.Client_MobileNo ?? r?.ClientMobileNo ?? r?.[6] ?? ""
    );

    const date = String(
      r?.TDate ?? r?.TDATE ?? r?.CreatedDate ?? r?.[8] ?? r?.[7] ?? ""
    );

    const remarks = String(
      r?.Remarks ??
        r?.REMARKS ??
        r?.TaskRemark ??
        r?.[29] ??
        r?.[9] ??
        ""
    );

    return {
      ticketId,
      projectClient,
      mobileNo,
      date,
      remarks,
    };
  };

  // Load Projects Master list for dropdown
  const loadProjectsList = async () => {
    const url = `${API_BASE}Sources/Load_ProjectMaster`;
    const headers = getHeaders(true);
    console.log("%c[VisitTickets] loadProjectsList START", "color: #8b5cf6; font-weight: bold;", {
      url,
      endpoint: "Sources/Load_ProjectMaster",
      headers,
    });

    try {
      const res = await fetch(url, { headers });
      console.log("[VisitTickets] loadProjectsList Response Status:", {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
      });

      const raw = await res.json();
      console.log("[VisitTickets] loadProjectsList RAW Payload Received:", raw);

      if (Array.isArray(raw)) {
        const mapped: ProjectOption[] = raw
          .map((p: any) => ({
            id: String(p[0] ?? p.P_ID ?? p.id ?? "").trim(),
            name: String(p[1] ?? p.Project ?? p.name ?? "").trim(),
          }))
          .filter((p) => p.id && p.name);

        console.log(`[VisitTickets] loadProjectsList Processed ${mapped.length} projects successfully:`, mapped);
        setProjects(mapped);
      } else {
        console.warn("[VisitTickets] loadProjectsList response is not an array:", raw);
      }
    } catch (err) {
      console.error("[VisitTickets] loadProjectsList ERROR:", err);
    }
  };

  // Helper to fetch with a fast timeout (avoids 30s hangs on down/slow endpoints)
  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 4500) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  const parseItemDate = (rawDate: any): moment.Moment | null => {
    if (!rawDate) return null;
    const str = String(rawDate).trim();
    if (!str || str === "-" || str.toLowerCase() === "null" || str.toLowerCase() === "undefined") return null;

    // Check comprehensive date & time formats
    const formats = [
      "DD-MM-YYYY hh:mm:ss A",
      "DD-MM-YYYY hh:mm A",
      "DD-MM-YYYY HH:mm:ss",
      "DD-MM-YYYY HH:mm",
      "DD/MM/YYYY hh:mm:ss A",
      "DD/MM/YYYY hh:mm A",
      "DD/MM/YYYY HH:mm:ss",
      "DD/MM/YYYY HH:mm",
      "YYYY-MM-DDTHH:mm:ss",
      "YYYY-MM-DD HH:mm:ss",
      "YYYY-MM-DD",
      "DD-MM-YYYY",
      "DD/MM/YYYY",
      "MM-DD-YYYY hh:mm:ss A",
      "MM-DD-YYYY hh:mm A",
      "MM-DD-YYYY HH:mm:ss",
      "MM-DD-YYYY HH:mm",
      "MM/DD/YYYY hh:mm:ss A",
      "MM/DD/YYYY hh:mm A",
      "MM/DD/YYYY HH:mm:ss",
      "MM/DD/YYYY HH:mm",
      "MM-DD-YYYY",
      "MM/DD/YYYY",
      "YYYY/MM/DD",
      "DD-MMM-YYYY",
      "DD MMM YYYY",
    ];

    for (const fmt of formats) {
      const fm = moment(str, fmt, true);
      if (fm.isValid() && fm.year() >= 2000 && fm.year() <= 2100) {
        return fm;
      }
    }

    // Fallback extracting date portion if formatted with spaces (e.g. "24-08-2026 03:05 PM" -> "24-08-2026")
    const datePart = str.split(" ")[0];
    if (datePart && datePart !== str) {
      const partFormats = ["DD-MM-YYYY", "DD/MM/YYYY", "YYYY-MM-DD", "MM-DD-YYYY", "MM/DD/YYYY"];
      for (const fmt of partFormats) {
        const fm = moment(datePart, fmt, true);
        if (fm.isValid() && fm.year() >= 2000 && fm.year() <= 2100) {
          return fm;
        }
      }
    }

    const fallback = moment(str);
    if (fallback.isValid() && fallback.year() >= 2000 && fallback.year() <= 2100) {
      return fallback;
    }

    return null;
  };

  // Load Closed Tickets (Tickets FeedBack tab)
  const loadClosedTickets = async (from?: string, to?: string, projId?: string) => {
    try {
      // Only show full screen loader if no cached tickets are present
      if (ticketList.length === 0) {
        setLoading(true);
      }

      const currentProjectId = projId !== undefined ? projId : selectedProjectId;
      const projectParam = currentProjectId === "ALL" ? "0" : (currentProjectId || "0");

      const activeFrom = from !== undefined && from !== null && from.trim() ? from : defaultFromDate;
      const activeTo = to !== undefined && to !== null && to.trim() ? to : defaultToDate;

      const dFrom = moment(activeFrom).format("MM-DD-YYYY");
      const dTo = moment(activeTo).format("MM-DD-YYYY");

      const headers = getHeaders(true);
      const endpointsToTry = [
        `${API_BASE}Tickets/Load_LOADSUPPORTTICKETS_DateWise_FromTo_ALL?FDate=${dFrom}&TDate=${dTo}&status=C&staus=C&ClientID=0&ProjectID=${projectParam}&EmpCode=0`,
        `${API_BASE}Tickets/Load_AllSupportTickets?Date=${dFrom}&ToDate=${dTo}&status=C&ClientID=0&ProjectID=${projectParam}`,
        `${API_BASE}Tickets/Load_LOADSUPPORTTICKETS_DateWise_FromTo?ClientID=0&ProjectID=${projectParam}&Date=${dFrom}&ToDate=${dTo}&status=C&EMPCODE=0`,
        `${API_BASE}Tickets/Load_Issues_New?ClientId=0&PT=${projectParam}&Date=${dFrom}&ToDate=${dTo}&status=C&staus=C&EMPCODE=0`,
      ];

      console.log("%c[VisitTickets] loadClosedTickets START", "color: #3b82f6; font-weight: bold;", {
        endpointsToTry,
        dFrom,
        dTo,
        activeTab: "tickets",
        selectedProjectId: currentProjectId,
      });

      let raw: any = null;
      for (const endpointUrl of endpointsToTry) {
        try {
          console.log("[VisitTickets] Trying closed tickets endpoint:", endpointUrl);
          const res = await fetchWithTimeout(endpointUrl, { headers }, 4000);
          if (res.ok) {
            raw = await handleResponse(res);
            if (Array.isArray(raw)) {
              console.log("[VisitTickets] Successfully fetched closed tickets from:", endpointUrl, "Count:", raw.length);
              break;
            }
          } else {
            console.warn("[VisitTickets] Endpoint returned non-OK status:", res.status, endpointUrl);
          }
        } catch (subErr) {
          console.warn("[VisitTickets] Fast-skipped endpoint due to timeout/error:", endpointUrl);
        }
      }

      const mapped = Array.isArray(raw) ? raw.map(mapTicketRow) : [];
      console.log("[VisitTickets] loadClosedTickets Mapped Result:", mapped);
      if (mapped.length > 0) {
        console.log("[VisitTickets] loadClosedTickets Sample Record [0]:", mapped[0]);
        try { sessionStorage.setItem("visit_tickets_closed_cache", JSON.stringify(mapped)); } catch {}
      }

      setTicketList(mapped);
    } catch (err) {
      console.error("[VisitTickets] loadClosedTickets ERROR:", err);
      if (ticketList.length === 0) setTicketList([]);
    } finally {
      setLoading(false);
    }
  };

  // Load On-Duty Visits (Visits FeedBack tab)
  const loadTickets = async (from?: string, to?: string, projId?: string) => {
    try {
      // Only show full screen loader if no cached tickets are present
      if (tickets.length === 0) {
        setLoading(true);
      }

      const currentProjectId = projId !== undefined ? projId : selectedProjectId;
      // Blank means everything. The API treats a missing date as "no
      // bound" (@fromDate IS NULL OR ...), so nothing is sent at all.
      const activeFrom = from !== undefined && from !== null && from.trim() ? from : "";
      const activeTo = to !== undefined && to !== null && to.trim() ? to : "";

      const paramsObj: Record<string, string> = {};
      if (activeFrom) {
        paramsObj["fromDate"] = moment(activeFrom).format("YYYY-MM-DD");
        paramsObj["FromDate"] = moment(activeFrom).format("YYYY-MM-DD");
      }
      if (activeTo) {
        paramsObj["toDate"] = moment(activeTo).format("YYYY-MM-DD");
        paramsObj["ToDate"] = moment(activeTo).format("YYYY-MM-DD");
      }
      if (currentProjectId && currentProjectId !== "0" && currentProjectId !== "ALL") {
        paramsObj["projectId"] = currentProjectId;
        paramsObj["ProjectID"] = currentProjectId;
      }

      const params = new URLSearchParams(paramsObj);
      const queryString = params.toString();
      const url =
        `${API_BASE}Tickets/load_OnDuty_visits` +
        (queryString ? `?${queryString}` : "");
      const headers = getHeaders(true);

      console.log("%c[VisitTickets] loadTickets (Visits FeedBack) START", "color: #10b981; font-weight: bold;", {
        url,
        endpoint: "Tickets/load_OnDuty_visits",
        payload: paramsObj,
        headers,
        activeTab: "visits",
        selectedProjectId: currentProjectId,
        selectedProjectName: projects.find((p) => p.id === currentProjectId)?.name || "All Projects",
      });

      const response = await fetchWithTimeout(url, { headers }, 6000);
      console.log("[VisitTickets] loadTickets (Visits FeedBack) Response Status:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      const data = await response.json();
      console.log("[VisitTickets] loadTickets (Visits FeedBack) RAW Response Payload:", data);

      if (!response.ok) {
        const msg = typeof data === "string" ? data : (data?.message || `${response.status} ${response.statusText}`);
        console.error("[VisitTickets] loadTickets failed:", msg);
        setLoadError(String(msg));
        setTickets([]);
        return;
      }

      setLoadError("");
      console.log(`[VisitTickets] loadTickets Count: ${Array.isArray(data) ? data.length : 0} visits`);

      if (Array.isArray(data) && data.length > 0) {
        console.log("[VisitTickets] loadTickets (Visits FeedBack) Sample Visit [0]:", data[0]);
        try { sessionStorage.setItem("visit_tickets_onduty_cache", JSON.stringify(data)); } catch {}

        setFeedbackStore((prev) => {
          const updated: Record<string, VisitFeedbackRowData> = { ...prev };

          data.forEach((item: any, index: number) => {
            const vKey = getVisitKey(item, index);
            const existing = updated[vKey];

            // Parse server courses
            let serverCourses: string[] = [];
            if (item.coursesList || item.CoursesList) {
              const raw = String(item.coursesList || item.CoursesList);
              serverCourses = raw.split(",").map((s: string) => s.trim()).filter(Boolean);
            }

            // Parse server event requirements
            let serverEvents: string[] = [];
            if (item.eventRequirements || item.EventRequirements) {
              const raw = String(item.eventRequirements || item.EventRequirements);
              serverEvents = raw.split(",").map((s: string) => s.trim()).filter(Boolean);
            }

            const c1 = item.count01 !== undefined && item.count01 !== null ? String(item.count01) : (item.Count01 !== undefined && item.Count01 !== null ? String(item.Count01) : "");
            const eDate = item.eventDate || item.EventDate ? moment(item.eventDate || item.EventDate).format("YYYY-MM-DD") : "";
            const eToDate = item.eventToDate || item.EventToDate ? moment(item.eventToDate || item.EventToDate).format("YYYY-MM-DD") : "";
            const fDate = item.nextFollowupDate || item.NextFollowupDate ? moment(item.nextFollowupDate || item.NextFollowupDate).format("YYYY-MM-DD") : "";
            const remarks = item.clientRemarks || item.ClientRemarks || "";

            // The follow-up history for this visit. A visit saved before
            // follow-ups existed comes back without the array, so its single
            // flat set is read as one follow-up - the same reading the SQL
            // migration takes.
            const serverFollowups: any[] = Array.isArray(item.Followups) ? item.Followups : [];

            let followups: SavedFollowup[] = [];
            if (serverFollowups.length > 0) {
              followups = serverFollowups.map((f: any) => {
                const built = courseDataFromRows(f?.Courses ?? f?.courses ?? []);
                return {
                  feedbackId: Number(f?.Feedback_ID ?? f?.feedback_ID ?? 0),
                  followupDate: f?.FollowupDate ? moment(f.FollowupDate).format("YYYY-MM-DD") : "",
                  nextFollowupDate: f?.NextFollowupDate ? moment(f.NextFollowupDate).format("YYYY-MM-DD") : "",
                  nextVisitDate: f?.NextVisitDate ? moment(f.NextVisitDate).format("YYYY-MM-DD") : "",
                  clientRemarks: f?.ClientRemarks ?? "",
                  createdBy: String(f?.CreatedBy ?? f?.createdBy ?? "").trim(),
                  courses: built.courses,
                  courseData: built.courseData,
                };
              });
            } else if (serverCourses.length > 0 || c1 || serverEvents.length > 0 || eDate || remarks || fDate) {
              const legacyCourseData: Record<string, CourseFeedbackData> = {};
              serverCourses.forEach((name) => {
                legacyCourseData[name] = {
                  count1: c1,
                  eventRequirements: serverEvents,
                  eventDate: eDate,
                  eventToDate: eToDate,
                };
              });
              followups = [{
                feedbackId: Number(item.feedback_ID ?? item.Feedback_ID ?? 0),
                followupDate: fDate || (item.duty_Date ? moment(item.duty_Date).format("YYYY-MM-DD") : ""),
                nextFollowupDate: fDate,
                nextVisitDate: "",
                clientRemarks: remarks,
                courses: serverCourses,
                courseData: legacyCourseData,
              }];
            }

            updated[vKey] = {
              followups,
              // Anything half-typed and unsaved survives a refresh; an
              // untouched row just shows its history with the form closed.
              ...(existing && existing.draftOpen
                ? {
                    draftOpen: true,
                    editingId: existing.editingId ?? null,
                    courses: existing.courses,
                    courseData: existing.courseData,
                    clientRemarks: existing.clientRemarks,
                    nextFollowupDate: existing.nextFollowupDate,
                    saved: false,
                  }
                : emptyDraft()),
            };
          });

          try {
            localStorage.setItem("visits_feedback_store_v2", JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }

      setFollowupBy((prev) => {
        const next = { ...prev };
        (Array.isArray(data) ? data : []).forEach((it: any) => {
          const vid = Number(it?.visit_ID ?? it?.Visit_ID ?? 0);
          if (!vid) return;
          const key = String(vid);
          // Only seed what we have no opinion on - a click in flight wins.
          if (next[key] === undefined) {
            next[key] = String(it?.FollowUp_By ?? it?.followUp_By ?? "").trim();
          }
        });
        return next;
      });

      setTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[VisitTickets] loadTickets (Visits FeedBack) ERROR:", err);
      setLoadError(String((err as any)?.message || "Could not reach the server."));
    } finally {
      setLoading(false);
    }
  };

  // Initial mount: load projects master and active tab data
  useEffect(() => {
    console.log("%c[VisitTickets] Page Initialized", "color: #06b6d4; font-weight: bold;", {
      initialTab: activeTab,
      today,
      defaultFromDate,
      defaultToDate,
      tokenPresent: Boolean(localStorage.getItem("token")),
    });
    void loadProjectsList();
  }, []);

  // A locked feed stays selected even if the prop changes under us.
  useEffect(() => {
    if (only) setActiveTab(only);
  }, [only]);

  // When active tab changes, fetch corresponding data using currently applied filters
  useEffect(() => {
    console.log("%c[VisitTickets] Active Tab Switched ->", "color: #6366f1; font-weight: bold;", activeTab, {
      appliedFromDate: appliedFromDate || "Default Current Month",
      appliedToDate: appliedToDate || "Default Current Month",
      appliedProjectId,
    });
    if (activeTab === "tickets") {
      loadClosedTickets(appliedFromDate, appliedToDate, appliedProjectId);
    } else {
      loadTickets(appliedFromDate, appliedToDate, appliedProjectId);
    }
  }, [activeTab]);

  // Project dropdown change handler (updates UI selection only; applied on clicking 'Apply Filter')
  const handleProjectChange = (newProjId: string) => {
    setSelectedProjectId(newProjId);
  };

  // Filter visits client-side by applied project and applied date range
  const displayedVisits = useMemo(() => {
    let list = tickets;

    // Filter by Applied Project
    if (appliedProjectId && appliedProjectId !== "0" && appliedProjectId !== "ALL") {
      const selectedProjObj = projects.find((p) => p.id === appliedProjectId);
      const targetName = selectedProjObj ? selectedProjObj.name.toLowerCase().trim() : "";
      if (targetName) {
        list = list.filter((item) => {
          if (!item.projects) return false;
          const itemProj = String(item.projects).toLowerCase().trim();
          return itemProj.includes(targetName) || String(item.projects).trim() === appliedProjectId;
        });
      }
    }

    // Only filter by date when the user actually asked for a range.
    // Unset means show everything, matching what was fetched.
    const effectiveFrom = appliedFromDate && appliedFromDate.trim() ? appliedFromDate : "";
    const effectiveTo = appliedToDate && appliedToDate.trim() ? appliedToDate : "";

    if (effectiveFrom) {
      const startMoment = moment(effectiveFrom).startOf("day");
      list = list.filter((item) => {
        const itemDate = parseItemDate(item.duty_Date);
        if (!itemDate) return false;
        return itemDate.isSameOrAfter(startMoment);
      });
    }

    if (effectiveTo) {
      const endMoment = moment(effectiveTo).endOf("day");
      list = list.filter((item) => {
        const itemDate = parseItemDate(item.duty_Date);
        if (!itemDate) return false;
        return itemDate.isSameOrBefore(endMoment);
      });
    }

    console.log("[VisitTickets] Displayed Visits Count:", {
      appliedProjectId,
      effectiveFrom,
      effectiveTo,
      totalVisits: tickets.length,
      matchingVisits: list.length,
    });

    return list;
  }, [tickets, appliedProjectId, projects, appliedFromDate, appliedToDate, defaultFromDate, defaultToDate]);

  // Filtered visits by client search
  const filteredVisits = useMemo(() => {
    if (!clientSearch.trim()) return displayedVisits;
    const q = clientSearch.toLowerCase().trim();
    return displayedVisits.filter((item) => {
      const cName = String(item.client_Name || "").toLowerCase();
      const cPerson = String(item.contact_Person || "").toLowerCase();
      const loc = String(item.location || "").toLowerCase();
      const mob = String(item.mobile_Number || "").toLowerCase();
      const proj = String(item.projects || "").toLowerCase();
      const emps = String(item.employees || "").toLowerCase();
      const rem = String(item.remarks || "").toLowerCase();
      return (
        cName.includes(q) ||
        cPerson.includes(q) ||
        loc.includes(q) ||
        mob.includes(q) ||
        proj.includes(q) ||
        emps.includes(q) ||
        rem.includes(q)
      );
    });
  }, [displayedVisits, clientSearch]);

  /** Colleges in the loaded feed, with how many visits each has. */
  const clientOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    displayedVisits.forEach((v: any) => {
      const name = String(v?.client_Name || "").trim();
      if (!name) return;
      counts[name] = (counts[name] || 0) + 1;
    });

    const q = clientSearch.trim().toLowerCase();
    return Object.keys(counts)
      .filter((name) => !q || name.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ name, visits: counts[name] }));
  }, [displayedVisits, clientSearch]);

  // Filter tickets client-side by applied project and applied date range
  const displayedTickets = useMemo(() => {
    let list = ticketList;

    // Filter by Applied Project
    if (appliedProjectId && appliedProjectId !== "0" && appliedProjectId !== "ALL") {
      const selectedProjObj = projects.find((p) => p.id === appliedProjectId);
      const targetName = selectedProjObj ? selectedProjObj.name.toLowerCase().trim() : "";
      if (targetName) {
        list = list.filter((item) => {
          const pClient = String(item.projectClient || "").toLowerCase().trim();
          return pClient.includes(targetName);
        });
      }
    }

    // Filter by Date Range: if user applied custom dates, use them. If cleared/empty, default to current month
    const effectiveFrom = appliedFromDate && appliedFromDate.trim() ? appliedFromDate : defaultFromDate;
    const effectiveTo = appliedToDate && appliedToDate.trim() ? appliedToDate : defaultToDate;

    if (effectiveFrom) {
      const startMoment = moment(effectiveFrom).startOf("day");
      list = list.filter((item) => {
        const itemDate = parseItemDate(item.date);
        if (!itemDate) return false;
        return itemDate.isSameOrAfter(startMoment);
      });
    }

    if (effectiveTo) {
      const endMoment = moment(effectiveTo).endOf("day");
      list = list.filter((item) => {
        const itemDate = parseItemDate(item.date);
        if (!itemDate) return false;
        return itemDate.isSameOrBefore(endMoment);
      });
    }

    // Sort tickets in Date Descending order (latest first)
    list = [...list].sort((a, b) => {
      const dateA = parseItemDate(a.date);
      const dateB = parseItemDate(b.date);
      if (dateA && dateB) {
        const diff = dateB.valueOf() - dateA.valueOf();
        if (diff !== 0) return diff;
      } else if (dateB && !dateA) {
        return 1;
      } else if (dateA && !dateB) {
        return -1;
      }
      const idA = Number(a.ticketId) || 0;
      const idB = Number(b.ticketId) || 0;
      return idB - idA;
    });

    return list;
  }, [ticketList, appliedProjectId, projects, appliedFromDate, appliedToDate, defaultFromDate, defaultToDate]);

  // Filtered tickets by client search
  const filteredTickets = useMemo(() => {
    if (!clientSearch.trim()) return displayedTickets;
    const q = clientSearch.toLowerCase().trim();
    return displayedTickets.filter((item) => {
      const pClient = String(item.projectClient || "").toLowerCase();
      const mob = String(item.mobileNo || "").toLowerCase();
      const rem = String(item.remarks || "").toLowerCase();
      const tId = String(item.ticketId || "").toLowerCase();
      return (
        pClient.includes(q) ||
        mob.includes(q) ||
        rem.includes(q) ||
        tId.includes(q)
      );
    });
  }, [displayedTickets, clientSearch]);

  const formatDate = (d: string) => {
    if (!d) return "";
    return moment(d).format("YYYY-MM-DD");
  };

  const formatTime = (time: string) => {
    if (!time) return "-";
    return time.substring(0, 5);
  };

  // Render mobile number with Call button and detailed logging
  const renderMobileWithCall = (mobile?: string, rowContext?: any) => {
    if (!mobile) return "-";
    const trimmed = String(mobile).trim();
    if (
      !trimmed ||
      trimmed === "-" ||
      trimmed.toLowerCase() === "n/a" ||
      trimmed.toLowerCase() === "na" ||
      trimmed === "0"
    ) {
      return "-";
    }

    const numbers = trimmed.split(/[/,;]/).map((n) => n.trim()).filter(Boolean);
    if (numbers.length === 0) return "-";

    return (
      <div className="visit-mobile-cell">
        {numbers.map((num, idx) => {
          const cleanTel = num.replace(/[^0-9+]/g, "");
          return (
            <div key={idx} className="visit-mobile-item">
              <span className="visit-mobile-number">{num}</span>
              {cleanTel ? (
                <a
                  href={`tel:${cleanTel}`}
                  className="visit-call-btn"
                  title={`Call ${num}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log("%c[VisitTickets] Call Button Clicked", "color: #10b981; font-weight: bold;", {
                      phone: num,
                      dialNumber: cleanTel,
                      rowContext,
                      activeTab,
                      timestamp: moment().format("YYYY-MM-DD HH:mm:ss"),
                    });
                  }}
                >
                  <Phone size={12} />
                  <span>Call</span>
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  // Unique key for visit row feedback storage
  // Every party in the loaded feed, with how many visits of theirs are in
  // view. The count on the card is "in this date range"; opening it loads
  // the full history, which may be larger.
  const partiesInFeed = useMemo(() => {
    const map: Record<string, { name: string; visits: VisitTicket[]; followups: number }> = {};
    filteredVisits.forEach((v) => {
      const name = String(v.client_Name || "").trim() || "(No client name)";
      if (!map[name]) map[name] = { name, visits: [], followups: 0 };
      map[name].visits.push(v);
      map[name].followups += Array.isArray((v as any).Followups) ? (v as any).Followups.length : 0;
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredVisits]);

  // How many follow-ups a fetched history holds, for the totals line.
  const countFollowups = (visits: any[]): number =>
    (Array.isArray(visits) ? visits : []).reduce(
      (sum, v) => sum + (Array.isArray(v?.Followups) ? v.Followups.length : 0),
      0
    );

  // The admin roll-up. Two kinds of row, because an assignment with
  // nothing done about it yet is the row an admin most needs to see:
  //
  //   recorded  one row per follow-up actually entered
  //   awaiting  a visit whose FollowUp_By is set but which has no
  //             follow-up recorded against it at all
  //
  // A visit with neither an owner nor a follow-up is nobody's job yet
  // and belongs in Feedback Pending, not here.
  //
  // Built from what is already loaded - no extra call - so it honours
  // the same filters as the list it is a view of. The owner is read
  // from followupBy first so a chip just reassigned shows its new owner
  // here without a reload.
  const allFollowups = useMemo(() => {
    const rows: any[] = [];
    filteredVisits.forEach((v: any) => {
      const vid = Number(v?.visit_ID ?? v?.Visit_ID ?? 0);
      const seeded = String(v?.FollowUp_By ?? v?.followUp_By ?? "").trim();
      const owner = String(followupBy[String(vid)] ?? seeded).trim();
      const client = String(v?.client_Name || "").trim() || "(No client name)";
      const visitDate = v?.duty_Date || "";
      const list = Array.isArray(v?.Followups) ? v.Followups : [];

      list.forEach((f: any) => {
        const built = courseDataFromRows(f?.Courses ?? f?.courses ?? []);
        const followupDate = f?.FollowupDate ? moment(f.FollowupDate).format("YYYY-MM-DD") : "";
        rows.push({
          kind: "recorded",
          feedbackId: Number(f?.Feedback_ID ?? 0),
          visitId: vid,
          client,
          visitDate,
          owner,
          followupDate,
          // What this row sorts by: when the follow-up happened, or
          // failing that the visit it belongs to.
          sortDate: followupDate || (visitDate ? moment(visitDate).format("YYYY-MM-DD") : ""),
          nextFollowupDate: f?.NextFollowupDate ? moment(f.NextFollowupDate).format("YYYY-MM-DD") : "",
          nextVisitDate: f?.NextVisitDate ? moment(f.NextVisitDate).format("YYYY-MM-DD") : "",
          clientRemarks: f?.ClientRemarks ?? "",
          createdBy: String(f?.CreatedBy ?? f?.createdBy ?? "").trim(),
          courses: built.courses,
          courseData: built.courseData,
        });
      });

      if (list.length === 0 && owner) {
        rows.push({
          kind: "awaiting",
          feedbackId: 0,
          visitId: vid,
          client,
          visitDate,
          owner,
          followupDate: "",
          sortDate: visitDate ? moment(visitDate).format("YYYY-MM-DD") : "",
          nextFollowupDate: "",
          nextVisitDate: "",
          clientRemarks: "",
          courses: [] as string[],
          courseData: {} as Record<string, CourseFeedbackData>,
        });
      }
    });

    // Newest first, and within a day the outstanding ones first - an
    // admin opening this wants what has not been done before what has.
    rows.sort((a, b) => {
      const d = String(b.sortDate).localeCompare(String(a.sortDate));
      if (d !== 0) return d;
      if (a.kind === b.kind) return 0;
      return a.kind === "awaiting" ? -1 : 1;
    });
    return rows;
  }, [filteredVisits, followupBy]);

  // How many assignments have nothing recorded against them. Shown on
  // the tab, because a number nobody has to open a screen to see is the
  // one that gets acted on.
  const awaitingFollowupCount = useMemo(
    () => allFollowups.filter((r) => r.kind === "awaiting").length,
    [allFollowups]
  );

  const loadPartyHistory = async (clientName: string) => {
    if (!clientName || clientName === "(No client name)") return;
    setPartyLoading((p) => ({ ...p, [clientName]: true }));
    try {
      const url = `${API_BASE}Tickets/load_Party_History?clientName=${encodeURIComponent(clientName)}`;
      console.log("%c[VisitTickets] loadPartyHistory START", "color: #a855f7; font-weight: bold;", { url, clientName });
      const res = await fetchWithTimeout(url, { headers: getHeaders(true) }, 8000);
      const data = await res.json();
      console.log("[VisitTickets] loadPartyHistory rows:", Array.isArray(data) ? data.length : 0, data);
      setPartyHistory((p) => ({ ...p, [clientName]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      console.error("[VisitTickets] loadPartyHistory ERROR:", err);
      setPartyHistory((p) => ({ ...p, [clientName]: [] }));
    } finally {
      setPartyLoading((p) => ({ ...p, [clientName]: false }));
    }
  };

  const togglePartyOpen = (clientName: string) => {
    const next = openParty === clientName ? null : clientName;
    setOpenParty(next);
    // Fetched once per party and kept - reopening is instant, and the
    // visit list is not re-fetched behind the user's back.
    if (next && !partyHistory[next] && !partyLoading[next]) {
      void loadPartyHistory(next);
    }
  };

  const empCodeOf = (chip: string): string => {
    const s = String(chip || "").trim();
    const dash = s.indexOf("-");
    return (dash > 0 ? s.slice(0, dash) : s).trim();
  };

  const setVisitFollowupBy = async (item: VisitTicket, empCode: string) => {
    const visitId = Number(item.visit_ID || item.Visit_ID || 0);
    if (!visitId) {
      console.warn("[VisitTickets] No Visit_ID - cannot set FollowUp_By.");
      return;
    }

    const key = String(visitId);
    // Clicking the person already chasing it clears the owner.
    const next = followupBy[key] === empCode ? "" : empCode;
    const previous = followupBy[key] ?? "";

    setFollowupBy((p) => ({ ...p, [key]: next }));
    setFollowupBySaving((p) => ({ ...p, [key]: true }));

    try {
      const res = await fetch(`${API_BASE}Tickets/Save_Visit_FollowupBy`, {
        method: "POST",
        headers: getHeaders(false),
        body: JSON.stringify({
          Visit_ID: visitId,
          EmpCode: next || null,
          // Only used if the token carries no EmpCode claim.
          ActorEmpCode: currentEmpCode || null,
        }),
      });
      const resJson = await res.json().catch(() => null);
      console.log("[VisitTickets] Save_Visit_FollowupBy:", res.status, resJson);

      if (!res.ok) {
        // Put it back - the chip must not claim an owner the server refused.
        setFollowupBy((p) => ({ ...p, [key]: previous }));
        setFollowupByError((p) => ({
          ...p,
          [key]: String(resJson?.message || "Could not change the follow-up owner."),
        }));
        window.setTimeout(() => {
          setFollowupByError((p) => {
            const nextErrs = { ...p };
            delete nextErrs[key];
            return nextErrs;
          });
        }, 6000);
      }
    } catch (err) {
      console.error("[VisitTickets] Save_Visit_FollowupBy ERROR:", err);
      setFollowupBy((p) => ({ ...p, [key]: previous }));
    } finally {
      setFollowupBySaving((p) => ({ ...p, [key]: false }));
    }
  };

  /** Everyone who has been on a visit to this college, once each. */
  const visitorsOf = (visits: VisitTicket[]) => {
    const seen: Record<string, string> = {};
    visits.forEach((v: any) => {
      String(v?.employees || "")
        .split(",")
        .forEach((emp: string) => {
          const label = emp.trim();
          if (!label) return;
          const code = label.indexOf("-") > 0 ? label.slice(0, label.indexOf("-")).trim() : label;
          if (code && !seen[code]) seen[code] = label;
        });
    });
    return Object.keys(seen)
      .sort()
      .map((code) => ({ code, label: seen[code] }));
  };

  /**
   * Put one person on a college.
   *
   * Not on every visit, though: the server only accepts an owner who
   * was on that duty, and rightly so - you cannot be following up a
   * visit you were not on. A college's visits are not all the same
   * team, so writing the owner to all of them failed at the first
   * visit the person had not attended ("That employee was not on this
   * duty") and left the rest unset. They get the visits that are
   * theirs; the college still reads as theirs, because an unassigned
   * visit is not a competing owner.
   *
   * Passing the code that is already set clears it, from everywhere.
   */
  const assignGroupOwner = async (
    client: string,
    visits: VisitTicket[],
    empCode: string,
    clear: boolean
  ) => {
    const gKey = `grp:${client}`;
    setFollowupBySaving((p) => ({ ...p, [gKey]: true }));
    setFollowupByError((p) => {
      const next = { ...p };
      delete next[gKey];
      return next;
    });

    const wasThere = (v: any) =>
      String(v?.employees || "")
        .split(",")
        .some((emp: string) => {
          const label = emp.trim();
          if (!label) return false;
          const code = label.indexOf("-") > 0 ? label.slice(0, label.indexOf("-")).trim() : label;
          return code === empCode;
        });

    // Prefer the visits they were on, because those are the ones the
    // server will accept. But "was on" is read from the employees
    // string in the feed, and that is sometimes empty or carries the
    // duty roster rather than the visit's own team - so when it says
    // nobody, try everything and let the server decide.
    const theirs = visits.filter(wasThere);
    const mine = clear ? visits : (theirs.length > 0 ? theirs : visits);

    // Assigning a COLLEGE means this person owns it, so anyone else
    // holding one of its other visits is taken off.
    //
    // This is what made Lingayas and St Mary's look unassignable. Seven
    // people have been to each, several of them already named on a
    // visit, and the header only shows a name when the college agrees
    // on one. The write was working - it just left two or three other
    // owners in place, the college still disagreed with itself, and the
    // button kept saying "Assign" as though nothing had happened.
    const othersToClear = clear
      ? []
      : visits.filter((v: any) => {
          const o = followupOwnerOf(v);
          return !!o && o !== empCode && !mine.includes(v);
        });

    console.log("%c[Assign]", "color:#16a34a;font-weight:bold", {
      client,
      empCode,
      clear,
      visitsConsidered: visits.length,
      visitsTheyWereOn: theirs.length,
      visitsAttempted: mine.length,
      othersToClear: othersToClear.length,
      employeesPerVisit: visits.map((v: any) => ({
        id: v?.visit_ID ?? v?.Visit_ID,
        employees: v?.employees,
      })),
    });

    if (mine.length === 0) {
      setFollowupByError((p) => ({
        ...p,
        [gKey]: "This college has no visits to assign.",
      }));
      setFollowupBySaving((p) => ({ ...p, [gKey]: false }));
      return;
    }

    // One refusal is not a failure: a college's visits are not all the
    // same team, so the server will turn down the ones this person was
    // not on. Keep going and take the ones it accepts - stopping at the
    // first "no" left colleges half-assigned, or not assigned at all
    // when the first visit tried happened to be someone else's.
    let done = 0;
    let lastRefusal = "";

    for (const v of mine) {
      const visitId = Number((v as any)?.visit_ID || (v as any)?.Visit_ID || 0);
      if (!visitId) continue;
      const key = String(visitId);
      const previous = followupBy[key] ?? "";
      const next = clear ? "" : empCode;

      setFollowupBy((p) => ({ ...p, [key]: next }));

      try {
        const res = await fetch(`${API_BASE}Tickets/Save_Visit_FollowupBy`, {
          method: "POST",
          headers: getHeaders(false),
          body: JSON.stringify({
            Visit_ID: visitId,
            EmpCode: next || null,
            ActorEmpCode: currentEmpCode || null,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          console.warn("[Assign] rejected", { visitId, empCode, status: res.status, body });
          setFollowupBy((p) => ({ ...p, [key]: previous }));
          lastRefusal = String(body?.message || "Could not change the follow-up owner.");
          continue;
        }
        done += 1;
      } catch (err) {
        console.error("[Assign] network error", { visitId, empCode, err });
        setFollowupBy((p) => ({ ...p, [key]: previous }));
        lastRefusal = "Could not reach the server.";
      }
    }

    // Then take everyone else off, so the college names one person.
    for (const v of othersToClear) {
      const visitId = Number((v as any)?.visit_ID || (v as any)?.Visit_ID || 0);
      if (!visitId) continue;
      const key = String(visitId);
      const previous = followupBy[key] ?? "";
      setFollowupBy((p) => ({ ...p, [key]: "" }));
      try {
        const res = await fetch(`${API_BASE}Tickets/Save_Visit_FollowupBy`, {
          method: "POST",
          headers: getHeaders(false),
          body: JSON.stringify({
            Visit_ID: visitId,
            EmpCode: null,
            ActorEmpCode: currentEmpCode || null,
          }),
        });
        if (!res.ok) {
          console.warn("[Assign] could not clear previous owner", { visitId, status: res.status });
          setFollowupBy((p) => ({ ...p, [key]: previous }));
        }
      } catch (err) {
        console.error("[Assign] clear failed", { visitId, err });
        setFollowupBy((p) => ({ ...p, [key]: previous }));
      }
    }

    console.log("[Assign] done", {
      client,
      empCode,
      assigned: done,
      attempted: mine.length,
      cleared: othersToClear.length,
    });

    // Only an error when NOTHING took.
    if (done === 0) {
      setFollowupByError((p) => ({
        ...p,
        [gKey]: lastRefusal || "Could not change the follow-up owner.",
      }));
    }

    setFollowupBySaving((p) => ({ ...p, [gKey]: false }));

    // Clear it after a while: a message about one attempt should not
    // outlive the attempt.
    window.setTimeout(() => {
      setFollowupByError((p) => {
        const next = { ...p };
        delete next[gKey];
        return next;
      });
    }, 6000);
  };

  /**
   * Every visit this college has in the loaded feed.
   *
   * group.visits is only the slice the current tab shows, so acting on
   * it marked or assigned just those - which is how Lingayas ended up
   * with six visits Ignored and a seventh still in Handling, appearing
   * in two tabs at once. Assign and Ignore are decisions about the
   * college, so they have to reach all of it.
   */
  const allVisitsOfClient = (client: string) => {
    const want = String(client || "").trim().toLowerCase();
    return filteredVisits.filter(
      (v: any) => String(v?.client_Name || "").trim().toLowerCase() === want
    );
  };

  /**
   * Who is on this college.
   *
   * Unassigned visits are not a second opinion, so they are ignored: a
   * college with one owner on two visits and nobody on the other ten
   * is being handled by that person. Counting the blanks made the
   * button read "Assign" on every college in the Handling tab - the
   * one place it is guaranteed somebody IS on it.
   *
   * Two different people is a genuine split, and that still shows
   * nothing rather than picking one of them to display.
   */
  const groupOwnerOf = (visits: VisitTicket[]) => {
    const owners = new Set(
      visits.map((v) => followupOwnerOf(v)).filter((o) => !!o)
    );
    return owners.size === 1 ? Array.from(owners)[0] : "";
  };

  const getVisitKey = (item: VisitTicket, index?: number): string => {
    const vId = item.visit_ID ?? item.Visit_ID ?? item.visitId ?? item.id;
    if (vId && String(vId) !== "0" && String(vId) !== "undefined") {
      return `visit_${vId}`;
    }
    const cleanClient = (item.client_Name || "client").trim().toLowerCase().replace(/\s+/g, "_");
    const cleanDate = (item.duty_Date || "date").trim();
    const cleanFromTime = (item.visit_FromTime || "").trim().replace(/:/g, "");
    return `${cleanClient}_${cleanDate}_${cleanFromTime || (index !== undefined ? index : 0)}`;
  };

  // Visits with nothing recorded against them yet. Declared after
  // getVisitKey because it calls it.
  // FEEDBACK PENDING is about the CALL, and the call happens once per
  // visit. It used to be computed from follow-up count, which is a
  // different thing entirely - every visit nobody had chased counted as
  // feedback pending, which is why the number was 360 when only a
  // handful had actually gone uncalled.
  //
  // A visit is pending when no feedback call has been recorded against
  // it. Follow-ups are irrelevant here: a visit can have five of them
  // and still owe its call, or have the call and no follow-ups at all.
  // All Follow-ups shows the same cards as everywhere else, narrowed to
  // the visits that have follow-ups on them. The roll-up table it used
  // to show was a second way of reading the same records, with its own
  // columns and its own quirks.
  /** Has this visit been rung back? What we just saved counts too. */
  const hasCall = (v: any) => {
    const vid = String(v?.visit_ID ?? v?.Visit_ID ?? 0);
    if (callSaved[vid]) return true;
    return !!(v?.Feedback_CallOn ?? v?.feedback_CallOn);
  };

  /** Written off. A change made in this session wins over the feed. */
  const isLeft = (v: any) => {
    const vid = String(v?.visit_ID ?? v?.Visit_ID ?? 0);
    if (Object.prototype.hasOwnProperty.call(leftSaved, vid)) {
      return leftSaved[vid] === "LEFT";
    }
    return String(v?.FollowUp_Status ?? v?.followUp_Status ?? "").toUpperCase() === "LEFT";
  };

  /** Who owns the chasing - reassigned in this session, or as it came. */
  const followupOwnerOf = (v: any) => {
    const vid = String(v?.visit_ID ?? v?.Visit_ID ?? 0);
    const seeded = String(v?.FollowUp_By ?? v?.followUp_By ?? "").trim();
    return String(followupBy[vid] ?? seeded).trim();
  };

  // ---- Feedback ----------------------------------------------------
  const pendingVisits = useMemo(
    () => filteredVisits.filter((v: any) => !hasCall(v)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredVisits, callSaved]
  );

  const completedVisits = useMemo(
    () => filteredVisits.filter((v: any) => hasCall(v)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredVisits, callSaved]
  );

  // ---- Followups ---------------------------------------------------
  /**
   * Followups is a list of COLLEGES, so a college is in one state, not
   * one state per visit. Judging each visit separately put Lingayas in
   * Pending, Handling and Left at the same time - three entries, one
   * party, and no tab telling the truth about it.
   *
   * The whole college, in order:
   *
   *   LEFT      every visit written off. One visit still live means the
   *             college is still live - otherwise ignoring a single old
   *             visit would quietly retire the party.
   *   HANDLING  one person owns it - the same test the header's Assign
   *             button uses to decide whose name to show. "Anybody is
   *             named on any visit" put four colleges in Handling while
   *             three of them still read "Assign", because two people
   *             named on different visits of one college is not a
   *             college somebody is handling.
   *   PENDING   everything else: nobody on it, or nobody agreed.
   */
  const collegeStates = useMemo(() => {
    const byClient: Record<string, VisitTicket[]> = {};
    filteredVisits.forEach((v: any) => {
      const k = String(v?.client_Name || "").trim().toLowerCase();
      (byClient[k] = byClient[k] || []).push(v);
    });

    const states: Record<string, "pending" | "handling" | "left"> = {};
    Object.keys(byClient).forEach((k) => {
      const vs = byClient[k];
      if (vs.length > 0 && vs.every((v) => isLeft(v))) states[k] = "left";
      else if (groupOwnerOf(vs)) states[k] = "handling";
      else states[k] = "pending";
    });
    return states;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredVisits, leftSaved, followupBy]);

  const inState = (want: "pending" | "handling" | "left") =>
    filteredVisits.filter(
      (v: any) => collegeStates[String(v?.client_Name || "").trim().toLowerCase()] === want
    );

  const fuLeftVisits = useMemo(
    () => inState("left"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredVisits, collegeStates]
  );

  const fuPendingVisits = useMemo(
    () => inState("pending"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredVisits, collegeStates]
  );

  const fuHandlingVisits = useMemo(
    () => inState("handling"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredVisits, collegeStates]
  );

  /**
   * Followups is read college by college - a party's visits, calls and
   * follow-ups together, because the question there is "where are we
   * with St Mary's", not "what happened on the 27th". Feedback stays in
   * date order: a call is about one visit and nothing else.
   *
   * Within a college, OLDEST first. The college reads top to bottom as
   * what happened: each visit with the feedback call made after it, and
   * then, once, the follow-up for the college as a whole. It also leaves
   * the newest visit last, which is the one a new follow-up belongs to.
   */
  const orderForSection = (list: VisitTicket[]) => {
    if (section !== "followups") {
      // Feedback is a flat list of calls to make: newest visit first.
      return [...list].sort((a: any, b: any) => {
        const ad = parseItemDate(a?.duty_Date);
        const bd = parseItemDate(b?.duty_Date);
        if (ad && bd) return bd.valueOf() - ad.valueOf();
        if (ad) return -1;
        if (bd) return 1;
        return 0;
      });
    }

    // Grouped: the sort orders the COLLEGES by their most recent visit,
    // and the visits inside each one the same way - Date means newest
    // first everywhere, which is what "sorted by date" has to mean, or
    // the control looks broken on the only screen it is visible from.
    const latestOf: Record<string, number> = {};
    list.forEach((v: any) => {
      const k = String(v?.client_Name || "").trim().toLowerCase();
      const d = parseItemDate(v?.duty_Date);
      const t = d ? d.valueOf() : 0;
      if (!(k in latestOf) || t > latestOf[k]) latestOf[k] = t;
    });

    return [...list].sort((a: any, b: any) => {
      const an = String(a?.client_Name || "").trim().toLowerCase();
      const bn = String(b?.client_Name || "").trim().toLowerCase();
      if (an !== bn) {
        const d = (latestOf[bn] || 0) - (latestOf[an] || 0);
        if (d !== 0) return d;
        return an.localeCompare(bn);
      }
      // Within a college the order on screen is the timeline's own,
      // set on its card - this only has to keep the group together.
      const ad = parseItemDate(a?.duty_Date);
      const bd = parseItemDate(b?.duty_Date);
      if (ad && bd) return bd.valueOf() - ad.valueOf();
      if (ad) return -1;
      if (bd) return 1;
      return 0;
    });
  };

  /**
   * The college's newest visit, found by date rather than by position.
   * A new follow-up attaches to it, and that must not change when the
   * list is reordered - which is exactly the bug a position-based
   * "last one" would have introduced the moment Date sort flipped it.
   */
  const newestVisitOf = (visits: VisitTicket[]) => {
    let best: any = visits[0];
    let bestAt = -Infinity;
    visits.forEach((v: any) => {
      const d = parseItemDate(v?.duty_Date);
      const t = d ? d.valueOf() : -Infinity;
      if (t >= bestAt) {
        bestAt = t;
        best = v;
      }
    });
    return best;
  };

  /**
   * How many COLLEGES a list covers.
   *
   * Followups lists colleges, so its tabs have to count colleges. They
   * were counting visits, which is why Left read 6 above a single
   * college - Lingayas has six visits and ignoring it marks all six.
   * The number and the list were measuring different things.
   */
  const collegeCount = (list: VisitTicket[]) =>
    new Set(list.map((v: any) => String(v?.client_Name || "").trim().toLowerCase())).size;

  /** The list the two switchers currently add up to. */
  const visibleVisits = useMemo(() => {
    if (section === "feedback") {
      return fbTab === "pending" ? pendingVisits : completedVisits;
    }
    return fuTab === "pending"
      ? fuPendingVisits
      : fuTab === "handling"
        ? fuHandlingVisits
        : fuLeftVisits;
  }, [
    section, fbTab, fuTab,
    pendingVisits, completedVisits,
    fuPendingVisits, fuHandlingVisits, fuLeftVisits,
  ]);

  const visibleOrdered = useMemo(
    () => orderForSection(visibleVisits),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleVisits, section]
  );

  /**
   * The visits on screen, as colleges with their visits inside, in the
   * order orderForSection put them. In Feedback there is one group
   * holding everything, which the render then draws without a header -
   * so the two sections share one loop instead of two copies of a
   * 700-line card.
   */
  const visitGroups = useMemo(() => {
    const groups: { client: string; visits: VisitTicket[] }[] = [];
    visibleOrdered.forEach((v: any) => {
      const k = String(v?.client_Name || "").trim() || "(No client name)";
      const last = groups[groups.length - 1];
      if (last && last.client === k) last.visits.push(v);
      else groups.push({ client: k, visits: [v] });
    });
    return groups;
  }, [visibleOrdered]);

  /**
   * The shape of a college at a glance, for its header.
   *
   * All three are counted DISTINCT. Thirteen visits by the same four
   * people is four people, not fifty-two, and the same principal met
   * on every visit is one contact. A total that double-counts is worse
   * than no total, because it reads as reach that is not there.
   *
   * Contacts are matched on name, case- and space-insensitively, which
   * is the same normalising the dedup scripts do - "Dr Sharmila" and
   * "Dr Sharmila " are one person.
   */
  const groupStats = (visits: VisitTicket[]) => {
    let followups = 0;
    const people = new Set<string>();
    const contacts = new Set<string>();

    visits.forEach((v: any) => {
      followups += getRowFeedback(getVisitKey(v)).followups.length;

      String(v?.employees || "")
        .split(",")
        .forEach((emp: string) => {
          const code = empCodeOf(emp);
          if (code) people.add(code);
        });

      const who = String(v?.contact_Person || "").trim().toLowerCase().replace(/\s+/g, " ");
      if (who) contacts.add(who);
    });

    return { followups, people: people.size, contacts: contacts.size };
  };

  /**
   * The people met at a college: one row each, however many visits they
   * appear on. Numbers are collected rather than overwritten - the same
   * person is often recorded on two different mobiles and both are worth
   * having.
   */
  const contactsOf = (visits: VisitTicket[]) => {
    const map: Record<string, { name: string; mobiles: string[]; visits: number; last: string }> = {};
    visits.forEach((v: any) => {
      const raw = String(v?.contact_Person || "").trim();
      if (!raw) return;
      const key = raw.toLowerCase().replace(/\s+/g, " ");
      const mob = String(v?.mobile_Number || "").trim();
      if (!map[key]) map[key] = { name: raw, mobiles: [], visits: 0, last: "" };
      map[key].visits += 1;
      if (mob && !map[key].mobiles.includes(mob)) map[key].mobiles.push(mob);
      const d = parseItemDate(v?.duty_Date);
      const cur = parseItemDate(map[key].last);
      if (d && (!cur || d.isAfter(cur))) map[key].last = v?.duty_Date;
    });
    return Object.values(map).sort((a, b) => b.visits - a.visits);
  };

  /**
   * A college as one timeline: what happened, in the order it happened.
   *
   * Three kinds of thing land on it - the visit itself, the feedback
   * call made after it, and each follow-up - and they interleave. A
   * call made on the 3rd about a visit on the 2nd belongs between that
   * visit and the next one, not filed underneath it, because that is
   * how the conversation actually went.
   *
   * Everything is dated by when it happened. A follow-up with no date
   * falls back to its visit's date rather than to today, which would
   * shove old history to the bottom.
   */
  const buildTimeline = (visits: VisitTicket[], newestFirst: boolean) => {
    const events: any[] = [];

    visits.forEach((v: any) => {
      const vKey = getVisitKey(v);
      const visitDate = v?.duty_Date || "";

      events.push({ kind: "visit", at: visitDate, visit: v, visitKey: vKey });

      // A bulk close is not an event. It says a call was never made,
      // which the timeline already shows by not having one - printing
      // it put the same sentence on every visit in the backlog and
      // buried the visits themselves. It still counts as completed;
      // it just has nothing to narrate.
      const call = feedbackCallOf(v);
      if (call && String(call.by || "").toUpperCase() !== "BULK") {
        events.push({ kind: "call", at: call.on || visitDate, visit: v, visitKey: vKey, call });
      }

      getRowFeedback(vKey).followups.forEach((f) => {
        events.push({
          kind: "followup",
          at: f.followupDate || visitDate,
          visit: v,
          visitKey: vKey,
          followup: f,
        });
      });
    });

    const dir = newestFirst ? -1 : 1;
    events.sort((a, b) => {
      const ad = parseItemDate(a.at);
      const bd = parseItemDate(b.at);
      if (ad && bd) {
        const d = ad.valueOf() - bd.valueOf();
        if (d !== 0) return d * dir;
      } else if (ad) return -1;
      else if (bd) return 1;
      // Same day, the order things happen in: the visit, the call about
      // it, then the chasing. Not reversed with the sort - a call cannot
      // read as coming before the visit it was about.
      const rank: Record<string, number> = { visit: 0, call: 1, followup: 2 };
      return (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9);
    });

    return events;
  };

  // Colleges the user has opened. Absent means closed: the list is a
  // list of colleges first, and thirty of them expanded is a page you
  // scroll rather than a page you read. A search narrows to the handful
  // you care about and you open the one you want.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // One at a time. An open college is tall - a timeline, its own scroll
  // box and a form - so two of them open means the second is somewhere
  // below the fold and the list has stopped being a list. Opening one
  // closes whatever was open; clicking the open one closes it.
  const toggleGroup = (client: string) =>
    setOpenGroups((p) => (p[client] ? {} : { [client]: true }));

  const getRowFeedback = (visitKey: string): VisitFeedbackRowData => {
    return (
      feedbackStore[visitKey] || {
        followups: [],
        ...emptyDraft(),
      }
    );
  };

  // One course's figures on one visit.
  const getCourseFeedback = (visitKey: string, courseName: string): CourseFeedbackData => {
    return getRowFeedback(visitKey).courseData[courseName] || emptyCourseFeedback();
  };

  const persistStore = (updated: Record<string, VisitFeedbackRowData>) => {
    try {
      localStorage.setItem("visits_feedback_store_v2", JSON.stringify(updated));
    } catch {}
  };

  // Visit-level fields: client remarks and the next followup date.
  const updateFeedbackField = (
    visitKey: string,
    field: "clientRemarks" | "nextFollowupDate" | "nextVisitDate",
    value: any,
    rowInfo?: any
  ) => {
    setFeedbackStore((prev) => {
      const current = prev[visitKey] || {
        followups: [],
        ...emptyDraft(),
      };
      const updated = {
        ...prev,
        [visitKey]: { ...current, [field]: value, saved: false },
      };
      persistStore(updated);
      return updated;
    });

    console.log("%c[VisitTickets] Feedback Field Updated", "color: #3b82f6; font-weight: bold;", {
      visitKey,
      field,
      value,
      client: rowInfo?.client_Name,
    });
  };

  // Per-course fields: count, event requirement, event dates.
  const updateCourseField = (
    visitKey: string,
    courseName: string,
    field: keyof CourseFeedbackData,
    value: any,
    rowInfo?: any
  ) => {
    setFeedbackStore((prev) => {
      const current = prev[visitKey] || {
        followups: [],
        ...emptyDraft(),
      };
      const course = current.courseData[courseName] || emptyCourseFeedback();
      const updated = {
        ...prev,
        [visitKey]: {
          ...current,
          courseData: {
            ...current.courseData,
            [courseName]: { ...course, [field]: value },
          },
          saved: false,
        },
      };
      persistStore(updated);
      return updated;
    });

    console.log("%c[VisitTickets] Course Field Updated", "color: #3b82f6; font-weight: bold;", {
      visitKey,
      courseName,
      field,
      value,
      client: rowInfo?.client_Name,
    });
  };

  // Adding a course gives it an empty set of figures; removing one takes
  // its figures with it, so a course that is put back does not silently
  // inherit what was typed against it before.
  const toggleCourseSelection = (visitKey: string, courseName: string, rowInfo?: any) => {
    setFeedbackStore((prev) => {
      const current = prev[visitKey] || {
        followups: [],
        ...emptyDraft(),
      };
      const exists = current.courses.includes(courseName);
      const courses = exists
        ? current.courses.filter((c) => c !== courseName)
        : [...current.courses, courseName];

      const courseData = { ...current.courseData };
      if (exists) {
        delete courseData[courseName];
      } else if (!courseData[courseName]) {
        courseData[courseName] = emptyCourseFeedback();
      }

      const updated = {
        ...prev,
        [visitKey]: { ...current, courses, courseData, saved: false },
      };
      persistStore(updated);
      return updated;
    });

    console.log("%c[VisitTickets] Course Toggled", "color: #3b82f6; font-weight: bold;", {
      visitKey,
      courseName,
      client: rowInfo?.client_Name,
    });
  };

  const toggleEventSelection = (
    visitKey: string,
    courseName: string,
    eventName: string,
    rowInfo?: any
  ) => {
    const current = getCourseFeedback(visitKey, courseName);
    const exists = current.eventRequirements.includes(eventName);
    const updatedEvents = exists
      ? current.eventRequirements.filter((e) => e !== eventName)
      : [...current.eventRequirements, eventName];

    updateCourseField(visitKey, courseName, "eventRequirements", updatedEvents, rowInfo);
  };

  const isEditableToday = (f: SavedFollowup): boolean =>
    Boolean(f.followupDate) && f.followupDate === moment().format("YYYY-MM-DD");

  const openDraft = (visitKey: string, from?: SavedFollowup) => {
    // The server refuses an edit to an earlier day's entry, so do not
    // open a form that cannot be saved.
    if (from && !isEditableToday(from)) return;

    setSaveErrors((p) => {
      const next = { ...p };
      delete next[visitKey];
      return next;
    });

    setFeedbackStore((prev) => {
      const current = prev[visitKey] || { followups: [], ...emptyDraft() };
      const updated = {
        ...prev,
        [visitKey]: {
          ...current,
          draftOpen: true,
          editingId: from ? from.feedbackId : null,
          courses: from ? [...from.courses] : [],
          courseData: from ? { ...from.courseData } : {},
          clientRemarks: from ? from.clientRemarks : "",
          nextFollowupDate: from ? from.nextFollowupDate : "",
          nextVisitDate: from ? from.nextVisitDate : "",
          followupDate: from ? from.followupDate : "",
          saved: false,
        },
      };
      persistStore(updated);
      return updated;
    });
  };

  const closeDraft = (visitKey: string) => {
    setFeedbackStore((prev) => {
      const current = prev[visitKey] || { followups: [], ...emptyDraft() };
      const updated = {
        ...prev,
        [visitKey]: { followups: current.followups, ...emptyDraft() },
      };
      persistStore(updated);
      return updated;
    });
  };

  /**
   * The event picker opens on today.
   *
   * Written into the draft, not shown as a placeholder: a field that
   * looks filled and saves blank is worse than one that is plainly
   * empty. Keyed on the opening, so clearing the date inside the
   * dialog sticks instead of being refilled under you.
   */
  useEffect(() => {
    if (!eventDateModal?.open) return;
    const { visitKey, courseName, clientName } = eventDateModal;
    if (!visitKey || !courseName) return;

    const cf = getCourseFeedback(visitKey, courseName);
    if (cf.eventDate || cf.eventToDate) return;

    updateCourseField(visitKey, courseName, "eventDate", moment().format("YYYY-MM-DD"), {
      client_Name: clientName,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventDateModal?.open, eventDateModal?.visitKey, eventDateModal?.courseName]);

  const handleSaveRowFeedback = async (visitKey: string, item: VisitTicket) => {
    const row = getRowFeedback(visitKey);
    const visitId = Number(item.visit_ID || item.Visit_ID || 0);

    // Courses carry their own figures; remarks and the followup date are
    // the visit's. CoursesList is still sent so the parent row keeps a
    // readable summary for anything reading the old flat columns.
    const payload = {
      // Null adds a new follow-up; a value edits that existing one, so
      // saving a March chase cannot overwrite the January entry.
      Feedback_ID: row.editingId ?? null,
      Visit_ID: visitId,
      CoursesList: row.courses.join(", "),
      ClientRemarks: row.clientRemarks || null,
      FollowupDate: row.followupDate ? moment(row.followupDate).format("YYYY-MM-DD") : null,
      NextFollowupDate: row.nextFollowupDate ? moment(row.nextFollowupDate).format("YYYY-MM-DD") : null,
      NextVisitDate: row.nextVisitDate ? moment(row.nextVisitDate).format("YYYY-MM-DD") : null,
      Courses: row.courses.map((courseName) => {
        const c = row.courseData[courseName] || emptyCourseFeedback();
        return {
          CourseName: courseName,
          Count01: c.count1 ? parseInt(c.count1, 10) : null,
          EventRequirements: c.eventRequirements.join(", "),
          EventDate: c.eventDate ? moment(c.eventDate).format("YYYY-MM-DD") : null,
          EventToDate: c.eventToDate ? moment(c.eventToDate).format("YYYY-MM-DD") : null,
        };
      }),
    };

    console.log("%c[VisitTickets] Save Visit Feedback API Request:", "color: #10b981; font-weight: bold;", {
      endpoint: "Tickets/Save_VisitFeedback",
      payload,
      visitKey,
      clientName: item.client_Name,
      hasVisitId: visitId > 0,
    });

    setSavingRows((prev) => ({ ...prev, [visitKey]: true }));

    let savedId = row.editingId ?? 0;

    try {
      if (visitId > 0) {
        const headers = getHeaders(false);
        const res = await fetch(`${API_BASE}Tickets/Save_VisitFeedback`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        console.log("[VisitTickets] Save_VisitFeedback HTTP Status:", res.status, res.statusText);
        const resJson = await res.json().catch(() => null);
        console.log("[VisitTickets] Save_VisitFeedback Response:", resJson);

        if (!res.ok) {
          const msg = String(
            resJson?.message || "Could not save this follow-up. Please try again."
          );
          console.warn("[VisitTickets] Save refused:", msg, resJson);
          setSaveErrors((p) => ({ ...p, [visitKey]: msg }));
          setSavingRows((p) => ({ ...p, [visitKey]: false }));
          return;
        }

        setSaveErrors((p) => {
          const next = { ...p };
          delete next[visitKey];
          return next;
        });

        savedId = Number(resJson?.feedback?.Feedback_ID ?? resJson?.Feedback_ID ?? 0) || savedId;
      } else {
        console.warn("[VisitTickets] No Visit_ID found for row, persisting locally in localStorage.");
      }

      // The draft becomes a history entry and the form closes, ready for
      // the next follow-up rather than sitting there inviting a duplicate.
      setFeedbackStore((prev) => {
        const current = prev[visitKey] || { followups: [], ...emptyDraft() };
        const entry: SavedFollowup = {
          feedbackId: savedId,
          followupDate: row.followupDate || moment().format("YYYY-MM-DD"),
          nextFollowupDate: row.nextFollowupDate,
          nextVisitDate: row.nextVisitDate,
          clientRemarks: row.clientRemarks,
          courses: row.courses,
          courseData: row.courseData,
        };

        const history = [...current.followups];
        const at = history.findIndex(
          (f) => entry.feedbackId > 0 && f.feedbackId === entry.feedbackId
        );
        if (at >= 0) history[at] = entry; else history.push(entry);
        history.sort((a, b) => String(a.followupDate).localeCompare(String(b.followupDate)));

        const updated = {
          ...prev,
          [visitKey]: { followups: history, ...emptyDraft(), saved: true },
        };
        try {
          localStorage.setItem("visits_feedback_store_v2", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    } catch (err) {
      console.error("[VisitTickets] Error calling Save_VisitFeedback API:", err);
      setFeedbackStore((prev) => {
        const updated = {
          ...prev,
          [visitKey]: {
            ...row,
            saved: true,
          },
        };
        try {
          localStorage.setItem("visits_feedback_store_v2", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    } finally {
      setSavingRows((prev) => ({ ...prev, [visitKey]: false }));
    }
  };

  const body = (
      <>
        <div className="wr-container stock-container" style={{ padding: 0, minHeight: 'auto', backgroundColor: 'transparent' }}>
          
          {/* ── Premium Header ── */}
          {!embedded && (
          <div className="page-wr-header" style={{ margin: '16px', borderRadius: '16px', padding: '16px' }}>
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()}>
                <ChevronLeft size={22} color="white" />
              </button>
              <div>
                <h1 className="page-wr-title">
                  {only === "visits" ? "Visits Follow-up" : "Client Feedback"}
                </h1>
                <p className="page-wr-subtitle">
                  {only === "visits"
                    ? "Client feedback from on-duty visits"
                    : "Feedback on Closed Tickets"}
                </p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <div className="page-wr-header-icon-box">
                <IonIcon icon={documentTextOutline} style={{ color: 'var(--ion-color-primary)', fontSize: '24px' }} />
              </div>
            </div>
          </div>
          )}

          <div className="stock-panel visit-toolbar" style={{ margin: '0 16px 20px 16px' }}>
            
            {/* Tabs & Client Search Bar Row (Added beside Visits FeedBack Tab) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--stock-border)' }}>
              {/* Only when this page owns both feeds. Client Feedback is
                  locked to "tickets" and the Visits Follow-up page's own tab
                  strip owns the switch for "visits", so a second strip here
                  would just be a dead control. */}
              {!only && (
                <div className="stock-tabs" style={{ background: 'transparent', boxShadow: 'none', padding: 0, border: 'none' }}>
                  <button
                    type="button"
                    className={`stock-tab ${activeTab === "tickets" ? "active" : ""}`}
                    onClick={() => {
                      console.log("[VisitTickets] Tab Clicked: Tickets FeedBack");
                      try { sessionStorage.setItem("visit_tickets_active_tab", "tickets"); } catch {}
                      setActiveTab("tickets");
                    }}
                    style={{ minWidth: '120px' }}
                  >
                    Tickets FeedBack
                  </button>
                  <button
                    type="button"
                    className={`stock-tab ${activeTab === "visits" ? "active" : ""}`}
                    onClick={() => {
                      console.log("[VisitTickets] Tab Clicked: Visits FeedBack");
                      try { sessionStorage.setItem("visit_tickets_active_tab", "visits"); } catch {}
                      setActiveTab("visits");
                    }}
                    style={{ minWidth: '120px' }}
                  >
                    Visits FeedBack
                  </button>
                </div>
              )}

              {/* ── Search Bar & View Mode Toggle beside VisitFeedback Tab ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <div className="visit-search" style={{ minWidth: '240px', maxWidth: '380px', flex: 1 }}>
                  <Search size={16} className="visit-search-icon" />
                  <input
                    type="text"
                    placeholder="Search or pick a college..."
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    // A click on an option fires after blur, so closing
                    // immediately would unmount the row before it could
                    // be chosen.
                    onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setSearchOpen(false);
                      if (e.key === "Enter") setSearchOpen(false);
                    }}
                    className="visit-table-input"
                    style={{ paddingLeft: '36px', paddingRight: clientSearch ? '54px' : '34px', height: '38px', borderRadius: '999px', fontSize: '13px' }}
                  />

                  {clientSearch && (
                    <button
                      type="button"
                      className="visit-search-clear"
                      onClick={() => {
                        setClientSearch("");
                        setSearchOpen(false);
                      }}
                      title="Clear"
                    >
                      <X size={15} />
                    </button>
                  )}

                  <button
                    type="button"
                    className="visit-search-chev"
                    onClick={() => setSearchOpen((o) => !o)}
                    title="Show colleges"
                  >
                    <ChevronDown
                      size={15}
                      style={searchOpen ? { transform: "rotate(180deg)" } : undefined}
                    />
                  </button>

                  {searchOpen && (
                    <div className="visit-search-pop">
                      {clientOptions.length === 0 ? (
                        <div className="visit-search-none">No college matches that.</div>
                      ) : (
                        clientOptions.slice(0, 40).map((opt) => (
                          <button
                            type="button"
                            key={opt.name}
                            className={`visit-search-opt ${
                              opt.name.toLowerCase() === clientSearch.trim().toLowerCase() ? "on" : ""
                            }`}
                            // onMouseDown, not onClick: blur runs first
                            // otherwise and the list is gone by the time
                            // the click would land.
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setClientSearch(opt.name);
                              setSearchOpen(false);
                            }}
                          >
                            <Building2 size={12} />
                            <span className="visit-search-opt-name">{opt.name}</span>
                            <span className="visit-search-opt-count">{opt.visits}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* The two jobs this screen exists for, and the states
                    each one has. The second row only ever shows the states
                    of the section above it, so Completed and Handling
                    cannot be confused for each other. The Tickets tab has
                    neither job, so nothing is drawn there. */}
                {activeTab === "visits" && (
                <div className="visit-view-stack">
                  <div className="visit-view-toggle">
                    <button
                      type="button"
                      className={`visit-view-btn ${section === "feedback" ? "active" : ""}`}
                      onClick={() => setSection("feedback")}
                      title="The call made to the party after a visit"
                    >
                      <Phone size={13} />
                      <span>Feedback</span>
                      {pendingVisits.length > 0 && (
                        <span className="visit-view-count" title="Not yet called">
                          {pendingVisits.length}
                        </span>
                      )}
                    </button>
                    {isFollowupAdmin && (
                      <button
                        type="button"
                        className={`visit-view-btn ${section === "followups" ? "active" : ""}`}
                        onClick={() => setSection("followups")}
                        title="The chasing that comes after a visit"
                      >
                        <UserCheck size={13} />
                        <span>Followups</span>
                        {fuPendingVisits.length > 0 && (
                          <span className="visit-view-count" title="Colleges with nobody on them yet">
                            {collegeCount(fuPendingVisits)}
                          </span>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="visit-subtabs">
                    {section === "feedback" ? (
                      <>
                        <button
                          type="button"
                          className={`visit-subtab ${fbTab === "pending" ? "active" : ""}`}
                          onClick={() => setFbTab("pending")}
                        >
                          <span>Pending</span>
                          <span className="visit-subtab-count">{pendingVisits.length}</span>
                        </button>
                        <button
                          type="button"
                          className={`visit-subtab ${fbTab === "done" ? "active" : ""}`}
                          onClick={() => setFbTab("done")}
                        >
                          <span>Completed</span>
                          <span className="visit-subtab-count">{completedVisits.length}</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`visit-subtab ${fuTab === "pending" ? "active" : ""}`}
                          onClick={() => setFuTab("pending")}
                          title="Somebody owns it, nothing recorded yet"
                        >
                          <span>Pending</span>
                          <span className="visit-subtab-count">{collegeCount(fuPendingVisits)}</span>
                        </button>
                        <button
                          type="button"
                          className={`visit-subtab ${fuTab === "handling" ? "active" : ""}`}
                          onClick={() => setFuTab("handling")}
                          title="At least one follow-up recorded"
                        >
                          <span>Handling</span>
                          <span className="visit-subtab-count">{collegeCount(fuHandlingVisits)}</span>
                        </button>
                        <button
                          type="button"
                          className={`visit-subtab ${fuTab === "left" ? "active" : ""}`}
                          onClick={() => setFuTab("left")}
                          title="Decided not worth chasing"
                        >
                          <span>Left</span>
                          <span className="visit-subtab-count">{collegeCount(fuLeftVisits)}</span>
                        </button>
                      </>
                    )}
                  </div>

                </div>
                )}
              </div>
            </div>

            {/* The project and date filters belong to Tickets, which
                defaults to the current month and needs a way out of it.
                Visits does not: with nothing applied it already shows
                every visit, which is what Feedback Pending has to count,
                and a date box that silently narrows that count is worse
                than no date box. */}
            {activeTab === "tickets" && (
            <div className="stock-grid" style={{ marginTop: '16px' }}>
              
              {/* Projects Dropdown */}
              <div className="stock-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Briefcase size={14} style={{ color: 'var(--stock-accent, #45599b)' }} />
                  <span>Project</span>
                </label>
                <select
                  className="stock-select"
                  value={selectedProjectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  style={{ minHeight: '38px', cursor: 'pointer' }}
                >
                  <option value="0">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* From Date */}
              <div className="stock-field">
                <label>From Date</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <div id="from-date-trigger" className="stock-input" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', minHeight: '38px', width: '100%', color: fromDate ? 'var(--stock-text)' : 'var(--stock-muted)', paddingRight: fromDate ? '28px' : '10px' }}>
                    {fromDate ? moment(fromDate).format("DD/MM/YYYY") : "Select Date"}
                  </div>
                  {fromDate && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFromDate("");
                      }}
                      style={{ position: 'absolute', right: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: '4px' }}
                      title="Clear From Date"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <IonPopover trigger="from-date-trigger" triggerAction="click" alignment="start">
                  <IonDatetime
                    presentation="date"
                    value={fromDate || defaultFromDate}
                    onIonChange={(e) => {
                      const val = (e.detail.value as string).split('T')[0];
                      console.log("[VisitTickets] From Date changed:", val);
                      setFromDate(val);
                    }}
                  />
                </IonPopover>
              </div>

              {/* To Date */}
              <div className="stock-field">
                <label>To Date</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <div id="to-date-trigger" className="stock-input" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', minHeight: '38px', width: '100%', color: toDate ? 'var(--stock-text)' : 'var(--stock-muted)', paddingRight: toDate ? '28px' : '10px' }}>
                    {toDate ? moment(toDate).format("DD/MM/YYYY") : "Select Date"}
                  </div>
                  {toDate && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setToDate("");
                      }}
                      style={{ position: 'absolute', right: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: '4px' }}
                      title="Clear To Date"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <IonPopover trigger="to-date-trigger" triggerAction="click" alignment="start">
                  <IonDatetime
                    presentation="date"
                    value={toDate || defaultToDate}
                    onIonChange={(e) => {
                      const val = (e.detail.value as string).split('T')[0];
                      console.log("[VisitTickets] To Date changed:", val);
                      setToDate(val);
                    }}
                  />
                </IonPopover>
              </div>

              {/* Action Buttons */}
              <div className="stock-field" style={{ minWidth: '220px' }}>
                {/* Spacer label to align vertically with date inputs */}
                <label className="hide-on-mobile">&nbsp;</label>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', height: '100%', alignItems: 'flex-end' }}>
                  <button 
                    className="stock-button" 
                    style={{ flex: '1 0 auto', minWidth: '110px', height: '38px', minHeight: '38px', padding: '0 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 700 }}
                    onClick={() => {
                      console.log("%c[VisitTickets] 'Apply Filter' Clicked - Payload:", "color: #3b82f6; font-weight: bold;", {
                        activeTab,
                        fromDate: fromDate || "Default Current Month",
                        toDate: toDate || "Default Current Month",
                        selectedProjectId,
                        projectName: projects.find((p) => p.id === selectedProjectId)?.name || "All Projects",
                      });
                      setAppliedProjectId(selectedProjectId);
                      setAppliedFromDate(fromDate);
                      setAppliedToDate(toDate);
                      if (activeTab === "tickets") {
                        loadClosedTickets(fromDate, toDate, selectedProjectId);
                      } else {
                        loadTickets(fromDate, toDate, selectedProjectId);
                      }
                    }}
                  >
                    Apply Filter
                  </button>
                  <button 
                    className="stock-button stock-button--secondary" 
                    style={{ flex: '0 0 auto', minWidth: '70px', height: '38px', minHeight: '38px', padding: '0 14px', display: 'flex', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 600 }}
                    onClick={() => {
                      console.log("%c[VisitTickets] 'Reset' Filters Clicked", "color: #ef4444; font-weight: bold;", {
                        resetProject: "0",
                        activeTab,
                      });
                      setFromDate("");
                      setToDate("");
                      setSelectedProjectId("0");
                      setAppliedFromDate("");
                      setAppliedToDate("");
                      setAppliedProjectId("0");
                      setClientSearch("");
                      if (activeTab === "tickets") {
                        loadClosedTickets("", "", "0");
                      } else {
                        loadTickets("", "", "0");
                      }
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>

            </div>
            )}
          </div>

          {/* Content Panel (Grid Cards / Table View) */}
          <div className="visit-panel" style={{ margin: '0 16px 20px 16px', background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>

        {activeTab === "tickets" ? (

          viewMode !== "table" ? (
            <div className="tickets-cards-grid">
              {filteredTickets.length > 0 ? (
                filteredTickets.map((item, index) => (
                  <div
                    className="tasks-premium-card visit-grid-card"
                    key={index}
                    style={{ animationDelay: `${index * 0.03}s` }}
                  >
                    <div className="task-card-header">
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <div className="tid-badge">
                          #{item.ticketId}
                        </div>
                      </div>
                      <div
                        className="visit-date-chip"
                        style={{
                          fontWeight: 700,
                          color: "var(--stock-accent, #45599b)",
                          background: "#eef2ff",
                          flexShrink: 0,
                        }}
                      >
                        <Calendar size={12} />
                        <span>{item.date || "-"}</span>
                      </div>
                    </div>

                    <div className="card-body" style={{ padding: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: "8px 12px",
                          margin: "2px 0 6px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: "180px" }}>
                          <Building2 size={16} style={{ color: "var(--ion-color-primary, #3b82f6)", flexShrink: 0 }} />
                          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#1e293b", lineHeight: 1.25 }}>
                            {item.projectClient || "Client / Project"}
                          </h3>
                        </div>

                        {item.mobileNo && (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                            <strong style={{ fontSize: "12px", color: "#64748b" }}>Mobile:</strong>
                            {renderMobileWithCall(item.mobileNo, {
                              type: "ticket",
                              ticketId: item.ticketId,
                              projectClient: item.projectClient,
                            })}
                          </div>
                        )}
                      </div>

                      {item.remarks && (
                        <div
                          style={{
                            margin: "4px 0 0",
                            padding: "6px 10px",
                            background: "#fffbeb",
                            borderLeft: "3px solid #f59e0b",
                            borderRadius: "4px",
                            fontSize: "12.5px",
                            color: "#92400e",
                            lineHeight: 1.35,
                          }}
                        >
                          <strong>Remarks:</strong> {item.remarks}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: "center", padding: "30px 16px", color: "#64748b", background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", gridColumn: "1 / -1" }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>No ticket records found.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="visit-table-wrapper">
              <table className="visit-table">
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Project & Client</th>
                    <th className="mobile-header">Mobile</th>
                    <th>Date</th>
                    <th>Remarks</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTickets.length > 0 ? (
                    filteredTickets.map((item, index) => (
                      <tr key={index}>
                        <td>{item.ticketId}</td>
                        <td>{item.projectClient || "-"}</td>
                        <td className="mobile-cell">
                          {renderMobileWithCall(item.mobileNo, {
                            type: "ticket",
                            ticketId: item.ticketId,
                            projectClient: item.projectClient,
                          })}
                        </td>
                        <td>{item.date || "-"}</td>
                        <td>{item.remarks || "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: 20 }}>
                        No ticket records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )

        ) : (


          viewMode === "party" ? (
            /* Everything about one client in one place: their visits oldest
               first, and under each visit the feedback and the follow-ups
               recorded against it. Read-only - editing stays in Cards and
               Table, so a history view cannot rewrite history by accident. */
            <div className="party-list">
              {partiesInFeed.length > 0 ? (
                partiesInFeed.map((party) => {
                  const isOpen = openParty === party.name;
                  const history = partyHistory[party.name];
                  const loading = partyLoading[party.name];
                  // Until the full history arrives, show what the feed
                  // already has rather than an empty card.
                  const visits = isOpen && history ? history : party.visits;

                  return (
                    <div className={`party-card ${isOpen ? "open" : ""}`} key={party.name}>
                      <button
                        type="button"
                        className="party-head"
                        onClick={() => togglePartyOpen(party.name)}
                      >
                        <Building2 size={16} className="party-icon" />
                        <span className="party-name">{party.name}</span>
                        <span className="party-count">
                          {party.visits.length} visit{party.visits.length === 1 ? "" : "s"} in range
                          {party.followups > 0 && (
                            <>
                              {" · "}
                              <span className="party-count-fups">
                                {party.followups} followup{party.followups === 1 ? "" : "s"}
                              </span>
                            </>
                          )}
                        </span>
                        <ChevronDown size={16} className="party-chev" />
                      </button>

                      {isOpen && (
                        <div className="party-body">
                          {loading && (
                            <div className="party-loading">Loading full history...</div>
                          )}

                          {!loading && history && (
                            <div className="party-total">
                              {history.length} visit{history.length === 1 ? "" : "s"}
                              {" · "}
                              {countFollowups(history)} followup{countFollowups(history) === 1 ? "" : "s"}
                              {" in total"}
                            </div>
                          )}

                          {visits.length === 0 && !loading && (
                            <div className="party-loading">No visits recorded for this party.</div>
                          )}

                          {visits.map((v: any, vi: number) => {
                            const vKey = getVisitKey(v, vi);
                            const vFeedback = getRowFeedback(vKey);
                            // The history call carries its own follow-ups;
                            // the store only knows about visits in range.
                            const fups: SavedFollowup[] = Array.isArray(v.Followups) && v.Followups.length > 0
                              ? v.Followups.map((f: any) => {
                                  const built = courseDataFromRows(f?.Courses ?? f?.courses ?? []);
                                  return {
                                    feedbackId: Number(f?.Feedback_ID ?? 0),
                                    followupDate: f?.FollowupDate ? moment(f.FollowupDate).format("YYYY-MM-DD") : "",
                                    clientRemarks: f?.ClientRemarks ?? "",
                                    createdBy: String(f?.CreatedBy ?? f?.createdBy ?? "").trim(),
                                    courses: built.courses,
                                    courseData: built.courseData,
                                  };
                                })
                              : vFeedback.followups;

                            return (
                              <div className="party-visit" key={vKey}>
                                <div className="party-visit-head">
                                  <span className="party-visit-date">
                                    <Calendar size={12} />
                                    {v.duty_Date ? moment(v.duty_Date).format("DD MMM YYYY") : "-"}
                                  </span>
                                  <span className="party-visit-time">
                                    {formatTime(v.visit_FromTime)} - {formatTime(v.visit_ToTime)}
                                  </span>
                                  {v.location ? (
                                    <span className="party-visit-loc">
                                      <MapPin size={11} />
                                      {v.location}
                                    </span>
                                  ) : null}
                                  {v.projects ? (
                                    <span className="party-visit-proj">{v.projects}</span>
                                  ) : null}
                                </div>

                                {v.remarks ? (
                                  <div className="party-visit-remarks">
                                    <strong>Visit remarks:</strong> {v.remarks}
                                  </div>
                                ) : null}

                                {fups.length > 0 ? (
                                  <div className="party-followups">
                                    {fups.map((f, fi) => (
                                      <div className="party-followup" key={f.feedbackId || fi}>
                                        <span className="party-followup-date">
                                          {f.followupDate ? moment(f.followupDate).format("DD MMM YYYY") : "No date"}
                                        </span>
                                        <div className="party-followup-body">
                                          {f.courses.length > 0 ? (
                                            <div className="party-followup-courses">
                                              {f.courses.map((cn) => {
                                                const cc = f.courseData[cn] || emptyCourseFeedback();
                                                const bits = [
                                                  cc.count1 ? `${cc.count1} nos` : "",
                                                  cc.eventRequirements.length > 0 ? cc.eventRequirements.join(", ") : "",
                                                  cc.eventDate
                                                    ? (cc.eventToDate
                                                        ? `${moment(cc.eventDate).format("DD/MM/YY")}-${moment(cc.eventToDate).format("DD/MM/YY")}`
                                                        : moment(cc.eventDate).format("DD/MM/YY"))
                                                    : "",
                                                ].filter(Boolean).join(" · ");
                                                return (
                                                  <div className="party-course" key={cn}>
                                                    <span className="party-course-name">{cn}</span>
                                                    {bits ? <span className="party-course-bits">{bits}</span> : null}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          ) : (
                                            <div className="party-course-bits">No courses recorded</div>
                                          )}
                                          {f.clientRemarks ? (
                                            <div className="party-followup-remarks">{f.clientRemarks}</div>
                                          ) : null}
                                          {(f.nextFollowupDate || f.nextVisitDate) && (
                                            <div className="party-followup-next">
                                              {f.nextFollowupDate ? `Next followup ${moment(f.nextFollowupDate).format("DD MMM YY")}` : ""}
                                              {f.nextFollowupDate && f.nextVisitDate ? " · " : ""}
                                              {f.nextVisitDate ? `Next visit ${moment(f.nextVisitDate).format("DD MMM YY")}` : ""}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="party-no-followup">No feedback recorded for this visit yet.</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: "center", padding: "30px 16px", color: "#64748b", background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>No parties in the current filter.</p>
                </div>
              )}
            </div>
          ) :

          viewMode === "pending" || viewMode === "followups" ? (
            <div className="visits-cards-grid">
              {visibleOrdered.length > 0 ? (
                visitGroups.map((group, gIndex) => {
                  const grouped = section === "followups";
                  const folded = grouped && !openGroups[group.client];

                  // The tab decides which COLLEGES are listed. What is
                  // inside one is the college - all of its visits, calls
                  // and follow-ups. group.visits is only the slice that
                  // matched the tab, so a college with one unassigned
                  // visit opened to a timeline of one visit and claimed
                  // "1 visit" in its header, with six others and their
                  // history simply missing.
                  const collegeVisits = grouped
                    ? allVisitsOfClient(group.client)
                    : group.visits;

                  return (
                    <div
                      className={`visit-party-group ${grouped ? "" : "plain"}`}
                      key={`${group.client}__${gIndex}`}
                    >
                    {/* The college, once, with its visits inside it.
                        Feedback skips this entirely - there the list is
                        by date and a party heading would be noise. */}
                    {grouped && (() => {
                      const gKey = `grp:${group.client}`;
                      // The whole college, not the tab's slice of it.
                      const allOfIt = collegeVisits;
                      const gLeft = allOfIt.length > 0 && allOfIt.every((gv) => isLeft(gv));
                      const gBusy = !!leftSaving[gKey];
                      const gErr = leftError[gKey];
                      const gDrafting = Object.prototype.hasOwnProperty.call(leftDraft, gKey);
                      const gReason = leftDraft[gKey] ?? "";
                      const closeG = () =>
                        setLeftDraft((prev) => {
                          const next = { ...prev };
                          delete next[gKey];
                          return next;
                        });
                      return (
                      <>
                      <div className={`visit-party-head ${folded ? "folded" : ""}`}>
                        <button
                          type="button"
                          className="visit-party-toggle"
                          onClick={() => toggleGroup(group.client)}
                        >
                        {/* Position in the list as it is currently
                            sorted, so "the fourth one down" is something
                            you can say out loud. */}
                        <span className="visit-party-no">{gIndex + 1}</span>
                        <Building2 size={15} />
                        <span className="visit-party-head-name">{group.client}</span>
                        </button>

                        {(() => {
                          const st = groupStats(collegeVisits);
                          return (
                            <span className="visit-party-stats">
                              <button
                                type="button"
                                className={`vps vps-btn ${
                                  (ctView[group.client] || "all") === "visits" ? "on" : ""
                                }`}
                                onClick={() => setCollegeView(group.client, "visits")}
                                title="Show only the visits"
                              >
                                {collegeVisits.length} {collegeVisits.length === 1 ? "visit" : "visits"}
                              </button>
                              <button
                                type="button"
                                className={`vps vps-btn ${
                                  (ctView[group.client] || "all") === "followups" ? "on" : ""
                                }`}
                                onClick={() => setCollegeView(group.client, "followups")}
                                title="Show only the follow-ups"
                              >
                                <BookOpen size={11} />
                                {st.followups}
                              </button>
                              <button
                                type="button"
                                className={`vps vps-btn ${showVisitors[group.client] ? "on" : ""}`}
                                onClick={() =>
                                  setShowVisitors((p) => ({
                                    ...p,
                                    [group.client]: !p[group.client],
                                  }))
                                }
                                title={
                                  showVisitors[group.client]
                                    ? "Hide who went on each visit"
                                    : "Our people who have visited - click to show them per visit"
                                }
                              >
                                <UserCheck size={11} />
                                {st.people}
                              </button>
                              <button
                                type="button"
                                className={`vps vps-btn ${
                                  (ctView[group.client] || "all") === "contacts" ? "on" : ""
                                }`}
                                onClick={() => setCollegeView(group.client, "contacts")}
                                title="List the people met at this college"
                              >
                                <User size={11} />
                                {st.contacts}
                              </button>
                            </span>
                          );
                        })()}

                        {/* Who is chasing this college. The list is the
                            people who have actually been there - picking
                            a follow-up owner from the whole employee
                            table would let you assign a college to
                            somebody who has never met them. */}
                        {(() => {
                          const whole = collegeVisits;
                          const owner = groupOwnerOf(whole);
                          const people = visitorsOf(whole);
                          const busy = !!followupBySaving[`grp:${group.client}`];
                          const openList = assignFor === group.client;
                          return (
                            <div className="assign-wrap">
                              <button
                                type="button"
                                className={`assign-btn ${owner ? "on" : ""}`}
                                disabled={busy}
                                onClick={(e) => {
                                  if (openList) {
                                    setAssignFor(null);
                                    return;
                                  }
                                  openAssignAt(e.currentTarget as HTMLElement);
                                  setAssignFor(group.client);
                                }}
                                title={
                                  owner
                                    ? `Being followed up by ${
                                        people.find((pp) => pp.code === owner)?.label || owner
                                      }`
                                    : "Put someone on this college"
                                }
                              >
                                <UserCheck size={11} />
                                <span>
                                  {busy
                                    ? "Saving..."
                                    : owner
                                      ? // The name if we have it, since a bare
                                        // code answers "who" only for someone
                                        // who already knows the codes.
                                        (people.find((pp) => pp.code === owner)?.label || owner)
                                          .split("-")
                                          .slice(1)
                                          .join("-")
                                          .trim()
                                          .split(" ")[0] || owner
                                      : "Assign"}
                                </span>
                              </button>

                              {openList && createPortal(
                                <div
                                  className="assign-pop"
                                  style={{
                                    top: assignAt.top,
                                    bottom: assignAt.bottom,
                                    right: assignAt.right,
                                  }}
                                >
                                  {people.length === 0 ? (
                                    <div className="assign-none">
                                      No employee is recorded on these visits.
                                    </div>
                                  ) : (
                                    people.map((pp) => (
                                      <button
                                        type="button"
                                        key={pp.code}
                                        className={`assign-opt ${owner === pp.code ? "on" : ""}`}
                                        onClick={() => {
                                          void assignGroupOwner(
                                            group.client,
                                            whole,
                                            pp.code,
                                            owner === pp.code
                                          );
                                          setAssignFor(null);
                                        }}
                                        title={
                                          owner === pp.code
                                            ? "Take them off it"
                                            : `Put ${pp.label} on this college`
                                        }
                                      >
                                        {owner === pp.code ? (
                                          <Check size={12} />
                                        ) : (
                                          <User size={12} />
                                        )}
                                        <span className="assign-opt-name">{pp.label}</span>
                                      </button>
                                    ))
                                  )}
                                </div>,
                                document.body
                              )}

                              {/* Was absolutely positioned under the
                                  button, where it could sit behind the
                                  row below it - an assign that failed
                                  looked exactly like one that did
                                  nothing. It is a strip under the header
                                  now. */}
                              {followupByError[`grp:${group.client}`] && (
                                <div className="assign-err">
                                  {followupByError[`grp:${group.client}`]}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Not chasing this college. Asked once, here,
                            because it is a decision about the party -
                            thirteen identical chips down the timeline
                            were thirteen ways to say the same thing. */}
                        {gLeft ? (
                          <button
                            type="button"
                            className="visit-left-undo"
                            disabled={gBusy}
                            onClick={() => saveGroupFollowupStatus(group.client, allOfIt, false)}
                          >
                            <Lock size={11} />
                            <span>{gBusy ? "Saving..." : "Ignored - put back"}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={`employee-chip visit-meta-chip emp-not-needed ${gDrafting ? "open" : ""}`}
                            disabled={gBusy}
                            onClick={() =>
                              setLeftDraft((prev) => {
                                const next = { ...prev };
                                if (Object.prototype.hasOwnProperty.call(next, gKey)) delete next[gKey];
                                else next[gKey] = "";
                                return next;
                              })
                            }
                            title={gDrafting ? "Cancel" : "Leave this college out - no follow-up needed"}
                          >
                            <X size={10} />
                            <span>Ignore</span>
                          </button>
                        )}

                        <button
                          type="button"
                          className="visit-party-chev-btn"
                          onClick={() => toggleGroup(group.client)}
                          title={folded ? "Show" : "Hide"}
                        >
                          <ChevronDown
                            size={15}
                            className="visit-party-head-chev"
                            style={folded ? { transform: "rotate(-90deg)" } : undefined}
                          />
                        </button>
                      </div>

                      {gDrafting && !gLeft && (
                        <div className="visit-party-reason">
                          <div className={`visit-call-inline-field ${gBusy ? "busy" : ""}`}>
                            <X size={13} className="visit-call-inline-icon" />
                            <input
                              type="text"
                              value={gReason}
                              disabled={gBusy}
                              placeholder={`Why is no follow-up needed for ${group.client}?`}
                              onChange={(e) =>
                                setLeftDraft((prev) => ({ ...prev, [gKey]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !gBusy && gReason.trim()) {
                                  void saveGroupFollowupStatus(group.client, allOfIt, true, gReason);
                                  closeG();
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="visit-call-inline-save"
                              disabled={gBusy || !gReason.trim()}
                              title="Mark this college as not needed"
                              onClick={() => {
                                void saveGroupFollowupStatus(group.client, allOfIt, true, gReason);
                                closeG();
                              }}
                            >
                              <Check size={14} />
                            </button>
                          </div>
                        </div>
                      )}

                      {gErr && <div className="visit-party-reason-error">{gErr}</div>}
                      </>
                      );
                    })()}

                    {/* The one thing you come here to DO, and the form
                        it opens, both above the timeline - not inside it,
                        where the scroll box would carry them off as soon
                        as the history was longer than the screen. */}
                    {grouped && !folded && (() => {
                      const aKey = getVisitKey(newestVisitOf(collegeVisits));
                      const open = getRowFeedback(aKey).draftOpen;
                      return (
                        <div className="ct-add-row">
                          <button
                            type="button"
                            className="ct-add"
                            onClick={() => {
                              setOpenFeedback((p) => ({ ...p, [aKey]: true }));
                              openDraft(aKey);
                            }}
                            disabled={open}
                          >
                            <Plus size={13} />
                            <span>{open ? "Writing a follow-up" : "Add follow-up"}</span>
                          </button>

                          <button
                            type="button"
                            className="ct-sort"
                            onClick={() =>
                              setCtSort((p) => ({
                                ...p,
                                [group.client]: (p[group.client] ?? "desc") === "desc" ? "asc" : "desc",
                              }))
                            }
                            title="Turn this timeline around"
                          >
                            <Calendar size={12} />
                            <span>
                              {(ctSort[group.client] ?? "desc") === "desc"
                                ? "Newest first"
                                : "Oldest first"}
                            </span>
                          </button>
                        </div>
                      );
                    })()}

                    {/* Grouped, the one card left is a shell whose only
                        content is the follow-up editor - every other part
                        of it is drawn on the timeline above. With nothing
                        being written it rendered as an empty white strip
                        under the college, so it is not drawn at all until
                        the editor is open. */}
                    {!folded &&
                      (!grouped ||
                        getRowFeedback(getVisitKey(newestVisitOf(collegeVisits))).draftOpen) && (
                    <div className="visit-party-visits">
                    {(grouped
                      ? [newestVisitOf(collegeVisits)]
                      : group.visits
                    ).map((item, index) => {
                  // Position in the whole list, not in this group: in
                  // Feedback the groups are invisible, so restarting at 1
                  // inside each made every card read "#1".
                  const cardNo = grouped
                    ? index + 1
                    : visibleOrdered.indexOf(item) + 1;
                  const visitKey = getVisitKey(item, index);
                  const rowFeedback = getRowFeedback(visitKey);

                  // A follow-up is the college's, not the visit's. Three
                  // visits to one college did not create three follow-up
                  // threads - the same person is being chased about the
                  // same thing. So the block is drawn once, on the last
                  // (newest) visit, and anything saved there attaches to
                  // it.
                  const isFollowupAnchor = true;

                  // ...and it shows every follow-up the college has,
                  // whichever visit it was recorded against, each still
                  // editable where it was written.
                  const historyFollowups = grouped
                    ? []
                    : rowFeedback.followups.map((f) => ({
                        ...f,
                        ownerVisitKey: visitKey,
                        ownerVisitDate: item?.duty_Date,
                      }));

                  return (
                    <div
                      className="tasks-premium-card visit-grid-card"
                      key={visitKey}
                      style={{ animationDelay: `${index * 0.02}s` }}
                    >
                      {/* Card Top Header */}
                      {!grouped && (
                      <div className="task-card-header">
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <div className="tid-badge">
                            #{cardNo}
                          </div>
                          {item.projects && (
                            <span className="project-chip">
                              {item.projects}
                            </span>
                          )}
                          {(item.visit_FromTime || item.visit_ToTime) && (
                            <span
                              className="visit-time-chip"
                              style={{
                                color: "#64748b",
                                background: "#f1f5f9",
                                fontWeight: 600,
                              }}
                            >
                              <Clock size={12} />
                              <span>{formatTime(item.visit_FromTime)} - {formatTime(item.visit_ToTime)}</span>
                            </span>
                          )}
                        </div>

                        <div
                          className="visit-date-chip"
                          style={{
                            fontWeight: 700,
                            color: "var(--stock-accent, #45599b)",
                            background: "#eef2ff",
                            flexShrink: 0,
                          }}
                        >
                          <Calendar size={12} />
                          <span>{formatDate(item.duty_Date)}</span>
                        </div>
                      </div>
                      )}

                      {/* Card Body */}
                      <div className="card-body" style={{ padding: 0 }}>
                        
                        {/* Client Title. Printed on the group header
                            when grouped, so repeating it on all thirteen
                            cards underneath only pushed the working part
                            of each one further down. */}
                        {section !== "followups" && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", margin: "2px 0 4px" }}>
                          <Building2 size={16} style={{ color: "var(--ion-color-primary, #3b82f6)", flexShrink: 0 }} />
                          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#1e293b", lineHeight: 1.25 }}>
                            {item.client_Name}
                          </h3>
                        </div>
                        )}

                        {!grouped && (<>
                        {/* One line of context: where, who, their number,
                            what happened, and who went. Three stacked rows
                            for this pushed the part people actually work in
                            below the fold. */}
                        <div className="visit-meta-line">
                          <span className="visit-meta-bit">
                            <MapPin size={12} style={{ color: "#ef4444", flexShrink: 0 }} />
                            <span className="visit-meta-val">{item.location || "-"}</span>
                          </span>

                          <span className="visit-meta-bit">
                            <User size={12} style={{ color: "#3b82f6", flexShrink: 0 }} />
                            <span className="visit-meta-val">{item.contact_Person || "-"}</span>
                          </span>

                          <span className="visit-meta-bit">
                            {renderMobileWithCall(item.mobile_Number, {
                              type: "visit",
                              client: item.client_Name,
                              contactPerson: item.contact_Person,
                              project: item.projects,
                            })}
                          </span>

                          {item.remarks ? (
                            <span className="visit-meta-remarks" title={item.remarks}>
                              {item.remarks}
                            </span>
                          ) : null}

                          {(item.employees || viewMode === "followups") ? (
                            <span className="visit-meta-emps">
                              {String(item.employees || "").split(",").filter((e) => e.trim()).map((emp, i) => {
                                const code = empCodeOf(emp);
                                const vid = String(Number(item.visit_ID || item.Visit_ID || 0));
                                const owner = followupBy[vid] ?? "";
                                const isOwner = Boolean(code) && owner === code;
                                // Unowned: anyone on the duty can pick it up.
                                // Owned: only the owner can hand it on.
                                const canChange = isFollowupAdmin || !owner || owner === currentEmpCode;
                                return (
                                  <button
                                    type="button"
                                    key={i}
                                    className={`employee-chip visit-meta-chip emp-pick ${isOwner ? "owner" : ""} ${canChange ? "" : "fixed"}`}
                                    disabled={followupBySaving[vid] || !canChange}
                                    onClick={() => setVisitFollowupBy(item, code)}
                                    title={
                                      !canChange
                                        ? "Only the person following this up can reassign it"
                                        : isOwner
                                        ? "Following up - click to clear"
                                        : `Make ${emp.trim()} the follow-up owner`
                                    }
                                  >
                                    {isOwner && <UserCheck size={10} />}
                                    <span>{emp.trim()}</span>
                                  </button>
                                );
                              })}
                              {/* Not assigning is a choice among these
                                  names, so it sits with them and looks
                                  like them - red, because it is the one
                                  that takes the visit out of the list.
                                  Followups only: Feedback has nobody to
                                  assign. */}
                              {viewMode === "followups" && !isLeft(item) && (() => {
                                const vId = Number(item?.visit_ID ?? item?.Visit_ID ?? 0);
                                const vKey = String(vId);
                                const drafting = Object.prototype.hasOwnProperty.call(leftDraft, vKey);
                                return (
                                  <button
                                    type="button"
                                    className={`employee-chip visit-meta-chip emp-not-needed ${drafting ? "open" : ""}`}
                                    disabled={!vId || !!leftSaving[vKey]}
                                    onClick={() =>
                                      setLeftDraft((prev) => {
                                        const next = { ...prev };
                                        if (Object.prototype.hasOwnProperty.call(next, vKey)) {
                                          delete next[vKey];
                                        } else {
                                          next[vKey] = "";
                                        }
                                        return next;
                                      })
                                    }
                                    title={drafting ? "Cancel" : "Nobody is taking this one"}
                                  >
                                    <X size={10} />
                                    <span>Not needed</span>
                                  </button>
                                );
                              })()}
                              {followupByError[String(Number(item.visit_ID || item.Visit_ID || 0))] && (
                                <span className="emp-pick-error">
                                  {followupByError[String(Number(item.visit_ID || item.Visit_ID || 0))]}
                                </span>
                              )}
                            </span>
                          ) : null}
                        </div>

                        </>)}

                        {/* Feedback Pending is one job - record the call -
                            so it gets one line: type what they said, press
                            the tick. No section to open, no button to reveal
                            the field, no date to fill in. The visit details
                            above are the record; this is the only thing
                            being added to it. */}
                        {viewMode === "pending" && canPostFeedback && !feedbackCallOf(item) && (() => {
                          const vId = Number(item?.visit_ID ?? item?.Visit_ID ?? 0);
                          const vKey = String(vId);
                          const busy = !!callSaving[vKey];
                          const err = callError[vKey];
                          const text = callDraft[vKey]?.remarks ?? "";
                          const ready = !!vId && !busy && text.trim().length > 0;
                          return (
                            <div className="visit-call-inline">
                              <div className={`visit-call-inline-field ${busy ? "busy" : ""}`}>
                                <Phone size={13} className="visit-call-inline-icon" />
                                <input
                                  type="text"
                                  value={text}
                                  disabled={busy || !vId}
                                  placeholder="Feedback call - what did they say?"
                                  onChange={(e) => setCallRemarks(vId, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && ready) saveFeedbackCall(vId);
                                  }}
                                />
                                <button
                                  type="button"
                                  className="visit-call-inline-save"
                                  disabled={!ready}
                                  title="Save this feedback call"
                                  onClick={() => saveFeedbackCall(vId)}
                                >
                                  {busy ? <Clock size={14} /> : <Check size={14} />}
                                </button>
                              </div>
                              {err && <div className="visit-call-inline-error">{err}</div>}
                            </div>
                          );
                        })()}

                        {/* ── Feedback & Event Planning Box ── */}
                        {/* Writing a visit off, and taking it back.
                            Followups only - Feedback is about a call that
                            either happened or did not, and has no third
                            state to park anything in. */}
                        {viewMode === "followups" && (() => {
                          const vId = Number(item?.visit_ID ?? item?.Visit_ID ?? 0);
                          const vKey = String(vId);
                          const busy = !!leftSaving[vKey];
                          const err = leftError[vKey];
                          const left = isLeft(item);
                          const detail = left ? leftDetailOf(item) : null;
                          const drafting = Object.prototype.hasOwnProperty.call(leftDraft, vKey);

                          if (left) {
                            return (
                              <div className="visit-left-strip">
                                <Lock size={12} />
                                <span className="visit-left-label">Not needed</span>
                                {detail?.by && (
                                  <span className="visit-left-meta">by {detail.by}</span>
                                )}
                                {detail?.on && (
                                  <span className="visit-left-meta">
                                    {moment(detail.on).format("DD MMM YY")}
                                  </span>
                                )}
                                {detail?.note && (
                                  <span className="visit-left-note" title={detail.note}>
                                    {detail.note}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="visit-left-undo"
                                  disabled={busy || !vId}
                                  onClick={() => saveFollowupStatus(vId, false)}
                                >
                                  {busy ? "Saving..." : "Put back"}
                                </button>
                                {err && <span className="visit-left-error">{err}</span>}
                              </div>
                            );
                          }

                          // The way in is the red chip beside the names.
                          // Until it is pressed there is nothing to show
                          // here but an error, if one came back.
                          if (!drafting) {
                            return err ? (
                              <div className="visit-left-strip ghost">
                                <span className="visit-left-error">{err}</span>
                              </div>
                            ) : null;
                          }

                          const reason = leftDraft[vKey] ?? "";
                          return (
                            <div className="visit-call-inline">
                              <div className={`visit-call-inline-field ${busy ? "busy" : ""}`}>
                                <X size={13} className="visit-call-inline-icon" />
                                <input
                                  type="text"
                                  value={reason}
                                  disabled={busy}
                                  placeholder="Reason for not assigning this visit"
                                  onChange={(e) =>
                                    setLeftDraft((prev) => ({ ...prev, [vKey]: e.target.value }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !busy && reason.trim()) {
                                      void saveFollowupStatus(vId, true, reason);
                                      setLeftDraft((prev) => {
                                        const next = { ...prev };
                                        delete next[vKey];
                                        return next;
                                      });
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  className="visit-call-inline-save"
                                  disabled={busy || !reason.trim()}
                                  title="Mark as not needed"
                                  onClick={() => {
                                    void saveFollowupStatus(vId, true, reason);
                                    setLeftDraft((prev) => {
                                      const next = { ...prev };
                                      delete next[vKey];
                                      return next;
                                    });
                                  }}
                                >
                                  <Check size={14} />
                                </button>
                              </div>
                              {err && <div className="visit-call-inline-error">{err}</div>}
                            </div>
                          );
                        })()}

                        {/* The CALL for THIS visit, wherever the card is
                            shown. It sat inside the follow-up accordion,
                            which Feedback does not draw - so Completed
                            would have been a list of calls with the calls
                            invisible. */}
                        {(() => {
                          const call = feedbackCallOf(item);
                          if (!call) return null;
                          // Nothing was said on a call nobody made.
                          if (String(call.by || "").toUpperCase() === "BULK") return null;
                          return (
                            <div className="visit-call-detail">
                              <div className="visit-call-detail-head">
                                <Phone size={12} />
                                <span className="visit-call-detail-when">
                                  {moment(call.on).format("DD MMM YYYY, HH:mm")}
                                </span>
                                {call.by && (
                                  <span className="visit-call-detail-by">by {call.by}</span>
                                )}
                              </div>
                              <div
                                className={`visit-call-detail-remarks ${
                                  call.remarks ? "" : "none"
                                }`}
                              >
                                {call.remarks || "No remarks noted on the call"}
                              </div>
                            </div>
                          );
                        })()}

                        {viewMode !== "pending" &&
                          isFollowupAnchor &&
                          (!grouped || rowFeedback.draftOpen) && (
                        <div className={`visit-card-feedback-box ${grouped ? "bare" : ""}`}>
                          {!grouped && (
                          <button
                            type="button"
                            className="visit-card-feedback-header"
                            onClick={() => toggleFeedbackBox(visitKey)}
                          >
                            {/* The section is named after what the view is
                                for. "Feedback & Event Details" covered both
                                a call and its follow-ups, which is exactly
                                the conflation that made the pending count
                                meaningless. */}
                            {viewMode === "pending" ? (
                              <Phone size={13} style={{ color: "#2563eb" }} />
                            ) : (
                              <BookOpen size={13} style={{ color: "var(--stock-accent, #45599b)" }} />
                            )}
                            <span>
                              {viewMode === "pending"
                                ? "Visit feedback"
                                : viewMode === "followups"
                                  ? "Follow-ups"
                                  : "Feedback & follow-ups"}
                            </span>

                            {/* The badge counts whatever the section is
                                about: the call is one or none, follow-ups
                                are however many there are. */}
                            {viewMode === "pending"
                              ? feedbackCallOf(item) && (
                                  <span className="visit-feedback-badge">1</span>
                                )
                              : historyFollowups.length > 0 && (
                                  <span className="visit-feedback-badge">
                                    {historyFollowups.length}
                                  </span>
                                )}
                            <ChevronDown
                              size={14}
                              className="visit-feedback-chev"
                              style={openFeedback[visitKey] ? { transform: "rotate(180deg)" } : undefined}
                            />
                          </button>
                          )}

                          {(grouped || openFeedback[visitKey]) && (
                          <>

                          {/* Follow-ups already recorded against this visit.
                              Read-only here - click one to reopen it if it
                              needs correcting, rather than editing in place
                              and risking the history being rewritten.
                              Hidden in Feedback Pending: that view is about
                              the call, and showing both put the same remark
                              on screen twice. */}
                          {viewMode !== "pending" && historyFollowups.length > 0 && (
                            <div className="visit-followup-history">
                              {historyFollowups.map((f: any, fi: number) => (
                                <button
                                  type="button"
                                  key={f.feedbackId || fi}
                                  className={`visit-followup-row ${isEditableToday(f) ? "" : "locked"}`}
                                  onClick={() => openDraft(f.ownerVisitKey || visitKey, f)}
                                  disabled={!isEditableToday(f)}
                                  title={
                                    isEditableToday(f)
                                      ? "Reopen this follow-up"
                                      : "Recorded on an earlier day - add a new follow-up instead"
                                  }
                                >
                                  <span className="visit-followup-date">
                                    {f.followupDate ? moment(f.followupDate).format("DD MMM YYYY") : "No date"}
                                  </span>
                                  {section === "followups" && f.ownerVisitDate && (
                                    <span
                                      className="visit-followup-src"
                                      title="The visit this follow-up was recorded against"
                                    >
                                      {moment(f.ownerVisitDate).format("DD/MM/YY")} visit
                                    </span>
                                  )}
                                  <span
                                    className="visit-followup-courses"
                                    title={f.courses.map((cn) => courseSummaryLine(cn, f.courseData[cn])).join(", ")}
                                  >
                                    {f.courses.length > 0
                                      ? f.courses
                                          .map((cn) => courseSummaryLine(cn, f.courseData[cn]))
                                          .join(", ")
                                      : "No courses"}
                                  </span>
                                  <span className="visit-followup-remarks" title={f.clientRemarks}>
                                    {[
                                      // A follow-up created from the visit's own
                                      // note carries the same text, so the card
                                      // printed it twice - once as the visit
                                      // remark above, once here. Same words, same
                                      // visit, no new information: show it once.
                                      String(f.clientRemarks || "").trim() ===
                                      String(item?.remarks || "").trim()
                                        ? ""
                                        : f.clientRemarks,
                                      f.nextFollowupDate ? `next f/u ${moment(f.nextFollowupDate).format("DD/MM/YY")}` : "",
                                      f.nextVisitDate ? `next visit ${moment(f.nextVisitDate).format("DD/MM/YY")}` : "",
                                    ].filter(Boolean).join(" · ")}
                                  </span>
                                  {isEditableToday(f) ? (
                                    <Edit3 size={12} className="visit-followup-edit" />
                                  ) : (
                                    <Lock size={11} className="visit-followup-lock" />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}

                          {!rowFeedback.draftOpen && (() => {
                            const vId = Number(item?.visit_ID ?? item?.Visit_ID ?? 0);
                            const vKey = String(vId);
                            const call = feedbackCallOf(item);
                            const draft = callDraft[vKey];
                            const busy = !!callSaving[vKey];
                            const err = callError[vKey];

                            return (
                              <>
                                <div className="visit-action-row">
                                  {/* Each view offers the one action it is
                                      about: Feedback Pending is a list of
                                      calls to make, All Follow-ups a list of
                                      visits to chase. Cards shows both,
                                      because it is the whole picture. */}
                                  {viewMode !== "followups" && (call ? (
                                    <button
                                      type="button"
                                      className="visit-call-done"
                                      title={`Called by ${call.by || "-"}${call.remarks ? ` - ${call.remarks}` : ""}`}
                                      onClick={() => openCallDraft(vId, call.on, call.remarks)}
                                    >
                                      <CheckCircle2 size={14} />
                                      <span>
                                        Feedback called {moment(call.on).format("DD MMM, HH:mm")}
                                      </span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="visit-call-add"
                                      disabled={!vId}
                                      onClick={() => openCallDraft(vId)}
                                    >
                                      <Phone size={14} />
                                      <span>Add visit feedback</span>
                                    </button>
                                  ))}

                                  {viewMode !== "pending" && (
                                    <button
                                      type="button"
                                      className="visit-followup-add"
                                      onClick={() => openDraft(visitKey)}
                                    >
                                      <Plus size={14} />
                                      <span>
                                        {historyFollowups.length > 0 ? "Add follow-up" : "Add first follow-up"}
                                      </span>
                                    </button>
                                  )}
                                </div>

                                {draft && (
                                  <div className="visit-call-draft">
                                    <div className="visit-call-row">
                                      <label>
                                        <Clock size={12} /> Call made on
                                      </label>
                                      <input
                                        type="datetime-local"
                                        value={draft.on}
                                        onChange={(e) =>
                                          setCallDraft((p) => ({
                                            ...p,
                                            [vKey]: { ...p[vKey], on: e.target.value },
                                          }))
                                        }
                                      />
                                    </div>

                                    <input
                                      className="visit-call-remarks"
                                      placeholder="What did they say on the call?"
                                      value={draft.remarks}
                                      onChange={(e) =>
                                        setCallDraft((p) => ({
                                          ...p,
                                          [vKey]: { ...p[vKey], remarks: e.target.value },
                                        }))
                                      }
                                    />

                                    {err && <div className="visit-call-error">{err}</div>}

                                    <div className="visit-call-acts">
                                      <button
                                        type="button"
                                        className="visit-call-cancel"
                                        disabled={busy}
                                        onClick={() => closeCallDraft(vId)}
                                      >
                                        Cancel
                                      </button>
                                      {call && (
                                        <button
                                          type="button"
                                          className="visit-call-clear"
                                          disabled={busy}
                                          onClick={() => saveFeedbackCall(vId, true)}
                                        >
                                          Clear
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        className="visit-call-save"
                                        disabled={busy || !draft.on}
                                        onClick={() => saveFeedbackCall(vId)}
                                      >
                                        {busy ? "Saving..." : "Save call"}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}

                          {rowFeedback.draftOpen && (
                          <>
                          {saveErrors[visitKey] && (
                            <div className="visit-save-error">{saveErrors[visitKey]}</div>
                          )}

                          <div className="visit-draft-banner">
                            <span>
                              {rowFeedback.editingId
                                ? "Editing a saved follow-up"
                                : "New follow-up"}
                            </span>
                            <button
                              type="button"
                              className="visit-draft-cancel"
                              onClick={() => closeDraft(visitKey)}
                            >
                              <X size={12} />
                              <span>Cancel</span>
                            </button>
                          </div>

                          <div className="visit-feedback-head">
                            <div className="visit-grid-input-group" style={{ flex: "1 1 0", minWidth: 0 }}>
                              <label>Next Followup</label>
                              <input
                                type="date"
                                className="visit-table-input"
                                value={rowFeedback.nextFollowupDate}
                                onChange={(e) => updateFeedbackField(visitKey, "nextFollowupDate", e.target.value, item)}
                              />
                            </div>

                            <div className="visit-grid-input-group" style={{ flex: "1 1 0", minWidth: 0 }}>
                              <label>Next Visit</label>
                              <input
                                type="date"
                                className="visit-table-input"
                                value={rowFeedback.nextVisitDate}
                                onChange={(e) => updateFeedbackField(visitKey, "nextVisitDate", e.target.value, item)}
                              />
                            </div>
                          </div>

                          {rowFeedback.courses.length === 0 ? (
                            /* The strip that explained there was nothing
                               here is now the thing that fixes it. A
                               message telling you to use a control, next
                               to that control, is a row of the form spent
                               on instructions. */
                            <button
                              type="button"
                              className="visit-course-empty"
                              onClick={() =>
                                setCoursesModal({
                                  open: true,
                                  visitKey,
                                  clientName: item.client_Name,
                                })
                              }
                            >
                              <Plus size={14} />
                              <span>Add courses to record counts, event requirements and dates</span>
                            </button>
                          ) : (
                            <div className="visit-course-rows">
                              <div className="visit-course-row visit-course-row-head">
                                <span>Course</span>
                                <span>Count</span>
                                <span>Event Req</span>
                                <span>Event Date</span>
                              </div>

                              {rowFeedback.courses.map((courseName) => {
                                const cf = rowFeedback.courseData[courseName] || emptyCourseFeedback();
                                return (
                                  <div className="visit-course-row" key={courseName}>
                                    {/* Was plain text while everything
                                        beside it was a control, so the
                                        one column you might want to
                                        change looked like the one you
                                        could not. Opens the same course
                                        picker as the field above. */}
                                    <button
                                      type="button"
                                      className="visit-multiselect-trigger"
                                      onClick={() =>
                                        setCoursesModal({
                                          open: true,
                                          visitKey,
                                          clientName: item.client_Name,
                                        })
                                      }
                                      title={`${courseName} - click to change the courses`}
                                    >
                                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>
                                        {courseName}
                                      </span>
                                      <ChevronDown size={13} style={{ color: "#9ca3af" }} />
                                    </button>

                                    <input
                                      type="number"
                                      min="0"
                                      placeholder="Count"
                                      className="visit-table-input"
                                      style={{ textAlign: "center" }}
                                      value={cf.count1}
                                      onChange={(e) => updateCourseField(visitKey, courseName, "count1", e.target.value, item)}
                                    />

                                    <button
                                      type="button"
                                      className="visit-multiselect-trigger"
                                      onClick={() => setEventsModal({ open: true, visitKey, courseName, clientName: item.client_Name })}
                                      title={`Event requirements for ${courseName}`}
                                    >
                                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {cf.eventRequirements.length > 0 ? cf.eventRequirements.join(", ") : "Select Events"}
                                      </span>
                                      {cf.eventRequirements.length > 0 ? (
                                        <span className="visit-selected-badge">{cf.eventRequirements.length}</span>
                                      ) : (
                                        <ChevronDown size={13} style={{ color: "#9ca3af" }} />
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      className="visit-multiselect-trigger"
                                      onClick={() => setEventDateModal({ open: true, visitKey, courseName, clientName: item.client_Name })}
                                      title={`Event dates for ${courseName}`}
                                    >
                                      <div style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden" }}>
                                        <Calendar size={13} style={{ color: "#64748b", flexShrink: 0 }} />
                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                          {cf.eventDate && cf.eventToDate
                                            ? `${moment(cf.eventDate).format("DD/MM/YY")}-${moment(cf.eventToDate).format("DD/MM/YY")}`
                                            : cf.eventDate
                                            ? moment(cf.eventDate).format("DD/MM/YY")
                                            : cf.eventToDate
                                            ? `To:${moment(cf.eventToDate).format("DD/MM/YY")}`
                                            : "Select Date"}
                                        </span>
                                      </div>
                                      {!cf.eventDate && !cf.eventToDate && (
                                        <ChevronDown size={13} style={{ color: "#9ca3af" }} />
                                      )}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Remarks and Save on one line. "Unsaved" is
                              gone: an enabled Save button already says
                              that, and a permanent warning next to every
                              empty form is just noise. */}
                          <div className="visit-form-foot">
                            <div className="visit-grid-input-group" style={{ flex: "1 1 auto", minWidth: 0 }}>
                              <label>Client Remarks</label>
                              <input
                                type="text"
                                placeholder="What did they say?"
                                className="visit-table-input"
                                value={rowFeedback.clientRemarks}
                                onChange={(e) => updateFeedbackField(visitKey, "clientRemarks", e.target.value, item)}
                              />
                            </div>

                            <div className="visit-form-foot-acts">
                              <button
                                type="button"
                                className={`visit-save-btn ${rowFeedback.saved ? "saved" : ""}`}
                                onClick={() => handleSaveRowFeedback(visitKey, item)}
                                disabled={savingRows[visitKey]}
                                title="Save visit feedback"
                              >
                                {savingRows[visitKey] ? (
                                  <span>Saving...</span>
                                ) : rowFeedback.saved ? (
                                  <>
                                    <Check size={13} />
                                    <span>Saved</span>
                                  </>
                                ) : (
                                  <>
                                    <Save size={13} />
                                    <span>Save</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                          </>
                          )}
                          </>
                          )}

                        </div>
                        )}

                      </div>
                    </div>
                  );
                    })}
                    </div>
                    )}

                    {grouped && !folded && (
                      <div className="ct">
                        {/* Contacts is a different question - who, not
                            when - so it answers with a list rather than
                            with a filtered timeline. */}
                        {(ctView[group.client] || "all") === "contacts" ? (
                          <div className="ct-contacts">
                            {contactsOf(collegeVisits).length === 0 ? (
                              <div className="ct-contacts-none">
                                No contact was recorded on any of these visits.
                              </div>
                            ) : (
                              contactsOf(collegeVisits).map((c) => (
                                <div className="ct-contact" key={c.name}>
                                  <User size={12} />
                                  <span className="ct-contact-name">{c.name}</span>
                                  {c.mobiles.length > 0 && (
                                    <span className="ct-contact-mob">{c.mobiles.join(" / ")}</span>
                                  )}
                                  {c.last && (
                                    <span className="ct-contact-last">
                                      last {moment(c.last).format("DD MMM YY")}
                                    </span>
                                  )}
                                  <span className="ct-contact-count">
                                    {c.visits} {c.visits === 1 ? "visit" : "visits"}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        ) : (
                        buildTimeline(collegeVisits, (ctSort[group.client] ?? "desc") === "desc")
                          .filter((ev: any) => {
                            const view = ctView[group.client] || "all";
                            if (view === "visits") return ev.kind === "visit";
                            if (view === "followups") return ev.kind === "followup";
                            return true;
                          })
                          .map((ev: any, ei: number) => {
                          const v = ev.visit;
                          const vId = Number(v?.visit_ID ?? v?.Visit_ID ?? 0);
                          const vKey = String(vId);

                          if (ev.kind === "visit") {
                            return (
                              <div className="ct-item ct-visit" key={`v${ev.visitKey}_${ei}`}>
                                <span className="ct-dot" />
                                <div className="ct-body">
                                  <div className="ct-head">
                                    <span className="ct-when">{formatDate(v.duty_Date)}</span>
                                    {v.projects && <span className="ct-tag">{v.projects}</span>}
                                    {(v.visit_FromTime || v.visit_ToTime) && (
                                      <span className="ct-time">
                                        <Clock size={11} />
                                        {formatTime(v.visit_FromTime)} - {formatTime(v.visit_ToTime)}
                                      </span>
                                    )}
                                  </div>

                                  <div className="ct-line-of">
                                    <span className="ct-bit">
                                      <MapPin size={11} style={{ color: "#ef4444" }} />
                                      {v.location || "-"}
                                    </span>
                                    <span className="ct-bit">
                                      <User size={11} style={{ color: "#3b82f6" }} />
                                      {v.contact_Person || "-"}
                                    </span>
                                    {v.mobile_Number && (
                                      <span className="ct-bit ct-mob">{v.mobile_Number}</span>
                                    )}
                                    {v.remarks && (
                                      <span className="ct-remarks" title={v.remarks}>
                                        {v.remarks}
                                      </span>
                                    )}
                                  </div>

                                  {showVisitors[group.client] && (
                                  <div className="ct-emps">
                                    {String(v.employees || "")
                                      .split(",")
                                      .filter((e: string) => e.trim())
                                      .map((emp: string, i: number) => {
                                        const code = empCodeOf(emp);
                                        const owner = followupBy[vKey] ?? "";
                                        const isOwner = Boolean(code) && owner === code;
                                        const canChange =
                                          isFollowupAdmin || !owner || owner === currentEmpCode;
                                        return (
                                          <button
                                            type="button"
                                            key={i}
                                            className={`employee-chip visit-meta-chip emp-pick ${isOwner ? "owner" : ""} ${canChange ? "" : "fixed"}`}
                                            disabled={followupBySaving[vKey] || !canChange}
                                            onClick={() => setVisitFollowupBy(v, code)}
                                            title={
                                              !canChange
                                                ? "Only the person following this up can reassign it"
                                                : isOwner
                                                ? "Following up - click to clear"
                                                : `Make ${emp.trim()} the follow-up owner`
                                            }
                                          >
                                            {isOwner && <UserCheck size={10} />}
                                            <span>{emp.trim()}</span>
                                          </button>
                                        );
                                      })}

                                  </div>
                                  )}

                                </div>
                              </div>
                            );
                          }

                          if (ev.kind === "call") {
                            return (
                              <div className="ct-item ct-call" key={`c${ev.visitKey}_${ei}`}>
                                <span className="ct-dot" />
                                <div className="ct-body">
                                  <div className="ct-head">
                                    <Phone size={12} />
                                    <span className="ct-when">
                                      {moment(ev.call.on).format("DD MMM YYYY, HH:mm")}
                                    </span>
                                    <span className="ct-kind">feedback call</span>
                                    {ev.call.by && <span className="ct-by">by {ev.call.by}</span>}
                                  </div>
                                  <div className={`ct-text ${ev.call.remarks ? "" : "none"}`}>
                                    {ev.call.remarks || "No remarks noted on the call"}
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          const f = ev.followup;
                          const editable = isEditableToday(f);
                          return (
                            <div className="ct-item ct-fu" key={`f${f.feedbackId || ei}`}>
                              <span className="ct-dot" />
                              <button
                                type="button"
                                className={`ct-body ct-fu-btn ${editable ? "" : "locked"}`}
                                disabled={!editable}
                                onClick={() => openDraft(ev.visitKey, f)}
                                title={
                                  editable
                                    ? "Reopen this follow-up"
                                    : "Recorded on an earlier day - add a new follow-up instead"
                                }
                              >
                                <div className="ct-head">
                                  <BookOpen size={12} />
                                  <span className="ct-when">
                                    {f.followupDate ? moment(f.followupDate).format("DD MMM YYYY") : "No date"}
                                  </span>
                                  <span className="ct-kind">follow-up</span>
                                  {f.createdBy && <span className="ct-by">by {f.createdBy}</span>}
                                  {editable ? <Edit3 size={11} /> : <Lock size={10} />}
                                </div>
                                {f.courses.length > 0 && (
                                  <div className="ct-text">
                                    {f.courses.map((cn: string) => courseSummaryLine(cn, f.courseData[cn])).join(", ")}
                                  </div>
                                )}
                                {f.clientRemarks && <div className="ct-text">{f.clientRemarks}</div>}
                                {(f.nextFollowupDate || f.nextVisitDate) && (
                                  <div className="ct-next">
                                    {f.nextFollowupDate && (
                                      <span>next f/u {moment(f.nextFollowupDate).format("DD/MM/YY")}</span>
                                    )}
                                    {f.nextVisitDate && (
                                      <span>next visit {moment(f.nextVisitDate).format("DD/MM/YY")}</span>
                                    )}
                                  </div>
                                )}
                              </button>
                            </div>
                          );
                        })
                        )}

                        {/* A filter that hides everything looks identical
                            to a college with no history, so say which it
                            is. */}
                        {(ctView[group.client] || "all") === "followups" &&
                          buildTimeline(collegeVisits, false).every((ev: any) => ev.kind !== "followup") && (
                            <div className="ct-contacts-none">
                              No follow-up has been recorded for this college yet.
                            </div>
                          )}
                      </div>
                    )}

                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: "center", padding: "30px 16px", color: "#64748b", background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", gridColumn: "1 / -1" }}>
                  {loadError ? (
                    <>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#b91c1c" }}>
                        Could not load visits.
                      </p>
                      <p style={{ margin: "6px 0 0", fontSize: "11.5px", lineHeight: 1.5 }}>{loadError}</p>
                    </>
                  ) : filteredVisits.length === 0 ? (
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>
                      No visits loaded.
                    </p>
                  ) : section === "feedback" || !isFollowupAdmin ? (
                    /* An empty tab means one of two very different things,
                       and saying "no records" for both is how a finished
                       list gets mistaken for a broken one. */
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>
                      {fbTab === "pending"
                        ? "Every visit has been called back."
                        : "No feedback calls recorded yet."}
                    </p>
                  ) : viewMode === "followups" ? (
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>
                      {fuTab === "pending"
                        ? "Every visit has somebody on it."
                        : fuTab === "handling"
                          ? "No visit has a follow-up owner yet."
                          : "Nothing has been written off."}
                    </p>
                  ) : (
                    <>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>No visit records found.</p>
                      {/* Say WHICH range came back empty - a blank list and a
                          wrong date range look identical otherwise. */}
                      {(appliedFromDate || appliedToDate) && (
                        <p style={{ margin: "6px 0 0", fontSize: "11.5px", color: "#94a3b8" }}>
                          Searched {appliedFromDate ? moment(appliedFromDate).format("DD/MM/YYYY") : "the beginning"}
                          {" to "}
                          {appliedToDate ? moment(appliedToDate).format("DD/MM/YYYY") : "today"}.
                          Clear the dates to see every visit.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="visit-table-wrapper">
              <table className="visit-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Location</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Project</th>
                    <th>Contact Person</th>
                    <th className="mobile-header">Mobile</th>
                    <th>Remarks</th>
                    <th>Employees</th>
                    {/* ── User Requested Feedback Columns ── */}
                    <th style={{ minWidth: '420px' }}>Courses &amp; Requirement</th>
                    <th style={{ minWidth: '220px' }}>Client Remarks</th>
                    <th style={{ minWidth: '150px' }}>Next Followup / Visit</th>
                    <th style={{ minWidth: '95px' }}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredVisits.length > 0 ? (
                    filteredVisits.map((item, index) => {
                      const visitKey = getVisitKey(item, index);
                      const rowFeedback = getRowFeedback(visitKey);

                      return (
                        <tr key={visitKey}>
                          <td>{index + 1}</td>

                          <td>{formatDate(item.duty_Date)}</td>

                          <td>{item.client_Name}</td>

                          <td>{item.location || "-"}</td>

                          <td>{formatTime(item.visit_FromTime)}</td>

                          <td>{formatTime(item.visit_ToTime)}</td>

                          <td>
                            <span className="project-chip">
                              {item.projects}
                            </span>
                          </td>

                          <td>{item.contact_Person || "-"}</td>

                          <td className="mobile-cell">
                            {renderMobileWithCall(item.mobile_Number, {
                              type: "visit",
                              client: item.client_Name,
                              contactPerson: item.contact_Person,
                              project: item.projects,
                            })}
                          </td>

                          <td>{item.remarks || "-"}</td>

                          <td className="employee-column">
                            {item.employees
                              ? item.employees.split(",").map((emp, i) => (
                                  <div key={i} className="employee-chip">
                                    {emp.trim()}
                                  </div>
                                ))
                              : "-"}
                          </td>

                          {/* Courses, each with the count, event requirement
                              and dates asked for against it. One cell rather
                              than one column per field, because a visit can
                              carry several courses and a table row cannot. */}
                          <td style={{ verticalAlign: 'middle' }}>
                            {/* Follow-ups already recorded - click one to reopen it. */}
                            {rowFeedback.followups.length > 0 && (
                              <div className="visit-followup-history">
                                {rowFeedback.followups.map((f, fi) => (
                                  <button
                                    type="button"
                                    key={f.feedbackId || fi}
                                    className={`visit-followup-row ${isEditableToday(f) ? "" : "locked"}`}
                                    onClick={() => openDraft(visitKey, f)}
                                    disabled={!isEditableToday(f)}
                                    title={
                                      isEditableToday(f)
                                        ? "Reopen this follow-up"
                                        : "Recorded on an earlier day - add a new follow-up instead"
                                    }
                                  >
                                    <span className="visit-followup-date">
                                      {f.followupDate ? moment(f.followupDate).format("DD MMM YY") : "No date"}
                                    </span>
                                    <span
                                      className="visit-followup-courses"
                                      title={f.courses.map((cn) => courseSummaryLine(cn, f.courseData[cn])).join(", ")}
                                    >
                                      {f.courses.length > 0
                                        ? f.courses
                                            .map((cn) => courseSummaryLine(cn, f.courseData[cn]))
                                            .join(", ")
                                        : "No courses"}
                                    </span>
                                    <span className="visit-followup-remarks" title={f.clientRemarks}>
                                      {[
                                        f.clientRemarks,
                                        f.nextFollowupDate ? `next f/u ${moment(f.nextFollowupDate).format("DD/MM/YY")}` : "",
                                        f.nextVisitDate ? `next visit ${moment(f.nextVisitDate).format("DD/MM/YY")}` : "",
                                      ].filter(Boolean).join(" · ")}
                                    </span>
                                    {isEditableToday(f) ? (
                                      <Edit3 size={12} className="visit-followup-edit" />
                                    ) : (
                                      <Lock size={11} className="visit-followup-lock" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}

                            {!rowFeedback.draftOpen && (() => {
                              const vId = Number(item?.visit_ID ?? item?.Visit_ID ?? 0);
                              const vKey = String(vId);
                              const call = feedbackCallOf(item);
                              const draft = callDraft[vKey];
                              const busy = !!callSaving[vKey];
                              const err = callError[vKey];

                              return (
                                <>
                                  <div className="visit-action-row">
                                    {/* One action per view, as in the cards. */}
                                    {viewMode !== "followups" && (call ? (
                                      <button
                                        type="button"
                                        className="visit-call-done"
                                        title={`Called by ${call.by || "-"}${call.remarks ? ` - ${call.remarks}` : ""}`}
                                        onClick={() => openCallDraft(vId, call.on, call.remarks)}
                                      >
                                        <CheckCircle2 size={14} />
                                        <span>
                                          Feedback called {moment(call.on).format("DD MMM, HH:mm")}
                                        </span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className="visit-call-add"
                                        disabled={!vId}
                                        onClick={() => openCallDraft(vId)}
                                      >
                                        <Phone size={14} />
                                        <span>Add visit feedback</span>
                                      </button>
                                    ))}

                                    {viewMode !== "pending" && (
                                      <button
                                        type="button"
                                        className="visit-followup-add"
                                        onClick={() => openDraft(visitKey)}
                                      >
                                        <Plus size={14} />
                                        <span>
                                          {rowFeedback.followups.length > 0 ? "Add follow-up" : "Add first follow-up"}
                                        </span>
                                      </button>
                                    )}
                                  </div>

                                  {draft && (
                                    <div className="visit-call-draft">
                                      <div className="visit-call-row">
                                        <label>
                                          <Clock size={12} /> Call made on
                                        </label>
                                        <input
                                          type="datetime-local"
                                          value={draft.on}
                                          onChange={(e) =>
                                            setCallDraft((p) => ({
                                              ...p,
                                              [vKey]: { ...p[vKey], on: e.target.value },
                                            }))
                                          }
                                        />
                                      </div>

                                      <input
                                        className="visit-call-remarks"
                                        placeholder="What did they say on the call?"
                                        value={draft.remarks}
                                        onChange={(e) =>
                                          setCallDraft((p) => ({
                                            ...p,
                                            [vKey]: { ...p[vKey], remarks: e.target.value },
                                          }))
                                        }
                                      />

                                      {err && <div className="visit-call-error">{err}</div>}

                                      <div className="visit-call-acts">
                                        <button
                                          type="button"
                                          className="visit-call-cancel"
                                          disabled={busy}
                                          onClick={() => closeCallDraft(vId)}
                                        >
                                          Cancel
                                        </button>
                                        {call && (
                                          <button
                                            type="button"
                                            className="visit-call-clear"
                                            disabled={busy}
                                            onClick={() => saveFeedbackCall(vId, true)}
                                          >
                                            Clear
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          className="visit-call-save"
                                          disabled={busy || !draft.on}
                                          onClick={() => saveFeedbackCall(vId)}
                                        >
                                          {busy ? "Saving..." : "Save call"}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}

                            {rowFeedback.draftOpen && (
                            <>
                            <div className="visit-draft-banner">
                              <span>{rowFeedback.editingId ? "Editing" : "New follow-up"}</span>
                              <button
                                type="button"
                                className="visit-draft-cancel"
                                onClick={() => closeDraft(visitKey)}
                              >
                                <X size={12} />
                                <span>Cancel</span>
                              </button>
                            </div>
                            <button
                              type="button"
                              className="visit-multiselect-trigger"
                              onClick={() => setCoursesModal({ open: true, visitKey, clientName: item.client_Name })}
                              title="Click to select courses"
                              style={{ width: '100%' }}
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {rowFeedback.courses.length > 0
                                  ? `${rowFeedback.courses.length} course${rowFeedback.courses.length === 1 ? "" : "s"}`
                                  : "Select Courses"}
                              </span>
                              <ChevronDown size={14} style={{ color: '#9ca3af' }} />
                            </button>

                            {rowFeedback.courses.length > 0 && (
                              <div className="visit-course-rows" style={{ marginTop: '6px' }}>
                                {rowFeedback.courses.map((courseName) => {
                                  const cf = rowFeedback.courseData[courseName] || emptyCourseFeedback();
                                  return (
                                    <div className="visit-course-row" key={courseName}>
                                      <span className="visit-course-name" title={courseName}>{courseName}</span>

                                      <input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        className="visit-table-input"
                                        style={{ textAlign: 'center' }}
                                        value={cf.count1}
                                        onChange={(e) => updateCourseField(visitKey, courseName, "count1", e.target.value, item)}
                                      />

                                      <button
                                        type="button"
                                        className="visit-multiselect-trigger"
                                        onClick={() => setEventsModal({ open: true, visitKey, courseName, clientName: item.client_Name })}
                                        title={`Event requirements for ${courseName}`}
                                      >
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {cf.eventRequirements.length > 0 ? cf.eventRequirements.join(", ") : "Select Events"}
                                        </span>
                                        {cf.eventRequirements.length > 0 ? (
                                          <span className="visit-selected-badge">{cf.eventRequirements.length}</span>
                                        ) : (
                                          <ChevronDown size={13} style={{ color: '#9ca3af' }} />
                                        )}
                                      </button>

                                      <button
                                        type="button"
                                        className="visit-multiselect-trigger"
                                        onClick={() => setEventDateModal({ open: true, visitKey, courseName, clientName: item.client_Name })}
                                        title={`Event dates for ${courseName}`}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                                          <Calendar size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {cf.eventDate && cf.eventToDate
                                              ? `${moment(cf.eventDate).format("DD/MM/YY")}-${moment(cf.eventToDate).format("DD/MM/YY")}`
                                              : cf.eventDate
                                              ? moment(cf.eventDate).format("DD/MM/YY")
                                              : cf.eventToDate
                                              ? `To:${moment(cf.eventToDate).format("DD/MM/YY")}`
                                              : "Select Date"}
                                          </span>
                                        </div>
                                        {!cf.eventDate && !cf.eventToDate && (
                                          <ChevronDown size={13} style={{ color: '#9ca3af' }} />
                                        )}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            </>
                            )}
                          </td>

                          {/* Client Remarks - this follow-up's */}
                          <td style={{ verticalAlign: 'middle' }}>
                            {rowFeedback.draftOpen ? (
                              <input
                                type="text"
                                placeholder="Client remarks..."
                                className="visit-table-input"
                                value={rowFeedback.clientRemarks}
                                onChange={(e) => updateFeedbackField(visitKey, "clientRemarks", e.target.value, item)}
                              />
                            ) : (
                              <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                                {rowFeedback.followups.length > 0
                                  ? rowFeedback.followups[rowFeedback.followups.length - 1].clientRemarks || "-"
                                  : "-"}
                              </span>
                            )}
                          </td>

                          {/* What the latest follow-up set going forward */}
                          <td style={{ verticalAlign: 'middle' }}>
                            {rowFeedback.draftOpen ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <input
                                  type="date"
                                  className="visit-table-input"
                                  title="Next followup"
                                  value={rowFeedback.nextFollowupDate}
                                  onChange={(e) => updateFeedbackField(visitKey, "nextFollowupDate", e.target.value, item)}
                                />
                                <input
                                  type="date"
                                  className="visit-table-input"
                                  title="Next visit"
                                  value={rowFeedback.nextVisitDate}
                                  onChange={(e) => updateFeedbackField(visitKey, "nextVisitDate", e.target.value, item)}
                                />
                              </div>
                            ) : (
                              <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                                {(() => {
                                  const last = rowFeedback.followups[rowFeedback.followups.length - 1];
                                  if (!last) return "-";
                                  const bits = [
                                    last.nextFollowupDate ? `f/u ${moment(last.nextFollowupDate).format("DD/MM/YY")}` : "",
                                    last.nextVisitDate ? `visit ${moment(last.nextVisitDate).format("DD/MM/YY")}` : "",
                                  ].filter(Boolean);
                                  return bits.length > 0 ? bits.join(" · ") : "-";
                                })()}
                              </span>
                            )}
                          </td>

                          {/* Action: Save Row Feedback */}
                          <td style={{ verticalAlign: 'middle' }}>
                            {rowFeedback.draftOpen && (
                            <button
                              type="button"
                              className={`visit-save-btn ${rowFeedback.saved ? "saved" : ""}`}
                              onClick={() => handleSaveRowFeedback(visitKey, item)}
                              disabled={savingRows[visitKey]}
                              title="Save visit feedback"
                              style={{ opacity: savingRows[visitKey] ? 0.7 : 1 }}
                            >
                              {savingRows[visitKey] ? (
                                <span>Saving...</span>
                              ) : rowFeedback.saved ? (
                                <>
                                  <Check size={14} />
                                  <span>Saved</span>
                                </>
                              ) : (
                                <>
                                  <Save size={14} />
                                  <span>Save</span>
                                </>
                              )}
                            </button>
                            )}
                          </td>

                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={19} style={{ textAlign: "center", padding: 20 }}>
                        No visit records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )

        )}

      </div>

    </div>

        {/* ── Courses Selection Modal Dialog ── */}
        {coursesModal?.open && (
          <div className="feedback-modal-overlay" onClick={() => setCoursesModal(null)}>
            <div className="feedback-modal-card" onClick={(e) => e.stopPropagation()}>
              
              <div className="feedback-modal-header">
                <div>
                  <h3>Select Courses</h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                    Client: <strong>{coursesModal.clientName}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  className="feedback-modal-close"
                  onClick={() => setCoursesModal(null)}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search Bar */}
              <div style={{ padding: "12px 20px 0" }}>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Search size={16} style={{ position: "absolute", left: "10px", color: "#94a3b8" }} />
                  <input
                    type="text"
                    placeholder="Search courses (e.g. Python, AutoCAD, Drones)..."
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    className="visit-table-input"
                    style={{ paddingLeft: "32px", height: "36px" }}
                  />
                  {courseSearch && (
                    <button
                      type="button"
                      onClick={() => setCourseSearch("")}
                      style={{ position: "absolute", right: "8px", background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="feedback-modal-body">
                {COURSES_CATALOG.map((cat) => {
                  const filteredCourses = cat.courses.filter((c) =>
                    c.name.toLowerCase().includes(courseSearch.toLowerCase()) ||
                    cat.category.toLowerCase().includes(courseSearch.toLowerCase())
                  );

                  if (filteredCourses.length === 0) return null;

                  return (
                    <div key={cat.category} className="course-category-section">
                      <div className="course-category-title">
                        <BookOpen size={14} />
                        <span>{cat.category}</span>
                      </div>
                      <div className="course-checkbox-grid">
                        {filteredCourses.map((course) => {
                          const isSelected = getRowFeedback(coursesModal.visitKey).courses.includes(course.name);

                          return (
                            <div
                              key={course.name}
                              className={`course-pick ${isSelected ? "selected" : ""}`}
                            >
                              <label className={`course-checkbox-item ${isSelected ? "selected" : ""}`}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleCourseSelection(coursesModal.visitKey, course.name, { client_Name: coursesModal.clientName })}
                                />
                                <span>{course.name}</span>
                                <span className="course-duration-badge">{course.duration}</span>
                              </label>

                              {/* The count, the dates and the event
                                  requirement used to be repeated here for
                                  every ticked course. Each course now has
                                  a row of its own in the form with those
                                  same three controls, so this dialog does
                                  one thing: say which courses. */}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="feedback-modal-footer">
                <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#475569" }}>
                  Selected: <strong>{getRowFeedback(coursesModal.visitKey).courses.length}</strong> courses
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  {getRowFeedback(coursesModal.visitKey).courses.length > 0 && (
                    <button
                      type="button"
                      className="stock-button stock-button--secondary"
                      style={{ padding: "6px 12px", height: "auto", fontSize: "12px" }}
                      onClick={() => {
                        const picked = [...getRowFeedback(coursesModal.visitKey).courses];
                        picked.forEach((c) =>
                          toggleCourseSelection(coursesModal.visitKey, c, { client_Name: coursesModal.clientName })
                        );
                      }}
                    >
                      Clear All
                    </button>
                  )}
                  <button
                    type="button"
                    className="stock-button"
                    style={{ padding: "6px 16px", height: "auto", fontSize: "12px" }}
                    onClick={() => setCoursesModal(null)}
                  >
                    Done
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── Event Requirements Multi-Select Modal Dialog ── */}
        {eventsModal?.open && (
          <div className="feedback-modal-overlay" onClick={() => setEventsModal(null)}>
            <div className="feedback-modal-card" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
              
              <div className="feedback-modal-header">
                <div>
                  <h3>Select Event Requirements</h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                    Client: <strong>{eventsModal.clientName}</strong>
                    {eventsModal.courseName ? (
                      <> &middot; Course: <strong>{eventsModal.courseName}</strong></>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  className="feedback-modal-close"
                  onClick={() => setEventsModal(null)}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="feedback-modal-body">
                <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#64748b" }}>
                  Select one or more event types required by this client:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {EVENT_REQUIREMENTS_LIST.map((evt) => {
                    const isSelected = getCourseFeedback(eventsModal.visitKey, eventsModal.courseName).eventRequirements.includes(evt);

                    return (
                      <label
                        key={evt}
                        className={`course-checkbox-item ${isSelected ? "selected" : ""}`}
                        style={{ padding: "10px 14px", fontSize: "13px" }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleEventSelection(eventsModal.visitKey, eventsModal.courseName, evt, { client_Name: eventsModal.clientName })}
                        />
                        <span>{evt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="feedback-modal-footer">
                <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#475569" }}>
                  Selected: <strong>{getCourseFeedback(eventsModal.visitKey, eventsModal.courseName).eventRequirements.length}</strong> events
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  {getCourseFeedback(eventsModal.visitKey, eventsModal.courseName).eventRequirements.length > 0 && (
                    <button
                      type="button"
                      className="stock-button stock-button--secondary"
                      style={{ padding: "6px 12px", height: "auto", fontSize: "12px" }}
                      onClick={() => updateCourseField(eventsModal.visitKey, eventsModal.courseName, "eventRequirements", [], { client_Name: eventsModal.clientName })}
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    className="stock-button"
                    style={{ padding: "6px 16px", height: "auto", fontSize: "12px" }}
                    onClick={() => setEventsModal(null)}
                  >
                    Done
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── Event Date Selection Modal Dialog (From Date & To Date) ── */}
        {eventDateModal?.open && (
          <div className="feedback-modal-overlay" onClick={() => setEventDateModal(null)}>
            <div className="feedback-modal-card" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
              
              <div className="feedback-modal-header">
                <div>
                  <h3 style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Calendar size={18} style={{ color: "var(--ion-color-primary, #3b82f6)" }} />
                    <span>Select Event Dates</span>
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                    Client: <strong>{eventDateModal.clientName}</strong>
                    {eventDateModal.courseName ? (
                      <> &middot; Course: <strong>{eventDateModal.courseName}</strong></>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  className="feedback-modal-close"
                  onClick={() => setEventDateModal(null)}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="feedback-modal-body" style={{ padding: "16px 20px" }}>
                <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: "#64748b" }}>
                  Select From Date and To Date for the scheduled event:
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {/* From Date Input */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <label style={{ fontSize: "12.5px", fontWeight: 600, color: "#334155" }}>
                      From Date:
                    </label>
                    <input
                      type="date"
                      className="visit-table-input"
                      style={{ height: "38px", fontSize: "13px", padding: "6px 10px" }}
                      value={getCourseFeedback(eventDateModal.visitKey, eventDateModal.courseName).eventDate}
                      onChange={(e) => updateCourseField(eventDateModal.visitKey, eventDateModal.courseName, "eventDate", e.target.value, { client_Name: eventDateModal.clientName })}
                    />
                  </div>

                  {/* To Date Input */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <label style={{ fontSize: "12.5px", fontWeight: 600, color: "#334155" }}>
                      To Date:
                    </label>
                    <input
                      type="date"
                      className="visit-table-input"
                      style={{ height: "38px", fontSize: "13px", padding: "6px 10px" }}
                      value={getCourseFeedback(eventDateModal.visitKey, eventDateModal.courseName).eventToDate}
                      onChange={(e) => updateCourseField(eventDateModal.visitKey, eventDateModal.courseName, "eventToDate", e.target.value, { client_Name: eventDateModal.clientName })}
                    />
                  </div>
                </div>

                {/* Date Summary Preview */}
                {(getCourseFeedback(eventDateModal.visitKey, eventDateModal.courseName).eventDate || getCourseFeedback(eventDateModal.visitKey, eventDateModal.courseName).eventToDate) && (
                  <div style={{ marginTop: "16px", padding: "10px 12px", background: "#f1f5f9", borderRadius: "8px", fontSize: "12px", color: "#475569" }}>
                    <strong>Selected Range: </strong>
                    {getCourseFeedback(eventDateModal.visitKey, eventDateModal.courseName).eventDate ? moment(getCourseFeedback(eventDateModal.visitKey, eventDateModal.courseName).eventDate).format("DD/MM/YYYY") : "Not set"}
                    {" \u2192 "}
                    {getCourseFeedback(eventDateModal.visitKey, eventDateModal.courseName).eventToDate ? moment(getCourseFeedback(eventDateModal.visitKey, eventDateModal.courseName).eventToDate).format("DD/MM/YYYY") : "Not set"}
                  </div>
                )}
              </div>

              <div className="feedback-modal-footer">
                <div>
                  {(getCourseFeedback(eventDateModal.visitKey, eventDateModal.courseName).eventDate || getCourseFeedback(eventDateModal.visitKey, eventDateModal.courseName).eventToDate) && (
                    <button
                      type="button"
                      className="stock-button stock-button--secondary"
                      style={{ padding: "6px 12px", height: "auto", fontSize: "12px" }}
                      onClick={() => {
                        updateCourseField(eventDateModal.visitKey, eventDateModal.courseName, "eventDate", "", { client_Name: eventDateModal.clientName });
                        updateCourseField(eventDateModal.visitKey, eventDateModal.courseName, "eventToDate", "", { client_Name: eventDateModal.clientName });
                      }}
                    >
                      Clear Dates
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="stock-button"
                    style={{ padding: "6px 18px", height: "auto", fontSize: "12px" }}
                    onClick={() => setEventDateModal(null)}
                  >
                    Done
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        <IonLoading isOpen={loading} message="Loading..." />
      </>
  );

  if (embedded) return body;

  return (
    <IonPage>
      <IonContent className="page-content">
        {body}
      </IonContent>
    </IonPage>
  );
};

export default VisitTickets;