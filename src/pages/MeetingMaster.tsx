import React, { useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";
import {
  IonToast,
  IonIcon,
  IonSelect,
  IonSelectOption
} from "@ionic/react";

import {
  calendarOutline,
  peopleOutline,
  businessOutline,
  clipboardOutline,
  saveOutline
} from "ionicons/icons";

import "./MeetingMaster.css";

function MeetingMaster() {

  const currentYear = new Date().getFullYear();

  const years = [
    currentYear,
    currentYear + 1,
    currentYear + 2
  ];

  const months = [
    "January", "February", "March", "April",
    "May", "June", "July", "August",
    "September", "October", "November", "December"
  ];

  const frequencies = [
    "Every Day",
    "Every Week",
    "Bi-monthly",
    "Monthly"
  ];

  const projects = [
    "Beat",
    "Boat",
    "Unicode",
    "React"
  ];

  const initialForm = {
    year: "",
    month: "",
    meetingDate: "",
    weekName: "",
    meetingType: "",
    participants: [] as string[],
    frequencyType: "",
    projectName: "",
    meetingOwner: [] as string[],
    meetingStatus: "Pending",
    remarks: "",
    createdBy: "Admin"
  };

  const [form, setForm] = useState(initialForm);
  const [employees, setEmployees] = useState<any[]>([]);

  React.useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await axios.get(`${API_BASE}Employee/Load_Employees`);
        if (response.data && Array.isArray(response.data)) {
          const filteredEmployees = response.data.filter((emp: any) => emp[0] !== "0" && emp[1] !== "All Employees");
          setEmployees(filteredEmployees);
        }
      } catch (error) {
        console.error("Failed to load employees", error);
      }
    };
    fetchEmployees();
  }, []);

  const [toast, setToast] = useState({
    open: false,
    message: "",
    color: "success"
  });

  const handleChange = (e: any) => {

    setForm({
      ...form,
      [e.target.name]: e.target.value
    });

  };

  const showToast = (
    message: string,
    color: string = "success"
  ) => {

    setToast({
      open: true,
      message,
      color
    });

  };

  const saveMeeting = async () => {

    try {

      if (!form.year) {
        showToast("Please Select Year", "warning");
        return;
      }

      if (!form.month) {
        showToast("Please Select Month", "warning");
        return;
      }

      if (!form.frequencyType) {
        showToast("Please Select Frequency", "warning");
        return;
      }

      if (!form.projectName) {
        showToast("Please Select Project", "warning");
        return;
      }

      if (
        form.frequencyType !== "Every Day" &&
        !form.meetingDate
      ) {
        showToast("Please Select Meeting Date", "warning");
        return;
      }

      const payload = {
        ...form,
        participants: Array.isArray(form.participants) ? form.participants.join(',') : form.participants,
        meetingOwner: Array.isArray(form.meetingOwner) ? form.meetingOwner.join(',') : form.meetingOwner,
        meetingDate:
          form.frequencyType === "Every Day"
            ? null
            : form.meetingDate
      };

      const response = await axios.post(
        `${API_BASE}Meeting/SaveMeeting`,
        payload
      );

      showToast(
        response?.data?.message ||
        "Meeting Saved Successfully",
        "success"
      );

      // ✅ CLEAR FORM
      setForm(initialForm);

    }
    catch (err: any) {

      console.log(err);

      let errorMessage = "API Error";

      if (typeof err?.response?.data === "string") {

        errorMessage = err.response.data;

      }
      else if (
        err?.response?.data?.message
      ) {

        errorMessage =
          err.response.data.message;

      }
      else if (
        err?.response?.data?.title
      ) {

        errorMessage =
          err.response.data.title;

      }
      else if (err?.message) {

        errorMessage = err.message;

      }

      showToast(errorMessage, "danger");

    }

  };

  return (

    <div className="meeting-page">

      <div className="meeting-card">

        <div className="meeting-header">

          <h2>
            <IonIcon icon={calendarOutline} />
            Meeting Master
          </h2>

        </div>

        <div className="meeting-grid">

          {/* YEAR */}
          <div className="field-box">

            <label>Year</label>

            <select
              name="year"
              value={form.year}
              onChange={handleChange}
            >
              <option value="">
                Select Year
              </option>

              {years.map((y) => (
                <option
                  key={y}
                  value={y}
                >
                  {y}
                </option>
              ))}

            </select>

          </div>

          {/* MONTH */}
          <div className="field-box">

            <label>Month</label>

            <select
              name="month"
              value={form.month}
              onChange={handleChange}
            >
              <option value="">
                Select Month
              </option>

              {months.map((m) => (
                <option
                  key={m}
                  value={m}
                >
                  {m}
                </option>
              ))}

            </select>

          </div>

          {/* FREQUENCY */}
          <div className="field-box">

            <label>Frequency</label>

            <select
              name="frequencyType"
              value={form.frequencyType}
              onChange={handleChange}
            >
              <option value="">
                Select Frequency
              </option>

              {frequencies.map((f) => (
                <option
                  key={f}
                  value={f}
                >
                  {f}
                </option>
              ))}

            </select>

          </div>

          {/* PROJECT */}
          <div className="field-box">

            <label>Project</label>

            <select
              name="projectName"
              value={form.projectName}
              onChange={handleChange}
            >
              <option value="">
                Select Project
              </option>

              {projects.map((p) => (
                <option
                  key={p}
                  value={p}
                >
                  {p}
                </option>
              ))}

            </select>

          </div>

          {/* DATE */}
          {form.frequencyType !== "Every Day" && (

            <div className="field-box">

              <label>
                Meeting Date
              </label>

              <input
                type="date"
                name="meetingDate"
                value={form.meetingDate}
                onChange={handleChange}
              />

            </div>

          )}

          {/* MEETING TYPE */}
          <div className="field-box">

            <label>
              Meeting Type
            </label>

            <div className="input-icon">

              <input
                type="text"
                name="meetingType"
                placeholder="Meeting Type"
                value={form.meetingType}
                onChange={handleChange}
              />

            </div>

          </div>

          {/* PARTICIPANTS */}
          <div className="field-box">

            <label>
              Participants
            </label>

            <div className="input-icon">

              <IonSelect
                multiple={true}
                interface="popover"
                placeholder="Select Participants"
                value={form.participants}
                onIonChange={(e) => setForm({ ...form, participants: e.detail.value })}
                className="custom-select-ui"
              >
                {employees.map((emp) => (
                  <IonSelectOption key={`part-${emp[0]}`} value={emp[0]}>
                    {emp[1]}
                  </IonSelectOption>
                ))}
              </IonSelect>

            </div>

          </div>

          {/* OWNER */}
          <div className="field-box">

            <label>
              Meeting Owner
            </label>

            <IonSelect
              multiple={true}
              interface="popover"
              placeholder="Select Meeting Owner"
              value={form.meetingOwner}
              onIonChange={(e) => setForm({ ...form, meetingOwner: e.detail.value })}
              className="custom-select-ui"
            >
              {employees.map((emp) => (
                <IonSelectOption key={`owner-${emp[0]}`} value={emp[0]}>
                  {emp[1]}
                </IonSelectOption>
              ))}
            </IonSelect>

          </div>

          {/* REMARKS */}
          <div className="field-box full-width">

            <label>
              Remarks
            </label>

            <div className="input-icon textarea-box">

              <IonIcon
                icon={clipboardOutline}
              />

              <textarea
                name="remarks"
                placeholder="Remarks"
                value={form.remarks}
                onChange={handleChange}
              />

            </div>

          </div>

        </div>

        {/* SAVE BUTTON */}
        <button
          className="save-btn"
          onClick={saveMeeting}
        >

          <IonIcon icon={saveOutline} />

          Save Meeting

        </button>

      </div>

      {/* TOAST */}

      <IonToast
        isOpen={toast.open}
        message={toast.message}
        duration={2500}
        color={toast.color as any}
        position="top"
        onDidDismiss={() =>
          setToast({
            ...toast,
            open: false
          })
        }
      />

    </div>

  );

}

export default MeetingMaster;