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
import { personOutline, businessOutline } from "ionicons/icons";
import { ChevronLeft } from "lucide-react";
import { useHistory } from "react-router-dom";

import ClientMapping from "./ClientMapping";
import ClientProjectUsers from "./ClientProjectUsers";

import "./WorkReports.css";
import "./Stock.css";

const ClientDetails: React.FC = () => {
  const history = useHistory();
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
      <IonContent className="page-content">
        <div className="wr-container stock-container" style={{ padding: 0, minHeight: 'auto', backgroundColor: 'transparent' }}>
          
          {/* ── Premium Header ── */}
          <div className="page-wr-header" style={{ margin: '16px', borderRadius: '16px', padding: '16px' }}>
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()}>
                <ChevronLeft size={22} color="white" />
              </button>
              <div>
                <h1 className="page-wr-title">Client Dashboard</h1>
                <p className="page-wr-subtitle">Manage clients and projects</p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <div className="page-wr-header-icon-box">
                <IonIcon icon={businessOutline} style={{ color: 'var(--ion-color-primary)', fontSize: '24px' }} />
              </div>
            </div>
          </div>

          <div className="stock-panel" style={{ margin: '0 16px 20px 16px', padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
            
            {/* Tabs */}
            <div className="stock-tabs" style={{ marginBottom: '16px' }}>
              <button
                type="button"
                className={`stock-tab ${activeTab === "projects" ? "active" : ""}`}
                onClick={() => setActiveTab("projects")}
              >
                Projects & Clients
              </button>
              <button
                type="button"
                className={`stock-tab ${activeTab === "mapping" ? "active" : ""}`}
                onClick={() => setActiveTab("mapping")}
              >
                Mapping
              </button>
              <button
                type="button"
                className={`stock-tab ${activeTab === "clientdetails" ? "active" : ""}`}
                onClick={() => setActiveTab("clientdetails")}
              >
                Client Details
              </button>
            </div>

            {/* PROJECTS TAB */}
            {activeTab === "projects" && (
              <div className="stock-entry-layout">
                {/* LEFT COLUMN: Project Master */}
                <div className="stock-panel">
                  <h3 className="stock-section-heading">Project Master</h3>
                  
                  <div className="stock-field" style={{ marginBottom: '16px' }}>
                    <label>Project Name*</label>
                    <input
                      type="text"
                      className="stock-input"
                      placeholder="Enter Project Name"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button className="stock-button" style={{ flex: 1 }} onClick={saveProjectMaster}>
                      Save
                    </button>
                    <button className="stock-button stock-button--secondary" style={{ flex: 1 }} onClick={() => setNewProjectName("")}>
                      Clear
                    </button>
                  </div>

                  <div className="stock-table-wrapper" style={{ maxHeight: '300px', minHeight: 'auto' }}>
                    <table className="stock-table">
                      <thead>
                        <tr>
                          <th style={{ width: "30%" }}>P_ID</th>
                          <th style={{ width: "70%" }}>Project Name</th>
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

                {/* RIGHT COLUMN: Client Master */}
                <div className="stock-panel">
                  <h3 className="stock-section-heading">Client Master</h3>

                  <div className="stock-grid" style={{ marginBottom: '24px' }}>
                    <div className="stock-field">
                      <label>Client Type*</label>
                      <select
                        className="stock-select"
                        value={clientMasterForm._ClientType}
                        onChange={(e) => setClientMasterForm({ ...clientMasterForm, _ClientType: e.target.value })}
                      >
                        <option value="Client">Client</option>
                        <option value="Party">Party</option>
                      </select>
                    </div>

                    <div className="stock-field">
                      <label>Client Name*</label>
                      <input
                        type="text"
                        className="stock-input"
                        placeholder="Enter Client Name"
                        value={clientMasterForm._ClientName}
                        onChange={(e) => setClientMasterForm({ ...clientMasterForm, _ClientName: e.target.value })}
                      />
                    </div>

                    <div className="stock-field">
                      <label>Client Location*</label>
                      <input
                        type="text"
                        className="stock-input"
                        placeholder="Enter Location"
                        value={clientMasterForm._ClientLocation}
                        onChange={(e) => setClientMasterForm({ ...clientMasterForm, _ClientLocation: e.target.value })}
                      />
                    </div>
                  </div>

                  {[1, 2, 3].map((num) => (
                    <div key={num} style={{ marginBottom: '24px' }}>
                      <h4 className="stock-subheading" style={{ color: 'var(--stock-muted)', borderBottom: '1px solid var(--stock-border)', paddingBottom: '8px', marginBottom: '16px' }}>
                        Administration Details {num}
                      </h4>
                      <div className="stock-grid">
                        <div className="stock-field">
                          <label>Name</label>
                          <input
                            type="text"
                            className="stock-input"
                            placeholder="Enter Name"
                            value={(clientMasterForm as any)[`_P${num}_NAME`]}
                            onChange={(e) => setClientMasterForm({ ...clientMasterForm, [`_P${num}_NAME`]: e.target.value })}
                          />
                        </div>
                        <div className="stock-field">
                          <label>Designation</label>
                          <input
                            type="text"
                            className="stock-input"
                            placeholder="Enter Designation"
                            value={(clientMasterForm as any)[`_P${num}_DESIGN`]}
                            onChange={(e) => setClientMasterForm({ ...clientMasterForm, [`_P${num}_DESIGN`]: e.target.value })}
                          />
                        </div>
                        <div className="stock-field">
                          <label>Mobile No</label>
                          <input
                            type="text"
                            className="stock-input"
                            placeholder="Enter Mobile"
                            value={(clientMasterForm as any)[`_P${num}_MOBILE`]}
                            onChange={(e) => setClientMasterForm({ ...clientMasterForm, [`_P${num}_MOBILE`]: e.target.value })}
                          />
                        </div>
                        <div className="stock-field">
                          <label>E-Mail</label>
                          <input
                            type="email"
                            className="stock-input"
                            placeholder="Enter E-Mail"
                            value={(clientMasterForm as any)[`_P${num}_EMAIL`]}
                            onChange={(e) => setClientMasterForm({ ...clientMasterForm, [`_P${num}_EMAIL`]: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                    <button className="stock-button stock-button--secondary" onClick={clearForm}>
                      Clear Form
                    </button>
                    <button className="stock-button" onClick={saveClientMaster}>
                      Save Client
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MAPPING TAB */}
            {activeTab === "mapping" && <ClientMapping />}

            {/* CLIENT DETAILS TAB */}
            {activeTab === "clientdetails" && <ClientProjectUsers />}
          
          </div>
        </div>

        {/* LOADING */}
        <IonLoading isOpen={showLoading} message="Saving..." />

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