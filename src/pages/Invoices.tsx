
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonItem,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
} from "@ionic/react";
import { useState } from "react";

const Invoices: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState("tracking");

  const invoiceData = [
    {
      id: 263,
      date: "28/03/2025",
      amount: 295000,
      client: "A.M. REDDY COLLEGE",
      description: "I CAMPUS BEAT PLUS",
    },
    {
      id: 262,
      date: "27/03/2025",
      amount: 365800,
      client: "CRR Engg College",
      description: "BEAT Software Tool for CRR Engineering College.",
    },
    // ... other invoice entries
  ];

  return (
    <IonPage>

      <IonSegment
        value={selectedTab}
        onIonChange={(e) => setSelectedTab(e.detail.value! as string)}
      >
        <IonSegmentButton value="tracking">
          <IonLabel>Tracking</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="inward">
          <IonLabel>Inward</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="outward">
          <IonLabel>Outward</IonLabel>
        </IonSegmentButton>
      </IonSegment>


      <IonContent className="invoices-page">
        {/* Filters - Common for all tabs */}
        <IonGrid className="filters-grid">
          <IonRow>
            <IonCol size="12" sizeMd="6">
              <IonItem>
                <IonLabel className="select-text">Employee</IonLabel>
                <IonSelect className="select-text" placeholder="All Employees">
                  <IonSelectOption value="all">All</IonSelectOption>
                  <IonSelectOption value="1">Harsha</IonSelectOption>
                  <IonSelectOption value="2">Ramesh</IonSelectOption>
                </IonSelect>
              </IonItem>
            </IonCol>
            <IonCol size="12" sizeMd="6">
              <IonItem>
                <IonLabel className="select-text">Month-Year</IonLabel>
                <IonSelect className="select-text" placeholder="Select Month-Year">
                  <IonSelectOption value="apr-2025">Apr-2025</IonSelectOption>
                  <IonSelectOption value="mar-2025">Mar-2025</IonSelectOption>
                </IonSelect>
              </IonItem>
            </IonCol>
          </IonRow>
        </IonGrid>

        {/* Conditional Rendering */}
        {selectedTab === "tracking" && (
          <>
            <h2>Tracking Invoices</h2>
            {invoiceData.map((invoice) => (
              <IonCard className="invoice-card" key={invoice.id}>
                <IonCardHeader>
                  <IonCardTitle>
                    Invoice #{invoice.id} — ₹{invoice.amount.toLocaleString()}
                  </IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <p><strong>Client:</strong> {invoice.client}</p>
                  <p><strong>Description:</strong> {invoice.description}</p>
                  <p><strong>Date:</strong> {invoice.date}</p>
                </IonCardContent>
              </IonCard>
            ))}
          </>
        )}

        {selectedTab === "inward" && (
          <>
            <h2 className="page-title">Inward Entries</h2>
            <IonCard className="invoice-card">
              <IonCardHeader>
                <IonCardTitle>Inward Placeholder</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>Inward entry list and details go here.</IonCardContent>
            </IonCard>
          </>
        )}

        {selectedTab === "outward" && (
          <>
            <h2 className="page-title">Outward Entries</h2>
            <IonCard className="invoice-card">
              <IonCardHeader>
                <IonCardTitle>Outward Placeholder</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>Outward entry list and details go here.</IonCardContent>
            </IonCard>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Invoices;


