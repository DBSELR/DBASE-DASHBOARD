import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IonGrid, IonRow, IonCol, IonButton, IonIcon, IonSelect, IonSelectOption, IonLoading, IonToast } from "@ionic/react";
import { downloadOutline, eyeOutline, sendOutline, timeOutline, personOutline, calendarOutline, chevronDownOutline, searchOutline, closeCircle, checkmarkCircle } from "ionicons/icons";
import { IonModal, IonDatetime } from "@ionic/react";
import "./SupportTickets.css";

type Props = { 
  apiBase: string; 
  empCode: string; 
  pIncharge?: string;
  onCountChange?: (count: number) => void;
};

export default function SupportTickets({ apiBase, empCode, pIncharge, onCountChange }: Props) {
  const [empList, setEmpList] = useState<{ EmpCode: string; EmpName: string }[]>([]);
  const [dataSupport, setDataSupport] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ open: false, msg: "", color: "success" });
  
  const [targetDate, setTargetDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1); // Default to 1 month ago
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startDateModalOpen, setStartDateModalOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  // Custom Searchable Dropdown States (Portal)
  const [activeTicketDropdown, setActiveTicketDropdown] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [empSearchTerm, setEmpSearchTerm] = useState("");

  const toggleDropdown = (ticketID: string, event: React.MouseEvent) => {
    if (activeTicketDropdown === ticketID) {
      setActiveTicketDropdown(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 5,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 220) // Minimum width of 220px for better readability
      });
      setActiveTicketDropdown(ticketID);
      setEmpSearchTerm("");
    }
  };

  const filteredEmployees = empList.filter(e => {
    const term = empSearchTerm.toLowerCase();
    return e.EmpName.toLowerCase().includes(term) || e.EmpCode.toLowerCase().includes(term);
  });

  const isTL = ['1524', '1532', '1501', '1520', '1539', '1547'].includes(empCode) || pIncharge === 'INCHARGE_BEAT' || pIncharge === 'INCHARGE_BOAT' || pIncharge === 'PM';
  const isTM = empCode === '1509' || empCode === '1532';

  const imageBase = `${apiBase}img/Tickets/`;

  const estTimeOptions = Array.from({ length: 25 }, (_, i) => ({
    v: i.toString(),
    d: i.toString().padStart(2, '0') + ':00'
  })).concat([
    { v: "0.25", d: "00:15" }, { v: "0.5", d: "00:30" }
  ]).sort((a, b) => parseFloat(a.v) - parseFloat(b.v));

  const getHeaders = (isGet = false) => {
    const token = localStorage.getItem("token")?.replace(/"/g, "");
    const headers: any = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    if (!isGet) headers["Content-Type"] = "application/json";
    return headers;
  };

  const handleResponse = async (res: Response, tag: string) => {
    console.log(`[${tag}] handleResponse status:`, res.status);
    if (!res.ok) {
      console.error(`[${tag}] response not ok`);
      return [];
    }
    try {
      const text = await res.text();
      console.log(`[${tag}] raw text:`, text.substring(0, 500) + (text.length > 500 ? "..." : ""));
      const json = JSON.parse(text);
      let finalData = json;
      if (typeof json === "string") {
        console.log(`[${tag}] inner string detected, parsing again`);
        finalData = JSON.parse(json);
      }
      return finalData;
    } catch (err) {
      console.error(`[${tag}] parse error:`, err);
      return [];
    }
  };

  useEffect(() => {
    void loadEmp();
    void loadSupportTickets();
  }, [empCode, pIncharge]);

  async function loadEmp() {
    console.log("[SupportTickets] loadEmp START", { empCode });
    try {
      const res = await fetch(`${apiBase}Employee/Load_Employees_SupportTickets?SearchEmp=${empCode}`, { headers: getHeaders(true) });
      const data = await handleResponse(res, "EMPS");
      console.log("[SupportTickets] Employees loaded:", data?.length);
      setEmpList((data || []).map((e: any) => ({ EmpCode: String(e[0] || e.EmpCode), EmpName: e[1] || e.EmpName })));
    } catch (err) { 
      console.error("[SupportTickets] loadEmp ERROR:", err);
      setEmpList([]); 
    }
  }

  const formatDateToMMDDYYYY = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${m}-${d}-${y}`;
  };

  async function loadSupportTickets() {
    setLoading(true);
    try {
      const fDate = formatDateToMMDDYYYY(targetDate);
      const tDate = formatDateToMMDDYYYY(endDate);
      const status = "p"; 
      const clientID = "0";
      const projectID = "0";

      const endpoint = `Tickets/Load_LOADSUPPORTTICKETS_DateWise_FromTo_ALL?FDate=${fDate}&TDate=${tDate}&status=${status}&ClientID=${clientID}&ProjectID=${projectID}&EmpCode=${empCode}`;
      
      console.log("[SupportTickets] loadSupportTickets FETCH START:", endpoint);
      const res = await fetch(`${apiBase}${endpoint}`, { headers: getHeaders(true) });
      const raw = await handleResponse(res, "SUPPORT_NEW");
      console.log("[SupportTickets] loadSupportTickets received raw items:", raw?.length);
      
      if (raw && raw.length > 0) {
        console.log("[SupportTickets] loadSupportTickets RAW Sample [0]:", JSON.stringify(raw[0], null, 2));
        // Detailed check for file/img indices (8 and 9 as per user request)
        if (Array.isArray(raw[0])) {
          console.log("[SupportTickets] Indices 8 & 9 check:", { idx8: raw[0][8], idx9: raw[0][9] });
        } else {
          console.log("[SupportTickets] Object keys check:", Object.keys(raw[0]));
        }
      }

      const mapped = (raw || []).map((r: any) => ({
        TICKETID: String(r.TicketID || r.TICKETID || ""),
        Client: r.Client || "",
        Client_MobileNo: r.Client_MobileNo || "",
        Client_Name: r.Client_Name || "",
        Project: r.Project || "",
        TicketPriority: r.TicketPriority || "",
        Remarks: r.Remarks || r.Remarks1 || "",
        T_STATUS: r.T_status || r.STATUS || r.Issue_Status || "",
        TDate: r.TDate || "",
        Menu: r.Menu || "",
        File_Path: String(r[8] || r.File_Path || "").trim(), 
        Img_Path: String(r[9] || r.Img_Path || "").trim()
      }));

      console.log("[SupportTickets] loadSupportTickets mapped items:", mapped?.length);
      if (mapped.length > 0) console.log("[SupportTickets] Mapped Sample [0]:", JSON.stringify(mapped[0], null, 2));
      setDataSupport(mapped);
      if (onCountChange) onCountChange(mapped.length);
    } catch (err: any) {
      console.error("[SupportTickets] loadSupportTickets CATCH ERROR:", err);
      setDataSupport([]);
      if (onCountChange) onCountChange(0);
    } finally {
      setLoading(false);
    }
  }

  const [assignStates, setAssignStates] = useState<Record<string, { emp: string; tlTime: string; tmTime: string }>>({});

  const updateAssignState = (id: string, field: string, val: string) => {
    setAssignStates(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { emp: "", tlTime: "0", tmTime: "0" }), [field]: val }
    }));
    console.log("[SupportTickets] updateAssignState", { id, field, val });
  };

  async function updateTMEstimate(ticketId: string, tmTime: string) {
    if (!tmTime) return;
    const payload = { 
      _TICKETID: ticketId, 
      _EMPCODE: "0", // Documentation shows this is sent as "1524" in example, but purpose says "receives Ticket ID and updated TM estimated time". 
      _CREATEDBYID: empCode,
      _EstimatedTime: "0", // TL estimate, using 0 as fallback
      _TMEstimatedTime: tmTime 
    };
    console.log("[SupportTickets] updateTMEstimate START", payload);
    try {
      const res = await fetch(`${apiBase}Tickets/UPDATE_TMESTIMATEDTIME`, {
        method: "POST", headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      console.log("[SupportTickets] updateTMEstimate RESPONSE status:", res.status);
      const text = await res.text();
      console.log("[SupportTickets] updateTMEstimate RESPONSE body:", text);
      
      if (res.ok) {
        setToast({ open: true, msg: "TM Estimate Updated", color: "success" });
        await loadSupportTickets();
      } else {
        setToast({ open: true, msg: "Update Failed", color: "danger" });
      }
    } catch (e: any) {
      console.error("[SupportTickets] updateTMEstimate ERROR:", e);
      setToast({ open: true, msg: "Update Failed", color: "danger" });
    }
  }

  async function saveAssignment(ticketId: string, role: 'TL' | 'TM') {
    const state = assignStates[ticketId];
    if (!state?.emp || state.emp === "Select Employee") return alert("Please select an employee");

    const endpoint = role === 'TL' ? "Tickets/SAVE_ASSIGN_TICKET" : "Tickets/TM_SAVE_ASSIGN_TICKET";
    const payload = {
      _TICKETID: ticketId,
      _EMPCODE: state.emp,
      _CREATEDBYID: empCode,
      _EstimatedTime: state.tlTime || "0",
      _TMEstimatedTime: state.tmTime || "0"
    };

    if (role === 'TL' && (state.tlTime === '0' || state.tlTime === '00.00')) return alert("Please provide estimated time");
    if (role === 'TM' && (state.tlTime === '0' || state.tmTime === '0')) return alert("Please provide both TL and TM times");

    console.log(`[SupportTickets] saveAssignment START [${role}]`, payload);
    try {
      const res = await fetch(`${apiBase}${endpoint}`, {
        method: "POST", headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      console.log(`[SupportTickets] saveAssignment RESPONSE [${role}] status:`, res.status);
      const text = await res.text();
      console.log(`[SupportTickets] saveAssignment RESPONSE [${role}] body:`, text);

      if (res.ok) {
        setToast({ open: true, msg: "Ticket Assigned Successfully", color: "success" });
        await loadSupportTickets();
      } else {
        setToast({ open: true, msg: "Assignment Failed", color: "danger" });
      }
    } catch (e: any) {
      console.error(`[SupportTickets] saveAssignment ERROR [${role}]:`, e);
      setToast({ open: true, msg: "Error: " + e.message, color: "danger" });
    }
  }

  async function downloadHandler(url: string, filename: string) {
    console.log("[SupportTickets] downloadHandler triggered", { url, filename });
    try {
      if (!url.startsWith('http')) {
        console.warn("[SupportTickets] Invalid URL detected in downloadHandler");
        return;
      }
      
      const res = await fetch(url, { headers: getHeaders(true) });
      if (!res.ok) {
        console.error("[SupportTickets] Download fetch failed:", res.status);
        // Fallback: Open in new tab if fetch fails (might be CORS or direct link)
        window.open(url, '_blank');
        return;
      }
      
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      console.log("[SupportTickets] Download success for:", filename);
    } catch (err) {
      console.error("[SupportTickets] downloadHandler error:", err);
      // Fallback
      window.open(url, '_blank');
    }
  }

  const getStatusColor = (status: string) => {
    const s = (status || "").toLowerCase();
    switch (s) {
      case "p":
      case "pending": return "#ffab00"; // Amber
      case "a":
      case "assigned": return "#00b8d8"; // Cyan
      case "o":
      case "open": return "#36b37e"; // Green
      case "h":
      case "hold": return "#ff5630"; // Red
      case "c":
      case "closed": return "#6b778c"; // Gray
      case "r":
      case "reopen": return "#ff896b"; // Salmon
      case "u":
      case "urgent": return "#de350b"; // Dark Red
      default: return "var(--ion-color-primary)";
    }
  };

  const getStatusLabel = (status: string) => {
    const s = (status || "").toLowerCase();
    switch (s) {
      case "p": return "Pending";
      case "a": return "Assigned";
      case "o": return "Open";
      case "h": return "Hold";
      case "c": return "Closed";
      case "r": return "Reopen";
      default: return status || "Pending";
    }
  };

  return (
    <div className="dbase-tickets-root2">
      <IonLoading isOpen={loading} message="Fetching support tickets..." />

      <div className="dbase-tickets-container">
        <div className="dbase-tickets-header">
          {/* <h2 className="dbase-tickets-title">Support Tickets</h2> */}
          <div className="dbase-header-actions">
            {/* Additional header icons could go here */}
          </div>
        </div>


        <div className="dbase-support-list">
          {dataSupport.map((x: any, idx: number) => {
            const state = assignStates[x.TICKETID] || { emp: "", tlTime: "0", tmTime: "0" };
            const isAssigned = (x.T_STATUS || "").toLowerCase() === 'assigned';
            const statusColor = getStatusColor(x.T_STATUS);
            const statusLabel = getStatusLabel(x.T_STATUS);
            
            return (
              <div 
                key={`${x.TICKETID || idx}-${idx}`} 
                className="dbase-ticket-row-container dbase-fade-up"
                style={{ '--status-color': statusColor } as any}
              >
                <div className="dbase-ticket-badge">
                  {x.TICKETID}
                </div>

                <div className="dbase-ticket-main-grid">
                  {/* Column 1: Core Info */}
                  <div className="dbase-grid-column">
                    <div className="dbase-info-item">
                      <span className="dbase-label">Client :</span>
                      <span className="dbase-value">{x.Client}</span>
                    </div>
                    <div className="dbase-info-item">
                      <span className="dbase-label">Project :</span>
                      <span className="dbase-value">{x.Project}</span>
                    </div>
                    <div className="dbase-info-item">
                      <span className="dbase-label">Priority :</span>
                      <span className="dbase-value" style={{ color: x.TicketPriority?.toLowerCase() === 'high' ? '#ff5630' : 'inherit' }}>
                        {x.TicketPriority}
                      </span>
                    </div>
                    <div className="dbase-info-item">
                      <span className="dbase-label">Reopen :</span>
                      <span className="dbase-value">{x.T_STATUS === 'r' ? 'Yes' : ''}</span>
                    </div>
                  </div>

                  {/* Column 2: Date & Details */}
                  <div className="dbase-grid-column">
                    <div className="dbase-info-item">
                      <span className="dbase-label">Date :</span>
                      <span className="dbase-value">{x.TDate}</span>
                    </div>
                    <div className="dbase-info-item">
                      <span className="dbase-label">Client Details :</span>
                      <span className="dbase-value small-text">{x.Client_Name} {x.Client_MobileNo}</span>
                    </div>
                  </div>

                  {/* Column 3: Remarks */}
                  <div className="dbase-grid-column remarks-column">
                    <div className="dbase-info-item vertical">
                      <span className="dbase-label">Remarks :</span>
                      <span className="dbase-value-remarks">{x.Remarks}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="dbase-action-bar">
                  <div className="dbase-action-left">
                    <div className="dbase-action-item">
                      <span className="dbase-action-label">Assignee :</span>
                      <div 
                        className={`dbase-inline-select searchable-trigger ${activeTicketDropdown === x.TICKETID ? 'active' : ''}`}
                        onClick={(e) => toggleDropdown(x.TICKETID, e)}
                      >
                        <span className="dbase-select-text">
                          {empList.find(e => e.EmpCode === state.emp)?.EmpName || "Select Employee"}
                        </span>
                      </div>
                    </div>

                    <div className="dbase-action-item">
                      <span className="dbase-action-label">Time(TM) :</span>
                      <div className="dbase-inline-select mini">
                        <IonSelect
                          interface="popover"
                          value={state.tmTime}
                          onIonChange={(e) => {
                            updateAssignState(x.TICKETID, "tmTime", e.detail.value);
                            if (isAssigned && isTM) {
                              void updateTMEstimate(x.TICKETID, e.detail.value);
                            }
                          }}
                        >
                          {estTimeOptions.map(t => (
                            <IonSelectOption key={t.v} value={t.v}>{t.d}</IonSelectOption>
                          ))}
                        </IonSelect>
                      </div>
                    </div>

                    <div className="dbase-action-item">
                      <span className="dbase-action-label">Time(TL) :</span>
                      <div className="dbase-inline-select mini">
                        <IonSelect
                          interface="popover"
                          value={state.tlTime}
                          onIonChange={(e) => updateAssignState(x.TICKETID, "tlTime", e.detail.value)}
                        >
                          {estTimeOptions.map(t => (
                            <IonSelectOption key={t.v} value={t.v}>{t.d}</IonSelectOption>
                          ))}
                        </IonSelect>
                      </div>
                    </div>

                    <button 
                      className="dbase-send-icon-btn"
                      onClick={() => {
                        if (isTL) saveAssignment(x.TICKETID, 'TL');
                        else if (isTM) saveAssignment(x.TICKETID, 'TM');
                      }}
                    >
                      <IonIcon icon={sendOutline} />
                    </button>
                  </div>

                  <div className="dbase-action-right">
                    <div className="dbase-file-status">
                      <span className="status-label">File :</span>
                      {x.File_Path && x.File_Path !== "0" && x.File_Path !== "null" && x.File_Path !== "" ? (
                        <IonIcon 
                          icon={downloadOutline} 
                          className="status-icon active" 
                          onClick={() => {
                            const fileUrl = `https://tickets.dbasesolutions.in/issue_file/${x.File_Path}`;
                            console.log("[SupportTickets] File click:", fileUrl);
                            downloadHandler(fileUrl, x.File_Path);
                          }}
                        />
                      ) : <span className="status-none">None</span>}
                    </div>
                    <div className="dbase-file-status">
                      <span className="status-label">Image :</span>
                      {x.Img_Path && x.Img_Path !== "0" && x.Img_Path !== "null" && x.Img_Path !== "FALSE" && x.Img_Path !== "" ? (
                        <IonIcon 
                          icon={eyeOutline} 
                          className="status-icon active" 
                          onClick={() => {
                            const imgUrl = `https://tickets.dbasesolutions.in/issue_img/${x.Img_Path}`;
                            console.log("[SupportTickets] Image click:", imgUrl);
                            downloadHandler(imgUrl, x.Img_Path);
                          }}
                        />
                      ) : <span className="status-none">None</span>}
                    </div>
                  </div>
                </div>
              </div>
            );

          })}
        </div>

        {dataSupport.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--ion-color-medium)" }}>
            <div style={{ 
              width: '80px', height: '80px', background: 'rgba(var(--ion-color-primary-rgb, 226, 113, 29), 0.1)', 
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <IonIcon icon={sendOutline} style={{ fontSize: "32px", opacity: 0.5, color: 'var(--ion-color-primary)' }} />
            </div>
            <h3 style={{ margin: 0, color: 'var(--ion-text-color)', fontWeight: 700 }}>No Support Tickets</h3>
            <p style={{ marginTop: '8px', fontSize: '0.9rem' }}>Check different dates or wait for new requests.</p>
          </div>
        )}
      </div>

      {/* Date Modal Start */}
      <IonModal
        isOpen={startDateModalOpen}
        onDidDismiss={() => setStartDateModalOpen(false)}
        className="pwt-date-modal"
      >
        <div className="pwt-modal-content">
          <h3 className="pwt-modal-title">Select Start Date</h3>
          <IonDatetime
            presentation="date"
            onIonChange={(e) => {
              if (typeof e.detail.value === "string")
                setTargetDate(e.detail.value.split('T')[0]);
              setStartDateModalOpen(false);
            }}
          />
          <IonButton
            expand="block"
            mode="ios"
            onClick={() => setStartDateModalOpen(false)}
          >
            Close
          </IonButton>
        </div>
      </IonModal>

      <IonModal isOpen={endOpen} onDidDismiss={() => setEndOpen(false)} className="pwt-date-modal">
        <div className="pwt-modal-content">
          <h3 className="pwt-modal-title">Select End Date</h3>
          <IonDatetime
            presentation="date"
            onIonChange={(e) => {
              const v = e.detail.value as string | null;
              if (typeof v === "string") setEndDate(v.split('T')[0]);
              setEndOpen(false);
            }}
          />
          <IonButton 
            expand="block" 
            mode="ios" 
            onClick={() => setEndOpen(false)}
          >
            Close
          </IonButton>
        </div>
      </IonModal>
      {/* Date Modal End */}
      
      {/* Searchable Portal Dropdown (Single Instance) */}
      {activeTicketDropdown && createPortal(
        <>
          <div className="dropdown-outside-click-layer" onClick={() => setActiveTicketDropdown(null)} />
          <div 
            className="custom-inline-dropdown"
            onMouseDown={(e) => e.stopPropagation()} 
            style={{ 
              position: 'absolute',
              top: `${dropdownPos.top}px`, 
              left: `${dropdownPos.left}px`, 
              width: `${dropdownPos.width}px` 
            }}
          >
            <div className="dropdown-search-sec">
              <IonIcon icon={searchOutline} className="dropdown-search-icon" />
              <input
                type="text"
                className="dropdown-pure-input"
                placeholder="Search name or code..."
                value={empSearchTerm}
                onChange={(e) => setEmpSearchTerm(e.target.value)}
                autoFocus
                onMouseDown={(e) => e.stopPropagation()}
              />
              {empSearchTerm && (
                <button className="dropdown-clear-btn" onClick={() => setEmpSearchTerm("")}>
                  <IonIcon icon={closeCircle} />
                </button>
              )}
            </div>
            
            <div className="dropdown-body">
              {filteredEmployees.map((e, index) => {
                const isSelected = assignStates[activeTicketDropdown!]?.emp === e.EmpCode;
                
                // Clean initials logic (stripping numeric prefixes)
                const nameWithoutId = e.EmpName.includes("-") ? e.EmpName.split("-")[1].trim() : e.EmpName;
                const initials = (nameWithoutId.charAt(0) || "?").toUpperCase();

                return (
                  <div 
                    key={index} 
                    className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      updateAssignState(activeTicketDropdown!, "emp", e.EmpCode);
                      setActiveTicketDropdown(null);
                      setEmpSearchTerm("");
                    }}
                  >
                    <div className={`dr-avatar grad-${(parseInt(e.EmpCode) % 5) || 0}`}>
                      {initials}
                    </div>
                    <div className="dr-info">
                      <span className="dr-name">{e.EmpName}</span>
                      <span className="dr-id">ID: {e.EmpCode}</span>
                    </div>
                    {isSelected && <IonIcon icon={checkmarkCircle} className="dr-check" />}
                  </div>
                );
              })}
              {filteredEmployees.length === 0 && (
                <div className="dr-no-results">
                  <p>No matches for "{empSearchTerm}"</p>
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}

      <IonToast
        isOpen={toast.open}
        message={toast.msg}
        color={toast.color}
        duration={2000}
        onDidDismiss={() => setToast({ ...toast, open: false })}
      />
    </div>
  );
}
