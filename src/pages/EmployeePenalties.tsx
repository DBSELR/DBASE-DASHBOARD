import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";

import "./EmployeePenalties.css";
import "./PenaltyDashboard.css";
import { IonPage, IonContent, IonIcon, IonToast } from "@ionic/react";
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
    Video,
    ArrowRightLeft,
    Upload,
    Search,
    Send,
    Award,
    CheckCircle2,
    AlertCircle,
    History
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
    TransferStatus?: string;
    TransferredToEmpCode?: string;
    TransferredToEmpName?: string;
    TransferredFromEmpCode?: string;
    TransferredFromEmpName?: string;
    TransferRequestId?: number;
    IsExpired?: boolean;
    TransferRemarks?: string;
    TransferProofFileName?: string;
    TransferProofFilePath?: string;
    TransferProofFileType?: string;
    TransferRequestStatus?: string;
    TransferRequestedDate?: string;
    TransferReviewedBy?: string;
    TransferReviewedByName?: string;
    TransferReviewedDate?: string;
    TransferReviewRemarks?: string;
    EmpName?: string;
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
    const [transferImageError, setTransferImageError] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

    // Transfer Slip States & Handlers
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [slipToTransfer, setSlipToTransfer] = useState<ViolationItem | null>(null);
    const [allEmployees, setAllEmployees] = useState<any[]>([]);
    const [transferTargetEmp, setTransferTargetEmp] = useState("");
    const [transferViolationTime, setTransferViolationTime] = useState("");
    const [transferRemarks, setTransferRemarks] = useState("");
    const [transferProofFile, setTransferProofFile] = useState<File | null>(null);
    const [transferSubmitting, setTransferSubmitting] = useState(false);
    const [transferSearch, setTransferSearch] = useState("");
    const [transferDropdownOpen, setTransferDropdownOpen] = useState(false);
    const [toastState, setToastState] = useState<{ isOpen: boolean; message: string; color: "success" | "danger" | "warning" }>({
        isOpen: false,
        message: "",
        color: "success"
    });

    const showToast = (message: string, color: "success" | "danger" | "warning" = "success") => {
        setToastState({ isOpen: true, message, color });
    };

    const handleOpenTransferModal = async (violation: ViolationItem) => {
        if (violation.TransferStatus === "PendingTransfer") {
            showToast("This slip is already pending transfer review by HR!", "warning");
            return;
        }
        if (violation.TransferStatus === "Transferred" || violation.Status === "Transferred") {
            showToast("This slip has already been transferred.", "warning");
            return;
        }

        setSlipToTransfer(violation);
        setTransferTargetEmp("");
        const now = new Date();
        const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setTransferViolationTime(localIso);
        setTransferRemarks("");
        setTransferProofFile(null);
        setTransferSearch("");
        setTransferDropdownOpen(false);
        setTransferModalOpen(true);

        if (allEmployees.length === 0) {
            try {
                const res = await axios.get(`${API_BASE}Employee/Load_Employees`);
                setAllEmployees(res.data || []);
            } catch (e) {
                console.error("Failed to load employees for transfer:", e);
            }
        }
    };

    const handleCloseTransferModal = () => {
        if (transferSubmitting) return;
        setTransferModalOpen(false);
        setSlipToTransfer(null);
    };

    const handleSubmitTransfer = async () => {
        if (!slipToTransfer?.Id) {
            showToast("Invalid slip selected", "danger");
            return;
        }
        if (slipToTransfer.TransferStatus === "PendingTransfer") {
            showToast("This slip is already pending transfer review by HR!", "warning");
            setTransferModalOpen(false);
            return;
        }
        if (slipToTransfer.TransferStatus === "Transferred" || slipToTransfer.Status === "Transferred") {
            showToast("This slip has already been transferred.", "warning");
            setTransferModalOpen(false);
            return;
        }
        if (!transferTargetEmp) {
            showToast("Please select the employee who committed the violation", "warning");
            return;
        }

        const fromCode = String(
            slipToTransfer.EmpCode ||
            userData?.empCode ||
            userData?.EMPCODE ||
            userData?.EmpCode ||
            userData?.emp_code ||
            ""
        ).trim();

        if (transferTargetEmp.trim().toLowerCase() === fromCode.toLowerCase()) {
            showToast("You cannot transfer a slip to the same employee!", "warning");
            return;
        }
        if (!transferRemarks.trim()) {
            showToast("Please enter remarks explaining the violation committed by this employee", "warning");
            return;
        }

        setTransferSubmitting(true);
        try {
            const token = localStorage.getItem("token");
            const formData = new FormData();
            formData.append("PenaltyRecordId", slipToTransfer.Id.toString());
            formData.append("FromEmpCode", fromCode);
            formData.append("ToEmpCode", transferTargetEmp);
            formData.append("ViolationTime", transferViolationTime || new Date().toISOString());
            formData.append("Remarks", transferRemarks);
            if (transferProofFile) {
                formData.append("ProofFile", transferProofFile);
            }

            const res = await axios.post(`${API_BASE}Penalty/RequestSlipTransfer`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                    Authorization: `Bearer ${token}`
                }
            });

            if (res.data?.success) {
                showToast("Transfer request submitted successfully! Sent to HR for review.", "success");
                setTransferModalOpen(false);
                // Optimistically update local state so card shows PendingTransfer immediately
                setData((prev) => ({
                    ...prev,
                    violations: prev.violations.map((v) =>
                        v.Id === slipToTransfer.Id
                            ? { ...v, TransferStatus: "PendingTransfer" }
                            : v
                    )
                }));
                if (fromCode) {
                    loadData(fromCode);
                }
            } else {
                showToast(res.data?.message || "Failed to submit transfer request", "danger");
            }
        } catch (err: any) {
            console.error(err);
            const errMsg =
                err?.response?.data?.message ||
                err?.response?.data?.Message ||
                err?.response?.data ||
                err?.message ||
                "Error submitting transfer request";
            showToast(typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg), "danger");
        } finally {
            setTransferSubmitting(false);
        }
    };

    //----------------------------------------
    // HELPER: Convert Any Field Safely to String (Prevents Object-as-Child React Crashes)
    //----------------------------------------
    const toSafeString = (val: any, fallback = ""): string => {
        if (val === null || val === undefined) return fallback;
        if (typeof val === "string") {
            const trimmed = val.trim();
            return trimmed === "{}" ? fallback : trimmed;
        }
        if (typeof val === "number" || typeof val === "boolean") {
            return String(val);
        }
        return fallback;
    };

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

                    const resolvedPenaltyType = toSafeString(
                        item.PenaltyType ||
                        rule?.penaltyType ||
                        rule?.PenaltyType ||
                        matchedFromDashboard?.PenaltyType,
                        "Policy Violation"
                    );

                    return {
                        Id: item.Id,
                        EmpCode: toSafeString(item.EmpCode, empCode),
                        PenaltyId: item.PenaltyId,
                        PenaltyType: resolvedPenaltyType,
                        PenaltyDate: item.PenaltyDate,
                        ViolationTime: item.ViolationTime,
                        Remarks: toSafeString(item.Remarks, toSafeString(matchedFromDashboard?.Remarks, "")),
                        SlipType: toSafeString(item.SlipType, toSafeString(matchedFromDashboard?.SlipType, "Yellow Slip")),
                        SlipCount: Number(item.SlipCount) || Number(matchedFromDashboard?.SlipCount) || 1,
                        Status: toSafeString(item.Status, "Applied"),
                        AppliedBy: toSafeString(item.AppliedBy, toSafeString(matchedFromDashboard?.AppliedBy, "System")),
                        AppliedDate: item.AppliedDate || matchedFromDashboard?.AppliedDate || item.PenaltyDate,
                        ProofFileName: toSafeString(item.ProofFileName, ""),
                        ProofFilePath: item.ProofFilePath,
                        ProofFileType: toSafeString(item.ProofFileType, ""),
                        TransferStatus: toSafeString(item.TransferStatus, "None"),
                        TransferredToEmpCode: toSafeString(item.TransferredToEmpCode, ""),
                        TransferredToEmpName: toSafeString(item.TransferredToEmpName, ""),
                        TransferredFromEmpCode: toSafeString(item.TransferredFromEmpCode, ""),
                        TransferredFromEmpName: toSafeString(item.TransferredFromEmpName, ""),
                        TransferRequestId: item.TransferRequestId || null,
                        IsExpired: Boolean(item.IsExpired),
                        TransferRemarks: toSafeString(item.TransferRemarks, ""),
                        TransferProofFileName: toSafeString(item.TransferProofFileName, ""),
                        TransferProofFilePath: item.TransferProofFilePath,
                        TransferProofFileType: toSafeString(item.TransferProofFileType, ""),
                        TransferRequestStatus: toSafeString(item.TransferRequestStatus, ""),
                        TransferRequestedDate: item.TransferRequestedDate || "",
                        TransferReviewedBy: toSafeString(item.TransferReviewedBy, ""),
                        TransferReviewedByName: toSafeString(item.TransferReviewedByName, ""),
                        TransferReviewedDate: item.TransferReviewedDate || "",
                        TransferReviewRemarks: toSafeString(item.TransferReviewRemarks, ""),
                        EmpName: toSafeString(item.EmpName, ""),
                        raw: item
                    };
                });
            } else {
                combinedViolations = dashboardViolations.map((item: any, idx: number) => ({
                    Id: item.Id || idx + 1,
                    EmpCode: empCode,
                    PenaltyType: toSafeString(item.PenaltyType, "Policy Violation"),
                    SlipType: toSafeString(item.SlipType, "Yellow Slip"),
                    SlipCount: Number(item.SlipCount) || 1,
                    Remarks: toSafeString(item.Remarks, ""),
                    AppliedDate: item.AppliedDate || "",
                    Status: toSafeString(item.Status, "Applied"),
                    AppliedBy: toSafeString(item.AppliedBy, "System"),
                    TransferStatus: toSafeString(item.TransferStatus, "None"),
                    TransferredToEmpCode: toSafeString(item.TransferredToEmpCode, ""),
                    TransferredFromEmpCode: toSafeString(item.TransferredFromEmpCode, ""),
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
        setTransferImageError(false);
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
        setLightboxUrl(null);
        setImageError(false);
        setTransferImageError(false);
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

    const emp = (data.summary && data.summary[0] && typeof data.summary[0] === "object") ? data.summary[0] : {};
    const esc = (data.escalation && data.escalation[0] && typeof data.escalation[0] === "object") ? data.escalation[0] : {};

    // Profile Details
    const empName = toSafeString(emp.EMPNAME, toSafeString(userData?.empName, toSafeString(userData?.EMPNAME, toSafeString(userData?.userName, "HARISH PAMPANA"))));
    const empCode = toSafeString(emp.EMPCODE, toSafeString(userData?.empCode, toSafeString(userData?.EMPCODE, "1589")));
    const designation = toSafeString(userData?.designation, toSafeString(userData?.DESIGNATION, toSafeString(userData?.role, "Developer")));
    const escalationStatus = toSafeString(esc.EscalationStatus, "Normal Status");

    const activeYellowSlips = emp.TotalYellowSlips !== undefined && emp.TotalYellowSlips !== null
        ? Number(emp.TotalYellowSlips) || 0
        : data.violations
            .filter(v => toSafeString(v.Status).toLowerCase().trim() !== "transferred" && toSafeString(v.TransferStatus).toLowerCase().trim() !== "transferred" && !v.IsExpired)
            .filter(v => toSafeString(v.SlipType).toLowerCase().includes("yellow"))
            .reduce((sum, v) => sum + (Number(v.SlipCount) || 1), 0);

    const activeRedSlips = emp.TotalRedSlips !== undefined && emp.TotalRedSlips !== null
        ? Number(emp.TotalRedSlips) || 0
        : data.violations
            .filter(v => toSafeString(v.Status).toLowerCase().trim() !== "transferred" && toSafeString(v.TransferStatus).toLowerCase().trim() !== "transferred" && !v.IsExpired)
            .filter(v => toSafeString(v.SlipType).toLowerCase().includes("red"))
            .reduce((sum, v) => sum + (Number(v.SlipCount) || 1), 0);

    return (
        <IonPage>
            <IonContent className="page-content">
                <div className="ep-page-wrapper">
                    
                    {/* ── Premium Page Header ── */}
                    <div className="page-wr-header ep-header-banner">
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

                    {/* ── EMPLOYEE PROFILE CARD ── */}
                    <div className="ep-profile-card">
                        <div className="ep-profile-left">
                            <div className="ep-profile-avatar">
                                {empName ? empName.charAt(0).toUpperCase() : "E"}
                            </div>
                            <div className="ep-profile-info">
                                <span className="ep-profile-tag">Employee Profile</span>
                                <h2 className="ep-profile-name">{empName}</h2>
                                <div className="ep-profile-sub">
                                    <span className="ep-profile-designation">{designation}</span>
                                    <span className="ep-divider">•</span>
                                    <span className="ep-profile-code-badge">Employee ID: {empCode}</span>
                                </div>
                            </div>
                        </div>
                        <div className="ep-profile-status-badge">
                            <div className={`ep-escalation-pill ${
                                escalationStatus === "Disciplinary Review"
                                    ? "danger"
                                    : escalationStatus === "Manager Escalation"
                                    ? "orange"
                                    : escalationStatus === "HR Warning"
                                    ? "warning"
                                    : "safe"
                            }`}>
                                <div className="ep-esc-ring"></div>
                                <span className="ep-esc-text">{escalationStatus}</span>
                            </div>
                        </div>
                    </div>

                    {/* ── 5-COLUMN BENTO SUMMARY GRID ── */}
                    <div className="ep-summary-bento">
                        {/* Card 1: Performance Score */}
                        <div className="ep-bento-card ep-bento-score">
                            <div className="ep-bento-card-bg-circle" />
                            <div className="ep-bento-top">
                                <span className="ep-bento-label">Performance Score</span>
                                <div className="ep-bento-icon-pill">
                                    <Award size={16} />
                                </div>
                            </div>
                            <div className="ep-bento-value">
                                {Number(emp.TotalPerformanceScore || 0).toFixed(2)}
                            </div>
                            <div className="ep-bento-subtext">Overall Score Index</div>
                        </div>

                        {/* Card 2: Green Slips */}
                        <div className="ep-bento-card ep-bento-green">
                            <div className="ep-bento-card-bg-circle" />
                            <div className="ep-bento-top">
                                <span className="ep-bento-label">Green Slips</span>
                                <div className="ep-bento-icon-pill">
                                    <CheckCircle2 size={16} />
                                </div>
                            </div>
                            <div className="ep-bento-value">{Number(emp.TotalGreenSlips) || 0}</div>
                            <div className="ep-bento-subtext">Appreciation Slips</div>
                        </div>

                        {/* Card 3: Yellow Slips */}
                        <div className="ep-bento-card ep-bento-yellow">
                            <div className="ep-bento-card-bg-circle" />
                            <div className="ep-bento-top">
                                <span className="ep-bento-label">Yellow Slips</span>
                                <div className="ep-bento-icon-pill">
                                    <AlertTriangle size={16} />
                                </div>
                            </div>
                            <div className="ep-bento-value">{activeYellowSlips}</div>
                            <div className="ep-bento-subtext">Warning Slips</div>
                        </div>

                        {/* Card 4: Orange Slips */}
                        <div className="ep-bento-card ep-bento-orange">
                            <div className="ep-bento-card-bg-circle" />
                            <div className="ep-bento-top">
                                <span className="ep-bento-label">Orange Slips</span>
                                <div className="ep-bento-icon-pill">
                                    <AlertCircle size={16} />
                                </div>
                            </div>
                            <div className="ep-bento-value">{Number(emp.TotalOrangeSlips) || 0}</div>
                            <div className="ep-bento-subtext">Escalation Slips</div>
                        </div>

                        {/* Card 5: Red Slips */}
                        <div className="ep-bento-card ep-bento-red">
                            <div className="ep-bento-card-bg-circle" />
                            <div className="ep-bento-top">
                                <span className="ep-bento-label">Red Slips</span>
                                <div className="ep-bento-icon-pill">
                                    <ShieldAlert size={16} />
                                </div>
                            </div>
                            <div className="ep-bento-value">{activeRedSlips}</div>
                            <div className="ep-bento-subtext">Severe Penalties</div>
                        </div>
                    </div>

                    {/* ── VIOLATION HISTORY SECTION ── */}
                    <div className="ep-history-section">
                        <div className="ep-section-header">
                            <div className="ep-section-title-wrap">
                                <div className="ep-section-icon-badge">
                                    <History size={18} />
                                </div>
                                <div>
                                    <h2 className="ep-section-title">Violation History</h2>
                                    <p className="ep-section-subtitle">Detailed records of issued slips and transfers</p>
                                </div>
                            </div>
                            <span className="ep-section-count-badge">
                                {data.violations.length} {data.violations.length === 1 ? "Record" : "Records"}
                            </span>
                        </div>

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
                                                    <span className="ep-val-highlight">{toSafeString(item.PenaltyType, "Policy Violation")}</span>
                                                </div>
                                                <div className="ep-info-row">
                                                    <label>Count</label>
                                                    <span>{Number(item.SlipCount) || 1}</span>
                                                </div>
                                                <div className="ep-info-row">
                                                    <label>Status</label>
                                                    <span style={{ color: "#047857", fontWeight: 700 }}>{toSafeString(item.Status, "Applied")}</span>
                                                </div>
                                                {violationTimeStr && (
                                                    <div className="ep-info-row">
                                                        <label>Time</label>
                                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                                            <Clock size={12} style={{ color: "#64748b" }} />
                                                            {violationTimeStr}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="ep-info-row">
                                                    <label>Applied By</label>
                                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                                        {isAiEngine ? (
                                                            <>
                                                                <Bot size={13} style={{ color: "#6366f1" }} />
                                                                <span>AI Engine</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <User size={13} style={{ color: "#64748b" }} />
                                                                <span>{toSafeString(item.AppliedBy, "System")}</span>
                                                            </>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Remarks Box */}
                                            {item.Remarks && typeof item.Remarks === "string" && item.Remarks.trim() !== "" && item.Remarks.trim() !== "{}" && (
                                                <div className="ep-card-footer">
                                                    <FileText size={13} style={{ color: "#3b82f6", flexShrink: 0, marginTop: "2px" }} />
                                                    <p>{item.Remarks}</p>
                                                </div>
                                            )}

                                            {/* Footer Action Bar with View & Transfer Buttons */}
                                            <div className="ep-card-footer-box">
                                                <div className="ep-card-tags">
                                                    <span className="ep-tag-status">
                                                        <CheckCircle size={12} />
                                                        {toSafeString(item.Status, "Applied")}
                                                    </span>
                                                    {item.TransferStatus === "PendingTransfer" && (
                                                        <span className="ep-badge-pending-transfer" title="Waiting for HR / Management Approval">
                                                            ⏳ Transfer Pending
                                                        </span>
                                                    )}
                                                    {item.TransferStatus === "Transferred" && typeof item.TransferredToEmpCode === "string" && item.TransferredToEmpCode.trim() !== "" && item.TransferredToEmpCode.trim() !== "{}" && (
                                                        <span className="ep-badge-transferred" title={`Transferred to ${item.TransferredToEmpCode}`}>
                                                            ✅ Transferred Out ({item.TransferredToEmpCode})
                                                        </span>
                                                    )}
                                                    {typeof item.TransferredFromEmpCode === "string" && item.TransferredFromEmpCode.trim() !== "" && item.TransferredFromEmpCode.trim() !== "{}" && (
                                                        <span className="ep-badge-transferred-in" title={`Transferred from ${item.TransferredFromEmpCode}`}>
                                                            🔁 From {item.TransferredFromEmpCode}
                                                        </span>
                                                    )}
                                                    {hasProof && (
                                                        <span
                                                            className={`ep-evidence-chip ${hasVideoProof ? 'video' : ''}`}
                                                            onClick={() => handleViewViolation(item, index)}
                                                            title="Click to view attached evidence"
                                                        >
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
                                                <div className="ep-card-actions-group">
                                                    {item.TransferStatus === "PendingTransfer" ? (
                                                        <span
                                                            style={{
                                                                fontSize: "11px",
                                                                fontWeight: "700",
                                                                color: "#b45309",
                                                                background: "#fef3c7",
                                                                border: "1px solid #fde68a",
                                                                padding: "6px 10px",
                                                                borderRadius: "8px",
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                gap: "4px"
                                                            }}
                                                            title="Waiting for HR / Management Approval"
                                                        >
                                                            ⏳ Transfer Pending Review
                                                        </span>
                                                    ) : item.Status !== "Transferred" && item.TransferStatus !== "Transferred" && (
                                                        <button
                                                            className="ep-transfer-btn"
                                                            onClick={() => handleOpenTransferModal(item)}
                                                            title="Witnessed a policy violation? Transfer this slip to another employee"
                                                        >
                                                            <ArrowRightLeft size={13} />
                                                            Transfer Slip
                                                        </button>
                                                    )}
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
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="ep-empty-state">
                                    <CheckCircle size={36} style={{ color: "#10b981", margin: "0 auto 10px" }} />
                                    <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: "700", color: "#1e293b" }}>
                                        No Penalties Found
                                    </p>
                                    <span style={{ fontSize: "13px", color: "#64748b" }}>
                                        You currently have no penalty slips or policy violations recorded.
                                    </span>
                                </div>
                            )}
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
                                        {toSafeString(selectedViolation.Status, "Applied")}
                                    </span>
                                </div>

                                {/* ── TRANSFER AUDIT & REASSIGNMENT CARD (When slip was transferred, received, or pending) ── */}
                                {Boolean(
                                    selectedViolation.TransferStatus === "Transferred" ||
                                    selectedViolation.TransferStatus === "TransferredIn" ||
                                    selectedViolation.TransferStatus === "PendingTransfer" ||
                                    selectedViolation.Status === "Transferred" ||
                                    selectedViolation.TransferredToEmpCode ||
                                    selectedViolation.TransferredFromEmpCode ||
                                    selectedViolation.TransferRequestId
                                ) && (
                                    (() => {
                                        const isTransferredOut = selectedViolation.Status === "Transferred" || selectedViolation.TransferStatus === "Transferred";
                                        const isTransferredIn = selectedViolation.TransferStatus === "TransferredIn" || (Boolean(selectedViolation.TransferredFromEmpCode) && !isTransferredOut);
                                        const isPending = selectedViolation.TransferStatus === "PendingTransfer";

                                        const cardClass = isTransferredOut
                                            ? "ep-modal-transfer-card cleared"
                                            : isPending
                                            ? "ep-modal-transfer-card pending"
                                            : "ep-modal-transfer-card";

                                        const fromName = selectedViolation.TransferredFromEmpName || (isTransferredOut ? (selectedViolation.EmpName || empName) : "Original Holder");
                                        const fromCode = selectedViolation.TransferredFromEmpCode || (isTransferredOut ? (selectedViolation.EmpCode || empCode) : "—");

                                        const toName = selectedViolation.TransferredToEmpName || (isTransferredIn ? (selectedViolation.EmpName || empName) : "Reassigned Employee");
                                        const toCode = selectedViolation.TransferredToEmpCode || (isTransferredIn ? (selectedViolation.EmpCode || empCode) : "—");

                                        const transferProofUrl = selectedViolation.TransferProofFilePath ? getProofUrl(selectedViolation.TransferProofFilePath) : "";
                                        const isTransferImg = transferProofUrl ? isImageProof(transferProofUrl, selectedViolation.TransferProofFileType, selectedViolation.TransferProofFileName) : false;
                                        const isTransferVid = transferProofUrl ? isVideoProof(transferProofUrl, selectedViolation.TransferProofFileType, selectedViolation.TransferProofFileName) : false;

                                        return (
                                            <div className={cardClass}>
                                                {/* Header */}
                                                <div className="ep-mtc-header">
                                                    <div className="ep-mtc-title">
                                                        <ArrowRightLeft size={16} />
                                                        <span>
                                                            {isTransferredOut
                                                                ? "Disciplinary Slip Reassigned (Cleared from Employee)"
                                                                : isTransferredIn
                                                                ? "Disciplinary Slip Transferred In (Assigned to Employee)"
                                                                : isPending
                                                                ? "Slip Transfer Pending HR Review"
                                                                : "Slip Reassignment Audit"}
                                                        </span>
                                                    </div>
                                                    <span className="ep-mtc-status-badge">
                                                        {isTransferredOut ? "Cleared From Record" : isTransferredIn ? "Slip Assigned" : isPending ? "Pending Review" : "Transferred"}
                                                    </span>
                                                </div>

                                                {/* Reassignment Flow Bar */}
                                                <div className="ep-mtc-flow">
                                                    <div className="ep-mtc-flow-party">
                                                        <span className="ep-mtc-flow-label">Cleared From</span>
                                                        <span className="ep-mtc-flow-name">{fromName}</span>
                                                        <span className="ep-mtc-flow-sub">#{fromCode}</span>
                                                        <span className="ep-mtc-flow-tag cleared">Slip Cleared</span>
                                                    </div>

                                                    <div className="ep-mtc-flow-arrow">
                                                        <ArrowRightLeft size={18} />
                                                        <span className="ep-mtc-flow-arrow-text">Transferred To</span>
                                                    </div>

                                                    <div className="ep-mtc-flow-party to">
                                                        <span className="ep-mtc-flow-label">Transferred To</span>
                                                        <span className="ep-mtc-flow-name">{toName}</span>
                                                        <span className="ep-mtc-flow-sub">#{toCode}</span>
                                                        <span className="ep-mtc-flow-tag assigned">Slip Assigned</span>
                                                    </div>
                                                </div>

                                                {/* Audit Details Grid */}
                                                <div className="ep-mtc-details-grid">
                                                    <div className="ep-mtc-field">
                                                        <span className="ep-mtc-field-label">Accepted & Approved By</span>
                                                        <span className="ep-mtc-field-val">
                                                            <UserCheck size={14} style={{ color: "#059669" }} />
                                                            <strong>
                                                                {selectedViolation.TransferReviewedByName || (selectedViolation.TransferReviewedBy ? `Supervisor #${selectedViolation.TransferReviewedBy}` : "HR Administrator")}
                                                                {selectedViolation.TransferReviewedBy ? ` (#${selectedViolation.TransferReviewedBy})` : ""}
                                                            </strong>
                                                        </span>
                                                    </div>

                                                    <div className="ep-mtc-field">
                                                        <span className="ep-mtc-field-label">Approval Decision</span>
                                                        <span className="ep-mtc-field-val">
                                                            <CheckCircle2 size={14} style={{ color: "#10b981" }} />
                                                            <span>{selectedViolation.TransferRequestStatus || (isPending ? "Pending HR Review" : "Approved & Applied")}</span>
                                                        </span>
                                                    </div>

                                                    <div className="ep-mtc-field">
                                                        <span className="ep-mtc-field-label">Approved Date & Time</span>
                                                        <span className="ep-mtc-field-val">
                                                            <Clock size={13} style={{ color: "#64748b" }} />
                                                            <span>{formatDateTime(selectedViolation.TransferReviewedDate)}</span>
                                                        </span>
                                                    </div>

                                                    <div className="ep-mtc-field">
                                                        <span className="ep-mtc-field-label">Requested On</span>
                                                        <span className="ep-mtc-field-val">
                                                            <Calendar size={13} style={{ color: "#64748b" }} />
                                                            <span>{formatDateTime(selectedViolation.TransferRequestedDate)}</span>
                                                        </span>
                                                    </div>

                                                    {/* Transfer Reason */}
                                                    {selectedViolation.TransferRemarks && (
                                                        <div className="ep-mtc-field full">
                                                            <span className="ep-mtc-field-label">Transfer Reason & Violation Observed</span>
                                                            <div className="ep-mtc-remarks">
                                                                "{selectedViolation.TransferRemarks}"
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Management Approval Remarks */}
                                                    {selectedViolation.TransferReviewRemarks && (
                                                        <div className="ep-mtc-field full">
                                                            <span className="ep-mtc-field-label">Management Approval Remarks / Notes</span>
                                                            <div className="ep-mtc-remarks approval">
                                                                <CheckCircle size={13} style={{ display: "inline", marginRight: "4px", color: "#16a34a" }} />
                                                                "{selectedViolation.TransferReviewRemarks}"
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Transfer Evidence Box */}
                                                {transferProofUrl && (
                                                    <div className="ep-mtc-evidence">
                                                        <div className="ep-mtc-evidence-header">
                                                            <span className="ep-mtc-evidence-label">
                                                                <Paperclip size={13} />
                                                                Attached Transfer Evidence Proof
                                                            </span>
                                                            <a
                                                                href={transferProofUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="ep-modal-evidence-link"
                                                            >
                                                                <ExternalLink size={13} />
                                                                Open / Download File
                                                            </a>
                                                        </div>
                                                        {isTransferVid ? (
                                                            <video
                                                                controls
                                                                playsInline
                                                                preload="metadata"
                                                                src={transferProofUrl}
                                                                className="ep-modal-evidence-video"
                                                            >
                                                                Your browser does not support HTML5 video playback.
                                                            </video>
                                                        ) : isTransferImg && !transferImageError ? (
                                                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                                                <img
                                                                    src={transferProofUrl}
                                                                    alt="Transfer Proof"
                                                                    className="ep-mtc-evidence-thumb"
                                                                    onClick={() => setLightboxUrl(transferProofUrl)}
                                                                    onError={() => setTransferImageError(true)}
                                                                    title="Click to view full image in lightbox"
                                                                />
                                                                <span style={{ fontSize: "11px", color: "#64748b", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                                    <ImageIcon size={12} />
                                                                    {selectedViolation.TransferProofFileName || "Transfer Evidence File"} &bull; Click image to enlarge
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div style={{ padding: "10px", background: "#f8fafc", borderRadius: "8px", fontSize: "12px", color: "#475569" }}>
                                                                <Paperclip size={14} style={{ display: "inline", marginRight: "5px" }} />
                                                                <strong>Evidence File:</strong> {selectedViolation.TransferProofFileName || "Attached Proof File"}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()
                                )}

                                {/* Detailed Fields Grid */}
                                <div className="ep-modal-grid-details">
                                    <div className="ep-modal-field full">
                                        <label>Penalty Type / Rule</label>
                                        <span style={{ fontSize: "15px", color: "#0f172a" }}>
                                            {toSafeString(selectedViolation.PenaltyType, "Policy Violation")}
                                        </span>
                                    </div>

                                    <div className="ep-modal-field">
                                        <label>Slip Category</label>
                                        <span>{toSafeString(selectedViolation.SlipType, "Yellow Slip")}</span>
                                    </div>

                                    <div className="ep-modal-field">
                                        <label>Slip Count</label>
                                        <span>{Number(selectedViolation.SlipCount) || 1}</span>
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
                                                    <span>Supervisor / Administrator (ID: {toSafeString(selectedViolation.AppliedBy, "System")})</span>
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
                                        <span style={{ color: "#047857" }}>{toSafeString(selectedViolation.Status, "Applied")}</span>
                                    </div>
                                </div>

                                {/* Official Remarks Box */}
                                <div className="ep-modal-remarks-box">
                                    <label>Official Remarks / Violation Reason</label>
                                    <p>{toSafeString(selectedViolation.Remarks, "No specific remarks provided.")}</p>
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
                                                    style={{ cursor: "pointer" }}
                                                    onClick={() => setLightboxUrl(getProofUrl(selectedViolation.ProofFilePath))}
                                                    onError={() => {
                                                        console.warn("⚠️ Proof image failed to load from primary URL:", getProofUrl(selectedViolation.ProofFilePath));
                                                        setImageError(true);
                                                    }}
                                                    title="Click to view full image in lightbox"
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
                                    ) : selectedViolation.TransferProofFilePath &&
                                      String(selectedViolation.TransferProofFilePath).trim() !== "" &&
                                      String(selectedViolation.TransferProofFilePath).trim() !== "{}" ? (
                                        <div style={{ padding: "12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", fontSize: "12px", color: "#166534", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <CheckCircle size={16} style={{ color: "#16a34a", flexShrink: 0 }} />
                                                <span>Transfer evidence proof attached above (<strong>{selectedViolation.TransferProofFileName || "Evidence File"}</strong>).</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setLightboxUrl(getProofUrl(selectedViolation.TransferProofFilePath))}
                                                style={{ background: "#16a34a", color: "#ffffff", border: "none", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}
                                            >
                                                Preview Evidence
                                            </button>
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

                {/* ── TRANSFER SLIP MODAL ── */}
                {transferModalOpen && slipToTransfer && (
                    <div className="ep-modal-backdrop" onClick={handleCloseTransferModal}>
                        <div className="ep-modal-content ep-transfer-modal" onClick={(e) => e.stopPropagation()}>
                            {/* Modal Header */}
                            <div className="ep-modal-header">
                                <div className="ep-modal-title-group">
                                    <div className="ep-modal-icon-badge">
                                        <ArrowRightLeft size={20} />
                                    </div>
                                    <div>
                                        <h3 className="ep-modal-title">Transfer Penalty Slip</h3>
                                        <span className="ep-modal-subtitle">
                                            Pass this slip to the violating employee with evidence
                                        </span>
                                    </div>
                                </div>
                                <button className="ep-modal-close" onClick={handleCloseTransferModal} disabled={transferSubmitting}>
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="ep-modal-body">
                                {/* Slip Context Box */}
                                <div className="ep-transfer-slip-context">
                                    <div className="ep-transfer-context-header">
                                        <span className="ep-transfer-context-label">Slip Being Transferred:</span>
                                        <span className={`ep-slip-badge ${slipToTransfer.SlipType?.toLowerCase().replace(/\s+/g, "-")}`}>
                                            {slipToTransfer.SlipType}
                                        </span>
                                    </div>
                                    <div className="ep-transfer-context-details">
                                        <div><strong>Penalty:</strong> {slipToTransfer.PenaltyType}</div>
                                        <div><strong>Issued On:</strong> {formatViolationDate(slipToTransfer.PenaltyDate || slipToTransfer.AppliedDate)}</div>
                                    </div>
                                </div>

                                {/* Form Fields */}
                                <div className="ep-transfer-form">
                                    {/* Employee B Selection */}
                                    <div className="ep-transfer-field">
                                        <label>Select Violating Employee <span style={{ color: "#ef4444" }}>*</span></label>
                                        <div className="ep-transfer-search-box">
                                            <Search size={16} className="ep-search-icon" />
                                            <input
                                                type="text"
                                                className="ep-transfer-input"
                                                placeholder="Search employee by name or code..."
                                                value={transferSearch}
                                                onChange={(e) => {
                                                    setTransferSearch(e.target.value);
                                                    setTransferDropdownOpen(true);
                                                }}
                                                onFocus={() => setTransferDropdownOpen(true)}
                                            />
                                        </div>

                                        {transferDropdownOpen && (
                                            <div className="ep-transfer-dropdown-list">
                                                {allEmployees
                                                    .filter((emp: any) => {
                                                        const term = transferSearch.toLowerCase();
                                                        const code = String(emp[0] || emp.empCode || "").toLowerCase();
                                                        const name = String(emp[1] || emp.empName || "").toLowerCase();
                                                        const currentCode = String(userData?.empCode || "").toLowerCase();
                                                        return code !== currentCode && (name.includes(term) || code.includes(term));
                                                    })
                                                    .slice(0, 15)
                                                    .map((emp: any) => {
                                                        const code = String(emp[0] || emp.empCode);
                                                        const name = String(emp[1] || emp.empName);
                                                        const isSelected = transferTargetEmp === code;
                                                        return (
                                                            <div
                                                                key={code}
                                                                className={`ep-transfer-dropdown-item ${isSelected ? "selected" : ""}`}
                                                                onClick={() => {
                                                                    setTransferTargetEmp(code);
                                                                    setTransferSearch(`${name} (${code})`);
                                                                    setTransferDropdownOpen(false);
                                                                }}
                                                            >
                                                                <User size={14} />
                                                                <div className="ep-transfer-dropdown-item-text">
                                                                    <strong>{name}</strong>
                                                                    <span>#{code}</span>
                                                                </div>
                                                                {isSelected && <CheckCircle size={14} style={{ marginLeft: "auto", color: "#10b981" }} />}
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        )}
                                        {transferTargetEmp && (
                                            <div className="ep-selected-emp-chip">
                                                <UserCheck size={14} />
                                                <span>Target: <strong>{transferSearch}</strong></span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setTransferTargetEmp("");
                                                        setTransferSearch("");
                                                    }}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Incident Time */}
                                    <div className="ep-transfer-field">
                                        <label>Violation Date & Time <span style={{ color: "#ef4444" }}>*</span></label>
                                        <input
                                            type="datetime-local"
                                            className="ep-transfer-input"
                                            value={transferViolationTime}
                                            onChange={(e) => setTransferViolationTime(e.target.value)}
                                        />
                                    </div>

                                    {/* Violation Remarks */}
                                    <div className="ep-transfer-field">
                                        <label>Violation Reason / Explanation <span style={{ color: "#ef4444" }}>*</span></label>
                                        <textarea
                                            rows={3}
                                            className="ep-transfer-textarea"
                                            placeholder="Explain what policy violation was observed in detail..."
                                            value={transferRemarks}
                                            onChange={(e) => setTransferRemarks(e.target.value)}
                                        />
                                    </div>

                                    {/* Proof File Uploader */}
                                    <div className="ep-transfer-field">
                                        <label>Attach Evidence (Photo, Video, Document)</label>
                                        <div className="ep-file-upload-box">
                                            <input
                                                type="file"
                                                id="epTransferProofInput"
                                                accept="image/*,video/*,.pdf"
                                                style={{ display: "none" }}
                                                onChange={(e) => {
                                                    if (e.target.files && e.target.files[0]) {
                                                        setTransferProofFile(e.target.files[0]);
                                                    }
                                                }}
                                            />
                                            <label htmlFor="epTransferProofInput" className="ep-file-upload-label">
                                                <Upload size={18} />
                                                <span>{transferProofFile ? transferProofFile.name : "Click to Upload Photo, Video or PDF proof"}</span>
                                            </label>
                                            {transferProofFile && (
                                                <button
                                                    type="button"
                                                    className="ep-file-remove-btn"
                                                    onClick={() => setTransferProofFile(null)}
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="ep-modal-footer">
                                <button
                                    className="ep-btn-secondary"
                                    onClick={handleCloseTransferModal}
                                    disabled={transferSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="ep-btn-primary"
                                    onClick={handleSubmitTransfer}
                                    disabled={transferSubmitting || !transferTargetEmp || !transferRemarks.trim()}
                                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                                >
                                    {transferSubmitting ? (
                                        <>Submitting...</>
                                    ) : (
                                        <>
                                            <Send size={15} />
                                            Submit for HR Approval
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── LIGHTBOX MODAL OVERLAY ── */}
                {lightboxUrl && (
                    <div className="ep-lightbox-backdrop" onClick={() => setLightboxUrl(null)}>
                        <button className="ep-lightbox-close" onClick={() => setLightboxUrl(null)} title="Close Lightbox">
                            <X size={24} />
                        </button>
                        <img
                            src={lightboxUrl}
                            alt="Evidence Fullscreen Preview"
                            className="ep-lightbox-img"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                )}

                <IonToast
                    isOpen={toastState.isOpen}
                    message={toastState.message}
                    color={toastState.color}
                    duration={3500}
                    position="top"
                    onDidDismiss={() => setToastState(prev => ({ ...prev, isOpen: false }))}
                />
            </IonContent>
        </IonPage>
    );
}

export default EmployeePenalties;