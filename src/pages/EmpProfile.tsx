import {
  IonAvatar,
  IonButton,
  IonCard,
  IonCardContent,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonItem,
  IonLabel,
  IonPage,
  IonPopover,
  IonRow,
  IonToggle,
} from "@ionic/react";
import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  settingsOutline,
  logOutOutline,
  calendarOutline,
  barChartOutline,
  moonOutline,
  sunnyOutline,
  colorPaletteOutline,
  personOutline,
  heartOutline,
  callOutline,
  mailOutline,
  cashOutline,
  starOutline,
  leafOutline,
  homeOutline,
  personAddOutline,
  checkmarkCircleOutline,
  timeOutline,
  briefcaseOutline,
  cardOutline,
  personCircleOutline,
  waterOutline,
  documentTextOutline,
  idCardOutline,
  closeCircleOutline,
  personCircle,
  informationCircle,
  businessOutline,
  ribbonOutline,
  keyOutline,
  walletOutline,
  trendingUpOutline,
  cubeOutline,
  appsOutline,
  carOutline,
  shieldCheckmarkOutline,
  medkitOutline,
  calculatorOutline,
} from "ionicons/icons";
import "../theme/Common.css";

// Updated theme colors list
const themeColors = [
  { name: "Blue", value: "#0077b6" }, // Deep Blue
  { name: "Orange", value: "#ff9505" }, // Warm Orange
  { name: "Green", value: "#588157" }, // Earthy Green
  { name: "Violet", value: "#957fef" }, // Soft Violet
  { name: "Teal", value: "#008080" }, // Modern Teal
  { name: "Magenta", value: "#d72638" }, // Vibrant Magenta
  { name: "Pink", value: "#FF6EC7" }, // Rich pink
  { name: "Chocolate", value: "#7B3F00" }, // chocolate
  { name: "DBASE", value: "#F15A24" }, // DBASE Black
];

