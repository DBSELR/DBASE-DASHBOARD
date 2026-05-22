import React, { useEffect, useState } from "react";
import axios from "axios";
import "./DaywiseAttendanceDashboard.css";
import { API_BASE } from "../config";

const API =
  `${API_BASE}Timings/GetDaywiseAttendanceDashboard`;

const DaywiseAttendanceDashboard = () => {

  const today = new Date();

  const [month, setMonth] =
    useState(today.getMonth() + 1);

  const [year, setYear] =
    useState(today.getFullYear());

  const [data, setData] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(false);

  const user =
    JSON.parse(localStorage.getItem("user") || "{}");

  //--------------------------------------------------
  // LOAD DATA
  //--------------------------------------------------

  useEffect(() => {
    setData([]);

    loadAttendance();

  }, [month, year]);

  //--------------------------------------------------
  // API
  //--------------------------------------------------

const loadAttendance = async () => {

  try {

    setLoading(true);

    const response = await axios.get(API, {

      params: {
        empCode: user.empCode,
        loggedEmpCode: user.empCode,
        month,
        year,

        //--------------------------------
        // CACHE BREAKER
        //--------------------------------

        t: new Date().getTime(),
      },

      //--------------------------------
      // NO CACHE HEADERS
      //--------------------------------

      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        Expires: "0",
      },
    });

    console.log(
      "API RESPONSE :",
      response.data
    );

    //--------------------------------
    // ALWAYS SET FRESH DATA
    //--------------------------------

    if (response.data?.success) {

      setData([
        ...response.data.data
      ]);

    } else {

      setData([]);
    }

  } catch (error) {

    console.error(
      "Attendance Error :",
      error
    );

    setData([]);

  } finally {

    setLoading(false);
  }
};

  //--------------------------------------------------
  // UI
  //--------------------------------------------------

  return (
    <div className="attendance-page">

      <div className="attendance-header">

        <h2>Daywise Attendance Dashboard</h2>

        <div className="attendance-filters">

          <select
            value={month}
            onChange={(e) =>
              setMonth(Number(e.target.value))
            }
          >
            {[...Array(12)].map((_, i) => (
              <option
                key={i + 1}
                value={i + 1}
              >
                {new Date(0, i).toLocaleString(
                  "default",
                  {
                    month: "long",
                  }
                )}
              </option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) =>
              setYear(Number(e.target.value))
            }
          >
            {[2025, 2026, 2027, 2028].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

        </div>
      </div>

      <div className="attendance-table-wrapper">

        <table className="attendance-table">

          <thead>

            <tr>
              <th>Date</th>
              <th>Morning In</th>
              <th>Lunch Out</th>
              <th>Lunch In</th>
              <th>Evening Out</th>
              <th>Grace Type</th>
              <th>Status</th>
              <th>Morning Late</th>
              <th>Lunch Late</th>
              <th>LOP</th>
            </tr>

          </thead>

         <tbody>

  {loading ? (

    <tr>
      <td colSpan={10}>
        Loading...
      </td>
    </tr>

  ) : data.length === 0 ? (

    <tr>
      <td colSpan={10}>
        No records found
      </td>
    </tr>

  ) : (

    data.map((item, index) => (

      <tr key={index}>

        <td>
          {item.logDate || "-"}
        </td>

        <td>
          {item.morningTime || "-"}
        </td>

        <td>
          {item.lunchOut || "-"}
        </td>

        <td>
          {item.lunchIn || "-"}
        </td>

        <td>
          {item.eveningOut || "-"}
        </td>

        <td>

          <span
            className={`badge ${item.graceType}`}
          >
            {item.graceType || "-"}
          </span>

        </td>

        <td>
          {item.attendanceStatus || "-"}
        </td>

        <td>
          {item.morningLateMinutes || 0}
        </td>

        <td>
          {item.lunchLateMinutes || 0}
        </td>

        <td>
          {item.lopMinutes || 0}
        </td>

      </tr>

    ))

  )}

</tbody>

        </table>

      </div>

    </div>
  );
};

export default DaywiseAttendanceDashboard;