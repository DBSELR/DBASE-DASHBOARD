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
  IonPopover,
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
import { createPortal } from "react-dom";
import { useHistory } from "react-router-dom";
import { ChevronLeft, Wallet } from "lucide-react";
import { arrowForward, close, calendar, person, documentText, eyeOutline, checkmarkCircle, search, chevronDown } from "ionicons/icons";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import axios from "axios";
import moment from "moment";
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
  Remarks?: string;
};
type Voucher = {
  VID: string;
  Date: string; // dd-MM-YYYY
  EmpID: string; // "1509 - Name"
  VDescription: string;
  amount: number;
  isVerified: "Y" | "N" | "U";
  Remarks?: string;
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
  const isLikelyPaymentMode = (s: string) => {
    if (!s) return false;
    const t = s.trim().toLowerCase();
    if (!t) return false;
    const known = [
      "by cash",
      "credit card",
      "phonepay",
      "google pay",
      "paytm",
      "bank transfer",
      "by cheque",
      "cheque",
    ];
    if (known.includes(t)) return true;
    if (/^by\s+/i.test(s)) return true;
    if (/\b(cash|card|bank|upi|pay|cheque)\b/i.test(s) && t.split(/\s+/).length <= 3) return true;
    return false;
  };

  const looksLikeEmpCode = (s: string) => {
    if (!s) return false;
    const t = s.trim();
    // Purely numeric short tokens likely employee codes (e.g. "1509")
    if (/^\d{3,6}$/.test(t)) return true;
    // Patterns like "1509 - NAME" also indicate codes
    if (/^\d{3,6}\s*-/.test(t)) return true;
    return false;
  };

  const looksLikeNumericId = (s: string) => {
    if (!s) return false;
    const t = s.trim();
    // Long numeric-only tokens (7+ digits) are likely IDs/timestamps, not remarks
    if (/^\d{7,}$/.test(t)) return true;
    return false;
  };

  const isLikelyRemark = (s: string, cdesc: string, saloradv?: string) => {
    if (!s) return false;
    const t = s.trim();
    if (!t) return false;
    if (t === cdesc) return false;
    if (saloradv && t.toLowerCase() === saloradv.toLowerCase()) return false;
    if (looksLikeEmpCode(t)) return false;
    if (looksLikeNumericId(t)) return false;
    if (isLikelyPaymentMode(t)) return false;
    // length heuristic
    if (t.length < 3) return false;
    // keyword heuristic for transfers/remarks
    if (/\b(transferr|transferred|amount|through|to|payment|mode|phonepay|paytm|bank|transfer|sent|received)\b/i.test(t)) return true;
    // otherwise accept if contains letters and not just punctuation/numbers
    if (/[a-zA-Z]/.test(t)) return true;
    return false;
  };

  const safeRemark = (v: any): string => {
    if (v === null || v === undefined) return "";
    if (typeof v === "object") return "";
    const s = String(v).trim();
    return s === "[object Object]" ? "" : s;
  };

  const fmtDate = (d: any): string => {
    const s = str(d);
    if (!s) return "";
    if (s.includes("T")) return moment(s).format("DD-MM-YYYY");
    return s;
  };

  const out = rows.map((r) => {
    if (!Array.isArray(r)) {
      const o = r as any;
      const rawRemark = o.Remarks ?? o.Remark ?? o.remarks ?? o.remark ?? o.RemarksText ?? o.RemarkText ?? "";
      // Derive credit/debit from field or fall back to description heuristic
      const bclass: string | undefined = o.bclass ? String(o.bclass) : o.TType ? String(o.TType) : undefined;
      return {
        Date: fmtDate(o.Date),
        SALorAdv: str(o.SALorAdv),
        CDescription: str(o.CDescription),
        Amount: Number(o.Amount ?? 0),
        bclass,
        Remarks: safeRemark(rawRemark),
      } as Transaction;
    }

    // Expected: [ID, Ref, From, To, Amount, Date, Status, Remarks, PaymentMode, Category]
    const a = r as any[];
    let date = str(a[5]);
    if (date.includes("T")) {
      date = moment(date).format("DD-MM-YYYY");
    } else if (looksLikeYyyyMmDdHHmmss(str(a[1]))) {
      date = fmtFromYYYYMMDD(str(a[1]).slice(0, 8));
    }

    let cdesc = str(a[7] || a[3] || a[2] || "");
    const saloradv = str(a[9] || a[8] || "");
    const amount = Number(a[4] || 0);
    const bclass = a[6] ? String(a[6]) : undefined;

    const candidates = [
      str(a[7]),
      str(a[8]),
      str(a[3]),
      str(a[2]),
      str(a[1]),
      str(a[9]),
      str(a[10]),
    ].filter(Boolean);

    // Prefer candidate that looks like a remark (keyword match)
    let remarks: string | undefined;
    for (const c of candidates) {
      if (isLikelyRemark(c, cdesc, saloradv)) {
        remarks = c;
        break;
      }
    }

    // Fallback: longest non-numeric/non-payment candidate
    if (!remarks) {
      let best = "";
      for (const c of candidates) {
        if (c === cdesc) continue;
        if (saloradv && c.toLowerCase() === saloradv.toLowerCase()) continue;
        if (isLikelyPaymentMode(c)) continue;
        if (looksLikeEmpCode(c)) continue;
        if (looksLikeNumericId(c)) continue;
        // skip pure-numeric candidates
        if (/^\d+$/.test(c)) continue;
        if (c.length > best.length) best = c;
      }
      if (best) remarks = best;
    }

    // If the server-provided description is generic (e.g. "Money Transfer")
    // and the detected remarks look like a fuller description (contains
    // words like 'transferred' or includes the head), promote it to CDescription
    if ((cdesc.trim() === "" || /money transfer/i.test(cdesc)) && remarks) {
      const r = remarks.trim();
      const rLower = r.toLowerCase();
      const looksLikeFullDesc =
        r.length > 15 &&
        (/(transferred|amount transferred|transferred to|through|amount)/i.test(rLower) ||
          (saloradv && rLower.includes(saloradv.toLowerCase())));
      if (looksLikeFullDesc) {
        cdesc = r;
        remarks = undefined;
      }
    }

    return {
      Date: date,
      SALorAdv: saloradv,
      CDescription: cdesc,
      Amount: amount,
      bclass: bclass,
      Remarks: remarks || undefined,
    } as Transaction;
  });
  console.log("[normalize] transactions:", out);
  return out;
};

