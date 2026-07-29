import React, { useState, useEffect } from 'react';
import { IonPage, IonContent, IonIcon, IonModal, IonDatetime, IonButton, IonToast, IonPopover, IonSpinner } from '@ionic/react';
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



  function statusClass(s?: string) {
    if (!s || s === '-') return 'sc-unknown';
    const l = s.toLowerCase();
    if (l === 'present') return 'sc-present';
    if (l === 'lop') return 'sc-lop';
    if (l === 'absent') return 'sc-absent';
    if (l.includes('sunday') || l.includes('weekly off')) return 'sc-sunday';
    if (l.includes('holiday') || l.includes('saturday') || l.includes('bhogi') || l.includes('sankranthi') || l.includes('ugadi') || l.includes('ramzan') || l.includes('ram') || l.includes('friday') || l.includes('jayanti') || l.includes('republic') || l.includes('new year')) return 'sc-holiday';
    return 'sc-grace';
  }

  const renderSafe = (val: any) => (typeof val === "string" ? val : "");

  return (
    <IonPage>
      <IonContent fullscreen scrollY>
        <div className="wr-container stock-container" style={{ padding: '0', minHeight: 'auto', backgroundColor: 'transparent', overflow: 'visible' }}>
          <div className="page-wr-header" style={{ margin: '16px', borderRadius: '16px', padding: '16px', position: 'sticky', top: '16px', zIndex: 9999 }}>
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()}>
                <IonIcon icon={arrowBackOutline} style={{ color: "white" }} />
              </button>
              <div>
                <h1 className="page-wr-title">
                  ABSENTS REPORT
                </h1>
                <p className="page-wr-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span className="subtitle-pulse-dot" />
                  <span>Branch-wise Leave & Permissions</span>
                </p>
              </div>
            </div>
          </div>

          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="stock-panel" style={{ padding: '20px', display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: '16px', alignItems: 'flex-end', borderRadius: '16px' }}>
              
              {/* Branch Dropdown */}
              <div style={{ position: 'relative', minWidth: '200px', flexShrink: 0 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Branch</label>
                <button
                  id="branch-btn-lr"
                  className="branch-btn"
                  onClick={() => setShowBranchDropdown(true)}
                  style={{ background: '#f8fafc', color: '#1e293b', border: '1px solid #e2e8f0', padding: '0 16px', height: '46px', borderRadius: '12px', fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', cursor: 'pointer', transition: 'all 0.2s', width: '100%' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IonIcon icon={layersOutline} style={{ color: 'var(--ion-color-primary, #0d9488)', fontSize: '18px' }} />
                    {selectedBranch === "ALL" ? "All Branches" : selectedBranch}
                  </div>
                  <IonIcon icon={chevronForwardOutline} style={{ transform: showBranchDropdown ? 'rotate(-90deg)' : 'rotate(90deg)', fontSize: '12px', transition: 'transform 0.2s' }} />
                </button>
                <IonPopover
                  trigger="branch-btn-lr"
                  isOpen={showBranchDropdown}
                  onDidDismiss={() => setShowBranchDropdown(false)}
                  alignment="end"
                  side="bottom"
                  arrow={false}
                  style={{ '--background': 'transparent', '--box-shadow': 'none' }}
                >
                  <div className="branch-dropdown" style={{ background: '#ffffff', borderRadius: '14px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', padding: '6px', minWidth: '200px', border: '1px solid #e2e8f0', maxHeight: '250px', overflowY: 'auto' }}>
                    {branches.map((branch) => (
                      <div
                        key={branch}
                        className={`branch-item ${selectedBranch === branch ? "active" : ""}`}
                        onClick={() => {
                          setSelectedBranch(branch);
                          setShowBranchDropdown(false);
                        }}
                        style={{ padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', background: selectedBranch === branch ? '#f1f5f9' : 'transparent', color: selectedBranch === branch ? 'var(--ion-color-primary, #0d9488)' : '#475569', fontWeight: selectedBranch === branch ? 700 : 600, fontSize: '13px', transition: 'all 0.2s' }}
                      >
                        {branch === "ALL" ? "All Branches" : branch}
                      </div>
                    ))}
                  </div>
                </IonPopover>
              </div>

              {/* From Date */}
              <div style={{ flexShrink: 0, minWidth: '160px' }} onClick={() => setStartModalOpen(true)}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>From Date</label>
                <div className="stock-input" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '0 16px', height: '46px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <IonIcon icon={calendarOutline} style={{ color: 'var(--ion-color-primary, #0d9488)', fontSize: '18px' }} />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{moment(fromDate).format("DD MMM YYYY")}</span>
                </div>
              </div>
              
              {/* To Date */}
              <div style={{ flexShrink: 0, minWidth: '160px' }} onClick={() => setEndModalOpen(true)}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>To Date</label>
                <div className="stock-input" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '0 16px', height: '46px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <IonIcon icon={calendarOutline} style={{ color: 'var(--ion-color-primary, #0d9488)', fontSize: '18px' }} />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{moment(toDate).format("DD MMM YYYY")}</span>
                </div>
              </div>
              
              {/* PDF Button */}
              <button
                onClick={downloadPDF}
                disabled={leaves.length === 0}
                style={{ flexShrink: 0, background: '#f8fafc', color: 'var(--ion-color-primary, #0d9488)', border: '1px solid #e2e8f0', padding: '0 16px', height: '46px', borderRadius: '12px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s', opacity: leaves.length === 0 ? 0.5 : 1 }}
              >
                <IonIcon icon={documentOutline} style={{ fontSize: '18px' }} />
                PDF
              </button>

              {/* Search Button */}
              <button 
                onClick={loadData} 
                disabled={isLoading}
                style={{ 
                  flexShrink: 0, background: 'var(--ion-color-primary, #0d9488)', color: 'white', border: 'none', padding: '0 24px', height: '46px', borderRadius: '12px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(13, 148, 136, 0.2)', minWidth: '120px'
                }}
              >
                {isLoading ? <IonSpinner name="crescent" style={{ width: '20px', height: '20px' }} /> : (
                  <>
                    <IonIcon icon={searchOutline} style={{ fontSize: '18px' }} />
                    Search
                  </>
                )}
              </button>
            </div>
          </div>

        <div className="lr-results-section">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {leaves.length > 0 ? (
                leaves.map((entry: any, index: number) => {
                  const status = renderSafe(entry.L_status).toLowerCase();
                  const isPermission = renderSafe(entry.ltype) === "Permission";
                  const scClass = statusClass(status);
                  
                  return (
                    <div key={entry.lid || index} className={`stock-panel ${scClass}`} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', borderRadius: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>
                            {entry.empcode} - {entry.empname}
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{entry.ltype}</span>
                        </div>
                        <div className={`grace-chip ${scClass}`} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', fontWeight: 700, textTransform: 'uppercase' }}>
                          {entry.L_status}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: '12px', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#475569' }}>
                          <IonIcon icon={calendarOutline} style={{ fontSize: '16px', color: '#94a3b8', marginTop: '2px' }} />
                          <div style={{ flex: 1, fontWeight: 500 }}>
                            {renderSafe(entry.lfrom)} {entry.lto && typeof entry.lto === 'string' && entry.lto !== entry.lfrom ? `- ${entry.lto}` : ""}
                          </div>
                        </div>
                        
                        {isPermission && typeof entry.Ptime === "string" && entry.Ptime && (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#475569' }}>
                            <IonIcon icon={timeOutline} style={{ fontSize: '16px', color: '#94a3b8', marginTop: '2px' }} />
                            <div style={{ flex: 1, fontWeight: 500 }}>{entry.Ptime}</div>
                          </div>
                        )}
                        
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#475569' }}>
                          <IonIcon icon={chatbubbleEllipsesOutline} style={{ fontSize: '16px', color: '#94a3b8', marginTop: '2px' }} />
                          <div style={{ flex: 1, fontStyle: 'italic', opacity: 0.8 }}>
                            {entry.remarks}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                  <IonIcon icon={layersOutline} style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }} />
                  <p style={{ fontWeight: 500, fontSize: '15px' }}>No leaves found for the selected criteria.</p>
                </div>
              )}
            </div>
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
    