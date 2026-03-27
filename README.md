# AI Student Assistant Chatbot

A simple, modern, fully functional web-based AI assistant built with Python (Flask) on the backend and HTML/CSS/JS on the frontend. It integrates deeply with the OpenAI API to provide dynamic academic support.

## Features
- **Flask Backend:** Handles `/chat` endpoints and interfaces with the latest OpenAI Python SDK (`>=1.0.0`).
- **Modern UI:** Vibrant gradients, smooth CSS animations, dynamic loading indicators.
- **Robustness:** Handles missing inputs, catches backend errors, avoids leaking secrets to the frontend.
- **Beginner-Friendly codebase:** Comprehensively commented.

## Setup Instructions

### 1. Prerequisites
- [Python 3.8+](https://www.python.org/downloads/) installed.
- An [OpenAI API Key](https://platform.openai.com/account/api-keys).

### 2. Install Dependencies
Open your terminal inside the project directory and run:

```bash
pip install -r requirements.txt
```

### 3. Set OpenAI API Key
We use an Environment Variable for security instead of hardcoding the key.

**Option A: Create a `.env` file (Recommended)**
1. Create a file named `.env` in the same directory as `app.py`.
2. Add the following line:
   ```env
   OPENAI_API_KEY=your_actual_api_key_here
   ```

**Option B: Terminal Export**
- **Windows (PowerShell):** `$env:OPENAI_API_KEY="your-api-key"`
- **Windows (CMD):** `set OPENAI_API_KEY=your-api-key`
- **Mac/Linux:** `export OPENAI_API_KEY="your-api-key"`

### 4. Run the Application
Start the Flask server by running:

```bash
python app.py
```

### 5. Open in your Browser
Once the server is running, navigate to [http://127.0.0.1:5000](http://127.0.0.1:5000) in your web browser. 
You can now ask questions to the AI assistant!
