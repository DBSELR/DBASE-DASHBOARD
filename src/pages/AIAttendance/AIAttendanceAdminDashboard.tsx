import { IonContent, IonPage, IonInput, IonButton } from '@ionic/react';
import { useState, useEffect } from 'react';
import { useHistory } from 'react-router';
import { API_BASE_URL } from './ai_config';

const AIAttendanceAdminDashboard: React.FC = () => {
  const [email, setEmail] = useState('');
  const [popupMessage, setPopupMessage] = useState('');
  const history = useHistory();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        history.push('/ai-attendance-admin-login');
    }
  }, [history]);

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

    const token = localStorage.getItem('adminToken');
    if (!token) {
        history.push('/ai-attendance-admin-login');
        return;
    }

    showPopup('Sending...'); // Give immediate feedback

    try {
      const response = await fetch(`${API_BASE_URL}/send_attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      if (data.success) {
        showPopup('Attendance report sent successfully!');
        setEmail('');
      } else {
        showPopup(data.message || 'Failed to send attendance report.');
        if (response.status === 401) {
            handleLogout();
        }
      }
    } catch (error) {
      showPopup('An error occurred while sending the report.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    history.push('/ai-attendance-admin-login');
  };

  return (
    <IonPage>
      <IonContent fullscreen style={{ '--background': 'transparent' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1rem' }}>
            <div style={{ background: 'rgba(26, 27, 46, 0.9)', color: 'white', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', padding: '3rem', width: '100%', maxWidth: '800px', backdropFilter: 'blur(10px)' }}>
                <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '2rem', textAlign: 'center', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
                    Admin Dashboard
                </h1>
                
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3rem', gap: '1rem', flexWrap: 'wrap' }}>
                    
                    
                      <IonButton shape="round" style={{ width: 'auto', minWidth: '220px', fontSize: '1.1rem', '--background': 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)', '--box-shadow': '0 4px 6px -1px rgba(249, 115, 22, 0.4)' }} routerLink="/ai-attendance-reports">
                         View Reports
                    </IonButton>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem', textAlign: 'center', position: 'relative' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#e5e7eb' }}>Send Attendance Report</h2>
                    
                    {popupMessage && (
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(12px)', padding: '2rem', borderRadius: '20px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', minWidth: '300px', textAlign: 'center', color: 'white', zIndex: 9999, transition: 'all 0.3s ease' }}>
                            {popupMessage}
                        </div>
                    )}
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <IonInput 
                            type="email" 
                            value={email} 
                            placeholder="Enter admin email"
                            onIonChange={e => setEmail(e.detail.value!)}
                            style={{ background: 'rgba(255,255,255,0.05)', color: 'white', borderRadius: '8px', padding: '12px 16px', marginBottom: '1rem', width: '100%', maxWidth: '400px', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                        <IonButton className="btn-teal" shape="round" style={{ width: 'auto', minWidth: '220px', fontSize: '1.1rem' }} onClick={handleSendEmail}>
                            Send Email Report
                        </IonButton>
                    </div>
                </div>
            </div>

            <IonButton color="danger" shape="round" style={{ marginTop: '2rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', fontWeight: 'bold' }} onClick={handleLogout}>
                Logout
            </IonButton>
        </div>

        <div className="credits-popup" style={{ position: 'fixed', bottom: '2rem', left: '2rem', background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(12px)', padding: '1.5rem', borderRadius: '16px' }}>
            <div className="credits-content">
                <h3 style={{ color: 'white', marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 'bold' }}>Credits</h3>
                <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: '1.6', margin: 0 }}>Developer:<br/>Sandeep Dukkipati<br/>Company:<br/>DBase Solutions Pvt Ltd</p>
            </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AIAttendanceAdminDashboard;

