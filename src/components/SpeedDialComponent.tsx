import * as React from "react";
import { useState, useEffect } from "react";
import { SpeedDial, SpeedDialAction, SpeedDialIcon } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import PaletteIcon from "@mui/icons-material/Palette";
import { useHistory } from "react-router-dom";
import "../theme/Common.css"; // Import the CSS file
import { LogOut, X, CheckCircle2 } from "lucide-react";

// Updated theme colors with modern Pastel and Premium options
// Updated theme colors with IDs matching global.css definitions
const themeColors = [
  { name: "Blue", value: "#0077b6", id: "blue" },
  { name: "Orange", value: "#ff9505", id: "orange" },
  { name: "Green", value: "#588157", id: "green" },
  { name: "Violet", value: "#957fef", id: "violet" },
  { name: "Teal", value: "#008080", id: "teal" },
  { name: "Pink", value: "#FF6EC7", id: "pink" },
  { name: "Chocolate", value: "#7B3F00", id: "chocolate" },
  { name: "DBASE", value: "#F15A24", id: "dbase" },

  // Premium & Designer Series
  { name: "Midnight", value: "#1D3557", id: "midnight" },
  { name: "Lavender", value: "#a29bfe", id: "lavender" },
  { name: "Crimson", value: "#dc143c", id: "crimson" },
  { name: "Amber", value: "#ffbf00", id: "amber" },
  { name: "Forest", value: "#1b4332", id: "forest" },
  { name: "Plum", value: "#4a0e4e", id: "plum" },
  { name: "Burgundy", value: "#641220", id: "burgundy" },
  { name: "Coal", value: "#2f3640", id: "coal" }
];


const SpeedDialComponent: React.FC = () => {
  const history = useHistory();
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("themeMode") === "dark"
  );
  const [themeId, setThemeId] = useState<string>(
    localStorage.getItem("themeColor") || "blue"
  );
  const [showColorModal, setShowColorModal] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
    localStorage.setItem("themeMode", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    // Apply the theme ID to the data-theme attribute
    document.documentElement.setAttribute("data-theme", themeId);
    
    // Also set primary color as fallback for vintage components
    const selectedColor = themeColors.find(t => t.id === themeId)?.value || "#0077b6";
    document.documentElement.style.setProperty("--ion-color-primary", selectedColor);
    document.documentElement.style.setProperty("--ion-color-primary-shade", selectedColor);
    
    localStorage.setItem("themeColor", themeId);
  }, [themeId]);

  const handleThemeChange = (id: string) => {
    setThemeId(id);
    setShowColorModal(false);
  };

  return (
    <>
      <SpeedDial ariaLabel="SpeedDial menu" className="custom-speed-dial" icon={<SpeedDialIcon />}>
      <SpeedDialAction
            icon={<HomeIcon />}
            tooltipTitle="Home"
            onClick={() => (window.location.href = "/home")}
          />
          <SpeedDialAction
            icon={<AccountCircleIcon />}
            tooltipTitle="Profile"
            onClick={() => (window.location.href = "/eprofile")}
          />
        <SpeedDialAction
          icon={<Brightness4Icon />}
          tooltipTitle="Toggle Dark Mode"
          onClick={() => setDarkMode((prev) => !prev)}
        />
        <SpeedDialAction
          icon={<PaletteIcon />}
          tooltipTitle="Change Theme Color"
          onClick={() => setShowColorModal(true)}
        />
        <SpeedDialAction
          icon={<LogOut />}
          tooltipTitle="Logout"
          onClick={() => {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            window.location.href = "/";
          }}
        />
      </SpeedDial>

      {/* Theme Color Selection Bottom Sheet */}
      {showColorModal && (
        <div className="ep-overlay" onClick={() => setShowColorModal(false)}>
          <div className="ep-modal" onClick={e => e.stopPropagation()}>
            <div className="ep-modal-handle"></div>
            <div className="ep-modal-header">
              <h3>Accent Color</h3>
              <button className="ep-close-btn" onClick={() => setShowColorModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="ep-color-grid">
              {themeColors.map(({ name, value, id }) => (
                <div key={id} className="ep-color-item">
                  <button
                    className={`ep-color-btn ${themeId === id ? 'active' : ''}`}
                    style={{ backgroundColor: value }}
                    onClick={() => handleThemeChange(id)}
                  >
                    {themeId === id && <CheckCircle2 size={24} />}
                  </button>
                  <span className="ep-color-name">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SpeedDialComponent;
