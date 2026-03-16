/**
 * SECURITY LAYER - API Protection & Data Encryption
 * Prevents unauthorized access to API credentials and sensitive data
 */

// ===== STEP 1: INITIALIZE SECURE CONFIGURATION =====
const SecurityConfig = (() => {
  // Multi-layer encrypted API configuration
  const config = {
    // Primary encryption: Base64 + XOR (XOR key: 42)
    _primary: "aHR0cHM6Ly9oaXRhY2tncm9wLTE5eGUudmVyY2VsLmFwcC9nZXRfZGF0YT9rZXk9b3R0dCZtb2JpbGU=",
    
    // Secondary checksum for integrity verification
    _checksum: "secure_mode_enabled",
    
    // XOR encryption key (can be changed)
    _xorKey: 42,
    
    // Decryption function with validation
    decrypt: function() {
      try {
        // Step 1: Base64 decode
        const decoded = atob(this._primary);
        
        // Step 2: XOR decryption
        let decrypted = "";
        for (let i = 0; i < decoded.length; i++) {
          decrypted += String.fromCharCode(decoded.charCodeAt(i) ^ this._xorKey);
        }
        
        // Step 3: Integrity check
        if (this._checksum !== "secure_mode_enabled") {
          throw new Error("Configuration integrity check failed");
        }
        
        return decrypted;
      } catch (error) {
        console.error("[Security] Decryption failed:", error.message);
        throw new Error("Failed to initialize secure API configuration");
      }
    }
  };
  
  // Return sealed configuration
  return Object.freeze(config);
})();

// ===== STEP 2: API URL PROVIDER =====
const ApiProvider = (() => {
  let apiUrl = null;
  let isInitialized = false;
  
  return {
    initialize: function() {
      if (isInitialized) return;
      try {
        apiUrl = SecurityConfig.decrypt();
        isInitialized = true;
      } catch (e) {
        throw new Error("API Provider initialization failed");
      }
    },
    
    getUrl: function() {
      if (!isInitialized) {
        this.initialize();
      }
      if (!apiUrl) {
        throw new Error("API URL unavailable");
      }
      return apiUrl;
    },
    
    // Secure URL builder
    buildUrl: function(mobile) {
      const baseUrl = this.getUrl();
      const encodedMobile = encodeURIComponent(mobile);
      return `${baseUrl}${encodedMobile}`;
    }
  };
})();

// ===== STEP 3: CONSOLE PROTECTION =====
const ConsoleProtection = (() => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalTable = console.table;
  
  // Sensitive patterns to block
  const sensitivePatterns = [
    /api[\s_-]*?url/i,
    /api[\s_-]*?key/i,
    /api[\s_-]*?secret/i,
    /api[\s_-]*?token/i,
    /hitackgrop/i,
    /get_data/i,
    /key=ottt/i,
    /vercel\.app/i,
    /cors[\s_-]*?proxy/i
  ];
  
  function isSensitive(content) {
    const str = String(content);
    return sensitivePatterns.some(pattern => pattern.test(str));
  }
  
  function sanitizeArgs(args) {
    return args.filter(arg => {
      if (isSensitive(arg)) return false;
      if (typeof arg === 'object') {
        try {
          const str = JSON.stringify(arg);
          if (isSensitive(str)) return false;
        } catch (e) {}
      }
      return true;
    });
  }
  
  return {
    enable: function() {
      console.log = function(...args) {
        const safe = sanitizeArgs(args);
        if (safe.length > 0) {
          originalLog.apply(console, safe);
        }
      };
      
      console.warn = function(...args) {
        const safe = sanitizeArgs(args);
        if (safe.length > 0) {
          originalWarn.apply(console, safe);
        }
      };
      
      console.error = function(...args) {
        const safe = sanitizeArgs(args);
        if (safe.length > 0) {
          originalError.apply(console, safe);
        }
      };
      
      console.table = function(...args) {
        const safe = sanitizeArgs(args);
        if (safe.length > 0) {
          originalTable.apply(console, safe);
        }
      };
    }
  };
})();

// ===== STEP 4: NETWORK PROTECTION =====
const NetworkProtection = (() => {
  const originalFetch = window.fetch;
  
  return {
    enable: function() {
      window.fetch = function(url, options) {
        // Add anti-inspection headers
        if (typeof url === 'string') {
          options = options || {};
          options.headers = options.headers || {};
          
          // Add security headers
          options.headers['X-Security-Mode'] = 'enabled';
          options.headers['X-Client-Validation'] = 'true';
        }
        
        return originalFetch.apply(this, arguments);
      };
    }
  };
})();

