import React, { useEffect, useState } from "react";
import axios from "axios";
import moment from "moment";
import { API_BASE } from "../../config";
import "./RequestList.css";

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

  const normalize = (x: any) => {
    if (!x) return null;

    // ✅ ONDUTY
   if (type === "onduty") {
  return {
    id: x.id,
    lid: x.id,

    Empname: safeText(x.empname || x.empcode),
    empcode: safeText(x.empcode),

    College: x.college,
    Description: x.description,
    Mode_of_Trans: x.mode || x.mode_of_Trans,
    Vehicle_No: x.vehicle_No,
    Location: x.location,

    DateFrom: x.dateFrom,
    DateTo: x.dateTo,

    // ✅ FIXED
    L_status: safeText(x.status),

    // ✅ FIXED (case correction)
    CurrentLevel: x.currentLevel,
    MaxLevel: x.maxLevel,
    CurrentRA: x.currentRA,

    // ✅ FIXED RA mapping
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
        lid: x.lid,
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
   ptime: safeText(x.ptime),
    // ✅ APPROVAL
    RA1_Status: x.RA1_Status,
    RA2_Status: x.RA2_Status,
    RA3_Status: x.RA3_Status,
    RA4_Status: x.RA4_Status,

    CurrentLevel: x.CurrentLevel,
    MaxLevel: x.MaxLevel,
    CurrentRA: x.CurrentRA,

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
 const finalData = filtered.filter(Boolean).filter(filterByStatus);
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
    <div>
      <div className="premium-filters">
        <input
          placeholder="Search employee..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {months.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>

      {loading && <p>Loading...</p>}

      {!loading &&
        filtered
          .filter(Boolean)
          .filter(filterByStatus)
         .map((item) => {
  if (type === "onduty") {
    console.log("ONDUTY ITEM:", item);
  }
  console.log("CHECK:", {
  user: getUser()?.designation,
  currentRA: item.CurrentRA,
  status: item.L_status
});

  return (
    <div key={`${item.lid}-${item.empcode}`} className="premium-card">

              {/* <div className="card-header">
                <div>
                  <b>{item.Empname}</b>
                  <p>ID: {item.empcode}</p>
                </div>

                <div className="status-pill">
                  {getStatusLabel(item)}
                </div>
              </div> */}

              <div className="card-body">
                {type === "equipment" ? (
                    <>
  <div className="premium-card">
    <div className="card-accent"></div>

    {/* HEADER */}
    <div className="card-header">
      <div style={{ flex: 1 }}>
        <div>
          {/* <span className="college-name">{item.empcode}</span> */}
{/* PURPOSE */}
        <span>PURPOSE : {item.Remarks}</span>
          <span
            className={`badge-pill pill-${(item.L_status || "")
              .toLowerCase()
              .replace(/\s/g, "")}`}
          >
            {item.L_status}
          </span>
        </div>

        
      </div>
    </div>

    {/* GRID SECTION */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          window.innerWidth <= 768
            ? "1fr"
            : "repeat(4, minmax(0, 1fr))",
        gap: "14px",
        marginTop: "14px",
      }}
    >
      {/* PRIORITY */}
      <div className="footer-item">
        <span className="item-label">Priority</span>
        <span
          className={`item-value priority ${item.Priority?.toLowerCase()}`}
        >
          {item.Priority}
        </span>
      </div>

      {/* DATE */}
      <div className="footer-item">
        <span className="item-label">Applied On</span>
        <span className="item-value">
          {cleanDate(item.lfrom)}
        </span>
      </div>

      {/* AMOUNT */}
      <div className="footer-item">
        <span className="item-label">Amount</span>
        <span className="item-value">
          {item.Amount ? `₹ ${item.Amount}` : "-"}
        </span>
      </div>

      {/* FILE */}
      <div
        className="footer-item"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems:
            window.innerWidth <= 768 ? "flex-start" : "center",
        }}
      >
        <span className="item-label">File</span>

        {item.FilePath ? (
          <a
            href={item.FilePath}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#2563eb",
              textDecoration: "underline",
              fontWeight: 600,
              fontSize: "13px",
            }}
          >
            📥 Download
          </a>
        ) : (
          <span className="item-value">-</span>
        )}
      </div>
    </div>

    {/* COMMENTS SECTION */}
    {(item.RA1_Comment ||
      item.RA2_Comment ||
      item.RA3_Comment ||
      item.RA4_Comment) && (
      <div style={{ marginTop: "14px" }}>
        <b>Comments</b>

        {item.RA1_Comment && <p>🗨 {item.RA1}: {item.RA1_Comment}</p>}
        {item.RA2_Comment && <p>🗨 {item.RA2}: {item.RA2_Comment}</p>}
        {item.RA3_Comment && <p>🗨 {item.RA3}: {item.RA3_Comment}</p>}
        {item.RA4_Comment && <p>🗨 {item.RA4}: {item.RA4_Comment}</p>}
      </div>
    )}
  </div>
</>
                ) : type === "overtime" ? (
                    <>
  <div className="premium-card">
    <div className="card-accent"></div>

    {/* HEADER */}
    <div className="card-header">
      <div style={{ flex: 1 }}>
        <div>
          <span className="college-name">{item.Empname}</span>

          <span
            className={`badge-pill pill-${(item.L_status || "")
              .toLowerCase()
              .replace(/\s/g, "")}`}
          >
            {item.L_status}
          </span>
        </div>

        <span>Work : {item.Remarks}</span>
      </div>
    </div>

    {/* GRID */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          window.innerWidth <= 768
            ? "1fr"
            : "repeat(4, minmax(0, 1fr))",
        gap: "14px",
        marginTop: "14px",
      }}
    >
      {/* EMP */}
      {/* <div className="footer-item">
        <span className="item-label">Employee</span>
        <span className="item-value">{item.Empname}</span>
      </div> */}

      {/* DATE */}
      <div className="footer-item">
        <span className="item-label">Date</span>
        <span className="item-value">{item.lfrom}</span>
      </div>

      {/* TIME */}
      <div className="footer-item">
        <span className="item-label">Time</span>
        <span className="item-value">
          {item.Fromtime} → {item.Totime}
        </span>
      </div>

      {/* DURATION */}
      <div className="footer-item">
        <span className="item-label">Duration</span>
        <span className="item-value">
          {item.MinDiff} mins
        </span>
      </div>
    </div>
  </div>
</>
               
                ) : type === "onduty" ? (

<>
  <div className="history-section-title">On Duty Logs</div>

  <div className="premium-card">
    <div className="card-accent"></div>

    {/* HEADER */}
    <div className="card-header">
      <div style={{ flex: 1 }}>
        <div>
          <span className="college-name">{item.College}</span>

          <span
            className={`badge-pill pill-${(item.L_status || "")
              .toLowerCase()
              .replace(/\s/g, "")}`}
          >
            {item.L_status}
          </span>
        </div>

        <span>{item.Description}</span>
      </div>
    </div>

    {/* GRID SECTION */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          window.innerWidth <= 768
            ? "1fr"
            : "repeat(4, minmax(0, 1fr))",
        gap: "14px",
        marginTop: "14px",
      }}
    >
      {/* TRANSPORT */}
      <div className="footer-item">
        <span className="item-label">Transport</span>
        <span className="item-value">
          {item.Mode_of_Trans}
          {item.Vehicle_No && (
            <span style={{ color: "#64748b" }}>
              {" "}
              • {item.Vehicle_No}
            </span>
          )}
        </span>
      </div>

      {/* TIMELINE */}
      <div className="footer-item">
        <span className="item-label">Timeline</span>
        <span className="item-value">
          {fmtDate(item.DateFrom)} → {fmtDate(item.DateTo)}
        </span>
      </div>

      {/* LOCATION */}
      <div className="footer-item">
        <span className="item-label">Location</span>
        <span className="item-value">{item.Location}</span>
      </div>

    <a
  href="#"
  onClick={(e) => {
    e.preventDefault();
    setSelectedDuty(item);
    setViewModalOpen(true);
  }}
  style={{
    color: "#2563eb",
    textDecoration: "underline",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "13px",
  }}
>
  👁 View
</a>
    </div>
  </div>
</>
                ) : (
                    
                  <>

                  <div className="history-section-title">Leave Details</div>

  <div className="premium-card">
    <div className="card-accent"></div>

    {/* HEADER */}
    <div className="card-header">
      <div style={{ flex: 1 }}>
        <div>
          <span className="college-name">{item.Remarks}</span>

          {/* <span
            className={`badge-pill pill-${(item.L_status || "")
              .toLowerCase()
              .replace(/\s/g, "")}`}
          >
            {item.L_status}
          </span> */}
        </div>

       
      </div>
    </div>

    {/* GRID SECTION */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          window.innerWidth <= 768
            ? "1fr"
            : "repeat(4, minmax(0, 1fr))",
        gap: "14px",
        marginTop: "14px",
      }}
    >
      {/* LeaveCategory */}
      <div className="footer-item">
        <span className="item-label">Category</span>
        <span className="item-value">
         {item.LeaveCategory}
          {/* {item.Vehicle_No && (
            <span style={{ color: "#64748b" }}>
              {" "}
              • {item.LeaveCategory}
            </span>
          )} */}
        </span>
      </div>
       {/* Apply Date */}
      <div className="footer-item">
        <span className="item-label">Applied On</span>
        <span className="item-value"> {item.AppliedOn}</span>
      </div>

     {item?.ltype?.toLowerCase() === "permission" ? (
  <div className="footer-item">
    <span className="item-label">Permission Time</span>
    <span className="item-value">
      {cleanDate(item.lfrom)} {item.ptime ? `(${item.ptime})` : ""}
    </span>
  </div>
) : (
  <div className="footer-item">
    <span className="item-label">Leave Dates</span>
    <span className="item-value">
      {cleanDate(item.lfrom)}
      {cleanDate(item.lto) &&
      cleanDate(item.lto) !== cleanDate(item.lfrom)
        ? ` - ${cleanDate(item.lto)}`
        : ""}
    </span>
  </div>
)}

      {/* STATUS */}
      <div className="footer-item">
        <span className="item-label">Status</span>
        <span className="item-value"> {item.L_status}</span>
      </div>
    </div>
  </div>
                    {/* <p>
                      📅 {cleanDate(item.lfrom)}
                      {cleanDate(item.lto) && cleanDate(item.lto) !== cleanDate(item.lfrom)
                        ? ` - ${cleanDate(item.lto)}`
                        : ""}
                    </p>
                    <p>💬 {item.Remarks}</p>
                    <p>🏷 Category: {formatLeaveCategory(item.LeaveCategory)}</p> */}
                  </>
                )}

                {!item?.L_status?.toLowerCase().includes("rejected") && (
                  <p>👤 Approved By: {getApprovedBy(item)}</p>
                )}
                {item?.L_status?.toLowerCase().includes("pending") && (
                  <p>👤 {item?.L_status}</p>
                )}
                {getRejectionInfo(item) && (
                  <p style={{ color: "red", fontWeight: "bold" }}>
                    {getRejectionInfo(item)}
                  </p>
                )}
              </div>
{view !== "my" && canAct(item) && (
  <div className="card-actions">
{type === "onduty" ? (
  <>
    <button onClick={() => updateOnDuty(item, "Accepted")}>
      ✅ Approve
    </button>

    <button onClick={() => updateOnDuty(item, "Rejected")}>
      ❌ Reject
    </button>
  </>
) : type === "equipment" ? (
  <>
    {item.CurrentLevel === 1 && (
      <div className="input-group">
        <label>💰 Enter Amount</label>
        <input
          type="number"
          value={amountMap[item.lid] || ""}
          onChange={(e) =>
            handleAmountChange(item.lid, e.target.value)
          }
        />
      </div>
    )}

    <div className="input-group">
      <label>💬 Comment</label>
      <textarea
        value={commentMap[item.lid] || ""}
        onChange={(e) =>
          handleCommentChange(item.lid, e.target.value)
        }
      />
    </div>

    <button onClick={() => handleApprove(item)}>✅ Approve</button>
    <button onClick={() => handleReject(item)}>❌ Reject</button>
  </>
) : type === "overtime" ? (
  <>
    <button onClick={() => updateOvertime(item, "Accepted")}>
      ✅ Approve
    </button>

    <button onClick={() => updateOvertime(item, "Rejected")}>
      ❌ Reject
    </button>
  </>
) : (
  <>
    <button onClick={() => updateStatus(item.lid, "Accepted")}>
      ✅ Approve
    </button>

    <button onClick={() => updateStatus(item.lid, "Rejected")}>
      ❌ Reject
    </button>
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