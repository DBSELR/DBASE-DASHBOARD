import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { IonToast } from "@ionic/react";
import { API_BASE } from "../../config";
import "../../pages/OnDuties.css";

/*
  Amendments to an already-approved duty - somebody added to it, somebody
  taken off it, the branch reporting days moved - do not take effect on
  the button press.  They are written down and wait for a decision.  This
  is where that decision gets made.

  It lives on its own rather than inside the On Duties page because that
  page only ever renders under My Requests, and an amendment somebody else
  raised is not one's own request to answer.  Team Requests is where work
  belonging to other people is dealt with, so this is mounted there.

  Every approver named on the duty sees the same request, and any one of
  them deciding it settles it - the chain is not walked a second time for
  a change smaller than the duty it belongs to.  Anyone in HR can decide
  it too.  The server is what decides who qualifies; this only asks.
*/

// Sources/* is [Authorize]d, so requests carry the bearer token.
const authHeaders = () => {
  const raw =
    localStorage.getItem("token") ||
    localStorage.getItem("Token") ||
    sessionStorage.getItem("token") ||
    "";
  const token = raw.replace(/^"|"$/g, "");
  return token
    ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
    : {};
};

const readRows = (data: any): any[] => {
  let parsed: any = data;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }
  return Array.isArray(parsed) ? parsed : [];
};

// The API answers in whatever casing the stored procedure used, which is
// not always the casing written here.
const field = (obj: any, name: string) => {
  if (!obj) return undefined;
  const want = name.toLowerCase();
  const hit = Object.keys(obj).find((k) => k.toLowerCase() === want);
  return hit === undefined ? undefined : obj[hit];
};

const serverSaid = (e: any): string => {
  const d = e?.response?.data;
  let text = "";
  if (typeof d === "string") text = d;
  else if (d && typeof d === "object")
    text = String(d.Message ?? d.message ?? d.title ?? d.error ?? "");
  text = text.trim();
  if (text) return text.length > 300 ? text.slice(0, 300) + "..." : text;

  const status = e?.response?.status;
  if (status === 404)
    return "that endpoint is not there (404) - the API still needs rebuilding and restarting";
  if (status === 401 || status === 403)
    return "the server refused the request (" + status + ") - the login may have expired";
  if (status) return "the server answered " + status;
  return e?.message || "an unexpected error";
};

const readEmpCode = (): string => {
  try {
    const stored =
      localStorage.getItem("storedUser") ||
      localStorage.getItem("user") ||
      localStorage.getItem("userData");
    if (!stored) return "";
    const s = JSON.parse(stored);
    return String(s.empCode || s.username || "").trim();
  } catch (e) {
    console.warn("User parse error", e);
    return "";
  }
};

const ChangeApprovalsInbox: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState<number>(0);
  const [toast, setToast] = useState<{ open: boolean; msg: string; colour: string }>({
    open: false,
    msg: "",
    colour: "success",
  });

  const api = useMemo(() => axios.create({ baseURL: API_BASE }), []);
  const empCode = useMemo(() => readEmpCode(), []);

  const notify = (msg: string, colour: string = "success") =>
    setToast({ open: true, msg, colour });

  const load = async () => {
    if (!empCode) return;
    try {
      const res = await api.get("OnDuty/onduty_change_requests", {
        params: { By: empCode, Status: "Pending" },
        headers: authHeaders(),
      });
      // Only the ones this person is entitled to decide.  The rest are
      // other people's business and showing them would be noise with no
      // button attached.
      setRows(readRows(res.data).filter((r: any) => !!field(r, "CanDecide")));
    } catch (e) {
      // A database that has not had the new script run yet answers 404
      // here, and the rest of the screen must carry on exactly as before.
      console.error("loadChangeRequests failed:", e);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empCode]);

  const decide = async (id: number, approve: boolean) => {
    if (!id) return;
    setBusy(id);
    try {
      const res = await api.post(
        "OnDuty/onduty_decide_change",
        { Id: id, Status: approve ? "Approve" : "Reject", By: empCode, Remarks: null },
        { headers: authHeaders() }
      );
      const first = readRows(res.data)[0];
      const ok = field(first, "Ok") !== false;
      notify(
        String(field(first, "Message") ?? "").trim() ||
          (ok ? "Done." : "That decision was not accepted."),
        ok ? "success" : "warning"
      );
      await load();
    } catch (e: any) {
      console.error("decideChange error:", e);
      notify("Could not record that decision - " + serverSaid(e), "danger");
    } finally {
      setBusy(0);
    }
  };

  if (!rows.length) return null;

  return (
    <>
      <div className="od-chg-inbox">
        <div className="od-chg-inbox-head">
          <span>Amendments waiting for your decision ({rows.length})</span>
          <button type="button" className="od-team-btn" onClick={() => load()}>
            Refresh
          </button>
        </div>

        {rows.map((cr: any, ci: number) => (
          <div className="od-chg-row" key={String(field(cr, "ID") ?? ci)}>
            <div className="od-chg-text">
              <span>
                <b>#{String(field(cr, "Duty_Id") ?? "").trim()}</b>{" "}
                {String(field(cr, "Summary") ?? "").trim()}
              </span>
              <span className="od-chg-by">
                asked by{" "}
                {String(
                  field(cr, "RequestedByName") ??
                    field(cr, "Requested_By") ??
                    "someone"
                ).trim()}
              </span>
              {!!String(field(cr, "Outcome") ?? "").trim() && (
                <span className="od-chg-why">
                  {String(field(cr, "Outcome")).trim()}
                </span>
              )}
            </div>
            <div className="od-chg-acts">
              <button
                type="button"
                className="od-team-btn add"
                disabled={busy === Number(field(cr, "ID"))}
                onClick={() => decide(Number(field(cr, "ID")), true)}
              >
                Approve
              </button>
              <button
                type="button"
                className="od-team-btn remove"
                disabled={busy === Number(field(cr, "ID"))}
                onClick={() => decide(Number(field(cr, "ID")), false)}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      <IonToast
        isOpen={toast.open}
        message={toast.msg}
        color={toast.colour}
        duration={3000}
        onDidDismiss={() => setToast({ ...toast, open: false })}
      />
    </>
  );
};

export default ChangeApprovalsInbox;
