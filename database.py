import sqlite3
import os

DB_NAME = 'chatbot.db'

def get_connection():
    return sqlite3.connect(DB_NAME, check_same_thread=False)

def create_tables():
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            session_id TEXT,
            message TEXT,
            response TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS login_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            ip_address TEXT
        )
    ''')
    c.execute("INSERT OR IGNORE INTO users (username, password) VALUES ('admin', 'admin123')")
    conn.commit()
    conn.close()

def add_user(username, password):
    try:
        conn = get_connection()
        c = conn.cursor()
        c.execute('INSERT INTO users (username, password) VALUES (?, ?)', (username, password))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        return False

def verify_user(username, password):
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT * FROM users WHERE username = ? AND password = ?', (username, password))
    user = c.fetchone()
    conn.close()
    return user is not None

def save_chat(username, session_id, message, response):
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        INSERT INTO chats (username, session_id, message, response)
        VALUES (?, ?, ?, ?)
    ''', (username, str(session_id), message, response))
    conn.commit()
    conn.close()

def get_chat_history(username):
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        SELECT session_id, message, response, timestamp
        FROM chats WHERE username = ? ORDER BY timestamp ASC
    ''', (username,))
    rows = c.fetchall()
    conn.close()
    return rows

def delete_session(username, session_id):
    conn = get_connection()
    c = conn.cursor()
    c.execute('DELETE FROM chats WHERE username = ? AND session_id = ?', (username, str(session_id)))
    conn.commit()
    conn.close()

def delete_all_history(username):
    conn = get_connection()
    c = conn.cursor()
    c.execute('DELETE FROM chats WHERE username = ?', (username,))
    conn.commit()
    conn.close()

def save_login_log(username, ip_address):
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        INSERT INTO login_logs (username, ip_address)
        VALUES (?, ?)
    ''', (username, ip_address))
    conn.commit()
    conn.close()

def get_all_login_logs():
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT username, timestamp, ip_address FROM login_logs ORDER BY timestamp DESC')
    rows = c.fetchall()
    conn.close()
    return rows
