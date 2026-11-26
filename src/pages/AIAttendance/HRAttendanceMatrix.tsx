import { IonContent, IonPage, IonIcon, IonSpinner, IonModal } from "@ionic/react";
import {
  arrowBackOutline, calendarOutline, searchOutline,
  personOutline, downloadOutline, chevronBackOutline,
  chevronForwardOutline, timeOutline, alertCircleOutline,
  checkmarkDoneOutline, airplaneOutline, printOutline,
  gridOutline, eyeOutline
} from "ionicons/icons";
import { Fragment, useEffect, useState } from "react";
import { useHistory } from "react-router";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
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
  const [viewMode, setViewMode] = useState<"matrix" | "excel">("matrix");
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

  function formatHHMM(time?: string): string {
    if (!time) return "";
    const trimmed = time.trim();
    if (!trimmed || trimmed === "-") return trimmed;
    const match = trimmed.match(/^(\d{1,2}:\d{2}):\d{2}(\s*[APap][Mm])?$/);
    return match ? `${match[1]}${match[2] || ""}` : trimmed;
  }

  function exportExcelRegister() {
    const MONTH_SHORT = [
      "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
      "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
    ];
    const sheetTitle = `Employee Timing Register Sheet ${MONTH_SHORT[selectedMonth - 1]}-${selectedYear}`;

    const totalCols = 2 + daysInMonth * 2;
    const titleRow: (string | number)[] = [sheetTitle, ...Array(totalCols - 1).fill("")];
    const headerRow: (string | number)[] = ["Employee ID & NAME", "SES"];
    const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
    ];

    for (let day = 1; day <= daysInMonth; day++) {
      headerRow.push(day, "");
      const startCol = 2 + (day - 1) * 2;
      merges.push({ s: { r: 1, c: startCol }, e: { r: 1, c: startCol + 1 } });
    }

    const aoa: (string | number)[][] = [titleRow, headerRow];

    filteredEmployees.forEach((emp, idx) => {
      const fnRowIndex = 2 + idx * 2;
      const anRowIndex = fnRowIndex + 1;

      const fnRow: (string | number)[] = [`#${emp.empCode} ${emp.empName}`, "FN"];
      const anRow: (string | number)[] = ["", "AN"];

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = formatDateStr(day);
        const key = `${emp.empCode}_${dateStr}`;
        const att = matrix[key];
        const lve = leaves[key];
        const hol = holidays[dateStr];
        const sun = isSunday(day);

        const mor = formatHHMM(att?.morningIn) || (lve ? lve.leaveType.substring(0, 4) : hol ? "HOL" : sun ? "SUN" : "");
        const lunchOut = formatHHMM(att?.lunchOut);
        const lunchIn = formatHHMM(att?.lunchIn);
        const eveningOut = formatHHMM(att?.eveningOut);

        fnRow.push(mor, lunchOut);
        anRow.push(lunchIn, eveningOut);
      }

      aoa.push(fnRow, anRow);
      merges.push({ s: { r: fnRowIndex, c: 0 }, e: { r: anRowIndex, c: 0 } });
    });

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    worksheet["!merges"] = merges;
    worksheet["!cols"] = [
      { wch: 28 },
      { wch: 6 },
      ...Array.from({ length: daysInMonth * 2 }, () => ({ wch: 8 })),
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Timing Register");
    XLSX.writeFile(
      workbook,
      `Employee_Timing_Register_${MONTH_SHORT[selectedMonth - 1]}_${selectedYear}.xlsx`
    );
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

  function exportExcelPDF() {
    const MONTH_SHORT = [
      "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
      "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
    ];
    const mShort = MONTH_SHORT[selectedMonth - 1];
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a3"
    });

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`Employee Timing Register Sheet ${mShort}-${selectedYear}`, 10, 12);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Branch: ${selectedBranch === "ALL" ? "All Branches" : selectedBranch}  |  Total Active Employees: ${filteredEmployees.length}  |  Generated on: ${new Date().toLocaleDateString("en-GB")}`,
      10,
      17
    );

    const headRow: any[] = [
      { content: "Employee ID & NAME", styles: { halign: "left" } },
      { content: "SES", styles: { halign: "center" } }
    ];
    for (let day = 1; day <= daysInMonth; day++) {
      headRow.push({ content: String(day), colSpan: 2, styles: { halign: "center" } });
    }

    const bodyRows: any[][] = [];
    // Track per-cell late/status metadata for coloring in didParseCell
    const cellStatusMap: Record<string, "ontime" | "grace" | "late" | "holiday"> = {};

    filteredEmployees.forEach((emp, empIdx) => {
      const fnRowIdx = empIdx * 2;
      const anRowIdx = fnRowIdx + 1;

      const fnRow: any[] = [
        {
          content: `${emp.empName}\n#${emp.empCode}`,
          rowSpan: 2,
          styles: { valign: "middle", halign: "left", fontStyle: "bold" }
        },
        { content: "FN", styles: { halign: "center", fontStyle: "bold" } }
      ];
      const anRow: any[] = [
        { content: "AN", styles: { halign: "center", fontStyle: "bold" } }
      ];

      const markStatus = (rowIdx: number, colIdx: number, time?: string, lateMins: number = 0, isHol: boolean = false) => {
        if (isHol && (!time || time === "-")) {
          cellStatusMap[`${rowIdx}_${colIdx}`] = "holiday";
          return;
        }
        if (!time || time.trim() === "" || time.trim() === "-") return;
        if (lateMins > 15) cellStatusMap[`${rowIdx}_${colIdx}`] = "late";
        else if (lateMins > 0) cellStatusMap[`${rowIdx}_${colIdx}`] = "grace";
        else cellStatusMap[`${rowIdx}_${colIdx}`] = "ontime";
      };

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = formatDateStr(day);
        const key = `${emp.empCode}_${dateStr}`;
        const att = matrix[key];
        const lve = leaves[key];
        const hol = holidays[dateStr];
        const sun = isSunday(day);

        const mor = formatHHMM(att?.morningIn) || (lve ? lve.leaveType.substring(0, 4) : hol ? "HOL" : sun ? "SUN" : "");
        const lunchOut = formatHHMM(att?.lunchOut);
        const lunchIn = formatHHMM(att?.lunchIn);
        const eveningOut = formatHHMM(att?.eveningOut);

        const leftCol = 2 + (day - 1) * 2;
        const rightCol = leftCol + 1;

        markStatus(fnRowIdx, leftCol, att?.morningIn, att?.morningLate || 0, !!hol);
        markStatus(fnRowIdx, rightCol, att?.lunchOut, 0, !!hol);
        markStatus(anRowIdx, leftCol, att?.lunchIn, att?.lunchLate || 0, !!hol);
        markStatus(anRowIdx, rightCol, att?.eveningOut, 0, !!hol);

        fnRow.push(mor, lunchOut);
        anRow.push(lunchIn, eveningOut);
      }

      bodyRows.push(fnRow, anRow);
    });

    // A3 landscape = 420mm wide; margins 8mm each => 404mm printable width
    // Emp: 36mm, SES: 7mm => 361mm for 62 sub-columns (~5.82mm each)
    const colWidth = 361 / (daysInMonth * 2);
    const columnStylesConfig: Record<number, any> = {
      0: { cellWidth: 36 },
      1: { cellWidth: 7 }
    };
    for (let i = 0; i < daysInMonth * 2; i++) {
      columnStylesConfig[2 + i] = { cellWidth: colWidth, halign: "center" };
    }

    autoTable(doc, {
      head: [headRow],
      body: bodyRows,
      startY: 20,
      margin: { left: 8, right: 8, top: 20, bottom: 8 },
      styles: {
        fontSize: 4.5,
        cellPadding: 0.6,
        valign: "middle",
        overflow: "ellipsize",
        lineColor: [71, 85, 105],
        lineWidth: 0.1,
        textColor: [15, 23, 42]
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [15, 23, 42],
        fontSize: 5.5,
        fontStyle: "bold",
        lineColor: [51, 65, 85],
        lineWidth: 0.2
      },
      columnStyles: columnStylesConfig,
      didParseCell: (data) => {
        if (data.section === "body") {
          const st = cellStatusMap[`${data.row.index}_${data.column.index}`];
          if (st === "late") {
            data.cell.styles.fillColor = [254, 226, 226];
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = "bold";
          } else if (st === "grace") {
            data.cell.styles.fillColor = [254, 243, 199];
            data.cell.styles.textColor = [180, 83, 9];
            data.cell.styles.fontStyle = "bold";
          } else if (st === "ontime") {
            data.cell.styles.fillColor = [236, 253, 245];
            data.cell.styles.textColor = [5, 150, 105];
            data.cell.styles.fontStyle = "bold";
          } else if (st === "holiday") {
            data.cell.styles.fillColor = [255, 247, 237];
          }
        }
      }
    });

    doc.save(`Employee_Timing_Register_${mShort}_${selectedYear}.pdf`);
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

            {/* Export CSV / Excel Button */}
            <button
              className="export-csv-btn"
              onClick={() => (viewMode === "excel" ? exportExcelRegister() : exportToCSV())}
              title={viewMode === "excel" ? "Download Excel Timing Register (.xlsx)" : "Download Matrix CSV (.csv)"}
            >
              <IonIcon icon={downloadOutline} />
              <span>{viewMode === "excel" ? "Export Excel" : "Export CSV"}</span>
            </button>

            {/* Export PDF Button */}
            <button
              className="export-pdf-btn"
              onClick={() => (viewMode === "excel" ? exportExcelPDF() : exportToPDF())}
              title={viewMode === "excel" ? "Download Excel Timing Register (.pdf)" : "Download Matrix PDF (.pdf)"}
            >
              <IonIcon icon={printOutline} />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* ── SEARCH & SUMMARY STATS ── */}
        <div className="sub-header-bar">
          <div className="sub-header-left">
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

            <button
              type="button"
              className={`excel-view-btn ${viewMode === "matrix" ? "active" : ""}`}
              onClick={() => setViewMode("matrix")}
            >
              <IonIcon icon={gridOutline} />
              <span>Matrix View</span>
            </button>

            <button
              type="button"
              className={`excel-view-btn excel-view-btn--sage ${viewMode === "excel" ? "active" : ""}`}
              onClick={() => setViewMode("excel")}
            >
              <IonIcon icon={eyeOutline} />
              <span>Excel View</span>
            </button>
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
        ) : viewMode === "excel" ? (
          (() => {
            const MONTH_SHORT = [
              "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
              "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
            ];
            const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
            const sheetTitle = `Employee Timing Register Sheet ${MONTH_SHORT[selectedMonth - 1]}-${selectedYear}`;

            const getPunchHighlightClass = (time?: string, lateMins: number = 0): string => {
              if (!time || time.trim() === "" || time.trim() === "-") return "";
              if (lateMins > 15) return "excel-q-late";
              if (lateMins > 0) return "excel-q-grace";
              return "excel-q-ontime";
            };

            const handleExcelCellClick = (emp: Employee, day: number) => {
              const dateStr = formatDateStr(day);
              const key = `${emp.empCode}_${dateStr}`;
              setSelectedCell({
                employee: emp,
                dateStr,
                dayNum: day,
                dayName: getDayName(day),
                attendance: matrix[key],
                leave: leaves[key],
                holiday: holidays[dateStr],
              });
            };

            return (
              <div className="excel-register-wrapper">
                <div className="excel-sheet-title-bar">
                  <h2 className="excel-sheet-title">{sheetTitle}</h2>
                  <div className="excel-legend-strip">
                    <span className="legend-quad-sample">
                      <span className="lq-box">
                        <span>Mor</span>
                        <span>Lunch Out</span>
                        <span>Lunch In</span>
                        <span>Eve</span>
                      </span>
                      <span>4-Timing Cell Format (FN: Mor / Lunch Out • AN: Lunch In / Eve)</span>
                    </span>
                  </div>
                </div>

                <div className="excel-table-scroll">
                  <table className="excel-register-table">
                    <thead>
                      <tr>
                        <th className="excel-th-emp excel-sticky-emp">
                          <div>Employee</div>
                          <div>ID &amp; NAME</div>
                        </th>
                        <th className="excel-th-ses excel-sticky-ses">SES</th>
                        {days.map((day) => {
                          const sun = isSunday(day);
                          const dateStr = formatDateStr(day);
                          const hol = holidays[dateStr];
                          return (
                            <th
                              key={day}
                              className={`excel-th-day ${sun ? "excel-sun-hdr" : ""} ${hol ? "excel-hol-hdr" : ""}`}
                              title={hol || (sun ? "Sunday" : `${day} ${getDayName(day)}`)}
                            >
                              {day}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>

                    <tbody>
                      {filteredEmployees.length === 0 ? (
                        <tr>
                          <td colSpan={daysInMonth + 2} className="excel-no-data">
                            No matching active employees found for selected filters.
                          </td>
                        </tr>
                      ) : (
                        filteredEmployees.map((emp, idx) => {
                          const isAltRow = idx % 2 === 1;
                          const rowBgClass = isAltRow ? "excel-row-alt" : "excel-row-even";

                          return (
                            <Fragment key={emp.empCode}>
                              {/* ── FN ROW (Morning In | Lunch Out) ── */}
                              <tr className={`excel-emp-fn-row ${rowBgClass}`}>
                                <td rowSpan={2} className="excel-td-emp excel-sticky-emp">
                                  <div className="excel-emp-name">{emp.empName}</div>
                                  <div className="excel-emp-code">
                                    #{emp.empCode} {emp.department ? `• ${emp.department}` : ""}
                                  </div>
                                </td>
                                <td className="excel-td-ses excel-sticky-ses">FN</td>
                                {days.map((day) => {
                                  const dateStr = formatDateStr(day);
                                  const key = `${emp.empCode}_${dateStr}`;
                                  const att = matrix[key];
                                  const lve = leaves[key];
                                  const hol = holidays[dateStr];
                                  const sun = isSunday(day);
                                  const statusClass = lve
                                    ? "excel-cell-leave"
                                    : hol
                                    ? "excel-cell-holiday"
                                    : sun
                                    ? "excel-cell-sunday"
                                    : "";

                                  return (
                                    <td
                                      key={day}
                                      className={`excel-day-cell excel-fn-cell ${statusClass}`}
                                      onClick={() => handleExcelCellClick(emp, day)}
                                      title={`${emp.empName} • ${dateStr} (${getDayName(day)})\nMorning In: ${att?.morningIn || "--"}\nLunch Out: ${att?.lunchOut || "--"}`}
                                    >
                                      <div className="excel-split-pair">
                                        <span
                                          className={`excel-q-left ${getPunchHighlightClass(att?.morningIn, att?.morningLate)}`}
                                        >
                                          {att?.morningIn || (lve ? lve.leaveType.substring(0, 4) : hol ? "HOL" : sun ? "SUN" : "-")}
                                        </span>
                                        <span
                                          className={`excel-q-right ${getPunchHighlightClass(att?.lunchOut, 0)}`}
                                        >
                                          {att?.lunchOut || (hol ? "" : "-")}
                                        </span>
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>

                              {/* ── AN ROW (Lunch In | Evening Out) ── */}
                              <tr className={`excel-emp-an-row ${rowBgClass}`}>
                                <td className="excel-td-ses excel-sticky-ses">AN</td>
                                {days.map((day) => {
                                  const dateStr = formatDateStr(day);
                                  const key = `${emp.empCode}_${dateStr}`;
                                  const att = matrix[key];
                                  const lve = leaves[key];
                                  const hol = holidays[dateStr];
                                  const sun = isSunday(day);
                                  const statusClass = lve
                                    ? "excel-cell-leave"
                                    : hol
                                    ? "excel-cell-holiday"
                                    : sun
                                    ? "excel-cell-sunday"
                                    : "";

                                  return (
                                    <td
                                      key={day}
                                      className={`excel-day-cell excel-an-cell ${statusClass}`}
                                      onClick={() => handleExcelCellClick(emp, day)}
                                      title={`${emp.empName} • ${dateStr} (${getDayName(day)})\nLunch In: ${att?.lunchIn || "--"}\nEvening Out: ${att?.eveningOut || "--"}`}
                                    >
                                      <div className="excel-split-pair">
                                        <span
                                          className={`excel-q-left ${getPunchHighlightClass(att?.lunchIn, att?.lunchLate)}`}
                                        >
                                          {att?.lunchIn || (hol ? "" : "-")}
                                        </span>
                                        <span
                                          className={`excel-q-right ${getPunchHighlightClass(att?.eveningOut, 0)}`}
                                        >
                                          {att?.eveningOut || (hol ? "" : "-")}
                                        </span>
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            </Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()
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
