import { useEffect, useState, useRef } from "react";
import { useHistory } from "react-router-dom";
import {
  Settings,
  LogOut,
  Calendar,
  User,
  Phone,
  Mail,
  CreditCard,
  Briefcase,
  Wallet,
  TrendingUp,
  Box,
  Layout,
  Truck,
  ShieldCheck,
  Plus,
  PlusCircle,
  FileText,
  Fingerprint,
  Droplet,
  Clock,
  Text,
  Users,
  Moon,
  Sun,
  Palette,
  X,
  CheckCircle2,
  Info,
  Camera,
  Loader2,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Save,
  Upload,
  Download,
  Copy,
  Check,
  Printer,
  QrCode,
  RotateCw,
  Eye,
} from "lucide-react";
import QRCode from "qrcode";
import idCardFrontClean from "../assets/id_card_front_clean.png";
import idCardBack from "../assets/id_card_back.png";
import dbsCenterBadge from "../assets/dbs_center_badge.png";
import { API_BASE } from "../config";
import { apiService } from "../utils/apiService";
import "./EmpProfile.css";

// Theme colors list with IDs matching global.css definitions
const themeColors = [
  { name: "Blue", value: "#0077b6", id: "blue" },
  { name: "Orange", value: "#ff9505", id: "orange" },
  { name: "Green", value: "#588157", id: "green" },
  { name: "Violet", value: "#957fef", id: "violet" },
  { name: "Teal", value: "#008080", id: "teal" },
  { name: "Pink", value: "#FF6EC7", id: "pink" },
  { name: "Chocolate", value: "#7B3F00", id: "chocolate" },
  { name: "DBASE", value: "#F15A24", id: "dbase" },
  { name: "Midnight", value: "#1D3557", id: "midnight" },
  { name: "Lavender", value: "#a29bfe", id: "lavender" },
  { name: "Crimson", value: "#dc143c", id: "crimson" },
  { name: "Amber", value: "#ffbf00", id: "amber" },
  { name: "Forest", value: "#1b4332", id: "forest" },
  { name: "Plum", value: "#4a0e4e", id: "plum" },
  { name: "Burgundy", value: "#641220", id: "burgundy" },
  { name: "Coal", value: "#2f3640", id: "coal" },
];

const requestTypeOptions = [
  "Equipment Upto 5000",
  "Equipment Above 5000",
  "Work Report",
  "Leave2 Days or Less per month",
  "Leave 2-4 Days per month",
  "Leave More Than 4 Days per month",
  "Permission",
  "On Duty Local Travel / Same Day",
  "On Duty Outstation / Multiple Days",
  "Over Time Up to 4 Hour",
  "Over Time 4-8 Hour",
  "Over Time More than 8 Hour",
  "Special Request",
];

