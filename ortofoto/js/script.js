const ortofotosDisponibles = [
    { fecha: "30 cm", ruta: './teselas/{z}/{x}/{y}.png' },
    { fecha: "5.5 cm", ruta: './teselas_max/{z}/{x}/{y}.png' }
];
const coordenadasIniciales = [-23.763, -70.469];
const zoomInicial = 16;
const zoomMinimoMarcadores = 18;

let mapaIzquierdo, mapaDerecho;
let capaOrtofotoIzquierda, capaOrtofotoDerecha;
let vistaDivididaActiva = false;
let datosOrtoActivaIzquierda;
let datosGlobalesMarcadores = [];

const mapContainer = document.getElementById('map');
const timelineContainer = document.getElementById('timeline-container');
const overlay = document.getElementById('iframe-overlay');
const iframeContainer = document.getElementById('iframe-content-container');
const closeModalBtn = document.getElementById('close-modal');
const newTabLink = document.getElementById('new-tab-link');
const contextMenu = document.getElementById('custom-context-menu');
const splitViewOption = document.getElementById('split-view-option');



function inicializarMapaPrincipal() {
    const containerIzquierdo = document.createElement('div');
    containerIzquierdo.id = 'mapa-izquierda-container';
    containerIzquierdo.className = 'map-container';
    mapContainer.appendChild(containerIzquierdo);

    mapaIzquierdo = L.map(containerIzquierdo.id, {
        attributionControl: false,
        zoomControl: false
    }).setView(coordenadasIniciales, zoomInicial);

    L.control.zoom({ position: 'topleft' }).addTo(mapaIzquierdo);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxNativeZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapaIzquierdo);
    
    agregarControlDeMedida(mapaIzquierdo);

    window.oncontextmenu = (event) => {
        if (!event.target.classList.contains('timeline-button')) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
    };
}

function agregarControlDeMedida(mapa) {
    const measureControl = new L.Control.Measure({ position: 'topleft', primaryLengthUnit: 'meters' });
    measureControl.addTo(mapa);
    mapa.on('measurestart', () => ocultarTodosLosMarcadores(mapa));
    mapa.on('measurefinish', () => actualizarVisibilidadMarcadores(mapa));
}



function activarVistaDividida(datosOrtoDerecha) {
    if (vistaDivididaActiva) return;
    vistaDivididaActiva = true;

    mapContainer.classList.add('split-view');

    const containerDerecho = document.createElement('div');
    containerDerecho.id = 'mapa-derecha-container';
    containerDerecho.className = 'map-container';
    mapContainer.appendChild(containerDerecho);

    mapaDerecho = L.map(containerDerecho.id, {
        attributionControl: false,
        zoomControl: false
    }).setView(mapaIzquierdo.getCenter(), mapaIzquierdo.getZoom());

    L.control.zoom({ position: 'topleft' }).addTo(mapaDerecho);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxNativeZoom: 19 }).addTo(mapaDerecho);
    
    capaOrtofotoDerecha = L.tileLayer(datosOrtoDerecha.ruta, { minZoom: 15, maxZoom: 22, tms: false }).addTo(mapaDerecho);
    agregarControlDeMedida(mapaDerecho);
    renderizarMarcadoresParaMapa(mapaDerecho, datosGlobalesMarcadores);
    
    mapaIzquierdo.invalidateSize();
    mapaDerecho.invalidateSize();

    crearSuperposicionMapa(mapaIzquierdo, datosOrtoActivaIzquierda, 'izquierda');
    crearSuperposicionMapa(mapaDerecho, datosOrtoDerecha, 'derecha');

    mapaIzquierdo.on('move zoom', sincronizarMapas);
    mapaDerecho.on('move zoom', sincronizarMapas);
}


function inicializarLineaDeTiempo() {
    ortofotosDisponibles.forEach(orto => {
        const boton = document.createElement('button');
        boton.className = 'timeline-button';
        boton.textContent = orto.fecha;

        boton.onclick = () => {
            if (vistaDivididaActiva) {
                alert("Para cambiar de mapa, primero cierre la vista dividida usando la 'x'.");
            } else {
                cargarOrtofoto(orto, boton);
            }
        };

        boton.oncontextmenu = (e) => {
            e.preventDefault();
            if (vistaDivididaActiva || boton.classList.contains('active')) return;
            const topPosition = e.pageY - 10;
            const leftPosition = e.pageX;

            contextMenu.style.display = 'block';
            contextMenu.style.top = `${topPosition}px`;
            contextMenu.style.left = `${leftPosition}px`;

            splitViewOption.onclick = () => {
                contextMenu.style.display = 'none';
                activarVistaDividida(orto);
            };
        };
        timelineContainer.appendChild(boton);
    });

    document.addEventListener('click', () => { if (contextMenu.style.display === 'block') contextMenu.style.display = 'none'; });
    if (ortofotosDisponibles.length > 0) cargarOrtofoto(ortofotosDisponibles[0], timelineContainer.querySelector('.timeline-button'));
}


