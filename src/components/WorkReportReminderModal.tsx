import React, { useState, useEffect } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { AlertTriangle, Clock, ArrowRight, X, ShieldAlert } from "lucide-react";
import { hubConnection } from "../services/signalRService";
import "./WorkReportReminderModal.css";

export const WorkReportReminderModal: React.FC = () => {
  // Modal popups disabled as requested; native and web push notifications handle reminders.
  return null;
};

export default WorkReportReminderModal;
