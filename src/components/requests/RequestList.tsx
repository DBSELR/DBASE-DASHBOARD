import React, { useEffect, useState } from "react";
import axios from "axios";
import moment from "moment";
import { API_BASE } from "../../config";
import "./RequestList.css";

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

// const normalize = (x: any) => {
//   if (!x) return null;

//   return {
//     lid: x.lid,
//     empcode: x.empcode,
//     Empname: safeText(x.Empname || x.empname),

//     lfrom: safeText(x.lfrom),
//     lto: safeText(x.lto),

//     // 🔥 KEEP FULL BACKEND STATUS
//     L_status: safeText(x.L_status),

//     ltype: safeText(x.ltype),
//     Remarks: safeText(x.Remarks),

//      Priority: x.Priority,
//     FilePath: x.FilePath,
//     Amount: x.Amount,

//     RA1_Status: x.RA1_Status,
//     RA2_Status: x.RA2_Status,
//     RA3_Status: x.RA3_Status,
//     RA4_Status: x.RA4_Status,

//     CurrentLevel: x.CurrentLevel,
//     MaxLevel: x.MaxLevel,
//     CurrentRA: x.CurrentRA,

//     LeaveCategory: safeText(x.LeaveCategory),

//         RA1: x.RA1,
//         RA2: x.RA2,
//         RA3: x.RA3,
//         RA4: x.RA4,

//          RA1_Comment: x.RA1_Comment,
//     RA2_Comment: x.RA2_Comment,
//     RA3_Comment: x.RA3_Comment,
//     RA4_Comment: x.RA4_Comment,
//     // RA2_Status: x.RA2_Status,
//     // RA3_Status: x.RA3_Status,
//     // RA4_Status: x.RA4_Status,
//   };
// };

// const normalize = (x: any) => {
//   if (!x) return null;

//   return {
//     // ✅ COMMON
//     lid: x.lid || x.Id,
//     empcode: x.empcode || x.EmpCode,
//     Empname: safeText(x.Empname || x.empname || x.EmpCode),

//     // ✅ EQUIPMENT FIX
//     Remarks: safeText(x.Remarks || x.Purpose),
//     Priority: x.Priority,
//     FilePath: x.FilePath,
//     Amount: x.Amount,

//     // ✅ DATE
//     lfrom: safeText(x.lfrom || x.AppliedOn),
//     lto: safeText(x.lto),

//     // ✅ STATUS FIX
//     L_status: safeText(x.L_status || x.Status),
//      LeaveCategory: safeText(x.LeaveCategory),

//     // ✅ APPROVAL
//     RA1_Status: x.RA1_Status,
//     RA2_Status: x.RA2_Status,
//     RA3_Status: x.RA3_Status,
//     RA4_Status: x.RA4_Status,

//     CurrentLevel: x.CurrentLevel,
//     MaxLevel: x.MaxLevel,
//     CurrentRA: x.CurrentRA,

//     RA1: x.RA1,
//     RA2: x.RA2,
//     RA3: x.RA3,
//     RA4: x.RA4,

//     RA1_Comment: x.RA1_Comment,
//     RA2_Comment: x.RA2_Comment,
//     RA3_Comment: x.RA3_Comment,
//     RA4_Comment: x.RA4_Comment,
//   };
// };


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

// const getRejectionInfo = (item: any) => {
//   if (item?.L_status?.includes("Rejected")) {
//     const level = item?.CurrentLevel;

//     const ra =
//       level === 1
//         ? "RA1"
//         : level === 2
//         ? "RA2"
//         : level === 3
//         ? "RA3"
//         : level === 4
//         ? "RA4"
//         : "Unknown";

//     const rejectedBy =
//       level === 1
//         ? item.RA1Name
//         : level === 2
//         ? item.RA2Name
//         : level === 3
//         ? item.RA3Name
//         : item.RA4Name;

//     return `❌ Rejected at ${ra} `;
//   }

//   return null;
// };

const getRejectionInfo = (item: any) => {
  if (!item?.L_status) return null;

  const status = String(item.L_status);

  if (status.toLowerCase().includes("rejected")) {
    // 🔥 SHOW EXACT BACKEND MESSAGE
    return status;
  }

  return null;
};
const RequestList: React.FC<any> = ({ type, view, status }) => {
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

  const normalize = (x: any) => {
    if (!x) return null;

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
        empcode: x.empcode,
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
    lfrom: safeText(x.lfrom || x.AppliedOn),
    lto: safeText(x.lto),

    // ✅ STATUS FIX
    L_status: safeText(x.L_status || x.Status),
     LeaveCategory: safeText(x.LeaveCategory),

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
          safeText(x?.empname).toLowerCase().includes(s) ||
          safeText(x?.empcode).toLowerCase().includes(s)
      )
    );
  }, [search, data]);

//   const loadData = async () => {
//     const empCode = getUser()?.empCode;
//     const leaveType = type === "permission" ? "Permission" : "Leave";

