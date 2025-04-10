// Bluetooth.js - Bluetooth device management

class BluetoothManager {
  constructor() {
    // Elements
    this.bluetoothToggle = document.getElementById('bluetoothToggle');
    this.connectedDevicesEl = document.getElementById('connectedDevices');
    this.availableDevicesEl = document.getElementById('availableDevices');
    this.scanDevicesBtn = document.getElementById('scanDevicesBtn');
    
    // State
    this.isEnabled = false;
    this.isScanning = false;
    this.connectedDevices = [];
    this.availableDevices = [];
    this.discoveredDevices = {}; // Store discovered devices by MAC
    
    // Initialize
    this.init();
  }
  
  init() {
    // Check Bluetooth status
    this.checkBluetoothStatus();
    
    // Event listeners
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Bluetooth toggle
    this.bluetoothToggle.addEventListener('change', () => {
      this.toggleBluetooth(this.bluetoothToggle.checked);
    });
    
    // Scan for devices button
    this.scanDevicesBtn.addEventListener('click', () => {
      this.scanForDevices();
    });
    
    // Socket events
    socket.on('bluetooth:scanning', () => {
      this.isScanning = true;
      this.updateUI();
    });
    
    socket.on('bluetooth:scan_complete', () => {
      this.isScanning = false;
      this.loadAvailableDevices();
    });
    
    socket.on('bluetooth:device_found', (device) => {
      // Add newly discovered device to the list
      this.discoveredDevices[device.mac] = device;
      
      // Update the UI if we're actively scanning
      if (this.isScanning) {
        this.renderAvailableDevices();
      }
    });
    
    socket.on('bluetooth:device_disconnected', (data) => {
      // Remove from connected devices
      this.connectedDevices = this.connectedDevices.filter(device => device.mac !== data.mac);
      this.renderConnectedDevices();
      
      player.showNotification('Device disconnected');
    });
    
    socket.on('bluetooth:error', (data) => {
      player.showNotification(`Bluetooth error: ${data.message}`);
      this.isScanning = false;
      this.updateUI();
    });
    
    // Navigation events
    document.getElementById('bluetoothBtn').addEventListener('click', () => {
      // Refresh device lists when opening the Bluetooth view
      this.refreshDeviceLists();
    });
  }
  
  checkBluetoothStatus() {
    fetch('/api/bluetooth/state')
      .then(response => response.json())
      .then(data => {
        this.isEnabled = data.enabled;
        this.isScanning = data.isScanning;
        this.bluetoothToggle.checked = this.isEnabled;
        
        // Update UI
        this.updateUI();
        
        // Load devices
        this.refreshDeviceLists();
      })
      .catch(error => {
        console.error('Error checking Bluetooth status:', error);
        this.isEnabled = false;
        this.bluetoothToggle.checked = false;
      });
  }
  
  refreshDeviceLists() {
    this.loadConnectedDevices();
    this.loadAvailableDevices();
  }
  
  loadConnectedDevices() {
    this.connectedDevicesEl.innerHTML = '<div class="loading">Loading connected devices...</div>';
    
    fetch('/api/bluetooth/connected')
      .then(response => response.json())
      .then(data => {
        this.connectedDevices = data.devices || [];
        this.renderConnectedDevices();
      })
      .catch(error => {
        console.error('Error loading connected devices:', error);
        this.connectedDevicesEl.innerHTML = '<div class="error">Error loading connected devices.</div>';
      });
  }
  
  loadAvailableDevices() {
    this.availableDevicesEl.innerHTML = '<div class="loading">Loading available devices...</div>';
    
    fetch('/api/bluetooth/available')
      .then(response => response.json())
      .then(data => {
        this.availableDevices = data.devices || [];
        
        // Update discovered devices cache
        this.availableDevices.forEach(device => {
          this.discoveredDevices[device.mac] = device;
        });
        
        this.renderAvailableDevices();
      })
      .catch(error => {
        console.error('Error loading available devices:', error);
        this.availableDevicesEl.innerHTML = '<div class="error">Error loading available devices.</div>';
      });
  }
  
  renderConnectedDevices() {
    this.connectedDevicesEl.innerHTML = '';
    
    if (this.connectedDevices.length === 0) {
      this.connectedDevicesEl.innerHTML = '<div class="empty">No connected devices.</div>';
      return;
    }
    
    this.connectedDevices.forEach(device => {
      const item = document.createElement('div');
      item.className = 'device-item';
      
      item.innerHTML = `
        <div class="device-info">
          <div class="device-name">${device.name || 'Unknown Device'}</div>
          <div class="device-mac">${device.mac || 'Unknown MAC'}</div>
        </div>
        <div class="device-actions">
          <button class="icon-btn disconnect-btn" title="Disconnect" data-mac="${device.mac}">
            <i class="fas fa-unlink"></i>
          </button>
        </div>
      `;
      
      // Disconnect button
      const disconnectBtn = item.querySelector('.disconnect-btn');
      disconnectBtn.addEventListener('click', () => {
        this.disconnectDevice(device);
      });
      
      this.connectedDevicesEl.appendChild(item);
    });
  }
  
