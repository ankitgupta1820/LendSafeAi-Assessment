# LendSafe AI - Setup & Running Guide

Welcome! This guide explains how to set up and run the **LendSafe AI** application on your local machine after cloning the repository.

---

## 📋 Prerequisites
Before running the application, ensure you have the following installed:
* **Node.js** (v18 or higher recommended)
* **npm** (v9 or higher)
* **Git**

---

## 🚀 Step-by-Step Launch Instructions

### Step 1: Clone the Repository
Clone the repository to your local machine:
```bash
git clone https://github.com/ankitgupta1820/LendSafeAi-Assessment.git
cd LendSafeAi-Assessment
```

---

### Step 2: Set up the Backend Environment Variables
Since the `.env` file contains sensitive API keys and wrapper URLs, it is ignored by Git. You **must create it manually** for the backend server to communicate with the LLM.

1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Create a new file named `.env`.
3. Paste the following configuration variables inside:
   ```env
   PORT=5000
   LLM_WRAPPER_URL=https://llm-wrapper-741152993481.asia-south1.run.app
   LLM_WRAPPER_TOKEN=lw_wU_g24w-2Lp7crPpatU4oD7LNDKGH3FYAIzM2y7tw38
   ```

---

### Step 3: Install Dependencies and Start the Backend
From the `backend` folder, install the npm modules and start the development server:
```bash
# Install packages
npm install

# Start the API server
npm run dev
```
The backend API server will start running on **`http://localhost:5000`**.

---

### Step 4: Install Dependencies and Start the Frontend
Open a **new terminal window/tab**, navigate to the project root, and go to the `frontend` folder:
```bash
# Go to frontend folder
cd frontend

# Install packages
npm install

# Start the Vite developer server
npm run dev
```
The React frontend development server will launch (usually on **`http://localhost:5173`**). Open the link in your browser to interact with the application.

---

## 🧪 Testing the Application

Once both servers are running:
1. **Explore Mock Profiles**: Select any preloaded mock documents (like John Doe or Jane Smith) in the left panel, click **1. Extract Data**, and then **2. Evaluate Rules** to see programmatic check statuses.
2. **Upload Real Files (New Feature!)**:
   * Switch to the **"Upload PDF / Image"** tab.
   * Choose the document type (**Salary Slip** or **Bank Statement**).
   * Upload an actual PDF file or scanned image (e.g. `mock_payslip_alice.png` or `ankit_rupee_payslip.png` found in the root directory).
   * Click **"Load File into Session"**, parse the fields, and run the underwriting rules.
3. **Adaptive Currency Formatting**: If the system detects Rupees (`₹`) on the document, it will automatically switch the minimum net income criteria to `₹20,000` (compared to `$2,000` for USD) and format values accordingly.
4. **Grounded Audits**: Use the chat container on the right to audit document details. Suggested question tags are available for quick testing.
5. **Access Isolation**: Select different user scopes (`Auditor Alpha`, `Underwriter Beta`, `Broker Gamma`) in the header to verify session states and chat history remain securely isolated.
