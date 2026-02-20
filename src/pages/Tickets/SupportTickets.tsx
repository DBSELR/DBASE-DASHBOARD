import React, { useEffect, useState } from "react";
import { IonGrid, IonRow, IonCol } from "@ionic/react";


type Props = { apiBase: string };

export default function SupportTickets({ apiBase }: Props) {
  const [empList, setEmpList] = useState<{ EmpCode: string; EmpName: string }[]>([]);
  const [dataTL, setDataTL] = useState<any[]>([]);
  const [dataTM, setDataTM] = useState<any[]>([]);
  const imageBase = `${apiBase}img/Tickets/`;

  const estTime = [
    { v: "0", d: "00.00" }, { v: "0.25", d: "00.15" }, { v: "0.5", d: "00.30" },
    { v: "1", d: "01.00" }, { v: "2", d: "02.00" }, { v: "3", d: "03.00" },
    { v: "4", d: "04.00" }, { v: "5", d: "05.00" }, { v: "6", d: "06.00" },
    { v: "7", d: "07.00" }, { v: "8", d: "08.00" }, { v: "9", d: "09.00" },
    { v: "10", d: "10.00" }, { v: "11", d: "11.00" }, { v: "12", d: "12.00" },
    { v: "13", d: "13.00" }, { v: "14", d: "14.00" }, { v: "15", d: "15.00" }, { v: "16", d: "16.00" },
  ];

  useEffect(() => { void loadEmp(); void loadSupport(); }, []);

  async function loadEmp() {
    try {
      // TODO: real endpoint
      const res = await fetch(`${apiBase}Tickets/LOADEMPS`);
      setEmpList(await res.json());
    } catch { setEmpList([]); }
  }

  async function loadSupport() {
    try {
      // TODO: replace with your TL/TM lists
      const tl = await (await fetch(`${apiBase}Tickets/Load_Support_TL`)).json();
      const tm = await (await fetch(`${apiBase}Tickets/Load_Support_TM`)).json();
      setDataTL(tl ?? []); setDataTM(tm ?? []);
    } catch { setDataTL([]); setDataTM([]); }
  }

  function download(url: string, filename: string) {
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  }

  async function downloadFile(file: string) {
    const res = await fetch(`${apiBase}Tickets/LOADEMPTASKSLISTFILE?fileName=${encodeURIComponent(file)}`);
    download(URL.createObjectURL(await res.blob()), file.split("/").pop() ?? "file");
  }

  async function downloadImg(img: string) {
    const res = await fetch(`${apiBase}Tickets/LOADEMPTASKSLISTIMG?img=${encodeURIComponent(img)}`);
    download(URL.createObjectURL(await res.blob()), img.split("/").pop() ?? "image");
  }

  // simple local state per row (demo; align with your backend fields)
  const [tlEmp, setTlEmp] = useState<string>("");
  const [tmEmp, setTmEmp] = useState<string>("");
  const [tlTime, setTlTime] = useState<string>("");
  const [tmTime, setTmTime] = useState<string>("");

  async function saveTL(ticketId: string) {
    // TODO: send to Tickets/SAVE_TL_ASSIGNEE (name guessed)
    await fetch(`${apiBase}Tickets/SAVE_TL_ASSIGNEE`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, empCode: tlEmp, tlTime }),
    });
    alert("Saved");
  }

  async function saveTM(ticketId: string) {
    // TODO: send to Tickets/SAVE_TM_ASSIGNEE (name guessed)
    await fetch(`${apiBase}Tickets/SAVE_TM_ASSIGNEE`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, empCode: tmEmp, tmTime }),
    });
    alert("Saved");
  }

  return (
    <div className="example-container">
      {/* TL view */}
      <section>
        <IonGrid>
          {dataTL.map((x:any) => (
            <IonRow key={"TL"+x.TicketID} className="row-class">
              <div className="badge1">{x.TicketID}</div>

              <IonCol size="12" sizeMd="3" className="col-class">
                <div><b>Client :</b> {x.Client}</div>
                <div><b>Project :</b> {x.Project}</div>
                <div><b>Priority :</b> {x.TicketPriority}</div>
                <div><b>Reopen :</b> {x.Reopen}</div>
              </IonCol>

              <IonCol size="12" sizeMd="3" className="col-class">
                <div><b>Date :</b> {x.TDate}</div>
                <div><b>Client Details :</b> {x.Menu}</div>
              </IonCol>

              <IonCol size="12" sizeMd="6" className="col-class">
                <div style={{ textAlign: "justify" }}><b>Remarks :</b> {x.Remarks}</div>
              </IonCol>

              <IonRow className="col-class" style={{ width: "100%", paddingBottom: 10 }}>
                <div>&nbsp;
                  <label className="hl">Assignee :</label>&nbsp;
                  <select onChange={e => setTlEmp(e.target.value)} style={{ width: 150 }}>
                    <option>Select Employee</option>
                    {empList.map(e => <option key={e.EmpCode} value={e.EmpCode}>{e.EmpName}</option>)}
                  </select>&nbsp;&nbsp;&nbsp;&nbsp;

                  <label className="hl">Time(TL) :</label>&nbsp;
                  <select onChange={e => setTlTime(e.target.value)} style={{ width: 60 }}>
                    {estTime.map(t => <option key={t.v} value={t.v}>{t.d}</option>)}
                  </select>&nbsp;&nbsp;

                  <img src="/assets/icon/sendImage.png" width="20" height="20"
                       style={{ cursor: "pointer" }} onClick={() => saveTL(x.TicketID)} />

                  <span style={{ marginLeft: 32 }}>
                    <b>File :</b>&nbsp;
                    {!!x.File_Path && (
                      <img src="/assets/icon/downloadImg.png" width="20" height="18" style={{ cursor: "pointer" }}
                           onClick={() => downloadFile(x.File_Path)} />
                    )}
                    &nbsp;&nbsp;<b>Image :</b>&nbsp;
                    {!!x.Img_Path && (
                      <img src="/assets/icon/view.png" width="22" height="21" style={{ cursor: "pointer", borderRadius: 16 }}
                           onClick={() => window.open(imageBase + x.Img_Path, "_blank")} />
                    )}
                    {!!x.Img_Path && (
                      <button className="link-btn" onClick={() => downloadImg(x.Img_Path)}>Download</button>
                    )}
                  </span>
                </div>
              </IonRow>
            </IonRow>
          ))}
        </IonGrid>
      </section>

      {/* TM view */}
      <section>
        <IonGrid>
          {dataTM.map((x:any) => (
            <IonRow key={"TM"+x.TicketID} className="row-class">
              <div className="badge1">{x.TicketID}</div>

              <IonCol size="12" sizeMd="3" className="col-class">
                <div><b>Client :</b> {x.Client}</div>
                <div><b>Project :</b> {x.Project}</div>
                <div><b>Priority :</b> {x.TicketPriority}</div>
                <div><b>Reopen :</b> {x.Reopen}</div>
              </IonCol>

              <IonCol size="12" sizeMd="3" className="col-class">
                <div><b>Date :</b> {x.TDate}</div>
                <div><b>Client Details :</b> {x.Menu}</div>
              </IonCol>

              <IonCol size="12" sizeMd="6" className="col-class">
                <div style={{ textAlign: "justify" }}><b>Remarks :</b> {x.Remarks}</div>
              </IonCol>

              <IonRow className="col-class" style={{ width: "100%", paddingBottom: 10 }}>
                <div>&nbsp;
                  <label className="hl">Assignee :</label>&nbsp;
                  <select onChange={e => setTmEmp(e.target.value)} style={{ width: 150 }}>
                    <option>Select Employee</option>
                    {empList.map(e => <option key={e.EmpCode} value={e.EmpCode}>{e.EmpName}</option>)}
                  </select>&nbsp;&nbsp;&nbsp;&nbsp;

                  <label className="hl">Time(TM) :</label>&nbsp;
                  <select onChange={e => setTmTime(e.target.value)} style={{ width: 60 }}>
                    {estTime.map(t => <option key={t.v} value={t.v}>{t.d}</option>)}
                  </select>&nbsp;&nbsp;

                  <img src="/assets/icon/sendImage.png" width="20" height="20"
                       style={{ cursor: "pointer" }} onClick={() => saveTM(x.TicketID)} />
                </div>
              </IonRow>
            </IonRow>
          ))}
        </IonGrid>
      </section>
    </div>
  );
}