//     setLoading(true);

//     try {
//       const url =
//         view === "my"
//           ? `${baseUrl}Leave/Load_Leave_Permission?Empcode=${empCode}&Seachdate=${selectedMonth}&LType=${leaveType}`
//           : `${baseUrl}Leave/loadrequests_leave_permission?Empcode=${empCode}&Seachdate=${selectedMonth}&LType=${leaveType}`;

//       const res = await axios.get(url, { headers: getAuthHeaders() });

//       console.log("API:", res.data);

//       const result = (Array.isArray(res.data) ? res.data : [])
//         .map(normalize)
//         .filter(Boolean);

//       setData(result);
//       setFiltered(result);
//     } catch (e) {
//       console.error(e);
//       setData([]);
//       setFiltered([]);
//     } finally {
//       setLoading(false);
//     }
//   };


const loadData = async () => {
  const empCode = getUser()?.empCode;

  // ✅ SET LTYPE PROPERLY
//   const leaveType =
//     type === "permission"
//       ? "Permission"
//       : type === "leave" || type === "Half Day"
//       ? "Leave"
//       : "";
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

//   try {
//     const url =
//       view === "my"
//         ? `${baseUrl}Leave/Load_Leave_Permission?Empcode=${empCode}&Seachdate=${selectedMonth}&LType=${type}`
//         : `${baseUrl}Leave/loadrequests_leave_permission?Empcode=${empCode}&Seachdate=${selectedMonth}&LType=${type}`;

//     const res = await axios.get(url, { headers: getAuthHeaders() });

//     const raw = Array.isArray(res.data) ? res.data : [];

//     const result = raw.map(normalize).filter(Boolean);

//     // ❌ REMOVE THIS (no need now)
//     // filtering already handled in backend

//     setData(result);
//     setFiltered(result);

//   } catch (e) {
//     console.error(e);
//     setData([]);
//     setFiltered([]);
//   } finally {
//     setLoading(false);
//   }

try {
    let url = "";

    //  OVERTIME API
      if (type === "overtime") {
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
  } catch (e) {
    console.error(e);
    setData([]);
    setFiltered([]);
  } finally {
    setLoading(false);
  }
};
  const filterByStatus = (item: any) => {
  const s = (status || "All").toLowerCase();

  const raw = (item?.L_status || "").toLowerCase();

  if (s === "all") return true;

  if (s === "pending") {
    return raw.includes("pending");
  }

  if (s === "accepted") {
    return raw.includes("approved") || raw.includes("accepted");
  }

  if (s === "rejected") {
    return raw.includes("rejected");
  }

  return true;
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

//   const getStatusLabel = (item: any) => {
//     if (item?.L_status === "Rejected") return "Rejected ❌";
//     if (item?.RA4_Status === "Accepted") return "Approved ✅";
//     if (item?.RA3_Status === "Accepted") return "Pending at RA4";
//     if (item?.RA2_Status === "Accepted") return "Pending at RA3";
//     if (item?.RA1_Status === "Accepted") return "Pending at RA2";
//     return "Pending at RA1";
//   };

const getStatusLabel = (item: any) => {
  // 🔥 SHOW EXACT BACKEND VALUE
  return item?.L_status || "";
};

 const getApprovedBy = (item: any) => {
  // ❌ If rejected → DO NOT SHOW ANYTHING
  if (item?.L_status?.toLowerCase().includes("rejected")) {
    return null;
  }

  const list: string[] = [];

  if (item?.RA1_Status === "Accepted") list.push(item.RA1);
  if (item?.RA2_Status === "Accepted") list.push(item.RA2);
  if (item?.RA3_Status === "Accepted") list.push(item.RA3);
  if (item?.RA4_Status === "Accepted") list.push(item.RA4);

  return list.length ? list.join(" → ") : "Not Approved Yet";
};
  const canAct = (item: any) => {
    const user = safeText(getUser()?.designation).trim().toUpperCase();
    const current = safeText(item?.CurrentRA).trim().toUpperCase();

    if (!item) return false;
    if (item.L_status === "Accepted" || item.L_status === "Rejected")
      return false;

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
          .map((item) => (
            <div key={`${item.lid}-${item.empcode}`} className="premium-card">

              <div className="card-header">
                <div>
                  <b>{item.Empname}</b>
                  <p>ID: {item.empcode}</p>
                </div>

                <div className="status-pill">
                  {getStatusLabel(item)}
                </div>
              </div>

              <div className="card-body">
                
                
           {type === "equipment" ? (
  <div className="equipment-card">

    <div className="row">
      <span className="label">👤 Emp Code:</span>
      <span>{item.empcode}</span>
    </div>

    <div className="row">
      <span className="label">📝 Purpose:</span>
      <span>{item.Remarks}</span>
    </div>

    <div className="row">
      <span className="label">⚡ Priority:</span>
      <span className={`priority ${item.Priority?.toLowerCase()}`}>
        {item.Priority}
      </span>
    </div>

    <div className="row">
      <span className="label">📅 Applied On:</span>
      <span>{cleanDate(item.lfrom)}</span>
    </div>

    {item.FilePath && (
      <div className="row">
        <span className="label">📎 File:</span>
       <a href={item.FilePath} target="_blank" rel="noopener noreferrer" download>
  📥 Download File
</a>
      </div>
    )}

    {item.Amount && (
      <div className="row">
        <span className="label">💰 Amount:</span>
        <span>₹{item.Amount}</span>
      </div>
    )}

    {/* COMMENTS */}
    {item.RA1_Comment && <p>🗨 RA1: {item.RA1_Comment}</p>}
    {item.RA2_Comment && <p>🗨 RA2: {item.RA2_Comment}</p>}
    {item.RA3_Comment && <p>🗨 RA3: {item.RA3_Comment}</p>}
    {item.RA4_Comment && <p>🗨 RA4: {item.RA4_Comment}</p>}

  </div>
) : type === "overtime" ? (
  <div className="equipment-card">

    <div className="row">
      <span className="label">👤 Emp:</span>
      <span>{item.Empname}</span>
    </div>

    <div className="row">
      <span className="label">📅 Date:</span>
      <span>{item.lfrom}</span>
    </div>

    <div className="row">
      <span className="label">⏰ Time:</span>
      <span>{item.Fromtime} - {item.Totime}</span>
    </div>

    <div className="row">
      <span className="label">🕒 Duration:</span>
      <span>{item.MinDiff} mins</span>
    </div>

    <div className="row">
      <span className="label">📝 Work:</span>
      <span>{item.Remarks}</span>
    </div>

  </div>
) : (
  <>
    <p>
      📅 {cleanDate(item.lfrom)}
      {cleanDate(item.lto) && cleanDate(item.lto) !== cleanDate(item.lfrom)
        ? ` - ${cleanDate(item.lto)}`
        : ""}
    </p>
    <p>💬 {item.Remarks}</p>
    <p>🏷 Category: {formatLeaveCategory(item.LeaveCategory)}</p>
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

              <div className="timeline">
                <div className={item.RA1_Status === "Accepted" ? "done" : ""}>RA1</div>
                <div className={item.RA2_Status === "Accepted" ? "done" : ""}>RA2</div>
                <div className={item.RA3_Status === "Accepted" ? "done" : ""}>RA3</div>
                <div className={item.RA4_Status === "Accepted" ? "done" : ""}>FINAL</div>
              </div>

              {/* 🔥 STRICT APPROVAL CONTROL: Only show buttons for team view AND current approver */}
            {/* ✅ APPROVAL SECTION WITH COMMENTS + AMOUNT */}
{view === "raised" && canAct(item) && (
  <div className="card-actions">

    {/* ✅ EQUIPMENT APPROVAL */}
    {type === "equipment" ? (
      <>
        {/* 💰 ONLY RA1 CAN ENTER AMOUNT */}
        {item.CurrentLevel === 1 && (
           <div className="input-group">
    <label>💰 Enter Amount</label>
    <input
      type="number"
      placeholder="Enter approved amount"
      value={amountMap[item.lid] || ""}
      onChange={(e) =>
        handleAmountChange(item.lid, e.target.value)
      }
      className="amount-box"
    />
  </div>
        )}

        {/* 💬 COMMENT */}
        <div className="input-group">
  <label>💬 Approval Comment</label>
  <textarea
    rows={3}
    placeholder="Enter your approval/rejection comment..."
    value={commentMap[item.lid] || ""}
    onChange={(e) =>
      handleCommentChange(item.lid, e.target.value)
    }
    className="comment-box"
  />
</div>

        <button
          className="approve-btn"
          onClick={() => handleApprove(item)}
        >
          ✅ Approve
        </button>

        <button
          className="reject-btn"
          onClick={() => handleReject(item)}
        >
          ❌ Reject
        </button>
      </>
   ) : type === "overtime" ? (
  <>
    <button
      className="approve-btn"
      onClick={() => updateOvertime(item, "Accepted")}
    >
      ✅ Approve
    </button>

    <button
      className="reject-btn"
      onClick={() => updateOvertime(item, "Rejected")}
    >
      ❌ Reject
    </button>
  </>
) : (
  <>
    <button
      className="approve-btn"
      onClick={() => updateStatus(item.lid, "Accepted")}
    >
      ✅ Approve
    </button>

    <button
      className="reject-btn"
      onClick={() => updateStatus(item.lid, "Rejected")}
    >
      ❌ Reject
    </button>
  </>
)}
  </div>
)}

            </div>
          ))}
      {!loading && filtered.length === 0 && <p>No data found</p>}
    </div>
  );
};

export default RequestList;