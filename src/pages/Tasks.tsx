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
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [empSearchTerm, setEmpSearchTerm] = useState("");
  const triggerRef = useRef<HTMLDivElement>(null);

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

  // Filtering for Searchable Dropdown
  const filteredEmployees = employees.filter((emp) => {
    const term = empSearchTerm.toLowerCase();
    const name = String(emp[0]).toLowerCase();
    const id = String(emp[1]).toLowerCase();
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

  const formatDateOnly = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
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

  useEffect(() => {
    const userJson = localStorage.getItem("user");
    if (userJson) {
      const user = JSON.parse(userJson);
      setCurrentEmpCode(user.empCode);
      setCurrentEmpName(user.empName);
      console.log("Logged In User:", user);
      fetchInitialData(user.empCode);
    }
  }, []);

  const fetchInitialData = async (empCode: string) => {
    setIsLoading(true);
    try {
      console.group("Fetching Initial Data");

      // 1. Load Employees (API 1)
      const emps = await apiService.loadEmployees("Active");
      setEmployees(emps);

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
      await apiService.saveTask(taskData);
      setToastMessage("Task assigned successfully");

      // API 13: Send SMS
      try {
        const msg = `New task assigned to you by ${currentEmpName}: ${description.substring(0, 30)}${description.length > 30 ? '...' : ''}`;
        await apiService.sendMessage("", msg);
      } catch (smsError) {
        console.warn("SMS assignment notification failed:", smsError);
      }
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

  const handleSaveStatus = async () => {
    if (!updateStatusInfo && !updateStatus) {
      setToastMessage("Please fill status or info");
      return;
    }
    setIsLoading(true);
    try {
      const statusData = {
        _Tskid: String(activeTask.TID),
        _StatusDate: formatDateTime(new Date()),
        _StatusInfo: updateStatusInfo,
        _Status: updateStatus === "Closed" ? "true" : "",
      };
      await apiService.saveTaskStatus(statusData);

      try {
        const msg = `Task #${activeTask.TID} status updated to ${updateStatus}: ${updateStatusInfo}`;
        await apiService.sendMessage("", msg);
      } catch (smsError) {
        console.warn("SMS status update notification failed:", smsError);
      }

      setToastMessage("Status updated");
      setUpdateStatusInfo("");
      setUpdateStatus("");
      handleViewTask(activeTask);
      fetchInitialData(currentEmpCode);
    } catch (error) {
      console.error("Error saving status:", error);
      setToastMessage("Failed to update status");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransferTask = async () => {
    if (!transferTargetEmp) {
      setToastMessage("Please select recipient");
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

      try {
        const msg = `Task #${activeTask.TID} transferred to ${transferTargetEmp} by ${currentEmpName}`;
        await apiService.sendMessage("", msg);
      } catch (smsError) {
        console.warn("SMS transfer notification failed:", smsError);
      }

      setToastMessage("Task transferred");
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

      try {
        const msg = `Task #${task.TID} has been reopened by ${currentEmpName}`;
        await apiService.sendMessage("", msg);
      } catch (smsError) {
        console.warn("SMS reopen notification failed:", smsError);
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

            <div className="task-list-container">
              {getFilteredTasks(receivedTasks).map((task: any, index: number) => (
                <div
                  className="premium-task-card"
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
                      From: {task.SenEName}
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
                <div className="ntv-form-icon-box">
                  <IonIcon icon={add} />
                </div>
                <h2 className="ntv-form-title">Assign New Task</h2>
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
                                const empName = String(emp[1]);
                                const isSelected = assignTo === `${empId}-${empName}`;

                                // Clean initials logic (stripping numeric prefixes if any)
                                const cleanName = empName.includes("-") ? empName.split("-")[1].trim() : empName;
                                const initials = (cleanName.charAt(0) || "?").toUpperCase();

                                return (
                                  <div
                                    key={index}
                                    className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setAssignTo(`${empId}-${empName}`);
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
                          height: '100px',
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

            <div className="task-list-container">
              {getFilteredTasks(sentTasks).map((task: any, index: number) => (
                <div
                  className="premium-task-card"
                  key={index}
                  onClick={() => handleViewTask(task)}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className={`priority-marker ${(task.TPriority || "Low").toLowerCase()}`}></div>
                  <div className="task-card-header">
                    <div className="tid-badge">ID: {task.TID}</div>
                    <div className="action-buttons">
                      <IonButton
                        fill="clear"
                        color="danger"
                        size="small"
                        onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.TID); }}
                      >
                        <IonIcon icon={trash} slot="icon-only" style={{ fontSize: '18px' }} />
                      </IonButton>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="recipient">To: {task.RecEName}</div>
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
          className="pwt-date-modal"
        >
          <div className="pwt-modal-content">
            <h3 className="pwt-modal-title">Select Deadline</h3>
            <IonDatetime
              presentation="date"
              onIonChange={(e) => {
                if (typeof e.detail.value === "string")
                  setTargetDate(e.detail.value);
                setStartDateModalOpen(false);
              }}
            />
            <IonButton
              expand="block"
              mode="ios"
              onClick={() => setStartDateModalOpen(false)}
            >
              Close
            </IonButton>
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
                            {activeTask.TargetDays} Day(s) Alpha
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Update & Transfer Forms */}
                    {activeTask.Status !== 'Closed' && selectedTab === 'view' && (
                      <div className="tdm-action-forms">
                        <div className="tdm-form-card">
                          <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: '800', textTransform: 'uppercase' }}>Update Status</h4>
                          <IonItem lines="full" style={{ '--padding-start': '0' }}>
                            <IonLabel position="stacked">Status Info</IonLabel>
                            <IonInput value={updateStatusInfo} onIonChange={e => setUpdateStatusInfo(e.detail.value!)} placeholder="What's the progress?" />
                          </IonItem>
                          <div className="tdm-status-toggle-box" style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '12px',
                            margin: '16px 0'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <IonIcon
                                icon={updateStatus === 'Closed' ? checkmarkCircle : checkmarkCircleOutline}
                                style={{ fontSize: '22px', color: updateStatus === 'Closed' ? 'var(--ion-color-success)' : 'rgba(255,255,255,0.4)' }}
                              />
                              <span style={{ fontSize: '14px', fontWeight: '700', color: updateStatus === 'Closed' ? 'var(--ion-color-success)' : 'inherit' }}>
                                Mark as Completed
                              </span>
                            </div>
                            <IonToggle
                              checked={updateStatus === 'Closed'}
                              onIonChange={e => {
                                if (e.detail.checked) {
                                  present({
                                    header: 'Close Task',
                                    message: 'Are you sure you want to mark this task as completed?',
                                    buttons: [
                                      { text: 'Cancel', role: 'cancel', handler: () => setUpdateStatus('') },
                                      { text: 'Yes, Close', handler: () => setUpdateStatus('Closed') }
                                    ]
                                  });
                                } else {
                                  setUpdateStatus('');
                                }
                              }}
                              color="success"
                            />
                          </div>
                          <IonButton expand="block" shape="round" onClick={handleSaveStatus} style={{ marginTop: '16px', '--background': 'var(--premium-gradient)', fontWeight: '700' }}>
                            {updateStatus === 'Closed' ? 'Close Task' : 'Save Status'}
                          </IonButton>
                        </div>

                        <div className="tdm-form-card">
                          <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: '800', textTransform: 'uppercase' }}>Transfer Task</h4>
                          <IonItem lines="full" style={{ '--padding-start': '0' }}>
                            <IonLabel position="stacked">Transfer To</IonLabel>
                            <IonSelect value={transferTargetEmp} onIonChange={e => setTransferTargetEmp(e.detail.value!)}>
                              {employees.map((emp, i) => (
                                <IonSelectOption key={i} value={`${emp[0]}-${emp[1]}`}>
                                  {emp[0]} - {emp[1]}
                                </IonSelectOption>
                              ))}
                            </IonSelect>
                          </IonItem>
                          <IonItem lines="full" style={{ '--padding-start': '0' }}>
                            <IonLabel position="stacked">Transfer Remarks</IonLabel>
                            <IonInput
                              value={updateStatusInfo}
                              onIonChange={e => setUpdateStatusInfo(e.detail.value!)}
                              placeholder="Enter details for transfer..."
                            />
                          </IonItem>
                          <IonButton expand="block" fill="outline" shape="round" onClick={handleTransferTask} style={{ marginTop: '16px', fontWeight: '700' }}>
                            Transfer Now
                          </IonButton>
                        </div>
                      </div>
                    )}

                    {activeTask.Status === 'Closed' && selectedTab === 'view' && (
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
