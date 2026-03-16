/**
 * MAIN APPLICATION - Mobile Number Lookup
 * Handles all UI interactions and API calls securely
 */

// ===== WAIT FOR SECURITY LAYER TO INITIALIZE =====
const AppInitializer = (() => {
  let appReady = false;
  let readyCallbacks = [];
  
  return {
    ready: function(callback) {
      if (appReady) {
        callback();
      } else {
        readyCallbacks.push(callback);
      }
    },
    
    setReady: function() {
      appReady = true;
      readyCallbacks.forEach(cb => {
        try {
          cb();
        } catch (e) {
          console.error("Callback execution failed:", e.message);
        }
      });
    }
  };
})();

// ===== CORE APPLICATION STATE =====
const AppState = {
  reportText: "",
  searchedNumber: "",
  isLoading: false,
  lastSearchTime: 0
};

// ===== DOM ELEMENT CACHE =====
const DOM = {
  form: null,
  mobileInput: null,
  messageBox: null,
  loadingBox: null,
  resultsWrap: null,
  recordsGrid: null,
  copyBtn: null,
  downloadBtn: null,
  statusDot: null,
  statusText: null,
  
  init: function() {
    this.form = document.getElementById("lookupForm");
    this.mobileInput = document.getElementById("mobileInput");
    this.messageBox = document.getElementById("messageBox");
    this.loadingBox = document.getElementById("loadingBox");
    this.resultsWrap = document.getElementById("resultsWrap");
    this.recordsGrid = document.getElementById("recordsGrid");
    this.copyBtn = document.getElementById("copyBtn");
    this.downloadBtn = document.getElementById("downloadBtn");
    this.statusDot = document.getElementById("statusDot");
    this.statusText = document.getElementById("statusText");
    
    return this.validate();
  },
  
  validate: function() {
    const required = [
      this.form, this.mobileInput, this.messageBox, this.loadingBox,
      this.resultsWrap, this.recordsGrid, this.copyBtn, this.downloadBtn,
      this.statusDot, this.statusText
    ];
    return required.every(el => el !== null);
  }
};

