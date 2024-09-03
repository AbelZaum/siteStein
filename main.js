import { streamGemini } from './gemini-api.js';

// Selecionando os elementos
let mainForm = document.querySelector('form');
let promptInput = document.querySelector('input[name="prompt"]');
let output = document.querySelector('.output');
let typingIndicator = document.querySelector('.typing-indicator');

let context = '';

async function fetchSiteContent() {
  let response = await fetch('/api/site-content');
  let data = await response.json();
  return data.content;
}

async function updateContext() {
  let siteContent = await fetchSiteContent();
  context = `Você é um assistente virtual da Construtora Stein chamado Lia. Responda as perguntas usando as seguintes informações somente tiradas deste site: ${siteContent}`;
}

updateContext();

function showTypingIndicator() {
  typingIndicator.style.display = 'block';
}

function hideTypingIndicator() {
  typingIndicator.style.display = 'none';
}

mainForm.onsubmit = async (ev) => {
  ev.preventDefault();
  output.textContent = 'Lia está digitando...'; // Limpa o texto atual do output

  showTypingIndicator();

  try {
    let contents = [
      {
        type: "text",
        text: `${context} Pergunta: ${promptInput.value}`
      }
    ];

    let stream = streamGemini({
      model: 'gemini-pro',
      contents,
    });

    let buffer = '';
    for await (let chunk of stream) {
      buffer += chunk;
      output.innerHTML = buffer; // Atualiza o conteúdo do output com HTML
    }
  } catch (e) {
    console.error('Erro:', e);
    output.innerHTML = '<div class="error-message">Ocorreu um erro ao processar sua solicitação.</div>';
  } finally {
    hideTypingIndicator();
    promptInput.value = ''; // Limpa o campo de input após o envio
  }
};

// Captura o formulário e o conteúdo do chat no pop-up
let chatForm = document.querySelector('#chat-form');
let chatPromptInput = document.querySelector('#chat-popup input[name="prompt"]');
let chatOutput = document.querySelector('#chat-content');

if (chatForm) {
  chatForm.onsubmit = async (ev) => {
    ev.preventDefault();

    let userMessage = chatPromptInput.value.trim();

    if (!userMessage) return; // Evita enviar mensagens vazias

    // Adiciona a mensagem do usuário ao chat
    chatOutput.innerHTML += `<div class="chat-message user-message">${userMessage}</div>`;
    chatPromptInput.value = ''; // Limpa o campo de input

    // Mostra o indicador "Lia está digitando"
    showTypingIndicator();

    try {
      let contents = [
        {
          type: "text",
          text: `${context} Pergunta: ${userMessage}`
        }
      ];

      let stream = streamGemini({
        model: 'gemini-pro',
        contents,
      });

      let buffer = '';
      for await (let chunk of stream) {
        buffer += chunk;
      }

      // Adiciona a resposta da Lia ao chat
      const cleanedBuffer = buffer.replace(/^Resposta:\s*/, ''); // Remove o prefixo "Resposta:"
      chatOutput.innerHTML += `<div class="chat-message lia-message">${cleanedBuffer}</div>`;
    } catch (e) {
      chatOutput.innerHTML += `<div class="chat-message error-message">Erro: ${e}</div>`;
    } finally {
      hideTypingIndicator();
      chatOutput.scrollTop = chatOutput.scrollHeight; // Rola o chat para o final
    }
  };
}
