// Salaries.tsx

import React, { useEffect, useState } from "react";
import {
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonLoading,
  IonPage,
  IonIcon,
} from "@ionic/react";

import {
  Box,
  Checkbox,
  Tooltip,
} from "@mui/material";

import { useHistory } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { documentTextOutline } from "ionicons/icons";

import moment from "moment";
import axios from "axios";
import "./Salaries.css";
import { API_BASE } from "../config";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { createTheme, ThemeProvider, alpha } from "@mui/material/styles";

const theme = createTheme();
(theme as any).alpha = alpha;

const EMP_1595_COLOR = "rgb(247 145 65)";

const mapGroupColor = (color: any) => {
  if (!color || color === "" || color === "null") return "#9cbce0"; // Fallback to Blue

  const lower = color.toString().toLowerCase().trim();

  if (lower === EMP_1595_COLOR.toLowerCase()) {
    return EMP_1595_COLOR;
  }

  if (lower === "#ffffff" || lower === "#fff" || lower === "white") {
    return "#ffffff";
  }

  if (
    lower === "#ffd700" ||
    lower === "#ff6f00ff" ||
    lower.includes("pink") ||
    lower.includes("lightpink") ||
    lower.includes("hotpink") ||
    lower.includes("orange") ||
    lower.includes("yellow") ||
    lower.includes("gold")
  ) {
    return "#ff6f00ff"; // Standard Orange Group
  }

  if (lower.startsWith("#")) {
    const hex = lower.substring(1);
    let r = 0,
      g = 0,
      b = 0;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6 || hex.length === 8) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
    if (r > 200 && r > b && b >= g) {
      return "#c6ceddff"; // Standard Gray Group
    }
  }

  if (lower.includes("gray") || lower.includes("grey") || lower === "#c6cedd" || lower === "#c6ceddff") {
    return "#c6ceddff"; // Standard Gray Group
  }

  return "#9cbce0"; // Fallback/Standard Blue Group
};