const EmpProfile: React.FC = () => {
  const history = useHistory();
  const [userData, setUserData] = useState<any>({
    empCode: "",
    empName: "",
    designation: "",
    department: "",
    email: "",
    email2: "",

    // ✅ ADD THESE (no other changes)
    leave: 0,
    sick: 0,
    p_time: "",
    checkIn: "",
    requestTo: "",
    userGroup: "",

    salaryAccountNo: "",
    ifscCode: "",
    grossSalary: "",
    basicSalary: "",
    hra: "",
    da: "",
    conveyance: "",
    others: "",
    pf: "",
    esi: "",
    profTax: "",
    incomeTax: "",
    userType: "",
    doj: "",
    joiningDate: "",
    dob: "",
    bloodGroup: "",
    contactNumber: "",
    pan: "",
    aadhar: "",
    esiNo: "",
    pfNo: "",
    ReportTO: "",
    profilePic: "",
    status: "Active",
    dayDA: "",
    hourDA: "",
    dAperKM: "1",
    tAperKM: "0",
    teamAllowance: "0",
  });
  const [isNavigating, setIsNavigating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("themeMode") === "dark",
  );
  const [themeId, setThemeId] = useState<string>(
    localStorage.getItem("themeColor") || "blue",
  );
  const [showColorModal, setShowColorModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Profile Image & Personal Details Card Modal State
  const [showImageProfileModal, setShowImageProfileModal] = useState(false);
  const [imageModalTab, setImageModalTab] = useState<"idcard" | "details" | "upload">("idcard");
  const [idCardSide, setIdCardSide] = useState<"both" | "front" | "back">("both");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [showScannedDataPreview, setShowScannedDataPreview] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [downloadingCard, setDownloadingCard] = useState<string | null>(null);
  const [cardOrientation, setCardOrientation] = useState<"landscape" | "portrait">("landscape");
  const [cardRotation, setCardRotation] = useState<90 | 270>(90);
  const frontCardRef = useRef<HTMLDivElement>(null);
  const backCardRef = useRef<HTMLDivElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    const scrollToTop = () => {
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
      window.scrollTo(0, 0);
    };
    scrollToTop();
    const t = setTimeout(scrollToTop, 100);
    return () => clearTimeout(t);
  }, [loading]);

  const handleCopyValue = (fieldKey: string, text: string) => {
    if (!text || text === "—") return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2000);
    }).catch(() => { });
  };

  const formatCardDOJ = (raw: any): string => {
    if (!raw) return "07-FEB-2022";
    const str = String(raw).trim();
    if (!str) return "07-FEB-2022";
    if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(str)) {
      return str.toUpperCase();
    }
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, "0");
        const months = [
          "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
          "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
        ];
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
      }
    } catch (e) {}
    return str.toUpperCase();
  };

  const handlePrintIdCards = (side: "both" | "front" | "back" = idCardSide) => {
    const empCodeDisplay = userData.empCode
      ? String(userData.empCode).startsWith("DBS")
        ? String(userData.empCode)
        : `DBS${userData.empCode}`
      : "Employee Id";
    const empName = userData.empName || "Employee name";
    const designation = (userData.designation || "designation").toUpperCase();
    const doj = formatCardDOJ(userData.doj || userData.joiningDate);
    const bloodGroup = userData.bloodGroup || "Blood group";
    const mobile = userData.contactNumber || "Mobile number";
    const avatarSrc =
      userData.profilePic ||
      (userData.empCode
        ? `/images/Emp-Profile-Pics/${userData.empCode}.jpg`
        : "/images/avatar.png");

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const isLandscapeTray = cardOrientation === "landscape";

    const commonCardInnerStyles = `
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .idcard-inner-card {
        width: 6cm;
        height: 9cm;
        position: relative;
        overflow: hidden;
        background-size: 100% 100%;
        background-repeat: no-repeat;
        background-position: center;
        background-color: #ffffff;
        border-radius: 6px;
      }
      .avatar-wrap {
        position: absolute;
        top: 26.6%;
        left: 27.75%;
        width: 44.5%;
        height: 29.8%;
        border-radius: 50%;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .avatar-img {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid #ffffff;
      }
      .card-name {
        position: absolute;
        top: 59.4%;
        left: 4%;
        right: 4%;
        text-align: center;
        color: #ffffff !important;
        font-size: 8.5pt;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .card-desig {
        position: absolute;
        top: 64.0%;
        left: 4%;
        right: 4%;
        text-align: center;
        color: #ffffff !important;
        font-size: 6.4pt;
        font-weight: 900 !important;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .fields-block {
        position: absolute;
        top: 68.6%;
        left: 14%;
        right: 6%;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .field-row {
        display: grid;
        grid-template-columns: 50px 8px 1fr;
        align-items: center;
        white-space: nowrap;
        line-height: 1.25;
        font-size: 6pt;
        font-weight: 900;
        color: #ffffff;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      }
      .phone-row {
        position: absolute;
        top: 83.5%;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        font-size: 6.6pt;
        font-weight: 900;
        color: #ffffff;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      }
      .phone-icon {
        width: 13px;
        height: 13px;
        border-radius: 50%;
        border: 1.5px solid #ffffff;
        background: #ea580c;
        color: #ffffff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 7.5px;
      }
      .qr-box {
        position: absolute;
        top: 7.6%;
        left: 26.5%;
        width: 46.2%;
        height: 29.5%;
        background: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        padding: 0;
      }
      .qr-img {
        width: 100%;
        height: 100%;
        object-fit: fill;
        display: block;
      }
    `;

    const frontInnerHtml = `
      <div class="idcard-inner-card" style="background-image: url('${idCardFrontClean}');">
        <div class="avatar-wrap">
          <img class="avatar-img" src="${avatarSrc}" onerror="this.src='/images/avatar.png'" />
        </div>
        <div class="card-name">${empName}</div>
        <div class="card-desig">${designation}</div>
        <div class="fields-block">
          <div class="field-row">
            <span>EMP. ID</span><span>:</span><span>${empCodeDisplay}</span>
          </div>
          <div class="field-row">
            <span>DOJ</span><span>:</span><span>${doj}</span>
          </div>
          <div class="field-row">
            <span>Blood Group</span><span>:</span><span>${bloodGroup}</span>
          </div>
        </div>
        <div class="phone-row">
          <span class="phone-icon">&#9742;</span>
          <span>${mobile}</span>
        </div>
      </div>
    `;

    const backInnerHtml = `
      <div class="idcard-inner-card" style="background-image: url('${idCardBack}');">
        <div class="qr-box">
          <img class="qr-img" src="${qrCodeUrl}" />
        </div>
      </div>
    `;

    let html = "";

    if (isLandscapeTray) {
      // Epson L805 Tray Layout (Matching Photoshop Template: 3.2cm - 11.8cm, Landscape 8.6cm x 5.4cm)
      html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Epson L805 PVC Tray - ${side.toUpperCase()} - ${empCodeDisplay}</title>
  <style>
    @page {
      size: 130mm 220mm;
      margin: 0;
    }
    @media print {
      html, body {
        width: 130mm !important;
        height: 220mm !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        background: #ffffff !important;
      }
    }
    body {
      margin: 0;
      padding: 0;
      width: 130mm;
      height: 220mm;
      position: relative;
      background: #ffffff;
      font-family: Arial, "Helvetica Neue", sans-serif;
      overflow: hidden;
    }
    ${commonCardInnerStyles}
    .l805-tray-slot {
      position: absolute;
      left: 3.2cm;
      width: 9cm;
      height: 6cm;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .l805-slot-1 {
      top: 1.0cm;
    }
    .l805-slot-2 {
      top: 7.0cm;
    }
    .rotated-card-holder {
      width: 6cm;
      height: 9cm;
      transform: rotate(${cardRotation}deg);
      transform-origin: center center;
      flex-shrink: 0;
    }
  </style>
</head>
<body>
  ${(side === "both" || side === "front") ? `
    <div class="l805-tray-slot l805-slot-1">
      <div class="rotated-card-holder">
        ${frontInnerHtml}
      </div>
    </div>
  ` : ""}
  ${(side === "both" || side === "back") ? `
    <div class="l805-tray-slot l805-slot-2">
      <div class="rotated-card-holder">
        ${backInnerHtml}
      </div>
    </div>
  ` : ""}
</body>
</html>`;
    } else {
      // Portrait Mode
      html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ID Card - ${side.toUpperCase()} - ${empCodeDisplay}</title>
  <style>
    @page {
      size: ${side === "both" ? "A4 portrait" : "auto"};
      margin: ${side === "both" ? "10mm" : "0"};
    }
    body {
      margin: 0;
      padding: ${side === "both" ? "12mm 0" : "0"};
      background: #ffffff;
      font-family: Arial, "Helvetica Neue", sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      ${side !== "both" ? "min-height: 100vh;" : ""}
    }
    ${commonCardInnerStyles}
    .cards-row {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 15mm;
    }
    .card-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .card-tag {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #475569;
      margin-bottom: 3mm;
    }
  </style>
</head>
<body>
  ${side === "both" ? `
    <div class="cards-row">
      <div class="card-wrap">
        <span class="card-tag">Slot 1 - Front</span>
        ${frontInnerHtml}
      </div>
      <div class="card-wrap">
        <span class="card-tag">Slot 2 - Back</span>
        ${backInnerHtml}
      </div>
    </div>
  ` : side === "front" ? frontInnerHtml : backInnerHtml}
</body>
</html>`;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const doPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 2000);
      }
    };

    // Wait for images to load before opening print dialog
    const images = doc.images;
    let loadedCount = 0;
    const totalImages = images.length;

    if (totalImages === 0) {
      setTimeout(doPrint, 300);
    } else {
      let isPrinted = false;
      const onImageDone = () => {
        loadedCount++;
        if (loadedCount >= totalImages && !isPrinted) {
          isPrinted = true;
          setTimeout(doPrint, 250);
        }
      };

      for (let i = 0; i < totalImages; i++) {
        if (images[i].complete) {
          onImageDone();
        } else {
          images[i].onload = onImageDone;
          images[i].onerror = onImageDone;
        }
      }
      setTimeout(() => {
        if (!isPrinted) {
          isPrinted = true;
          doPrint();
        }
      }, 1500);
    }
  };  const handleDownloadCard = async (
    side: "front" | "back",
    format: "landscape" | "portrait" = "landscape",
    fileType: "jpg" | "png" = "jpg"
  ) => {
    const downloadKey = `${side}_${format}_${fileType}`;
    try {
      setDownloadingCard(downloadKey);

      const empCodeDisplay = userData.empCode
        ? String(userData.empCode).startsWith("DBS")
          ? String(userData.empCode)
          : `DBS${userData.empCode}`
        : "DBS1614";
      const empName = userData.empName || "PALURI YESURAJU";
      const designation = (userData.designation || "DEVELOPER").toUpperCase();
      const doj = formatCardDOJ(userData.doj || userData.joiningDate);
      const bloodGroup = userData.bloodGroup || "A-";
      const mobile = userData.contactNumber || "9866992847";
      const avatarSrc =
        userData.profilePic ||
        (userData.empCode
          ? `/images/Emp-Profile-Pics/${userData.empCode}.jpg`
          : "/images/avatar.png");

      const bgImage = side === "front" ? idCardFrontClean : idCardBack;

      // Safely convert an image source into a base64 Data URL to prevent CORS/taint issues in html2canvas
      const toDataUrl = (src: string): Promise<string> => {
        return new Promise((resolve) => {
          if (!src) return resolve("/images/avatar.png");
          if (src.startsWith("data:") || src.startsWith("blob:")) return resolve(src);
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            try {
              const c = document.createElement("canvas");
              c.width = img.naturalWidth || img.width;
              c.height = img.naturalHeight || img.height;
              const ctx = c.getContext("2d");
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                return resolve(c.toDataURL("image/png"));
              }
            } catch (e) {
              // Canvas tainted or cross-origin issue
            }
            resolve(src);
          };
          img.onerror = () => {
            resolve("/images/avatar.png");
          };
          img.src = src;
        });
      };

      // Prepare a pristine, circular avatar directly on an offscreen canvas to completely eliminate html2canvas clipping/crescent bugs
      const toCircularAvatarDataUrl = (src: string): Promise<string> => {
        return new Promise((resolve) => {
          if (!src) return resolve("/images/avatar.png");
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            try {
              const size = 500;
              const c = document.createElement("canvas");
              c.width = size;
              c.height = size;
              const ctx = c.getContext("2d");
              if (ctx) {
                const nw = img.naturalWidth || img.width;
                const nh = img.naturalHeight || img.height;
                const minSide = Math.min(nw, nh);
                const sx = (nw - minSide) / 2;
                const sy = (nh - minSide) / 2;

                // White circular base
                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
                ctx.fill();

                // Circular clip for avatar image
                ctx.save();
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
                ctx.clip();

                // Draw cropped image covering circle
                ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
                ctx.restore();

                // Crisp white outer border ring
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 5;
                ctx.stroke();

                return resolve(c.toDataURL("image/png"));
              }
            } catch (e) {
              // Canvas tainted or cross-origin fallback
            }
            resolve(src);
          };
          img.onerror = () => {
            resolve("/images/avatar.png");
          };
          img.src = src;
        });
      };

      const [resolvedAvatar, resolvedBg] = await Promise.all([
        side === "front" ? toCircularAvatarDataUrl(avatarSrc) : Promise.resolve(""),
        toDataUrl(bgImage),
      ]);

      // Base dimensions: 400px x 600px (exact 2:3 aspect ratio matching 6cm x 9cm card)
      const baseW = 400;
      const baseH = 600;

      const wrap = document.createElement("div");
      wrap.style.position = "fixed";
      wrap.style.left = "-9999px";
      wrap.style.top = "0";
      wrap.style.width = `${baseW}px`;
      wrap.style.height = `${baseH}px`;
      wrap.style.zIndex = "-99999";
      wrap.style.background = "#ffffff";
      wrap.style.overflow = "hidden";
      wrap.style.pointerEvents = "none";

      const cardEl = document.createElement("div");
      cardEl.style.width = `${baseW}px`;
      cardEl.style.height = `${baseH}px`;
      cardEl.style.position = "relative";
      cardEl.style.backgroundImage = `url("${resolvedBg}")`;
      cardEl.style.backgroundSize = "100% 100%";
      cardEl.style.backgroundRepeat = "no-repeat";
      cardEl.style.backgroundPosition = "center";
      cardEl.style.backgroundColor = "#ffffff";
      cardEl.style.overflow = "hidden";
      cardEl.style.fontFamily = 'Arial, "Helvetica Neue", sans-serif';

      if (side === "front") {
        cardEl.innerHTML = `
          <div style="
            position: absolute;
            top: 26.6%;
            left: 27.75%;
            width: 44.5%;
            height: 29.8%;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <img
              id="download-avatar"
              src="${resolvedAvatar}"
              crossorigin="anonymous"
              style="width: 100%; height: 100%; display: block;"
            />
          </div>
          <div style="
            position: absolute;
            top: 59.4%;
            left: 4%;
            right: 4%;
            text-align: center;
            color: #ffffff !important;
            font-size: 15px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          ">
            ${empName}
          </div>
          <div style="
            position: absolute;
            top: 64.0%;
            left: 4%;
            right: 4%;
            text-align: center;
            color: #ffffff !important;
            font-size: 11.5px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          ">
            ${designation}
          </div>
          <div style="
            position: absolute;
            top: 68.6%;
            left: 14%;
            right: 6%;
            display: flex;
            flex-direction: column;
            gap: 4px;
          ">
            <div style="display: grid; grid-template-columns: 82px 10px 1fr; align-items: center; white-space: nowrap; font-size: 10.5px; font-weight: 900; color: #ffffff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55); line-height: 1.25;">
              <span>EMP. ID</span><span>:</span><span>${empCodeDisplay}</span>
            </div>
            <div style="display: grid; grid-template-columns: 82px 10px 1fr; align-items: center; white-space: nowrap; font-size: 10.5px; font-weight: 900; color: #ffffff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55); line-height: 1.25;">
              <span>DOJ</span><span>:</span><span>${doj}</span>
            </div>
            <div style="display: grid; grid-template-columns: 82px 10px 1fr; align-items: center; white-space: nowrap; font-size: 10.5px; font-weight: 900; color: #ffffff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55); line-height: 1.25;">
              <span>Blood Group</span><span>:</span><span>${bloodGroup}</span>
            </div>
          </div>
          <div style="
            position: absolute;
            top: 83.5%;
            left: 0;
            right: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-size: 11.5px;
            font-weight: 900;
            color: #ffffff;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
          ">
            <span style="
              width: 16px;
              height: 16px;
              border-radius: 50%;
              border: 1.5px solid #ffffff;
              background: #ea580c;
              color: #ffffff;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
            ">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </span>
            <span style="letter-spacing: 0.7px;">${mobile}</span>
          </div>
        `;
      } else {
        cardEl.innerHTML = `
          <div style="
            position: absolute;
            top: 7.6%;
            left: 26.5%;
            width: 46.2%;
            height: 29.5%;
            background: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            padding: 0;
          ">
            <img
              id="download-qr"
              src="${qrCodeUrl}"
              crossorigin="anonymous"
              style="width: 100%; height: 100%; object-fit: fill; display: block;"
            />
          </div>
        `;
      }

      wrap.appendChild(cardEl);
      document.body.appendChild(wrap);

      // Wait for all images inside cardEl to load
      const imgs = cardEl.querySelectorAll("img");
      await Promise.all(
        Array.from(imgs).map(
          (img) =>
            new Promise((res) => {
              if (img.complete && img.naturalWidth > 0) return res(true);
              img.onload = () => res(true);
              img.onerror = () => {
                if (img.id === "download-avatar") {
                  img.src = "/images/avatar.png";
                  img.onload = () => res(true);
                  img.onerror = () => res(false);
                } else {
                  res(false);
                }
              };
            })
        )
      );

      // Give browser a moment to ensure fonts and layout are settled
      await new Promise((resolve) => setTimeout(resolve, 80));

      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardEl, {
        scale: 3, // ~300 DPI high resolution for printing onto PVC card (1200 x 1800)
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      document.body.removeChild(wrap);

      let finalCanvas = canvas;
      if (format === "landscape") {
        const trayCanvas = document.createElement("canvas");
        trayCanvas.width = canvas.height;
        trayCanvas.height = canvas.width;
        const ctx = trayCanvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, trayCanvas.width, trayCanvas.height);
          if (cardRotation === 90) {
            ctx.translate(trayCanvas.width, 0);
            ctx.rotate(Math.PI / 2);
          } else {
            ctx.translate(0, trayCanvas.height);
            ctx.rotate(-Math.PI / 2);
          }
          ctx.drawImage(canvas, 0, 0);
          finalCanvas = trayCanvas;
        }
      }

      const sideName = side === "front" ? "Front" : "Back";
      const modeSuffix = format === "landscape" ? "L805_Tray_Landscape" : "Portrait_6x9cm";
      const isJpg = fileType === "jpg";
      const mimeType = isJpg ? "image/jpeg" : "image/png";
      const ext = isJpg ? "jpg" : "png";

      const link = document.createElement("a");
      link.download = `ID_Card_${sideName}_${modeSuffix}_${empCodeDisplay}.${ext}`;
      link.href = finalCanvas.toDataURL(mimeType, isJpg ? 0.98 : 1.0);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading ID card image:", error);
      alert("Could not download ID card image. Please try again.");
    } finally {
      setDownloadingCard(null);
    }
  };

  useEffect(() => {
    let isCancelled = false;
    const empCodeDisplay = userData.empCode
      ? String(userData.empCode).startsWith("DBS")
        ? String(userData.empCode)
        : `DBS${userData.empCode}`
      : "employee id";

    const fullName = userData.empName || "Employee name";
    const nameParts = fullName.trim().split(/\s+/);
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
    const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : "";
    const designation = (userData.designation || "designation").toUpperCase();
    const contact = userData.contactNumber || "contact number"
    const email = userData.email || (userData.empName ? `${String(userData.empName).toLowerCase().replace(/[^a-z0-9]/g, "")}@dbasesolutions.in` : "info@dbasesolutions.in");
    const address = "Sai Sadan, Sri Sairam Nagar;Hanuman Nagar, Eluru Rural;Andhra Pradesh;534001;India";
    const doj = formatCardDOJ(userData.doj || userData.joiningDate);
    const bloodGroup = userData.bloodGroup || "blood group";

    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `N:${lastName};${firstName}`,
      `FN:${fullName}`,
      `TITLE:${designation}`,
      `ORG:Dbasesolutions PVT. LTD`,
      "URL:https://dbasesolutions.in/",
      `EMAIL;TYPE=INTERNET:${email}`,
      `TEL;TYPE=voice,pref:${contact}`,
      `ADR:;;${address}`,
      `NOTE:Emp ID: ${empCodeDisplay} | DOJ: ${doj} | Blood Group: ${bloodGroup}`,
      "END:VCARD",
    ].join("\n");

    const canvas = document.createElement("canvas");
    const size = 440;
    canvas.width = size;
    canvas.height = size;

    QRCode.toCanvas(canvas, vcard, {
      errorCorrectionLevel: "H",
      margin: 0,
      width: size,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then(async () => {
        if (isCancelled) return;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const cx = size / 2;
          const cy = size / 2;
          const rx = size * 0.165;
          const ry = size * 0.118;

          // Draw pure white filled ellipse in the center
          ctx.save();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
          ctx.fill();

          // Load official DBS center badge
          const badgeImg = new Image();
          badgeImg.src = dbsCenterBadge;
          await new Promise<void>((resolve) => {
            badgeImg.onload = () => resolve();
            badgeImg.onerror = () => resolve();
          });

          if (!isCancelled && badgeImg.width > 0) {
            const targetW = Math.round(size * 0.33);
            const targetH = Math.round(targetW * (badgeImg.height / badgeImg.width));
            ctx.drawImage(
              badgeImg,
              (size - targetW) / 2,
              (size - targetH) / 2,
              targetW,
              targetH
            );
          }
          ctx.restore();
        }
        if (!isCancelled) {
          setQrCodeUrl(canvas.toDataURL("image/png"));
        }
      })
      .catch((err) => console.error("Error generating ID card QR Code with logo:", err));

    return () => {
      isCancelled = true;
    };
  }, [
    userData.empCode,
    userData.empName,
    userData.designation,
    userData.department,
    userData.contactNumber,
    userData.doj,
    userData.joiningDate,
    userData.bloodGroup,
    userData.email,
  ]);

  // Reporting Matrix State
  const [showReportingModal, setShowReportingModal] = useState(false);
  const [reportingLoading, setReportingLoading] = useState(false);
  const [reportingHistory, setReportingHistory] = useState<any[]>([]);
  const [reportingFormData, setReportingFormData] = useState({
    Id: 0,
    EmpCode: "",
    RequestType: "",
    RA1: "",
    RA2: "",
    RA3: "",
    RA4: "",
  });

  // New Management State
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [ras, setRas] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [locationTypes, setLocationTypes] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchDepts, setBranchDepts] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("Active");
  // Four independent boxes - each filters only its own field (see
  // filteredEmployees) so what matched is never ambiguous. Code and name
  // share one box (an employee is found by either), department/
  // designation/branch each get their own since they're separate,
  // distinct facts about the employee.
  const [codeOrNameSearch, setCodeOrNameSearch] = useState("");
  const [deptSearch, setDeptSearch] = useState("");
  const [desigSearch, setDesigSearch] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  const [showEmployeeSearch, setShowEmployeeSearch] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isManagementView, setIsManagementView] = useState(false);
  const [loggedInUserType, setLoggedInUserType] = useState<string>("");
  const [employeeRawRow, setEmployeeRawRow] = useState<any>(null);
  const [teamAllowance, setTeamAllowance] = useState<string>("");
  const [showTeamAllowance, setShowTeamAllowance] = useState(false);
  const [formData, setFormData] = useState({
    _Employee_ID: "",
    _Ecode: "",
    _Ename: "",
    _Desig: "",
    _BasicSal: "0",
    _DA: "0",
    _HRA: "0",
    _LTA: "0",
    _ALLOWANCES: "0",
    _GrossSal: "0",
    _Doj: "",
    _Dob: "",
    _Blood: "",
    _Mobile: "",
    _Email: "",
    _Email2: "",
    _user: "Employee",
    _UserGroup: "Employee",
    _Allowed_CL: "12",
    _Allowed_SL: "10",
    _RequestTo: "",
    _Allowed_MY: "2",
    _IsActive: "Y",
    _AccountNo: "",
    _IFSCCode: "",
    _P_Time: "60",
    _Dept: "",
    _PF: "0",
    _Esi: "0",
    _Ptax: "0",
    _Itax: "0",
    _NetSal: "0",
    _PanNo: "",
    _AadharNo: "",
    _ESINo: "",
    _CheckIn: "09:30",
    _PFNo: "",
    _dayDA: "0",
    _hourDA: "0",
    _teamAllowance: "0",
    _Project: "",
    _LocationType: "",
    _Location1: "",
    _BranchDept: "",
    _TAperKM: "0",
    // A rupee a kilometre is what the DA calculation did before this field
    // existed, so that is what an untouched profile shows and saves.
    _DAperKM: "1",
  });
  const getMinutes = (checkIn: any) => {
    if (!checkIn) return 0;

    const start = new Date(checkIn).getTime();
    const now = new Date().getTime();

    return Math.floor((now - start) / (1000 * 60));
  };

  const calculateFromGross = (gross: number) => {
    const G = Number(gross);

    // 🧮 Earnings
    const Basic = G * 0.50;
    const HRA = Basic * 0.40;
    const DA = Basic * 0.25;
    const Conveyance = Basic * 0.15;

    const used = Basic + HRA + DA + Conveyance;
    const OtherAmt = G - used;

    // 📉 PF (FIXED RULE)
    const PFAmt = G * 0.12;

    // 📉 ESI
    const ESIAmt = G <= 21000 ? G * 0.0075 : 0;

    // 📉 Professional Tax
    const PTax =
      G <= 15000 ? 0 :
        G <= 20000 ? 150 :
          200;

    // 📉 Income Tax
    const ITax = G > 100000 ? G * 0.0212 : 0;

    // 💰 Net Salary
    const totalDeduction = PFAmt + ESIAmt + PTax + ITax;
    const NetSal = G - totalDeduction;

    return {
      Gross: G,
      Basic,
      HRA,
      DA,
      Conveyance,
      OtherAmt,
      PFAmt,
      ESIAmt,
      PTax,
      ITax,
      NetSal
    };
  };




  const getAuthHeaders = () => {
    const token = localStorage.getItem("token")?.replace(/"/g, "");
    return { Authorization: `Bearer ${token}` };
  };

  const normalizeTimeValue = (time: any) => {
    if (time === null || time === undefined) return "";
    const str = String(time);
    if (!str.includes(":")) return str;
    return str.length >= 5 ? str.slice(0, 5) : str;
  };

  useEffect(() => {
    loadBaseData();
    const userJson = localStorage.getItem("user");
    const user = JSON.parse(userJson || "{}");
    const empCode = user?.empCode || user?.EmpCode || user?.userName || user?.username;

    if (user?.userType || user?.UserType) {
      setLoggedInUserType(user.userType || user.UserType);
    }

    if (empCode) {
      const savedPic =
        localStorage.getItem(`user_profile_pic_${empCode}`) ||
        user?.Image ||
        user?.image ||
        user?.profilePic ||
        user?.ProfilePic ||
        user?.ProfileImage ||
        user?.Img;
      if (savedPic && typeof savedPic === "string" && savedPic.trim() && savedPic !== "0") {
        setUserData((prev: any) => ({ ...prev, empCode, profilePic: savedPic }));
      }
      fetchUserProfile(empCode);
    } else {
      setLoading(false);
    }
  }, []);

  // Listen for real-time profile picture update broadcasts
  useEffect(() => {
    const handleProfileUpdate = (e: any) => {
      const updatedPic = e?.detail?.profilePic;
      if (updatedPic) {
        setUserData((prev: any) => ({ ...prev, profilePic: updatedPic }));
      }
    };
    window.addEventListener("profile:updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("profile:updated", handleProfileUpdate);
    };
  }, []);


  const loadBaseData = async () => {
    console.group("[EmpProfile] Load Base Data (Depts/Desigs)");
    try {
      const [depts, desigs, projs, locTypes, branchRows, ras, bDepts] = await Promise.all([
        apiService.loadDepartments().catch(() => []),
        apiService.loadDesignations().catch(() => []),
        apiService.loadTlProjects().catch(() => []),
        apiService.loadLocationType().catch(() => []),
        apiService.loadBranch().catch(() => []),
        apiService.loadRAS().catch(() => []),
        // distinct BranchDept values off tbl_Branch - returns [] rather than
        // throwing so an old API build cannot take the whole form down
        apiService.loadBranchDept().catch(() => []),
      ]);
      console.log("Raw Departments:", depts);
      console.log("Raw Designations:", desigs);
      setDepartments(decodeArrayResponse(depts, ["id", "name", "active"]));
      setDesignations(decodeArrayResponse(desigs, ["id", "name", "active"]));
      setProjects(decodeArrayResponse(projs, ["id", "name"]));
      setLocationTypes(decodeArrayResponse(locTypes, ["id", "name"]));
      // APP_Load_Branch now returns (lid, Branch, BranchDept)
      setBranches(decodeArrayResponse(branchRows, ["id", "name", "branchDept"]));
      setRas(ras);
      setBranchDepts(decodeArrayResponse(bDepts, ["id", "name"]));
    } catch (e) {
      console.error("Error loading base data:", e);
    } finally {
      console.groupEnd();
    }
  };

  const loadEmployees = async (status: string) => {
    console.group(`[EmpProfile] Load Employees (${status})`);
    try {
      const data = await apiService.loadEmployees(status);
      console.log("Raw Employees List:", data);
      // APP_Load_Employee's Active/InActive branches return EmpCode,
      // EmpName, UserType, Designation, Mobile, department, Location1
      // (department and Location1/Branch both appended at the end - see
      // the ALTER PROC change) - this used to be labeled
      // ["code","name","dept","desig","mobile"], which quietly read the
      // UserType column as "dept". There was never a real department
      // value coming back at all, which is why department search always
      // found nothing no matter how the filter was written. "userType"
      // keeps that column around under its real name in case anything
      // needs it later; "dept" and "branch" now point at the actual
      // appended columns. Location1 is Tbl_Employee's actual column name
      // for what the edit form (and everywhere else on this page) calls
      // Branch - see the _Location1 field on the Professional Details
      // form.
      const decoded = decodeArrayResponse(data, [
        "code",
        "name",
        "userType",
        "desig",
        "mobile",
        "dept",
        "branch",
      ]);
      console.log("Decoded Employees List:", decoded);
      setEmployees(decoded);
    } catch (e) {
      console.error("Error loading employees:", e);
    } finally {
      console.groupEnd();
    }
  };

  useEffect(() => {
    if (isManagementView || showEmployeeSearch) {
      loadEmployees(statusFilter);
    }

  }, [statusFilter, isManagementView, showEmployeeSearch]);
  useEffect(() => {
    if (userData.checkIn) {
      setFormData(prev => ({
        ...prev,
        _CheckIn: userData.checkIn
      }));
    }
  }, [userData.checkIn]);

  useEffect(() => {
    if (userData.p_time) {
      setFormData(prev => ({
        ...prev,
        _P_Time: userData.p_time
      }));
    }
  }, [userData.p_time]);

  const decodeArrayResponse = (data: any, keys: string[]) => {
    let actualData = data;
    if (data && !Array.isArray(data) && Array.isArray(data.data)) {
      actualData = data.data;
    }

    if (!Array.isArray(actualData)) {
      console.warn(
        "[EmpProfile] decodeArrayResponse: actualData is not an array",
        actualData,
      );
      return [];
    }
    const decoded = actualData.map((row: any) => {
      if (Array.isArray(row)) {
        const obj: any = {};
        keys.forEach((key, i) => {
          const v = row[i];
          obj[key] = v !== null && v !== undefined && typeof v !== "object" ? String(v).trim() : "";
        });
        return obj;
      }
      if (row && typeof row === "object") {
        const obj: any = {};
        keys.forEach((key) => {
          const v = row[key];
          obj[key] = v !== null && v !== undefined && typeof v !== "object" ? String(v).trim() : "";
        });
        return obj;
      }
      return row;
    });
    return decoded;
  };

  const mapGetEmployeeResponse = (row: any) => {
    console.group("[EmpProfile] mapGetEmployeeResponse");
    console.log("Input Row Array:", row);

    // Normalizing isActive ('1' or 'Y' or true -> 'Y')
    const getValue = (
      index: number,
      keys: string[],
      fallback: any,
    ) => {
      if (Array.isArray(row)) {
        const value = row[index];
        if (value !== null && value !== undefined && typeof value !== "object") return value;
      }
      if (row && typeof row === "object") {
        for (const key of keys) {
          const value = (row as any)[key];
          if (value !== null && value !== undefined && typeof value !== "object") return value;
        }
      }
      return fallback;
    };

    const safeStrVal = (index: number, keys: string[], fallback = "") => {
      const v = getValue(index, keys, fallback);
      return v !== null && v !== undefined && typeof v !== "object" ? String(v).trim() : fallback;
    };

    const rawIsActive = getValue(14, ["_IsActive", "IsActive", "isActive"], "N");
    const normalizedIsActive =
      rawIsActive === "1" ||
        rawIsActive === "Y" ||
        rawIsActive === true ||
        rawIsActive === 1
        ? "Y"
        : "N";
    const rowAny = (row && typeof row === "object") ? row as any : {};

    const rawDoj = getValue(4, ["_Doj", "Doj", "doj"], "");
    const dojStr = rawDoj ? (String(rawDoj).includes("T") ? String(rawDoj).split("T")[0] : String(rawDoj)) : "";

    const rawDob = getValue(45, ["_Dob", "Dob", "dob", "DOB"], "");
    const dobStr = rawDob
      ? String(rawDob).includes("T")
        ? String(rawDob).split("T")[0]
        : String(rawDob).includes("/")
          ? String(rawDob).split("/").reverse().join("-")
          : String(rawDob)
      : "";

    const checkInVal = getValue(44, ["_CheckIn", "checkIn", "CheckIn", "InTime", "intime"], "");
    const legacyCheckInVal = getValue(43, ["intime1", "InTime1"], "");
    const resolvedCheckIn =
      checkInVal && checkInVal !== "NULL"
        ? normalizeTimeValue(checkInVal)
        : legacyCheckInVal && legacyCheckInVal !== "NULL"
          ? normalizeTimeValue(legacyCheckInVal)
          : "09:30";

    const pTimeVal = getValue(49, ["_P_Time", "p_time", "P_Time", "PTime"], "60");

    const mapped = {
      _Employee_ID: safeStrVal(0, ["_Employee_ID", "Employee_ID", "EmployeeId"], ""),
      _Ecode: safeStrVal(1, ["_Ecode", "Ecode", "EmpCode", "code"], ""),
      _Ename: safeStrVal(2, ["_Ename", "Ename", "EmpName", "name"], ""),
      _Desig: safeStrVal(3, ["_Desig", "Desig", "Designation", "desig"], ""),
      _Doj: dojStr,
      _Dob: dobStr,
      _Blood: safeStrVal(5, ["_Blood", "Blood", "bloodGroup"], ""),
      _Mobile: safeStrVal(6, ["_Mobile", "Mobile", "contactNumber"], ""),
      _Email: safeStrVal(8, ["_Email", "Email", "email"], ""),
      _Email2: safeStrVal(62, ["_Email2", "Email2", "email2"], ""),
      _Dept: safeStrVal(30, ["_Dept", "Dept", "Department", "department", "dept"], ""),
      _user: safeStrVal(9, ["_user", "_User", "user", "User", "userGroup", "UserGroup"], "Employee"),
      _UserGroup: safeStrVal(9, ["_UserGroup", "UserGroup", "_user", "_User", "user", "User"], "Employee"),
      _Allowed_MY: safeStrVal(13, ["_Allowed_MY", "Allowed_MY"], "2"),
      _Allowed_CL: safeStrVal(11, ["_Allowed_CL", "Allowed_CL", "leave"], "12"),
      _Allowed_SL: safeStrVal(21, ["_Allowed_SL", "Allowed_SL", "sick"], "10"),
      _IsActive: normalizedIsActive,
      _HRA: safeStrVal(23, ["_HRA", "HRA", "hra"], "0"),
      _DA: safeStrVal(42, ["_DA", "DA", "da"], "0"),
      _BasicSal: safeStrVal(22, ["_BasicSal", "BasicSal", "basicSalary"], "0"),
      _LTA: safeStrVal(24, ["_LTA", "LTA", "conveyance"], "0"),
      _ALLOWANCES: safeStrVal(25, ["_ALLOWANCES", "ALLOWANCES", "others"], "0"),
      _GrossSal: safeStrVal(26, ["_GrossSal", "GrossSal", "grossSalary"], "0"),
      _AccountNo: safeStrVal(28, ["_AccountNo", "AccountNo", "salaryAccountNo"], ""),
      _IFSCCode: safeStrVal(29, ["_IFSCCode", "IFSCCode", "ifscCode"], ""),
      _PF: safeStrVal(31, ["_PF", "PF", "pf"], "0"),
      _Esi: safeStrVal(32, ["_Esi", "Esi", "esi"], "0"),
      _Ptax: safeStrVal(33, ["_Ptax", "Ptax", "profTax"], "0"),
      _Itax: safeStrVal(34, ["_Itax", "Itax", "incomeTax"], "0"),
      _NetSal: safeStrVal(35, ["_NetSal", "NetSal", "netSalary"], "0"),
      _PanNo: safeStrVal(39, ["_PanNo", "PanNo", "pan"], ""),
      _AadharNo: safeStrVal(40, ["_AadharNo", "AadharNo", "aadhar"], ""),
      _PFNo: safeStrVal(37, ["_PFNo", "PFNo", "pfNo"], ""),
      _ESINo: safeStrVal(36, ["_ESINo", "ESINo", "esiNo"], ""),
      _CheckIn: resolvedCheckIn,
      _P_Time: normalizeTimeValue(pTimeVal),
      _dayDA: safeStrVal(47, ["_dayDA", "dayDA", "DayDA", "dayDa", "day_da"], "0"),
      _hourDA: safeStrVal(48, ["_hourDA", "hourDA", "HourDA", "hourDa", "hour_da"], "0"),
      _teamAllowance: safeStrVal(54, ["_teamAllowance", "teamAllowance", "TeamAllowance", "_TeamAllowance"], "0"),
      _RequestTo: safeStrVal(15, ["_RequestTo", "RequestTo", "requestTo", "ReportTO"], ""),
      _Project: safeStrVal(51, ["_Project", "Project", "project"], ""),
      _LocationType: safeStrVal(52, ["_LocationType", "LocationType", "locationType"], ""),
      _Location1: safeStrVal(53, ["_Location1", "Location1", "location1", "branch"], ""),
      _BranchDept: safeStrVal(63, ["_BranchDept", "BranchDept", "branchDept", "Branch_Dept"], ""),
      _TAperKM: safeStrVal(64, ["_TAperKM", "TAperKM", "taPerKm", "taperkm"], "0"),
      _DAperKM:
        safeStrVal(
          Array.isArray(row) ? row.length - 1 : -1,
          ["_DAperKM", "DAperKM", "daPerKm", "daperkm"],
          "1",
        ) || "1",
    };

    console.log("Mapped Result:", mapped);
    console.groupEnd();
    return mapped;
  };

  const selectEmployee = async (ecode: string) => {
    console.group(`[EmpProfile] Select Employee Details (${ecode})`);
    setLoading(true);
    try {
      const data = await apiService.getEmployee(ecode);
      console.log("Raw Employee Data:", data);
      const row = Array.isArray(data)
        ? data[0]
        : data && Array.isArray(data.data)
          ? data.data[0]
          : data;
      console.log("Working Raw Row:", row);
      setEmployeeRawRow(row);
      const details = mapGetEmployeeResponse(row);
      console.log("Mapped Employee Details:", details);

      // Load team allowance for this employee
      fetchTeamAllowance(ecode);

      const safeStr = (v: any, fallback = "") =>
        v !== null && v !== undefined && typeof v !== "object" ? String(v).trim() : fallback;

      // Map back to userData structure for display
      const newUserData = {
        empCode: safeStr(details._Ecode),
        empName: safeStr(details._Ename),
        designation: safeStr(details._Desig),
        department: safeStr(details._Dept),
        joiningDate: safeStr(details._Doj),
        dob: safeStr(details._Dob),
        bloodGroup: safeStr(details._Blood),
        contactNumber: safeStr(details._Mobile),
        email: safeStr(details._Email),
        email2: safeStr(details._Email2),
        salaryAccountNo: safeStr(details._AccountNo),
        ifscCode: safeStr(details._IFSCCode),
        grossSalary: safeStr(details._GrossSal, "0"),
        basicSalary: safeStr(details._BasicSal, "0"),
        hra: safeStr(details._HRA, "0"),
        da: safeStr(details._DA, "0"),
        pf: safeStr(details._PF, "0"),
        esi: safeStr(details._Esi, "0"),
        profTax: safeStr(details._Ptax, "0"),
        incomeTax: safeStr(details._Itax, "0"),
        conveyance: safeStr(details._LTA, "0"),
        others: safeStr(details._ALLOWANCES, "0"),
        userType: safeStr(Array.isArray(row) ? row[15] : (row as any)?._RequestTo, details._RequestTo || "Employee"),
        doj: safeStr(details._Doj),
        pan: safeStr(details._PanNo),
        aadhar: safeStr(details._AadharNo),
        esiNo: safeStr(details._ESINo),
        pfNo: safeStr(details._PFNo),
        ReportTO: safeStr(details._RequestTo),
        profilePic:
          localStorage.getItem(`user_profile_pic_${details._Ecode}`) ||
          (Array.isArray(row) ? "" : ((row as any)?.profilePic || (row as any)?.ProfilePic || (row as any)?.ProfileImage)) ||
          `/images/Emp-Profile-Pics/${details._Ecode}.jpg`,
        status: details._IsActive === "N" ? "InActive" : "Active",
        dayDA: safeStr(details._dayDA, "0"),
        hourDA: safeStr(details._hourDA, "0"),
        tAperKM: safeStr(details._TAperKM, "0"),
        dAperKM: safeStr(details._DAperKM, "1"),
        teamAllowance: safeStr(details._teamAllowance, "0"),
        leave: safeStr(details._Allowed_CL, "12"),
        sick: safeStr(details._Allowed_SL, "10"),
        p_time: safeStr(details._P_Time, "60"),
        checkIn: safeStr(details._CheckIn, "09:30"),
        requestTo: safeStr(details._RequestTo),
        userGroup: safeStr(details._user, "Employee"),
      };
      console.log("Setting Final userData for View:", newUserData);
      setUserData(newUserData);

      // Update form data for potential editing
      const newFormData = {
        ...formData,
        ...details,
        _IsActive: details._IsActive || "Y",
        _user: details._user || "Employee",
        _UserGroup: details._UserGroup || details._user || "Employee",
      };
      console.log("Setting formData for Edit:", newFormData);
      setFormData(newFormData);

      setShowEmployeeSearch(false);
      // Automatically open the editable modal on selection
      setIsEditMode(true);
      setShowRegisterModal(true);
    } catch (e) {
      console.error("Error selecting employee:", e);
      alert("Failed to load employee details.");
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  };

  const fetchTeamAllowance = async (empCode: string) => {
    try {
      const response = await apiService.get(
        `/Employee/GetAllowance?empCode=${encodeURIComponent(empCode)}`,
      );

      console.log("[EmpProfile] GetAllowance response:", response);

      let allowanceValue: string | number | null = null;

      if (typeof response === "string") {
        const trimmed = response.trim();
        if (/invalid designation/i.test(trimmed)) {
          allowanceValue = null;
        } else if (!Number.isNaN(Number(trimmed))) {
          allowanceValue = trimmed;
        }
      } else if (Array.isArray(response) && response.length > 0) {
        const first = response[0] as any;
        allowanceValue =
          first?.PayableAmount ??
          first?.payableAmount ??
          first?.Amount ??
          first?.amount ??
          null;
      } else if (response && typeof response === "object") {
        allowanceValue =
          (response as any).PayableAmount ??
          (response as any).payableAmount ??
          (response as any).Amount ??
          (response as any).amount ??
          null;
      }

      if (allowanceValue !== null && allowanceValue !== undefined) {
        setTeamAllowance(String(allowanceValue));
        setShowTeamAllowance(true);
        // Only prefill suggestion if current value is not already set from tbl_Employee
        setFormData((prev) => {
          const current = prev._teamAllowance;
          const hasSaved = current && current !== "0" && current !== "0.00" && current !== "";
          return {
            ...prev,
            _teamAllowance: hasSaved ? current : String(allowanceValue),
          };
        });
      } else {
        setTeamAllowance("");
      }
    } catch (error) {
      console.warn("Team allowance unavailable or invalid designation:", error);
      setTeamAllowance("");
    }
  };

  useEffect(() => {
    if (showRegisterModal && formData._Ecode && (!formData._teamAllowance || formData._teamAllowance === "0" || formData._teamAllowance === "0.00")) {
      fetchTeamAllowance(formData._Ecode);
    }
  }, [showRegisterModal, formData._Ecode]);

  const fetchUserProfile = async (empCode: string) => {
    console.group(`[EmpProfile] fetchUserProfile (${empCode})`);
    try {
      const response = await fetch(
        `${API_BASE}Employee/Get_Employee?_Ecode=${empCode}`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        },
      );

      if (response.ok) {
        const data = await response.json();
        const userProfile = Array.isArray(data)
          ? (Array.isArray(data[0]) ? data[0] : data)
          : data && Array.isArray(data.data)
            ? data.data[0]
            : data;

        console.log("[EmpProfile] fetchUserProfile SUCCESS", {
          raw: data,
          image: Array.isArray(userProfile)
            ? userProfile[42]
            : userProfile.Img || userProfile?.ProfileImage,
          name: Array.isArray(userProfile)
            ? userProfile[2]
            : userProfile.EmpName || userProfile?.Empname,
        });

        // Resolve profile picture preserving saved upload across refreshes
        const localUser = JSON.parse(localStorage.getItem("user") || "{}");
        const dedicatedPic = localStorage.getItem(`user_profile_pic_${empCode}`);
        const savedPic = dedicatedPic || localUser.profilePic || localUser.ProfilePic || localUser.ProfileImage || localUser.Img;

        const isValidPic = (p: any) =>
          typeof p === "string" && p.trim() && p !== "0" && p !== "1" && p !== "null" && p !== "undefined";

        const resolvedPic = isValidPic(savedPic)
          ? savedPic
          : (Array.isArray(userProfile)
            ? (isValidPic(userProfile[42]) ? userProfile[42] : (userData?.profilePic || `/images/Emp-Profile-Pics/${empCode}.jpg`))
            : (isValidPic(userProfile.Img || userProfile.ProfileImage) ? (userProfile.Img || userProfile.ProfileImage) : (userData?.profilePic || `/images/Emp-Profile-Pics/${empCode}.jpg`)));

        if (Array.isArray(userProfile)) {
          // Legacy array-based mapping using mapGetEmployeeResponse for robust indexing
          const details = mapGetEmployeeResponse(userProfile);
          setUserData({
            empCode: details._Ecode,
            empName: details._Ename,
            designation: details._Desig,
            department: details._Dept,
            joiningDate: details._Doj,
            dob: details._Dob,
            bloodGroup: details._Blood,
            contactNumber: details._Mobile,
            email: details._Email,
            email2: details._Email2,
            salaryAccountNo: details._AccountNo,
            ifscCode: details._IFSCCode,
            grossSalary: details._GrossSal,
            basicSalary: details._BasicSal,
            hra: details._HRA,
            da: details._DA,
            pf: details._PF,
            esi: details._Esi,
            profTax: details._Ptax,
            incomeTax: details._Itax,
            conveyance: details._LTA || "0",
            others: details._ALLOWANCES || "0",
            userType: userProfile[15] || details._RequestTo,
            doj: details._Doj,
            pan: details._PanNo,
            aadhar: details._AadharNo,
            esiNo: details._ESINo,
            pfNo: details._PFNo,
            ReportTO: details._RequestTo,
            profilePic: resolvedPic,
            status: details._IsActive === "N" ? "InActive" : "Active",
            dayDA: details._dayDA,
            hourDA: details._hourDA,
            tAperKM: details._TAperKM,
            dAperKM: details._DAperKM,
            teamAllowance: details._teamAllowance,
            leave: details._Allowed_CL,
            sick: details._Allowed_SL,
            p_time: details._P_Time,
            checkIn: details._CheckIn,
            requestTo: details._RequestTo,
            userGroup: details._user,
          });
        } else {
          // Object-based mapping
          setUserData({
            empCode: userProfile.EmpCode || userProfile.Empcode,
            empName: userProfile.EmpName || userProfile.Empname,
            designation: userProfile.Designation,
            joiningDate: userProfile.DOJ,
            dob: userProfile.DOB || userProfile.Dob || userProfile.dob || "",
            bloodGroup: userProfile.Blood,
            contactNumber: userProfile.Mobile,
            pan: userProfile.PanNo,
            aadhar: userProfile.AadhaarNo,
            salary: userProfile.NetSal,
            email: userProfile.Email,
            email2: userProfile.Email2,
            performanceScore: userProfile.UnseenCredits,
            pendingLeaves: userProfile.AVAIL_LS,
            profilePic: resolvedPic,
            department: userProfile.Department,
            salaryAccountNo: userProfile.Accountno,
            doj: userProfile.DOJ,
            pfNo: userProfile.PFNo,
            esiNo: userProfile.ESINo,
            ifscCode: userProfile.IFSCcode,
            grossSalary: userProfile.GrossSal,
            basicSalary: userProfile.BASICSAL,
            hra: userProfile.HRA,
            da: userProfile.DA,
            conveyance: userProfile.LTA,
            others: userProfile.ALLOWANCES,
            pf: userProfile.PF,
            esi: userProfile.ESI,
            profTax: userProfile.PTax,
            incomeTax: userProfile.ITax,
            userType: userProfile.UserType,
            availableLeaves: userProfile.AVAIL_LS,
            unseenCredits: userProfile.UnseenCredits,
            ReportTO: userProfile.ReportTO,
            status:
              userProfile.IsActive === "N" ||
                userProfile.IsActive === "0" ||
                userProfile.IsActive === false ||
                userProfile.Isactive === "N"
                ? "InActive"
                : "Active",
            leave: userProfile.Allowed_LS ?? userProfile.ALLOWED_LS ?? userProfile.ALLOWED_CL ?? userProfile.Allowed_CL ?? userProfile.leave ?? 0,
            sick: userProfile.Allowed_SL ?? userProfile.ALLOWED_SL ?? userProfile.sick ?? 0,
            p_time: userProfile.P_Time ?? userProfile.p_time ?? userProfile.PTime ?? userProfile.pTime ?? "60",
            // InTime first — intime1 is the legacy column the save proc never writes
            checkIn: userProfile.InTime ?? userProfile.inTime ?? userProfile.intime ?? userProfile.intime1 ?? userProfile.checkIn ?? userProfile.CheckIn ?? "09:30",
            requestTo: userProfile.RequestTo || "",
            userGroup: userProfile.UserGroup ?? userProfile.UserType ?? userProfile.Usertype ?? userProfile.userGroup ?? userProfile.userType ?? "",
            dayDA: userProfile.dayDA ?? userProfile.DayDA ?? userProfile.dayDa ?? userProfile.DayDa ?? userProfile.dayda ?? userProfile.day_da ?? "0",
            hourDA: userProfile.hourDA ?? userProfile.HourDA ?? userProfile.hourDa ?? userProfile.HourDa ?? userProfile.hourda ?? userProfile.hour_da ?? "0",
            tAperKM: userProfile.TAperKM ?? userProfile.taPerKM ?? userProfile.taPerKm ?? userProfile.taperkm ?? "0",
            dAperKM: userProfile.DAperKM ?? userProfile.daPerKM ?? userProfile.daPerKm ?? userProfile.daperkm ?? "1",
            teamAllowance: userProfile.teamAllowance ?? userProfile.TeamAllowance ?? userProfile._teamAllowance ?? userProfile._TeamAllowance ?? "0",
          });
        }

        // Load team allowance for the current profile employee
        fetchTeamAllowance(empCode);
      } else {
        console.error("[EmpProfile] fetchUserProfile FAILED:", response.status);
      }
    } catch (error) {
      console.error("[EmpProfile] fetchUserProfile EXCEPTION:", error);
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    const currentEmpCode = String(
      userData.empCode ||
      formData._Ecode ||
      JSON.parse(localStorage.getItem("user") || "{}")?.empCode ||
      JSON.parse(localStorage.getItem("user") || "{}")?.EmpCode ||
      ""
    ).trim();

    if (!currentEmpCode) {
      alert("Employee code not found. Please refresh and try again.");
      return;
    }

    // Instant optimistic preview
    const previewUrl = URL.createObjectURL(file);
    const previousPic = userData.profilePic;
    setUserData((prev: any) => ({ ...prev, profilePic: previewUrl }));

    setUploading(true);
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);

    try {
      const url = `${API_BASE}Login/UploadProfileImage?empCode=${currentEmpCode}`;
      console.log("[EmpProfile] Uploading image to:", url);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "*/*",
          ...getAuthHeaders(),
        },
        body: uploadFormData,
      });

      console.log("[EmpProfile] Upload response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("[EmpProfile] Upload success response:", data);

        // Backend returns: Ok(new { Message = "Image uploaded successfully", Image = imageUrl })
        const rawImg = data?.Image || data?.image || data?.ImageUrl || data?.imageUrl;
        let finalUrl = "";
        if (rawImg && typeof rawImg === "string") {
          const apiOrigin = API_BASE.replace(/\/api\/?$/i, "").replace(/\/$/, "");
          const fullUrl = rawImg.startsWith("http")
            ? rawImg
            : `${apiOrigin}${rawImg.startsWith("/") ? "" : "/"}${rawImg}`;
          finalUrl = `${fullUrl}${fullUrl.includes("?") ? "&" : "?"}t=${Date.now()}`;
        } else {
          finalUrl = previewUrl;
        }

        // 1. Update component state
        setUserData((prev: any) => ({ ...prev, profilePic: finalUrl }));

        // 2. Update local storage user object with all case variations
        const localUser = JSON.parse(localStorage.getItem("user") || "{}");
        localUser.profilePic = finalUrl;
        localUser.ProfilePic = finalUrl;
        localUser.ProfileImage = finalUrl;
        localUser.Img = finalUrl;
        localStorage.setItem("user", JSON.stringify(localUser));

        // 3. Update cached_user_profile so Side Menu cache doesn't override it
        try {
          const cached = JSON.parse(localStorage.getItem("cached_user_profile") || "{}");
          if (Array.isArray(cached)) {
            cached[42] = finalUrl;
          } else if (cached && typeof cached === "object") {
            cached.ProfileImage = finalUrl;
            cached.profileImage = finalUrl;
            cached.Img = finalUrl;
            cached.img = finalUrl;
            cached.profilePic = finalUrl;
            cached.ProfilePic = finalUrl;
          }
          localStorage.setItem("cached_user_profile", JSON.stringify(cached));
        } catch { }

        // 4. Save dedicated key for this employee
        localStorage.setItem(`user_profile_pic_${currentEmpCode}`, finalUrl);

        // 5. Broadcast to the Side Menu (Menu.tsx) so it updates in real time
        window.dispatchEvent(
          new CustomEvent("profile:updated", {
            detail: { empCode: currentEmpCode, profilePic: finalUrl },
          })
        );

        console.log("[EmpProfile] Image upload SUCCESS, saved as:", finalUrl);
        alert("Profile picture updated successfully!");
      } else {
        const errorText = await response.text();
        setUserData((prev: any) => ({ ...prev, profilePic: previousPic }));
        alert("Upload failed: " + errorText);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      setUserData((prev: any) => ({ ...prev, profilePic: previousPic }));
      alert("An error occurred during image upload.");
    } finally {
      setUploading(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  };

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
    localStorage.setItem("themeMode", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    if (!employeeRawRow) return;

    if (!projects.length || !locationTypes.length || !branches.length) return;

    const getRowValue = (row: any, index: number, keys: string[]) => {
      if (Array.isArray(row)) return row[index];
      for (const key of keys) {
        if (row[key] !== null && row[key] !== undefined) return row[key];
      }
      return undefined;
    };


    const projectValue = getRowValue(employeeRawRow, 51, ["_Project", "Project", "project"]);
    const locationTypeValue = getRowValue(employeeRawRow, 52, ["_LocationType", "LocationType", "locationType"]);
    const branchValue = getRowValue(employeeRawRow, 53, ["_Location1", "Location1", "location1"]);

    const projectId =
      projects.find((p) => p.name == projectValue || p.id == projectValue)?.id ||
      projectValue ||
      "";
    const locationTypeId =
      locationTypes.find((l) => l.name == locationTypeValue || l.id == locationTypeValue)?.id ||
      locationTypeValue ||
      "";
    // The Branch dropdown carries the branch NAME. A branch now spans one
    // row per dept in tbl_Branch, so its lid no longer identifies the branch
    // on its own - and Tbl_Employee.Location1 stores the name anyway.
    const branchNameValue =
      branches.find((b) => b.name == branchValue || b.id == branchValue)?.name ||
      branchValue ||
      "";

    // Tbl_Employee.BranchDept was appended to the END of the table, so unlike
    // the older fields (51 = project, 52 = LocationType, 53 = Location1) it has
    // no ordinal we can safely hard-code - APP_Get_Employee returns a plain
    // positional array, and the next ALTER TABLE would shift any number we
    // guessed. So instead of a magic index, scan the tail of the row for a
    // value that matches a branch dept we already know about.
    //
    // 62 (Email2) is the highest ordinal this screen relies on, so anything
    // past it is a newer column. If nothing matches - because APP_Get_Employee
    // uses an explicit column list that omits BranchDept, or the dept was
    // renamed - the field just comes up blank and the user re-picks it. It can
    // never latch onto the wrong column.
    const knownDepts = branchDepts
      .map((d) => String(d.name ?? "").trim())
      .filter((n) => n !== "");
    const knownDeptsLower = knownDepts.map((n) => n.toLowerCase());

    let branchDeptValue = "";
    if (Array.isArray(employeeRawRow)) {
      if (knownDeptsLower.length) {
        for (let i = employeeRawRow.length - 1; i > 62; i--) {
          const cell = String(employeeRawRow[i] ?? "").trim();
          if (cell && knownDeptsLower.includes(cell.toLowerCase())) {
            branchDeptValue = knownDepts[knownDeptsLower.indexOf(cell.toLowerCase())];
            break;
          }
        }
      }
    } else if (employeeRawRow) {
      branchDeptValue = String(
        employeeRawRow.BranchDept ?? employeeRawRow._BranchDept ?? ""
      ).trim();
    }

    console.log({ projectValue, locationTypeValue, branchValue, projectId, locationTypeId, branchNameValue, branchDeptValue });

    setFormData((prev) => ({
      ...prev,
      _Project: projectId,
      _LocationType: locationTypeId,
      _Location1: branchNameValue,
      _BranchDept: branchDeptValue,
    }));
  }, [employeeRawRow, projects, locationTypes, branches, branchDepts]);

  // tbl_Branch holds one row per (Branch, BranchDept) pair, so the branch list
  // repeats a branch name once for each of its depts. Collapse it for the
  // Branch dropdown.
  const branchNames = Array.from(
    new Set(branches.map((b) => String(b.name ?? "").trim()).filter((n) => n !== ""))
  );

  // Depts recorded against the branch currently selected on the form.
  const selectedBranch = String(formData._Location1 ?? "").trim().toLowerCase();
  const deptsForBranch = Array.from(
    new Set(
      branches
        .filter((b) => String(b.name ?? "").trim().toLowerCase() === selectedBranch)
        .map((b) => String(b.branchDept ?? "").trim())
        .filter((d) => d !== "")
    )
  );

  // If this branch has no dept on record, fall back to every known dept rather
  // than leaving the user staring at an empty dropdown they cannot get past.
  const deptOptions = deptsForBranch.length
    ? deptsForBranch
    : branchDepts.map((d) => String(d.name ?? "").trim()).filter((d) => d !== "");

  // Keep the dept in step with the branch:
  //   exactly one dept for this branch   -> fill it in automatically
  //   current dept not valid here        -> clear it
  //   dept already valid, or none known  -> leave it alone
  // Written as a reconcile against the current state rather than as an
  // onChange handler, so it also settles the value when an existing employee
  // is loaded for editing, not just when the user picks a branch by hand.
  useEffect(() => {
    if (!deptsForBranch.length) return;
    const current = String(formData._BranchDept ?? "").trim();
    if (deptsForBranch.some((d) => d.toLowerCase() === current.toLowerCase())) return;
    const next = deptsForBranch.length === 1 ? deptsForBranch[0] : "";
    if (next === current) return;
    setFormData((prev) => ({ ...prev, _BranchDept: next }));
  }, [formData._Location1, formData._BranchDept, branches]);

  useEffect(() => {
    // Apply the theme ID to the data-theme attribute
    document.documentElement.setAttribute("data-theme", themeId);

    // Also set primary color as fallback for vintage components
    const selectedColor =
      themeColors.find((t) => t.id === themeId)?.value || "#0077b6";
    document.documentElement.style.setProperty(
      "--ion-color-primary",
      selectedColor,
    );

    localStorage.setItem("themeColor", themeId);
  }, [themeId]);

  const changeThemeColor = (id: string) => {
    setThemeId(id);
    setShowColorModal(false);
  };

  const handleLogout = () => {
    setLoading(true);
    window.dispatchEvent(new Event("app:logout"));
  };
  const handleInputChange = (e: any) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      // 👉 Only trigger when Gross changes
      if (name === "_GrossSal") {
        const gross = parseFloat(value) || 0;

        const calc = calculateFromGross(gross);

        updated._BasicSal = calc.Basic.toFixed(0);
        updated._HRA = calc.HRA.toFixed(0);
        updated._DA = calc.DA.toFixed(0);
        updated._LTA = calc.Conveyance.toFixed(0);
        updated._ALLOWANCES = calc.OtherAmt.toFixed(0);

        updated._PF = calc.PFAmt.toFixed(0);
        updated._Esi = calc.ESIAmt.toFixed(0);
        updated._Ptax = calc.PTax.toString();
        updated._Itax = calc.ITax.toFixed(0);
        updated._NetSal = calc.NetSal.toFixed(0);
      }

      return updated;
    });
  };
  // const handleInputChange = (e: any) => {
  //   const { name, value } = e.target;
  //   setFormData((prev) => ({ ...prev, [name]: value }));
  // };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const formatToDDMMYYYY = (dateStr: string) => {
      if (!dateStr || !dateStr.includes("-")) return dateStr;
      const [y, m, d] = dateStr.split("-");
      return `${d}/${m}/${y}`;
    };

    setRegisterLoading(true);

    try {
      // Convert IDs to names for saving
      const projectName =
        projects.find((p) => p.id == formData._Project)?.name ||
        formData._Project;
      const locationTypeName =
        locationTypes.find((l) => l.id == formData._LocationType)?.name ||
        formData._LocationType;
      // the Branch dropdown already holds the branch NAME, so no id lookup
      const branchName = String(formData._Location1 ?? "").trim();

      const payload = {
        ...formData,
        _User: formData._user,
        _Project: projectName,
        _LocationType: locationTypeName,
        _Location1: branchName,
        // the Branch Dept dropdown already holds the name (its ids come from a
        // ROW_NUMBER over distinct values and are not stable), so no lookup
        _BranchDept: (formData._BranchDept ?? "").trim(),
        _teamAllowance: String(formData._teamAllowance ?? "0"),
        teamAllowance: String(formData._teamAllowance ?? "0"),
        TeamAllowance: String(formData._teamAllowance ?? "0"),
        _Doj: formatToDDMMYYYY(formData._Doj),
        _Dob: formatToDDMMYYYY(formData._Dob),
        _UpdatedBy: (() => {
          try {
            const user = JSON.parse(localStorage.getItem("user") || "{}");
            return user.empCode || user.EmpCode || user.username || user.Username || "";
          } catch { return ""; }
        })(),
        _UpdatedFromDevice: (() => {
          const ua = navigator.userAgent;
          let os = "Desktop";
          if (/android/i.test(ua)) os = "Android Device";
          else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS Device";
          else if (/windows/i.test(ua)) os = "Windows PC";
          else if (/macintosh/i.test(ua)) os = "Mac";
          else if (/linux/i.test(ua)) os = "Linux";

          let browser = "Web";
          if (/edg/i.test(ua)) browser = "Edge";
          else if (/chrome/i.test(ua)) browser = "Chrome";
          else if (/firefox/i.test(ua)) browser = "Firefox";
          else if (/safari/i.test(ua)) browser = "Safari";

          return `${os} - ${browser}`;
        })(),
      };

      console.log("FINAL POST PAYLOAD (Formatted):", payload);
      const response = await apiService.registerEmployee(payload);

      if (
        response === "Employee saved successfully" ||
        response?.message === "Employee saved successfully"
      ) {
        alert("Employee saved successfully");
        // Re-fetch updated profile/employee details to refresh the view in real-time
        if (formData._Ecode) {
          selectEmployee(formData._Ecode);
        } else {
          const userJson = localStorage.getItem("user");
          const user = JSON.parse(userJson || "{}");
          if (user?.empCode) {
            fetchUserProfile(user.empCode);
          }
        }
        if (isManagementView) loadEmployees(statusFilter);
      } else {
        alert(
          "Registration failed: " +
          (typeof response === "string"
            ? response
            : JSON.stringify(response)),
        );
      }
    } catch (error: any) {
      console.error("Error registering employee:", error);
      alert("An error occurred during registration: " + error.message);
    } finally {
      setRegisterLoading(false);
    }
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setFormData({
      _Employee_ID: "0",
      _Ecode: "",
      _Ename: "",
      _Desig: "",
      _BasicSal: "0",
      _DA: "0",
      _HRA: "0",
      _LTA: "0",
      _ALLOWANCES: "0",
      _GrossSal: "0",
      _Doj: "",
      _Dob: "",
      _Blood: "",
      _Mobile: "",
      _Email: "",
      _Email2: "",
      _user: "Employee",
      _UserGroup: "Employee",
      _Allowed_CL: "12",
      _Allowed_SL: "10",
      _RequestTo: "",
      _Allowed_MY: "1",
      _IsActive: "Y",
      _AccountNo: "",
      _IFSCCode: "",
      _P_Time: "60",
      _Dept: "",
      _PF: "0",
      _Esi: "0",
      _Ptax: "200",
      _Itax: "0",
      _NetSal: "0",
      _PanNo: "",
      _AadharNo: "",
      _ESINo: "",
      _CheckIn: "09:30:00",
      _PFNo: "",
      _dayDA: "0",
      _hourDA: "0",
      _teamAllowance: "",
      _Project: "",
      _LocationType: "",
      _Location1: "",
      _BranchDept: "",
      _TAperKM: "0",
      _DAperKM: "1",
    });
    setShowRegisterModal(true);
  };


  const openEditModal = () => {
    setIsEditMode(true);
    setShowRegisterModal(true);
  };

  const openReportingModal = async () => {
    setReportingFormData({
      Id: 0,
      EmpCode: formData._Ecode,
      RequestType: "",
      RA1: formData._RequestTo || "",
      RA2: "",
      RA3: "",
      RA4: "",
    });
    setShowReportingModal(true);
    fetchReportingHistory(formData._Ecode);
  };

  const fetchReportingHistory = async (empCode: string) => {
    console.group(`[EmpProfile] Fetch Reporting Matrix (${empCode})`);
    try {
      const data = await apiService.loadReportingMatrix(empCode);
      console.log("Raw History Data:", data);

      if (Array.isArray(data)) {
        console.log(`Success: Found ${data.length} assignments.`);
        data.forEach((item, i) => {
          console.log(`Assignment #${i + 1}:`, {
            Id: item.id || item.Id,
            Type: item.requestType || item.RequestType,
            RA1: item.rA1 || item.RA1,
            RA2: item.rA2 || item.RA2,
            RA3: item.rA3 || item.RA3,
            RA4: item.rA4 || item.RA4,
          });
        });
        setReportingHistory(data);
      } else {
        console.warn("No data found or invalid format:", data);
        setReportingHistory([]);
      }
    } catch (e) {
      console.error("Critical error loading reporting history:", e);
      setReportingHistory([]);
    } finally {
      console.groupEnd();
    }
  };

  const editReportingMatrix = (item: any) => {
    setReportingFormData({
      Id: item.id || item.Id || 0,
      EmpCode: item.empCode || item.EmpCode,
      RequestType: item.requestType || item.RequestType,
      RA1: item.rA1 || item.RA1 || "",
      RA2: item.rA2 || item.RA2 || "",
      RA3: item.rA3 || item.RA3 || "",
      RA4: item.rA4 || item.RA4 || "",
    });
  };

  // 🔥 Update API (now includes RequestType)
  const updateReportingField = async (
    field: string,
    value: string,
    requestType: string,
  ) => {
    try {
      const row = reportingHistory.find(
        (r) => (r.requestType || r.RequestType) === requestType,
      );

      const payload = {
        EmpCode: reportingFormData.EmpCode,
        RequestType: requestType,

        // ✅ Preserve all values including RA1
        RA1: field === "RA1" ? value : row?.RA1 || row?.rA1 || "",
        RA2: field === "RA2" ? value : row?.RA2 || row?.rA2 || "",
        RA3: field === "RA3" ? value : row?.RA3 || row?.rA3 || "",
        RA4: field === "RA4" ? value : row?.RA4 || row?.rA4 || "",
      };

      console.log("Updating ALL:", payload);

      await apiService.post("/Employee/UpdateReportingMatrix", payload);

      fetchReportingHistory(reportingFormData.EmpCode);
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  // const updateReportingField = async (field: string, value: string) => {
  //   try {
  //     const payload = {
  //       EmpCode: reportingFormData.EmpCode,
  //       RequestType: reportingFormData.RequestType,
  //       RA2: field === "RA2" ? value : reportingFormData.RA2,
  //       RA3: field === "RA3" ? value : reportingFormData.RA3,
  //       RA4: field === "RA4" ? value : reportingFormData.RA4
  //     };

  //     console.log("Updating:", payload);

  //     const response = await apiService.post("/Employee/UpdateReportingMatrix", payload);

  //     if (response?.message === "Updated Successfully") {
  //       console.log("Updated Successfully");
  //     } else {
  //       console.warn("Update failed");
  //     }
  //   } catch (err) {
  //     console.error("Update error:", err);
  //   }
  // };

  const fetchRAsByRequestType = async (
    empCode: string,
    requestType: string,
  ) => {
    try {
      const res = await apiService.get(
        `/Employee/GetRAsByRequestType?empCode=${empCode}&requestType=${encodeURIComponent(
          requestType,
        )}`,
      );

      console.log("RA API Response:", res);

      // ✅ HANDLE BOTH ARRAY + OBJECT
      if (Array.isArray(res) && res.length > 0) {
        const data = res[0];

        setReportingFormData((prev) => ({
          ...prev,
          // RA1: data.RA1 || "",
          RA2: data.RA2 || "",
          RA3: data.RA3 || "",
          RA4: data.RA4 || "",
        }));
      } else {
        console.warn("No RA data found");
      }
    } catch (err) {
      console.error("Error fetching RAs:", err);
    }
  };

  const handleReportingInputChange = (e: any) => {
    const { name, value } = e.target;
    setReportingFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveReportingMatrix = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportingLoading(true);
    try {
      const response = await apiService.saveReportingMatrix(reportingFormData);
      if (
        response === "Saved Successfully" ||
        response?.message === "Saved Successfully"
      ) {
        alert("Reporting matrix saved successfully");
        fetchReportingHistory(reportingFormData.EmpCode);
        // Reset form but keep EmpCode
        setReportingFormData((prev) => ({
          Id: 0,
          EmpCode: prev.EmpCode,
          RequestType: "",
          RA1: formData._RequestTo || "",
          RA2: "",
          RA3: "",
          RA4: "",
        }));
      } else {
        alert(
          "Failed to save reporting matrix: " +
          (typeof response === "string"
            ? response
            : JSON.stringify(response)),
        );
      }
    } catch (error: any) {
      console.error("Error saving reporting matrix:", error);
      alert("An error occurred: " + error.message);
    } finally {
      setReportingLoading(false);
    }
  };

  // Each box filters only its own field, independently (AND across boxes,
  // empty box = no constraint from that field) - no more one merged text
  // match where a department hit and a designation hit looked identical.
  // Code/name is the one exception: an employee is found by either, so
  // that single box matches against both (OR between the two, still AND
  // with the other three boxes).
  const filteredEmployees = employees.filter((emp) => {
    const codeOrName = String(codeOrNameSearch ?? "").trim().toLowerCase();
    const deptFilter = String(deptSearch ?? "").trim().toLowerCase();
    const desigFilter = String(desigSearch ?? "").trim().toLowerCase();
    const branchFilter = String(branchSearch ?? "").trim().toLowerCase();

    const empName = String(emp.name ?? "").toLowerCase();
    const empCode = String(emp.code ?? "").toLowerCase();
    const empDept = String(emp.dept ?? "").toLowerCase();
    const empDesig = String(emp.desig ?? "").toLowerCase();
    const empBranch = String(emp.branch ?? "").toLowerCase();

    const matchesCodeOrName =
      !codeOrName ||
      empName.includes(codeOrName) ||
      empCode.includes(codeOrName);

    return (
      matchesCodeOrName &&
      empDept.includes(deptFilter) &&
      empDesig.includes(desigFilter) &&
      empBranch.includes(branchFilter)
    );
  });

  if (loading) {
    return (
      <div className="ep-container ep-loading-screen">
        <div className="loader"></div>
        <p className="ep-loading-text">Loading...</p>
      </div>
    );
  }

  if (!userData)
    return (
      <div className="ep-container">
        <p style={{ padding: "20px" }}>No user data found.</p>
      </div>
    );

  const InfoItem = ({ icon: Icon, label, value }: any) => {
    let displayValue = "--";
    if (value !== null && value !== undefined) {
      if (typeof value !== "object") {
        const s = String(value).trim();
        if (s !== "" && s !== "null" && s !== "undefined") {
          displayValue = s;
        }
      }
    }

    return (
      <div className="ep-info-item">
        <div className="ep-icon-box">
          <Icon size={18} />
        </div>
        <div className="ep-label-value">
          <span className="ep-label">{label}</span>
          <span className="ep-value">{displayValue}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="ep-container" ref={containerRef}>
      {/* Modern Executive Profile Hero Header */}
      <header className="ep-profile-hero">
        <div className="ep-profile-hero-inner">
          {/* Avatar Section */}
          <div
            className="ep-avatar-container"
            onClick={() => {
              setImageModalTab("idcard");
              setShowImageProfileModal(true);
            }}
            title="Click here to open Official ID Card & Profile Overview"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setImageModalTab("idcard");
                setShowImageProfileModal(true);
              }
            }}
          >
            <div className={`ep-avatar-box ${uploading ? "uploading" : ""} ep-avatar-box-interactive`}>
              <img
                src={
                  userData.profilePic ||
                  (userData.empCode ? `/images/Emp-Profile-Pics/${userData.empCode}.jpg` : "/images/avatar.png")
                }
                alt={userData.empName || "Employee Profile"}
                className="ep-avatar-img"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes("avatar.png")) {
                    target.src = "/images/avatar.png";
                  }
                }}
              />
              <span className="ep-avatar-badge-plus" title="Add / View Profile Details">
                <Plus size={18} strokeWidth={2.5} />
              </span>
            </div>
          </div>

          {/* Profile Details */}
          <div className="ep-hero-details">
            <div className="ep-hero-top-row">
              <div className="ep-hero-name-badge">
                <h1 className="ep-hero-name">
                  {typeof userData.empName === "object" ? "" : (userData.empName || "Employee Name")}
                </h1>
                {userData.status && (
                  <span className={`ep-status-badge ${String(userData.status ?? "").toLowerCase()}`}>
                    <span className="ep-status-dot"></span>
                    {typeof userData.status === "object" ? "" : userData.status}
                  </span>
                )}
              </div>

              <div className="ep-hero-role-row">
                <span className="ep-hero-designation">
                  {typeof userData.designation === "object" ? "" : (userData.designation || "Staff Member")}
                </span>
                {userData.department && (
                  <>
                    <span className="ep-hero-sep">•</span>
                    <span className="ep-hero-dept">
                      {typeof userData.department === "object" ? "" : userData.department}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Meta Info Bar (ID) */}
            <div className="ep-hero-meta-bar">
              <span className="ep-meta-chip ep-chip-id">
                <span className="ep-chip-label">ID:</span>
                <span>{typeof userData.empCode === "object" ? "" : (userData.empCode || "—")}</span>
              </span>
            </div>

            {/* Action Buttons */}
            <div className="ep-hero-actions">
              <button
                className="ep-hero-btn ep-btn-idcard"
                onClick={() => {
                  setImageModalTab("idcard");
                  setShowImageProfileModal(true);
                }}
                title="View Official Employee ID Card (Front & Back)"
              >
                <CreditCard size={15} />
                <span>ID Card</span>
              </button>

              <button
                className={`ep-hero-btn ep-btn-policies ${isNavigating ? "navigating" : ""}`}
                onClick={() => {
                  setIsNavigating(true);
                  setTimeout(() => {
                    history.push("/policies");
                  }, 300);
                }}
              >
                <FileText size={15} />
                <span>Policies</span>
              </button>

              <button
                className={`ep-hero-btn ep-btn-face ${isNavigating ? "navigating" : ""}`}
                onClick={() => {
                  setIsNavigating(true);
                  setTimeout(() => {
                    history.push("/ai-attendance-register");
                  }, 300);
                }}
              >
                <Camera size={15} />
                <span>Face Enrollment</span>
              </button>

              <button
                className="ep-hero-btn ep-btn-password"
                onClick={() => {
                  history.push("/change-password");
                }}
              >
                <span>🔐 Change Password</span>
              </button>

              {(loggedInUserType === "Admin" ||
                loggedInUserType === "ACCOUNTANT") && (
                  <>
                    <button
                      className="ep-hero-btn ep-btn-find"
                      onClick={() => setShowEmployeeSearch(true)}
                    >
                      <Users size={15} />
                      <span>Find</span>
                    </button>
                    <button
                      className="ep-hero-btn ep-btn-add"
                      onClick={openAddModal}
                    >
                      <PlusCircle size={15} />
                      <span>Add</span>
                    </button>
                  </>
                )}

              {!isManagementView && (
                <>
                  <button
                    type="button"
                    className="ep-hero-btn ep-btn-del"
                    onClick={() => history.push("/account-deletion")}
                  >
                    Account Deletion
                  </button>
                  <button
                    type="button"
                    className="ep-hero-btn ep-btn-logout"
                    onClick={handleLogout}
                  >
                    <LogOut size={15} />
                    <span>Logout</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="ep-content">
        {/* Unified Personal Details & App Settings Card */}
        <div className="ep-card">
          <div className="ep-card-header-with-settings">
            <h3 className="ep-card-title">
              <Info color="var(--ion-color-primary)" size={20} /> Personal Details
            </h3>

            <div className="ep-card-settings-group">
              <label className="ep-setting-pill" title="Toggle Dark Mode">
                {darkMode ? (
                  <Moon color="var(--ion-color-primary)" size={16} />
                ) : (
                  <Sun color="var(--ion-color-primary)" size={16} />
                )}
                <span>Dark Mode</span>
                <div className="ep-toggle-compact">
                  <input
                    type="checkbox"
                    checked={darkMode}
                    onChange={() => setDarkMode(!darkMode)}
                  />
                  <span className="ep-slider-compact"></span>
                </div>
              </label>

              <button
                type="button"
                className="ep-setting-pill clickable"
                onClick={() => setShowColorModal(true)}
                title="Change Theme Color"
              >
                <Palette color="var(--ion-color-primary)" size={16} />
                <span>Theme Color</span>
                <span
                  className="ep-setting-swatch"
                  style={{ backgroundColor: "var(--ion-color-primary)" }}
                ></span>
              </button>
            </div>
          </div>

          <div className="ep-info-grid">
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Fingerprint}
              label="Emp Code"
              value={userData.empCode}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={User}
              label="Name"
              value={userData.empName}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Droplet}
              label="Blood Group"
              value={userData.bloodGroup}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Phone}
              label="Mobile"
              value={userData.contactNumber}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={FileText}
              label="PAN"
              value={userData.pan}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={CreditCard}
              label="AADHAR"
              value={userData.aadhar}
            />
          </div>
        </div>

        {/* Professional Info */}
        <div className="ep-card">
          <h3 className="ep-card-title">
            <Briefcase color="var(--ion-color-primary)" size={20} />{" "}
            Professional Details
          </h3>
          <div className="ep-info-grid">
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Calendar}
              label="Joining Date"
              value={userData.doj}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Layout}
              label="Department"
              value={userData.department}
            />

            <InfoItem
              color="var(--ion-color-primary)"
              icon={Mail}
              label="Email"
              value={userData.email}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Mail}
              label="Secondary Email"
              value={userData.email2}
            />


            {/* <InfoItem icon={Clock} label="Available Leaves" value={userData.availableLeaves} /> */}
            {/* <InfoItem icon={TrendingUp} label="Unseen Credits" value={userData.unseenCredits} /> */}
            <InfoItem
              color="var(--ion-color-primary)"
              icon={FileText}
              label="PF No"
              value={userData.pfNo}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={ShieldCheck}
              label="ESI No"
              value={userData.esiNo}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={CreditCard}
              label="Bank Account"
              value={userData.salaryAccountNo}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Box}
              label="IFSC Code"
              value={userData.ifscCode}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Users}
              label="Report To"
              value={userData.ReportTO}
            />
          </div>
        </div>

        <div className="ep-card">
          <div className="ep-card-header">
            <h3 className="ep-card-title">
              <Clock color="var(--ion-color-primary)" size={20} />Leaves & Attendance Access
            </h3>
            {isManagementView && (
              <button className="ep-edit-icon-btn" onClick={openEditModal}>
                <Palette color="var(--ion-color-primary)" size={16} /> Edit
              </button>
            )}
          </div>

          <div className="ep-info-grid">

            <InfoItem
              icon={Clock}
              label="P Time"
              value={userData.p_time ? `${userData.p_time} Mins` : "-"}
            />

            <InfoItem
              icon={Clock}
              label="Check In"
              value={userData.checkIn}
            />

            <InfoItem
              icon={Users}
              label="Request To"
              value={userData.requestTo}
            />

            <InfoItem
              icon={ShieldCheck}
              label="User Group"
              value={userData.userGroup}
            />

            <InfoItem
              icon={TrendingUp}
              label="Day DA"
              value={userData.dayDA}
            />

            <InfoItem
              icon={TrendingUp}
              label="Hour DA"
              value={userData.hourDA}
            />

            <InfoItem
              icon={TrendingUp}
              label="DA per KM"
              value={userData.dAperKM}
            />

            <InfoItem
              icon={TrendingUp}
              label="TA per KM (Public Transport)"
              value={userData.tAperKM}
            />

            <InfoItem
              icon={TrendingUp}
              label="Team Allowance"
              value={userData.teamAllowance}
            />

            {/* Leave */}
            <InfoItem
              icon={TrendingUp}
              label="Allowed CL"
              value={userData.leave}
            />

            <InfoItem
              icon={TrendingUp}
              label="Allowed SL"
              value={userData.sick}
            />
          </div>
        </div>
        {/* Salary Details */}
        <div className="ep-card">
          <div className="ep-card-header">
            <h3 className="ep-card-title">
              <Wallet color="var(--ion-color-primary)" size={20} /> Salary
              Structure
            </h3>
            {isManagementView && (
              <button className="ep-edit-icon-btn" onClick={openEditModal}>
                <Palette color="var(--ion-color-primary)" size={16} /> Edit
              </button>
            )}
          </div>
          <div className="ep-info-grid">
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Wallet}
              label="Gross"
              value={userData.grossSalary}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={TrendingUp}
              label="Basic"
              value={userData.basicSalary}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={PlusCircle}
              label="HRA"
              value={userData.hra}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Layout}
              label="DA"
              value={userData.da}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Truck}
              label="Conveyance"
              value={userData.conveyance}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={Box}
              label="Others"
              value={userData.others}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={ShieldCheck}
              label="PF Deduction"
              value={userData.pf}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={PlusCircle}
              label="ESI Deduction"
              value={userData.esi}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={FileText}
              label="Prof Tax"
              value={userData.profTax}
            />
            <InfoItem
              color="var(--ion-color-primary)"
              icon={TrendingUp}
              label="Income Tax"
              value={userData.incomeTax}
            />
          </div>
        </div>

      </main>

      {/* Employee Selection Search Modal */}
      {showEmployeeSearch && (
        <div
          className="ep-overlay"
          onClick={() => setShowEmployeeSearch(false)}
        >
          <div
            className="ep-modal ep-modal-management"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ep-modal-handle"></div>
            <div className="ep-modal-header">
              <h3>Select Employee ({filteredEmployees.length})</h3>
              <button
                className="ep-close-btn"
                onClick={() => setShowEmployeeSearch(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="ep-search-controls">
              <div className="ep-search-row">
                <input
                  type="text"
                  placeholder="Search by code or name..."
                  value={codeOrNameSearch}
                  onChange={(e) => setCodeOrNameSearch(e.target.value)}
                  className="ep-search-input ep-search-input-compact"
                />
                <input
                  type="text"
                  placeholder="Search by department..."
                  value={deptSearch}
                  onChange={(e) => setDeptSearch(e.target.value)}
                  className="ep-search-input ep-search-input-compact"
                />
                <input
                  type="text"
                  placeholder="Search by designation..."
                  value={desigSearch}
                  onChange={(e) => setDesigSearch(e.target.value)}
                  className="ep-search-input ep-search-input-compact"
                />
                <input
                  type="text"
                  placeholder="Search by branch..."
                  value={branchSearch}
                  onChange={(e) => setBranchSearch(e.target.value)}
                  className="ep-search-input ep-search-input-compact"
                />
              </div>
              <div className="ep-status-toggle">
                <button
                  className={statusFilter === "Active" ? "active" : ""}
                  onClick={() => setStatusFilter("Active")}
                >
                  Active
                </button>
                <button
                  className={statusFilter === "InActive" ? "active" : ""}
                  onClick={() => setStatusFilter("InActive")}
                >
                  InActive
                </button>
              </div>
            </div>

            <div className="ep-employee-list">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp, index) => {
                  const name = typeof emp.name === "object" ? "" : String(emp.name ?? "");
                  const code = typeof emp.code === "object" ? "" : String(emp.code ?? "");
                  const dept = typeof emp.dept === "object" || !emp.dept ? "(no dept)" : String(emp.dept);
                  const desig = typeof emp.desig === "object" ? "" : String(emp.desig ?? "");
                  const branch = typeof emp.branch === "object" || !emp.branch ? "(no branch)" : String(emp.branch);

                  return (
                    <div
                      key={code || index}
                      className="ep-emp-list-item"
                      onClick={() => selectEmployee(code)}
                    >
                      <div className="ep-emp-initials">{index + 1}</div>
                      <div className="ep-emp-info">
                        <span className="ep-emp-name">{name}</span>
                        <span className="ep-emp-meta">
                          {code} • {dept} • {desig} • {branch}
                        </span>
                      </div>
                      <ChevronRight color="var(--ion-color-primary)" size={18} />
                    </div>
                  );
                })
              ) : (
                <div className="ep-no-results">No employees found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Image & Personal Details Card Modal */}
      {showImageProfileModal && (
        <div
          className="ep-overlay ep-image-modal-overlay"
          onClick={() => setShowImageProfileModal(false)}
        >
          <div
            className="ep-modal ep-profile-card-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ep-modal-handle"></div>

            {/* Modal Header */}
            <div className="ep-modal-header ep-profile-card-header">
              <div className="ep-profile-card-title-group">
                <span className="ep-profile-card-badge">Profile Card</span>
                <h3 className="ep-profile-card-heading">Employee Overview</h3>
              </div>
              <button
                className="ep-close-btn"
                onClick={() => setShowImageProfileModal(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Hero Profile Mini Header inside Card (shown only on Details and Upload tabs) */}
            {imageModalTab !== "idcard" && (
              <div className="ep-profile-card-hero">
                <div className="ep-profile-card-avatar-wrap">
                  <img
                    src={
                      userData.profilePic ||
                      (userData.empCode ? `/images/Emp-Profile-Pics/${userData.empCode}.jpg` : "/images/avatar.png")
                    }
                    alt={userData.empName || "Employee Profile"}
                    className="ep-profile-card-avatar-img"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.includes("avatar.png")) {
                        target.src = "/images/avatar.png";
                      }
                    }}
                  />
                </div>

                <div className="ep-profile-card-hero-meta">
                  <h4 className="ep-profile-card-name">
                    {typeof userData.empName === "object" ? "" : (userData.empName || "PALURI YESURAJU")}
                  </h4>
                  <div className="ep-profile-card-sub">
                    <span className="ep-profile-card-role">
                      {typeof userData.designation === "object" ? "" : (userData.designation || "Developer")}
                    </span>
                    {(userData.department || "IT") && (
                      <>
                        <span className="ep-hero-sep">•</span>
                        <span className="ep-profile-card-dept">
                          {typeof userData.department === "object" ? "" : (userData.department || "IT")}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="ep-profile-card-chips">
                    <span className="ep-profile-card-chip">
                      ID: <strong>{userData.empCode || "1614"}</strong>
                    </span>
                    <span className="ep-status-badge active">
                      <span className="ep-status-dot"></span>
                      {userData.status || "Active"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Options Tabs: ID Card | Personal Details | Upload Image */}
            <div className="ep-profile-card-options-nav ep-profile-card-options-nav-3">
              <button
                type="button"
                className={`ep-profile-option-btn ${imageModalTab === "idcard" ? "active" : ""}`}
                onClick={() => setImageModalTab("idcard")}
              >
                <CreditCard size={16} />
                <span>ID Card</span>
              </button>
              <button
                type="button"
                className={`ep-profile-option-btn ${imageModalTab === "details" ? "active" : ""}`}
                onClick={() => setImageModalTab("details")}
              >
                <Fingerprint size={16} />
                <span>Personal Details</span>
              </button>
              <button
                type="button"
                className={`ep-profile-option-btn ${imageModalTab === "upload" ? "active" : ""}`}
                onClick={() => setImageModalTab("upload")}
              >
                <Camera size={16} />
                <span>Upload Image</span>
              </button>
            </div>

            {/* Option 0: Official ID Card (Front & Back - 6cm x 9cm) */}
            {imageModalTab === "idcard" && (
              <div className="ep-idcard-content">
                {/* ID Card Sub-toolbar */}
                <div className="ep-idcard-toolbar">
                  <div className="ep-idcard-side-tabs">
                    <button
                      type="button"
                      className={`ep-idcard-side-btn ${idCardSide === "both" ? "active" : ""}`}
                      onClick={() => setIdCardSide("both")}
                    >
                      Both Slots (L805 Tray)
                    </button>
                    <button
                      type="button"
                      className={`ep-idcard-side-btn ${idCardSide === "front" ? "active" : ""}`}
                      onClick={() => setIdCardSide("front")}
                    >
                      Slot 1: Front
                    </button>
                    <button
                      type="button"
                      className={`ep-idcard-side-btn ${idCardSide === "back" ? "active" : ""}`}
                      onClick={() => setIdCardSide("back")}
                    >
                      Slot 2: Back
                    </button>
                  </div>

                  <div className="ep-idcard-toolbar-controls">
                    <button
                      type="button"
                      className="ep-idcard-toggle-mode-btn"
                      onClick={() => setCardOrientation(cardOrientation === "landscape" ? "portrait" : "landscape")}
                      title="Switch between Landscape L805 Tray Mode and Portrait"
                    >
                      {cardOrientation === "landscape" ? "📐 L805 Tray (Horizontal)" : "📱 Portrait Mode"}
                    </button>

                    {cardOrientation === "landscape" && (
                      <button
                        type="button"
                        className="ep-idcard-rotate-btn"
                        onClick={() => setCardRotation(cardRotation === 90 ? 270 : 90)}
                        title="Toggle card rotation (90° or 270°)"
                      >
                        <RotateCw size={12} />
                        <span>{cardRotation}°</span>
                      </button>
                    )}

                    <div className="ep-idcard-dimensions-tag" title="Epson L805 Tray Template Coordinates">
                      <span>{cardOrientation === "landscape" ? "3.2cm – 11.8cm (9cm × 6cm Tray Slot)" : "6cm × 9cm (ID Card)"}</span>
                    </div>
                  </div>
                </div>

                {/* ID Cards Display Container */}
                <div className="ep-idcard-cards-container">
                  {/* FRONT CARD (Slot 1) */}
                  <div
                    className={`ep-idcard-item ${idCardSide === "back" ? "ep-screen-hidden" : ""}`}
                  >
                    {cardOrientation === "landscape" ? (
                      <div className="ep-tray-slot-wrapper">
                        <div className="ep-tray-slot-header">
                          <span className="ep-tray-slot-name">Slot 1 &bull; Front Card</span>
                          <span className="ep-tray-slot-coord">3.2 cm – 11.8 cm</span>
                        </div>
                        <div className="ep-tray-physical-slot">
                          {/* 2 Eject Holes as shown in user physical tray photo */}
                          <div className="ep-tray-hole hole-left" title="Card Eject Hole 1" />
                          <div className="ep-tray-hole hole-right" title="Card Eject Hole 2" />

                          <div
                            ref={frontCardRef}
                            className="ep-tray-card-landscape"
                          >
                            <div
                              className="ep-idcard-frame ep-idcard-front-frame"
                              style={{
                                width: "6cm",
                                height: "9cm",
                                transform: `rotate(${cardRotation}deg)`,
                                transformOrigin: "center center",
                                backgroundImage: `url(${idCardFrontClean})`,
                              }}
                            >
                              {/* Employee Profile Photo Frame inside Circle */}
                              <div className="ep-idcard-avatar-wrap">
                                <img
                                  src={
                                    userData.profilePic ||
                                    (userData.empCode
                                      ? `/images/Emp-Profile-Pics/${userData.empCode}.jpg`
                                      : "/images/avatar.png")
                                  }
                                  alt={userData.empName || "Employee"}
                                  className="ep-idcard-avatar-img"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    if (!target.src.includes("avatar.png")) {
                                      target.src = "/images/avatar.png";
                                    }
                                  }}
                                />
                              </div>

                              {/* Employee Name */}
                              <div className="ep-idcard-name" title={userData.empName || "PALURI YESURAJU"}>
                                {userData.empName || "PALURI YESURAJU"}
                              </div>

                              {/* Employee Designation */}
                              <div className="ep-idcard-desig" title={userData.designation || "DEVELOPER"}>
                                {(userData.designation || "DEVELOPER").toUpperCase()}
                              </div>

                              {/* Details Rows (EMP. ID, DOJ, Blood Group) */}
                              <div className="ep-idcard-fields-block">
                                <div className="ep-idcard-row">
                                  <span className="ep-idcard-field-key">EMP. ID</span>
                                  <span className="ep-idcard-colon">:</span>
                                  <span className="ep-idcard-field-val">
                                    {userData.empCode
                                      ? String(userData.empCode).startsWith("DBS")
                                        ? String(userData.empCode)
                                        : `DBS${userData.empCode}`
                                      : "DBS1614"}
                                  </span>
                                </div>
                                <div className="ep-idcard-row">
                                  <span className="ep-idcard-field-key">DOJ</span>
                                  <span className="ep-idcard-colon">:</span>
                                  <span className="ep-idcard-field-val">
                                    {formatCardDOJ(userData.doj || userData.joiningDate)}
                                  </span>
                                </div>
                                <div className="ep-idcard-row">
                                  <span className="ep-idcard-field-key">Blood Group</span>
                                  <span className="ep-idcard-colon">:</span>
                                  <span className="ep-idcard-field-val">
                                    {userData.bloodGroup || "A-"}
                                  </span>
                                </div>
                              </div>

                              {/* Phone Row */}
                              <div className="ep-idcard-phone-row">
                                <span className="ep-idcard-phone-bubble">
                                  <Phone size={8} strokeWidth={2.5} />
                                </span>
                                <span className="ep-idcard-phone-val">
                                  {userData.contactNumber || "9866992847"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="ep-idcard-label-badge">Front Side &bull; Slot 1</div>
                        <div
                          ref={frontCardRef}
                          className="ep-idcard-frame ep-idcard-front-frame"
                          style={{ backgroundImage: `url(${idCardFrontClean})` }}
                        >
                          <div className="ep-idcard-avatar-wrap">
                            <img
                              src={
                                userData.profilePic ||
                                (userData.empCode
                                  ? `/images/Emp-Profile-Pics/${userData.empCode}.jpg`
                                  : "/images/avatar.png")
                              }
                              alt={userData.empName || "Employee"}
                              className="ep-idcard-avatar-img"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (!target.src.includes("avatar.png")) {
                                  target.src = "/images/avatar.png";
                                }
                              }}
                            />
                          </div>

                          <div className="ep-idcard-name" title={userData.empName || "PALURI YESURAJU"}>
                            {userData.empName || "PALURI YESURAJU"}
                          </div>

                          <div className="ep-idcard-desig" title={userData.designation || "DEVELOPER"}>
                            {(userData.designation || "DEVELOPER").toUpperCase()}
                          </div>

                          <div className="ep-idcard-fields-block">
                            <div className="ep-idcard-row">
                              <span className="ep-idcard-field-key">EMP. ID</span>
                              <span className="ep-idcard-colon">:</span>
                              <span className="ep-idcard-field-val">
                                {userData.empCode
                                  ? String(userData.empCode).startsWith("DBS")
                                    ? String(userData.empCode)
                                    : `DBS${userData.empCode}`
                                  : "DBS1614"}
                              </span>
                            </div>
                            <div className="ep-idcard-row">
                              <span className="ep-idcard-field-key">DOJ</span>
                              <span className="ep-idcard-colon">:</span>
                              <span className="ep-idcard-field-val">
                                {formatCardDOJ(userData.doj || userData.joiningDate)}
                              </span>
                            </div>
                            <div className="ep-idcard-row">
                              <span className="ep-idcard-field-key">Blood Group</span>
                              <span className="ep-idcard-colon">:</span>
                              <span className="ep-idcard-field-val">
                                {userData.bloodGroup || "A-"}
                              </span>
                            </div>
                          </div>

                          <div className="ep-idcard-phone-row">
                            <span className="ep-idcard-phone-bubble">
                              <Phone size={8} strokeWidth={2.5} />
                            </span>
                            <span className="ep-idcard-phone-val">
                              {userData.contactNumber || "9866992847"}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* BACK CARD (Slot 2) */}
                  <div
                    className={`ep-idcard-item ${idCardSide === "front" ? "ep-screen-hidden" : ""}`}
                  >
                    {cardOrientation === "landscape" ? (
                      <div className="ep-tray-slot-wrapper">
                        <div className="ep-tray-slot-header">
                          <span className="ep-tray-slot-name">Slot 2 &bull; Back Card</span>
                          <span className="ep-tray-slot-coord">3.2 cm – 11.8 cm</span>
                        </div>
                        <div className="ep-tray-physical-slot">
                          {/* 2 Eject Holes as shown in user physical tray photo */}
                          <div className="ep-tray-hole hole-left" title="Card Eject Hole 1" />
                          <div className="ep-tray-hole hole-right" title="Card Eject Hole 2" />

                          <div
                            ref={backCardRef}
                            className="ep-tray-card-landscape"
                          >
                            <div
                              className="ep-idcard-frame ep-idcard-back-frame"
                              style={{
                                width: "6cm",
                                height: "9cm",
                                transform: `rotate(${cardRotation}deg)`,
                                transformOrigin: "center center",
                                backgroundImage: `url(${idCardBack})`,
                              }}
                            >
                              {/* Scannable Barcode / QR Code inside top white square */}
                              <div className="ep-idcard-qr-box">
                                {qrCodeUrl ? (
                                  <img
                                    src={qrCodeUrl}
                                    alt={`Scannable details for ${userData.empName || "Employee"}`}
                                    className="ep-idcard-qr-image"
                                  />
                                ) : (
                                  <div className="ep-idcard-qr-placeholder">
                                    <QrCode size={34} color="#0077b6" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="ep-idcard-label-badge">Back Side &bull; Slot 2</div>
                        <div
                          ref={backCardRef}
                          className="ep-idcard-frame ep-idcard-back-frame"
                          style={{ backgroundImage: `url(${idCardBack})` }}
                        >
                          <div className="ep-idcard-qr-box">
                            {qrCodeUrl ? (
                              <img
                                src={qrCodeUrl}
                                alt={`Scannable details for ${userData.empName || "Employee"}`}
                                className="ep-idcard-qr-image"
                              />
                            ) : (
                              <div className="ep-idcard-qr-placeholder">
                                <QrCode size={34} color="#0077b6" />
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* ID Card Actions */}
                <div className="ep-idcard-actions-panel">
                  <div className="ep-idcard-scan-hint">
                    <QrCode size={15} />
                    <span>Scan QR Code on back to view full employee details</span>
                    <span className="ep-idcard-tray-pill">
                      {cardOrientation === "landscape"
                        ? "L805 Tray: 3.2cm – 11.8cm (9cm × 6cm) • 2 Holes Align"
                        : "Standard 6cm × 9cm (ID Card)"}
                    </span>
                  </div>

                  <div className="ep-idcard-buttons-row">
                    {idCardSide === "front" && (
                      <>
                        <button
                          type="button"
                          className="ep-idcard-btn primary"
                          onClick={() => handleDownloadCard("front", "landscape", "jpg")}
                          disabled={downloadingCard !== null}
                          title="Download high-resolution Front Card for Epson L805 Tray (Landscape JPG)"
                        >
                          {downloadingCard === "front_landscape_jpg" ? (
                            <Loader2 size={14} className="ep-spin" />
                          ) : (
                            <Download size={14} />
                          )}
                          <span>
                            {downloadingCard === "front_landscape_jpg"
                              ? "Downloading..."
                              : "Download Front (Epson L805 Tray • JPG)"}
                          </span>
                        </button>

                        <button
                          type="button"
                          className="ep-idcard-btn secondary"
                          onClick={() => handleDownloadCard("front", "landscape", "png")}
                          disabled={downloadingCard !== null}
                          title="Download Front Card for Epson L805 Tray (Landscape PNG)"
                        >
                          {downloadingCard === "front_landscape_png" ? (
                            <Loader2 size={14} className="ep-spin" />
                          ) : (
                            <Download size={14} />
                          )}
                          <span>
                            {downloadingCard === "front_landscape_png"
                              ? "Downloading..."
                              : "PNG (L805 Tray)"}
                          </span>
                        </button>

                        <button
                          type="button"
                          className="ep-idcard-btn secondary"
                          onClick={() => handleDownloadCard("front", "portrait", "jpg")}
                          disabled={downloadingCard !== null}
                          title="Download Portrait 6cm × 9cm Front Card"
                        >
                          {downloadingCard === "front_portrait_jpg" ? (
                            <Loader2 size={14} className="ep-spin" />
                          ) : (
                            <Download size={14} />
                          )}
                          <span>Portrait (6cm × 9cm)</span>
                        </button>

                        <button
                          type="button"
                          className="ep-idcard-btn secondary"
                          onClick={() => handlePrintIdCards("front")}
                          title="Print Front Card directly onto Epson L805 Tray Slot 1"
                        >
                          <Printer size={14} />
                          <span>Print Front (L805 Slot 1)</span>
                        </button>

                        <button
                          type="button"
                          className="ep-idcard-btn nav-side"
                          onClick={() => setIdCardSide("back")}
                          title="Go to Backside Card (Slot 2)"
                        >
                          <span>Slot 2: Backside</span>
                          <ArrowRight size={13} />
                        </button>
                      </>
                    )}

                    {idCardSide === "back" && (
                      <>
                        <button
                          type="button"
                          className="ep-idcard-btn primary"
                          onClick={() => handleDownloadCard("back", "landscape", "jpg")}
                          disabled={downloadingCard !== null}
                          title="Download high-resolution Backside Card for Epson L805 Tray (Landscape JPG)"
                        >
                          {downloadingCard === "back_landscape_jpg" ? (
                            <Loader2 size={14} className="ep-spin" />
                          ) : (
                            <Download size={14} />
                          )}
                          <span>
                            {downloadingCard === "back_landscape_jpg"
                              ? "Downloading..."
                              : "Download Back (Epson L805 Tray • JPG)"}
                          </span>
                        </button>

                        <button
                          type="button"
                          className="ep-idcard-btn secondary"
                          onClick={() => handleDownloadCard("back", "landscape", "png")}
                          disabled={downloadingCard !== null}
                          title="Download Backside Card for Epson L805 Tray (Landscape PNG)"
                        >
                          {downloadingCard === "back_landscape_png" ? (
                            <Loader2 size={14} className="ep-spin" />
                          ) : (
                            <Download size={14} />
                          )}
                          <span>
                            {downloadingCard === "back_landscape_png"
                              ? "Downloading..."
                              : "PNG (L805 Tray)"}
                          </span>
                        </button>

                        <button
                          type="button"
                          className="ep-idcard-btn secondary"
                          onClick={() => handleDownloadCard("back", "portrait", "jpg")}
                          disabled={downloadingCard !== null}
                          title="Download Portrait 6cm × 9cm Backside Card"
                        >
                          {downloadingCard === "back_portrait_jpg" ? (
                            <Loader2 size={14} className="ep-spin" />
                          ) : (
                            <Download size={14} />
                          )}
                          <span>Portrait (6cm × 9cm)</span>
                        </button>

                        <button
                          type="button"
                          className="ep-idcard-btn secondary"
                          onClick={() => handlePrintIdCards("back")}
                          title="Print Backside Card directly onto Epson L805 Tray Slot 2"
                        >
                          <Printer size={14} />
                          <span>Print Backside (L805 Slot 2)</span>
                        </button>

                        <button
                          type="button"
                          className="ep-idcard-btn nav-side"
                          onClick={() => setIdCardSide("front")}
                          title="Go to Front Card (Slot 1)"
                        >
                          <ArrowLeft size={13} />
                          <span>Slot 1: Front</span>
                        </button>
                      </>
                    )}

                    {idCardSide === "both" && (
                      <>
                        <button
                          type="button"
                          className="ep-idcard-btn primary"
                          onClick={() => handlePrintIdCards("both")}
                          title="Print Both Sides formatted for Epson L805 2-Slot Tray (3.2cm - 11.8cm)"
                        >
                          <Printer size={14} />
                          <span>Print Both (L805 Tray • Slot 1 & 2)</span>
                        </button>

                        <button
                          type="button"
                          className="ep-idcard-btn secondary"
                          onClick={() => handleDownloadCard("front", "landscape", "jpg")}
                          disabled={downloadingCard !== null}
                          title="Download Front Card for Epson L805 Tray (Landscape JPG)"
                        >
                          {downloadingCard === "front_landscape_jpg" ? (
                            <Loader2 size={14} className="ep-spin" />
                          ) : (
                            <Download size={14} />
                          )}
                          <span>Download Front (L805 Tray)</span>
                        </button>

                        <button
                          type="button"
                          className="ep-idcard-btn secondary"
                          onClick={() => handleDownloadCard("back", "landscape", "jpg")}
                          disabled={downloadingCard !== null}
                          title="Download Back Card for Epson L805 Tray (Landscape JPG)"
                        >
                          {downloadingCard === "back_landscape_jpg" ? (
                            <Loader2 size={14} className="ep-spin" />
                          ) : (
                            <Download size={14} />
                          )}
                          <span>Download Back (L805 Tray)</span>
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      className="ep-idcard-btn subtle"
                      onClick={() => setShowScannedDataPreview(!showScannedDataPreview)}
                    >
                      <Eye size={14} />
                      <span>{showScannedDataPreview ? "Hide Data" : "Preview Scanned Data"}</span>
                    </button>
                  </div>

                  {showScannedDataPreview && (
                    <div className="ep-idcard-scanned-preview-box">
                      <div className="ep-scanned-preview-title">
                        <span>Data Encoded in Barcode / QR Code:</span>
                        <button
                          type="button"
                          className="ep-scanned-copy-btn"
                          onClick={() => {
                            const empCodeDisplay = userData.empCode
                              ? String(userData.empCode).startsWith("DBS")
                                ? String(userData.empCode)
                                : `DBS${userData.empCode}`
                              : "DBS1614";
                            const text = `Designation: ${(userData.designation || "DEVELOPER").toUpperCase()}
DbasesolutionsPVT.LTD
Contact Details: ${userData.contactNumber || "9866992847"}
Email: ${userData.email || "support@dbasesolutions.in"}
Address: D.No. 16-58/33, Sai Sadan, Sri Sairam Nagar, Hanuman Nagar, Eluru - 534001, Eluru Dist, A.P, India.
Employee: ${userData.empName || "PALURI YESURAJU"}
Emp ID: ${empCodeDisplay}
DOJ: ${formatCardDOJ(userData.doj || userData.joiningDate)}
Blood Group: ${userData.bloodGroup || "AB-"}
Website: https://dbasesolutions.in/`;
                            navigator.clipboard.writeText(text);
                            setCopiedField("scannedQr");
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                        >
                          {copiedField === "scannedQr" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                          <span>{copiedField === "scannedQr" ? "Copied" : "Copy Details"}</span>
                        </button>
                      </div>
                      <pre className="ep-scanned-preview-code">
{`Designation: ${(userData.designation || "DEVELOPER").toUpperCase()}
Company: Dbasesolutions PVT. LTD
Contact Details: ${userData.contactNumber || "9866992847"}
Email: ${userData.email || "support@dbasesolutions.in"}
Address: D.No. 16-58/33, Sai Sadan, Sri Sairam Nagar, Hanuman Nagar, Eluru - 534001, Eluru Dist, A.P, India.
Employee: ${userData.empName || "PALURI YESURAJU"}
Emp ID: ${
  userData.empCode
    ? String(userData.empCode).startsWith("DBS")
      ? String(userData.empCode)
      : `DBS${userData.empCode}`
    : "DBS1614"
}
DOJ: ${formatCardDOJ(userData.doj || userData.joiningDate)}
Blood Group: ${userData.bloodGroup || "AB-"}
Website: https://dbasesolutions.in/`}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Option 1: Personal Details */}
            {imageModalTab === "details" && (
              <div className="ep-profile-details-content">
                <div className="ep-profile-details-grid">
                  {/* Emp Code */}
                  <div className="ep-detail-tile">
                    <div className="ep-detail-icon">
                      <Fingerprint size={17} />
                    </div>
                    <div className="ep-detail-info">
                      <span className="ep-detail-label">Emp Code</span>
                      <span className="ep-detail-value">{userData.empCode || "1614"}</span>
                    </div>
                    <button
                      type="button"
                      className="ep-detail-copy-btn"
                      title="Copy Emp Code"
                      onClick={() => handleCopyValue("empCode", userData.empCode || "1614")}
                    >
                      {copiedField === "empCode" ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    </button>
                  </div>

                  {/* Name */}
                  <div className="ep-detail-tile">
                    <div className="ep-detail-icon">
                      <User size={17} />
                    </div>
                    <div className="ep-detail-info">
                      <span className="ep-detail-label">Name</span>
                      <span className="ep-detail-value">{userData.empName || "PALURI YESURAJU"}</span>
                    </div>
                    <button
                      type="button"
                      className="ep-detail-copy-btn"
                      title="Copy Name"
                      onClick={() => handleCopyValue("empName", userData.empName || "PALURI YESURAJU")}
                    >
                      {copiedField === "empName" ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    </button>
                  </div>

                  {/* Blood Group */}
                  <div className="ep-detail-tile">
                    <div className="ep-detail-icon ep-icon-blood">
                      <Droplet size={17} />
                    </div>
                    <div className="ep-detail-info">
                      <span className="ep-detail-label">Blood Group</span>
                      <span className="ep-detail-value ep-blood-badge">{userData.bloodGroup || "AB-"}</span>
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="ep-detail-tile">
                    <div className="ep-detail-icon">
                      <Phone size={17} />
                    </div>
                    <div className="ep-detail-info">
                      <span className="ep-detail-label">Mobile</span>
                      <a
                        href={`tel:${userData.contactNumber || "9866992847"}`}
                        className="ep-detail-value ep-link-value"
                      >
                        {userData.contactNumber || "9866992847"}
                      </a>
                    </div>
                    <button
                      type="button"
                      className="ep-detail-copy-btn"
                      title="Copy Mobile"
                      onClick={() => handleCopyValue("mobile", userData.contactNumber || "9866992847")}
                    >
                      {copiedField === "mobile" ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    </button>
                  </div>

                  {/* PAN */}
                  <div className="ep-detail-tile">
                    <div className="ep-detail-icon">
                      <FileText size={17} />
                    </div>
                    <div className="ep-detail-info">
                      <span className="ep-detail-label">PAN</span>
                      <span className="ep-detail-value ep-mono-value">{userData.pan || "CRVPP5881Q"}</span>
                    </div>
                    <button
                      type="button"
                      className="ep-detail-copy-btn"
                      title="Copy PAN"
                      onClick={() => handleCopyValue("pan", userData.pan || "CRVPP5881Q")}
                    >
                      {copiedField === "pan" ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    </button>
                  </div>

                  {/* AADHAR */}
                  <div className="ep-detail-tile">
                    <div className="ep-detail-icon">
                      <CreditCard size={17} />
                    </div>
                    <div className="ep-detail-info">
                      <span className="ep-detail-label">AADHAR</span>
                      <span className="ep-detail-value ep-mono-value">{userData.aadhar || "832072843977"}</span>
                    </div>
                    <button
                      type="button"
                      className="ep-detail-copy-btn"
                      title="Copy AADHAR"
                      onClick={() => handleCopyValue("aadhar", userData.aadhar || "832072843977")}
                    >
                      {copiedField === "aadhar" ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div className="ep-profile-details-actions">
                  <button
                    type="button"
                    className="ep-profile-action-btn primary"
                    onClick={() => {
                      setImageModalTab("upload");
                      setTimeout(() => modalFileInputRef.current?.click(), 100);
                    }}
                  >
                    <Camera size={15} />
                    <span>Upload New Photo</span>
                  </button>
                  <button
                    type="button"
                    className="ep-profile-action-btn secondary"
                    onClick={() => setShowImageProfileModal(false)}
                  >
                    <span>Close</span>
                  </button>
                </div>
              </div>
            )}

            {/* Option 2: Upload Image */}
            {imageModalTab === "upload" && (
              <div className="ep-profile-upload-content">
                <input
                  type="file"
                  ref={modalFileInputRef}
                  accept="image/*"
                  onChange={(e) => {
                    handleImageUpload(e);
                  }}
                  disabled={uploading}
                  className="ep-hidden-input"
                />

                <div
                  className={`ep-profile-upload-dropzone ${uploading ? "uploading" : ""}`}
                  onClick={() => !uploading && modalFileInputRef.current?.click()}
                >
                  <div className="ep-upload-dropzone-preview">
                    <img
                      src={
                        userData.profilePic ||
                        (userData.empCode ? `/images/Emp-Profile-Pics/${userData.empCode}.jpg` : "/images/avatar.png")
                      }
                      alt={userData.empName || "Profile Preview"}
                      className="ep-upload-current-avatar"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (!target.src.includes("avatar.png")) {
                          target.src = "/images/avatar.png";
                        }
                      }}
                    />
                    <div className="ep-upload-icon-bubble">
                      {uploading ? (
                        <Loader2 className="ep-spin" size={16} />
                      ) : (
                        <Upload size={16} />
                      )}
                    </div>
                  </div>

                  <h5 className="ep-upload-title">
                    {uploading ? "Uploading photo..." : "Upload Profile Photo"}
                  </h5>
                  <p className="ep-upload-desc">
                    {uploading
                      ? "Please wait while your image is being uploaded and saved..."
                      : "Click here or browse from your device to select a new profile photo."}
                  </p>

                  <button
                    type="button"
                    className="ep-upload-select-btn"
                    disabled={uploading}
                    onClick={(e) => {
                      e.stopPropagation();
                      modalFileInputRef.current?.click();
                    }}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="ep-spin" size={15} />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Camera size={15} />
                        <span>Choose Photo</span>
                      </>
                    )}
                  </button>

                  <span className="ep-upload-footnote">
                    Supports JPG, PNG or WEBP (Max 5MB)
                  </span>
                </div>

                <div className="ep-profile-details-actions">
                  <button
                    type="button"
                    className="ep-profile-action-btn secondary"
                    onClick={() => setImageModalTab("details")}
                  >
                    <ChevronRight size={15} style={{ transform: "rotate(180deg)" }} />
                    <span>Back to Personal Details</span>
                  </button>
                  <button
                    type="button"
                    className="ep-profile-action-btn secondary"
                    onClick={() => setShowImageProfileModal(false)}
                  >
                    <span>Close</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Theme Color Selection Bottom Sheet */}
      {showColorModal && (
        <div className="ep-overlay" onClick={() => setShowColorModal(false)}>
          <div className="ep-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ep-modal-handle"></div>
            <div className="ep-modal-header">
              <h3>Accent Color</h3>
              <button
                className="ep-close-btn"
                onClick={() => setShowColorModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="ep-color-grid">
              {themeColors.map(({ name, value, id }) => (
                <div key={id} className="ep-color-item">
                  <button
                    className={`ep-color-btn ${themeId === id ? "active" : ""}`}
                    style={{ backgroundColor: value }}
                    onClick={() => changeThemeColor(id)}
                  >
                    {themeId === id && (
                      <CheckCircle2
                        color="var(--ion-color-primary)"
                        size={24}
                      />
                    )}
                  </button>
                  <span className="ep-color-name">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Employee Registration Modal */}
      {showRegisterModal && (
        <div className="ep-overlay" onClick={() => setShowRegisterModal(false)}>
          <div
            className="ep-modal ep-modal-large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ep-modal-handle"></div>
            <div className="ep-modal-header">
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <button
                  className="ep-close-btn"
                  onClick={() => setShowRegisterModal(false)}
                >
                  <ArrowLeft size={20} />
                </button>
                <h3>
                  {isEditMode
                    ? "Update Employee Profile"
                    : "Register New Employee"}
                </h3>
              </div>
              <button
                className="ep-close-btn"
                onClick={() => setShowRegisterModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form className="ep-form" onSubmit={handleRegister}>
              <div className="ep-form-scrollable">
                {/* Personal Section */}
                <h4 className="ep-form-section-title">Personal Details</h4>
                <div className="ep-form-grid">

                  {/* Employee Code */}
                  <div className="ep-input-group">
                    <label>Employee Code*</label>
                    <input
                      name="_Ecode"
                      value={formData._Ecode}
                      onChange={handleInputChange}
                      required
                      disabled={isEditMode}
                    />
                  </div>

                  {/* Employee Name */}
                  <div className="ep-input-group">
                    <label>Employee Name*</label>
                    <input
                      name="_Ename"
                      value={formData._Ename}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  {/* DOB */}
                  <div className="ep-input-group">
                    <label>DOB*</label>
                    <input
                      type="date"
                      name="_Dob"
                      value={formData._Dob}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  {/* Blood Group */}
                  <div className="ep-input-group">
                    <label>Blood Group*</label>
                    <select
                      name="_Blood"
                      value={formData._Blood}
                      onChange={handleInputChange}
                      required
                      className="ep-select"
                    >
                      <option value="">Select Blood Group</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>

                  {/* Mobile */}
                  <div className="ep-input-group">
                    <label>Mobile*</label>
                    <input
                      type="tel"
                      name="_Mobile"
                      value={formData._Mobile}
                      onChange={handleInputChange}
                      required
                      maxLength={10}
                    />
                  </div>

                  {/* PAN */}
                  <div className="ep-input-group">
                    <label>PAN*</label>
                    <input
                      name="_PanNo"
                      value={formData._PanNo}
                      onChange={handleInputChange}
                      required
                      maxLength={10}
                      style={{ textTransform: "uppercase" }}
                    />
                  </div>

                  {/* AADHAR */}
                  <div className="ep-input-group">
                    <label>AADHAR*</label>
                    <input
                      name="_AadharNo"
                      value={formData._AadharNo}
                      onChange={handleInputChange}
                      required
                      maxLength={12}
                    />
                  </div>

                </div>

                {/* Professional Section */}
                <h4 className="ep-form-section-title">Professional Details</h4>
                <div className="ep-form-grid">

                  {/* DOJ */}
                  <div className="ep-input-group">
                    <label>DOJ*</label>
                    <input
                      type="date"
                      name="_Doj"
                      value={formData._Doj}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  {/* Department */}
                  <div className="ep-input-group">
                    <label>Department*</label>
                    <select
                      name="_Dept"
                      value={formData._Dept}
                      onChange={handleInputChange}
                      required
                      className="ep-select"
                    >
                      <option value="">Select Department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Designation */}
                  <div className="ep-input-group">
                    <label>Designation*</label>
                    <select
                      name="_Desig"
                      value={formData._Desig}
                      onChange={handleInputChange}
                      required
                      className="ep-select"
                    >
                      <option value="">Select Designation</option>
                      {designations.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Official Email */}
                  <div className="ep-input-group">
                    <label>Official E-Mail*</label>
                    <input
                      type="email"
                      name="_Email"
                      value={formData._Email}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  {/* Secondary Email */}
                  <div className="ep-input-group">
                    <label>Secondary E-Mail</label>
                    <input
                      type="email"
                      name="_Email2"
                      value={formData._Email2}
                      onChange={handleInputChange}
                    />
                  </div>

                  {/* PF No */}
                  <div className="ep-input-group">
                    <label>PF No*</label>
                    <input
                      name="_PFNo"
                      value={formData._PFNo}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  {/* ESI No */}
                  <div className="ep-input-group">
                    <label>ESI No*</label>
                    <input
                      name="_ESINo"
                      value={formData._ESINo}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  {/* Request To */}
                  <div className="ep-input-group">
                    <label>Request To*</label>
                    <select
                      name="_RequestTo"
                      value={formData._RequestTo}
                      onChange={handleInputChange}
                      required
                      className="ep-select"
                    >
                      <option value="">Select Reporting Authority</option>
                      {designations.filter(d => d.active).map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* User Group */}
                  <div className="ep-input-group">
                    <label>User Group*</label>
                    <select
                      name="_user"
                      value={formData._user}
                      onChange={handleInputChange}
                      required
                      className="ep-select"
                    >
                      <option value="">Select User Group</option>
                      <option value="Admin">Admin</option>
                      <option value="Accountant">Accountant</option>
                      <option value="Employee">Employee</option>
                    </select>
                  </div>
                  {/* KEEP THESE AS IS 👇 */}

                  {/* Active Status */}
                  <div className="ep-input-group">
                    <label>Active Status</label>
                    <select
                      name="_IsActive"
                      value={formData._IsActive}
                      onChange={handleInputChange}
                      className="ep-select"
                    >
                      <option value="Y">Yes (Active)</option>
                      <option value="N">No (InActive)</option>
                    </select>
                  </div>
                  {/* Project */}
                  <div className="ep-input-group">
                    <label>Project</label>
                    <select
                      name="_Project"
                      value={formData._Project}
                      onChange={handleInputChange}
                      className="ep-select"
                    >
                      <option value="">Select Project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Location Type */}
                  <div className="ep-input-group">
                    <label>Location Type</label>
                    <select
                      name="_LocationType"
                      value={formData._LocationType}
                      onChange={handleInputChange}
                      className="ep-select"
                    >
                      <option value="">Select Location Type</option>
                      {locationTypes.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Branch - tbl_Branch.Branch, managed in Sources > Branches.
                      The posted field is still _Location1 because that is the
                      Tbl_Employee column name and the APP_Save_Empdetails
                      parameter; only the branch master was renamed. */}
                  <div className="ep-input-group">
                    <label>Branch</label>
                    <select
                      name="_Location1"
                      value={formData._Location1}
                      onChange={handleInputChange}
                      className="ep-select"
                    >
                      <option value="">Select Branch</option>
                      {branchNames.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Branch Dept - the depts recorded against the branch
                      selected above, edited per branch in Sources > Branches.
                      Falls back to every known dept when that branch has none
                      on record, and auto-fills when it has exactly one. The
                      option value is the NAME, not an id: Load_BranchDept
                      numbers rows with ROW_NUMBER, so ids shift whenever a
                      branch is added. */}
                  <div className="ep-input-group">
                    <label>Branch Dept</label>
                    <select
                      name="_BranchDept"
                      value={formData._BranchDept}
                      onChange={handleInputChange}
                      className="ep-select"
                    >
                      <option value="">Select Branch Dept</option>
                      {deptOptions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                      {/* keep a value that is no longer in the list visible
                          instead of silently blanking it */}
                      {formData._BranchDept &&
                        !deptOptions.some(
                          (d) =>
                            d.toLowerCase() ===
                            String(formData._BranchDept).trim().toLowerCase()
                        ) && (
                          <option value={formData._BranchDept}>
                            {formData._BranchDept}
                          </option>
                        )}
                    </select>
                  </div>

                </div>

                {/* Salary Section */}
                <h4 className="ep-form-section-title">Salary & Leave</h4>
                <div className="ep-form-grid">

                  {/* Gross Salary (MAIN INPUT) */}
                  <div className="ep-input-group">
                    <label>Gross Salary*</label>
                    <input
                      type="number"
                      name="_GrossSal"
                      value={formData._GrossSal}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  {/* Calculated Fields */}
                  <div className="ep-input-group">
                    <label>Basic</label>
                    <input value={formData._BasicSal} readOnly />
                  </div>

                  <div className="ep-input-group">
                    <label>HRA</label>
                    <input value={formData._HRA} readOnly />
                  </div>

                  <div className="ep-input-group">
                    <label>DA</label>
                    <input value={formData._DA} readOnly />
                  </div>

                  <div className="ep-input-group">
                    <label>Conveyance</label>
                    <input value={formData._LTA} readOnly />
                  </div>

                  <div className="ep-input-group">
                    <label>Others</label>
                    <input value={formData._ALLOWANCES} readOnly />
                  </div>

                  {/* Deductions */}
                  <div className="ep-input-group">
                    <label>PF</label>
                    <input value={formData._PF} readOnly />
                  </div>

                  <div className="ep-input-group">
                    <label>ESI</label>
                    <input value={formData._Esi} readOnly />
                  </div>

                  <div className="ep-input-group">
                    <label>Professional Tax</label>
                    <input value={formData._Ptax} readOnly />
                  </div>

                  <div className="ep-input-group">
                    <label>Income Tax</label>
                    <input value={formData._Itax} readOnly />
                  </div>

                  {/* Net Salary */}
                  {/* <div className="ep-input-group">
    <label>Net Salary</label>
    <input value={formData._NetSal} readOnly />
  </div> */}

                  {/* Leave */}
                  <div className="ep-input-group">
                    <label>Allowed CL</label>
                    <input
                      type="number"
                      name="_Allowed_CL"
                      value={formData._Allowed_CL}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="ep-input-group">
                    <label>Allowed SL</label>
                    <input
                      type="number"
                      name="_Allowed_SL"
                      value={formData._Allowed_SL}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="ep-input-group">
                    <label>P Time</label>
                    <input
                      type="number"
                      name="_P_Time"
                      value={formData._P_Time}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="ep-input-group">
                    <label>Check-In</label>
                    <input
                      type="time"
                      name="_CheckIn"
                      value={formData._CheckIn}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="ep-input-group">
                    <label>Day DA</label>
                    <input
                      type="number"
                      name="_dayDA"
                      value={formData._dayDA}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="ep-input-group">
                    <label>Hour DA</label>
                    <input
                      type="number"
                      name="_hourDA"
                      value={formData._hourDA}
                      onChange={handleInputChange}
                    />
                  </div>

                  {/* What a kilometre is worth in DA on a day that is paid on
                      distance rather than on the clock - a single day camp, or
                      a longer one where the team comes home every night. Left
                      at 1 it changes nothing. */}
                  <div className="ep-input-group">
                    <label>DA per KM</label>
                    <input
                      type="number"
                      name="_DAperKM"
                      value={formData._DAperKM}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="ep-input-group">
                    <label>TA per KM (Public Transport)</label>
                    <input
                      type="number"
                      name="_TAperKM"
                      value={formData._TAperKM}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="ep-input-group">
                    <label>Team Allowance</label>
                    <input
                      type="number"
                      name="_teamAllowance"
                      value={formData._teamAllowance}
                      onChange={handleInputChange}
                      placeholder="0"
                      min="0"
                      step="any"
                    />
                  </div>

                </div>

                {/* Banking Section */}
                <h4 className="ep-form-section-title">Banking Details</h4>
                <div className="ep-form-grid">
                  <div className="ep-input-group">
                    <label>Account No</label>
                    <input
                      name="_AccountNo"
                      value={formData._AccountNo}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="ep-input-group">
                    <label>IFSC Code</label>
                    <input
                      name="_IFSCCode"
                      value={formData._IFSCCode}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>

              <div className="ep-form-actions">
                <button
                  type="button"
                  className="ep-btn-secondary"
                  onClick={() => setShowRegisterModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ep-btn-primary"
                  disabled={registerLoading}
                >
                  {registerLoading
                    ? isEditMode
                      ? "Updating..."
                      : "Registering..."
                    : isEditMode
                      ? "Update Changes"
                      : "Register Employee"}
                </button>
                {isEditMode && (
                  <button
                    type="button"
                    className="ep-btn-reporting"
                    onClick={openReportingModal}
                  >
                    Reporting Matrix
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reporting Matrix Modal */}
      {showReportingModal && (
        <div
          className="ep-overlay"
          onClick={() => setShowReportingModal(false)}
        >
          <div
            className="ep-modal ep-modal-management"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ep-modal-header">
              <h3>Reporting Matrix</h3>
              <button
                className="ep-close-btn"
                onClick={() => setShowReportingModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="ep-form-scrollable">
              {/* 🔥 TABLE VIEW */}
              <div className="ep-reporting-table">
                <table className="ep-table">
                  <thead>
                    <tr>
                      <th>Request Type</th>
                      <th>RA1</th>
                      <th>RA2</th>
                      <th>RA3</th>
                      <th>RA4</th>
                    </tr>
                  </thead>

                  <tbody>
                    {requestTypeOptions.map((type) => {
                      const row = reportingHistory.find(
                        (r) => (r.requestType || r.RequestType) === type,
                      );

                      return (
                        <tr key={type}>
                          {/* Request Type */}
                          <td>{type}</td>

                          {/* RA1 (readonly) */}
                          <td>
                            <select
                              value={row?.RA1 || row?.rA1 || ""}
                              onChange={(e) =>
                                updateReportingField(
                                  "RA1",
                                  e.target.value,
                                  type,
                                )
                              }
                              className="ep-select"
                            >
                              <option value="">Select</option>
                              <option value="-">-</option>
                              {ras.map((d, index) => (
                                <option key={index} value={d.name}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* RA2 */}
                          <td>
                            <select
                              value={row?.RA2 || row?.rA2 || ""}
                              onChange={(e) =>
                                updateReportingField(
                                  "RA2",
                                  e.target.value,
                                  type,
                                )
                              }
                              className="ep-select"
                            >
                              <option value="">Select</option>
                              <option value="-">-</option>
                              {ras.map((d, index) => (
                                <option key={index} value={d.name}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* RA3 */}
                          <td>
                            <select
                              value={row?.RA3 || row?.rA3 || ""}
                              onChange={(e) =>
                                updateReportingField(
                                  "RA3",
                                  e.target.value,
                                  type,
                                )
                              }
                              className="ep-select"
                            >
                              <option value="">Select</option>
                              <option value="-">-</option>
                              {ras.map((d, index) => (
                                <option key={index} value={d.name}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* RA4 */}
                          <td>
                            <select
                              value={row?.RA4 || row?.rA4 || ""}
                              onChange={(e) =>
                                updateReportingField(
                                  "RA4",
                                  e.target.value,
                                  type,
                                )
                              }
                              className="ep-select"
                            >
                              <option value="">Select</option>
                              <option value="-">-</option>
                              {ras.map((d, index) => (
                                <option key={index} value={d.name}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmpProfile;
