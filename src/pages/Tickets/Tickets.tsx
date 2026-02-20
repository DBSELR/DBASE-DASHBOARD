import React, { useEffect, useMemo, useState } from "react";
import {
  IonPage, IonContent, IonCard, IonCardContent, IonGrid, IonRow, IonCol, IonButton,
  IonItem, IonLabel, IonSelect, IonSelectOption, IonInput, IonAccordionGroup, IonAccordion
} from "@ionic/react";
import { useHistory } from "react-router";
import moment from "moment";
import DashboardButtons from "./DashboardButtons";
import SupportTickets from "./SupportTickets";
import AssignedTickets from "./AssignedTickets";
import TicketData from "./components/TicketData";
import RaiseTicket from "./RaiseTicket";
import ProjectWiseTickets from "./ProjectWiseTickets";


const API_BASE =
  import.meta.env.DEV
    ? '/api/'                                  // <-- goes through vite proxy locally
    : (import.meta.env.VITE_API_BASE ?? 'https://dbsapi.dbasesolutions.in/');
const EMP_CODE = localStorage.getItem("EmpCode") ?? "";             // set during login
const P_INCHARGE = localStorage.getItem("P_Incharge") ?? "";        // set during login

type Project = { P_ID: string; project: string };
type Client = { Client_Id: string; Client_Name: string };
type TicketRow = {
  TicketID: string;
  Client: string;
  Client_Name: string;
  Date: string;            // dd-MM-yyyy from server
  REMARKS: string;
  Employee: string;
  Issue_Status: string;
  TaskRemark: string;
  ClientId?: string;
  Project?: string;
};

