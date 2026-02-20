import React, { useState } from "react";
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
} from "@ionic/react";
import { search, send, close } from "ionicons/icons";
// import "./Tasks.css";

const Tasks: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<string>("assign");
  const [filterValue, setFilterValue] = useState<string>("pending");
  const [assignTo, setAssignTo] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [priority, setPriority] = useState("");
  const [startDateModalOpen, setStartDateModalOpen] = useState(false);

  const taskList = [
    {
      id: 1,
      name: "1531-B SESHA RAGHAVENDRA",
      description: "Sophos Antivirus Installation",
      assignedOn: "17-11-2023",
      targetDate: "22-11-2023",
      priority: "High",
    },
    {
      id: 2,
      name: "1532-B NAGARJUNA",
      description: "Printer Setup",
      assignedOn: "18-11-2023",
      targetDate: "25-11-2023",
      priority: "Medium",
    },
    {
      id: 3,
      name: "1533-B SURESH",
      description: "Network Configuration",
      assignedOn: "19-11-2023",
      targetDate: "24-11-2023",
      priority: "Low",
    },
  ];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonToolbar className="menu-toolbar" color="Tertiary">
            <img
              src="./images/dbase.png"
              alt="DBase Logo"
              className="menu-logo"
            />
          </IonToolbar>
        </IonToolbar>
      </IonHeader>

      <IonContent className="tasks-page">
        <IonSegment
          value={selectedTab}
          onIonChange={(e) => setSelectedTab(e.detail.value as string)}
          className="segment-wrapper"
        >
          <IonSegmentButton value="assign">
            <IonLabel>Assign Task</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="view">
            <IonLabel>View Task</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {/* Assign Task Tab */}
        {selectedTab === "assign" && (
          <IonGrid className="assign-task-form">
            <IonRow>
              <IonCol size="12" sizeMd="3">
                <IonItem>
                  {/* <IonLabel>Assign Task To</IonLabel> */}
                  <IonInput
                    value={assignTo}
                    placeholder="Assign Task To"
                    onIonChange={(e) => setAssignTo(e.detail.value!)}
                  />
                </IonItem>
              </IonCol>

              <IonCol size="12" sizeMd="3">
                <IonItem>
                  {/* <IonLabel>Task Description</IonLabel> */}
                  <IonInput
                    value={description}
                    placeholder="Task Description"
                    onIonChange={(e) => setDescription(e.detail.value!)}
                  />
                </IonItem>
              </IonCol>

              <IonCol size="12" sizeMd="3">
                <IonItem button onClick={() => setStartDateModalOpen(true)}>
                  {/* <IonLabel>Target Date</IonLabel> */}
                  <IonInput
                    readonly
                    value={
                      targetDate
                        ? new Date(targetDate).toLocaleDateString()
                        : "Target Date"
                    }
                  />
                </IonItem>
              </IonCol>

              <IonCol size="12" sizeMd="3">
                <IonItem>
                  {/* <IonLabel>Priority</IonLabel> */}
                  <IonSelect
                    placeholder="Select Priority"
                    className="select-text"
                    interface="popover"
                    value={priority}
                    onIonChange={(e) => setPriority(e.detail.value)}
                  >
                    <IonSelectOption value="High">High</IonSelectOption>
                    <IonSelectOption value="Medium">Medium</IonSelectOption>
                    <IonSelectOption value="Low">Low</IonSelectOption>
                  </IonSelect>
                </IonItem>
              </IonCol>
            </IonRow>

            <IonRow
              className="button-row"
              style={{ marginTop: "0px", marginBottom: "0px" }}
            >
              <IonButton
                expand="block"
                className="login-btn2"
                style={{ "--box-shadow": "none" }}
                color={"#f57c00"}
              >
                <IonIcon icon={send} slot="start" />
                Send
              </IonButton>

              <IonButton
                expand="block"
                className="login-btn2"
                style={{ "--box-shadow": "none" }}
                color={"red"}
              >
                <IonIcon icon={close} slot="start" />
                Clear
              </IonButton>
            </IonRow>

            <div className="task-filters">
              <IonSegment
                value={filterValue}
                onIonChange={(e) =>
                  setFilterValue((e.detail.value as string) || "pending")
                }
              >
                <IonSegmentButton value="pending">Pending</IonSegmentButton>
                <IonSegmentButton value="closed">Closed</IonSegmentButton>
                <IonSegmentButton value="all">All</IonSegmentButton>
              </IonSegment>
            </div>

            <div className="task-table">
              <div className="task-row header">
                <div>TID</div>
                <div>Assigned To</div>
                <div>Description</div>
                <div>Assign. On</div>
                <div>Target Dt</div>
                <div>View</div>
              </div>

              {/* Sample data row */}
              <div className="task-row">
                <div>
                  <span className="badge high">H</span> 1
                </div>
                <div>1531-B SESHA RAGHAVENDRA</div>
                <div>Sophos Antivirus Installation</div>
                <div>17-11-2023</div>
                <div>22-11-2023</div>
                <div>
                  <IonIcon icon={search} />
                </div>
              </div>

              <div className="task-row">
                <div>
                  <span className="badge medium">M</span> 1
                </div>
                <div>1531-B SESHA RAGHAVENDRA</div>
                <div>Sophos Antivirus Installation</div>
                <div>17-11-2023</div>
                <div>22-11-2023</div>
                <div>
                  <IonIcon icon={search} />
                </div>
              </div>

              <div className="task-row">
                <div>
                  <span className="badge low">L</span> 1
                </div>
                <div>1531-B SESHA RAGHAVENDRA</div>
                <div>Sophos Antivirus Installation</div>
                <div>17-11-2023</div>
                <div>22-11-2023</div>
                <div>
                  <IonIcon icon={search} />
                </div>
              </div>

              <div className="task-row">
                <div>
                  <span className="badge high">H</span> 1
                </div>
                <div>1531-B SESHA RAGHAVENDRA</div>
                <div>Sophos Antivirus Installation</div>
                <div>17-11-2023</div>
                <div>22-11-2023</div>
                <div>
                  <IonIcon icon={search} />
                </div>
              </div>

              <div className="task-row">
                <div>
                  <span className="badge medium">M</span> 1
                </div>
                <div>1531-B SESHA RAGHAVENDRA</div>
                <div>Sophos Antivirus Installation</div>
                <div>17-11-2023</div>
                <div>22-11-2023</div>
                <div>
                  <IonIcon icon={search} />
                </div>
              </div>
            </div>
          </IonGrid>
        )}

        {/* View Tasks Tab */}
        {selectedTab === "view" && (
          <div className="view-task-section">
            <div className="task-filters">
              <IonSegment
                value={filterValue}
                onIonChange={(e) =>
                  setFilterValue((e.detail.value as string) || "pending")
                }
              >
                <IonSegmentButton value="pending">Pending</IonSegmentButton>
                <IonSegmentButton value="closed">Closed</IonSegmentButton>
                <IonSegmentButton value="all">All</IonSegmentButton>
              </IonSegment>
            </div>

            <div className="task-table">
              <div className="task-row header">
                <div>TID</div>
                <div>Assigned To</div>
                <div>Description</div>
                <div>Assign. On</div>
                <div>Target Dt</div>
                <div>View</div>
              </div>

              {taskList.map((task) => (
                <div className="task-row" key={task.id}>
                  <div>
                    <span className={`badge ${task.priority.toLowerCase()}`}>
                      {task.priority.charAt(0)}
                    </span>{" "}
                    {task.id}
                  </div>
                  <div>{task.name}</div>
                  <div>{task.description}</div>
                  <div>{task.assignedOn}</div>
                  <div>{task.targetDate}</div>
                  <div>
                    <IonIcon icon={search} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Date Modal */}
        <IonModal
          isOpen={startDateModalOpen}
          onDidDismiss={() => setStartDateModalOpen(false)}
          className="date-modal"
        >
          <div className="modal-content">
            <IonDatetime
              presentation="date"
              onIonChange={(e) => {
                if (typeof e.detail.value === "string")
                  setTargetDate(e.detail.value);
                setStartDateModalOpen(false);
              }}
            />
            <IonButton
              expand="full"
              onClick={() => setStartDateModalOpen(false)}
            >
              Close
            </IonButton>
          </div>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default Tasks;
