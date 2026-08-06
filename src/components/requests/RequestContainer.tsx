import React, { useState } from "react";
import LeaveForm from "./LeaveForm";
import EquipmentForm from "./EquipmentForm";
import RequestList from "./RequestList";
import OverTime from "../../pages/OverTime"; 
import OnDuties from "../../pages/OnDuties";
import ChangeApprovalsInbox from "./ChangeApprovalsInbox";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonContent,
  IonSelect,
  IonSelectOption,
  IonItem,
  IonSegment,
  IonSegmentButton,
  IonToast,
  IonLabel,
  IonIcon,
  IonSearchbar,
  IonModal,
  IonButton,
  IonButtons,
  IonTitle,
  IonList,
} from "@ionic/react";
import {
  checkmarkCircle,
  closeCircle,
  timeOutline,
  personOutline,
  calendarOutline,
  chatbubbleEllipsesOutline,
  layersOutline,
  searchOutline
} from "ionicons/icons";

const RequestContainer = ({ type, view, hasTeamTab }: any) => {
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

return (
  <div>

    <div className="status-filter-bar">
      {["All", "Pending", "Accepted", "Rejected"].map((s) => (
        <button
          key={s}
          className={`filter-btn ${status === s ? "active" : ""}`}
          onClick={() => setStatus(s)}
        >
           <IonIcon
                            icon={
                              status === "Accepted" ? checkmarkCircle :
                                status === "Rejected" ? closeCircle :
                                  status === "Pending" ? timeOutline :
                                    layersOutline
                            }
                          />
          {s}
        </button>
      ))}
    </div>

 {/* ✅ LEAVE FORM */}
{showLeaveForm && <LeaveForm defaultType={type} />}

{normalizedType === "onduty" ? (
  <>
    {view === "my" && <OnDuties statusFilter={status} />}

    {/* Amendments to a duty that has already been approved - someone
        added, someone taken off, the branch reporting days moved - wait
        for a decision instead of taking effect.  They belong here and
        not under My Requests, because they are somebody else's request
        to answer.  Any one approver of the duty settles it.

        The tab the page calls "Team Requests" is "raised" in code, not
        "team".  Anyone who has no such tab - a decider who is not on the
        approver-roles list, for instance - is shown it under My Requests
        instead, since the alternative is that it reaches nobody. */}
    {(view !== "my" || hasTeamTab === false) && <ChangeApprovalsInbox />}

    <RequestList type="onduty" view={view} status={status} />
  </>
) : normalizedType === "overtime" ? (
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
