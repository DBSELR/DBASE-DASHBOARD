import { IonPage, IonContent, IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { useState, useEffect } from 'react';
import { useHistory } from 'react-router';
import { arrowBackOutline, downloadOutline, eyeOutline, closeOutline, trashOutline } from 'ionicons/icons';
import { API_BASE_URL, AI_API_KEY } from './ai_config';

interface Report {
  date: string;
  filename: string;
}

interface AttendanceRecord {
  'Emp ID'?: string;
  Name: string;
  'Morning In': string;
  'Lunch Out': string;
  'Lunch In': string;
  'Evening Out': string;
}

const AIAttendanceReports: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');

  const history = useHistory();

  const showPopup = (msg: string) => {
    setPopupMessage(msg);
    setTimeout(() => setPopupMessage(''), 4000);
  };

  useEffect(() => {
    fetchReports();
  }, [history]);

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/list_reports`, {
        headers: {
          'x-api-key': AI_API_KEY
        }
      });
      const data = await response.json();
      if (data.success) {
        const hiddenReportsStr = localStorage.getItem('hiddenReports_v3') || '[]';
        const hiddenReports = JSON.parse(hiddenReportsStr);
        setReports(data.reports.filter((r: Report) => !hiddenReports.includes(r.filename)));
      } else {
        showPopup(data.message || 'Failed to load reports');
      }
    } catch (error) {
      showPopup('Network error loading reports');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/download_report/${filename}`, {
        headers: {
          'x-api-key': AI_API_KEY
        }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        showPopup('Failed to download file');
      }
    } catch (e) {
      showPopup('Error downloading file');
    }
  };

  const handleDelete = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to delete ${filename}? This cannot be undone.`)) {
      return;
    }
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/delete_report/${filename}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': AI_API_KEY
        }
      });
      const data = await response.json();
      if (data.success) {
        const hiddenReportsStr = localStorage.getItem('hiddenReports_v3') || '[]';
        const hiddenReports = JSON.parse(hiddenReportsStr);
        if (!hiddenReports.includes(filename)) {
          hiddenReports.push(filename);
          localStorage.setItem('hiddenReports_v3', JSON.stringify(hiddenReports));
        }
        showPopup('Report deleted successfully');
        fetchReports();
      } else {
        showPopup(data.message || 'Failed to delete report');
      }
    } catch (e) {
      showPopup('Error deleting report');
    }
  };

  const viewData = async (date: string) => {
    setSelectedDate(date);
    setLoadingData(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/get_attendance?date=${date}`, {
        headers: {
          'x-api-key': AI_API_KEY
        }
      });
      const data = await response.json();
      if (data.success) {
        setAttendanceData(data.data);
      } else {
        showPopup(data.message || 'Failed to load data');
        setSelectedDate(null);
      }
    } catch (e) {
      showPopup('Error loading data');
      setSelectedDate(null);
    } finally {
      setLoadingData(false);
    }
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr || timeStr === '-') return '-';
    if (timeStr.includes('1900-01-01')) {
      const parts = timeStr.split(/[ T]/);
      if (parts.length > 1) {
        return parts[1].split('.')[0];
      }
    }
    return timeStr;
  };

  return (
    <IonPage>
      <IonContent fullscreen style={{ '--background': 'transparent' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', padding: '2rem 1rem' }}>

          <div style={{ width: '100%', maxWidth: '900px', display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
            <IonButton fill="clear" style={{ color: 'white' }} onClick={() => history.push('/ai-attendance-admin-dashboard')}>
              <IonIcon icon={arrowBackOutline} slot="start" />
              Back to Dashboard
            </IonButton>
          </div>

          <div style={{ background: 'rgba(26, 27, 46, 0.9)', color: 'white', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', padding: '2rem 3rem', width: '100%', maxWidth: '900px', backdropFilter: 'blur(10px)', position: 'relative' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '2rem', textAlign: 'center', background: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
              Historical Reports
            </h1>

            {popupMessage && (
              <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(12px)', padding: '1rem 2rem', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)', minWidth: '300px', textAlign: 'center', color: 'white', zIndex: 9999, transition: 'all 0.3s ease', border: '1px solid rgba(255,255,255,0.2)' }}>
                {popupMessage}
              </div>
            )}

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <IonSpinner name="crescent" color="light" />
              </div>
            ) : reports.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>
                No historical reports found.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {reports.map((report) => (
                  <div key={report.filename} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: '500', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316' }}></div>
                      Attendance - {report.date}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <IonButton shape="round" style={{ '--background': 'rgba(255,255,255,0.1)', color: 'white' }} onClick={() => viewData(report.date)}>
                        <IonIcon icon={eyeOutline} slot="start" />
                        View Data
                      </IonButton>
                      <IonButton shape="round" style={{ '--background': 'linear-gradient(135deg, #10b981 0%, #047857 100%)', color: 'white' }} onClick={() => handleDownload(report.filename)}>
                        <IonIcon icon={downloadOutline} slot="start" />
                        Download CSV
                      </IonButton>
                      <IonButton shape="round" style={{ '--background': 'linear-gradient(135deg, #ef4444 0%, #991b1b 100%)', color: 'white' }} onClick={() => handleDelete(report.filename)}>
                        <IonIcon icon={trashOutline} slot="icon-only" />
                      </IonButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Overlay for Data View */}
          {selectedDate && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: '#1a1b2e', borderRadius: '24px', width: '100%', maxWidth: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem' }}>Attendance Data: <span style={{ color: '#f97316' }}>{selectedDate}</span></h2>
                  <IonButton fill="clear" onClick={() => setSelectedDate(null)} style={{ color: '#94a3b8', margin: 0 }}>
                    <IonIcon icon={closeOutline} size="large" />
                  </IonButton>
                </div>

                <div style={{ padding: '2rem', overflowY: 'auto' }}>
                  {loadingData ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                      <IonSpinner name="crescent" color="light" />
                    </div>
                  ) : attendanceData.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0', fontSize: '1.1rem' }}>
                      No records found for this date.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '1rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white', minWidth: '700px' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: '600' }}>Emp Name</th>
                            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: '600', color: '#c084fc' }}>Emp ID</th>
                            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: '600', color: '#38bdf8' }}>Morning In</th>
                            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: '600', color: '#fbbf24' }}>Lunch Out</th>
                            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: '600', color: '#a3e635' }}>Lunch In</th>
                            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: '600', color: '#f43f5e' }}>Evening Out</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceData.map((row, idx) => {
                            const nameString = row.Name || '';
                            const namePart = nameString.split('(')[0].trim();
                            const idPart = row['Emp ID'] || (nameString.includes('(') ? nameString.split('(')[1].replace(')', '').trim() : '-');
                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s', ...((idx % 2 === 0) ? { background: 'rgba(255,255,255,0.02)' } : {}) }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'} onMouseLeave={e => e.currentTarget.style.background = (idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent')}>
                                <td style={{ padding: '1rem', fontWeight: '500' }}>{namePart}</td>
                                <td style={{ padding: '1rem', color: '#c084fc', fontWeight: 'bold' }}>{idPart}</td>
                                <td style={{ padding: '1rem', color: '#e2e8f0' }}>{formatTime(row['Morning In'])}</td>
                                <td style={{ padding: '1rem', color: '#e2e8f0' }}>{formatTime(row['Lunch Out'])}</td>
                                <td style={{ padding: '1rem', color: '#e2e8f0' }}>{formatTime(row['Lunch In'])}</td>
                                <td style={{ padding: '1rem', color: '#e2e8f0' }}>{formatTime(row['Evening Out'])}</td></tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </IonContent>
    </IonPage>
  );
};

export default AIAttendanceReports;
