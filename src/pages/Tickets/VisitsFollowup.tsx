import React, { useEffect, useState, useMemo } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonLoading,
  IonToast,
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import {
  ChevronLeft,
  Search,
  RefreshCw,
  Building2,
  MapPin,
  Phone,
  User,
  Briefcase,
  Calendar,
  Clock,
  Edit3,
  Save,
  X,
  CheckCircle2,
  FileText,
  UserCheck,
} from "lucide-react";
import { API_BASE } from "../../config";
import "./VisitsFollowup.css";

export interface VisitFollowupItem {
  Visit_ID: number;
  DayTrip_ID?: number | null;
  Client_Name?: string | null;
  Location?: string | null;
  Projects?: string | null;
  Contact_Person?: string | null;
  Mobile_Number?: string | null;
  Remarks?: string | null;
  FollowUp_By?: string | null;
  Visited_date?: string | null;
  Created_On?: string | null;
}

const VisitsFollowup: React.FC = () => {
  const history = useHistory();

  // Current logged in user or default to '1614'
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const defaultEmpCode = user?.empCode || user?.emp_Code || "1614";
  const [empCode, setEmpCode] = useState<string>(defaultEmpCode);
  const [activeEmpCode, setActiveEmpCode] = useState<string>(defaultEmpCode);

  const [loading, setLoading] = useState<boolean>(false);
  const [visits, setVisits] = useState<VisitFollowupItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit / Modify Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<Partial<VisitFollowupItem>>({});

  // Fetch follow-up records from API
  const fetchFollowups = async (targetEmpCode: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token")?.replace(/"/g, "");
      const res = await fetch(
        `${API_BASE}OnDuty/Get_Visits_Followup?empCode=${encodeURIComponent(
          targetEmpCode.trim()
        )}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      const json = await res.json();
      if (res.ok && json.success) {
        setVisits(json.data || []);
      } else {
        setVisits([]);
        if (json.message) {
          setToastMessage(json.message);
        }
      }
    } catch (err: any) {
      console.error("Failed to load visit followups:", err);
      setToastMessage("Failed to connect to API server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchFollowups(activeEmpCode);
  }, [activeEmpCode]);

  const handleApplyEmpCode = () => {
    if (!empCode.trim()) return;
    setActiveEmpCode(empCode.trim());
  };

  // Open modal to modify details (which will insert a new record into tbl_OnDuty_Visit_Followup)
  const handleOpenEdit = (v: VisitFollowupItem) => {
    const today = new Date().toISOString().split("T")[0];
    setEditForm({
      Visit_ID: v.Visit_ID,
      DayTrip_ID: v.DayTrip_ID,
      Client_Name: v.Client_Name || "",
      Location: v.Location || "",
      Projects: v.Projects || "",
      Contact_Person: v.Contact_Person || "",
      Mobile_Number: v.Mobile_Number || "",
      Remarks: v.Remarks || "",
      FollowUp_By: v.FollowUp_By || activeEmpCode,
      Visited_date: today, // Always auto-updated to today's date
    });
    setIsModalOpen(true);
  };

  // Save changes -> Inserts new record in tbl_OnDuty_Visit_Followup
  const handleSaveFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.Visit_ID) {
      setToastMessage("Invalid Visit ID");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token")?.replace(/"/g, "");
      const res = await fetch(`${API_BASE}OnDuty/Save_Visit_Followup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          Visit_ID: editForm.Visit_ID,
          DayTrip_ID: editForm.DayTrip_ID || null,
          Client_Name: editForm.Client_Name || null,
          Location: editForm.Location || null,
          Projects: editForm.Projects || null,
          Contact_Person: editForm.Contact_Person || null,
          Mobile_Number: editForm.Mobile_Number || null,
          Remarks: editForm.Remarks || null,
          FollowUp_By: editForm.FollowUp_By || activeEmpCode,
          Visited_date: editForm.Visited_date || null,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setToastMessage("Follow-up saved! New record inserted into table.");
        setIsModalOpen(false);
        // Refresh list to show newly inserted record
        void fetchFollowups(activeEmpCode);
      } else {
        setToastMessage(json.message || "Failed to save follow-up.");
      }
    } catch (err: any) {
      console.error("Save follow-up error:", err);
      setToastMessage("Error communicating with server.");
    } finally {
      setSaving(false);
    }
  };

  // Layout View: 'row' (Single Record Row Cards) vs 'table' (Single Record Table Rows)
  const [layoutView, setLayoutView] = useState<"row" | "table">("row");
  const [expandedHistory, setExpandedHistory] = useState<Record<number, boolean>>({});

  const toggleHistory = (visitId: number) => {
    setExpandedHistory((prev) => ({
      ...prev,
      [visitId]: !prev[visitId],
    }));
  };

  // Group by Visit_ID so each visit is shown strictly as a single unique record with its latest details
  const groupedVisits = useMemo(() => {
    // Sort visits by Created_On DESC so newest is first
    const sorted = [...visits].sort((a, b) => {
      const tA = a.Created_On ? new Date(a.Created_On).getTime() : 0;
      const tB = b.Created_On ? new Date(b.Created_On).getTime() : 0;
      return tB - tA;
    });

    const map = new Map<
      number,
      { latest: VisitFollowupItem; history: VisitFollowupItem[] }
    >();

    for (const v of sorted) {
      const vid = v.Visit_ID;
      if (!map.has(vid)) {
        map.set(vid, { latest: v, history: [] });
      } else {
        map.get(vid)!.history.push(v);
      }
    }

    return Array.from(map.values()).map((item) => ({
      ...item.latest,
      history: item.history,
    }));
  }, [visits]);

  // Filtered visits - strictly single record per visit
  const filteredVisits = useMemo(() => {
    if (!searchTerm.trim()) return groupedVisits;
    const term = searchTerm.toLowerCase();
    return groupedVisits.filter((v) => {
      return (
        String(v.Visit_ID).includes(term) ||
        (v.Client_Name && v.Client_Name.toLowerCase().includes(term)) ||
        (v.Location && v.Location.toLowerCase().includes(term)) ||
        (v.Projects && v.Projects.toLowerCase().includes(term)) ||
        (v.Contact_Person && v.Contact_Person.toLowerCase().includes(term)) ||
        (v.Mobile_Number && v.Mobile_Number.includes(term)) ||
        (v.Remarks && v.Remarks.toLowerCase().includes(term))
      );
    });
  }, [groupedVisits, searchTerm]);

  const formatDate = (dStr?: string | null) => {
    if (!dStr) return "N/A";
    try {
      const d = new Date(dStr);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dStr;
    }
  };

  const formatDateTime = (dStr?: string | null) => {
    if (!dStr) return "N/A";
    try {
      const d = new Date(dStr);
      return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dStr;
    }
  };

  return (
    <IonPage className="visits-followup-page">
      <IonHeader>
        <IonToolbar className="vf-header-toolbar">
          <div className="vf-header-container">
            <div className="vf-header-left">
              <button
                className="vf-back-btn"
                onClick={() => history.goBack()}
                title="Go Back"
              >
                <ChevronLeft size={22} />
              </button>
              <h1 className="vf-header-title">
                Visits Follow-up
                <span className="vf-badge-count">{filteredVisits.length} Records</span>
              </h1>
            </div>
            <div className="vf-header-actions">
              <button
                className="vf-refresh-btn"
                onClick={() => fetchFollowups(activeEmpCode)}
                title="Refresh Records"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Control & Filter Bar */}
        <div className="vf-control-bar">
          <div className="vf-search-box">
            <Search size={18} color="#94a3b8" />
            <input
              type="text"
              className="vf-search-input"
              placeholder="Search by client, location, project, contact or visit ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={16} color="#94a3b8" />
              </button>
            )}
          </div>

          <div className="vf-emp-filter">
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>
              Emp Code:
            </span>
            <input
              type="text"
              className="vf-emp-input"
              value={empCode}
              onChange={(e) => setEmpCode(e.target.value)}
              placeholder="e.g. 1614"
            />
            <button className="vf-apply-btn" onClick={handleApplyEmpCode}>
              Filter
            </button>
          </div>

          {/* View Mode Toggle: Row Cards vs Table View */}
          <div className="vf-view-toggle">
            <button
              type="button"
              className={`vf-view-toggle-btn ${layoutView === "row" ? "active" : ""}`}
              onClick={() => setLayoutView("row")}
              title="Show each record as a full-width row card"
            >
              <FileText size={15} />
              <span>Row Cards</span>
            </button>
            <button
              type="button"
              className={`vf-view-toggle-btn ${layoutView === "table" ? "active" : ""}`}
              onClick={() => setLayoutView("table")}
              title="Show each record as a single table row"
            >
              <CheckCircle2 size={15} />
              <span>Table Rows</span>
            </button>
          </div>
        </div>

        {/* Loading Indicator */}
        <IonLoading isOpen={loading} message="Loading follow-up records..." />

        {/* Records Display - Strictly 1 Record Per Row */}
        {filteredVisits.length > 0 ? (
          layoutView === "row" ? (
            /* Row Cards View (Single record per row, full width) */
            <div className="vf-row-list">
              {filteredVisits.map((v: any, idx) => (
                <div key={`${v.Visit_ID}-${v.Created_On || idx}`} className="vf-row-card">
                  {/* Top Row Header */}
                  <div className="vf-row-header">
                    <div className="vf-row-header-left">
                      <h3 className="vf-client-title">
                        {v.Client_Name || "Unnamed Client"}
                      </h3>
                      <div className="vf-visit-ids">
                        <span className="vf-pill-id">Visit #{v.Visit_ID}</span>
                        {v.DayTrip_ID && (
                          <span className="vf-pill-id">Trip #{v.DayTrip_ID}</span>
                        )}
                      </div>
                      <div className="vf-pill-followup">
                        <UserCheck size={14} />
                        <span>{v.FollowUp_By || activeEmpCode}</span>
                      </div>
                      {v.history && v.history.length > 0 && (
                        <button
                          type="button"
                          className="vf-pill-history-count"
                          onClick={() => toggleHistory(v.Visit_ID)}
                          title="Click to view update history"
                        >
                          <Clock size={13} />
                          <span>{v.history.length + 1} updates</span>
                          {expandedHistory[v.Visit_ID] ? " ▲" : " ▼"}
                        </button>
                      )}
                    </div>

                    <div className="vf-row-header-right">
                      <button
                        className="vf-edit-btn"
                        onClick={() => handleOpenEdit(v)}
                      >
                        <Edit3 size={15} />
                        Edit
                      </button>
                    </div>
                  </div>

                  {/* Metadata Chips (Single Row Layout) */}
                  <div className="vf-details-row-chips">
                    {v.Location && (
                      <div className="vf-detail-chip">
                        <MapPin size={15} style={{ color: "#6366f1" }} />
                        <span>{v.Location}</span>
                      </div>
                    )}

                    {v.Projects && (
                      <div className="vf-detail-chip">
                        <Briefcase size={15} style={{ color: "#3b82f6" }} />
                        <span className="vf-projects-badge">{v.Projects}</span>
                      </div>
                    )}

                    {v.Contact_Person && (
                      <div className="vf-detail-chip">
                        <User size={15} style={{ color: "#10b981" }} />
                        <span>{v.Contact_Person}</span>
                      </div>
                    )}

                    {v.Mobile_Number && (
                      <div className="vf-detail-chip">
                        <Phone size={15} style={{ color: "#f59e0b" }} />
                        <span>{v.Mobile_Number}</span>
                      </div>
                    )}

                    <div className="vf-detail-chip">
                      <Calendar size={15} style={{ color: "#8b5cf6" }} />
                      <span>
                        Visited: <strong>{formatDate(v.Visited_date)}</strong>
                      </span>
                    </div>

                    <div className="vf-detail-chip">
                      <Clock size={15} style={{ color: "#64748b" }} />
                      <span>
                        Updated: <strong>{formatDateTime(v.Created_On)}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Remarks Section */}
                  <div className="vf-remarks-box">
                    <div style={{ fontWeight: 700, color: "#4338ca", marginBottom: "4px" }}>
                      Latest Remarks:
                    </div>
                    <div>"{v.Remarks || "No remarks entered"}"</div>
                  </div>

                  {/* Expandable History Accordion */}
                  {expandedHistory[v.Visit_ID] && v.history && v.history.length > 0 && (
                    <div className="vf-history-section">
                      <h4 className="vf-history-title">
                        <Clock size={15} /> Previous Follow-up History ({v.history.length} earlier logs)
                      </h4>
                      {v.history.map((h: any, hIdx: number) => (
                        <div key={hIdx} className="vf-history-item">
                          <div className="vf-history-meta">
                            <span>Updated: {formatDateTime(h.Created_On)} (Visited: {formatDate(h.Visited_date)})</span>
                            <span>By: {h.FollowUp_By || "N/A"}</span>
                          </div>
                          <div style={{ color: "#334155" }}>"{h.Remarks || "No remarks"}"</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Table Rows View (Each record is literally 1 table row) */
            <div className="vf-table-container">
              <table className="vf-table">
                <thead>
                  <tr>
                    <th>Visit #</th>
                    <th>Trip #</th>
                    <th>Client Name</th>
                    <th>Location</th>
                    <th>Project</th>
                    <th>Contact & Mobile</th>
                    <th>Latest Remarks</th>
                    <th>Visited Date</th>
                    <th>Last Updated</th>
                    <th>By</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVisits.map((v: any, idx) => (
                    <React.Fragment key={`${v.Visit_ID}-${v.Created_On || idx}`}>
                      <tr>
                        <td>
                          <span className="vf-pill-id">#{v.Visit_ID}</span>
                          {v.history && v.history.length > 0 && (
                            <button
                              type="button"
                              className="vf-pill-history-count"
                              style={{ marginTop: "4px", fontSize: "0.72rem" }}
                              onClick={() => toggleHistory(v.Visit_ID)}
                            >
                              {v.history.length + 1} updates {expandedHistory[v.Visit_ID] ? "▲" : "▼"}
                            </button>
                          )}
                        </td>
                        <td>{v.DayTrip_ID ? <span className="vf-pill-id">#{v.DayTrip_ID}</span> : "-"}</td>
                        <td><strong>{v.Client_Name || "-"}</strong></td>
                        <td>{v.Location || "-"}</td>
                        <td>
                          {v.Projects ? (
                            <span className="vf-projects-badge">{v.Projects}</span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          <div>{v.Contact_Person || "-"}</div>
                          {v.Mobile_Number && (
                            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{v.Mobile_Number}</div>
                          )}
                        </td>
                        <td style={{ maxWidth: "260px" }}>
                          <div className="vf-table-remarks">
                            "{v.Remarks || "No remarks"}"
                          </div>
                        </td>
                        <td>{formatDate(v.Visited_date)}</td>
                        <td style={{ fontSize: "0.8rem", color: "#64748b" }}>
                          {formatDateTime(v.Created_On)}
                        </td>
                        <td>
                          <span className="vf-pill-followup" style={{ padding: "2px 8px" }}>
                            {v.FollowUp_By || activeEmpCode}
                          </span>
                        </td>
                        <td>
                          <button
                            className="vf-edit-btn"
                            style={{ padding: "6px 14px", fontSize: "0.82rem", width: "auto" }}
                            onClick={() => handleOpenEdit(v)}
                          >
                            <Edit3 size={13} />
                            Edit
                          </button>
                        </td>
                      </tr>
                      {expandedHistory[v.Visit_ID] && v.history && v.history.length > 0 && (
                        <tr className="vf-table-history-row">
                          <td colSpan={11}>
                            <div className="vf-history-section">
                              <h4 className="vf-history-title">
                                <Clock size={14} /> Previous History for Visit #{v.Visit_ID} ({v.history.length} logs)
                              </h4>
                              {v.history.map((h: any, hIdx: number) => (
                                <div key={hIdx} className="vf-history-item">
                                  <div className="vf-history-meta">
                                    <span>Updated: {formatDateTime(h.Created_On)} (Visited: {formatDate(h.Visited_date)})</span>
                                    <span>By: {h.FollowUp_By || "N/A"}</span>
                                  </div>
                                  <div>"{h.Remarks || "No remarks"}"</div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          !loading && (
            <div className="vf-empty-state">
              <FileText size={56} color="#cbd5e1" />
              <h4 className="vf-empty-title">No Follow-up Records Found</h4>
              <p style={{ margin: 0, fontSize: "0.9rem" }}>
                No records found for Employee Code <strong>{activeEmpCode}</strong>.
              </p>
              <button
                className="vf-apply-btn"
                style={{ marginTop: "12px" }}
                onClick={() => fetchFollowups(activeEmpCode)}
              >
                Refresh
              </button>
            </div>
          )
        )}

        {/* Modal for Editing / Modifying Details */}
        {isModalOpen && (
          <div className="vf-modal-backdrop" onClick={() => setIsModalOpen(false)}>
            <div
              className="vf-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="vf-modal-header">
                <h3 className="vf-modal-title">
                  Modify Visit #{editForm.Visit_ID} Follow-up
                </h3>
                <button
                  className="vf-modal-close-btn"
                  onClick={() => setIsModalOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveFollowup}>
                <div className="vf-modal-body">
                  <div className="vf-form-row">
                    <div className="vf-form-group">
                      <label className="vf-form-label">Client Name</label>
                      <input
                        type="text"
                        className="vf-form-input"
                        value={editForm.Client_Name || ""}
                        readOnly
                      />
                    </div>
                    <div className="vf-form-group">
                      <label className="vf-form-label">Location</label>
                      <input
                        type="text"
                        className="vf-form-input"
                        value={editForm.Location || ""}
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="vf-form-row">
                    <div className="vf-form-group">
                      <label className="vf-form-label">Contact Person</label>
                      <input
                        type="text"
                        className="vf-form-input"
                        value={editForm.Contact_Person || ""}
                        readOnly
                      />
                    </div>
                    <div className="vf-form-group">
                      <label className="vf-form-label">Mobile Number</label>
                      <input
                        type="text"
                        className="vf-form-input"
                        value={editForm.Mobile_Number || ""}
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="vf-form-group">
                    <label className="vf-form-label">Projects</label>
                    <input
                      type="text"
                      className="vf-form-input"
                      value={editForm.Projects || ""}
                      readOnly
                    />
                  </div>

                  <div className="vf-form-row">
                    <div className="vf-form-group">
                      <label className="vf-form-label">Follow-up By (EmpCode)</label>
                      <input
                        type="text"
                        className="vf-form-input"
                        value={editForm.FollowUp_By || ""}
                        readOnly
                      />
                    </div>
                    <div className="vf-form-group">
                      <label className="vf-form-label">
                        Visited Date <span style={{ color: "#4f46e5", fontSize: "0.78rem" }}>(Auto Updated)</span>
                      </label>
                      <input
                        type="date"
                        className="vf-form-input"
                        value={editForm.Visited_date || ""}
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="vf-form-group">
                    <label className="vf-form-label" style={{ color: "#4f46e5", fontWeight: 700 }}>
                      Follow-up Remarks (Editable) *
                    </label>
                    <textarea
                      className="vf-form-textarea"
                      placeholder="Enter new follow-up remarks, discussion summary, or action items..."
                      value={editForm.Remarks || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, Remarks: e.target.value })
                      }
                      autoFocus
                      required
                    />
                  </div>

                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "10px",
                      padding: "10px 14px",
                      fontSize: "0.82rem",
                      color: "#166534",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >

                  </div>
                </div>

                <div className="vf-modal-footer">
                  <button
                    type="button"
                    className="vf-cancel-btn"
                    onClick={() => setIsModalOpen(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="vf-save-btn" disabled={saving}>
                    <Save size={16} />
                    {saving ? "Saving..." : "Save & Insert Record"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <IonToast
          isOpen={Boolean(toastMessage)}
          message={toastMessage || ""}
          duration={3000}
          onDidDismiss={() => setToastMessage(null)}
        />
      </IonContent>
    </IonPage>
  );
};

export default VisitsFollowup;
