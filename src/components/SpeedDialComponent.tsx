import * as React from "react";
import { useState, useEffect } from "react";
import { SpeedDial, SpeedDialAction, SpeedDialIcon } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import PaletteIcon from "@mui/icons-material/Palette";
import { useHistory } from "react-router-dom";
import { IonPopover, IonButton } from "@ionic/react";
import "../theme/Common.css"; // Import the CSS file

// Updated theme colors with Violet instead of Red
const themeColors = [
  { name: "Blue", value: "#0077b6" },    // Deep Blue
  { name: "Orange", value: "#ff9505" },  // Warm Orange
  { name: "Green", value: "#588157" },   // Earthy Green
  { name: "Violet", value: "#957fef" },  // Soft Violet
  { name: "Teal", value: "#008080" },    // Modern Teal
  { name: "Magenta", value: "#d72638" }, // Vibrant Magenta
  { name: "Pink", value: "#FF6EC7" },    // Rich pink 
  { name: "Chocolate ", value: "#7B3F00" } ,    // chocolate 
  { name: "DBASE", value: "#F15A24" }     // DBASE Black
];


const SpeedDialComponent: React.FC = () => {
  const history = useHistory();
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("themeMode") === "dark"
  );
  const [themeColor, setThemeColor] = useState<string>(
    localStorage.getItem("themeColor") || "#ff9505" // Default to Orange
  );
  const [showPopover, setShowPopover] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
    localStorage.setItem("themeMode", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.style.setProperty("--ion-color-primary", themeColor);
    document.documentElement.style.setProperty("--ion-color-primary-shade", themeColor);
    localStorage.setItem("themeColor", themeColor);
  }, [themeColor]);

  const handleThemeChange = (color: string) => {
    setThemeColor(color);
    setShowPopover(false);
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
          onClick={() => setShowPopover(true)}
        />
      </SpeedDial>

      {/* Theme Color Selection Popover */}
      <IonPopover isOpen={showPopover} onDidDismiss={() => setShowPopover(false)}>
        <div className="theme-color-container">
          <h3>Select Theme Color</h3>
          {themeColors.map(({ name, value }) => (
            <IonButton
              key={value}
              className="theme-button"
              onClick={() => handleThemeChange(value)}
              style={{
                "--background": value,
                "--background-activated": value,
                "--background-hover": value,
                "--color": "white",
              } as React.CSSProperties}
            >
              {name}
            </IonButton>
          ))}
        </div>
      </IonPopover>
    </>
  );
};

export default SpeedDialComponent;
