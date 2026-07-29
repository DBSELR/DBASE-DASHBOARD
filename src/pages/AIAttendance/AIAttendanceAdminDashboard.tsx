import { IonContent, IonPage, IonIcon, IonToast } from '@ionic/react';
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
  
  // Toast state
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastColor, setToastColor] = useState<"success" | "danger" | "warning">("success");
  
  const history = useHistory();

  const showToast = (msg: string, color: "success" | "danger" | "warning" = "success") => {
    setToastMsg(msg);
    setToastColor(color);
    setToastOpen(true);
  };

  const handleSendEmail = async () => {
    if (!email) {
      showToast('Please enter a valid email address.', 'warning');
      return;
    }

    showToast('Sending report...', 'success');

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
        showToast('Attendance report sent successfully!', 'success');
        setEmail('');
      } else {
        showToast(data.message || 'Failed to send attendance report.', 'danger');
      }
    } catch (error) {
      showToast('An error occurred while sending the report.', 'danger');
    }
  };

  const handleLogout = () => {
    window.dispatchEvent(new Event("app:logout"));
  };

  return (
    <IonPage>
      <IonContent fullscreen scrollY>
        <div className="wr-container stock-container" style={{ padding: '0', minHeight: 'auto', backgroundColor: 'transparent', overflow: 'visible' }}>
          
          <div className="page-wr-header" style={{ margin: '16px', borderRadius: '16px', padding: '16px', position: 'sticky', top: '16px', zIndex: 9999 }}>
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.push('/home')}>
                <IonIcon icon={arrowBackOutline} style={{ color: "white" }} />
              </button>
              <div>
                <h1 className="page-wr-title">AI Attendance</h1>
                <p className="page-wr-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span className="subtitle-pulse-dot" />
                  <span>Admin Management Console</span>
                </p>
              </div>
            </div>
          </div>

          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            
            <div style={{ textAlign: 'center', padding: '24px 0 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'linear-gradient(135deg, var(--ion-color-primary) 0%, #0d9488 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '28px', boxShadow: '0 10px 25px rgba(13, 148, 136, 0.3)' }}>
                <IonIcon icon={fingerPrintOutline} />
              </div>
              <h2 style={{ margin: '12px 0 4px', fontSize: '24px', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.5px' }}>Control Panel</h2>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#64748b' }}>Manage geofence rules, beacons, and review attendance logs</p>
            </div>

            {/* Grid Options */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              
              <div 
                className="stock-panel ad-card-hover" 
                onClick={() => history.push('/ai-attendance-log/logs')}
                style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer', borderRadius: '16px', transition: 'all 0.2s' }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#fdf2e9', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                  <IonIcon icon={calendarOutline} />
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>Attendance Logs</h3>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#64748b', lineHeight: 1.5 }}>Review daily records, check-in timelines, and presence parameters.</p>
              </div>

              <div 
                className="stock-panel ad-card-hover" 
                onClick={() => history.push('/ai-attendance-rule-master')}
                style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer', borderRadius: '16px', transition: 'all 0.2s' }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#e6f4f2', color: 'var(--ion-color-primary, #0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                  <IonIcon icon={settingsOutline} />
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>Rule Master</h3>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#64748b', lineHeight: 1.5 }}>Enforce Bluetooth and GPS validation rules by branch or employee.</p>
              </div>

            </div>

            {/* Email Report section */}
            <div className="stock-panel" style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '20px', borderRadius: '16px', marginTop: '8px' }}>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>Send Attendance Report</h3>
                <p style={{ margin: '6px 0 0', fontSize: '13px', fontWeight: 500, color: '#64748b' }}>Send a full CSV sheet export directly to an administrator's email inbox.</p>
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'stretch' }}>
                <div className="stock-input" style={{ flex: '1 1 300px', display: 'flex', alignItems: 'center', gap: '10px', padding: '0 16px', height: '52px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <IonIcon icon={mailOutline} style={{ color: '#94a3b8', fontSize: '20px' }} />
                  <input 
                    type="email" 
                    value={email} 
                    placeholder="Enter admin email address"
                    onChange={e => setEmail(e.target.value)}
                    style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '15px', fontWeight: 600, color: '#1e293b' }}
                  />
                </div>
                <button 
                  onClick={handleSendEmail}
                  style={{ flex: '0 0 auto', background: 'var(--ion-color-primary, #0d9488)', color: 'white', border: 'none', padding: '0 24px', height: '52px', borderRadius: '14px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(13, 148, 136, 0.2)' }}
                >
                  <IonIcon icon={sendOutline} style={{ fontSize: '18px' }} />
                  Send Email Report
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px', paddingBottom: '32px' }}>
              <button 
                onClick={handleLogout} 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 28px', borderRadius: '14px', background: '#fef2f2', color: '#ef4444', border: '1.5px solid #fee2e2', fontWeight: 800, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <IonIcon icon={logOutOutline} style={{ fontSize: '18px' }} />
                Log Out
              </button>
            </div>

          </div>

          <IonToast
            isOpen={toastOpen}
            onDidDismiss={() => setToastOpen(false)}
            message={toastMsg}
            duration={3000}
            color={toastColor}
            position="top"
          />

        </div>
      </IonContent>
    </IonPage>
  );
};

export default AIAttendanceAdminDashboard;
