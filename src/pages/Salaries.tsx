import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonItem,
  IonInput,
  IonGrid,
  IonRow,
  IonCol,
  IonCheckbox,
  IonButton,
  IonModal,
  IonDatetime,
  IonLoading,
  IonToast,
} from '@ionic/react';
import axios from 'axios';
import moment from 'moment';

interface EmployeeAdjustment {
  ecode: string;
  addDays: string;
  remark: string;
  advDed: string;
}

interface Employee {
  EmpCode: string;
  EmpName: string;
  isSelected: boolean;
}

interface Holiday {
  HolidayDate: string;
  Remark: string;
  FLAG: boolean;
  isSelected: boolean;
}

interface Adjustment {
  Ecode: string;
  AddDays: string;
  Remark: string;
  AdvDed: string;
}

const Salaries: React.FC = () => {
  // State for tab navigation
  const [activeTab, setActiveTab] = useState<'assign' | 'generate'>('generate');

  // State for year and month selection
  const [hYear, setHYear] = useState<string>('2024');
  const [hMonth, setHMonth] = useState<string>('3'); // Changed to match Mar-2024
  const [salMY, setSalMY] = useState<string>('Mar-2024'); // Sync with hMonth and hYear
  const [isYearModalOpen, setYearModalOpen] = useState(false);
  const [isMonthModalOpen, setMonthModalOpen] = useState(false);
  const [isSalMYModalOpen, setSalMYModalOpen] = useState(false);

  // State for data
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salAdjustments, setSalAdjustments] = useState<Adjustment[]>([]);
  const [employeeAdjustments, setEmployeeAdjustments] = useState<EmployeeAdjustment[]>([]);
  const [resetAdjustments, setResetAdjustments] = useState(false);

  // State for selection
  const [selectAllHolidays, setSelectAllHolidays] = useState(false);
  const [selectAllEmployees, setSelectAllEmployees] = useState(false);

  // State for UI feedback
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'danger'>('success');

  const baseUrl = '/api';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token')?.replace(/"/g, '');
    console.log('Authorization Token:', token);
    return { Authorization: `Bearer ${token}` };
  };

  // Map API response to Employee and Holiday interfaces
  const mapEmployeeData = (data: any[]): Employee[] => {
    return data.map((emp: any) => {
      // Assuming emp is an array like [EmpCode, EmpName, ...]
      console.log('Raw Employee Data:', emp); // Log raw data to inspect structure
      return {
        EmpCode: emp[0] || 'Unknown Code', // Adjust based on actual index
        EmpName: emp[1] || 'Unknown Name', // Adjust based on actual index
        isSelected: false,
      };
    });
  };

  const mapHolidayData = (data: any[]): Holiday[] => {
    return data
      .filter((h: any) => h[7] === true) // Assuming FLAG is at index 7
      .map((h: any) => {
        console.log('Raw Holiday Data:', h); // Log raw data to inspect structure
        return {
          HolidayDate: h[0] || 'Unknown Date', // Adjust based on actual index
          Remark: h[1] || 'Unknown Remark', // Adjust based on actual index
          FLAG: h[7] || false, // Adjust based on actual index
          isSelected: false,
        };
      });
  };

  const mapAdjustmentData = (data: any[]): Adjustment[] => {
    return data.map((adj: any) => {
      console.log('Raw Adjustment Data:', adj); // Log raw data to inspect structure
      return {
        Ecode: adj[0] || 'Unknown Code', // Adjust based on actual index
        AddDays: adj[3] || '', // Adjust based on actual index
        Remark: adj[4] || '', // Adjust based on actual index
        AdvDed: adj[5] || '', // Adjust based on actual index
      };
    });
  };

  // Initialize employee adjustments when salAdjustments load
  useEffect(() => {
    const adjustments = employees.map((emp) => {
      const adjustment =
        salAdjustments.find((adj) => adj.Ecode === emp.EmpCode) || {
          Ecode: emp.EmpCode,
          AddDays: '',
          Remark: '',
          AdvDed: '',
        };
      return {
        ecode: emp.EmpCode,
        addDays: adjustment.AddDays || '',
        remark: adjustment.Remark || '',
        advDed: adjustment.AdvDed || '',
      };
    });
    setEmployeeAdjustments(adjustments);
  }, [employees, salAdjustments]);

  // Update adjustment field for a specific employee
  const updateAdjustmentField = (ecode: string, field: keyof EmployeeAdjustment, value: string) => {
    setEmployeeAdjustments((prev) =>
      prev.map((adj) =>
        adj.ecode === ecode ? { ...adj, [field]: value } : adj
      )
    );
  };

  // Load holidays
  const loadHolidays = async () => {
    setLoading(true);
    try {
      const yr = hYear || '0';
      const mnth = hMonth || '0';
      console.log(`Fetching holidays: yr=${yr}, mnth=${mnth}`);
      const res = await axios.get(`${baseUrl}/Sources/Load_Holidays?yr=${yr}&mnth=${mnth}`, {
        headers: getAuthHeaders(),
      });
      console.log('Holidays Response:', res.data);
      const mappedHolidays = mapHolidayData(res.data);
      setHolidays(mappedHolidays);
    } catch (err: any) {
      console.error('Error loading holidays:', err);
      console.log('Holidays Error Response:', err.response?.data);
      setToastMessage(
        err.response?.status === 400
          ? `Bad request while loading holidays: ${err.response?.data?.error || 'Check API parameters.'}`
          : 'Failed to load holidays.'
      );
      setToastType('danger');
      setShowToast(true);
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  };

  // Load active employees
  const loadEmployeesActive = async () => {
    setLoading(true);
    try {
      const tmpMY = hMonth && hYear ? `${moment(hMonth, 'M').format('MMM')}-${hYear}` : '';
      console.log(`Fetching employees: SalMY=${tmpMY}`);
      const res = await axios.get(`${baseUrl}/Salaries/Load_Sal_Employees?SalMY=${tmpMY}`, {
        headers: getAuthHeaders(),
      });
      console.log('Employees Response:', res.data);
      const mappedEmployees = mapEmployeeData(res.data);
      setEmployees(mappedEmployees);
    } catch (err: any) {
      console.error('Error loading employees:', err);
      console.log('Employees Error Response:', err.response?.data);
      setToastMessage(
        err.response?.status === 400
          ? `Bad request while loading employees: ${err.response?.data?.error || 'Check API parameters.'}`
          : 'Failed to load employees.'
      );
      setToastType('danger');
      setShowToast(true);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  // Load salary adjustments
  const loadAdjustments = async () => {
    setLoading(true);
    try {
      const tmpMY = salMY || '';
      console.log(`Fetching adjustments: SalMY=${tmpMY}`);
      const res = await axios.get(`${baseUrl}/Salaries/Load_Sal_Adjustments?SalMY=${tmpMY}`, {
        headers: getAuthHeaders(),
      });
      console.log('Adjustments Response:', res.data);
      const mappedAdjustments = mapAdjustmentData(res.data);
      setSalAdjustments(mappedAdjustments.length > 0 ? mappedAdjustments : []);
    } catch (err: any) {
      console.error('Error loading adjustments:', err);
      console.log('Adjustments Error Response:', err.response?.data);
      setToastMessage(
        err.response?.status === 400
          ? `Bad request while loading adjustments: ${err.response?.data?.error || 'Check API parameters.'}`
          : 'Failed to load adjustments.'
      );
      setToastType('danger');
      setShowToast(true);
      setSalAdjustments([]);
    } finally {
      setLoading(false);
    }
  };

  // Delete ETable
  const deleteETable = async (): Promise<boolean> => {
    try {
      const res = await axios.post(`${baseUrl}/Salaries/Delete_ETable`, '', {
        headers: getAuthHeaders(),
      });
      console.log('Delete ETable Response:', res.data);
      return Number(res.data) > 0;
    } catch (err: any) {
      console.error('Error deleting ETable:', err);
      setToastMessage('Error while resetting ETable: ' + err.message);
      setToastType('danger');
      setShowToast(true);
      return false;
    }
  };

  // Delete HTable
  const deleteHTable = async (): Promise<boolean> => {
    try {
      const res = await axios.post(`${baseUrl}/Salaries/Delete_HTable`, '', {
        headers: getAuthHeaders(),
      });
      console.log('Delete HTable Response:', res.data);
      return Number(res.data) > 0;
    } catch (err: any) {
      console.error('Error deleting HTable:', err);
      setToastMessage('Error while resetting HTable: ' + err.message);
      setToastType('danger');
      setShowToast(true);
      return false;
    }
  };

  // Insert ETable
  const insertETable = async (): Promise<boolean> => {
    setLoading(true);
    try {
      await deleteETable();
      const selectedEmps = employees.filter((emp) => emp.isSelected);
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' };
      for (const emp of selectedEmps) {
        const payload = {
          _Ecode: emp.EmpCode,
          _Ename: emp.EmpName.replace(emp.EmpCode + '-', ''),
        };
        const res = await axios.post(`${baseUrl}/Salaries/Insert_ETable`, payload, { headers });
        console.log(`Insert ETable for ${emp.EmpName}:`, res.data);
        if (Number(res.data) <= 0) {
          throw new Error('Failed to insert employee: ' + emp.EmpName);
        }
        await new Promise((res) => setTimeout(res, 50));
      }
      return true;
    } catch (err: any) {
      console.error('Error inserting ETable:', err);
      setToastMessage('Error while saving employees: ' + err.message);
      setToastType('danger');
      setShowToast(true);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Insert HTable
  const insertHTable = async (): Promise<boolean> => {
    setLoading(true);
    try {
      await deleteHTable();
      const selectedHols = holidays.filter((h) => h.isSelected);
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' };
      for (const h of selectedHols) {
        const payload = {
          _Hdt: moment(h.HolidayDate).format('DD-MM-YYYY'),
          _Remark: h.Remark,
        };
        const res = await axios.post(`${baseUrl}/Salaries/Insert_HTable`, payload, { headers });
        console.log(`Insert HTable for ${h.HolidayDate}:`, res.data);
        if (Number(res.data) <= 0) {
          throw new Error('Failed to insert holiday: ' + h.HolidayDate);
        }
        await new Promise((res) => setTimeout(res, 50));
      }
      return true;
    } catch (err: any) {
      console.error('Error inserting HTable:', err);
      setToastMessage('Error while saving holidays: ' + err.message);
      setToastType('danger');
      setShowToast(true);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Update Employee Holidays
  const updateEmpHoliday = async (): Promise<boolean> => {
    setLoading(true);
    try {
      const tmpMY = hMonth && hYear ? `${moment(hMonth, 'M').format('MMM')}-${hYear}` : '';
      const payload = { _SalMY: tmpMY };
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' };
      const res = await axios.post(`${baseUrl}/Salaries/UpdateEmpHoliday`, payload, { headers });
      console.log('UpdateEmpHoliday Response:', res.data);
      return Number(res.data) > 0;
    } catch (err: any) {
      console.error('Error updating employee holidays:', err);
      setToastMessage('Error while updating employee holidays: ' + err.message);
      setToastType('danger');
      setShowToast(true);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Generate Salaries
  const generateSal = async (): Promise<boolean> => {
    setLoading(true);
    try {
      const tmpMY = salMY || '';
      const tmpReset = resetAdjustments ? 'Y' : '';
      const payload = { _SalMY: tmpMY, _Reset: tmpReset };
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' };
      const res = await axios.post(`${baseUrl}/Salaries/GenerateSal`, payload, { headers });
      console.log('GenerateSal Response:', res.data);
      if (Number(res.data) > 0) {
        await loadAdjustments();
        setToastMessage('Salaries generated successfully!');
        setToastType('success');
        setShowToast(true);
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Error generating salaries:', err);
      setToastMessage('Error while generating salaries: ' + err.message);
      setToastType('danger');
      setShowToast(true);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Update Salary Adjustments
  const updateAdjustment = async (ecode: string) => {
    setLoading(true);
    try {
      const adjustment = employeeAdjustments.find((adj) => adj.ecode === ecode);
      if (!adjustment) throw new Error('Adjustment not found for employee: ' + ecode);
      const tmpMY = salMY || '';
      const payload = {
        _SalMY: tmpMY,
        _Ecode: ecode,
        _AddDays: adjustment.addDays || '0',
        _Remark: adjustment.remark || '',
        _AdvDed: adjustment.advDed || '0',
      };
      const headers = { ...getAuthHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' };
      const res = await axios.post(`${baseUrl}/Salaries/UpdateSalAdjust`, payload, { headers });
      console.log(`UpdateAdjustment for ${ecode}:`, res.data);
      if (Number(res.data) > 0) {
        setToastMessage('Adjustment updated successfully!');
        setToastType('success');
        setShowToast(true);
      } else {
        setToastMessage('Adjustment updated, but no changes made.');
        setToastType('success');
        setShowToast(true);
      }
    } catch (err: any) {
      console.error('Error updating adjustment:', err);
      setToastMessage('Error while updating adjustment: ' + err.message);
      setToastType('danger');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // Handle select all for holidays
  const handleSelectAllHolidays = (checked: boolean) => {
    setSelectAllHolidays(checked);
    setHolidays(holidays.map((h) => ({ ...h, isSelected: checked })));
  };

  // Handle select all for employees
  const handleSelectAllEmployees = (checked: boolean) => {
    setSelectAllEmployees(checked);
    setEmployees(employees.map((emp) => ({ ...emp, isSelected: checked })));
  };

  // Handle individual holiday selection
  const handleHolidayToggle = (holiday: Holiday) => {
    const updatedHolidays = holidays.map((h) =>
      h.HolidayDate === holiday.HolidayDate ? { ...h, isSelected: !h.isSelected } : h
    );
    setHolidays(updatedHolidays);
    const selectedCount = updatedHolidays.filter((h) => h.isSelected).length;
    setSelectAllHolidays(selectedCount === updatedHolidays.length);
  };

  // Handle individual employee selection
  const handleEmployeeToggle = (emp: Employee) => {
    const updatedEmployees = employees.map((e) =>
      e.EmpName === emp.EmpName ? { ...e, isSelected: !e.isSelected } : e
    );
    setEmployees(updatedEmployees);
    const selectedCount = updatedEmployees.filter((e) => e.isSelected).length;
    setSelectAllEmployees(selectedCount === updatedEmployees.length);
  };

  // Update Employee Holidays (Assign Holidays tab)
  const updateEmpHolidays = async () => {
    setLoading(true);
    try {
      const hTableSuccess = await insertHTable();
      if (!hTableSuccess) throw new Error('Failed to insert holidays');
      const eTableSuccess = await insertETable();
      if (!eTableSuccess) throw new Error('Failed to insert employees');
      const updateSuccess = await updateEmpHoliday();
      if (!updateSuccess) throw new Error('Failed to update employee holidays');
      await loadEmployeesActive();
      setSelectAllEmployees(false);
      setToastMessage('Employee holidays updated successfully!');
      setToastType('success');
      setShowToast(true);
    } catch (err: any) {
      console.error('Error updating employee holidays:', err);
      setToastMessage('Error updating employee holidays: ' + err.message);
      setToastType('danger');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    console.log('Component mounted, loading initial data...');
    loadEmployeesActive();
    loadHolidays();
    loadAdjustments();
  }, [hYear, hMonth, salMY]);

  return (
    <IonPage>
      

      <IonHeader>
              <IonToolbar>
                <img src="./images/dbase.png" alt="Logo" className="menu-logo" />
              </IonToolbar>
            </IonHeader>

      <IonContent className="ion-padding">

          <h2>Salaries</h2>

        <IonLoading isOpen={loading} message="Please wait..." />
        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={3000}
          color={toastType}
        />

        <IonSegment
          value={activeTab}
          onIonChange={(e) => setActiveTab(e.detail.value as 'assign' | 'generate')}
          color="primary"
        >
          <IonSegmentButton value="assign">
            <IonLabel>Assign Holidays</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="generate">
            <IonLabel>Generate Salaries</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {/* TAB: Assign Holidays */}
        {activeTab === 'assign' && (
          <div className="tab-content fade-in">
            <IonGrid>
              <IonRow>
                <IonCol size="12" sizeMd="6" style={{margin:'auto'}}>
                  <IonItem button onClick={() => setYearModalOpen(true)}>
                    <IonInput
                      value={hYear || 'Select Year'}
                      readonly
                      className="ion-text-center"
                      placeholder="Select Year"
                    />
                  </IonItem>
                  <IonItem button onClick={() => setMonthModalOpen(true)}>
                    <IonInput
                      value={hMonth ? moment(hMonth, 'M').format('MMMM') : 'Select Month'}
                      readonly
                      className="ion-text-center"
                      placeholder="Select Month"
                    />
                  </IonItem>
                </IonCol>
              </IonRow>

              <IonRow>
                <IonCol size="12" sizeMd="6">
                  <h5 className="section-title">Select Employees</h5>
                  {employees.length === 0 ? (
                    <p>No employees loaded. Check API or parameters.</p>
                  ) : (
                    <>
                      <IonItem lines="none">
                        <IonCheckbox
                          checked={selectAllEmployees}
                          onIonChange={(e) => handleSelectAllEmployees(e.detail.checked)}
                        />
                        <IonLabel>Select All</IonLabel>
                      </IonItem>
                      {employees.map((emp, idx) => (
                        <IonItem key={idx} lines="none" className="employee-item">
                          <IonCheckbox
                            checked={emp.isSelected}
                            onIonChange={() => handleEmployeeToggle(emp)}
                          />
                          <p>{emp.EmpName || 'Missing EmpName'}</p>
                        </IonItem>
                      ))}
                    </>
                  )}
                </IonCol>

                <IonCol size="12" sizeMd="6">
                  <h5 className="section-title">Select Holidays</h5>
                  {holidays.length === 0 ? (
                    <p>No holidays loaded. Check API or parameters.</p>
                  ) : (
                    <>
                      <IonItem lines="none">
                        <IonCheckbox
                          checked={selectAllHolidays}
                          onIonChange={(e) => handleSelectAllHolidays(e.detail.checked)}
                        />
                        <IonLabel>Select All</IonLabel>
                      </IonItem>
                      {holidays.map((h, idx) => (
                        <IonItem key={idx} lines="none" className="holiday-item">
                          <IonCheckbox
                            checked={h.isSelected}
                            onIonChange={() => handleHolidayToggle(h)}
                          />
                          <p>{`${h.HolidayDate || 'Missing Date'} -- ${h.Remark || 'Missing Remark'}`}</p>
                        </IonItem>
                      ))}
                    </>
                  )}
                </IonCol>
              </IonRow>

              <IonRow>
                <IonCol size="12" sizeMd="6" className="ion-text-right">
                  <IonButton
                    expand="block"
                    className="login-btn2 reset-adjustments"
                    style={{ '--box-shadow': 'none' }}
                    color="#f57c00"
                    onClick={updateEmpHolidays}
                  >
                    Update
                  </IonButton>
                </IonCol>
              </IonRow>
            </IonGrid>
          </div>
        )}

        {/* TAB: Generate Salaries */}
        {activeTab === 'generate' && (
          <div className="tab-content fade-in">
            <IonGrid>
              <IonRow className="ion-align-items-center ion-justify-content-between">
                <IonCol size="12" sizeMd="12" className="md">
                  <IonItem button onClick={() => setSalMYModalOpen(true)}>
                    <IonInput
                      value={salMY || 'Select Date'}
                      readonly
                      className="ion-text-center"
                      placeholder="Select Date"
                    />
                  </IonItem>
                </IonCol>

                <IonCol size="12" sizeMd="6" className="reset-adjustments">
                  <IonCheckbox
                    checked={resetAdjustments}
                    onIonChange={(e) => setResetAdjustments(e.detail.checked)}
                  />
                  <IonLabel>Reset Adjustments</IonLabel>
                </IonCol>

                <IonCol size="12" sizeMd="3" className="ion-text-right reset-adjustments">
                  <IonButton
                    expand="block"
                    className="login-btn2"
                    style={{ '--box-shadow': 'none' }}
                    color="#f57c00"
                    onClick={generateSal}
                  >
                    Generate
                  </IonButton>
                </IonCol>
              </IonRow>

              <IonRow className="table-header">
                <IonCol>Employee</IonCol>
                <IonCol>Add Days</IonCol>
                <IonCol>Remarks</IonCol>
                <IonCol>Advance</IonCol>
                <IonCol>Repay</IonCol>
              </IonRow>

              {employees.length === 0 ? (
                <IonRow>
                  <IonCol>
                    <p>No employees loaded. Check API or parameters.</p>
                  </IonCol>
                </IonRow>
              ) : (
                employees.map((emp, idx) => {
                  const adjustment = employeeAdjustments.find((adj) => adj.ecode === emp.EmpCode) || {
                    addDays: '',
                    remark: '',
                    advDed: '',
                  };

                  return (
                    <IonRow key={idx} className="table-row">
                      <IonCol data-label="Employee">{emp.EmpName || 'Missing EmpName'}</IonCol>
                      <IonCol data-label="Add Days">
                        <IonInput
                          value={adjustment.addDays}
                          onIonChange={(e) =>
                            updateAdjustmentField(emp.EmpCode, 'addDays', e.detail.value!)
                          }
                        />
                      </IonCol>
                      <IonCol data-label="Remarks">
                        <IonInput
                          value={adjustment.remark}
                          onIonChange={(e) =>
                            updateAdjustmentField(emp.EmpCode, 'remark', e.detail.value!)
                          }
                        />
                      </IonCol>
                      <IonCol data-label="Advance">
                        <IonInput
                          value={adjustment.advDed}
                          onIonChange={(e) =>
                            updateAdjustmentField(emp.EmpCode, 'advDed', e.detail.value!)
                          }
                        />
                      </IonCol>
                      <IonCol data-label="Repay">
                        <IonButton onClick={() => updateAdjustment(emp.EmpCode)}>
                          Update
                        </IonButton>
                      </IonCol>
                    </IonRow>
                  );
                })
              )}
            </IonGrid>
          </div>
        )}
      </IonContent>

      {/* Modal for Year Selection */}
      <IonModal
        isOpen={isYearModalOpen}
        onDidDismiss={() => setYearModalOpen(false)}
        className="date-modal"
      >
        <div className="modal-content">
          <IonDatetime
            presentation="year"
            onIonChange={(e) => {
              if (typeof e.detail.value === 'string') {
                setHYear(moment(e.detail.value).format('YYYY'));
              }
              setYearModalOpen(false);
            }}
          />
          <IonButton expand="full" onClick={() => setYearModalOpen(false)}>
            Close
          </IonButton>
        </div>
      </IonModal>

      {/* Modal for Month Selection */}
      <IonModal
        isOpen={isMonthModalOpen}
        onDidDismiss={() => setMonthModalOpen(false)}
        className="date-modal"
      >
        <div className="modal-content">
          <IonDatetime
            presentation="month"
            onIonChange={(e) => {
              if (typeof e.detail.value === 'string') {
                const newMonth = moment(e.detail.value).format('M');
                setHMonth(newMonth);
                setSalMY(`${moment(newMonth, 'M').format('MMM')}-${hYear}`); // Sync salMY with hMonth and hYear
              }
              setMonthModalOpen(false);
            }}
          />
          <IonButton expand="full" onClick={() => setMonthModalOpen(false)}>
            Close
          </IonButton>
        </div>
      </IonModal>

      {/* Modal for SalMY Selection */}
      <IonModal
        isOpen={isSalMYModalOpen}
        onDidDismiss={() => setSalMYModalOpen(false)}
        className="date-modal"
      >
        <div className="modal-content">
          <IonDatetime
            presentation="month-year"
            onIonChange={(e) => {
              if (typeof e.detail.value === 'string') {
                setSalMY(moment(e.detail.value).format('MMM-YYYY'));
              }
              setSalMYModalOpen(false);
            }}
          />
          <IonButton expand="full" onClick={() => setSalMYModalOpen(false)}>
            Close
          </IonButton>
        </div>
      </IonModal>
    </IonPage>
  );
};

export default Salaries;