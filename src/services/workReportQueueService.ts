export interface QueuedActivity {
  id: string;
  type: "task" | "ticket";
  title: string;
  description: string;
  remarks?: string;
  referenceId: string; // TID or TICKETID
  clientName?: string;
  projectName?: string;
  timestamp: string;
  timeFormatted: string;
  serviceType?: string;
  payload?: any;
}

const getTodayKey = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStorageKey = (empCode?: string): string => {
  const code = empCode || (() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return u?.empCode || u?.EmpCode || "user";
    } catch {
      return "user";
    }
  })();
  return `work_report_queue_${getTodayKey()}_${code}`;
};

export const workReportQueueService = {
  getQueuedActivities: (empCode?: string): QueuedActivity[] => {
    try {
      const key = getStorageKey(empCode);
      const data = localStorage.getItem(key);
      if (!data) return [];
      return JSON.parse(data);
    } catch (e) {
      console.error("[WorkReportQueue] Error reading queue:", e);
      return [];
    }
  },

  addQueuedActivity: (
    empCode: string | undefined,
    item: Omit<QueuedActivity, "id" | "timestamp" | "timeFormatted">
  ): QueuedActivity => {
    const key = getStorageKey(empCode);
    const existing = workReportQueueService.getQueuedActivities(empCode);

    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeFormatted = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;

    // Prevent duplicate entries for the exact same referenceId & action remarks
    const duplicateIndex = existing.findIndex(
      (e) => e.type === item.type && e.referenceId === item.referenceId && e.remarks === item.remarks
    );

    const newActivity: QueuedActivity = {
      ...item,
      id: `${item.type}_${item.referenceId}_${Date.now()}`,
      timestamp: now.toISOString(),
      timeFormatted: timeFormatted,
    };

    let updated: QueuedActivity[];
    if (duplicateIndex >= 0) {
      updated = [...existing];
      updated[duplicateIndex] = newActivity;
    } else {
      updated = [newActivity, ...existing];
    }

    try {
      localStorage.setItem(key, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("work-report-queue-updated", { detail: { count: updated.length } }));
    } catch (e) {
      console.error("[WorkReportQueue] Error saving activity:", e);
    }

    return newActivity;
  },

  addQueuedActivities: (
    empCode: string | undefined,
    items: Array<Omit<QueuedActivity, "id" | "timestamp" | "timeFormatted">>
  ): QueuedActivity[] => {
    if (!items || items.length === 0) return [];
    const key = getStorageKey(empCode);
    let existing = workReportQueueService.getQueuedActivities(empCode);

    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeFormatted = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;

    const newActivities: QueuedActivity[] = [];

    items.forEach((item, index) => {
      const duplicateIndex = existing.findIndex(
        (e) => e.type === item.type && e.referenceId === item.referenceId && e.remarks === item.remarks
      );

      const newActivity: QueuedActivity = {
        ...item,
        id: `${item.type}_${item.referenceId}_${Date.now()}_${index}`,
        timestamp: now.toISOString(),
        timeFormatted: timeFormatted,
      };

      if (duplicateIndex >= 0) {
        existing[duplicateIndex] = newActivity;
      } else {
        existing = [newActivity, ...existing];
      }
      newActivities.push(newActivity);
    });

    try {
      localStorage.setItem(key, JSON.stringify(existing));
      window.dispatchEvent(new CustomEvent("work-report-queue-updated", { detail: { count: existing.length } }));
    } catch (e) {
      console.error("[WorkReportQueue] Error saving activities batch:", e);
    }

    return newActivities;
  },

  removeQueuedActivity: (empCode: string | undefined, id: string): void => {
    try {
      const key = getStorageKey(empCode);
      const existing = workReportQueueService.getQueuedActivities(empCode);
      const updated = existing.filter((item) => item.id !== id);
      localStorage.setItem(key, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("work-report-queue-updated", { detail: { count: updated.length } }));
    } catch (e) {
      console.error("[WorkReportQueue] Error removing activity:", e);
    }
  },

  clearQueuedActivities: (empCode?: string): void => {
    try {
      const key = getStorageKey(empCode);
      localStorage.removeItem(key);
      window.dispatchEvent(new CustomEvent("work-report-queue-updated", { detail: { count: 0 } }));
    } catch (e) {
      console.error("[WorkReportQueue] Error clearing queue:", e);
    }
  },

  formatQueueForReport: (empCode?: string): string => {
    const list = workReportQueueService.getQueuedActivities(empCode);
    if (!list || list.length === 0) return "";

    const lines: string[] = [];
    list.forEach((item, index) => {
      const tag = item.type === "ticket" ? "[Ticket]" : "[Task]";
      const details = item.remarks ? ` - ${item.remarks}` : "";
      lines.push(`${index + 1}. ${tag} ${item.title}: ${item.description}${details} (${item.timeFormatted})`);
    });

    return lines.join("\n");
  }
};