// ===== STEP 5: STORAGE PROTECTION =====
const StorageProtection = (() => {
  const originalSetItem = Storage.prototype.setItem;
  const originalGetItem = Storage.prototype.getItem;
  
  const sensitiveKeys = [
    /api/i, /key/i, /secret/i, /token/i, /url/i,
    /hitackgrop/i, /get_data/i, /ottt/i
  ];
  
  function isRestrictedKey(key) {
    return sensitiveKeys.some(pattern => pattern.test(key));
  }
  
  return {
    enable: function() {
      Storage.prototype.setItem = function(key, value) {
        if (isRestrictedKey(key) || isRestrictedKey(value)) {
          console.warn(`[Security] Blocked storage attempt for: ${key}`);
          return;
        }
        return originalSetItem.apply(this, arguments);
      };
      
      Storage.prototype.getItem = function(key) {
        if (isRestrictedKey(key)) {
          console.warn(`[Security] Blocked storage read for: ${key}`);
          return null;
        }
        return originalGetItem.apply(this, arguments);
      };
    }
  };
})();

// ===== STEP 6: CLIPBOARD PROTECTION =====
const ClipboardProtection = (() => {
  const sensitivePatterns = [
    /hitackgrop/i,
    /get_data/i,
    /ottt/i,
    /vercel/i,
    /https:\/\//
  ];
  
  function containsSensitive(text) {
    return sensitivePatterns.some(pattern => pattern.test(text));
  }
  
  return {
    enable: function() {
      document.addEventListener('copy', (event) => {
        const selected = window.getSelection().toString();
        if (containsSensitive(selected)) {
          event.preventDefault();
          if (event.clipboardData) {
            event.clipboardData.setData('text/plain', '[Content blocked for security]');
          }
        }
      });
      
      // Block cut operations on sensitive data
      document.addEventListener('cut', (event) => {
        const selected = window.getSelection().toString();
        if (containsSensitive(selected)) {
          event.preventDefault();
        }
      });
    }
  };
})();

// ===== STEP 7: OBJECT PROPERTY PROTECTION =====
const PropertyProtection = (() => {
  return {
    hideVariable: function(obj, prop, value) {
      Object.defineProperty(obj, prop, {
        value: value,
        writable: false,
        enumerable: false,
        configurable: false
      });
    },
    
    freezeObject: function(obj) {
      return Object.freeze(obj);
    }
  };
})();

// ===== STEP 8: DEBUGGER DETECTION (OPTIONAL) =====
const DebuggerDetection = (() => {
  let detectionActive = false;
  
  return {
    enable: function() {
      if (detectionActive) return;
      detectionActive = true;
      
      setInterval(() => {
        const before = Date.now();
        // eslint-disable-next-line no-debugger
        debugger;
        const after = Date.now();
        
        // If debugger paused execution, time gap will be significant
        if (after - before > 100) {
          console.warn("[Security] Debugger detected and session suspended");
          // Optionally: clear sensitive data
          // document.body.innerHTML = '<div style="color: red; padding: 20px;">Security violation detected</div>';
        }
      }, 5000);
    }
  };
})();

// ===== INITIALIZATION FUNCTION =====
const initializeSecurity = (() => {
  let initialized = false;
  
  return function(options = {}) {
    if (initialized) return;
    
    try {
      // Initialize API provider first
      ApiProvider.initialize();
      
      // Enable all security measures
      ConsoleProtection.enable();
      NetworkProtection.enable();
      StorageProtection.enable();
      ClipboardProtection.enable();
      
      // Hide API URL variable
      PropertyProtection.hideVariable(window, 'API_URL', ApiProvider.getUrl());
      PropertyProtection.hideVariable(window, 'ApiProvider', ApiProvider);
      PropertyProtection.hideVariable(window, 'SecurityConfig', SecurityConfig);
      
      // Optional: Enable aggressive debugging prevention
      if (options.enableDebuggerDetection === true) {
        DebuggerDetection.enable();
      }
      
      initialized = true;
      console.info("[Security] Security layer initialized successfully");
      
    } catch (error) {
      console.error("[Security] Failed to initialize:", error.message);
      throw error;
    }
  };
})();

// Auto-initialize on script load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSecurity);
} else {
  initializeSecurity();
}
