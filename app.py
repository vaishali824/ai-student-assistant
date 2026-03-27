import requests
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import os
from database import create_tables, add_user, verify_user, save_chat, get_chat_history, delete_session, delete_all_history, save_login_log, get_all_login_logs

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "super_secret_ai_key_123")

# Initialize SQLite tables
create_tables()

print("🚀 Ollama Chatbot Running...")

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if 'user' in session:
        return redirect(url_for('home'))

    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        if not username or not password:
            return render_template('signup.html', error="Username and password required")
        if add_user(username, password):
            return redirect(url_for('login', success="Account created successfully. Please login."))
        else:
            return render_template('signup.html', error="Username already exists")
    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user' in session:
        return redirect(url_for('home'))

    success_msg = request.args.get('success')

    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        if verify_user(username, password):
            session['user'] = username
            
            # Record the login timestamp and IP
            ip_address = request.remote_addr
            save_login_log(username, ip_address)
            
            # If admin, redirect to admin dashboard; else regular home
            if username == 'admin':
                return redirect(url_for('admin_dashboard'))
                
            return redirect(url_for('home'))
        return render_template('login.html', error="Invalid credentials", success=success_msg)
    return render_template('login.html', success=success_msg)

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('login'))

@app.route('/admin')
def admin_dashboard():
    if 'user' not in session or session['user'] != 'admin':
        return "Access Denied", 403
    
    logs = get_all_login_logs()
    return render_template('admin.html', logs=logs)

@app.route('/')
def home():
    if 'user' not in session:
        return redirect(url_for('login'))
    return render_template('index.html', username=session['user'])

@app.route('/delete_session', methods=['POST'])
def delete_session_route():
    if 'user' not in session:
        return jsonify({'error': 'Unauthorized access.'}), 401
    
    data = request.get_json()
    session_id = data.get('session_id')
    if session_id:
        delete_session(session['user'], session_id)
    return jsonify({'success': True})

@app.route('/delete_all', methods=['POST'])
def delete_all_route():
    if 'user' not in session:
        return jsonify({'error': 'Unauthorized access.'}), 401
    
    delete_all_history(session['user'])
    return jsonify({'success': True})

@app.route('/history', methods=['GET'])
def history():
    if 'user' not in session:
        return jsonify({'error': 'Unauthorized access. Please login.'}), 401
    
    # Fetch rows: session_id, message, response, timestamp
    rows = get_chat_history(session['user'])
    
    sessions_dict = {}
    for r in rows:
        s_id = r[0]
        msg = r[1]
        resp = r[2]
        
        if s_id not in sessions_dict:
            title = msg[:30] + ('...' if len(msg) > 30 else '')
            sessions_dict[s_id] = {'id': s_id, 'title': title, 'messages': []}
            
        sessions_dict[s_id]['messages'].append({'role': 'user', 'content': msg})
        sessions_dict[s_id]['messages'].append({'role': 'assistant', 'content': resp})
        
    sessions_list = list(sessions_dict.values())
    # Reverse to show newest chats first in sidebar
    sessions_list.reverse()
    
    return jsonify({'sessions': sessions_list})

@app.route('/chat', methods=['POST'])
def chat():
    if 'user' not in session:
        return jsonify({'error': 'Unauthorized access. Please login.'}), 401

    try:
        data = request.get_json()

        # Accept full conversation history or fallback to single message
        messages = data.get('history', [])
        if not messages and 'message' in data:
            messages = [{"role": "user", "content": data['message']}]

        if not messages:
            return jsonify({'error': 'No message provided'}), 400

        # Mode logic for System Prompt
        mode = data.get('mode', 'study')
        if mode == 'study':
            system_prompt = "You are a helpful tutor. Explain clearly and simply."
        elif mode == 'coding':
            system_prompt = "You are a coding expert. Give clean code and explanations."
        elif mode == 'interview':
            system_prompt = "You are an interviewer. Ask questions and evaluate answers."
        else:
            system_prompt = "You are a helpful assistant."

        # Clear old system messages and insert the new one
        messages = [msg for msg in messages if msg.get("role") != "system"]
        messages.insert(0, {"role": "system", "content": system_prompt})

        # 🔥 Call Ollama locally using /api/chat for conversation context
        response = requests.post(
            "http://localhost:11434/api/chat",
            json={
                "model": "llama3",
                "messages": messages,
                "stream": False
            }
        )

        result = response.json()
        bot_reply = result.get("message", {}).get("content", "No response")
        
        # Save interaction to DB
        session_id = data.get('session_id', 'default_session')
        # Extract the user's latest message logically
        user_latest_msg = next((m['content'] for m in reversed(data.get('history', [])) if m['role'] == 'user'), "No message")
        
        save_chat(session['user'], session_id, user_latest_msg, bot_reply)

        return jsonify({'response': bot_reply})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)