import React, { useState, useEffect } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonContent,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonSegment,
  IonSegmentButton,
  IonToast,
  IonRow,
  IonModal,
  IonImg,
} from "@ionic/react";
import axios from "axios";

const WorkReports: React.FC = () => {
  const [activeSection, setActiveSection] = useState<"submit" | "reports">(
    "submit"
  );
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [workLocation, setWorkLocation] = useState<string | null>(null);
  const [reportContent, setReportContent] = useState<string>("");

  const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
  const [employees, setEmployees] = useState<
    { empCode: string; name: string }[]
  >([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [months, setMonths] = useState<string[]>([]);
  const [reportList, setReportList] = useState<string[]>([]);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "danger">("success");

  const [showSuccessModal, setShowSuccessModal] = useState(false); // ✅ NEW

  const baseUrl = "https://api.dbasesolutions.in";

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token")?.replace(/"/g, "");
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const clientsRes = await axios.get(
          `${baseUrl}/api/Workreport/Load_Clients?College`,
          { headers: getAuthHeaders() }
        );
        setClients(
          clientsRes.data.map(([id, name]: [number, string]) => ({
            id,
            name: name || `Client ${id}`,
          }))
        );
      } catch (error) {
        console.error("Error loading clients", error);
      }

      try {
        const empRes = await axios.get(
          `${baseUrl}/api/Employee/Load_Employees?SearchEmp`,
          { headers: getAuthHeaders() }
        );

        const formatted = empRes.data.map((e: string[]) => ({
          empCode: e[0],
          name: e[1],
        }));
        setEmployees(formatted);

        const user = JSON.parse(localStorage.getItem("user") || "{}");
        if (user?.empCode) {
          const defaultEmpCode = user.empCode;
          const defaultMonth = getCurrentMonthYear();

          setSelectedEmployee(defaultEmpCode);
          setSelectedMonth(defaultMonth);

          await fetchMonths(defaultEmpCode);
          await fetchReports(defaultEmpCode, defaultMonth);
        }
      } catch (err) {
        console.error("Error loading employees", err);
      }
    };

    fetchInitialData();
  }, []);

  const getCurrentMonthYear = (): string => {
    const now = new Date();
    const month = now.toLocaleString("default", { month: "short" });
    const year = now.getFullYear();
    return `${month}-${year}`;
  };

  const fetchMonths = async (empCode: string) => {
    try {
      const res = await axios.get(
        `${baseUrl}/api/Workreport/Load_Workreport_MY?EmpCode=${empCode}`,
        { headers: getAuthHeaders() }
      );
      const fetchedMonths = res.data || [];
      setMonths(fetchedMonths.length ? fetchedMonths : defaultMonths);
    } catch (err) {
      console.error("Error loading months", err);
      setMonths(defaultMonths);
    }
  };

  const fetchReports = async (empCode: string, month: string) => {
    try {
      const res = await axios.get(`${baseUrl}/api/Workreport/Load_WorkReport`, {
        params: new URLSearchParams({ EmpCode: empCode, SearchDate: month }),
        headers: getAuthHeaders(),
      });
      const reports = res.data || [];
      setReportList(reports);

      if (reports.length === 0) {
        setToastMessage(`No work reports found for ${month}`);
        setToastType("danger");
        setShowToast(true);
      }
    } catch (err) {
      console.error("Error loading reports", err);
      setReportList([]);
      setToastMessage("No work reports found.");
      setToastType("danger");
      setShowToast(true);
    }
  };

  const handleSubmit = async () => {
    if (!selectedClient || !workLocation || !reportContent.trim()) {
      setToastType("danger");
      setToastMessage("All fields are required!");
      setShowToast(true);
      return;
    }

    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const empCode = userData?.empCode;

    if (!empCode) {
      setToastType("danger");
      setToastMessage("Employee Code not found!");
      setShowToast(true);
      return;
    }

    try {
      const url = `${baseUrl}/api/Workreport/saveworkReport?_clientId=${selectedClient}&_work_location=${encodeURIComponent(
        workLocation
      )}&_work_report=${encodeURIComponent(reportContent)}&_empcode=${empCode}`;

      const response = await axios.post(url, null, {
        headers: getAuthHeaders(),
      });

      if (response.data?.includes("Save successfully")) {
        setToastType("success");
        setToastMessage("Work report submitted successfully!");
        handleClear();

        const currentMonth = getCurrentMonthYear();
        setSelectedMonth(currentMonth);
        await fetchMonths(empCode);
        await fetchReports(empCode, currentMonth);

        setShowSuccessModal(true); // ✅ SHOW TICK MODAL
        setTimeout(() => setShowSuccessModal(false), 2000); // auto close after 2s
      } else {
        setToastType("danger");
        setToastMessage("Submission failed.");
      }
    } catch (error) {
      console.error("Submit error:", error);
      setToastType("danger");
      setToastMessage("Error submitting report.");
    }

    setShowToast(true);
  };

  const handleClear = () => {
    setSelectedClient(null);
    setWorkLocation(null);
    setReportContent("");
  };

  const defaultMonths = [
    "Aug-2024",
    "Sep-2024",
    "Oct-2024",
    "Nov-2024",
    "Dec-2024",
    "Jan-2025",
    "Feb-2025",
    "Mar-2025",
    "Apr-2025",
  ];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonToolbar className="menu-toolbar">
            <img
              src="./images/dbase.png"
              alt="DBase Logo"
              className="menu-logo"
            />
          </IonToolbar>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonSegment
          value={activeSection}
          onIonChange={(e) =>
            setActiveSection(e.detail.value as "submit" | "reports")
          }
        >
          <IonSegmentButton value="submit">
            <IonLabel>Submit Work Report</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="reports">
            <IonLabel>Work Reports</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {activeSection === "submit" && (
          <div className="submit-report-section">
            <h2>Submit Work Report</h2>
            <IonItem>
              <IonSelect
                className="select-text"
                interface="popover"
                value={selectedClient}
                placeholder="Select Client"
                onIonChange={(e) => setSelectedClient(e.detail.value)}
              >
                {clients.map((client) => (
                  <IonSelectOption
                    key={`${client.id}-${client.name}`}
                    value={client.id}
                  >
                    {client.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            <IonItem>
              <IonSelect
                className="select-text"
                interface="popover"
                value={workLocation}
                placeholder="Select Work Location"
                onIonChange={(e) => setWorkLocation(e.detail.value)}
              >
                <IonSelectOption value="In-House">In-House</IonSelectOption>
                <IonSelectOption value="On-Site">On-Site</IonSelectOption>
              </IonSelect>
            </IonItem>

            <textarea
              className="text-editor"
              value={reportContent}
              onChange={(e) => setReportContent(e.target.value)}
              style={{
                width: "100%",
                minHeight: "150px",
                padding: "10px",
                border: "1px solid #ccc",
                borderRadius: "8px",
              }}
              placeholder="Enter your work report here..."
            />

            <IonRow className="button-row">
              <IonButton
                expand="block"
                className="login-btn2"
                style={{ "--box-shadow": "none" }}
                color={"#f57c00"}
                onClick={handleSubmit}
              >
                Submit
              </IonButton>
              <IonButton
                expand="block"
                className="login-btn2"
                style={{ "--box-shadow": "none" }}
                color={"#f57c00"}
                onClick={handleClear}
              >
                Clear
              </IonButton>
            </IonRow>
          </div>
        )}

        {activeSection === "reports" && (
          <div className="view-reports-section">
            <h2>Work Reports</h2>
            <IonItem>
              <IonSelect
                className="select-text"
                interface="popover"
                value={selectedEmployee}
                placeholder="Select Employee"
                onIonChange={async (e) => {
                  const value = e.detail.value;
                  setSelectedEmployee(value);
                  setReportList([]);
                  setSelectedMonth(null);
                  await fetchMonths(value);
                }}
              >
                {employees.map((emp) => (
                  <IonSelectOption key={emp.empCode} value={emp.empCode}>
                    {emp.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            <IonItem>
              <IonSelect
                className="select-text"
                interface="popover"
                value={selectedMonth}
                placeholder="Select Month"
                onIonChange={(e) => {
                  const month = e.detail.value;
                  setSelectedMonth(month);
                  if (selectedEmployee) {
                    fetchReports(selectedEmployee, month);
                  }
                }}
              >
                {months.map((month, idx) => (
                  <IonSelectOption key={idx} value={month}>
                    {month}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            <div className="reports-display">
              {reportList.length > 0 ? (
                reportList.map((report: any, index: number) => (
                  <div className={`report-card ${report[7]}`} key={index}>
                    <div className="card-header">
                      <span className="report-date">{report[5]}</span>
                      <span className="report-badge">
                        {report[1]} ( {report[2]} )
                      </span>
                    </div>
                    <div className="card-content">
                      <strong className="report-title">{report[3]}</strong>
                      <p className="report-text">{report[4]}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p>No reports found for this selection.</p>
              )}
            </div>
          </div>
        )}

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2000}
          color={toastType}
        />

        {/* ✅ Tick Success Modal */}
        <IonModal isOpen={showSuccessModal} className="success-tick-modal">
           <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              textAlign: "center",
              backgroundColor: "#fff",
            }}
          >
            <img src="./images/check.gif" alt="Success" style={{ width: "120px", height: "120px" }} />
            <p style={{ marginTop: "12px", fontSize: "18px", fontWeight: "bold" }}>
              Work Report Submitted Successfully!
            </p>
          </div>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default WorkReports;