// ===== UTILITY FUNCTIONS =====
const Utils = {
  // HTML sanitization
  escapeHtml: function(unsafe) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return String(unsafe).replace(/[&<>"']/g, char => map[char]);
  },
  
  // Mobile number validation
  isValidMobile: function(value) {
    return /^\d{10}$/.test(value);
  },
  
  // Safe string conversion
  toString: function(value) {
    if (value === null || value === undefined) return "N/A";
    return String(value).trim() || "N/A";
  },
  
  // Array to string conversion
  arrayToString: function(arr) {
    if (!Array.isArray(arr)) return Utils.toString(arr);
    const items = arr
      .map(item => String(item).trim())
      .filter(Boolean);
    return items.length > 0 ? items.join(", ") : "N/A";
  },
  
  // Debounce function
  debounce: function(fn, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  }
};

// ===== STATUS MANAGEMENT =====
const StatusManager = {
  setStatus: function(label, mode) {
    if (!DOM.statusText || !DOM.statusDot) return;
    DOM.statusText.textContent = `API Status: ${label}`;
    DOM.statusDot.className = `status-dot status-${mode}`;
  },
  
  showMessage: function(text, type) {
    if (!DOM.messageBox) return;
    DOM.messageBox.textContent = text;
    DOM.messageBox.className = `message ${type}`;
  },
  
  clearMessage: function() {
    if (!DOM.messageBox) return;
    DOM.messageBox.className = "message hidden";
    DOM.messageBox.textContent = "";
  },
  
  setLoading: function(isLoading) {
    if (!DOM.loadingBox) return;
    DOM.loadingBox.classList.toggle("hidden", !isLoading);
    AppState.isLoading = isLoading;
  }
};

// ===== DATA PROCESSING =====
const DataProcessor = {
  parseJson: function(value) {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    
    const isJson = (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
                   (trimmed.startsWith("{") && trimmed.endsWith("}"));
    
    if (!isJson) return value;
    
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  },
  
  hasRecordFields: function(obj) {
    if (!obj || typeof obj !== "object") return false;
    const keys = Object.keys(obj).map(k => k.toLowerCase());
    const requiredFields = ["name", "fname", "father_name", "mobile", "address", "circle", "id", "aadhaar"];
    return requiredFields.some(field => keys.includes(field));
  },
  
  extractRecords: function(payload) {
    const records = [];
    const seen = new Set();
    const preferredKeys = ["data", "records", "result", "results", "response", "items"];
    
    const traverse = (node) => {
      const parsed = this.parseJson(node);
      if (!parsed) return;
      
      if (Array.isArray(parsed)) {
        parsed.forEach(traverse);
        return;
      }
      
      if (typeof parsed !== "object") return;
      if (seen.has(parsed)) return;
      seen.add(parsed);
      
      if (this.hasRecordFields(parsed)) {
        records.push(parsed);
        return;
      }
      
      for (const key of preferredKeys) {
        if (key in parsed) {
          traverse(parsed[key]);
        }
      }
      
      for (const value of Object.values(parsed)) {
        traverse(value);
      }
    };
    
    traverse(payload);
    return records;
  },
  
  normalizeRecord: function(record, fallbackMobile) {
    const getByAlias = (aliases) => {
      for (const [key, value] of Object.entries(record || {})) {
        if (aliases.includes(key.toLowerCase())) {
          return this.formatValue(value);
        }
      }
      return "N/A";
    };
    
    return {
      name: getByAlias(["name", "full_name", "fullname", "customer_name", "owner_name"]),
      fname: getByAlias(["fname", "father_name", "fathername", "parent_name"]),
      id: getByAlias(["id", "aadhaar", "aadhar", "aadhaar_id", "aadhar_id"]),
      mobile: getByAlias(["mobile", "mobile_no", "mobile_number", "phone", "phone_no", "number", "mob"]) || fallbackMobile,
      alt: getByAlias(["alt", "alternate", "alternate_mobile", "secondary_mobile", "alt_mobile"]),
      address: getByAlias(["address", "full_address", "addr", "location"]),
      circle: getByAlias(["circle", "state", "telecom_circle", "region"])
    };
  },
  
  formatValue: function(value) {
    if (value === null || value === undefined) return "N/A";
    
    if (Array.isArray(value)) {
      return Utils.arrayToString(value);
    }
    
    if (typeof value === "object") {
      const items = Object.values(value)
        .map(v => String(v).trim())
        .filter(Boolean);
      return items.length > 0 ? items.join(", ") : "N/A";
    }
    
    const cleaned = String(value).trim();
    if (!cleaned || ["null", "undefined", "-", "--", "na", "n/a"].includes(cleaned.toLowerCase())) {
      return "N/A";
    }
    return cleaned;
  },
  
  getDuplicateKey: function(record) {
    return [record.name, record.fname, record.id, record.mobile, record.alt, record.address, record.circle]
      .map(v => String(v).toLowerCase().trim())
      .join("|");
  }
};

// ===== RENDERING ENGINE =====
const Renderer = {
  renderRecords: function(records) {
    const html = records
      .map((record, index) => `
        <article class="record-card">
          <h3 class="record-head">
            <span>🔹 Record ${index + 1}</span>
            ${record.duplicate ? '<span class="duplicate-tag">(Duplicate)</span>' : ""}
          </h3>
          <div class="field">
            <span class="field-label">Name</span>
            <span class="field-value">${Utils.escapeHtml(record.name)}</span>
          </div>
          <div class="field">
            <span class="field-label">Father Name</span>
            <span class="field-value">${Utils.escapeHtml(record.fname)}</span>
          </div>
          <div class="field">
            <span class="field-label">Aadhaar ID</span>
            <span class="field-value">${Utils.escapeHtml(record.id)}</span>
          </div>
          <div class="field">
            <span class="field-label">Mobile</span>
            <span class="field-value">${Utils.escapeHtml(record.mobile)}</span>
          </div>
          <div class="field">
            <span class="field-label">Alternate</span>
            <span class="field-value">${Utils.escapeHtml(record.alt)}</span>
          </div>
          <div class="field">
            <span class="field-label">Address</span>
            <span class="field-value">${Utils.escapeHtml(record.address)}</span>
          </div>
          <div class="field">
            <span class="field-label">Circle</span>
            <span class="field-value">${Utils.escapeHtml(record.circle)}</span>
          </div>
        </article>
      `)
      .join("");
    
    DOM.recordsGrid.innerHTML = html;
    DOM.resultsWrap.classList.remove("hidden");
    DOM.copyBtn.disabled = false;
    DOM.downloadBtn.disabled = false;
  },
  
  renderNoData: function() {
    DOM.recordsGrid.innerHTML = '<div class="no-data">No data found for this mobile number.</div>';
    DOM.resultsWrap.classList.remove("hidden");
    DOM.copyBtn.disabled = true;
    DOM.downloadBtn.disabled = true;
  },
  
  buildReport: function(records) {
    const lines = ["📱 Mobile Number Lookup", ""];
    
    records.forEach((record, index) => {
      lines.push(`🔹 Record ${index + 1}${record.duplicate ? " (Duplicate)" : ""}`);
      lines.push(`Name: ${record.name}`);
      lines.push(`Father Name: ${record.fname}`);
      lines.push(`Aadhaar ID: ${record.id}`);
      lines.push(`Mobile: ${record.mobile}`);
      lines.push(`Alternate: ${record.alt}`);
      lines.push("");
      lines.push("Address:");
      lines.push(record.address);
      lines.push("");
      lines.push(`Circle: ${record.circle}`);
      lines.push("");
    });
    
    return lines.join("\n").trim();
  }
};

// ===== API CLIENT =====
const ApiClient = {
  // Fetch JSON from URL
  fetchJson: async function(url) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json, text/plain, */*" }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error("Invalid JSON response");
      }
    } catch (error) {
      throw error;
    }
  },
  
  // Fetch with CORS fallback
  fetchWithFallback: async function(mobile) {
    try {
      // Get secure API URL from provider
      const apiUrl = ApiProvider.getUrl();
      const directUrl = ApiClient.buildUrl(apiUrl, mobile);
      
      // Try direct fetch
      try {
        const payload = await ApiClient.fetchJson(directUrl);
        return { payload, mode: "direct" };
      } catch (directError) {
        console.warn("Direct fetch failed, trying CORS proxy");
      }
      
      // Try CORS proxy services as fallback
      const proxyUrls = [
        `https://corsproxy.io/?${encodeURIComponent(directUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`
      ];
      
      for (const proxyUrl of proxyUrls) {
        try {
          const payload = await ApiClient.fetchJson(proxyUrl);
          return { payload, mode: "proxy" };
        } catch (proxyError) {
          continue;
        }
      }
      
      throw new Error("All fetch methods failed");
    } catch (error) {
      throw error;
    }
  },
  
  // Build secure URL
  buildUrl: function(apiUrl, mobile) {
    return `${apiUrl}${encodeURIComponent(mobile)}`;
  }
};

// ===== ACTIONS =====
const Actions = {
  performSearch: async function(mobile) {
    // Validation
    if (!Utils.isValidMobile(mobile)) {
      StatusManager.showMessage("Please enter a valid 10 digit mobile number.", "error");
      StatusManager.setStatus("Invalid Input", "error");
      return;
    }
    
    // Prevent duplicate submissions
    if (AppState.isLoading) {
      StatusManager.showMessage("Please wait for the previous request to complete.", "info");
      return;
    }
    
    // Reset UI
    StatusManager.clearMessage();
    DOM.resultsWrap.classList.add("hidden");
    DOM.recordsGrid.innerHTML = "";
    AppState.reportText = "";
    AppState.searchedNumber = mobile;
    
    // Start loading
    StatusManager.setStatus("Connecting", "loading");
    StatusManager.setLoading(true);
    
    try {
      // Fetch data with fallback
      const { payload, mode } = await ApiClient.fetchWithFallback(mobile);
      
      // Parse records
      const rawRecords = DataProcessor.extractRecords(payload);
      if (!rawRecords || rawRecords.length === 0) {
        Renderer.renderNoData();
        StatusManager.showMessage("No records found for this number.", "info");
        StatusManager.setStatus("No Data", "nodata");
        return;
      }
      
      // Normalize records
      const records = rawRecords.map(rec => 
        DataProcessor.normalizeRecord(rec, mobile)
      );
      
      // Find duplicates
      const duplicateCounts = {};
      records.forEach(record => {
        const key = DataProcessor.getDuplicateKey(record);
        duplicateCounts[key] = (duplicateCounts[key] || 0) + 1;
      });
      
      // Mark duplicates
      const enrichedRecords = records.map(record => ({
        ...record,
        duplicate: duplicateCounts[DataProcessor.getDuplicateKey(record)] > 1
      }));
      
      // Render results
      Renderer.renderRecords(enrichedRecords);
      AppState.reportText = Renderer.buildReport(enrichedRecords);
      
      StatusManager.setStatus("Online", "online");
      const modeText = mode === "proxy" ? " (Loaded via CORS fallback)" : "";
      StatusManager.showMessage(
        `${enrichedRecords.length} record(s) loaded successfully.${modeText}`,
        "info"
      );
      
    } catch (error) {
      const errorMsg = error?.message || "Unexpected error occurred";
      StatusManager.showMessage(`Unable to fetch data. ${errorMsg}`, "error");
      StatusManager.setStatus("Error", "error");
      DOM.resultsWrap.classList.add("hidden");
      DOM.recordsGrid.innerHTML = "";
      DOM.copyBtn.disabled = true;
      DOM.downloadBtn.disabled = true;
      
    } finally {
      StatusManager.setLoading(false);
    }
  },
  
  copyReport: async function() {
    if (!AppState.reportText) return;
    
    try {
      await navigator.clipboard.writeText(AppState.reportText);
      DOM.copyBtn.textContent = "Copied ✓";
      setTimeout(() => {
        DOM.copyBtn.textContent = "Copy Report";
      }, 1500);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = AppState.reportText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      
      DOM.copyBtn.textContent = "Copied ✓";
      setTimeout(() => {
        DOM.copyBtn.textContent = "Copy Report";
      }, 1500);
    }
  },
  
  downloadReport: function() {
    if (!AppState.reportText) return;
    
    const blob = new Blob([AppState.reportText], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `mobile_lookup_${AppState.searchedNumber || "report"}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  }
};

// ===== EVENT HANDLERS =====
const EventHandlers = {
  setupFormSubmit: function() {
    DOM.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const mobile = DOM.mobileInput.value.trim();
      await Actions.performSearch(mobile);
    });
  },
  
  setupMobileInput: function() {
    DOM.mobileInput.addEventListener("input", () => {
      // Allow only digits, limit to 10
      DOM.mobileInput.value = DOM.mobileInput.value.replace(/\D/g, "").slice(0, 10);
      StatusManager.clearMessage();
    });
  },
  
  setupActionButtons: function() {
    DOM.copyBtn.addEventListener("click", () => Actions.copyReport());
    DOM.downloadBtn.addEventListener("click", () => Actions.downloadReport());
  },
  
  setupPageDetection: function() {
    if (window.location.protocol === "file:") {
      StatusManager.showMessage(
        "Tip: You are opening this page via file://. Some APIs block this origin. Deploy or run on localhost for best reliability.",
        "info"
      );
    }
  }
};

// ===== MAIN INITIALIZATION =====
const initializeApp = () => {
  try {
    // Initialize DOM cache
    if (!DOM.init()) {
      throw new Error("Failed to initialize DOM elements");
    }
    
    // Setup event handlers
    EventHandlers.setupPageDetection();
    EventHandlers.setupFormSubmit();
    EventHandlers.setupMobileInput();
    EventHandlers.setupActionButtons();
    
    // Set initial status
    StatusManager.setStatus("Ready", "idle");
    
    console.log("[App] Application initialized successfully");
    
  } catch (error) {
    console.error("[App] Initialization failed:", error.message);
    StatusManager.showMessage("Failed to initialize application. Please refresh the page.", "error");
  }
};

// ===== AUTO-INITIALIZATION =====
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    AppInitializer.ready(initializeApp);
    AppInitializer.setReady();
  });
} else {
  AppInitializer.ready(initializeApp);
  AppInitializer.setReady();
}
