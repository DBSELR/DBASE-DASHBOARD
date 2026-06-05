import React, {
  useEffect,
  useState
} from "react";

import axios from "axios";

import { API_BASE } from "../config";

import {
  IonIcon
} from "@ionic/react";

import {
  chevronDownOutline,
  chevronForwardOutline,
  documentTextOutline
} from "ionicons/icons";

import "./PenaltyList.css";

function PenaltyList() {

  const [employees, setEmployees] =
    useState<any[]>([]);

  const [filteredEmployees,
    setFilteredEmployees] =
    useState<any[]>([]);

  const [expandedEmp,
    setExpandedEmp] =
    useState<string | null>(null);

  const [details,
    setDetails] =
    useState<any>({});

  const [search,
    setSearch] =
    useState("");

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {

    const filtered =
      employees.filter((e) =>
        e.EMPNAME
          ?.toLowerCase()
          .includes(
            search.toLowerCase()
          ) ||
        e.EMPCODE
          ?.toLowerCase()
          .includes(
            search.toLowerCase()
          )
      );

    setFilteredEmployees(
      filtered
    );

  }, [search, employees]);

  const loadSummary =
    async () => {

      try {

        const res =
          await axios.get(
            `${API_BASE}Penalty/GetEmployeeSlipSummary`
          );

        setEmployees(
          res.data || []
        );

        setFilteredEmployees(
          res.data || []
        );

      }
      catch (err) {

        console.error(err);

      }
    };

  const toggleEmployee =
    async (
      empCode: string
    ) => {

      try {

        if (
          expandedEmp === empCode
        ) {

          setExpandedEmp(
            null
          );

          return;
        }

        if (
          !details[empCode]
        ) {

          const res =
            await axios.get(
              `${API_BASE}Penalty/GetEmployeePenaltyDetails/${empCode}`
            );

          setDetails(
            (
              prev: any
            ) => ({
              ...prev,
              [empCode]:
                res.data || []
            })
          );
        }

        setExpandedEmp(
          empCode
        );

      }
      catch (err) {

        console.error(err);

      }
    };

  const getProofUrl =
    (path: string) => {

      if (!path)
        return "";

      return `${API_BASE.replace(
        "api/",
        ""
      )}${path}`;

    };

  return (

    <div className="penalty-page">

      <div className="penalty-card">

        <div className="page-header">

          <h2>
            Employee Penalties
          </h2>

        </div>

        <div
          className="search-box"
        >

          <input
            type="text"
            placeholder="Search Employee..."
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
          />

        </div>

        {/* ── RESPONSIVE PENALTY LIST ── */}
        <div className="pl-list-container">
          {filteredEmployees.length === 0 ? (
            <div className="pl-empty-state">No penalties found</div>
          ) : (
            filteredEmployees.map((emp) => (
              <div key={emp.EMPCODE} className={`pl-emp-card ${expandedEmp === emp.EMPCODE ? 'expanded' : ''}`}>
                
                {/* ── Summary Row ── */}
                <div 
                  className="pl-summary-row" 
                  onClick={() => toggleEmployee(emp.EMPCODE)}
                >
                  <div className="pl-emp-info">
                    <div className="pl-avatar">
                      {emp.EMPNAME?.charAt(0) || "E"}
                    </div>
                    <div className="pl-emp-text">
                      <div className="pl-emp-name">{emp.EMPNAME}</div>
                      <div className="pl-emp-code">{emp.EMPCODE}</div>
                    </div>
                  </div>

                  <div className="pl-stats-group">
                    <div className="pl-stat-pill yellow">
                      <span className="pl-stat-num">{emp.YellowSlips || 0}</span>
                      <span className="pl-stat-label">Yellow</span>
                    </div>
                    <div className="pl-stat-pill red">
                      <span className="pl-stat-num">{emp.RedSlips || 0}</span>
                      <span className="pl-stat-label">Red</span>
                    </div>
                  </div>

                  <div className="pl-status-group">
                    <span className={`pl-escalation-badge ${
                      emp.EscalationStatus === "Normal" ? "safe" : 
                      emp.EscalationStatus === "HR Warning" ? "warning" : "danger"
                    }`}>
                      {emp.EscalationStatus}
                    </span>
                    <IonIcon 
                      icon={expandedEmp === emp.EMPCODE ? chevronDownOutline : chevronForwardOutline} 
                      className="pl-expand-icon"
                    />
                  </div>
                </div>

                {/* ── Expanded Details ── */}
                {expandedEmp === emp.EMPCODE && (
                  <div className="pl-details-section">
                    <div className="pl-details-header">
                      <span>Penalty History</span>
                    </div>

                    <div className="pl-details-grid">
                      {!details[emp.EMPCODE] || details[emp.EMPCODE].length === 0 ? (
                        <div className="pl-empty-details">Loading details...</div>
                      ) : (
                        details[emp.EMPCODE].map((d: any) => (
                          <div key={d.Id} className="pl-detail-card">
                            <div className="pl-detail-top">
                              <span className="pl-detail-date">
                                {new Date(d.PenaltyDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                              <span className={`pl-detail-status ${d.Status?.toLowerCase()}`}>
                                {d.Status}
                              </span>
                            </div>

                            <div className="pl-detail-body">
                              <div className="pl-detail-item">
                                <label>Type</label>
                                <span>{d.SlipType} <span className="pl-count-badge">{d.SlipCount}</span></span>
                              </div>
                              <div className="pl-detail-item">
                                <label>Time</label>
                                <span>{d.ViolationTime ? new Date(d.ViolationTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "-"}</span>
                              </div>
                              <div className="pl-detail-item pl-full">
                                <label>Remarks</label>
                                <p>{d.Remarks || "No remarks provided"}</p>
                              </div>
                            </div>

                            {d.ProofFilePath && (
                              <div className="pl-detail-footer">
                                <a
                                  href={getProofUrl(d.ProofFilePath)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="pl-proof-btn"
                                >
                                  <IonIcon icon={documentTextOutline} />
                                  View Evidence
                                </a>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

      </div>

    </div>

  );
}

export default PenaltyList;