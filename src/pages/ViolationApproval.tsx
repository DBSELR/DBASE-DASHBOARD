import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";
import { useHistory } from "react-router-dom";
import {
  IonPage,
  IonContent,
  IonIcon
} from "@ionic/react";
import {
  shieldCheckmarkOutline,
  imageOutline,
  checkmarkCircleOutline,
  closeCircleOutline
} from "ionicons/icons";
import { ChevronLeft } from "lucide-react";

import "./WorkReports.css";
import "./RequestsPage.css";
import "./Stock.css";

function ViolationApproval() {
  const history = useHistory();
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    loadReports();
  }, []);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const reviewer = user.empCode || user.EMPCODE || "ADMIN";

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

  const approve = async (id: number) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE}Penalty/ApproveViolationReport?reportId=${id}&reviewedBy=${encodeURIComponent(reviewer)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      loadReports();
    } catch (err) {
      console.error(err);
      alert("Error approving report");
    }
  };

  const reject = async (id: number) => {
    const remarks = prompt("Reject Reason");
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
      loadReports();
    } catch (err) {
      console.error(err);
      alert("Error rejecting report");
    }
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
                <h1 className="page-wr-title">Pending Approvals</h1>
                <p className="page-wr-subtitle">Review violation reports</p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <div className="page-wr-header-icon-box">
                <IonIcon icon={shieldCheckmarkOutline} style={{ color: 'var(--ion-color-primary)', fontSize: '24px' }} />
              </div>
            </div>
          </div>

          <div style={{ margin: '0 16px 20px 16px' }}>
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
                      href={`${API_BASE.replace("api/", "")}${r.ProofFilePath}`}
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
                    style={{ flex: 1, padding: '12px', background: 'var(--ion-color-success, #10b981)', display: 'flex', justifyContent: 'center', alignItems: 'center' }} 
                    onClick={() => approve(r.Id)}
                  >
                    <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: '18px', marginRight: '6px' }} /> Approve
                  </button>
                  <button 
                    className="stock-button stock-button--secondary" 
                    style={{ flex: 1, padding: '12px', color: 'var(--ion-color-danger, #ef4444)', borderColor: 'var(--ion-color-danger, #ef4444)', display: 'flex', justifyContent: 'center', alignItems: 'center' }} 
                    onClick={() => reject(r.Id)}
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
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--stock-text)' }}>No Pending Approvals</h3>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: 'var(--stock-muted)', maxWidth: '200px' }}>
                  You're all caught up! There are no violations waiting for your review.
                </p>
              </div>
            )}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}

export default ViolationApproval;