const EmpProfile: React.FC = () => {
  const history = useHistory();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("themeMode") === "dark"
  );
  const [themeColor, setThemeColor] = useState<string>(themeColors[0].value); // Default: Blue
  const [showPopover, setShowPopover] = useState(false);

  // Get the token from localStorage
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token")?.replace(/"/g, "");
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    const user = localStorage.getItem("user");
    const empCode = JSON.parse(user || "{}")?.empCode;

    if (empCode) {
      fetchUserProfile(empCode);
    }
    setLoading(false);
  }, []);

  const fetchUserProfile = async (empCode: string) => {
    try {
      const response = await fetch(
        `https://api.dbasesolutions.in/api/Profile/UserProfile?employeeCode=${empCode}`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const userProfile = data[0]; // assuming the first array in the response is the required profile

        // Map the API response to userData state
        setUserData({
          empCode: userProfile[1],
          empName: userProfile[2],
          designation: userProfile[3],
          joiningDate: userProfile[4],
          bloodGroup: userProfile[5],
          contactNumber: userProfile[6],
          pan: userProfile[38],
          aadhar: userProfile[39],
          salary: userProfile[19],
          email: userProfile[8],
          performanceScore: userProfile[26],
          pendingLeaves: userProfile[21],
          profilePic: userProfile[42], // Assuming ProfilePic is at index 34
          department: userProfile[29], // Example department
          salaryAccountNo: userProfile[27], // Example salary account number
          doj: userProfile[4], // Example date of joining
          pfNo: userProfile[36], // Example PF number
          esiNo: userProfile[31], // Example ESI number
          ifscCode: userProfile[28], // Example IFSC code
          grossSalary: userProfile[25], // Example gross salary
          basicSalary: userProfile[21], // Example basic salary
          hra: userProfile[22], // Example HRA
          da: userProfile[41], // Example DA
          conveyance: userProfile[23], // Example conveyance
          others: userProfile[24], // Example other allowances
          pf: userProfile[30], // Example PF deduction
          esi: userProfile[18], // Example ESI deduction
          profTax: userProfile[32], // Example professional tax
          incomeTax: userProfile[33], // Example income tax
          // dayDa: userProfile[40],
          // hourDa: userProfile[42],
          userType: userProfile[9], // Example user type
        });
      } else {
        console.error("Failed to fetch profile data");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
    localStorage.setItem("themeMode", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    const savedColor = localStorage.getItem("themeColor");
    if (savedColor) {
      setThemeColor(savedColor);
      document.documentElement.style.setProperty(
        "--ion-color-primary",
        savedColor
      );
    }
  }, []);

  const changeThemeColor = (color: string) => {
    setThemeColor(color);
    localStorage.setItem("themeColor", color);
    document.documentElement.style.setProperty("--ion-color-primary", color);
    setShowPopover(false);
  };

  const handleLogout = () => {
    setLoading(true);
    setTimeout(() => {
      localStorage.removeItem("user");
      setUserData(null);
      window.location.replace("/login");
    }, 500);
  };

  const dummyProfilePic = "./images/avatar.png";

  if (loading) {
    return (
      <IonContent className="ion-padding">
        <p>Loading...</p>
      </IonContent>
    );
  }

  if (!userData) return <p>No user data found.</p>;

  return (
    <IonPage>
      <IonContent fullscreen className="scrollable-content">
        <div className="profile-header">
          <IonAvatar className="profile-avatar">
            <img src={userData.profilePic || dummyProfilePic} alt="Profile" />
          </IonAvatar>
          <h2>Welcome, {userData.empName}!</h2>
          <p>
            {userData.designation} ({userData.userType})
          </p>
          <p>Emp Code: {userData.empCode}</p>
          <div className="profile-actions">
            <IonButton
              fill="solid"
              style={{ borderColor: themeColor, color: "#fff" }}
            >
              <IonIcon icon={settingsOutline} slot="start" />
              Edit Profile
            </IonButton>
            <IonButton color="danger" onClick={handleLogout}>
              <IonIcon icon={logOutOutline} slot="start" />
              Logout
            </IonButton>
          </div>
        </div>

        <div className="profile-details">
          <IonGrid>
            <IonRow>
              {/* Personal Info Section */}
              <IonCard className="info-box">
                <IonCardContent>
                  <h1 className="info-heading">
                    <IonIcon icon={informationCircle} />
                    <span>Personal Info</span>
                  </h1>

                  <div className="info-grid">
                    <div>
                      <IonIcon icon={cardOutline} />{" "}
                      <strong>Employee Code:</strong> {userData.empCode}
                    </div>
                    <div>
                      <IonIcon icon={personCircleOutline} />{" "}
                      <strong>Employee Name:</strong> {userData.empName}
                    </div>
                    <div>
                      <IonIcon icon={calendarOutline} /> <strong>DOB:</strong>{" "}
                      {userData.dob || "--"}
                    </div>
                    <div>
                      <IonIcon icon={waterOutline} />{" "}
                      <strong>Blood Group:</strong> {userData.bloodGroup}
                    </div>
                    <div>
                      <IonIcon icon={callOutline} /> <strong>Mobile:</strong>{" "}
                      {userData.contactNumber}
                    </div>
                    <div>
                      <IonIcon icon={documentTextOutline} />{" "}
                      <strong>PAN:</strong> {userData.pan}
                    </div>
                    <div>
                      <IonIcon icon={idCardOutline} /> <strong>AADHAR:</strong>{" "}
                      {userData.aadhar}
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>

              {/* Professional Info Section */}
              <IonCard className="info-box">
                <IonCardContent>

                  <h1 className="info-heading">
                    <IonIcon icon={briefcaseOutline} />
                    <span>Professional Info</span>
                  </h1>

                  <div className="info-grid">
                    <div>
                      <IonIcon icon={calendarOutline} /> <strong>DOJ:</strong>{" "}
                      {userData.doj}
                    </div>
                    <div>
                      <IonIcon icon={businessOutline} />{" "}
                      <strong>Department:</strong> {userData.department}
                    </div>
                    <div>
                      <IonIcon icon={ribbonOutline} />{" "}
                      <strong>Designation:</strong> {userData.designation}
                    </div>
                    <div>
                      <IonIcon icon={mailOutline} />{" "}
                      <strong>Official E-Mail:</strong> {userData.email}
                    </div>
                    <div>
                      <IonIcon icon={documentTextOutline} />{" "}
                      <strong>PF No.:</strong> {userData.pfNo}
                    </div>
                    <div>
                      <IonIcon icon={documentTextOutline} />{" "}
                      <strong>ESI No.:</strong> {userData.esiNo}
                    </div>
                    <div>
                      <IonIcon icon={cashOutline} />{" "}
                      <strong>Sal. Account Number:</strong>{" "}
                      {userData.salaryAccountNo}
                    </div>
                    <div>
                      <IonIcon icon={keyOutline} /> <strong>IFSC Code:</strong>{" "}
                      {userData.ifscCode}
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>

              {/* Salary Info Section */}
              <IonCard className="info-box">
                <IonCardContent>

                  <h1 className="info-heading">
                    <IonIcon icon={cashOutline} />
                    <span>Salary Info</span>
                  </h1>

                  <div className="info-grid">
                    <div>
                      <IonIcon icon={walletOutline} /> <strong>Gross:</strong>{" "}
                      {userData.grossSalary}
                    </div>
                    <div>
                      <IonIcon icon={trendingUpOutline} />{" "}
                      <strong>Basic:</strong> {userData.basicSalary}
                    </div>
                    <div>
                      <IonIcon icon={cubeOutline} /> <strong>HRA:</strong>{" "}
                      {userData.hra}
                    </div>
                    <div>
                      <IonIcon icon={appsOutline} /> <strong>DA:</strong>{" "}
                      {userData.da}
                    </div>
                    <div>
                      <IonIcon icon={carOutline} /> <strong>Conveyance:</strong>{" "}
                      {userData.conveyance}
                    </div>
                    <div>
                      <IonIcon icon={appsOutline} /> <strong>Others:</strong>{" "}
                      {userData.others}
                    </div>
                    <div>
                      <IonIcon icon={shieldCheckmarkOutline} />{" "}
                      <strong>PF:</strong> {userData.pf}
                    </div>
                    <div>
                      <IonIcon icon={medkitOutline} /> <strong>ESI:</strong>{" "}
                      {userData.esi}
                    </div>
                    <div>
                      <IonIcon icon={documentTextOutline} />{" "}
                      <strong>Prof. Tax:</strong> {userData.profTax}
                    </div>
                    <div>
                      <IonIcon icon={calculatorOutline} />{" "}
                      <strong>Income Tax:</strong> {userData.incomeTax}
                    </div>
                    <div>
                      <IonIcon icon={timeOutline} /> <strong>Day DA:</strong>{" "}
                      {userData.dayDa}
                    </div>
                    <div>
                      <IonIcon icon={timeOutline} /> <strong>Hour DA:</strong>{" "}
                      {userData.hourDa}
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>

              {/* Leave Section */}
              <IonCol size="12" sizeMd="6">
                <IonCard className="info-box">
                  <IonCardContent>
                    {/* Leave Section */}

                    <h1 className="info-heading">
                    <IonIcon icon={timeOutline} />
                    <span>Leave Info</span>
                  </h1>

                    <div className="info-grid">
                      <div>
                        <IonIcon icon={timeOutline} />{" "}
                        <strong>Manage Leave:</strong> {userData.leave}
                      </div>
                      <div>
                        <IonIcon icon={timeOutline} />{" "}
                        <strong>Sick Leave:</strong> {userData.sickLeave}
                      </div>
                      <div>
                        <IonIcon icon={timeOutline} /> <strong>P-Time:</strong>{" "}
                        {userData.pTime}
                      </div>
                    </div>

                    {/* Check-In Section */}
                    <h2 className="info-heading" style={{ marginTop: "24px" }}>
                      <IonIcon
                        icon={checkmarkCircleOutline}
                        className="info-icon"
                      />
                      Check-In
                    </h2>
                    <div className="info-grid">
                      <div>
                        <IonIcon icon={checkmarkCircleOutline} />{" "}
                        <strong>Time:</strong> {userData.checkInTime}
                      </div>
                    </div>

                    {/* Manager Section */}
                    <h2 className="info-heading" style={{ marginTop: "24px" }}>
                      <IonIcon icon={personAddOutline} className="info-icon" />
                      Manager Info
                    </h2>
                    <div className="info-grid">
                      <div>
                        <IonIcon icon={personAddOutline} />{" "}
                        <strong>Manager:</strong> {userData.manager}
                      </div>
                      <div>
                        <IonIcon icon={personAddOutline} />{" "}
                        <strong>User Group:</strong> {userData.userGroup}
                      </div>
                    </div>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>

        <div className="theme-controls">
          <IonItem lines="full">
            <IonIcon
              className="dynamic-icon"
              slot="start"
              icon={darkMode ? moonOutline : sunnyOutline}
            />
            <IonLabel>Dark Mode</IonLabel>
            <IonToggle
              checked={darkMode}
              onIonChange={() => setDarkMode(!darkMode)}
            />
          </IonItem>
          <IonItem button lines="full" onClick={() => setShowPopover(true)}>
            <IonIcon
              className="dynamic-icon"
              slot="start"
              icon={colorPaletteOutline}
            />
            <IonLabel>Change Theme Color</IonLabel>
          </IonItem>
        </div>

        <IonPopover
          isOpen={showPopover}
          onDidDismiss={() => setShowPopover(false)}
        >
          <div className="theme-color-container">
            <h3>Select Theme Color</h3>
            {themeColors.map(({ name, value }) => (
              <IonButton
                key={value}
                className="theme-button"
                onClick={() => changeThemeColor(value)}
                style={
                  {
                    "--background": value,
                    "--background-activated": value,
                    "--background-hover": value,
                    "--color": "white",
                  } as React.CSSProperties
                }
              >
                {name}
              </IonButton>
            ))}
          </div>
        </IonPopover>
      </IonContent>
    </IonPage>
  );
};

export default EmpProfile;
