import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonMenuButton,
  IonButton,
  IonSpinner,
  IonIcon,
} from "@ionic/react";
import { useLocation } from "react-router-dom";
import { calculatorOutline, saveOutline, checkmarkDoneOutline, chevronDown } from "ionicons/icons";
import { apiService } from "../utils/apiService";
import "./DaTaSettlement.css";

/*
  DA / TA settlement.

  DA is the person's hourly rate multiplied by the hours they were actually
  at the on-duty branch, worked out day by day from their punches.  A day
  with a missing punch pays nothing and does not disturb the rest of the
  camp.  TA is either the branch movement distance - which is held one way,
  so it is doubled - or the odometer reading off the day trip, which is
  already the real distance and is left as it is.

  Calculate reads only.  Nothing is written until Save, which freezes the
  rates as they stand today so a later change to somebody's profile cannot
  quietly rewrite a claim that has already been settled.
*/

type Row = {
  EmpCode: string;
  EmpName: string | null;
  DaysPresent: number;
  TotalHours: number;
  HourDA_Rate: number | null;
  DA_Amount: number;
  TA_Mode: string | null;
  TA_Distance: number;
  TA_Rate: number | null;
  TA_Amount: number;
  Fuel_Amount: number;
  Local_Amount: number;
  Total_Amount: number;
  Notes: string | null;
  Status?: string | null;
  Calculated_On?: string | null;
  Approved_By?: string | null;
};

type DayRow = {
  EmpCode: string;
  Duty_Date: string;
  FirstIn: string | null;
  LastOut: string | null;
  // The scheduled window the day was actually paid on. On the travel day
  // it comes from the branch movement master, afterwards from the
  // employee's own check-in time, and the evening end never runs past
  // 18:30 - so it very often differs from the punches beside it.
  PaidFrom: string | null;
  PaidTo: string | null;
  Punches: number;
  Hours: number;
  DA_Amount: number;
  MissingPunch: boolean;
};

