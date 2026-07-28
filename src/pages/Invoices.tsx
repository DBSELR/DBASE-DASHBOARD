
import {
  IonPage,
  IonContent,
  IonIcon,
} from "@ionic/react";
import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { receiptOutline } from "ionicons/icons";

import "./WorkReports.css";
import "./Stock.css";

const Invoices: React.FC = () => {
  const history = useHistory();
  const [selectedTab, setSelectedTab] = useState("tracking");

  // Filters State
  const [employee, setEmployee] = useState("all");
  const [monthYear, setMonthYear] = useState("");

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
      <IonContent className="page-content">
        <div className="wr-container stock-container" style={{ padding: 0, minHeight: 'auto', backgroundColor: 'transparent' }}>
          
          {/* ── Premium Header ── */}
          <div className="page-wr-header" style={{ margin: '16px', borderRadius: '16px', padding: '16px' }}>
            <div className="page-wr-header-left">
              <button className="page-wr-back-btn" onClick={() => history.goBack()}>
                <ChevronLeft size={22} color="white" />
              </button>
              <div>
                <h1 className="page-wr-title">Invoices</h1>
                <p className="page-wr-subtitle">Track inward and outward entries</p>
              </div>
            </div>
            <div className="page-wr-header-right">
              <div className="page-wr-header-icon-box">
                <IonIcon icon={receiptOutline} style={{ color: 'var(--ion-color-primary)', fontSize: '24px' }} />
              </div>
            </div>
          </div>

          <div className="stock-panel" style={{ margin: '0 16px 20px 16px', padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
            
            {/* Tabs */}
            <div className="stock-tabs" style={{ marginBottom: '16px' }}>
              <button
                type="button"
                className={`stock-tab ${selectedTab === "tracking" ? "active" : ""}`}
                onClick={() => setSelectedTab("tracking")}
              >
                Tracking
              </button>
              <button
                type="button"
                className={`stock-tab ${selectedTab === "inward" ? "active" : ""}`}
                onClick={() => setSelectedTab("inward")}
              >
                Inward
              </button>
              <button
                type="button"
                className={`stock-tab ${selectedTab === "outward" ? "active" : ""}`}
                onClick={() => setSelectedTab("outward")}
              >
                Outward
              </button>
            </div>

            {/* Filters */}
            <div className="stock-panel" style={{ marginBottom: '16px' }}>
              <div className="stock-grid">
                <div className="stock-field">
                  <label>Employee</label>
                  <select
                    className="stock-select"
                    value={employee}
                    onChange={(e) => setEmployee(e.target.value)}
                  >
                    <option value="all">All Employees</option>
                    <option value="1">Harsha</option>
                    <option value="2">Ramesh</option>
                  </select>
                </div>
                <div className="stock-field">
                  <label>Month-Year</label>
                  <select
                    className="stock-select"
                    value={monthYear}
                    onChange={(e) => setMonthYear(e.target.value)}
                  >
                    <option value="">Select Month-Year</option>
                    <option value="apr-2025">Apr-2025</option>
                    <option value="mar-2025">Mar-2025</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Content Lists */}
            {selectedTab === "tracking" && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 className="stock-section-heading" style={{ marginLeft: '4px' }}>Tracking Invoices</h3>
                {invoiceData.map((invoice) => (
                  <div className="stock-panel" key={invoice.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--stock-border)', paddingBottom: '12px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--stock-text)', fontSize: '16px' }}>Invoice #{invoice.id}</span>
                      <span style={{ fontWeight: 800, color: 'var(--ion-color-primary)', fontSize: '18px' }}>₹{invoice.amount.toLocaleString()}</span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ color: 'var(--stock-muted)', minWidth: '90px' }}>Client:</span>
                        <span style={{ color: 'var(--stock-text)', fontWeight: 600 }}>{invoice.client}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ color: 'var(--stock-muted)', minWidth: '90px' }}>Description:</span>
                        <span style={{ color: 'var(--stock-text)', fontWeight: 500 }}>{invoice.description}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ color: 'var(--stock-muted)', minWidth: '90px' }}>Date:</span>
                        <span style={{ color: 'var(--stock-text)', fontWeight: 600 }}>{invoice.date}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedTab === "inward" && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 className="stock-section-heading" style={{ marginLeft: '4px' }}>Inward Entries</h3>
                <div className="stock-panel">
                  <h4 style={{ margin: '0 0 12px 0', color: 'var(--stock-text)' }}>Inward Placeholder</h4>
                  <p style={{ margin: 0, color: 'var(--stock-muted)' }}>Inward entry list and details go here.</p>
                </div>
              </div>
            )}

            {selectedTab === "outward" && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 className="stock-section-heading" style={{ marginLeft: '4px' }}>Outward Entries</h3>
                <div className="stock-panel">
                  <h4 style={{ margin: '0 0 12px 0', color: 'var(--stock-text)' }}>Outward Placeholder</h4>
                  <p style={{ margin: 0, color: 'var(--stock-muted)' }}>Outward entry list and details go here.</p>
                </div>
              </div>
            )}

          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Invoices;


