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

// tbl_Branch -> APP_Load_Branch returns (lid, Branch, BranchDept)
const decodeBranches = (data: any) =>
  decodeRows(data, ["LID", "Branch", "BranchDept"], "Branches");

// tbl_Vehicles -> APP_Load_Vehicles.
// VehModel and PerKm are LAST because they were added last, and these rows
// arrive as bare arrays so position is the whole contract: a database still
// running the four-column proc returns four values, row[4] and row[5] read as
// undefined, and the two boxes show blank instead of the screen breaking.
const decodeVehicles = (data: any) =>
  decodeRows(
    data,
    ["VehId", "OwnedBy", "VehType", "VehNo", "VehModel", "PerKm"],
    "Vehicles"
  );

// The two kinds the office runs. A free-text box here would collect
// "2 wheeler", "2-Wheeler" and "Two Wheeler" as three different types, and
// the duplicate check works on exact text.
const VEH_TYPES = ["2 Wheeler", "4 Wheeler"];

// A vehicle is either the company's or somebody's own. "Office" is the
// literal owner for the first kind; the second is an employee code.
const VEH_OFFICE = "Office";

// Distance is LAST in this list because it was added last. The rows arrive
// as bare arrays, so position is the contract: a database still running the
// six-column proc returns six values, row[6] reads as undefined, and the
// distance shows blank instead of the screen breaking.
const decodeBranchMovement = (data: any) =>
  decodeRows(
    data,
    ["ID", "FromBranch", "FromDept", "ToBranch", "ToDept", "InTime", "Distance"],
    "Branch Movement"
  );

/** What a distance box is allowed to contain: digits, and at most one dot
 *  with two places after it. Kept as text rather than a number input - a
 *  number input reports a half-typed "12." as the empty string, which makes
 *  the dot impossible to type on the way to "12.5". Extra dots are dropped
 *  rather than truncating there, so "1..5" lands on "1.5" and not on "1". */
/** Whether a distance box counts towards the "N distances" tally.
 *  Blank is unmeasured. Zero IS stored and IS kept on reload, but it means a
 *  movement with no travel in it, so it does not add to a count of measured
 *  roads. Number() rather than a string test so "0", "0.0" and "0.00" all
 *  read the same, and so a stray "." (NaN, never > 0) cannot count either. */
const distIsSet = (v: any) => {
  const t = String(v ?? "").trim();
  return t !== "" && Number(t) > 0;
};

const cleanDistance = (v: any) => {
  const parts = String(v ?? "").replace(/[^0-9.]/g, "").split(".");
  const whole = (parts.shift() ?? "").slice(0, 6);
  if (!parts.length) return whole;
  return whole + "." + parts.join("").slice(0, 2);
};

/** A branch/dept row written as one string. \u0001 cannot appear in a branch
 *  or dept name, so it is a safe separator - the same one the attendance rule
 *  screen uses for its own keys. */
const bdKey = (branch: any, dept: any) =>
  `${String(branch ?? "").trim()}\u0001${String(dept ?? "").trim()}`;

/** One ordered movement, From -> To. Direction matters: Vizag/SDE -> Vizag/AU
 *  is a different rule from Vizag/AU -> Vizag/SDE. */
const moveKey = (fromBranch: any, fromDept: any, toBranch: any, toDept: any) =>
  `${bdKey(fromBranch, fromDept)}\u0002${bdKey(toBranch, toDept)}`;

