import React, { useCallback, useEffect, useMemo, useState } from "react";
import { IonButton, IonSpinner, IonIcon } from "@ionic/react";
import { saveOutline, checkmarkDoneOutline, chevronDown } from "ionicons/icons";
import { apiService } from "../utils/apiService";
import "../pages/DaTaSettlement.css";

/*
  Same DA / TA settlement view as the DaTaSettlement page (src/pages), shown
  as a popup instead of a full page navigation. Opened directly from
  wherever a duty is already on screen - the "On Duty Details" popup, a
  Team Requests card, an On Duty Logs card - so the user never leaves what
  they were looking at to see the numbers.

  Deliberately a self-contained copy of the page's state/logic rather than
  a shared hook: the page keeps working on its own (reachable directly by
  URL) and this modal can be dropped into any screen with just a duty id,
  without either one risking breaking the other.

  Reuses the app's existing .modal-overlay / .modal-container / .modal-header
  classes (from RequestList.css, already loaded globally by both
  RequestList.tsx and OnDuties.tsx) for the shell, and DaTaSettlement.css
  for the DA/TA-specific styling inside it.

  Note: Reading From/To and Fuel are shown here as plain day-wise values
  (part of how the TA figure was worked out), but the PHOTO evidence behind
  them - reading/fuel/client/local-transport images - is deliberately NOT
  shown here; that belongs with the rest of the visit details (see
  RequestList.tsx's "On Duty Details" popup), not duplicated into the
  DA/TA figures.
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
  PaidFrom: string | null;
  PaidTo: string | null;
  Punches: number;
  Hours: number;
  Km: number | null;
  DA_Amount: number;
  MissingPunch: boolean;
  // What this person actually spent on this day - fuel billed on the
  // office vehicle, and local transport claimed on that day's visits.
  // Appended to App_Get_OnDuty_DayBreakup with the same Created_By
  // attribution App_Calc_OnDuty_DA_TA uses, so a person's day figures
  // add up to the Fuel/Local totals on their card. Undefined until that
  // proc has been altered.
  Fuel_Amount?: number | null;
  Local_Amount?: number | null;
};

// One row per day of the trip (tbl_OnDuty_DayTrip via App_Get_DayTrips) -
// duty-day facts, not per-employee ones, since the whole team shares the
// same vehicle/readings on a given day. Text values only, deliberately -
// the photo evidence behind these numbers lives in the visits screen, not
// here (see the file header note).
type DayTripRow = {
  DayTrip_ID: number;
  Duty_Date: string;
  Reading_From: string | number | null;
  Reading_To: string | number | null;
  Distance: number | null;
  Fuel_Amount: number | null;
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

type Props = {
  isOpen: boolean;
  dutyId: string | number | null | undefined;
  onClose: () => void;
  // True when the logged-in user is one of THIS duty's RAs (or otherwise
  // already has full edit rights, i.e. canManageSettlement below) - such
  // people see every camp member's DA/TA. Anyone else only sees their own
  // row, never a teammate's numbers. Callers already know a duty's RA
  // slots (they use the same check to decide whether to show the "DA / TA"
  // link at all), so this is computed there and passed straight through.
  canViewAll?: boolean;
};

const DaTaSettlementModal: React.FC<Props> = ({ isOpen, dutyId, onClose, canViewAll }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [days, setDays] = useState<DayRow[]>([]);
  const [dayTrips, setDayTrips] = useState<DayTripRow[]>([]);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [tab, setTab] = useState<"people" | "days">("people");
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

  // Same two roles that already have edit rights over a duty elsewhere in
  // the app (OnDuties.tsx's canEdit/isAccountant/isDirector). Everyone else
  // who can open this popup gets a read-only view of the same numbers.
  const isAccountant = empCode === "1541";
  const isDirector = empCode === "1501";
  const canManageSettlement = isAccountant || isDirector;

  // Accountant/Director and this duty's RAs see the whole camp. A plain
  // team member only ever sees their own DA/TA row. Enforced by asking the
  // backend for just that one EmpCode (App_Calc_OnDuty_DA_TA and friends
  // already take an @EmpCode filter) rather than fetching everyone and
  // hiding rows client-side, so a teammate's numbers are never sent down
  // to a browser that shouldn't see them in the first place.
  const showAll = canManageSettlement || !!canViewAll;

  const call = useCallback(async (route: string, body: any) => {
    return apiService.post("/OnDuty/" + route, body);
  }, []);

  const idNum = Number(dutyId);
  const idOk = Number.isFinite(idNum) && idNum > 0;

  const run = useCallback(async (what: "calc" | "saved") => {
    if (!idOk) { setErr("On-duty number is missing."); return; }
    setBusy(what); setErr(""); setMsg("");
    try {
      const route = what === "calc" ? "calc_datat" : "get_settlement";
      const body: any = { Duty_Id: idNum };
      if (!showAll) body.EmpCode = empCode;
      const data = await call(route, body);
      const list: Row[] = Array.isArray(data) ? data : [];
      setRows(list);
      setSaved(what === "saved");
      if (!list.length) {
        setMsg(what === "calc"
          ? "Nothing came back. Check the duty number, and that the request has a team list on it."
          : "This duty has not been settled yet. Calculate it, then save.");
      }
      const dayBody: any = { Duty_Id: idNum };
      if (!showAll) dayBody.EmpCode = empCode;
      const dayData = await call("datat_daybreakup", dayBody);
      setDays(Array.isArray(dayData) ? dayData : []);

      try {
        const dtRes = await apiService.get(`/OnDuty/get_daytrips?dutyId=${idNum}`);
        const dtRows = typeof dtRes === "string" ? JSON.parse(dtRes) : dtRes;
        const grouped: Record<number, DayTripRow> = {};
        (Array.isArray(dtRows) ? dtRows : []).forEach((r: any) => {
          if (!Array.isArray(r)) return;
          const id = Number(r[0]);
          // get_daytrips LEFT JOINs visits, so a day with several visits
          // comes back as several rows sharing the same DayTrip_ID - keep
          // only the first, the day-level fields (Reading_From/To,
          // Distance, Fuel_Amount) are identical on every one of them.
          if (!id || grouped[id]) return;
          grouped[id] = {
            DayTrip_ID: id,
            Duty_Date: r[2],
            Reading_From: r[3],
            Reading_To: r[4],
            Distance: r[5],
            Fuel_Amount: r[6],
          };
        });
        setDayTrips(
          Object.values(grouped).sort((a, b) =>
            String(a.Duty_Date).localeCompare(String(b.Duty_Date))
          )
        );
      } catch (e) {
        // Non-critical - the DA/TA figures above still stand on their own.
        setDayTrips([]);
      }
    } catch (e: any) {
      setErr(e?.message || "Could not reach the server.");
    } finally {
      setBusy("");
    }
  }, [call, idNum, idOk, showAll, empCode]);

  const save = useCallback(async () => {
    if (!idOk) { setErr("On-duty number is missing."); return; }
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
    if (!idOk) { setErr("On-duty number is missing."); return; }
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

  // Calculate fresh every time the popup opens (or is opened for a
  // different duty) so the numbers are already on screen instead of a row
  // of zeros waiting for a manual Calculate click. This is a live
  // read-only computation - Save is still what freezes it - so recomputing
  // on every open is safe even if the duty was already settled before,
  // and clear whatever the previous duty left behind so it can't flash
  // before the real data arrives.
  useEffect(() => {
    if (isOpen && idOk) {
      setRows([]); setDays([]); setDayTrips([]); setOpenEmp(null); setOpenDate(null); setTab("people"); setMsg(""); setErr(""); setSaved(false);
      run("calc");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dutyId]);

  const totals = useMemo(() => {
    return rows.reduce((a, r) => ({
      da: a.da + Number(r.DA_Amount || 0),
      ta: a.ta + Number(r.TA_Amount || 0),
      fuel: a.fuel + Number(r.Fuel_Amount || 0),
      local: a.local + Number(r.Local_Amount || 0),
      total: a.total + Number(r.Total_Amount || 0),
    }), { da: 0, ta: 0, fuel: 0, local: 0, total: 0 });
  }, [rows]);

  // Travel mode/distance/rate is a duty-level fact (the whole team on a
  // trip travels the same way), not a per-employee one, even though the
  // calc proc repeats it on every row. Shown once here instead of on every
  // card - but only when every row actually agrees, so a duty that really
  // does mix travel modes still shows each employee's own figures.
  const tripInfo = useMemo(() => {
    if (rows.length === 0) return null;
    const first = rows[0];
    const uniform = rows.every((r) =>
      r.TA_Mode === first.TA_Mode &&
      Number(r.TA_Distance || 0) === Number(first.TA_Distance || 0) &&
      Number(r.TA_Rate || 0) === Number(first.TA_Rate || 0)
    );
    return uniform ? first : null;
  }, [rows]);

  // Reading/fuel are duty-day facts (one vehicle, shared by the whole
  // team) - keyed by date so each employee's own per-day row can look up
  // "what did the vehicle read that day" without needing DayTrip_ID, which
  // datat_daybreakup's rows don't carry.
  const dayTripsByDate = useMemo(() => {
    const map: Record<string, DayTripRow> = {};
    dayTrips.forEach((dt) => {
      const key = String(dt.Duty_Date || "").slice(0, 10);
      if (key) map[key] = dt;
    });
    return map;
  }, [dayTrips]);

  const readingFor = (duty_date: any): DayTripRow | null =>
    dayTripsByDate[String(duty_date || "").slice(0, 10)] || null;

  // The trip's overall start/end odometer reading - first day's Reading_From
  // through the last day's Reading_To - shown once beside Travel/Distance/
  // Rate since, like those, it's a single whole-trip fact.
  const startEndReading = useMemo(() => {
    if (dayTrips.length === 0) return null;
    return {
      start: dayTrips[0].Reading_From,
      end: dayTrips[dayTrips.length - 1].Reading_To,
    };
  }, [dayTrips]);

  // The trip's own date range, for the popup title - first day trip
  // through the last, same sorted rows the readings above come from.
  const tripDates = useMemo(() => {
    if (dayTrips.length === 0) return null;
    const from = dayTrips[0].Duty_Date;
    const to = dayTrips[dayTrips.length - 1].Duty_Date;
    return {
      from,
      to,
      single: String(from || "").slice(0, 10) === String(to || "").slice(0, 10),
    };
  }, [dayTrips]);

  const daysFor = (code: string) => days.filter((d) => d.EmpCode === code);

  const hasTabs = dayTrips.length > 1 && rows.length > 0;

  const nameByCode = useMemo(() => {
    const map: Record<string, string> = {};
    rows.forEach((r) => { map[r.EmpCode] = r.EmpName || r.EmpCode; });
    return map;
  }, [rows]);

  const daysByDate = useMemo(() => {
    const map: Record<string, DayRow[]> = {};
    days.forEach((d) => {
      const key = String(d.Duty_Date || "").slice(0, 10);
      if (!key) return;
      (map[key] = map[key] || []).push(d);
    });
    return map;
  }, [days]);

  const employeeCardsBlock = rows.length > 0 ? (
    <div className="dt-cards dt-cards-tight">
              {rows.map((r) => {
                const open = openEmp === r.EmpCode;
                const dd = daysFor(r.EmpCode);
                const oneDay = dd.length === 1;
                const expandable = dd.length > 1;
                return (
                  <div className={"dt-card dt-card-compact" + (open ? " dt-card-open" : "")} key={r.EmpCode}>
                    <button
                      type="button"
                      className="dt-card-head"
                      style={{ cursor: expandable ? "pointer" : "default" }}
                      onClick={expandable ? () => setOpenEmp(open ? null : r.EmpCode) : undefined}
                    >
                      <div className="dt-who">
                        <div className="dt-name">{r.EmpName || r.EmpCode}</div>
                        <div className="dt-code">{r.EmpCode}</div>
                      </div>
                      <div className="dt-amt">
                        <div className="dt-amt-big">{money(r.Total_Amount)}</div>
                        {r.Status && <div className={"dt-status dt-status-" + String(r.Status).toLowerCase()}>{r.Status}</div>}
                      </div>
                      {expandable && <IonIcon className="dt-chev" icon={chevronDown} />}
                    </button>

                    {oneDay ? (
                      // A single day's own line already carries what the
                      // aggregate grid would otherwise repeat (Days present,
                      // Hours, DA) - so for the common one-day case this
                      // replaces the grid entirely instead of duplicating it
                      // underneath, with TA/Fuel/Local folded onto the same
                      // line since there's nothing left to expand into.
                      <div className={"dt-day-line dt-day-line-merged" + (dd[0].MissingPunch ? " dt-day-line-miss" : "")}>
                        <span className="dt-day-line-date">{day(dd[0].Duty_Date)}</span>
                        <span>{clock(dd[0].FirstIn)}–{clock(dd[0].LastOut)}</span>
                        {!dd[0].MissingPunch &&
                          (dd[0].PaidFrom !== dd[0].FirstIn || dd[0].PaidTo !== dd[0].LastOut) && (
                          <span className="dt-day-line-paid">
                            paid {clock(dd[0].PaidFrom)}–{clock(dd[0].PaidTo)}
                          </span>
                        )}
                        {dd[0].Km != null && Number(dd[0].Km) > 0 && (
                          <span className="dt-day-line-km">{Number(dd[0].Km).toFixed(0)}km</span>
                        )}
                        {readingFor(dd[0].Duty_Date) && (
                          <span className="dt-day-line-reading">
                            {readingFor(dd[0].Duty_Date)!.Reading_From ?? "--"}
                            {" → "}
                            {readingFor(dd[0].Duty_Date)!.Reading_To ?? "--"}
                          </span>
                        )}
                        <span className="dt-day-line-hrs">{hours(dd[0].Hours)}h</span>
                        <span className="dt-day-line-amt">DA {money(r.DA_Amount)}</span>
                        <span className="dt-day-line-amt">TA {money(r.TA_Amount)}</span>
                        {Number(r.Fuel_Amount) > 0 && <span className="dt-day-line-amt">Fuel {money(r.Fuel_Amount)}</span>}
                        {Number(r.Local_Amount) > 0 && <span className="dt-day-line-amt">Local {money(r.Local_Amount)}</span>}
                        {dd[0].MissingPunch && <span className="dt-day-line-flag">missing</span>}
                      </div>
                    ) : (
                      /* Hourly DA dropped - it's a rate, not a result, and the
                         DA figure right beside it is the number that matters
                         here. */
                      <div className="dt-grid dt-grid-compact">
                        <div><span>Days present</span><strong>{r.DaysPresent}</strong></div>
                        <div><span>Hours</span><strong>{hours(r.TotalHours)}</strong></div>
                        <div><span>DA</span><strong>{money(r.DA_Amount)}</strong></div>
                        {!tripInfo && (
                          <>
                            <div><span>Travel</span><strong>{modeLabel(r.TA_Mode)}</strong></div>
                            <div><span>Distance</span><strong>{hours(r.TA_Distance)} km</strong></div>
                            <div><span>Rate / km</span><strong>{r.TA_Rate == null ? "not set" : money(r.TA_Rate)}</strong></div>
                          </>
                        )}
                        <div><span>TA</span><strong>{money(r.TA_Amount)}</strong></div>
                        {Number(r.Fuel_Amount) > 0 && <div><span>Fuel</span><strong>{money(r.Fuel_Amount)}</strong></div>}
                        {Number(r.Local_Amount) > 0 && <div><span>Local transport</span><strong>{money(r.Local_Amount)}</strong></div>}
                      </div>
                    )}

                    {/* r.Notes (the "Paid on the distance..." explainer) is
                        hidden in this popup - the same working is already
                        visible from the figures themselves, and hiding it
                        keeps the card compact. Still available on the
                        standalone DaTaSettlement page. */}

                    {expandable && open && (
                      <div className="dt-daygrid dt-daygrid-emp">
                        <div className="dt-daygrid-head">
                          <span>Date</span>
                          <span>Punch</span>
                          <span>Paid</span>
                          <span className="dg-r">Km</span>
                          <span className="dg-r">Hours</span>
                          <span className="dg-r">DA</span>
                          <span className="dg-r">Fuel</span>
                          <span className="dg-r">Local</span>
                        </div>
                        {dd.map((d, i) => (
                          <div className={"dt-daygrid-row" + (d.MissingPunch ? " dt-daygrid-miss" : "")} key={i}>
                            <span className="dg-key">{day(d.Duty_Date)}</span>
                            <span>{clock(d.FirstIn)}–{clock(d.LastOut)}</span>
                            <span className="dg-paid">
                              {d.MissingPunch
                                ? <em className="dg-miss">missing</em>
                                : (d.PaidFrom !== d.FirstIn || d.PaidTo !== d.LastOut)
                                  ? <>{clock(d.PaidFrom)}–{clock(d.PaidTo)}</>
                                  : ""}
                            </span>
                            <span className="dg-r dg-km">
                              {d.Km != null && Number(d.Km) > 0 ? Number(d.Km).toFixed(0) : ""}
                            </span>
                            <span className="dg-r">{hours(d.Hours)}</span>
                            <span className="dg-r dg-num">{money(d.DA_Amount)}</span>
                            <span className="dg-r dg-num">
                              {Number(d.Fuel_Amount) > 0 ? money(d.Fuel_Amount) : ""}
                            </span>
                            <span className="dg-r dg-num">
                              {Number(d.Local_Amount) > 0 ? money(d.Local_Amount) : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
    </div>
  ) : null;

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        style={{
          width: "min(900px, 95vw)",
          maxHeight: "88vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          padding: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Static header: title, action buttons, and the DA/TA/FUEL/LOCAL/
            TOTAL summary. Kept out of the scrolling area below so the
            totals stay on screen while paging through the employee list. */}
        <div style={{ padding: "24px 24px 0", maxWidth: "1100px", margin: "0 auto", width: "100%", boxSizing: "border-box", flexShrink: 0 }}>
          <div className="modal-header">
            <h3>
              DA / TA Settlement{idOk ? " #" + idNum : ""}
              {tripDates && (
                <span className="dt-head-dates">
                  {day(tripDates.from)}
                  {!tripDates.single && <> – {day(tripDates.to)}</>}
                </span>
              )}
            </h3>
            <button onClick={onClose}>✖</button>
          </div>

          {(canManageSettlement || busy !== "") && (
            <div className="dt-bar">
              {canManageSettlement && (
                <>
                  <IonButton size="small" color="success" disabled={!rows.length || busy !== ""} onClick={save}>
                    <IonIcon slot="start" icon={saveOutline} />
                    Save
                  </IonButton>
                  <IonButton size="small" color="tertiary" disabled={!saved || !rows.length || busy !== ""} onClick={() => approve("Approved")}>
                    <IonIcon slot="start" icon={checkmarkDoneOutline} />
                    Approve
                  </IonButton>
                </>
              )}
              {busy !== "" && <IonSpinner name="dots" />}
            </div>
          )}

          {err !== "" && <div className="dt-note dt-note-bad">{err}</div>}
          {msg !== "" && <div className="dt-note">{msg}</div>}

          {/* Money figures and the trip facts they were worked out from, on
              ONE line - the grand total pushed to the far right as the one
              figure people open this popup for. */}
          {rows.length > 0 && (
            <div className="dt-summary">
              <div className="dt-summary-row">
                <div><span>DA</span><strong>{money(totals.da)}</strong></div>
                <div><span>TA</span><strong>{money(totals.ta)}</strong></div>
                <div><span>Fuel</span><strong>{money(totals.fuel)}</strong></div>
                <div><span>Local</span><strong>{money(totals.local)}</strong></div>
                {tripInfo && (
                  <>
                    <div className="dt-sum-wide"><span>Travel</span><strong>{modeLabel(tripInfo.TA_Mode)}</strong></div>
                    <div className="dt-sum-wide"><span>Distance</span><strong>{hours(tripInfo.TA_Distance)} km</strong></div>
                    <div><span>Rate / km</span><strong>{tripInfo.TA_Rate == null ? "not set" : money(tripInfo.TA_Rate)}</strong></div>
                  </>
                )}
                {startEndReading && (
                  <>
                    <div><span>Start</span><strong>{startEndReading.start ?? "--"}</strong></div>
                    <div><span>End</span><strong>{startEndReading.end ?? "--"}</strong></div>
                  </>
                )}
                <div className="dt-grand"><span>Total</span><strong>{money(totals.total)}</strong></div>
              </div>
            </div>
          )}

          {hasTabs && (
            <div className="dt-tabs">
              <button
                type="button"
                className={"dt-tab" + (tab === "people" ? " dt-tab-on" : "")}
                onClick={() => setTab("people")}
              >
                Employees ({rows.length})
              </button>
              <button
                type="button"
                className={"dt-tab" + (tab === "days" ? " dt-tab-on" : "")}
                onClick={() => setTab("days")}
              >
                Day-wise ({dayTrips.length})
              </button>
            </div>
          )}
        </div>

        {/* Only the list scrolls - the header and tabs above stay put. */}
        <div style={{ overflowY: "auto", flex: 1, padding: "0 24px 24px", maxWidth: "1100px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>

          {/* One collapse PER DATE - that day's reading/fuel/distance sits in
              the header, and who was actually on duty that day only renders
              once you open that specific date. */}
          {hasTabs && tab === "days" && (
            <div className="dt-cards dt-cards-tight">
              {dayTrips.map((dt) => {
                const key = String(dt.Duty_Date || "").slice(0, 10);
                const openThis = openDate === key;
                const emps = daysByDate[key] || [];
                return (
                  <div className={"dt-card dt-card-compact" + (openThis ? " dt-card-open" : "")} key={dt.DayTrip_ID}>
                    <button
                      type="button"
                      className="dt-card-head"
                      onClick={() => setOpenDate(openThis ? null : key)}
                    >
                      <div className="dt-who">
                        <div className="dt-name">{day(dt.Duty_Date)}</div>
                        <div className="dt-code">
                          {dt.Reading_From ?? "--"} → {dt.Reading_To ?? "--"}
                          {dt.Distance != null && Number(dt.Distance) > 0
                            ? ` · ${Number(dt.Distance).toFixed(0)}km`
                            : ""}
                        </div>
                      </div>
                      {Number(dt.Fuel_Amount) > 0 && (
                        <div className="dt-amt">
                          <div className="dt-amt-big">Fuel {money(dt.Fuel_Amount)}</div>
                        </div>
                      )}
                      <IonIcon className="dt-chev" icon={chevronDown} />
                    </button>

                    {openThis && (
                      emps.length === 0 ? (
                        <div className="dt-daygrid-empty">No one logged against this day.</div>
                      ) : (
                        <div className="dt-daygrid dt-daygrid-day">
                          <div className="dt-daygrid-head">
                            <span>Employee</span>
                            <span>Punch</span>
                            <span>Paid</span>
                            <span className="dg-r">Hours</span>
                            <span className="dg-r">DA</span>
                            <span className="dg-r">Fuel</span>
                            <span className="dg-r">Local</span>
                          </div>
                          {emps.map((d, i) => (
                            <div className={"dt-daygrid-row" + (d.MissingPunch ? " dt-daygrid-miss" : "")} key={i}>
                              <span className="dg-key">{nameByCode[d.EmpCode] || d.EmpCode}</span>
                              <span>{clock(d.FirstIn)}–{clock(d.LastOut)}</span>
                              <span className="dg-paid">
                                {d.MissingPunch
                                  ? <em className="dg-miss">missing</em>
                                  : (d.PaidFrom !== d.FirstIn || d.PaidTo !== d.LastOut)
                                    ? <>{clock(d.PaidFrom)}–{clock(d.PaidTo)}</>
                                    : ""}
                              </span>
                              <span className="dg-r">{hours(d.Hours)}</span>
                              <span className="dg-r dg-num">{money(d.DA_Amount)}</span>
                              <span className="dg-r dg-num">
                                {Number(d.Fuel_Amount) > 0 ? money(d.Fuel_Amount) : ""}
                              </span>
                              <span className="dg-r dg-num">
                                {Number(d.Local_Amount) > 0 ? money(d.Local_Amount) : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {(!hasTabs || tab === "people") && employeeCardsBlock}

          {rows.length === 0 && busy === "" && err === "" && msg === "" && (
            <div className="dt-empty">
              {idOk ? "Working it out..." : "No duty number to settle."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DaTaSettlementModal;
