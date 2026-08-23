# 🎯 Oracle Linux 8 (1Z0-106) Exam Simulator & Practice Portal

A full-stack certification exam portal replicating the official **Pearson VUE / Oracle University** exam UI with gated authentication, user mastery tracking, and an admin analytics dashboard.

---

## 🌟 Features

- **🔐 Gated Access & Secret Passcode Registration**:
  - Requires organization secret invitation code to create accounts.
  - `candidate2026` ➔ Standard candidate account.
  - `admin2026` ➔ **Admin** account (activates Admin Analytics Dashboard).
- **⭐ Question Mastery & Confidence Tracking**:
  - Tracks individual progress for all 60 exam questions.
  - A question is marked **"Confident / Mastered"** only after the user answers it correctly **at least 2 times** (prevents counting lucky guesses).
- **🛡 Admin Analytics Dashboard**:
  - View all registered candidates, total exams attempted, average score, and number of confident questions mastered.
- **⚡ Official Exam Simulation UI**:
  - 90-minute countdown timer with 5-minute warning.
  - Practice mode with instant explanations & Exam mode with final scoring.
  - Shuffle-safe questions and answer choices with dynamic `A`, `B`, `C`, `D` labels.

---

## 🚀 Cloudflare Deployment Guide (Pages + Free D1 Database)

### Step 1: Create Free Cloudflare D1 Database
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) ➔ **Storage & databases** ➔ **D1 SQL Database**.
2. Click **Create database** ➔ Name: `oracle-cert-db`.
3. In the database console, open the **Console / Query** tab, paste the contents of [`schema.sql`](./schema.sql), and click **Execute**.

---

### Step 2: Deploy Cloudflare Pages
1. Go to **Workers & Pages** ➔ **Create application** ➔ **Pages** tab ➔ **Connect to Git**.
2. Select repository: `ammar0466/oracle-linux-8-exam-simulator`.
3. Configure settings:
   - **Framework preset**: `None`
   - **Build command**: *(leave blank)*
   - **Build output directory**: `/`
4. Click **Save and Deploy**.

---

### Step 3: Bind D1 Database to Pages
1. In your Cloudflare Pages project, go to **Settings** ➔ **Functions**.
2. Scroll to **D1 Database Bindings** ➔ Click **Add binding**.
   - **Variable name**: `DB` *(Must be uppercase `DB`)*
   - **D1 database**: Select `oracle-cert-db`.
3. Trigger a redeploy (or push a commit) so the API functions connect to D1.

---

### Step 4: Add Custom Domain (e.g. `exam.yourdomain.com`)
1. In your Cloudflare Pages project, go to the **Custom domains** tab.
2. Click **Set up a custom domain**.
3. Enter your domain: `exam.yourdomain.com`.
4. Cloudflare will automatically route your DNS and issue a free SSL certificate.

---

## 📂 Project Architecture

```
├── index.html                  # Gated portal & exam interface
├── styles.css                  # Pearson VUE styling, modals & dashboards
├── app.js                      # Client app (state, timers, auth & mastery sync)
├── quiz_data.js                # Embedded questions dataset
├── quiz_data.json              # 60 verified Oracle Linux 8 questions
├── schema.sql                  # D1 database tables (users, attempts, mastery)
├── functions/
│   └── api/
│       ├── auth.js             # User login, registration, & secret validation
│       ├── progress.js         # Exam attempt logger & confidence tracker
│       └── admin.js            # Admin analytics endpoint
└── README.md
```
