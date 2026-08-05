import React, { useState, useEffect, useCallback, useRef } from 'react';
import { IonPage, IonContent, IonIcon } from '@ionic/react';
import { createPortal } from 'react-dom';
import { useHistory } from 'react-router-dom';
import { person, search, close, checkmarkCircle } from 'ionicons/icons';
import { API_BASE } from '../../config';
import './AIAttendanceRuleMaster.css';

const API_KEY = 'dbase-ai-master-key-2026';
const hdrs = { 'Content-Type': 'application/json', 'x-api-key': API_KEY };

interface BranchRule {
  id: number;
  branch: string;
  /** '' means the branch-wide fallback row: it applies to every dept in the
   *  branch that has no row of its own. */
  branchDept: string;
  btRequired: boolean;
  gpsRequired: boolean;
}

interface BranchDeptPair {
  branch: string;
  branchDept: string;
}

/** A rule is identified by the (branch, dept) PAIR, never by branch alone.
 *  \u0001 cannot occur in a branch or dept name, so it is a safe separator -
 *  the same one the API uses for its own rule cache keys. */
const ruleKey = (branch: string, dept: string) =>
  `${(branch || '').trim()}\u0001${(dept || '').trim()}`;

const deptLabel = (dept: string) => (dept || '').trim() || 'All departments';

interface Employee {
  empCode: string;
  empName: string;
  designation: string;
  branch: string;
  /** The dept on tbl_employee, i.e. which branch/dept row this person sits
   *  under. Optional so an older API build that omits it still parses. */
  branchDept?: string;
  department?: string;
}

interface Override {
  id: number;
  empId: string;
  empName: string;
  designation: string;
  branch: string;
  liveBranch: string;
  btRequired: boolean;
  gpsRequired: boolean;
  startDate: string;
  endDate: string;
  ruleType: string;
  // Where this person actually is today, resolved from an approved on-duty.
  // A branch duty names the office they are visiting; Party / Client /
  // Official duties name no office at all and arrive as "OnDuty", meaning
  // the punch is allowed wherever they are. Optional because an older API
  // build predates these fields.
  onDutyBranch?: string;
  onDutyAnywhere?: boolean;
  onDutyType?: string;
}

// A row nobody typed in. It is derived from an approved on-duty, so there is
// no id to delete and no stored BT / GPS to edit - the server recomputes both
// with the same precedence the punch path uses, which is the whole point: what
// this table shows and what the door actually does cannot drift apart.
interface AutoOverride {
  dutyId: string;
  empId: string;
  empName: string;
  designation: string;
  homeBranch: string;
  onDutyBranch: string;
  onDutyType: string;
  onDutyAnywhere: boolean;
  btRequired: boolean;
  gpsRequired: boolean;
  // Which rule produced btRequired / gpsRequired. Surfaced as the tooltip on
  // those two cells, because "why is BT on at a branch with no beacon" is the
  // question this table gets asked, and it should be able to answer it.
  ruleSource?: string;
  startDate: string;
  endDate: string;
}

interface BluetoothDevice {
  id: number;
  deviceName: string;
  deviceMac: string;
  branch: string;
  branchDept?: string;
  isActive: boolean;
  createdOn?: string;
}

interface OfficeLocation {
  id: number;
  officeName: string;
  branch: string;
  branchDept?: string;
  latitude1: number;
  longitude1: number;
  latitude2: number;
  longitude2: number;
  allowedRadiusMeters: number;
  isActive: boolean;
  createdOn?: string;
}

interface BranchDirectoryRow {
  lid: number;
  branch: string;
  branchDept: string;
}

