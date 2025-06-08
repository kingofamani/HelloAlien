import http.server
import ssl
import os
import socket # 引入 socket 模組

# --- 設定 ---
# 如果您在 config.js 中更改了埠號，請在此處也進行同步更改
PORT = 5001
CERT_FILE = 'cert.pem'
KEY_FILE = 'key.pem'

# --- 用於取得本機IP的輔助函式 ---
def get_local_ip():
    try:
        # 建立一個暫時的 socket 來連線到外部位址
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80)) # 連線到 Google 的 DNS
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        # 如果無法取得，則返回 fallback 位址
        return '127.0.0.1'

# --- 伺服器腳本 ---
# 檢查憑證檔案是否存在
if not os.path.exists(CERT_FILE) or not os.path.exists(KEY_FILE):
    print("=" * 60)
    print(f"錯誤：找不到 '{CERT_FILE}' 或 '{KEY_FILE}' 檔案。")
    print("請先執行以下指令來生成憑證檔案：")
    print('openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -sha256 -days 365 -nodes -subj "/CN=localhost"')
    print("=" * 60)
    exit(1)

# 建立一個 SSL Context 來提高安全性
try:
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=CERT_FILE, keyfile=KEY_FILE)
except Exception as e:
    print(f"錯誤：無法載入 SSL 憑證。 {e}")
    print("請確認 'key.pem' 和 'cert.pem' 是有效的憑證檔案，或嘗試刪除後重新生成它們。")
    exit(1)

# 設定並啟動伺服器
server_address = ('0.0.0.0', PORT)
httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

local_ip = get_local_ip()

print(f"正在 {PORT} 埠上啟動 HTTPS 伺服器...")
print(f"電腦瀏覽器請開啟: https://localhost:{PORT}/web/ 或 https://{local_ip}:{PORT}/web/")
print("(瀏覽器可能會顯示安全警告，請選擇 '進階' -> '繼續前往')")
print("\n" + "="*60)
print("重要提示：")
print(f"手機QR Code將會使用 'config.js' 中設定的IP位址。")
print(f"腳本偵測到您的IP約為: {local_ip}")
print(f"請確認 'config.js' 中的 SERVER_IP 設定正確，以便手機連線。")
print("="*60 + "\n")

try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\n伺服器已停止。")
    httpd.server_close()
except Exception as e:
    print(f"啟動伺服器時發生未預期的錯誤: {e}") 