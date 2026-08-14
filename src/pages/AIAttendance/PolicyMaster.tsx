import React, { useState, useEffect, useCallback } from 'react';
import { IonPage, IonContent, IonIcon } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import {
  informationCircleOutline,
  saveOutline,
  refreshOutline,
  checkmarkCircleOutline,
  warningOutline,
  timeOutline,
  shieldCheckmarkOutline,
  restaurantOutline,
  moonOutline,
  briefcaseOutline,
  alertCircleOutline,
  closeOutline,
  documentTextOutline
} from 'ionicons/icons';
import { API_BASE } from '../../config';
import './PolicyMaster.css';

interface PolicyItem {
  policyId: number;
  policyKey: string;
  policyValue: string;
  category: string;
  displayName: string;
  description: string;
  valueType: 'number' | 'time' | 'boolean' | 'string';
  unit: string;
  isActive: boolean;
}

interface EmployeeOption {
  empCode: string;
  empName: string;
  department: string;
  inTime: string;
  pTime: string;
}

interface EmployeeAudit {
  freeGracesUsed: number;
  freeGracesMax: number;
  gracesLeft: number;
  permissionGraceUsed: number;
  permissionSessionsMax: number;
  permissionSessionsLeft: number;
  totalLateOccasionsUsed: number;
  totalLateOccasionsMax: number;
  totalLateOccasionsLeft: number;
  pTime: number;
  approvedOvertime: number;
  totalPermission: number;
  usedPermission: number;
  permissionBalance: number;
  history: Array<{
    date: string;
    lateMinutes: number;
    lunchLateMinutes: number;
    graceType: string;
    attendanceStatus: string;
  }>;
}

