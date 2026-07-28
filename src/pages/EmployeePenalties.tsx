import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";

import "./EmployeePenalties.css";
import "./PenaltyDashboard.css";
import { IonPage, IonContent, IonIcon } from "@ionic/react";
import { ChevronLeft } from "lucide-react";
import { warningOutline, documentTextOutline } from "ionicons/icons";
import { useHistory } from "react-router-dom";

function EmployeePenalties() {
    const history = useHistory();
    const [userData, setUserData] =
        useState<any>(null);

    const [data, setData] = useState<any>({
        summary: [],
        violations: [],
        escalation: []
    });

    const [loading, setLoading] =
        useState(true);

    //----------------------------------------
    // LOAD USER FROM LOCAL STORAGE
    //----------------------------------------

    useEffect(() => {

        const storedUser =
            localStorage.getItem("user");

        if (storedUser) {

            const parsed =
                JSON.parse(storedUser);

            setUserData(parsed);

            const empCode =
                parsed.empCode ||
                parsed.EMPCODE;

            if (empCode) {
                loadData(empCode);
            }
        }

    }, []);

    //----------------------------------------
    // LOAD EMPLOYEE PENALTIES
    //----------------------------------------

    const loadData = async (
        empCode: string
    ) => {

        try {

            const token =
                localStorage.getItem("token");

            const response =
                await axios.get(
                    `${API_BASE}Penalty/GetEmployeePenaltyDashboard/${empCode}`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    });

            setData({
                summary:
                    response.data.summary || [],

                violations:
                    response.data.violations || [],

                escalation:
                    response.data.escalation || []
            });

        }
        catch (error) {

            console.log(error);

        }
        finally {

            setLoading(false);

        }
    };

    //----------------------------------------
    // LOADING
    //----------------------------------------

    if (loading) {

        return (
            <div className="loading-box">
                Loading...
            </div>
        );
    }

    const emp =
        data.summary?.[0] || {};

    const esc =
        data.escalation?.[0] || {};

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
                                <h1 className="page-wr-title">My Penalties</h1>
                                <p className="page-wr-subtitle">View your penalty dashboard and history</p>
                            </div>
                        </div>
                        <div className="page-wr-header-right">
                            <div className="page-wr-header-icon-box">
                                <IonIcon icon={warningOutline} style={{ color: 'var(--ion-color-primary)', fontSize: '24px' }} />
                            </div>
                        </div>
                    </div>

                    {/* Action Bar */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '0 16px 16px 16px' }}>
                        <button 
                            className="stock-button stock-button--secondary" 
                            onClick={() => history.push("/violation-report")}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '14px', fontSize: '13px', fontWeight: '700' }}
                        >
                            <IonIcon icon={documentTextOutline} style={{ fontSize: '18px' }} />
                            Transfer Slip
                        </button>
                    </div>

                    <div className="stock-panel" style={{ margin: '0 16px 20px 16px' }}>
            
            {/* SUMMARY */}

            {/* ── BENTO SUMMARY GRID ── */}
            <div className="ep-summary-bento">
                <div className="ep-bento-box green">
                    <div className="ep-bento-label">Green Slips</div>
                    <div className="ep-bento-value">{emp.TotalGreenSlips || 0}</div>
                </div>
                <div className="ep-bento-box yellow">
                    <div className="ep-bento-label">Yellow Slips</div>
                    <div className="ep-bento-value">{emp.TotalYellowSlips || 0}</div>
                </div>
                <div className="ep-bento-box orange">
                    <div className="ep-bento-label">Orange Slips</div>
                    <div className="ep-bento-value">{emp.TotalOrangeSlips || 0}</div>
                </div>
                <div className="ep-bento-box red">
                    <div className="ep-bento-label">Red Slips</div>
                    <div className="ep-bento-value">{emp.TotalRedSlips || 0}</div>
                </div>
                <div className="ep-bento-box score">
                    <div className="ep-bento-label">Performance Score</div>
                    <div className="ep-bento-value">
                        {Number(emp.TotalPerformanceScore || 0).toFixed(2)}
                    </div>
                </div>
            </div>

            {/* VIOLATIONS */}

            <div className="dashboard-section">

                <h2>
                    Violation History
                </h2>

                <div className="ep-history-list">
                    {data.violations.length > 0 ? (
                        data.violations.map((item: any, index: number) => (
                            <div key={index} className="ep-history-card">
                                <div className="ep-card-header">
                                    <span className="ep-date">{item.AppliedDate}</span>
                                    <span className={`ep-slip-badge ${item.SlipType?.toLowerCase()}`}>
                                        {item.SlipType}
                                    </span>
                                </div>
                                <div className="ep-card-body">
                                    <div className="ep-info-row">
                                        <label>Penalty</label>
                                        <span>{item.PenaltyType}</span>
                                    </div>
                                    <div className="ep-info-row">
                                        <label>Count</label>
                                        <span>{item.SlipCount}</span>
                                    </div>
                                </div>
                                {item.Remarks && (
                                    <div className="ep-card-footer">
                                        <p>{item.Remarks}</p>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="ep-empty-state">
                            No Penalties Found
                        </div>
                    )}
                </div>

            </div>

            {/* ESCALATION */}

            <div className="ep-escalation-section">
                <h2>Current Escalation Status</h2>
                <div className={`ep-escalation-pill ${esc.EscalationStatus === "Disciplinary Review" ? "danger"
                        : esc.EscalationStatus === "Manager Escalation" ? "orange"
                            : esc.EscalationStatus === "HR Warning" ? "warning"
                                : "safe"
                    }`}>
                    <div className="ep-esc-ring"></div>
                    <span>{esc.EscalationStatus || "Normal"}</span>
                </div>
            </div>
                    </div>
                </div>
            </IonContent>
        </IonPage>
    );
}

export default EmployeePenalties;