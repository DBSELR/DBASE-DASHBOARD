import React, { useEffect, useRef, useState } from "react";
import {
  IonButton, IonIcon, IonLoading, IonToast, IonModal, IonDatetime, IonSelect, IonSelectOption
} from "@ionic/react";
import { useHistory } from "react-router";
import { 
  ArrowLeft,
  Calendar,
  ChevronRight,
  ChevronLeft,
  PlusCircle,
  Hash,
  FileText,
  Briefcase,
  User,
  Users,
  Flag,
  PenTool,
  UploadCloud,
  Paperclip,
  Trash2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import moment from "moment";
import "./RaiseTicket.css";

import { API_BASE } from "../../config";

const user = JSON.parse(localStorage.getItem("user") || "{}");
const EMP_CODE = user?.empCode || "";

async function compressImage(file: File): Promise<Blob> {
  const imageBitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const scale = 0.5;
  canvas.width = imageBitmap.width * scale;
  canvas.height = imageBitmap.height * scale;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.7);
  });
}

const handleResponse = async (res: Response) => {
  if (!res.ok) return [];
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (typeof json === "string") return JSON.parse(json);
    return json;
  } catch { return []; }
};

export default function RaiseTicket() {
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ open: false, msg: "", color: "success" });

  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [emps, setEmps] = useState<any[]>([]);
  const [internalTickets, setInternalTickets] = useState<any[]>([]);
  const [filterDate, setFilterDate] = useState(moment().format("YYYY-MM-DD"));

  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [payload, setPayload] = useState<any>({
    _TICKETID: "0", _EMPCODE: "", _CREATEDBYID: EMP_CODE, _EstimatedTime: "0", _TMEstimatedTime: "0",
    _CLIENT_NAME: "", _PROJECT_NAMEE: "", _EMPLOYEEID: "0", _WORKDESCRIPTION: "", _SERVICE_TYPE: "0",
    _REMARKS: "", _AID: "0", _EMPCODE_LOGIN: "0", _SUPPORTEMPCODE: "0", _SELECTEDTIKSTATUS: "0",
    _TASKREMARKS: "", _TICKETTYPE: "0", _CLOSINGREMARKS: "", _ClientId: "", _ClientMobileNo: "9999999999",
    _FormType: "", _FormName: "", _FilePath: "", _ImgPath: "", _Menu: "", _TicketPriority: "Medium",
    _IssueID: "0", _Colcode: "0", _Tskid: "0", _SenEName: "0", _RecEName: "0", _AssignDate: "0",
    _TargetDate: "0", _TskDescription: "0", _TargetDays: "0", _StatusDate: "0", _StatusInfo: "0",
    _Status: "0", _Priority: "Low", _Maintid: "0", _ActionDate: "0", _ActionInfo: "0", _Maintby: "0"
  });

  const imgInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);

  const getHeaders = (isGet = false, isFormData = false) => {
    const token = localStorage.getItem("token")?.replace(/"/g, "");
    const headers: any = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    if (!isGet && !isFormData) headers["Content-Type"] = "application/json";
    return headers;
  };

  useEffect(() => {
    void loadInitial();
    void loadInternalTickets();
  }, [filterDate]);

  async function loadInitial() {
    console.log("[RaiseTicket] loadInitial START", { EMP_CODE });
    try {
      const crez = await fetch(`${API_BASE}Sources/Load_Clients_Sources`, { headers: getHeaders(true) });
      const cdata = await handleResponse(crez);
      console.log("[RaiseTicket] Clients loaded:", cdata?.length);
      setClients(cdata.map((r: any) => ({ Client_Id: String(r[0]), Client_Name: r[1] })));

      const erez = await fetch(`${API_BASE}Employee/Load_Employees_SupportTickets?SearchEmp=${EMP_CODE}`, { headers: getHeaders(true) });
      const edata = await handleResponse(erez);
      console.log("[RaiseTicket] Employees loaded:", edata?.length);
      setEmps(edata.map((r: any) => ({ EmpCode: String(r[0]), EmpName: r[1] })));
    } catch (err) { 
      console.error("[RaiseTicket] loadInitial ERROR:", err);
    }
  }

  async function loadProjects(cid: string) {
    console.log("[RaiseTicket] loadProjects START", { cid });
    try {
      const res = await fetch(`${API_BASE}Sources/Load_Project_Sources?CID=${cid}`, { headers: getHeaders(true) });
      const pdata = await handleResponse(res);
      console.log("[RaiseTicket] Projects loaded:", pdata?.length);
      setProjects(pdata.map((r: any) => ({ P_ID: String(r[0]), project: r[1] })));
    } catch (err) { 
      console.error("[RaiseTicket] loadProjects ERROR:", err);
      setProjects([]); 
    }
  }

  async function loadInternalTickets() {
    if (!EMP_CODE) return;
    const d = filterDate === moment().format("YYYY-MM-DD") ? "0" : moment(filterDate).format("DD-MM-YYYY");
    console.log("[RaiseTicket] loadInternalTickets START", { EMP_CODE, filterDate: d });
    try {
      const res = await fetch(`${API_BASE}Tickets/Load_InternalIssues?EMPCODE=${EMP_CODE}&Date=${d}`, { headers: getHeaders(true) });
      const data = await handleResponse(res);
      console.log("[RaiseTicket] History loaded:", data?.length);
      setInternalTickets(data ?? []);
      setCurrentPage(1);
    } catch (err) { 
      console.error("[RaiseTicket] loadInternalTickets ERROR:", err);
      setInternalTickets([]); 
    }
  }

  function onClientPick(cid: string) {
    const client = clients.find(c => c.Client_Id === cid);
    setProjects([]);
    setPayload({ ...payload, _ClientId: cid, _CLIENT_NAME: client?.Client_Name || "", _PROJECT_NAMEE: "" });
    void loadProjects(cid);
  }

  async function onSave() {
    if (!payload._ClientId || !payload._PROJECT_NAMEE || !payload._REMARKS.trim() || !payload._EMPCODE || !payload._TicketPriority || !payload._FormType || !payload._FormName.trim() || !payload._Menu) {
      setToast({ open: true, msg: "Fill all required fields", color: "warning" });
      return;
    }

    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1200));

    const fd = new FormData();
    Object.entries(payload).forEach(([k, v]) => fd.append(k, String(v ?? "")));
    if (imgFile) {
      const compressed = await compressImage(imgFile);
      fd.append("ticketimg", compressed, imgFile.name);
    }
    if (docFile) fd.append("ticketfile", docFile, docFile.name);

    console.log("[RaiseTicket] onSave START", { payload, hasImg: !!imgFile, hasDoc: !!docFile });
    try {
      const res = await fetch(`${API_BASE}Tickets/SAVE_INTERNAL_TICKET`, { 
        method: "POST", 
        headers: getHeaders(false, true), 
        body: fd 
      });
      console.log("[RaiseTicket] onSave RESPONSE status:", res.status);
      const result = await res.json();
      console.log("[RaiseTicket] onSave RESPONSE body:", result);
      
      const isSuccess = typeof result === 'object' ? result.result >= 1 : result >= 1;

      if (isSuccess) {
        setToast({ open: true, msg: "Ticket Raised!", color: "success" });
        onClear();
        await loadInternalTickets();
      } else {
        setToast({ open: true, msg: "Failed to raise", color: "danger" });
      }
    } catch (e: any) {
      console.error("[RaiseTicket] onSave ERROR:", e);
      setToast({ open: true, msg: "Error: " + e.message, color: "danger" });
    } finally {
      setLoading(false);
    }
  }

  function onClear() {
    setPayload({
      ...payload, 
      _ClientId: "", _PROJECT_NAMEE: "", _CLIENT_NAME: "", _REMARKS: "", _FormType: "", 
      _FormName: "", _Menu: "", _TicketPriority: "Medium", _EMPCODE: "", 
      _FilePath: "", _ImgPath: "", _WORKDESCRIPTION: "", _TASKREMARKS: "", _CLOSINGREMARKS: ""
    });
    setImgFile(null); setDocFile(null);
  }

  const totalPages = Math.ceil(internalTickets.length / itemsPerPage);
  const pagedData = internalTickets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="rt-container">
      <IonLoading isOpen={loading} message="Processing..." />

      <header className="rt-header-section">
        <div className="rt-header-left">
          <button className="rt-back-circle" onClick={() => history.goBack()}>
            <ArrowLeft size={20} />
          </button>
          <h1 className="rt-header-title">Raise Ticket</h1>
        </div>
        <PlusCircle size={24} color="white" />
      </header>

      <main className="rt-content">
        <div className="rt-glass-card rt-anim-up">
          <div className="rt-section-header">
            <PenTool size={20} />
            <span>Ticket Details</span>
          </div>

          <div className="rt-form-grid">
            <div className="rt-field">
              <label className="rt-label">Client *</label>
              <IonSelect
                value={payload._ClientId}
                onIonChange={e => onClientPick(e.detail.value)}
                interface="popover"
                className="rt-select-trigger"
                placeholder="Select Client"
              >
                {clients.map(c => <IonSelectOption key={c.Client_Id} value={c.Client_Id}>{c.Client_Name}</IonSelectOption>)}
              </IonSelect>
            </div>

            <div className="rt-field">
              <label className="rt-label">Project *</label>
              <IonSelect
                value={payload._PROJECT_NAMEE}
                onIonChange={e => setPayload({ ...payload, _PROJECT_NAMEE: e.detail.value })}
                interface="popover"
                className="rt-select-trigger"
                placeholder="Select Project"
              >
                {projects.map(p => <IonSelectOption key={p.P_ID} value={p.P_ID}>{p.project}</IonSelectOption>)}
              </IonSelect>
            </div>

            <div className="rt-field">
              <label className="rt-label">Assign To *</label>
              <IonSelect
                value={payload._EMPCODE}
                onIonChange={e => setPayload({ ...payload, _EMPCODE: e.detail.value })}
                interface="popover"
                className="rt-select-trigger"
                placeholder="Assign Developer"
              >
                {emps.map(e => <IonSelectOption key={e.EmpCode} value={e.EmpCode}>{e.EmpName}</IonSelectOption>)}
              </IonSelect>
            </div>

            <div className="rt-field">
              <label className="rt-label">Priority *</label>
              <IonSelect
                value={payload._TicketPriority}
                onIonChange={e => setPayload({ ...payload, _TicketPriority: e.detail.value })}
                interface="popover"
                className="rt-select-trigger"
              >
                <IonSelectOption value="Low">Low</IonSelectOption>
                <IonSelectOption value="Medium">Medium</IonSelectOption>
                <IonSelectOption value="High">High</IonSelectOption>
              </IonSelect>
            </div>

            <div className="rt-field">
              <label className="rt-label">Type *</label>
              <IonSelect
                value={payload._FormType}
                onIonChange={e => setPayload({ ...payload, _FormType: e.detail.value })}
                interface="popover"
                className="rt-select-trigger"
                placeholder="Form/Report"
              >
                <IonSelectOption value="Form">Form</IonSelectOption>
                <IonSelectOption value="Report">Report</IonSelectOption>
              </IonSelect>
            </div>

            <div className="rt-field">
              <label className="rt-label">Menu *</label>
              <IonSelect
                value={payload._Menu}
                onIonChange={e => setPayload({ ...payload, _Menu: e.detail.value })}
                interface="popover"
                className="rt-select-trigger"
                placeholder="Select Menu"
              >
                <IonSelectOption value="Home">Home</IonSelectOption>
                <IonSelectOption value="Login">Login</IonSelectOption>
              </IonSelect>
            </div>

            <div className="rt-field rt-span-2">
              <label className="rt-label">Form/Report Name *</label>
              <input 
                className="rt-input" 
                value={payload._FormName} 
                onChange={e => setPayload({ ...payload, _FormName: e.target.value })} 
                placeholder="e.g. SalesReport" 
              />
            </div>

            <div className="rt-field rt-span-2">
              <label className="rt-label">Remarks *</label>
              <textarea 
                className="rt-input" 
                style={{ minHeight: '80px' }}
                value={payload._REMARKS} 
                onChange={e => setPayload({ ...payload, _REMARKS: e.target.value })} 
                placeholder="Describe the issue..." 
              />
            </div>
          </div>

          <div className="rt-btn-row">
            <button className="rt-btn rt-btn-outline" onClick={() => imgInputRef.current?.click()}>
              <Paperclip size={18} />
              Img {imgFile ? '✓' : ''}
            </button>
            <input ref={imgInputRef} type="file" accept="image/*" hidden onChange={e => setImgFile(e.target.files?.[0] || null)} />

            <button className="rt-btn rt-btn-outline" onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={18} />
              File {docFile ? '✓' : ''}
            </button>
            <input ref={fileInputRef} type="file" hidden onChange={e => setDocFile(e.target.files?.[0] || null)} />

            <button className="rt-btn rt-btn-primary" onClick={onSave} disabled={loading}>
              <UploadCloud size={18} />
              {loading ? 'Submitting' : 'Submit'}
            </button>

            <button className="rt-btn rt-btn-secondary" onClick={onClear}>
              <Trash2 size={18} />
              Clear
            </button>
          </div>
        </div>

        <div className="rt-history-header">
          <h2 className="rt-history-title">History ({internalTickets.length})</h2>
          <div className="rt-date-pill" onClick={() => setIsDateModalOpen(true)}>
            <Calendar size={16} />
            {moment(filterDate).format("MMM DD")}
          </div>
        </div>

        <div className="rt-history-list">
          {pagedData.length > 0 ? (
            pagedData.map((r, i) => (
              <div key={`${r.ticketID}-${i}`} className="rt-ticket-card rt-anim-up" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="rt-ticket-header">
                  <span className="rt-id-badge">#{r.ticketID}</span>
                  <span className={`rt-status-pill st-${(typeof r.issue_Status === 'string' ? r.issue_Status : 'Pending').toLowerCase().replace(' ', '')}`}>
                    {typeof r.issue_Status === 'string' ? r.issue_Status : 'Pending'}
                  </span>
                </div>
                <h3 className="rt-proj-name">
                  {typeof r.forM_NAME === 'string' && r.forM_NAME.trim() 
                    ? r.forM_NAME 
                    : (typeof r.client_Name === 'string' && r.client_Name.trim() ? r.client_Name : 'Internal Issue')}
                </h3>
                <p className="rt-remarks">{typeof r.remarks === 'string' ? r.remarks : ''}</p>
                <div className="rt-ticket-footer">
                   <span className={r.issueColor}>{typeof r.issue_Status === 'string' ? r.issue_Status : ''}</span>
                   <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                     <CheckCircle2 size={14} /> {r.reOpen || 'View'}
                   </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rt-glass-card" style={{ textAlign: "center", padding: "40px" }}>
              <AlertCircle size={32} style={{ opacity: 0.3, marginBottom: '10px' }} />
              <p style={{ opacity: 0.5 }}>No results found.</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="rt-pagination-strip">
            <button className="rt-page-nav" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
              <ChevronLeft size={20} /> Prev
            </button>
            <span style={{ fontWeight: 800, fontSize: '1rem' }}>{currentPage} of {totalPages}</span>
            <button className="rt-page-nav" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              Next <ChevronRight size={20} />
            </button>
          </div>
        )}
      </main>

      <IonModal 
        isOpen={isDateModalOpen} 
        onDidDismiss={() => setIsDateModalOpen(false)} 
        className="pwt-date-modal"
      >
        <div className="pwt-modal-content">
          <h3 className="pwt-modal-title">Select History Date</h3>
          <IonDatetime
            presentation="date"
            value={filterDate}
            onIonChange={(e) => {
              const v = e.detail.value as string | null;
              if (typeof v === "string") setFilterDate(v);
              setIsDateModalOpen(false);
            }}
          />
          <IonButton 
            expand="block" 
            mode="ios" 
            fill="outline"
            onClick={() => setIsDateModalOpen(false)} 
            style={{ marginTop: '20px' }}
          >
            Close
          </IonButton>
        </div>
      </IonModal>

      <IonToast isOpen={toast.open} message={toast.msg} color={toast.color} duration={2000} onDidDismiss={() => setToast({ ...toast, open: false })} />
    </div>
  );
}
