import React, { useEffect, useState } from "react";
import axios from "axios";
import moment from "moment";
import { API_BASE } from "../../config";
import "./RequestList.css";

import {
  IonIcon,
  IonSelect,
  IonSelectOption,
} from "@ionic/react";

import {
  personOutline,
  calendarOutline,
  layersOutline,
  searchOutline,
  closeCircle,
  checkmarkCircle
} from "ionicons/icons";

import { createPortal } from "react-dom";
import { useRef } from "react";

/* ================= TYPES ================= */
interface Props {
  type: string;
  view: string;
  status: string;
}

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};



const getAuthHeaders = () => {
  const token = localStorage.getItem("token")?.replace(/"/g, "");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// 🔥 SAFE FIX (NO OBJECT CRASH EVER)
const safeText = (val: any) => {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
};


const generateMonthList = () => {
  const months: string[] = [];
  const current = moment().add(1, "month");

  for (let y = current.year(); y >= 2024; y--) {
    const endMonth = y === current.year() ? current.month() : 11;
    for (let m = endMonth; m >= 0; m--) {
      months.push(moment().year(y).month(m).format("MMM-YYYY"));
    }
  }
  return months;
};



const getRejectionInfo = (item: any) => {
  if (!item?.L_status) return null;

  const status = String(item.L_status);

  if (status.toLowerCase().includes("rejected")) {
    // 🔥 SHOW EXACT BACKEND MESSAGE
    return status;
  }

  return null;
};
const RequestList: React.FC<Props> = ({ type, view, status }) => {
    const [amountMap, setAmountMap] = useState<{ [key: string]: string }>({});
const [commentMap, setCommentMap] = useState<{ [key: string]: string }>({});
const handleAmountChange = (id: string, value: string) => {
  setAmountMap((prev) => ({ ...prev, [id]: value }));
};

const handleCommentChange = (id: string, value: string) => {
  setCommentMap((prev) => ({ ...prev, [id]: value }));
};
  const baseUrl = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;

  const [data, setData] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [months] = useState(generateMonthList());
  const [selectedMonth, setSelectedMonth] = useState(
    moment().format("MMM-YYYY")
  );
  const [tripDaysByDuty, setTripDaysByDuty] = useState<{ [key: number]: any[] }>({});
  const [viewModalOpen, setViewModalOpen] = useState(false);
const [selectedDuty, setSelectedDuty] = useState<any>(null);

const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
const [selectedEmpCode, setSelectedEmpCode] = useState<string>("0");

const [searchTerm, setSearchTerm] = useState("");
const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

const triggerRef = useRef<HTMLDivElement>(null);

const [dropdownPos, setDropdownPos] = useState({
  top: 0,
  left: 0,
  width: 0
});



  const normalize = (x: any) => {
    if (!x) return null;

    // ✅ ONDUTY
   if (type === "onduty") {
  return {
    id: x.id,
    lid: x.id,

    empNames: safeText(
      x.empNames ||   // ✅ FIX
      x.EmpNames ||
      x.empnames ||
      x.Empname ||
      x.empname
    ),

    empcode: safeText(x.empcode),

    College: x.college,
    Description: x.description,
    Mode_of_Trans: x.mode || x.mode_of_Trans,
    Vehicle_No: x.vehicle_No,
    Location: x.location,

    DateFrom: x.dateFrom,
    DateTo: x.dateTo,

    L_status: safeText(x.status),

    CurrentLevel: x.currentLevel,
    MaxLevel: x.maxLevel,
    CurrentRA: x.currentRA,

    RA1: x.rA1,
    RA2: x.rA2,
    RA3: x.rA3,
    RA4: x.rA4,

    RA1_Status: x.rA1_Status,
    RA2_Status: x.rA2_Status,
    RA3_Status: x.rA3_Status,
    RA4_Status: x.rA4_Status,

    dayTrips: x.dayTrips || [],
  };
}

    // ✅ OVERTIME
    if (type === "overtime") {
      return {
        
        lid: x[0],
        empcode: x[1],
        Empname: x[2],
        lfrom: x[3],
        College: x[4],
        Fromtime: x[5],
        Totime: x[6],
        Remarks: x[7],
        MinDiff: x[8],

        CurrentLevel: x[11],
    MaxLevel: x[12],
    CurrentRA: x[13],

    RA1: x[15],
    RA2: x[16],
    RA3: x[17],
    RA4: x[18],

    RA1_Status: x[19],
    RA2_Status: x[20],
    RA3_Status: x[21],
    RA4_Status: x[22],
        L_status: x[23] || "Pending",
      };
    }

    // ✅ EQUIPMENT
    if (type === "equipment") {
      return {
        lid: x.id || x.Id,
        empcode: x.empcode || x.EmpCode,
        Empname: safeText(x.Empname),
        Remarks: safeText(x.Remarks),
        Priority: x.Priority,
        FilePath: x.FilePath,
        Amount: x.Amount,
        lfrom: x.lfrom || x.AppliedOn,
        L_status: safeText(x.L_status || x.Status),
        RA1_Status: x.RA1_Status,
        RA2_Status: x.RA2_Status,
        RA3_Status: x.RA3_Status,
        RA4_Status: x.RA4_Status,
        RA1: x.RA1,
        RA2: x.RA2,
        RA3: x.RA3,
        RA4: x.RA4,
        RA1_Comment: x.RA1_Comment,
        RA2_Comment: x.RA2_Comment,
        RA3_Comment: x.RA3_Comment,
        RA4_Comment: x.RA4_Comment,
        CurrentLevel: x.CurrentLevel,
        CurrentRA: x.CurrentRA,
      };
    }

    // ✅ LEAVE / PERMISSION
    return {
         lid: x.lid || x.Id,
    empcode: x.empcode || x.EmpCode,
    Empname: safeText(x.Empname || x.empname || x.EmpCode),

    // ✅ EQUIPMENT FIX
    Remarks: safeText(x.Remarks || x.Purpose),
    Priority: x.Priority,
    FilePath: x.FilePath,
    Amount: x.Amount,

    // ✅ DATE
    lfrom: safeText(x.lfrom),
    ltype: safeText(x.ltype || x.LType),
    lto: safeText(x.lto),
    AppliedOn: safeText(x.AppliedOn),
    // ✅ STATUS FIX
    L_status: safeText(x.L_status || x.Status),
     LeaveCategory: safeText(x.LeaveCategory),
     Leavemode: safeText(x.Leavemode),
   ptime: safeText(x.ptime),
    // ✅ APPROVAL
    RA1_Status: x.RA1_Status,
    RA2_Status: x.RA2_Status,
    RA3_Status: x.RA3_Status,
    RA4_Status: x.RA4_Status,

    CurrentLevel: x.CurrentLevel,
    MaxLevel: x.MaxLevel,
    CurrentRA: x.CurrentRA,

    Slip : x.Slip,

    RA1: x.RA1,
    RA2: x.RA2,
    RA3: x.RA3,
    RA4: x.RA4,

    RA1_Comment: x.RA1_Comment,
    RA2_Comment: x.RA2_Comment,
    RA3_Comment: x.RA3_Comment,
    RA4_Comment: x.RA4_Comment,
    };
  };

  useEffect(() => {
    loadData();
  }, [type, view, selectedMonth]);

  useEffect(() => {
  loadEmployees();
}, []);

useEffect(() => {
  if (isSearchModalOpen && triggerRef.current) {
    const rect = triggerRef.current.getBoundingClientRect();

    setDropdownPos({
      top: rect.bottom + window.scrollY + 8,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }
}, [isSearchModalOpen]);

const formatEmployeeNames = (value: any) => {
  if (!value) return [];

  const str = String(value);

  return str
    .split(",")
    .map((x) => {
      const parts = x.split("-");

      if (parts.length >= 2) {
        const empCode = parts[0]?.trim();

        const empNames = parts
          .slice(1)
          .join("-")
          .trim();

        return {
          code: empCode,
          name:
            empNames.charAt(0).toUpperCase() +
            empNames.slice(1).toLowerCase(),
        };
      }

      return {
        code: "",
        name: x.trim(),
      };
    })
    .filter((x) => x.name);
};

const loadEmployees = async () => {
  try {
    const res = await axios.get(
      `${baseUrl}Employee/Load_Employees?SearchEmp=`,
      {
        headers: getAuthHeaders(),
      }
    );

    const mapped = (res.data || []).map((emp: any[]) => ({
      id: emp[0]?.toString(),
      name: emp[1],
    }));

    setEmployees([
      { id: "0", name: "All Employees" },
      ...mapped,
    ]);
  } catch (err) {
    console.error(err);
  }
};

  useEffect(() => {
    if (!search) {
      setFiltered(data);
      return;
    }

    const s = search.toLowerCase();

    setFiltered(
      data.filter(
        (x) =>
          safeText(x?.Empname).toLowerCase().includes(s) ||
          safeText(x?.empcode).toLowerCase().includes(s)
      )
    );
  }, [search, data]);




const loadData = async () => {
  const empCode = getUser()?.empCode;

 
const normalizedType = (type || "").toLowerCase().trim();

let leaveType = "";

if (normalizedType === "permission") {
  leaveType = "Permission";
} 
else if (
  normalizedType === "leave" ||
  normalizedType === "half day" ||
  normalizedType === "halfday"
) {
  leaveType = ""; // 👈 IMPORTANT: do NOT filter Half Day here
}

  setLoading(true);



try {
    let url = "";

    if (type === "onduty") {
        url =
          view === "my"
            ? `${baseUrl}Workreport/load_my_duties?empCode=${empCode}`
            : `${baseUrl}Workreport/load_duties_full?empCode=${empCode}`;
      } else if (type === "overtime") {
        url =
          view === "my"
            ? `${baseUrl}Workreport/load_overtime_duties?EmpCode=${empCode}`
            : `${baseUrl}Workreport/load_team_overtime_duties?EmpCode=${empCode}`;
      }

      //  EQUIPMENT API
      else if (type === "equipment") {
  url =
    view === "my"
      ? `${baseUrl}EquipmentRequests/MyRequests?empCode=${empCode}`
      : `${baseUrl}EquipmentRequests/TeamRequests?empCode=${empCode}`;
} else {
      url =
        view === "my"
          ? `${baseUrl}Leave/Load_Leave_Permission?Empcode=${empCode}&Seachdate=${selectedMonth}&LType=${type}`
          : `${baseUrl}Leave/loadrequests_leave_permission?Empcode=${empCode}&Seachdate=${selectedMonth}&LType=${type}`;
    }

    const res = await axios.get(url, { headers: getAuthHeaders() });

    const result = (Array.isArray(res.data) ? res.data : [])
      .map(normalize)
      .filter(Boolean);

    setData(result);
    setFiltered(result);
    if (type === "onduty") {
  //loadTripDays(result);
}
  } catch (e) {
    console.error(e);
    setData([]);
    setFiltered([]);
  } finally {
    setLoading(false);
  }
};

const filterByStatus = (item: any) => {
  const selected = (status || "all").toLowerCase();
  const raw = (item?.L_status || "").toLowerCase();

  if (selected === "all") return true;

  if (selected === "pending") {
    return raw.includes("pending");
  }

  if (selected === "accepted") {
    return raw.includes("approved") || raw.includes("accepted");
  }

  if (selected === "rejected") {
    return raw.includes("rejected");
  }

  return true;
};

const finalData = filtered
  .filter(Boolean)
  .filter(filterByStatus)
  .filter((x) => {
    if (selectedEmpCode === "0") return true;

    return String(x.empcode) === String(selectedEmpCode);
  });
//  const finalData = filtered.filter(Boolean).filter(filterByStatus);
const updateOnDuty = async (item: any, status: string) => {
  try {
   const payload = {
  _id: String(item.lid),
  _empcode: getUser()?.empCode,

  _date: moment(item.DateFrom).format("YYYY-MM-DD"),

  _Client: item.College,
  _Location: item.Location,
  _Description: item.Description,

  _TransportMode: item.Mode_of_Trans,

  _Starttime: item.Starttime || null,
  _Endtime: item.Endtime || null,

  _VehicleNo: item.Vehicle_No || null,

  _StartReading: item.StartReading || null,
  _EndReading: item.EndReading || null,
  _KMS: item.KMS || null,

  Status: status,
};
console.log("ONDUTY PAYLOAD:", payload);
    await axios.post(
      `${baseUrl}Workreport/SaveDuties_Approve`,
      payload,
      { headers: getAuthHeaders() }
    );

    loadData();
  } catch (e) {
    console.error(e);
  }
};

  const updateStatus = async (id: string, status: string) => {
    try {
      await axios.post(
        `${baseUrl}Leave/update_Leave_Permission`,
        {
          RequestId: String(id),
          Status: status,
          EmpCode: getUser()?.empCode,
        },
        { headers: getAuthHeaders() }
      );

      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  
const handleApprove = async (item: any) => {
  try {
    await axios.post(`${baseUrl}EquipmentRequests/UpdateStatus`, {
      RequestId: item.lid,
      Status: "Accepted",
      Amount: amountMap[item.lid] || 0,
      Comment: commentMap[item.lid] || "",
      EmpCode: getUser()?.empCode,
    });

    loadData();
  } catch (e) {
    console.error(e);
  }
};

const handleReject = async (item: any) => {
  try {
    await axios.post(`${baseUrl}EquipmentRequests/UpdateStatus`, {
      RequestId: item.lid,
      Status: "Rejected",
      Comment: commentMap[item.lid] || "",
      EmpCode: getUser()?.empCode,
    });

    loadData();
  } catch (e) {
    console.error(e);
  }
};

const updateOvertime = async (item: any, status: string) => {
  try {
    await axios.post(`${baseUrl}Workreport/UpdateOvertimeStatus`, {
      Id: item.lid,
      Status: status,
      EmpCode: getUser()?.empCode,
      FinMinDiff: item.MinDiff
    });

    loadData();
  } catch (e) {
    console.error(e);
  }
};

  const updateEquipment = async (item: any, status: string) => {
  const payload = {
    RequestId: item.lid,
    Status: status,
    EmpCode: getUser()?.empCode,
    Amount: amountMap[item.lid] || 0,
    Comment: commentMap[item.lid] || "",
  };

  await axios.post(`${baseUrl}EquipmentRequests/UpdateStatus`, payload);
  loadData();
};
const getStatusLabel = (item: any) => {
  // 🔥 SHOW EXACT BACKEND VALUE
  return item?.L_status || "";
};

 const getApprovedBy = (item: any) => {
  if (!item) return null;

  if (item?.L_status?.toLowerCase().includes("rejected")) {
    return null;
  }

  const list: string[] = [];

  if (item?.RA1_Status === "Accepted" && item?.RA1)
    list.push(item.RA1);

  if (item?.RA2_Status === "Accepted" && item?.RA2)
    list.push(item.RA2);

  if (item?.RA3_Status === "Accepted" && item?.RA3)
    list.push(item.RA3);

  if (item?.RA4_Status === "Accepted" && item?.RA4)
    list.push(item.RA4);

  return list.length > 0 ? list.join(" → ") : "Not Approved Yet";
};

const normalizeText = (val: any) =>
  safeText(val).toLowerCase().replace(/\s/g, "");

const canAct = (item: any) => {
  if (!item) return false;

  const status = normalizeText(item.L_status);

  // ❌ already completed
  if (
    status.includes("approved") ||
    status.includes("accepted") ||
    status.includes("rejected")
  ) {
    return false;
  }

  const user = normalizeText(getUser()?.designation);
  const current = normalizeText(item?.CurrentRA);

  return current === user;
};
  const cleanDate = (val: any) => {
  if (!val) return "";

  // if object → invalid backend junk
  if (typeof val === "object") return "";

  const str = String(val).trim();

  if (str === "{}" || str === "null" || str === "undefined") return "";

  return str;
};

const fmtDate = (val?: string) => {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return moment(d).format("DD-MM-YYYY");
};

const formatLeaveCategory = (value: any) => {
  if (!value) return "-";

  const v = String(value).trim();

  if (v.toLowerCase() === "forenoon") {
    return "Casual (Forenoon)";
  }

  if (v.toLowerCase() === "afternoon") {
    return "Casual (Afternoon)";
  }

  return v;
};

if (type === "onduty" && view === "my") {
  return null; // 🔥 completely hide OnDuty in My Requests
}

  return (
    <div style={{ overflowX: 'hidden', width: '100%' }}>
      {/* ── Filters ── */}
      {/* <div className="rl-filter-row">
        <div className="rl-filter-box">
          <span style={{ fontSize: 14, color: '#94a3b8' }}>🔍</span>
          <input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="rl-filter-box">
          <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {months.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
          
        </div>
      </div> */}

    {/* FILTERS */}
{view !== "my" ? (
  <div className="filters-grid">

    {/* EMPLOYEE FILTER */}
    <div className="custom-dropdown-container" ref={triggerRef}>
      <div
        className={`premium-filter-trigger ${
          isSearchModalOpen ? "active" : ""
        }`}
        onClick={() => setIsSearchModalOpen(!isSearchModalOpen)}
      >
        <div className="trigger-content">
          <div className="trigger-icon-box">
            <IonIcon icon={personOutline} />
          </div>

          <div className="trigger-text-sec">
            <span className="trigger-sub">Employee</span>

            <span className="trigger-main">
              {employees.find((e) => e.id === selectedEmpCode)?.name ||
                "Select Employee"}
            </span>
          </div>
        </div>

        <IonIcon
          icon={layersOutline}
          className="trigger-icon-arrow"
        />
      </div>

      {isSearchModalOpen &&
        createPortal(
          <>
            <div
              className="dropdown-outside-click-layer"
              onClick={() => setIsSearchModalOpen(false)}
            />

            <div
              className="custom-inline-dropdown"
              style={{
                position: "absolute",
                top: `${dropdownPos.top}px`,
                left: `${dropdownPos.left}px`,
                width: `${dropdownPos.width}px`,
              }}
            >
              <div className="dropdown-search-sec">
                <IonIcon
                  icon={searchOutline}
                  className="dropdown-search-icon"
                />

                <input
                  type="text"
                  className="dropdown-pure-input"
                  placeholder="Search employee..."
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(e.target.value)
                  }
                  autoFocus
                />

                {searchTerm && (
                  <button
                    className="dropdown-clear-btn"
                    onClick={() => setSearchTerm("")}
                  >
                    <IonIcon icon={closeCircle} />
                  </button>
                )}
              </div>

              <div className="dropdown-body">
                {employees
                  .filter(
                    (emp) =>
                      emp.name
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase()) ||
                      emp.id
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase())
                  )
                  .map((emp) => {
                    const isSelected =
                      selectedEmpCode === emp.id;

                    const nameWithoutId = emp.name.includes("-")
                      ? emp.name.split("-")[1].trim()
                      : emp.name;

                    const initials =
                      nameWithoutId.charAt(0).toUpperCase();

                    return (
                      <div
                        key={emp.id}
                        className={`dropdown-emp-item ${
                          isSelected ? "selected" : ""
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          setSelectedEmpCode(emp.id);

                          setIsSearchModalOpen(false);

                          setSearchTerm("");
                        }}
                      >
                        <div
                          className={`dr-avatar grad-${
                            (parseInt(emp.id) % 5) || 0
                          }`}
                        >
                          {emp.id === "0" ? (
                            <IonIcon icon={layersOutline} />
                          ) : (
                            initials
                          )}
                        </div>

                        <div className="dr-info">
                          <span className="dr-name">
                            {emp.name}
                          </span>

                          <span className="dr-id">
                            {emp.id === "0"
                              ? "Global"
                              : `ID: ${emp.id}`}
                          </span>
                        </div>

                        {isSelected && (
                          <IonIcon
                            icon={checkmarkCircle}
                            className="dr-check"
                          />
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>

    {/* MONTH FILTER */}
    <div className="custom-dropdown-container">
      <div className="premium-filter-trigger">
        <div className="trigger-content">
          <div className="trigger-icon-box">
            <IonIcon icon={calendarOutline} />
          </div>

          <div className="trigger-text-sec">
            <span className="trigger-sub">Period</span>
            <span className="trigger-main">
              {selectedMonth}
            </span>
          </div>
        </div>

        <IonIcon
          icon={layersOutline}
          className="trigger-icon-arrow"
        />

        <IonSelect
          className="hidden-select-overlay"
          interface="popover"
          toggleIcon="none"
          value={selectedMonth}
          onIonChange={(e) =>
            setSelectedMonth(e.detail.value)
          }
        >
          {months.map((m) => (
            <IonSelectOption key={m} value={m}>
              {m}
            </IonSelectOption>
          ))}
        </IonSelect>
      </div>
    </div>
  </div>
) : (
  /* ONLY MONTH FILTER FOR "my" VIEW */
  <div className="filters-grid">

    <div className="custom-dropdown-container">
      <div className="premium-filter-trigger">
        <div className="trigger-content">
          <div className="trigger-icon-box">
            <IonIcon icon={calendarOutline} />
          </div>

          <div className="trigger-text-sec">
            <span className="trigger-sub">Period</span>
            <span className="trigger-main">
              {selectedMonth}
            </span>
          </div>
        </div>

        <IonIcon
          icon={layersOutline}
          className="trigger-icon-arrow"
        />

        <IonSelect
          className="hidden-select-overlay"
          interface="popover"
          toggleIcon="none"
          value={selectedMonth}
          onIonChange={(e) =>
            setSelectedMonth(e.detail.value)
          }
        >
          {months.map((m) => (
            <IonSelectOption key={m} value={m}>
              {m}
            </IonSelectOption>
          ))}
        </IonSelect>
      </div>
    </div>

  </div>
)}
      {loading && <p>Loading...</p>}

      {!loading &&
        filtered
          .filter(Boolean)
          .filter(filterByStatus)
         .map((item) => {
          return (
            <div key={`${item.lid}-${item.empcode}`} className="lr-history-card themed-bg">
              <div className="lr-card-header-row">
                <div className="lr-card-main">
                  {/* <div className="lr-card-title">
                    {type === 'equipment' ? item.Remarks : type === 'overtime' ? item.Empname : type === 'onduty' ? item.College : (item.empcode + ' : ' + item.Empname)}
                  </div> */}
                  <div className="lr-card-title">
  {type === "equipment"
    ? item.Remarks
    : type === "overtime"
    ? item.Empname
    : type === "onduty"
    ? item. College : (item.empcode + ' : ' + item.Empname)}

</div>
                  <div className="lr-card-subtitle">
                    {type === 'equipment' ? 'Raised by : ' + (item.Empname + ' (' + item.empcode + ')') : type === 'overtime' ? item.Remarks : type === 'onduty' ? item.Description : 'Purpose : ' + item.Remarks}
                  </div>
                </div>
                <div className={`lr-status-indicator lr-status-${(item.L_status || '').toLowerCase().replace(/\s/g, '')}`}>
                  {item.L_status}
                </div>
              </div>

              <div className="lr-card-grid">
                {type === 'equipment' && (
                  <>
                    <div className="lr-grid-item"><span className="lr-grid-label">Priority</span><span className="lr-grid-value priority">{item.Priority}</span></div>
                    <div className="lr-grid-item"><span className="lr-grid-label">Applied On</span><span className="lr-grid-value">{cleanDate(item.lfrom)}</span></div>
                    <div className="lr-grid-item"><span className="lr-grid-label">Amount</span><span className="lr-grid-value">{item.Amount ? '₹ ' + item.Amount : '-'}</span></div>
                    {item.FilePath && (
                      <div className="lr-grid-item">
                        <span className="lr-grid-label">File</span>
                        <a href={item.FilePath} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 600, fontSize: '13px' }}>Download</a>
                      </div>
                    )}
                  </>
                )}
                {type === 'overtime' && (
                  <>
                    <div className="lr-grid-item"><span className="lr-grid-label">Date</span><span className="lr-grid-value">{item.lfrom}</span></div>
                    <div className="lr-grid-item"><span className="lr-grid-label">Time</span><span className="lr-grid-value">{item.Fromtime} → {item.Totime}</span></div>
                    <div className="lr-grid-item"><span className="lr-grid-label">Duration</span><span className="lr-grid-value">{item.MinDiff} mins</span></div>
                  </>
                )}
                {type === 'onduty' && (
                  <>
                  <div className="lr-grid-item full-width">
  <span className="lr-grid-label">Employees</span>

  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      marginTop: "6px",
    }}
  >
    {formatEmployeeNames(item.empNames).map(
      (emp: any, idx: number) => (
        <div
          key={idx}
          style={{
            background: "#eef2ff",
            color: "#3730a3",
            padding: "6px 10px",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: 600,
            border: "1px solid #c7d2fe",
          }}
        >
          {emp.name}
          {emp.code && (
            <span style={{ opacity: 0.7 }}>
              {" "}
              ({emp.code})
            </span>
          )}
        </div>
      )
    )}
  </div>
</div>
                    <div className="lr-grid-item"><span className="lr-grid-label">Transport</span><span className="lr-grid-value">{item.Mode_of_Trans} {item.Vehicle_No && `• ${item.Vehicle_No}`}</span></div>
                    <div className="lr-grid-item"><span className="lr-grid-label">Timeline</span><span className="lr-grid-value">{fmtDate(item.DateFrom)} → {fmtDate(item.DateTo)}</span></div>
                    <div className="lr-grid-item"><span className="lr-grid-label">Location</span><span className="lr-grid-value">{item.Location}</span></div>
                    <div className="lr-grid-item">
                      <span className="lr-grid-label">Details</span>
                      <a href="#" onClick={(e) => { e.preventDefault(); setSelectedDuty(item); setViewModalOpen(true); }} style={{ color: '#2563eb', fontWeight: 600, fontSize: '13px' }}>View</a>
                    </div>
                  </>
                )}
                {(type !== 'equipment' && type !== 'overtime' && type !== 'onduty') && (
                  <>
                    <div className="lr-grid-item"><span className="lr-grid-label">Category</span><span className="lr-grid-value">{item.Leavemode} {item.Leavemode && `(${item.LeaveCategory})`}</span></div>
                    <div className="lr-grid-item"><span className="lr-grid-label">Applied On</span><span className="lr-grid-value">{item.AppliedOn}</span></div>
                    {item?.ltype?.toLowerCase() === 'permission' ? (
  <>
  
    <div className="lr-row">
  <div className="lr-grid-item">
    <span className="lr-grid-label">Permission Time</span>
    <span className="lr-grid-value">
      {cleanDate(item.lfrom)} {item.ptime ? `(${item.ptime})` : ''}
    </span>
  </div>

  {typeof item.Slip === "string" && item.Slip.trim() !== "" && (
    <div className="lr-grid-item">
      <span className="lr-grid-label">Slip</span>
      <span className="lr-grid-value">{item.Slip}</span>
    </div>
  )}
</div>
    

  
                      </>
                    ) : (
                      <div className="lr-grid-item"><span className="lr-grid-label">Leave Dates</span><span className="lr-grid-value">{cleanDate(item.lfrom)} {cleanDate(item.lto) && cleanDate(item.lto) !== cleanDate(item.lfrom) ? `- ${cleanDate(item.lto)}` : ''}</span></div>
                    )}
                  </>
                )}
              </div>

              {((item.RA1_Comment || item.RA2_Comment || item.RA3_Comment || item.RA4_Comment) && type === 'equipment') && (
                <div style={{ marginTop: '14px', fontSize: '13px' }}>
                  <b style={{ color: '#64748b' }}>Comments</b>
                  {item.RA1_Comment && <p style={{ margin: '4px 0' }}>💬 {item.RA1}: {item.RA1_Comment}</p>}
                  {item.RA2_Comment && <p style={{ margin: '4px 0' }}>💬 {item.RA2}: {item.RA2_Comment}</p>}
                  {item.RA3_Comment && <p style={{ margin: '4px 0' }}>💬 {item.RA3}: {item.RA3_Comment}</p>}
                  {item.RA4_Comment && <p style={{ margin: '4px 0' }}>💬 {item.RA4}: {item.RA4_Comment}</p>}
                </div>
              )}

              {getRejectionInfo(item) && <p style={{ color: 'red', fontWeight: 'bold', fontSize: '12px', marginTop: '8px' }}>{getRejectionInfo(item)}</p>}
              {!item?.L_status?.toLowerCase().includes('rejected') && type !== 'equipment' && type !== 'overtime' && type !== 'onduty' && (
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', fontWeight: 600 }}>Approved By: {getApprovedBy(item)}</p>
              )}

              {view !== 'my' && canAct(item) && (
                <div className="lr-card-actions">
                  {type === 'onduty' ? (
                    <>
                      <button className="lr-action-btn approve" onClick={() => updateOnDuty(item, 'Accepted')}>✅ Approve</button>
                      <button className="lr-action-btn reject"  onClick={() => updateOnDuty(item, 'Rejected')}>❌ Reject</button>
                    </>
                  ) : type === 'equipment' ? (
                    <>
                      {item.CurrentLevel === 1 && (
                        <input type="number" placeholder="Amount" value={amountMap[item.lid] || ''} onChange={(e) => handleAmountChange(item.lid, e.target.value)} />
                      )}
                      <input type="text" placeholder="Comment" value={commentMap[item.lid] || ''} onChange={(e) => handleCommentChange(item.lid, e.target.value)} />
                      <button className="lr-action-btn approve" onClick={() => handleApprove(item)}>✅ Approve</button>
                      <button className="lr-action-btn reject"  onClick={() => handleReject(item)}>❌ Reject</button>
                    </>
                  ) : type === 'overtime' ? (
                    <>
                      <button className="lr-action-btn approve" onClick={() => updateOvertime(item, 'Accepted')}>✅ Approve</button>
                      <button className="lr-action-btn reject"  onClick={() => updateOvertime(item, 'Rejected')}>❌ Reject</button>
                    </>
                  ) : (
                    <>
                      <button className="lr-action-btn approve" onClick={() => updateStatus(item.lid, 'Accepted')}>✅ Approve</button>
                      <button className="lr-action-btn reject"  onClick={() => updateStatus(item.lid, 'Rejected')}>❌ Reject</button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
{viewModalOpen && selectedDuty && (
  <div className="modal-overlay">
    <div className="modal-container">

      {/* HEADER */}
      <div className="modal-header">
        <h3>On Duty Details</h3>
        <button onClick={() => setViewModalOpen(false)}>✖</button>
      </div>

      {/* BODY */}
      <div className="modal-body">

        {(selectedDuty.dayTrips || []).length === 0 && (
          <p>No trip data available</p>
        )}

        {(selectedDuty.dayTrips || []).map((trip: any, index: number) => (
          <div key={trip.dayTrip_Id || index} className="trip-card">

            <div className="trip-header">
              <b>{moment(trip.dutyDate).format("DD-MM-YYYY")}</b>
            </div>

            <div className="trip-body">
              <p>
                <b>Reading:</b> {trip.readingFrom} → {trip.readingTo} ({trip.distance} Km)
              </p>

              {trip.fuelAmount && (
                <p><b>Fuel:</b> ₹{trip.fuelAmount}</p>
              )}
            </div>

            {(trip.visits || []).map((visit: any, vIndex: number) => (
              <div key={vIndex} className="visit-card">

                <p><b>Client:</b> {visit.client_Name}</p>

                <p>
                  <b>Location:</b>{" "}
                  {visit.latitude && visit.longitude ? (
                    <span
                      style={{ color: "blue", cursor: "pointer" }}
                      onClick={() =>
                        window.open(
                          `https://www.google.com/maps?q=${visit.latitude},${visit.longitude}`
                        )
                      }
                    >
                      View Map
                    </span>
                  ) : (
                    visit.location
                  )}
                </p>

                <p>
                  <b>Time:</b> {visit.visit_FromTime} → {visit.visit_ToTime}
                </p>

                <p>
                  <b>Contact:</b> {visit.contact_Person} ({visit.mobile_Number})
                </p>

                <p>
                  <b>Remarks:</b> {visit.remarks}
                </p>

              </div>
            ))}
          </div>
        ))}

      </div>
    </div>
  </div>
)}
      {!loading && finalData.length === 0 && <p>No data found</p>}
    </div>
  );
};

export default RequestList;