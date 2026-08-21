import {
  IonContent,
  IonItem,
  IonList,
  IonMenu,
  IonMenuToggle,
  IonIcon,
  IonSpinner,
} from "@ionic/react";
import axios from "axios";
import { API_BASE } from "../config";
import { useHistory, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";

// Import Ionicons dynamically
import {
  home,
  calendar,
  documentText,
  barChart,
  hammer,
  briefcase,
  logOut,
  wallet,
  receipt,
  ticket,
  documents,
  fileTrayStacked,
  cash,
  call,
  alarm,
  person,
  calendarClear,
  chatbox,
  chevronBackOutline,
  chevronForwardOutline,
} from "ionicons/icons";

import "../theme/Common.css";
import "./Menu.css";

const Menu: React.FC = () => {
  const history = useHistory();
  const location = useLocation();

  // Initialize userData synchronously from localStorage to avoid initial render flashes
  const [userData, setUserData] = useState<any>(() => {
    try {
      const storedUser = localStorage.getItem("user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  // Cached profile and menu items for instant rendering
  const [userProfile, setUserProfile] = useState<any>(() => {
    try {
      const cached = localStorage.getItem("cached_user_profile");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [menuItems, setMenuItems] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem("cached_menu_items");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem("cached_menu_items");
      return !cached || JSON.parse(cached).length === 0;
    } catch {
      return true;
    }
  });

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("sidebarCollapsed") === "true";
  });

  const menuListRef = useRef<HTMLIonListElement | null>(null);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const newState = !prev;
      localStorage.setItem("sidebarCollapsed", String(newState));
      return newState;
    });
  };

  // Listen for desktop toggle event from bottom tab bar or shortcuts
  useEffect(() => {
    const handleToggleEvent = () => {
      toggleSidebar();
    };
    window.addEventListener("app:toggle-sidebar", handleToggleEvent);
    return () => {
      window.removeEventListener("app:toggle-sidebar", handleToggleEvent);
    };
  }, []);

  const dummyProfilePic = "/images/avatar.png";

  const fetchMenuData = async (empCode: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("No token found. Redirecting to login...");
        window.location.replace("/login");
        return;
      }

      const cleanBase = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;
      const API_URL = `${cleanBase}Login/Load_Menu?Empcode=${empCode}`;

      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch menu: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setMenuItems(data);
        localStorage.setItem("cached_menu_items", JSON.stringify(data));
      }
    } catch (error) {
      console.error("Error fetching menu:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async (empCode: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const cleanBase = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
      const url = `${cleanBase}/Profile/UserProfile?employeeCode=${empCode}`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data) {
        const profile = Array.isArray(res.data) ? res.data[0] : res.data;
        if (profile && (profile.EmpCode || profile.empCode || profile.EmpName || profile.empName || profile[1])) {
          setUserProfile(profile);
          localStorage.setItem("cached_user_profile", JSON.stringify(profile));
        }
      }
    } catch (e) {
      console.error("[Menu] Error fetching profile details:", e);
    }
  };

  // Load menu and profile whenever userData is available or updated
  useEffect(() => {
    const code =
      userData?.EmpCode ||
      userData?.empCode ||
      userData?.emp_code ||
      userData?.Empcode ||
      userData?.userName ||
      userData?.username;

    if (code) {
      fetchMenuData(String(code));
      fetchUserProfile(String(code));
    } else {
      setLoading(false);
    }
  }, [userData]);

  const handleLogout = () => {
    setLoading(true);
    window.dispatchEvent(new Event("app:logout"));
  };

  const scrollToActiveOption = () => {
    setTimeout(() => {
      const listEl = document.querySelector(".scrollable-list") as HTMLElement;
      const activeEl = document.querySelector(".scrollable-list .item-active") as HTMLElement;
      if (listEl && activeEl) {
        const topPos = activeEl.offsetTop - listEl.clientHeight / 2 + activeEl.clientHeight / 2;
        listEl.scrollTop = Math.max(0, topPos);
      } else if (listEl) {
        listEl.scrollTop = 0;
      }
    }, 60);
  };

  // Function to handle tab click and close menu cleanly
  const handleTabClick = (path: string) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    history.push(path);
    const menu = (document.getElementById("main-menu") || document.querySelector("ion-menu")) as HTMLIonMenuElement | null;
    if (menu) {
      menu.close();
    }
  };

  // Scroll to active option when menu items load or location changes
  useEffect(() => {
    scrollToActiveOption();
  }, [menuItems, location.pathname]);

  const empName =
    userProfile?.EmpName ||
    userProfile?.empName ||
    userData?.EmpName ||
    userData?.empName ||
    userData?.displayName ||
    userData?.name ||
    "User";

  const designation =
    userProfile?.Designation ||
    userProfile?.designation ||
    userData?.Designation ||
    userData?.designation ||
    "Employee";

  const userType =
    userData?.UserType ||
    userData?.userType ||
    userData?.role ||
    "User";

  const empCodeDisplay =
    userData?.EmpCode ||
    userData?.empCode ||
    userData?.emp_code ||
    userData?.Empcode ||
    userData?.userName ||
    userData?.username ||
    "";

  const picSrc =
    userProfile?.ProfileImage ||
    userProfile?.profileImage ||
    userProfile?.Img ||
    userProfile?.img ||
    userData?.profilePic ||
    userData?.ProfilePic ||
    userData?.profileImage ||
    dummyProfilePic;

  return (
    <IonMenu
      id="main-menu"
      menuId="main-menu"
      contentId="main"
      side="start"
      type="overlay"
      onIonWillOpen={() => {
        scrollToActiveOption();
      }}
      onIonWillClose={() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }}
      className={`menu-background modern-glass-menu ${isCollapsed ? "collapsed" : ""}`}
    >
      {/* Toggle button straddling the border (visible on desktop) */}
      <button
        className={`sidebar-toggle-btn ${isCollapsed ? "is-collapsed" : ""}`}
        onClick={toggleSidebar}
        type="button"
        aria-label="Toggle Sidebar"
      >
        <IonIcon icon={isCollapsed ? chevronForwardOutline : chevronBackOutline} />
      </button>

      <IonContent
        className={`menu-background modern-glass-content ${isCollapsed ? "collapsed" : ""}`}
        scrollY={false}
        style={{ "--background": "transparent" }}
      >
        <div className="menu-inner-wrapper" style={{ position: "relative", zIndex: 1, height: "100%", overflow: "hidden" }}>
          {/* Profile Card (static, never scrolls) */}
          <div className="modern-menu-header premium-trendy-bg">
            <div className="profile-photo-wrapper">
              <img
                className="profile-photo"
                src={picSrc}
                alt="Profile"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes(dummyProfilePic)) {
                    target.src = dummyProfilePic;
                  }
                }}
              />
            </div>

            <div className="user-info-container">
              <h2 className="user-welcome">{empName}</h2>
              <p className="user-designation">{designation}</p>
              <div className="user-badge">{userType}{empCodeDisplay ? ` • ${empCodeDisplay}` : ""}</div>
            </div>
          </div>

          {/* Scrollable Menu List */}
          <IonList ref={menuListRef} className="scrollable-list">
            <IonMenuToggle autoHide={false}>
              {loading && menuItems.length === 0 ? (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "40px 0" }}>
                  <IonSpinner name="crescent" color="primary" />
                </div>
              ) : menuItems.length > 0 ? (
                menuItems.map((menuItem, index) => (
                  <IonItem
                    key={index}
                    button
                    lines="none"
                    onClick={() => handleTabClick(menuItem[4])}
                    className={location.pathname === menuItem[4] ? "item-active" : ""}
                    style={{ "--item-index": index + 1 } as React.CSSProperties}
                  >
                    <div className="menu-item-row" title={menuItem[1]}>
                      <div className="menu-icon-chip">
                        <IonIcon icon={getIcon(menuItem[2])} />
                      </div>
                      <span className="menu-item-label">{menuItem[1]}</span>
                    </div>
                  </IonItem>
                ))
              ) : (
                <p className="ion-padding" style={{ textAlign: "center", color: "#64748b", fontSize: "13px" }}>
                  No menu items found.
                </p>
              )}

              {/* Logout Button */}
              <IonItem
                button
                lines="none"
                onClick={handleLogout}
                className="logout-item"
                style={{ "--item-index": (menuItems.length || 0) + 2 } as React.CSSProperties}
              >
                <div className="menu-item-row" title="Logout">
                  <div className="menu-icon-chip">
                    <IonIcon icon={logOut} />
                  </div>
                  <span className="menu-item-label">Logout</span>
                </div>
              </IonItem>
            </IonMenuToggle>
          </IonList>
        </div>
      </IonContent>
    </IonMenu>
  );
};

// Function to map API icon names to Ionicons
const getIcon = (iconName: string | null) => {
  const icons: { [key: string]: string } = {
    "home-outline": home,
    "calendar-outline": calendar,
    "document-attach-outline": documentText,
    "barbell-outline": barChart,
    "hammer-outline": hammer,
    "briefcase-outline": briefcase,
    "wallet-outline": wallet,
    "receipt-outline": receipt,
    "ticket-outline": ticket,
    "documents-outline": documents,
    "file-tray-stacked-outline": fileTrayStacked,
    "cash-outline": cash,
    "call-outline": call,
    "alarm-outline": alarm,
    "null": person,
    "Emp Profile": person,
    "employee-outline": person,
    "subway-outline": calendar,
  };
  return iconName && icons[iconName] ? icons[iconName] : documentText;
};

export default Menu;
