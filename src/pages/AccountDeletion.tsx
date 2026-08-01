import React from "react";
import { IonPage, IonContent } from "@ionic/react";
import { useHistory } from "react-router-dom";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import "./AccountDeletion.css";
import "./WorkReports.css";
import "./RequestsPage.css";
import "./Stock.css";
import "./PenaltyAssignment.css";
import "./WorkReportDashboard.css";

const AccountDeletion: React.FC = () => {
  const history = useHistory();

  return (
    <IonPage>
      <IonContent className="page-content" scrollY={true}>
        <div className="wr-container stock-container" style={{ padding: 0, minHeight: 'auto', backgroundColor: 'transparent' }}>
          
          <div className="page-wr-header" style={{ margin: '16px', borderRadius: '16px', padding: '16px' }}>
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()} aria-label="Go Back">
                <ChevronLeft size={22} color="white" />
              </button>
              <div>
                <h1 className="page-wr-title">Account Deletion Request</h1>
                <p className="page-wr-subtitle">DBS OFFICE Mobile Application</p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <div className="page-wr-icon-box" style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                <ShieldAlert size={22} color="white" />
              </div>
            </div>
          </div>

          <div className="stock-panel animate-entrance" style={{ margin: '0 16px 20px 16px', padding: '24px' }}>
            <div className="db-deletion-body" style={{ maxWidth: '800px', margin: '0 auto' }}>
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
