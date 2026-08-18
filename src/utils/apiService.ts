import { API_BASE } from "../config";

const BASE_URL = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;

const getHeaders = (isGet = false) => {
    const token = localStorage.getItem("token");
    const headers: any = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    if (!isGet) {
        // multipart/form-data should NOT have Content-Type set manually
        // But for standard POSTs we need application/json
        headers["Content-Type"] = "application/json";
    }
    return headers;
};

const getFormHeaders = () => {
    const token = localStorage.getItem("token");
    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/x-www-form-urlencoded",
    };
};

export const apiService = {
    get: async (endpoint: string) => {
        console.log(`GET Request: ${BASE_URL}${endpoint}`);
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: "GET",
            headers: getHeaders(true),
        });
        console.log(`GET Response Status (${endpoint}):`, response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`GET Error Response (${endpoint}):`, errorText);
            throw new Error(errorText || `API Error: ${response.statusText}`);
        }
        return response.json();
    },

    post: async (endpoint: string, data: any) => {
        console.log(`POST Request: ${BASE_URL}${endpoint}`, data);
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        console.log(`POST Response Status (${endpoint}):`, response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`POST Error Response (${endpoint}):`, errorText);
            throw new Error(errorText || `API Error: ${response.statusText}`);
        }
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            return text; // Fallback to plain text
        }
    },

    // Specific methods for Tasks
    loadEmployeesForTickets: async (searchEmp: string) => {
        // Correcting spelling and parameter name based on project patterns
        return apiService.get(`/Employee/Load_Employees_SupportTickets?SearchEmp=${searchEmp}`);
    },

    saveTask: async (taskData: any) => {
        console.log("API 2: Save Task", taskData);
        return apiService.post("/Tickets/Save_Task", taskData);
    },

    sendTaskPushNotification: async (payload: any) => {
        console.log("API: Send Task Push Notification", payload);
        return apiService.post("/Notifications/Send", payload);
    },

    markTaskAsRead: async (tid: string, empCode: string) => {
        console.log("API: Mark Task As Read", { tid, empCode });
        return apiService.post("/Notifications/MarkTaskAsRead", { TID: Number(tid), EmpCode: empCode });
    },

    loadSentTasks: async (empCode: string) => {
        console.log("API 3: Load Sent Tasks", empCode);
        return apiService.get(`/Tickets/Load_Sent_Task?SenECode=${empCode}`);
    },

    loadReceivedTasks: async (empCode: string) => {
        console.log("API 4: Load Received Tasks", empCode);
        return apiService.get(`/Tickets/Load_Received_Task?RecECode=${empCode}`);
    },

    deleteTask: async (tskId: string) => {
        console.log("API 5: Delete Task", tskId);
        return apiService.post("/Tickets/Delete_Task", { _Tskid: tskId });
    },

    loadViewTask: async (tid: string) => {
        console.log("API 6: Load Task Progress (View Task)", tid);
        return apiService.get(`/Tickets/Load_View_Task?TID=${tid}`);
    },

    loadAllTasks: async (tid: string) => {
        console.log("API 7: Load All Task History", tid);
        return apiService.get(`/Tickets/Load_All_Task?TID=${tid}`);
    },

    // saveTaskStatus: async (statusData: any) => {
    //     console.log("API 8: Save Task Status", statusData);
    //     return apiService.post("/Tickets/Save_Task_status", statusData);
    // },
     saveTaskStatus: async (statusData: any) => {
        console.log("API 8: Save Task Status", statusData);
        return apiService.post("/Tickets/Save_Task_Status", statusData);
    },

    transferTask: async (transferData: any) => {
        console.log("API 9: Transfer Task", transferData);
        return apiService.post("/Tickets/Transfer_Task", transferData);
    },

    loadTaskMaster: async () => {
        console.log("API 10: Load Task Master");
        return apiService.get("/Tickets/Load_Task_Master");
    },

    loadSentTaskTotal: async () => {
        console.log("API 11: Load All Sent Tasks (Total)");
        return apiService.get("/Tickets/Load_Sent_Task_Total");
    },

    reopenTask: async (reopenData: any) => {
        console.log("API 12: Reopen Task", reopenData);
        return apiService.post("/Tickets/Task_ReOpen", reopenData);
    },

    sendMessage: async (mobile: string, message: string) => {
        if (!mobile || mobile.trim() === "") {
            console.warn("⚠️ [WhatsApp] Skipped: No mobile number provided.");
            return null;
        }
        const phone = mobile.trim();
        console.log("API 13: Send WhatsApp", { phone, message });
        return apiService.post("/Tickets/SendWhatsApp", { Phone: phone, Message: message });
    },

    sendWhatsAppTemplate: async (mobile: string, templateName: string, parameters: string[], language?: string) => {
        if (!mobile || mobile.trim() === "") {
            console.warn("⚠️ [WhatsApp] Skipped template: No mobile number provided.");
            return null;
        }
        const phone = mobile.trim();
        console.log("API: Send WhatsApp Template", { phone, templateName, parameters, language });
        return apiService.post("/Tickets/SendWhatsAppTemplate", {
            Phone: phone,
            TemplateName: templateName,
            Language: language,
            Parameters: parameters
        });
    },

    sendOnDutyRAApprovalNotification: async (
        dutyId: string | number,
        raMobile: string,
        raName: string,
        raEmpCode: string,
        details: {
            empNames: string;
            dateFrom: string;
            dateTo: string;
            location: string;
            onDutyType?: string;
            description?: string;
            vehicle?: string;
        }
    ) => {
        if (!raMobile || raMobile.trim() === "") {
            console.warn("⚠️ [WhatsApp Dispatch] Skipped RA notification: No RA mobile provided.");
            return null;
        }

        console.group("🚀 [WhatsApp API] Sending RA Approval Notification");
        console.log("📲 To RA Mobile:", raMobile);
        console.log("👤 RA Name:", raName, `(${raEmpCode})`);
        console.log("🆔 Duty ID:", dutyId);
        console.groupEnd();

        // 1. Try dedicated backend endpoint first (handles Meta Cloud API template + quick-reply buttons + logging)
        try {
            const onDutyRes = await apiService.post("/Leave/SendOnDutyWhatsApp", {
                DutyId: String(dutyId),
                RaMobile: raMobile,
                RaEmpCode: raEmpCode,
                RaName: raName || "Manager",
                EmpNames: details.empNames || "Employee",
                DateFrom: details.dateFrom,
                DateTo: details.dateTo,
                Location: details.location || "Field Duty",
                OnDutyType: details.onDutyType || "Field Duty",
                Description: details.description || "N/A"
            });
            console.log("✅ [Backend SendOnDutyWhatsApp] Delivered successfully:", onDutyRes);
            return onDutyRes;
        } catch (backendErr) {
            console.warn("⚠️ [Backend SendOnDutyWhatsApp] Fallback to direct SendWhatsAppTemplate:", backendErr);
        }

        // 2. Direct SendWhatsAppTemplate with en_US
        try {
            const templateRes = await apiService.post("/Tickets/SendWhatsAppTemplate", {
                Phone: raMobile,
                TemplateName: "onduty_approval_request",
                Language: "en_US",
                Parameters: [
                    raName || "Manager",
                    String(dutyId),
                    details.empNames || "Employee",
                    details.dateFrom,
                    details.dateTo,
                    details.location || "Field Duty",
                    details.onDutyType || "Field Duty",
                    details.description || "N/A"
                ]
            });
            console.log("✅ [WhatsApp Template] Delivered template onduty_approval_request:", templateRes);
            return templateRes;
        } catch (e) {
            console.error("❌ [WhatsApp Template] Error sending onduty_approval_request:", e);
            return null;
        }
    },

    sendOnDutyEmployeeStatusNotification: async (
        dutyId: string | number,
        empMobile: string,
        empName: string,
        action: "Approved" | "Rejected",
        raName: string,
        details: {
            dateFrom: string;
            dateTo: string;
            location: string;
        }
    ) => {
        if (!empMobile || empMobile.trim() === "") return null;
        const dates = `${details.dateFrom} to ${details.dateTo}`;

        try {
            const statusRes = await apiService.post("/Tickets/SendWhatsAppTemplate", {
                Phone: empMobile,
                TemplateName: "onduty_status_notify",
                Language: "en_US",
                Parameters: [
                    empName || "Employee",
                    String(dutyId),
                    action.toUpperCase(),
                    raName || "Manager",
                    dates,
                    details.location || "Field Duty"
                ]
            });
            console.log("✅ [WhatsApp Status Notification] Delivered onduty_status_notify:", statusRes);
            return statusRes;
        } catch (e) {
            console.warn("⚠️ [WhatsApp Status Notification] Failed to send onduty_status_notify:", e);
            return null;
        }
    },

    resolveRAMobileAndName: async (raIdentifier: string): Promise<{ mobile: string; name: string; empCode: string } | null> => {
        if (!raIdentifier || !raIdentifier.trim() || raIdentifier === "-" || raIdentifier.includes("AB-")) {
            return null;
        }
        const cleanId = raIdentifier.trim();
        console.log(`🔍 [resolveRAMobileAndName] Resolving RA identifier: "${cleanId}"`);

        const parseRow = (e: any) => {
            if (!e) return { empCode: "", empName: "", designation: "", mobile: "" };
            let rowObj = e;
            if (typeof rowObj === "string") {
                try { rowObj = JSON.parse(rowObj); } catch { /* ignore */ }
            }
            if (Array.isArray(rowObj)) {
                const first = Array.isArray(rowObj[0]) ? rowObj[0] : rowObj;
                return {
                    empCode: String(first[1] ?? first[0] ?? "").trim(),
                    empName: String(first[2] ?? "").trim(),
                    designation: String(first[3] ?? "").trim(),
                    mobile: String(first[6] ?? first[5] ?? first[4] ?? "").trim(),
                };
            }
            return {
                empCode: String(rowObj.EmpCode || rowObj.empCode || rowObj._Ecode || "").trim(),
                empName: String(rowObj.EmpName || rowObj.empName || rowObj._Ename || "").trim(),
                designation: String(rowObj.Designation || rowObj.designation || rowObj._Desig || "").trim(),
                mobile: String(rowObj.Mobile || rowObj.mobile || rowObj._Mobile || rowObj.MobileNo || rowObj.mobileNo || "").trim(),
            };
        };

        // 1. If cleanId is numeric employee code (e.g. "1524")
        if (/^\d+$/.test(cleanId)) {
            try {
                const empRes = await apiService.getEmployee(cleanId);
                const parsed = parseRow(empRes);
                if (parsed.mobile && parsed.mobile.replace(/\D/g, "").length >= 10) {
                    console.log(`✅ [resolveRAMobileAndName] Found via Direct EmpCode: ${parsed.empName} (${cleanId}) -> ${parsed.mobile}`);
                    return { mobile: parsed.mobile, name: parsed.empName, empCode: cleanId };
                }
            } catch (e) {
                console.warn(`⚠️ [resolveRAMobileAndName] EmpCode query failed for ${cleanId}:`, e);
            }
        }

        // 2. Query all employees to match by Designation or Name or EmpCode (with punctuation/space normalization)
        try {
            const allEmps = await apiService.loadEmployees("");
            let list: any[] = [];
            if (typeof allEmps === "string") {
                try { list = JSON.parse(allEmps); } catch { list = []; }
            } else if (Array.isArray(allEmps)) {
                list = allEmps;
            }

            const normalize = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            const normClean = normalize(cleanId);

            // Pass 1: Exact normalized match (e.g. "Team. Manager" -> "teammanager" matches "Team Manager" -> "teammanager")
            for (const item of list) {
                const parsed = parseRow(item);
                if (!parsed.mobile || parsed.mobile.trim() === "") continue;

                const desigNorm = normalize(parsed.designation);
                const nameNorm = normalize(parsed.empName);
                const codeNorm = normalize(parsed.empCode);

                if (desigNorm === normClean || nameNorm === normClean || codeNorm === normClean) {
                    console.log(`✅ [resolveRAMobileAndName] Found via Normalized Match: ${parsed.empName} (${parsed.empCode}, Desig: "${parsed.designation}") -> ${parsed.mobile}`);
                    return { mobile: parsed.mobile, name: parsed.empName, empCode: parsed.empCode };
                }
            }

            // Pass 2: Substring / Fuzzy match (e.g. "manager" in "teammanager" or "networkadmin" in "networkadministrator")
            if (normClean.length >= 4) {
                for (const item of list) {
                    const parsed = parseRow(item);
                    if (!parsed.mobile || parsed.mobile.trim() === "") continue;

                    const desigNorm = normalize(parsed.designation);
                    if (desigNorm.includes(normClean) || normClean.includes(desigNorm)) {
                        console.log(`✅ [resolveRAMobileAndName] Found via Fuzzy Match: ${parsed.empName} (${parsed.empCode}, Desig: "${parsed.designation}") -> ${parsed.mobile}`);
                        return { mobile: parsed.mobile, name: parsed.empName, empCode: parsed.empCode };
                    }
                }
            }
        } catch (e) {
            console.warn(`⚠️ [resolveRAMobileAndName] Employee list search failed:`, e);
        }

        return null;
    },

    saveWorkReportTicketWise: async (reportData: any) => {
        console.log("API: Save Work Report Ticket Wise", reportData);
        return apiService.post("/Tickets/SaveWorkReport_TicketWise", reportData);
    },

    loadWorkReportClients: async (college: string = "") => {
        console.log("API: Load Work Report Clients", college);
        return apiService.get(`/Workreport/Load_Clients?College=${college}`);
    },

    saveWorkReport: async (reportData: any) => {
        console.log("API: Save Work Report", reportData);
        return apiService.post("/Workreport/saveworkReport", reportData);
    },


    // --- Employee Management APIs ---
    loadEmployees: async (status: string) => {
        console.log("API: Load Employees", status);
        return apiService.get(`/Employee/Load_Employees?SearchEmp=${status}`);
    },

    loadDepartments: async () => {
        console.log("API: Load Departments");
        return apiService.get("/Sources/Load_Department");
    },

    loadTlProjects: async () => {
        console.log("API: Load TlProjects");
        return apiService.get("/Sources/Load_TlProjects");
    },

    loadLocationType: async () => {
        console.log("API: Load LocationType");
        return apiService.get("/Sources/Load_LocationType");
    },

    loadBranch: async () => {
        console.log("API: Load Branch");
        return apiService.get("/Sources/Load_Branch");
    },

    loadBranchDept: async () => {
        console.log("API: Load BranchDept");
        return apiService.get("/Sources/Load_BranchDept");
    },

    loadDesignations: async () => {
        console.log("API: Load Designations");
        return apiService.get("/Sources/Load_Designation");
    },

    loadRAS: async () => {
        console.log("API: Load RAS");
        return apiService.get("/Sources/Load_GETRAS");
    },

    getEmployee: async (ecode: string) => {
        console.log("API: Get Employee Details", ecode);
        const res = await apiService.get(`/Employee/Get_Employee?_Ecode=${ecode}`);
        if (typeof res === "string") {
            try {
                return JSON.parse(res);
            } catch {
                return res;
            }
        }
        return res;
    },

    registerEmployee: async (data: any) => {
        console.log("API: Employee Registration", data);
        return apiService.post("/Employee/EmployeeRegistration", data);
    },

    saveReportingMatrix: async (data: any) => {
        console.log("API: Save Reporting Matrix", data);
        return apiService.post("/Employee/Save_ReportingMatrix", data);
    },

    loadReportingMatrix: async (empCode: string) => {
        console.log("API: Load Reporting Matrix", empCode);
        return apiService.get(`/Employee/LoadReportingMatrix?empCode=${empCode}`);
    },

    saveTaskTags: async (tid: number, empCodes: string[], taggedBy: string) => {
        console.log("API: Save Task Tags", { tid, empCodes, taggedBy });
        return apiService.post("/Tickets/Save_Task_Tags", { TID: tid, EmpCodes: empCodes, TaggedBy: taggedBy });
    },

    getTaskTags: async (tid: number) => {
        console.log("API: Get Task Tags", tid);
        return apiService.get(`/Tickets/Get_Task_Tags?TID=${tid}`);
    },
};
