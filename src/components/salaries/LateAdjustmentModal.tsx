// LateAdjustmentModal.tsx
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Clock,
  Plus,
  Minus,
  RotateCcw,
  Check,
  X,
  Calculator,
} from "lucide-react";
import "./LateAdjustmentModal.css";

export interface LateAdjustmentData {
  empCode: string;
  empName: string;
  currentAddDays: string | number;
  currentRemarks: string;
}

interface LateAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: LateAdjustmentData | null;
  onApply: (empCode: string, addDays: string, remarks: string) => void;
}

export const LateAdjustmentModal: React.FC<LateAdjustmentModalProps> = ({
  isOpen,
  onClose,
  data,
  onApply,
}) => {
  // Selected minutes
  const [minutes, setMinutes] = useState<number | "">("");

  // Mode for minutes: "deduct" (Late minutes deduction) or "add" (Extra working/OT minutes addition)
  const [minuteMode, setMinuteMode] = useState<"deduct" | "add">("deduct");
  
  // Extra days (+ or - direct days adjustment)
  const [manualDays, setManualDays] = useState<string>("");

  // Remarks state
  const [remarks, setRemarks] = useState<string>("");
  const [autoRemark, setAutoRemark] = useState<boolean>(true);

  // Initialize from current data when opened
  useEffect(() => {
    if (data && isOpen) {
      const existingDays = data.currentAddDays !== undefined && data.currentAddDays !== null ? String(data.currentAddDays) : "";
      setManualDays(existingDays);
      setRemarks(data.currentRemarks || "");
      setMinutes("");
      setMinuteMode("deduct");
      setAutoRemark(true);
      
      // Prevent body scroll behind modal
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [data, isOpen]);

  if (!isOpen || !data) return null;

  // Exact 8-hour workday minute calculation (8 hours = 480 mins = 1.0 day)
  const getMinuteValue = (mins: number | ""): number => {
    if (typeof mins !== "number" || mins <= 0) return 0;
    return Number((mins / 480).toFixed(3));
  };

  // Helper to generate a clean, composite auto-remark
  const buildAutoRemark = (
    dStr: string,
    mins: number | "",
    mode: "deduct" | "add"
  ): string => {
    const parts: string[] = [];

    const parsed = parseFloat(dStr);
    if (dStr !== "" && !isNaN(parsed) && parsed !== 0) {
      const formatted = parsed > 0 ? `+${parsed}` : `${parsed}`;
      parts.push(`${formatted} Day${Math.abs(parsed) !== 1 ? "s" : ""}`);
    }

    if (typeof mins === "number" && mins > 0) {
      const val = Number((mins / 480).toFixed(3));
      if (mode === "deduct") {
        parts.push(`Late ${mins}m (-${val}d)`);
      } else {
        parts.push(`OT ${mins}m (+${val}d)`);
      }
    }

    return parts.join(", ");
  };

  // Compute the final net Add_Days value
  const minuteVal = getMinuteValue(minutes);
  const parsedManualDays = parseFloat(manualDays) || 0;
  
  // Net days = manual days (+ or -) minutes value
  let netDays = 0;
  if (minutes !== "" && typeof minutes === "number" && minutes > 0) {
    if (minuteMode === "deduct") {
      netDays = Number((parsedManualDays - minuteVal).toFixed(3));
    } else {
      netDays = Number((parsedManualDays + minuteVal).toFixed(3));
    }
  } else {
    netDays = manualDays !== "" ? Number(parsedManualDays.toFixed(3)) : 0;
  }

  // Determine display string for final output
  let finalDaysStr = "";
  if (minutes !== "" || manualDays !== "") {
    finalDaysStr = netDays !== 0 ? (netDays > 0 ? `+${netDays}` : `${netDays}`) : "0";
  }

  // Handle Preset Minutes Click
  const handleSelectMinutes = (mins: number) => {
    const nextMins = minutes === mins ? "" : mins;
    setMinutes(nextMins);
    if (autoRemark) {
      setRemarks(buildAutoRemark(manualDays, nextMins, minuteMode));
    }
  };

  // Handle Mode Change (Deduct vs Add)
  const handleModeChange = (mode: "deduct" | "add") => {
    setMinuteMode(mode);
    if (autoRemark) {
      setRemarks(buildAutoRemark(manualDays, minutes, mode));
    }
  };

  // Handle Custom Minutes Input Change
  const handleCustomMinutesChange = (val: number | "") => {
    setMinutes(val);
    if (autoRemark) {
      setRemarks(buildAutoRemark(manualDays, val, minuteMode));
    }
  };

  // Handle Day Presets
  const handleDayPreset = (val: number) => {
    const current = parseFloat(manualDays) || 0;
    const updated = Number((current + val).toFixed(2));
    const nextDaysStr = updated > 0 ? `+${updated}` : `${updated}`;
    setManualDays(nextDaysStr);
    if (autoRemark) {
      setRemarks(buildAutoRemark(nextDaysStr, minutes, minuteMode));
    }
  };

  // Handle Custom Days Input Change
  const handleCustomDaysChange = (val: string) => {
    setManualDays(val);
    if (autoRemark) {
      setRemarks(buildAutoRemark(val, minutes, minuteMode));
    }
  };

  // Clear Minutes
  const handleClearMinutes = () => {
    setMinutes("");
    if (autoRemark) {
      setRemarks(buildAutoRemark(manualDays, "", minuteMode));
    }
  };

  // Clear Days
  const handleClearDays = () => {
    setManualDays("");
    if (autoRemark) {
      setRemarks(buildAutoRemark("", minutes, minuteMode));
    }
  };

  // Toggle Auto Remark Checkbox
  const handleToggleAutoRemark = (checked: boolean) => {
    setAutoRemark(checked);
    if (checked) {
      setRemarks(buildAutoRemark(manualDays, minutes, minuteMode));
    }
  };

  const handleApply = () => {
    let saveDays = "";
    if (finalDaysStr !== "") {
      saveDays = String(netDays);
    }
    onApply(data.empCode, saveDays, remarks.trim());
    onClose();
  };

  const handleReset = () => {
    setMinutes("");
    setManualDays("");
    setRemarks("");
    setMinuteMode("deduct");
    setAutoRemark(true);
  };

  const isNegative = netDays < 0;
  const isPositive = netDays > 0;
  const cardState = isPositive ? "positive" : isNegative ? "negative" : "neutral";

  const modalContent = (
    <div className="late-modal-overlay" onClick={onClose}>
      <div className="late-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="late-modal-header">
          <div className="late-modal-header-info">
            <div className="late-modal-header-icon">
              <Calculator size={22} color="#ffffff" />
            </div>
            <div>
              <h2 className="late-modal-title">{data.empName}</h2>
              <p className="late-modal-subtitle">
                Code: {data.empCode} &bull; 8 Hours Workday (480 mins)
              </p>
            </div>
          </div>
          <button className="late-modal-close-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="late-modal-body">
          {/* Result Preview Card */}
          <div className={`late-preview-card ${cardState}`}>
            <div>
              <div className="late-preview-label">Net Days Adjustment</div>
              <div className="late-preview-detail">
                {minutes !== "" && typeof minutes === "number" && minutes > 0 ? (
                  <span>
                    Base: {manualDays || "0"}d {minuteMode === "deduct" ? "− Late:" : "+ OT:"}{" "}
                    {minutes}m ({minuteMode === "deduct" ? `-${minuteVal}d` : `+${minuteVal}d`})
                  </span>
                ) : (
                  <span>
                    Current: {data.currentAddDays || "None"} &rarr; Proposed: {finalDaysStr || "0"}
                  </span>
                )}
              </div>
            </div>

            <div className="late-preview-value-box">
              <div className="late-preview-value">
                {finalDaysStr || "0.00"}
              </div>
              <span className={`late-preview-tag ${cardState}`}>
                {isPositive ? "Extra Pay / Added" : isNegative ? "Deduction (-)" : "Neutral / Zero"}
              </span>
            </div>
          </div>

          {/* Section 1: Minutes Calculator (Deduct Late OR Add Extra/OT) */}
          <div className="late-section">
            <div className="late-section-title">
              <span className="late-section-title-left">
                <Clock size={16} color="#ff8c00" />
                Minutes Calculator (8h = 480m)
              </span>

              {/* Mode Toggle: Deduct Late vs Add OT */}
              <div className="minute-mode-toggle">
                <button
                  type="button"
                  className={`minute-mode-btn deduct ${minuteMode === "deduct" ? "active" : ""}`}
                  onClick={() => handleModeChange("deduct")}
                >
                  <Minus size={12} /> Deduct Late
                </button>
                <button
                  type="button"
                  className={`minute-mode-btn add ${minuteMode === "add" ? "active" : ""}`}
                  onClick={() => handleModeChange("add")}
                >
                  <Plus size={12} /> Add Extra / OT
                </button>
              </div>
            </div>

            {/* Quick minute buttons */}
            <div className="late-chips-grid">
              {[
                { mins: 30, sub: "0.063d" },
                { mins: 45, sub: "0.094d" },
                { mins: 60, sub: "0.125d (1h)" },
                { mins: 90, sub: "0.188d (1.5h)" },
                { mins: 120, sub: "0.250d (2h)" },
                { mins: 180, sub: "0.375d (3h)" },
                { mins: 240, sub: "0.500d (Half)" },
                { mins: 480, sub: "1.000d (Full)" },
              ].map((item) => (
                <button
                  key={item.mins}
                  type="button"
                  className={`late-chip-btn ${minuteMode} ${minutes === item.mins ? "active" : ""}`}
                  onClick={() => handleSelectMinutes(item.mins)}
                >
                  <span>{item.mins} Mins</span>
                  <span className="late-chip-sub">
                    {minuteMode === "deduct" ? "-" : "+"}
                    {item.sub.split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom Minutes input */}
            <div className="late-input-row">
              <input
                type="number"
                min="0"
                className="late-custom-input"
                placeholder={
                  minuteMode === "deduct"
                    ? "Enter late minutes to deduct (e.g. 75)..."
                    : "Enter extra/OT minutes to add (e.g. 75)..."
                }
                value={minutes}
                onChange={(e) => {
                  const val = e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0);
                  handleCustomMinutesChange(val);
                }}
              />
              {minutes !== "" && (
                <button
                  type="button"
                  className="day-chip clear"
                  onClick={handleClearMinutes}
                  style={{ height: "38px" }}
                >
                  <RotateCcw size={13} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Section 2: Direct Days Adjustment (+ / -) */}
          <div className="late-section">
            <div className="late-section-title">
              <span className="late-section-title-left">
                <Plus size={15} color="#059669" />
                <Minus size={15} color="#dc2626" />
                Days Adjustment (+ / -)
              </span>
            </div>

            <div className="days-chips-row">
              <button
                type="button"
                className="day-chip add"
                onClick={() => handleDayPreset(1.0)}
              >
                <Plus size={13} /> +1.0 Day
              </button>
              <button
                type="button"
                className="day-chip add"
                onClick={() => handleDayPreset(0.5)}
              >
                <Plus size={13} /> +0.5 Day
              </button>
              <button
                type="button"
                className="day-chip deduct"
                onClick={() => handleDayPreset(-0.5)}
              >
                <Minus size={13} /> -0.5 Day
              </button>
              <button
                type="button"
                className="day-chip deduct"
                onClick={() => handleDayPreset(-1.0)}
              >
                <Minus size={13} /> -1.0 Day
              </button>
              {manualDays !== "" && (
                <button
                  type="button"
                  className="day-chip clear"
                  onClick={handleClearDays}
                >
                  <RotateCcw size={13} /> Clear Days
                </button>
              )}
            </div>

            <div className="late-input-row">
              <input
                type="text"
                className="late-custom-input"
                placeholder="Custom days (e.g. +1, -0.5, -0.2)..."
                value={manualDays}
                onChange={(e) => handleCustomDaysChange(e.target.value)}
              />
            </div>
          </div>

          {/* Section 3: Remarks */}
          <div className="late-section">
            <div className="late-section-title">
              <span>Remarks Annotation</span>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", cursor: "pointer", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={autoRemark}
                  onChange={(e) => handleToggleAutoRemark(e.target.checked)}
                />
                Auto-add note
              </label>
            </div>

            <input
              type="text"
              className="late-remarks-input"
              placeholder="e.g. Late 90m, OT 60m, Extra shift, Permission..."
              value={remarks}
              onChange={(e) => {
                setRemarks(e.target.value);
                // If user types manually in remarks, uncheck auto-remark so their edits aren't overwritten
                setAutoRemark(false);
              }}
            />

            <div className="remarks-template-chips">
              {[
                "Late 60m",
                "Late 90m",
                "OT 60m",
                "OT 120m",
                "Extra Work",
                "Half Day",
                "Permission",
              ].map((txt, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="remark-chip"
                  onClick={() => {
                    setRemarks((prev) => (prev ? `${prev}, ${txt}` : txt));
                    setAutoRemark(false);
                  }}
                >
                  + {txt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="late-modal-footer">
          <button type="button" className="late-btn late-btn-reset" onClick={handleReset}>
            <RotateCcw size={14} /> Reset to 0
          </button>
          <div style={{ display: "flex", gap: "8px", flex: 1, justifyContent: "flex-end" }}>
            <button type="button" className="late-btn late-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="late-btn late-btn-apply" onClick={handleApply}>
              <Check size={16} /> Apply Adjustment ({finalDaysStr || "0"})
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
