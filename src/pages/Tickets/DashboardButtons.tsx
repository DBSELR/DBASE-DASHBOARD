import React, { useEffect, useState } from "react";
import { IonCard, IonCardContent, IonChip, IonGrid, IonRow, IonCol } from "@ionic/react";


type Props = {
  apiBase: string;
  empCode: string;
  fromDate: string;
  toDate: string;
  clientId: string;
  projectId: string;
};

export default function DashboardButtons(props: Props) {
  const { apiBase, empCode, fromDate, toDate, clientId, projectId } = props;

  const [counts, setCounts] = useState({
    P: 0, A: 0, O: 0, H: 0, C: 0, R: 0, U: 0, W: 0,
  });

  const [status, setStatus] = useState<"P" | "A" | "O" | "H" | "C" | "R" | "U" | "W">("P");
  const [heading, setHeading] = useState("");
  const [data6, setData6] = useState<any[]>([]);
  const [data2, setData2] = useState<any[]>([]);
  const [view, setView] = useState<"A" | "P" | "O" | "H" | "C" | "R" | "U" | "W" | "">("");

  useEffect(() => { void refreshCounts(); }, [fromDate, toDate, clientId, projectId]);

  async function refreshCounts() {
    try {
      // TODO: swap to your count endpoints
      const q = new URLSearchParams({ FDate: fromDate, TDate: toDate, ClientId: clientId, ProjectId: projectId });
      const res = await fetch(`${apiBase}Tickets/Load_Tickets_Count?${q.toString()}`);
      const json = await res.json();
      setCounts({
        P: json.P ?? 0, A: json.A ?? 0, O: json.O ?? 0, H: json.H ?? 0, C: json.C ?? 0, R: json.R ?? 0,
        U: json.U ?? 0, W: json.W ?? 0,
      });
    } catch { /* ignore */ }
  }

  async function loadSixButtons() {
    // Angular: genserv.getDashboart6ButtonsData()
    const q = new URLSearchParams({ status, FDate: fromDate, TDate: toDate, ClientId: clientId, ProjectId: projectId });
    // TODO: point to your real endpoint
    const res = await fetch(`${apiBase}Tickets/Load_Dashboard_Tickets?${q.toString()}`);
    const json = await res.json();
    setData6(json ?? []);
  }

  async function loadUnderOrWork() {
    const q = new URLSearchParams({ status, EMPCODE: empCode, FDate: fromDate, TDate: toDate });
    const res = await fetch(`${apiBase}Tickets/Load_EmpunderandWorkreporttickets?${q.toString()}`);
    const json = await res.json();
    setData2(json ?? []);
  }

  async function onChip(s: typeof status, cap: string) {
    setStatus(s);
    setHeading(cap);
    setView(s);
    if (s === "U" || s === "W") await loadUnderOrWork();
    else await loadSixButtons();
    await refreshCounts();
  }

  return (
    <div>
      <IonRow style={{ marginTop: -40 }}>
        <IonCol>
          <div className="chip-list">
            <IonChip onClick={() => onChip("P", "Pending Tickets")}>P - {counts.P}</IonChip>
            <IonChip onClick={() => onChip("A", "Assigned Tickets")}>A - {counts.A}</IonChip>
            <IonChip onClick={() => onChip("O", "Open Tickets")}>O - {counts.O}</IonChip>
            <IonChip onClick={() => onChip("H", "Hold Tickets")}>H - {counts.H}</IonChip>
            <IonChip onClick={() => onChip("C", "Closed Tickets")}>C - {counts.C}</IonChip>
            <IonChip onClick={() => onChip("R", "Reopen Tickets")}>R - {counts.R}</IonChip>
            <IonChip onClick={() => onChip("U", "Under Taken Report")}>U - {counts.U}</IonChip>
            <IonChip onClick={() => onChip("W", "Work Report")}>W - {counts.W}</IonChip>
          </div>
        </IonCol>
      </IonRow>

      {/* A, P, O, H, C, R views (data6) */}
      {["A","P","O","H","C","R"].includes(view) && (
        <IonCard>
          <IonCardContent>
            <p className="dash-heading"><u>{heading}</u></p>
            <div className="example-container">
              <div className="table nine">
                <div className="thead">
                  {/* columns vary by status in Angular — keep a superset */}
                  <div>Sno</div><div>TicketID</div><div>Client</div><div>Project</div>
                  <div>Raised Date</div><div>Priority</div><div>Developer</div>
                  <div>Assign/Open/Hold/Close</div><div>Description</div>
                </div>
                {data6.map((r:any, i:number) => (
                  <div className="trow" key={r.TicketID + i}>
                    <div>&nbsp;&nbsp;{i+1}</div>
                    <div>{r.TicketID}</div>
                    <div>{r.Client}</div>
                    <div>{r.Project}</div>
                    <div>{r.TDate ?? r.AssignDate ?? r.OpenDate ?? r.HoldDate ?? r.ClosingDate}</div>
                    <div>{r.TicketPriority ?? ""}</div>
                    <div title={r.Employee}>{r.Employee}</div>
                    <div>{r.AssignDate ?? r.OpenDate ?? r.HoldDate ?? r.ClosingDate ?? ""}</div>
                    <div>{r.Remarks ?? r.ClosedRemark}</div>
                  </div>
                ))}
              </div>
            </div>
          </IonCardContent>
        </IonCard>
      )}

      {/* U or W views (data2) */}
      {["U","W"].includes(view) && (
        <IonCard>
          <IonCardContent>
            <p className="dash-heading"><u>{heading}</u></p>
            <div className="example-container">
              <div className="table nine">
                <div className="thead">
                  <div>Sno</div><div>TicketID</div><div>Client</div><div>Project</div>
                  <div>Open/Assign Date</div><div>Description</div><div>Employee</div>
                  <div>Remarks</div><div>Action</div>
                </div>
                {data2.map((r:any, i:number) => (
                  <div className="trow" key={r.TicketID + i}>
                    <div>&nbsp;&nbsp;{i+1}</div>
                    <div>{r.TicketID}</div>
                    <div>{r.Client}</div>
                    <div>{r.Project}</div>
                    <div>{r.OpendDate ?? r.AssignDate}</div>
                    <div>{r.Remarks}</div>
                    <div title={r.Employee}>{r.Employee}</div>
                    <div>{r.TaskRemark}</div>
                    <div>—</div>
                  </div>
                ))}
              </div>
            </div>
          </IonCardContent>
        </IonCard>
      )}
    </div>
  );
}
