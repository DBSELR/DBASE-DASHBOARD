import React from "react";
import { IonPage, IonContent } from "@ionic/react";
import { useHistory } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import "./AccountDeletion.css";

const AccountDeletion: React.FC = () => {
  const history = useHistory();

  return (
    <IonPage>
      <IonContent className="db-deletion-page-container" scrollY={true}>
        <div className="db-deletion-wrapper">
          {/* Header */}
          <header className="db-deletion-header">
            <button className="db-deletion-back-btn" onClick={() => history.goBack()} aria-label="Go Back">
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>
            <h1 className="db-deletion-main-title">Account Deletion Request</h1>
            <p className="db-deletion-subtitle">DBS OFFICE Mobile Application</p>
          </header>

          {/* Card Content */}
          <div className="db-deletion-card">
            <div className="db-deletion-body">
              <section className="db-deletion-section">
                <p>
                  <strong>DBS OFFICE</strong> is an enterprise management application. For security and compliance reasons, all employee accounts are created, maintained, and managed directly by your organization's administrators.
                </p>
              </section>

              <section className="db-deletion-section">
                <h2>How to Request Account Deletion:</h2>
                <p>
                  Because your account is tied to your employment records, you cannot delete your account directly through the app. If you have left the company or wish to have your account and access removed, please follow these steps:
                </p>
                <ol className="db-deletion-steps">
                  <li>
                    <strong>Contact Your Administrator:</strong> Reach out to your HR department or system administrator directly.
                  </li>
                  <li>
                    <strong>Request Deactivation:</strong> Inform them that you are requesting the deactivation and deletion of your DBS OFFICE app access.
                  </li>
                  <li>
                    <strong>Processing:</strong> The administrator will process your request, which will revoke your login access and remove your biometric/facial data from our active authentication servers.
                  </li>
                </ol>
              </section>

              <section className="db-deletion-section">
                <h2>Important Information Regarding Your Data:</h2>
                <p>
                  Please note that even after your app access is deleted, your employer is legally required to retain certain records for tax, payroll, and labor law compliance.
                </p>
                <ul>
                  <li>
                    <strong>What gets deleted:</strong> Your login access, device tokens, and AI Attendance biometric data.
                  </li>
                  <li>
                    <strong>What gets retained:</strong> Your historical payroll data, attendance logs, submitted work reports, and employment history.
                  </li>
                </ul>
              </section>

              <section className="db-deletion-section">
                <h2>Need Help?</h2>
                <p>
                  If you are unable to reach your administrator, or if you need further assistance regarding your data privacy, please contact your company's HR department at:
                </p>
                <div className="db-deletion-contact-card">
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

export default AccountDeletion;
