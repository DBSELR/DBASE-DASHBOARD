import React, { useState, useEffect, useCallback } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { API_BASE } from '../../config';
import './AIAttendanceRuleMaster.css';

const API_KEY = 'dbase-ai-master-key-2026';
const hdrs = { 'Content-Type': 'application/json', 'x-api-key': API_KEY };

interface BranchRule {
  id: number;
  branch: string;
  btRequired: boolean;
  gpsRequired: boolean;
}

interface Employee {
  empCode: string;
  empName: string;
  designation: string;
  branch: string;
}

interface Override {
  id: number;
  empId: string;
  empName: string;
  designation: string;
  branch: string;
  liveBranch: string;
  btRequired: boolean;
  gpsRequired: boolean;
  startDate: string;
  endDate: string;
  ruleType: string;
}

const AIAttendanceRuleMaster: React.FC = () => {
  const history = useHistory();
  const [activeTab, setActiveTab] = useState<'branches' | 'overrides'>('branches');
  const [toast, setToast] = useState('');

  // --- Branch tab state ---
  const [branchRules, setBranchRules] = useState<BranchRule[]>([]);
  const [allBranches, setAllBranches] = useState<string[]>([]);
  const [localRules, setLocalRules] = useState<Record<string, { bt: boolean; gps: boolean }>>({});
  const [savingBranch, setSavingBranch] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newBranch, setNewBranch] = useState('');
  const [newBt, setNewBt] = useState(false);
  const [newGps, setNewGps] = useState(true);

  // --- Override tab state ---
  const [ruleType, setRuleType] = useState<'BRANCH' | 'MARKETING'>('BRANCH');
  const [step, setStep] = useState(1);
  const [selBranch, setSelBranch] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [selIds, setSelIds] = useState<string[]>([]);
  const [btOn, setBtOn] = useState(false);
  const [gpsOn, setGpsOn] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [overrides, setOverrides] = useState<Override[]>([]);

  // --- Branch expand state ---
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);
  const [branchEmpCache, setBranchEmpCache] = useState<Record<string, Employee[]>>({});
  const [branchEmpLoading, setBranchEmpLoading] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const loadBranchRules = useCallback(async () => {
    const r = await fetch(API_BASE + 'Checkin/GetBranchRules', { headers: hdrs });
    const d = await r.json();
    if (d.success) {
      setBranchRules(d.data);
      const map: Record<string, { bt: boolean; gps: boolean }> = {};
      d.data.forEach((row: BranchRule) => { map[row.branch] = { bt: row.btRequired, gps: row.gpsRequired }; });
      setLocalRules(map);
    }
  }, []);

  const loadBranches = useCallback(async () => {
    const r = await fetch(API_BASE + 'Checkin/GetBranches', { headers: hdrs });
    const d = await r.json();
    if (d.success) setAllBranches(d.data);
  }, []);

  const loadOverrides = useCallback(async () => {
    const r = await fetch(API_BASE + `Checkin/GetEmployeeOverrides?ruleType=${ruleType}&isActive=1`, { headers: hdrs });
    const d = await r.json();
    if (d.success) setOverrides(d.data);
  }, [ruleType]);

  // Load all employees when MARKETING is selected (no designation filter)
  useEffect(() => {
    if (ruleType === 'MARKETING') {
      setEmpLoading(true);
      fetch(API_BASE + 'Checkin/GetEmployeesByBranch', { headers: hdrs })
        .then(r => r.json())
        .then(d => { if (d.success) setEmployees(d.data); })
        .finally(() => setEmpLoading(false));
    }
  }, [ruleType]);

  useEffect(() => { loadBranchRules(); loadBranches(); }, [loadBranchRules, loadBranches]);
  useEffect(() => { if (activeTab === 'overrides') loadOverrides(); }, [activeTab, loadOverrides]);

  async function saveBranchRule(branch: string) {
    const local = localRules[branch];
    if (!local) return;
    setSavingBranch(branch);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    await fetch(API_BASE + 'Checkin/SaveBranchRule', {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ branch, btRequired: local.bt, gpsRequired: local.gps, createdBy: user.empName || 'admin' })
    });
    setSavingBranch(null);
    showToast('Branch rule saved.');
    loadBranchRules();
  }

  async function saveNewBranch() {
    if (!newBranch) return;
    setSavingBranch(newBranch);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    await fetch(API_BASE + 'Checkin/SaveBranchRule', {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ branch: newBranch, btRequired: newBt, gpsRequired: newGps, createdBy: user.empName || 'admin' })
    });
    setSavingBranch(null);
    setAddingNew(false);
    setNewBranch('');
    showToast('Branch added.');
    loadBranchRules();
  }

  // Load employees filtered by branch (for BRANCH flow)
  async function loadBranchEmployees() {
    setEmpLoading(true);
    let url = API_BASE + 'Checkin/GetEmployeesByBranch?';
    if (selBranch) url += `branch=${encodeURIComponent(selBranch)}&`;
    const r = await fetch(url, { headers: hdrs });
    const d = await r.json();
    if (d.success) setEmployees(d.data);
    setEmpLoading(false);
  }

  async function saveOverrides() {
    if (!selIds.length || !startDate || !endDate) return;
    setSaving(true);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const snapshotBranch = ruleType === 'BRANCH' ? selBranch : 'MARKETING';
    await fetch(API_BASE + 'Checkin/SaveEmployeeOverrides', {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({
        empIds: selIds, branch: snapshotBranch,
        btRequired: btOn, gpsRequired: gpsOn,
        startDate, endDate, ruleType,
        createdBy: user.empName || 'admin'
      })
    });
    setSaving(false);
    showToast(`${selIds.length} override(s) saved.`);
    resetWizard();
    loadOverrides();
  }

  async function deleteOverride(id: number) {
    await fetch(API_BASE + `Checkin/DeleteEmployeeOverride/${id}`, { method: 'DELETE', headers: hdrs });
    showToast('Override removed.');
    loadOverrides();
  }

  function resetWizard() {
    setStep(1); setSelBranch('');
    setEmployees([]); setSelIds([]);
    setBtOn(false); setGpsOn(false);
    setStartDate(''); setEndDate('');
  }

  function toggleEmp(code: string) {
    setSelIds(prev => prev.includes(code) ? prev.filter(x => x !== code) : [...prev, code]);
  }

  async function toggleBranchExpand(branch: string) {
    if (expandedBranch === branch) { setExpandedBranch(null); return; }
    setExpandedBranch(branch);
    if (branchEmpCache[branch]) return;
    setBranchEmpLoading(branch);
    try {
      const r = await fetch(API_BASE + `Checkin/GetEmployeesByBranch?branch=${encodeURIComponent(branch)}`, { headers: hdrs });
      const d = await r.json();
      if (d.success) setBranchEmpCache(prev => ({ ...prev, [branch]: d.data }));
    } catch {}
    setBranchEmpLoading(null);
  }

  const unusedBranches = allBranches.filter(b => !branchRules.some(r => r.branch === b));

  // Step labels per flow
  const branchStepLabels = ['Branch', 'Employees', 'Rules', 'Date Range'];
  const marketingStepLabels = ['Employees', 'Rules', 'Date Range'];
  const stepLabels = ruleType === 'BRANCH' ? branchStepLabels : marketingStepLabels;
  const totalSteps = stepLabels.length;

  // Normalise: which logical step index (0-based) maps to each screen?
  // BRANCH:    step 1→Branch, 2→Employees, 3→Rules, 4→Date
  // MARKETING: step 1→Employees, 2→Rules, 3→Date
  const showBranchSelect    = ruleType === 'BRANCH'    && step === 1;
  const showEmployeePicker  = (ruleType === 'BRANCH' && step === 2) || (ruleType === 'MARKETING' && step === 1);
  const showRules           = (ruleType === 'BRANCH' && step === 3) || (ruleType === 'MARKETING' && step === 2);
  const showDateRange       = (ruleType === 'BRANCH' && step === 4) || (ruleType === 'MARKETING' && step === 3);

  const empPrevStep = ruleType === 'BRANCH' ? 1 : undefined; // undefined → no back
  const empNextStep = ruleType === 'BRANCH' ? 3 : 2;
  const rulesNextStep = ruleType === 'BRANCH' ? 4 : 3;
  const rulesPrevStep = ruleType === 'BRANCH' ? 2 : 1;
  const datePrevStep  = ruleType === 'BRANCH' ? 3 : 2;

  return (
    <IonPage>
      <IonContent className="rm-page">
        <div className="rm-shell">

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="rm-header">
            <button className="rm-back" onClick={() => history.goBack()}>&#8592;</button>
            <div className="rm-title-wrap">
              <h1 className="rm-title">Attendance Rule Master</h1>
              <p className="rm-subtitle">Configure BT &amp; GPS rules per branch / employee</p>
            </div>
          </div>

          {/* ── Tabs ──────────────────────────────────────────────────── */}
          <div className="rm-tabs">
            <button className={`rm-tab${activeTab === 'branches' ? ' rm-tab-active' : ''}`} onClick={() => setActiveTab('branches')}>
              Branch Defaults
            </button>
            <button className={`rm-tab${activeTab === 'overrides' ? ' rm-tab-active' : ''}`} onClick={() => setActiveTab('overrides')}>
              Employee Overrides
            </button>
          </div>

          {/* ── Toast ─────────────────────────────────────────────────── */}
          {toast && <div className="rm-toast">{toast}</div>}

          {/* ── Body ──────────────────────────────────────────────────── */}
          <div className="rm-body">

            {/* ════ BRANCH DEFAULTS TAB ════ */}
            {activeTab === 'branches' && (
              <div className="rm-card">
                <table className="rm-table">
                  <thead>
                    <tr>
                      <th>Branch</th>
                      <th>Bluetooth</th>
                      <th>GPS / Location</th>
                      <th>Face</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchRules.map(rule => (
                      <React.Fragment key={rule.branch}>
                        <tr>
                          <td>
                            <button className="rm-branch-btn" onClick={() => toggleBranchExpand(rule.branch)}>
                              <span className={`rm-branch-arrow${expandedBranch === rule.branch ? ' rm-arrow-open' : ''}`}>&#9654;</span>
                              {rule.branch}
                            </button>
                          </td>
                          <td>
                            <label className="rm-toggle">
                              <input type="checkbox"
                                checked={localRules[rule.branch]?.bt ?? false}
                                onChange={e => setLocalRules(prev => ({
                                  ...prev, [rule.branch]: { ...prev[rule.branch], bt: e.target.checked }
                                }))} />
                              <span className="rm-slider" />
                            </label>
                          </td>
                          <td>
                            <label className="rm-toggle">
                              <input type="checkbox"
                                checked={localRules[rule.branch]?.gps ?? true}
                                onChange={e => setLocalRules(prev => ({
                                  ...prev, [rule.branch]: { ...prev[rule.branch], gps: e.target.checked }
                                }))} />
                              <span className="rm-slider" />
                            </label>
                          </td>
                          <td><span className="rm-always-on">Always ON</span></td>
                          <td>
                            <button className="rm-save-btn" disabled={savingBranch === rule.branch} onClick={() => saveBranchRule(rule.branch)}>
                              {savingBranch === rule.branch ? '…' : '✓'}
                            </button>
                          </td>
                        </tr>
                        {expandedBranch === rule.branch && (
                          <tr className="rm-branch-emp-row">
                            <td colSpan={5} style={{ padding: '4px 8px 12px' }}>
                              {branchEmpLoading === rule.branch ? (
                                <p className="rm-empty">Loading…</p>
                              ) : (branchEmpCache[rule.branch] || []).length === 0 ? (
                                <p className="rm-empty">No employees in this branch.</p>
                              ) : (
                                <div className="rm-branch-emp-list">
                                  {(branchEmpCache[rule.branch] || []).map(emp => (
                                    <div key={emp.empCode} className="rm-branch-emp-item">
                                      <span className="rm-badge-code">{emp.empCode}</span>
                                      <div>
                                        <div className="rm-emp-name">{emp.empName}</div>
                                        <div className="rm-emp-sub">{emp.designation}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}

                    {addingNew && (
                      <tr>
                        <td>
                          <select className="rm-select" value={newBranch} onChange={e => setNewBranch(e.target.value)}>
                            <option value="">-- Select --</option>
                            {unusedBranches.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </td>
                        <td>
                          <label className="rm-toggle">
                            <input type="checkbox" checked={newBt} onChange={e => setNewBt(e.target.checked)} />
                            <span className="rm-slider" />
                          </label>
                        </td>
                        <td>
                          <label className="rm-toggle">
                            <input type="checkbox" checked={newGps} onChange={e => setNewGps(e.target.checked)} />
                            <span className="rm-slider" />
                          </label>
                        </td>
                        <td><span className="rm-always-on">Always ON</span></td>
                        <td style={{ display: 'flex', gap: 4 }}>
                          <button className="rm-save-btn" onClick={saveNewBranch}>✓</button>
                          <button className="rm-del-btn" onClick={() => setAddingNew(false)}>✕</button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {!addingNew && unusedBranches.length > 0 && (
                  <button className="rm-add-btn" onClick={() => setAddingNew(true)}>+ Add Branch</button>
                )}
              </div>
            )}

            {/* ════ EMPLOYEE OVERRIDES TAB ════ */}
            {activeTab === 'overrides' && (
              <div className="rm-override-tab">

                {/* Rule-type chips */}
                <div className="rm-chips">
                  <button className={`rm-chip${ruleType === 'BRANCH' ? ' rm-chip-active' : ''}`}
                    onClick={() => { setRuleType('BRANCH'); resetWizard(); }}>Branch Override</button>
                  <button className={`rm-chip${ruleType === 'MARKETING' ? ' rm-chip-active' : ''}`}
                    onClick={() => { setRuleType('MARKETING'); resetWizard(); }}>Marketing</button>
                </div>

                {/* ── Wizard ───────────────────────────────────────── */}
                <div className="rm-card rm-wizard">

                  {/* Step dots */}
                  <div className="rm-steps">
                    {stepLabels.map((label, i) => (
                      <div key={i} className={`rm-step${step >= i + 1 ? ' rm-step-done' : ''}`}>
                        <div className="rm-step-dot">{i + 1}</div>
                        <span className="rm-step-label">{label}</span>
                      </div>
                    ))}
                  </div>

                  {/* BRANCH Step 1: Select Branch */}
                  {showBranchSelect && (
                    <div className="rm-step-body">
                      <p className="rm-label">Select Branch</p>
                      <select className="rm-select" value={selBranch} onChange={e => setSelBranch(e.target.value)}>
                        <option value="">-- Select --</option>
                        {allBranches.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                      <button className="rm-next-btn"
                        disabled={!selBranch}
                        onClick={() => { loadBranchEmployees(); setStep(2); }}>
                        Next &#8594;
                      </button>
                    </div>
                  )}

                  {/* Employees step (BRANCH step 2 / MARKETING step 1) */}
                  {showEmployeePicker && (
                    <div className="rm-step-body">
                      <p className="rm-label">Select Employees ({selIds.length} selected)</p>
                      {employees.length > 0 && (
                        <div className="rm-select-all-row">
                          <label className="rm-select-all-label">
                            <input
                              type="checkbox"
                              checked={selIds.length === employees.length}
                              onChange={e => setSelIds(e.target.checked ? employees.map(emp => emp.empCode) : [])}
                            />
                            <span>{selIds.length === employees.length ? 'Deselect All' : 'Select All'} ({employees.length})</span>
                          </label>
                        </div>
                      )}
                      <div className="rm-emp-list">
                        {empLoading && <p className="rm-empty">Loading employees…</p>}
                        {!empLoading && employees.map(e => (
                          <label key={e.empCode} className={`rm-emp-item${selIds.includes(e.empCode) ? ' rm-emp-selected' : ''}`}>
                            <input type="checkbox" checked={selIds.includes(e.empCode)} onChange={() => toggleEmp(e.empCode)} />
                            <div>
                              <div className="rm-emp-name">{e.empName}</div>
                              <div className="rm-emp-sub">{e.empCode} &middot; {e.designation} &middot; {e.branch}</div>
                            </div>
                          </label>
                        ))}
                        {!empLoading && employees.length === 0 && <p className="rm-empty">No employees found.</p>}
                      </div>
                      <div className="rm-nav-row">
                        {empPrevStep !== undefined && (
                          <button className="rm-back-btn" onClick={() => setStep(empPrevStep)}>&#8592; Back</button>
                        )}
                        <button className="rm-next-btn" disabled={selIds.length === 0} onClick={() => setStep(empNextStep)}>Next &#8594;</button>
                      </div>
                    </div>
                  )}

                  {/* Rules step (BRANCH step 3 / MARKETING step 2) */}
                  {showRules && (
                    <div className="rm-step-body">
                      <p className="rm-label">Verification Rules</p>
                      <div className="rm-rule-row">
                        <span>Bluetooth Required</span>
                        <label className="rm-toggle">
                          <input type="checkbox" checked={btOn} onChange={e => setBtOn(e.target.checked)} />
                          <span className="rm-slider" />
                        </label>
                      </div>
                      <div className="rm-rule-row">
                        <span>GPS / Location Required</span>
                        <label className="rm-toggle">
                          <input type="checkbox" checked={gpsOn} onChange={e => setGpsOn(e.target.checked)} />
                          <span className="rm-slider" />
                        </label>
                      </div>
                      <div className="rm-rule-row rm-face-row">
                        <span>Face Recognition</span>
                        <span className="rm-always-on">Always ON</span>
                      </div>
                      <div className="rm-nav-row">
                        <button className="rm-back-btn" onClick={() => setStep(rulesPrevStep)}>&#8592; Back</button>
                        <button className="rm-next-btn" onClick={() => setStep(rulesNextStep)}>Next &#8594;</button>
                      </div>
                    </div>
                  )}

                  {/* Date Range step (BRANCH step 4 / MARKETING step 3) */}
                  {showDateRange && (
                    <div className="rm-step-body">
                      <p className="rm-label">Date Range</p>
                      <div className="rm-date-row">
                        <div>
                          <label className="rm-date-label">From</label>
                          <input type="date" className="rm-date-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div>
                          <label className="rm-date-label">To</label>
                          <input type="date" className="rm-date-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                      </div>
                      <div className="rm-nav-row">
                        <button className="rm-back-btn" onClick={() => setStep(datePrevStep)}>&#8592; Back</button>
                        <button className="rm-next-btn rm-save-main"
                          disabled={!startDate || !endDate || saving}
                          onClick={saveOverrides}>
                          {saving ? 'Saving…' : `Save for ${selIds.length} employee(s)`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Active Overrides Table ───────────────────────── */}
                <div className="rm-card rm-overrides-list">
                  <div className="rm-list-header">
                    <h3>Active Overrides</h3>
                  </div>
                  <table className="rm-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Branch</th>
                        <th>BT</th>
                        <th>GPS</th>
                        <th>From</th>
                        <th>To</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {overrides.map(o => (
                        <tr key={o.id}>
                          <td>
                            <div className="rm-emp-name">{o.empName || o.empId}</div>
                            <div className="rm-emp-sub">{o.designation}</div>
                          </td>
                          <td>{o.liveBranch || o.branch}</td>
                          <td><span className={o.btRequired ? 'rm-badge-on' : 'rm-badge-off'}>{o.btRequired ? 'ON' : 'OFF'}</span></td>
                          <td><span className={o.gpsRequired ? 'rm-badge-on' : 'rm-badge-off'}>{o.gpsRequired ? 'ON' : 'OFF'}</span></td>
                          <td>{o.startDate}</td>
                          <td>{o.endDate}</td>
                          <td>
                            <button className="rm-del-btn" onClick={() => deleteOverride(o.id)}>&#x2715;</button>
                          </td>
                        </tr>
                      ))}
                      {overrides.length === 0 && (
                        <tr><td colSpan={7} className="rm-empty">No active overrides.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            )}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AIAttendanceRuleMaster;
