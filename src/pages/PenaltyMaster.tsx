import React, { useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";

import {
  IonToast,
  IonIcon
} from "@ionic/react";

import {
  warningOutline,
  calendarOutline,
  documentTextOutline,
  saveOutline
} from "ionicons/icons";

import "./MeetingMaster.css";

function PenaltyMaster() {

  const initialForm = {
    penaltyType: "",
    frequencyType: "",
    slipType: "",
    slipCount: "1",
    description: "",
    createdBy: "Admin"
  };

  const [formData, setFormData] = useState(initialForm);

  const [toast, setToast] = useState({
    open: false,
    message: "",
    color: "success"
  });

  const handleChange = (e: any) => {

    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });

  };

  const showToast = (
    message: string,
    color: string = "success"
  ) => {

    setToast({
      open: true,
      message,
      color
    });

  };

  const savePenalty = async () => {

    try {

      if (!formData.penaltyType) {
        showToast("Please Select Penalty Type", "warning");
        return;
      }


      if (!formData.frequencyType) {
        showToast("Please Select Frequency", "warning");
        return;
      }

      if (!formData.slipType) {
        showToast("Please Select Slip Type", "warning");
        return;
      }

      const token = localStorage.getItem("token");

      const response = await axios.post(
        `${API_BASE}Penalty/SavePenaltyMaster`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      showToast(
        response?.data?.message ||
        "Penalty Saved Successfully",
        "success"
      );

      setFormData(initialForm);

    } catch (err: any) {

      showToast(
        err?.response?.data?.message ||
        err?.message ||
        "API Error",
        "danger"
      );

    }

  };

  return (

    <div className="meeting-page">

      <div className="meeting-card">

        <div className="meeting-header">

          <h2>

            <IonIcon icon={warningOutline} />

            Penalty Master

          </h2>

        </div>

        <div className="meeting-grid">

          {/* Penalty Type */}

          <div className="field-box">

            <label>Penalty Type</label>

            <select
              name="penaltyType"
              value={formData.penaltyType}
              onChange={handleChange}
            >
              <option value="">Select Penalty</option>

              <option>Excess Permissions</option>
              <option>Unauthorized Leave / OD</option>
              <option>Personal Mobile Misuse</option>
              <option>Unnecessary Gatherings</option>
              <option>Failure to Wear ID Card</option>
              <option>Late Coming</option>
              <option>Food / Hygiene Violation</option>
              <option>Client / On-site Misconduct</option>
              <option>Dress Code Violation</option>
              <option>Sleeping During Duty</option>
              <option>Failure to Comms in English</option>
              <option>MyZen Compliance</option>
              <option>Data Breach / Fraud</option>
              <option>Disobedience / Quarrel</option>

            </select>

          </div>

        

          {/* Frequency */}

          <div className="field-box">

            <label>Frequency</label>

            <select
              name="frequencyType"
              value={formData.frequencyType}
              onChange={handleChange}
            >
              <option value="">Select</option>

              <option>Immediate</option>
              <option>Per Day</option>
              <option>Per Instance</option>
              <option>Per 2 Instances</option>
              <option>Per 3 Instances</option>

            </select>

          </div>

        
          {/* Slip Type */}

          <div className="field-box">

            <label>Slip Type</label>

            <select
              name="slipType"
              value={formData.slipType}
              onChange={handleChange}
            >
              <option value="">Select</option>

              <option>Yellow Slip</option>
              <option>Red Slip</option>

            </select>

          </div>

          {/* Slip Count */}

          <div className="field-box">

            <label>Slip Count</label>

            <select
              name="slipCount"
              value={formData.slipCount}
              onChange={handleChange}
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>

          </div>

          {/* Description */}

          <div className="field-box full-width">

            <label>Description</label>

            <div className="input-icon textarea-box">

              <textarea
                rows={5}
                name="description"
                value={formData.description}
                placeholder="Enter Description"
                onChange={handleChange}
              />

            </div>

          </div>

        </div>

        <button
          className="save-btn"
          onClick={savePenalty}
        >

          <IonIcon icon={saveOutline} />

          Save Penalty

        </button>

      </div>

      <IonToast
        isOpen={toast.open}
        message={toast.message}
        duration={2500}
        color={toast.color as any}
        position="top"
        onDidDismiss={() =>
          setToast({
            ...toast,
            open: false
          })
        }
      />

    </div>

  );

}

export default PenaltyMaster;