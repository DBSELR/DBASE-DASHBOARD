import React, {
  useEffect,
  useState
} from "react";

import axios from "axios";

import { API_BASE } from "../config";

import {
  IonIcon
} from "@ionic/react";

import {
  warningOutline,
  saveOutline
} from "ionicons/icons";

function ViolationReport() {

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

    <div className="meeting-page">

      <div className="meeting-card">

        <div className="meeting-header">

          <h2>

            <IonIcon
              icon={
                warningOutline
              }
            />

            Violation Report

          </h2>

        </div>

        <div className="meeting-grid">

          {/* Reporter */}

          <div className="field-box">

            <label>
              Reporter
            </label>

            <input
              type="text"
              value={
                `${form.reporterEmpCode} - ${form.reporterName}`
              }
              readOnly
            />

          </div>

          {/* Penalty */}

          <div className="field-box">

            <label>
              Penalty Type
            </label>

            <select
              value={
                form.penaltyId
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  penaltyId:
                    e.target.value
                })
              }
            >

              <option value="">
                Select Penalty
              </option>

              {
                penalties.map(
                  (p) => (

                    <option
                      key={p.id}
                      value={p.id}
                    >
                      {p.penaltyType}
                      {" - "}
                      {p.slipType}
                    </option>

                  )
                )
              }

            </select>

          </div>

          {/* Violator */}

          <div className="field-box">

            <label>
              Violator Employee
            </label>

            <select
              value={
                form.violatorEmpCode
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  violatorEmpCode:
                    e.target.value
                })
              }
            >

              <option value="">
                Select Employee
              </option>

              {
                employees
                  .filter(
                    (e) =>
                      e[0] !==
                      form.reporterEmpCode
                  )
                  .map(
                    (e) => (

                      <option
                        key={e[0]}
                        value={e[0]}
                      >
                        {e[0]}
                        {" - "}
                        {e[1]}
                      </option>

                    )
                  )
              }

            </select>

          </div>

          {/* Violation Time */}

          <div className="field-box">

            <label>
              Violation Time
            </label>

            <input
              type="datetime-local"
              value={
                form.violationTime
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  violationTime:
                    e.target.value
                })
              }
            />

          </div>

          {/* Proof */}

          <div className="field-box full-width">

            <label>
              Upload Evidence
            </label>

            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) =>
                setProofFile(
                  e.target.files?.[0] ||
                  null
                )
              }
            />

            {
              proofFile &&
              proofFile.type.startsWith(
                "image/"
              ) &&
              (
                <div
                  style={{
                    marginTop:
                      "15px"
                  }}
                >
                  <img
                    src={URL.createObjectURL(
                      proofFile
                    )}
                    alt="Proof"
                    style={{
                      width:
                        "250px",
                      border:
                        "1px solid #ddd",
                      borderRadius:
                        "8px"
                    }}
                  />
                </div>
              )
            }

            {
              proofFile &&
              proofFile.type ===
                "application/pdf" &&
              (
                <div
                  style={{
                    marginTop:
                      "10px"
                  }}
                >
                  Selected PDF :
                  {" "}
                  {proofFile.name}
                </div>
              )
            }

          </div>

          {/* Remarks */}

          <div className="field-box full-width">

            <label>
              Remarks
            </label>

            <textarea
              rows={5}
              value={
                form.remarks
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  remarks:
                    e.target.value
                })
              }
            />

          </div>

        </div>

        <button
          className="save-btn"
          onClick={
            saveReport
          }
        >

          <IonIcon
            icon={
              saveOutline
            }
          />

          Submit Report

        </button>

      </div>

    </div>

  );
}

export default ViolationReport;