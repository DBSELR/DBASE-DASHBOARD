// src/pages/AdminRequests.tsx
import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonContent,
  IonSelect,
  IonSelectOption,
  IonItem,
  IonSegment,
  IonSegmentButton,
  IonToast,
  IonLabel,
  IonIcon,
  IonSearchbar,
  IonModal,
  IonButton,
  IonButtons,
  IonTitle,
  IonList,
} from "@ionic/react";
import {
  checkmarkCircle,
  closeCircle,
  timeOutline,
  personOutline,
  calendarOutline,
  chatbubbleEllipsesOutline,
  layersOutline,
  searchOutline
} from "ionicons/icons";
import moment from "moment";
import { API_BASE } from "../config";
import "./AdminRequests.css";

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

const AdminRequests: React.FC = () => {
  const baseUrl = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;

  const [selectedTab, setSelectedTab] = useState<string>("leaves");
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [selectedEmpCode, setSelectedEmpCode] = useState<string>("");
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return moment().format("MMM-YYYY");
  });

  const [leaveData, setLeaveData] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [toastMessage, setToastMessage] = useState<string>("");
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastType, setToastType] = useState<"success" | "danger">("success");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (isSearchModalOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isSearchModalOpen]);

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

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const url = `${baseUrl}Employee/Load_Employees?SearchEmp=`;
        console.log("[AdminRequests] Loading employees from:", url);
        const res = await axios.get(url, {
          headers: getAuthHeaders(),
        });
        console.log("[AdminRequests] Employees load response:", res.status, res.data?.length);
        const mapped = res.data.map((emp: any[]) => ({
          id: emp[0]?.toString(),
          name: emp[1],
        }));

        if (!mapped.some((e: any) => e.id === "0")) {
          setEmployees([{ id: "0", name: "All Employees" }, ...mapped]);
        } else {
          setEmployees(mapped);
        }
        setSelectedEmpCode("0");
      } catch (error) {
        console.error("Error loading employees", error);
      }
    };
    loadEmployees();
  }, []);

  useEffect(() => {
    if (!selectedEmpCode) return;
    const list = generateMonthList();
    setMonths(list);
    const defaultMonth = list.find((m: string) => m === selectedMonth) || list[0];
    setSelectedMonth(defaultMonth);
    fetchLeaveData(selectedEmpCode, defaultMonth, selectedTab);
  }, [selectedEmpCode, selectedTab]);

  const fetchLeaveData = async (empCode: string, month: string, tab: string) => {
    if (!month) return;
    const leaveType = tab === "permissions" ? "Permission" : "Leave";
    const loggedInEmpCode = getUser()?.empCode || "";
    const url = `${baseUrl}Leave/loadrequests_leave_permission?Empcode=${loggedInEmpCode}&Seachdate=${month}&LType=${leaveType}`;
    console.log("[AdminRequests] Fetching leave data:", { url, empCode, month, tab });

    try {
      const res = await axios.get(url, { headers: getAuthHeaders() });
      console.log("[AdminRequests] Fetch leave data response:", res.status, res.data?.length);
      let result = res.data || [];

      if (empCode !== "0") {
        result = result.filter(
          (entry: any) => entry.empcode?.toString() === empCode.toString()
        );
      }

      // Local filtering for Tab/Segment
      if (tab === "permissions") {
        result = result.filter(
          (entry: any) => renderSafe(entry.ltype) === "Permission"
        );
      } else {
        result = result.filter(
          (entry: any) => renderSafe(entry.ltype) !== "Permission"
        );
      }

      // Sort by lid descending to show latest on top
      result.sort((a: any, b: any) => (b.lid || 0) - (a.lid || 0));

      setLeaveData(result);
    } catch (err) {
      console.error("Error fetching leave data", err);
      setLeaveData([]);
    }
  };

  const updateLeaveStatus = async (entry: any, status: "accepted" | "rejected") => {
    const payload = {
      RequestId: entry.lid?.toString(),
      Status: status.charAt(0).toUpperCase() + status.slice(1),
    };

    const url = `${baseUrl}Leave/update_Leave_Permission`;
    console.log("[AdminRequests] Updating leave status:", { url, payload });

    try {
      const res = await axios.post(url, payload, {
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      });
      console.log("[AdminRequests] Update response:", res.status, res.data);
      setToastMessage(`Request ${status} successfully`);
      setToastType("success");
      fetchLeaveData(selectedEmpCode, selectedMonth, selectedTab);
    } catch (error) {
      setToastMessage(`Failed to ${status} request`);
      setToastType("danger");
    } finally {
      setShowToast(true);
    }
  };

  const renderSafe = (val: any) => (typeof val === "string" ? val : "");

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <IonPage>


      <IonContent className="admin-requests-container">
        <div className="view-section ion-padding">
          <div className="lr-trendy-header premium-trendy-bg" >


            <h2 className="admin-header-title">Admin Requests</h2>
          </div>
          <IonSegment
            value={selectedTab}
            onIonChange={(e) => setSelectedTab(e.detail.value as string)}
            className="custom-segment"
          >
            <IonSegmentButton value="leaves">
              <IonLabel>Leaves</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="permissions">
              <IonLabel>Permissions</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          <div className="filters-grid">
            <div className="custom-dropdown-container" ref={triggerRef}>
              <div
                className={`premium-filter-trigger ${isSearchModalOpen ? 'active' : ''}`}
                onClick={() => setIsSearchModalOpen(!isSearchModalOpen)}
              >
                <div className="trigger-content">
                  <div className="trigger-icon-box">
                    <IonIcon icon={personOutline} />
                  </div>
                  <div className="trigger-text-sec">
                    <span className="trigger-sub">Employee</span>
                    <span className="trigger-main">
                      {employees.find(e => e.id === selectedEmpCode)?.name || "Select Employee"}
                    </span>
                  </div>
                </div>
                <IonIcon icon={layersOutline} className="trigger-icon-arrow" />
              </div>

              {isSearchModalOpen && createPortal(
                <>
                  <div className="dropdown-outside-click-layer" onClick={() => setIsSearchModalOpen(false)} />
                  <div
                    className="custom-inline-dropdown"
                    style={{
                      position: 'absolute',
                      top: `${dropdownPos.top}px`,
                      left: `${dropdownPos.left}px`,
                      width: `${dropdownPos.width}px`
                    }}
                  >
                    <div className="dropdown-search-sec">
                      <IonIcon icon={searchOutline} className="dropdown-search-icon" />
                      <input
                        type="text"
                        className="dropdown-pure-input"
                        placeholder="Search name or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                      />
                      {searchTerm && (
                        <button className="dropdown-clear-btn" onClick={() => setSearchTerm("")}>
                          <IonIcon icon={closeCircle} />
                        </button>
                      )}
                    </div>

                    <div className="dropdown-body">
                      {filteredEmployees.map((emp) => {
                        const isSelected = selectedEmpCode === emp.id;

                        // Extract actual name by removing ID prefix (e.g., 1501-NAME)
                        const nameWithoutId = emp.name.includes("-") ? emp.name.split("-")[1].trim() : emp.name;
                        const initials = nameWithoutId.charAt(0).toUpperCase();

                        return (
                          <div
                            key={emp.id}
                            className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedEmpCode(emp.id);
                              setIsSearchModalOpen(false);
                              setSearchTerm("");
                            }}
                          >
                            <div className={`dr-avatar grad-${(parseInt(emp.id) % 5) || 0}`}>
                              {emp.id === "0" ? <IonIcon icon={layersOutline} /> : initials}
                            </div>
                            <div className="dr-info">
                              <span className="dr-name">{emp.name}</span>
                              <span className="dr-id">{emp.id === "0" ? "Global" : `ID: ${emp.id}`}</span>
                            </div>
                            {isSelected && <IonIcon icon={checkmarkCircle} className="dr-check" />}
                          </div>
                        );
                      })}
                      {filteredEmployees.length === 0 && (
                        <div className="dr-no-results">
                          <p>No matches for "{searchTerm}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>,
                document.body
              )}
            </div>

            <div className="custom-dropdown-container">
              <div className="premium-filter-trigger">
                <div className="trigger-content">
                  <div className="trigger-icon-box">
                    <IonIcon icon={calendarOutline} />
                  </div>
                  <div className="trigger-text-sec">
                    <span className="trigger-sub">Period</span>
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
                    const newMonth = e.detail.value;
                    setSelectedMonth(newMonth);
                    fetchLeaveData(selectedEmpCode, newMonth, selectedTab);
                  }}
                >
                  {months.map((month) => (
                    <IonSelectOption key={month} value={month}>
                      {month}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </div>
            </div>
          </div>

          <div className="status-filter-bar">
            {["All", "Pending", "Accepted", "Rejected"].map((status) => (
              <button
                key={status}
                className={`filter-btn ${statusFilter === status ? 'active' : ''} btn-${status.toLowerCase()}`}
                onClick={() => setStatusFilter(status)}
              >
                <IonIcon
                  icon={
                    status === "Accepted" ? checkmarkCircle :
                      status === "Rejected" ? closeCircle :
                        status === "Pending" ? timeOutline :
                          layersOutline
                  }
                />
                {status}
              </button>
            ))}
          </div>

          <div className="reports-display">
            {leaveData
              .filter(entry =>
                statusFilter === "All" ||
                renderSafe(entry.L_status).toLowerCase() === statusFilter.toLowerCase()
              )
              .length > 0 ? (
              leaveData
                .filter(entry =>
                  statusFilter === "All" ||
                  renderSafe(entry.L_status).toLowerCase() === statusFilter.toLowerCase()
                )
                .map((entry: any, index: number) => {
                  const status = renderSafe(entry.L_status).toLowerCase();
                  return (
                    <div key={entry.lid || index} className="modern-report-card">
                      <div
                        className={`card-side-indicator indicator-${status}`}
                      />

                      <div className="card-header">
                        <div className="emp-profile-sec">
                          <div className="avatar-mini">
                            <IonIcon icon={personOutline} />
                          </div>
                          <div className="emp-details">
                            <span className="emp-name">{renderSafe(entry.Empname)}</span>
                            <span className="emp-id-sub">Emp ID: {entry.empcode}</span>
                          </div>
                        </div>
                        <div className={`status-pill status-${status}`}>
                          <IonIcon icon={status === "accepted" ? checkmarkCircle : status === "rejected" ? closeCircle : timeOutline} />
                          <span>{renderSafe(entry.L_status)}</span>
                        </div>
                      </div>

                      <div className="card-info-grid">
                        <div className="info-item">
                          <IonIcon icon={calendarOutline} className="info-icon" />
                          <div className="info-content">
                            <span className="info-label">Period</span>
                            <span className="info-value">
                              {renderSafe(entry.lfrom)} {entry.lto && typeof entry.lto === 'string' ? `- ${entry.lto}` : ""}
                            </span>
                          </div>
                        </div>

                        {typeof entry.Ptime === "string" && entry.Ptime && (
                          <div className="info-item">
                            <IonIcon icon={timeOutline} className="info-icon" />
                            <div className="info-content">
                              <span className="info-label">Session</span>
                              <span className="info-value">{entry.Ptime}</span>
                            </div>
                          </div>
                        )}

                        <div className="info-item full-width">
                          <IonIcon icon={chatbubbleEllipsesOutline} className="info-icon" />
                          <div className="info-content">
                            <span className="info-label">Remarks</span>
                            <span className="info-value remarks-value">
                              {renderSafe(entry.Remarks) || "No reason provided"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {status === "pending" && (
                        <div className="card-actions-premium">
                          <button className="premium-btn btn-reject" onClick={() => updateLeaveStatus(entry, "rejected")}>
                            <IonIcon icon={closeCircle} />
                            REJECT
                          </button>
                          <button className="premium-btn btn-approve" onClick={() => updateLeaveStatus(entry, "accepted")}>
                            <IonIcon icon={checkmarkCircle} />
                            APPROVE
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
            ) : (
              <div className="empty-state-modern">
                <div className="empty-icon">
                  <IonIcon icon={layersOutline} />
                </div>
                <p>No requests found for this period.</p>
              </div>
            )}
          </div>

          <IonToast
            isOpen={showToast}
            onDidDismiss={() => setShowToast(false)}
            message={toastMessage}
            color={toastType}
            duration={2000}
            position="top"
          />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AdminRequests;
