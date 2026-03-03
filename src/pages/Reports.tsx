import React, { useState, useEffect } from "react";
import {
  IonPage,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonDatetime,
  IonModal,
  IonToolbar,
  IonHeader,
  IonTitle,
  IonRow,
} from "@ionic/react";
import moment from "moment";

const LOG = (...args: any[]) => console.log("[Reports]", ...args);
const GROUP = (title: string) => console.group("[Reports]", title);
const GROUP_END = () => console.groupEnd();

const Reports: React.FC = () => {
  const [userData, setUserData] = useState<any>(null);
  const [reportType, setReportType] = useState<string>();
  const [fromDate, setFromDate] = useState<string>(moment().format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState<string>(moment().format("YYYY-MM-DD"));
  const [monthYear, setMonthYear] = useState<string>(moment().format("YYYY-MM"));
  const [status, setStatus] = useState<string>("Regular");

  const [isFromDateModalOpen, setFromDateModalOpen] = useState(false);
  const [isToDateModalOpen, setToDateModalOpen] = useState(false);
  const [isMonthYearModalOpen, setMonthYearModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [showPdf, setShowPdf] = useState<boolean>(false);

  /* ---------------- init ---------------- */
  useEffect(() => {
    GROUP("init");
    const user = localStorage.getItem("user");
    const token = (localStorage.getItem("token") || "").slice(0, 20) + "...";
    LOG("raw user:", user);
    LOG("token (first 20 chars):", token);
    if (user) {
      try {
        const parsed = JSON.parse(user);
        setUserData(parsed);
        LOG("User loaded:", parsed);
      } catch (e) {
        console.error("[Reports] Failed to parse user from localStorage:", e);
      }
    } else {
      console.warn("[Reports] No user found in localStorage");
    }
    GROUP_END();
  }, []);

  /* ------------- debug when preview toggles ------------- */
  useEffect(() => {
    if (pdfUrl) LOG("PDF URL set:", pdfUrl);
  }, [pdfUrl]);
  useEffect(() => {
    LOG("showPdf changed:", showPdf);
  }, [showPdf]);

  useEffect(() => {
  return () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  };
}, [pdfUrl]);

  const getApiUrl = () => {
    const empCode = userData?.empCode || "";
    const userDesig = userData?.designation; // ✅ use 'designation' (matches your other pages)
    const formattedFrom = moment(fromDate).format("MM-DD-YYYY");
    const formattedTo = moment(toDate).format("MM-DD-YYYY");
   const monthYearSend = moment(monthYear).format("MMM-YYYY");
    const Empcode = userDesig === "Director" || userDesig === "In-Charge F&A" ? "" : empCode;

    GROUP("build api url");
    LOG("Report Type Selected:", reportType);
    LOG("From Date:", formattedFrom, " (src:", fromDate, ")");
    LOG("To Date:", formattedTo, " (src:", toDate, ")");
    LOG("Month-Year:", monthYearSend, " (src:", monthYear, ")");
    LOG("User Designation:", userDesig);
    LOG("Empcode used:", Empcode);

    let url = "";
    switch (reportType) {
      case "employee-list":
        url = `/api/ProxyReports/Load_EmployeeList?EMPCODE=${empCode}`;
        break;
      case "work-report":
        url = `/api/ProxyReports/Load_WorkReport?EMPCODE=${empCode}&FDate=${formattedFrom}&TDate=${formattedTo}`;
        break;
      case "Salary Statement":
        url = `/api/ProxyReports/Load_SalaryStatement?EMPCODE=${Empcode}&MY=${monthYearSend}`;
        break;
      case "Salary Generation Details":
        url = `/api/ProxyReports/Load_SalaryGenerationDetails?EMPCODE=${Empcode}&MY=${monthYearSend}`;
        break;
      case "Salary Generation Abstract":
        url = `/api/ProxyReports/Load_SalaryGenerationAbstract?EMPCODE=${Empcode}&MY=${monthYearSend}`;
        break;
      case "stock":
        url = `/api/ProxyReports/Load_Stock?EMPCODE=${empCode}`;
        break;
      case "Timings & Leaves":
        url = `/api/ProxyReports/Load_TimingsandLeaves?EMPCODE=${empCode}&FDate=${formattedFrom}&TDate=${formattedTo}`;
        break;
      default:
        url = "";
        console.warn("[Reports] Unsupported report type selected:", reportType);
    }
    LOG("Built URL:", url);
    GROUP_END();
    return url;
  };

  const handlePrint = async () => {
  if (!reportType) {
    alert("No Report Option Is Selected...!");
    return;
  }

  const path = getApiUrl();
  const token = (localStorage.getItem("token") || "").replace(/"/g, "");

  try {
    const res = await fetch(path, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/pdf"
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || "Report failed.");
    }

    const blob = await res.blob();

    if (blob.size === 0) {
      throw new Error("Empty PDF received.");
    }

    const pdfUrl = URL.createObjectURL(blob);
    setPdfUrl(pdfUrl);
    setShowPdf(true);

  } catch (error: any) {
    alert("Error loading report: " + error.message);
  }
};

  // const handlePrint = async () => {
  //   GROUP("print");
  //   if (!reportType) {
  //     console.warn("[Reports] No report type selected");
  //     alert("No Report Option Is Selected...!");
  //     GROUP_END();
  //     return;
  //   }

  //   const path = getApiUrl();
  //   LOG("Constructed API Path:", path);

  //   if (!path) {
  //     alert("This report type is not yet supported.");
  //     GROUP_END();
  //     return;
  //   }

  //   const token = (localStorage.getItem("token") || "").replace(/"/g, "");
  //   LOG("Fetch GET with bearer token present:", Boolean(token));

  //   try {
  //     const res = await fetch(path, {
  //       method: "GET",
  //       headers: {
  //         Authorization: `Bearer ${token}`,
  //       },
  //     });

  //     LOG("Response status:", res.status, res.statusText);
  //     LOG("Response headers Content-Type:", res.headers.get("content-type"));

  //     if (!res.ok) throw new Error("No records found or unauthorized access.");

  //     const blob = await res.blob();
  //     LOG("Blob size (bytes):", blob.size);

  //     const pdfBlob = new Blob([blob], { type: "application/pdf" });
  //     const url = URL.createObjectURL(pdfBlob);
  //     LOG("Blob URL:", url);

  //     setPdfUrl(url);
  //     setShowPdf(true);
  //   } catch (error: any) {
  //     console.error("[Reports] API Error:", error);
  //     alert("Error loading report: " + error.message);
  //   } finally {
  //     GROUP_END();
  //   }
  // };

  const handleClear = () => {
    GROUP("clear");
    LOG("Resetting all fields to defaults");
    setReportType(undefined);
    setStatus("Regular");
    setFromDate(moment().format("YYYY-MM-DD"));
    setToDate(moment().format("YYYY-MM-DD"));
    setMonthYear(moment().format("YYYY-MM"));
    setShowPdf(false);
    setPdfUrl("");
    GROUP_END();
  };

  const handleFormat = async () => {
    GROUP("export format");
    try {
      const monthYearSend = moment(monthYear).format("MM-YYYY");
      const path = `/api/Reports/Load_TextExport?MY=${monthYearSend}`;
      const token = (localStorage.getItem("token") || "").replace(/"/g, "");

      LOG("Exporting format for:", monthYearSend);
      LOG("GET:", path);

      const res = await fetch(path, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      LOG("Export response status:", res.status, res.statusText);
      const blob = await res.blob();
      LOG("Export blob size (bytes):", blob.size);

      const url = URL.createObjectURL(blob);
      LOG("Export blob URL:", url);
      window.open(url);
    } catch (error: any) {
      console.error("[Reports] Format Export Error:", error);
      alert("Error exporting format: " + error.message);
    } finally {
      GROUP_END();
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <img src="./images/dbase.png" alt="Logo" className="menu-logo" />
          {/* <IonTitle>Reports</IonTitle> */}
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <h2>Reports</h2>

        <IonItem>
          <IonLabel position="stacked">Employee Code & Name</IonLabel>
          <IonInput
            value={userData ? `${userData.empCode} - ${userData.empName}` : ""}
            readonly
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Select Report</IonLabel>
          <IonSelect
            value={reportType}
            onIonChange={(e) => {
              LOG("Report type changed:", e.detail.value);
              setReportType(e.detail.value);
            }}
            className="select-text"
            interface="popover"
          >
            <IonSelectOption value="employee-list">Employee List</IonSelectOption>
            <IonSelectOption value="Salary Statement">Salary Statement</IonSelectOption>
            <IonSelectOption value="Salary Generation Details">Salary Generation Details</IonSelectOption>
            <IonSelectOption value="Salary Generation Abstract">Salary Generation Abstract</IonSelectOption>
            <IonSelectOption value="work-report">Work Report</IonSelectOption>
            <IonSelectOption value="Timings & Leaves">Timings & Leaves</IonSelectOption>
            <IonSelectOption value="stock">Stock</IonSelectOption>
            <IonSelectOption value="Vouchers">Vouchers</IonSelectOption>
            <IonSelectOption value="Employee Check-In/s">Employee Check-In/s</IonSelectOption>
          </IonSelect>
        </IonItem>

        <IonItem button onClick={() => { LOG("Open FromDate picker"); setFromDateModalOpen(true); }}>
          <IonLabel position="stacked">From Date</IonLabel>
          <IonInput value={fromDate} readonly />
        </IonItem>

        <IonItem button onClick={() => { LOG("Open ToDate picker"); setToDateModalOpen(true); }}>
          <IonLabel position="stacked">To Date</IonLabel>
          <IonInput value={toDate} readonly />
        </IonItem>

        <IonItem button onClick={() => { LOG("Open Month-Year picker"); setMonthYearModalOpen(true); }}>
          <IonLabel position="stacked">Month & Year</IonLabel>
          <IonInput value={monthYear} readonly />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Status</IonLabel>
          <IonSelect
            value={status}
            onIonChange={(e) => { LOG("Status changed:", e.detail.value); setStatus(e.detail.value); }}
            className="select-text"
            interface="popover"
          >
            <IonSelectOption value="Regular">Regular</IonSelectOption>
            <IonSelectOption value="Irregular">Irregular</IonSelectOption>
          </IonSelect>
        </IonItem>

        <IonRow>
          <IonButton
            expand="block"
            onClick={handlePrint}
            className="login-btn2"
            style={{ "--box-shadow": "none" } as any}
            color={"primary"}
          >
            Print
          </IonButton>
          <IonButton
            expand="block"
            onClick={handleClear}
            className="login-btn2"
            style={{ "--box-shadow": "none" } as any}
            color={"medium"}
          >
            Clear
          </IonButton>
          <IonButton
            expand="block"
            onClick={handleFormat}
            className="login-btn2"
            style={{ "--box-shadow": "none" } as any}
            color={"tertiary"}
          >
            Format
          </IonButton>
        </IonRow>

        {showPdf && (
          <div style={{ marginTop: "20px" }}>
            <p style={{ fontWeight: "bold" }}>
              Preview may not display —{" "}
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" onClick={() => LOG("Open PDF in new tab")}>
                Click here to open PDF
              </a>
            </p>
            <iframe
  src={pdfUrl}
  width="100%"
  height="600px"
  style={{ border: "none" }}
/>
            {/* <embed src={pdfUrl} type="application/pdf" width="100%" height="600px" /> */}
          </div>
        )}

        <IonButton
          expand="block"
          onClick={() => {
            if (pdfUrl) {
              LOG("Download PDF clicked");
              const a = document.createElement("a");
              a.href = pdfUrl;
              a.download = "report.pdf";
              a.click();
            } else {
              console.warn("[Reports] Download clicked with empty pdfUrl");
            }
          }}
        >
          Download PDF
        </IonButton>

        {/* From Date Modal */}
        <IonModal isOpen={isFromDateModalOpen} onDidDismiss={() => setFromDateModalOpen(false)}>
          <IonDatetime
            presentation="date"
            value={fromDate}
            onIonChange={(e) => {
              const val = e.detail.value;
              if (typeof val === "string") {
                LOG("From Date picked:", val);
                setFromDate(val);
                setFromDateModalOpen(false);
              }
            }}
          />
        </IonModal>

        {/* To Date Modal */}
        <IonModal isOpen={isToDateModalOpen} onDidDismiss={() => setToDateModalOpen(false)}>
          <IonDatetime
            presentation="date"
            value={toDate}
            onIonChange={(e) => {
              const val = e.detail.value;
              if (typeof val === "string") {
                LOG("To Date picked:", val);
                setToDate(val);
                setToDateModalOpen(false);
              }
            }}
          />
        </IonModal>

        {/* Month-Year Modal */}
        <IonModal isOpen={isMonthYearModalOpen} onDidDismiss={() => setMonthYearModalOpen(false)}>
          <IonDatetime
            presentation="month-year"
            value={monthYear}
            onIonChange={(e) => {
              const val = e.detail.value;
              if (typeof val === "string") {
                LOG("Month-Year picked:", val);
                setMonthYear(val);
                setMonthYearModalOpen(false);
              }
            }}
          />
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default Reports;
