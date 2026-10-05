import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  IonPage,
  IonContent,
  IonIcon,
  IonToast
} from "@ionic/react";
import {
  ChevronLeft,
  FileText,
  Check,
  X,
  Calendar,
  MapPin,
  Search,
  RefreshCcw
} from "lucide-react";
import { useHistory } from "react-router-dom";
import { search, close, checkmarkCircle, chevronDown } from "ionicons/icons";
import moment from "moment";
import { API_BASE } from "../config";
import "./WorkReportDashboard.css";

type WorkReport = {
  WorkId?: string | number;
  EmpName?: string;
  ServiceType?: string;
  ClientProject?: string;
  Description?: string;
  WorkDate?: string;
  Status?: string;
  LPClass?: string;
  Color?: string;
  RawDate?: string;
  DateStatus?: string | number;
  TLRemark?: string;
  EmpCode?: string | number;
  [key: string]: any;
};

// Fast local month list generator (0ms instant generation)
const generateMonthList = (): string[] => {
  const months: string[] = [];
  const startYear = 2020;
  const current = moment().utcOffset("+05:30").add(1, "month");
  const currentYear = current.year();

  for (let y = currentYear; y >= startYear; y--) {
    const endMonth = y === currentYear ? current.month() : 11;
    for (let m = endMonth; m >= 0; m--) {
      months.push(moment().utcOffset("+05:30").year(y).month(m).format("MMM-YYYY"));
    }
  }
  return months;
};

const CACHE_REPORTS_PREFIX = "wr_team_reports_";
const CACHE_EMPLOYEES_KEY = "wr_employees_cache";

const getCachedData = <T,>(key: string): T | null => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const setCachedData = (key: string, data: any) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {}
};

