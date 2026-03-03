// src/pages/AdminRequests.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonContent,
  IonSelect,
  IonSelectOption,
  IonItem,
  IonSegment,
  IonSegmentButton,
  IonToast,
} from "@ionic/react";

const AdminRequests: React.FC = () => {
  const baseUrl = "/api";

  const [selectedTab, setSelectedTab] = useState<string>("leaves");
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [selectedEmpCode, setSelectedEmpCode] = useState<string>("");
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const month = now.toLocaleString("default", { month: "short" });
    const year = now.getFullYear();
    return `${month}-${year}`;
  });


  

  const [leaveData, setLeaveData] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastType, setToastType] = useState<"success" | "danger">("success");

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token")?.replace(/"/g, "");
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    console.log("Loading employees...");
    const loadEmployees = async () => {
      try {
        const res = await axios.get(`${baseUrl}/Employee/Load_Employees`, {
          headers: getAuthHeaders(),
        });
        const mapped = res.data.map((emp: string[]) => ({
          id: emp[0],
          name: emp[1],
        }));
        setEmployees(mapped);
        console.log("Employees loaded:", mapped);
        if (mapped.length > 0) {
          setSelectedEmpCode(mapped[0].id);
        }
      } catch (error) {
        console.error("Error loading employees", error);
        setToastMessage("Failed to load employees.");
        setToastType("danger");
        setShowToast(true);
      }
    };
    loadEmployees();
  }, []);

  useEffect(() => {
    if (!selectedEmpCode) {
      console.log("Skipping month load as selectedEmpCode is empty");
      return;
    }

    const loadMonths = async () => {
      console.log("Loading months...");
      try {
        const res = await axios.get(
          `${baseUrl}/Leave/Load_Leave_MY?Empcode=${selectedEmpCode}`,
          { headers: getAuthHeaders() }
        );
        const availableMonths = res.data.map((m: string[]) => m[0]) || [];
const currentMonth = getCurrentMonthYear();
const monthsToUse = availableMonths.length > 0 ? availableMonths : [currentMonth];
setMonths(monthsToUse);

const defaultMonth =
  monthsToUse.find((m: string) => m.toLowerCase() === currentMonth.toLowerCase()) ||
  monthsToUse[0];
setSelectedMonth(defaultMonth);
console.log("Default month:", defaultMonth);

fetchLeaveData(selectedEmpCode, defaultMonth, selectedTab);


      } catch (err) {
        console.error("Error loading months", err);
        const fallbackMonth = getCurrentMonthYear();
        setMonths([fallbackMonth]);
        setSelectedMonth(fallbackMonth);
        fetchLeaveData(selectedEmpCode, fallbackMonth, selectedTab);
      }
    };

    loadMonths();
  }, [selectedEmpCode, selectedTab]);

  const getCurrentMonthYear = (): string => {
    const now = new Date();
    const month = now.toLocaleString("default", { month: "short" });
    const year = now.getFullYear();
    return `${month}-${year}`;
  };

  const fetchLeaveData = async (empCode: string, month: string, tab: string) => {
    if (!empCode || !month) return;

    const leaveType = tab === "permissions" ? "Permission" : "CL";
    console.log(`Fetching data for ${empCode}, ${month}, Type=${leaveType}`);

    try {
      const res = await axios.get(
        `${baseUrl}/Leave/Load_Leave_Permission?Empcode=${empCode}&Seachdate=${month}&LType=${leaveType}`,
        { headers: getAuthHeaders() }
      );

      let result = res.data || [];
      console.log("Raw leaveData fetched:", result);

      if (tab === "leaves") {
        result = result.filter((entry: any[]) => entry[5]?.toLowerCase() !== "permission");
        console.log("Filtered leaveData (no Permission):", result);
      }

      setLeaveData(result);
    } catch (err) {
      console.error("Error fetching leave data", err);
      setLeaveData([]);
      setToastMessage("Failed to load data.");
      setToastType("danger");
      setShowToast(true);
    }
  };

  const updateLeaveStatus = async (
    entry: any[],
    status: "accepted" | "rejected"
  ) => {
    const payload = {
      requestId: entry[0]?.toString(),
      status: status,
      Ltype: entry[6],
      PermTime: entry[11],
      empCode: parseInt(entry[1]),
      fromdate: entry[2],
      todate: entry[3],
      remarks: `${entry[1]}-${entry[5]}`,
      requesttype: entry[4],
    };

    console.log("Updating status:", payload);

    try {
      const res = await axios.post(
        `${baseUrl}/Leave/update_Leave_Permission`,
        payload,
        {
          headers: getAuthHeaders(),
        }
      );

      if (res.data?.includes("success")) {
        setToastMessage(`Request ${status} successfully`);
        setToastType("success");
        fetchLeaveData(selectedEmpCode, selectedMonth, selectedTab);
      } else {
        throw new Error("Unexpected response");
      }
    } catch (error) {
      console.error("Failed to update status", error);
      setToastMessage(`Failed to ${status} request`);
      setToastType("danger");
    } finally {
      setShowToast(true);
    }
  };

  const getEmpNameByCode = (code: string): string => {
    const emp = employees.find((e) => e.id === code);
    return emp ? `${emp.name}` : code;
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="menu-toolbar">
          <img
            src="./images/dbase.png"
            alt="DBase Logo"
            className="menu-logo"
          />
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding admin-report-content">
        <div className="view-reports-section">
          <h2>Admin Requests</h2>

          <IonSegment
            value={selectedTab}
            onIonChange={(e) => setSelectedTab(e.detail.value as string)}
          >
            <IonSegmentButton value="leaves">Leaves</IonSegmentButton>
            <IonSegmentButton value="permissions">Permissions</IonSegmentButton>
          </IonSegment>

          <IonItem>
            <IonSelect
              className="select-text"
              value={selectedEmpCode}
              placeholder="Select Employee"
              onIonChange={(e) => setSelectedEmpCode(e.detail.value)}
            >
              {employees.map((emp) => (
                <IonSelectOption key={emp.id} value={emp.id}>
                  {`${emp.name}`}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>

          <IonItem>
            <IonSelect
              className="select-text"
              value={selectedMonth}
              placeholder="Select Month"
              onIonChange={(e) => {
                const newMonth = e.detail.value;
                setSelectedMonth(newMonth);
                fetchLeaveData(selectedEmpCode, newMonth, selectedTab);
              }}
            >
              {months.map((month) => (
                <IonSelectOption key={month} value={month}>
                  {month}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>

          <div className="reports-display">
            {leaveData.length > 0 ? (
              leaveData.map((entry: any[], index: number) => (
                <div
                  key={index}
                  className="report-card"
                  style={{
                    borderLeft: "6px solid",
                    borderLeftColor:
                      entry[6]?.toLowerCase() === "accepted"
                        ? "#28a745"
                        : entry[6]?.toLowerCase() === "rejected"
                        ? "#dc3545"
                        : "#ffc107ff",
                    backgroundColor:  entry[6]?.toLowerCase() === "accepted"
                        ? "rgba(155, 238, 155, 0.06)"
                        : entry[6]?.toLowerCase() === "rejected"
                        ? "rgba(244, 146, 146, 0.07)"
                        : "#fef02c25",
                    borderRadius: "8px",
                    padding: "16px",
                    marginBottom: "16px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                  }}
                >
                  <div className="card-header">
                    <span className="report-date">
                      {entry[2]} - {entry[3]}
                    </span>
                    <div
                      style={{
                        marginTop: "12px",
                        display: "flex",
                        gap: "10px",
                      }}
                    >
                      {entry[6]?.toLowerCase() === "pending" ? (
                        <>
                          <button
                            className="ion-button ion-color-success"
                            onClick={() => updateLeaveStatus(entry, "accepted")}
                          >
                            Accept
                          </button>
                          <button
                            className="ion-button ion-color-danger"
                            onClick={() => updateLeaveStatus(entry, "rejected")}
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span
                          style={{
                            padding: "6px 14px",
                            borderRadius: "10px",
                            fontWeight: 600,
                            fontSize: "14px",
                            backgroundColor:
                              entry[6]?.toLowerCase() === "accepted"
                                ? "#28a745"
                                : entry[6]?.toLowerCase() === "rejected"
                                ? "#dc3545"
                                : "#aaa",
                            color: "#fff",
                          }}
                        >
                          {entry[6]}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="card-content">
                    <strong className="report-title">
                      {getEmpNameByCode(entry[1])}
                    </strong>
                    <p className="report-text">
                      {entry[10] || "No Description"}
                    </p>
                    {entry[4] && (
                      <p className="report-subtext">Session: {entry[4]}</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p>No data found.</p>
            )}
          </div>

          <IonToast
            isOpen={showToast}
            onDidDismiss={() => setShowToast(false)}
            message={toastMessage}
            color={toastType}
            duration={2000}
          />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AdminRequests;
