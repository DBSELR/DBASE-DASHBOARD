import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";

interface MeetingDashboardData {
  totalMeetings?: number;
  completedMeetings?: number;
  pendingMeetings?: number;
  escalatedMeetings?: number;
  [key: string]: any;
}

function MeetingDashboard() {
  const [dashboard, setDashboard] = useState<MeetingDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const base = API_BASE ? API_BASE.replace(/\/$/, "") : "";
      const response = await axios.get(`${base}/Meeting/GetMeetingsDashboard`);
      setDashboard(response?.data?.[0] ?? null);
    } catch (err: any) {
      console.error("Error loading meeting dashboard:", err);
      setError((err && err.message) || "Failed to load dashboard.");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Meeting KPI Dashboard</h1>

      {loading && <div>Loading dashboard...</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}
      {!loading && !error && !dashboard && <div>No dashboard data available.</div>}

      {!loading && !error && dashboard && (
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ border: "1px solid gray", padding: 20 }}>
            <h3>Total Meetings</h3>
            <h1>{dashboard.totalMeetings ?? 0}</h1>
          </div>

          <div style={{ border: "1px solid gray", padding: 20 }}>
            <h3>Completed</h3>
            <h1>{dashboard.completedMeetings ?? 0}</h1>
          </div>

          <div style={{ border: "1px solid gray", padding: 20 }}>
            <h3>Pending</h3>
            <h1>{dashboard.pendingMeetings ?? 0}</h1>
          </div>

          <div style={{ border: "1px solid gray", padding: 20 }}>
            <h3>Escalated</h3>
            <h1>{dashboard.escalatedMeetings ?? 0}</h1>
          </div>
        </div>
      )}
    </div>
  );
}

export default MeetingDashboard;