import React, { useEffect, useMemo, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonContent,
  IonButton,
  IonIcon,
  IonToast,
  IonLoading,
} from "@ionic/react";
import {
  chevronUpOutline,
  chevronDownOutline,
  arrowBackOutline,
} from "ionicons/icons";
import axios from "axios";


/* ---------------- baseUrl (same style as AdminRequests) ---------------- */
const baseUrl = "/api";

/* ---------------- Types (align with your Angular API) ---------------- */
type EmpRow = {
  empcode: string;
  Empname: string;
  H?: number;
  O?: number;
  A?: number;
  C?: number;
};

type TicketRow = {
  T_STATUS: "H" | "O" | "A" | "C" | string;
  TICKETID: string | number;
  CLIENT: string;
  TICKETPRIORITY: string;
  TDATE: string;
  MENU: string; // client details / menu text
  REMARKS: string;
  PROJECT: string;
  ESTIMATEDTIME: string | number | null;
  IMG_PATH?: string | null;
  FILE_PATH?: string | null;
};

/* ---------------- Helpers ---------------- */
const statusText = (s: string) =>
  s === "O" ? "Open" : s === "H" ? "Hold" : s === "A" ? "Assigned" : "Closed";

const statusColor = (s: string) =>
  s === "H"
    ? "var(--ion-color-danger)"
    : s === "O"
    ? "var(--ion-color-success)"
    : s === "A"
    ? "var(--ion-color-medium)"
    : "var(--ion-color-dark)";

