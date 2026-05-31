// ✅ URL de tu servidor en Google Apps Script integrada con éxito
const API_URL = "https://script.google.com/macros/s/AKfycbyrRlISUJrOg2QJni11mv0_1UaAuH-14jggG5pw_rN1_1z9N2ezYgi8XKEgz__I_A1n/exec";

// ✅ LOGO OFICIAL
const LOGO = "logo.png";

// ✅ Banco de preguntas y respuestas
const FICHAS_BASE = [
    { encabezado: "Momento", texto: "Antes de tocar al paciente", correcta: true },
    { encabezado: "Momento", texto: "Antes de procedimiento aséptico", correcta: true },
    { encabezado: "Momento", texto: "Después de exposición a fluidos", correcta: true },
    { encabezado: "Momento", texto: "Después del contacto con el paciente", correcta: true },
    { encabezado: "Momento", texto: "Después del entorno del paciente", correcta: true },
    { encabezado: "Momento", texto: "No lavarse después de retirar guantes", correcta: false },
    { encabezado: "Momento", texto: "No higiene antes de tocar paciente", correcta: false },
    { encabezado: "Momento", texto: "Solo lavarse al inicio del turno", correcta: false },
    { encabezado: "Momento", texto: "No lavarse después del entorno del paciente", correcta: false },
    { encabezado: "Momento", texto: "Reemplazar higiene por uso de guantes", correcta: false }
];

// 🔄 Estado interno de la aplicación encapsulado
const Estado = {
    nombre: "",
    enJuego: false,
    fichas: [],
    index: 0,
    puntaje: 0,
    ranking: []
};

// Selectores fijos del DOM
const $app = document.getElementById("app");
const $tmpInicio = document.getElementById("tmp-inicio");
const $tmpJuego = document.getElementById("tmp-juego");

// Mezclador matemático Fisher-Yates (Aleatoriedad óptima)
const mezclarFichas = (array) => {
    const copia = [...array];
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
};

// 🌐 --- MOTOR DE CONEXIÓN BIDIRECCIONAL (JSONP) ---
const peticionJSONP = (url) => {
    return new Promise((resolve, reject) => {
        const nombreCallback = "jsonp_" + Math.random().toString(36).substr(2, 9);
        
        window[nombreCallback] = (data) => {
            resolve(data);
            idScript.remove();
            delete window[nombreCallback];
        };

        const idScript = document.createElement("script");
        // Se añade el callback y un timestamp para evitar almacenamiento en caché del navegador
        idScript.src = `${url}&callback=${nombreCallback}&_=${new Date().getTime()}`;
        
        idScript.onerror = () => {
            reject(new Error("Error de conexión de red con Google Sheets."));
            idScript.remove();
            delete window[nombreCallback];
        };

        document.body.appendChild(idScript);
    });
};

// 📊 --- ACCIONES DE LA API ---

const cargarRanking = async () => {
    try {
        const data = await peticionJSONP(`${API_URL}?action=read`);
        if (Array.isArray(data)) {
            // Ordenar el ranking de mayor a menor puntaje de forma estricta
            Estado.ranking = data.sort((a, b) => b.puntaje - a.puntaje);
            actualizarVistaRanking();
        }
    } catch (error) {
        console.warn("Ejecutando en modo local. No se pudo sincronizar el ranking remoto.");
    }
};

const guardarResultado = async (nombre, puntaje) => {
    try {
        const nombreCodificado = encodeURIComponent(nombre);
        const urlGuardar = `${API_URL}?action=save&nombre=${nombreCodificado}&puntaje=${puntaje}`;
        
        console.log("Enviando resultados a la hoja de cálculo...");
        await peticionJSONP(urlGuardar);
        console.log("¡Datos registrados con éxito!");
    } catch (error) {
        console.error("No se pudo completar el guardado en Google Sheets:", error);
    }
};

// 🎮 --- MECÁNICAS INTERNAS DEL JUEGO ---

