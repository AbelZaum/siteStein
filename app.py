import json
import os
import openai
from flask import Flask, jsonify, request, send_file, send_from_directory
from datetime import datetime
from flask_cors import CORS

# API Key fixa para teste
openai.api_key = "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"
print("API KEY:", openai.api_key)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Pasta segura para armazenar logs e leads (funciona local e no servidor)
data_folder = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(data_folder, exist_ok=True)


def save_log(client_ip, user_message, assistant_message):
    log_file_path = os.path.join(data_folder, f"log_{client_ip}.txt")
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(log_file_path, 'a', encoding='utf-8') as log_file:
        log_file.write(f"{current_time} - Usuário ({client_ip}): {user_message}\n")
        log_file.write(f"{current_time} - Lia: {assistant_message}\n\n")


@app.route('/')
def home():
    return send_file('index.html')


def carregar_conteudo_sites():
    combined_content = ''
    input_dir = os.path.join(os.path.dirname(__file__), 'conteudo_sites')
    for file_name in os.listdir(input_dir):
        file_path = os.path.join(input_dir, file_name)
        with open(file_path, 'r', encoding='utf-8') as infile:
            combined_content += infile.read() + "\n\n"
    return combined_content


@app.route("/api/generate", methods=["POST"])
def generate_api():
    try:
        req_body = request.get_json()
        content = req_body.get("contents")[0]["text"]
        user_message = content.split("Pergunta: ")[-1].strip()
        client_ip = request.remote_addr

        conteudo_site = carregar_conteudo_sites()

        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system",
                 "content": "Você é um assistente virtual da Construtora Stein chamado Lia. Sempre que fornecer links, formate-os como hyperlinks clicáveis usando HTML. Seja breve, direta e objetiva com as tuas respostas, sem enrolação. Exemplo de hyperlink: <a href='https://example.com'>Texto do Link</a>."},
                {"role": "system", "content": conteudo_site},
                {"role": "user", "content": user_message}
            ],
            stream=True
        )

        def stream():
            assistant_message = ""
            for chunk in response:
                delta = chunk['choices'][0]['delta']
                if 'content' in delta:
                    assistant_message += delta['content']
                    yield f"data: {json.dumps({'text': delta['content']})}\n\n"
            # Salvar log
            save_log(client_ip, user_message, assistant_message)

        return stream(), {'Content-Type': 'text/event-stream'}

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/save-lead", methods=["POST"])
def save_lead():
    try:
        data = request.get_json()
        nome = data.get("nome")
        telefone = data.get("telefone")
        email = data.get("email")

        lead_file_path = os.path.join(data_folder, "leads.txt")
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        with open(lead_file_path, "a", encoding='utf-8') as f:
            f.write(f"{current_time} - Nome: {nome}, Telefone: {telefone}, Email: {email}\n")

        return jsonify({"status": "sucesso", "mensagem": "Lead salvo com sucesso!"})

    except Exception as e:
        return jsonify({"status": "erro", "mensagem": str(e)}), 500


@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('', path)


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5501)
