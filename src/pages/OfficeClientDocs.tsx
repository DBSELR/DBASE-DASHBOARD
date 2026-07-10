// src/pages/OfficeClientDocs.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  IonPage,
  IonContent,
  IonSelect,
  IonSelectOption,
  IonToast,
  IonButton,
  IonLoading,
  IonModal,
} from "@ionic/react";
import axios from "axios";
import {
  FileText,
  History,
  PlusCircle,
  UploadCloud,
  Folder,
  Trash2,
  Download,
  Calendar,
  User,
  Layers,
  RefreshCcw,
  Search,
  X,
  Check,
  ChevronDown,
} from "lucide-react";
import moment from "moment";
import { API_BASE } from "../config";
import "./OfficeClientDocs.css";

type Project = { P_ID: string; Project: string };
type Client = { id: number; name: string };
type OfficeDoc = {
  DocID: number;
  TabType: string;
  Version: string;
  ProjectName?: string | null;
  ClientName?: string | null;
  FileName: string;
  FilePath: string;
  UploadedBy: string;
  UploadDate: string;
};

const OfficeClientDocs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"project" | "client">("project");
  
  // Form States - Tab 1 (Project)
  const [projectVersion, setProjectVersion] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [projectFile, setProjectFile] = useState<File | null>(null);

  // Form States - Tab 2 (Client)
  const [clientName, setClientName] = useState("");
  const [clientVersion, setClientVersion] = useState("");
  const [clientFile, setClientFile] = useState<File | null>(null);

  // Lookup Master Data
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [clientsList, setClientsList] = useState<Client[]>([]);

  // History / Dashboard
  const [documents, setDocuments] = useState<OfficeDoc[]>([]);
  
  // Loading & Toast States
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "danger" | "warning">("success");

  // Logged-in User
  const [user, setUser] = useState<any>(null);

  // File Input Refs
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const clientFileInputRef = useRef<HTMLInputElement>(null);

  // Preview Modal States
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<OfficeDoc | null>(null);

  const handlePreview = (doc: OfficeDoc) => {
    setPreviewDoc(doc);
    setShowPreviewModal(true);
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      setLoading(true);
      const res = await axios({
        url: filePath,
        method: "GET",
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download error:", e);
      triggerToast("Failed to download file.", "danger");
    } finally {
      setLoading(false);
    }
  };

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token")?.replace(/"/g, "");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const triggerToast = (msg: string, type: "success" | "danger" | "warning" = "success") => {
    setToastMsg(msg);
    setToastType(type);
    setShowToast(true);
  };

  // Custom Dropdown States
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [projectDropdownPos, setProjectDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [clientDropdownPos, setClientDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [projectSearchTerm, setProjectSearchTerm] = useState("");
  const [clientSearchTerm, setClientSearchTerm] = useState("");

  const projectTriggerRef = useRef<HTMLDivElement>(null);
  const clientTriggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isProjectDropdownOpen && projectTriggerRef.current) {
      const rect = projectTriggerRef.current.getBoundingClientRect();
      setProjectDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isProjectDropdownOpen]);

  useEffect(() => {
    if (isClientDropdownOpen && clientTriggerRef.current) {
      const rect = clientTriggerRef.current.getBoundingClientRect();
      setClientDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isClientDropdownOpen]);

  // Filtering for Searchable Dropdowns
  const filteredProjects = projectsList.filter((p) => {
    const term = projectSearchTerm.toLowerCase();
    const name = (p.Project || "").toLowerCase();
    const id = String(p.P_ID || "").toLowerCase();
    return name.includes(term) || id.includes(term);
  });

  const filteredClients = clientsList.filter((c) => {
    const term = clientSearchTerm.toLowerCase();
    const name = (c.name || "").toLowerCase();
    const id = String(c.id || "").toLowerCase();
    return name.includes(term) || id.includes(term);
  });

  // Load Initial Metadata & User
  useEffect(() => {
    // 1. Get logged-in user
    const stored = localStorage.getItem("user") || localStorage.getItem("storedUser");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse user session", e);
      }
    }

    // 2. Fetch Projects (Reference from /clientdetails)
    const loadProjects = async () => {
      try {
        const res = await axios.get(`${API_BASE}Sources/Load_ProjectMaster`, {
          headers: getAuthHeaders(),
        });
        if (Array.isArray(res.data)) {
          setProjectsList(
            res.data.map((p: any) => ({
              P_ID: String(p[0]),
              Project: p[1] || "",
            }))
          );
        }
      } catch (e) {
        console.error("Error loading project master list:", e);
      }
    };

    // 3. Fetch Clients (Reference from /workreport)
    const loadClients = async () => {
      try {
        const res = await axios.get(`${API_BASE}Workreport/Load_Clients?College`, {
          headers: getAuthHeaders(),
        });
        if (Array.isArray(res.data)) {
          setClientsList(
            res.data.map(([id, name]: [number, string]) => ({
              id,
              name: name || `Client ${id}`,
            }))
          );
        }
      } catch (e) {
        console.error("Error loading client list:", e);
      }
    };

    loadProjects();
    loadClients();
  }, [getAuthHeaders]);

  // Fetch Uploaded Documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}OfficeClientDocs/GetDocs`, {
        headers: getAuthHeaders(),
      });
      if (Array.isArray(res.data)) {
        setDocuments(res.data);
      }
    } catch (e: any) {
      console.error("Error fetching documents:", e);
      triggerToast("Failed to fetch documents history.", "danger");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  // Load documents when user is available
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Clear Form Fields
  const handleClear = () => {
    if (activeTab === "project") {
      setProjectVersion("");
      setSelectedProject("");
      setProjectFile(null);
      if (projectFileInputRef.current) projectFileInputRef.current.value = "";
    } else {
      setClientName("");
      setClientVersion("");
      setClientFile(null);
      if (clientFileInputRef.current) clientFileInputRef.current.value = "";
    }
  };

  // Submit/Save Document Upload
  const handleSave = async () => {
    // 1. Validation
    if (activeTab === "project") {
      if (!projectVersion.trim()) return triggerToast("Please enter a version.", "warning");
      if (!selectedProject) return triggerToast("Please select a project.", "warning");
      if (!projectFile) return triggerToast("Please select a file to upload.", "warning");
    } else {
      if (!clientName) return triggerToast("Please select a client.", "warning");
      if (!clientFile) return triggerToast("Please select a file to upload.", "warning");
      if (!clientVersion.trim()) return triggerToast("Please enter a version.", "warning");
    }

    if (!user) {
      return triggerToast("Session expired. Please log in again.", "danger");
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("TabType", activeTab === "project" ? "Project" : "Client");
      formData.append("UploadedBy", String(user.empCode || user.EmpCode || ""));

      if (activeTab === "project") {
        formData.append("Version", projectVersion.trim());
        formData.append("ProjectName", selectedProject);
        formData.append("file", projectFile!);
      } else {
        formData.append("ClientName", clientName);
        formData.append("Version", clientVersion.trim());
        formData.append("file", clientFile!);
      }

      const res = await axios.post(`${API_BASE}OfficeClientDocs/SaveDoc`, formData, {
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.status === 200 || res.status === 201) {
        triggerToast("Document saved and versioned successfully!", "success");
        handleClear();
        fetchDocuments();
      } else {
        throw new Error("Invalid response status");
      }
    } catch (e: any) {
      console.error("Save error:", e);
      const errMsg = e.response?.data || e.message || "Failed to upload document.";
      triggerToast(errMsg, "danger");
    } finally {
      setLoading(false);
    }
  };

  // Delete Document
  const handleDelete = async (docId: number) => {
    setLoading(true);
    try {
      const res = await axios.delete(`${API_BASE}OfficeClientDocs/DeleteDoc`, {
        params: { docId },
        headers: getAuthHeaders(),
      });
      if (res.status === 200) {
        triggerToast("Document deleted successfully.", "success");
        fetchDocuments();
      }
    } catch (e: any) {
      console.error("Delete error:", e);
      triggerToast("Failed to delete document.", "danger");
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent className="ion-padding" style={{ "--background": "var(--ion-background-color)" }}>
        <div className="oc-container">
          
          {/* Header Banner */}
          <div className="oc-integrated-header">
            <div className="oc-page-title">Office Doc Upload with Versioning</div>
            <FileText size={28} />
          </div>

          {/* Tab Segments */}
          <div className="oc-segment-container">
            <div
              className={`oc-segment-btn ${activeTab === "project" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("project");
                handleClear();
              }}
            >
              <PlusCircle size={18} />
              <span>Project Docs (Tab 1)</span>
            </div>
            <div
              className={`oc-segment-btn ${activeTab === "client" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("client");
                handleClear();
              }}
            >
              <PlusCircle size={18} />
              <span>Client Docs (Tab 2)</span>
            </div>
          </div>

          <div className="oc-main-grid">
            
            {/* Form Card */}
            <div className="oc-card">
              <div className="oc-section-title">
                <UploadCloud size={20} />
                {activeTab === "project" ? "Upload Project Document" : "Upload Client Document"}
              </div>

              <div className="oc-form-grid">
                
                {/* Conditional fields based on selected tab */}
                {activeTab === "project" ? (
                  <>
                    {/* Tab 1 Field 1: Version */}
                    <div className="oc-input-group">
                      <label className="oc-label">Version</label>
                      <div className="oc-input-wrapper">
                        <Layers size={18} className="oc-input-icon" />
                        <input
                          type="text"
                          className="oc-input-custom"
                          placeholder="e.g. v1.0.0"
                          value={projectVersion}
                          onChange={(e) => setProjectVersion(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Tab 1 Field 2: Project (Custom Dropdown) */}
                    <div className="ntv-form-group">
                      <label className="ntv-form-label">Project</label>
                      <div
                        className={`ntv-form-input-wrapper ${isProjectDropdownOpen ? 'active' : ''}`}
                        ref={projectTriggerRef}
                        onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                      >
                        <Folder size={18} className="ntv-form-input-icon" />
                        <span className="ntv-form-text-display">
                          {selectedProject || "Choose Project"}
                        </span>
                        <ChevronDown size={16} style={{ marginLeft: 'auto', opacity: 0.7 }} />

                        {isProjectDropdownOpen && createPortal(
                          <>
                            <div
                              className="dropdown-outside-click-layer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsProjectDropdownOpen(false);
                              }}
                            />
                            <div
                              className="custom-inline-dropdown"
                              onMouseDown={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                top: `${projectDropdownPos.top}px`,
                                left: `${projectDropdownPos.left}px`,
                                width: `${projectDropdownPos.width}px`
                              }}
                            >
                              <div className="dropdown-search-sec">
                                <Search size={16} className="dropdown-search-icon" />
                                <input
                                  type="text"
                                  className="dropdown-pure-input"
                                  placeholder="Search project name..."
                                  value={projectSearchTerm}
                                  onChange={(e) => setProjectSearchTerm(e.target.value)}
                                  autoFocus
                                  onMouseDown={(e) => e.stopPropagation()}
                                />
                                {projectSearchTerm && (
                                  <button
                                    className="dropdown-clear-btn"
                                    onClick={() => setProjectSearchTerm("")}
                                  >
                                    <X size={16} />
                                  </button>
                                )}
                              </div>

                              <div className="dropdown-body">
                                {filteredProjects.length > 0 ? (
                                  filteredProjects.map((p, index) => {
                                    const isSelected = selectedProject === p.Project;
                                    const initials = (p.Project.charAt(0) || "?").toUpperCase();
                                    return (
                                      <div
                                        key={index}
                                        className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setSelectedProject(p.Project);
                                          setIsProjectDropdownOpen(false);
                                          setProjectSearchTerm("");
                                        }}
                                      >
                                        <div className={`dr-avatar grad-${(parseInt(p.P_ID) % 5) || 0}`}>
                                          {initials}
                                        </div>
                                        <div className="dr-info">
                                          <span className="dr-name">{p.Project}</span>
                                          <span className="dr-id">ID: {p.P_ID}</span>
                                        </div>
                                        {isSelected && <Check size={18} className="dr-check" />}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="dr-no-results">No projects found</div>
                                )}
                              </div>
                            </div>
                          </>,
                          document.body
                        )}
                      </div>
                    </div>

                    {/* Tab 1 Field 3: Upload Bill (File Upload) */}
                    <div className="oc-input-group oc-grid-full-width">
                      <label className="oc-label">Upload Bill (Document)</label>
                      <div className={`oc-file-upload-wrapper ${projectFile ? "has-file" : ""}`}>
                        <input
                          type="file"
                          ref={projectFileInputRef}
                          className="oc-file-input"
                          onChange={(e) => setProjectFile(e.target.files?.[0] || null)}
                        />
                        <div className={`oc-file-upload-content ${projectFile ? "has-file" : ""}`}>
                          <UploadCloud size={32} className="oc-file-upload-icon" />
                          <span>
                            {projectFile
                              ? `Selected: ${projectFile.name} (${(projectFile.size / 1024).toFixed(1)} KB)`
                              : "Click or Drag to Upload Document"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Tab 2 Field 1: Client Name (Custom Dropdown) */}
                    <div className="ntv-form-group">
                      <label className="ntv-form-label">Client Name</label>
                      <div
                        className={`ntv-form-input-wrapper ${isClientDropdownOpen ? 'active' : ''}`}
                        ref={clientTriggerRef}
                        onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                      >
                        <User size={18} className="ntv-form-input-icon" />
                        <span className="ntv-form-text-display">
                          {clientName || "Choose Client"}
                        </span>
                        <ChevronDown size={16} style={{ marginLeft: 'auto', opacity: 0.7 }} />

                        {isClientDropdownOpen && createPortal(
                          <>
                            <div
                              className="dropdown-outside-click-layer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsClientDropdownOpen(false);
                              }}
                            />
                            <div
                              className="custom-inline-dropdown"
                              onMouseDown={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                top: `${clientDropdownPos.top}px`,
                                left: `${clientDropdownPos.left}px`,
                                width: `${clientDropdownPos.width}px`
                              }}
                            >
                              <div className="dropdown-search-sec">
                                <Search size={16} className="dropdown-search-icon" />
                                <input
                                  type="text"
                                  className="dropdown-pure-input"
                                  placeholder="Search client name..."
                                  value={clientSearchTerm}
                                  onChange={(e) => setClientSearchTerm(e.target.value)}
                                  autoFocus
                                  onMouseDown={(e) => e.stopPropagation()}
                                />
                                {clientSearchTerm && (
                                  <button
                                    className="dropdown-clear-btn"
                                    onClick={() => setClientSearchTerm("")}
                                  >
                                    <X size={16} />
                                  </button>
                                )}
                              </div>

                              <div className="dropdown-body">
                                {filteredClients.length > 0 ? (
                                  filteredClients.map((c, index) => {
                                    const isSelected = clientName === c.name;
                                    const initials = (c.name.charAt(0) || "?").toUpperCase();
                                    return (
                                      <div
                                        key={index}
                                        className={`dropdown-emp-item ${isSelected ? 'selected' : ''}`}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setClientName(c.name);
                                          setIsClientDropdownOpen(false);
                                          setClientSearchTerm("");
                                        }}
                                      >
                                        <div className={`dr-avatar grad-${(c.id % 5) || 0}`}>
                                          {initials}
                                        </div>
                                        <div className="dr-info">
                                          <span className="dr-name">{c.name}</span>
                                          <span className="dr-id">ID: {c.id}</span>
                                        </div>
                                        {isSelected && <Check size={18} className="dr-check" />}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="dr-no-results">No clients found</div>
                                )}
                              </div>
                            </div>
                          </>,
                          document.body
                        )}
                      </div>
                    </div>

                    {/* Tab 2 Field 2: Version */}
                    <div className="oc-input-group">
                      <label className="oc-label">Version</label>
                      <div className="oc-input-wrapper">
                        <Layers size={18} className="oc-input-icon" />
                        <input
                          type="text"
                          className="oc-input-custom"
                          placeholder="e.g. v1.0.0"
                          value={clientVersion}
                          onChange={(e) => setClientVersion(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Tab 2 Field 3: Bill Upload (File Upload) */}
                    <div className="oc-input-group oc-grid-full-width">
                      <label className="oc-label">Bill Upload (Document)</label>
                      <div className={`oc-file-upload-wrapper ${clientFile ? "has-file" : ""}`}>
                        <input
                          type="file"
                          ref={clientFileInputRef}
                          className="oc-file-input"
                          onChange={(e) => setClientFile(e.target.files?.[0] || null)}
                        />
                        <div className={`oc-file-upload-content ${clientFile ? "has-file" : ""}`}>
                          <UploadCloud size={32} className="oc-file-upload-icon" />
                          <span>
                            {clientFile
                              ? `Selected: ${clientFile.name} (${(clientFile.size / 1024).toFixed(1)} KB)`
                              : "Click or Drag to Upload Document"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Form Action Buttons */}
              <div className="oc-actions">
                <IonButton className="oc-btn-save" onClick={handleSave}>
                  SAVE
                </IonButton>
                <IonButton className="oc-btn-clear" onClick={handleClear}>
                  CLEAR
                </IonButton>
              </div>
            </div>

            {/* Uploaded History Dashboard */}
            <div className="oc-history-section">
              <div className="oc-history-header">
                <div className="oc-history-title">
                  <History size={22} />
                  <span>Document Dashboard & Version History</span>
                </div>
                <IonButton
                  fill="outline"
                  className="oc-refresh-btn"
                  onClick={fetchDocuments}
                >
                  <RefreshCcw size={16} style={{ marginRight: "6px" }} />
                  Refresh
                </IonButton>
              </div>

              {documents.length > 0 ? (
                <div className="oc-docs-grid">
                  {documents.map((doc) => (
                    <div key={doc.DocID} className="oc-doc-card">
                      <div className="oc-doc-header">
                        <div className="oc-doc-meta">
                          <span className={`oc-doc-type-badge ${doc.TabType.toLowerCase()}`}>
                            {doc.TabType}
                          </span>
                          <span className="oc-doc-title">
                            {doc.TabType === "Project" ? doc.ProjectName : doc.ClientName}
                          </span>
                        </div>
                        <span className="oc-doc-version">
                          <Layers size={14} />
                          {doc.Version}
                        </span>
                      </div>

                      <div className="oc-doc-body">
                        <div className="oc-doc-file-info" title={doc.FileName} onClick={() => handlePreview(doc)}>
                          <FileText size={16} className="oc-doc-file-icon" />
                          <span>{doc.FileName}</span>
                        </div>
                        
                        <div className="oc-doc-date">
                          <Calendar size={14} />
                          <span>{moment(doc.UploadDate).format("DD MMM YYYY, h:mm a")}</span>
                        </div>

                        <div className="oc-doc-date">
                          <User size={14} />
                          <span>Uploaded by: {doc.UploadedBy}</span>
                        </div>
                      </div>

                      <div className="oc-doc-actions">
                        <IonButton
                          style={{
                            "--background": "#f5f3ff",
                            "--color": "#7c3aed",
                            "--border-radius": "8px",
                            "margin": "0",
                            "height": "36px",
                            "fontWeight": "600",
                            "fontSize": "13px",
                            "marginRight": "8px"
                          }}
                          onClick={() => handlePreview(doc)}
                        >
                          <FileText size={14} style={{ marginRight: "4px" }} />
                          View
                        </IonButton>
                        <IonButton
                          className="oc-action-btn-download"
                          onClick={() => handleDownload(doc.FilePath, doc.FileName)}
                        >
                          <Download size={14} style={{ marginRight: "4px" }} />
                          Download
                        </IonButton>
                        <IonButton
                          className="oc-action-btn-delete"
                          onClick={() => handleDelete(doc.DocID)}
                        >
                          <Trash2 size={14} style={{ marginRight: "4px" }} />
                          Delete
                        </IonButton>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="oc-empty-state">
                  <FileText size={48} />
                  <div className="oc-empty-title">No documents uploaded yet</div>
                  <p style={{ margin: 0, fontSize: "14px" }}>
                    Select a tab above to upload and version-control your first office document.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>

        <IonToast
          isOpen={showToast}
          message={toastMsg}
          color={toastType === "success" ? "success" : toastType === "danger" ? "danger" : "warning"}
          duration={3000}
          onDidDismiss={() => setShowToast(false)}
        />

        <IonLoading isOpen={loading} message="Processing..." />

        {/* Document Preview Modal */}
        <IonModal
          isOpen={showPreviewModal}
          onDidDismiss={() => {
            setShowPreviewModal(false);
            setPreviewDoc(null);
          }}
          className="oc-preview-modal"
        >
          {previewDoc && (
            <div className="oc-preview-container">
              <div className="oc-preview-header">
                <div className="oc-preview-title-meta">
                  <span className="oc-preview-title">
                    {previewDoc.TabType === "Project" ? previewDoc.ProjectName : previewDoc.ClientName}
                  </span>
                  <span className="oc-preview-subtitle">
                    Version {previewDoc.Version} | {previewDoc.FileName}
                  </span>
                </div>
                <IonButton
                  fill="clear"
                  className="oc-preview-close-btn"
                  onClick={() => {
                    setShowPreviewModal(false);
                    setPreviewDoc(null);
                  }}
                >
                  Close
                </IonButton>
              </div>

              <div className="oc-preview-content">
                {(() => {
                  const ext = (previewDoc.FileName || "").split('.').pop()?.toLowerCase();
                  const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext || "");
                  const isPdf = ext === "pdf";

                  if (isImage) {
                    return (
                      <img
                        src={previewDoc.FilePath}
                        alt={previewDoc.FileName}
                        className="oc-preview-image"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          triggerToast("Failed to load preview image.", "danger");
                        }}
                      />
                    );
                  } else if (isPdf) {
                    return (
                      <iframe
                        src={previewDoc.FilePath}
                        className="oc-preview-pdf"
                        title="PDF Preview"
                      />
                    );
                  } else {
                    return (
                      <div className="oc-preview-fallback">
                        <FileText size={48} />
                        <span className="oc-preview-fallback-text">
                          Preview is not supported for this file type ({ext}).
                        </span>
                        <IonButton
                          className="oc-preview-fallback-btn"
                          onClick={() => handleDownload(previewDoc.FilePath, previewDoc.FileName)}
                        >
                          <Download size={14} style={{ marginRight: "6px" }} />
                          Download File
                        </IonButton>
                      </div>
                    );
                  }
                })()}
              </div>
            </div>
          )}
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default OfficeClientDocs;
