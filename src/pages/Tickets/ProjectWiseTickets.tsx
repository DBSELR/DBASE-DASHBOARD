import React, { useEffect, useState } from "react";
import { IonPage, IonContent, IonCard, IonCardContent, IonGrid, IonRow, IonCol, IonItem, IonLabel, IonSelect, IonSelectOption, IonInput, IonButton } from "@ionic/react";
import { useHistory } from "react-router";
import moment from "moment";


const API_BASE =
  import.meta.env.DEV
    ? '/api/'                                  // <-- goes through vite proxy locally
    : (import.meta.env.VITE_API_BASE ?? 'https://dbsapi.dbasesolutions.in/');

type Project = { P_ID: string; project: string };

export default function ProjectWiseTickets() {
  const [pdate, setPdate] = useState(moment());
  const [projectId, setProjectId] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [projects, setProjects] = useState<Project[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [display, setDisplay] = useState(false);
  const [count, setCount] = useState(0);
  const history = useHistory();

  useEffect(() => { void loadProjects(); }, [pdate]);
  useEffect(() => { void loadData(); }, [pdate, projectId, status]);

  async function loadProjects() {
    const today = pdate.format("YYYY-MM-DD");
    // TODO: real endpoint
    const res = await fetch(`${API_BASE}Tickets/LoadDaywiseProjectList?Date=${today}`);
    setProjects(await res.json());
  }

  async function loadData() {
    const today = pdate.format("YYYY-MM-DD");
    const pid = projectId === "ALL" ? "0" : projectId;
    const q = new URLSearchParams({ Date: today, status, ProjectID: pid });
    const res = await fetch(`${API_BASE}Tickets/Load_ProjectWiseTicketsData?${q.toString()}`);
    const data = await res.json();
    setRows(data ?? []);
    setCount((data ?? []).length);
    setDisplay((data ?? []).length > 0);
  }

  return (
    <IonPage>
      <IonContent>
        <div className="appsub-container">
          <IonCard className="mat-elevation-z8" style={{ background: "rgb(243,247,247)" }}>
            <IonCardContent>
              <IonGrid>
                <IonRow style={{ marginTop: -15, alignItems: "center" }}>
                  <IonCol size="2">
                    <IonButton fill="clear" onClick={() => history.goBack()}>
                      <img src="/assets/icon/goback.png" height="30" width="30" />
                    </IonButton>
                  </IonCol>
                  <IonCol size="10">
                    <h2 className="title">PROJECT WISE TICKETS DATA</h2>
                  </IonCol>
                </IonRow>

                <IonRow style={{ marginTop: -15 }}>
                  <IonCol size="12" sizeMd="4">
                    <IonItem>
                      <IonLabel position="stacked">Select Project</IonLabel>
                      <IonSelect value={projectId} onIonChange={(e)=>{ setProjectId(e.detail.value); setStatus("ALL"); }}>
                        <IonSelectOption value="ALL">All</IonSelectOption>
                        {projects.map(p => <IonSelectOption key={p.P_ID} value={p.P_ID}>{p.project}</IonSelectOption>)}
                      </IonSelect>
                    </IonItem>
                  </IonCol>

                  <IonCol size="12" sizeMd="4">
                    <IonItem>
                      <IonLabel position="stacked">Date</IonLabel>
                      <IonInput type="date" value={pdate.format("YYYY-MM-DD")}
                        onIonChange={(e)=> e.detail.value && setPdate(moment(e.detail.value))} />
                    </IonItem>
                  </IonCol>

                  <IonCol size="12" sizeMd="4">
                    <IonItem>
                      <IonLabel position="stacked">Select Ticket</IonLabel>
                      <IonSelect value={status} onIonChange={(e)=> setStatus(e.detail.value)}>
                        {["ALL","P","A","O","C","H","R","CH","D","I","U"].map(s => (
                          <IonSelectOption key={s} value={s}>{s}</IonSelectOption>
                        ))}
                      </IonSelect>
                    </IonItem>
                  </IonCol>
                </IonRow>
              </IonGrid>

              <IonRow style={{ marginTop: -15, paddingLeft: 8 }}>
                <h2 style={{ color: "rgb(36, 138, 169)", fontWeight: "bold" }}>
                  Project Wise Tickets ( <span style={{ color: "rgb(189,58,58)" }}>{count}</span> )
                </h2>
              </IonRow>

              {display && (
                <section className="example-container" style={{ marginLeft: 8 }}>
                  <div className="table nine">
                    <div className="thead">
                      <div>Sno</div><div>TicketID</div><div>Client</div><div>Project</div>
                      <div>Date</div><div>Description</div><div>Status</div>
                      <div>AssignedBy</div><div>AssignedTo</div>
                    </div>
                    {rows.map((r:any, i:number) => (
                      <div className="trow" key={r.TicketID+i}>
                        <div>&nbsp;&nbsp;{i+1}</div>
                        <div>{r.TicketID}</div>
                        <div>{r.Client}</div>
                        <div>{r.Project}</div>
                        <div style={{ whiteSpace: "nowrap" }}>{r.TDate}</div>
                        <div>{r.Remarks}</div>
                        <div style={{ whiteSpace: "nowrap" }}>{r.STATUS}</div>
                        <div title={r.AssignedBy}>{r.AssignedBy}</div>
                        <div title={r.AssignedTo}>{r.AssignedTo}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
}
