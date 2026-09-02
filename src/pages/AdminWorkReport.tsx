// src/pages/AdminWorkReport.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  IonContent,
  IonHeader,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonToast,
  IonToolbar,
  IonLabel,
} from "@ionic/react";
import axios from "axios";
import moment from "moment";
import {
  Users,
  Calendar,
  CheckCircle2,
  XCircle,
  Briefcase,
  FileText,
  SearchX,
  UserCheck,
  ChevronLeft,
  MapPin,
  Check,
  X
} from "lucide-react";
import { useHistory } from "react-router-dom";
import { createPortal } from "react-dom";
import { IonIcon } from "@ionic/react";
import { chevronDown, search, close, checkmarkCircle } from "ionicons/icons";

// --------- helpers (inline, no new files) ---------
import { API_BASE } from "../config";
import "./AdminWorkReport.css";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token")?.replace(/"/g, "");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const generateMonthList = () => {
  const months: string[] = [];
  const startYear = 2014;
  const current = moment().utcOffset("+05:30").add(1, 'month');
  const currentYear = current.year();

  for (let y = currentYear; y >= startYear; y--) {
    const endMonth = y === currentYear ? current.month() : 11;
    for (let m = endMonth; m >= 0; m--) {
      months.push(moment().utcOffset("+05:30").year(y).month(m).format("MMM-YYYY"));
    }
  }
  return months;
};

// Normalize a row coming back either as object or array
const normalizeWR = (r: any) => {
  if (!r) return null;
  if (!Array.isArray(r)) {
    const t = (r.tClass || "").toString().toLowerCase();
    const colors =
      t === "green"
        ? { stripe: "#10b981", bg: "rgba(16, 185, 129, 0.05)", status: "green" }
        : t === "red"
          ? { stripe: "#ef4444", bg: "rgba(239, 68, 68, 0.05)", status: "red" }
          : { stripe: "#f59e0b", bg: "rgba(245, 158, 11, 0.05)", status: "orange" };

    return {
      WorkId: r.WorkId ?? r.wrid ?? r.id,
      Empname: r.Empname ?? r.empName ?? r.EmpName,
      Client_project: r.Client_project ?? r.client ?? r.project ?? "",
      Title: r.Title ?? r.title ?? "",
      WDescription: r.WDescription ?? r.description ?? "",
      wdate: r.wdate ?? r.date ?? r.WDate ?? "",
      DateStatus: r.DateStatus ?? "0",
      LPClass: r.LPClass ?? "",
      tClass: r.tClass ?? "",
      __colors: colors,
    };
  } else {
    const t = ((r[8] ?? r[7] ?? "").toString() || "").toLowerCase();
    const colors =
      t === "green"
        ? { stripe: "#10b981", bg: "rgba(16, 185, 129, 0.05)", status: "green" }
        : t === "red"
          ? { stripe: "#ef4444", bg: "rgba(239, 68, 68, 0.05)", status: "red" }
          : { stripe: "#f59e0b", bg: "rgba(245, 158, 11, 0.05)", status: "orange" };

    const empnameStr = String(r[1] || "");
    const rowEmpCode = empnameStr.includes("-") ? empnameStr.split("-")[0].trim() : "";

    return {
      WorkId: r[0],
      Empname: r[1],
      Client_project: r[3] ?? r[2],
      Title: r[2],
      WDescription: r[4],
      wdate: r[5],
      DateStatus: String(r[10] ?? "0"),
      LPClass: r[7] ?? "",
      tClass: r[8] ?? "",
      rowEmpCode,
      __colors: colors,
    };
  }
};