const normalizeVouchers = (rows: any[]): Voucher[] => {
  const out = rows.map((r) => {
    if (!Array.isArray(r)) {
      const o = r as any;
      let date = str(o.Date || o.Invoice_Date || o.InvoiceDate || o.date);
      let emp = str(o.EmpID || o.EmpCode || o.EmpName || o.empId || o.empCode);
      if (/^\d{2}-\d{2}-\d{4}$/.test(emp) && /-/.test(date)) {
        const tmp = date;
        date = emp;
        emp = tmp;
      }
      return {
        VID: str(o.VID || o.vid || o.Id || o.ID),
        Date: date,
        EmpID: emp,
        VDescription: str(o.VDescription || o.Description || o.Invoice_Heads || o.vdescription || o.VoucherDesc),
        amount: Number(o.amount ?? o.Amount ?? o.VoucherAmount ?? 0),
        isVerified: (o.isVerified ?? o.IsVerified ?? o.isverified ?? o.Status ?? "N") as Voucher["isVerified"],
        Remarks: str(o.Remarks ?? o.remarks ?? o.Remark ?? o.remark ?? ""),
        fname: str(o.fname || o.Fname || o.FNAME || o.fileName || o.FileName || o.Img || o.img || o.image || o.VoucherImg || o.voucherImg || o.voucher_img),
        fpath: str(o.fpath || o.Fpath || o.FPATH || o.filePath || o.FilePath || o.Img2 || o.img2 || o.image2 || o.BillImg || o.billImg || o.bill_img),
      };
    }
    // [VID, EmpID("1509 - Name"), Date("dd-MM-YYYY"), VDescription, amount, fname, fpath, isVerified, Remarks]
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
      Remarks: str(a[8] || ""),
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
  const history = useHistory();
  /* -------- init from localStorage -------- */
  const storedUserRaw = localStorage.getItem("user");
  const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
  console.log("[init] stored user:", storedUser);

  const EmpCode = storedUser?.empCode || "1509";
  const EmpName = storedUser?.empName || "Unknown";
  const UserDesig = storedUser?.designation || "Employee";
  // Generate fiscal years 2014-2015 … (currentYear+1)-(currentYear+2), auto-extending
  const fiscalYears = useMemo(() => {
    const cur = new Date().getFullYear();
    const years: string[] = [];
    for (let y = 2014; y <= cur + 1; y++) years.push(`${y}-${y + 1}`);
    return years;
  }, []);

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

  const [txnViewEmpCode, setTxnViewEmpCode] = useState<string>(EmpCode);
  const [loading, setLoading] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const filterSearchRef = useRef(false);
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

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");

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
  const [openVoucherEmpModal, setOpenVoucherEmpModal] = useState(false);
  const [openDA_TA_Modal, setOpenDA_TA_Modal] = useState(false);

  // Voucher view/verify
  const [openVoucherModal, setOpenVoucherModal] = useState(false);
  const [currentVoucher, setCurrentVoucher] = useState<Voucher | null>(null);
  const [verifyAmount, setVerifyAmount] = useState<string>("");
  const [imgLoadErrors, setImgLoadErrors] = useState<{ [key: string]: boolean }>({});

  const resolveVoucherUrl = (rawPath: string | null | undefined): string => {
    if (!rawPath) return "";
    let clean = String(rawPath).trim().replace(/\\/g, "/");
    if (
      !clean ||
      clean === "/" ||
      clean === "//" ||
      clean === "0" ||
      clean.toLowerCase() === "null" ||
      clean.toLowerCase() === "undefined" ||
      clean.toLowerCase() === "n/a" ||
      clean.toLowerCase() === "none"
    ) {
      return "";
    }
    if (/^https?:\/\//i.test(clean) || clean.startsWith("data:")) {
      return clean;
    }
    const relative = clean.replace(/^\/+/, "");
    if (!relative) return "";

    const prodBase = "https://api.dbasesolutions.in/";
    const base = import.meta.env.DEV ? prodBase : (baseUrl.replace(/\/api\/?$/, "") + "/");

    if (relative.toLowerCase().startsWith("img/")) {
      return `${base}${relative}`;
    }
    if (relative.toLowerCase().startsWith("voucher/")) {
      return `${base}img/${relative}`;
    }
    if (relative.toLowerCase().startsWith("vouchers/")) {
      return `${base}img/${relative}`;
    }
    return `${base}img/Voucher/${relative}`;
  };

  const handleImageError = (
    e: React.SyntheticEvent<HTMLImageElement, Event>,
    type: "voucher" | "bill",
    rawPath: string
  ) => {
    const target = e.currentTarget;
    const currentSrc = target.src;
    let clean = String(rawPath || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
    if (!clean || clean === "0" || clean.toLowerCase() === "null") {
      setImgLoadErrors((prev) => ({ ...prev, [type]: true }));
      return;
    }

    const prodBase = "https://api.dbasesolutions.in/";
    const stripped = clean.replace(/^img\/Voucher\//i, "").replace(/^img\//i, "").replace(/^Voucher\//i, "");
    const candidates = [
      `${prodBase}img/Voucher/${stripped}`,
      `${prodBase}${clean}`,
      `${prodBase}img/${clean}`,
      `${prodBase}img/voucher/${stripped}`,
      `${prodBase}images/${stripped}`,
    ];

    const tried = (target.dataset.tried || "").split("|");
    const nextCandidate = candidates.find(
      (c) => c !== currentSrc && !tried.includes(c)
    );

    if (nextCandidate) {
      target.dataset.tried = `${target.dataset.tried || ""}|${currentSrc}|${nextCandidate}`;
      console.log(`[Transactions] Retrying ${type} image: ${nextCandidate}`);
      target.src = nextCandidate;
      return;
    }

    console.warn(`[Transactions] All retry strategies failed for ${type}: ${rawPath}`);
    setImgLoadErrors((prev) => ({ ...prev, [type]: true }));
  };

  const voucherFileInputRef = useRef<HTMLInputElement>(null);
  const billFileInputRef = useRef<HTMLInputElement>(null);
  const [remarks, setRemarks] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);

  // Searchable Employee Dropdown for Admin Voucher Filter
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState<boolean>(false);
  const [employeeDropdownPos, setEmployeeDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 240 });
  const [empSearchTerm, setEmpSearchTerm] = useState<string>("");
  const empTriggerRef = useRef<HTMLDivElement>(null);

  // Searchable Employee Dropdown for Transfer Filter
  const [isTransferEmpDropdownOpen, setIsTransferEmpDropdownOpen] = useState<boolean>(false);
  const [transferEmpDropdownPos, setTransferEmpDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 240 });
  const [transferEmpSearchTerm, setTransferEmpSearchTerm] = useState<string>("");
  const transferEmpTriggerRef = useRef<HTMLDivElement>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraType, setCameraType] = useState<"user" | "environment">(
    "environment"
  );
  const [captureFor, setCaptureFor] = useState<"voucher" | "bill">("voucher");

  // Keep active stream attached to video element across state/render cycles
  useEffect(() => {
    if (cameraOpen && cameraStream && videoRef.current) {
      const vid = videoRef.current;
      if (vid.srcObject !== cameraStream) {
        vid.srcObject = cameraStream;
      }
      vid.play().catch((err) => console.log("[Camera] video play catch:", err));
    }
  }, [cameraOpen, cameraStream]);

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result);
      if (captureFor === "voucher") {
        setPhotoVoucher(base64);
      } else {
        setPhotoBill(base64);
      }
      closeCamera();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const openCamera = async (
    type: "voucher" | "bill",
    facing: "user" | "environment" = "environment"
  ) => {
    setCaptureFor(type);
    setCameraType(facing);

    // 1. If running in native Capacitor (Android/iOS app), use native Camera plugin
    if (Capacitor.isNativePlatform()) {
      try {
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Base64,
          source: CameraSource.Prompt,
        });

        if (image && image.base64String) {
          const base64Data = `data:image/jpeg;base64,${image.base64String}`;
          if (type === "voucher") {
            setPhotoVoucher(base64Data);
          } else {
            setPhotoBill(base64Data);
          }
          presentToast(`${type === "voucher" ? "Voucher" : "Bill"} photo selected.`);
          return;
        }
      } catch (capErr: any) {
        console.log("[Camera] Native Capacitor getPhoto error:", capErr);
      }
    }

    // 2. On Web / Browser, directly start WebRTC live camera modal
    if (navigator?.mediaDevices?.getUserMedia) {
      try {
        if (cameraStream) {
          cameraStream.getTracks().forEach((track) => track.stop());
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facing ? { ideal: facing } : "environment",
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 30, max: 60 },
            },
            audio: false,
          });
        } catch (err1) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
            audio: false,
          });
        }

        streamRef.current = stream;
        setCameraStream(stream);
        setCameraOpen(true);

        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch((e) => console.log("[Camera] Play error:", e));
          }
        }, 30);
        return;
      } catch (mediaErr) {
        console.warn("[Camera] WebRTC getUserMedia failed:", mediaErr);
        if (cameraStream) {
          cameraStream.getTracks().forEach((track) => track.stop());
          setCameraStream(null);
        }
        setCameraOpen(false);
      }
    }

    // 3. Fallback: Automatically trigger device file/camera input
    presentToast("Opening file browser / camera...", true);
    if (type === "voucher") {
      voucherFileInputRef.current?.click();
    } else {
      billFileInputRef.current?.click();
    }
  };

  const switchCamera = async () => {
    try {
      const newType =
        cameraType === "environment" ? "user" : "environment";

      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: newType },
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30, max: 60 },
          },
          audio: false,
        });
      } catch (err1) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
      }

      streamRef.current = stream;
      setCameraStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.log("[Camera] Switch play:", e));
      }

      setCameraType(newType);
    } catch (err) {
      console.error("[Camera] Error switching camera:", err);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const imageData = canvas.toDataURL("image/jpeg", 0.9);

    if (captureFor === "voucher") {
      setPhotoVoucher(imageData);
    } else {
      setPhotoBill(imageData);
    }

    closeCamera();
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStream(null);
    setCameraOpen(false);
  };
  const triggerVoucherUpload = () => {
    if (voucherFileInputRef.current) {
      (voucherFileInputRef.current as HTMLInputElement).click();
    }
  };

  const triggerBillUpload = () => {
    if (billFileInputRef.current) {
      (billFileInputRef.current as HTMLInputElement).click();
    }
  };

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

  // Turn off filter loader only after transactions have actually painted
  useEffect(() => {
    if (filterSearchRef.current) {
      filterSearchRef.current = false;
      setFilterLoading(false);
    }
  }, [transactions]);

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
        fetchTransactions(txnViewEmpCode),
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


  const fetchTransactions = async (emp: string, overrides?: { start?: string; end?: string; year?: string; type?: string; head?: string }) => {
    const start = (overrides?.start ?? startDate) || "All";
    const end = (overrides?.end ?? endDate) || "All";
    const year = (overrides?.year ?? selectedYear) || "All";
    const type = overrides?.type ?? transCredDebt;
    const head = overrides?.head ?? selectedTxnType;
    const url = `${baseUrl}/Transactions/Load_Transactions?EmpCode=${emp}&TransCredDebt=${type}&TransactionType=${head}&TStartDt=${start}&TEndDt=${end}&FYear=${year}`;
    console.log(`[Transactions] fetchTransactions: GET ${url}`);
    const res = await axios.get(url, { headers: getAuthHeaders() });
    console.log("[Transactions] fetchTransactions raw response:", res.data);
    let list = normalizeTransactions(res.data || []);

    // Client-side filtering — backend SP does not respect FYear/TStartDt/TEndDt
    const effectiveYear = overrides?.year !== undefined ? overrides.year : selectedYear;
    const effectiveStart = overrides?.start !== undefined ? overrides.start : startDate;
    const effectiveEnd = overrides?.end !== undefined ? overrides.end : endDate;

    if ((effectiveYear && effectiveYear !== "All") || effectiveStart || effectiveEnd) {
      list = list.filter((t) => {
        if (!t.Date) return true;
        const d = moment(t.Date, "DD-MM-YYYY");
        if (!d.isValid()) return true;

        if (effectiveYear && effectiveYear !== "All") {
          const fyStart = Number(effectiveYear.split("-")[0]);
          const fyFrom = moment(`${fyStart}-04-01`, "YYYY-MM-DD");
          const fyTo = moment(`${fyStart + 1}-03-31`, "YYYY-MM-DD");
          if (!d.isBetween(fyFrom, fyTo, "day", "[]")) return false;
        }

        if (effectiveStart) {
          if (d.isBefore(moment(effectiveStart, "YYYY-MM-DD"), "day")) return false;
        }

        if (effectiveEnd) {
          if (d.isAfter(moment(effectiveEnd, "YYYY-MM-DD"), "day")) return false;
        }

        return true;
      });
      console.log(`[filter] year=${effectiveYear} start=${effectiveStart} end=${effectiveEnd} → ${list.length} rows`);
    }

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
    // Admin/designated users are not restricted
    if (UserDesig === "Director" || UserDesig === "In-Charge F&A") return;

    const num = Number(val);
    if (isNaN(num) || num <= 0) return;

    // Only enforce limits when server provided a positive balance
    if (paymentType === "Advance Repayment" || paymentType === "Advance") {
      if (Number(advanceCash) > 0 && num > Number(advanceCash)) {
        console.warn("[Transactions] validation failed: amount > advanceCash");
        presentToast(`Maximum Advance Transfer/Repayment amount is ${advanceCash}/-`, false);
        return;
      }
    } else {
      if (Number(handCash) > 0 && num > Number(handCash)) {
        console.warn("[Transactions] validation failed: amount > handCash");
        presentToast(`Maximum transfer amount is ${handCash}/-`, false);
        return;
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
    setRemarks("");
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
          remarks?.trim() ||
          (paymentType === "--"
            ? `Amount transferred to ${transferToCode}, through ${transferMode}`
            : `${paymentType} Amount transferred to ${transferToCode}, through ${transferMode}`),
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
        fetchTransactions(txnViewEmpCode),
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

  /* -------- Export helpers (CSV for Excel) -------- */
  const escapeCsv = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const downloadCsv = (filename: string, header: string[], rows: any[][]) => {
    const lines = [header.join(",")].concat(rows.map((r) => r.join(",")));
    const csv = lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportTransactions = () => {
    const header = ["Date", "Head", "Category", "Amount", "Class", "Remarks"];
    const rows = transactions.map((t) => [
      escapeCsv(t.Date),
      escapeCsv(t.SALorAdv),
      escapeCsv(t.CDescription),
      escapeCsv(t.Amount),
      escapeCsv(t.bclass),
      escapeCsv(t.Remarks),
    ]);
    downloadCsv(`transactions_${moment().format("YYYYMMDD_HHmmss")}.csv`, header, rows);
  };

  const exportVouchers = () => {
    const header = ["VID", "Date", "Employee", "Description", "Amount", "Verified", "VoucherFile", "BillFile"];
    const rows = vouchers.map((v) => [
      escapeCsv(v.VID),
      escapeCsv(v.Date),
      escapeCsv(v.EmpID),
      escapeCsv(v.amount),
      escapeCsv(v.isVerified),
      escapeCsv(v.fname),
      escapeCsv(v.fpath),
    ]);
    downloadCsv(`vouchers_${moment().format("YYYYMMDD_HHmmss")}.csv`, header, rows);
  };

  const exportAdvances = () => {
    const header = ["Employee", "CashInHand", "Advance_Bal", "Advance", "Advance_Repaid", "Credits", "Debits", "Vouchers"];
    const rows = advanceRows.map((a) => [
      escapeCsv(a.EmpName),
      escapeCsv(a.CashInHand),
      escapeCsv(a.Advance_Bal),
      escapeCsv(a.Advance),
      escapeCsv(a.Advance_Repaid),
      escapeCsv(a.Credits),
      escapeCsv(a.Debits),
      escapeCsv(a.Vouchers),
    ]);
    downloadCsv(`advances_${moment().format("YYYYMMDD_HHmmss")}.csv`, header, rows);
  };

  useEffect(() => {
    const updatePosition = () => {
      if (isEmployeeDropdownOpen && empTriggerRef.current) {
        const rect = empTriggerRef.current.getBoundingClientRect();
        setEmployeeDropdownPos({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width
        });
      }
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isEmployeeDropdownOpen]);

  useEffect(() => {
    const updatePosition = () => {
      if (isTransferEmpDropdownOpen && transferEmpTriggerRef.current) {
        const rect = transferEmpTriggerRef.current.getBoundingClientRect();
        setTransferEmpDropdownPos({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width
        });
      }
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isTransferEmpDropdownOpen]);

  const filteredEmployees = employees.filter((emp) => {
    const term = empSearchTerm.toLowerCase();
    return String(emp.EmpCode).toLowerCase().includes(term) ||
      String(emp.EmpName).toLowerCase().includes(term);
  });

  const filteredTransferEmployees = employees.filter((emp) => {
    const term = transferEmpSearchTerm.toLowerCase();
    return String(emp.EmpCode).toLowerCase().includes(term) ||
      String(emp.EmpName).toLowerCase().includes(term);
  });

  /* -------- UI -------- */
  return (
    <IonPage>
      <IonContent className="stock-container" style={{ padding: 0 }}>
        <IonRefresher slot="fixed" onIonRefresh={onRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <IonLoading isOpen={loading || filterLoading} message={filterLoading ? "Searching transactions…" : "Loading..."} />

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          duration={2500}
          color={toastColor}
        />

        <div className="stock-sticky-bar">
          {/* Custom Premium Header */}
          <div className="page-wr-header" style={{ margin: '16px', borderRadius: '16px', padding: '16px' }}>
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()}>
                <ChevronLeft size={22} color="white" />
              </button>
              <div>
                <h1 className="page-wr-title">Transactions</h1>
                <p className="page-wr-subtitle">{userProfile?.Department || "Account Overview"}</p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <div className="page-wr-header-icon-box">
                <Wallet size={24} color="var(--ion-color-primary)" />
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>

          {/* --- Premium Balance Cards --- */}
          <div className="balance-grid" style={{ padding: '0 16px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="premium-card card--hand">
              <div className="card-label">
                <IonIcon icon={arrowForward} style={{ transform: 'rotate(90deg)', fontSize: '16px' }} />
                In Hand
              </div>
              <div className="card-value">₹ {handCash}/-</div>
            </div>

            <div className="premium-card card--advance">
              <div className="card-label">
                <IonIcon icon={arrowForward} style={{ transform: 'rotate(-45deg)', fontSize: '16px' }} />
                Advance
              </div>
              <div className="card-value">₹ {advanceCash}/-</div>
            </div>
          </div>

          {/* --- Custom Native-Like Tabs --- */}
          <div className="stock-tabs" style={{ margin: '0 16px' }}>
            <button
              type="button"
              className={`stock-tab ${activeTab === "transfer" ? "active" : ""}`}
              onClick={() => setActiveTab("transfer")}
            >
              Transfer
            </button>

            <button
              type="button"
              className={`stock-tab ${activeTab === "voucher" ? "active" : ""}`}
              onClick={() => setActiveTab("voucher")}
            >
              Voucher
            </button>

            {(UserDesig === "Director" || UserDesig === "In-Charge F&A") && (
              <button
                type="button"
                className={`stock-tab ${activeTab === "advances" ? "active" : ""}`}
                onClick={() => setActiveTab("advances")}
              >
                Advances
              </button>
            )}
          </div>
        </div>

        {/* Transfer tab */}
        {activeTab === "transfer" && (
          <div style={{ margin: '0 16px 20px 16px' }}>
            <div className="stock-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 className="stock-section-heading" style={{ margin: 0 }}>
                  <IonIcon icon={arrowForward} style={{ marginRight: '6px' }} /> New Transfer
                </h3>
                <div>
                  <button className="stock-button stock-button--secondary stock-button--small" onClick={exportTransactions} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <IonIcon icon={documentText} /> Download Excel
                  </button>
                </div>
              </div>
              <div className="stock-grid">
                <div className="stock-field">
                  <label>Payment Type</label>
                  <div className="stock-select-wrapper">
                    <select
                      className="stock-select"
                      value={paymentType}
                      onChange={(e) => onPaymentTypeChange(e.target.value)}
                    >
                      <option value="">Select Type</option>
                      <option value="Office Expenses">Office Expenses</option>
                      {(UserDesig === "Director" || UserDesig === "In-Charge F&A") && (
                        <option value="Advance">Advance</option>
                      )}
                      <option value="Advance Repayment">Advance Repayment</option>
                      {(UserDesig === "Director" || UserDesig === "In-Charge F&A") && (
                        <option value="Salary">Salary</option>
                      )}
                    </select>
                  </div>
                  {!!advRepayFrom && (
                    <div
                      style={{ marginTop: '6px', fontSize: '13px', color: 'var(--stock-accent)', fontWeight: 700, cursor: 'pointer' }}
                      onClick={() => setOpenVoucherEmpModal(true)}
                    >
                      From: {advRepayFrom}
                    </div>
                  )}
                </div>

                <div className="stock-field">
                  <label>Transfer To</label>
                  <div className="stock-select-wrapper">
                    <select
                      className="stock-select"
                      value={transferTo}
                      onChange={(e) => setTransferTo(e.target.value)}
                    >
                      <option value="">Select Recipient</option>
                      {(employeesTemp || employees).map((emp) => (
                        <option key={emp.EmpCode} value={`${emp.EmpCode}-${emp.EmpName}`}>
                          {emp.EmpName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="stock-field">
                  <label>Amount (₹)</label>
                  <input
                    className="stock-input"
                    placeholder="0.00"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={() => {
                      if (amount) checkAmount(amount);
                    }}
                  />
                </div>

                <div className="stock-field">
                  <label>Transfer Mode</label>
                  <div className="stock-select-wrapper">
                    <select
                      className="stock-select"
                      value={transferMode}
                      onChange={(e) => setTransferMode(e.target.value)}
                    >
                      <option value="">Select Mode</option>
                      <option value="By Cash">By Cash</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="PhonePay">PhonePay</option>
                      <option value="Google Pay">Google Pay</option>
                      <option value="Paytm">Paytm</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>
                <div className="stock-field stock-field--wide">
                  <label>Remarks</label>
                  <input
                    className="stock-input"
                    placeholder="Enter remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>
              </div>

              <div className="stock-actions" style={{ marginTop: '20px' }}>
                <button className="stock-button" onClick={saveTransfer} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IonIcon icon={arrowForward} /> Transfer
                </button>
                <button className="stock-button stock-button--secondary" onClick={clearTransfer} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IonIcon icon={close} /> Cancel
                </button>
              </div>
            </div>

            {/* Filters + list */}
            <div className="stock-panel">
              <h3 className="stock-section-heading">
                {txnViewEmpCode === EmpCode
                  ? (userProfile ? `${userProfile.EmpID} - ${userProfile.EmpName}` : EmpCodeName)
                  : (() => {
                    const sel = employees.find(e => e.EmpCode === txnViewEmpCode);
                    return sel ? `${sel.EmpCode} - ${sel.EmpName}` : txnViewEmpCode;
                  })()
                }
              </h3>

              {/* ── Filter Bar ── */}
              <div
                className="stock-grid"
                style={{
                  gridTemplateColumns: (UserDesig === "Director" || UserDesig === "In-Charge F&A" || EmpCode === "1508")
                    ? 'repeat(5, 1fr)'
                    : 'repeat(auto-fit, minmax(180px, 1fr))'
                }}
              >
                {(UserDesig === "Director" || UserDesig === "In-Charge F&A" || EmpCode === "1508") && (
                  <div className="stock-field" style={{ minWidth: 0 }}>
                    <label>Employee</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                        <div
                          ref={transferEmpTriggerRef}
                          className={`dbase-inline-select searchable-trigger ${isTransferEmpDropdownOpen ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTransferEmpSearchTerm("");
                            setIsTransferEmpDropdownOpen(!isTransferEmpDropdownOpen);
                          }}
                          style={{
                            width: '100%',
                            minHeight: '38px',
                            background: 'var(--stock-panel-bg)',
                            border: '1px solid var(--stock-border)',
                            borderRadius: 'var(--stock-radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 12px'
                          }}
                        >
                          <span className="dbase-select-text" style={{ fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {(() => {
                              const sel = employees.find(e => e.EmpCode === txnViewEmpCode);
                              return sel ? `${sel.EmpCode} - ${sel.EmpName}` : txnViewEmpCode;
                            })()}
                          </span>
                          <IonIcon icon={chevronDown} className="select-chevron" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="stock-field">
                  <label>Year</label>
                  <div className="stock-select-wrapper">
                    <select
                      className="stock-select"
                      value={selectedYear}
                      onChange={(e) => {
                        const y = e.target.value;
                        setSelectedYear(y);
                        fetchTransactions(txnViewEmpCode, { year: y });
                      }}
                    >
                      <option value="">All Years</option>
                      {fiscalYears.map((fy) => (
                        <option key={fy} value={fy}>{fy}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="stock-field">
                  <label>From Date</label>
                  <div id="txn-start-date-trigger" className="stock-input" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', minHeight: '38px', color: startDate ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                    {startDate ? new Date(startDate).toLocaleDateString() : "Select Date"}
                  </div>
                  <IonPopover trigger="txn-start-date-trigger" triggerAction="click" alignment="start">
                    <IonDatetime
                      presentation="date"
                      value={startDate}
                      onIonChange={(e) => setStartDate((e.detail.value as string).split('T')[0])}
                    />
                  </IonPopover>
                </div>

                <div className="stock-field">
                  <label>To Date</label>
                  <div id="txn-end-date-trigger" className="stock-input" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', minHeight: '38px', color: endDate ? 'var(--stock-text)' : 'var(--stock-muted)' }}>
                    {endDate ? new Date(endDate).toLocaleDateString() : "Select Date"}
                  </div>
                  <IonPopover trigger="txn-end-date-trigger" triggerAction="click" alignment="start">
                    <IonDatetime
                      presentation="date"
                      value={endDate}
                      onIonChange={(e) => setEndDate((e.detail.value as string).split('T')[0])}
                    />
                  </IonPopover>
                </div>

                <div className="stock-field">
                  <label style={{ visibility: 'hidden' }}>Action</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="stock-button"
                      disabled={filterLoading}
                      style={{ flex: 1, opacity: filterLoading ? 0.6 : 1 }}
                      onClick={async () => {
                        filterSearchRef.current = true;
                        setFilterLoading(true);
                        await fetchTransactions(txnViewEmpCode);
                        presentToast("Filter applied successfully");
                      }}
                    >
                      {filterLoading ? "Searching…" : "Search"}
                    </button>
                    <button className="stock-button stock-button--secondary" style={{ flex: 1 }} onClick={() => {
                      setStartDate(""); setEndDate(""); setSelectedYear("");
                      setTransCredDebt("All"); setSelectedTxnType("All");
                      fetchTransactions(txnViewEmpCode, { start: "", end: "", year: "", type: "All", head: "All" });
                    }}>
                      Clear
                    </button>
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
                    const cdesc = t.CDescription || "";
                    const salOrAdv = t.SALorAdv || "";

                    // Determine credit / debit
                    // 1. Trust bclass if the API returns it
                    // 2. Fall back: parse "from {code}" / "to {code}" in the description
                    let isCredit: boolean;
                    if (t.bclass === "Credit") {
                      isCredit = true;
                    } else if (t.bclass === "Debit") {
                      isCredit = false;
                    } else {
                      const d = cdesc.toLowerCase();
                      const toMe = new RegExp(`\\bto\\s+${txnViewEmpCode}\\b`).test(d);
                      const fromMe = new RegExp(`\\bfrom\\s+${txnViewEmpCode}\\b`).test(d);
                      // money comes IN when "to {me}" and NOT "from {me}"
                      isCredit = toMe && !fromMe;
                    }

                    const displayTitle = cdesc || salOrAdv;

                    return (
                      <div key={idx} className="txn-card">
                        <div className={`txn-icon ${isCredit ? 'icon--credit' : 'icon--debit'}`}>
                          <IonIcon icon={arrowForward} style={{ transform: isCredit ? 'rotate(45deg)' : 'rotate(225deg)' }} />
                        </div>
                        <div className="txn-info">
                          <div className="txn-header">
                            <div className="txn-title">{displayTitle}</div>
                            <div className="txn-amount">
                              <div className="amt-value" style={{ color: isCredit ? '#10b981' : '#ef4444' }}>
                                {isCredit ? '+' : '-'} ₹{t.Amount}
                              </div>
                            </div>
                          </div>
                          <div className="txn-footer">
                            <div className="txn-meta">
                              <span>{t.Date}</span>
                              {t.SALorAdv && <span> • {t.SALorAdv}</span>}
                              {t.Remarks && <span> • {t.Remarks}</span>}
                            </div>

                            <div className="amt-status">
                              {isCredit ? "Received" : "Paid"}
                            </div>
                          </div></div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "voucher" && (
          <div style={{ margin: '0 16px 20px 16px' }}>
            <div className="stock-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 className="stock-section-heading" style={{ margin: 0 }}>
                  <IonIcon icon={arrowForward} style={{ marginRight: '6px' }} /> Verified Vouchers
                </h3>
                <div>
                  <button className="stock-button stock-button--secondary stock-button--small" onClick={exportVouchers} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <IonIcon icon={documentText} /> Download Excel
                  </button>
                </div>
              </div>
              <div className="stock-grid">
                <div className="stock-field">
                  <label>Voucher Head</label>
                  <div className="stock-select-wrapper">
                    <select
                      className="stock-select"
                      value={invoiceHeads}
                      onChange={(e) => handleVoucherHeadsChange(e.target.value)}
                    >
                      <option value="0">--Select--</option>
                      <option value="OfficeExpenses">Office Expenses</option>
                      <option value="Toll">Toll</option>
                      <option value="Fuel">Fuel</option>
                      <option value="TA">TA</option>
                      <option value="DA">DA</option>
                    </select>
                  </div>
                  {!!selectEmpHint && (
                    <div
                      style={{ marginTop: '6px', fontSize: '13px', color: 'var(--stock-accent)', fontWeight: 700, cursor: 'pointer' }}
                      onClick={() => setOpenDA_TA_Modal(true)}
                    >
                      {selectEmpHint}
                    </div>
                  )}
                </div>

                <div className="stock-field">
                  <label>Voucher Date</label>
                  <div id="voucher-date-trigger" className="stock-input" style={{ display: 'flex', alignItems: 'center', cursor: isDateDisabled ? 'default' : 'pointer', minHeight: '38px', color: invoiceDate ? 'var(--stock-text)' : 'var(--stock-muted)', opacity: isDateDisabled ? 0.5 : 1 }}>
                    {invoiceDate ? new Date(invoiceDate).toLocaleDateString() : "Select Date"}
                  </div>
                  {!isDateDisabled && (
                    <IonPopover trigger="voucher-date-trigger" triggerAction="click" alignment="start">
                      <IonDatetime
                        presentation="date"
                        value={invoiceDate ? moment(invoiceDate).toISOString() : undefined}
                        onIonChange={(e) => setInvoiceDate(e.detail.value ? (e.detail.value as string) : undefined)}
                      />
                    </IonPopover>
                  )}
                </div>

                <div className="stock-field">
                  <label>Amount (₹)</label>
                  <input
                    className="stock-input"
                    placeholder="0.00"
                    type="number"
                    value={voucherAmount}
                    onChange={(e) => setVoucherAmount(e.target.value)}
                  />
                </div>

                <div className="stock-field">
                  <label>Description</label>
                  <input
                    className="stock-input"
                    placeholder="Brief description..."
                    value={voucherDesc}
                    onChange={(e) => setVoucherDesc(e.target.value)}
                  />
                </div>
              </div>

              <div className="image-pickers" style={{ marginTop: '20px' }}>
                <div
                  className="picker-card"
                  onClick={() => openCamera("voucher", "environment")}
                >
                  {photoVoucher ? (
                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                      <img src={photoVoucher} alt="Voucher" className="picker-preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        title="Remove voucher photo"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhotoVoucher(null);
                          if (voucherFileInputRef.current) voucherFileInputRef.current.value = "";
                        }}
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          background: 'rgba(0,0,0,0.65)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          zIndex: 10
                        }}
                      >
                        <IonIcon icon={close} style={{ fontSize: '16px' }} />
                      </button>
                    </div>
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

                <div
                  className="picker-card"
                  onClick={() => openCamera("bill", "environment")}
                >
                  {photoBill ? (
                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                      <img src={photoBill} alt="Bill" className="picker-preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        title="Remove bill photo"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhotoBill(null);
                          if (billFileInputRef.current) billFileInputRef.current.value = "";
                        }}
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          background: 'rgba(0,0,0,0.65)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          zIndex: 10
                        }}
                      >
                        <IonIcon icon={close} style={{ fontSize: '16px' }} />
                      </button>
                    </div>
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

              <div className="stock-actions" style={{ marginTop: '20px' }}>
                <button className="stock-button" onClick={saveVoucher} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IonIcon icon={arrowForward} /> Submit
                </button>
                <button className="stock-button stock-button--secondary" onClick={voucherClear} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IonIcon icon={close} /> Cancel
                </button>
              </div>
            </div>

            {/* Voucher filter (Admin only) */}
            {(UserDesig === "Director" || UserDesig === "In-Charge F&A") && (
              <div className="stock-panel">
                <div className="stock-field" style={{ minWidth: 0 }}>
                  <label>Filter by Employee</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                      <div
                        ref={empTriggerRef}
                        className={`dbase-inline-select searchable-trigger ${isEmployeeDropdownOpen ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEmpSearchTerm("");
                          setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen);
                        }}
                        style={{
                          width: '100%',
                          minHeight: '38px',
                          background: 'var(--stock-panel-bg)',
                          border: '1px solid var(--stock-border)',
                          borderRadius: 'var(--stock-radius-md)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0 12px'
                        }}
                      >
                        <span className="dbase-select-text" style={{ fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {voucherEmpView || "Show All"}
                        </span>
                        <IonIcon icon={chevronDown} className="select-chevron" />
                      </div>
                    </div>
                    {voucherEmpView && (
                      <IonIcon
                        icon={close}
                        style={{ fontSize: '24px', color: '#94a3b8', cursor: 'pointer' }}
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
                    setImgLoadErrors({});
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
                          <span>• {v.Remarks || "No Remarks"}</span>
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
            <div style={{ margin: '0 16px 20px 16px' }}>
              <div className="stock-panel">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 className="stock-section-heading" style={{ margin: 0 }}>
                    <IonIcon icon={arrowForward} style={{ marginRight: '6px' }} /> Search by Reference
                  </h3>
                  <div>
                    <button className="stock-button stock-button--secondary stock-button--small" onClick={exportAdvances} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <IonIcon icon={documentText} /> Download Excel
                    </button>
                  </div>
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

        {/* Live Camera Overlay Portal */}
        {cameraOpen && createPortal(
          <div className="camera-overlay-backdrop" onClick={closeCamera}>
            <div className="camera-modal-container" onClick={(e) => e.stopPropagation()}>
              {/* VIDEO */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="camera-video-stream"
              />

              {/* ACTION MENU PILLS */}
              <div className="camera-floating-menu">
                <button
                  type="button"
                  className="cam-btn cam-btn-capture"
                  onClick={(e) => { e.stopPropagation(); capturePhoto(); }}
                >
                  Capture
                </button>
                <button
                  type="button"
                  className="cam-btn cam-btn-switch"
                  onClick={(e) => { e.stopPropagation(); switchCamera(); }}
                >
                  Switch
                </button>
                <button
                  type="button"
                  className="cam-btn cam-btn-browse"
                  onClick={(e) => { e.stopPropagation(); triggerUpload(); }}
                >
                  Browse
                </button>
                <button
                  type="button"
                  className="cam-btn cam-btn-close"
                  onClick={(e) => { e.stopPropagation(); closeCamera(); }}
                >
                  Close
                </button>
              </div>

              {/* hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFileUpload}
              />
            </div>
          </div>,
          document.body
        )}

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
                      {(() => {
                        const voucherUrl = resolveVoucherUrl(currentVoucher.fname);
                        const hasError = imgLoadErrors["voucher"];
                        return (
                          <div
                            className="image-frame"
                            onClick={(e) => {
                              if (hasError || !voucherUrl) return;
                              const imgEl = e.currentTarget.querySelector("img");
                              const targetUrl = imgEl?.currentSrc || imgEl?.src || voucherUrl;
                              if (targetUrl) {
                                window.open(targetUrl, '_blank');
                              }
                            }}
                          >
                            {voucherUrl && !hasError ? (
                              <img
                                key={`voucher-${currentVoucher.VID}-${voucherUrl}`}
                                src={voucherUrl}
                                alt="Voucher"
                                className="preview-image"
                                onError={(e) => handleImageError(e, "voucher", currentVoucher.fname)}
                              />
                            ) : (
                              <div className="empty-preview">
                                <IonIcon icon={documentText} style={{ fontSize: '32px' }} />
                                <span>No Image Found</span>
                              </div>
                            )}
                            {voucherUrl && !hasError && (
                              <div className="image-action-overlay">
                                <IonIcon icon={eyeOutline} />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="gallery-item">
                      <span className="gallery-label">Bill / Invoice</span>
                      {(() => {
                        const billUrl = resolveVoucherUrl(currentVoucher.fpath);
                        const hasError = imgLoadErrors["bill"];
                        return (
                          <div
                            className="image-frame"
                            onClick={(e) => {
                              if (hasError || !billUrl) return;
                              const imgEl = e.currentTarget.querySelector("img");
                              const targetUrl = imgEl?.currentSrc || imgEl?.src || billUrl;
                              if (targetUrl) {
                                window.open(targetUrl, '_blank');
                              }
                            }}
                          >
                            {billUrl && !hasError ? (
                              <img
                                key={`bill-${currentVoucher.VID}-${billUrl}`}
                                src={billUrl}
                                alt="Bill"
                                className="preview-image"
                                onError={(e) => handleImageError(e, "bill", currentVoucher.fpath)}
                              />
                            ) : (
                              <div className="empty-preview">
                                <IonIcon icon={documentText} style={{ fontSize: '32px' }} />
                                <span>No Image Found</span>
                              </div>
                            )}
                            {billUrl && !hasError && (
                              <div className="image-action-overlay">
                                <IonIcon icon={eyeOutline} />
                              </div>
                            )}
                          </div>
                        );
                      })()}
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

        {/* Employee Dropdown Portal (Voucher Filter) */}
        {isEmployeeDropdownOpen && createPortal(
          <>
            <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsEmployeeDropdownOpen(false); }} />
            <div
              className="custom-inline-dropdown"
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: `${employeeDropdownPos.top}px`,
                left: `${employeeDropdownPos.left}px`,
                width: `${employeeDropdownPos.width}px`
              }}
            >
              <div className="dropdown-search-sec">
                <IonIcon icon={search} className="dropdown-search-icon" />
                <input
                  type="text"
                  className="dropdown-pure-input"
                  placeholder="Search employee..."
                  value={empSearchTerm}
                  onChange={(e) => setEmpSearchTerm(e.target.value)}
                  autoFocus
                  onMouseDown={(e) => e.stopPropagation()}
                />
                {empSearchTerm && (
                  <button className="dropdown-clear-btn" onClick={() => setEmpSearchTerm("")}>
                    <IonIcon icon={close} />
                  </button>
                )}
              </div>

              <div className="dropdown-body">
                <div
                  className={`dropdown-emp-item ${!voucherEmpView ? 'selected' : ''}`}
                  onClick={async () => {
                    setVoucherEmpView(null);
                    setIsEmployeeDropdownOpen(false);
                    await fetchVouchers("ALL");
                  }}
                >
                  <div className="dr-info">
                    <span className="dr-name">Show All</span>
                  </div>
                  {!voucherEmpView && <IonIcon icon={checkmarkCircle} className="dr-check" />}
                </div>

                {filteredEmployees.map((emp, index) => {
                  const empId = String(emp.EmpCode);
                  const empName = String(emp.EmpName);
                  const isSelected = voucherEmpView === `${empId}-${empName}`;
                  const initials = (empName.charAt(0) || "?").toUpperCase();

                  return (
                    <div
                      key={index}
                      className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                      onClick={async () => {
                        const val = `${empId}-${empName}`;
                        setVoucherEmpView(val);
                        setIsEmployeeDropdownOpen(false);
                        await fetchVouchers(empId as any);
                      }}
                    >
                      <div className={`dr-avatar grad-${(parseInt(empId) % 5) || 0}`}>
                        {initials}
                      </div>
                      <div className="dr-info">
                        <span className="dr-name">{empName}</span>
                        <span className="dr-id">ID: {empId}</span>
                      </div>
                      {isSelected && <IonIcon icon={checkmarkCircle} className="dr-check" />}
                    </div>
                  );
                })}
                {filteredEmployees.length === 0 && (
                  <div className="dr-no-results">
                    <p>No matches for "{empSearchTerm}"</p>
                  </div>
                )}
              </div>
            </div>
          </>,
          document.body
        )}

        {/* Employee Dropdown Portal (Transfer Filter) */}
        {isTransferEmpDropdownOpen && createPortal(
          <>
            <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsTransferEmpDropdownOpen(false); }} />
            <div
              className="custom-inline-dropdown"
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: `${transferEmpDropdownPos.top}px`,
                left: `${transferEmpDropdownPos.left}px`,
                width: `${transferEmpDropdownPos.width}px`
              }}
            >
              <div className="dropdown-search-sec">
                <IonIcon icon={search} className="dropdown-search-icon" />
                <input
                  type="text"
                  className="dropdown-pure-input"
                  placeholder="Search employee..."
                  value={transferEmpSearchTerm}
                  onChange={(e) => setTransferEmpSearchTerm(e.target.value)}
                  autoFocus
                  onMouseDown={(e) => e.stopPropagation()}
                />
                {transferEmpSearchTerm && (
                  <button className="dropdown-clear-btn" onClick={() => setTransferEmpSearchTerm("")}>
                    <IonIcon icon={close} />
                  </button>
                )}
              </div>

              <div className="dropdown-body">
                {filteredTransferEmployees.map((emp, index) => {
                  const empId = String(emp.EmpCode);
                  const empName = String(emp.EmpName);
                  const isSelected = txnViewEmpCode === empId;
                  const initials = (empName.charAt(0) || "?").toUpperCase();

                  return (
                    <div
                      key={index}
                      className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                      onClick={async () => {
                        setTxnViewEmpCode(empId);
                        setIsTransferEmpDropdownOpen(false);
                        await fetchTransactions(empId);
                      }}
                    >
                      <div className={`dr-avatar grad-${(parseInt(empId) % 5) || 0}`}>
                        {initials}
                      </div>
                      <div className="dr-info">
                        <span className="dr-name">{empName}</span>
                        <span className="dr-id">ID: {empId}</span>
                      </div>
                      {isSelected && <IonIcon icon={checkmarkCircle} className="dr-check" />}
                    </div>
                  );
                })}
                {filteredTransferEmployees.length === 0 && (
                  <div className="dr-no-results">
                    <p>No matches for "{transferEmpSearchTerm}"</p>
                  </div>
                )}
              </div>
            </div>
          </>,
          document.body
        )}
      </IonContent>
    </IonPage>
  );
};

export default Transactions;
