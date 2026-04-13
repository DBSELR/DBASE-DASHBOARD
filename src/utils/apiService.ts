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

    saveTaskStatus: async (statusData: any) => {
        console.log("API 8: Save Task Status", statusData);
        return apiService.post("/Tickets/Save_Task_status", statusData);
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
        const phone = mobile || "9640143677"; // Default number from Transactions.tsx if empty
        console.log("API 13: Send SMS", { phone, message });
        return apiService.get(`/Sources/sendMessage?phoneNo=${phone}&message=${encodeURIComponent(message)}`);
    },

    saveWorkReportTicketWise: async (reportData: any) => {
        console.log("API: Save Work Report Ticket Wise", reportData);
        return apiService.post("/Tickets/SaveWorkReport_TicketWise", reportData);
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

    loadDesignations: async () => {
        console.log("API: Load Designations");
        return apiService.get("/Sources/Load_Designation");
    },

    getEmployee: async (ecode: string) => {
        console.log("API: Get Employee Details", ecode);
        return apiService.get(`/Employee/Get_Employee?_Ecode=${ecode}`);
    },

    registerEmployee: async (data: any) => {
        console.log("API: Employee Registration", data);
        return apiService.post("/Employee/EmployeeRegistration", data);
    },

    saveReportingMatrix: async (data: any) => {
        console.log("API: Save Reporting Matrix", data);
        return apiService.post("/Employee/Save_ReportingMatrix", data);
    },
};
