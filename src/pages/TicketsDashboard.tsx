import React, { useEffect, useState } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonContent, IonButton, IonIcon, IonToast, IonLoading, IonTitle
} from "@ionic/react";
import {
  chevronUpOutline, chevronDownOutline, arrowBackOutline,
  personOutline, timeOutline, businessOutline, alertCircleOutline
} from "ionicons/icons";
import axios from "axios";
import { API_BASE } from "../config";
import "./Tickets/Tickets.css";

const baseUrl = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;

type EmpRow = {
  empcode: string;
  Empname: string;
  H?: number;
  O?: number;
  A?: number;
  C?: number;
};

type TicketRow = {
  T_STATUS: string;
  TICKETID: string | number;
  CLIENT: string;
  TICKETPRIORITY: string;
  TDATE: string;
  MENU: string;
  REMARKS: string;
  PROJECT: string;
  ESTIMATEDTIME: string | number | null;
};

const getAuthHeaders = () => {
  const token = localStorage.getItem("token")?.replace(/"/g, "");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const TicketsDashboard: React.FC = () => {
  const [tableOpen, setTableOpen] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState<EmpRow | null>(null);
  const [counts, setCounts] = useState<EmpRow[]>([]);
  const [countsLoading, setCountsLoading] = useState(false);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [toast, setToast] = useState({ open: false, msg: "", color: "danger" });

  const loadCounts = async () => {
    setCountsLoading(true);
    try {
      const res = await axios.get(`${baseUrl}/Tickets/Load_Tickets_Count`, { headers: getAuthHeaders() });
      setCounts(Array.isArray(res.data) ? res.data : []);
    } catch {
      setToast({ open: true, msg: "Failed to load counts", color: "danger" });
    } finally { setCountsLoading(false); }
  };

  const loadTickets = async (empcode: string, status: string) => {
    setTicketsLoading(true);
    try {
      const res = await axios.get(`${baseUrl}/Tickets/Load_DashBoard_Tickets?empcode=${empcode}&&Status=${status}`, { headers: getAuthHeaders() });
      setTickets(Array.isArray(res.data) ? res.data : []);
      setTableOpen(false);
    } catch {
      setToast({ open: true, msg: "Failed to load tickets", color: "danger" });
    } finally { setTicketsLoading(false); }
  };

  useEffect(() => { loadCounts(); }, []);

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="premium-toolbar">
          <IonTitle>Tickets Dashboard</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding tickets-container">
        <IonLoading isOpen={countsLoading || ticketsLoading} message="Processing..." />

        {/* Dashboard Counts */}
        <div className="section-title-wrap fade-in">
          <h2 className="premium-header-text">Live Tickets Dashboard</h2>
        </div>

        {tableOpen && !selectedEmp && (
          <div className="premium-table-wrapper premium-card fade-in">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>EMP</th>
                  <th>HOLD</th>
                  <th>OPEN</th>
                  <th>PENDING</th>
                  <th>CLOSE</th>
                </tr>
              </thead>
              <tbody>
                {counts.map((r) => (
                  <tr key={r.empcode}>
                    <td>
                      <button className="link-btn" onClick={() => { setSelectedEmp(r); loadTickets(r.empcode, "All"); }}>
                        {r.Empname}
                      </button>
                    </td>
                    <td className="center">
                      <button className="status-badge status-hold" onClick={() => { setSelectedEmp(r); loadTickets(r.empcode, "H"); }}>
                        {r.H ?? 0}
                      </button>
                    </td>
                    <td className="center">
                      <button className="status-badge status-open" onClick={() => { setSelectedEmp(r); loadTickets(r.empcode, "O"); }}>
                        {r.O ?? 0}
                      </button>
                    </td>
                    <td className="center">
                      <button className="status-badge status-pending" onClick={() => { setSelectedEmp(r); loadTickets(r.empcode, "A"); }}>
                        {r.A ?? 0}
                      </button>
                    </td>
                    <td className="center">{r.C ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Ticket Details */}
        {selectedEmp && (
          <div className="fade-in">
            <div className="section-title-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="premium-header-text">Tickets: {selectedEmp.Empname}</h2>
              <IonButton fill="clear" onClick={() => { setSelectedEmp(null); setTableOpen(true); }}>
                <IonIcon icon={arrowBackOutline} slot="start" />
                Back
              </IonButton>
            </div>

            <div className="mobile-ticket-list">
              {tickets.map((x, idx) => (
                <div key={`${x.TICKETID}-${idx}`} className="premium-card fade-in">
                  <div className="ticket-item">
                    <div className="ticket-header">
                      <span className="ticket-id">#{x.TICKETID}</span>
                      <span className={`status-badge status-${(x.T_STATUS || 'P').toLowerCase()}`}>
                        {x.T_STATUS === 'O' ? 'Open' : x.T_STATUS === 'H' ? 'Hold' : x.T_STATUS === 'A' ? 'Pending' : 'Closed'}
                      </span>
                    </div>
                    <div className="ticket-body">
                      <p><strong>Client:</strong> {x.CLIENT}</p>
                      <p><strong>Project:</strong> {x.PROJECT}</p>
                      <p style={{ fontSize: "0.9rem", opacity: 0.9 }}>{x.REMARKS}</p>
                    </div>
                    <div className="ticket-meta">
                      <span className="meta-item"><IonIcon icon={timeOutline} /> {x.TDATE}</span>
                      <span className="meta-item"><IonIcon icon={alertCircleOutline} /> {x.TICKETPRIORITY}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <IonToast
          isOpen={toast.open} message={toast.msg} color={toast.color as any}
          duration={2200} onDidDismiss={() => setToast({ ...toast, open: false })}
        />
      </IonContent>
    </IonPage>
  );
};

export default TicketsDashboard;
