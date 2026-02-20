import React, { useState, useRef } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { BarcodeFormat, BrowserMultiFormatReader } from "@zxing/library"; // Import ZXing
import jsQR from "jsqr";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonImg,
  IonIcon,
  IonLabel,
  IonRow,
} from "@ionic/react";
import { cameraOutline, refreshOutline, scanOutline } from "ionicons/icons";

const CameraPage: React.FC = () => {
  const [photo, setPhoto] = useState<string | null>(null);
  const [barcodeData, setBarcodeData] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      <IonHeader>
        <IonToolbar>
          <IonToolbar color="Tertiary" className="menu-toolbar">
            <img
              src="./images/dbase.png"
              alt="DBase Logo"
              className="menu-logo"
            />
          </IonToolbar>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div className="camera-container">

          <IonRow className="button-row">
            <IonButton
              expand="block"
              className="login-btn2"
              style={{ "--box-shadow": "none" }}
              color={"#f57c00"}
              onClick={takePhoto}
            >
              <IonIcon icon={cameraOutline} slot="start" />
              Take Photo
            </IonButton>
          </IonRow>

          {photo && (
            <>
              <IonImg src={photo} alt="Captured" />
              <canvas ref={canvasRef} style={{ display: "none" }} />

              <IonRow className="button-row">
                <IonButton
                  expand="block"
                  className="login-btn2"
                  style={{ "--box-shadow": "none" }}
                  color={"#f57c00"}
                  onClick={scanBarcodeFromImage}
                >
                  <IonIcon icon={scanOutline} slot="start" />
                  Scan Barcode / QR Code
                </IonButton>

                <IonButton
                  expand="block"
                  className="login-btn2"
                  style={{ "--box-shadow": "none" }}
                  color={"#f57c00"}
                  onClick={() => setPhoto(null)}
                >
                  <IonIcon icon={refreshOutline} slot="start" />
                  Retake Photo
                </IonButton>
              </IonRow>
            </>
          )}

          {barcodeData && (
            <IonLabel className="barcode-data" id="margin-b">
              <h3>Scanned Data:</h3>
              <h1>{barcodeData}</h1>
            </IonLabel>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default CameraPage;
