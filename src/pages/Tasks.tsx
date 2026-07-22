import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonMenuButton,
  IonInput,
  IonItem,
  IonLabel,
  IonDatetimeButton,
  IonModal,
  IonDatetime,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonSegment,
  IonSegmentButton,
  IonIcon,
  IonRow,
  IonGrid,
  IonCol,
  IonToast,
  IonLoading,
  IonFab,
  IonFabButton,
  IonToggle,
  useIonAlert
} from "@ionic/react";
import {
  send,
  search,
  close,
  calendar,
  trash,
  refresh,
  add,
  person,
  documentText,
  flag,
  chevronForward,
  ellipsisVertical,
  flame,
  flash,
  leaf,
  arrowBack,
  checkmarkCircle,
  checkmarkCircleOutline,
  colorFill,
  repeat,
  arrowRedo,
  arrowUndo,
  time,
  playCircle,
  pauseCircle
} from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { apiService } from "../utils/apiService";
import { API_BASE } from "../config";
import "./Tasks.css";

const Tasks: React.FC = () => {
  const history = useHistory();
  const [selectedTab, setSelectedTab] = useState<string>("view");
  const [filterValue, setFilterValue] = useState<string>("pending");
  const [assignTo, setAssignTo] = useState("");
  const [description, setDescription] = useState("");
  const getTodayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const [targetDate, setTargetDate] = useState("");
  const [targetTime, setTargetTime] = useState("");
  const [priority, setPriority] = useState("");
  const [startDateModalOpen, setStartDateModalOpen] = useState(false);

  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTaskHistory, setSelectedTaskHistory] = useState<any[]>([]);
  const [activeTask, setActiveTask] = useState<any>(null);

  // API Data State
  const [employees, setEmployees] = useState<any[]>([]);
  const [sentTasks, setSentTasks] = useState<any[]>([]);
  const [receivedTasks, setReceivedTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [present] = useIonAlert();
  const [toastMessage, setToastMessage] = useState("");
  const [currentEmpCode, setCurrentEmpCode] = useState("");
  const [currentEmpName, setCurrentEmpName] = useState("");

  // New states for updates
  const [updateStatusInfo, setUpdateStatusInfo] = useState("");
  const [updateStatus, setUpdateStatus] = useState("");
  const [transferTargetEmp, setTransferTargetEmp] = useState("");

  // Tagging states
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagActiveTask, setTagActiveTask] = useState<any>(null);
  const [selectedTagEmployees, setSelectedTagEmployees] = useState<string[]>([]);
  const [activeTaskTags, setActiveTaskTags] = useState<string[]>([]);
  const [trueCurrentAssignee, setTrueCurrentAssignee] = useState("");

  // Custom Dropdown States
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [isTransferDropdownOpen, setIsTransferDropdownOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [empSearchTerm, setEmpSearchTerm] = useState("");
  const triggerRef = useRef<HTMLDivElement>(null);
  const transferTriggerRef = useRef<HTMLDivElement>(null);

  // Position logic
  useEffect(() => {
    if (isEmployeeDropdownOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isEmployeeDropdownOpen]);

  useEffect(() => {
    if (isTransferDropdownOpen && transferTriggerRef.current) {
      const rect = transferTriggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 220)
      });
    }
  }, [isTransferDropdownOpen]);

  // Filtering for Searchable Dropdown
  const filteredEmployees = employees.filter((emp) => {
    const term = empSearchTerm.toLowerCase();
    const id = String(emp[0]).toLowerCase();

    let name = String(emp[1]);
    if (name.startsWith(emp[0] + "-")) {
      name = name.replace(emp[0] + "-", "").trim();
    }
    name = name.toLowerCase();
    return name.includes(term) || id.includes(term);
  });

  const formatDateTime = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strTime = String(hours).padStart(2, '0') + ':' + minutes + ' ' + ampm;
    return `${day}-${month}-${year} ${strTime}`;
  };
  const formatEmpName = (value: string) => {
    if (!value) return "";

    const parts = value.split("-");

    // remove duplicate ID if repeated
    if (parts.length > 2 && parts[0] === parts[1]) {
      parts.splice(1, 1);
    }

    return parts.join("-").trim();
  };
  const formatDateOnly = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };
  const getCleanName = (value: string) => {
    if (!value) return "Unknown";

    // remove ID prefix like "1520-"
    const parts = value.split("-");
    return parts.length > 1 ? parts.slice(1).join("-").trim() : value;
  };
  const formatToISODate = (date: Date | string) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  };

  /**
   * Fetches the Mobile number for a given EmpCode using the full employee profile API.
   * The Load_Employees list used by the dropdown does NOT contain Mobile numbers,
   * so we must call Get_Employee which returns the complete tbl_employee row.
   * Schema: [Employee_ID, EmpCode, EmpName, Designation, DOJ, Blood, Mobile, ...]
   * So Mobile is at index 6 (or named .Mobile on object responses).
   */
  const fetchEmployeeMobile = async (empCode: string): Promise<string> => {
    try {
      if (!empCode) return "";
      const data = await apiService.getEmployee(empCode);
      // API may return array-of-arrays or array-of-objects
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return "";
      // Try named property first (object response), then index 6 (array response)
      const mobile = String(row.Mobile ?? row.mobile ?? row[6] ?? "").trim();
      console.log(`📞 [fetchEmployeeMobile] EmpCode=${empCode} → Mobile=${mobile}`);
      return mobile;
    } catch (err) {
      console.warn(`⚠️ [fetchEmployeeMobile] Failed for EmpCode=${empCode}:`, err);
      return "";
    }
  };

  const formatEmpWithCode = (value: string) => {
    if (!value) return "";
    const parts = value.split("-");
    if (parts.length > 2 && parts[0] === parts[1]) {
      parts.splice(1, 1);
    }
    if (parts.length >= 2) {
      return `${parts[0].trim()} - ${parts.slice(1).join("-").trim()}`;
    }
    return value.trim();
  };

  const getCurrentTimeFormatted = () => {
    const date = new Date();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const buildTaskContext = (task: any) => ({
    taskId: String(task.TID ?? task.taskId ?? ""),
    description: String(task.TDesc ?? task.description ?? "")
      .replace(/\r?\n/g, " ")
      .trim(),
    priority: task.TPriority ?? task.priority ?? "Low",
    creator: formatEmpWithCode(task.SenEName),
    creatorEmpCode: task.SenEName ? String(task.SenEName).split("-")[0].trim() : "",
    assignee: formatEmpWithCode(task.RecEName),
    assigneeEmpCode: task.RecEName ? String(task.RecEName).split("-")[0].trim() : "",
    assignedDate: task.ADt ?? "",
    targetDate: task.TDt ?? "",
    targetDays: String(task.TargetDays ?? 0),
    actionTime: getCurrentTimeFormatted()
  });

  const sendPushNotification = async (empCode: string, title: string, body: string) => {
    try {
      const res = await fetch(`${API_BASE}Notifications/SendPush`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")?.replace(/"/g, "")}`
        },
        body: JSON.stringify({
          EmpCode: empCode,
          Title: title,
          Body: body,
          Url: "/tasks"
        })
      });
      const data = await res.json().catch(() => ({}));
      console.log("Push API Result:", data);

      if (!res.ok) {
        console.warn(`Backend Push Error: ${data.error || data.message || res.statusText}`);
        return;
      }

      if (data.failed > 0) {
        console.warn(`❌ FCM delivery failed for ${data.failed} tokens. The user's device might have an expired push token.`);
      }
    } catch (e) {
      console.error("Push Catch Error:", e);
    }
  };

  const sendTaskWhatsApp = async (mobile: string, templateType: string, ctx: any, extra?: any) => {
    if (!mobile) return;
    const cleanedMobile = mobile.replace(/\D/g, "");
    if (cleanedMobile.length < 10) {
      console.warn(`[WhatsApp] Skipped sending: invalid mobile length (${mobile})`);
      return;
    }

    let templateName = "";
    let params: string[] = [];

    switch (templateType) {
      case "task_new_assigned":
        templateName = "task_new_assigned";
        params = [
          String(ctx.taskId ?? ""),
          String(ctx.creator ?? ""),
          String(ctx.assignee ?? ""),
          String(ctx.priority ?? ""),
          String(ctx.description ?? ""),
          String(ctx.assignedDate ?? ""),
          String(ctx.targetDate ?? ""),
          String(ctx.targetDays ?? ""),
          String(ctx.actionTime ?? "")
        ];
        break;

      case "task_status_updated":
        templateName = "task_status_updated";
        params = [
          String(ctx.taskId ?? ""),
          String(ctx.creator ?? ""),
          String(ctx.assignee ?? ""),
          String(ctx.priority ?? ""),
          String(ctx.description ?? ""),
          String(extra?.status || "In Progress"),
          String(extra?.updatedBy ?? ""),
          String(extra?.remarks || "No remarks provided"),
          String(ctx.targetDate ?? "")
        ];
        break;

      case "task_completed":
        templateName = "task_completed";
        params = [
          String(ctx.taskId ?? ""),
          String(ctx.creator ?? ""),
          String(extra?.completedBy ?? ""),
          String(ctx.priority ?? ""),
          String(ctx.description ?? ""),
          String(extra?.remarks || "Task marked as completed"),
          String(ctx.targetDate ?? "")
        ];
        break;

      case "task_transferred_creator":
        templateName = "task_transferred_creator";
        params = [
          String(ctx.taskId ?? ""),
          String(ctx.creator ?? ""),
          String(ctx.assignee ?? ""),
          String(extra?.newAssignee ?? ""),
          String(ctx.priority ?? ""),
          String(ctx.description ?? ""),
          String(extra?.transferredBy ?? ""),
          String(extra?.remarks || "N/A"),
          String(ctx.targetDate ?? "")
        ];
        break;

      case "task_transferred_assignee":
        templateName = "task_transferred_assignee";
        params = [
          String(ctx.taskId ?? ""),
          String(ctx.creator ?? ""),
          String(ctx.assignee ?? ""),
          String(extra?.newAssignee ?? ""),
          String(ctx.priority ?? ""),
          String(ctx.description ?? ""),
          String(extra?.transferredBy ?? ""),
          String(extra?.remarks || "N/A"),
          String(ctx.targetDate ?? "")
        ];
        break;

      case "task_reopened":
        templateName = "task_reopened";
        params = [
          String(ctx.taskId ?? ""),
          String(ctx.creator ?? ""),
          String(ctx.assignee ?? ""),
          String(ctx.priority ?? ""),
          String(ctx.description ?? ""),
          String(extra?.reopenedBy ?? ""),
          String(ctx.targetDate ?? "")
        ];
        break;
    }

    if (templateName) {
      console.log(`[WhatsApp] Sending template ${templateName} to ${mobile}`);
      try {
        await apiService.sendWhatsAppTemplate(cleanedMobile, templateName, params);
      } catch (err) {
        console.error("[WhatsApp] sendWhatsAppTemplate failed:", err);
      }
    }
  };

  const calculateTrueCurrentAssignee = (history: any[], defaultAssignee: string) => {
    let currentAssignee = defaultAssignee;
    const firstTransfer = history.find(item => !!item.toName);
    if (firstTransfer) {
      currentAssignee = firstTransfer.fromName;
    }
    for (let i = 0; i < history.length; i++) {
      const item = history[i];
      if (item.toName) {
        currentAssignee = item.toName;
      }
    }
    return currentAssignee;
  };

  useEffect(() => {
    const userJson = localStorage.getItem("user");
    if (userJson) {
      const user = JSON.parse(userJson);
      const empCode = user.empCode || user.EmpCode;
      const empName = user.empName || user.EmpName;
      setCurrentEmpCode(empCode);
      setCurrentEmpName(empName);
      console.log("Logged In User:", user);
      fetchInitialData(empCode);
    }
  }, []);

  const fetchInitialData = async (empCode: string) => {
    setIsLoading(true);
    try {
      console.group("Fetching Initial Data");

      // 1. Load Employees (API 1)
      const emps = await apiService.loadEmployees("Active");
      setEmployees(emps);
      // Debug: print first employee to check structure
      if (emps && emps.length > 0) {
        console.log("🔑 [Employee Structure] First employee:", JSON.stringify(emps[0]), "| Keys:", Object.keys(emps[0] || {}));
      }

      // 3. Load Sent Tasks (API 3)
      const sent = await apiService.loadSentTasks(empCode);
      const mappedSent = (sent || []).map((t: any) => ({
        TID: t.TID || t[0],
        SenEName: typeof t.SenEName === 'string' ? t.SenEName : "",
        RecEName: typeof t.RecEName === 'string' ? t.RecEName : "",
        ADt: typeof t.ADt === 'string' ? t.ADt : "",
        TDt: typeof t.TDt === 'string' ? t.TDt.split(/[ T]/)[0] : "",
        TargetTime: typeof (t.DTime || t.dTime || t.Dtime || t.dtime || t.TargetTime || t.targetTime) === 'string' ? (() => {
          const timeStr = t.DTime || t.dTime || t.Dtime || t.dtime || t.TargetTime || t.targetTime;
          let [h, m] = timeStr.split(':');
          if (!h || !m) return timeStr;
          const isPM = timeStr.toLowerCase().includes('pm');
          const isAM = timeStr.toLowerCase().includes('am');
          const ampm = isPM ? 'PM' : (isAM ? 'AM' : (Number(h) >= 12 ? 'PM' : 'AM'));
          h = (Number(h) % 12 || 12).toString();
          return `${h}:${m} ${ampm}`;
        })() : "",
        DTime: typeof (t.DTime || t.dTime || t.Dtime || t.dtime || t.TargetTime || t.targetTime) === 'string' ? (t.DTime || t.dTime || t.Dtime || t.dtime || t.TargetTime || t.targetTime) : "",
        TDesc: typeof t.TDesc === 'string' ? t.TDesc : "",
        Status: typeof t.Status === 'string' ? t.Status : "",
        TPriority: typeof t.TPriority === 'string' ? t.TPriority : "Low",
        ReopenRemarks: typeof t.ReopenRemarks === 'string' ? t.ReopenRemarks : "",
        IsTransferred: t.IsTransferred === true || t.IsTransferred === 1 || t.isTransferred === true || t.isTransferred === 1 || false,
      }));
      setSentTasks(mappedSent);

      // 4. Load Received Tasks (API 4)
      const received = await apiService.loadReceivedTasks(empCode);
      console.log("RECEIVED TASKS RAW:", received);
      const mappedReceived = (received || []).map((t: any) => ({
        TID: t.TID ?? t[0],
        SenEName: typeof t.SenEName === 'string' ? t.SenEName : "",
        RecEName: typeof t.RecEName === 'string' ? t.RecEName : "",
        ADt: typeof t.ADt === 'string' ? t.ADt : "",
        TDt: typeof t.TDt === 'string' ? t.TDt.split(/[ T]/)[0] : "",
        TargetTime: typeof (t.DTime || t.dTime || t.Dtime || t.dtime || t.TargetTime || t.targetTime) === 'string' ? (() => {
          const timeStr = t.DTime || t.dTime || t.Dtime || t.dtime || t.TargetTime || t.targetTime;
          let [h, m] = timeStr.split(':');
          if (!h || !m) return timeStr;
          const isPM = timeStr.toLowerCase().includes('pm');
          const isAM = timeStr.toLowerCase().includes('am');
          const ampm = isPM ? 'PM' : (isAM ? 'AM' : (Number(h) >= 12 ? 'PM' : 'AM'));
          h = (Number(h) % 12 || 12).toString();
          return `${h}:${m} ${ampm}`;
        })() : "",
        DTime: typeof (t.DTime || t.dTime || t.Dtime || t.dtime || t.TargetTime || t.targetTime) === 'string' ? (t.DTime || t.dTime || t.Dtime || t.dtime || t.TargetTime || t.targetTime) : "",
        TDesc: typeof t.TDesc === 'string' ? t.TDesc : "",
        Status: typeof t.Status === 'string' ? t.Status : "",
        TPriority: typeof t.TPriority === 'string' ? t.TPriority : "Low",
        TargetDays: typeof t.TargetDays === 'number' ? t.TargetDays : (parseInt(t.TargetDays) || 0),
        ReopenRemarks: typeof t.ReopenRemarks === 'string' ? t.ReopenRemarks : "",
        IsTagged: t.IsTagged === true || t.IsTagged === 1 || t.isTagged === true || t.isTagged === 1 || false,
        IsTransferred: t.IsTransferred === true || t.IsTransferred === 1 || t.isTransferred === true || t.isTransferred === 1 || false,
      }));
      setReceivedTasks(mappedReceived);

      console.groupEnd();
    } catch (error) {
      console.error("Error fetching data:", error);
      // setToastMessage("Failed to load data");

      setToastMessage("No Data Found");
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewTask = async (task: any) => {
    setIsLoading(true);
    setActiveTask(task);
    setSelectedTaskHistory([]); // Reset history before fetching
    setActiveTaskTags([]); // Reset tags before fetching
    setTrueCurrentAssignee(task.RecEName); // Set default assignee right away, in case fetch fails
    try {
      const history = await apiService.loadViewTask(task.TID);
      const mappedHistory = (history || []).map((item: any) => ({
        fromName: item[0],
        toName: item[1],
        status: item[5],
        date: item[9],
        message: item[10],
      }));
      setSelectedTaskHistory(mappedHistory);
      const trueAssignee = calculateTrueCurrentAssignee(mappedHistory, task.RecEName);
      setTrueCurrentAssignee(trueAssignee);

      // Load tags
      try {
        const tags = await apiService.getTaskTags(task.TID);
        setActiveTaskTags(tags || []);
      } catch (tagErr) {
        console.warn("Failed to load task tags:", tagErr);
      }
    } catch (error) {
      console.error("Error fetching task view:", error);
      // Even if fetch fails (e.g., 400 Bad Request), we still want to show the modal with empty history
      setSelectedTaskHistory([]);
      setTrueCurrentAssignee(task.RecEName); // Fallback to initial recipient
    } finally {
      setIsLoading(false);
      setDetailModalOpen(true); // Open modal regardless of success/failure
    }
  };

  const handleSendTask = async () => {
    if (!assignTo || !description || !targetDate || !priority) {
      setToastMessage("Please fill all fields");
      return;
    }

    setIsLoading(true);
    try {
      const today = new Date();
      const target = new Date(targetDate);

      // Calculate difference in days
      const diffTime = target.getTime() - today.getTime();
      const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

      const taskData = {
        _Tskid: 0,
        _SenEName: `${currentEmpCode}-${currentEmpName}`,
        _RecEName: assignTo,
        _AssignDate: formatToISODate(today),
        _TargetDate: formatToISODate(targetDate),
        _DTime: targetTime,
        _TskDescription: description,
        _TargetDays: String(diffDays),
        _Priority: priority,
      };

      console.log("Submitting Task Data:", taskData);
      const saveResult = await apiService.saveTask(taskData);
      //console.log("🎉 Save Task API Response:", saveResult);
      //const result = await saveTask(data);
      //console.log("WhatsApp Debug:", saveResult.debug);

      console.log("Save Task API Response:", saveResult);
      console.log("WhatsApp Debug:", saveResult.debug);
      console.log("WhatsApp Payload:", saveResult.debug.payload);
      console.log("Meta Response:", saveResult.debug.metaResponse);

      const waStatus = saveResult?.whatsAppStatus || saveResult?.WhatsAppStatus;
      const waError = saveResult?.whatsAppError || saveResult?.WhatsAppError;

      if (waStatus) {
        console.log(`📡 [WhatsApp Integration] Status: ${waStatus}`);
        if (waError) {
          console.error("❌ [WhatsApp Integration] Meta API Error Payload:", waError);
        }
      }

      setToastMessage("Task assigned successfully");

      // --- SEND PUSH NOTIFICATION ---
      try {
        const assignedEmpCode = assignTo.split("-")[0].trim();
        if (assignedEmpCode) {
          sendPushNotification(assignedEmpCode, "New Task Assigned", `A new task has been assigned to you by ${currentEmpName}.`);
        }
      } catch (e) {
        console.error("Push Catch:", e);
      }
      // ------------------------------

      // --- SEND WHATSAPP NOTIFICATION ---
      try {
        const assignedEmpCode = assignTo.split("-")[0].trim();
        if (assignedEmpCode) {
          const mobile = await fetchEmployeeMobile(assignedEmpCode);
          if (mobile) {
            let newTaskId = "";
            if (saveResult) {
              if (typeof saveResult === "object") {
                newTaskId = String(saveResult.TID || saveResult.taskId || saveResult.id || "");
              } else {
                newTaskId = String(saveResult);
              }
            }
            const ctx = {
              taskId: newTaskId || "N/A",
              description: String(description).replace(/\r?\n/g, " ").trim(),
              priority: priority,
              creator: formatEmpWithCode(`${currentEmpCode}-${currentEmpName}`),
              assignee: formatEmpWithCode(assignTo),
              assignedDate: formatDateOnly(today.toISOString()),
              targetDate: formatDateOnly(targetDate),
              targetDays: String(diffDays),
              actionTime: getCurrentTimeFormatted()
            };
            await sendTaskWhatsApp(mobile, "task_new_assigned", ctx);
          }
        }
      } catch (e) {
        console.error("[WhatsApp] Failed to send assignment notification:", e);
      }

      // SMS notification has been removed per user requirements (WhatsApp only)
      handleClear();
      fetchInitialData(currentEmpCode);
    } catch (error) {
      console.error("Error saving task:", error);
      setToastMessage("Failed to assign task");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setAssignTo("");
    setDescription("");
    setTargetDate("");
    setTargetTime("");
    setPriority("");
  };

  const getFilteredTasks = (source: any[]) => {
    if (!source) return [];
    if (filterValue === "all") return source;
    if (filterValue === "pending") return source.filter(t => t.Status === "Pending" || !t.Status || t.Status === "In Progress" || t.Status === "On Hold");
    if (filterValue === "closed") return source.filter(t => t.Status === "Closed");
    return source;
  };

  const handleDeleteTask = async (tid: string) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    setIsLoading(true);
    try {
      await apiService.deleteTask(tid);
      setToastMessage("Task deleted");
      fetchInitialData(currentEmpCode);
    } catch (error) {
      console.error("Error deleting task:", error);
      setToastMessage("Failed to delete task");
    } finally {
      setIsLoading(false);
    }
  };

  const hasTodayNoProgressEntry = (history: any[]) => {
    const today = formatDateOnly(new Date().toISOString());
    return history.some((item) => {
      const datePart = (item.date || "").split(" ")[0];
      const message = (item.message || "").trim().toLowerCase();
      return datePart === today && (message === "no progress yet" || message === "no change");
    });
  };

  const refreshTaskHistory = async (tid: string) => {
    try {
      const history = await apiService.loadViewTask(tid);
      const mappedHistory = (history || []).map((item: any) => ({
        fromName: item[0],
        toName: item[1],
        status: item[5],
        date: item[9],
        message: item[10],
      }));
      setSelectedTaskHistory(mappedHistory);
      if (activeTask) {
        const trueAssignee = calculateTrueCurrentAssignee(mappedHistory, activeTask.RecEName);
        setTrueCurrentAssignee(trueAssignee);
      }
    } catch (error) {
      console.error("Error refreshing task history:", error);
      setSelectedTaskHistory([]);
      if (activeTask) {
        setTrueCurrentAssignee(activeTask.RecEName);
      }
    }
  };

  const handleProgress = async () => {
    if (!activeTask) return;

    if (hasTodayNoProgressEntry(selectedTaskHistory)) {
      setToastMessage("No progress already recorded for today");
      return;
    }

    setIsLoading(true);
    try {
      const statusData = {
        _Tskid: String(activeTask.TID),
        _StatusDate: formatDateTime(new Date()),
        _StatusInfo: "No Change",
        _Status: "",
        _SenEName: `${currentEmpCode}-${currentEmpName}`
      };
      await apiService.saveTaskStatus(statusData);
      await refreshTaskHistory(activeTask.TID);
      setToastMessage("Progress recorded");
    } catch (error) {
      console.error("Error saving progress:", error);
      setToastMessage("Failed to record progress");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!updateStatusInfo) {
      setToastMessage("Please enter status info / progress");
      return;
    }
    setIsLoading(true);
    try {
      const statusData = {
        _Tskid: String(activeTask.TID),
        _StatusDate: formatDateTime(new Date()),
        _StatusInfo: updateStatusInfo,
        _Status: "",
        _SenEName: `${currentEmpCode}-${currentEmpName}`
      };
      await apiService.saveTaskStatus(statusData);

      // --- SEND PUSH NOTIFICATION ---
      try {
        const ctx = buildTaskContext(activeTask);
        const targets = new Set<string>();
        if (ctx.creatorEmpCode) targets.add(ctx.creatorEmpCode);
        if (ctx.assigneeEmpCode) targets.add(ctx.assigneeEmpCode);
        targets.delete(currentEmpCode);

        targets.forEach(empCode => {
          sendPushNotification(empCode, "Task Status Updated", `Task #${activeTask.TID}: ${updateStatusInfo} — by ${currentEmpName}.`);
        });
      } catch (e) {
        console.error("Push Catch:", e);
      }
      // ------------------------------

      // --- SEND WHATSAPP NOTIFICATION ---
      try {
        const ctx = buildTaskContext(activeTask);
        const formattedCurrentUser = formatEmpWithCode(`${currentEmpCode}-${currentEmpName}`);

        const extra = {
          status: "In Progress",
          updatedBy: formattedCurrentUser,
          remarks: updateStatusInfo
        };

        // Notify the counterparty
        const targetEmpCode = (currentEmpCode === ctx.creatorEmpCode) ? ctx.assigneeEmpCode : ctx.creatorEmpCode;
        const targetMobile = await fetchEmployeeMobile(targetEmpCode);
        if (targetMobile) {
          await sendTaskWhatsApp(targetMobile, "task_status_updated", ctx, extra);
        }
      } catch (e) {
        console.error("[WhatsApp] Failed to send status update notification:", e);
      }

      setToastMessage("Status updated");
      setUpdateStatusInfo("");
      setDetailModalOpen(false);
      setActiveTask(null);
      fetchInitialData(currentEmpCode);
    } catch (error) {
      console.error("Error updating status:", error);
      setToastMessage("Failed to update status");
    } finally {
      setIsLoading(false);
    }
  };

  const performComplete = async () => {
    setIsLoading(true);
    try {
      const statusData = {
        _Tskid: String(activeTask.TID),
        _StatusDate: formatDateTime(new Date()),
        _StatusInfo: updateStatusInfo || "Task completed",
        _Status: "true",
        _SenEName: `${currentEmpCode}-${currentEmpName}`
      };
      await apiService.saveTaskStatus(statusData);

      // --- SEND PUSH NOTIFICATION ---
      try {
        const ctx = buildTaskContext(activeTask);
        const targets = new Set<string>();
        if (ctx.creatorEmpCode) targets.add(ctx.creatorEmpCode);
        if (ctx.assigneeEmpCode) targets.add(ctx.assigneeEmpCode);
        targets.delete(currentEmpCode);

        targets.forEach(empCode => {
          sendPushNotification(empCode, "Task Completed", `Task #${activeTask.TID}: ${updateStatusInfo || "Task completed"} — by ${currentEmpName}.`);
        });
      } catch (e) {
        console.error("Push Catch:", e);
      }
      // ------------------------------

      // --- SEND WHATSAPP NOTIFICATION ---
      try {
        const ctx = buildTaskContext(activeTask);
        const formattedCurrentUser = formatEmpWithCode(`${currentEmpCode}-${currentEmpName}`);

        const extra = {
          completedBy: formattedCurrentUser,
          remarks: updateStatusInfo || "Task marked as completed"
        };

        const [creatorMobile, assigneeMobile] = await Promise.all([
          fetchEmployeeMobile(ctx.creatorEmpCode),
          fetchEmployeeMobile(ctx.assigneeEmpCode)
        ]);

        // Deduplicate mobile numbers
        const mobiles = new Set<string>();
        if (creatorMobile) mobiles.add(creatorMobile);
        if (assigneeMobile) mobiles.add(assigneeMobile);

        await Promise.all(
          Array.from(mobiles).map(mobile =>
            sendTaskWhatsApp(mobile, "task_completed", ctx, extra)
          )
        );
      } catch (e) {
        console.error("[WhatsApp] Failed to send status update notification:", e);
      }

      setToastMessage("Task completed");
      setUpdateStatusInfo("");
      setUpdateStatus("");
      setDetailModalOpen(false);
      setActiveTask(null);
      fetchInitialData(currentEmpCode);
    } catch (error) {
      console.error("Error completing task:", error);
      setToastMessage("Failed to complete task");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteTask = () => {
    present({
      header: 'Complete Task',
      message: 'Are you sure you want to mark this task as completed?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Yes, Complete',
          handler: () => {
            performComplete();
          }
        }
      ]
    });
  };

  const handleTransferTask = async () => {
    if (!transferTargetEmp) {
      setToastMessage("Please select recipient");
      return;
    }
    if (!updateStatusInfo) {
      setToastMessage("Please enter What's the progress? (transfer remarks)");
      return;
    }
    setIsLoading(true);
    try {
      const transferData = {
        _Tskid: String(activeTask.TID),
        _StatusDate: formatDateTime(new Date()),
        _RecEName: transferTargetEmp,
        _SenEName: `${currentEmpName}`,
        _StatusInfo: updateStatusInfo,
      };
      await apiService.transferTask(transferData);

      // --- SEND WHATSAPP NOTIFICATION ---
      try {
        const ctx = buildTaskContext(activeTask);
        const newAssigneeEmpCode = transferTargetEmp.split("-")[0].trim();
        const newAssigneeFormatted = formatEmpWithCode(transferTargetEmp);
        const formattedCurrentUser = formatEmpWithCode(`${currentEmpCode}-${currentEmpName}`);

        const extra = {
          newAssignee: newAssigneeFormatted,
          transferredBy: formattedCurrentUser,
          remarks: updateStatusInfo || "N/A"
        };

        const [creatorMobile, newAssigneeMobile] = await Promise.all([
          fetchEmployeeMobile(ctx.creatorEmpCode),
          newAssigneeEmpCode ? fetchEmployeeMobile(newAssigneeEmpCode) : Promise.resolve("")
        ]);

        if (creatorMobile === newAssigneeMobile && creatorMobile) {
          await sendTaskWhatsApp(creatorMobile, "task_transferred_assignee", ctx, extra);
        } else {
          const sends = [];
          if (creatorMobile) {
            sends.push(sendTaskWhatsApp(creatorMobile, "task_transferred_creator", ctx, extra));
          }
          if (newAssigneeMobile) {
            sends.push(sendTaskWhatsApp(newAssigneeMobile, "task_transferred_assignee", ctx, extra));
          }
          await Promise.all(sends);
        }
      } catch (e) {
        console.error("[WhatsApp] Failed to send transfer notifications:", e);
      }

      setToastMessage("Task transferred");

      // --- SEND PUSH NOTIFICATION ---
      try {
        const ctx = buildTaskContext(activeTask);
        const transferredEmpCode = transferTargetEmp.split("-")[0].trim();
        const targets = new Set<string>();
        if (ctx.creatorEmpCode) targets.add(ctx.creatorEmpCode);
        if (transferredEmpCode) targets.add(transferredEmpCode);
        targets.delete(currentEmpCode);

        targets.forEach(empCode => {
          const isTransferee = (empCode === transferredEmpCode);
          sendPushNotification(
            empCode,
            "Task Transferred",
            isTransferee
              ? `Task #${activeTask.TID} has been transferred to you by ${currentEmpName}.`
              : `Task #${activeTask.TID} has been transferred to ${transferTargetEmp.split("-").slice(1).join("-").trim()} by ${currentEmpName}.`
          );
        });
      } catch (e) {
        console.error("Push Catch:", e);
      }
      // ------------------------------
      setTransferTargetEmp("");
      setUpdateStatusInfo("");
      setDetailModalOpen(false);
      fetchInitialData(currentEmpCode);
    } catch (error) {
      console.error("Error transferring task:", error);
      setToastMessage("Failed to transfer task");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReopenTask = (task: any) => {
    present({
      header: 'Reopen Task',
      subHeader: `ID: #${task.TID}`,
      message: 'Enter reopening remarks (Mandatory):',
      cssClass: 'premium-alert',
      inputs: [
        {
          name: 'remarks',
          type: 'textarea',
          placeholder: 'Enter reason for reopening task...'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'alert-button-cancel'
        },
        {
          text: 'Yes, Reopen',
          role: 'confirm',
          cssClass: 'alert-button-confirm',
          handler: (data) => {
            const remarksText = data.remarks?.trim();
            if (!remarksText) {
              setToastMessage("Reopening remarks are mandatory!");
              return false; // keeps alert open
            }
            performReopen(task, remarksText);
          }
        }
      ]
    });
  };

  const performReopen = async (task: any, remarks: string) => {
    setIsLoading(true);
    try {
      const reopenData = {
        _Tskid: String(task.TID),
        _StatusDate: formatDateTime(new Date()),
        _StatusInfo: remarks,
        _SenEName: `${currentEmpCode}-${currentEmpName}`
      };
      await apiService.reopenTask(reopenData);

      // --- SEND PUSH NOTIFICATION ---
      try {
        const ctx = buildTaskContext(task);
        const targets = new Set<string>();
        if (ctx.creatorEmpCode) targets.add(ctx.creatorEmpCode);
        if (ctx.assigneeEmpCode) targets.add(ctx.assigneeEmpCode);
        targets.delete(currentEmpCode);

        targets.forEach(empCode => {
          sendPushNotification(empCode, "Task Reopened", `Task #${task.TID} has been reopened by ${currentEmpName}. Please review.`);
        });
      } catch (e) {
        console.error("Push Catch:", e);
      }
      // ------------------------------

      // --- SEND WHATSAPP NOTIFICATION ---
      try {
        const ctx = buildTaskContext(task);
        const formattedCurrentUser = formatEmpWithCode(`${currentEmpCode}-${currentEmpName}`);
        const extra = {
          reopenedBy: formattedCurrentUser
        };
        const assigneeMobile = await fetchEmployeeMobile(ctx.assigneeEmpCode);
        if (assigneeMobile) {
          await sendTaskWhatsApp(assigneeMobile, "task_reopened", ctx, extra);
        }
      } catch (e) {
        console.error("[WhatsApp] Failed to send reopen notification:", e);
      }

      setToastMessage("Task reopened");
      fetchInitialData(currentEmpCode);
    } catch (error) {
      console.error("Error reopening task:", error);
      setToastMessage("Failed to reopen task");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenTagModal = async (task: any) => {
    setIsLoading(true);
    setTagActiveTask(task);
    setSelectedTagEmployees([]);
    try {
      const tags = await apiService.getTaskTags(task.TID);
      setSelectedTagEmployees(tags || []);
      setTagModalOpen(true);
    } catch (err) {
      console.error("Error loading task tags:", err);
      setToastMessage("Failed to load task tags");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTags = async () => {
    if (!tagActiveTask) return;
    setIsLoading(true);
    try {
      await apiService.saveTaskTags(tagActiveTask.TID, selectedTagEmployees, currentEmpCode);
      setToastMessage("Tags saved successfully");
      setTagModalOpen(false);
      setTagActiveTask(null);
      fetchInitialData(currentEmpCode);
    } catch (err) {
      console.error("Error saving task tags:", err);
      setToastMessage("Failed to save task tags");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    history.goBack();
  };

  return (
    <IonPage>
      {/* <IonHeader>
        <IonToolbar>
          <IonToolbar className="menu-toolbar" color="Tertiary">
            <img
              src="./images/dbase.png"
              alt="DBase Logo"
              className="menu-logo"
            />
          </IonToolbar>
        </IonToolbar>
      </IonHeader> */}

      <IonContent className="tasks-page">
        <IonLoading isOpen={isLoading} message="Processing..." />
        <IonToast
          isOpen={!!toastMessage}
          message={toastMessage}
          duration={2000}
          onDidDismiss={() => setToastMessage("")}
        />

        <div className="page-wr-header" style={{ margin: '16px 16px 20px 16px' }}>
          <div className="page-wr-header-left">
            <button className="page-wr-back-btn" onClick={handleBack} style={{ color: 'white' }}>
              <ChevronLeft size={22} />
            </button>
            <div>
              <h1 className="page-wr-title">Task Management</h1>
              <p className="page-wr-subtitle">Manage and assign tasks</p>
            </div>
          </div>
          <div className="page-wr-header-right">
            <button className="page-wr-header-icon-box" onClick={() => fetchInitialData(currentEmpCode)} title="Refresh Data" style={{ border: 'none', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IonIcon icon={repeat} style={{ fontSize: '20px', color: 'var(--ion-color-primary)' }} />
            </button>
          </div>
        </div>

        {/* Standalone Segment Tabs */}
        <div style={{ padding: '0 16px', marginBottom: '0px' }}>
          <div className="tasks-custom-tabs">
            <div
              className={`tasks-tab-item ${selectedTab === "view" ? "active" : ""}`}
              onClick={() => setSelectedTab("view")}
            >
              View Task
            </div>
            <div
              className={`tasks-tab-item ${selectedTab === "assign" ? "active" : ""}`}
              onClick={() => setSelectedTab("assign")}
            >
              Assign Task
            </div>
          </div>
        </div>

        {/* View Tasks Tab */}
        {selectedTab === "view" && (
          <div className="view-task-section ion-padding">
            <div className="task-filters-row">
              <div className="native-filter-segment">
                <div
                  className={`native-filter-item ${filterValue === "pending" ? "active" : ""}`}
                  onClick={() => setFilterValue("pending")}
                >
                  Pending
                </div>
                <div
                  className={`native-filter-item ${filterValue === "closed" ? "active" : ""}`}
                  onClick={() => setFilterValue("closed")}
                >
                  Closed
                </div>
                <div
                  className={`native-filter-item ${filterValue === "all" ? "active" : ""}`}
                  onClick={() => setFilterValue("all")}
                >
                  All
                </div>
                <div className={`native-filter-slider ${filterValue}`} />
              </div>
            </div>

            <div className="tasks-grid-container">
              {getFilteredTasks(receivedTasks).map((task: any, index: number) => (
                <div
                  className="tasks-premium-card"
                  key={index}
                  onClick={() => handleViewTask(task)}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className={`priority-marker ${(task.TPriority || "Low").toLowerCase()}`}></div>
                  <div className="task-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div className="tid-badge">#{task.TID}</div>
                      {task.IsTagged && <span className="premium-badge cc-badge" title="Carbon Copy (CC)">CC</span>}
                      {task.IsTransferred && (
                        <span className="premium-badge transferred-badge" title="Transferred">
                          <IonIcon icon={arrowRedo} style={{ fontSize: '10px' }} /> TRF
                        </span>
                      )}
                      {task.ReopenRemarks && (
                        <span className="premium-badge reopened-badge" title="Reopened">
                          <IonIcon icon={arrowUndo} style={{ fontSize: '10px' }} /> RE
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {task.Status === 'Closed' ? (
                        <IonButton
                          fill="outline"
                          color="success"
                          size="small"
                          onClick={(e) => { e.stopPropagation(); handleReopenTask(task); }}
                          style={{ '--border-radius': '8px', fontSize: '9px', height: '22px', margin: '0', '--padding-start': '8px', '--padding-end': '8px', width: 'auto' }}
                        >
                          Reopen
                        </IonButton>
                      ) : (
                        <div className={`tdm-status-pill small ${task.Status?.toLowerCase() || 'pending'}`} title={task.Status || 'Pending'}>
                          <IonIcon icon={
                            task.Status === 'In Progress' ? playCircle :
                              task.Status === 'On Hold' ? pauseCircle :
                                task.Status === 'Closed' || task.Status === 'Completed' ? checkmarkCircle :
                                  time
                          } style={{ fontSize: '10px' }} />
                          {
                            task.Status === 'In Progress' ? 'PRG' :
                              task.Status === 'On Hold' ? 'HLD' :
                                task.Status === 'Closed' || task.Status === 'Completed' ? 'CLSD' :
                                  'PND'
                          }
                        </div>
                      )}
                      {!task.IsTagged && (
                        <IonButton
                          fill="outline"
                          color="secondary"
                          size="small"
                          onClick={(e) => { e.stopPropagation(); handleOpenTagModal(task); }}
                          style={{ '--border-radius': '8px', fontSize: '9px', height: '22px', margin: '0', '--padding-start': '8px', '--padding-end': '8px', width: 'auto' }}
                        >
                          Tag
                        </IonButton>
                      )}
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="recipient">
                      <IonIcon icon={person} style={{ fontSize: '14px', marginRight: '4px' }} />
                      From: {formatEmpName(task.SenEName)}
                    </div>
                    {(task.DTime || task.TargetTime) && (
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#f59e0b', margin: '4px 0' }}>
                        Deadline Time: {task.TargetTime || task.DTime}
                      </div>
                    )}
                    <div className="desc">{task.TDesc}</div>
                    {task.ReopenRemarks && (
                      <div className="reopen-remarks-box">
                        <strong>Reopen Reason:</strong> {task.ReopenRemarks}
                      </div>
                    )}
                  </div>
                  <div className="card-footer-flex">
                    <div className="date-box">
                      <div className="date-lbl">Assigned</div>
                      <div className="date-val">{task.ADt}</div>
                    </div>
                    <div className="date-box right-align">
                      <div className="date-lbl">Deadline</div>
                      <div className="date-val accent">{task.TDt}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assign Task Tab */}
        {selectedTab === "assign" && (
          <div className="ntv-form-wrapper ion-padding">
            <div className="ntv-form-card">
              <div className="ntv-form-header">
              </div>

              <div className="ntv-form-body">
                <div className="ntv-form-grid">
                  <div className="ntv-form-group">
                    <label className="ntv-form-label">Employee</label>
                    <div className="ntv-form-input-wrapper" ref={triggerRef} onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}>
                      <IonIcon icon={person} className="ntv-form-input-icon" />
                      <span className="ntv-form-text-display">
                        {assignTo || "Select Employee"}
                      </span>

                      {isEmployeeDropdownOpen && createPortal(
                        <>
                          <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsEmployeeDropdownOpen(false); }} />
                          <div
                            className="custom-inline-dropdown"
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              top: `${dropdownPos.top}px`,
                              left: `${dropdownPos.left}px`,
                              width: `${dropdownPos.width}px`
                            }}
                          >
                            <div className="dropdown-search-sec">
                              <IonIcon icon={search} className="dropdown-search-icon" />
                              <input
                                type="text"
                                className="dropdown-pure-input"
                                placeholder="Search name or code..."
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
                                // Based on user feedback: emp[0] is ID, emp[1] is Name
                                const empId = String(emp[0]);

                                // Remove duplicate ID if present in name
                                let empName = String(emp[1]);

                                if (empName.startsWith(empId + "-")) {
                                  empName = empName.replace(empId + "-", "").trim();
                                }
                                const isSelected = assignTo === `${empId}-${empName}`;

                                // Clean initials logic (stripping numeric prefixes if any)
                                const cleanName = empName.includes("-")
                                  ? empName.split("-").slice(1).join("-").trim()
                                  : empName;


                                const initials = (cleanName.charAt(0) || "?").toUpperCase();

                                return (
                                  <div
                                    key={index}
                                    className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();

                                      let name = String(empName);

                                      // ✅ MUST FIX: remove duplicate ID if exists
                                      if (name.startsWith(empId + "-")) {
                                        name = name.replace(empId + "-", "").trim();
                                      }

                                      setAssignTo(`${empId}-${name}`); // ✅ clean value
                                      setIsEmployeeDropdownOpen(false);
                                      setEmpSearchTerm("");
                                    }}
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
                    </div>
                  </div>

                  <div className="ntv-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="ntv-form-label">Description</label>
                    </div>
                    <div className="ntv-form-input-wrapper" style={{ height: 'auto', padding: '10px 12px' }}>
                      <IonIcon icon={documentText} className="ntv-form-input-icon" style={{ alignSelf: 'flex-start', marginTop: '4px' }} />
                      <textarea
                        className="ntv-form-input"
                        style={{
                          height: '25px',
                          resize: 'none',
                          fontFamily: 'inherit',

                        }}
                        placeholder="What needs to be done?"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="ntv-form-group">
                    <label className="ntv-form-label">Deadline Date</label>
                    <div className="ntv-form-input-wrapper">
                      <IonIcon icon={calendar} className="ntv-form-input-icon" />
                      <input
                        type="text"
                        readOnly
                        className="ntv-form-input"
                        value={targetDate ? targetDate.split('T')[0] : ''}
                        placeholder="Select Date"
                        onClick={() => setStartDateModalOpen(true)}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                  </div>

                  <div className="ntv-form-group">
                    <label className="ntv-form-label">Deadline Time (Opt)</label>
                    <div className="ntv-form-input-wrapper">
                      <IonIcon icon={time} className="ntv-form-input-icon" />
                      <input
                        type="time"
                        className="ntv-form-input"
                        value={targetTime}
                        onChange={(e) => setTargetTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="ntv-form-group">
                    <label className="ntv-form-label">Priority</label>
                    <div className="ntv-form-input-wrapper">
                      <IonIcon icon={flag} className="ntv-form-input-icon" />
                      <IonSelect
                        interface="popover"
                        className="lr-popover-select"
                        placeholder="Select"
                        value={priority}
                        onIonChange={(e) => setPriority(e.detail.value)}
                      >
                        <IonSelectOption value="" disabled>Priority Level</IonSelectOption>
                        <IonSelectOption value="High">High</IonSelectOption>
                        <IonSelectOption value="Medium">Medium</IonSelectOption>
                        <IonSelectOption value="Low">Low</IonSelectOption>
                      </IonSelect>
                    </div>
                  </div>
                </div>

                <div className="ntv-form-buttons">
                  <button className="ntv-form-btn-submit" onClick={handleSendTask}>
                    <IonIcon icon={send} />
                    Launch Task
                  </button>
                  <button className="ntv-form-btn-clear" onClick={handleClear}>
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div className="task-filters-row" style={{ marginTop: '30px' }}>
              <div className="native-filter-segment">
                <div
                  className={`native-filter-item ${filterValue === "pending" ? "active" : ""}`}
                  onClick={() => setFilterValue("pending")}
                >
                  Pending
                </div>
                <div
                  className={`native-filter-item ${filterValue === "closed" ? "active" : ""}`}
                  onClick={() => setFilterValue("closed")}
                >
                  Closed
                </div>
                <div
                  className={`native-filter-item ${filterValue === "all" ? "active" : ""}`}
                  onClick={() => setFilterValue("all")}
                >
                  All
                </div>
                <div className={`native-filter-slider ${filterValue}`} />
              </div>
            </div>

            <div className="tasks-grid-container">
              {getFilteredTasks(sentTasks).map((task: any, index: number) => (
                <div
                  className="tasks-premium-card"
                  key={index}
                  onClick={() => handleViewTask(task)}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className={`priority-marker ${(task.TPriority || "Low").toLowerCase()}`}></div>
                  <div className="task-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div className="tid-badge">#{task.TID}</div>
                      {task.IsTransferred && (
                        <span className="premium-badge transferred-badge" title="Transferred">
                          <IonIcon icon={arrowRedo} style={{ fontSize: '10px' }} /> TRF
                        </span>
                      )}
                      {task.ReopenRemarks && (
                        <span className="premium-badge reopened-badge" title="Reopened">
                          <IonIcon icon={arrowUndo} style={{ fontSize: '10px' }} /> RE
                        </span>
                      )}
                    </div>
                    <div className="action-buttons" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {task.Status === 'Closed' && (
                        <IonButton
                          fill="outline"
                          color="success"
                          size="small"
                          onClick={(e) => { e.stopPropagation(); handleReopenTask(task); }}
                          style={{ '--border-radius': '8px', fontSize: '9px', height: '22px', margin: '0', '--padding-start': '8px', '--padding-end': '8px', width: 'auto' }}
                        >
                          Reopen
                        </IonButton>
                      )}
                      <IonButton
                        fill="outline"
                        color="secondary"
                        size="small"
                        onClick={(e) => { e.stopPropagation(); handleOpenTagModal(task); }}
                        style={{ '--border-radius': '8px', fontSize: '9px', height: '22px', margin: '0', '--padding-start': '8px', '--padding-end': '8px', width: 'auto' }}
                      >
                        Tag
                      </IonButton>
                      {/* Delete button commented out per user requirements
                      <IonButton
                        fill="clear"
                        color="danger"
                        size="small"
                        onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.TID); }}
                        style={{ margin: 0 }}
                      >
                        <IonIcon icon={trash} slot="icon-only" style={{ fontSize: '18px' }} />
                      </IonButton>
                      */}
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="recipient">To: {formatEmpName(task.RecEName)}</div>
                    {(task.DTime || task.TargetTime) && (
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#f59e0b', margin: '4px 0' }}>
                        Deadline Time: {task.TargetTime || task.DTime}
                      </div>
                    )}
                    <div className="desc">{task.TDesc}</div>
                    {task.ReopenRemarks && (
                      <div className="reopen-remarks-box">
                        <strong>Reopen Reason:</strong> {task.ReopenRemarks}
                      </div>
                    )}
                  </div>
                  <div className="card-footer-flex">
                    <div className="date-box">
                      <div className="date-lbl">Assigned</div>
                      <div className="date-val">{task.ADt}</div>
                    </div>
                    <div className="date-box right-align">
                      <div className="date-lbl">Deadline</div>
                      <div className="date-val accent">{task.TDt}</div>
                    </div>
                  </div>
                </div>
              ))}
              {getFilteredTasks(sentTasks).length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon"><IonIcon icon={documentText} /></div>
                  <p>No tasks found.</p>
                </div>
              )}
            </div>
          </div>
        )}

        <IonModal
          isOpen={startDateModalOpen}
          onDidDismiss={() => setStartDateModalOpen(false)}
          className="tasks-deadline-modal"
        >
          <div className="pwt-modal-content">
            <h3 className="pwt-modal-title">Select Deadline</h3>
            <div className="pwt-datetime-wrap">
              <IonDatetime
                presentation="date"
                min={getTodayISO()}
                value={targetDate || undefined}
                onIonChange={(e) => {
                  if (typeof e.detail.value === "string")
                    setTargetDate(e.detail.value);
                  setStartDateModalOpen(false);
                }}
              />
            </div>
            <div className="pwt-modal-footer">
              <IonButton
                expand="block"
                mode="ios"
                fill="clear"
                onClick={() => setStartDateModalOpen(false)}
              >
                Close
              </IonButton>
            </div>
          </div>
        </IonModal>

        {/* Custom Task Detail Modal */}
        {detailModalOpen && (
          <div className="tdm-modal-overlay" onClick={() => setDetailModalOpen(false)}>
            <div className="tdm-modal-window" onClick={(e) => e.stopPropagation()}>
              <div className="tdm-modal-header">
                <div className="tdm-header-content">
                  <h3 className="tdm-modal-title">Task Activity: #{activeTask?.TID}</h3>
                  <button className="tdm-close-btn" onClick={() => setDetailModalOpen(false)}>
                    <IonIcon icon={close} />
                  </button>
                </div>
              </div>

              <div className="tdm-modal-body">
                {activeTask && (
                  <div className="tdm-header-details">
                    <div className="tdm-top-bar">
                      <div className="tdm-participants-wrap" style={{ fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                        {(() => {
                          const assigneeFlow = [activeTask.SenEName];
                          const transfers = selectedTaskHistory.filter(item => !!item.toName);
                          if (transfers.length > 0) {
                            if (transfers[0].fromName) {
                              assigneeFlow.push(transfers[0].fromName);
                            }
                            transfers.forEach(t => {
                              if (t.toName) {
                                assigneeFlow.push(t.toName);
                              }
                            });
                          } else {
                            assigneeFlow.push(activeTask.RecEName);
                          }

                          const uniqueFlow: string[] = [];
                          assigneeFlow.forEach(name => {
                            if (name && uniqueFlow[uniqueFlow.length - 1] !== name) {
                              uniqueFlow.push(name);
                            }
                          });

                          return uniqueFlow.map((name, idx) => (
                            <React.Fragment key={idx}>
                              {idx > 0 && <IonIcon icon={chevronForward} className="tdm-arrow-divider" style={{ margin: '0 4px', color: '#64748b' }} />}
                              <span className={`tdm-user-name ${idx === uniqueFlow.length - 1 ? 'active-assignee' : ''}`} style={{ color: idx === uniqueFlow.length - 1 ? 'var(--ion-color-primary)' : 'inherit' }}>
                                {formatEmpName(name)}
                              </span>
                            </React.Fragment>
                          ));
                        })()}
                      </div>
                      <div className={`tdm-status-indicator ${activeTask.Status?.toLowerCase() || 'pending'}`}>
                        {activeTask.Status || 'Pending'}
                      </div>
                    </div>
                    <div className="tdm-main-info-card">
                      <div className="tdm-info-desc">
                        {activeTask.TDesc}
                      </div>
                      <div className="tdm-info-footer">
                        <div className="tdm-info-dates">
                          <span>📅 Assigned: {activeTask.ADt}</span>
                          <span style={{ margin: '0 10px', opacity: 0.5 }}>•</span>
                          <span>🎯 Target: {activeTask.TDt}</span>
                        </div>
                        {activeTask.TargetDays && (
                          <div className="tdm-target-badge">
                            {activeTask.TargetDays} Day(s)
                          </div>
                        )}
                      </div>
                    </div>

                    {activeTaskTags.length > 0 && (
                      <div className="tdm-tagged-users-list" style={{ marginTop: '10px', fontSize: '12px', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <strong>Tagged (CC Reference):</strong> {activeTaskTags.map(code => {
                          const emp = employees.find(e => String(e[0]) === code);
                          return emp ? formatEmpName(emp[1]) : code;
                        }).join(', ')}
                      </div>
                    )}

                    {/* Status Update & Transfer Forms */}
                    {activeTask.Status !== 'Closed' && selectedTab === 'view' && !activeTask.IsTagged && (activeTask.SenEName?.startsWith(currentEmpCode) || trueCurrentAssignee?.startsWith(currentEmpCode)) && (
                      <div className="tdm-action-forms">
                        <div className="tdm-form-card">
                          <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: '800', textTransform: 'uppercase' }}>Update / Transfer Task</h4>

                          <div className="tdm-inputs-row">
                            <IonItem lines="full" style={{ '--padding-start': '0', width: '100%' }}>
                              <IonLabel position="stacked">What's the progress?</IonLabel>
                              <textarea
                                className="tdm-textarea-input"
                                value={updateStatusInfo}
                                onChange={e => setUpdateStatusInfo(e.target.value)}
                                placeholder="Enter task updates or transfer remarks..."
                                style={{
                                  width: '100%',
                                  minHeight: '60px',
                                  border: 'none',
                                  outline: 'none',
                                  background: 'transparent',
                                  resize: 'vertical',
                                  padding: '8px 0',
                                  fontSize: '14px',
                                  fontFamily: 'inherit',
                                  color: 'var(--ion-text-color, #000)'
                                }}
                              />
                            </IonItem>

                            <div>
                              <span style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--ion-color-medium)', display: 'block', marginBottom: '8px' }}>Transfer To :</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div
                                  ref={transferTriggerRef}
                                  className={`dbase-inline-select searchable-trigger ${isTransferDropdownOpen ? 'active' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEmployeeDropdownOpen(false);
                                    setIsTransferDropdownOpen(!isTransferDropdownOpen);
                                  }}
                                  style={{
                                    flex: 1,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    border: '1.5px solid #e2e8f0',
                                    borderRadius: '10px',
                                    height: '40px',
                                    padding: '0 12px',
                                    background: 'var(--ion-item-background, #fff)'
                                  }}
                                >
                                  <span className="dbase-select-text" style={{ fontSize: '14px', color: transferTargetEmp ? 'var(--ion-text-color, #000)' : 'var(--ion-color-medium, #888)' }}>
                                    {transferTargetEmp || "Select Employee"}
                                  </span>
                                  {transferTargetEmp && (
                                    <IonIcon
                                      icon={close}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTransferTargetEmp("");
                                      }}
                                      style={{ fontSize: '18px', color: 'var(--ion-color-medium)', cursor: 'pointer' }}
                                    />
                                  )}
                                </div>
                              </div>

                              {isTransferDropdownOpen && createPortal(
                                <>
                                  <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsTransferDropdownOpen(false); }} />
                                  <div
                                    className="custom-inline-dropdown"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    style={{
                                      position: 'absolute',
                                      top: `${dropdownPos.top}px`,
                                      left: `${dropdownPos.left}px`,
                                      width: `${dropdownPos.width}px`
                                    }}
                                  >
                                    <div className="dropdown-search-sec">
                                      <IonIcon icon={search} className="dropdown-search-icon" />
                                      <input
                                        type="text"
                                        className="dropdown-pure-input"
                                        placeholder="Search name or code..."
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
                                        const isSelected = transferTargetEmp === `${empId}-${empName}`;
                                        const initials = (empName.charAt(0) || "?").toUpperCase();

                                        return (
                                          <div
                                            key={index}
                                            className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setTransferTargetEmp(`${empId}-${empName}`);
                                              setIsTransferDropdownOpen(false);
                                              setEmpSearchTerm("");
                                            }}
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
                            </div>
                          </div>

                          <div className="tdm-button-grid">
                            <IonButton expand="block" shape="round" onClick={handleProgress} style={{ '--background': '#f39c12', fontWeight: '700', fontSize: '13px', margin: 0 }}>
                              No Change
                            </IonButton>

                            <IonButton expand="block" shape="round" onClick={handleUpdateStatus} style={{ '--background': 'var(--premium-gradient)', fontWeight: '700', fontSize: '13px', margin: 0 }}>
                              Update
                            </IonButton>

                            <IonButton expand="block" color="success" shape="round" onClick={handleCompleteTask} style={{ '--background': '#0bcd3cff', fontWeight: '700', fontSize: '13px', margin: 0 }}>
                              Complete
                            </IonButton>

                            <IonButton expand="block" fill="outline" shape="round" onClick={handleTransferTask} style={{ fontWeight: '700', fontSize: '13px', margin: 0 }}>
                              Transfer
                            </IonButton>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTask.Status === 'Closed' && !activeTask.IsTagged && (
                      <div className="tdm-action-forms">
                        <div className="tdm-form-card" style={{ textAlign: 'center' }}>
                          <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: '800', textTransform: 'uppercase' }}>Task Completed</h4>
                          <p style={{ fontSize: '14px', marginBottom: '20px', opacity: '0.8' }}>This task is currently closed. If more work is required, you can reopen it.</p>
                          <IonButton
                            expand="block"
                            shape="round"
                            onClick={() => handleReopenTask(activeTask)}
                            style={{ '--background': 'var(--ion-color-success)', fontWeight: '700' }}
                          >
                            <IonIcon icon={refresh} slot="start" />
                            Reopen Task
                          </IonButton>
                        </div>
                      </div>
                    )}

                    {activeTask.IsTagged && (
                      <div className="tdm-action-forms" style={{ marginTop: '10px' }}>
                        <div className="tdm-form-card" style={{ textAlign: 'center', border: '1px dashed var(--ion-color-secondary)', background: 'rgba(var(--ion-color-secondary-rgb), 0.04)' }}>
                          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--ion-color-secondary)' }}>Reference Task (CC)</h4>
                          <p style={{ fontSize: '13px', margin: '0', opacity: '0.8' }}>You are tagged on this task for reference. Actions are disabled.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="tdm-activity-timeline" style={{ marginTop: '20px' }}>
                  <div className="tdm-timeline-heading">Update History</div>
                  <div className="tdm-timeline-scroll">
                    {(() => {
                      if (selectedTaskHistory.length === 0) {
                        return (
                          <div className="tdm-empty-state-wrap" style={{ textAlign: 'center', padding: '40px 0', opacity: '0.6' }}>
                            <div style={{ fontSize: '32px', marginBottom: '10px' }}><IonIcon icon={documentText} /></div>
                            <p style={{ margin: '0' }}>No activity recorded yet.</p>
                          </div>
                        );
                      }

                      // Pre-calculate updater names for each history item
                      const resolvedHistory = [];
                      let currentAssignee = activeTask?.RecEName || "";

                      // Loop backwards to track assignee changes
                      for (let i = selectedTaskHistory.length - 1; i >= 0; i--) {
                        const item = selectedTaskHistory[i];
                        const statusLower = item.status?.toLowerCase();
                        const isTransfer = !!item.toName;

                        let resolvedName = item.fromName;
                        if (!resolvedName) {
                          if (statusLower === 're-opened') {
                            resolvedName = activeTask?.SenEName || "";
                          } else {
                            resolvedName = currentAssignee;
                          }
                        }

                        resolvedHistory[i] = {
                          ...item,
                          resolvedUpdaterName: resolvedName
                        };

                        if (isTransfer && item.fromName) {
                          currentAssignee = item.fromName;
                        }
                      }

                      return resolvedHistory.map((item: any, index: number) => {
                        const statusLower = item.status?.toLowerCase();
                        const isTransfer = !!item.toName;

                        if (isTransfer) {
                          return (
                            <div className="tdm-transfer-bubble" key={index}>
                              <div className="tdm-transfer-header">
                                <span className="tdm-transfer-title">
                                  <IonIcon icon={repeat} style={{ marginRight: '6px', verticalAlign: 'middle', color: '#7c3aed' }} />
                                  Task Transferred
                                </span>
                                <span className="tdm-bubble-timestamp">{item.date}</span>
                              </div>
                              <div className="tdm-transfer-flow">
                                <span className="tdm-transfer-node">{formatEmpName(item.fromName)}</span>
                                <IonIcon icon={chevronForward} className="tdm-transfer-arrow" />
                                <span className="tdm-transfer-node active">{formatEmpName(item.toName)}</span>
                              </div>
                              {item.message && (
                                <div className="tdm-transfer-remarks">
                                  <strong>Remarks:</strong> {item.message}
                                </div>
                              )}
                            </div>
                          );
                        }

                        const isClosed = statusLower === 'closed';
                        const isReopened = statusLower === 're-opened';

                        return (
                          <div className={`tdm-chat-bubble ${statusLower || 'pending'}`} key={index}>
                            <div className="tdm-bubble-metadata">
                              {item.resolvedUpdaterName && (
                                <span className="tdm-bubble-timestamp">
                                  - {formatEmpName(item.resolvedUpdaterName)} ( {item.date} )
                                </span>
                              )}
                              {(isClosed || isReopened) && (
                                <div className={`tdm-status-display ${statusLower}`}>
                                  Status : <span>{item.status}</span>
                                </div>
                              )}
                            </div>
                            <div className="tdm-bubble-message-text">
                              {item.message}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tagging Modal */}
        <IonModal
          isOpen={tagModalOpen}
          onDidDismiss={() => setTagModalOpen(false)}
          className="tasks-tag-modal"
        >
          <div className="pwt-modal-content" style={{ padding: '16px' }}>
            <h3 className="pwt-modal-title" style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '800' }}>Tag Employees (CC)</h3>
            <div className="dropdown-search-sec" style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '10px', padding: '8px 12px', marginBottom: '16px' }}>
              <IonIcon icon={search} className="dropdown-search-icon" style={{ fontSize: '18px', marginRight: '8px', color: '#64748b' }} />
              <input
                type="text"
                className="dropdown-pure-input"
                placeholder="Search name or code..."
                value={empSearchTerm}
                onChange={(e) => setEmpSearchTerm(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '14px' }}
              />
              {empSearchTerm && (
                <button className="dropdown-clear-btn" onClick={() => setEmpSearchTerm("")} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                  <IonIcon icon={close} style={{ fontSize: '16px', color: '#64748b' }} />
                </button>
              )}
            </div>

            <div className="tag-employee-list" style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '20px' }}>
              {filteredEmployees.map((emp, index) => {
                const empId = String(emp[0]);
                let empName = String(emp[1]);
                if (empName.startsWith(empId + "-")) {
                  empName = empName.replace(empId + "-", "").trim();
                }
                const isSelected = selectedTagEmployees.includes(empId);

                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 8px',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      background: isSelected ? 'rgba(var(--ion-color-secondary-rgb), 0.05)' : 'transparent'
                    }}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedTagEmployees(selectedTagEmployees.filter(code => code !== empId));
                      } else {
                        setSelectedTagEmployees([...selectedTagEmployees, empId]);
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      style={{ marginRight: '12px', width: '18px', height: '18px', accentColor: 'var(--ion-color-secondary)' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--ion-text-color)' }}>{empName}</span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>ID: {empId}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pwt-modal-footer" style={{ display: 'flex', gap: '10px' }}>
              <IonButton
                expand="block"
                color="medium"
                style={{ flex: 1, margin: 0, '--border-radius': '10px' }}
                onClick={() => setTagModalOpen(false)}
              >
                Cancel
              </IonButton>
              <IonButton
                expand="block"
                color="secondary"
                style={{ flex: 1, margin: 0, '--border-radius': '10px', fontWeight: '700' }}
                onClick={handleSaveTags}
              >
                Save
              </IonButton>
            </div>
          </div>
        </IonModal>

        {/* Mobile FAB */}
        {/* <IonFab vertical="bottom" horizontal="end" slot="fixed" className="ion-hide-md-up">
          <IonFabButton onClick={() => { setSelectedTab('assign'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ '--background': 'var(--premium-gradient)' }}>
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab> */}
      </IonContent>
    </IonPage>
  );
};

export default Tasks;
