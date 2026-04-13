import React, { useEffect, useState } from "react";
import moment from "moment";
import {
  IonSelect,
  IonSelectOption,
  IonModal,
  IonLoading,
  IonButton
} from "@ionic/react";
import {
  Briefcase,
  Calendar,
  X,
  PlayCircle,
  FileText,
  Send,
  Layers,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import "./DashboardButtons.css";

type Props = {
  apiBase: string;
  empCode: string;
  fromDate: string;
  toDate: string;
  clientId: string;
  projectId: string;
};

const ADMIN_CODES = ['1507', '1509', '1532', '1501', '1540', '1504'];

const CHIPS = [
  { s: "P", l: "Pending", ic: <AlertCircle size={16} /> },
  { s: "A", l: "Assigned", ic: <Layers size={16} /> },
  { s: "O", l: "Open", ic: <Briefcase size={16} /> },
  { s: "H", l: "Hold", ic: <X size={16} /> },
  { s: "C", l: "Closed", ic: <CheckCircle2 size={16} /> },
  { s: "R", l: "Reopen", ic: <PlayCircle size={16} /> },
  { s: "U", l: "Undertaken", ic: <Briefcase size={16} /> },
  { s: "W", l: "Work Report", ic: <FileText size={16} /> }
];

export default function DashboardButtons(props: Props) {
  const { apiBase, empCode, fromDate, toDate, clientId, projectId } = props;

  const [counts, setCounts] = useState({
    P: 0, A: 0, O: 0, H: 0, C: 0, R: 0, U: 0, W: 0,
  });

  const [status, setStatus] = useState<"P" | "A" | "O" | "H" | "C" | "R" | "U" | "W" | null>(null);
  const [heading, setHeading] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ open: false, msg: "", color: "success" });

  /* Work Report Modal State */
  const [workModal, setWorkModal] = useState({ open: false, ticket: null as any });
  const [workDesc, setWorkDesc] = useState("");
  const [serviceType, setServiceType] = useState("In-House");

  const getStatusLabel = (s: string) => CHIPS.find(c => c.s === s)?.l || s;

  const getHeaders = (isGet = false) => {
    const token = localStorage.getItem("token")?.replace(/"/g, "");
    const headers: any = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    if (!isGet) headers["Content-Type"] = "application/json";
    return headers;
  };

  const handleResponse = async (res: Response, tag: string) => {
    if (!res.ok) return [];
    try {
      const text = await res.text();
      const json = JSON.parse(text);
      const finalData = typeof json === "string" ? JSON.parse(json) : json;
      console.log(`[${tag}] API Response:`, finalData);
      return finalData;
    } catch (err) {
      console.error(`[${tag}] parse error:`, err);
      return [];
    }
  };

  useEffect(() => {
    void refreshCounts();
    setData([]);
    setStatus(null);
  }, [fromDate, toDate, clientId, projectId]);

  async function refreshCounts() {
    const dFrom = moment(fromDate).format("MM-DD-YYYY");
    const dTo = moment(toDate).format("MM-DD-YYYY");
    const isAdmin = ADMIN_CODES.includes(empCode);

    try {
      let mainCounts = { P: 0, A: 0, O: 0, H: 0, C: 0, R: 0 };
      
      if (isAdmin) {
        const q = new URLSearchParams({ ClientId: clientId, PT: projectId, Date: dFrom, ToDate: dTo });
        const res = await fetch(`${apiBase}Tickets/Load_TicketsCount?${q.toString()}`, { headers: getHeaders(true) });
        const json = await handleResponse(res, "COUNTS_ADMIN");
        if (json?.[0]) {
          mainCounts = {
            P: json[0].PENDINGTICKET, A: json[0].ASSIGNTICKET, O: json[0].OPENTICKET,
            H: json[0].HOLDTICKET, C: json[0].CLOSETICKET, R: json[0].REOPEN
          };
        }
      } else {
         // Use LOADEMPTASKSLIST for employees to get accurate counts (ignoring date filter for consistency with AssignedTickets)
         const res = await fetch(`${apiBase}Tickets/LOADEMPTASKSLIST?empcode=${empCode}&CLIENTID=0&PROJECTID=0`, { headers: getHeaders(true) });
         const json = await handleResponse(res, "COUNTS_EMP_LIST");
         if (Array.isArray(json)) {
           json.forEach((r: any) => {
             const s = String(r[12] || 'O').toUpperCase();
             if (s === 'P') mainCounts.P++;
             else if (s === 'A' || s === 'S') mainCounts.A++;
             else if (s === 'O') mainCounts.O++;
             else if (s === 'H') mainCounts.H++;
             else if (s === 'C') mainCounts.C++;
             else if (s === 'R') mainCounts.R++;
           });
         }
      }

      const resW = await fetch(`${apiBase}Tickets/EMPLOYEE_WORKREPORT_TICKETS_COUNT?EMPCODE=${empCode}`, { headers: getHeaders(true) });
      const jsonW = await handleResponse(resW, "COUNT_W");
      
      const resU = await fetch(`${apiBase}Tickets/EMPLOYEE_UNDERTAKEN_TICKETS_COUNT`, { headers: getHeaders(true) });
      const jsonU = await handleResponse(resU, "COUNT_U");

      const finalCounts = {
        ...mainCounts,
        W: jsonW?.[0]?.WorkReport ?? jsonW?.[0]?.[0] ?? 0,
        U: jsonU?.[0]?.UNDERTAKEN ?? jsonU?.[0]?.[0] ?? 0
      };
      setCounts(finalCounts);
    } catch (err) {
      console.error("[DashboardButtons] refreshCounts ERROR", err);
    }
  }

  async function loadData(s: typeof status) {
    if (!s) return;
    setLoading(true);
    const dFrom = moment(fromDate).format("MM-DD-YYYY");
    const dTo = moment(toDate).format("MM-DD-YYYY");
    const isAdmin = ADMIN_CODES.includes(empCode);

    try {
      let raw: any[] = [];
      if (isAdmin && !['U', 'W'].includes(s as string)) {
        const q = new URLSearchParams({ Date: dFrom, ToDate: dTo, status: s as string, ClientID: clientId, ProjectID: projectId });
        const res = await fetch(`${apiBase}Tickets/Load_AllSupportTickets?${q.toString()}`, { headers: getHeaders(true) });
        raw = await handleResponse(res, "DASH_ADMIN");
      } else if (!isAdmin && !['U', 'W'].includes(s as string)) {
        // Employee dashboard tickets (P,A,O,H,R,C) from LOADEMPTASKSLIST
        const res = await fetch(`${apiBase}Tickets/LOADEMPTASKSLIST?empcode=${empCode}&CLIENTID=0&PROJECTID=0`, { headers: getHeaders(true) });
        const all = await handleResponse(res, "DASH_EMP_LIST");
        raw = (all || []).filter((r: any) => {
          const rs = String(r[12] || 'O').toUpperCase();
          if (s === 'A') return rs === 'A' || rs === 'S';
          return rs === s;
        });
      } else {
        const q = new URLSearchParams({ status: s === 'W' ? 'O' : s as string, EMPCODE: empCode, FDATE: dFrom, TDATE: dTo });
        if (clientId !== "0") q.append("CID", clientId);
        if (projectId !== "0") q.append("PT", projectId);
        const url = `${apiBase}Tickets/Load_EmpunderandWorkreporttickets?${q.toString()}`;
        const res = await fetch(url, { headers: getHeaders(true) });
        raw = await handleResponse(res, "DASH_SPECIAL");
      }

      const mapped = (raw || []).map((r: any) => ({
        TICKETID: String(r[1] || r[0] || r.TICKETID),
        Client: r[2] || r.CLIENT,
        Project: r[3] || r.PROJECT,
        Subject: r[6] || r.SUBJECT,
        Remarks: r[11] || r[29] || r.REMARKS,
        CloseRemark: r[22] || r.CloseRemark,
        TDate: r[21] || r[8] || r.TDATE,
        Employee: r[16] || r.EMPLOYEE,
        TicketPriority: r[13] || r[11] || r.TICKETPRIORITY || "Normal",
        AID: r[9] || r.AID 
      }));

      setData(mapped);
    } catch (err) {
      console.error(`[DashboardButtons] loadData ERROR`, err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  async function onChip(s: typeof status, cap: string) {
    if (status === s) {
      setStatus(null);
      setData([]);
      setHeading("");
    } else {
      setStatus(s);
      setHeading(cap);
      await loadData(s);
    }
  }

  async function handleUndertake(ticket: any) {
    const reason = window.prompt("Enter remarks for Undertaken status:", "Undertaken");
    if (reason === null) return;

    const payload = {
      _TICKETID: ticket.TICKETID,
      _EMPCODE: empCode,
      _CREATEDBYID: empCode,
      _REMARKS: reason,
      _AID: ticket.AID || "0"
    };

    try {
      const res = await fetch(`${apiBase}Tickets/SAVE_ALREADY_ASSIGNEDTICKETS`, {
        method: "POST", 
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const ok = await res.json();

      if (ok >= 1) {
        showToast("Ticket marked as Undertaken", "success");
        await refreshCounts(); 
        await loadData(status);
      } else {
        showToast("Update failed", "error");
      }
    } catch (err) { 
      console.error("[DashboardButtons] handleUndertake ERROR:", err);
      showToast("Failed to undertake", "error"); 
    }
  }

  const showToast = (msg: string, color: string) => {
    setToast({ open: true, msg, color });
    setTimeout(() => setToast({ open: false, msg: "", color: "success" }), 3000);
  };

  async function openWorkReport(ticket: any) {
    try {
      const res = await fetch(`${apiBase}Tickets/Check_WorkReport_TicketWise?ticketID=${ticket.TICKETID}&EMPLOYEEID=${empCode}`, { headers: getHeaders(true) });
      const raw = await handleResponse(res, "CHECK_W");
      const hasReport = (raw?.[0]?.cnt >= 1) || (raw?.[0]?.[0] >= 1);
      
      if (hasReport) {
        showToast("Ticket already available in work report", "warning");
      } else {
        setWorkModal({ open: true, ticket });
        setWorkDesc("");
      }
    } catch { 
      setWorkModal({ open: true, ticket }); 
    }
  }

  async function saveWorkReport() {
    console.log("--------------------------------------------------");
    console.log("[DashboardButtons] saveWorkReport: START");
    // Removed mandatory check for workDesc as per user request
    if (!workDesc.trim()) {
      console.log("[DashboardButtons] saveWorkReport: Proceeding with empty description (Optional)");
    }

    const desc = `${workModal.ticket.Remarks || ""}\n${workDesc}`.trim();
    const closeRem = workModal.ticket.CloseRemark || "";

    const payload = {
      _TICKETID: String(workModal.ticket.TICKETID),
      _EMPLOYEEID: String(empCode),
      _CLIENT_NAME: String(workModal.ticket.Client),
      _PROJECT_NAMEE: String(workModal.ticket.Project),
      _WORKDESCRIPTION: `${workModal.ticket.TICKETID}_${desc}__${closeRem}`,
      _SERVICE_TYPE: String(serviceType)
    };

    const url = `${apiBase}Tickets/SaveWorkReport_TicketWise`;
    const headers = getHeaders();

    console.log("[DashboardButtons] saveWorkReport CONFIG:", {
      url,
      method: "POST",
      headers,
      payload
    });

    try {
      console.log("[DashboardButtons] saveWorkReport: Fetching...");
      const res = await fetch(url, {
        method: "POST", 
        headers: headers,
        body: JSON.stringify(payload)
      });
      
      console.log("[DashboardButtons] saveWorkReport HTTP STATUS:", res.status, res.statusText);
      
      const resText = await res.text();
      console.log("[DashboardButtons] saveWorkReport RAW RESPONSE:", resText);

      if (res.ok) {
        console.log("[DashboardButtons] saveWorkReport: Success!");
        showToast("Work report saved", "success");
        setWorkModal({ open: false, ticket: null });
        setWorkDesc("");
        await refreshCounts(); 
        await loadData(status);
      } else {
        console.error("[DashboardButtons] saveWorkReport: Server returned non-OK status", res.status);
        showToast(resText || "Failed to save report", "error");
      }
    } catch (err) { 
      console.error("[DashboardButtons] saveWorkReport FATAL ERROR:", err);
      showToast("Failed to save report", "error"); 
    } finally {
      console.log("[DashboardButtons] saveWorkReport: END");
      console.log("--------------------------------------------------");
    }
  }

  const getStatusClass = (s: string | null) => (s || "").toLowerCase();

  return (
    <div className="dbase-dash-main">
      <IonLoading isOpen={loading} message="Fetching tickets..." />

      {/* Status Chips */}
      <div className="dbase-chips-wrapper">
        {CHIPS.map(x => (
          <div
            key={x.s}
            className={`dbase-status-chip status-${x.s.toLowerCase()} ${status === x.s ? "active" : ""}`}
            onClick={() => onChip(x.s as any, x.s === 'W' ? x.l : `${x.l} Task(s)`)}
          >
            <div className="dbase-chip-inner">
               <span className="dbase-chip-abbr">{x.s}</span>
               <span className="dbase-chip-count">{counts[x.s as keyof typeof counts] || 0}</span>
            </div>
            <div className="dbase-chip-tooltip">{x.l}</div>
          </div>
        ))}
      </div>

      {status && (
        <>
          <div className="dbase-section-header">
            <h2 className="dbase-section-title">{heading}</h2>
          </div>

          <div className="dbase-ticket-list">
            {data.length === 0 && !loading && (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--ion-color-medium)" }}>
                <Briefcase size={40} style={{ opacity: 0.3, marginBottom: "12px" }} />
                <p>No tickets found</p>
              </div>
            )}

            {data.map((r, i) => (
              <div key={`${r.TICKETID}-${i}`} className={`dbase-ticket-card ${getStatusClass(status)}-border dbase-fade-up`}>
                <div className="dbase-card-top">
                  <span className="dbase-ticket-number">#{r.TICKETID}</span>
                  <span className={`dbase-status-tag dbase-tag-${getStatusClass(status)}`}>
                    {status === 'U' ? 'Under Taken' : (status === 'W' ? 'Report' : getStatusLabel(status))}
                  </span>
                </div>
                
                {r.Subject && <div className="dbase-card-subject" style={{ fontWeight: 600, fontSize: "15px", marginBottom: "6px" }}>{r.Subject}</div>}

                <div className="dbase-card-remarks">{r.Remarks}</div>

                {r.CloseRemark && r.CloseRemark !== "0" && r.CloseRemark !== "null" && (
                  <>
                    <h3 style={{ fontWeight: 600, fontSize: "14px", marginTop: "12px", marginBottom: "4px", color: "var(--ion-color-medium)" }}>Close Remark</h3>
                    <div className="dbase-card-remarks" style={{ marginBottom: "12px" }}>{r.CloseRemark}</div>
                  </>
                )}

                <div className="dbase-card-meta">
                  <div className="dbase-meta-item">
                    <Briefcase className="dbase-meta-icon" />
                    <span>{r.Client}</span>
                  </div>
                  <div className="dbase-meta-item">
                    <Calendar className="dbase-meta-icon" />
                    <span>{r.TDate}</span>
                  </div>
                </div>

                {(['A', 'O', 'U', 'W'].includes(status)) && (
                  <div className="dbase-card-actions">
                    {(status === "A" || status === "O") && (
                      <button className="dbase-primary-btn" onClick={() => handleUndertake(r)}>
                        <PlayCircle size={18} />
                        Undertake Ticket
                      </button>
                    )}
                    {(status === "U" || status === "W") && (
                      <button className="dbase-primary-btn" style={{ background: "var(--ion-color-secondary)" }} onClick={() => openWorkReport(r)}>
                        <FileText size={18} />
                        Submit Progress
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Work Report Modal */}
      <IonModal
        isOpen={workModal.open}
        onDidDismiss={() => setWorkModal({ open: false, ticket: null })}
        className="pwt-date-modal"
      >
        <div className="pwt-modal-content">
          <h3 className="pwt-modal-title">Ticket Work Report</h3>
          
          <div style={{ marginBottom: "16px", textAlign: 'left' }}>
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "var(--ion-color-medium)" }}>Ticket</p>
            <p style={{ margin: 0, fontWeight: 700 }}>#{workModal.ticket?.TICKETID} - {workModal.ticket?.Client}</p>
          </div>

          <div style={{ marginBottom: "16px", textAlign: 'left' }}>
            <label className="dbase-form-label">Service Type</label>
            <div style={{ border: "1px solid rgba(0,0,0,0.1)", borderRadius: "12px", padding: "4px 12px" }}>
              <IonSelect
                interface="popover"
                value={serviceType}
                onIonChange={e => setServiceType(e.detail.value)}
                style={{ "--padding-start": "0" }}
              >
                <IonSelectOption value="In-House">In-House</IonSelectOption>
                <IonSelectOption value="On-Site">On-Site</IonSelectOption>
              </IonSelect>
            </div>
          </div>

          <div style={{ marginBottom: "20px", textAlign: 'left' }}>
            <label className="dbase-form-label">Work Description</label>
            <textarea
              className="dbase-custom-textarea"
              rows={4}
              value={workDesc}
              onChange={e => setWorkDesc(e.target.value)}
              placeholder="What have you done today?"
              style={{ width: '100%', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', padding: '12px' }}
            />
          </div>

          <IonButton 
            expand="block" 
            mode="ios"
            onClick={saveWorkReport}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={18} />
              Submit Report
            </span>
          </IonButton>
          
          <IonButton 
            expand="block" 
            mode="ios" 
            fill="outline"
            onClick={() => setWorkModal({ open: false, ticket: null })}
            style={{ marginTop: '8px' }}
          >
            Cancel
          </IonButton>
        </div>
      </IonModal>

      {/* Toast Notification */}
      {toast.open && (
        <div style={{
          position: "fixed", bottom: "24px", left: "24px", right: "24px",
          background: toast.color === "success" ? "#36b37e" : (toast.color === "warning" ? "#ffab00" : "#ff5630"),
          color: "white", padding: "16px", borderRadius: "16px", zIndex: 9999,
          display: "flex", alignItems: "center", gap: "12px",
          boxShadow: "0 12px 24px rgba(0,0,0,0.2)",
          animation: "fadeUp 0.3s ease-out forwards"
        }}>
          {toast.color === "success" ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span style={{ fontWeight: 600 }}>{toast.msg}</span>
        </div>
      )}

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .dbase-native-modal {
          --border-radius: 32px 32px 0 0;
          --height: auto;
        }
      `}</style>
    </div>
  );
}
