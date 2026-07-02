import { useEffect, useState } from "react";
import { Redirect, Route, Switch } from "react-router-dom";
import {
  IonApp, IonRouterOutlet, IonSplitPane, IonHeader, IonToolbar, IonButtons,
  IonMenuButton, IonTitle, IonButton, IonToggle, setupIonicReact
} from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { loadThemeSettings, changeThemeColor, toggleDarkMode } from "./utils/themeManager";

/* Core CSS */
import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";

/* Theme */
import "./theme/global.css";

import Login from "./pages/Login";
import Menu from "./components/Menu";
import Tasks from "./pages/Tasks";
import Reports from "./pages/Reports";
import Equipment from "./pages/Equipment";
import OnDuties from "./pages/OnDuties";
import SpeedDialComponent from "./components/SpeedDialComponent";
import CameraPage from "./pages/CameraPage";
import EmpProfile from "./pages/EmpProfile";
import Timings from "./pages/Timings";
import AdminRequests from "./pages/AdminRequests";
import Transactions from "./pages/Transactions";
import WorkReports from "./pages/WorkReports";
import Invoices from "./pages/Invoices";
import Sources from "./pages/Sources";
import Tickets from "./pages/Tickets/Tickets";
import Salaries from "./pages/Salaries";
import ClientDetails from "./pages/ClientDetails";
import Home from "./pages/Home";
import LeaveRequest from "./pages/LeaveRequest";
import AdminWorkReport from "./pages/AdminWorkReport";
import TicketsDashboard from "./pages/TicketsDashboard";
import ProjectWiseTickets from "./pages/Tickets/ProjectWiseTickets";
import RaiseTicket from "./pages/Tickets/RaiseTicket";
import TicketData from "./pages/Tickets/components/TicketData";
import OverTime from "./pages/OverTime";
import RequestsPage from "./pages/RequestsPage";
import Policies from "./pages/Policies";
import AIAttendanceAdminDashboard from "./pages/AIAttendance/AIAttendanceAdminDashboard";
import AIAttendanceRegister from "./pages/AIAttendance/AIAttendanceRegister";
import AIAttendanceReports from "./pages/AIAttendance/AIAttendanceReports";
import AIAttendanceScanner from "./pages/AIAttendance/AIAttendanceScanner";
import SecurityAttendanceScanner from "./pages/AIAttendance/SecurityAttendanceScanner";
import AIAttendanceLog from "./pages/AIAttendance/AIAttendanceLog";
import AIAttendanceRuleMaster from "./pages/AIAttendance/AIAttendanceRuleMaster";
import DaywiseAttendanceDashboard from "./pages/DaywiseAttendanceDashboard";
import getCurrentPosition from "./pages/getCurrentPosition";
import OMRJsonImport from "./pages/OMRJsonImport";
import AnswerKeyImport from "./pages/AnswerKeyImport";
import MeetingMaster from "./pages/Meetings/MeetingMaster";
import MeetingDashboard from "./pages/Meetings/MeetingDashboard";
import MeetingList from "./pages/Meetings/MeetingList";
import TaskNotificationPopup from "./components/TaskNotificationPopup";
import { registerNativePush } from "./services/pushNotification";

import PenaltyMaster from "./pages/PenaltyMaster";
import PenaltyAssignment from "./pages/PenaltyAssignment";
import PenaltyDashboard from "./pages/PenaltyDashboard";

import EmployeePenalties from "./pages/EmployeePenalties";
import PenaltyList from "./pages/PenaltyList";

import WorkReportDashboard from "./pages/WorkReportDashboard";
import ViolationReport from "./pages/ViolationReport";
import ViolationApproval from "./pages/ViolationApproval";
import ChangePassword from "./pages/ChangePassword";
import ApprovalDates from "./components/requests/ApprovalDates";
import LeaveAction from "./pages/LeaveAction";


AnswerKeyImport

setupIonicReact();

