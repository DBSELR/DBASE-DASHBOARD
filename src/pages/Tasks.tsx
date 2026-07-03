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
  repeat
} from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { apiService } from "../utils/apiService";
import { API_BASE } from "../config";
import "./Tasks.css";

const Tasks: React.FC = () => {
  const history = useHistory();
  const [selectedTab, setSelectedTab] = useState<string>("view");
  const [filterValue, setFilterValue] = useState<string>("pending");
  const [assignTo, setAssignTo] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
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

  const sendTaskWhatsApp = async (mobile: string, templateType: string, ctx: any, extra?: any) => {
    if (!mobile) return;
    const cleanedMobile = mobile.replace(/\D/g, "");
    if (cleanedMobile.length < 10) {
      console.warn(`[WhatsApp] Skipped sending: invalid mobile length (${mobile})`);
      return;
    }
    let msg = "";

    switch (templateType) {
      case "task_new_assigned":
        msg = `📌 NEW TASK ASSIGNED\n\n` +
              `Task ID: #${ctx.taskId}\n\n` +
              `👤 Created By: ${ctx.creator}\n\n` +
              `👨💼 Assigned To: ${ctx.assignee}\n\n` +
              `⚡ Priority: ${ctx.priority}\n\n` +
              `📝 Task Description: ${ctx.description}\n\n` +
              `📅 Assigned Date: ${ctx.assignedDate}\n\n` +
              `🎯 Target Date: ${ctx.targetDate}\n\n` +
              `⏳ Target Days: ${ctx.targetDays}\n\n` +
              `🕒 Action Time: ${ctx.actionTime}\n\n` +
              `Please review and start the task.`;
        break;

      case "task_status_updated":
        msg = `📋 TASK STATUS UPDATED\n\n` +
              `Task ID: #${ctx.taskId}\n\n` +
              `👤 Created By: ${ctx.creator}\n\n` +
              `👨💻 Assigned Employee: ${ctx.assignee}\n\n` +
              `⚡ Priority: ${ctx.priority}\n\n` +
              `📝 Task Description: ${ctx.description}\n\n` +
              `📊 New Status: ${extra.status || "In Progress"}\n\n` +
              `✍ Updated By: ${extra.updatedBy}\n\n` +
              `💬 Remarks: ${extra.remarks || "No remarks provided"}\n\n` +
              `🎯 Target Date: ${ctx.targetDate}\n\n` +
              `Please review the latest task update in the Office Dashboard.`;
        break;

      case "task_completed":
        msg = `✅ TASK COMPLETED\n\n` +
              `Task ID: #${ctx.taskId}\n\n` +
              `👤 Created By: ${ctx.creator}\n\n` +
              `👨💻 Completed By: ${extra.completedBy}\n\n` +
              `⚡ Priority: ${ctx.priority}\n\n` +
              `📝 Task Description: ${ctx.description}\n\n` +
              `💬 Completion Remarks: ${extra.remarks || "Task marked as completed"}\n\n` +
              `🎯 Target Date: ${ctx.targetDate}\n\n` +
              `📊 Final Status: Closed\n\n` +
              `Thank you for completing the assigned task.`;
        break;

      case "task_transferred_creator":
        msg = `🔄 TASK TRANSFERRED\n\n` +
              `Task ID: #${ctx.taskId}\n\n` +
              `👤 Created By: ${ctx.creator}\n\n` +
              `👨💼 Previous Assignee: ${ctx.assignee}\n\n` +
              `👨💻 New Assignee: ${extra.newAssignee}\n\n` +
              `⚡ Priority: ${ctx.priority}\n\n` +
              `📝 Task Description: ${ctx.description}\n\n` +
              `✍ Transferred By: ${extra.transferredBy}\n\n` +
              `💬 Transfer Remarks: ${extra.remarks || "N/A"}\n\n` +
              `🎯 Target Date: ${ctx.targetDate}\n\n` +
              `The task ownership has been updated successfully.`;
        break;

      case "task_transferred_assignee":
        msg = `📥 TASK ASSIGNED VIA TRANSFER\n\n` +
              `Task ID: #${ctx.taskId}\n\n` +
              `👤 Original Creator: ${ctx.creator}\n\n` +
              `👨💼 Previous Assignee: ${ctx.assignee}\n\n` +
              `👨💻 Assigned To You: ${extra.newAssignee}\n\n` +
              `⚡ Priority: ${ctx.priority}\n\n` +
              `📝 Task Description: ${ctx.description}\n\n` +
              `✍ Transferred By: ${extra.transferredBy}\n\n` +
              `💬 Transfer Remarks: ${extra.remarks || "N/A"}\n\n` +
              `🎯 Target Date: ${ctx.targetDate}\n\n` +
              `Please review and continue the task.`;
        break;

      case "task_reopened":
        msg = `♻️ TASK REOPENED\n\n` +
              `Task ID: #${ctx.taskId}\n\n` +
              `👤 Created By: ${ctx.creator}\n\n` +
              `👨💻 Current Assignee: ${ctx.assignee}\n\n` +
              `⚡ Priority: ${ctx.priority}\n\n` +
              `📝 Task Description: ${ctx.description}\n\n` +
              `✍ Reopened By: ${extra.reopenedBy}\n\n` +
              `🎯 Target Date: ${ctx.targetDate}\n\n` +
              `📊 Status: Reopened\n\n` +
              `The task has been moved back to pending for further action.`;
        break;
    }

    if (msg) {
      console.log(`[WhatsApp] Sending ${templateType} to ${mobile}`);
      try {
        await apiService.sendMessage(mobile, msg);
      } catch (err) {
        console.error("[WhatsApp] sendMessage failed:", err);
      }
    }
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
        SenEName: t.SenEName || t[1],
        RecEName: t.RecEName || t[2],
        ADt: t.ADt || t[3],
        TDt: t.TDt || t[4],
        TDesc: t.TDesc || t[5],
        Status: t.Status || t[6],
        TPriority: t.TPriority || t[10],
      }));
      setSentTasks(mappedSent);

      // 4. Load Received Tasks (API 4)
      const received = await apiService.loadReceivedTasks(empCode);
      const mappedReceived = (received || []).map((t: any) => ({
        TID: t.TID ?? t[0],
        SenEName: t.SenEName ?? t[1],
        RecEName: t.RecEName ?? t[2],
        ADt: t.ADt ?? t[3],
        TDt: t.TDt ?? t[4],
        TDesc: t.TDesc ?? t[5],
        Status: t.Status ?? t[6],
        TPriority: t.TPriority ?? t[10] ?? "Low",
        TargetDays: t.TargetDays ?? 0
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
    } catch (error) {
      console.error("Error fetching task view:", error);
      // Even if fetch fails (e.g., 400 Bad Request), we still want to show the modal with empty history
      setSelectedTaskHistory([]);
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
          fetch(`${API_BASE}Notifications/SendPush`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")?.replace(/"/g, "")}`
            },
            body: JSON.stringify({
              EmpCode: assignedEmpCode,
              Title: "New Task Assigned",
              Body: `A new task has been assigned to you by ${currentEmpName}.`,
              Url: "/tasks"
            })
          })
            .then(async res => {
              const data = await res.json().catch(() => ({}));
              console.log("Push API Result:", data);
              if (!res.ok) {
                alert(`Backend Push Error: ${data.error || data.message || res.statusText}`);
              }
            })
            .catch(e => console.error("Push Error:", e));
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
    const history = await apiService.loadViewTask(tid);
    const mappedHistory = (history || []).map((item: any) => ({
      fromName: item[0],
      toName: item[1],
      status: item[5],
      date: item[9],
      message: item[10],
    }));
    setSelectedTaskHistory(mappedHistory);
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
      };
      await apiService.saveTaskStatus(statusData);

      // --- SEND PUSH NOTIFICATION ---
      try {
        const ctx = buildTaskContext(activeTask);
        const pushTargetEmpCode = (currentEmpCode === ctx.assigneeEmpCode)
          ? ctx.creatorEmpCode
          : ctx.assigneeEmpCode;
        if (pushTargetEmpCode) {
          fetch(`${API_BASE}Notifications/SendPush`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")?.replace(/"/g, "")}`
            },
            body: JSON.stringify({
              EmpCode: pushTargetEmpCode,
              Title: "Task Status Updated",
              Body: `Task #${activeTask.TID}: ${updateStatusInfo} — by ${currentEmpName}.`,
              Url: "/tasks"
            })
          }).catch(e => console.error("Push Error:", e));
        }
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
      };
      await apiService.saveTaskStatus(statusData);

      // --- SEND PUSH NOTIFICATION ---
      try {
        const ctx = buildTaskContext(activeTask);
        const pushTargetEmpCode = (currentEmpCode === ctx.assigneeEmpCode)
          ? ctx.creatorEmpCode
          : ctx.assigneeEmpCode;
        if (pushTargetEmpCode) {
          fetch(`${API_BASE}Notifications/SendPush`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")?.replace(/"/g, "")}`
            },
            body: JSON.stringify({
              EmpCode: pushTargetEmpCode,
              Title: "Task Completed",
              Body: `Task #${activeTask.TID}: ${updateStatusInfo || "Task completed"} — by ${currentEmpName}.`,
              Url: "/tasks"
            })
          }).catch(e => console.error("Push Error:", e));
        }
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
        const transferredEmpCode = transferTargetEmp.split("-")[0].trim();
        if (transferredEmpCode) {
          fetch(`${API_BASE}Notifications/SendPush`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")?.replace(/"/g, "")}`
            },
            body: JSON.stringify({
              EmpCode: transferredEmpCode,
              Title: "Task Transferred",
              Body: `Task #${activeTask.TID} has been transferred to you by ${currentEmpName}.`,
              Url: "/tasks"
            })
          })
            .then(async res => {
              const data = await res.json().catch(() => ({}));
              console.log("Push API Result:", data);
              if (!res.ok) {
                alert(`Backend Push Error: ${data.error || data.message || res.statusText}`);
              }
            })
            .catch(e => console.error("Push Error:", e));
        }
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
      message: 'Are you sure you want to reopen this task? This will set its status back to Pending.',
      cssClass: 'premium-alert',
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
          handler: () => performReopen(task)
        }
      ]
    });
  };

  const performReopen = async (task: any) => {
    setIsLoading(true);
    try {
      const reopenData = {
        _Tskid: String(task.TID),
        _StatusDate: formatDateTime(new Date()),
      };
      await apiService.reopenTask(reopenData);

      // --- SEND PUSH NOTIFICATION ---
      try {
        const ctx = buildTaskContext(task);
        if (ctx.assigneeEmpCode) {
          fetch(`${API_BASE}Notifications/SendPush`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")?.replace(/"/g, "")}`
            },
            body: JSON.stringify({
              EmpCode: ctx.assigneeEmpCode,
              Title: "Task Reopened",
              Body: `Task #${task.TID} has been reopened by ${currentEmpName}. Please review.`,
              Url: "/tasks"
            })
          }).catch(e => console.error("Push Error:", e));
        }
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

        <div className="native-segment-header">
          <button className="native-back-btn" onClick={handleBack}>
            <IonIcon icon={arrowBack} />
          </button>
          <div className="native-segment-container">
            <div
              className={`native-segment-item ${selectedTab === "view" ? "active" : ""}`}
              onClick={() => setSelectedTab("view")}
            >
              View Task
            </div>
            <div
              className={`native-segment-item ${selectedTab === "assign" ? "active" : ""}`}
              onClick={() => setSelectedTab("assign")}
            >
              Assign Task
            </div>
            <div className={`native-segment-slider ${selectedTab === "view" ? "left" : "right"}`} />
          </div>
          <button className="native-refresh-btn" onClick={() => fetchInitialData(currentEmpCode)} title="Refresh Data">
            <IonIcon icon={repeat} />
          </button>
        </div>

        {/* View Tasks Tab */}
        {selectedTab === "view" && (
          <div className="view-task-section ion-padding">
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
              {getFilteredTasks(receivedTasks).map((task: any, index: number) => (
                <div
                  className="tasks-premium-card"
                  key={index}
                  onClick={() => handleViewTask(task)}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className={`priority-marker ${(task.TPriority || "Low").toLowerCase()}`}></div>
                  <div className="task-card-header">
                    <div className="tid-badge">ID: {task.TID}</div>
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
                      <div className={`tdm-status-pill small ${task.Status?.toLowerCase() || 'pending'}`}>
                        {task.Status || 'Pending'}
                      </div>
                    )}
                  </div>

                  <div className="card-body">
                    <div className="recipient">
                      <IonIcon icon={person} style={{ fontSize: '14px', marginRight: '4px' }} />
                      From: {formatEmpName(task.SenEName)}
                    </div>
                    <div className="desc">{task.TDesc}</div>
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
                          fontFamily: 'inherit'
                        }}
                        placeholder="What needs to be done?"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="ntv-form-group">
                    <label className="ntv-form-label">Deadline</label>
                    <div className="ntv-form-input-wrapper clickable" onClick={() => setStartDateModalOpen(true)}>
                      <IonIcon icon={calendar} className="ntv-form-input-icon" />
                      <span className="ntv-form-text-display">
                        {targetDate
                          ? new Date(targetDate).toLocaleDateString("en-GB")
                          : "Set Deadline"}
                      </span>
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
                    <div className="tid-badge">ID: {task.TID}</div>
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
                        fill="clear"
                        color="danger"
                        size="small"
                        onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.TID); }}
                        style={{ margin: 0 }}
                      >
                        <IonIcon icon={trash} slot="icon-only" style={{ fontSize: '18px' }} />
                      </IonButton>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="recipient">To: {formatEmpName(task.RecEName)}</div>
                    <div className="desc">{task.TDesc}</div>
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
                      <div className="tdm-participants-wrap" style={{ fontSize: '16px', fontWeight: '700' }}>
                        <span className="tdm-user-name">{activeTask.SenEName}</span>
                        <IonIcon icon={chevronForward} className="tdm-arrow-divider" style={{ margin: '0 8px' }} />
                        <span className="tdm-user-name">{activeTask.RecEName}</span>
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

                    {/* Status Update & Transfer Forms */}
                    {activeTask.Status !== 'Closed' && selectedTab === 'view' && (
                      <div className="tdm-action-forms">
                        <div className="tdm-form-card">
                          <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: '800', textTransform: 'uppercase' }}>Update / Transfer Task</h4>
                          
                          <div className="tdm-inputs-row">
                            <IonItem lines="full" style={{ '--padding-start': '0', width: '100%' }}>
                              <IonLabel position="stacked">What's the progress?</IonLabel>
                              <IonInput 
                                value={updateStatusInfo} 
                                onIonChange={e => setUpdateStatusInfo(e.detail.value!)} 
                                placeholder="Enter task updates or transfer remarks..." 
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

                    {activeTask.Status === 'Closed' && (
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
                  </div>
                )}

                <div className="tdm-activity-timeline" style={{ marginTop: '20px' }}>
                  <div className="tdm-timeline-heading">Update History</div>
                  <div className="tdm-timeline-scroll">
                    {selectedTaskHistory.length > 0 ? (
                      selectedTaskHistory.map((item: any, index: number) => {
                        const statusLower = item.status?.toLowerCase();
                        const isSpecialStatus = statusLower === 'closed' || statusLower === 're-opened';

                        return (
                          <div className={`tdm-chat-bubble ${statusLower || 'pending'}`} key={index}>
                            <div className="tdm-bubble-metadata">
                              <span className="tdm-bubble-timestamp">
                                {item.date} {item.toName && <span style={{ marginLeft: '10px', color: 'var(--ion-color-secondary)' }}>{activeTask.SenEName} {'>'} {item.toName}</span>}
                              </span>
                              {isSpecialStatus && (
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
                      })
                    ) : (
                      <div className="tdm-empty-state-wrap" style={{ textAlign: 'center', padding: '40px 0', opacity: '0.6' }}>
                        <div style={{ fontSize: '32px', marginBottom: '10px' }}><IonIcon icon={documentText} /></div>
                        <p style={{ margin: '0' }}>No activity recorded yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
