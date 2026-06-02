import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";

import "./EmployeePenalties.css";

function EmployeePenalties() {

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

            <div className="employee-header">

                <h1>My Penalties</h1>

               {/* <div className="employee-info">

    <h2>{emp.EMPNAME}</h2>

    <span>Employee Code : {emp.EMPCODE}</span>

</div> */}

            </div>

            {/* SUMMARY */}

            <div className="summary-card">

    <div className="summary-box yellow-box">

                    <span>
                        Yellow Slips
                    </span>

                    <h1>
                        {emp.TotalYellowSlips || 0}
                    </h1>

                </div>

                <div className="summary-box red-box">

                    <span>
                        Red Slips
                    </span>

                    <h1>
                        {emp.TotalRedSlips || 0}
                    </h1>

                </div>

            </div>

            {/* VIOLATIONS */}

            <div className="dashboard-section">

                <h2>
                    Violation History
                </h2>

                <div className="table-container">

                    <table className="penalty-table">

                        <thead>

                            <tr>

                                <th>
                                    Penalty
                                </th>

                                <th>
                                    Slip Type
                                </th>

                                <th>
                                    Count
                                </th>

                                <th>
                                    Remarks
                                </th>

                                <th>
                                    Date
                                </th>

                            </tr>

                        </thead>

                        <tbody>

                            {
                                data.violations.length > 0 ?

                                    data.violations.map(
                                        (
                                            item: any,
                                            index: number
                                        ) => (

                                            <tr key={index}>

                                                <td>
                                                    {item.PenaltyType}
                                                </td>

                                                <td>
                                                    {item.SlipType}
                                                </td>

                                                <td>
                                                    {item.SlipCount}
                                                </td>

                                                <td>
                                                    {item.Remarks}
                                                </td>

                                                <td>
                                                    {item.AppliedDate}
                                                </td>

                                            </tr>

                                        )
                                    )

                                    :

                                    <tr>

                                        <td
                                            colSpan={5}
                                            className="no-data"
                                        >
                                            No Penalties Found
                                        </td>

                                    </tr>
                            }

                        </tbody>

                    </table>

                </div>

            </div>

            {/* ESCALATION */}

            <div className="dashboard-section">

                <h2>
                    Escalation Status
                </h2>

                <div
                    className={
                        esc.EscalationStatus ===
                            "Disciplinary Review"
                            ? "escalation red"

                            : esc.EscalationStatus ===
                                "Manager Escalation"
                                ? "escalation orange"

                                : esc.EscalationStatus ===
                                    "HR Warning"
                                    ? "escalation yellow"

                                    : "escalation green"
                    }
                >
                    {
                        esc.EscalationStatus ||
                        "Normal"
                    }
                </div>

            </div>

        </div>
    );
}

export default EmployeePenalties;