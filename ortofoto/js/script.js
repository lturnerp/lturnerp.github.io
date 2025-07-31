// --- CONFIGURACIÓN Y CONSTANTES ---
const ortofotosDisponibles = [
    { fecha: "30 cm", ruta: './teselas/{z}/{x}/{y}.png' },
    { fecha: "5.5 cm", ruta: './teselas_max/{z}/{x}/{y}.png' }
];
const coordenadasIniciales = [-23.763, -70.469];
const zoomInicial = 16;
const zoomMinimoMarcadores = 18;

// --- INICIALIZACIÓN DEL MAPA ---
const map = L.map('map', {
    attributionControl: false
}).setView(coordenadasIniciales, zoomInicial);
let ortofotoActual = null;
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxNativeZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

// --- CONTROLES DEL MAPA ---
const measureControl = new L.Control.Measure({ position: 'topleft', primaryLengthUnit: 'meters' });
measureControl.addTo(map);
window.oncontextmenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    return false;
};

// --- ELEMENTOS DEL DOM ---
const overlay = document.getElementById('iframe-overlay');
const iframeContainer = document.getElementById('iframe-content-container');
const closeModalBtn = document.getElementById('close-modal');
const newTabLink = document.getElementById('new-tab-link');
const timelineContainer = document.getElementById('timeline-container');

// --- GESTIÓN DE MARCADORES ---
let marcadoresEnMapa = [];

async function cargarMarcadores() {
    try {
        const response = await fetch('marcadores.json');
        if (!response.ok) throw new Error('No se pudo cargar marcadores.json');
        const marcadoresData = await response.json();
        crearIconosYMarcadores(marcadoresData);
    } catch (error) {
        console.error("Error al cargar los marcadores:", error);
    }
}

function crearIconosYMarcadores(data) {
    const colorPrincipal = '#100F2B';
    const colorAcento = '#AF9A6B';
    const customIcon = L.icon({
        iconUrl: `data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="34" height="34"><path d="M17,33 C17,33 5,21 5,13 A12,12 0 1,1 29,13 C29,21 17,33 17,33 Z" fill="${encodeURIComponent(colorAcento)}" stroke="${encodeURIComponent(colorPrincipal)}" stroke-width="2"/><circle cx="17" cy="13" r="5" fill="${encodeURIComponent(colorPrincipal)}"/></svg>`,
        iconSize: [34, 34], iconAnchor: [17, 33], popupAnchor: [0, -33]
    });

    data.forEach(marcadorData => {
        const marcador = L.marker(marcadorData.coordenadas, { icon: customIcon });
        const contenidoPopup = document.createElement('span');
        contenidoPopup.className = 'interactive-popup-link';
        contenidoPopup.textContent = marcadorData.popupTexto;
        contenidoPopup.onclick = () => manejarClickMarcador(marcadorData);
        marcador.bindPopup(contenidoPopup);
        marcador.bindTooltip(marcadorData.nombre, {
            permanent: true, direction: 'bottom', offset: [0, 0], className: 'marker-label'
        });
        marcadoresEnMapa.push(marcador);
    });

    map.on('zoomend', actualizarVisibilidadMarcadores);
    actualizarVisibilidadMarcadores();
}

function manejarClickMarcador(data) {
    if (data.usarIframe) {
        abrirModal(data);
    } else {
        window.open(data.linkNuevaPestana, '_blank');
    }
}

function actualizarVisibilidadMarcadores() {
    const zoomActual = map.getZoom();
    marcadoresEnMapa.forEach(marcador => {
        if (zoomActual >= zoomMinimoMarcadores) {
            if (!map.hasLayer(marcador)) marcador.addTo(map);
        } else {
            if (map.hasLayer(marcador)) marcador.removeFrom(map);
        }
    });
}

function ocultarTodosLosMarcadores() {
    marcadoresEnMapa.forEach(marcador => {
        if (map.hasLayer(marcador)) marcador.removeFrom(map);
    });
}

// --- GESTIÓN DEL MODAL (IFRAME) ---
function abrirModal(data) {
    const iframeHTML = `<iframe src="${data.iframeLink}" allow="fullscreen"></iframe>`;
    iframeContainer.innerHTML = iframeHTML;
    newTabLink.href = data.linkNuevaPestana;
    overlay.style.display = 'flex';
}

function cerrarModal() {
    overlay.style.display = 'none';
    iframeContainer.innerHTML = '';
}
closeModalBtn.onclick = cerrarModal;
overlay.onclick = (event) => { if (event.target === overlay) cerrarModal(); };

// --- GESTIÓN DE CAPAS (ORTOFOTOS) ---
function cargarOrtofoto(ruta, botonSeleccionado) {
    if (ortofotoActual) map.removeLayer(ortofotoActual);
    ortofotoActual = L.tileLayer(ruta, { minZoom: 15, maxZoom: 22, tms: false, attribution: 'REVER' }).addTo(map);
    document.querySelectorAll('.timeline-button').forEach(btn => btn.classList.remove('active'));
    botonSeleccionado.classList.add('active');
}

function inicializarLineaDeTiempo() {
    ortofotosDisponibles.forEach(orto => {
        const boton = document.createElement('button');
        boton.className = 'timeline-button';
        boton.textContent = orto.fecha;
        boton.onclick = () => cargarOrtofoto(orto.ruta, boton);
        timelineContainer.appendChild(boton);
    });
    if (ortofotosDisponibles.length > 0) {
        const primerBoton = timelineContainer.querySelector('.timeline-button');
        cargarOrtofoto(ortofotosDisponibles[0].ruta, primerBoton);
    }
}

// --- EVENTOS DEL MAPA ---
map.on('measurestart', ocultarTodosLosMarcadores);
map.on('measurefinish', actualizarVisibilidadMarcadores);

// --- INICIO DE LA APLICACIÓN ---
function iniciarApp() {
    inicializarLineaDeTiempo();
    cargarMarcadores();
}

iniciarApp();