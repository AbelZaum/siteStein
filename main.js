import { streamGemini } from './gemini-api.js';

// Selecionando os elementos
let mainForm = document.querySelector('form');
let promptInput = document.querySelector('input[name="prompt"]');
let output = document.querySelector('.output');
let typingIndicator = document.querySelector('.typing-indicator');

let context = '';
let userName = '';  // Variável para armazenar o nome do usuário
let hasGreeted = false; // Controla se a saudação inicial já foi feita

// Frases comuns de respostas fora do escopo
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

// Função para atualizar o contexto do assistente Lia
async function updateContext() {
  let siteContent = await fetchSiteContent();
  context = `Você é um assistente virtual da Construtora Stein chamado Lia. Responda as perguntas usando as seguintes informações tiradas deste site: ${siteContent}`;
}

updateContext();

// Função para mostrar o indicador de digitação
function showTypingIndicator() {
  typingIndicator.style.display = 'block';
}

function hideTypingIndicator() {
  typingIndicator.style.display = 'none';
}

// Função para verificar se a resposta está fora do escopo
function isOutOfScope(response) {
  return outOfScopePhrases.some(phrase => response.toLowerCase().includes(phrase));
}

// Função para submeter o formulário principal
mainForm.onsubmit = async (ev) => {
  ev.preventDefault();

  showTypingIndicator();

  // Se a saudação inicial não foi feita, perguntar o nome
  if (!hasGreeted) {
    output.innerHTML = '<div class="chat-message lia-message">Olá! Qual é o seu nome?</div>';
    hasGreeted = true; // Marca como saudação feita
    hideTypingIndicator();
    return;
  }

  // Se o nome do usuário ainda não foi capturado, capturar o nome e continuar a interação
  if (!userName) {
    userName = promptInput.value.trim(); // Captura o nome inserido pelo usuário
    if (userName) {
      output.innerHTML = `<div class="chat-message lia-message">Prazer em conhecê-lo, ${userName}! Como posso te ajudar hoje?</div>`;
      hideTypingIndicator();
      promptInput.value = ''; // Limpa o campo de input
    } else {
      output.innerHTML = '<div class="chat-message lia-message">Por favor, me diga seu nome para que eu possa te ajudar melhor.</div>';
      hideTypingIndicator();
    }
    return;
  }

  try {
    let contents = [
      {
        type: "text",
        text: `${context} Pergunta: ${userQuestion}`
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

    const cleanedBuffer = buffer.replace(/^Resposta:\s*/, ''); // Remove o prefixo "Resposta:"

    // Verifica se a resposta está fora do escopo
    if (isOutOfScope(cleanedBuffer)) {
      output.innerHTML = `<div class="chat-message lia-message">Sinto muito, ${userName}, não encontrei informações suficientes para responder a sua pergunta. Por favor, tente reformular ou pergunte sobre nossos serviços e empreendimentos.</div>`;
    } else {
      output.innerHTML = `<div class="chat-message lia-message">${cleanedBuffer}</div>`;
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
    let currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!userMessage) return; // Evita enviar mensagens vazias

    // Adiciona a mensagem do usuário ao chat
    chatOutput.innerHTML += `<div class="chat-message user-message">${userMessage}<span class="chat-time">${currentTime}</span></div>`;
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

      const cleanedBuffer = buffer.replace(/^Resposta:\s*/, ''); // Remove o prefixo "Resposta:"

      // Verifica se a resposta está fora do escopo
      if (isOutOfScope(cleanedBuffer)) {
        chatOutput.innerHTML += `<div class="chat-message lia-message">Sinto muito, ${userName}, não encontrei informações suficientes sobre "${userMessage}". Por favor, tente reformular sua pergunta ou pergunte sobre nossos serviços e empreendimentos.</div>`;
      } else {
        chatOutput.innerHTML += `<div class="chat-message lia-message">${cleanedBuffer}<span class="chat-time">${currentTime}</span></div>`;
      }
    } catch (e) {
      chatOutput.innerHTML += `<div class="chat-message error-message">Erro: ${e}</div>`;
    } finally {
      hideTypingIndicator();
      chatOutput.scrollTop = chatOutput.scrollHeight; // Rola o chat para o final
    }
  };
}
