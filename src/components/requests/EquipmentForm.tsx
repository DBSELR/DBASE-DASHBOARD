import React, { useState } from "react";
import {
  IonInput,
  IonSelect,
  IonSelectOption,
  IonToast,
  IonButton,
  IonTextarea,
} from "@ionic/react";
import axios from "axios";
import { API_BASE } from "../../config";

const getUser = () => JSON.parse(localStorage.getItem("user") || "{}");

const EquipmentForm: React.FC = () => {
  const [purpose, setPurpose] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [file, setFile] = useState<File | null>(null);

  const [toast, setToast] = useState("");
  const [showToast, setShowToast] = useState(false);

  const handleSubmit = async () => {
    const empCode = getUser()?.empCode;

    if (!purpose) {
      setToast("Enter purpose");
      setShowToast(true);
      return;
    }

    const formData = new FormData();
    formData.append("EmpCode", empCode);
    formData.append("Purpose", purpose);
    formData.append("Priority", priority);

    if (file) formData.append("File", file);

    try {
      await axios.post(`${API_BASE}EquipmentRequests/SaveRequest`, formData);

      setToast("Submitted Successfully");
      setShowToast(true);

      setPurpose("");
      setFile(null);

      window.dispatchEvent(new Event("refreshRequests"));
    } catch (err: any) {
      setToast(err?.response?.data || "Error");
      setShowToast(true);
    }
  };

  return (
    <div className="form-card">
      <IonTextarea
        placeholder="Equipment Purpose"
        value={purpose}
        onIonChange={(e) => setPurpose(e.detail.value!)}
      />

      <IonSelect value={priority} onIonChange={(e) => setPriority(e.detail.value)}>
        <IonSelectOption value="High">High</IonSelectOption>
        <IonSelectOption value="Medium">Medium</IonSelectOption>
        <IonSelectOption value="Low">Low</IonSelectOption>
      </IonSelect>

      <input type="file" onChange={(e: any) => setFile(e.target.files[0])} />

      <IonButton expand="block" onClick={handleSubmit}>
        Submit
      </IonButton>

      <IonToast
        isOpen={showToast}
        message={toast}
        duration={2000}
        onDidDismiss={() => setShowToast(false)}
      />
    </div>
  );
};

export default EquipmentForm;