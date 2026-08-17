import { IonIcon } from "@ionic/react";
import { menuController } from "@ionic/core";
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

    // Close menu if open
    menuController.close("main-menu").catch(() => {
      const menu = document.querySelector("ion-menu") as HTMLIonMenuElement | null;
      if (menu) menu.close();
    });
  };

  const [isSmallScreen, setIsSmallScreen] = useState<boolean>(() => window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isTrackingPage =
    location.pathname === "/onduty-tracking" ||
    location.pathname === "/onduty tracking" ||
    location.pathname === "/ondutytracking" ||
    location.pathname.includes("onduty-tracking") ||
    location.pathname.includes("onduty tracking") ||
    location.pathname.includes("ondutytracking");

  // Hide on full-screen scanner or auth pages
  const hiddenPaths = [
    "/login",
    "/terms",
    "/privacy",
    "/account-deletion",
    "/leave-action",
    "/onduty-action",
    "/ai-attendance-scanner",
    "/security-attendance",
    "/camera",
  ];

  if (hiddenPaths.includes(location.pathname)) {
    return null;
  }

  // Hide floating tab bar on small screens only for live tracking map
  if (isTrackingPage && isSmallScreen) {
    return null;
  }

  const isHomeActive = activeTab === "/home" || activeTab === "/";
  const isRequestsActive =
    activeTab === "/requests" ||
    activeTab === "/leaverequest" ||
    activeTab === "/pending-requests" ||
    activeTab === "/adminrequests";
  const isProfileActive = activeTab === "/eprofile";
  const isWorkReportActive =
    activeTab === "/workreport" ||
    activeTab === "/adminworkreport" ||
    activeTab === "/workreport-dashboard";

  const handleMenuClick = async () => {
    try {
      await menuController.toggle("main-menu");
    } catch {
      const menu = document.querySelector("ion-menu") as HTMLIonMenuElement | null;
      if (menu) {
        const isOpen = await menu.isOpen();
        if (isOpen) {
          await menu.close();
        } else {
          await menu.open();
        }
      }
    }
  };

  return (
    <div className="floating-tab-bar" role="navigation" aria-label="Bottom Navigation">
      <div className="tab-container">
        <button
          type="button"
          aria-label="Home"
          className={`tab-item ${isHomeActive ? "active" : ""}`}
          onClick={() => handleTabClick("/home")}
        >
          <IonIcon icon={home} />
        </button>

        <button
          type="button"
          aria-label="Requests"
          className={`tab-item ${isRequestsActive ? "active" : ""}`}
          onClick={() => handleTabClick("/requests")}
        >
          <IonIcon icon={calendar} />
        </button>

        <button
          type="button"
          aria-label="Profile"
          className={`tab-item ${isProfileActive ? "active" : ""}`}
          onClick={() => handleTabClick("/eprofile")}
        >
          <IonIcon icon={person} />
        </button>

        <button
          type="button"
          aria-label="Work Report"
          className={`tab-item ${isWorkReportActive ? "active" : ""}`}
          onClick={() => handleTabClick("/workreport")}
        >
          <IonIcon icon={documentText} />
        </button>

        {/* Menu Toggle Button */}
        <button
          type="button"
          aria-label="Toggle Menu"
          className="tab-item"
          onClick={handleMenuClick}
        >
          <IonIcon icon={menuOutline} />
        </button>
      </div>
    </div>
  );
};

export default FloatingTabBar;
