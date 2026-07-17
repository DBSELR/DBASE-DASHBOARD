import React, { useEffect, useState } from "react";
import { IonPage, IonContent, IonIcon, IonToast, IonSpinner, IonSelect, IonSelectOption } from "@ionic/react";
import { shieldCheckmarkOutline, personOutline, optionsOutline, calendarOutline, documentTextOutline, addCircleOutline, informationCircleOutline } from "ionicons/icons";
import axios from "axios";
import { apiService } from "../../utils/apiService";
import { API_BASE } from "../../config";
import "../../pages/LeaveRequest.css"; // Ensures lr-bento-grid styles are available
import "./ApprovalDates.css";

const ApprovalDates: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState("");
  const [isManager, setIsManager] = useState(false);

  // New Request State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newReq, setNewReq] = useState({
    RequestType: "Leave",
    FromDate: "",
    ToDate: "",
    OTDate: "",
    OTTime: "",
    Remarks: "",
    Status: "Pending"
  });

  const getUser = () => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token")?.replace(/"/g, "");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const getField = (req: any, ...keys: string[]) => {
    for (const key of keys) {
      const val = req?.[key];
      if (val !== undefined && val !== null && val !== "") return val;
    }
    return "";
  };

  const normalizeDateForInput = (value: unknown): string => {
    if (value == null || value === "") return "";
    if (typeof value === "object") return "";

    const str = String(value).trim();
    if (!str || str === "[object Object]") return "";
    if (str.startsWith("0001-01-01")) return "";

    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const d = str.split("T")[0];
      if (d.startsWith("0001")) return "";
      return d;
    }

    const parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      if (y < 1753) return "";
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      const d = String(parsed.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    return "";
  };

  const normalizeEmpCode = (code: unknown) =>
    String(code ?? "").trim().toLowerCase();

  const getCurrentEmpCode = () => {
    const user = getUser();
    return normalizeEmpCode(
      user?.empCode || user?.EmpCode || user?.Username || user?.username
    );
  };

  const isRequestOwner = (req: any) => {
    const requestEmpCode = normalizeEmpCode(
      req?.EmpCode || req?.empCode || req?.Empcode
    );
    const currentEmpCode = getCurrentEmpCode();
    return !!currentEmpCode && !!requestEmpCode && currentEmpCode === requestEmpCode;
  };

  const canUpdateRequest = (req: any) => !isRequestOwner(req);

  const fmtDMY = (dateStr: string) => {
    if (!dateStr) return "";
    const d = dateStr.split("T")[0];
    const parts = d.split("-");
    if (parts.length === 3) {
      // Input is YYYY-MM-DD
      if (parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    return d;
  };

  useEffect(() => {
    const detectManagerRole = async () => {
      const user = getUser();
      const designation = String(user?.designation || user?.Designation || "")
        .trim()
        .toLowerCase();
      const userType = String(user?.userType || user?.UserType || "")
        .trim()
        .toLowerCase();

      const managerByProfile =
        userType === "manager" ||
        userType === "admin" ||
        user?.IsManager ||
        String(user?.Role || user?.role || "").toLowerCase() === "manager" ||
        designation.includes("manager") ||
        designation === "hr" ||
        designation === "director" ||
        designation === "in-charge f&a";

      if (managerByProfile) {
        setIsManager(true);
        return;
      }

      try {
        const rasList = await apiService.loadRAS();
        const canApproveTeam = Array.isArray(rasList) && rasList.some(
          (r: any) => String(r?.name || "").trim().toLowerCase() === designation
        );
        setIsManager(canApproveTeam);
      } catch {
        setIsManager(false);
      }
    };

    detectManagerRole();
    fetchRequests();
  }, []);
  const fetchRequests = async () => {
    try {
      setLoading(true);

      const user = getUser();

      const empCode =
        user?.empCode ||
        user?.EmpCode ||
        "";

      console.log("EmpCode:", empCode);

      const res = await axios.get(
        `${API_BASE}ApprovalRequest/Load_ApprovalRequests`,
        {
          params: { empCode },
          headers: getAuthHeaders(),
        }
      );

      console.log("Approval Requests:", res.data);

      const rows = Array.isArray(res.data) ? res.data : [];
      setRequests(
        rows.map((req: any) => ({
          ...req,
          FromDate: normalizeDateForInput(getField(req, "FromDate", "fromDate")),
          ToDate: normalizeDateForInput(getField(req, "ToDate", "toDate")),
          OTDate: normalizeDateForInput(getField(req, "OTDate", "otDate")),
          RequestType: getField(req, "RequestType", "requestType") || "Leave",
          Status: getField(req, "Status", "status") || "Pending",
          Remarks: getField(req, "Remarks", "remarks"),
          EmpCode: getField(req, "EmpCode", "empCode", "Empcode"),
          Id: getField(req, "Id", "id"),
        }))
      );
    } catch (err: any) {
      console.error("Load Error:", err);
      console.error("Response:", err?.response?.data);

      setToastMsg("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (reqId: string | number, field: string, value: string) => {
    setRequests(prev => prev.map(r => (r.Id === reqId || r.id === reqId) ? { ...r, [field]: value } : r));
  };

  const handleNewFieldChange = (field: string, value: string) => {
    setNewReq(prev => ({ ...prev, [field]: value }));
  };

  const submitNewRequest = async () => {
    try {
      const user = getUser();
      const empCode = user?.empCode || user?.EmpCode || "";

      const fDate = normalizeDateForInput(newReq.FromDate);
      const tDate = normalizeDateForInput(newReq.ToDate);

      if (!fDate || !tDate) {
        setToastMsg("Please select valid dates");
        return;
      }

      const payload = {
        empCode,
        requestType: newReq.RequestType,
        fromDate: fDate,
        toDate: tDate,
        remarks: newReq.Remarks,
        status: newReq.Status
      };

      await axios.post(
        `${API_BASE}ApprovalRequest/SaveApprovalRequest`,
        payload,
        { headers: getAuthHeaders() }
      );

      setToastMsg("New request submitted!");
      setShowAddForm(false);
      fetchRequests();
    } catch (err: any) {
      console.error(err);
      const data = err?.response?.data;
      const msg = typeof data === 'string' ? data : (data?.title || data?.message || "Failed to submit request");
      setToastMsg(String(msg) || "Failed to submit request");
    }
  };

  const saveRow = async (req: any) => {
    try {
      const fDate = normalizeDateForInput(req.FromDate || req.fromDate);
      const tDate = normalizeDateForInput(req.ToDate || req.toDate);

      if (!fDate || !tDate) {
        setToastMsg("Please select valid dates");
        return;
      }

      const payload = {
        requestId: req.Id || req.id,
        requestType: req.RequestType || req.requestType,
        fromDate: fDate,
        toDate: tDate,
        remarks: req.Remarks || req.remarks,
        status: req.Status || req.status
      };

      console.log("Update Payload:", payload);

      const res = await axios.post(
        `${API_BASE}ApprovalRequest/UpdateApprovalRequest`,
        payload,
        { headers: getAuthHeaders() }
      );

      console.log("Update Response:", res.data);

      setToastMsg("Updated Successfully");

      fetchRequests();
    } catch (err: any) {
      console.error("Update Error:", err);
      console.error("Response:", err?.response?.data);

      const data = err?.response?.data;
      const msg = typeof data === 'string' ? data : (data?.title || data?.message || "Update Failed");
      setToastMsg(String(msg) || "Update Failed");
    }
  };
  const renderBentoForm = (req: any, isNew: boolean) => {
    const reqId = isNew ? "new" : (req.Id || req.id);
    const onChangeFn = isNew ? handleNewFieldChange : (field: string, val: string) => handleFieldChange(reqId, field, val);
    const canEdit = isNew || canUpdateRequest(req);
    const isOverTime = (req.RequestType || "Leave") === "OverTime";

    const endDateField = (
      <div className="lr-field-box ad-field-end-date">
        <label className="lr-field-label">END DATE</label>
        <div className="lr-field-content">
          <IonIcon icon={calendarOutline} className="lr-field-icon" />
          <input
            type="date"
            value={normalizeDateForInput(req.ToDate || req.toDate)}
            disabled={!canEdit && req.Status !== 'Pending'}
            onChange={(e) => onChangeFn('ToDate', e.target.value)}
            className="ad-form-input"
          />
        </div>
      </div>
    );

    const remarksField = (
      <div className="lr-field-box ad-field-remarks">
        <label className="lr-field-label">REMARKS</label>
        <div className="lr-field-content ad-remarks-content">
          <IonIcon icon={documentTextOutline} className="lr-field-icon" />
          <textarea
            placeholder="Enter details..."
            value={req.Remarks || ""}
            disabled={!canEdit && req.Status !== 'Pending'}
            onChange={(e) => onChangeFn('Remarks', e.target.value)}
            rows={2}
            className="ad-form-textarea"
          />
        </div>
      </div>
    );

    return (
      <div className={`ad-form-card ${isNew ? "ad-form-card--new" : ""}`}>

        {!isNew && (
          <div className="ad-form-meta">
            <div className="ad-form-meta-emp">
              <IonIcon icon={personOutline} />
              {req.Empcode || req.EmpCode}
            </div>
            <div className="ad-form-meta-id">Request ID: {reqId}</div>
          </div>
        )}

        {isNew && (
          <div className="ad-details-card">
            <div className="ad-details-icon">
              <IonIcon icon={informationCircleOutline} />
            </div>
            <div className="ad-details-body">
              <h3 className="ad-details-title">Raise Request to Manager to Release Previous Dates</h3>
              <p className="ad-details-text">
                Select the leave type and date range you need unlocked. Your manager will review and approve the request.
              </p>
            </div>
          </div>
        )}

        <div className={isNew ? "ad-form-grid ad-form-grid--new" : "lr-bento-grid"}>

          {isNew && (
            <div className="lr-field-box">
              <label className="lr-field-label">Employee Code</label>
              <div className="lr-field-content">
                <IonIcon icon={personOutline} className="lr-field-icon" />
                <input
                  type="text"
                  value={getUser()?.empCode || getUser()?.EmpCode || ""}
                  disabled
                  className="ad-form-input ad-form-input--readonly"
                />
              </div>
            </div>
          )}

          <div className="lr-field-box">
            <label className="lr-field-label">LEAVE TYPE</label>
            <div className="lr-field-content">
              <IonIcon icon={optionsOutline} className="lr-field-icon" />
              <IonSelect
                value={req.RequestType || "Leave"}
                disabled={!canEdit && req.Status !== 'Pending'}
                onIonChange={(e) => onChangeFn('RequestType', e.detail.value)}
                interface="popover"
                className="lr-popover-select"
                style={{ width: '100%', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}
              >
                <IonSelectOption value="Leave">Leave</IonSelectOption>
                <IonSelectOption value="On Duty">On Duty</IonSelectOption>
                <IonSelectOption value="OverTime">OverTime</IonSelectOption>

              </IonSelect>
            </div>
          </div>

          {!isOverTime ? (
            <>
              {/* START DATE */}
              <div className="lr-field-box">
                <label className="lr-field-label">START DATE</label>
                <div className="lr-field-content">
                  <IonIcon icon={calendarOutline} className="lr-field-icon" />
                  <input
                    type="date"
                    value={normalizeDateForInput(req.FromDate || req.fromDate)}
                    disabled={!canEdit && req.Status !== 'Pending'}
                    onChange={(e) => onChangeFn('FromDate', e.target.value)}
                    className="ad-form-input"
                  />
                </div>
              </div>

              {/* END DATE */}
              <div className="lr-field-box">
                <label className="lr-field-label">END DATE</label>
                <div className="lr-field-content">
                  <IonIcon icon={calendarOutline} className="lr-field-icon" />
                  <input
                    type="date"
                    value={normalizeDateForInput(req.ToDate || req.toDate)}
                    disabled={!canEdit && req.Status !== 'Pending'}
                    onChange={(e) => onChangeFn('ToDate', e.target.value)}
                    className="ad-form-input"
                  />
                </div>
              </div>
              <div className="lr-field-box ad-remarks-side">
                <label className="lr-field-label">REMARKS</label>
                <div className="lr-field-content ad-remarks-content">
                  <IonIcon icon={documentTextOutline} className="lr-field-icon" />
                  <textarea
                    placeholder="Enter details..."
                    value={req.Remarks || ""}
                    disabled={!canEdit && req.Status !== 'Pending'}
                    onChange={(e) => onChangeFn('Remarks', e.target.value)}
                    rows={2}
                    className="ad-form-textarea"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* OT DATE */}
              <div className="lr-field-box">
                <label className="lr-field-label">OT DATE</label>
                <div className="lr-field-content">
                  <IonIcon icon={calendarOutline} className="lr-field-icon" />
                  <input
                    type="date"
                    value={normalizeDateForInput(req.FromDate || req.fromDate)}
                    disabled={!canEdit && req.Status !== 'Pending'}
                    onChange={(e) => {
                      onChangeFn('FromDate', e.target.value);
                      onChangeFn('ToDate', e.target.value);
                    }}
                    className="ad-form-input"
                  />
                </div>
              </div>
              <div className="lr-field-box" style={{ gridColumn: '1 / -1' }}>
                <label className="lr-field-label">REMARKS</label>
                <div className="lr-field-content ad-remarks-content">
                  <IonIcon icon={documentTextOutline} className="lr-field-icon" />
                  <textarea
                    placeholder="Enter details..."
                    value={req.Remarks || ""}
                    disabled={!canEdit && req.Status !== 'Pending'}
                    onChange={(e) => onChangeFn('Remarks', e.target.value)}
                    rows={2}
                    className="ad-form-textarea"
                  />
                </div>
              </div>

            </>
          )}

          {isNew ? (
            <div className="ad-form-row-split">

            </div>
          ) : (
            <>
              {remarksField}
              {endDateField}
              <div className="lr-field-box" style={{ gridColumn: '1 / -1' }}>
                <label className="lr-field-label">REMARKS</label>
                <div className="lr-field-content ad-remarks-content">
                  <IonIcon icon={documentTextOutline} className="lr-field-icon" />
                  <textarea
                    placeholder="Enter details..."
                    value={req.Remarks || ""}
                    disabled={!canEdit && req.Status !== 'Pending'}
                    onChange={(e) => onChangeFn('Remarks', e.target.value)}
                    rows={2}
                    className="ad-form-textarea"
                  />
                </div>
              </div>
            </>
          )}

          {!isNew && (
            <div className="lr-field-box">
              <label className="lr-field-label">Status</label>
              <div className="lr-field-content">
                <IonIcon icon={optionsOutline} className="lr-field-icon" />
                <select
                  value={req.Status || "Pending"}
                  disabled={!canEdit}
                  onChange={(e) => onChangeFn('Status', e.target.value)}
                  className="ad-form-select"
                  style={{
                    color: (req.Status === 'Approved') ? '#10b981' : (req.Status === 'Reject' || req.Status === 'Rejected') ? '#ef4444' : '#f59e0b',
                    cursor: canEdit ? 'pointer' : 'not-allowed'
                  }}
                >
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Reject">Reject</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {(isNew || canUpdateRequest(req)) && (
          <button
            className="lr-gradient-btn"
            onClick={() => isNew ? submitNewRequest() : saveRow(req)}
          >
            {isNew ? "Submit Request" : "Update Request"}
          </button>
        )}
      </div>
    );
  };

  return (
    <IonPage>
      <IonContent className="approval-dashboard-container">
        <div className="ad-header-banner">
          <div style={{ position: "relative", zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className="ad-header-title">Approval Dates</h1>
              <p className="ad-header-subtitle">Manage previous date access requests</p>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              style={{ background: 'white', color: '#0f172a', border: 'none', borderRadius: '12px', padding: '10px 16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}
            >
              <IonIcon icon={addCircleOutline} style={{ fontSize: 20 }} />
              Add New
            </button>
          </div>
        </div>

        <div className="ad-content-wrapper">
          <div className="ad-role-badge">
            <IonIcon icon={isManager ? shieldCheckmarkOutline : personOutline} />
            <span>{isManager ? "Manager View" : "Employee View"}</span>
          </div>

          {showAddForm && renderBentoForm(newReq, true)}

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <IonSpinner color="primary" />
            </div>
          ) : requests.length > 0 ? (
            <div className="approval-grid">
              {requests.map((req, i) => {
                const canEdit = canUpdateRequest(req);
                const statusValue = req.Status || req.status || "Pending";
                const statusClass = String(statusValue).toLowerCase();

                return (
                  <div
                    key={req.Id || req.id || i}
                    className="approval-card"
                  >
                    <div className="approval-card-header">
                      <div>
                        <div className="approval-emp">
                          {req.EmpCode || req.empCode}
                        </div>

                        <div className="approval-id">
                          Request #{req.Id || req.id}
                        </div>
                      </div>

                      {/* <span
            className={`status-chip ${(req.Status || req.status || "").toLowerCase()}`}
          >
            {req.Status || req.status}
          </span> */}
                      {canEdit ? (
                        <select
                          className={`approval-status-select approval-status-glossy ${statusClass}`}
                          value={statusValue}
                          onChange={(e) =>
                            handleFieldChange(
                              req.Id || req.id,
                              "Status",
                              e.target.value
                            )
                          }
                        >
                          <option value="Pending">Pending</option>
                          <option value="Approved">Approved</option>
                          <option value="Reject">Reject</option>
                        </select>
                      ) : (
                        <span className={`approval-status-glossy ${statusClass}`}>
                          {statusValue}
                        </span>
                      )}
                    </div>

                    <div className="approval-card-body">
                      <div className="approval-item">
                        <span>Leave Type</span>
                        <strong>{req.RequestType || req.requestType}</strong>
                      </div>

                      {(req.RequestType || req.requestType) === "OverTime" ? (
                        <div className="approval-item">
                          <span>OT Date</span>
                          <input
                            type="date"
                            value={normalizeDateForInput(req.FromDate || req.fromDate)}
                            disabled={!canEdit}
                            onChange={(e) => {
                              handleFieldChange(req.Id || req.id, "FromDate", e.target.value);
                              handleFieldChange(req.Id || req.id, "ToDate", e.target.value);
                            }}
                          />
                        </div>
                      ) : (
                        <>
                          <div className="approval-item">
                            <span>From Date</span>
                            <input
                              type="date"
                              value={normalizeDateForInput(req.FromDate || req.fromDate)}
                              disabled={!canEdit}
                              onChange={(e) =>
                                handleFieldChange(
                                  req.Id || req.id,
                                  "FromDate",
                                  e.target.value
                                )
                              }
                            />
                          </div>

                          <div className="approval-item">
                            <span>To Date</span>
                            <input
                              type="date"
                              value={normalizeDateForInput(req.ToDate || req.toDate)}
                              disabled={!canEdit}
                              onChange={(e) =>
                                handleFieldChange(
                                  req.Id || req.id,
                                  "ToDate",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div className="approval-item">
                      <span>Remarks</span>
                      {(req.Remarks || req.remarks) === "undefined" ? "" : (req.Remarks || req.remarks)}
                    </div>

                    {canEdit && (
                      <button
                        className="approval-action-btn"
                        onClick={() => saveRow(req)}
                      >
                        Update Request
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ad-empty-state">
              <div className="ad-empty-text">No requests found</div>
            </div>
          )}
        </div>

        <IonToast
          isOpen={!!toastMsg}
          message={toastMsg}
          duration={2000}
          onDidDismiss={() => setToastMsg("")}
          position="top"
        />
      </IonContent>
    </IonPage>
  );
};

export default ApprovalDates;
