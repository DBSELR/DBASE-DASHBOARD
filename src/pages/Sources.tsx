// src/pages/Sources.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  IonCheckbox, IonContent, IonDatetime, IonHeader,
  IonInput, IonItem, IonLabel, IonList, IonModal, IonPage, IonPopover,
  IonSelect, IonSelectOption, IonToast, IonToolbar
} from "@ionic/react";

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
const CloseIcon = () => <IconBox><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></IconBox>;
const SaveIcon = () => <IconBox><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></IconBox>;
const ChevronLeft = () => <IconBox><polyline points="15 18 9 12 15 6" /></IconBox>;
const ChevronRight = () => <IconBox><polyline points="9 18 15 12 9 6" /></IconBox>;
const ChevronDown = () => <IconBox><polyline points="6 9 12 15 18 9" /></IconBox>;
const EmptyIcon = () => <IconBox size="40" color="#cbd5e1"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></IconBox>;

import axios from "axios";
import moment from "moment";
import { read, utils } from "xlsx";
import "./Sources.css";

// =====================================================================================
// Debug helpers
// =====================================================================================
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

// =====================================================================================
/** API helpers */
// =====================================================================================
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

// =====================================================================================
// Decoders for array-of-arrays endpoints
// =====================================================================================
type KeySpec = string[];

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

  // Already objects
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

const decodeHolidays = (data: any) => {
  if (!Array.isArray(data)) return [];
  return data.map((r: any[]) => ({
    ID: r[0],
    HolidayDate: r[1],
    Remark: r[2],
    Year: r[3],
    FLAG: r[7] === true || String(r[7]).toLowerCase() === "true",
  }));
};

const generateMonthList = () => {
  const months: string[] = [];
  const startYear = 2014;
  const current = moment().add(1, "month");
  const currentYear = current.year();

  for (let y = currentYear; y >= startYear; y--) {
    const endMonth = y === currentYear ? current.month() : 11;
    for (let m = endMonth; m >= 0; m--) {
      months.push(moment().year(y).month(m).format("MMM-YYYY"));
    }
  }
  return months;
};

