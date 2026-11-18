import React, { useState, useEffect } from "react";
import {
  IonPage,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon
} from "@ionic/react";
import {
  downloadOutline,
  closeOutline,
  documentTextOutline,
  arrowDownCircleOutline,
  arrowUpCircleOutline,
  filterOutline,
  checkmarkCircleOutline,
  listOutline,
  receiptOutline,
  walletOutline,
  chevronBackOutline,
  addOutline,
  trashOutline,
  printOutline,
  createOutline,
  pencilSharp
} from "ionicons/icons";
import { useHistory } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { API_BASE } from "../config";
import "./Invoices.css";

const getUser = () => JSON.parse(localStorage.getItem("user") || "{}");

// Color mapping matching the Angular project:
// Part-B entries are RED (#dc2626)
// 83, 80, AU (SDE), Transport/Freight bills are PURPLE (#7c3aed)
// All other entries (Part-A, Part-C, Part-D, AMC, Software, etc.) are BLUE (#0066cc)
const getCollegeColor = (college: string = "", description: string = "", index: number = 0, invoiceNo: string = "") => {
  const text = `${college || ""} ${description || ""}`.toUpperCase();
  const invNo = String(invoiceNo || "").trim();

  // Part-B is RED
  if (
    text.includes("PART-B") ||
    text.includes("PART -B") ||
    text.includes("PART B")
  ) {
    return "#dc2626"; // Red for Part-B
  }

  // 83, 80, AU (SDE), Transport / Freight are PURPLE
  if (
    invNo === "83" ||
    invNo === "80" ||
    text.includes("AU (SDE)") ||
    text.includes("AU(SDE)") ||
    text.includes("TRANSPORT") ||
    text.includes("FREIGHT") ||
    text.includes("VEHICLE") ||
    text.includes("T05") ||
    text.includes("T06") ||
    text.includes("T07") ||
    text.includes("T08")
  ) {
    return "#7c3aed"; // Purple
  }

  return "#0066cc"; // Blue
};

const formatDateForInput = (val: any) => {
  if (!val) return "";
  const str = String(val).trim();
  if (str === "null" || str === "undefined" || str === "N/A" || str === "") return "";

  if (str.includes("T")) {
    return str.split("T")[0];
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(str)) {
    const parts = str.split(/[-/]/);
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
  } catch (e) { }
  return "";
};

const FormLabel = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="inv-form-label">
    {children} {required && <span className="req">*</span>}
  </label>
);

export interface BillTypeSummary {
  totalBills: number;
  totalPaid: number;
  balance: number;
}

const fetchActualAmount = async (bType: string): Promise<BillTypeSummary | null> => {
  if (!bType || bType === "Select Bill Type" || bType === "Select Type" || bType === "Software") {
    return null;
  }
  try {
    const [bRes, oRes] = await Promise.all([
      axios.get(`${API_BASE}Invoices/Load_InWardBills?BillType=${bType}`),
      axios.get(`${API_BASE}Invoices/Load_OutStandings?BillType=${bType}&Vendor=`)
    ]);
    const bills = bRes.data || [];
    const outstandings = oRes.data || [];
    const totalBills = Math.round(bills.reduce((sum: number, r: any) => sum + (Number(r[12]) || 0), 0));
    const totalPaid = Math.round(outstandings.reduce((sum: number, r: any) => sum + (Number(r[3]) || 0), 0));
    const balance = Math.round(totalBills - totalPaid);
    return { totalBills, totalPaid, balance };
  } catch (e) {
    console.error(e);
    return null;
  }
};

function numberToWords(num: number): string {
  if (!num || isNaN(num)) return "Zero";
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const inWords = (n: number): string => {
    let str = "";
    if (n > 19) {
      str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "");
    } else {
      str += a[n];
    }
    return str;
  };

  let n = Math.floor(num);
  let crore = Math.floor(n / 10000000);
  n %= 10000000;
  let lakh = Math.floor(n / 100000);
  n %= 100000;
  let thousand = Math.floor(n / 1000);
  n %= 1000;
  let hundred = Math.floor(n / 100);
  let rem = n % 100;

  let res = "";
  if (crore > 0) res += inWords(crore) + " Crore ";
  if (lakh > 0) res += inWords(lakh) + " Lakh ";
  if (thousand > 0) res += inWords(thousand) + " Thousand ";
  if (hundred > 0) res += inWords(hundred) + " Hundred ";
  if (rem > 0) {
    if (res !== "") res += "And ";
    res += inWords(rem) + " ";
  }
  return res.trim();
}

const generateInvoicePDF = (
  invNo: string,
  finYr: string,
  clientName: string,
  invoiceWork: string,
  invoiceType: string,
  rawData: any[],
  fallbackDate: string = ""
) => {
  const rows = rawData || [];
  const firstRow = rows[0] || [];

  const invoiceNo = invNo || firstRow[2] || "";
  const financialYear = finYr || firstRow[22] || "";
  const rawDate = firstRow[18] || firstRow[25] || fallbackDate || "";
  let invoiceDate = "";
  if (rawDate) {
    if (String(rawDate).includes("-") && String(rawDate).length === 10 && String(rawDate).indexOf("-") === 2) {
      invoiceDate = String(rawDate).replace(/-/g, "/");
    } else {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        invoiceDate = `${day}/${month}/${year}`;
      } else {
        invoiceDate = String(rawDate);
      }
    }
  }
  const toAddr = firstRow[21] || firstRow[19] || "";
  const refNo = firstRow[24] || (firstRow[23] !== "true" && firstRow[23] !== "false" ? firstRow[23] : "") || "";

  const totalAmount = Number(firstRow[12]) || 0;
  const cgstP = Number(firstRow[13]) || 0;
  const cgstAmount = Number(firstRow[14]) || 0;
  const sgstP = Number(firstRow[15]) || 0;
  const sgstAmount = Number(firstRow[16]) || 0;
  const grandTotal = Number(firstRow[17]) || (totalAmount + cgstAmount + sgstAmount);

  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  // 1. Header Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("SERVICE BILL", 105, 18, { align: "center" });
  const textWidth = doc.getTextWidth("SERVICE BILL");
  doc.setLineWidth(0.4);
  doc.line(105 - textWidth / 2, 19, 105 + textWidth / 2, 19);

  doc.setFontSize(10);
  doc.text("ORIGINAL COPY", 105, 25, { align: "center" });

  // 2. Header Meta
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`INVOICE NUMBER : ${invoiceNo}/${financialYear}`, 14, 34);
  doc.text("PAN : AAICD1854G", 196, 34, { align: "right" });
  doc.text(`DATE :${invoiceDate}`, 196, 39, { align: "right" });

  // 3. To Address
  const addrParts = toAddr.split("&").map((l: string) => l.trim()).filter(Boolean);
  let curY = 44;
  addrParts.forEach((l: string) => {
    doc.text(l, 14, curY);
    curY += 4.5;
  });

  // 4. Ref No
  curY += 1;
  doc.text(`Ref.No.: ${refNo}`, 14, curY);
  curY += 3;

  // 5. Table Data
  const validRows = rows.filter((r: any) => (r[7] && String(r[7]).trim() !== "") || r[9] || r[10] || r[11] || r[6]);
  const tableBody: any[] = validRows.map((r: any) => {
    const isSH = r[8] === "SH" || r[8] === "true" || r[8] === "1" || r[8] === true;
    return [
      { content: isSH ? "" : (r[6] || ""), styles: { fontStyle: isSH ? "bold" : "normal", halign: "center" } },
      { content: r[7] || "", styles: { fontStyle: isSH ? "bold" : "normal" } },
      { content: isSH ? "" : (r[9] ? String(r[9]) : ""), styles: { halign: "center" } },
      { content: isSH ? "" : (r[10] ? Number(r[10]).toString() : ""), styles: { halign: "center" } },
      { content: isSH ? "" : (r[11] ? Number(r[11]).toFixed(2) : ""), styles: { halign: "right", fontStyle: "bold" } }
    ];
  });

  // Add Totals Rows
  tableBody.push([
    { content: "TOTAL AMOUNT", colSpan: 4, styles: { halign: "right", fontStyle: "bold" } },
    { content: totalAmount.toFixed(2), styles: { halign: "right", fontStyle: "bold" } }
  ]);
  tableBody.push([
    { content: `CGST (${cgstP}%)`, colSpan: 4, styles: { halign: "right", fontStyle: "bold" } },
    { content: cgstAmount.toFixed(2), styles: { halign: "right" } }
  ]);
  tableBody.push([
    { content: `SGST ( ${sgstP}%)`, colSpan: 4, styles: { halign: "right", fontStyle: "bold" } },
    { content: sgstAmount.toFixed(2), styles: { halign: "right" } }
  ]);

  const wordsText = `Amount In Words : Rupees (in words) ${numberToWords(grandTotal)} Only.`;
  tableBody.push([
    { content: wordsText, colSpan: 4, styles: { halign: "left", fontStyle: "italic" } },
    { content: grandTotal.toFixed(2), styles: { halign: "right", fontStyle: "bold" } }
  ]);

  autoTable(doc, {
    startY: curY,
    head: [["SNo.", "DESCRIPTION OF THE WORK", "NO'S", "PER\nCANDIDATE\nin Rs.", "AMOUNT (Rs.)"]],
    body: tableBody,
    theme: "plain",
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      textColor: [0, 0, 0],
      font: "helvetica"
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      lineColor: [0, 0, 0],
      lineWidth: 0.3
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 104, halign: "left" },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 26, halign: "center" },
      4: { cellWidth: 24, halign: "right" }
    },
    margin: { left: 14, right: 14 }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 200;

  // 6. Footer
  const footerY = Math.max(finalY + 8, 235);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("For  D BASE SOLUTIONS Pvt.Ltd.", 196, footerY, { align: "right" });

  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(9);
  doc.text("Receiver's Signature", 30, footerY + 28);
  doc.text("Authorised Signature", 180, footerY + 28, { align: "right" });

  doc.save(`Invoice_${clientName}_${invoiceNo}_${financialYear}.pdf`);
};

