// src/pages/Sources.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  IonCheckbox, IonContent, IonDatetime,
  IonInput, IonModal, IonPage, IonPopover,
  IonSelect, IonSelectOption, IonToast, IonGrid, IonRow, IonCol, IonIcon
} from "@ionic/react";
import { useHistory } from "react-router-dom";

import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
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
const UserAccessIcon = () => <IconBox><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6" /><path d="M23 11h-6" /></IconBox>;
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

// =====================================================================================
// USER ACCESS SECTION ONLY (API BASED)
// =====================================================================================

type UserAccessPermissionRow = {
  SlNo: number;
  MenuText: string;
  Selected: boolean;
  Path?: string;
};

const UserAccessSection: React.FC = () => {
  // -------------------------------------------------------------------
  // STATES
  // -------------------------------------------------------------------
  const [userAccessType, setUserAccessType] = useState<
    "UserGroup" | "Users"
  >("UserGroup");

  const [selectedUserGroup, setSelectedUserGroup] =
    useState("");

  const [selectedUserCode, setSelectedUserCode] =
    useState("");

  const [employees, setEmployees] = useState<
    ActiveEmp[]
  >([]);

  const [groups, setGroups] = useState<string[]>([]);

  const [permissions, setPermissions] = useState<
    UserAccessPermissionRow[]
  >([]);

  const [loading, setLoading] = useState(false);

  // -------------------------------------------------------------------
  // LOAD EMPLOYEES
  // -------------------------------------------------------------------
  const loadEmployees = async () => {
    try {
      const r = await axios.get(
        `${API_BASE}Sources/load_empployee`,
        { headers: authHeaders() }
      );

      log("loadEmployees raw response:", r.data);

      if (!Array.isArray(r.data)) {
        setEmployees([]);
        return;
      }

      const rows = r.data.map((x: any) => {
        // Handle array-of-arrays format: [name, empCode, designation, role, ...]
        if (Array.isArray(x)) {
          const rawName = String(x[0] ?? "");
          const empCode = String(x[1] ?? "");
          // Strip "CODE-" prefix from name if present
          const empName = rawName.includes("-")
            ? rawName.split("-").slice(1).join("-").trim()
            : rawName;
          return {
            EmpCode: empCode,
            EmpName: empName || rawName,
            Designation: String(x[2] ?? ""),
            Role: String(x[3] ?? ""),
          };
        }
        // Handle array-of-objects format
        const rawName = String(
          x.EmpName ?? x.empName ?? x.Name ?? x.name ?? x.FullName ?? ""
        );
        const empCode = String(
          x.EmpCode ?? x.empCode ?? x.EmployeeCode ?? x.Code ?? ""
        );
        const empName = rawName.includes("-")
          ? rawName.split("-").slice(1).join("-").trim()
          : rawName;
        return {
          EmpCode: empCode,
          EmpName: empName || rawName,
          Designation: String(x.Designation ?? x.designation ?? ""),
          Role: String(x.Role ?? x.role ?? ""),
        };
      }).filter((e: any) => e.EmpCode !== ""); // remove blank rows

      log("loadEmployees parsed:", rows.length, "employees");
      setEmployees(rows);
    } catch (e) {
      log("loadEmployees error:", e);
      setEmployees([]);
    }
  };

  // -------------------------------------------------------------------
  // LOAD GROUPS
  // -------------------------------------------------------------------
  const loadGroups = async () => {
    try {
      const r = await axios.get(
        `${API_BASE}Sources/Load_UserGroup`,
        {
          headers: authHeaders(),
        }
      );

      if (Array.isArray(r.data)) {
        const rows = r.data
          .map((x: any) =>
            Array.isArray(x)
              ? String(x[0] ?? "")
              : String(
                x.UserGroup ??
                x.Group ??
                x.name ??
                ""
              )
          )
          .filter(Boolean);

        setGroups(rows);
      }
    } catch (e) {
      setGroups([]);
    }
  };

  // -------------------------------------------------------------------
  // LOAD PERMISSIONS
  // -------------------------------------------------------------------
  const loadPermissions = async (
    id: string,
    isGroup: boolean
  ) => {
    if (!id) {
      setPermissions([]);
      return;
    }

    setLoading(true);

    try {
      const url = `${API_BASE}${isGroup
        ? "Sources/Load_Get_UserAccess"
        : "Sources/load_get_userPer"
        }`;

      const params = isGroup
        ? { UserGroup: id }
        : { EmpCode: id };

      const r = await axios.get(url, {
        headers: authHeaders(),
        params,
      });

      if (Array.isArray(r.data)) {
        const rows = r.data.map(
          (row: any[], index: number) => ({
            SlNo: index + 1,
            MenuText: String(row[1] ?? ""),
            Path: String(row[4] ?? ""),
            Selected:
              String(row[9] ?? "")
                .toLowerCase()
                .trim() === "true",
          })
        );
        setPermissions(rows);
      } else {
        setPermissions([]);
      }
    } catch (e) {
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------
  // TOGGLE PERMISSION
  // -------------------------------------------------------------------
  const togglePermission = (
    slNo: number,
    checked: boolean
  ) => {
    setPermissions((prev) =>
      prev.map((x) =>
        x.SlNo === slNo
          ? { ...x, Selected: checked }
          : x
      )
    );
  };

  const saveUserAccess = async () => {
    const isGroup = userAccessType === "UserGroup";
    const id = isGroup ? selectedUserGroup : selectedUserCode;

    if (!id) {
      alert(`Please select a ${isGroup ? "User Group" : "User"} first.`);
      return;
    }

    setLoading(true);
    try {
      const url = isGroup ? `${API_BASE}Sources/Save_UserAccess` : `${API_BASE}Sources/save_userPer`;

      // Pattern: List of permission objects
      const payload = isGroup
        ? { UserGroup: id, Permissions: permissions }
        : { EmpCode: id, Permissions: permissions };

      await axios.post(url, payload, { headers: authHeaders() });
      alert("Permissions saved successfully!");
    } catch (e) {
      alert("Error saving permissions.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------
  // INITIAL LOAD
  // -------------------------------------------------------------------
  useEffect(() => {
    loadEmployees();
    loadGroups();
  }, []);

  // -------------------------------------------------------------------
  // LOAD USER/GROUP PERMISSIONS
  // -------------------------------------------------------------------
  useEffect(() => {
    if (userAccessType === "UserGroup") {
      loadPermissions(selectedUserGroup, true);
    } else {
      loadPermissions(selectedUserCode, false);
    }
  }, [
    selectedUserGroup,
    selectedUserCode,
    userAccessType,
  ]);

  // -------------------------------------------------------------------
  // SORT USERS
  // -------------------------------------------------------------------
  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) =>
      a.EmpName.localeCompare(b.EmpName)
    );
  }, [employees]);

  // ===================================================================================
  // UI
  // ===================================================================================
  return (
    <div style={{ background: 'transparent', padding: 0 }}>
      {/* USER TYPE */}
      <div className="stock-field" style={{ maxWidth: '400px', marginBottom: '16px' }}>
        <label>User Type</label>
        <select
          className="stock-select"
          value={userAccessType}
          onChange={(e) => setUserAccessType(e.target.value as "UserGroup" | "Users")}
        >
          <option value="UserGroup">User Group</option>
          <option value="Users">Select User</option>
        </select>
      </div>

      <div className="stock-grid" style={{ marginTop: "20px" }}>
        {/* LEFT PANEL */}
        <div className="stock-panel" style={{ padding: '12px' }}>
          <h3 className="stock-section-heading" style={{ margin: '0 0 12px 0' }}>
            {userAccessType === "UserGroup" ? "User Groups" : "Users"}
          </h3>
          <div className="src-scroll-list" style={{ height: "400px", overflowY: "auto" }}>
            {userAccessType === "UserGroup" ? (
              groups.map((group) => (
                <div
                  key={group}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px', border: selectedUserGroup === group ? '1.5px solid var(--ion-color-primary)' : '1px solid var(--stock-border)',
                    borderRadius: '8px', marginBottom: '8px', cursor: 'pointer', background: selectedUserGroup === group ? 'var(--ion-color-light)' : 'transparent'
                  }}
                  onClick={() => setSelectedUserGroup(group)}
                >
                  <span style={{ fontWeight: 600, color: 'var(--stock-text)' }}>{group}</span>
                  <IonCheckbox checked={selectedUserGroup === group} style={{ margin: 0 }} />
                </div>
              ))
            ) : (
              sortedEmployees.map((emp) => (
                <div
                  key={emp.EmpCode}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px', border: selectedUserCode === emp.EmpCode ? '1.5px solid var(--ion-color-primary)' : '1px solid var(--stock-border)',
                    borderRadius: '8px', marginBottom: '8px', cursor: 'pointer', background: selectedUserCode === emp.EmpCode ? 'var(--ion-color-light)' : 'transparent'
                  }}
                  onClick={() => setSelectedUserCode(emp.EmpCode)}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--stock-text)' }}>{emp.EmpName}</div>
                    <small style={{ color: 'var(--stock-muted)' }}>{emp.EmpCode}</small>
                  </div>
                  <IonCheckbox checked={selectedUserCode === emp.EmpCode} style={{ margin: 0 }} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="stock-panel" style={{ padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="stock-section-heading" style={{ margin: 0 }}>Permissions</h3>
            <button className="stock-button" onClick={saveUserAccess} style={{ padding: '6px 12px', minWidth: '100px', fontSize: '13px' }}>
              Save
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--stock-muted)' }}>Loading...</div>
          ) : (
            <div className="src-scroll-list" style={{ height: '360px', overflowY: 'auto' }}>
              {permissions.map((menu) => (
                <div
                  key={menu.SlNo}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px', borderBottom: '1px solid var(--stock-border)'
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--stock-text)' }}>
                    {menu.SlNo}. {menu.MenuText}
                  </div>
                  <IonCheckbox
                    checked={menu.Selected}
                    onIonChange={(e) => togglePermission(menu.SlNo, e.detail.checked)}
                    style={{ margin: 0 }}
                  />
                </div>
              ))}
              {permissions.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--stock-muted)' }}>
                  Select a {userAccessType === "UserGroup" ? "Group" : "User"} to view permissions
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Sources: React.FC = () => {
  const history = useHistory();
  const [toast, setToast] = useState({
    open: false,
    msg: "",
    color: "success" as "success" | "danger" | "warning",
  });
  const showToast = (msg: string, color: "success" | "danger" | "warning" = "success") =>
    setToast({ open: true, msg, color });

  const [activeTab, setActiveTab] = useState("holidays");

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
  if (!Designation.trim()) {
    return showToast("Please Enter The Designation Value...!", "danger");
  }

  try {
    const payload = {
      _Designation_ID: tempDisgId,
      _Designation: Designation.trim()
    };

    const r = await axios.post(
      `${API_BASE}Sources/Save_Designation`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          ...authHeaders()
        }
      }
    );

    showToast("Record Successfully Submitted...!");

    setDesignation("");
    setTempDisgId(0);
    loadDesignations();
  }
  catch (e:any) {
    console.log(e.response?.data);
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
    if (tmpyr === "0") {
      setDt_Holidays([]);
      setHExistYr(false);
      return;
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

  const SectionHeader = ({ icon, title, isCollapsed, onToggle }: { icon: React.ReactNode, title: string, isCollapsed: boolean, onToggle: () => void }) => (
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

  useEffect(() => {
    if (Hyear) loadHolidays();
  }, [Hyear, HMnth]);

  return (
    <IonPage>
      <IonContent className="page-content">
        <div className="wr-container stock-container" style={{ padding: 0, minHeight: 'auto', backgroundColor: 'transparent' }}>
          
          {/* ── Premium Header ── */}
          <div className="page-wr-header" style={{ margin: '16px', borderRadius: '16px', padding: '16px' }}>
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()}>
                <ChevronLeft />
              </button>
              <div>
                <h1 className="page-wr-title">System Sources</h1>
                <p className="page-wr-subtitle">Manage administrative configurations and shared data.</p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <div className="page-wr-header-icon-box">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ion-color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </div>
            </div>
          </div>

          <div className="stock-panel" style={{ margin: '0 16px 20px 16px', padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
            
            {/* Tabs */}
            <div className="stock-tabs" style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', paddingBottom: '8px' }}>
              {String(user?.EmpCode ?? user?.empCode ?? "") === "1501" && (
                <button
                  type="button"
                  className={`stock-tab ${activeTab === "userAccess" ? "active" : ""}`}
                  style={{ flex: '1 1 auto', width: 'auto', minWidth: '0', padding: '0 12px' }}
                  onClick={() => setActiveTab("userAccess")}
                >
                  User Access
                </button>
              )}
              <button type="button" style={{ flex: '1 1 auto', width: 'auto', minWidth: '0', padding: '0 12px' }} className={`stock-tab ${activeTab === "holidays" ? "active" : ""}`} onClick={() => setActiveTab("holidays")}>
                Holidays
              </button>
              <button type="button" style={{ flex: '1 1 auto', width: 'auto', minWidth: '0', padding: '0 12px' }} className={`stock-tab ${activeTab === "dept" ? "active" : ""}`} onClick={() => setActiveTab("dept")}>
                Departments
              </button>
              <button type="button" style={{ flex: '1 1 auto', width: 'auto', minWidth: '0', padding: '0 12px' }} className={`stock-tab ${activeTab === "designation" ? "active" : ""}`} onClick={() => setActiveTab("designation")}>
                Designations
              </button>
              <button type="button" style={{ flex: '1 1 auto', width: 'auto', minWidth: '0', padding: '0 12px' }} className={`stock-tab ${activeTab === "checkin" ? "active" : ""}`} onClick={() => setActiveTab("checkin")}>
                Check-In
              </button>
              <button type="button" style={{ flex: '1 1 auto', width: 'auto', minWidth: '0', padding: '0 12px' }} className={`stock-tab ${activeTab === "vendor" ? "active" : ""}`} onClick={() => setActiveTab("vendor")}>
                Vendors
              </button>
              <button type="button" style={{ flex: '1 1 auto', width: 'auto', minWidth: '0', padding: '0 12px' }} className={`stock-tab ${activeTab === "broadcast" ? "active" : ""}`} onClick={() => setActiveTab("broadcast")}>
                Broadcast
              </button>
              <button type="button" style={{ flex: '1 1 auto', width: 'auto', minWidth: '0', padding: '0 12px' }} className={`stock-tab ${activeTab === "import" ? "active" : ""}`} onClick={() => setActiveTab("import")}>
                Import
              </button>
              <button type="button" style={{ flex: '1 1 auto', width: 'auto', minWidth: '0', padding: '0 12px' }} className={`stock-tab ${activeTab === "maint" ? "active" : ""}`} onClick={() => setActiveTab("maint")}>
                Maintenance
              </button>
            </div>

            {/* TAB CONTENT: User Access */}
            {activeTab === "userAccess" && String(user?.EmpCode ?? user?.empCode ?? "") === "1501" && (
              <div className="stock-panel">
                <UserAccessSection />
              </div>
            )}

            {/* TAB CONTENT: Holidays */}
            {activeTab === "holidays" && (
              <div className="stock-panel">
                <h3 className="stock-section-heading">Holidays Management</h3>
                <div className="stock-grid" style={{ marginBottom: '16px' }}>
                  
                  <div className="stock-field">
                    <label>Year</label>
                    <div id="hyear-trigger" className="stock-input" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', minHeight: '38px', color: Hyear ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                      {Hyear ? new Date(Hyear).toLocaleDateString() : "Select Year"}
                    </div>
                    <IonPopover trigger="hyear-trigger" triggerAction="click" alignment="start">
                      <IonDatetime presentation="date" value={Hyear} onIonChange={(e) => setHyear((e.detail.value as string).split('T')[0])} />
                    </IonPopover>
                  </div>
                  
                  <div className="stock-field">
                    <label>Month</label>
                    <div id="hmnth-trigger" className="stock-input" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', minHeight: '38px', color: HMnth ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                      {HMnth ? HMnth : "Select Month"}
                    </div>
                    <IonPopover trigger="hmnth-trigger" triggerAction="click" alignment="start">
                      <IonDatetime presentation="month-year" value={HMnth ? HMnth + "-01" : undefined} onIonChange={(e) => setHMnth((e.detail.value as string).substring(0, 7))} />
                    </IonPopover>
                  </div>
                  
                  <div className="stock-field">
                    <label style={{ visibility: 'hidden' }}>Actions</label>
                    <div style={{ display: 'flex', gap: '8px', height: '100%' }}>
                      {!HExistYr && Hyear && (
                        <button className="stock-button stock-button--secondary" onClick={insertSundays} style={{ width: '100%', minHeight: '38px', padding: '0 8px' }}>
                          Sundays
                        </button>
                      )}
                      <button className="stock-button" onClick={addHoliday} style={{ width: '100%', minHeight: '38px', padding: '0 8px' }}>
                        {addHDayCtrlName}
                      </button>
                    </div>
                  </div>
                </div>

                {!addHDay && (
                  <div className="stock-grid" style={{ marginBottom: '16px' }}>
                    <div className="stock-field">
                      <label>Date</label>
                      <div id="hdate-trigger" className="stock-input" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', minHeight: '38px', color: HDate ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                        {HDate ? new Date(HDate).toLocaleDateString() : "Select Date"}
                      </div>
                      <IonPopover trigger="hdate-trigger" triggerAction="click" alignment="start">
                        <IonDatetime presentation="date" value={HDate} onIonChange={(e) => setHDate((e.detail.value as string).split('T')[0])} />
                      </IonPopover>
                    </div>
                    <div className="stock-field">
                      <label>Remarks</label>
                      <input type="text" className="stock-input" value={HRemarks} onChange={(e) => setHRemarks(e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="stock-table-wrapper" style={{ maxHeight: '400px' }}>
                  <table className="stock-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th style={{ textAlign: 'right' }}>Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dt_Holidays.map((x, i) => (
                        <tr key={i} onClick={() => { setAddHDay(false); setAddHDayCtrlName("Save Holiday"); setAddHDayCtrlIconName(saveOutline); setHDate(moment(x.HolidayDate).format("YYYY-MM-DD")); setHRemarks(x.Remark); }} style={{ cursor: 'pointer' }}>
                          <td style={{ fontWeight: 600 }}>{i + 1} - {moment(x.HolidayDate).format("DD-MM-YYYY")}</td>
                          <td style={{ textAlign: 'center' }}>
                            <IonCheckbox checked={x.FLAG} onIonChange={(e) => { e.stopPropagation(); toggleHolidayActive(x.HolidayDate, e.detail.checked); }} />
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--ion-color-primary)' }}>{x.Remark}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {dt_Holidays.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--stock-muted)' }}>No holidays found.</div>}
                </div>
              </div>
            )}

            {/* TAB CONTENT: Departments */}
            {activeTab === "dept" && (
              <div className="stock-panel">
                <h3 className="stock-section-heading">Departments</h3>
                <div className="stock-field" style={{ marginBottom: '16px' }}>
                  <label>Department Name</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" className="stock-input" value={DeptName} placeholder="e.g. Finance" onChange={(e) => setDeptName(e.target.value)} />
                    <button className="stock-button" onClick={saveDepartment}>Save</button>
                  </div>
                </div>
                <div className="stock-table-wrapper" style={{ maxHeight: '400px' }}>
                  <table className="stock-table">
                    <thead><tr><th>Department</th></tr></thead>
                    <tbody>
                      {depList.map(d => (
                        <tr key={d.DID} onClick={() => { setDeptName(d.Department); setTempDeptId(d.DID); }} style={{ cursor: 'pointer' }}>
                          <td>{d.Department}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Designations */}
            {activeTab === "designation" && (
              <div className="stock-panel">
                <h3 className="stock-section-heading">Designations</h3>
                <div className="stock-field" style={{ marginBottom: '16px' }}>
                  <label>Designation Name</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" className="stock-input" value={Designation} placeholder="e.g. Lead" onChange={(e) => setDesignation(e.target.value)} />
                    <button className="stock-button" onClick={saveDesignation}>Save</button>
                  </div>
                </div>
                <div className="stock-table-wrapper" style={{ maxHeight: '400px' }}>
                  <table className="stock-table">
                    <thead><tr><th>Designation</th></tr></thead>
                    <tbody>
                      {disgList.map(d => (
                        <tr key={d.DS_ID} onClick={() => { setDesignation(d.Designation); setTempDisgId(d.DS_ID); }} style={{ cursor: 'pointer' }}>
                          <td>{d.Designation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Checkin */}
            {activeTab === "checkin" && (
              <div className="stock-panel">
                <h3 className="stock-section-heading">Check-In Access</h3>
                <div className="src-scroll-list" style={{ maxHeight: "400px" }}>
                  {checkMap.map(r => (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid var(--stock-border)' }} key={r.EmpCode}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--stock-text)' }}>{r.EmpName}</div>
                        <small style={{ color: 'var(--stock-muted)' }}>{r.EmpCode}</small>
                      </div>
                      <IonCheckbox checked={r.IsChekin_Enable} onIonChange={(e) => saveCheckinAccess(r.EmpCode, e.detail.checked)} style={{ margin: 0 }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT: Vendors */}
            {activeTab === "vendor" && (
              <div className="stock-panel">
                <h3 className="stock-section-heading">Vendors</h3>
                <div className="stock-grid" style={{ marginBottom: '16px' }}>
                  <div className="stock-field">
                    <label>Vendor Name</label>
                    <input type="text" className="stock-input" value={Vendor_Name} placeholder="Vendor Name" onChange={(e) => setVendor_Name(e.target.value)} />
                  </div>
                  <div className="stock-field">
                    <label>Type</label>
                    <select className="stock-select" value={Vendor_Type} onChange={(e) => setVendor_Type(e.target.value)}>
                      <option value="Service">Service</option>
                      <option value="Product">Product</option>
                    </select>
                  </div>
                  <div className="stock-field">
                    <label>GST</label>
                    <input type="text" className="stock-input" value={GST_No} placeholder="GST" onChange={(e) => setGST_No(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                  <button className="stock-button" onClick={saveVendor}>Save Vendor</button>
                </div>
                
                <div className="src-scroll-list" style={{ maxHeight: "350px" }}>
                  {vendors.map(v => (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid var(--stock-border)', cursor: 'pointer' }} key={v.VID} onClick={() => { setVID(String(v.VID)); setVendor_Name(v.Vendor_Name); setVendor_Type(v.Vendor_Type); setGST_No(v.GST_No); }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--stock-text)' }}>{v.Vendor_Name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--stock-muted)' }}>{v.Vendor_Type} {v.GST_No && `• GST: ${v.GST_No}`}</div>
                      </div>
                      <ChevronRight />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT: Broadcast */}
            {activeTab === "broadcast" && (
              <div className="stock-panel">
                <h3 className="stock-section-heading">Broadcast</h3>
                <div className="stock-grid">
                  <div className="stock-panel" style={{ padding: '12px', background: 'var(--stock-bg)' }}>
                    <div className="stock-field" style={{ marginBottom: '16px' }}>
                      <label>Composer</label>
                      <input type="text" className="stock-input" value={Notification} placeholder="Message content..." onChange={(e) => setNotification(e.target.value)} />
                    </div>
                    <button className="stock-button" onClick={saveNotifications}>Send Broadcast</button>

                    <div className="src-scroll-list" style={{ marginTop: "20px", maxHeight: '300px' }}>
                      {dt_Notifications_Data.map(n => (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid var(--stock-border)' }} key={n.OrderId} onClick={() => clickNotifRow(n)}>
                          <span style={{ fontWeight: 600, color: 'var(--stock-text)' }}>{n.Notification_Text}</span>
                          <IonCheckbox checked={n.Isactive} onIonChange={(e) => updateNotifStatus(n.OrderId || n.NID, e.detail.checked)} style={{ margin: 0 }} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="stock-panel" style={{ padding: '12px', background: 'var(--stock-bg)' }}>
                    <h4 className="stock-section-heading" style={{ fontSize: '14px', marginBottom: '8px' }}>Participants ({dt_Notifications.filter(x => x.Isactive).length})</h4>
                    <input type="text" className="stock-input" value={notifSearch} placeholder="Filter participants..." onChange={(e) => setNotifSearch(e.target.value)} style={{ marginBottom: '12px' }} />
                    <div className="src-scroll-list" style={{ maxHeight: '350px' }}>
                      {dt_Notifications.filter(x => !notifSearch || x.EmpName.toLowerCase().includes(notifSearch.toLowerCase())).map((emp, i) => (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid var(--stock-border)', cursor: 'pointer' }} key={i} onClick={() => {
                          const next = !emp.Isactive;
                          setDt_Notifications(p => p.map((x, j) => i === j ? { ...x, Isactive: next } : x));
                        }}>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--stock-text)' }}>{emp.EmpName}</div>
                            <small style={{ color: 'var(--stock-muted)' }}>{emp.EmpCode}</small>
                          </div>
                          <IonCheckbox checked={emp.Isactive} style={{ margin: 0 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Import */}
            {activeTab === "import" && (
              <div className="stock-panel">
                <h3 className="stock-section-heading">Process Import</h3>
                <div className="stock-field" style={{ marginBottom: '16px' }}>
                  <label>Select Entity</label>
                  <select className="stock-select" value={ImportFile} onChange={(e) => setImportFile(e.target.value)}>
                    <option value="Productivity">Productivity</option>
                    <option value="Attendance">Attendance</option>
                  </select>
                </div>
                <div className="stock-field" style={{ marginBottom: '16px' }}>
                  <input type="file" className="stock-input" onChange={(e) => setFiles(e.target.files)} />
                </div>
                <button className="stock-button stock-button--secondary" onClick={handleImport}>Execute Import</button>
              </div>
            )}

            {/* TAB CONTENT: Maintenance */}
            {activeTab === "maint" && (
              <div className="stock-panel">
                <h3 className="stock-section-heading">Maintenance</h3>
                <div className="stock-field" style={{ marginBottom: '16px' }}>
                  <label>Work Description</label>
                  <input type="text" className="stock-input" value={Maintance} placeholder="Work Description" onChange={(e) => setMaintance(e.target.value)} />
                </div>
                <div className="stock-grid" style={{ marginBottom: '16px' }}>
                  <div className="stock-field">
                    <label>Assigned Staff</label>
                    <div className="stock-input" onClick={() => setMaintEmpPopover(true)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      {MaintEmpName || "Select Staff"}
                    </div>
                  </div>
                  <div className="stock-field">
                    <label>Cycle Days</label>
                    <input type="number" className="stock-input" value={cycledays} placeholder="Days" onChange={(e) => setCycledays(e.target.value)} />
                  </div>
                </div>
                <button className="stock-button" onClick={saveMaint}>Save Maintenance</button>
                
                <div className="stock-table-wrapper" style={{ marginTop: '20px', maxHeight: '300px' }}>
                  <table className="stock-table">
                    <thead><tr><th>Work</th><th style={{ textAlign: 'right' }}>Days Left</th></tr></thead>
                    <tbody>
                      {ds_Maintance ? ds_Maintance.map(m => (
                        <tr key={m.M_id} onClick={() => editMaint(m)} style={{ cursor: 'pointer' }}>
                          <td>{m.Maint_Work}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--ion-color-primary)' }}>{m.Days_Left}d</td>
                        </tr>
                      )) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
