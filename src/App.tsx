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


// Additional Pages Based on API Data


setupIonicReact();

const App: React.FC = () => {
  const user = localStorage.getItem("user");

  const [theme, setTheme] = useState<string>(localStorage.getItem("themeColor") || "orange");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(localStorage.getItem("themeMode") === "dark");

  useEffect(() => {
    loadThemeSettings();
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
        <IonRouterOutlet>
          {!user ? (
            <Switch>
              <Route exact path="/login" component={Login} />
              <Redirect from="*" to="/login" />
            </Switch>
          ) : (
            <IonSplitPane contentId="main">
              <Menu />
              <IonRouterOutlet id="main">
                {/* <IonHeader>
                  <IonToolbar>
                    <IonButtons slot="start">
                      <IonMenuButton />
                    </IonButtons>
                    <IonTitle>DBase Dashboard</IonTitle>
                    <IonButtons slot="end">
                      <IonButton onClick={() => handleThemeChange("blue")}>🔵</IonButton>
                      <IonButton onClick={() => handleThemeChange("orange")}>🟠</IonButton>
                      <IonButton onClick={() => handleThemeChange("green")}>🟢</IonButton>
                      <IonButton onClick={() => handleThemeChange("violet")}>🟣</IonButton>
                      <IonToggle checked={isDarkMode} onIonChange={handleDarkModeToggle}>
                        🌙
                      </IonToggle>
                    </IonButtons>
                  </IonToolbar>
                </IonHeader> */}

                <Switch>
                  <Route exact path="/home" component={Home} /> {/* Dashboard */}
                  <Route exact path="/eprofile" component={EmpProfile} /> {/* Profile Dashboard */}
                  <Route exact path="/timings" component={Timings} />
                  <Route exact path="/adminrequests" component={AdminRequests} /> {/* LeaveAndPermission admin*/}
                  <Route exact path="/leaverequest" component={LeaveRequest} /> {/* LeaveAndPermission  user*/}
                  <Route exact path="/transactions/0" component={Transactions} />
                  <Route exact path="/adminworkreport" component={AdminWorkReport} /> {/* SubmitWorkReport admin */}
                  <Route exact path="/workreport" component={WorkReports} /> {/* SubmitWorkReport user */}
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

<Route path="/tickets" exact component={Tickets} />
<Route path="/tickets/raisedticket" exact component={RaiseTicket} />
<Route path="/tickets/projectwise" exact component={ProjectWiseTickets} />

<Route path="/tickets/ticketdata" exact component={TicketData} />
                  {/* chat  */}

                  


                  <Redirect from="*" to="/home" />
                </Switch>
              </IonRouterOutlet>
            </IonSplitPane>
          )}
        </IonRouterOutlet>
      </IonReactRouter>

      {user && <SpeedDialComponent />}
    </IonApp>
  );
};

export default App;
