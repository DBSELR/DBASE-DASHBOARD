import React, { useState, useEffect, useCallback } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonContent,
  IonLoading,
  IonToast,
  IonIcon,
  IonSelect,
  IonSelectOption,
  IonDatetime,
} from '@ionic/react';
import {
  calendarOutline,
  peopleOutline,
  cashOutline,
  checkmarkCircleOutline,
  refreshOutline,
  saveOutline,
  chevronForwardOutline,
  chevronDownOutline,
  checkmarkOutline
} from 'ionicons/icons';
import axios from 'axios';
import moment from 'moment';
import { API_BASE } from '../config';
import './Salaries.css';

// --- Custom Components (Pure CSS/Div) ---

interface CheckboxProps {
  checked: boolean;
  onChange: (val: boolean) => void;
}

const CustomCheckbox: React.FC<CheckboxProps> = ({ checked, onChange }) => (
  <div
    className={`sc-checkbox ${checked ? 'checked' : ''}`}
    onClick={(e) => {
      e.stopPropagation();
      onChange(!checked);
    }}
  >
    <IonIcon icon={checkmarkOutline} className="sc-checkbox-tick" />
  </div>
);

// --- Interfaces ---

interface Employee {
  EmpCode: string;
  EmpName: string;
  isSelected: boolean;
}

interface Holiday {
  ID: number;
  HolidayDate: string;
  Remark: string;
  Year: string;
  isSelected: boolean;
}

interface Adjustment {
  Ecode: string;
  Ename: string;
  SalMY: string;
  AddDays: string;
  Remark: string;
  AdvDed: string;
}

