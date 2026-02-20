import React, { useEffect, useRef, useState } from "react";
import {
  IonPage, IonContent, IonCard, IonCardContent, IonGrid, IonRow, IonCol, IonItem, IonLabel,
  IonSelect, IonSelectOption, IonInput, IonButton
} from "@ionic/react";
import { useHistory } from "react-router";
import moment from "moment";


const API_BASE =
  import.meta.env.DEV
    ? '/api/'                                  // <-- goes through vite proxy locally
    : (import.meta.env.VITE_API_BASE ?? 'https://dbsapi.dbasesolutions.in/');
const EMP_CODE = localStorage.getItem("EmpCode") ?? "";

export default function RaiseTicket() {
  const history = useHistory();

  const [clients, setClients] = useState<{ Client_Id: string; Client_Name: string }[]>([]);
  const [projects, setProjects] = useState<{ P_ID: string; project: string }[]>([]);
  const [emps, setEmps] = useState<{ EmpCode: string; EmpName: string }[]>([]);
  const [changedDate, setChangedDate] = useState("0");
  const [table, setTable] = useState<any[]>([]);

  const [disableFields, setDisableFields] = useState(true);

  const [payload, setPayload] = useState<any>({
    _ClientId: "", _PROJECT_NAMEE: "", _CLIENT_NAME: "", _ClientMobileNo: "9999999999",
    _REMARKS: "", _FormType: "", _FormName: "", _FilePath: "", _ImgPath: "",
    _Menu: "", _TicketPriority: "", _IssueID: "0", _Colcode: "", _EMPCODE: "", _CREATEDBYID: EMP_CODE
  });

  const imgInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imgName, setImgName] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);

  useEffect(() => { void loadClients(); void loadEmps(); void loadGrid(); }, [changedDate]);

  async function loadClients() {
    const res = await fetch(`${API_BASE}Tickets/LOADCLIENTS`); // TODO
    setClients(await res.json());
  }
  async function loadEmps() {
    const res = await fetch(`${API_BASE}Tickets/LOADEMPS`); // TODO
    setEmps(await res.json());
  }
  async function loadProjects(cid: string) {
    const res = await fetch(`${API_BASE}Tickets/LOADCLIENTSPROJECTLIST?ClientId=${cid}`);
    setProjects(await res.json());
  }
  async function loadGrid() {
    const res = await fetch(`${API_BASE}Tickets/Load_InternalIssues?EMPCODE=${EMP_CODE}&Date=${changedDate}`);
    setTable(await res.json());
  }

  function onClientPick(cid: string) {
    setPayload((p:any)=>({ ...p, _ClientId: cid, _PROJECT_NAMEE: "" }));
    setDisableFields(!(cid === "27" || cid === "29"));
    void loadProjects(cid);
  }

  async function onSave() {
    const p = payload;
    if (!p._ClientId || !p._PROJECT_NAMEE || !p._REMARKS.trim() ||
       (!p._FormType && disableFields) || (!p._FormName.trim() && disableFields) ||
       (!p._Menu && disableFields) || !p._TicketPriority || !p._EMPCODE) {
      alert("Please Enter The Field Values...!"); return;
    }

    const fd = new FormData();
    Object.entries(p).forEach(([k,v]) => fd.append(k, String(v ?? "")));
    if (imgFile) fd.append("ticketimg", imgFile, imgName);
    if (docFile) fd.append("ticketfile", docFile, fileName);

    try {
      const res = await fetch(`${API_BASE}Tickets/SAVE_INTERNAL_TICKET`, { method: "POST", body: fd });
      const ok = await res.json();
      if (ok >= 1) { onClear(); alert("Record Successfully Inserted..."); await loadGrid(); }
      else alert("Record Not Inserted...!");
    } catch(e:any) { alert("Error..." + e?.message); }
  }

  function onClear() {
    setPayload((p:any)=>({
      ...p, _ClientId:"", _PROJECT_NAMEE:"", _REMARKS:"", _FormType:"", _FormName:"", _Menu:"",
      _TicketPriority:"", _EMPCODE:"", _FilePath:"", _ImgPath:""
    }));
    setImgFile(null); setDocFile(null); setImgName(""); setFileName("");
  }

  function onDateChange(iso: string) {
    const d = moment(iso).format("YYYY-MM-DD");
    const [y,m,dd] = d.split("-");
    setChangedDate(`${dd}-${m}-${y}`); // to dd-MM-yyyy
  }

  return (
    <IonPage>
      <IonContent>
        <div className="appsub-container">
          <IonCard className="mat-elevation-z5" style={{ backgroundColor: "rgb(251,249,248)" }}>
            <IonCardContent>
              <IonRow style={{ marginTop: -15 }}>
                <IonCol size="12">
                  <a onClick={() => history.goBack()} style={{ cursor: "pointer", textDecoration: "none", color: "rgb(76,117,141)" }}>
                    <img src="/assets/icon/goback.png" height="30" width="30" />
                  </a>
                  <h1 className="rt-title"><u>Internal Raise Ticket</u></h1>
                </IonCol>
              </IonRow>

              {/* form */}
              <IonGrid>
                <IonRow style={{ marginTop: -15 }}>
                  <IonCol size="12" sizeMd="3">
                    <IonItem>
                      <IonLabel position="stacked">Select Client</IonLabel>
                      <IonSelect value={payload._ClientId} onIonChange={e => onClientPick(e.detail.value)}>
                        {clients.map(c => <IonSelectOption key={c.Client_Id} value={c.Client_Id}>{c.Client_Name}</IonSelectOption>)}
                      </IonSelect>
                    </IonItem>
                  </IonCol>

                  <IonCol size="12" sizeMd="3">
                    <IonItem>
                      <IonLabel position="stacked">Select Project</IonLabel>
                      <IonSelect value={payload._PROJECT_NAMEE} onIonChange={e => setPayload((p:any)=>({ ...p, _PROJECT_NAMEE: e.detail.value }))}>
                        {projects.map(p => <IonSelectOption key={p.P_ID} value={p.P_ID}>{p.project}</IonSelectOption>)}
                      </IonSelect>
                    </IonItem>
                  </IonCol>

                  <IonCol size="12" sizeMd="3">
                    <IonItem>
                      <IonLabel position="stacked">Assigned To</IonLabel>
                      <IonSelect value={payload._EMPCODE} onIonChange={e => setPayload((p:any)=>({ ...p, _EMPCODE: e.detail.value }))}>
                        {emps.map(e => <IonSelectOption key={e.EmpCode} value={e.EmpCode}>{e.EmpName}</IonSelectOption>)}
                      </IonSelect>
                    </IonItem>
                  </IonCol>

                  <IonCol size="12" sizeMd="3">
                    <IonItem>
                      <IonLabel position="stacked">Ticket Priority</IonLabel>
                      <IonSelect value={payload._TicketPriority} onIonChange={e => setPayload((p:any)=>({ ...p, _TicketPriority: e.detail.value }))}>
                        <IonSelectOption value="Low">Low</IonSelectOption>
                        <IonSelectOption value="Medium">Medium</IonSelectOption>
                        <IonSelectOption value="High">High</IonSelectOption>
                      </IonSelect>
                    </IonItem>
                  </IonCol>
                </IonRow>

                <IonRow style={{ marginTop: -10 }}>
                  <IonCol size="12" sizeMd="3">
                    <IonItem>
                      <IonLabel position="stacked">Form Type</IonLabel>
                      <IonSelect value={payload._FormType} disabled={disableFields} onIonChange={e => setPayload((p:any)=>({ ...p, _FormType: e.detail.value }))}>
                        <IonSelectOption value="Form">Form</IonSelectOption>
                        <IonSelectOption value="Report">Report</IonSelectOption>
                      </IonSelect>
                    </IonItem>
                  </IonCol>

                  <IonCol size="12" sizeMd="3">
                    <IonItem>
                      <IonLabel position="stacked">Menu</IonLabel>
                      <IonSelect value={payload._Menu} disabled={disableFields} onIonChange={e => setPayload((p:any)=>({ ...p, _Menu: e.detail.value }))}>
                        <IonSelectOption value="Home">Home</IonSelectOption>
                        <IonSelectOption value="Login">Login</IonSelectOption>
                      </IonSelect>
                    </IonItem>
                  </IonCol>

                  <IonCol size="12" sizeMd="3">
                    <IonItem>
                      <IonLabel position="stacked">Enter Form/Report Name</IonLabel>
                      <IonInput value={payload._FormName} disabled={disableFields}
                        onIonChange={e => setPayload((p:any)=>({ ...p, _FormName: e.detail.value! }))} />
                    </IonItem>
                  </IonCol>

                  <IonCol size="12" sizeMd="3">
                    <textarea className="issue-text" placeholder="Issue"
                      value={payload._REMARKS}
                      onChange={e => setPayload((p:any)=>({ ...p, _REMARKS: e.target.value }))} />
                  </IonCol>
                </IonRow>

                <IonRow style={{ marginTop: -10 }}>
                  <IonCol size="6" sizeMd="3">
                    <IonButton color="danger" onClick={() => imgInputRef.current?.click()} style={{ height: 30 }}>
                      <img src="/assets/icon/attach.png" height="15" width="12" style={{ marginRight: 6 }} /> Image
                    </IonButton>
                    <div className="file-note">{imgName || "No Image Selected"}</div>
                    <input ref={imgInputRef} type="file" accept="image/*" hidden
                      onChange={(e) => { const f=e.target.files?.[0]; if (f){setImgFile(f); setImgName(f.name);} }} />
                  </IonCol>

                  <IonCol size="6" sizeMd="3">
                    <IonButton color="danger" onClick={() => fileInputRef.current?.click()} style={{ height: 30 }}>
                      <img src="/assets/icon/attach.png" height="15" width="12" style={{ marginRight: 6 }} /> File
                    </IonButton>
                    <div className="file-note">{fileName || "No File Selected"}</div>
                    <input ref={fileInputRef} type="file" hidden
                      onChange={(e) => { const f=e.target.files?.[0]; if (f){setDocFile(f); setFileName(f.name);} }} />
                  </IonCol>

                  <IonCol size="6" sizeMd="3">
                    <IonButton color="danger" onClick={onSave} style={{ height: 30 }}>Submit</IonButton>
                  </IonCol>
                  <IonCol size="6" sizeMd="3">
                    <IonButton color="danger" onClick={onClear} style={{ height: 30 }}>Clear</IonButton>
                  </IonCol>
                </IonRow>
              </IonGrid>

              {/* date + table */}
              <div style={{ marginTop: -5 }}>
                <IonCol size="12" sizeMd="3" style={{ maxWidth: 240, marginLeft: 7 }}>
                  <IonItem>
                    <IonLabel position="stacked">Select Date</IonLabel>
                    <IonInput type="date" onIonChange={(e)=> e.detail.value && onDateChange(e.detail.value)} />
                  </IonItem>
                </IonCol>

                <section className="example-table-container">
                  <div className="table six">
                    <div className="thead">
                      <div>Sno</div><div>Ticket No</div><div>User Name</div><div>Form Name</div><div>Issue</div><div>Status</div>
                    </div>
                    {table.map((r:any, idx:number) => (
                      <div className="trow" key={r.TicketID+idx}>
                        <div>&nbsp;&nbsp;{idx+1}</div>
                        <div>{r.TicketID}</div>
                        <div>{r.Client_Name}</div>
                        <div>{r.FORM_NAME}</div>
                        <div>{r.REMARKS}</div>
                        <div>{r.Issue_Status}</div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
}
