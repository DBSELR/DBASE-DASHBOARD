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
  UserCheck
} from "lucide-react";

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

  const currentMY = useMemo(() => moment().format("MMM-YYYY"), []);

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
        <div className="filters-container">
          <div className="filters-header">
            <FileText className="icon-3d" size={24} color="#ffffff" />
            <h2>Work Reports</h2>
          </div>

          <div className="filters-grid">
            {/* Employee Selection */}
            <div className="filter-item">
              <span className="filter-label">Team Member</span>
              <div className="filter-value">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                  <Users size={18} color="rgba(255, 255, 255, 0.9)" />
                  <IonSelect
                    interface="popover"
                    value={SelectEmpcode}
                    placeholder="Select Employee"
                    onIonChange={(e) => {
                      const empCode = e.detail.value;
                      const found = dtEmpActive.find((x) => x.EmpCode === empCode);
                      if (found) {
                        setSelectEmpcode(empCode);
                        setSelectEmp(found.EmpName);
                        // Trigger load
                        const params = new URLSearchParams({
                          EmpCode: empCode,
                          SearchDate: Seachdate,
                        });
                        const url = `${API_BASE}Workreport/Load_WorkReport?${params.toString()}`;
                        axios.get(url, { headers: getAuthHeaders() }).then(r => {
                          setDtworkreport(Array.isArray(r.data) ? r.data : []);
                        }).catch(() => setDtworkreport([]));
                      }
                    }}
                    style={{ '--padding-start': '0', width: '100%', fontSize: '1rem' }}
                    className="admin-select"
                  >
                    {dtEmpActive.map((x) => (
                      <IonSelectOption key={x.EmpCode} value={x.EmpCode}>
                        {x.EmpName}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </div>
              </div>
            </div>

            {/* Month Selection */}
            <div className="filter-item">
              <span className="filter-label">Reporting Period</span>
              <div className="filter-value">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} color="rgba(255, 255, 255, 0.9)" />
                  <IonSelect
                    interface="popover"
                    value={Seachdate}
                    placeholder="Select Month"
                    onIonChange={async (e) => {
                      setSeachdate(e.detail.value);
                      // Trigger load
                      const params = new URLSearchParams({
                        EmpCode: SelectEmpcode,
                        SearchDate: e.detail.value,
                      });
                      const url = `${API_BASE}Workreport/Load_WorkReport?${params.toString()}`;
                      const r = await axios.get(url, { headers: getAuthHeaders() });
                      setDtworkreport(Array.isArray(r.data) ? r.data : []);
                    }}
                    style={{ '--padding-start': '0', width: '100%', fontSize: '1rem' }}
                  >
                    {dtmy.map((m, i) => (
                      <IonSelectOption key={i} value={m}>{m}</IonSelectOption>
                    ))}
                  </IonSelect>
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* Reports List */}
        <div className="reports-list">
          {dtworkreport.length ? (
            dtworkreport.map((raw, idx) => {
              const x = normalizeWR(raw);
              if (!x) return null;

              const t = (x.tClass || "").toString().toLowerCase();
              const showApprove = t === "red" || t === "orange";
              const showReject = t === "green" || t === "orange";

              return (
                <div key={idx} style={{ animationDelay: `${idx * 0.05}s` }}>
                  {String(x.DateStatus) === "1" && (
                    <div className="date-divider">
                      <span>{x.wdate || ""}</span>
                    </div>
                  )}

                  <div className={`report-card status-${x.__colors.status}`}>
                    <div className="status-indicator" style={{ background: x.__colors.stripe }}></div>

                    <div className="report-header">
                      <div className="emp-project-info">
                        <span className="emp-name">{x.Empname}</span>
                        <div className="project-tag">
                          <Briefcase size={14} />
                          {x.Client_project || "Unknown Project"}
                        </div>
                      </div>

                      <div className="report-actions">
                        {showApprove && (
                          <button
                            className="action-btn btn-approve"
                            onClick={() => updateWorkStatus(x, "Approved")}
                            title="Approve Report"
                          >
                            <CheckCircle2 size={20} />
                          </button>
                        )}
                        {showReject && (
                          <button
                            className="action-btn btn-reject"
                            onClick={() => updateWorkStatus(x, "Rejected")}
                            title="Reject Report"
                          >
                            <XCircle size={20} />
                          </button>
                        )}
                        {!showApprove && !showReject && (
                          <div className="action-btn" style={{ background: '#f1f5f9', color: '#94a3b8', boxShadow: 'none' }}>
                            <UserCheck size={20} />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="report-body">
                      {x.Title && <div className="report-title">{x.Title}</div>}
                      <div className="report-desc">{x.WDescription}</div>
                    </div>
                  </div>
                </div>
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
