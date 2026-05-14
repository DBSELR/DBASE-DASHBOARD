import React, { useState } from "react";
import { IonSelect, IonSelectOption, IonToast, IonIcon } from "@ionic/react";
import {
  documentTextOutline,
  alertCircleOutline,
  attachOutline,
} from "ionicons/icons";
import axios from "axios";
import { API_BASE } from "../../config";
import "./RequestList.css";

const getUser = () => JSON.parse(localStorage.getItem("user") || "{}");

const PRIORITIES = ["High", "Medium", "Low"];

const EquipmentForm: React.FC = () => {
  const [purpose, setPurpose] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [requestType, setRequestType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [toast, setToast] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastColor, setToastColor] = useState<"success" | "danger" | "warning">("success");

  const notify = (msg: string, color: "success" | "danger" | "warning" = "danger") => {
    setToast(msg);
    setToastColor(color);
    setShowToast(true);
  };

  const handleSubmit = async () => {
    const empCode = getUser()?.empCode;
    if (!requestType) {
  notify("Please select request type");
  return;
}
    if (!purpose.trim()) { notify("Please enter the equipment purpose"); return; }
    
    const formData = new FormData();
    formData.append("EmpCode", empCode);
    formData.append("Purpose", purpose);
    formData.append("Priority", priority);
    formData.append("RequestType", requestType);
    if (file) formData.append("File", file);

    try {
      setSubmitting(true);
      await axios.post(`${API_BASE}EquipmentRequests/SaveRequest`, formData);
      notify("Submitted Successfully!", "success");
      setPurpose("");
      setFile(null);
      window.dispatchEvent(new Event("refreshRequests"));
    } catch (err: any) {
      notify(err?.response?.data || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const pc = priority === "High"
    ? { bg: "#fef2f2", color: "#b91c1c" }
    : priority === "Medium"
      ? { bg: "#fff7ed", color: "#c2410c" }
      : { bg: "#f0fdf4", color: "#15803d" };

  return (
    <div style={{ width: "100%", overflowX: "hidden" }}>

      {/* ── Form Grid: 3-col (Single Row) ── */}
      <div className="lr-bento-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", alignItems: "start" }}>
{/* Request Type */}
<div className="lr-field-box">
  <label className="lr-field-label">Request Type</label>

  <div className="lr-field-content">
    <IonIcon
      icon={documentTextOutline}
      className="lr-field-icon"
    />

   <IonSelect
  value={requestType}
  interface="popover"
  placeholder="Select Type"
  className="lr-popover-select"
  onIonChange={(e) =>
    setRequestType(e.detail.value)
  }
>
  <IonSelectOption value="Purchase">
    Purchase Item
  </IonSelectOption>

  <IonSelectOption value="Replacement">
    Replacement Item
  </IonSelectOption>
</IonSelect>
  </div>
</div>
        {/* Col 1 — Priority */}
        <div className="lr-field-box">
          <label className="lr-field-label">Priority</label>
          <div className="lr-field-content">
            <IonIcon icon={alertCircleOutline} className="lr-field-icon" />
            <IonSelect
              value={priority}
              interface="popover"
              className="lr-popover-select"
              onIonChange={(e) => setPriority(e.detail.value)}
            >
              {PRIORITIES.map((p) => (
                <IonSelectOption key={p} value={p}>{p}</IonSelectOption>
              ))}
            </IonSelect>
          </div>
          {/* Priority badge */}
          <span style={{
            display: "inline-block",
            marginTop: 6,
            padding: "3px 10px",
            borderRadius: 20,
            fontSize: 10,
            fontWeight: 700,
            background: pc.bg,
            color: pc.color,
            textTransform: "uppercase",
            width: "fit-content",
          }}>
            {priority}
          </span>
        </div>

        {/* Col 2 — Purpose */}
        <div className="lr-field-box">
          <label className="lr-field-label">Purpose / Description</label>
          <div className="lr-field-content" style={{ alignItems: "flex-start" }}>
            <IonIcon icon={documentTextOutline} className="lr-field-icon" style={{ marginTop: 3 }} />
            <textarea
              placeholder="Describe what you need..."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              style={{
                flex: 1, border: "none", background: "transparent",
                fontSize: 14, fontWeight: 500, outline: "none",
                resize: "none", color: "#1e293b", fontFamily: "inherit", width: "100%",
              }}
            />
          </div>
        </div>

        {/* Col 3 — Attachment */}
        {/* <div
          className="lr-field-box"
          style={{ cursor: "pointer" }}
          onClick={() => document.getElementById("equip-file-input")?.click()}
        >
          <label className="lr-field-label">Attachment</label>
          <div className="lr-field-content">
            <IonIcon icon={attachOutline} className="lr-field-icon" />
            <span style={{
              flex: 1, fontSize: 13, fontWeight: 500,
              color: file ? "#1e293b" : "#cbd5e1",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {file ? file.name : "Tap to attach"}
            </span>
          </div>
          {file && (
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
              style={{
                marginTop: 4, background: "none", border: "none",
                fontSize: 11, cursor: "pointer", color: "#94a3b8",
                padding: 0, fontWeight: 600,
              }}
            >✕ Remove</button>
          )}
          <input
            id="equip-file-input"
            type="file"
            style={{ display: "none" }}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div> */}

        {/* Col 3 — Attachment */}
{requestType === "Purchase" && (
  <div
    className="lr-field-box"
    style={{ cursor: "pointer" }}
    onClick={() =>
      document
        .getElementById("equip-file-input")
        ?.click()
    }
  >
    <label className="lr-field-label">
      Attachment
    </label>

    <div className="lr-field-content">
      <IonIcon
        icon={attachOutline}
        className="lr-field-icon"
      />

      <span
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: 500,
          color: file ? "#1e293b" : "#cbd5e1",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {file ? file.name : "Tap to attach"}
      </span>
    </div>

    {file && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setFile(null);
        }}
        style={{
          marginTop: 4,
          background: "none",
          border: "none",
          fontSize: 11,
          cursor: "pointer",
          color: "#94a3b8",
          padding: 0,
          fontWeight: 600,
        }}
      >
        ✕ Remove
      </button>
    )}

    <input
      id="equip-file-input"
      type="file"
      style={{ display: "none" }}
      onChange={(e) =>
        setFile(e.target.files?.[0] ?? null)
      }
    />
  </div>
)}

      </div>

      {/* ── Submit Button ── */}
      <button
        className="lr-gradient-btn"
        onClick={handleSubmit}
        disabled={submitting}
        style={{ opacity: submitting ? 0.7 : 1 }}
      >
        {submitting ? "Submitting…" : "Submit Request"}
      </button>

      <IonToast
        isOpen={showToast}
        message={toast}
        duration={2500}
        color={toastColor}
        position="bottom"
        onDidDismiss={() => setShowToast(false)}
        style={{ "--border-radius": "12px" }}
      />
    </div>
  );
};

export default EquipmentForm;