const money = (n: any) => {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const hours = (n: any) => Number(n ?? 0).toFixed(2);

const clock = (t: any) => {
  if (!t) return "--";
  const s = String(t);
  const parts = s.split(":");
  if (parts.length < 2) return s;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return h + ":" + m + " " + ap;
};

const day = (d: any) => {
  if (!d) return "--";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const modeLabel = (m: string | null) => {
  switch (m) {
    case "PublicTransport": return "Public transport";
    case "OfficeVehicle": return "Office vehicle";
    case "PersonalVehicle": return "Own vehicle";
    case "Passenger": return "Passenger";
    case "None": return "No travel allowance";
    default: return m || "--";
  }
};

const DaTaSettlement: React.FC = () => {
  const location = useLocation();

  const initialDuty = useMemo(() => {
    const q = new URLSearchParams(location.search);
    return q.get("duty") || "";
  }, [location.search]);

  const [dutyId, setDutyId] = useState<string>(initialDuty);
  const [rows, setRows] = useState<Row[]>([]);
  const [days, setDays] = useState<DayRow[]>([]);
  const [openEmp, setOpenEmp] = useState<string | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [saved, setSaved] = useState<boolean>(false);

  const empCode = useMemo(() => {
    try {
      const raw = localStorage.getItem("userData");
      if (raw) {
        const u = JSON.parse(raw);
        return u?.EmpCode || u?._Ecode || u?.empCode || "";
      }
    } catch (e) { /* ignore */ }
    return localStorage.getItem("empCode") || "";
  }, []);

  const call = useCallback(async (route: string, body: any) => {
    return apiService.post("/OnDuty/" + route, body);
  }, []);

  const idNum = Number(dutyId);
  const idOk = Number.isFinite(idNum) && idNum > 0;

  const run = useCallback(async (what: "calc" | "saved") => {
    if (!idOk) { setErr("Enter the duty number first."); return; }
    setBusy(what); setErr(""); setMsg("");
    try {
      const route = what === "calc" ? "calc_datat" : "get_settlement";
      const data = await call(route, { Duty_Id: idNum });
      const list: Row[] = Array.isArray(data) ? data : [];
      setRows(list);
      setSaved(what === "saved");
      if (!list.length) {
        setMsg(what === "calc"
          ? "Nothing came back. Check the duty number, and that the request has a team list on it."
          : "This duty has not been settled yet. Calculate it, then save.");
      }
      const dayData = await call("datat_daybreakup", { Duty_Id: idNum });
      setDays(Array.isArray(dayData) ? dayData : []);
    } catch (e: any) {
      setErr(e?.message || "Could not reach the server.");
    } finally {
      setBusy("");
    }
  }, [call, idNum, idOk]);

  const save = useCallback(async () => {
    if (!idOk) { setErr("Enter the duty number first."); return; }
    setBusy("save"); setErr(""); setMsg("");
    try {
      const data = await call("save_settlement", { Duty_Id: idNum, By: empCode });
      const list: Row[] = Array.isArray(data) ? data : [];
      setRows(list);
      setSaved(true);
      setMsg("Saved. The rates above are now frozen against this duty.");
    } catch (e: any) {
      setErr(e?.message || "Could not save.");
    } finally {
      setBusy("");
    }
  }, [call, empCode, idNum, idOk]);

  const approve = useCallback(async (status: string) => {
    if (!idOk) { setErr("Enter the duty number first."); return; }
    setBusy(status); setErr(""); setMsg("");
    try {
      const data = await call("approve_settlement", { Duty_Id: idNum, Status: status, By: empCode });
      const list: Row[] = Array.isArray(data) ? data : [];
      setRows(list);
      setSaved(true);
      setMsg("Marked as " + status + ".");
    } catch (e: any) {
      setErr(e?.message || "Could not change the status.");
    } finally {
      setBusy("");
    }
  }, [call, empCode, idNum, idOk]);

  useEffect(() => {
    if (initialDuty) { run("saved"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDuty]);

  const totals = useMemo(() => {
    return rows.reduce((a, r) => ({
      da: a.da + Number(r.DA_Amount || 0),
      ta: a.ta + Number(r.TA_Amount || 0),
      fuel: a.fuel + Number(r.Fuel_Amount || 0),
      local: a.local + Number(r.Local_Amount || 0),
      total: a.total + Number(r.Total_Amount || 0),
    }), { da: 0, ta: 0, fuel: 0, local: 0, total: 0 });
  }, [rows]);

  const daysFor = (code: string) => days.filter((d) => d.EmpCode === code);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>DA / TA Settlement</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="dt-content">
        <div className="dt-wrap">

          <div className="dt-bar">
            <label className="dt-label" htmlFor="dt-duty">On-duty number</label>
            <input
              id="dt-duty"
              className="dt-input"
              inputMode="numeric"
              value={dutyId}
              placeholder="e.g. 123"
              onChange={(e) => setDutyId(e.target.value.replace(/[^0-9]/g, ""))}
            />
            <IonButton size="small" disabled={!idOk || busy !== ""} onClick={() => run("calc")}>
              <IonIcon slot="start" icon={calculatorOutline} />
              Calculate
            </IonButton>
            <IonButton size="small" fill="outline" disabled={!idOk || busy !== ""} onClick={() => run("saved")}>
              Open saved
            </IonButton>
            <IonButton size="small" color="success" disabled={!rows.length || busy !== ""} onClick={save}>
              <IonIcon slot="start" icon={saveOutline} />
              Save
            </IonButton>
            <IonButton size="small" color="tertiary" disabled={!saved || !rows.length || busy !== ""} onClick={() => approve("Approved")}>
              <IonIcon slot="start" icon={checkmarkDoneOutline} />
              Approve
            </IonButton>
            {busy !== "" && <IonSpinner name="dots" />}
          </div>

          {err !== "" && <div className="dt-note dt-note-bad">{err}</div>}
          {msg !== "" && <div className="dt-note">{msg}</div>}

          {rows.length > 0 && (
            <>
              <div className="dt-totals">
                <div><span>DA</span><strong>{money(totals.da)}</strong></div>
                <div><span>TA</span><strong>{money(totals.ta)}</strong></div>
                <div><span>Fuel</span><strong>{money(totals.fuel)}</strong></div>
                <div><span>Local</span><strong>{money(totals.local)}</strong></div>
                <div className="dt-grand"><span>Total</span><strong>{money(totals.total)}</strong></div>
              </div>

              <div className="dt-cards">
                {rows.map((r) => {
                  const open = openEmp === r.EmpCode;
                  const dd = daysFor(r.EmpCode);
                  return (
                    <div className={"dt-card" + (open ? " dt-card-open" : "")} key={r.EmpCode}>
                      <button
                        type="button"
                        className="dt-card-head"
                        onClick={() => setOpenEmp(open ? null : r.EmpCode)}
                      >
                        <div className="dt-who">
                          <div className="dt-name">{r.EmpName || r.EmpCode}</div>
                          <div className="dt-code">{r.EmpCode}</div>
                        </div>
                        <div className="dt-amt">
                          <div className="dt-amt-big">{money(r.Total_Amount)}</div>
                          {r.Status && <div className={"dt-status dt-status-" + String(r.Status).toLowerCase()}>{r.Status}</div>}
                        </div>
                        <IonIcon className="dt-chev" icon={chevronDown} />
                      </button>

                      <div className="dt-grid">
                        <div><span>Days present</span><strong>{r.DaysPresent}</strong></div>
                        <div><span>Hours</span><strong>{hours(r.TotalHours)}</strong></div>
                        <div><span>Hourly DA</span><strong>{r.HourDA_Rate == null ? "not set" : money(r.HourDA_Rate)}</strong></div>
                        <div><span>DA</span><strong>{money(r.DA_Amount)}</strong></div>
                        <div><span>Travel</span><strong>{modeLabel(r.TA_Mode)}</strong></div>
                        <div><span>Distance</span><strong>{hours(r.TA_Distance)} km</strong></div>
                        <div><span>Rate / km</span><strong>{r.TA_Rate == null ? "not set" : money(r.TA_Rate)}</strong></div>
                        <div><span>TA</span><strong>{money(r.TA_Amount)}</strong></div>
                        {Number(r.Fuel_Amount) > 0 && <div><span>Fuel</span><strong>{money(r.Fuel_Amount)}</strong></div>}
                        {Number(r.Local_Amount) > 0 && <div><span>Local transport</span><strong>{money(r.Local_Amount)}</strong></div>}
                      </div>

                      {r.Notes && <div className="dt-notes">{r.Notes}</div>}

                      {open && (
                        <div className="dt-days">
                          {dd.length === 0 && <div className="dt-note">No days to show for this person.</div>}
                          {dd.map((d, i) => (
                            <div className={"dt-day" + (d.MissingPunch ? " dt-day-miss" : "")} key={i}>
                              <span className="dt-day-date">{day(d.Duty_Date)}</span>
                              <span className="dt-day-in">{clock(d.FirstIn)}</span>
                              <span className="dt-day-sep">to</span>
                              <span className="dt-day-out">{clock(d.LastOut)}</span>
                              {!d.MissingPunch &&
                                (d.PaidFrom !== d.FirstIn || d.PaidTo !== d.LastOut) && (
                                <span className="dt-day-paid">
                                  paid {clock(d.PaidFrom)} to {clock(d.PaidTo)}
                                </span>
                              )}
                              <span className="dt-day-hrs">{hours(d.Hours)} h</span>
                              <span className="dt-day-amt">{money(d.DA_Amount)}</span>
                              {d.MissingPunch && <span className="dt-day-flag">punch missing</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {rows.length === 0 && busy === "" && err === "" && msg === "" && (
            <div className="dt-empty">
              Enter an on-duty number and press Calculate. Nothing is written until you press Save.
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default DaTaSettlement;
