import React, { useState } from "react";
import axios from "axios";
import {
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { useHistory } from "react-router-dom";
import { API_BASE } from "../config";
import "./ChangePassword.css";

const ChangePassword: React.FC = () => {
  const history = useHistory();

  const user =
    JSON.parse(localStorage.getItem("user") || "{}");

  const empCode = user?.empCode || "";

  const [oldPassword, setOldPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [showOld, setShowOld] =
    useState(false);

  const [showNew, setShowNew] =
    useState(false);

  const [showConfirm, setShowConfirm] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState<"success" | "error" | "">("");

  const showMessage = (
    msg: string,
    type: "success" | "error"
  ) => {
    setMessage(msg);
    setMessageType(type);

    setTimeout(() => {
      setMessage("");
      setMessageType("");
    }, 4000);
  };

  const handleSubmit = async () => {
    if (!oldPassword.trim()) {
      return showMessage(
        "Enter Old Password",
        "error"
      );
    }

    if (!newPassword.trim()) {
      return showMessage(
        "Enter New Password",
        "error"
      );
    }

    if (newPassword.length < 4) {
      return showMessage(
        "Password must contain at least 4 characters",
        "error"
      );
    }

    if (newPassword !== confirmPassword) {
      return showMessage(
        "New Password and Confirm Password do not match",
        "error"
      );
    }

    try {
      setLoading(true);

      const response = await axios.post(
        `${API_BASE}Employee/ChangePassword`,
        {
          empCode,
          oldPassword,
          newPassword,
        }
      );

     const msg =
  response?.data?.message ??
  "Password Updated Successfully";

      showMessage(msg, "success");

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        history.goBack();
      }, 2000);
    } catch (err: any) {
      const errorMsg =
  err?.response?.data?.message ??
  "Unable to change password";

      showMessage(errorMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cp-container">
      <div className="cp-card">

        <div className="cp-header">
          <h2>Change Password</h2>
          <p>
            Update your account password securely
          </p>
        </div>

        {/* Success/Error Message */}
        {message && (
          <div
            className={`cp-alert ${
              messageType === "success"
                ? "cp-success"
                : "cp-error"
            }`}
          >
            {messageType === "success" ? (
              <CheckCircle size={18} />
            ) : (
              <AlertCircle size={18} />
            )}

            <span>{message}</span>
          </div>
        )}

        {/* Employee Code */}
        <div className="cp-form-group">
          <label>Employee Code</label>

          <div className="cp-input-wrapper">
            <KeyRound size={18} />

            <input
              value={empCode}
              disabled
              className="cp-input cp-disabled"
            />
          </div>
        </div>

        {/* Old Password */}
        <div className="cp-form-group">
          <label>Old Password</label>

          <div className="cp-input-wrapper">
            <Lock size={18} />

            <input
              type={showOld ? "text" : "password"}
              className="cp-input"
              value={oldPassword}
              onChange={(e) =>
                setOldPassword(e.target.value)
              }
              placeholder="Enter old password"
            />

            <button
              type="button"
              className="cp-eye"
              onClick={() =>
                setShowOld(!showOld)
              }
            >
              {showOld ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div className="cp-form-group">
          <label>New Password</label>

          <div className="cp-input-wrapper">
            <Lock size={18} />

            <input
              type={showNew ? "text" : "password"}
              className="cp-input"
              value={newPassword}
              onChange={(e) =>
                setNewPassword(e.target.value)
              }
              placeholder="Enter new password"
            />

            <button
              type="button"
              className="cp-eye"
              onClick={() =>
                setShowNew(!showNew)
              }
            >
              {showNew ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="cp-form-group">
          <label>Confirm Password</label>

          <div className="cp-input-wrapper">
            <Lock size={18} />

            <input
              type={
                showConfirm
                  ? "text"
                  : "password"
              }
              className="cp-input"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(
                  e.target.value
                )
              }
              placeholder="Confirm password"
            />

            <button
              type="button"
              className="cp-eye"
              onClick={() =>
                setShowConfirm(
                  !showConfirm
                )
              }
            >
              {showConfirm ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>
        </div>

        <button
          className="cp-submit-btn"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading
            ? "Updating..."
            : "Change Password"}
        </button>
      </div>
    </div>
  );
};

export default ChangePassword;