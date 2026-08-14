import React, { useEffect, useState } from "react";
import { IonPage, IonContent, IonSpinner, IonIcon } from "@ionic/react";
import { checkmarkCircleOutline, closeCircleOutline, warningOutline, alertCircleOutline } from "ionicons/icons";
import axios from "axios";
import { API_BASE } from "../config";
import { apiService } from "../utils/apiService";

const OnDutyAction: React.FC = () => {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [dutyDetails, setDutyDetails] = useState<any>(null);

  useEffect(() => {
    handleAction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAction = async () => {
    const params = new URLSearchParams(window.location.search);
    const did = params.get("did") || params.get("id");
    const action = params.get("action");
    const by = params.get("by") || params.get("raEmpCode") || "";

    if (!did || !action) {
      setMessage("Invalid action link. Missing On-Duty ID or action parameter.");
      setStatus("error");
      return;
    }

    if (action !== "Approved" && action !== "Rejected") {
      setMessage("Invalid action. Action must be Approved or Rejected.");
      setStatus("error");
      return;
    }

    try {
      const rawToken =
        localStorage.getItem("token") ||
        localStorage.getItem("Token") ||
        sessionStorage.getItem("token") ||
        "";
      const token = rawToken.replace(/^"|"$/g, "");
      const headers: any = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : {}),
      };

      // 1. Update Duty Status API call
      let res: any;
      try {
        res = await axios.post(
          `${API_BASE}OnDuty/onduty_decide_change`,
          { id: did, status: action, raEmpCode: by },
          { headers, timeout: 10000 }
        );
      } catch (err1) {
        // Fallback endpoint if standard route is Workreport or OnDuty/UpdateStatus
        try {
          res = await axios.get(`${API_BASE}Workreport/UpdateDutyStatus`, {
            params: { did: Number(did), status: action, raEmpCode: by },
            headers,
            timeout: 10000
          });
        } catch (err2) {
          // Direct fallback post
          res = await axios.post(
            `${API_BASE}OnDuty/UpdateStatus`,
            { did: Number(did), status: action, raEmpCode: by },
            { headers, timeout: 10000 }
          );
        }
      }

      const data = res?.data || {};
      const emoji = action === "Approved" ? "✅" : "❌";
      const verb = action === "Approved" ? "Approved" : "Rejected";

      // 2. Resolve RA Name
      let raName = by || "Reporting Authority";
      if (by) {
        try {
          const empRes = await apiService.getEmployee(by);
          const row = Array.isArray(empRes) ? empRes[0] : empRes;
          if (row) raName = String(row.EmpName || row.empName || row[2] || by);
        } catch {
          /* best effort */
        }
      }

      const dutyInfo = {
        dutyId: did,
        empName: data.empName || data.EmpName || "Employee",
        fromDate: data.fromDate || data.DateFrom || "N/A",
        toDate: data.toDate || data.DateTo || "N/A",
        location: data.college || data.College || data.location || "Field Duty",
        action: verb,
        raName,
      };
      setDutyDetails(dutyInfo);

      setMessage(`${emoji} On-Duty ${verb} successfully for ${dutyInfo.empName}`);
      setStatus("success");

      // 3. Notify Employees via WhatsApp
      const employeesToNotify: Array<{ phone: string; name: string }> = [];

      if (data.mobile || data.Mobile) {
        employeesToNotify.push({
          phone: String(data.mobile || data.Mobile),
          name: String(data.empName || data.EmpName || "Employee"),
        });
      }

      // If team members list is returned
      if (Array.isArray(data.members)) {
        data.members.forEach((m: any) => {
          if (m.mobile || m.Mobile) {
            employeesToNotify.push({
              phone: String(m.mobile || m.Mobile),
              name: String(m.empName || m.EmpName || "Employee"),
            });
          }
        });
      }

      // If no mobile in direct payload, query duty members or employee profile
      if (employeesToNotify.length === 0 && data.empCode) {
        try {
          const empDetails = await apiService.getEmployee(data.empCode);
          const row = Array.isArray(empDetails) ? empDetails[0] : empDetails;
          if (row && (row.Mobile || row.mobile)) {
            employeesToNotify.push({
              phone: String(row.Mobile || row.mobile),
              name: String(row.EmpName || row.empName || "Employee"),
            });
          }
        } catch {}
      }

      // Send WhatsApp message to each employee
      const isApproved = action === "Approved";
      const instructionText = isApproved
        ? "✅ *Next Steps*: All approvals received! You can now start your ride in the app with vehicle reading photo."
        : "⚠️ *Notice*: Your On-Duty request was rejected. Please contact your Reporting Authority for details.";

      for (const emp of employeesToNotify) {
        try {
          const empMsg =
            `${emoji} *ON-DUTY ${verb.toUpperCase()}*\n\n` +
            `Hi ${emp.name},\n\n` +
            `Your On-Duty request (#${did}) has been *${verb}*.\n\n` +
            `📅 Dates    : ${dutyInfo.fromDate} to ${dutyInfo.toDate}\n` +
            `📍 Location : ${dutyInfo.location}\n` +
            `👤 Action By: ${raName}\n\n` +
            `${instructionText}`;

          await apiService.sendMessage(emp.phone, empMsg);
        } catch (waErr) {
          console.error("[WhatsApp] Employee notify error:", waErr);
        }
      }
    } catch (err: any) {
      console.error("[OnDutyAction] Update status failed:", err);
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Failed to update On-Duty status.";
      setMessage(typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg));
      setStatus("error");
    }
  };

  const isSuccess = status === "success";
  const action = new URLSearchParams(window.location.search).get("action");

  return (
    <IonPage>
      <IonContent style={{ "--background": "#f8fafc" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 24px",
            background: "linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)",
            textAlign: "center",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "24px",
              padding: "40px 28px",
              maxWidth: "440px",
              width: "100%",
              boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.08), 0 0 1px 1px rgba(0,0,0,0.02)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {status === "loading" && (
              <>
                <div style={{ margin: "20px 0" }}>
                  <IonSpinner name="crescent" style={{ width: 48, height: 48, color: "#3b82f6" }} />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: "12px 0 6px" }}>
                  Processing On-Duty Action...
                </h3>
                <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
                  Updating status and notifying employees via WhatsApp
                </p>
              </>
            )}

            {status !== "loading" && (
              <>
                <div style={{ fontSize: 64, marginBottom: 16 }}>
                  {isSuccess ? (
                    action === "Approved" ? (
                      <IonIcon icon={checkmarkCircleOutline} style={{ color: "#16a34a", fontSize: 72 }} />
                    ) : (
                      <IonIcon icon={closeCircleOutline} style={{ color: "#dc2626", fontSize: 72 }} />
                    )
                  ) : (
                    <IonIcon icon={warningOutline} style={{ color: "#d97706", fontSize: 72 }} />
                  )}
                </div>

                <h2
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: isSuccess ? (action === "Approved" ? "#15803d" : "#b91c1c") : "#b45309",
                    margin: "0 0 12px",
                    letterSpacing: "-0.5px",
                  }}
                >
                  {isSuccess
                    ? action === "Approved"
                      ? "On-Duty Approved"
                      : "On-Duty Rejected"
                    : "Action Could Not Be Completed"}
                </h2>

                <p
                  style={{
                    fontSize: 15,
                    color: "#475569",
                    lineHeight: 1.6,
                    margin: "0 0 20px",
                  }}
                >
                  {message}
                </p>

                {dutyDetails && (
                  <div
                    style={{
                      width: "100%",
                      background: "#f1f5f9",
                      borderRadius: "16px",
                      padding: "16px 20px",
                      textAlign: "left",
                      fontSize: 14,
                      color: "#334155",
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ color: "#64748b" }}>Duty ID:</span>
                      <strong style={{ color: "#0f172a" }}>#{dutyDetails.dutyId}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ color: "#64748b" }}>Employee:</span>
                      <strong style={{ color: "#0f172a" }}>{dutyDetails.empName}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ color: "#64748b" }}>Location:</span>
                      <strong style={{ color: "#0f172a" }}>{dutyDetails.location}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Approved By:</span>
                      <strong style={{ color: "#0f172a" }}>{dutyDetails.raName}</strong>
                    </div>
                  </div>
                )}

                {isSuccess && (
                  <div
                    style={{
                      fontSize: 13,
                      color: "#166534",
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "12px",
                      padding: "10px 16px",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    📱 Automated WhatsApp notification has been dispatched to employee(s).
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default OnDutyAction;