const WorkReportDashboard: React.FC = () => {
  const history = useHistory();
  const baseUrl = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;

  // Parse active user from localStorage
  const { empCode, empName } = useMemo(() => {
    let code = "1520";
    let name = "User";
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.empCode || parsed.EmpCode) code = String(parsed.empCode || parsed.EmpCode);
        if (parsed.empName || parsed.EmpName) name = String(parsed.empName || parsed.EmpName);
      }
    } catch (e) {
      console.error("Error reading stored user:", e);
    }
    return { empCode: code, empName: name };
  }, []);

  const currentMonth = useMemo(() => moment().utcOffset("+05:30").format("MMM-YYYY"), []);
  const initialMonths = useMemo(() => generateMonthList(), []);

  // Initialize state with cache for 0ms instant display
  const cachedInitialReports = useMemo(() => {
    return getCachedData<WorkReport[]>(`${CACHE_REPORTS_PREFIX}${currentMonth}_${empCode}`) || [];
  }, [currentMonth, empCode]);

  const cachedEmployees = useMemo(() => {
    return getCachedData<any[]>(CACHE_EMPLOYEES_KEY) || [["0", "All Employees"]];
  }, []);

  const [loading, setLoading] = useState<boolean>(() => cachedInitialReports.length === 0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [monthYearList, setMonthYearList] = useState<string[]>(initialMonths);
  const [searchDate, setSearchDate] = useState<string>(currentMonth);
  const [workReports, setWorkReports] = useState<WorkReport[]>(cachedInitialReports);
  const [allWorkReports, setAllWorkReports] = useState<WorkReport[]>(cachedInitialReports);
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "danger">("success");

  const [periodOpen, setPeriodOpen] = useState<boolean>(false);
  const [periodPos, setPeriodPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 320 });
  const [employees, setEmployees] = useState<any[]>(cachedEmployees);
  const [selectedEmp, setSelectedEmp] = useState("All Employees");
  const [selectedEmpCode, setSelectedEmpCode] = useState("0");

  // Searchable employee dropdown states
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState<boolean>(false);
  const [employeeDropdownPos, setEmployeeDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 240 });
  const [empSearchTerm, setEmpSearchTerm] = useState<string>("");
  const empTriggerRef = useRef<HTMLDivElement | null>(null);
  const periodTriggerRef = useRef<HTMLDivElement | null>(null);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token")?.replace(/"/g, "");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // Format month query string (e.g. Sept-2026 -> Sep-2026)
  const formatMonthParam = (m: string) => {
    return m.startsWith("Sept-") ? m.replace("Sept-", "Sep-") : m;
  };

  // ================= LOAD REPORTS (WITH SWR CACHE) =================
  const fetchReportsForMonth = useCallback(
    async (month: string, targetEmpCode: string = selectedEmpCode, showSpinner: boolean = true) => {
      const cacheKey = `${CACHE_REPORTS_PREFIX}${month}_${empCode}`;
      const cached = getCachedData<WorkReport[]>(cacheKey);

      // Instant local cache render if available
      if (cached && cached.length > 0) {
        setAllWorkReports(cached);
        if (targetEmpCode === "0" || !targetEmpCode) {
          setWorkReports(cached);
        } else {
          setWorkReports(cached.filter((x) => String(x.EmpCode) === String(targetEmpCode)));
        }
        if (!showSpinner) setLoading(false);
      } else if (showSpinner) {
        setLoading(true);
      }

      try {
        const res = await axios.get(`${baseUrl}/Workreport/Load_WorkReport_Team`, {
          params: {
            EmpCode: empCode,
            SearchDate: formatMonthParam(month),
          },
          headers: getAuthHeaders(),
          timeout: 10000,
        });

        const rawData = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
        const dataArr = Array.isArray(rawData) ? rawData : [];

        const reportData: WorkReport[] = dataArr.map((x: any) => ({
          WorkId: x?.[0] ?? "",
          EmpName: x?.[1] ?? "",
          ServiceType: x?.[2] ?? "",
          ClientProject: x?.[3] ?? "",
          Description: x?.[4] ?? "",
          WorkDate: x?.[5] ?? "",
          Status: x?.[6] || "Pending",
          LPClass: x?.[7] ?? "",
          Color: x?.[8] ?? "",
          RawDate: x?.[9] ?? "",
          DateStatus: x?.[12] ?? "",
          TLRemark: x?.[11] ?? "-",
          EmpCode: x?.[10] ?? "",
        }));

        // Cache the result for instant next access
        setCachedData(cacheKey, reportData);

        setAllWorkReports(reportData);
        if (targetEmpCode === "0" || !targetEmpCode) {
          setWorkReports(reportData);
        } else {
          setWorkReports(reportData.filter((x) => String(x.EmpCode) === String(targetEmpCode)));
        }
      } catch (err) {
        console.error("Fetch reports error:", err);
        if (!cached || cached.length === 0) {
          setAllWorkReports([]);
          setWorkReports([]);
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [baseUrl, empCode, getAuthHeaders, selectedEmpCode]
  );

  // ================= FAST INITIAL MOUNT =================
  useEffect(() => {
    let isMounted = true;

    // Fetch reports immediately (SWR: cache displays first, network updates in background)
    fetchReportsForMonth(currentMonth, "0", cachedInitialReports.length === 0);

    // Fetch employees in parallel (only if not already cached)
    const fetchEmployeesData = async () => {
      try {
        const empRes = await axios.get(`${baseUrl}/Employee/Load_Employees?SearchEmp=`, {
          headers: getAuthHeaders(),
          timeout: 8000,
        });

        if (isMounted && empRes?.data && Array.isArray(empRes.data)) {
          const filtered = empRes.data.filter((emp: any) => emp[0] !== "0");
          filtered.unshift(["0", "All Employees"]);
          setEmployees(filtered);
          setCachedData(CACHE_EMPLOYEES_KEY, filtered);
        }
      } catch (err) {
        console.warn("Load_Employees background fetch error:", err);
      }
    };

    // Fetch dynamic month list in background if needed
    const fetchMonthList = async () => {
      try {
        const myRes = await axios.get(`${baseUrl}/Workreport/Load_Workreport_MY`, {
          params: { EmpCode: empCode },
          headers: getAuthHeaders(),
          timeout: 6000,
        });

        if (isMounted && myRes?.data) {
          const parsedData = typeof myRes.data === "string" ? JSON.parse(myRes.data) : myRes.data;
          const arr: any[] = Array.isArray(parsedData) ? parsedData : [];
          const list: string[] = arr.map((x: any) => x[0]).filter(Boolean);
          if (list.length > 0) {
            setMonthYearList(list);
          }
        }
      } catch (err) {
        // Fallback to locally generated list
      }
    };

    fetchEmployeesData();
    fetchMonthList();

    return () => {
      isMounted = false;
    };
  }, [baseUrl, currentMonth, empCode, fetchReportsForMonth, getAuthHeaders, cachedInitialReports.length]);

  // ================= INSTANT CLIENT-SIDE FILTERING =================
  const handleEmployeeChange = (code: string) => {
    setSelectedEmpCode(code);

    const emp = employees.find((x: any) => String(x[0]) === code);
    setSelectedEmp(emp ? emp[1] : (code === "0" ? "All Employees" : code));

    if (code === "0" || !code) {
      setWorkReports(allWorkReports);
    } else {
      setWorkReports(allWorkReports.filter((x) => String(x.EmpCode) === code));
    }
  };

  const handleMonthChange = (value: string) => {
    setSearchDate(value);
    fetchReportsForMonth(value, selectedEmpCode, true);
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchReportsForMonth(searchDate, selectedEmpCode, false);
  };

  // ================= OPTIMISTIC APPROVE / REJECT =================
  const updateWorkReportStatus = async (
    workId: string | number,
    status: string
  ) => {
    if (!workId) return;
    const strWorkId = String(workId);

    try {
      setUpdatingStatus((p) => ({ ...p, [strWorkId]: true }));

      const statusColor = status === "Approved" ? "#10b981" : status === "Rejected" ? "#ef4444" : "#f59e0b";

      // 1. Instant local optimistic update
      const updateList = (list: WorkReport[]) =>
        list.map((item) => {
          const id = item.WorkId ?? item.workId;
          if (String(id) === strWorkId) {
            return { ...item, Status: status, Color: statusColor };
          }
          return item;
        });

      setWorkReports((prev) => updateList(prev));
      setAllWorkReports((prev) => {
        const updated = updateList(prev);
        setCachedData(`${CACHE_REPORTS_PREFIX}${searchDate}_${empCode}`, updated);
        return updated;
      });

      // 2. Background API call
      await axios.get(`${baseUrl}/Workreport/update_WR_Permission`, {
        params: {
          Wrid: workId,
          Status: status,
          EmpCode: empCode,
        },
        headers: getAuthHeaders(),
      });

      setToastType("success");
      setToastMessage(`Work report ${status.toLowerCase()} successfully!`);
      setShowToast(true);
    } catch (err: any) {
      console.error("Status Update Error:", err);
      setToastType("danger");
      setToastMessage("Failed to update status. Reverting changes.");
      setShowToast(true);
      fetchReportsForMonth(searchDate, selectedEmpCode, false);
    } finally {
      setUpdatingStatus((p) => {
        const n = { ...p };
        delete n[strWorkId];
        return n;
      });
    }
  };

  const filteredEmployees = useMemo(() => {
    const term = empSearchTerm.toLowerCase().trim();
    if (!term) return employees;
    return employees.filter((emp) => {
      const id = String(emp[0]).toLowerCase();
      let name = String(emp[1]);
      if (name.startsWith(emp[0] + "-")) {
        name = name.replace(emp[0] + "-", "").trim();
      }
      return name.toLowerCase().includes(term) || id.includes(term);
    });
  }, [employees, empSearchTerm]);

  // Position calculation for dropdowns
  useEffect(() => {
    if (isEmployeeDropdownOpen && empTriggerRef.current) {
      const rect = empTriggerRef.current.getBoundingClientRect();
      setEmployeeDropdownPos({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 240),
      });
    }
  }, [isEmployeeDropdownOpen]);

  useEffect(() => {
    if (periodOpen && periodTriggerRef.current) {
      const rect = periodTriggerRef.current.getBoundingClientRect();
      setPeriodPos({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 200),
      });
    }
  }, [periodOpen]);

  return (
    <IonPage>
      <IonContent className="ion-padding" style={{ "--background": "var(--ion-background-color, #f6f7fb)" }}>
        <div className="wr-container team-report-view">
          
          {/* Header */}
          <div className="page-wr-header">
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()} title="Go Back">
                <ChevronLeft size={22} color="white" />
              </button>
              <div>
                <h1 className="page-wr-title">Team Reports</h1>
                <p className="page-wr-subtitle">Review work reports</p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <button 
                className="team-refresh-btn"
                onClick={handleManualRefresh}
                title="Refresh Reports"
              >
                <RefreshCcw size={18} className={isRefreshing ? "spin-icon" : ""} />
              </button>
            </div>
          </div>

          {/* Top 2-Column Filters (Exact Match to User Reference) */}
          <div className="wr-top-filters-row">
            {/* Employee Filter */}
            <div className="wr-filter-col">
              <label className="wr-filter-label">EMPLOYEE</label>
              <div
                ref={empTriggerRef}
                className={`wr-filter-trigger ${isEmployeeDropdownOpen ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setPeriodOpen(false);
                  setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen);
                }}
              >
                <span className="wr-filter-trigger-text">
                  {selectedEmp || "All Employees"}
                </span>
                <IonIcon icon={chevronDown} className="wr-filter-arrow" />
              </div>
            </div>

            {/* Period Filter */}
            <div className="wr-filter-col">
              <label className="wr-filter-label">PERIOD</label>
              <div
                ref={periodTriggerRef}
                className={`wr-filter-trigger ${periodOpen ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEmployeeDropdownOpen(false);
                  setPeriodOpen(!periodOpen);
                }}
              >
                <span className="wr-filter-trigger-text">
                  {searchDate || "Select Month"}
                </span>
                <IonIcon icon={chevronDown} className="wr-filter-arrow" />
              </div>
            </div>
          </div>

          {/* Employee Dropdown Portal */}
          {isEmployeeDropdownOpen && createPortal(
            <>
              <div
                className="dropdown-outside-click-layer"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEmployeeDropdownOpen(false);
                }}
              />
              <div
                className="custom-inline-dropdown"
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: `${employeeDropdownPos.top}px`,
                  left: `${employeeDropdownPos.left}px`,
                  width: `${employeeDropdownPos.width}px`,
                }}
              >
                <div className="dropdown-search-sec">
                  <IonIcon icon={search} className="dropdown-search-icon" />
                  <input
                    type="text"
                    className="dropdown-pure-input"
                    placeholder="Search name or ID..."
                    value={empSearchTerm}
                    onChange={(e) => setEmpSearchTerm(e.target.value)}
                    autoFocus
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                  {empSearchTerm && (
                    <button
                      className="dropdown-clear-btn"
                      onClick={() => setEmpSearchTerm("")}
                    >
                      <IonIcon icon={close} />
                    </button>
                  )}
                </div>

                <div className="dropdown-body">
                  {filteredEmployees.map((emp, index) => {
                    const empId = String(emp[0]);
                    let name = String(emp[1]);
                    if (name.startsWith(empId + "-")) {
                      name = name.replace(empId + "-", "").trim();
                    }
                    const isSelected = selectedEmpCode === empId;
                    const cleanNameForInitials = name.includes("-")
                      ? name.split("-").slice(1).join("-").trim()
                      : name;
                    const initials = (cleanNameForInitials.charAt(0) || "?").toUpperCase();

                    return (
                      <div
                        key={index}
                        className={`dropdown-emp-item ${isSelected ? "selected" : ""}`}
                        onClick={() => {
                          handleEmployeeChange(empId);
                          setIsEmployeeDropdownOpen(false);
                          setEmpSearchTerm("");
                        }}
                      >
                        <div className={`dr-avatar grad-${(parseInt(empId) % 5) || 0}`}>
                          {initials}
                        </div>
                        <div className="dr-info">
                          <span className="dr-name">{name}</span>
                          <span className="dr-id">{empId === "0" ? "Show All" : `ID: ${empId}`}</span>
                        </div>
                        {isSelected && <IonIcon icon={checkmarkCircle} className="dr-check" />}
                      </div>
                    );
                  })}
                  {filteredEmployees.length === 0 && (
                    <div className="dr-no-results">
                      <p>No matches for "{empSearchTerm}"</p>
                    </div>
                  )}
                </div>
              </div>
            </>,
            document.body
          )}

          {/* Period Dropdown Portal */}
          {periodOpen && createPortal(
            <>
              <div
                className="dropdown-outside-click-layer"
                onClick={(e) => {
                  e.stopPropagation();
                  setPeriodOpen(false);
                }}
              />
              <div
                className="custom-inline-dropdown"
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: `${periodPos.top}px`,
                  left: `${periodPos.left}px`,
                  width: `${periodPos.width}px`,
                }}
              >
                <div className="dropdown-body" style={{ maxHeight: "280px" }}>
                  {monthYearList.map((item, i) => {
                    const isSelected = item === searchDate;
                    return (
                      <div
                        key={i}
                        className={`dropdown-emp-item ${isSelected ? "selected" : ""}`}
                        onClick={() => {
                          handleMonthChange(item);
                          setPeriodOpen(false);
                        }}
                        style={{ padding: "12px 16px" }}
                      >
                        <div className="dr-info">
                          <span className="dr-name" style={{ fontWeight: isSelected ? 800 : 500 }}>
                            {item}
                          </span>
                        </div>
                        {isSelected && <IonIcon icon={checkmarkCircle} className="dr-check" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>,
            document.body
          )}

          {/* Cards List Container */}
          <div className="wr-reports-list-container">
            {/* Skeletons only when loading with NO cache */}
            {loading && workReports.length === 0 && (
              <div className="wr-team-skeletons">
                {[1, 2, 3].map((k) => (
                  <div key={k} className="wr-skeleton-card">
                    <div className="wr-sk-row">
                      <div className="wr-sk-pill" style={{ width: "110px" }}></div>
                      <div className="wr-sk-pill" style={{ width: "90px" }}></div>
                      <div className="wr-sk-pill right" style={{ width: "80px" }}></div>
                    </div>
                    <div className="wr-sk-line" style={{ width: "40%" }}></div>
                    <div className="wr-sk-box"></div>
                  </div>
                ))}
              </div>
            )}

            {/* Render Cards */}
            {workReports.length > 0 && (
              <div className="wr-reports-list">
                {workReports.map((item, i) => {
                  const isPending = !item.Status || item.Status.toLowerCase() === "pending";
                  const isApproved = item.Status?.toLowerCase() === "approved";
                  const isRejected = item.Status?.toLowerCase() === "rejected";
                  const cardStatusClass = isApproved ? "accept-card" : isRejected ? "reject-card" : "pending-card";
                  const statusBg = item.Color || (isApproved ? "#10b981" : isRejected ? "#ef4444" : "#f59e0b");

                  return (
                    <React.Fragment key={item.WorkId || i}>
                      {(item.DateStatus === "1" || item.DateStatus === 1) && (
                        <div className="wr-group-date-divider">
                          <Calendar size={13} />
                          <span>{item.WorkDate}</span>
                        </div>
                      )}

                      <div className={`wr-premium-card ${cardStatusClass}`}>
                        {/* Header: Date, Location and Status */}
                        <div className="wr-premium-card-header">
                          <div className="wr-header-left">
                            <div className="wr-date-wrap">
                              <Calendar size={12} className="wr-header-icon" />
                              <span>{item.WorkDate}</span>
                            </div>
                            {item.ClientProject && (
                              <div className="wr-premium-location">
                                <MapPin size={12} className="wr-header-icon" />
                                <span>{item.ClientProject}</span>
                              </div>
                            )}
                          </div>

                          <div className="wr-status-wrap" style={{ backgroundColor: statusBg }}>
                            <span className="wr-status-dot"></span>
                            {item.Status || "PENDING"}
                          </div>
                        </div>

                        {/* Body: Title and Description with Action Buttons */}
                        <div className="wr-premium-card-body">
                          <h3 className="wr-premium-title">{item.EmpName}</h3>

                          <div className="wr-premium-desc-box">
                            <FileText size={14} className="wr-desc-icon" />
                            <p className="wr-premium-text">{item.Description || "No description provided."}</p>

                            {/* Action Buttons (Matches user reference) */}
                            {isPending && (
                              <div className="wr-team-actions">
                                <button
                                  className="wr-btn-icon-approve"
                                  onClick={() => updateWorkReportStatus(item.WorkId ?? "", "Approved")}
                                  disabled={updatingStatus[String(item.WorkId)]}
                                  title="Approve"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  className="wr-btn-icon-reject"
                                  onClick={() => updateWorkReportStatus(item.WorkId ?? "", "Rejected")}
                                  disabled={updatingStatus[String(item.WorkId)]}
                                  title="Reject"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {!loading && workReports.length === 0 && (
              <div className="wr-empty-state">
                <FileText className="wr-empty-icon" />
                <h3>No work reports found</h3>
                <p>There are no reports recorded for the selected employee and period.</p>
              </div>
            )}
          </div>
        </div>

        {/* Toast Notification */}
        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2000}
          color={toastType}
          position="bottom"
          style={{ "--border-radius": "12px", "--margin": "16px" }}
        />
      </IonContent>
    </IonPage>
  );
};

export default WorkReportDashboard;