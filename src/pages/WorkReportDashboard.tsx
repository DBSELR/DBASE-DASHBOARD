import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import "./WorkReportDashboard.css";
import { API_BASE } from "../config";

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
 const [workReports, setWorkReports] =
  useState<WorkReport[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});

  const empCode: string = localStorage.getItem("EmpCode") || "1520";
  const empName: string = localStorage.getItem("EmpName") || "User";
  const [periodOpen, setPeriodOpen] = useState<boolean>(false);
  const [periodPos, setPeriodPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 320 });
  const pillRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
const [selectedEmp, setSelectedEmp] = useState("All Employees");
const [selectedEmpCode, setSelectedEmpCode] = useState("0");

  // ================= GROUP DATA =================
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
  const loadWorkReports = async (date: string) => {
    try {
      setLoading(true);

      const res = await axios.get(
        `${API_BASE}Workreport/Load_WorkReport_Team`,
        {
         params: {
  EmpCode:
    selectedEmpCode === "0"
      ? empCode
      : selectedEmpCode,
  SearchDate: date,
},
        }
      );
      console.log("API RESPONSE:", res.data);

      const dataArr: any[] = Array.isArray(res.data) ? res.data : [];

      const reportData: WorkReport[] = dataArr.map((x: any) => ({
        WorkId: x?.[0] ?? "",
        EmpName: x?.[1] ?? "",
        ServiceType: x?.[2] ?? "",
        ClientProject: x?.[3] ?? "No Project",
        Description: x?.[4] ?? "",
        WorkDate: x?.[5] ?? "",
        Status: x?.[6] ?? "",
        LPClass: x?.[7] ?? "",
        Color: x?.[8] ?? "",
        RawDate: x?.[9] ?? "",
        DateStatus: x?.[10] ?? "",
        TLRemark: x?.[11] ?? "-",
      }));

    setWorkReports(reportData);
    } catch (err) {
      console.error("WorkReport Load Error", err);
    } finally {
      setLoading(false);
    }
  };


   const handleEmployeeChange = (
  e: React.ChangeEvent<HTMLSelectElement>
) => {
  const code = e.target.value;

  setSelectedEmpCode(code);

  const emp = employees.find(
    (x: any) => String(x[0]) === code
  );

  setSelectedEmp(
    emp ? emp[1] : "All Employees"
  );

  loadWorkReports(searchDate);
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
        loadWorkReports(list[0]);
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
    }
  } catch (err) {
    console.error("Failed to load employees", err);
  }
};

  // ================= MONTH CHANGE =================
  const handleMonthChange = (value: string) => {
    setSearchDate(value);
    loadWorkReports(value);
  };

  // close the custom period menu when clicking outside
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (!periodOpen) return;
      if (pillRef.current && pillRef.current.contains(e.target as Node)) return;
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      setPeriodOpen(false);
    };

    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [periodOpen]);

  // compute position for portal-based period menu and update on scroll/resize
  useEffect(() => {
    if (!periodOpen) return;
    const compute = () => {
      if (!pillRef.current) return;
      const rect = pillRef.current.getBoundingClientRect();
      setPeriodPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [periodOpen]);

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
      <div className="dashboard-header">
        <div>
          <h2>WorkReport Dashboard</h2>
      
        </div>

        <div className="filters">
          <div
            className="period-pill"
            ref={pillRef}
            onClick={(e) => {
              e.stopPropagation();
              setPeriodOpen((p) => !p);
            }}
            role="button"
            tabIndex={0}
          >
            <div className="period-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 7V3M16 7V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="period-text">
              <div className="period-main">{searchDate || "Select Month"}</div>
              <div className="period-sub">Period</div>
            </div>
          </div>

          {periodOpen && createPortal(
            <div
              className="custom-inline-dropdown"
              ref={menuRef}
              style={{
                position: "absolute",
                top: `${periodPos.top}px`,
                left: `${periodPos.left}px`,
                width: `${periodPos.width + 20}px`,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="dropdown-body">
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {monthYearList.map((item, i) => (
                    <li
                      key={i}
                      className={item === searchDate ? "selected" : ""}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        handleMonthChange(item);
                        setPeriodOpen(false);
                      }}
                      style={{ padding: '12px 16px', cursor: 'pointer', fontWeight: 800 }}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div className="task-list-container">

  <div className="top-filters">
    <select
      className="employee-select"
      value={selectedEmpCode}
      onChange={handleEmployeeChange}
    >
      {employees.map((emp: any, i) => (
        <option key={i} value={String(emp[0])}>
          {emp[1]}
        </option>
      ))}
    </select>

    <select
      className="month-select"
      value={searchDate}
      onChange={(e) =>
        handleMonthChange(e.target.value)
      }
    >
      {monthYearList.map((m, i) => (
        <option key={i} value={m}>
          {m}
        </option>
      ))}
    </select>
  </div>

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
          className={`wr-card ${item.LPClass || ""}`}
        >
          <div className="wr-badge">
            {item.EmpName} -- {item.ClientProject}
          </div>

          <div className="wr-actions">
            {item.Status === "Pending" && (
              <>
                <span
                  className="success-bg"
                  onClick={() =>
                    updateWorkReportStatus(
                      item.WorkId ?? "",
                      "Approved"
                    )
                  }
                >
                  ✓
                </span>

                <span
                  className="danger-bg"
                  onClick={() =>
                    updateWorkReportStatus(
                      item.WorkId ?? "",
                      "Rejected"
                    )
                  }
                >
                  ✕
                </span>
              </>
            )}
          </div>

          <div className="wr-desc">
            {item.Description}
          </div>

          {item.TLRemark &&
            item.TLRemark !== "-" && (
              <div className="wr-remark">
                TL Remark :
                <span>
                  {item.TLRemark}
                </span>
              </div>
            )}
        </div>
      </React.Fragment>
    ))}
</div>
    </div>
  );
};

export default WorkReportDashboard;