  renderAvailableDevices() {
    this.availableDevicesEl.innerHTML = '';
    
    if (this.isScanning) {
      this.availableDevicesEl.innerHTML = '<div class="loading">Scanning for devices...</div>';
      return;
    }
    
    if (this.availableDevices.length === 0) {
      this.availableDevicesEl.innerHTML = '<div class="empty">No devices found. Try scanning again.</div>';
      return;
    }
    
    // Filter out already connected devices
    const connectedMacs = this.connectedDevices.map(d => d.mac);
    const availableOnly = this.availableDevices.filter(d => !connectedMacs.includes(d.mac));
    
    if (availableOnly.length === 0) {
      this.availableDevicesEl.innerHTML = '<div class="empty">No additional devices found. Try scanning again.</div>';
      return;
    }
    
    // Sort by signal strength (RSSI) if available
    availableOnly.sort((a, b) => {
      if (a.rssi && b.rssi) {
        return b.rssi - a.rssi; // Higher RSSI (less negative) = better signal
      }
      return 0;
    });
    
    availableOnly.forEach(device => {
      const item = document.createElement('div');
      item.className = 'device-item';
      
      item.innerHTML = `
        <div class="device-info">
          <div class="device-name">${device.name || 'Unknown Device'}</div>
          <div class="device-mac">${device.mac || 'Unknown MAC'}</div>
        </div>
        <div class="device-actions">
          <button class="icon-btn connect-btn" title="Connect" data-mac="${device.mac}">
            <i class="fas fa-link"></i>
          </button>
        </div>
      `;
      
      // Connect button
      const connectBtn = item.querySelector('.connect-btn');
      connectBtn.addEventListener('click', () => {
        this.connectDevice(device);
      });
      
      this.availableDevicesEl.appendChild(item);
    });
  }
  
  toggleBluetooth(enabled) {
    fetch('/api/bluetooth/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ enabled })
    })
      .then(response => response.json())
      .then(data => {
        this.isEnabled = data.enabled;
        this.bluetoothToggle.checked = this.isEnabled;
        
        if (this.isEnabled) {
          player.showNotification('Bluetooth enabled');
          this.refreshDeviceLists();
        } else {
          player.showNotification('Bluetooth disabled');
          this.connectedDevices = [];
          this.availableDevices = [];
          this.renderConnectedDevices();
          this.renderAvailableDevices();
        }
      })
      .catch(error => {
        console.error('Error toggling Bluetooth:', error);
        player.showNotification('Error toggling Bluetooth');
        // Revert the toggle to its previous state
        this.bluetoothToggle.checked = this.isEnabled;
      });
  }
  
  scanForDevices() {
    if (!this.isEnabled) {
      player.showNotification('Please enable Bluetooth first');
      return;
    }
    
    if (this.isScanning) {
      player.showNotification('Already scanning...');
      return;
    }
    
    // Update UI to show scanning state
    this.isScanning = true;
    this.scanDevicesBtn.disabled = true;
    this.scanDevicesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
    this.renderAvailableDevices();
    
    // Send scan request
    fetch('/api/bluetooth/scan', {
      method: 'POST'
    })
      .then(response => response.json())
      .then(data => {
        if (!data.success) {
          player.showNotification(data.message || 'Error starting scan');
          this.isScanning = false;
          this.updateUI();
        }
        
        // Set a timeout to refresh the device list after 10 seconds
        // in case we don't get the scan_complete event
        setTimeout(() => {
          if (this.isScanning) {
            this.isScanning = false;
            this.updateUI();
            this.loadAvailableDevices();
          }
        }, 10000);
      })
      .catch(error => {
        console.error('Error scanning for devices:', error);
        player.showNotification('Error scanning for devices');
        this.isScanning = false;
        this.updateUI();
      });
  }
  
  connectDevice(device) {
    if (!device || !device.mac) {
      console.error('Cannot connect: No MAC address provided');
      return;
    }
    
    // Show connecting status
    const connectButtons = document.querySelectorAll(`.connect-btn[data-mac="${device.mac}"]`);
    connectButtons.forEach(btn => {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    });
    
    console.log(`Attempting to connect to device: ${device.mac}`);
    
    fetch('/api/bluetooth/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mac: device.mac })
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Connection response:', data);
        
        if (data.success) {
          player.showNotification(`Connected to ${device.name || 'device'}`);
          // Refresh device lists after a brief delay
          setTimeout(() => this.refreshDeviceLists(), 1000);
        } else {
          player.showNotification(data.message || `Failed to connect to ${device.name || 'device'}`);
          this.updateUI();
        }
      })
      .catch(error => {
        console.error('Error connecting to device:', error);
        player.showNotification(`Error connecting to ${device.name || 'device'}`);
        this.updateUI();
      });
  }
  
  disconnectDevice(device) {
    if (!device || !device.mac) return;
    
    // Show disconnecting status
    const disconnectButtons = document.querySelectorAll(`.disconnect-btn[data-mac="${device.mac}"]`);
    disconnectButtons.forEach(btn => {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    });
    
    fetch('/api/bluetooth/disconnect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mac: device.mac })
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          player.showNotification(`Disconnected from ${device.name || 'device'}`);
          // Refresh device lists after a brief delay
          setTimeout(() => this.refreshDeviceLists(), 1000);
        } else {
          player.showNotification(data.message || `Failed to disconnect from ${device.name || 'device'}`);
          this.updateUI();
        }
      })
      .catch(error => {
        console.error('Error disconnecting from device:', error);
        player.showNotification(`Error disconnecting from ${device.name || 'device'}`);
        this.updateUI();
      });
  }
  
  updateUI() {
    // Update scan button
    this.scanDevicesBtn.disabled = this.isScanning || !this.isEnabled;
    if (this.isScanning) {
      this.scanDevicesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
    } else {
      this.scanDevicesBtn.innerHTML = '<i class="fas fa-search"></i> Scan for Devices';
    }
  }
}

// Initialize the Bluetooth manager
window.bluetoothManager = new BluetoothManager();