const generateAbstractPDF = (
  sno: string,
  clientName: string,
  yr: string,
  rawData: any[]
) => {
  const rows = rawData || [];
  const firstRow = rows[0] || [];

  const abstractNo = firstRow[1] || sno || "";
  const financialYear = firstRow[2] || yr || "";
  const client = firstRow[5] || clientName || "";
  const rawDate = firstRow[4] || "";
  let abstractDate = "";
  if (rawDate) {
    if (String(rawDate).includes("-") && String(rawDate).length === 10 && String(rawDate).indexOf("-") === 2) {
      abstractDate = String(rawDate).replace(/-/g, "/");
    } else {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        abstractDate = `${day}/${month}/${year}`;
      } else {
        abstractDate = String(rawDate);
      }
    }
  }

  const toAddr = firstRow[7] || "";
  const subject = firstRow[8] || "";
  const refNo = firstRow[9] || "";

  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  // 1. Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("OUTWARD ABSTRACT", 105, 18, { align: "center" });
  const textWidth = doc.getTextWidth("OUTWARD ABSTRACT");
  doc.setLineWidth(0.4);
  doc.line(105 - textWidth / 2, 19, 105 + textWidth / 2, 19);

  // 2. Meta
  doc.setFontSize(9);
  doc.text(`ABSTRACT NO : ${abstractNo}/${financialYear}`, 14, 32);
  doc.text("PAN : AAICD1854G", 196, 32, { align: "right" });
  doc.text(`DATE :${abstractDate}`, 196, 37, { align: "right" });

  // 3. To Address
  const addrParts = toAddr.split(/[\n&]/).map((l: string) => l.trim()).filter(Boolean);
  let curY = 42;
  addrParts.forEach((l: string) => {
    doc.text(l, 14, curY);
    curY += 4.5;
  });

  // 4. Ref No
  if (refNo) {
    curY += 1;
    doc.text(`Ref.No.: ${refNo}`, 14, curY);
    curY += 5;
  }

  // 5. Subject
  if (subject) {
    doc.setFont("helvetica", "bold");
    doc.text("Sub: ", 14, curY);
    doc.setFont("helvetica", "normal");
    const subLines = doc.splitTextToSize(subject, 160);
    doc.text(subLines, 24, curY);
    curY += subLines.length * 4.5 + 3;
  }

  // 6. Table
  let total = 0;
  const tableBody: any[] = rows.map((r: any, i: number) => {
    const amt = Number(r[12]) || 0;
    total += amt;
    return [
      { content: String(i + 1), styles: { halign: "center" } },
      { content: r[11] || "", styles: { halign: "center", fontStyle: "bold" } },
      { content: r[10] || "", styles: { halign: "center" } },
      { content: amt.toFixed(2), styles: { halign: "right", fontStyle: "bold" } }
    ];
  });

  tableBody.push([
    { content: "TOTAL AMOUNT", colSpan: 3, styles: { halign: "right", fontStyle: "bold" } },
    { content: total.toFixed(2), styles: { halign: "right", fontStyle: "bold" } }
  ]);

  tableBody.push([
    { content: `Amount In Words : Rupees (in words) ${numberToWords(total)} Only.`, colSpan: 3, styles: { halign: "left", fontStyle: "italic" } },
    { content: total.toFixed(2), styles: { halign: "right", fontStyle: "bold" } }
  ]);

  autoTable(doc, {
    startY: curY,
    head: [["S.No", "Invoice No", "Invoice Date", "Amount (Rs.)"]],
    body: tableBody,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.25, textColor: [0, 0, 0], font: "helvetica" },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold", halign: "center", valign: "middle", lineColor: [0, 0, 0], lineWidth: 0.3 },
    columnStyles: {
      0: { cellWidth: 15, halign: "center" },
      1: { cellWidth: 60, halign: "center" },
      2: { cellWidth: 50, halign: "center" },
      3: { cellWidth: 57, halign: "right" }
    },
    margin: { left: 14, right: 14 }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 200;

  // 7. Footer
  const footerY = Math.max(finalY + 8, 235);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("For  D BASE SOLUTIONS Pvt.Ltd.", 196, footerY, { align: "right" });

  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(9);
  doc.text("Receiver's Signature", 30, footerY + 28);
  doc.text("Authorised Signature", 180, footerY + 28, { align: "right" });

  doc.save(`Abstract_${client}_${abstractNo}_${financialYear}.pdf`);
};

const ALLOWED_INVOICE_DESIGNATIONS = [
  "director",
  "in-charge f&a",
  "incharge f&a",
  "maintenance in-charge",
  "maintenance incharge",
  "accountant"
];

