// src/pages/OnDuties.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { addOutline } from "ionicons/icons";
import {
  IonPage,
  IonContent,
  IonLabel,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonDatetime,
  IonModal,
  IonButton,
  IonIcon,
  IonDatetimeButton,
  IonToast,
  IonTextarea,
  IonSegment,
  IonSegmentButton,
} from "@ionic/react";
import {
  calendarOutline,
  businessOutline,
  timeOutline,
  pencilOutline,
  personCircleOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  locationOutline,
  peopleOutline,
  carOutline,
  documentTextOutline,
} from "ionicons/icons";
import axios from "axios";
import "./OnDuties.css";
import "../components/requests/RequestList.css";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X, Check } from "lucide-react";
import moment from "moment";
import { API_BASE } from "../config";
import { useHistory } from "react-router-dom";

type ClientItem = { Client_ID: string; Client_Name: string };

type EmployeeItem = {
  EmpCode: string;
  EmpName?: string;
  Mobile?: string;
  Role?: string;
  Designation?: string;
  Ischeck?: string | boolean;
  RequestTo?: string;
};

type DutyRow = {
  id: string;

  Date?: string;
  DateFrom?: string;
  DateTo?: string;

  College: string;
  Description: string;
  empNames?: string;
  Mode_of_Trans: string;

  Start_Time?: string;
  End_Time?: string;
  Vehicle_No?: string;
  Start_Reading?: string;
  End_Reading?: string;
  Kms?: string;

  Status?: string;
  EmpCodes?: string;
  Location?: string;

  // Multi-level approval matrix (from load_duties_full / load_my_duties).
  // Semantics assumed: CurrentLevel/MaxLevel track how far the request has
  // progressed through RA1..RA4; CurrentRA names whoever's turn it is next;
  // RA{n}_Status is that level's own decision (Approved/Rejected/Pending).
  CurrentLevel?: string;
  MaxLevel?: string;
  CurrentRA?: string;
  MatrixType?: string;
  RA1?: string;
  RA2?: string;
  RA3?: string;
  RA4?: string;
  RA1_Status?: string;
  RA2_Status?: string;
  RA3_Status?: string;
  RA4_Status?: string;

  // true = the logged-in user's own submitted duty; false = a team member's
  // duty loaded in because the user can approve it. Used to split the list
  // into "My Requests" / "Team Requests" sections.
  isOwn?: boolean;

  dayTrips?: TripDayItem[];
};

type OTrow = {
  id: string;
  EmpCodeName?: string;
  EmpCode?: string;
  Date: string;
  College: string;
  Description: string;
  Fromtime: string;
  Totime: string;
  MinDiff?: string | number | null;
  FinMinDiff?: string | number | null;
  PendingAt?: string | null;
  Status?: string | null;
};

type VisitItem = {
  visit_Id?: number;
  partyName: string;
  location: string;
  latitude?: string;
  longitude?: string;
  demoProjects: string[];
  contactPerson: string;
  mobile: string;
  visitFromTime: string;
  visitToTime: string;
  localTransportAmount?: string;
  localTransportImage?: File | string | null;
  visitSlipImage: File | string | null;
  remarks: string,
};
type TripDayItem = {
  dayTrip_Id?: number;
  dutyDate: string;
  readingFrom: string;
  readingTo: string;
  readingFromImage: File | string | null;
  readingToImage: File | string | null;

  distance: string;
  fuelAmount: string;
  fuelImage: File | string | null;
  visits: VisitItem[];
};
const isoToYmd = (val?: string) => {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return val;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return val || "";
  }
};

const generateDaysBetween = (from?: string, to?: string) => {
  if (!from || !to) return [];
  const start = moment(from);
  const end = moment(to);
  const days: string[] = [];
  const current = start.clone();

  while (current.isSameOrBefore(end, "day")) {
    days.push(current.format("YYYY-MM-DD"));
    current.add(1, "day");
  }

  return days;
};

const ymdToDdMmYy = (ymd: string) => {
  if (!ymd) return "";
  const parts = ymd.includes("-") ? ymd.split("-") : ymd.split("/");
  const [y, m, d] = parts;
  if (!y || !m || !d) return ymd;
  return `${d}-${m}-${y}`;
};

const isSaveOk = (data: any) => {
  if (data == null) return false;
  const s = String(data).toLowerCase();
  return s.includes("success") || s.includes("successfully") || parseInt(s, 10) > 0;
};

const minutesBetween = (fromHHmm: string, toHHmm: string) => {
  if (!fromHHmm || !toHHmm) return 0;
  const start = new Date(`2000-01-01T${fromHHmm}:00`);
  const end = new Date(`2000-01-01T${toHHmm}:00`);
  const diff = (end.getTime() - start.getTime()) / 60000;
  return diff < 0 ? 0 : Math.floor(diff);
};

const asBool = (v: any) =>
  typeof v === "string" ? v.toLowerCase() === "true" : !!v;

const fmtDate = (val?: string) => {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return moment(d).format("DD-MM-YYYY");
};

const emptyVisit = (): VisitItem => ({
  partyName: "",
  location: "",
  latitude: "",
  longitude: "",
  demoProjects: [],
  contactPerson: "",
  mobile: "",
  visitFromTime: "",
  visitToTime: "",

  localTransportAmount: "",
  localTransportImage: null,

  visitSlipImage: null,
  remarks: "",
});
const emptyTripDay = (date: string): TripDayItem => ({
  dutyDate: date,
  readingFrom: "",
  readingTo: "",
  readingFromImage: null,
  readingToImage: null,
  distance: "",
  fuelAmount: "",
  fuelImage: null,
  visits: [emptyVisit()],
});

type OnDutiesProps = {
  // Passed down from the Requests page's All/Pending/Accepted/Rejected
  // filter bar when this component is embedded there for the "My
  // Requests" view - that filter bar previously had no effect here at all.
  statusFilter?: string;
};

const OnDuties: React.FC<OnDutiesProps> = ({ statusFilter }) => {
  const [empCode, setEmpCode] = useState<string>("");
  const [empName, setEmpName] = useState<string>("");
  const [userDesig, setUserDesig] = useState<string>("");
  const [userLoaded, setUserLoaded] = useState<boolean>(false);
  const didInitRef = useRef(false);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const modalContentRef = useRef<HTMLIonContentElement>(null);
  const savedScrollTop = useRef<number>(0);

  const saveModalScroll = async () => {
    if (modalContentRef.current) {
      try {
        const el = await modalContentRef.current.getScrollElement();
        savedScrollTop.current = el.scrollTop;
      } catch (e) {
        console.warn("Failed to get scroll elementS:", e);
      }
    }
  };

  const restoreModalScroll = () => {
    if (modalContentRef.current && savedScrollTop.current > 0) {
      const currentScroll = savedScrollTop.current;
      setTimeout(async () => {
        try {
          if (modalContentRef.current) {
            await modalContentRef.current.scrollToPoint(0, currentScroll, 0);
          }
        } catch (e) {
          console.warn("Failed to restore scroll (50ms):", e);
        }
      }, 50);

      setTimeout(async () => {
        try {
          if (modalContentRef.current) {
            await modalContentRef.current.scrollToPoint(0, currentScroll, 0);
          }
        } catch (e) {
          console.warn("Failed to restore scroll (150ms):", e);
        }
      }, 150);
    }
  };


  const api = useMemo(() => {
    return axios.create({ baseURL: API_BASE});
  }, []);

  const isAccountant = empCode === "1541";
  const isDirector = empCode === "1501";
  const canEdit = isAccountant || isDirector;
  const canApprove =
    isAccountant ||
    userDesig.includes("Team Leader") ||
    userDesig.includes("Manager");

  const [dateModalType, setDateModalType] = useState<"from" | "to" | null>(null);


  const [institution, setInstitution] = useState<string>("");
  const [dutiesDesc, setDutiesDesc] = useState<string>("");
  const [transportMode, setTransportMode] = useState<string>("");
  const [kms, setKms] = useState<string>("");
  const [vehicleNo, setVehicleNo] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [sReading, setSReading] = useState<string>("");
  const [eReading, setEReading] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [team, setTeam] = useState<EmployeeItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [dutiesList, setDutiesList] = useState<DutyRow[]>([]);
  const [editingId, setEditingId] = useState<string>("");
  const [tripDaysByDuty, setTripDaysByDuty] = useState<Record<string, TripDayItem[]>>({});
  const [showDayTripModal, setShowDayTripModal] = useState(false);
  const [editingTripIndex, setEditingTripIndex] = useState<number | null>(null);
  const [selectedDutyRow, setSelectedDutyRow] = useState<DutyRow | null>(null);
  const [selectedDutyId, setSelectedDutyId] = useState<string>("");
  const [toast, setToast] = useState<{ msg: string; color?: string } | null>(null);
  const [expandedTrips, setExpandedTrips] = useState<Record<string, boolean>>({});
  const [activeDutyTab, setActiveDutyTab] = useState<"my" | "team">("my");

const today = new Date().toISOString().split("T")[0];

const [unlockRange, setUnlockRange] = useState({
  approved: false,
  fromDate: "",
  toDate: ""
});



const [dutyFromDate, setDutyFromDate] = useState<string>(today);
const [dutyToDate, setDutyToDate] = useState<string | null>(null);


const maxDateObj = new Date(dutyFromDate || today);
maxDateObj.setDate(maxDateObj.getDate() + 6);
const maxDate = maxDateObj.toISOString().split("T")[0];
const [tripModalMode, setTripModalMode] =
  useState<"add" | "edit">("add");

  

const [fromModal, setFromModal] = useState(false);
const [toModal, setToModal] = useState(false);

// custom dropdown states
const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);
const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
const [isTransportDropdownOpen, setIsTransportDropdownOpen] = useState(false);

const [teamSearchTerm, setTeamSearchTerm] = useState("");
const [clientSearchTerm, setClientSearchTerm] = useState("");

const [teamDropdownPos, setTeamDropdownPos] = useState({ top: 0, left: 0, width: 0 });
const [clientDropdownPos, setClientDropdownPos] = useState({ top: 0, left: 0, width: 0 });
const [transportDropdownPos, setTransportDropdownPos] = useState({ top: 0, left: 0, width: 0 });

const teamTriggerRef = useRef<HTMLDivElement>(null);
const clientTriggerRef = useRef<HTMLDivElement>(null);
const transportTriggerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const updateDropdownPositions = () => {
    if (isTeamDropdownOpen && teamTriggerRef.current) {
      const rect = teamTriggerRef.current.getBoundingClientRect();
      setTeamDropdownPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
    }
    if (isClientDropdownOpen && clientTriggerRef.current) {
      const rect = clientTriggerRef.current.getBoundingClientRect();
      setClientDropdownPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
    }
    if (isTransportDropdownOpen && transportTriggerRef.current) {
      const rect = transportTriggerRef.current.getBoundingClientRect();
      setTransportDropdownPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
    }
  };

  window.addEventListener('resize', updateDropdownPositions);
  const container = contentRef.current;
  if (container) {
    container.addEventListener('scroll', updateDropdownPositions);
  }
  updateDropdownPositions();

  return () => {
    window.removeEventListener('resize', updateDropdownPositions);
    if (container) container.removeEventListener('scroll', updateDropdownPositions);
  };
}, [isTeamDropdownOpen, isClientDropdownOpen, isTransportDropdownOpen]);

