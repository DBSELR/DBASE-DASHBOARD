import React, { useState, useEffect } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonIcon,
  IonLabel,
  IonGrid,
  IonRow,
  IonCol,
} from "@ionic/react";
import {
  construct,
  ticket,
  barChart,
  briefcase,
  time,
  chatbubble,
  cash,
  laptop,
  documentText,
  hammer,
  camera,
  scan,
  fileTrayStacked,
  alertCircle,
} from "ionicons/icons";
import { Geolocation } from "@capacitor/geolocation";
import axios from "axios";
import "../theme/Home.css";
import { useHistory } from "react-router-dom";

const Home: React.FC = () => {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [location, setLocation] = useState<string>("Fetching location...");
  const history = useHistory();

  useEffect(() => {
    updateTime();
    const interval = setInterval(updateTime, 1000);
    getLocation(); // Fetch location on load
    return () => clearInterval(interval);
  }, []);

  const updateTime = () => {
    const now = new Date();
    const formattedTime = now.toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setCurrentTime(formattedTime);
  };

  const getLocation = async () => {
    try {
      // Mobile: Use Capacitor Geolocation
      const permission = await Geolocation.requestPermissions();
      if (permission.location !== "granted") {
        setLocation("Location access denied.");
        return;
      }
      const coordinates = await Geolocation.getCurrentPosition();
      reverseGeocode(coordinates.coords.latitude, coordinates.coords.longitude);
    } catch (error) {
      // Web: Use Navigator Geolocation
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            reverseGeocode(position.coords.latitude, position.coords.longitude);
          },
          () => {
            setLocation("Location access denied.");
          }
        );
      } else {
        setLocation("Geolocation not supported.");
      }
    }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      if (response.data.display_name) {
        setLocation(response.data.display_name);
      } else {
        setLocation("Address not found.");
      }
    } catch (error) {
      setLocation("Error fetching address.");
    }
  };

  const [isPaused, setIsPaused] = useState(false);

  const handleMouseEnter = () => {
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonToolbar className="menu-toolbar">
            <img
              src="./images/dbase.png"
              alt="DBase Logo"
              className="menu-logo"
            />
          </IonToolbar>
        </IonToolbar>
      </IonHeader>

      {/* <div className="dashboard-header">
        <h2>Check-in: {currentTime} | Location: {location}</h2>
      </div> */}

      <IonContent className="ion-padding dashboard-page">
        <IonCard className="dashboard-header">
          <IonLabel>
            Check-in: {currentTime} | Location: {location}
          </IonLabel>
        </IonCard>

        {/* Notice Board */}
        <IonCard className="notice-board">
          <IonCardContent>
            <div className="notice-header">
              <IonIcon icon={alertCircle} className="notice-icon" />
              <IonLabel className="notice-title">Notices</IonLabel>
            </div>
            <div
              className="notice-container"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}>
              <div className={`scrolling-text ${isPaused ? "paused" : ""}`}>
                <IonLabel>🔔 Welcome to D Base Solutions Pvt.Ltd.</IonLabel>
                {/* <IonLabel>🚀 Team meeting at 4 PM today.</IonLabel>
                <IonLabel>🎉 Office party on Friday!</IonLabel>
                <IonLabel>📢 Submit your reports by the 10th.</IonLabel>
                <IonLabel>⚠️ Office closed on Monday for maintenance.</IonLabel> */}
              </div>
            </div>
          </IonCardContent>
        </IonCard>

        <IonGrid>
          <IonRow>
            <IonCol size="4" sizeMd="3">
              <IonCard className="dashboard-card tasks-card" onClick={() => history.push("/tasks")}>
                <IonCardContent className="dashboard-card-content">
                  <IonIcon icon={construct} className="dashboard-icon" />
                  <div className="dashboard-card-text">
                    <IonLabel className="dashboard-card-title">TASKS</IonLabel>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>

            {/* Tickets Card */}
            <IonCol size="4" sizeMd="3">
              <IonCard className="dashboard-card tickets-card" onClick={() => history.push("/tickets")}>
                <IonCardContent className="dashboard-card-content">
                  <IonIcon icon={ticket} className="dashboard-icon" />
                  <div className="dashboard-card-text">
                    <IonLabel className="dashboard-card-title">
                      TICKETS
                    </IonLabel>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>

            {/* Productivity Card */}
            <IonCol size="4" sizeMd="3">
              <IonCard className="dashboard-card productivity-card">
                <IonCardContent className="dashboard-card-content">
                  <IonIcon icon={barChart} className="dashboard-icon" />
                  <div className="dashboard-card-text">
                    <IonLabel className="dashboard-card-title">
                      PRODUCTIVITY
                    </IonLabel>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>

            {/* Performance Card */}
            <IonCol size="4" sizeMd="3">
              <IonCard className="dashboard-card performance-card">
                <IonCardContent className="dashboard-card-content">
                  <IonIcon icon={briefcase} className="dashboard-icon" />
                  <div className="dashboard-card-text">
                    <IonLabel className="dashboard-card-title">
                      PERFORMANCE
                    </IonLabel>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>

            {/* Punctuality Card */}
            <IonCol size="4" sizeMd="3">
              <IonCard className="dashboard-card punctuality-card">
                <IonCardContent className="dashboard-card-content">
                  <IonIcon icon={time} className="dashboard-icon" />
                  <div className="dashboard-card-text">
                    <IonLabel className="dashboard-card-title">
                      PUNCTUALITY
                    </IonLabel>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>

            {/* Requests Card */}
            <IonCol size="4" sizeMd="3">
              <IonCard className="dashboard-card requests-card" onClick={() => history.push("/leaverequest")}>
                <IonCardContent className="dashboard-card-content">
                  <IonIcon icon={chatbubble} className="dashboard-icon" />
                  <div className="dashboard-card-text">
                    <IonLabel className="dashboard-card-title">
                      REQUESTS
                    </IonLabel>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>

            {/* Transactions Card */}
            <IonCol size="4" sizeMd="3">
              <IonCard className="dashboard-card transactions-card" onClick={() => history.push("/transactions/0")}>
                <IonCardContent className="dashboard-card-content">
                  <IonIcon icon={cash} className="dashboard-icon" />
                  <div className="dashboard-card-text">
                    <IonLabel className="dashboard-card-title">
                      TRANSACTIONS
                    </IonLabel>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>

            {/* Stock Card */}
            <IonCol size="4" sizeMd="3">
              <IonCard className="dashboard-card stock-card">
                <IonCardContent className="dashboard-card-content">
                  <IonIcon icon={fileTrayStacked} className="dashboard-icon" />
                  <div className="dashboard-card-text">
                    <IonLabel className="dashboard-card-title">STOCK</IonLabel>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>

            {/* Invoice Card */}
            <IonCol size="4" sizeMd="3">
              <IonCard className="dashboard-card invoice-card" onClick={() => history.push("/invoices")}>
                <IonCardContent className="dashboard-card-content">
                  <IonIcon icon={documentText} className="dashboard-icon" />
                  <div className="dashboard-card-text">
                    <IonLabel className="dashboard-card-title">
                      INVOICE
                    </IonLabel>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>

            {/* Maintenance Card */}
            <IonCol size="4" sizeMd="3">
              <IonCard className="dashboard-card maintenance-card">
                <IonCardContent className="dashboard-card-content">
                  <IonIcon icon={hammer} className="dashboard-icon" />
                  <div className="dashboard-card-text">
                    <IonLabel className="dashboard-card-title">
                      MAINTENANCE
                    </IonLabel>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>

            <IonCol size="4" sizeMd="3">
              <IonCard
                className="dashboard-card camera-card"
                onClick={() => history.push("/camera")}
              >
                <IonCardContent className="dashboard-card-content">
                  <IonIcon icon={scan} className="dashboard-icon" />
                  <div className="dashboard-card-text">
                    <IonLabel className="dashboard-card-title">
                      SCANNER
                    </IonLabel>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>
      </IonContent>
    </IonPage>
  );
};

export default Home;
