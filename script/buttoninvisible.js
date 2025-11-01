// Verificar posición del botón al hacer scroll
window.addEventListener('scroll', function() {
  const assistantBtn = document.getElementById('chatbot-button');
  const footer = document.querySelector('.footer');
  const footerPosition = footer.getBoundingClientRect().top;
  const screenPosition = window.innerHeight / 1.5;

  if (footerPosition < screenPosition) {
    assistantBtn.classList.add('hide-assistant');
  } else {
    assistantBtn.classList.remove('hide-assistant');
  }
});

// Asegurar que el chat también sea responsivo
function adjustChatSize() {
  const chatContainer = document.getElementById('chatbot-container');
  if (window.innerWidth < 576) {
    chatContainer.style.width = '90%';
    chatContainer.style.right = '5%';
  } else {
    chatContainer.style.width = '350px';
    chatContainer.style.right = '30px';
  }
}

window.addEventListener('resize', adjustChatSize);

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', function() {
  adjustChatSize();
  
  // Control del chatbot
  document.getElementById('chatbot-button').addEventListener('click', function() {
    document.getElementById('chatbot-container').classList.add('active');
  });

  document.getElementById('close-chat').addEventListener('click', function() {
    document.getElementById('chatbot-container').classList.remove('active');
  });

  document.getElementById('open-chat').addEventListener('click', function() {
    document.getElementById('chatbot-container').classList.add('active');
  });
});