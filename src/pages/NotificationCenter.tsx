import React, { useState, useEffect, useMemo } from "react";
import { useHistory } from "react-router-dom";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonMenuButton,
  IonIcon,
  IonModal,
  IonSpinner
} from "@ionic/react";
import {
  notificationsOutline,
  paperPlaneOutline,
  timeOutline,
  peopleOutline,
  searchOutline,
  checkmarkCircleOutline,
  phonePortraitOutline,
  globeOutline,
  flashOutline,
  trashOutline,
  repeatOutline,
  eyeOutline,
  alertCircleOutline,
  sparklesOutline,
  checkmarkDoneOutline,
  closeOutline,
  sendOutline,
  lockClosedOutline,
  flashlightOutline,
  cameraOutline,
  fingerPrintOutline,
  wifiOutline,
  batteryFullOutline,
  imageOutline
} from "ionicons/icons";
import { apiService } from "../utils/apiService";
import "./NotificationCenter.css";
import wallpaperCosmic from "../assets/wallpaper_cosmic.jpg";
import wallpaperSunset from "../assets/wallpaper_sunset.jpg";
import appLogo from "../assets/dbs-logo-short.png";

// Wallpapers dictionary
const WALLPAPERS = {
  cosmic: `url(${wallpaperCosmic}) center/cover no-repeat`,
  sunset: `url(${wallpaperSunset}) center/cover no-repeat`,
  nebula: "radial-gradient(circle at 80% 20%, rgba(168, 85, 247, 0.55) 0%, transparent 55%), radial-gradient(circle at 20% 80%, rgba(56, 189, 248, 0.5) 0%, transparent 55%), linear-gradient(180deg, #090d16 0%, #030712 100%)",
  dark: "radial-gradient(circle at 50% 10%, #1e293b 0%, #0f172a 50%, #020617 100%)"
};

// Only employee codes 1501, 1601, and 1508 are permitted
const ALLOWED_EMP_CODES = ["1501", "1601", "1508"];

interface EmployeeItem {
  EmpCode: string;
  EmpName: string;
  Designation: string;
  Department: string;
  Mobile: string;
  DeviceCount: number;
}

interface BroadcastItem {
  BroadcastId: number;
  Title: string;
  Body: string;
  Category: string;
  Priority: string;
  TargetType: string;
  TargetCount: number;
  SentCount: number;
  FailedCount: number;
  ActionUrl: string;
  Channels: string;
  SenderEmpCode: string;
  SenderName: string;
  CreatedDate: string;
}

interface RecipientDetail {
  NotificationId: number;
  EmpCode: string;
  EmpName: string;
  IsRead: boolean;
  CreatedDate: string;
  Department?: string;
  Mobile?: string;
  Status?: string;
  ReadTime?: string | null;
  ErrorMessage?: string | null;
}

const TEMPLATES = [
  {
    name: "📝 Work Report Reminder",
    title: "📝 DAILY WORK REPORT: Submissions Open!",
    body: "It's 6:29 PM! Submissions are now open. Review your activities and submit your daily work report.",
    category: "Work Report",
    priority: "High",
    actionUrl: "/workreport"
  },
  {
    name: "📢 Office Announcement",
    title: "📢 Important Office Announcement",
    body: "Please be informed of an important update regarding office operations. Check details in dashboard.",
    category: "Announcement",
    priority: "Normal",
    actionUrl: "/dashboard"
  },
  {
    name: "🚨 Urgent Alert",
    title: "🚨 URGENT: Action Required Immediately",
    body: "Immediate attention is required on critical pending items. Please take action right away.",
    category: "Alert",
    priority: "Urgent",
    actionUrl: "/tasks"
  },
  {
    name: "📅 Meeting Notice",
    title: "📅 Upcoming Team Meeting",
    body: "A scheduled team meeting will begin shortly. Please join on time.",
    category: "Meeting",
    priority: "Normal",
    actionUrl: "/meeting-dashboard"
  },
  {
    name: "🎉 Holiday Greeting",
    title: "🎉 Holiday Announcement & Warm Wishes",
    body: "Wishing everyone a joyful holiday! Office will resume operations on the next working day.",
    category: "General",
    priority: "Normal",
    actionUrl: "/"
  }
];

export const NotificationCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"compose" | "history">("compose");

  // Form State
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("Announcement");
  const [priority, setPriority] = useState<"Normal" | "High" | "Urgent">("Normal");
  const [actionUrl, setActionUrl] = useState("/workreport");
  const [channelPush, setChannelPush] = useState(true);
  const [channelInApp, setChannelInApp] = useState(true);

  // Audience State
  const [targetType, setTargetType] = useState<"ALL" | "SELECTED">("ALL");
  const [selectedEmpCodes, setSelectedEmpCodes] = useState<string[]>([]);
  const [empSearch, setEmpSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");

  // Data State
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [historyList, setHistoryList] = useState<BroadcastItem[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Preview Mode & Wallpaper
  const [previewPlatform, setPreviewPlatform] = useState<"android" | "ios">("android");
  const [wallpaper, setWallpaper] = useState<"cosmic" | "sunset" | "nebula" | "dark">("cosmic");

  // Live real-time lockscreen clock & date
  const [clockData, setClockData] = useState(() => {
    const now = new Date();
    return {
      time: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: false }),
      time12: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      dateLong: now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }),
      dateShort: now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }),
    };
  });

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockData({
        time: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: false }),
        time12: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        dateLong: now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }),
        dateShort: now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }),
      });
    };
    const timer = setInterval(updateClock, 10000);
    return () => clearInterval(timer);
  }, []);

  // Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<BroadcastItem | null>(null);
  const [broadcastRecipients, setBroadcastRecipients] = useState<RecipientDetail[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Toast / Notification banner
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "danger" | "info" } | null>(null);

  const history = useHistory();

  const showToast = (text: string, type: "success" | "danger" | "info" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const getActiveUser = () => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return {
        code: String(
          u?.empCode ||
          u?.EmpCode ||
          u?.Empcode ||
          u?.emp_code ||
          u?.userName ||
          u?.username ||
          ""
        ).trim(),
        name: u?.empName || u?.EmpName || u?.displayName || u?.name || "Administrator"
      };
    } catch {
      return { code: "", name: "Administrator" };
    }
  };

  const activeUser = getActiveUser();
  const callerEmpCode = activeUser.code;
  const normalizedEmpCode = callerEmpCode.split("-")[0].trim();
  const isAuthorized =
    ALLOWED_EMP_CODES.includes(callerEmpCode) ||
    ALLOWED_EMP_CODES.includes(normalizedEmpCode);

