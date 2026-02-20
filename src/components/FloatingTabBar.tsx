import { IonIcon, IonMenu } from "@ionic/react";
import {
  home,
  calendar,
  documentText,
  menuOutline,
  person,
} from "ionicons/icons";
import { useHistory, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import "../theme/Common.css";

const FloatingTabBar: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.pathname);

  // Update active tab dynamically when location changes
  useEffect(() => {
    setActiveTab(location.pathname);
  }, [location.pathname]);

  // Function to handle tab click and close menu
  const handleTabClick = (path: string) => {
    history.push(path);

    // Close menu after navigation
    const menu = document.querySelector(
      "ion-menu"
    ) as HTMLIonMenuElement | null;
    if (menu) {
      menu.close();
    }
  };

  return (
    <div className="floating-tab-bar">
      <div className="tab-container">
        <button
          className={`tab-item ${activeTab === "/home" ? "active" : ""}`}
          onClick={() => handleTabClick("/home")}
        >
          <IonIcon icon={home} />
        </button>

        <button
          className={`tab-item ${
            activeTab === "/adminrequests" ? "active" : ""
          }`}
          onClick={() => handleTabClick("/leaverequest")}
        >
          <IonIcon icon={calendar} />
        </button>

        <button
          className={`tab-item ${activeTab === "/eprofile" ? "active" : ""}`}
          onClick={() => handleTabClick("/eprofile")}
        >
          <IonIcon icon={person} />
        </button>

        <button
          className={`tab-item ${activeTab === "/workreport" ? "active" : ""}`}
          onClick={() => handleTabClick("/workreport")}
        >
          <IonIcon icon={documentText} />
        </button>

        {/* Menu Button */}
        <button
          className="tab-item"
          onClick={() => {
            const menu = document.querySelector(
              "ion-menu"
            ) as HTMLIonMenuElement | null;
            if (menu) {
              menu.isOpen().then((isOpen) => {
                if (isOpen) {
                  menu.close(); // Close if open
                } else {
                  menu.open(); // Open if closed
                }
              });
            }
          }}
        >
          <IonIcon icon={menuOutline} />
        </button>
      </div>
    </div>
  );
};

export default FloatingTabBar;