const Salaries: React.FC = () => {
  // State for tab navigation
  const [activeTab, setActiveTab] = useState<'assign' | 'generate'>('generate');

  // State for year and month selection
  const [hYear, setHYear] = useState<string>(moment().format('YYYY'));
  const [hMonth, setHMonth] = useState<string>(moment().format('M'));
  const [salMY, setSalMY] = useState<string>(moment().format('MMM-YYYY'));

  const years = Array.from({ length: 10 }, (_, i) => (moment().year() + 1 - i).toString());
  const monthsList = moment.months().map((m, i) => ({ name: m, value: (i + 1).toString() }));

  const generateMonthList = () => {
    const months: string[] = [];
    const startYear = 2014;
    const current = moment().add(1, 'month');
    const currentYear = current.year();

    for (let y = currentYear; y >= startYear; y--) {
      const endMonth = y === currentYear ? current.month() : 11;
      for (let m = endMonth; m >= 0; m--) {
        months.push(moment().year(y).month(m).format("MMM-YYYY"));
      }
    }
    return months;
  };

  const payrollPeriods = generateMonthList();

  // State for data
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salAdjustments, setSalAdjustments] = useState<Adjustment[]>([]);
  const [resetAdjustments, setResetAdjustments] = useState(false);

  // State for selection
  const [selectAllHolidays, setSelectAllHolidays] = useState(false);
  const [selectAllEmployees, setSelectAllEmployees] = useState(false);

  // State for UI feedback
  const [loading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState('Please wait...');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'danger' | 'warning'>('success');

  const baseUrl = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token')?.replace(/"/g, '');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // --- Data Mapping (Defensive) ---

  const mapHolidayData = useCallback((data: any): Holiday[] => {
    if (!Array.isArray(data)) {
      console.warn('Load_Holidays API returned non-array:', data);
      return [];
    }
    return data
      .filter((h: any) => h && h[7] === true)
      .map((h: any) => ({
        ID: h[0], HolidayDate: h[1], Remark: h[2], Year: h[3], isSelected: false
      }));
  }, []);

  const mapEmployeeData = useCallback((data: any): Employee[] => {
    if (!Array.isArray(data)) {
      console.warn('Load_Employees API returned non-array:', data);
      return [];
    }
    return data.map((emp: any) => ({
      EmpCode: emp[0],
      EmpName: emp[1] && emp[1].includes('-') ? emp[1].split('-')[1].trim() : (emp[1] || 'Unknown'),
      isSelected: false
    }));
  }, []);

  const mapAdjustmentData = useCallback((data: any): Adjustment[] => {
    if (!Array.isArray(data)) {
      console.warn('Load_Adjustments API returned non-array:', data);
      return [];
    }
    return data.map((adj: any) => ({
      Ecode: adj[0], Ename: adj[1], SalMY: adj[2],
      AddDays: adj[3]?.toString() || '0', Remark: adj[4] || '', AdvDed: adj[5]?.toString() || '0'
    }));
  }, []);

  // --- API Actions ---

  const loadHolidays = useCallback(async () => {
    setLoading(true);
    setProgressMessage('Fetching holidays...');
    try {
      console.log(`[Salaries] Loading holidays for yr=${hYear}, mnth=${hMonth}`);
      const res = await axios.get(`${baseUrl}/Sources/Load_Holidays?yr=${hYear}&mnth=${hMonth}`, {
        headers: getAuthHeaders(),
      });
      console.log('[Salaries] Holidays Raw:', res.data);
      setHolidays(mapHolidayData(res.data));
    } catch (err) {
      console.error('[Salaries] Holidays Load Error:', err);
      setToastType('danger'); setToastMessage('Failed to load holidays.'); setShowToast(true);
    } finally { setLoading(false); }
  }, [baseUrl, hYear, hMonth, mapHolidayData]);

  const loadEmployeesActive = useCallback(async () => {
    setLoading(true);
    setProgressMessage('Fetching employees...');
    try {
      const currentSalMY = `${moment(hMonth, 'M').format('MMM')}-${hYear}`;
      console.log(`[Salaries] Loading employees for SalMY=${currentSalMY}`);
      const res = await axios.get(`${baseUrl}/Salaries/Load_Sal_Employees?SalMY=${currentSalMY}`, {
        headers: getAuthHeaders(),
      });
      console.log('[Salaries] Employees Raw:', res.data);
      setEmployees(mapEmployeeData(res.data));
    } catch (err) {
      console.error('[Salaries] Employees Load Error:', err);
      setToastType('danger'); setToastMessage('Failed to load employees.'); setShowToast(true);
    } finally { setLoading(false); }
  }, [baseUrl, hYear, hMonth, mapEmployeeData]);

  const loadAdjustments = useCallback(async () => {
    setLoading(true);
    setProgressMessage('Updating payroll...');
    try {
      console.log(`[Salaries] Loading adjustments for SalMY=${salMY}`);
      const res = await axios.get(`${baseUrl}/Salaries/Load_Sal_Adjustments?SalMY=${salMY}`, {
        headers: getAuthHeaders(),
      });
      console.log('[Salaries] Adjustments Raw:', res.data);
      setSalAdjustments(mapAdjustmentData(res.data));
    } catch (err) {
      console.error('[Salaries] Adjustments Load Error:', err);
      setToastType('danger'); setToastMessage('Failed to load adjustments.'); setShowToast(true);
    } finally { setLoading(false); }
  }, [baseUrl, salMY, mapAdjustmentData]);

  const handleUpdateEmpHolidays = async () => {
    const selectedEmps = employees.filter(e => e.isSelected);
    const selectedHols = holidays.filter(h => h.isSelected);
    if (!selectedEmps.length || !selectedHols.length) {
      setToastType('warning'); setToastMessage('Select target employees and holidays first.'); setShowToast(true);
      return;
    }

    setLoading(true);
    try {
      setProgressMessage('Syncing holiday registers...');
      await axios.post(`${baseUrl}/Salaries/Delete_HTable`, {}, { headers: getAuthHeaders() });
      for (let i = 0; i < selectedHols.length; i++) {
        const h = selectedHols[i];
        await axios.post(`${baseUrl}/Salaries/Insert_HTable`, {
          _Hdt: moment(h.HolidayDate).format('DD-MM-YYYY'), _Remark: h.Remark, _Recno: (i + 1).toString()
        }, { headers: getAuthHeaders() });
      }
      setProgressMessage('Updating employee records...');
      await axios.post(`${baseUrl}/Salaries/Delete_ETable`, {}, { headers: getAuthHeaders() });
      for (const emp of selectedEmps) {
        await axios.post(`${baseUrl}/Salaries/Insert_ETable`, { _Ecode: emp.EmpCode, _Ename: emp.EmpName }, { headers: getAuthHeaders() });
      }
      setProgressMessage('Finalizing payroll sync...');
      const currentSalMY = `${moment(hMonth, 'M').format('MMM')}-${hYear}`;
      await axios.post(`${baseUrl}/Salaries/UpdateEmpHoliday`, { _SalMY: currentSalMY }, { headers: getAuthHeaders() });
      setToastType('success'); setToastMessage('Salaries synced successfully!'); setShowToast(true);
      loadEmployeesActive();
    } catch (err) {
      setToastType('danger'); setToastMessage('Record sync failed.'); setShowToast(true);
    } finally { setLoading(false); }
  };

  const handleGenerateSal = async () => {
    setLoading(true);
    setProgressMessage('Generating records...');
    try {
      const res = await axios.post(`${baseUrl}/Salaries/GenerateSal`, { _SalMY: salMY, _Reset: resetAdjustments ? 'Y' : '' }, { headers: getAuthHeaders() });
      if (res.data.includes('Successfully')) {
        setToastType('success'); setToastMessage('Payroll generated!'); setShowToast(true);
        loadAdjustments();
      } else throw new Error(res.data);
    } catch (err) {
      setToastType('danger'); setToastMessage('Generation failed.'); setShowToast(true);
    } finally { setLoading(false); }
  };

  const handleUpdateAdjustment = async (adj: Adjustment) => {
    setLoading(true);
    setProgressMessage(`Saving ${adj.Ename}...`);
    try {
      await axios.post(`${baseUrl}/Salaries/UpdateSalAdjust`, {
        _SalMY: salMY, _Ecode: adj.Ecode, _AddDays: adj.AddDays || '0', _Remark: adj.Remark || '', _AdvDed: adj.AdvDed || '0'
      }, { headers: getAuthHeaders() });
      setToastType('success'); setToastMessage('Adjustment saved!'); setShowToast(true);
    } catch (err) {
      setToastType('danger'); setToastMessage('Save failed.'); setShowToast(true);
    } finally { setLoading(false); }
  };

  // --- Handlers ---

  const handleToggleHoliday = (id: number) => {
    const nextHolidays = holidays.map(h => h.ID === id ? { ...h, isSelected: !h.isSelected } : h);
    setHolidays(nextHolidays);
    setSelectAllHolidays(nextHolidays.length > 0 && nextHolidays.every(h => h.isSelected));
  };

  const handleToggleEmployee = (code: string) => {
    const nextEmployees = employees.map(e => e.EmpCode === code ? { ...e, isSelected: !e.isSelected } : e);
    setEmployees(nextEmployees);
    setSelectAllEmployees(nextEmployees.length > 0 && nextEmployees.every(e => e.isSelected));
  };

  const updateAdjField = (code: string, field: keyof Adjustment, value: string) => {
    setSalAdjustments(prev => prev.map(a => a.Ecode === code ? { ...a, [field]: value } : a));
  };

  useEffect(() => {
    if (activeTab === 'assign') { loadHolidays(); loadEmployeesActive(); }
    else { loadAdjustments(); }
  }, [activeTab, hYear, hMonth, salMY, loadHolidays, loadEmployeesActive, loadAdjustments]);

  // --- Scroll Effects ---
  useEffect(() => {
    const content = document.querySelector('ion-content');
    if (content) {
      // Content scrolling reset when tab changes
      content.scrollToTop();
    }
  }, [activeTab]);

  return (
    <IonPage>


      <IonContent className="sc-container">
        <div className="sc-header-card premium-trendy-bg">
          <div className="sc-header-info">
            <h1 className="sc-title">Salaries Dashboard</h1>
            <p className="sc-subtitle">Official payroll management and holiday processing.</p>
          </div>
          <div className="sc-header-icon-bg">
            <IonIcon icon={cashOutline} />
          </div>
        </div>

        <IonLoading isOpen={loading} message={progressMessage} />
        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2500}
          color={toastType === 'success' ? 'success' : (toastType === 'warning' ? 'warning' : 'danger')}
          position="top"
          mode="ios"
        />

        {/* Custom Segment Swiper */}
        <div className="sc-segment">
          <div
            className={`sc-segment-item ${activeTab === 'assign' ? 'active' : ''}`}
            onClick={() => setActiveTab('assign')}
          >
            Assign Holidays
          </div>
          <div
            className={`sc-segment-item ${activeTab === 'generate' ? 'active' : ''}`}
            onClick={() => setActiveTab('generate')}
          >
            Generate Salaries
          </div>
        </div>

        {activeTab === 'assign' ? (
          <div>
            <div className="sc-grid">
              <div className="sc-input-card premium-trendy-bg">
                <div style={{ flex: 1 }}>
                  <div className="sc-input-label">Processing Year</div>
                  <IonSelect
                    value={hYear}
                    onIonChange={(e: CustomEvent) => setHYear(e.detail.value)}
                    interface="popover"
                    className="lr-popover-select"
                  >
                    {years.map(y => <IonSelectOption key={y} value={y}>{y}</IonSelectOption>)}
                  </IonSelect>
                </div>
                <IonIcon icon={calendarOutline} color="primary" />
              </div>
              <div className="sc-input-card premium-trendy-bg">
                <div style={{ flex: 1 }}>
                  <div className="sc-input-label">Processing Month</div>
                  <IonSelect
                    value={hMonth}
                    onIonChange={(e: CustomEvent) => setHMonth(e.detail.value)}
                    interface="popover"
                    className="lr-popover-select"
                  >
                    {monthsList.map(m => <IonSelectOption key={m.value} value={m.value}>{m.name}</IonSelectOption>)}
                  </IonSelect>
                </div>
                <IonIcon icon={chevronDownOutline} color="primary" />
              </div>
            </div>

            <div className="sc-desktop-split">
              {/* Employee Area */}
              <div className="sc-card">
                <div className="sc-card-header">
                  <div className="sc-card-title">
                    <IonIcon icon={peopleOutline} color="primary" />
                    Employees <span className="sc-badge">{employees.filter(e => e.isSelected).length}</span>
                  </div>
                  <CustomCheckbox
                    checked={selectAllEmployees}
                    onChange={(checked) => {
                      setSelectAllEmployees(checked);
                      setEmployees(prev => prev.map(e => ({ ...e, isSelected: checked })));
                    }}
                  />
                </div>
                <div className="sc-list">
                  {employees.map(emp => (
                    <div
                      key={emp.EmpCode}
                      className={`sc-list-item ${emp.isSelected ? 'selected' : ''}`}
                      onClick={() => handleToggleEmployee(emp.EmpCode)}
                    >
                      <CustomCheckbox checked={emp.isSelected} onChange={() => handleToggleEmployee(emp.EmpCode)} />
                      <span className="sc-item-name">{emp.EmpName}</span>
                    </div>
                  ))}
                  {!employees.length && <div style={{ padding: '40px', textAlign: 'center', color: '#555' }}>No employees found.</div>}
                </div>
              </div>

              {/* Holiday Area */}
              <div className="sc-card">
                <div className="sc-card-header">
                  <div className="sc-card-title">
                    <IonIcon icon={calendarOutline} color="primary" />
                    Holidays <span className="sc-badge">{holidays.filter(h => h.isSelected).length}</span>
                  </div>
                  <CustomCheckbox
                    checked={selectAllHolidays}
                    onChange={(checked) => {
                      setSelectAllHolidays(checked);
                      setHolidays(prev => prev.map(h => ({ ...h, isSelected: checked })));
                    }}
                  />
                </div>
                <div className="sc-list">
                  {holidays.map(h => (
                    <div
                      key={h.ID}
                      className={`sc-list-item ${h.isSelected ? 'selected' : ''}`}
                      onClick={() => handleToggleHoliday(h.ID)}
                    >
                      <CustomCheckbox checked={h.isSelected} onChange={() => handleToggleHoliday(h.ID)} />
                      <div className="sc-item-name">
                        <div>{moment(h.HolidayDate).format('DD MMM YYYY')}</div>
                        <div style={{ fontSize: '11px', color: '#71717a' }}>{h.Remark}</div>
                      </div>
                    </div>
                  ))}
                  {!holidays.length && <div style={{ padding: '40px', textAlign: 'center', color: '#555' }}>No holidays in this period.</div>}
                </div>
              </div>
            </div>

            <div className="sc-footer">
              <button
                className="sc-btn"
                style={{ width: '100%' }}
                onClick={handleUpdateEmpHolidays}
              >
                <IonIcon icon={checkmarkCircleOutline} />
                Assign & Sync Salaries
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="sc-grid">
              <div className="sc-input-card premium-trendy-bg">
                <div style={{ flex: 1 }}>
                  <div className="sc-input-label">Payroll Period</div>
                  <IonSelect
                    value={salMY}
                    onIonChange={(e: CustomEvent) => setSalMY(e.detail.value)}
                    interface="popover"
                    className="lr-popover-select"
                  >
                    {payrollPeriods.map(p => <IonSelectOption key={p} value={p}>{p}</IonSelectOption>)}
                  </IonSelect>
                </div>
                <IonIcon icon={cashOutline} color="primary" />
              </div>
              <div className="sc-input-card premium-trendy-bg" style={{ cursor: 'default' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <CustomCheckbox checked={resetAdjustments} onChange={setResetAdjustments} />
                  <span style={{ fontWeight: '700', fontSize: '14px', color: '#fff' }}>Reset Adjustments</span>
                </div>
              </div>
            </div>

            {/* Desktop Table */}
            <div className="sc-card sc-desktop-only" style={{ padding: '0' }}>
              <div className="sc-card-header" style={{ padding: '20px', marginBottom: '0' }}>
                <div className="sc-card-title">Salary Variations</div>
                <IonIcon icon={refreshOutline} className="clickable" style={{ fontSize: '20px' }} onClick={loadAdjustments} />
              </div>
              <div className="sc-table-container">
                <table className="sc-table">
                  <thead>
                    <tr>
                      <th className="sc-th">Employee Name</th>
                      <th className="sc-th" style={{ width: '120px' }}>Add Days</th>
                      <th className="sc-th">Adjustment Remark</th>
                      <th className="sc-th" style={{ width: '150px' }}>Advance Recovery</th>
                      <th className="sc-th" style={{ width: '80px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salAdjustments.map(adj => (
                      <tr key={adj.Ecode}>
                        <td className="sc-td" style={{ fontWeight: '700' }}>{adj.Ename}</td>
                        <td className="sc-td">
                          <input
                            className="sc-input"
                            value={adj.AddDays}
                            onChange={(e) => updateAdjField(adj.Ecode, 'AddDays', e.target.value)}
                          />
                        </td>
                        <td className="sc-td">
                          <input
                            className="sc-input"
                            value={adj.Remark}
                            onChange={(e) => updateAdjField(adj.Ecode, 'Remark', e.target.value)}
                            placeholder="Reason..."
                          />
                        </td>
                        <td className="sc-td">
                          <input
                            className="sc-input"
                            type="number"
                            value={adj.AdvDed}
                            onChange={(e) => updateAdjField(adj.Ecode, 'AdvDed', e.target.value)}
                          />
                        </td>
                        <td className="sc-td">
                          <button className="sc-btn sc-btn-save" onClick={() => handleUpdateAdjustment(adj)}>
                            <IonIcon icon={saveOutline} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="sc-mobile-only">
              <h4 style={{ padding: '0 8px', marginBottom: '16px', fontWeight: '800' }}>Adjustments</h4>
              {salAdjustments.map(adj => (
                <div key={adj.Ecode} className="sc-mobile-adj-card">
                  <div style={{ marginBottom: '15px', fontWeight: '800', fontSize: '18px' }}>{adj.Ename}</div>
                  <div className="sc-adj-row">
                    <div className="sc-adj-field">
                      <div className="sc-input-label">Add Days</div>
                      <input className="sc-input" value={adj.AddDays} onChange={(e) => updateAdjField(adj.Ecode, 'AddDays', e.target.value)} />
                    </div>
                    <div className="sc-adj-field">
                      <div className="sc-input-label">Advance</div>
                      <input className="sc-input" type="number" value={adj.AdvDed} onChange={(e) => updateAdjField(adj.Ecode, 'AdvDed', e.target.value)} />
                    </div>
                  </div>
                  <div className="sc-adj-field">
                    <div className="sc-input-label">Adjustment Remark</div>
                    <input className="sc-input" value={adj.Remark} onChange={(e) => updateAdjField(adj.Ecode, 'Remark', e.target.value)} />
                  </div>
                  <button className="sc-btn" style={{ width: '100%', height: '48px', marginTop: '10px' }} onClick={() => handleUpdateAdjustment(adj)}>
                    <IonIcon icon={saveOutline} /> Save Changes
                  </button>
                </div>
              ))}
            </div>

            <div className="sc-footer">
              <button
                className="sc-btn"
                style={{ width: '100%' }}
                onClick={handleGenerateSal}
              >
                <IonIcon icon={refreshOutline} />
                Generate Salaries
              </button>
            </div>
          </div>
        )}


      </IonContent>
    </IonPage>
  );
};

export default Salaries;