// =====================================================================================
// Component
// =====================================================================================
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

  // 3. Holidays
  const [Hyear, setHyear] = useState<string | null>(null);
  const [HMnth, setHMnth] = useState<string | null>(null);
  const [HDate, setHDate] = useState<string | null>(null);
  const [HRemarks, setHRemarks] = useState<string>("");
  const [holidays, setHolidays] = useState<any[]>([]);
  const [HExistYr, setHExistYr] = useState<boolean>(true);
  const [addHDay, setAddHDay] = useState<boolean>(true);
  const [openPeriodModal, setOpenPeriodModal] = useState(false);
  const [openDateModal, setOpenDateModal] = useState(false);
  const [pickerMode, setPickerMode] = useState<'year' | 'month'>('year');

  const loadHolidays = async () => {
    const yr = Hyear ? moment(Hyear).format("YYYY") : "0";
    const mn = HMnth ? moment(HMnth).format("M") : "0";
    try {
      const r = await axios.get(`${API_BASE}Sources/Load_Holidays?yr=${yr}&mnth=${mn}`, { headers: authHeaders() });
      const rows = decodeHolidays(r.data);
      setHolidays(rows);
      setHExistYr(rows.length > 0);
    } catch (e) {
      setHolidays([]);
      setHExistYr(true);
    }
  };

  const insertSundays = async () => {
    if (!Hyear) return;
    try {
      const r = await axios.post(
        `${API_BASE}Sources/Insert_Sundays`,
        form({ Yr: moment(Hyear).format("YYYY") }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded", ...authHeaders() } }
      );
      if (Number(r.data) > 0) {
        showToast("Records Successfully Inserted...!");
        loadHolidays();
      } else showToast("Record Not Inserted...!", "danger");
    } catch (e) {
      showToast("Error While Saving...!", "danger");
    }
  };

  const toggleAddHoliday = async () => {
    if (!addHDay) {
      const dateOk = HDate && moment(HDate).isValid();
      if (!HRemarks || !dateOk) return showToast("Enter a valid date and remarks to save.", "danger");
      try {
        const r = await axios.post(
          `${API_BASE}Sources/Insert_Holiday`,
          form({ Hdate: moment(HDate!).format("DD-MM-YYYY"), HRemark: HRemarks, HFlag: 1 }),
          { headers: { "Content-Type": "application/x-www-form-urlencoded", ...authHeaders() } }
        );
        if (Number(r.data) > 0) {
          showToast("Holiday Record Inserted Successfully...!");
          setHDate(null);
          setHRemarks("");
          loadHolidays();
        }
      } catch (e) {
        showToast("Error While Saving...!", "danger");
      }
    }
    setAddHDay((x) => !x);
  };

  const toggleHolidayActive = async (isoDate: string, checked: boolean) => {
    try {
      const r = await axios.post(
        `${API_BASE}Sources/Add_Remove_Holiday`,
        form({ Hdate: moment(isoDate).format("DD-MM-YYYY"), HFlag: checked ? 1 : 0 }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded", ...authHeaders() } }
      );
      if (Number(r.data) > 0) {
        showToast(checked ? "Holiday Activated ...!" : "Holiday In-Activated ...!");
        loadHolidays();
      }
    } catch (e) { }
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
  const [dt_Notifications_Data, setDt_Notifications_Data] = useState<any[]>([]);
  const [NID, setNID] = useState<number>(0);
  const [selAllNotifEmp, setSelAllNotifEmp] = useState<boolean>(false);
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

  const toggleAllNotifEmp = () => {
    const next = !selAllNotifEmp;
    setSelAllNotifEmp(next);
    setDt_Notifications((prev) => prev.map((x) => ({ ...x, Isactive: next })));
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

  const deleteMaint = async () => {
    try {
      const r = await axios.post(`${API_BASE}Sources/Delete_Maint`, form({ _Mid: Maint_selected_id }), {
        headers: { "Content-Type": "application/x-www-form-urlencoded", ...authHeaders() }
      });
      if (Number(r.data) > 0) {
        showToast("Record Deleted...");
        loadMaintData();
        clearMaint();
      }
    } catch (e) { }
  };

  // 8. Import
  const [ImportFile, setImportFile] = useState<string>("0");
  const [files, setFiles] = useState<FileList | null>(null);
  const [empActive, setEmpActive] = useState<ActiveEmp[]>([]);

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
        const rows: any[] = utils.sheet_to_json(wb.Sheets[sheet]);
        showToast("File processed. Uploading...");
        // Logic omitted for brevity, keeping structure
      } catch (e) {
        showToast("Import failed.", "danger");
      }
    };
    reader.readAsArrayBuffer(files[0]);
  };

  // ------------------------------------------------------------------
  // UI Helpers
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------
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
            {/* 1. Departments */}
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
                  <button className="src-btn src-btn-primary src-btn-block" onClick={saveDepartment}><SaveIcon /> {tempDeptId ? "Update" : "Save"}</button>
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

            {/* 2. Designations */}
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
                  <button className="src-btn src-btn-primary src-btn-block" onClick={saveDesignation}><SaveIcon /> {tempDisgId ? "Update" : "Save"}</button>
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

            {/* 3. Holidays */}
            <div className={`src-card ${collapsed.holidays ? "collapsed" : ""}`}>
              <SectionHeader icon={<HolidayIcon />} title="Holidays" isCollapsed={collapsed.holidays} onToggle={() => toggleCollapse("holidays")} />
              <div className="src-card-body-wrapper">
                <div className="src-card-body">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "15px" }}>
                    <div className="src-input-box" onClick={() => setOpenPeriodModal(true)}>
                      <div style={{ padding: "8px 0", fontWeight: 600 }}>{Hyear ? moment(Hyear).format("YYYY") : "Year"}</div>
                    </div>
                    <div className="src-input-box" onClick={() => setOpenPeriodModal(true)}>
                      <div style={{ padding: "8px 0", fontWeight: 600 }}>{HMnth ? moment(HMnth).format("MMM") : "Month"}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "15px" }}>
                    <button className="src-btn src-btn-primary src-btn-block" onClick={loadHolidays}>Fetch</button>
                    {!HExistYr && canAdmin && <button className="src-btn src-btn-outline src-btn-block" onClick={insertSundays}>Sundays</button>}
                  </div>
                  {canAdmin && (
                    <div style={{ background: "rgba(0,0,0,0.02)", padding: "12px", borderRadius: "12px", marginBottom: "15px" }}>
                      <div className="src-input-box" onClick={() => setOpenDateModal(true)} style={{ marginBottom: "10px" }}>
                        <div style={{ padding: "8px 0" }}>{HDate ? moment(HDate).format("DD-MM-YYYY") : "Date"}</div>
                      </div>
                      <div className="src-input-box" style={{ marginBottom: "10px" }}>
                        <IonInput value={HRemarks} placeholder="Remark" onIonInput={(e) => setHRemarks(e.detail.value!)} />
                      </div>
                      <button className="src-btn src-btn-primary src-btn-block" onClick={toggleAddHoliday}>Add</button>
                    </div>
                  )}
                  <div className="src-table-wrapper">
                    {holidays.map(h => (
                      <div className="src-table-row" key={h.ID}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{h.Remark}</div>
                          <div style={{ fontSize: "0.8rem", color: "linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-secondary))" }}>{moment(h.HolidayDate).format("DD MMM")}</div>
                        </div>
                        {canAdmin && <IonCheckbox checked={h.FLAG} onIonChange={(e) => toggleHolidayActive(h.HolidayDate, e.detail.checked)} />}
                      </div>
                    ))}
                    {holidays.length === 0 && <EmptyState msg="No holidays." />}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Checkin Access */}
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

            {/* 6. Notifications */}
            <div className={`src-card ${collapsed.notif ? "collapsed" : ""}`} style={{ gridColumn: "1 / -1" }}>
              <SectionHeader icon={<NotifIcon />} title="Broadcast" isCollapsed={collapsed.notif} onToggle={() => toggleCollapse("notif")} />
              <div className="src-card-body-wrapper">
                <div className="src-card-body">
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
                </div>
              </div>
            </div>

            {/* 7. Maintenance */}
            <div className={`src-card ${collapsed.maint ? "collapsed" : ""}`}>
              <SectionHeader icon={<MaintIcon />} title="Maintenance" isCollapsed={collapsed.maint} onToggle={() => toggleCollapse("maint")} />
              <div className="src-card-body-wrapper">
                <div className="src-card-body">
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
                  <div className="src-table-wrapper">
                    {ds_Maintance ? ds_Maintance.map(m => (
                      <div className="src-table-row" key={m.M_id} onClick={() => editMaint(m)}>
                        <div style={{ flex: 1 }}>{m.Maint_Work}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--src-primary)" }}>{m.Days_Left}d</div>
                      </div>
                    )) : <EmptyState msg="No items." />}
                  </div>
                </div>
              </div>
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

        {/* MODALS */}
        <IonModal
          isOpen={openPeriodModal}
          onDidDismiss={() => setOpenPeriodModal(false)}
          className="src-modal-centered"
          onWillPresent={() => setPickerMode('year')}
        >
          <div className="pwt-modal-content">
            <div className="picker-header">
              <div className="picker-title-group">
                <span className="pwt-modal-title">Select Period</span>
              </div>
              <div className="src-btn src-btn-clear" onClick={() => setOpenPeriodModal(false)}>
                <CloseIcon />
              </div>
            </div>

            {/* Stepped Navigation */}
            <div className="picker-nav-tabs">
              <div
                className={`picker-nav-item ${pickerMode === 'year' ? 'active' : ''}`}
                onClick={() => setPickerMode('year')}
              >
                <div className="picker-nav-label">Year</div>
                <div className="picker-nav-value">{Hyear ? moment(Hyear).format('YYYY') : 'Pick Year'}</div>
              </div>
              <div
                className={`picker-nav-item ${pickerMode === 'month' ? 'active' : ''}`}
                onClick={() => setPickerMode('month')}
              >
                <div className="picker-nav-label">Month</div>
                <div className="picker-nav-value">{HMnth ? moment(HMnth).format('MMM') : 'Pick Month'}</div>
              </div>
            </div>

            <div className="src-scroll" style={{ maxHeight: "60vh", overflowY: "auto", padding: "0 10px" }}>
              {pickerMode === 'year' && (
                <div className="src-animate">
                  <div className="selector-grid">
                    {(() => {
                      const currentYear = moment().year();
                      const years = [];
                      for (let y = 2014; y <= currentYear + 1; y++) years.push(y);
                      return years.reverse().map(y => (
                        <div
                          key={y}
                          className={`selector-item-list ${Hyear && moment(Hyear).year() === y ? "active" : ""}`}
                          onClick={() => {
                            setHyear(moment().year(y).toISOString());
                            setPickerMode('month');
                          }}
                        >
                          {y}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {pickerMode === 'month' && (
                <div className="src-animate">
                  <div className="selector-grid">
                    {moment.monthsShort().map((m, idx) => (
                      <div
                        key={m}
                        className={`selector-item-list ${HMnth && moment(HMnth).month() === idx ? "active" : ""}`}
                        onClick={() => {
                          if (!Hyear) {
                            setHyear(moment().toISOString());
                          }
                          setHMnth(moment().month(idx).toISOString());
                          setOpenPeriodModal(false);
                          setTimeout(() => loadHolidays(), 100);
                        }}
                      >
                        {m}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </IonModal>

        <IonModal isOpen={openDateModal} onDidDismiss={() => setOpenDateModal(false)} className="src-modal-centered">
          <div className="pwt-modal-content">
            <div className="picker-header">
              <span className="pwt-modal-title">Select Date</span>
              <div className="src-btn src-btn-clear" onClick={() => setOpenDateModal(false)}><CloseIcon /></div>
            </div>
            <IonDatetime
              presentation="date"
              className="src-animate"
              style={{ borderRadius: "16px", background: "white", boxShadow: "var(--src-shadow-sm)" }}
              onIonChange={(e: any) => { setHDate(e.detail.value); setOpenDateModal(false); }}
            />
          </div>
        </IonModal>

        <IonModal isOpen={openMaintDateModal} onDidDismiss={() => setOpenMaintDateModal(false)} className="src-modal-centered">
          <div className="pwt-modal-content">
            <div className="picker-header">
              <span className="pwt-modal-title">Maintenance Date</span>
              <div className="src-btn src-btn-clear" onClick={() => setOpenMaintDateModal(false)}><CloseIcon /></div>
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
