import React, { useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";

const API = `${API_BASE}OMRImport/ImportJsonFolder`;

const OMRJsonImport = () => {

  const [files, setFiles] = useState<FileList | null>(null);

  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");

  const [progress, setProgress] = useState(0);

  //--------------------------------------------------
  // FILE CHANGE
  //--------------------------------------------------

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFiles(e.target.files);
  };

  //--------------------------------------------------
  // UPLOAD
  //--------------------------------------------------

  const handleUpload = async () => {

    if (!files || files.length === 0) {
      alert("Select JSON files");
      return;
    }

    try {

      setLoading(true);
      setProgress(0);
      setMessage("");

      const formData = new FormData();

      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }

      const response = await axios.post(
        API,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },

          timeout: 1000 * 60 * 60,

          onUploadProgress: (progressEvent) => {

            const percent = Math.round(
              (progressEvent.loaded * 100) /
              (progressEvent.total || 1)
            );

            setProgress(percent);
          },
        }
      );

      setMessage("Files uploaded successfully!");
    } catch (error) {
      console.error("Upload Error:", error);
      setMessage("Error uploading files.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>OMR Json Import</h2>
      <input
        type="file"
        multiple
        onChange={handleFileChange}
        accept=".json"
      />
      <button onClick={handleUpload} disabled={loading}>
        {loading ? "Uploading..." : "Upload"}
      </button>
      {message && <p>{message}</p>}
      {progress > 0 && (
        <div>
          <p>Progress: {progress}%</p>
          <div style={{ width: "100%", backgroundColor: "#f0f0f0" }}>
            <div
              style={{
                width: `${progress}%`,
                backgroundColor: "#007bff",
                height: "20px",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default OMRJsonImport;