const bdLabel = (branch: any, dept: any) => {
  const d = String(dept ?? "").trim();
  return d ? `${String(branch ?? "").trim()} / ${d}` : String(branch ?? "").trim();
};

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

  // 2b. Branches (tbl_Branch) - the master list behind the Branch dropdown on
  //     the Employee Profile screen. Each branch also carries a BranchDept,
  //     and the distinct BranchDept values feed the Branch Dept dropdown on
  //     that same screen - so there is no separate branch-dept table to manage.
  const [BranchName, setBranchName] = useState("");
  const [BranchDeptName, setBranchDeptName] = useState("");
  const [branchList, setBranchList] = useState<any[]>([]);
  const [tempBranchId, setTempBranchId] = useState<number>(0);
  const [branchSaving, setBranchSaving] = useState(false);
  // The row whose Delete has been pressed once. Deleting a branch takes its
  // movement and attendance rules with it, so it asks twice - but inline, not
  // through a browser confirm() nobody reads.
  const [branchDeleteId, setBranchDeleteId] = useState<number>(0);
  const [branchDeletingId, setBranchDeletingId] = useState<number>(0);

  // 2b-ii. Vehicles (tbl_Vehicles) - who owns what, and what it costs to run.
  //        OwnedBy is "Office" for a company vehicle or an employee code for a
  //        personal one. The same number can appear twice under one owner when
  //        the vehicles are different types, so uniqueness is the whole triple
  //        (owner, type, number) rather than the number by itself.
  const [vehOwnedBy, setVehOwnedBy] = useState(VEH_OFFICE);
  // The owner picker is a list, not a text box. Typed codes get mistyped, and
  // a code that matches nobody looks exactly like one that does.
  const [vehOwnerOpen, setVehOwnerOpen] = useState(false);
  const [vehOwnerSearch, setVehOwnerSearch] = useState("");
  // Its own copy of the roll rather than sharing empActive. That list is
  // loaded for the Maintenance tab and comes back empty when its endpoint is
  // unhappy, which is how this picker ended up with nothing in it - a silent
  // dependency on a screen nobody was looking at.
  const [vehOwnerPeople, setVehOwnerPeople] = useState<any[]>([]);
  const [vehType, setVehType] = useState(VEH_TYPES[1]);
  const [vehNo, setVehNo] = useState("");
  const [vehModel, setVehModel] = useState("");
  const [vehPerKm, setVehPerKm] = useState("");
  const [vehList, setVehList] = useState<any[]>([]);
  const [tempVehId, setTempVehId] = useState<number>(0);
  const [vehSaving, setVehSaving] = useState(false);
  // Same two-press delete the branch table uses - inline, not a confirm() box.
  const [vehDeleteId, setVehDeleteId] = useState<number>(0);
  const [vehDeletingId, setVehDeletingId] = useState<number>(0);

  // Who can own a vehicle. Two sources, tried in order, because neither is
  // guaranteed on its own:
  //   1. Sources/load_empployee - the whole active roll, which is what a
  //      master list wants.
  //   2. OnDuty/load_employees_duties - the same list the On Duty screen
  //      fills its team dropdown from, scoped to the signed-in user.
  // The second is the fallback rather than the first because it only returns
  // the people below you, and a vehicles master should not quietly hide half
  // the staff from an admin who happens to have no reports.
  const loadVehOwnerPeople = async () => {
    const norm = (rows: any[]) =>
      rows
        .map((x: any) => ({ EmpCode: String(x.EmpCode ?? "").trim(), EmpName: String(x.EmpName ?? "").trim() }))
        .filter((x) => x.EmpCode !== "");

    try {
      const r = await axios.get(`${API_BASE}Sources/load_empployee`, { headers: authHeaders() });
      const rows = norm(decodeEmployeesActive(r.data) as any[]);
      if (rows.length) {
        setVehOwnerPeople(rows);
        return;
      }
    } catch (e) {
      // fall through to the On Duty list
    }

    try {
      const r = await axios.get(`${API_BASE}OnDuty/load_employees_duties`, {
        params: {
          empCode: user?.EmpCode ?? user?.empCode ?? "",
          designation: user?.Designation ?? user?.designation ?? "",
        },
        headers: authHeaders(),
      });
      // Positional, same as the On Duty screen reads it: [0]=code [1]=name.
      const raw = Array.isArray(r.data) ? r.data : [];
      setVehOwnerPeople(
        norm(raw.map((x: any) => ({ EmpCode: x?.[0], EmpName: x?.[1] })))
      );
    } catch (e) {
      setVehOwnerPeople([]);
    }
  };

  const loadVehicles = async () => {
    try {
      const r = await axios.get(`${API_BASE}Sources/Load_Vehicles`, { headers: authHeaders() });
      setVehList(decodeVehicles(r.data));
    } catch (e) {
      setVehList([]);
    }
  };

  // What the closed picker reads. A bare code says very little, so the name
  // comes with it whenever the roll knows who that is - and when it does not,
  // the code still shows rather than being swallowed, because a vehicle owned
  // by somebody who has since left is a real row that has to stay editable.
  const vehOwnerLabel = useMemo(() => {
    const v = String(vehOwnedBy ?? "").trim();
    if (!v) return "";
    if (v.toLowerCase() === VEH_OFFICE.toLowerCase()) return VEH_OFFICE;
    const who = vehOwnerPeople.find((x) => String(x.EmpCode) === v);
    return who && who.EmpName ? `${who.EmpName} (${v})` : v;
  }, [vehOwnedBy, vehOwnerPeople]);

  // Office is pinned on top as its own entry. It is not a person, so it is not
  // in the roll and should not have to be found among the staff.
  const vehOwnerOptions = useMemo(() => {
    const q = vehOwnerSearch.trim().toLowerCase();
    const staff = vehOwnerPeople
      .filter(
        (x) =>
          q === "" ||
          String(x.EmpName ?? "").toLowerCase().includes(q) ||
          String(x.EmpCode ?? "").toLowerCase().includes(q)
      )
      .map((x) => ({ EmpCode: String(x.EmpCode), EmpName: String(x.EmpName || x.EmpCode), isOffice: false }));
    const office =
      q === "" || VEH_OFFICE.toLowerCase().includes(q)
        ? [{ EmpCode: VEH_OFFICE, EmpName: VEH_OFFICE, isOffice: true }]
        : [];
    return [...office, ...staff];
  }, [vehOwnerPeople, vehOwnerSearch]);

  // Who owns it decides what the rate can be. An office vehicle runs on the
  // office's own fuel, so 0 is not a rate somebody forgot to fill in - it is
  // the right answer, and the box is closed. A personal vehicle is the other
  // way round: the rate is the reason the row is being kept, so it is asked
  // for rather than offered.
  const vehIsOffice =
    String(vehOwnedBy ?? "").trim().toLowerCase() === VEH_OFFICE.toLowerCase();

  const clearVehicleForm = () => {
    setVehOwnedBy(VEH_OFFICE);
    setVehOwnerOpen(false);
    setVehOwnerSearch("");
    setVehType(VEH_TYPES[1]);
    setVehNo("");
    setVehModel("");
    // The empty form is owned by Office, so its rate is Office's rate.
    setVehPerKm("0");
    setTempVehId(0);
  };

  const saveVehicle = async () => {
    const owner = vehOwnedBy.trim();
    const type = vehType.trim();
    // Stored upper case so "ap09bc1234" and "AP09BC1234" are one vehicle
    // rather than two rows nobody can tell apart in the list.
    const no = vehNo.trim().toUpperCase();
    const isOffice = owner.toLowerCase() === VEH_OFFICE.toLowerCase();
    // 0 for the office, whatever was entered for anybody else.
    const perKm = isOffice ? "0" : vehPerKm.trim();
    if (!owner) return showToast("Please say who owns this vehicle...!", "danger");
    if (!type) return showToast("Please pick the vehicle type...!", "danger");
    if (!no) return showToast("Please enter the vehicle number...!", "danger");
    if (!isOffice && perKm === "")
      return showToast("Please enter the per km rate for this vehicle...!", "danger");

    // Client-side duplicate guard; the proc checks again server-side, so this
    // is only here to say so without a round trip.
    const dup = vehList.find(
      (v) =>
        String(v.OwnedBy ?? "").trim().toLowerCase() === owner.toLowerCase() &&
        String(v.VehType ?? "").trim().toLowerCase() === type.toLowerCase() &&
        String(v.VehNo ?? "").trim().toLowerCase() === no.toLowerCase() &&
        Number(v.VehId) !== Number(tempVehId)
    );
    if (dup) return showToast(`${owner} already has a ${type} numbered ${no}...!`, "danger");

    setVehSaving(true);
    try {
      await axios.post(
        `${API_BASE}Sources/Save_Vehicle`,
        {
          _Veh_ID: tempVehId,
          _OwnedBy: owner,
          _VehType: type,
          _VehNo: no,
          _VehModel: vehModel.trim(),
          // Already settled above: 0 for an office vehicle, the entered rate
          // for a personal one. The proc applies the same rule again, so an
          // older screen or a direct call cannot get around it.
          _PerKm: perKm,
        },
        { headers: { "Content-Type": "application/json", ...authHeaders() } }
      );
      showToast(tempVehId ? "Vehicle Updated Successfully...!" : "Vehicle Added Successfully...!");
      clearVehicleForm();
      loadVehicles();
    } catch (e: any) {
      console.log(e?.response?.data);
      showToast(
        typeof e?.response?.data === "string" && e.response.data
          ? e.response.data
          : "Error While Sending...!",
        "danger"
      );
    } finally {
      setVehSaving(false);
    }
  };

  const deleteVehicle = async (id: number) => {
    if (!id) return;
    setVehDeletingId(id);
    try {
      await axios.post(
        `${API_BASE}Sources/Delete_Vehicle`,
        { _Veh_ID: id, _OwnedBy: "", _VehType: "", _VehNo: "", _VehModel: "", _PerKm: "" },
        { headers: { "Content-Type": "application/json", ...authHeaders() } }
      );
      showToast("Vehicle Deleted Successfully...!");
      // Editing the row that just vanished would post an update against an id
      // that no longer exists, so clear the form when it was that one.
      if (Number(tempVehId) === Number(id)) clearVehicleForm();
      loadVehicles();
    } catch (e: any) {
      console.log(e?.response?.data);
      showToast(
        typeof e?.response?.data === "string" && e.response.data
          ? e.response.data
          : "Error While Deleting...!",
        "danger"
      );
    } finally {
      setVehDeletingId(0);
      setVehDeleteId(0);
    }
  };

  const loadBranches = async () => {
    try {
      const r = await axios.get(`${API_BASE}Sources/Load_Branch`, { headers: authHeaders() });
      setBranchList(decodeBranches(r.data));
    } catch (e) {
      setBranchList([]);
    }
  };

  // 2c. On-duty movement check-in times.
  //     Every ordered branch/dept pair is generated on screen from branchList;
  //     only the pairs that carry an override are ever stored. A movement with
  //     no stored time uses the employee's own profile in-time, which is the
  //     default for the overwhelming majority of combinations.
  const [movementRules, setMovementRules] = useState<Record<string, string>>({});
  // Edits not yet written back. Kept apart from movementRules so a reload
  // cannot silently discard something half-typed.
  const [movementDraft, setMovementDraft] = useState<Record<string, string>>({});
  // How far the movement is, in km, and its own draft. A second pair of maps
  // rather than one map of objects: every existing read of movementRules
  // means "the check-in time for this pair", and widening it to an object
  // would have quietly changed all of them at once for a column that is
  // independent of the time anyway. A pair can carry a distance with no time
  // set, and it still shows.
  const [movementDistRules, setMovementDistRules] = useState<Record<string, string>>({});
  const [movementDistDraft, setMovementDistDraft] = useState<Record<string, string>>({});
  // Which distance boxes the user has typed into by hand, as opposed to the
  // ones filled in for them from the opposite direction. Without this there is
  // no way to say "the way back is genuinely different": the two boxes would
  // stay locked together, and every attempt to change one would change the
  // other straight back. Not persisted - a saved figure stands on its own, and
  // this only decides what a keystroke is allowed to overwrite.
  const [movementDistTouched, setMovementDistTouched] = useState<Record<string, boolean>>({});
  const [movementSaving, setMovementSaving] = useState(false);

  // One pair edited in either column is ONE unsaved change, not two - the save
  // posts the whole row - so the button counts the union rather than the sum.
  const movementDirtyKeys = useMemo(
    () => Array.from(new Set([...Object.keys(movementDraft), ...Object.keys(movementDistDraft)])),
    [movementDraft, movementDistDraft]
  );

  // Counted per column, not folded together. Once every road has a distance
  // on it, a combined figure reads "42 set" no matter how many check-in times
  // exist, and the number nobody can see is exactly the one being edited.
  const movementTimeCount = useMemo(
    () => Object.values(movementRules).filter((v) => String(v ?? "").trim() !== "").length,
    [movementRules]
  );
  // Zero is stored and it survives a reload - see loadBranchMovement - but it
  // is not counted here. A 0 km movement is one that involves no travel, so
  // for the purpose of "how many distances have we actually measured" it is
  // the same answer as blank, and counting it would overstate the work done.
  const movementDistCount = useMemo(
    () => Object.values(movementDistRules).filter((v) => distIsSet(v)).length,
    [movementDistRules]
  );
  // A box per column, not one shared box. With every combination listed, the
  // question is nearly always "what happens when THESE people go THERE", and
  // that needs both ends pinned at once - a single box can only pin one.
  const [movementFromSearch, setMovementFromSearch] = useState("");
  const [movementToSearch, setMovementToSearch] = useState("");

  // Column the movement grid is ordered by, and which way. Sorting on the
  // OTHER column as a tiebreak keeps every "from" block internally ordered,
  // so the grid reads as groups rather than as 42 unrelated lines.
  const [movementSortCol, setMovementSortCol] = useState<"from" | "to">("from");
  const [movementSortDir, setMovementSortDir] = useState<"asc" | "desc">("asc");

  // Clicking the column you are already on flips the direction; clicking the
  // other one starts it ascending, which is what people expect from a grid.
  const sortMovementBy = (col: "from" | "to") => {
    if (col === movementSortCol) setMovementSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setMovementSortCol(col); setMovementSortDir("asc"); }
  };

  // Which of the two sections on the Branches tab are open. Both start open so
  // nothing appears to have gone missing; the counts stay in the headings when
  // closed so a collapsed section still tells you what is inside it.
  type BranchSection = "branches" | "movement" | "";
  const [branchSection, setBranchSection] = useState<BranchSection>("branches");
  const branchesOpen = branchSection === "branches";
  const movementOpen = branchSection === "movement";
  // Clicking the section that is already open shuts it, so "both closed"
  // is still reachable and the tab can be collapsed down to two headers.
  const toggleBranchSection = (sec: BranchSection) =>
    setBranchSection((cur) => (cur === sec ? "" : sec));

  /** The distinct branch/dept rows, in table order. Deduped: two tbl_Branch
   *  rows carrying the same pair would otherwise put the same movement on the
   *  grid twice, with two inputs fighting over one stored rule. */
  const movementNodes = useMemo(() => {
    const seen = new Set<string>();
    const out: { branch: string; dept: string; key: string; label: string }[] = [];
    branchList.forEach((b: any) => {
      const branch = String(b.Branch ?? "").trim();
      if (!branch) return;
      const dept = String(b.BranchDept ?? "").trim();
      const key = bdKey(branch, dept);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ branch, dept, key, label: bdLabel(branch, dept) });
    });
    return out;
  }, [branchList]);

  /** Every ORDERED pair, self-pairs excluded: n rows give n*(n-1) movements.
   *  Generated here rather than stored, so adding a branch above immediately
   *  adds its movements below - nobody has to seed a table by hand. */
  const movementPairs = useMemo(() => {
    const out: any[] = [];
    movementNodes.forEach((f) =>
      movementNodes.forEach((t) => {
        if (f.key === t.key) return;   // staying put is not a movement
        out.push({ k: moveKey(f.branch, f.dept, t.branch, t.dept), from: f, to: t });
      })
    );
    return out;
  }, [movementNodes]);

  /** What the grid actually renders. With 7 branch rows this is 42 lines, and
   *  it grows with the square of the branch count, so the filters are not a
   *  nicety - they are how the screen stays usable. */
  const movementVisible = useMemo(() => {
    // Terms are ANDed and order does not matter, so "au vizag" finds
    // "Vizag / AU" just as "vizag au" does. Typing the branch and the dept in
    // whichever order they come to mind should not decide whether it matches.
    const terms = (t: string) => t.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const fromTerms = terms(movementFromSearch);
    const toTerms = terms(movementToSearch);
    // A term matches when a WORD of the label starts with it, not when the
    // letters appear anywhere in it. Plain "includes" made "aku" match
    // "Srikakulam" - srik-AKU-lam - which put BRAU rows in an AKU search and
    // made the filter look broken. Word starts are what people mean when they
    // type a dept code.
    const matches = (label: string, ts: string[]) => {
      if (!ts.length) return true;               // empty box filters nothing
      const words = label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      return ts.every((t) => words.some((w) => w.startsWith(t)));
    };

    const rows = movementPairs.filter((p: any) => {
      // Both ends must match. Fill one box to see everything leaving or
      // arriving somewhere; fill both to land on the single movement.
      return matches(p.from.label, fromTerms) && matches(p.to.label, toTerms);
    });

    const sign = movementSortDir === "asc" ? 1 : -1;
    const primary = movementSortCol;                       // "from" or "to"
    const secondary = primary === "from" ? "to" : "from";
    // localeCompare, not <, so "Vizag / AU" and "vizag / au" cannot end up in
    // two separate blocks the way a raw code-point compare would put them.
    const cmp = (a: string, b: string) =>
      a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

    // Sorted on a COPY: movementPairs is memoised, and sorting it in place
    // would mutate the value other memos are still reading.
    return [...rows].sort((a: any, b: any) => {
      const first = cmp(a[primary].label, b[primary].label);
      if (first !== 0) return first * sign;
      // The tiebreak always runs ascending - flipping it too would shuffle
      // rows inside a block for no reason the user asked for.
      return cmp(a[secondary].label, b[secondary].label);
    });
  }, [movementPairs, movementFromSearch, movementToSearch,
      movementSortCol, movementSortDir]);

  /** The visible rows folded under their Moving From row. Group order and the
   *  order inside each group both come straight from movementVisible, so the
   *  column sort above still decides everything - grouping only nests it. */
  const movementGroups = useMemo(() => {
    const order: string[] = [];
    const by: Record<string, any> = {};
    movementVisible.forEach((p: any) => {
      if (!by[p.from.key]) {
        by[p.from.key] = { key: p.from.key, label: p.from.label, rows: [] };
        order.push(p.from.key);
      }
      by[p.from.key].rows.push(p);
    });
    return order.map((k) => by[k]);
  }, [movementVisible]);

  // Which Moving From groups are expanded. Only groups the user has actually
  // clicked appear here; everything else follows the default below.
  const [movementGroupOpen, setMovementGroupOpen] = useState<Record<string, boolean>>({});

  // With a filter running, the few surviving rows ARE the answer, so groups
  // default to open. With no filter the page should stay short, so they
  // default to closed. An explicit click always beats the default.
  const movementFiltering =
    movementFromSearch.trim() !== "" || movementToSearch.trim() !== "";
  const isMovementGroupOpen = (k: string) => movementGroupOpen[k] ?? movementFiltering;
  const toggleMovementGroup = (k: string) =>
    setMovementGroupOpen((prev) => {
      const wasOpen = prev[k] ?? movementFiltering;
      // Accordion. Only one Moving From branch/dept is expanded at a time, so
      // the screen never turns into a wall of every combination at once.
      // A fresh map of explicit falses is deliberate: it clears every prior
      // open AND pins the rest shut, which a plain spread would not do while
      // a filter is running and the default is open.
      const next: Record<string, boolean> = {};
      movementGroups.forEach((g: any) => { next[g.key] = false; });
      next[k] = !wasOpen;
      return next;
    });

  const loadBranchMovement = async () => {
    try {
      const r = await axios.get(`${API_BASE}Sources/Load_BranchMovement`, { headers: authHeaders() });
      const map: Record<string, string> = {};
      const dist: Record<string, string> = {};
      decodeBranchMovement(r.data).forEach((row: any) => {
        const k = moveKey(row.FromBranch, row.FromDept, row.ToBranch, row.ToDept);
        const t = String(row.InTime ?? "").trim();
        if (t) map[k] = t;
        // "" and "0" are two different answers and are kept apart. Blank is
        // "nobody has measured this"; zero is a measurement - two units on one
        // compound, a move that involves no travel at all - and somebody had to
        // type it. Folding zero into blank here would silently discard it on
        // every reload and make the box impossible to keep at 0.
        const d = cleanDistance(row.Distance);
        if (d !== "") dist[k] = d;
      });
      setMovementRules(map);
      setMovementDistRules(dist);
      setMovementDraft({});
      setMovementDistDraft({});
      setMovementDistTouched({});
    } catch (e) {
      setMovementRules({});
      setMovementDistRules({});
    }
  };

  /** The reverse of a movement: B -> A for the A -> B handed in. */
  const reverseKey = (p: any) => moveKey(p.to.branch, p.to.dept, p.from.branch, p.from.dept);

  /** Fill in the return trip for every distance that has one missing.
   *
   *  Distance is a property of the road, so Eluru/DBS -> Srikakulam/BRAU and
   *  Srikakulam/BRAU -> Eluru/DBS are the same 380 km, and typing it twice for
   *  each of 21 roads is 21 chances to type it differently. Typing into a box
   *  now mirrors as you go, but that only helps from here on, so this catches
   *  up everything already entered.
   *
   *  Only BLANK returns are touched. A return leg deliberately set to a
   *  different figure - a one-way stretch, a diversion on the way back - is a
   *  real answer, and a button that overwrote it would be doing damage rather
   *  than work.
   */
  const mirrorDistances = () => {
    const next = { ...movementDistDraft };
    const eff = (k: string) =>
      Object.prototype.hasOwnProperty.call(next, k) ? next[k] : (movementDistRules[k] ?? "");
    let filled = 0;

    movementPairs.forEach((p: any) => {
      const cur = eff(p.k);
      if (!cur) return;
      const rk = reverseKey(p);
      // Read through `next`, so a return filled earlier in this same pass is
      // seen as taken and the pair is not then mirrored back over itself.
      if (eff(rk)) return;
      next[rk] = cur;
      filled++;
    });

    setMovementDistDraft(next);
    showToast(
      filled
        ? `${filled} return trip${filled === 1 ? "" : "s"} filled in. Save to keep them.`
        : "Every distance already has its return trip.",
      filled ? "success" : "warning"
    );
  };

  const saveBranchMovement = async () => {
    const changed = movementDirtyKeys;
    if (!changed.length) return showToast("Nothing changed.", "warning");

    setMovementSaving(true);
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    let failed = 0;

    // Sent one at a time on purpose: the proc is an upsert-or-delete per pair,
    // and one bad row must not take the whole batch down with it.
    for (const k of changed) {
      const [from, to] = k.split("\u0002");
      const [fromBranch, fromDept] = from.split("\u0001");
      const [toBranch, toDept] = to.split("\u0001");
      try {
        await axios.post(
          `${API_BASE}Sources/Save_BranchMovement`,
          {
            _FromBranch: fromBranch,
            _FromDept: fromDept,
            _ToBranch: toBranch,
            _ToDept: toDept,
            // The whole row goes every time, edited column or not. Sending
            // only what changed would need the proc to tell "leave this one
            // alone" apart from "clear it", and blank already means clear.
            _InTime: (Object.prototype.hasOwnProperty.call(movementDraft, k)
              ? movementDraft[k]
              : (movementRules[k] ?? "")),
            _Distance: (Object.prototype.hasOwnProperty.call(movementDistDraft, k)
              ? movementDistDraft[k]
              : (movementDistRules[k] ?? "")),
            _CreatedBy: user.empName || user.EmpName || "admin",
          },
          { headers: { "Content-Type": "application/json", ...authHeaders() } }
        );
      } catch (e) {
        failed++;
      }
    }

    setMovementSaving(false);
    showToast(
      failed
        ? `${changed.length - failed} saved, ${failed} failed.`
        : `${changed.length} movement${changed.length === 1 ? "" : "s"} saved.`,
      failed ? "danger" : "success"
    );
    loadBranchMovement();
  };

  const deleteBranch = async (lid: number) => {
    if (!lid) return;
    setBranchDeletingId(lid);
    try {
      await axios.post(
        `${API_BASE}Sources/Delete_Branch`,
        { _Branch_ID: lid, _Branch: "", _BranchDept: "" },
        { headers: { "Content-Type": "application/json", ...authHeaders() } }
      );
      showToast("Branch Deleted Successfully...!");
      // Editing the row that just vanished would post an update against an id
      // that no longer exists, so clear the form when it was that one.
      if (Number(tempBranchId) === Number(lid)) {
        setBranchName("");
        setBranchDeptName("");
        setTempBranchId(0);
      }
      loadBranches();
      // Its movements went with it server-side; reload so the grid below
      // stops showing combinations for a row that is gone.
      loadBranchMovement();
    } catch (e: any) {
      console.log(e?.response?.data);
      showToast(
        typeof e?.response?.data === "string" && e.response.data
          ? e.response.data
          : "Error While Deleting...!",
        "danger"
      );
    } finally {
      setBranchDeletingId(0);
      setBranchDeleteId(0);
    }
  };

  const saveBranch = async () => {
    const name = BranchName.trim();
    if (!name) return showToast("Please Enter The Branch Value...!", "danger");

    // Client-side duplicate guard (the proc checks again server-side).
    // A branch may be listed once per dept, so the same branch name is fine -
    // it is the (branch, dept) PAIR that has to be unique.
    const dept = BranchDeptName.trim();
    const dup = branchList.find(
      (b) =>
        String(b.Branch ?? "").trim().toLowerCase() === name.toLowerCase() &&
        String(b.BranchDept ?? "").trim().toLowerCase() === dept.toLowerCase() &&
        Number(b.LID) !== Number(tempBranchId)
    );
    if (dup)
      return showToast(
        dept
          ? `${name} already has a ${dept} dept...!`
          : "This branch already exists...!",
        "danger"
      );

    setBranchSaving(true);
    try {
      await axios.post(
        `${API_BASE}Sources/Save_Branch`,
        {
          _Branch_ID: tempBranchId,
          _Branch: name,
          _BranchDept: BranchDeptName.trim(),
        },
        { headers: { "Content-Type": "application/json", ...authHeaders() } }
      );
      showToast(
        tempBranchId ? "Branch Updated Successfully...!" : "Branch Added Successfully...!"
      );
      setBranchName("");
      setBranchDeptName("");
      setTempBranchId(0);
      loadBranches();
    } catch (e: any) {
      console.log(e?.response?.data);
      showToast(
        typeof e?.response?.data === "string" && e.response.data
          ? e.response.data
          : "Error While Sending...!",
        "danger"
      );
    } finally {
      setBranchSaving(false);
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

  // 8. Active staff list (feeds the staff pickers below)
  const [empActive, setEmpActive] = useState<any[]>([]);

  const loadEmployeesActive = async () => {
    try {
      const r = await axios.get(`${API_BASE}Sources/load_empployee`, { headers: authHeaders() });
      setEmpActive(decodeEmployeesActive(r.data));
    } catch (e) {
      setEmpActive([]);
    }
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
    loadBranches();
    loadBranchMovement();
    loadVehicles();
    loadVehOwnerPeople();
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
              <button type="button" style={{ flex: '1 1 auto', width: 'auto', minWidth: '0', padding: '0 12px' }} className={`stock-tab ${activeTab === "maint" ? "active" : ""}`} onClick={() => setActiveTab("maint")}>
                Maintenance
              </button>
              <button type="button" style={{ flex: '1 1 auto', width: 'auto', minWidth: '0', padding: '0 12px' }} className={`stock-tab ${activeTab === "branch" ? "active" : ""}`} onClick={() => setActiveTab("branch")}>
                Branches
              </button>
              <button type="button" style={{ flex: '1 1 auto', width: 'auto', minWidth: '0', padding: '0 12px' }} className={`stock-tab ${activeTab === "vehicles" ? "active" : ""}`} onClick={() => setActiveTab("vehicles")}>
                Vehicles
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

            {/* TAB CONTENT: Branches (tbl_Branch) */}
            {activeTab === "branch" && (
              <div className="stock-panel">
                <h3
                  className="stock-section-heading"
                  onClick={() => toggleBranchSection("branches")}
                  style={{
                    cursor: 'pointer', userSelect: 'none',
                    display: 'flex', alignItems: 'center', gap: '10px', margin: 0,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block', fontSize: '0.7em', lineHeight: 1,
                      transition: 'transform 0.15s ease',
                      transform: branchesOpen ? 'rotate(90deg)' : 'none',
                    }}
                  >
                    &#9654;
                  </span>
                  Branches
                  <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 400, color: 'var(--stock-muted)' }}>
                    {branchList.length} row{branchList.length === 1 ? '' : 's'}
                  </span>
                </h3>

                {branchesOpen && (<>
                <p style={{ margin: '12px 0 16px 0', fontSize: '0.8rem', color: 'var(--stock-muted)' }}>
                  These entries fill the Branch dropdown on the Employee Profile screen.
                  Each branch also carries a Branch Dept, and the distinct values across
                  all branches fill the Branch Dept dropdown beside it.
                </p>

                <div className="stock-field" style={{ marginBottom: '16px' }}>
                  <label>{tempBranchId ? "Edit Branch" : "New Branch"}</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="stock-input"
                      style={{ flex: '2 1 200px' }}
                      value={BranchName}
                      placeholder="Branch name - e.g. Visakhapatnam"
                      onChange={(e) => setBranchName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveBranch(); }}
                    />
                    <input
                      type="text"
                      className="stock-input"
                      style={{ flex: '2 1 180px' }}
                      value={BranchDeptName}
                      placeholder="Branch dept - e.g. Operations"
                      list="branch-dept-suggestions"
                      onChange={(e) => setBranchDeptName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveBranch(); }}
                    />
                    {/* reuse depts already typed on other branches so the same
                        name is not re-spelled three different ways */}
                    <datalist id="branch-dept-suggestions">
                      {Array.from(
                        new Set(
                          branchList
                            .map((b) => String(b.BranchDept ?? "").trim())
                            .filter((v) => v !== "")
                        )
                      ).map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                    <button className="stock-button" onClick={saveBranch} disabled={branchSaving}>
                      {branchSaving ? "Saving..." : tempBranchId ? "Update" : "Save"}
                    </button>
                    {tempBranchId > 0 && (
                      <button
                        className="stock-button stock-button--secondary"
                        onClick={() => { setBranchName(""); setBranchDeptName(""); setTempBranchId(0); }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  {tempBranchId > 0 && (
                    <small style={{ display: 'block', marginTop: '6px', color: 'var(--stock-muted)' }}>
                      Renaming the branch also updates every employee currently assigned to it.
                    </small>
                  )}
                </div>

                <div className="stock-table-wrapper" style={{ maxHeight: '400px' }}>
                  <table className="stock-table">
                    <thead><tr><th>Branch</th><th>Branch Dept</th><th style={{ width: '150px' }}></th></tr></thead>
                    <tbody>
                      {branchList.map((b) => {
                        const lid = Number(b.LID);
                        const confirming = branchDeleteId === lid;
                        const deleting = branchDeletingId === lid;
                        return (
                        <tr
                          key={b.LID}
                          onClick={() => {
                            setBranchName(String(b.Branch ?? ""));
                            setBranchDeptName(String(b.BranchDept ?? ""));
                            setTempBranchId(lid);
                          }}
                          style={{
                            cursor: 'pointer',
                            background: confirming
                              ? 'rgba(var(--ion-color-danger-rgb, 235, 68, 90), 0.10)'
                              : Number(tempBranchId) === lid
                                ? 'rgba(var(--ion-color-primary-rgb, 0, 119, 182), 0.08)'
                                : undefined,
                          }}
                        >
                          <td>{b.Branch}</td>
                          <td>{String(b.BranchDept ?? "").trim() || "-"}</td>
                          <td onClick={(e) => e.stopPropagation()} style={{ padding: '2px 10px' }}>
                            {/* stopPropagation on the cell, not just the buttons:
                                the row click loads this branch into the edit form,
                                and reaching for Delete should not do that. */}
                            {confirming ? (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button
                                  className="stock-button"
                                  style={{ minHeight: '22px', height: '22px', padding: '0 10px', fontSize: '0.72rem', lineHeight: 1, boxShadow: 'none', background: 'var(--ion-color-danger, #eb445a)' }}
                                  disabled={deleting}
                                  onClick={() => deleteBranch(lid)}
                                >
                                  {deleting ? "Deleting..." : "Confirm"}
                                </button>
                                <button
                                  className="stock-button stock-button--secondary"
                                  style={{ minHeight: '22px', height: '22px', padding: '0 10px', fontSize: '0.72rem', lineHeight: 1, boxShadow: 'none' }}
                                  disabled={deleting}
                                  onClick={() => setBranchDeleteId(0)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                className="stock-button stock-button--secondary"
                                style={{ minHeight: '22px', height: '22px', padding: '0 10px', fontSize: '0.72rem', lineHeight: 1, boxShadow: 'none' }}
                                title="Delete this branch and dept row"
                                onClick={() => setBranchDeleteId(lid)}
                              >
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {branchList.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--stock-muted)' }}>
                      No branches found.
                    </div>
                  )}
                </div>
                </>)}

                {/* ---------- On-duty movement check-in times ---------- */}
                <h3
                  className="stock-section-heading"
                  onClick={() => toggleBranchSection("movement")}
                  style={{
                    cursor: 'pointer', userSelect: 'none',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    margin: '28px 0 0 0',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block', fontSize: '0.7em', lineHeight: 1,
                      transition: 'transform 0.15s ease',
                      transform: movementOpen ? 'rotate(90deg)' : 'none',
                    }}
                  >
                    &#9654;
                  </span>
                  On-duty Branch Movement Check-in Time &amp; Distance
                  <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 400, color: 'var(--stock-muted)' }}>
                    {movementPairs.length} combination{movementPairs.length === 1 ? '' : 's'}, {movementTimeCount} time{movementTimeCount === 1 ? '' : 's'}, {movementDistCount} distance{movementDistCount === 1 ? '' : 's'}
                    {movementDirtyKeys.length > 0 && ', unsaved edits'}
                  </span>
                </h3>

                {movementOpen && (<>
                <p style={{ margin: '12px 0 14px 0', fontSize: '0.8rem', color: 'var(--stock-muted)' }}>
                  Every combination of the branch/dept rows above is listed here, in both
                  directions. Leave a movement blank and the person keeps the actual in-time
                  from their own profile - that is the normal case, and nothing is stored for
                  it. Fill a time in only where moving there should change when they are
                  expected, e.g. Eluru / DBS to Vizag / AU at 11:00. Distance is the length
                  of that trip in km, and is independent of the time: fill in either, both,
                  or neither. A movement is stored as soon as one of the two is set, and
                  goes away again only when both are cleared. A distance typed here also
                  fills in the return trip, since it is the same road either way - give
                  the return leg its own figure and it stops following. Mirror distances
                  does the same for everything entered before.
                </p>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
                  <input
                    type="text"
                    className="stock-input"
                    style={{ flex: '1 1 190px' }}
                    value={movementFromSearch}
                    placeholder="Moving from - e.g. Vizag SDE"
                    onChange={(e) => setMovementFromSearch(e.target.value)}
                  />
                  <span style={{ color: 'var(--stock-muted)', fontSize: '0.9rem' }}>&#8594;</span>
                  <input
                    type="text"
                    className="stock-input"
                    style={{ flex: '1 1 190px' }}
                    value={movementToSearch}
                    placeholder="Moving to - e.g. Vizag AU"
                    onChange={(e) => setMovementToSearch(e.target.value)}
                  />
                  {(movementFromSearch || movementToSearch) && (
                    <button
                      className="stock-button stock-button--secondary"
                      style={{ padding: '2px 10px', fontSize: '0.75rem' }}
                      onClick={() => { setMovementFromSearch(""); setMovementToSearch(""); }}
                    >
                      Reset
                    </button>
                  )}
                  <span style={{ fontSize: '0.78rem', color: 'var(--stock-muted)' }}>
                    {movementVisible.length} of {movementPairs.length} shown, {movementTimeCount} time{movementTimeCount === 1 ? '' : 's'} and {movementDistCount} distance{movementDistCount === 1 ? '' : 's'} set
                  </span>
                  <button
                    className="stock-button stock-button--secondary"
                    style={{ padding: '2px 10px', fontSize: '0.75rem' }}
                    onClick={() => {
                      const all: Record<string, boolean> = {};
                      movementGroups.forEach((g: any) => { all[g.key] = true; });
                      setMovementGroupOpen(all);
                    }}
                  >
                    Expand all
                  </button>
                  <button
                    className="stock-button stock-button--secondary"
                    style={{ padding: '2px 10px', fontSize: '0.75rem' }}
                    onClick={() => {
                      // Every group written as false explicitly, not reset to {} -
                      // an empty map would hand groups back to the filter default,
                      // which is open, and the click would appear to do nothing.
                      const all: Record<string, boolean> = {};
                      movementGroups.forEach((g: any) => { all[g.key] = false; });
                      setMovementGroupOpen(all);
                    }}
                  >
                    Collapse all
                  </button>
                  <button
                    className="stock-button stock-button--secondary"
                    style={{ padding: '2px 10px', fontSize: '0.75rem' }}
                    title="Copy every distance onto its return trip, where the return has none. Distances already filled in are left alone."
                    onClick={mirrorDistances}
                  >
                    Mirror distances
                  </button>
                  <button
                    className="stock-button"
                    onClick={saveBranchMovement}
                    disabled={movementSaving || movementDirtyKeys.length === 0}
                  >
                    {movementSaving
                      ? "Saving..."
                      : movementDirtyKeys.length
                        ? `Save ${movementDirtyKeys.length} change${movementDirtyKeys.length === 1 ? "" : "s"}`
                        : "Save"}
                  </button>
                  {movementDirtyKeys.length > 0 && !movementSaving && (
                    <button
                      className="stock-button stock-button--secondary"
                      onClick={() => {
                        setMovementDraft({});
                        setMovementDistDraft({});
                        setMovementDistTouched({});
                      }}
                    >
                      Discard
                    </button>
                  )}
                </div>

                <div className="stock-table-wrapper" style={{ maxHeight: '460px' }}>
                  <table className="stock-table">
                    <thead>
                      <tr>
                        <th
                          onClick={() => sortMovementBy("from")}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          title="Sort by Moving From"
                        >
                          Moving From
                          <span style={{ marginLeft: '6px', opacity: movementSortCol === "from" ? 1 : 0.28 }}>
                            {movementSortCol === "from" && movementSortDir === "desc" ? "\u25BC" : "\u25B2"}
                          </span>
                        </th>
                        <th
                          onClick={() => sortMovementBy("to")}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          title="Sort by Moving To"
                        >
                          Moving To
                          <span style={{ marginLeft: '6px', opacity: movementSortCol === "to" ? 1 : 0.28 }}>
                            {movementSortCol === "to" && movementSortDir === "desc" ? "\u25BC" : "\u25B2"}
                          </span>
                        </th>
                        <th style={{ width: '230px' }}>Check-in Time</th>
                        <th style={{ width: '140px' }}>Distance (km)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movementGroups.map((g: any) => {
                        const open = isMovementGroupOpen(g.key);
                        // Counted off the draft as well as the saved map, so the
                        // header agrees with the inputs the moment one is typed in,
                        // and counted per column so a group full of distances still
                        // says how many of its check-in times are set.
                        const effTime = (r: any) =>
                          Object.prototype.hasOwnProperty.call(movementDraft, r.k)
                            ? movementDraft[r.k]
                            : (movementRules[r.k] ?? "");
                        const effDist = (r: any) =>
                          Object.prototype.hasOwnProperty.call(movementDistDraft, r.k)
                            ? movementDistDraft[r.k]
                            : (movementDistRules[r.k] ?? "");
                        const timeCount = g.rows.filter((r: any) => String(effTime(r)).trim() !== "").length;
                        // Zero does not add to this, same as the totals above.
                        const distCount = g.rows.filter((r: any) => distIsSet(effDist(r))).length;
                        const groupDirty = g.rows.some((r: any) =>
                          Object.prototype.hasOwnProperty.call(movementDraft, r.k)
                          || Object.prototype.hasOwnProperty.call(movementDistDraft, r.k));

                        return (
                          <React.Fragment key={g.key}>
                            <tr
                              onClick={() => toggleMovementGroup(g.key)}
                              style={{
                                cursor: 'pointer',
                                userSelect: 'none',
                                background: groupDirty
                                  ? 'rgba(255, 196, 0, 0.18)'
                                  : 'rgba(var(--ion-color-primary-rgb, 0, 119, 182), 0.07)',
                              }}
                            >
                              <td colSpan={4} style={{ fontWeight: 600, padding: '4px 10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span
                                    style={{
                                      display: 'inline-block', fontSize: '0.7em', lineHeight: 1,
                                      transition: 'transform 0.15s ease',
                                      transform: open ? 'rotate(90deg)' : 'none',
                                    }}
                                  >
                                    &#9654;
                                  </span>
                                  {g.label}
                                  <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: '0.75rem', color: 'var(--stock-muted)' }}>
                                    {g.rows.length} destination{g.rows.length === 1 ? '' : 's'}, {timeCount} time{timeCount === 1 ? '' : 's'}, {distCount} distance{distCount === 1 ? '' : 's'}
                                    {groupDirty && ', unsaved'}
                                  </span>
                                </div>
                              </td>
                            </tr>

                            {open && g.rows.map((p: any) => {
                        const saved = movementRules[p.k] ?? "";
                        const timeDirty = Object.prototype.hasOwnProperty.call(movementDraft, p.k);
                        const val = timeDirty ? movementDraft[p.k] : saved;
                        // Typing a value and then putting the original back must stop
                        // counting as a change, or Save would post rows that say nothing.
                        const setVal = (v: string) =>
                          setMovementDraft((prev) => {
                            const next = { ...prev };
                            if (v === saved) delete next[p.k];
                            else next[p.k] = v;
                            return next;
                          });

                        const savedDist = movementDistRules[p.k] ?? "";
                        const distDirty = Object.prototype.hasOwnProperty.call(movementDistDraft, p.k);
                        const dval = distDirty ? movementDistDraft[p.k] : savedDist;
                        // The same road measured the other way. Filled alongside this
                        // one so a distance only has to be typed once per road, not
                        // once per direction.
                        const revK = reverseKey(p);
                        const savedRev = movementDistRules[revK] ?? "";
                        // The return leg follows this box on two conditions, and both
                        // have to hold.
                        //
                        // It must not have been typed into by hand this session. That
                        // is the escape hatch: give the way back its own figure and it
                        // stops tracking, permanently, rather than being dragged along
                        // the next time this side is touched.
                        //
                        // And it must still agree with what this box held a keystroke
                        // ago - blank counts as agreeing. Typing digit by digit agrees
                        // at every step, so "380" mirrors as 3, 38, 380 without the
                        // link ever breaking, and clearing this box clears the mirror
                        // with it. A return already carrying a different SAVED figure
                        // fails this test and is left alone.
                        const revFollows = !movementDistTouched[revK];
                        const setDVal = (v: string) => {
                          setMovementDistTouched((t) => (t[p.k] ? t : { ...t, [p.k]: true }));
                          setMovementDistDraft((prev) => {
                            const next = { ...prev };
                            const clean = cleanDistance(v);
                            // Compared after cleaning, so retyping "12.5" over "12.5"
                            // does not register as an edit on the way through "12.".
                            if (clean === savedDist) delete next[p.k];
                            else next[p.k] = clean;

                            const curRev = Object.prototype.hasOwnProperty.call(prev, revK)
                              ? prev[revK]
                              : savedRev;
                            if (revFollows && (curRev === "" || curRev === dval)) {
                              if (clean === savedRev) delete next[revK];
                              else next[revK] = clean;
                            }
                            return next;
                          });
                        };

                        // One row, one highlight. The tint says "this movement has
                        // something unsaved on it", not which of the two boxes.
                        const dirty = timeDirty || distDirty;
                        return (
                          <tr key={p.k} style={{ background: dirty ? 'rgba(255, 196, 0, 0.14)' : undefined }}>
                            {/* The From name lives in the group header now; this cell
                                just carries the indent so the nesting is readable. */}
                            <td style={{ textAlign: 'right', color: 'var(--stock-muted)', width: '40px', padding: '2px 10px' }}>&#8594;</td>
                            <td style={{ padding: '2px 10px' }}>{p.to.label}</td>
                            <td style={{ padding: '2px 10px' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                  type="time"
                                  className="stock-input"
                                  style={{ maxWidth: '112px', minHeight: '26px', height: '26px', padding: '0 8px', fontSize: '12px' }}
                                  value={val}
                                  onChange={(e) => setVal(e.target.value)}
                                />
                                {val ? (
                                  <button
                                    className="stock-button stock-button--secondary"
                                    style={{ minHeight: '22px', height: '22px', padding: '0 10px', fontSize: '0.72rem', lineHeight: 1, boxShadow: 'none' }}
                                    title="Back to the actual in-time from the profile"
                                    onClick={() => setVal("")}
                                  >
                                    Clear
                                  </button>
                                ) : (
                                  <small style={{ color: 'var(--stock-muted)', fontSize: '0.72rem' }}>
                                    actual in-time from profile
                                  </small>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '2px 10px' }}>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                {/* Text, not number. A number input hands back the
                                    empty string for a half-typed "12.", which makes
                                    the decimal point impossible to get past; the
                                    sanitiser above does the same job and lets the
                                    dot survive being typed. */}
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className="stock-input"
                                  placeholder="-"
                                  title="Road distance for this movement, in km"
                                  style={{ maxWidth: '76px', minHeight: '26px', height: '26px', padding: '0 8px', fontSize: '12px', textAlign: 'right' }}
                                  value={dval}
                                  onChange={(e) => setDVal(e.target.value)}
                                />
                                {dval ? (
                                  <button
                                    className="stock-button stock-button--secondary"
                                    style={{ minHeight: '22px', height: '22px', padding: '0 10px', fontSize: '0.72rem', lineHeight: 1, boxShadow: 'none' }}
                                    title="Clear the distance"
                                    onClick={() => setDVal("")}
                                  >
                                    Clear
                                  </button>
                                ) : (
                                  <small style={{ color: 'var(--stock-muted)', fontSize: '0.72rem' }}>
                                    not recorded
                                  </small>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                  {movementPairs.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--stock-muted)' }}>
                      Add at least two branch/dept rows above before movements can be mapped.
                    </div>
                  )}
                  {movementPairs.length > 0 && movementVisible.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--stock-muted)' }}>
                      No movement matches that filter.
                    </div>
                  )}
                </div>
                </>)}
              </div>
            )}

            {/* TAB CONTENT: Vehicles */}
            {activeTab === "vehicles" && (
              <div className="stock-panel">
                <h3 className="stock-section-heading" style={{ display: 'flex', alignItems: 'center' }}>
                  Vehicles
                  <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 400, color: 'var(--stock-muted)' }}>
                    {vehList.length} vehicle{vehList.length === 1 ? '' : 's'}
                  </span>
                </h3>

                <p style={{ margin: '12px 0 16px 0', fontSize: '0.8rem', color: 'var(--stock-muted)' }}>
                  Every vehicle available for duty. Owned By is either Office for a company
                  vehicle or the employee code of whoever owns it. Model and Per Km are
                  optional - a vehicle can be registered before anybody has settled on what
                  it is worth per kilometre.
                </p>

                <div className="stock-field" style={{ marginBottom: '16px' }}>
                  <label>{tempVehId ? "Edit Vehicle" : "New Vehicle"}</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Owner picker, shaped like the team dropdown on the On
                        Duty screen: a search box, then a row per person with
                        their initial, name and code. Styled inline rather than
                        through those class names, which live in that screen's
                        stylesheet and are not loaded here - using them would
                        have looked right only after visiting On Duty first. */}
                    <div style={{ position: 'relative', flex: '1 1 200px' }}>
                      <div
                        className="stock-input"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', minHeight: '38px' }}
                        onClick={() => { setVehOwnerOpen((o) => !o); setVehOwnerSearch(""); }}
                      >
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: vehOwnerLabel ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                          {vehOwnerLabel || "Owned by"}
                        </span>
                        <ChevronDown />
                      </div>

                      {vehOwnerOpen && (
                        <>
                          {/* Catches the click that closes it. Fixed and full
                              screen so anywhere counts, and behind the panel
                              so a click on a name still lands on the name. */}
                          <div
                            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                            onClick={() => setVehOwnerOpen(false)}
                          />
                          <div
                            style={{
                              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 41,
                              background: '#fff', border: '1px solid rgba(148, 163, 184, 0.35)',
                              borderRadius: '10px', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.18)',
                              maxHeight: '280px', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                            }}
                          >
                            <div style={{ padding: '8px', borderBottom: '1px solid rgba(148, 163, 184, 0.25)' }}>
                              <input
                                type="text"
                                className="stock-input"
                                autoFocus
                                placeholder="Search name or code..."
                                value={vehOwnerSearch}
                                onChange={(e) => setVehOwnerSearch(e.target.value)}
                                style={{ minHeight: '32px' }}
                              />
                            </div>
                            <div style={{ overflowY: 'auto' }}>
                              {vehOwnerOptions.map((o: any, i: number) => {
                                const selected = String(vehOwnedBy).trim() === String(o.EmpCode);
                                return (
                                  <div
                                    key={`${o.EmpCode}-${i}`}
                                    onClick={() => {
                                      const wasOffice =
                                        String(vehOwnedBy ?? "").trim().toLowerCase() ===
                                        VEH_OFFICE.toLowerCase();
                                      setVehOwnedBy(String(o.EmpCode));
                                      // The rate follows the owner. Coming off
                                      // Office empties the box rather than
                                      // leaving that 0 sitting there looking
                                      // like a rate somebody actually agreed.
                                      if (o.isOffice) setVehPerKm("0");
                                      else if (wasOffice) setVehPerKm("");
                                      setVehOwnerOpen(false);
                                      setVehOwnerSearch("");
                                    }}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: '10px',
                                      padding: '8px 10px', cursor: 'pointer',
                                      borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
                                      background: selected ? 'rgba(var(--ion-color-primary-rgb, 0, 119, 182), 0.10)' : undefined,
                                    }}
                                  >
                                    <div style={{
                                      width: '28px', height: '28px', borderRadius: '50%', flex: '0 0 28px',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: '0.72rem', fontWeight: 600, color: '#fff',
                                      background: o.isOffice ? '#0f766e' : 'var(--ion-color-primary, #0077b6)',
                                    }}>
                                      {o.isOffice ? "OF" : String(o.EmpName ?? "?").charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: '0.82rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {o.EmpName}
                                      </div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--stock-muted)' }}>
                                        {o.isOffice ? "Company vehicle" : `ID: ${o.EmpCode}`}
                                      </div>
                                    </div>
                                    {selected && <span style={{ color: 'var(--ion-color-primary, #0077b6)', fontSize: '0.9rem' }}>&#10003;</span>}
                                  </div>
                                );
                              })}
                              {/* Two different silences, said differently. An
                                  empty roll is a loading problem; no match is
                                  just a search that found nothing. */}
                              {vehOwnerOptions.length <= 1 && vehOwnerPeople.length === 0 && (
                                <div style={{ padding: '14px', textAlign: 'center', color: 'var(--stock-muted)', fontSize: '0.78rem' }}>
                                  Staff list did not load. Office is still selectable.
                                </div>
                              )}
                              {vehOwnerOptions.length === 0 && vehOwnerPeople.length > 0 && (
                                <div style={{ padding: '14px', textAlign: 'center', color: 'var(--stock-muted)', fontSize: '0.78rem' }}>
                                  Nobody matches that.
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <select
                      className="stock-input"
                      style={{ flex: '1 1 120px' }}
                      value={vehType}
                      onChange={(e) => setVehType(e.target.value)}
                    >
                      {VEH_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="stock-input"
                      style={{ flex: '1 1 110px' }}
                      value={vehNo}
                      placeholder="Vehicle no"
                      // Upper cased as it is typed rather than on save, so what
                      // the box shows is what gets stored - no quiet change
                      // between pressing Save and seeing the row appear.
                      onChange={(e) => setVehNo(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === "Enter") saveVehicle(); }}
                    />
                    <input
                      type="text"
                      className="stock-input"
                      style={{ flex: '1 1 140px' }}
                      value={vehModel}
                      placeholder="Model - e.g. Swift Dzire"
                      list="veh-model-suggestions"
                      onChange={(e) => setVehModel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveVehicle(); }}
                    />
                    {/* Models already typed on other vehicles, so the same one
                        is not re-spelled three different ways. */}
                    <datalist id="veh-model-suggestions">
                      {Array.from(
                        new Set(
                          vehList
                            .map((v) => String(v.VehModel ?? "").trim())
                            .filter((v) => v !== "")
                        )
                      ).map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="stock-input"
                      style={{
                        flex: '0 1 100px',
                        background: vehIsOffice ? 'rgba(148, 163, 184, 0.18)' : undefined,
                        cursor: vehIsOffice ? 'not-allowed' : undefined,
                      }}
                      value={vehIsOffice ? "0" : vehPerKm}
                      disabled={vehIsOffice}
                      title={
                        vehIsOffice
                          ? "Office vehicles are fixed at 0 per km"
                          : "Per km rate - required for a personal vehicle"
                      }
                      placeholder={vehIsOffice ? "0" : "Per km *"}
                      onChange={(e) => {
                        // Digits and at most one dot. Filtered on the way in
                        // rather than validated on the way out, so there is
                        // never a moment where the box holds something the
                        // save would have to reject.
                        const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                        const firstDot = cleaned.indexOf(".");
                        setVehPerKm(
                          firstDot === -1
                            ? cleaned
                            : cleaned.slice(0, firstDot + 1) +
                              cleaned.slice(firstDot + 1).replace(/\./g, "")
                        );
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") saveVehicle(); }}
                    />
                    <button className="stock-button" onClick={saveVehicle} disabled={vehSaving}>
                      {vehSaving ? "Saving..." : tempVehId ? "Update" : "Save"}
                    </button>
                    {tempVehId > 0 && (
                      <button
                        className="stock-button stock-button--secondary"
                        onClick={clearVehicleForm}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                <div className="stock-table-wrapper" style={{ maxHeight: '400px' }}>
                  <table className="stock-table">
                    <thead>
                      <tr>
                        <th>Owned By</th>
                        <th>Type</th>
                        <th>Vehicle No</th>
                        <th>Model</th>
                        <th style={{ textAlign: 'right' }}>Per Km</th>
                        <th style={{ width: '150px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehList.map((v) => {
                        const id = Number(v.VehId);
                        const confirming = vehDeleteId === id;
                        const deleting = vehDeletingId === id;
                        const owner = String(v.OwnedBy ?? "").trim();
                        // A code on its own says very little, so the name goes
                        // beside it when the roll knows who that is.
                        const ownerName =
                          owner && owner.toLowerCase() !== VEH_OFFICE.toLowerCase()
                            ? vehOwnerPeople.find((x) => String(x.EmpCode) === owner)?.EmpName
                            : "";
                        const rate = String(v.PerKm ?? "").trim();
                        return (
                        <tr
                          key={v.VehId}
                          onClick={() => {
                            setVehOwnedBy(owner);
                            setVehType(String(v.VehType ?? VEH_TYPES[1]));
                            setVehNo(String(v.VehNo ?? "").toUpperCase());
                            setVehModel(String(v.VehModel ?? ""));
                            setVehPerKm(rate);
                            setTempVehId(id);
                          }}
                          style={{
                            cursor: 'pointer',
                            background: confirming
                              ? 'rgba(var(--ion-color-danger-rgb, 235, 68, 90), 0.10)'
                              : Number(tempVehId) === id
                                ? 'rgba(var(--ion-color-primary-rgb, 0, 119, 182), 0.08)'
                                : undefined,
                          }}
                        >
                          <td>
                            {owner || "-"}
                            {ownerName && (
                              <small style={{ display: 'block', color: 'var(--stock-muted)', fontSize: '0.72rem' }}>
                                {ownerName}
                              </small>
                            )}
                          </td>
                          <td>{String(v.VehType ?? "").trim() || "-"}</td>
                          <td>{String(v.VehNo ?? "").trim() || "-"}</td>
                          <td>{String(v.VehModel ?? "").trim() || "-"}</td>
                          <td style={{ textAlign: 'right' }}>
                            {/* Blank stays blank. A rate nobody has set is not
                                a rate of zero, and printing 0.00 would say it
                                was. */}
                            {rate !== "" ? rate : <span style={{ color: 'var(--stock-muted)' }}>-</span>}
                          </td>
                          <td onClick={(e) => e.stopPropagation()} style={{ padding: '2px 10px' }}>
                            {confirming ? (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button
                                  className="stock-button"
                                  style={{ minHeight: '22px', height: '22px', padding: '0 10px', fontSize: '0.72rem', lineHeight: 1, boxShadow: 'none', background: 'var(--ion-color-danger, #eb445a)' }}
                                  disabled={deleting}
                                  onClick={() => deleteVehicle(id)}
                                >
                                  {deleting ? "Deleting..." : "Confirm"}
                                </button>
                                <button
                                  className="stock-button stock-button--secondary"
                                  style={{ minHeight: '22px', height: '22px', padding: '0 10px', fontSize: '0.72rem', lineHeight: 1, boxShadow: 'none' }}
                                  disabled={deleting}
                                  onClick={() => setVehDeleteId(0)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                className="stock-button stock-button--secondary"
                                style={{ minHeight: '22px', height: '22px', padding: '0 10px', fontSize: '0.72rem', lineHeight: 1, boxShadow: 'none' }}
                                title="Remove this vehicle from the list"
                                onClick={() => setVehDeleteId(id)}
                              >
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {vehList.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--stock-muted)' }}>
                      No vehicles yet. Add the first one above.
                    </div>
                  )}
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