const iniciarJuego = () => {
    const inputNombre = document.getElementById("input-nombre");
    const nombreValido = inputNombre?.value.trim();

    if (!nombreValido) {
        alert("¡Por favor ingresa tu nombre para poder registrarte en el ranking!");
        return;
    }

    Estado.nombre = nombreValido;
    Estado.fichas = mezclarFichas(FICHAS_BASE);
    Estado.index = 0;
    Estado.puntaje = 0;
    Estado.enJuego = true;

    render();
};

const procesarRespuesta = (clickeadoCorrecto) => {
    const fichaActual = Estado.fichas[Estado.index];

    if (clickeadoCorrecto === fichaActual.correcta) {
        Estado.puntaje += fichaActual.encabezado.includes("CRÍTICO") ? 20 : 10;
    }

    if (Estado.index + 1 < Estado.fichas.length) {
        Estado.index++;
        render();
    } else {
        finalizarJuego();
    }
};

const finalizarJuego = async () => {
    const puntajeFinal = Estado.puntaje;
    const nombreJugador = Estado.nombre;
    
    Estado.enJuego = false;
    render(); // Redibuja el menú primero para evitar bloqueos visuales mientras procesa el alert
    
    alert(`🎉 ¡Juego terminado, ${nombreJugador}! Tu puntaje final es: ${puntajeFinal}`);
    
    // Guarda los datos asíncronamente y recarga el ranking inmediatamente después
    await guardarResultado(nombreJugador, puntajeFinal);
    cargarRanking();
};

// 🏛️ --- RENDERIZADO ASÍNCRONO DEL DOM ---

const actualizarVistaRanking = () => {
    const $lista = document.getElementById("lista-ranking");
    if (!$lista) return;

    if (Estado.ranking.length === 0) {
        $lista.innerHTML = `<p class="cargando">Buscando jugadores en vivo...</p>`;
        return;
    }

    // Tomamos únicamente el Top 10 para evitar sobrecargar la vista
    $lista.innerHTML = Estado.ranking
        .slice(0, 10)
        .map((jugador, i) => `
            <div class="item-ranking">
                <span><strong>${i + 1}.</strong> ${jugador.nombre}</span>
                <span>${jugador.puntaje} pts</span>
            </div>
        `).join("");
};

const render = () => {
    $app.innerHTML = ""; // Limpieza profunda del contenedor

    if (!Estado.enJuego) {
        // Renderizar la Pantalla de Bienvenida / Tabla de posiciones
        const clon = $tmpInicio.content.cloneNode(true);
        clon.querySelector(".js-logo").src = LOGO;
        
        const input = clon.querySelector("#input-nombre");
        input.value = Estado.nombre; // Mantiene el nombre si decide jugar otra ronda

        clon.querySelector("#btn-iniciar").addEventListener("click", iniciarJuego);
        $app.appendChild(clon);
        
        actualizarVistaRanking();
    } else {
        // Renderizar la Interfaz de Juego Activo
        const clon = $tmpJuego.content.cloneNode(true);
        const ficha = Estado.fichas[Estado.index];

        clon.querySelector(".js-logo").src = LOGO;
        clon.querySelector("#ficha-encabezado").textContent = ficha.encabezado;
        clon.querySelector("#ficha-texto").textContent = ficha.texto;
        clon.querySelector("#puntaje-actual").textContent = Estado.puntaje;

        // Delegación de eventos para capturar las respuestas (Correcto / Incorrecto)
        clon.querySelector(".contenedor-botones").addEventListener("click", (e) => {
            const boton = e.target.closest("button");
            if (!boton) return;
            const respuestaBooleana = boton.dataset.respuesta === "true";
            procesarRespuesta(respuestaBooleana);
        });

        $app.appendChild(clon);
    }
};

// 🚀 --- INICIALIZACIÓN AUTOMÁTICA AL CARGAR LA PÁGINA ---
document.addEventListener("DOMContentLoaded", () => {
    render();
    cargarRanking();
    // Consulta la hoja de cálculo automáticamente cada 5 segundos para mantener el ranking al día
    setInterval(cargarRanking, 5000);
});