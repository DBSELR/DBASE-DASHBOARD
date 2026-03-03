// src/pages/Sources.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  IonButton,
  IonCheckbox,
  IonContent,
  IonDatetime,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonPopover,
  IonSelect,
  IonSelectOption,
  IonToast,
  IonToolbar,
  IonAccordion,
  IonAccordionGroup,
} from "@ionic/react";
import { checkmarkCircle } from "ionicons/icons";

import axios from "axios";
import moment from "moment";
import { read, utils } from "xlsx";

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
const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE?.replace(/\/+$/g, "") ||
  "http://localhost:25918/api";

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
// Decoders for array-of-arrays endpoints  (with console diagnostics)
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

// Specialized normalizers
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
      String(r.EmpName || "").split("_")?.[0]?.trim() || // fallback from "1501_NAME"
      "",
  }));
};

const decodeVendors = (data: any) =>
  decodeRows(data, ["VID", "Vendor_Type", "Vendor_Name", "GST_No"], "Vendors");

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
    // ["1501","1501-NAME","Role","Designation","Mobile"]
    const rows = data.map((r: any[]) => ({
      EmpCode: String(r[0] ?? ""),
      EmpName: String(r[1] ?? ""),
      Role: String(r[2] ?? ""),
      Designation: String(r[3] ?? ""),
      Mobile: String(r[4] ?? ""),
    }));
    groupLog("Employees Active ✅ decoded array-of-arrays", rows);
    return rows;
  }
  groupLog("Employees Active ↔ passed-through", data);
  return data;
};

