import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Stock.css";
import { ArrowBigRight, Contrast, Space } from "lucide-react";
import { API_BASE } from "../config";


///api/Stock

const stockTypes = [
  "Laptops",
  "Computer Peripherals",
  "Tools",
  "Equipments",
  "Documents",
  "Office Essentials",
  "Others",
];
const BASE_URL = `${API_BASE}Stock`;
const stockEntryStatuses = ["In Stock", "Damaged"];
const stockIssueStatuses = ["Issued", "Returned", "Damaged"];
const BARCODE_CLOSE_DELAY_MS = 350;

type ScanRegion = { x: number; y: number; w: number; h: number };

const BARCODE_SCAN_REGIONS: Array<ScanRegion | null> = [
  null,
  { x: 0.1, y: 0.2, w: 0.8, h: 0.6 },
  { x: 0.2, y: 0.3, w: 0.6, h: 0.4 },
  { x: 0.3, y: 0.35, w: 0.4, h: 0.3 },
];

const getBarcodeVideoConstraints = (facingMode: "environment" | "user"): MediaTrackConstraints => ({
  facingMode: { ideal: facingMode },
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30, max: 60 },
});

const drawVideoToScanCanvas = (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  region: ScanRegion | null
) => {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;

  let sx = 0;
  let sy = 0;
  let sw = vw;
  let sh = vh;

  if (region) {
    sx = Math.floor(region.x * vw);
    sy = Math.floor(region.y * vh);
    sw = Math.max(1, Math.floor(region.w * vw));
    sh = Math.max(1, Math.floor(region.h * vh));
  }

  canvas.width = sw;
  canvas.height = sh;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
  return true;
};

const enhanceCanvasContrast = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const contrast = 1.8;
  const intercept = 128 * (1 - contrast);

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    let value = contrast * gray + intercept;
    value = value < 0 ? 0 : value > 255 ? 255 : value;
    data[i] = data[i + 1] = data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);
};

const upscaleScanCanvas = (source: HTMLCanvasElement, minWidth = 720) => {
  if (source.width >= minWidth) return source;

  const scale = Math.min(2.5, minWidth / source.width);
  const scaled = document.createElement("canvas");
  scaled.width = Math.floor(source.width * scale);
  scaled.height = Math.floor(source.height * scale);
  const ctx = scaled.getContext("2d");
  if (!ctx) return source;

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(source, 0, 0, scaled.width, scaled.height);
  return scaled;
};

type StockRow = Array<any>;
type EmployeeRow = [string, string];
type StockIssueRow = Array<any>;

type StockEntryState = {
  _Sid: number;
  _StockCode: string;
  _StockName: string;
  _IssuedName: string;
  _Details: string;
  _IssueDate: string;
  _Make: string;
  _Sno: string;
  _IS_RETURNED: string;
  _StockType: string;
  _Wdate: string;
  _StockImageBase64?: string;
};

type StockIssueState = {
  _Sid: number;
  _StockCode: string;
  _StockType: string;
  _StockName: string;
  _Make: string;
  _Sno: string;
  _Details: string;
  _IssuedName: string;
  _IssueDate: string;
  _IS_RETURNED: string;
  _Tid: number;
};

const formatDate = (value: string) => {
  if (!value) return "";
  return value.split("T")[0];
};

const isDateLike = (value: string) => {
  if (!value) return false;
  return /^(\d{2}-\d{2}-\d{4}|\d{4}-\d{2}-\d{2})$/.test(value.trim());
};

const parseStockIssueRow = (row: StockIssueRow) => {
  const sno = row[0] ?? "";
  const stockCode = row[1] ?? "";
  const issueDate = row[2] ?? "";
  const issueName = row[3] ?? "";
  const isReturned = row[4] ?? "";
  let returnDate = row[5] ?? "";
  let stockName = row[6] ?? "";

  if (!isDateLike(returnDate) && isDateLike(stockName)) {
    [returnDate, stockName] = [stockName, returnDate];
  }

  return { sno, stockCode, stockName, issueDate, issueName, isReturned, returnDate };
};

const makeApiDate = (value: string) => {
  if (!value) return "";
  if (value.includes("T")) return value;
  return `${value}T00:00:00`;
};

