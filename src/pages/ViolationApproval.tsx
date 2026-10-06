import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";
import { useHistory } from "react-router-dom";
import {
  IonPage,
  IonContent,
  IonIcon,
  IonToast
} from "@ionic/react";
import {
  shieldCheckmarkOutline,
  imageOutline,
  checkmarkCircleOutline,
  closeCircleOutline
} from "ionicons/icons";
import {
  ChevronLeft,
  ArrowRightLeft,
  ShieldAlert,
  FileText,
  CheckCircle,
  XCircle,
  ExternalLink,
  Clock,
  User,
  Image as ImageIcon,
  Video,
  AlertTriangle,
  X,
  Eye,
  Film,
  Sparkles,
  RefreshCw
} from "lucide-react";

import "./WorkReports.css";
import "./RequestsPage.css";
import "./Stock.css";
import "./PenaltyList.css";
import "./ViolationApproval.css";

function ViolationApproval() {
  const history = useHistory();
  const [activeTab, setActiveTab] = useState<"transfers" | "reports">("transfers");

  const [reports, setReports] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Modals State ──
  // 1. Approve Slip Transfer Modal
  const [transferToApprove, setTransferToApprove] = useState<any | null>(null);
  const [approvalRemarks, setApprovalRemarks] = useState<string>("");
  const [approvingTransfer, setApprovingTransfer] = useState<boolean>(false);

  // 2. Reject Slip Transfer Modal
  const [transferToReject, setTransferToReject] = useState<any | null>(null);
  const [rejectionRemarks, setRejectionRemarks] = useState<string>("");
  const [rejectingTransfer, setRejectingTransfer] = useState<boolean>(false);

  // 3. Approve Direct Report Modal
  const [reportToApprove, setReportToApprove] = useState<any | null>(null);
  const [approvingReport, setApprovingReport] = useState<boolean>(false);

  // 4. Reject Direct Report Modal
  const [reportToReject, setReportToReject] = useState<any | null>(null);
  const [reportRejectRemarks, setReportRejectRemarks] = useState<string>("");
  const [rejectingReport, setRejectingReport] = useState<boolean>(false);

  // 5. Evidence Lightbox Modal
  const [lightboxEvidence, setLightboxEvidence] = useState<{
    url: string;
    title: string;
    remarks?: string;
    isVideo?: boolean;
  } | null>(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const reviewer = user.empCode || user.EMPCODE || user.EmpCode || "ADMIN";

  const [toastState, setToastState] = useState<{
    isOpen: boolean;
    message: string;
    color: "success" | "danger" | "warning";
  }>({
    isOpen: false,
    message: "",
    color: "success"
  });

  const showToast = (message: string, color: "success" | "danger" | "warning" = "success") => {
    setToastState({ isOpen: true, message, color });
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([loadReports(), loadTransfers()]);
    setLoading(false);
  };

  const loadReports = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE}Penalty/GetPendingViolationReports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReports(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadTransfers = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE}Penalty/GetPendingSlipTransfers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransfers(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Helper URL Sanitizer ──
  const getProofUrl = (path: string) => {
    if (!path) return "";
    let clean = path.replace(/\\/g, "/").trim();
    if (!clean.startsWith("/")) clean = "/" + clean;
    const base = API_BASE.replace(/\/api\/?$/, "");
    return `${base}${clean}`;
  };

  const isVideoFile = (url: string): boolean => {
    if (!url) return false;
    return /\.(mp4|mov|avi|mkv|webm|3gp|flv|wmv|m4v|ts|ogv)(\?.*)?$/i.test(url);
  };

  // ── Handlers: Approve Slip Transfer ──
  const handleOpenApproveTransferModal = (transfer: any) => {
    setTransferToApprove(transfer);
    setApprovalRemarks("");
  };

  const handleConfirmApproveTransfer = async () => {
    if (!transferToApprove) return;
    setApprovingTransfer(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE}Penalty/ApproveSlipTransfer?requestId=${transferToApprove.RequestId}&reviewedBy=${encodeURIComponent(
          reviewer
        )}&remarks=${encodeURIComponent(approvalRemarks.trim())}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        showToast(
          `✅ Slip successfully transferred to ${transferToApprove.ToEmpName} and cleared from ${transferToApprove.FromEmpName}!`,
          "success"
        );
        setTransferToApprove(null);
        loadTransfers();
      } else {
        showToast(res.data?.message || "Failed to approve slip transfer.", "danger");
      }
    } catch (err: any) {
      console.error(err);
      showToast(err?.response?.data?.message || err?.message || "Error approving slip transfer", "danger");
    } finally {
      setApprovingTransfer(false);
    }
  };

  // ── Handlers: Reject Slip Transfer ──
  const handleOpenRejectTransferModal = (transfer: any) => {
    setTransferToReject(transfer);
    setRejectionRemarks("");
  };

  const handleConfirmRejectTransfer = async () => {
    if (!transferToReject) return;
    if (!rejectionRemarks.trim()) {
      showToast("Please enter a reason for rejecting the transfer", "warning");
      return;
    }

    setRejectingTransfer(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE}Penalty/RejectSlipTransfer`,
        {
          requestId: transferToReject.RequestId,
          reviewedBy: reviewer,
          remarks: rejectionRemarks.trim()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        showToast(`Slip transfer rejected. The slip remains active with ${transferToReject.FromEmpName}.`, "warning");
        setTransferToReject(null);
        loadTransfers();
      } else {
        showToast(res.data?.message || "Failed to reject transfer.", "danger");
      }
    } catch (err: any) {
      console.error(err);
      showToast(err?.response?.data?.message || err?.message || "Error rejecting slip transfer", "danger");
    } finally {
      setRejectingTransfer(false);
    }
  };

  // ── Handlers: Direct Violation Reports ──
  const handleOpenApproveReportModal = (report: any) => {
    setReportToApprove(report);
  };

  const handleConfirmApproveReport = async () => {
    if (!reportToApprove) return;
    setApprovingReport(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE}Penalty/ApproveViolationReport?reportId=${reportToApprove.Id}&reviewedBy=${encodeURIComponent(reviewer)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showToast(`Violation Report Approved! Penalty slip issued to ${reportToApprove.ViolatorName}.`, "success");
      setReportToApprove(null);
      loadReports();
    } catch (err: any) {
      console.error(err);
      showToast(err?.response?.data?.message || "Error approving report", "danger");
    } finally {
      setApprovingReport(false);
    }
  };

  const handleOpenRejectReportModal = (report: any) => {
    setReportToReject(report);
    setReportRejectRemarks("");
  };

  const handleConfirmRejectReport = async () => {
    if (!reportToReject) return;
    if (!reportRejectRemarks.trim()) {
      showToast("Please enter a rejection reason", "warning");
      return;
    }

    setRejectingReport(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE}Penalty/RejectViolationReport`,
        {
          reportId: reportToReject.Id,
          reviewedBy: reviewer,
          remarks: reportRejectRemarks.trim()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showToast("Violation report rejected.", "warning");
      setReportToReject(null);
      loadReports();
    } catch (err: any) {
      console.error(err);
      showToast(err?.response?.data?.message || "Error rejecting report", "danger");
    } finally {
      setRejectingReport(false);
    }
  };

  return (
    <IonPage>
      <IonContent className="page-content" fullscreen>
        <div className="wr-container stock-container" style={{ padding: 0, minHeight: "auto", backgroundColor: "transparent" }}>

          {/* ── Premium Header ── */}
          <div className="page-wr-header" style={{ margin: "16px", borderRadius: "16px", padding: "16px" }}>
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()} title="Go back">
                <ChevronLeft size={22} color="white" />
              </button>
              <div>
                <h1 className="page-wr-title">Penalty Approvals</h1>
                <p className="page-wr-subtitle">Review peer violation reports and slip transfer requests</p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <div className="page-wr-header-icon-box">
                <IonIcon icon={shieldCheckmarkOutline} style={{ color: "var(--ion-color-primary)", fontSize: "24px" }} />
              </div>
            </div>
          </div>

          {/* ── Segment Toggle Tabs ── */}
          <div style={{ display: "flex", gap: "8px", margin: "0 16px 16px", background: "#f1f5f9", padding: "6px", borderRadius: "14px" }}>
            <button
              onClick={() => setActiveTab("transfers")}
              style={{
                flex: 1,
                padding: "10px 14px",
                border: "none",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s",
                background: activeTab === "transfers" ? "#ffffff" : "transparent",
                color: activeTab === "transfers" ? "#ea580c" : "#64748b",
                boxShadow: activeTab === "transfers" ? "0 2px 8px rgba(0,0,0,0.06)" : "none"
              }}
            >
              <ArrowRightLeft size={16} />
              <span>Slip Transfers</span>
              {transfers.length > 0 && (
                <span style={{ background: "#ea580c", color: "#fff", fontSize: "11px", padding: "2px 7px", borderRadius: "20px", fontWeight: 800 }}>
                  {transfers.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("reports")}
              style={{
                flex: 1,
                padding: "10px 14px",
                border: "none",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s",
                background: activeTab === "reports" ? "#ffffff" : "transparent",
                color: activeTab === "reports" ? "#3b82f6" : "#64748b",
                boxShadow: activeTab === "reports" ? "0 2px 8px rgba(0,0,0,0.06)" : "none"
              }}
            >
              <FileText size={16} />
              <span>Peer Reports</span>
              {reports.length > 0 && (
                <span style={{ background: "#3b82f6", color: "#fff", fontSize: "11px", padding: "2px 7px", borderRadius: "20px", fontWeight: 800 }}>
                  {reports.length}
                </span>
              )}
            </button>
          </div>

          <div style={{ margin: "0 16px 20px 16px" }}>

            {/* ══════════════════════════════════════════════════════════
                TAB 1: SLIP TRANSFER REQUESTS
               ══════════════════════════════════════════════════════════ */}
            {activeTab === "transfers" && (
              <>
                {transfers.map((t) => {
                  const proofUrl = getProofUrl(t.ProofFilePath);
                  const isVid = isVideoFile(proofUrl);
                  return (
                    <div
                      key={t.RequestId}
                      className="stock-panel"
                      style={{
                        marginBottom: "16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "14px",
                        borderLeft: "4px solid #ea580c",
                        borderRadius: "18px",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.04)"
                      }}
                    >
                      {/* Header: Direction of transfer */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--stock-border)", paddingBottom: "12px" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 800, color: "#ea580c", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" }}>
                            <ArrowRightLeft size={13} /> Slip Transfer Request
                          </div>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <span style={{ color: "#475569" }}>From: <strong>{t.FromEmpName}</strong> (#{t.FromEmpCode})</span>
                            <span style={{ color: "#ea580c", fontWeight: 800 }}>➔</span>
                            <span style={{ color: "#b91c1c" }}>To: <strong>{t.ToEmpName}</strong> (#{t.ToEmpCode})</span>
                          </div>
                        </div>
                        <span className={`ep-slip-badge ${t.SlipType?.toLowerCase().replace(/\s+/g, "-")}`} style={{ margin: 0 }}>
                          {t.SlipType}
                        </span>
                      </div>

                      {/* Original Slip Information */}
                      <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "10px", fontSize: "12px", color: "#334155", border: "1px solid #e2e8f0" }}>
                        <div style={{ fontWeight: 700, marginBottom: "4px", color: "#64748b", textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.3px" }}>Original Slip Details:</div>
                        <div><strong>Offense:</strong> {t.PenaltyType}</div>
                        {t.OriginalRemarks && <div><strong>Original Reason:</strong> {t.OriginalRemarks}</div>}
                      </div>

                      {/* Transfer Reason & Evidence Remarks */}
                      <div style={{ fontSize: "13px", color: "var(--stock-text)", lineHeight: "1.6" }}>
                        <span style={{ fontWeight: "700", color: "#1e293b" }}>Transfer Reason &amp; Violation Observed: </span>
                        <p style={{ margin: "4px 0 0 0", background: "#fff7ed", padding: "10px 12px", borderRadius: "8px", border: "1px solid #fed7aa", color: "#9a3412", fontSize: "13px" }}>
                          {t.TransferReason || "No explanation provided."}
                        </p>
                      </div>

                      {/* Time of Incident */}
                      <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12px", color: "#64748b" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Clock size={13} />
                          Violation Time: <strong>{new Date(t.ViolationTime).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</strong>
                        </span>
                        <span>Requested: {new Date(t.CreatedDate).toLocaleDateString()}</span>
                      </div>

                      {/* Attached Evidence */}
                      {proofUrl ? (
                        <div style={{ marginTop: "2px" }}>
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxEvidence({
                                url: proofUrl,
                                title: `Transfer Evidence: ${t.FromEmpName} ➔ ${t.ToEmpName}`,
                                remarks: t.TransferReason,
                                isVideo: isVid
                              })
                            }
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              fontSize: "12px",
                              fontWeight: "700",
                              color: "#ea580c",
                              border: "none",
                              background: "rgba(234, 88, 12, 0.1)",
                              padding: "8px 14px",
                              borderRadius: "10px",
                              cursor: "pointer"
                            }}
                          >
                            {isVid ? <Film size={16} /> : <ImageIcon size={16} />}
                            <span>View Attached Evidence</span>
                            <Eye size={13} style={{ marginLeft: "2px" }} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>
                          No physical file evidence attached.
                        </div>
                      )}

                      {/* Approval & Rejection Actions (OPENS HIGH-QUALITY MODAL) */}
                      <div style={{ display: "flex", gap: "12px", marginTop: "6px" }}>
                        <button
                          className="stock-button"
                          style={{
                            flex: 1,
                            padding: "12px",
                            background: "#10b981",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            fontWeight: 700,
                            borderRadius: "12px",
                            boxShadow: "0 4px 10px rgba(16, 185, 129, 0.2)"
                          }}
                          onClick={() => handleOpenApproveTransferModal(t)}
                        >
                          <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: "18px", marginRight: "6px" }} />
                          Accept &amp; Transfer
                        </button>
                        <button
                          className="stock-button stock-button--secondary"
                          style={{
                            flex: 1,
                            padding: "12px",
                            color: "#ef4444",
                            borderColor: "#fecaca",
                            background: "#fff",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            fontWeight: 700,
                            borderRadius: "12px"
                          }}
                          onClick={() => handleOpenRejectTransferModal(t)}
                        >
                          <IonIcon icon={closeCircleOutline} style={{ fontSize: "18px", marginRight: "6px" }} />
                          Reject Transfer
                        </button>
                      </div>
                    </div>
                  );
                })}

                {transfers.length === 0 && (
                  <div className="stock-panel" style={{ textAlign: "center", padding: "50px 20px", display: "flex", flexDirection: "column", alignItems: "center", borderRadius: "18px" }}>
                    <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--stock-panel-bg)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", border: "1px solid var(--stock-border)" }}>
                      <ArrowRightLeft size={32} style={{ color: "var(--stock-muted)" }} />
                    </div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--stock-text)" }}>No Pending Slip Transfers</h3>
                    <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "var(--stock-muted)", maxWidth: "280px" }}>
                      No employees have requested to transfer a slip at this moment.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ══════════════════════════════════════════════════════════
                TAB 2: DIRECT VIOLATION REPORTS
               ══════════════════════════════════════════════════════════ */}
            {activeTab === "reports" && (
              <>
                {reports.map((r) => {
                  const proofUrl = getProofUrl(r.ProofFilePath);
                  const isVid = isVideoFile(proofUrl);
                  return (
                    <div
                      key={r.Id}
                      className="stock-panel"
                      style={{
                        marginBottom: "16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        borderRadius: "18px",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.04)"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--stock-border)", paddingBottom: "12px" }}>
                        <div>
                          <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "800", color: "var(--stock-accent)" }}>{r.ViolatorName}</h4>
                          <p style={{ margin: 0, fontSize: "12px", color: "var(--stock-muted)" }}>
                            Reported by: <span style={{ fontWeight: "600", color: "var(--stock-text)" }}>{r.ReporterName}</span>
                          </p>
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--stock-text)", background: "var(--stock-panel-bg)", padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--stock-border)" }}>
                          {new Date(r.ViolationTime).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                        </div>
                      </div>

                      <div style={{ fontSize: "13px", color: "var(--stock-text)", lineHeight: "1.6" }}>
                        <span style={{ fontWeight: "700" }}>Remarks: </span>
                        <span style={{ color: "var(--stock-muted)" }}>{r.Remarks || "N/A"}</span>
                      </div>

                      {proofUrl && (
                        <div style={{ marginTop: "4px" }}>
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxEvidence({
                                url: proofUrl,
                                title: `Violation Evidence: ${r.ViolatorName}`,
                                remarks: r.Remarks,
                                isVideo: isVid
                              })
                            }
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              fontSize: "12px",
                              fontWeight: "700",
                              color: "var(--stock-primary)",
                              border: "none",
                              background: "color-mix(in srgb, var(--stock-primary) 10%, transparent)",
                              padding: "8px 14px",
                              borderRadius: "10px",
                              cursor: "pointer"
                            }}
                          >
                            <IonIcon icon={imageOutline} style={{ fontSize: "16px" }} />
                            <span>View Evidence</span>
                            <Eye size={13} style={{ marginLeft: "2px" }} />
                          </button>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                        <button
                          className="stock-button"
                          style={{
                            flex: 1,
                            padding: "12px",
                            background: "var(--ion-color-success, #10b981)",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            fontWeight: 700,
                            borderRadius: "12px"
                          }}
                          onClick={() => handleOpenApproveReportModal(r)}
                        >
                          <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: "18px", marginRight: "6px" }} /> Approve
                        </button>
                        <button
                          className="stock-button stock-button--secondary"
                          style={{
                            flex: 1,
                            padding: "12px",
                            color: "var(--ion-color-danger, #ef4444)",
                            borderColor: "#fecaca",
                            background: "#fff",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            fontWeight: 700,
                            borderRadius: "12px"
                          }}
                          onClick={() => handleOpenRejectReportModal(r)}
                        >
                          <IonIcon icon={closeCircleOutline} style={{ fontSize: "18px", marginRight: "6px" }} /> Reject
                        </button>
                      </div>
                    </div>
                  );
                })}

                {reports.length === 0 && (
                  <div className="stock-panel" style={{ textAlign: "center", padding: "50px 20px", display: "flex", flexDirection: "column", alignItems: "center", borderRadius: "18px" }}>
                    <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--stock-panel-bg)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", border: "1px solid var(--stock-border)" }}>
                      <IonIcon icon={shieldCheckmarkOutline} style={{ fontSize: "32px", color: "var(--stock-muted)" }} />
                    </div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--stock-text)" }}>No Pending Violations</h3>
                    <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "var(--stock-muted)", maxWidth: "200px" }}>
                      You're all caught up! There are no direct violation reports waiting for your review.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            MODAL 1: PREMIUM CONFIRM APPROVE SLIP TRANSFER
           ══════════════════════════════════════════════════════════════ */}
        {transferToApprove && (
          <div className="va-modal-overlay" onClick={() => !approvingTransfer && setTransferToApprove(null)}>
            <div className="va-modal-card" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="va-modal-header approve">
                <div className="va-header-title-box">
                  <div className="va-header-icon-badge approve">
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <h3 className="va-header-title">Approve Slip Transfer</h3>
                    <p className="va-header-subtitle">Confirm disciplinary slip reassignment</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="va-modal-close-btn"
                  onClick={() => setTransferToApprove(null)}
                  disabled={approvingTransfer}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="va-modal-body">
                {/* Transfer Visual Flow Card */}
                <div className="va-flow-card">
                  <div className="va-flow-parties">
                    {/* From Party */}
                    <div className="va-party-box from">
                      <div className="va-party-role from">Cleared From</div>
                      <div className="va-party-avatar from">
                        {transferToApprove.FromEmpName?.charAt(0) || "E"}
                      </div>
                      <div className="va-party-name" title={transferToApprove.FromEmpName}>
                        {transferToApprove.FromEmpName}
                      </div>
                      <div className="va-party-code">#{transferToApprove.FromEmpCode}</div>
                      <span className="va-party-action-tag from">Slip Removed</span>
                    </div>

                    {/* Arrow with Badge in Middle */}
                    <div className="va-flow-arrow">
                      <div className="va-flow-arrow-circle">
                        <ArrowRightLeft size={16} />
                      </div>
                      <span
                        className={`va-flow-slip-badge ${
                          transferToApprove.SlipType?.toLowerCase().includes("red") ? "red" : "yellow"
                        }`}
                      >
                        {transferToApprove.SlipType}
                      </span>
                    </div>

                    {/* To Party */}
                    <div className="va-party-box to">
                      <div className="va-party-role to">Transferred To</div>
                      <div className="va-party-avatar to">
                        {transferToApprove.ToEmpName?.charAt(0) || "E"}
                      </div>
                      <div className="va-party-name" title={transferToApprove.ToEmpName}>
                        {transferToApprove.ToEmpName}
                      </div>
                      <div className="va-party-code">#{transferToApprove.ToEmpCode}</div>
                      <span className="va-party-action-tag to">Slip Assigned</span>
                    </div>
                  </div>
                </div>

                {/* Details Breakdown */}
                <div className="va-details-card">
                  <div className="va-detail-row">
                    <span className="va-detail-label">Policy Violation</span>
                    <span className="va-detail-val">{transferToApprove.PenaltyType || "Policy Violation"}</span>
                  </div>
                  <div className="va-detail-row">
                    <span className="va-detail-label">Violation Time</span>
                    <span className="va-detail-val">
                      {new Date(transferToApprove.ViolationTime).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short"
                      })}
                    </span>
                  </div>
                  {transferToApprove.OriginalRemarks && (
                    <div className="va-detail-row">
                      <span className="va-detail-label">Original Offense Note</span>
                      <span className="va-detail-val" style={{ maxWidth: "60%" }}>
                        {transferToApprove.OriginalRemarks}
                      </span>
                    </div>
                  )}

                  {/* Transfer Reason Box */}
                  <div className="va-reason-box">
                    <div className="va-reason-label">
                      <FileText size={12} />
                      <span>Transfer Reason &amp; Violation Observed</span>
                    </div>
                    <p className="va-reason-text">
                      "{transferToApprove.TransferReason || "No explanation provided."}"
                    </p>
                  </div>

                  {/* Attached Evidence Preview in Modal */}
                  {transferToApprove.ProofFilePath && (
                    <div className="va-modal-evidence">
                      <div className="va-evidence-left">
                        {isVideoFile(getProofUrl(transferToApprove.ProofFilePath)) ? (
                          <div
                            style={{
                              width: "44px",
                              height: "44px",
                              borderRadius: "8px",
                              background: "#ede9fe",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#7c3aed"
                            }}
                          >
                            <Film size={22} />
                          </div>
                        ) : (
                          <img
                            src={getProofUrl(transferToApprove.ProofFilePath)}
                            alt="Evidence"
                            className="va-evidence-thumb"
                            onClick={() =>
                              setLightboxEvidence({
                                url: getProofUrl(transferToApprove.ProofFilePath),
                                title: `Evidence: ${transferToApprove.PenaltyType}`,
                                remarks: transferToApprove.TransferReason
                              })
                            }
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        )}
                        <div className="va-evidence-info">
                          <span className="va-evidence-title">Attached Evidence File</span>
                          <span className="va-evidence-sub">
                            {isVideoFile(getProofUrl(transferToApprove.ProofFilePath))
                              ? "Video Proof Attached"
                              : "Photo / Image Proof"}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="va-evidence-btn"
                        onClick={() =>
                          setLightboxEvidence({
                            url: getProofUrl(transferToApprove.ProofFilePath),
                            title: `Evidence: ${transferToApprove.PenaltyType}`,
                            remarks: transferToApprove.TransferReason,
                            isVideo: isVideoFile(getProofUrl(transferToApprove.ProofFilePath))
                          })
                        }
                      >
                        <Eye size={13} />
                        <span>Preview</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Management Remarks Input */}
                <div className="va-input-group">
                  <label className="va-input-label">
                    <span>Approval Remarks / Notes</span>
                    <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "normal" }}>Optional</span>
                  </label>
                  <textarea
                    className="va-input-textarea"
                    placeholder="Enter management review observations or verification notes..."
                    value={approvalRemarks}
                    onChange={(e) => setApprovalRemarks(e.target.value)}
                  />
                </div>

                {/* Advisory Notice */}
                <div className="va-advisory-banner approve">
                  <CheckCircle size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
                  <div>
                    The slip will be cleared from <strong>{transferToApprove.FromEmpName}</strong> and assigned to{" "}
                    <strong>{transferToApprove.ToEmpName}</strong>. Scores and disciplinary thresholds will update immediately.
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="va-modal-footer">
                <button
                  type="button"
                  className="va-btn va-btn--cancel"
                  onClick={() => setTransferToApprove(null)}
                  disabled={approvingTransfer}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="va-btn va-btn--approve"
                  onClick={handleConfirmApproveTransfer}
                  disabled={approvingTransfer}
                >
                  {approvingTransfer ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Transferring...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      <span>Confirm &amp; Transfer Slip</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            MODAL 2: PREMIUM REJECT SLIP TRANSFER
           ══════════════════════════════════════════════════════════════ */}
        {transferToReject && (
          <div className="va-modal-overlay" onClick={() => !rejectingTransfer && setTransferToReject(null)}>
            <div className="va-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="va-modal-header reject">
                <div className="va-header-title-box">
                  <div className="va-header-icon-badge reject">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h3 className="va-header-title">Reject Transfer Request</h3>
                    <p className="va-header-subtitle">Decline employee's slip transfer</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="va-modal-close-btn"
                  onClick={() => setTransferToReject(null)}
                  disabled={rejectingTransfer}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="va-modal-body">
                <div className="va-advisory-banner reject">
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
                  <div>
                    The transfer request from <strong>{transferToReject.FromEmpName}</strong> to{" "}
                    <strong>{transferToReject.ToEmpName}</strong> will be rejected. The slip will remain active on{" "}
                    <strong>{transferToReject.FromEmpName}</strong>'s disciplinary record.
                  </div>
                </div>

                <div className="va-details-card">
                  <div className="va-detail-row">
                    <span className="va-detail-label">Slip Type</span>
                    <span className="va-detail-val">{transferToReject.SlipType}</span>
                  </div>
                  <div className="va-detail-row">
                    <span className="va-detail-label">Requester</span>
                    <span className="va-detail-val">
                      {transferToReject.FromEmpName} (#{transferToReject.FromEmpCode})
                    </span>
                  </div>
                  <div className="va-detail-row">
                    <span className="va-detail-label">Proposed Assignee</span>
                    <span className="va-detail-val">
                      {transferToReject.ToEmpName} (#{transferToReject.ToEmpCode})
                    </span>
                  </div>
                  {transferToReject.TransferReason && (
                    <div className="va-detail-row">
                      <span className="va-detail-label">Claimed Reason</span>
                      <span className="va-detail-val" style={{ maxWidth: "65%" }}>
                        {transferToReject.TransferReason}
                      </span>
                    </div>
                  )}
                </div>

                <div className="va-input-group">
                  <label className="va-input-label">
                    <span>Rejection Reason <strong style={{ color: "#e11d48" }}>*</strong></span>
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>Notified to employee</span>
                  </label>
                  <textarea
                    className="va-input-textarea reject"
                    placeholder="Enter reason for declining this slip transfer..."
                    value={rejectionRemarks}
                    onChange={(e) => setRejectionRemarks(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="va-modal-footer">
                <button
                  type="button"
                  className="va-btn va-btn--cancel"
                  onClick={() => setTransferToReject(null)}
                  disabled={rejectingTransfer}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="va-btn va-btn--reject"
                  onClick={handleConfirmRejectTransfer}
                  disabled={rejectingTransfer || !rejectionRemarks.trim()}
                >
                  {rejectingTransfer ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Rejecting...</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={16} />
                      <span>Confirm Rejection</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            MODAL 3: APPROVE DIRECT VIOLATION REPORT
           ══════════════════════════════════════════════════════════════ */}
        {reportToApprove && (
          <div className="va-modal-overlay" onClick={() => !approvingReport && setReportToApprove(null)}>
            <div className="va-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="va-modal-header approve">
                <div className="va-header-title-box">
                  <div className="va-header-icon-badge approve">
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <h3 className="va-header-title">Approve Violation Report</h3>
                    <p className="va-header-subtitle">Issue penalty slip to reported employee</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="va-modal-close-btn"
                  onClick={() => setReportToApprove(null)}
                  disabled={approvingReport}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="va-modal-body">
                <div className="va-advisory-banner approve">
                  <CheckCircle size={18} style={{ flexShrink: 0 }} />
                  <div>
                    Approving this report will officially issue a penalty slip to{" "}
                    <strong>{reportToApprove.ViolatorName}</strong> and notify the employee.
                  </div>
                </div>

                <div className="va-details-card">
                  <div className="va-detail-row">
                    <span className="va-detail-label">Reported Employee</span>
                    <span className="va-detail-val">{reportToApprove.ViolatorName}</span>
                  </div>
                  <div className="va-detail-row">
                    <span className="va-detail-label">Reported By</span>
                    <span className="va-detail-val">{reportToApprove.ReporterName}</span>
                  </div>
                  <div className="va-detail-row">
                    <span className="va-detail-label">Incident Time</span>
                    <span className="va-detail-val">
                      {new Date(reportToApprove.ViolationTime).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short"
                      })}
                    </span>
                  </div>
                  {reportToApprove.Remarks && (
                    <div className="va-detail-row">
                      <span className="va-detail-label">Report Remarks</span>
                      <span className="va-detail-val" style={{ maxWidth: "65%" }}>
                        {reportToApprove.Remarks}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="va-modal-footer">
                <button
                  type="button"
                  className="va-btn va-btn--cancel"
                  onClick={() => setReportToApprove(null)}
                  disabled={approvingReport}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="va-btn va-btn--approve"
                  onClick={handleConfirmApproveReport}
                  disabled={approvingReport}
                >
                  {approvingReport ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Approving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      <span>Confirm &amp; Issue Slip</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            MODAL 4: REJECT DIRECT VIOLATION REPORT
           ══════════════════════════════════════════════════════════════ */}
        {reportToReject && (
          <div className="va-modal-overlay" onClick={() => !rejectingReport && setReportToReject(null)}>
            <div className="va-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="va-modal-header reject">
                <div className="va-header-title-box">
                  <div className="va-header-icon-badge reject">
                    <XCircle size={24} />
                  </div>
                  <div>
                    <h3 className="va-header-title">Reject Violation Report</h3>
                    <p className="va-header-subtitle">Dismiss this peer report without issuing a slip</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="va-modal-close-btn"
                  onClick={() => setReportToReject(null)}
                  disabled={rejectingReport}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="va-modal-body">
                <div className="va-details-card">
                  <div className="va-detail-row">
                    <span className="va-detail-label">Reported Employee</span>
                    <span className="va-detail-val">{reportToReject.ViolatorName}</span>
                  </div>
                  <div className="va-detail-row">
                    <span className="va-detail-label">Reported By</span>
                    <span className="va-detail-val">{reportToReject.ReporterName}</span>
                  </div>
                </div>

                <div className="va-input-group">
                  <label className="va-input-label">
                    <span>Rejection Reason <strong style={{ color: "#e11d48" }}>*</strong></span>
                  </label>
                  <textarea
                    className="va-input-textarea reject"
                    placeholder="Enter reason for rejecting this report..."
                    value={reportRejectRemarks}
                    onChange={(e) => setReportRejectRemarks(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="va-modal-footer">
                <button
                  type="button"
                  className="va-btn va-btn--cancel"
                  onClick={() => setReportToReject(null)}
                  disabled={rejectingReport}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="va-btn va-btn--reject"
                  onClick={handleConfirmRejectReport}
                  disabled={rejectingReport || !reportRejectRemarks.trim()}
                >
                  {rejectingReport ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Rejecting...</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={16} />
                      <span>Confirm Rejection</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            MODAL 5: EVIDENCE LIGHTBOX
           ══════════════════════════════════════════════════════════════ */}
        {lightboxEvidence && (
          <div className="va-lightbox-overlay" onClick={() => setLightboxEvidence(null)}>
            <div className="va-lightbox-modal" onClick={(e) => e.stopPropagation()}>
              <div className="va-lightbox-header">
                <div>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "700" }}>{lightboxEvidence.title}</h4>
                  {lightboxEvidence.remarks && (
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>
                      {lightboxEvidence.remarks}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <a
                    href={lightboxEvidence.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: "rgba(255,255,255,0.15)",
                      color: "#fff",
                      textDecoration: "none",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    <ExternalLink size={13} />
                    <span>Open Raw</span>
                  </a>
                  <button
                    type="button"
                    className="va-modal-close-btn"
                    onClick={() => setLightboxEvidence(null)}
                    title="Close preview"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {lightboxEvidence.isVideo ? (
                <video
                  controls
                  autoPlay
                  playsInline
                  src={lightboxEvidence.url}
                  className="va-lightbox-media"
                />
              ) : (
                <img
                  src={lightboxEvidence.url}
                  alt="Evidence"
                  className="va-lightbox-media"
                />
              )}
            </div>
          </div>
        )}

        <IonToast
          isOpen={toastState.isOpen}
          message={toastState.message}
          color={toastState.color}
          duration={3500}
          position="top"
          onDidDismiss={() => setToastState((prev) => ({ ...prev, isOpen: false }))}
        />
      </IonContent>
    </IonPage>
  );
}

export default ViolationApproval;