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
} from "@ionic/react";
import {
  calendarOutline,
  businessOutline,
  timeOutline,
  pencilOutline,
  personCircleOutline,
} from "ionicons/icons";
import axios from "axios";
import "./OnDuties.css";
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

  dayTrips?: TripDayItem[];   // ✅ ADD THIS
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
  remarks:string,
};
type TripDayItem = {
  dayTrip_Id?: number;   // ✅ ADD THIS
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

const OnDuties: React.FC = () => {
  const [empCode, setEmpCode] = useState<string>("");
  const [empName, setEmpName] = useState<string>("");
  const [userDesig, setUserDesig] = useState<string>("");
  const [userLoaded, setUserLoaded] = useState<boolean>(false);
  const didInitRef = useRef(false);
  const contentRef = useRef<HTMLIonContentElement>(null);
 

  const api = useMemo(() => {
    return axios.create({ baseURL: API_BASE, timeout: 30000 });
  }, []);

  const isAccountant = empCode === "1541";
  const isDirector = empCode === "1501";
  const canEdit = isAccountant || isDirector;
  const canApprove =
    isAccountant ||
    userDesig.includes("Team Leader") ||
    userDesig.includes("Manager");

  const [dateModalType, setDateModalType] = useState<"from" | "to" | null>(null);
  const [dutyFromDate, setDutyFromDate] = useState<string>(
    new Date().toISOString()
  );
  const [dutyToDate, setDutyToDate] = useState<string>(
    new Date().toISOString()
  );

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

  setTripDaysByDuty((prev) => ({
    ...prev,
    [row.id]: [...(prev[row.id] || []), newTrip],
  }));

  setSelectedDutyRow(row);
  setSelectedDutyId(row.id);
  setEditingTripIndex((tripDaysByDuty[row.id] || []).length);
  setShowDayTripModal(true);
};

const openEditDayTripModal = (row: DutyRow, index: number) => {
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
    const res = await api.get("Workreport/get_daytrips", {
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

const saveDayTripModal = async () => {
  if (!selectedDutyId || editingTripIndex === null) {
    notify("Invalid trip state", "warning");
    return;
  }

  const trip = tripDaysByDuty[selectedDutyId]?.[editingTripIndex];
  if (!trip) {
    notify("Trip data missing", "danger");
    return;
  }

  // validation
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
    !trip.readingTo ||
    !trip.readingFromImage ||
    !trip.readingToImage
  ) {
    notify("Reading values and images are required", "warning");
    return;
  }
}

// Office Vehicle → fuel required
if (isOfficeVehicle) {
  if (!trip.fuelAmount || !trip.fuelImage) {
    notify("Fuel amount and bill image are required", "warning");
    return;
  }
}

// At least one visit required
if (!trip.visits.length) {
  notify("At least one visit required", "warning");
  return;
}

  if (!trip.visits.length) {
    notify("At least one visit required", "warning");
    return;
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
  }

  if (trip.readingToImage instanceof File) {
    formData.append("ReadingTo_Image", trip.readingToImage);
  }
}

// Fuel image only for Office vehicle
if (isOfficeVehicle && trip.fuelImage instanceof File) {
  formData.append("Fuel_Image", trip.fuelImage);
}

  // visits
 trip.visits.forEach((v, i) => {
  formData.append(`visits[${i}].visit_Id`, String(v.visit_Id || 0));
  formData.append(`visits[${i}].client_Name`, v.partyName);
  formData.append(`visits[${i}].location`, v.location);
  formData.append(`visits[${i}].latitude`, v.latitude || "");
  formData.append(`visits[${i}].longitude`, v.longitude || "");
  formData.append(`visits[${i}].visit_FromTime`, v.visitFromTime);
  formData.append(`visits[${i}].visit_ToTime`, v.visitToTime);
  formData.append(`visits[${i}].projects`, v.demoProjects.join(","));
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

 try {
  const res = await api.post("Workreport/save_daytrip", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  console.log("SAVE RESPONSE:", res);
  console.log("SAVE RESPONSE DATA:", res.data);

  notify("Trip Saved Successfully", "success");
await loadDuties();

closeDayTripModal();

} catch (error: any) {
  console.log("SAVE ERROR:", error);
  console.log("SAVE ERROR RESPONSE:", error?.response);

  notify(
    error?.response?.data?.message ||
    error?.response?.data ||
    error?.message ||
    "Save failed",
    "danger"
  );
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
      const res = await api.get("Workreport/load_employees_duties", {
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
      await api.delete("Workreport/delete_visit", {
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
        const res = await api.get("Workreport/get_daytrips", {
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

const loadDuties = async () => {
  try {
    const res = await api.get("Workreport/load_duties_full", {
      params: { EmpCode: empCode },
    });

    const rawData = Array.isArray(res.data) ? res.data : [];

    const mapped: DutyRow[] = rawData.map((d: any) => ({
      id: String(d.id),
      College: d.college || "",
      Description: d.description || "",
      Mode_of_Trans: d.mode || "",
      Vehicle_No: d.vehicle_No || "",
      Location: d.location || "",
      Status: d.status || "Pending",
      DateFrom: d.dateFrom || "",
      DateTo: d.dateTo || "",
    }));

    setDutiesList(mapped);
    await loadAllTrips(mapped);
  } catch (err) {
    console.error("loadDuties error:", err);
    setDutiesList([]);
    setTripDaysByDuty({});
  }
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
    await api.delete("Workreport/delete_daytrip", {
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
    if (!institution || !dutiesDesc || !transportMode || !location || !empCode|| !dutyFromDate|| !dutyToDate|| !vehicleNo) {
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
      const res = await postWithFallback("Workreport/saveduties", payload);
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
    if (!canEdit) {
      notify("Permission Denied", "danger");
      return;
    }

    try {
      const res = await api.get("Workreport/edit_onduties", {
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
    } catch {
      notify("Failed to load record", "danger");
    }
  };

  const approveOnDuty = async () => {
    if (!editingId) return;

    const payload = {
      _id: editingId,
      _empcode: empCode,
      _FromDate: moment(dutyFromDate).format("YYYY-MM-DD"),
      _ToDate: moment(dutyToDate).format("YYYY-MM-DD"),
      _Client: institution,
      _Location: location,
      _Description: dutiesDesc,
      _TransportMode: transportMode,
      _Starttime: startTime,
      _Endtime: endTime,
      _VehicleNo: vehicleNo,
      _StartReading: sReading,
      _EndReading: eReading,
      _KMS: kms.replace("Kms", ""),
    };

    try {
      const res = await postWithFallback("Workreport/SaveDuties_Approve", payload);
      if (isSaveOk(res.data)) {
        notify("Approved successfully", "success");
        clearOnDutyForm();
        loadDuties();
      }
    } catch {
      notify("Approval failed", "danger");
    }
  };

  const rejectOnDuty = async () => {
    if (!editingId) return;

    try {
      const res = await postWithFallback("Workreport/onduty_rejected", {
        _id: editingId,
      });
      if (isSaveOk(res.data)) {
        notify("Request rejected", "warning");
        clearOnDutyForm();
        loadDuties();
      }
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
    setDutyFromDate (new Date().toISOString());
    setDutyToDate (new Date().toISOString());
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
    <IonPage className="onduties-page">
      <IonContent className="onduties-content"  fullscreen={false} ref={contentRef} scrollEvents> 
         
          <div style={{ display: "flex", gap: "1px", marginTop: "5px" }}> 
          </div>
        

        <div className="page-container">
           <h2 style={{ margin: 0, fontWeight: 700 }}>Duty Manager</h2>
          <IonButton
  expand="block"
  color="primary"
  onClick={() => history.push("/OverTime")}
>
  Go To Overtime
</IonButton>
              <div> 

               <IonGrid className="ion-no-padding compact-duty-grid">
  <IonRow className="compact-duty-row">
    <IonCol size="12" sizeMd="4">
      <div className="compact-duty-card">
        <label className="compact-duty-label">Team Members</label>

        {team.length > 1 ? (
          <IonSelect
            multiple
            interface="popover"
            className="compact-duty-select"
            value={selectedCodes}
            onIonChange={(e) => setSelectedCodes(e.detail.value)}
            placeholder="Select Team"
          >
            {team.map((emp, idx) => (
              <IonSelectOption
                key={`${emp.EmpCode}-${idx}`}
                value={emp.EmpCode}
              >
                {emp.EmpName}
              </IonSelectOption>
            ))}
          </IonSelect>
        ) : (
          <div className="compact-duty-value">
            {team[0]?.EmpName || "-"}
          </div>
        )}
      </div>
    </IonCol>
<IonModal
  isOpen={!!dateModalType}
  onDidDismiss={() => setDateModalType(null)}
  className="native-date-modal"
>
  <div className="native-date-modal-wrapper">
 <IonDatetime
  presentation="date"
  preferWheel={true}
  showDefaultButtons={true}
  value={dateModalType === "from" ? dutyFromDate : dutyToDate}
  min={minCampDate}
  max={maxCampDate}
  onIonChange={(e) => {
    const val = String(e.detail.value || "");

    if (dateModalType === "from") {
      setDutyFromDate(val);

      if (!dutyToDate || moment(val).isAfter(dutyToDate)) {
        setDutyToDate(val);
      }
    } else {
      setDutyToDate(val);
    }
  }}
  onIonCancel={() => setDateModalType(null)}
/>
  </div>
</IonModal>
    <IonCol size="12" sizeMd="4">
      <div
        className="compact-duty-card"
        onClick={() => setDateModalType("from")}
      >
        <label className="compact-duty-label">Camp From Date</label>

        <div className="compact-duty-date">
          <IonIcon icon={calendarOutline} />
          <span
            className={
              dutyFromDate
                ? "compact-duty-value"
                : "compact-duty-placeholder"
            }
          >
            {dutyFromDate
              ? moment(dutyFromDate).format("DD-MM-YYYY")
              : "Pick From Date"}
          </span>
        </div>
      </div>
    </IonCol>

    <IonCol size="12" sizeMd="4">
      <div
        className="compact-duty-card"
        onClick={() => setDateModalType("to")}
      >
        <label className="compact-duty-label">Camp To Date</label>

        <div className="compact-duty-date">
          <IonIcon icon={calendarOutline} />
          <span
            className={
              dutyToDate
                ? "compact-duty-value"
                : "compact-duty-placeholder"
            }
          >
            {dutyToDate
              ? moment(dutyToDate).format("DD-MM-YYYY")
              : "Pick To Date"}
          </span>
        </div>
      </div>
    </IonCol>
  </IonRow>

  <IonRow className="compact-duty-row">
    <IonCol size="12" sizeMd="4">
      <div className="compact-duty-card">
        <label className="compact-duty-label">Client / Institution</label>

        <IonSelect
          interface="popover"
          className="compact-duty-select"
          placeholder="Search Party / Client"
          value={institution}
          onIonChange={(e) => setInstitution(e.detail.value)}
        >
          <IonSelectOption value="Party">Party</IonSelectOption>
          {clients.map((c, idx) => (
            <IonSelectOption
              key={`${c.Client_ID}-${idx}`}
              value={c.Client_Name}
            >
              {c.Client_Name}
            </IonSelectOption>
          ))}
        </IonSelect>
      </div>
    </IonCol>

    <IonCol size="12" sizeMd="4">
      <div className="compact-duty-card">
        <label className="compact-duty-label">Location</label>

        <IonInput
          className="compact-duty-input"
          placeholder="Vijayawada"
          value={location}
          onIonInput={(e) => setLocation(e.detail.value || "")}
        />
      </div>
    </IonCol>

    <IonCol size="12" sizeMd="4">
      <div className="compact-duty-card">
        <label className="compact-duty-label">Transport</label>

        <IonSelect
          interface="popover"
          className="compact-duty-select"
          value={transportMode}
          onIonChange={(e) => setTransportMode(e.detail.value)}
        >
          <IonSelectOption value="PublicTransport">
            Public Transport
          </IonSelectOption>
          <IonSelectOption value="Office 4 Wheeler">
            Office 4 Wheeler
          </IonSelectOption>
          <IonSelectOption value="Office 2 Wheeler">
            Office 2 Wheeler
          </IonSelectOption>
          <IonSelectOption value="Own 2 Wheeler">
            Own 2 Wheeler
          </IonSelectOption>
          <IonSelectOption value="Own 4 Wheeler">
            Own 4 Wheeler
          </IonSelectOption>
        </IonSelect>
      </div>
    </IonCol>
  </IonRow>

  <IonRow className="compact-duty-row">
    {transportMode !== "PublicTransport" && (
      <IonCol size="12" sizeMd="4">
        <div className="compact-duty-card">
          <label className="compact-duty-label">Vehicle No</label>

          <IonInput
            className="compact-duty-input"
            placeholder="AP16..."
            value={vehicleNo}
            onIonInput={(e) => setVehicleNo(e.detail.value || "")}
          />
        </div>
      </IonCol>
    )}

    <IonCol
      size="12"
      sizeMd={transportMode === "PublicTransport" ? "12" : "8"}
    >
      <div className="compact-duty-card">
        <label className="compact-duty-label">Work Description</label>

        <IonTextarea
          className="compact-duty-textarea"
          placeholder="Ex: System installation..."
          value={dutiesDesc}
          autoGrow
          rows={2}
          onIonInput={(e) => setDutiesDesc(e.detail.value || "")}
        />
      </div>
    </IonCol>
  </IonRow>

  <div className="compact-duty-buttons">
    <IonButton
      className="compact-duty-submit"
      expand="block"
      onClick={saveOnDuty}
    >
      Submit Report
    </IonButton>

    {isAccountant && editingId && (
      <>
        <IonButton
          color="success"
          className="compact-duty-approve"
          onClick={approveOnDuty}
        >
          Approve
        </IonButton>

        <IonButton
          color="danger"
          className="compact-duty-reject"
          onClick={rejectOnDuty}
        >
          Reject
        </IonButton>
      </>
    )}
  </div>
</IonGrid>
              </div>
              <div className="history-section-title">On Duty Logs</div>
              {dutiesList.map((row, idx) => (
                <div key={`${row.id}-${idx}`} className="premium-card">
                  <div className="card-accent"></div>
                  <div className="card-header">
                    <div style={{ flex: 1 }}>
                      <div>
                        <span className="college-name">{row.College}</span>
                        <span className={`badge-pill pill-${row.Status?.toLowerCase()}`}>
                          {" "}
                          {row.Status}
                        </span>
                      </div>
                       <span >{row.Description}</span> 
                    </div>
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
  <div className="footer-item" style={{ minWidth: 0 }}>
    <span className="item-label">Transport</span>
    <span
      className="item-value"
      style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
    >
    <span className="item-value">
  {row.Mode_of_Trans}
  {row.Vehicle_No && (
    <span style={{ color: "#64748b" }}> • {row.Vehicle_No}</span>
  )}
</span>
    </span>
  </div>

  <div className="footer-item" style={{ minWidth: 0 }}>
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

  <div className="footer-item" style={{ minWidth: 0 }}>
    <span className="item-label">Location</span>
    <span
      className="item-value"
      style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
    >
      {row.Location}
    </span>
  </div>

<div
  className="footer-item"
  style={{
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: window.innerWidth <= 768 ? "flex-start" : "center",
    gap: "8px",
  }}
>
  <span className="item-label"> ADD </span>
  <a
  href="#"
  onClick={(e) => {
    e.preventDefault();
    openAddDayTripModal(row);
  }}
  style={{
    color: "#2563eb",
    textDecoration: "underline",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "13px",
    whiteSpace: "nowrap",
  }}
>
  + Add Duty Days
</a>
   
</div>
</div>

<div style={{ marginTop: "16px", marginBottom: "12px" }}>
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
 {canEdit && (
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
                
              ))}
           
        </div>

        <IonModal isOpen={showDayTripModal} onDidDismiss={closeDayTripModal}>
          <IonContent className="ion-padding">
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
    gridTemplateColumns: window.innerWidth <= 768 ? "1fr" : "1fr 1fr",
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
          onChange={(e) =>
            updateTripDay(
              editingTripIndex,
              "readingFromImage",
              e.target.files?.[0] || null
            )
          }
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
    updateTripDay(editingTripIndex, "readingFrom", value);
    autoFillDistance(editingTripIndex, value, trip.readingTo);
  }}
  style={{
    width: "100%",
    height: "46px",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "0 14px",
    fontSize: "14px",
    background: hasReadingFromImage ? "#fff" : "#f1f5f9",
    color: "#0f172a",
  }}
/>
  </div>

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
            onChange={(e) =>
              updateTripDay(
                editingTripIndex,
                "readingToImage",
                e.target.files?.[0] || null
              )
            }
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
    updateTripDay(editingTripIndex, "readingTo", value);
    autoFillDistance(
      editingTripIndex,
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
</div>
  )}

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
            onChange={(e) =>
              updateTripDay(
                editingTripIndex!,
                "fuelImage",
                e.target.files?.[0] || null
              )
            }
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
 
</div>
             
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
{trip.visits.map((visit, visitIndex) => {

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
        onChange={(e) =>
          updateTripVisit(
            editingTripIndex,
            visitIndex,
            "visitSlipImage",
            e.target.files?.[0] || null
          )
        }
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
          onChange={(e) =>
            updateTripVisit(
              editingTripIndex!,
              visitIndex,
              "localTransportImage",
              e.target.files?.[0] || null
            )
          }
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
        visit.demoProjects?.length === 0
          ? ""
          : visit.demoProjects.length <= 2
          ? visit.demoProjects.join(", ")
          : `${visit.demoProjects.slice(0, 2).join(", ")} +${
              visit.demoProjects.length - 2
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
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginTop: "18px",
    width: "100%",
  }}
>
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

  <IonButton
    style={{
      margin: 0,
      width: "100%",
      minHeight: "46px",
      fontSize: "12px",
    }}
    onClick={saveDayTripModal}
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
      </IonContent>
    </IonPage>
  );
};

export default OnDuties;