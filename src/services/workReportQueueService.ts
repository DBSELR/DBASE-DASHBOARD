import axios from "axios";
import { API_BASE } from "../config";

export interface QueuedActivity {
  id: string; // mapped from DB queueId or client ID
  queueId?: number;
  type: "task" | "ticket";
  title: string;
  description: string;
  remarks?: string;
  referenceId: string; // TID or TICKETID
  clientId?: number | string;
  clientName?: string;
  workLocation?: string; // "In-House" | "On-Site"
  projectName?: string;
  timestamp: string;
  timeFormatted: string;
  serviceType?: string;
  payload?: any;
}

const baseUrl = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token")?.replace(/"/g, "");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json; charset=utf-8"
  };
};

const getEmpCode = (empCode?: string): string => {
  if (empCode && empCode.trim()) return empCode.trim();
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    return (u?.empCode || u?.EmpCode || "").trim();
  } catch {
    return "";
  }
};

// In-memory active cache to allow synchronous access
let memoryQueueCache: QueuedActivity[] = [];
let hasFetchedFromDb = false;

const mapDbItemToQueuedActivity = (row: any): QueuedActivity => {
  let parsedPayload: any = null;
  if (row.payloadJson || row.PayloadJson) {
    try {
      parsedPayload = JSON.parse(row.payloadJson || row.PayloadJson);
    } catch {
      parsedPayload = null;
    }
  }

  const qId = row.queueId ?? row.QueueId ?? 0;
  return {
    id: String(qId > 0 ? qId : `${row.activityType || row.ActivityType}_${row.referenceId || row.ReferenceId}`),
    queueId: qId > 0 ? qId : undefined,
    type: (row.activityType || row.ActivityType || "task").toLowerCase() as "task" | "ticket",
    title: row.title || row.Title || "",
    description: row.description || row.Description || "",
    remarks: row.remarks || row.Remarks || "",
    referenceId: String(row.referenceId || row.ReferenceId || ""),
    clientId: row.clientId ?? row.ClientId ?? 1,
    clientName: row.clientName || row.ClientName || "",
    workLocation: row.workLocation || row.WorkLocation || "In-House",
    projectName: row.projectName || row.ProjectName || "",
    serviceType: row.serviceType || row.ServiceType || "",
    timestamp: row.createdAt || row.CreatedAt || new Date().toISOString(),
    timeFormatted: row.timeFormatted || row.TimeFormatted || "",
    payload: parsedPayload
  };
};

