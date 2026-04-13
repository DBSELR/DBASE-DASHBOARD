import {
  IonContent,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuToggle,
  IonAvatar,
  IonIcon,
  IonSpinner,
  IonButtons,
  IonTitle,
  IonMenuButton,
  IonToolbar,
} from "@ionic/react";
import axios from "axios";
import { API_BASE } from "../config";
import { useHistory } from "react-router-dom";
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
} from "ionicons/icons";

import "../theme/Common.css";
import "./Menu.css";
import FloatingTabBar from "./FloatingTabBar";

const Menu: React.FC = () => {
  const history = useHistory();
  const [userData, setUserData] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const menuListRef = useRef<HTMLIonListElement | null>(null);

  const dummyProfilePic = "/images/avatar.png"; // Use absolute path for better reliability

  // Fetch user data from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUserData(JSON.parse(storedUser));
    }
  }, []);

  const fetchMenuData = async (empCode: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("No token found. Redirecting to login...");
        window.location.replace("/login");
        return;
      }

      const API_URL = `${API_BASE}Login/Load_Menu?Empcode=${empCode}`;
      // console.log("Fetching menu from:", API_URL);

      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`, // Using token for authentication
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch menu: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setMenuItems(data);
      // console.log("Fetched Menu:", data);
    } catch (error) {
      console.error("Error fetching menu:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load menu and profile when user data is available
  useEffect(() => {
    if (userData?.empCode) {
      fetchMenuData(userData.empCode);
      fetchUserProfile(userData.empCode);
    }
  }, [userData]);

  const fetchUserProfile = async (empCode: string) => {
    try {
      const token = localStorage.getItem("token");
      const cleanBase = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
      const url = `${cleanBase}/Profile/UserProfile?employeeCode=${empCode}`;

      console.log("[Menu] Fetching user profile from:", url);

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data) {
        const profile = Array.isArray(res.data) ? res.data[0] : res.data;
        if (profile && (profile.EmpCode || profile.Empcode || profile[1])) {
          console.log("[Menu] Profile parsed successfully:", profile);
          setUserProfile(profile);
        } else {
          console.warn("[Menu] Profile data empty or invalid structure", res.data);
        }
      } else {
        console.warn("[Menu] No profile data found in response");
      }
    } catch (e) {
      console.error("[Menu] Error fetching profile details:", e);
    }
  };

  const handleLogout = () => {
    setLoading(true);
    setTimeout(() => {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      setUserData(null);
      window.location.replace("/login");
    }, 500);
  };

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

  // Scroll to top when menu opens
  useEffect(() => {
    if (menuListRef.current) {
      menuListRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [menuItems]); // Trigger scroll reset when menu loads

  if (loading) {
    return (
      <IonContent className="ion-padding">
        <IonSpinner name="crescent" />
      </IonContent>
    );
  }

  if (!userData) return null;

  return (
    <>
      <IonMenu contentId="main" menuId="main-menu" type="overlay" className="menu-background">
        <IonContent className="menu-background">
          {/* Professional & Trendy User Details Header */}
          <div className="modern-menu-header premium-trendy-bg">
            <div className="profile-photo-wrapper">
              {(() => {
                const picSrc = userProfile?.ProfileImage || userProfile?.Img || userData.profilePic || dummyProfilePic;
                console.log("[Menu] Rendering profile image with src:", picSrc);
                return (
                  <img
                    className="profile-photo"
                    src={picSrc}
                    alt="Profile"
                    onLoad={() => console.log("[Menu] Profile image loaded successfully:", picSrc)}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.includes(dummyProfilePic)) {
                        console.warn("[Menu] Image failed to load, falling back to dummy:", target.src);
                        target.src = dummyProfilePic;
                      }
                    }}
                  />
                );
              })()}
            </div>

            <div className="user-info-container">
              <h2 className="user-welcome">{userProfile?.EmpName || userData.empName || "User"}</h2>
              <p className="user-designation">{userProfile?.Designation || userData.designation || "Employee"}</p>
              <div className="user-badge">{userData.userType} • {userData.empCode}</div>
            </div>
          </div>

          {/* Dynamic Menu List */}
          <IonList ref={menuListRef} className="scrollable-list">
            <IonMenuToggle autoHide={false}>
              {menuItems.length > 0 ? (
                menuItems.map((menuItem, index) => (
                  <IonItem
                    key={index}
                    button
                    onClick={() => history.push(menuItem[4])}
                    className={history.location.pathname === menuItem[4] ? "item-active" : ""}
                    style={{ "--item-index": index + 1 } as React.CSSProperties}
                  >
                    <IonIcon className="menu-icons" slot="start" icon={getIcon(menuItem[2])} />
                    <IonLabel>{menuItem[1]}</IonLabel>
                  </IonItem>
                ))
              ) : (
                <p className="ion-padding">No menu items found.</p>
              )}

              {/* Logout Button */}
              <IonItem
                button
                onClick={handleLogout}
                className="logout-item"
                style={{ "--item-index": menuItems.length + 1, marginBottom: "100px" } as React.CSSProperties}
              >
                <IonIcon className="menu-icons" slot="start" icon={logOut} />
                <IonLabel>Logout</IonLabel>
              </IonItem>

              {/* chatbox Button */}
              {/* <IonItem button onClick={() => handleTabClick("/office-chat")}>
                <IonIcon className="menu-icons" slot="start" icon={chatbox} />
                <IonLabel>Chat</IonLabel>
              </IonItem> */}


            </IonMenuToggle>
          </IonList>
        </IonContent>
      </IonMenu>

      <FloatingTabBar />
    </>
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
