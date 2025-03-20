import { streamOpenAI } from './openai-api.js';

let promptInput = document.querySelector('input[name="prompt"]');
let chatOutput = document.querySelector('#chat-content');
let typingIndicator = document.querySelector('.typing-indicator');
let chatForm = document.querySelector('#chat-form');

// Histórico do chat e nome do usuário
let savedMessages = JSON.parse(localStorage.getItem('chatHistory')) || [];
let userName = localStorage.getItem('userName') || '';
let hasGreeted = false;

const outOfScopePhrases = [
  "não posso responder",
  "não tenho certeza",
  "não sei",
  "não encontrei",
  "fora do escopo",
  "não posso ajudar"
];

// Variáveis para o fluxo LGPD via chat
let capturingLead = false;
let leadCaptured = false; // Indica se os dados já foram coletados
let leadData = { nome: '', telefone: '', email: '' };

let context = '';
async function updateContext() {
  // Caso já tenha seu endpoint /api/site-content, ele retorna o conteúdo do site
  let response = await fetch('/api/site-content');
  let data = await response.json();
  context = `Você é uma assistente virtual da Construtora Stein chamada Lia. Responda as perguntas usando as seguintes informações tiradas deste site: ${data.content}. Sempre que fornecer links, formate-os como hyperlinks clicáveis usando HTML. Seja breve, direta e objetiva com as tuas respostas, sem enrolação.`;
}
updateContext();

function renderMessage(html) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  chatOutput.appendChild(tempDiv);
  chatOutput.scrollTop = chatOutput.scrollHeight;
}

function salvarMensagem(className, content, time) {
  savedMessages.push({ className, content, time });
  localStorage.setItem('chatHistory', JSON.stringify(savedMessages));
}

function showTypingIndicator() {
  typingIndicator.style.display = 'block';
}

function hideTypingIndicator() {
  typingIndicator.style.display = 'none';
}

function isOutOfScope(response) {
  return outOfScopePhrases.some(phrase => response.toLowerCase().includes(phrase));
}

// Renderiza histórico salvo
if (savedMessages.length) {
  savedMessages.forEach((message) => {
    chatOutput.innerHTML += `<div class="${message.className}">${message.content}<span class="chat-time">${message.time}</span></div>`;
  });
}

// Função para salvar o lead no back-end
async function saveLead(leadData) {
  try {
    let response = await fetch('/api/save-lead', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(leadData)
    });
    let data = await response.json();
    console.log("Lead salvo com sucesso:", data);
  } catch (e) {
    console.error("Erro ao salvar lead:", e);
  }
}

/*
Fluxo de Captura LGPD via Chat:
Após a primeira mensagem do usuário, se o lead ainda não foi capturado,
a Lia pergunta se o usuário autoriza a coleta de dados conforme a LGPD.
Se o usuário responder "aceito", inicia a coleta dos dados (nome, telefone, e-mail).
*/
function iniciarCapturaLead() {
  if (leadCaptured) return;
  capturingLead = true;
  renderMessage(`<div class="chat-message lia-message">Para que eu possa te ajudar de forma personalizada, preciso coletar alguns dados. Seus dados serão usados somente para contato e estão protegidos conforme a LGPD. Você autoriza o uso dos seus dados? Responda "Sim" para prosseguir. Se não quiser responda "Não".</div>`);
}

// Variável extra para sinalizar recusa
let leadRejected = false;

chatForm.onsubmit = async (ev) => {
  ev.preventDefault();
  let userMessage = promptInput.value.trim();
  if (!userMessage) return;

  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  renderMessage(`<div class="chat-message user-message">${userMessage}<span class="chat-time">${currentTime}</span></div>`);
  salvarMensagem('chat-message user-message', userMessage, currentTime);
  promptInput.value = '';

  // Se estiver no fluxo de captura de lead via chat:
  if (capturingLead) {
    // Se o usuário autorizou (responde "aceito")
    if (!leadData.nome && userMessage.toLowerCase().includes("sim")) {
      renderMessage(`<div class="chat-message lia-message">Ótimo! Por favor, informe seu Nome:</div>`);
      return;
    }
    // Se o usuário indicar que NÃO aceita (ex.: "não", "recuso", etc.)
    if (!leadData.nome && (userMessage.toLowerCase().includes("nao") || userMessage.toLowerCase().includes("não"))) {
      renderMessage(`<div class="chat-message lia-message">Tudo bem, continuaremos nossa conversa sem coletar seus dados.</div>`);
      capturingLead = false; // Encerra o fluxo de captura
      leadRejected = true;   // Sinaliza que o usuário recusou
      // Prossegue com a conversa normalmente (sem reiniciar o fluxo)
    }

    // Se o fluxo continuar e o usuário tiver autorizado:
    if (capturingLead && !leadData.nome) {
      leadData.nome = userMessage;
      renderMessage(`<div class="chat-message lia-message">Obrigado, ${leadData.nome}. Agora, por favor, informe seu Telefone:</div>`);
      return;
    }
    if (capturingLead && !leadData.telefone) {
      leadData.telefone = userMessage;
      renderMessage(`<div class="chat-message lia-message">Ótimo! Por fim, informe seu E-mail:</div>`);
      return;
    }
    if (capturingLead && !leadData.email) {
      leadData.email = userMessage;
      renderMessage(`<div class="chat-message lia-message">Obrigado pelas informações, ${leadData.nome}! Seus dados foram registrados. Como posso te ajudar hoje?</div>`);
      await saveLead(leadData);
      leadCaptured = true;
      capturingLead = false;
      return;
    }
  }

  // Se não estiver no fluxo LGPD, integra a chamada à API do OpenAI:
  try {
    showTypingIndicator();
    let contents = [
      {
        type: "text",
        text: `${context} Pergunta: ${userMessage}`
      }
    ];
    let stream = streamOpenAI({
      model: 'gpt-3.5-turbo',
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
      renderMessage(`<div class="chat-message lia-message">${outOfScopeMessage}</div>`);
      salvarMensagem('chat-message lia-message', outOfScopeMessage, currentTime);
    } else {
      renderMessage(responseHTML);
      salvarMensagem('chat-message lia-message', cleanedBuffer, currentTime);
    }
  } catch (e) {
    let errorHTML = `<div class="chat-message error-message">Erro: ${e}</div>`;
    renderMessage(errorHTML);
    salvarMensagem('chat-message error-message', `Erro: ${e}`, currentTime);
  } finally {
    hideTypingIndicator();
    chatOutput.scrollTop = chatOutput.scrollHeight;
  }

  // Após a interação, se o lead não foi capturado e o usuário não recusou, inicia o fluxo LGPD.
  if (!leadCaptured && !capturingLead && !leadRejected) {
    iniciarCapturaLead();
  }
};
