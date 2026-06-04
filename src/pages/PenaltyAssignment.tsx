import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";
import {
  IonIcon,
  IonToast,
  IonSelect,
  IonSelectOption
} from "@ionic/react";

import {
  warningOutline,
  peopleOutline,
  saveOutline
} from "ionicons/icons";

import "./PenaltyAssignment.css";

function PenaltyAssignment() {

  const [employees, setEmployees] = useState<any[]>([]);
  const [penalties, setPenalties] = useState<any[]>([]);

 const [proofFile, setProofFile] =
  useState<File | null>(null);

const [form, setForm] = useState({
  penaltyId: "",
  penaltyDate: "",
  violationTime: "",
  employeeCodes: [] as string[],
  remarks: "",
  appliedBy: "Admin"
});

  const [toast, setToast] = useState({
    open: false,
    message: "",
    color: "success"
  });

  useEffect(() => {
    loadEmployees();
    loadPenalties();
  }, []);

  const loadEmployees = async () => {

    const response =
      await axios.get(
        `${API_BASE}Employee/Load_Employees`
      );

    setEmployees(response.data || []);

  };

  const loadPenalties = async () => {

    const response =
      await axios.get(
        `${API_BASE}Penalty/GetPenaltyMaster`
      );

    setPenalties(response.data || []);

  };

  const applyPenalty = async () => {

  try {

    if (!form.penaltyId) {
      alert("Select Penalty");
      return;
    }

    if (!form.penaltyDate) {
      alert("Select Penalty Date");
      return;
    }

    if (
      form.employeeCodes.length === 0
    ) {
      alert(
        "Select Employees"
      );
      return;
    }

    const data =
      new FormData();

    data.append(
      "PenaltyId",
      form.penaltyId
    );

    data.append(
      "PenaltyDate",
      form.penaltyDate
    );

    data.append(
      "ViolationTime",
      form.violationTime
    );

    data.append(
      "Remarks",
      form.remarks
    );

    data.append(
      "AppliedBy",
      form.appliedBy
    );

    form.employeeCodes.forEach(
      (emp) => {
        data.append(
          "EmployeeCodes",
          emp
        );
      }
    );

    if (proofFile) {
      data.append(
        "ProofFile",
        proofFile
      );
    }

    await axios.post(
      `${API_BASE}Penalty/ApplyPenalty`,
      data,
      {
        headers: {
          "Content-Type":
            "multipart/form-data"
        }
      }
    );

    alert(
      "Penalty Applied Successfully"
    );

    setForm({
      penaltyId: "",
      penaltyDate: "",
      violationTime: "",
      employeeCodes: [],
      remarks: "",
      appliedBy: "Admin"
    });

    setProofFile(null);

  } catch (err: any) {

    console.error(err);

    alert(
      err?.response?.data?.message ||
      "Error Applying Penalty"
    );
  }
};

  return (

    <div className="meeting-page">

      <div className="meeting-card">

        <div className="meeting-header">

          <h2>

            <IonIcon icon={warningOutline} />

            Penalty Assignment

          </h2>

        </div>

        <div className="meeting-grid">

          {/* Penalty */}

          <div className="field-box">

            <label>Penalty Type</label>

            <select
              value={form.penaltyId}
              onChange={(e) =>
                setForm({
                  ...form,
                  penaltyId: e.target.value
                })
              }
            >

              <option value="">
                Select Penalty
              </option>

              {penalties.map((p) => (

                <option
                  key={p.id}
                  value={p.id}
                >
                  {p.penaltyType}
                </option>

              ))}

            </select>

          </div>

          {/* Date */}

          <div className="field-box">

            <label>
              Penalty Date
            </label>

            <input
              type="date"
              value={form.penaltyDate}
              onChange={(e) =>
                setForm({
                  ...form,
                  penaltyDate: e.target.value
                })
              }
            />

          </div>

          <div className="field-box">

  <label>
    Violation Date & Time
  </label>

  <input
    type="datetime-local"
    value={form.violationTime}
    onChange={(e) =>
      setForm({
        ...form,
        violationTime: e.target.value
      })
    }
  />

</div>



          {/* Employees */}

          <div className="field-box">

            <label>

             

              Employees

            </label>

            <IonSelect
              multiple={true}
              interface="popover"
              placeholder="Select Employees"
              value={form.employeeCodes}
              onIonChange={(e) =>
                setForm({
                  ...form,
                  employeeCodes:
                    e.detail.value
                })
              }
            >

              {employees.map((emp) => (

                <IonSelectOption
                  key={emp[0]}
                  value={emp[0]}
                >
                  {emp[1]}
                </IonSelectOption>

              ))}

            </IonSelect>

          </div>

          <div className="field-box full-width">

  <label>
    Violation Proof
  </label>

  <input
    type="file"
    accept="image/*,.pdf"
    onChange={(e) =>
      setProofFile(
        e.target.files?.[0] || null
      )
    }
  />

  {/* Image Preview */}

  {
    proofFile &&
    proofFile.type.startsWith("image/") &&
    (
      <div
        style={{
          marginTop: "10px"
        }}
      >
        <img
          src={URL.createObjectURL(
            proofFile
          )}
          alt="Proof"
          style={{
            width: "200px",
            maxHeight: "200px",
            objectFit: "contain",
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "5px"
          }}
        />
      </div>
    )
  }

  {/* PDF Preview */}

  {
    proofFile &&
    proofFile.type === "application/pdf" &&
    (
      <div
        style={{
          marginTop: "10px",
          color: "#1976d2",
          fontWeight: "bold"
        }}
      >
        Selected PDF:
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
              rows={2}
              value={form.remarks}
              onChange={(e) =>
                setForm({
                  ...form,
                  remarks: e.target.value
                })
              }
            />

          </div>

          <button
  className="save-btn"
  onClick={applyPenalty}
>
  <IonIcon icon={saveOutline} />
  Apply Penalty
</button>

        </div>

        {/* Selected Employees */}

       <div
  style={{
    marginTop: "20px",
    maxHeight: "250px",
    overflowY: "auto",
    border: "1px solid #ddd",
    borderRadius: "10px"
  }}
>
          <h4>
            Selected Employees
          </h4>

          <table
            className="meeting-table"
          >

            <thead>

              <tr>

                <th>
                  Employee Code
                </th>

              </tr>

            </thead>

            <tbody>

              {form.employeeCodes.map(
                (emp) => (

                  <tr key={emp}>

                    <td>
                      {emp}
                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        </div>

       {/* <div
  style={{
    position: "sticky",
    bottom: "0",
    background: "#fff",
    paddingTop: "15px",
    marginTop: "20px",
    zIndex: 100
  }}
>
  <button
    className="save-btn"
    onClick={applyPenalty}
  >
    <IonIcon icon={saveOutline} />
    Apply Penalty
  </button>
</div> */}

      </div>

      <IonToast
        isOpen={toast.open}
        message={toast.message}
        duration={2500}
        color={toast.color as any}
      />

    </div>

  );

}

export default PenaltyAssignment;