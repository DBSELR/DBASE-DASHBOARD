import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonMenuButton,
} from "@ionic/react";

const Header: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="end">
            <IonMenuButton menu="main-menu" />
          </IonButtons>
          <IonToolbar color="Tertiary" className="menu-toolbar">
            <img
              src="./images/dbase.png"
              alt="DBase Logo"
              className="menu-logo"
            />
          </IonToolbar>
        </IonToolbar>
      </IonHeader>
    </IonPage>
  );
};

export default Header;
