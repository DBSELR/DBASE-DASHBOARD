import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IonButton,
  IonCol,
  IonContent,
  IonDatetime,
  IonGrid,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonLoading,
  IonModal,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonRow,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToast,
  IonToolbar,
  IonCheckbox,
} from "@ionic/react";
import { arrowForward, close } from "ionicons/icons";
import axios from "axios";
import moment from "moment";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import type { RefresherEventDetail } from "@ionic/core";

/* ---------- types (normalized) ---------- */
type Employee = {
  EmpCode: string;
  EmpName: string;
  Designation: string;
  Ischeck?: boolean;
};
type TransactionType = { TID: string; TTYPE: string };
type Year = { FYear: string };
type Month = { FMonth: string };
type Transaction = {
  Date: string;
  SALorAdv: string;
  CDescription: string;
  Amount: number;
  bclass?: string;
};
type Voucher = {
  VID: string;
  Date: string; // dd-MM-YYYY
  EmpID: string; // "1509 - Name"
  VDescription: string;
  amount: number;
  isVerified: "Y" | "N" | "U";
  fname: string; // image 1 (voucher)
  fpath: string; // image 2 (bill)
};
type AdvancePending = {
  EmpName: string;
  CashInHand: number;
  Advance_Bal: number;
  Advance: number;
  Advance_Repaid: number;
  Credits: number;
  Debits: number;
  Vouchers: number;
};

/* ---------- config ---------- */
const baseUrl = "/api"; // dev proxy; set to full origin in production