const AIAttendanceRuleMaster: React.FC = () => {
  const history = useHistory();
  const [activeTab, setActiveTab] = useState<'branches' | 'directory' | 'overrides' | 'bluetooth' | 'locations'>('branches');
  const [toast, setToast] = useState('');

  // --- Branch tab state ---
  const [branchRules, setBranchRules] = useState<BranchRule[]>([]);
  const [allBranches, setAllBranches] = useState<string[]>([]);
  // Every (Branch, BranchDept) pair that exists in tbl_Branch.
  const [branchDeptPairs, setBranchDeptPairs] = useState<BranchDeptPair[]>([]);
  const [localRules, setLocalRules] = useState<Record<string, { bt: boolean; gps: boolean }>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  // Rows the user has touched but not yet ticked. Saving one row reloads the
  // whole rule list from the server, and without this the reload would quietly
  // wipe pending edits on every OTHER row. A ref, not state: it must be
  // readable from inside loadBranchRules without making that callback
  // re-create itself on every keystroke.
  const dirtyKeys = useRef<Set<string>>(new Set());
  // No "add" row any more: every branch/dept pair in tbl_Branch is listed
  // automatically, so there is nothing left to add by hand.

  // --- Branch Directory (tbl_Branch) tab state ---
  const [dirRows, setDirRows] = useState<BranchDirectoryRow[]>([]);
  const [dirLoading, setDirLoading] = useState(false);
  const [dirSearchTerm, setDirSearchTerm] = useState('');
  const [dirBranchFilter, setDirBranchFilter] = useState('');

  // Add/Edit Branch Directory Modal State
  const [isDirModalOpen, setIsDirModalOpen] = useState(false);
  const [editingDir, setEditingDir] = useState<BranchDirectoryRow | null>(null);
  const [dirFormBranch, setDirFormBranch] = useState('');
  const [dirFormDept, setDirFormDept] = useState('');
  const [dirSaving, setDirSaving] = useState(false);

  // Delete Confirm Branch Directory Modal State
  const [deletingDir, setDeletingDir] = useState<BranchDirectoryRow | null>(null);

  // --- Override tab state ---
  const [ruleType, setRuleType] = useState<'BRANCH' | 'MARKETING'>('MARKETING');
  const [step, setStep] = useState(1);
  const [selBranch, setSelBranch] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [selIds, setSelIds] = useState<string[]>([]);
  const [btOn, setBtOn] = useState(false);
  const [gpsOn, setGpsOn] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [autoOverrides, setAutoOverrides] = useState<AutoOverride[]>([]);
  // An empty table and an unreachable endpoint look identical on screen, and
  // that ambiguity costs a rebuild to resolve. Keep them apart.
  const [autoErr, setAutoErr] = useState<string>('');

  // --- Bluetooth tab state ---
  const [btDevices, setBtDevices] = useState<BluetoothDevice[]>([]);
  const [btLoading, setBtLoading] = useState(false);
  const [btSearchTerm, setBtSearchTerm] = useState('');
  const [btBranchFilter, setBtBranchFilter] = useState('');

  // Add/Edit Modal State
  const [isBtModalOpen, setIsBtModalOpen] = useState(false);
  const [editingBt, setEditingBt] = useState<BluetoothDevice | null>(null);
  const [btFormName, setBtFormName] = useState('');
  const [btFormMac, setBtFormMac] = useState('');
  const [btFormBranch, setBtFormBranch] = useState('');
  const [btFormDept, setBtFormDept] = useState('');
  const [btFormActive, setBtFormActive] = useState(true);
  const [btSaving, setBtSaving] = useState(false);

  // Delete Confirm Modal State
  const [deletingBt, setDeletingBt] = useState<BluetoothDevice | null>(null);

  // --- Locations tab state ---
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const [locSearchTerm, setLocSearchTerm] = useState('');
  const [locBranchFilter, setLocBranchFilter] = useState('');

  // Add/Edit Location Modal State
  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<OfficeLocation | null>(null);
  const [locFormName, setLocFormName] = useState('');
  const [locFormBranch, setLocFormBranch] = useState('');
  const [locFormDept, setLocFormDept] = useState('');
  const [locFormLat1, setLocFormLat1] = useState<string>('');
  const [locFormLng1, setLocFormLng1] = useState<string>('');
  const [locFormLat2, setLocFormLat2] = useState<string>('');
  const [locFormLng2, setLocFormLng2] = useState<string>('');
  const [locFormRadius, setLocFormRadius] = useState<number>(100);
  const [locFormActive, setLocFormActive] = useState(true);
  const [locSaving, setLocSaving] = useState(false);

  // Delete Confirm Location Modal State
  const [deletingLoc, setDeletingLoc] = useState<OfficeLocation | null>(null);

  // --- Dropdown states ---
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [empSearchTerm, setEmpSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("");
  const triggerRef = useRef<HTMLDivElement>(null);

  // Position logic
  useEffect(() => {
    if (isEmployeeDropdownOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isEmployeeDropdownOpen]);

  const filteredEmployees = employees.filter(emp => {
    const term = empSearchTerm.toLowerCase();
    const matchesSearch = emp.empName.toLowerCase().includes(term) || emp.empCode.toLowerCase().includes(term);
    const matchesDept = !selectedDept || (emp.department || "").trim().toLowerCase() === selectedDept.toLowerCase();
    return matchesSearch && matchesDept;
  });

  const uniqueDepartments = Array.from(
    new Set(
      employees
        .map(emp => (emp.department || "").trim())
        .filter(dept => dept !== "")
    )
  ).sort();

  // --- Branch expand state ---
  // Keyed by ruleKey(), because two rows can share a branch name now.
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  // Both keyed by ruleKey(), NOT by branch: Vizag/AU and Vizag/SDE hold
  // different people, so a branch-keyed cache would show the first dept
  // expanded to every other dept of the same branch.
  const [branchEmpCache, setBranchEmpCache] = useState<Record<string, Employee[]>>({});
  const [branchEmpLoading, setBranchEmpLoading] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const loadBranchRules = useCallback(async () => {
    const r = await fetch(API_BASE + 'Checkin/GetBranchRules', { headers: hdrs });
    const d = await r.json();
    if (d.success) {
      setBranchRules(d.data);
      const map: Record<string, { bt: boolean; gps: boolean }> = {};
      d.data.forEach((row: BranchRule) => {
        map[ruleKey(row.branch, row.branchDept)] = { bt: row.btRequired, gps: row.gpsRequired };
      });
      // Server truth wins everywhere EXCEPT rows with edits still in flight.
      // Those the user is mid-way through changing, and throwing them away
      // because a different row was saved would look like the app losing work.
      setLocalRules(prev => {
        const merged = { ...map };
        dirtyKeys.current.forEach(k => { if (prev[k]) merged[k] = prev[k]; });
        return merged;
      });
    }
  }, []);

  const loadBranches = useCallback(async () => {
    const r = await fetch(API_BASE + 'Checkin/GetBranches', { headers: hdrs });
    const d = await r.json();
    if (d.success) setAllBranches(d.data);
  }, []);

  const loadBranchDeptPairs = useCallback(async () => {
    try {
      const r = await fetch(API_BASE + 'Checkin/GetBranchDeptPairs', { headers: hdrs });
      const d = await r.json();
      if (d.success) setBranchDeptPairs(d.data);
    } catch {
      // Old API build that predates this endpoint: the Add row falls back to
      // the plain branch list instead of breaking the whole screen.
    }
  }, []);

  const loadOverrides = useCallback(async () => {
    const r = await fetch(API_BASE + `Checkin/GetEmployeeOverrides?ruleType=${ruleType}&isActive=1`, { headers: hdrs });
    const d = await r.json();
    if (d.success) setOverrides(d.data);
  }, [ruleType]);

  // Deliberately not filtered by the BRANCH / MARKETING tab: an on-duty has no
  // rule type, so filtering it by one would hide half the travelling staff
  // depending on which tab happened to be open.
  const loadAutoOverrides = useCallback(async () => {
    try {
      const r = await fetch(API_BASE + 'Checkin/GetOnDutyAutoOverrides?days=7', { headers: hdrs });
      if (!r.ok) {
        // 404 is the one worth naming: it means the running API predates this
        // endpoint, i.e. it has not been rebuilt yet. Saying so beats an empty
        // table that reads like "nobody is on duty".
        setAutoOverrides([]);
        setAutoErr(r.status === 404
          ? 'This API build does not have the auto-overrides endpoint yet - rebuild and restart the API.'
          : 'Could not load auto overrides (HTTP ' + r.status + ').');
        return;
      }
      const d = await r.json();
      if (d.success) { setAutoOverrides(d.data || []); setAutoErr(''); }
      else { setAutoOverrides([]); setAutoErr(d.message || 'Could not load auto overrides.'); }
    } catch (e: any) {
      setAutoOverrides([]);
      setAutoErr('Could not reach the API: ' + (e?.message || 'network error'));
    }
  }, []);

  const loadBluetoothDevices = useCallback(async () => {
    setBtLoading(true);
    try {
      const r = await fetch(API_BASE + 'Checkin/GetBluetoothMasters', { headers: hdrs });
      const d = await r.json();
      if (d.success) setBtDevices(d.data || []);
    } catch {
      showToast('Failed to load Bluetooth devices.');
    } finally {
      setBtLoading(false);
    }
  }, []);

  // Load all employees when MARKETING is selected (no designation filter)
  useEffect(() => {
    if (ruleType === 'MARKETING') {
      setEmpLoading(true);
      fetch(API_BASE + 'Checkin/GetEmployeesByBranch', { headers: hdrs })
        .then(r => r.json())
        .then(d => { if (d.success) setEmployees(d.data); })
        .finally(() => setEmpLoading(false));
    }
  }, [ruleType]);

  useEffect(() => { loadBranchRules(); loadBranches(); loadBranchDeptPairs(); },
    [loadBranchRules, loadBranches, loadBranchDeptPairs]);

  const loadBranchDirectory = useCallback(async () => {
    setDirLoading(true);
    try {
      const r = await fetch(API_BASE + 'Checkin/GetBranchMasterList', { headers: hdrs });
      const d = await r.json();
      if (d.success) setDirRows(d.data || []);
    } catch {
      showToast('Failed to load Branch Directory.');
    } finally {
      setDirLoading(false);
    }
  }, []);

  useEffect(() => { if (activeTab === 'directory') loadBranchDirectory(); }, [activeTab, loadBranchDirectory]);

  const openAddDirModal = () => {
    setEditingDir(null);
    setDirFormBranch('');
    setDirFormDept('');
    setIsDirModalOpen(true);
  };

  const openEditDirModal = (row: BranchDirectoryRow) => {
    setEditingDir(row);
    setDirFormBranch(row.branch);
    setDirFormDept(row.branchDept || '');
    setIsDirModalOpen(true);
  };

  const handleSaveBranchDirectory = async () => {
    if (!dirFormBranch.trim()) {
      showToast('Branch name is required.');
      return;
    }
    setDirSaving(true);
    try {
      const payload = {
        lid: editingDir ? editingDir.lid : 0,
        branch: dirFormBranch.trim(),
        branchDept: dirFormDept.trim()
      };
      const r = await fetch(API_BASE + 'Checkin/SaveBranchMaster', {
        method: 'POST', headers: hdrs,
        body: JSON.stringify(payload)
      });
      const d = await r.json();
      if (d.success) {
        showToast(editingDir ? 'Branch updated successfully.' : 'Branch added successfully.');
        setIsDirModalOpen(false);
        loadBranchDirectory();
        loadBranches();
        loadBranchDeptPairs();
        loadBranchRules();
      } else {
        showToast(d.message || 'Failed to save branch.');
      }
    } catch {
      showToast('Failed to save branch.');
    } finally {
      setDirSaving(false);
    }
  };

  const handleDeleteBranchDirectory = async (lid: number) => {
    try {
      const r = await fetch(API_BASE + `Checkin/DeleteBranchMaster/${lid}`, { method: 'POST', headers: hdrs });
      const d = await r.json();
      if (d.success) {
        showToast('Branch deleted successfully.');
        setDeletingDir(null);
        loadBranchDirectory();
        loadBranches();
        loadBranchDeptPairs();
        loadBranchRules();
      } else {
        showToast(d.message || 'Failed to delete branch.');
      }
    } catch {
      showToast('Failed to delete branch.');
    }
  };

  useEffect(() => {
    if (activeTab !== 'overrides') return;
    loadOverrides();
    loadAutoOverrides();
  }, [activeTab, loadOverrides, loadAutoOverrides]);
  useEffect(() => { if (activeTab === 'bluetooth') loadBluetoothDevices(); }, [activeTab, loadBluetoothDevices]);

  const openAddBtModal = () => {
    setEditingBt(null);
    setBtFormName('');
    setBtFormMac('');
    setBtFormBranch('');
    setBtFormDept('');
    setBtFormActive(true);
    setIsBtModalOpen(true);
  };

  const openEditBtModal = (dev: BluetoothDevice) => {
    setEditingBt(dev);
    setBtFormName(dev.deviceName);
    setBtFormMac(dev.deviceMac);
    setBtFormBranch(dev.branch || '');
    setBtFormDept(dev.branchDept || '');
    setBtFormActive(dev.isActive);
    setIsBtModalOpen(true);
  };

  const handleSaveBtDevice = async () => {
    if (!btFormName.trim() || !btFormMac.trim()) {
      showToast('Device Name and MAC Address are required.');
      return;
    }
    setBtSaving(true);
    try {
      const payload = {
        id: editingBt ? editingBt.id : 0,
        deviceName: btFormName.trim(),
        deviceMac: btFormMac.trim(),
        branch: btFormBranch.trim(),
        branchDept: btFormDept.trim(),
        isActive: btFormActive
      };
      const r = await fetch(API_BASE + 'Checkin/SaveBluetoothMaster', {
        method: 'POST', headers: hdrs,
        body: JSON.stringify(payload)
      });
      const d = await r.json();
      if (d.success) {
        showToast(editingBt ? 'Bluetooth device updated.' : 'Bluetooth device added.');
        setIsBtModalOpen(false);
        loadBluetoothDevices();
      } else {
        showToast(d.message || 'Error saving device.');
      }
    } catch {
      showToast('Failed to save device.');
    } finally {
      setBtSaving(false);
    }
  };

  const handleDeleteBtDevice = async (id: number) => {
    try {
      const r = await fetch(API_BASE + `Checkin/DeleteBluetoothMaster/${id}`, { method: 'POST', headers: hdrs });
      const d = await r.json();
      if (d.success) {
        showToast('Bluetooth device deleted.');
        setDeletingBt(null);
        loadBluetoothDevices();
      } else {
        showToast(d.message || 'Failed to delete device.');
      }
    } catch {
      showToast('Failed to delete device.');
    }
  };

  const handleToggleBtStatus = async (dev: BluetoothDevice) => {
    try {
      const r = await fetch(API_BASE + `Checkin/ToggleBluetoothMasterStatus/${dev.id}`, { method: 'POST', headers: hdrs });
      const d = await r.json();
      if (d.success) {
        showToast(`Device ${dev.isActive ? 'deactivated' : 'activated'}.`);
        loadBluetoothDevices();
      }
    } catch {
      showToast('Failed to update status.');
    }
  };

  const loadOfficeLocations = useCallback(async () => {
    setLocLoading(true);
    try {
      const r = await fetch(API_BASE + 'Checkin/GetOfficeLocations', { headers: hdrs });
      const d = await r.json();
      if (d.success) setOfficeLocations(d.data || []);
    } catch {
      showToast('Failed to load Office Locations.');
    } finally {
      setLocLoading(false);
    }
  }, []);

  useEffect(() => { if (activeTab === 'locations') loadOfficeLocations(); }, [activeTab, loadOfficeLocations]);

  const openAddLocModal = () => {
    setEditingLoc(null);
    setLocFormName('');
    setLocFormBranch('');
    setLocFormDept('');
    setLocFormLat1('');
    setLocFormLng1('');
    setLocFormLat2('');
    setLocFormLng2('');
    setLocFormRadius(100);
    setLocFormActive(true);
    setIsLocModalOpen(true);
  };

  const openEditLocModal = (loc: OfficeLocation) => {
    setEditingLoc(loc);
    setLocFormName(loc.officeName);
    setLocFormBranch(loc.branch || '');
    setLocFormDept(loc.branchDept || '');
    setLocFormLat1(loc.latitude1 ? String(loc.latitude1) : '');
    setLocFormLng1(loc.longitude1 ? String(loc.longitude1) : '');
    setLocFormLat2(loc.latitude2 ? String(loc.latitude2) : '');
    setLocFormLng2(loc.longitude2 ? String(loc.longitude2) : '');
    setLocFormRadius(loc.allowedRadiusMeters || 100);
    setLocFormActive(loc.isActive);
    setIsLocModalOpen(true);
  };

  const handleSaveOfficeLocation = async () => {
    if (!locFormName.trim()) {
      showToast('Office Name is required.');
      return;
    }
    setLocSaving(true);
    try {
      const payload = {
        id: editingLoc ? editingLoc.id : 0,
        officeName: locFormName.trim(),
        branch: locFormBranch.trim(),
        branchDept: locFormDept.trim(),
        latitude1: parseFloat(locFormLat1) || 0,
        longitude1: parseFloat(locFormLng1) || 0,
        latitude2: parseFloat(locFormLat2) || 0,
        longitude2: parseFloat(locFormLng2) || 0,
        allowedRadiusMeters: locFormRadius > 0 ? locFormRadius : 100,
        isActive: locFormActive
      };
      const r = await fetch(API_BASE + 'Checkin/SaveOfficeLocation', {
        method: 'POST', headers: hdrs,
        body: JSON.stringify(payload)
      });
      const d = await r.json();
      if (d.success) {
        showToast(editingLoc ? 'Office location updated.' : 'Office location added.');
        setIsLocModalOpen(false);
        loadOfficeLocations();
      } else {
        showToast(d.message || 'Error saving location.');
      }
    } catch {
      showToast('Failed to save location.');
    } finally {
      setLocSaving(false);
    }
  };

  const handleDeleteOfficeLocation = async (id: number) => {
    try {
      const r = await fetch(API_BASE + `Checkin/DeleteOfficeLocation/${id}`, { method: 'POST', headers: hdrs });
      const d = await r.json();
      if (d.success) {
        showToast('Office location deleted.');
        setDeletingLoc(null);
        loadOfficeLocations();
      } else {
        showToast(d.message || 'Failed to delete location.');
      }
    } catch {
      showToast('Failed to delete location.');
    }
  };

  const handleToggleLocStatus = async (loc: OfficeLocation) => {
    try {
      const r = await fetch(API_BASE + `Checkin/ToggleOfficeLocationStatus/${loc.id}`, { method: 'POST', headers: hdrs });
      const d = await r.json();
      if (d.success) {
        showToast(`Location ${loc.isActive ? 'deactivated' : 'activated'}.`);
        loadOfficeLocations();
      }
    } catch {
      showToast('Failed to update status.');
    }
  };

  async function saveBranchRule(branch: string, branchDept: string) {
    const k = ruleKey(branch, branchDept);
    // A row that has never been saved still has a value on screen - the one it
    // inherits from the branch fallback. Saving it writes that value down as a
    // row of its own, which is exactly what the tick is for.
    const local = localRules[k] ?? effectiveRule(branch, branchDept);
    setSavingKey(k);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    await fetch(API_BASE + 'Checkin/SaveBranchRule', {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({
        branch, branchDept: (branchDept || '').trim(),
        btRequired: local.bt, gpsRequired: local.gps,
        createdBy: user.empName || 'admin'
      })
    });
    setSavingKey(null);
    // This row is now server truth, so it must stop being protected from the
    // reload below - otherwise it would pin the local copy forever.
    dirtyKeys.current.delete(k);
    showToast('Branch rule saved.');
    loadBranchRules();
  }


  // Load employees filtered by branch (for BRANCH flow)
  async function loadBranchEmployees() {
    setEmpLoading(true);
    let url = API_BASE + 'Checkin/GetEmployeesByBranch?';
    if (selBranch) url += `branch=${encodeURIComponent(selBranch)}&`;
    const r = await fetch(url, { headers: hdrs });
    const d = await r.json();
    if (d.success) setEmployees(d.data);
    setEmpLoading(false);
  }

  async function saveOverrides() {
    if (!selIds.length || !startDate || !endDate) return;
    setSaving(true);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const snapshotBranch = ruleType === 'BRANCH' ? selBranch : 'MARKETING';
    await fetch(API_BASE + 'Checkin/SaveEmployeeOverrides', {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({
        empIds: selIds, branch: snapshotBranch,
        btRequired: btOn, gpsRequired: gpsOn,
        startDate, endDate, ruleType,
        createdBy: user.empName || 'admin'
      })
    });
    setSaving(false);
    showToast(`${selIds.length} override(s) saved.`);
    resetWizard();
    loadOverrides();
  }

  async function deleteOverride(id: number) {
    await fetch(API_BASE + `Checkin/DeleteEmployeeOverride/${id}`, { method: 'POST', headers: hdrs });
    showToast('Override removed.');
    loadOverrides();
  }

  function resetWizard() {
    setStep(1); setSelBranch('');
    if (ruleType !== 'MARKETING') {
      setEmployees([]);
    }
    setSelIds([]);
    setBtOn(false); setGpsOn(false);
    setStartDate(''); setEndDate('');
  }

  function toggleEmp(code: string) {
    setSelIds(prev => prev.includes(code) ? prev.filter(x => x !== code) : [...prev, code]);
  }

  // Employees are fetched and cached per (branch, dept) PAIR, matching the row
  // that was expanded. A blank dept means the branch-wide fallback row, and
  // that one genuinely does cover everyone in the branch, so it sends no dept
  // filter and gets the whole branch back.
  async function toggleBranchExpand(branch: string, branchDept: string) {
    const k = ruleKey(branch, branchDept);
    if (expandedKey === k) { setExpandedKey(null); return; }
    setExpandedKey(k);
    if (branchEmpCache[k]) return;
    setBranchEmpLoading(k);
    try {
      const dept = (branchDept || '').trim();
      const url = API_BASE + `Checkin/GetEmployeesByBranch?branch=${encodeURIComponent(branch)}`
        + (dept ? `&branchDept=${encodeURIComponent(dept)}` : '');
      const r = await fetch(url, { headers: hdrs });
      const d = await r.json();
      if (d.success) {
        // Belt and braces: if the API build predates the branchDept filter it
        // returns the whole branch, so narrow it here too rather than showing
        // the wrong people. Rows with no dept of their own are left alone.
        const rows: Employee[] = dept
          ? (d.data as Employee[]).filter(e =>
              !e.branchDept || String(e.branchDept).trim().toLowerCase() === dept.toLowerCase())
          : (d.data as Employee[]);
        setBranchEmpCache(prev => ({ ...prev, [k]: rows }));
      }
    } catch {}
    setBranchEmpLoading(null);
  }

  // Every (Branch, BranchDept) pair known to the system, whether or not it has
  // a saved rule. Falls back to the plain branch list if the API predates
  // GetBranchDeptPairs.
  const knownPairs: BranchDeptPair[] = branchDeptPairs.length
    ? branchDeptPairs
    : allBranches.map(b => ({ branch: b, branchDept: '' }));

  /** What a pair ACTUALLY resolves to right now, which is not the same as what
   *  is stored. A pair with no row of its own is governed by the branch-wide
   *  fallback, so that is what its toggles must show - otherwise the screen
   *  would display OFF/ON defaults that contradict what check-in enforces. */
  const effectiveRule = (branch: string, dept: string): { bt: boolean; gps: boolean } => {
    const own = localRules[ruleKey(branch, dept)];
    if (own) return own;
    const fallback = localRules[ruleKey(branch, '')];
    return fallback ? { ...fallback } : { bt: false, gps: true };
  };

  // Branches that have at least one NAMED dept. Only these can safely have
  // their blank-dept row hidden - a branch with no dept at all would otherwise
  // vanish from this screen completely and become uneditable.
  const branchesWithDepts = new Set(
    [...knownPairs, ...branchRules]
      .filter(pr => (pr.branchDept || '').trim())
      .map(pr => (pr.branch || '').trim())
  );

  // One row per branch + NAMED dept. The blank-dept fallback row is deliberately
  // not listed: it still exists in the database and check-in still falls back to
  // it for any dept without a row, it is just noise on this screen. The one
  // exception is a branch with no depts, which keeps its fallback row so it
  // remains reachable.
  const displayRows: (BranchDeptPair & { saved: boolean })[] = (() => {
    const out: (BranchDeptPair & { saved: boolean })[] = [];
    const seen = new Set<string>();
    const push = (branch: string, branchDept: string, saved: boolean) => {
      const b = (branch || '').trim();
      if (!b) return;
      const d = (branchDept || '').trim();
      if (!d && branchesWithDepts.has(b)) return;   // hidden fallback row
      const k = ruleKey(b, d);
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ branch: b, branchDept: d, saved });
    };
    // saved first, so `saved` is never wrongly false
    branchRules.forEach(r => push(r.branch, r.branchDept, true));
    knownPairs.forEach(pr => push(pr.branch, pr.branchDept, false));
    allBranches.forEach(b => push(b, '', false));
    return out.sort((a, b) => {
      if (a.branch !== b.branch) return a.branch.localeCompare(b.branch);
      if (!a.branchDept) return -1;
      if (!b.branchDept) return 1;
      return a.branchDept.localeCompare(b.branchDept);
    });
  })();

  // Step labels per flow
  const branchStepLabels = ['Branch', 'Employees', 'Rules', 'Date Range'];
  const marketingStepLabels = ['Employees', 'Rules', 'Date Range'];
  const stepLabels = ruleType === 'BRANCH' ? branchStepLabels : marketingStepLabels;
  const totalSteps = stepLabels.length;

  // Normalise: which logical step index (0-based) maps to each screen?
  // BRANCH:    step 1→Branch, 2→Employees, 3→Rules, 4→Date
  // MARKETING: step 1→Employees, 2→Rules, 3→Date
  const showBranchSelect    = ruleType === 'BRANCH'    && step === 1;
  const showEmployeePicker  = (ruleType === 'BRANCH' && step === 2) || (ruleType === 'MARKETING' && step === 1);
  const showRules           = (ruleType === 'BRANCH' && step === 3) || (ruleType === 'MARKETING' && step === 2);
  const showDateRange       = (ruleType === 'BRANCH' && step === 4) || (ruleType === 'MARKETING' && step === 3);

  const empPrevStep = ruleType === 'BRANCH' ? 1 : undefined; // undefined → no back
  const empNextStep = ruleType === 'BRANCH' ? 3 : 2;
  const rulesNextStep = ruleType === 'BRANCH' ? 4 : 3;
  const rulesPrevStep = ruleType === 'BRANCH' ? 2 : 1;
  const datePrevStep  = ruleType === 'BRANCH' ? 3 : 2;

  return (
    <IonPage>
      <IonContent className="rm-page">
        <div className="rm-shell">

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="rm-header">
            <button className="rm-back" onClick={() => history.goBack()}>&#8592;</button>
            <div className="rm-title-wrap">
              <h1 className="rm-title">Attendance Rule Master</h1>
              <p className="rm-subtitle">Configure BT &amp; GPS rules per branch / employee</p>
            </div>
          </div>

          {/* ── Tabs ──────────────────────────────────────────────────── */}
          <div className="rm-tabs">
            <button className={`rm-tab${activeTab === 'branches' ? ' rm-tab-active' : ''}`} onClick={() => setActiveTab('branches')}>
              Branch Defaults
            </button>
            <button className={`rm-tab${activeTab === 'directory' ? ' rm-tab-active' : ''}`} onClick={() => setActiveTab('directory')}>
              Branch Directory 
            </button>
            <button className={`rm-tab${activeTab === 'overrides' ? ' rm-tab-active' : ''}`} onClick={() => setActiveTab('overrides')}>
              Employee Overrides
            </button>
            <button className={`rm-tab${activeTab === 'bluetooth' ? ' rm-tab-active' : ''}`} onClick={() => setActiveTab('bluetooth')}>
              Bluetooth Master
            </button>
            <button className={`rm-tab${activeTab === 'locations' ? ' rm-tab-active' : ''}`} onClick={() => setActiveTab('locations')}>
              GPS &amp; Locations
            </button>
          </div>

          {/* ── Toast ─────────────────────────────────────────────────── */}
          {toast && <div className="rm-toast">{toast}</div>}

          {/* ── Body ──────────────────────────────────────────────────── */}
          <div className="rm-body">

            {/* ════ BRANCH DEFAULTS TAB ════ */}
            {activeTab === 'branches' && (
              <div className="rm-card">
                <table className="rm-table">
                  <thead>
                    <tr>
                      <th>Branch</th>
                      <th>Branch Dept</th>
                      <th>Bluetooth</th>
                      <th>GPS / Location</th>
                      <th>Face</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.map(rule => {
                      const rk = ruleKey(rule.branch, rule.branchDept);
                      const isFallback = !(rule.branchDept || '').trim();
                      // What this pair resolves to today, stored or inherited.
                      const eff = effectiveRule(rule.branch, rule.branchDept);
                      return (
                      <React.Fragment key={rk}>
                        <tr>
                          <td>
                            <button className="rm-branch-btn" onClick={() => toggleBranchExpand(rule.branch, rule.branchDept)}>
                              <span className={`rm-branch-arrow${expandedKey === rk ? ' rm-arrow-open' : ''}`}>&#9654;</span>
                              {rule.branch}
                            </button>
                          </td>
                          <td>
                            <span className={isFallback ? 'rm-dept-fallback' : 'rm-dept'}>
                              {deptLabel(rule.branchDept)}
                            </span>
                            {!rule.saved && (
                              <span className="rm-dept-inherited" title="No rule of its own yet - following the branch default. Hit the tick to pin it.">
                                inherited
                              </span>
                            )}
                          </td>
                          <td>
                            <label className="rm-toggle">
                              <input type="checkbox"
                                checked={eff.bt}
                                onChange={e => {
                                  const on = e.target.checked;
                                  dirtyKeys.current.add(rk);
                                  // Spread prev[rk], not the render-time `eff`:
                                  // if both toggles on a row fire before the
                                  // next render, `eff` is already stale and
                                  // the second change would undo the first.
                                  setLocalRules(prev => ({
                                    ...prev, [rk]: { ...(prev[rk] ?? eff), bt: on }
                                  }));
                                }} />
                              <span className="rm-slider" />
                            </label>
                          </td>
                          <td>
                            <label className="rm-toggle">
                              <input type="checkbox"
                                checked={eff.gps}
                                onChange={e => {
                                  const on = e.target.checked;
                                  dirtyKeys.current.add(rk);
                                  setLocalRules(prev => ({
                                    ...prev, [rk]: { ...(prev[rk] ?? eff), gps: on }
                                  }));
                                }} />
                              <span className="rm-slider" />
                            </label>
                          </td>
                          <td><span className="rm-always-on">Always ON</span></td>
                          <td>
                            <button className="rm-save-btn" disabled={savingKey === rk} onClick={() => saveBranchRule(rule.branch, rule.branchDept)}>
                              {savingKey === rk ? '…' : '✓'}
                            </button>
                          </td>
                        </tr>
                        {expandedKey === rk && (
                          <tr className="rm-branch-emp-row">
                            <td colSpan={6} style={{ padding: '4px 8px 12px' }}>
                              {branchEmpLoading === rk ? (
                                <p className="rm-empty">Loading…</p>
                              ) : (branchEmpCache[rk] || []).length === 0 ? (
                                <p className="rm-empty">
                                  {isFallback
                                    ? 'No employees in this branch.'
                                    : `No employees in ${rule.branch} / ${rule.branchDept}.`}
                                </p>
                              ) : (
                                <div className="rm-branch-emp-list">
                                  {(branchEmpCache[rk] || []).map(emp => (
                                    <div key={emp.empCode} className="rm-branch-emp-item">
                                      <span className="rm-badge-code">{emp.empCode}</span>
                                      <div>
                                        <div className="rm-emp-name">{emp.empName}</div>
                                        <div className="rm-emp-sub">{emp.designation}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>

                <p className="rm-rule-hint">
                  One row per branch and branch dept. A row marked
                  <span className="rm-dept-inherited">inherited</span>
                  has no rule of its own and is following its branch default -
                  change a toggle and press the tick to give it one.
                </p>
              </div>
            )}

            {/* ════ BRANCH DIRECTORY (tbl_Branch) TAB ════ */}
            {activeTab === 'directory' && (
              <div className="rm-bt-container">
                {/* Summary Metrics */}
                <div className="rm-bt-metrics">
                  <div className="rm-bt-card">
                    <span className="rm-bt-metric-title">Total Pairs (tbl_Branch)</span>
                    <span className="rm-bt-metric-val">{dirRows.length}</span>
                  </div>
                  <div className="rm-bt-card rm-card-active">
                    <span className="rm-bt-metric-title">Unique Branches</span>
                    <span className="rm-bt-metric-val">
                      {new Set(dirRows.map(r => r.branch)).size}
                    </span>
                  </div>
                  <div className="rm-bt-card rm-card-inactive">
                    <span className="rm-bt-metric-title">Unique Departments</span>
                    <span className="rm-bt-metric-val">
                      {new Set(dirRows.map(r => r.branchDept).filter(Boolean)).size}
                    </span>
                  </div>
                </div>

                {/* Toolbar */}
                <div className="rm-bt-toolbar">
                  <div className="rm-bt-search-wrap">
                    <IonIcon icon={search} className="rm-search-icon" />
                    <input
                      type="text"
                      className="rm-bt-search"
                      placeholder="Search branch name, department..."
                      value={dirSearchTerm}
                      onChange={e => setDirSearchTerm(e.target.value)}
                    />
                    {dirSearchTerm && (
                      <button className="rm-clear-search" onClick={() => setDirSearchTerm('')}>
                        <IonIcon icon={close} />
                      </button>
                    )}
                  </div>
                  <select
                    className="rm-select rm-bt-branch-select"
                    value={dirBranchFilter}
                    onChange={e => setDirBranchFilter(e.target.value)}
                  >
                    <option value="">All Branches</option>
                    {allBranches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <button className="rm-bt-add-btn" onClick={openAddDirModal}>
                    + Add Branch / Dept
                  </button>
                </div>

                {/* Directory Table */}
                <div className="rm-card">
                  {dirLoading ? (
                    <div className="rm-loading-text">Loading Branch Directory…</div>
                  ) : (
                    <table className="rm-table">
                      <thead>
                        <tr>
                          <th>LID</th>
                          <th>Branch Name</th>
                          <th>Branch Department</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dirRows
                          .filter(row => {
                            const term = dirSearchTerm.toLowerCase();
                            const matchesSearch =
                              row.branch.toLowerCase().includes(term) ||
                              row.branchDept.toLowerCase().includes(term);
                            const matchesBranch = !dirBranchFilter || row.branch.toLowerCase() === dirBranchFilter.toLowerCase();
                            return matchesSearch && matchesBranch;
                          })
                          .map(row => (
                            <tr key={row.lid}>
                              <td>
                                <span className="rm-mac-badge" style={{ fontFamily: 'monospace' }}>
                                  #{row.lid}
                                </span>
                              </td>
                              <td>
                                <div className="rm-bt-name-cell">
                                  <span className="rm-bt-icon">🏢</span>
                                  <span className="rm-branch-name">{row.branch}</span>
                                </div>
                              </td>
                              <td>
                                <span className={row.branchDept ? 'rm-branch-tag' : 'rm-dept-fallback'}>
                                  {row.branchDept || 'All Departments (Branch Fallback)'}
                                </span>
                              </td>
                              <td>
                                <div className="rm-actions-cell">
                                  <button className="rm-edit-btn" title="Edit" onClick={() => openEditDirModal(row)}>
                                    &#9998; Edit
                                  </button>
                                  <button className="rm-del-btn" title="Delete" onClick={() => setDeletingDir(row)}>
                                    &#x2715;
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        {dirRows.filter(row => {
                          const term = dirSearchTerm.toLowerCase();
                          const matchesSearch =
                            row.branch.toLowerCase().includes(term) ||
                            row.branchDept.toLowerCase().includes(term);
                          const matchesBranch = !dirBranchFilter || row.branch.toLowerCase() === dirBranchFilter.toLowerCase();
                          return matchesSearch && matchesBranch;
                        }).length === 0 && (
                          <tr>
                            <td colSpan={4} className="rm-empty">
                              No Branch Directory rows found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Add / Edit Branch Directory Modal Popup */}
                {isDirModalOpen && (
                  <div className="rm-modal-backdrop" onClick={() => setIsDirModalOpen(false)}>
                    <div className="rm-modal-card" onClick={e => e.stopPropagation()}>
                      <div className="rm-modal-header">
                        <h3>{editingDir ? 'Edit Branch Row' : 'Add New Branch Row (tbl_Branch)'}</h3>
                        <button className="rm-modal-close" onClick={() => setIsDirModalOpen(false)}>&#x2715;</button>
                      </div>
                      <div className="rm-modal-body">
                        <div className="rm-form-group">
                          <label className="rm-date-label">Branch Name *</label>
                          <input
                            type="text"
                            className="rm-input"
                            placeholder="e.g. Vizag / Eluru / Hyderabad"
                            value={dirFormBranch}
                            onChange={e => setDirFormBranch(e.target.value)}
                          />
                        </div>
                        <div className="rm-form-group">
                          <label className="rm-date-label">Branch Department (Optional)</label>
                          <input
                            type="text"
                            className="rm-input"
                            placeholder="e.g. AU / SDE / PRESS / DBS"
                            value={dirFormDept}
                            onChange={e => setDirFormDept(e.target.value)}
                          />
                          <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                            Leave empty for branch-wide default row.
                          </span>
                        </div>
                      </div>
                      <div className="rm-modal-footer">
                        <button className="rm-back-btn" onClick={() => setIsDirModalOpen(false)}>Cancel</button>
                        <button className="rm-next-btn rm-save-main" disabled={dirSaving} onClick={handleSaveBranchDirectory}>
                          {dirSaving ? 'Saving…' : (editingDir ? 'Update Branch' : 'Add Branch')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Delete Confirmation Directory Modal */}
                {deletingDir && (
                  <div className="rm-modal-backdrop" onClick={() => setDeletingDir(null)}>
                    <div className="rm-modal-card rm-confirm-modal" onClick={e => e.stopPropagation()}>
                      <div className="rm-modal-header">
                        <h3>Delete Branch Row?</h3>
                        <button className="rm-modal-close" onClick={() => setDeletingDir(null)}>&#x2715;</button>
                      </div>
                      <div className="rm-modal-body">
                        <p>
                          Are you sure you want to delete <strong>{deletingDir.branch}</strong> {deletingDir.branchDept ? `(${deletingDir.branchDept})` : ''}?
                        </p>
                        <p className="rm-warning-text">
                          Note: Deleting will fail if staff are currently assigned to this branch and department.
                        </p>
                      </div>
                      <div className="rm-modal-footer">
                        <button className="rm-back-btn" onClick={() => setDeletingDir(null)}>Cancel</button>
                        <button className="rm-next-btn rm-btn-danger" onClick={() => handleDeleteBranchDirectory(deletingDir.lid)}>
                          Delete Row
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ════ EMPLOYEE OVERRIDES TAB ════ */}
            {activeTab === 'overrides' && (
              <div className="rm-override-tab">

                {/* ── Wizard ───────────────────────────────────────── */}
                <div className="rm-card rm-wizard">

                  {/* Step dots */}
                  <div className="rm-steps">
                    {stepLabels.map((label, i) => (
                      <div key={i} className={`rm-step${step >= i + 1 ? ' rm-step-done' : ''}`}>
                        <div className="rm-step-dot">{i + 1}</div>
                        <span className="rm-step-label">{label}</span>
                      </div>
                    ))}
                  </div>

                  {/* BRANCH Step 1: Select Branch */}
                  {showBranchSelect && (
                    <div className="rm-step-body">
                      <p className="rm-label">Select Branch</p>
                      <select className="rm-select" value={selBranch} onChange={e => setSelBranch(e.target.value)}>
                        <option value="">-- Select --</option>
                        {allBranches.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                      <button className="rm-next-btn"
                        disabled={!selBranch}
                        onClick={() => { loadBranchEmployees(); setStep(2); }}>
                        Next &#8594;
                      </button>
                    </div>
                  )}

                  {/* Employees step (BRANCH step 2 / MARKETING step 1) */}
                  {showEmployeePicker && (
                    <div className="rm-step-body">
                      <p className="rm-label" style={{ fontWeight: 800 }}>Transfer To :</p>
                      
                      <div className="ntv-form-input-wrapper" ref={triggerRef} onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 14px',
                        borderRadius: '14px',
                        border: '1.5px solid rgba(226, 232, 240, 0.8)',
                        background: '#ffffff',
                        cursor: 'pointer',
                        position: 'relative',
                        marginBottom: '16px'
                      }}>
                        <IonIcon icon={person} style={{ fontSize: '18px', color: '#64748b' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: selIds.length > 0 ? '#0f172a' : '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: '85%' }}>
                          {selIds.length > 0 
                            ? (selIds.length === 1 
                                ? (employees.find(e => e.empCode === selIds[0])?.empName || selIds[0])
                                : `${selIds.length} employees selected: ` + selIds.map(id => employees.find(e => e.empCode === id)?.empName || id).join(', '))
                            : "Select Employee"}
                        </span>

                        {isEmployeeDropdownOpen && createPortal(
                          <>
                            <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsEmployeeDropdownOpen(false); }} />
                            <div
                              className="custom-inline-dropdown"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                top: `${dropdownPos.top}px`,
                                left: `${dropdownPos.left}px`,
                                width: `${dropdownPos.width}px`,
                                border: '1px solid #e2e8f0',
                                background: '#ffffff',
                                borderRadius: '16px',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                                zIndex: 9999
                              }}
                            >
                              <div className="dropdown-search-sec" style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <IonIcon icon={search} className="dropdown-search-icon" style={{ color: '#94a3b8' }} />
                                <input
                                  type="text"
                                  className="dropdown-pure-input"
                                  placeholder="Search name or code..."
                                  value={empSearchTerm}
                                  onChange={(e) => setEmpSearchTerm(e.target.value)}
                                  autoFocus
                                  onMouseDown={(e) => e.stopPropagation()}
                                  style={{ color: '#0f172a' }}
                                />
                                {empSearchTerm && (
                                  <button className="dropdown-clear-btn" onClick={() => setEmpSearchTerm("")}>
                                    <IonIcon icon={close} />
                                  </button>
                                )}
                              </div>

                              {/* Department Filter Section */}
                              <div className="dropdown-depts-sec" style={{
                                padding: '8px 12px',
                                borderBottom: '1px solid #e2e8f0',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '6px',
                                maxHeight: '80px',
                                overflowY: 'auto'
                              }}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedDept("")}
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    border: '1.5px solid ' + (selectedDept === "" ? '#0d9488' : 'rgba(226, 232, 240, 0.8)'),
                                    background: selectedDept === "" ? '#e6f4f1' : '#ffffff',
                                    color: selectedDept === "" ? '#0d9488' : '#64748b',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  All
                                </button>
                                {uniqueDepartments.map(dept => (
                                  <button
                                    key={dept}
                                    type="button"
                                    onClick={() => setSelectedDept(dept)}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: '8px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      border: '1.5px solid ' + (selectedDept === dept ? '#0d9488' : 'rgba(226, 232, 240, 0.8)'),
                                      background: selectedDept === dept ? '#e6f4f1' : '#ffffff',
                                      color: selectedDept === dept ? '#0d9488' : '#64748b',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    {dept}
                                  </button>
                                ))}
                              </div>

                              {/* Select All and Done controls */}
                              {filteredEmployees.length > 0 && (
                                <div style={{
                                  padding: '8px 12px',
                                  borderBottom: '1px solid #e2e8f0',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}>
                                  <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: '#0d9488',
                                    cursor: 'pointer'
                                  }}>
                                    <input
                                      type="checkbox"
                                      checked={filteredEmployees.every(emp => selIds.includes(emp.empCode))}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          const toAdd = filteredEmployees.map(emp => emp.empCode);
                                          setSelIds(prev => Array.from(new Set([...prev, ...toAdd])));
                                        } else {
                                          const toRemove = filteredEmployees.map(emp => emp.empCode);
                                          setSelIds(prev => prev.filter(id => !toRemove.includes(id)));
                                        }
                                      }}
                                      style={{ accentColor: '#0d9488', cursor: 'pointer' }}
                                    />
                                    Select All Filtered
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsEmployeeDropdownOpen(false);
                                      setEmpSearchTerm("");
                                    }}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: '8px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      border: '1.5px solid #0d9488',
                                      background: '#0d9488',
                                      color: '#ffffff',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Done
                                  </button>
                                </div>
                              )}

                              <div className="dropdown-body">
                                {filteredEmployees.map((emp, index) => {
                                  const isSelected = selIds.includes(emp.empCode);
                                  const initials = (emp.empName.charAt(0) || "?").toUpperCase();

                                  return (
                                    <div
                                      key={index}
                                      className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '12px', cursor: 'pointer', background: isSelected ? '#f1f5f9' : 'transparent' }}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleEmp(emp.empCode);
                                      }}
                                    >
                                      <div className={`dr-avatar grad-${(parseInt(emp.empCode) % 5) || 0}`} style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d9488', color: '#ffffff', fontWeight: 800 }}>
                                        {initials}
                                      </div>
                                      <div className="dr-info" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                        <span className="dr-name" style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{emp.empName}</span>
                                        <span className="dr-id" style={{ fontSize: '11px', color: '#64748b' }}>ID: {emp.empCode}</span>
                                      </div>
                                      {isSelected && <IonIcon icon={checkmarkCircle} style={{ color: '#0d9488', fontSize: '16px' }} />}
                                    </div>
                                  );
                                })}
                                {filteredEmployees.length === 0 && (
                                  <div className="dr-no-results" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>
                                    <p>No matches for "{empSearchTerm}"</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </>                             ,
                          document.body
                        )}
                      </div>

                      <div className="rm-nav-row">
                        {empPrevStep !== undefined && (
                          <button className="rm-back-btn" onClick={() => setStep(empPrevStep)}>&#8592; Back</button>
                        )}
                        <button className="rm-next-btn" disabled={selIds.length === 0} onClick={() => setStep(empNextStep)}>Next &#8594;</button>
                      </div>
                    </div>
                  )}

                  {/* Rules step (BRANCH step 3 / MARKETING step 2) */}
                  {showRules && (
                    <div className="rm-step-body">
                      <p className="rm-label">Verification Rules</p>
                      <div className="rm-rule-row">
                        <span>Bluetooth Required</span>
                        <label className="rm-toggle">
                          <input type="checkbox" checked={btOn} onChange={e => setBtOn(e.target.checked)} />
                          <span className="rm-slider" />
                        </label>
                      </div>
                      <div className="rm-rule-row">
                        <span>GPS / Location Required</span>
                        <label className="rm-toggle">
                          <input type="checkbox" checked={gpsOn} onChange={e => setGpsOn(e.target.checked)} />
                          <span className="rm-slider" />
                        </label>
                      </div>
                      <div className="rm-rule-row rm-face-row">
                        <span>Face Recognition</span>
                        <span className="rm-always-on">Always ON</span>
                      </div>
                      <div className="rm-nav-row">
                        <button className="rm-back-btn" onClick={() => setStep(rulesPrevStep)}>&#8592; Back</button>
                        <button className="rm-next-btn" onClick={() => setStep(rulesNextStep)}>Next &#8594;</button>
                      </div>
                    </div>
                  )}

                  {/* Date Range step (BRANCH step 4 / MARKETING step 3) */}
                  {showDateRange && (
                    <div className="rm-step-body">
                      <p className="rm-label">Date Range</p>
                      <div className="rm-date-row">
                        <div>
                          <label className="rm-date-label">From</label>
                          <input type="date" className="rm-date-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div>
                          <label className="rm-date-label">To</label>
                          <input type="date" className="rm-date-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                      </div>
                      <div className="rm-nav-row">
                        <button className="rm-back-btn" onClick={() => setStep(datePrevStep)}>&#8592; Back</button>
                        <button className="rm-next-btn rm-save-main"
                          disabled={!startDate || !endDate || saving}
                          onClick={saveOverrides}>
                          {saving ? 'Saving…' : `Save for ${selIds.length} employee(s)`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Auto Overrides From Approved On-Duties ──── */}
                <div className="rm-card rm-overrides-list">
                  <div className="rm-list-header">
                    <h3>Auto Overrides</h3>
                    <span className="rm-auto-note">from approved on-duties &middot; next 7 days &middot; read-only &middot; a duty split across reporting and non-reporting days shows one line per stretch</span>
                  </div>
                  <table className="rm-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Home Branch</th>
                        <th>On-Duty Branch</th>
                        <th>BT</th>
                        <th>GPS</th>
                        <th>From</th>
                        <th>To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Newest duty first. The rows arrive in whatever order
                          the query produced them, which floated the oldest
                          stretch to the top - and the duty someone just raised
                          is the one they are on this screen to check. The
                          original position is the tie-break, so a duty split
                          into a reporting and a non-reporting stretch still
                          reads first-day-first within its own id. A row whose
                          id will not parse sorts last rather than throwing the
                          comparison off. */}
                      {autoOverrides
                        .map((a, i) => ({ a, i }))
                        .sort((x, y) => {
                          const nx = parseInt(String(x.a.dutyId ?? ''), 10);
                          const ny = parseInt(String(y.a.dutyId ?? ''), 10);
                          const vx = isNaN(nx) ? -1 : nx;
                          const vy = isNaN(ny) ? -1 : ny;
                          if (vx !== vy) return vy - vx;
                          return x.i - y.i;
                        })
                        .map(({ a, i }) => (
                        <tr key={`${a.dutyId}-${a.empId}-${i}`}>
                          <td>
                            <div className="rm-emp-name">
                              {a.empName || a.empId}
                              {/* Without the id on show, sorting by it looks
                                  like no order at all. */}
                              {!!a.dutyId && (
                                <span className="rm-duty-id">#{a.dutyId}</span>
                              )}
                            </div>
                            <div className="rm-emp-sub">{a.designation}</div>
                          </td>
                          <td>{a.homeBranch || <span className="rm-duty-none">&#8212;</span>}</td>
                          <td>
                            <span
                              className="rm-badge-duty"
                              title={a.ruleSource || (a.onDutyAnywhere
                                ? (a.onDutyType || 'On') + ' duty \u2013 punch allowed anywhere'
                                : (a.onDutyType || 'Branch') + ' duty at ' + (a.onDutyBranch || 'branch'))}>
                              {a.onDutyAnywhere ? 'OnDuty' : (a.onDutyBranch || 'OnDuty')}
                            </span>
                          </td>
                          <td title={a.ruleSource || ''}><span className={a.btRequired ? 'rm-badge-on' : 'rm-badge-off'}>{a.btRequired ? 'ON' : 'OFF'}</span></td>
                          <td title={a.ruleSource || ''}><span className={a.gpsRequired ? 'rm-badge-on' : 'rm-badge-off'}>{a.gpsRequired ? 'ON' : 'OFF'}</span></td>
                          <td>{a.startDate}</td>
                          <td>{a.endDate}</td>
                        </tr>
                      ))}
                      {autoOverrides.length === 0 && (
                        <tr>
                          <td colSpan={7} className={autoErr ? 'rm-empty rm-auto-err' : 'rm-empty'}>
                            {autoErr || 'No approved on-duties in the next 7 days.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* ── Active Overrides Table ───────────────────────── */}
                <div className="rm-card rm-overrides-list">
                  <div className="rm-list-header">
                    <h3>Active Overrides</h3>
                  </div>
                  <table className="rm-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Home Branch</th>
                        <th>On-Duty Branch</th>
                        <th>BT</th>
                        <th>GPS</th>
                        <th>From</th>
                        <th>To</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {overrides.map(o => (
                        <tr key={o.id}>
                          <td>
                            <div className="rm-emp-name">{o.empName || o.empId}</div>
                            <div className="rm-emp-sub">{o.designation}</div>
                          </td>
                          <td>{o.liveBranch || o.branch}</td>
                          <td>
                            {o.onDutyAnywhere ? (
                              // No office to name, so the chip says what the
                              // rule is rather than pretending to be a place.
                              <span className="rm-badge-duty" title={o.onDutyType ? o.onDutyType + ' duty - punch allowed anywhere' : 'Punch allowed anywhere'}>OnDuty</span>
                            ) : o.onDutyBranch ? (
                              <span className="rm-badge-duty">{o.onDutyBranch}</span>
                            ) : (
                              <span className="rm-duty-none">&#8212;</span>
                            )}
                          </td>
                          <td><span className={o.btRequired ? 'rm-badge-on' : 'rm-badge-off'}>{o.btRequired ? 'ON' : 'OFF'}</span></td>
                          <td><span className={o.gpsRequired ? 'rm-badge-on' : 'rm-badge-off'}>{o.gpsRequired ? 'ON' : 'OFF'}</span></td>
                          <td>{o.startDate}</td>
                          <td>{o.endDate}</td>
                          <td>
                            <button className="rm-del-btn" onClick={() => deleteOverride(o.id)}>&#x2715;</button>
                          </td>
                        </tr>
                      ))}
                      {overrides.length === 0 && (
                        <tr><td colSpan={8} className="rm-empty">No active overrides.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {/* ════ BLUETOOTH MASTER TAB ════ */}
            {activeTab === 'bluetooth' && (
              <div className="rm-bt-container">
                {/* Summary Metrics */}
                <div className="rm-bt-metrics">
                  <div className="rm-bt-card">
                    <span className="rm-bt-metric-title">Total Devices</span>
                    <span className="rm-bt-metric-val">{btDevices.length}</span>
                  </div>
                  <div className="rm-bt-card rm-card-active">
                    <span className="rm-bt-metric-title">Active Devices</span>
                    <span className="rm-bt-metric-val">{btDevices.filter(d => d.isActive).length}</span>
                  </div>
                  <div className="rm-bt-card rm-card-inactive">
                    <span className="rm-bt-metric-title">Inactive Devices</span>
                    <span className="rm-bt-metric-val">{btDevices.filter(d => !d.isActive).length}</span>
                  </div>
                </div>

                {/* Toolbar */}
                <div className="rm-bt-toolbar">
                  <div className="rm-bt-search-wrap">
                    <IonIcon icon={search} className="rm-search-icon" />
                    <input
                      type="text"
                      className="rm-bt-search"
                      placeholder="Search device name, MAC address..."
                      value={btSearchTerm}
                      onChange={e => setBtSearchTerm(e.target.value)}
                    />
                    {btSearchTerm && (
                      <button className="rm-clear-search" onClick={() => setBtSearchTerm('')}>
                        <IonIcon icon={close} />
                      </button>
                    )}
                  </div>
                  <select
                    className="rm-select rm-bt-branch-select"
                    value={btBranchFilter}
                    onChange={e => setBtBranchFilter(e.target.value)}
                  >
                    <option value="">All Branches</option>
                    {allBranches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <button className="rm-bt-add-btn" onClick={openAddBtModal}>
                    + Add Device
                  </button>
                </div>

                {/* Devices Table */}
                <div className="rm-card">
                  {btLoading ? (
                    <div className="rm-loading-text">Loading Bluetooth devices…</div>
                  ) : (
                    <table className="rm-table">
                      <thead>
                        <tr>
                          <th>Device Name</th>
                          <th>MAC Address</th>
                          <th>Branch / Location</th>
                          <th>Status</th>
                          <th>Active Switch</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {btDevices
                          .filter(dev => {
                            const term = btSearchTerm.toLowerCase();
                            const matchesSearch =
                              dev.deviceName.toLowerCase().includes(term) ||
                              dev.deviceMac.toLowerCase().includes(term) ||
                              dev.branch.toLowerCase().includes(term);
                            const matchesBranch = !btBranchFilter || dev.branch.toLowerCase() === btBranchFilter.toLowerCase();
                            return matchesSearch && matchesBranch;
                          })
                          .map(dev => (
                            <tr key={dev.id}>
                              <td>
                                <div className="rm-bt-name-cell">
                                  <span className="rm-bt-icon">📶</span>
                                  <span className="rm-branch-name">{dev.deviceName}</span>
                                </div>
                              </td>
                              <td>
                                <span className="rm-mac-badge">{dev.deviceMac}</span>
                              </td>
                              <td>
                                <span className={dev.branch ? 'rm-branch-tag' : 'rm-dept-fallback'}>
                                  {dev.branch ? (dev.branchDept ? `${dev.branch} (${dev.branchDept})` : dev.branch) : 'Global / All Branches'}
                                </span>
                              </td>
                              <td>
                                <span className={dev.isActive ? 'rm-badge-on' : 'rm-badge-off'}>
                                  {dev.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td>
                                <label className="rm-toggle">
                                  <input
                                    type="checkbox"
                                    checked={dev.isActive}
                                    onChange={() => handleToggleBtStatus(dev)}
                                  />
                                  <span className="rm-slider" />
                                </label>
                              </td>
                              <td>
                                <div className="rm-actions-cell">
                                  <button className="rm-edit-btn" title="Edit" onClick={() => openEditBtModal(dev)}>
                                    &#9998; Edit
                                  </button>
                                  <button className="rm-del-btn" title="Delete" onClick={() => setDeletingBt(dev)}>
                                    &#x2715;
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        {btDevices.filter(dev => {
                          const term = btSearchTerm.toLowerCase();
                          const matchesSearch =
                            dev.deviceName.toLowerCase().includes(term) ||
                            dev.deviceMac.toLowerCase().includes(term) ||
                            dev.branch.toLowerCase().includes(term);
                          const matchesBranch = !btBranchFilter || dev.branch.toLowerCase() === btBranchFilter.toLowerCase();
                          return matchesSearch && matchesBranch;
                        }).length === 0 && (
                          <tr>
                            <td colSpan={6} className="rm-empty">
                              No Bluetooth devices found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Add / Edit Modal Popup */}
                {isBtModalOpen && (
                  <div className="rm-modal-backdrop" onClick={() => setIsBtModalOpen(false)}>
                    <div className="rm-modal-card" onClick={e => e.stopPropagation()}>
                      <div className="rm-modal-header">
                        <h3>{editingBt ? 'Edit Bluetooth Device' : 'Add New Bluetooth Device'}</h3>
                        <button className="rm-modal-close" onClick={() => setIsBtModalOpen(false)}>&#x2715;</button>
                      </div>
                      <div className="rm-modal-body">
                        <div className="rm-form-group">
                          <label className="rm-date-label">Device Name *</label>
                          <input
                            type="text"
                            className="rm-input"
                            placeholder="e.g. Office Scanner BT-01"
                            value={btFormName}
                            onChange={e => setBtFormName(e.target.value)}
                          />
                        </div>
                        <div className="rm-form-group">
                          <label className="rm-date-label">MAC Address *</label>
                          <input
                            type="text"
                            className="rm-input rm-mac-input"
                            placeholder="e.g. AA:BB:CC:DD:EE:FF"
                            value={btFormMac}
                            onChange={e => setBtFormMac(e.target.value.toUpperCase())}
                          />
                        </div>
                        <div className="rm-form-group">
                          <label className="rm-date-label">Branch / Location (Optional)</label>
                          <select
                            className="rm-select"
                            value={btFormBranch}
                            onChange={e => {
                              setBtFormBranch(e.target.value);
                              setBtFormDept('');
                            }}
                          >
                            <option value="">-- All Branches (Global) --</option>
                            {allBranches.map(b => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </div>
                        <div className="rm-form-group">
                          <label className="rm-date-label">Branch Department (Optional)</label>
                          <select
                            className="rm-select"
                            value={btFormDept}
                            disabled={!btFormBranch}
                            onChange={e => setBtFormDept(e.target.value)}
                          >
                            <option value="">-- All Departments in Branch --</option>
                            {branchDeptPairs
                              .filter(kp => kp.branch.toLowerCase() === btFormBranch.toLowerCase() && kp.branchDept)
                              .map(kp => (
                                <option key={kp.branchDept} value={kp.branchDept}>{kp.branchDept}</option>
                              ))}
                          </select>
                        </div>
                        <div className="rm-form-group rm-form-toggle-row">
                          <label className="rm-date-label" style={{ marginBottom: 0 }}>Is Active</label>
                          <label className="rm-toggle">
                            <input
                              type="checkbox"
                              checked={btFormActive}
                              onChange={e => setBtFormActive(e.target.checked)}
                            />
                            <span className="rm-slider" />
                          </label>
                        </div>
                      </div>
                      <div className="rm-modal-footer">
                        <button className="rm-back-btn" onClick={() => setIsBtModalOpen(false)}>Cancel</button>
                        <button className="rm-next-btn rm-save-main" disabled={btSaving} onClick={handleSaveBtDevice}>
                          {btSaving ? 'Saving…' : (editingBt ? 'Update Device' : 'Add Device')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Delete Confirmation Modal */}
                {deletingBt && (
                  <div className="rm-modal-backdrop" onClick={() => setDeletingBt(null)}>
                    <div className="rm-modal-card rm-confirm-modal" onClick={e => e.stopPropagation()}>
                      <div className="rm-modal-header">
                        <h3>Delete Bluetooth Device?</h3>
                        <button className="rm-modal-close" onClick={() => setDeletingBt(null)}>&#x2715;</button>
                      </div>
                      <div className="rm-modal-body">
                        <p>Are you sure you want to delete <strong>{deletingBt.deviceName}</strong> ({deletingBt.deviceMac})?</p>
                        <p className="rm-warning-text">This action cannot be undone.</p>
                      </div>
                      <div className="rm-modal-footer">
                        <button className="rm-back-btn" onClick={() => setDeletingBt(null)}>Cancel</button>
                        <button className="rm-next-btn rm-btn-danger" onClick={() => handleDeleteBtDevice(deletingBt.id)}>
                          Delete Device
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ════ GPS & LOCATIONS TAB ════ */}
            {activeTab === 'locations' && (
              <div className="rm-bt-container">
                {/* Summary Metrics */}
                <div className="rm-bt-metrics">
                  <div className="rm-bt-card">
                    <span className="rm-bt-metric-title">Total Locations</span>
                    <span className="rm-bt-metric-val">{officeLocations.length}</span>
                  </div>
                  <div className="rm-bt-card rm-card-active">
                    <span className="rm-bt-metric-title">Active Locations</span>
                    <span className="rm-bt-metric-val">{officeLocations.filter(d => d.isActive).length}</span>
                  </div>
                  <div className="rm-bt-card rm-card-inactive">
                    <span className="rm-bt-metric-title">Inactive Locations</span>
                    <span className="rm-bt-metric-val">{officeLocations.filter(d => !d.isActive).length}</span>
                  </div>
                </div>

                {/* Toolbar */}
                <div className="rm-bt-toolbar">
                  <div className="rm-bt-search-wrap">
                    <IonIcon icon={search} className="rm-search-icon" />
                    <input
                      type="text"
                      className="rm-bt-search"
                      placeholder="Search office name, branch..."
                      value={locSearchTerm}
                      onChange={e => setLocSearchTerm(e.target.value)}
                    />
                    {locSearchTerm && (
                      <button className="rm-clear-search" onClick={() => setLocSearchTerm('')}>
                        <IonIcon icon={close} />
                      </button>
                    )}
                  </div>
                  <select
                    className="rm-select rm-bt-branch-select"
                    value={locBranchFilter}
                    onChange={e => setLocBranchFilter(e.target.value)}
                  >
                    <option value="">All Branches</option>
                    {allBranches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <button className="rm-bt-add-btn" onClick={openAddLocModal}>
                    + Add Location
                  </button>
                </div>

                {/* Locations Table */}
                <div className="rm-card">
                  {locLoading ? (
                    <div className="rm-loading-text">Loading Office Locations…</div>
                  ) : (
                    <table className="rm-table">
                      <thead>
                        <tr>
                          <th>Office Name</th>
                          <th>Branch</th>
                          <th>Coordinates (Lat, Lng)</th>
                          <th>Radius</th>
                          <th>Status</th>
                          <th>Active Switch</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {officeLocations
                          .filter(loc => {
                            const term = locSearchTerm.toLowerCase();
                            const matchesSearch =
                              loc.officeName.toLowerCase().includes(term) ||
                              loc.branch.toLowerCase().includes(term);
                            const matchesBranch = !locBranchFilter || loc.branch.toLowerCase() === locBranchFilter.toLowerCase();
                            return matchesSearch && matchesBranch;
                          })
                          .map(loc => (
                            <tr key={loc.id}>
                              <td>
                                <div className="rm-bt-name-cell">
                                  <span className="rm-bt-icon">📍</span>
                                  <span className="rm-branch-name">{loc.officeName}</span>
                                </div>
                              </td>
                              <td>
                                <span className={loc.branch ? 'rm-branch-tag' : 'rm-dept-fallback'}>
                                  {loc.branch ? (loc.branchDept ? `${loc.branch} (${loc.branchDept})` : loc.branch) : 'Global / All Branches'}
                                </span>
                              </td>
                              <td>
                                <div className="rm-loc-coords-wrap">
                                  <span className="rm-mac-badge rm-loc-badge">
                                    {loc.latitude1.toFixed(5)}, {loc.longitude1.toFixed(5)}
                                  </span>
                                  {(loc.latitude2 !== 0 || loc.longitude2 !== 0) && (
                                    <span className="rm-mac-badge rm-loc-badge-sub" title="Box Limit (Lat 2, Lng 2)">
                                      Box: {loc.latitude2.toFixed(5)}, {loc.longitude2.toFixed(5)}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span className="rm-radius-badge">
                                  {loc.allowedRadiusMeters || 100} m
                                </span>
                              </td>
                              <td>
                                <span className={loc.isActive ? 'rm-badge-on' : 'rm-badge-off'}>
                                  {loc.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td>
                                <label className="rm-toggle">
                                  <input
                                    type="checkbox"
                                    checked={loc.isActive}
                                    onChange={() => handleToggleLocStatus(loc)}
                                  />
                                  <span className="rm-slider" />
                                </label>
                              </td>
                              <td>
                                <div className="rm-actions-cell">
                                  <button className="rm-edit-btn" title="Edit" onClick={() => openEditLocModal(loc)}>
                                    &#9998; Edit
                                  </button>
                                  <button className="rm-del-btn" title="Delete" onClick={() => setDeletingLoc(loc)}>
                                    &#x2715;
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        {officeLocations.filter(loc => {
                          const term = locSearchTerm.toLowerCase();
                          const matchesSearch =
                            loc.officeName.toLowerCase().includes(term) ||
                            loc.branch.toLowerCase().includes(term);
                          const matchesBranch = !locBranchFilter || loc.branch.toLowerCase() === locBranchFilter.toLowerCase();
                          return matchesSearch && matchesBranch;
                        }).length === 0 && (
                          <tr>
                            <td colSpan={7} className="rm-empty">
                              No Office Locations found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Add / Edit Location Modal Popup */}
                {isLocModalOpen && (
                  <div className="rm-modal-backdrop" onClick={() => setIsLocModalOpen(false)}>
                    <div className="rm-modal-card rm-modal-large" onClick={e => e.stopPropagation()}>
                      <div className="rm-modal-header">
                        <h3>{editingLoc ? 'Edit Office Location' : 'Add New Office Location'}</h3>
                        <button className="rm-modal-close" onClick={() => setIsLocModalOpen(false)}>&#x2715;</button>
                      </div>
                      <div className="rm-modal-body">
                        <div className="rm-form-group">
                          <label className="rm-date-label">Office Name *</label>
                          <input
                            type="text"
                            className="rm-input"
                            placeholder="e.g. Head Office / Vizag Branch"
                            value={locFormName}
                            onChange={e => setLocFormName(e.target.value)}
                          />
                        </div>
                        <div className="rm-form-group">
                          <label className="rm-date-label">Branch / Location (Optional)</label>
                          <select
                            className="rm-select"
                            value={locFormBranch}
                            onChange={e => {
                              setLocFormBranch(e.target.value);
                              setLocFormDept('');
                            }}
                          >
                            <option value="">-- All Branches (Global) --</option>
                            {allBranches.map(b => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </div>
                        <div className="rm-form-group">
                          <label className="rm-date-label">Branch Department (Optional)</label>
                          <select
                            className="rm-select"
                            value={locFormDept}
                            disabled={!locFormBranch}
                            onChange={e => setLocFormDept(e.target.value)}
                          >
                            <option value="">-- All Departments in Branch --</option>
                            {branchDeptPairs
                              .filter(kp => kp.branch.toLowerCase() === locFormBranch.toLowerCase() && kp.branchDept)
                              .map(kp => (
                                <option key={kp.branchDept} value={kp.branchDept}>{kp.branchDept}</option>
                              ))}
                          </select>
                        </div>
                        <div className="rm-form-row-2">
                          <div className="rm-form-group">
                            <label className="rm-date-label">Latitude 1 (Center) *</label>
                            <input
                              type="number"
                              step="any"
                              className="rm-input"
                              placeholder="e.g. 17.68681"
                              value={locFormLat1}
                              onChange={e => setLocFormLat1(e.target.value)}
                            />
                          </div>
                          <div className="rm-form-group">
                            <label className="rm-date-label">Longitude 1 (Center) *</label>
                            <input
                              type="number"
                              step="any"
                              className="rm-input"
                              placeholder="e.g. 83.21848"
                              value={locFormLng1}
                              onChange={e => setLocFormLng1(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="rm-form-row-2">
                          <div className="rm-form-group">
                            <label className="rm-date-label">Latitude 2 (Optional Box)</label>
                            <input
                              type="number"
                              step="any"
                              className="rm-input"
                              placeholder="e.g. 17.68700"
                              value={locFormLat2}
                              onChange={e => setLocFormLat2(e.target.value)}
                            />
                          </div>
                          <div className="rm-form-group">
                            <label className="rm-date-label">Longitude 2 (Optional Box)</label>
                            <input
                              type="number"
                              step="any"
                              className="rm-input"
                              placeholder="e.g. 83.21900"
                              value={locFormLng2}
                              onChange={e => setLocFormLng2(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="rm-form-group">
                          <label className="rm-date-label">Allowed Radius (Meters)</label>
                          <input
                            type="number"
                            className="rm-input"
                            placeholder="e.g. 100"
                            value={locFormRadius}
                            onChange={e => setLocFormRadius(parseInt(e.target.value) || 100)}
                          />
                        </div>
                        <div className="rm-form-group rm-form-toggle-row">
                          <label className="rm-date-label" style={{ marginBottom: 0 }}>Is Active</label>
                          <label className="rm-toggle">
                            <input
                              type="checkbox"
                              checked={locFormActive}
                              onChange={e => setLocFormActive(e.target.checked)}
                            />
                            <span className="rm-slider" />
                          </label>
                        </div>
                      </div>
                      <div className="rm-modal-footer">
                        <button className="rm-back-btn" onClick={() => setIsLocModalOpen(false)}>Cancel</button>
                        <button className="rm-next-btn rm-save-main" disabled={locSaving} onClick={handleSaveOfficeLocation}>
                          {locSaving ? 'Saving…' : (editingLoc ? 'Update Location' : 'Add Location')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Delete Confirmation Location Modal */}
                {deletingLoc && (
                  <div className="rm-modal-backdrop" onClick={() => setDeletingLoc(null)}>
                    <div className="rm-modal-card rm-confirm-modal" onClick={e => e.stopPropagation()}>
                      <div className="rm-modal-header">
                        <h3>Delete Office Location?</h3>
                        <button className="rm-modal-close" onClick={() => setDeletingLoc(null)}>&#x2715;</button>
                      </div>
                      <div className="rm-modal-body">
                        <p>Are you sure you want to delete <strong>{deletingLoc.officeName}</strong>?</p>
                        <p className="rm-warning-text">This action cannot be undone.</p>
                      </div>
                      <div className="rm-modal-footer">
                        <button className="rm-back-btn" onClick={() => setDeletingLoc(null)}>Cancel</button>
                        <button className="rm-next-btn rm-btn-danger" onClick={() => handleDeleteOfficeLocation(deletingLoc.id)}>
                          Delete Location
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AIAttendanceRuleMaster;
