import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import moment from "moment";
import { API_BASE } from "../config";
import { IonIcon, IonSelect, IonSelectOption } from "@ionic/react";
import { calendarOutline, layersOutline, businessOutline, documentTextOutline } from "ionicons/icons";
import "./MeetingList.css";
import "./MeetingDashboard.css";

const generateMonthList = () => {
  const months: string[] = [];
  const startYear = 2014;
  const current = moment().add(1, 'month');
  const currentYear = current.year();

  for (let y = currentYear; y >= startYear; y--) {
    const endMonth = y === currentYear ? current.month() : 11;
    for (let m = endMonth; m >= 0; m--) {
      months.push(moment().year(y).month(m).format("MMM-YYYY"));
    }
  }
  return months;
};

interface Meeting {
  id: number;
  financialYear?: string;
  monthName?: string;
  meetingStatus?: string;
  projectName?: string;
  meetingType?: string;
  meetingOwner?: string;
  attachment?: string;
  frequencyType?: string;
  participants?: string;
}

const getFileUrl = (path?: string) => {
  if (!path) return "#";
  const root = API_BASE ? API_BASE.replace(/\/api\/?$/i, "") : "";
  return `${root}${path}`;
};

function MeetingDashboard() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [monthsList, setMonthsList] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return moment().format("MMM-YYYY");
  });
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedCard, setSelectedCard] = useState<string>("Total");

  const projects = ["Beat", "Boat", "Unicode", "React"];

  useEffect(() => {
    const list = generateMonthList();
    setMonthsList(list);
    if (!selectedMonth) {
      setSelectedMonth(list[0]);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const base = API_BASE ? API_BASE.replace(/\/$/, "") : "";
      const response = await axios.get(`${base}/Meeting/GetMeetings`);
      setMeetings(response?.data ?? []);
    } catch (err: any) {
      console.error("Error loading meeting dashboard:", err);
      setError((err && err.message) || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  // Compute aggregated data dynamically based on filters
  const dashboard = useMemo(() => {
    let filtered = meetings;

    if (selectedMonth) {
      const [filterMonth, filterYear] = selectedMonth.split("-");
      const fullFilterMonth = moment(filterMonth, "MMM").format("MMMM").toLowerCase();

      filtered = filtered.filter(
        (m) =>
          m.monthName?.toLowerCase() === fullFilterMonth &&
          m.financialYear === filterYear
      );
    }

    if (selectedProject) {
      filtered = filtered.filter((m) => m.projectName === selectedProject);
    }

    const data = {
      filteredMeetings: filtered,
      totalMeetings: filtered.length,
      completedMeetings: filtered.filter((m) => m.meetingStatus === "Completed").length,
      pendingMeetings: filtered.filter((m) => m.meetingStatus === "Pending").length,
      escalatedMeetings: filtered.filter((m) => m.meetingStatus === "Escalated").length,
    };
    return data;
  }, [meetings, selectedMonth, selectedProject]);

  const displayedMeetings = useMemo(() => {
    if (!dashboard) return [];
    if (selectedCard === "Total") return dashboard.filteredMeetings;
    if (selectedCard === "Completed") return dashboard.filteredMeetings.filter(m => m.meetingStatus === "Completed");
    if (selectedCard === "Pending") return dashboard.filteredMeetings.filter(m => m.meetingStatus === "Pending");
    if (selectedCard === "Escalated") return dashboard.filteredMeetings.filter(m => m.meetingStatus === "Escalated");
    return [];
  }, [dashboard, selectedCard]);

  return (
    <div className="meeting-dashboard-page" style={{ padding: 20, background: "var(--ion-color-light, #f1f5f9)", minHeight: "100vh", height: "100%", overflowY: "auto" }}>
      <h1 style={{ color: "var(--ion-color-primary, #0f172a)", marginBottom: 20 }}>Meeting Dashboard</h1>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {/* Period Widget */}
        <div className="custom-dropdown-container">
          <div className="premium-filter-trigger">
            <div className="trigger-content">
              <div className="trigger-icon-box">
                <IonIcon icon={calendarOutline} />
              </div>
              <div className="trigger-text-sec">
                <span className="trigger-sub">PERIOD</span>
                <span className="trigger-main">{selectedMonth}</span>
              </div>
            </div>
            <IonIcon icon={layersOutline} className="trigger-icon-arrow" />
            <IonSelect
              className="hidden-select-overlay"
              interface="popover"
              toggleIcon="none"
              value={selectedMonth}
              onIonChange={(e) => {
                if (e.detail.value) setSelectedMonth(e.detail.value);
              }}
            >
              {monthsList.map((month) => (
                <IonSelectOption key={month} value={month}>
                  {month}
                </IonSelectOption>
              ))}
            </IonSelect>
          </div>
        </div>

        {/* Project Widget */}
        <div className="custom-dropdown-container" style={{ minWidth: '220px' }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>Project</div>
          <div className="premium-filter-trigger" style={{ background: '#fff', border: '1px solid #c7d2e0', height: '48px', padding: '10px 16px', borderRadius: '12px', boxShadow: 'none' }}>
            <div className="trigger-content">
              <div className="trigger-text-sec">
                <span className="trigger-main" style={{ color: selectedProject ? '#f97316' : '#64748b', fontSize: '14px', fontWeight: '600' }}>
                  {selectedProject || "Select Project"}
                </span>
              </div>
            </div>
            <IonIcon icon={layersOutline} className="trigger-icon-arrow" />
            <IonSelect
              className="hidden-select-overlay"
              interface="popover"
              toggleIcon="none"
              value={selectedProject}
              onIonChange={(e) => setSelectedProject(e.detail.value)}
            >
              <IonSelectOption value="">All Projects</IonSelectOption>
              {projects.map((proj) => (
                <IonSelectOption key={proj} value={proj}>
                  {proj}
                </IonSelectOption>
              ))}
            </IonSelect>
          </div>
        </div>
      </div>

      {loading && <div>Loading dashboard...</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}

      {!loading && !error && (
        <>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 30 }}>
            <div
              onClick={() => setSelectedCard("Total")}
              style={{ border: selectedCard === "Total" ? "2px solid var(--ion-color-primary, #0f172a)" : "1px solid var(--ion-color-light-shade, #c7d2e0)", padding: 20, borderRadius: "15px", background: "var(--ion-background-color, #fff)", flex: 1, minWidth: "200px", cursor: "pointer", transition: "all 0.2s" }}
            >
              <h3 style={{ color: "var(--ion-color-medium, #64748b)", fontSize: "14px", marginTop: 0 }}>Total Meetings</h3>
              <h1 style={{ margin: 0, fontSize: "32px", color: "var(--ion-color-dark, #0f172a)" }}>{dashboard.totalMeetings}</h1>
            </div>

            <div
              onClick={() => setSelectedCard("Completed")}
              style={{ border: selectedCard === "Completed" ? "2px solid #10b981" : "1px solid var(--ion-color-light-shade, #c7d2e0)", padding: 20, borderRadius: "15px", background: "var(--ion-background-color, #fff)", flex: 1, minWidth: "200px", cursor: "pointer", transition: "all 0.2s" }}
            >
              <h3 style={{ color: "var(--ion-color-medium, #64748b)", fontSize: "14px", marginTop: 0 }}>Completed</h3>
              <h1 style={{ margin: 0, fontSize: "32px", color: "#10b981" }}>{dashboard.completedMeetings}</h1>
            </div>

            <div
              onClick={() => setSelectedCard("Pending")}
              style={{ border: selectedCard === "Pending" ? "2px solid #f59e0b" : "1px solid var(--ion-color-light-shade, #c7d2e0)", padding: 20, borderRadius: "15px", background: "var(--ion-background-color, #fff)", flex: 1, minWidth: "200px", cursor: "pointer", transition: "all 0.2s" }}
            >
              <h3 style={{ color: "var(--ion-color-medium, #64748b)", fontSize: "14px", marginTop: 0 }}>Pending</h3>
              <h1 style={{ margin: 0, fontSize: "32px", color: "#f59e0b" }}>{dashboard.pendingMeetings}</h1>
            </div>

            <div
              onClick={() => setSelectedCard("Escalated")}
              style={{ border: selectedCard === "Escalated" ? "2px solid #ef4444" : "1px solid var(--ion-color-light-shade, #c7d2e0)", padding: 20, borderRadius: "15px", background: "var(--ion-background-color, #fff)", flex: 1, minWidth: "200px", cursor: "pointer", transition: "all 0.2s" }}
            >
              <h3 style={{ color: "var(--ion-color-medium, #64748b)", fontSize: "14px", marginTop: 0 }}>Escalated</h3>
              <h1 style={{ margin: 0, fontSize: "32px", color: "#ef4444" }}>{dashboard.escalatedMeetings}</h1>
            </div>
          </div>

          <h2 style={{ fontSize: "18px", marginBottom: "16px", color: "var(--ion-color-dark, #0f172a)" }}>{selectedCard} Meetings List</h2>
          {displayedMeetings.length > 0 ? (
            <div className="meeting-table-wrapper">
              <table className="meeting-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Period</th>
                    <th>Frequency Type</th>
                    <th>Meeting Type</th>
                    <th>Owner</th>
                    <th>Participants</th>
                    <th>Status</th>
                    <th>Project</th>
                    <th>Attachment</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedMeetings.map((item) => {
                    const mAttachment = item.attachment || (item as any).Attachment;
                    const mYear = item.financialYear || (item as any).FinancialYear || "";
                    const mMonth = item.monthName || (item as any).MonthName || "";
                    const mPeriod = `${mMonth} ${mYear}`.trim() || "-";
                    const mFrequency = item.frequencyType || (item as any).FrequencyType || "-";
                    return (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{mPeriod}</td>
                        <td>{mFrequency}</td>
                        <td>{item.meetingType}</td>
                        <td>{item.meetingOwner}</td>
                        <td>{item.participants || (item as any).Participants || "-"}</td>
                        <td>
                          <span style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: "bold",
                            color: "#fff",
                            backgroundColor: item.meetingStatus === "Completed" ? "#10b981" : item.meetingStatus === "Escalated" ? "#ef4444" : "#f59e0b"
                          }}>
                            {item.meetingStatus || "Pending"}
                          </span>
                        </td>
                        <td>{item.projectName}</td>
                        <td>
                          {mAttachment ? (
                            <a
                              href={getFileUrl(mAttachment)}
                              target="_blank"
                              rel="noreferrer"
                              className="view-file-btn"
                            >
                              <IonIcon icon={documentTextOutline} />
                              View File
                            </a>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>No File</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div>No meetings found for {selectedCard}.</div>
          )}
        </>
      )}
    </div>
  );
}

export default MeetingDashboard;