// =====================================================================================
// Component
// =====================================================================================
const Sources: React.FC = () => {
  // toast
  const [toast, setToast] = useState({
    open: false,
    msg: "",
    color: "success" as "success" | "danger",
  });
  const showToast = (msg: string, color: "success" | "danger" = "success") =>
    setToast({ open: true, msg, color });

  // Permissions (simple)
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);
  const role = String(user?.UserDesig || user?.designation || user?.role || "");
  const canAdmin = !role || /director|in-?charge f&a|admin/i.test(role);

  // ------------------------------------------------------------------
  // Departments
  // ------------------------------------------------------------------
  const [DeptName, setDeptName] = useState("");
  const [depList, setDepList] = useState<any[]>([]);
  const [tempDeptId, setTempDeptId] = useState<number>(0);

  const loadDepartments = async () => {
    try {
      const r = await axios.get(`${API_BASE}/Sources/Load_Department`, {
        headers: authHeaders(),
      });
      setDepList(decodeDepartments(r.data));
    } catch (e) {
      console.error("Load_Department error", e);
      setDepList([]);
    }
  };
  const saveDepartment = async () => {
    if (!DeptName.trim())
      return showToast("Please Enter The Department Value...!", "danger");
    try {
      const r = await axios.post(
        `${API_BASE}/Sources/Save_Department`,
        form({ _Department_ID: tempDeptId, _Department: DeptName.trim() }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...authHeaders(),
          },
        }
      );
      if (Number(r.data) > 0) {
        showToast("Record Successfully Submitted...!");
        setDeptName("");
        setTempDeptId(0);
        loadDepartments();
      } else showToast("Record Not Inserted...!", "danger");
    } catch (e) {
      console.error("Save_Department error", e);
      showToast("Error While Sending...!", "danger");
    }
  };

  // ------------------------------------------------------------------
  // Designations
  // ------------------------------------------------------------------
  const [Designation, setDesignation] = useState("");
  
  const [disgList, setDisgList] = useState<any[]>([]);
  const [tempDisgId, setTempDisgId] = useState<number>(0);

  const loadDesignations = async () => {
    try {
      const r = await axios.get(`${API_BASE}/Sources/Load_Designation`, {
        headers: authHeaders(),
      });
      setDisgList(decodeDesignations(r.data));
    } catch (e) {
      console.error("Load_Designation error", e);
      setDisgList([]);
    }
  };
  const saveDesignation = async () => {
    if (!Designation.trim())
      return showToast("Please Enter The Designation Value...!", "danger");
    try {
      const r = await axios.post(
        `${API_BASE}/Sources/Save_Designation`,
        form({ _Designation_ID: tempDisgId, _Designation: Designation.trim() }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...authHeaders(),
          },
        }
      );
      if (Number(r.data) > 0) {
        showToast("Record Successfully Submitted...!");
        setDesignation("");
        setTempDisgId(0);
        loadDesignations();
      } else showToast("Record Not Inserted...!", "danger");
    } catch (e) {
      console.error("Save_Designation error", e);
      showToast("Error While Sending...!", "danger");
    }
  };

  // ------------------------------------------------------------------
  // Holidays
  // ------------------------------------------------------------------
  const [Hyear, setHyear] = useState<string | null>(null);
  const [HMnth, setHMnth] = useState<string | null>(null);
  const [HDate, setHDate] = useState<string | null>(null);
  const [HRemarks, setHRemarks] = useState<string>("");
  const [holidays, setHolidays] = useState<any[]>([]);
  const [HExistYr, setHExistYr] = useState<boolean>(true);
  const [addHDay, setAddHDay] = useState<boolean>(true);
  const [openYearModal, setOpenYearModal] = useState(false);
  const [openMonthModal, setOpenMonthModal] = useState(false);
  const [openDateModal, setOpenDateModal] = useState(false);

  const loadHolidays = async () => {
    const yr = Hyear ? moment(Hyear).format("YYYY") : "0";
    const mn = HMnth ? moment(HMnth).format("M") : "0";
    try {
      const r = await axios.get(
        `${API_BASE}/Sources/Load_Holidays?yr=${yr}&mnth=${mn}`,
        { headers: authHeaders() }
      );
      groupLog("Holidays raw", r.data);
      const rows = Array.isArray(r.data) ? r.data : [];
      setHolidays(rows);
      setHExistYr(rows.length > 0);
    } catch (e) {
      console.error("Load_Holidays error", e);
      setHolidays([]);
      setHExistYr(true);
    }
  };
  const insertSundays = async () => {
    if (!Hyear) return;
    try {
      const r = await axios.post(
        `${API_BASE}/Sources/Insert_Sundays`,
        form({ Yr: moment(Hyear).format("YYYY") }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...authHeaders(),
          },
        }
      );
      if (Number(r.data) > 0) {
        showToast("Records Successfully Inserted...!");
        loadHolidays();
      } else showToast("Record Not Inserted...!", "danger");
    } catch (e) {
      console.error("Insert_Sundays error", e);
      showToast("Error While Saving...!", "danger");
    }
  };
  const toggleAddHoliday = async () => {
    if (!addHDay) {
      const dateOk = HDate && moment(HDate).isValid();
      if (!HRemarks || !dateOk)
        return showToast("Enter a valid date and remarks to save.", "danger");

      try {
        const r = await axios.post(
          `${API_BASE}/Sources/Insert_Holiday`,
          form({
            Hdate: moment(HDate!).format("DD-MM-YYYY"),
            HRemark: HRemarks,
            HFlag: 1,
          }),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              ...authHeaders(),
            },
          }
        );
        if (Number(r.data) > 0) {
          showToast("Holiday Record Inserted Successfully...!");
          setHDate(null);
          setHRemarks("");
          loadHolidays();
        } else showToast("Record Not Inserted...!", "danger");
      } catch (e) {
        console.error("Insert_Holiday error", e);
        showToast("Error While Saving...!", "danger");
      }
    }
    setAddHDay((x) => !x);
  };
  const toggleHolidayActive = async (isoDate: string, checked: boolean) => {
    try {
      const r = await axios.post(
        `${API_BASE}/Sources/Add_Remove_Holiday`,
        form({
          Hdate: moment(isoDate).format("DD-MM-YYYY"),
          HFlag: checked ? 1 : 0,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...authHeaders(),
          },
        }
      );
      if (Number(r.data) > 0) {
        showToast(checked ? "Holiday Activated ...!" : "Holiday In-Activated ...!");
        loadHolidays();
      } else showToast("Record Updation Failed...!", "danger");
    } catch (e) {
      console.error("Add_Remove_Holiday error", e);
      showToast("Error While Saving...!", "danger");
    }
  };

  // ------------------------------------------------------------------
  // Check-In Access
  // ------------------------------------------------------------------
  const [checkMap, setCheckMap] = useState<any[]>([]);
  const loadCheckinAccess = async () => {
    try {
      const r = await axios.get(`${API_BASE}/Sources/load_checkin_access`, {
        headers: authHeaders(),
      });
      setCheckMap(decodeCheckin(r.data));
    } catch (e) {
      console.error("load_checkin_access error", e);
      setCheckMap([]);
    }
  };
  const saveCheckinAccess = async (EmpCode: string, checked: boolean) => {
    try {
      const r = await axios.post(
        `${API_BASE}/Sources/save_checkinaccess`,
        form({ _EmpCode: EmpCode, _Status: checked ? 1 : 0 }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...authHeaders(),
          },
        }
      );
      if (Number(r.data) > 0) {
        showToast("Check-In Access Save Successfully ....!");
        loadCheckinAccess();
      } else showToast("Save Error.......!", "danger");
    } catch (e) {
      console.error("save_checkinaccess error", e);
      showToast("Error", "danger");
    }
  };

  // ------------------------------------------------------------------
  // Vendor Master
  // ------------------------------------------------------------------
  const [VID, setVID] = useState<string>("0");
  const [Vendor_Type, setVendor_Type] = useState<string>("");
  const [Vendor_Name, setVendor_Name] = useState<string>("");
  const [GST_No, setGST_No] = useState<string>("");
  const [vendors, setVendors] = useState<any[]>([]);

  const loadVendors = async () => {
    try {
      const r = await axios.get(`${API_BASE}/Sources/Load_Vendor`, {
        headers: authHeaders(),
      });
      setVendors(decodeVendors(r.data));
    } catch (e) {
      console.error("Load_Vendor error", e);
      setVendors([]);
    }
  };
  const saveVendor = async () => {
    if (!Vendor_Type || !Vendor_Name.trim() || !GST_No.trim())
      return showToast("Please enter vendor details...!", "danger");
    try {
      const r = await axios.post(
        `${API_BASE}/Sources/Save_Vendor`,
        form({
          _VID: VID,
          _Vendor_Type: Vendor_Type,
          _Vendor_Name: Vendor_Name.trim(),
          _GST_No: GST_No.trim(),
          _EmpCode: user?.EmpCode || user?.empCode || "",
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...authHeaders(),
          },
        }
      );
      if (Number(r.data) > 0) {
        showToast("Record Successfully Submitted...!");
        setVID("0");
        setVendor_Type("");
        setVendor_Name("");
        setGST_No("");
        loadVendors();
      } else showToast("Record Not Inserted...!", "danger");
    } catch (e) {
      console.error("Save_Vendor error", e);
      showToast("Error While Saving...!", "danger");
    }
  };

  // ------------------------------------------------------------------
  // Employees (Active) - used for Maint picker
  // ------------------------------------------------------------------
  const [empActive, setEmpActive] = useState<ActiveEmp[]>([]);
  const loadEmployeesActive = async () => {
    try {
      const r = await axios.get(
        `${API_BASE}/Employee/Load_Employees?SearchEmp=Active`,
        { headers: authHeaders() }
      );
      setEmpActive(decodeEmployeesActive(r.data));
    } catch (e) {
      console.error("Load_Employees Active error", e);
      setEmpActive([]);
    }
  };

  // ------------------------------------------------------------------
  // Notifications
  // ------------------------------------------------------------------
  const [Notification, setNotification] = useState<string>("");
  const [dt_Notifications, setDt_Notifications] = useState<any[]>([]);
  const [dt_Notifications_Data, setDt_Notifications_Data] = useState<any[]>(
    []
  );
  const [NID, setNID] = useState<number>(0);
  const [selAllNotifEmp, setSelAllNotifEmp] = useState<boolean>(false);

  const loadNotificationsMap = async () => {
    try {
      const r = await axios.get(`${API_BASE}/Sources/load_notifications`, {
        headers: authHeaders(),
      });
      const rows = Array.isArray(r.data) ? r.data : [];
      setDt_Notifications(rows);
      groupLog("Notifications Map", rows);
    } catch (e) {
      console.error("load_notifications error", e);
      setDt_Notifications([]);
    }
  };
  const loadNotificationsData = async () => {
    try {
      const r = await axios.get(
        `${API_BASE}/Sources/load_notification_data`,
        { headers: authHeaders() }
      );
      const rows = Array.isArray(r.data) ? r.data : [];
      setDt_Notifications_Data(rows);
      groupLog("Notifications Data", rows);
    } catch (e) {
      console.error("load_notification_data error", e);
      setDt_Notifications_Data([]);
    }
  };
  const toggleAllNotifEmp = () => {
    const next = !selAllNotifEmp;
    setSelAllNotifEmp(next);
    setDt_Notifications((prev) => prev.map((x) => ({ ...x, Isactive: next })));
  };
  const clickNotifRow = async (nid: number) => {
    try {
      const r = await axios.get(
        `${API_BASE}/Sources/load_notifi_data?NID=${nid}`,
        { headers: authHeaders() }
      );
      const rows = Array.isArray(r.data) ? r.data : [];
      if (rows.length) {
        setNotification(rows[0]["Notification_Text"] ?? "");
        setNID(nid);
      }
    } catch (e) {
      console.error("load_notifi_data error", e);
    }
  };
  const saveNotifications = async () => {
    const active = dt_Notifications.filter((x) => !!x.Isactive);
    const empIds = active
      .map(
        (x) =>
          x.EmpCode ||
          String(x.EmpName || "").split("_")?.[0]?.trim() || // map from "1501_NAME"
          ""
      )
      .filter(Boolean)
      .join(",");
    try {
      const r = await axios.post(
        `${API_BASE}/Sources/save_notifications`,
        form({
          _NID: NID,
          _Notification_Text: Notification,
          _Emp_Ids: empIds,
          _Isactive: "true",
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...authHeaders(),
          },
        }
      );
      if (Number(r.data) > 0) {
        showToast("Notification Data Save successfully...");
        setNID(0);
        setNotification("");
        loadNotificationsData();
      }
    } catch (e) {
      console.error("save_notifications error", e);
    }
  };

  // ⚠️ FIXED: send JSON (not form-encoded) to avoid 415 on update_status
  const updateNotifStatus = async (nid: number, checked: boolean) => {
    try {
      const payload = { _NID: nid, _Isactive: checked ? 1 : 0 };
      const r = await postJSON(`/Sources/update_status`, payload);
      if (Number(r.data) > 0) showToast("Notification Status Updated...!");
    } catch (e) {
      console.error("update_status error", e);
      showToast("Update failed (status).", "danger");
    }
  };

  // ------------------------------------------------------------------
  // Maintenance
  // ------------------------------------------------------------------
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
      const r = await axios.get(
        `${API_BASE}/Sources/Load_Maint_Master_Data`,
        { headers: authHeaders() }
      );
      const rows = Array.isArray(r.data) ? r.data : [];
      setDs_Maintance(rows.length ? rows : null);
      groupLog("Load_Maint_Master_Data", rows);
    } catch (e) {
      console.error("Load_Maint_Master_Data error", e);
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
      const r = await axios.post(
        `${API_BASE}/Sources/Save_Maint`,
        form({
          _Mid: Maint_selected_id,
          _Maintance: Maintance,
          _Maintance_date: dt,
          _Maintance_Cycle: cycledays,
          _Maintance_Mem: mem,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...authHeaders(),
          },
        }
      );
      if (Number(r.data) > 0) {
        showToast("Maintenance Master Saved successfully...");
        loadMaintData();
        clearMaint();
      }
    } catch (e) {
      console.error("Save_Maint error", e);
    }
  };
  const editMaint = (row: any) => {
    setMaint_selected_id(Number(row.M_id));
    const parts = String(row.Maint_By || "").split("-");
    const code = (parts[0] || "").trim();
    setMaintEmpCode(/^\d+$/.test(code) ? code : "");
    setMaintEmpName(parts.slice(1).join("-").trim());
    setMaintance(row.Maint_Work || "");
    setMaintance_date(row.Maint_Date || null);
    setCycledays(row.Maint_Cycle || "");
  };
  const deleteMaint = async () => {
    try {
      const r = await axios.post(
        `${API_BASE}/Sources/Delete_Maint`,
        form({ _Mid: Maint_selected_id }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...authHeaders(),
          },
        }
      );
      if (Number(r.data) > 0) {
        showToast("Maintenance Record Deleted successfully...");
        loadMaintData();
        clearMaint();
      }
    } catch (e) {
      console.error("Delete_Maint error", e);
    }
  };

  // ------------------------------------------------------------------
  // Excel Import
  // ------------------------------------------------------------------
  const [ImportFile, setImportFile] = useState<string>("0");
  const [files, setFiles] = useState<FileList | null>(null);
  const Today = moment().format("DD-MM-YYYY");

  const handleImport = async () => {
    if (!files || !files.length)
      return showToast("Choose a file to import.", "danger");
    const file = files[0];
    const reader = new FileReader();
    reader.onload = async (event: any) => {
      try {
        const wb = read(event.target.result);
        const sheet = wb.SheetNames[0];
        const rows: any[] = utils.sheet_to_json(wb.Sheets[sheet]);
        groupLog("XLSX parsed rows", rows);

        if (ImportFile === "Productivity") {
          const date_excel = String(rows[1]["Productivity Employee List"] || "")
            .replace("Date:-", "")
            .substring(0, 10);
          for (let i = 5; i < rows.length; i++) {
            await axios.post(
              `${API_BASE}/Workreport/ImportCSVExcel_Productivity`,
              form({
                _date: date_excel,
                _Employee: rows[i]["Productivity Employee List"],
                _onlinetime: rows[i]["__EMPTY_2"],
                _Productivetime: rows[i]["__EMPTY_3"],
                _Unproductivetime: rows[i]["__EMPTY_4"],
                _Neutraltime: rows[i]["__EMPTY_5"],
                _breaktime: rows[i]["__EMPTY_6"],
                _perc: rows[i]["__EMPTY_7"],
              }),
              {
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  ...authHeaders(),
                },
              }
            );
          }
          showToast("Productivity imported.");
        } else if (ImportFile === "Activity") {
          const date_excel = String(rows[1]["Activity Employee List"] || "")
            .replace("Date:-", "")
            .substring(0, 10);
          for (let i = 5; i < rows.length; i++) {
            await axios.post(
              `${API_BASE}/Workreport/ImportCSVExcel_activity`,
              form({
                _date: date_excel,
                _Employee: rows[i]["Activity Employee List"],
                _onlinetime: rows[i]["__EMPTY_1"],
                _activetime: rows[i]["__EMPTY_2"],
                _idletime: rows[i]["__EMPTY_3"],
                _breaktime: rows[i]["__EMPTY_4"],
                _perc: rows[i]["__EMPTY_8"],
              }),
              {
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  ...authHeaders(),
                },
              }
            );
          }
          showToast("Activity imported.");
        } else if (ImportFile === "ProjectModule") {
          for (let i = 0; i < rows.length; i++) {
            await axios.post(
              `${API_BASE}/Workreport/ImportProject_Modules`,
              form({
                _TestModule: rows[i]["Test Module"] ?? "",
                _TestedForms: rows[i]["TESTED FORMS"] ?? "",
                _ControlOREvent: rows[i]["CONTROL/EVENT"] ?? "",
                _TestSteps: rows[i]["TEST STEPS"] ?? "",
                _Field_Recomand: rows[i]["FIELD RECOMMONDATIONS"] ?? "",
                _Status: rows[i]["STATUS"] ?? "",
                _TestEnvornment: rows[i]["TEST ENVIRONMENT"] ?? "",
                _Bug_Report: rows[i]["BUG REPORT"] ?? "",
                _Bug_Priority: rows[i]["BUG PRIORITY"] ?? "",
              }),
              {
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  ...authHeaders(),
                },
              }
            );
          }
          showToast("ProjectModule imported.");
        } else {
          showToast("Choose a valid import type.", "danger");
        }
      } catch (e) {
        console.error("Import error", e);
        showToast("Import failed.", "danger");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // bootstrap
  useEffect(() => {
    loadDepartments();
    loadDesignations();
    loadVendors();
    loadEmployeesActive();
    loadNotificationsMap();
    loadNotificationsData();
    loadMaintData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =====================================================================================
  // UI
  // =====================================================================================
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="menu-toolbar">
          <div className="toolbar-wrap">
            <img src="/images/dbase.png" alt="DBase" className="menu-logo" />
            <div className="toolbar-right">
              <IonIcon icon={checkmarkCircle} />
            </div>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonAccordionGroup multiple className="src-accordions">
          {/* ======================= Dept. Settings ======================= */}
          {canAdmin && (
            <IonAccordion value="dept">
              <IonItem slot="header" className="acc-header">
                <IonLabel>Dept. Settings</IonLabel>
              </IonItem>
              <div slot="content" className="acc-content">
                <div className="grid two">
                  <IonItem lines="none" className="src-field">
                    <IonLabel position="stacked">Dept. Name</IonLabel>
                    <IonInput
                      value={DeptName}
                      onIonChange={(e) => setDeptName(e.detail.value || "")}
                    />
                  </IonItem>
                  <div className="btn-row">
                    <IonButton onClick={saveDepartment}>Save</IonButton>
                    <IonButton
                      fill="outline"
                      onClick={() => {
                        setDeptName("");
                        setTempDeptId(0);
                      }}
                    >
                      Clear
                    </IonButton>
                  </div>
                </div>

                <div className="table">
                  <div className="row head">
                    <div className="col sm">#</div>
                    <div className="col">Department</div>
                    <div className="col sm">Active</div>
                  </div>
                  {depList.map((d, i) => (
                    <div className="row" key={i}>
                      <div className="col sm">{i + 1}</div>
                      <div
                        className="col link"
                        onClick={() => {
                          setDeptName(d.Department);
                          setTempDeptId(Number(d.DID));
                        }}
                      >
                        {d.Department}
                      </div>
                      <div className="col sm">{String(d.Isactive)}</div>
                    </div>
                  ))}
                  {depList.length === 0 && (
                    <div className="empty">No departments.</div>
                  )}
                </div>
              </div>
            </IonAccordion>
          )}

          {/* ======================= Holidays ======================= */}
          {canAdmin && (
            <IonAccordion value="holidays">
              <IonItem slot="header" className="acc-header">
                <IonLabel>Holidays</IonLabel>
              </IonItem>
              <div slot="content" className="acc-content">
                <div className="grid three">
                  <IonItem
                    className="src-field"
                    lines="none"
                    button
                    onClick={() => setOpenYearModal(true)}
                  >
                    <IonLabel position="stacked">Year</IonLabel>
                    <IonInput
                      value={Hyear ? moment(Hyear).format("YYYY") : ""}
                      placeholder="Select Year"
                      readonly
                    />
                  </IonItem>
                  <IonItem
                    className="src-field"
                    lines="none"
                    button
                    onClick={() => setOpenMonthModal(true)}
                  >
                    <IonLabel position="stacked">Month</IonLabel>
                    <IonInput
                      value={HMnth ? moment(HMnth).format("MMMM") : ""}
                      placeholder="Select Month"
                      readonly
                    />
                  </IonItem>
                  <div className="btn-row align-end">
                    {!HExistYr && Hyear && (
                      <IonButton size="small" onClick={insertSundays}>
                        Insert Sundays
                      </IonButton>
                    )}
                    <IonButton size="small" onClick={loadHolidays}>
                      Load
                    </IonButton>
                    <IonButton
                      size="small"
                      color={addHDay ? "primary" : "success"}
                      onClick={toggleAddHoliday}
                    >
                      {addHDay ? "Add Holiday" : "Save Holiday"}
                    </IonButton>
                  </div>
                </div>

                {!addHDay && (
                  <div className="grid two">
                    <IonItem
                      className="src-field"
                      lines="none"
                      button
                      onClick={() => setOpenDateModal(true)}
                    >
                      <IonLabel position="stacked">Date</IonLabel>
                      <IonInput
                        value={
                          HDate ? moment(HDate).format("DD-MMM-YYYY") : ""
                        }
                        placeholder="Pick a date"
                        readonly
                      />
                    </IonItem>
                    <IonItem className="src-field" lines="none">
                      <IonLabel position="stacked">Remarks</IonLabel>
                      <IonInput
                        value={HRemarks}
                        onIonChange={(e) => setHRemarks(e.detail.value || "")}
                      />
                    </IonItem>
                  </div>
                )}

                <div className="list-scroll">
                  {holidays.map((x: any, i: number) => (
                    <div className="card row" key={i}>
                      <div className="badge">
                        {i + 1} — {moment(x.HolidayDate).format("DD-MM-YYYY")}
                      </div>
                      <div className="flex">
                        <IonCheckbox
                          checked={!!x.FLAG}
                          onIonChange={(e) =>
                            toggleHolidayActive(
                              x.HolidayDate,
                              e.detail.checked
                            )
                          }
                        />
                        <IonButton
                          fill="clear"
                          size="small"
                          onClick={() => {
                            setAddHDay(false);
                            setHDate(x.HolidayDate);
                            setHRemarks(x.Remark || "");
                          }}
                        >
                          {x.Remark}
                        </IonButton>
                      </div>
                    </div>
                  ))}
                  {holidays.length === 0 && (
                    <div className="empty">No holidays found.</div>
                  )}
                </div>
              </div>
            </IonAccordion>
          )}

          {/* ======================= Check-In Access ======================= */}
          {canAdmin && (
            <IonAccordion value="checkin">
              <IonItem slot="header" className="acc-header">
                <IonLabel>Check-In Access</IonLabel>
              </IonItem>
              <div slot="content" className="acc-content">
                <div className="table sticky">
                  <div className="row head">
                    <div className="col xs">Sl</div>
                    <div className="col">EmpCode & Name</div>
                    <div className="col xs">Select</div>
                  </div>
                  {checkMap.map((r, i) => (
                    <div className="row" key={i}>
                      <div className="col xs">{r.SlNo ?? i + 1}</div>
                      <div className="col">{r.EmpName}</div>
                      <div className="col xs">
                        <IonCheckbox
                          checked={!!r.IsChekin_Enable}
                          onIonChange={(e) =>
                            saveCheckinAccess(
                              String(r.EmpCode || ""),
                              e.detail.checked
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                  {checkMap.length === 0 && (
                    <div className="empty">No employees.</div>
                  )}
                </div>
              </div>
            </IonAccordion>
          )}

          {/* ======================= Designation Settings ======================= */}
          {canAdmin && (
            <IonAccordion value="designation">
              <IonItem slot="header" className="acc-header">
                <IonLabel>Designation Settings</IonLabel>
              </IonItem>
              <div slot="content" className="acc-content">
                <div className="grid two">
                  <IonItem lines="none" className="src-field">
                    <IonLabel position="stacked">Designation</IonLabel>
                    <IonInput
                      value={Designation}
                      onIonChange={(e) =>
                        setDesignation(e.detail.value || "")
                      }
                    />
                  </IonItem>
                  <div className="btn-row">
                    <IonButton onClick={saveDesignation}>Save</IonButton>
                    <IonButton
                      fill="outline"
                      onClick={() => {
                        setDesignation("");
                        setTempDisgId(0);
                      }}
                    >
                      Clear
                    </IonButton>
                  </div>
                </div>

                <div className="table">
                  <div className="row head">
                    <div className="col sm">#</div>
                    <div className="col">Designation</div>
                    <div className="col sm">Active</div>
                  </div>
                  {disgList.map((d, i) => (
                    <div className="row" key={i}>
                      <div className="col sm">{i + 1}</div>
                      <div
                        className="col link"
                        onClick={() => {
                          setDesignation(d.Designation);
                          setTempDisgId(Number(d.DS_ID));
                        }}
                      >
                        {d.Designation}
                      </div>
                      <div className="col sm">{String(d.Isactive)}</div>
                    </div>
                  ))}
                  {disgList.length === 0 && (
                    <div className="empty">No designations.</div>
                  )}
                </div>
              </div>
            </IonAccordion>
          )}

          {/* ======================= Vendor Master ======================= */}
          {canAdmin && (
            <IonAccordion value="vendor">
              <IonItem slot="header" className="acc-header">
                <IonLabel>Vendor Master</IonLabel>
              </IonItem>
              <div slot="content" className="acc-content">
                <div className="grid three">
                  <IonItem lines="none" className="src-field">
                    <IonLabel position="stacked">Vendor Type</IonLabel>
                    {/* use popover interface to avoid IonAlert a11y warning */}
                    <IonSelect
                      interface="popover"
                      value={Vendor_Type}
                      onIonChange={(e) => setVendor_Type(e.detail.value)}
                    >
                      <IonSelectOption value="Service">Service</IonSelectOption>
                      <IonSelectOption value="Stationery">
                        Stationery
                      </IonSelectOption>
                      <IonSelectOption value="Transport">
                        Transport
                      </IonSelectOption>
                      <IonSelectOption value="Miscellaneous">
                        Miscellaneous
                      </IonSelectOption>
                    </IonSelect>
                  </IonItem>
                  <IonItem lines="none" className="src-field">
                    <IonLabel position="stacked">Vendor Name</IonLabel>
                    <IonInput
                      value={Vendor_Name}
                      onIonChange={(e) =>
                        setVendor_Name(e.detail.value || "")
                      }
                    />
                  </IonItem>
                  <IonItem lines="none" className="src-field">
                    <IonLabel position="stacked">GST No.</IonLabel>
                    <IonInput
                      value={GST_No}
                      onIonChange={(e) => setGST_No(e.detail.value || "")}
                    />
                  </IonItem>
                </div>
                <div className="btn-row">
                  <IonButton onClick={saveVendor}>Save</IonButton>
                  <IonButton
                    fill="outline"
                    onClick={() => {
                      setVID("0");
                      setVendor_Type("");
                      setVendor_Name("");
                      setGST_No("");
                    }}
                  >
                    Clear
                  </IonButton>
                </div>

                <div className="table">
                  <div className="row head">
                    <div className="col sm">#</div>
                    <div className="col">Type</div>
                    <div className="col">Vendor</div>
                    <div className="col">GST</div>
                  </div>
                  {vendors.map((v, i) => (
                    <div className="row" key={v.VID ?? i}>
                      <div className="col sm">{i + 1}</div>
                      <div
                        className="col link"
                        onClick={() => {
                          setVID(String(v.VID));
                          setVendor_Type(v.Vendor_Type || "");
                          setVendor_Name(v.Vendor_Name || "");
                          setGST_No(v.GST_No || "");
                        }}
                      >
                        {v.Vendor_Type}
                      </div>
                      <div className="col">{v.Vendor_Name}</div>
                      <div className="col">{v.GST_No}</div>
                    </div>
                  ))}
                  {vendors.length === 0 && (
                    <div className="empty">No vendors.</div>
                  )}
                </div>
              </div>
            </IonAccordion>
          )}

          {/* ======================= Maintenance ======================= */}
          {canAdmin && (
            <IonAccordion value="maintenance">
              <IonItem slot="header" className="acc-header">
                <IonLabel>Maintenance</IonLabel>
              </IonItem>
              <div slot="content" className="acc-content">
                <div className="grid four">
                  <IonItem className="src-field" lines="none">
                    <IonLabel position="stacked">Type of Maintenance</IonLabel>
                    <IonInput
                      value={Maintance}
                      onIonChange={(e) => setMaintance(e.detail.value || "")}
                    />
                  </IonItem>
                  <IonItem className="src-field" lines="none">
                    <IonLabel position="stacked">Cycle Days</IonLabel>
                    <IonInput
                      value={cycledays}
                      onIonChange={(e) => setCycledays(e.detail.value || "")}
                    />
                  </IonItem>
                  <IonItem
                    className="src-field"
                    lines="none"
                    button
                    onClick={() => setOpenMaintDateModal(true)}
                  >
                    <IonLabel position="stacked">Date</IonLabel>
                    <IonInput
                      value={
                        Maintance_date
                          ? moment(Maintance_date).format("DD-MM-YYYY")
                          : ""
                      }
                      readonly
                    />
                  </IonItem>
                  <IonItem
                    className="src-field"
                    lines="none"
                    button
                    id="maintEmpPick"
                    onClick={() => setMaintEmpPopover(true)}
                  >
                    <IonLabel position="stacked">Maintenance By</IonLabel>
                    <IonInput
                      value={
                        MaintEmpCode ? `${MaintEmpCode} - ${MaintEmpName}` : ""
                      }
                      readonly
                    />
                  </IonItem>
                </div>
                <div className="btn-row">
                  <IonButton size="small" onClick={saveMaint}>
                    {Maint_selected_id ? "Update" : "Save"}
                  </IonButton>
                  <IonButton size="small" fill="outline" onClick={clearMaint}>
                    Clear
                  </IonButton>
                  {Maint_selected_id ? (
                    <IonButton size="small" color="danger" onClick={deleteMaint}>
                      Delete
                    </IonButton>
                  ) : null}
                </div>

                <div className="table">
                  <div className="row head">
                    <div className="col">Work</div>
                    <div className="col sm">Date</div>
                    <div className="col xs">Cycle</div>
                    <div className="col xs">Edit</div>
                  </div>
                  {ds_Maintance?.map((x, i) => (
                    <div className="row" key={i}>
                      <div className="col">{x.Maint_Work}</div>
                      <div className="col sm">
                        {moment(x.Maint_Date).format("DD-MM-YYYY")}
                      </div>
                      <div className="col xs">{x.Maint_Cycle}</div>
                      <div className="col xs">
                        <IonButton size="small" fill="clear" onClick={() => editMaint(x)}>
                          Edit
                        </IonButton>
                      </div>
                    </div>
                  ))}
                  {!ds_Maintance && (
                    <div className="empty">No maintenance items.</div>
                  )}
                </div>
              </div>
            </IonAccordion>
          )}

          {/* ======================= Notifications ======================= */}
          {canAdmin && (
            <IonAccordion value="notifications">
              <IonItem slot="header" className="acc-header">
                <IonLabel>Notifications</IonLabel>
              </IonItem>
              <div slot="content" className="acc-content">
                <div className="grid two">
                  <IonItem lines="none" className="src-field">
                    <IonLabel position="stacked">Notification Text</IonLabel>
                    <IonInput
                      value={Notification}
                      onIonChange={(e) =>
                        setNotification(e.detail.value || "")
                      }
                    />
                  </IonItem>
                  <div className="btn-row">
                    <IonButton size="small" onClick={saveNotifications}>
                      Save
                    </IonButton>
                  </div>
                </div>

                <div className="grid two">
                  {/* Left: Notification list */}
                  <div className="table">
                    <div className="row head">
                      <div className="col xs">Sl</div>
                      <div className="col">Notification Text</div>
                      <div className="col xs">Active</div>
                    </div>
                    {dt_Notifications_Data.map((n, i) => (
                      <div className="row" key={i}>
                        <div className="col xs">{n.SlNo ?? i + 1}</div>
                        <div className="col link" onClick={() => clickNotifRow(n.NID)}>
                          {n.Notification_Text}
                        </div>
                        <div className="col xs">
                          <IonCheckbox
                            checked={!!n.Isactive}
                            onIonChange={(e) =>
                              updateNotifStatus(n.NID, e.detail.checked)
                            }
                          />
                        </div>
                      </div>
                    ))}
                    {dt_Notifications_Data.length === 0 && (
                      <div className="empty">No notifications.</div>
                    )}
                  </div>

                  {/* Right: Map to employees */}
                  <div className="table">
                    <div className="row head">
                      <div className="col xs">Sl</div>
                      <div className="col">EmpCode & Name</div>
                      <div className="col xs link" onClick={toggleAllNotifEmp}>
                        Select
                      </div>
                    </div>
                    {dt_Notifications.map((r, i) => (
                      <div className="row" key={i}>
                        <div className="col xs">{r.SlNo ?? i + 1}</div>
                        <div className="col">{r.EmpName}</div>
                        <div className="col xs">
                          <IonCheckbox
                            checked={!!r.Isactive}
                            onIonChange={(e) => {
                              const checked = e.detail.checked;
                              setDt_Notifications((prev) =>
                                prev.map((x, idx) =>
                                  idx === i ? { ...x, Isactive: checked } : x
                                )
                              );
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    {dt_Notifications.length === 0 && (
                      <div className="empty">No employees to map.</div>
                    )}
                  </div>
                </div>
              </div>
            </IonAccordion>
          )}

          {/* ======================= Import / Export ======================= */}
          <IonAccordion value="excel">
            <IonItem slot="header" className="acc-header">
              <IonLabel>Import / Export</IonLabel>
            </IonItem>
            <div slot="content" className="acc-content">
              <div className="grid three">
                <IonItem className="src-field" lines="none">
                  <IonLabel position="stacked">Import of File</IonLabel>
                  {/* use popover interface to avoid IonAlert a11y warning */}
                  <IonSelect
                    interface="popover"
                    value={ImportFile}
                    onIonChange={(e) => setImportFile(e.detail.value)}
                  >
                    <IonSelectOption value="0">--Select--</IonSelectOption>
                    <IonSelectOption value="Activity">Activity</IonSelectOption>
                    <IonSelectOption value="Productivity">
                      Productivity
                    </IonSelectOption>
                    <IonSelectOption value="ProjectModule">
                      ProjectModule
                    </IonSelectOption>
                  </IonSelect>
                </IonItem>
                <IonItem className="src-field" lines="none">
                  <IonLabel position="stacked">Date</IonLabel>
                  <IonInput value={Today} readonly />
                </IonItem>
                <IonItem className="src-field" lines="none">
                  <IonLabel position="stacked">File</IonLabel>
                  <input
                    type="file"
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={(e) => setFiles(e.target.files)}
                  />
                </IonItem>
              </div>
              <div className="btn-row">
                <IonButton onClick={handleImport}>Import</IonButton>
              </div>
            </div>
          </IonAccordion>
        </IonAccordionGroup>

        {/* ======= Date/Month/Year pickers ======= */}
        <IonModal
          isOpen={openYearModal}
          onDidDismiss={() => setOpenYearModal(false)}
        >
          <div className="modal">
            <h4>Select Year</h4>
            <IonDatetime
              presentation="year"
              onIonChange={(e) => {
                const v = e.detail.value as string;
                setHyear(v);
                setHMnth(null);
                setOpenYearModal(false);
                loadHolidays();
              }}
            />
            <IonButton onClick={() => setOpenYearModal(false)}>Close</IonButton>
          </div>
        </IonModal>

        <IonModal
          isOpen={openMonthModal}
          onDidDismiss={() => setOpenMonthModal(false)}
        >
          <div className="modal">
            <h4>Select Month</h4>
            <IonDatetime
              presentation="month"
              onIonChange={(e) => {
                const v = e.detail.value as string;
                setHMnth(v);
                setOpenMonthModal(false);
                loadHolidays();
              }}
            />
            <IonButton onClick={() => setOpenMonthModal(false)}>Close</IonButton>
          </div>
        </IonModal>

        <IonModal
          isOpen={openDateModal}
          onDidDismiss={() => setOpenDateModal(false)}
        >
          <div className="modal">
            <h4>Select Date</h4>
            <IonDatetime
              presentation="date"
              onIonChange={(e) => {
                setHDate(e.detail.value as string);
                setOpenDateModal(false);
              }}
            />
            <IonButton onClick={() => setOpenDateModal(false)}>Close</IonButton>
          </div>
        </IonModal>

        {/* Maint date */}
        <IonModal
          isOpen={openMaintDateModal}
          onDidDismiss={() => setOpenMaintDateModal(false)}
        >
          <div className="modal">
            <h4>Maintenance Date</h4>
            <IonDatetime
              presentation="date"
              onIonChange={(e) => {
                setMaintance_date(e.detail.value as string);
                setOpenMaintDateModal(false);
              }}
            />
            <IonButton onClick={() => setOpenMaintDateModal(false)}>
              Close
            </IonButton>
          </div>
        </IonModal>

        {/* Maint employee picker */}
        <IonPopover
          isOpen={maintEmpPopover}
          trigger="maintEmpPick"
          onDidDismiss={() => setMaintEmpPopover(false)}
        >
          <IonList className="emp-list">
            {empActive.map((x) => (
              <IonItem
                key={x.EmpCode}
                button
                onClick={() => {
                  setMaintEmpCode(x.EmpCode);
                  setMaintEmpName(x.EmpName);
                  setMaintEmpPopover(false);
                }}
              >
                <IonLabel>
                  {x.EmpCode} — {x.EmpName}
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
        </IonPopover>

        {/* Toast */}
        <IonToast
          isOpen={toast.open}
          message={toast.msg}
          color={toast.color}
          duration={1800}
          position="top"
          onDidDismiss={() => setToast((t) => ({ ...t, open: false }))}
        />
      </IonContent>
    </IonPage>
  );
};

export default Sources;
