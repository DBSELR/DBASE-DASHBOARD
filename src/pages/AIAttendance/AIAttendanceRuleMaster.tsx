import React, { useState, useEffect, useCallback, useRef } from 'react';
import { IonPage, IonContent, IonIcon } from '@ionic/react';
import { createPortal } from 'react-dom';
import { useHistory } from 'react-router-dom';
import { person, search, close, checkmarkCircle } from 'ionicons/icons';
import { API_BASE } from '../../config';
import './AIAttendanceRuleMaster.css';

const API_KEY = 'dbase-ai-master-key-2026';
const hdrs = { 'Content-Type': 'application/json', 'x-api-key': API_KEY };

// Today's calendar date as YYYY-MM-DD, read off the browser's own local
// clock - the same thing a native <input type="date"> uses to decide what
// "today" is, so the default can never land on a different day than the
// picker itself would show. (An earlier version of this derived "today" by
// hand-shifting UTC for IST; on at least one machine that produced a date
// one day behind the picker, which is exactly backwards for a field whose
// whole point is showing today by default - this reads the same clock the
// input already trusts instead of re-deriving it.)
const todayLocalStr = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// YYYY-MM-DD (what the input and the API both use) -> dd-mm-yyyy (what gets
// displayed). The native date input's own on-screen format follows the
// browser/OS locale and cannot be forced from markup, which is exactly the
// ambiguity this screen should not have - so the input stays hidden and
// this formats the label shown in its place.
const formatDDMMYYYY = (iso: string): string => {
  const [y, m, d] = (iso || '').split('-');
  if (!y || !m || !d) return iso || '';
  return `${d}-${m}-${y}`;
};

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
  // Whether the geofence is actually narrowed to the duty's branch, which is
  // a different question from whether it is switched on.  Undefined on an API
  // build that predates the field, and then the row reads as it always did.
  geofenceLimited?: boolean;
  startDate: string;
  endDate: string;
  // The duty's own expected start-of-day time ("09:00"), shown next to the
  // From date. Empty on an API build that predates the field, or on a duty
  // whose start time was never recorded - both read the same as "unknown",
  // not as midnight. There is no matching end-of-day field: the schema has
  // no real end-time column to read one from (see CheckinController.cs),
  // so To stays date-only rather than showing a fabricated time.
  startTime?: string;
  // "Round Trip" or "Daily Shuttle" - decides how Live Location below is
  // scoped: one camp per reporting day for a shuttle, one camp for the
  // whole duty for a round trip. Empty on an API build that predates the
  // field.
  tripType?: string;
  // Whether this employee currently has a live Camp tracking session open
  // (Start Camp / End Camp, either tapped by hand or auto-triggered by an
  // odometer reading upload). Undefined on an API build that predates the
  // field, and then the cell reads as unknown rather than No.
  liveLocation?: boolean;
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
  const [activeTab, setActiveTab] = useState<'branches' | 'directory' | 'overrides' | 'bluetooth' | 'locations' | 'docs'>('branches');
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
  // The Auto Overrides window, replacing the old fixed "next 7 days" - both
  // default to today, so opening the tab shows today's overrides until
  // someone deliberately widens the range.
  const [autoFrom, setAutoFrom] = useState<string>(todayLocalStr());
  const [autoTo, setAutoTo] = useState<string>(todayLocalStr());
  const [autoEmpSearch, setAutoEmpSearch] = useState<string>('');
  // The two native date inputs stay hidden - see formatDDMMYYYY above for
  // why - and are opened through these refs by clicking the dd-mm-yyyy
  // label in their place.
  const autoFromInputRef = useRef<HTMLInputElement>(null);
  const autoToInputRef = useRef<HTMLInputElement>(null);

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
  const loadAutoOverrides = useCallback(async (from: string, to: string) => {
    if (!from || !to) return;
    try {
      const r = await fetch(
        API_BASE + `Checkin/GetOnDutyAutoOverrides?from=${from}&to=${to}`,
        { headers: hdrs }
      );
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
    loadAutoOverrides(autoFrom, autoTo);
  }, [activeTab, autoFrom, autoTo, loadAutoOverrides]);
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
            <button className={`rm-tab${activeTab === 'docs' ? ' rm-tab-active' : ''}`} onClick={() => setActiveTab('docs')}>
              ⚡ Rules &amp; Architecture
            </button>
            <button className="rm-tab" style={{ background: '#0284c7', color: '#ffffff', fontWeight: 700 }} onClick={() => history.push('/policy-master')}>
              📋 Policy Master ↗
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


                {/* ── Auto Overrides From Approved On-Duties ──── */}
                <div className="rm-card rm-overrides-list">
                  <div className="rm-list-header">
                    <h3>Auto Overrides</h3>
                    <span className="rm-auto-note">from approved on-duties &middot; read-only &middot; a duty split across reporting and non-reporting days shows one line per stretch</span>
                  </div>

                  {/* Replaces the old fixed "next 7 days" window: the range
                      is now whatever is picked here, defaulting to today on
                      the way in. */}
                  <div className="rm-auto-toolbar">
                    <div className="rm-date-row">
                      {/* The real <input type="date"> is hidden and only ever
                          opened via showPicker() - its own on-screen text
                          follows whatever locale the browser/OS is set to
                          (mm-dd-yyyy, dd-mm-yyyy, ...), which is exactly the
                          ambiguity that prompted this. The label shown here
                          is always dd-mm-yyyy, unambiguous no matter what
                          machine this runs on. */}
                      <div>
                        <label className="rm-date-label">From</label>
                        <div className="rm-date-field">
                          <div
                            className="rm-date-display"
                            onClick={() => autoFromInputRef.current?.showPicker?.()}
                          >
                            {formatDDMMYYYY(autoFrom) || 'dd-mm-yyyy'}
                          </div>
                          <input
                            ref={autoFromInputRef}
                            type="date"
                            className="rm-date-input rm-date-input-hidden"
                            value={autoFrom}
                            max={autoTo || undefined}
                            onChange={e => e.target.value && setAutoFrom(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="rm-date-label">To</label>
                        <div className="rm-date-field">
                          <div
                            className="rm-date-display"
                            onClick={() => autoToInputRef.current?.showPicker?.()}
                          >
                            {formatDDMMYYYY(autoTo) || 'dd-mm-yyyy'}
                          </div>
                          <input
                            ref={autoToInputRef}
                            type="date"
                            className="rm-date-input rm-date-input-hidden"
                            value={autoTo}
                            min={autoFrom || undefined}
                            onChange={e => e.target.value && setAutoTo(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="rm-bt-search-wrap">
                      <IonIcon icon={search} className="rm-search-icon" />
                      <input
                        type="text"
                        className="rm-bt-search"
                        placeholder="Search employee name or code..."
                        value={autoEmpSearch}
                        onChange={e => setAutoEmpSearch(e.target.value)}
                      />
                      {autoEmpSearch && (
                        <button className="rm-clear-search" onClick={() => setAutoEmpSearch('')}>
                          <IonIcon icon={close} />
                        </button>
                      )}
                    </div>
                  </div>

                  <table className="rm-table">
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Employee Code</th>
                        <th>Employee</th>
                        <th>Home Branch</th>
                        <th>On-Duty Branch</th>
                        <th>BT</th>
                        <th>GPS</th>
                        <th>Live Location</th>
                        <th>From</th>
                        <th>To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Ordered by employee code, ascending. Numeric compare when
                          both codes parse as numbers (the normal case, e.g. "1501"),
                          else a plain string compare so a non-numeric code still
                          sorts predictably instead of colliding at one shared
                          fallback value. Original position is still the tie-break
                          for two rows sharing the same code (a duty split across a
                          reporting and non-reporting stretch), so that pair keeps
                          reading first-day-first within itself. */}
                      {autoOverrides
                        .filter(a => {
                          const q = autoEmpSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (a.empName || '').toLowerCase().includes(q)
                              || (a.empId   || '').toLowerCase().includes(q);
                        })
                        .map((a, i) => ({ a, i }))
                        .sort((x, y) => {
                          const cx = String(x.a.empId ?? '');
                          const cy = String(y.a.empId ?? '');
                          const nx = parseInt(cx, 10);
                          const ny = parseInt(cy, 10);
                          if (!isNaN(nx) && !isNaN(ny) && nx !== ny) return nx - ny;
                          if (isNaN(nx) !== isNaN(ny)) return isNaN(nx) ? 1 : -1;
                          const byCode = cx.localeCompare(cy);
                          if (byCode !== 0) return byCode;
                          return x.i - y.i;
                        })
                        .map(({ a, i }, idx) => (
                        <tr key={`${a.dutyId}-${a.empId}-${i}`}>
                          <td className="rm-emp-code">{idx + 1}</td>
                          <td className="rm-emp-code">{a.empId || <span className="rm-duty-none">&#8212;</span>}</td>
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
                          {/* GPS ON is not the same as GPS holding them to
                              the right building.  With no office row tagged
                              for the duty's branch the check cannot be
                              narrowed, so it stays switched on and the HOME
                              branch keeps matching - the duty says Vijayawada
                              and the punch is accepted in Eluru.  That was
                              only ever said in the tooltip; it is the row's
                              most important fact, so it is now on the badge. */}
                          <td title={a.ruleSource || ''}>
                            {a.gpsRequired && a.geofenceLimited === false ? (
                              <span className="rm-badge-warn">ON &#8226; NOT LIMITED</span>
                            ) : (
                              <span className={a.gpsRequired ? 'rm-badge-on' : 'rm-badge-off'}>
                                {a.gpsRequired ? 'ON' : 'OFF'}
                              </span>
                            )}
                          </td>
                          {/* Live Location tracks the Camp, not the duty -
                              it reads Yes only while a Camp tracking session
                              is actually open for this employee (Start Camp
                              tapped or auto-triggered by an odometer start
                              reading), and No once it has ended or was never
                              started. Undefined (an older API build) shows a
                              dash rather than guessing either way. */}
                          <td title={a.tripType ? `Camp scope: ${a.tripType}` : ''}>
                            {a.liveLocation === undefined ? (
                              <span className="rm-duty-none">&#8212;</span>
                            ) : (
                              <span className={a.liveLocation ? 'rm-badge-on' : 'rm-badge-off'}>
                                {a.liveLocation ? 'Yes' : 'No'}
                              </span>
                            )}
                          </td>
                          <td>
                            {formatDDMMYYYY(a.startDate)}
                            {a.startTime && <span className="rm-time-note"> {a.startTime}</span>}
                          </td>
                          <td>{formatDDMMYYYY(a.endDate)}</td>
                        </tr>
                      ))}
                      {autoOverrides.filter(a => {
                          const q = autoEmpSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (a.empName || '').toLowerCase().includes(q)
                              || (a.empId   || '').toLowerCase().includes(q);
                        }).length === 0 && (
                        <tr>
                          <td colSpan={10} className={autoErr ? 'rm-empty rm-auto-err' : 'rm-empty'}>
                            {autoErr || (autoEmpSearch.trim()
                              ? `No approved on-duties match "${autoEmpSearch.trim()}" in the selected range.`
                              : 'No approved on-duties in the selected date range.')}
                          </td>
                        </tr>
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

            {/* ════ RULES & ARCHITECTURE DOCS TAB ════ */}
            {activeTab === 'docs' && (
              <AIAttendanceRulesDocView />
            )}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

/* ── RULES & ARCHITECTURE INTERACTIVE DOCUMENTATION VIEW ───────────────── */
const AIAttendanceRulesDocView: React.FC = () => {
  const [subNav, setSubNav] = useState<'arch' | 'db' | 'backend' | 'frontend' | 'scenarios'>('arch');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('normal_ontime');

  const DB_TABLES = [
    { name: 'tbl_AttendancePolicyMaster', purpose: 'Central Face Attendance Policy configurations: 21 active parameters controlling monthly free graces (4), max grace min (15m), max permission sessions (6), total occasions cap (10), lunch duration (60m auto), evening out (18:33), role quotas (P_Time: 60/90/240m), excess Double LOP, and yellow slip triggers.' },
    { name: 'tbl_employee', purpose: 'Employee master data: EmpCode, InTime (dynamic profile reporting time: e.g. 09:00, 09:30, 10:00), Location1 (Branch), BranchDept, P_Time (monthly permission allowance minutes synchronized from Policy Master).' },
    { name: 'AI_ModelStore', purpose: 'Face embeddings: Emp_ID, Emp_Name, FaceEmbedding (128-d float JSON vector array).' },
    { name: 'face_Attendance', purpose: 'Daily attendance logs holding 6 slots: Morning_In, Lunch_Out, Lunch_In, Evening_Out, Permission_Out, Permission_In, LogDate, LateMinutes, GraceType, AttendanceStatus, LOPMinutes, Geolocation, Bluetooth verification.' },
    { name: 'Tbl_BluetoothMaster', purpose: 'Registered EasyReach Bluetooth Beacons: DeviceMac, DeviceName, Branch, BranchDept, IsActive.' },
    { name: 'Tbl_OfficeLocationMaster', purpose: 'Office Geofences: OfficeName, Branch, BranchDept, Latitude1, Longitude1, Latitude2, Longitude2, AllowedRadiusMeters, IsActive.' },
    { name: 'AI_AttendanceEmployeeOverride', purpose: 'Per-employee overrides: Emp_ID, BT_Required, GPS_Required, StartDate, EndDate, RuleType, IsActive.' },
    { name: 'AI_AttendanceBranchRule', purpose: 'Branch/Dept rules: Branch, BranchDept, BT_Required, GPS_Required.' },
    { name: 'tbl_leaves', purpose: 'Permission/Leave requests: EmpCode, LTYPE ("Permission"), L_STATUS ("Approved","Accepted","In-Use"), PTime, LFrom.' },
    { name: 'tbl_onduty', purpose: 'Outdoor / On-Duty records: EMPCODE, ON_DUTY_TYPE ("Party Duty","Official Duty","Client Site"), BRANCH, STATUS ("Approved").' },
    { name: 'tbl_LateAttendanceAudit', purpose: 'Tracks used monthly free grace counts and permission adjustments: EmpCode, LogDate, GraceType = "FREE_GRACE" / "PERMISSION".' },
    { name: 'tbl_overtime', purpose: 'Overtime permission credits: EmpCode, OT_TYPE = "PER", OT_MIN, STATUS = "Approved".' },
  ];

  const SCENARIOS = [
    {
      id: 'normal_ontime',
      name: 'Normal On-Time (Dynamic In-Time)',
      presence: 'BT + GPS / GPS',
      status: 'Morning In / Present',
      logic: 'LogTime <= ReportingTime from employee profile in tbl_employee.InTime (e.g. 09:00, 09:30, 10:00). Late = 0 min. No grace or permission deducted.',
      graceType: 'None',
      lateMin: 0,
      permBalanceDeduction: 0,
      freeGracesLeft: '4 / 4',
      backendCode: 'LogTime <= tbl_employee.InTime -> Status = "Present", GraceType = NULL',
    },
    {
      id: 'late_grace_avail',
      name: 'Late <= 15 Min (Free Grace Available < 4)',
      presence: 'BT + GPS / GPS',
      status: 'Morning In / Grace',
      logic: 'LateMinutes <= 15 AND FreeGraceUsed < 4 AND TotalLateOccasions < 10. Consumes 1 of 4 monthly FREE_GRACE allocations (Morning In only).',
      graceType: 'FREE_GRACE',
      lateMin: 12,
      permBalanceDeduction: 0,
      freeGracesLeft: '3 / 4',
      backendCode: 'LateMinutes <= 15 && FreeGraceUsed < 4 -> Status = "Grace", GraceType = "FREE_GRACE"',
    },
    {
      id: 'late_grace_exhausted',
      name: 'Late <= 15 Min (Graces Exhausted >= 4)',
      presence: 'BT + GPS / GPS',
      status: 'Morning In / Permission Adjusted',
      logic: 'Free graces used up (4/4). Automatically adjusts from monthly allotted P_Time balance (Session 1 of 6). Tracked towards 10-occasion monthly cap.',
      graceType: 'PERMISSION',
      lateMin: 14,
      permBalanceDeduction: 14,
      freeGracesLeft: '0 / 4',
      backendCode: 'PermSessions < 6 && PermissionBalance >= LateMinutes -> Status = "Permission Adjusted", GraceType = "PERMISSION"',
    },
    {
      id: 'late_over_15_perm_avail',
      name: 'Late > 15 Min (Permission Balance Available)',
      presence: 'BT + GPS / GPS',
      status: 'Morning In / Permission Adjusted',
      logic: 'Late exceeds 15 mins. Free grace ineligible. Deducts full late minutes from allotted P_Time balance (up to 6 sessions / month). Auto-creates permission in tbl_leaves.',
      graceType: 'PERMISSION',
      lateMin: 35,
      permBalanceDeduction: 35,
      freeGracesLeft: 'Unchanged',
      backendCode: 'PermSessions < 6 && PermissionBalance >= LateMinutes -> Auto-executes APP_Save_EMP_LeaveRequest',
    },
    {
      id: 'late_over_15_no_perm',
      name: 'Late > 15 Min (Zero Permission Balance)',
      presence: 'BT + GPS / GPS',
      status: 'Morning In / LOP + Yellow Slip',
      logic: 'Late arrival when Permission Balance is 0. Converted to Loss of Pay (LOP) + 1 Yellow Slip. Full late time including the 60 min grace is treated as LOP.',
      graceType: 'LOP',
      lateMin: 45,
      permBalanceDeduction: 0,
      freeGracesLeft: 'Unchanged',
      backendCode: 'PermissionBalance <= 0 -> Status = "LOP", LOPMinutes = LateMinutes, Issue Yellow Slip',
    },
    {
      id: 'exceed_10_occasions',
      name: 'Exceeding 10 Late Occasions Cap',
      presence: 'BT + GPS / GPS',
      status: 'Morning In / LOP + Yellow Slip',
      logic: 'Employee exceeds total 10 late occasions in a calendar month (4 free graces + 6 permissions). Permission adjustments are blocked even if balance remains. Entire late time converts to LOP + 1 Yellow Slip.',
      graceType: 'LOP',
      lateMin: 22,
      permBalanceDeduction: 0,
      freeGracesLeft: '0 / 4',
      backendCode: 'TotalLateOccasions >= 10 -> LOPMinutes = LateMinutes + 60, Trigger +1 Yellow Slip',
    },
    {
      id: 'lunch_late_auto_1hr',
      name: 'Lunch In (1-Hour Auto Window)',
      presence: 'BT + GPS / GPS',
      status: 'Lunch In / Permission or LOP',
      logic: 'Official window 1:30 PM to 2:30 PM. If Lunch Out logged at 2 PM, 3 PM, etc., system auto-allocates exactly 1 hour (60m) break from actual Lunch Out. No free grace in afternoon; arrival after 1 hour auto-deducts from P_Time balance or LOP.',
      graceType: 'PERMISSION / LOP',
      lateMin: 20,
      permBalanceDeduction: 20,
      freeGracesLeft: 'Unchanged',
      backendCode: 'ExpectedLunchIn = DATEADD(minute, 60, Lunch_Out) -> LunchLateMinutes > 0 deducts from P_Time/LOP',
    },
    {
      id: 'excess_double_lop',
      name: 'Excess Permission > 2 Hours (Double LOP)',
      presence: 'BT + GPS / GPS',
      status: 'Excess Permission / Double LOP',
      logic: 'Excess permission usage exceeding 2 hours (120 min) without available balance attracts Double Loss of Pay (2x LOP) including allotted time in total deduction. +1 Yellow Slip for every 3 excess sessions.',
      graceType: 'DOUBLE_LOP',
      lateMin: 140,
      permBalanceDeduction: 'Allotted + 2x Excess',
      freeGracesLeft: 'Unchanged',
      backendCode: 'ExcessMinutes > 120 -> LOPMinutes = (Allotted + ExcessMinutes) * 2',
    },
    {
      id: 'permission_approved',
      name: 'Permission Out / In (Approved)',
      presence: 'Verified',
      status: 'Permission Out / Permission In',
      logic: 'Checks tbl_leaves for approved permission today. Max single session = 60 minutes. Records Permission_Out. On Permission_In, calculates actual duration Perm_Actual_Min and overstay.',
      graceType: 'PERMISSION',
      lateMin: 0,
      permBalanceDeduction: 'Approved PTime (Max 60m)',
      freeGracesLeft: 'Unchanged',
      backendCode: 'Perm_Actual_Min = DATEDIFF(MINUTE, Permission_Out, Permission_In)',
    },
    {
      id: 'permission_unapproved',
      name: 'Permission Out / In (No Approval)',
      presence: 'Blocked',
      status: 'Rejected (Error)',
      logic: 'No record in tbl_leaves with status Approved/Accepted/In-Use today. Rejects scan automatically.',
      graceType: 'REJECTED',
      lateMin: 0,
      permBalanceDeduction: 0,
      freeGracesLeft: 'Unchanged',
      backendCode: 'SELECT TOP 1 LID FROM tbl_leaves WHERE Status IN ("Approved","Accepted","In-Use") == NULL -> Blocked',
    },
    {
      id: 'onduty_party',
      name: 'On-Duty (Party / Client / Official)',
      presence: 'Face Match Only',
      status: 'Any Slot Allowed',
      logic: 'Approved On-Duty with anywhere status. BT_Required and GPS_Required are set to FALSE. Face recognition alone validates punch. Geolocation saved for audit.',
      graceType: 'ON_DUTY',
      lateMin: 0,
      permBalanceDeduction: 0,
      freeGracesLeft: 'Unchanged',
      backendCode: 'duty.Anywhere == true -> btRequired = false, gpsRequired = false',
    },
    {
      id: 'onduty_branch_visit',
      name: 'On-Duty (Visited Branch)',
      presence: 'Visited Branch Rules',
      status: 'Any Slot Allowed',
      logic: 'Employee approved to visit another office branch. Inherits geofence and beacons of visited branch instead of home branch to prevent false rejection.',
      graceType: 'ON_DUTY',
      lateMin: 0,
      permBalanceDeduction: 0,
      freeGracesLeft: 'Unchanged',
      backendCode: 'GetBranchRuleCached(dutyBranch) -> Replaces home branch rule with target office rule',
    },
    {
      id: 'no_beacon_waiver',
      name: 'No Beacon in Office',
      presence: 'GPS Geofence Only',
      status: 'Verified (GPS)',
      logic: 'Rule demands Bluetooth, but physical office has zero registered Bluetooth beacons in Tbl_BluetoothMaster. Automatically waives Bluetooth requirement to GPS-only.',
      graceType: 'BEACON_WAIVER',
      lateMin: 0,
      permBalanceDeduction: 0,
      freeGracesLeft: 'Unchanged',
      backendCode: 'OfficeHasNoBeaconAsync(officeName) == true -> btRequired = false',
    },
  ];

  const currentScenario = SCENARIOS.find(s => s.id === selectedScenarioId) || SCENARIOS[0];

  return (
    <div className="rm-docs-container">
      {/* Hero Card */}
      <div className="rm-docs-hero">
        <h2 className="rm-docs-hero-title">
          <span>⚡</span> AIAttendance Architecture &amp; System Rules
        </h2>
        <p className="rm-docs-hero-desc">
          Complete end-to-end technical reference covering Database Schema, Policy Master parameters (<code>tbl_AttendancePolicyMaster</code>), Stored Procedure logic (<code>APP_AI_SaveAttendance</code>), Backend API Rules (<code>CheckinController.cs</code>), Frontend Architecture, and Case Matrix.
        </p>
      </div>

      {/* Sub-Navigation */}
      <div className="rm-docs-subnav">
        <button className={`rm-docs-subbtn ${subNav === 'arch' ? 'rm-docs-subbtn-active' : ''}`} onClick={() => setSubNav('arch')}>
          🏗️ Architecture Flow
        </button>
        <button className={`rm-docs-subbtn ${subNav === 'db' ? 'rm-docs-subbtn-active' : ''}`} onClick={() => setSubNav('db')}>
          🗄️ DB &amp; SP Logic
        </button>
        <button className={`rm-docs-subbtn ${subNav === 'backend' ? 'rm-docs-subbtn-active' : ''}`} onClick={() => setSubNav('backend')}>
          ⚙️ Backend (.NET C#)
        </button>
        <button className={`rm-docs-subbtn ${subNav === 'frontend' ? 'rm-docs-subbtn-active' : ''}`} onClick={() => setSubNav('frontend')}>
          📱 Frontend Apps
        </button>
        <button className={`rm-docs-subbtn ${subNav === 'scenarios' ? 'rm-docs-subbtn-active' : ''}`} onClick={() => setSubNav('scenarios')}>
          🧪 Scenario Simulator
        </button>
      </div>

      {/* 1. ARCHITECTURE FLOW SUB-TAB */}
      {subNav === 'arch' && (
        <div className="rm-docs-flow">
          <div className="rm-docs-flow-node rm-docs-flow-node-frontend">
            <div className="rm-docs-flow-header">
              <span className="rm-docs-flow-title">1. Frontend Capture Layer (React / Ionic)</span>
              <span className="rm-docs-flow-tag rm-docs-flow-tag-fe">Client UI</span>
            </div>
            <ul className="rm-docs-flow-list">
              <li>Captures live video frame canvas and converts to Base64 image payload.</li>
              <li>Scans Web Bluetooth LE (<code>navigator.bluetooth</code>) for nearby EasyReach beacon MAC addresses.</li>
              <li>Requests device GPS Geolocation (Latitude &amp; Longitude).</li>
              <li>Displays live Grace Tracker telemetry (Graces <code>[X/4]</code>, Permissions <code>[Y/6]</code>, Occasions <code>[Z/10]</code>).</li>
              <li>Sends payload to <code>/api/Checkin/AILogAttendance</code> or <code>/api/Checkin/AISecurityAttendance</code>.</li>
            </ul>
          </div>

          <div className="rm-docs-arrow">▼</div>

          <div className="rm-docs-flow-node rm-docs-flow-node-backend">
            <div className="rm-docs-flow-header">
              <span className="rm-docs-flow-title">2. Backend Processing Pipeline (CheckinController.cs)</span>
              <span className="rm-docs-flow-tag rm-docs-flow-tag-be">.NET Core API</span>
            </div>
            <ul className="rm-docs-flow-list">
              <li><strong>API Auth:</strong> Validates <code>x-api-key: dbase-ai-master-key-2026</code>.</li>
              <li><strong>Dynamic Policy Resolution:</strong> Reads active parameters dynamically from <code>tbl_AttendancePolicyMaster</code>.</li>
              <li><strong>Auto-Sync Quotas:</strong> Propagates role quotas (Technical 60m, Non-Tech 90m, Marketing 240m) to <code>tbl_employee.P_Time</code>.</li>
              <li><strong>Rule Hierarchy:</strong> Resolves BT/GPS requirements (Employee Override &rarr; Branch/Dept Rule &rarr; Default).</li>
              <li><strong>On-Duty Evaluation:</strong> Waives GPS/BT for "Party/Client Duty" or switches geofence to visited branch.</li>
              <li><strong>Geofence &amp; Beacon Verification:</strong> Haversine distance check (&le; 100m) &amp; Beacon waiver check.</li>
              <li><strong>Face Recognition Engine:</strong> Extracts 128-d embedding, calculates Euclidean distance (&le; 0.48), requires &ge; 50% confidence.</li>
              <li><strong>Strict Permission Approval Check:</strong> Validates approved permission in <code>tbl_leaves</code> for Perm Out/In scans.</li>
            </ul>
          </div>

          <div className="rm-docs-arrow">▼</div>

          <div className="rm-docs-flow-node rm-docs-flow-node-db">
            <div className="rm-docs-flow-header">
              <span className="rm-docs-flow-title">3. Database &amp; Stored Procedure Layer (SQL Server)</span>
              <span className="rm-docs-flow-tag rm-docs-flow-tag-db">Stored Procedure</span>
            </div>
            <ul className="rm-docs-flow-list">
              <li>Executes <code>APP_AI_SaveAttendance</code> to update today's log in <code>face_Attendance</code>.</li>
              <li>Dynamically reads reporting time strictly from <code>tbl_employee.InTime</code> (e.g. 09:00, 09:30, 10:00).</li>
              <li>Enforces Policy Master limits: 4 Free Graces (&le; 15m), 6 Permission Sessions, and 10 Total Late Occasions Cap.</li>
              <li>Auto-calculates exactly 1 hour (60 min) lunch duration from actual Lunch Out punch (no afternoon grace).</li>
              <li>Applies Double LOP for excess permission &gt; 2 hours without balance and triggers Yellow Slip records.</li>
            </ul>
          </div>
        </div>
      )}

      {/* 2. DB & SP LOGIC SUB-TAB */}
      {subNav === 'db' && (
        <div className="rm-docs-container">
          <div className="rm-docs-card">
            <h3 className="rm-docs-card-title">🗄️ Database Tables Schema Reference</h3>
            <table className="rm-table">
              <thead>
                <tr>
                  <th>Table Name</th>
                  <th>Key Columns &amp; Purpose</th>
                </tr>
              </thead>
              <tbody>
                {DB_TABLES.map(t => (
                  <tr key={t.name}>
                    <td><strong className="rm-branch-name">{t.name}</strong></td>
                    <td>{t.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rm-docs-card">
            <h3 className="rm-docs-card-title">⚙️ Stored Procedure: <code>APP_AI_SaveAttendance</code> Logic</h3>
            
            <div className="rm-tree-box">
              <div className="rm-tree-node-title">1. Reporting Time &amp; Permission Balance Calculation</div>
              <p className="rm-docs-hero-desc" style={{ color: '#475569' }}>
                Reporting time is strictly read from <code>tbl_employee.InTime</code> (standardizing dot and colon formats: 09:00, 09:30, 10:00).
              </p>
              <div className="rm-formula-box">
                Total Permission Balance = (Base P_Time from tbl_employee + Approved Overtime PER Minutes) - Used Permission Minutes
              </div>
            </div>

            <div className="rm-tree-box">
              <div className="rm-tree-node-title">2. Morning In Decision Tree (Governed by tbl_AttendancePolicyMaster)</div>
              <div className="rm-tree-branch">
                <div className="rm-tree-node">
                  <strong>LogTime &le; ReportingTime:</strong> <span className="rm-tree-badge-green">Status: Present</span> | GraceType: NULL
                </div>
                <div className="rm-tree-node">
                  <strong>Late &le; 15 Min AND FreeGraceUsed &lt; 4 AND TotalLateOccasions &lt; 10:</strong> <span className="rm-tree-badge-orange">Status: Grace</span> | GraceType: FREE_GRACE (Logged in <code>tbl_LateAttendanceAudit</code>)
                </div>
                <div className="rm-tree-node">
                  <strong>PermSessions &lt; 6 AND TotalLateOccasions &lt; 10 AND PermissionBalance &ge; LateMinutes:</strong> <span className="rm-tree-badge-blue">Status: Permission Adjusted</span> | GraceType: PERMISSION (Auto-inserts permission into <code>tbl_leaves</code>)
                </div>
                <div className="rm-tree-node">
                  <strong>TotalLateOccasions &ge; 10 OR PermissionBalance &le; 0:</strong> <span className="rm-tree-badge-red">Status: LOP + 1 Yellow Slip</span> | Entire late time including 60 min grace is treated as Loss of Pay (LOP).
                </div>
              </div>
            </div>

            <div className="rm-tree-box">
              <div className="rm-tree-node-title">3. Lunch In Decision Tree (1-Hour Auto Window)</div>
              <div className="rm-tree-branch">
                <div className="rm-tree-node">
                  Official Lunch Window: <strong>1:30 PM to 2:30 PM</strong>.
                </div>
                <div className="rm-tree-node">
                  Auto Break: <strong>Expected Lunch In = Lunch_Out + 1 Hour (60 minutes)</strong> from actual Lunch Out punch.
                </div>
                <div className="rm-tree-node">
                  <strong>LunchLateMinutes &le; 0:</strong> <span className="rm-tree-badge-green">Status: Present</span>
                </div>
                <div className="rm-tree-node">
                  <strong>LunchLateMinutes &gt; 0:</strong> <span className="rm-tree-badge-blue">No Afternoon Grace.</span> Deducts from monthly Permission Balance if available, otherwise converts to LOP.
                </div>
              </div>
            </div>

            <div className="rm-tree-box">
              <div className="rm-tree-node-title">4. Excess Permission &amp; Double LOP Penalty Matrix</div>
              <div className="rm-tree-branch">
                <div className="rm-tree-node">
                  <strong>Excess &le; 2 Hours Without Balance:</strong> Single Loss of Pay (1x LOP).
                </div>
                <div className="rm-tree-node">
                  <strong>Excess &gt; 2 Hours Without Balance:</strong> <span className="rm-tree-badge-red">Double Loss of Pay (Double LOP / 2x LOP)</span> (allotted permission time is also included in total deduction).
                </div>
                <div className="rm-tree-node">
                  <strong>Yellow Slip Trigger:</strong> <strong>+1 Yellow Slip</strong> for every 3 excess permission sessions without balance.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. BACKEND (.NET C#) SUB-TAB */}
      {subNav === 'backend' && (
        <div className="rm-docs-grid-3">
          <div className="rm-docs-card">
            <h4 className="rm-docs-card-title">🔐 Rule Resolution Hierarchy</h4>
            <ul className="rm-docs-flow-list">
              <li><strong>Rule 1 (Highest):</strong> Employee Override (<code>AI_AttendanceEmployeeOverride</code>).</li>
              <li><strong>Rule 2:</strong> Branch &amp; Dept Master (<code>AI_AttendanceBranchRule</code>).</li>
              <li><strong>Rule 3 (Default):</strong> Eluru = BT + GPS; Others = GPS Only.</li>
            </ul>
          </div>

          <div className="rm-docs-card">
            <h4 className="rm-docs-card-title">🚗 On-Duty Logic (<code>GetOnDutyContextAsync</code>)</h4>
            <ul className="rm-docs-flow-list">
              <li><strong>Party/Client/Official Duty:</strong> <code>BT_Required = FALSE</code>, <code>GPS_Required = FALSE</code>. Face match carries punch anywhere!</li>
              <li><strong>Visited Branch Duty:</strong> Inherits target branch's geofences &amp; beacons so visitors aren't blocked.</li>
            </ul>
          </div>

          <div className="rm-docs-card">
            <h4 className="rm-docs-card-title">📡 Beacon Waiver Logic</h4>
            <ul className="rm-docs-flow-list">
              <li>If employee rule requires BT, but employee is inside a valid GPS office geofence and that office has 0 registered beacons in <code>Tbl_BluetoothMaster</code>:</li>
              <li><code>BT_Required</code> is automatically waived to <strong>FALSE</strong> (GPS-Only).</li>
            </ul>
          </div>

          <div className="rm-docs-card">
            <h4 className="rm-docs-card-title">📐 Geofence Haversine Formula</h4>
            <div className="rm-formula-box">
              a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlon/2)
              c = 2·atan2(√a, √(1-a))
              Distance = R · c  (R = 6,371,000 m)
            </div>
            <p className="rm-docs-hero-desc" style={{ color: '#475569' }}>
              Valid if Distance &le; AllowedRadiusMeters (default 100m).
            </p>
          </div>

          <div className="rm-docs-card">
            <h4 className="rm-docs-card-title">👤 Face Recognition Math</h4>
            <ul className="rm-docs-flow-list">
              <li>Standard Distance Threshold: &le; 0.48.</li>
              <li>Security Kiosk Distance Threshold: &le; 0.42 with &ge; 0.06 match margin.</li>
            </ul>
            <div className="rm-formula-box">
              Confidence = dist &le; 0.24 ? (100 - (dist/0.24)*25) : (75 - ((dist-0.24)/0.24)*25)
            </div>
            <p className="rm-docs-hero-desc" style={{ color: '#475569' }}>Minimum confidence required: 50%.</p>
          </div>

          <div className="rm-docs-card">
            <h4 className="rm-docs-card-title">⏰ Time Slot Auto-Resolution</h4>
            <table className="rm-table">
              <thead>
                <tr>
                  <th>Time Window</th>
                  <th>Resolved Slot</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>07:00 – 12:30</td><td>Morning In</td></tr>
                <tr><td>12:30 – 14:15</td><td>Lunch Out</td></tr>
                <tr><td>14:15 – 16:00</td><td>Lunch In (1-Hr Auto Window)</td></tr>
                <tr><td>16:00 onwards</td><td>Evening Out (06:33 PM Threshold)</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. FRONTEND APPS SUB-TAB */}
      {subNav === 'frontend' && (
        <div className="rm-docs-grid-3">
          <div className="rm-docs-card">
            <h4 className="rm-docs-card-title">📋 PolicyMaster.tsx</h4>
            <p className="rm-docs-hero-desc" style={{ color: '#475569' }}>
              Central Face Attendance Policy Master. Dynamically controls 21 policy parameters, auto-syncs <code>tbl_employee.P_Time</code> by department, and provides a live Month-To-Date employee policy audit &amp; simulation tool.
            </p>
          </div>

          <div className="rm-docs-card">
            <h4 className="rm-docs-card-title">📱 AIAttendanceScanner.tsx</h4>
            <p className="rm-docs-hero-desc" style={{ color: '#475569' }}>
              Employee Kiosk Scanner. Uses Web Camera, Web Bluetooth LE (<code>navigator.bluetooth</code>), and GPS Geolocation. Displays live monthly Grace Tracker telemetry (<code>[X/4]</code>, <code>[Y/6]</code>, <code>[Z/10]</code>).
            </p>
          </div>

          <div className="rm-docs-card">
            <h4 className="rm-docs-card-title">🛡️ SecurityAttendanceScanner.tsx</h4>
            <p className="rm-docs-hero-desc" style={{ color: '#475569' }}>
              Security Kiosk Gate Scanner. Continuously auto-detects employee faces in real time at main gates, supporting multi-face bounding box tracking and instant policy status feedback.
            </p>
          </div>

          <div className="rm-docs-card">
            <h4 className="rm-docs-card-title">📊 AIAttendanceLog.tsx</h4>
            <p className="rm-docs-hero-desc" style={{ color: '#475569' }}>
              Admin &amp; HR Attendance Matrix. Shows all 6 slots, highlights grace usage, late minutes, LOP warnings, and direct Google Maps links.
            </p>
          </div>

          <div className="rm-docs-card">
            <h4 className="rm-docs-card-title">⚙️ AIAttendanceRuleMaster.tsx</h4>
            <p className="rm-docs-hero-desc" style={{ color: '#475569' }}>
              Central Bluetooth &amp; GPS Rule Management Portal. Configures branch default rules, per-employee overrides, Bluetooth Beacons, and GPS geofences.
            </p>
          </div>

          <div className="rm-docs-card">
            <h4 className="rm-docs-card-title">📸 AIAttendanceRegister.tsx</h4>
            <p className="rm-docs-hero-desc" style={{ color: '#475569' }}>
              Biometric Registration Portal. Validates 3D face pose quality (front, left, right, tilt) before storing the 128-d embedding vector.
            </p>
          </div>
        </div>
      )}

      {/* 5. SCENARIO SIMULATOR SUB-TAB */}
      {subNav === 'scenarios' && (
        <div className="rm-docs-container">
          <div className="rm-sim-card">
            <h3 className="rm-docs-card-title" style={{ color: '#0f766e' }}>
              🧪 Interactive Attendance Rule Case Simulator
            </h3>
            <p className="rm-docs-hero-desc" style={{ color: '#334155', marginBottom: 12 }}>
              Select any scenario below to see the live breakdown of rules, presence requirements, status outputs, grace deductions, and backend code logic!
            </p>

            <div className="rm-sim-selector">
              {SCENARIOS.map(s => (
                <button
                  key={s.id}
                  className={`rm-sim-btn ${selectedScenarioId === s.id ? 'rm-sim-btn-active' : ''}`}
                  onClick={() => setSelectedScenarioId(s.id)}
                >
                  {s.name}
                </button>
              ))}
            </div>

            <div className="rm-sim-output">
              <div className="rm-sim-stat">
                <span className="rm-sim-stat-label">Scenario Name</span>
                <span className="rm-sim-stat-val" style={{ color: '#0f766e' }}>{currentScenario.name}</span>
              </div>
              <div className="rm-sim-stat">
                <span className="rm-sim-stat-label">Presence Verification</span>
                <span className="rm-sim-stat-val">{currentScenario.presence}</span>
              </div>
              <div className="rm-sim-stat">
                <span className="rm-sim-stat-label">Assigned Status</span>
                <span className="rm-sim-stat-val" style={{ color: '#0284c7' }}>{currentScenario.status}</span>
              </div>
              <div className="rm-sim-stat">
                <span className="rm-sim-stat-label">Grace Type</span>
                <span className="rm-sim-stat-val">{currentScenario.graceType}</span>
              </div>
              <div className="rm-sim-stat">
                <span className="rm-sim-stat-label">Late Minutes</span>
                <span className="rm-sim-stat-val" style={{ color: currentScenario.lateMin > 0 ? '#e11d48' : '#16a34a' }}>
                  {currentScenario.lateMin} Min
                </span>
              </div>
              <div className="rm-sim-stat">
                <span className="rm-sim-stat-label">Permission Balance Used</span>
                <span className="rm-sim-stat-val">{currentScenario.permBalanceDeduction}</span>
              </div>
              <div className="rm-sim-stat">
                <span className="rm-sim-stat-label">Free Graces Remaining</span>
                <span className="rm-sim-stat-val">{currentScenario.freeGracesLeft}</span>
              </div>
            </div>

            <div className="rm-tree-box" style={{ marginTop: 12 }}>
              <div className="rm-tree-node-title">Execution Explanation</div>
              <p className="rm-docs-hero-desc" style={{ color: '#334155' }}>{currentScenario.logic}</p>
              <div className="rm-formula-box" style={{ marginTop: 6 }}>
                Backend SP Condition: {currentScenario.backendCode}
              </div>
            </div>
          </div>

          <div className="rm-docs-card">
            <h3 className="rm-docs-card-title">📋 Complete Case Summary Matrix</h3>
            <table className="rm-table">
              <thead>
                <tr>
                  <th>Case Scenario</th>
                  <th>Presence Check</th>
                  <th>Status Assigned</th>
                  <th>Grace / Deduction Logic</th>
                </tr>
              </thead>
              <tbody>
                {SCENARIOS.map(s => (
                  <tr key={s.id}>
                    <td><strong className="rm-branch-name">{s.name}</strong></td>
                    <td><span className="rm-loc-badge-sub" style={{ padding: '2px 6px', borderRadius: 4 }}>{s.presence}</span></td>
                    <td><span className="rm-tree-badge-blue">{s.status}</span></td>
                    <td style={{ fontSize: 11 }}>{s.logic}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAttendanceRuleMaster;
