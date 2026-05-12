// Salaries.tsx

import React, { useEffect, useState } from "react";
import {
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonLoading,
} from "@ionic/react";

import {
  Tabs,
  Tab,
  Box,
  Checkbox,
  TextField,
  Button,
  Tooltip,
} from "@mui/material";

import TodayIcon from "@mui/icons-material/Today";
import ClearIcon from "@mui/icons-material/Clear";
import DownloadIcon from "@mui/icons-material/GetApp";

import moment from "moment";
import axios from "axios";
import "./Salaries.css";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { createTheme, ThemeProvider, alpha } from "@mui/material/styles";

const theme = createTheme();
(theme as any).alpha = alpha;

const API_URL = "http://localhost:25918/api/";

const Salaries: React.FC = () => {
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
        `${API_URL}Sources/Load_Holidays?yr=${tmpyr}&mnth=${tmpmnth}`
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
        `${API_URL}Salaries/Load_Sal_Employees?SalMY=${tmpMY}`
      );

      const rawData = res.data;
      const deduplicatedMap: any = {};

      // Swagger shows duplicates: some with nulls (index 3=0) and some with data (index 3=1).
      // We prioritize the records that have a group color (index 4) or status flag (index 3=1).
      rawData.forEach((item: any) => {
        const empCode = item[0];
        const hasData = item[3] === 1 || item[4] !== null;

        if (!deduplicatedMap[empCode] || hasData) {
          deduplicatedMap[empCode] = {
            EmpCode: item[0],
            EmpName: item[1],
            SalMY: item[2],
            EmpGroupColor: item[4],
            Holidays: item[5],
            isSelected: false,
          };
        }
      });

      const mappedData = Object.values(deduplicatedMap);
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
      await axios.post(`${API_URL}Salaries/Delete_ETable`, "");
    } catch (err) {
      console.log("Error DelETable", err);
    }
  };

  const DelHTable = async () => {
    try {
      await axios.post(`${API_URL}Salaries/Delete_HTable`, "");
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
      await DelETable();
      for (const item of data) {
        if (item.isSelected) {
          await delay(50); // Angular parity
          const payload = {
            _Ecode: item.EmpCode,
            _Ename: item.EmpName.replace(item.EmpCode + "-", ""),
          };
          await axios.post(`${API_URL}Salaries/Insert_ETable`, payload);
        }
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

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
          await axios.post(`${API_URL}Salaries/Insert_HTable`, payload);
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

      await axios.post(`${API_URL}Salaries/UpdateEmpHoliday`, payload);

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

      await axios.post(`${API_URL}Salaries/GenerateSal`, payload);
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
        `${API_URL}Salaries/Load_Sal_Adjustments?SalMY=${tmpMY}`
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
  const UpdateAdjustment = async (
    Ecode: any,
    AddDays: any,
    Remark: any,
    AdvDed: any
  ) => {
    try {
      if (!SalMY) return;
      const tmpMY = moment(SalMY).format("MMM-YYYY");
      const payload = {
        _SalMY: tmpMY,
        _Ecode: Ecode,
        _AddDays: AddDays || 0,
        _Remark: Remark || "",
        _AdvDed: AdvDed || 0,
      };

      await axios.post(`${API_URL}Salaries/UpdateSalAdjust`, payload);
    } catch (err) {
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
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterMoment}>
        <IonContent>
          <Box sx={{ width: "100%" }}>
            <Tabs
              value={tabValue}
              onChange={(e, newValue) => setTabValue(newValue)}
              className="salary-tabs"
              variant="fullWidth"
            >
              <Tab label="Assign Holidays" className="salary-tab" />
              <Tab label="Generate Salaries" className="salary-tab" />
            </Tabs>

            {/* TAB 1: ASSIGN HOLIDAYS */}
            {tabValue === 0 && (
              <IonGrid className="ion-no-margin">
                <IonRow className="salary-header-row" style={{ justifyContent: "center" }}>
                  <IonCol size="3" style={{ textAlign: "center" }}>
                    <Button
                      variant="outlined"
                      className="update-btn"
                      onClick={UpdateEmpHoliday}
                      disabled={!SelectHls || !SelectEmp}
                      fullWidth
                    >
                      <DownloadIcon />
                      &nbsp;Update
                    </Button>
                  </IonCol>

                  <IonCol size="9">
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
                          fullWidth: true,
                          className: "date-input-field",
                        },
                      }}
                    />
                  </IonCol>
                </IonRow>

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
                        />
                        <b style={{ fontSize: "14px" }}>Select All Employees</b>
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
                            backgroundColor: color,
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
                            className={`Dynamic-card-style1 ${x.isSelected ? "highlighted" : ""
                              }`}
                            style={{
                              backgroundColor: x.isSelected ? "var(--salary-row-highlight)" : x.EmpGroupColor || "#9cbce0"
                            }}
                          >
                            <div className="badgeplain">{i + 1}</div>
                            <div className="checkbox-row">
                              <Checkbox
                                size="small"
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
                    <div style={{ padding: "10px 0" }}>
                      {HMnth && (
                        <>
                          <Checkbox
                            checked={SelectHls}
                            indeterminate={someSelectHls}
                            onChange={selectUnselectAllHls}
                          />
                          <b>Select All Holidays</b>
                        </>
                      )}
                    </div>

                    <div className="holiday-list">
                      {dt_Holidays.map((x: any, i: number) => (
                        <div className="card-style" key={i}>
                          <Checkbox
                            size="small"
                            checked={x.isSelected || false}
                            onChange={(e) => singleChangeHls(e, x.HolidayDate)}
                          />
                          <div className="holiday-info">
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
            )}

            {/* TAB 2: GENERATE SALARIES */}
            {tabValue === 1 && (
              <>
                <IonGrid className="ion-no-margin">
                  <IonRow className="salary-header-row" style={{ justifyContent: "flex-start", gap: "10px" }}>
                    <IonCol size="9">
                      <DatePicker
                        views={["month", "year"]}
                        label="Mon-Year"
                        format="MMM-YYYY"
                        value={SalMY}
                        onChange={(newValue) => setSalMY(newValue)}
                        slotProps={{
                          textField: {
                            size: "small",
                            fullWidth: true,
                            className: "date-input-field",
                          },
                        }}
                      />
                    </IonCol>
                    <IonCol size="3">
                      <Button
                        variant="outlined"
                        className="update-btn"
                        onClick={Generate_Sal}
                        fullWidth
                      >
                        <DownloadIcon />
                        &nbsp;Generate
                      </Button>
                    </IonCol>
                  </IonRow>

                  <IonRow style={{ padding: "0 10px" }}>
                    <IonCol size="12" style={{ display: "flex", alignItems: "center" }}>
                      <Checkbox
                        checked={SalReset}
                        onChange={(e: any) => setSalReset(e.target.checked)}
                        size="small"
                      />
                      <b>Reset Adjustments</b>
                    </IonCol>
                  </IonRow>
                </IonGrid>

                <IonGrid className="ion-no-padding" style={{ marginTop: 0 }}>
                  <div className="adjustment-list-container">
                    <IonRow className="ion-grid-heading-row" style={{ position: "sticky", top: 0, zIndex: 10 }}>
                      <IonCol size="4"><input value="Employee Name" readOnly /></IonCol>
                      <IonCol size="2"><input value="Add_Days" readOnly /></IonCol>
                      <IonCol size="2"><input value="Remarks" readOnly /></IonCol>
                      <IonCol size="2"><input value="Advance" readOnly /></IonCol>
                      <IonCol size="2"><input value="Adv. Repay" readOnly /></IonCol>
                    </IonRow>
                    {dt_SalAdjust.map((x: any, i: number) => (
                      <IonRow key={i} className="adjustment-row">
                        <IonCol size="4">
                          <input
                            type="text"
                            className="adjustment-input"
                            readOnly
                            value={x.Empname}
                          />
                        </IonCol>
                        <IonCol size="2">
                          <input
                            type="number"
                            className="adjustment-input"
                            placeholder="Add Days"
                            value={x.Add_Days || ""}
                            onChange={(e: any) => {
                              const updated = [...dt_SalAdjust];
                              updated[i].Add_Days = e.target.value;
                              setDt_SalAdjust(updated);
                            }}
                            onBlur={() =>
                              UpdateAdjustment(x.Empcode, x.Add_Days, x.Remarks, x.Advance_Ded)
                            }
                          />
                        </IonCol>
                        <IonCol size="2">
                          <input
                            type="text"
                            className="adjustment-input"
                            placeholder="Remarks"
                            value={x.Remarks || ""}
                            onChange={(e: any) => {
                              const updated = [...dt_SalAdjust];
                              updated[i].Remarks = e.target.value;
                              setDt_SalAdjust(updated);
                            }}
                            onBlur={() =>
                              UpdateAdjustment(x.Empcode, x.Add_Days, x.Remarks, x.Advance_Ded)
                            }
                          />
                        </IonCol>
                        <IonCol size="2">
                          <input
                            type="text"
                            className="adjustment-input"
                            readOnly
                            placeholder="Advance"
                            value={x.Advance || ""}
                          />
                        </IonCol>
                        <IonCol size="2">
                          <input
                            type="text"
                            className="adjustment-input"
                            placeholder="Adv. Repay"
                            value={x.Advance_Ded || ""}
                            onChange={(e: any) => {
                              const updated = [...dt_SalAdjust];
                              updated[i].Advance_Ded = e.target.value;
                              setDt_SalAdjust(updated);
                            }}
                            onBlur={() =>
                              UpdateAdjustment(x.Empcode, x.Add_Days, x.Remarks, x.Advance_Ded)
                            }
                          />
                        </IonCol>
                      </IonRow>
                    ))}
                  </div>
                </IonGrid>
              </>
            )}
          </Box>

          <IonLoading isOpen={loading} message="Processing..." />
        </IonContent>

        <div className="headerblank"></div>
      </LocalizationProvider>
    </ThemeProvider>
  );
};

export default Salaries;
