import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";

interface Meeting {
  id?: number;
  financialYear?: string;
  monthName?: string;
  weekName?: string;
  meetingType?: string;
  participants?: string;
  frequencyType?: string;
  meetingOwner?: string;
  meetingStatus?: string;
  remarks?: string;
  createdBy?: string;
}

function MeetingList() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const base = API_BASE ? API_BASE.replace(/\/$/, "") : "";
      const response = await axios.get(`${base}/Meeting/GetMeetings`);
      setMeetings(response?.data ?? []);
    } catch (err: any) {
      console.error("Error loading meetings:", err);
      setError((err && err.message) || "Failed to load meetings.");
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Meeting List</h2>

      {loading && <div>Loading meetings...</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}

      {!loading && !error && meetings.length === 0 && <div>No meetings found.</div>}

      {!loading && !error && meetings.length > 0 && (
        <table border={1} cellPadding={10}>
          <thead>
            <tr>
              <th>Year</th>
              <th>Month</th>
              <th>Meeting</th>
              <th>Owner</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {meetings.map((item, index) => (
              <tr key={index}>
                <td>{item.financialYear}</td>
                <td>{item.monthName}</td>
                <td>{item.meetingType}</td>
                <td>{item.meetingOwner}</td>
                <td>{item.meetingStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default MeetingList;