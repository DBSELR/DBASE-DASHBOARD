import React, { useState, useEffect, useMemo } from "react";
import {
  IonPage,
  IonContent,
  IonSpinner,
  IonToast,
  IonIcon,
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import {
  refreshOutline,
  searchOutline,
  closeOutline,
  chevronBackOutline,
  calendarOutline,
  sendOutline,
  settingsOutline,
  addCircleOutline,
  informationCircleOutline,
  trashOutline,
  createOutline,
  documentTextOutline,
  logOutOutline,
  checkmarkCircleOutline,
  timeOutline,
  alertCircleOutline,
  closeCircleOutline,
  layersOutline,
  closeCircle,
  checkmarkCircle,
  businessOutline,
  arrowForwardOutline,
  cashOutline,
  sparklesOutline,
  callOutline,
  mailOutline,
  chatboxEllipsesOutline,
} from "ionicons/icons";
import axios from "axios";
import { API_BASE } from "../config";
import "./AMClogDashboard.css";

interface ClientRecord {
  Cid?: string;
  cid?: string;
  CID?: string;
  ClientName?: string;
  Cname?: string;
  cname?: string;
  Client?: string;
  CLIENT?: string;
  Module?: string;
  MODULE?: string;
  ModuleType?: string;
  module?: string;
  DOI?: string;
  Doi?: string;
  doi?: string;
  DateOfImplementation?: string;
  FreeService?: number | string;
  freeService?: number | string;
  FreeServiceUpto?: string;
  ServiceUpto?: string;
  serviceUpto?: string;
  service_upto?: string;
  DueDate?: string;
  Due_Date?: string;
  LastAmcDueDt?: string;
  NewDueDt?: string;
  due_date?: string;
  Cost?: number | string;
  COST?: number | string;
  cost?: number | string;
  Percentage?: number | string;
  AmcPercentage?: number | string;
  perCentage?: number | string;
  AmcCost?: number | string;
  AMC_Cost?: number | string;
  AMC_COST?: number | string;
  amcCost?: number | string;
  amc_cost?: number | string;
  MobileNumber?: string;
  mobileNumber?: string;
  Mobile1?: string;
  Mobile_1?: string;
  Mobile?: string;
  MobileNumber1?: string;
  MobileNumber2?: string;
  Mobile2?: string;
  Mobile_2?: string;
  Email?: string;
  email?: string;
  Status?: string;
  [key: string]: any;
}

const AMClogDashboard: React.FC = () => {
  const history = useHistory();
  const baseUrl = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;

  // Main Data States
  const [clientList, setClientList] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "RUNNING" | "TO_EXPIRE" | "EXPIRED">("ALL");

  // Notification Toast
  const [toast, setToast] = useState<{ show: boolean; msg: string; color: "success" | "danger" | "warning" }>({
    show: false,
    msg: "",
    color: "success",
  });

  // Modals
  const [showAddEditModal, setShowAddEditModal] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [showRenewalModal, setShowRenewalModal] = useState<boolean>(false);
  const [showSmsModal, setShowSmsModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [showReportsModal, setShowReportsModal] = useState<boolean>(false);

  // Selected Client
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  // Row selected via Arrow click (required for AMC Info popup)
  const [selectedArrowClient, setSelectedArrowClient] = useState<ClientRecord | null>(null);
  const [selectedArrowKey, setSelectedArrowKey] = useState<string | null>(null);
  // Single Cell selected ({ rowId, colKey })
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; colKey: string } | null>(null);

  // Settings Data
  const [settingsList, setSettingsList] = useState<any[]>([]);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(false);

  // AMC History Data
  const [amcHistory, setAmcHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [lastAmcInfo, setLastAmcInfo] = useState<any>(null);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number>(0);

  // Add / Edit Client Form State
  const [clientForm, setClientForm] = useState({
    cid: "",
    cname: "",
    module: "BEAT",
    doi: new Date().toISOString().substring(0, 10),
    freeService: 1,
    serviceUpto: "",
    cost: "0.00" as any,
    percentage: "18.0" as any,
    amcCost: "0.00" as any,
    mobileNumber: "",
    mobileNumber1: "",
    email: "",
  });

  // Renewal Form State
  const [renewalForm, setRenewalForm] = useState({
    cid: "",
    clientName: "",
    moduleType: "",
    cost: "0.00" as any,
    percentage: "18.0" as any,
    amcCost: "0.00" as any,
    lastAmcDueDt: new Date().toISOString().substring(0, 10),
    newDueDt: "",
    paidOn: new Date().toISOString().substring(0, 10),
  });

  // SMS Form State
  const [smsForm, setSmsForm] = useState({
    clientId: "",
    clientName: "",
    mobileNumber: "",
    mobileNumber2: "",
    sendToMobile1: true,
    sendToMobile2: false,
    message: "",
  });

  const showNotification = (msg: string, color: "success" | "danger" | "warning" = "success") => {
    setToast({ show: true, msg, color });
  };

  // Helper to safely parse API responses that might be double-serialized JSON strings
  const parseJsonData = (data: any): any[] => {
    if (!data) return [];
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(data) ? data : [];
  };

  // Load Main Client Grid (SP_CheckAmcDueDtae)
  const fetchAmcClients = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${baseUrl}AMCLog/CheckAmcDueDates`, { headers });
      const records = parseJsonData(res.data);
      setClientList(records);
    } catch (error: any) {
      console.error("Error fetching AMC clients:", error);
      // Fallback try GetAmcClients
      try {
        const res = await axios.get(`${baseUrl}AMCLog/GetAmcClients`);
        const records = parseJsonData(res.data);
        setClientList(records);
      } catch (err) {
        showNotification("Failed to load AMC Clients data", "danger");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAmcClients();
  }, []);

  // Format Dates helper (e.g. 01-Oct-26)
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "--";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  // Safe Field Extractors (matching exact SP_CheckAmcDueDtae SQL Server uppercase column names)
  const getClientName = (row: ClientRecord) => row.CLIENT || row.ClientName || row.Cname || row.cname || row.Client || "--";
  const getClientId = (row: ClientRecord) => String(row.CID || row.Cid || row.cid || "");
  const getModule = (row: ClientRecord) => row.MODULE || row.Module || row.ModuleType || row.module || "--";
  const getDoi = (row: ClientRecord) => row.DOI || row.Doi || row.doi || row.DateOfImplementation || null;
  const getServiceUpto = (row: ClientRecord) => row.FREESERVICEUPTO || row.FreeServiceUpto || row.ServiceUpto || row.serviceUpto || row.service_upto || null;
  const getDueDate = (row: ClientRecord) => row.DUEDATE || row.DueDate || row.Due_Date || row.NewDueDt || row.LastAmcDueDt || row.due_date || null;
  const getCost = (row: ClientRecord) => Number(row.COST ?? row.Cost ?? row.cost ?? 0);
  const getPercentage = (row: ClientRecord) => Number(row.AMCPERCENTAGE ?? row.Percentage ?? row.AmcPercentage ?? row.perCentage ?? row["Initial AMC(%)"] ?? 0);
  const getAmcCost = (row: ClientRecord) => Number(row.AMCCOST ?? row.AmcCost ?? row.AMC_Cost ?? row.amcCost ?? row.amc_cost ?? 0);
  const getMobile1 = (row: ClientRecord) => row.MobileNumber || row.Mobile1 || row.Mobile_1 || row.Mobile || row.mobileNumber || "";
  const getMobile2 = (row: ClientRecord) => row.MobileNumber_1 || row.MobileNumber1 || row.MobileNumber2 || row.Mobile2 || row.Mobile_2 || "";

  // Determine row status (Running / Expiring soon / Expired) as per backend logic
  const getRowStatus = (row: ClientRecord): "RUNNING" | "TO_EXPIRE" | "EXPIRED" => {
    // 1. Check backend flags from SP_CheckAmcDueDtae
    const isCompleteVal = String(row.ISAMCCOMPLETE ?? row.IsAMcComplete ?? row.IsAmcComplete ?? row.isAmcComplete ?? row.IsExpired ?? row.isExpired ?? row.ISEXPIRED ?? "").trim().toLowerCase();
    if (isCompleteVal === "true" || isCompleteVal === "1" || row.ISAMCCOMPLETE === true || row.ISEXPIRED === true) {
      return "EXPIRED";
    }

    const isNearWeekVal = String(row.ISNEARTOWEEK ?? row.IsNearToWeek ?? row.isNearToWeek ?? "").trim().toLowerCase();
    if (isNearWeekVal === "true" || isNearWeekVal === "1" || row.ISNEARTOWEEK === true) {
      return "TO_EXPIRE";
    }

    // 2. Date Comparison based on Due Date
    const dueDateStr = getDueDate(row);
    if (!dueDateStr) return "RUNNING";
    const d = new Date(dueDateStr);
    if (isNaN(d.getTime())) return "RUNNING";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return "EXPIRED";
    if (diffDays <= 7) return "TO_EXPIRE";
    return "RUNNING";
  };

  // Filtered Clients and Status Statistics
  const { filteredList, runningCount, toExpireCount, expiredCount } = useMemo(() => {
    let running = 0;
    let toExpire = 0;
    let expired = 0;

    clientList.forEach((c) => {
      const status = getRowStatus(c);
      if (status === "RUNNING") running++;
      else if (status === "TO_EXPIRE") toExpire++;
      else if (status === "EXPIRED") expired++;
    });

    const search = searchTerm.trim().toLowerCase();
    const filtered = clientList.filter((c) => {
      const status = getRowStatus(c);
      if (statusFilter === "RUNNING" && status !== "RUNNING") return false;
      if (statusFilter === "TO_EXPIRE" && status !== "TO_EXPIRE") return false;
      if (statusFilter === "EXPIRED" && status !== "EXPIRED") return false;

      if (!search) return true;
      const name = getClientName(c).toLowerCase();
      const mod = getModule(c).toLowerCase();
      const m1 = getMobile1(c).toLowerCase();
      const m2 = getMobile2(c).toLowerCase();
      return name.includes(search) || mod.includes(search) || m1.includes(search) || m2.includes(search);
    });

    return {
      filteredList: filtered,
      runningCount: running,
      toExpireCount: toExpire,
      expiredCount: expired,
    };
  }, [clientList, searchTerm, statusFilter]);

  // Handlers for Add / Edit
  const openAddClientModal = () => {
    setIsEditMode(false);
    const today = new Date().toISOString().substring(0, 10);

    setClientForm({
      cid: "",
      cname: "",
      module: "",
      doi: today,
      freeService: "" as any,
      serviceUpto: today,
      cost: "" as any,
      percentage: "" as any,
      amcCost: "" as any,
      mobileNumber: "",
      mobileNumber1: "",
      email: "",
    });
    setShowAddEditModal(true);
  };

  const openEditClientModal = (row: ClientRecord) => {
    setIsEditMode(true);
    const cost = getCost(row);
    const pct = getPercentage(row) || 18;
    const amc = getAmcCost(row) || (cost * pct) / 100;

    let doiVal = getDoi(row);
    if (doiVal) doiVal = new Date(doiVal).toISOString().substring(0, 10);
    let serviceVal = getServiceUpto(row);
    if (serviceVal) serviceVal = new Date(serviceVal).toISOString().substring(0, 10);

    setClientForm({
      cid: getClientId(row),
      cname: getClientName(row),
      module: getModule(row),
      doi: doiVal || new Date().toISOString().substring(0, 10),
      freeService: Number(row.FreeService || row.freeService || 1),
      serviceUpto: serviceVal || "",
      cost: Number(cost).toFixed(2) as any,
      percentage: Number(pct).toFixed(1) as any,
      amcCost: Number(amc).toFixed(2) as any,
      mobileNumber: getMobile1(row),
      mobileNumber1: getMobile2(row),
      email: row.Email || row.email || "",
    });
    setShowAddEditModal(true);
  };

  const handleSaveClientMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.cname.trim() || !clientForm.module.trim()) {
      showNotification("Please provide Client Name and Module", "warning");
      return;
    }

    try {
      const payload = {
        isFrom: isEditMode ? "EditMode" : "InsertMode",
        cid: clientForm.cid,
        cname: clientForm.cname,
        module: clientForm.module,
        doi: clientForm.doi ? new Date(clientForm.doi) : new Date(),
        freeService: Number(clientForm.freeService) || 1,
        serviceUpto: clientForm.serviceUpto ? new Date(clientForm.serviceUpto) : new Date(),
        cost: Number(clientForm.cost) || 0,
        percentage: Number(clientForm.percentage) || 0,
        amcCost: Number(clientForm.amcCost) || 0,
        mobileNumber: clientForm.mobileNumber,
        mobileNumber1: clientForm.mobileNumber1,
        email: clientForm.email,
      };

      const res = await axios.post(`${baseUrl}AMCLog/SaveClientMaster`, payload);
      if (res.data?.success || res.status === 200) {
        showNotification(res.data?.message || (isEditMode ? "Record updated successfully" : "Client record inserted successfully"), "success");
        setShowAddEditModal(false);
        fetchAmcClients();
      } else {
        showNotification(res.data?.message || "Failed to save client record", "danger");
      }
    } catch (error: any) {
      console.error("SaveClientMaster Error:", error);
      showNotification(error?.response?.data?.message || "Error saving client record", "danger");
    }
  };

  // Handlers for Renewal
  const openRenewalModal = (client?: ClientRecord) => {
    const target = client || selectedClient;
    if (!target) {
      showNotification("Please select an expired client first", "warning");
      return;
    }
    const status = getRowStatus(target);
    if (status !== "EXPIRED") {
      showNotification(`Please select an Expired client to renew. '${getClientName(target)}' is currently ${status === "RUNNING" ? "Running" : "To Be Expire"}.`, "warning");
      return;
    }

    const cost = getCost(target);
    const pct = getPercentage(target) || 18;
    const amc = getAmcCost(target) || (cost * pct) / 100;
    const rawDue = getDueDate(target);
    const lastDue = rawDue ? new Date(rawDue) : new Date();
    const newDue = new Date(lastDue);
    newDue.setFullYear(newDue.getFullYear() + 1);

    setRenewalForm({
      cid: getClientId(target),
      clientName: getClientName(target),
      moduleType: getModule(target),
      cost: Number(cost).toFixed(2) as any,
      percentage: Number(pct).toFixed(1) as any,
      amcCost: Number(amc).toFixed(2) as any,
      lastAmcDueDt: !isNaN(lastDue.getTime()) ? lastDue.toISOString().substring(0, 10) : "",
      newDueDt: !isNaN(newDue.getTime()) ? newDue.toISOString().substring(0, 10) : "",
      paidOn: new Date().toISOString().substring(0, 10),
    });
    setShowRenewalModal(true);
  };

  const handleRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewalForm.cid) {
      showNotification("Client ID is required for renewal", "warning");
      return;
    }

    try {
      const payload = {
        cid: renewalForm.cid,
        clientName: renewalForm.clientName,
        moduleType: renewalForm.moduleType,
        cost: Number(renewalForm.cost) || 0,
        percentage: Number(renewalForm.percentage) || 0,
        amcCost: Number(renewalForm.amcCost) || 0,
        lastAmcDueDt: new Date(renewalForm.lastAmcDueDt),
        newDueDt: new Date(renewalForm.newDueDt),
        paidOn: new Date(renewalForm.paidOn),
      };

      const res = await axios.post(`${baseUrl}AMCLog/RenewalAMC`, payload);
      if (res.data?.success || res.status === 200) {
        showNotification(res.data?.message || "Updated AMC renewal successfully", "success");
        setShowRenewalModal(false);
        fetchAmcClients();
      } else {
        showNotification(res.data?.message || "Failed to update renewal", "danger");
      }
    } catch (error: any) {
      console.error("Renewal Error:", error);
      showNotification(error?.response?.data?.message || "Error submitting AMC renewal", "danger");
    }
  };

  // Handlers for SMS
  const openSmsModal = (client?: ClientRecord) => {
    const target = client || selectedClient;
    if (!target) {
      showNotification("Please select a client record first", "warning");
      return;
    }
    const m1 = getMobile1(target);
    const m2 = getMobile2(target);
    const cName = getClientName(target);
    const mod = getModule(target);
    const status = getRowStatus(target);
    const due = formatDate(getDueDate(target));

    const defaultMsg = status === "EXPIRED"
      ? `Dear ${cName},\nYour AMC regarding ${mod} was expired, please process renewal to avoid service disruption. Regards, DBASE SOLUTIONS`
      : `Dear ${cName},\nYour AMC regarding ${mod} is due on ${due}. Kindly process renewal to ensure uninterrupted support. Regards, DBASE SOLUTIONS`;

    setSmsForm({
      clientId: getClientId(target),
      clientName: cName,
      mobileNumber: m1,
      mobileNumber2: m2,
      sendToMobile1: !!m1,
      sendToMobile2: !!m2,
      message: defaultMsg,
    });
    setShowSmsModal(true);
  };

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    const sendM1 = smsForm.sendToMobile1 ? smsForm.mobileNumber.trim() : "";
    const sendM2 = smsForm.sendToMobile2 ? smsForm.mobileNumber2.trim() : "";

    if (!sendM1 && !sendM2) {
      showNotification("Please check and provide at least one valid mobile number", "warning");
      return;
    }
    if (!smsForm.message.trim()) {
      showNotification("SMS message body cannot be empty", "warning");
      return;
    }

    try {
      const payload = {
        clientId: smsForm.clientId,
        clientName: smsForm.clientName,
        mobileNumber: sendM1 || sendM2,
        mobileNumber2: sendM1 && sendM2 ? sendM2 : "",
        message: smsForm.message.trim(),
      };

      const res = await axios.post(`${baseUrl}AMCLog/SendSMS`, payload);
      if (res.data?.success || res.status === 200) {
        showNotification(res.data?.message || "SMS sent successfully!", "success");
        setShowSmsModal(false);
      } else {
        showNotification(res.data?.message || "Failed to send SMS", "danger");
      }
    } catch (error: any) {
      console.error("SMS error:", error);
      showNotification(error?.response?.data?.message || "Error sending SMS", "danger");
    }
  };

  // Handlers for Settings View
  const openSettings = async () => {
    setShowSettingsModal(true);
    setSettingsLoading(true);
    try {
      const res = await axios.get(`${baseUrl}AMCLog/GetClientDetailsSettings`);
      const data = parseJsonData(res.data);
      setSettingsList(data);
    } catch (error) {
      console.error("Settings error:", error);
      showNotification("Failed to load settings data", "danger");
    } finally {
      setSettingsLoading(false);
    }
  };

  // Delete Client handler in Settings
  const handleDeleteClient = async (cid: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete client "${name}" (ID: ${cid})?`)) {
      return;
    }

    try {
      const res = await axios.post(`${baseUrl}AMCLog/DeleteClient`, { cid });
      if (res.data?.success || res.status === 200) {
        showNotification(res.data?.message || "Record has been deleted successfully", "success");
        openSettings();
        fetchAmcClients();
      } else {
        showNotification(res.data?.message || "Failed to delete client", "danger");
      }
    } catch (error: any) {
      console.error("Delete client error:", error);
      showNotification(error?.response?.data?.message || "Error deleting client", "danger");
    }
  };

  // AMC Info & History modal
  const openClientAmcInfo = async (client?: ClientRecord) => {
    const target = client || selectedArrowClient || selectedClient;
    if (!target) {
      showNotification("Please select a client row first to view AMC Info", "warning");
      return;
    }

    setSelectedClient(target);
    setSelectedHistoryIndex(0);
    setShowInfoModal(true);
    setHistoryLoading(true);

    const cid = getClientId(target);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [histRes, lastRes] = await Promise.all([
        axios.get(`${baseUrl}AMCLog/GetAMCInfo?clientId=${encodeURIComponent(cid)}`, { headers }),
        axios.get(`${baseUrl}AMCLog/GetLastAMC?clientId=${encodeURIComponent(cid)}`, { headers }),
      ]);

      const historyData = parseJsonData(histRes.data);
      const lastData = parseJsonData(lastRes.data);

      setAmcHistory(historyData);
      setLastAmcInfo(lastData.length > 0 ? lastData[0] : null);
    } catch (error) {
      console.error("AMC Info fetch error:", error);
      showNotification("Could not retrieve AMC info for client", "warning");
    } finally {
      setHistoryLoading(false);
    }
  };

  // Logout Handler
  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      window.dispatchEvent(new Event("app:logout"));
    }
  };

  return (
    <IonPage>
      <IonContent scrollY={true} fullscreen className="ion-no-padding">
        <div className="amc-dashboard-container">

          {/* ── Premium Request-Style Hero Header ── */}
          <div className="amc-hero-header">
            <div className="amc-hero-header-left">
              <button className="amc-hero-back-btn" onClick={() => history.goBack()} title="Go Back">
                <IonIcon icon={chevronBackOutline} />
              </button>
              <div>
                <h1 className="amc-hero-title">AMC Log Dashboard</h1>
                <p className="amc-hero-subtitle">MANAGE ALL CLIENT AMCS & DUE DATES</p>
              </div>
            </div>
            <div className="amc-hero-header-right">
              <div className="amc-search-wrapper-hero">
                <IonIcon icon={searchOutline} className="amc-search-icon" />
                <input
                  type="text"
                  className="amc-search-input-hero"
                  placeholder="Search client, module, phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="amc-hero-icon-box" onClick={fetchAmcClients} title="Refresh AMC Data">
                <IonIcon icon={refreshOutline} />
              </div>
            </div>
          </div>

          {/* ── Top Floating Action Tabs (Request Page UI Style) ── */}
          <div className="amc-action-pill-tabs">
            <button
              className="amc-pill-tab"
              onClick={() => openRenewalModal()}
            >
              <IonIcon icon={refreshOutline} className="pill-icon" />
              <span>Renewal AMC</span>
            </button>

            <button
              className={`amc-pill-tab ${statusFilter === "EXPIRED" ? "active" : ""}`}
              onClick={() => setStatusFilter((prev) => (prev === "EXPIRED" ? "ALL" : "EXPIRED"))}
            >
              <IonIcon icon={closeCircleOutline} className="pill-icon" />
              <span>In Active List</span>
            </button>

            <button
              className="amc-pill-tab"
              onClick={() => openSmsModal()}
            >
              <IonIcon icon={sendOutline} className="pill-icon" />
              <span>Send SMS</span>
            </button>

            <button
              className="amc-pill-tab"
              onClick={() => setShowReportsModal(true)}
            >
              <IonIcon icon={documentTextOutline} className="pill-icon" />
              <span>Details Reports</span>
            </button>

            <button
              className="amc-pill-tab"
              onClick={openSettings}
            >
              <IonIcon icon={settingsOutline} className="pill-icon" />
              <span>Settings</span>
            </button>

            <button
              className="amc-pill-tab"
              onClick={openAddClientModal}
            >
              <IonIcon icon={addCircleOutline} className="pill-icon" />
              <span>Add New</span>
            </button>

            <button
              className="amc-pill-tab"
              onClick={() => openClientAmcInfo()}
            >
              <IonIcon icon={informationCircleOutline} className="pill-icon" />
              <span>AMC Info</span>
            </button>
          </div>



          {/* ── Main Grid Container (Full-Width View) ── */}
          <div className="amc-workspace full-grid">
            <div className="amc-content-area">
              <div className="amc-table-header-title">
                <span>DBASE CLIENTS AMC INFO</span>
                <div className="amc-filter-badge-strip">
                  <span
                    className={`amc-filter-pill ${statusFilter === "ALL" ? "active" : ""}`}
                    onClick={() => setStatusFilter("ALL")}
                  >
                    All ({clientList.length})
                  </span>
                  <span
                    className={`amc-filter-pill ${statusFilter === "RUNNING" ? "active" : ""}`}
                    onClick={() => setStatusFilter("RUNNING")}
                  >
                    Running ({runningCount})
                  </span>
                  <span
                    className={`amc-filter-pill ${statusFilter === "TO_EXPIRE" ? "active" : ""}`}
                    onClick={() => setStatusFilter("TO_EXPIRE")}
                  >
                    To Be Expire ({toExpireCount})
                  </span>
                  <span
                    className={`amc-filter-pill ${statusFilter === "EXPIRED" ? "active" : ""}`}
                    onClick={() => setStatusFilter("EXPIRED")}
                  >
                    Expired ({expiredCount})
                  </span>
                </div>
              </div>

              <div className="amc-table-container">
                {loading ? (
                  <div className="amc-loading-state">
                    <IonSpinner name="crescent" color="primary" />
                    <p>Loading AMC Client Data...</p>
                  </div>
                ) : filteredList.length === 0 ? (
                  <div className="amc-empty-state">
                    <IonIcon icon={alertCircleOutline} style={{ fontSize: 36, color: "#94a3b8" }} />
                    <p>No client AMC records match the selected criteria.</p>
                  </div>
                ) : (
                  <table className="amc-table">
                    <thead>
                      <tr>
                        <th style={{ width: 22, minWidth: 22, textAlign: "center", background: "#ffffff" }}></th>
                        <th>CLIENT</th>
                        <th>MODULE</th>
                        <th>DOI</th>
                        <th>FREE SERVICE UPTO</th>
                        <th>DUE DATE</th>
                        <th style={{ textAlign: "right" }}>COST</th>
                        <th style={{ textAlign: "center" }}>Initial AMC(%)</th>
                        <th style={{ textAlign: "right" }}>AMC COST</th>
                        <th>Mobile-1</th>
                        <th>Mobile-2</th>
                        <th style={{ textAlign: "center" }}>Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredList.map((row, idx) => {
                        const status = getRowStatus(row);
                        const isExpired = status === "EXPIRED";
                        const modName = getModule(row);
                        const isBeat = modName.toUpperCase().includes("BEAT");
                        const rowId = `${getClientId(row)}_${getClientName(row)}_${idx}`;

                        // Full row selected via Arrow click (strictly matching clicked row)
                        const isArrowSelected = Boolean(selectedArrowKey && selectedArrowKey === rowId);

                        // Single cell selected
                        const isCellSelected = (colKey: string) =>
                          !isArrowSelected && selectedCell?.rowId === rowId && selectedCell?.colKey === colKey;

                        const statusClass = status === "EXPIRED" ? "row-expired" : status === "TO_EXPIRE" ? "row-to-expire" : "row-running";

                        // Helper for clicking any cell to highlight single cell
                        const onCellSelect = (colKey: string) => {
                          setSelectedCell({ rowId, colKey });
                          setSelectedArrowKey(null);
                          setSelectedArrowClient(null);
                          setSelectedClient(row);
                        };

                        return (
                          <tr
                            key={idx}
                            className={`amc-data-row ${statusClass} ${isArrowSelected ? "row-selected" : ""}`}
                          >
                            <td
                              className="col-indicator-cell"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isArrowSelected) {
                                  setSelectedArrowKey(null);
                                  setSelectedArrowClient(null);
                                  setSelectedClient(null);
                                } else {
                                  setSelectedArrowKey(rowId);
                                  setSelectedArrowClient(row);
                                  setSelectedCell(null); // Clear single-cell selection
                                  setSelectedClient(row);
                                }
                              }}
                              title={isArrowSelected ? "Click to deselect row" : "Click arrow to select complete row"}
                            >
                              {isArrowSelected && <span className="win-grid-arrow" />}
                            </td>
                            <td
                              className={`col-client-cell ${isCellSelected("CLIENT") ? "cell-selected" : ""}`}
                              title={getClientName(row)}
                              onClick={() => onCellSelect("CLIENT")}
                            >
                              <span className="client-name-text">{getClientName(row)}</span>
                            </td>
                            <td
                              className={`col-module-cell ${isCellSelected("MODULE") ? "cell-selected" : ""}`}
                              onClick={() => onCellSelect("MODULE")}
                            >
                              <span className="module-tag">{modName}</span>
                            </td>
                            <td
                              className={`col-date-cell ${isCellSelected("DOI") ? "cell-selected" : ""}`}
                              onClick={() => onCellSelect("DOI")}
                            >
                              {formatDate(getDoi(row))}
                            </td>
                            <td
                              className={`col-date-cell ${isCellSelected("SERVICEUPTO") ? "cell-selected" : ""}`}
                              onClick={() => onCellSelect("SERVICEUPTO")}
                            >
                              {formatDate(getServiceUpto(row))}
                            </td>
                            <td
                              className={`col-due-date-cell ${isCellSelected("DUEDATE") ? "cell-selected" : ""}`}
                              onClick={() => onCellSelect("DUEDATE")}
                            >
                              <span className={`due-date-pill ${statusClass}`}>
                                {formatDate(getDueDate(row))}
                              </span>
                            </td>
                            <td
                              className={`col-cost-cell ${isCellSelected("COST") ? "cell-selected" : ""}`}
                              onClick={() => onCellSelect("COST")}
                            >
                              {getCost(row).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td
                              className={`col-pct-cell ${isCellSelected("PERCENTAGE") ? "cell-selected" : ""}`}
                              onClick={() => onCellSelect("PERCENTAGE")}
                            >
                              {getPercentage(row).toFixed(1)}%
                            </td>
                            <td
                              className={`col-cost-cell amc-cost-val ${isCellSelected("AMCCOST") ? "cell-selected" : ""}`}
                              onClick={() => onCellSelect("AMCCOST")}
                            >
                              {getAmcCost(row).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td
                              className={`col-mobile-cell ${isCellSelected("MOBILE1") ? "cell-selected" : ""}`}
                              onClick={() => onCellSelect("MOBILE1")}
                            >
                              {getMobile1(row) || "--"}
                            </td>
                            <td
                              className={`col-mobile-cell ${isCellSelected("MOBILE2") ? "cell-selected" : ""}`}
                              onClick={() => onCellSelect("MOBILE2")}
                            >
                              {getMobile2(row) || "--"}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <div className="amc-action-cell" style={{ justifyContent: "center" }}>
                                <button
                                  className="amc-edit-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditClientModal(row);
                                  }}
                                  title="Edit Client Master"
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* ── Bottom Summary Status Bar (Professional & Auto-Adopts Theme) ── */}
          <div className="amc-status-bar">
            <div
              className={`amc-stat-card amc-stat-running ${statusFilter === "RUNNING" ? "active-filter" : ""}`}
              onClick={() => setStatusFilter((prev) => (prev === "RUNNING" ? "ALL" : "RUNNING"))}
              title="Filter Running AMCs"
            >
              <span className="amc-stat-label">RUNNING :</span>
              <span className="amc-stat-badge green">{runningCount}</span>
            </div>

            <div
              className={`amc-stat-card amc-stat-expire ${statusFilter === "TO_EXPIRE" ? "active-filter" : ""}`}
              onClick={() => setStatusFilter((prev) => (prev === "TO_EXPIRE" ? "ALL" : "TO_EXPIRE"))}
              title="Filter AMCs Expiring Soon"
            >
              <span className="amc-stat-label">TO BE EXPIRE :</span>
              <span className="amc-stat-badge purple blink-to-expire-badge">{toExpireCount}</span>
            </div>

            <div
              className={`amc-stat-card amc-stat-expired ${statusFilter === "EXPIRED" ? "active-filter" : ""}`}
              onClick={() => setStatusFilter((prev) => (prev === "EXPIRED" ? "ALL" : "EXPIRED"))}
              title="Filter Expired AMCs"
            >
              <span className="amc-stat-label">EXPIRED :</span>
              <span className="amc-stat-badge red blink-expired-badge">{expiredCount}</span>
            </div>
          </div>
        </div>

        {/* ════════════════════ MODALS ════════════════════ */}

        {/* ── 1. Modern Trendy Add / Edit Client Master Modal ── */}
        {showAddEditModal && (
          <div className="amc-modal-overlay" onClick={() => setShowAddEditModal(false)}>
            <div
              className="amc-modal-box amc-trendy-modal-card amc-trendy-modal-lg"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="amc-trendy-header">
                <div className="amc-trendy-header-left">
                  <div className="amc-trendy-header-icon edit-icon">
                    <IonIcon icon={isEditMode ? createOutline : addCircleOutline} />
                  </div>
                  <div>
                    <h3 className="amc-trendy-title">
                      {isEditMode ? "Edit AMC Record" : "Add New AMC Record"}
                    </h3>
                    <p className="amc-trendy-subtitle">
                      {isEditMode
                        ? "Update client contract & service terms"
                        : "Register new client & initial AMC parameters"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="amc-trendy-close-btn"
                  onClick={() => setShowAddEditModal(false)}
                  title="Close"
                >
                  <IonIcon icon={closeOutline} />
                </button>
              </div>

              <form onSubmit={handleSaveClientMaster}>
                <div className="amc-trendy-body">
                  {/* Group 1: Client & Module */}
                  <div className="amc-trendy-form-section">
                    <div className="amc-trendy-section-header">
                      <IonIcon icon={businessOutline} />
                      <span>Client &amp; System Information</span>
                    </div>

                    <div className="amc-trendy-field-grid">
                      <div className="amc-trendy-input-group">
                        <label className="amc-trendy-label">
                          Client Name <span className="req-dot">*</span>
                        </label>
                        <div className={`amc-trendy-input-wrapper ${isEditMode ? "readonly" : ""}`}>
                          <input
                            type="text"
                            required
                            autoFocus={!isEditMode}
                            readOnly={isEditMode}
                            tabIndex={isEditMode ? -1 : 0}
                            className="amc-trendy-input"
                            placeholder="Enter client name"
                            value={clientForm.cname}
                            onChange={(e) => !isEditMode && setClientForm({ ...clientForm, cname: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="amc-trendy-input-group">
                        <label className="amc-trendy-label">
                          Type Of Module <span className="req-dot">*</span>
                        </label>
                        <div className={`amc-trendy-input-wrapper ${isEditMode ? "readonly" : ""}`}>
                          <input
                            type="text"
                            required
                            readOnly={isEditMode}
                            tabIndex={isEditMode ? -1 : 0}
                            className="amc-trendy-input"
                            placeholder="e.g. BEAT / BILLING"
                            value={clientForm.module}
                            onChange={(e) => !isEditMode && setClientForm({ ...clientForm, module: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Group 2: Implementation & Free Service */}
                  <div className="amc-trendy-form-section">
                    <div className="amc-trendy-section-header">
                      <IonIcon icon={calendarOutline} />
                      <span>Implementation &amp; Warranty Period</span>
                    </div>

                    <div className="amc-trendy-field-grid three-col">
                      <div className="amc-trendy-input-group">
                        <label className="amc-trendy-label">
                          D O I <span className="label-tip">(Date of Impl.)</span>
                        </label>
                        <div className={`amc-trendy-input-wrapper ${isEditMode ? "readonly" : ""}`}>
                          <input
                            type="date"
                            readOnly={isEditMode}
                            disabled={isEditMode}
                            tabIndex={isEditMode ? -1 : 0}
                            className="amc-trendy-input date-input"
                            value={clientForm.doi}
                            onChange={(e) => {
                              if (isEditMode) return;
                              const val = e.target.value;
                              const yr = Number(clientForm.freeService) || 0;
                              let next = val;
                              if (val && yr > 0) {
                                const d = new Date(val);
                                d.setFullYear(d.getFullYear() + yr);
                                next = d.toISOString().substring(0, 10);
                              }
                              setClientForm({ ...clientForm, doi: val, serviceUpto: next });
                            }}
                          />
                        </div>
                      </div>

                      <div className="amc-trendy-input-group">
                        <label className="amc-trendy-label">
                          Free Duration <span className="label-tip">(Years)</span>
                        </label>
                        <div className={`amc-trendy-input-wrapper ${isEditMode ? "readonly" : ""}`}>
                          <input
                            type={isEditMode ? "text" : "number"}
                            min="0"
                            step="1"
                            placeholder="e.g. 1"
                            readOnly={isEditMode}
                            tabIndex={isEditMode ? -1 : 0}
                            className="amc-trendy-input"
                            value={clientForm.freeService}
                            onChange={(e) => {
                              if (isEditMode) return;
                              const val = e.target.value;
                              const yr = Number(val) || 0;
                              let next = clientForm.doi;
                              if (clientForm.doi && yr > 0) {
                                const d = new Date(clientForm.doi);
                                d.setFullYear(d.getFullYear() + yr);
                                next = d.toISOString().substring(0, 10);
                              }
                              setClientForm({ ...clientForm, freeService: val as any, serviceUpto: next });
                            }}
                          />
                          <span className="amc-trendy-suffix">Yrs</span>
                        </div>
                      </div>

                      <div className="amc-trendy-input-group">
                        <label className="amc-trendy-label">
                          Free Service UpTo
                        </label>
                        <div className="amc-trendy-input-wrapper readonly highlight">
                          <input
                            type="date"
                            readOnly={true}
                            tabIndex={-1}
                            className="amc-trendy-input date-input"
                            value={clientForm.serviceUpto}
                            style={{ pointerEvents: "none" }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Group 3: Financial & AMC Pricing */}
                  <div className="amc-trendy-form-section">
                    <div className="amc-trendy-section-header">
                      <IonIcon icon={cashOutline} />
                      <span>Cost &amp; AMC Calculation</span>
                    </div>

                    <div className="amc-trendy-field-grid three-col">
                      <div className="amc-trendy-input-group">
                        <label className="amc-trendy-label">
                          Base Cost
                        </label>
                        <div className={`amc-trendy-input-wrapper ${isEditMode ? "readonly" : ""}`}>
                          <span className="amc-trendy-prefix">₹</span>
                          <input
                            type={isEditMode ? "text" : "number"}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            readOnly={isEditMode}
                            tabIndex={isEditMode ? -1 : 0}
                            className="amc-trendy-input"
                            value={isEditMode && !isNaN(Number(clientForm.cost)) ? Number(clientForm.cost).toFixed(2) : clientForm.cost}
                            onChange={(e) => {
                              if (isEditMode) return;
                              const val = e.target.value;
                              const cost = Number(val) || 0;
                              const pct = Number(clientForm.percentage) || 0;
                              const amc = cost && pct ? ((cost * pct) / 100).toFixed(2) : clientForm.amcCost;
                              setClientForm({ ...clientForm, cost: val as any, amcCost: amc as any });
                            }}
                            onBlur={() => {
                              if (!isEditMode && clientForm.cost !== "" && !isNaN(Number(clientForm.cost))) {
                                setClientForm((prev) => ({ ...prev, cost: Number(prev.cost).toFixed(2) }));
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="amc-trendy-input-group">
                        <label className="amc-trendy-label">
                          % Of AMC
                        </label>
                        <div className={`amc-trendy-input-wrapper ${isEditMode ? "readonly" : ""}`}>
                          <input
                            type={isEditMode ? "text" : "number"}
                            min="0"
                            step="0.1"
                            placeholder="e.g. 15"
                            readOnly={isEditMode}
                            tabIndex={isEditMode ? -1 : 0}
                            className="amc-trendy-input"
                            value={isEditMode && !isNaN(Number(clientForm.percentage)) ? Number(clientForm.percentage).toFixed(1) : clientForm.percentage}
                            onChange={(e) => {
                              if (isEditMode) return;
                              const val = e.target.value;
                              const pct = Number(val) || 0;
                              const cost = Number(clientForm.cost) || 0;
                              const amc = cost && pct ? ((cost * pct) / 100).toFixed(2) : clientForm.amcCost;
                              setClientForm({ ...clientForm, percentage: val as any, amcCost: amc as any });
                            }}
                            onBlur={() => {
                              if (!isEditMode && clientForm.percentage !== "" && !isNaN(Number(clientForm.percentage))) {
                                setClientForm((prev) => ({ ...prev, percentage: Number(prev.percentage).toFixed(1) }));
                              }
                            }}
                          />
                          <span className="amc-trendy-suffix">%</span>
                        </div>
                      </div>

                      <div className="amc-trendy-input-group">
                        <label className="amc-trendy-label">
                          AMC Cost
                        </label>
                        <div className={`amc-trendy-input-wrapper highlight ${isEditMode ? "readonly" : ""}`}>
                          <span className="amc-trendy-prefix">₹</span>
                          <input
                            type={isEditMode ? "text" : "number"}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            readOnly={isEditMode}
                            tabIndex={isEditMode ? -1 : 0}
                            className="amc-trendy-input"
                            value={isEditMode && !isNaN(Number(clientForm.amcCost)) ? Number(clientForm.amcCost).toFixed(2) : clientForm.amcCost}
                            onChange={(e) => {
                              if (isEditMode) return;
                              const val = e.target.value;
                              const amc = Number(val) || 0;
                              const cost = Number(clientForm.cost) || 0;
                              const pct = cost > 0 && amc ? ((amc / cost) * 100).toFixed(1) : clientForm.percentage;
                              setClientForm({ ...clientForm, amcCost: val as any, percentage: pct as any });
                            }}
                            onBlur={() => {
                              if (!isEditMode && clientForm.amcCost !== "" && !isNaN(Number(clientForm.amcCost))) {
                                setClientForm((prev) => ({ ...prev, amcCost: Number(prev.amcCost).toFixed(2) }));
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="amc-trendy-calc-preview">
                      <IonIcon icon={sparklesOutline} />
                      <span>
                        Calculation: <b>{clientForm.percentage || 0}%</b> of ₹{Number(clientForm.cost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} = <b className="highlight-text">₹{Number(clientForm.amcCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
                      </span>
                    </div>
                  </div>

                  {/* Group 4: Contact Information */}
                  <div className="amc-trendy-form-section">
                    <div className="amc-trendy-section-header">
                      <IonIcon icon={callOutline} />
                      <span>Contact &amp; Notification Details</span>
                    </div>

                    <div className="amc-trendy-field-grid three-col">
                      <div className="amc-trendy-input-group">
                        <label className="amc-trendy-label">Mobile Number - 1</label>
                        <div className="amc-trendy-input-wrapper">
                          <input
                            type="tel"
                            className="amc-trendy-input"
                            placeholder="e.g. 9876543210"
                            value={clientForm.mobileNumber}
                            onChange={(e) => setClientForm({ ...clientForm, mobileNumber: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="amc-trendy-input-group">
                        <label className="amc-trendy-label">Mobile Number - 2</label>
                        <div className="amc-trendy-input-wrapper">
                          <input
                            type="tel"
                            className="amc-trendy-input"
                            placeholder="Optional alternate"
                            value={clientForm.mobileNumber1}
                            onChange={(e) => setClientForm({ ...clientForm, mobileNumber1: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="amc-trendy-input-group">
                        <label className="amc-trendy-label">Email Address</label>
                        <div className="amc-trendy-input-wrapper">
                          <input
                            type="email"
                            className="amc-trendy-input"
                            placeholder="client@example.com"
                            value={clientForm.email}
                            onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="amc-trendy-footer">
                  <button
                    type="button"
                    className="amc-trendy-btn-cancel"
                    onClick={() => setShowAddEditModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="amc-trendy-btn-clear"
                    onClick={() => {
                      if (isEditMode) {
                        setClientForm((prev) => ({
                          ...prev,
                          mobileNumber: "",
                          mobileNumber1: "",
                          email: "",
                        }));
                      } else {
                        const today = new Date().toISOString().substring(0, 10);
                        setClientForm({
                          cid: "",
                          cname: "",
                          module: "",
                          doi: today,
                          freeService: "" as any,
                          serviceUpto: today,
                          cost: "" as any,
                          percentage: "" as any,
                          amcCost: "" as any,
                          mobileNumber: "",
                          mobileNumber1: "",
                          email: "",
                        });
                      }
                    }}
                  >
                    Clear
                  </button>
                  <button type="submit" className="amc-trendy-btn-submit">
                    <IonIcon icon={checkmarkCircleOutline} />
                    <span>{isEditMode ? "Save" : "Save"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── 2. Modern Trendy AMC Renewal Modal ── */}
        {showRenewalModal && (
          <div className="amc-modal-overlay" onClick={() => setShowRenewalModal(false)}>
            <div
              className="amc-modal-box amc-trendy-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="amc-trendy-header">
                <div className="amc-trendy-header-left">
                  <div className="amc-trendy-header-icon">
                    <IonIcon icon={refreshOutline} />
                  </div>
                  <div>
                    <h3 className="amc-trendy-title">Renewal AMC</h3>
                    <p className="amc-trendy-subtitle">Contract Extension & Payment Settlement</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="amc-trendy-close-btn"
                  onClick={() => setShowRenewalModal(false)}
                  title="Close"
                >
                  <IonIcon icon={closeOutline} />
                </button>
              </div>

              <form onSubmit={handleRenewalSubmit}>
                <div className="amc-trendy-body">
                  {/* Client Overview Card */}
                  <div className="amc-trendy-client-card">
                    <div className="amc-trendy-client-info">
                      <div className="amc-trendy-avatar">
                        <IonIcon icon={businessOutline} />
                      </div>
                      <div className="amc-trendy-client-names">
                        <span className="amc-trendy-client-name">{renewalForm.clientName || "Client"}</span>
                        <div className="amc-trendy-client-badges">
                          <span className="amc-trendy-badge-module">{renewalForm.moduleType || "Module"}</span>
                          {renewalForm.cid && (
                            <span className="amc-trendy-badge-id">ID: #{renewalForm.cid}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="amc-trendy-client-cost-stat">
                      <span className="stat-label">Contract Cost</span>
                      <span className="stat-val">
                        ₹{!isNaN(Number(renewalForm.cost)) ? Number(renewalForm.cost).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : renewalForm.cost}
                      </span>
                    </div>
                  </div>

                  {/* Date Timeline Banner */}
                  <div className="amc-trendy-timeline-card">
                    <div className="amc-trendy-time-col">
                      <span className="timeline-col-label">
                        <IonIcon icon={calendarOutline} /> Last Due Date
                      </span>
                      <div className="timeline-col-val">
                        {renewalForm.lastAmcDueDt ? formatDate(renewalForm.lastAmcDueDt) : "N/A"}
                      </div>
                    </div>

                    <div className="amc-trendy-timeline-arrow">
                      <span className="arrow-chip">+1 Year</span>
                      <IonIcon icon={arrowForwardOutline} />
                    </div>

                    <div className="amc-trendy-time-col highlight">
                      <span className="timeline-col-label">
                        <IonIcon icon={calendarOutline} /> New Due Date
                      </span>
                      <div className="timeline-col-val highlight">
                        {renewalForm.newDueDt ? formatDate(renewalForm.newDueDt) : "N/A"}
                      </div>
                    </div>
                  </div>

                  {/* Financial & Calculation Grid */}
                  <div className="amc-trendy-calc-section">
                    <div className="amc-trendy-field-grid">
                      {/* % Of AMC */}
                      <div className="amc-trendy-input-group">
                        <label className="amc-trendy-label">
                          % Of AMC
                          <span className="label-tip">Rate</span>
                        </label>
                        <div className="amc-trendy-input-wrapper">
                          <input
                            type="text"
                            inputMode="decimal"
                            className="amc-trendy-input"
                            value={renewalForm.percentage}
                            placeholder="e.g. 15"
                            onBlur={() => {
                              const p = Number(renewalForm.percentage);
                              if (!isNaN(p)) {
                                setRenewalForm((prev) => ({ ...prev, percentage: p.toFixed(1) as any }));
                              }
                            }}
                            onChange={(e) => {
                              const val = e.target.value;
                              const p = Number(val) || 0;
                              const c = Number(renewalForm.cost) || 0;
                              const calcAmc = (c * p) / 100;
                              setRenewalForm({
                                ...renewalForm,
                                percentage: val as any,
                                amcCost: calcAmc.toFixed(2) as any,
                              });
                            }}
                          />
                          <span className="amc-trendy-suffix">%</span>
                        </div>
                      </div>

                      {/* AMC Cost */}
                      <div className="amc-trendy-input-group">
                        <label className="amc-trendy-label">
                          AMC Cost
                          <span className="label-tip">Annual Fee</span>
                        </label>
                        <div className="amc-trendy-input-wrapper highlight">
                          <span className="amc-trendy-prefix">₹</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="amc-trendy-input"
                            value={renewalForm.amcCost}
                            placeholder="0.00"
                            onBlur={() => {
                              const a = Number(renewalForm.amcCost);
                              if (!isNaN(a)) {
                                setRenewalForm((prev) => ({ ...prev, amcCost: a.toFixed(2) as any }));
                              }
                            }}
                            onChange={(e) => {
                              const val = e.target.value;
                              const a = Number(val) || 0;
                              const c = Number(renewalForm.cost) || 0;
                              const p = c > 0 ? (a / c) * 100 : 0;
                              setRenewalForm({
                                ...renewalForm,
                                amcCost: val as any,
                                percentage: p.toFixed(1) as any,
                              });
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="amc-trendy-calc-preview">
                      <IonIcon icon={sparklesOutline} />
                      <span>
                        Calculation: <b>{renewalForm.percentage || 0}%</b> of ₹{Number(renewalForm.cost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} = <b className="highlight-text">₹{Number(renewalForm.amcCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
                      </span>
                    </div>
                  </div>

                  {/* Payment Settlement Date */}
                  <div className="amc-trendy-payment-section">
                    <div className="amc-trendy-input-group full-width">
                      <div className="amc-trendy-label-row">
                        <label className="amc-trendy-label">
                          <IonIcon icon={cashOutline} style={{ color: "var(--ion-color-primary, #588157)", marginRight: 4 }} />
                          Paid On Date <span className="req-dot">*</span>
                        </label>
                        <button
                          type="button"
                          className="amc-trendy-today-chip"
                          onClick={() => setRenewalForm((prev) => ({ ...prev, paidOn: new Date().toISOString().substring(0, 10) }))}
                        >
                          Set Today
                        </button>
                      </div>
                      <div className="amc-trendy-input-wrapper">
                        <input
                          type="date"
                          required
                          className="amc-trendy-input date-input"
                          value={renewalForm.paidOn}
                          onChange={(e) => setRenewalForm({ ...renewalForm, paidOn: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="amc-trendy-footer">
                  <button
                    type="button"
                    className="amc-trendy-btn-cancel amc-renewal-btn-close"
                    onClick={() => setShowRenewalModal(false)}
                  >
                    <IonIcon icon={closeCircleOutline} />
                    <span>Close</span>
                  </button>
                  <button type="submit" className="amc-trendy-btn-submit amc-renewal-btn-save">
                    <IonIcon icon={checkmarkCircleOutline} />
                    <span>Save</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── 3. Modern Trendy Send SMS Modal ── */}
        {showSmsModal && (
          <div className="amc-modal-overlay" onClick={() => setShowSmsModal(false)}>
            <div
              className="amc-modal-box amc-trendy-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="amc-trendy-header">
                <div className="amc-trendy-header-left">
                  <div className="amc-trendy-header-icon sms-icon">
                    <IonIcon icon={sendOutline} />
                  </div>
                  <div>
                    <h3 className="amc-trendy-title">Send SMS Alert</h3>
                    <p className="amc-trendy-subtitle">Dispatch AMC renewal reminder notifications</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="amc-trendy-close-btn"
                  onClick={() => setShowSmsModal(false)}
                  title="Close"
                >
                  <IonIcon icon={closeOutline} />
                </button>
              </div>

              <form onSubmit={handleSendSms}>
                <div className="amc-trendy-body">
                  {/* Recipients Selection */}
                  <div className="amc-trendy-form-section">
                    <div className="amc-trendy-section-header">
                      <IonIcon icon={callOutline} />
                      <span>Select Mobile Recipients</span>
                    </div>

                    <div className="amc-trendy-field-grid">
                      {/* Mobile 1 Card */}
                      <div className={`amc-trendy-recipient-card ${smsForm.sendToMobile1 ? "selected" : ""}`}>
                        <label className="amc-trendy-check-row">
                          <input
                            type="checkbox"
                            checked={smsForm.sendToMobile1}
                            onChange={(e) => setSmsForm({ ...smsForm, sendToMobile1: e.target.checked })}
                          />
                          <span className="recipient-label">Primary Mobile</span>
                        </label>
                        <div className="amc-trendy-input-wrapper">
                          <span className="amc-trendy-prefix">
                            <IonIcon icon={callOutline} />
                          </span>
                          <input
                            type="tel"
                            placeholder="Enter 10-digit mobile"
                            className="amc-trendy-input"
                            value={smsForm.mobileNumber}
                            onChange={(e) => setSmsForm({ ...smsForm, mobileNumber: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* Mobile 2 Card */}
                      <div className={`amc-trendy-recipient-card ${smsForm.sendToMobile2 ? "selected" : ""}`}>
                        <label className="amc-trendy-check-row">
                          <input
                            type="checkbox"
                            checked={smsForm.sendToMobile2}
                            onChange={(e) => setSmsForm({ ...smsForm, sendToMobile2: e.target.checked })}
                          />
                          <span className="recipient-label">Secondary Mobile</span>
                        </label>
                        <div className="amc-trendy-input-wrapper">
                          <span className="amc-trendy-prefix">
                            <IonIcon icon={callOutline} />
                          </span>
                          <input
                            type="tel"
                            placeholder="Enter alternate mobile"
                            className="amc-trendy-input"
                            value={smsForm.mobileNumber2}
                            onChange={(e) => setSmsForm({ ...smsForm, mobileNumber2: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Message Content Area */}
                  <div className="amc-trendy-form-section">
                    <div className="amc-trendy-label-row">
                      <div className="amc-trendy-section-header" style={{ marginBottom: 0 }}>
                        <IonIcon icon={chatboxEllipsesOutline} />
                        <span>SMS Message Content</span>
                      </div>
                      <span className="amc-sms-counter-badge">
                        {smsForm.message.length} chars ({Math.ceil((smsForm.message.length || 1) / 160)} SMS)
                      </span>
                    </div>

                    <div className="amc-trendy-textarea-wrap">
                      <textarea
                        className="amc-trendy-textarea"
                        rows={5}
                        placeholder="Type notification text..."
                        value={smsForm.message}
                        onChange={(e) => setSmsForm({ ...smsForm, message: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="amc-trendy-footer">
                  <button
                    type="button"
                    className="amc-trendy-btn-cancel"
                    onClick={() => setShowSmsModal(false)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="amc-trendy-btn-clear"
                    onClick={() => setSmsForm((prev) => ({ ...prev, message: "" }))}
                  >
                    Clear Text
                  </button>
                  <button type="submit" className="amc-trendy-btn-submit">
                    <IonIcon icon={sendOutline} />
                    <span>Send SMS</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── 4. Settings / Admin Client Master Modal ── */}
        {showSettingsModal && (
          <div className="amc-modal-overlay" onClick={() => setShowSettingsModal(false)}>
            <div className="amc-modal-box large" onClick={(e) => e.stopPropagation()}>
              <div className="amc-modal-header">
                <h2>
                  <IonIcon icon={settingsOutline} />
                  Client Details Settings & Master Database
                </h2>
                <button className="amc-modal-close-btn" onClick={() => setShowSettingsModal(false)}>
                  <IonIcon icon={closeOutline} />
                </button>
              </div>

              <div className="amc-modal-body">
                {settingsLoading ? (
                  <div className="amc-loading-state">
                    <IonSpinner name="crescent" color="primary" />
                    <p>Loading Admin Client Details...</p>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="amc-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Client Name</th>
                          <th>Module</th>
                          <th>DOI</th>
                          <th>Free Upto</th>
                          <th>Cost</th>
                          <th>AMC %</th>
                          <th>AMC Cost</th>
                          <th>Contact 1</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {settingsList.length === 0 ? (
                          <tr>
                            <td colSpan={10} style={{ textAlign: "center", padding: 20 }}>
                              No client records found.
                            </td>
                          </tr>
                        ) : (
                          settingsList.map((row, i) => (
                            <tr key={i}>
                              <td>{getClientId(row)}</td>
                              <td style={{ fontWeight: 600 }}>{getClientName(row)}</td>
                              <td>{getModule(row)}</td>
                              <td>{formatDate(getDoi(row))}</td>
                              <td>{formatDate(getServiceUpto(row))}</td>
                              <td>{getCost(row).toFixed(2)}</td>
                              <td>{getPercentage(row)}%</td>
                              <td>{getAmcCost(row).toFixed(2)}</td>
                              <td>{getMobile1(row)}</td>
                              <td>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    className="amc-edit-btn"
                                    onClick={() => {
                                      setShowSettingsModal(false);
                                      openEditClientModal(row);
                                    }}
                                  >
                                    <IonIcon icon={createOutline} />
                                  </button>
                                  <button
                                    className="amc-btn-danger"
                                    style={{ padding: "3px 8px", fontSize: 11 }}
                                    onClick={() => handleDeleteClient(getClientId(row), getClientName(row))}
                                    title="Delete Client Record"
                                  >
                                    <IonIcon icon={trashOutline} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="amc-modal-footer">
                <button className="amc-btn-secondary" onClick={() => setShowSettingsModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 5. Modern Trendy Client AMC History / Info Modal ── */}
        {showInfoModal && (
          <div className="amc-modal-overlay" onClick={() => setShowInfoModal(false)}>
            <div
              className="amc-modal-box amc-trendy-modal-card amc-trendy-modal-lg"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="amc-trendy-header">
                <div className="amc-trendy-header-left">
                  <div className="amc-trendy-header-icon history-icon">
                    <IonIcon icon={timeOutline} />
                  </div>
                  <div>
                    <h3 className="amc-trendy-title">AMC Paid History</h3>
                    <p className="amc-trendy-subtitle">Complete historical renewal ledger &amp; audit trail</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="amc-trendy-close-btn"
                  onClick={() => setShowInfoModal(false)}
                  title="Close"
                >
                  <IonIcon icon={closeOutline} />
                </button>
              </div>

              <div className="amc-trendy-body">
                {/* Client Overview Card */}
                {selectedClient && (
                  <div className="amc-trendy-client-card">
                    <div className="amc-trendy-client-info">
                      <div className="amc-trendy-avatar">
                        <IonIcon icon={businessOutline} />
                      </div>
                      <div className="amc-trendy-client-names">
                        <span className="amc-trendy-client-name">{getClientName(selectedClient)}</span>
                        <div className="amc-trendy-client-badges">
                          <span className="amc-trendy-badge-module">{getModule(selectedClient)}</span>
                          {getClientId(selectedClient) && (
                            <span className="amc-trendy-badge-id">ID: #{getClientId(selectedClient)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="amc-trendy-client-cost-stat">
                      <span className="stat-label">Contract Cost</span>
                      <span className="stat-val">
                        ₹{getCost(selectedClient).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}

                {/* History Table Container */}
                <div className="amc-trendy-table-card">
                  {historyLoading ? (
                    <div className="amc-loading-state" style={{ padding: "32px 0" }}>
                      <IonSpinner name="crescent" color="primary" />
                      <p style={{ marginTop: 10, fontSize: 13, color: "#64748b" }}>Loading AMC Payment History...</p>
                    </div>
                  ) : amcHistory.length === 0 ? (
                    <div className="amc-empty-state" style={{ padding: "32px 0", textAlign: "center" }}>
                      <IonIcon icon={timeOutline} style={{ fontSize: 36, color: "#94a3b8", marginBottom: 8 }} />
                      <p style={{ fontSize: 13.5, color: "#64748b", margin: 0 }}>No historical AMC payment records found for this client.</p>
                    </div>
                  ) : (
                    <div className="amc-trendy-table-scroll">
                      <table className="amc-trendy-history-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Paid On</th>
                            <th style={{ textAlign: "right" }}>AMC %</th>
                            <th>Last AMC Due Date</th>
                            <th>New Due Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {amcHistory.map((item, idx) => {
                            const isHistorySelected = selectedHistoryIndex === idx;
                            return (
                              <tr
                                key={idx}
                                className={isHistorySelected ? "active-row" : ""}
                                onClick={() => setSelectedHistoryIndex(idx)}
                              >
                                <td className="row-num">{idx + 1}</td>
                                <td>
                                  <div className="table-date-badge">
                                    <IonIcon icon={calendarOutline} />
                                    <span>{formatDate(item.PaidOn || item.PaidOnDt || item.paidOn || item.PAIDON)}</span>
                                  </div>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  <span className="table-pct-chip">
                                    {Number(item.PercentageofAmc || item.PercentageOfAmc || item.PerCentage || item.Percentage || item.percentage || 0).toFixed(1)}%
                                  </span>
                                </td>
                                <td>
                                  <span className="table-date-text">
                                    {formatDate(item.LastAmcDueDt || item.lastAmcDueDt || item.LastDueDate || item.LASTAMCDUEDT)}
                                  </span>
                                </td>
                                <td>
                                  <span className="table-date-text highlight">
                                    {formatDate(item.NewDueDt || item.newDueDt || item.DueDate || item.NEWDUEDT)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Summary Bar */}
                  <div className="amc-trendy-table-summary">
                    <span>Total Logs: <b>{amcHistory.length}</b></span>
                    {amcHistory.length > 0 && (
                      <span className="latest-log-tag">
                        Latest Payment: <b>{formatDate(amcHistory[0]?.PaidOn || amcHistory[0]?.PaidOnDt || amcHistory[0]?.paidOn)}</b>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="amc-trendy-footer">
                <button
                  type="button"
                  className="amc-trendy-btn-cancel"
                  onClick={() => setShowInfoModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 6. Details Reports Modal ── */}
        {showReportsModal && (
          <div className="amc-modal-overlay" onClick={() => setShowReportsModal(false)}>
            <div className="amc-modal-box large" onClick={(e) => e.stopPropagation()}>
              <div className="amc-modal-header">
                <h2>
                  <IonIcon icon={documentTextOutline} />
                  AMC Details Summary & Revenue Breakdown
                </h2>
                <button className="amc-modal-close-btn" onClick={() => setShowReportsModal(false)}>
                  <IonIcon icon={closeOutline} />
                </button>
              </div>

              <div className="amc-modal-body">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                  <div style={{ background: "#f0f9ff", padding: 12, borderRadius: 8, border: "1px solid #bae6fd" }}>
                    <div style={{ fontSize: 11, color: "#0369a1", fontWeight: 600 }}>TOTAL CLIENTS</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#0284c7" }}>{clientList.length}</div>
                  </div>
                  <div style={{ background: "#f0fdf4", padding: 12, borderRadius: 8, border: "1px solid #bbf7d0" }}>
                    <div style={{ fontSize: 11, color: "#15803d", fontWeight: 600 }}>RUNNING AMC</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#16a34a" }}>{runningCount}</div>
                  </div>
                  <div style={{ background: "#faf5ff", padding: 12, borderRadius: 8, border: "1px solid #e9d5ff" }}>
                    <div style={{ fontSize: 11, color: "#7e22ce", fontWeight: 600 }}>TO BE EXPIRED (30D)</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#9333ea" }}>{toExpireCount}</div>
                  </div>
                  <div style={{ background: "#fef2f2", padding: 12, borderRadius: 8, border: "1px solid #fecaca" }}>
                    <div style={{ fontSize: 11, color: "#b91c1c", fontWeight: 600 }}>EXPIRED AMC</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#dc2626" }}>{expiredCount}</div>
                  </div>
                </div>

                <table className="amc-table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Module</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Annual AMC Cost (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientList.map((c, i) => {
                      const st = getRowStatus(c);
                      return (
                        <tr key={i}>
                          <td>{getClientName(c)}</td>
                          <td>{getModule(c)}</td>
                          <td>{formatDate(getDueDate(c))}</td>
                          <td>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 10,
                                fontSize: 10,
                                fontWeight: 700,
                                background: st === "RUNNING" ? "#dcfce7" : st === "TO_EXPIRE" ? "#f3e8ff" : "#fee2e2",
                                color: st === "RUNNING" ? "#15803d" : st === "TO_EXPIRE" ? "#7e22ce" : "#b91c1c",
                              }}
                            >
                              {st}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700 }}>
                            {getAmcCost(c).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="amc-modal-footer">
                <button className="amc-btn-secondary" onClick={() => setShowReportsModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Toast Notification ── */}
        <IonToast
          isOpen={toast.show}
          message={toast.msg}
          color={toast.color}
          duration={3000}
          onDidDismiss={() => setToast({ ...toast, show: false })}
          position="top"
        />
      </IonContent>
    </IonPage>
  );
};

export default AMClogDashboard;
