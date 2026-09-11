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
  ChevronDown
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
];

interface VisitFeedbackRowData {
  courses: string[];
  count1: string;
  eventRequirements: string[];
  eventDate: string;
  count2: string;
  clientRemarks: string;
  nextFollowupDate: string;
  saved?: boolean;
}

const VisitTickets: React.FC = () => {
  const history = useHistory();
  const [tickets, setTickets] = useState<VisitTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const today = moment().format("YYYY-MM-DD");

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
  const [ticketList, setTicketList] = useState<Ticket[]>([]);

  // Projects dropdown state
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("0");

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

  // Load Closed Tickets (Tickets FeedBack tab)
  const loadClosedTickets = async (from?: string, to?: string, projId?: string) => {
    try {
      setLoading(true);

      const currentProjectId = projId !== undefined ? projId : selectedProjectId;
      const projectParam = currentProjectId === "ALL" ? "0" : (currentProjectId || "0");

      const paramsObj: Record<string, string> = {
        ClientID: "0",
        ProjectID: projectParam,
        status: "C",
        EMPCODE: "0",
      };

      // If date filter is provided, use it; otherwise, fetch all dates
      if (from && from.trim()) {
        paramsObj["Date"] = moment(from).format("YYYY-MM-DD");
      } else {
        paramsObj["Date"] = "2000-01-01";
      }

      if (to && to.trim()) {
        paramsObj["ToDate"] = moment(to).format("YYYY-MM-DD");
      } else {
        paramsObj["ToDate"] = moment().add(1, "year").format("YYYY-MM-DD");
      }

      const params = new URLSearchParams(paramsObj);
      const url = `${API_BASE}Tickets/Load_LOADSUPPORTTICKETS_DateWise_FromTo?${params.toString()}`;
      const headers = getHeaders(true);

      console.log("%c[VisitTickets] loadClosedTickets START", "color: #3b82f6; font-weight: bold;", {
        url,
        endpoint: "Tickets/Load_LOADSUPPORTTICKETS_DateWise_FromTo",
        payload: paramsObj,
        headers,
        activeTab: "tickets",
        selectedProjectId: currentProjectId,
        selectedProjectName: projects.find((p) => p.id === currentProjectId)?.name || (projectParam === "0" ? "All Projects" : projectParam),
      });

      const res = await fetch(url, { headers });
      console.log("[VisitTickets] loadClosedTickets Response Status:", {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
      });

      const raw = await handleResponse(res);
      console.log("[VisitTickets] loadClosedTickets RAW Response Payload:", raw);
      console.log(`[VisitTickets] loadClosedTickets Count: ${Array.isArray(raw) ? raw.length : 0} records`);

      const mapped = raw.map(mapTicketRow);
      console.log("[VisitTickets] loadClosedTickets Mapped Result:", mapped);
      if (mapped.length > 0) {
        console.log("[VisitTickets] loadClosedTickets Sample Record [0]:", mapped[0]);
      }

      setTicketList(mapped);
    } catch (err) {
      console.error("[VisitTickets] loadClosedTickets ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load On-Duty Visits (Visits FeedBack tab)
  const loadTickets = async (from?: string, to?: string, projId?: string) => {
    try {
      setLoading(true);

      const currentProjectId = projId !== undefined ? projId : selectedProjectId;

      const paramsObj: Record<string, string> = {};
      // ONLY append fromDate and toDate if explicitly selected!
      if (from && from.trim()) {
        paramsObj["fromDate"] = moment(from).format("YYYY-MM-DD");
      }
      if (to && to.trim()) {
        paramsObj["toDate"] = moment(to).format("YYYY-MM-DD");
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

      const response = await fetch(url, { headers });
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
            const fDate = item.nextFollowupDate || item.NextFollowupDate ? moment(item.nextFollowupDate || item.NextFollowupDate).format("YYYY-MM-DD") : "";
            const remarks = item.clientRemarks || item.ClientRemarks || "";
            const hasServerData = Boolean(serverCourses.length > 0 || c1 || serverEvents.length > 0 || eDate || c2 || remarks || fDate);

            updated[vKey] = {
              courses: serverCourses.length > 0 ? serverCourses : (existing?.courses || []),
              count1: c1 || existing?.count1 || "",
              eventRequirements: serverEvents.length > 0 ? serverEvents : (existing?.eventRequirements || []),
              eventDate: eDate || existing?.eventDate || "",
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
      tokenPresent: Boolean(localStorage.getItem("token")),
    });
    void loadProjectsList();
  }, []);

  // When active tab changes, fetch corresponding data (shows all by default if no date filter is selected)
  useEffect(() => {
    console.log("%c[VisitTickets] Active Tab Switched ->", "color: #6366f1; font-weight: bold;", activeTab, {
      fromDate: fromDate || "All Dates",
      toDate: toDate || "All Dates",
      selectedProjectId,
    });
    if (activeTab === "tickets") {
      loadClosedTickets(fromDate, toDate, selectedProjectId);
    } else {
      loadTickets(fromDate, toDate, selectedProjectId);
    }
  }, [activeTab]);

  // Project dropdown change handler
  const handleProjectChange = (newProjId: string) => {
    const projName = projects.find((p) => p.id === newProjId)?.name || (newProjId === "0" ? "All Projects" : newProjId);
    console.log("%c[VisitTickets] Project Filter Changed", "color: #f59e0b; font-weight: bold;", {
      previousProjectId: selectedProjectId,
      newProjectId: newProjId,
      projectName: projName,
      activeTab,
      fromDate: fromDate || "All Dates",
      toDate: toDate || "All Dates",
    });
    setSelectedProjectId(newProjId);
    if (activeTab === "tickets") {
      loadClosedTickets(fromDate, toDate, newProjId);
    } else {
      loadTickets(fromDate, toDate, newProjId);
    }
  };

  // Filter visits client-side by selected project (in case API returns all or partial)
  const displayedVisits = useMemo(() => {
    if (!selectedProjectId || selectedProjectId === "0" || selectedProjectId === "ALL") {
      return tickets;
    }
    const selectedProjObj = projects.find((p) => p.id === selectedProjectId);
    const targetName = selectedProjObj ? selectedProjObj.name.toLowerCase().trim() : "";
    if (!targetName) return tickets;

    const filtered = tickets.filter((item) => {
      if (!item.projects) return false;
      const itemProj = String(item.projects).toLowerCase().trim();
      return itemProj.includes(targetName) || String(item.projects).trim() === selectedProjectId;
    });

    console.log("[VisitTickets] Filtered Visits by Project:", {
      selectedProjectId,
      projectName: selectedProjObj?.name,
      totalVisits: tickets.length,
      matchingVisits: filtered.length,
    });

    return filtered;
  }, [tickets, selectedProjectId, projects]);

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
            
            {/* Tabs (Maintained with stock-tabs styling) */}
            <div className="stock-tabs" style={{ background: 'transparent', boxShadow: 'none', padding: '0 0 16px 0', borderBottom: '1px solid var(--stock-border)' }}>
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
                <div id="from-date-trigger" className="stock-input" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', minHeight: '38px', color: fromDate ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                  {fromDate ? moment(fromDate).format("DD/MM/YYYY") : "Select Date"}
                </div>
                <IonPopover trigger="from-date-trigger" triggerAction="click" alignment="start">
                  <IonDatetime
                    presentation="date"
                    value={fromDate}
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
                <div id="to-date-trigger" className="stock-input" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', minHeight: '38px', color: toDate ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                  {toDate ? moment(toDate).format("DD/MM/YYYY") : "Select Date"}
                </div>
                <IonPopover trigger="to-date-trigger" triggerAction="click" alignment="start">
                  <IonDatetime
                    presentation="date"
                    value={toDate}
                    onIonChange={(e) => {
                      const val = (e.detail.value as string).split('T')[0];
                      console.log("[VisitTickets] To Date changed:", val);
                      setToDate(val);
                    }}
                  />
                </IonPopover>
              </div>

              {/* Action Buttons */}
              <div className="stock-field">
                {/* Spacer label to align vertically with date inputs */}
                <label className="hide-on-mobile">&nbsp;</label>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', height: '100%', alignItems: 'flex-end' }}>
                  <button 
                    className="stock-button" 
                    style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                    onClick={() => {
                      console.log("%c[VisitTickets] 'Apply Filter' Clicked - Payload:", "color: #3b82f6; font-weight: bold;", {
                        activeTab,
                        fromDate: fromDate || "All Dates",
                        toDate: toDate || "All Dates",
                        selectedProjectId,
                        projectName: projects.find((p) => p.id === selectedProjectId)?.name || "All Projects",
                      });
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
                    style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                    onClick={() => {
                      console.log("%c[VisitTickets] 'Reset' Filters Clicked", "color: #ef4444; font-weight: bold;", {
                        resetProject: "0",
                        activeTab,
                      });
                      setFromDate("");
                      setToDate("");
                      setSelectedProjectId("0");
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

          {/* Table Panel */}
          <div className="visit-panel" style={{ margin: '0 16px 20px 16px' }}>
            <div className="visit-table-wrapper">

        {activeTab === "tickets" ? (

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
              {ticketList.length > 0 ? (
                ticketList.map((item, index) => (
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

        ) : (

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
                <th style={{ minWidth: '135px' }}>Date</th>
                <th style={{ minWidth: '95px' }}>Count-02</th>
                <th style={{ minWidth: '220px' }}>Client Remarks</th>
                <th style={{ minWidth: '135px' }}>Next Followup Date</th>
                <th style={{ minWidth: '95px' }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {displayedVisits.length > 0 ? (
                displayedVisits.map((item, index) => {
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

                      {/* 4. Date (Event Date) */}
                      <td style={{ verticalAlign: 'middle' }}>
                        <input
                          type="date"
                          className="visit-table-input"
                          value={rowFeedback.eventDate}
                          onChange={(e) => updateFeedbackField(visitKey, "eventDate", e.target.value, item)}
                        />
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

        )}

      </div>

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

        <IonLoading isOpen={loading} message="Loading..." />
      </IonContent>
    </IonPage>
  );
};

export default VisitTickets;