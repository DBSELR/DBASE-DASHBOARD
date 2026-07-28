import React, {
  useEffect,
  useState
} from "react";

import axios from "axios";

import { API_BASE } from "../config";

import {
  IonIcon,
  IonPage,
  IonContent,
  IonPopover,
  IonDatetime
} from "@ionic/react";

import {
  warningOutline,
  saveOutline
} from "ionicons/icons";

import { ChevronLeft } from "lucide-react";
import { useHistory } from "react-router-dom";

function ViolationReport() {
  const history = useHistory();

  const user =
    JSON.parse(
      localStorage.getItem("user") || "{}"
    );

  const [employees,
    setEmployees] =
    useState<any[]>([]);

  const [penalties,
    setPenalties] =
    useState<any[]>([]);

  const [proofFile,
    setProofFile] =
    useState<File | null>(null);

  const [form,
    setForm] =
    useState({
      reporterEmpCode:
        user.empCode || "",

      reporterName:
        user.empName || "",

      violatorEmpCode: "",

      penaltyId: "",

      violationTime: "",

      remarks: ""
    });

  useEffect(() => {

    loadEmployees();

    loadPenalties();

  }, []);

  const loadEmployees =
    async () => {

      try {

        const res =
          await axios.get(
            `${API_BASE}Employee/Load_Employees`
          );

        setEmployees(
          res.data || []
        );

      }
      catch (err) {

        console.error(err);

      }
    };

  const loadPenalties =
    async () => {

      try {

        const res =
          await axios.get(
            `${API_BASE}Penalty/GetPenaltyMaster`
          );

        setPenalties(
          res.data || []
        );

      }
      catch (err) {

        console.error(err);

      }
    };

  const saveReport =
    async () => {

      try {

        if (!form.penaltyId) {

          alert(
            "Select Penalty Type"
          );

          return;
        }

        if (
          !form.violatorEmpCode
        ) {

          alert(
            "Select Violator"
          );

          return;
        }

        if (
          form.reporterEmpCode ===
          form.violatorEmpCode
        ) {

          alert(
            "Reporter and Violator cannot be same"
          );

          return;
        }

        if (
          !form.violationTime
        ) {

          alert(
            "Select Violation Time"
          );

          return;
        }

        const data =
          new FormData();

        data.append(
          "ReporterEmpCode",
          form.reporterEmpCode
        );

        data.append(
          "ViolatorEmpCode",
          form.violatorEmpCode
        );

        data.append(
          "PenaltyId",
          form.penaltyId
        );

        data.append(
          "ViolationTime",
          form.violationTime
        );

        data.append(
          "Remarks",
          form.remarks
        );

        if (proofFile) {

          data.append(
            "ProofFile",
            proofFile
          );

        }

        await axios.post(
          `${API_BASE}Penalty/SaveViolationReport`,
          data,
          {
            headers: {
              "Content-Type":
                "multipart/form-data"
            }
          }
        );

        alert(
          "Violation Report Submitted Successfully"
        );

        setForm({
          reporterEmpCode:
            user.empCode || "",

          reporterName:
            user.empName || "",

          violatorEmpCode: "",

          penaltyId: "",

          violationTime: "",

          remarks: ""
        });

        setProofFile(null);

      }
      catch (err: any) {

        console.error(err);

        alert(
          err?.response?.data ||
          "Error Saving Report"
        );
      }
    };

  return (
    <IonPage>
      <IonContent className="page-content">
        <div className="wr-container stock-container" style={{ padding: 0, minHeight: 'auto', backgroundColor: 'transparent' }}>
          
          {/* ── Premium Header ── */}
          <div className="page-wr-header" style={{ margin: '16px', borderRadius: '16px', padding: '16px' }}>
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()}>
                <ChevronLeft size={22} color="white" />
              </button>
              <div>
                <h1 className="page-wr-title">Violation Report</h1>
                <p className="page-wr-subtitle">Submit a new penalty ticket</p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <div className="page-wr-header-icon-box">
                <IonIcon icon={warningOutline} style={{ color: 'var(--ion-color-primary)', fontSize: '24px' }} />
              </div>
            </div>
          </div>

          <div className="stock-panel" style={{ margin: '0 16px 20px 16px' }}>
            <h3 className="stock-section-heading">Report Details</h3>

            <div className="stock-grid" style={{ marginBottom: '24px' }}>
              {/* Reporter */}
              <div className="stock-field">
                <label>Reporter</label>
                <input
                  type="text"
                  className="stock-input"
                  value={`${form.reporterEmpCode} - ${form.reporterName}`}
                  readOnly
                  style={{ backgroundColor: 'var(--stock-bg)', color: 'var(--stock-muted)' }}
                />
              </div>

              {/* Penalty */}
              <div className="stock-field">
                <label>Penalty Type</label>
                <div className="stock-select-wrapper">
                  <select
                    className="stock-select"
                    value={form.penaltyId}
                    onChange={(e) => setForm({ ...form, penaltyId: e.target.value })}
                  >
                    <option value="">Select Penalty</option>
                    {penalties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.penaltyType} - {p.slipType}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Violator */}
              <div className="stock-field">
                <label>Violator Employee</label>
                <div className="stock-select-wrapper">
                  <select
                    className="stock-select"
                    value={form.violatorEmpCode}
                    onChange={(e) => setForm({ ...form, violatorEmpCode: e.target.value })}
                  >
                    <option value="">Select Employee</option>
                    {employees.filter((e) => e[0] !== form.reporterEmpCode).map((e) => (
                      <option key={e[0]} value={e[0]}>
                        {e[0]} - {e[1]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Violation Time */}
              <div className="stock-field">
                <label>Violation Time</label>
                <div id="violation-time-trigger" className="stock-input" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', minHeight: '38px', color: form.violationTime ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                  {form.violationTime ? new Date(form.violationTime).toLocaleString() : "Select Date & Time"}
                </div>
                <IonPopover trigger="violation-time-trigger" triggerAction="click" alignment="start">
                  <IonDatetime
                    presentation="date-time"
                    value={form.violationTime}
                    onIonChange={(e) => setForm({ ...form, violationTime: e.detail.value as string })}
                  />
                </IonPopover>
              </div>
            </div>

            <h3 className="stock-section-heading">Additional Information</h3>
            <div className="stock-grid" style={{ marginBottom: '24px' }}>
              
              {/* Proof */}
              <div className="stock-field">
                <label>Upload Evidence (Image / PDF)</label>
                <input
                  type="file"
                  className="stock-input"
                  style={{ padding: '8px' }}
                  accept="image/*,.pdf"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                />
                {proofFile && proofFile.type.startsWith("image/") && (
                  <div style={{ marginTop: "12px" }}>
                    <img
                      src={URL.createObjectURL(proofFile)}
                      alt="Proof"
                      style={{ width: "100%", maxWidth: "250px", border: "1px solid var(--stock-border)", borderRadius: "var(--stock-radius-md)" }}
                    />
                  </div>
                )}
                {proofFile && proofFile.type === "application/pdf" && (
                  <div style={{ marginTop: "10px", fontSize: '13px', color: 'var(--stock-text)' }}>
                    Selected PDF: <strong>{proofFile.name}</strong>
                  </div>
                )}
              </div>

              {/* Remarks */}
              <div className="stock-field">
                <label>Remarks</label>
                <textarea
                  className="stock-input"
                  style={{ minHeight: '100px', resize: 'vertical' }}
                  rows={4}
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  placeholder="Enter details about the violation..."
                />
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px dashed var(--stock-border)' }}>
              <button className="stock-button" onClick={saveReport} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 24px', minWidth: '180px' }}>
                <IonIcon icon={saveOutline} style={{ fontSize: '18px' }} />
                Submit Report
              </button>
            </div>

          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}

export default ViolationReport;