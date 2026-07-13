import React from "react";
import { IonPage, IonContent } from "@ionic/react";
import { useHistory } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import "./TermsAndConditions.css";

const TermsAndConditions: React.FC = () => {
  const history = useHistory();

  return (
    <IonPage>
      <IonContent className="db-terms-page-container" scrollY={true}>
        <div className="db-terms-wrapper">
          {/* Header */}
          <header className="db-terms-header">
            <button className="db-terms-back-btn" onClick={() => history.goBack()} aria-label="Go Back">
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>
            <h1 className="db-terms-main-title">Terms & Conditions</h1>
            <p className="db-terms-subtitle">DBS OFFICE Mobile Application</p>
          </header>

          {/* Card Content */}
          <div className="db-terms-card">
            <div className="db-terms-meta">
              <span className="db-terms-badge">Effective Date: January 2025</span>
            </div>

            <div className="db-terms-body">
              <section className="db-terms-section">
                <h2>1. Acceptance of Terms</h2>
                <p>
                  By downloading, installing, accessing, or using the <strong>DBS OFFICE</strong> mobile application (the "App"),
                  you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, you must not access
                  or use the App. The App is provided for the exclusive use of employees and authorized personnel of{" "}
                  <strong>D Base Solutions Private Limited</strong> ("Company," "we," or "us").
                </p>
              </section>

              <section className="db-terms-section">
                <h2>2. Intended Use and Eligibility</h2>
                <p>
                  The App is an internal enterprise resource planning and human resources management tool. You may only use the App if
                  you are a current employee, contractor, or authorized representative of the Company. Your access to the App is
                  contingent upon your continued employment or authorization by the Company.
                </p>
              </section>

              <section className="db-terms-section">
                <h2>3. User Accounts and Security</h2>
                <ul>
                  <li>
                    <strong>Account Credentials:</strong> You are responsible for maintaining the confidentiality of your login
                    credentials (username, password, etc.).
                  </li>
                  <li>
                    <strong>Account Activity:</strong> You are responsible for all activities that occur under your account. You
                    agree to notify your administrator immediately if you suspect any unauthorized use of your account.
                  </li>
                  <li>
                    <strong>Accuracy of Information:</strong> You agree to provide and maintain accurate, current, and complete
                    information regarding your profile, work reports, leave requests, and all other submissions made through the App.
                  </li>
                </ul>
              </section>

              <section className="db-terms-section">
                <h2>4. App Features and Permissions</h2>
                <p>
                  By using specific features of the App, you consent to the collection and use of associated data as outlined in our
                  Privacy Policy:
                </p>
                <ul>
                  <li>
                    <strong>AI Attendance (Biometrics):</strong> You consent to the capture, processing, and temporary storage of
                    your facial image for the sole purpose of identity verification and attendance logging via the AI Attendance feature.
                  </li>
                  <li>
                    <strong>Location Services:</strong> You consent to the tracking of your device's geolocation to verify your
                    presence at designated work sites or for on-duty tracking purposes.
                  </li>
                  <li>
                    <strong>Camera and Storage:</strong> You consent to the App accessing your device’s camera and storage to upload
                    profile pictures, scan codes, or attach documents to tickets and requests.
                  </li>
                </ul>
              </section>

              <section className="db-terms-section">
                <h2>5. Acceptable Use Policy</h2>
                <p>You agree not to use the App to:</p>
                <ul>
                  <li>Submit false or fraudulent attendance records, work reports, or expense claims.</li>
                  <li>Attempt to bypass, disable, or interfere with security features or location tracking mechanisms of the App.</li>
                  <li>
                    Upload, transmit, or share malicious code, viruses, or any content that is offensive, defamatory, or violates
                    Company policy.
                  </li>
                  <li>Access data or accounts that you are not explicitly authorized to view.</li>
                  <li>Use the App for any purpose outside the scope of your employment or engagement with the Company.</li>
                </ul>
              </section>

              <section className="db-terms-section">
                <h2>6. Intellectual Property</h2>
                <p>
                  All content, features, functionality, software code, and design elements within the App are the exclusive property of
                  the Company or its licensors. You are granted a limited, non-exclusive, non-transferable, and revocable license to use
                  the App solely for employment-related purposes. You may not copy, modify, distribute, sell, or lease any part of the App.
                </p>
              </section>

              <section className="db-terms-section">
                <h2>7. Disclaimers and Limitations of Liability</h2>
                <ul>
                  <li>
                    <strong>As-Is Basis:</strong> The App is provided on an "AS IS" and "AS AVAILABLE" basis without any warranties,
                    express or implied.
                  </li>
                  <li>
                    <strong>No Guarantee:</strong> We do not warrant that the App will be uninterrupted, error-free, or completely secure.
                  </li>
                  <li>
                    <strong>Limitation of Liability:</strong> To the maximum extent permitted by applicable law, the Company shall not be
                    liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or
                    inability to use the App.
                  </li>
                </ul>
              </section>

              <section className="db-terms-section">
                <h2>8. Termination and Suspension</h2>
                <p>
                  The Company reserves the right to suspend or terminate your access to the App at any time, without prior notice or
                  liability, for any reason, including but not limited to:
                </p>
                <ul>
                  <li>Breach of these Terms.</li>
                  <li>Violation of Company policies.</li>
                  <li>Termination of your employment or contractual relationship with the Company.</li>
                </ul>
                <p>Upon termination, your right to use the App will immediately cease, and you must uninstall the App from your personal devices.</p>
              </section>

              <section className="db-terms-section">
                <h2>9. Changes to the Terms</h2>
                <p>
                  We reserve the right to modify or replace these Terms at any time. We will provide notice of significant changes through
                  the App or official Company communication channels. Your continued use of the App following the posting of any changes
                  constitutes acceptance of those changes.
                </p>
              </section>

              <section className="db-terms-section">
                <h2>10. Governing Law</h2>
                <p>
                  These Terms shall be governed by and construed in accordance with the laws of <strong>Andhra Pradesh, India</strong>,
                  without regard to its conflict of law provisions.
                </p>
              </section>

              <section className="db-terms-section">
                <h2>11. Contact Information</h2>
                <p>For technical support or questions regarding these Terms, please contact:</p>
                <div className="db-terms-contact-card">
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

export default TermsAndConditions;
