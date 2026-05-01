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
  IonCard,
  IonCardHeader,
  IonCardContent,
  IonList,
  IonItem,
  IonCheckbox,
  IonRadio,
  IonRadioGroup,
  IonText,
  IonToast,
  IonLoading,
  IonSelect,
  IonSelectOption,
  IonIcon,
} from "@ionic/react";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE } from "../config";
import { saveOutline, trashOutline, refreshOutline, powerOutline, personOutline } from "ionicons/icons";
import "./ClientDetails.css";

const ClientDetails: React.FC = () => {
  const [tab, setTab] = useState("projects");
  const [showLoading, setShowLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // --- Tab 1: Projects/Clients States ---
  const [projectMasterList, setProjectMasterList] = useState<any[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [clientMasterForm, setClientMasterForm] = useState({
    _ClientType: "Client",
    _ClientName: "",
    _ClientLocation: "",
    _P1_NAME: "", _P1_DESIGN: "", _P1_MOBILE: "", _P1_EMAIL: "",
    _P2_NAME: "", _P2_DESIGN: "", _P2_MOBILE: "", _P2_EMAIL: "",
    _P3_NAME: "", _P3_DESIGN: "", _P3_MOBILE: "", _P3_EMAIL: ""
  });

  // --- Tab 2: Mapping States ---
  const [clientMappingList, setClientMappingList] = useState<any[]>([]);
  const [projectMappingList, setProjectMappingList] = useState<any[]>([]);
  const [selectedClientID_Map, setSelectedClientID_Map] = useState<string>("");
  const [selectedProjectIDs_Map, setSelectedProjectIDs_Map] = useState<string[]>([]);

  // --- Tab 3: Client Details States ---
  const [clientSourcesList, setClientSourcesList] = useState<any[]>([]);
  const [projectSourcesList, setProjectSourcesList] = useState<any[]>([]);
  const [selectedCID_Details, setSelectedCID_Details] = useState("");
  const [selectedPID_Details, setSelectedPID_Details] = useState("");
  const [userDetailsForm, setUserDetailsForm] = useState({
    _U1_NAME: "", _U1_DESIGN: "", _U1_MOBILE: "", _U1_EMAIL: "",
    _U2_NAME: "", _U2_DESIGN: "", _U2_MOBILE: "", _U2_EMAIL: "",
    _U3_NAME: "", _U3_DESIGN: "", _U3_MOBILE: "", _U3_EMAIL: "",
    _U4_NAME: "", _U4_DESIGN: "", _U4_MOBILE: "", _U4_EMAIL: ""
  });

  // --- API Handlers ---

  useEffect(() => {
    loadProjectMaster();
    loadMappingData();
    loadClientSources();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // Tab 1 APIs
  const loadProjectMaster = async () => {
    try {
      const res = await axios.get(`${API_BASE}Sources/Load_ProjectMaster`);
      setProjectMasterList(res.data);
    } catch (e) { console.error(e); }
  };

  const saveProjectMaster = async () => {
    if (!newProjectName) return showToast("Enter project name");
    setShowLoading(true);
    try {
      await axios.post(`${API_BASE}Sources/Save_ProjectMaster`, { _PrjectName: newProjectName });
      showToast("Project Saved Successfully");
      setNewProjectName("");
      loadProjectMaster();
    } catch (e) { showToast("Error saving project"); }
    setShowLoading(false);
  };

  const saveClientMaster = async () => {
    if (!clientMasterForm._ClientName) {
      showToast('Please enter Client Name');
      return;
    }

    setShowLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API_BASE}Sources/Save_ClientMaster`,
        clientMasterForm,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : undefined,
            "Content-Type": "application/json",
          },
        }
      );

      // If server returns success status
      if (res && (res.status === 200 || res.status === 201)) {
        showToast("Client Master Saved Successfully");
      } else {
        console.error('Save_ClientMaster unexpected response:', res);
        showToast("Error saving client master");
      }
    } catch (err: any) {
      console.error('Save_ClientMaster error:', err?.response || err);
      const msg = err?.response?.data || err?.message || 'Error saving client master';
      showToast(String(msg));
    } finally {
      setShowLoading(false);
    }
  };

  // Tab 2 APIs
  const loadMappingData = async () => {
    try {
      const cRes = await axios.get(`${API_BASE}Sources/Load_Clients_Mapping`);
      const pRes = await axios.get(`${API_BASE}Sources/Load_Project_Mapping`);
      setClientMappingList(cRes.data);
      setProjectMappingList(pRes.data);
    } catch (e) { console.error(e); }
  };

  const loadMappedProjects = async (cid: string) => {
    setSelectedClientID_Map(cid);
    try {
      const res = await axios.get(`${API_BASE}Sources/Load_Client_Mapped_Projects?ClientID=${cid}`);
      const mappedIds = res.data.map((p: any) => p[0].toString());
      setSelectedProjectIDs_Map(mappedIds);
    } catch (e) { console.error(e); }
  };

  const toggleProjectMapping = (pid: string) => {
    setSelectedProjectIDs_Map(prev =>
      prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
    );
  };

  const saveMapping = async () => {
    if (!selectedClientID_Map) return showToast("Select a client");
    setShowLoading(true);
    try {
      await axios.post(`${API_BASE}Sources/Save_Client_Project_Mapping`, {
        _ClientID: selectedClientID_Map,
        _ProjectIDs: selectedProjectIDs_Map.join(",") + ","
      });
      showToast("Mapping Saved Successfully");
    } catch (e) { showToast("Error saving mapping"); }
    setShowLoading(false);
  };

  // Tab 3 APIs
  const loadClientSources = async () => {
    try {
      const res = await axios.get(`${API_BASE}Sources/Load_Clients_Sources`);
      setClientSourcesList(res.data);
    } catch (e) { console.error(e); }
  };

  const loadProjectSources = async (cid: string) => {
    setSelectedCID_Details(cid);
    try {
      const res = await axios.get(`${API_BASE}Sources/Load_Project_Sources?CID=${cid}`);
      setProjectSourcesList(res.data);
    } catch (e) { console.error(e); }
  };

  const loadClientUserDetails = async (pid: string) => {
    setSelectedPID_Details(pid);
    try {
      const res = await axios.get(`${API_BASE}Sources/Load_Client_User_Details?CID=${selectedCID_Details}&PID=${pid}`);
      if (res.data && res.data[0]) {
        const d = res.data[0];
        setUserDetailsForm({
          _U1_NAME: d[0] || "", _U1_DESIGN: d[1] || "", _U1_MOBILE: d[2] || "", _U1_EMAIL: d[3] || "",
          _U2_NAME: d[4] || "", _U2_DESIGN: d[5] || "", _U2_MOBILE: d[6] || "", _U2_EMAIL: d[7] || "",
          _U3_NAME: d[8] || "", _U3_DESIGN: d[9] || "", _U3_MOBILE: d[10] || "", _U3_EMAIL: d[11] || "",
          _U4_NAME: d[12] || "", _U4_DESIGN: d[13] || "", _U4_MOBILE: d[14] || "", _U4_EMAIL: d[15] || ""
        });
      }
    } catch (e) { console.error(e); }
  };

  const saveUserDetails = async () => {
    setShowLoading(true);
    try {
      await axios.post(`${API_BASE}Sources/Save_Client_User_Details`, {
        _ClientID: selectedCID_Details,
        _ProjectIDs: selectedPID_Details,
        ...userDetailsForm
      });
      showToast("User Details Saved Successfully");
    } catch (e) { showToast("Error saving user details"); }
    setShowLoading(false);
  };

  const clearForm = (target: string) => {
    if (target === 'projects') {
      setNewProjectName("");
      setClientMasterForm({
        _ClientType: "Client", _ClientName: "", _ClientLocation: "",
        _P1_NAME: "", _P1_DESIGN: "", _P1_MOBILE: "", _P1_EMAIL: "",
        _P2_NAME: "", _P2_DESIGN: "", _P2_MOBILE: "", _P2_EMAIL: "",
        _P3_NAME: "", _P3_DESIGN: "", _P3_MOBILE: "", _P3_EMAIL: ""
      });
    } else if (target === 'mapping') {
      setSelectedClientID_Map("");
      setSelectedProjectIDs_Map([]);
    } else if (target === 'details') {
      setUserDetailsForm({
        _U1_NAME: "", _U1_DESIGN: "", _U1_MOBILE: "", _U1_EMAIL: "",
        _U2_NAME: "", _U2_DESIGN: "", _U2_MOBILE: "", _U2_EMAIL: "",
        _U3_NAME: "", _U3_DESIGN: "", _U3_MOBILE: "", _U3_EMAIL: "",
        _U4_NAME: "", _U4_DESIGN: "", _U4_MOBILE: "", _U4_EMAIL: ""
      });
    }
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="image-header-toolbar">
          <IonSegment
            value={tab}
            onIonChange={(e) => setTab((e.detail.value as string) || "projects")}
            className="image-segment"
          >
            <IonSegmentButton value="projects">
              <IonLabel>Projects/Clients</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="mapping">
              <IonLabel>Mapping</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="details">
              <IonLabel>Client Details</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* TAB 1: PROJECTS/CLIENTS */}
        {tab === "projects" && (
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
                    <IonButton className="blue-btn-image" onClick={saveProjectMaster}>SAVE</IonButton>
                    <IonButton className="blue-btn-image" onClick={() => clearForm('projects')}>CLEAR</IonButton>
                  </div>

                  <div className="image-table-container">
                    <table className="image-table">
                      <thead>
                        <tr>
                          <th style={{ width: '30%' }}>P_ID</th>
                          <th style={{ width: '70%' }}>Project</th>
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
                          onIonChange={(e) => setClientMasterForm({ ...clientMasterForm, _ClientType: e.detail.value })}
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
                          onIonInput={(e) => setClientMasterForm({ ...clientMasterForm, _ClientName: e.detail.value! })}
                        />
                      </IonItem>
                    </IonCol>
                    <IonCol size="12" size-md="4">
                      <IonItem lines="none" className="image-style-input">
                        <IonInput
                          placeholder="Client Location*"
                          value={clientMasterForm._ClientLocation}
                          onIonInput={(e) => setClientMasterForm({ ...clientMasterForm, _ClientLocation: e.detail.value! })}
                        />
                      </IonItem>
                    </IonCol>
                  </IonRow>

                  {/* Administration Details Sections */}
                  {[1, 2, 3].map((num) => (
                    <div key={num} className="admin-section-image">
                      <h4 className="admin-title">Administration Details{num}</h4>
                      <IonRow>
                        <IonCol size="12" size-md="3">
                          <IonItem lines="none" className="image-style-input">
                            <IonInput
                              placeholder="Name*"
                              value={(clientMasterForm as any)[`_P${num}_NAME`]}
                              onIonInput={(e) => setClientMasterForm({ ...clientMasterForm, [`_P${num}_NAME`]: e.detail.value! })}
                            />
                          </IonItem>
                        </IonCol>
                        <IonCol size="12" size-md="3">
                          <IonItem lines="none" className="image-style-input">
                            <IonInput
                              placeholder="Designation*"
                              value={(clientMasterForm as any)[`_P${num}_DESIGN`]}
                              onIonInput={(e) => setClientMasterForm({ ...clientMasterForm, [`_P${num}_DESIGN`]: e.detail.value! })}
                            />
                          </IonItem>
                        </IonCol>
                        <IonCol size="12" size-md="3">
                          <IonItem lines="none" className="image-style-input">
                            <IonInput
                              placeholder="Mobile No*"
                              value={(clientMasterForm as any)[`_P${num}_MOBILE`]}
                              onIonInput={(e) => setClientMasterForm({ ...clientMasterForm, [`_P${num}_MOBILE`]: e.detail.value! })}
                            />
                          </IonItem>
                        </IonCol>
                        <IonCol size="12" size-md="3">
                          <IonItem lines="none" className="image-style-input">
                            <IonInput
                              placeholder="E-Mail*"
                              value={(clientMasterForm as any)[`_P${num}_EMAIL`]}
                              onIonInput={(e) => setClientMasterForm({ ...clientMasterForm, [`_P${num}_EMAIL`]: e.detail.value! })}
                            />
                          </IonItem>
                        </IonCol>
                      </IonRow>
                    </div>
                  ))}

                  <div className="button-row-image-center">
                    <IonButton className="blue-btn-image" onClick={saveClientMaster}>SAVE</IonButton>
                    <IonButton className="blue-btn-image" onClick={() => clearForm('projects')}>CLEAR</IonButton>
                  </div>
                </div>
              </IonCol>
            </IonRow>
          </IonGrid>
        )}

        {/* TAB 2: MAPPING */}
        {tab === "mapping" && (
          <div className="section-container">
            <div className="mapping-top-buttons">
              <IonButton className="blue-btn-image" onClick={saveMapping}>SAVE</IonButton>
              <IonButton className="blue-btn-image" onClick={() => clearForm('mapping')}>CLEAR</IonButton>
            </div>

            <IonRow className="mapping-grid-row">
              {/* Clients Table */}
              <IonCol size="12" size-md="6">
                <div className="mapping-panel">
                  <IonRadioGroup value={selectedClientID_Map} onIonChange={(e) => loadMappedProjects(e.detail.value)}>
                    <table className="mapping-table">
                      <thead>
                        <tr>
                          <th>Client_Id</th>
                          <th>Client_Name</th>
                          <th className="center-text">Select</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientMappingList.map((client, index) => (
                          <tr key={index} onClick={() => loadMappedProjects(client[0])} className={selectedClientID_Map === client[0] ? 'row-selected' : ''}>
                            <td>{client[0]}</td>
                            <td>{client[1]}</td>
                            <td className="center-text">
                              <IonRadio value={client[0]} className="mapping-radio" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </IonRadioGroup>
                </div>
              </IonCol>

              {/* Projects Table */}
              <IonCol size="12" size-md="6">
                <div className="mapping-panel">
                  <table className="mapping-table">
                    <thead>
                      <tr>
                        <th className="center-text">Select</th>
                        <th>P_ID</th>
                        <th>Project</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectMappingList.map((project, index) => (
                        <tr key={index} onClick={() => toggleProjectMapping(project[0].toString())}>
                          <td className="center-text">
                            <IonCheckbox
                              checked={selectedProjectIDs_Map.includes(project[0].toString())}
                              onIonChange={() => toggleProjectMapping(project[0].toString())}
                              className="mapping-checkbox"
                            />
                          </td>
                          <td>{project[0]}</td>
                          <td>{project[1]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </IonCol>
            </IonRow>
          </div>
        )}

        {/* TAB 3: CLIENT DETAILS */}
        {tab === "details" && (
          <div className="section-container">
            <h3 className="master-title">Client Details</h3>
            <IonRow className="dropdown-row-notched">
              <IonCol size="12" size-md="6">
                <div className="notched-input-container">
                  <label className="notched-label">Client Name*</label>
                  <IonItem lines="none" className="notched-item">
                    <IonSelect
                      placeholder="Select Client"
                      value={selectedCID_Details}
                      onIonChange={(e) => loadProjectSources(e.detail.value)}
                      interface="popover"
                      className="image-select-notched"
                    >
                      {clientSourcesList.map((c, i) => (
                        <IonSelectOption key={i} value={c[0]}>{c[1]}</IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                </div>
              </IonCol>
              <IonCol size="12" size-md="6">
                <div className="notched-input-container">
                  <label className="notched-label">Project Name*</label>
                  <IonItem lines="none" className="notched-item">
                    <IonSelect
                      placeholder="Select Project"
                      value={selectedPID_Details}
                      onIonChange={(e) => loadClientUserDetails(e.detail.value)}
                      disabled={!selectedCID_Details}
                      interface="popover"
                      className="image-select-notched"
                    >
                      {projectSourcesList.map((p, i) => (
                        <IonSelectOption key={i} value={p[0]}>{p[1]}</IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                </div>
              </IonCol>
            </IonRow>

            <h3 className="master-title" style={{ marginTop: '30px' }}>Project User Details</h3>
            <IonGrid>
              {[1, 2, 3, 4].map((num) => (
                <IonRow key={num} className="user-detail-row-image">
                  <IonCol size="2" className="user-label-col">
                    <b className="user-text-label">User{num}</b>
                  </IonCol>
                  <IonCol size="10">
                    <IonRow>
                      <IonCol size="12" size-md="3">
                        <IonItem lines="none" className="image-style-input">
                          <IonInput
                            placeholder="Name*"
                            value={(userDetailsForm as any)[`_U${num}_NAME`]}
                            onIonInput={(e) => setUserDetailsForm({ ...userDetailsForm, [`_U${num}_NAME`]: e.detail.value! })}
                          />
                        </IonItem>
                      </IonCol>
                      <IonCol size="12" size-md="3">
                        <IonItem lines="none" className="image-style-input">
                          <IonInput
                            placeholder="Designation*"
                            value={(userDetailsForm as any)[`_U${num}_DESIGN`]}
                            onIonInput={(e) => setUserDetailsForm({ ...userDetailsForm, [`_U${num}_DESIGN`]: e.detail.value! })}
                          />
                        </IonItem>
                      </IonCol>
                      <IonCol size="12" size-md="3">
                        <IonItem lines="none" className="image-style-input">
                          <IonInput
                            placeholder="Mobile No*"
                            value={(userDetailsForm as any)[`_U${num}_MOBILE`]}
                            onIonInput={(e) => setUserDetailsForm({ ...userDetailsForm, [`_U${num}_MOBILE`]: e.detail.value! })}
                          />
                        </IonItem>
                      </IonCol>
                      <IonCol size="12" size-md="3">
                        <IonItem lines="none" className="image-style-input">
                          <IonInput
                            placeholder="E-Mail*"
                            value={(userDetailsForm as any)[`_U${num}_EMAIL`]}
                            onIonInput={(e) => setUserDetailsForm({ ...userDetailsForm, [`_U${num}_EMAIL`]: e.detail.value! })}
                          />
                        </IonItem>
                      </IonCol>
                    </IonRow>
                  </IonCol>
                </IonRow>
              ))}
            </IonGrid>

            <div className="button-row-image-center">
              <IonButton className="blue-btn-image" onClick={saveUserDetails}>SAVE</IonButton>
              <IonButton className="blue-btn-image" onClick={() => clearForm('details')}>CLEAR</IonButton>
            </div>
          </div>
        )}
      </IonContent>

      <div className="bottom-right-actions">
        <div className="action-icon-box">
          <IonIcon icon={personOutline} />
        </div>
      </div>

      <IonLoading isOpen={showLoading} message="Saving..." onDidDismiss={() => setShowLoading(false)} />
      <IonToast isOpen={!!toastMsg} message={toastMsg} duration={3000} position="bottom" />
    </IonPage>
  );
};

export default ClientDetails;
