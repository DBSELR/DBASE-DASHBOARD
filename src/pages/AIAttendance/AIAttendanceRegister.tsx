import { IonContent, IonPage, IonInput, IonButton, IonSpinner, IonIcon } from '@ionic/react';
import { useState, useEffect } from 'react';
import { useHistory } from 'react-router';
import { API_BASE_URL, AI_API_KEY } from './ai_config';

const AIAttendanceRegister: React.FC = () => {
  const [name, setName] = useState('');
  const [empId, setEmpId] = useState('');
  const [images, setImages] = useState<FileList | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const history = useHistory();

  const showPopup = (msg: string) => {
    setPopupMessage(msg);
    setTimeout(() => {
        setPopupMessage('');
    }, 4000);
  };



  const handleSubmit = async () => {
    if (!name.trim()) {
      showPopup('Employee name is required.');
      return;
    }
    if (!images || images.length === 0) {
      showPopup('Please attach the facial extraction folder.');
      return;
    }

    

    setIsProcessing(true);

    const formData = new FormData();
    const finalName = empId.trim() ? `${name.trim()} (${empId.trim()})` : name.trim();
    formData.append('name', finalName);
    Array.from(images).forEach((file) => {
      formData.append('images[]', file);
    });

    try {
      const response = await fetch(`${API_BASE_URL}/register_employee`, {
        method: 'POST',
        headers: {
          'x-api-key': AI_API_KEY
        },
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        showPopup('Registered Successfully, Thankyou!');
        setTimeout(() => history.push('/ai-attendance-admin-dashboard'), 1500);
      } else {
        showPopup(data.message || 'Registration failed.');
        
      }
    } catch (error) {
      showPopup('Neural network connection error.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen style={{ '--background': 'transparent' }}>
        <div style={{ maxWidth: '800px', margin: '3rem auto', background: 'rgba(26, 27, 46, 0.8)', borderRadius: '20px', padding: '3rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', color: 'white', position: 'relative' }}>
          
          {popupMessage && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(12px)', padding: '2rem', borderRadius: '20px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', minWidth: '300px', textAlign: 'center', color: 'white', zIndex: 9999, transition: 'all 0.3s ease' }}>
                  {popupMessage}
              </div>
          )}
          
          <h1 style={{ textAlign: 'center', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', WebkitBackgroundClip: 'text', color: 'transparent', marginBottom: '2rem', fontSize: '2.5rem', fontWeight: 'bold' }}>
              New Employee Registration
          </h1>

          <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', borderLeft: '4px solid #6366f1' }}>
              <h3 style={{ color: '#a855f7', marginBottom: '1rem', fontWeight: 'bold', fontSize: '1.2rem' }}>📸 Photo Upload Instructions</h3>
              <ul style={{ paddingLeft: '1.5rem', color: '#94a3b8', lineHeight: '1.6', fontSize: '1.1rem' }}>
                  <li>Please select a <strong>folder</strong> containing images of the new employee's face.</li>
                  <li>Save the file name with the employee name.</li>
                  <li>Provide at least <strong>3-5 clear images</strong> for better recognition accuracy.</li>
                  <li>Images should be well-lit, showing the face clearly looking near the camera.</li>
                  <li>Avoid wearing hats, dark sunglasses, or masks in the reference photos.</li>
                  <li>Consider the below images as reference</li>
              </ul>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', textAlign: 'center', width: '200px', flexGrow: 1, maxWidth: '250px', border: '2px solid #4ade80' }}>
                  <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>👤</div>
                  <h4 style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '1.2rem', margin: 0 }}>Good</h4>
                  <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '0.5rem' }}>Clear face, well lit, plain background, looking straight</p>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', textAlign: 'center', width: '200px', flexGrow: 1, maxWidth: '250px', border: '2px solid #f87171' }}>
                  <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🧢🕶️</div>
                  <h4 style={{ color: '#f87171', fontWeight: 'bold', fontSize: '1.2rem', margin: 0 }}>Bad</h4>
                  <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '0.5rem' }}>Face covered by accessories, poor lighting, extreme angles</p>
              </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginBottom: '2rem' }}>
              <img src="/assets/reference_image.png" alt="Reference Image" style={{ width: '400px', height: '250px', objectFit: 'cover', borderRadius: '12px', border: '2px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.4)' }} />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontWeight: 'bold' }}>Employee Full Name</label>
              <input 
                 type="text" 
                 value={name} 
                 onChange={e => setName(e.target.value)} 
                 placeholder="e.g. John Doe"
                 style={{ width: '100%', padding: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', fontSize: '1.1rem', outline: 'none' }} 
              />
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontWeight: 'bold' }}>Employee ID</label>
              <input 
                 type="text" 
                 value={empId} 
                 onChange={e => setEmpId(e.target.value)} 
                 placeholder="e.g. 1571"
                 style={{ width: '100%', padding: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', fontSize: '1.1rem', outline: 'none' }} 
              />
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontWeight: 'bold' }}>Select Folder with Employee Photos</label>
              <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                  <label htmlFor="image-upload" style={{ display: 'block', padding: '2.5rem', textAlign: 'center', background: images && images.length > 0 ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255,255,255,0.05)', border: images && images.length > 0 ? '2px solid #4ade80' : '2px dashed rgba(99, 102, 241, 0.5)', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.3s', color: images && images.length > 0 ? 'white' : '#94a3b8', boxSizing: 'border-box' }}>
                      <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>{images && images.length > 0 ? '✅' : '📁'}</span>
                      {images && images.length > 0 ? `Selected ${images.length} valid images` : 'Click here to select a folder of images'}
                  </label>
                  <input 
                    type="file" 
                    id="image-upload" 
                    onChange={e => setImages(e.target.files)}
                    // @ts-ignore
                    webkitdirectory="true"
                    multiple
                    style={{ display: 'none' }}
                  />
              </div>
          </div>
          
          <IonButton className="btn-primary" expand="block" shape="round" style={{ marginTop: '20px', height: '60px', fontSize: '1.2rem' }} onClick={handleSubmit} disabled={isProcessing}>
              {isProcessing ? <IonSpinner name="bubbles" /> : "Register Employee"}
          </IonButton>

          <a href="#" onClick={(e) => { e.preventDefault(); history.push('/ai-attendance-admin-dashboard'); }} style={{ display: 'block', textAlign: 'center', marginTop: '2rem', color: '#94a3b8', textDecoration: 'none', transition: 'color 0.3s' }}>
              ← Back to Admin Dashboard
          </a>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AIAttendanceRegister;
