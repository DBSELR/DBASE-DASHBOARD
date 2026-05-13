// src/pages/Sources.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  IonCheckbox, IonContent, IonDatetime, IonHeader,
  IonInput, IonItem, IonLabel, IonList, IonModal, IonPage, IonPopover,
  IonSelect, IonSelectOption, IonToast, IonToolbar, IonAlert, IonGrid, IonRow, IonCol, IonButton, IonIcon
} from "@ionic/react";

import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Typography,
  FormControlLabel,
} from "@mui/material";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { add, saveOutline, downloadOutline } from "ionicons/icons";

// Custom SVG Icons for a Native Feel (No IonIcons)
const IconBox = ({ children, color = "currentColor", size = "24" }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const DeptIcon = () => <IconBox><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></IconBox>;
const HolidayIcon = () => <IconBox><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></IconBox>;
const CheckinIcon = () => <IconBox><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></IconBox>;
const DesignationIcon = () => <IconBox><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></IconBox>;
const VendorIcon = () => <IconBox><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></IconBox>;
const MaintIcon = () => <IconBox><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></IconBox>;
const NotifIcon = () => <IconBox><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></IconBox>;
const ImportIcon = () => <IconBox><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></IconBox>;
const ChevronLeft = () => <IconBox><polyline points="15 18 9 12 15 6" /></IconBox>;
const ChevronRight = () => <IconBox><polyline points="9 18 15 12 9 6" /></IconBox>;
const ChevronDown = () => <IconBox><polyline points="6 9 12 15 18 9" /></IconBox>;
const EmptyIcon = () => <IconBox size="40" color="#cbd5e1"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></IconBox>;

import axios from "axios";
import moment from "moment";
import { read, utils } from "xlsx";
import "./Sources.css";

const DBG = true;
const log = (...args: any[]) => DBG && console.log("[Sources]", ...args);
const groupLog = (title: string, obj: any) => {
  if (!DBG) return;
  try {
    console.groupCollapsed(`🔎 ${title}`);
    Array.isArray(obj) ? console.table(obj) : console.log(obj);
    console.groupEnd();
  } catch {
    console.log(title, obj);
  }
};

import { API_BASE } from "../config";

const authHeaders = () => {
  const raw =
    localStorage.getItem("token") ||
    localStorage.getItem("Token") ||
    sessionStorage.getItem("token") ||
    "";
  const token = raw.replace(/^"|"$/g, "");
  return token
    ? {
      Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
    }
    : {};
};

const form = (obj: Record<string, any>) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && v !== null) p.append(k, String(v));
  });
  return p;
};

const postJSON = (path: string, payload: any) =>
  axios.post(`${API_BASE}${path}`, payload, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });

const decodeRows = (data: any, keys: KeySpec, title?: string) => {
  const out: any[] = [];
  if (!Array.isArray(data)) {
    groupLog(`${title || "decodeRows"} ❌ non-array response`, data);
    return out;
  }

  const looksArrayOfArrays =
    Array.isArray(data?.[0]) && !data?.[0]?.every?.((v: any) => typeof v === "object");
  if (looksArrayOfArrays) {
    for (const row of data) {
      const asObj: any = {};
      keys.forEach((k, i) => (asObj[k] = row[i]));
      out.push(asObj);
    }
    groupLog(`${title || "decodeRows"} ✅ decoded array-of-arrays`, out);
    return out;
  }

  groupLog(`${title || "decodeRows"} ↔ passed-through`, data);
  return data;
};

const decodeDepartments = (data: any) =>
  decodeRows(data, ["DID", "Department", "Isactive"], "Departments");

const decodeDesignations = (data: any) =>
  decodeRows(data, ["DS_ID", "Designation", "Isactive"], "Designations");

const decodeCheckin = (data: any) => {
  const rows = decodeRows(
    data,
    ["SlNo", "EmpName", "IsChekin_Enable", "EmpCode"],
    "Check-In Access"
  );
  return rows.map((r, i) => ({
    SlNo: r.SlNo ?? i + 1,
    EmpName: r.EmpName,
    IsChekin_Enable: !!r.IsChekin_Enable,
    EmpCode:
      r.EmpCode ||
      String(r.EmpName || "").split("_")?.[0]?.trim() ||
      "",
  }));
};

const decodeVendors = (data: any) =>
  decodeRows(data, ["VID", "Vendor_Type", "Vendor_Name", "GST_No"], "Vendors");

const decodeMaintMaster = (data: any) =>
  decodeRows(
    data,
    ["M_id", "Maint_Work", "Maint_Date", "Maint_Cycle", "Maint_By", "_U1", "Next_Maint_Date", "Days_Left"],
    "Maintenance Master Data"
  );

type ActiveEmp = {
  EmpCode: string;
  EmpName: string;
  Role?: string;
  Designation?: string;
  Mobile?: string;
};
const decodeEmployeesActive = (data: any): ActiveEmp[] => {
  if (!Array.isArray(data)) return [];
  const firstIsArray = Array.isArray(data[0]);
  if (firstIsArray) {
    const rows = data.map((r: any[]) => ({
      EmpCode: String(r[1] ?? ""),
      EmpName: String(r[0] ?? "").split("-").slice(1).join("-").trim() || String(r[0] ?? ""),
      DisplayName: String(r[0] ?? ""),
    }));
    return rows;
  }
  return data;
};

