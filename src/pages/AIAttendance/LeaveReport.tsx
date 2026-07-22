import React, { useState, useEffect } from 'react';
import { IonPage, IonContent, IonIcon, IonModal, IonDatetime, IonButton, IonToast, IonHeader } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import {
  arrowBackOutline,
  calendarOutline,
  chevronForwardOutline,
  chevronBackOutline,
  searchOutline,
  layersOutline,
  timeOutline,
  chatbubbleEllipsesOutline,
  documentOutline
} from 'ionicons/icons';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import moment from 'moment';
import { API_BASE } from '../../config';
import './LeaveReport.css';
import axios from "axios";

const API_KEY = 'dbase-ai-master-key-2026';
const hdrs = { 'Content-Type': 'application/json', 'x-api-key': API_KEY };

const getAuthHeaders = () => {
  const token = localStorage.getItem("token")?.replace(/"/g, "");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const LeaveReport: React.FC = () => {
  const history = useHistory();
  
  const [fromDate, setFromDate] = useState<string>(moment().startOf('month').format('YYYY-MM-DD'));
  const [toDate, setToDate] = useState<string>(moment().endOf('month').format('YYYY-MM-DD'));
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
  
  const [leaves, setLeaves] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastColor, setToastColor] = useState<"success" | "danger">("success");

  useEffect(() => {
    fetchBranches();
  }, []);

  const downloadPDF = () => {
  if (leaves.length === 0) {
    showToast("No data available to export.", "danger");
    return;
  }

  const doc = new jsPDF("landscape");

  doc.setFontSize(18);
  doc.text("Leave Report", 14, 15);

  doc.setFontSize(11);
  doc.text(
    `Branch : ${selectedBranch}`,
    14,
    23
  );

  doc.text(
    `Period : ${moment(fromDate).format("DD-MM-YYYY")}  To  ${moment(toDate).format("DD-MM-YYYY")}`,
    14,
    30
  );

  autoTable(doc, {
    startY: 38,
    head: [[
      "Emp Code",
      "Employee",
      "Type",
      "From",
      "To",
      "Time",
      "Status",
      "Remarks"
  
    ]],
    body: leaves.map((item) => [
      item.empcode || "",
      item.Empname || "",
      item.ltype || "",
      item.lfrom || "",
      item.lto || "",
      item.Ptime || "-",
      item.L_status || "",
      item.Remarks || ""
    ]),
    styles: {
      fontSize: 8
    },
    headStyles: {
      fillColor: [13, 148, 136]
    }
  });

  doc.save(
    `Leave_Report_${moment().format("YYYYMMDD_HHmmss")}.pdf`
  );
};
  const showToast = (msg: string, color: "success" | "danger" = "success") => {
    setToastMsg(msg);
    setToastColor(color);
    setToastOpen(true);
  };

  const fetchBranches = async () => {
    try {
      const res = await axios.get(`${API_BASE}Checkin/GetBranches`, { headers: hdrs });
      const d = res.data;
      if (d && d.success && Array.isArray(d.data)) {
        setBranches(["ALL", ...d.data]);
      }
    } catch (err) {
      console.error("Failed to fetch branches", err);
    }
  };

  const getMonthsBetween = (start: string, end: string) => {
    const months = [];
    let current = moment(start).startOf('month');
    const last = moment(end).startOf('month');
    
    while (current.isSameOrBefore(last)) {
      months.push(current.format('MMM-YYYY'));
      current.add(1, 'month');
    }
    return months;
  };
const loadData = async () => {
  setIsLoading(true);

  try {
    const baseUrl = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;

    // 1. Get employees for the selected branch (or ALL)
    let employeeList: any[] = [];
    const branchParam = selectedBranch !== "ALL" ? `?branch=${encodeURIComponent(selectedBranch)}` : "";
    const empRes = await fetch(`${baseUrl}Checkin/GetEmployeesByBranch${branchParam}`, { headers: hdrs });
    const empData = await empRes.json();

    if (empData && empData.success && Array.isArray(empData.data)) {
      employeeList = empData.data;
    }

    if (employeeList.length === 0) {
      setLeaves([]);
      showToast("No employees found for this branch.", "danger");
      setIsLoading(false);
      return;
    }

    // 2. Generate all dates in the range
    const dates: string[] = [];
    let current = moment(fromDate).startOf('day');
    const end = moment(toDate).startOf('day');
    
    // limit to 60 days to prevent excessive requests
    if (end.diff(current, 'days') > 60) {
      showToast("Date range too large (max 60 days).", "danger");
      setIsLoading(false);
      return;
    }

    while (current.isSameOrBefore(end)) {
      dates.push(current.format('YYYY-MM-DD'));
      current.add(1, 'day');
    }

    // 3. Fetch attendance for each date
    const allAbsents: any[] = [];
    const MAX_CONCURRENT = 5;
    
    for (let i = 0; i < dates.length; i += MAX_CONCURRENT) {
      const batch = dates.slice(i, i + MAX_CONCURRENT);
      
      await Promise.all(
        batch.map(async (date) => {
          try {
            const attendanceUrl = `${baseUrl}Checkin/AIGetAttendanceByDate?date=${date}${selectedBranch !== "ALL" ? `&branch=${encodeURIComponent(selectedBranch)}` : ""}`;
            const res = await fetch(attendanceUrl, { headers: hdrs });
            const d = await res.json();
            
            let presentEmpIds = new Set<string>();
            if (d.success && Array.isArray(d.data)) {
              d.data.forEach((r: any) => {
                if (r.empId) {
                  presentEmpIds.add(String(r.empId).trim().toLowerCase());
                }
              });
            }

            // Check against employeeList
            employeeList.forEach((emp: any) => {
              const eCode = String(emp.empCode || "").trim().toLowerCase();
              if (!presentEmpIds.has(eCode)) {
                allAbsents.push({
                  empcode: emp.empCode || "-",
                  empname: emp.empName || "Unknown",
                  Empname: emp.empName || "Unknown",
                  ltype: "Absent",
                  L_status: "Absent",
                  lfrom: moment(date).format("DD-MM-YYYY"),
                  lto: moment(date).format("DD-MM-YYYY"),
                  Ptime: "-",
                  remarks: "No punches for the day",
                  Remarks: "No punches for the day",
                  _dateValue: moment(date).valueOf(), // for sorting
                  lid: `${emp.empCode}-${date}`
                });
              }
            });
          } catch (e) {
            console.error("Failed to fetch attendance for date:", date, e);
          }
        })
      );
    }

    // Sort by date (newest first), then by employee code
    allAbsents.sort((a, b) => {
      if (b._dateValue !== a._dateValue) {
        return b._dateValue - a._dateValue;
      }
      return String(a.empcode).localeCompare(String(b.empcode));
    });

    setLeaves(allAbsents);

  } catch (err) {
    console.error(err);
    showToast("Failed to load absent report", "danger");
  } finally {
    setIsLoading(false);
  }
};



  const renderSafe = (val: any) => (typeof val === "string" ? val : "");

  return (
    <IonPage className="leave-report-container">
      <IonHeader className="ion-no-border" style={{ background: '#f8fafc' }}>
        <div className="lr-trendy-header">
          <button className="back-btn" onClick={() => history.goBack()}>
            <IonIcon icon={arrowBackOutline} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 className="lr-main-title">Absents Report</h1>
            <p style={{ margin: '4px 0 0',color: 'white', fontSize: '13px', opacity: 0.8 }}>Branch-wise Leave & Permissions</p>
          </div>
        </div>
      </IonHeader>
      <IonContent fullscreen scrollY>

        <div className="lr-filters-section">
          <div className="lr-filter-card">
            <div className="lr-date-row">
              <div className="lr-date-field" onClick={() => setStartModalOpen(true)}>
                <label>From Date</label>
                <div className="lr-date-input">
                  <IonIcon icon={calendarOutline} />
                  {moment(fromDate).format("DD MMM YYYY")}
                </div>
              </div>
              <div className="lr-date-field" onClick={() => setEndModalOpen(true)}>
                <label>To Date</label>
                <div className="lr-date-input">
                  <IonIcon icon={calendarOutline} />
                  {moment(toDate).format("DD MMM YYYY")}
                </div>
              </div>
            </div>

            <div className="lr-branch-row">
              <div className="lr-branch-selector">
                <button
                    className="lr-branch-btn"
                    onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IonIcon icon={layersOutline} style={{ color: 'var(--ion-color-primary, #0d9488)' }} />
                      {selectedBranch === "ALL" ? "All Branches" : selectedBranch}
                    </span>
                    <IonIcon icon={showBranchDropdown ? chevronBackOutline : chevronForwardOutline} style={{ transform: showBranchDropdown ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
                </button>
                {showBranchDropdown && (
                    <div className="lr-branch-dropdown">
                        {branches.map((branch) => (
                            <div
                                key={branch}
                                className={`lr-branch-item ${selectedBranch === branch ? "active" : ""}`}
                                onClick={() => {
                                    setSelectedBranch(branch);
                                    setShowBranchDropdown(false);
                                }}
                            >
                                {branch === "ALL" ? "All Branches" : branch}
                            </div>
                        ))}
                    </div>
                )}
              </div>
              <button
                className="lr-load-btn"
              onClick={downloadPDF}
            disabled={leaves.length === 0}
            >
            <IonIcon icon={documentOutline} />
             PDF
            </button>
              <button className="lr-load-btn" onClick={loadData} disabled={isLoading}>
  {isLoading ? (
    "Loading..."
  ) : (
    <>
      <IonIcon icon={searchOutline} />
      Search
    </>
  )}
            </button>
           </div>
          </div>
        </div>

        <div className="lr-results-section">
          <h2 className="lr-section-title">Absents List</h2>
          
          <div className="lr-cards-grid">
            {leaves.length > 0 ? (
              leaves.map((entry: any, index: number) => {
                const status = renderSafe(entry.L_status).toLowerCase();
                const isPermission = renderSafe(entry.ltype) === "Permission";
                
                return (
                  <div key={entry.lid || index} className={`lr-card status-${status}`}>
                    <div className="lr-card-header">
                      <div className="lr-emp-info">
                       <span className="lr-emp-name">
    {entry.empcode} - {entry.empname}
</span>
                        <span className="lr-emp-code">{entry.ltype}</span>
                      </div>
                      <div className={`lr-status-badge ${status}`}>
    {entry.L_status}
</div>
                    </div>
                    
                    <div className="lr-card-details">
                      <div className="lr-detail-row">
                        <IonIcon icon={calendarOutline} />
                        <div className="lr-detail-text">
                          {renderSafe(entry.lfrom)} {entry.lto && typeof entry.lto === 'string' && entry.lto !== entry.lfrom ? `- ${entry.lto}` : ""}
                        </div>
                      </div>
                      
                      {isPermission && typeof entry.Ptime === "string" && entry.Ptime && (
                        <div className="lr-detail-row">
                          <IonIcon icon={timeOutline} />
                          <div className="lr-detail-text">{entry.Ptime}</div>
                        </div>
                      )}
                      
                      <div className="lr-detail-row">
                        <IonIcon icon={chatbubbleEllipsesOutline} />
                        <div className="lr-detail-text" style={{ fontStyle: 'italic', opacity: 0.8 }}>
                          {entry.remarks}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="lr-empty-state">
                <IonIcon icon={layersOutline} />
                <p>No leaves found for the selected criteria.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
<IonModal
  isOpen={startModalOpen}
  onDidDismiss={() => setStartModalOpen(false)}
  className="pwt-date-modal"
>
  <div className="pwt-date-content">
    <h3>Select From Date</h3>

    <IonDatetime
      presentation="date"
      value={fromDate}
      onIonChange={(e) => {
        if (typeof e.detail.value === "string") {
          setFromDate(e.detail.value.split("T")[0]);
        }
        setStartModalOpen(false);
      }}
    />

    <IonButton expand="block" className="pwt-close-btn" onClick={() => setStartModalOpen(false)}>
      Close
    </IonButton>
  </div>
</IonModal>

<IonModal
  isOpen={endModalOpen}
  onDidDismiss={() => setEndModalOpen(false)}
  className="pwt-date-modal"
>
  <div className="pwt-date-content">
    <h3>Select To Date</h3>

    <IonDatetime
      presentation="date"
      value={toDate}
      onIonChange={(e) => {
        if (typeof e.detail.value === "string") {
          setToDate(e.detail.value.split("T")[0]);
        }
        setEndModalOpen(false);
      }}
    />

    <IonButton expand="block" className="pwt-close-btn" onClick={() => setEndModalOpen(false)}>
      Close
    </IonButton>
  </div>
</IonModal>

        <IonToast
          isOpen={toastOpen}
          onDidDismiss={() => setToastOpen(false)}
          message={toastMsg}
          duration={2000}
          color={toastColor}
          position="top"
        />
      </IonContent>
    </IonPage>
  );
};

export default LeaveReport;
    