import { IonContent, IonPage, IonIcon } from '@ionic/react';
import { useState } from 'react';
import { useHistory } from 'react-router';
import { 
  mailOutline, calendarOutline, settingsOutline, 
  arrowBackOutline, logOutOutline, sendOutline, 
  fingerPrintOutline 
} from 'ionicons/icons';
import { API_BASE_URL } from './ai_config';
import './AIAttendanceAdminDashboard.css';

const AIAttendanceAdminDashboard: React.FC = () => {
  const [email, setEmail] = useState('');
  const [popupMessage, setPopupMessage] = useState('');
  const history = useHistory();

  const showPopup = (msg: string) => {
    setPopupMessage(msg);
    setTimeout(() => {
        setPopupMessage('');
    }, 4000);
  };

  const handleSendEmail = async () => {
    if (!email) {
      showPopup('Please enter a valid email address.');
      return;
    }

    showPopup('Sending...');

    try {
      const response = await fetch(`${API_BASE_URL}/send_attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      if (data.success) {
        showPopup('Attendance report sent successfully!');
        setEmail('');
      } else {
        showPopup(data.message || 'Failed to send attendance report.');
      }
    } catch (error) {
      showPopup('An error occurred while sending the report.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    history.push('/login');
  };

  return (
    <IonPage className="ad-page">
      <IonContent fullscreen style={{ '--background': 'transparent' }}>
        <div className="ad-shell">
          
          {/* Header */}
          <div className="ad-header">
            <button className="ad-back" onClick={() => history.push('/home')}>
              <IonIcon icon={arrowBackOutline} />
            </button>
            <div className="ad-title-wrap">
              <h1 className="ad-title">AI Attendance</h1>
              <p className="ad-subtitle">Admin Management Console</p>
            </div>
          </div>

          {/* Body */}
          <div className="ad-body">
            <div className="ad-container">
              
              <div className="ad-logo-header">
                <div className="ad-logo-icon">
                  <IonIcon icon={fingerPrintOutline} />
                </div>
                <h2 className="ad-logo-title">Control Panel</h2>
                <p className="ad-logo-desc">Manage geofence rules, beacons, and review attendance logs</p>
              </div>

              {/* Grid Options */}
              <div className="ad-grid">
                <div className="ad-card-option" onClick={() => history.push('/ai-attendance-log/logs')}>
                  <div className="ad-card-icon ad-card-logs">
                    <IonIcon icon={calendarOutline} />
                  </div>
                  <h3 className="ad-card-title">Attendance Logs</h3>
                  <p className="ad-card-subtitle">Review daily records, check-in timelines, and presence parameters.</p>
                </div>

                <div className="ad-card-option" onClick={() => history.push('/ai-attendance-rule-master')}>
                  <div className="ad-card-icon ad-card-rules">
                    <IonIcon icon={settingsOutline} />
                  </div>
                  <h3 className="ad-card-title">Rule Master</h3>
                  <p className="ad-card-subtitle">Enforce Bluetooth and GPS validation rules by branch or employee.</p>
                </div>
              </div>

              {/* Email Report section */}
              <div className="ad-report-card">
                <h3 className="ad-report-title">Send Attendance Report</h3>
                <p className="ad-report-desc">Send a full CSV sheet export directly to an administrator's email inbox.</p>
                
                {popupMessage && (
                  <div className="ad-toast">
                    {popupMessage}
                  </div>
                )}
                
                <div className="ad-input-group">
                  <div className="ad-input-wrapper">
                    <IonIcon icon={mailOutline} className="ad-input-icon" />
                    <input 
                      type="email" 
                      value={email} 
                      placeholder="Enter admin email address"
                      onChange={e => setEmail(e.target.value)}
                      className="ad-input"
                    />
                  </div>
                  <button className="ad-btn-send" onClick={handleSendEmail}>
                    <IonIcon icon={sendOutline} />
                    Send Email Report
                  </button>
                </div>
              </div>

            </div>

            <button className="ad-logout" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '24px' }}>
              <IonIcon icon={logOutOutline} />
              Log Out
            </button>
          </div>

        </div>
      </IonContent>
    </IonPage>
  );
};

export default AIAttendanceAdminDashboard;
