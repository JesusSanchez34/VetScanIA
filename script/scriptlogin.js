// Función para mostrar mensajes en el contenedor del formulario
function mostrarMensaje(texto, esExito = false) {
    const mensajeElement = document.getElementById('form-message');
    mensajeElement.textContent = texto;
    mensajeElement.className = esExito ? 'success' : 'error';
    mensajeElement.style.display = 'block';

    // Ocultar después de cierto tiempo
    setTimeout(() => {
        mensajeElement.style.opacity = '0';
        setTimeout(() => {
            mensajeElement.style.display = 'none';
            mensajeElement.style.opacity = '1';
        }, 300);
    }, esExito ? 3000 : 5000);
}

// Validar contraseña con política de seguridad mejorada
function validarContraseña(pass) {
    const mayusculas = pass.match(/[A-Z]/g) || [];
    const minusculas = pass.match(/[a-z]/g) || [];
    const numeros = pass.match(/[0-9]/g) || [];
    const simbolos = pass.match(/[^A-Za-z0-9]/g) || [];

    // Actualizar los requisitos visuales
    updateRequirement('length', pass.length >= 10);
    updateRequirement('uppercase', mayusculas.length >= 3);
    updateRequirement('number', numeros.length >= 2);
    updateRequirement('symbol', simbolos.length >= 1);

    return (
        pass.length >= 10 &&
        mayusculas.length >= 3 &&
        numeros.length >= 2 &&
        simbolos.length >= 1
    );
}

// Actualizar la barra de fortaleza de la contraseña
function updatePasswordStrength(password) {
    const strengthBar = document.getElementById('passwordStrength');
    let strength = 0;
    
    // Longitud
    if (password.length >= 10) strength += 25;
    // Mayúsculas
    if ((password.match(/[A-Z]/g) || []).length >= 3) strength += 25;
    // Números
    if ((password.match(/[0-9]/g) || []).length >= 2) strength += 25;
    // Símbolos
    if ((password.match(/[^A-Za-z0-9]/g) || []).length >= 1) strength += 25;
    
    strengthBar.style.width = `${strength}%`;
    strengthBar.style.backgroundColor = strength < 50 ? '#f72585' : 
                                       strength < 75 ? '#4895ef' : '#4cc9f0';
}

// Actualizar requisitos visuales
function updateRequirement(type, isValid) {
    const elements = document.querySelectorAll(`[data-requirement="${type}"]`);
    elements.forEach(el => {
        if (isValid) {
            el.classList.add('valid');
        } else {
            el.classList.remove('valid');
        }
    });
}

// Generar ID único para el usuario
function generarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Registro del formulario con LocalStorage
document.getElementById("registerForm").addEventListener("submit", function (e) {
    e.preventDefault();
    
    // Obtener valores del formulario
    const primerNombre = document.getElementById("primerNombre").value.trim();
    const apellido = document.getElementById("apellido").value.trim();
    const fechaNacimiento = document.getElementById("fechaNacimiento").value;
    const pais = document.getElementById("pais").value;
    const emailPersonal = document.getElementById("emailPersonal").value.trim();
    const nickname = document.getElementById("nickname").value.trim();
    const claveSegura = document.getElementById("claveSegura").value;
    const confirmarClave = document.getElementById("confirmarClave").value;
    const terminos = document.getElementById("terminos").checked;

    // Validación básica de campos vacíos
    if (!primerNombre || !apellido || !fechaNacimiento || !pais || !emailPersonal || !nickname || !claveSegura || !confirmarClave) {
        mostrarMensaje("Todos los campos son obligatorios");
        return;
    }

    if (!terminos) {
        mostrarMensaje("Debes aceptar los términos y condiciones");
        return;
    }

    if (claveSegura !== confirmarClave) {
        mostrarMensaje("Las contraseñas no coinciden");
        return;
    }

    if (!validarContraseña(claveSegura)) {
        mostrarMensaje("La contraseña no cumple con los requisitos de seguridad");
        return;
    }

    // Verificar si el correo o nickname ya existen
    const usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
    const emailExiste = usuarios.some(user => user.email === emailPersonal);
    const nicknameExiste = usuarios.some(user => user.nickname === nickname);

    if (emailExiste) {
        mostrarMensaje("Este correo electrónico ya está registrado");
        return;
    }

    if (nicknameExiste) {
        mostrarMensaje("Este nombre de usuario ya está en uso");
        return;
    }

    // Crear objeto de usuario
    const nuevoUsuario = {
        id: generarId(),
        primerNombre,
        apellido,
        fechaNacimiento,
        pais,
        email: emailPersonal,
        nickname,
        password: claveSegura, // En una aplicación real, deberías hashear la contraseña
        fechaRegistro: new Date().toISOString()
    };

    // Guardar en LocalStorage
    usuarios.push(nuevoUsuario);
    localStorage.setItem('usuarios', JSON.stringify(usuarios));

    // Mostrar mensaje de éxito
    mostrarMensaje("¡Registro exitoso! Tu cuenta ha sido creada", true);

    // Limpiar formulario
    document.getElementById("registerForm").reset();
    document.getElementById('passwordStrength').style.width = '0%';

    // Redireccionar después de 2 segundos
    setTimeout(() => {
        window.location.href = "bienvenida.html";
    }, 2000);
});

// Validación visual de contraseña en tiempo real
document.getElementById("claveSegura").addEventListener("input", (e) => {
    const password = e.target.value;
    updatePasswordStrength(password);
});

// Validación de confirmación de contraseña en tiempo real
document.getElementById("confirmarClave").addEventListener("input", (e) => {
    const confirmacion = e.target.value;
    const password = document.getElementById("claveSegura").value;
    
    if (confirmacion && password !== confirmacion) {
        e.target.style.borderColor = '#f72585';
    } else {
        e.target.style.borderColor = '#e9ecef';
    }
});

// Cargar países desde una API (opcional)
window.addEventListener('DOMContentLoaded', () => {
    // Animación inicial de los campos
    const formGroups = document.querySelectorAll('.form-group');
    formGroups.forEach((group, index) => {
        group.style.animationDelay = `${0.1 + index * 0.1}s`;
    });
    
    // Podrías cargar dinámicamente los países aquí si lo deseas
    // fetch('https://restcountries.com/v3.1/all')
    // .then(response => response.json())
    // .then(data => {
    //     const select = document.getElementById('pais');
    //     data.sort((a, b) => a.name.common.localeCompare(b.name.common))
    //        .forEach(country => {
    //            const option = document.createElement('option');
    //            option.value = country.cca2.toLowerCase();
    //            option.textContent = country.name.common;
    //            select.appendChild(option);
    //        });
    // });
});