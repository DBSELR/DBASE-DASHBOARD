import React, { useEffect, useState } from "react";
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle,
  IonButton, IonIcon, IonLoading, IonToast, IonModal, IonDatetime, IonSelect, IonSelectOption, IonAvatar
} from "@ionic/react";
import { useHistory } from "react-router";
import {
  arrowBackOutline, searchOutline, calendarOutline, chevronDownOutline,
  downloadOutline, fileTrayFullOutline, personOutline, businessOutline,
  layersOutline, chatbubblesOutline, timeOutline
} from "ionicons/icons";
import moment from "moment";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./TicketData.css";

import { API_BASE } from "../../../config";

export default function TicketData() {
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ open: false, msg: "", color: "success" });

  /* Filter State */
  const [fromDate, setFromDate] = useState(moment().startOf('month').format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(moment().format("YYYY-MM-DD"));
  const [status, setStatus] = useState("C");
  const [clientId, setClientId] = useState("0");
  const [projectId, setProjectId] = useState("0");
  const [targetEmp, setTargetEmp] = useState("0");

  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [emps, setEmps] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any[]>([]);

  /* Date Modal State */
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  /* Tracking Modal State */
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [trackingData, setTrackingData] = useState<any[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState("");

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
      if (typeof json === "string") return JSON.parse(json);
      return json;
    } catch (err) {
      console.error(`[${tag}] parse error:`, err);
      return [];
    }
  };

  useEffect(() => {
    loadInitial();
    runReport(true);
  }, []);

  async function loadInitial() {
    console.log("[TicketData] loadInitial START");
    try {
      const crez = await fetch(`${API_BASE}Sources/Load_Clients_Sources`, { headers: getHeaders(true) });
      const cdata = await handleResponse(crez, "CLIENTS");
      console.log("[TicketData] Clients loaded:", cdata?.length);
      setClients(cdata.map((r: any) => ({ Client_Id: String(r[0]), Client_Name: r[1] })));

      const erez = await fetch(`${API_BASE}Employee/Load_Employees`, { headers: getHeaders(true) });
      const edata = await handleResponse(erez, "EMPS");
      console.log("[TicketData] Employees loaded:", edata?.length);
      setEmps(edata.map((r: any) => ({ EmpCode: String(r[0]), EmpName: r[1] })));
    } catch (err) {
      console.error("[TicketData] loadInitial ERROR:", err);
    }
  }

  const fetchTracking = async (ticketId: string) => {
    if (!ticketId) return;
    setSelectedTicketId(ticketId);
    setTrackingLoading(true);
    setTrackingModalOpen(true);
    try {
      const res = await fetch(`${API_BASE}Tickets/Load_TicketTracking_ByTicketID?TicketID=${ticketId}`, {
        headers: getHeaders(true)
      });
      const data = await handleResponse(res, "TRACKING");
      setTrackingData(data || []);
    } catch (err) {
      console.error("[TicketData] fetchTracking ERROR:", err);
      setToast({ open: true, msg: "Failed to load tracking history", color: "danger" });
    } finally {
      setTrackingLoading(false);
    }
  };

  const getEmpName = (code: string) => {
    if (!code || code === "0") return "";
    const emp = emps.find(e => e.EmpCode === code);
    return emp ? emp.EmpName : code;
  };

  async function loadProjects(cid: string) {
    if (cid === "0") { setProjects([]); return; }
    console.log("[TicketData] loadProjects START", { cid });
    try {
      const res = await fetch(`${API_BASE}Sources/Load_Project_Sources?CID=${cid}`, { headers: getHeaders(true) });
      const pdata = await handleResponse(res, "PROJECTS");
      console.log("[TicketData] Projects loaded:", pdata?.length);
      setProjects(pdata.map((r: any) => ({ P_ID: String(r[0]), project: r[1] })));
    } catch (err) {
      console.error("[TicketData] loadProjects ERROR:", err);
      setProjects([]);
    }
  }

  async function runReport(isFilterMode: boolean) {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const dFrom = moment(fromDate).format("MM-DD-YYYY");
      const dTo = moment(toDate).format("MM-DD-YYYY");

      const q = new URLSearchParams({
        ClientID: clientId,
        ProjectID: projectId,
        Date: dFrom,
        ToDate: dTo,
        status: status === "0" ? "0" : status,
        EMPCODE: targetEmp === "0" ? "0" : targetEmp
      });

      const endpoint = isFilterMode ? "Tickets/Load_LOADSUPPORTTICKETS_DateWise_FromTo" : "Tickets/Load_AllTickets";
      const fullUrl = `${API_BASE}${endpoint}?${q.toString()}`;

      console.log(`[TicketData] runReport START {isFilterMode: ${isFilterMode}, url: ${fullUrl}}`);

      const res = await fetch(fullUrl, {
        headers: getHeaders(true),
        signal: controller.signal
      });

      console.log(`[TicketData] runReport RESPONSE {status: ${res.status}}`);

      const rawData = await handleResponse(res, "REPORT");
      console.log(`[TicketData] runReport DATA_RECV {count: ${rawData?.length}}`, rawData);

let mapped = (rawData || []).map((r: any) => ({
  TicketID: r[1] || r.TicketID,
  Client: r[2] || r.Client,
  Project: r[3] || r.Project,
  TDate: r[8] || r.TDate,
  Employee: r[16] || r.Employee,
  STATUS: r[21] || r.STATUS,

  Remarks: r[29] || r[9] || r.Remarks,
  TaskRemark: r[30] || "",

  // ✅ SHOW EXACT DATA FROM SP
  AssignedTime: r[31],   // no conversion
  TimeTaken: r[26],      // no conversion

  Client_Name: r[28]
  
}));

      // Fixed: Always apply client-side filtering to ensure correctness regardless of API behavior
      const start = moment(fromDate).startOf('day');
      const end = moment(toDate).endOf('day');
      mapped = mapped.filter((r: any) => {
        // Parse TDate (format matches log: "10-04-2026 10:54 AM")
        const d = moment(r.TDate, "DD-MM-YYYY HH:mm A");
        return d.isValid() ? d.isSameOrAfter(start) && d.isSameOrBefore(end) : true;
      });

      setReportData(mapped);
      if (mapped.length === 0) setToast({ open: true, msg: "No records found", color: "warning" });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log("[TicketData] Request aborted");
        return;
      }
      console.error("[TicketData] runReport ERROR", err);
      setReportData([]);
      setToast({ open: true, msg: "Failed to load report", color: "danger" });
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  const downloadExcel = () => {
    if (reportData.length === 0) {
      setToast({ open: true, msg: "No data available to download", color: "warning" });
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(reportData.map(r => ({
      "Ticket ID": r.TicketID,
      "Client": r.Client,
      "Project": r.Project,
      "Date": r.TDate,
      "Employee": r.Employee,
      "Status": r.STATUS,
      "Remarks": r.Remarks,
      "Closed Remark": r.TaskRemark,
      "Assigned Time": String(r.AssignedTime),
      "Time Taken": String(r.TimeTaken),
      "Client_Name": r.Client_Name
      
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ticket Report");

    const fileName = `Ticket_Report_${moment().format("DDMMYYYY_HHmm")}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    setToast({ open: true, msg: "Excel downloaded successfully", color: "success" });
  };

  const downloadPDF = async () => {
    if (reportData.length === 0) {
      setToast({ open: true, msg: "No data available to download", color: "warning" });
      return;
    }

    setLoading(true);
    try {
      const doc = new jsPDF();

      // Load Logo
      const img = new Image();
      img.src = "/images/dbs-logo-short.png";
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve; // Continue even if logo fails
      });

      if (img.complete && img.naturalWidth !== 0) {
        doc.addImage(img, 'PNG', 14, 10, 20, 20); // Square-ish logo
      }

      // Header Text
      doc.setFontSize(22);
      doc.setTextColor(241, 90, 36); // DBASE Orange
      doc.setFont("helvetica", "bold");
      doc.text("DBASE TICKETING SYSTEM", 40, 18);

      doc.setFontSize(14);
      doc.setTextColor(50, 50, 50);
      doc.text("Support Ticket Report", 40, 26);

      // Result Count & Context
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.setFont("helvetica", "normal");
      doc.text(`Total Results: ${reportData.length}`, 14, 38);
      doc.text(`Report Range: ${moment(fromDate).format("DD MMM YYYY")} to ${moment(toDate).format("DD MMM YYYY")}`, 14, 43);
      doc.text(`Generated on: ${moment().format("DD MMM YYYY, HH:mm")}`, 140, 38);

      const tableColumn = ["ID", "Client", "Project", "Date", "Employee", "Status", "Remarks"];
      const tableRows = reportData.map(r => [
        `#${r.TicketID}`,
        r.Client,
        r.Project,
        r.TDate,
        r.Employee,
        r.STATUS,
        r.Remarks
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 50,
        theme: 'grid',
        headStyles: {
          fillColor: [241, 90, 36], // DBASE Orange
          fontSize: 10,
          halign: 'center'
        },
        styles: {
          fontSize: 8,
          cellPadding: 3
        },
        columnStyles: {
          0: { fontStyle: 'bold', halign: 'center' },
          5: { halign: 'center' },
          6: { cellWidth: 45 } // Limit remarks width
        }
      });

      const fileName = `Ticket_Report_${moment().format("DDMMYYYY_HHmm")}.pdf`;
      doc.save(fileName);
      setToast({ open: true, msg: "PDF downloaded successfully", color: "success" });
    } catch (error) {
      console.error("PDF generation failed:", error);
      setToast({ open: true, msg: "Failed to generate PDF", color: "danger" });
    } finally {
      setLoading(false);
    }
  };


  return (
    <IonPage>
      <IonContent className="td-main-container">
        <IonLoading isOpen={loading} message="Fetching reports..." />

        {/* Header */}
        <div className="td-page-header">
          <button className="td-back-btn" onClick={() => history.goBack()}>
            <IonIcon icon={arrowBackOutline} />
          </button>
          <h1 className="td-page-title">Ticket Reports</h1>
        </div>

        {/* Filters Card */}
        <div className="td-filter-card">
          <div className="td-filter-grid">
            <div className="td-form-group">
              <label className="td-label">From Date</label>
              <div className="td-input-box" onClick={() => setStartOpen(true)}>
                <span>{moment(fromDate).format("DD MMM YYYY")}</span>
                <IonIcon icon={calendarOutline} />
              </div>
            </div>

            <div className="td-form-group">
              <label className="td-label">To Date</label>
              <div className="td-input-box" onClick={() => setEndOpen(true)}>
                <span>{moment(toDate).format("DD MMM YYYY")}</span>
                <IonIcon icon={calendarOutline} />
              </div>
            </div>

            <div className="td-form-group">
              <label className="td-label">Status</label>
              <div className="td-input-box" style={{ padding: 0 }}>
                <IonSelect
                  value={status}
                  onIonChange={e => setStatus(e.detail.value)}
                  interface="popover"
                  style={{ width: "100%", "--padding-start": "14px" }}
                >
                  <IonSelectOption value="P">Pending</IonSelectOption>
                  <IonSelectOption value="A">Assigned</IonSelectOption>
                  <IonSelectOption value="O">Open</IonSelectOption>
                  <IonSelectOption value="H">Hold</IonSelectOption>
                  <IonSelectOption value="C">Closed</IonSelectOption>
                </IonSelect>
              </div>
            </div>

            <div className="td-form-group">
              <label className="td-label">Client</label>
              <div className="td-input-box" style={{ padding: 0 }}>
                <IonSelect
                  value={clientId}
                  onIonChange={e => { setClientId(e.detail.value); loadProjects(e.detail.value); }}
                  interface="popover"
                  style={{ width: "100%", "--padding-start": "14px" }}
                >
                  <IonSelectOption value="0">All Clients</IonSelectOption>
                  {clients.map(c => <IonSelectOption key={c.Client_Id} value={c.Client_Id}>{c.Client_Name}</IonSelectOption>)}
                </IonSelect>
              </div>
            </div>

            <div className="td-form-group">
              <label className="td-label">Project</label>
              <div className="td-input-box" style={{ padding: 0 }}>
                <IonSelect
                  value={projectId}
                  onIonChange={e => setProjectId(e.detail.value)}
                  interface="popover"
                  style={{ width: "100%", "--padding-start": "14px" }}
                >
                  <IonSelectOption value="0">All Projects</IonSelectOption>
                  {projects.map(p => <IonSelectOption key={p.P_ID} value={p.P_ID}>{p.project}</IonSelectOption>)}
                </IonSelect>
              </div>
            </div>

            <div className="td-form-group">
              <label className="td-label">Employee</label>
              <div className="td-input-box" style={{ padding: 0 }}>
                <IonSelect
                  value={targetEmp}
                  onIonChange={e => setTargetEmp(e.detail.value)}
                  interface="popover"
                  style={{ width: "100%", "--padding-start": "14px" }}
                >
                  <IonSelectOption value="0">All Employees</IonSelectOption>
                  {emps.map(ea => <IonSelectOption key={ea.EmpCode} value={ea.EmpCode}>{ea.EmpName}</IonSelectOption>)}
                </IonSelect>
              </div>
            </div>
          </div>

          <button className="td-run-btn" onClick={() => runReport(true)}>
            <IonIcon icon={searchOutline} />
            Run Report
          </button>
        </div>

        {/* Results */}
        <div className="td-results-header">
          <div className="td-results-info">
            <h2 className="td-results-title">Results ({reportData.length})</h2>
          </div>
          <div className="td-action-buttons">
            <button className="td-action-btn pdf" onClick={downloadPDF} title="Download PDF">
              <IonIcon icon={fileTrayFullOutline} />
              <span>PDF</span>
            </button>
            <button className="td-action-btn excel" onClick={downloadExcel} title="Download Excel">
              <IonIcon icon={downloadOutline} />
              <span>Excel</span>
            </button>
          </div>
        </div>

        {/* Modern Results Table */}
        <div className="td-table-wrapper">
          <table className="td-premium-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Client & Project</th>
                <th>Date</th>
                <th>Employee</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((r, i) => (
                <tr key={`${r.TicketID}-${i}`}>
                  <td>
                    <div className="td-id-chip" onClick={() => fetchTracking(r.TicketID)}>
                      #{r.TicketID}
                    </div>
                  </td>
                  <td>
                    <div className="td-client-name">{r.Client}</div>
                    <div className="td-project-name">{r.Project}</div>
                  </td>
                  <td>
                    <div className="td-date-text">{r.TDate}</div>
                  </td>
                  <td>
                    <div className="td-emp-name">{r.Employee}</div>
                  </td>
                  <td>
                    <span className={`td-status-pill td-status-${(r.STATUS || 'P').toLowerCase()}`}>
                      {r.STATUS || 'P'}
                    </span>
                  </td>
                  <td className="td-remarks-cell">
                    <div className="preview">{r.Remarks}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile List View */}
        <div className="td-mobile-list">
          {reportData.map((r, i) => (
            <div key={`${r.TicketID}-${i}`} className="td-ticket-card">
              <div className="td-card-header">
                <div
                  className="td-id-chip"
                  onClick={() => fetchTracking(r.TicketID)}
                >
                  #{r.TicketID}
                </div>
                <span className={`td-status-pill td-status-${(r.STATUS || 'P').toLowerCase()}`}>
                  {r.STATUS || 'P'}
                </span>
              </div>

              <div className="td-card-body">
                <div className="td-info-row" style={{ gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="td-info-item" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '12px' }}>
                    <span className="td-info-label">Client</span>
                    <span className="td-info-value" style={{ fontSize: '13px' }}>{r.Client}</span>
                  </div>
                  <div className="td-info-item" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '12px' }}>
                    <span className="td-info-label">Project</span>
                    <span className="td-info-value" style={{ fontSize: '13px' }}>{r.Project}</span>
                  </div>
                </div>

                <div className="td-remarks-section">
                  <div className="td-remarks-header">
                    <IonIcon icon={chatbubblesOutline} />
                    <span>Remarks</span>
                  </div>
                  <div className="td-remarks-text">{r.Remarks}</div>
                </div>
              </div>

              <div className="td-card-footer">
                <div className="td-footer-item">
                  <IonIcon icon={personOutline} />
                  <span>{r.Employee}</span>
                </div>
                <div className="td-footer-item">
                  <IonIcon icon={timeOutline} />
                  <span className="td-date-text">{r.TDate}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {reportData.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "60px 20px", opacity: 0.5 }}>
            <IonIcon icon={searchOutline} style={{ fontSize: "48px" }} />
            <p>No reports found. Adjust filters and try again.</p>
          </div>
        )}

        {/* Date Modals */}
        <IonModal isOpen={startOpen} onDidDismiss={() => setStartOpen(false)} className="date-modal">
          <div className="modal-content">
            <h3 style={{ margin: 0 }}>Select From Date</h3>
            <IonDatetime
              presentation="date"
              value={fromDate}
              onIonChange={(e) => {
                const v = e.detail.value as string | null;
                if (typeof v === "string") setFromDate(v.split('T')[0]);
                setStartOpen(false);
              }}
            />
            <IonButton expand="block" mode="ios" onClick={() => setStartOpen(false)}>Close</IonButton>
          </div>
        </IonModal>

        <IonModal isOpen={endOpen} onDidDismiss={() => setEndOpen(false)} className="date-modal">
          <div className="modal-content">
            <h3 style={{ margin: 0 }}>Select To Date</h3>
            <IonDatetime
              presentation="date"
              value={toDate}
              onIonChange={(e) => {
                const v = e.detail.value as string | null;
                if (typeof v === "string") setToDate(v.split('T')[0]);
                setEndOpen(false);
              }}
            />
            <IonButton expand="block" mode="ios" onClick={() => setEndOpen(false)}>Close</IonButton>
          </div>
        </IonModal>

        <IonToast
          isOpen={toast.open} message={toast.msg} color={toast.color}
          duration={2000} onDidDismiss={() => setToast({ ...toast, open: false })}
        />

        {/* Tracking History Modal */}
        <IonModal
          isOpen={trackingModalOpen}
          onDidDismiss={() => setTrackingModalOpen(false)}
          className="td-tracking-modal"
        >
          <div className="td-tracking-content">
            <div className="td-tracking-header">
              <div className="td-modal-handle"></div>
              <div className="td-header-main">
                <div className="td-header-info">
                  <h2>Tracking History</h2>
                  <p>Ticket #{selectedTicketId}</p>
                </div>
                <button className="td-close-modal" onClick={() => setTrackingModalOpen(false)}>
                  ×
                </button>
              </div>
            </div>

            <div className="td-tracking-body">
              {trackingLoading ? (
                <div className="td-modal-loader">
                  {/* IonLoading handled globally or shows here */}
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <IonLoading isOpen={true} message="Loading history..." />
                  </div>
                </div>
              ) : trackingData.length === 0 ? (
                <div className="td-no-history">
                  <IonIcon icon={timeOutline} />
                  <p>No tracking history available</p>
                </div>
              ) : (
                <div className="td-timeline">
                  {trackingData.map((item, idx) => (
                    <div key={item.AID} className="td-timeline-item">
                      <div className="td-timeline-node">
                        <div className={`td-node-dot td-status-${(item.T_Status || 'P').toLowerCase()}`}></div>
                        {idx < trackingData.length - 1 && <div className="td-node-line"></div>}
                      </div>
                      <div className="td-timeline-card">
                        <div className="td-timeline-header">
                          <span className={`td-status-pill td-status-${(item.T_Status || 'P').toLowerCase()}`}>
                            {item.T_Status === 'A' ? 'Assigned' :
                              item.T_Status === 'C' ? 'Closed' :
                                item.T_Status === 'O' ? 'Open' :
                                  item.T_Status === 'H' ? 'Hold' : 'Pending'}
                          </span>
                          <span className="td-timeline-time">
                            {moment(item.CREATEDATE).format("DD MMM, hh:mm A")}
                          </span>
                        </div>

                        <div className="td-timeline-info">
                          <div className="td-info-block">
                            <IonIcon icon={personOutline} />
                            <div className="td-info-details">
                              <span className="label">Action By</span>
                              <span className="value">{getEmpName(item.CREATEDBYID)}</span>
                            </div>
                          </div>

                          {item.EMPCODE && item.EMPCODE !== "0" && (
                            <div className="td-info-block">
                              <IonIcon icon={businessOutline} />
                              <div className="td-info-details">
                                <span className="label">Forwarded To</span>
                                <span className="value">{getEmpName(item.EMPCODE)}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {item.TaskRemark && (
                          <div className="td-timeline-remark">
                            <p>{item.TaskRemark}</p>
                          </div>
                        )}

                        {item.TotHrs_hhmmss && (
                          <div className="td-timeline-footer">
                            <IonIcon icon={timeOutline} />
                            <span>Duration: {item.TotHrs_hhmmss}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}