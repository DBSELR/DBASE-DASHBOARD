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

import "./MeetingMaster.css";

function PenaltyAssignment() {

  const [employees, setEmployees] = useState<any[]>([]);
  const [penalties, setPenalties] = useState<any[]>([]);

  const [form, setForm] = useState({
    penaltyId: "",
    penaltyDate: "",
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

    if (!form.penaltyId) {
      alert("Select Penalty");
      return;
    }

    if (form.employeeCodes.length === 0) {
      alert("Select Employees");
      return;
    }

    await axios.post(
      `${API_BASE}Penalty/ApplyPenalty`,
      form
    );

    alert("Penalty Applied");

    setForm({
      penaltyId: "",
      penaltyDate: "",
      employeeCodes: [],
      remarks: "",
      appliedBy: "Admin"
    });

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

          {/* Employees */}

          <div className="field-box full-width">

            <label>

              <IonIcon icon={peopleOutline} />

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

          {/* Remarks */}

          <div className="field-box full-width">

            <label>
              Remarks
            </label>

            <textarea
              rows={4}
              value={form.remarks}
              onChange={(e) =>
                setForm({
                  ...form,
                  remarks: e.target.value
                })
              }
            />

          </div>

        </div>

        {/* Selected Employees */}

        <div
          style={{
            marginTop: "20px"
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

        <button
          className="save-btn"
          onClick={applyPenalty}
        >

          <IonIcon
            icon={saveOutline}
          />

          Apply Penalty

        </button>

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