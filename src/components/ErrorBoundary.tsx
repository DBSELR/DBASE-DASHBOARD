import React, { Component, ErrorInfo, ReactNode } from "react";
import { IonPage, IonContent, IonButton, IonIcon } from "@ionic/react";
import { refreshOutline, homeOutline, arrowBackOutline, alertCircleOutline } from "ionicons/icons";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/home";
  };

  private handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/home";
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <IonPage>
          <IonContent className="ion-padding">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "80vh",
                textAlign: "center",
                padding: "24px",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "50%",
                  backgroundColor: "#fee2e2",
                  color: "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "36px",
                  marginBottom: "20px",
                  boxShadow: "0 10px 25px rgba(239, 68, 68, 0.15)",
                }}
              >
                <IonIcon icon={alertCircleOutline} />
              </div>

              <h2
                style={{
                  fontSize: "1.4rem",
                  fontWeight: "700",
                  color: "#0f172a",
                  marginBottom: "8px",
                }}
              >
                {this.props.fallbackTitle || "Something went wrong"}
              </h2>

              <p
                style={{
                  fontSize: "0.9rem",
                  color: "#64748b",
                  maxWidth: "420px",
                  lineHeight: "1.5",
                  marginBottom: "24px",
                }}
              >
                An unexpected error occurred while rendering this page. You can try refreshing or going back to the home screen.
              </p>

              {this.state.error && (
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    maxWidth: "90%",
                    fontSize: "0.78rem",
                    color: "#dc2626",
                    fontFamily: "monospace",
                    marginBottom: "24px",
                    wordBreak: "break-word",
                    textAlign: "left",
                    maxHeight: "120px",
                    overflowY: "auto",
                  }}
                >
                  <strong>Error:</strong> {this.state.error.message || String(this.state.error)}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                <IonButton color="primary" onClick={this.handleReload}>
                  <IonIcon slot="start" icon={refreshOutline} />
                  Refresh Page
                </IonButton>

                <IonButton color="medium" fill="outline" onClick={this.handleGoBack}>
                  <IonIcon slot="start" icon={arrowBackOutline} />
                  Go Back
                </IonButton>

                <IonButton color="tertiary" fill="clear" onClick={this.handleGoHome}>
                  <IonIcon slot="start" icon={homeOutline} />
                  Home
                </IonButton>
              </div>
            </div>
          </IonContent>
        </IonPage>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