const getAuthHeaders = () => {
  const token = (localStorage.getItem("token") || "").replace(/"/g, "");
  const headers = { Authorization: `Bearer ${token}` };
  console.log("[auth] headers:", headers);
  return headers;
};

/* ---------- normalize helpers ---------- */
const str = (v: any) => (v === null || v === undefined ? "" : String(v).trim());

const normalizeEmployees = (rows: any[]): Employee[] => {
  const out = rows.map((r) => {
    if (Array.isArray(r)) {
      // Example: ["1501","1501-NAME","Admin","Director",...]
      const code = str(r[0]);
      const codeName = str(r[1]);
      const rawName = codeName.includes("-")
        ? codeName.split("-").slice(1).join("-").trim()
        : codeName;
      const designation = str(r[3] ?? r[2]);
      return { EmpCode: code, EmpName: rawName, Designation: designation };
    }
    const o = r as any;
    return {
      EmpCode: str(o.EmpCode),
      EmpName: str(o.EmpName),
      Designation: str(o.Designation),
    };
  });
  console.log("[normalize] employees active:", out);
  return out;
};

const normalizeEmployeesVoucher = (rows: any[]): Employee[] => {
  const out = normalizeEmployees(rows).map((e) => ({ ...e, Ischeck: false }));
  console.log("[normalize] employees voucher:", out);
  return out;
};

const normalizeTxnTypes = (rows: any[]): TransactionType[] => {
  const out = rows.map((r) =>
    Array.isArray(r)
      ? { TID: String(r[0]), TTYPE: str(r[1]) }
      : { TID: String((r as any).TID), TTYPE: str((r as any).TTYPE) }
  );
  console.log("[normalize] transaction types:", out);
  return out;
};

const normalizeYears = (rows: any[]): Year[] => {
  const out = rows.map((r) => ({
    FYear: Array.isArray(r) ? str(r[1]) : str((r as any).FYear),
  }));
  console.log("[normalize] years:", out);
  return out;
};

const normalizeMonths = (rows: any[]): Month[] => {
  const out = rows.map((r) => ({
    FMonth: Array.isArray(r) ? str(r[1]) : str((r as any).FMonth),
  }));
  console.log("[normalize] months:", out);
  return out;
};

const normalizeCurrentCash = (rows: any[]) => {
  // Example: [[30000.0,0.0]] -> { hand: "30000", adv: "0" }
  const a = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : [];
  const hand = a[0] != null ? String(a[0]) : "0";
  const adv = a[1] != null ? String(a[1]) : "0";
  const out = { hand, adv };
  console.log("[normalize] current cash:", out);
  return out;
};

const looksLikeYyyyMmDdHHmmss = (s: string) => /^\d{14}/.test(s || "");
const fmtFromYYYYMMDD = (yyyymmdd: string) => {
  if (!/^\d{8}$/.test(yyyymmdd)) return "";
  const d = moment(yyyymmdd, "YYYYMMDD");
  return d.isValid() ? d.format("DD-MM-YYYY") : "";
};

const normalizeTransactions = (rows: any[]): Transaction[] => {
  const out = rows.map((r) => {
    if (!Array.isArray(r)) {
      const o = r as any;
      return {
        Date: str(o.Date),
        SALorAdv: str(o.SALorAdv),
        CDescription: str(o.CDescription),
        Amount: Number(o.Amount ?? 0),
        bclass: o.bclass ? String(o.bclass) : undefined,
      };
    }
    const raw = r as any[];
    let date = "";
    if (typeof raw[0] === "string" && raw[0].includes("-")) {
      date = str(raw[0]);
    } else if (looksLikeYyyyMmDdHHmmss(String(raw[1] || ""))) {
      date = fmtFromYYYYMMDD(String(raw[1]).slice(0, 8));
    } else {
      date = str(raw[0]);
    }
    const amount = Number(raw[3] ?? raw[2] ?? 0);
    const desc = str(raw[2] ?? raw[1] ?? "");
    const salOrAdv = str(raw[4] ?? raw[1] ?? "");
    const bclass = raw[5] != null ? String(raw[5]) : undefined;

    return {
      Date: date,
      SALorAdv: salOrAdv,
      CDescription: desc,
      Amount: amount,
      bclass,
    };
  });
  console.log("[normalize] transactions:", out);
  return out;
};

const normalizeVouchers = (rows: any[]): Voucher[] => {
  const out = rows.map((r) => {
    if (!Array.isArray(r)) {
      const o = r as any;
      let date = str(o.Date);
      let emp = str(o.EmpID);
      if (/^\d{2}-\d{2}-\d{4}$/.test(emp) && /-/.test(date)) {
        const tmp = date;
        date = emp;
        emp = tmp;
      }
      return {
        VID: str(o.VID),
        Date: date,
        EmpID: emp,
        VDescription: str(o.VDescription),
        amount: Number(o.amount ?? 0),
        isVerified: (o.isVerified ?? "N") as Voucher["isVerified"],
        fname: str(o.fname),
        fpath: str(o.fpath),
      };
    }
    // [VID, EmpID("1509 - Name"), Date("dd-MM-YYYY"), VDescription, amount, fname, fpath, isVerified]
    const a = r as any[];
    return {
      VID: str(a[0]),
      EmpID: str(a[1]),
      Date: str(a[2]),
      VDescription: str(a[3]),
      amount: Number(a[4] ?? 0),
      fname: str(a[5]),
      fpath: str(a[6]),
      isVerified: (str(a[7]) || "N") as Voucher["isVerified"],
    };
  });
  console.log("[normalize] vouchers:", out);
  return out;
};

const normalizeAdvancePending = (rows: any[]): AdvancePending[] => {
  const out = rows.map((r) => {
    if (!Array.isArray(r)) return r as AdvancePending;
    const a = r as any[];
    return {
      EmpName: str(a[0]),
      CashInHand: Number(a[1] ?? 0),
      Advance_Bal: Number(a[2] ?? 0),
      Advance: Number(a[3] ?? 0),
      Advance_Repaid: Number(a[4] ?? 0),
      Credits: Number(a[5] ?? 0),
      Debits: Number(a[6] ?? 0),
      Vouchers: Number(a[7] ?? 0),
    };
  });
  console.log("[normalize] advance pending:", out);
  return out;
};

/* ========================================================= */

const Transactions: React.FC = () => {
  /* -------- init from localStorage -------- */
  const storedUserRaw = localStorage.getItem("user");
  const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
  console.log("[init] stored user:", storedUser);

  const EmpCode = storedUser?.empCode || "1509";
  const EmpName = storedUser?.empName || "Unknown";
  const UserDesig = storedUser?.designation || "Employee";
  const EmpCodeName = `${EmpCode}-B RAMALINGESWARA RAO`.includes(EmpName)
    ? `${EmpCode}-${EmpName}`
    : `${EmpCode}-${EmpName}`;

  const imgBase = useMemo(
    () => baseUrl.replace(/\/api$/, "") + "/imgpath/",
    []
  );

  /* -------- UI state -------- */
  const [activeTab, setActiveTab] = useState<
    "transfer" | "voucher" | "advances"
  >("transfer");

  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string>("");
  const [toastColor, setToastColor] = useState<"success" | "danger">("success");
  const [showToast, setShowToast] = useState(false);

  const [handCash, setHandCash] = useState("0");
  const [advanceCash, setAdvanceCash] = useState("0");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesTemp, setEmployeesTemp] = useState<Employee[] | null>(null);
  const [employeesVoucher, setEmployeesVoucher] = useState<Employee[]>([]);

  const [txnTypes, setTxnTypes] = useState<TransactionType[]>([]);
  const [years, setYears] = useState<Year[]>([]);
  const [months, setMonths] = useState<Month[]>([]);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [advanceRows, setAdvanceRows] = useState<AdvancePending[]>([]);

  // Filters / inputs
  const [paymentType, setPaymentType] = useState<string>("");
  const [transferTo, setTransferTo] = useState<string>("");
  const [transferMode, setTransferMode] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  const [advRepayFrom, setAdvRepayFrom] = useState<string>("");
  const [transCredDebt, setTransCredDebt] = useState<string>("All");
  const [selectedTxnType, setSelectedTxnType] = useState<string>("All");

  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();

  // voucher form
  const [invoiceHeads, setInvoiceHeads] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string | undefined>();
  const [voucherAmount, setVoucherAmount] = useState<string>("");
  const [voucherDesc, setVoucherDesc] = useState<string>("");
  const [selectEmpHint, setSelectEmpHint] = useState<string>("");

  const [photoVoucher, setPhotoVoucher] = useState<string | null>(null);
  const [photoBill, setPhotoBill] = useState<string | null>(null);

  const [voucherEmpView, setVoucherEmpView] = useState<string | null>(
    `${EmpCode}-${EmpName}`
  );
  const [searchDate, setSearchDate] = useState<string | undefined>();
  const [isDateDisabled, setIsDateDisabled] = useState<boolean>(false);
  const [disableRequist, setDisableRequist] = useState<boolean>(false);

  // Modals
  const [openStartModal, setOpenStartModal] = useState(false);
  const [openEndModal, setOpenEndModal] = useState(false);
  const [openInvoiceDateModal, setOpenInvoiceDateModal] = useState(false);
  const [openVoucherEmpModal, setOpenVoucherEmpModal] = useState(false);
  const [openDA_TA_Modal, setOpenDA_TA_Modal] = useState(false);

  // Voucher view/verify
  const [openVoucherModal, setOpenVoucherModal] = useState(false);
  const [currentVoucher, setCurrentVoucher] = useState<Voucher | null>(null);
  const [verifyAmount, setVerifyAmount] = useState<string>("");

  const voucherFileInputRef = useRef<HTMLInputElement>(null);
  const billFileInputRef = useRef<HTMLInputElement>(null);

  /* -------- toast helper -------- */
  const presentToast = (msg: string, ok = true) => {
    setToastMsg(msg);
    setToastColor(ok ? "success" : "danger");
    setShowToast(true);
  };

  /* -------- load on mount -------- */
  useEffect(() => {
    (async () => {
      await loadAll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      console.log("[empDetails] from localStorage:", `${EmpCode}-${EmpName}`);
      await Promise.all([
        fetchEmployeesActive(),
        fetchEmployeesVoucher(),
        fetchAdvancePending(),
        fetchCurrentCash(),
        fetchVouchers(EmpCode),
        fetchTxnTypes(),
        fetchYears(),
        fetchMonths("All"),
        fetchTransactions(EmpCode),
      ]);
    } catch (e) {
      console.error("Error during init:", e);
      presentToast("Error loading initial data.", false);
    } finally {
      setLoading(false);
    }
  };

  /* -------- API calls -------- */
  const fetchEmployeesActive = async () => {
    console.log(
      "[employeesActive] GET /api/Employee/Load_Employees?SearchEmp=Active"
    );
    const res = await axios.get(
      `${baseUrl}/Employee/Load_Employees?SearchEmp=Active`,
      { headers: getAuthHeaders() }
    );
    const list = normalizeEmployees(res.data || []);
    setEmployees(list);
    setEmployeesTemp(list.filter((e) => e.EmpCode !== EmpCode));
  };

  const fetchEmployeesVoucher = async () => {
    console.log(
      "[employeesVoucher] GET /api/Employee/load_employees_voucher?SearchEmp=Active"
    );
    const res = await axios.get(
      `${baseUrl}/Employee/load_employees_voucher?SearchEmp=Active`,
      {
        headers: getAuthHeaders(),
      }
    );
    setEmployeesVoucher(normalizeEmployeesVoucher(res.data || []));
  };

  const fetchTxnTypes = async () => {
    console.log("[txnType] GET /api/Transactions/Load_TransactionType");
    const res = await axios.get(
      `${baseUrl}/Transactions/Load_TransactionType`,
      { headers: getAuthHeaders() }
    );
    setTxnTypes(normalizeTxnTypes(res.data || []));
  };

  const fetchYears = async () => {
    console.log(`[year] GET /api/Transactions/Load_Year?EmpCode=${EmpCode}`);
    const res = await axios.get(
      `${baseUrl}/Transactions/Load_Year?EmpCode=${EmpCode}`,
      { headers: getAuthHeaders() }
    );
    setYears(normalizeYears(res.data || []));
  };

  const fetchMonths = async (fYear: string) => {
    console.log(
      `[month] GET /api/Transactions/Load_Month?EmpCode=${EmpCode}&FYear=${fYear}`
    );
    const res = await axios.get(
      `${baseUrl}/Transactions/Load_Month?EmpCode=${EmpCode}&FYear=${fYear}`,
      {
        headers: getAuthHeaders(),
      }
    );
    setMonths(normalizeMonths(res.data || []));
  };

  const fetchCurrentCash = async () => {
    console.log(
      `[currentCash] GET /api/Transactions/Load_Current_Cash?EmpCode=${EmpCode}`
    );
    const res = await axios.get(
      `${baseUrl}/Transactions/Load_Current_Cash?EmpCode=${EmpCode}`,
      {
        headers: getAuthHeaders(),
      }
    );
    const cash = normalizeCurrentCash(res.data || []);
    setHandCash(cash.hand);
    setAdvanceCash(cash.adv);
  };

  const fetchTransactions = async (emp: string) => {
    const start = startDate ? moment(startDate).format("DD-MM-YYYY") : "All";
    const end = endDate ? moment(endDate).format("DD-MM-YYYY") : "All";
    console.log(
      `[transactions] GET /api/Transactions/Load_Transactions?EmpCode=${emp}&TransCredDebt=${transCredDebt}&TransactionType=${selectedTxnType}&TStartDt=${start}&TEndDt=${end}`
    );
    const res = await axios.get(
      `${baseUrl}/Transactions/Load_Transactions?EmpCode=${emp}&TransCredDebt=${transCredDebt}&TransactionType=${selectedTxnType}&TStartDt=${start}&TEndDt=${end}`,
      { headers: getAuthHeaders() }
    );
    setTransactions(normalizeTransactions(res.data || []));
  };

  const fetchVouchers = async (emp: string | "ALL") => {
    const date = searchDate ? moment(searchDate).format("YYYY-MM-DD") : "All";
    console.log(
      `[vouchers] GET /api/Transactions/Load_Vouchers?EmpCode=${emp}&Date=${date}`
    );
    const res = await axios.get(
      `${baseUrl}/Transactions/Load_Vouchers?EmpCode=${emp}&Date=${date}`,
      {
        headers: getAuthHeaders(),
      }
    );
    setVouchers(normalizeVouchers(res.data || []));
  };

  const fetchAdvancePending = async () => {
    console.log(
      "[advancePending] GET /api/Transactions/Load_Advance_PendingAmt"
    );
    const res = await axios.get(
      `${baseUrl}/Transactions/Load_Advance_PendingAmt`,
      { headers: getAuthHeaders() }
    );
    setAdvanceRows(normalizeAdvancePending(res.data || []));
  };

  /* -------- Pull to refresh -------- */
  const onRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    try {
      await loadAll();
    } finally {
      e.detail.complete();
    }
  };

  /* -------- Transfer logic -------- */
  const onPaymentTypeChange = (val: string) => {
    setPaymentType(val);
    setTransferTo("");
    setAdvRepayFrom("");

    if (
      val === "Advance Repayment" &&
      !(UserDesig === "Director" || UserDesig === "In-Charge F&A")
    ) {
      const filtered = employees.filter(
        (emp) =>
          emp.Designation === "Director" || emp.Designation === "In-Charge F&A"
      );
      setEmployeesTemp(filtered);
    } else if (
      val === "Advance Repayment" &&
      (UserDesig === "Director" || UserDesig === "In-Charge F&A")
    ) {
      setAdvRepayFrom("Select Payee");
      setEmployeesTemp(null);
    } else if (val === "Advance") {
      const filtered = employees.filter(
        (emp) => emp.Designation !== "Director" && emp.EmpCode !== EmpCode
      );
      setEmployeesTemp(filtered);
    } else {
      const filtered = employees.filter((emp) => emp.EmpCode !== EmpCode);
      setEmployeesTemp(filtered);
    }
  };

  const checkAmount = (val: string) => {
    if (!(UserDesig === "Director" || UserDesig === "In-Charge F&A")) {
      if (paymentType === "Advance Repayment" || paymentType === "Advance") {
        if (Number(advanceCash) < Number(val)) {
          presentToast(
            `Maximum Advance Transfer/Repayment amount is ${advanceCash}/-`,
            false
          );
          setAmount("");
          return;
        }
      } else {
        if (Number(handCash) < Number(val)) {
          presentToast(`Maximum transfer amount is ${handCash}/-`, false);
          setAmount("");
          return;
        }
      }
    }
  };

  const sendSMSTransfer = async (
    fromCode: string,
    toCode: string,
    amt: string,
    mode: string
  ) => {
    try {
      const date = new Date().toLocaleString();
      const textMessage = `Money Transfer : Rs ${amt} // From ${fromCode} // To : ${toCode} // Date : ${date} // through : ${mode}`;
      const mobile = "9640143677";
      await axios.get(
        `${baseUrl}/Sources/sendMessage?phoneNo=${mobile}&message=${encodeURIComponent(
          textMessage
        )}`,
        {
          headers: getAuthHeaders(),
        }
      );
      console.log("[sms] sent:", { mobile, textMessage });
    } catch (err) {
      console.error("Failed to send SMS.", err);
    }
  };

  const clearTransfer = () => {
    setTransferTo("");
    setSelectedTxnType("All");
    setPaymentType("");
    setTransferMode("");
    setAmount("");
    setAdvRepayFrom("");
    fetchCurrentCash();
  };

  const saveTransfer = async () => {
    if (!transferTo || !transferMode || !amount) {
      presentToast("Required Field(s) Empty...", false);
      return;
    }

    setLoading(true);
    try {
      const transferToCode = transferTo.split("-")[0];
      const transferFromCode = advRepayFrom
        ? advRepayFrom.split("-")[0]
        : EmpCode;

      const payload = {
        _empcode: transferFromCode,
        _transferTo: transferToCode,
        _Amt: amount,
        _remarks:
          paymentType === "--"
            ? `Amount transferred to ${transferToCode}, through ${transferMode}`
            : `${paymentType} Amount transferred to ${transferToCode}, through ${transferMode}`,
        _transferType: transferMode,
        _paymentType:
          paymentType === "--" || paymentType === "" ? "Credit" : paymentType,
      };

      console.log("[transfer] payload:", payload);

      await axios.post(`${baseUrl}/Transactions/Save_moneytransfer`, payload, {
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      });

      presentToast("Money Transfer successful...");
      await Promise.all([
        fetchCurrentCash(),
        fetchTransactions(EmpCode),
        fetchAdvancePending(),
      ]);
      await sendSMSTransfer(
        transferFromCode,
        transferToCode,
        amount,
        transferMode
      );
      clearTransfer();
    } catch (err) {
      console.error("Error saving transfer:", err);
      presentToast("Error saving transfer.", false);
    } finally {
      setLoading(false);
    }
  };

  /* -------- Voucher logic -------- */
  const takePhoto = async (which: "voucher" | "bill") => {
    try {
      const image = await Camera.getPhoto({
        quality: 100,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
      });
      const base64Image = `data:image/jpeg;base64,${image.base64String}`;
      if (which === "voucher") setPhotoVoucher(base64Image);
      else setPhotoBill(base64Image);
      console.log("[camera] captured:", which);
    } catch (e) {
      console.error("Camera error:", e);
      presentToast("Failed to take photo.", false);
    }
  };

  const fileToBase64Url = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const handleVoucherFilePick = async (
    e: React.ChangeEvent<HTMLInputElement>,
    which: "voucher" | "bill"
  ) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 500_000) {
      presentToast("Image size should be less than 500kb.", false);
      return;
    }
    const dataUrl = await fileToBase64Url(f);
    if (which === "voucher") setPhotoVoucher(dataUrl);
    else setPhotoBill(dataUrl);
    e.target.value = "";
  };

  const voucherClear = () => {
    setVoucherAmount("");
    setVoucherDesc("");
    setInvoiceHeads("");
    setInvoiceDate(undefined);
    setPhotoVoucher(null);
    setPhotoBill(null);
    setDisableRequist(false);
    setSelectEmpHint("");
    setEmployeesVoucher((prev) => prev.map((e) => ({ ...e, Ischeck: false })));
    if (voucherFileInputRef.current) voucherFileInputRef.current.value = "";
    if (billFileInputRef.current) billFileInputRef.current.value = "";
  };

  const handleVoucherHeadsChange = (value: string) => {
    setInvoiceHeads(value);
    setVoucherDesc("");
    setSelectEmpHint("");

    if (value === "DA" || value === "TA") {
      setSelectEmpHint("Select Employees");
      setDisableRequist(true);
      setIsDateDisabled(false);
      setOpenDA_TA_Modal(true);
    } else if (value === "OfficeExpenses") {
      setIsDateDisabled(true);
      setInvoiceDate(new Date().toISOString());
    } else {
      setIsDateDisabled(false);
      setDisableRequist(false);
    }
  };

  const onToggleEmpForVoucher = (empCode: string, checked: boolean) => {
    setEmployeesVoucher((prev) =>
      prev.map((e) => (e.EmpCode === empCode ? { ...e, Ischeck: checked } : e))
    );
    setVoucherDesc((prev) =>
      checked ? `${prev}${empCode},` : prev.replace(`${empCode},`, "")
    );
  };

  const saveVoucher = async () => {
    if (!voucherAmount || !invoiceHeads || !invoiceDate) {
      presentToast("Required Field(s) Empty...", false);
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();

      // attach images if available
      let imgType = "";
      if (photoVoucher) {
        const blob = await (await fetch(photoVoucher)).blob();
        fd.append("Voucherimg", blob, `${EmpCode}.jpg`);
        imgType += (imgType ? "&&" : "") + "Voucherimg";
      }
      if (photoBill) {
        const blob = await (await fetch(photoBill)).blob();
        fd.append("Billimg", blob, `${EmpCode}.jpg`);
        imgType += (imgType ? "&&" : "") + "Billimg";
      }

      fd.append("_Img", imgType.includes("Voucherimg") ? "Voucherimg" : "");
      fd.append("_Img2", imgType.includes("Billimg") ? "Billimg" : "");
      fd.append("_Img_Type", imgType || "");
      fd.append("_VoucherAmount", voucherAmount);
      fd.append("_EmpCode", EmpCode);
      fd.append("_VoucherDesc", voucherDesc || "");
      fd.append("_Invoice_Date", moment(invoiceDate).format("YYYY-MM-DD"));
      fd.append("_Invoice_Heads", invoiceHeads);

      await axios.post(`${baseUrl}/Transactions/Save_Voucher`, fd, {
        headers: getAuthHeaders(),
      });

      presentToast("Voucher submitted successfully...");
      voucherClear();
      await fetchCurrentCash();
      await fetchVouchers(EmpCode);
    } catch (e) {
      console.error("Error submitting voucher:", e);
      presentToast("Error submitting voucher.", false);
    } finally {
      setLoading(false);
    }
  };

  const verifyVoucher = async (
    vid: string,
    newAmt: string,
    originalAmt: number
  ) => {
    try {
      const status = Number(newAmt) !== Number(originalAmt) ? "U" : "Y";
      const payload = { _Amt: newAmt, _vid: vid, _status: status };
      await axios.post(`${baseUrl}/Transactions/Verify_Voucher`, payload, {
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      });
      presentToast("Voucher verified successfully...");
      const vEmpCode = voucherEmpView ? voucherEmpView.split("-")[0] : "ALL";
      await fetchVouchers(vEmpCode as any);
      setOpenVoucherModal(false);
    } catch (e) {
      console.error("Voucher not verified.", e);
      presentToast("Voucher not verified.", false);
    }
  };

  /* -------- UI -------- */
  return (
    <IonPage>
      <IonHeader>
              <IonToolbar>
                <IonToolbar className="menu-toolbar">
                  <img
                    src="./images/dbase.png"
                    alt="DBase Logo"
                    className="menu-logo"
                  />
                </IonToolbar>
              </IonToolbar>
            </IonHeader>

      <IonContent className="od-content">
        <IonRefresher slot="fixed" onIonRefresh={onRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <IonLoading isOpen={loading} message="Loading..." />

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          duration={2500}
          color={toastColor}
        />

        {/* Top balance chips */}
        <div className="balance-wrap">
          <div className="chip chip--hand">
            <div className="chip-title">in Hand Amt</div>
            <div className="chip-amt">₹ {handCash}/-</div>
          </div>
          <div className="chip chip--advance">
            <div className="chip-title">Advance Amt</div>
            <div className="chip-amt">₹ {advanceCash}/-</div>
          </div>
        </div>

        {/* Segment tabs */}
        <div className="seg-wrap">
          <IonSegment
            value={activeTab}
            onIonChange={(e) => setActiveTab(e.detail.value as any)}
            color="primary"
          >
            <IonSegmentButton value="transfer">
              <IonLabel>Transfer</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="voucher">
              <IonLabel>Voucher</IonLabel>
            </IonSegmentButton>
            {(UserDesig === "Director" || UserDesig === "In-Charge F&A") && (
              <IonSegmentButton value="advances">
                <IonLabel>Advances</IonLabel>
              </IonSegmentButton>
            )}
          </IonSegment>
          {/* <div className="seg-underline" /> */}
        </div>

        {/* Transfer tab */}
        {activeTab === "transfer" && (
          <div className="tab-pad">
            <IonGrid className="form-grid">
              <IonRow>
                <IonCol size="12" sizeMd="2">
                  <IonItem>
                    <IonSelect
                      interface="popover"
                      placeholder="Payment Type*"
                      value={paymentType}
                      onIonChange={(e) => onPaymentTypeChange(e.detail.value)}
                    >
                      <IonSelectOption value="Office Expenses">
                        Office Expenses
                      </IonSelectOption>
                      {(UserDesig === "Director" ||
                        UserDesig === "In-Charge F&A") && (
                        <IonSelectOption value="Advance">
                          Advance
                        </IonSelectOption>
                      )}
                      <IonSelectOption value="Advance Repayment">
                        Advance Repayment
                      </IonSelectOption>
                      {(UserDesig === "Director" ||
                        UserDesig === "In-Charge F&A") && (
                        <IonSelectOption value="Salary">Salary</IonSelectOption>
                      )}
                    </IonSelect>
                    {!!advRepayFrom && (
                      <IonLabel
                        slot="end"
                        className="mini-button"
                        onClick={() => setOpenVoucherEmpModal(true)}
                      >
                        {advRepayFrom}
                      </IonLabel>
                    )}
                  </IonItem>
                </IonCol>

                <IonCol size="12" sizeMd="2">
                  <IonItem>
                    <IonSelect
                      interface="popover"
                      placeholder="Tranfer To*"
                      value={transferTo}
                      onIonChange={(e) => setTransferTo(e.detail.value)}
                    >
                      {(employeesTemp || employees).map((emp) => (
                        <IonSelectOption
                          key={emp.EmpCode}
                          value={`${emp.EmpCode}-${emp.EmpName}`}
                        >
                          {emp.EmpName}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                </IonCol>

                <IonCol size="6" sizeMd="2">
                  <IonItem>
                    <IonInput
                      placeholder="Amount*"
                      type="number"
                      value={amount}
                      disabled={!transferTo}
                      onIonChange={(e) => {
                        const v = e.detail.value || "";
                        setAmount(v);
                        if (v) checkAmount(v);
                      }}
                    />
                  </IonItem>
                </IonCol>

                <IonCol size="6" sizeMd="2">
                  <IonItem>
                    <IonSelect
                      interface="popover"
                      placeholder="Trans. Mode*"
                      value={transferMode}
                      onIonChange={(e) => setTransferMode(e.detail.value)}
                    >
                      <IonSelectOption value="By Cash">By Cash</IonSelectOption>
                      <IonSelectOption value="Credit Card">
                        Credit Card
                      </IonSelectOption>
                      <IonSelectOption value="PhonePay">
                        PhonePay
                      </IonSelectOption>
                      <IonSelectOption value="Google Pay">
                        Google Pay
                      </IonSelectOption>
                      <IonSelectOption value="Paytm">Paytm</IonSelectOption>
                      <IonSelectOption value="Bank Transfer">
                        Bank Transfer
                      </IonSelectOption>
                    </IonSelect>
                  </IonItem>
                </IonCol>

                <IonCol size="12" sizeMd="2" className="actions-col">
                  <IonButton onClick={saveTransfer}>
                    <IonIcon icon={arrowForward} slot="start" />
                    Transfer
                  </IonButton>
                </IonCol>
                <IonCol size="12" sizeMd="2" className="actions-col">
                  <IonButton fill="outline" onClick={clearTransfer}>
                    <IonIcon icon={close} slot="start" />
                    Cancel
                  </IonButton>
                </IonCol>
              </IonRow>
            </IonGrid>

            {/* Filters + list */}
            {/* Filters + list */}
            <div className="center-wrap">
              <div className="form-card">
                <div className="form-header">{EmpCodeName}</div>

                <IonGrid style={{ marginBottom: 0 }}>
                  <IonRow>
                    {/* left spacer to center the 4 x md=2 columns */}
                    <IonCol size="12" sizeMd="2" />

                    {/* 1) Transaction Type */}
                    <IonCol size="12" sizeMd="2">
                      <IonItem>
                        <IonSelect
                          interface="popover"
                          placeholder="Transaction Type"
                          value={transCredDebt}
                          onIonChange={async (e) => {
                            setTransCredDebt(e.detail.value);
                            await fetchTransactions(EmpCode);
                          }}
                        >
                          <IonSelectOption value="All">All</IonSelectOption>
                          <IonSelectOption value="Credit">
                            Credit
                          </IonSelectOption>
                          <IonSelectOption value="Debit">Debit</IonSelectOption>
                        </IonSelect>
                      </IonItem>
                    </IonCol>

                    {/* 2) Transaction Head */}
                    <IonCol size="12" sizeMd="2">
                      <IonItem>
                        <IonSelect
                          interface="popover"
                          placeholder="Transaction Head"
                          value={selectedTxnType}
                          onIonChange={async (e) => {
                            setSelectedTxnType(e.detail.value);
                            await fetchTransactions(EmpCode);
                          }}
                        >
                          <IonSelectOption value="All">All</IonSelectOption>
                          <IonSelectOption value="Office Expenses">
                            Office Expenses
                          </IonSelectOption>
                          <IonSelectOption value="Advance">
                            Advance
                          </IonSelectOption>
                          <IonSelectOption value="Salary">
                            Salary
                          </IonSelectOption>
                        </IonSelect>
                      </IonItem>
                    </IonCol>

                    {/* 3) From date */}
                    <IonCol size="12" sizeMd="2">
                      <IonItem button onClick={() => setOpenStartModal(true)}>
                        <IonInput
                          readonly
                          value={
                            startDate
                              ? moment(startDate).format("DD-MM-YYYY")
                              : "From"
                          }
                        />
                      </IonItem>
                    </IonCol>

                    {/* 4) To date (with clear) */}
                    <IonCol size="12" sizeMd="2">
                      <IonItem>
                        <IonInput
                          readonly
                          value={
                            endDate
                              ? moment(endDate).format("DD-MM-YYYY")
                              : "To"
                          }
                          onClick={() => setOpenEndModal(true)}
                        />
                        <IonIcon
                          icon={close}
                          slot="end"
                          onClick={async () => {
                            setStartDate(undefined);
                            setEndDate(undefined);
                            await fetchTransactions(EmpCode);
                          }}
                        />
                      </IonItem>
                    </IonCol>

                    {/* right spacer */}
                    <IonCol size="12" sizeMd="2" />
                  </IonRow>
                </IonGrid>

                <div className="list-scroll">
                  {transactions.map((t, idx) => (
                    <div key={idx} className="txn-card">
                      <div className="txn-left">
                        <div className="txn-date">
                          {t.Date}
                          {t.SALorAdv ? ` // ${t.SALorAdv}` : ""}
                        </div>
                        <div className="txn-desc">{t.CDescription}</div>
                      </div>
                      <div className="txn-right">₹ {t.Amount}/-</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Voucher tab */}
        {activeTab === "voucher" && (
          <div className="tab-pad">
            <IonGrid className="form-grid">
              <IonRow>
                <IonCol size="12" sizeMd="3">
                  <IonItem>
                    <IonSelect
                      interface="popover"
                      placeholder="Voucher Heads*"
                      value={invoiceHeads}
                      onIonChange={(e) =>
                        handleVoucherHeadsChange(e.detail.value)
                      }
                    >
                      <IonSelectOption value="0">--Select--</IonSelectOption>
                      <IonSelectOption value="OfficeExpenses">
                        Office Expenses
                      </IonSelectOption>
                      <IonSelectOption value="Toll">Toll</IonSelectOption>
                      <IonSelectOption value="Fuel">Fuel</IonSelectOption>
                      <IonSelectOption value="TA">TA</IonSelectOption>
                      <IonSelectOption value="DA">DA</IonSelectOption>
                    </IonSelect>
                    {!!selectEmpHint && (
                      <IonLabel
                        slot="end"
                        className="mini-button"
                        onClick={() => setOpenDA_TA_Modal(true)}
                      >
                        {selectEmpHint}
                      </IonLabel>
                    )}
                  </IonItem>
                </IonCol>

                <IonCol size="12" sizeMd="3">
                  <IonItem
                    button
                    onClick={() =>
                      !isDateDisabled && setOpenInvoiceDateModal(true)
                    }
                  >
                    <IonInput
                      value={
                        invoiceDate
                          ? moment(invoiceDate).format("DD-MM-YYYY")
                          : "Voucher Date*"
                      }
                      readonly
                      disabled={isDateDisabled}
                    />
                    {!!invoiceDate && (
                      <IonIcon
                        icon={close}
                        slot="end"
                        onClick={() => setInvoiceDate(undefined)}
                      />
                    )}
                  </IonItem>
                </IonCol>

                <IonCol size="6" sizeMd="2">
                  <IonItem>
                    <IonInput
                      placeholder="Amount*"
                      type="number"
                      value={voucherAmount}
                      onIonChange={(e) => setVoucherAmount(e.detail.value!)}
                    />
                  </IonItem>
                </IonCol>

                <IonCol size="12" sizeMd="4">
                  <IonItem>
                    <IonInput
                      placeholder="Description*"
                      value={voucherDesc}
                      onIonChange={(e) => setVoucherDesc(e.detail.value!)}
                    />
                  </IonItem>
                </IonCol>
              </IonRow>

              <IonRow className="g-2">
                <IonCol size="12" sizeMd="7" className="center-actions">
                  {photoVoucher && (
                    <img src={photoVoucher} alt="Voucher" className="thumb" />
                  )}
                  {(invoiceHeads === "OfficeExpenses" ||
                    invoiceHeads === "Toll" ||
                    invoiceHeads === "Fuel" ||
                    invoiceHeads === "TA" ||
                    invoiceHeads === "DA") && (
                    <>
                      <IonButton onClick={() => takePhoto("voucher")}>
                        Upload Voucher
                      </IonButton>
                      <input
                        ref={voucherFileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => handleVoucherFilePick(e, "voucher")}
                      />
                    </>
                  )}

                  {photoBill && (
                    <img src={photoBill} alt="Bill" className="thumb" />
                  )}
                  {(invoiceHeads === "OfficeExpenses" ||
                    invoiceHeads === "Toll" ||
                    invoiceHeads === "Fuel" ||
                    invoiceHeads === "TA" ||
                    invoiceHeads === "DA") && (
                    <>
                      <IonButton onClick={() => takePhoto("bill")}>
                        Upload Bill
                      </IonButton>
                      <input
                        ref={billFileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => handleVoucherFilePick(e, "bill")}
                      />
                    </>
                  )}
                </IonCol>

                <IonCol size="12" sizeMd="5" className="center-actions">
                  <IonButton onClick={saveVoucher}>
                    <IonIcon icon={arrowForward} slot="start" />
                    Submit
                  </IonButton>
                  <IonButton fill="outline" onClick={voucherClear}>
                    <IonIcon icon={close} slot="start" />
                    Cancel
                  </IonButton>
                </IonCol>
              </IonRow>

              {/* Admin/FA voucher filter + list */}
              {(UserDesig === "Director" || UserDesig === "In-Charge F&A") && (
                <IonRow>
                  <IonCol size="12" sizeMd="12">
                    <IonItem>
                      <IonSelect
                        interface="popover"
                        placeholder="Filter Vouchers"
                        value={voucherEmpView}
                        onIonChange={async (e) => {
                          const val = e.detail.value as string;
                          setVoucherEmpView(val);
                          const code = val ? val.split("-")[0] : "ALL";
                          await fetchVouchers(code as any);
                        }}
                      >
                        {employees.map((emp) => (
                          <IonSelectOption
                            key={emp.EmpCode}
                            value={`${emp.EmpCode}-${emp.EmpName}`}
                          >
                            {emp.EmpName}
                          </IonSelectOption>
                        ))}
                      </IonSelect>
                      <IonIcon
                        icon={close}
                        slot="end"
                        onClick={async () => {
                          setVoucherEmpView(null);
                          await fetchVouchers("ALL");
                        }}
                      />
                    </IonItem>

                    <div className="list-scroll">
                      {vouchers.map((v) => (
                        <div key={v.VID} className="txn-card">
                          <div className="txn-left">
                            <div className="txn-date">{v.Date}</div>
                            <div
                              className={`emp-pill ${
                                v.isVerified === "Y"
                                  ? "ok"
                                  : v.isVerified === "U"
                                  ? "upd"
                                  : "new"
                              }`}
                            >
                              {v.EmpID}
                            </div>
                            <div className="txn-desc">{v.VDescription}</div>
                          </div>
                          <div className="txn-right">₹ {v.amount}/-</div>
                          <div className="card-actions">
                            <IonButton
                              size="small"
                              onClick={() => {
                                setCurrentVoucher(v);
                                setVerifyAmount(String(v.amount));
                                setOpenVoucherModal(true);
                              }}
                            >
                              View
                            </IonButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  </IonCol>
                </IonRow>
              )}
            </IonGrid>
          </div>
        )}

        {/* Advances tab */}
        {activeTab === "advances" &&
          (UserDesig === "Director" || UserDesig === "In-Charge F&A") && (
            <div className="tab-pad">
              <h6 className="center-title">Advances & Cash in Hands</h6>
              <IonGrid className="table-grid">
                <IonRow className="table-header">
                  <IonCol>EmpName</IonCol>
                  <IonCol>CashInHand</IonCol>
                  <IonCol>Advance_Bal</IonCol>
                  <IonCol>Advance_Total</IonCol>
                  <IonCol>Advance_Repaid</IonCol>
                  <IonCol>Credits</IonCol>
                  <IonCol>Debits</IonCol>
                  <IonCol>Vouchers</IonCol>
                </IonRow>
                {advanceRows.map((r, idx) => (
                  <IonRow key={idx} className="table-row">
                    <IonCol className="nowrap">{r.EmpName}</IonCol>
                    <IonCol>{r.CashInHand}</IonCol>
                    <IonCol>{r.Advance_Bal}</IonCol>
                    <IonCol>{r.Advance}</IonCol>
                    <IonCol>{r.Advance_Repaid}</IonCol>
                    <IonCol>{r.Credits}</IonCol>
                    <IonCol>{r.Debits}</IonCol>
                    <IonCol>{r.Vouchers}</IonCol>
                  </IonRow>
                ))}
              </IonGrid>
            </div>
          )}

        {/* Date pickers */}
        <IonModal
          isOpen={openStartModal}
          onDidDismiss={() => setOpenStartModal(false)}
        >
          <IonContent className="picker">
            <IonDatetime
              presentation="date"
              onIonChange={async (e) => {
                if (typeof e.detail.value === "string") {
                  setStartDate(e.detail.value);
                  await fetchTransactions(EmpCode);
                }
                setOpenStartModal(false);
              }}
            />
            <IonButton expand="full" onClick={() => setOpenStartModal(false)}>
              Close
            </IonButton>
          </IonContent>
        </IonModal>

        <IonModal
          isOpen={openEndModal}
          onDidDismiss={() => setOpenEndModal(false)}
        >
          <IonContent className="picker">
            <IonDatetime
              presentation="date"
              onIonChange={async (e) => {
                if (typeof e.detail.value === "string") {
                  setEndDate(e.detail.value);
                  await fetchTransactions(EmpCode);
                }
                setOpenEndModal(false);
              }}
            />
            <IonButton expand="full" onClick={() => setOpenEndModal(false)}>
              Close
            </IonButton>
          </IonContent>
        </IonModal>

        <IonModal
          isOpen={openInvoiceDateModal}
          onDidDismiss={() => setOpenInvoiceDateModal(false)}
        >
          <IonContent className="picker">
            <IonDatetime
              presentation="date"
              onIonChange={(e) => {
                if (typeof e.detail.value === "string")
                  setInvoiceDate(e.detail.value);
                setOpenInvoiceDateModal(false);
              }}
            />
            <IonButton
              expand="full"
              onClick={() => setOpenInvoiceDateModal(false)}
            >
              Close
            </IonButton>
          </IonContent>
        </IonModal>

        {/* Select payee for Advance Repayment (Directors only) */}
        <IonModal
          isOpen={openVoucherEmpModal}
          onDidDismiss={() => setOpenVoucherEmpModal(false)}
        >
          <IonContent>
            {((employeesTemp || employees) as Employee[]).map((emp) => (
              <IonItem
                key={emp.EmpCode}
                button
                onClick={() => {
                  setAdvRepayFrom(`${emp.EmpCode}-${emp.EmpName}`);
                  setOpenVoucherEmpModal(false);
                }}
              >
                <IonLabel>{emp.EmpName}</IonLabel>
                <IonCheckbox
                  slot="start"
                  checked={advRepayFrom === `${emp.EmpCode}-${emp.EmpName}`}
                  onIonChange={() => {
                    setAdvRepayFrom(`${emp.EmpCode}-${emp.EmpName}`);
                    setOpenVoucherEmpModal(false);
                  }}
                />
              </IonItem>
            ))}
            <IonButton
              expand="full"
              onClick={() => setOpenVoucherEmpModal(false)}
            >
              Close
            </IonButton>
          </IonContent>
        </IonModal>

        {/* DA/TA employee selection */}
        <IonModal
          isOpen={openDA_TA_Modal}
          onDidDismiss={() => setOpenDA_TA_Modal(false)}
        >
          <IonContent>
            {employeesVoucher.map((emp) => (
              <IonItem key={emp.EmpCode}>
                <IonLabel>{emp.EmpName}</IonLabel>
                <IonCheckbox
                  slot="start"
                  checked={!!emp.Ischeck}
                  onIonChange={(e) =>
                    onToggleEmpForVoucher(emp.EmpCode, e.detail.checked)
                  }
                />
              </IonItem>
            ))}
            <IonButton expand="full" onClick={() => setOpenDA_TA_Modal(false)}>
              Done
            </IonButton>
          </IonContent>
        </IonModal>

        {/* Voucher preview / verify */}
        <IonModal
          isOpen={openVoucherModal}
          onDidDismiss={() => setOpenVoucherModal(false)}
        >
          <IonContent>
            {currentVoucher && (
              <>
                <IonGrid>
                  <IonRow>
                    <IonCol size="12" sizeMd="6">
                      {currentVoucher.fname ? (
                        <img
                          src={`${imgBase}${currentVoucher.fname}`}
                          alt="Voucher"
                          className="preview-img"
                        />
                      ) : (
                        <div style={{ height: 300 }} />
                      )}
                    </IonCol>
                    <IonCol size="12" sizeMd="6">
                      {currentVoucher.fpath ? (
                        <img
                          src={`${imgBase}${currentVoucher.fpath}`}
                          alt="Bill"
                          className="preview-img"
                        />
                      ) : (
                        <div style={{ height: 300 }} />
                      )}
                    </IonCol>
                  </IonRow>
                  <IonRow className="g-2">
                    <IonCol size="12" sizeMd="8">
                      <IonItem>
                        <IonInput
                          type="number"
                          value={verifyAmount}
                          onIonChange={(e) =>
                            setVerifyAmount(e.detail.value || "")
                          }
                        />
                      </IonItem>
                    </IonCol>
                    <IonCol size="12" sizeMd="4">
                      {(UserDesig === "Director" ||
                        UserDesig === "In-Charge F&A") && (
                        <IonButton
                          expand="block"
                          onClick={() =>
                            verifyVoucher(
                              currentVoucher.VID,
                              verifyAmount,
                              currentVoucher.amount
                            )
                          }
                        >
                          Verify
                        </IonButton>
                      )}
                    </IonCol>
                  </IonRow>
                </IonGrid>
                <IonButton
                  expand="full"
                  fill="outline"
                  onClick={() => setOpenVoucherModal(false)}
                >
                  Close
                </IonButton>
              </>
            )}
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default Transactions;
