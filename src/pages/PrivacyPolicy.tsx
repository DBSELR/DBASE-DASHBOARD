import React from "react";
import { IonPage, IonContent } from "@ionic/react";
import { useHistory } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import "./PrivacyPolicy.css";

const PrivacyPolicy: React.FC = () => {
  const history = useHistory();

  return (
    <IonPage>
      <IonContent className="db-privacy-page-container" scrollY={true}>
        <div className="db-privacy-wrapper">
          {/* Header */}
          <header className="db-privacy-header">
            <button className="db-privacy-back-btn" onClick={() => history.goBack()} aria-label="Go Back">
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>
            <h1 className="db-privacy-main-title">Privacy Policy</h1>
            <p className="db-privacy-subtitle">DBS OFFICE Mobile Application</p>
          </header>

          {/* Card Content */}
          <div className="db-privacy-card">
            <div className="db-privacy-meta">
              <span className="db-privacy-badge">Last Updated: January 2025</span>
            </div>

            <div className="db-privacy-body">
              <section className="db-privacy-section">
                <h2>1. Introduction</h2>
                <p>
                  Welcome to <strong>DBS OFFICE</strong>, an internal enterprise application developed and
                  operated by <strong>D Base Solutions Private Limited</strong> ("we," "our," or "us"). This App is intended
                  exclusively for use by our employees and authorized personnel for internal office work, including marketing activity
                  tracking, attendance management, task updates, and work progress management.
                </p>
                <p>
                  This App is strictly not available to the public, and no outside users can access, sign up, or register for this App.
                </p>
                <p>
                  By installing, accessing, or using the App, you agree to the collection and use of information in accordance with
                  this Privacy Policy. If you do not agree with the terms of this Privacy Policy, please do not access or use the App.
                </p>
              </section>

              <section className="db-privacy-section">
                <h2>2. Information We Collect</h2>
                <p>We collect personal and technical information necessary to provide and manage our enterprise services effectively.</p>
                
                <h3>A. Personal Information You Provide to Us</h3>
                <ul>
                  <li>
                    <strong>Profile Data:</strong> Name, employee ID, email address, phone number, job title, and profile picture.
                  </li>
                  <li>
                    <strong>Employment Data:</strong> Salary details, timesheets, leave requests, work reports, overtime records, and task assignments.
                  </li>
                  <li>
                    <strong>Financial Data:</strong> Information related to expenses, invoices, and transactions you submit through the App.
                  </li>
                </ul>

                <h3>B. Biometric and Facial Data (AI Attendance)</h3>
                <p>
                  To utilize the AI Attendance features, the App requires access to your device's camera to capture your facial image for identity
                  verification and registration. This data is strictly processed and used for secure, automated attendance tracking.
                </p>

                <h3>C. Device and Permission-Based Information</h3>
                <p>Depending on your device settings and app usage, we may request and collect the following permissions:</p>
                <ul>
                  <li>
                    <strong>Location Data (Geolocation):</strong> DBase Office collects location data (coarse, fine, and background location) to enable field attendance and work-location tracking for authorized marketing activities. Location may be collected in the background while field tracking is active, including when the app is closed or not in use, to verify field presence and work-related activities.
                  </li>
                  <li>
                    <strong>Camera and Photos:</strong> With your permission, we access your camera and photo gallery to allow you to upload profile
                    pictures, scan barcodes/QR codes, submit document images for leave requests or tickets, and use the AI Attendance feature.
                  </li>
                  <li>
                    <strong>Storage Access:</strong> We require read/write access to your device's storage to save downloaded reports (e.g., PDFs,
                    Excel files) and to upload local files.
                  </li>
                </ul>
              </section>

              <section className="db-privacy-section">
                <h2>3. How We Use Your Information</h2>
                <p>We use the collected information for various business and employment-related purposes, including:</p>
                <ul>
                  <li><strong>Account Management:</strong> To create, authenticate, and manage your employee profile.</li>
                  <li><strong>Attendance and Tracking:</strong> To monitor attendance using AI facial recognition and verify location during on-duty hours.</li>
                  <li><strong>Operational Productivity:</strong> To manage tasks, tickets, work reports, and equipment assignments.</li>
                  <li><strong>HR and Payroll:</strong> To process leave requests, track overtime, manage salaries, and handle employee requests.</li>
                  <li><strong>Communication:</strong> To send administrative updates, notifications regarding your tasks, or changes to company policies.</li>
                  <li><strong>App Improvement:</strong> To analyze usage trends, fix bugs, and improve the overall performance and security of the App.</li>
                </ul>
              </section>

              <section className="db-privacy-section">
                <h2>4. How We Share Your Information</h2>
                <p>We do not sell, rent, or trade your personal information. We may share your data in the following limited circumstances:</p>
                <ul>
                  <li>
                    <strong>Internal Access:</strong> Authorized company administrators, HR personnel, and managers will have access to your data to
                    perform their official job duties.
                  </li>
                  <li>
                    <strong>Service Providers:</strong> We may share data with trusted third-party vendors who assist us in operating the App, processing
                    payroll, or hosting our servers (e.g., secure cloud hosting providers), under strict confidentiality.
                  </li>
                  <li>
                    <strong>Legal Compliance:</strong> We may disclose your information if required by law, subpoena, or other legal processes, or to
                    protect the rights, property, or safety of the company, our employees, or others.
                  </li>
                </ul>
              </section>

              <section className="db-privacy-section">
                <h2>5. Data Security</h2>
                <p>
                  We take the security of your data seriously. We implement robust administrative, technical, and physical security measures to protect
                  your personal information. This includes encrypted communications (HTTPS), restricted access protocols to internal staff, and secure
                  credential management. While we work diligently to safeguard your data, no method of electronic transmission or storage is 100% secure,
                  and we cannot guarantee absolute security.
                </p>
              </section>

              <section className="db-privacy-section">
                <h2>6. Your Rights and Choices</h2>
                <ul>
                  <li><strong>Account Settings:</strong> You can review or update certain profile information within the App settings. For core HR data, you must contact the IT/HR administrator.</li>
                  <li><strong>Device Permissions:</strong> You can enable or disable location tracking, camera access, and storage permissions at any time through your device's system settings. Please note that disabling these permissions may limit your ability to use core features of the App (such as AI attendance logging).</li>
                  <li><strong>Data Deletion & Retention:</strong> If your employment or contract is terminated, your account access will be revoked, and associated data will be archived or managed according to company policies and applicable local laws.</li>
                </ul>
              </section>

              <section className="db-privacy-section">
                <h2>7. Children's Privacy</h2>
                <p>
                  The App is intended solely for adult employees and authorized personnel of the company. We do not knowingly solicit or collect
                  information from children under the age of 13.
                </p>
              </section>

              <section className="db-privacy-section">
                <h2>8. Changes to This Privacy Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements.
                  We will notify you of any significant changes by posting the new Privacy Policy within the App or via official communication
                  channels. Your continued use of the App indicates acceptance of the updated policy.
                </p>
              </section>

              <section className="db-privacy-section">
                <h2>9. Contact Us</h2>
                <p>If you have questions or comments about this Privacy Policy or our data practices, please contact us at:</p>
                <div className="db-privacy-contact-card">
                  <strong>D Base Solutions Private Limited</strong>
                  <p>Email: support@dbasesolutions.in</p>
                  <p>Address: Eluru, Andhra Pradesh, India</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default PrivacyPolicy;