const Invoices: React.FC = () => {
  const [mainTab, setMainTab] = useState("tracking");
  const history = useHistory();
  const user = getUser();
  const userDesignation = String(user?.designation || user?.Designation || "").trim().toLowerCase();
  const isAuthorized = ALLOWED_INVOICE_DESIGNATIONS.includes(userDesignation);

  if (!isAuthorized) {
    return (
      <IonPage>
        <IonContent>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              height: "80vh",
              textAlign: "center",
              padding: "0 16px"
            }}
          >
            <h2 style={{ fontSize: "28px", marginBottom: "10px", color: "#4d7c4f", fontWeight: 700 }}>
              Access Denied
            </h2>
            <h5 style={{ fontSize: "18px", margin: "0 0 10px", color: "#4d7c4f", fontWeight: 600 }}>
              You don’t have permission to access the Invoice Management module.
            </h5>
            <p style={{ fontSize: "16px", margin: "4px 0", color: "#444" }}>
              Please contact the IT Administrator.
            </p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent className="inv-page-content">
        <div className="inv-page-container">
          <div className="inv-unified-shell">
            {/* Hero Header */}
            <div className="inv-hero-header">
              <div className="inv-header-left">
                <button
                  className="inv-back-btn"
                  onClick={() => history.push("/home")}
                  title="Go to Home"
                >
                  <IonIcon icon={chevronBackOutline} />
                </button>
                <div>
                  <h1 className="inv-header-title">Invoice Management</h1>
                  <div className="inv-header-subtitle">
                    <span className="inv-pulse-dot"></span>
                    Financial Inward, Outward &amp; Status Tracking Hub
                  </div>
                </div>
              </div>
              <div className="inv-header-badge">
                <IonIcon icon={receiptOutline} />
                <span>{mainTab.toUpperCase()} MODE</span>
              </div>
            </div>

            {/* Main Navigation Segment Tabs */}
            <div className="inv-main-tabs-container">
              <button
                className={`inv-main-tab-btn ${mainTab === "tracking" ? "active" : ""}`}
                onClick={() => setMainTab("tracking")}
              >
                <IonIcon icon={documentTextOutline} className="inv-tab-icon" />
                <span>Invoice Tracking</span>
              </button>
              <button
                className={`inv-main-tab-btn ${mainTab === "inward" ? "active" : ""}`}
                onClick={() => setMainTab("inward")}
              >
                <IonIcon icon={arrowDownCircleOutline} className="inv-tab-icon" />
                <span>Inward Invoices</span>
              </button>
              <button
                className={`inv-main-tab-btn ${mainTab === "outward" ? "active" : ""}`}
                onClick={() => setMainTab("outward")}
              >
                <IonIcon icon={arrowUpCircleOutline} className="inv-tab-icon" />
                <span>Outward Invoices</span>
              </button>
            </div>

            {/* Tab Content */}
            <div className="inv-content-body">
              {mainTab === "tracking" && <TrackingTab />}
              {mainTab === "inward" && <InwardTab />}
              {mainTab === "outward" && <OutwardTab />}
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

// ==========================================
// TRACKING TAB
// ==========================================
const TrackingTab = () => {
  const [finYrs, setFinYrs] = useState<string[]>([]);
  const [finYr, setFinYr] = useState("");
  const [billType, setBillType] = useState("Select Bill Type");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [actualAmount, setActualAmount] = useState<BillTypeSummary | null>(null);

  const [abstractData, setAbstractData] = useState<any[]>([]);
  const [billsDetails, setBillsDetails] = useState<any[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<{ client: string; status: string } | null>(null);

  const billTypes = ["Select Bill Type", "Service", "Software", "Stationery", "Transport", "Miscellaneous"];

  useEffect(() => {
    axios.get(`${API_BASE}Invoices/Load_FinYr`).then(res => {
      if (res.data && res.data.length > 0) {
        const years = res.data.map((item: any) => item[0] || item);
        setFinYrs(years);
        setFinYr(years[0]);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    setSelectedFilter(null);
  }, [finYr, billType]);

  useEffect(() => {
    if (billType && billType !== "Select Bill Type") {
      fetchActualAmount(billType).then(setActualAmount);
    } else {
      setActualAmount(null);
    }
  }, [billType]);

  useEffect(() => {
    if (finYr) {
      axios.get(`${API_BASE}Invoices/LoadInvoiceStatusAbstract?FinYr=${finYr}&gWorkMode=${billType}`)
        .then(res => setAbstractData(res.data))
        .catch(console.error);
    }
  }, [finYr, billType]);

  useEffect(() => {
    if (finYr) {
      const clientParam = selectedFilter ? (selectedFilter.client.trim() === "TOTAL" ? "ALL" : selectedFilter.client.trim()) : "ALL";
      const statusParam = selectedFilter ? selectedFilter.status : "ALL";

      axios.get(`${API_BASE}Invoices/LoadInvoiceBillsDetails?client=${clientParam}&FinYr=${finYr}&workType=${billType}&gInv_Status=${statusParam}`)
        .then(res => setBillsDetails(res.data))
        .catch(err => {
          console.error(err);
          setBillsDetails([]);
        });
    }
  }, [finYr, billType, selectedFilter]);

  const handleDownload = () => {
    const header = ['Category', 'Raised', 'Inprogress', 'Settled'];
    const rows = abstractData.map(row => [
      row[0] ?? '',
      row[1] ?? '',
      row[2] ?? '',
      row[3] ?? ''
    ]);
    const csvContent = [header, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `InvoiceStatus_${finYr || 'All'}_${billType.replace(/\s+/g, '') || 'All'}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const isSelected = (client: string, status: string) => {
    return selectedFilter !== null && selectedFilter.client.trim() === client.trim() && selectedFilter.status === status;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 90px)" }}>
      {/* Filters Card */}
      <div className="inv-card" style={{ marginBottom: "6px", padding: "6px 10px", flexShrink: 0 }}>
        <div className="inv-filter-bar">
          <div className="inv-form-group">
            <FormLabel required>Fin. Year</FormLabel>
            <select className="inv-select" value={finYr} onChange={e => setFinYr(e.target.value)}>
              {finYrs.map((yr, i) => <option key={i} value={yr}>{yr}</option>)}
            </select>
          </div>
          <div className="inv-form-group">
            <FormLabel required>Bill Type</FormLabel>
            <select className="inv-select" value={billType} onChange={e => setBillType(e.target.value)}>
              {billTypes.map((bt, i) => <option key={i} value={bt}>{bt}</option>)}
            </select>
            {billType && billType !== "Select Bill Type" && actualAmount !== null && (
              <div className="inv-actual-amount-text">
                {billType} Amount - {actualAmount.balance}
              </div>
            )}
          </div>
          <div className="inv-form-group">
            <FormLabel required>Inv. Date From</FormLabel>
            <input type="date" className="inv-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="inv-form-group">
            <FormLabel required>Inv. Date To</FormLabel>
            <input type="date" className="inv-input" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="inv-form-group">
            <button
              type="button"
              className="inv-btn inv-btn-primary"
              style={{ width: "100%", height: "34px" }}
              onClick={handleDownload}
            >
              <IonIcon icon={downloadOutline} style={{ fontSize: "16px" }} />
              <span>DOWNLOAD CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Split Grid: 50% Left Abstract Table + 50% Right Details Feed */}
      <div className="inv-split-grid">
        {/* Left Column: Abstract Summary Table */}
        <div className="inv-card inv-split-card">
          <div className="inv-card-header">
            <h3 className="inv-card-title">
              <IonIcon icon={listOutline} />
              Invoice Status Abstract
            </h3>
            <span className="inv-card-subtitle">{abstractData.length} records</span>
          </div>

          <div className="inv-table-wrapper inv-scrollable">
            <table className="inv-table">
              <thead>
                <tr>
                  <th style={{ width: "38%" }}>CATEGORY / CLIENT</th>
                  <th style={{ width: "20%", textAlign: "center" }}>RAISED</th>
                  <th style={{ width: "21%", textAlign: "center" }}>INPROGRESS</th>
                  <th style={{ width: "21%", textAlign: "center" }}>SETTLED</th>
                </tr>
              </thead>
              <tbody>
                {abstractData.map((row, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: "700", color: "#0f172a" }}>
                      {row[0]}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        paddingRight: "8px",
                        backgroundColor: isSelected(row[0], 'RAISED') ? '#e0f2fe' : 'transparent',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      {row[2] ? (
                        <span
                          onClick={() => setSelectedFilter({ client: row[0], status: 'RAISED' })}
                          style={{
                            cursor: 'pointer',
                            color: '#0066cc',
                            fontWeight: isSelected(row[0], 'RAISED') ? '800' : '600',
                            fontSize: '13px',
                            textDecoration: 'underline'
                          }}
                          title={`Click to view Raised invoices for ${row[0]}`}
                        >
                          {row[2]}
                        </span>
                      ) : null}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        paddingRight: "8px",
                        backgroundColor: isSelected(row[0], 'INPROGRESS') ? '#e0f2fe' : 'transparent',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      {row[1] ? (
                        <span
                          onClick={() => setSelectedFilter({ client: row[0], status: 'INPROGRESS' })}
                          style={{
                            cursor: 'pointer',
                            color: '#0066cc',
                            fontWeight: isSelected(row[0], 'INPROGRESS') ? '800' : '600',
                            fontSize: '13px',
                            textDecoration: 'underline'
                          }}
                          title={`Click to view Inprogress invoices for ${row[0]}`}
                        >
                          {row[1]}
                        </span>
                      ) : null}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        paddingRight: "8px",
                        backgroundColor: isSelected(row[0], 'SETTLED') ? '#e0f2fe' : 'transparent',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      {row[3] ? (
                        <span
                          onClick={() => setSelectedFilter({ client: row[0], status: 'SETTLED' })}
                          style={{
                            cursor: 'pointer',
                            color: '#0066cc',
                            fontWeight: isSelected(row[0], 'SETTLED') ? '800' : '600',
                            fontSize: '13px',
                            textDecoration: 'underline'
                          }}
                          title={`Click to view Settled invoices for ${row[0]}`}
                        >
                          {row[3]}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {abstractData.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "#94a3b8", padding: "20px" }}>
                      No abstract data available for selected year
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Invoice Details Feed */}
        <div className="inv-card inv-split-card">
          <div className="inv-card-header">
            <div>
              <h3 className="inv-card-title">
                <IonIcon icon={receiptOutline} />
                Invoice Details
                {selectedFilter && (
                  <span className="inv-badge inv-badge-raised" style={{ marginLeft: "6px", textTransform: "none" }}>
                    {selectedFilter.status} &bull; {selectedFilter.client}
                  </span>
                )}
              </h3>
            </div>
            {selectedFilter && (
              <button
                type="button"
                onClick={() => setSelectedFilter(null)}
                className="inv-btn inv-btn-danger-outline inv-btn-sm"
              >
                <IonIcon icon={closeOutline} />
                <span>Clear Filter</span>
              </button>
            )}
          </div>

          <div className="inv-bill-feed inv-scrollable">
            {billsDetails.map((bill, i) => {
              const itemColor = getCollegeColor(bill[1], bill[7], i, bill[2]);
              return (
                <div key={i} className="inv-bill-card" style={{ borderLeft: `3px solid ${itemColor}` }}>
                  <div style={{ fontWeight: "700", color: "#000000", fontSize: "13.5px", marginBottom: "3px" }}>
                    {bill[2]} -- {bill[0]} -- {bill[4]}/-
                  </div>
                  <div style={{ color: itemColor, fontWeight: 600, fontSize: "12px", marginBottom: "5px", lineHeight: "1.3" }}>
                    {bill[1]} -- {bill[7]}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "2px", alignItems: "center" }}>
                    <div>
                      <input
                        type="date"
                        className="inv-input"
                        placeholder="Submit Date"
                        value={formatDateForInput(bill[5])}
                        onChange={(e) => {
                          const updated = [...billsDetails];
                          updated[i][5] = e.target.value;
                          setBillsDetails(updated);
                        }}
                        style={{ padding: "3px 6px", fontSize: "12px", height: "28px" }}
                      />
                    </div>
                    <div>
                      <input
                        type="date"
                        className="inv-input"
                        placeholder="Settle Date"
                        value={formatDateForInput(bill[6])}
                        onChange={(e) => {
                          const updated = [...billsDetails];
                          updated[i][6] = e.target.value;
                          setBillsDetails(updated);
                        }}
                        style={{ padding: "3px 6px", fontSize: "12px", height: "28px" }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {billsDetails.length === 0 && (
              <div style={{ textAlign: "center", padding: "30px 16px", color: "#94a3b8" }}>
                <IonIcon icon={receiptOutline} style={{ fontSize: "32px", marginBottom: "6px", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: "13.5px", fontWeight: 500 }}>No invoice records found for current criteria</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// INWARD TAB
// ==========================================
const InwardTab = () => {
  const [subTab, setSubTab] = useState("entry");

  return (
    <div>
      <div className="inv-subtabs-container">
        <button
          className={`inv-subtab-btn ${subTab === "entry" ? "active" : ""}`}
          onClick={() => setSubTab("entry")}
        >
          <IonIcon icon={createOutline} className="inv-subtab-icon" />
          <span>Inward Entry</span>
        </button>
        <button
          className={`inv-subtab-btn ${subTab === "payment" ? "active" : ""}`}
          onClick={() => setSubTab("payment")}
        >
          <IonIcon icon={walletOutline} className="inv-subtab-icon" />
          <span>Inward Payment</span>
        </button>
      </div>

      <div>
        {subTab === "entry" && <InwardEntry />}
        {subTab === "payment" && <InwardPayment />}
      </div>
    </div>
  );
};

const InwardEntry = () => {
  const [billType, setBillType] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [vendor, setVendor] = useState("");
  const [client, setClient] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [cgst, setCgst] = useState<number>(0);
  const [sgst, setSgst] = useState<number>(0);
  const [igst, setIgst] = useState<number>(0);
  const [actualAmount, setActualAmount] = useState<BillTypeSummary | null>(null);

  const [cid, setCid] = useState("");
  const [ident, setIdent] = useState("");
  const [billStatus, setBillStatus] = useState("");
  const [inwardRefNo, setInwardRefNo] = useState("");

  const [vendors, setVendors] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [inwardBills, setInwardBills] = useState<any[]>([]);

  const billTypes = ["Service", "Stationery", "Transport", "Miscellaneous"];

  const handleRowClick = (b: any[]) => {
    // Populate Inward Reference Number (e.g. T09/2025-26, T11/2026-27, etc.) into the Invoice No field
    setInwardRefNo(b[2] || "");
    setInvoiceNo(b[2] || "");
    setBillType(b[1] || "");
    if (b.length > 14) setCid(b[14] || "");
    if (b[4]) setInvoiceDate(b[4].split('T')[0]);
    setVendor(b[5] || "");
    setDescription(b[6] || "");
    setCgst(Number(b[7]) || 0);
    setSgst(Number(b[8]) || 0);
    setIgst(Number(b[9]) || 0);
    setAmount(Number(b[11]) || 0);
    setBillStatus(b[17] || "");
    setIdent(String(b[0] || "0"));
    setClient(b[20] || "");
  };

  useEffect(() => {
    axios.get(`${API_BASE}Invoices/Load_Invoice_Client`).then(res => setClients(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (billType) {
      axios.get(`${API_BASE}Invoices/Load_Vendor_Select?_VendorType=${billType}`)
        .then(res => setVendors(res.data)).catch(console.error);
    }
    loadInwardBills();
  }, [billType]);

  useEffect(() => {
    if (billType && billType !== "Select Type") {
      fetchActualAmount(billType).then(setActualAmount);
    } else {
      setActualAmount(null);
    }
  }, [billType]);

  const loadInwardBills = () => {
    if (billType) {
      axios.get(`${API_BASE}Invoices/Load_InWardBills?BillType=${billType}`)
        .then(res => setInwardBills(res.data || [])).catch(console.error);
    } else {
      Promise.all([
        axios.get(`${API_BASE}Invoices/Load_InWardBills?BillType=Stationery`),
        axios.get(`${API_BASE}Invoices/Load_InWardBills?BillType=Transport`)
      ]).then(([res1, res2]) => {
        const combined = [...(res1.data || []), ...(res2.data || [])];
        combined.sort((a: any, b: any) => {
          const numA = parseInt(a[3]) || 0;
          const numB = parseInt(b[3]) || 0;
          return numB - numA;
        });
        setInwardBills(combined);
      }).catch(console.error);
    }
  };

  const handleSave = () => {
    const payload = {
      _BillType: billType,
      _InWardRefNo: inwardRefNo || "",
      _InvoiceNo: invoiceNo,
      _InvoiceDt: invoiceDate,
      _Vendor: vendor,
      _Description: description,
      _CGST: cgst,
      _SGST: sgst,
      _IGST: igst,
      _VendorForClient: client,
      _Amount: amount,
      _TotalAmount: amount + cgst + sgst + igst,
      _CID: cid || "",
      _BillStatus: billStatus || "TO BE SUBMIT",
      _Ident: ident || "0"
    };
    axios.post(`${API_BASE}Invoices/Save_InWardBill`, payload)
      .then(res => {
        alert("Saved successfully!");
        clearForm();
        loadInwardBills();
      })
      .catch(console.error);
  };

  const clearForm = () => {
    setBillType("");
    setInvoiceNo("");
    setInvoiceDate("");
    setVendor("");
    setClient("");
    setDescription("");
    setAmount(0);
    setCgst(0);
    setSgst(0);
    setIgst(0);
    setCid("");
    setIdent("");
    setBillStatus("");
    setInwardRefNo("");
    setActualAmount(null);
  };

  return (
    <div>
      <div className="inv-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
        <div>
          <h3 className="inv-card-title">
            <IonIcon icon={createOutline} />
            Inward Bill Entry Form
          </h3>
          <span className="inv-card-subtitle">Fill bill particulars below</span>
        </div>
        {billType && actualAmount && (
          <div className="inv-balance-breakdown-bar" title="Calculated from Total Inward Bills minus Total Payments Paid">
            <span className="inv-breakdown-tag inv-tag-bills">
              Total Inward Bills: <strong>₹ {actualAmount.totalBills.toLocaleString('en-IN')}</strong>
            </span>
            <span className="inv-breakdown-op">−</span>
            <span className="inv-breakdown-tag inv-tag-paid">
              Total Paid: <strong>₹ {actualAmount.totalPaid.toLocaleString('en-IN')}</strong>
            </span>
            <span className="inv-breakdown-op">=</span>
            <span className="inv-breakdown-tag inv-tag-balance">
              {billType} Balance Due: <strong>₹ {actualAmount.balance.toLocaleString('en-IN')}</strong>
            </span>
          </div>
        )}
      </div>

      <IonRow>
        <IonCol size="12" sizeMd="2">
          <div className="inv-form-group">
            <FormLabel required>Bill Type</FormLabel>
            <select className="inv-select" value={billType} onChange={e => setBillType(e.target.value)}>
              <option value="">Select Type</option>
              {billTypes.map((b, i) => <option key={i} value={b}>{b}</option>)}
            </select>
            {billType && actualAmount !== null && (
              <div className="inv-actual-amount-text" title="Total Inward Bills − Total Paid = Balance Due">
                Balance Due: ₹ {actualAmount.balance.toLocaleString('en-IN')}
              </div>
            )}
          </div>
        </IonCol>
        <IonCol size="12" sizeMd="2">
          <div className="inv-form-group">
            <FormLabel required>Invoice No</FormLabel>
            <input type="text" placeholder="Invoice No" className="inv-input" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
          </div>
        </IonCol>
        <IonCol size="12" sizeMd="2">
          <div className="inv-form-group">
            <FormLabel required>Invoice Date</FormLabel>
            <input type="date" className="inv-input" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            <div className="inv-date-hint">MM/DD/YYYY</div>
          </div>
        </IonCol>
        <IonCol size="12" sizeMd="3">
          <div className="inv-form-group">
            <FormLabel required>Vendor</FormLabel>
            <select className="inv-select" value={vendor} onChange={e => setVendor(e.target.value)}>
              <option value="">Select Vendor</option>
              {vendors.map((v, i) => <option key={i} value={v[0]}>{v[0]}</option>)}
            </select>
          </div>
        </IonCol>
        <IonCol size="12" sizeMd="3">
          <div className="inv-form-group">
            <FormLabel required>For Client</FormLabel>
            <select className="inv-select" value={client} onChange={e => setClient(e.target.value)}>
              <option value="">Select Client</option>
              {clients.map((c, i) => <option key={i} value={c[0]}>{c[0]}</option>)}
            </select>
          </div>
        </IonCol>
      </IonRow>

      <IonRow>
        <IonCol size="12" sizeMd="4">
          <div className="inv-form-group">
            <FormLabel required>Description</FormLabel>
            <input type="text" placeholder="Enter description..." className="inv-input" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </IonCol>
        <IonCol size="6" sizeMd="2">
          <div className="inv-form-group">
            <FormLabel required>Amount</FormLabel>
            <input type="number" placeholder="0" className="inv-input" value={amount || ""} onChange={e => setAmount(Number(e.target.value))} />
          </div>
        </IonCol>
        <IonCol size="6" sizeMd="1.5">
          <div className="inv-form-group">
            <FormLabel required>CGST</FormLabel>
            <input type="number" placeholder="0" className="inv-input" value={cgst || ""} onChange={e => setCgst(Number(e.target.value))} />
          </div>
        </IonCol>
        <IonCol size="6" sizeMd="1.5">
          <div className="inv-form-group">
            <FormLabel required>SGST</FormLabel>
            <input type="number" placeholder="0" className="inv-input" value={sgst || ""} onChange={e => setSgst(Number(e.target.value))} />
          </div>
        </IonCol>
        <IonCol size="6" sizeMd="1.5">
          <div className="inv-form-group">
            <FormLabel required>IGST</FormLabel>
            <input type="number" placeholder="0" className="inv-input" value={igst || ""} onChange={e => setIgst(Number(e.target.value))} />
          </div>
        </IonCol>
        <IonCol size="12" sizeMd="1.5">
          <div className="inv-form-group">
            <FormLabel required>Total</FormLabel>
            <input
              type="number"
              className="inv-input"
              style={{ fontWeight: "800", color: "#dc2626", background: "#fef2f2", borderColor: "#fecaca" }}
              readOnly
              value={amount + cgst + sgst + igst}
            />
          </div>
        </IonCol>
      </IonRow>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", margin: "6px 0 8px" }}>
        <button type="button" className="inv-btn inv-btn-danger-outline inv-btn-sm" onClick={clearForm}>
          <IonIcon icon={closeOutline} />
          <span>Cancel</span>
        </button>
        <button type="button" className="inv-btn inv-btn-primary inv-btn-sm" onClick={handleSave}>
          <IonIcon icon={checkmarkCircleOutline} />
          <span>Save Inward Bill</span>
        </button>
      </div>

      <div className="inv-card-header" style={{ marginTop: "6px" }}>
        <h3 className="inv-card-title">
          <IonIcon icon={listOutline} />
          Inward Bills Registry
        </h3>
        <span className="inv-card-subtitle">{inwardBills.length} records (Click row to edit)</span>
      </div>

      <div className="inv-table-wrapper inv-scrollable" style={{ height: "calc(100vh - 290px)", maxHeight: "calc(100vh - 290px)", overflowY: "auto" }}>
        <table className="inv-table">
          <thead>
            <tr>
              <th>InWard Ref No</th>
              <th>Invoice No</th>
              <th>Invoice Date</th>
              <th>Vendor</th>
              <th>Description</th>
              <th>Total Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {inwardBills.map((b, i) => (
              <tr key={i} onClick={() => handleRowClick(b)} className="clickable-row" title="Click to auto-fill form">
                <td className="inv-ref-red" style={{ color: "#ff0000", fontWeight: 700 }}>{b[2]}</td>
                <td className="inv-ref-red" style={{ color: "#ff0000", fontWeight: 700 }}>{b[3]}</td>
                <td>{b[4] ? b[4].split('T')[0] : ""}</td>
                <td style={{ fontWeight: 600 }}>{b[5]}</td>
                <td>{b[6]}</td>
                <td style={{ fontWeight: 700, color: "#dc2626" }}>₹ {b[12]}</td>
                <td>
                  <span className="inv-badge inv-badge-neutral">{b[17] || "N/A"}</span>
                </td>
              </tr>
            ))}
            {inwardBills.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "#94a3b8", padding: "28px" }}>
                  No inward bills found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const InwardPayment = () => {
  const [billType, setBillType] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [id, setId] = useState<number>(0);
  const [actualAmount, setActualAmount] = useState<BillTypeSummary | null>(null);

  const [vendors, setVendors] = useState<any[]>([]);
  const [outstandings, setOutstandings] = useState<any[]>([]);

  const billTypes = ["Service", "Stationery", "Transport", "Miscellaneous"];

  useEffect(() => {
    if (billType) {
      axios.get(`${API_BASE}Invoices/Load_Vendor_Select?_VendorType=${billType}`)
        .then(res => setVendors(res.data)).catch(console.error);
    }
  }, [billType]);

  const handleRowClick = (o: any[]) => {
    setBillType(o[1] || "");
    setVendor(o[8] || "");
    setAmount(Number(o[3]) || 0);
    setDescription(o[9] || "");
    setId(Number(o[0]) || 0);
    setPaymentDate(formatDateForInput(o[4]));
  };

  const handleSave = () => {
    const payload = {
      _ID: id || 0,
      _PayAmount: amount,
      _PayDt: paymentDate,
      _EMPCode: getUser()?.empCode || "",
      _Vendor: vendor,
      _BillType: billType,
      _Description: description
    };
    axios.post(`${API_BASE}Invoices/Save_InWard_Payment`, payload)
      .then(res => {
        alert("Payment Saved!");
        clearForm();
        loadOutstandings();
      })
      .catch(console.error);
  };

  useEffect(() => {
    if (billType && billType !== "Select Type") {
      fetchActualAmount(billType).then(setActualAmount);
    } else {
      setActualAmount(null);
    }
  }, [billType]);

  const loadOutstandings = () => {
    if (billType) {
      axios.get(`${API_BASE}Invoices/Load_OutStandings?BillType=${billType}&Vendor=${vendor}`)
        .then(res => setOutstandings(res.data || [])).catch(console.error);
    } else {
      Promise.all([
        axios.get(`${API_BASE}Invoices/Load_OutStandings?BillType=Service&Vendor=${vendor || ""}`),
        axios.get(`${API_BASE}Invoices/Load_OutStandings?BillType=Stationery&Vendor=${vendor || ""}`)
      ]).then(([res1, res2]) => {
        const combined = [...(res1.data || []), ...(res2.data || [])];
        combined.sort((a: any, b: any) => {
          const idA = parseInt(a[0]) || 0;
          const idB = parseInt(b[0]) || 0;
          return idB - idA;
        });
        setOutstandings(combined);
      }).catch(console.error);
    }
  };

  useEffect(() => {
    loadOutstandings();
  }, [vendor, billType]);

  const clearForm = () => {
    setBillType("");
    setPaymentDate("");
    setVendor("");
    setAmount(0);
    setDescription("");
    setId(0);
    setActualAmount(null);
  };

  return (
    <div>
      <div className="inv-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
        <div>
          <h3 className="inv-card-title">
            <IonIcon icon={walletOutline} />
            Inward Payment Settlement
          </h3>
          <span className="inv-card-subtitle">Record payment against outstanding dues</span>
        </div>
        {billType && actualAmount && (
          <div className="inv-balance-breakdown-bar" title="Calculated from Total Inward Bills minus Total Payments Paid">
            <span className="inv-breakdown-tag inv-tag-bills">
              Total Inward Bills: <strong>₹ {actualAmount.totalBills.toLocaleString('en-IN')}</strong>
            </span>
            <span className="inv-breakdown-op">−</span>
            <span className="inv-breakdown-tag inv-tag-paid">
              Total Paid: <strong>₹ {actualAmount.totalPaid.toLocaleString('en-IN')}</strong>
            </span>
            <span className="inv-breakdown-op">=</span>
            <span className="inv-breakdown-tag inv-tag-balance">
              {billType} Balance Due: <strong>₹ {actualAmount.balance.toLocaleString('en-IN')}</strong>
            </span>
          </div>
        )}
      </div>

      <IonRow>
        <IonCol size="12" sizeMd="2">
          <div className="inv-form-group">
            <FormLabel required>Bill Type</FormLabel>
            <select className="inv-select" value={billType} onChange={e => setBillType(e.target.value)}>
              <option value="">Select Type</option>
              {billTypes.map((b, i) => <option key={i} value={b}>{b}</option>)}
            </select>
            {billType && actualAmount !== null && (
              <div className="inv-actual-amount-text" title="Total Inward Bills − Total Paid = Balance Due">
                Balance Due: ₹ {actualAmount.balance.toLocaleString('en-IN')}
              </div>
            )}
          </div>
        </IonCol>
        <IonCol size="12" sizeMd="2">
          <div className="inv-form-group">
            <FormLabel required>Payment Date</FormLabel>
            <input type="date" className="inv-input" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
            <div className="inv-date-hint">MM/DD/YYYY</div>
          </div>
        </IonCol>
        <IonCol size="12" sizeMd="3">
          <div className="inv-form-group">
            <FormLabel required>Vendor</FormLabel>
            <select className="inv-select" value={vendor} onChange={e => setVendor(e.target.value)}>
              <option value="">Select Vendor</option>
              {vendors.map((v, i) => <option key={i} value={v[0]}>{v[0]}</option>)}
            </select>
          </div>
        </IonCol>
        <IonCol size="12" sizeMd="2">
          <div className="inv-form-group">
            <FormLabel required>Amount</FormLabel>
            <input type="number" placeholder="Amount" className="inv-input" value={amount || ""} onChange={e => setAmount(Number(e.target.value))} />
          </div>
        </IonCol>
        <IonCol size="12" sizeMd="3">
          <div className="inv-form-group">
            <FormLabel required>Description</FormLabel>
            <input type="text" placeholder="Payment description" className="inv-input" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </IonCol>
      </IonRow>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", margin: "6px 0 8px" }}>
        <button type="button" className="inv-btn inv-btn-danger-outline inv-btn-sm" onClick={clearForm}>
          <IonIcon icon={closeOutline} />
          <span>Cancel</span>
        </button>
        <button type="button" className="inv-btn inv-btn-primary inv-btn-sm" onClick={handleSave}>
          <IonIcon icon={checkmarkCircleOutline} />
          <span>Save Payment</span>
        </button>
      </div>

      <div className="inv-card-header" style={{ marginTop: "6px" }}>
        <h3 className="inv-card-title">
          <IonIcon icon={listOutline} />
          Outstanding Balances
        </h3>
        <span className="inv-card-subtitle">{outstandings.length} records (Click row to auto-fill)</span>
      </div>

      <div className="inv-table-wrapper inv-scrollable" style={{ height: "calc(100vh - 280px)", maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
        <table className="inv-table">
          <thead>
            <tr>
              <th>Bill Type</th>
              <th>Prev Amount</th>
              <th>Amount</th>
              <th>Paid Date</th>
              <th>Due Amount</th>
              <th>Vendor</th>
              <th>Descriptions</th>
            </tr>
          </thead>
          <tbody>
            {outstandings.map((o, i) => (
              <tr key={i} onClick={() => handleRowClick(o)} className="clickable-row" title="Click to pay this bill">
                <td className="inv-badge-ref">{o[1]}</td>
                <td style={{ color: "#000000", fontWeight: 600 }}>₹ {o[2]}</td>
                <td style={{ color: "#000000", fontWeight: 600 }}>₹ {o[3]}</td>
                <td>{o[4] ? String(o[4]).split('T')[0] : ""}</td>
                <td style={{ fontWeight: 800, color: "#dc2626" }}>₹ {o[5]}</td>
                <td style={{ fontWeight: 600 }}>{o[8]}</td>
                <td>{o[9]}</td>
              </tr>
            ))}
            {outstandings.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "#94a3b8", padding: "28px" }}>
                  No outstanding records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ==========================================
// OUTWARD TAB
// ==========================================
const OutwardTab = () => {
  const [subTab, setSubTab] = useState("entry");

  return (
    <div>
      <div className="inv-subtabs-container">
        <button
          className={`inv-subtab-btn ${subTab === "entry" ? "active" : ""}`}
          onClick={() => setSubTab("entry")}
        >
          <IonIcon icon={createOutline} className="inv-subtab-icon" />
          <span>Outward Entry</span>
        </button>
        <button
          className={`inv-subtab-btn ${subTab === "abstract" ? "active" : ""}`}
          onClick={() => setSubTab("abstract")}
        >
          <IonIcon icon={receiptOutline} className="inv-subtab-icon" />
          <span>Outward Abstract</span>
        </button>
      </div>

      <div>
        {subTab === "entry" && <OutwardEntry />}
        {subTab === "abstract" && <OutwardAbstract />}
      </div>
    </div>
  );
};

const OutwardEntry = () => {
  const [client, setClient] = useState("");
  const [finYr, setFinYr] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceType, setInvoiceType] = useState("");
  const [invoiceWork, setInvoiceWork] = useState("");
  const [refNo, setRefNo] = useState("");
  const [toAddress, setToAddress] = useState("");

  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [cgstP, setCgstP] = useState<number>(0);
  const [cgstAmount, setCgstAmount] = useState<number>(0);
  const [sgstP, setSgstP] = useState<number>(0);
  const [sgstAmount, setSgstAmount] = useState<number>(0);
  const [grandTotal, setGrandTotal] = useState<number>(0);

  const [items, setItems] = useState<any[]>([
    { sno: "", description: "", isSideHeading: false, isSubBill: false, noS: "", perCand: "", amount: "" }
  ]);

  const [clients, setClients] = useState<any[]>([]);
  const [finYrs, setFinYrs] = useState<any[]>([]);
  const [invoiceData, setInvoiceData] = useState<any[]>([]);

  const [showPopup, setShowPopup] = useState(false);
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState("");
  const [selectedRowData, setSelectedRowData] = useState<any>(null);

  const invoiceTypes = ["PER CANDIDATE", "PER ENTRY", "SOFTWARE", "STATIONARY", "TRANSPORT"];

  useEffect(() => {
    axios.get(`${API_BASE}Invoices/Load_FinYr`).then(res => {
      if (res.data) setFinYrs(res.data.map((item: any) => item[0] || item));
    }).catch(console.error);

    axios.get(`${API_BASE}Invoices/Load_Invoice_Client`).then(res => setClients(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (finYr) {
      axios.get(`${API_BASE}Invoices/Load_InvoiceNumber?FinYr=${finYr}`)
        .then(res => {
          if (res.data && res.data.length > 0) setInvoiceNo(res.data[0][0] || res.data[0]);
        })
        .catch(console.error);
    }
  }, [finYr]);

  useEffect(() => {
    if (finYr && client && invoiceType) {
      axios.get(`${API_BASE}Invoices/Load_InvoiceData?FinYr=${finYr}&invoiceType=${invoiceType}&client=${client}`)
        .then(res => setInvoiceData(res.data || [])).catch(err => {
          console.error(err);
          setInvoiceData([]);
        });
    } else {
      setInvoiceData([]);
    }
  }, [finYr, client, invoiceType]);

  useEffect(() => {
    const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    setTotalAmount(total);
  }, [items]);

  useEffect(() => {
    const cgstVal = (totalAmount * (Number(cgstP) || 0)) / 100;
    setCgstAmount(cgstVal);
  }, [totalAmount, cgstP]);

  useEffect(() => {
    const sgstVal = (totalAmount * (Number(sgstP) || 0)) / 100;
    setSgstAmount(sgstVal);
  }, [totalAmount, sgstP]);

  useEffect(() => {
    setGrandTotal(totalAmount + cgstAmount + sgstAmount);
  }, [totalAmount, cgstAmount, sgstAmount]);

  const handleClientChange = (selected: string) => {
    setClient(selected);
    if (selected) {
      axios.get(`${API_BASE}Invoices/Load_Client_Address?ClientID=${selected}`)
        .then(res => {
          if (res.data && res.data.length > 0) {
            setToAddress(res.data[0][0] || "");
          }
        })
        .catch(console.error);
    } else {
      setToAddress("");
    }
  };

  const handleRowClick = (id: any) => {
    setSelectedInvoiceNo(id[0] || "");
    setSelectedRowData(id);
    setShowPopup(true);
  };

  const handleLoadInvoiceDetails = () => {
    setShowPopup(false);
    if (!selectedInvoiceNo || !selectedRowData) return;

    const rowInvoiceNo = selectedRowData[0] || selectedInvoiceNo;
    const rowInvoiceDate = selectedRowData[1] || "";
    const rowClient = selectedRowData[2] || client;
    const rowWorkType = selectedRowData[3] || invoiceWork;

    axios.get(`${API_BASE}Invoices/Load_OldInvoiceData?ViewType=EDIT&invoiceType=${invoiceType}&client=${rowClient}&workType=${encodeURIComponent(rowWorkType)}&FinYr=${finYr}&invoiceNO=${rowInvoiceNo}`)
      .then(res => {
        if (res.data && res.data.length > 0) {
          const firstRow = res.data[0];

          setInvoiceNo(rowInvoiceNo);
          if (firstRow[18]) {
            setInvoiceDate(formatDateForInput(firstRow[18]));
          } else if (firstRow[25]) {
            setInvoiceDate(formatDateForInput(firstRow[25]));
          } else if (rowInvoiceDate) {
            setInvoiceDate(formatDateForInput(rowInvoiceDate));
          }

          if (firstRow[4]) {
            setInvoiceWork(firstRow[4]);
          } else {
            setInvoiceWork(rowWorkType);
          }

          if (firstRow[24]) {
            setRefNo(firstRow[24]);
          } else if (firstRow[23] && firstRow[23] !== "true" && firstRow[23] !== "false") {
            setRefNo(firstRow[23]);
          }

          if (firstRow[21]) {
            setToAddress(firstRow[21]);
          } else if (firstRow[19]) {
            setToAddress(firstRow[19]);
          }

          if (firstRow[12] !== undefined && firstRow[12] !== null) setTotalAmount(Number(firstRow[12]) || 0);
          if (firstRow[13] !== undefined && firstRow[13] !== null) setCgstP(Number(firstRow[13]) || 0);
          if (firstRow[14] !== undefined && firstRow[14] !== null) setCgstAmount(Number(firstRow[14]) || 0);
          if (firstRow[15] !== undefined && firstRow[15] !== null) setSgstP(Number(firstRow[15]) || 0);
          if (firstRow[16] !== undefined && firstRow[16] !== null) setSgstAmount(Number(firstRow[16]) || 0);
          if (firstRow[17] !== undefined && firstRow[17] !== null) setGrandTotal(Number(firstRow[17]) || 0);

          const validRows = res.data.filter((r: any) => (r[7] && String(r[7]).trim() !== "") || r[9] || r[10] || r[11] || r[6]);
          const rowsToMap = validRows.length > 0 ? validRows : res.data.slice(0, 1);
          const loadedItems = rowsToMap.map((row: any) => ({
            sno: row[6] || "",
            description: row[7] || "",
            isSideHeading: row[8] === "SH" || row[8] === "true" || row[8] === "1" || row[8] === true || row[8] === 1,
            isSubBill: row[8] === "SB" || row[8] === "sub" || row[8] === "SUB",
            noS: row[9] || "",
            perCand: row[10] || "",
            amount: row[11] || ""
          }));
          setItems(loadedItems.length > 0 ? loadedItems : [{ sno: "", description: "", isSideHeading: false, isSubBill: false, noS: "", perCand: "", amount: "" }]);
        }
      })
      .catch(console.error);
  };

  const handleGenerateNewInvoice = () => {
    setShowPopup(false);
    clearForm();
    if (finYr) {
      axios.get(`${API_BASE}Invoices/Load_InvoiceNumber?FinYr=${finYr}`)
        .then(res => {
          if (res.data && res.data.length > 0) setInvoiceNo(res.data[0][0] || res.data[0]);
        })
        .catch(console.error);
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "noS" || field === "perCand") {
      const nosVal = Number(field === "noS" ? value : updated[index].noS) || 0;
      const rateVal = Number(field === "perCand" ? value : updated[index].perCand) || 0;
      if (nosVal || rateVal) {
        updated[index].amount = nosVal * rateVal;
      }
    }
    setItems(updated);
  };

  const addRow = () => {
    setItems([...items, { sno: "", description: "", isSideHeading: false, isSubBill: false, noS: "", perCand: "", amount: "" }]);
  };

  const removeRow = (index: number) => {
    const updated = items.filter((_, idx) => idx !== index);
    setItems(updated.length > 0 ? updated : [{ sno: "", description: "", isSideHeading: false, isSubBill: false, noS: "", perCand: "", amount: "" }]);
  };

  const moveRowUp = (index: number) => {
    if (index === 0) return;
    const updated = [...items];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setItems(updated);
  };

  const moveRowDown = (index: number) => {
    if (index === items.length - 1) return;
    const updated = [...items];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setItems(updated);
  };

  const handleSave = () => {
    if (!client || !finYr || !invoiceNo || !invoiceType) {
      alert("Please fill in all required fields marked with *");
      return;
    }

    const promises = items.map((item, idx) => {
      const payload = {
        _InvoiceType: invoiceType,
        _InvoiceNo: invoiceNo,
        _Client: client,
        _WorkType: invoiceWork,
        _InvoiceDt: invoiceDate,
        _Sno: item.sno,
        _Description: item.description,
        _IsSideHeading: item.isSideHeading ? "1" : "0",
        _No_S: item.noS || "0",
        _PerCandidatein_RS: item.perCand || "0",
        _Amount: item.amount || "0",
        _TotalAmount: totalAmount,
        _CGST_P: cgstP,
        _CGST_Amount: cgstAmount,
        _SGST_P: sgstP,
        _SGST_Amount: sgstAmount,
        _GrandTotal: grandTotal,
        _UserId: getUser()?.userId || "",
        _ToAddres: toAddress,
        _SavingMode: idx === 0 ? "SAVE" : "DETAIL",
        _Ident: "0",
        _FinYear: finYr,
        _RefNo: refNo,
        _SupInwardBills: ""
      };
      return axios.post(`${API_BASE}Invoices/Save_InvoiceData`, payload);
    });

    Promise.all(promises)
      .then(() => {
        alert("Invoice saved successfully!");
        if (finYr && client && invoiceType) {
          axios.get(`${API_BASE}Invoices/Load_InvoiceData?FinYr=${finYr}&invoiceType=${invoiceType}&client=${client}`)
            .then(res => setInvoiceData(res.data)).catch(console.error);
        }
      })
      .catch(err => {
        console.error(err);
        alert("Failed to save invoice.");
      });
  };

  const clearForm = () => {
    setClient("");
    setInvoiceNo("");
    setInvoiceDate("");
    setInvoiceType("");
    setInvoiceWork("");
    setRefNo("");
    setToAddress("");
    setTotalAmount(0);
    setCgstP(0);
    setCgstAmount(0);
    setSgstP(0);
    setSgstAmount(0);
    setGrandTotal(0);
    setItems([{ sno: "", description: "", isSideHeading: false, isSubBill: false, noS: "", perCand: "", amount: "" }]);
  };

  const handleDownloadInvoice = (row: any) => {
    const invNo = row[0] || "";
    const invDt = row[1] || "";
    const rowClient = row[2] || client;
    const rowWorkType = row[3] || "";

    axios.get(`${API_BASE}Invoices/Load_OldInvoiceData?ViewType=EDIT&invoiceType=${invoiceType}&client=${rowClient}&workType=${encodeURIComponent(rowWorkType)}&FinYr=${finYr}&invoiceNO=${invNo}`)
      .then(res => {
        generateInvoicePDF(invNo, finYr, rowClient, rowWorkType, invoiceType, res.data || [], invDt);
      })
      .catch(err => {
        console.error("Failed to generate invoice PDF", err);
        alert("Failed to generate invoice PDF.");
      });
  };

  return (
    <div>
      <div className="inv-card-header">
        <h3 className="inv-card-title">
          <IonIcon icon={createOutline} />
          Outward Invoice Generator
        </h3>
        <span className="inv-card-subtitle">Generate client invoice &amp; line items</span>
      </div>

      <IonRow style={{ alignItems: "stretch" }}>
        {/* Left pane: Client & Address */}
        <IonCol size="12" sizeMd="4" style={{ display: "flex", flexDirection: "column" }}>
          <div className="inv-form-group">
            <FormLabel required>Client</FormLabel>
            <select className="inv-select" value={client} onChange={e => handleClientChange(e.target.value)}>
              <option value="">Select Client</option>
              {clients.map((c, i) => <option key={i} value={c[0]}>{c[0]}</option>)}
            </select>
          </div>
          <div className="inv-form-group" style={{ marginTop: "4px", flex: 1, display: "flex", flexDirection: "column" }}>
            <FormLabel>To Address</FormLabel>
            <textarea
              className="inv-textarea"
              style={{ flex: 1, width: "100%", minHeight: "80px", resize: "none", boxSizing: "border-box" }}
              placeholder="Recipient address..."
              value={toAddress}
              onChange={e => setToAddress(e.target.value)}
            />
          </div>
        </IonCol>

        {/* Right pane: Invoice Details */}
        <IonCol size="12" sizeMd="8" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <IonRow>
            <IonCol size="6" sizeMd="3">
              <div className="inv-form-group">
                <FormLabel required>Financial Year</FormLabel>
                <select className="inv-select" value={finYr} onChange={e => setFinYr(e.target.value)}>
                  <option value="">Select Year</option>
                  {finYrs.map((y, i) => <option key={i} value={y}>{y}</option>)}
                </select>
              </div>
            </IonCol>
            <IonCol size="6" sizeMd="3">
              <div className="inv-form-group">
                <FormLabel required>Invoice No</FormLabel>
                <input type="text" placeholder="Invoice No" className="inv-input" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
              </div>
            </IonCol>
            <IonCol size="6" sizeMd="3">
              <div className="inv-form-group">
                <FormLabel required>Invoice Date</FormLabel>
                <input type="date" className="inv-input" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
                <div className="inv-date-hint">MM/DD/YYYY</div>
              </div>
            </IonCol>
            <IonCol size="6" sizeMd="3">
              <div className="inv-form-group">
                <FormLabel required>Invoice Type</FormLabel>
                <select className="inv-select" value={invoiceType} onChange={e => setInvoiceType(e.target.value)}>
                  <option value="">Select</option>
                  {invoiceTypes.map((t, i) => <option key={i} value={t}>{t}</option>)}
                </select>
              </div>
            </IonCol>
          </IonRow>

          <IonRow style={{ marginTop: "4px" }}>
            <IonCol size="12" sizeMd="9">
              <div className="inv-form-group">
                <FormLabel>Invoice Work</FormLabel>
                <input type="text" placeholder="Invoice work description..." className="inv-input" value={invoiceWork} onChange={e => setInvoiceWork(e.target.value)} />
              </div>
            </IonCol>
            <IonCol size="12" sizeMd="3">
              <div className="inv-form-group">
                <label className="inv-form-label" style={{ visibility: "hidden" }}>Action</label>
                <button type="button" className="inv-btn inv-btn-primary" style={{ width: "100%" }} onClick={handleSave}>
                  <IonIcon icon={checkmarkCircleOutline} />
                  <span>Save Invoice</span>
                </button>
              </div>
            </IonCol>
          </IonRow>

          <IonRow style={{ marginTop: "4px" }}>
            <IonCol size="12" sizeMd="9">
              <div className="inv-form-group">
                <FormLabel>Reference No.</FormLabel>
                <input type="text" placeholder="Reference Number" className="inv-input" value={refNo} onChange={e => setRefNo(e.target.value)} />
              </div>
            </IonCol>
            <IonCol size="12" sizeMd="3">
              <div className="inv-form-group">
                <label className="inv-form-label" style={{ visibility: "hidden" }}>Cancel</label>
                <button type="button" className="inv-btn inv-btn-danger-outline" style={{ width: "100%" }} onClick={clearForm}>
                  <IonIcon icon={closeOutline} />
                  <span>Clear</span>
                </button>
              </div>
            </IonCol>
          </IonRow>
        </IonCol>
      </IonRow>

      {/* History table */}
      <div className="inv-card-header" style={{ marginTop: "16px" }}>
        <h4 className="inv-card-title" style={{ fontSize: "15px" }}>
          <IonIcon icon={listOutline} />
          Existing Invoices for Client ({invoiceData.length})
        </h4>
        <span className="inv-card-subtitle">Click row to inspect or load</span>
      </div>

      <div className="inv-table-wrapper" style={{ maxHeight: "160px" }}>
        <table className="inv-table">
          <thead>
            <tr>
              <th>Invoice No.</th>
              <th>Invoice Dt</th>
              <th>Client</th>
              <th>WorkType</th>
              <th style={{ width: "45px", textAlign: "center" }}></th>
            </tr>
          </thead>
          <tbody>
            {invoiceData.map((id, i) => (
              <tr key={i} onClick={() => handleRowClick(id)} className="clickable-row">
                <td className="inv-ref-red" style={{ color: "#ff0000", fontWeight: 700 }}>{id[0]}</td>
                <td>{id[1] ? id[1].split('T')[0] : ""}</td>
                <td style={{ fontWeight: 600 }}>{id[2]}</td>
                <td>{id[3]}</td>
                <td style={{ textAlign: "center", width: "45px" }} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="inv-action-download-btn"
                    title={`Download Invoice ${id[0]}`}
                    onClick={() => handleDownloadInvoice(id)}
                  >
                    <IonIcon icon={downloadOutline} />
                  </button>
                </td>
              </tr>
            ))}
            {invoiceData.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "#94a3b8", padding: "18px" }}>
                  No existing invoices found for the selected client and type
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Calculation Stat Boxes */}
      <div className="inv-summary-grid">
        <div className="inv-stat-box">
          <label>Total Amount</label>
          <div className="inv-stat-val" style={{ color: "#dc2626" }}>₹ {totalAmount.toLocaleString("en-IN")}</div>
        </div>
        <div className="inv-stat-box">
          <label>CGST (%)</label>
          <input
            type="number"
            className="inv-input"
            style={{ padding: "4px 8px", fontSize: "14px", height: "30px" }}
            value={cgstP}
            onChange={e => setCgstP(Number(e.target.value))}
          />
        </div>
        <div className="inv-stat-box">
          <label>CGST Amount</label>
          <div className="inv-stat-val" style={{ color: "#2563eb" }}>₹ {cgstAmount.toLocaleString("en-IN")}</div>
        </div>
        <div className="inv-stat-box">
          <label>SGST (%)</label>
          <input
            type="number"
            className="inv-input"
            style={{ padding: "4px 8px", fontSize: "14px", height: "30px" }}
            value={sgstP}
            onChange={e => setSgstP(Number(e.target.value))}
          />
        </div>
        <div className="inv-stat-box">
          <label>SGST Amount</label>
          <div className="inv-stat-val" style={{ color: "#2563eb" }}>₹ {sgstAmount.toLocaleString("en-IN")}</div>
        </div>
        <div className="inv-stat-box grand-total-box">
          <label>Grand Total</label>
          <div className="inv-stat-val">₹ {grandTotal.toLocaleString("en-IN")}</div>
        </div>
      </div>

      {/* Dynamic Line Items Table */}
      <div className="inv-table-wrapper" style={{ margin: "16px 0" }}>
        <table className="inv-items-table">
          <thead>
            <tr>
              <th style={{ width: "95px" }}>S.NO</th>
              <th>DESCRIPTION OF THE WORK</th>
              <th style={{ width: "85px" }}>SH / SB</th>
              <th style={{ width: "105px" }}>NO'S</th>
              <th style={{ width: "115px" }}>PER CAND.</th>
              <th style={{ width: "135px" }}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td style={{ textAlign: "center" }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: "4px" }}>
                    <div className="inv-reorder-btn-box">
                      <div className="inv-reorder-arrow" onClick={() => moveRowUp(index)} title="Move Up">▲</div>
                      <div className="inv-reorder-arrow" onClick={() => moveRowDown(index)} title="Move Down">▼</div>
                    </div>
                    <input
                      type="text"
                      style={{
                        width: '38px',
                        height: '26px',
                        textAlign: 'center',
                        fontWeight: 700,
                        fontSize: '12.5px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        background: '#ffffff',
                        padding: '2px'
                      }}
                      value={item.sno}
                      onChange={e => handleItemChange(index, "sno", e.target.value)}
                    />
                  </div>
                </td>
                <td>
                  <input
                    type="text"
                    placeholder="Work description..."
                    value={item.description}
                    onChange={e => handleItemChange(index, "description", e.target.value)}
                  />
                </td>
                <td style={{ textAlign: "center" }}>
                  <input
                    type="checkbox"
                    style={{ marginRight: "8px", cursor: "pointer", transform: "scale(1.15)" }}
                    title="Side Heading"
                    checked={item.isSideHeading}
                    onChange={e => handleItemChange(index, "isSideHeading", e.target.checked)}
                  />
                  <input
                    type="checkbox"
                    style={{ cursor: "pointer", transform: "scale(1.15)" }}
                    title="Sub Bill"
                    checked={item.isSubBill}
                    onChange={e => handleItemChange(index, "isSubBill", e.target.checked)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ textAlign: "center" }}
                    placeholder="0"
                    value={item.noS}
                    onChange={e => handleItemChange(index, "noS", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ textAlign: "center" }}
                    placeholder="0"
                    value={item.perCand}
                    onChange={e => handleItemChange(index, "perCand", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ textAlign: "right", fontWeight: 800, color: "#dc2626" }}
                    readOnly
                    value={item.amount}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
        <button type="button" className="inv-btn inv-btn-outline inv-btn-sm" onClick={addRow}>
          <IonIcon icon={addOutline} />
          <span>Add Line Item</span>
        </button>
        <button type="button" className="inv-btn inv-btn-danger-outline inv-btn-sm" onClick={() => removeRow(items.length - 1)}>
          <IonIcon icon={trashOutline} />
          <span>Delete Last Row</span>
        </button>
      </div>

      {/* Modal Popup */}
      {showPopup && (
        <div className="inv-modal-overlay">
          <div className="inv-modal-card">
            <h3 className="inv-modal-title">Selected Invoice</h3>
            <div className="inv-modal-inv-badge">{selectedInvoiceNo}</div>
            <p style={{ fontSize: "13.5px", color: "#64748b", margin: "0 0 16px 0" }}>
              Choose an action for the selected invoice reference.
            </p>
            <div className="inv-modal-actions">
              <button type="button" className="inv-btn inv-btn-primary" onClick={handleLoadInvoiceDetails}>
                <IonIcon icon={createOutline} />
                <span>LOAD INVOICE DETAILS</span>
              </button>
              <button type="button" className="inv-btn inv-btn-outline" onClick={handleGenerateNewInvoice}>
                <IonIcon icon={addOutline} />
                <span>GENERATE NEW INVOICE</span>
              </button>
              <button type="button" className="inv-btn inv-btn-danger-outline" style={{ marginTop: "4px" }} onClick={() => setShowPopup(false)}>
                <span>Dismiss</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const OutwardAbstract = () => {
  const [client, setClient] = useState("");
  const [finYr, setFinYr] = useState("");
  const [abstractNo, setAbstractNo] = useState("");
  const [abstractDate, setAbstractDate] = useState("");
  const [subject, setSubject] = useState("");
  const [refNo, setRefNo] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [selectedInvoices, setSelectedInvoices] = useState<any[]>([]);

  const [clients, setClients] = useState<any[]>([]);
  const [finYrs, setFinYrs] = useState<any[]>([]);
  const [unlinkedInvoices, setUnlinkedInvoices] = useState<any[]>([]);
  const [abstractData, setAbstractData] = useState<any[]>([]);

  useEffect(() => {
    axios.get(`${API_BASE}Invoices/Load_FinYr`).then(res => {
      if (res.data) setFinYrs(res.data.map((item: any) => item[0] || item));
    }).catch(console.error);
    axios.get(`${API_BASE}Invoices/Load_Invoice_Client`).then(res => setClients(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (finYr) {
      axios.get(`${API_BASE}Invoices/Load_AbstractNo?FinYr=${finYr}`)
        .then(res => {
          if (res.data && res.data.length > 0) setAbstractNo(res.data[0][0] || res.data[0]);
        }).catch(console.error);
    }
  }, [finYr]);

  useEffect(() => {
    if (client) {
      axios.get(`${API_BASE}Invoices/Load_Client_Address?ClientID=${client}`)
        .then(res => {
          if (res.data && res.data.length > 0) {
            setToAddress(res.data[0][0] || "");
          } else {
            setToAddress("");
          }
        })
        .catch(err => {
          console.error(err);
          setToAddress("");
        });
    } else {
      setToAddress("");
    }
  }, [client]);

  useEffect(() => {
    setSelectedInvoices([]);
  }, [client, finYr]);

  useEffect(() => {
    if (client && finYr) {
      axios.get(`${API_BASE}Invoices/Load_Invoice_Not_Linked_to_Abstract?Client=${client}&FinYr=${finYr}`)
        .then(res => {
          const mapped = (res.data || []).map((row: any) => [
            "0",
            row[0] || "",
            row[2] || "",
            row[3] || 0
          ]);
          setUnlinkedInvoices(mapped);
        }).catch(err => {
          console.error(err);
          setUnlinkedInvoices([]);
        });

      axios.get(`${API_BASE}Invoices/Load_Invoice_AbstractData?Client=${client}&FinYr=${finYr}`)
        .then(res => setAbstractData(res.data || [])).catch(err => {
          console.error(err);
          setAbstractData([]);
        });
    } else {
      setUnlinkedInvoices([]);
      setAbstractData([]);
    }
  }, [client, finYr]);

  const toggleInvoiceSelection = (invoice: any) => {
    const invoiceNo = invoice[2];
    setSelectedInvoices(prev => {
      const exists = prev.some(item => item[2] === invoiceNo);
      if (exists) {
        return prev.filter(item => item[2] !== invoiceNo);
      } else {
        return [...prev, invoice];
      }
    });
  };

  const handleSave = () => {
    if (!client || !finYr || !abstractNo || !abstractDate) {
      alert("Please fill in all required fields marked with *");
      return;
    }

    if (selectedInvoices.length === 0) {
      alert("Please select at least one invoice to link to the abstract");
      return;
    }

    const promises = selectedInvoices.map((inv) => {
      const payload = {
        _Client: client,
        _FinYr: finYr,
        _AbstractNo: abstractNo,
        _AbstractDt: abstractDate,
        _Subject: subject,
        _RefNo: refNo,
        _InvoiceNo: inv[2],
        _TotalAmount: inv[3] || 0,
        _GrandTotal: inv[3] || 0,
        _Ident: inv[0] || "0"
      };
      return axios.post(`${API_BASE}Invoices/Save_AbstarctData`, payload);
    });

    Promise.all(promises)
      .then(() => {
        alert("Abstract saved successfully!");
        clearForm();
        if (client && finYr) {
          axios.get(`${API_BASE}Invoices/Load_Invoice_AbstractData?Client=${client}&FinYr=${finYr}`)
            .then(res => setAbstractData(res.data)).catch(console.error);
        }
      })
      .catch(err => {
        console.error(err);
        alert("Failed to save abstract data.");
      });
  };

  const handleEditClick = (ab: any[]) => {
    const sno = ab[0];
    const clientName = ab[2];
    const yr = ab[3];

    axios.get(`${API_BASE}Invoices/edit_invoice_abstract?Sno=${sno}&Client=${clientName}&Finyr=${yr}`)
      .then(res => {
        if (res.data && res.data.length > 0) {
          const firstRow = res.data[0];

          setClient(firstRow[5] || clientName);
          setFinYr(firstRow[2] || yr);
          setAbstractNo(firstRow[1] || sno);
          if (firstRow[4]) {
            setAbstractDate(firstRow[4].split('T')[0]);
          } else {
            setAbstractDate("");
          }
          setToAddress(firstRow[7] || "");
          setSubject(firstRow[8] || "");
          setRefNo(firstRow[9] || "");

          const linkedInvoices = res.data.map((row: any) => {
            return [
              row[0],
              row[10] || "",
              row[11] || "",
              row[12] || 0
            ];
          });

          setSelectedInvoices(linkedInvoices);

          axios.get(`${API_BASE}Invoices/Load_Invoice_Not_Linked_to_Abstract?Client=${clientName}&FinYr=${yr}`)
            .then(resUnlinked => {
              const unlinkedList = (resUnlinked.data || []).map((row: any) => [
                "0",
                row[0] || "",
                row[2] || "",
                row[3] || 0
              ]);
              const combined = [...linkedInvoices];
              unlinkedList.forEach((ul: any) => {
                if (!combined.some(c => c[2] === ul[2])) {
                  combined.push(ul);
                }
              });
              setUnlinkedInvoices(combined);
            })
            .catch(console.error);
        }
      })
      .catch(console.error);
  };

  const handlePrintAbstract = (ab: any[]) => {
    const sno = ab[0];
    const clientName = ab[2];
    const yr = ab[3];

    axios.get(`${API_BASE}Invoices/edit_invoice_abstract?Sno=${sno}&Client=${clientName}&Finyr=${yr}`)
      .then(res => {
        generateAbstractPDF(sno, clientName, yr, res.data || []);
      })
      .catch(err => {
        console.error("Failed to print abstract", err);
        alert("Failed to load abstract details for printing.");
      });
  };

  const handleDeleteClick = (ab: any[]) => {
    const sno = ab[0];
    const clientName = ab[2];
    const yr = ab[3];

    if (window.confirm("Are you sure you want to delete this abstract?")) {
      axios.post(`${API_BASE}Invoices/Delete_AbstarctData`, {
        _Client: clientName,
        _FinYr: yr,
        _AbstractNo: sno
      })
        .then(() => {
          alert("Deleted successfully!");
          axios.get(`${API_BASE}Invoices/Load_Invoice_AbstractData?Client=${clientName}&FinYr=${yr}`)
            .then(res => setAbstractData(res.data)).catch(console.error);
        })
        .catch(err => {
          console.error(err);
          alert("Failed to delete abstract.");
        });
    }
  };

  const clearForm = () => {
    setClient("");
    setFinYr("");
    setAbstractNo("");
    setAbstractDate("");
    setSubject("");
    setRefNo("");
    setToAddress("");
    setSelectedInvoices([]);
    setUnlinkedInvoices([]);
  };

  return (
    <div>
      <div className="inv-card-header">
        <h3 className="inv-card-title">
          <IonIcon icon={receiptOutline} />
          Outward Abstract Management
        </h3>
        <span className="inv-card-subtitle">Generate &amp; link invoice abstracts</span>
      </div>

      {/* Row 1: Four input bars in a single row */}
      <IonRow>
        <IonCol size="12" sizeSm="6" sizeMd="3">
          <div className="inv-form-group">
            <FormLabel required>Client</FormLabel>
            <select className="inv-select" value={client} onChange={e => setClient(e.target.value)}>
              <option value="">Select Client</option>
              {clients.map((c, i) => <option key={i} value={c[0]}>{c[0]}</option>)}
            </select>
          </div>
        </IonCol>
        <IonCol size="12" sizeSm="6" sizeMd="3">
          <div className="inv-form-group">
            <FormLabel>Financial Year</FormLabel>
            <select className="inv-select" value={finYr} onChange={e => setFinYr(e.target.value)}>
              <option value="">Select Year</option>
              {finYrs.map((y, i) => <option key={i} value={y}>{y}</option>)}
            </select>
          </div>
        </IonCol>
        <IonCol size="12" sizeSm="6" sizeMd="3">
          <div className="inv-form-group">
            <FormLabel required>Abstract No</FormLabel>
            <input type="text" className="inv-input" style={{ background: "#f1f5f9" }} value={abstractNo} readOnly />
          </div>
        </IonCol>
        <IonCol size="12" sizeSm="6" sizeMd="3">
          <div className="inv-form-group">
            <FormLabel required>Abstract Date</FormLabel>
            <input type="date" className="inv-input" value={abstractDate} onChange={e => setAbstractDate(e.target.value)} />
            <div className="inv-date-hint">MM/DD/YYYY</div>
          </div>
        </IonCol>
      </IonRow>

      {/* Row 2: To Address and Linked Invoices */}
      <IonRow>
        <IonCol size="12" sizeMd="5">
          <div className="inv-form-group">
            <FormLabel>To Address</FormLabel>
            <textarea
              className="inv-textarea"
              style={{ height: "128px", minHeight: "128px", maxHeight: "128px", resize: "none", boxSizing: "border-box" }}
              placeholder="To,"
              value={toAddress}
              onChange={e => setToAddress(e.target.value)}
            />
          </div>
        </IonCol>

        <IonCol size="12" sizeMd="7">
          <div className="inv-form-group">
            <FormLabel>Linked Invoices</FormLabel>
            <div
              className="inv-table-wrapper inv-scrollable"
              style={{ height: "128px", minHeight: "128px", maxHeight: "128px", boxSizing: "border-box", overflowY: "auto" }}
            >
              <table className="inv-table">
                <thead>
                  <tr>
                    <th style={{ width: "50px", textAlign: "center" }}>Select</th>
                    <th>Invoice Date</th>
                    <th>Invoice No</th>
                    <th>Grand Total</th>
                  </tr>
                </thead>
                <tbody>
                  {unlinkedInvoices.map((ui, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          style={{ cursor: "pointer" }}
                          checked={selectedInvoices.some(item => item[2] === ui[2])}
                          onChange={() => toggleInvoiceSelection(ui)}
                        />
                      </td>
                      <td>{ui[1]}</td>
                      <td className="inv-badge-ref">{ui[2]}</td>
                      <td style={{ fontWeight: 700, color: "#dc2626" }}>₹ {ui[3]}</td>
                    </tr>
                  ))}
                  {unlinkedInvoices.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", color: "#94a3b8", padding: "10px" }}>
                        No unlinked invoices found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </IonCol>
      </IonRow>

      <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <textarea
          className="inv-textarea"
          style={{ height: "65px", width: "100%" }}
          placeholder="Subject"
          value={subject}
          onChange={e => setSubject(e.target.value)}
        />
        <input
          type="text"
          className="inv-input"
          style={{ width: "100%" }}
          placeholder="Reference No"
          value={refNo}
          onChange={e => setRefNo(e.target.value)}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", margin: "8px 0 10px" }}>
        <button type="button" className="inv-btn inv-btn-danger-outline inv-btn-sm" onClick={clearForm}>
          <IonIcon icon={closeOutline} />
          <span>Clear</span>
        </button>
        <button type="button" className="inv-btn inv-btn-primary inv-btn-sm" onClick={handleSave}>
          <IonIcon icon={checkmarkCircleOutline} />
          <span>Save Abstract</span>
        </button>
      </div>

      <div className="inv-card-header" style={{ marginTop: "6px" }}>
        <h3 className="inv-card-title">
          <IonIcon icon={listOutline} />
          Abstract Registry
        </h3>
        <span className="inv-card-subtitle">{abstractData.length} records</span>
      </div>

      <div className="inv-table-wrapper inv-scrollable" style={{ height: "calc(100vh - 380px)", maxHeight: "calc(100vh - 380px)", minHeight: "200px", overflowY: "auto" }}>
        <table className="inv-table">
          <thead>
            <tr>
              <th>S.No</th>
              <th>Abstract Date</th>
              <th>Client</th>
              <th>Fin. Year</th>
              <th>Total Amount</th>
              <th style={{ textAlign: "center", width: "50px" }}>Print</th>
              <th style={{ textAlign: "center", width: "50px" }}>Edit</th>
              <th style={{ textAlign: "center", width: "50px" }}>Delete</th>
            </tr>
          </thead>
          <tbody>
            {abstractData.map((ab, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700 }}>{ab[0]}</td>
                <td>{ab[1] ? ab[1].split('T')[0] : ""}</td>
                <td style={{ fontWeight: 600 }}>{ab[2]}</td>
                <td>{ab[3]}</td>
                <td style={{ fontWeight: 800, color: "#dc2626" }}>₹ {ab[4]}</td>
                <td style={{ textAlign: "center" }}>
                  <button
                    type="button"
                    className="inv-action-download-btn"
                    title="Print / Download Abstract"
                    onClick={() => handlePrintAbstract(ab)}
                  >
                    <IonIcon icon={downloadOutline} />
                  </button>
                </td>
                <td style={{ textAlign: "center" }}>
                  <button
                    type="button"
                    className="inv-action-icon-btn"
                    title="Edit Abstract"
                    onClick={() => handleEditClick(ab)}
                  >
                    <IonIcon icon={pencilSharp} style={{ color: "#000000", fontSize: "18px" }} />
                  </button>
                </td>
                <td style={{ textAlign: "center" }}>
                  <button
                    type="button"
                    className="inv-action-icon-btn"
                    title="Delete Abstract"
                    onClick={() => handleDeleteClick(ab)}
                  >
                    <IonIcon icon={trashOutline} style={{ color: "#ef4444", fontSize: "19px" }} />
                  </button>
                </td>
              </tr>
            ))}
            {abstractData.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", color: "#94a3b8", padding: "28px" }}>
                  No abstract records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Invoices;
