// src/pages/AdminWorkReport.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonPopover,
  IonRadio,
  IonRadioGroup,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import axios from "axios";
import moment from "moment";
import { checkmarkCircle, closeCircle } from "ionicons/icons";

// --------- helpers (inline, no new files) ---------
const API_BASE =
  (window as any).__API_BASE__ ||
  import.meta.env.VITE_API_BASE ||
  "/api"; // works with proxy/rewrite

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};
const getAuthHeaders = () => {
  const token = localStorage.getItem("token")?.replace(/"/g, "");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Robust month read (object with MY or array[0])
const readMY = (x: any) => (typeof x === "object" && x?.MY ? x.MY : x?.[0]);

// Normalize a row coming back either as object or array
const normalizeWR = (r: any) => {
  if (!r) return null;
  if (!Array.isArray(r)) {
    // object-shaped (Angular-like)
    const t = (r.tClass || "").toString().toLowerCase();
    const colors =
      t === "green"
        ? { stripe: "#28a745", bg: "rgba(155, 238, 155, 0.06)" }
        : t === "red"
        ? { stripe: "#dc3545", bg: "rgba(244, 146, 146, 0.07)" }
        : { stripe: "#ff9800", bg: "rgba(255, 193, 7, 0.1)" };

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
    // array-shaped; safest guesses from your current code:
    // [0]=WorkId, [1]=Empname, [2]=Client_project, [3]=Title, [4]=WDescription, [5]=wdate, [6]=DateStatus?, [7]=LPClass?, [8]=tClass?
    const t = ((r[8] ?? r[7] ?? "").toString() || "").toLowerCase();
    const colors =
      t === "green"
        ? { stripe: "#28a745", bg: "rgba(155, 238, 155, 0.06)" }
        : t === "red"
        ? { stripe: "#dc3545", bg: "rgba(244, 146, 146, 0.07)" }
        : { stripe: "#ff9800", bg: "rgba(255, 193, 7, 0.1)" };

    return {
      WorkId: r[0],
      Empname: r[1],
      Client_project: r[2],
      Title: r[3],
      WDescription: r[4],
      wdate: r[5],
      DateStatus: r[6] ?? "0",
      LPClass: r[7] ?? "",
      tClass: r[8] ?? "",
      __colors: colors,
    };
  }
};

const AdminWorkReport: React.FC = () => {
  // Angular equivalents
  const [Seachdate, setSeachdate] = useState<string>(""); // MMM-YYYY
  const [SelectEmpcode, setSelectEmpcode] = useState<string>("All Employees");
  const [SelectEmp, setSelectEmp] = useState<string>("All Employees");

  const [dtworkreport, setDtworkreport] = useState<any[]>([]);
  const [dtmy, setDtmy] = useState<string[]>([]);
  const [dtEmpActive, setDtEmpActive] = useState<
    { EmpCode: string; EmpName: string; Designation?: string }[]
  >([]);

  // UI
  const [empPopoverOpen, setEmpPopoverOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastColor, setToastColor] = useState<"success" | "danger">("success");

  const currentMY = useMemo(() => moment().format("MMM-YYYY"), []);

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (m: string, c: "success" | "danger" = "success") => {
    setToastMsg(m);
    setToastColor(c);
    setToastOpen(true);
  };

  const bootstrap = async () => {
    // default month
    setSeachdate(currentMY);

    await loadEmployeesActive(); // populates popover list with All Employees + active employees
    await loadWorkreportMY(); // months list
    await loadWorkReport(); // initial list for "All Employees" + currentMY
  };

  const loadEmployeesActive = async () => {
    try {
      const url = `${API_BASE}/Employee/Load_Employees?SearchEmp=Active`;
      const r = await axios.get(url, { headers: getAuthHeaders() });
      let list = Array.isArray(r.data) ? r.data : [];
      // expect objects {EmpCode, EmpName, Designation} or array rows; normalize:
      list = list.map((x: any) =>
        Array.isArray(x)
          ? { EmpCode: x[0], EmpName: x[1], Designation: x[2] }
          : { EmpCode: x.EmpCode, EmpName: x.EmpName, Designation: x.Designation }
      );
      // filter out Director
      list = list.filter((xx: any) => (xx.Designation || "").toLowerCase() !== "director");
      // prepend "All Employees"
      list.unshift({ EmpCode: "All Employees", EmpName: "All Employees" });
      setDtEmpActive(list);
    } catch (e) {
      console.error(e);
      // still ensure All Employees exists
      setDtEmpActive([{ EmpCode: "All Employees", EmpName: "All Employees" }]);
    }
  };

  const loadWorkreportMY = async () => {
    try {
      const me = getUser();
      const emp = me?.empCode || me?.EmpCode;
      if (!emp) return;

      const url = `${API_BASE}/Workreport/Load_Workreport_MY?Empcode=${emp}`;
      const r = await axios.get(url, { headers: getAuthHeaders() });
      const months = (Array.isArray(r.data) ? r.data : []).map(readMY).filter(Boolean);
      setDtmy(months.length ? months : [currentMY]);
      if (!months.includes(currentMY)) {
        // keep whatever came in from Angular default
        setSeachdate(months[0] || currentMY);
      }
    } catch (e) {
      console.error(e);
      setDtmy([currentMY]);
      if (!Seachdate) setSeachdate(currentMY);
    }
  };

  const loadWorkReport = async () => {
    try {
      const params = new URLSearchParams({
        EmpCode: SelectEmpcode || "All Employees",
        SearchDate: Seachdate || currentMY,
      });
      const url = `${API_BASE}/Workreport/Load_WorkReport?${params.toString()}`;
      console.log("[wr][list] GET", url);
      const r = await axios.get(url, { headers: getAuthHeaders() });
      const rows = Array.isArray(r.data) ? r.data : [];
      setDtworkreport(rows);
      if (!rows.length) showToast("No work reports found.", "danger");
    } catch (e) {
      console.error(e);
      setDtworkreport([]);
      showToast("Failed to load work reports.", "danger");
    }
  };

  const updateWorkStatus = async (wrid: any, status: "Approved" | "Rejected") => {
    try {
      const url = `${API_BASE}/Workreport/update_WR_Permission?Wrid=${encodeURIComponent(
        wrid
      )}&Status=${encodeURIComponent(status)}&EmpCode=${encodeURIComponent(SelectEmpcode)}`;
      console.log("[wr][update] GET", url);
      const r = await axios.get(url, { headers: getAuthHeaders() });

      // backend returns list again (Angular assigns dtworkreport = update_Wr)
      const rows = Array.isArray(r.data) ? r.data : [];
      setDtworkreport(rows);

      showToast(
        status === "Approved" ? "Report approved successfully." : "Report rejected successfully.",
        "success"
      );
    } catch (e) {
      console.error(e);
      showToast("Failed to update report.", "danger");
    }
  };

  // When an employee is chosen from the popover
  const chooseEmployee = async (empCode: string, empName: string) => {
    setSelectEmp(empName);
    setSelectEmpcode(empCode);
    setEmpPopoverOpen(false);
    await loadWorkReport();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="menu-toolbar">
          <img src="./images/dbase.png" alt="DBase" className="menu-logo" />
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding admin-report-content">
        <div className="form-card">
          <div className="form-header">
            <div>Work Report&apos;s</div>
            <hr />
          </div>

          {/* Employee chooser (popover like Angular) */}
          <IonItem className="field" lines="none">
            <IonLabel position="stacked">Employee</IonLabel>
            <IonInput
              id="WRemp"
              readonly
              value={SelectEmp}
              onClick={() => setEmpPopoverOpen(true)}
            />
          </IonItem>

          <IonPopover
            isOpen={empPopoverOpen}
            onDidDismiss={() => setEmpPopoverOpen(false)}
            className="IonListStyles"
          >
            <IonContent>
              <IonList>
                <IonRadioGroup
                  value={SelectEmp}
                  onIonChange={(e) => {
                    const name = e.detail.value as string;
                    const found = dtEmpActive.find((x) => x.EmpName === name);
                    if (found) chooseEmployee(found.EmpCode, found.EmpName);
                  }}
                >
                  {dtEmpActive.map((x) => (
                    <IonItem
                      key={x.EmpCode}
                      button
                      onClick={() => chooseEmployee(x.EmpCode, x.EmpName)}
                    >
                      <IonRadio slot="start" value={x.EmpName} />
                      <IonLabel>{x.EmpName}</IonLabel>
                    </IonItem>
                  ))}
                </IonRadioGroup>
              </IonList>
            </IonContent>
          </IonPopover>

          {/* Month filter (Angular used <select> with dtmy) */}
          <IonItem className="field">
            <IonLabel>Month</IonLabel>
            <IonSelect
              interface="popover"
              value={Seachdate}
              onIonChange={async (e) => {
                setSeachdate(e.detail.value as string);
                await loadWorkReport();
              }}
            >
              {dtmy.map((m, i) => (
                <IonSelectOption key={i} value={m}>
                  {m}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>

          {/* Reports list */}
          <div className="reports">
            {dtworkreport.length ? (
              dtworkreport.map((raw, idx) => {
                const x = normalizeWR(raw);
                if (!x) return null;

                const t = (x.tClass || "").toString().toLowerCase();
                const showApprove = t === "red" || t === "orange";
                const showReject = t === "green" || t === "orange";

                return (
                  <div key={idx}>
                    {String(x.DateStatus) === "1" && (
                      <div className="card-date">{x.wdate || ""}</div>
                    )}

                    <div
                      className={`wr-card ${x.LPClass || ""}`}
                      style={{
                        borderLeft: `6px solid ${x.__colors.stripe}`,
                        backgroundColor: x.__colors.bg,
                      }}
                    >
                      <div className="badge">
                        {x.Empname || "-"} &nbsp;--&nbsp; {x.Client_project || "-"}
                      </div>

                      <div className="wr-actions">
                        {showApprove && (
                          <IonButton
                            fill="clear"
                            color="success"
                            onClick={() => updateWorkStatus(x.WorkId, "Approved")}
                            aria-label="Approve"
                          >
                            <IonIcon icon={checkmarkCircle} />
                          </IonButton>
                        )}
                        {showReject && (
                          <IonButton
                            fill="clear"
                            color="danger"
                            onClick={() => updateWorkStatus(x.WorkId, "Rejected")}
                            aria-label="Reject"
                          >
                            <IonIcon icon={closeCircle} />
                          </IonButton>
                        )}
                      </div>

                      {x.Title ? <div className="wr-title">{x.Title}</div> : null}
                      <div className="wr-desc">{x.WDescription || ""}</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="empty">No reports found.</p>
            )}
          </div>
        </div>

        {/* Toast */}
        <IonToast
          isOpen={toastOpen}
          onDidDismiss={() => setToastOpen(false)}
          message={toastMsg}
          duration={2200}
          color={toastColor}
        />
      </IonContent>
    </IonPage>
  );
};

export default AdminWorkReport;