export default function Tickets() {
  const history = useHistory();

  // shared filters (kept here; subcomponents read from props)
  const [clientId, setClientId] = useState("0");
  const [projectId, setProjectId] = useState("0");
  const [fromDate, setFromDate] = useState(moment());
  const [toDate, setToDate] = useState(moment());

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // panels
  const [showSupportPanel, setShowSupportPanel] = useState(false);
  const [showTSLPanel, setShowTSLPanel] = useState(false);

  // TSL (Ticket Status List)
  const [tslType, setTslType] = useState("0");
  const [masterRows, setMasterRows] = useState<TicketRow[]>([]);
  const [holdRows, setHoldRows] = useState<TicketRow[]>([]);
  const [rows, setRows] = useState<TicketRow[]>([]);

  const dates = useMemo(() => ({
    from: fromDate.format("YYYY-MM-DD"),
    to: toDate.format("YYYY-MM-DD"),
  }), [fromDate, toDate]);

  // ---------- init ----------
  useEffect(() => {
    // role/visibility like Angular setTicketInitial
    const supportRoles = ["1524", "1509", "1532", "1501"];
    if (supportRoles.includes(EMP_CODE) || P_INCHARGE === "INCHARGE_BEAT" || P_INCHARGE === "INCHARGE_BOAT") {
      setShowSupportPanel(true);
    }
    if (EMP_CODE === "1540") {
      setShowTSLPanel(true);
      void loadTSL(); // initial load
    }
    void loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- loads ----------
  async function loadClients() {
    try {
      // TODO: point to your real "clients list" endpoint
      const res = await fetch(`${API_BASE}Tickets/LOADCLIENTS`);
      const data = await res.json();
      setClients(data ?? []);
    } catch { setClients([]); }
  }

  async function loadProjectsByClient(cid: string) {
    if (!cid || cid === "0") { setProjects([]); return; }
    try {
      const res = await fetch(`${API_BASE}Tickets/LOADCLIENTSPROJECTLIST?ClientId=${cid}`);
      const data = await res.json();
      setProjects(data ?? []);
    } catch { setProjects([]); }
  }

  async function loadTSL() {
    // Load_All_Tickets_Data()
    const q = new URLSearchParams({
      ClientId: clientId,
      PT: projectId,
      Date: dates.from,
      ToDate: dates.to,
      staus: tslType,
    });
    const res = await fetch(`${API_BASE}Tickets/Load_Issues_New?${q.toString()}`);
    const data = await res.json();
    setMasterRows(data ?? []);
    setHoldRows(data ?? []);
    setRows(data ?? []);
  }

  // ---------- handlers ----------
  const onClientChange = async (cid: string) => {
    setClientId(cid);
    setProjectId("0");
    setTslType("0");
    await loadProjectsByClient(cid);

    if (EMP_CODE === "1540") {
      // clientId based TSL filter
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
  };

  const onToDateChange = async (iso: string) => {
    const m = moment(iso);
    setToDate(m);
    if (EMP_CODE === "1540") {
      await loadTSL();
      filterByDates(fromDate, m);
    }
  };

  const filterByTicketType = (val: string) => {
    setTslType(val);
    const src = clientId !== "0" ? holdRows : masterRows;
    setRows(val === "0" ? src : src.filter(r => r.Issue_Status === val));
  };

  const filterByDates = (fd: moment.Moment, td: moment.Moment) => {
    setTslType("0");
    const temp = holdRows.filter(r => {
      // r.Date is dd-MM-YYYY -> convert
      const [dd, mm, yyyy] = r.Date.split("-");
      const d = moment(`${yyyy}-${mm}-${dd}`);
      return d.isSame(fd, "day") || d.isBetween(fd, td, "day", "[]");
    });
    setRows(temp);
    setHoldRows(temp);
  };

  const statusTextStyle = (s: string) => {
    const t = (s ?? "").trim();
    if (t === "In Progress") return { color: "Brown" };
    if (t === "Assigned") return { color: "Blue" };
    if (t === "Closed") return { color: "Green" };
    return { color: "Black" };
  };

  return (
    <IonPage>
      <IonContent>
        <div className="appsub-container">
          <IonCard className="mat-elevation-z8" style={{ backgroundColor: "rgb(247, 250, 247)" }}>
            <IonCardContent>

              {/* header + quick nav buttons */}
              <IonRow style={{ marginTop: -25 }}>
                <IonCol size="12" sizeSm="6" sizeMd="8" sizeLg="7" sizeXl="7">
                  <h2 className="heading-shadow">TASK(S) LIST</h2>
                </IonCol>
                <IonCol size="6" sizeSm="3" sizeMd="2" sizeLg="2" sizeXl="2" style={{ marginTop: 20 }}>
                  <IonButton expand="block" color="primary" onClick={() => history.push("/tickets/raisedticket")} style={{ height: 30 }}>
                    RaiseTicket
                  </IonButton>
                </IonCol>
                <IonCol size="6" sizeSm="3" sizeMd="2" sizeLg="2" sizeXl="2" style={{ marginTop: 20 }}>
                  <IonButton expand="block" color="primary" onClick={() => history.push("/tickets/ticketdata")} style={{ height: 30 }}>
                    ExportTickets
                  </IonButton>
                </IonCol>
              </IonRow>

              {/* filters */}
              <IonGrid style={{ marginTop: -8 }}>
                <IonRow>
                  <IonCol size="12" sizeSm="6" sizeMd="3">
                    <IonItem>
                      <IonLabel position="stacked">Select Client</IonLabel>
                      <IonSelect value={clientId} onIonChange={(e) => onClientChange(e.detail.value)}>
                        <IonSelectOption value="0">-- Select --</IonSelectOption>
                        {clients.map(c => (
                          <IonSelectOption key={c.Client_Id} value={c.Client_Id}>{c.Client_Name}</IonSelectOption>
                        ))}
                      </IonSelect>
                    </IonItem>
                  </IonCol>

                  <IonCol size="12" sizeSm="6" sizeMd="3">
                    <IonItem>
                      <IonLabel position="stacked">Select Project</IonLabel>
                      <IonSelect value={projectId} onIonChange={(e) => onProjectChange(e.detail.value)}>
                        <IonSelectOption value="0">-- Select --</IonSelectOption>
                        {projects.map(p => (
                          <IonSelectOption key={p.P_ID} value={p.P_ID}>{p.project}</IonSelectOption>
                        ))}
                      </IonSelect>
                    </IonItem>
                  </IonCol>

                  <IonCol size="12" sizeSm="6" sizeMd="3">
                    <IonItem>
                      <IonLabel position="stacked">From Date</IonLabel>
                      <IonInput type="date" value={fromDate.format("YYYY-MM-DD")}
                        max={moment().format("YYYY-MM-DD")}
                        onIonChange={(e) => e.detail.value && onFromDateChange(e.detail.value)} />
                    </IonItem>
                  </IonCol>

                  <IonCol size="12" sizeSm="6" sizeMd="3">
                    <IonItem>
                      <IonLabel position="stacked">To Date</IonLabel>
                      <IonInput type="date" value={toDate.format("YYYY-MM-DD")}
                        min={fromDate.format("YYYY-MM-DD")} max={moment().format("YYYY-MM-DD")}
                        onIonChange={(e) => e.detail.value && onToDateChange(e.detail.value)} />
                    </IonItem>
                  </IonCol>
                </IonRow>
              </IonGrid>

              {/* dashboard chips */}
              <DashboardButtons
                apiBase={API_BASE}
                empCode={EMP_CODE}
                fromDate={dates.from}
                toDate={dates.to}
                clientId={clientId}
                projectId={projectId}
              />

              {/* accordion sections */}
              <IonAccordionGroup multiple={true}>
                {/* Support Tasks */}
                {showSupportPanel && (
                  <IonAccordion value="support">
                    <IonItem slot="header" color="light">
                      <IonLabel className="panel-heading">Support Task(s)</IonLabel>
                    </IonItem>
                    <div slot="content">
                      <SupportTickets apiBase={API_BASE} />
                    </div>
                  </IonAccordion>
                )}

                {/* Ticket Status List */}
                {showTSLPanel && (
                  <IonAccordion value="tsl">
                    <IonItem slot="header" color="light">
                      <IonGrid style={{ padding: 0 }}>
                        <IonRow className="tsl-header">
                          <IonCol size="12" sizeMd="9">
                            <span className="panel-heading">Ticket Status List</span>
                          </IonCol>
                          <IonCol size="12" sizeMd="3">
                            <IonItem lines="none" style={{ "--inner-padding-end": "0" }}>
                              <IonLabel position="stacked">Ticket Type</IonLabel>
                              <IonSelect value={tslType} onIonChange={(e) => filterByTicketType(e.detail.value)}>
                                <IonSelectOption value="0">All</IonSelectOption>
                                <IonSelectOption value="In Progress">In Progress</IonSelectOption>
                                <IonSelectOption value="Assigned">Assigned</IonSelectOption>
                                <IonSelectOption value="Open">Open</IonSelectOption>
                                <IonSelectOption value="Hold">Hold</IonSelectOption>
                                <IonSelectOption value="Closed">Closed</IonSelectOption>
                                <IonSelectOption value="ReOpen">ReOpen</IonSelectOption>
                              </IonSelect>
                            </IonItem>
                          </IonCol>
                        </IonRow>
                      </IonGrid>
                    </IonItem>

                    <div slot="content" className="example-container">
                      <div className="table">
                        <div className="thead">
                          <div>Sno</div>
                          <div>TicketNo</div>
                          <div>Client</div>
                          <div>UserName</div>
                          <div>Date</div>
                          <div>Issue</div>
                          <div>Developer</div>
                          <div>Status</div>
                          <div>ClosedRemarkes</div>
                        </div>
                        {rows.map((r, idx) => (
                          <div className="trow" key={r.TicketID}>
                            <div>&nbsp;&nbsp;{idx + 1}</div>
                            <div>{r.TicketID}</div>
                            <div>{r.Client}</div>
                            <div>{r.Client_Name}</div>
                            <div style={{ whiteSpace: "nowrap" }}>{r.Date}</div>
                            <div style={{ color: "blue", padding: "0 5px" }}>{r.REMARKS}</div>
                            <div>{r.Employee}</div>
                            <div style={statusTextStyle(r.Issue_Status)}>{r.Issue_Status}</div>
                            <div>{r.TaskRemark}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </IonAccordion>
                )}

                {/* Assigned Tasks */}
                <IonAccordion value="assigned">
                  <IonItem slot="header" color="light">
                    <IonLabel className="panel-heading">Assigned Task(s)</IonLabel>
                  </IonItem>
                  <div slot="content">
                    <AssignedTickets apiBase={API_BASE} empCode={EMP_CODE} />
                  </div>
                </IonAccordion>
              </IonAccordionGroup>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
}
