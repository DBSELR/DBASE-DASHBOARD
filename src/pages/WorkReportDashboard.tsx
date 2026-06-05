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
  const [groupedReports, setGroupedReports] = useState<GroupedReports>({});
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});

  const empCode: string = localStorage.getItem("EmpCode") || "1520";
  const empName: string = localStorage.getItem("EmpName") || "User";
  const [periodOpen, setPeriodOpen] = useState<boolean>(false);
  const [periodPos, setPeriodPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 320 });
  const pillRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

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
            EmpCode: empCode,
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

      const grouped = groupWorkReports(reportData);

      console.log("GROUPED DATA:", grouped);
      console.log("PROJECT COUNT:", Object.keys(grouped).length);
      console.log("PROJECTS:", Object.keys(grouped));

      setGroupedReports(grouped);
    } catch (err) {
      console.error("WorkReport Load Error", err);
    } finally {
      setLoading(false);
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
        loadWorkReports(list[0]);
      }
    } catch (err) {
      console.error("Month-Year Load Error", err);
    }
  };

  useEffect(() => {
    loadMonthYearList();
  }, []);

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
  const updateWorkReportStatus = async (workId: string | number, status: string) => {
    try {
      // set per-item loading state
      setUpdatingStatus((p) => ({ ...p, [String(workId)]: true }));

      // optimistic update locally so UI responds immediately
      setGroupedReports((prev) => {
        const copy: GroupedReports = {};
        Object.keys(prev).forEach((k) => {
          copy[k] = prev[k].map((it) => {
            const id = it.WorkId ?? it.workId;
            if (String(id) === String(workId)) {
              return { ...it, Status: status };
            }
            return it;
          });
        });
        return copy;
      });

      await axios.get(`${API_BASE}Workreport/update_WR_Permission`, {
        params: {
          Wrid: workId,
          Status: status,
          EmpCode: empCode,
        },
      });

      // optionally refresh from server to ensure consistency
      // await loadWorkReports(searchDate);
    } catch (err) {
      console.error("Status Update Error", err);
      // reload to revert optimistic change if update failed
      try { loadWorkReports(searchDate); } catch (e) { /* ignore */ }
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
        <div className="total-projects">
          Total Projects: {Object.keys(groupedReports || {}).length}
        </div>

        {loading && <div style={{ padding: 10 }}>Loading...</div>}

        {!loading && Object.keys(groupedReports || {}).length === 0 && (
          <div style={{ padding: 20 }}>No Data Found</div>
        )}

        {Object.keys(groupedReports || {}).map((project) => (
  <div key={project} className="premium-task-card">

            {/* PROJECT NAME */}
            <div className="task-card-header">
              <div className="project-icon" />
              <span className="tid-badge">
  {project} ({groupedReports[project]?.length || 0})
</span>
            </div>

            {/* GRID WRAPPER: horizontal + vertical scroll inside card */}
            <div className="grid-wrapper">
              <div className="report-grid-header">
                <div>WDate</div>
                <div>Service Type</div>
                <div>Employee</div>
                <div>Description</div>
                <div>TLRemark</div>
                <div>Status</div>
                <div>Action</div>
              </div>

              {(groupedReports[project] || []).map((item, i) => (
                <div key={i} className="report-grid-row">

                  <div>{item.WorkDate}</div>
                  <div>{item.ServiceType}</div>
                  <div>{item.EmpName}</div>

                  <div className="desc-cell">
                    {item.Description}
                  </div>

                  <div>
                    {item.TLRemark ?? item.tlRemark ?? "-"}
                  </div>

                  <div className="status-cell">
                    <div className={`status-text ${String(item.Status || "Pending").toLowerCase()}`}>
                      {item.Status || "Pending"}
                    </div>
                  </div>

                  <div className="report-actions">
                    {item.Status === "Pending" ? (
                      <button
                        className="approve-btn"
                        onClick={() =>
                          updateWorkReportStatus(item.WorkId ?? item.workId ?? "", "Approved")
                        }
                        disabled={!!updatingStatus[String(item.WorkId ?? item.workId ?? "")]}
                      >
                        Accept
                      </button>
                    ) : (
                      <div className="action-placeholder">-</div>
                    )}
                  </div>

                </div>
              ))}
            </div>

          </div>
        ))}

      </div>
    </div>
  );
};

export default WorkReportDashboard;