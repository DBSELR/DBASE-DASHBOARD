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
import { ChevronLeft } from "lucide-react";

import "./PenaltyDashboard.css";
import "./WorkReports.css";
import "./RequestsPage.css";
import "./Stock.css";
import { useHistory } from "react-router-dom";

function PenaltyDashboard() {
  const history = useHistory();

  const [dashboard, setDashboard] = useState<any>({
    summary: [],
    topViolations: [],
    scoreCard: [],
    escalations: [],
    worstPerformers: []
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
        escalations: response.data.escalations || [],
        worstPerformers: response.data.worstPerformers || []
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

      {/* ── Premium Header ── */}
      <div className="page-wr-header" style={{ marginBottom: '16px' }}>
        <div className="page-wr-header-left">
          <button className="page-wr-back-btn" onClick={() => history.goBack()}>
            <ChevronLeft size={22} color="white" />
          </button>
          <div>
            <h1 className="page-wr-title">Penalty Dashboard</h1>
            <p className="page-wr-subtitle">Overview of employee penalties</p>
          </div>
        </div>
        <div className="page-wr-header-right">
          <div className="page-wr-header-icon-box">
            <IonIcon icon={statsChartOutline} style={{ color: 'var(--ion-color-primary)', fontSize: '24px' }} />
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="stock-container" style={{ display: 'flex', justifyContent: 'flex-end', margin: '0 16px 16px 16px', padding: 0, minHeight: 'auto', maxHeight: 'none', background: 'transparent', overflow: 'visible' }}>
        <button 
          className="stock-button stock-button--secondary" 
          onClick={() => history.push("/penalty-list")}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '14px', fontSize: '13px', fontWeight: '700' }}
        >
          <IonIcon icon={peopleOutline} style={{ fontSize: '18px' }} />
          View Penalty List
        </button>
      </div>

      {/* KPI CARDS */}

      <div className="dashboard-cards">

        {/* Green */}
        <div className="dashboard-card green">
          <div className="card-content">
            <h4>Total Green Slips</h4>
            <h1>{summary.TotalGreenSlips || 0}</h1>
          </div>
          <div className="card-icon-box">
            <IonIcon icon={statsChartOutline} />
          </div>
        </div>

        {/* Yellow */}
        <div className="dashboard-card yellow">
          <div className="card-content">
            <h4>Total Yellow Slips</h4>
            <h1>{summary.TotalYellowSlips || 0}</h1>
          </div>
          <div className="card-icon-box">
            <IonIcon icon={warningOutline} />
          </div>
        </div>

        {/* Orange */}
        <div className="dashboard-card orange">
          <div className="card-content">
            <h4>Total Orange Slips</h4>
            <h1>{summary.TotalOrangeSlips || 0}</h1>
          </div>
          <div className="card-icon-box">
            <IonIcon icon={alertCircleOutline} />
          </div>
        </div>

        {/* Red */}
        <div className="dashboard-card red">
          <div className="card-content">
            <h4>Total Red Slips</h4>
            <h1>{summary.TotalRedSlips || 0}</h1>
          </div>
          <div className="card-icon-box">
            <IonIcon icon={alertCircleOutline} />
          </div>
        </div>

        {/* Employees */}
        <div className="dashboard-card blue">
          <div className="card-content">
            <h4>Total Employees</h4>
            <h1>{summary.TotalEmployees || 0}</h1>
          </div>
          <div className="card-icon-box">
            <IonIcon icon={peopleOutline} />
          </div>
        </div>

        {/* Overall Score */}
        <div className="dashboard-card purple">
          <div className="card-content">
            <h4>Average Score</h4>
            <h1>{Number(summary.AverageScore || 0).toFixed(2)}</h1>
          </div>
          <div className="card-icon-box">
            <IonIcon icon={statsChartOutline} />
          </div>
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
                <th>Green</th>
                <th>Yellow</th>
                <th>Orange</th>
                <th>Red</th>
                <th>Score</th>
                <th>Scale</th>
              </tr>
            </thead>

            <tbody>

              {
                dashboard.scoreCard.map((item: any, index: number) => (

                  <tr key={index}>
                    <td>{item.EMPCODE}</td>
                    <td>{item.EMPNAME}</td>

                    <td>
                      <span className="green-badge">
                        {item.GreenSlips}
                      </span>
                    </td>

                    <td>
                      <span className="yellow-badge">
                        {item.YellowSlips}
                      </span>
                    </td>

                    <td>
                      <span className="orange-badge">
                        {item.OrangeSlips}
                      </span>
                    </td>

                    <td>
                      <span className="red-badge">
                        {item.RedSlips}
                      </span>
                    </td>

                    <td>{item.PerformanceScore}</td>

                    <td>{item.PerformanceScale}</td>

                  </tr>

                ))
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

                <th>Emp Code</th>
                <th>Employee Name</th>
                <th>Green</th>
                <th>Yellow</th>
                <th>Orange</th>
                <th>Red</th>
                <th>Score</th>
                <th>Scale</th>
                <th>Status</th>

              </tr>

            </thead>

            <tbody>

              {
                dashboard.escalations.length > 0 ?

                  dashboard.escalations.map(
                    (item: any, index: number) => (

                      <tr key={index}>

                        <td>{item.EMPCODE}</td>
                        <td>{item.EMPNAME}</td>

                        <td>{item.GreenSlips}</td>
                        <td>{item.YellowSlips}</td>
                        <td>{item.OrangeSlips}</td>
                        <td>{item.RedSlips}</td>

                        <td>{item.PerformanceScore}</td>

                        <td>{item.PerformanceScale}</td>

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
          {/* <button className="your-orange-btn-class">+</button>  */}
        </div>
      </div>

      <div className="dashboard-section">

        <h2>Top 10 Worst Performers</h2>

        <div className="table-container">

          <table className="dashboard-table">

            <thead>
              <tr>
                <th>EmpCode</th>
                <th>Name</th>
                <th>Green</th>
                <th>Yellow</th>
                <th>Orange</th>
                <th>Red</th>
                <th>Score</th>
              </tr>
            </thead>

            <tbody>

              {
                dashboard.worstPerformers.map(
                  (item: any, index: number) => (

                    <tr key={index}>
                      <td>{item.EMPCODE}</td>
                      <td>{item.EMPNAME}</td>
                      <td>{item.GreenSlips}</td>
                      <td>{item.YellowSlips}</td>
                      <td>{item.OrangeSlips}</td>
                      <td>{item.RedSlips}</td>
                      <td>{item.PerformanceScore}</td>
                    </tr>

                  ))
              }

            </tbody>

          </table>

        </div>

      </div>


    </div>



  );
}

export default PenaltyDashboard;