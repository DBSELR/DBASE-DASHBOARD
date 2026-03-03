// src/pages/Equipment.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonContent,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonButton,
  IonRow,
  IonCol,
} from "@ionic/react";
import axios from "axios";


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

const API_BASE = "http://localhost:25918/api/";

const Equipment: React.FC = () => {
  const [stockType, setStockType] = useState<string>("");
  const [stockCode, setStockCode] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [usageDays, setUsageDays] = useState<string>("");
  const [stockList, setStockList] = useState<StockOption[]>([]);
  const [requests, setRequests] = useState<EquipmentRequest[]>([]);
  const [disableStock, setDisableStock] = useState<boolean>(false);

  // defaulted; replaced by stored user if available
  const [empCode, setEmpCode] = useState<string>("1509");
  const [userType, setUserType] = useState<string>("Employee");

  // axios with uniform logging
  const api = useMemo(() => {
    const instance = axios.create({ baseURL: API_BASE, timeout: 30000 });
    instance.interceptors.request.use((config) => {
      console.log(
        "[equipment][request]",
        (config.method || "GET").toUpperCase(),
        (config.baseURL || "") + (config.url || ""),
        { params: config.params, data: config.data, headers: config.headers }
      );
      return config;
    });
    instance.interceptors.response.use(
      (res) => {
        console.log("[equipment][response]", res.status, res.config.url, res.data);
        return res;
      },
      (error) => {
        console.error(
          "[equipment][error]",
          error?.response?.status,
          error?.config?.url,
          error?.response?.data || error.message
        );
        return Promise.reject(error);
      }
    );
    return instance;
  }, []);

  // ---------- Normalizers ----------
  const normalizeStock = (raw: any): StockOption[] => {
    if (Array.isArray(raw) && raw.length && Array.isArray(raw[0])) {
      return raw.map((row: [string, string]) => ({ code: row[0], name: row[1] }));
    }
    if (Array.isArray(raw)) {
      return raw.map((x: any) => ({
        code: x?.STOCKCODE ?? x?.code ?? x?.[0],
        name: x?.StockName ?? x?.name ?? x?.[1],
      }));
    }
    return [];
  };

  const normalizeRequests = (raw: any): EquipmentRequest[] => {
    if (Array.isArray(raw) && raw.length && Array.isArray(raw[0])) {
      return raw.map((r: any[]) => ({
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
    }
    return Array.isArray(raw) ? raw : [];
  };

  const extractUsageDays = (raw: any): string => {
    if (Array.isArray(raw) && raw.length && !Array.isArray(raw[0]) && raw[0]?.UsageDays != null) {
      return String(raw[0].UsageDays ?? "");
    }
    if (Array.isArray(raw) && raw.length && Array.isArray(raw[0])) {
      const inner = raw[0] as any[];
      const hit = inner.find((x) => {
        if (typeof x === "string" && /days?/i.test(x)) return true;
        if (typeof x === "number") return true;
        if (typeof x === "string" && /^\d+(\.\d+)?$/.test(x)) return true;
        return false;
      });
      return hit != null ? String(hit) : "";
    }
    return "";
  };

  // ---------- API calls ----------
  const fetchStock = async () => {
    try {
      console.log("[equipment][fetchStock] Empcode:", empCode);
      const res = await api.get("Stock/Load_Stockcode", { params: { Empcode: empCode } });
      const list = normalizeStock(res.data);
      console.log("[equipment][fetchStock] normalized:", list);
      setStockList(list);
    } catch (err) {
      console.error("[equipment][fetchStock] failed", err);
    }
  };

  const fetchUsageDays = async (code: string) => {
    try {
      console.log("[equipment][fetchUsageDays] params:", { Empcode: empCode, Stockcode: code });
      const res = await api.get("Stock/Load_Item_Usage", {
        params: { Empcode: empCode, Stockcode: code },
      });
      const value = extractUsageDays(res.data);
      console.log("[equipment][fetchUsageDays] raw:", res.data, "resolved UsageDays:", value);
      setUsageDays(value);
    } catch (err) {
      console.error("[equipment][fetchUsageDays] failed", err);
      setUsageDays("");
    }
  };

  const fetchGrid = async () => {
    try {
      console.log("[equipment][fetchGrid] params:", { Usertype: userType, Requist_From: empCode });
      const res = await api.get("Stock/Load_Equipment", {
        params: { Usertype: userType, Requist_From: empCode },
      });
      console.log("[equipment][fetchGrid] count:", Array.isArray(res.data) ? res.data.length : 0);
      setRequests(normalizeRequests(res.data));
    } catch (err) {
      console.error("[equipment][fetchGrid] failed", err);
      setRequests([]);
    }
  };

  const saveEquipment = async () => {
    const reqForStock = stockType === "New Item" ? reason : "";
    const reasonForRequest = stockType !== "New Item" ? reason : "";

    const payload = {
      _RequestFrom: empCode,
      _RequestFor: stockType,
      _STOCKCODE: stockType === "New Item" ? "" : stockCode,
      _ReasonForReplacement_Repair: reasonForRequest,
      _RequestForStock: reqForStock,
      _UsageDays: stockType === "New Item" ? "" : usageDays,
    };

    console.log("[equipment][saveEquipment] payload:", payload);

    try {
      const res = await api.post("Stock/Save_equipment_request", payload, {
        headers: { "Content-Type": "application/json" },
      });
      console.log("[equipment][saveEquipment][json] raw:", res.data);

      if (isSaveOk(res.data)) {
        alert("✅ Equipment Request Saved");
        await fetchGrid();
        clearForm();
        return;
      }
      alert(`❌ Save failed. Server said: ${String(res.data)}`);
    } catch (e: any) {
      if (axios.isAxiosError(e) && e.response?.status === 415) {
        console.warn("[equipment][saveEquipment] 415 on JSON, retrying as form-urlencoded...");
        const form = new URLSearchParams();
        Object.entries(payload).forEach(([k, v]) => form.append(k, String(v ?? "")));

        try {
          const res2 = await api.post("Stock/Save_equipment_request", form, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          });
          console.log("[equipment][saveEquipment][form] raw:", res2.data);

          if (isSaveOk(res2.data)) {
            alert("✅ Equipment Request Saved");
            await fetchGrid();
            clearForm();
            return;
          }
          alert(`❌ Save failed. Server said: ${String(res2.data)}`);
        } catch (e2) {
          console.error("[equipment][saveEquipment][form] failed", e2);
          alert("❌ API Error");
        }
      } else {
        console.error("[equipment][saveEquipment] failed", e);
        alert("❌ API Error");
      }
    }
  };

  const isSaveOk = (data: any) => {
    if (data == null) return false;
    if (typeof data === "number") return data > 0;
    const s = String(data).toLowerCase();
    if (s.includes("success")) return true;
    const n = parseInt(s, 10);
    return !Number.isNaN(n) && n > 0;
  };

  const clearForm = () => {
    setStockType("");
    setStockCode("");
    setReason("");
    setUsageDays("");
    setDisableStock(false);
  };

  // ---------- init user from localStorage ----------
  useEffect(() => {
    try {
      const stored = localStorage.getItem("storedUser") || localStorage.getItem("user");
      if (stored) {
        const obj = JSON.parse(stored);
        const ec = obj?.empCode || obj?.username || empCode;
        const ut = obj?.userType || userType;
        setEmpCode(String(ec));
        setUserType(String(ut));
        console.log("[equipment][init] stored user:", obj);
      } else {
        console.log("[equipment][init] no storedUser found; using defaults", { empCode, userType });
      }
    } catch (e) {
      console.warn("[equipment][init] failed to parse stored user, using defaults.", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- initial data loads ----------
  useEffect(() => {
    fetchStock();
    fetchGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empCode, userType]);

  useEffect(() => {
    if (stockCode && stockType !== "New Item") {
      console.log("[equipment][stock change]", { stockCode, stockType });
      fetchUsageDays(stockCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockCode, stockType]);

  const changColor = (status: string) => {
    if (status === "Delivered" || status === "Received") return { backgroundColor: "rgba(80, 182, 33, 0.06)" };
    if (status === "Reject") return { backgroundColor: "rgba(236, 29, 29, 0.06)" };
    if (status === "Pending") return { backgroundColor: "rgba(222, 184, 135, 0.15)" };
    return {};
  };

  const statusToClass = (s: string) => {
    const k = (s || "").toLowerCase();
    if (k.includes("deliver") || k.includes("receive")) return "status-success";
    if (k.includes("reject")) return "status-danger";
    if (k.includes("pending")) return "status-warn";
    return "status-neutral";
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="menu-toolbar">
          <img src="./images/dbase.png" alt="DBase Logo" className="menu-logo" />
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding equip-content">
        <h2 className="equip-title">Equipment Request List</h2>

        <div className="equip-form">
          <IonItem className="equip-item">
            <IonLabel position="stacked">Select Request Type</IonLabel>
            <IonSelect
              interface="popover"
              value={stockType}
              onIonChange={(e) => {
                const val = e.detail.value as string;
                console.log("[equipment][change type]", val);
                setStockType(val);
                const isNew = val === "New Item";
                setDisableStock(isNew);
                if (isNew) {
                  setStockCode("");
                  setUsageDays("");
                }
              }}
            >
              <IonSelectOption value="Replacement">Replacement</IonSelectOption>
              <IonSelectOption value="New Item">New Item</IonSelectOption>
              <IonSelectOption value="Repair">Repair</IonSelectOption>
            </IonSelect>
          </IonItem>

          {!!stockType && stockType !== "New Item" && (
            <IonItem className="equip-item">
              <IonLabel position="stacked">Select Stock</IonLabel>
              <IonSelect
                value={stockCode}
                onIonChange={(e) => setStockCode(String(e.detail.value))}
                disabled={disableStock}
              >
                {stockList.map((s) => (
                  <IonSelectOption key={s.code} value={s.code}>
                    {s.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          )}

          {!!stockType && (
            <IonItem className="equip-item">
              <IonLabel position="stacked">
                {stockType === "New Item" ? "New Stock Name" : stockType}
              </IonLabel>
              <IonInput
                value={reason}
                placeholder="Enter value"
                onIonChange={(e) => setReason(String(e.detail.value || ""))}
              />
            </IonItem>
          )}

          {!!stockType && (
            <IonItem className="equip-item">
              <IonLabel position="stacked">Usage Days</IonLabel>
              <IonInput
                type="number"
                value={usageDays}
                disabled={stockType === "New Item"}
                placeholder="Enter usage days"
                onIonChange={(e) => setUsageDays(String(e.detail.value || ""))}
              />
            </IonItem>
          )}

          {!!stockType && (
            <IonRow className="ion-margin-top">
              <IonCol size="12">
                <IonButton expand="block" color="primary" onClick={saveEquipment} className="equip-saveBtn">
                  Save
                </IonButton>
              </IonCol>
            </IonRow>
          )}
        </div>

        <div className="equip-tableWrap">
          <table className="equip-table">
            <thead>
              <tr>
                <th>RID</th>
                <th>EmpCode</th>
                <th>Request For</th>
                <th>Stock Name</th>
                <th>Usage Days</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r, i) => (
                <tr key={`${r.RID}-${i}`} style={changColor(r.Request_Status)}>
                  <td className="mono">{r.RID}</td>
                  <td className="mono">{r.RequestFrom}</td>
                  <td>{r.RequestFor}</td>
                  <td>{r.StockName}</td>
                  <td className="center">{r.UsageDays}</td>
                  <td className="center">
                    <span className={`status-pill ${statusToClass(r.Request_Status)}`}>
                      {r.Request_Status}
                    </span>
                  </td>
                </tr>
              ))}
              {!requests?.length && (
                <tr>
                  <td colSpan={6} className="center muted">
                    No requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Equipment;
