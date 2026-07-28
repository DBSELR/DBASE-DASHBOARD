import React, { useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";
import { useHistory } from "react-router-dom";

import {
  IonToast,
  IonIcon,
  IonPage,
  IonContent
} from "@ionic/react";

import {
  warningOutline,
  saveOutline,
  chevronBackOutline
} from "ionicons/icons";
import { ChevronLeft } from "lucide-react";

import "../pages/Meetings/MeetingMaster.css";
import "./WorkReports.css";
import "./RequestsPage.css";
import "./Stock.css";

function PenaltyMaster() {
  const history = useHistory();

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

  const showToast = (message: string, color: string = "success") => {
    setToast({ open: true, message, color });
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
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showToast(response?.data?.message || "Penalty Saved Successfully", "success");
      setFormData(initialForm);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || "API Error", "danger");
    }
  };

  return (
    <IonPage>
      <IonContent className="page-content">
        <div className="wr-container stock-container" style={{ padding: 0, minHeight: 'auto', backgroundColor: 'transparent' }}>
          
          {/* ── Premium Header ── */}
          <div className="page-wr-header" style={{ margin: '16px', borderRadius: '16px' }}>
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()}>
                <ChevronLeft size={22} color="white" />
              </button>
              <div>
                <h1 className="page-wr-title">Penalty Master</h1>
                <p className="page-wr-subtitle">Configure penalty types</p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <div className="page-wr-header-icon-box">
                <IonIcon icon={warningOutline} style={{ color: 'var(--ion-color-primary)', fontSize: '24px' }} />
              </div>
            </div>
          </div>

          <div className="stock-panel" style={{ margin: '0 16px' }}>
            
            <div className="stock-grid">
              <div className="stock-field">
                <label>Penalty Type</label>
                <select
                  className="stock-select"
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
                  <option>Appreciation / Recognition</option>
                </select>
              </div>

              <div className="stock-field">
                <label>Frequency</label>
                <select
                  className="stock-select"
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
                  <option>Weekly</option>
                  <option>Monthly</option>
                  <option>Quarterly</option>
                  <option>Yearly</option>
                  <option>Project Based</option>
                  <option>Event Based</option>
                  <option>One Time</option>
                </select>
              </div>

              <div className="stock-field">
                <label>Slip Type</label>
                <select
                  className="stock-select"
                  name="slipType"
                  value={formData.slipType}
                  onChange={handleChange}
                >
                  <option value="">Select</option>
                  <option>Yellow Slip</option>
                  <option>Red Slip</option>
                  <option>Green Slip</option>
                  <option>Orange Slip</option>
                </select>
              </div>

              <div className="stock-field">
                <label>Slip Count</label>
                <select
                  className="stock-select"
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
            </div>

            <div className="stock-field stock-field--wide" style={{ marginTop: '14px' }}>
              <label>Description</label>
              <textarea
                className="stock-input"
                rows={4}
                name="description"
                value={formData.description}
                placeholder="Enter Description"
                onChange={handleChange}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="stock-actions" style={{ marginTop: '20px' }}>
              <button className="stock-button" onClick={savePenalty}>
                <IonIcon icon={saveOutline} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Save Penalty
              </button>
            </div>

          </div>
        </div>
      </IonContent>

      <IonToast
        isOpen={toast.open}
        message={toast.message}
        duration={2500}
        color={toast.color as any}
        position="top"
        onDidDismiss={() => setToast({ ...toast, open: false })}
      />
    </IonPage>
  );
}

export default PenaltyMaster;