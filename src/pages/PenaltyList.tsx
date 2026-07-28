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
  chevronDownOutline,
  chevronForwardOutline,
  documentTextOutline,
  searchOutline,
  warningOutline
} from "ionicons/icons";
import { ChevronLeft } from "lucide-react";

import "./WorkReports.css";
import "./RequestsPage.css";
import "./Stock.css";

function PenaltyList() {
  const history = useHistory();
  const [employees, setEmployees] = useState<any[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<any[]>([]);
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
  const [details, setDetails] = useState<any>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    const filtered = employees.filter((e) =>
      e.EMPNAME?.toLowerCase().includes(search.toLowerCase()) ||
      e.EMPCODE?.toLowerCase().includes(search.toLowerCase())
    );
    setFilteredEmployees(filtered);
  }, [search, employees]);

  const loadSummary = async () => {
    try {
      const res = await axios.get(`${API_BASE}Penalty/GetEmployeeSlipSummary`);
      setEmployees(res.data || []);
      setFilteredEmployees(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleEmployee = async (empCode: string) => {
    try {
      if (expandedEmp === empCode) {
        setExpandedEmp(null);
        return;
      }

      if (!details[empCode]) {
        const res = await axios.get(`${API_BASE}Penalty/GetEmployeePenaltyDetails/${empCode}`);
        setDetails((prev: any) => ({
          ...prev,
          [empCode]: res.data || []
        }));
      }

      setExpandedEmp(empCode);
    } catch (err) {
      console.error(err);
    }
  };

  const getProofUrl = (path: string) => {
    if (!path) return "";
    return `${API_BASE.replace("api/", "")}${path}`;
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
                <h1 className="page-wr-title">Penalty List</h1>
                <p className="page-wr-subtitle">Employee penalty records</p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <div className="page-wr-header-icon-box">
                <IonIcon icon={documentTextOutline} style={{ color: 'var(--ion-color-primary)', fontSize: '24px' }} />
              </div>
            </div>
          </div>

          {/* ── Search Bar ── */}
          <div style={{ margin: '0 16px 16px 16px' }}>
            <div className="wr-input-wrapper" style={{ background: 'var(--stock-panel-bg)', display: 'flex', alignItems: 'center' }}>
              <IonIcon icon={searchOutline} className="ntv-form-input-icon" style={{ fontSize: '20px', marginLeft: '4px' }} />
              <input
                type="text"
                placeholder="Search by name or code..."
                style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '14px', color: 'var(--stock-text)', fontWeight: '600', padding: '12px 0' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* ── List ── */}
          <div style={{ margin: '0 16px 20px 16px' }}>
            {filteredEmployees.length === 0 ? (
              <div className="stock-panel" style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <IonIcon icon={warningOutline} style={{ fontSize: '48px', color: 'var(--stock-muted)', marginBottom: '12px' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--stock-text)' }}>No penalties found</h3>
              </div>
            ) : (
              filteredEmployees.map((emp) => {
                const isExpanded = expandedEmp === emp.EMPCODE;
                return (
                  <div 
                    key={emp.EMPCODE} 
                    className="stock-panel" 
                    style={{ 
                      marginBottom: '12px', 
                      padding: '14px 16px', 
                      transition: 'all 0.3s ease', 
                      cursor: 'pointer', 
                      border: isExpanded ? '1px solid var(--ion-color-primary)' : '1px solid var(--stock-border)' 
                    }} 
                    onClick={() => toggleEmployee(emp.EMPCODE)}
                  >
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      
                      {/* Avatar and Name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-secondary))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', flexShrink: 0 }}>
                          {emp.EMPNAME?.charAt(0) || "E"}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                          <span style={{ fontWeight: '800', fontSize: '15px', color: 'var(--stock-accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.EMPNAME}</span>
                          <span style={{ fontSize: '12px', color: 'var(--stock-muted)', fontWeight: '600' }}>{emp.EMPCODE}</span>
                        </div>
                      </div>

                      {/* Stats and Expand */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '800', background: 'var(--ion-color-warning, #f59e0b)', color: 'white', padding: '2px 6px', borderRadius: '6px' }}>{emp.YellowSlips || 0} Y</span>
                            <span style={{ fontSize: '11px', fontWeight: '800', background: 'var(--ion-color-danger, #ef4444)', color: 'white', padding: '2px 6px', borderRadius: '6px' }}>{emp.RedSlips || 0} R</span>
                          </div>
                          <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', background: emp.EscalationStatus === "Normal" ? 'var(--ion-color-success, #10b981)' : emp.EscalationStatus === "HR Warning" ? 'var(--ion-color-warning, #f59e0b)' : 'var(--ion-color-danger, #ef4444)', color: 'white' }}>
                            {emp.EscalationStatus}
                          </span>
                        </div>
                        <IonIcon icon={isExpanded ? chevronDownOutline : chevronForwardOutline} style={{ color: 'var(--stock-muted)', fontSize: '20px' }} />
                      </div>

                    </div>

                    {/* Details section */}
                    {isExpanded && (
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--stock-border)' }} onClick={(e) => e.stopPropagation()}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', color: 'var(--stock-text)' }}>Penalty History</h4>
                        
                        {!details[emp.EMPCODE] || details[emp.EMPCODE].length === 0 ? (
                          <div style={{ fontSize: '13px', color: 'var(--stock-muted)', fontStyle: 'italic' }}>Loading details...</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {details[emp.EMPCODE].map((d: any) => (
                              <div key={d.Id} style={{ background: 'var(--stock-surface)', borderRadius: '12px', padding: '12px', border: '1px solid var(--stock-border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--stock-muted)' }}>
                                    {new Date(d.PenaltyDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </span>
                                  <span style={{ fontSize: '11px', fontWeight: '800', padding: '4px 8px', borderRadius: '8px', color: d.Status?.toLowerCase() === 'approved' ? 'var(--ion-color-success, #10b981)' : 'var(--stock-text)', background: 'var(--stock-panel-bg)', border: '1px solid var(--stock-border)' }}>
                                    {d.Status}
                                  </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--stock-muted)', fontWeight: '700' }}>Type</span>
                                    <span style={{ fontSize: '13px', color: 'var(--stock-text)', fontWeight: '800' }}>
                                      {d.SlipType} 
                                      <span style={{ fontSize: '11px', color: 'var(--ion-color-primary)', background: 'color-mix(in srgb, var(--ion-color-primary) 15%, transparent)', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>x{d.SlipCount}</span>
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--stock-muted)', fontWeight: '700' }}>Time</span>
                                    <span style={{ fontSize: '13px', color: 'var(--stock-text)', fontWeight: '800' }}>{d.ViolationTime ? new Date(d.ViolationTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "-"}</span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', marginBottom: d.ProofFilePath ? '12px' : '0' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--stock-muted)', fontWeight: '700' }}>Remarks</span>
                                  <span style={{ fontSize: '13px', color: 'var(--stock-text)', fontWeight: '600' }}>{d.Remarks || "No remarks provided"}</span>
                                </div>
                                {d.ProofFilePath && (
                                  <a
                                    href={getProofUrl(d.ProofFilePath)}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '800', color: 'var(--stock-primary)', textDecoration: 'none', background: 'color-mix(in srgb, var(--stock-primary) 10%, transparent)', padding: '8px 12px', borderRadius: '8px', border: '1px solid color-mix(in srgb, var(--stock-primary) 20%, transparent)' }}
                                  >
                                    <IonIcon icon={documentTextOutline} style={{ fontSize: '16px' }} /> View Evidence
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}

export default PenaltyList;