import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  IonButton, IonIcon, IonLoading, IonToast, IonSelect, IonSelectOption, IonModal, IonDatetime
} from "@ionic/react";
import { downloadOutline, eyeOutline, checkmarkCircleOutline, timeOutline, calendarOutline, clipboardOutline, searchOutline, closeCircle, checkmarkCircle, chevronDownOutline, chevronUpOutline } from "ionicons/icons";
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
  const [collapsedTickets, setCollapsedTickets] = useState<Record<string, boolean>>({});

  const toggleCollapse = (ticketId: string) => {
    setCollapsedTickets(prev => ({
      ...prev,
      [ticketId]: !prev[ticketId]
    }));
  };

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

  const [allEmps, setAllEmps] = useState<{ EmpCode: string; EmpName: string }[]>([]);

  useEffect(() => {
    if (!apiBase) return;
    let isMounted = true;
    async function init() {
      const empsMap = await loadEmployees();
      if (isMounted) {
        await loadData(empsMap);
      }
    }
    void init();
    return () => { isMounted = false; };
  }, [fromDate, toDate, clientId, projectId, apiBase, empCode]);

  async function loadEmployees(): Promise<Map<string, string>> {
    const empLookup = new Map<string, string>();
    try {
      const [resInternal, resAll, resSupport] = await Promise.all([
        fetch(`${apiBase}Tickets/LOADINTERNALEMPLOYEES?EMPCODE=${empCode}`, { headers: getHeaders(true) }).catch(() => null),
        fetch(`${apiBase}Employee/Load_Employees`, { headers: getHeaders(true) }).catch(() => null),
        fetch(`${apiBase}Employee/Load_Employees_SupportTickets?SearchEmp=${empCode}`, { headers: getHeaders(true) }).catch(() => null)
      ]);

      const internalList: { EmpCode: string; EmpName: string }[] = [];
      const allList: { EmpCode: string; EmpName: string }[] = [];

      const addEmp = (c: any, n: any, targetList?: { EmpCode: string; EmpName: string }[]) => {
        const codeStr = String(c ?? "").trim();
        const nameStr = String(n ?? "").trim();
        if (!codeStr || ["0", "null", "NULL", "undefined"].includes(codeStr)) return;
        if (!empLookup.has(codeStr) || (nameStr && !empLookup.get(codeStr))) {
          empLookup.set(codeStr, nameStr);
        }
        if (targetList && !targetList.some(item => item.EmpCode === codeStr)) {
          targetList.push({ EmpCode: codeStr, EmpName: nameStr || codeStr });
        }
      };

      if (resInternal && resInternal.ok) {
        const raw = await handleResponse(resInternal, "EMPS_INTERNAL");
        const list = Array.isArray(raw) ? raw : (raw?.Table || raw?.table || []);
        (list || []).forEach((e: any) => {
          const c = Array.isArray(e) ? e[0] : (e.EmpCode || e.EMPCODE || e.Empcode || e[0]);
          const n = Array.isArray(e) ? e[1] : (e.EmpName || e.EMPNAME || e.Empname || e[1]);
          addEmp(c, n, internalList);
        });
        setEmpNames(internalList);
      }

      if (resAll && resAll.ok) {
        const rawAll = await handleResponse(resAll, "EMPS_ALL");
        const listAll = Array.isArray(rawAll) ? rawAll : (rawAll?.Table || rawAll?.table || []);
        (listAll || []).forEach((e: any) => {
          const c = Array.isArray(e) ? e[0] : (e.EmpCode || e.EMPCODE || e.Empcode || e[0]);
          const n = Array.isArray(e) ? e[1] : (e.EmpName || e.EMPNAME || e.Empname || e[1]);
          addEmp(c, n, allList);
        });
      }

      if (resSupport && resSupport.ok) {
        const rawSup = await handleResponse(resSupport, "EMPS_SUP");
        const listSup = Array.isArray(rawSup) ? rawSup : (rawSup?.Table || rawSup?.table || []);
        (listSup || []).forEach((e: any) => {
          const c = Array.isArray(e) ? e[0] : (e.EmpCode || e.EMPCODE || e.Empcode || e[0]);
          const n = Array.isArray(e) ? e[1] : (e.EmpName || e.EMPNAME || e.Empname || e[1]);
          addEmp(c, n, allList);
        });
      }

      setAllEmps(allList.length > 0 ? allList : internalList);
    } catch (err) {
      console.error("[AssignedTickets] loadEmployees ERROR:", err);
    }
    return empLookup;
  }

  const formatEmpDisplay = (code: any, name?: any, customLookup?: Map<string, string>) => {
    const strCode = String(code || "").trim();
    const strName = String(name || "").trim();
    if (!strCode && !strName) return "";
    if (["0", "null", "NULL", "undefined", ""].includes(strCode) && !strName) return "";

    const lookupName = customLookup?.get(strCode);
    if (lookupName && !["0", "null", "NULL", "undefined", ""].includes(lookupName)) {
      return lookupName.includes("-") ? lookupName : `${strCode}-${lookupName}`;
    }

    const found = allEmps.find(e => String(e.EmpCode).trim() === strCode) ||
      empNames.find(e => String(e.EmpCode).trim() === strCode);
    if (found) {
      const eName = String(found.EmpName || "").trim();
      return eName.includes("-") ? eName : `${found.EmpCode}-${eName}`;
    }
    if (strName && !["0", "null", "NULL", "undefined", ""].includes(strName)) {
      return strName.includes("-") ? strName : (strCode ? `${strCode}-${strName}` : strName);
    }
    if (strCode && !["0", "null", "NULL", "undefined", ""].includes(strCode)) {
      return strCode;
    }
    return "";
  };

  const extractTrackingRow = (item: any) => {
    if (!item) return { empCode: "", supEmp: "", createdBy: "" };
    if (Array.isArray(item)) {
      return {
        empCode: String(item[2] ?? "").trim(),
        supEmp: String(item[3] ?? "").trim(),
        createdBy: String(item[4] ?? "").trim()
      };
    }
    if (typeof item === "object") {
      const keys = Object.keys(item);
      const findKeyVal = (searchKeys: string[]) => {
        for (const sk of searchKeys) {
          const matched = keys.find(k => k.toLowerCase() === sk.toLowerCase());
          if (matched && item[matched] !== undefined && item[matched] !== null) {
            return String(item[matched]).trim();
          }
        }
        return "";
      };
      return {
        empCode: findKeyVal(["EMPCODE", "EmpCode", "empcode", "EMP_CODE", "EmployeeCode"]),
        supEmp: findKeyVal(["Sup_EmpCodes", "sup_EmpCodes", "Sup_empcodes", "sup_empcodes", "Sup_EmpCode", "SupEmpCode", "SupEmp", "sup_EmpCode", "SupportEmpCode"]),
        createdBy: findKeyVal(["CREATEDBYID", "CreatedById", "createdbyid", "CreatedBy", "createdby", "CREATEDBY", "CreatedByID"])
      };
    }
    return { empCode: "", supEmp: "", createdBy: "" };
  };

  async function loadData(customLookup?: Map<string, string>) {
    setLoading(true);
    try {
      const q = new URLSearchParams({ empcode: empCode, CLIENTID: clientId, PROJECTID: projectId, _nocache: Date.now().toString() });
      const url = `${apiBase}Tickets/LOADEMPTASKSLIST?${q.toString()}`;
      const res = await fetch(url, { headers: getHeaders(true) });
      const raw = await handleResponse(res, "ASSIGNED");
      console.log("[AssignedTickets] LOADEMPTASKSLIST Payload:", raw);

      const rawList = Array.isArray(raw) ? raw : (raw?.Table || raw?.table || []);

      const baseMapped = (rawList || []).map((r: any) => {
        const isArr = Array.isArray(r);
        return {
          TICKETID: String(isArr ? (r[1] || r[0]) : (r.TICKETID || r.TicketID || "")).trim(),
          Client: isArr ? r[2] : (r.Client || ""),
          clint_detail: isArr ? r[5] : (r.clint_detail || r.Client_MobileNo || ""),
          Project: isArr ? r[3] : (r.Project || ""),
          Subject: isArr ? r[6] : (r.Subject || ""),
          Remarks: isArr ? r[11] : (r.Remarks || ""),
          Issue_Status: String(isArr ? (r[22] || r[12] || 'O') : (r.Issue_Status || r.STATUS || 'O')).toUpperCase(),
          TicketPriority: isArr ? r[13] : (r.TicketPriority || "Normal"),
          TDate: (isArr ? r[10] : (r.TDate || r.Date)) ? moment(isArr ? r[10] : (r.TDate || r.Date)).format("DD MMM YYYY") : "",
          Target_Time: isArr ? r[27] : (r.Target_Time || ""),
          File_Path: String(
            r.File_Path || r.file_Path || r.file_path ||
            (isArr ? (
              (typeof r[14] === 'string' && r[14].includes('.')) ? r[14] :
                (typeof r[8] === 'string' && r[8].includes('.')) ? r[8] : ""
            ) : "") || ""
          ).trim(),
          Img_Path: String(
            r.Img_Path || r.img_Path || r.img_path ||
            (isArr ? (
              (typeof r[15] === 'string' && r[15].includes('.')) ? r[15] :
                (typeof r[9] === 'string' && r[9].includes('.')) ? r[9] : ""
            ) : "") || ""
          ).trim(),
          CreatedBy: "",
          AssignedEmpCode: "",
          SupEmpCode: ""
        };
      });

      // Fetch tracking per ticket to get exact Assigner (CreatedBy), Receiver (EMPCODE), and Support Emp (Sup_EmpCodes)
      const ticketsWithTracking = await Promise.all(
        baseMapped.map(async (t: any) => {
          const tid = String(t.TICKETID || "").trim();
          if (!tid) return t;
          try {
            const trkRes = await fetch(`${apiBase}Tickets/Load_TicketTracking_ByTicketID?TicketID=${encodeURIComponent(tid)}`, { headers: getHeaders(true) });
            const trkData = await handleResponse(trkRes, `TRACKING_${tid}`);
            const trkList = Array.isArray(trkData) ? trkData : (trkData?.Table || trkData?.table || []);

            if (trkList && trkList.length > 0) {
              const lastRow = trkList[trkList.length - 1];
              const lastInfo = extractTrackingRow(lastRow);
              const isArr = Array.isArray(lastRow);
              const latestStatus = String(isArr ? (lastRow[8] || lastRow[12] || '') : (lastRow.STATUS || lastRow.Status || '')).toUpperCase();

              let createdBy = lastInfo.createdBy;
              let empCode = lastInfo.empCode;
              let supEmp = lastInfo.supEmp;

              // If supEmp not in latest row, check earlier rows
              if (!supEmp) {
                for (let i = trkList.length - 2; i >= 0; i--) {
                  const info = extractTrackingRow(trkList[i]);
                  if (info.supEmp && !["0", "null", "NULL", "undefined", ""].includes(info.supEmp)) {
                    supEmp = info.supEmp;
                    break;
                  }
                }
              }

              const resolvedStatus = latestStatus || t.Issue_Status;
              console.log("[AssignedTickets] Ticket tracking resolved:", { tid, createdBy, empCode, supEmp, resolvedStatus });

              return {
                ...t,
                Issue_Status: resolvedStatus,
                CreatedBy: createdBy,
                AssignedEmpCode: empCode,
                SupEmpCode: supEmp
              };
            }
          } catch (e) {
            console.error("Error fetching tracking for ticket", tid, e);
          }
          return t;
        })
      );

      const activeTickets = ticketsWithTracking.filter((t: any) => {
        const s = String(t.Issue_Status || '').toUpperCase();
        if (s === 'C' || s === 'CLOSED' || s === 'Q' || s === 'QUIT') {
          return false;
        }
        return true;
      });

      setData(activeTickets);
      if (onCountChange) onCountChange(activeTickets.length);
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

    if (up.status === "Q" && !up.quitRemarks.trim()) {
      setToast({ open: true, msg: "Please enter quitting reason", color: "warning" });
      return;
    }
    if (up.status === "C") {
      if (!up.ticketType) {
        setToast({ open: true, msg: "Please select ticket type", color: "warning" });
        return;
      }
      if (!up.closingRemarks.trim()) {
        setToast({ open: true, msg: "Please enter closing reason", color: "warning" });
        return;
      }
    }

    if (!up.status && !up.supportEmpCode) {
      setToast({ open: true, msg: "Please select an Action Status or Transfer employee", color: "warning" });
      return;
    }

    const payload = {
      _TICKETID: ticket.TICKETID,
      _EMPCODE_LOGIN: empCode,
      _SUPPORTEMPCODE: up.supportEmpCode || "",
      _SELECTEDTIKSTATUS: up.status || ticket.Issue_Status || "O",
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

        if (up.status === "C") {
          try {
            const desc = `${ticket.Remarks || ""}\nClosed Ticket: ${up.closingRemarks}`.trim();
            const wrPayload = {
              _TICKETID: String(ticket.TICKETID),
              _EMPLOYEEID: String(empCode),
              _CLIENT_NAME: String(ticket.Client),
              _PROJECT_NAMEE: String(ticket.Project || ""),
              _WORKDESCRIPTION: `${ticket.TICKETID}_${desc}`,
              _SERVICE_TYPE: String(serviceType)
            };

            console.log("[AssignedTickets] Auto-saving Work Report for Closed Ticket:", wrPayload);
            const wrRes = await fetch(`${apiBase}Tickets/SaveWorkReport_TicketWise`, {
              method: "POST",
              headers: getHeaders(),
              body: JSON.stringify(wrPayload)
            });

            if (wrRes.ok) {
              console.log("[AssignedTickets] Auto Work Report Saved Successfully");
            } else {
              console.error("[AssignedTickets] Auto Work Report Save Failed");
            }
          } catch (wrErr) {
            console.error("[AssignedTickets] Auto-save Work Report error:", wrErr);
          }
        }

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
    if (!workDescription.trim()) {
      setToast({ open: true, msg: "Please enter work description", color: "warning" });
      return;
    }
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
          const isCollapsed = collapsedTickets[x.TICKETID] || false;

          return (
            <div key={`${x.TICKETID || idx}-${idx}`} className="ast-ticket-row-container ast-fade-up">
              <div className="ast-ticket-badge">
                #{x.TICKETID}
              </div>

              <div
                className="ast-card-header"
                onClick={() => toggleCollapse(x.TICKETID)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 16px 8px 110px',
                  cursor: 'pointer',
                  background: '#f8fafc',
                  borderBottom: '1px solid rgba(0,0,0,0.05)',
                  userSelect: 'none'
                }}
              >
                <span
                  className="ast-card-summary-text"
                  style={{
                    fontWeight: 'bold',
                    fontSize: '13px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: 'var(--ion-color-dark)',
                    maxWidth: '60%',
                    display: isCollapsed ? 'inline' : 'none'
                  }}
                >
                  {x.Client} • {x.Subject}
                </span>
                <span className="ast-spacer" style={{ flex: 1 }}></span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`ast-status-badge ${statusClass}`}>
                    {getStatusLabel(x.Issue_Status)}
                  </span>
                  <IonIcon icon={isCollapsed ? chevronDownOutline : chevronUpOutline} style={{ fontSize: '20px', color: 'var(--ion-color-medium)' }} />
                </div>
              </div>

              {!isCollapsed && (
                <>
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

                  {/* Support Ticket Transfer Line - Only shown when SupEmpCode exists and is transferred between distinct employees */}
                  {(() => {
                    const toCode = String(x.SupEmpCode || "").trim();
                    if (!toCode || ["0", "null", "NULL", ""].includes(toCode)) return null;

                    const toEmpDisplay = formatEmpDisplay(toCode);
                    if (!toEmpDisplay) return null;

                    // Prefer CreatedBy if distinct from SupEmpCode, otherwise AssignedEmpCode if distinct
                    const fromCode = (
                      x.CreatedBy && String(x.CreatedBy).trim() !== toCode && !["0", "null", "NULL", ""].includes(String(x.CreatedBy).trim())
                    ) ? String(x.CreatedBy).trim() : (
                      x.AssignedEmpCode && String(x.AssignedEmpCode).trim() !== toCode && !["0", "null", "NULL", ""].includes(String(x.AssignedEmpCode).trim())
                    ) ? String(x.AssignedEmpCode).trim() : "";

                    const fromEmpDisplay = fromCode ? formatEmpDisplay(fromCode) : "";

                    // Do not display if from and to are identical or missing
                    if (!fromEmpDisplay || fromEmpDisplay === toEmpDisplay) return null;

                    return (
                      <div className="ast-support-flow-bar">
                        <span className="ast-support-flow-title">Support ticket :</span>
                        <span className="ast-support-flow-emp">
                          {fromEmpDisplay}
                        </span>
                        <span className="ast-support-flow-arrow">&gt;</span>
                        <span className="ast-support-flow-emp">
                          {toEmpDisplay}
                        </span>
                      </div>
                    );
                  })()}

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
                      </div>

                      <button className="ast-primary-submit-btn" onClick={() => onUpdateStatus(x)}>
                        <IonIcon icon={checkmarkCircleOutline} />
                        <span style={{ color: "#fff" }}>Update Task</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          );

        })}
      </div>

      {data.length === 0 && !loading && (
        <div className="ast-empty">
          <IonIcon icon={timeOutline} style={{ fontSize: "24px", opacity: 0.5, marginBottom: "8px" }} />
          <p style={{ margin: 0, fontSize: "13px" }}>You don't have any assigned tickets.</p>
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