const PolicyMaster: React.FC = () => {
  const history = useHistory();

  // Policy Items state
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Info Modal state
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Employee Simulator State
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<string>('1596');
  const [auditData, setAuditData] = useState<EmployeeAudit | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Fetch Policy Master from Backend
  const loadPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}Checkin/GetAttendancePolicyMaster`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPolicies(data.data);
        setIsDirty(false);
      }
    } catch (err) {
      console.error('[PolicyMaster] loadPolicies error:', err);
      showToast('Error loading attendance policies.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch Employee List for Simulator
  const loadEmployees = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}Checkin/GetEmployeesByBranch`, {
        headers: { 'x-api-key': 'dbase-ai-master-key-2026' }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setEmployees(data.data);
      }
    } catch (err) {
      console.error('[PolicyMaster] loadEmployees error:', err);
    }
  }, []);

  // 3. Fetch Employee Month-to-date Audit Metrics
  const loadEmployeeAudit = useCallback(async (empCode: string) => {
    if (!empCode) return;
    setAuditLoading(true);
    try {
      const res = await fetch(`${API_BASE}Checkin/GetEmployeeGraceSummary?empId=${encodeURIComponent(empCode)}`);
      const data = await res.json();
      if (data.success) {
        setAuditData(data);
      }
    } catch (err) {
      console.error('[PolicyMaster] loadEmployeeAudit error:', err);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPolicies();
    loadEmployees();
  }, [loadPolicies, loadEmployees]);

  useEffect(() => {
    if (selectedEmp) {
      loadEmployeeAudit(selectedEmp);
    }
  }, [selectedEmp, loadEmployeeAudit]);

  // Handle Input Changes
  const handleValueChange = (key: string, newValue: string) => {
    setPolicies(prev =>
      prev.map(p => (p.policyKey === key ? { ...p, policyValue: newValue } : p))
    );
    setIsDirty(true);
  };

  const handleToggleChange = (key: string, currentVal: string) => {
    const nextVal = currentVal === '1' || currentVal === 'true' ? '0' : '1';
    handleValueChange(key, nextVal);
  };

  // Save Policies to Backend (Auto-updates Master Table AND all related employee records)
  const handleSavePolicies = async () => {
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const payload = {
        policies: policies.map(p => ({
          policyId: p.policyId,
          policyKey: p.policyKey,
          policyValue: p.policyValue,
          isActive: p.isActive
        })),
        updatedBy: user.empName || user.userName || 'Admin',
        syncToEmployees: true
      };

      const res = await fetch(`${API_BASE}Checkin/SaveAttendancePolicyMaster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Policy Master saved & all employee profiles updated automatically.');
        setIsDirty(false);
        await loadPolicies();
        await loadEmployees();
        if (selectedEmp) {
          await loadEmployeeAudit(selectedEmp);
        }
      } else {
        showToast(`❌ Failed to save policies: ${data.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('[PolicyMaster] savePolicies error:', err);
      showToast('❌ Error saving attendance policies.');
    } finally {
      setSaving(false);
    }
  };

  // Helper to get policy value
  const getVal = (key: string, fallback: string = '') => {
    const item = policies.find(p => p.policyKey === key);
    return item ? item.policyValue : fallback;
  };

  // Category Groups
  const categories = [
    {
      id: 'MorningGrace',
      title: '🌅 Morning In & Free Grace Rules',
      badge: 'Morning Attendance',
      icon: shieldCheckmarkOutline,
      desc: 'Rules governing profile in-time, 4 free graces, permission sessions, and the 10-occasion late cap.'
    },
    {
      id: 'Lunch',
      title: '🍱 Lunch Break & Afternoon Rules',
      badge: 'Lunch Rules',
      icon: restaurantOutline,
      desc: 'Standard lunch timing (1:30 PM - 2:30 PM) & auto 1-hour duration from actual Lunch Out.'
    },
    {
      id: 'Evening',
      title: '🌆 Evening Out & Shift Defaults',
      badge: 'Checkout Rules',
      icon: moonOutline,
      desc: 'Standard evening checkout threshold time.'
    },
    {
      id: 'PermissionQuotas',
      title: '⏱️ Role-Wise Permission Allotments (P_Time)',
      badge: 'P_Time Master',
      icon: briefcaseOutline,
      desc: 'Monthly permission quotas by category and max single session duration.'
    },
    {
      id: 'PenaltyLOP',
      title: '⚠️ Excess Permission & LOP Penalty Matrix',
      badge: 'Loss of Pay (LOP)',
      icon: alertCircleOutline,
      desc: 'Thresholds for excess permissions, single LOP (1x), and Double LOP (2x).'
    },
    {
      id: 'Slips',
      title: '🟨 Yellow Slip & Disciplinary Triggers',
      badge: 'Compliance & Slips',
      icon: documentTextOutline,
      desc: 'Automatic Yellow Slip triggers for late occasions and excess permissions.'
    }
  ];

  return (
    <IonPage>
      <IonContent className="pm-page">
        <div className="pm-container">

          {/* ── 1. Top Header Card ────────────────────────────── */}
          <div className="pm-header-card">
            <div className="pm-header-left">
              <button className="pm-back-btn" onClick={() => history.goBack()} title="Go Back">
                &#8592;
              </button>
              <div>
                <span className="pm-header-badge">⚡ Global Rule Master</span>
                <h1 className="pm-title">Face Attendance Policy Master</h1>
                <p className="pm-subtitle">
                  Configure and dynamically control all Face Attendance, Free Grace, Permission, LOP &amp; Yellow Slip Rules
                </p>
              </div>
            </div>

            <div className="pm-header-actions">
              <button
                className="pm-btn-info"
                onClick={() => setShowInfoModal(true)}
                title="View Complete Rules Explanation"
              >
                <IonIcon icon={informationCircleOutline} style={{ fontSize: '18px' }} />
                Rules &amp; Policy Guide
              </button>

              <button
                className="pm-btn-reset"
                onClick={loadPolicies}
                disabled={loading}
                title="Reload Current Settings"
              >
                <IonIcon icon={refreshOutline} style={{ fontSize: '16px' }} />
                Reload
              </button>

              <button
                className="pm-btn-save"
                onClick={handleSavePolicies}
                disabled={saving || loading || !isDirty}
                title="Save All Policy Changes (Auto-updates Master Table & all employee profiles)"
              >
                <IonIcon icon={saveOutline} style={{ fontSize: '18px' }} />
                {saving ? 'Saving...' : isDirty ? 'Save Policy Changes *' : 'Policies Saved'}
              </button>
            </div>
          </div>

          {/* ── 2. Top Highlights Summary Bar ─────────────────── */}
          <div className="pm-summary-bar">
            <div className="pm-stat-card">
              <div className="pm-stat-icon blue">
                <IonIcon icon={shieldCheckmarkOutline} />
              </div>
              <div>
                <div className="pm-stat-value">
                  {getVal('FreeGraceMonthlyCount', '4')} Graces
                </div>
                <div className="pm-stat-label">
                  Max {getVal('FreeGraceMaxMinutes', '15')} min / grace
                </div>
              </div>
            </div>

            <div className="pm-stat-card">
              <div className="pm-stat-icon green">
                <IonIcon icon={timeOutline} />
              </div>
              <div>
                <div className="pm-stat-value">
                  {getVal('MaxPermissionSessionsPerMonth', '6')} Sessions
                </div>
                <div className="pm-stat-label">From Allotted P_Time</div>
              </div>
            </div>

            <div className="pm-stat-card">
              <div className="pm-stat-icon purple">
                <IonIcon icon={warningOutline} />
              </div>
              <div>
                <div className="pm-stat-value">
                  {getVal('TotalAllowedLateOccasions', '10')} Occasions
                </div>
                <div className="pm-stat-label">Total Monthly Late Cap</div>
              </div>
            </div>

            <div className="pm-stat-card">
              <div className="pm-stat-icon amber">
                <IonIcon icon={restaurantOutline} />
              </div>
              <div>
                <div className="pm-stat-value">
                  {getVal('LunchBreakDurationMinutes', '60')} Min Break
                </div>
                <div className="pm-stat-label">Auto from Lunch Out</div>
              </div>
            </div>

            <div className="pm-stat-card">
              <div className="pm-stat-icon red">
                <IonIcon icon={documentTextOutline} />
              </div>
              <div>
                <div className="pm-stat-value">Yellow Slips</div>
                <div className="pm-stat-label">&gt; 10 Occasions / 3 Excess</div>
              </div>
            </div>
          </div>

          {/* ── 3. Category Policy Grid ───────────────────────── */}
          <div className="pm-section-head">
            <div>
              <h2 className="pm-section-title">
                <IonIcon icon={timeOutline} style={{ color: '#0284c7' }} />
                Policy Configuration Matrix
              </h2>
              <p className="pm-section-sub">
                Modify parameters below. Changes immediately govern all face attendance check-ins and late calculations.
              </p>
            </div>
          </div>

          <div className="pm-grid">
            {categories.map(cat => {
              const catPolicies = policies.filter(p => p.category === cat.id);
              if (!catPolicies.length) return null;

              return (
                <div key={cat.id} className="pm-category-card">
                  <div className="pm-card-head">
                    <div className="pm-card-head-title">
                      <IonIcon icon={cat.icon} style={{ fontSize: '18px', color: '#0284c7' }} />
                      <span>{cat.title}</span>
                    </div>
                    <span className="pm-card-badge">{cat.badge}</span>
                  </div>

                  <div className="pm-card-body">
                    {catPolicies.map(item => {
                      if (item.valueType === 'boolean') {
                        const isChecked = item.policyValue === '1' || item.policyValue === 'true';
                        return (
                          <div key={item.policyKey} className="pm-toggle-container">
                            <div className="pm-toggle-info">
                              <span className="pm-field-label">{item.displayName}</span>
                              <span className="pm-field-desc">{item.description}</span>
                            </div>
                            <label className="pm-switch">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleChange(item.policyKey, item.policyValue)}
                              />
                              <span className="pm-slider"></span>
                            </label>
                          </div>
                        );
                      }

                      return (
                        <div key={item.policyKey} className="pm-field-row">
                          <div className="pm-field-header">
                            <span className="pm-field-label">{item.displayName}</span>
                          </div>
                          <span className="pm-field-desc">{item.description}</span>
                          <div className="pm-input-wrapper">
                            <input
                              className="pm-input"
                              type={item.valueType === 'number' ? 'number' : item.valueType === 'time' ? 'text' : 'text'}
                              value={item.policyValue}
                              onChange={e => handleValueChange(item.policyKey, e.target.value)}
                            />
                            {item.unit && <span className="pm-input-unit">{item.unit}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── 4. Live Employee Policy Simulator & Audit Tool ── */}
          <div className="pm-audit-card">
            <div className="pm-audit-header">
              <div className="pm-audit-title-wrap">
                <h3>👥 Live Employee Policy Simulator &amp; Month-To-Date Audit</h3>
                <p>
                  Inspect any employee&apos;s live monthly tally against the active policy thresholds.
                </p>
              </div>

              <div className="pm-audit-filters">
                <select
                  className="pm-emp-select"
                  value={selectedEmp}
                  onChange={e => setSelectedEmp(e.target.value)}
                >
                  {employees.map(emp => (
                    <option key={emp.empCode} value={emp.empCode}>
                      {emp.empCode} - {emp.empName} ({emp.department || 'N/A'}) [InTime: {emp.inTime || '09:30'}, P_Time: {emp.pTime || '60'}m]
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {auditLoading ? (
              <p style={{ textAlign: 'center', color: '#64748b', padding: '30px' }}>Loading employee metrics...</p>
            ) : auditData ? (
              <div>
                <div className="pm-meters-grid">
                  {/* Meter 1: Free Graces */}
                  <div className="pm-meter-card">
                    <div className="pm-meter-head">
                      <span className="pm-meter-title">🟢 Free Graces</span>
                      <span className="pm-meter-tally">
                        {auditData.freeGracesUsed} / {auditData.freeGracesMax || 4}
                      </span>
                    </div>
                    <div className="pm-progress-bar">
                      <div
                        className={`pm-progress-fill ${auditData.freeGracesUsed >= 4 ? 'amber' : 'green'}`}
                        style={{ width: `${Math.min(100, (auditData.freeGracesUsed / (auditData.freeGracesMax || 4)) * 100)}%` }}
                      ></div>
                    </div>
                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                      {auditData.gracesLeft} free graces remaining this month
                    </span>
                  </div>

                  {/* Meter 2: Permission Sessions */}
                  <div className="pm-meter-card">
                    <div className="pm-meter-head">
                      <span className="pm-meter-title">🟡 Permission Sessions</span>
                      <span className="pm-meter-tally">
                        {auditData.permissionGraceUsed} / {auditData.permissionSessionsMax || 6}
                      </span>
                    </div>
                    <div className="pm-progress-bar">
                      <div
                        className={`pm-progress-fill ${auditData.permissionGraceUsed >= 6 ? 'red' : 'amber'}`}
                        style={{ width: `${Math.min(100, (auditData.permissionGraceUsed / (auditData.permissionSessionsMax || 6)) * 100)}%` }}
                      ></div>
                    </div>
                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                      {auditData.permissionSessionsLeft} permission sessions remaining
                    </span>
                  </div>

                  {/* Meter 3: Total Late Occasions */}
                  <div className="pm-meter-card">
                    <div className="pm-meter-head">
                      <span className="pm-meter-title">🔴 Total Late Occasions</span>
                      <span className="pm-meter-tally">
                        {auditData.totalLateOccasionsUsed} / {auditData.totalLateOccasionsMax || 10}
                      </span>
                    </div>
                    <div className="pm-progress-bar">
                      <div
                        className={`pm-progress-fill ${auditData.totalLateOccasionsUsed >= 10 ? 'red' : 'blue'}`}
                        style={{ width: `${Math.min(100, (auditData.totalLateOccasionsUsed / (auditData.totalLateOccasionsMax || 10)) * 100)}%` }}
                      ></div>
                    </div>
                    <span style={{ fontSize: '11.5px', color: auditData.totalLateOccasionsUsed >= 10 ? '#dc2626' : '#64748b', fontWeight: auditData.totalLateOccasionsUsed >= 10 ? 700 : 500 }}>
                      {auditData.totalLateOccasionsUsed >= 10 ? '⚠️ Exceeded 10 Occasions Cap (LOP Active)' : `${auditData.totalLateOccasionsLeft} late occasions left`}
                    </span>
                  </div>

                  {/* Meter 4: P_Time Balance */}
                  <div className="pm-meter-card">
                    <div className="pm-meter-head">
                      <span className="pm-meter-title">⏱️ P_Time Balance</span>
                      <span className="pm-meter-tally">
                        {auditData.permissionBalance} min
                      </span>
                    </div>
                    <div className="pm-progress-bar">
                      <div
                        className="pm-progress-fill blue"
                        style={{ width: `${Math.min(100, (auditData.usedPermission / (auditData.totalPermission || 1)) * 100)}%` }}
                      ></div>
                    </div>
                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                      Allotted: {auditData.totalPermission}m | Used: {auditData.usedPermission}m
                    </span>
                  </div>
                </div>

                {/* History Table */}
                {auditData.history && auditData.history.length > 0 && (
                  <div style={{ marginTop: '16px', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                          <th style={{ padding: '10px 14px', borderRadius: '8px 0 0 8px' }}>Date</th>
                          <th style={{ padding: '10px 14px' }}>Morning Late</th>
                          <th style={{ padding: '10px 14px' }}>Lunch Late</th>
                          <th style={{ padding: '10px 14px' }}>Grace Type</th>
                          <th style={{ padding: '10px 14px', borderRadius: '0 8px 8px 0' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditData.history.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600 }}>{row.date}</td>
                            <td style={{ padding: '10px 14px' }}>{row.lateMinutes ? `${row.lateMinutes} min` : '-'}</td>
                            <td style={{ padding: '10px 14px' }}>{row.lunchLateMinutes ? `${row.lunchLateMinutes} min` : '-'}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span className={`pm-badge-highlight ${row.graceType === 'FREE_GRACE' ? 'pm-badge-green' : row.graceType === 'PERMISSION' ? 'pm-badge-amber' : row.graceType === 'LOP' ? 'pm-badge-red' : 'pm-badge-blue'}`}>
                                {row.graceType || 'PRESENT'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', color: '#64748b' }}>{row.attendanceStatus}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* ── 5. Detailed Info & Policy Explanation Modal ─── */}
          {showInfoModal && (
            <div className="pm-modal-overlay" onClick={() => setShowInfoModal(false)}>
              <div className="pm-modal-box" onClick={e => e.stopPropagation()}>
                <div className="pm-modal-header">
                  <h2>
                    <IonIcon icon={informationCircleOutline} />
                    Face Attendance Policy &amp; Rules Explanation Guide
                  </h2>
                  <button className="pm-modal-close" onClick={() => setShowInfoModal(false)}>
                    <IonIcon icon={closeOutline} />
                  </button>
                </div>

                <div className="pm-modal-content">
                  {/* Section 1 */}
                  <div className="pm-doc-section">
                    <h4>🌅 1. Morning In &amp; Monthly Free Grace Rules</h4>
                    <ul>
                      <li>
                        <strong>Dynamic In-Time:</strong> Each employee&apos;s reporting time is read directly from their profile in <code>tbl_employee.InTime</code> (e.g. 09:00, 09:30, 10:00).
                      </li>
                      <li>
                        <strong>{getVal('FreeGraceMonthlyCount', '4')} Free Graces:</strong> Every employee gets <strong>{getVal('FreeGraceMonthlyCount', '4')} free graces</strong> per calendar month for late arrival up to <strong>{getVal('FreeGraceMaxMinutes', '15')} minutes</strong> each.
                      </li>
                      <li>
                        <strong>{getVal('MaxPermissionSessionsPerMonth', '6')} Permission Sessions:</strong> When free graces are exhausted OR arrival is &gt; {getVal('FreeGraceMaxMinutes', '15')} minutes late, time is deducted from the employee&apos;s allotted <code>P_Time</code>, up to a maximum of <strong>{getVal('MaxPermissionSessionsPerMonth', '6')} permission sessions</strong> per month.
                      </li>
                      <li>
                        <strong>{getVal('TotalAllowedLateOccasions', '10')} Occasions Cap:</strong> Total late occasions per month are strictly capped at <strong>{getVal('TotalAllowedLateOccasions', '10')} occasions</strong> ({getVal('FreeGraceMonthlyCount', '4')} free graces + {getVal('MaxPermissionSessionsPerMonth', '6')} permission sessions). Beyond {getVal('MaxPermissionSessionsPerMonth', '6')} sessions, permission adjustment is blocked even if balance remains.
                      </li>
                    </ul>
                  </div>

                  {/* Section 2 */}
                  <div className="pm-doc-section">
                    <h4>🍱 2. Lunch Break &amp; Afternoon Rules</h4>
                    <ul>
                      <li>
                        <strong>Official Lunch Window:</strong> {getVal('StandardLunchStartTime', '13:30:00')} to {getVal('StandardLunchEndTime', '14:30:00')}.
                      </li>
                      <li>
                        <strong>Auto {getVal('LunchBreakDurationMinutes', '60')}-Minute Duration:</strong> If an employee punches Lunch Out at 2:00 PM, 3:00 PM, or 4:00 PM, the system automatically allocates exactly <strong>{getVal('LunchBreakDurationMinutes', '60')} minutes</strong> break from their actual Lunch Out time.
                      </li>
                      <li>
                        <strong>No Afternoon Grace:</strong> Free grace applies ONLY to Morning In. Lunch late check-ins auto-deduct from Permission balance or convert to Loss of Pay (LOP).
                      </li>
                    </ul>
                  </div>

                  {/* Section 3 */}
                  <div className="pm-doc-section">
                    <h4>🌆 3. Evening Out &amp; Shift Defaults</h4>
                    <ul>
                      <li>
                        <strong>Standard Evening Out Time:</strong> <strong>{getVal('StandardEveningOutTime', '18:33:00')}</strong> standard checkout threshold.
                      </li>
                    </ul>
                  </div>

                  {/* Section 4 */}
                  <div className="pm-doc-section">
                    <h4>⏱️ 4. Monthly Permission Quotas &amp; Role Defaults (P_Time)</h4>
                    <ul>
                      <li>
                        <strong>Technical Staff:</strong> <strong>{getVal('TechnicalDefaultPermissionMinutes', '60')} minutes / month</strong> without LOP.
                      </li>
                      <li>
                        <strong>Non-Technical Staff:</strong> <strong>{getVal('NonTechnicalDefaultPermissionMinutes', '90')} minutes / month</strong> without LOP.
                      </li>
                      <li>
                        <strong>Marketing Executives:</strong> <strong>{getVal('MarketingDefaultPermissionMinutes', '240')} minutes / month</strong> without LOP.
                      </li>
                      <li>
                        <strong>Maximum Single Session:</strong> <strong>{getVal('MaxSinglePermissionMinutes', '60')} minutes</strong> per permission.
                      </li>
                    </ul>
                  </div>

                  {/* Section 5 */}
                  <div className="pm-doc-section">
                    <h4>⚠️ 5. Excess Permission, LOP &amp; Double LOP Penalty Matrix</h4>
                    <ul>
                      <li>
                        <strong>Approved Excess Usage (Up to {getVal('ApprovedExcessPermissionMinutes', '180')} min):</strong> Allowed beyond allotted P_Time subject to available permission balance (procured via overtime or carryover).
                      </li>
                      <li>
                        <strong>Excess Usage Up to {getVal('SingleLopExcessMinutes', '120')} min Without Balance:</strong> Attracts <strong>Single Loss of Pay (1x LOP)</strong>.
                      </li>
                      <li>
                        <strong>Excess Usage &gt; {getVal('DoubleLopExcessMinutes', '120')} min Without Balance:</strong> Attracts <strong>Double Loss of Pay (Double LOP / 2x LOP)</strong>. For Double LOP, the allotted permission time is also included in the total deduction.
                      </li>
                      <li>
                        <strong>Surplus Carry Forward &amp; Encashment:</strong> Unused permission time carries forward monthly and can be encashed at year end subject to management approval.
                      </li>
                      <li>
                        <strong>Past LOP Finality:</strong> Permission time procured after LOP calculation or slip issuance cannot reverse past LOPs or cancel issued slips.
                      </li>
                    </ul>
                  </div>

                  {/* Section 6 */}
                  <div className="pm-doc-section">
                    <h4>🟨 6. Yellow Slip Issuance Triggers</h4>
                    <ul>
                      <li>
                        <strong>Exceeding {getVal('TotalAllowedLateOccasions', '10')} Late Occasions:</strong> Exceeding {getVal('TotalAllowedLateOccasions', '10')} late occasions in a month automatically triggers <strong>+1 Yellow Slip</strong>, and the full late time including the 60 min grace is treated as LOP.
                      </li>
                      <li>
                        <strong>Excess Permission Penalty:</strong> <strong>+1 Yellow Slip</strong> is issued for every <strong>{getVal('YellowSlipExcessFrequency', '3')} excess permission sessions</strong> without available balance.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Toast Notification ────────────────────────────── */}
          {toastMessage && (
            <div className="pm-toast">
              <IonIcon icon={checkmarkCircleOutline} style={{ color: '#38bdf8', fontSize: '20px' }} />
              <span>{toastMessage}</span>
            </div>
          )}

        </div>
      </IonContent>
    </IonPage>
  );
};

export default PolicyMaster;
