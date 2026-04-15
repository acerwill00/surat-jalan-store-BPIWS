# Deployment & Security Plan: Bauer Delivery Note App

This document outlines the strategy for deploying the Delivery Note application internally for the **Bauer Workshop Store Department**, with a focus on local access and enhanced login security (SSO/MFA via WhatsApp or SMS).

## 1. Deployment Options (Internal Use)

Since the target users are within a specific department, the goal is to keep the data local and secure.

### Option A: Local On-Premise Server (Recommended)
You can set up a dedicated Windows/Linux machine within your office network to act as the server.
- **How it works**: The machine runs the Node.js application and the SQLite database.
- **Access**: Users access the app via a local IP or hostname (e.g., `http://bauer-store-server:3000`).
- **Pros**: Zero hosting costs, data never leaves your network, high performance.
- **Cons**: Requires physical hardware and maintenance.

### Option B: Docker Containerization
Deploying via Docker makes the setup portable and easy to restore if the hardware fails.
- **How it works**: Package the App, Node.js, and dependencies into a single container.
- **Pros**: Consistency across any machine (Windows/Linux), easy to move to the cloud later if needed.

### Option C: Private Cloud (VPN)
If the department has access to a cloud provider (Azure/AWS), you can host it there but restrict access to your company's VPN.
- **Pros**: Higher reliability (99.9% uptime).
- **Cons**: Monthly costs, requires technical setup for VPN access.

---

## 2. Advanced Security & SSO (OTP Features)

You requested login security that automatically sends a code to a phone number (SSO/MFA style).

### Proposed Authentication Flow
1. **Identifikasi**: User enters their Username/Phone Number on the login page.
2. **OTP Generation**: The system generates a 6-digit One-Time Password (OTP).
3. **Delivery**: The system automatically sends the OTP via **WhatsApp** or **SMS**.
4. **Verification**: User enters the OTP in the app to complete the login.

### Integration Options for WhatsApp/SMS

| Service | Channel | Pros | Cons |
| :--- | :--- | :--- | :--- |
| **Twilio** | SMS & WhatsApp | Industry standard, very reliable. | Requires credit (USD), needs internet access for the API. |
| **Whacenter / KirimWA** | WhatsApp (Local) | Popular in Indonesia, affordable flat rates. | Unofficial API (risky if Meta changes policies). |
| **Meta Graph API** | WhatsApp (Official) | Official support from Meta, highly secure. | Complex setup (requires Facebook Business Manager). |

---

## 3. Implementation Checklist

To transition to this new setup, we need to perform the following:

- [ ] **Database Update**: Add `phone_number` and `otp_code` fields to the `users` table.
- [ ] **Service Integration**: Sign up for a messaging provider (e.g., Twilio).
- [ ] **Backend logic**:
    - Update `server.js` to handle OTP generation/expiry.
    - Create a `/api/request-otp` endpoint.
    - Update `/api/login` to verify the OTP instead of (or in addition to) the password.
- [ ] **Frontend Update**:
    - Update `login.html` to include a "Verify OTP" step.
- [ ] **Server Setup**:
    - Configure **PM2** (Process Manager) to ensure the Node.js app restarts automatically if the server reboots.
    - (Optional) Configure **Nginx** as a reverse proxy to allow access via `http://surat-jalan.local` instead of port 3000.

---

## 4. Required Decisions

> [!IMPORTANT]
> To proceed with the security implementation, please choose your preferred notification channel:
> 1. **Option 1: WhatsApp** (Highly convenient for staff).
> 2. **Option 2: SMS** (More universal, but higher per-message cost).

> [!NOTE]
> For internal deployment, would you like me to prepare a **Docker Compose** file to make the installation on your local server "one-click"?
