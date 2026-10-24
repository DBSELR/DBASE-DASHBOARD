import React, { useState, useEffect } from "react";
import { IonModal, IonIcon } from "@ionic/react";
import {
  alertCircle,
  checkmarkCircle,
  close,
  timeOutline,
  flagOutline,
  paperPlaneOutline,
  refreshOutline,
  personOutline,
  checkmarkDoneOutline,
  sparklesOutline
} from "ionicons/icons";
import { apiService } from "../utils/apiService";
import { workReportQueueService, QueuedActivity } from "../services/workReportQueueService";
import "./PendingTasksAlertModal.css";

export interface PendingTaskItem {
  TID: string | number;
  TDesc: string;
  TPriority?: string;
  TDt?: string;
  SenEName?: string;
}

interface Props {
  isOpen: boolean;
  tasks: PendingTaskItem[];
  currentEmpCode: string;
  currentEmpName: string;
  onDismiss: () => void;
  onAllUpdated: () => void;
  onTasksChanged: (remainingTasks: PendingTaskItem[]) => void;
}

export const PendingTasksAlertModal: React.FC<Props> = ({
  isOpen,
  tasks,
  currentEmpCode,
  currentEmpName,
  onDismiss,
  onAllUpdated,
  onTasksChanged,
}) => {
  const [remarkMap, setRemarkMap] = useState<{ [tid: string]: string }>({});
  const [loadingMap, setLoadingMap] = useState<{ [tid: string]: boolean }>({});
  const [updatedTids, setUpdatedTids] = useState<string[]>([]);
  const [updatedDetails, setUpdatedDetails] = useState<{ [tid: string]: { type: string; message: string } }>({});
  const [selectedTids, setSelectedTids] = useState<string[]>([]);
  const [isBulkLoading, setIsBulkLoading] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  // Reset local state when modal re-opens
  useEffect(() => {
    if (!isOpen) {
      setRemarkMap({});
      setLoadingMap({});
      setUpdatedTids([]);
      setUpdatedDetails({});
      setSelectedTids([]);
      setIsBulkLoading(false);
      setBulkProgress(null);
    }
  }, [isOpen]);

  // Safe fallback for empCode and empName
  const getActiveUser = () => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return {
        code: currentEmpCode || u.empCode || u.EmpCode || "",
        name: currentEmpName || u.empName || u.EmpName || ""
      };
    } catch {
      return { code: currentEmpCode || "", name: currentEmpName || "" };
    }
  };

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

  const remainingTasks = tasks.filter(t => !updatedTids.includes(String(t.TID)));
  const remainingCount = remainingTasks.length;
  const selectedCount = remainingTasks.filter(t => selectedTids.includes(String(t.TID))).length;
  const isAllSelected = remainingCount > 0 && selectedCount === remainingCount;
  const isIndeterminate = selectedCount > 0 && selectedCount < remainingCount;
  const isAllDone = tasks.length > 0 && remainingCount === 0;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTids([]);
    } else {
      setSelectedTids(remainingTasks.map(t => String(t.TID)));
    }
  };

  const toggleTaskSelection = (tidStr: string) => {
    setSelectedTids(prev =>
      prev.includes(tidStr) ? prev.filter(id => id !== tidStr) : [...prev, tidStr]
    );
  };

  const handleNoChange = async (task: PendingTaskItem) => {
    const tidStr = String(task.TID);
    const { code: empCode, name: empName } = getActiveUser();
    setLoadingMap(prev => ({ ...prev, [tidStr]: true }));

    try {
      const statusData = {
        _Tskid: tidStr,
        _StatusDate: formatDateTime(new Date()),
        _StatusInfo: "No Change",
        _Status: "",
        _SenEName: `${empCode}-${empName}`
      };
      await apiService.saveTaskStatus(statusData);

      // Queue into daily work report queue
      workReportQueueService.addQueuedActivity(empCode, {
        type: "task",
        title: `Task #${tidStr} (No Change)`,
        description: task.TDesc || `Task #${tidStr}`,
        remarks: "Status: No Change",
        referenceId: tidStr,
        clientId: 1,
        clientName: "In-House",
        workLocation: "In-House",
        payload: {
          _clientId: 1,
          _work_location: "In-House",
          _work_report: `Task #${tidStr}: ${task.TDesc} - Status: No Change`,
          _empcode: empCode
        }
      });

      const nextUpdated = [...updatedTids, tidStr];
      setUpdatedTids(nextUpdated);
      setSelectedTids(prev => prev.filter(id => id !== tidStr));
      setUpdatedDetails(prev => ({
        ...prev,
        [tidStr]: { type: "no_change", message: "Recorded: 'No Change' for today" }
      }));

      const remaining = tasks.filter(t => !nextUpdated.includes(String(t.TID)));
      onTasksChanged(remaining);

      if (remaining.length === 0) {
        setTimeout(() => {
          onAllUpdated();
        }, 700);
      }
    } catch (err) {
      console.error("Failed to record No Change:", err);
      alert("Failed to update status. Please try again.");
    } finally {
      setLoadingMap(prev => ({ ...prev, [tidStr]: false }));
    }
  };

  const handleBulkNoChange = async () => {
    // If specific tasks are selected, target them; otherwise target all remaining unupdated tasks
    const targetTids =
      selectedCount > 0
        ? remainingTasks.filter(t => selectedTids.includes(String(t.TID))).map(t => String(t.TID))
        : remainingTasks.map(t => String(t.TID));

    if (targetTids.length === 0) return;

    const targetTasks = tasks.filter(t => targetTids.includes(String(t.TID)));
    const { code: empCode, name: empName } = getActiveUser();

    setIsBulkLoading(true);
    setBulkProgress({ current: 0, total: targetTasks.length });

    const successfullyUpdatedTids: string[] = [];
    const queueItemsToAdd: Array<Omit<QueuedActivity, "id" | "timestamp" | "timeFormatted">> = [];

    for (let i = 0; i < targetTasks.length; i++) {
      const task = targetTasks[i];
      const tidStr = String(task.TID);
      setBulkProgress({ current: i + 1, total: targetTasks.length });
      setLoadingMap(prev => ({ ...prev, [tidStr]: true }));

      try {
        const statusData = {
          _Tskid: tidStr,
          _StatusDate: formatDateTime(new Date()),
          _StatusInfo: "No Change",
          _Status: "",
          _SenEName: `${empCode}-${empName}`
        };
        await apiService.saveTaskStatus(statusData);

        successfullyUpdatedTids.push(tidStr);
        queueItemsToAdd.push({
          type: "task",
          title: `Task #${tidStr} (No Change)`,
          description: task.TDesc || `Task #${tidStr}`,
          remarks: "Status: No Change",
          referenceId: tidStr,
          clientName: "In-House",
          payload: {
            _clientId: 1,
            _work_location: "In-House",
            _work_report: `Task #${tidStr}: ${task.TDesc} - Status: No Change`,
            _empcode: empCode
          }
        });

        // Live card transition
        setUpdatedTids(prev => [...prev, tidStr]);
        setUpdatedDetails(prev => ({
          ...prev,
          [tidStr]: { type: "no_change", message: "Recorded: 'No Change' for today" }
        }));
      } catch (err) {
        console.error(`Failed to record No Change for task #${tidStr}:`, err);
      } finally {
        setLoadingMap(prev => ({ ...prev, [tidStr]: false }));
      }
    }

    // Atomic batch update for work report queue
    if (queueItemsToAdd.length > 0) {
      workReportQueueService.addQueuedActivities(empCode, queueItemsToAdd);
    }

    const nextUpdated = [...new Set([...updatedTids, ...successfullyUpdatedTids])];
    const remaining = tasks.filter(t => !nextUpdated.includes(String(t.TID)));

    setSelectedTids(prev => prev.filter(tid => !successfullyUpdatedTids.includes(tid)));
    setIsBulkLoading(false);
    setBulkProgress(null);

    onTasksChanged(remaining);

    if (remaining.length === 0) {
      setTimeout(() => {
        onAllUpdated();
      }, 700);
    } else if (successfullyUpdatedTids.length < targetTasks.length) {
      alert(`Updated ${successfullyUpdatedTids.length} of ${targetTasks.length} tasks. Some tasks could not be updated.`);
    }
  };

  const handleSaveRemark = async (task: PendingTaskItem) => {
    const tidStr = String(task.TID);
    const remark = (remarkMap[tidStr] || "").trim();
    if (!remark) {
      alert("Please enter a progress update remark.");
      return;
    }

    const { code: empCode, name: empName } = getActiveUser();
    setLoadingMap(prev => ({ ...prev, [tidStr]: true }));

    try {
      const statusData = {
        _Tskid: tidStr,
        _StatusDate: formatDateTime(new Date()),
        _StatusInfo: remark,
        _Status: "",
        _SenEName: `${empCode}-${empName}`
      };
      await apiService.saveTaskStatus(statusData);

      // Queue into daily work report queue
      workReportQueueService.addQueuedActivity(empCode, {
        type: "task",
        title: `Task #${tidStr} (Updated)`,
        description: task.TDesc || `Task #${tidStr}`,
        remarks: `Remarks: ${remark}`,
        referenceId: tidStr,
        clientId: 1,
        clientName: "In-House",
        workLocation: "In-House",
        payload: {
          _clientId: 1,
          _work_location: "In-House",
          _work_report: `Task #${tidStr}: ${task.TDesc} - Status: Updated - Remarks: ${remark}`,
          _empcode: empCode
        }
      });

      const nextUpdated = [...updatedTids, tidStr];
      setUpdatedTids(nextUpdated);
      setSelectedTids(prev => prev.filter(id => id !== tidStr));
      setUpdatedDetails(prev => ({
        ...prev,
        [tidStr]: { type: "remark", message: `Progress Logged: "${remark}"` }
      }));

      const remaining = tasks.filter(t => !nextUpdated.includes(String(t.TID)));
      onTasksChanged(remaining);

      if (remaining.length === 0) {
        setTimeout(() => {
          onAllUpdated();
        }, 700);
      }
    } catch (err) {
      console.error("Failed to update task status:", err);
      alert("Failed to update status. Please try again.");
    } finally {
      setLoadingMap(prev => ({ ...prev, [tidStr]: false }));
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss} className="pending-tasks-modal">
      <div className="ptm-container">
        {/* Header */}
        <div className="ptm-header">
          <div className="ptm-header-icon-wrap">
            <IonIcon icon={alertCircle} className="ptm-warning-icon" />
          </div>
          <div className="ptm-header-titles">
            <div className="ptm-header-badge-row">
              <h2 className="ptm-title">Update Required on Pending Tasks</h2>
              <span className={`ptm-count-pill ${isAllDone ? "done" : ""}`}>
                {isAllDone ? "All Updated ✓" : `${remainingCount} Pending`}
              </span>
            </div>
            <p className="ptm-subtitle">
              Daily work report submission is paused until every pending task has at least a progress update or &quot;No Change&quot; logged for today.
            </p>
          </div>
          <button className="ptm-close-btn" onClick={onDismiss} title="Close window">
            <IonIcon icon={close} />
          </button>
        </div>

        {/* Bulk Action Toolbar */}
        {remainingCount > 0 && (
          <div className="ptm-bulk-bar">
            <div className="ptm-bulk-left">
              <label className="ptm-bulk-checkbox-label" title="Select / Deselect all pending tasks">
                <input
                  type="checkbox"
                  className="ptm-bulk-checkbox-input"
                  checked={isAllSelected}
                  ref={el => {
                    if (el) el.indeterminate = isIndeterminate;
                  }}
                  onChange={handleToggleSelectAll}
                  disabled={isBulkLoading}
                />
                <span className="ptm-custom-checkbox"></span>
                <span className="ptm-bulk-select-title">
                  {selectedCount === 0
                    ? `Select All (${remainingCount} Pending)`
                    : selectedCount === remainingCount
                    ? `All Selected (${remainingCount})`
                    : `${selectedCount} of ${remainingCount} Selected`}
                </span>
              </label>
            </div>

            <div className="ptm-bulk-right">
              <button
                type="button"
                className="ptm-btn ptm-btn-bulk-nochange"
                onClick={handleBulkNoChange}
                disabled={isBulkLoading || remainingCount === 0}
                title="Record 'No Change' for all selected tasks today"
              >
                <IonIcon
                  icon={isBulkLoading ? refreshOutline : checkmarkDoneOutline}
                  className={isBulkLoading ? "ptm-spin" : ""}
                />
                <span>
                  {isBulkLoading
                    ? `Recording ${bulkProgress?.current || 1} of ${bulkProgress?.total || remainingCount}...`
                    : selectedCount > 0 && selectedCount < remainingCount
                    ? `Record 'No Change' for Selected (${selectedCount})`
                    : `Record 'No Change' for All (${remainingCount})`}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Task List */}
        <div className="ptm-list">
          {tasks.map(task => {
            const tidStr = String(task.TID);
            const isUpdated = updatedTids.includes(tidStr);
            const isLoading = !!loadingMap[tidStr];
            const isSelected = selectedTids.includes(tidStr);
            const updatedInfo = updatedDetails[tidStr];
            const priorityClass = (task.TPriority || "Normal").toLowerCase();

            if (isUpdated) {
              return (
                <div key={tidStr} className="ptm-task-card ptm-task-done">
                  <div className="ptm-done-header">
                    <div className="ptm-done-badge">
                      <IonIcon icon={checkmarkCircle} />
                      <span>Updated for Today</span>
                    </div>
                    <span className="ptm-done-tid">#{tidStr}</span>
                  </div>
                  <p className="ptm-task-desc-done">{task.TDesc}</p>
                  {updatedInfo && (
                    <div className="ptm-done-log-pill">
                      <IonIcon icon={checkmarkDoneOutline} />
                      <span>{updatedInfo.message}</span>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div
                key={tidStr}
                className={`ptm-task-card priority-accent-${priorityClass} ${isSelected ? "ptm-task-selected" : ""}`}
              >
                {/* Task Top Meta Info */}
                <div className="ptm-task-top">
                  <div className="ptm-task-top-left">
                    <label
                      className="ptm-card-checkbox-label"
                      title={isSelected ? "Deselect this task" : "Select this task for bulk action"}
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="ptm-card-checkbox-input"
                        checked={isSelected}
                        onChange={() => toggleTaskSelection(tidStr)}
                        disabled={isLoading || isBulkLoading}
                      />
                      <span className="ptm-custom-checkbox"></span>
                    </label>

                    <div className="ptm-task-id-badge">
                      <span>#{tidStr}</span>
                    </div>
                    {task.SenEName && (
                      <span className="ptm-meta-pill ptm-sender-pill" title="Assigned by">
                        <IonIcon icon={personOutline} />
                        From: {task.SenEName}
                      </span>
                    )}
                  </div>

                  <div className="ptm-meta-tags">
                    {task.TPriority && (
                      <span className={`ptm-priority-badge ${priorityClass}`}>
                        <IonIcon icon={flagOutline} />
                        {task.TPriority}
                      </span>
                    )}
                    {task.TDt && (
                      <span className="ptm-meta-pill ptm-date-pill">
                        <IonIcon icon={timeOutline} />
                        Due: {task.TDt}
                      </span>
                    )}
                  </div>
                </div>

                {/* Description Box */}
                <div className="ptm-task-desc-wrap">
                  <p className="ptm-task-desc">{task.TDesc}</p>
                </div>

                {/* Quick Action Area */}
                <div className="ptm-actions-box">
                  {/* Action 1: Custom Remark */}
                  <div className="ptm-remark-input-row">
                    <div className="ptm-input-icon-wrap">
                      <input
                        type="text"
                        className="ptm-remark-input"
                        placeholder="Type today's progress remarks..."
                        value={remarkMap[tidStr] || ""}
                        onChange={e => setRemarkMap({ ...remarkMap, [tidStr]: e.target.value })}
                        disabled={isLoading || isBulkLoading}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            handleSaveRemark(task);
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className="ptm-btn ptm-btn-save"
                      onClick={() => handleSaveRemark(task)}
                      disabled={isLoading || isBulkLoading || !(remarkMap[tidStr] || "").trim()}
                    >
                      <IonIcon icon={paperPlaneOutline} />
                      <span>{isLoading ? "Saving..." : "Save Progress"}</span>
                    </button>
                  </div>

                  {/* Action 2: Quick "No Change" Button */}
                  <div className="ptm-quick-or-row">
                    <span className="ptm-or-divider-text">or if no work happened on this task today:</span>
                    <button
                      type="button"
                      className="ptm-btn ptm-btn-nochange"
                      onClick={() => handleNoChange(task)}
                      disabled={isLoading || isBulkLoading}
                      title="Log that there was no progress on this task today"
                    >
                      <IonIcon icon={refreshOutline} className={isLoading ? "ptm-spin" : ""} />
                      <span>{isLoading ? "Recording..." : "Record 'No Change' for Today"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="ptm-footer">
          <button className="ptm-footer-btn-secondary" onClick={onDismiss}>
            Back to Dashboard
          </button>
          
          <div className="ptm-footer-status">
            <span className="ptm-footer-progress-text">
              {tasks.length - remainingCount} of {tasks.length} tasks updated
            </span>
          </div>

          {remainingCount === 0 && (
            <button className="ptm-footer-btn-primary" onClick={onAllUpdated}>
              <IonIcon icon={sparklesOutline} />
              <span>Proceed to Submit Report</span>
            </button>
          )}
        </div>
      </div>
    </IonModal>
  );
};
