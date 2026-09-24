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
  User
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

interface VisitFeedbackRowData {
  courses: string[];
  count1: string;
  eventRequirements: string[];
  eventDate: string;
  eventToDate: string;
  count2: string;
  clientRemarks: string;
  nextFollowupDate: string;
  saved?: boolean;
}

const VisitTickets: React.FC = () => {
  const history = useHistory();
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

  // View Mode state (Grid Cards vs Table View)
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Feedback State per visit row (persisted in localStorage)
  const [feedbackStore, setFeedbackStore] = useState<Record<string, VisitFeedbackRowData>>(() => {
    try {
      const saved = localStorage.getItem("visits_feedback_store");
      return saved ? JSON.parse(saved) : {};
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
    clientName: string;
  } | null>(null);

  // Modal dialog state for selecting Event Dates (From Date & To Date)
  const [eventDateModal, setEventDateModal] = useState<{
    open: boolean;
    visitKey: string;
    clientName: string;
  } | null>(null);

  const [courseSearch, setCourseSearch] = useState("");
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});

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
      const activeFrom = from !== undefined && from !== null && from.trim() ? from : defaultFromDate;
      const activeTo = to !== undefined && to !== null && to.trim() ? to : defaultToDate;

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
            const c2 = item.count02 !== undefined && item.count02 !== null ? String(item.count02) : (item.Count02 !== undefined && item.Count02 !== null ? String(item.Count02) : "");
            const eDate = item.eventDate || item.EventDate ? moment(item.eventDate || item.EventDate).format("YYYY-MM-DD") : "";
            const eToDate = item.eventToDate || item.EventToDate ? moment(item.eventToDate || item.EventToDate).format("YYYY-MM-DD") : "";
            const fDate = item.nextFollowupDate || item.NextFollowupDate ? moment(item.nextFollowupDate || item.NextFollowupDate).format("YYYY-MM-DD") : "";
            const remarks = item.clientRemarks || item.ClientRemarks || "";
            const hasServerData = Boolean(serverCourses.length > 0 || c1 || serverEvents.length > 0 || eDate || eToDate || c2 || remarks || fDate);

            updated[vKey] = {
              courses: serverCourses.length > 0 ? serverCourses : (existing?.courses || []),
              count1: c1 || existing?.count1 || "",
              eventRequirements: serverEvents.length > 0 ? serverEvents : (existing?.eventRequirements || []),
              eventDate: eDate || existing?.eventDate || "",
              eventToDate: eToDate || existing?.eventToDate || "",
              count2: c2 || existing?.count2 || "",
              clientRemarks: remarks || existing?.clientRemarks || "",
              nextFollowupDate: fDate || existing?.nextFollowupDate || "",
              saved: hasServerData || Boolean(existing?.saved),
            };
          });

          try {
            localStorage.setItem("visits_feedback_store", JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }

      setTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[VisitTickets] loadTickets (Visits FeedBack) ERROR:", err);
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

    // Filter by Date Range: if user applied custom dates, use them. If cleared/empty, default to current month
    const effectiveFrom = appliedFromDate && appliedFromDate.trim() ? appliedFromDate : defaultFromDate;
    const effectiveTo = appliedToDate && appliedToDate.trim() ? appliedToDate : defaultToDate;

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

  const getRowFeedback = (visitKey: string): VisitFeedbackRowData => {
    return (
      feedbackStore[visitKey] || {
        courses: [],
        count1: "",
        eventRequirements: [],
        eventDate: "",
        eventToDate: "",
        count2: "",
        clientRemarks: "",
        nextFollowupDate: "",
        saved: false,
      }
    );
  };

  const updateFeedbackField = (
    visitKey: string,
    field: keyof VisitFeedbackRowData,
    value: any,
    rowInfo?: any
  ) => {
    setFeedbackStore((prev) => {
      const current = prev[visitKey] || {
        courses: [],
        count1: "",
        eventRequirements: [],
        eventDate: "",
        eventToDate: "",
        count2: "",
        clientRemarks: "",
        nextFollowupDate: "",
        saved: false,
      };
      const updated = {
        ...prev,
        [visitKey]: {
          ...current,
          [field]: value,
          saved: false,
        },
      };
      try {
        localStorage.setItem("visits_feedback_store", JSON.stringify(updated));
      } catch {}
      return updated;
    });

    console.log("%c[VisitTickets] Feedback Field Updated", "color: #3b82f6; font-weight: bold;", {
      visitKey,
      field,
      value,
      client: rowInfo?.client_Name,
    });
  };

  const toggleCourseSelection = (visitKey: string, courseName: string, rowInfo?: any) => {
    const current = getRowFeedback(visitKey);
    const exists = current.courses.includes(courseName);
    const updatedCourses = exists
      ? current.courses.filter((c) => c !== courseName)
      : [...current.courses, courseName];

    updateFeedbackField(visitKey, "courses", updatedCourses, rowInfo);
  };

  const toggleEventSelection = (visitKey: string, eventName: string, rowInfo?: any) => {
    const current = getRowFeedback(visitKey);
    const exists = current.eventRequirements.includes(eventName);
    const updatedEvents = exists
      ? current.eventRequirements.filter((e) => e !== eventName)
      : [...current.eventRequirements, eventName];

    updateFeedbackField(visitKey, "eventRequirements", updatedEvents, rowInfo);
  };

  const handleSaveRowFeedback = async (visitKey: string, item: VisitTicket) => {
    const row = getRowFeedback(visitKey);
    const visitId = Number(item.visit_ID || item.Visit_ID || 0);

    const payload = {
      Visit_ID: visitId,
      CoursesList: row.courses.join(", "),
      Count01: row.count1 ? parseInt(row.count1, 10) : null,
      EventRequirements: row.eventRequirements.join(", "),
      EventDate: row.eventDate ? moment(row.eventDate).format("YYYY-MM-DD") : null,
      EventToDate: row.eventToDate ? moment(row.eventToDate).format("YYYY-MM-DD") : null,
      Count02: row.count2 ? parseInt(row.count2, 10) : null,
      ClientRemarks: row.clientRemarks || null,
      NextFollowupDate: row.nextFollowupDate ? moment(row.nextFollowupDate).format("YYYY-MM-DD") : null,
    };

    console.log("%c[VisitTickets] Save Visit Feedback API Request:", "color: #10b981; font-weight: bold;", {
      endpoint: "Tickets/Save_VisitFeedback",
      payload,
      visitKey,
      clientName: item.client_Name,
      hasVisitId: visitId > 0,
    });

    setSavingRows((prev) => ({ ...prev, [visitKey]: true }));

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
          console.warn("[VisitTickets] Server returned error, saving locally:", resJson);
        }
      } else {
        console.warn("[VisitTickets] No Visit_ID found for row, persisting locally in localStorage.");
      }

      setFeedbackStore((prev) => {
        const updated = {
          ...prev,
          [visitKey]: {
            ...row,
            saved: true,
          },
        };
        try {
          localStorage.setItem("visits_feedback_store", JSON.stringify(updated));
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
          localStorage.setItem("visits_feedback_store", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    } finally {
      setSavingRows((prev) => ({ ...prev, [visitKey]: false }));
    }
  };

  return (
    <IonPage>
      <IonContent className="page-content">
        <div className="wr-container stock-container" style={{ padding: 0, minHeight: 'auto', backgroundColor: 'transparent' }}>
          
          {/* ── Premium Header ── */}
          <div className="page-wr-header" style={{ margin: '16px', borderRadius: '16px', padding: '16px' }}>
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()}>
                <ChevronLeft size={22} color="white" />
              </button>
              <div>
                <h1 className="page-wr-title">Visits Management</h1>
                <p className="page-wr-subtitle">Closed Tickets & Visit History</p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <div className="page-wr-header-icon-box">
                <IonIcon icon={documentTextOutline} style={{ color: 'var(--ion-color-primary)', fontSize: '24px' }} />
              </div>
            </div>
          </div>

          <div className="stock-panel" style={{ margin: '0 16px 20px 16px' }}>
            
            {/* Tabs & Client Search Bar Row (Added beside Visits FeedBack Tab) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--stock-border)' }}>
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

          viewMode === "grid" ? (
            <div className="visits-cards-grid">
              {filteredVisits.length > 0 ? (
                filteredVisits.map((item, index) => {
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

                        {/* Location, Contact Person, & Phone in horizontal compact meta box */}
                        <div className="visit-card-meta-box">
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#475569" }}>
                            <MapPin size={13} style={{ color: "#ef4444", flexShrink: 0 }} />
                            <strong style={{ color: "#64748b" }}>Loc:</strong>
                            <span style={{ color: "#1e293b", fontWeight: 600 }}>{item.location || "-"}</span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#475569" }}>
                            <User size={13} style={{ color: "#3b82f6", flexShrink: 0 }} />
                            <strong style={{ color: "#64748b" }}>Contact:</strong>
                            <span style={{ color: "#1e293b", fontWeight: 600 }}>{item.contact_Person || "-"}</span>
                          </div>

                          {/* Mobile with Direct Call Button */}
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <strong style={{ color: "#64748b" }}>Mob:</strong>
                            {renderMobileWithCall(item.mobile_Number, {
                              type: "visit",
                              client: item.client_Name,
                              contactPerson: item.contact_Person,
                              project: item.projects,
                            })}
                          </div>
                        </div>

                        {/* Remarks */}
                        {item.remarks && (
                          <div
                            style={{
                              margin: "4px 0",
                              padding: "4px 8px",
                              background: "#fffbeb",
                              borderLeft: "3px solid #f59e0b",
                              borderRadius: "4px",
                              fontSize: "12px",
                              color: "#92400e",
                              lineHeight: 1.35,
                            }}
                          >
                            <strong>Remarks:</strong> {item.remarks}
                          </div>
                        )}

                        {/* Assigned Employees */}
                        {item.employees && (
                          <div style={{ margin: "4px 0 5px" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                              {item.employees.split(",").map((emp, i) => (
                                <span key={i} className="employee-chip" style={{ margin: 0, padding: "2px 7px", fontSize: "11px" }}>
                                  {emp.trim()}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ── Feedback & Event Planning Box ── */}
                        <div className="visit-card-feedback-box">
                          <div className="visit-card-feedback-header">
                            <BookOpen size={13} style={{ color: "var(--stock-accent, #45599b)" }} />
                            <span>Feedback & Event Details</span>
                          </div>

                          <div className="visit-card-feedback-grid">
                            {/* Courses List */}
                            <div className="visit-grid-input-group">
                              <label>Courses List</label>
                              <button
                                type="button"
                                className="visit-multiselect-trigger"
                                onClick={() => setCoursesModal({ open: true, visitKey, clientName: item.client_Name })}
                                title="Click to select courses"
                                style={{ width: "100%" }}
                              >
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "95px" }}>
                                  {rowFeedback.courses.length > 0 ? rowFeedback.courses.join(", ") : "Select Courses"}
                                </span>
                                {rowFeedback.courses.length > 0 ? (
                                  <span className="visit-selected-badge">{rowFeedback.courses.length}</span>
                                ) : (
                                  <ChevronDown size={13} style={{ color: "#9ca3af" }} />
                                )}
                              </button>
                            </div>

                            {/* Count-01 */}
                            <div className="visit-grid-input-group">
                              <label>Count-01</label>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                className="visit-table-input"
                                style={{ width: "100%", textAlign: "center" }}
                                value={rowFeedback.count1}
                                onChange={(e) => updateFeedbackField(visitKey, "count1", e.target.value, item)}
                              />
                            </div>

                            {/* Event Requirements */}
                            <div className="visit-grid-input-group">
                              <label>Event Req</label>
                              <button
                                type="button"
                                className="visit-multiselect-trigger"
                                onClick={() => setEventsModal({ open: true, visitKey, clientName: item.client_Name })}
                                title="Click to select event requirements"
                                style={{ width: "100%" }}
                              >
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "95px" }}>
                                  {rowFeedback.eventRequirements.length > 0 ? rowFeedback.eventRequirements.join(", ") : "Select Events"}
                                </span>
                                {rowFeedback.eventRequirements.length > 0 ? (
                                  <span className="visit-selected-badge">{rowFeedback.eventRequirements.length}</span>
                                ) : (
                                  <ChevronDown size={13} style={{ color: "#9ca3af" }} />
                                )}
                              </button>
                            </div>

                            {/* Event Date (From Date & To Date Selection) */}
                            <div className="visit-grid-input-group">
                              <label>Event Date</label>
                              <button
                                type="button"
                                className="visit-multiselect-trigger"
                                onClick={() => setEventDateModal({ open: true, visitKey, clientName: item.client_Name })}
                                title="Click to select event From Date and To Date"
                                style={{ width: "100%" }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden" }}>
                                  <Calendar size={13} style={{ color: "#64748b", flexShrink: 0 }} />
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "90px" }}>
                                    {rowFeedback.eventDate && rowFeedback.eventToDate
                                      ? `${moment(rowFeedback.eventDate).format("DD/MM/YY")}-${moment(rowFeedback.eventToDate).format("DD/MM/YY")}`
                                      : rowFeedback.eventDate
                                      ? moment(rowFeedback.eventDate).format("DD/MM/YY")
                                      : rowFeedback.eventToDate
                                      ? `To:${moment(rowFeedback.eventToDate).format("DD/MM/YY")}`
                                      : "Select Date"}
                                  </span>
                                </div>
                                {rowFeedback.eventDate || rowFeedback.eventToDate ? (
                                  <span className="visit-selected-badge" style={{ fontSize: "9px", padding: "1px 4px" }}>
                                    {rowFeedback.eventDate && rowFeedback.eventToDate ? "Range" : "Set"}
                                  </span>
                                ) : (
                                  <ChevronDown size={13} style={{ color: "#9ca3af" }} />
                                )}
                              </button>
                            </div>

                            {/* Count-02 */}
                            <div className="visit-grid-input-group">
                              <label>Count-02</label>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                className="visit-table-input"
                                style={{ width: "100%", textAlign: "center" }}
                                value={rowFeedback.count2}
                                onChange={(e) => updateFeedbackField(visitKey, "count2", e.target.value, item)}
                              />
                            </div>

                            {/* Next Followup Date */}
                            <div className="visit-grid-input-group">
                              <label>Followup Date</label>
                              <input
                                type="date"
                                className="visit-table-input"
                                value={rowFeedback.nextFollowupDate}
                                onChange={(e) => updateFeedbackField(visitKey, "nextFollowupDate", e.target.value, item)}
                              />
                            </div>
                          </div>

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

                        </div>

                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: "center", padding: "30px 16px", color: "#64748b", background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", gridColumn: "1 / -1" }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>No visit records found.</p>
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
                    <th style={{ minWidth: '180px' }}>Courses List</th>
                    <th style={{ minWidth: '95px' }}>Count-01</th>
                    <th style={{ minWidth: '180px' }}>Event Requirements</th>
                    <th style={{ minWidth: '160px' }}>Date</th>
                    <th style={{ minWidth: '95px' }}>Count-02</th>
                    <th style={{ minWidth: '220px' }}>Client Remarks</th>
                    <th style={{ minWidth: '135px' }}>Next Followup Date</th>
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

                          {/* 1. Courses List Multi-Select */}
                          <td style={{ verticalAlign: 'middle' }}>
                            <button
                              type="button"
                              className="visit-multiselect-trigger"
                              onClick={() => setCoursesModal({ open: true, visitKey, clientName: item.client_Name })}
                              title="Click to select courses"
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                                {rowFeedback.courses.length > 0
                                  ? rowFeedback.courses.join(", ")
                                  : "Select Courses"}
                              </span>
                              {rowFeedback.courses.length > 0 ? (
                                <span className="visit-selected-badge">{rowFeedback.courses.length}</span>
                              ) : (
                                <ChevronDown size={14} style={{ color: '#9ca3af' }} />
                              )}
                            </button>
                          </td>

                          {/* 2. Count-01 (Number) */}
                          <td style={{ verticalAlign: 'middle' }}>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              className="visit-table-input"
                              value={rowFeedback.count1}
                              onChange={(e) => updateFeedbackField(visitKey, "count1", e.target.value, item)}
                            />
                          </td>

                          {/* 3. Event Requirements Multi-Select */}
                          <td style={{ verticalAlign: 'middle' }}>
                            <button
                              type="button"
                              className="visit-multiselect-trigger"
                              onClick={() => setEventsModal({ open: true, visitKey, clientName: item.client_Name })}
                              title="Click to select event requirements"
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                                {rowFeedback.eventRequirements.length > 0
                                  ? rowFeedback.eventRequirements.join(", ")
                                  : "Select Events"}
                              </span>
                              {rowFeedback.eventRequirements.length > 0 ? (
                                <span className="visit-selected-badge">{rowFeedback.eventRequirements.length}</span>
                              ) : (
                                <ChevronDown size={14} style={{ color: '#9ca3af' }} />
                              )}
                            </button>
                          </td>

                          {/* 4. Event Date (From Date & To Date Selection) */}
                          <td style={{ verticalAlign: 'middle' }}>
                            <button
                              type="button"
                              className="visit-multiselect-trigger"
                              onClick={() => setEventDateModal({ open: true, visitKey, clientName: item.client_Name })}
                              title="Click to select event From Date and To Date"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                <Calendar size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>
                                  {rowFeedback.eventDate && rowFeedback.eventToDate
                                    ? `${moment(rowFeedback.eventDate).format("DD/MM/YY")} - ${moment(rowFeedback.eventToDate).format("DD/MM/YY")}`
                                    : rowFeedback.eventDate
                                    ? moment(rowFeedback.eventDate).format("DD/MM/YYYY")
                                    : rowFeedback.eventToDate
                                    ? `To: ${moment(rowFeedback.eventToDate).format("DD/MM/YYYY")}`
                                    : "Select Date"}
                                </span>
                              </div>
                              {rowFeedback.eventDate || rowFeedback.eventToDate ? (
                                <span className="visit-selected-badge" style={{ fontSize: '10px', padding: '1px 5px' }}>
                                  {rowFeedback.eventDate && rowFeedback.eventToDate ? "Range" : "Set"}
                                </span>
                              ) : (
                                <ChevronDown size={14} style={{ color: '#9ca3af' }} />
                              )}
                            </button>
                          </td>

                          {/* 5. Count-02 (Number) */}
                          <td style={{ verticalAlign: 'middle' }}>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              className="visit-table-input"
                              value={rowFeedback.count2}
                              onChange={(e) => updateFeedbackField(visitKey, "count2", e.target.value, item)}
                            />
                          </td>

                          {/* 6. Client Remarks */}
                          <td style={{ verticalAlign: 'middle' }}>
                            <input
                              type="text"
                              placeholder="Client remarks..."
                              className="visit-table-input"
                              value={rowFeedback.clientRemarks}
                              onChange={(e) => updateFeedbackField(visitKey, "clientRemarks", e.target.value, item)}
                            />
                          </td>

                          {/* 7. Next Followup Date */}
                          <td style={{ verticalAlign: 'middle' }}>
                            <input
                              type="date"
                              className="visit-table-input"
                              value={rowFeedback.nextFollowupDate}
                              onChange={(e) => updateFeedbackField(visitKey, "nextFollowupDate", e.target.value, item)}
                            />
                          </td>

                          {/* Action: Save Row Feedback */}
                          <td style={{ verticalAlign: 'middle' }}>
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
                            <label
                              key={course.name}
                              className={`course-checkbox-item ${isSelected ? "selected" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleCourseSelection(coursesModal.visitKey, course.name, { client_Name: coursesModal.clientName })}
                              />
                              <span>{course.name}</span>
                              <span className="course-duration-badge">{course.duration}</span>
                            </label>
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
                      onClick={() => updateFeedbackField(coursesModal.visitKey, "courses", [], { client_Name: coursesModal.clientName })}
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
                    const isSelected = getRowFeedback(eventsModal.visitKey).eventRequirements.includes(evt);

                    return (
                      <label
                        key={evt}
                        className={`course-checkbox-item ${isSelected ? "selected" : ""}`}
                        style={{ padding: "10px 14px", fontSize: "13px" }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleEventSelection(eventsModal.visitKey, evt, { client_Name: eventsModal.clientName })}
                        />
                        <span>{evt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="feedback-modal-footer">
                <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#475569" }}>
                  Selected: <strong>{getRowFeedback(eventsModal.visitKey).eventRequirements.length}</strong> events
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  {getRowFeedback(eventsModal.visitKey).eventRequirements.length > 0 && (
                    <button
                      type="button"
                      className="stock-button stock-button--secondary"
                      style={{ padding: "6px 12px", height: "auto", fontSize: "12px" }}
                      onClick={() => updateFeedbackField(eventsModal.visitKey, "eventRequirements", [], { client_Name: eventsModal.clientName })}
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
                      value={getRowFeedback(eventDateModal.visitKey).eventDate}
                      onChange={(e) => updateFeedbackField(eventDateModal.visitKey, "eventDate", e.target.value, { client_Name: eventDateModal.clientName })}
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
                      value={getRowFeedback(eventDateModal.visitKey).eventToDate}
                      onChange={(e) => updateFeedbackField(eventDateModal.visitKey, "eventToDate", e.target.value, { client_Name: eventDateModal.clientName })}
                    />
                  </div>
                </div>

                {/* Date Summary Preview */}
                {(getRowFeedback(eventDateModal.visitKey).eventDate || getRowFeedback(eventDateModal.visitKey).eventToDate) && (
                  <div style={{ marginTop: "16px", padding: "10px 12px", background: "#f1f5f9", borderRadius: "8px", fontSize: "12px", color: "#475569" }}>
                    <strong>Selected Range: </strong>
                    {getRowFeedback(eventDateModal.visitKey).eventDate ? moment(getRowFeedback(eventDateModal.visitKey).eventDate).format("DD/MM/YYYY") : "Not set"}
                    {" \u2192 "}
                    {getRowFeedback(eventDateModal.visitKey).eventToDate ? moment(getRowFeedback(eventDateModal.visitKey).eventToDate).format("DD/MM/YYYY") : "Not set"}
                  </div>
                )}
              </div>

              <div className="feedback-modal-footer">
                <div>
                  {(getRowFeedback(eventDateModal.visitKey).eventDate || getRowFeedback(eventDateModal.visitKey).eventToDate) && (
                    <button
                      type="button"
                      className="stock-button stock-button--secondary"
                      style={{ padding: "6px 12px", height: "auto", fontSize: "12px" }}
                      onClick={() => {
                        updateFeedbackField(eventDateModal.visitKey, "eventDate", "", { client_Name: eventDateModal.clientName });
                        updateFeedbackField(eventDateModal.visitKey, "eventToDate", "", { client_Name: eventDateModal.clientName });
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
      </IonContent>
    </IonPage>
  );
};

export default VisitTickets;