// src/pages/ClientProjectUsers.tsx

import {
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
import "./ClientDetails.css";

const ClientProjectUsers: React.FC = () => {

    const [showLoading, setShowLoading] = useState(false);
    const [toastMsg, setToastMsg] = useState("");

    // Dropdown Lists
    const [clientSourcesList, setClientSourcesList] = useState<any[]>([]);
    const [projectSourcesList, setProjectSourcesList] = useState<any[]>([]);

    // Selected Names
    const [selectedClientName, setSelectedClientName] = useState("");
    const [selectedProjectName, setSelectedProjectName] = useState("");

    // Get Client ID
    const getClientID = (name: string) =>
        clientSourcesList.find(
            (c) =>
                String(c[1]).trim().toUpperCase() ===
                String(name).trim().toUpperCase()
        )?.[0] || "";

    // Get Project ID
    const getProjectID = (name: string) =>
        projectSourcesList.find(
            (p) =>
                String(p[1]).trim().toUpperCase() ===
                String(name).trim().toUpperCase()
        )?.[0] || "";

    // Form State
    const [userDetailsForm, setUserDetailsForm] = useState<any>({
        _U1_NAME: "",
        _U1_DESIGN: "",
        _U1_MOBILE: "",
        _U1_EMAIL: "",

        _U2_NAME: "",
        _U2_DESIGN: "",
        _U2_MOBILE: "",
        _U2_EMAIL: "",

        _U3_NAME: "",
        _U3_DESIGN: "",
        _U3_MOBILE: "",
        _U3_EMAIL: "",

        _U4_NAME: "",
        _U4_DESIGN: "",
        _U4_MOBILE: "",
        _U4_EMAIL: "",
    });

    useEffect(() => {
        loadClientSources();
    }, []);

    // Toast
    const showToast = (msg: string) => {
        setToastMsg(msg);

        setTimeout(() => {
            setToastMsg("");
        }, 3000);
    };

    // Load Clients
    const loadClientSources = async () => {

        try {

            const res = await axios.get(
                `${API_BASE}Sources/Load_Clients_Sources`
            );

            console.log("Clients =", res.data);

            setClientSourcesList(res.data || []);

        } catch (e) {

            console.error("Client Load Error =", e);
        }
    };

    // Load Projects
    const loadProjectSourcesByName = async (clientName: string) => {

        setSelectedClientName(clientName);
        setSelectedProjectName("");

        clearForm();

        const cid = getClientID(clientName);

        console.log("Selected Client =", clientName);
        console.log("Client ID =", cid);

        if (!cid) {
            showToast("Client ID not found");
            return;
        }

        try {

            const res = await axios.get(
                `${API_BASE}Sources/Load_Project_Sources?CID=${cid}`
            );

            console.log("Projects =", res.data);

            setProjectSourcesList(res.data || []);

        } catch (e) {

            console.error("Project Load Error =", e);
        }
    };

    // Load Existing User Details
    const loadClientUserDetailsByName = async (projectName: string) => {

        setSelectedProjectName(projectName);

        const cid = getClientID(selectedClientName);
        const pid = getProjectID(projectName);

        console.log("Selected Project =", projectName);
        console.log("CID =", cid);
        console.log("PID =", pid);

        if (!cid || !pid) {
            showToast("Invalid Client or Project");
            return;
        }

        try {

            const res = await axios.get(
                `${API_BASE}Sources/Load_Client_User_Details?CID=${cid}&PID=${pid}`
            );

            console.log("User Details =", res.data);

            if (res.data && res.data.length > 0) {

                const d = res.data[0];

                setUserDetailsForm({

                    _U1_NAME: d[0] || "",
                    _U1_DESIGN: d[1] || "",
                    _U1_MOBILE: d[2] || "",
                    _U1_EMAIL: d[3] || "",

                    _U2_NAME: d[4] || "",
                    _U2_DESIGN: d[5] || "",
                    _U2_MOBILE: d[6] || "",
                    _U2_EMAIL: d[7] || "",

                    _U3_NAME: d[8] || "",
                    _U3_DESIGN: d[9] || "",
                    _U3_MOBILE: d[10] || "",
                    _U3_EMAIL: d[11] || "",

                    _U4_NAME: d[12] || "",
                    _U4_DESIGN: d[13] || "",
                    _U4_MOBILE: d[14] || "",
                    _U4_EMAIL: d[15] || "",
                });

            } else {

                clearForm();
            }

        } catch (e) {

            console.error("Load User Details Error =", e);
            clearForm();
        }
    };

    // Save User Details
    const saveUserDetails = async () => {

        const cid = getClientID(selectedClientName);
        const pid = getProjectID(selectedProjectName);

        console.log("Selected Client =", selectedClientName);
        console.log("Selected Project =", selectedProjectName);
        console.log("CID =", cid);
        console.log("PID =", pid);

        if (!cid) {
            showToast("Please Select Client");
            return;
        }

        if (!pid) {
            showToast("Please Select Project");
            return;
        }

        setShowLoading(true);

        try {

            // Payload
            const payload: any = {

                _ClientID: cid,
                _ProjectID: pid,
                _ProjectIDs: `${pid},`
            };

            // Add Users
            [1, 2, 3, 4].forEach((num) => {

                payload[`_U${num}_NAME`] =
                    userDetailsForm[`_U${num}_NAME`]?.trim() || "0";

                payload[`_U${num}_DESIGN`] =
                    userDetailsForm[`_U${num}_DESIGN`]?.trim() || "0";

                payload[`_U${num}_MOBILE`] =
                    userDetailsForm[`_U${num}_MOBILE`]?.trim() || "0";

                payload[`_U${num}_EMAIL`] =
                    userDetailsForm[`_U${num}_EMAIL`]?.trim() || "0";
            });

            console.log("Saving Payload =", payload);

            const res = await axios.post(
                `${API_BASE}Sources/Save_Client_User_Details`,
                payload
            );

            console.log("Save Response =", res.data);

            if (
                res.data &&
                res.data !== "0" &&
                res.data !== 0
            ) {

                showToast("User Details Saved Successfully");

                // Reload saved data
                loadClientUserDetailsByName(selectedProjectName);

            } else {

                showToast("Error Saving User Details");
            }

        } catch (e: any) {

            console.error("Save Error =", e);

            showToast(
                e?.response?.data ||
                e?.message ||
                "Save Failed"
            );
        }

        setShowLoading(false);
    };

    // Clear Form
    const clearForm = () => {

        setUserDetailsForm({

            _U1_NAME: "",
            _U1_DESIGN: "",
            _U1_MOBILE: "",
            _U1_EMAIL: "",

            _U2_NAME: "",
            _U2_DESIGN: "",
            _U2_MOBILE: "",
            _U2_EMAIL: "",

            _U3_NAME: "",
            _U3_DESIGN: "",
            _U3_MOBILE: "",
            _U3_EMAIL: "",

            _U4_NAME: "",
            _U4_DESIGN: "",
            _U4_MOBILE: "",
            _U4_EMAIL: "",
        });
    };

    return (
        <div className="tab-content-wrapper" style={{ padding: '0 16px', background: 'transparent' }}>
      <div className="stock-panel">
        <h3 className="stock-section-heading" style={{ marginBottom: '24px' }}>Project User Details</h3>

        {/* Dropdowns */}
        <div className="stock-grid" style={{ marginBottom: '24px' }}>
          {/* Client */}
          <div className="stock-field">
            <label>Client Name*</label>
            <select
              className="stock-select"
              value={selectedClientName}
              onChange={(e) => loadProjectSourcesByName(e.target.value)}
            >
              <option value="">Select Client</option>
              {clientSourcesList.map((c, i) => (
                <option key={i} value={c[1]}>
                  {c[1]}
                </option>
              ))}
            </select>
          </div>

          {/* Project */}
          <div className="stock-field">
            <label>Project Name*</label>
            <select
              className="stock-select"
              value={selectedProjectName}
              onChange={(e) => loadClientUserDetailsByName(e.target.value)}
              disabled={!selectedClientName}
            >
              <option value="">Select Project</option>
              {projectSourcesList.map((p, i) => (
                <option key={i} value={p[1]}>
                  {p[1]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* User Details */}
        {[1, 2, 3, 4].map((num) => (
          <div key={num} style={{ marginBottom: '24px' }}>
            <h4 className="stock-subheading" style={{ color: 'var(--stock-muted)', borderBottom: '1px solid var(--stock-border)', paddingBottom: '8px', marginBottom: '16px' }}>
              User {num}
            </h4>
            <div className="stock-grid">
              <div className="stock-field">
                <label>Name</label>
                <input
                  type="text"
                  className="stock-input"
                  placeholder="Enter Name"
                  value={userDetailsForm[`_U${num}_NAME`]}
                  onChange={(e) => setUserDetailsForm({ ...userDetailsForm, [`_U${num}_NAME`]: e.target.value })}
                />
              </div>
              <div className="stock-field">
                <label>Designation</label>
                <input
                  type="text"
                  className="stock-input"
                  placeholder="Enter Designation"
                  value={userDetailsForm[`_U${num}_DESIGN`]}
                  onChange={(e) => setUserDetailsForm({ ...userDetailsForm, [`_U${num}_DESIGN`]: e.target.value })}
                />
              </div>
              <div className="stock-field">
                <label>Mobile No</label>
                <input
                  type="text"
                  className="stock-input"
                  placeholder="Enter Mobile"
                  value={userDetailsForm[`_U${num}_MOBILE`]}
                  onChange={(e) => setUserDetailsForm({ ...userDetailsForm, [`_U${num}_MOBILE`]: e.target.value })}
                />
              </div>
              <div className="stock-field">
                <label>E-Mail</label>
                <input
                  type="email"
                  className="stock-input"
                  placeholder="Enter E-Mail"
                  value={userDetailsForm[`_U${num}_EMAIL`]}
                  onChange={(e) => setUserDetailsForm({ ...userDetailsForm, [`_U${num}_EMAIL`]: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <button className="stock-button stock-button--secondary" onClick={clearForm}>
            Clear Form
          </button>
          <button className="stock-button" onClick={saveUserDetails}>
            Save User Details
          </button>
        </div>
      </div>

            {/* Loading */}
            <IonLoading
                isOpen={showLoading}
                message="Saving..."
                onDidDismiss={() => setShowLoading(false)}
            />

            {/* Toast */}
            <IonToast
                isOpen={!!toastMsg}
                message={toastMsg}
                duration={3000}
                position="bottom"
            />

        </div>
    );
};

export default ClientProjectUsers;