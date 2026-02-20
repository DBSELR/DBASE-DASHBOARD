import React, { useEffect, useMemo, useState } from "react";
import { IonGrid, IonRow, IonCol, IonItem, IonLabel, IonSelect, IonSelectOption, IonButton, IonInput } from "@ionic/react";


type Props = { apiBase: string; empCode: string; };

export default function AssignedTickets({ apiBase, empCode }: Props) {
  const imageBase = `${apiBase}img/Tickets/`; // matches Angular usage
  const [assigneeData, setAssigneeData] = useState<any[]>([]);
  const [empList, setEmpList] = useState<{ EmpCode: string; EmpName: string }[]>([]);

  // display panel state
  const [showControls, setShowControls] = useState(false);
  const [tickId, setTickId] = useState("");
  const [supportEmpCode, setSupportEmpCode] = useState("");
  const [status, setStatus] = useState("");
  const [closingRemarks, setClosingRemarks] = useState("");
  const [quitRemarks, setQuitRemarks] = useState("");
  const [ticketType, setTicketType] = useState("");
  const [qReasonDisplay, setQReasonDisplay] = useState(false);
  const [cReasonDisplay, setCReasonDisplay] = useState(false);

  const statusOptions = useMemo(() => {
    return status === "fromOpen" ? [
      { id: "H", value: "Hold" }, { id: "C", value: "Close" }, { id: "Q", value: "Quit" }
    ] : [
      { id: "O", value: "Open" }, { id: "Q", value: "Quit" }
    ];
  }, [status]);

  useEffect(() => { void loadEmployees(); void loadAssigneeData(); }, []);

  async function loadEmployees() {
    try {
      // TODO: your real emp list API
      const res = await fetch(`${apiBase}Tickets/LOADEMPS`);
      setEmpList(await res.json());
    } catch { setEmpList([]); }
  }

  async function loadAssigneeData() {
    try {
      // TODO: your actual "genserv.getAssigneeData()" endpoint
      const res = await fetch(`${apiBase}Tickets/Load_Assigned_Tickets`);
      setAssigneeData(await res.json());
    } catch { setAssigneeData([]); }
  }

  function onTicketClick(tid: string, tStatus: string) {
    setShowControls(true);
    setTickId(tid);
    setSupportEmpCode("");
    setStatus(tStatus === "O" ? "fromOpen" : "fromHoldOrAssigned");
    setTicketType("");
    setClosingRemarks("");
    setQuitRemarks("");
    setQReasonDisplay(false);
    setCReasonDisplay(false);
  }

  function onStatusPick(id: string) {
    if (id === "C") { setCReasonDisplay(true); setQReasonDisplay(false); }
    else if (id === "Q") { setQReasonDisplay(true); setCReasonDisplay(false); }
    else { setQReasonDisplay(false); setCReasonDisplay(false); }
    // store chosen status "H/C/Q/O" directly
    setStatus(id);
  }

  async function saveAssignee() {
    if (status === "Q" && quitRemarks.trim() === "") return alert("Please enter quitting reason...!");
    if (status === "C" && (closingRemarks.trim() === "" || ticketType === "")) return alert("Enter closing reason & ticket type!");

    const payload = {
      _TICKETID: tickId,
      _EMPCODE_LOGIN: empCode,
      _SUPPORTEMPCODE: supportEmpCode,
      _SELECTEDTIKSTATUS: status,
      _TASKREMARKS: quitRemarks,
      _TICKETTYPE: ticketType,
      _CLOSINGREMARKS: closingRemarks,
    };
    try {
      const res = await fetch(`${apiBase}Tickets/UPDATE_ASSIGN_TICKET`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const ok = await res.json();
      if (ok >= 1) {
        alert("Record Successfully Updated...!");
        setShowControls(false);
        await loadAssigneeData();
      } else alert("Record Not Updated...!");
    } catch (e:any) {
      alert("Error..." + e?.message);
    }
  }

  function rowBg(status: string) {
    return { backgroundColor: status === "O" ? "burlywood" : "transparent" };
  }

  function download(blobUrl: string, filename: string) {
    const a = document.createElement("a");
    a.href = blobUrl; a.download = filename; a.rel = "noopener"; document.body.appendChild(a);
    a.click(); a.remove();
  }

  async function downloadFile(filePath: string) {
    try {
      const url = `${apiBase}Tickets/LOADEMPTASKSLISTFILE?fileName=${encodeURIComponent(filePath)}`;
      const res = await fetch(url);
      const blob = await res.blob();
      download(URL.createObjectURL(blob), filePath.split("/").pop() ?? "file");
    } catch {}
  }

  async function downloadImage(imgPath: string) {
    try {
      const url = `${apiBase}Tickets/LOADEMPTASKSLISTIMG?img=${encodeURIComponent(imgPath)}`;
      const res = await fetch(url);
      const blob = await res.blob();
      download(URL.createObjectURL(blob), imgPath.split("/").pop() ?? "image");
    } catch {}
  }

  return (
    <div className="example-container">
      {/* top action row (mirrors Angular display fields area) */}
      {showControls && (
        <IonRow className="control-row">
          <IonCol size="12" sizeMd="2"><strong>{tickId}</strong></IonCol>

          <IonCol size="12" sizeMd="3">
            <IonItem>
              <IonLabel position="stacked">Support Employee</IonLabel>
              <IonSelect value={supportEmpCode} onIonChange={e => setSupportEmpCode(e.detail.value)}>
                {empList.map(x => <IonSelectOption key={x.EmpCode} value={x.EmpCode}>{x.EmpName}</IonSelectOption>)}
              </IonSelect>
            </IonItem>
          </IonCol>

          <IonCol size="12" sizeMd="2">
            <IonItem>
              <IonLabel position="stacked">Status</IonLabel>
              <IonSelect placeholder="Select" onIonChange={e => onStatusPick(e.detail.value)}>
                {statusOptions.map(x => <IonSelectOption key={x.id} value={x.id}>{x.value}</IonSelectOption>)}
              </IonSelect>
            </IonItem>
          </IonCol>

          <IonCol size="12" sizeMd="2" className="send-col">
            <IonButton onClick={saveAssignee} color="danger" size="default">Send</IonButton>
          </IonCol>

          <IonCol size="12" sizeMd="3">
            {cReasonDisplay && (
              <>
                <IonItem>
                  <IonLabel position="stacked">Closing Reason</IonLabel>
                  <IonInput value={closingRemarks} onIonChange={e => setClosingRemarks(e.detail.value!)} />
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Ticket Type</IonLabel>
                  <IonSelect value={ticketType} onIonChange={e => setTicketType(e.detail.value)}>
                    <IonSelectOption value="S">Support</IonSelectOption>
                    <IonSelectOption value="B">Bug</IonSelectOption>
                    <IonSelectOption value="M">Modification</IonSelectOption>
                    <IonSelectOption value="N">New Implementation</IonSelectOption>
                    <IonSelectOption value="D">Duplicate</IonSelectOption>
                    <IonSelectOption value="I">Irrelevant</IonSelectOption>
                    <IonSelectOption value="U">Unidentified</IonSelectOption>
                  </IonSelect>
                </IonItem>
              </>
            )}
            {qReasonDisplay && (
              <IonItem>
                <IonLabel position="stacked">Quitting Reason</IonLabel>
                <IonInput value={quitRemarks} onIonChange={e => setQuitRemarks(e.detail.value!)} />
              </IonItem>
            )}
          </IonCol>
        </IonRow>
      )}

      {/* list */}
      <IonGrid>
        {assigneeData.map((x: any) => (
          <IonRow key={x.TICKETID} className="row-class" style={rowBg(x.T_STATUS)}>
            <IonCol size="12" sizeMd="4" className="col-class">
              <div><b>Ticket ID : </b>
                <button className="linklike"
                  disabled={(x.T_STATUS === "H" || x.T_STATUS === "A") && false /* osflag */ }
                  onClick={() => onTicketClick(x.TICKETID, x.T_STATUS)}
                  style={{ color: x.T_STATUS === "H" ? "red" : (x.T_STATUS === "O" ? "green" : "black") }}>
                  {x.TICKETID}
                </button>
              </div>
              <div><b>Client : </b>{x.CLIENT}</div>
              <div><b>Priority : </b>{x.TICKETPRIORITY}</div>
            </IonCol>

            <IonCol size="12" sizeMd="4" className="col-class">
              <div><b>Date : </b>{x.TDATE}</div>
              <div><b>Client Details : </b>{x.MENU}</div>
            </IonCol>

            <IonCol size="12" sizeMd="4" className="col-class">
              <div style={{ textAlign: "justify" }}><b>Remarks : </b>{x.REMARKS}</div>
            </IonCol>

            <IonRow className="col-class sub" style={{ width: "100%" }}>
              <div>&nbsp;<b>Project :</b> {x.PROJECT}&nbsp;&nbsp;
                <b>End Time :</b> {x.ESTIMATEDTIME}&nbsp;&nbsp;
                <b>Image :</b>&nbsp;
                {!!x.IMG_PATH && (
                  <img alt="view" src="/assets/icon/view.png" width="22" height="21"
                       onClick={() => window.open(imageBase + x.IMG_PATH, "_blank")} />
                )}
                &nbsp;&nbsp;<b>File :</b>&nbsp;
                {!!x.FILE_PATH && (
                  <img alt="download" src="/assets/icon/downloadImg.png" width="20" height="18"
                       onClick={() => downloadFile(x.FILE_PATH)} />
                )}
              </div>
            </IonRow>
          </IonRow>
        ))}
      </IonGrid>
    </div>
  );
}