const App: React.FC = () => {
  const user = localStorage.getItem("user");

  const [theme, setTheme] = useState<string>(localStorage.getItem("themeColor") || "orange");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(localStorage.getItem("themeMode") === "dark");

  useEffect(() => {
    loadThemeSettings();
  }, []);

  useEffect(() => {
    try {
      const userJson = localStorage.getItem("user");
      if (userJson) {
        const u = JSON.parse(userJson);
        const empCode = u?.empCode || u?.EmpCode;
        if (empCode) {
          registerNativePush(String(empCode));
        } else {
          registerNativePush("anonymous");
        }
      } else {
        registerNativePush("anonymous");
      }
    } catch (err) {
      console.error("[Push Startup] Error:", err);
    }
  }, []);

  useEffect(() => {
    changeThemeColor(theme);
    localStorage.setItem("themeColor", theme);
  }, [theme]);

  useEffect(() => {
    toggleDarkMode(isDarkMode);
    localStorage.setItem("themeMode", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  const handleThemeChange = (color: string) => {
    setTheme(color);
  };

  const handleDarkModeToggle = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <IonApp>
      <IonReactRouter>
        {!user ? (
          <IonRouterOutlet>
            <Switch>
              <Route exact path="/login" component={Login} />
              <Redirect from="*" to="/login" />
            </Switch>
          </IonRouterOutlet>
        ) : (
          <IonSplitPane contentId="main">
            <Menu />
            <IonRouterOutlet id="main">
              <Switch>
                  
                  <Route exact path="/home" component={Home} />
                  <Route exact path="/eprofile" component={EmpProfile} />
                  <Route exact path="/timings" component={Timings} />
                  <Route exact path="/adminrequests" component={AdminRequests} />
                  <Route exact path="/leaverequest" component={LeaveRequest} />
                  <Route exact path="/transactions/0" component={Transactions} />
                  <Route exact path="/adminworkreport" component={AdminWorkReport} />
                  <Route exact path="/workreport" component={WorkReports} />
                  <Route exact path="/invoices" component={Invoices} />
                  <Route exact path="/sources" component={Sources} />
                  <Route exact path="/tickets" component={Tickets} />
                  <Route exact path="/reports" component={Reports} />
                  <Route exact path="/equipment" component={Equipment} />
                  <Route exact path="/salaries" component={Salaries} />
                  <Route exact path="/duties" component={OnDuties} />
                  <Route exact path="/tasks" component={Tasks} />
                  <Route exact path="/clientdetails" component={ClientDetails} />
                  <Route exact path="/camera" component={CameraPage} />
                  <Route exact path="/dashboard" component={TicketsDashboard} />
                  <Route exact path="/policies" component={Policies} />
                  <Route exact path="/polices" component={Policies} />
                  <Route path="/tickets" exact component={Tickets} />
                  <Route path="/tickets/raisedticket" exact component={RaiseTicket} />
                  <Route path="/tickets/projectwise" exact component={ProjectWiseTickets} />
                  <Route path="/tickets/ticketdata" exact component={TicketData} />
                  <Route exact path="/OverTime" component={OverTime} />
                  <Route path="/requests" component={RequestsPage} exact />
                  <Route exact path="/ai-attendance-admin-dashboard" component={AIAttendanceAdminDashboard} />
                  <Route exact path="/ai-attendance-register" component={AIAttendanceRegister} />
                  <Route exact path="/ai-attendance-reports" component={AIAttendanceReports} />
                  <Route exact path="/ai-attendance-scanner" component={AIAttendanceScanner} />
                  <Route exact path="/security-attendance" component={SecurityAttendanceScanner} />
                  <Route exact path="/ai-attendance-log/:mode" component={AIAttendanceLog} />
                  <Route exact path="/ai-attendance-rule-master" component={AIAttendanceRuleMaster} />
                  <Route exact path="/daywise-attendance" component={DaywiseAttendanceDashboard} />
                  <Route exact path="/test-location" component={getCurrentPosition} />
                  <Route exact path="/omr-json-import" component={OMRJsonImport} />
                  <Route exact path="/answer-key-import" component={AnswerKeyImport} />
                  <Route exact path="/meeting-master" component={MeetingMaster} />
                  <Route exact path="/meeting-dashboard" component={MeetingDashboard} />
                  <Route exact path="/meeting-list" component={MeetingList} />
                  <Route exact path="/penalty-master" component={PenaltyMaster} />
                  <Route exact path="/penalty-assignment" component={PenaltyAssignment} />
                  <Route exact path="/penalty-dashboard" component={PenaltyDashboard} />
                  <Route exact path="/employee-penalties" component={EmployeePenalties} />
                  <Route exact path="/penalty-list" component={PenaltyList} />
                  <Route exact path="/workreport-dashboard" component={WorkReportDashboard} />
                  <Route exact path="/violation-report" component={ViolationReport} />
                  <Route exact path="/violation-approval" component={ViolationApproval} />
                  <Route exact path="/change-password" component={ChangePassword} />
                  <Route exact path="/Approval-Dates" component={ApprovalDates} />
                  <Route exact path="/leave-action" component={LeaveAction} />

                <Redirect from="*" to="/home" />
              </Switch>
            </IonRouterOutlet>
          </IonSplitPane>
        )}
      </IonReactRouter>

      {user && <SpeedDialComponent />}
      {user && <TaskNotificationPopup />}
    </IonApp>
  );
};

export default App;
