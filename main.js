import { streamOpenAI } from './openai-api.js';

let mainForm = document.querySelector('form');
let promptInput = document.querySelector('input[name="prompt"]');
let output = document.querySelector('.output');
let typingIndicator = document.querySelector('.typing-indicator');

let context = '';
let userName = localStorage.getItem('userName') || ''; // Carrega o nome do usuário
let hasGreeted = false;

const outOfScopePhrases = [
  "não posso responder",
  "não tenho certeza",
  "não sei",
  "não encontrei",
  "fora do escopo",
  "não posso ajudar"
];

// Função para buscar o conteúdo do site
async function fetchSiteContent() {
  let response = await fetch('/api/site-content');
  let data = await response.json();
  return data.content;
}

function renderMessage(message) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = message;
  chatOutput.appendChild(tempDiv);
  chatOutput.scrollTop = chatOutput.scrollHeight;
}

function formatLinks(text) {
  const urlRegex = /https?:\/\/[^\s]+/g;
  return text.replace(urlRegex, (url) => `<a href="${url}" target="_blank">${url}</a>`);
}

// Função para atualizar o contexto do assistente Lia
async function updateContext() {
  let siteContent = await fetchSiteContent();
  context = `Você é um assistente virtual da Construtora Stein chamado Lia. Responda as perguntas usando as seguintes informações tiradas deste site: ${siteContent}. Sempre que fornecer links, formate-os como hyperlinks clicáveis usando HTML.`;
}

updateContext();

function showTypingIndicator() {
  typingIndicator.style.display = 'block';
}

function hideTypingIndicator() {
  typingIndicator.style.display = 'none';
}

function isOutOfScope(response) {
  return outOfScopePhrases.some(phrase => response.toLowerCase().includes(phrase));
}

// Recupera histórico de mensagens do localStorage
let chatOutput = document.querySelector('#chat-content');
let savedMessages = JSON.parse(localStorage.getItem('chatHistory')) || [];
if (savedMessages.length) {
  savedMessages.forEach((message) => {
    chatOutput.innerHTML += `<div class="${message.className}">${message.content}<span class="chat-time">${message.time}</span></div>`;
  });
}

// Adiciona o botão para limpar o chat
let clearChatButton = document.createElement('button');
clearChatButton.addEventListener('click', () => {
  // Limpa o histórico no localStorage e no DOM
  localStorage.removeItem('chatHistory');
  chatOutput.innerHTML = '';
});

chatOutput.parentNode.insertBefore(clearChatButton, chatOutput);

let chatForm = document.querySelector('#chat-form');
let chatPromptInput = document.querySelector('#chat-popup input[name="prompt"]');

if (chatForm) {
  chatForm.onsubmit = async (ev) => {
    ev.preventDefault();

    let userMessage = chatPromptInput.value.trim();
    let currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!userMessage) return;

    // Salva a mensagem do usuário no histórico
    const userMessageHTML = `<div class="chat-message user-message">${userMessage}<span class="chat-time">${currentTime}</span></div>`;
    chatOutput.innerHTML += userMessageHTML;

    // Atualiza o localStorage com a mensagem do usuário
    savedMessages.push({ className: 'chat-message user-message', content: userMessage, time: currentTime });
    localStorage.setItem('chatHistory', JSON.stringify(savedMessages));

    chatPromptInput.value = '';

    showTypingIndicator();

    try {
      let contents = [
        {
          type: "text",
          text: `${context} Pergunta: ${userMessage}`
        }
      ];

      let stream = streamOpenAI({
        model: 'gpt-4o',
        contents,
      });

      let buffer = '';
      for await (let chunk of stream) {
        buffer += chunk;
      }

      const cleanedBuffer = buffer.replace(/^Resposta:\s*/, '');
      const responseHTML = `<div class="chat-message lia-message">${cleanedBuffer}<span class="chat-time">${currentTime}</span></div>`;

      if (isOutOfScope(cleanedBuffer)) {
        const outOfScopeMessage = `Sinto muito, ${userName}, não encontrei informações suficientes sobre "${userMessage}". Por favor, tente reformular sua pergunta ou pergunte sobre nossos serviços e empreendimentos.`;
        chatOutput.innerHTML += `<div class="chat-message lia-message">${outOfScopeMessage}</div>`;
        savedMessages.push({ className: 'chat-message lia-message', content: outOfScopeMessage, time: currentTime });
      } else {
        chatOutput.innerHTML += responseHTML;
        savedMessages.push({ className: 'chat-message lia-message', content: cleanedBuffer, time: currentTime });
      }

      // Salva a resposta da Lia no localStorage
      localStorage.setItem('chatHistory', JSON.stringify(savedMessages));
    } catch (e) {
      const errorHTML = `<div class="chat-message error-message">Erro: ${e}</div>`;
      chatOutput.innerHTML += errorHTML;
      savedMessages.push({ className: 'chat-message error-message', content: `Erro: ${e}`, time: currentTime });
      localStorage.setItem('chatHistory', JSON.stringify(savedMessages));
    } finally {
      hideTypingIndicator();
      chatOutput.scrollTop = chatOutput.scrollHeight;
    }
  };
}