const getAuthHeaders = () => {
  // Same pattern you used in AdminRequests.tsx
  const token = localStorage.getItem("token")?.replace(/"/g, "");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const TicketsDashboard: React.FC = () => {
  /* ---------------- UI state ---------------- */
  const [tableOpen, setTableOpen] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState<EmpRow | null>(null);

  /* ---------------- Data state ---------------- */
  const [counts, setCounts] = useState<EmpRow[]>([]);
  const [countsLoading, setCountsLoading] = useState(false);

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  /* ---------------- Toasts ---------------- */
  const [toast, setToast] = useState<{ open: boolean; msg: string; color?: "danger" | "success" | "warning" | "medium" }>({
    open: false,
    msg: "",
    color: "danger",
  });

  /* ---------------- API calls ---------------- */
  const loadCounts = async () => {
    setCountsLoading(true);
    try {
      const url = `${baseUrl}/Tickets/Load_Tickets_Count`;
      console.log("[tickets][counts][GET]", url);

      const res = await axios.get<EmpRow[]>(url, {
        headers: {
          Accept: "application/json",
          ...getAuthHeaders(),
        },
      });

      console.log("[tickets][counts][response]", res.data);
      setCounts(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error("[tickets][counts][error]", err);
      setToast({
        open: true,
        msg: "Failed to load ticket counts.",
        color: "danger",
      });
    } finally {
      setCountsLoading(false);
    }
  };

  const loadTickets = async (empcode: string, status: "All" | "H" | "O" | "A") => {
    setTicketsLoading(true);
    try {
      const url = `${baseUrl}/Tickets/Load_DashBoard_Tickets?empcode=${encodeURIComponent(
        empcode.trim()
      )}&&Status=${encodeURIComponent(status)}`;

      console.log("[tickets][data][GET]", url);
      const res = await axios.get<TicketRow[]>(url, {
        headers: {
          Accept: "application/json",
          ...getAuthHeaders(),
        },
      });

      console.log("[tickets][data][response]", res.data);
      setTickets(Array.isArray(res.data) ? res.data : []);
      setTableOpen(false); // hide counts table when detail opens
    } catch (err: any) {
      console.error("[tickets][data][error]", err);
      setTickets([]);
      setToast({
        open: true,
        msg: "Failed to load tickets.",
        color: "danger",
      });
    } finally {
      setTicketsLoading(false);
    }
  };

  /* ---------------- ionViewWillEnter equivalent ---------------- */
  useEffect(() => {
    loadCounts();
  }, []);

  /* ---------------- Derived ---------------- */
  const detailChevronOpen = useMemo(() => !!selectedEmp, [selectedEmp]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="menu-toolbar">
          <img
            src="./images/dbase.png"
            alt="DBase Logo"
            className="menu-logo"
          />
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* ---------- LIVE TICKETS DASHBOARD (TABLE) ---------- */}
        <div className="tdb-panel">
          <div
            className="tdb-panel__head"
            onClick={() => setTableOpen((v) => !v)}
            role="button"
            aria-label="Toggle Live Tickets Dashboard"
          >
            <h2 className="tdb-panel__title">Live Tickets DashBoard</h2>
            <IonIcon
              icon={tableOpen ? chevronUpOutline : chevronDownOutline}
              className="tdb-panel__chev"
            />
          </div>

          {tableOpen && !selectedEmp && (
            <div className="tdb-card">
              <div className="tdb-tableWrap">
                <table className="tdb-table">
                  <thead>
                    <tr>
                      <th style={{ width: 120 }}>EMP CODE</th>
                      <th>EMP NAME</th>
                      <th style={{ width: 110 }} className="center">
                        HOLD
                      </th>
                      <th style={{ width: 110 }} className="center">
                        OPEN
                      </th>
                      <th style={{ width: 140 }} className="center">
                        Yet to Start
                      </th>
                      <th style={{ width: 110 }} className="center">
                        CLOSE
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {counts.map((r) => (
                      <tr key={r.empcode}>
                        <td className="mono">{r.empcode}</td>
                        <td>
                          <button
                            className="empLink"
                            onClick={() => {
                              setSelectedEmp(r);
                              loadTickets(r.empcode, "All");
                            }}
                            title="Load all tickets"
                          >
                            {r.Empname}
                          </button>
                        </td>
                        <td className="center">
                          {typeof r.H === "number" && (
                            <button
                              className="countBtn"
                              onClick={() => {
                                setSelectedEmp(r);
                                loadTickets(r.empcode, "H");
                              }}
                              title="Load Hold"
                            >
                              {r.H}
                            </button>
                          )}
                        </td>
                        <td className="center">
                          {typeof r.O === "number" && (
                            <button
                              className="countBtn"
                              onClick={() => {
                                setSelectedEmp(r);
                                loadTickets(r.empcode, "O");
                              }}
                              title="Load Open"
                            >
                              {r.O}
                            </button>
                          )}
                        </td>
                        <td className="center">
                          {typeof r.A === "number" && (
                            <button
                              className="countBtn"
                              onClick={() => {
                                setSelectedEmp(r);
                                loadTickets(r.empcode, "A");
                              }}
                              title="Load Yet to Start"
                            >
                              {r.A}
                            </button>
                          )}
                        </td>
                        <td className="center">{r.C ?? ""}</td>
                      </tr>
                    ))}
                    {counts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="center muted">
                          No data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ---------- LIVE TICKETS DATA (DETAIL) ---------- */}
        <div className="tdb-panel tdb-panel--detail">
          <div className="tdb-panel__head" aria-label="Live Tickets Data">
            <h2 className="tdb-panel__title">Live Tickets Data</h2>
            <IonIcon
              icon={detailChevronOpen ? chevronUpOutline : chevronDownOutline}
              className="tdb-panel__chev"
            />
          </div>

          {/* Slide-up detail box (visible when employee selected) */}
          <div className={`tdb-ticketWrap ${selectedEmp ? "show" : ""}`}>
            <div className="tdb-ticketCard">
              <div className="tdb-ticketGrid">
                {tickets.map((x, idx) => (
                  <div className="row-class" key={`${x.TICKETID}-${idx}`}>
                    {/* left block */}
                    <div className="tdb-box tdb-box--left col-class">
                      <div
                        className="tdb-line"
                        title={statusText(x.T_STATUS)}
                        style={{ color: statusColor(x.T_STATUS) }}
                      >
                        <span className="lbl">Ticket ID : </span>
                        <span className="val">{x.TICKETID}</span>
                      </div>
                      <div className="tdb-line">
                        <span className="lbl">Client : </span>
                        <span className="val">{x.CLIENT}</span>
                      </div>
                      <div className="tdb-line">
                        <span className="lbl">Priority : </span>
                        <span className="val">{x.TICKETPRIORITY}</span>
                      </div>
                    </div>

                    {/* mid block */}
                    <div className="tdb-box tdb-box--mid col-class">
                      <div className="tdb-line">
                        <span className="lbl">Date : </span>
                        <span className="val">{x.TDATE}</span>
                      </div>
                      <div className="tdb-line">
                        <span className="lbl">Client Details : </span>
                        <span className="val">{x.MENU}</span>
                      </div>
                    </div>

                    {/* remarks */}
                    <div className="tdb-box tdb-box--remarks col-class">
                      <div className="tdb-line">
                        <span className="lbl">Remarks : </span>
                        <span className="val">{x.REMARKS}</span>
                      </div>
                    </div>

                    {/* footer */}
                    <div className="tdb-box tdb-box--footer">
                      <div className="tdb-line">
                        <span className="lbl">Project : </span>
                        <span className="val">{x.PROJECT}</span>
                        <span className="lbl end">End Time : </span>
                        <span className="val">{x.ESTIMATEDTIME ?? "-"}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {selectedEmp && !ticketsLoading && tickets.length === 0 && (
                  <div className="tdb-empty">No tickets for this filter.</div>
                )}
              </div>

              {selectedEmp && (
                <div className="tdb-ticketActions">
                  <IonButton
                    fill="outline"
                    color="medium"
                    onClick={() => {
                      setSelectedEmp(null);
                      setTableOpen(true);
                    }}
                  >
                    <IonIcon icon={arrowBackOutline} slot="start" />
                    Back to list
                  </IonButton>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loaders & Toast */}
        <IonLoading isOpen={countsLoading} message="Loading counts..." />
        <IonLoading isOpen={ticketsLoading} message="Loading tickets..." />
        <IonToast
          isOpen={toast.open}
          message={toast.msg}
          color={toast.color}
          duration={2200}
          onDidDismiss={() => setToast({ open: false, msg: "", color: "danger" })}
        />
      </IonContent>
    </IonPage>
  );
};

export default TicketsDashboard;
