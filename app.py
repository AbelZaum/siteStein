import json
import os
import webbrowser
import time
from flask import Flask, jsonify, request, send_file, send_from_directory
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from datetime import datetime

app = Flask(__name__)

os.environ["GOOGLE_API_KEY"] = "AIzaSyBdUnvvq9XoQka97aW4x4mqwhzU7GyFGtg"

# Define o caminho para a área de trabalho do usuário
desktop_path = os.path.join(os.path.join(os.path.expanduser("~")), 'Desktop')

def save_log(client_ip, user_message, assistant_message):
    log_file_path = os.path.join(desktop_path, f"log_{client_ip}.txt")
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    with open(log_file_path, 'a', encoding='utf-8') as log_file:
        log_file.write(f"{current_time} - Usuário ({client_ip}): {user_message}\n")
        log_file.write(f"{current_time} - Lia: {assistant_message}\n\n")

@app.route('/')
def home():
    return send_file('index.html')


# Função para carregar conteúdo dos arquivos do site
@app.route("/api/site-content")
def site_content():
    combined_content = ''
    input_dir = os.path.join(os.path.dirname(__file__), 'conteudo_sites')

    # Carrega os arquivos de conteúdo do site
    for file_name in os.listdir(input_dir):
        file_path = os.path.join(input_dir, file_name)
        with open(file_path, 'r', encoding='utf-8') as infile:
            combined_content += infile.read() + "\n\n"

    return jsonify({"content": combined_content})


# Função para carregar as informações da Lia do arquivo específico
@app.route("/api/lia-content")
def lia_content():
    lia_file_path = os.path.join(os.path.dirname(__file__), 'conteudo_sites', 'lia.txt')

    if os.path.exists(lia_file_path):
        with open(lia_file_path, 'r', encoding='utf-8') as lia_file:
            lia_content = lia_file.read()
            return jsonify({"content": lia_content})
    else:
        return jsonify({"error": "Lia content not found"}), 404


# Função para a geração de respostas usando o Gemini
@app.route("/api/generate", methods=["POST"])
def generate_api():
    if request.method == "POST":
        try:
            req_body = request.get_json()
            content = req_body.get("contents")[0]["text"]
            model = ChatGoogleGenerativeAI(model=req_body.get("model"))
            user_message = content.split("Pergunta: ")[-1].strip()
            client_ip = request.remote_addr  # Captura o IP do client
            message = HumanMessage(content=content)
            response = model.stream([message])

            def stream():
                assistant_message = ""
                for chunk in response:
                    assistant_message += chunk.content
                    yield 'data: %s\n\n' % json.dumps({"text": chunk.content})

                # Salva o log após a resposta completa
                save_log(client_ip, user_message, assistant_message)
                
            return stream(), {'Content-Type': 'text/event-stream'}

        except Exception as e:
            return jsonify({"error": str(e)})


@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('', path)


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
