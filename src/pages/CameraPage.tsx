import React, { useState, useRef } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { BarcodeFormat, BrowserMultiFormatReader } from "@zxing/library"; // Import ZXing
import jsQR from "jsqr";
import {
  IonPage,
  IonContent,
  IonIcon,
} from "@ionic/react";
import { cameraOutline, refreshOutline, scanOutline } from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import "./Stock.css";

const CameraPage: React.FC = () => {
  const [photo, setPhoto] = useState<string | null>(null);
  const [barcodeData, setBarcodeData] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const history = useHistory();

  // Take Photo using Camera
  const takePhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 100, // Higher quality for better scanning
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      });

      setPhoto(image.webPath!);
    } catch (error) {
      console.error("Camera error:", error);
    }
  };

  // Scan QR Code & Barcode from Image
  const scanBarcodeFromImage = async () => {
    if (!photo) return;

    const img = new Image();
    img.src = photo;
    img.crossOrigin = "Anonymous"; // Prevents CORS issues

    img.onload = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0, img.width, img.height);

      const imageData = ctx.getImageData(0, 0, img.width, img.height);

      // Try scanning QR Code
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
      if (qrCode) {
        setBarcodeData(`QR Code: ${qrCode.data}`);
        console.log("QR Code detected:", qrCode.data);
        return;
      }

      // If no QR code, try scanning Barcodes using ZXing
      const barcodeReader = new BrowserMultiFormatReader();
      try {
        const barcodeResult = await barcodeReader.decodeFromImageElement(img);
        setBarcodeData(`Barcode: ${barcodeResult.getText()}`);
        console.log("Barcode detected:", barcodeResult.getText());
      } catch (error) {
        setBarcodeData("No QR or Barcode detected.");
        console.warn("No barcode found.");
      }
    };

    img.onerror = () => {
      console.error("Error loading image for barcode scanning.");
    };
  };

  return (
    <IonPage>
      <IonContent className="page-content">
        <div className="wr-container stock-container" style={{ padding: 0, minHeight: 'auto', backgroundColor: 'transparent' }}>
          
          {/* ── Premium Header ── */}
          <div className="page-wr-header" style={{ margin: '16px', borderRadius: '16px', padding: '16px' }}>
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()}>
                <ChevronLeft size={22} color="white" />
              </button>
              <div>
                <h1 className="page-wr-title">Scanner</h1>
                <p className="page-wr-subtitle">Scan QR Codes and Barcodes</p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <div className="page-wr-header-icon-box">
                <IonIcon icon={scanOutline} style={{ color: 'var(--ion-color-primary)', fontSize: '24px' }} />
              </div>
            </div>
          </div>

          <div className="stock-panel" style={{ margin: '0 16px 20px 16px' }}>
            
            <div className="stock-actions" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button className="stock-button" onClick={takePhoto} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <IonIcon icon={cameraOutline} style={{ fontSize: '18px' }} />
                Take Photo
              </button>
            </div>

            {photo && (
              <div style={{ marginTop: '20px' }}>
                <div style={{ width: '100%', borderRadius: 'var(--stock-radius-md)', overflow: 'hidden', border: '1px solid var(--stock-border)' }}>
                  <img src={photo} alt="Captured" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '400px', objectFit: 'contain', background: '#000' }} />
                </div>
                <canvas ref={canvasRef} style={{ display: "none" }} />

                <div className="stock-actions" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button className="stock-button stock-button--secondary" onClick={scanBarcodeFromImage} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                    <IonIcon icon={scanOutline} style={{ fontSize: '18px' }} />
                    Scan Barcode / QR Code
                  </button>

                  <button className="stock-button stock-button--secondary" onClick={() => setPhoto(null)} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                    <IonIcon icon={refreshOutline} style={{ fontSize: '18px' }} />
                    Retake Photo
                  </button>
                </div>
              </div>
            )}

            {barcodeData && (
              <div style={{ marginTop: '20px', padding: '16px', background: 'var(--stock-elevated-bg)', borderRadius: 'var(--stock-radius-lg)', border: '1px solid var(--stock-border)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--stock-muted)', marginBottom: '8px' }}>Scanned Data:</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--stock-text)', wordBreak: 'break-word' }}>{barcodeData}</div>
              </div>
            )}

          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default CameraPage;