const Stock = () => {
  // ===== ACCESS CONTROL =====

  const user = JSON.parse(localStorage.getItem("user") || "{}");

const loggedEmpCode =
  user?.empCode ||
  user?.EmpCode ||
  localStorage.getItem("EmpCode") ||
  "";



const allowedDesignations = [
  "Director",
  "Network Administrator",
  "In-Charge F&A"
];

const userDesignation = String(user?.designation || "").trim();

const isAuthorized = allowedDesignations.includes(userDesignation);

if (!isAuthorized) {
    return (
      <div className="stock-access-denied">
        <h2>Access Denied</h2>
        <h5>
          You don’t have permission to access the Stock Management module.
        </h5>
        <p>Please contact the administrator.</p>
      </div>
    );
  }
  const [activeTab, setActiveTab] = useState<"entry" | "issue">("entry");
  const [stockEntry, setStockEntry] = useState<StockEntryState>({

    _Sid: 0,
    _StockCode: "",
    _StockName: "",
    _IssuedName: "",
    _Details: "",
    _IssueDate: "",
    _Make: "",
    _Sno: "",
    _IS_RETURNED: "In Stock",
    _StockType: "",
    _Wdate: formatDate(new Date().toISOString()),
  });

  const [stockIssue, setStockIssue] = useState<StockIssueState>({
    _Sid: 0,
    _StockCode: "",
    _StockType: "",
    _StockName: "",
    _Make: "",
    _Sno: "",
    _Details: "",
    _IssuedName: "",
    _IssueDate: formatDate(new Date().toISOString()),
    _IS_RETURNED: "Issued",
    _Tid: 0,
  });

  const [stockList, setStockList] = useState<StockRow[]>([]);
  const [filteredStock, setFilteredStock] = useState<StockRow[]>([]);
  const [stockIssueList, setStockIssueList] = useState<StockIssueRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [imageSrc, setImageSrc] = useState<string>("");
  const [stockImagePreview, setStockImagePreview] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [scannerFacingMode, setScannerFacingMode] = useState<"environment" | "user">("environment");
  const [isScannerCameraReady, setIsScannerCameraReady] = useState(false);
  const [scannerError, setScannerError] = useState<string>("");
  const [scannerStatus, setScannerStatus] = useState<string>("");
  const [scannerSuccess, setScannerSuccess] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isImageCapturing, setIsImageCapturing] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<"environment" | "user">("environment");
  const [imageCaptureError, setImageCaptureError] = useState<string>("");
  const [selectedIssueIndex, setSelectedIssueIndex] = useState<number | null>(null);
  const [searchType, setSearchType] = useState<string>("");
  const [searchName, setSearchName] = useState<string>("");
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureVideoRef = useRef<HTMLVideoElement | null>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const scanRafRef = useRef<number | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanFramePassRef = useRef(0);
  const nativeDetectorRef = useRef<any>(null);
  const scanSuccessTimeoutRef = useRef<number | null>(null);
  const scannerControlsRef = useRef<{ stop: () => void } | null>(null);
  const scannerActiveRef = useRef(false);
  const scanDetectInFlightRef = useRef(false);
  const zxingCodeReaderRef = useRef<any>(null);
  const stopCamera = () => {
  if (videoRef.current?.srcObject) {
    const stream = videoRef.current.srcObject as MediaStream;

    stream.getTracks().forEach((track) => track.stop());

    videoRef.current.srcObject = null;
  }
};
  const stockCodes = useMemo(
    () => Array.from(new Set(stockList.map((row) => row[1] || ""))).filter(Boolean),
    [stockList]
  );
  const stockNames = useMemo(
    () => Array.from(new Set(stockList.map((row) => row[2] || ""))).filter(Boolean),
    [stockList]
  );

  useEffect(() => {
    loadStock();
    loadEmployees();
    loadStockIssues();
  }, []);

  const loadStock = async () => {
    try {
      const response = await fetch(`${BASE_URL}/Load_Stock`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Load_Stock failed: ${response.status} ${response.statusText} ${text}`);
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setStockList(data);
        setFilteredStock(data);
      } else {
        throw new Error(`Load_Stock returned unexpected data: ${JSON.stringify(data)}`);
      }
    } catch (error: any) {
      console.error("Load_Stock failed", error);
      alert("Unable to load stock data. Check the API and network.");
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await fetch(`${BASE_URL}/Load_Employes`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Load_Employes failed: ${response.status} ${response.statusText} ${text}`);
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setEmployees(data);
      } else {
        throw new Error(`Load_Employes returned unexpected data: ${JSON.stringify(data)}`);
      }
    } catch (error: any) {
      console.error("Load_Employes failed", error);
      alert("Unable to load employee data. Check the API and network.");
    }
  };

  const loadStockIssues = async () => {
    try {
      const response = await fetch(`${BASE_URL}/Load_StockIssue`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Load_StockIssue failed: ${response.status} ${response.statusText} ${text}`);
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setStockIssueList(data);
      } else {
        throw new Error(`Load_StockIssue returned unexpected data: ${JSON.stringify(data)}`);
      }
    } catch (error: any) {
      console.error("Load_StockIssue failed", error);
      alert("Unable to load stock issue data. Check the API and network.");
    }
  };

  const fetchStockCodeByType = async (type: string) => {
    if (!type) return;
    try {
      const response = await fetch(`${BASE_URL}/Get_Stockcode?StockType=${encodeURIComponent(type)}`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Get_Stockcode failed: ${response.status} ${response.statusText} ${text}`);
      }
      const data = await response.json();
      if (Array.isArray(data) && Array.isArray(data[0]) && data[0][0]) {
        setStockEntry((prev) => ({ ...prev, _StockCode: String(data[0][0]) }));
      } else {
        throw new Error(`Get_Stockcode returned unexpected data: ${JSON.stringify(data)}`);
      }
    } catch (error: any) {
      console.error("Get_Stockcode failed", error);
      alert("Unable to load stock code. Check the API and network.");
    }
  };

  const handleTypeChange = async (type: string) => {
    setStockEntry((prev) => ({ ...prev, _StockType: type }));
    await fetchStockCodeByType(type);
  };

  const saveStock = async () => {
    try {
      const payload = {
        ...stockEntry,
        _IssueDate: makeApiDate(stockEntry._IssueDate),
        _Wdate: makeApiDate(stockEntry._Wdate),
      };
      const response = await fetch(`${BASE_URL}/Save_Stock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data?.status) {
        alert(data.message || "Stock saved successfully");
        loadStock();
      } else {
        alert(data?.message || "Failed to save stock");
      }
    } catch (error) {
      console.error("Save_Stock failed", error);
      alert("Unable to save stock. Check the API and network.");
    }
  };

  const saveStockIssue = async () => {
    try {
      const payload = {
        ...stockIssue,
        _IssueDate: makeApiDate(stockIssue._IssueDate),
      };
      const response = await fetch(`${BASE_URL}/Save_Stock_Status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.text();
      alert(data || "Stock issue saved successfully");
      loadStockIssues();
    } catch (error) {
      console.error("Save_Stock_Status failed", error);
      alert("Unable to save stock issue. Check the API and network.");
    }
  };

  const editStock = (row: StockRow) => {
    setStockEntry({
      _Sid: Number(row[0] || 0),
      _StockCode: row[1] || "",
      _StockName: row[2] || "",
      _Details: row[3] || "",
      _IssuedName: row[4] || "",
      _IssueDate: formatDate(String(row[5] || "")),
      _Make: row[6] || "",
      _Sno: row[7] || "",
      _IS_RETURNED: row[8] || "In Stock",
      _StockType: row[9] || "",
      _Wdate: formatDate(new Date().toISOString()),
    });
  };

  const loadStockImage = async (id: number) => {
    if (!id) return;
    try {
      const response = await fetch(`${BASE_URL}/Load_Stock_Img?Id=${id}`);
      const data = await response.json();
      if (Array.isArray(data) && Array.isArray(data[0]) && data[0][10]) {
        setImageSrc(`data:image/png;base64,${data[0][10]}`);
      } else {
        setImageSrc("");
        alert("Image not found for this stock item.");
      }
    } catch (error) {
      console.error("Load_Stock_Img failed", error);
      alert("Unable to load stock image.");
    }
  };

  const openImageModal = () => {
    setImageCaptureError("");
    setIsImageModalOpen(true);
  };

  const closeImageModal = () => {
    stopImageCapture();
    setIsImageModalOpen(false);
    setImageCaptureError("");
  };

  const handleImageSelected = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setStockImagePreview(result);
      setStockEntry((prev) => ({ ...prev, _StockImageBase64: result.split(",")[1] }));
    };
    reader.readAsDataURL(file);
  };

  const selectImageFromDevice = () => {
    imageInputRef.current?.click();
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageSelected(file);
      closeImageModal();
    }
    event.target.value = "";
  };

  const startImageCapture = async (facingMode: "environment" | "user" = cameraFacingMode) => {
    setImageCaptureError("");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setImageCaptureError("Camera capture is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
      captureStreamRef.current = stream;
      setCameraFacingMode(facingMode);
      setIsImageCapturing(true);

      let retry = 0;
      while (!captureVideoRef.current && retry < 10) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        retry++;
      }

      if (!captureVideoRef.current) {
        setImageCaptureError("Unable to open the camera preview.");
        stopImageCapture();
        return;
      }

      captureVideoRef.current.srcObject = stream;
      await captureVideoRef.current.play();
    } catch (error: any) {
      console.error("Image capture error", error);
      let message = "Unable to access the camera. Allow camera permission and try again.";
      if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
        message = "Camera access was denied. Please allow camera permission in your browser settings.";
      } else if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
        message = "No camera was found. Connect a camera and try again.";
      } else if (error?.name === "NotReadableError") {
        message = "The camera is already in use or not accessible. Close other camera apps and retry.";
      }
      setImageCaptureError(message);
      setIsImageCapturing(false);
    }
  };

  const stopImageCapture = () => {
    if (captureStreamRef.current) {
      captureStreamRef.current.getTracks().forEach((track) => track.stop());
      captureStreamRef.current = null;
    }
    if (captureVideoRef.current) {
      captureVideoRef.current.srcObject = null;
    }
    setIsImageCapturing(false);
  };

  const switchCamera = async () => {
    const nextFacingMode = cameraFacingMode === "environment" ? "user" : "environment";
    stopImageCapture();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    await startImageCapture(nextFacingMode);
  };

  const capturePhoto = () => {
    if (!captureVideoRef.current) return;
    const video = captureVideoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setImageCaptureError("Unable to capture image from camera.");
      return;
    }
    context.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setStockImagePreview(dataUrl);
    setStockEntry((prev) => ({ ...prev, _StockImageBase64: dataUrl.split(",")[1] }));
    closeImageModal();
  };

  useEffect(() => {
    if (!isImageModalOpen) return;

    void startImageCapture();

    return () => {
      stopImageCapture();
    };
  }, [isImageModalOpen]);

  const populateStockEntryBySerial = (serial: string) => {
    const matchingRow = stockList.find((row) => String(row[7] || "") === serial);
    if (matchingRow) {
      setStockEntry((prev) => ({
        ...prev,
        _Sno: serial,
        _StockCode: String(matchingRow[1] || ""),
        _StockName: String(matchingRow[2] || ""),
        _Details: String(matchingRow[3] || ""),
        _Make: String(matchingRow[6] || ""),
        _StockType: String(matchingRow[9] || ""),
        _IS_RETURNED: String(matchingRow[8] || prev._IS_RETURNED || "Issued"),
      }));
    } else {
      setStockEntry((prev) => ({ ...prev, _Sno: serial }));
    }
  };

  const stopBarcodeDetection = () => {
    scanDetectInFlightRef.current = false;
    scanFramePassRef.current = 0;

    if (scanRafRef.current) {
      cancelAnimationFrame(scanRafRef.current);
      scanRafRef.current = null;
    }
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (scannerControlsRef.current) {
      try {
        scannerControlsRef.current.stop();
      } catch (error) {
        console.warn("Scanner controls stop failed", error);
      }
      scannerControlsRef.current = null;
    }
    if (zxingCodeReaderRef.current) {
      try {
        if (typeof zxingCodeReaderRef.current.stopContinuousDecode === "function") {
          zxingCodeReaderRef.current.stopContinuousDecode();
        }
        if (typeof zxingCodeReaderRef.current.stopAsyncDecode === "function") {
          zxingCodeReaderRef.current.stopAsyncDecode();
        }
        if (typeof zxingCodeReaderRef.current.reset === "function") {
          zxingCodeReaderRef.current.reset();
        }
      } catch (error) {
        console.warn("ZXing reset failed", error);
      }
      zxingCodeReaderRef.current = null;
    }
    nativeDetectorRef.current = null;
  };

  const stopBarcodeScanner = () => {
    scannerActiveRef.current = false;
    stopBarcodeDetection();

    if (scanSuccessTimeoutRef.current) {
      window.clearTimeout(scanSuccessTimeoutRef.current);
      scanSuccessTimeoutRef.current = null;
    }
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach((track) => track.stop());
      scanStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScannerStatus("");
    setScannerSuccess(false);
    setScannerError("");
    setIsScannerCameraReady(false);
    setIsScanning(false);
  };

  const completeBarcodeScan = (serial: string) => {
    if (!serial || !scannerActiveRef.current) return;

    scannerActiveRef.current = false;
    stopBarcodeDetection();
    populateStockEntryBySerial(serial);
    setScannerStatus("Scanning successful - Serial No has been filled.");
    setScannerSuccess(true);

    if (scanSuccessTimeoutRef.current) {
      window.clearTimeout(scanSuccessTimeoutRef.current);
    }
    scanSuccessTimeoutRef.current = window.setTimeout(() => stopBarcodeScanner(), BARCODE_CLOSE_DELAY_MS);
  };

  const tryDecodeCanvasFrame = (codeReader: any, canvas: HTMLCanvasElement) => {
    try {
      const result = codeReader.decodeFromCanvas(canvas);
      return result?.getText?.() || "";
    } catch {
      return "";
    }
  };

  const processBarcodeScanFrame = async (video: HTMLVideoElement) => {
    const nativeDetector = nativeDetectorRef.current;
    if (nativeDetector) {
      try {
        const barcodes = await nativeDetector.detect(video);
        const scannedValue = barcodes.find((barcode: { rawValue?: string }) => barcode.rawValue)?.rawValue;
        if (scannedValue) {
          completeBarcodeScan(scannedValue);
          return;
        }
      } catch (error) {
        console.warn("Native barcode detect failed", error);
      }
    }

    const codeReader = zxingCodeReaderRef.current;
    if (!codeReader) return;

    if (!scanCanvasRef.current) {
      scanCanvasRef.current = document.createElement("canvas");
    }
    const canvas = scanCanvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const pass = scanFramePassRef.current;
    scanFramePassRef.current += 1;
    const region = BARCODE_SCAN_REGIONS[pass % BARCODE_SCAN_REGIONS.length];
    const useEnhance = pass % 2 === 1;
    const useUpscale = Boolean(region);

    if (!drawVideoToScanCanvas(video, canvas, ctx, region)) return;

    let decodeCanvas: HTMLCanvasElement = canvas;
    if (useEnhance) {
      enhanceCanvasContrast(ctx, canvas.width, canvas.height);
    }
    if (useUpscale) {
      decodeCanvas = upscaleScanCanvas(canvas);
    }

    const scannedValue = tryDecodeCanvasFrame(codeReader, decodeCanvas);
    if (scannedValue) {
      completeBarcodeScan(scannedValue);
    }
  };

  const runBarcodeScanLoop = () => {
    if (!scannerActiveRef.current || !videoRef.current) return;

    const video = videoRef.current;
    if (video.readyState < 2) {
      scanRafRef.current = requestAnimationFrame(runBarcodeScanLoop);
      return;
    }

    if (scanDetectInFlightRef.current) {
      scanRafRef.current = requestAnimationFrame(runBarcodeScanLoop);
      return;
    }

    scanDetectInFlightRef.current = true;
    void processBarcodeScanFrame(video).finally(() => {
      scanDetectInFlightRef.current = false;
      if (scannerActiveRef.current) {
        scanRafRef.current = requestAnimationFrame(runBarcodeScanLoop);
      }
    });
  };

  const startBarcodeDetection = async () => {
    if (!videoRef.current || !scannerActiveRef.current) return;

    stopBarcodeDetection();
    scannerActiveRef.current = true;
    scanFramePassRef.current = 0;

    const nativeBarcodeDetector = (window as any).BarcodeDetector;
    if (nativeBarcodeDetector) {
      nativeDetectorRef.current = new nativeBarcodeDetector({
        formats: [
          "code_128",
          "code_39",
          "code_93",
          "ean_8",
          "ean_13",
          "upc_a",
          "upc_e",
          "itf",
        ],
      });
    }

    try {
      const ZXing = await import("@zxing/browser");
      const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");
      const formats = [
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93,
        BarcodeFormat.EAN_8,
        BarcodeFormat.EAN_13,
        BarcodeFormat.ITF,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
      ];
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);

      zxingCodeReaderRef.current = new ZXing.BrowserMultiFormatOneDReader(hints, {
        delayBetweenScanAttempts: 0,
        delayBetweenScanSuccess: 0,
        tryPlayVideoTimeout: 3000,
      });
    } catch (error) {
      console.error("ZXing scanner init failed", error);
      if (!nativeDetectorRef.current) {
        setScannerError(
          "Barcode scanning is not supported by this browser. Try Chrome on your phone or a browser with native barcode support."
        );
        stopBarcodeScanner();
        return;
      }
    }

    runBarcodeScanLoop();
  };

  const openScannerCamera = async (facingMode: "environment" | "user" = scannerFacingMode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError("Camera is not available in this browser.");
      setScannerStatus("");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: getBarcodeVideoConstraints(facingMode),
        audio: false,
      });
      scanStreamRef.current = stream;
      scannerActiveRef.current = true;
      setScannerFacingMode(facingMode);

      let retry = 0;
      while (!videoRef.current && retry < 10) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        retry++;
      }

      if (!videoRef.current) {
        setScannerError("Unable to open the camera preview.");
        stopBarcodeScanner();
        return false;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const videoTrack = stream.getVideoTracks()[0] as (MediaStreamTrack & {
        getCapabilities?: () => any;
      }) | undefined;
      const capabilities = videoTrack?.getCapabilities?.() as any;
      if (capabilities?.focusMode?.includes?.("continuous")) {
        try {
          await (videoTrack as any).applyConstraints({
            advanced: [{ focusMode: "continuous" }],
          });
        } catch (error) {
          console.warn("Continuous focus could not be applied", error);
        }
      }

      setIsScannerCameraReady(true);
      return true;
    } catch (error: any) {
      console.error("Barcode camera error", error);
      let message = "Unable to access the camera. Allow camera permission and try again.";
      if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
        message = "Camera access was denied. Please allow camera permission in your browser settings.";
      } else if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
        message = "No camera was found. Connect a camera and try again.";
      } else if (error?.name === "NotReadableError") {
        message = "The camera is already in use or not accessible. Close other camera apps and retry.";
      }
      setScannerError(message);
      setScannerStatus("");
      stopBarcodeScanner();
      return false;
    }
  };

  const switchScannerCamera = async () => {
    const nextFacingMode = scannerFacingMode === "environment" ? "user" : "environment";
    stopBarcodeDetection();
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach((track) => track.stop());
      scanStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScannerCameraReady(false);
    setScannerError("");
    setScannerStatus("Switching camera — point the barcode at the camera.");
    const opened = await openScannerCamera(nextFacingMode);
    if (opened) {
      await startBarcodeDetection();
    }
  };

  const startBarcodeScanner = async () => {
    stopBarcodeScanner();
    setScannerError("");
    setScannerStatus("Camera active — point the barcode at the camera.");
    setScannerSuccess(false);
    setIsScanning(true);

    const opened = await openScannerCamera("environment");
    if (opened) {
      await startBarcodeDetection();
    }
  };

  useEffect(() => {
    return () => {


      stopBarcodeScanner();
    };
  }, []);

  const applyStockToIssue = (row: StockRow) => {
    setStockIssue((prev) => ({
      ...prev,
      _Sid: Number(row[0] || 0),
      _StockCode: row[1] || "",
      _StockType: row[9] || "",
      _StockName: row[2] || "",
      _Make: row[6] || "",
      _Sno: row[7] || "",
      _Details: row[3] || "",
    }));
  };




  const loadStockByCode = async (stockCode: string) => {
    if (!stockCode) {
      setStockIssue((prev) => ({
        ...prev,
        _Sid: 0,
        _StockCode: "",
        _StockType: "",
        _StockName: "",
        _Make: "",
        _Sno: "",
        _Details: "",
      }));
      return;
    }

    const selectedRow = stockList.find((row) => String(row[1] || "") === stockCode);
    if (selectedRow) {
      applyStockToIssue(selectedRow);
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/Load_Stock_by_Code?StockCode=${encodeURIComponent(stockCode)}`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Load_Stock_by_Code failed: ${response.status} ${response.statusText} ${text}`);
      }
      const data = await response.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        applyStockToIssue(data[0]);
      } else {
        throw new Error(`Load_Stock_by_Code returned unexpected data: ${JSON.stringify(data)}`);
      }
    } catch (error: any) {
      console.error("Load_Stock_by_Code failed", error);
      alert("Unable to load stock details by code. Check the API and network.");
    }
  };

  const handleSearch = () => {
    let filtered = [...stockList];
    if (searchType) {
      filtered = filtered.filter((row) => String(row[9] || "").toLowerCase().includes(searchType.toLowerCase()));
    }
    if (searchName) {
      filtered = filtered.filter((row) => String(row[2] || "").toLowerCase().includes(searchName.toLowerCase()));
    }
    setFilteredStock(filtered);
  };

  const clearFilters = () => {
    setSearchType("");
    setSearchName("");
    setFilteredStock(stockList);
  };

  const entryImage = stockImagePreview || imageSrc;

  return (
    <div className="stock-container">
      <div className="stock-sticky-bar">
        <div className="stock-top-header">
          <h1 className="stock-title">Stock Management</h1>
          <p className="stock-subtitle">Track stock entry, issue history, and current item status.</p>
        </div>

        <div className="stock-tabs">
          <button
            type="button"
            className={activeTab === "entry" ? "stock-tab active" : "stock-tab"}
            onClick={() => setActiveTab("entry")}
          >
            Stock Entry
          </button>
          <button
            type="button"
            className={activeTab === "issue" ? "stock-tab active" : "stock-tab"}
            onClick={() => setActiveTab("issue")}
          >
            Stock Issue
          </button>
        </div>
      </div>

      {activeTab === "entry" ? (
        <div className="stock-panel">
          <h3 className="stock-section-heading">Stock Entry</h3>

          <div className="stock-entry-layout">
            <div className="stock-grid stock-grid--entry">
              <div className="stock-field">
                <label>Stock Type</label>
                <select
                  value={stockEntry._StockType}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="stock-select"
                >
                  <option value="">Select Type</option>
                  {stockTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="stock-field">
                <label>Stock Code</label>
                <input
                  readOnly
                  value={stockEntry._StockCode}
                  placeholder="Auto-generated"
                  className="stock-input"
                />
              </div>

              <div className="stock-field">
                <label>Stock Name</label>
                <input
                  value={stockEntry._StockName}
                  onChange={(e) => setStockEntry({ ...stockEntry, _StockName: e.target.value })}
                  placeholder="Stock Name"
                  className="stock-input"
                />
              </div>

              <div className="stock-field">
                <label>Make</label>
                <input
                  value={stockEntry._Make}
                  onChange={(e) => setStockEntry({ ...stockEntry, _Make: e.target.value })}
                  placeholder="Make"
                  className="stock-input"
                />
              </div>

              <div className="stock-field">
                <label>Status</label>
                <select
                  value={stockEntry._IS_RETURNED}
                  onChange={(e) => setStockEntry({ ...stockEntry, _IS_RETURNED: e.target.value })}
                  className="stock-select"
                >
                  {stockEntryStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="stock-field stock-field--scan">
                <div className="stock-field-row">
                  <label>Serial No</label>
                  <button type="button" onClick={startBarcodeScanner} className="stock-scan-button">
                    Scan Barcode
                  </button>
                </div>
                <input
                  value={stockEntry._Sno}
                  onChange={(e) => setStockEntry({ ...stockEntry, _Sno: e.target.value })}
                  placeholder="Scan or type Serial No"
                  className="stock-input"
                />
                {scannerError && <div className="stock-field-error">{scannerError}</div>}
              </div>

              <div className="stock-field">
                <label>W Date</label>
                <input
                  type="date"
                  value={stockEntry._Wdate}
                  onChange={(e) => setStockEntry({ ...stockEntry, _Wdate: e.target.value })}
                  className="stock-input"
                />
              </div>

              <div className="stock-field stock-field--span-2">
                <label>Details</label>
                <input
                  value={stockEntry._Details}
                  onChange={(e) => setStockEntry({ ...stockEntry, _Details: e.target.value })}
                  placeholder="Details"
                  className="stock-input"
                />
              </div>
            </div>

            {entryImage && (
              <div className="stock-entry-image-card">
                <h4 className="stock-subheading">Stock Image</h4>
                <div className="stock-image-preview stock-image-preview--entry">
                  <img src={entryImage} alt="Stock" />
                </div>
              </div>
            )}
          </div>

          <div className="stock-actions">
            <button type="button" onClick={saveStock} className="stock-button">
              Submit
            </button>
            <button
              type="button"
              onClick={() => {
                setStockEntry({
                  _Sid: 0,
                  _StockCode: "",
                  _StockName: "",
                  _IssuedName: "",
                  _Details: "",
                  _IssueDate: "",
                  _Make: "",
                  _Sno: "",
                  _IS_RETURNED: "In Stock",
                  _StockType: "",
                  _Wdate: formatDate(new Date().toISOString()),
                });
                setStockImagePreview("");
                setImageSrc("");
              }}
              className="stock-button stock-button--secondary"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={openImageModal}
              className="stock-button stock-button--ghost"
              title="Upload image"
            >
              Upload Image
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="stock-hidden-input"
            />
          </div>

          {isScanning && (
            <div className="stock-image-modal-overlay" onClick={stopBarcodeScanner}>
              <div className="stock-image-capture-panel" onClick={(event) => event.stopPropagation()}>
                <video ref={videoRef} className="stock-image-capture-video" autoPlay muted playsInline />
                {!isScannerCameraReady && !scannerError && (
                  <div className="stock-image-capture-loading">Starting camera...</div>
                )}
                <div
                  className={`stock-scanner-status-overlay ${
                    scannerSuccess ? "stock-scanner-status-overlay--success" : ""
                  }`}
                >
                  {scannerStatus || "Hold barcode in center. Works even if small or slightly blurry."}
                </div>
                <div className="stock-image-capture-toolbar">
                  <button
                    type="button"
                    className="stock-capture-btn stock-capture-btn--switchcamera"
                    onClick={switchScannerCamera}
                    disabled={!isScannerCameraReady}
                  >
                    Switch Camera
                  </button>
                  <button
                    type="button"
                    className="stock-capture-btn stock-capture-btn--close"
                    onClick={stopBarcodeScanner}
                  >
                    Close
                  </button>
                </div>
                {scannerError && <div className="stock-image-capture-error">{scannerError}</div>}
              </div>
            </div>
          )}

          {isImageModalOpen && (
            <div className="stock-image-modal-overlay" onClick={closeImageModal}>
              <div className="stock-image-capture-panel" onClick={(event) => event.stopPropagation()}>
                <video
                  ref={captureVideoRef}
                  className="stock-image-capture-video"
                  autoPlay
                  muted
                  playsInline
                />
                {!isImageCapturing && !imageCaptureError && (
                  <div className="stock-image-capture-loading">Starting camera...</div>
                )}
                <div className="stock-image-capture-toolbar">
                  <button
                    type="button"
                    className="stock-capture-btn stock-capture-btn--capture"
                    onClick={capturePhoto}
                    disabled={!isImageCapturing}
                  >
                    Capture
                  </button>
                  <button
                    type="button"
                    className="stock-capture-btn stock-capture-btn--switch"
                    onClick={switchCamera}
                    disabled={!isImageCapturing}
                  >
                    Switch Camera
                  </button>
                  <button
                    type="button"
                    className="stock-capture-btn stock-capture-btn--browse"
                    onClick={selectImageFromDevice}
                  >
                    Browse
                  </button>
                  <button
                    type="button"
                    className="stock-capture-btn stock-capture-btn--close"
                    onClick={closeImageModal}
                  >
                    Close
                  </button>
                </div>
                {imageCaptureError && <div className="stock-image-capture-error">{imageCaptureError}</div>}
              </div>
            </div>
          )}

          <div className="stock-search-box">
            <h4 className="stock-subheading">Search Stock</h4>
            <div className="stock-search-row">
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                className="stock-select"
              >
                <option value="">Search by Stock Type</option>
                {stockTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <select
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="stock-select"
              >
                <option value="">Search by Stock Name</option>
                {stockNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              <button type="button" onClick={handleSearch} className="stock-button stock-button--ghost stock-button--small">
                Search
              </button>
              <button type="button" onClick={clearFilters} className="stock-button stock-button--secondary stock-button--small">
                Reset
              </button>
            </div>
          </div>

          <div className="stock-table-wrapper">
            <table className="stock-table stock-table--entry">
              <thead>
                <tr>
                  <th>Sno.</th>
                  <th>Stock Code</th>
                  <th className="stock-col stock-col--name">Stock Name</th>
                  <th className="stock-col stock-col--details">Details</th>
                  <th>Issued Name</th>
                  <th>Issue Date</th>
                  <th className="stock-col stock-col--make">Make</th>
                  <th className="stock-col stock-col--serial">Product Sno.</th>
                  <th>Status</th>
                  <th>Stock Type</th>
                  <th>Image</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.map((row, index) => (
                  <tr key={index} className="stock-table-row stock-table-row--static">
                    <td>{row[0]}</td>
                    <td>
                      <button type="button" onClick={() => editStock(row)} className="stock-code-btn">
                        {row[1]}
                      </button>
                    </td>
                    <td className="stock-col stock-col--name">{row[2]}</td>
                    <td className="stock-col stock-col--details">{row[3]}</td>
                    <td>{row[4]}</td>
                    <td>{formatDate(String(row[5] || ""))}</td>
                    <td className="stock-col stock-col--make">{row[6]}</td>
                    <td className="stock-col stock-col--serial">{row[7]}</td>
                    <td>{row[8]}</td>
                    <td>{row[9]}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => loadStockImage(Number(row[0] || 0))}
                        className="stock-code-btn stock-code-btn--alt"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      ) : (
        <div className="stock-panel">
          <h3 className="stock-section-heading">Stock Issue</h3>

          <div className="stock-grid">
            <div className="stock-field">
              <label>Stock Code</label>
              <select
                value={stockIssue._StockCode}
                onChange={(e) => {
                  const value = e.target.value;
                  void loadStockByCode(value);
                }}
                className="stock-select"
              >
                <option value="">Select Code</option>
                {stockCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>

            <div className="stock-field">
              <label>Stock Type</label>
              <input
                value={stockIssue._StockType}
                onChange={(e) => setStockIssue({ ...stockIssue, _StockType: e.target.value })}
                placeholder="Stock Type"
                className="stock-input"
              />
            </div>

            <div className="stock-field">
              <label>Stock Name</label>
              <input
                value={stockIssue._StockName}
                onChange={(e) => setStockIssue({ ...stockIssue, _StockName: e.target.value })}
                placeholder="Stock Name"
                className="stock-input"
              />
            </div>

            <div className="stock-field">
              <label>Make</label>
              <input
                value={stockIssue._Make}
                onChange={(e) => setStockIssue({ ...stockIssue, _Make: e.target.value })}
                placeholder="Make"
                className="stock-input"
              />
            </div>

            <div className="stock-field">
              <label>Serial No</label>
              <input
                value={stockIssue._Sno}
                onChange={(e) => setStockIssue({ ...stockIssue, _Sno: e.target.value })}
                placeholder="Serial No"
                className="stock-input"
              />
            </div>

            <div className="stock-field stock-field--span-2">
              <label>Details</label>
              <input
                value={stockIssue._Details}
                onChange={(e) => setStockIssue({ ...stockIssue, _Details: e.target.value })}
                placeholder="Details"
                className="stock-input"
              />
            </div>

            <div className="stock-field">
              <label>Select Employee</label>
              <select
                value={stockIssue._IssuedName}
                onChange={(e) => setStockIssue({ ...stockIssue, _IssuedName: e.target.value })}
                className="stock-select"
              >

                {employees.map((emp) => (
                  <option key={emp[0]} value={emp[1]}>
                    {emp[1]}
                  </option>
                ))}
              </select>
            </div>

            <div className="stock-field">
              <label>Date</label>
              <input
                type="date"
                value={stockIssue._IssueDate}
                onChange={(e) => setStockIssue({ ...stockIssue, _IssueDate: e.target.value })}
                className="stock-input"
              />
            </div>

            <div className="stock-field">
              <label>Status</label>
              <select
                value={stockIssue._IS_RETURNED}
                onChange={(e) => setStockIssue({ ...stockIssue, _IS_RETURNED: e.target.value })}
                className="stock-select"
              >
                {stockIssueStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="stock-actions">
            <button type="button" onClick={saveStockIssue} className="stock-button">
              Submit Issue
            </button>
            <button
              type="button"
              onClick={() =>
                setStockIssue({
                  _Sid: 0,
                  _StockCode: "",
                  _StockType: "",
                  _StockName: "",
                  _Make: "",
                  _Sno: "",
                  _Details: "",
                  _IssuedName: "",
                  _IssueDate: formatDate(new Date().toISOString()),
                  _IS_RETURNED: "Issued",
                  _Tid: 0,
                })
              }
              className="stock-button stock-button--secondary"
            >
              Clear
            </button>
          </div>

          <div className="stock-table-wrapper">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Sno.</th>
                  <th>Stock Code</th>
                  <th>Stock Name</th>
                  <th>Issue Date</th>
                  <th>Issue Name</th>
                  <th>Is Returned</th>
                  <th>Return Date</th>
                </tr>
              </thead>
              <tbody>
                {stockIssueList.map((row, index) => {
                  const issue = parseStockIssueRow(row);
                  const isSelected = selectedIssueIndex === index;
                  return (
                    <tr
                      key={index}
                      className={isSelected ? "stock-table-row is-selected" : "stock-table-row"}
                      onClick={() => setSelectedIssueIndex(index)}
                    >
                      <td>{issue.sno}</td>
                      <td>{issue.stockCode}</td>
                      <td>{issue.stockName}</td>
                      <td>{formatDate(String(issue.issueDate || ""))}</td>
                      <td>{issue.issueName}</td>
                      <td>{issue.isReturned}</td>
                      <td>{formatDate(String(issue.returnDate || ""))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stock;

