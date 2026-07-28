import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { API_BASE } from "../config";
import {
  IonIcon,
  IonToast,
  IonPage,
  IonContent,
  IonDatetime,
  IonPopover
} from "@ionic/react";

import {
  warningOutline,
  saveOutline,
  documentTextOutline,
  search,
  close,
  checkmarkCircle,
  chevronDown
} from "ionicons/icons";
import { ChevronLeft } from "lucide-react";

import "./WorkReports.css";
import "./RequestsPage.css";
import "./Stock.css";
import "./PenaltyAssignment.css";
import "./WorkReportDashboard.css";
import { useHistory } from "react-router-dom";

function PenaltyAssignment() {
  const history = useHistory();

  const [employees, setEmployees] = useState<any[]>([]);
  const [penalties, setPenalties] = useState<any[]>([]);
  const [proofFile, setProofFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    penaltyId: "",
    penaltyDate: "",
    violationTime: "",
    employeeCodes: [] as string[],
    remarks: "",
    appliedBy: "Admin"
  });

  const [toast, setToast] = useState({
    open: false,
    message: "",
    color: "success"
  });

  // Custom Dropdown State
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState<boolean>(false);
  const [employeeDropdownPos, setEmployeeDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 240 });
  const [empSearchTerm, setEmpSearchTerm] = useState<string>("");
  const empTriggerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadEmployees();
    loadPenalties();
  }, []);

  const loadEmployees = async () => {
    try {
      const response = await axios.get(`${API_BASE}Employee/Load_Employees`);
      setEmployees(response.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadPenalties = async () => {
    try {
      const response = await axios.get(`${API_BASE}Penalty/GetPenaltyMaster`);
      setPenalties(response.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const applyPenalty = async () => {
    try {
      if (!form.penaltyId) {
        alert("Select Penalty");
        return;
      }
      if (!form.penaltyDate) {
        alert("Select Penalty Date");
        return;
      }
      if (form.employeeCodes.length === 0) {
        alert("Select Employees");
        return;
      }

      const data = new FormData();
      data.append("PenaltyId", form.penaltyId);
      data.append("PenaltyDate", form.penaltyDate);
      data.append("ViolationTime", form.violationTime);
      data.append("Remarks", form.remarks);
      data.append("AppliedBy", form.appliedBy);

      form.employeeCodes.forEach((emp) => {
        data.append("EmployeeCodes", emp);
      });

      if (proofFile) {
        data.append("ProofFile", proofFile);
      }

      await axios.post(`${API_BASE}Penalty/ApplyPenalty`, data, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      alert("Penalty Applied Successfully");

      setForm({
        penaltyId: "",
        penaltyDate: "",
        violationTime: "",
        employeeCodes: [],
        remarks: "",
        appliedBy: "Admin"
      });
      setProofFile(null);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.message || "Error Applying Penalty");
    }
  };

  // Dropdown filtering
  const filteredEmployees = employees.filter((emp) => {
    const term = empSearchTerm.toLowerCase();
    const id = String(emp[0]).toLowerCase();
    let name = String(emp[1]).toLowerCase();
    return name.includes(term) || id.includes(term);
  });

  const toggleEmployeeSelection = (empId: string) => {
    setForm((prev) => {
      const codes = [...prev.employeeCodes];
      const index = codes.indexOf(empId);
      if (index === -1) {
        codes.push(empId);
      } else {
        codes.splice(index, 1);
      }
      return { ...prev, employeeCodes: codes };
    });
  };

  // Dropdown position logic
  useEffect(() => {
    const compute = () => {
      if (isEmployeeDropdownOpen && empTriggerRef.current) {
        const rect = empTriggerRef.current.getBoundingClientRect();
        setEmployeeDropdownPos({
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX,
          width: Math.max(rect.width, 300),
        });
      }
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [isEmployeeDropdownOpen]);

  const removeEmployee = (empId: string) => {
    setForm((prev) => ({
      ...prev,
      employeeCodes: prev.employeeCodes.filter(id => id !== empId)
    }));
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
                <h1 className="page-wr-title">Penalty Assignment</h1>
                <p className="page-wr-subtitle">Assign penalties to employees</p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <div className="page-wr-header-icon-box">
                <IonIcon icon={warningOutline} style={{ color: 'var(--ion-color-primary)', fontSize: '24px' }} />
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '0 16px 16px 16px' }}>
            <button 
              className="stock-button stock-button--secondary" 
              onClick={() => history.push("/violation-approval")}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '14px', fontSize: '13px', fontWeight: '700' }}
            >
              <IonIcon icon={documentTextOutline} style={{ fontSize: '18px' }} />
              View Pending Violations
            </button>
          </div>

          <div className="stock-panel" style={{ margin: '0 16px 20px 16px' }}>
            
            <div className="stock-grid">
              {/* Penalty */}
              <div className="stock-field">
                <label>Penalty Type</label>
                <select
                  className="stock-select"
                  value={form.penaltyId}
                  onChange={(e) => setForm({ ...form, penaltyId: e.target.value })}
                >
                  <option value="">Select Penalty</option>
                  {penalties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.penaltyType}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div className="stock-field">
                <label>Penalty Date</label>
                <div id="penalty-date-trigger" className="stock-input" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', minHeight: '38px', color: form.penaltyDate ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                  {form.penaltyDate ? new Date(form.penaltyDate).toLocaleDateString() : "Select Date"}
                </div>
                <IonPopover trigger="penalty-date-trigger" triggerAction="click" alignment="start">
                  <IonDatetime
                    presentation="date"
                    value={form.penaltyDate}
                    onIonChange={(e) => setForm({ ...form, penaltyDate: (e.detail.value as string).split('T')[0] })}
                  />
                </IonPopover>
              </div>

              {/* Time */}
              <div className="stock-field">
                <label>Violation Date & Time</label>
                <div id="violation-time-trigger" className="stock-input" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', minHeight: '38px', color: form.violationTime ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                  {form.violationTime ? new Date(form.violationTime).toLocaleString() : "Select Date & Time"}
                </div>
                <IonPopover trigger="violation-time-trigger" triggerAction="click" alignment="start">
                  <IonDatetime
                    presentation="date-time"
                    value={form.violationTime}
                    onIonChange={(e) => setForm({ ...form, violationTime: e.detail.value as string })}
                  />
                </IonPopover>
              </div>
            </div>

            {/* Side by side: Employees & Proof */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
              
              {/* Left Column: Employees */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="stock-field">
                  <label>Employees</label>
                  <div
                    ref={empTriggerRef}
                    className={`dbase-inline-select searchable-trigger ${isEmployeeDropdownOpen ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen);
                    }}
                    style={{ width: '100%', minHeight: '38px', background: 'var(--stock-panel-bg)', border: '1px solid var(--stock-border)', borderRadius: 'var(--stock-radius-md)' }}
                  >
                    <span className="dbase-select-text" style={{ fontSize: '13px', fontWeight: '600' }}>
                      {form.employeeCodes.length > 0 ? `${form.employeeCodes.length} Employee(s) Selected` : "Select Employees"}
                    </span>
                    <IonIcon icon={chevronDown} className="select-chevron" />
                  </div>
                </div>

                {/* Selected Employees List */}
                {form.employeeCodes.length > 0 && (
                  <div className="stock-table-wrapper" style={{ maxHeight: '250px', minHeight: 'auto', border: '1px solid var(--stock-border-strong)' }}>
                    <table className="stock-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th style={{ width: '40px', textAlign: 'center' }}>Remove</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.employeeCodes.map((empCode) => {
                          const empObj = employees.find(e => String(e[0]) === empCode);
                          const empName = empObj ? empObj[1] : "Unknown";
                          return (
                            <tr key={empCode}>
                              <td style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '700' }}>{empName}</span>
                                <span style={{ fontSize: '11px', color: 'var(--stock-muted)' }}>{empCode}</span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button onClick={() => removeEmployee(empCode)} style={{ background: 'transparent', border: 'none', color: 'var(--stock-danger)', cursor: 'pointer', padding: '4px' }}>
                                  <IonIcon icon={close} style={{ fontSize: '20px' }} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Right Column: Violation Proof */}
              <div className="stock-field">
                <label>Violation Proof</label>
                <div style={{ padding: '16px', border: '2px dashed var(--stock-border)', borderRadius: 'var(--stock-radius-lg)', backgroundColor: 'var(--stock-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '120px' }}>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    style={{ width: '100%', fontSize: '13px' }}
                  />
                  {!proofFile && (
                    <span style={{ marginTop: '12px', fontSize: '12px', color: 'var(--stock-muted)' }}>Upload Image or PDF Evidence</span>
                  )}
                </div>

                {proofFile && proofFile.type.startsWith("image/") && (
                  <div style={{ marginTop: '16px', borderRadius: 'var(--stock-radius-lg)', overflow: 'hidden', border: '1px solid var(--stock-border)', background: '#000', display: 'flex', justifyContent: 'center' }}>
                    <img
                      src={URL.createObjectURL(proofFile)}
                      alt="Proof"
                      style={{ maxWidth: '100%', maxHeight: '220px', objectFit: 'contain' }}
                    />
                  </div>
                )}

                {proofFile && proofFile.type === "application/pdf" && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', background: 'var(--stock-surface)', borderRadius: 'var(--stock-radius-lg)', marginTop: '16px', border: '1px solid var(--stock-border)' }}>
                    <IonIcon icon={documentTextOutline} style={{ fontSize: '24px', color: 'var(--stock-primary)' }} />
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--stock-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proofFile.name}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="stock-field stock-field--wide" style={{ marginTop: '20px' }}>
              <label>Remarks</label>
              <textarea
                className="stock-input"
                rows={3}
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="stock-actions" style={{ marginTop: '24px', marginBottom: '8px' }}>
              <button className="stock-button" onClick={applyPenalty} style={{ width: '100%', padding: '14px', fontSize: '14px' }}>
                <IonIcon icon={saveOutline} style={{ marginRight: '8px', verticalAlign: 'middle', fontSize: '18px' }} /> Apply Penalty
              </button>
            </div>
            
          </div>
        </div>
      </IonContent>

      {/* Employee Dropdown Portal */}
      {isEmployeeDropdownOpen && createPortal(
        <>
          <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsEmployeeDropdownOpen(false); }} />
          <div
            className="custom-inline-dropdown"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: `${employeeDropdownPos.top}px`,
              left: `${employeeDropdownPos.left}px`,
              width: `${employeeDropdownPos.width}px`
            }}
          >
            <div className="dropdown-search-sec">
              <IonIcon icon={search} className="dropdown-search-icon" />
              <input
                type="text"
                className="dropdown-pure-input"
                placeholder="Search employee..."
                value={empSearchTerm}
                onChange={(e) => setEmpSearchTerm(e.target.value)}
                autoFocus
                onMouseDown={(e) => e.stopPropagation()}
              />
              {empSearchTerm && (
                <button className="dropdown-clear-btn" onClick={() => setEmpSearchTerm("")}>
                  <IonIcon icon={close} />
                </button>
              )}
            </div>

            <div className="dropdown-body">
              {filteredEmployees.map((emp, index) => {
                const empId = String(emp[0]);
                let empName = String(emp[1]);
                if (empName.startsWith(empId + "-")) {
                  empName = empName.replace(empId + "-", "").trim();
                }
                const isSelected = form.employeeCodes.includes(empId);
                const cleanNameForInitials = empName.includes("-")
                  ? empName.split("-").slice(1).join("-").trim()
                  : empName;
                const initials = (cleanNameForInitials.charAt(0) || "?").toUpperCase();

                return (
                  <div
                    key={index}
                    className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleEmployeeSelection(empId)}
                  >
                    <div className={`dr-avatar grad-${(parseInt(empId) % 5) || 0}`}>
                      {initials}
                    </div>
                    <div className="dr-info">
                      <span className="dr-name">{empName}</span>
                      <span className="dr-id">ID: {empId}</span>
                    </div>
                    {isSelected && <IonIcon icon={checkmarkCircle} className="dr-check" />}
                  </div>
                );
              })}
              {filteredEmployees.length === 0 && (
                <div className="dr-no-results">
                  <p>No matches for "{empSearchTerm}"</p>
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}

      <IonToast
        isOpen={toast.open}
        message={toast.message}
        duration={2500}
        color={toast.color as any}
        position="top"
        onDidDismiss={() => setToast({ ...toast, open: false })}
      />
    </IonPage>
  );
}

export default PenaltyAssignment;