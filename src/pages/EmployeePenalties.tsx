import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";

import "./EmployeePenalties.css";
import "./PenaltyDashboard.css";
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

        <div className="employee-penalty">

            <div className="dashboard-header">

                <h1>My Penalties</h1>
<button
    className="penalty-list-btn"
    onClick={() => history.push("/violation-report")}
  >
    Transfer Slip
  </button>
               {/* <div className="employee-info">

    <h2>{emp.EMPNAME}</h2>

    <span>Employee Code : {emp.EMPCODE}</span>

</div> */}

            </div>

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
    <div className={`ep-escalation-pill ${
        esc.EscalationStatus === "Disciplinary Review" ? "danger"
        : esc.EscalationStatus === "Manager Escalation" ? "orange"
        : esc.EscalationStatus === "HR Warning" ? "warning"
        : "safe"
    }`}>
        <div className="ep-esc-ring"></div>
        <span>{esc.EscalationStatus || "Normal"}</span>
    </div>
</div>

        </div>
    );
}

export default EmployeePenalties;