// src/pages/ClientMapping.tsx

import {
  IonButton,
  IonRow,
  IonCol,
  IonCheckbox,
  IonRadio,
  IonRadioGroup,
  IonToast,
  IonLoading,
  IonIcon,
} from "@ionic/react";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";
import { personOutline } from "ionicons/icons";

import "./ClientDetails.css";

const ClientMapping: React.FC = () => {
  const [showLoading, setShowLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // ======================================================
  // STATES
  // ======================================================

  const [clientMappingList, setClientMappingList] = useState<any[]>([]);
  const [projectMappingList, setProjectMappingList] = useState<any[]>([]);

  const [selectedClientID, setSelectedClientID] =
    useState<string>("");

  const [selectedProjectIDs, setSelectedProjectIDs] =
    useState<string[]>([]);

  // ======================================================
  // INITIAL LOAD
  // ======================================================

  useEffect(() => {
    loadMappingData();
  }, []);

  // ======================================================
  // TOAST
  // ======================================================

  const showToast = (msg: string) => {
    setToastMsg(msg);

    setTimeout(() => {
      setToastMsg("");
    }, 3000);
  };

  // ======================================================
  // LOAD DATA
  // ======================================================

  const loadMappingData = async () => {
    try {
      const clientRes = await axios.get(
        `${API_BASE}Sources/Load_Clients_Mapping`
      );

      const projectRes = await axios.get(
        `${API_BASE}Sources/Load_Project_Mapping`
      );

      setClientMappingList(clientRes.data || []);
      setProjectMappingList(projectRes.data || []);
    } catch (error) {
      console.error(error);

      showToast("Failed to load mapping data");
    }
  };

  // ======================================================
  // LOAD MAPPED PROJECTS
  // ======================================================

  const loadMappedProjects = async (clientId: string) => {
    setSelectedClientID(clientId);

    try {
      const res = await axios.get(
        `${API_BASE}Sources/Load_Client_Mapped_Projects?ClientID=${clientId}`
      );

      const mappedIds = (res.data || []).map(
        (item: any) => item[0].toString()
      );

      setSelectedProjectIDs(mappedIds);
    } catch (error) {
      console.error(error);

      showToast("Failed to load mapped projects");
    }
  };

  // ======================================================
  // TOGGLE PROJECT
  // ======================================================

  const toggleProject = (projectId: string) => {
    setSelectedProjectIDs((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  // ======================================================
  // SAVE MAPPING
  // ======================================================

  const saveMapping = async () => {
    if (!selectedClientID) {
      return showToast("Please select client");
    }
    if (selectedProjectIDs.length === 0) {
      return showToast("Please select at least one project");
    }

    setShowLoading(true);

    try {
      const res = await axios.post(
        `${API_BASE}Sources/Save_Client_Project_Mapping`,
        {
          _ClientID: selectedClientID,
          _ProjectIDs: selectedProjectIDs.join(",") + ",",
          _ClientName: "0",
          _ProjectName: "0",
          _PrjectName: "0",
        }
      );

      if (res.data === "Department Save successfully" || Number(res.data) > 0) {
        showToast("Mapping Saved Successfully");
      } else {
        showToast(String(res.data) || "Error saving mapping");
      }
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.response?.data || error.message || "Error saving mapping";
      showToast(errorMsg);
    }

    setShowLoading(false);
  };

  // ======================================================
  // CLEAR
  // ======================================================

  const clearForm = () => {
    setSelectedClientID("");
    setSelectedProjectIDs([]);
  };

  // ======================================================
  // UI
  // ======================================================

  return (
    <div className="tab-content-wrapper">
      <div className="section-container">
        {/* ============================================= */}
        {/* BUTTONS */}
        {/* ============================================= */}

        <div className="mapping-top-buttons">
          <IonButton
            className="blue-btn-image"
            onClick={saveMapping}
          >
            SAVE
          </IonButton>

          <IonButton
            className="blue-btn-image"
            onClick={clearForm}
          >
            CLEAR
          </IonButton>
        </div>

        {/* ============================================= */}
        {/* TABLES */}
        {/* ============================================= */}

        <IonRow className="mapping-grid-row">
          {/* ========================================= */}
          {/* CLIENTS TABLE */}
          {/* ========================================= */}

          <IonCol size="12" size-md="6">
            <div className="mapping-panel">
              <IonRadioGroup
                value={selectedClientID}
                onIonChange={(e) =>
                  loadMappedProjects(e.detail.value)
                }
              >
                <table className="mapping-table">
                  <thead>
                    <tr>
                      <th>Client_Id</th>
                      <th>Client_Name</th>
                      <th className="center-text">
                        Select
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {clientMappingList.map(
                      (client, index) => (
                        <tr
                          key={index}
                          onClick={() =>
                            loadMappedProjects(
                              client[0]
                            )
                          }
                          className={
                            selectedClientID ===
                              client[0]
                              ? "row-selected"
                              : ""
                          }
                        >
                          <td>{client[0]}</td>

                          <td>{client[1]}</td>

                          <td className="center-text">
                            <IonRadio
                              value={client[0]}
                              className="mapping-radio"
                            />
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </IonRadioGroup>
            </div>
          </IonCol>

          {/* ========================================= */}
          {/* PROJECTS TABLE */}
          {/* ========================================= */}

          <IonCol size="12" size-md="6">
            <div className="mapping-panel">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th className="center-text">
                      Select
                    </th>

                    <th>P_ID</th>

                    <th>Project</th>
                  </tr>
                </thead>

                <tbody>
                  {projectMappingList.map(
                    (project, index) => (
                      <tr
                        key={index}
                        onClick={() =>
                          toggleProject(
                            project[0].toString()
                          )
                        }
                      >
                        <td className="center-text">
                          <IonCheckbox
                            checked={selectedProjectIDs.includes(
                              project[0].toString()
                            )}
                            onIonChange={() =>
                              toggleProject(
                                project[0].toString()
                              )
                            }
                            className="mapping-checkbox"
                          />
                        </td>

                        <td>{project[0]}</td>

                        <td>{project[1]}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </IonCol>
        </IonRow>
      </div>

      {/* ============================================= */}
      {/* FLOATING ICON */}
      {/* ============================================= */}

      <div className="bottom-right-actions">
        <div className="action-icon-box">
          <IonIcon icon={personOutline} />
        </div>
      </div>

      {/* ============================================= */}
      {/* LOADING */}
      {/* ============================================= */}

      <IonLoading
        isOpen={showLoading}
        message="Saving..."
        onDidDismiss={() => setShowLoading(false)}
      />

      {/* ============================================= */}
      {/* TOAST */}
      {/* ============================================= */}

      <IonToast
        isOpen={!!toastMsg}
        message={toastMsg}
        duration={3000}
        position="bottom"
      />
    </div>
  );
};

export default ClientMapping;