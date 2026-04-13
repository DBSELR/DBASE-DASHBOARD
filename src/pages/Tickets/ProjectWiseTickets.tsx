import React, { useEffect, useState } from "react";
import {
  IonButton, IonIcon, IonLoading, IonToast, IonSelect, IonSelectOption, IonModal, IonDatetime, IonPage, IonContent
} from "@ionic/react";
import { useHistory } from "react-router";
import { arrowBackOutline, calendarOutline, timeOutline, businessOutline, listOutline } from "ionicons/icons";
import moment from "moment";
import "./ProjectWiseTickets.css";

import { API_BASE } from "../../config";

const STATUS_MAP: Record<string, string> = {
  "ALL": "All Status",
  "P": "Pending",
  "A": "Assigned",
  "O": "Open",
  "C": "Closed",
  "H": "Hold",
  "R": "Re-Opened",
  "CH": "Change Request",
  "D": "Duplicate",
  "I": "Irrelevant",
  "U": "Unidentified"
};

export default function ProjectWiseTickets() {
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ open: false, msg: "", color: "success" });

  const [date, setDate] = useState(moment().format("YYYY-MM-DD"));
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedPid, setSelectedPid] = useState("0");
  const [status, setStatus] = useState("ALL");
  const [tickets, setTickets] = useState<any[]>([]);

  /* Date Modal State */
  const [dateOpen, setDateOpen] = useState(false);

  const getHeaders = (isGet = false) => {
    const token = localStorage.getItem("token")?.replace(/"/g, "");
    const headers: any = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    if (!isGet) headers["Content-Type"] = "application/json";
    return headers;
  };

  useEffect(() => {
    void loadProjects();
  }, [date]);

  useEffect(() => {
    void loadTickets();
  }, [date, selectedPid, status]);

  async function loadProjects() {
    try {
      const d = moment(date).format("YYYY-MM-DD");
      const res = await fetch(`${API_BASE}Tickets/LoadDaywiseProjectList?Date=${d}`, { headers: getHeaders(true) });
      const data = await res.json();
      setProjects((data || []).map((p: any) => ({ P_ID: String(p[0]), project: p[1] })));
    } catch { setProjects([]); }
  }

  async function loadTickets() {
    setLoading(true);
    try {
      const d = moment(date).format("YYYY-MM-DD");
      const pid = selectedPid === "ALL" ? "0" : selectedPid;
      const q = new URLSearchParams({ Date: d, status, ProjectID: pid });
      const res = await fetch(`${API_BASE}Tickets/Load_ProjectWiseTicketsData?${q.toString()}`, { headers: getHeaders(true) });
      const data = await res.json();
      console.log("[ProjectWiseTickets] loadData RAW count:", data?.length);
      if (data && data.length > 0) console.log("[ProjectWiseTickets] Raw Data Sample:", data[0]);

      const mapped = (data || []).map((r: any) => ({
        TicketID: String(r[1] || r[0]),
        Client: r[2],
        Project: r[3],
        TDate: r[4],
        Remarks: r[5],
        STATUS: r[7],
        STATUS_CODE: r[6],
        AssignedTo: [r[11], r[12]].filter(Boolean).join(", ")
      }));
      setTickets(mapped);
    } catch (err) {
      console.error("[ProjectWiseTickets] loadData ERROR:", err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <IonPage className="pwt-page">
      <IonContent className="pwt-content-scroller">
        <div className="pwt-root">
          <IonLoading isOpen={loading} message="Loading tickets..." />

          <div className="pwt-header">
            <button className="pwt-back-btn" onClick={() => history.goBack()}>
              <IonIcon icon={arrowBackOutline} />
            </button>
            <h1 className="pwt-title">Project Wise Tickets</h1>
          </div>

          <div className="pwt-filter-card pwt-fade-in">
            <div className="pwt-filter-grid">
              <div className="pwt-form-group">
                <label className="pwt-label">Select Date</label>
                <div className="pwt-input-box" onClick={() => setDateOpen(true)}>
                  <span>{moment(date).format("DD MMM YYYY")}</span>
                  <IonIcon icon={calendarOutline} color="primary" />
                </div>
              </div>

              <div className="pwt-form-group">
                <label className="pwt-label">Project</label>
                <div className="pwt-input-box" style={{ padding: 0 }}>
                  <IonSelect
                    value={selectedPid}
                    onIonChange={e => setSelectedPid(e.detail.value)}
                    interface="popover"
                    style={{ width: "100%", "--padding-start": "14px" }}
                  >
                    <IonSelectOption value="0">All Projects</IonSelectOption>
                    {projects.map(p => <IonSelectOption key={p.P_ID} value={p.P_ID}>{p.project}</IonSelectOption>)}
                  </IonSelect>
                </div>
              </div>

              <div className="pwt-form-group">
                <label className="pwt-label">Status</label>
                <div className="pwt-input-box" style={{ padding: 0 }}>
                  <IonSelect
                    value={status}
                    onIonChange={e => setStatus(e.detail.value)}
                    interface="popover"
                    style={{ width: "100%", "--padding-start": "14px" }}
                  >
                    {Object.entries(STATUS_MAP).map(([code, label]) => (
                      <IonSelectOption key={code} value={code}>{label}</IonSelectOption>
                    ))}
                  </IonSelect>
                </div>
              </div>
            </div>
          </div>

          <div className="pwt-results-header pwt-fade-in">
            <h2 className="pwt-results-title">Tickets Data ({tickets.length})</h2>
          </div>

          {/* Web Table View */}
          <div className="pwt-table-wrapper pwt-fade-in">
            <table className="pwt-premium-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Client</th>
                  <th>Project</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t, i) => (
                  <tr key={`${t.TicketID}-${i}`}>
                    <td className="pwt-tid">#{t.TicketID}</td>
                    <td>{t.Client}</td>
                    <td>{t.Project}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{t.TDate}</td>
                    <td>
                      <span className={`pwt-badge pwt-badge-${(t.STATUS_CODE || 'P').toLowerCase()}`}>
                        {t.STATUS}
                      </span>
                    </td>
                    <td style={{ fontSize: "12px" }}>{t.AssignedTo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Card List */}
          <div className="pwt-mobile-list pwt-fade-in">
            {tickets.map((t, i) => (
              <div key={`${t.TicketID}-${i}`} className="pwt-ticket-card">
                <div className="pwt-card-row">
                  <span className="pwt-tid">#{t.TicketID}</span>
                  <span className={`pwt-badge pwt-badge-${(t.STATUS_CODE || 'P').toLowerCase()}`}>{t.STATUS}</span>
                </div>
                <div className="pwt-client">{t.Client}</div>
                <div className="pwt-project">{t.Project}</div>
                <div className="pwt-card-footer">
                  <div className="pwt-footer-item">
                    <IonIcon icon={timeOutline} />
                    {t.TDate}
                  </div>
                  <div className="pwt-footer-item">
                    <IonIcon icon={businessOutline} />
                    {t.AssignedTo}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {tickets.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: "60px 20px", opacity: 0.5 }}>
              <IonIcon icon={listOutline} style={{ fontSize: "48px" }} />
              <p>No tickets found for the selected criteria.</p>
            </div>
          )}

          {/* Date Modal Pattern */}
          <IonModal isOpen={dateOpen} onDidDismiss={() => setDateOpen(false)} className="pwt-date-modal">
            <div className="pwt-modal-content">
              <h3 className="pwt-modal-title">Select Date</h3>
              <IonDatetime
                presentation="date"
                value={date}
                onIonChange={(e) => {
                  const v = e.detail.value as string | null;
                  if (typeof v === "string") setDate(v.split('T')[0]);
                  setDateOpen(false);
                }}
              />
              <IonButton expand="block" mode="ios" onClick={() => setDateOpen(false)}>Close</IonButton>
            </div>
          </IonModal>

          <IonToast
            isOpen={toast.open} message={toast.msg} color={toast.color}
            duration={2000} onDidDismiss={() => setToast({ ...toast, open: false })}
          />
        </div>
      </IonContent>
    </IonPage>
  );
}
