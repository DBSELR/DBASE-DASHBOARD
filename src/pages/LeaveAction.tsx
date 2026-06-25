import React, { useEffect, useState } from "react";
import { IonPage, IonContent } from "@ionic/react";
import axios from "axios";
import { API_BASE } from "../config";
import { apiService } from "../utils/apiService";

const LeaveAction: React.FC = () => {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    handleAction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAction = async () => {
    const params = new URLSearchParams(window.location.search);
    const lid    = params.get("lid");
    const action = params.get("action");
    const by     = params.get("by");

    if (!lid || !action) {
      setMessage("Invalid link. Missing leave ID or action.");
      setStatus("error");
      return;
    }

    if (action !== "Approved" && action !== "Rejected") {
      setMessage("Invalid action. Must be Approved or Rejected.");
      setStatus("error");
      return;
    }

    try {
      const res = await axios.get(`${API_BASE}Leave/UpdateLeaveStatus`, {
        params: { lid: Number(lid), status: action, raEmpCode: by || "" }
      });

      const data = res.data;
      const emoji  = action === "Approved" ? "✅" : "❌";
      const verb   = action === "Approved" ? "Approved" : "Rejected";

      setMessage(`${emoji} Leave ${verb} for ${data.empName || "Employee"} (${data.fromDate} – ${data.toDate})`);
      setStatus("success");

      // Send WhatsApp back to the employee
      if (data.mobile) {
        try {
          const token = localStorage.getItem("token")?.replace(/"/g, "");
          let raName = by || "Your manager";
          if (by && token) {
            try {
              const empRes = await apiService.getEmployee(by);
              const row = Array.isArray(empRes) ? empRes[0] : empRes;
              if (row) raName = String(row.EmpName || row.empName || row[2] || by);
            } catch { /* best effort */ }
          }

          const empMsg =
            `${emoji} *LEAVE ${verb.toUpperCase()}*\n\n` +
            `Hi ${data.empName},\n\n` +
            `Your leave request has been *${verb}*.\n\n` +
            `📅 From   : ${data.fromDate}\n` +
            `📅 To     : ${data.toDate}\n` +
            `📋 Type   : ${data.lType}\n` +
            `💬 Reason : ${data.remarks}\n\n` +
            `Approved by: ${raName}`;

          await apiService.sendMessage(data.mobile, empMsg);
        } catch (waErr) {
          console.error("[WhatsApp] Employee notify failed:", waErr);
        }
      }
    } catch (err: any) {
      const errMsg = err?.response?.data || err?.message || "Failed to update status";
      setMessage(typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg));
      setStatus("error");
    }
  };

  const isSuccess = status === "success";
  const action    = new URLSearchParams(window.location.search).get("action");

  return (
    <IonPage>
      <IonContent>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 24px",
          background: "#f8fafc",
          textAlign: "center"
        }}>
          {status === "loading" && (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
              <p style={{ fontSize: 16, color: "#64748b" }}>Processing leave action…</p>
            </>
          )}

          {status !== "loading" && (
            <>
              <div style={{ fontSize: 64, marginBottom: 16 }}>
                {isSuccess ? (action === "Approved" ? "✅" : "❌") : "⚠️"}
              </div>
              <h2 style={{
                fontSize: 22,
                fontWeight: 800,
                color: isSuccess ? (action === "Approved" ? "#16a34a" : "#dc2626") : "#92400e",
                margin: "0 0 12px"
              }}>
                {isSuccess
                  ? (action === "Approved" ? "Leave Approved" : "Leave Rejected")
                  : "Something went wrong"}
              </h2>
              <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.6, maxWidth: 340 }}>
                {message}
              </p>
              {isSuccess && (
                <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 20 }}>
                  The employee has been notified via WhatsApp.
                </p>
              )}
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LeaveAction;