const decodeNotificationsMap = (data: any) => {
  if (!Array.isArray(data)) return [];
  return data.map((r: any[]) => ({
    SlNo: r[0],
    EmpName: r[1],
    EmpCode: r[2],
    Isactive: String(r[3]) === "true",
  }));
};

const decodeNotificationsData = (data: any) => {
  if (!Array.isArray(data)) return [];
  return data.map((r: any[]) => ({
    SlNo: r[0],
    Notification_Text: r[1],
    Isactive: String(r[2]) === "true",
    OrderId: r[3],
    Emp_Ids: r[4] || "",
  }));
};

const Sources: React.FC = () => {
  const [toast, setToast] = useState({
    open: false,
    msg: "",
    color: "success" as "success" | "danger",
  });
  const showToast = (msg: string, color: "success" | "danger" = "success") =>
    setToast({ open: true, msg, color });

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    dept: true,
    holidays: true,
    checkin: true,
    designation: true,
    vendor: true,
    maint: true,
    notif: true,
    import: true,
    reporting: true,
  });

  const toggleCollapse = (section: string) => {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);
  const role = String(user?.UserDesig || user?.designation || user?.role || "");
  const canAdmin = !role || /director|in-?charge f&a|admin/i.test(role);

  // 1. Departments
  const [DeptName, setDeptName] = useState("");
  const [depList, setDepList] = useState<any[]>([]);
  const [tempDeptId, setTempDeptId] = useState<number>(0);

  const loadDepartments = async () => {
    try {
      const r = await axios.get(`${API_BASE}Sources/Load_Department`, { headers: authHeaders() });
      setDepList(decodeDepartments(r.data));
    } catch (e) {
      setDepList([]);
    }
  };

  const saveDepartment = async () => {
    if (!DeptName.trim()) return showToast("Please Enter The Department Value...!", "danger");
    try {
      const r = await axios.post(
        `${API_BASE}Sources/Save_Department`,
        form({ _Department_ID: tempDeptId, _Department: DeptName.trim() }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded", ...authHeaders() } }
      );
      if (Number(r.data) > 0) {
        showToast("Record Successfully Submitted...!");
        setDeptName("");
        setTempDeptId(0);
        loadDepartments();
      } else showToast("Record Not Inserted...!", "danger");
    } catch (e) {
      showToast("Error While Sending...!", "danger");
    }
  };

  // 2. Designations
  const [Designation, setDesignation] = useState("");
  const [disgList, setDisgList] = useState<any[]>([]);
  const [tempDisgId, setTempDisgId] = useState<number>(0);

  const loadDesignations = async () => {
    try {
      const r = await axios.get(`${API_BASE}Sources/Load_Designation`, { headers: authHeaders() });
      setDisgList(decodeDesignations(r.data));
    } catch (e) {
      setDisgList([]);
    }
  };

  const saveDesignation = async () => {
    if (!Designation.trim()) return showToast("Please Enter The Designation Value...!", "danger");
    try {
      const r = await axios.post(
        `${API_BASE}Sources/Save_Designation`,
        form({ _Designation_ID: tempDisgId, _Designation: Designation.trim() }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded", ...authHeaders() } }
      );
      if (Number(r.data) > 0) {
        showToast("Record Successfully Submitted...!");
        setDesignation("");
        setTempDisgId(0);
        loadDesignations();
      } else showToast("Record Not Inserted...!", "danger");
    } catch (e) {
      showToast("Error While Sending...!", "danger");
    }
  };

  // 3. Holidays Management
  const [expanded, setExpanded] = useState(false);
  const [Hyear, setHyear] = useState<any>("");
  const [HMnth, setHMnth] = useState<any>("");
  const [HDate, setHDate] = useState<any>("");
  const [HRemarks, setHRemarks] = useState("");
  const [dt_Holidays, setDt_Holidays] = useState<any[]>([]);
  const [HExistYr, setHExistYr] = useState(false);
  const [addHDay, setAddHDay] = useState(true);
  const [addHDayCtrlName, setAddHDayCtrlName] = useState("Add Holiday");
  const [addHDayCtrlIconName, setAddHDayCtrlIconName] = useState(add);

  const loadHolidays = async () => {
    let tmpyr = "0";
    let tmpmnth = "0";
    if (Hyear !== "" && moment(Hyear).format("YYYY") !== "Invalid date") {
      tmpyr = moment(Hyear).format("YYYY");
    }
    if (HMnth !== "" && moment(HMnth).format("M") !== "Invalid date") {
      tmpmnth = moment(HMnth).format("M");
    }
    try {
      const res = await axios.get(`${API_BASE}Sources/Load_Holidays?yr=${tmpyr}&mnth=${tmpmnth}`, { headers: authHeaders() });
      if (!Array.isArray(res.data)) {
        setDt_Holidays([]);
        setHExistYr(false);
        return;
      }
      const formattedData = res.data.map((x: any[]) => ({
        ID: x[0],
        HolidayDate: x[1],
        Remark: x[2],
        Year: x[3],
        FLAG: x[7],
      }));
      setDt_Holidays(formattedData);
      setHExistYr(formattedData.length > 0);
    } catch (err) {
      setDt_Holidays([]);
      showToast("Error Loading Holidays...!", "danger");
    }
  };

  const insertSundays = async () => {
    if (!Hyear) return showToast("Please Select Year", "warning");
    try {
      await axios.post(`${API_BASE}Sources/Insert_Sundays`, { yr: moment(Hyear).format("YYYY") }, { headers: { "Content-Type": "application/json", ...authHeaders() } });
      showToast("Sundays Inserted Successfully...!");
      loadHolidays();
    } catch (err) {
      showToast("Error While Saving...!", "danger");
    }
  };

  const addHoliday = async () => {
    if (addHDay) {
      setAddHDay(false);
      setAddHDayCtrlName("Save Holiday");
      setAddHDayCtrlIconName(saveOutline);
      return;
    }
    if (!HDate || HRemarks.trim() === "") return showToast("Please enter date and remarks", "warning");
    try {
      await axios.post(`${API_BASE}Sources/Insert_Holiday`, { hDate: moment(HDate).format("DD-MM-YYYY"), hRemark: HRemarks, hFlag: "0" }, { headers: { "Content-Type": "application/json", ...authHeaders() } });
      showToast("Holiday Record Inserted Successfully...!");
      setHDate("");
      setHRemarks("");
      setAddHDay(true);
      setAddHDayCtrlName("Add Holiday");
      setAddHDayCtrlIconName(add);
      loadHolidays();
    } catch (err) {
      showToast("Error While Saving...!", "danger");
    }
  };

  const toggleHolidayActive = async (holidayDate: string, checked: boolean) => {
    try {
      await axios.post(`${API_BASE}Sources/Add_Remove_Holiday`, { hDate: moment(holidayDate).format("DD-MM-YYYY"), hFlag: checked ? "1" : "0" }, { headers: { "Content-Type": "application/json", ...authHeaders() } });
      showToast(checked ? "Holiday Activated...!" : "Holiday In-Activated...!");
      loadHolidays();
    } catch (err) {
      showToast("Error While Updating...!", "danger");
    }
  };

  // 4. Checkin
  const [checkMap, setCheckMap] = useState<any[]>([]);
  const loadCheckinAccess = async () => {
    try {
      const r = await axios.get(`${API_BASE}Sources/load_checkin_access`, { headers: authHeaders() });
      setCheckMap(decodeCheckin(r.data));
    } catch (e) {
      setCheckMap([]);
    }
  };

  const saveCheckinAccess = async (EmpCode: string, checked: boolean) => {
    try {
      const r = await axios.post(
        `${API_BASE}Sources/save_checkinaccess`,
        form({ _EmpCode: EmpCode, _Status: checked ? 1 : 0 }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded", ...authHeaders() } }
      );
      if (Number(r.data) > 0) {
        showToast("Check-In Access Save Successfully ....!");
        loadCheckinAccess();
      }
    } catch (e) { }
  };

  // 5. Vendors
  const [VID, setVID] = useState<string>("0");
  const [Vendor_Type, setVendor_Type] = useState<string>("");
  const [Vendor_Name, setVendor_Name] = useState<string>("");
  const [GST_No, setGST_No] = useState<string>("");
  const [vendors, setVendors] = useState<any[]>([]);

  const loadVendors = async () => {
    try {
      const r = await axios.get(`${API_BASE}Sources/Load_Vendor`, { headers: authHeaders() });
      setVendors(decodeVendors(r.data));
    } catch (e) {
      setVendors([]);
    }
  };

  const saveVendor = async () => {
    if (!Vendor_Type || !Vendor_Name.trim() || !GST_No.trim()) return showToast("Please enter vendor details...!", "danger");
    try {
      const r = await axios.post(
        `${API_BASE}Sources/Save_Vendor`,
        form({
          _VID: VID,
          _Vendor_Type: Vendor_Type,
          _Vendor_Name: Vendor_Name.trim(),
          _GST_No: GST_No.trim(),
          _EmpCode: user?.EmpCode || user?.empCode || "",
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded", ...authHeaders() } }
      );
      if (Number(r.data) > 0) {
        showToast("Record Successfully Submitted...!");
        setVID("0");
        setVendor_Name("");
        setVendor_Type("");
        setGST_No("");
        loadVendors();
      }
    } catch (e) { }
  };

  // 6. Notifications
  const [Notification, setNotification] = useState<string>("");
  const [dt_Notifications, setDt_Notifications] = useState<any[]>([]);
  const [notifExpanded, setNotifExpanded] = useState(false);
  const [dt_Notifications_Data, setDt_Notifications_Data] = useState<any[]>([]);
  const [NID, setNID] = useState<number>(0);
  const [notifSearch, setNotifSearch] = useState<string>("");

  const loadNotificationsMap = async () => {
    try {
      const r = await axios.get(`${API_BASE}Sources/load_notifications`, { headers: authHeaders() });
      setDt_Notifications(decodeNotificationsMap(r.data));
    } catch (e) {
      setDt_Notifications([]);
    }
  };

  const loadNotificationsData = async () => {
    try {
      const r = await axios.get(`${API_BASE}Sources/load_notification_data`, { headers: authHeaders() });
      setDt_Notifications_Data(decodeNotificationsData(r.data));
    } catch (e) {
      setDt_Notifications_Data([]);
    }
  };

  const clickNotifRow = (notif: any) => {
    setNotification(notif.Notification_Text || "");
    setNID(notif.OrderId || notif.NID || 0);
    const codes = String(notif.Emp_Ids || "").split(",").map(c => c.trim());
    setDt_Notifications((prev) => prev.map((emp) => ({
      ...emp,
      Isactive: codes.includes(String(emp.EmpCode))
    })));
  };

  const saveNotifications = async () => {
    const active = dt_Notifications.filter((x) => !!x.Isactive);
    const empIds = active.map((x) => x.EmpCode).filter(Boolean).join(",");
    try {
      const r = await axios.post(
        `${API_BASE}Sources/save_notifications`,
        form({ _NID: NID, _Notification_Text: Notification, _Emp_Ids: empIds, _Isactive: "true" }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded", ...authHeaders() } }
      );
      if (Number(r.data) > 0) {
        showToast("Notification Saved Successfully...");
        setNID(0);
        setNotification("");
        loadNotificationsData();
      }
    } catch (e) { }
  };

  const updateNotifStatus = async (nid: number, checked: boolean) => {
    try {
      const r = await postJSON(`/Sources/update_status`, { _NID: nid, _Isactive: checked ? 1 : 0 });
      if (Number(r.data) > 0) showToast("Status Updated...!");
    } catch (e) { }
  };

  // 7. Maintenance
  const [Maintance, setMaintance] = useState<string>("");
  const [Maintance_date, setMaintance_date] = useState<string | null>(null);
  const [cycledays, setCycledays] = useState<string>("");
  const [MaintEmpCode, setMaintEmpCode] = useState<string>("");
  const [MaintEmpName, setMaintEmpName] = useState<string>("");
  const [ds_Maintance, setDs_Maintance] = useState<any[] | null>(null);
  const [Maint_selected_id, setMaint_selected_id] = useState<number>(0);
  const [maintExpanded, setMaintExpanded] = useState(false);
  const [openMaintDateModal, setOpenMaintDateModal] = useState(false);
  const [maintEmpPopover, setMaintEmpPopover] = useState(false);

  const loadMaintData = async () => {
    try {
      const r = await axios.get(`${API_BASE}Sources/Load_Maint_Master_Data`, { headers: authHeaders() });
      const decoded = decodeMaintMaster(r.data);
      setDs_Maintance(decoded.length ? decoded : null);
    } catch (e) {
      setDs_Maintance(null);
    }
  };

  const clearMaint = () => {
    setMaintance("");
    setMaintance_date(null);
    setCycledays("");
    setMaintEmpCode("");
    setMaintEmpName("");
    setMaint_selected_id(0);
  };

  const saveMaint = async () => {
    const dt = Maintance_date ? moment(Maintance_date).format("YYYY-MM-DD") : "";
    const mem = MaintEmpCode ? `${MaintEmpCode}-${MaintEmpName}` : "";
    try {
      const r = await postJSON(`Sources/Save_Maint`, {
        _Mid: String(Maint_selected_id),
        _Maintance: Maintance,
        _Maintance_date: dt,
        _Maintance_Cycle: cycledays,
        _Maintance_Mem: mem,
      });
      if (r.data === "Department Save successfully" || Number(r.data) > 0) {
        showToast("Maintenance Record Saved...");
        loadMaintData();
        clearMaint();
      }
    } catch (e) { }
  };

  const editMaint = (row: any) => {
    setMaint_selected_id(Number(row.M_id));
    const parts = String(row.Maint_By || "").split("-");
    setMaintEmpCode((parts[0] || "").trim());
    setMaintEmpName(parts.slice(1).join("-").trim());
    setMaintance(row.Maint_Work || "");
    setMaintance_date(row.Maint_Date || null);
    setCycledays(row.Maint_Cycle || "");
  };

  // 8. Import
  const [ImportFile, setImportFile] = useState<string>("0");
  const [files, setFiles] = useState<FileList | null>(null);
  const [empActive, setEmpActive] = useState<any[]>([]);

  const loadEmployeesActive = async () => {
    try {
      const r = await axios.get(`${API_BASE}Sources/load_empployee`, { headers: authHeaders() });
      setEmpActive(decodeEmployeesActive(r.data));
    } catch (e) {
      setEmpActive([]);
    }
  };

  const handleImport = async () => {
    if (!files || !files.length) return showToast("Choose a file.", "danger");
    const reader = new FileReader();
    reader.onload = async (event: any) => {
      try {
        const wb = read(event.target.result);
        const sheet = wb.SheetNames[0];
        utils.sheet_to_json(wb.Sheets[sheet]);
        showToast("File processed. Uploading...");
      } catch (e) {
        showToast("Import failed.", "danger");
      }
    };
    reader.readAsArrayBuffer(files[0]);
  };

  const EmptyState = ({ msg }: { msg: string }) => (
    <div className="src-empty-state">
      <div className="src-empty-icon"><EmptyIcon /></div>
      <p>{msg}</p>
    </div>
  );

  const SectionHeader = ({ icon, title, isCollapsed, onToggle }: any) => (
    <div className="src-card-header" onClick={onToggle}>
      <div className="src-card-title-group">
        <div className="src-card-icon-box">{icon}</div>
        <span className="src-card-title">{title}</span>
      </div>
      <div className={`src-card-chevron ${!isCollapsed ? "expanded" : ""}`}>
        <ChevronDown />
      </div>
    </div>
  );

  useEffect(() => {
    loadDepartments();
    loadDesignations();
    loadVendors();
    loadEmployeesActive();
    loadCheckinAccess();
    loadNotificationsMap();
    loadNotificationsData();
    loadMaintData();
  }, []);

  return (
    <IonPage>
      <IonContent className="ion-no-padding">
        <div className="src-container src-animate">
          <div className="src-header-section">
            <div className="src-title-group">
              <h1 className="src-title">System Sources</h1>
              <p className="src-subtitle">Manage administrative configurations and shared data.</p>
            </div>
          </div>

          <div className="src-dashboard-grid">
            <div className={`src-card ${collapsed.dept ? "collapsed" : ""}`}>
              <SectionHeader icon={<DeptIcon />} title="Departments" isCollapsed={collapsed.dept} onToggle={() => toggleCollapse("dept")} />
              <div className="src-card-body-wrapper">
                <div className="src-card-body">
                  <div className="src-input-wrapper">
                    <label className="src-label">Name</label>
                    <div className="src-input-box">
                      <IonInput value={DeptName} placeholder="e.g. Finance" onIonInput={(e) => setDeptName(e.detail.value!)} />
                    </div>
                  </div>
                  <button className="src-btn src-btn-primary src-btn-block" onClick={saveDepartment}>Save</button>
                  <div className="src-table-wrapper">
                    <div className="src-table-header"><div className="src-table-col">Department</div></div>
                    {depList.map(d => (
                      <div className="src-table-row" key={d.DID} onClick={() => { setDeptName(d.Department); setTempDeptId(d.DID); }}>
                        <div className="src-table-col">{d.Department}</div>
                      </div>
                    ))}
                    {depList.length === 0 && <EmptyState msg="No departments." />}
                  </div>
                </div>
              </div>
            </div>

            <div className={`src-card ${collapsed.designation ? "collapsed" : ""}`}>
              <SectionHeader icon={<DesignationIcon />} title="Designations" isCollapsed={collapsed.designation} onToggle={() => toggleCollapse("designation")} />
              <div className="src-card-body-wrapper">
                <div className="src-card-body">
                  <div className="src-input-wrapper">
                    <label className="src-label">Name</label>
                    <div className="src-input-box">
                      <IonInput value={Designation} placeholder="e.g. Lead" onIonInput={(e) => setDesignation(e.detail.value!)} />
                    </div>
                  </div>
                  <button className="src-btn src-btn-primary src-btn-block" onClick={saveDesignation}>Save</button>
                  <div className="src-table-wrapper">
                    <div className="src-table-header"><div className="src-table-col">Designation</div></div>
                    {disgList.map(d => (
                      <div className="src-table-row" key={d.DS_ID} onClick={() => { setDesignation(d.Designation); setTempDisgId(d.DS_ID); }}>
                        <div className="src-table-col">{d.Designation}</div>
                      </div>
                    ))}
                    {disgList.length === 0 && <EmptyState msg="No designations." />}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Holidays Management dropdown */}
            <div className="src-card src-card-full src-card-accordion">
              <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} className="src-accordion-root">
                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'var(--src-primary)' }} />}>
                  <div className="src-card-title-group">
                    <div className="src-card-icon-box"><HolidayIcon /></div>
                    <div className="src-card-title">Holidays Management</div>
                  </div>
                </AccordionSummary>
                <AccordionDetails className="src-accordion-details">
                  <IonGrid>
                    <IonRow className="ion-align-items-center">
                      <IonCol size="12" sizeMd="4">
                        <TextField fullWidth type="date" label="Year" InputLabelProps={{ shrink: true }} value={Hyear} onChange={(e) => setHyear(e.target.value)} />
                      </IonCol>
                      <IonCol size="12" sizeMd="4">
                        <TextField fullWidth type="month" label="Month" InputLabelProps={{ shrink: true }} value={HMnth} onChange={(e) => setHMnth(e.target.value)} />
                      </IonCol>
                      <IonCol size="12" sizeMd="4" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {!HExistYr && Hyear && (
                          <button className="src-btn src-btn-warning src-btn-block" onClick={insertSundays} style={{ height: '56px' }}>
                            <IonIcon icon={downloadOutline} style={{ fontSize: '20px' }} /> SUNDAYS
                          </button>
                        )}
                        <button className="src-btn src-btn-primary src-btn-block" onClick={addHoliday} style={{ height: '56px' }}>
                          <IonIcon icon={addHDayCtrlIconName} style={{ fontSize: '20px' }} /> {addHDayCtrlName.toUpperCase()}
                        </button>
                      </IonCol>
                    </IonRow>
                    {!addHDay && (
                      <IonRow className="ion-margin-top">
                        <IonCol size="12" sizeMd="4">
                          <TextField fullWidth type="date" label="Date" InputLabelProps={{ shrink: true }} value={HDate} onChange={(e) => setHDate(e.target.value)} />
                        </IonCol>
                        <IonCol size="12" sizeMd="8">
                          <TextField fullWidth label="Remarks" value={HRemarks} onChange={(e) => setHRemarks(e.target.value)} />
                        </IonCol>
                      </IonRow>
                    )}
                    <IonRow className="ion-margin-top">
                      <IonCol size="12">
                        <div className="src-scroll-list" style={{ maxHeight: "400px", padding: '10px' }}>
                          <div className="src-grid-header">
                            <div style={{ flex: 1 }}>Date</div>
                            <div style={{ flex: 1, textAlign: 'center' }}>Status</div>
                            <div style={{ flex: 1, textAlign: 'right' }}>Remark</div>
                          </div>
                          {dt_Holidays.map((x, i) => (
                            <div key={i} className="src-grid-row" onClick={() => { setAddHDay(false); setAddHDayCtrlName("Save Holiday"); setAddHDayCtrlIconName(saveOutline); setHDate(moment(x.HolidayDate).format("YYYY-MM-DD")); setHRemarks(x.Remark); }}>
                              <div style={{ flex: 1, fontWeight: 700 }}>{i + 1} -- {moment(x.HolidayDate).format("DD-MM-YYYY")}</div>
                              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                                <FormControlLabel 
                                  control={<IonCheckbox checked={x.FLAG} onIonChange={(e) => { e.stopPropagation(); toggleHolidayActive(x.HolidayDate, e.detail.checked); }} />} 
                                  label="Active"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div style={{ flex: 1, textAlign: 'right', fontWeight: 600, color: 'var(--src-primary)', textTransform: 'uppercase' }}>
                                {x.Remark}
                              </div>
                            </div>
                          ))}
                          {dt_Holidays.length === 0 && <EmptyState msg="No holidays found." />}
                        </div>
                      </IonCol>
                    </IonRow>
                  </IonGrid>
                </AccordionDetails>
              </Accordion>
            </div>

            <div className={`src-card ${collapsed.checkin ? "collapsed" : ""}`}>
              <SectionHeader icon={<CheckinIcon />} title="Check-In Access" isCollapsed={collapsed.checkin} onToggle={() => toggleCollapse("checkin")} />
              <div className="src-card-body-wrapper">
                <div className="src-card-body">
                  <div className="src-scroll-list" style={{ maxHeight: "300px" }}>
                    {checkMap.map(r => (
                      <div className="src-checkbox-row" key={r.EmpCode}>
                        <div className="src-emp-info">
                          <span className="src-emp-name">{r.EmpName}</span>
                          <span className="src-emp-code">{r.EmpCode}</span>
                        </div>
                        <IonCheckbox checked={r.IsChekin_Enable} onIonChange={(e) => saveCheckinAccess(r.EmpCode, e.detail.checked)} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Vendors */}
            <div className={`src-card ${collapsed.vendor ? "collapsed" : ""}`}>
              <SectionHeader icon={<VendorIcon />} title="Vendors" isCollapsed={collapsed.vendor} onToggle={() => toggleCollapse("vendor")} />
              <div className="src-card-body-wrapper">
                <div className="src-card-body">
                  <div className="src-input-box" style={{ marginBottom: "10px" }}>
                    <IonInput value={Vendor_Name} placeholder="Vendor Name" onIonInput={(e) => setVendor_Name(e.detail.value!)} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "15px" }}>
                    <div className="src-input-box">
                      <IonSelect value={Vendor_Type} interface="popover" placeholder="Type" onIonChange={(e) => setVendor_Type(e.detail.value)}>
                        <IonSelectOption value="Service">Service</IonSelectOption>
                        <IonSelectOption value="Product">Product</IonSelectOption>
                      </IonSelect>
                    </div>
                    <div className="src-input-box">
                      <IonInput value={GST_No} placeholder="GST" onIonInput={(e) => setGST_No(e.detail.value!)} />
                    </div>
                  </div>
                  <button className="src-btn src-btn-primary src-btn-block" onClick={saveVendor}>Save</button>
                  <div className="src-scroll-list" style={{ maxHeight: "350px", marginTop: "20px" }}>
                    {vendors.map(v => (
                      <div className="src-table-row premium-list-item" key={v.VID} onClick={() => { setVID(String(v.VID)); setVendor_Name(v.Vendor_Name); setVendor_Type(v.Vendor_Type); setGST_No(v.GST_No); }}>
                        <div className="src-card-icon-box" style={{ width: "12px", height: "12px", minWidth: "12px", marginRight: "8px", background: "var(--src-primary-glow)" }}>
                          <VendorIcon />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--src-text-heading)" }}>{v.Vendor_Name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--src-primary)", fontWeight: 600, display: "flex", gap: "8px", marginTop: "2px" }}>
                            <span>{v.Vendor_Type}</span>
                            {v.GST_No && <span style={{ color: "var(--src-text-muted)" }}>• GST: {v.GST_No}</span>}
                          </div>
                        </div>
                        <div className="src-card-chevron"><ChevronRight /></div>
                      </div>
                    ))}
                    {vendors.length === 0 && <EmptyState msg="No vendors registered." />}
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Broadcast dropdown */}
            <div className="src-card src-card-accordion">
              <Accordion expanded={notifExpanded} onChange={() => setNotifExpanded(!notifExpanded)} className="src-accordion-root">
                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'var(--src-primary)' }} />}>
                  <div className="src-card-title-group">
                    <div className="src-card-icon-box"><NotifIcon /></div>
                    <div className="src-card-title">Broadcast</div>
                  </div>
                </AccordionSummary>
                <AccordionDetails className="src-accordion-details">
                  <div className="src-notif-row">
                    <div className="src-pane">
                      <div className="src-pane-title">Composer</div>
                      <div className="src-input-box" style={{ minHeight: "80px", marginBottom: "15px" }}>
                        <IonInput value={Notification} placeholder="Message content..." onIonInput={(e) => setNotification(e.detail.value!)} />
                      </div>
                      <button className="src-btn src-btn-primary" onClick={saveNotifications}>Send Broadcast</button>

                      <div className="src-scroll-list" style={{ marginTop: "20px" }}>
                        {dt_Notifications_Data.map(n => (
                          <div className="src-checkbox-row" key={n.OrderId} onClick={() => clickNotifRow(n)}>
                            <div className="src-emp-info">
                              <span style={{ fontWeight: 600 }}>{n.Notification_Text}</span>
                            </div>
                            <IonCheckbox checked={n.Isactive} onIonChange={(e) => updateNotifStatus(n.OrderId || n.NID, e.detail.checked)} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="src-pane">
                      <div className="src-pane-title">Participants ({dt_Notifications.filter(x => x.Isactive).length})</div>
                      <div className="src-input-box" style={{ marginBottom: "10px" }}>
                        <IonInput value={notifSearch} placeholder="Filter participants..." onIonInput={(e) => setNotifSearch(e.detail.value!)} />
                      </div>
                      <div className="src-scroll-list">
                        {dt_Notifications.filter(x => !notifSearch || x.EmpName.toLowerCase().includes(notifSearch.toLowerCase())).map((emp, i) => (
                          <div className="src-checkbox-row" key={i} onClick={() => {
                            const next = !emp.Isactive;
                            setDt_Notifications(p => p.map((x, j) => i === j ? { ...x, Isactive: next } : x));
                          }}>
                            <div className="src-emp-info">
                              <span className="src-emp-name">{emp.EmpName}</span>
                              <span className="src-emp-code">{emp.EmpCode}</span>
                            </div>
                            <IonCheckbox checked={emp.Isactive} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </AccordionDetails>
              </Accordion>
            </div>

            {/* 7. Maintenance dropdown */}
            <div className="src-card src-card-full src-card-accordion">
              <Accordion expanded={maintExpanded} onChange={() => setMaintExpanded(!maintExpanded)} className="src-accordion-root">
                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'var(--src-primary)' }} />}>
                  <div className="src-card-title-group">
                    <div className="src-card-icon-box"><MaintIcon /></div>
                    <div className="src-card-title">Maintenance</div>
                  </div>
                </AccordionSummary>
                <AccordionDetails className="src-accordion-details">
                  <div className="src-input-box" style={{ marginBottom: "10px" }}>
                    <IonInput value={Maintance} placeholder="Work Description" onIonInput={(e) => setMaintance(e.detail.value!)} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "15px" }}>
                    <div className="src-input-box" onClick={() => setMaintEmpPopover(true)}>
                      <div style={{ padding: "8px 0" }}>{MaintEmpName || "Staff"}</div>
                    </div>
                    <div className="src-input-box">
                      <IonInput type="number" value={cycledays} placeholder="Days" onIonInput={(e) => setCycledays(e.detail.value!)} />
                    </div>
                  </div>
                  <button className="src-btn src-btn-primary src-btn-block" onClick={saveMaint}>Save Maintenance</button>
                  <div className="src-table-wrapper" style={{ marginTop: '20px' }}>
                    {ds_Maintance ? ds_Maintance.map(m => (
                      <div className="src-table-row" key={m.M_id} onClick={() => editMaint(m)}>
                        <div style={{ flex: 1 }}>{m.Maint_Work}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--src-primary)" }}>{m.Days_Left}d</div>
                      </div>
                    )) : <EmptyState msg="No items." />}
                  </div>
                </AccordionDetails>
              </Accordion>
            </div>

            {/* 8. Import */}
            <div className={`src-card ${collapsed.import ? "collapsed" : ""}`}>
              <SectionHeader icon={<ImportIcon />} title="Process Import" isCollapsed={collapsed.import} onToggle={() => toggleCollapse("import")} />
              <div className="src-card-body-wrapper">
                <div className="src-card-body">
                  <div className="src-input-box" style={{ marginBottom: "10px" }}>
                    <IonSelect value={ImportFile} interface="popover" placeholder="Select Entity" onIonChange={(e) => setImportFile(e.detail.value)}>
                      <IonSelectOption value="Productivity">Productivity</IonSelectOption>
                      <IonSelectOption value="Attendance">Attendance</IonSelectOption>
                    </IonSelect>
                  </div>
                  <input type="file" onChange={(e) => setFiles(e.target.files)} style={{ width: "100%", marginBottom: "15px" }} />
                  <button className="src-btn src-btn-accent src-btn-block" onClick={handleImport}>Execute Import</button>
                </div>
              </div>
            </div>

            {/* 9. Reporting Matrix */}
            {/* <div className={`src-card ${collapsed.reporting ? "collapsed" : ""}`}>
  <SectionHeader
    icon={<DeptIcon />}
    title="Reporting Matrix"
    isCollapsed={collapsed.reporting}
    onToggle={() => toggleCollapse("reporting")}   // ✅ FIX
  />

  <div className="src-card-body-wrapper">
    <div className="src-card-body">

      <div className="src-table-wrapper">

        <div className="src-table-header">
          <div className="src-table-col">Request Type</div>
          <div className="src-table-col">Condition</div>
          <div className="src-table-col">RA1</div>
          <div className="src-table-col">RA2</div>
          <div className="src-table-col">RA3</div>
          <div className="src-table-col">RA4</div>
        </div>

        {[
          ["Equipment", "Up to ₹5,000", "Level1 RA", "Network Admin", "Admin", "-"],
          ["Equipment", "Above ₹5,000", "Level1 RA", "Network Admin", "Admin", "Director"],
          ["Work Report", "Daily", "Level1 RA", "-", "-", "-"],
          ["Leave", "2 Days or Less per month", "Level1 RA", "HR", "-", "-"],
          ["Leave", "2-4 Days per month", "Level1 RA", "Level2 RA", "HR", "-"],
          ["Leave", "More Than 4 Days per month", "Level1 RA", "Level2 RA", "HR", "Director"],
          ["Permission", "-", "Level1 RA", "HR", "-", "-"],
          ["On Duty", "Local Travel / Same Day", "Level1 RA", "HR", "-", "-"],
          ["On Duty", "Outstation / Multiple Days", "Level1 RA", "HR", "Director", "-"],
          ["Over Time", "Up to 4 Hour", "Level1 RA", "HR", "-", "-"],
          ["Over Time", "4-8 Hour", "Level1 RA", "Level2 RA", "HR", "-"],
          ["Over Time", "More than 8 Hour", "Level1 RA", "Level2 RA", "HR", "Director"],
          ["Special Request", "-", "Level1 RA", "HR", "Admin", "Director"],
        ].map((row, index) => (
          <div className="src-table-row" key={index}>
            {row.map((col, i) => (
              <div className="src-table-col" key={i}>{col}</div>
            ))}
          </div>
        ))}

      </div>

    </div>
  </div>
</div> */}
          </div>
        </div>

        <IonModal isOpen={openMaintDateModal} onDidDismiss={() => setOpenMaintDateModal(false)} className="src-modal-centered">
          <div className="pwt-modal-content">
            <div className="picker-header">
              <span className="pwt-modal-title">Maintenance Date</span>
              <div className="src-btn src-btn-clear" onClick={() => setOpenMaintDateModal(false)}><ChevronDown /></div>
            </div>
            <IonDatetime
              presentation="date"
              className="src-animate"
              style={{ borderRadius: "16px", background: "white", boxShadow: "var(--src-shadow-sm)" }}
              onIonChange={(e: any) => { setMaintance_date(e.detail.value); setOpenMaintDateModal(false); }}
            />
          </div>
        </IonModal>

        <IonPopover isOpen={maintEmpPopover} onDidDismiss={() => setMaintEmpPopover(false)}>
          <div style={{ padding: '10px', maxHeight: '400px', overflowY: 'auto' }}>
            {empActive.map(x => (
              <div key={x.EmpCode} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer' }} onClick={() => { setMaintEmpCode(x.EmpCode); setMaintEmpName(x.EmpName); setMaintEmpPopover(false); }}>
                {x.EmpName} ({x.EmpCode})
              </div>
            ))}
          </div>
        </IonPopover>

        <IonToast isOpen={toast.open} message={toast.msg} color={toast.color} duration={2000} onDidDismiss={() => setToast(p => ({ ...p, open: false }))} />
      </IonContent>
    </IonPage>
  );
};

export default Sources;
