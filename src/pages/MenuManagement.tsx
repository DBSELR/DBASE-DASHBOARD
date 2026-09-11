import React, { useEffect, useMemo, useState } from "react";
import {
  IonPage,
  IonContent,
  IonToast,
  IonIcon,
  IonSpinner
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import {
  ShieldAlert,
  Search,
  CheckSquare,
  Square,
  Copy,
  Save,
  RotateCcw,
  Plus,
  Edit3,
  Eye,
  EyeOff,
  Users,
  Menu as MenuIcon,
  LayoutGrid,
  Check,
  X,
  ExternalLink,
  Layers,
  Sparkles
} from "lucide-react";
import {
  homeOutline,
  alarmOutline,
  walletOutline,
  documentAttachOutline,
  receiptOutline,
  settingsOutline,
  peopleOutline,
  arrowRedoOutline,
  subwayOutline,
  libraryOutline,
  ticketOutline,
  documentsOutline,
  personOutline,
  fileTrayStackedOutline,
  gridOutline,
  cashOutline,
  briefcaseOutline,
  callOutline,
  barbellOutline,
  chatboxOutline,
  scanOutline
} from "ionicons/icons";
import { API_BASE } from "../config";
import "./MenuManagement.css";

// Only employee codes 1501 and 1601 are permitted
const ALLOWED_EMP_CODES = ["1501", "1601"];

export interface MenuItem {
  id: number;
  menuText: string;
  mIcon: string;
  isactive: boolean;
  navigateUrl: string;
  parentId: string;
  mPriority: number;
  remarks: string;
  menuType: string;
}

export interface EmployeeItem {
  employeeId: number;
  empCode: string;
  empName: string;
  designation: string;
  department: string;
  userType: string;
  isActive: string;
  fPermissions: string;
  permissionIds: number[];
  permissionCount: number;
}

// Map database MIcon string to Ionicons
const getMenuIonIcon = (iconName: string) => {
  const map: { [key: string]: string } = {
    "home-outline": homeOutline,
    "alarm-outline": alarmOutline,
    "wallet-outline": walletOutline,
    "document-attach-outline": documentAttachOutline,
    "receipt-outline": receiptOutline,
    "settings": settingsOutline,
    "settings-outline": settingsOutline,
    "people": peopleOutline,
    "people-outline": peopleOutline,
    "arrow-redo-outline": arrowRedoOutline,
    "subway-outline": subwayOutline,
    "library-outline": libraryOutline,
    "ticket-outline": ticketOutline,
    "documents-outline": documentsOutline,
    "file-tray-stacked-outline": fileTrayStackedOutline,
    "grid-outline": gridOutline,
    "cash-outline": cashOutline,
    "briefcase-outline": briefcaseOutline,
    "call-outline": callOutline,
    "barbell-outline": barbellOutline,
    "sms": chatboxOutline,
    "scanOutline": scanOutline,
  };
  return map[iconName] || documentsOutline;
};

// Logical category assignment for structured UI grouping
const categorizeMenu = (menu: MenuItem): string => {
  const url = (menu.navigateUrl || "").toLowerCase();
  const text = (menu.menuText || "").toLowerCase();

  if (url.includes("home") || url.includes("profile") || url.includes("timing") || url.includes("checkin") || text.includes("settings")) {
    return "Core & Navigation";
  }
  if (url.includes("leave") || url.includes("workreport") || url.includes("duty") || url.includes("security-attendance") || text.includes("holiday")) {
    return "Attendance & Operations";
  }
  if (url.includes("transaction") || url.includes("money") || url.includes("voucher") || url.includes("salary") || url.includes("invoice") || url.includes("advance") || url.includes("account-book")) {
    return "Finance & Payroll";
  }
  if (url.includes("ticket") || url.includes("feedback") || url.includes("request")) {
    return "Tickets & Requests";
  }
  if (url.includes("client") || url.includes("excel") || url.includes("stock") || url.includes("equipment")) {
    return "Clients & Resources";
  }
  if (url.includes("meeting") || url.includes("penalty")) {
    return "Meetings & Compliance";
  }
  return "Administration & Management";
};

const getCategoryGradient = (cat: string) => {
  switch (cat) {
    case "Core & Navigation":
      return "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)";
    case "Attendance & Operations":
      return "linear-gradient(135deg, #10b981 0%, #047857 100%)";
    case "Finance & Payroll":
      return "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)";
    case "Tickets & Requests":
      return "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)";
    case "Clients & Resources":
      return "linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)";
    case "Meetings & Compliance":
      return "linear-gradient(135deg, #ec4899 0%, #be185d 100%)";
    default:
      return "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)";
  }
};

const MenuManagement: React.FC = () => {
  const history = useHistory();

  // 1. Current user validation
  const [currentUser] = useState<any>(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const callerEmpCode = useMemo(() => {
    if (!currentUser) return "";
    return String(
      currentUser.EmpCode ||
      currentUser.empCode ||
      currentUser.Empcode ||
      currentUser.emp_code ||
      currentUser.userName ||
      currentUser.username ||
      ""
    ).trim();
  }, [currentUser]);

  const isAuthorized = useMemo(() => {
    return ALLOWED_EMP_CODES.includes(callerEmpCode);
  }, [callerEmpCode]);

  // Active view tab: 'permissions' | 'menus' | 'bulk'
  const [activeTab, setActiveTab] = useState<"permissions" | "menus" | "bulk">("permissions");

  // Data states
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null);

  // Employee Permissions Workspace state
  const [selectedEmpCode, setSelectedEmpCode] = useState<string>("");
  const [selectedMenuIds, setSelectedMenuIds] = useState<Set<number>>(new Set());
  const [initialMenuIds, setInitialMenuIds] = useState<Set<number>>(new Set());
  const [empSearch, setEmpSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [showSimulator, setShowSimulator] = useState(false);

  // Menu search & filter for right workspace
  const [menuSearchTerm, setMenuSearchTerm] = useState("");
  const [menuFilterStatus, setMenuFilterStatus] = useState<"all" | "granted" | "ungranted" | "active">("all");

  // Modals
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySourceEmpCode, setCopySourceEmpCode] = useState("");
  const [showMenuEditModal, setShowMenuEditModal] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Partial<MenuItem>>({
    id: 0,
    menuText: "",
    mIcon: "documents-outline",
    isactive: true,
    navigateUrl: "",
    parentId: "0",
    mPriority: 10,
    remarks: "",
    menuType: "-"
  });

  // Bulk state
  const [bulkSelectedEmpCodes, setBulkSelectedEmpCodes] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState<"replace" | "append" | "remove">("replace");
  const [bulkSelectedMenuIds, setBulkSelectedMenuIds] = useState<Set<number>>(new Set());

  // Notify toast helper
  const notify = (msg: string, color: string = "success") => setToast({ msg, color });

  // Auth headers
  const getHeaders = () => {
    const raw = localStorage.getItem("token") || "";
    const token = raw.replace(/^"|"$/g, "");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Fetch Menus and Employees
  const loadData = async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      const cleanBase = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;

      const [menusRes, empRes] = await Promise.all([
        axios.get(`${cleanBase}MenuManagement/GetMenus?callerEmpCode=${callerEmpCode}`, { headers: getHeaders() }),
        axios.get(`${cleanBase}MenuManagement/GetEmployees?callerEmpCode=${callerEmpCode}`, { headers: getHeaders() })
      ]);

      if (menusRes.data?.success) {
        setMenus(menusRes.data.menus || []);
      }
      if (empRes.data?.success) {
        const empList: EmployeeItem[] = empRes.data.employees || [];
        setEmployees(empList);

        // If no employee selected yet, select the first one or caller
        if (!selectedEmpCode && empList.length > 0) {
          const defaultEmp = empList.find(e => e.empCode === callerEmpCode) || empList[0];
          selectEmployee(defaultEmp);
        }
      }
    } catch (err: any) {
      console.error("Failed to load menu management data:", err);
      notify(err.response?.data?.message || "Failed to load menus and employees.", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      loadData();
    }
  }, [isAuthorized, callerEmpCode]);

  // Select an employee to edit their permissions
  const selectEmployee = (emp: EmployeeItem) => {
    setSelectedEmpCode(emp.empCode);
    const idSet = new Set(emp.permissionIds || []);
    setSelectedMenuIds(idSet);
    setInitialMenuIds(new Set(idSet));
  };

  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.empCode === selectedEmpCode) || null;
  }, [employees, selectedEmpCode]);

  // Check if permissions have changed
  const isDirty = useMemo(() => {
    if (selectedMenuIds.size !== initialMenuIds.size) return true;
    for (const id of selectedMenuIds) {
      if (!initialMenuIds.has(id)) return true;
    }
    return false;
  }, [selectedMenuIds, initialMenuIds]);

  // Toggle single menu ID
  const toggleMenuPermission = (menuId: number) => {
    setSelectedMenuIds(prev => {
      const next = new Set(prev);
      if (next.has(menuId)) {
        next.delete(menuId);
      } else {
        next.add(menuId);
      }
      return next;
    });
  };

  // Toggle all menus in a category
  const toggleCategoryPermissions = (categoryMenus: MenuItem[]) => {
    const allChecked = categoryMenus.every(m => selectedMenuIds.has(m.id));
    setSelectedMenuIds(prev => {
      const next = new Set(prev);
      categoryMenus.forEach(m => {
        if (allChecked) {
          next.delete(m.id);
        } else {
          next.add(m.id);
        }
      });
      return next;
    });
  };

  // Save Employee Permissions
  const handleSavePermissions = async () => {
    if (!selectedEmpCode) return;
    setSaving(true);
    try {
      const cleanBase = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;
      const menuIdsArray = Array.from(selectedMenuIds).sort((a, b) => a - b);

      const payload = {
        callerEmpCode,
        empCode: selectedEmpCode,
        menuIds: menuIdsArray
      };

      const res = await axios.post(`${cleanBase}MenuManagement/SaveEmployeePermissions`, payload, {
        headers: getHeaders()
      });

      if (res.data?.success) {
        notify(`Permissions saved successfully for ${selectedEmployee?.empName} (${selectedEmpCode})!`, "success");
        setInitialMenuIds(new Set(selectedMenuIds));

        // Update local employee list item
        setEmployees(prev =>
          prev.map(emp => {
            if (emp.empCode === selectedEmpCode) {
              return {
                ...emp,
                permissionIds: menuIdsArray,
                permissionCount: menuIdsArray.length,
                fPermissions: res.data.fPermissions
              };
            }
            return emp;
          })
        );
      }
    } catch (err: any) {
      console.error("Save permissions error:", err);
      notify(err.response?.data?.message || "Failed to save permissions.", "danger");
    } finally {
      setSaving(false);
    }
  };

  // Copy Permissions Handler
  const handleCopyPermissions = () => {
    if (!copySourceEmpCode) {
      notify("Please select a source employee to copy from.", "warning");
      return;
    }
    const source = employees.find(e => e.empCode === copySourceEmpCode);
    if (!source) return;

    setSelectedMenuIds(new Set(source.permissionIds || []));
    setShowCopyModal(false);
    notify(`Loaded permissions template from ${source.empName}. Click Save to apply.`, "primary");
  };

  // Apply Role Preset Template
  const applyPresetTemplate = (preset: "admin" | "tl" | "employee" | "accounts") => {
    const activeMenuIds = menus.filter(m => m.isactive).map(m => m.id);
    let targetIds: number[] = [];

    switch (preset) {
      case "admin":
        targetIds = activeMenuIds;
        break;
      case "tl":
        targetIds = menus.filter(m => {
          const r = (m.remarks || "").toLowerCase();
          const t = m.menuText.toLowerCase();
          return m.isactive && (!r || r.includes("tl") || r.includes("admin") || t.includes("home") || t.includes("report") || t.includes("timing") || t.includes("task") || t.includes("meeting"));
        }).map(m => m.id);
        break;
      case "employee":
        targetIds = menus.filter(m => {
          const r = (m.remarks || "").toLowerCase();
          const t = m.menuText.toLowerCase();
          return m.isactive && (!r || r.includes("employee") || t.includes("home") || t.includes("timing") || t.includes("leave") || t.includes("work report") || t.includes("ticket") || t.includes("profile"));
        }).map(m => m.id);
        break;
      case "accounts":
        targetIds = menus.filter(m => {
          const r = (m.remarks || "").toLowerCase();
          const t = m.menuText.toLowerCase();
          return m.isactive && (r.includes("account") || t.includes("transaction") || t.includes("advance") || t.includes("salary") || t.includes("voucher") || t.includes("invoice") || t.includes("home"));
        }).map(m => m.id);
        break;
    }

    setSelectedMenuIds(new Set(targetIds));
    notify(`Applied ${preset.toUpperCase()} preset. Click Save to persist changes.`, "primary");
  };

  // Toggle Menu Isactive
  const handleToggleMenuStatus = async (menuId: number, currentStatus: boolean) => {
    try {
      const cleanBase = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;
      const res = await axios.post(
        `${cleanBase}MenuManagement/ToggleMenuStatus`,
        {
          callerEmpCode,
          menuId,
          isActive: !currentStatus
        },
        { headers: getHeaders() }
      );

      if (res.data?.success) {
        setMenus(prev =>
          prev.map(m => (m.id === menuId ? { ...m, isactive: !currentStatus } : m))
        );
        notify("Menu active status updated.", "success");
      }
    } catch (err: any) {
      notify(err.response?.data?.message || "Failed to update menu status.", "danger");
    }
  };

  // Save Menu (Create or Update)
  const handleSaveMenu = async () => {
    if (!editingMenu.menuText?.trim()) {
      notify("Menu Title is required.", "warning");
      return;
    }

    setSaving(true);
    try {
      const cleanBase = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;
      const payload = {
        callerEmpCode,
        menu: {
          id: editingMenu.id || 0,
          menuText: editingMenu.menuText.trim(),
          mIcon: editingMenu.mIcon?.trim() || "documents-outline",
          isactive: editingMenu.isactive !== false,
          navigateUrl: editingMenu.navigateUrl?.trim() || "",
          parentId: String(editingMenu.parentId || "0").trim(),
          mPriority: Number(editingMenu.mPriority || 10),
          remarks: editingMenu.remarks?.trim() || "",
          menuType: editingMenu.menuType?.trim() || "-"
        }
      };

      const res = await axios.post(`${cleanBase}MenuManagement/SaveMenu`, payload, {
        headers: getHeaders()
      });

      if (res.data?.success) {
        notify(res.data.message || "Menu saved successfully!", "success");
        setShowMenuEditModal(false);
        loadData();
      }
    } catch (err: any) {
      notify(err.response?.data?.message || "Failed to save menu.", "danger");
    } finally {
      setSaving(false);
    }
  };

  // Filtered employees for left pane
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch =
        emp.empName.toLowerCase().includes(empSearch.toLowerCase()) ||
        emp.empCode.toLowerCase().includes(empSearch.toLowerCase()) ||
        emp.designation.toLowerCase().includes(empSearch.toLowerCase()) ||
        emp.department.toLowerCase().includes(empSearch.toLowerCase());

      if (!matchesSearch) return false;

      if (roleFilter === "All") return true;
      if (roleFilter === "Admin") return emp.userType?.toLowerCase().includes("admin") || ALLOWED_EMP_CODES.includes(emp.empCode);
      if (roleFilter === "TL") return emp.userType?.toLowerCase().includes("leader") || emp.designation?.toLowerCase().includes("leader");
      if (roleFilter === "Employee") return !emp.userType?.toLowerCase().includes("admin") && !emp.userType?.toLowerCase().includes("leader");
      return true;
    });
  }, [employees, empSearch, roleFilter]);

  // Grouped menus by category for Tab 1 with real-time search & filter
  const categorizedMenus = useMemo(() => {
    const groups: { [key: string]: MenuItem[] } = {};
    const query = menuSearchTerm.toLowerCase().trim();

    menus.forEach(menu => {
      // Search filter across text, URL, remarks, or ID
      const matchesSearch =
        !query ||
        menu.menuText.toLowerCase().includes(query) ||
        (menu.navigateUrl && menu.navigateUrl.toLowerCase().includes(query)) ||
        (menu.remarks && menu.remarks.toLowerCase().includes(query)) ||
        String(menu.id).includes(query);

      if (!matchesSearch) return;

      // Status filter
      if (menuFilterStatus === "granted" && !selectedMenuIds.has(menu.id)) return;
      if (menuFilterStatus === "ungranted" && selectedMenuIds.has(menu.id)) return;
      if (menuFilterStatus === "active" && !menu.isactive) return;

      const cat = categorizeMenu(menu);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(menu);
    });
    return groups;
  }, [menus, menuSearchTerm, menuFilterStatus, selectedMenuIds]);

  const totalFilteredMenus = useMemo(() => {
    return Object.values(categorizedMenus).reduce((acc, list) => acc + list.length, 0);
  }, [categorizedMenus]);

  // Bulk update handler
  const handleBulkUpdate = async () => {
    if (bulkSelectedEmpCodes.size === 0) {
      notify("Please select at least one employee for bulk update.", "warning");
      return;
    }
    if (bulkSelectedMenuIds.size === 0 && bulkMode !== "replace") {
      notify("Please select at least one menu to update.", "warning");
      return;
    }

    setSaving(true);
    try {
      const cleanBase = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;
      const payload = {
        callerEmpCode,
        empCodes: Array.from(bulkSelectedEmpCodes),
        menuIds: Array.from(bulkSelectedMenuIds),
        mode: bulkMode
      };

      const res = await axios.post(`${cleanBase}MenuManagement/BulkUpdatePermissions`, payload, {
        headers: getHeaders()
      });

      if (res.data?.success) {
        notify(res.data.message || "Bulk permissions updated!", "success");
        loadData();
      }
    } catch (err: any) {
      notify(err.response?.data?.message || "Bulk update failed.", "danger");
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------------------------------
  // Render: Unauthorized View
  // --------------------------------------------------------------------------
  if (!isAuthorized) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <div className="access-denied-container">
            <div className="access-denied-icon-box">
              <ShieldAlert size={38} />
            </div>
            <h2 className="access-denied-title">Restricted Administrative Access</h2>
            <p className="access-denied-desc">
              Menu Management and Role Permissions are strictly restricted to authorized administrators (EmpCodes: <strong>1501, 1601</strong>).
              Your current logged-in identity ({callerEmpCode || "Unknown"}) does not have clearance to view or modify menu permissions.
            </p>
            <button className="action-btn primary" onClick={() => history.push("/home")}>
              Return to Dashboard
            </button>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent>
        <div className="menu-mgmt-container">
          {/* Header */}
          <div className="menu-mgmt-header">
            <div className="menu-mgmt-title-group">
              <div className="menu-mgmt-title-icon">
                <LayoutGrid size={24} />
              </div>
              <div>
                <h1 className="menu-mgmt-title">Menu & Permissions Manager</h1>
                <p className="menu-mgmt-subtitle">
                  Configure navigation hierarchy and individual sidebar menu access
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="menu-mgmt-tab-nav">
              <button
                className={`menu-mgmt-tab-btn ${activeTab === "permissions" ? "active" : ""}`}
                onClick={() => setActiveTab("permissions")}
              >
                <Users size={16} /> Employee Permissions
              </button>
              <button
                className={`menu-mgmt-tab-btn ${activeTab === "menus" ? "active" : ""}`}
                onClick={() => setActiveTab("menus")}
              >
                <MenuIcon size={16} /> Menu Master ({menus.length})
              </button>
              <button
                className={`menu-mgmt-tab-btn ${activeTab === "bulk" ? "active" : ""}`}
                onClick={() => setActiveTab("bulk")}
              >
                <Layers size={16} /> Bulk Assignment
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "350px" }}>
              <IonSpinner name="crescent" color="primary" />
            </div>
          ) : (
            <>
              {/* ========================================================================= */}
              {/* TAB 1: EMPLOYEE PERMISSIONS */}
              {/* ========================================================================= */}
              {activeTab === "permissions" && (
                <div className="menu-mgmt-layout">
                  {/* Left Pane: Employee Directory */}
                  <div className="emp-directory-card">
                    <div className="emp-search-section">
                      <div className="emp-search-input-wrapper">
                        <Search size={16} color="#64748b" />
                        <input
                          type="text"
                          className="emp-search-input"
                          placeholder="Search name, code, dept..."
                          value={empSearch}
                          onChange={e => setEmpSearch(e.target.value)}
                        />
                        {empSearch && (
                          <X size={14} color="#94a3b8" style={{ cursor: "pointer" }} onClick={() => setEmpSearch("")} />
                        )}
                      </div>

                      {/* Filter Pills */}
                      <div className="emp-role-pills">
                        {["All", "Admin", "TL", "Employee"].map(role => (
                          <button
                            key={role}
                            className={`emp-role-pill ${roleFilter === role ? "active" : ""}`}
                            onClick={() => setRoleFilter(role)}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Employee List */}
                    <div className="emp-list-scroll">
                      {filteredEmployees.map(emp => {
                        const isSelected = emp.empCode === selectedEmpCode;
                        const isAdmin = emp.userType?.toLowerCase().includes("admin") || ALLOWED_EMP_CODES.includes(emp.empCode);
                        return (
                          <div
                            key={emp.empCode}
                            className={`emp-item ${isSelected ? "selected" : ""}`}
                            onClick={() => selectEmployee(emp)}
                          >
                            <div className="emp-item-left">
                              <div className={`emp-avatar ${isAdmin ? "admin" : ""}`}>
                                {emp.empName.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="emp-details">
                                <p className="emp-name">{emp.empName}</p>
                                <p className="emp-subtext">{emp.empCode} • {emp.designation || emp.department || "Staff"}</p>
                              </div>
                            </div>
                            <span className="emp-badge-count">
                              {emp.permissionCount}
                            </span>
                          </div>
                        );
                      })}
                      {filteredEmployees.length === 0 && (
                        <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.85rem", padding: "20px" }}>
                          No employees found.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Pane: Permission Workspace */}
                  <div className="permission-workspace">
                    {selectedEmployee ? (
                      <>
                        {/* Active Employee Banner */}
                        <div className="emp-active-banner">
                          <div className="emp-banner-info">
                            <div className="emp-banner-avatar">
                              {selectedEmployee.empName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h2 className="emp-banner-name">{selectedEmployee.empName}</h2>
                              <div className="emp-banner-meta">
                                <span className="meta-chip">EmpCode: {selectedEmployee.empCode}</span>
                                <span className="meta-chip">{selectedEmployee.designation || "Employee"}</span>
                                <span className="meta-chip">{selectedEmployee.department || "General"}</span>
                                <span className="meta-chip">Role: {selectedEmployee.userType || "Standard"}</span>
                              </div>
                            </div>
                          </div>

                          <div className="emp-banner-stats">
                            <div className="stat-box">
                              <div className="stat-value">{selectedMenuIds.size} / {menus.filter(m => m.isactive).length}</div>
                              <div className="stat-label">Active Menus Granted</div>
                            </div>
                          </div>
                        </div>

                        {/* 🔎 Search Bar on Top of Action Toolbar */}
                        <div className="menu-search-toolbar-card">
                          <div className="menu-search-input-wrapper">
                            <Search size={18} className="menu-search-icon" />
                            <input
                              type="text"
                              className="menu-search-input-field"
                              placeholder="Search menus by name, route URL, or ID (e.g. Invoices, Tickets, /salaries, Timings)..."
                              value={menuSearchTerm}
                              onChange={e => setMenuSearchTerm(e.target.value)}
                            />
                            {menuSearchTerm && (
                              <button
                                className="menu-search-clear-btn"
                                onClick={() => setMenuSearchTerm("")}
                                title="Clear search"
                              >
                                <X size={15} />
                              </button>
                            )}
                          </div>

                          <div className="menu-filter-chips-row">
                            <button
                              className={`menu-filter-chip ${menuFilterStatus === "all" ? "active" : ""}`}
                              onClick={() => setMenuFilterStatus("all")}
                            >
                              All Menus ({menus.length})
                            </button>
                            <button
                              className={`menu-filter-chip chip-granted ${menuFilterStatus === "granted" ? "active" : ""}`}
                              onClick={() => setMenuFilterStatus("granted")}
                            >
                              <Check size={13} strokeWidth={3} /> Granted ({selectedMenuIds.size})
                            </button>
                            <button
                              className={`menu-filter-chip chip-ungranted ${menuFilterStatus === "ungranted" ? "active" : ""}`}
                              onClick={() => setMenuFilterStatus("ungranted")}
                            >
                              <X size={13} strokeWidth={3} /> Not Granted ({menus.length - selectedMenuIds.size})
                            </button>
                            <button
                              className={`menu-filter-chip chip-active ${menuFilterStatus === "active" ? "active" : ""}`}
                              onClick={() => setMenuFilterStatus("active")}
                            >
                              Active Only ({menus.filter(m => m.isactive).length})
                            </button>
                          </div>
                        </div>

                        {/* Actions Toolbar */}
                        <div className="permission-toolbar">
                          <div className="toolbar-left">
                            <button
                              className="action-btn btn-select-all"
                              onClick={() => setSelectedMenuIds(new Set(menus.filter(m => m.isactive).map(m => m.id)))}
                              title="Select all active menus"
                            >
                              <CheckSquare size={15} /> Select All
                            </button>
                            <button
                              className="action-btn btn-clear-all"
                              onClick={() => setSelectedMenuIds(new Set())}
                              title="Deselect all menus"
                            >
                              <Square size={15} /> Clear All
                            </button>
                            <button
                              className="action-btn btn-copy"
                              onClick={() => setShowCopyModal(true)}
                              title="Copy permissions from another employee"
                            >
                              <Copy size={15} /> Copy From...
                            </button>

                            {/* Preset Templates */}
                            <div className="preset-dropdown-wrapper">
                              <select
                                className="action-btn btn-preset"
                                defaultValue=""
                                onChange={e => {
                                  if (e.target.value) {
                                    applyPresetTemplate(e.target.value as any);
                                    e.target.value = "";
                                  }
                                }}
                              >
                                <option value="" disabled>✨ Apply Preset Template</option>
                                <option value="admin">Full Admin Template</option>
                                <option value="tl">Team Leader Template</option>
                                <option value="employee">Standard Employee Template</option>
                                <option value="accounts">Accounts & Finance Template</option>
                              </select>
                            </div>
                          </div>

                          <div className="toolbar-right">
                            {isDirty && (
                              <button
                                className="action-btn btn-revert"
                                onClick={() => setSelectedMenuIds(new Set(initialMenuIds))}
                                title="Revert unsaved changes"
                              >
                                <RotateCcw size={15} /> Revert
                              </button>
                            )}

                            <button
                              className="action-btn btn-preview"
                              onClick={() => setShowSimulator(true)}
                              title="Preview user sidebar drawer"
                            >
                              <Eye size={15} /> Preview Sidebar
                            </button>

                            <button
                              className="action-btn btn-save primary"
                              onClick={handleSavePermissions}
                              disabled={saving || !isDirty}
                            >
                              {saving ? <IonSpinner name="dots" style={{ width: 18, height: 18 }} /> : <Save size={15} />}
                              {isDirty ? "Save Permissions" : "Saved"}
                            </button>
                          </div>
                        </div>

                        {/* Search results status count */}
                        {menuSearchTerm && (
                          <div className="search-results-summary">
                            <span>Showing <strong>{totalFilteredMenus}</strong> matching menus for "<em>{menuSearchTerm}</em>"</span>
                            <button className="clear-search-link" onClick={() => setMenuSearchTerm("")}>Clear search</button>
                          </div>
                        )}

                        {/* Grouped Menus or Empty State */}
                        {totalFilteredMenus === 0 ? (
                          <div className="no-menu-matches-card">
                            <Search size={36} color="#94a3b8" />
                            <h3 className="no-menu-title">No menus match your search</h3>
                            <p className="no-menu-desc">
                              No items found matching "{menuSearchTerm}" under the selected filter.
                            </p>
                            <button
                              className="action-btn btn-select-all"
                              onClick={() => {
                                setMenuSearchTerm("");
                                setMenuFilterStatus("all");
                              }}
                            >
                              Reset Search & Filters
                            </button>
                          </div>
                        ) : (
                          Object.entries(categorizedMenus).map(([category, catMenus]) => {
                            const allCatChecked = catMenus.every(m => selectedMenuIds.has(m.id));
                            const someCatChecked = catMenus.some(m => selectedMenuIds.has(m.id));
                            return (
                              <div key={category} className="category-accordion">
                                <div className="category-header">
                                  <div className="category-header-title">
                                    <div className="category-icon-pill" style={{ background: getCategoryGradient(category) }}>
                                      <MenuIcon size={14} />
                                    </div>
                                    <span>{category}</span>
                                    <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 400 }}>
                                      ({catMenus.filter(m => selectedMenuIds.has(m.id)).length} of {catMenus.length})
                                    </span>
                                  </div>

                                  <div className="category-actions">
                                    <button
                                      className="cat-select-toggle"
                                      onClick={() => toggleCategoryPermissions(catMenus)}
                                    >
                                      {allCatChecked ? "Deselect Category" : "Select Category"}
                                    </button>
                                  </div>
                                </div>

                              <div className="menu-items-grid">
                                {catMenus.map(menu => {
                                  const isChecked = selectedMenuIds.has(menu.id);
                                  return (
                                    <div
                                      key={menu.id}
                                      className={`menu-perm-card ${isChecked ? "active" : ""}`}
                                      onClick={() => toggleMenuPermission(menu.id)}
                                    >
                                      <div className="menu-perm-left">
                                        <div className="menu-perm-icon">
                                          <IonIcon icon={getMenuIonIcon(menu.mIcon)} />
                                        </div>
                                        <div className="menu-perm-info">
                                          <p className="menu-perm-title">{menu.menuText}</p>
                                          <div className="menu-perm-sub">
                                            <span className="menu-perm-url">
                                              {menu.navigateUrl || "(Parent/Dropdown)"}
                                            </span>
                                            {!menu.isactive && (
                                              <span className="menu-inactive-badge">Disabled</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="menu-perm-check">
                                        {isChecked && <Check size={14} strokeWidth={3} />}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }))}
                      </>
                    ) : (
                      <p style={{ textAlign: "center", color: "#64748b", padding: "40px" }}>
                        Select an employee from the left panel to manage permissions.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* TAB 2: MENU MASTER TABLE (tbl_Menu) */}
              {/* ========================================================================= */}
              {activeTab === "menus" && (
                <div className="menu-master-card">
                  <div className="menu-master-toolbar">
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Master Menu Directory</h3>
                      <span style={{ fontSize: "0.8rem", color: "#64748b" }}>({menus.length} registered items)</span>
                    </div>

                    <button
                      className="action-btn primary"
                      onClick={() => {
                        setEditingMenu({
                          id: 0,
                          menuText: "",
                          mIcon: "documents-outline",
                          isactive: true,
                          navigateUrl: "",
                          parentId: "0",
                          mPriority: menus.length + 1,
                          remarks: "",
                          menuType: "-"
                        });
                        setShowMenuEditModal(true);
                      }}
                    >
                      <Plus size={16} /> Add New Menu Item
                    </button>
                  </div>

                  <div className="table-responsive">
                    <table className="modern-mgmt-table">
                      <thead>
                        <tr>
                          <th style={{ width: "50px" }}>ID</th>
                          <th style={{ width: "50px" }}>Icon</th>
                          <th>Menu Title</th>
                          <th>Route URL</th>
                          <th>Parent</th>
                          <th>Order</th>
                          <th>Target Roles</th>
                          <th>Status</th>
                          <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {menus.map(menu => {
                          const parent = menus.find(m => String(m.id) === String(menu.parentId));
                          return (
                            <tr key={menu.id}>
                              <td style={{ fontWeight: 600, color: "#64748b" }}>#{menu.id}</td>
                              <td>
                                <div className="table-icon-chip">
                                  <IonIcon icon={getMenuIonIcon(menu.mIcon)} />
                                </div>
                              </td>
                              <td style={{ fontWeight: 600 }}>{menu.menuText}</td>
                              <td>
                                {menu.navigateUrl ? (
                                  <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", fontSize: "0.8rem" }}>
                                    {menu.navigateUrl}
                                  </code>
                                ) : (
                                  <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>-</span>
                                )}
                              </td>
                              <td>
                                {menu.parentId && menu.parentId !== "0" ? (
                                  <span style={{ background: "#e0e7ff", color: "#3730a3", padding: "2px 8px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600 }}>
                                    {parent ? parent.menuText : `Parent #${menu.parentId}`}
                                  </span>
                                ) : (
                                  <span style={{ color: "#64748b", fontSize: "0.8rem" }}>Root (Top Level)</span>
                                )}
                              </td>
                              <td>{menu.mPriority}</td>
                              <td>
                                <span style={{ fontSize: "0.8rem", color: "#475569" }}>
                                  {menu.remarks || "-"}
                                </span>
                              </td>
                              <td>
                                <label className="switch-toggle" title={menu.isactive ? "Active" : "Inactive"}>
                                  <input
                                    type="checkbox"
                                    checked={menu.isactive}
                                    onChange={() => handleToggleMenuStatus(menu.id, menu.isactive)}
                                  />
                                  <span className="slider-toggle"></span>
                                </label>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <button
                                  className="action-btn"
                                  onClick={() => {
                                    setEditingMenu({ ...menu });
                                    setShowMenuEditModal(true);
                                  }}
                                  title="Edit Menu"
                                >
                                  <Edit3 size={14} /> Edit
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* TAB 3: BULK ASSIGNMENT */}
              {/* ========================================================================= */}
              {activeTab === "bulk" && (
                <div className="menu-master-card" style={{ padding: "24px" }}>
                  <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                    <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 8px" }}>
                      Bulk Menu Permission Assignment
                    </h2>
                    <p style={{ color: "#64748b", fontSize: "0.9rem", margin: "0 0 24px" }}>
                      Apply permission sets, append new features, or revoke menus across multiple employees simultaneously.
                    </p>

                    {/* Step 1: Select Employees */}
                    <div style={{ marginBottom: "20px" }}>
                      <label style={{ fontWeight: 600, fontSize: "0.9rem", display: "block", marginBottom: "8px" }}>
                        1. Select Target Employees ({bulkSelectedEmpCodes.size} selected)
                      </label>
                      <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                        <button
                          className="action-btn"
                          onClick={() => setBulkSelectedEmpCodes(new Set(employees.map(e => e.empCode)))}
                        >
                          Select All Employees ({employees.length})
                        </button>
                        <button
                          className="action-btn"
                          onClick={() => setBulkSelectedEmpCodes(new Set())}
                        >
                          Clear Selection
                        </button>
                      </div>

                      <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "8px" }}>
                        {employees.map(emp => {
                          const isChecked = bulkSelectedEmpCodes.has(emp.empCode);
                          return (
                            <label
                              key={emp.empCode}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "6px 10px",
                                borderRadius: "6px",
                                cursor: "pointer",
                                background: isChecked ? "#eff6ff" : "transparent"
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setBulkSelectedEmpCodes(prev => {
                                    const next = new Set(prev);
                                    if (next.has(emp.empCode)) next.delete(emp.empCode);
                                    else next.add(emp.empCode);
                                    return next;
                                  });
                                }}
                              />
                              <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                                {emp.empName} ({emp.empCode}) - {emp.designation || emp.department}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Step 2: Choose Mode */}
                    <div style={{ marginBottom: "20px" }}>
                      <label style={{ fontWeight: 600, fontSize: "0.9rem", display: "block", marginBottom: "8px" }}>
                        2. Assignment Mode
                      </label>
                      <div style={{ display: "flex", gap: "12px" }}>
                        {[
                          { mode: "replace", label: "Overwrite / Replace Permissions" },
                          { mode: "append", label: "Append (Add to Existing)" },
                          { mode: "remove", label: "Revoke (Remove from Existing)" }
                        ].map(item => (
                          <label key={item.mode} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.85rem" }}>
                            <input
                              type="radio"
                              name="bulkMode"
                              checked={bulkMode === item.mode}
                              onChange={() => setBulkMode(item.mode as any)}
                            />
                            {item.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Step 3: Select Menus */}
                    <div style={{ marginBottom: "24px" }}>
                      <label style={{ fontWeight: 600, fontSize: "0.9rem", display: "block", marginBottom: "8px" }}>
                        3. Menus to Apply ({bulkSelectedMenuIds.size} selected)
                      </label>
                      <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                        <button
                          className="action-btn"
                          onClick={() => setBulkSelectedMenuIds(new Set(menus.filter(m => m.isactive).map(m => m.id)))}
                        >
                          Select All Active Menus
                        </button>
                        <button
                          className="action-btn"
                          onClick={() => setBulkSelectedMenuIds(new Set())}
                        >
                          Clear Menus
                        </button>
                      </div>

                      <div style={{ maxHeight: "240px", overflowY: "auto", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                        {menus.map(menu => {
                          const isChecked = bulkSelectedMenuIds.has(menu.id);
                          return (
                            <label
                              key={menu.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "6px 8px",
                                borderRadius: "6px",
                                cursor: "pointer",
                                background: isChecked ? "#eff6ff" : "transparent"
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setBulkSelectedMenuIds(prev => {
                                    const next = new Set(prev);
                                    if (next.has(menu.id)) next.delete(menu.id);
                                    else next.add(menu.id);
                                    return next;
                                  });
                                }}
                              />
                              <span style={{ fontSize: "0.82rem" }}>
                                {menu.menuText} <span style={{ color: "#94a3b8" }}>({menu.navigateUrl || "Parent"})</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      className="action-btn primary"
                      style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: "0.95rem" }}
                      onClick={handleBulkUpdate}
                      disabled={saving}
                    >
                      {saving ? "Executing Bulk Update..." : `Apply to ${bulkSelectedEmpCodes.size} Employees`}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ========================================================================= */}
          {/* SIMULATOR DRAWER: LIVE SIDEBAR SIMULATION */}
          {/* ========================================================================= */}
          {showSimulator && selectedEmployee && (
            <div className="simulator-drawer">
              <div className="simulator-header">
                <div>
                  <h4 className="simulator-title">Live Sidebar Simulation</h4>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Exact view for {selectedEmployee.empName}</span>
                </div>
                <button
                  className="action-btn"
                  style={{ padding: "4px" }}
                  onClick={() => setShowSimulator(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="simulator-body">
                <div className="sim-sidebar-wrapper">
                  <div className="sim-sidebar-user">
                    <p className="sim-user-name">{selectedEmployee.empName}</p>
                    <p className="sim-user-role">{selectedEmployee.designation || "Employee"} • {selectedEmployee.empCode}</p>
                  </div>

                  <div className="sim-item-list">
                    {menus
                      .filter(m => selectedMenuIds.has(m.id) && m.isactive)
                      .sort((a, b) => a.mPriority - b.mPriority)
                      .map(menu => (
                        <div key={menu.id} className="sim-nav-item">
                          <IonIcon icon={getMenuIonIcon(menu.mIcon)} style={{ fontSize: "16px", color: "#3b82f6" }} />
                          <span>{menu.menuText}</span>
                        </div>
                      ))}
                    {menus.filter(m => selectedMenuIds.has(m.id) && m.isactive).length === 0 && (
                      <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.8rem", padding: "20px" }}>
                        No menus visible for this employee.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* COPY MODAL */}
          {/* ========================================================================= */}
          {showCopyModal && (
            <div className="modal-overlay-custom" onClick={() => setShowCopyModal(false)}>
              <div className="modal-dialog-custom" onClick={e => e.stopPropagation()}>
                <div className="modal-header-custom">
                  <h3>Copy Permissions From Employee</h3>
                  <button className="action-btn" style={{ padding: "4px" }} onClick={() => setShowCopyModal(false)}>
                    <X size={16} />
                  </button>
                </div>

                <div className="modal-body-custom">
                  <p style={{ fontSize: "0.88rem", color: "#64748b", margin: 0 }}>
                    Select a source employee whose menu permissions you want to clone into <strong>{selectedEmployee?.empName}</strong>:
                  </p>

                  <div className="form-group-custom">
                    <label>Source Employee</label>
                    <select
                      className="form-input-custom"
                      value={copySourceEmpCode}
                      onChange={e => setCopySourceEmpCode(e.target.value)}
                    >
                      <option value="">-- Choose Employee --</option>
                      {employees.map(emp => (
                        <option key={emp.empCode} value={emp.empCode}>
                          {emp.empName} ({emp.empCode}) - {emp.permissionCount} menus
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="modal-footer-custom">
                  <button className="action-btn" onClick={() => setShowCopyModal(false)}>
                    Cancel
                  </button>
                  <button className="action-btn primary" onClick={handleCopyPermissions}>
                    Copy & Load Permissions
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ADD / EDIT MENU MODAL */}
          {/* ========================================================================= */}
          {showMenuEditModal && (
            <div className="modal-overlay-custom" onClick={() => setShowMenuEditModal(false)}>
              <div className="modal-dialog-custom" onClick={e => e.stopPropagation()}>
                <div className="modal-header-custom">
                  <h3>{editingMenu.id ? `Edit Menu #${editingMenu.id}` : "Add New Menu Item"}</h3>
                  <button className="action-btn" style={{ padding: "4px" }} onClick={() => setShowMenuEditModal(false)}>
                    <X size={16} />
                  </button>
                </div>

                <div className="modal-body-custom">
                  <div className="form-group-custom">
                    <label>Menu Title *</label>
                    <input
                      type="text"
                      className="form-input-custom"
                      placeholder="e.g. Work Reports"
                      value={editingMenu.menuText || ""}
                      onChange={e => setEditingMenu({ ...editingMenu, menuText: e.target.value })}
                    />
                  </div>

                  <div className="form-row-custom">
                    <div className="form-group-custom">
                      <label>Navigate URL</label>
                      <input
                        type="text"
                        className="form-input-custom"
                        placeholder="e.g. /workreports"
                        value={editingMenu.navigateUrl || ""}
                        onChange={e => setEditingMenu({ ...editingMenu, navigateUrl: e.target.value })}
                      />
                    </div>

                    <div className="form-group-custom">
                      <label>Icon Name (Ionicons)</label>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input
                          type="text"
                          className="form-input-custom"
                          placeholder="e.g. wallet-outline"
                          value={editingMenu.mIcon || ""}
                          onChange={e => setEditingMenu({ ...editingMenu, mIcon: e.target.value })}
                        />
                        <div className="table-icon-chip">
                          <IonIcon icon={getMenuIonIcon(editingMenu.mIcon || "")} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="form-row-custom">
                    <div className="form-group-custom">
                      <label>Parent Menu</label>
                      <select
                        className="form-input-custom"
                        value={editingMenu.parentId || "0"}
                        onChange={e => setEditingMenu({ ...editingMenu, parentId: e.target.value })}
                      >
                        <option value="0">Root Level (Top Navigation)</option>
                        {menus
                          .filter(m => (!m.parentId || m.parentId === "0") && m.id !== editingMenu.id)
                          .map(parent => (
                            <option key={parent.id} value={String(parent.id)}>
                              Submenu of: {parent.menuText} (#{parent.id})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="form-group-custom">
                      <label>Priority Order</label>
                      <input
                        type="number"
                        className="form-input-custom"
                        value={editingMenu.mPriority || 0}
                        onChange={e => setEditingMenu({ ...editingMenu, mPriority: parseInt(e.target.value, 10) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="form-group-custom">
                    <label>Target Role Remarks</label>
                    <input
                      type="text"
                      className="form-input-custom"
                      placeholder="e.g. Admin, TL, Employee"
                      value={editingMenu.remarks || ""}
                      onChange={e => setEditingMenu({ ...editingMenu, remarks: e.target.value })}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                    <input
                      type="checkbox"
                      id="menuActiveCheck"
                      checked={editingMenu.isactive !== false}
                      onChange={e => setEditingMenu({ ...editingMenu, isactive: e.target.checked })}
                    />
                    <label htmlFor="menuActiveCheck" style={{ fontSize: "0.88rem", fontWeight: 500, cursor: "pointer" }}>
                      Active (Visible in dashboard menu system)
                    </label>
                  </div>
                </div>

                <div className="modal-footer-custom">
                  <button className="action-btn" onClick={() => setShowMenuEditModal(false)}>
                    Cancel
                  </button>
                  <button className="action-btn primary" onClick={handleSaveMenu} disabled={saving}>
                    {saving ? "Saving..." : "Save Menu"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Toast */}
          <IonToast
            isOpen={!!toast}
            message={toast?.msg || ""}
            duration={3000}
            color={toast?.color || "primary"}
            onDidDismiss={() => setToast(null)}
          />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default MenuManagement;
