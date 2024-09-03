import json
import os
import webbrowser
import time
from flask import Flask, jsonify, request, send_file, send_from_directory
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI

app = Flask(__name__)

os.environ["GOOGLE_API_KEY"] = "AIzaSyBapANNZtgoi0lY2jW1QgKNY8KRt_lVaRQ"

@app.route('/')
def home():
    return send_file('index.html')

@app.route("/api/generate", methods=["POST"])
def generate_api():
    if request.method == "POST":
        try:
            req_body = request.get_json()
            content = req_body.get("contents")
            model = ChatGoogleGenerativeAI(model=req_body.get("model"))
            message = HumanMessage(
                content=content
            )
            response = model.stream([message])
            def stream():
                for chunk in response:
                    yield 'data: %s\n\n' % json.dumps({ "text": chunk.content })

            return stream(), {'Content-Type': 'text/event-stream'}

        except Exception as e:
            return jsonify({ "error": str(e) })

@app.route("/api/site-content")
def site_content():
    combined_content = ''
    input_dir = os.path.join(os.path.dirname(__file__), 'conteudo_sites')

    for file_name in os.listdir(input_dir):
        file_path = os.path.join(input_dir, file_name)
        with open(file_path, 'r', encoding='utf-8') as infile:
            combined_content += infile.read() + "\n\n"

    return jsonify({"content": combined_content})


@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('', path)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
