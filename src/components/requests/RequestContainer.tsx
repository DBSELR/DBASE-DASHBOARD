import React, { useState } from "react";
import LeaveForm from "./LeaveForm";
import EquipmentForm from "./EquipmentForm";
import RequestList from "./RequestList";
import OverTime from "../../pages/OverTime"; 


const RequestContainer = ({ type, view }: any) => {
  const [status, setStatus] = useState("All");

  const normalizedType = (type || "").toLowerCase();

const showLeaveForm =
  view === "my" &&
  (normalizedType === "leave" ||
    normalizedType === "half day" ||
    normalizedType === "halfday" ||
    normalizedType === "permission");

    const showEquipmentForm =
    view === "my" && normalizedType === "equipment";

    const showOverTimeForm =
  view === "my" && normalizedType === "overtime";

//   const showLeaveForm =
//   view === "my" &&
//   (type?.toLowerCase() === "leave" || type?.toLowerCase() === "half day" || type?.toLowerCase() === "permission");

//   return (
//     <div>

//       <div className="status-filter-bar">
//         {["All", "Pending", "Accepted", "Rejected"].map((s) => (
//           <button
//             key={s}
//             className={`filter-btn ${status === s ? "active" : ""}`}
//             onClick={() => setStatus(s)}
//           >
//             {s}
//           </button>
//         ))}
//       </div>
//       {showLeaveForm && <LeaveForm defaultType={type} />}
//     {type === "equipment" && (
//   <>
//     {view === "my" && <EquipmentForm />}
//     <RequestList type="equipment" view={view} status={status} />
//   </>
// )}
//       <RequestList type={type} view={view} status={status} /> 

//       {/* ✅ ONLY SHOW FORM FOR LEAVE & PERMISSION
//       {view === "my" && (type === "leave" || type === "permission") && (
//         <LeaveForm defaultType={type} />
//       )}

//       <RequestList type={type} view={view} status={status} /> */}
//     </div>
//   );

return (
  <div>

    <div className="status-filter-bar">
      {["All", "Pending", "Accepted", "Rejected"].map((s) => (
        <button
          key={s}
          className={`filter-btn ${status === s ? "active" : ""}`}
          onClick={() => setStatus(s)}
        >
          {s}
        </button>
      ))}
    </div>

 {/* ✅ LEAVE FORM */}
{showLeaveForm && <LeaveForm defaultType={type} />}

{normalizedType === "overtime" ? (
  <>
    {/* ✅ FORM only in MY tab */}
    {view === "my" && <OverTime view={view} />}

    {/* ✅ LIST always */}
    <RequestList type="overtime" view={view} status={status} />
  </>
) : type === "equipment" ? (
  <>
    {view === "my" && <EquipmentForm />}
    <RequestList type="equipment" view={view} status={status} />
  </>
) : (
  <RequestList type={type} view={view} status={status} />
)}

  </div>
);
};

export default RequestContainer;