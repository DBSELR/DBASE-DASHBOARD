import React, { useState, useEffect } from "react";
import { IonPage, IonContent, IonIcon } from "@ionic/react";
import { 
  calendarOutline, 
  timeOutline, 
  cubeOutline, 
  locationOutline, 
  alarmOutline,
  personOutline,
  peopleOutline 
} from "ionicons/icons";
import RequestContainer from "../components/requests/RequestContainer";
import { apiService } from "../utils/apiService";
import "./RequestsPage.css";
import "../components/requests/RequestList.css";

const TYPES = [
  { value: "leave",      label: "Leave",      icon: calendarOutline },
  { value: "permission", label: "Permission", icon: timeOutline },
  { value: "equipment",  label: "Equipment",  icon: cubeOutline },
  { value: "onduty",     label: "On Duty",     icon: locationOutline },
  { value: "overtime",   label: "Overtime",    icon: alarmOutline },
];

const RequestsPage: React.FC = () => {
  const [type, setType] = useState("leave");
  const [view, setView] = useState<"my" | "raised">("my");
  const [rasList, setRasList] = useState<any[]>([]);

  const userData = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => { loadRasList(); }, []);

  const loadRasList = async () => {
    try {
      const data = await apiService.loadRAS();
      setRasList(Array.isArray(data) ? data : []);
    } catch {
      setRasList([]);
    }
  };

  const canViewTeam = () => {
    const des = (userData.designation || userData.Designation || "").toString().trim().toLowerCase();
    if (!des || !rasList.length) return false;
    return rasList.some((r: any) => (r?.name || "").toString().trim().toLowerCase() === des);
  };

  return (
    <IonPage>
      <IonContent className="page-content">

        {/* ── Type Tabs ── */}
        <div className="req-type-tabs">
          {TYPES.map((t) => (
            <button
              key={t.value}
              className={`req-tab${type === t.value ? " active" : ""}`}
              onClick={() => { setType(t.value); setView("my"); }}
            >
              <IonIcon icon={t.icon} className="tab-icon" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── View Toggle ── */}
        <div className="req-view-tabs">
          <button
            className={`req-tab${view === "my" ? " active" : ""}`}
            onClick={() => setView("my")}
          >
            <IonIcon icon={personOutline} className="tab-icon" />
            <span>My Requests</span>
          </button>
          {canViewTeam() && (
            <button
              className={`req-tab${view === "raised" ? " active" : ""}`}
              onClick={() => setView("raised")}
            >
              <IonIcon icon={peopleOutline} className="tab-icon" />
              <span>Team Requests</span>
            </button>
          )}
        </div>

        <RequestContainer key={type} type={type} view={view} />

      </IonContent>
    </IonPage>
  );
};

export default RequestsPage;