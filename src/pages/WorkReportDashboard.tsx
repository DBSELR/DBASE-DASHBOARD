import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import "./WorkReportDashboard.css";
import { API_BASE } from "../config";
import { ChevronLeft, FileText, Check, X, Calendar, MapPin } from "lucide-react";
import { useHistory } from "react-router-dom";
import { IonIcon } from "@ionic/react";
import { person, search, close, checkmarkCircle, chevronDown } from "ionicons/icons";

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
  [key: string]: any;
};

type GroupedReports = Record<string, WorkReport[]>;

const WorkReportDashboard: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [monthYearList, setMonthYearList] = useState<string[]>([]);
  const [searchDate, setSearchDate] = useState<string>("");
 const [workReports, setWorkReports] = useState<WorkReport[]>([]);
  const [allWorkReports, setAllWorkReports] = useState<WorkReport[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});
  const history = useHistory();

  // Parse active user from localStorage "user" JSON key
  const getLoggedInUser = () => {
    let code = "1520";
    let name = "User";
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.empCode) code = String(parsed.empCode);
        if (parsed.empName) name = String(parsed.empName);
      }
    } catch (e) {
      console.error("Error reading stored user:", e);
    }
    return { code, name };
  };

  const { code: empCode, name: empName } = getLoggedInUser();

  const [periodOpen, setPeriodOpen] = useState<boolean>(false);
  const [periodPos, setPeriodPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 320 });
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState(empName);
  const [selectedEmpCode, setSelectedEmpCode] = useState(empCode);

  // Custom searchable employee dropdown states
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState<boolean>(false);
  const [employeeDropdownPos, setEmployeeDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 240 });
  const [empSearchTerm, setEmpSearchTerm] = useState<string>("");
  const empTriggerRef = useRef<HTMLDivElement | null>(null);
  const periodTriggerRef = useRef<HTMLDivElement | null>(null);

  // ================= GROUP DATA =================
  const groupWorkReports = (data?: WorkReport[]): GroupedReports => {
    const grouped: GroupedReports = {};

    (data || []).forEach((item) => {
      const key = String(item?.ClientProject || "No Project")
        .trim()
        .replace(/\s+/g, " ");

      if (!grouped[key]) {
        grouped[key] = [];
      }

      grouped[key].push(item);
    });

    return grouped;
  };

  // ================= LOAD WORK REPORT =================
  const loadWorkReports = async (
  date: string,
  targetEmpCode: string = "0"
) => {
  try {
    setLoading(true);

    const res = await axios.get(
      `${API_BASE}Workreport/Load_WorkReport_Team`,
      {
        params: {
          EmpCode: empCode,
          SearchDate: date,
        },
      }
    );

    const dataArr = Array.isArray(res.data)
      ? res.data
      : [];

    const reportData = dataArr.map((x: any) => ({
      WorkId: x?.[0] ?? "",
      EmpName: x?.[1] ?? "",
      ServiceType: x?.[2] ?? "",
      ClientProject: x?.[3] ?? "",
      Description: x?.[4] ?? "",
      WorkDate: x?.[5] ?? "",
      Status: x?.[6] ?? "",
      LPClass: x?.[7] ?? "",
      Color: x?.[8] ?? "",
      RawDate: x?.[9] ?? "",
      DateStatus: x?.[12] ?? "",
      TLRemark: x?.[11] ?? "-",
      EmpCode: x?.[10] ?? "",
    }));
    console.log(res.data[0]);
    setAllWorkReports(reportData);

    if (targetEmpCode === "0") {
      setWorkReports(reportData);
    } else {
      setWorkReports(
        reportData.filter(
          x => String(x.EmpCode) === targetEmpCode
        )
      );
    }
  }
  finally {
    setLoading(false);
  }
};


 const handleEmployeeChange = (code: string) => {
  setSelectedEmpCode(code);

  const emp = employees.find(
    (x: any) => String(x[0]) === code
  );

  setSelectedEmp(
    emp ? emp[1] : "All Employees"
  );

  // Filter locally instead of API call
  if (code === "0") {
    setWorkReports(allWorkReports);
  } else {
   const filtered = allWorkReports.filter(
  (x) => String(x.EmpCode) === code
);

    setWorkReports(filtered);
  }
};
  // ================= LOAD MONTH LIST =================
  const loadMonthYearList = async () => {
    try {
      const res = await axios.get(
        `${API_BASE}Workreport/Load_Workreport_MY`,
        {
          params: { EmpCode: empCode },
        }
      );
      const arr: any[] = Array.isArray(res.data) ? res.data : [];
      const list: string[] = arr.map((x: any) => x[0]);

      setMonthYearList(list);

      if (list.length > 0) {
  setSearchDate(list[0]);
  setSelectedEmpCode("0");
  setSelectedEmp("All Employees");
  loadWorkReports(list[0], "0");
}
    } catch (err) {
      console.error("Month-Year Load Error", err);
    }
  };

  useEffect(() => {
    loadMonthYearList();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(
        `${API_BASE}Employee/Load_Employees`
      );

      if (response.data && Array.isArray(response.data)) {
        const filtered = response.data.filter(
          (emp: any) => emp[0] !== "0"
        );

        filtered.unshift(["0", "All Employees"]);

        setEmployees(filtered);

        // Find the active logged-in user in the loaded employees
        const activeEmp = filtered.find(
          (x: any) => String(x[0]) === empCode
        );
        if (activeEmp) {
          setSelectedEmp(activeEmp[1]);
        }
      }
    } catch (err) {
      console.error("Failed to load employees", err);
    }
  };

  // ================= MONTH CHANGE =================
 const handleMonthChange = async (value: string) => {
  setSearchDate(value);
  await loadWorkReports(value, selectedEmpCode);
};

  // Filtering for Searchable Dropdown
  const filteredEmployees = employees.filter((emp) => {
    const term = empSearchTerm.toLowerCase();
    const id = String(emp[0]).toLowerCase();

    let name = String(emp[1]);
    if (name.startsWith(emp[0] + "-")) {
      name = name.replace(emp[0] + "-", "").trim();
    }
    name = name.toLowerCase();
    return name.includes(term) || id.includes(term);
  });

  // Position logic for custom dropdowns
  useEffect(() => {
    if (isEmployeeDropdownOpen && empTriggerRef.current) {
      const rect = empTriggerRef.current.getBoundingClientRect();
      setEmployeeDropdownPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 240),
      });
    }
  }, [isEmployeeDropdownOpen]);

  useEffect(() => {
    if (periodOpen && periodTriggerRef.current) {
      const rect = periodTriggerRef.current.getBoundingClientRect();
      setPeriodPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 200),
      });
    }
  }, [periodOpen]);

  useEffect(() => {
    if (!isEmployeeDropdownOpen && !periodOpen) return;
    const compute = () => {
      if (isEmployeeDropdownOpen && empTriggerRef.current) {
        const rect = empTriggerRef.current.getBoundingClientRect();
        setEmployeeDropdownPos({
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX,
          width: Math.max(rect.width, 240),
        });
      }
      if (periodOpen && periodTriggerRef.current) {
        const rect = periodTriggerRef.current.getBoundingClientRect();
        setPeriodPos({
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX,
          width: Math.max(rect.width, 200),
        });
      }
    };
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [isEmployeeDropdownOpen, periodOpen]);

 

  // ================= UPDATE STATUS =================
  const updateWorkReportStatus = async (
    workId: string | number,
    status: string
  ) => {
    try {
      setUpdatingStatus((p) => ({
        ...p,
        [String(workId)]: true,
      }));

      // Optimistic update
      setWorkReports((prev) =>
        prev.map((item) => {
          const id = item.WorkId ?? item.workId;

          if (String(id) === String(workId)) {
            return {
              ...item,
              Status: status,
            };
          }

          return item;
        })
      );

      await axios.get(
        `${API_BASE}Workreport/update_WR_Permission`,
        {
          params: {
            Wrid: workId,
            Status: status,
            EmpCode: empCode,
          },
        }
      );

      // Uncomment if you want to refresh from server
      // await loadWorkReports(searchDate);
    } catch (err) {
      console.error("Status Update Error", err);

      // Reload data if update fails
      loadWorkReports(searchDate);
    } finally {
      setUpdatingStatus((p) => {
        const n = { ...p };
        delete n[String(workId)];
        return n;
      });
    }
  };

  return (
    <div className="work-dashboard">

      {/* HEADER */}
      <div className="dashboard-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
        <div className="page-wr-header" style={{ width: '100%' }}>
          <div className="page-wr-header-left">
            <button className="page-wr-back-btn" onClick={() => history.goBack()}>
              <ChevronLeft size={22} color="white" />
            </button>
            <div>
              <h1 className="page-wr-title">Team Reports</h1>
              <p className="page-wr-subtitle">Review work reports</p>
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
            <span className="filter-label">Employee</span>
            <div
              ref={empTriggerRef}
              className={`dbase-inline-select searchable-trigger ${isEmployeeDropdownOpen ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setPeriodOpen(false);
                setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen);
              }}
            >
              <span className="dbase-select-text">
                {selectedEmp || "Select Employee"}
              </span>
              <IonIcon icon={chevronDown} className="select-chevron" />
            </div>
          </div>

          {/* Period Filter */}
          <div className="filter-group">
            <span className="filter-label">Period</span>
            <div
              ref={periodTriggerRef}
              className={`dbase-inline-select searchable-trigger ${periodOpen ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setIsEmployeeDropdownOpen(false);
                setPeriodOpen(!periodOpen);
              }}
            >
              <span className="dbase-select-text">
                {searchDate || "Select Month"}
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
                  const empId = String(emp[0]);
                  let empName = String(emp[1]);
                  if (empName.startsWith(empId + "-")) {
                    empName = empName.replace(empId + "-", "").trim();
                  }
                  const isSelected = selectedEmpCode === empId;
                  const cleanNameForInitials = empName.includes("-")
                    ? empName.split("-").slice(1).join("-").trim()
                    : empName;
                  const initials = (cleanNameForInitials.charAt(0) || "?").toUpperCase();

                  return (
                    <div
                      key={index}
                      className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
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
                        <span className="dr-name">{empName}</span>
                        <span className="dr-id">ID: {empId}</span>
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
            <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setPeriodOpen(false); }} />
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
              <div className="dropdown-body">
                {monthYearList.map((item, i) => {
                  const isSelected = item === searchDate;
                  return (
                    <div
                      key={i}
                      className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        handleMonthChange(item);
                        setPeriodOpen(false);
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

      {/* CONTENT */}
      <div className="task-list-container">

        {loading && (
          <div className="loading">
            Loading...
          </div>
        )}

        {!loading &&
          workReports.map((item, i) => (
            <React.Fragment key={i}>

              {(item.DateStatus === "1" ||
                item.DateStatus === 1) && (
                  <div className="card-date">
                    {item.WorkDate}
                  </div>
                )}

              <div
                className={`wr-premium-card ${
                  item.Status === "Approved" ? "accept-card" : 
                  item.Status === "Rejected" ? "reject-card" : "pending-card"
                } ${item.LPClass || ""}`}
              >
                <div className="wr-premium-card-header">
                  <div className="wr-header-left">
                    <div className="wr-date-wrap">
                      <Calendar size={13} className="wr-header-icon" />
                      <span>{item.WorkDate}</span>
                    </div>
                    <div className="wr-premium-location">
                      <MapPin size={12} className="wr-header-icon" />
                      <span>{item.ClientProject}</span>
                    </div>
                  </div>
                  <div className="wr-status-wrap" style={{ backgroundColor: item.Color }}>
                    <span className="wr-status-dot"></span>
                    {item.Status || "Pending"}
                  </div>
                </div>
                
                <div className="wr-premium-card-body">
                  <h3 className="wr-premium-title">{item.EmpName}</h3>
                  <div className="wr-premium-desc-box">
                    <FileText size={14} className="wr-desc-icon" />
                    <p className="wr-premium-text">{item.Description}</p>
                    
                    {item.Status === "Pending" && (
                      <>
                        <button
                          className="wr-edit-btn-small"
                          style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)', marginLeft: '8px' }}
                          onClick={() => updateWorkReportStatus(item.WorkId ?? "", "Approved")}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          className="wr-edit-btn-small"
                          style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.15)', marginLeft: '4px' }}
                          onClick={() => updateWorkReportStatus(item.WorkId ?? "", "Rejected")}
                        >
                          <X size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          ))}
      </div>
    </div>
  );
};

export default WorkReportDashboard;