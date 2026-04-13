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
  IonButtons,
  IonBackButton,
  IonMenuButton,
  IonCheckbox,
} from "@ionic/react";
import { arrowForward, close, calendar, person, documentText, eyeOutline, checkmarkCircle } from "ionicons/icons";
import axios from "axios";
import moment from "moment";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import type { RefresherEventDetail } from "@ionic/core";
import { API_BASE } from "../config";
import "./Transactions.css";

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
type UserProfile = {
  EmpID: string;
  EmpName: string;
  Designation: string;
  JoiningDate: string;
  ContactNumber: string;
  Email: string;
  Department: string;
  ProfileImage: string;
};
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
const baseUrl = API_BASE.replace(/\/$/, "");

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
      EmpCode: str(o.EmpCode || o[0]),
      EmpName: str(o.EmpName || o[1]),
      Designation: str(o.Designation || o[2]),
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
    FYear: Array.isArray(r) ? str(r[1]) : str((r as any).FYear || (r as any)[1]),
  }));
  console.log("[normalize] years:", out);
  return out;
};

const normalizeMonths = (rows: any[]): Month[] => {
  const out = rows.map((r) => ({
    FMonth: Array.isArray(r) ? str(r[1]) : str((r as any).FMonth || (r as any)[1]),
  }));
  console.log("[normalize] months:", out);
  return out;
};

const normalizeCurrentCash = (data: any) => {
  // Example: [[0.0, 304.0]] -> { hand: "304", adv: "0" }
  const rows = Array.isArray(data) ? data : [];
  const a = Array.isArray(rows[0]) ? rows[0] : [];
  const adv = a[0] != null ? String(a[0]) : "0";
  const hand = a[1] != null ? String(a[1]) : "0";
  const out = { hand, adv };
  console.log("[normalize] current cash:", out);
  return out;
};

