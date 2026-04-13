import React, { useState, useEffect } from "react";
import {
  MapPin,
  X,
  Scan
} from "lucide-react";
import { Geolocation } from "@capacitor/geolocation";
import axios from "axios";
import "../theme/Home.css";
import { useHistory } from "react-router-dom";
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'lord-icon': any;
    }
  }
}

const Home: React.FC = () => {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [location, setLocation] = useState<string>("Fetching location...");
  const [showNotifications, setShowNotifications] = useState(false);
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
      const permission = await Geolocation.requestPermissions();
      if (permission.location !== "granted") {
        setLocation("Location access denied.");
        return;
      }
      const coordinates = await Geolocation.getCurrentPosition();
      reverseGeocode(coordinates.coords.latitude, coordinates.coords.longitude);
    } catch (error) {
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

  const notifications = [
    { id: 1, text: "Welcome to D Base Solutions Pvt.Ltd.", icon: "🔔", type: "welcome" },
    { id: 2, text: "New features updated recently!", icon: "🚀", type: "update" },
    { id: 3, text: "Office timing updated for next week.", icon: "📅", type: "info" },
    { id: 4, text: "Please complete your pending tasks.", icon: "⚠️", type: "warning" },
  ];

  const menuItems = [
    { id: "tasks", label: "Tasks", icon: "https://cdn.lordicon.com/wloilxuq.json", path: "/tasks", colorClass: "home-card-tasks" },
    { id: "tickets", label: "Tickets", icon: "https://cdn.lordicon.com/raawsqec.json", path: "/tickets", colorClass: "home-card-tickets" },
    { id: "productivity", label: "Productivity", icon: "https://cdn.lordicon.com/erxuunyq.json", path: null, colorClass: "home-card-productivity" },
    { id: "performance", label: "Performance", icon: "https://cdn.lordicon.com/kwnsnjyg.json", path: null, colorClass: "home-card-performance" },
    { id: "punctuality", label: "Punctuality", icon: "https://cdn.lordicon.com/kiqyrejq.json", path: null, colorClass: "home-card-punctuality" },
    { id: "requests", label: "Requests", icon: "https://cdn.lordicon.com/zpxybbhl.json", path: "/leaverequest", colorClass: "home-card-requests" },
    { id: "transactions", label: "Transactions", icon: "https://cdn.lordicon.com/ynsswhvj.json", path: "/transactions/0", colorClass: "home-card-transactions" },
    { id: "stock", label: "Stock", icon: "https://cdn.lordicon.com/uomkwtjh.json", path: null, colorClass: "home-card-stock" },
    { id: "invoice", label: "Invoice", icon: "https://cdn.lordicon.com/ysoasulr.json", path: "/invoices", colorClass: "home-card-invoice" },
    { id: "maintenance", label: "Maintenance", icon: "https://cdn.lordicon.com/qawxkplz.json", path: null, colorClass: "home-card-maintenance" },
    { id: "scanner", label: "Scanner", icon: <Scan size={32} color="#ffffff" />, path: "/camera", colorClass: "home-card-scanner", isLucide: true },
  ];

  return (
    <div className="home-container">
      {/* Premium Header */}
      <header className="home-header">
        <img src="./images/dbase.png" alt="DBase Logo" className="home-logo" />
      </header>

      {/* Status Widget */}
      <div className="home-status-card">
        <div className="home-status-item">
          {/* @ts-ignore */}
          <lord-icon
            src="https://cdn.lordicon.com/uvofdfal.json"
            trigger="loop"
            colors="primary:#ffffff,secondary:#ffffff"
            style={{ width: "24px", height: "24px" }}
          ></lord-icon>
          <div className="home-status-text">Check-in: {currentTime}</div>
        </div>
        <div className="home-status-item">
          <MapPin className="home-status-icon" />
          <div className="home-status-location">{location}</div>
        </div>
      </div>

      {/* Notice Board */}
      <div className="home-notice-wrapper" onClick={() => setShowNotifications(true)}>
        <div className="home-notice-icon-box">
          {/* @ts-ignore */}
          <lord-icon
            src="https://cdn.lordicon.com/ahxaipjb.json"
            trigger="loop"
            colors="primary:#ffffff,secondary:#ffffff"
            style={{ width: "22px", height: "22px" }}
          ></lord-icon>
        </div>
        <div className="home-notice-content">
          <div className="home-notice-ticker">
            {notifications.map((n, i) => (
              <div key={`ticker-${n.id}-${i}`} className="home-notice-item">
                {n.icon} {n.text}
              </div>
            ))}
            {/* Duplicate for infinite feel if needed, but for now we have multiple */}
            <div className="home-notice-item">{notifications[0].icon} {notifications[0].text}</div>
          </div>
        </div>
      </div>

      {/* Action Grid */}
      <div className="home-grid">
        {menuItems.map((item) => (
          <div
            key={item.id}
            className={`home-card ${item.colorClass}`}
            onClick={() => item.path && history.push(item.path)}
          >
            <div className="home-card-icon-wrapper">
              {(item as any).isLucide ? (
                item.icon
              ) : (
                /* @ts-ignore */
                <lord-icon
                  src={item.icon as string}
                  trigger="loop"
                  colors="primary:#ffffff,secondary:#ffffff"
                  className="home-card-lordicon"
                  style={{ width: "40px", height: "40px" }}
                ></lord-icon>
              )}
            </div>
            <span className="home-card-label">{item.label}</span>
          </div>
        ))}
      </div>
      {/* Notifications Overlay */}
      {showNotifications && (
        <div className="home-notif-overlay" onClick={() => setShowNotifications(false)}>
          <div className="home-notif-modal" onClick={(e) => e.stopPropagation()}>
            <div className="home-notif-header">
              <div className="home-notif-header-title">Notifications</div>
              <button className="home-notif-close" onClick={() => setShowNotifications(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="home-notif-list">
              {notifications.map((n) => (
                <div key={n.id} className="home-notif-item">
                  <div className={`home-notif-icon-circle ${n.type}`}>
                    {n.icon}
                  </div>
                  <div className="home-notif-info">
                    <div className="home-notif-text">{n.text}</div>
                    <div className="home-notif-time">Just now</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
