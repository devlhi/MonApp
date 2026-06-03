# AppMon

AppMon is a modern Network Operations Monitor that provides real-time monitoring of Ping, TCP, and SNMP interfaces (including SFP power/traffic), specifically tailored for MikroTik and other SNMP-compatible devices.

## Features

- **Real-Time Topology Map**: Geographically track network nodes and view traffic flow visually.
- **SFP Power Monitoring**: Real-time monitoring of SFP Optical Tx/Rx power.
- **SLA & Events**: Monitor Uptime % with detailed SLA reporting and event tracking.
- **AI Smart OID**: Automatically discover and map SNMP parameters utilizing AI.
- **Telegram Webhook**: Receive critical alerts for device down, interface disconnects, and low SFP power.

## Installation on Linux (Ubuntu/Debian)

We provide a streamlined installation script that automatically sets up Node.js, PM2, and builds the frontend for you.

Run the following commands on your server as root:

```bash
git clone https://github.com/devlhi/MonApp.git /opt/appmon
cd /opt/appmon
chmod +x installer.sh
sudo ./installer.sh
```

Once the installation is complete, you can access the AppMon dashboard at:
**http://<your_server_ip>:3027**

## Manual Installation

If you prefer to install manually:

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build the Frontend**
   ```bash
   cd web
   npm install
   npm run build
   cd ..
   ```

3. **Start the Application**
   ```bash
   npm run start
   ```

## Exporting Reports
AppMon supports natively exporting SLA and Event reports to PDF. Simply navigate to the SLA or Events page and click the **Export PDF** button.
