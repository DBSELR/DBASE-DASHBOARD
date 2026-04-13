// src/pages/Equipment.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  IonPage,
  IonContent,
  IonSelect,
  IonSelectOption,
  IonToast,
  IonModal,
  IonButton,
  IonDatetime,
  IonLoading,
} from "@ionic/react";
import axios from "axios";
import {
  PlusCircle,
  History,
  ClipboardCheck,
  Package,
  Calendar,
  Send,
  RefreshCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Info,
  Layers,
  Search,
  CheckCircle,
} from "lucide-react";
import moment from "moment";
import { API_BASE } from "../config";
import "./Equipment.css";

type StockOption = { code: string; name: string };

type EquipmentRequest = {
  RID: number | string;
  RequestFrom: string;
  EmpName?: string;
  RequestFor: string;
  STOCKCODE?: string;
  StockName?: string;
  ReasonForReplacement_Repair?: string | null;
  RequestForStock?: string | null;
  UsageDays?: string | number | null;
  Request_Status: string;
  RequestDate?: string | null;
  CreatedOnRaw?: string | null;
  Equipment_EstimateDate?: string | null;
  Reject_Remarks?: string | null;
};

const Equipment: React.FC = () => {
  const [activeSection, setActiveSection] = useState<"submit" | "history">("history");
  const [user, setUser] = useState<any>(null);
  const [isAccountant, setIsAccountant] = useState(false);

  // Form States
  const [stockType, setStockType] = useState<string>("");
  const [stockCode, setStockCode] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [usageDays, setUsageDays] = useState<string>("");
  const [stockList, setStockList] = useState<StockOption[]>([]);

  // Data States
  const [requests, setRequests] = useState<EquipmentRequest[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal States
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedReq, setSelectedReq] = useState<EquipmentRequest | null>(null);
  const [actionType, setActionType] = useState<"accept" | "reject">("accept");
  const [estDate, setEstDate] = useState<string>(new Date().toISOString());
  const [rejectRemarks, setRejectRemarks] = useState("");

  // UI States
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "danger" | "warning">("success");

  const baseUrl = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token")?.replace(/"/g, "");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // ---------- Initialization ----------
  useEffect(() => {
    const stored = localStorage.getItem("user") || localStorage.getItem("storedUser");
    if (stored) {
      try {
        const u = JSON.parse(stored);
        setUser(u);
        const isAcc = String(u.empCode) === "1541" || u.userType?.toLowerCase() === "accountant";
        setIsAccountant(isAcc);
        if (isAcc) {
          setActiveSection("history");
        }
      } catch (e) {
        console.error("User parse error", e);
      }
    }
  }, []);

  // ---------- API Fetchers ----------
  const fetchStock = useCallback(async (empCode: string) => {
    try {
      const res = await axios.get(`${baseUrl}Stock/Load_Stockcode?Empcode=${empCode}`, {
        headers: getAuthHeaders(),
      });
      if (Array.isArray(res.data)) {
        setStockList(res.data.map((x: any) => ({
          code: x?.STOCKCODE ?? x?.[0] ?? "",
          name: x?.StockName ?? x?.[1] ?? ""
        })));
      }
    } catch (err) {
      console.error("Error loading stock", err);
    }
  }, [baseUrl]);

  const fetchUsage = useCallback(async (empCode: string, code: string) => {
    try {
      const res = await axios.get(`${baseUrl}Stock/Load_Item_Usage?Empcode=${empCode}&Stockcode=${code}`, {
        headers: getAuthHeaders(),
      });
      let days = "";
      if (Array.isArray(res.data) && res.data[0]) {
        // Based on API example: [["C011","MOUSE","2021-06-28T00:00:00",1729]]
        // Usage days is likely at index 3
        days = String(res.data[0][3] || res.data[0].UsageDays || "0");
      }
      setUsageDays(days);
    } catch (err) {
      console.error("Error loading usage days", err);
    }
  }, [baseUrl]);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await axios.get(`${baseUrl}Stock/Load_Equipment`, {
        params: {
          Usertype: isAccountant ? "Accountant" : (user.userType || "Employee"),
          Requist_From: user.empCode
        },
        headers: getAuthHeaders(),
      });

      let normalized: EquipmentRequest[] = [];
      if (Array.isArray(res.data)) {
        if (Array.isArray(res.data[0])) {
          normalized = res.data.map((r: any[]) => ({
            RID: r[0],
            RequestFrom: r[1],
            EmpName: r[2],
            RequestFor: r[3],
            STOCKCODE: r[4],
            StockName: r[5],
            ReasonForReplacement_Repair: r[6],
            RequestForStock: r[7],
            UsageDays: r[8],
            Request_Status: r[9],
            RequestDate: r[10],
            CreatedOnRaw: r[11],
            Equipment_EstimateDate: r[12],
            Reject_Remarks: r[13],
          }));
        } else {
          normalized = res.data;
        }
      }
      setRequests(normalized.sort((a, b) => Number(b.RID) - Number(a.RID)));
    } catch (err) {
      console.error("Error loading equipment", err);
      setToastMsg("Failed to load requests");
      setToastType("danger");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  }, [user, isAccountant, baseUrl]);

  useEffect(() => {
    if (user?.empCode) {
      fetchStock(user.empCode);
      fetchRequests();
    }
  }, [user, fetchStock, fetchRequests]);

  useEffect(() => {
    if (stockCode && user?.empCode && stockType !== "New Item") {
      fetchUsage(user.empCode, stockCode);
    }
  }, [stockCode, user, stockType, fetchUsage]);

  // ---------- Submit Logic ----------
  const handleSave = async () => {
    if (!stockType || (!stockCode && stockType !== "New Item") || !reason) {
      setToastMsg("Please fill all required fields");
      setToastType("warning");
      setShowToast(true);
      return;
    }

    const payload = {
      _RequestFrom: user.empCode,
      _RequestFor: stockType,
      _STOCKCODE: stockType === "New Item" ? "" : stockCode,
      _ReasonForReplacement_Repair: stockType !== "New Item" ? reason : "",
      _RequestForStock: stockType === "New Item" ? reason : "Replacement", // Aligning with API example 4
      _UsageDays: stockType === "New Item" ? "" : usageDays,
    };

    try {
      setLoading(true);
      const res = await axios.post(`${baseUrl}Stock/Save_equipment_request`, payload, {
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" }
      });

      const success = String(res.data).toLowerCase().includes("success") || Number(res.data) > 0;
      if (success) {
        setToastMsg("Request saved successfully!");
        setToastType("success");
        setShowToast(true);
        handleClear();
        fetchRequests();
        setActiveSection("history");
      } else {
        throw new Error(String(res.data));
      }
    } catch (err: any) {
      setToastMsg(`Error: ${err.message || "Failed to save"}`);
      setToastType("danger");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setStockType("");
    setStockCode("");
    setReason("");
    setUsageDays("");
  };

  const formatDisplayDate = (d: any) => {
    if (!d) return "";
    const m = moment(d, ["YYYY-MM-DDTHH:mm:ss", "DD-MM-YYYY", moment.ISO_8601], true);
    return m.isValid() ? m.format("DD MMM YYYY") : String(d);
  };


  // ---------- Accountant Actions ----------
  const openActionModal = (req: EquipmentRequest, type: "accept" | "reject") => {
    setSelectedReq(req);
    setActionType(type);
    setShowActionModal(true);
  };

  const handleStatusUpdate = async () => {
    if (!selectedReq || !selectedReq.RID || !selectedReq.RequestFrom) {
      setToastMsg("Invalid selection or request data");
      setToastType("warning");
      setShowToast(true);
      return;
    }

    if (actionType === "reject" && !rejectRemarks.trim()) {
      setToastMsg("Please specify reject remarks");
      setToastType("warning");
      setShowToast(true);
      return;
    }

    const payload = {
      _RID: String(selectedReq.RID),
      _RequestFrom: String(selectedReq.RequestFrom),
      _Request_Status: actionType === "accept" ? "Accept" : "Reject",
      _Accept_Reject_By: String(user.empCode),
      _Estimate: actionType === "accept" ? moment(estDate).format("DD-MM-YYYY") : "",
      _Reject_Remarks: actionType === "reject" ? rejectRemarks : ""
    };

    console.log(`Updating Status (${actionType}):`, payload);


    try {
      setLoading(true);
      await axios.post(`${baseUrl}Stock/Update_equipment_Date`, payload, {
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" }
      });
      setToastMsg(`Request ${actionType === "accept" ? "Accepted" : "Rejected"}`);
      setToastType("success");
      setShowToast(true);
      setShowActionModal(false);
      setRejectRemarks("");
      fetchRequests();
    } catch (err) {
      setToastMsg("Update failed");
      setToastType("danger");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Employee Actions ----------
  const handleReceived = async (req: EquipmentRequest) => {
    if (!req.RID || !req.RequestFrom) {
      setToastMsg("Invalid request identifiers");
      setToastType("warning");
      setShowToast(true);
      return;
    }

    try {
      setLoading(true);
      const payload = {
        _RID: String(req.RID),
        _RequestFrom: String(req.RequestFrom),
        _Request_Status: "Received"
      };
      console.log("Marking as Received:", payload);
      await axios.post(`${baseUrl}Stock/equipment_received`, payload, {
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" }
      });

      setToastMsg("Marked as Received");
      setToastType("success");
      setShowToast(true);
      fetchRequests();
    } catch (err) {
      setToastMsg("Update failed");
      setToastType("danger");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Helpers ----------
  const getStatusClass = (s: string) => {
    const k = (s || "").toLowerCase();
    if (k.includes("pending")) return "status-pending";
    if (k.includes("accept") || k.includes("deliver")) return "status-accepted";
    if (k.includes("receive")) return "status-received";
    if (k.includes("reject")) return "status-reject";
    return "";
  };

  return (
    <IonPage>
      <IonContent className="ion-padding" style={{ "--background": "var(--ion-background-color)" }}>
        <div className="equip-container">
          <div className="equip-integrated-header premium-trendy-bg">
            <div className="equip-page-title">Equipment Care</div>
            <Package size={28} />
          </div>

          <div className="equip-segment-container">
            <div
              className={`equip-segment-btn ${activeSection === "history" ? "active" : ""}`}
              onClick={() => setActiveSection("history")}
            >
              <History color="#000" size={18} />
              <span>My Requests</span>
            </div>
            <div
              className={`equip-segment-btn ${activeSection === "submit" ? "active" : ""}`}
              onClick={() => setActiveSection("submit")}
            >
              <PlusCircle color="#000" size={18} />
              <span>New Request</span>
            </div>
          </div>

          <div className="equip-main-grid">
            {activeSection === "submit" && (
              <div className="equip-card">
                <div className="equip-section-title">
                  <ClipboardCheck size={22} />
                  Raise New Request
                </div>

                <div className="equip-input-group">
                  <label className="equip-label">Request Type</label>
                  <div className="equip-input-wrapper">
                    <IonSelect
                      className="equip-select-custom"
                      value={stockType}
                      placeholder="Choose Type"
                      onIonChange={(e) => {
                        setStockType(e.detail.value);
                        if (e.detail.value === "New Item") {
                          setStockCode("");
                          setUsageDays("");
                        }
                      }}
                    >
                      <IonSelectOption value="Repair">Repair</IonSelectOption>
                      <IonSelectOption value="Replacement">Replacement</IonSelectOption>
                      <IonSelectOption value="New Item">New Item</IonSelectOption>
                    </IonSelect>
                  </div>
                </div>

                {stockType && stockType !== "New Item" && (
                  <div className="equip-input-group">
                    <label className="equip-label">Select Equipment</label>
                    <div className="equip-input-wrapper">
                      <IonSelect
                        className="equip-select-custom"
                        value={stockCode}
                        placeholder="Choose Stock"
                        onIonChange={(e) => setStockCode(e.detail.value)}
                      >
                        {stockList.map(s => (
                          <IonSelectOption key={s.code} value={s.code}>{s.name}</IonSelectOption>
                        ))}
                      </IonSelect>
                    </div>
                  </div>
                )}

                {stockType && (
                  <div className="equip-input-group">
                    <label className="equip-label">
                      {stockType === "New Item" ? "Equipment Name" : "Reason / Purpose"}
                    </label>
                    <textarea
                      className="equip-textarea"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={stockType === "New Item" ? "What do you need?" : "Why do you need this?"}
                      rows={4}
                    />
                  </div>
                )}

                {stockType && stockType !== "New Item" && (
                  <div className="equip-input-group">
                    <label className="equip-label">Current Usage Days</label>
                    <div className="equip-input-wrapper">
                      <input
                        type="text"
                        disabled
                        value={usageDays}
                        style={{ background: 'transparent', border: 'none', width: '100%', padding: '10px 0', fontWeight: 'bold' }}
                      />
                    </div>
                  </div>
                )}

                <div className="equip-button-group">
                  <button className="equip-btn equip-btn-outline" onClick={handleClear}>
                    <RefreshCcw size={18} />
                    Reset
                  </button>
                  <button className="equip-btn equip-btn-primary premium-trendy-bg" onClick={handleSave}>
                    <Send size={18} />
                    Submit
                  </button>
                </div>
              </div>
            )}

            {activeSection === "history" && (
              <div className="equip-requests-list">
                {requests.length > 0 ? (
                  requests.map((req, idx) => (
                    <div className="equip-request-card" key={req.RID || idx}>
                      <div className={`card-side-indicator indicator-${(req.Request_Status || "").toLowerCase()}`} />

                      <div className="card-header">
                        <div className="request-title-sec">
                          <span className="request-for">{req.StockName || req.RequestForStock || "Generic Item"}</span>
                          <span className="request-id">REF: #{req.RID}</span>
                        </div>
                        <div className={`status-pill ${getStatusClass(req.Request_Status)}`}>
                          {req.Request_Status}
                        </div>
                      </div>

                      <div className="card-info-grid">
                        <div className="info-item">
                          <div className="info-icon"><Layers size={14} /></div>
                          <div className="info-content">
                            <span className="info-label">Category</span>
                            <span className="info-value">{req.RequestFor}</span>
                          </div>
                        </div>
                        <div className="info-item">
                          <div className="info-icon"><Calendar size={14} /></div>
                          <div className="info-content">
                            <span className="info-label">Date</span>
                            <span className="info-value">{formatDisplayDate(req.CreatedOnRaw || req.RequestDate)}</span>
                          </div>
                        </div>
                        {isAccountant && (
                          <div className="info-item full-width">
                            <div className="info-icon"><Search size={14} /></div>
                            <div className="info-content">
                              <span className="info-label">Requested By</span>
                              <span className="info-value">{req.EmpName} ({req.RequestFrom})</span>
                            </div>
                          </div>
                        )}
                        <div className="info-item full-width">
                          <div className="info-icon"><Info size={14} /></div>
                          <div className="info-content">
                            <span className="info-label">Reason / Remarks</span>
                            <span className="info-value remarks-value">
                              {req.ReasonForReplacement_Repair || req.RequestForStock || "No details provided"}
                            </span>
                          </div>
                        </div>
                        {(req.Equipment_EstimateDate || req.Reject_Remarks) && (
                          <div className="info-item full-width" style={{ marginTop: '4px', padding: '8px', background: '#f8fafc', borderRadius: '8px' }}>
                            <div className="info-content">
                              <span className="info-label">{req.Reject_Remarks ? "Rejection Reason" : "ETA / Delivery"}</span>
                              <span className="info-value" style={{ color: req.Reject_Remarks ? 'var(--equip-danger)' : 'var(--equip-success)' }}>
                                {req.Reject_Remarks || formatDisplayDate(req.Equipment_EstimateDate)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {isAccountant && (req.Request_Status?.toLowerCase().includes("pending")) && (
                        <div className="card-actions-premium">
                          <button className="premium-btn btn-reject" onClick={() => openActionModal(req, "reject")}>
                            <XCircle size={16} /> REJECT
                          </button>
                          <button className="premium-btn btn-approve" onClick={() => openActionModal(req, "accept")}>
                            <CheckCircle2 size={16} /> ACCEPT
                          </button>
                        </div>
                      )}

                      {!isAccountant && (req.Request_Status?.toLowerCase().includes("pending") || req.Request_Status?.toLowerCase().includes("accept")) && (
                        <div className="card-actions-premium" style={{ justifyContent: 'flex-end' }}>
                          <button className="premium-btn btn-receive" onClick={() => handleReceived(req)}>
                            <CheckCircle size={16} /> ITEM RECEIVED
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="equip-empty-state">
                    <Layers className="equip-empty-icon" />
                    <p>No equipment requests found.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <IonModal isOpen={showActionModal} onDidDismiss={() => setShowActionModal(false)} className="equip-modal">
          <div className="modal-content-wrap">
            <h3 className="modal-title">
              {actionType === "accept" ? "Set Estimate Date" : "Reject Request"}
            </h3>

            {actionType === "accept" ? (
              <div className="equip-input-group">
                <label className="equip-label">Expected Date</label>
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '10px' }}>
                  <IonDatetime
                    presentation="date"
                    value={estDate}
                    onIonChange={(e) => setEstDate(e.detail.value as string)}
                  />
                </div>
              </div>
            ) : (
              <div className="equip-input-group">
                <label className="equip-label">Remarks for Rejection</label>
                <textarea
                  className="equip-textarea"
                  rows={4}
                  value={rejectRemarks}
                  onChange={(e) => setRejectRemarks(e.target.value)}
                  placeholder="Why is this being rejected?"
                />
              </div>
            )}

            <div className="equip-button-group">
              <button className="equip-btn equip-btn-outline" onClick={() => setShowActionModal(false)}>Cancel</button>
              <button
                className={`equip-btn ${actionType === "accept" ? "equip-btn-primary" : "btn-reject"}`}
                onClick={handleStatusUpdate}
              >
                Confirm {actionType === "accept" ? "Acceptance" : "Rejection"}
              </button>
            </div>
          </div>
        </IonModal>

        <IonLoading isOpen={loading} message="Please wait..." />

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          duration={2000}
          color={toastType === "success" ? "success" : toastType === "danger" ? "danger" : "warning"}
          position="bottom"
          style={{ "--border-radius": "12px", "--margin": "16px" }}
        />
      </IonContent>
    </IonPage>
  );
};

export default Equipment;
