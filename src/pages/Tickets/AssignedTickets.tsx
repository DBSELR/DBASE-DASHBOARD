import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  IonButton, IonIcon, IonLoading, IonToast, IonSelect, IonSelectOption, IonModal, IonDatetime
} from "@ionic/react";
import { downloadOutline, eyeOutline, checkmarkCircleOutline, timeOutline, calendarOutline, clipboardOutline, searchOutline, closeCircle, checkmarkCircle } from "ionicons/icons";
import moment from "moment";
import "./AssignedTickets.css";

type Props = { 
  apiBase: string; 
  fromDate: string; 
  toDate: string; 
  clientId: string; 
  projectId: string; 
  empCode: string;
  onCountChange?: (count: number) => void;
};

type UpdateState = {
  status: string;
  remark: string;
  supportEmpCode: string;
  ticketType: string;
  closingRemarks: string;
  quitRemarks: string;
  targetDate: string;
};

export default function AssignedTickets({ apiBase, fromDate, toDate, clientId, projectId, empCode, onCountChange }: Props) {
  const [data, setData] = useState<any[]>([]);
  const [empNames, setEmpNames] = useState<{ EmpCode: string; EmpName: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ open: false, msg: "", color: "success" });
  
  /* Date Modal State */
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  /* Work Report State */
  const [workReportModalOpen, setWorkReportModalOpen] = useState(false);
  const [activeWorkTicket, setActiveWorkTicket] = useState<any>(null);
  const [workDescription, setWorkDescription] = useState("");
  const [serviceType, setServiceType] = useState("In-House");

  /* Update State */
  const [updates, setUpdates] = useState<Record<string, UpdateState>>({});

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
        width: Math.max(rect.width, 220) // Minimum width for names
      });
      setActiveTicketDropdown(ticketID);
      setEmpSearchTerm("");
    }
  };

  const filteredEmployees = empNames.filter(e => {
    const term = empSearchTerm.toLowerCase();
    return e.EmpName.toLowerCase().includes(term) || e.EmpCode.toLowerCase().includes(term);
  });

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
    if (!apiBase) return;
    void loadData();
    void loadEmployees();
  }, [fromDate, toDate, clientId, projectId, apiBase]);

  async function loadEmployees() {
    try {
      const res = await fetch(`${apiBase}Tickets/LOADINTERNALEMPLOYEES?EMPCODE=${empCode}`, { headers: getHeaders(true) });
      const raw = await handleResponse(res, "EMPS");
      setEmpNames((raw || []).map((e: any) => ({ EmpCode: String(e[0]), EmpName: e[1] })));
    } catch (err) {
      console.error("[AssignedTickets] loadEmployees ERROR:", err);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const q = new URLSearchParams({ empcode: empCode, CLIENTID: clientId, PROJECTID: projectId });
      const url = `${apiBase}Tickets/LOADEMPTASKSLIST?${q.toString()}`;
      const res = await fetch(url, { headers: getHeaders(true) });
      const raw = await handleResponse(res, "ASSIGNED");
      console.log("[AssignedTickets] LOADEMPTASKSLIST Payload:", raw);
      
      if (raw && raw.length > 0) {
        const firstItem = raw[0];
        console.log("[AssignedTickets] Sample Item Structure:", firstItem);
        if (Array.isArray(firstItem)) {
          console.log("[AssignedTickets] Status Check (index 22):", firstItem[22]);
          console.log("[AssignedTickets] Mapping Check:", {
            TICKETID: firstItem[1] || firstItem[0],
            StatusIndex22: firstItem[22],
            File: firstItem[8],
            Img: firstItem[9]
          });
        }
      }

      const mapped = (raw || []).map((r: any) => ({
        TICKETID: String(r[1] || r[0]),
        Client: r[2],
        clint_detail: r[5],
        Project: r[3],
        Subject: r[6],
        Remarks: r[11],
        Issue_Status: String(r[22] || 'O').toUpperCase(),
        TicketPriority: r[13],
        TDate: r[10] ? moment(r[10]).format("DD MMM YYYY") : "",
        File_Path: String(r[8] || r.File_Path || "").trim(),
        Img_Path: String(r[9] || r.Img_Path || "").trim(),
        Target_Time: r[27],
      }));
      setData(mapped);
      if (onCountChange) onCountChange(mapped.length);
    } catch (err) {
      console.error("[AssignedTickets] loadData ERROR:", err);
      setData([]);
      if (onCountChange) onCountChange(0);
    } finally {
      setLoading(false);
    }
  }

  const formatTargetTime = (val: any) => {
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    if (num === 0) return "0 mins";
    
    const hours = Math.floor(num);
    const minutes = Math.round((num - hours) * 60);
    
    if (hours === 0) return `${minutes} mins`;
    if (minutes === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${minutes} mins`;
  };

  const updateVal = (id: string, field: keyof UpdateState, val: string) => {
    setUpdates(prev => ({
      ...prev,
      [id]: { 
        ...(prev[id] || { status: "", remark: "", supportEmpCode: "", ticketType: "", closingRemarks: "", quitRemarks: "", targetDate: "" }), 
        [field]: val 
      }
    }));
  };

  const getStatusLabel = (s: string) => {
    const map: any = { "O": "Open", "C": "Closed", "P": "Pending", "A": "Assigned", "H": "Hold", "S": "Assigned" };
    return map[s.toUpperCase()] || s;
  };

  const getStatusOptions = (currentStatus: string) => {
    const s = (currentStatus || "").trim().toUpperCase();
    if (s === "O" || s === "OPEN") return [{ id: "H", value: "Hold" }, { id: "C", value: "Close" }, { id: "Q", value: "Quit" }];
    if (s === "H" || s === "HOLD") return [{ id: "O", value: "Open" }, { id: "Q", value: "Quit" }];
    if (s === "A" || s === "ASSIGNED" || s === "S") return [{ id: "O", value: "Open" }, { id: "Q", value: "Quit" }];
    return [{ id: "O", value: "Open" }, { id: "H", value: "Hold" }, { id: "C", value: "Close" }, { id: "Q", value: "Quit" }];
  };

  async function onUpdateStatus(ticket: any) {
    const up = updates[ticket.TICKETID] || { status: "", remark: "", supportEmpCode: "", ticketType: "", closingRemarks: "", quitRemarks: "", targetDate: "" };
    
    if (up.status === "Q" && !up.quitRemarks.trim()) return alert("Please enter quitting reason");
    if (up.status === "C" && (!up.closingRemarks.trim() || !up.ticketType)) return alert("Please enter closing reason and ticket type");
    if (!up.status) return alert("Please select a status");
    
    const payload = {
      _TICKETID: ticket.TICKETID,
      _EMPCODE_LOGIN: empCode,
      _SUPPORTEMPCODE: up.supportEmpCode || "",
      _SELECTEDTIKSTATUS: up.status,
      _TASKREMARKS: up.quitRemarks || "",
      _TICKETTYPE: up.ticketType || "",
      _CLOSINGREMARKS: up.closingRemarks || ""
    };

    try {
      const res = await fetch(`${apiBase}Tickets/UPDATE_ASSIGN_TICKET`, {
        method: "POST", 
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setToast({ open: true, msg: "Ticket Status Updated", color: "success" });
        await loadData();
      } else {
        setToast({ open: true, msg: "Update Failed", color: "danger" });
      }
    } catch (err) { 
      console.error("[AssignedTickets] onUpdateStatus ERROR:", err);
      setToast({ open: true, msg: "Update Failed", color: "danger" }); 
    }
  }

  async function onSaveWorkReport() {
    if (!workDescription.trim()) return alert("Please enter work description");
    if (!activeWorkTicket) return;

    setLoading(true);
    const payload = {
      _TICKETID: activeWorkTicket.TICKETID,
      _EMPLOYEEID: empCode,
      _CLIENT_NAME: activeWorkTicket.Client,
      _PROJECT_NAMEE: activeWorkTicket.Project,
      _WORKDESCRIPTION: workDescription,
      _SERVICE_TYPE: serviceType
    };

    try {
      const res = await fetch(`${apiBase}Tickets/SaveWorkReport_TicketWise`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setToast({ open: true, msg: "Work Report Saved Successfully", color: "success" });
        setWorkReportModalOpen(false);
        setWorkDescription("");
      } else {
        const errText = await res.text();
        setToast({ open: true, msg: errText || "Save Failed", color: "danger" });
      }
    } catch (err) {
      console.error("[AssignedTickets] onSaveWorkReport ERROR:", err);
      setToast({ open: true, msg: "Save Failed", color: "danger" });
    } finally {
      setLoading(false);
    }
  }

  async function downloadHandler(url: string, filename: string) {
    console.log("[AssignedTickets] downloadHandler triggered", { url, filename });
    try {
      if (!url.startsWith('http')) {
        console.warn("[AssignedTickets] Invalid URL detected in downloadHandler");
        return;
      }
      
      const res = await fetch(url, { headers: getHeaders(true) });
      if (!res.ok) {
        console.error("[AssignedTickets] Download fetch failed:", res.status);
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
      console.log("[AssignedTickets] Download success for:", filename);
    } catch (err) {
      console.error("[AssignedTickets] downloadHandler error:", err);
      window.open(url, '_blank');
    }
  }

  return (
    <div className="ast-root">
      <IonLoading isOpen={loading} message="Fetching assigned tickets..." />

      <div className="ast-ticket-list work-queue-scroller">
        {data.map((x: any, idx) => {
          const up = updates[x.TICKETID] || { status: "", remark: "", supportEmpCode: "", ticketType: "", closingRemarks: "", quitRemarks: "", targetDate: "" };
          const opts = getStatusOptions(x.Issue_Status);
          const statusClass = `ast-status-${x.Issue_Status.toLowerCase()}`;
          
          return (
            <div key={`${x.TICKETID || idx}-${idx}`} className="ast-ticket-row-container ast-fade-up">
              <div className="ast-ticket-badge">
                #{x.TICKETID}
              </div>

              <div className="ast-card-header">
                <span className="ast-spacer"></span>
                <span className={`ast-status-badge ${statusClass}`}>
                  {getStatusLabel(x.Issue_Status)}
                </span>
              </div>

              <div className="ast-ticket-main-grid">
                {/* Column 1: Client & Subject */}
                <div className="ast-grid-column">
                  <div className="ast-info-item">
                    <span className="ast-label">Client / Proj :</span>
                    <span className="ast-value">{x.Client} • {x.Project}</span>
                  </div>
                  <div className="ast-info-item">
                    <span className="ast-label">Details :</span>
                    <span className="ast-value small-text">{x.clint_detail}</span>
                  </div>
                  <div className="ast-info-item">
                    <span className="ast-label">Subject :</span>
                    <span className="ast-value highlight">{x.Subject}</span>
                  </div>
                </div>

                {/* Column 2: Metadata & Target Date */}
                <div className="ast-grid-column">
                  <div className="ast-info-item">
                    <span className="ast-label">Priority :</span>
                    <span className="ast-value" style={{ color: x.TicketPriority?.toLowerCase() === 'high' ? '#ef4444' : 'inherit' }}>
                      {x.TicketPriority}
                    </span>
                  </div>
                  <div className="ast-info-item">
                    <span className="ast-label">Assigned :</span>
                    <span className="ast-value">{x.TDate}</span>
                  </div>
                  {x.Target_Time && (
                    <div className="ast-info-item">
                      <span className="ast-label">Target Time :</span>
                      <div className="ast-inline-date-picker">
                        <IonIcon icon={timeOutline} style={{ color: '#f59e0b', fontSize: '14px' }} />
                        <span className="ast-value highlight-timer">{formatTargetTime(x.Target_Time)}</span>
                      </div>
                    </div>
                  )}
                  
                </div>

                {/* Column 3: Remarks */}
                <div className="ast-grid-column remarks-column">
                  <div className="ast-info-item vertical">
                    <span className="ast-label">Issue Remarks :</span>
                    <div className="ast-value-remarks">{x.Remarks}</div>
                  </div>
                </div>
              </div>

              {/* Action Area (Updates) */}
              <div className="ast-update-container">
                <div className="ast-update-fields">
                  <div className="ast-field-group">
                    <span className="ast-field-label">Transfer To :</span>
                    <div 
                      className={`ast-inline-select searchable-trigger ${activeTicketDropdown === x.TICKETID ? 'active' : ''}`}
                      onClick={(e) => toggleDropdown(x.TICKETID, e)}
                    >
                      <span className="ast-select-text">
                        {empNames.find(e => e.EmpCode === up.supportEmpCode)?.EmpName || "None"}
                      </span>
                    </div>
                  </div>

                  <div className="ast-field-group">
                    <span className="ast-field-label">Action Status :</span>
                    <div className="ast-inline-select status-select">
                      <IonSelect
                        value={up.status}
                        onIonChange={e => updateVal(x.TICKETID, "status", e.detail.value)}
                        interface="popover"
                        placeholder="Status"
                      >
                        {opts.map((o, oidx) => (
                          <IonSelectOption key={`${o.id || oidx}`} value={o.id}>{o.value}</IonSelectOption>
                        ))}
                      </IonSelect>
                    </div>
                  </div>

                  {up.status === "C" && (
                    <>
                      <div className="ast-field-group">
                        <span className="ast-field-label">Ticket Type :</span>
                        <div className="ast-inline-select">
                          <IonSelect
                            value={up.ticketType}
                            onIonChange={e => updateVal(x.TICKETID, "ticketType", e.detail.value)}
                            interface="popover"
                          >
                            <IonSelectOption value="S">Support</IonSelectOption>
                            <IonSelectOption value="B">Bug</IonSelectOption>
                            <IonSelectOption value="M">Modification</IonSelectOption>
                            <IonSelectOption value="N">New Implementation</IonSelectOption>
                            <IonSelectOption value="D">Duplicate</IonSelectOption>
                            <IonSelectOption value="I">Irrelevant</IonSelectOption>
                          </IonSelect>
                        </div>
                      </div>
                      <div className="ast-field-group flexible">
                        <span className="ast-field-label">Closing Msg :</span>
                        <input
                          className="ast-inline-input"
                          placeholder="Why closing?"
                          value={up.closingRemarks}
                          onChange={e => updateVal(x.TICKETID, "closingRemarks", e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  {up.status === "Q" && (
                    <div className="ast-field-group flexible">
                      <span className="ast-field-label">Quit Msg :</span>
                      <input
                        className="ast-inline-input alert"
                        placeholder="Reason to quit?"
                        value={up.quitRemarks}
                        onChange={e => updateVal(x.TICKETID, "quitRemarks", e.target.value)}
                      />
                    </div>
                  )}
                </div>

                  <div className="ast-action-footer">
                   <div className="ast-attachment-btns">
                    {x.File_Path && x.File_Path !== "0" && x.File_Path !== "null" && x.File_Path !== "" && (
                      <button 
                        className="ast-attachment-btn" 
                        onClick={() => {
                          const fileUrl = `https://tickets.dbasesolutions.in/issue_file/${x.File_Path}`;
                          console.log("[AssignedTickets] File click:", fileUrl);
                          downloadHandler(fileUrl, x.File_Path);
                        }}
                      >
                        <IonIcon icon={downloadOutline} />
                        <span>File</span>
                      </button>
                    )}
                    {x.Img_Path && x.Img_Path !== "0" && x.Img_Path !== "null" && x.Img_Path !== "FALSE" && x.Img_Path !== "" && (
                      <button 
                        className="ast-attachment-btn" 
                        onClick={() => {
                          const imgUrl = `https://tickets.dbasesolutions.in/issue_img/${x.Img_Path}`;
                          console.log("[AssignedTickets] Image click:", imgUrl);
                          downloadHandler(imgUrl, x.Img_Path);
                        }}
                      >
                        <IonIcon icon={eyeOutline} />
                        <span>View</span>
                      </button>
                    )}
                    {/* <button 
                      className="ast-attachment-btn highlight-btn" 
                      onClick={() => {
                        setActiveWorkTicket(x);
                        setWorkReportModalOpen(true);
                      }}
                    >
                      <IonIcon icon={clipboardOutline} />
                      <span>Work Report</span>
                    </button> */}
                  </div>

                  <button className="ast-primary-submit-btn" onClick={() => onUpdateStatus(x)}>
                    <IonIcon icon={checkmarkCircleOutline} />
                    <span style={{color:"#fff"}}>Update Task</span>
                  </button>
                </div>
              </div>
            </div>
          );

        })}
      </div>

      {data.length === 0 && !loading && (
        <div className="ast-empty">
          <IonIcon icon={timeOutline} style={{ fontSize: "48px", opacity: 0.5, marginBottom: "16px" }} />
          <p>You don't have any assigned tickets.</p>
        </div>
      )}

      <IonModal
        isOpen={dateModalOpen}
        onDidDismiss={() => setDateModalOpen(false)}
        className="pwt-date-modal"
      >
        <div className="pwt-modal-content">
          <h3 className="pwt-modal-title">Select Target Date</h3>
          <IonDatetime
            presentation="date"
            onIonChange={(e) => {
              if (typeof e.detail.value === "string" && activeTicketId) {
                updateVal(activeTicketId, "targetDate", e.detail.value);
              }
              setDateModalOpen(false);
            }}
          />
          <IonButton
            expand="block"
            mode="ios"
            fill="outline"
            onClick={() => setDateModalOpen(false)}
          >
            Cancel
          </IonButton>
        </div>
      </IonModal>

      <IonModal
        isOpen={workReportModalOpen}
        onDidDismiss={() => setWorkReportModalOpen(false)}
        className="pwt-date-modal"
      >
        <div className="pwt-modal-content">
          <h3 className="pwt-modal-title">Work Report: #{activeWorkTicket?.TICKETID}</h3>
          
          <div className="ast-field-group vertical" style={{ width: '100%', marginBottom: '16px' }}>
            <span className="ast-field-label">Work Description</span>
            <textarea
              className="ast-inline-input"
              style={{ height: '120px', padding: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', width: '100%', marginTop: '8px' }}
              placeholder="What have you done?"
              value={workDescription}
              onChange={e => setWorkDescription(e.target.value)}
            />
          </div>

          <div className="ast-field-group vertical" style={{ width: '100%', marginBottom: '24px' }}>
            <span className="ast-field-label">Service Type</span>
            <div className="ast-inline-select" style={{ width: '100%', marginTop: '8px', padding: '4px' }}>
              <IonSelect
                value={serviceType}
                onIonChange={e => setServiceType(e.detail.value)}
                interface="popover"
                style={{ width: '100%' }}
              >
                <IonSelectOption value="In-House">In-House</IonSelectOption>
                <IonSelectOption value="On-Site">On-Site</IonSelectOption>
              </IonSelect>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <IonButton
              expand="block"
              style={{ flex: 1 }}
              onClick={onSaveWorkReport}
            >
              Submit Report
            </IonButton>
            <IonButton
              expand="block"
              mode="ios"
              fill="outline"
              style={{ flex: 1 }}
              onClick={() => setWorkReportModalOpen(false)}
            >
              Cancel
            </IonButton>
          </div>
        </div>
      </IonModal>

      <IonToast
        isOpen={toast.open} message={toast.msg} color={toast.color}
        duration={2000} onDidDismiss={() => setToast({ ...toast, open: false })}
      />

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
              {/* Optional: 'None' choice */}
              <div 
                className="dropdown-emp-item"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  updateVal(activeTicketDropdown!, "supportEmpCode", "");
                  setActiveTicketDropdown(null);
                }}
              >
                <div className="dr-avatar" style={{ background: '#94a3b8' }}>N</div>
                <div className="dr-info">
                  <span className="dr-name">None</span>
                </div>
              </div>

              {filteredEmployees.map((e, index) => {
                const isSelected = updates[activeTicketDropdown!]?.supportEmpCode === e.EmpCode;
                
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
                      updateVal(activeTicketDropdown!, "supportEmpCode", e.EmpCode);
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
              {filteredEmployees.length === 0 && empSearchTerm && (
                <div className="dr-no-results">
                  <p>No matches for "{empSearchTerm}"</p>
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