// Normalization helpers to handle both camelCase and PascalCase API payloads
const normalizeEmployee = (e: any): EmployeeItem => ({
  EmpCode: String(e?.EmpCode ?? e?.empCode ?? "").trim(),
  EmpName: String(e?.EmpName ?? e?.empName ?? "").trim(),
  Designation: String(e?.Designation ?? e?.designation ?? "").trim(),
  Department: String(e?.Department ?? e?.department ?? "").trim(),
  Mobile: String(e?.Mobile ?? e?.mobile ?? "").trim(),
  DeviceCount: Number(e?.DeviceCount ?? e?.deviceCount ?? 0)
});

const normalizeBroadcast = (b: any): BroadcastItem => ({
  BroadcastId: Number(b?.BroadcastId ?? b?.broadcastId ?? 0),
  Title: String(b?.Title ?? b?.title ?? "").trim(),
  Body: String(b?.Body ?? b?.body ?? "").trim(),
  Category: String(b?.Category ?? b?.category ?? "announcement").trim(),
  Priority: String(b?.Priority ?? b?.priority ?? "normal").trim(),
  TargetType: String(b?.TargetType ?? b?.targetType ?? "all").trim(),
  TargetCount: Number(b?.TargetCount ?? b?.targetCount ?? 0),
  SentCount: Number(b?.SentCount ?? b?.sentCount ?? 0),
  FailedCount: Number(b?.FailedCount ?? b?.failedCount ?? 0),
  ActionUrl: String(b?.ActionUrl ?? b?.actionUrl ?? "").trim(),
  Channels: String(b?.Channels ?? b?.channels ?? "push,inapp").trim(),
  SenderEmpCode: String(b?.SenderEmpCode ?? b?.senderEmpCode ?? "").trim(),
  SenderName: String(b?.SenderName ?? b?.senderName ?? "").trim(),
  CreatedDate: String(b?.CreatedDate ?? b?.createdDate ?? "").trim()
});

