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
  AlertTriangle
} from "lucide-react";

import "./WorkReports.css";
import "./RequestsPage.css";
import "./Stock.css";

function ViolationApproval() {
  const history = useHistory();
  const [activeTab, setActiveTab] = useState<"transfers" | "reports">("transfers");

  const [reports, setReports] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const reviewer = user.empCode || user.EMPCODE || "ADMIN";

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

  // Direct violation approval
  const approveReport = async (id: number) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE}Penalty/ApproveViolationReport?reportId=${id}&reviewedBy=${encodeURIComponent(reviewer)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Violation Report Approved. Penalty slip issued to employee.");
      loadReports();
    } catch (err) {
      console.error(err);
      alert("Error approving report");
    }
  };

  const rejectReport = async (id: number) => {
    const remarks = prompt("Enter Rejection Reason:");
    if (!remarks) return;

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE}Penalty/RejectViolationReport`,
        {
          reportId: id,
          reviewedBy: reviewer,
          remarks
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Violation report rejected.");
      loadReports();
    } catch (err) {
      console.error(err);
      alert("Error rejecting report");
    }
  };

  const [toastState, setToastState] = useState<{ isOpen: boolean; message: string; color: "success" | "danger" | "warning" }>({
    isOpen: false,
    message: "",
    color: "success"
  });

  const showToast = (message: string, color: "success" | "danger" | "warning" = "success") => {
    setToastState({ isOpen: true, message, color });
  };

  // Slip Transfer approval
  const approveTransfer = async (transfer: any) => {
    const confirmTransfer = window.confirm(
      `Are you sure you want to approve this slip transfer?\n\n• The ${transfer.SlipType} will be TRANSFERRED to ${transfer.ToEmpName} (#${transfer.ToEmpCode}).\n• The slip will be CLEARED from ${transfer.FromEmpName} (#${transfer.FromEmpCode}).`
    );
    if (!confirmTransfer) return;

    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE}Penalty/ApproveSlipTransfer?requestId=${transfer.RequestId}&reviewedBy=${encodeURIComponent(reviewer)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        showToast(`✅ Slip successfully transferred to ${transfer.ToEmpName} and cleared from ${transfer.FromEmpName}!`, "success");
        loadTransfers();
      } else {
        showToast(res.data?.message || "Failed to approve slip transfer.", "danger");
      }
    } catch (err: any) {
      console.error(err);
      showToast(err?.response?.data?.message || "Error approving slip transfer", "danger");
    }
  };

  const rejectTransfer = async (transfer: any) => {
    const remarks = prompt("Enter Reason for Rejecting Transfer (This will be notified to the requester):");
    if (!remarks || remarks.trim() === "") return;

    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE}Penalty/RejectSlipTransfer`,
        {
          requestId: transfer.RequestId,
          reviewedBy: reviewer,
          remarks: remarks.trim()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        showToast(`Slip transfer rejected. The slip remains active with ${transfer.FromEmpName}.`, "warning");
        loadTransfers();
      } else {
        showToast(res.data?.message || "Failed to reject transfer.", "danger");
      }
    } catch (err: any) {
      console.error(err);
      showToast(err?.response?.data?.message || "Error rejecting slip transfer", "danger");
    }
  };

  const getProofUrl = (path: string) => {
    if (!path) return "";
    let clean = path.replace(/\\/g, "/").trim();
    if (!clean.startsWith("/")) clean = "/" + clean;
    const base = API_BASE.replace(/\/api\/?$/, "");
    return `${base}${clean}`;
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
                <h1 className="page-wr-title">Penalty Approvals</h1>
                <p className="page-wr-subtitle">Review peer violation reports and slip transfer requests</p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <div className="page-wr-header-icon-box">
                <IonIcon icon={shieldCheckmarkOutline} style={{ color: 'var(--ion-color-primary)', fontSize: '24px' }} />
              </div>
            </div>
          </div>

          {/* ── Segment Toggle Tabs ── */}
          <div style={{ display: 'flex', gap: '8px', margin: '0 16px 16px', background: '#f1f5f9', padding: '6px', borderRadius: '14px' }}>
            <button
              onClick={() => setActiveTab("transfers")}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: 'none',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                background: activeTab === "transfers" ? '#ffffff' : 'transparent',
                color: activeTab === "transfers" ? '#ea580c' : '#64748b',
                boxShadow: activeTab === "transfers" ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <ArrowRightLeft size={16} />
              <span>Slip Transfers</span>
              {transfers.length > 0 && (
                <span style={{ background: '#ea580c', color: '#fff', fontSize: '11px', padding: '2px 7px', borderRadius: '20px', fontWeight: 800 }}>
                  {transfers.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("reports")}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: 'none',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                background: activeTab === "reports" ? '#ffffff' : 'transparent',
                color: activeTab === "reports" ? '#ea580c' : '#64748b',
                boxShadow: activeTab === "reports" ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <ShieldAlert size={16} />
              <span>Direct Violations</span>
              {reports.length > 0 && (
                <span style={{ background: '#3b82f6', color: '#fff', fontSize: '11px', padding: '2px 7px', borderRadius: '20px', fontWeight: 800 }}>
                  {reports.length}
                </span>
              )}
            </button>
          </div>

          <div style={{ margin: '0 16px 20px 16px' }}>

            {/* ══════════════════════════════════════════════════════════
                TAB 1: SLIP TRANSFER REQUESTS
               ══════════════════════════════════════════════════════════ */}
            {activeTab === "transfers" && (
              <>
                {transfers.map((t) => (
                  <div key={t.RequestId} className="stock-panel" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: '4px solid #ea580c' }}>
                    {/* Header: Direction of transfer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--stock-border)', paddingBottom: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>
                          <ArrowRightLeft size={13} /> Slip Transfer Request
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ color: '#475569' }}>From: <strong>{t.FromEmpName}</strong> (#{t.FromEmpCode})</span>
                          <span style={{ color: '#ea580c', fontWeight: 800 }}>➔</span>
                          <span style={{ color: '#b91c1c' }}>To: <strong>{t.ToEmpName}</strong> (#{t.ToEmpCode})</span>
                        </div>
                      </div>
                      <span className={`ep-slip-badge ${t.SlipType?.toLowerCase().replace(/\s+/g, "-")}`} style={{ margin: 0 }}>
                        {t.SlipType}
                      </span>
                    </div>

                    {/* Original Slip Information */}
                    <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '10px', fontSize: '12px', color: '#334155', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: 700, marginBottom: '4px', color: '#64748b', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.3px' }}>Original Slip Details:</div>
                      <div><strong>Offense:</strong> {t.PenaltyType}</div>
                      {t.OriginalRemarks && <div><strong>Original Reason:</strong> {t.OriginalRemarks}</div>}
                    </div>

                    {/* Transfer Reason & Evidence Remarks */}
                    <div style={{ fontSize: '13px', color: 'var(--stock-text)', lineHeight: '1.6' }}>
                      <span style={{ fontWeight: '700', color: '#1e293b' }}>Transfer Reason & Violation Observed: </span>
                      <p style={{ margin: '4px 0 0 0', background: '#fff7ed', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fed7aa', color: '#9a3412', fontSize: '13px' }}>
                        {t.TransferReason || "No explanation provided."}
                      </p>
                    </div>

                    {/* Time of Incident */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#64748b' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={13} />
                        Violation Time: <strong>{new Date(t.ViolationTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</strong>
                      </span>
                      <span>Requested: {new Date(t.CreatedDate).toLocaleDateString()}</span>
                    </div>

                    {/* Attached Evidence */}
                    {t.ProofFilePath ? (
                      <div style={{ marginTop: '2px' }}>
                        <a 
                          href={getProofUrl(t.ProofFilePath)}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#ea580c', textDecoration: 'none', background: 'rgba(234, 88, 12, 0.1)', padding: '8px 14px', borderRadius: '10px' }}
                        >
                          <ImageIcon size={16} /> View Attached Evidence
                        </a>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                        No physical file evidence attached.
                      </div>
                    )}

                    {/* Approval & Rejection Actions */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                      <button 
                        className="stock-button" 
                        style={{ flex: 1, padding: '12px', background: '#10b981', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 700 }} 
                        onClick={() => approveTransfer(t)}
                      >
                        <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: '18px', marginRight: '6px' }} />
                        Accept & Transfer
                      </button>
                      <button 
                        className="stock-button stock-button--secondary" 
                        style={{ flex: 1, padding: '12px', color: '#ef4444', borderColor: '#ef4444', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 700 }} 
                        onClick={() => rejectTransfer(t)}
                      >
                        <IonIcon icon={closeCircleOutline} style={{ fontSize: '18px', marginRight: '6px' }} />
                        Reject Transfer
                      </button>
                    </div>
                  </div>
                ))}

                {transfers.length === 0 && (
                  <div className="stock-panel" style={{ textAlign: 'center', padding: '50px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--stock-panel-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', border: '1px solid var(--stock-border)' }}>
                      <ArrowRightLeft size={32} style={{ color: 'var(--stock-muted)' }} />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--stock-text)' }}>No Pending Slip Transfers</h3>
                    <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: 'var(--stock-muted)', maxWidth: '280px' }}>
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
                {reports.map((r) => (
                  <div key={r.Id} className="stock-panel" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--stock-border)', paddingBottom: '12px' }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '800', color: 'var(--stock-accent)' }}>{r.ViolatorName}</h4>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--stock-muted)' }}>
                          Reported by: <span style={{ fontWeight: '600', color: 'var(--stock-text)' }}>{r.ReporterName}</span>
                        </p>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--stock-text)', background: 'var(--stock-panel-bg)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--stock-border)' }}>
                        {new Date(r.ViolationTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '13px', color: 'var(--stock-text)', lineHeight: '1.6' }}>
                      <span style={{ fontWeight: '700' }}>Remarks: </span>
                      <span style={{ color: 'var(--stock-muted)' }}>{r.Remarks || "N/A"}</span>
                    </div>

                    {r.ProofFilePath && (
                      <div style={{ marginTop: '4px' }}>
                        <a 
                          href={getProofUrl(r.ProofFilePath)}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: 'var(--stock-primary)', textDecoration: 'none', background: 'color-mix(in srgb, var(--stock-primary) 10%, transparent)', padding: '8px 14px', borderRadius: '10px' }}
                        >
                          <IonIcon icon={imageOutline} style={{ fontSize: '16px' }} /> View Evidence
                        </a>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                      <button 
                        className="stock-button" 
                        style={{ flex: 1, padding: '12px', background: 'var(--ion-color-success, #10b981)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 700 }} 
                        onClick={() => approveReport(r.Id)}
                      >
                        <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: '18px', marginRight: '6px' }} /> Approve
                      </button>
                      <button 
                        className="stock-button stock-button--secondary" 
                        style={{ flex: 1, padding: '12px', color: 'var(--ion-color-danger, #ef4444)', borderColor: 'var(--ion-color-danger, #ef4444)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 700 }} 
                        onClick={() => rejectReport(r.Id)}
                      >
                        <IonIcon icon={closeCircleOutline} style={{ fontSize: '18px', marginRight: '6px' }} /> Reject
                      </button>
                    </div>
                  </div>
                ))}

                {reports.length === 0 && (
                  <div className="stock-panel" style={{ textAlign: 'center', padding: '50px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--stock-panel-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', border: '1px solid var(--stock-border)' }}>
                      <IonIcon icon={shieldCheckmarkOutline} style={{ fontSize: '32px', color: 'var(--stock-muted)' }} />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--stock-text)' }}>No Pending Violations</h3>
                    <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: 'var(--stock-muted)', maxWidth: '200px' }}>
                      You're all caught up! There are no direct violation reports waiting for your review.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <IonToast
          isOpen={toastState.isOpen}
          message={toastState.message}
          color={toastState.color}
          duration={3500}
          position="top"
          onDidDismiss={() => setToastState(prev => ({ ...prev, isOpen: false }))}
        />
      </IonContent>
    </IonPage>
  );
}

export default ViolationApproval;