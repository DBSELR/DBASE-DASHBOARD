import React, { useState, useEffect, useRef } from "react";
import {
  IonPage,
  IonContent,
  IonIcon,
  IonSpinner,
  IonToast,
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import {
  ChevronLeft,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  History,
  FileText,
  Calendar,
  DollarSign,
  AlertTriangle,
  User,
  Filter,
  Search,
  Upload,
  X,
  Bell,
} from "lucide-react";
import {
  walletOutline,
  receiptOutline,
  timeOutline,
  alertCircleOutline,
  cloudUploadOutline,
} from "ionicons/icons";
import { API_BASE } from "../config";
import "./PaymentReminders.css";

interface PaymentReminder {
  id: number;
  name: string;
  category: string;
  provider: string;
  cost: number;
  currency: string;
  renewalCycle: string;
  expiryDate: string;
  reminderThresholds: string;
  notifyEmpCodes: string;
  status: string;
  remarks: string;
  createdBy: string;
  createdDate: string;
  lastPaymentDate?: string;
}

interface PaymentHistoryLog {
  id: number;
  reminderId: number;
  paymentDate: string;
  paidAmount: number;
  currency: string;
  paidByEmpCode: string;
  receiptAttachment: string;
  paymentMethod: string;
  remarks: string;
}

const CATEGORIES = [
  "Domain",
  "Server",
  "SSL",
  "Monthly Recharge",
  "License",
  "Rent",
  "Other",
];

const CURRENCIES = ["INR", "USD", "EUR"];

const RENEWAL_CYCLES = [
  "Monthly",
  "Quarterly",
  "Half-Yearly",
  "Annually",
  "One-Time",
];

const THRESHOLD_OPTIONS = [
  { value: 30, label: "30 Days Before (1 Month)" },
  { value: 7, label: "7 Days Before (1 Week)" },
  { value: 3, label: "3 Days Before" },
  { value: 1, label: "1 Day Before" },
  { value: 0, label: "On the Due Day" },
];

const PaymentReminders: React.FC = () => {
  const history = useHistory();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Current logged in user info
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Main list & loading state
  const [reminders, setReminders] = useState<PaymentReminder[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters State
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dueFilter, setDueFilter] = useState<string>("all"); // 'all', 'due_soon', 'overdue', 'active'

  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState<boolean>(false);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Form State - Add / Edit
  const [editReminderId, setEditReminderId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Domain");
  const [formProvider, setFormProvider] = useState("");
  const [formCost, setFormCost] = useState<number>(0);
  const [formCurrency, setFormCurrency] = useState("INR");
  const [formRenewalCycle, setFormRenewalCycle] = useState("Monthly");
  const [formExpiryDate, setFormExpiryDate] = useState("");
  const [formRemarks, setFormRemarks] = useState("");
  const [formStatus, setFormStatus] = useState("Active");
  const [formThresholds, setFormThresholds] = useState<number[]>([30, 7, 3, 1, 0]);
  const [formSelectedEmps, setFormSelectedEmps] = useState<string[]>([]);
  const [empSearchQuery, setEmpSearchQuery] = useState("");

  // Form State - Mark Paid
  const [selectedReminderForPay, setSelectedReminderForPay] = useState<PaymentReminder | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payCurrency, setPayCurrency] = useState("INR");
  const [payEmpCode, setPayEmpCode] = useState("");
  const [payMethod, setPayMethod] = useState("UPI");
  const [payRemarks, setPayRemarks] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // History state
  const [historyLogs, setHistoryLogs] = useState<PaymentHistoryLog[]>([]);
  const [selectedReminderForHistory, setSelectedReminderForHistory] = useState<PaymentReminder | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Toast notification
  const [toast, setToast] = useState({
    open: false,
    message: "",
    color: "success",
  });

  const getHeaders = () => {
    const token = localStorage.getItem("token")?.replace(/"/g, "") || "";
    return {
      Authorization: `Bearer ${token}`,
    };
  };

  // 1. Initial Data Loading
  const loadData = async () => {
    setLoading(true);
    try {
      // Resolve current logged in user ECode
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const u = JSON.parse(storedUser);
        setCurrentUser(u);
        setPayEmpCode(u?.empCode || u?.EmpCode || "");
      }

      // Load employees list
      const empRes = await axios.get(`${API_BASE}Employee/Load_Employees`, {
        headers: getHeaders(),
      });
      if (empRes.data && Array.isArray(empRes.data)) {
        const filtered = empRes.data.filter(
          (emp: any) => emp[0] !== "0" && emp[1] !== "All Employees"
        );
        setEmployees(filtered);
      }

      // Load payment reminders
      const listRes = await axios.get(`${API_BASE}PaymentReminders/List`, {
        headers: getHeaders(),
      });
      setReminders(listRes.data || []);
    } catch (error) {
      console.error("[PaymentReminders] Error loading page data", error);
      showToastMessage("Failed to load records. Check API connection.", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToastMessage = (msg: string, color: string = "success") => {
    setToast({ open: true, message: msg, color });
  };

  // Helper: Format date nicely (e.g. 15-Aug-2026)
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Helper: Get employee names mapping from comma-separated code list
  const getEmployeeNames = (codesStr: string) => {
    if (!codesStr) return "Unassigned";
    const codes = codesStr.split(",");
    const names = codes
      .map((code) => {
        const emp = employees.find((e) => e[0].toString().trim() === code.trim());
        return emp ? emp[1] : code.trim();
      })
      .filter((n) => n);
    return names.join(", ");
  };

  // Helper: Calculate due state info (days remaining, color class)
  const getDueStatus = (expiryDateStr: string, thresholdsStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDateStr);
    expiry.setHours(0, 0, 0, 0);

    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Parse thresholds
    const thresholds = thresholdsStr
      .split(",")
      .map((t) => parseInt(t.trim()))
      .filter((t) => !isNaN(t));

    if (diffDays < 0) {
      return {
        days: diffDays,
        text: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? "s" : ""}`,
        class: "overdue",
        badge: "danger",
        isAlert: true,
      };
    } else if (diffDays === 0) {
      return {
        days: 0,
        text: "Due TODAY",
        class: "due-today",
        badge: "danger",
        isAlert: true,
      };
    } else {
      // Check if within thresholds
      const isDueSoon = thresholds.some((t) => diffDays <= t);
      return {
        days: diffDays,
        text: `Due in ${diffDays} day${diffDays > 1 ? "s" : ""}`,
        class: isDueSoon ? "due-soon" : "due-normal",
        badge: isDueSoon ? "warning" : "success",
        isAlert: isDueSoon,
      };
    }
  };

  // Helper: Calculate pro-rated monthly cost of a subscription
  const calculateMonthlyCost = (cost: number, cycle: string) => {
    switch (cycle.toLowerCase()) {
      case "monthly":
        return cost;
      case "quarterly":
        return cost / 3;
      case "half-yearly":
        return cost / 6;
      case "annually":
        return cost / 12;
      case "one-time":
        return 0; // One-time expenses not recurring monthly
      default:
        return cost;
    }
  };

  // 2. Filter logic
  const filteredReminders = reminders.filter((item) => {
    // Search filter
    const nameMatch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.provider &&
        item.provider.toLowerCase().includes(searchTerm.toLowerCase()));

    // Category filter
    const categoryMatch =
      categoryFilter === "all" || item.category === categoryFilter;

    // Status filter
    const statusMatch =
      statusFilter === "all" || item.status === statusFilter;

    // Due Filter
    let dueMatch = true;
    if (dueFilter !== "all" && item.status === "Active") {
      const dueStatus = getDueStatus(item.expiryDate, item.reminderThresholds);
      if (dueFilter === "overdue") dueMatch = dueStatus.days < 0;
      else if (dueFilter === "due_soon") dueMatch = dueStatus.days >= 0 && dueStatus.isAlert;
      else if (dueFilter === "active") dueMatch = dueStatus.days >= 0 && !dueStatus.isAlert;
    } else if (dueFilter === "overdue" && item.status !== "Active") {
      dueMatch = false;
    }

    return nameMatch && categoryMatch && statusMatch && dueMatch;
  });

  // Calculate dashboard stats
  const totalActiveCount = reminders.filter((r) => r.status === "Active").length;
  const overdueCount = reminders.filter(
    (r) => r.status === "Active" && getDueStatus(r.expiryDate, r.reminderThresholds).days < 0
  ).length;
  const dueSoonCount = reminders.filter(
    (r) =>
      r.status === "Active" &&
      getDueStatus(r.expiryDate, r.reminderThresholds).days >= 0 &&
      getDueStatus(r.expiryDate, r.reminderThresholds).isAlert
  ).length;

  const totalMonthlyCostEst = reminders
    .filter((r) => r.status === "Active" && r.currency === "INR")
    .reduce((acc, r) => acc + calculateMonthlyCost(r.cost, r.renewalCycle), 0);

  // 3. Add / Edit Subscription Handlers
  const handleOpenAddModal = () => {
    setEditReminderId(null);
    setFormName("");
    setFormCategory("Domain");
    setFormProvider("");
    setFormCost(0);
    setFormCurrency("INR");
    setFormRenewalCycle("Monthly");
    setFormExpiryDate("");
    setFormRemarks("");
    setFormStatus("Active");
    setFormThresholds([30, 7, 3, 1, 0]);
    setFormSelectedEmps([]);
    setEmpSearchQuery("");
    setShowAddEditModal(true);
  };

  const handleOpenEditModal = (item: PaymentReminder) => {
    setEditReminderId(item.id);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormProvider(item.provider || "");
    setFormCost(item.cost);
    setFormCurrency(item.currency);
    setFormRenewalCycle(item.renewalCycle);
    
    // Format ExpiryDate to YYYY-MM-DD for date input
    const expDate = new Date(item.expiryDate);
    const dateFormatted = expDate.toISOString().substring(0, 10);
    setFormExpiryDate(dateFormatted);
    
    setFormRemarks(item.remarks || "");
    setFormStatus(item.status);
    
    // Thresholds
    const ths = item.reminderThresholds
      .split(",")
      .map((t) => parseInt(t.trim()))
      .filter((t) => !isNaN(t));
    setFormThresholds(ths);

    // Selected Employees
    const emps = item.notifyEmpCodes
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e);
    setFormSelectedEmps(emps);
    setEmpSearchQuery("");
    setShowAddEditModal(true);
  };

  const handleToggleThreshold = (val: number) => {
    if (formThresholds.includes(val)) {
      setFormThresholds(formThresholds.filter((t) => t !== val));
    } else {
      setFormThresholds([...formThresholds, val].sort((a, b) => b - a));
    }
  };

  const handleToggleEmployee = (code: string) => {
    if (formSelectedEmps.includes(code)) {
      setFormSelectedEmps(formSelectedEmps.filter((c) => c !== code));
    } else {
      setFormSelectedEmps([...formSelectedEmps, code]);
    }
  };

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      showToastMessage("Please enter subscription name", "warning");
      return;
    }
    if (!formExpiryDate) {
      showToastMessage("Please select next due date", "warning");
      return;
    }
    if (formSelectedEmps.length === 0) {
      showToastMessage("Please assign at least one employee to notify", "warning");
      return;
    }

    const payload = {
      id: editReminderId || 0,
      name: formName.trim(),
      category: formCategory,
      provider: formProvider.trim(),
      cost: Number(formCost),
      currency: formCurrency,
      renewalCycle: formRenewalCycle,
      expiryDate: new Date(formExpiryDate).toISOString(),
      reminderThresholds: formThresholds.join(","),
      notifyEmpCodes: formSelectedEmps.join(","),
      status: formStatus,
      remarks: formRemarks.trim(),
      createdBy: currentUser?.empName || currentUser?.EmpName || "SYSTEM",
    };

    try {
      const res = await axios.post(`${API_BASE}PaymentReminders/Save`, payload, {
        headers: getHeaders(),
      });
      if (res.data && res.data.success) {
        showToastMessage(
          editReminderId ? "Subscription updated successfully!" : "New subscription added!"
        );
        setShowAddEditModal(false);
        loadData();
      } else {
        showToastMessage("Failed to save changes.", "danger");
      }
    } catch (err) {
      console.error(err);
      showToastMessage("API Error saving reminder.", "danger");
    }
  };

  const handleDeleteReminder = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete '${name}'?`)) {
      return;
    }

    try {
      const res = await axios.delete(`${API_BASE}PaymentReminders/Delete/${id}`, {
        headers: getHeaders(),
      });
      if (res.data && res.data.success) {
        showToastMessage("Subscription deleted successfully.");
        loadData();
      }
    } catch (err) {
      console.error(err);
      showToastMessage("Failed to delete record.", "danger");
    }
  };

  const handleTriggerTestNotification = async (id: number, name: string) => {
    try {
      showToastMessage(`Triggering test notification for '${name}'...`, "primary");
      const res = await axios.post(`${API_BASE}PaymentReminders/TestNotification/${id}`, {}, {
        headers: getHeaders(),
      });
      if (res.data && res.data.success) {
        const stats = res.data.stats;
        showToastMessage(
          `Test Successful! Alerts Sent: Database (${stats.DatabaseAlerts}), SignalR (${stats.SignalRBroadcasts}), FCM (${stats.FcmPushes}), WhatsApp (${stats.WhatsAppSent})`,
          "success"
        );
      } else {
        showToastMessage("Failed to run test notification.", "danger");
      }
    } catch (error: any) {
      console.error("[PaymentReminders] Test notification error", error);
      const errMsg = error.response?.data?.message || error.response?.data || error.message || "Unknown error";
      showToastMessage(`Test Alert Failed: ${errMsg}`, "danger");
    }
  };

  // 4. Mark As Paid Handlers
  const handleOpenMarkPaidModal = (item: PaymentReminder) => {
    setSelectedReminderForPay(item);
    setPayAmount(item.cost);
    setPayCurrency(item.currency);
    setPayRemarks("");
    setReceiptFile(null);
    setReceiptUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowMarkPaidModal(true);
  };

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setReceiptFile(e.target.files[0]);
    }
  };

  const handleUploadReceipt = async () => {
    if (!receiptFile) {
      showToastMessage("Please select a file first.", "warning");
      return;
    }

    setUploadingReceipt(true);
    const formData = new FormData();
    formData.append("file", receiptFile);

    try {
      // Direct raw API post for upload
      const res = await axios.post(`${API_BASE}PaymentReminders/UploadReceipt`, formData, {
        headers: {
          ...getHeaders(),
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data && res.data.success) {
        setReceiptUrl(res.data.url);
        showToastMessage("Receipt uploaded successfully!");
      } else {
        showToastMessage("Upload failed.", "danger");
      }
    } catch (err) {
      console.error(err);
      showToastMessage("Error uploading file.", "danger");
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReminderForPay) return;

    const payload = {
      reminderId: selectedReminderForPay.id,
      paidAmount: Number(payAmount),
      currency: payCurrency,
      paidByEmpCode: payEmpCode,
      receiptAttachment: receiptUrl,
      paymentMethod: payMethod,
      remarks: payRemarks.trim(),
    };

    try {
      const res = await axios.post(`${API_BASE}PaymentReminders/MarkPaid`, payload, {
        headers: getHeaders(),
      });
      if (res.data && res.data.success) {
        showToastMessage("Payment recorded! Subscription due date advanced.");
        setShowMarkPaidModal(false);
        loadData();
      } else {
        showToastMessage("Failed to record payment.", "danger");
      }
    } catch (err) {
      console.error(err);
      showToastMessage("API error recording payment.", "danger");
    }
  };

  // 5. Payment History Timeline Handlers
  const handleOpenHistoryModal = async (item: PaymentReminder) => {
    setSelectedReminderForHistory(item);
    setHistoryLogs([]);
    setLoadingHistory(true);
    setShowHistoryModal(true);

    try {
      const res = await axios.get(`${API_BASE}PaymentReminders/History/${item.id}`, {
        headers: getHeaders(),
      });
      setHistoryLogs(res.data || []);
    } catch (err) {
      console.error(err);
      showToastMessage("Failed to load payment history logs.", "danger");
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <IonPage>
      <IonContent className="page-content bg-white-theme">
        <div className="reminders-container">
          
          {/* ── Premium Back Header ── */}
          <div className="reminders-header">
            <div className="header-left-pane">
              <button className="header-back-btn" onClick={() => history.push("/home")}>
                <ChevronLeft size={22} color="white" />
              </button>
              <div>
                <h1 className="header-title">Office Subscriptions</h1>
                <p className="header-subtitle">Track domain renewals, servers, SSLs, and recharges</p>
              </div>
            </div>
            <div className="header-right-pane">
              <button className="add-subscription-btn animate-pulse-btn" onClick={handleOpenAddModal}>
                <Plus size={18} />
                <span>New Subscription</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loader-box">
              <IonSpinner name="crescent" color="primary" />
              <p>Loading office subscriptions...</p>
            </div>
          ) : (
            <>
              {/* ── Dashboard Stats Row ── */}
              <div className="stats-row-grid">
                <div className="stat-card glass-panel border-left-blue">
                  <div className="stat-icon-wrapper bg-soft-blue">
                    <IonIcon icon={walletOutline} className="text-blue" />
                  </div>
                  <div className="stat-content">
                    <span className="stat-number">{totalActiveCount}</span>
                    <span className="stat-label">Active Subscriptions</span>
                  </div>
                </div>

                <div className="stat-card glass-panel border-left-red">
                  <div className="stat-icon-wrapper bg-soft-red">
                    <IonIcon icon={alertCircleOutline} className="text-red pulsating-light" />
                  </div>
                  <div className="stat-content">
                    <span className="stat-number text-red">{overdueCount}</span>
                    <span className="stat-label">Overdue Bills</span>
                  </div>
                </div>

                <div className="stat-card glass-panel border-left-orange">
                  <div className="stat-icon-wrapper bg-soft-orange">
                    <IonIcon icon={timeOutline} className="text-orange" />
                  </div>
                  <div className="stat-content">
                    <span className="stat-number text-orange">{dueSoonCount}</span>
                    <span className="stat-label">Due Within Alert Threshold</span>
                  </div>
                </div>

                <div className="stat-card glass-panel border-left-green">
                  <div className="stat-icon-wrapper bg-soft-green">
                    <span className="text-green currency-symbol">₹</span>
                  </div>
                  <div className="stat-content">
                    <span className="stat-number text-green">
                      ₹{Math.round(totalMonthlyCostEst).toLocaleString()}
                    </span>
                    <span className="stat-label">Est. Monthly Cost (INR)</span>
                  </div>
                </div>
              </div>

              {/* ── Filters & Search Section ── */}
              <div className="filters-card glass-panel">
                <div className="search-field-box">
                  <Search size={18} className="search-icon-inside" />
                  <input
                    type="text"
                    className="search-input-field"
                    placeholder="Search by name or provider..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="dropdowns-row-filters">
                  <div className="filter-dropdown-item">
                    <label>Category</label>
                    <select
                      className="filter-select"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <option value="all">All Categories</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-dropdown-item">
                    <label>Status</label>
                    <select
                      className="filter-select"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">All Status</option>
                      <option value="Active">Active</option>
                      <option value="Paused">Paused</option>
                      <option value="Expired">Expired</option>
                      <option value="Paid">Paid (One-Time)</option>
                    </select>
                  </div>

                  <div className="filter-dropdown-item">
                    <label>Urgency</label>
                    <select
                      className="filter-select"
                      value={dueFilter}
                      onChange={(e) => setDueFilter(e.target.value)}
                    >
                      <option value="all">All Items</option>
                      <option value="overdue">Overdue Only</option>
                      <option value="due_soon">Due Soon (Warning)</option>
                      <option value="active">On Track (Normal)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Subscriptions Table Grid ── */}
              <div className="glass-panel table-scroll-panel">
                <div className="panel-title-row">
                  <h3 className="section-title">Subscription Renewal Schedule</h3>
                  <span className="results-badge">
                    Showing {filteredReminders.length} of {reminders.length} items
                  </span>
                </div>

                {filteredReminders.length === 0 ? (
                  <div className="empty-state-box">
                    <IonIcon icon={walletOutline} className="empty-icon" />
                    <p className="empty-title">No subscriptions match filters</p>
                    <p className="empty-desc">Create a new subscription or adjust your query.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="reminders-table">
                      <thead>
                        <tr>
                          <th>Subscription / Vendor</th>
                          <th>Category</th>
                          <th>Frequency</th>
                          <th>Cost</th>
                          <th>Next Due Date</th>
                          <th>Target Employees</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReminders.map((item) => {
                          const dueState = getDueStatus(item.expiryDate, item.reminderThresholds);
                          return (
                            <tr key={item.id} className={`row-hover-effect ${item.status === 'Paused' ? 'row-paused' : ''}`}>
                              <td>
                                <div className="name-provider-cell">
                                  <span className="item-main-name">{item.name}</span>
                                  {item.provider && (
                                    <span className="item-provider-label">{item.provider}</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span className={`category-tag tag-${item.category.toLowerCase().replace(" ", "-")}`}>
                                  {item.category}
                                </span>
                              </td>
                              <td>
                                <span className="cycle-badge">{item.renewalCycle}</span>
                              </td>
                              <td>
                                <span className="cost-tag font-semibold">
                                  {item.currency === "INR" ? "₹" : "$"}
                                  {item.cost.toLocaleString()}
                                </span>
                              </td>
                              <td>
                                <div className="due-date-cell">
                                  <span className="date-text">{formatDate(item.expiryDate)}</span>
                                  {item.status === "Active" ? (
                                    <span className={`due-countdown-tag badge-${dueState.badge}`}>
                                      {dueState.text}
                                    </span>
                                  ) : (
                                    <span className="due-countdown-tag badge-secondary">
                                      {item.status}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div className="assigned-emps-cell" title={getEmployeeNames(item.notifyEmpCodes)}>
                                  <User size={14} className="cell-icon-prefix" />
                                  <span className="truncate-text">
                                    {getEmployeeNames(item.notifyEmpCodes)}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <div className="actions-cell-row">
                                  {item.status === "Active" && (
                                    <button
                                      className="action-btn pay-btn-icon"
                                      title="Mark as Paid"
                                      onClick={() => handleOpenMarkPaidModal(item)}
                                    >
                                      <CheckCircle size={15} />
                                    </button>
                                  )}
                                  <button
                                    className="action-btn history-btn-icon"
                                    title="Payment History Logs"
                                    onClick={() => handleOpenHistoryModal(item)}
                                  >
                                    <History size={15} />
                                  </button>
                                  <button
                                    className="action-btn edit-btn-icon"
                                    title="Edit Subscription"
                                    onClick={() => handleOpenEditModal(item)}
                                  >
                                    <Edit size={15} />
                                  </button>
                                  {item.status === "Active" && (
                                    <button
                                      className="action-btn test-btn-icon"
                                      title="Test Notification"
                                      onClick={() => handleTriggerTestNotification(item.id, item.name)}
                                    >
                                      <Bell size={15} />
                                    </button>
                                  )}
                                  <button
                                    className="action-btn delete-btn-icon"
                                    title="Delete Subscription"
                                    onClick={() => handleDeleteReminder(item.id, item.name)}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── MODAL 1: ADD / EDIT SUBSCRIPTION ── */}
          {showAddEditModal && (
            <div className="custom-modal-backdrop">
              <div className="custom-modal-content glass-panel animate-zoom-in modal-large">
                <div className="modal-header-row">
                  <h3>{editReminderId ? "Edit Subscription" : "Add New Subscription"}</h3>
                  <button className="modal-close-btn" onClick={() => setShowAddEditModal(false)}>
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSaveReminder} className="modal-form-grid">
                  <div className="form-fields-column">
                    <div className="form-group-item">
                      <label>Subscription Name *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Office AWS Server, Beat Domain"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-row-double">
                      <div className="form-group-item">
                        <label>Category *</label>
                        <select
                          className="form-input"
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group-item">
                        <label>Provider / Vendor</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. GoDaddy, AWS, Airtel"
                          value={formProvider}
                          onChange={(e) => setFormProvider(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-row-double">
                      <div className="form-group-item">
                        <label>Cost *</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-input"
                          value={formCost}
                          onChange={(e) => setFormCost(Number(e.target.value))}
                          required
                        />
                      </div>

                      <div className="form-group-item">
                        <label>Currency *</label>
                        <select
                          className="form-input"
                          value={formCurrency}
                          onChange={(e) => setFormCurrency(e.target.value)}
                        >
                          {CURRENCIES.map((cur) => (
                            <option key={cur} value={cur}>
                              {cur}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-row-double">
                      <div className="form-group-item">
                        <label>Renewal Cycle *</label>
                        <select
                          className="form-input"
                          value={formRenewalCycle}
                          onChange={(e) => setFormRenewalCycle(e.target.value)}
                        >
                          {RENEWAL_CYCLES.map((cycle) => (
                            <option key={cycle} value={cycle}>
                              {cycle}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group-item">
                        <label>Next Due Date *</label>
                        <input
                          type="date"
                          className="form-input"
                          value={formExpiryDate}
                          onChange={(e) => setFormExpiryDate(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group-item">
                      <label>Remarks / Notes</label>
                      <textarea
                        className="form-input text-area-input"
                        placeholder="Provide details, account logins reference, credentials key details, billing portal links, etc."
                        value={formRemarks}
                        onChange={(e) => setFormRemarks(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="form-row-double">
                      <div className="form-group-item">
                        <label>Status</label>
                        <select
                          className="form-input"
                          value={formStatus}
                          onChange={(e) => setFormStatus(e.target.value)}
                        >
                          <option value="Active">Active</option>
                          <option value="Paused">Paused</option>
                          <option value="Expired">Expired</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="form-configurations-column">
                    <div className="config-block-box">
                      <h4 className="config-block-title">Custom Reminders Alerts</h4>
                      <p className="config-block-desc">
                        Select when the system should send alert notifications (FCM & WhatsApp) before expiry.
                      </p>
                      <div className="checkboxes-scroll-list">
                        {THRESHOLD_OPTIONS.map((opt) => (
                          <label key={opt.value} className="checkbox-list-item">
                            <input
                              type="checkbox"
                              checked={formThresholds.includes(opt.value)}
                              onChange={() => handleToggleThreshold(opt.value)}
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="config-block-box">
                      <h4 className="config-block-title">Notify Employees *</h4>
                      <p className="config-block-desc">
                        Select which employees will receive the dashboard notifications, pushes, and WhatsApp reminders.
                      </p>

                      <input
                        type="text"
                        className="form-input"
                        placeholder="Search employee name or code..."
                        value={empSearchQuery}
                        onChange={(e) => setEmpSearchQuery(e.target.value)}
                        style={{ marginBottom: '12px', width: '100%' }}
                      />

                      <div className="employees-checklist-box">
                        {employees
                          .filter((emp: any) => {
                            const code = emp[0]?.toString().toLowerCase() || "";
                            const name = emp[1]?.toString().toLowerCase() || "";
                            const q = empSearchQuery.toLowerCase();
                            return code.includes(q) || name.includes(q);
                          })
                          .map((emp) => (
                            <label key={emp[0]} className="checkbox-list-item">
                              <input
                                type="checkbox"
                                checked={formSelectedEmps.includes(emp[0].toString().trim())}
                                onChange={() => handleToggleEmployee(emp[0].toString().trim())}
                              />
                              <div className="emp-label-text">
                                <span className="emp-name-span">{emp[1]}</span>
                                <span className="emp-code-span">ECode: {emp[0]}</span>
                              </div>
                            </label>
                          ))}
                        {employees.filter((emp: any) => {
                          const code = emp[0]?.toString().toLowerCase() || "";
                          const name = emp[1]?.toString().toLowerCase() || "";
                          const q = empSearchQuery.toLowerCase();
                          return code.includes(q) || name.includes(q);
                        }).length === 0 && (
                          <div style={{ padding: '10px 0', fontSize: '12px', color: '#718096', textAlign: 'center' }}>
                            No employees found
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="modal-actions-row-full">
                    <button
                      type="button"
                      className="form-cancel-btn"
                      onClick={() => setShowAddEditModal(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="form-submit-btn">
                      {editReminderId ? "Save Changes" : "Create Subscription"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── MODAL 2: MARK AS PAID (RENEW SUBSCRIPTION) ── */}
          {showMarkPaidModal && selectedReminderForPay && (
            <div className="custom-modal-backdrop">
              <div className="custom-modal-content glass-panel animate-zoom-in modal-medium">
                <div className="modal-header-row">
                  <h3>Record Payment: {selectedReminderForPay.name}</h3>
                  <button className="modal-close-btn" onClick={() => setShowMarkPaidModal(false)}>
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleRecordPayment} className="mark-paid-form">
                  <p className="payment-alert-banner">
                    <IonIcon icon={alertCircleOutline} style={{ marginRight: '8px' }} />
                    Recording this payment will automatically advance the next renewal due date according to its frequency (<strong>{selectedReminderForPay.renewalCycle}</strong>).
                  </p>

                  <div className="form-row-double">
                    <div className="form-group-item">
                      <label>Paid Amount *</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={payAmount}
                        onChange={(e) => setPayAmount(Number(e.target.value))}
                        required
                      />
                    </div>

                    <div className="form-group-item">
                      <label>Currency *</label>
                      <select
                        className="form-input"
                        value={payCurrency}
                        onChange={(e) => setPayCurrency(e.target.value)}
                      >
                        {CURRENCIES.map((cur) => (
                          <option key={cur} value={cur}>
                            {cur}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-row-double">
                    <div className="form-group-item">
                      <label>Payment Method *</label>
                      <select
                        className="form-input"
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value)}
                      >
                        <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                        <option value="Credit Card">Credit Card</option>
                        <option value="Bank Transfer">Bank NetBanking / Transfer</option>
                        <option value="Debit Card">Debit Card</option>
                        <option value="Cash">Cash</option>
                      </select>
                    </div>

                    <div className="form-group-item">
                      <label>Paid By *</label>
                      <select
                        className="form-input"
                        value={payEmpCode}
                        onChange={(e) => setPayEmpCode(e.target.value)}
                      >
                        {employees.map((emp) => (
                          <option key={emp[0]} value={emp[0]}>
                            {emp[1]} ({emp[0]})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* RECEIPT FILE UPLOAD BLOCK */}
                  <div className="form-group-item receipt-upload-group">
                    <label>Receipt Proof / Invoice Attachment</label>
                    <div className="receipt-uploader-panel">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleReceiptFileChange}
                        ref={fileInputRef}
                        style={{ display: "none" }}
                      />
                      <button
                        type="button"
                        className="select-file-btn"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FileText size={16} />
                        <span>
                          {receiptFile ? receiptFile.name : "Choose Invoice Image / PDF"}
                        </span>
                      </button>

                      {receiptFile && !receiptUrl && (
                        <button
                          type="button"
                          className="upload-now-btn"
                          onClick={handleUploadReceipt}
                          disabled={uploadingReceipt}
                        >
                          {uploadingReceipt ? (
                            <IonSpinner name="dots" />
                          ) : (
                            <>
                              <Upload size={14} />
                              <span>Upload</span>
                            </>
                          )}
                        </button>
                      )}

                      {receiptUrl && (
                        <span className="upload-success-label">
                          <CheckCircle size={14} color="var(--ion-color-success)" />
                          Uploaded Ready!
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="form-group-item">
                    <label>Remarks / Payment Transaction ID</label>
                    <textarea
                      className="form-input"
                      placeholder="e.g. HDFC transaction ref ref#129031023, renewed using office credit card, etc."
                      value={payRemarks}
                      onChange={(e) => setPayRemarks(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <div className="modal-actions-row">
                    <button
                      type="button"
                      className="form-cancel-btn"
                      onClick={() => setShowMarkPaidModal(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="form-submit-btn">
                      Record Payment
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── MODAL 3: PAYMENT HISTORY LOGS ── */}
          {showHistoryModal && selectedReminderForHistory && (
            <div className="custom-modal-backdrop">
              <div className="custom-modal-content glass-panel animate-zoom-in modal-large">
                <div className="modal-header-row">
                  <h3>Payment Log History: {selectedReminderForHistory.name}</h3>
                  <button className="modal-close-btn" onClick={() => setShowHistoryModal(false)}>
                    <X size={20} />
                  </button>
                </div>

                <div className="history-modal-body">
                  {loadingHistory ? (
                    <div className="loader-box">
                      <IonSpinner name="crescent" />
                      <p>Fetching history logs...</p>
                    </div>
                  ) : historyLogs.length === 0 ? (
                    <div className="empty-history-box">
                      <History size={40} className="text-muted" />
                      <p className="empty-title">No payment history recorded</p>
                      <p className="empty-desc">This subscription has not had any payments logged yet.</p>
                    </div>
                  ) : (
                    <div className="timeline-wrapper">
                      {historyLogs.map((log) => (
                        <div key={log.id} className="timeline-item-card glass-panel">
                          <div className="timeline-badge-date">
                            <span className="timeline-date">{formatDate(log.paymentDate)}</span>
                            <span className="timeline-amount-badge">
                              {log.currency === "INR" ? "₹" : "$"}
                              {log.paidAmount.toLocaleString()}
                            </span>
                          </div>

                          <div className="timeline-details-content">
                            <div className="timeline-row">
                              <span className="log-label">Paid By:</span>
                              <span className="log-value">{getEmployeeNames(log.paidByEmpCode)}</span>
                            </div>
                            <div className="timeline-row">
                              <span className="log-label">Method:</span>
                              <span className="log-value">{log.paymentMethod}</span>
                            </div>
                            {log.remarks && (
                              <div className="timeline-row">
                                <span className="log-label">Transaction Details:</span>
                                <span className="log-value log-remarks">{log.remarks}</span>
                              </div>
                            )}
                            {log.receiptAttachment && (
                              <div className="timeline-row">
                                <span className="log-label">Receipt Proof:</span>
                                <a
                                  href={log.receiptAttachment}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="receipt-attachment-link"
                                >
                                  <FileText size={14} style={{ marginRight: '4px' }} />
                                  View Invoice / Receipt Attachment
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="modal-actions-row">
                  <button className="form-cancel-btn" onClick={() => setShowHistoryModal(false)}>
                    Close Logs
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Toast feedback */}
          <IonToast
            isOpen={toast.open}
            message={toast.message}
            color={toast.color}
            duration={2500}
            onDidDismiss={() => setToast({ ...toast, open: false })}
          />

        </div>
      </IonContent>
    </IonPage>
  );
};

export default PaymentReminders;
