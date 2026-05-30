import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";
import { IonIcon } from "@ionic/react";

import {
  warningOutline,
  alertCircleOutline,
  peopleOutline,
  statsChartOutline
} from "ionicons/icons";

import "./PenaltyDashboard.css";

function PenaltyDashboard() {

  const [dashboard, setDashboard] = useState<any>({
    summary: [],
    topViolations: [],
    scoreCard: [],
    escalations: []
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {

    try {

      const token = localStorage.getItem("token");

      const response = await axios.get(
        `${API_BASE}Penalty/GetPenaltyDashboard`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log(response.data);

      setDashboard({
        summary: response.data.summary || [],
        topViolations: response.data.topViolations || [],
        scoreCard: response.data.scoreCard || [],
        escalations: response.data.escalations || []
      });

    }
    catch (error) {

      console.log(error);

    }
    finally {

      setLoading(false);

    }
  };

  if (loading) {
    return (
      <div className="loading-box">
        Loading Dashboard...
      </div>
    );
  }

  const summary =
    dashboard.summary?.[0] || {
      TotalYellowSlips: 0,
      TotalRedSlips: 0,
      TotalEmployees: 0
    };

  return (

    <div className="penalty-dashboard">

      {/* HEADER */}

      <div className="dashboard-header">

        <h1>Employee Penalty Dashboard</h1>

      </div>

      {/* KPI CARDS */}

      <div className="dashboard-cards">

        <div className="dashboard-card yellow">

          <IonIcon
            icon={warningOutline}
            className="card-icon"
          />

          <h4>Total Yellow Slips</h4>

          <h1>{summary.TotalYellowSlips}</h1>

        </div>

        <div className="dashboard-card red">

          <IonIcon
            icon={alertCircleOutline}
            className="card-icon"
          />

          <h4>Total Red Slips</h4>

          <h1>{summary.TotalRedSlips}</h1>

        </div>

        <div className="dashboard-card blue">

          <IonIcon
            icon={peopleOutline}
            className="card-icon"
          />

          <h4>Total Employees</h4>

          <h1>{summary.TotalEmployees}</h1>

        </div>

        <div className="dashboard-card green">

          <IonIcon
            icon={statsChartOutline}
            className="card-icon"
          />

          <h4>Total Violations</h4>

         <h1>
{
  dashboard.topViolations.reduce(
      (sum:any,x:any) => sum + Number(x.TotalCount),
      0
  )
}
</h1>

        </div>

      </div>

      {/* TOP VIOLATIONS */}

      <div className="dashboard-section">

        <h2>Top Violations</h2>

        <div className="table-container">

          <table className="dashboard-table">

            <thead>

              <tr>

                <th>#</th>
                <th>Violation</th>
                <th>Total Count</th>

              </tr>

            </thead>

            <tbody>

              {
                dashboard.topViolations.length > 0 ?

                  dashboard.topViolations.map(
                    (item: any, index: number) => (

                      <tr key={index}>

                        <td>{index + 1}</td>

                        <td>{item.PenaltyType}</td>

                        <td>

                          <span className="count-badge">

                            {item.TotalCount}

                          </span>

                        </td>

                      </tr>

                    )
                  )

                  :

                  <tr>

                    <td
                      colSpan={3}
                      className="no-data"
                    >
                      No Violations Found
                    </td>

                  </tr>
              }

            </tbody>

          </table>

        </div>

      </div>

      {/* EMPLOYEE SCORECARD */}

      <div className="dashboard-section">

        <h2>Employee Scorecard</h2>

        <div className="table-container">

          <table className="dashboard-table">

            <thead>

              <tr>

                <th>Employee Code</th>
                <th>Employee Name</th>
                <th>Yellow Slips</th>
                <th>Red Slips</th>

              </tr>

            </thead>

            <tbody>

              {
                dashboard.scoreCard.length > 0 ?

                  dashboard.scoreCard.map(
                    (item: any, index: number) => (

                      <tr key={index}>

                        <td>{item.EMPCODE}</td>

                        <td>{item.EMPNAME}</td>

                        <td>

                          <span className="yellow-badge">

                            {item.YellowSlips}

                          </span>

                        </td>

                        <td>

                          <span className="red-badge">

                            {item.RedSlips}

                          </span>

                        </td>

                      </tr>

                    )
                  )

                  :

                  <tr>

                    <td
                      colSpan={4}
                      className="no-data"
                    >
                      No Employee Data Found
                    </td>

                  </tr>
              }

            </tbody>

          </table>

        </div>

      </div>

      {/* ESCALATION DASHBOARD */}

      <div className="dashboard-section">

        <h2>Escalation Dashboard</h2>

        <div className="table-container">

          <table className="dashboard-table">

            <thead>

              <tr>

                <th>Employee</th>
                <th>Yellow Slips</th>
                <th>Red Slips</th>
                <th>Status</th>

              </tr>

            </thead>

            <tbody>

              {
                dashboard.escalations.length > 0 ?

                  dashboard.escalations.map(
                    (item: any, index: number) => (

                      <tr key={index}>

                        <td>{item.EMPNAME}</td>

                        <td>{item.YellowSlips}</td>

                        <td>{item.RedSlips}</td>

                        <td>

                          <span
                            className={
                              item.EscalationStatus === "Disciplinary Review"
                                ? "badge-red"
                                : item.EscalationStatus === "Manager Escalation"
                                  ? "badge-orange"
                                  : item.EscalationStatus === "HR Warning"
                                    ? "badge-yellow"
                                    : "badge-green"
                            }
                          >
                            {item.EscalationStatus}
                          </span>

                        </td>

                      </tr>

                    )
                  )

                  :

                  <tr>

                    <td
                      colSpan={4}
                      className="no-data"
                    >
                      No Escalation Records Found
                    </td>

                  </tr>
              }

            </tbody>

          </table>

        </div>
<div className="fab-container">
        {/* Your orange action button element goes here */}
        <button className="your-orange-btn-class">+</button> 
      </div>
    </div>
      </div>

   
    
  );
}

export default PenaltyDashboard;