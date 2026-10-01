import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";

import "./EmployeePenalties.css";
import "./PenaltyDashboard.css";
import { IonPage, IonContent, IonIcon } from "@ionic/react";
import {
    ChevronLeft,
    Eye,
    X,
    ExternalLink,
    Calendar,
    Clock,
    User,
    ShieldAlert,
    AlertTriangle,
    FileText,
    CheckCircle,
    Paperclip,
    Bot,
    UserCheck,
    Image as ImageIcon,
    Video
} from "lucide-react";
import { warningOutline, documentTextOutline } from "ionicons/icons";
import { useHistory } from "react-router-dom";

export interface ViolationItem {
    Id?: number;
    EmpCode?: string;
    PenaltyId?: number;
    PenaltyType: string;
    PenaltyDate?: string;
    ViolationTime?: any;
    Remarks?: string;
    SlipType: string;
    SlipCount: number;
    Status?: string;
    AppliedBy?: string;
    AppliedDate?: string;
    ProofFileName?: string;
    ProofFilePath?: any;
    ProofFileType?: string;
    raw?: any;
}

export interface PenaltyDashboardData {
    summary: any[];
    violations: ViolationItem[];
    escalation: any[];
}

function EmployeePenalties() {
    const history = useHistory();
    const [userData, setUserData] = useState<any>(null);
    const [data, setData] = useState<PenaltyDashboardData>({
        summary: [],
        violations: [],
        escalation: []
    });
    const [loading, setLoading] = useState(true);

    // Selected violation for the detail modal
    const [selectedViolation, setSelectedViolation] = useState<ViolationItem | null>(null);
    const [imageError, setImageError] = useState(false);

    //----------------------------------------
    // HELPER: Format Incident Time
    //----------------------------------------
    const formatViolationTime = (time: any): string | null => {
        if (!time || typeof time !== "string" || time.trim() === "" || time.trim() === "{}") {
            return null;
        }
        try {
            if (time.includes("T")) {
                const d = new Date(time);
                if (!isNaN(d.getTime())) {
                    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
                }
            }
            return time;
        } catch {
            return time;
        }
    };

    //----------------------------------------
    // HELPER: Format Incident / Penalty Date
    //----------------------------------------
    const formatViolationDate = (dateStr: any): string => {
        if (!dateStr || typeof dateStr !== "string" || dateStr.trim() === "{}") return "—";
        try {
            if (dateStr.includes("T")) {
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                }
            }
            if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr.trim())) {
                const [day, month, year] = dateStr.trim().split("-");
                const d = new Date(Number(year), Number(month) - 1, Number(day));
                if (!isNaN(d.getTime())) {
                    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                }
            }
            return dateStr;
        } catch {
            return dateStr;
        }
    };

    //----------------------------------------
    // HELPER: Format Detailed Timestamp
    //----------------------------------------
    const formatDateTime = (dateTimeStr: any): string => {
        if (!dateTimeStr || typeof dateTimeStr !== "string" || dateTimeStr.trim() === "{}") return "—";
        try {
            const d = new Date(dateTimeStr);
            if (!isNaN(d.getTime())) {
                return (
                    d.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                    }) + " at " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
                );
            }
            return dateTimeStr;
        } catch {
            return dateTimeStr;
        }
    };

    //----------------------------------------
    // HELPER: Robust Proof URL Resolution
    //----------------------------------------
    const getProofUrl = (path: any): string => {
        if (!path) return "";
        let clean = "";
        if (typeof path === "string") {
            clean = path.trim();
        } else if (typeof path === "object") {
            clean = (path.filePath || path.url || path.ProofFilePath || path.fileName || path.path || "").toString().trim();
        }

        if (!clean || clean.includes("[object Object]") || clean.includes("[object%20Object]")) {
            return "";
        }

        if (clean.startsWith("http://") || clean.startsWith("https://")) {
            return clean;
        }

        const base = API_BASE.replace("api/", "");
        const normalized = clean.startsWith("/") ? clean.slice(1) : clean;
        return `${base}${normalized}`;
    };

    //----------------------------------------
    // HELPER: Video / Image Type Detectors
    //----------------------------------------
    const isVideoProof = (path: any, type?: string, fileName?: string): boolean => {
        const str = String(path || "").toLowerCase();
        const typeStr = String(type || "").toLowerCase();
        const nameStr = String(fileName || "").toLowerCase();
        return (
            typeStr.startsWith("video/") ||
            /\.(mp4|mov|avi|mkv|webm|3gp|flv|wmv|m4v|ts|ogv)(\?.*)?$/i.test(str) ||
            /\.(mp4|mov|avi|mkv|webm|3gp|flv|wmv|m4v|ts|ogv)$/i.test(nameStr)
        );
    };

    const isImageProof = (path: any, type?: string, fileName?: string): boolean => {
        const str = String(path || "").toLowerCase();
        const typeStr = String(type || "").toLowerCase();
        const nameStr = String(fileName || "").toLowerCase();
        return (
            typeStr.startsWith("image/") ||
            /\.(jpe?g|png|webp|gif|bmp|svg)(\?.*)?$/i.test(str) ||
            /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(nameStr)
        );
    };

    //----------------------------------------
    // LOAD USER FROM LOCAL STORAGE
    //----------------------------------------
    useEffect(() => {
        console.group("🚀 [EmployeePenalties] Page Initialization");
        const storedUser = localStorage.getItem("user");
        console.log("📂 Raw user from localStorage:", storedUser);

        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                setUserData(parsed);
                console.log("👤 Parsed User Profile:", parsed);

                const empCode =
                    parsed.empCode ||
                    parsed.EMPCODE ||
                    parsed.EmpCode ||
                    parsed.emp_code ||
                    parsed.userName ||
                    parsed.username;

                console.log("🔑 Extracted Employee Code for penalties:", empCode);

                if (empCode) {
                    loadData(String(empCode));
                } else {
                    console.warn("⚠️ No valid Employee Code found in user profile.");
                    setLoading(false);
                }
            } catch (err) {
                console.error("❌ Failed to parse stored user from localStorage:", err);
                setLoading(false);
            }
        } else {
            console.warn("⚠️ No user object found in localStorage.");
            setLoading(false);
        }
        console.groupEnd();
    }, []);

    //----------------------------------------
    // LOAD EMPLOYEE PENALTIES WITH FULL DETAILS
    //----------------------------------------
    const loadData = async (empCode: string) => {
        setLoading(true);
        console.group(`📡 [EmployeePenalties] Fetching Penalty Records for Employee #${empCode}`);
        try {
            const token = localStorage.getItem("token");
            const headers = { Authorization: `Bearer ${token}` };

            const dashboardUrl = `${API_BASE}Penalty/GetEmployeePenaltyDashboard/${empCode}`;
            const detailsUrl = `${API_BASE}Penalty/GetEmployeePenaltyDetails/${empCode}`;
            const masterUrl = `${API_BASE}Penalty/GetPenaltyMaster`;

            console.log("🌐 Calling API 1 (Dashboard Summary):", dashboardUrl);
            console.log("🌐 Calling API 2 (Detailed Violations):", detailsUrl);
            console.log("🌐 Calling API 3 (Penalty Master Rules):", masterUrl);

            // Fetch in parallel for instant load time
            const [dashboardRes, detailsRes, masterRes] = await Promise.allSettled([
                axios.get(dashboardUrl, { headers }),
                axios.get(detailsUrl, { headers }),
                axios.get(masterUrl, { headers })
            ]);

            let summaryData: any[] = [];
            let dashboardViolations: any[] = [];
            let escalationData: any[] = [];
            let detailsViolations: any[] = [];
            let masterItems: any[] = [];

            // Process Dashboard API
            if (dashboardRes.status === "fulfilled" && dashboardRes.value?.data) {
                const dData = dashboardRes.value.data;
                console.log("✅ [API 1: Dashboard] Response:", dData);
                summaryData = dData.summary || [];
                dashboardViolations = dData.violations || [];
                escalationData = dData.escalation || [];
            } else if (dashboardRes.status === "rejected") {
                console.error("❌ [API 1: Dashboard] Request Failed:", dashboardRes.reason);
            }

            // Process Details API
            if (detailsRes.status === "fulfilled" && detailsRes.value?.data) {
                console.log("✅ [API 2: Details] Response:", detailsRes.value.data);
                detailsViolations = Array.isArray(detailsRes.value.data) ? detailsRes.value.data : [];
            } else if (detailsRes.status === "rejected") {
                console.warn("⚠️ [API 2: Details] Request Failed / Not available:", detailsRes.reason);
            }

            // Process Master API
            if (masterRes.status === "fulfilled" && masterRes.value?.data) {
                console.log("✅ [API 3: Master Rules] Response:", masterRes.value.data);
                masterItems = Array.isArray(masterRes.value.data) ? masterRes.value.data : [];
            }

            // Build Penalty ID -> Rule Map
            const masterMap: { [id: number]: any } = {};
            masterItems.forEach((m: any) => {
                const id = Number(m.id !== undefined ? m.id : m.Id);
                if (id) {
                    masterMap[id] = m;
                }
            });

            // Merge details & dashboard violations so ALL fields are available
            let combinedViolations: ViolationItem[] = [];

            if (detailsViolations.length > 0) {
                combinedViolations = detailsViolations.map((item: any, idx: number) => {
                    const rule = item.PenaltyId ? masterMap[item.PenaltyId] : null;
                    const matchedFromDashboard = dashboardViolations.find((dv: any) => {
                        return (
                            (dv.Remarks && item.Remarks && dv.Remarks.trim() === item.Remarks.trim()) ||
                            dv.AppliedDate === item.AppliedDate?.slice(0, 10) ||
                            dv.AppliedDate === formatViolationDate(item.PenaltyDate)
                        );
                    }) || dashboardViolations[idx];

                    const resolvedPenaltyType =
                        item.PenaltyType ||
                        rule?.penaltyType ||
                        rule?.PenaltyType ||
                        matchedFromDashboard?.PenaltyType ||
                        "Policy Violation";

                    return {
                        Id: item.Id,
                        EmpCode: item.EmpCode || empCode,
                        PenaltyId: item.PenaltyId,
                        PenaltyType: resolvedPenaltyType,
                        PenaltyDate: item.PenaltyDate,
                        ViolationTime: item.ViolationTime,
                        Remarks: item.Remarks || matchedFromDashboard?.Remarks || "",
                        SlipType: item.SlipType || matchedFromDashboard?.SlipType || "Yellow Slip",
                        SlipCount: item.SlipCount ?? matchedFromDashboard?.SlipCount ?? 1,
                        Status: item.Status || "Applied",
                        AppliedBy: item.AppliedBy || matchedFromDashboard?.AppliedBy || "System",
                        AppliedDate: item.AppliedDate || matchedFromDashboard?.AppliedDate || item.PenaltyDate,
                        ProofFileName: typeof item.ProofFileName === "string" ? item.ProofFileName : "",
                        ProofFilePath: item.ProofFilePath,
                        ProofFileType: typeof item.ProofFileType === "string" ? item.ProofFileType : "",
                        raw: item
                    };
                });
            } else {
                combinedViolations = dashboardViolations.map((item: any, idx: number) => ({
                    Id: item.Id || idx + 1,
                    EmpCode: empCode,
                    PenaltyType: item.PenaltyType || "Policy Violation",
                    SlipType: item.SlipType || "Yellow Slip",
                    SlipCount: item.SlipCount ?? 1,
                    Remarks: item.Remarks || "",
                    AppliedDate: item.AppliedDate || "",
                    Status: item.Status || "Applied",
                    AppliedBy: item.AppliedBy || "System",
                    raw: item
                }));
            }

            console.log("📊 Summary Extracted:", summaryData);
            console.log("🚨 Escalation Extracted:", escalationData);
            console.log(`📋 Total Violations Processed: ${combinedViolations.length}`);
            console.table(
                combinedViolations.map((v) => ({
                    ID: v.Id,
                    Penalty: v.PenaltyType,
                    Slip: v.SlipType,
                    Count: v.SlipCount,
                    Date: v.AppliedDate || v.PenaltyDate,
                    Time: typeof v.ViolationTime === "string" ? v.ViolationTime : "—",
                    AppliedBy: v.AppliedBy,
                    Remarks: v.Remarks ? v.Remarks.slice(0, 35) + "..." : "",
                    Proof: v.ProofFilePath ? "Yes" : "No"
                }))
            );

            setData({
                summary: summaryData,
                violations: combinedViolations,
                escalation: escalationData
            });
        } catch (error) {
            console.error("❌ [EmployeePenalties] Error loading penalty data:", error);
        } finally {
            setLoading(false);
            console.groupEnd();
        }
    };

    //----------------------------------------
    // ON CLICK VIEW VIOLATION DETAILS
    //----------------------------------------
    const handleViewViolation = (violation: ViolationItem, index: number) => {
        setImageError(false);
        setSelectedViolation(violation);
        const proofUrl = getProofUrl(violation.ProofFilePath);

        console.group(`🔍 [EmployeePenalties] Selected Violation Details #${violation.Id || index + 1}`);
        console.log("📋 Slip ID:", violation.Id);
        console.log("⚖️ Penalty Rule ID:", violation.PenaltyId);
        console.log("🏷️ Penalty Type:", violation.PenaltyType);
        console.log("🟨 Slip Type:", violation.SlipType, "| Count:", violation.SlipCount);
        console.log("🟢 Status:", violation.Status);
        console.log("📅 Incident Date:", violation.PenaltyDate || violation.AppliedDate);
        console.log("⏰ Violation Time:", violation.ViolationTime);
        console.log("✍️ Applied / Logged Date:", violation.AppliedDate);
        console.log("👤 Applied By:", violation.AppliedBy);
        console.log("💬 Remarks:", violation.Remarks);
        console.log("📎 Proof File Name:", violation.ProofFileName);
        console.log("📁 Proof File Path:", violation.ProofFilePath);
        console.log("🌐 Resolved Proof URL:", proofUrl || "No Proof Attached");
        console.log("📦 Full Violation Object:", violation);
        console.groupEnd();
    };

    const handleCloseModal = () => {
        console.log("✖️ [EmployeePenalties] Closed Violation Details Modal");
        setSelectedViolation(null);
    };

    //----------------------------------------
    // LOADING STATE
    //----------------------------------------
    if (loading) {
        return (
            <div className="loading-box" style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#334155" }}>Loading Penalties & Violations...</div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>Fetching employee penalty summary and detailed violation history</div>
            </div>
        );
    }

    const emp = data.summary?.[0] || {};
    const esc = data.escalation?.[0] || {};

    // Profile Details
    const empName = emp.EMPNAME || userData?.empName || userData?.EMPNAME || userData?.userName || "HARISH PAMPANA";
    const empCode = emp.EMPCODE || userData?.empCode || userData?.EMPCODE || "1589";
    const designation = userData?.designation || userData?.DESIGNATION || userData?.role || "Developer";

    return (
        <IonPage>
            <IonContent className="page-content">
                <div className="wr-container stock-container" style={{ padding: 0, minHeight: "auto", backgroundColor: "transparent" }}>
                    
                    {/* ── Premium Page Header ── */}
                    <div className="page-wr-header" style={{ margin: "16px", borderRadius: "16px", padding: "16px" }}>
                        <div className="page-wr-header-left">
                            <button className="page-wr-back-btn" onClick={() => history.goBack()} title="Go Back">
                                <ChevronLeft size={22} color="white" />
                            </button>
                            <div>
                                <h1 className="page-wr-title">My Penalties</h1>
                                <p className="page-wr-subtitle">View your penalty dashboard and history</p>
                            </div>
                        </div>
                        <div className="page-wr-header-right">
                            <div className="page-wr-header-icon-box">
                                <IonIcon icon={warningOutline} style={{ color: "var(--ion-color-primary)", fontSize: "24px" }} />
                            </div>
                        </div>
                    </div>

                    {/* Action Bar */}
                    <div style={{ display: "flex", justifyContent: "flex-end", margin: "0 16px 16px 16px" }}>
                        <button
                            className="stock-button stock-button--secondary"
                            onClick={() => history.push("/violation-report")}
                            style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "14px", fontSize: "13px", fontWeight: "700" }}
                        >
                            <IonIcon icon={documentTextOutline} style={{ fontSize: "18px" }} />
                            Transfer Slip
                        </button>
                    </div>

                    <div className="stock-panel" style={{ margin: "0 16px 20px 16px" }}>
                        
                        {/* ── EMPLOYEE PROFILE CARD ── */}
                        <div className="ep-profile-card">
                            <div className="ep-profile-left">
                                <div className="ep-profile-avatar">
                                    {empName ? empName.charAt(0).toUpperCase() : "E"}
                                </div>
                                <div className="ep-profile-info">
                                    <span className="ep-profile-tag">Profile</span>
                                    <h2 className="ep-profile-name">{empName}</h2>
                                    <div className="ep-profile-sub">
                                        <span className="ep-profile-designation">{designation}</span>
                                        <span>•</span>
                                        <span className="ep-profile-code-badge">Employee • {empCode}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="ep-profile-status-badge">
                                <div className={`ep-escalation-pill ${
                                    esc.EscalationStatus === "Disciplinary Review"
                                        ? "danger"
                                        : esc.EscalationStatus === "Manager Escalation"
                                        ? "orange"
                                        : esc.EscalationStatus === "HR Warning"
                                        ? "warning"
                                        : "safe"
                                }`} style={{ padding: "8px 14px", borderRadius: "10px", boxShadow: "none" }}>
                                    <div className="ep-esc-ring" style={{ width: "12px", height: "12px" }}></div>
                                    <span style={{ fontSize: "12px", fontWeight: "800" }}>{esc.EscalationStatus || "Normal Status"}</span>
                                </div>
                            </div>
                        </div>

                        {/* ── BENTO SUMMARY GRID ── */}
                        <div className="ep-summary-bento">
                            <div className="ep-bento-box green">
                                <div className="ep-bento-label">Green Slips</div>
                                <div className="ep-bento-value">{emp.TotalGreenSlips || 0}</div>
                            </div>
                            <div className="ep-bento-box yellow">
                                <div className="ep-bento-label">Yellow Slips</div>
                                <div className="ep-bento-value">{emp.TotalYellowSlips || 0}</div>
                            </div>
                            <div className="ep-bento-box orange">
                                <div className="ep-bento-label">Orange Slips</div>
                                <div className="ep-bento-value">{emp.TotalOrangeSlips || 0}</div>
                            </div>
                            <div className="ep-bento-box red">
                                <div className="ep-bento-label">Red Slips</div>
                                <div className="ep-bento-value">{emp.TotalRedSlips || 0}</div>
                            </div>
                            <div className="ep-bento-box score">
                                <div className="ep-bento-label">Performance Score</div>
                                <div className="ep-bento-value">
                                    {Number(emp.TotalPerformanceScore || 0).toFixed(2)}
                                </div>
                            </div>
                        </div>

                        {/* ── VIOLATION HISTORY SECTION ── */}
                        <div className="dashboard-section">
                            <h2>
                                <span>Violation History</span>
                                <span className="ep-section-count-badge">
                                    {data.violations.length} {data.violations.length === 1 ? "Record" : "Records"}
                                </span>
                            </h2>

                            <div className="ep-history-list">
                                {data.violations.length > 0 ? (
                                    data.violations.map((item: ViolationItem, index: number) => {
                                        const violationTimeStr = formatViolationTime(item.ViolationTime);
                                        const formattedDate = formatViolationDate(item.PenaltyDate || item.AppliedDate);
                                        const hasProof = !!item.ProofFilePath && String(item.ProofFilePath).trim() !== "" && String(item.ProofFilePath).trim() !== "{}";
                                        const isAiEngine = String(item.AppliedBy || "").toLowerCase().includes("ai") || String(item.AppliedBy || "").toLowerCase().includes("automatic");
                                        const hasVideoProof = hasProof && isVideoProof(item.ProofFilePath, item.ProofFileType, item.ProofFileName);

                                        return (
                                            <div key={item.Id || index} className="ep-history-card">
                                                {/* Card Header */}
                                                <div className="ep-card-header">
                                                    <div className="ep-card-header-left">
                                                        {item.Id && <span className="ep-card-id-tag">#{item.Id}</span>}
                                                        <span className="ep-date">
                                                            <Calendar size={13} style={{ color: "#64748b" }} />
                                                            {formattedDate}
                                                        </span>
                                                    </div>
                                                    <div className="ep-card-header-right">
                                                        <span className={`ep-slip-badge ${item.SlipType?.toLowerCase().replace(/\s+/g, "-")}`}>
                                                            {item.SlipType}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Card Body Details Grid */}
                                                <div className="ep-card-grid">
                                                    <div className="ep-info-row">
                                                        <label>Penalty</label>
                                                        <span>{item.PenaltyType}</span>
                                                    </div>
                                                    <div className="ep-info-row">
                                                        <label>Count</label>
                                                        <span>{item.SlipCount}</span>
                                                    </div>
                                                    <div className="ep-info-row">
                                                        <label>Status</label>
                                                        <span style={{ color: "#047857" }}>{item.Status || "Applied"}</span>
                                                    </div>
                                                    {violationTimeStr && (
                                                        <div className="ep-info-row">
                                                            <label>Time</label>
                                                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                                <Clock size={12} style={{ color: "#64748b" }} />
                                                                {violationTimeStr}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="ep-info-row">
                                                        <label>Applied By</label>
                                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                            {isAiEngine ? (
                                                                <>
                                                                    <Bot size={12} style={{ color: "#6366f1" }} />
                                                                    <span>AI Engine</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <User size={12} style={{ color: "#64748b" }} />
                                                                    <span>{item.AppliedBy || "System"}</span>
                                                                </>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Remarks Box */}
                                                {item.Remarks && (
                                                    <div className="ep-card-footer">
                                                        <p>{item.Remarks}</p>
                                                    </div>
                                                )}

                                                {/* Footer Action Bar with View Button */}
                                                <div className="ep-card-footer-box">
                                                    <div className="ep-card-tags">
                                                        <span className="ep-tag-status">
                                                            <CheckCircle size={11} style={{ display: "inline", marginRight: "3px" }} />
                                                            {item.Status || "Applied"}
                                                        </span>
                                                        {hasProof && (
                                                            <span className={`ep-evidence-chip ${hasVideoProof ? 'video' : ''}`}>
                                                                {hasVideoProof ? (
                                                                    <>
                                                                        <Video size={12} />
                                                                        Video Evidence
                                                                    </>
                                                                ) : isImageProof(item.ProofFilePath, item.ProofFileType, item.ProofFileName) ? (
                                                                    <>
                                                                        <ImageIcon size={12} />
                                                                        Image Evidence
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Paperclip size={12} />
                                                                        Evidence Attached
                                                                    </>
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        className="ep-view-btn"
                                                        onClick={() => handleViewViolation(item, index)}
                                                        title="View full violation details and proof"
                                                    >
                                                        <Eye size={15} />
                                                        View Details
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="ep-empty-state">
                                        <CheckCircle size={32} style={{ color: "#10b981", margin: "0 auto 8px" }} />
                                        <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: "700", color: "#1e293b" }}>
                                            No Penalties Found
                                        </p>
                                        <span style={{ fontSize: "12px", color: "#64748b" }}>
                                            You currently have no penalty slips or policy violations recorded.
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── ESCALATION SECTION ── */}
                        <div className="ep-escalation-section">
                            <h2>Current Escalation Status</h2>
                            <div
                                className={`ep-escalation-pill ${
                                    esc.EscalationStatus === "Disciplinary Review"
                                        ? "danger"
                                        : esc.EscalationStatus === "Manager Escalation"
                                        ? "orange"
                                        : esc.EscalationStatus === "HR Warning"
                                        ? "warning"
                                        : "safe"
                                }`}
                            >
                                <div className="ep-esc-ring"></div>
                                <span>{esc.EscalationStatus || "Normal"}</span>
                            </div>
                        </div>

                    </div>
                </div>

                {/* ══════════════════════════════════════════════
                   VIOLATION DETAILS MODAL
                   ══════════════════════════════════════════════ */}
                {selectedViolation && (
                    <div className="ep-modal-backdrop" onClick={handleCloseModal}>
                        <div
                            className="ep-modal-container"
                            onClick={(e) => e.stopPropagation()}
                            role="dialog"
                            aria-modal="true"
                        >
                            {/* Modal Header */}
                            <div className="ep-modal-header">
                                <div className="ep-modal-header-left">
                                    <ShieldAlert size={20} style={{ color: "#f59e0b" }} />
                                    <h3 className="ep-modal-title">
                                        Violation Details {selectedViolation.Id ? `#${selectedViolation.Id}` : ""}
                                    </h3>
                                    <span
                                        className={`ep-slip-badge ${selectedViolation.SlipType?.toLowerCase().replace(/\s+/g, "-")}`}
                                    >
                                        {selectedViolation.SlipType}
                                    </span>
                                </div>
                                <button className="ep-modal-close-btn" onClick={handleCloseModal} title="Close Modal">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="ep-modal-body">
                                {/* Employee Info Strip */}
                                <div className="ep-modal-emp-bar">
                                    <div className="ep-modal-emp-info">
                                        <User size={16} style={{ color: "#4f46e5" }} />
                                        <div>
                                            <div className="ep-modal-emp-name">{empName}</div>
                                            <div className="ep-modal-emp-sub">
                                                {designation} • Employee #{empCode}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="ep-tag-status">
                                        {selectedViolation.Status || "Applied"}
                                    </span>
                                </div>

                                {/* Detailed Fields Grid */}
                                <div className="ep-modal-grid-details">
                                    <div className="ep-modal-field full">
                                        <label>Penalty Type / Rule</label>
                                        <span style={{ fontSize: "15px", color: "#0f172a" }}>
                                            {selectedViolation.PenaltyType}
                                        </span>
                                    </div>

                                    <div className="ep-modal-field">
                                        <label>Slip Category</label>
                                        <span>{selectedViolation.SlipType}</span>
                                    </div>

                                    <div className="ep-modal-field">
                                        <label>Slip Count</label>
                                        <span>{selectedViolation.SlipCount}</span>
                                    </div>

                                    <div className="ep-modal-field">
                                        <label>Date of Incident</label>
                                        <span>
                                            {formatViolationDate(selectedViolation.PenaltyDate || selectedViolation.AppliedDate)}
                                        </span>
                                    </div>

                                    <div className="ep-modal-field">
                                        <label>Incident Time</label>
                                        <span>
                                            {formatViolationTime(selectedViolation.ViolationTime) || "Not Specified / Automated"}
                                        </span>
                                    </div>

                                    <div className="ep-modal-field full">
                                        <label>Recorded / Applied Timestamp</label>
                                        <span>{formatDateTime(selectedViolation.AppliedDate)}</span>
                                    </div>

                                    <div className="ep-modal-field full">
                                        <label>Issued / Applied By</label>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                            {String(selectedViolation.AppliedBy || "").toLowerCase().includes("ai") ||
                                            String(selectedViolation.AppliedBy || "").toLowerCase().includes("automatic") ? (
                                                <>
                                                    <Bot size={15} style={{ color: "#6366f1" }} />
                                                    <strong>Automated AI Attendance Policy Engine</strong>
                                                </>
                                            ) : (
                                                <>
                                                    <UserCheck size={15} style={{ color: "#059669" }} />
                                                    <span>Supervisor / Administrator (ID: {selectedViolation.AppliedBy || "System"})</span>
                                                </>
                                            )}
                                        </span>
                                    </div>

                                    {selectedViolation.PenaltyId && (
                                        <div className="ep-modal-field">
                                            <label>Penalty Rule ID</label>
                                            <span>Rule #{selectedViolation.PenaltyId}</span>
                                        </div>
                                    )}

                                    <div className="ep-modal-field">
                                        <label>Record Status</label>
                                        <span style={{ color: "#047857" }}>{selectedViolation.Status || "Applied"}</span>
                                    </div>
                                </div>

                                {/* Official Remarks Box */}
                                <div className="ep-modal-remarks-box">
                                    <label>Official Remarks / Violation Reason</label>
                                    <p>{selectedViolation.Remarks || "No specific remarks provided."}</p>
                                </div>

                                {/* Evidence & Proof Section (Video, Image, PDF, etc.) */}
                                <div className="ep-modal-evidence-section">
                                    <div className="ep-modal-evidence-header">
                                        <div className="ep-modal-evidence-title">
                                            <Paperclip size={14} />
                                            Evidence & Supporting Documents
                                        </div>
                                    </div>

                                    {selectedViolation.ProofFilePath &&
                                    String(selectedViolation.ProofFilePath).trim() !== "" &&
                                    String(selectedViolation.ProofFilePath).trim() !== "{}" ? (
                                        <div className="ep-modal-evidence-preview">
                                            {/* Preview video if video type */}
                                            {isVideoProof(selectedViolation.ProofFilePath, selectedViolation.ProofFileType, selectedViolation.ProofFileName) ? (
                                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                                    <video
                                                        controls
                                                        playsInline
                                                        preload="metadata"
                                                        src={getProofUrl(selectedViolation.ProofFilePath)}
                                                        className="ep-modal-evidence-video"
                                                    >
                                                        Your browser does not support HTML5 video playback.
                                                    </video>
                                                </div>
                                            ) : isImageProof(selectedViolation.ProofFilePath, selectedViolation.ProofFileType, selectedViolation.ProofFileName) && !imageError ? (
                                                <img
                                                    src={getProofUrl(selectedViolation.ProofFilePath)}
                                                    alt="Violation Proof"
                                                    className="ep-modal-evidence-img"
                                                    onError={() => {
                                                        console.warn("⚠️ Proof image failed to load from primary URL:", getProofUrl(selectedViolation.ProofFilePath));
                                                        setImageError(true);
                                                    }}
                                                />
                                            ) : (
                                                <div style={{ padding: "12px", background: "#f1f5f9", borderRadius: "8px", fontSize: "12px", color: "#475569" }}>
                                                    <ImageIcon size={16} style={{ display: "inline", marginRight: "6px" }} />
                                                    <strong>File Attachment:</strong> {selectedViolation.ProofFileName || "Attached Evidence File"}
                                                </div>
                                            )}

                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "6px" }}>
                                                <span style={{ fontSize: "11px", color: "#64748b" }}>
                                                    {selectedViolation.ProofFileName || "Evidence Attached"}
                                                </span>
                                                <a
                                                    href={getProofUrl(selectedViolation.ProofFilePath)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="ep-modal-evidence-link"
                                                >
                                                    <ExternalLink size={13} />
                                                    Open / Download File
                                                </a>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="ep-modal-no-evidence">
                                            <FileText size={15} style={{ color: "#94a3b8" }} />
                                            <span>
                                                {String(selectedViolation.AppliedBy || "").toLowerCase().includes("ai") ||
                                                String(selectedViolation.Remarks || "").toLowerCase().includes("automatic")
                                                    ? "System-generated policy violation (Logged automatically by Attendance & Policy Engine)."
                                                    : "No physical proof file attached to this record."}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="ep-modal-footer">
                                <button className="ep-btn-secondary" onClick={handleCloseModal}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </IonContent>
        </IonPage>
    );
}

export default EmployeePenalties;