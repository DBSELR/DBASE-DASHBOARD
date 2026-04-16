import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  Settings,
  LogOut,
  Calendar,
  User,
  Phone,
  Mail,
  CreditCard,
  Briefcase,
  Wallet,
  TrendingUp,
  Box,
  Layout,
  Truck,
  ShieldCheck,
  PlusCircle,
  FileText,
  Fingerprint,
  Droplet,
  Clock,
  Users,
  Moon,
  Sun,
  Palette,
  X,
  CheckCircle2,
  Info,
  Camera,
  Loader2,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { API_BASE } from "../config";
import { apiService } from "../utils/apiService";
import "./EmpProfile.css";

// Theme colors list with IDs matching global.css definitions
const themeColors = [
  { name: "Blue", value: "#0077b6", id: "blue" },
  { name: "Orange", value: "#ff9505", id: "orange" },
  { name: "Green", value: "#588157", id: "green" },
  { name: "Violet", value: "#957fef", id: "violet" },
  { name: "Teal", value: "#008080", id: "teal" },
  { name: "Pink", value: "#FF6EC7", id: "pink" },
  { name: "Chocolate", value: "#7B3F00", id: "chocolate" },
  { name: "DBASE", value: "#F15A24", id: "dbase" },
  { name: "Midnight", value: "#1D3557", id: "midnight" },
  { name: "Lavender", value: "#a29bfe", id: "lavender" },
  { name: "Crimson", value: "#dc143c", id: "crimson" },
  { name: "Amber", value: "#ffbf00", id: "amber" },
  { name: "Forest", value: "#1b4332", id: "forest" },
  { name: "Plum", value: "#4a0e4e", id: "plum" },
  { name: "Burgundy", value: "#641220", id: "burgundy" },
  { name: "Coal", value: "#2f3640", id: "coal" },
];

const requestTypeOptions = [
  "Equipment Upto 5000",
  "Equipment Above 5000",
  "Work Report",
  "Leave2 Days or Less per month",
  "Leave 2-4 Days per month",
  "Leave More Than 4 Days per month",
  "Permission",
  "On Duty Local Travel / Same Day",
  "On Duty Outstation / Multiple Days",
  "Over Time Up to 4 Hour",
  "Over Time 4-8 Hour",
  "Over Time More than 8 Hour",
  "Special Request",
];

const EmpProfile: React.FC = () => {
  const history = useHistory();
  const [userData, setUserData] = useState<any>({
    empCode: "",
    empName: "",
    designation: "",
    department: "",
    email: "",
    salaryAccountNo: "",
    ifscCode: "",
    grossSalary: "",
    basicSalary: "",
    hra: "",
    da: "",
    conveyance: "",
    others: "",
    pf: "",
    esi: "",
    profTax: "",
    incomeTax: "",
    userType: "",
    doj: "",
    joiningDate: "",
    bloodGroup: "",
    contactNumber: "",
    pan: "",
    aadhar: "",
    esiNo: "",
    pfNo: "",
    ReportTO: "",
    profilePic: "",
    status: "Active",
  });
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("themeMode") === "dark",
  );
  const [themeId, setThemeId] = useState<string>(
    localStorage.getItem("themeColor") || "blue",
  );
  const [showColorModal, setShowColorModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Reporting Matrix State
  const [showReportingModal, setShowReportingModal] = useState(false);
  const [reportingLoading, setReportingLoading] = useState(false);
  const [reportingHistory, setReportingHistory] = useState<any[]>([]);
  const [reportingFormData, setReportingFormData] = useState({
    Id: 0,
    EmpCode: "",
    RequestType: "",
    RA1: "",
    RA2: "",
    RA3: "",
    RA4: "",
  });

  // New Management State
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [ras, setRas] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [locationTypes, setLocationTypes] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("Active");
  const [searchQuery, setSearchQuery] = useState("");
  const [showEmployeeSearch, setShowEmployeeSearch] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isManagementView, setIsManagementView] = useState(false);
  const [loggedInUserType, setLoggedInUserType] = useState<string>("");
  const [employeeRawRow, setEmployeeRawRow] = useState<any>(null);
  const [formData, setFormData] = useState({
    _Employee_ID: "",
    _Ecode: "",
    _Ename: "",
    _Desig: "",
    _BasicSal: "0",
    _DA: "0",
    _HRA: "0",
    _LTA: "0",
    _ALLOWANCES: "0",
    _GrossSal: "0",
    _Doj: "",
    _Dob: "",
    _Blood: "",
    _Mobile: "",
    _Email: "",
    _User: JSON.parse(localStorage.getItem("user") || "{}")?.empCode || "admin",
    _UserGroup: "Employee",
    _Allowed_CL: "12",
    _Allowed_SL: "10",
    _RequestTo: "",
    _Allowed_MY: "2",
    _IsActive: "Y",
    _AccountNo: "",
    _IFSCCode: "",
    _P_Time: "09:30",
    _Dept: "",
    _PF: "0",
    _Esi: "0",
    _Ptax: "0",
    _Itax: "0",
    _NetSal: "0",
    _PanNo: "",
    _AadharNo: "",
    _ESINo: "",
    _CheckIn: "09:30",
    _PFNo: "",
    _dayDA: "0",
    _hourDA: "0",
    _Project: "",
    _LocationType: "",
    _Location1: "",
  });


