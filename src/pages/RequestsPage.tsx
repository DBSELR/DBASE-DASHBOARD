import React, { useState, useEffect } from "react";
import { IonPage, IonContent, IonSegment, IonSegmentButton, IonLabel } from "@ionic/react";
import RequestContainer from "../components/requests/RequestContainer";
import { apiService } from "../utils/apiService";
import "./RequestsPage.css";

const RequestsPage: React.FC = () => {
  const [type, setType] = useState("leave");
  const [view, setView] = useState<"my" | "raised">("my");
  const [rasList, setRasList] = useState<any[]>([]);

  const userData = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    loadRasList();
  }, []);

  const loadRasList = async () => {
    try {
      const data = await apiService.loadRAS();
      setRasList(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading RAS list:", error);
      setRasList([]);
    }
  };

  const canViewTeamRequests = () => {
    const designation = (userData.designation || userData.Designation || "")
      .toString()
      .trim()
      .toLowerCase();

    if (!designation || !rasList.length) return false;

    return rasList.some((ras: any) =>
      (ras?.name || "").toString().trim().toLowerCase() === designation
    );
  };

  return (
    <IonPage>
     <IonContent className="page-content">
        {/* TYPE SEGMENT */}
        <IonSegment value={type} onIonChange={(e) => setType(e.detail.value as any)}>
          <IonSegmentButton value="leave"><IonLabel>Leave</IonLabel></IonSegmentButton>
          <IonSegmentButton value="permission"><IonLabel>Permission</IonLabel></IonSegmentButton>
          <IonSegmentButton value="equipment"><IonLabel>Equipment</IonLabel></IonSegmentButton>
          <IonSegmentButton value="onduty"><IonLabel>On Duty</IonLabel></IonSegmentButton>
          <IonSegmentButton value="overtime"><IonLabel>Overtime</IonLabel></IonSegmentButton>
        </IonSegment>

        {/* VIEW SEGMENT */}
        <IonSegment value={view} onIonChange={(e) => setView(e.detail.value as any)}>
          <IonSegmentButton value="my">
            <IonLabel>My Requests</IonLabel>
          </IonSegmentButton>
          {canViewTeamRequests() && (
            <IonSegmentButton value="raised">
              <IonLabel>Team Requests</IonLabel>
            </IonSegmentButton>
          )}
        </IonSegment>

        <RequestContainer key={type} type={type} view={view} />
      </IonContent>
    </IonPage>
  );
};

export default RequestsPage;