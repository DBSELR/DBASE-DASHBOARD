import React, { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router";
import moment from "moment";
import {
  IonSelect,
  IonSelectOption,
  IonDatetime,
  IonModal,
  IonButton,
  IonIcon,
  IonPage,
  IonContent
} from "@ionic/react";
import {
  Filter,
  Calendar,
  ChevronDown,
  PlusCircle,
  Download,
  LayoutGrid,
  ClipboardList,
  UserCheck,
  Clock,
  Ticket,
  ChevronRight,
  MoreVertical,
  X
} from "lucide-react";
import DashboardButtons from "./DashboardButtons";
import SupportTickets from "./SupportTickets";
import AssignedTickets from "./AssignedTickets";
import "./Tickets.css";

import { API_BASE } from "../../config";

const user = JSON.parse(localStorage.getItem("user") || "{}");
const EMP_CODE = user?.empCode || "";
const P_INCHARGE = user?.p_Incharge || "";

const getHeaders = (isGet = false) => {
  const token = localStorage.getItem("token")?.replace(/"/g, "");
  const headers: any = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  if (!isGet) headers["Content-Type"] = "application/json";
  return headers;
};

const handleResponse = async (res: Response, tag: string) => {
  if (!res.ok) return [];
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (typeof json === "string") return JSON.parse(json);
    return json;
  } catch (err) {
    console.error(`[${tag}] parse error:`, err);
    return [];
  }
};

type Project = { P_ID: string; project: string };
type Client = { Client_Id: string; Client_Name: string };
type TicketRow = {
  TicketID: string;
  Client: string;
  Client_Name: string;
  Date: string;
  REMARKS: string;
  Employee: string;
  Issue_Status: string;
  TaskRemark: string;
  ClientId?: string;
  Project?: string;
};

export default function Tickets() {
  const history = useHistory();

  // shared filters
  const [clientId, setClientId] = useState("0");
  const [projectId, setProjectId] = useState("0");
  const [fromDate, setFromDate] = useState(moment());
  const [toDate, setToDate] = useState(moment());

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [showSupportPanel, setShowSupportPanel] = useState(false);
  const [showTSLPanel, setShowTSLPanel] = useState(false);

  // Accordion state
  const [expandedSection, setExpandedSection] = useState<string | null>("support");

  // Counts
  const [supportCount, setSupportCount] = useState(0);
  const [assignedCount, setAssignedCount] = useState(0);

  // TSL (Ticket Status List)
  const [tslType, setTslType] = useState("0");
  const [masterRows, setMasterRows] = useState<TicketRow[]>([]);
  const [holdRows, setHoldRows] = useState<TicketRow[]>([]);
  const [rows, setRows] = useState<TicketRow[]>([]);

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const dates = useMemo(() => ({
    from: fromDate.format("YYYY-MM-DD"),
    to: toDate.format("YYYY-MM-DD"),
  }), [fromDate, toDate]);

  useEffect(() => {
    const supportRoles = ["1524", "1509", "1532", "1501", "1520", "1539", "1547"];
    if (supportRoles.includes(EMP_CODE)) {
      setShowSupportPanel(true);
    }
    if (EMP_CODE === "1540") {
      setShowTSLPanel(true);
      void loadTSL();
    }
    void loadClients();
  }, []);

  async function loadClients() {
    const url = `${API_BASE}Sources/Load_Clients_Sources`;
    const headers = getHeaders(true);
    console.log("[Tickets] loadClients START", { url, headers });
    try {
      const res = await fetch(url, { headers });
      console.log("[Tickets] loadClients RESPONSE", { status: res.status });
      const data = await handleResponse(res, "CLIENTS");
      console.log("[Tickets] loadClients DATA", data?.length, "rows");
      const mapped = (data || []).map((row: any) => ({
        Client_Id: String(row[0]),
        Client_Name: String(row[1])
      }));
      setClients(mapped);
    } catch (err) {
      console.error("[Tickets] loadClients ERROR", err);
      setClients([]);
    }
  }

  async function loadProjectsByClient(cid: string) {
    if (!cid || cid === "0") { setProjects([]); return; }
    const url = `${API_BASE}Sources/Load_Project_Sources?CID=${cid}`;
    const headers = getHeaders(true);
    console.log("[Tickets] loadProjectsByClient START", { cid, url, headers });
    try {
      const res = await fetch(url, { headers });
      console.log("[Tickets] loadProjectsByClient RESPONSE", { status: res.status });
      const data = await handleResponse(res, "PROJECTS");
      console.log("[Tickets] loadProjectsByClient DATA", data?.length, "rows");
      const mapped = (data || []).map((row: any) => ({
        P_ID: String(row[0]),
        project: String(row[1])
      }));
      setProjects(mapped);
    } catch (err) {
      console.error("[Tickets] loadProjectsByClient ERROR", err);
      setProjects([]);
    }
  }

  async function loadTSL() {
    const dFrom = moment(fromDate).format("MM-DD-YYYY");
    const dTo = moment(toDate).format("MM-DD-YYYY");
    const q = new URLSearchParams({
      ClientId: clientId,
      PT: projectId,
      Date: dFrom,
      ToDate: dTo,
      status: tslType,
      EMPCODE: EMP_CODE
    });

    const url = `${API_BASE}Tickets/Load_Issues_New?${q.toString()}`;
    const headers = getHeaders(true);
    console.log("[Tickets] loadTSL START", { url, headers, params: Object.fromEntries(q) });

    try {
      const res = await fetch(url, { headers });
      console.log("[Tickets] loadTSL RESPONSE", { status: res.status });
      const raw = await handleResponse(res, "TSL");
      console.log("[Tickets] loadTSL DATA", raw?.length, "rows");
      const mapped: TicketRow[] = (raw || []).map((r: any) => ({
        TicketID: String(r[1] || r[0]),
        Client: r[2],
        Client_Name: r[2],
        Date: r[8],
        REMARKS: r[29] || r[9],
        Employee: r[16],
        Issue_Status: r[21] || r[7],
        TaskRemark: r[30] || r[15] || "",
        ClientId: String(r[24] || ""),
        Project: r[3]
      }));

      setMasterRows(mapped);
      setHoldRows(mapped);
      setRows(mapped);
    } catch (err) {
      console.error("[Tickets] loadTSL ERROR", err);
      setMasterRows([]);
    }
  }

  const onClientChange = async (cid: string) => {
    setClientId(cid);
    setProjectId("0");
    setTslType("0");
    await loadProjectsByClient(cid);

    if (EMP_CODE === "1540") {
      const filtered = masterRows.filter(r => r.ClientId === cid);
      setRows(filtered);
      setHoldRows(filtered);
    }
  };

  const onProjectChange = (pid: string) => {
    setProjectId(pid);
    if (EMP_CODE === "1540") {
      setTslType("0");
      const name = projects.find(p => p.P_ID === pid)?.project;
      if (!name) return;
      const filtered = masterRows.filter(r => r.ClientId === clientId && r.Project === name);
      setRows(filtered);
      setHoldRows(filtered);
    }
  };

  const onFromDateChange = async (iso: string) => {
    const m = moment(iso);
    setFromDate(m);
    if (EMP_CODE === "1540") {
      await loadTSL();
      filterByDates(m, toDate);
    }
    setShowFromPicker(false);
  };

  const onToDateChange = async (iso: string) => {
    const m = moment(iso);
    setToDate(m);
    if (EMP_CODE === "1540") {
      await loadTSL();
      filterByDates(fromDate, m);
    }
    setShowToPicker(false);
  };

  const filterByTicketType = (val: string) => {
    setTslType(val);
    const src = clientId !== "0" ? holdRows : masterRows;
    setRows(val === "0" ? src : src.filter(r => r.Issue_Status === val));
  };

  const filterByDates = (fd: moment.Moment, td: moment.Moment) => {
    setTslType("0");
    const temp = holdRows.filter(r => {
      const [dd, mm, yyyy] = r.Date.split("-");
      const d = moment(`${yyyy}-${mm}-${dd}`);
      return d.isSame(fd, "day") || d.isBetween(fd, td, "day", "[]");
    });
    setRows(temp);
    setHoldRows(temp);
  };

  const getStatusClass = (s: string) => {
    const t = (s ?? "").trim().toLowerCase();
    if (t.includes("progress")) return "badge-pending";
    if (t.includes("assigned")) return "badge-assigned";
    if (t.includes("closed")) return "badge-closed";
    if (t.includes("open")) return "badge-open";
    if (t.includes("hold")) return "badge-hold";
    if (t.includes("reopen")) return "badge-reopen";
    return "";
  };

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  return (
    <IonPage className="dbase-tickets-root">
      <IonContent className="dbase-tickets-content-scroller">
        <div className="dbase-tickets-container">

          {/* Header */}
          <div className="dbase-tickets-header dbase-animate-fade">
            <div className="dbase-tickets-title-row">
              <h1 className="dbase-tickets-title">Ticket Hub</h1>
              <div className="dbase-tickets-header-actions">
                <button className="dbase-tickets-btn dbase-tickets-btn-secondary" onClick={() => history.push("/tickets/ticketdata")}>
                  <Download size={18} />
                  <span className="hidden-mobile">Export</span>
                </button>
                <button className="dbase-tickets-btn dbase-tickets-btn-primary" onClick={() => history.push("/tickets/raisedticket")}>
                  <PlusCircle size={18} />
                  <span className="hidden-mobile">Raise</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="dbase-tickets-filters-wrap dbase-animate-fade">
            <div className="dbase-tickets-filter-bar">

              {/* Client Filter */}
              <div className="dbase-tickets-filter-item">
                <div className="dbase-tickets-filter-icon">
                  <UserCheck size={20} />
                </div>
                <div className="dbase-tickets-filter-content">
                  <span className="dbase-tickets-filter-label">Client</span>
                  <IonSelect
                    interface="popover"
                    value={clientId}
                    className="dbase-tickets-ion-select"
                    onIonChange={(e) => onClientChange(e.detail.value)}
                  >
                    <IonSelectOption value="0">All Clients</IonSelectOption>
                    {clients.map(c => (
                      <IonSelectOption key={c.Client_Id} value={c.Client_Id}>{c.Client_Name}</IonSelectOption>
                    ))}
                  </IonSelect>
                </div>
              </div>

              {/* Project Filter */}
              <div className="dbase-tickets-filter-item">
                <div className="dbase-tickets-filter-icon">
                  <LayoutGrid size={20} />
                </div>
                <div className="dbase-tickets-filter-content">
                  <span className="dbase-tickets-filter-label">Project</span>
                  <IonSelect
                    interface="popover"
                    value={projectId}
                    className="dbase-tickets-ion-select"
                    onIonChange={(e) => onProjectChange(e.detail.value)}
                  >
                    <IonSelectOption value="0">All Projects</IonSelectOption>
                    {projects.map(p => (
                      <IonSelectOption key={p.P_ID} value={p.P_ID}>{p.project}</IonSelectOption>
                    ))}
                  </IonSelect>
                </div>
              </div>

              {/* From Date Filter */}
              <div className="dbase-tickets-filter-item" onClick={() => setShowFromPicker(true)}>
                <div className="dbase-tickets-filter-icon">
                  <Calendar size={20} />
                </div>
                <div className="dbase-tickets-filter-content">
                  <span className="dbase-tickets-filter-label">From Date</span>
                  <div className="dbase-tickets-filter-value">
                    {fromDate.format("DD MMM YYYY")}
                  </div>
                </div>
                <IonModal
                  isOpen={showFromPicker}
                  onDidDismiss={() => setShowFromPicker(false)}
                  className="pwt-date-modal"
                >
                  <div className="pwt-modal-content">
                    <h3 className="pwt-modal-title">Select From Date</h3>
                    <IonDatetime
                      presentation="date"
                      value={fromDate.toISOString()}
                      onIonChange={(e) => e.detail.value && onFromDateChange(e.detail.value as string)}
                      max={moment().toISOString()}
                    />
                    <IonButton
                      expand="block"
                      mode="ios"
                      fill="outline"
                      onClick={() => setShowFromPicker(false)}
                      style={{ marginTop: '16px' }}
                    >
                      Close
                    </IonButton>
                  </div>
                </IonModal>
              </div>

              {/* To Date Filter */}
              <div className="dbase-tickets-filter-item" onClick={() => setShowToPicker(true)}>
                <div className="dbase-tickets-filter-icon">
                  <Calendar size={20} />
                </div>
                <div className="dbase-tickets-filter-content">
                  <span className="dbase-tickets-filter-label">To Date</span>
                  <div className="dbase-tickets-filter-value">
                    {toDate.format("DD MMM YYYY")}
                  </div>
                </div>
                <IonModal
                  isOpen={showToPicker}
                  onDidDismiss={() => setShowToPicker(false)}
                  className="pwt-date-modal"
                >
                  <div className="pwt-modal-content">
                    <h3 className="pwt-modal-title">Select To Date</h3>
                    <IonDatetime
                      presentation="date"
                      value={toDate.toISOString()}
                      onIonChange={(e) => e.detail.value && onToDateChange(e.detail.value as string)}
                      min={fromDate.toISOString()}
                      max={moment().toISOString()}
                    />
                    <IonButton
                      expand="block"
                      mode="ios"
                      fill="outline"
                      onClick={() => setShowToPicker(false)}
                      style={{ marginTop: '16px' }}
                    >
                      Close
                    </IonButton>
                  </div>
                </IonModal>
              </div>

            </div>
          </div>

          {/* Dashboard Chips */}
          <DashboardButtons
            apiBase={API_BASE}
            empCode={EMP_CODE}
            fromDate={dates.from}
            toDate={dates.to}
            clientId={clientId}
            projectId={projectId}
          />

          {/* Accordion Content */}
          <div className="dbase-tickets-accordion dbase-animate-fade">

            {/* Support Section */}
            {showSupportPanel && (
              <div className={`dbase-tickets-accordion-item ${expandedSection === 'support' ? 'expanded' : ''}`}>
                <div className="dbase-tickets-accordion-header" onClick={() => toggleSection('support')}>
                  <div className="dbase-tickets-accordion-title">
                    <UserCheck size={20} className="dbase-tickets-header-icon" />
                    Support Ticket(s)
                    {supportCount > 0 && <span className="dbase-tickets-count-badge">{supportCount}</span>}
                  </div>
                  <ChevronDown size={20} className="dbase-tickets-chevron" />
                </div>
                <div className="dbase-tickets-accordion-content">
                  <div className="work-queue-scroller">
                    <SupportTickets
                      apiBase={API_BASE}
                      empCode={EMP_CODE}
                      pIncharge={P_INCHARGE}
                      onCountChange={setSupportCount}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Ticket Status List (Admin/Specific) */}
            {showTSLPanel && (
              <div className={`dbase-tickets-accordion-item ${expandedSection === 'tsl' ? 'expanded' : ''}`}>
                <div className="dbase-tickets-accordion-header" onClick={() => toggleSection('tsl')}>
                  <div className="dbase-tickets-accordion-title">
                    <ClipboardList size={20} className="dbase-tickets-header-icon" />
                    Ticket Status Summary
                    {rows.length > 0 && <span className="dbase-tickets-count-badge">{rows.length}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <IonSelect
                      interface="popover"
                      className="dbase-tickets-ion-select small"
                      value={tslType}
                      onClick={(e) => e.stopPropagation()}
                      onIonChange={(e) => filterByTicketType(e.detail.value)}
                    >
                      <IonSelectOption value="0">All Status</IonSelectOption>
                      <IonSelectOption value="In Progress">In Progress</IonSelectOption>
                      <IonSelectOption value="Assigned">Assigned</IonSelectOption>
                      <IonSelectOption value="Open">Open</IonSelectOption>
                      <IonSelectOption value="Hold">Hold</IonSelectOption>
                      <IonSelectOption value="Closed">Closed</IonSelectOption>
                      <IonSelectOption value="ReOpen">ReOpen</IonSelectOption>
                    </IonSelect>
                    <ChevronDown size={20} className="dbase-tickets-chevron" />
                  </div>
                </div>
                <div className="dbase-tickets-accordion-content">
                  {/* Web Table */}
                  <div className="dbase-tickets-table-container">
                    <table className="dbase-tickets-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Ticket</th>
                          <th>Client</th>
                          <th>Date</th>
                          <th>Issue</th>
                          <th>Dev</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, idx) => (
                          <tr key={r.TicketID}>
                            <td>{idx + 1}</td>
                            <td className="dbase-tickets-id">#{r.TicketID}</td>
                            <td>{r.Client}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{r.Date}</td>
                            <td style={{ maxWidth: '250px' }}>{r.REMARKS}</td>
                            <td>{r.Employee}</td>
                            <td>
                              <span className={`dbase-tickets-badge ${getStatusClass(r.Issue_Status)}`}>
                                {r.Issue_Status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="dbase-tickets-card-list">
                    {rows.map((r, idx) => (
                      <div className="dbase-tickets-item-card" key={r.TicketID}>
                        <div className="dbase-tickets-card-row">
                          <span className="dbase-tickets-id">#{r.TicketID}</span>
                          <span className={`dbase-tickets-badge ${getStatusClass(r.Issue_Status)}`}>{r.Issue_Status}</span>
                        </div>
                        <p className="dbase-tickets-remarks">{r.REMARKS}</p>
                        <div className="dbase-tickets-meta-row">
                          <div className="dbase-tickets-meta-item">
                            <UserCheck size={14} />
                            {r.Client}
                          </div>
                          <div className="dbase-tickets-meta-item">
                            <Calendar size={14} />
                            {r.Date}
                          </div>
                          <div className="dbase-tickets-meta-item">
                            <Clock size={14} />
                            {r.Employee}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Assigned Tasks */}
            <div className={`dbase-tickets-accordion-item ${expandedSection === 'assigned' ? 'expanded' : ''}`}>
              <div className="dbase-tickets-accordion-header" onClick={() => toggleSection('assigned')}>
                <div className="dbase-tickets-accordion-title">
                  <LayoutGrid size={20} className="dbase-tickets-header-icon" />
                  Assigned Ticket(s)
                  {assignedCount > 0 && <span className="dbase-tickets-count-badge">{assignedCount}</span>}
                </div>
                <ChevronDown size={20} className="dbase-tickets-chevron" />
              </div>
              <div className="dbase-tickets-accordion-content">
                <div className="work-queue-scroller">
                  <AssignedTickets
                    apiBase={API_BASE}
                    empCode={EMP_CODE}
                    fromDate={fromDate.format("YYYY-MM-DD")}
                    toDate={toDate.format("YYYY-MM-DD")}
                    clientId={clientId}
                    projectId={projectId}
                    onCountChange={setAssignedCount}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
