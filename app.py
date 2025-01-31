import json
import os
import openai
import time
from flask import Flask, jsonify, request, send_file, send_from_directory
from datetime import datetime

app = Flask(__name__)

# Defina a chave da API OpenAI
openai.api_key = "sk-svcacct-U-lCYZPcHcHLFrMSS379rwAeIBkG5uYM2xrxZPc406WCTZYw-oRbwMJAzXGT3BlbkFJtY85AJiWTibtpU7j5sw4ZCTslAtOh-dy_YnMz-Z4y9wkc5t0zgrfdKHmNlQA"  

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


def carregar_conteudo_sites():

    """Carrega e combina o conteúdo de todos os arquivos na pasta conteudo_sites."""
    combined_content = ''
    input_dir = os.path.join(os.path.dirname(__file__), 'conteudo_sites')

    for file_name in os.listdir(input_dir):
        file_path = os.path.join(input_dir, file_name)
        with open(file_path, 'r', encoding='utf-8') as infile:
            combined_content += infile.read() + "\n\n"

    return combined_content

# Função para a geração de respostas usando o GPT-4
@app.route("/api/generate", methods=["POST"])
def generate_api():
    if request.method == "POST":
        try:
            req_body = request.get_json()
            content = req_body.get("contents")[0]["text"]
            user_message = content.split("Pergunta: ")[-1].strip()
            client_ip = request.remote_addr  # Captura o IP do cliente

            # Carrega o conteúdo do site como contexto
            conteudo_site = carregar_conteudo_sites()

            response = openai.ChatCompletion.create(
                model="gpt-4o",
                messages=[
                    {"role": "system",
                     "content": "Você é um assistente virtual da Construtora Stein chamado Lia. Sempre que fornecer links, formate-os como hyperlinks clicáveis usando HTML. Exemplo de hyperlink: <a href='https://example.com'>Texto do Link</a>."},
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
