import { IonContent, IonPage, IonIcon, IonSpinner, IonModal } from "@ionic/react";
import {
  arrowBackOutline, calendarOutline, searchOutline,
  personOutline, downloadOutline, chevronBackOutline,
  chevronForwardOutline, timeOutline, alertCircleOutline,
  checkmarkDoneOutline, airplaneOutline, printOutline
} from "ionicons/icons";
import { useEffect, useState } from "react";
import { useHistory } from "react-router";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { API_BASE } from "../../config";
import "./HRAttendanceMatrix.css";

interface Employee {
  empCode: string;
  empName: string;
  department: string;
  branch?: string;
}

interface DayAttendance {
  morningIn?: string;
  lunchOut?: string;
  lunchIn?: string;
  eveningOut?: string;
  morningLate: number;
  lunchLate: number;
  permOverstay: number;
  totalLate: number;
  graceType?: string;
  attendanceStatus?: string;
  lopMinutes?: number;
}

interface DayLeave {
  leaveType: string;
  leaveMode: string;
  leaveCategory: string;
  remarks: string;
  status: string;
  pTime: string;
}

export const HRAttendanceMatrix: React.FC = () => {
  const history = useHistory();
  const today = new Date();

  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [matrix, setMatrix] = useState<Record<string, DayAttendance>>({});
  const [leaves, setLeaves] = useState<Record<string, DayLeave>>({});
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [monthlyTotals, setMonthlyTotals] = useState<Record<string, number>>({});
  const [daysInMonth, setDaysInMonth] = useState<number>(31);

  // Active cell modal
  const [selectedCell, setSelectedCell] = useState<{
    employee: Employee;
    dateStr: string;
    dayNum: number;
    dayName: string;
    attendance?: DayAttendance;
    leave?: DayLeave;
    holiday?: string;
  } | null>(null);

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const BRANCHES = ["ALL", "Eluru", "Vijayawada", "Tadepalligudem", "Tanuku", "Bhimavaram", "Rajahmundry", "Vizag"];

  useEffect(() => {
    fetchMatrix();
  }, [selectedYear, selectedMonth, selectedBranch]);

  async function fetchMatrix() {
    setLoading(true);
    const token = localStorage.getItem("token") || "";
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': 'dbase-ai-master-key-2026',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    try {
      const url = `${API_BASE}Checkin/GetHRMonthlyAttendanceMatrix?year=${selectedYear}&month=${selectedMonth}&branch=${encodeURIComponent(selectedBranch)}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const d = await res.json();
        if (d.success) {
          setDaysInMonth(d.daysInMonth || 31);
          setEmployees(d.employees || []);
          setMatrix(d.matrix || {});
          setLeaves(d.leaves || {});
          setHolidays(d.holidays || {});
          setMonthlyTotals(d.monthlyTotals || {});
        }
      }
    } catch (e) {
      console.error("Error fetching HR matrix", e);
    } finally {
      setLoading(false);
    }
  }

  function shiftMonth(delta: number) {
    let newM = selectedMonth + delta;
    let newY = selectedYear;
    if (newM > 12) {
      newM = 1;
      newY += 1;
    } else if (newM < 1) {
      newM = 12;
      newY -= 1;
    }
    setSelectedMonth(newM);
    setSelectedYear(newY);
  }

  function getDayName(day: number): string {
    const d = new Date(selectedYear, selectedMonth - 1, day);
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }

  function isSunday(day: number): boolean {
    const d = new Date(selectedYear, selectedMonth - 1, day);
    return d.getDay() === 0;
  }

  function formatDateStr(day: number): string {
    const m = String(selectedMonth).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${selectedYear}-${m}-${d}`;
  }

  function exportToCSV() {
    let csv = `S.No,Emp Code,Employee Name,Department`;
    for (let day = 1; day <= daysInMonth; day++) {
      csv += `,Day ${day} (${getDayName(day)})`;
    }
    csv += `,Total Month Late Mins\n`;

    filteredEmployees.forEach((emp, index) => {
      csv += `${index + 1},"${emp.empCode}","${emp.empName}","${emp.department}"`;
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = formatDateStr(day);
        const key = `${emp.empCode}_${dateStr}`;
        const att = matrix[key];
        const lve = leaves[key];

        let val = "0";
        if (att && att.totalLate > 0) {
          val = `${att.totalLate}m`;
        } else if (lve) {
          val = `Leave (${lve.leaveType})`;
        } else if (isSunday(day)) {
          val = "Sunday";
        }
        csv += `,"${val}"`;
      }
      csv += `,${monthlyTotals[emp.empCode] || 0}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `HR_Attendance_Matrix_${selectedYear}_${selectedMonth}.csv`);
    a.click();
  }

  function exportToPDF() {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    // Page title & metadata
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42); // #0f172a
    doc.text(`HR MONTHLY ATTENDANCE MATRIX — ${MONTH_NAMES[selectedMonth - 1].toUpperCase()} ${selectedYear}`, 14, 13);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139); // #64748b
    doc.text(`Branch: ${selectedBranch === 'ALL' ? 'All Branches' : selectedBranch}  |  Total Active Employees: ${filteredEmployees.length}  |  Generated on: ${new Date().toLocaleDateString('en-GB')}`, 14, 18);

    // Prepare table headers
    const headRow: string[] = ["S.No", "Code", "Employee Name"];
    for (let day = 1; day <= daysInMonth; day++) {
      headRow.push(`${day}`);
    }
    headRow.push("Total Late");

    // Prepare table data rows
    const bodyRows: (string | number)[][] = filteredEmployees.map((emp, index) => {
      const row: (string | number)[] = [
        index + 1,
        emp.empCode,
        emp.empName.length > 20 ? emp.empName.substring(0, 20) + "…" : emp.empName
      ];

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = formatDateStr(day);
        const key = `${emp.empCode}_${dateStr}`;
        const att = matrix[key];
        const lve = leaves[key];
        const hol = holidays[dateStr];
        const sun = isSunday(day);

        let cellText = "-";
        if (att && att.totalLate > 0) {
          cellText = `${att.totalLate}m`;
        } else if (lve) {
          const lShort = lve.leaveType.replace(/leave/gi, "").trim().substring(0, 3).toUpperCase();
          cellText = lShort || "LVE";
        } else if (hol) {
          cellText = "H";
        } else if (sun) {
          cellText = "Sun";
        } else if (att && (att.morningIn || att.lunchIn)) {
          cellText = "✓";
        }
        row.push(cellText);
      }

      row.push(`${monthlyTotals[emp.empCode] || 0}m`);
      return row;
    });

    // Column style configs for fitting A4 Landscape (297mm width)
    // Left Margin: 10mm, Right Margin: 10mm => Printable Width = 277mm
    // S.No: 7mm, Code: 11mm, Name: 31mm, Total Late: 14mm => Total 63mm
    // Remaining width = 214mm for 31 days => ~6.9mm per day column
    const columnStylesConfig: Record<number, any> = {
      0: { cellWidth: 7, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 11, halign: "left" },
      2: { cellWidth: 31, halign: "left", fontStyle: "bold" },
    };

    for (let i = 1; i <= daysInMonth; i++) {
      columnStylesConfig[i + 2] = { cellWidth: 6.8, halign: "center" };
    }
    columnStylesConfig[daysInMonth + 3] = { cellWidth: 14, halign: "center", fontStyle: "bold", textColor: [225, 29, 72] };

    autoTable(doc, {
      head: [headRow],
      body: bodyRows,
      startY: 22,
      margin: { left: 10, right: 10, top: 22, bottom: 10 },
      styles: {
        fontSize: 5.5,
        cellPadding: 0.8,
        valign: "middle",
        overflow: "ellipsize",
        lineColor: [226, 232, 240],
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 6,
        fontStyle: "bold",
        halign: "center"
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: columnStylesConfig,
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index >= 3 && data.column.index <= daysInMonth + 2) {
          const val = String(data.cell.raw);
          if (val.endsWith("m")) {
            const mins = parseInt(val, 10);
            if (mins > 15) {
              data.cell.styles.fillColor = [254, 242, 242]; // red
              data.cell.styles.textColor = [225, 29, 72];
              data.cell.styles.fontStyle = "bold";
            } else {
              data.cell.styles.fillColor = [254, 243, 199]; // amber
              data.cell.styles.textColor = [180, 83, 9];
              data.cell.styles.fontStyle = "bold";
            }
          } else if (val === "Sun") {
            data.cell.styles.textColor = [239, 68, 68];
            data.cell.styles.fillColor = [250, 250, 250];
          } else if (val === "✓") {
            data.cell.styles.textColor = [16, 185, 129];
            data.cell.styles.fontStyle = "bold";
          }
        }
      }
    });

    doc.save(`HR_Attendance_Matrix_${selectedYear}_${selectedMonth}.pdf`);
  }

  const filteredEmployees = employees
    .filter(emp =>
      emp.empName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.empCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const codeA = parseInt(a.empCode, 10) || 0;
      const codeB = parseInt(b.empCode, 10) || 0;
      return codeA - codeB;
    });

  return (
    <IonPage className="hr-matrix-page">
      <IonContent fullscreen className="hr-matrix-content">

        {/* ── TOP HEADER BAR ── */}
        <div className="hr-matrix-header">
          <button className="back-btn" onClick={() => history.goBack()}>
            <IonIcon icon={arrowBackOutline} />
          </button>
          <div className="title-area">
            <h1 className="title-text">HR MONTHLY ATTENDANCE MATRIX</h1>
            <p className="subtitle-text">Active Employee Roster & Daily Late Minutes Overview</p>
          </div>

          <div className="header-controls">
            {/* Month & Year Navigator */}
            <div className="month-picker-pill">
              <button className="mnav-btn" onClick={() => shiftMonth(-1)}>
                <IonIcon icon={chevronBackOutline} />
              </button>
              <div className="mnav-label">
                <IonIcon icon={calendarOutline} />
                <span>{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</span>
              </div>
              <button className="mnav-btn" onClick={() => shiftMonth(1)}>
                <IonIcon icon={chevronForwardOutline} />
              </button>
            </div>

            {/* Branch Filter */}
            <select
              className="branch-select-pill"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              {BRANCHES.map(b => (
                <option key={b} value={b}>{b === "ALL" ? "All Branches" : b}</option>
              ))}
            </select>

            {/* Export CSV Button */}
            <button className="export-csv-btn" onClick={exportToCSV}>
              <IonIcon icon={downloadOutline} />
              <span>Export CSV</span>
            </button>

            {/* Export PDF Button */}
            <button className="export-pdf-btn" onClick={exportToPDF}>
              <IonIcon icon={printOutline} />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* ── SEARCH & SUMMARY STATS ── */}
        <div className="sub-header-bar">
          <div className="search-box-pill">
            <IonIcon icon={searchOutline} />
            <input
              type="text"
              placeholder="Search by Employee Name, Code or Department…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && <button onClick={() => setSearchQuery("")}>✕</button>}
          </div>

          <div className="matrix-stats-pills">
            <div className="mstat-chip total-emp">
              <IonIcon icon={personOutline} />
              <span>{filteredEmployees.length} Employees</span>
            </div>
            <div className="mstat-chip total-days">
              <IonIcon icon={calendarOutline} />
              <span>{daysInMonth} Days in Month</span>
            </div>
          </div>
        </div>

        {/* ── MATRIX TABLE CONTAINER ── */}
        {loading ? (
          <div className="matrix-loading-state">
            <IonSpinner name="crescent" color="primary" />
            <p>Loading HR Monthly Matrix Data…</p>
          </div>
        ) : (
          <div className="matrix-table-wrapper">
            <table className="hr-matrix-table">
              <thead>
                <tr>
                  <th className="sticky-col col-sno">S.No</th>
                  <th className="sticky-col col-emp">Employee Code & Name</th>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                    const sun = isSunday(day);
                    const dateStr = formatDateStr(day);
                    const hol = holidays[dateStr];
                    return (
                      <th
                        key={day}
                        className={`col-day ${sun ? 'day-sunday' : ''} ${hol ? 'day-holiday' : ''}`}
                        title={hol || (sun ? 'Sunday' : `Day ${day}`)}
                      >
                        <div className="day-num">{day}</div>
                        <div className="day-name">{getDayName(day)}</div>
                        {hol && <span className="hol-indicator">🌴</span>}
                      </th>
                    );
                  })}
                  <th className="sticky-col-right col-total">Total Late</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={daysInMonth + 3} className="no-data-cell">
                      No matching active employees found for selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp, index) => {
                    const totalMonthLate = monthlyTotals[emp.empCode] || 0;

                    return (
                      <tr key={emp.empCode} className="matrix-row">
                        <td className="sticky-col col-sno">{index + 1}</td>
                        <td className="sticky-col col-emp">
                          <div className="emp-name">{emp.empName}</div>
                          <div className="emp-sub">#{emp.empCode} • {emp.department || "Staff"}</div>
                        </td>

                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                          const dateStr = formatDateStr(day);
                          const key = `${emp.empCode}_${dateStr}`;
                          const att = matrix[key];
                          const lve = leaves[key];
                          const hol = holidays[dateStr];
                          const sun = isSunday(day);

                          let cellContent = null;
                          let cellClass = "cell-normal";

                          if (att && att.totalLate > 0) {
                            cellClass = att.totalLate <= 15 ? "cell-grace" : "cell-late";
                            cellContent = (
                              <div className="cell-late-chip">
                                <span>{att.totalLate}m</span>
                              </div>
                            );
                          } else if (lve) {
                            cellClass = "cell-leave";
                            cellContent = (
                              <div className="cell-leave-chip" title={`${lve.leaveType}: ${lve.remarks}`}>
                                🏖️ <span>{lve.leaveType.substring(0, 4)}</span>
                              </div>
                            );
                          } else if (hol) {
                            cellClass = "cell-holiday";
                            cellContent = <span className="off-text">Holid.</span>;
                          } else if (sun) {
                            cellClass = "cell-sunday";
                            cellContent = <span className="off-text">Sun</span>;
                          } else if (att && (att.morningIn || att.lunchIn)) {
                            cellClass = "cell-present";
                            cellContent = <span className="on-time-text">✓</span>;
                          } else {
                            cellContent = <span className="dash-text">-</span>;
                          }

                          return (
                            <td
                              key={day}
                              className={`matrix-cell ${cellClass}`}
                              onClick={() => setSelectedCell({
                                employee: emp,
                                dateStr,
                                dayNum: day,
                                dayName: getDayName(day),
                                attendance: att,
                                leave: lve,
                                holiday: hol
                              })}
                            >
                              {cellContent}
                            </td>
                          );
                        })}

                        <td className={`sticky-col-right col-total ${totalMonthLate > 0 ? 'has-late' : ''}`}>
                          <strong>{totalMonthLate}m</strong>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── DAY DETAILS POPUP MODAL ── */}
        <IonModal
          isOpen={!!selectedCell}
          onDidDismiss={() => setSelectedCell(null)}
          className="day-detail-modal-v2"
        >
          {selectedCell && (() => {
            const att = selectedCell.attendance;
            const lve = selectedCell.leave;
            const hol = selectedCell.holiday;

            const initials = selectedCell.employee.empName
              .split(' ')
              .slice(0, 2)
              .map(n => n[0] || '')
              .join('')
              .toUpperCase();

            const mLate = att?.morningLate ?? 0;
            const lLate = att?.lunchLate ?? 0;
            const pOverstay = att?.permOverstay ?? 0;
            const tLate = att?.totalLate ?? (mLate + lLate + pOverstay);

            return (
              <div className="modal-inner-v2">
                {/* ── HEADER HERO ── */}
                <div className="modal-hero">
                  <div className="hero-avatar">
                    {initials}
                  </div>
                  <div className="hero-meta">
                    <h2 className="hero-name">{selectedCell.employee.empName}</h2>
                    <div className="hero-tags">
                      <span className="htag-id">#{selectedCell.employee.empCode}</span>
                      <span className="htag-dept">{selectedCell.employee.department || "Staff"}</span>
                    </div>
                  </div>
                  <button className="modal-close-icon" onClick={() => setSelectedCell(null)}>✕</button>
                </div>

                {/* ── DATE BAR ── */}
                <div className="modal-date-strip">
                  <div className="mdate-pill">
                    <IonIcon icon={calendarOutline} />
                    <span>{selectedCell.dayName}, {selectedCell.dateStr}</span>
                  </div>
                  {att?.attendanceStatus && (
                    <span className={`mstatus-badge status-${att.attendanceStatus.toLowerCase().replace(/\s+/g, '-')}`}>
                      {att.attendanceStatus}
                    </span>
                  )}
                </div>

                <div className="modal-scroll-body">
                  {/* ── TIME SLOTS 4-GRID ── */}
                  <div className="section-block">
                    <div className="block-head">
                      <IonIcon icon={timeOutline} />
                      <span>CHECK-IN & OUT PUNCHES</span>
                    </div>
                    <div className="punches-4grid">
                      <div className={`punch-card ${att?.morningIn ? 'punched' : ''}`}>
                        <span className="punch-icon">☀️</span>
                        <span className="punch-time">{att?.morningIn || '--:--'}</span>
                        <span className="punch-label">Morning In</span>
                      </div>
                      <div className={`punch-card ${att?.lunchOut ? 'punched' : ''}`}>
                        <span className="punch-icon">🍱</span>
                        <span className="punch-time">{att?.lunchOut || '--:--'}</span>
                        <span className="punch-label">Lunch Out</span>
                      </div>
                      <div className={`punch-card ${att?.lunchIn ? 'punched' : ''}`}>
                        <span className="punch-icon">🥗</span>
                        <span className="punch-time">{att?.lunchIn || '--:--'}</span>
                        <span className="punch-label">Lunch In</span>
                      </div>
                      <div className={`punch-card ${att?.eveningOut ? 'punched' : ''}`}>
                        <span className="punch-icon">🌆</span>
                        <span className="punch-time">{att?.eveningOut || '--:--'}</span>
                        <span className="punch-label">Evening Out</span>
                      </div>
                    </div>
                  </div>

                  {/* ── LATE MINUTES AUDIT CARD ── */}
                  {att && (mLate > 0 || lLate > 0 || pOverstay > 0 || tLate > 0) ? (
                    <div className="section-block late-audit-card">
                      <div className="block-head">
                        <IonIcon icon={alertCircleOutline} />
                        <span>LATE & OVERSTAY AUDIT</span>
                      </div>

                      <div className="late-grid-3">
                        <div className="late-chip-item morning">
                          <span className="lchip-title">☀️ Morning Late</span>
                          <span className="lchip-value">{mLate}m</span>
                        </div>
                        <div className="late-chip-item lunch">
                          <span className="lchip-title">🍱 Lunch Late</span>
                          <span className="lchip-value">{lLate}m</span>
                        </div>
                        <div className="late-chip-item overstay">
                          <span className="lchip-title">⏳ Perm Overstay</span>
                          <span className="lchip-value">{pOverstay}m</span>
                        </div>
                      </div>

                      <div className="total-late-banner">
                        <div className="tlb-left">
                          <span className="tlb-label">TOTAL LATE MINUTES</span>
                          <span className="tlb-val">{tLate} min</span>
                        </div>
                        {att.graceType && (
                          <div className="tlb-right">
                            <span className="tlb-grace">{att.graceType}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (!lve && !hol && (
                    <div className="section-block on-time-card">
                      <div className="ontime-inner">
                        <IonIcon icon={checkmarkDoneOutline} />
                        <span>Punctual & On-Time Performance (0 Late Minutes)</span>
                      </div>
                    </div>
                  ))}

                  {/* ── LEAVE RECORD FROM tbl_leaves ── */}
                  {lve && (
                    <div className="section-block leave-glass-card">
                      <div className="block-head">
                        <IonIcon icon={airplaneOutline} />
                        <span>LEAVE / PERMISSION RECORD (tbl_leaves)</span>
                      </div>
                      <div className="leave-info-grid">
                        <div className="linfo-item">
                          <span className="lkey">Leave Type</span>
                          <span className="lval">{lve.leaveType}</span>
                        </div>
                        <div className="linfo-item">
                          <span className="lkey">Category</span>
                          <span className="lval">{lve.leaveCategory || 'Standard'}</span>
                        </div>
                        <div className="linfo-item">
                          <span className="lkey">Status</span>
                          <span className="lval status-tag">{lve.status}</span>
                        </div>
                        {lve.remarks && (
                          <div className="linfo-item full-width">
                            <span className="lkey">Remarks</span>
                            <span className="lval remark-text">"{lve.remarks}"</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── HOLIDAY BANNER ── */}
                  {hol && (
                    <div className="section-block holiday-glass-card">
                      <div className="hol-card-inner">
                        <span className="hol-icon">🌴</span>
                        <div className="hol-text">
                          <span className="hol-title">Official Company Holiday</span>
                          <span className="hol-sub">{hol}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </IonModal>

      </IonContent>
    </IonPage>
  );
};
