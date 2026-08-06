import React, { useEffect, useState, useMemo, useRef } from "react";
import { useHistory } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  IonContent,
  IonPage,
  IonIcon,
  IonSpinner,
  IonToast,
  useIonAlert
} from "@ionic/react";
import {
  arrowBackOutline,
  calendarOutline,
  timeOutline,
  locationOutline,
  alarmOutline,
  documentTextOutline,
  searchOutline,
  closeCircle,
  checkmarkCircle,
  layersOutline,
  informationCircleOutline,
  chevronDown
} from "ionicons/icons";
import axios from "axios";
import moment from "moment";
import { API_BASE } from "../config";
import "./PendingRequests.css";

/* ---------------- helpers ---------------- */
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

const generateMonthList = () => {
  const months: string[] = [];
  const startYear = 2024;
  const current = moment().add(1, "month");
  const currentYear = current.year();

  for (let y = currentYear; y >= startYear; y--) {
    const endMonth = y === currentYear ? current.month() : 11;
    for (let m = endMonth; m >= 0; m--) {
      months.push(moment().year(y).month(m).format("MMM-YYYY"));
    }
  }
  return months;
};

const safeStr = (v: any) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return "";
  return String(v);
};

const TYPES = [
  { value: "leave", label: "Pending Leaves", icon: calendarOutline },
  { value: "permission", label: "Pending Permissions", icon: timeOutline },
  { value: "workreport", label: "Pending WorkReports", icon: documentTextOutline },
  { value: "onduty", label: "Pending OnDuty", icon: locationOutline },
  { value: "overtime", label: "Pending Overtime", icon: alarmOutline },
];

