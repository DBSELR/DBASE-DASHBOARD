import React, { useState, useEffect } from "react";
import { IonPage, IonContent, IonIcon } from "@ionic/react";
import { useHistory } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
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
  { value: "leave", label: "Leave", icon: calendarOutline },
  { value: "permission", label: "Permission", icon: timeOutline },
  { value: "equipment", label: "Equipment", icon: cubeOutline },
  { value: "onduty", label: "On Duty", icon: locationOutline },
  { value: "overtime", label: "Overtime", icon: alarmOutline },
];

const RequestsPage: React.FC = () => {
  const history = useHistory();
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

  // Worked out once, because the container needs to know it too: someone
  // with no Team Requests tab still has to be shown work that is waiting
  // on them, or it would be waiting somewhere they cannot look.
  const showTeam = canViewTeam();

  return (
    <IonPage>
      <IonContent className="page-content">

        {/* ── Premium Header ── */}
        <div className="page-wr-header" style={{ margin: '16px 16px 4px 16px' }}>
          <div className="page-wr-header-left">
            <button className="page-wr-back-btn" onClick={() => history.goBack()} style={{ color: 'white' }}>
              <ChevronLeft size={22} />
            </button>
            <div>
              <h1 className="page-wr-title">My Requests</h1>
              <p className="page-wr-subtitle">Manage all your HR requests</p>
            </div>
          </div>
          <div className="page-wr-header-right">
            <div className="page-wr-header-icon-box">
              <IonIcon icon={calendarOutline} style={{ color: 'var(--ion-color-primary)', fontSize: '24px' }} />
            </div>
          </div>
        </div>

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
          {showTeam && (
            <button
              className={`req-tab${view === "raised" ? " active" : ""}`}
              onClick={() => setView("raised")}
            >
              <IonIcon icon={peopleOutline} className="tab-icon" />
              <span>Team Requests</span>
            </button>
          )}
        </div>

        <RequestContainer key={type} type={type} view={view} hasTeamTab={showTeam} />

      </IonContent>
    </IonPage>
  );
};

export default RequestsPage;