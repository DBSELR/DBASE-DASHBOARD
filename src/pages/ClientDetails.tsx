import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonButton,
  IonInput,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardHeader,
  IonCardContent,
  IonList,
  IonItem,
  IonCheckbox,
} from "@ionic/react";
import React, { useState } from "react";

const ClientDetails: React.FC = () => {
  const [tab, setTab] = useState("projects");

  // Dummy data
  const clientData = [
    { id: 58, name: "DS. GOVT DEGREE COLLEGE FOR WOMENS" },
    { id: 57, name: "A.M. REDDY COLLEGE" },
    { id: 56, name: "A.M. REDDY" },
    { id: 55, name: "St. Joseph Dental college" },
    { id: 54, name: "Vikas College Of Engineering & Technology" },
  ];

  const projectData = [
    { id: 9, name: "AU PG" },
    { id: 8, name: "AU UG" },
    { id: 7, name: "STUDENT PORTAL" },
    { id: 6, name: "OFFICE UG (WINDOWS)" },
    { id: 5, name: "LIBRARY (WINDOWS)" },
    { id: 47, name: "I CAMPUS" },
    { id: 46, name: "AKU PG" },
    { id: 45, name: "AKU UG" },
    { id: 4, name: "ICAMPUS UG (WINDOWS)" },
  ];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="menu-toolbar">
          <img
            src="./images/dbase.png"
            alt="DBase Logo"
            className="menu-logo"
          />
        </IonToolbar>
      </IonHeader>

      <IonToolbar>
        <IonSegment
          value={tab}
          onIonChange={(e) => setTab((e.detail.value as string) || "projects")}
        >
          <IonSegmentButton value="projects">
            <IonLabel>Projects/Clients</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="mapping">
            <IonLabel>Mapping</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="details">
            <IonLabel>Client Details</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </IonToolbar>

      <IonContent className="ion-padding">
        {/* TAB 1: PROJECTS/CLIENTS */}
        {tab === "projects" && (
          <div>
            <IonCard className='card-box-main'>
              <IonCardHeader>
                <h2>Project Master</h2>
              </IonCardHeader>
              <IonGrid>
                <IonRow>
                  <IonCol size="12" size-md="4">
                    <IonLabel>Project ID</IonLabel>
                    <IonItem button>
                      <IonInput placeholder="Enter Project ID" />
                    </IonItem>
                  </IonCol>
                  <IonCol size="12" size-md="8">
                    <IonLabel>Project Name</IonLabel>
                    <IonItem button>
                      <IonInput placeholder="Enter Project Name" />
                    </IonItem>
                  </IonCol>
                </IonRow>
              </IonGrid>
            </IonCard>

            <IonCard className='card-box-main'>
              <IonCardHeader>
                <h2>Client Master</h2>
              </IonCardHeader>
              <IonGrid>
                <IonRow>
                  <IonCol size="12" size-md="4">
                    <IonLabel>Client Type</IonLabel>

                    <IonItem button>
                      <IonInput placeholder="Enter Client Type" />
                    </IonItem>
                  </IonCol>
                  <IonCol size="12" size-md="4">
                    <IonLabel>Client Name</IonLabel>
                    <IonItem button>
                      <IonInput placeholder="Enter Client Name" />
                    </IonItem>
                  </IonCol>
                  <IonCol size="12" size-md="4">
                    <IonLabel>Client Location</IonLabel>
                    <IonItem button>
                      <IonInput placeholder="Enter Location" />
                    </IonItem>
                  </IonCol>
                </IonRow>
              </IonGrid>
            </IonCard>

            <IonCard className='card-box-main'>
              <IonCardHeader>
                <h2>Administration Details</h2>
              </IonCardHeader>
              {[1, 2, 3].map((admin) => (
                <IonGrid key={admin}>
                  <IonRow>
                    <IonCol size="12" size-md="3">
                      <IonLabel>Name</IonLabel>
                      <IonItem button>
                        <IonInput placeholder={`Admin ${admin} Name`} />
                      </IonItem>
                    </IonCol>
                    <IonCol size="12" size-md="3">
                      <IonLabel>Designation</IonLabel>
                      <IonItem button>
                        <IonInput placeholder="Designation" />
                      </IonItem>
                    </IonCol>
                    <IonCol size="12" size-md="3">
                      <IonLabel>Mobile</IonLabel>
                      <IonItem button>
                        <IonInput placeholder="Mobile No" />
                      </IonItem>
                    </IonCol>
                    <IonCol size="12" size-md="3">
                      <IonLabel>Email</IonLabel>
                      <IonItem button>
                        <IonInput placeholder="Email" />
                      </IonItem>
                    </IonCol>
                  </IonRow>
                </IonGrid>
              ))}
            </IonCard>
          </div>
        )}

        {/* TAB 2: MAPPING */}
        {tab === "mapping" && (
          <IonCard className='card-box-main'>
            <IonCardHeader>
              <h2>Client Mapping</h2>
            </IonCardHeader>
            <IonCardContent>
              <IonGrid>
                <IonRow>
                  <IonCol size="6" className="main-box-center">
                    <IonButton
                      expand="block"
                      className="login-btn2"
                      style={{ "--box-shadow": "none" }}
                      color={"#f57c00"}
                    >
                      Save
                    </IonButton>
                  </IonCol>
                  <IonCol size="6" className="main-box-center">
                    <IonButton
                      expand="block"
                      className="login-btn2"
                      style={{ "--box-shadow": "none" }}
                      color={"#f57c00"}
                    >
                      Clear
                    </IonButton>
                  </IonCol>
                </IonRow>

                <IonRow>
                  {/* Clients List */}
                  <IonCol size="12" size-md="6">
                    <h2>Clients</h2>
                    <IonList>
                      <IonItem lines="full">
                        <b style={{ width: "30%" }}>Client ID</b>
                        <b style={{ width: "50%" }}>Client Name</b>
                        <b style={{ width: "20%" }}>Select</b>
                      </IonItem>
                      {[
                        { id: 58, name: "DS. GOVT DEGREE COLLEGE FOR WOMENS" },
                        { id: 57, name: "A.M. REDDY COLLEGE" },
                        { id: 56, name: "A.M. REDDY" },
                        { id: 55, name: "St. Joseph Dental college" },
                        {
                          id: 54,
                          name: "Vikas College Of Engineering & Technology",
                        },
                      ].map((client, index) => (
                        <IonItem key={index} lines="full">
                          <div style={{ width: "30%" }}>{client.id}</div>
                          <div style={{ width: "50%" }}>{client.name}</div>
                          <div style={{ width: "20%" }}>
                            <IonCheckbox />
                          </div>
                        </IonItem>
                      ))}
                    </IonList>
                  </IonCol>

                  {/* Projects List */}
                  <IonCol size="12" size-md="6">
                    <h2>Projects</h2>
                    <IonList>
                      <IonItem lines="full">
                        <b style={{ width: "30%" }}>Project ID</b>
                        <b style={{ width: "50%" }}>Project Name</b>
                        <b style={{ width: "20%" }}>Select</b>
                      </IonItem>
                      {[
                        { id: 9, name: "AU PG" },
                        { id: 8, name: "AU UG" },
                        { id: 7, name: "STUDENT PORTAL" },
                        { id: 6, name: "OFFICE UG (WINDOWS)" },
                        { id: 5, name: "LIBRARY (WINDOWS)" },
                        { id: 47, name: "I CAMPUS" },
                        { id: 46, name: "AKU PG" },
                        { id: 45, name: "AKU UG" },
                        { id: 4, name: "ICAMPUS UG (WINDOWS)" },
                      ].map((project, index) => (
                        <IonItem key={index} lines="full">
                          <div style={{ width: "30%" }}>{project.id}</div>
                          <div style={{ width: "50%" }}>{project.name}</div>
                          <div style={{ width: "20%" }}>
                            <IonCheckbox />
                          </div>
                        </IonItem>
                      ))}
                    </IonList>
                  </IonCol>
                </IonRow>
              </IonGrid>
            </IonCardContent>
          </IonCard>
        )}

        {/* TAB 3: CLIENT DETAILS */}
        {tab === "details" && (
          <IonCard className='card-box-main'>
            <IonCardHeader>
              <h2>Client Details</h2>
            </IonCardHeader>
            <IonGrid>
              <IonRow>
                <IonCol size="12" size-md="6">
                  <IonLabel>Client Name</IonLabel>
                  <IonItem button>
                    <IonInput placeholder="Client Name" />
                  </IonItem>
                </IonCol>
                <IonCol size="12" size-md="6">
                  <IonLabel>Project Name</IonLabel>
                  <IonItem button>
                    <IonInput placeholder="Project Name" />
                  </IonItem>
                </IonCol>
              </IonRow>
              <IonCardHeader>
                <h2>Project User Details</h2>
              </IonCardHeader>
              {[1, 2, 3, 4].map((user) => (
                <IonRow key={user}>
                  <IonCol size="12" size-md="3">
                    <IonLabel>User {user} Name</IonLabel>
                    <IonItem button>
                      <IonInput placeholder="Name" />
                    </IonItem>
                  </IonCol>
                  <IonCol size="12" size-md="3">
                    <IonLabel>Designation</IonLabel>
                    <IonItem button>
                      <IonInput placeholder="Designation" />
                    </IonItem>
                  </IonCol>
                  <IonCol size="12" size-md="3">
                    <IonLabel>Mobile</IonLabel>
                    <IonItem button>
                      <IonInput placeholder="Mobile No" />
                    </IonItem>
                  </IonCol>
                  <IonCol size="12" size-md="3">
                    <IonLabel>Email</IonLabel>
                    <IonItem button>
                      <IonInput placeholder="Email" />
                    </IonItem>
                  </IonCol>
                </IonRow>
              ))}
              <IonRow>
                <IonCol size="6" className="main-box-center">
                  <IonButton
                    expand="block"
                    className="login-btn2"
                    style={{ "--box-shadow": "none" }}
                    color={"#f57c00"}
                  >
                    Save
                  </IonButton>
                </IonCol>
                <IonCol size="6" className="main-box-center">
                  <IonButton
                    expand="block"
                    className="login-btn2"
                    style={{ "--box-shadow": "none" }}
                    color={"#f57c00"}
                  >
                    Clear
                  </IonButton>
                </IonCol>
              </IonRow>
            </IonGrid>
          </IonCard>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ClientDetails;