const PendingRequests: React.FC = () => {
  const history = useHistory();
  const loggedInUser = useMemo(() => getUser(), []);
  const [presentAlert] = useIonAlert();

  // Filters & State
  const [months] = useState<string[]>(generateMonthList());
  const [selectedMonth, setSelectedMonth] = useState<string>(
    moment().format("MMM-YYYY")
  );
  const [activeType, setActiveType] = useState<string>("leave");
  const [statusFilter, setStatusFilter] = useState<string>("Pending"); // Show pending by default
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [requests, setRequests] = useState<any[]>([]);

  // Custom Dropdown State
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 140 });

  const toggleDropdown = (e: React.MouseEvent<any>) => {
    if (dropdownOpen) {
      setDropdownOpen(false);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
        width: rect.width
      });
      setDropdownOpen(true);
    }
  };

  // Toast State
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastColor, setToastColor] = useState<"success" | "danger" | "warning">("success");

  const showToast = (msg: string, color: "success" | "danger" | "warning" = "success") => {
    setToastMsg(msg);
    setToastColor(color);
    setToastOpen(true);
  };

  // Load pending approvals when filters change
  useEffect(() => {
    loadPendingRequests();
  }, [selectedMonth, activeType]);

  const loadPendingRequests = async () => {
    setLoading(true);
    const empCode = loggedInUser?.empCode || loggedInUser?.EmpCode;
    if (!empCode) {
      setLoading(false);
      return;
    }

    try {
      const baseUrl = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;
      let flag = "";
      if (activeType === "leave") flag = "LEAVES";
      else if (activeType === "permission") flag = "PERMISSIONS";
      else if (activeType === "onduty") flag = "ON DUTY";
      else if (activeType === "overtime") flag = "OVERTIME";
      else if (activeType === "workreport") flag = "WORKREPORTS";

      const url = `${baseUrl}ApprovalRequest/GetPendingApprovals?monthYear=${selectedMonth}&flag=${flag}`;
      const res = await axios.get(url, { headers: getAuthHeaders() });
      const dataList = Array.isArray(res.data) ? res.data : [];
      setRequests(dataList);
    } catch (err) {
      console.error("Error loading pending requests:", err);
      showToast("Failed to load pending requests.", "danger");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  // Normalization logic for Grid Rows to support standard UI card rendering
  const normalizeRow = (x: any) => {
    if (!x) return null;

    if (activeType === "leave" || activeType === "permission") {
      // Keys from SP: EMPCODE, EMPNAME, Designation, LFrom, LTo, Days, PTime, LType, AppliedOn, L_Status, LID, PendingRA, etc.
      // Or keys from standard Load_Leave_Permission API mapping
      const id = x.LID || x.lid || (Array.isArray(x) ? x[0] : "");
      const empCode = x.EMPCODE || x.empcode || (Array.isArray(x) ? x[1] : "");
      const empName = x.EMPNAME || x.Empname || (Array.isArray(x) ? x[12] : "Unknown");
      const designation = x.Designation || x.designation || "";
      const from = moment(x.LFrom || x.lfrom || (Array.isArray(x) ? x[2] : "")).format("DD-MM-YYYY");
      const to = moment(x.LTo || x.lto || (Array.isArray(x) ? x[3] : "")).format("DD-MM-YYYY");
      const days = x.Days || x.days || (Array.isArray(x) ? x[8] : 0);
      const minutes = x.PTime || x.ptime || (Array.isArray(x) ? x[5] : 0);
      const typeDisp = x.LType || x.ltype || (Array.isArray(x) ? x[6] : "");
      const status = safeStr(x.L_Status || x.L_status || (Array.isArray(x) ? x[7] : "Pending"));
      const remarks = safeStr(x.Remarks || x.remarks || (Array.isArray(x) ? x[9] : ""));
      const pendingRA = x.PendingAt || x.pendingAt || x.PendingRA || x.pendingRA || "";

      let statusClass = "pending";
      const lStatus = status.toLowerCase();
      if (lStatus.includes("accepted") || lStatus.includes("approved")) {
        statusClass = "approved";
      } else if (lStatus.includes("rejected")) {
        statusClass = "rejected";
      }

      return {
        id,
        empCode,
        empName,
        designation,
        from,
        to,
        isSameDay: from === to,
        days,
        minutes,
        typeDisp,
        status,
        remarks,
        statusClass,
        pendingRA,
        raw: x
      };
    }

    if (activeType === "workreport") {
      // Keys from SP: STAFFID, EMPNAME, DESIGNATION, WDATE, CLIENT_NAME, PROJECT_NAME, CLIENT_PROJECT, SERVICE_TYPE, WDESCRIPTION, WSTATUS, PENDINGAT, WorkId
      const id = x.WorkId || x.workId || x.wrid || (Array.isArray(x) ? x[0] : "");
      const empCode = x.STAFFID || x.staffId || (Array.isArray(x) ? x[1] : "");
      const empName = x.EMPNAME || x.empName || (Array.isArray(x) ? x[1] : "Unknown");
      const designation = x.DESIGNATION || x.designation || "";
      const date = moment(x.WDATE || x.wdate || (Array.isArray(x) ? x[5] : "")).format("DD-MM-YYYY");
      const clientProject = x.CLIENT_PROJECT || x.client_Project || (Array.isArray(x) ? x[3] : "");
      const description = x.WDESCRIPTION || x.wDescription || (Array.isArray(x) ? x[4] : "");
      const status = safeStr(x.WSTATUS || x.wStatus || (Array.isArray(x) ? x[6] : "Pending"));
      const pendingAt = x.PENDINGAT || x.pendingAt || "";

      let statusClass = "pending";
      const lStatus = status.toLowerCase();
      if (lStatus.includes("approved") || lStatus.includes("accepted")) {
        statusClass = "approved";
      } else if (lStatus.includes("rejected")) {
        statusClass = "rejected";
      }

      return {
        id,
        empCode,
        empName,
        designation,
        from: date,
        to: date,
        isSameDay: true,
        days: 1,
        minutes: 0,
        typeDisp: "Work Report",
        status,
        remarks: description,
        statusClass,
        pendingRA: pendingAt,
        clientProject,
        raw: x
      };
    }

    if (activeType === "onduty") {
      // Format matching On Duties Team card
      const id = x.id || x.lid || "";
      const empCode = x.EMPCODE || x.empcode || "";
      const mainName = x.EMPNAME || x.empname || "Unknown";
      const groupNames = x.EmpNames || x.empNames || "";
      const empName = groupNames ? `${mainName} (${groupNames})` : mainName;
      const from = moment(x.DateFrom || x.dateFrom).format("DD-MM-YYYY");
      const to = moment(x.DateTo || x.dateTo).format("DD-MM-YYYY");
      const college = x.College || x.college || "";
      const description = x.Description || x.description || "";
      const mode = x.Mode_of_trans || x.mode || x.Mode_of_Trans || "";
      const vehicle = x.Vehicle_No || x.vehicle_No || "";
      const location = x.Location || x.location || "";
      const status = safeStr(x.Status || x.status || x.L_status || "Pending");
      const pendingRA = x.PendingAt || x.PendingRA || x.CurrentRA || "";

      let statusClass = "pending";
      const lStatus = status.toLowerCase();
      if (lStatus.includes("approved") || lStatus.includes("accepted")) {
        statusClass = "approved";
      } else if (lStatus.includes("rejected")) {
        statusClass = "rejected";
      }

      return {
        id,
        empCode,
        empName,
        designation: x.Designation || "Team Member",
        from,
        to,
        isSameDay: from === to,
        days: 1,
        minutes: 0,
        typeDisp: `On Duty - ${location}`,
        status,
        remarks: `${college ? "[" + college + "] " : ""}${description} (Via ${mode} ${vehicle ? "#" + vehicle : ""})`,
        statusClass,
        pendingRA,
        raw: x
      };
    }

    if (activeType === "overtime") {
      // Array format or object format from SP
      const isArr = Array.isArray(x);
      const id = isArr ? x[0] : (x.Id || x.id || x.lid || "");
      const empCode = isArr ? x[1] : (x.EMPCODE || x.empcode || "");
      const empName = isArr ? x[2] : (x.EMPNAME || x.Empname || x.empName || "Unknown");
      const from = moment(isArr ? x[3] : (x.Date || x.date || x.lfrom)).format("DD-MM-YYYY");
      const college = isArr ? x[4] : (x.College || x.college || "");
      const fromTime = isArr ? x[5] : (x.Fromtime || x.fromTime || "");
      const toTime = isArr ? x[6] : (x.Totime || x.toTime || "");
      const remarks = isArr ? x[7] : (x.Description || x.description || x.Remarks || x.remarks || "");
      const durationMin = isArr ? x[8] : (x.OT_MIN || x.MinDiff || x.duration || 0);
      const status = safeStr(isArr ? x[23] : (x.Status || x.status || x.L_status || "Pending"));
      const pendingRA = isArr ? x[13] : (x.PendingAt || x.PendingRA || x.CurrentRA || "");

      let statusClass = "pending";
      const lStatus = status.toLowerCase();
      if (lStatus.includes("approved") || lStatus.includes("accepted")) {
        statusClass = "approved";
      } else if (lStatus.includes("rejected")) {
        statusClass = "rejected";
      }

      return {
        id,
        empCode,
        empName,
        designation: x.Designation || "Team Member",
        from,
        to: from,
        isSameDay: true,
        days: 0,
        minutes: durationMin,
        typeDisp: `Overtime - ${college}`,
        status,
        remarks: `${remarks} (${fromTime} to ${toTime})`,
        statusClass,
        pendingRA,
        raw: x
      };
    }

    return null;
  };

  // Perform Approve/Reject action on a request
  const handleAction = async (item: any, isApprove: boolean) => {
    const actionLabel = isApprove ? "Approve" : "Reject";
    const statusText = isApprove ? "Accepted" : "Rejected";

    presentAlert({
      header: `Confirm ${actionLabel}`,
      message: `Are you sure you want to ${actionLabel.toLowerCase()} this request for ${item.empName}?`,
      buttons: [
        { text: "Cancel", role: "cancel" },
        {
          text: "Yes, Confirm",
          handler: async () => {
            setLoading(true);
            try {
              const baseUrl = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;

              if (activeType === "leave" || activeType === "permission") {
                await axios.post(
                  `${baseUrl}Permission/update_Leave_Permission`,
                  {
                    RequestId: String(item.id),
                    Status: statusText,
                    EmpCode: loggedInUser?.empCode || loggedInUser?.EmpCode,
                  },
                  { headers: getAuthHeaders() }
                );
              } else if (activeType === "workreport") {
                const finalStatus = isApprove ? "Approved" : "Rejected";
                await axios.get(
                  `${baseUrl}Workreport/update_WR_Permission?Wrid=${encodeURIComponent(
                    item.id
                  )}&Status=${encodeURIComponent(finalStatus)}&EmpCode=${encodeURIComponent(
                    item.empCode
                  )}`,
                  { headers: getAuthHeaders() }
                );
              } else if (activeType === "onduty") {
                const onDutyStatus = isApprove ? "APPROVE" : "REJECT";
                await axios.post(
                  `${baseUrl}OnDuty/approve_onduty`,
                  {
                    _id: String(item.id),
                    Status: onDutyStatus,
                    _empcode: loggedInUser?.designation || loggedInUser?.Designation || "Manager",
                  },
                  { headers: getAuthHeaders() }
                );
              } else if (activeType === "overtime") {
                await axios.post(
                  `${baseUrl}OverTime/UpdateOvertimeStatus`,
                  {
                    Id: Number(item.id),
                    Status: statusText,
                    EmpCode: loggedInUser?.empCode || loggedInUser?.EmpCode,
                    FinMinDiff: Number(item.minutes)
                  },
                  { headers: getAuthHeaders() }
                );
              }

              showToast(`Request ${statusText.toLowerCase()} successfully.`, "success");
              loadPendingRequests(); // Refresh the list
            } catch (err: any) {
              console.error("Action error:", err);
              const errMsg = err?.response?.data?.message || err?.message || "Action failed.";
              showToast(errMsg, "danger");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    });
  };

  // Filter requests based on status tab, employee name, or employee code
  const filteredRequests = useMemo(() => {
    let list = requests.map(normalizeRow).filter(Boolean);

    // 1. Status Filter
    if (statusFilter !== "All") {
      list = list.filter((r: any) => {
        const s = r.status.toLowerCase();
        const filter = statusFilter.toLowerCase();
        
        if (filter === "pending") return s.includes("pending");
        if (filter === "accepted") return s.includes("accepted") || s.includes("approved");
        if (filter === "rejected") return s.includes("rejected");
        return true;
      });
    }

    // 2. Text Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r: any) =>
          r.empName.toLowerCase().includes(q) ||
          String(r.empCode).toLowerCase().includes(q) ||
          r.typeDisp.toLowerCase().includes(q) ||
          r.remarks.toLowerCase().includes(q)
      );
    }

    return list;
  }, [requests, statusFilter, searchQuery, activeType]);

  return (
    <IonPage>
      <IonContent className="pr-page-content" fullscreen>
        
        {/* Hero Header Card */}
        <div className="pr-page-header-wrap">
          <div className="pr-header-left">
            <button className="pr-back-btn" onClick={() => history.goBack()}>
              <IonIcon icon={arrowBackOutline} style={{ color: "white", fontSize: "20px" }} />
            </button>
            <div>
              <span className="pr-subtitle-top">Manager Approvals Portal</span>
              <h1 className="pr-title-main">Pending Requests</h1>
            </div>
          </div>
          <div className="pr-header-right">
            <button
              className="pr-header-calendar-shortcut-btn"
              onClick={toggleDropdown}
            >
              <IonIcon icon={calendarOutline} />
            </button>
          </div>
        </div>

        {/* Category switcher tabs and inline date picker */}
        <div className="pr-tabs-filter-bar">
          {/* Row 1: Leaves, Pending Permissions, Pending Work Reports, Pending On Duty + Period Selector */}
          <div className="pr-tabs-row-1">
            <div className="pr-tabs-row-1-left">
              {TYPES.slice(0, 4).map((t) => (
                <button
                  key={t.value}
                  className={`pr-tab${activeType === t.value ? " active" : ""}`}
                  onClick={() => {
                    setActiveType(t.value);
                    setSearchQuery("");
                  }}
                >
                  <IonIcon icon={t.icon} className="pr-tab-icon" />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            <div
              className="pr-inline-period-card"
              onClick={toggleDropdown}
            >
              <div className="pr-period-left-icon-box">
                <IonIcon icon={calendarOutline} />
              </div>
              <div className="pr-period-middle-content">
                <span className="pr-period-label">PERIOD</span>
                <span className="pr-period-value">{selectedMonth}</span>
              </div>
              <div className="pr-period-right-icon-box">
                <IonIcon icon={layersOutline} />
              </div>
            </div>
          </div>

          {/* Row 2: Pending Overtime */}
          <div className="pr-tabs-row-2">
            {TYPES.slice(4).map((t) => (
              <button
                key={t.value}
                className={`pr-tab${activeType === t.value ? " active" : ""}`}
                onClick={() => {
                  setActiveType(t.value);
                  setSearchQuery("");
                }}
              >
                <IonIcon icon={t.icon} className="pr-tab-icon" />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>



        {/* Grid/List Body */}
        <div className="pr-list-container">
          {loading ? (
            <div className="pr-loader-container">
              <IonSpinner name="crescent" color="primary" />
              <span>Loading pending requests...</span>
            </div>
          ) : filteredRequests.length > 0 ? (
            filteredRequests.map((item: any, idx: number) => {
              const initials = (item.empName.charAt(0) || "?").toUpperCase();
              const showActions = item.status.toLowerCase().includes("pending");

              return (
                <div key={idx} className={`pr-history-card ${item.statusClass}`}>
                  <div className="pr-card-left-stripe" />
                  
                  <div className="pr-card-content">
                    
                    {/* User profile row */}
                    <div className="pr-card-user-row">
                      <div className="pr-user-avatar">
                        {initials}
                      </div>
                      <div className="pr-user-info">
                        <span className="pr-user-name">{item.empName}</span>
                        <span className="pr-user-details">ID: {item.empCode} • {item.designation}</span>
                      </div>
                      <div className={`pr-status-badge ${item.statusClass}`}>
                        {item.status}
                      </div>
                    </div>

                    {/* Details row */}
                    <div className={`pr-card-details-row ${activeType === "workreport" ? "pr-workreport-details" : ""}`}>
                      {activeType === "workreport" ? (
                        <>
                          <div className="pr-detail-item">
                            <span className="pr-detail-label">Client / Project</span>
                            <span className="pr-detail-value">{item.clientProject || "-"}</span>
                          </div>
                          <div className="pr-detail-item">
                            <span className="pr-detail-label">Date(s)</span>
                            <span className="pr-detail-value pr-date-value">
                              {item.from}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="pr-detail-item">
                            <span className="pr-detail-label">Type / Category</span>
                            <span className="pr-detail-value">{item.typeDisp}</span>
                          </div>

                          <div className="pr-detail-item">
                            <span className="pr-detail-label">Date(s)</span>
                            <span className="pr-detail-value pr-date-value">
                              {item.isSameDay ? item.from : `${item.from} to ${item.to}`}
                            </span>
                          </div>

                          <div className="pr-detail-item">
                            <span className="pr-detail-label">Duration</span>
                            <span className="pr-detail-value">
                              {item.minutes > 0 ? `${item.minutes} Mins` : `${item.days} Day(s)`}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Client / Project (If OnDuty and NOT workreport) */}
                    {activeType !== "workreport" && item.clientProject && (
                      <div className="pr-card-client-row">
                        <span className="pr-client-label">Client / Project:</span>
                        <span className="pr-client-value">{item.clientProject}</span>
                      </div>
                    )}

                    {/* Remarks description */}
                    {item.remarks && (
                      <div className="pr-card-remarks-box">
                        <span className="pr-remarks-label">Reason / Description:</span>
                        <p className="pr-remarks-text">{item.remarks}</p>
                      </div>
                    )}

                    {/* Pending at info */}
                    {item.pendingRA && (
                      <div className="pr-pending-info">
                        <IonIcon icon={informationCircleOutline} />
                        <span>Pending Approval At: <strong>{item.pendingRA}</strong></span>
                      </div>
                    )}



                  </div>
                </div>
              );
            })
          ) : (
            <div className="pr-empty-state">
              <div className="pr-empty-icon">📁</div>
              <h3 className="pr-empty-title">No Requests Found</h3>
              <p className="pr-empty-text">
                There are no {statusFilter.toLowerCase()} {activeType} requests for {selectedMonth}.
              </p>
            </div>
          )}
        </div>

        <IonToast
          isOpen={toastOpen}
          onDidDismiss={() => setToastOpen(false)}
          message={toastMsg}
          duration={2500}
          color={toastColor}
          position="top"
        />

        {/* Custom React Portal for Dropdown */}
        {dropdownOpen && createPortal(
          <>
            <div
              className="pr-dropdown-outside-click-layer"
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen(false);
              }}
            />
            <div
              className="pr-custom-dropdown"
              style={{
                position: "absolute",
                top: `${dropdownPos.top}px`,
                left: `${dropdownPos.left}px`,
                width: `${dropdownPos.width}px`
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pr-dropdown-body">
                {months.map((m, idx) => {
                  const isSelected = m === selectedMonth;
                  return (
                    <div
                      key={idx}
                      className={`pr-dropdown-item ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedMonth(m);
                        setDropdownOpen(false);
                      }}
                    >
                      <span>{m}</span>
                      {isSelected && <IonIcon icon={checkmarkCircle} className="pr-dropdown-check" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </>,
          document.body
        )}

      </IonContent>
    </IonPage>
  );
};

export default PendingRequests;