export const workReportQueueService = {
  fetchQueuedActivities: async (empCode?: string): Promise<QueuedActivity[]> => {
    const code = getEmpCode(empCode);
    if (!code) return [];

    try {
      const res = await axios.get(`${baseUrl}/Workreport/GetQueuedActivities`, {
        params: { empCode: code },
        headers: getAuthHeaders(),
        timeout: 10000
      });

      const list = Array.isArray(res.data) ? res.data : [];
      memoryQueueCache = list.map(mapDbItemToQueuedActivity);
      hasFetchedFromDb = true;

      window.dispatchEvent(
        new CustomEvent("work-report-queue-updated", { detail: { count: memoryQueueCache.length } })
      );
      return memoryQueueCache;
    } catch (e) {
      console.warn("[WorkReportQueue] Error fetching from DB:", e);
      return memoryQueueCache;
    }
  },

  getQueuedActivities: (empCode?: string): QueuedActivity[] => {
    const code = getEmpCode(empCode);
    if (!hasFetchedFromDb && code) {
      workReportQueueService.fetchQueuedActivities(code);
    }
    return memoryQueueCache;
  },

  addQueuedActivity: async (
    empCode: string | undefined,
    item: Omit<QueuedActivity, "id" | "timestamp" | "timeFormatted">
  ): Promise<QueuedActivity> => {
    const code = getEmpCode(empCode);

    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeFormatted = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;

    const dbPayload = {
      empCode: code,
      activityType: item.type,
      referenceId: String(item.referenceId),
      title: item.title,
      description: item.description,
      remarks: item.remarks || "",
      clientId: item.clientId ? Number(item.clientId) : 1,
      clientName: item.clientName || "",
      workLocation: item.workLocation || "In-House",
      projectName: item.projectName || "",
      serviceType: item.serviceType || "",
      payloadJson: item.payload ? JSON.stringify(item.payload) : null,
      timeFormatted: timeFormatted
    };

    try {
      const res = await axios.post(`${baseUrl}/Workreport/AddToQueue`, dbPayload, {
        headers: getAuthHeaders(),
        timeout: 10000
      });

      const queueId = res.data?.queueId;
      const createdItem: QueuedActivity = {
        ...item,
        id: String(queueId || `${item.type}_${item.referenceId}_${Date.now()}`),
        queueId: queueId,
        timestamp: now.toISOString(),
        timeFormatted: timeFormatted
      };

      const dupIdx = memoryQueueCache.findIndex(
        e => e.type === item.type && String(e.referenceId) === String(item.referenceId)
      );
      if (dupIdx >= 0) {
        memoryQueueCache[dupIdx] = createdItem;
      } else {
        memoryQueueCache.push(createdItem);
      }

      window.dispatchEvent(
        new CustomEvent("work-report-queue-updated", { detail: { count: memoryQueueCache.length } })
      );
      return createdItem;
    } catch (e) {
      console.error("[WorkReportQueue] Error adding to DB queue:", e);
      const fallbackItem: QueuedActivity = {
        ...item,
        id: `${item.type}_${item.referenceId}_${Date.now()}`,
        timestamp: now.toISOString(),
        timeFormatted: timeFormatted
      };
      memoryQueueCache.push(fallbackItem);
      window.dispatchEvent(
        new CustomEvent("work-report-queue-updated", { detail: { count: memoryQueueCache.length } })
      );
      return fallbackItem;
    }
  },

  addQueuedActivities: async (
    empCode: string | undefined,
    items: Array<Omit<QueuedActivity, "id" | "timestamp" | "timeFormatted">>
  ): Promise<QueuedActivity[]> => {
    if (!items || items.length === 0) return [];
    const code = getEmpCode(empCode);

    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeFormatted = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;

    const dtoList = items.map(item => ({
      empCode: code,
      activityType: item.type,
      referenceId: String(item.referenceId),
      title: item.title,
      description: item.description,
      remarks: item.remarks || "",
      clientId: item.clientId ? Number(item.clientId) : 1,
      clientName: item.clientName || "",
      workLocation: item.workLocation || "In-House",
      projectName: item.projectName || "",
      serviceType: item.serviceType || "",
      payloadJson: item.payload ? JSON.stringify(item.payload) : null,
      timeFormatted: timeFormatted
    }));

    try {
      await axios.post(`${baseUrl}/Workreport/AddBatchToQueue`, dtoList, {
        headers: getAuthHeaders(),
        timeout: 10000
      });
      return await workReportQueueService.fetchQueuedActivities(code);
    } catch (e) {
      console.error("[WorkReportQueue] Error adding batch to DB queue:", e);
      return memoryQueueCache;
    }
  },

  updateQueuedActivity: async (
    empCode: string | undefined,
    id: string | number,
    updates: Partial<QueuedActivity>
  ): Promise<void> => {
    const code = getEmpCode(empCode);
    const item = memoryQueueCache.find(e => String(e.id) === String(id) || String(e.queueId) === String(id));

    memoryQueueCache = memoryQueueCache.map(e => {
      if (String(e.id) === String(id) || String(e.queueId) === String(id)) {
        return { ...e, ...updates };
      }
      return e;
    });

    window.dispatchEvent(
      new CustomEvent("work-report-queue-updated", { detail: { count: memoryQueueCache.length } })
    );

    const targetQueueId = item?.queueId || (typeof id === "number" ? id : Number(id));
    if (targetQueueId && !isNaN(targetQueueId)) {
      try {
        await axios.post(
          `${baseUrl}/Workreport/UpdateQueuedActivity`,
          {
            queueId: targetQueueId,
            clientId: updates.clientId ? Number(updates.clientId) : undefined,
            clientName: updates.clientName,
            workLocation: updates.workLocation
          },
          { headers: getAuthHeaders(), timeout: 8000 }
        );
      } catch (e) {
        console.warn("[WorkReportQueue] Error updating item in DB:", e);
      }
    }
  },

  removeQueuedActivity: async (empCode: string | undefined, id: string | number): Promise<void> => {
    const code = getEmpCode(empCode);
    const item = memoryQueueCache.find(e => String(e.id) === String(id) || String(e.queueId) === String(id));

    memoryQueueCache = memoryQueueCache.filter(
      e => String(e.id) !== String(id) && String(e.queueId) !== String(id)
    );

    window.dispatchEvent(
      new CustomEvent("work-report-queue-updated", { detail: { count: memoryQueueCache.length } })
    );

    try {
      const qId = item?.queueId || (typeof id === "number" ? id : Number(id));
      const params: any = {};
      if (qId && !isNaN(qId) && qId > 0) {
        params.queueId = qId;
      } else if (item) {
        params.referenceId = item.referenceId;
        params.activityType = item.type;
        params.empCode = code;
      }

      await axios.delete(`${baseUrl}/Workreport/RemoveQueuedActivity`, {
        params,
        headers: getAuthHeaders(),
        timeout: 8000
      });
    } catch (e) {
      console.warn("[WorkReportQueue] Error removing item from DB:", e);
    }
  },

  clearQueuedActivities: async (empCode?: string): Promise<void> => {
    const code = getEmpCode(empCode);
    memoryQueueCache = [];

    window.dispatchEvent(
      new CustomEvent("work-report-queue-updated", { detail: { count: 0 } })
    );

    if (code) {
      try {
        await axios.delete(`${baseUrl}/Workreport/ClearQueuedActivities`, {
          params: { empCode: code },
          headers: getAuthHeaders(),
          timeout: 8000
        });
      } catch (e) {
        console.warn("[WorkReportQueue] Error clearing queue from DB:", e);
      }
    }
  },

  formatQueueForReport: (empCode?: string): string => {
    if (!memoryQueueCache || memoryQueueCache.length === 0) return "";

    const lines: string[] = [];
    memoryQueueCache.forEach((item, index) => {
      const tag = item.type === "ticket" ? "[Ticket]" : "[Task]";
      const details = item.remarks ? ` - ${item.remarks}` : "";
      lines.push(`${index + 1}. ${tag} ${item.title}: ${item.description}${details} (${item.timeFormatted})`);
    });

    return lines.join("\n");
  }
};
