

import React, { useEffect, useState } from "react";
import {
  IonContent,
  IonHeader,
  IonLoading,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButton,
  IonItem,
  IonLabel,
  IonInput,
} from "@ionic/react";
import "./VisitTickets.css";
import moment from "moment";
import { API_BASE } from "../../../config";

interface Ticket {
  ticketId: string;
  projectClient: string;
  mobileNo: string;
  date: string;
  remarks: string;
}


interface VisitTicket {
  duty_Date: string;
  client_Name: string;
  location: string;
  visit_FromTime: string;
  visit_ToTime: string;
  projects: string;
  contact_Person: string;
  mobile_Number: string;
  remarks: string;
  employees: string;
}

const VisitTickets: React.FC = () => {
  const [tickets, setTickets] = useState<VisitTicket[]>([]);
  const [loading, setLoading] = useState(false);
const today = moment().format("YYYY-MM-DD");

const [fromDate, setFromDate] = useState("");
const [toDate, setToDate] = useState("");
  const [activeTab, setActiveTab] = useState<"tickets" | "visits">("tickets");
  const [ticketList, setTicketList] = useState<Ticket[]>([]);
  const getHeaders = (isGet = false) => {
  const token = localStorage.getItem("token")?.replace(/"/g, "");
  const applyFilter = () => {
 const from = fromDate || today;
const to = toDate || today;

loadClosedTickets(formatDate(from), formatDate(to));

  if (activeTab === "tickets") {
    loadClosedTickets(from, to);
  } else {
    loadTickets(from, to);
  }
};
  const headers: any = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  if (!isGet) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
};

const handleResponse = async (res: Response) => {
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(errorText || `API Error: ${res.status}`);
  }

  const text = await res.text().catch(() => "");

  if (!text) return [];

  try {
    const json = JSON.parse(text);

    if (typeof json === "string") {
      return JSON.parse(json);
    }

    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
};

const mapTicketRow = (r: any): Ticket => {
  const ticketId = String(
    r?.TicketID ?? r?.TICKETID ?? r?.ticketId ?? r?.[1] ?? ""
  );

  const client = String(
    r?.Client ?? r?.CLIENT ?? r?.Client_Name ?? r?.[2] ?? r?.[28] ?? ""
  );

  const project = String(
    r?.Project ?? r?.PROJECT ?? r?.[3] ?? ""
  );

  const projectClient = [client, project].filter(Boolean).join(" - ");

  const mobileNo = String(
    r?.Client_MobileNo ?? r?.ClientMobileNo ?? r?.[6] ?? ""
  );

  const date = String(
    r?.TDate ?? r?.TDATE ?? r?.CreatedDate ?? r?.[8] ?? r?.[7] ?? ""
  );

  const remarks = String(
    r?.Remarks ??
      r?.REMARKS ??
      r?.TaskRemark ??
      r?.[29] ??
      r?.[9] ??
      ""
  );

  return {
    ticketId,
    projectClient,
    mobileNo,
    date,
    remarks,
  };
};
const loadClosedTickets = async (from?: string, to?: string) => {
  try {
    setLoading(true);

    const fromValue = from || today;
    const toValue = to || today;

    const params = new URLSearchParams({
      ClientID: "0",
      ProjectID: "0",
      Date: moment(fromValue).format("YYYY-MM-DD"),
      ToDate: moment(toValue).format("YYYY-MM-DD"),
      status: "C",
      EMPCODE: "0",
    });

    const res = await fetch(
      `${API_BASE}Tickets/Load_LOADSUPPORTTICKETS_DateWise_FromTo?${params.toString()}`,
      { headers: getHeaders(true) }
    );

    const raw = await handleResponse(res);
    setTicketList(raw.map(mapTicketRow));

  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  if (activeTab === "tickets") {
    loadClosedTickets(today, today);
  } else {
    loadTickets();
  }
}, [activeTab]);

const loadTickets = async (from?: string, to?: string) => {
  try {
    setLoading(true);

    const params = new URLSearchParams();

    if (from) params.append("fromDate", moment(from).format("YYYY-MM-DD"));
    if (to) params.append("toDate", moment(to).format("YYYY-MM-DD"));

    const url =
      `${API_BASE}Tickets/load_OnDuty_visits` +
      (params.toString() ? `?${params.toString()}` : "");

    const response = await fetch(url, {
      headers: getHeaders(true),
    });

    const data = await response.json();
    setTickets(data);

  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
};
const formatDate = (d: string) => {
  if (!d) return "";
  return moment(d).format("YYYY-MM-DD");
};

const formatTime = (time: string) => {
  if (!time) return "-";
  return time.substring(0, 5);
};

  return (
   <IonContent className="visit-page">
  <div className="visit-container">

    {/* Header */}
    <div className="visit-top-header">
      <h2 className="visit-title">Visits Management</h2>
      <p className="visit-subtitle">
        Closed Tickets & Visit History
      </p>
    </div>

    {/* Sticky Section */}
    <div className="visit-sticky-bar">

      {/* Tabs */}
      <div className="visit-tabs">
        <button
          type="button"
          className={activeTab === "tickets" ? "visit-tab active" : "visit-tab"}
          onClick={() => setActiveTab("tickets")}
        >
          Tickets
        </button>

        <button
          type="button"
          className={activeTab === "visits" ? "visit-tab active" : "visit-tab"}
          onClick={() => setActiveTab("visits")}
        >
          Visits
        </button>
      </div>

      {/* Filters */}
      <div className="visit-panel">
        <div className="date-filter-container">

          <IonItem className="date-filter-item">
            <IonLabel position="stacked">From Date</IonLabel>
            <IonInput
              type="date"
              value={fromDate}
              onIonChange={(e) => setFromDate(e.detail.value || "")}
            />
          </IonItem>

          <IonItem className="date-filter-item">
            <IonLabel position="stacked">To Date</IonLabel>
            <IonInput
              type="date"
              value={toDate}
              onIonChange={(e) => setToDate(e.detail.value || "")}
            />
          </IonItem>

          <div className="filter-button-group">
        <IonButton
  color="primary"
  expand="block"
 onClick={() => {
  const from = fromDate || today;
  const to = toDate || today;

  if (activeTab === "tickets") {
    loadClosedTickets(from, to);
  } else {
    loadTickets(from, to);
  }
}}
>
  Apply Filter
</IonButton>

            <IonButton
  color="medium"
  expand="block"
 onClick={() => {
  setFromDate("");
  setToDate("");

  if (activeTab === "tickets") {
    loadClosedTickets();
  } else {
    loadTickets();
  }
}}
>
  Reset
</IonButton>
          </div>

        </div>
      </div>

    </div>

    {/* Table Panel */}
    <div className="visit-panel">

      <div className="visit-table-wrapper">

        {activeTab === "tickets" ? (

          <table className="visit-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Project & Client</th>
                <th>Mobile</th>
                <th>Date</th>
                <th>Remarks</th>
              </tr>
            </thead>

            <tbody>
              {ticketList.length > 0 ? (
                ticketList.map((item, index) => (
                  <tr key={index}>
                    <td>{item.ticketId}</td>
                    <td>{item.projectClient || "-"}</td>
                    <td>{item.mobileNo || "-"}</td>
                    <td>{item.date || "-"}</td>
                    <td>{item.remarks || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 20 }}>
                    No ticket records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

        ) : (

          <table className="visit-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Date</th>
                <th>Client</th>
                <th>Location</th>
                <th>From</th>
                <th>To</th>
                <th>Project</th>
                <th>Contact Person</th>
                <th>Mobile</th>
                <th>Remarks</th>
                <th>Employees</th>
              </tr>
            </thead>

            <tbody>
              {tickets.length > 0 ? (
                tickets.map((item, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>

                    <td>{formatDate(item.duty_Date)}</td>

                    <td>{item.client_Name}</td>

                    <td>{item.location || "-"}</td>

                    <td>{formatTime(item.visit_FromTime)}</td>

                    <td>{formatTime(item.visit_ToTime)}</td>

                    <td>
                      <span className="project-chip">
                        {item.projects}
                      </span>
                    </td>

                    <td>{item.contact_Person || "-"}</td>

                    <td>{item.mobile_Number || "-"}</td>

                    <td>{item.remarks || "-"}</td>

                    <td className="employee-column">
                      {item.employees
                        ? item.employees.split(",").map((emp, i) => (
                            <div key={i} className="employee-chip">
                              {emp.trim()}
                            </div>
                          ))
                        : "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center", padding: 20 }}>
                    No visit records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

        )}

      </div>

    </div>

  </div>

  <IonLoading isOpen={loading} message="Loading..." />
</IonContent>
  );
};

export default VisitTickets;