const normalizeUserProfile = (data: any): UserProfile | null => {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
  const r = data[0];
  return {
    EmpID: str(r[1]),
    EmpName: str(r[2]),
    Designation: str(r[3]),
    JoiningDate: str(r[4]),
    ContactNumber: str(r[6]),
    Email: str(r[8]),
    Department: str(r[29]),
    ProfileImage: str(r[42]),
  };
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
    // Expected: [ID, Ref, From, To, Amount, Date, Status, Remarks, PaymentMode, Category]
    const a = r as any[];
    let date = str(a[5]);
    if (date.includes("T")) {
      date = moment(date).format("DD-MM-YYYY");
    } else if (looksLikeYyyyMmDdHHmmss(str(a[1]))) {
      date = fmtFromYYYYMMDD(str(a[1]).slice(0, 8));
    }

    return {
      Date: date,
      SALorAdv: str(a[9] || a[8] || ""),
      CDescription: str(a[7]),
      Amount: Number(a[4] || 0),
      bclass: a[6] ? String(a[6]) : undefined,
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
      CashInHand: Number(a[7] ?? 0),
      Advance_Bal: Number(a[3] ?? 0),
      Advance: Number(a[1] ?? 0),
      Advance_Repaid: Number(a[2] ?? 0),
      Credits: Number(a[4] ?? 0),
      Debits: Number(a[5] ?? 0),
      Vouchers: Number(a[6] ?? 0),
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

  const imgBase = useMemo(() => {
    // If the filename from API already contains "img/", we might not need "imgpath/"
    // Trying root base first, as filenames seem to have 'img/Voucher/...'
    const base = baseUrl.replace(/\/api$/, "") + "/";
    console.log("[Transactions] Calculated imgBase:", base, "from baseUrl:", baseUrl);
    return base;
  }, [baseUrl]);

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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

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
  const [invoiceDate, setInvoiceDate] = useState<string | undefined>(moment().toISOString());
  const [voucherAmount, setVoucherAmount] = useState<string>("");
  const [voucherDesc, setVoucherDesc] = useState<string>("");
  const [selectEmpHint, setSelectEmpHint] = useState<string>("");

  const [photoVoucher, setPhotoVoucher] = useState<string | null>(null);
  const [photoBill, setPhotoBill] = useState<string | null>(null);

  const [voucherEmpView, setVoucherEmpView] = useState<string | null>(
    `${EmpCode}-${EmpName}`
  );
  const [searchDate, setSearchDate] = useState<string | undefined>(moment().toISOString());
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
        fetchMonths(moment().format("YYYY")),
        fetchTransactions(EmpCode),
        fetchUserProfile(EmpCode),
      ]);
    } catch (e) {
      console.error("Error during init:", e);
      presentToast("Error loading initial data.", false);
    } finally {
      setLoading(false);
    }
  };

  /* -------- API calls -------- */
  const fetchUserProfile = async (code: string) => {
    const url = `${baseUrl}/Profile/UserProfile?employeeCode=${code}`;
    console.log(`[Transactions] fetchUserProfile: GET ${url}`);
    const res = await axios.get(url, { headers: getAuthHeaders() });
    console.log("[Transactions] fetchUserProfile response:", res.data);
    const profile = normalizeUserProfile(res.data);
    console.log("[Transactions] normalized profile:", profile);
    setUserProfile(profile);
  };


  const fetchEmployeesActive = async () => {
    const url = `${baseUrl}/Employee/Load_Employees?SearchEmp=Active`;
    console.log(`[Transactions] fetchEmployeesActive: GET ${url}`);
    const res = await axios.get(url, { headers: getAuthHeaders() });
    console.log("[Transactions] fetchEmployeesActive response:", res.data);
    const list = normalizeEmployees(res.data || []);
    setEmployees(list);
    const filtered = list.filter((e) => e.EmpCode !== EmpCode);
    console.log("[Transactions] employees list filtered (excluding self):", filtered);
    setEmployeesTemp(filtered);
  };


  const fetchEmployeesVoucher = async () => {
    const url = `${baseUrl}/Employee/load_employees_voucher?SearchEmp=Active`;
    console.log(`[Transactions] fetchEmployeesVoucher: GET ${url}`);
    const res = await axios.get(url, { headers: getAuthHeaders() });
    console.log("[Transactions] fetchEmployeesVoucher response:", res.data);
    const normalized = normalizeEmployeesVoucher(res.data || []);
    setEmployeesVoucher(normalized);
  };


  const fetchTxnTypes = async () => {
    const url = `${baseUrl}/Transactions/Load_TransactionType`;
    console.log(`[Transactions] fetchTxnTypes: GET ${url}`);
    const res = await axios.get(url, { headers: getAuthHeaders() });
    console.log("[Transactions] fetchTxnTypes response:", res.data);
    setTxnTypes(normalizeTxnTypes(res.data || []));
  };


  const fetchYears = async () => {
    const url = `${baseUrl}/Transactions/Load_Year?EmpCode=${EmpCode}`;
    console.log(`[Transactions] fetchYears: GET ${url}`);
    const res = await axios.get(url, { headers: getAuthHeaders() });
    console.log("[Transactions] fetchYears response:", res.data);
    setYears(normalizeYears(res.data || []));
  };


  const fetchMonths = async (fYear: string) => {
    const url = `${baseUrl}/Transactions/Load_Month?EmpCode=${EmpCode}&FYear=${fYear}`;
    console.log(`[Transactions] fetchMonths: GET ${url}`);
    const res = await axios.get(url, { headers: getAuthHeaders() });
    console.log("[Transactions] fetchMonths response:", res.data);
    setMonths(normalizeMonths(res.data || []));
  };


  const fetchCurrentCash = async () => {
    const url = `${baseUrl}/Transactions/Load_Current_Cash?EmpCode=${EmpCode}`;
    console.log(`[Transactions] fetchCurrentCash: GET ${url}`);
    const res = await axios.get(url, { headers: getAuthHeaders() });
    console.log("[Transactions] fetchCurrentCash response:", res.data);
    const cash = normalizeCurrentCash(res.data || []);
    setHandCash(cash.hand);
    setAdvanceCash(cash.adv);
  };


  const fetchTransactions = async (emp: string) => {
    const start = startDate ? moment(startDate).format("YYYY-MM-DD") : "All";
    const end = endDate ? moment(endDate).format("YYYY-MM-DD") : "All";
    const url = `${baseUrl}/Transactions/Load_Transactions?EmpCode=${emp}&TransCredDebt=${transCredDebt}&TransactionType=${selectedTxnType}&TStartDt=${start}&TEndDt=${end}`;
    console.log(`[Transactions] fetchTransactions: GET ${url}`);
    const res = await axios.get(url, { headers: getAuthHeaders() });
    console.log("[Transactions] fetchTransactions raw response:", res.data);
    const list = normalizeTransactions(res.data || []);
    setTransactions(list);
  };


  const fetchVouchers = async (emp: string | "ALL") => {
    const date = searchDate ? moment(searchDate).format("DD-MM-YYYY") : "All";
    const url = `${baseUrl}/Transactions/Load_Vouchers?EmpCode=${emp}&Date=${date}`;
    console.log(`[Transactions] fetchVouchers: GET ${url}`);
    const res = await axios.get(url, { headers: getAuthHeaders() });
    console.log("[Transactions] fetchVouchers raw response:", res.data);
    setVouchers(normalizeVouchers(res.data || []));
  };


  const fetchAdvancePending = async () => {
    const url = `${baseUrl}/Transactions/Load_Advance_PendingAmt`;
    console.log(`[Transactions] fetchAdvancePending: GET ${url}`);
    const res = await axios.get(url, { headers: getAuthHeaders() });
    console.log("[Transactions] fetchAdvancePending response:", res.data);
    setAdvanceRows(normalizeAdvancePending(res.data || []));
  };


  /* -------- Pull to refresh -------- */
  const onRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    console.log("[Transactions] user triggered pull-to-refresh");
    try {
      await loadAll();
    } finally {
      e.detail.complete();
    }
  };


  /* -------- Transfer logic -------- */
  const onPaymentTypeChange = (val: string) => {
    console.log("[Transactions] onPaymentTypeChange:", val);
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
      console.log("[Transactions] filtered employees for Advance Repayment:", filtered);
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
      console.log("[Transactions] filtered employees for Advance:", filtered);
      setEmployeesTemp(filtered);
    } else {
      const filtered = employees.filter((emp) => emp.EmpCode !== EmpCode);
      console.log("[Transactions] filtered employees for General Transfer:", filtered);
      setEmployeesTemp(filtered);
    }
  };


  const checkAmount = (val: string) => {
    console.log("[Transactions] checkAmount validation:", val, { handCash, advanceCash, UserDesig, paymentType });
    if (!(UserDesig === "Director" || UserDesig === "In-Charge F&A")) {
      if (paymentType === "Advance Repayment" || paymentType === "Advance") {
        if (Number(advanceCash) < Number(val)) {
          console.warn("[Transactions] validation failed: amount > advanceCash");
          presentToast(
            `Maximum Advance Transfer/Repayment amount is ${advanceCash}/-`,
            false
          );
          setAmount("");
          return;
        }
      } else {
        if (Number(handCash) < Number(val)) {
          console.warn("[Transactions] validation failed: amount > handCash");
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

      console.log("[Transactions] saveTransfer payload:", payload);

      const res = await axios.post(`${baseUrl}/Transactions/Save_moneytransfer`, payload, {
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      });
      console.log("[Transactions] saveTransfer response:", res.data);


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
      let imgType = "";
      let base64Voucher = "";
      let base64Bill = "";

      if (photoVoucher) {
        base64Voucher = photoVoucher.split(",")[1] || "";
        imgType += "Voucherimg";
      }
      if (photoBill) {
        base64Bill = photoBill.split(",")[1] || "";
        imgType += (imgType ? "&&" : "") + "Billimg";
      }

      const payload = {
        _EmpCode: EmpCode,
        _VoucherAmount: voucherAmount,
        _VoucherDesc: voucherDesc || "",
        _Invoice_Date: moment(invoiceDate).format("DD-MM-YYYY"),
        _Invoice_Heads: invoiceHeads,
        _Img_Type: imgType || "",
        _Img: base64Voucher,
        _Img2: base64Bill,
      };

      console.log("[Transactions] saveVoucher payload:", payload);

      const res = await axios.post(`${baseUrl}/Transactions/Save_Voucher`, payload, {
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      });
      console.log("[Transactions] saveVoucher response:", res.data);


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
      console.log("[Transactions] verifyVoucher payload:", payload);
      const res = await axios.post(`${baseUrl}/Transactions/Verify_Voucher`, payload, {
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      });
      console.log("[Transactions] verifyVoucher response:", res.data);


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


      <IonContent className="transactions-container">
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

        {/* --- Header / User Info --- */}
        <div className="page-header-wrap">
          <div className="header-top">
            <IonButtons slot="start">
              <IonBackButton defaultHref="/home" className="custom-back-btn" />
            </IonButtons>
            <div className="header-text">
              <div className="dept-label">
                {userProfile?.Department || "Account Overview"}
              </div>
              <div className="page-title">Transactions</div>
            </div>
          </div>
        </div>

        {/* --- Premium Balance Cards --- */}
        <div className="balance-grid">
          <div className="premium-card card--hand">
            <div className="card-label">
              <IonIcon icon={arrowForward} style={{ transform: 'rotate(90deg)', fontSize: '14px' }} />
              In Hand
            </div>
            <div className="card-value">₹ {handCash}/-</div>
          </div>

          <div className="premium-card card--advance">
            <div className="card-label">
              <IonIcon icon={arrowForward} style={{ fontSize: '14px' }} />
              Advance
            </div>
            <div className="card-value">₹ {advanceCash}/-</div>
          </div>
        </div>

        {/* --- Custom Native-Like Tabs --- */}
        <div className="custom-tabs">
          <div
            className={`tab-item ${activeTab === "transfer" ? "active" : ""}`}
            onClick={() => setActiveTab("transfer")}
          >
            Transfer
          </div>

          <div
            className={`tab-item ${activeTab === "voucher" ? "active" : ""}`}
            onClick={() => setActiveTab("voucher")}
          >
            Voucher
          </div>

          {(UserDesig === "Director" || UserDesig === "In-Charge F&A") && (
            <div
              className={`tab-item ${activeTab === "advances" ? "active" : ""}`}
              onClick={() => setActiveTab("advances")}
            >
              Advances
            </div>
          )}
        </div>

        {/* Transfer tab */}
        {activeTab === "transfer" && (
          <div className="tab-pad">
            <div className="section-card">
              <div className="section-title">
                <IonIcon icon={arrowForward} /> New Transfer
              </div>
              <div className="form-grid">
                <div className="input-group">
                  <div className="input-label">Payment Type</div>
                  <IonSelect
                    interface="popover"
                    className="modern-select"
                    placeholder="Select Type"
                    value={paymentType}
                    onIonChange={(e) => onPaymentTypeChange(e.detail.value)}
                  >
                    <IonSelectOption value="Office Expenses">Office Expenses</IonSelectOption>
                    {(UserDesig === "Director" || UserDesig === "In-Charge F&A") && (
                      <IonSelectOption value="Advance">Advance</IonSelectOption>
                    )}
                    <IonSelectOption value="Advance Repayment">Advance Repayment</IonSelectOption>
                    {(UserDesig === "Director" || UserDesig === "In-Charge F&A") && (
                      <IonSelectOption value="Salary">Salary</IonSelectOption>
                    )}
                  </IonSelect>
                  {!!advRepayFrom && (
                    <div
                      className="mini-button"
                      style={{ marginTop: '4px', fontSize: '12px', color: 'var(--ion-color-primary)', fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => setOpenVoucherEmpModal(true)}
                    >
                      From: {advRepayFrom}
                    </div>
                  )}
                </div>

                <div className="input-group">
                  <div className="input-label">Transfer To</div>
                  <IonSelect
                    interface="popover"
                    className="modern-select"
                    placeholder="Select Recipient"
                    value={transferTo}
                    onIonChange={(e) => setTransferTo(e.detail.value)}
                  >
                    {(employeesTemp || employees).map((emp) => (
                      <IonSelectOption key={emp.EmpCode} value={`${emp.EmpCode}-${emp.EmpName}`}>
                        {emp.EmpName}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </div>

                <div className="input-group">
                  <div className="input-label">Amount (₹)</div>
                  <IonInput
                    className="modern-input"
                    placeholder="0.00"
                    type="number"
                    value={amount}
                    disabled={!transferTo}
                    onIonChange={(e) => {
                      const v = e.detail.value || "";
                      setAmount(v);
                      if (v) checkAmount(v);
                    }}
                  />
                </div>

                <div className="input-group">
                  <div className="input-label">Transfer Mode</div>
                  <IonSelect
                    interface="popover"
                    className="modern-select"
                    placeholder="Select Mode"
                    value={transferMode}
                    onIonChange={(e) => setTransferMode(e.detail.value)}
                  >
                    <IonSelectOption value="By Cash">By Cash</IonSelectOption>
                    <IonSelectOption value="Credit Card">Credit Card</IonSelectOption>
                    <IonSelectOption value="PhonePay">PhonePay</IonSelectOption>
                    <IonSelectOption value="Google Pay">Google Pay</IonSelectOption>
                    <IonSelectOption value="Paytm">Paytm</IonSelectOption>
                    <IonSelectOption value="Bank Transfer">Bank Transfer</IonSelectOption>
                  </IonSelect>
                </div>
              </div>

              <div className="button-row">
                <IonButton className="btn-primary" expand="block" onClick={saveTransfer}>
                  <IonIcon icon={arrowForward} slot="start" />
                  Transfer
                </IonButton>
                <IonButton className="btn-outline" fill="outline" expand="block" onClick={clearTransfer}>
                  <IonIcon icon={close} slot="start" />
                  Cancel
                </IonButton>
              </div>
            </div>

            {/* Filters + list */}
            <div className="section-card">
              <div className="section-title">
                {userProfile ? `${userProfile.EmpID} - ${userProfile.EmpName}` : EmpCodeName}
              </div>

              <div className="form-grid" style={{ marginBottom: '24px' }}>
                <div className="input-group">
                  <div className="input-label">Type</div>
                  <IonSelect
                    interface="popover"
                    className="modern-select"
                    value={transCredDebt}
                    onIonChange={async (e) => {
                      setTransCredDebt(e.detail.value);
                      await fetchTransactions(EmpCode);
                    }}
                  >
                    <IonSelectOption value="All">All Transactions</IonSelectOption>
                    <IonSelectOption value="Credit">Credits Only</IonSelectOption>
                    <IonSelectOption value="Debit">Debits Only</IonSelectOption>
                    <IonSelectOption value="Transfer">Transfers Only</IonSelectOption>
                  </IonSelect>
                </div>

                <div className="input-group">
                  <div className="input-label">Head</div>
                  <IonSelect
                    interface="popover"
                    className="modern-select"
                    value={selectedTxnType}
                    onIonChange={async (e) => {
                      setSelectedTxnType(e.detail.value);
                      await fetchTransactions(EmpCode);
                    }}
                  >
                    {txnTypes.map((t) => (
                      <IonSelectOption key={t.TID} value={t.TTYPE}>
                        {t.TTYPE}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </div>

                <div className="input-group">
                  <div className="input-label" >From Date</div>
                  <div
                    className="modern-input"
                    style={{ display: 'flex', alignItems: 'center', height: '44px', cursor: 'pointer', paddingLeft: '10px' }}
                    onClick={() => setOpenStartModal(true)}
                  >
                    {startDate ? moment(startDate).format("DD-MM-YYYY") : "Select Start"}
                  </div>
                </div>

                <div className="input-group">
                  <div className="input-label">To Date</div>
                  <div
                    className="modern-input"
                    style={{ display: 'flex', alignItems: 'center', height: '44px', cursor: 'pointer', justifyContent: 'space-between', paddingLeft: '10px' }}
                    onClick={() => setOpenEndModal(true)}
                  >
                    <span>{endDate ? moment(endDate).format("DD-MM-YYYY") : "Select End"}</span>
                    {endDate && (
                      <IonIcon
                        icon={close}
                        style={{ fontSize: '20px', color: '#94a3b8' }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          setStartDate(undefined);
                          setEndDate(undefined);
                          await fetchTransactions(EmpCode);
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="list-container">
                {transactions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No transactions found for the selected period.
                  </div>
                ) : (
                  transactions.map((t, idx) => {
                    const isCredit = t.bclass === "Credit";
                    return (
                      <div key={idx} className="txn-card">
                        <div className={`txn-icon ${isCredit ? 'icon--credit' : 'icon--debit'}`}>
                          <IonIcon icon={arrowForward} style={{ transform: isCredit ? 'rotate(45deg)' : 'rotate(225deg)' }} />
                        </div>
                        <div className="txn-info">
                          <div className="txn-header">
                            <div className="txn-title">{t.CDescription}</div>
                            <div className="txn-amount">
                              <div className="amt-value" style={{ color: isCredit ? '#10b981' : '#ef4444' }}>
                                {isCredit ? '+' : '-'} ₹{t.Amount}
                              </div>
                            </div>
                          </div>
                          <div className="txn-footer">
                            <div className="txn-meta">
                              <span>{t.Date}</span>
                              {t.SALorAdv && <span>• {t.SALorAdv}</span>}
                            </div>
                            <div className="amt-status">{isCredit ? 'Received' : 'Paid'}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Voucher tab */}
        {activeTab === "voucher" && (
          <div className="tab-pad">
            <div className="section-card">
              <div className="section-title">
                <IonIcon icon={arrowForward} /> New Voucher Request
              </div>
              <div className="form-grid">
                <div className="input-group">
                  <div className="input-label">Voucher Head</div>
                  <IonSelect
                    interface="popover"
                    className="modern-select"
                    placeholder="Select Head"
                    value={invoiceHeads}
                    onIonChange={(e) => handleVoucherHeadsChange(e.detail.value)}
                  >
                    <IonSelectOption value="0">--Select--</IonSelectOption>
                    <IonSelectOption value="OfficeExpenses">Office Expenses</IonSelectOption>
                    <IonSelectOption value="Toll">Toll</IonSelectOption>
                    <IonSelectOption value="Fuel">Fuel</IonSelectOption>
                    <IonSelectOption value="TA">TA</IonSelectOption>
                    <IonSelectOption value="DA">DA</IonSelectOption>
                  </IonSelect>
                  {!!selectEmpHint && (
                    <div
                      className="mini-button"
                      style={{ marginTop: '4px', fontSize: '12px', color: 'var(--ion-color-primary)', fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => setOpenDA_TA_Modal(true)}
                    >
                      {selectEmpHint}
                    </div>
                  )}
                </div>

                <div className="input-group">
                  <div className="input-label">Voucher Date</div>
                  <div
                    className="modern-input"
                    style={{ display: 'flex', alignItems: 'center', height: '44px', cursor: 'pointer', opacity: isDateDisabled ? 0.6 : 1, paddingLeft: '10px' }}
                    onClick={() => !isDateDisabled && setOpenInvoiceDateModal(true)}
                  >
                    {invoiceDate ? moment(invoiceDate).format("DD-MM-YYYY") : "Select Date"}
                  </div>
                </div>

                <div className="input-group">
                  <div className="input-label">Amount (₹)</div>
                  <IonInput
                    className="modern-input"
                    placeholder="0.00"
                    type="number"
                    value={voucherAmount}
                    onIonChange={(e) => setVoucherAmount(e.detail.value!)}
                  />
                </div>

                <div className="input-group">
                  <div className="input-label">Description</div>
                  <IonInput
                    className="modern-input"
                    placeholder="Brief description..."
                    value={voucherDesc}
                    onIonChange={(e) => setVoucherDesc(e.detail.value!)}
                  />
                </div>
              </div>

              <div className="image-pickers" style={{ marginTop: '20px' }}>
                <div className="picker-card" onClick={() => takePhoto("voucher")}>
                  {photoVoucher ? (
                    <img src={photoVoucher} alt="Voucher" className="picker-preview" />
                  ) : (
                    <div className="picker-placeholder">
                      <IonIcon icon={arrowForward} style={{ transform: 'rotate(-90deg)' }} />
                      <div className="picker-text">Voucher Photo</div>
                    </div>
                  )}
                  <input
                    ref={voucherFileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => handleVoucherFilePick(e, "voucher")}
                  />
                </div>

                <div className="picker-card" onClick={() => takePhoto("bill")}>
                  {photoBill ? (
                    <img src={photoBill} alt="Bill" className="picker-preview" />
                  ) : (
                    <div className="picker-placeholder">
                      <IonIcon icon={arrowForward} style={{ transform: 'rotate(-90deg)' }} />
                      <div className="picker-text">Bill Photo</div>
                    </div>
                  )}
                  <input
                    ref={billFileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => handleVoucherFilePick(e, "bill")}
                  />
                </div>
              </div>

              <div className="button-row">
                <IonButton className="btn-primary" expand="block" onClick={saveVoucher}>
                  <IonIcon icon={arrowForward} slot="start" />
                  Submit
                </IonButton>
                <IonButton className="btn-outline" fill="outline" expand="block" onClick={voucherClear}>
                  <IonIcon icon={close} slot="start" />
                  Cancel
                </IonButton>
              </div>
            </div>

            {/* Voucher filter (Admin only) */}
            {(UserDesig === "Director" || UserDesig === "In-Charge F&A") && (
              <div className="section-card" style={{ padding: '12px 20px' }}>
                <div className="input-group">
                  <div className="input-label">Filter by Employee</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <IonSelect
                      interface="popover"
                      className="modern-select"
                      style={{ flex: 1 }}
                      placeholder="Show All"
                      value={voucherEmpView}
                      onIonChange={async (e) => {
                        const val = e.detail.value as string;
                        setVoucherEmpView(val);
                        const code = val ? val.split("-")[0] : "ALL";
                        await fetchVouchers(code as any);
                      }}
                    >
                      {employees.map((emp) => (
                        <IonSelectOption key={emp.EmpCode} value={`${emp.EmpCode}-${emp.EmpName}`}>
                          {emp.EmpName}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                    {voucherEmpView && (
                      <IonIcon
                        icon={close}
                        style={{ fontSize: '24px', color: '#94a3b8' }}
                        onClick={async () => {
                          setVoucherEmpView(null);
                          await fetchVouchers("ALL");
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="list-container">
              {vouchers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  No vouchers found.
                </div>
              ) : (
                vouchers.map((v) => (
                  <div key={v.VID} className="txn-card" onClick={() => {
                    console.log("[Transactions] Selected voucher for preview:", v);
                    setCurrentVoucher(v);
                    setVerifyAmount(String(v.amount));
                    setOpenVoucherModal(true);
                  }}>
                    <div className="txn-icon" style={{ background: '#f1f5f9', color: 'var(--ion-color-primary)' }}>
                      <IonIcon icon={arrowForward} style={{ transform: 'rotate(-45deg)' }} />
                    </div>
                    <div className="txn-info">
                      <div className="txn-header">
                        <div className="txn-title" style={{ color: 'red' }}>{v.EmpID}</div>
                        <div className="txn-amount">
                          <div className="amt-value" style={{ color: 'red' }}>₹{v.amount}</div>
                        </div>
                      </div>
                      <div className="txn-footer">
                        <div className="txn-meta">
                          <span>{v.Date}</span>
                          <span>• {v.VDescription || "No Description"}</span>
                        </div>
                        <div className={`amt-status status--${v.isVerified}`}>
                          {v.isVerified === "Y" ? 'Verified' : v.isVerified === "U" ? 'Updated' : 'Pending'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Advances tab */}
        {activeTab === "advances" &&
          (UserDesig === "Director" || UserDesig === "In-Charge F&A") && (
            <div className="tab-pad">
              <div className="section-card">
                <div className="section-title">
                  <IonIcon icon={arrowForward} /> Advances & Cash in Hands
                </div>
                <div className="advances-table-wrapper">
                  <table className="advances-table">
                    <thead>
                      <tr>
                        <th><div className="th-resizer">Employee</div></th>
                        <th><div className="th-resizer">In Hand</div></th>
                        <th><div className="th-resizer">Balance</div></th>
                        <th><div className="th-resizer">Total Adv</div></th>
                        <th><div className="th-resizer">Repaid</div></th>
                        <th><div className="th-resizer">Credits</div></th>
                        <th><div className="th-resizer">Debits</div></th>
                        <th><div className="th-resizer">Vouchers</div></th>
                      </tr>
                    </thead>
                    <tbody>
                      {advanceRows.map((r, idx) => (
                        <tr key={idx}>
                          <td className="emp-col">{r.EmpName}</td>
                          <td className="amt-cell">₹{r.CashInHand}</td>
                          <td className="amt-cell">₹{r.Advance_Bal}</td>
                          <td className="amt-cell">₹{r.Advance}</td>
                          <td className="amt-cell">₹{r.Advance_Repaid}</td>
                          <td className="amt-cell">₹{r.Credits}</td>
                          <td className="amt-cell">₹{r.Debits}</td>
                          <td className="amt-cell">₹{r.Vouchers}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        {/* Date pickers */}
        <IonModal
          isOpen={openStartModal}
          onDidDismiss={() => setOpenStartModal(false)}
          className="pwt-date-modal"
        >
          <div className="pwt-modal-content">
            <h3 className="pwt-modal-title">Select Start Date</h3>
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
            <IonButton expand="block" mode="ios" onClick={() => setOpenStartModal(false)}>
              Close
            </IonButton>
          </div>
        </IonModal>

        <IonModal
          isOpen={openEndModal}
          onDidDismiss={() => setOpenEndModal(false)}
          className="pwt-date-modal"
        >
          <div className="pwt-modal-content">
            <h3 className="pwt-modal-title">Select End Date</h3>
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
            <IonButton className="btn-primary" expand="block" onClick={() => setOpenEndModal(false)}>
              Close
            </IonButton>
          </div>
        </IonModal>

        <IonModal
          isOpen={openInvoiceDateModal}
          onDidDismiss={() => setOpenInvoiceDateModal(false)}
          className="pwt-date-modal"
        >
          <div className="pwt-modal-content">
            <h3 className="pwt-modal-title">Select Voucher Date</h3>
            <IonDatetime
              presentation="date"
              onIonChange={(e) => {
                if (typeof e.detail.value === "string")
                  setInvoiceDate(e.detail.value);
                setOpenInvoiceDateModal(false);
              }}
            />
            <IonButton
              className="btn-primary"
              expand="block"
              onClick={() => setOpenInvoiceDateModal(false)}
            >
              Close
            </IonButton>
          </div>
        </IonModal>

        {/* Select payee for Advance Repayment (Directors only) */}
        <IonModal
          isOpen={openVoucherEmpModal}
          onDidDismiss={() => setOpenVoucherEmpModal(false)}
          className="pwt-date-modal"
        >
          <div className="pwt-modal-content" style={{ padding: '16px' }}>
            <h3 className="pwt-modal-title">Select Payee</h3>
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
              {((employeesTemp || employees) as Employee[]).map((emp) => (
                <IonItem
                  key={emp.EmpCode}
                  button
                  lines="none"
                  style={{ '--padding-start': '0' }}
                  onClick={() => {
                    setAdvRepayFrom(`${emp.EmpCode}-${emp.EmpName}`);
                    setOpenVoucherEmpModal(false);
                  }}
                >
                  <IonCheckbox
                    slot="start"
                    checked={advRepayFrom === `${emp.EmpCode}-${emp.EmpName}`}
                    onIonChange={() => {
                      setAdvRepayFrom(`${emp.EmpCode}-${emp.EmpName}`);
                      setOpenVoucherEmpModal(false);
                    }}
                  />
                  <IonLabel>{emp.EmpName}</IonLabel>
                </IonItem>
              ))}
            </div>
            <IonButton
              className="btn-primary"
              expand="block"
              onClick={() => setOpenVoucherEmpModal(false)}
            >
              Close
            </IonButton>
          </div>
        </IonModal>

        {/* DA/TA employee selection */}
        <IonModal
          isOpen={openDA_TA_Modal}
          onDidDismiss={() => setOpenDA_TA_Modal(false)}
          className="pwt-date-modal"
        >
          <div className="pwt-modal-content" style={{ padding: '16px' }}>
            <h3 className="pwt-modal-title">Select Employees</h3>
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
              {employeesVoucher.map((emp) => (
                <IonItem key={emp.EmpCode} lines="none" style={{ '--padding-start': '0' }}>
                  <IonCheckbox
                    slot="start"
                    checked={!!emp.Ischeck}
                    onIonChange={(e) =>
                      onToggleEmpForVoucher(emp.EmpCode, e.detail.checked)
                    }
                  />
                  <IonLabel>{emp.EmpName}</IonLabel>
                </IonItem>
              ))}
            </div>
            <IonButton className="btn-primary" expand="block" onClick={() => setOpenDA_TA_Modal(false)}>
              Done
            </IonButton>
          </div>
        </IonModal>

        {/* Voucher preview / verify */}
        <IonModal
          isOpen={openVoucherModal}
          onDidDismiss={() => setOpenVoucherModal(false)}
          className="standard-modal"
        >
          <IonContent className="ion-padding" scrollY={true}>
            <div className="voucher-preview-container">
              {/* Header Section */}
              <div className="preview-header">
                <div className="preview-title-wrap">
                  <span className={`preview-status-pill status-badge--${currentVoucher?.isVerified}`}>
                    {currentVoucher?.isVerified === "Y" ? 'Verified' : currentVoucher?.isVerified === "U" ? 'Updated' : 'Pending'}
                  </span>
                  <h2 className="preview-main-desc">
                    {currentVoucher?.VDescription || "Standard Voucher Request"}
                  </h2>
                </div>
                <IonButton fill="clear" onClick={() => setOpenVoucherModal(false)} color="dark">
                  <IonIcon icon={close} />
                </IonButton>
              </div>

              {currentVoucher && (
                <>
                  {/* Insight Cards */}
                  <div className="preview-insight-grid">
                    <div className="insight-card">
                      <div className="insight-icon">₹</div>
                      <div className="insight-data">
                        <span className="insight-label">Requested Amt</span>
                        <span className="insight-value amount">₹{currentVoucher.amount}</span>
                      </div>
                    </div>
                    <div className="insight-card">
                      <div className="insight-icon"><IonIcon icon={calendar} /></div>
                      <div className="insight-data">
                        <span className="insight-label">Voucher Date</span>
                        <span className="insight-value">{currentVoucher.Date}</span>
                      </div>
                    </div>
                    <div className="insight-card" style={{ gridColumn: 'span 2' }}>
                      <div className="insight-icon"><IonIcon icon={person} /></div>
                      <div className="insight-data">
                        <span className="insight-label">Requested By</span>
                        <span className="insight-value" style={{ color: 'red' }}>{currentVoucher.EmpID}</span>
                      </div>
                    </div>
                  </div>

                  {/* Image Gallery */}
                  <div className="preview-gallery">
                    <div className="gallery-item">
                      <span className="gallery-label">Voucher Photo</span>
                      <div className="image-frame" onClick={() => currentVoucher.fname && window.open(`${imgBase}${currentVoucher.fname}`, '_blank')}>
                        {currentVoucher.fname ? (
                          <img
                            src={`${imgBase}${currentVoucher.fname}`}
                            alt="Voucher"
                            className="preview-image"
                            onError={(e) => (e.currentTarget.src = "/assets/icon/favicon.png")}
                          />
                        ) : (
                          <div className="empty-preview">
                            <IonIcon icon={documentText} style={{ fontSize: '32px' }} />
                            <span>No Image Found</span>
                          </div>
                        )}
                        {currentVoucher.fname && <div className="image-action-overlay"><IonIcon icon={eyeOutline} /></div>}
                      </div>
                    </div>

                    <div className="gallery-item">
                      <span className="gallery-label">Bill / Invoice</span>
                      <div className="image-frame" onClick={() => currentVoucher.fpath && window.open(`${imgBase}${currentVoucher.fpath}`, '_blank')}>
                        {currentVoucher.fpath ? (
                          <img
                            src={`${imgBase}${currentVoucher.fpath}`}
                            alt="Bill"
                            className="preview-image"
                            onError={(e) => (e.currentTarget.src = "/assets/icon/favicon.png")}
                          />
                        ) : (
                          <div className="empty-preview">
                            <IonIcon icon={documentText} style={{ fontSize: '32px' }} />
                            <span>No Image Found</span>
                          </div>
                        )}
                        {currentVoucher.fpath && <div className="image-action-overlay"><IonIcon icon={eyeOutline} /></div>}
                      </div>
                    </div>
                  </div>

                  {/* Verification Panel (Admin Only) */}
                  {(UserDesig === "Director" || UserDesig === "In-Charge F&A") && (
                    <div className="verification-panel">
                      <div className="verify-input-wrap">
                        <div className="verify-label">Amount to Verify (₹)</div>
                        <IonInput
                          className="modern-input verify-input-modern"
                          type="number"
                          placeholder="190.00"
                          value={verifyAmount}
                          onIonChange={(e) => setVerifyAmount(e.detail.value || "")}
                        />
                      </div>
                      <IonButton
                        className="btn-primary verification-btn"
                        onClick={() => verifyVoucher(currentVoucher.VID, verifyAmount, currentVoucher.amount)}
                        style={{ height: '50px', margin: '0' }}
                      >
                        <IonIcon icon={checkmarkCircle} slot="start" />
                        Verify Voucher
                      </IonButton>
                    </div>
                  )}

                  <div style={{ marginTop: '24px' }}>
                    <IonButton
                      fill="clear"
                      expand="block"
                      onClick={() => setOpenVoucherModal(false)}
                      style={{ '--color': '#64748b', fontWeight: 600 }}
                    >
                      Dismiss Preview
                    </IonButton>
                  </div>
                </>
              )}
            </div>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default Transactions;
