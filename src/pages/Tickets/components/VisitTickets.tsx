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
  const [viewMode, setViewMode] = useState<"grid" | "table" | "party" | "pending" | "followups">("grid");

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

  const latestVisitByClient = useMemo(() => {
    const map: Record<string, VisitTicket> = {};
    tickets.forEach((v) => {
      const name = String(v.client_Name || "").trim();
      if (!name) return;
      const current = map[name];
      if (!current) { map[name] = v; return; }
      const a = parseItemDate(v.duty_Date);
      const b = parseItemDate(current.duty_Date);
      if (a && (!b || a.isAfter(b))) map[name] = v;
    });
    return map;
  }, [tickets]);

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
  const pendingVisits = useMemo(() => {
    return filteredVisits.filter((v: any) => {
      const fromServer = Array.isArray(v?.Followups) ? v.Followups.length : 0;
      if (fromServer > 0) return false;
      // Something saved in this session counts too, even before a reload.
      const key = getVisitKey(v);
      const local = feedbackStore[key];
      return !local || local.followups.length === 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredVisits, feedbackStore]);

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

          <div className="stock-panel" style={{ margin: '0 16px 20px 16px' }}>
            
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
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: '240px', maxWidth: '380px', flex: 1 }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Search Client Name / Details..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="visit-table-input"
                    style={{ paddingLeft: '36px', paddingRight: clientSearch ? '30px' : '10px', height: '38px', borderRadius: '999px', fontSize: '13px' }}
                  />
                  {clientSearch && (
                    <button
                      type="button"
                      onClick={() => setClientSearch("")}
                      style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: 0 }}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {/* Grid / Table are two ways of reading the same flat list;
                    By Party regroups it under the client, which is where a
                    visit history actually belongs. */}
                <div className="visit-view-toggle">
                  <button
                    type="button"
                    className={`visit-view-btn ${viewMode === "grid" ? "active" : ""}`}
                    onClick={() => setViewMode("grid")}
                  >
                    Cards
                  </button>
                  <button
                    type="button"
                    className={`visit-view-btn ${viewMode === "table" ? "active" : ""}`}
                    onClick={() => setViewMode("table")}
                  >
                    Table
                  </button>
                  <button
                    type="button"
                    className={`visit-view-btn ${viewMode === "party" ? "active" : ""}`}
                    onClick={() => setViewMode("party")}
                  >
                    <Building2 size={13} />
                    <span>By Party</span>
                  </button>
                  <button
                    type="button"
                    className={`visit-view-btn ${viewMode === "pending" ? "active" : ""}`}
                    onClick={() => setViewMode("pending")}
                    title="Visits with no feedback recorded yet"
                  >
                    <Clock size={13} />
                    <span>Feedback Pending</span>
                    {pendingVisits.length > 0 && (
                      <span className="visit-view-count">{pendingVisits.length}</span>
                    )}
                  </button>
                  {isFollowupAdmin && (
                    <button
                      type="button"
                      className={`visit-view-btn ${viewMode === "followups" ? "active" : ""}`}
                      onClick={() => setViewMode("followups")}
                      title="Every follow-up across all visits"
                    >
                      <UserCheck size={13} />
                      <span>All Follow-ups</span>
                      {awaitingFollowupCount > 0 && (
                        <span className="visit-view-count" title="Assigned, nothing recorded yet">
                          {awaitingFollowupCount}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

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
          </div>

          {/* Content Panel (Grid Cards / Table View) */}
          <div className="visit-panel" style={{ margin: '0 16px 20px 16px', background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>

        {activeTab === "tickets" ? (

          viewMode === "grid" ? (
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

          viewMode === "followups" && isFollowupAdmin ? (
            /* Every follow-up on screen in one list, newest first, plus
               every visit that has been ASSIGNED to someone but has no
               follow-up recorded against it yet - those sit at the top of
               their day marked "awaiting", because an assignment nobody
               has acted on is the thing this screen exists to surface.
               Read-only; editing stays where the visit's own context is. */
            <div className="fu-all">
              <div className="fu-all-head">
                <span>Date</span>
                <span>Party</span>
                <span>Courses</span>
                <span>Owner</span>
                <span>Next</span>
                <span>Remarks</span>
              </div>

              {allFollowups.length > 0 ? (
                allFollowups.map((r, i) => (
                  <div
                    className={`fu-all-row ${r.kind === "awaiting" ? "awaiting" : ""}`}
                    key={`${r.visitId}-${r.feedbackId}-${i}`}
                  >
                    <span className="fu-all-date">
                      {r.followupDate
                        ? moment(r.followupDate).format("DD MMM YY")
                        : <span className="fu-all-await">awaiting</span>}
                    </span>
                    <span className="fu-all-party" title={r.client}>
                      {r.client}
                      <span className="fu-all-visit">
                        visit {r.visitDate ? moment(r.visitDate).format("DD/MM/YY") : "-"}
                      </span>
                    </span>
                    <span
                      className="fu-all-courses"
                      title={r.courses.map((cn: string) => courseSummaryLine(cn, r.courseData[cn])).join(", ")}
                    >
                      {r.courses.length > 0
                        ? r.courses.map((cn: string) => courseSummaryLine(cn, r.courseData[cn])).join(", ")
                        : "-"}
                    </span>
                    <span className="fu-all-owner">
                      {r.owner ? r.owner : <span className="fu-all-unowned">unassigned</span>}
                    </span>
                    <span className="fu-all-next">
                      {r.nextFollowupDate ? `f/u ${moment(r.nextFollowupDate).format("DD/MM/YY")}` : ""}
                      {r.nextFollowupDate && r.nextVisitDate ? <br /> : null}
                      {r.nextVisitDate ? `visit ${moment(r.nextVisitDate).format("DD/MM/YY")}` : ""}
                      {!r.nextFollowupDate && !r.nextVisitDate ? "-" : null}
                    </span>
                    <span className="fu-all-remarks" title={r.clientRemarks}>
                      {r.kind === "awaiting"
                        ? <span className="fu-all-await-note">assigned - no follow-up recorded yet</span>
                        : (r.clientRemarks || "-")}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: "center", padding: "30px 16px", color: "#64748b" }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>
                    No follow-ups recorded, and no visit assigned to anyone,
                    in this date range.
                  </p>
                </div>
              )}
            </div>
          ) :

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

          viewMode === "grid" || viewMode === "pending" ? (
            <div className="visits-cards-grid">
              {(viewMode === "pending" ? pendingVisits : filteredVisits).length > 0 ? (
                (viewMode === "pending" ? pendingVisits : filteredVisits).map((item, index) => {
                  const visitKey = getVisitKey(item, index);
                  const rowFeedback = getRowFeedback(visitKey);

                  return (
                    <div
                      className="tasks-premium-card visit-grid-card"
                      key={visitKey}
                      style={{ animationDelay: `${index * 0.02}s` }}
                    >
                      {/* Card Top Header */}
                      <div className="task-card-header">
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <div className="tid-badge">
                            #{index + 1}
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

                      {/* Card Body */}
                      <div className="card-body" style={{ padding: 0 }}>
                        
                        {/* Client Title */}
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", margin: "2px 0 4px" }}>
                          <Building2 size={16} style={{ color: "var(--ion-color-primary, #3b82f6)", flexShrink: 0 }} />
                          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#1e293b", lineHeight: 1.25 }}>
                            {item.client_Name}
                          </h3>
                        </div>

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

                          {item.employees ? (
                            <span className="visit-meta-emps">
                              {item.employees.split(",").map((emp, i) => {
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
                              {followupByError[String(Number(item.visit_ID || item.Visit_ID || 0))] && (
                                <span className="emp-pick-error">
                                  {followupByError[String(Number(item.visit_ID || item.Visit_ID || 0))]}
                                </span>
                              )}
                            </span>
                          ) : null}
                        </div>

                        {/* ── Feedback & Event Planning Box ── */}
                        <div className="visit-card-feedback-box">
                          <button
                            type="button"
                            className="visit-card-feedback-header"
                            onClick={() => toggleFeedbackBox(visitKey)}
                          >
                            <BookOpen size={13} style={{ color: "var(--stock-accent, #45599b)" }} />
                            <span>Feedback &amp; Event Details</span>
                            {rowFeedback.followups.length > 0 && (
                              <span className="visit-feedback-badge">
                                {rowFeedback.followups.length}
                              </span>
                            )}
                            <ChevronDown
                              size={14}
                              className="visit-feedback-chev"
                              style={openFeedback[visitKey] ? { transform: "rotate(180deg)" } : undefined}
                            />
                          </button>

                          {openFeedback[visitKey] && (
                          <>

                          {/* Visit-level: which courses, and when to follow up.
                              The figures asked for against each course live on
                              their own row below. */}
                          {(() => {
                            const latest = latestVisitByClient[String(item.client_Name || "").trim()];
                            if (!latest) return null;
                            const isThisOne = getVisitKey(latest) === visitKey;
                            return (
                              <div className="visit-latest">
                                <div className="visit-latest-head">
                                  <span className="visit-latest-label">Most recent visit</span>
                                  <span className="visit-latest-date">
                                    {latest.duty_Date ? moment(latest.duty_Date).format("DD MMM YYYY") : "-"}
                                  </span>
                                  <span className="visit-latest-time">
                                    {formatTime(latest.visit_FromTime)} - {formatTime(latest.visit_ToTime)}
                                  </span>
                                  {isThisOne && <span className="visit-latest-self">this visit</span>}
                                </div>
                                {latest.remarks ? (
                                  <div className="visit-latest-remarks">{latest.remarks}</div>
                                ) : (
                                  <div className="visit-latest-remarks visit-latest-none">No remarks recorded</div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Follow-ups already recorded against this visit.
                              Read-only here - click one to reopen it if it
                              needs correcting, rather than editing in place
                              and risking the history being rewritten. */}
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
                                    {f.followupDate ? moment(f.followupDate).format("DD MMM YYYY") : "No date"}
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

                          {!rowFeedback.draftOpen && (
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
                            <div className="visit-grid-input-group" style={{ flex: "0 1 260px" }}>
                              <label>Courses List</label>
                              <button
                                type="button"
                                className="visit-multiselect-trigger"
                                onClick={() => setCoursesModal({ open: true, visitKey, clientName: item.client_Name })}
                                title="Click to select courses"
                                style={{ width: "100%" }}
                              >
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {rowFeedback.courses.length > 0 ? rowFeedback.courses.join(", ") : "Select Courses"}
                                </span>
                                {rowFeedback.courses.length > 0 ? (
                                  <span className="visit-selected-badge">{rowFeedback.courses.length}</span>
                                ) : (
                                  <ChevronDown size={13} style={{ color: "#9ca3af" }} />
                                )}
                              </button>
                            </div>

                            <div className="visit-grid-input-group" style={{ flex: "0 0 150px" }}>
                              <label>Next Followup</label>
                              <input
                                type="date"
                                className="visit-table-input"
                                value={rowFeedback.nextFollowupDate}
                                onChange={(e) => updateFeedbackField(visitKey, "nextFollowupDate", e.target.value, item)}
                              />
                            </div>

                            <div className="visit-grid-input-group" style={{ flex: "0 0 150px" }}>
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
                            <div className="visit-course-empty">
                              Pick a course above to record the count, event requirement and dates asked for against it.
                            </div>
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
                                    <span className="visit-course-name" title={courseName}>{courseName}</span>

                                    <input
                                      type="number"
                                      min="0"
                                      placeholder="0"
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

                          {/* Inline Remarks & Save Row */}
                          <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", marginTop: "6px" }}>
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                              <label style={{ fontSize: "10.5px", fontWeight: 750, color: "#475569", textTransform: "uppercase" }}>Client Remarks</label>
                              <input
                                type="text"
                                placeholder="Remarks..."
                                className="visit-table-input"
                                value={rowFeedback.clientRemarks}
                                onChange={(e) => updateFeedbackField(visitKey, "clientRemarks", e.target.value, item)}
                              />
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ fontSize: "11.5px", color: rowFeedback.saved ? "#10b981" : "#64748b", fontWeight: 700, whiteSpace: "nowrap" }}>
                                {rowFeedback.saved ? "✓ Saved" : "Unsaved"}
                              </div>
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

                      </div>
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
                  ) : viewMode === "pending" ? (
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>
                      {filteredVisits.length > 0
                        ? "Every visit in this range has feedback recorded."
                        : "No visits in this range."}
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

                            {!rowFeedback.draftOpen && (
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

                          const cf = getCourseFeedback(coursesModal.visitKey, course.name);

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

                              {/* What is being asked for against THIS course.
                                  Only once it is picked - an unticked course has
                                  nothing to say, and showing the fields anyway
                                  would make the list unreadable. */}
                              {isSelected && (
                                <div className="course-detail">
                                  <div className="course-detail-line">
                                    <label className="course-detail-label">Count</label>
                                    <input
                                      type="number"
                                      min="0"
                                      placeholder="0"
                                      className="visit-table-input course-detail-count"
                                      value={cf.count1}
                                      onChange={(e) =>
                                        updateCourseField(coursesModal.visitKey, course.name, "count1", e.target.value, {
                                          client_Name: coursesModal.clientName,
                                        })
                                      }
                                    />

                                    <label className="course-detail-label">From</label>
                                    <input
                                      type="date"
                                      className="visit-table-input course-detail-date"
                                      value={cf.eventDate}
                                      onChange={(e) =>
                                        updateCourseField(coursesModal.visitKey, course.name, "eventDate", e.target.value, {
                                          client_Name: coursesModal.clientName,
                                        })
                                      }
                                    />

                                    <label className="course-detail-label">To</label>
                                    <input
                                      type="date"
                                      className="visit-table-input course-detail-date"
                                      value={cf.eventToDate}
                                      onChange={(e) =>
                                        updateCourseField(coursesModal.visitKey, course.name, "eventToDate", e.target.value, {
                                          client_Name: coursesModal.clientName,
                                        })
                                      }
                                    />
                                  </div>

                                  <div className="course-detail-events">
                                    <label className="course-detail-label">Event Req</label>
                                    <div className="course-event-chips">
                                      {EVENT_REQUIREMENTS_LIST.map((evt) => {
                                        const on = cf.eventRequirements.includes(evt);
                                        return (
                                          <button
                                            type="button"
                                            key={evt}
                                            className={`course-event-chip ${on ? "on" : ""}`}
                                            onClick={() =>
                                              toggleEventSelection(coursesModal.visitKey, course.name, evt, {
                                                client_Name: coursesModal.clientName,
                                              })
                                            }
                                          >
                                            {on && <Check size={11} />}
                                            <span>{evt}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}
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