const loadUnlockRange = async () => {
  const res = await fetch(
    `${API_BASE}ApprovalRequest/GetApprovedUnlockRequest?empCode=${empCode}&requestType=On%20Duty`
  );

  const data = await res.json();

  setUnlockRange(data);
};
useEffect(() => {
  if (!empCode) return;

  loadUnlockRange();
}, [empCode]);

  const notify = (msg: string, color: string = "primary") =>
    setToast({ msg, color });

  const postWithFallback = async (
    endpoint: string,
    data: any,
    contentType: string = "application/json"
  ): Promise<any> => {
    try {
      let payload = data;
      if (
        contentType === "application/x-www-form-urlencoded" ||
        contentType === "multipart/form-data"
      ) {
        const fd =
          contentType === "multipart/form-data"
            ? new FormData()
            : new URLSearchParams();

        Object.entries(data).forEach(([k, v]) => {
          fd.append(k, String(v ?? ""));
        });
        payload = fd;
      }

      return await api.post(endpoint, payload, {
        headers: { "Content-Type": contentType },
      });
    } catch (e: any) {
      if (e.response?.status === 400 || e.response?.status === 415) {
        if (contentType === "application/json") {
          return await postWithFallback(
            endpoint,
            data,
            "application/x-www-form-urlencoded"
          );
        }
        if (contentType === "application/x-www-form-urlencoded") {
          return await postWithFallback(endpoint, data, "multipart/form-data");
        }
      }
      throw e;
    }
  };


  const getTripDatesForDuty = (row: DutyRow) => {
    const fromDate = row.DateFrom
      ? moment(row.DateFrom).format("YYYY-MM-DD")
      : row.Date
        ? moment(row.Date).format("YYYY-MM-DD")
        : "";

    const toDate = row.DateTo
      ? moment(row.DateTo).format("YYYY-MM-DD")
      : fromDate;

    return generateDaysBetween(fromDate, toDate);
  };

  const openAddDayTripModal = (row: DutyRow) => {
  setTripModalMode("add");

  const allTripDates = getTripDatesForDuty(row);

  const normalize = (d: string) =>
    d ? new Date(d).toISOString().split("T")[0] : "";

  const currentTrips = tripDaysByDuty[row.id] || [];

  const existingDates = currentTrips.map((x) =>
    normalize(x.dutyDate)
  );

  const nextDate = allTripDates.find(
    (d) => !existingDates.includes(normalize(d))
  );

  if (!nextDate) {
    notify("All day trips already added", "warning");
    return;
  }

  const newTrip = emptyTripDay(normalize(nextDate));

  const newIndex = currentTrips.length;

  setTripDaysByDuty((prev) => ({
    ...prev,
    [row.id]: [...(prev[row.id] || []), newTrip],
  }));

  setSelectedDutyRow(row);
  setSelectedDutyId(row.id);
  setEditingTripIndex(newIndex);
  setShowDayTripModal(true);
};

  const openEditDayTripModal = (
  row: DutyRow,
  index: number
) => {
  setTripModalMode("edit");

  setSelectedDutyRow(row);
  setSelectedDutyId(row.id);
  setEditingTripIndex(index);
  setShowDayTripModal(true);
};

  const closeDayTripModal = () => {
    setShowDayTripModal(false);
    setEditingTripIndex(null);
  };
  const updateTripDay = (index: number, key: keyof TripDayItem, value: any) => {
    if (!selectedDutyId) return;

    setTripDaysByDuty((prev) => {
      const current = [...(prev[selectedDutyId] || [])];
      current[index] = {
        ...current[index],
        [key]: value,
      };
      return {
        ...prev,
        [selectedDutyId]: current,
      };
    });
  };
  const autoFillDistance = (tripIndex: number, fromVal: string, toVal: string) => {
    const fromNum = parseFloat(fromVal || "0");
    const toNum = parseFloat(toVal || "0");

    if (fromVal === "" || toVal === "") {
      updateTripDay(tripIndex, "distance", "");
      return;
    }

    if (isNaN(fromNum) || isNaN(toNum)) return;

    if (toNum < fromNum) {
      notify("Reading To should be greater than or equal to Reading From", "warning");
      return;
    }

    const distance = Math.round((toNum - fromNum) * 100) / 100;
    updateTripDay(tripIndex, "distance", String(distance));
  };
  const updateTripVisit = (
    tripIndex: number,
    visitIndex: number,
    key: keyof VisitItem,
    value: any
  ) => {
    if (!selectedDutyId) return;

    setTripDaysByDuty((prev) => {
      const current = [...(prev[selectedDutyId] || [])];
      current[tripIndex].visits[visitIndex] = {
        ...current[tripIndex].visits[visitIndex],
        [key]: value,
      };
      return {
        ...prev,
        [selectedDutyId]: current,
      };
    });
  };
  const mapTripRow = (r: any) => {
    if (Array.isArray(r)) {
      return {
        DayTrip_ID: r[0],
        Duty_Id: r[1],
        Duty_Date: r[2],
        Reading_From: r[3],
        Reading_To: r[4],
        Distance: r[5],
        Fuel_Amount: r[6],
        ReadingFrom_ImagePath: r[7],
        ReadingTo_ImagePath: r[8],
        Fuel_ImagePath: r[9],
        Visit_ID: r[10],
        Client_Name: r[11],
        VisitLocation: r[12],
        Latitude: r[13],
        Longitude: r[14],
        Visit_FromTime: r[15],
        Visit_ToTime: r[16],
        Projects: r[17],
        Contact_Person: r[18],
        Mobile_Number: r[19],
        Remarks: r[20],
        LocalTransportAmount: r[21],
        LocalTransportImagePath: r[22],
        Visit_ImagePath: r[23],
      };
    }

    return r;
  };

  const buildTripsFromRows = (rows: any[]): TripDayItem[] => {
    const grouped: Record<number, TripDayItem> = {};

    rows.forEach((raw: any) => {
      const r = mapTripRow(raw);

      const id = Number(r.DayTrip_ID ?? r.DayTrip_Id ?? r.dayTrip_Id ?? 0);
      if (!id) return;

      if (!grouped[id]) {
        grouped[id] = {
          dayTrip_Id: id,
          dutyDate: moment(r.Duty_Date ?? r.duty_Date).format("YYYY-MM-DD"),
          readingFrom: String(r.Reading_From ?? ""),
          readingTo: String(r.Reading_To ?? ""),
          distance: String(r.Distance ?? "0"),
          fuelAmount: String(r.Fuel_Amount ?? ""),
          readingFromImage: r.ReadingFrom_ImagePath || null,
          readingToImage: r.ReadingTo_ImagePath || null,
          fuelImage: r.Fuel_ImagePath || null,
          visits: [],
        };
      }

      const visitId = Number(r.Visit_ID ?? 0);
      if (visitId) {
        grouped[id].visits.push({
          visit_Id: visitId,
          partyName: r.Client_Name || "",
          location: r.VisitLocation || "",
          latitude: r.Latitude || "",
          longitude: r.Longitude || "",
          demoProjects: r.Projects ? String(r.Projects).split(",") : [],
          contactPerson: r.Contact_Person || "",
          mobile: r.Mobile_Number || "",
          visitFromTime: r.Visit_FromTime || "",
          visitToTime: r.Visit_ToTime || "",
          remarks: r.Remarks || "",
          localTransportAmount:
            r.LocalTransportAmount != null ? String(r.LocalTransportAmount) : "",
          visitSlipImage: r.Visit_ImagePath || null,
          localTransportImage: r.LocalTransportImagePath || null,
        });
      }
    });

    return Object.values(grouped);
  };
  const addTripVisit = (tripIndex: number) => {
    if (!selectedDutyId) return;

    setTripDaysByDuty((prev) => {
      const currentTrips = [...(prev[selectedDutyId] || [])];
      const targetTrip = currentTrips[tripIndex];

      if (!targetTrip) return prev;

      currentTrips[tripIndex] = {
        ...targetTrip,
        visits: [...targetTrip.visits, emptyVisit()],
      };

      return {
        ...prev,
        [selectedDutyId]: currentTrips,
      };
    });
  };



  const loadDayTrips = async (dutyId: string) => {
    try {
      const res = await api.get("OnDuty/get_daytrips", {
        params: { dutyId },
      });

      const rows =
        typeof res.data === "string" ? JSON.parse(res.data) : res.data;

      const trips = buildTripsFromRows(Array.isArray(rows) ? rows : []);

      setTripDaysByDuty((prev) => ({
        ...prev,
        [dutyId]: trips,
      }));
    } catch (error) {
      console.error("loadDayTrips error:", error);
      notify("Failed to load day trips", "danger");
    }
  };

  const isSavingTrip = useRef(false);

  const saveDayTripModal = async () => {
    if (isSavingTrip.current) return;
    isSavingTrip.current = true;
    if (
      !selectedDutyId ||
      editingTripIndex === null ||
      editingTripIndex === undefined
    ) {
      notify("Invalid trip state", "warning");
      return;
    }

    const trips = tripDaysByDuty[selectedDutyId] || [];
    const trip =
      editingTripIndex != null &&
      editingTripIndex >= 0 &&
      editingTripIndex < trips.length
        ? trips[editingTripIndex]
        : null;

    if (!trip) {
      notify("Trip data missing", "danger");
      return;
    }

    // ===== VALIDATION =====

    // Public Transport → only distance required
    if (isPublicTransport) {
      if (!trip.distance || Number(trip.distance) <= 0) {
        notify("Distance is required for Public Transport", "warning");
        return;
      }
    }

    // Office / Own Vehicle → reading required
    if (!isPublicTransport) {
      if (
        !trip.readingFrom ||
        !trip.readingFromImage
      ) {
        notify("Reading values and images are required", "warning");
        return;
      }
    }

    // At least one visit required (Only in EDIT mode)
    if (tripModalMode === "edit") {
      if (!trip.visits || !trip.visits.length) {
        notify("At least one visit required", "warning");
        return;
      }
    }

    const formData = new FormData();

    formData.append("duty_Id", selectedDutyId);
    formData.append("duty_Date", trip.dutyDate);

    // Transport based data handling
    if (isPublicTransport) {
      // Public Transport
      formData.append("reading_From", "0");
      formData.append("reading_To", "0");
      formData.append("distance", trip.distance || "0");
      formData.append("fuel_Amount", "0");
    } else {
      // Office / Own Vehicle
      formData.append("reading_From", trip.readingFrom || "0");
      formData.append("reading_To", trip.readingTo || "0");
      formData.append("distance", trip.distance || "0");

      // Fuel only for Office vehicle
      if (isOfficeVehicle) {
        formData.append("fuel_Amount", trip.fuelAmount || "0");
      } else {
        formData.append("fuel_Amount", "0");
      }
    }
    formData.append("created_By", empCode);

    // images 
    if (!isPublicTransport) {
      if (trip.readingFromImage instanceof File) {
        formData.append("ReadingFrom_Image", trip.readingFromImage);
      } else if (typeof trip.readingFromImage === "string" && trip.readingFromImage.trim() !== "") {
        formData.append("ReadingFrom_ImagePath", trip.readingFromImage);
      }

      if (trip.readingToImage instanceof File) {
        formData.append("ReadingTo_Image", trip.readingToImage);
      } else if (typeof trip.readingToImage === "string" && trip.readingToImage.trim() !== "") {
        formData.append("ReadingTo_ImagePath", trip.readingToImage);
      }
    }

    // Fuel image only for Office vehicle
    if (isOfficeVehicle) {
      if (trip.fuelImage instanceof File) {
        formData.append("Fuel_Image", trip.fuelImage);
      } else if (typeof trip.fuelImage === "string" && trip.fuelImage.trim() !== "") {
        formData.append("Fuel_ImagePath", trip.fuelImage);
      }
    }

    // visits (Only in EDIT mode)
    if (tripModalMode === "edit") {
      trip.visits.forEach((v, i) => {
        formData.append(`visits[${i}].visit_Id`, String(v.visit_Id || 0));
        formData.append(`visits[${i}].client_Name`, v.partyName);
        formData.append(`visits[${i}].location`, v.location);
        formData.append(`visits[${i}].latitude`, v.latitude || "");
        formData.append(`visits[${i}].longitude`, v.longitude || "");
        formData.append(`visits[${i}].visit_FromTime`, v.visitFromTime);
        formData.append(`visits[${i}].visit_ToTime`, v.visitToTime);
        formData.append(`visits[${i}].projects`, (v.demoProjects || []).join(","));
        formData.append(`visits[${i}].contact_Person`, v.contactPerson);
        formData.append(`visits[${i}].mobile_Number`, v.mobile);
        formData.append(`visits[${i}].remarks`, v.remarks);
        formData.append(`visits[${i}].localTransportAmount`, v.localTransportAmount || "");

        if (v.visitSlipImage instanceof File) {
          formData.append(`visits[${i}].visit_Image`, v.visitSlipImage);
        } else if (typeof v.visitSlipImage === "string" && v.visitSlipImage.trim() !== "") {
          formData.append(`visits[${i}].visit_ImagePath`, v.visitSlipImage);
        }

        if (v.localTransportImage instanceof File) {
          formData.append(`visits[${i}].localTransportImage`, v.localTransportImage);
        } else if (
          typeof v.localTransportImage === "string" &&
          v.localTransportImage.trim() !== ""
        ) {
          formData.append(`visits[${i}].localTransportImagePath`, v.localTransportImage);
        }
      });
    }

    try {
      const res = await api.post("OnDuty/save_daytrip", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      notify("Trip Saved Successfully", "success");
      await loadDuties();

      closeDayTripModal();

    } catch (error: any) {
      let errorMsg = "Save failed";
      if (error?.response?.data) {
        if (typeof error.response.data === "string") {
          errorMsg = error.response.data;
        } else if (typeof error.response.data === "object") {
          errorMsg = error.response.data.message || error.response.data.error || JSON.stringify(error.response.data);
        }
      } else if (error?.message) {
        errorMsg = error.message;
      }

      notify(errorMsg, "danger");
    } finally {
      isSavingTrip.current = false;
    }
  };
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    try {
      const stored =
        localStorage.getItem("storedUser") ||
        localStorage.getItem("user") ||
        localStorage.getItem("userData");

      if (stored) {
        const s = JSON.parse(stored);
        setEmpCode(String(s.empCode || s.username || ""));
        setEmpName(String(s.empName || ""));
        setUserDesig(String(s.designation || ""));
      }
    } catch (e) {
      console.warn("User parse error", e);
    } finally {
      setUserLoaded(true);
    }
  }, []);

  const loadTeam = async () => {
    try {
      const res = await api.get("OnDuty/load_employees_duties", {
        params: { empCode, designation: userDesig },
      });

      const raw = Array.isArray(res.data) ? res.data : [];
      setTeam(
        raw.map((x: any) => ({
          EmpCode: x[0],
          EmpName: x[1],
          Role: x[2],
          Designation: x[3],
          Ischeck: asBool(x[4]),
          Mobile: x[5],
          RequestTo: x[5],
        }))
      );
    } catch {
      notify("Failed to load employees", "danger");
    }
  };
  const removeTripVisit = async (tripIndex: number, visitIndex: number) => {
    if (!selectedDutyId) return;

    const trip = (tripDaysByDuty[selectedDutyId] || [])[tripIndex];
    const visit = trip?.visits?.[visitIndex];

    if (!visit) return;

    // saved visit -> delete from DB
    if (visit.visit_Id && visit.visit_Id > 0) {
      try {
        await api.delete("OnDuty/delete_visit", {
          params: { visitId: visit.visit_Id },
        });

        setTripDaysByDuty((prev) => {
          const current = [...(prev[selectedDutyId] || [])];
          current[tripIndex] = {
            ...current[tripIndex],
            visits: current[tripIndex].visits.filter((_, i) => i !== visitIndex),
          };
          return {
            ...prev,
            [selectedDutyId]: current,
          };
        });

        notify("Visit deleted successfully", "success");
        return;
      } catch {
        notify("Failed to delete visit", "danger");
        return;
      }
    }

    // unsaved visit -> remove only from state
    setTripDaysByDuty((prev) => {
      const current = [...(prev[selectedDutyId] || [])];
      if (current[tripIndex].visits.length === 1) return prev;

      current[tripIndex] = {
        ...current[tripIndex],
        visits: current[tripIndex].visits.filter((_, i) => i !== visitIndex),
      };

      return {
        ...prev,
        [selectedDutyId]: current,
      };
    });
  };
  const loadClients = async (search: string = "") => {
    try {
      const res = await api.get("Workreport/Load_Clients", {
        params: { College: search },
      });
      const raw = Array.isArray(res.data) ? res.data : [];
      setClients(
        raw.map((x: any) => ({
          Client_ID: String(x[0]),
          Client_Name: x[1],
        }))
      );
    } catch {
      setClients([]);
    }
  };
  const loadAllTrips = async (duties: DutyRow[]) => {
    const result: Record<string, TripDayItem[]> = {};

    await Promise.all(
      duties.map(async (duty) => {
        try {
          const res = await api.get("OnDuty/get_daytrips", {
            params: { dutyId: duty.id },
          });

          const rows =
            typeof res.data === "string" ? JSON.parse(res.data) : res.data;

          result[duty.id] = buildTripsFromRows(Array.isArray(rows) ? rows : []);
        } catch (error) {
          console.error("loadAllTrips error for duty:", duty.id, error);
          result[duty.id] = [];
        }
      })
    );

    setTripDaysByDuty(result);
  };

  // The backend serializes these anonymous objects inconsistently (some
  // camelCase, some PascalCase depending on the endpoint), so pick whichever
  // casing shows up rather than assuming one.
  const pick = (d: any, ...keys: string[]) => {
    for (const k of keys) {
      if (d[k] !== undefined && d[k] !== null && d[k] !== "") return d[k];
    }
    return undefined;
  };

  const mapDutyRows = (rawData: any[]): DutyRow[] =>
    rawData.map((d: any) => ({
      id: String(d.id),
      College: d.college || "",
      Description: d.description || "",
      Mode_of_Trans: d.mode || "",
      Vehicle_No: d.vehicle_No || "",
      Location: d.location || "",
      Status: d.status || "Pending",
      DateFrom: d.dateFrom || "",
      DateTo: d.dateTo || "",
      empNames:
        d.empNames ||
        d.EmpNames ||
        d.empnames ||
        d.Empname ||
        d.empname,
      // Note: ASP.NET Core's default camelCase JSON policy only lowercases
      // the FIRST letter of a property name, so "RA1" serializes as "rA1"
      // (capital A kept) and "RA1_Status" as "rA1_Status" - not "ra1"/
      // "ra1_Status" as you'd expect from a normal camelCase conversion.
      // Checking all variants defensively since we've seen this backend mix
      // casing conventions across endpoints.
      CurrentLevel: pick(d, "currentLevel", "CurrentLevel"),
      MaxLevel: pick(d, "maxLevel", "MaxLevel"),
      CurrentRA: pick(d, "currentRA", "CurrentRA", "currentRa"),
      MatrixType: pick(d, "matrixType", "MatrixType"),
      RA1: pick(d, "rA1", "ra1", "RA1"),
      RA2: pick(d, "rA2", "ra2", "RA2"),
      RA3: pick(d, "rA3", "ra3", "RA3"),
      RA4: pick(d, "rA4", "ra4", "RA4"),
      RA1_Status: pick(d, "rA1_Status", "ra1_Status", "RA1_Status", "ra1Status", "rA1Status"),
      RA2_Status: pick(d, "rA2_Status", "ra2_Status", "RA2_Status", "ra2Status", "rA2Status"),
      RA3_Status: pick(d, "rA3_Status", "ra3_Status", "RA3_Status", "ra3Status", "rA3Status"),
      RA4_Status: pick(d, "rA4_Status", "ra4_Status", "RA4_Status", "ra4Status", "rA4Status"),
    }));

  const loadDuties = async () => {
    try {
      const res = await api.get("OnDuty/load_my_duties", {
        params: { EmpCode: empCode },
      });

      const rawData = Array.isArray(res.data) ? res.data : [];
      const mapped: DutyRow[] = mapDutyRows(rawData).map((row) => ({
        ...row,
        isOwn: true,
      }));

      // Approvers (accountant / team leader / manager) also see their team's
      // duty requests, with status, so they can act on them below. These are
      // tagged isOwn: false and always appended after the user's own rows,
      // so the render below can split them into a separate section.
      if (canApprove) {
        try {
          const teamRes = await api.get("OnDuty/load_duties_full", {
            params: { EmpCode: empCode },
          });

          const teamRaw = Array.isArray(teamRes.data) ? teamRes.data : [];
          const teamMapped = mapDutyRows(teamRaw).map((row) => ({
            ...row,
            isOwn: false,
          }));

          const seenIds = new Set(mapped.map((row) => row.id));
          teamMapped.forEach((row) => {
            if (!seenIds.has(row.id)) {
              mapped.push(row);
              seenIds.add(row.id);
            }
          });
        } catch (teamErr) {
          console.error("loadTeamDuties error:", teamErr);
        }
      }

      setDutiesList(mapped);
      await loadAllTrips(mapped);
    } catch (err) {
      console.error("loadDuties error:", err);
      setDutiesList([]);
      setTripDaysByDuty({});
    }
  };

  const formatEmployeeNames = (value: any) => {
  if (!value) return [];

  const str = String(value);

  return str
    .split(",")
    .map((x) => {
      const parts = x.split("-");

      if (parts.length >= 2) {
        const empCode = parts[0]?.trim();

        const empNames = parts
          .slice(1)
          .join("-")
          .trim();

        return {
          code: empCode,
          name:
            empNames.charAt(0).toUpperCase() +
            empNames.slice(1).toLowerCase(),
        };
      }

      return {
        code: "",
        name: x.trim(),
      };
    })
    .filter((x) => x.name);
};





  const [previewFile, setPreviewFile] = useState<File | string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const openFilePreview = (file: File | string | null | undefined) => {
    if (!file) return;
    setPreviewFile(file);
    setPreviewOpen(true);
  };
  const removeTripDay = async (dutyId: string, tripIndex: number) => {
    const trip = tripDaysByDuty[dutyId][tripIndex];

    if (!trip?.dayTrip_Id) {
      notify("Trip not saved yet", "warning");
      return;
    }

    try {
      await api.delete("OnDuty/delete_daytrip", {
        params: { dayTripId: trip.dayTrip_Id },
      });

      await loadDayTrips(dutyId);

      notify("Deleted Successfully", "success");
    } catch {
      notify("Delete failed", "danger");
    }
  };
  useEffect(() => {
    if (userLoaded && empCode) {
      loadTeam();
      loadClients();
      loadDuties();

    }
  }, [userLoaded, empCode]);

  useEffect(() => {
    if (team.length === 1) {
      setSelectedCodes([team[0].EmpCode]);
    }
  }, [team]);

  const onEndReadingChange = (val: string) => {
    setEReading(val);
    const s = parseFloat(sReading || "0");
    const e = parseFloat(val || "0");

    if (val && !isNaN(s) && !isNaN(e)) {
      if (e < s) {
        notify("End reading must be more than start", "warning");
        setKms("");
      } else {
        setKms(`${e - s}Kms`);
      }
    }
  };

  const saveOnDuty = async () => {
    if (!institution || !dutiesDesc || !transportMode || !location || !empCode || !dutyFromDate || !dutyToDate 
      || (
      transportMode !== "PublicTransport" &&
      !vehicleNo
    )
  ) {
      notify("Please fill all required fields", "warning");
      return;
    }

    const payload = {
      _id: editingId || "0",
      _empcode: empCode,
      _EmpCodes: selectedCodes.join(",") || empCode,
      _FromDate: moment(dutyFromDate).format("YYYY-MM-DD"),
      _ToDate: moment(dutyToDate).format("YYYY-MM-DD"),
      _Client: institution,
      _Description: dutiesDesc,
      _TransportMode: transportMode,
      _Starttime: startTime,
      _Endtime: endTime,
      _VehicleNo: vehicleNo,
      _StartReading: sReading,
      _EndReading: eReading,
      _KMS: kms.replace("Kms", ""),
      _Location: location,
    };

    try {
      const res = await postWithFallback("OnDuty/saveduties", payload);
      if (isSaveOk(res.data)) {
        notify("On-Duty request submitted successfully", "success");
        clearOnDutyForm();
        loadDuties();
      }
    } catch {
      notify("Submission failed", "danger");
    }
  };

  const editOnDuty = async (id: string) => {
    if (!canEdit && !canApprove) {
      notify("Permission Denied", "danger");
      return;
    }

    try {
      const res = await api.get("OnDuty/edit_onduties", {
        params: { EmpCode: empCode, id },
      });

      const row = Array.isArray(res.data) && res.data[0] ? res.data[0] : null;

      if (row) {
        setEditingId(String(row[0]));
        setSelectedCodes(String(row[1]).split(",").filter(Boolean));
        setDutyFromDate(
          row[13]
            ? new Date(row[13]).toISOString()
            : row[2]
              ? new Date(row[2]).toISOString()
              : new Date().toISOString()
        );
        setDutyToDate(
          row[14]
            ? new Date(row[14]).toISOString()
            : row[2]
              ? new Date(row[2]).toISOString()
              : new Date().toISOString()
        );
        setInstitution(row[3]);
        setLocation(row[15] || "");
        setDutiesDesc(row[4]);
        setTransportMode(row[5]);
        setKms(row[6]);
        setStartTime(row[7]);
        setEndTime(row[8]);
        setVehicleNo(row[9]);
        setSReading(row[10]);
        setEReading(row[11]);
        contentRef.current?.scrollToTop(500);
        notify("Record loaded for editing");
      }
    } catch (e) {
      console.error("editOnDuty error:", e);
      notify("Failed to load record", "danger");
    }
  };

  // Which RA slot (1-4), if any, belongs to the logged-in user. Matches by
  // exact empCode first, falling back to a loose designation match since RA
  // values may be stored as either employee codes or role names.
  // Collapse whitespace and case so "Business  Manager" / "business manager"
  // / "Business Manager" all compare equal.
  const normalizeRole = (s: any) =>
    (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");

  const roleMatchesUser = (ra: any) => {
    const raNorm = normalizeRole(ra);
    if (!raNorm || raNorm === "-") return false;
    if (ra === empCode) return true;

    const desigNorm = normalizeRole(userDesig);
    if (!desigNorm) return false;

    return (
      raNorm === desigNorm ||
      desigNorm.includes(raNorm) ||
      raNorm.includes(desigNorm)
    );
  };

  // A role title (e.g. "Business Manager") can appear in more than one RA
  // slot, or the same person's decision can live at whichever slot number
  // was assigned to them for THIS record - so we check every slot that
  // matches the user's role, not just the first one, and treat the row as
  // "already decided by me" if any of those matched slots has a verdict.
  const getMyDecisionStatus = (row: DutyRow): string => {
    const raSlots = [row.RA1, row.RA2, row.RA3, row.RA4];
    const statuses = [row.RA1_Status, row.RA2_Status, row.RA3_Status, row.RA4_Status];

    for (let i = 0; i < raSlots.length; i++) {
      if (!roleMatchesUser(raSlots[i])) continue;

      const s = normalizeRole(statuses[i]);
      if (s === "approved" || s === "rejected") return s;
    }

    return "";
  };

  // Builds the "Approved By: Business Manager → HR" trail - one entry per
  // populated RA1..RA4 slot, colored by that slot's own status (approved =
  // green, rejected = red, still pending = blue).
  const getDutyChain = (row: DutyRow) => {
    const slots = [
      { role: row.RA1, status: row.RA1_Status },
      { role: row.RA2, status: row.RA2_Status },
      { role: row.RA3, status: row.RA3_Status },
      { role: row.RA4, status: row.RA4_Status },
    ];

    return slots
      .filter((s) => {
        const roleNorm = normalizeRole(s.role);
        return roleNorm && roleNorm !== "-";
      })
      .map((s) => {
        const st = normalizeRole(s.status);
        const color =
          st === "approved" || st === "accepted"
            ? "approved"
            : st === "rejected"
            ? "rejected"
            : "pending";
        return { role: String(s.role).trim(), color };
      });
  };

  // Whether it's currently the logged-in user's turn: CurrentLevel names a
  // slot number, and that specific slot's RA value must match the user -
  // matching some OTHER slot doesn't make it their turn.
  const isMyTurn = (row: DutyRow): boolean => {
    const currentLevel = row.CurrentLevel ? parseInt(String(row.CurrentLevel), 10) : null;
    if (!currentLevel || currentLevel < 1 || currentLevel > 4) return false;

    const raSlots = [row.RA1, row.RA2, row.RA3, row.RA4];
    return roleMatchesUser(raSlots[currentLevel - 1]);
  };

  const isFinalStatus = (row: DutyRow) => {
    const s = (row.Status || "").toLowerCase();
    return s === "approved" || s === "rejected";
  };

  // Per-card approve/reject for the team-duties list. Reject only needs the
  // id, but approve's stored proc expects the full duty payload, so we fetch
  // it fresh from edit_onduties rather than relying on the top form's state
  // (which may hold an unrelated record the user is mid-editing).
  // approve_onduty is the RA-chain-aware endpoint: it advances CurrentLevel/
  // RA{n}_Status server-side based on _empcode's position in RA1..RA4,
  // rather than force-completing the whole request like SaveDuties_Approve
  // does. The controller only ever returns Ok(...) on success and throws
  // (caught below) on failure, so reaching past the await means it worked.
  const approveDutyRow = async (row: DutyRow) => {
    try {
      await postWithFallback("OnDuty/approve_onduty", {
        _id: row.id,
        Status: "Approve",
        _empcode: empCode,
      });
      notify("Approved successfully", "success");
      loadDuties();
    } catch {
      notify("Approval failed", "danger");
    }
  };

  const rejectDutyRow = async (row: DutyRow) => {
    try {
      await postWithFallback("OnDuty/approve_onduty", {
        _id: row.id,
        Status: "Reject",
        _empcode: empCode,
      });
      notify("Request rejected", "warning");
      loadDuties();
    } catch {
      notify("Rejection failed", "danger");
    }
  };

  const minCampDate = moment().format("YYYY-MM-DD");
  const maxCampDate = moment().add(1, "month").format("YYYY-MM-DD");

  const clearOnDutyForm = () => {
    setEditingId("");
    setInstitution("");
    setDutiesDesc("");
    setTransportMode("");
    setKms("");
    setVehicleNo("");
    setLocation("");
    setSReading("");
    setEReading("");
    setStartTime("");
    setEndTime("");
    setSelectedCodes([]);
    setDutyFromDate(new Date().toISOString());
    setDutyToDate(new Date().toISOString());
    setDateModalType(null);
    setTripDaysByDuty({});
    setShowDayTripModal(false);
    setEditingTripIndex(null);
    setSelectedDutyRow(null);
    setSelectedDutyId("");
  };

  const getFileName = (file: File | string | null | undefined) => {
    if (!file) return "";
    if (file instanceof File) return file.name;
    if (typeof file === "string") return file.split("/").pop() || "";
    return "";
  };
  const tagVisitLocation = (tripIndex: number, visitIndex: number) => {
    if (!navigator.geolocation) {
      notify("Geolocation not supported", "danger");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);

        updateTripVisit(tripIndex, visitIndex, "latitude", lat);
        updateTripVisit(tripIndex, visitIndex, "longitude", lng);

        notify("Geo Tagged Successfully", "success");
      },
      () => notify("Permission denied", "warning"),
      { enableHighAccuracy: true }
    );
  };
  const currentModalTrip =
    selectedDutyId && editingTripIndex !== null
      ? (tripDaysByDuty[selectedDutyId] || [])[editingTripIndex]
      : null;

  const transportModeModal = selectedDutyRow?.Mode_of_Trans || "";

  const isPublicTransport = transportModeModal === "PublicTransport";

  const isOfficeVehicle =
    transportModeModal === "Office 4 Wheeler" ||
    transportModeModal === "Office 2 Wheeler";

  const isOwnVehicle =
    transportModeModal === "Own 2 Wheeler" ||
    transportModeModal === "Own 4 Wheeler";

  const getFileLabel = (file: File | string | null | undefined) => {
    if (!file) return "";
    if (file instanceof File) return file.name;
    if (typeof file === "string") return "View";
    return "";
  };
  const getGeoLabel = (lat?: string, lng?: string) => {
    return lat && lng ? "View" : "";
  };
  const viewLinkStyle: React.CSSProperties = {
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "underline",
    lineHeight: "20px",
  };

  const getPreviewUrl = (file: File | string | null | undefined) => {
    if (!file) return "";

    if (file instanceof File) {
      return URL.createObjectURL(file);
    }

    if (typeof file === "string") {
      let path = file.trim();

      if (/^https?:\/\//i.test(path)) {
        return path;
      }

      path = path.replace(/^\/?api\//i, "/");

      const base = API_BASE.replace(/\/api\/?$/i, "").replace(/\/$/, "");
      return `${base}${path.startsWith("/") ? path : `/${path}`}`;
    }

    return "";
  };
  const history = useHistory();
  return (
    <div className="onduties-page">
      <div className="onduties-content">
        <div style={{ display: "flex", gap: "1px", marginTop: "5px" }}>
        </div>


        <div className="page-container">
          <h2 style={{ margin: 0, fontWeight: 700 }}>Duty Manager</h2>
          <div>

            <div className="lr-bento-grid" style={{ alignItems: "start", marginBottom: "20px" }}>
              {/* Team Members */}
              <div className="lr-field-box" onClick={() => setIsTeamDropdownOpen(!isTeamDropdownOpen)}>
                <label className="lr-field-label">Team Members</label>
                <div className="lr-field-content" ref={teamTriggerRef}>
                  <IonIcon icon={peopleOutline} className="lr-field-icon" />
                  {team.length > 1 ? (
                    <>
                      <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: selectedCodes.length ? "#1e293b" : "#94a3b8" }}>
                        {selectedCodes.length > 0 ? `${selectedCodes.length} Selected` : "Select Team"}
                      </span>
                      <ChevronDown size={16} style={{ opacity: 0.7, color: "#94a3b8" }} />

                      {isTeamDropdownOpen && createPortal(
                        <>
                          <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsTeamDropdownOpen(false); }} />
                          <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${teamDropdownPos.top}px`, left: `${teamDropdownPos.left}px`, width: `${teamDropdownPos.width}px` }}>
                            <div className="dropdown-search-sec">
                              <Search size={16} className="dropdown-search-icon" />
                              <input type="text" placeholder="Search team..." value={teamSearchTerm} onChange={(e) => setTeamSearchTerm(e.target.value)} autoFocus className="dropdown-pure-input" />
                              {teamSearchTerm && <button className="dropdown-clear-btn" onClick={() => setTeamSearchTerm("")}><X size={16} /></button>}
                            </div>
                            <div className="dropdown-body">
                              {team.filter(t => (t.EmpName || "").toLowerCase().includes(teamSearchTerm.toLowerCase())).length > 0 ? (
                                team.filter(t => (t.EmpName || "").toLowerCase().includes(teamSearchTerm.toLowerCase())).map((emp, index) => {
                                  const isSelected = selectedCodes.includes(emp.EmpCode);
                                  const initials = (emp.EmpName?.charAt(0) || "?").toUpperCase();
                                  return (
                                    <div
                                      key={index}
                                      className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (isSelected) {
                                          setSelectedCodes(selectedCodes.filter(c => c !== emp.EmpCode));
                                        } else {
                                          setSelectedCodes([...selectedCodes, emp.EmpCode]);
                                        }
                                      }}
                                    >
                                      <div className={`dr-avatar grad-${(index % 5) || 0}`}>{initials}</div>
                                      <div className="dr-info">
                                        <span className="dr-name">{emp.EmpName}</span>
                                        <span className="dr-id">ID: {emp.EmpCode}</span>
                                      </div>
                                      {isSelected && <Check size={18} className="dr-check" />}
                                    </div>
                                  );
                                })
                              ) : <div className="dr-no-results">No members found</div>}
                            </div>
                          </div>
                        </>,
                        document.body
                      )}
                    </>
                  ) : (
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "#1e293b" }}>
                      {team[0]?.EmpName || "-"}
                    </span>
                  )}
                </div>
              </div>

              {/* Camp From Date & To Date Wrapper */}
              <div className="lr-field-box" onClick={() => setDateModalType("from")} style={{ cursor: "pointer" }}>
                <label className="lr-field-label">Camp From Date</label>
                <div className="lr-field-content">
                  <IonIcon icon={calendarOutline} className="lr-field-icon" />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: dutyFromDate ? "#1e293b" : "#94a3b8" }}>
                    {dutyFromDate ? moment(dutyFromDate).format("DD-MM-YYYY") : "Pick From Date"}
                  </span>
                </div>
              </div>

              <div className="lr-field-box" onClick={() => setDateModalType("to")} style={{ cursor: "pointer" }}>
                <label className="lr-field-label">Camp To Date</label>
                <div className="lr-field-content">
                  <IonIcon icon={calendarOutline} className="lr-field-icon" />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: dutyToDate ? "#1e293b" : "#94a3b8" }}>
                    {dutyToDate ? moment(dutyToDate).format("DD-MM-YYYY") : "Pick To Date"}
                  </span>
                </div>
              </div>

              {/* Modals for Dates */}
              <IonModal isOpen={!!dateModalType} onDidDismiss={() => setDateModalType(null)} className="native-date-modal">
                <div className="native-date-modal-wrapper">
                  <IonDatetime
                    presentation="date"
                    preferWheel={true}
                    showDefaultButtons={true}
                    value={dateModalType === "from" ? dutyFromDate : dutyToDate}
                    min={dateModalType === "from" ? (unlockRange.approved ? unlockRange.fromDate : today) : (dutyFromDate === unlockRange.fromDate ? unlockRange.fromDate : (dutyFromDate || today))}
                    max={dateModalType === "from" ? maxDate : (dutyFromDate === unlockRange.fromDate ? unlockRange.toDate : maxDate)}
                    isDateEnabled={dateModalType === "from" ? ((dateString) => {
                      const date = dateString.split("T")[0];
                      if (date === dutyFromDate) return true;
                      const todayStr = new Date().toISOString().split("T")[0];
                      if (unlockRange.approved && date >= unlockRange.fromDate && date <= unlockRange.toDate) return true;
                      return date >= todayStr;
                    }) : undefined}
                    onIonChange={(e) => {
                      const val = String(e.detail.value || "");
                      if (dateModalType === "from") {
                        setDutyFromDate(val);
                        if (!dutyToDate || moment(val).isAfter(dutyToDate)) setDutyToDate(val);
                      } else {
                        setDutyToDate(val);
                      }
                    }}
                    onIonCancel={() => setDateModalType(null)}
                  />
                </div>
              </IonModal>

              {/* Client / Institution */}
              <div className="lr-field-box" onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}>
                <label className="lr-field-label">Client / Institution</label>
                <div className="lr-field-content" ref={clientTriggerRef}>
                  <IonIcon icon={businessOutline} className="lr-field-icon" />
                  <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: institution ? "#1e293b" : "#94a3b8" }}>
                    {institution || "Search Party / Client"}
                  </span>
                  <ChevronDown size={16} style={{ opacity: 0.7, color: "#94a3b8" }} />

                  {isClientDropdownOpen && createPortal(
                    <>
                      <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsClientDropdownOpen(false); }} />
                      <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${clientDropdownPos.top}px`, left: `${clientDropdownPos.left}px`, width: `${clientDropdownPos.width}px` }}>
                        <div className="dropdown-search-sec">
                          <Search size={16} className="dropdown-search-icon" />
                          <input type="text" placeholder="Search client..." value={clientSearchTerm} onChange={(e) => setClientSearchTerm(e.target.value)} autoFocus className="dropdown-pure-input" />
                          {clientSearchTerm && <button className="dropdown-clear-btn" onClick={() => setClientSearchTerm("")}><X size={16} /></button>}
                        </div>
                        <div className="dropdown-body">
                          {[{ Client_Name: "Party" }, ...clients].filter(c => c.Client_Name.toLowerCase().includes(clientSearchTerm.toLowerCase())).length > 0 ? (
                            [{ Client_Name: "Party" }, ...clients].filter(c => c.Client_Name.toLowerCase().includes(clientSearchTerm.toLowerCase())).map((c, index) => {
                              const isSelected = institution === c.Client_Name;
                              const initials = (c.Client_Name.charAt(0) || "?").toUpperCase();
                              return (
                                <div
                                  key={index}
                                  className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setInstitution(c.Client_Name);
                                    setIsClientDropdownOpen(false);
                                  }}
                                >
                                  <div className={`dr-avatar grad-${(index % 5) || 0}`}>{initials}</div>
                                  <div className="dr-info">
                                    <span className="dr-name">{c.Client_Name}</span>
                                  </div>
                                  {isSelected && <Check size={18} className="dr-check" />}
                                </div>
                              );
                            })
                          ) : <div className="dr-no-results">No clients found</div>}
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              </div>

              {/* Location */}
              <div className="lr-field-box">
                <label className="lr-field-label">Location</label>
                <div className="lr-field-content">
                  <IonIcon icon={locationOutline} className="lr-field-icon" />
                  <input
                    type="text"
                    placeholder="Vijayawada"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    style={{ border: "none", outline: "none", background: "transparent", flex: 1, color: "#1e293b", fontSize: "14px", fontWeight: "500" }}
                  />
                </div>
              </div>

              {/* Transport */}
              <div className="lr-field-box" onClick={() => setIsTransportDropdownOpen(!isTransportDropdownOpen)}>
                <label className="lr-field-label">Transport</label>
                <div className="lr-field-content" ref={transportTriggerRef}>
                  <IonIcon icon={carOutline} className="lr-field-icon" />
                  <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: transportMode ? "#1e293b" : "#94a3b8" }}>
                    {transportMode || "Select Transport"}
                  </span>
                  <ChevronDown size={16} style={{ opacity: 0.7, color: "#94a3b8" }} />

                  {isTransportDropdownOpen && createPortal(
                    <>
                      <div className="dropdown-outside-click-layer" onClick={(e) => { e.stopPropagation(); setIsTransportDropdownOpen(false); }} />
                      <div className="custom-inline-dropdown" onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: `${transportDropdownPos.top}px`, left: `${transportDropdownPos.left}px`, width: `${transportDropdownPos.width}px` }}>
                        <div className="dropdown-body" style={{ height: 'auto', maxHeight: '180px' }}>
                          {["PublicTransport", "Office 4 Wheeler", "Office 2 Wheeler", "Own 2 Wheeler", "Own 4 Wheeler"].map((loc, index) => {
                            const isSelected = transportMode === loc;
                            const initials = loc.charAt(0);
                            return (
                              <div
                                key={index}
                                className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setTransportMode(loc);
                                  setIsTransportDropdownOpen(false);
                                }}
                              >
                                <div className={`dr-avatar grad-${(index % 5) || 0}`}>{initials}</div>
                                <div className="dr-info">
                                  <span className="dr-name">{loc}</span>
                                </div>
                                {isSelected && <Check size={18} className="dr-check" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              </div>

              {/* Vehicle No */}
              {transportMode !== "PublicTransport" && (
                <div className="lr-field-box">
                  <label className="lr-field-label">Vehicle No</label>
                  <div className="lr-field-content">
                    <IonIcon icon={carOutline} className="lr-field-icon" />
                    <input
                      type="text"
                      placeholder="AP16..."
                      value={vehicleNo}
                      onChange={(e) => setVehicleNo(e.target.value)}
                      style={{ border: "none", outline: "none", background: "transparent", flex: 1, color: "#1e293b", fontSize: "14px", fontWeight: "500" }}
                    />
                  </div>
                </div>
              )}

              {/* Work Description */}
              <div className="lr-field-box">
                <label className="lr-field-label">Work Description</label>
                <div className="lr-field-content" style={{ alignItems: "flex-start", padding: "12px 16px" }}>
                  <textarea
                    placeholder="Ex: System installation..."
                    value={dutiesDesc}
                    onChange={(e) => setDutiesDesc(e.target.value)}
                    rows={2}
                    style={{
                      flex: 1, border: "none", background: "transparent",
                      fontSize: 14, fontWeight: 500, outline: "none",
                      resize: "none", color: "#1e293b", fontFamily: "inherit", width: "100%",
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex" }}>
              <button
                className="lr-gradient-btn"
                style={{ flex: 1, padding: "14px", borderRadius: "14px", fontSize: "15px", fontWeight: "700" }}
                onClick={saveOnDuty}
              >
                Submit Report
              </button>
            </div>
          </div>
          <div className="history-section-title">On Duty Logs</div>

          {canApprove && (
            <IonSegment
              value={activeDutyTab}
              onIonChange={(e) =>
                setActiveDutyTab((e.detail.value as "my" | "team") || "my")
              }
              style={{ marginBottom: "14px" }}
            >
              <IonSegmentButton value="my">
                <IonLabel>My Requests</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="team">
                <IonLabel>Team Requests</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          )}

          {dutiesList
            .filter((row) =>
              !canApprove
                ? true
                : activeDutyTab === "team"
                  ? row.isOwn === false
                  : row.isOwn !== false
            )
            .filter((row) => {
              const selected = (statusFilter || "all").toLowerCase();
              if (selected === "all") return true;

              // On Duty Logs is based on the request's overall/final
              // outcome (all RA levels done), unlike the Requests page's
              // Team Requests tab which is viewer-centric.
              const approved = isFinalStatus(row) && row.Status?.toLowerCase() === "approved";
              const rejected = isFinalStatus(row) && row.Status?.toLowerCase() === "rejected";

              if (selected === "pending") return !approved && !rejected;
              if (selected === "accepted") return approved;
              if (selected === "rejected") return rejected;
              return true;
            })
            .map((row, idx) => {
              const rowApproved = isFinalStatus(row) && row.Status?.toLowerCase() === "approved";
              const rowRejected = isFinalStatus(row) && row.Status?.toLowerCase() === "rejected";
              const rowChain = getDutyChain(row);

              return (
            <div key={`${row.id}-${idx}`} className="premium-card">
              <span
                className={`dm-side-flag ${rowApproved ? "approved" : rowRejected ? "rejected" : "pending"}`}
              />
              <div
                className="card-header"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
              >
                <div style={{ flex: 1 }}>
                  <div className="college-name">
                    {row.College || "Party"}
                    <span className="dm-id-badge">#{row.id}</span>
                  </div>
                  <div className="duty-subtitle">{row.Description}</div>
                </div>

                <span
                  className={`dm-status-dot ${rowApproved ? "approved" : rowRejected ? "rejected" : "pending"}`}
                >
                  {rowApproved ? "Approved" : rowRejected ? "Rejected" : "Pending"}
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    window.innerWidth <= 768
                      ? "1fr"
                      : "repeat(4, minmax(0, 1fr))",
                  gap: "14px",
                  alignItems: "start",
                  marginTop: "14px",
                }}
              >
                <div className="duty-info-box full-width">
                  <span className="item-label">Employees</span>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      marginTop: "6px",
                    }}
                  >
                    {formatEmployeeNames(row.empNames).map(
                      (emp: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            background: "#eef2ff",
                            color: "#3730a3",
                            padding: "6px 10px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: 600,
                            border: "1px solid #c7d2fe",
                          }}
                        >
                          {emp.name}
                          {emp.code && (
                            <span style={{ opacity: 0.7 }}> ({emp.code})</span>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div className="duty-info-box" style={{ minWidth: 0 }}>
                  <span className="item-label">Transport</span>
                  <span
                    className="item-value"
                    style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                  >
                    {row.Mode_of_Trans}
                    {row.Vehicle_No && (
                      <span style={{ color: "#64748b" }}> • {row.Vehicle_No}</span>
                    )}
                  </span>
                </div>

                <div className="duty-info-box" style={{ minWidth: 0 }}>
                  <span className="item-label">Timeline</span>
                  <span
                    className="item-value"
                    style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                  >
                    {row.DateFrom && row.DateTo
                      ? `${fmtDate(row.DateFrom)} → ${fmtDate(row.DateTo)}`
                      : row.Date}
                  </span>
                </div>

                <div className="duty-info-box" style={{ minWidth: 0 }}>
                  <span className="item-label">Location</span>
                  <span
                    className="item-value"
                    style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                  >
                    {row.Location}
                  </span>
                </div>

                <div className="duty-info-box" style={{ minWidth: 0 }}>
                  <span className="item-label">Details</span>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setExpandedTrips((prev) => ({
                        ...prev,
                        [row.id]: !prev[row.id],
                      }));
                    }}
                    className="duty-view-link"
                  >
                    {expandedTrips[row.id] ? "Hide" : "View"}
                  </a>
                </div>
              </div>

              {expandedTrips[row.id] && (
              <div style={{ marginTop: "16px", marginBottom: "12px" }}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    openAddDayTripModal(row);
                  }}
                  className="duty-view-link"
                  style={{ display: "inline-block", marginBottom: "10px" }}
                >
                  + Add Duty Day
                </a>

                {(tripDaysByDuty[row.id] || []).length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                      gap: "12px",
                      alignItems: "start",
                    }}
                  >
                    {(tripDaysByDuty[row.id] || []).map((trip, index) => (
                      <div
                        key={trip.dayTrip_Id || `${trip.dutyDate}-${index}`}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: "14px",
                          padding: "14px",
                          background: "#fafafa",
                          color: "#1f2937",
                          height: "100%",
                          boxSizing: "border-box",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "10px",
                            flexWrap: "nowrap",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              color: "#1f2937",
                              fontSize: "15px",
                              lineHeight: 1.3,
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {moment(trip.dutyDate).format("DD-MM-YYYY")}
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "2px",
                              flexShrink: 0,
                              marginLeft: "auto",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <IonButton
                              fill="clear"
                              size="small"
                              color="primary"
                              style={{
                                margin: 0,
                                minHeight: "24px",
                                fontSize: "11px",
                              }}
                              onClick={() => openEditDayTripModal(row, index)}
                            >
                              EDIT
                            </IonButton>

                            <IonButton
                              fill="clear"
                              size="small"
                              color="danger"
                              style={{
                                margin: 0,
                                minHeight: "24px",
                                fontSize: "11px",
                              }}
                              onClick={() => removeTripDay(row.id, index)}
                            >
                              DELETE
                            </IonButton>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            fontSize: "13px",
                            marginBottom: "8px",
                          }}
                        >
                          <div>
                            <strong>Reading :</strong>{" "}

                            {/* Reading From */}
                            <span
                              role="button"
                              tabIndex={0}
                              style={{
                                color: trip.readingFromImage ? "#2563eb" : "#111827",
                                cursor: trip.readingFromImage ? "pointer" : "default",
                                fontWeight: 600,
                                userSelect: "none",
                                padding: "2px 6px",
                                borderRadius: "6px",
                                background: trip.readingFromImage ? "#e0f2fe" : "transparent",
                                display: "inline-block",
                              }}
                              onClick={() => {
                                if (trip.readingFromImage) {
                                  openFilePreview(trip.readingFromImage);
                                }
                              }}
                            >
                              {trip.readingFrom || "-"}
                            </span>

                            {"  →  "}

                            {/* Reading To */}
                            <span
                              role="button"
                              tabIndex={0}
                              style={{
                                color: trip.readingToImage ? "#2563eb" : "#111827",
                                cursor: trip.readingToImage ? "pointer" : "default",
                                fontWeight: 600,
                                userSelect: "none",
                                padding: "2px 6px",
                                borderRadius: "6px",
                                background: trip.readingToImage ? "#e0f2fe" : "transparent",
                                display: "inline-block",
                              }}
                              onClick={() => {
                                if (trip.readingToImage) {
                                  openFilePreview(trip.readingToImage);
                                }
                              }}
                            >
                              {trip.readingTo || "-"}
                            </span>

                            {" "}
                            <span style={{ color: "#475569" }}>
                              ({trip.distance || 0} Kms)
                            </span>
                          </div>
                          {/* ROW 2 — Fuel (Only for Office Vehicles) */}
                          {(row.Mode_of_Trans === "Office 4 Wheeler" ||
                            row.Mode_of_Trans === "Office 2 Wheeler") && (
                              <div>
                                <strong>Fuel :</strong>{" "}
                                <span
                                  style={{
                                    color: trip.fuelImage ? "#2563eb" : "#111827",
                                    textDecoration: trip.fuelImage ? "underline" : "none",
                                    cursor: trip.fuelImage ? "pointer" : "default",
                                    fontWeight: 600,
                                  }}
                                  onClick={() => {
                                    if (trip.fuelImage) {
                                      openFilePreview(trip.fuelImage);
                                    }
                                  }}
                                >
                                  {trip.fuelAmount ? `${trip.fuelAmount}/-` : "-"}
                                </span>
                              </div>
                            )}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            marginTop: "8px",
                          }}
                        >
                          {(trip.visits || []).map((visit: VisitItem, vIndex: number) => (
                            <div
                              key={vIndex}
                              style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: "12px",
                                padding: "10px",
                                background: "#ffffff",
                                fontSize: "13px",
                                lineHeight: "1.6",
                              }}
                            >
                              {/* Client */}
                              <div>
                                <strong>Client :</strong>{" "}
                                <span
                                  style={{
                                    color: visit.visitSlipImage ? "#2563eb" : "#111827",
                                    cursor: visit.visitSlipImage ? "pointer" : "default",
                                    textDecoration: visit.visitSlipImage ? "underline" : "none",
                                  }}
                                  onClick={() => {
                                    if (visit.visitSlipImage) {
                                      openFilePreview(visit.visitSlipImage);
                                    }
                                  }}
                                >
                                  {visit.partyName || "-"}
                                </span>
                              </div>

                              {/* Location */}
                              <div>
                                <strong>Location :</strong>{" "}
                                {visit.latitude && visit.longitude ? (
                                  <span
                                    style={{
                                      color: "#2563eb",
                                      textDecoration: "underline",
                                      cursor: "pointer",
                                      fontWeight: 600,
                                    }}
                                    onClick={() =>
                                      window.open(
                                        `https://www.google.com/maps?q=${visit.latitude},${visit.longitude}`,
                                        "_blank"
                                      )
                                    }
                                  >
                                    {visit.location || "View Map"}
                                  </span>
                                ) : (
                                  visit.location || "-"
                                )}
                              </div>
                              {/* Local Transport */}
                              {visit.localTransportAmount && (
                                <div>
                                  <strong>Local Transport :</strong>{" "}
                                  <span
                                    style={{
                                      color: visit.localTransportImage ? "#2563eb" : "#111827",
                                      textDecoration: visit.localTransportImage ? "underline" : "none",
                                      cursor: visit.localTransportImage ? "pointer" : "default",
                                      fontWeight: 600,
                                    }}
                                    onClick={() => {
                                      if (visit.localTransportImage) {
                                        openFilePreview(visit.localTransportImage);
                                      }
                                    }}
                                  >
                                    ₹ {visit.localTransportAmount}
                                  </span>
                                </div>
                              )}
                              {/* Visiting Time */}
                              <div>
                                <strong>Visiting Time :</strong>{" "}
                                {visit.visitFromTime || "-"} → {visit.visitToTime || "-"}
                              </div>

                              {/* Projects */}
                              <div>
                                <strong>Projects :</strong>{" "}
                                {visit.demoProjects && visit.demoProjects.length > 0
                                  ? visit.demoProjects.join(", ")
                                  : "-"}
                              </div>

                              {/* Contact */}
                              <div>
                                <strong>Contact :</strong>{" "}
                                {visit.contactPerson || "-"}{" "}
                                {visit.mobile ? `(${visit.mobile})` : ""}
                              </div>

                              {/* Remarks */}
                              <div>
                                <strong>Remarks :</strong>{" "}
                                {visit.remarks || "-"}
                              </div>

                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}
              {/* Approval trail instead of a pill - the status dot up top
                  already shows the overall outcome, so this just lists who
                  acted (or still needs to), colored per RA slot. */}
              {rowChain.length > 0 && (
                <div className="dm-chain">
                  <span className="dm-chain-label">Approval Status:</span>{" "}
                  {rowChain.map((step, idx) => (
                    <React.Fragment key={idx}>
                      <span className={`dm-chain-role ${step.color}`}>{step.role}</span>
                      {idx < rowChain.length - 1 && (
                        <span className="dm-chain-arrow"> → </span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}

              {canApprove && isMyTurn(row) && (
                <div className="duty-action-row">
                  <IonButton className="compact-duty-approve" onClick={() => approveDutyRow(row)}>
                    Approve
                  </IonButton>
                  <IonButton className="compact-duty-reject" onClick={() => rejectDutyRow(row)}>
                    Reject
                  </IonButton>
                </div>
              )}

              {/* edit_onduties looks the record up by the VIEWER's own
                  empCode + id, so it only ever finds rows that viewer
                  actually owns - showing the pencil on a team member's card
                  (row.isOwn === false) let approvers click it and always hit
                  "Failed to load record". Admin roles (Accountant/Director)
                  are the exception and can edit any record. */}
              {(canEdit || (canApprove && row.isOwn !== false)) && (
                <IonButton
                  fill="clear"
                  color="primary"
                  className="ion-no-margin"
                  onClick={() => editOnDuty(row.id)}
                >
                  <IonIcon icon={pencilOutline} />
                </IonButton>
              )}
            </div>
              );
            })}

        </div>

        <IonModal isOpen={showDayTripModal} onDidDismiss={closeDayTripModal}>
          <IonContent className="ion-padding" ref={modalContentRef}>
            {editingTripIndex !== null && currentModalTrip && (() => {
              const trip = currentModalTrip;
              const hasReadingFromImage = !!trip.readingFromImage;
              const hasReadingToImage = !!trip.readingToImage;
              const hasFuelImage = !!trip.fuelImage;

              return (
                <>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      alignItems: "start",
                      columnGap: "12px",
                      marginBottom: "18px",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        color: "#1e3a5f",
                        fontSize: "18px",
                        fontWeight: 700,
                        lineHeight: 1.25,
                        wordBreak: "break-word",
                      }}
                    >{moment(trip.dutyDate).format("DD-MM-YYYY")} Day Trip
                    </div>

                    <IonButton
                      fill="clear"
                      onClick={closeDayTripModal}
                      style={{
                        margin: 0,
                        justifySelf: "end",
                        alignSelf: "start",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        minHeight: "32px",
                      }}
                    >
                      Close
                    </IonButton>
                  </div>

                  <div
                    style={{
                      marginTop: "6px",
                      marginBottom: "12px",
                      padding: "12px 14px",
                      border: "1px solid #d8dee8",
                      borderRadius: "16px",
                      background: "#ffffff",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "#1e3a5f",
                        marginBottom: "2px",
                      }}
                    >
                      Trip Details
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                      }}
                    >
                      Reading and fuel details for this trip
                    </div>
                  </div>


                  <div
                    style={{
                      border: "1px solid #d8dee8",
                      borderRadius: "18px",
                      padding: "12px",
                      background: "#f8fafc",
                      marginBottom: "18px",
                    }}
                  >
                    {!isPublicTransport && (
                      <div
                        style={{
                          display: "grid",
                        gridTemplateColumns:
  window.innerWidth <= 768
    ? "1fr"
    : tripModalMode === "add"
    ? "1fr"
    : "1fr 1fr",
                          gap: "10px",
                          alignItems: "start",
                        }}
                      >
                        <div
                          style={{
                            border: "1px solid #d8dee8",
                            borderRadius: "16px",
                            padding: "12px",
                            background: "#ffffff",
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                            justifyContent: "flex-start",
                            alignSelf: "start",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "6px",
                              flexWrap: "wrap",
                              minHeight: "24px",
                            }}
                          >
                           <label
  style={{
    fontSize: "14px",
    fontWeight: 700,
    color: "#334155",
    cursor: "pointer",
    textDecoration: "underline",
    lineHeight: "20px",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  }}
>
  Reading From
  <input
    hidden
    type="file"
    accept="image/*"
    onClick={saveModalScroll}
    onChange={(e) => {
      const file = e.target.files?.[0] || null;

      updateTripDay(
        editingTripIndex!,
        "readingFromImage",
        file
      );

      if (tripModalMode === "add") {
        updateTripDay(
          editingTripIndex!,
          "readingTo",
          trip.readingFrom
        );
      }
      restoreModalScroll();
    }}
  />
</label>

                            {trip.readingFromImage && (
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "#0f172a",
                                  fontWeight: 500,
                                  lineHeight: "20px",
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                }}
                                onClick={() => openFilePreview(trip.readingFromImage)}
                              >
                                {getFileLabel(trip.readingFromImage)}
                              </span>
                            )}
                          </div>

                        <input
  value={trip.readingFrom}
  disabled={!hasReadingFromImage}
  placeholder={
    hasReadingFromImage
      ? "Reading From"
      : "Upload image to enable"
  }
  onChange={(e) => {
    const value = e.target.value;

    updateTripDay(
      editingTripIndex!,
      "readingFrom",
      value
    );

    if (tripModalMode === "add") {
      updateTripDay(
        editingTripIndex!,
        "readingTo",
        value
      );
    }

    autoFillDistance(
      editingTripIndex!,
      value,
      trip.readingTo
    );
  }}
/>
                        </div>

                      {tripModalMode === "edit" && (
  <div
    style={{
      border: "1px solid #d8dee8",
      borderRadius: "16px",
      padding: "12px",
      background: "#ffffff",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      justifyContent: "flex-start",
      alignSelf: "start",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "8px",
        minHeight: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          minWidth: 0,
          flex: 1,
        }}
      >
        <label
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#334155",
            cursor: "pointer",
            textDecoration: "underline",
            lineHeight: "20px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          Reading To
          <input
            hidden
            type="file"
            accept="image/*"
            onClick={saveModalScroll}
            onChange={(e) => {
              updateTripDay(
                editingTripIndex!,
                "readingToImage",
                e.target.files?.[0] || null
              );
              restoreModalScroll();
            }}
          />
        </label>

        {trip.readingToImage && (
          <span
            style={{
              fontSize: "12px",
              color: "#0f172a",
              fontWeight: 500,
              lineHeight: "20px",
              cursor: "pointer",
              textDecoration: "underline",
            }}
            onClick={() => openFilePreview(trip.readingToImage)}
          >
            {getFileLabel(trip.readingToImage)}
          </span>
        )}
      </div>
    </div>

    <input
      value={trip.readingTo}
      disabled={!trip.readingToImage}
      placeholder={
        trip.readingToImage
          ? "Reading To"
          : "Upload image to enable"
      }
      onChange={(e) => {
        const value = e.target.value;

       if (editingTripIndex === undefined) return;

updateTripDay(
  editingTripIndex,
  "readingTo",
  value
);

        autoFillDistance(
          editingTripIndex!,
          trip.readingFrom,
          value
        );
      }}
      style={{
        width: "100%",
        height: "46px",
        border: "1px solid #cbd5e1",
        borderRadius: "12px",
        padding: "0 14px",
        fontSize: "14px",
        background: trip.readingToImage
          ? "#fff"
          : "#f1f5f9",
      }}
    />
  </div>
)}
                      </div>
                    )}

                    {tripModalMode === "edit" && (
<div
  style={{
    display: "grid",
    gridTemplateColumns:
      window.innerWidth <= 768
        ? "1fr"
        : isOfficeVehicle
        ? "1fr 1fr"
        : "1fr",
    gap: "12px",
    marginTop: "14px",
  }}
>
                      {/* DISTANCE */}
                      <div
                        style={{
                          border: "1px solid #d8dee8",
                          borderRadius: "16px",
                          padding: "12px",
                          background: "#ffffff",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "#334155",
                          }}
                        >
                          Distance (Kms)
                        </div>

                        <input
                          type="number"
                          value={trip.distance}
                          disabled={!isPublicTransport}
                          placeholder={
                            isPublicTransport
                              ? "Enter Distance"
                              : "Auto calculated from readings"
                          }
                          onChange={(e) =>
                            updateTripDay(
                              editingTripIndex!,
                              "distance",
                              e.target.value || ""
                            )
                          }
                          style={{
                            width: "100%",
                            height: "46px",
                            border: "1px solid #cbd5e1",
                            borderRadius: "12px",
                            padding: "0 14px",
                            fontSize: "14px",
                            background: isPublicTransport ? "#fff" : "#f1f5f9",
                          }}
                        />
                      </div>

                      {/* FUEL (Only Office Vehicles) */}
                      {isOfficeVehicle && (
                        <div
                          style={{
                            border: "1px solid #d8dee8",
                            borderRadius: "16px",
                            padding: "12px",
                            background: "#ffffff",
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <label
                              style={{
                                fontSize: "14px",
                                fontWeight: 700,
                                color: "#334155",
                                cursor: "pointer",
                                textDecoration: "underline",
                              }}
                            >
                              Fuel Amount
                              <input
                                hidden
                                type="file"
                                accept="image/*"
                                onClick={saveModalScroll}
                                onChange={(e) => {
                                  updateTripDay(
                                    editingTripIndex!,
                                    "fuelImage",
                                    e.target.files?.[0] || null
                                  );
                                  restoreModalScroll();
                                }}
                              />
                            </label>

                            {trip.fuelImage && (
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "#0f172a",
                                  fontWeight: 500,
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                }}
                                onClick={() => openFilePreview(trip.fuelImage)}
                              >
                                {getFileLabel(trip.fuelImage)}
                              </span>
                            )}
                          </div>

                          <input
                            value={trip.fuelAmount}
                            disabled={!trip.fuelImage}
                            placeholder={
                              trip.fuelImage
                                ? "Enter Fuel Amount"
                                : "Upload bill image to enable"
                            }
                            onChange={(e) =>
                              updateTripDay(
                                editingTripIndex!,
                                "fuelAmount",
                                e.target.value || ""
                              )
                            }
                            style={{
                              width: "100%",
                              height: "46px",
                              border: "1px solid #cbd5e1",
                              borderRadius: "12px",
                              padding: "0 14px",
                              fontSize: "14px",
                              background: trip.fuelImage
                                ? "#fff"
                                : "#f1f5f9",
                            }}
                          />
                        </div>
                      )}
                    </div>
)}
                  </div>

                 {tripModalMode === "edit" && (
<div
  style={{
    marginTop: "8px",
    marginBottom: "12px",
    padding: "12px 14px",
    border: "1px solid #d8dee8",
    borderRadius: "16px",
    background: "#ffffff",
  }}
>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "#1e3a5f",
                        marginBottom: "2px",
                      }}
                    >
                      Visit Details
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                      }}
                    >
                      Add one or more client / party visit entries
                    </div>
                  </div>
                  )}
                 {tripModalMode === "edit" &&
  trip.visits.map((visit, visitIndex) => {

                    const isGeoTagged =
                      visit.latitude &&
                      visit.longitude &&
                      visit.latitude !== "" &&
                      visit.longitude !== "";


                    const hasVisitImage = !!visit.visitSlipImage;
                    const hasLocalTransportImage = !!visit.localTransportImage;
                    const hasGeo = !!visit.latitude && !!visit.longitude;
                    return (

                      <div
                        key={visitIndex}
                        style={{
                          border: "1px solid #d8dee8",
                          borderRadius: "16px",
                          padding: "12px",
                          background: "#f8fafc",
                          marginBottom: "10px",
                        }}

                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            alignItems: "center",
                            width: "100%",
                            marginBottom: "14px",
                            columnGap: "10px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "15px",
                              fontWeight: 700,
                              color: "#1e293b",
                              minWidth: 0,
                            }}
                          >
                            Client / Party {visitIndex + 1}
                          </div>

                          {trip.visits.length > 1 ? (
                            <IonButton
                              size="small"
                              color="danger"
                              fill="clear"
                              style={{
                                margin: 0,
                                justifySelf: "end",
                                minWidth: "70px",
                              }}
                              onClick={() => removeTripVisit(editingTripIndex, visitIndex)}
                            >
                              Remove
                            </IonButton>
                          ) : (
                            <div />
                          )}
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gap: "10px",
                          }}
                        >


                          <div
                            style={{
                              display: "grid",
                              gap: "10px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "10px",
                                  flexWrap: "wrap",
                                  minHeight: "24px",
                                }}
                              >
                                <label
                                  style={{
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    color: "#334155",
                                    cursor: "pointer",
                                    textDecoration: "underline",
                                    lineHeight: "20px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    marginRight: "4px",
                                  }}
                                >
                                  Client / Party Name
                                  <input
                                    hidden
                                    type="file"
                                    accept="image/*"
                                    onClick={saveModalScroll}
                                    onChange={(e) => {
                                      updateTripVisit(
                                        editingTripIndex!,
                                        visitIndex,
                                        "visitSlipImage",
                                        e.target.files?.[0] || null
                                      );
                                      restoreModalScroll();
                                    }}
                                  />
                                </label>

                                {visit.visitSlipImage && (
                                  <span
                                    style={{
                                      fontSize: "12px",
                                      color: "#0f172a",
                                      fontWeight: 500,
                                      lineHeight: "20px",
                                      cursor: "pointer",
                                      textDecoration: "underline",
                                    }}
                                    onClick={() => openFilePreview(visit.visitSlipImage)}
                                  >
                                    {getFileLabel(visit.visitSlipImage)}
                                  </span>
                                )}
                              </div>

                              <div style={{ width: "100%" }}>
                                <input
                                  value={visit.partyName}
                                  disabled={!visit.visitSlipImage}
                                  placeholder={
                                    visit.visitSlipImage
                                      ? "Enter Client / Party Name"
                                      : "Upload image to enable"
                                  }
                                  onChange={(e) =>
                                    updateTripVisit(
                                      editingTripIndex!,
                                      visitIndex,
                                      "partyName",
                                      e.target.value || ""
                                    )
                                  }
                                  style={{
                                    width: "100%",
                                    height: "46px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "12px",
                                    padding: "0 14px",
                                    fontSize: "14px",
                                    background: visit.visitSlipImage ? "#fff" : "#f1f5f9",
                                  }}
                                />
                              </div>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                                marginBottom: "12px",
                                width: "100%",
                              }}
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    window.innerWidth <= 768 ? "1fr" : "2fr 1fr",
                                  gap: "10px",
                                }}
                              >
                                {/* Location with Geo Tag */}
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "10px",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: "8px",
                                      flexWrap: "wrap",
                                      minHeight: "24px",
                                    }}
                                  >
                                    <label
                                      style={{
                                        fontSize: "14px",
                                        fontWeight: 700,
                                        color: "#334155",
                                        cursor: "pointer",
                                        textDecoration: "underline",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                      }}
                                      onClick={() => tagVisitLocation(editingTripIndex!, visitIndex)}
                                    >
                                      Location
                                    </label>

                                    {hasGeo && (
                                      <span
                                        style={{
                                          fontSize: "12px",
                                          color: "#0f172a",
                                          fontWeight: 500,
                                          lineHeight: "20px",
                                          cursor: "pointer",
                                          textDecoration: "underline",
                                        }}
                                        onClick={() =>
                                          window.open(
                                            `https://www.google.com/maps?q=${visit.latitude},${visit.longitude}`,
                                            "_blank"
                                          )
                                        }
                                      >
                                        {getGeoLabel(visit.latitude, visit.longitude)}
                                      </span>
                                    )}
                                  </div>

                                  <input
                                    value={visit.location}
                                    disabled={!hasGeo}
                                    placeholder={
                                      hasGeo ? "Enter Location" : "Click label to Geo Tag"
                                    }
                                    onChange={(e) =>
                                      updateTripVisit(
                                        editingTripIndex!,
                                        visitIndex,
                                        "location",
                                        e.target.value || ""
                                      )
                                    }
                                    style={{
                                      width: "100%",
                                      height: "46px",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: "12px",
                                      padding: "0 14px",
                                      fontSize: "14px",
                                      background: hasGeo ? "#fff" : "#f1f5f9",
                                    }}
                                  />
                                </div>

                                {/* Local Transport */}
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "10px",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: "8px",
                                      flexWrap: "wrap",
                                      minHeight: "24px",
                                    }}
                                  >
                                    <label
                                      style={{
                                        fontSize: "14px",
                                        fontWeight: 700,
                                        color: "#334155",
                                        cursor: "pointer",
                                        textDecoration: "underline",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                      }}
                                    >
                                      Loc Tran
                                      <input
                                        hidden
                                        type="file"
                                        accept="image/*"
                                        onClick={saveModalScroll}
                                        onChange={(e) => {
                                          updateTripVisit(
                                            editingTripIndex!,
                                            visitIndex,
                                            "localTransportImage",
                                            e.target.files?.[0] || null
                                          );
                                          restoreModalScroll();
                                        }}
                                      />
                                    </label>

                                    {visit.localTransportImage && (
                                      <span
                                        style={{
                                          fontSize: "12px",
                                          color: "#0f172a",
                                          fontWeight: 500,
                                          lineHeight: "20px",
                                          cursor: "pointer",
                                          textDecoration: "underline",
                                        }}
                                        onClick={() => openFilePreview(visit.localTransportImage)}
                                      >
                                        {getFileLabel(visit.localTransportImage)}
                                      </span>
                                    )}
                                  </div>

                                  <input
                                    type="number"
                                    value={visit.localTransportAmount || ""}
                                    disabled={!visit.localTransportImage}
                                    placeholder={
                                      visit.localTransportImage
                                        ? "Enter Amount"
                                        : "Upload bill to enable"
                                    }
                                    onChange={(e) =>
                                      updateTripVisit(
                                        editingTripIndex!,
                                        visitIndex,
                                        "localTransportAmount",
                                        e.target.value || ""
                                      )
                                    }
                                    style={{
                                      width: "100%",
                                      height: "46px",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: "12px",
                                      padding: "0 14px",
                                      fontSize: "14px",
                                      background: visit.localTransportImage ? "#fff" : "#f1f5f9",
                                    }}
                                  />
                                </div>
                              </div>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr",
                                  gap: "10px",
                                  width: "100%",
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      color: "#334155",
                                      marginBottom: "8px",
                                    }}
                                  >
                                    Visit From Time
                                  </div>

                                  <input
                                    type="time"
                                    value={visit.visitFromTime}
                                    onChange={(e) =>
                                      updateTripVisit(
                                        editingTripIndex,
                                        visitIndex,
                                        "visitFromTime",
                                        e.target.value || ""
                                      )
                                    }
                                    style={{
                                      width: "100%",
                                      height: "46px",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: "12px",
                                      padding: "0 10px",
                                      outline: "none",
                                      fontSize: "14px",
                                      background: "#fff",
                                      color: "#0f172a",
                                      boxSizing: "border-box",
                                    }}
                                  />
                                </div>

                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      color: "#334155",
                                      marginBottom: "8px",
                                    }}
                                  >
                                    Visit To Time
                                  </div>

                                  <input
                                    type="time"
                                    value={visit.visitToTime}
                                    onChange={(e) =>
                                      updateTripVisit(
                                        editingTripIndex,
                                        visitIndex,
                                        "visitToTime",
                                        e.target.value || ""
                                      )
                                    }
                                    style={{
                                      width: "100%",
                                      height: "46px",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: "12px",
                                      padding: "0 10px",
                                      outline: "none",
                                      fontSize: "14px",
                                      background: "#fff",
                                      color: "#0f172a",
                                      boxSizing: "border-box",
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gap: "10px",
                                marginTop: "2px",
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    color: "#334155",
                                    marginBottom: "8px",
                                  }}
                                >
                                  Demo Project
                                </div>

                                <IonSelect
                                  multiple
                                  interface="popover"
                                  value={visit.demoProjects}
                                  selectedText={
                                    !visit.demoProjects || visit.demoProjects.length === 0
                                      ? ""
                                      : visit.demoProjects.length <= 2
                                        ? visit.demoProjects.join(", ")
                                        : `${visit.demoProjects.slice(0, 2).join(", ")} +${visit.demoProjects.length - 2
                                        } more`
                                  }
                                  placeholder="Select Demo Project"
                                  onIonChange={(e) =>
                                    updateTripVisit(
                                      editingTripIndex,
                                      visitIndex,
                                      "demoProjects",
                                      e.detail.value || []
                                    )
                                  }
                                  style={{
                                    width: "100%",
                                    minHeight: "46px",
                                    height: "46px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "12px",
                                    padding: "0 12px",
                                    background: "#fff",
                                    color: "#0f172a",
                                    boxSizing: "border-box",
                                    overflow: "hidden",
                                  }}
                                >
                                  <IonSelectOption value="BEAT Visit">BEAT Visit</IonSelectOption>
                                  <IonSelectOption value="BOAT Visit">BOAT Visit</IonSelectOption>
                                  <IonSelectOption value="Skill Ascent  Visit">Skill Ascent Visit</IonSelectOption>
                                  <IonSelectOption value="Edvedha  Visit">Edvedha Visit</IonSelectOption>
                                  <IonSelectOption value="UNICODE  Visit">UNICODE Visit</IonSelectOption>
                                  <IonSelectOption value="BEAT Demo">BEAT Demo</IonSelectOption>
                                  <IonSelectOption value="BOAT Demo">BOAT Demo</IonSelectOption>
                                  <IonSelectOption value="Skill Ascent  Demo">Skill Ascent Demo</IonSelectOption>
                                  <IonSelectOption value="Edvedha  Demo">Edvedha Demo</IonSelectOption>
                                  <IonSelectOption value="UNICODE  Demo">UNICODE Demo</IonSelectOption>
                                  <IonSelectOption value="BEAT Serv.">BEAT Serv.</IonSelectOption>
                                  <IonSelectOption value="BOAT Serv.">BOAT Serv.</IonSelectOption>
                                  <IonSelectOption value="Skill Ascent  Serv.">Skill Ascent Serv.</IonSelectOption>
                                  <IonSelectOption value="Edvedha  Serv.">Edvedha Serv.</IonSelectOption>
                                  <IonSelectOption value="UNICODE  Serv.">UNICODE Serv.</IonSelectOption>

                                </IonSelect>
                              </div>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr",
                                  gap: "10px",
                                  alignItems: "end",
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      color: "#334155",
                                      marginBottom: "8px",
                                    }}
                                  >
                                    Contact Person Name
                                  </div>
                                  <input
                                    value={visit.contactPerson}
                                    placeholder="Enter Contact Person Name"
                                    onChange={(e) =>
                                      updateTripVisit(
                                        editingTripIndex,
                                        visitIndex,
                                        "contactPerson",
                                        e.target.value || ""
                                      )
                                    }
                                    style={{
                                      width: "100%",
                                      height: "46px",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: "12px",
                                      padding: "0 14px",
                                      outline: "none",
                                      fontSize: "14px",
                                      background: "#fff",
                                      color: "#0f172a",
                                      boxSizing: "border-box",
                                    }}
                                  />
                                </div>

                                <div>
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      color: "#334155",
                                      marginBottom: "8px",
                                    }}
                                  >
                                    Mobile Number
                                  </div>
                                  <input
                                    value={visit.mobile}
                                    placeholder="Enter Mobile Number"
                                    onChange={(e) =>
                                      updateTripVisit(
                                        editingTripIndex,
                                        visitIndex,
                                        "mobile",
                                        e.target.value || ""
                                      )
                                    }
                                    style={{
                                      width: "100%",
                                      height: "46px",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: "12px",
                                      padding: "0 14px",
                                      outline: "none",
                                      fontSize: "14px",
                                      background: "#fff",
                                      color: "#0f172a",
                                      boxSizing: "border-box",
                                    }}
                                  />
                                </div>
                              </div>
                              <div style={{ width: "100%" }}>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    color: "#334155",
                                    marginBottom: "8px",
                                  }}
                                >
                                  Remarks
                                </div>

                                <input
                                  value={visit.remarks}
                                  placeholder="Enter Remarks"
                                  onChange={(e) =>
                                    updateTripVisit(
                                      editingTripIndex,
                                      visitIndex,
                                      "remarks",
                                      e.target.value || ""
                                    )
                                  }
                                  style={{
                                    width: "100%",
                                    height: "46px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "12px",
                                    padding: "0 14px",
                                    outline: "none",
                                    fontSize: "14px",
                                    background: "#fff",
                                    color: "#0f172a",
                                    boxSizing: "border-box",
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      marginTop: "18px",
                      alignItems: "stretch",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                       gridTemplateColumns:
  tripModalMode === "add"
    ? "1fr"
    : "1fr 1fr",
                        gap: "10px",
                        marginTop: "18px",
                        width: "100%",
                      }}
                    >
                     {tripModalMode === "edit" && (
  <IonButton
    type="button"
    fill="outline"
    style={{
      margin: 0,
      width: "100%",
      minHeight: "46px",
      fontSize: "12px",
    }}
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      addTripVisit(editingTripIndex);
    }}
  >
    + Add Party
  </IonButton>
)}
                      <IonButton
                        style={{
                          margin: 0,
                          width: "100%",
                          minHeight: "46px",
                          fontSize: "12px",
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          saveDayTripModal();
                        }}
                        disabled={isSavingTrip.current}
                      >
                        Save Trip
                      </IonButton>
                    </div>
                  </div>
                </>
              );
            })()}
          </IonContent>
        </IonModal>
        <IonModal
          isOpen={previewOpen}
          onDidDismiss={() => {
            setPreviewOpen(false);
            setPreviewFile(null);
          }}
        >
          <IonContent className="ion-padding">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#1f2937",
                }}
              >
                Image Preview
              </div>

              <IonButton
                fill="clear"
                size="small"
                onClick={() => {
                  setPreviewOpen(false);
                  setPreviewFile(null);
                }}
              >
                Close
              </IonButton>
            </div>

            {previewFile && (
              <img
                src={getPreviewUrl(previewFile)}
                alt="Preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: "80vh",
                  borderRadius: "12px",
                  display: "block",
                  margin: "0 auto",
                  objectFit: "contain",
                }}
              />
            )}
          </IonContent>
        </IonModal>
        <IonToast
          isOpen={!!toast}
          message={toast?.msg}
          color={toast?.color as any}
          duration={2500}
          onDidDismiss={() => setToast(null)}
          position="top"
        />
      </div>
    </div>
  );
};

export default OnDuties;