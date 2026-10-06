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
import {
  ChevronLeft,
  Video,
  Image as ImageIcon,
  FileText,
  X,
  Play
} from "lucide-react";

import "./WorkReports.css";
import "./RequestsPage.css";
import "./Stock.css";
import "./PenaltyAssignment.css";
import "./WorkReportDashboard.css";
import { useHistory, useLocation } from "react-router-dom";

function PenaltyAssignment() {
  const history = useHistory();
  const location = useLocation<{ preselectedEmpCode?: string }>();

  const [employees, setEmployees] = useState<any[]>([]);
  const [penalties, setPenalties] = useState<any[]>([]);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUserCode = user.empCode || user.EMPCODE || "Admin";

  const [form, setForm] = useState({
    penaltyId: "",
    penaltyDate: "",
    violationTime: "",
    employeeCodes: (location.state?.preselectedEmpCode ? [location.state.preselectedEmpCode] : []) as string[],
    remarks: "",
    appliedBy: currentUserCode
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

  useEffect(() => {
    if (location.state?.preselectedEmpCode) {
      setForm((prev) => ({
        ...prev,
        employeeCodes: [location.state.preselectedEmpCode!]
      }));
    }
  }, [location.state]);

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
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}Penalty/GetPenaltyMaster`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setPenalties(response.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // File type detectors
  const isVideoFile = (file: File | null) => {
    if (!file) return false;
    return file.type.startsWith("video/") || /\.(mp4|mov|avi|mkv|webm|3gp|flv|wmv|m4v|ts|ogv)$/i.test(file.name);
  };

  const isImageFile = (file: File | null) => {
    if (!file) return false;
    return file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(file.name);
  };

  const isPdfFile = (file: File | null) => {
    if (!file) return false;
    return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
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

      const token = localStorage.getItem("token");
      const data = new FormData();
      data.append("PenaltyId", form.penaltyId);
      data.append("PenaltyDate", form.penaltyDate);
      data.append("ViolationTime", form.violationTime);
      data.append("Remarks", form.remarks);
      data.append("AppliedBy", form.appliedBy || currentUserCode);

      form.employeeCodes.forEach((emp) => {
        data.append("EmployeeCodes", emp);
      });

      if (proofFile) {
        data.append("ProofFile", proofFile);
      }

      await axios.post(`${API_BASE}Penalty/ApplyPenalty`, data, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`
        }
      });

      setToast({
        open: true,
        message: "Penalty Applied Successfully! Record has been created.",
        color: "success"
      });

      alert("Penalty Applied Successfully! Record has been created.");

      setForm({
        penaltyId: "",
        penaltyDate: "",
        violationTime: "",
        employeeCodes: [],
        remarks: "",
        appliedBy: currentUserCode
      });
      setProofFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.response?.data?.message || err?.message || "Error Applying Penalty";
      setToast({
        open: true,
        message: errMsg,
        color: "danger"
      });
      alert(errMsg);
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', margin: '0 16px 16px 16px', flexWrap: 'wrap' }}>
            <button 
              className="stock-button stock-button--secondary" 
              onClick={() => history.push("/penalty-list")}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '14px', fontSize: '13px', fontWeight: '700' }}
            >
              <IonIcon icon={warningOutline} style={{ fontSize: '18px' }} />
              Penalty Records & List
            </button>
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

              {/* Right Column: Violation Proof (All video, image, and document types) */}
              <div className="stock-field">
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Violation Proof</span>
                  <span style={{ fontSize: '11px', color: 'var(--stock-primary)', fontWeight: '700' }}>
                    Videos • Images • PDFs • All Types
                  </span>
                </label>
                <div style={{ padding: '16px', border: '2px dashed var(--stock-border)', borderRadius: 'var(--stock-radius-lg)', backgroundColor: 'var(--stock-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '120px', gap: '8px' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.mp4,.mov,.avi,.mkv,.webm,.3gp,.flv,.wmv,.m4v,.ts,.ogv"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    style={{ width: '100%', fontSize: '13px' }}
                  />
                  {!proofFile && (
                    <div style={{ textAlign: 'center', marginTop: '4px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--stock-text)', marginBottom: '4px' }}>
                        Upload Video, Image, or PDF Evidence
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--stock-muted)', display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>🎥 Video: MP4, MOV, MKV, WebM, AVI, 3GP, etc.</span>
                        <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>📷 Images: PNG, JPG, WebP</span>
                        <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>📄 PDF & Docs</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Video Preview */}
                {proofFile && isVideoFile(proofFile) && (
                  <div style={{ marginTop: '16px', borderRadius: 'var(--stock-radius-lg)', overflow: 'hidden', border: '1px solid var(--stock-border)', background: '#0b0f19', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '8px 12px', background: 'rgba(30, 41, 59, 0.9)', color: '#ffffff', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
                        <Video size={15} style={{ color: '#818cf8' }} />
                        {proofFile.name} ({(proofFile.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setProofFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <X size={14} /> Remove
                      </button>
                    </div>
                    <div style={{ padding: '10px', display: 'flex', justifyContent: 'center', background: '#000' }}>
                      <video
                        controls
                        playsInline
                        preload="metadata"
                        src={URL.createObjectURL(proofFile)}
                        style={{ width: '100%', maxHeight: '240px', borderRadius: '8px' }}
                      />
                    </div>
                    <div style={{ padding: '6px 12px', fontSize: '11px', color: '#94a3b8', background: '#0f172a' }}>
                      ✓ Video file ready for upload. You can preview playback above.
                    </div>
                  </div>
                )}

                {/* Image Preview */}
                {proofFile && isImageFile(proofFile) && (
                  <div style={{ marginTop: '16px', borderRadius: 'var(--stock-radius-lg)', overflow: 'hidden', border: '1px solid var(--stock-border)', background: '#0b0f19', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '8px 12px', background: 'rgba(30, 41, 59, 0.9)', color: '#ffffff', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
                        <ImageIcon size={15} style={{ color: '#34d399' }} />
                        {proofFile.name} ({(proofFile.size / 1024).toFixed(1)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setProofFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <X size={14} /> Remove
                      </button>
                    </div>
                    <div style={{ padding: '10px', display: 'flex', justifyContent: 'center', background: '#000' }}>
                      <img
                        src={URL.createObjectURL(proofFile)}
                        alt="Proof"
                        style={{ maxWidth: '100%', maxHeight: '220px', objectFit: 'contain', borderRadius: '8px' }}
                      />
                    </div>
                  </div>
                )}

                {/* PDF Document Preview */}
                {proofFile && isPdfFile(proofFile) && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--stock-surface)', borderRadius: 'var(--stock-radius-lg)', marginTop: '16px', border: '1px solid var(--stock-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                      <IonIcon icon={documentTextOutline} style={{ fontSize: '24px', color: 'var(--stock-primary)', flexShrink: 0 }} />
                      <div style={{ overflow: 'hidden' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--stock-text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proofFile.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--stock-muted)' }}>PDF Document • {(proofFile.size / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProofFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--stock-danger)', cursor: 'pointer', padding: '4px' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {/* Other File Preview */}
                {proofFile && !isVideoFile(proofFile) && !isImageFile(proofFile) && !isPdfFile(proofFile) && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--stock-surface)', borderRadius: 'var(--stock-radius-lg)', marginTop: '16px', border: '1px solid var(--stock-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                      <FileText size={22} style={{ color: 'var(--stock-primary)', flexShrink: 0 }} />
                      <div style={{ overflow: 'hidden' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--stock-text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proofFile.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--stock-muted)' }}>Attached File • {(proofFile.size / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProofFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--stock-danger)', cursor: 'pointer', padding: '4px' }}
                    >
                      <X size={16} />
                    </button>
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