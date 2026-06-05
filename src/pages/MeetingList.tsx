import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import moment from "moment";
import { API_BASE } from "../config";
import { IonIcon, IonSelect, IonSelectOption } from "@ionic/react";
import { calendarOutline, layersOutline, documentTextOutline } from "ionicons/icons";
import "./MeetingList.css";

const generateMonthList = () => {
  const months: string[] = [];
  const startYear = 2014;

  const current = moment().add(1, "month");
  const currentYear = current.year();

  for (let y = currentYear; y >= startYear; y--) {
    const endMonth =
      y === currentYear ? current.month() : 11;

    for (let m = endMonth; m >= 0; m--) {
      months.push(
        moment()
          .year(y)
          .month(m)
          .format("MMM-YYYY")
      );
    }
  }

  return months;
};

interface Meeting {
  id: number;
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
  attachment?: string;
}

interface MeetingListProps { }

const getUser = () => {
  try {
    const stored =
      localStorage.getItem("user") ||
      localStorage.getItem("userData");

    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

function MeetingList({ }: MeetingListProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Month Filter
  const [monthsList, setMonthsList] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return moment().format("MMM-YYYY");
  });

  // Editable States
  const [editStates, setEditStates] = useState<
    Record<
      number,
      {
        status: string;
        remarks: string;
        file: File | null;
      }
    >
  >({});

  const user = getUser();

  const empCode = String(
    user.EmpCode ||
    user.empCode ||
    user.Username ||
    user.username ||
    ""
  );

  const isAdmin = useMemo(() => {
    const role = String(user.userType || user.UserType || user.Username || "").toLowerCase();
    return role === "admin" || role === "accountant" || role === "manager";
  }, [user]);

  useEffect(() => {
    const list = generateMonthList();
    setMonthsList(list);

    if (!selectedMonth) {
      setSelectedMonth(list[0]);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const base = API_BASE ? API_BASE.replace(/\/$/, "") : "";
      const token = localStorage.getItem("token") || "";
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Load meetings list
      const response = await axios.get(`${base}/Meeting/GetMeetings`, { headers });
      const data = response?.data ?? [];

      setMeetings(data);

      // Initialize edit states
      const initialEdits: any = {};

      data.forEach((m: Meeting) => {
        if (m.id) {
          initialEdits[m.id] = {
            status: m.meetingStatus || (m as any).MeetingStatus || "Pending",
            remarks: m.remarks || (m as any).Remarks || "",
            file: null,
          };
        }
      });

      setEditStates(initialEdits);
    } catch (err: any) {
      console.error("Error loading meetings:", err);
      setError(err?.message || "Failed to load meetings.");
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  // Safe field retrievers for both camelCase and PascalCase
  const getParticipants = (item: Meeting): string => {
    return String(item.participants || (item as any).Participants || "");
  };

  const getMeetingOwner = (item: Meeting): string => {
    return String(item.meetingOwner || (item as any).MeetingOwner || "");
  };

  // Check Meeting Owner (Exact check using comma split)
  const isOwner = (meetingOwner?: string) => {
    if (!meetingOwner || !empCode) return false;
    return meetingOwner
      .split(",")
      .map((o) => o.trim().toLowerCase())
      .includes(empCode.toLowerCase());
  };

  // Check Participant (Exact check using comma split)
  const isParticipant = (participants?: string) => {
    if (!participants || !empCode) return false;
    return participants
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .includes(empCode.toLowerCase());
  };

  const getFileUrl = (path?: string) => {
    if (!path) return "#";
    const root = API_BASE ? API_BASE.replace(/\/api\/?$/i, "") : "";
    return `${root}${path}`;
  };

  const handleEditChange = (id: number, key: string, value: any) => {
    setEditStates((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [key]: value,
      },
    }));
  };

  const handleSave = async (meetingId: number) => {
    const edit = editStates[meetingId];
    if (!edit) return;

    const formData = new FormData();
    formData.append("Id", String(meetingId));
    formData.append("MeetingStatus", edit.status);
    formData.append("Remarks", edit.remarks);

    if (edit.file) {
      formData.append("Attachment", edit.file);
    }

    try {
      const base = API_BASE ? API_BASE.replace(/\/$/, "") : "";
      const token = localStorage.getItem("token") || "";

      await axios.post(`${base}/Meeting/UpdateMeetingStatus`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      alert("Updated successfully!");
      loadData();
    } catch (err: any) {
      console.error("Failed to update:", err);
      let errorMsg = err.message || "Unknown error";
      if (err.response && err.response.data) {
        errorMsg = typeof err.response.data === "string" ? err.response.data : JSON.stringify(err.response.data);
      }
      alert("Failed to update: " + errorMsg);
    }
  };

  // FILTER DATA
  const filteredMeetings = useMemo(() => {
    let result = meetings;

    // Show all to Admin/Manager/Accountant, otherwise restrict to Owner & Participants
    if (!isAdmin) {
      result = result.filter((m) => {
        const ownerVisible = isOwner(getMeetingOwner(m));
        const participantVisible = isParticipant(getParticipants(m));
        return ownerVisible || participantVisible;
      });
    }

    // Month Filter
    if (selectedMonth) {
      const [filterMonth, filterYear] = selectedMonth.split("-");
      const fullFilterMonth = moment(filterMonth, "MMM").format("MMMM").toLowerCase();

      result = result.filter((m) => {
        const mMonth = m.monthName || (m as any).MonthName;
        const mYear = m.financialYear || (m as any).FinancialYear;
        return mMonth?.toLowerCase() === fullFilterMonth && mYear === filterYear;
      });
    }

    return result;
  }, [meetings, selectedMonth, empCode, isAdmin]);

  // Check If Any Owner Meeting Exists
  const hasOwnerMeeting = filteredMeetings.some((m) => isOwner(getMeetingOwner(m)));

  return (
    <div
      style={{
        padding: 20,
        paddingBottom: 90, // Leave space for the plus gearicon (FAB)
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflowY: "auto",
        minHeight: "100vh"
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          flexShrink: 0
        }}
      >
        <h2 style={{ margin: 0 }}>Meeting List</h2>

        {/* Month Filter */}
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
                if (e.detail.value) {
                  setSelectedMonth(e.detail.value);
                }
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
      </div>

      {/* Loading */}
      {loading && <div>Loading meetings...</div>}

      {/* Error */}
      {error && <div style={{ color: "red" }}>{error}</div>}

      {/* Empty */}
      {!loading && !error && filteredMeetings.length === 0 && (
        <div>No meetings found.</div>
      )}

      {/* Table */}
      {!loading && !error && filteredMeetings.length > 0 && (
        <div className="meeting-table-wrapper" style={{ flex: 1, minHeight: 0, maxHeight: "none" }}>
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
                <th>Remarks</th>
                <th>Attachment</th>

                {/* Actions ONLY for Owners */}
                {hasOwnerMeeting && <th>Actions</th>}
              </tr>
            </thead>

            <tbody>
              {filteredMeetings.map((item) => {
                const userIsOwner = isOwner(getMeetingOwner(item));
                const edit = editStates[item.id] || { status: "", remarks: "", file: null };

                const mYear = item.financialYear || (item as any).FinancialYear || "";
                const mMonth = item.monthName || (item as any).MonthName || "";
                const mPeriod = `${mMonth} ${mYear}`.trim() || "-";

                const mFrequency = item.frequencyType || (item as any).FrequencyType || "-";
                const mMeetingType = item.meetingType || (item as any).MeetingType || "-";
                const mStatus = item.meetingStatus || (item as any).MeetingStatus || "Pending";
                const mRemarks = item.remarks || (item as any).Remarks || "-";
                const mAttachment = item.attachment || (item as any).Attachment;

                const mOwnerRaw = getMeetingOwner(item) || "-";
                const mParticipantsRaw = getParticipants(item) || "-";

                return (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{mPeriod}</td>
                    <td>{mFrequency}</td>
                    <td>{mMeetingType}</td>
                    <td>{mOwnerRaw}</td>
                    <td>{mParticipantsRaw}</td>

                    {/* Status */}
                    <td>
                      {userIsOwner ? (
                        <select
                          value={edit.status}
                          onChange={(e) => handleEditChange(item.id, "status", e.target.value)}
                          style={{
                            padding: "4px",
                            borderRadius: "4px",
                          }}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Completed">Completed</option>
                          <option value="Escalated">Escalated</option>
                        </select>
                      ) : (
                        <span>{mStatus}</span>
                      )}
                    </td>

                    {/* Remarks */}
                    <td>
                      {userIsOwner ? (
                        <input
                          type="text"
                          value={edit.remarks}
                          onChange={(e) => handleEditChange(item.id, "remarks", e.target.value)}
                          placeholder="Add remark..."
                          style={{
                            padding: "4px",
                            borderRadius: "4px",
                            border: "1px solid #ccc",
                          }}
                        />
                      ) : (
                        <span>{mRemarks}</span>
                      )}
                    </td>

                    {/* Attachment */}
                    <td>
                      {mAttachment && (
                        <div style={{ marginBottom: "8px" }}>
                          <a
                            href={getFileUrl(mAttachment)}
                            target="_blank"
                            rel="noreferrer"
                            className="view-file-btn"
                          >
                            <IonIcon icon={documentTextOutline} />
                            View File
                          </a>
                        </div>
                      )}

                      {userIsOwner ? (
                        <input
                          type="file"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              handleEditChange(item.id, "file", e.target.files[0]);
                            }
                          }}
                        />
                      ) : (
                        !mAttachment && (
                          <span style={{ color: "#94a3b8" }}>No File</span>
                        )
                      )}
                    </td>

                    {/* Actions ONLY FOR OWNER */}
                    {userIsOwner && (
                      <td>
                        <button
                          onClick={() => handleSave(item.id)}
                          style={{
                            padding: "6px 14px",
                            background: "var(--ion-color-primary, #447230)",
                            color: "var(--ion-color-primary-contrast, #fff)",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontWeight: "bold",
                            fontSize: "12px",
                          }}
                        >
                          Save
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default MeetingList;