const AdminWorkReport: React.FC = () => {
  const [Seachdate, setSeachdate] = useState<string>("");
  const [SelectEmpcode, setSelectEmpcode] = useState<string>("All Employees");
  const [SelectEmp, setSelectEmp] = useState<string>("All Employees");

  const [dtworkreport, setDtworkreport] = useState<any[]>([]);
  const [dtmy, setDtmy] = useState<string[]>([]);
  const [dtEmpActive, setDtEmpActive] = useState<
    { EmpCode: string; EmpName: string; Designation?: string }[]
  >([]);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastColor, setToastColor] = useState<"success" | "danger" | "warning">("success");

  const history = useHistory();

  // Dropdown States
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [employeeDropdownPos, setEmployeeDropdownPos] = useState({ top: 0, left: 0, width: 240 });
  const [empSearchTerm, setEmpSearchTerm] = useState("");
  const empTriggerRef = React.useRef<HTMLDivElement>(null);

  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const [periodDropdownPos, setPeriodDropdownPos] = useState({ top: 0, left: 0, width: 240 });
  const periodTriggerRef = React.useRef<HTMLDivElement>(null);

  const currentMY = useMemo(() => moment().utcOffset("+05:30").format("MMM-YYYY"), []);

  useEffect(() => {
    if (isEmployeeDropdownOpen && empTriggerRef.current) {
      const rect = empTriggerRef.current.getBoundingClientRect();
      setEmployeeDropdownPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isEmployeeDropdownOpen]);

  useEffect(() => {
    if (isPeriodDropdownOpen && periodTriggerRef.current) {
      const rect = periodTriggerRef.current.getBoundingClientRect();
      setPeriodDropdownPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isPeriodDropdownOpen]);

  const filteredEmployees = dtEmpActive.filter(emp => 
    emp.EmpName.toLowerCase().includes(empSearchTerm.toLowerCase()) ||
    emp.EmpCode.toLowerCase().includes(empSearchTerm.toLowerCase())
  );

  useEffect(() => {
    bootstrap();
  }, []);

  const showToast = (m: string, c: "success" | "danger" | "warning" = "success") => {
    setToastMsg(m);
    setToastColor(c);
    setToastOpen(true);
  };

  const bootstrap = async () => {
    setSeachdate(currentMY);
    setDtmy(generateMonthList());
    await loadEmployeesActive();
    await loadWorkReport();
  };

  const loadEmployeesActive = async () => {
    try {
      const url = `${API_BASE}Employee/Load_Employees?SearchEmp=Active`;
      const r = await axios.get(url, { headers: getAuthHeaders() });
      let list = Array.isArray(r.data) ? r.data : [];
      list = list.map((x: any) =>
        Array.isArray(x)
          ? { EmpCode: x[0], EmpName: x[1], Designation: x[2] }
          : { EmpCode: x.EmpCode, EmpName: x.EmpName, Designation: x.Designation }
      );
      list = list.filter((xx: any) => (xx.Designation || "").toLowerCase() !== "director");
      list.unshift({ EmpCode: "All Employees", EmpName: "All Employees" });
      setDtEmpActive(list);
    } catch (e) {
      setDtEmpActive([{ EmpCode: "All Employees", EmpName: "All Employees" }]);
    }
  };

  const loadWorkReport = async () => {
    try {
      const params = new URLSearchParams({
        EmpCode: SelectEmpcode || "All Employees",
        SearchDate: Seachdate || currentMY,
      });
      const url = `${API_BASE}Workreport/Load_WorkReport?${params.toString()}`;
      const r = await axios.get(url, { headers: getAuthHeaders() });
      const rows = Array.isArray(r.data) ? r.data : [];
      setDtworkreport(rows);
      if (!rows.length) showToast("No records found for this selection.", "warning");
    } catch (e) {
      setDtworkreport([]);
      showToast("Failed to load work reports.", "danger");
    }
  };

  const updateWorkStatus = async (item: any, status: "Approved" | "Rejected") => {
    try {
      const wrid = item.WorkId;
      const emp = item.rowEmpCode || SelectEmpcode;

      const url = `${API_BASE}Workreport/update_WR_Permission?Wrid=${encodeURIComponent(
        wrid
      )}&Status=${encodeURIComponent(status)}&EmpCode=${encodeURIComponent(emp)}`;
      const r = await axios.get(url, { headers: getAuthHeaders() });

      const rows = Array.isArray(r.data) ? r.data : [];
      setDtworkreport(rows);

      showToast(
        status === "Approved" ? "Report approved successfully." : "Report rejected successfully.",
        "success"
      );
    } catch (e) {
      showToast("Failed to update report status.", "danger");
    }
  };


  return (
    <IonPage className="admin-report-page">


      <IonContent className="admin-content" fullscreen>
        {/* Modern Filter Card */}
        <div className="work-dashboard">
          
          <div className="dashboard-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
            <div className="page-wr-header" style={{ width: '100%' }}>
              <div className="page-wr-header-left">
                <button className="page-wr-back-btn" onClick={() => history.goBack()}>
                  <ChevronLeft size={22} color="white" />
                </button>
                <div>
                  <h1 className="page-wr-title">Admin Work Report</h1>
                  <p className="page-wr-subtitle">Manage all employee reports</p>
                </div>
              </div>
              <div className="page-wr-header-right">
                <div className="page-wr-header-icon-box">
                  <FileText size={24} color="var(--ion-color-primary)" />
                </div>
              </div>
            </div>

            <div className="filters-row">
              {/* Employee Filter */}
              <div className="filter-group">
                <span className="filter-label">Team Member</span>
                <div
                  ref={empTriggerRef}
                  className={`dbase-inline-select searchable-trigger ${isEmployeeDropdownOpen ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPeriodDropdownOpen(false);
                    setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen);
                  }}
                >
                  <span className="dbase-select-text">
                    {SelectEmp || "Select Employee"}
                  </span>
                  <IonIcon icon={chevronDown} className="select-chevron" />
                </div>
              </div>

              {/* Period Filter */}
              <div className="filter-group">
                <span className="filter-label">Reporting Period</span>
                <div
                  ref={periodTriggerRef}
                  className={`dbase-inline-select searchable-trigger ${isPeriodDropdownOpen ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEmployeeDropdownOpen(false);
                    setIsPeriodDropdownOpen(!isPeriodDropdownOpen);
                  }}
                >
                  <span className="dbase-select-text">
                    {Seachdate || "Select Month"}
                  </span>
                  <IonIcon icon={chevronDown} className="select-chevron" />
                </div>
              </div>
            </div>

            {/* Employee Dropdown Portal */}
            {isEmployeeDropdownOpen && createPortal(
              <>
                <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsEmployeeDropdownOpen(false); }} />
                <div
                  className="custom-inline-dropdown"
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: `${employeeDropdownPos.top}px`,
                    left: `${employeeDropdownPos.left}px`,
                    width: `${employeeDropdownPos.width}px`
                  }}
                >
                  <div className="dropdown-search-sec">
                    <IonIcon icon={search} className="dropdown-search-icon" />
                    <input
                      type="text"
                      className="dropdown-pure-input"
                      placeholder="Search name or code..."
                      value={empSearchTerm}
                      onChange={(e) => setEmpSearchTerm(e.target.value)}
                      autoFocus
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                    {empSearchTerm && (
                      <button className="dropdown-clear-btn" onClick={() => setEmpSearchTerm("")}>
                        <IonIcon icon={close} />
                      </button>
                    )}
                  </div>

                  <div className="dropdown-body">
                    {filteredEmployees.map((emp, index) => {
                      const empId = emp.EmpCode;
                      const empName = emp.EmpName;
                      const isSelected = SelectEmpcode === empId;
                      const cleanNameForInitials = empName.includes("-")
                        ? empName.split("-").slice(1).join("-").trim()
                        : empName;
                      const initials = (cleanNameForInitials.charAt(0) || "?").toUpperCase();

                      return (
                        <div
                          key={index}
                          className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectEmpcode(empId);
                            setSelectEmp(empName);
                            setIsEmployeeDropdownOpen(false);
                            setEmpSearchTerm("");
                            
                            const params = new URLSearchParams({
                              EmpCode: empId,
                              SearchDate: Seachdate,
                            });
                            const url = `${API_BASE}Workreport/Load_WorkReport?${params.toString()}`;
                            axios.get(url, { headers: getAuthHeaders() }).then(r => {
                              setDtworkreport(Array.isArray(r.data) ? r.data : []);
                            }).catch(() => setDtworkreport([]));
                          }}
                        >
                          <div className={`dr-avatar grad-${(parseInt(empId) % 5) || 0}`}>
                            {initials}
                          </div>
                          <div className="dr-info">
                            <span className="dr-name">{empName}</span>
                            <span className="dr-id">ID: {empId}</span>
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

            {/* Period Dropdown Portal */}
            {isPeriodDropdownOpen && createPortal(
              <>
                <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsPeriodDropdownOpen(false); }} />
                <div
                  className="custom-inline-dropdown"
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    top: `${periodDropdownPos.top}px`,
                    left: `${periodDropdownPos.left}px`,
                    width: `${periodDropdownPos.width}px`,
                  }}
                >
                  <div className="dropdown-body">
                    {dtmy.map((item, i) => {
                      const isSelected = item === Seachdate;
                      return (
                        <div
                          key={i}
                          className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                          onClick={async () => {
                            setSeachdate(item);
                            setIsPeriodDropdownOpen(false);
                            
                            const params = new URLSearchParams({
                              EmpCode: SelectEmpcode,
                              SearchDate: item,
                            });
                            const url = `${API_BASE}Workreport/Load_WorkReport?${params.toString()}`;
                            const r = await axios.get(url, { headers: getAuthHeaders() });
                            setDtworkreport(Array.isArray(r.data) ? r.data : []);
                          }}
                          style={{ padding: '12px 16px' }}
                        >
                          <div className="dr-info">
                            <span className="dr-name" style={{ fontWeight: isSelected ? 800 : 500 }}>{item}</span>
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
          </div>

          <div className="task-list-container">
            {dtworkreport.length ? (
              dtworkreport.map((raw, idx) => {
                const item = normalizeWR(raw);
                if (!item) return null;

                const t = (item.tClass || "").toString().toLowerCase();
                const showApprove = t === "red" || t === "orange";
                const showReject = t === "green" || t === "orange";

                return (
                  <React.Fragment key={idx}>
                    {String(item.DateStatus) === "1" && (
                      <div className="card-date">
                        {item.wdate || ""}
                      </div>
                    )}

                    <div
                      className={`wr-premium-card ${
                        item.__colors.status === "green" ? "accept-card" : 
                        item.__colors.status === "red" ? "reject-card" : "pending-card"
                      } ${item.LPClass || ""}`}
                    >
                      <div className="wr-premium-card-header">
                        <div className="wr-header-left">
                          <div className="wr-date-wrap">
                            <Calendar size={13} className="wr-header-icon" />
                            <span>{item.wdate}</span>
                          </div>
                          <div className="wr-premium-location">
                            <MapPin size={12} className="wr-header-icon" />
                            <span>{item.Client_project}</span>
                          </div>
                        </div>
                        <div className="wr-status-wrap" style={{ backgroundColor: item.__colors.bg, color: item.__colors.stripe }}>
                          <span className="wr-status-dot" style={{ backgroundColor: item.__colors.stripe }}></span>
                          {item.__colors.status === "green" ? "Approved" : item.__colors.status === "red" ? "Rejected" : "Pending"}
                        </div>
                      </div>
                      
                      <div className="wr-premium-card-body">
                        <h3 className="wr-premium-title">{item.Empname}</h3>
                        <div className="wr-premium-desc-box">
                          <FileText size={14} className="wr-desc-icon" />
                          <p className="wr-premium-text">{item.WDescription}</p>
                          
                          {item.__colors.status === "orange" && (
                            <div className="wr-action-btns" style={{ display: 'flex', gap: '8px' }}>
                              <button
                                className="wr-edit-btn-small"
                                style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)', marginLeft: '8px' }}
                                onClick={() => updateWorkStatus(item, "Approved")}
                              >
                                <Check size={16} />
                              </button>
                              <button
                                className="wr-edit-btn-small"
                                style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.15)', marginLeft: '4px' }}
                                onClick={() => updateWorkStatus(item, "Rejected")}
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
              })
            ) : (
              <div className="empty-state">
                <SearchX className="empty-icon" />
                <h3>No Reports Found</h3>
                <p>Try adjusting your filters or selecting a different month.</p>
              </div>
            )}
          </div>
        </div>

        <IonToast
          isOpen={toastOpen}
          onDidDismiss={() => setToastOpen(false)}
          message={toastMsg}
          duration={2500}
          color={toastColor === 'warning' ? 'warning' : toastColor}
          position="top"
        />
      </IonContent>
    </IonPage>
  );
};

export default AdminWorkReport;