function desactivarVistaDividida(ladoACerrar) {
    mapaIzquierdo.off('move zoom', sincronizarMapas);
    if (mapaDerecho) mapaDerecho.off('move zoom', sincronizarMapas);

    const contenedorAEliminar = document.getElementById(`mapa-${ladoACerrar}-container`);
    const mapaAEliminar = (ladoACerrar === 'izquierda') ? mapaIzquierdo : mapaDerecho;
    const mapaQueQueda = (ladoACerrar === 'izquierda') ? mapaDerecho : mapaIzquierdo;
    const datosOrtoQueQueda = (ladoACerrar === 'izquierda') ? JSON.parse(document.getElementById('mapa-derecha-container').dataset.orto) : datosOrtoActivaIzquierda;

    if (mapaAEliminar) mapaAEliminar.remove();
    if (contenedorAEliminar) contenedorAEliminar.remove();
    
    mapContainer.classList.remove('split-view');
    mapaIzquierdo = mapaQueQueda;
    mapaDerecho = null;
    datosOrtoActivaIzquierda = datosOrtoQueQueda;
    
    mapaIzquierdo.getContainer().id = 'mapa-izquierda-container';

    document.querySelectorAll('.timeline-button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent === datosOrtoActivaIzquierda.fecha) btn.classList.add('active');
    });

    mapaIzquierdo.invalidateSize();

    const overlayExistente = mapaIzquierdo.getContainer().querySelector('.map-overlay');
    if (overlayExistente) overlayExistente.remove();

    vistaDivididaActiva = false;
}

function sincronizarMapas(e) {
    const mapaIniciador = e.target;
    const mapaReceptor = (mapaIniciador === mapaIzquierdo) ? mapaDerecho : mapaIzquierdo;
    if (!mapaReceptor) return;

    mapaReceptor.off('move zoom', sincronizarMapas);
    mapaReceptor.setView(mapaIniciador.getCenter(), mapaIniciador.getZoom(), { animate: false });
    setTimeout(() => { mapaReceptor.on('move zoom', sincronizarMapas); }, 100);
}

function cargarOrtofoto(datosOrto, botonSeleccionado) {
    if (capaOrtofotoIzquierda) mapaIzquierdo.removeLayer(capaOrtofotoIzquierda);
    capaOrtofotoIzquierda = L.tileLayer(datosOrto.ruta, { minZoom: 15, maxZoom: 22, tms: false, attribution: 'REVER' }).addTo(mapaIzquierdo);
    datosOrtoActivaIzquierda = datosOrto;
    document.querySelectorAll('.timeline-button').forEach(btn => btn.classList.remove('active'));
    botonSeleccionado.classList.add('active');
}

async function cargarDatosDeMarcadores() {
    try {
        const response = await fetch('marcadores.json');
        if (!response.ok) throw new Error('No se pudo cargar marcadores.json');
        datosGlobalesMarcadores = await response.json();
    } catch (error) {
        console.error("Error al cargar los marcadores:", error);
    }
}

function renderizarMarcadoresParaMapa(mapa, datosMarcadores) {
    mapa.misMarcadores = [];
    const colorPrincipal = '#100F2B';
    const colorAcento = '#AF9A6B';
    const customIcon = L.icon({
        iconUrl: `data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="34" height="34"><path d="M17,33 C17,33 5,21 5,13 A12,12 0 1,1 29,13 C29,21 17,33 17,33 Z" fill="${encodeURIComponent(colorAcento)}" stroke="${encodeURIComponent(colorPrincipal)}" stroke-width="2"/><circle cx="17" cy="13" r="5" fill="${encodeURIComponent(colorPrincipal)}"/></svg>`,
        iconSize: [34, 34], iconAnchor: [17, 33], popupAnchor: [0, -33]
    });
    datosMarcadores.forEach(marcadorData => {
        const marcador = L.marker(marcadorData.coordenadas, { icon: customIcon });
        const contenidoPopup = document.createElement('span');
        contenidoPopup.className = 'interactive-popup-link';
        contenidoPopup.textContent = marcadorData.popupTexto;
        contenidoPopup.onclick = () => manejarClickMarcador(marcadorData);
        marcador.bindPopup(contenidoPopup);
        marcador.bindTooltip(marcadorData.nombre, { permanent: true, direction: 'bottom', offset: [0, 0], className: 'marker-label' });
        mapa.misMarcadores.push(marcador);
    });
    mapa.on('zoomend', () => actualizarVisibilidadMarcadores(mapa));
    actualizarVisibilidadMarcadores(mapa);
}

function actualizarVisibilidadMarcadores(mapa) {
    if (!mapa || !mapa.misMarcadores) return;
    const zoomActual = mapa.getZoom();
    mapa.misMarcadores.forEach(marcador => {
        if (zoomActual >= zoomMinimoMarcadores) {
            if (!mapa.hasLayer(marcador)) marcador.addTo(mapa);
        } else {
            if (mapa.hasLayer(marcador)) marcador.removeFrom(mapa);
        }
    });
}

function ocultarTodosLosMarcadores(mapa) {
    if (!mapa || !mapa.misMarcadores) return;
    mapa.misMarcadores.forEach(marcador => {
        if (mapa.hasLayer(marcador)) marcador.removeFrom(mapa);
    });
}

function manejarClickMarcador(data) {
    if (data.usarIframe) abrirModal(data);
    else window.open(data.linkNuevaPestana, '_blank');
}

function crearSuperposicionMapa(mapa, datosOrto, lado) {
    const container = mapa.getContainer();
    container.dataset.orto = JSON.stringify(datosOrto);
    const overlayDiv = document.createElement('div');
    overlayDiv.className = 'map-overlay';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'map-name';
    nameSpan.textContent = datosOrto.fecha;
    const closeButton = document.createElement('span');
    closeButton.className = 'map-close-button';
    closeButton.innerHTML = '×';
    closeButton.onclick = () => desactivarVistaDividida(lado);
    overlayDiv.appendChild(nameSpan);
    overlayDiv.appendChild(closeButton);
    container.appendChild(overlayDiv);
}

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

async function iniciarApp() {
    inicializarMapaPrincipal();
    inicializarLineaDeTiempo();
    await cargarDatosDeMarcadores();
    if (datosGlobalesMarcadores.length > 0) {
        renderizarMarcadoresParaMapa(mapaIzquierdo, datosGlobalesMarcadores);
    }
}

iniciarApp();