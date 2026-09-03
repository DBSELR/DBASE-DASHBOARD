import React, { useState, useEffect, useCallback } from "react";
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import type { Engine } from "tsparticles-engine";
import {
  MapPin,
  X,
  Scan,
  UserCheck,
  ShieldAlert,
  BadgeAlert,
  LayoutGrid,
  List
} from "lucide-react";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";
import axios from "axios";
import "../theme/Home.css";
import { useHistory } from "react-router-dom";
import { apiService } from "../utils/apiService";
import { IonIcon } from "@ionic/react";
import { time } from "ionicons/icons";
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'lord-icon': any;
    }
  }
}
import { FileWarning } from "lucide-react";


import { LocationStatusBanner } from "../components/LocationStatusBanner";
import { OnDutyEmployeeStatusCard } from "../components/OnDutyEmployeeStatusCard";

const ADMIN_EMPCODES = ['1501', '1509', '1601', '1508', '1541', '1635'];

const PENDING_LEAVES = ['1501', '1601', '1541', '1635'];
const PAYMENT_REMINDERS = ['1501', '1508', '1531', '1635', '1541'];
const Live_Tracking_Engine = ['1501', '1509', '1601', '1508', '1541', '1635'];
const Home: React.FC = () => {
  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  const [themeColors, setThemeColors] = useState<string[]>(["#f57c00", "#ffab40", "#fb923c"]);
  const [primaryColor, setPrimaryColor] = useState<string>("#f57c00");

  const [currentTime, setCurrentTime] = useState<string>("");
  const [greeting, setGreeting] = useState<string>("Welcome");
  const [location, setLocation] = useState<string>("Fetching location...");
  const [showNotifications, setShowNotifications] = useState(false);
  const [pendingTasksCount, setPendingTasksCount] = useState<number>(0);
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
  const history = useHistory();

  const currentEmpCode = (() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      return String(u.empCode || u.EmpCode || '').trim();
    } catch {
      return '';
    }
  })();

  const [isRAUser, setIsRAUser] = useState<boolean>(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      const empCode = String(u.empCode || u.EmpCode || '').trim();
      const desig = String(u.designation || u.Designation || '').trim().toLowerCase();
      const uType = String(u.userType || u.UserType || '').trim().toLowerCase();
      return (
        Live_Tracking_Engine.includes(empCode) ||
        ADMIN_EMPCODES.includes(empCode) ||
        uType === 'admin' ||
        uType === 'director' ||
        uType === 'hr' ||
        uType === 'manager' ||
        desig.includes('director') ||
        desig.includes('manager') ||
        desig.includes('head') ||
        desig.includes('leader') ||
        desig.includes('lead') ||
        desig.includes('in-charge') ||
        desig.includes('administrator')
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const checkRAAccess = async () => {
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        const desig = String(u.designation || u.Designation || '').trim().toLowerCase();
        if (!desig) return;

        const rasRes = await apiService.loadRAS();
        if (Array.isArray(rasRes)) {
          const allowed = rasRes.map((r: any) =>
            (typeof r === 'string' ? r : r.name || r.Name || r.designation || '').trim().toLowerCase()
          );
          if (allowed.includes(desig)) {
            setIsRAUser(true);
          }
        }
      } catch (e) {
        console.warn('[Home] Check RA access error:', e);
      }
    };
    checkRAAccess();
  }, [currentEmpCode]);

  useEffect(() => {
    // Extract dynamic theme colors from Ionic CSS variables
    const getThemeColors = () => {
      const style = getComputedStyle(document.documentElement);
      const primary = style.getPropertyValue('--ion-color-primary').trim() || "#f57c00";
      const secondary = style.getPropertyValue('--ion-color-secondary').trim() || "#ffab40";
      const tertiary = style.getPropertyValue('--ion-color-tertiary').trim() || "#fb923c";

      setPrimaryColor(primary);
      setThemeColors([primary, secondary, tertiary]);
    };

    getThemeColors();
    updateTime();
    const interval = setInterval(updateTime, 1000);
    getLocation(); // Fetch location on load
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchPendingTasks = async () => {
      try {
        const userJson = localStorage.getItem("user");
        if (userJson) {
          const user = JSON.parse(userJson);
          if (user.empCode) {
            const received = await apiService.loadReceivedTasks(user.empCode);
            if (received && Array.isArray(received)) {
              const pending = received.filter((t: any) => {
                const status = (t.Status ?? t[6] ?? "").toString().toLowerCase();
                return status === "pending";
              });
              setPendingTasksCount(pending.length);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching pending tasks:", error);
      }
    };

    fetchPendingTasks();
    const taskInterval = setInterval(fetchPendingTasks, 10000);
    return () => clearInterval(taskInterval);
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

    const hour = now.getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 17) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
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
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const isNative = Capacitor.isNativePlatform();
      const url = (isLocal && !isNative)
        ? `/nominatim/reverse?format=json&lat=${lat}&lon=${lng}`
        : `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;

      const response = await axios.get(url);
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

  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();

  const isApproverUser = (() => {
    if (!currentUser) return false;
    const ut = String(currentUser.userType || '').toLowerCase();
    const dg = String(currentUser.designation || currentUser.Designation || '').toLowerCase();
    return ut === 'admin' || ut === 'hr' || ut === 'manager' ||
      dg.includes('manager') || dg.includes('head') || dg.includes('director') || dg.includes('lead');
  })();

  const menuItems = [
    { id: "tasks", label: "Tasks", icon: "https://cdn.lordicon.com/wloilxuq.json", path: "/tasks", colorClass: "home-card-tasks" },
    { id: "tickets", label: "Tickets", icon: "https://cdn.lordicon.com/raawsqec.json", path: "/tickets", colorClass: "home-card-tickets" },
    { id: "productivity", label: "Productivity", icon: "https://cdn.lordicon.com/erxuunyq.json", path: null, colorClass: "home-card-productivity" },
    { id: "performance", label: "Performance", icon: "https://cdn.lordicon.com/kwnsnjyg.json", path: null, colorClass: "home-card-performance" },
    { id: "punctuality", label: "Punctuality", icon: "https://cdn.lordicon.com/kiqyrejq.json", path: null, colorClass: "home-card-punctuality" },
    { id: "requests", label: "Requests", icon: "https://cdn.lordicon.com/zpxybbhl.json", path: "/requests", colorClass: "home-card-requests" },
    { id: "field-duty-status", label: "Field Duty Status", icon: "https://cdn.lordicon.com/oaflahpk.json", path: "/field-duty", colorClass: "home-card-field-duty" },

    { id: "transactions", label: "Transactions", icon: "https://cdn.lordicon.com/ynsswhvj.json", path: "/transactions/0", colorClass: "home-card-transactions" },
    { id: "stock", label: "Stock", icon: "https://cdn.lordicon.com/uomkwtjh.json", path: "/stock", colorClass: "home-card-stock" },
    { id: "invoice", label: "Invoice", icon: "https://cdn.lordicon.com/ysoasulr.json", path: "/invoices", colorClass: "home-card-invoice" },
    { id: "maintenance", label: "Maintenance", icon: "https://cdn.lordicon.com/qawxkplz.json", path: null, colorClass: "home-card-maintenance" },
    { id: "scanner", label: "Scanner", icon: "https://cdn.lordicon.com/msoeawqm.json", path: "/camera", colorClass: "home-card-scanner" },
    ...(String(currentEmpCode).trim() !== "2001" ? [{ id: "ai-attendance", label: "AI Attendance", icon: "https://cdn.lordicon.com/bgebyztw.json", path: "/ai-attendance-scanner", colorClass: "home-card-ai-attendance" }] : []),
    {
      id: "daywise-attendance",
      label: "Attendance Logs",
      icon: "https://cdn.lordicon.com/nocovwne.json",
      path: "/ai-attendance-log/logs",
      colorClass: "home-card-ai-attendance"
    },
    {
      id: "my-penalties",
      label: "My Penalties",
      icon: "https://cdn.lordicon.com/tdrtiskw.json",
      path: "/employee-penalties",
      colorClass: "home-card-penalties"
    },
    {
      id: "leave-dashboard",
      label: "Leave Dashboard",
      icon: "https://cdn.lordicon.com/qjuahhae.json",
      path: "/leave-dashboard",
      colorClass: "home-card-leaves"
    },

    ...(ADMIN_EMPCODES.includes(currentEmpCode) ? [{
      id: "ai-attendance-admin",
      label: "AI Attendance Admin",
      icon: "https://cdn.lordicon.com/rqqkvjqf.json",
      path: "/ai-attendance-admin-dashboard",
      colorClass: "home-card-ai-admin"
    }] : []),

    ...(PENDING_LEAVES.includes(currentEmpCode) ? [{
      id: "pending-requests",
      label: "Pending Requests",
      icon: "https://cdn.lordicon.com/nocovwne.json",
      path: "/pending-requests",
      colorClass: "home-card-requests"
    }] : []),



    ...(PAYMENT_REMINDERS.includes(currentEmpCode) ? [{
      id: "payment-reminders",
      label: "Payment Reminders",
      icon: "https://cdn.lordicon.com/lupuorrc.json",
      path: "/payment-reminders",
      colorClass: "home-card-payment-reminders"
    }] : []),

    ...((Live_Tracking_Engine.includes(currentEmpCode) || isRAUser) ? [{
      id: "live-tracking-engine",
      label: "Live Tracking Engine",
      icon: "https://cdn.lordicon.com/zzcwywzv.json",
      path: "/onduty-tracking",
      colorClass: "home-card-live-tracking"
    }] : []),
  ];

  return (
    <div className="home-container">
      {/* Background Particles */}
      <Particles
        id="tsparticles-home"
        init={particlesInit}
        options={{
          fullScreen: { enable: false, zIndex: 0 },
          particles: {
            number: { value: 40, density: { enable: true, value_area: 800 } },
            color: { value: themeColors },
            shape: { type: "circle" },
            opacity: { value: 0.3, random: true },
            size: { value: 4, random: true },
            move: {
              enable: true,
              speed: 1.2,
              direction: "none",
              random: true,
              straight: false,
              outModes: { default: "out" },
              bounce: false,
            },
            links: {
              enable: true,
              distance: 140,
              color: primaryColor,
              opacity: 0.1,
              width: 1,
            },
          },
          interactivity: {
            events: {
              onHover: { enable: true, mode: "grab" },
              onClick: { enable: true, mode: "push" },
              resize: true,
            },
            modes: {
              grab: { distance: 140, links: { opacity: 0.3 } },
              push: { quantity: 2 },
            },
          },
          detectRetina: true,
        }}
        style={{
          position: "fixed", /* Fixed so it stays in background when scrolling */
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none" /* allow clicking through to cards underneath */
        }}
        className="home-particles-bg"
      />

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
          <div className="home-status-text">
            <div>{greeting}</div>
            <div style={{ fontSize: '0.8em', opacity: 0.9 }}>{currentTime}</div>
          </div>
        </div>
        <div className="home-status-item">
          <MapPin className="home-status-icon" />
          <div className="home-status-location">{location}</div>
        </div>
      </div>

      {/* On-Duty Employee Status Card with Approval Badge & Ride Instructions */}
      <OnDutyEmployeeStatusCard />



      {/* Notice Board and View Toggle */}
      <div className="home-notice-row">
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

        <div className="home-view-toggle">
          <button
            className={`home-view-btn ${viewType === 'grid' ? 'active' : ''}`}
            onClick={() => setViewType('grid')}
            title="Grid View"
          >
            <LayoutGrid />
          </button>
          <button
            className={`home-view-btn ${viewType === 'list' ? 'active' : ''}`}
            onClick={() => setViewType('list')}
            title="List View"
          >
            <List />
          </button>
        </div>
      </div>

      {/* Action Grid */}
      <div className={viewType === 'grid' ? "home-grid" : "home-list-view"}>
        {menuItems.map((item) => (
          <div
            key={item.id}
            className={`${viewType === 'grid' ? 'home-card' : 'home-list-card'} ${item.colorClass}`}
            onClick={() => item.path && history.push(item.path)}
          >
            {item.id === "tasks" && pendingTasksCount > 0 && (
              <div className="home-card-badge" title="Pending Received Tasks">
                <IonIcon icon={time} style={{ fontSize: "12px", marginRight: "4px", color: "#ffffff" }} />
                <span>{pendingTasksCount}</span>
              </div>
            )}
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
