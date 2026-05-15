import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonButton,
  IonInput,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonToast,
  IonLoading,
  IonSelect,
  IonSelectOption,
  IonIcon,
} from "@ionic/react";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE } from "../config";
import { personOutline } from "ionicons/icons";

import ClientMapping from "./ClientMapping";
import ClientProjectUsers from "./ClientProjectUsers";

const ClientDetails: React.FC = () => {
  // TAB STATE
  const [activeTab, setActiveTab] = useState("projects");

  // COMMON
  const [showLoading, setShowLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // PROJECT
  const [projectMasterList, setProjectMasterList] = useState<any[]>([]);
  const [newProjectName, setNewProjectName] = useState("");

  // CLIENT FORM
  const [clientMasterForm, setClientMasterForm] = useState({
    _ClientType: "Corporate",
    _ClientName: "",
    _ClientLocation: "",

    _P1_NAME: "",
    _P1_DESIGN: "",
    _P1_MOBILE: "",
    _P1_EMAIL: "",

    _P2_NAME: "",
    _P2_DESIGN: "",
    _P2_MOBILE: "",
    _P2_EMAIL: "",

    _P3_NAME: "",
    _P3_DESIGN: "",
    _P3_MOBILE: "",
    _P3_EMAIL: "",
  });

  useEffect(() => {
    loadProjectMaster();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  const loadProjectMaster = async () => {
    try {
      const res = await axios.get(`${API_BASE}Sources/Load_ProjectMaster`);
      setProjectMasterList(res.data);
    } catch (e) {
      console.error(e);
      showToast("Error loading project master");
    }
  };

  const saveProjectMaster = async () => {
    if (!newProjectName.trim()) return showToast("Enter Project Name");

    setShowLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append("_PrjectName", newProjectName.trim());

      const res = await axios.post(
        `${API_BASE}Sources/Save_ProjectMaster`,
        formData,
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      if (res.data === "Department Save successfully" || Number(res.data) > 0) {
        showToast("Project Saved Successfully");
        setNewProjectName("");
        loadProjectMaster();
      } else {
        showToast(String(res.data) || "Error Saving Project");
      }
    } catch (e: any) {
      console.error(e);
      const errorMsg = e.response?.data || e.message || "Error Saving Project";
      showToast(errorMsg);
    }

    setShowLoading(false);
  };

  const saveClientMaster = async () => {
    if (!clientMasterForm._ClientName.trim())
      return showToast("Enter Client Name");

    setShowLoading(true);

    try {
      // Create a payload with "0" as fallback for empty fields
      const payload: any = { ...clientMasterForm };
      [1, 2, 3].forEach((num) => {
        payload[`_P${num}_NAME`] = payload[`_P${num}_NAME`]?.trim() || "0";
        payload[`_P${num}_DESIGN`] = payload[`_P${num}_DESIGN`]?.trim() || "0";
        payload[`_P${num}_MOBILE`] = payload[`_P${num}_MOBILE`]?.trim() || "0";
        payload[`_P${num}_EMAIL`] = payload[`_P${num}_EMAIL`]?.trim() || "0";
      });

      // Use URLSearchParams for x-www-form-urlencoded format
      const formData = new URLSearchParams();
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null) formData.append(k, String(v));
      });

      const res = await axios.post(
        `${API_BASE}Sources/Save_Client_Master`,
        formData,
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      if (res.data === "Department Save successfully" || Number(res.data) > 0) {
        showToast("Client Saved Successfully");
      } else {
        showToast(String(res.data) || "Error Saving Client");
      }
    } catch (e: any) {
      console.error(e);
      const errorMsg = e.response?.data || e.message || "Error Saving Client";
      showToast(errorMsg);
    }

    setShowLoading(false);
  };

  const clearForm = () => {
    setNewProjectName("");
    setClientMasterForm({
      _ClientType: "Corporate",
      _ClientName: "",
      _ClientLocation: "",

      _P1_NAME: "",
      _P1_DESIGN: "",
      _P1_MOBILE: "",
      _P1_EMAIL: "",

      _P2_NAME: "",
      _P2_DESIGN: "",
      _P2_MOBILE: "",
      _P2_EMAIL: "",

      _P3_NAME: "",
      _P3_DESIGN: "",
      _P3_MOBILE: "",
      _P3_EMAIL: "",
    });
  };

  return (
    <IonPage>
      <IonContent>
        {/* Header Banner */}
        <div className="salaries-top-header">
          <h1>Client Dashboard</h1>
          <p>View and manage client and project information.</p>
        </div>

        {/* ✅ SUPER COMPRESSED TAB NAVIGATION */}
        <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "15px", marginRight: "15px", marginLeft: "15px", padding: "5px 0" }}>
          <IonButton
            style={{ height: "44px", minWidth: "150px", fontSize: "0.95rem" }}
            className="header-nav-btn"
            fill={activeTab === "projects" ? "solid" : "outline"}
            onClick={() => setActiveTab("projects")}
          >
            Projects/Clients
          </IonButton>

          <IonButton
            style={{ height: "44px", minWidth: "150px", fontSize: "0.95rem" }}
            className="header-nav-btn"
            fill={activeTab === "mapping" ? "solid" : "outline"}
            onClick={() => setActiveTab("mapping")}
          >
            Mapping
          </IonButton>

          <IonButton
            style={{ height: "44px", minWidth: "150px", fontSize: "0.95rem" }}
            className="header-nav-btn"
            fill={activeTab === "clientdetails" ? "solid" : "outline"}
            onClick={() => setActiveTab("clientdetails")}
          >
            Client Details
          </IonButton>
        </div>


        {/* PROJECTS TAB */}
        {activeTab === "projects" && (
          <IonGrid className="full-height-grid">
            <IonRow>
              {/* LEFT COLUMN: Project Master */}
              <IonCol size="12" size-md="4" className="column-divider">
                <div className="section-container">
                  <h3 className="master-title">Project Master</h3>

                  <IonItem lines="none" className="image-style-input">
                    <IonInput
                      placeholder="Project Name*"
                      value={newProjectName}
                      onIonInput={(e) => setNewProjectName(e.detail.value!)}
                    />
                  </IonItem>

                  <div className="button-row-image">
                    <IonButton className="blue-btn-image" onClick={saveProjectMaster}>
                      SAVE
                    </IonButton>
                    <IonButton className="blue-btn-image" onClick={clearForm}>
                      CLEAR
                    </IonButton>
                  </div>

                  <div className="image-table-container">
                    <table className="image-table">
                      <thead>
                        <tr>
                          <th style={{ width: "30%" }}>P_ID</th>
                          <th style={{ width: "70%" }}>Project</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectMasterList.map((p, i) => (
                          <tr key={i}>
                            <td>{p[0]}</td>
                            <td>{p[1]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </IonCol>

              {/* RIGHT COLUMN: Client Master */}
              <IonCol size="12" size-md="8">
                <div className="section-container">
                  <h3 className="master-title">Client Master</h3>

                  <IonRow>
                    <IonCol size="12" size-md="4">
                      <IonItem lines="none" className="image-style-input">
                        <IonSelect
                          placeholder="Client Type*"
                          value={clientMasterForm._ClientType}
                          onIonChange={(e) =>
                            setClientMasterForm({
                              ...clientMasterForm,
                              _ClientType: e.detail.value,
                            })
                          }
                        >
                          <IonSelectOption value="Client">Client</IonSelectOption>
                          <IonSelectOption value="Party">Party</IonSelectOption>

                        </IonSelect>
                      </IonItem>
                    </IonCol>

                    <IonCol size="12" size-md="4">
                      <IonItem lines="none" className="image-style-input">
                        <IonInput
                          placeholder="Client Name*"
                          value={clientMasterForm._ClientName}
                          onIonInput={(e) =>
                            setClientMasterForm({
                              ...clientMasterForm,
                              _ClientName: e.detail.value!,
                            })
                          }
                        />
                      </IonItem>
                    </IonCol>

                    <IonCol size="12" size-md="4">
                      <IonItem lines="none" className="image-style-input">
                        <IonInput
                          placeholder="Client Location*"
                          value={clientMasterForm._ClientLocation}
                          onIonInput={(e) =>
                            setClientMasterForm({
                              ...clientMasterForm,
                              _ClientLocation: e.detail.value!,
                            })
                          }
                        />
                      </IonItem>
                    </IonCol>
                  </IonRow>

                  {[1, 2, 3].map((num) => (
                    <div key={num} className="admin-section-image">
                      <h4 className="admin-title">Administration Details{num}</h4>
                      <IonRow>
                        <IonCol size="12" size-md="3">
                          <IonItem lines="none" className="image-style-input">
                            <IonInput
                              placeholder="Name*"
                              value={(clientMasterForm as any)[`_P${num}_NAME`]}
                              onIonInput={(e) =>
                                setClientMasterForm({
                                  ...clientMasterForm,
                                  [`_P${num}_NAME`]: e.detail.value!,
                                })
                              }
                            />
                          </IonItem>
                        </IonCol>
                        <IonCol size="12" size-md="3">
                          <IonItem lines="none" className="image-style-input">
                            <IonInput
                              placeholder="Designation*"
                              value={(clientMasterForm as any)[`_P${num}_DESIGN`]}
                              onIonInput={(e) =>
                                setClientMasterForm({
                                  ...clientMasterForm,
                                  [`_P${num}_DESIGN`]: e.detail.value!,
                                })
                              }
                            />
                          </IonItem>
                        </IonCol>
                        <IonCol size="12" size-md="3">
                          <IonItem lines="none" className="image-style-input">
                            <IonInput
                              placeholder="Mobile No*"
                              value={(clientMasterForm as any)[`_P${num}_MOBILE`]}
                              onIonInput={(e) =>
                                setClientMasterForm({
                                  ...clientMasterForm,
                                  [`_P${num}_MOBILE`]: e.detail.value!,
                                })
                              }
                            />
                          </IonItem>
                        </IonCol>
                        <IonCol size="12" size-md="3">
                          <IonItem lines="none" className="image-style-input">
                            <IonInput
                              placeholder="E-Mail*"
                              value={(clientMasterForm as any)[`_P${num}_EMAIL`]}
                              onIonInput={(e) =>
                                setClientMasterForm({
                                  ...clientMasterForm,
                                  [`_P${num}_EMAIL`]: e.detail.value!,
                                })
                              }
                            />
                          </IonItem>
                        </IonCol>
                      </IonRow>
                    </div>
                  ))}

                  <div className="button-row-image-center">
                    <IonButton className="blue-btn-image" onClick={saveClientMaster}>
                      SAVE CLIENT
                    </IonButton>
                    <IonButton className="blue-btn-image" onClick={clearForm}>
                      CLEAR
                    </IonButton>
                  </div>
                </div>
              </IonCol>
            </IonRow>
          </IonGrid>
        )}

        {/* MAPPING TAB */}
        {activeTab === "mapping" && <ClientMapping />}

        {/* CLIENT DETAILS TAB */}
        {activeTab === "clientdetails" && <ClientProjectUsers />}

        {/* FLOAT ICON */}
        <div className="bottom-right-actions">
          <div className="action-icon-box">
            <IonIcon icon={personOutline} />
          </div>
        </div>

        {/* LOADING */}
        <IonLoading
          isOpen={showLoading}
          message="Saving..."
        />

        {/* TOAST */}
        <IonToast
          isOpen={!!toastMsg}
          message={toastMsg}
          duration={3000}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};

export default ClientDetails; 