const normalizeRecipient = (r: any): RecipientDetail => ({
  NotificationId: Number(r?.NotificationId ?? r?.notificationId ?? 0),
  EmpCode: String(r?.EmpCode ?? r?.empCode ?? "").trim(),
  EmpName: String(r?.EmpName ?? r?.empName ?? "").trim(),
  Department: String(r?.Department ?? r?.department ?? "").trim(),
  Mobile: String(r?.Mobile ?? r?.mobile ?? "").trim(),
  Status: String(r?.Status ?? r?.status ?? "Sent").trim(),
  IsRead: Boolean(r?.IsRead ?? r?.isRead ?? false),
  CreatedDate: String(r?.CreatedDate ?? r?.createdDate ?? "").trim(),
  ReadTime: r?.ReadTime ?? r?.readTime ? String(r?.ReadTime ?? r?.readTime) : null,
  ErrorMessage: r?.ErrorMessage ?? r?.errorMessage ? String(r?.ErrorMessage ?? r?.errorMessage) : null
});

  // Load Employees
  const fetchEmployees = async () => {
    if (!isAuthorized) return;
    setIsLoadingEmployees(true);
    try {
      const res = await apiService.getNotificationEmployees(callerEmpCode);
      const rawList = res && res.success && Array.isArray(res.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setEmployees(rawList.map(normalizeEmployee));
    } catch (e) {
      console.warn("Could not load employees from NotificationCenter endpoint:", e);
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  // Load History
  const fetchHistory = async () => {
    if (!isAuthorized) return;
    setIsLoadingHistory(true);
    try {
      const res = await apiService.getNotificationHistory(callerEmpCode);
      const rawList = res && res.success && Array.isArray(res.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setHistoryList(rawList.map(normalizeBroadcast));
    } catch (e) {
      console.warn("Could not load broadcast history:", e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchEmployees();
      fetchHistory();
    }
  }, [isAuthorized]);

  // Department List
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.Department && e.Department.trim()) set.add(e.Department.trim());
    });
    return ["ALL", ...Array.from(set)];
  }, [employees]);

  // Filtered Employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const matchesSearch =
        !empSearch ||
        e.EmpName.toLowerCase().includes(empSearch.toLowerCase()) ||
        e.EmpCode.toLowerCase().includes(empSearch.toLowerCase()) ||
        e.Designation.toLowerCase().includes(empSearch.toLowerCase());

      const matchesDept = deptFilter === "ALL" || e.Department === deptFilter;

      return matchesSearch && matchesDept;
    });
  }, [employees, empSearch, deptFilter]);

  // Total registered devices count
  const totalRegisteredDevices = useMemo(() => {
    return employees.reduce((acc, curr) => acc + (curr.DeviceCount || 0), 0);
  }, [employees]);

  // Apply Template
  const applyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setTitle(tpl.title);
    setBody(tpl.body);
    setCategory(tpl.category);
    setPriority(tpl.priority as any);
    setActionUrl(tpl.actionUrl);
    showToast(`Template "${tpl.name}" applied!`, "info");
  };

  // Select / Deselect All Filtered
  const toggleSelectAll = () => {
    const filteredCodes = filteredEmployees.map(e => e.EmpCode);
    const allSelected = filteredCodes.every(c => selectedEmpCodes.includes(c));

    if (allSelected) {
      setSelectedEmpCodes(prev => prev.filter(c => !filteredCodes.includes(c)));
    } else {
      setSelectedEmpCodes(prev => Array.from(new Set([...prev, ...filteredCodes])));
    }
  };

  const toggleEmpSelection = (code: string) => {
    setSelectedEmpCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  // Trigger Local Self-Test
  const handleTestNotification = async () => {
    if (!title.trim() || !body.trim()) {
      showToast("Please enter a title and message first.", "danger");
      return;
    }

    try {
      if ("Notification" in window) {
        let perm = Notification.permission;
        if (perm !== "granted") {
          perm = await Notification.requestPermission();
        }
        if (perm === "granted") {
          new Notification(title, {
            body: body,
            icon: "/images/dbase.png",
            badge: "/images/dbs-logo-short.png"
          });
          showToast("Test notification sent to your browser!", "success");
        } else {
          showToast("Browser notification permission is not granted.", "danger");
        }
      } else {
        showToast("Notification API is not supported in this browser.", "danger");
      }
    } catch (e: any) {
      showToast(`Test error: ${e.message}`, "danger");
    }
  };

  // Handle Send Broadcast
  const handleSendBroadcast = async () => {
    if (!title.trim()) {
      showToast("Please enter a notification title.", "danger");
      return;
    }
    if (!body.trim()) {
      showToast("Please enter a notification message.", "danger");
      return;
    }
    if (targetType === "SELECTED" && selectedEmpCodes.length === 0) {
      showToast("Please select at least one employee recipient.", "danger");
      return;
    }
    if (!channelPush && !channelInApp) {
      showToast("Please select at least one delivery channel (Push or In-App).", "danger");
      return;
    }

    const { code: empCode, name: empName } = getActiveUser();

    const channels: string[] = [];
    if (channelPush) channels.push("PUSH");
    if (channelInApp) channels.push("INAPP");

    const payload = {
      Title: title.trim(),
      Body: body.trim(),
      Category: category,
      Priority: priority,
      TargetType: targetType,
      TargetEmpCodes: targetType === "ALL" ? [] : selectedEmpCodes,
      ActionUrl: actionUrl.trim() || "/",
      Channels: channels.join(","),
      SenderEmpCode: empCode,
      SenderName: empName
    };

    setIsSending(true);
    setShowConfirmModal(false);

    try {
      const res = await apiService.sendBroadcastNotification(payload);
      if (res && res.success) {
        showToast(res.message || "Broadcast notification sent successfully!", "success");
        // Clear form
        setTitle("");
        setBody("");
        setSelectedEmpCodes([]);
        fetchHistory();
        setActiveTab("history");
      } else {
        showToast(res?.message || "Failed to send broadcast.", "danger");
      }
    } catch (e: any) {
      console.error("Error sending broadcast:", e);
      showToast(`Error: ${e.message || "Failed to send notification"}`, "danger");
    } finally {
      setIsSending(false);
    }
  };

  // View Details
  const handleViewDetails = async (item: BroadcastItem) => {
    setSelectedBroadcast(item);
    setDetailsModalOpen(true);
    setIsLoadingDetails(true);
    try {
      const res = await apiService.getBroadcastDetails(item.BroadcastId);
      if (res && res.success) {
        const rawRecipients = Array.isArray(res.recipients) ? res.recipients : [];
        setBroadcastRecipients(rawRecipients.map(normalizeRecipient));
      }
    } catch (e) {
      console.error("Error fetching broadcast details:", e);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Duplicate to Composer
  const handleDuplicate = (item: BroadcastItem) => {
    setTitle(item.Title);
    setBody(item.Body);
    setCategory(item.Category);
    setPriority(item.Priority as any);
    setActionUrl(item.ActionUrl);
    setActiveTab("compose");
    showToast("Broadcast loaded into composer!", "info");
  };

  // Delete Broadcast
  const handleDelete = async (item: BroadcastItem) => {
    if (!window.confirm(`Delete broadcast "${item.Title}" from history?`)) return;
    try {
      const res = await apiService.deleteBroadcastNotification(item.BroadcastId, callerEmpCode);
      if (res && res.success) {
        showToast("Broadcast deleted from history.", "success");
        fetchHistory();
      }
    } catch (e) {
      showToast("Failed to delete broadcast.", "danger");
    }
  };

  // Render: Unauthorized View
  if (!isAuthorized) {
    return (
      <IonPage className="notif-center-page">
        <IonHeader className="ion-no-border notif-header-glass">
          <IonToolbar>
            <IonButtons slot="start">
              <IonMenuButton />
            </IonButtons>
            <IonTitle>
              <div className="notif-header-title-wrap">
                <div className="notif-header-icon-box">
                  <IonIcon icon={notificationsOutline} />
                </div>
                <div>
                  <h1 className="notif-header-title">Notification Center</h1>
                  <p className="notif-header-subtitle">Administrative Broadcast Panel</p>
                </div>
              </div>
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="notif-center-content ion-padding">
          <div className="notif-restricted-wrapper">
            <div className="notif-restricted-card">
              <div className="notif-restricted-icon-box">
                <IonIcon icon={lockClosedOutline} />
              </div>
              <h2 className="notif-restricted-title">Restricted Access</h2>
              <p className="notif-restricted-msg">
                The Notification Center is strictly restricted to authorized administrators (EmpCodes: <strong>1501, 1601, 1508</strong>).
              </p>
              <div className="notif-restricted-identity">
                Current Identity: <strong>{callerEmpCode || "Unknown"}</strong>
              </div>
              <p className="notif-restricted-submsg">
                Your logged-in account does not have administrative clearance to broadcast notifications.
              </p>
              <button
                className="notif-restricted-btn"
                onClick={() => history.push("/home")}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage className="notif-center-page">
      <IonHeader className="ion-no-border notif-header-glass">
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>
            <div className="notif-header-title-wrap">
              <div className="notif-header-icon-box">
                <IonIcon icon={notificationsOutline} />
              </div>
              <div>
                <h1 className="notif-header-title">Notification Center</h1>
                <p className="notif-header-subtitle">
                  Broadcast Push & In-App Alerts to Android, iOS & Web
                </p>
              </div>
            </div>
          </IonTitle>
          <IonButtons slot="end">
            <div className="notif-top-stats-row">
              <span className="notif-stat-pill" title="Total registered push devices">
                <IonIcon icon={phonePortraitOutline} />
                <span>{totalRegisteredDevices} Devices</span>
              </span>
              <span className="notif-stat-pill" title="Total active staff members">
                <IonIcon icon={peopleOutline} />
                <span>{employees.length} Staff</span>
              </span>
            </div>
          </IonButtons>
        </IonToolbar>

        {/* Tab Navigation */}
        <div className="notif-tabs-bar">
          <button
            className={`notif-tab-btn ${activeTab === "compose" ? "active" : ""}`}
            onClick={() => setActiveTab("compose")}
          >
            <IonIcon icon={paperPlaneOutline} />
            <span>Compose & Broadcast</span>
          </button>
          <button
            className={`notif-tab-btn ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <IonIcon icon={timeOutline} />
            <span>Sent Broadcasts ({historyList.length})</span>
          </button>
        </div>
      </IonHeader>

      <IonContent className="notif-content-area" fullscreen>
        {/* Toast alert */}
        {toastMsg && (
          <div className={`notif-floating-toast ${toastMsg.type}`}>
            <IonIcon
              icon={
                toastMsg.type === "success"
                  ? checkmarkCircleOutline
                  : toastMsg.type === "danger"
                  ? alertCircleOutline
                  : sparklesOutline
              }
            />
            <span>{toastMsg.text}</span>
            <button className="notif-toast-close" onClick={() => setToastMsg(null)}>
              <IonIcon icon={closeOutline} />
            </button>
          </div>
        )}

        {/* TAB 1: COMPOSE & BROADCAST */}
        {activeTab === "compose" && (
          <div className="notif-compose-grid">
            {/* Left: Composer Form */}
            <div className="notif-composer-card">
              {/* Quick Template Chips */}
              <div className="notif-section-group">
                <label className="notif-field-label">
                  <IonIcon icon={sparklesOutline} />
                  <span>Quick Templates</span>
                </label>
                <div className="notif-templates-scroll">
                  {TEMPLATES.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      className="notif-template-chip"
                      onClick={() => applyTemplate(tpl)}
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title & Body */}
              <div className="notif-section-group">
                <div className="notif-label-row">
                  <label className="notif-field-label">Notification Title *</label>
                  <span className="notif-char-count">{title.length}/100</span>
                </div>
                <input
                  type="text"
                  className="notif-input-text"
                  placeholder="e.g. 📝 DAILY WORK REPORT: Submissions Open!"
                  value={title}
                  maxLength={100}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>

              <div className="notif-section-group">
                <div className="notif-label-row">
                  <label className="notif-field-label">Message Content *</label>
                  <span className="notif-char-count">{body.length}/350</span>
                </div>
                <textarea
                  className="notif-textarea"
                  rows={4}
                  placeholder="Type the message body that will appear on mobile lockscreens and in the notification feed..."
                  value={body}
                  maxLength={350}
                  onChange={e => setBody(e.target.value)}
                />
              </div>

              {/* Category & Priority Row */}
              <div className="notif-dual-row">
                <div className="notif-section-group">
                  <label className="notif-field-label">Category</label>
                  <select
                    className="notif-select"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                  >
                    <option value="Announcement">📢 Announcement</option>
                    <option value="Work Report">📝 Work Report</option>
                    <option value="Alert">🚨 Urgent Alert</option>
                    <option value="Task">📋 Task Update</option>
                    <option value="Meeting">📅 Meeting Notice</option>
                    <option value="General">🔔 General</option>
                  </select>
                </div>

                <div className="notif-section-group">
                  <label className="notif-field-label">Priority Level</label>
                  <div className="notif-priority-toggle-group">
                    {(["Normal", "High", "Urgent"] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        className={`notif-priority-btn ${p.toLowerCase()} ${priority === p ? "selected" : ""}`}
                        onClick={() => setPriority(p)}
                      >
                        {p === "Normal" && "🔹 Normal"}
                        {p === "High" && "⚡ High"}
                        {p === "Urgent" && "🚨 Urgent"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action URL & Delivery Channels */}
              <div className="notif-dual-row">
                <div className="notif-section-group">
                  <label className="notif-field-label">Target Page URL (On Click)</label>
                  <input
                    type="text"
                    className="notif-input-text"
                    placeholder="/workreport, /tasks, /dashboard"
                    value={actionUrl}
                    onChange={e => setActionUrl(e.target.value)}
                  />
                </div>

                <div className="notif-section-group">
                  <label className="notif-field-label">Delivery Channels</label>
                  <div className="notif-channels-row">
                    <label className="notif-channel-check">
                      <input
                        type="checkbox"
                        checked={channelPush}
                        onChange={e => setChannelPush(e.target.checked)}
                      />
                      <span className="notif-check-custom"></span>
                      <span>Push (Mobile & Web)</span>
                    </label>
                    <label className="notif-channel-check">
                      <input
                        type="checkbox"
                        checked={channelInApp}
                        onChange={e => setChannelInApp(e.target.checked)}
                      />
                      <span className="notif-check-custom"></span>
                      <span>In-App Feed</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Audience Selector */}
              <div className="notif-audience-box">
                <div className="notif-audience-header">
                  <label className="notif-field-label">
                    <IonIcon icon={peopleOutline} />
                    <span>Target Audience</span>
                  </label>
                  <div className="notif-target-toggle">
                    <button
                      type="button"
                      className={`notif-toggle-pill ${targetType === "ALL" ? "active" : ""}`}
                      onClick={() => setTargetType("ALL")}
                    >
                      <IonIcon icon={globeOutline} />
                      <span>All Employees ({employees.length})</span>
                    </button>
                    <button
                      type="button"
                      className={`notif-toggle-pill ${targetType === "SELECTED" ? "active" : ""}`}
                      onClick={() => setTargetType("SELECTED")}
                    >
                      <IonIcon icon={peopleOutline} />
                      <span>Specific Recipients ({selectedEmpCodes.length})</span>
                    </button>
                  </div>
                </div>

                {/* Specific Employee Selection Drawer */}
                {targetType === "SELECTED" && (
                  <div className="notif-recipients-picker">
                    <div className="notif-picker-toolbar">
                      <div className="notif-search-wrap">
                        <IonIcon icon={searchOutline} />
                        <input
                          type="text"
                          placeholder="Search employee by name, code, designation..."
                          value={empSearch}
                          onChange={e => setEmpSearch(e.target.value)}
                        />
                      </div>
                      <select
                        className="notif-dept-select"
                        value={deptFilter}
                        onChange={e => setDeptFilter(e.target.value)}
                      >
                        {departments.map(d => (
                          <option key={d} value={d}>
                            {d === "ALL" ? "All Depts" : d}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="notif-select-all-btn"
                        onClick={toggleSelectAll}
                      >
                        {filteredEmployees.every(e => selectedEmpCodes.includes(e.EmpCode))
                          ? "Deselect All"
                          : "Select All"}
                      </button>
                    </div>

                    <div className="notif-emp-chips-grid">
                      {filteredEmployees.map(emp => {
                        const isSelected = selectedEmpCodes.includes(emp.EmpCode);
                        const hasDevice = emp.DeviceCount > 0;
                        return (
                          <div
                            key={emp.EmpCode}
                            className={`notif-emp-card ${isSelected ? "selected" : ""}`}
                            onClick={() => toggleEmpSelection(emp.EmpCode)}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="notif-emp-checkbox"
                            />
                            <div className="notif-emp-info">
                              <span className="notif-emp-name">{emp.EmpName}</span>
                              <span className="notif-emp-meta">
                                #{emp.EmpCode} • {emp.Designation || emp.Department || "Staff"}
                              </span>
                            </div>
                            <span
                              className={`notif-device-badge ${hasDevice ? "online" : "offline"}`}
                              title={hasDevice ? `${emp.DeviceCount} registered devices` : "No FCM token"}
                            >
                              <IonIcon icon={phonePortraitOutline} />
                              {hasDevice ? `${emp.DeviceCount}` : "0"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Action Buttons */}
              <div className="notif-actions-footer">
                <button
                  type="button"
                  className="notif-btn-secondary"
                  onClick={handleTestNotification}
                >
                  <IonIcon icon={flashOutline} />
                  <span>Send Test to My Device</span>
                </button>

                <button
                  type="button"
                  className="notif-btn-primary"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={isSending || !title.trim() || !body.trim()}
                >
                  {isSending ? (
                    <>
                      <IonSpinner name="crescent" />
                      <span>Sending Broadcast...</span>
                    </>
                  ) : (
                    <>
                      <IonIcon icon={sendOutline} />
                      <span>
                        Broadcast Notification (
                        {targetType === "ALL" ? `All ${employees.length}` : `${selectedEmpCodes.length} Selected`}
                        )
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right: Live Interactive Mobile Preview */}
            <div className="notif-preview-sidebar">
              <div className="notif-preview-header">
                <div>
                  <h3 className="notif-preview-heading">Live Mobile Lockscreen Preview</h3>
                  <span className="notif-preview-sub">Interactive smartphone simulator</span>
                </div>
                <div className="notif-preview-os-tabs">
                  <button
                    type="button"
                    className={`notif-os-tab ${previewPlatform === "android" ? "active" : ""}`}
                    onClick={() => setPreviewPlatform("android")}
                  >
                    🤖 Android
                  </button>
                  <button
                    type="button"
                    className={`notif-os-tab ${previewPlatform === "ios" ? "active" : ""}`}
                    onClick={() => setPreviewPlatform("ios")}
                  >
                    🍏 iOS
                  </button>
                </div>
              </div>

              {/* Wallpaper Selector Bar */}
              <div className="notif-wallpaper-bar">
                <span className="notif-wp-label">
                  <IonIcon icon={imageOutline} /> Wallpaper:
                </span>
                <div className="notif-wp-buttons">
                  <button
                    type="button"
                    className={`notif-wp-pill ${wallpaper === "cosmic" ? "active" : ""}`}
                    onClick={() => setWallpaper("cosmic")}
                  >
                    🌌 Cosmic Silk
                  </button>
                  <button
                    type="button"
                    className={`notif-wp-pill ${wallpaper === "sunset" ? "active" : ""}`}
                    onClick={() => setWallpaper("sunset")}
                  >
                    🏔️ Alpine Sunset
                  </button>
                  <button
                    type="button"
                    className={`notif-wp-pill ${wallpaper === "nebula" ? "active" : ""}`}
                    onClick={() => setWallpaper("nebula")}
                  >
                    🔮 Nebula Glow
                  </button>
                  <button
                    type="button"
                    className={`notif-wp-pill ${wallpaper === "dark" ? "active" : ""}`}
                    onClick={() => setWallpaper("dark")}
                  >
                    🪐 Titanium
                  </button>
                </div>
              </div>

              {/* Mobile Phone Mockup */}
              <div
                className={`notif-phone-frame ${previewPlatform} wp-${wallpaper}`}
                style={{ background: WALLPAPERS[wallpaper] }}
              >
                {/* Screen Ambient Glass Reflection */}
                <div className="notif-phone-glare"></div>

                {previewPlatform === "ios" ? (
                  /* ===================== iOS iPHONE 16 PRO ===================== */
                  <div className="notif-screen-inner ios">
                    {/* Dynamic Island */}
                    <div className="notif-dynamic-island">
                      <div className="notif-island-camera"></div>
                      <div className="notif-island-sensor"></div>
                    </div>

                    {/* iOS Status Bar */}
                    <div className="notif-ios-status-bar">
                      <div className="notif-status-left">
                        <IonIcon icon={lockClosedOutline} className="notif-ios-lock" />
                      </div>
                      <div className="notif-status-right">
                        <div className="notif-signal-bars">
                          <span className="bar"></span>
                          <span className="bar"></span>
                          <span className="bar"></span>
                          <span className="bar"></span>
                        </div>
                        <span className="notif-cell-tag">5G</span>
                        <IonIcon icon={wifiOutline} className="notif-wifi" />
                        <div className="notif-battery-pill">
                          <div className="notif-battery-fill"></div>
                        </div>
                      </div>
                    </div>

                    {/* iOS Lockscreen Clock */}
                    <div className="notif-ios-lock-header">
                      <div className="notif-ios-date">{clockData.dateLong}</div>
                      <div className="notif-ios-clock">{clockData.time}</div>
                    </div>

                    {/* iOS Frosted Glass Notification Card */}
                    <div className="notif-mock-ios-wrap">
                      <div className="notif-mock-ios">
                        <div className="notif-mock-ios-header">
                          <div className="notif-mock-app-icon ios">
                            <img
                              src={appLogo}
                              alt="D-Base Solutions"
                              className="notif-app-logo-img"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/images/dbs-logo-short.png";
                              }}
                            />
                          </div>
                          <div className="notif-mock-ios-title-wrap">
                            <span className="notif-mock-app-name-ios">D-BASE SOLUTIONS</span>
                            <span className="notif-mock-dot">•</span>
                            <span className="notif-mock-ios-time">now</span>
                          </div>
                        </div>
                        <div className="notif-mock-ios-title">
                          {title.trim() || "Notification Title"}
                        </div>
                        <div className="notif-mock-ios-body">
                          {body.trim() || "Notification message details will appear here on Apple iPhone lock screens with ultra-crisp frosted glass..."}
                        </div>
                      </div>
                    </div>

                    {/* iOS Bottom Quick Action Buttons */}
                    <div className="notif-ios-bottom-actions">
                      <div className="notif-ios-circle-btn">
                        <IonIcon icon={flashlightOutline} />
                      </div>
                      <div className="notif-ios-circle-btn">
                        <IonIcon icon={cameraOutline} />
                      </div>
                    </div>

                    {/* iOS Home Bar Indicator */}
                    <div className="notif-ios-home-bar"></div>
                  </div>
                ) : (
                  /* ===================== ANDROID GALAXY / PIXEL ===================== */
                  <div className="notif-screen-inner android">
                    {/* Centered Punch-hole Camera */}
                    <div className="notif-android-punchhole"></div>

                    {/* Android Status Bar */}
                    <div className="notif-android-status-bar">
                      <div className="notif-status-left">
                        <span className="notif-android-status-time">{clockData.time}</span>
                        <div className="notif-tiny-badge">
                          <img src={appLogo} alt="DBS" className="notif-tiny-logo-img" />
                        </div>
                      </div>
                      <div className="notif-status-right">
                        <span className="notif-cell-tag">VoLTE</span>
                        <IonIcon icon={wifiOutline} className="notif-wifi" />
                        <IonIcon icon={batteryFullOutline} className="notif-battery" />
                        <span className="notif-battery-percent">95%</span>
                      </div>
                    </div>

                    {/* Android Lockscreen Clock */}
                    <div className="notif-android-lock-header">
                      <div className="notif-android-clock">{clockData.time}</div>
                      <div className="notif-android-subinfo">
                        <span>{clockData.dateShort}</span>
                        <span className="notif-dot">•</span>
                        <span>28°C ☀️</span>
                      </div>
                    </div>

                    {/* Android Material You Notification Card */}
                    <div className="notif-mock-android-wrap">
                      <div className="notif-mock-android">
                        <div className="notif-mock-android-top">
                          <div className="notif-mock-app-icon android">
                            <img
                              src={appLogo}
                              alt="D-Base Solutions"
                              className="notif-app-logo-img"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/images/dbs-logo-short.png";
                              }}
                            />
                          </div>
                          <span className="notif-mock-app-name">D-Base Dashboard</span>
                          <span className="notif-mock-dot">•</span>
                          <span className="notif-mock-time">now</span>
                        </div>
                        <div className="notif-mock-title">
                          {title.trim() || "Notification Title"}
                        </div>
                        <div className="notif-mock-body">
                          {body.trim() || "Notification message details will be displayed here on Android devices with rich Material styling..."}
                        </div>
                        <div className="notif-mock-actions">
                          <span className="notif-mock-act-chip primary">
                            <IonIcon icon={paperPlaneOutline} /> Open App
                          </span>
                          <span className="notif-mock-act-chip">Dismiss</span>
                        </div>
                      </div>
                    </div>

                    {/* Android In-Display Fingerprint & Unlock Cue */}
                    <div className="notif-android-bottom-bar">
                      <div className="notif-android-fp-sensor">
                        <IonIcon icon={fingerPrintOutline} />
                      </div>
                      <div className="notif-android-swipe-txt">Swipe up to unlock</div>
                      <div className="notif-android-nav-bar"></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SENT BROADCASTS & HISTORY */}
        {activeTab === "history" && (
          <div className="notif-history-container">
            <div className="notif-history-top-row">
              <div className="notif-history-stats">
                <span className="notif-stat-badge">
                  <strong>{historyList.length}</strong> Total Broadcasts
                </span>
                <span className="notif-stat-badge success">
                  <strong>{historyList.reduce((acc, h) => acc + h.SentCount, 0)}</strong> Delivered Pushes
                </span>
              </div>
              <button className="notif-btn-refresh" onClick={fetchHistory} disabled={isLoadingHistory}>
                <IonIcon icon={repeatOutline} className={isLoadingHistory ? "spin" : ""} />
                <span>Refresh History</span>
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="notif-center-loading">
                <IonSpinner name="crescent" />
                <p>Loading broadcast logs...</p>
              </div>
            ) : historyList.length === 0 ? (
              <div className="notif-empty-state">
                <IonIcon icon={notificationsOutline} />
                <h3>No Broadcasts Sent Yet</h3>
                <p>Compose and dispatch your first notification using the composer tab above.</p>
                <button className="notif-btn-primary" onClick={() => setActiveTab("compose")}>
                  <IonIcon icon={sendOutline} />
                  <span>Compose Notification</span>
                </button>
              </div>
            ) : (
              <div className="notif-history-list">
                {historyList.map(item => (
                  <div key={item.BroadcastId} className="notif-history-card">
                    <div className="notif-hcard-header">
                      <div className="notif-hcard-tags">
                        <span className={`notif-cat-pill ${item.Category.toLowerCase().replace(/\s+/g, "-")}`}>
                          {item.Category}
                        </span>
                        <span className={`notif-priority-pill ${item.Priority.toLowerCase()}`}>
                          {item.Priority}
                        </span>
                        <span className="notif-time-pill">
                          <IonIcon icon={timeOutline} />
                          {item.CreatedDate}
                        </span>
                      </div>
                      <div className="notif-hcard-actions">
                        <button
                          type="button"
                          className="notif-icon-action-btn view"
                          onClick={() => handleViewDetails(item)}
                          title="View Delivery Details"
                        >
                          <IonIcon icon={eyeOutline} />
                        </button>
                        <button
                          type="button"
                          className="notif-icon-action-btn duplicate"
                          onClick={() => handleDuplicate(item)}
                          title="Duplicate / Resend"
                        >
                          <IonIcon icon={repeatOutline} />
                        </button>
                        <button
                          type="button"
                          className="notif-icon-action-btn delete"
                          onClick={() => handleDelete(item)}
                          title="Delete from history"
                        >
                          <IonIcon icon={trashOutline} />
                        </button>
                      </div>
                    </div>

                    <h3 className="notif-hcard-title">{item.Title}</h3>
                    <p className="notif-hcard-body">{item.Body}</p>

                    <div className="notif-hcard-footer">
                      <div className="notif-hcard-meta">
                        <span><strong>Target:</strong> {item.TargetType === "ALL" ? `All Employees (${item.TargetCount})` : `${item.TargetCount} Specific`}</span>
                        <span className="meta-sep">•</span>
                        <span><strong>Delivered Pushes:</strong> {item.SentCount}</span>
                        {item.FailedCount > 0 && (
                          <>
                            <span className="meta-sep">•</span>
                            <span className="text-danger">Failed: {item.FailedCount}</span>
                          </>
                        )}
                        <span className="meta-sep">•</span>
                        <span><strong>By:</strong> {item.SenderName || item.SenderEmpCode}</span>
                      </div>
                      <div className="notif-hcard-channels">
                        {item.Channels.includes("PUSH") && (
                          <span className="notif-chan-pill" title="Push Notification Delivered">
                            <IonIcon icon={phonePortraitOutline} />
                            Push
                          </span>
                        )}
                        {item.Channels.includes("INAPP") && (
                          <span className="notif-chan-pill inapp" title="In-App Feed Delivered">
                            <IonIcon icon={notificationsOutline} />
                            In-App
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONFIRMATION MODAL */}
        <IonModal isOpen={showConfirmModal} onDidDismiss={() => setShowConfirmModal(false)} className="notif-dialog-modal">
          <div className="notif-modal-content">
            <div className="notif-modal-header">
              <div className="notif-modal-icon-wrap">
                <IonIcon icon={sendOutline} />
              </div>
              <h2 className="notif-modal-title">Confirm Broadcast Dispatch</h2>
              <button className="notif-modal-close" onClick={() => setShowConfirmModal(false)}>
                <IonIcon icon={closeOutline} />
              </button>
            </div>

            <div className="notif-modal-body">
              <p className="notif-confirm-desc">
                You are about to dispatch this notification to:
              </p>
              <div className="notif-confirm-summary-box">
                <div className="notif-summary-row">
                  <span>Audience:</span>
                  <strong>{targetType === "ALL" ? `All Employees (${employees.length})` : `${selectedEmpCodes.length} Specific Employees`}</strong>
                </div>
                <div className="notif-summary-row">
                  <span>Priority:</span>
                  <span className={`notif-priority-pill ${priority.toLowerCase()}`}>{priority}</span>
                </div>
                <div className="notif-summary-row">
                  <span>Channels:</span>
                  <strong>{channelPush && channelInApp ? "Push + In-App" : channelPush ? "Push Only" : "In-App Only"}</strong>
                </div>
                <div className="notif-summary-row">
                  <span>Target Page:</span>
                  <code>{actionUrl || "/"}</code>
                </div>
              </div>

              <div className="notif-confirm-preview-bubble">
                <h4>{title}</h4>
                <p>{body}</p>
              </div>
            </div>

            <div className="notif-modal-footer">
              <button className="notif-btn-secondary" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </button>
              <button className="notif-btn-primary" onClick={handleSendBroadcast} disabled={isSending}>
                <IonIcon icon={paperPlaneOutline} />
                <span>Confirm & Send Now</span>
              </button>
            </div>
          </div>
        </IonModal>

        {/* DETAILS & RECIPIENTS MODAL */}
        <IonModal isOpen={detailsModalOpen} onDidDismiss={() => setDetailsModalOpen(false)} className="notif-dialog-modal">
          <div className="notif-modal-content">
            <div className="notif-modal-header">
              <div className="notif-modal-icon-wrap info">
                <IonIcon icon={notificationsOutline} />
              </div>
              <div>
                <h2 className="notif-modal-title">Broadcast Details</h2>
                <span className="notif-modal-subtitle">{selectedBroadcast?.Title}</span>
              </div>
              <button className="notif-modal-close" onClick={() => setDetailsModalOpen(false)}>
                <IonIcon icon={closeOutline} />
              </button>
            </div>

            <div className="notif-modal-body">
              {selectedBroadcast && (
                <div className="notif-details-top-card">
                  <p className="notif-details-msg">{selectedBroadcast.Body}</p>
                  <div className="notif-details-meta-grid">
                    <div>
                      <span>Date:</span> {selectedBroadcast.CreatedDate}
                    </div>
                    <div>
                      <span>Category:</span> {selectedBroadcast.Category}
                    </div>
                    <div>
                      <span>Sent Pushes:</span> {selectedBroadcast.SentCount}
                    </div>
                    <div>
                      <span>Sender:</span> {selectedBroadcast.SenderName || selectedBroadcast.SenderEmpCode}
                    </div>
                  </div>
                </div>
              )}

              <h4 className="notif-recipients-subheading">
                In-App Read Receipts ({broadcastRecipients.length})
              </h4>

              {isLoadingDetails ? (
                <div className="notif-center-loading">
                  <IonSpinner name="crescent" />
                  <p>Loading recipients...</p>
                </div>
              ) : broadcastRecipients.length === 0 ? (
                <p className="notif-empty-text">No in-app read receipts available.</p>
              ) : (
                <div className="notif-recipients-scroll-list">
                  {broadcastRecipients.map(r => (
                    <div key={r.NotificationId} className="notif-recipient-row">
                      <div className="notif-r-left">
                        <span className="notif-r-name">{r.EmpName}</span>
                        <span className="notif-r-code">#{r.EmpCode}</span>
                      </div>
                      <span className={`notif-r-status ${r.IsRead ? "read" : "unread"}`}>
                        <IonIcon icon={r.IsRead ? checkmarkDoneOutline : timeOutline} />
                        {r.IsRead ? "Read" : "Unread"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="notif-modal-footer">
              <button className="notif-btn-secondary" onClick={() => setDetailsModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default NotificationCenter;