const Salaries: React.FC = () => {
  const history = useHistory();
  const [tabValue, setTabValue] = useState(0);

  // States from Angular Logic
  const [Hyear, setHyear] = useState<any>(moment().subtract(1, "M"));
  const [HMnth, setHMnth] = useState<any>(moment().subtract(1, "M"));

  const [dt_Holidays, setDt_Holidays] = useState<any[]>([]);
  const [dt_emp_Active, setDt_emp_Active] = useState<any[]>([]);
  const [dt_SalAdjust, setDt_SalAdjust] = useState<any[]>([]);

  const [SelectHls, setSelectHls] = useState(false);
  const [someSelectHls, setSomeSelectHls] = useState(false);

  const [SelectEmp, setSelectEmp] = useState(false);
  const [someSelectEmp, setSomeSelectEmp] = useState(false);

  const [SalMY, setSalMY] = useState<any>(moment().subtract(1, "M"));
  const [SalReset, setSalReset] = useState(false);

  const [loading, setLoading] = useState(false);

  const months = moment.months();

  // Helper for sequential API calls with delay (parity with Angular logic)
  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

  // ionViewWillEnter parity
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await DelETable();
      await DelHTable();
      await Load_EmployeesActive();
      await LoadHolidays();
      await LoadAdjustments();
      setLoading(false);
    };
    init();
  }, []);

  // Watchers for reactivity
  useEffect(() => {
    if (Hyear && HMnth) {
      LoadHolidays();
      Load_EmployeesActive();
    }
  }, [Hyear, HMnth]);

  useEffect(() => {
    if (SalMY) {
      LoadAdjustments();
    }
  }, [SalMY]);

  // ==========================
  // API 1: LOAD HOLIDAYS
  // ==========================
  const LoadHolidays = async () => {
    try {
      setSelectHls(false);
      let tmpyr = moment(Hyear).format("YYYY");
      let tmpmnth = moment(HMnth).format("M");

      if (tmpyr === "Invalid date" || !Hyear) tmpyr = moment().format("YYYY");
      if (tmpmnth === "Invalid date" || !HMnth) tmpmnth = moment().format("M");

      const res = await axios.get(
        `${API_BASE}Sources/Load_Holidays?yr=${tmpyr}&mnth=${tmpmnth}`
      );

      // item[7] is the boolean flag for active/valid holidays in the response
      const mappedData = res.data
        .filter((item: any) => item[7] === true)
        .map((item: any) => ({
          HolidayDate: item[1],
          Remark: item[2],
          isSelected: false,
        }));

      setDt_Holidays(mappedData);
    } catch (err) {
      console.log("Error LoadHolidays", err);
    }
  };

  // ==========================
  // API 2: LOAD EMPLOYEES
  // ==========================
  const Load_EmployeesActive = async () => {
    try {
      let tmpyr = moment(Hyear).format("YYYY");
      let tmpmnth = moment(HMnth).format("MMM");

      if (tmpyr === "Invalid date" || !Hyear) tmpyr = moment().format("YYYY");
      if (tmpmnth === "Invalid date" || !HMnth) tmpmnth = moment().format("MMM");

      const tmpMY = `${tmpmnth}-${tmpyr}`;

      const res = await axios.get(
        `${API_BASE}Salaries/Load_Sal_Employees?SalMY=${tmpMY}`
      );

      const rawData = res.data;
      const deduplicatedMap: any = {};

      // Load cached employee group colors from localStorage
      let cachedColors: Record<string, string> = {};
      try {
        const stored = localStorage.getItem("dbase_emp_colors");
        if (stored) {
          cachedColors = JSON.parse(stored);
        }
      } catch (e) {
        console.log("Error loading cached colors", e);
      }

      // Swagger shows duplicates: some with nulls (index 3=0) and some with data (index 3=1).
      // We prioritize the records that have a group color (index 4) or status flag (index 3=1).
      rawData.forEach((item: any) => {
        const empCode = item[0];
        const hasData = item[3] === 1 || item[4] !== null;

        if (!deduplicatedMap[empCode] || hasData) {
          let color = item[4] && item[4] !== "null" && item[4] !== "" ? mapGroupColor(item[4]) : null;

          // If color is present, save/update it in our cache
          if (color) {
            cachedColors[empCode] = color;
          } else {
            // Otherwise, try to restore it from our cache
            color = cachedColors[empCode] || null;
          }

          // Force colors for specific employees
          const whiteEmpCodes = ["1615", "1616", "1625", "1634"];
          if (whiteEmpCodes.includes(empCode)) {
            color = "#ffffff";
          } else if (empCode === "1595") {
            color = EMP_1595_COLOR;
          }

          deduplicatedMap[empCode] = {
            EmpCode: item[0],
            EmpName: item[1],
            SalMY: item[2],
            EmpGroupColor: color,
            Holidays: item[5],
            isSelected: false,
          };
        }
      });

      // Save the updated cache back to localStorage
      try {
        localStorage.setItem("dbase_emp_colors", JSON.stringify(cachedColors));
      } catch (e) {
        console.log("Error saving colors to cache", e);
      }

      // Ensure these specific employees are always present with exact data and colors on all months
      const requiredEmps = [
        { Code: "1615", Name: "1615-RYALI GANGA CHARI", Color: "#ffffff" },
        { Code: "1616", Name: "1616-PAMARTI VENKATA RAMESH", Color: "#ffffff" },
        { Code: "1625", Name: "1625-PAMARTHI SAI VARDHAN", Color: "#ffffff" },
        { Code: "1634", Name: "1634-MARTHA NAGU", Color: "#ffffff" },
        { Code: "1595", Name: "1595- KANKANA HARISH", Color: EMP_1595_COLOR },
      ];

      requiredEmps.forEach((emp) => {
        if (!deduplicatedMap[emp.Code]) {
          deduplicatedMap[emp.Code] = {
            EmpCode: emp.Code,
            EmpName: emp.Name,
            SalMY: tmpMY,
            EmpGroupColor: emp.Color,
            Holidays: "",
            isSelected: false,
          };
        } else {
          deduplicatedMap[emp.Code].EmpGroupColor = emp.Color;
        }
      });

      const mappedData = Object.values(deduplicatedMap);

      // Sort based on group color order:
      // 1. White (#ffffff) - specific 4 members (Rank 0)
      // 2. KANKANA HARISH (rgb(247 145 65), code 1595) (Rank 1)
      // 3. Other Orange (#ff6f00ff / #ffd700) (Rank 2)
      // 4. Gray (#c6ceddff) (Rank 3)
      // 5. Blue (others / #9cbce0) (Rank 4)
      mappedData.sort((a: any, b: any) => {
        const getRank = (emp: any) => {
          const code = emp.EmpCode;
          const color = (emp.EmpGroupColor || "").toString().toLowerCase();

          if (code === "1615" || code === "1616" || code === "1625" || code === "1634") return 0;
          if (code === "1595") return 1;
          if (color === "#ffd700" || color === "#ff6f00ff" || color.includes("orange") || color.includes("yellow") || color.includes("gold")) return 2;
          if (color === "#c6ceddff" || color === "#c6cedd" || color.includes("gray") || color.includes("grey")) return 3;
          return 4;
        };

        const rankA = getRank(a);
        const rankB = getRank(b);

        if (rankA !== rankB) {
          return rankA - rankB;
        }

        // Within White rank 0, preserve the exact user order: 1615 -> 1616 -> 1625 -> 1634
        if (rankA === 0) {
          const whiteOrder = ["1615", "1616", "1625", "1634"];
          return whiteOrder.indexOf(a.EmpCode) - whiteOrder.indexOf(b.EmpCode);
        }

        // For others in the same group, sort alphabetically/numerically
        return a.EmpName.localeCompare(b.EmpName);
      });

      setDt_emp_Active(mappedData);
    } catch (err) {
      console.log("Error Load_EmployeesActive", err);
    }
  };

  // ==========================
  // API 3 & 4: DELETE TEMP TABLES
  // ==========================
  const DelETable = async () => {
    try {
      await axios.post(`${API_BASE}Salaries/Delete_ETable`, "");
    } catch (err) {
      console.log("Error DelETable", err);
    }
  };

  const DelHTable = async () => {
    try {
      await axios.post(`${API_BASE}Salaries/Delete_HTable`, "");
    } catch (err) {
      console.log("Error DelHTable", err);
    }
  };

  // ==========================
  // API 5: INSERT EMP TABLE (SEQUENTIAL)
  // ==========================

  const InsertETable = async (data = dt_emp_Active) => {
  try {
    setLoading(true);

    const selectedEmployees = data
      .filter((x: any) => x.isSelected)
      .map((item: any) => ({
        EmpCode: item.EmpCode,
        EmpName: item.EmpName.replace(item.EmpCode + "-", ""),
      }));

    await axios.post(
      `${API_BASE}Salaries/Insert_ETable`,
      selectedEmployees
    );
  } catch (err) {
    console.log(err);
  } finally {
    setLoading(false);
  }
};
  // const InsertETable = async (data = dt_emp_Active) => {
  //   try {
  //     setLoading(true);
  //     await DelETable();
  //     for (const item of data) {
  //       if (item.isSelected) {
  //         await delay(50); // Angular parity
  //         const payload = {
  //           _Ecode: item.EmpCode,
  //           _Ename: item.EmpName.replace(item.EmpCode + "-", ""),
  //         };
  //         await axios.post(`${API_BASE}Salaries/Insert_ETable`, payload);
  //       }
  //     }
  //   } catch (err) {
  //     console.log(err);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // ==========================
  // API 6: INSERT HOLIDAY TABLE (SEQUENTIAL)
  // ==========================
  const InsertHTable = async (data = dt_Holidays) => {
    try {
      setLoading(true);
      await DelHTable();
      for (const item of data) {
        if (item.isSelected) {
          await delay(50); // Angular parity
          const payload = {
            _Hdt: moment(item.HolidayDate).format("DD-MM-YYYY"),
            _Remark: item.Remark,
          };
          await axios.post(`${API_BASE}Salaries/Insert_HTable`, payload);
        }
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  // ==========================
  // API 7: UPDATE EMP HOLIDAY
  // ==========================
  const UpdateEmpHoliday = async () => {
    try {
      setLoading(true);

      // Steps 1-4: Ensure temp tables are updated with current selections
      // InsertHTable and InsertETable internally call DelHTable and DelETable
      await InsertHTable(dt_Holidays);
      await InsertETable(dt_emp_Active);

      // Step 5: Final Update API
      let tmpyr = moment(Hyear).format("YYYY");
      let tmpmnth = moment(HMnth).format("MMM");
      const payload = { _SalMY: `${tmpmnth}-${tmpyr}` };

      await axios.post(`${API_BASE}Salaries/UpdateEmpHoliday`, payload);

      // Refresh data
      await Load_EmployeesActive();

      setSomeSelectEmp(false);
      setSelectEmp(false);
      alert("Employees Holidays Updated Successfully");
    } catch (err) {
      console.log(err);
      alert("Error While Updating");
    } finally {
      setLoading(false);
    }
  };

  // ==========================
  // API 8: GENERATE SALARIES
  // ==========================
  const Generate_Sal = async () => {
    try {
      if (!SalMY) return;
      setLoading(true);

      const tmpMY = moment(SalMY).format("MMM-YYYY");
      const payload = {
        _SalMY: tmpMY,
        _Reset: SalReset ? "Y" : "",
      };

      await axios.post(`${API_BASE}Salaries/GenerateSal`, payload);
      await LoadAdjustments();
      alert("Salaries Generated Successfully");
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  // ==========================
  // API 9: LOAD ADJUSTMENTS
  // ==========================
  const LoadAdjustments = async () => {
    try {
      if (!SalMY) return;
      const tmpMY = moment(SalMY).format("MMM-YYYY");
      const res = await axios.get(
        `${API_BASE}Salaries/Load_Sal_Adjustments?SalMY=${tmpMY}`
      );

      const mappedData = res.data.map((item: any) => ({
        Empcode: item[0],
        Empname: item[1],
        Add_Days: item[3],
        Remarks: item[4],
        Advance: item[5],
        Advance_Ded: item[6],
      }));

      setDt_SalAdjust(mappedData);
    } catch (err) {
      console.log(err);
    }
  };

  // ==========================
  // API 10: UPDATE ADJUSTMENT
  // ==========================
//  const UpdateAdjustment = async (
//   Ecode: any,
//   AddDays: any,
//   Remark: any,
//   AdvDed: any
// ) => {
//   try {
//     const tmpMY = moment(SalMY).format("MMM-YYYY");

//    const payload = {
//   _SalMY: tmpMY,
//   _Ecode: String(Ecode ?? ""),
//   _AddDays: AddDays === "" ? null : AddDays,
//   _Remark: Remark ?? "",
//   _AdvDed: AdvDed === "" ? null : AdvDed
// };

//     console.log("Sending Payload:", payload);

//     const res = await axios.post(
//       `${API_BASE}Salaries/UpdateSalAdjust`,
//       payload,
//       {
//         headers: {
//           "Content-Type": "application/json"
//         }
//       }
//     );

//     console.log("Update Success", res.data);
//   } catch (err: any) {
//     console.error("Response Data:", err?.response?.data);
//     console.error("Status:", err?.response?.status);
//     console.error("Error:", err);
//   }
// };

const UpdateAdjustmentField = async (
  Ecode: string,
  FieldName: string,
  Value: any
) => {
  try {

    const payload = {
      _SalMY: moment(SalMY).format("MMM-YYYY"),
      _Ecode: Ecode,
      _FieldName: FieldName,
      _Value: Value
    };

    console.log("Sending", payload);

    await axios.post(
      `${API_BASE}Salaries/UpdateSalAdjust`,
      payload,
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
  catch (err) {
    console.log(err);
  }
};
  // ==========================
  // Selection Logic
  // ==========================
  const selectUnselectAllEmp = async (e: any) => {
    const checked = e.target.checked;
    setSelectEmp(checked);
    const updated = dt_emp_Active.map((x: any) => ({ ...x, isSelected: checked }));
    setDt_emp_Active(updated);
    await InsertETable(updated);
  };

  const selectUnselectAllHls = async (e: any) => {
    const checked = e.target.checked;
    setSelectHls(checked);
    const updated = dt_Holidays.map((x: any) => ({ ...x, isSelected: checked }));
    setDt_Holidays(updated);
    await InsertHTable(updated);
  };

  const singleChangeEmp = async (e: any, id: any) => {
    const checked = e.target.checked;
    const updated = dt_emp_Active.map((x: any) =>
      x.EmpName === id ? { ...x, isSelected: checked } : x
    );
    setDt_emp_Active(updated);
    const filtered = updated.filter((x: any) => x.isSelected);
    setSelectEmp(filtered.length > 0);
    setSomeSelectEmp(filtered.length > 0 && filtered.length !== updated.length);
    await InsertETable(updated);
  };

  const singleChangeHls = async (e: any, id: any) => {
    const checked = e.target.checked;
    const updated = dt_Holidays.map((x: any) =>
      x.HolidayDate === id ? { ...x, isSelected: checked } : x
    );
    setDt_Holidays(updated);
    const filtered = updated.filter((x: any) => x.isSelected);
    setSelectHls(filtered.length > 0);
    setSomeSelectHls(filtered.length > 0 && filtered.length !== updated.length);
    await InsertHTable(updated);
  };

  return (
    <IonPage>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterMoment}>
          <IonContent className="page-content">
            <div className="wr-container stock-container" style={{ padding: 0, minHeight: 'auto', backgroundColor: 'transparent' }}>
              
              {/* ── Premium Header ── */}
              <div className="page-wr-header" style={{ margin: '16px', borderRadius: '16px', padding: '16px' }}>
                <div className="page-wr-header-left">
                  <button className="page-wr-back-btn" onClick={() => history.goBack()}>
                    <ChevronLeft size={22} color="white" />
                  </button>
                  <div>
                    <h1 className="page-wr-title">Salaries Dashboard</h1>
                    <p className="page-wr-subtitle">Official payroll management and holiday processing.</p>
                  </div>
                </div>
                <div className="page-wr-header-right">
                  <div className="page-wr-header-icon-box">
                    <IonIcon icon={documentTextOutline} style={{ color: 'var(--ion-color-primary)', fontSize: '24px' }} />
                  </div>
                </div>
              </div>

              {/* --- Custom Native-Like Tabs --- */}
              <div className="stock-tabs" style={{ margin: '0 16px' }}>
                <button
                  type="button"
                  className={`stock-tab ${tabValue === 0 ? "active" : ""}`}
                  onClick={() => setTabValue(0)}
                >
                  Assign Holidays
                </button>
                <button
                  type="button"
                  className={`stock-tab ${tabValue === 1 ? "active" : ""}`}
                  onClick={() => setTabValue(1)}
                >
                  Generate Salaries
                </button>
              </div>

            {/* TAB 1: ASSIGN HOLIDAYS */}
            {tabValue === 0 && (
              <div className="stock-panel" style={{ margin: '20px 16px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '20px' }}>
                  <DatePicker
                    views={["month", "year"]}
                    label="Mon-Year"
                    format="MMM-YYYY"
                    value={Hyear}
                    onChange={(newValue) => {
                      setHyear(newValue);
                      setHMnth(newValue);
                    }}
                    slotProps={{
                      textField: {
                        size: "small",
                        className: "date-input-field",
                      },
                    }}
                  />
                  <button
                    className="stock-button"
                    onClick={UpdateEmpHoliday}
                    disabled={!SelectHls || !SelectEmp}
                    style={{ height: '40px' }}
                  >
                    Update
                  </button>
                </div>

                <IonGrid className="ion-no-margin">
                  <IonRow>
                    {/* EMPLOYEES LIST */}
                    <IonCol size-lg="6" size-md="6" size-sm="12" size="12">
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <Checkbox
                            checked={SelectEmp}
                            indeterminate={someSelectEmp}
                            onChange={selectUnselectAllEmp}
                            size="small"
                            sx={{ "& .MuiSvgIcon-root": { fontSize: "18px !important" } }}
                          />
                          <b style={{ fontSize: "14px", color: "var(--stock-text)" }}>Select All Employees</b>
                        </div>

                        {/* GROUP WISE SELECTION */}
                        {Array.from(new Set(dt_emp_Active.map(x => x.EmpGroupColor))).filter(Boolean).map((color, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              const updated = dt_emp_Active.map(e =>
                                e.EmpGroupColor === color ? { ...e, isSelected: !e.isSelected } : e
                              );
                              setDt_emp_Active(updated);
                              const selectedCount = updated.filter(x => x.isSelected).length;
                              setSelectEmp(selectedCount === updated.length);
                              setSomeSelectEmp(selectedCount > 0 && selectedCount < updated.length);
                              InsertETable(updated);
                            }}
                            style={{
                              backgroundColor: mapGroupColor(color),
                              width: "24px",
                              height: "24px",
                              borderRadius: "4px",
                              cursor: "pointer",
                              border: "1px solid #ccc",
                              display: "inline-block"
                            }}
                            title="Select Group"
                          />
                        ))}
                      </div>

                      <div className="employee-list">
                        {dt_emp_Active.map((x: any, i: number) => (
                          <Tooltip title={x.Holidays || ""} key={i}>
                            <div
                              className={`Dynamic-card-style1 ${x.isSelected ? "highlighted" : ""}`}
                              style={{
                                backgroundColor: x.isSelected ? "var(--salary-row-highlight)" : mapGroupColor(x.EmpGroupColor) || "#9cbce0"
                              }}
                            >
                              <div className="badgeplain">{i + 1}</div>
                              <div className="checkbox-row">
                                <Checkbox
                                  size="small"
                                  sx={{ "& .MuiSvgIcon-root": { fontSize: "18px !important" } }}
                                  checked={x.isSelected || false}
                                  onChange={(e) => singleChangeEmp(e, x.EmpName)}
                                />
                                <span className="emp-name-text">{x.EmpName}</span>
                              </div>
                            </div>
                          </Tooltip>
                        ))}
                      </div>
                    </IonCol>

                    {/* HOLIDAYS LIST */}
                    <IonCol size-lg="6" size-md="6" size-sm="12" size="12">
                      <div style={{ padding: "10px 0", display: "flex", alignItems: "center" }}>
                        {HMnth && (
                          <>
                            <Checkbox
                              size="small"
                              sx={{ "& .MuiSvgIcon-root": { fontSize: "18px !important" } }}
                              checked={SelectHls}
                              indeterminate={someSelectHls}
                              onChange={selectUnselectAllHls}
                            />
                            <b style={{ fontSize: "14px", color: "var(--stock-text)" }}>Select All Holidays</b>
                          </>
                        )}
                      </div>

                      <div className="holiday-list">
                        {dt_Holidays.map((x: any, i: number) => (
                          <div className="card-style" key={i} style={{ backgroundColor: 'var(--stock-elevated-bg)', borderColor: 'var(--stock-border)' }}>
                            <Checkbox
                              size="small"
                              sx={{ "& .MuiSvgIcon-root": { fontSize: "18px !important" } }}
                              checked={x.isSelected || false}
                              onChange={(e) => singleChangeHls(e, x.HolidayDate)}
                            />
                            <div className="holiday-info" style={{ color: 'var(--stock-text)' }}>
                              <span className="holiday-date">
                                {i + 1} -- {moment(x.HolidayDate).format("DD-MM-YYYY")}
                              </span>
                              <span className="holiday-remark">{x.Remark}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </IonCol>
                  </IonRow>
                </IonGrid>
              </div>
            )}

            {/* TAB 2: GENERATE SALARIES */}
            {tabValue === 1 && (
              <div className="stock-panel" style={{ margin: '20px 16px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <DatePicker
                    views={["month", "year"]}
                    label="Mon-Year"
                    format="MMM-YYYY"
                    value={SalMY}
                    onChange={(newValue) => setSalMY(newValue)}
                    slotProps={{
                      textField: {
                        size: "small",
                        className: "date-input-field",
                      },
                    }}
                  />
                  <button
                    className="stock-button"
                    onClick={Generate_Sal}
                    style={{ height: '40px' }}
                  >
                    Generate
                  </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", marginBottom: '20px' }}>
                  <Checkbox
                    checked={SalReset}
                    onChange={(e: any) => setSalReset(e.target.checked)}
                    size="small"
                  />
                  <b style={{ fontSize: "14px", color: "var(--stock-text)" }}>Reset Adjustments</b>
                </div>

                <div className="adjustment-list-container" style={{ backgroundColor: 'var(--stock-elevated-bg)', borderRadius: '12px', border: '1px solid var(--stock-border)', overflow: 'hidden' }}>
                  <IonGrid className="ion-no-padding" style={{ marginTop: 0 }}>
                    <IonRow className="ion-grid-heading-row" style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: 'var(--stock-bg)' }}>
                      <IonCol size="4"><input value="Employee Name" readOnly style={{ backgroundColor: 'transparent', color: 'var(--stock-text)', border: 'none', fontWeight: 600 }} /></IonCol>
                      <IonCol size="2"><input value="Add_Days" readOnly style={{ backgroundColor: 'transparent', color: 'var(--stock-text)', border: 'none', fontWeight: 600 }} /></IonCol>
                      <IonCol size="2"><input value="Remarks" readOnly style={{ backgroundColor: 'transparent', color: 'var(--stock-text)', border: 'none', fontWeight: 600 }} /></IonCol>
                      <IonCol size="2"><input value="Advance" readOnly style={{ backgroundColor: 'transparent', color: 'var(--stock-text)', border: 'none', fontWeight: 600 }} /></IonCol>
                      <IonCol size="2"><input value="Adv. Repay" readOnly style={{ backgroundColor: 'transparent', color: 'var(--stock-text)', border: 'none', fontWeight: 600 }} /></IonCol>
                    </IonRow>
                    {dt_SalAdjust.map((x: any, i: number) => (
                      <IonRow key={i} className="adjustment-row" style={{ borderBottom: '1px solid var(--stock-border)' }}>
                        <IonCol size="4">
                          <input
                            type="text"
                            className="adjustment-input stock-input"
                            readOnly
                            value={x.Empname}
                            style={{ border: 'none', backgroundColor: 'transparent', height: '100%', padding: '8px' }}
                          />
                        </IonCol>
                        <IonCol size="2">
                          <input
                            type="number"
                            className="adjustment-input stock-input"
                            placeholder="Add Days"
                            value={x.Add_Days || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              const updated = [...dt_SalAdjust];
                              updated[i].Add_Days = value;
                              setDt_SalAdjust(updated);
                              UpdateAdjustmentField(x.Empcode, "Add_Days", value);
                            }}
                            style={{ border: 'none', backgroundColor: 'transparent', height: '100%', padding: '8px' }}
                          />
                        </IonCol>
                        <IonCol size="2">
                          <input
                            type="text"
                            className="adjustment-input stock-input"
                            placeholder="Remarks"
                            value={x.Remarks || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              const updated = [...dt_SalAdjust];
                              updated[i].Remarks = value;
                              setDt_SalAdjust(updated);
                              UpdateAdjustmentField(x.Empcode, "Remarks", value);
                            }}
                            style={{ border: 'none', backgroundColor: 'transparent', height: '100%', padding: '8px' }}
                          />
                        </IonCol>
                        <IonCol size="2">
                          <input
                            type="text"
                            className="adjustment-input stock-input"
                            readOnly
                            placeholder="Advance"
                            value={x.Advance || ""}
                            style={{ border: 'none', backgroundColor: 'transparent', height: '100%', padding: '8px' }}
                          />
                        </IonCol>
                        <IonCol size="2">
                          <input
                            type="text"
                            className="adjustment-input stock-input"
                            placeholder="Adv. Repay"
                            value={x.Advance_Ded || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              const updated = [...dt_SalAdjust];
                              updated[i].Advance_Ded = value;
                              setDt_SalAdjust(updated);
                              UpdateAdjustmentField(x.Empcode, "Advance_Ded", value);
                            }}
                            style={{ border: 'none', backgroundColor: 'transparent', height: '100%', padding: '8px' }}
                          />
                        </IonCol>
                      </IonRow>
                    ))}
                  </IonGrid>
                </div>
              </div>
            )}

            <IonLoading isOpen={loading} message="Processing..." />
            
            </div>
          </IonContent>
        </LocalizationProvider>
      </ThemeProvider>
    </IonPage>
  );
};

export default Salaries;
