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
} from "@ionic/react";
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
import FloatingTabBar from "./FloatingTabBar";

const Menu: React.FC = () => {
  const history = useHistory();
  const [userData, setUserData] = useState<any>(null);
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

      const API_URL = `https://api.dbasesolutions.in/api/Login/Load_Menu?Empcode=${empCode}`;
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

  // Load menu when user data is available
  useEffect(() => {
    if (userData?.empCode) {
      fetchMenuData(userData.empCode);
    }
  }, [userData]);

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
          {/* User Details */}
          <div className="menu-header ion-padding">
            <IonAvatar className="profile-avatar">
              <img src={userData.profilePic || dummyProfilePic} alt="Profile" />
            </IonAvatar>
            <h2>Welcome, {userData.empName}!</h2>
            <p>{userData.designation} ({userData.userType})</p>
            <p>Emp Code: {userData.empCode}</p>
          </div>

          {/* Dynamic Menu List */}
          <IonList ref={menuListRef} className="scrollable-list">
            <IonMenuToggle autoHide={false}>
              {menuItems.length > 0 ? (
                menuItems.map((menuItem, index) => (
                  <IonItem key={index} button onClick={() => history.push(menuItem[4])}>
                    <IonIcon className="menu-icons" slot="start" icon={getIcon(menuItem[2])} />
                    <IonLabel>{menuItem[1]}</IonLabel>
                  </IonItem>
                ))
              ) : (
                <p className="ion-padding">No menu items found.</p>
              )}

              {/* Logout Button */}
              <IonItem button onClick={handleLogout}>
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
    "null":person,
    "Emp Profile": person,
    "employee-outline": person,
    "subway-outline": calendar,

  };
  return iconName && icons[iconName] ? icons[iconName] : documentText;
};

export default Menu;