const calculateFromGross = (gross: number) => {
  const G = Number(gross);

  // 🧮 Earnings (MATCHING YOUR UI)
  const Basic = G * 0.50;
  const HRA = Basic * 0.40;
  const DA = Basic * 0.25;
  const Conveyance = Basic * 0.15;

  const used = Basic + HRA + DA + Conveyance;
  const OtherAmt = G - used;

  // 📉 PF (24% of Basic)
  const PFAmt = Basic * 0.24;

  // 📉 ESI
  const ESIAmt = G <= 21000 ? G * 0.0075 : 0;

  // 📉 Professional Tax
  const PTax =
    G <= 15000 ? 0 :
    G <= 20000 ? 150 :
    200;

  // 📉 Income Tax
  const ITax = G > 62500 ? G * 0.0212 : 0;

  // 💰 Net Salary
  const totalDeduction = PFAmt + ESIAmt + PTax + ITax;
  const NetSal = G - totalDeduction;

  return {
    Gross: G,

    Basic,
    HRA,
    DA,
    Conveyance,
    OtherAmt,

    PFAmt,
    ESIAmt,
    PTax,
    ITax,

    NetSal
  };
};

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token")?.replace(/"/g, "");
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    loadBaseData();
    const userJson = localStorage.getItem("user");
    const user = JSON.parse(userJson || "{}");
    const empCode = user?.empCode;

    if (user?.userType) {
      setLoggedInUserType(user.userType);
    }

    if (empCode) {
      fetchUserProfile(empCode);
    } else {
      setLoading(false);
    }
  }, []);

  const loadBaseData = async () => {
    console.group("[EmpProfile] Load Base Data (Depts/Desigs)");
    try {
      const [depts, desigs, projs, locTypes, locs, ras] = await Promise.all([
        apiService.loadDepartments(),
        apiService.loadDesignations(),
        apiService.loadTlProjects(),
        apiService.loadLocationType(),
        apiService.loadLocation(),
        apiService.loadRAS(),
      ]);
      console.log("Raw Departments:", depts);
      console.log("Raw Designations:", desigs);
      setDepartments(decodeArrayResponse(depts, ["id", "name", "active"]));
      setDesignations(decodeArrayResponse(desigs, ["id", "name", "active"]));
      setProjects(decodeArrayResponse(projs, ["id", "name"]));
      setLocationTypes(decodeArrayResponse(locTypes, ["id", "name"]));
      setLocations(decodeArrayResponse(locs, ["id", "name"]));
      setRas(ras);
    } catch (e) {
      console.error("Error loading base data:", e);
    } finally {
      console.groupEnd();
    }
  };

  const loadEmployees = async (status: string) => {
    console.group(`[EmpProfile] Load Employees (${status})`);
    try {
      const data = await apiService.loadEmployees(status);
      console.log("Raw Employees List:", data);
      const decoded = decodeArrayResponse(data, [
        "code",
        "name",
        "dept",
        "desig",
        "mobile",
      ]);
      console.log("Decoded Employees List:", decoded);
      setEmployees(decoded);
    } catch (e) {
      console.error("Error loading employees:", e);
    } finally {
      console.groupEnd();
    }
  };

  useEffect(() => {
    if (isManagementView || showEmployeeSearch) {
      loadEmployees(statusFilter);
    }
  }, [statusFilter, isManagementView, showEmployeeSearch]);

  const decodeArrayResponse = (data: any, keys: string[]) => {
    let actualData = data;
    if (data && !Array.isArray(data) && Array.isArray(data.data)) {
      actualData = data.data;
    }

    if (!Array.isArray(actualData)) {
      console.warn(
        "[EmpProfile] decodeArrayResponse: actualData is not an array",
        actualData,
      );
      return [];
    }
    const decoded = actualData.map((row: any) => {
      if (Array.isArray(row)) {
        const obj: any = {};
        keys.forEach((key, i) => (obj[key] = row[i]));
        return obj;
      }
      return row;
    });
    return decoded;
  };

  const mapGetEmployeeResponse = (row: any) => {
    console.group("[EmpProfile] mapGetEmployeeResponse");
    console.log("Input Row Array:", row);
    console.log("Row length:", row.length);
    console.log(
      "Row[50] (Project):",
      row[50],
      "Row[51] (LocationType):",
      row[51],
      "Row[52] (Location):",
      row[52],
    );

    if (!Array.isArray(row)) {
      console.warn("Input is not an array, returning as is");
      console.groupEnd();
      return row;
    }

    // Normalizing isActive ('1' or 'Y' or true -> 'Y')
    const rawIsActive = row[14];
    const normalizedIsActive =
      rawIsActive === "1" ||
      rawIsActive === "Y" ||
      rawIsActive === true ||
      rawIsActive === 1
        ? "Y"
        : "N";

    const mapped = {
      _Employee_ID:
        row[0] !== null && row[0] !== undefined ? String(row[0]) : "",
      _Ecode: row[1] !== null && row[1] !== undefined ? String(row[1]) : "",
      _Ename: row[2] !== null && row[2] !== undefined ? String(row[2]) : "",
      _Desig: row[3] !== null && row[3] !== undefined ? String(row[3]) : "",
      _Doj: row[4]
        ? String(row[4]).includes("T")
          ? row[4].split("T")[0]
          : row[4]
        : "",
      _Dob: row[45]
        ? String(row[45]).includes("T")
          ? row[45].split("T")[0]
          : row[45]
        : "",
      _Blood: row[5] !== null && row[5] !== undefined ? String(row[5]) : "",
      _Mobile: row[6] !== null && row[6] !== undefined ? String(row[6]) : "",
      _Email: row[8] !== null && row[8] !== undefined ? String(row[8]) : "",
      _Dept: row[30] !== null && row[30] !== undefined ? String(row[30]) : "",
      _User:
        JSON.parse(localStorage.getItem("user") || "{}")?.empCode || "admin",
      _Allowed_MY:
        row[13] !== null && row[13] !== undefined ? String(row[13]) : "2",
      _Allowed_CL:
        row[11] !== null && row[11] !== undefined ? String(row[11]) : "12",
      _Allowed_SL:
        row[21] !== null && row[21] !== undefined ? String(row[21]) : "10",
      _IsActive: normalizedIsActive,
      _HRA: row[23] !== null && row[23] !== undefined ? String(row[23]) : "0",
      _DA: row[42] !== null && row[42] !== undefined ? String(row[42]) : "0",
      _BasicSal:
        row[22] !== null && row[22] !== undefined ? String(row[22]) : "0",
      _LTA: row[24] !== null && row[24] !== undefined ? String(row[24]) : "0",
      _ALLOWANCES:
        row[25] !== null && row[25] !== undefined ? String(row[25]) : "0",
      _GrossSal:
        row[26] !== null && row[26] !== undefined ? String(row[26]) : "0",
      _AccountNo:
        row[28] !== null && row[28] !== undefined ? String(row[28]) : "",
      _IFSCCode:
        row[29] !== null && row[29] !== undefined ? String(row[29]) : "",
      _PF: row[31] !== null && row[31] !== undefined ? String(row[31]) : "0",
      _Esi: row[32] !== null && row[32] !== undefined ? String(row[32]) : "0",
      _Ptax: row[33] !== null && row[33] !== undefined ? String(row[33]) : "0",
      _Itax: row[34] !== null && row[34] !== undefined ? String(row[34]) : "0",
      _NetSal:
        row[35] !== null && row[35] !== undefined ? String(row[35]) : "0",
      _PanNo: row[39] !== null && row[39] !== undefined ? String(row[39]) : "",
      _AadharNo:
        row[40] !== null && row[40] !== undefined ? String(row[40]) : "",
      _PFNo: row[37] !== null && row[37] !== undefined ? String(row[37]) : "",
      _ESINo: row[36] !== null && row[36] !== undefined ? String(row[36]) : "",
      _CheckIn:
        row[44] !== null && row[44] !== undefined ? String(row[44]) : "09:30",
      _P_Time:
        row[49] !== null && row[49] !== undefined ? String(row[49]) : "09:30",
      _dayDA: row[47] !== null && row[47] !== undefined ? String(row[47]) : "0",
      _hourDA:
        row[48] !== null && row[48] !== undefined ? String(row[48]) : "0",
      _RequestTo:
        row[15] !== null && row[15] !== undefined ? String(row[15]) : "",
      _Project: row[50] || "",
      _LocationType: row[51] || "",
      _Location1: row[52] || "",
      // _Project: projects.find(p => p.name == row[50])?.id || row[50] || "",
      // _LocationType: locationTypes.find(l => l.name == row[51])?.id || row[51] || "",
      // _Location1: locations.find(l => l.name == row[52])?.id || row[52] || ""
    };

    console.log("Mapped Result:", mapped);
    console.groupEnd();
    return mapped;
  };

  const selectEmployee = async (ecode: string) => {
    console.group(`[EmpProfile] Select Employee Details (${ecode})`);
    setLoading(true);
    try {
      const data = await apiService.getEmployee(ecode);
      console.log("Raw Employee Data:", data);
      const row = Array.isArray(data) ? data[0] : data;
      console.log("Working Raw Row:", row);
      setEmployeeRawRow(row);
      const details = mapGetEmployeeResponse(row);
      console.log("Mapped Employee Details:", details);

      // Map back to userData structure for display
      const newUserData = {
        empCode: details._Ecode,
        empName: details._Ename,
        designation: details._Desig,
        department: details._Dept,
        joiningDate: details._Doj,
        bloodGroup: details._Blood,
        contactNumber: details._Mobile,
        email: details._Email,
        salaryAccountNo: details._AccountNo,
        ifscCode: details._IFSCCode,
        grossSalary: details._GrossSal,
        basicSalary: details._BasicSal,
        hra: details._HRA,
        da: details._DA,
        pf: details._PF,
        esi: details._Esi,
        profTax: details._Ptax,
        incomeTax: details._Itax,
        conveyance: details._LTA || "0",
        others: details._ALLOWANCES || "0",
        userType: row[15] || details._RequestTo,
        doj: details._Doj,
        pan: details._PanNo,
        aadhar: details._AadharNo,
        esiNo: details._ESINo,
        pfNo: details._PFNo,
        ReportTO: details._RequestTo,
        profilePic: row[42] || userData?.profilePic, // Keep current if missing
        status:
          details._IsActive === "N" ||
          details._IsActive === "0" ||
          details._IsActive === false
            ? "InActive"
            : "Active",
      };
      console.log("Setting Final userData for View:", newUserData);
      setUserData(newUserData);

      // Update form data for potential editing
      const newFormData = {
        ...details,
        _IsActive: details._IsActive || "Y",
        _User: details._User || "admin",
      };
      console.log("Setting formData for Edit:", newFormData);
      setFormData(newFormData);

      setShowEmployeeSearch(false);
      // Automatically open the editable modal on selection
      setIsEditMode(true);
      setShowRegisterModal(true);
    } catch (e) {
      console.error("Error selecting employee:", e);
      alert("Failed to load employee details.");
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  };

  const fetchUserProfile = async (empCode: string) => {
    console.group(`[EmpProfile] fetchUserProfile (${empCode})`);
    try {
      const response = await fetch(
        `${API_BASE}Profile/UserProfile?employeeCode=${empCode}`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        },
      );

      if (response.ok) {
        const data = await response.json();
        const userProfile = Array.isArray(data) ? data[0] : data;

        console.log("[EmpProfile] fetchUserProfile SUCCESS", {
          raw: data,
          image:
            userProfile.Img || userProfile?.ProfileImage || userProfile?.[42],
          name: userProfile.EmpName || userProfile?.Empname,
        });

        if (Array.isArray(userProfile)) {
          // Legacy array-based mapping
          setUserData({
            empCode: userProfile[1],
            empName: userProfile[2],
            designation: userProfile[3],
            profilePic: userProfile[42],
            // ... more fields ... (omitted for brevity, but I should keep them all)
            department: userProfile[29],
            salaryAccountNo: userProfile[27],
            doj: userProfile[4],
            pfNo: userProfile[36],
            esiNo: userProfile[31],
            ifscCode: userProfile[28],
            grossSalary: userProfile[25],
            basicSalary: userProfile[21],
            hra: userProfile[22],
            da: userProfile[41],
            conveyance: userProfile[23],
            others: userProfile[24],
            pf: userProfile[30],
            esi: userProfile[18],
            profTax: userProfile[32],
            incomeTax: userProfile[33],
            userType: userProfile[9],
            joiningDate: userProfile[4],
            bloodGroup: userProfile[5],
            contactNumber: userProfile[6],
            pan: userProfile[38],
            aadhar: userProfile[39],
            salary: userProfile[19],
            email: userProfile[8],
            performanceScore: userProfile[26],
            pendingLeaves: userProfile[21],
            status:
              userProfile[14] === "N" ||
              userProfile[14] === "0" ||
              userProfile[14] === false
                ? "InActive"
                : "Active",
          });
        } else {
          // Object-based mapping
          setUserData({
            empCode: userProfile.EmpCode || userProfile.Empcode,
            empName: userProfile.EmpName || userProfile.Empname,
            designation: userProfile.Designation,
            joiningDate: userProfile.DOJ,
            bloodGroup: userProfile.Blood,
            contactNumber: userProfile.Mobile,
            pan: userProfile.PanNo,
            aadhar: userProfile.AadhaarNo,
            salary: userProfile.NetSal,
            email: userProfile.Email,
            performanceScore: userProfile.UnseenCredits,
            pendingLeaves: userProfile.AVAIL_LS,
            profilePic: userProfile.Img || userProfile.ProfileImage,
            department: userProfile.Department,
            salaryAccountNo: userProfile.Accountno,
            doj: userProfile.DOJ,
            pfNo: userProfile.PFNo,
            esiNo: userProfile.ESINo,
            ifscCode: userProfile.IFSCcode,
            grossSalary: userProfile.GrossSal,
            basicSalary: userProfile.BASICSAL,
            hra: userProfile.HRA,
            da: userProfile.DA,
            conveyance: userProfile.LTA,
            others: userProfile.ALLOWANCES,
            pf: userProfile.PF,
            esi: userProfile.ESI,
            profTax: userProfile.PTax,
            incomeTax: userProfile.ITax,
            userType: userProfile.UserType,
            availableLeaves: userProfile.AVAIL_LS,
            unseenCredits: userProfile.UnseenCredits,
            ReportTO: userProfile.ReportTO,
            status:
              userProfile.IsActive === "N" ||
              userProfile.IsActive === "0" ||
              userProfile.IsActive === false ||
              userProfile.Isactive === "N"
                ? "InActive"
                : "Active",
          });
        }
      } else {
        console.error("[EmpProfile] fetchUserProfile FAILED:", response.status);
      }
    } catch (error) {
      console.error("[EmpProfile] fetchUserProfile EXCEPTION:", error);
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const url = `${API_BASE}Login/UploadProfileImage?empCode=${userData.empCode}`;
      console.log("[EmpProfile] Uploading image to:", url);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "*/*",
          ...getAuthHeaders(),
          // Content-Type MUST NOT be set here, browser will set it with boundary
        },
        body: formData,
      });

      console.log("[EmpProfile] Upload response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("[EmpProfile] Upload success response:", data);
        // Assuming the API returns the new image URL in a field named 'image' according to the user request info
        // Response format as per user: { "message": "Image uploaded successfully", "image": "URL" }
        setUserData((prev: any) => ({ ...prev, profilePic: data.image }));

        // Update local memory user object as well if it stores the image
        const localUser = JSON.parse(localStorage.getItem("user") || "{}");
        localUser.profilePic = data.image; // Using profilePic for consistency
        localStorage.setItem("user", JSON.stringify(localUser));

        console.log("[EmpProfile] Image upload SUCCESS", data);
        alert("Profile picture updated successfully!");
      } else {
        const errorText = await response.text();
        alert("Upload failed: " + errorText);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("An error occurred during image upload.");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
    localStorage.setItem("themeMode", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    if (!employeeRawRow) return;

    if (!projects.length || !locationTypes.length || !locations.length) return;

    console.log("Fixing dropdown values...");

    const projectId = projects.find((p) => p.name == employeeRawRow[50])?.id;
    const locationTypeId = locationTypes.find(
      (l) => l.name == employeeRawRow[51],
    )?.id;
    const locationId = locations.find((l) => l.name == employeeRawRow[52])?.id;

    console.log({ projectId, locationTypeId, locationId });

    setFormData((prev) => ({
      ...prev,
      _Project: projectId || "",
      _LocationType: locationTypeId || "",
      _Location1: locationId || "",
    }));
  }, [employeeRawRow, projects, locationTypes, locations]);

  useEffect(() => {
    // Apply the theme ID to the data-theme attribute
    document.documentElement.setAttribute("data-theme", themeId);

    // Also set primary color as fallback for vintage components
    const selectedColor =
      themeColors.find((t) => t.id === themeId)?.value || "#0077b6";
    document.documentElement.style.setProperty(
      "--ion-color-primary",
      selectedColor,
    );

    localStorage.setItem("themeColor", themeId);
  }, [themeId]);

  const changeThemeColor = (id: string) => {
    setThemeId(id);
    setShowColorModal(false);
  };

  const handleLogout = () => {
    setLoading(true);
    setTimeout(() => {
      localStorage.removeItem("user");
      setUserData(null);
      window.location.replace("/login");
    }, 500);
  };
   const handleInputChange = (e: any) => {
  const { name, value } = e.target;

  setFormData((prev) => {
    const updated = { ...prev, [name]: value };

    // 👉 Only trigger when Gross changes
    if (name === "_GrossSal") {
      const gross = parseFloat(value) || 0;

      const calc = calculateFromGross(gross);

      updated._BasicSal = calc.Basic.toFixed(0);
      updated._HRA = calc.HRA.toFixed(0);
      updated._DA = calc.DA.toFixed(0);
      updated._LTA = calc.Conveyance.toFixed(0);
      updated._ALLOWANCES = calc.OtherAmt.toFixed(0);

      updated._PF = calc.PFAmt.toFixed(0);
      updated._Esi = calc.ESIAmt.toFixed(0);
      updated._Ptax = calc.PTax.toString();
      updated._Itax = calc.ITax.toFixed(0);
      updated._NetSal = calc.NetSal.toFixed(0);
    }

    return updated;
  });
};
  // const handleInputChange = (e: any) => {
  //   const { name, value } = e.target;
  //   setFormData((prev) => ({ ...prev, [name]: value }));
  // };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const formatToDDMMYYYY = (dateStr: string) => {
      if (!dateStr || !dateStr.includes("-")) return dateStr;
      const [y, m, d] = dateStr.split("-");
      return `${d}/${m}/${y}`;
    };

    setRegisterLoading(true);

    try {
      // Convert IDs to names for saving
      const projectName =
        projects.find((p) => p.id == formData._Project)?.name ||
        formData._Project;
      const locationTypeName =
        locationTypes.find((l) => l.id == formData._LocationType)?.name ||
        formData._LocationType;
      const locationName =
        locations.find((l) => l.id == formData._Location1)?.name ||
        formData._Location1;

      const payload = {
        ...formData,
        _Project: projectName,
        _LocationType: locationTypeName,
        _Location1: locationName,
        _Doj: formatToDDMMYYYY(formData._Doj),
        _Dob: formatToDDMMYYYY(formData._Dob),
      };

      console.log("FINAL POST PAYLOAD (Formatted):", payload);
      const response = await apiService.registerEmployee(payload);

      if (
        response === "Employee saved successfully" ||
        response?.message === "Employee saved successfully"
      ) {
        alert("Employee saved successfully");
        // setShowRegisterModal(false); // KEEP MODAL OPEN
        if (isManagementView) loadEmployees(statusFilter);
      } else {
        alert(
          "Registration failed: " +
            (typeof response === "string"
              ? response
              : JSON.stringify(response)),
        );
      }
    } catch (error: any) {
      console.error("Error registering employee:", error);
      alert("An error occurred during registration: " + error.message);
    } finally {
      setRegisterLoading(false);
    }
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setFormData({
      _Employee_ID: "0",
      _Ecode: "",
      _Ename: "",
      _Desig: "",
      _BasicSal: "0",
      _DA: "0",
      _HRA: "0",
      _LTA: "0",
      _ALLOWANCES: "0",
      _GrossSal: "0",
      _Doj: "",
      _Dob: "",
      _Blood: "",
      _Mobile: "",
      _Email: "",
      _User:
        JSON.parse(localStorage.getItem("user") || "{}")?.empCode || "admin",
      _UserGroup: "Employee",
      _Allowed_CL: "12",
      _Allowed_SL: "10",
      _RequestTo: "",
      _Allowed_MY: "1",
      _IsActive: "Y",
      _AccountNo: "",
      _IFSCCode: "",
      _P_Time: "09:30:00",
      _Dept: "",
      _PF: "0",
      _Esi: "0",
      _Ptax: "200",
      _Itax: "0",
      _NetSal: "0",
      _PanNo: "",
      _AadharNo: "",
      _ESINo: "",
      _CheckIn: "09:30:00",
      _PFNo: "",
      _dayDA: "0",
      _hourDA: "0",
      _Project: "",
      _LocationType: "",
      _Location1: "",
    });
    setShowRegisterModal(true);
  };

  const openEditModal = () => {
    setIsEditMode(true);
    setShowRegisterModal(true);
  };

  const openReportingModal = async () => {
    setReportingFormData({
      Id: 0,
      EmpCode: formData._Ecode,
      RequestType: "",
      RA1: formData._RequestTo || "",
      RA2: "",
      RA3: "",
      RA4: "",
    });
    setShowReportingModal(true);
    fetchReportingHistory(formData._Ecode);
  };

  const fetchReportingHistory = async (empCode: string) => {
    console.group(`[EmpProfile] Fetch Reporting Matrix (${empCode})`);
    try {
      const data = await apiService.loadReportingMatrix(empCode);
      console.log("Raw History Data:", data);

      if (Array.isArray(data)) {
        console.log(`Success: Found ${data.length} assignments.`);
        data.forEach((item, i) => {
          console.log(`Assignment #${i + 1}:`, {
            Id: item.id || item.Id,
            Type: item.requestType || item.RequestType,
            RA1: item.rA1 || item.RA1,
            RA2: item.rA2 || item.RA2,
            RA3: item.rA3 || item.RA3,
            RA4: item.rA4 || item.RA4,
          });
        });
        setReportingHistory(data);
      } else {
        console.warn("No data found or invalid format:", data);
        setReportingHistory([]);
      }
    } catch (e) {
      console.error("Critical error loading reporting history:", e);
      setReportingHistory([]);
    } finally {
      console.groupEnd();
    }
  };

  const editReportingMatrix = (item: any) => {
    setReportingFormData({
      Id: item.id || item.Id || 0,
      EmpCode: item.empCode || item.EmpCode,
      RequestType: item.requestType || item.RequestType,
      RA1: item.rA1 || item.RA1 || "",
      RA2: item.rA2 || item.RA2 || "",
      RA3: item.rA3 || item.RA3 || "",
      RA4: item.rA4 || item.RA4 || "",
    });
  };

  // 🔥 Update API (now includes RequestType)
  const updateReportingField = async (
    field: string,
    value: string,
    requestType: string,
  ) => {
    try {
      const row = reportingHistory.find(
        (r) => (r.requestType || r.RequestType) === requestType,
      );

      const payload = {
        EmpCode: reportingFormData.EmpCode,
        RequestType: requestType,

        // ✅ Preserve all values including RA1
        RA1: field === "RA1" ? value : row?.RA1 || row?.rA1 || "",
        RA2: field === "RA2" ? value : row?.RA2 || row?.rA2 || "",
        RA3: field === "RA3" ? value : row?.RA3 || row?.rA3 || "",
        RA4: field === "RA4" ? value : row?.RA4 || row?.rA4 || "",
      };

      console.log("Updating ALL:", payload);

      await apiService.post("/Employee/UpdateReportingMatrix", payload);

      fetchReportingHistory(reportingFormData.EmpCode);
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  // const updateReportingField = async (field: string, value: string) => {
  //   try {
  //     const payload = {
  //       EmpCode: reportingFormData.EmpCode,
  //       RequestType: reportingFormData.RequestType,
  //       RA2: field === "RA2" ? value : reportingFormData.RA2,
  //       RA3: field === "RA3" ? value : reportingFormData.RA3,
  //       RA4: field === "RA4" ? value : reportingFormData.RA4
  //     };

  //     console.log("Updating:", payload);

  //     const response = await apiService.post("/Employee/UpdateReportingMatrix", payload);

  //     if (response?.message === "Updated Successfully") {
  //       console.log("Updated Successfully");
  //     } else {
  //       console.warn("Update failed");
  //     }
  //   } catch (err) {
  //     console.error("Update error:", err);
  //   }
  // };

  const fetchRAsByRequestType = async (
    empCode: string,
    requestType: string,
  ) => {
    try {
      const res = await apiService.get(
        `/Employee/GetRAsByRequestType?empCode=${empCode}&requestType=${encodeURIComponent(
          requestType,
        )}`,
      );

      console.log("RA API Response:", res);

      // ✅ HANDLE BOTH ARRAY + OBJECT
      if (Array.isArray(res) && res.length > 0) {
        const data = res[0];

        setReportingFormData((prev) => ({
          ...prev,
          // RA1: data.RA1 || "",
          RA2: data.RA2 || "",
          RA3: data.RA3 || "",
          RA4: data.RA4 || "",
        }));
      } else {
        console.warn("No RA data found");
      }
    } catch (err) {
      console.error("Error fetching RAs:", err);
    }
  };

  const handleReportingInputChange = (e: any) => {
    const { name, value } = e.target;
    setReportingFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveReportingMatrix = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportingLoading(true);
    try {
      const response = await apiService.saveReportingMatrix(reportingFormData);
      if (
        response === "Saved Successfully" ||
        response?.message === "Saved Successfully"
      ) {
        alert("Reporting matrix saved successfully");
        fetchReportingHistory(reportingFormData.EmpCode);
        // Reset form but keep EmpCode
        setReportingFormData((prev) => ({
          Id: 0,
          EmpCode: prev.EmpCode,
          RequestType: "",
          RA1: formData._RequestTo || "",
          RA2: "",
          RA3: "",
          RA4: "",
        }));
      } else {
        alert(
          "Failed to save reporting matrix: " +
            (typeof response === "string"
              ? response
              : JSON.stringify(response)),
        );
      }
    } catch (error: any) {
      console.error("Error saving reporting matrix:", error);
      alert("An error occurred: " + error.message);
    } finally {
      setReportingLoading(false);
    }
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      (emp.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (emp.code?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (emp.desig?.toLowerCase() || "").includes(searchQuery.toLowerCase()),
  );

  if (loading) {
    return (
      <div
        className="ep-container"
        style={{ justifyContent: "center", alignItems: "center" }}
      >
        <div className="loader">Loading...</div>
      </div>
    );
  }

  if (!userData)
    return (
      <div className="ep-container">
        <p style={{ padding: "20px" }}>No user data found.</p>
      </div>
    );

  const InfoItem = ({ icon: Icon, label, value }: any) => (
    <div className="ep-info-item">
      <div className="ep-icon-box">
        <Icon size={18} />
      </div>
      <div className="ep-label-value">
        <span className="ep-label">{label}</span>
        <span className="ep-value">{value || "--"}</span>
      </div>
    </div>
  );

  return (
    <div className="ep-container">
      {/* Native-style header */}
      <header className="ep-header-section">
        <div className="ep-header-content">
          <div className={`ep-avatar-wrapper ${uploading ? "uploading" : ""}`}>
            <img
              src={userData.profilePic || "./images/avatar.png"}
              alt="Profile"
              className="ep-avatar-img"
              onError={(e) => {
                console.error(
                  "[EmpProfile] Profile image 404 or load error, falling back to default",
                );
                (e.target as HTMLImageElement).src = "./images/avatar.png";
              }}
            />
            <label className="ep-upload-btn">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                className="ep-hidden-input"
              />
              {uploading ? (
                <Loader2 className="ep-spin" size={18} />
              ) : (
                <Camera size={18} />
              )}
            </label>
          </div>
          <h2 className="ep-user-name">Welcome, {userData.empName}!</h2>
          <p className="ep-user-designation">
            {userData.designation} ({userData.userType})
          </p>
          <div className="ep-profile-status-row">
            <span className="ep-user-code">ID: {userData.empCode}</span>
            <span
              className={`ep-status-pill ${userData.status?.toLowerCase()}`}
            >
              {userData.status}
            </span>
          </div>

          <div className="ep-header-actions">
            {(loggedInUserType === "Admin" ||
              loggedInUserType === "ACCOUNTANT") && (
              <>
                <button
                  className="ep-action-btn ep-btn-search"
                  onClick={() => setShowEmployeeSearch(true)}
                >
                  <Users color="var(--ion-color-primary)" size={18} />
                  Find
                </button>
                <button
                  className="ep-action-btn ep-btn-add"
                  onClick={openAddModal}
                >
                  <PlusCircle color="var(--ion-color-primary)" size={18} />
                  Add
                </button>
              </>
            )}
            {!isManagementView && (
              <button
                className="ep-action-btn ep-btn-logout"
                onClick={handleLogout}
              >
                <LogOut size={18} />
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="ep-content">
        {/* Settings / Controls */}
        <div className="ep-card">
          <h3 className="ep-card-title">
            <Settings color="var(--ion-color-primary)" size={20} /> App Settings
          </h3>

          <div className="ep-settings-item">
            <div className="ep-settings-label">
              {darkMode ? (
                <Moon color="var(--ion-color-primary)" size={20} />
              ) : (
                <Sun color="var(--ion-color-primary)" size={20} />
              )}
              Dark Mode
            </div>
            <label className="ep-toggle">
              <input
                type="checkbox"
                checked={darkMode}
                onChange={() => setDarkMode(!darkMode)}
              />
              <span className="ep-slider"></span>
            </label>
          </div>

          <div
            className="ep-settings-item"
            onClick={() => setShowColorModal(true)}
            style={{ cursor: "pointer" }}
          >
            <div className="ep-settings-label">
              <Palette color="var(--ion-color-primary)" size={20} />
              Theme Color
            </div>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                backgroundColor: "var(--ion-color-primary)",
              }}
            ></div>
          </div>
        </div>

        {/* Personal Info */}
        <div className="ep-card">
          <h3 className="ep-card-title">
            <Info color="var(--ion-color-primary)" size={20} /> Personal Details
          </h3>
          <div className="ep-info-grid">
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Fingerprint}
              label="Emp Code"
              value={userData.empCode}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={User}
              label="Name"
              value={userData.empName}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Droplet}
              label="Blood Group"
              value={userData.bloodGroup}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Phone}
              label="Mobile"
              value={userData.contactNumber}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={FileText}
              label="PAN"
              value={userData.pan}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={CreditCard}
              label="AADHAR"
              value={userData.aadhar}
            />
          </div>
        </div>

        {/* Professional Info */}
        <div className="ep-card">
          <h3 className="ep-card-title">
            <Briefcase color="var(--ion-color-primary)" size={20} />{" "}
            Professional Details
          </h3>
          <div className="ep-info-grid">
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Calendar}
              label="Joining Date"
              value={userData.doj}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Layout}
              label="Department"
              value={userData.department}
            />

            <InfoItem
              color="var(--ion-color-primary)"
              icon={Mail}
              label="Email"
              value={userData.email}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Users}
              label="Reports To"
              value={userData.ReportTO}
            />

            {/* <InfoItem icon={Clock} label="Available Leaves" value={userData.availableLeaves} /> */}
            {/* <InfoItem icon={TrendingUp} label="Unseen Credits" value={userData.unseenCredits} /> */}
            <InfoItem
              color="var(--ion-color-primary)"
              icon={FileText}
              label="PF No"
              value={userData.pfNo}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={ShieldCheck}
              label="ESI No"
              value={userData.esiNo}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={CreditCard}
              label="Bank Account"
              value={userData.salaryAccountNo}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Box}
              label="IFSC Code"
              value={userData.ifscCode}
            />
          </div>
        </div>

        {/* Salary Details */}
        <div className="ep-card">
          <div className="ep-card-header">
            <h3 className="ep-card-title">
              <Wallet color="var(--ion-color-primary)" size={20} /> Salary
              Structure
            </h3>
            {isManagementView && (
              <button className="ep-edit-icon-btn" onClick={openEditModal}>
                <Palette color="var(--ion-color-primary)" size={16} /> Edit
              </button>
            )}
          </div>
          <div className="ep-info-grid">
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Wallet}
              label="Gross"
              value={userData.grossSalary}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={TrendingUp}
              label="Basic"
              value={userData.basicSalary}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={PlusCircle}
              label="HRA"
              value={userData.hra}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Layout}
              label="DA"
              value={userData.da}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Truck}
              label="Conveyance"
              value={userData.conveyance}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Box}
              label="Others"
              value={userData.others}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={ShieldCheck}
              label="PF Deduction"
              value={userData.pf}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={PlusCircle}
              label="ESI Deduction"
              value={userData.esi}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={FileText}
              label="Prof Tax"
              value={userData.profTax}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={TrendingUp}
              label="Income Tax"
              value={userData.incomeTax}
            />
          </div>
        </div>
      </main>

      {/* Employee Selection Search Modal */}
      {showEmployeeSearch && (
        <div
          className="ep-overlay"
          onClick={() => setShowEmployeeSearch(false)}
        >
          <div
            className="ep-modal ep-modal-management"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ep-modal-handle"></div>
            <div className="ep-modal-header">
              <h3>Select Employee ({filteredEmployees.length})</h3>
              <button
                className="ep-close-btn"
                onClick={() => setShowEmployeeSearch(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="ep-search-controls">
              <input
                type="text"
                placeholder="Search by name, code or designation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ep-search-input"
              />
              <div className="ep-status-toggle">
                <button
                  className={statusFilter === "Active" ? "active" : ""}
                  onClick={() => setStatusFilter("Active")}
                >
                  Active
                </button>
                <button
                  className={statusFilter === "InActive" ? "active" : ""}
                  onClick={() => setStatusFilter("InActive")}
                >
                  InActive
                </button>
              </div>
            </div>

            <div className="ep-employee-list">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp, index) => (
                  <div
                    key={emp.code}
                    className="ep-emp-list-item"
                    onClick={() => selectEmployee(emp.code)}
                  >
                    <div className="ep-emp-initials">{index + 1}</div>
                    <div className="ep-emp-info">
                      <span className="ep-emp-name">{emp.name}</span>
                      <span className="ep-emp-meta">
                        {emp.code} • {emp.desig}
                      </span>
                    </div>
                    <ChevronRight color="var(--ion-color-primary)" size={18} />
                  </div>
                ))
              ) : (
                <div className="ep-no-results">No employees found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Theme Color Selection Bottom Sheet */}
      {showColorModal && (
        <div className="ep-overlay" onClick={() => setShowColorModal(false)}>
          <div className="ep-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ep-modal-handle"></div>
            <div className="ep-modal-header">
              <h3>Accent Color</h3>
              <button
                className="ep-close-btn"
                onClick={() => setShowColorModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="ep-color-grid">
              {themeColors.map(({ name, value, id }) => (
                <div key={id} className="ep-color-item">
                  <button
                    className={`ep-color-btn ${themeId === id ? "active" : ""}`}
                    style={{ backgroundColor: value }}
                    onClick={() => changeThemeColor(id)}
                  >
                    {themeId === id && (
                      <CheckCircle2
                        color="var(--ion-color-primary)"
                        size={24}
                      />
                    )}
                  </button>
                  <span className="ep-color-name">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Employee Registration Modal */}
      {showRegisterModal && (
        <div className="ep-overlay" onClick={() => setShowRegisterModal(false)}>
          <div
            className="ep-modal ep-modal-large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ep-modal-handle"></div>
            <div className="ep-modal-header">
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <button
                  className="ep-close-btn"
                  onClick={() => setShowRegisterModal(false)}
                >
                  <ArrowLeft size={20} />
                </button>
                <h3>
                  {isEditMode
                    ? "Update Employee Profile"
                    : "Register New Employee"}
                </h3>
              </div>
              <button
                className="ep-close-btn"
                onClick={() => setShowRegisterModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form className="ep-form" onSubmit={handleRegister}>
              <div className="ep-form-scrollable">
                {/* Personal Section */}
                <h4 className="ep-form-section-title">Personal Details</h4>
                <div className="ep-form-grid">
                  <div className="ep-input-group">
                    <label>Employee ID</label>
                    <input
                      name="_Employee_ID"
                      value={formData._Employee_ID}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>Employee Code</label>
                    <input
                      name="_Ecode"
                      value={formData._Ecode}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>Full Name</label>
                    <input
                      name="_Ename"
                      value={formData._Ename}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      name="_Email"
                      value={formData._Email}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>Mobile Number</label>
                    <input
                      type="tel"
                      name="_Mobile"
                      value={formData._Mobile}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      name="_Dob"
                      value={formData._Dob}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>Blood Group</label>
                    <input
                      name="_Blood"
                      value={formData._Blood}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>Pan No</label>
                    <input
                      name="_PanNo"
                      value={formData._PanNo}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>Aadhar No</label>
                    <input
                      name="_AadharNo"
                      value={formData._AadharNo}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                {/* Professional Section */}
                <h4 className="ep-form-section-title">Professional Details</h4>
                <div className="ep-form-grid">
                  <div className="ep-input-group">
                    <label>Designation</label>
                    <select
                      name="_Desig"
                      value={formData._Desig}
                      onChange={handleInputChange}
                      required
                      className="ep-select"
                    >
                      <option value="">Select Designation</option>
                      {designations.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ep-input-group">
                    <label>Department</label>
                    <select
                      name="_Dept"
                      value={formData._Dept}
                      onChange={handleInputChange}
                      required
                      className="ep-select"
                    >
                      <option value="">Select Department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ep-input-group">
                    <label>Joining Date</label>
                    <input
                      type="date"
                      name="_Doj"
                      value={formData._Doj}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>PF No</label>
                    <input
                      name="_PFNo"
                      value={formData._PFNo}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>ESI No</label>
                    <input
                      name="_ESINo"
                      value={formData._ESINo}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>Report To</label>
                    <select
                      name="_RequestTo"
                      value={formData._RequestTo}
                      onChange={handleInputChange}
                      className="ep-select"
                    >
                      <option value="">Select Manager</option>
                      {designations.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ep-input-group">
                    <label>Active Status</label>
                    <select
                      name="_IsActive"
                      value={formData._IsActive}
                      onChange={handleInputChange}
                      className="ep-select"
                    >
                      <option value="Y">Yes (Active)</option>
                      <option value="N">No (InActive)</option>
                    </select>
                  </div>
                  <div className="ep-input-group">
                    <label>Project</label>
                    <select
                      name="_Project"
                      value={formData._Project}
                      onChange={handleInputChange}
                      className="ep-select"
                    >
                      <option value="">Select Project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ep-input-group">
                    <label>Location Type</label>
                    <select
                      name="_LocationType"
                      value={formData._LocationType}
                      onChange={handleInputChange}
                      className="ep-select"
                    >
                      <option value="">Select Location Type</option>
                      {locationTypes.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ep-input-group">
                    <label>Location</label>
                    <select
                      name="_Location1"
                      value={formData._Location1}
                      onChange={handleInputChange}
                      className="ep-select"
                    >
                      <option value="">Select Location</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Salary Section */}
                <h4 className="ep-form-section-title">Salary & Leave</h4>
                <div className="ep-form-grid">
                  <div className="ep-input-group">
                    <label>Basic Salary</label>
                    <input
                      type="number"
                      name="_BasicSal"
                      value={formData._BasicSal}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>DA</label>
                    <input
                      type="number"
                      name="_DA"
                      value={formData._DA}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>HRA</label>
                    <input
                      type="number"
                      name="_HRA"
                      value={formData._HRA}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>LTA</label>
                    <input
                      type="number"
                      name="_LTA"
                      value={formData._LTA}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>Allowances</label>
                    <input
                      type="number"
                      name="_ALLOWANCES"
                      value={formData._ALLOWANCES}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>Gross Salary</label>
                    <input
                      type="number"
                      name="_GrossSal"
                      value={formData._GrossSal}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>Allowed CL</label>
                    <input
                      type="number"
                      name="_Allowed_CL"
                      value={formData._Allowed_CL}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>Allowed SL</label>
                    <input
                      type="number"
                      name="_Allowed_SL"
                      value={formData._Allowed_SL}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                {/* Banking Section */}
                <h4 className="ep-form-section-title">Banking Details</h4>
                <div className="ep-form-grid">
                  <div className="ep-input-group">
                    <label>Account No</label>
                    <input
                      name="_AccountNo"
                      value={formData._AccountNo}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>IFSC Code</label>
                    <input
                      name="_IFSCCode"
                      value={formData._IFSCCode}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>

              <div className="ep-form-actions">
                <button
                  type="button"
                  className="ep-btn-secondary"
                  onClick={() => setShowRegisterModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ep-btn-primary"
                  disabled={registerLoading}
                >
                  {registerLoading
                    ? isEditMode
                      ? "Updating..."
                      : "Registering..."
                    : isEditMode
                    ? "Update Changes"
                    : "Register Employee"}
                </button>
                {isEditMode && (
                  <button
                    type="button"
                    className="ep-btn-reporting"
                    onClick={openReportingModal}
                  >
                    Reporting Matrix
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reporting Matrix Modal */}
      {showReportingModal && (
        <div
          className="ep-overlay"
          onClick={() => setShowReportingModal(false)}
        >
          <div
            className="ep-modal ep-modal-management"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ep-modal-header">
              <h3>Reporting Matrix</h3>
              <button
                className="ep-close-btn"
                onClick={() => setShowReportingModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="ep-form-scrollable">
              {/* 🔥 TABLE VIEW */}
              <div className="ep-reporting-table">
                <table className="ep-table">
                  <thead>
                    <tr>
                      <th>Request Type</th>
                      <th>RA1</th>
                      <th>RA2</th>
                      <th>RA3</th>
                      <th>RA4</th>
                    </tr>
                  </thead>

                  <tbody>
                    {requestTypeOptions.map((type) => {
                      const row = reportingHistory.find(
                        (r) => (r.requestType || r.RequestType) === type,
                      );

                      return (
                        <tr key={type}>
                          {/* Request Type */}
                          <td>{type}</td>

                          {/* RA1 (readonly) */}
                          <td>
                            <select
                              value={row?.RA1 || row?.rA1 || ""}
                              onChange={(e) =>
                                updateReportingField(
                                  "RA1",
                                  e.target.value,
                                  type,
                                )
                              }
                              className="ep-select"
                            >
                              <option value="">Select</option>
                              <option value="-">-</option>
                              {ras.map((d, index) => (
                                <option key={index} value={d.name}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* RA2 */}
                          <td>
                            <select
                              value={row?.RA2 || row?.rA2 || ""}
                              onChange={(e) =>
                                updateReportingField(
                                  "RA2",
                                  e.target.value,
                                  type,
                                )
                              }
                              className="ep-select"
                            >
                              <option value="">Select</option>
                              <option value="-">-</option>
                              {ras.map((d, index) => (
                                <option key={index} value={d.name}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* RA3 */}
                          <td>
                            <select
                              value={row?.RA3 || row?.rA3 || ""}
                              onChange={(e) =>
                                updateReportingField(
                                  "RA3",
                                  e.target.value,
                                  type,
                                )
                              }
                              className="ep-select"
                            >
                              <option value="">Select</option>
                              <option value="-">-</option>
                              {ras.map((d, index) => (
                                <option key={index} value={d.name}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* RA4 */}
                          <td>
                            <select
                              value={row?.RA4 || row?.rA4 || ""}
                              onChange={(e) =>
                                updateReportingField(
                                  "RA4",
                                  e.target.value,
                                  type,
                                )
                              }
                              className="ep-select"
                            >
                              <option value="">Select</option>
                              <option value="-">-</option>
                              {ras.map((d, index) => (
                                <option key={index} value={d.name}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmpProfile;
