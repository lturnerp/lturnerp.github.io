// script.js (versión final corregida)

const coordenadasIniciales = [-23.763, -70.469];
const zoomInicial = 16;
const zoomMinimoMarcadores = 18;

let ortofotosDisponibles = [];
let mapaIzquierdo, mapaDerecho;
let vistaDivididaActiva = false;
let datosOrtoActivaIzquierda;
let datosGlobalesMarcadores = [];
let splitViewControl; // Variable global para el control de vista dividida

const mapContainer = document.getElementById('map');
const timelineContainer = document.getElementById('timeline-container');
const overlay = document.getElementById('iframe-overlay');
const iframeContainer = document.getElementById('iframe-content-container');
const closeModalBtn = document.getElementById('close-modal');
const newTabLink = document.getElementById('new-tab-link');
const contextMenu = document.getElementById('custom-context-menu');
const splitViewOption = document.getElementById('split-view-option');

async function cargarConfiguracionOrtofotos() {
    try {
        const response = await fetch('datos/ortofotos.json');
        if (!response.ok) throw new Error(`Error en la red: ${response.statusText}`);
        ortofotosDisponibles = await response.json();
    } catch (error) {
        console.error("Error crítico al cargar la configuración de ortofotos:", error);
        alert("No se pudo cargar la configuración de los mapas. La aplicación no puede continuar.");
    }
}

function inicializarMapaPrincipal() {
    mapContainer.innerHTML = ''; // Limpiar por si acaso
    mapaIzquierdo = L.map('map', {
        attributionControl: false,
        zoomControl: false // El control de zoom se añade manualmente
    }).setView(coordenadasIniciales, zoomInicial);

    L.control.zoom({ position: 'topleft' }).addTo(mapaIzquierdo);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxNativeZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapaIzquierdo);
    
    agregarControlDeMedida(mapaIzquierdo);
    agregarControlVistaDividida(mapaIzquierdo);

    window.oncontextmenu = (event) => {
        if (!event.target.classList.contains('timeline-button')) {
            event.preventDefault(); event.stopPropagation(); return false;
        }
    };
}

function agregarControlDeMedida(mapa) {
    const measureControl = new L.Control.Measure({ position: 'topleft', primaryLengthUnit: 'meters' });
    measureControl.addTo(mapa);
    mapa.on('measurestart', () => ocultarTodosLosMarcadores(mapa));
    mapa.on('measurefinish', () => actualizarVisibilidadMarcadores(mapa));
}

function agregarControlVistaDividida(mapa) {
    if (splitViewControl) {
        splitViewControl.remove();
    }

    L.Control.SplitView = L.Control.extend({
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            this.button = L.DomUtil.create('a', 'leaflet-control-splitview', container);
            this.button.title = 'Activar/Desactivar pantalla dividida';
            this.button.href = '#';

            // Marcar como activo si ya estamos en vista dividida
            if (vistaDivididaActiva) {
                L.DomUtil.addClass(this.button, 'active');
            }

            L.DomEvent.on(this.button, 'click', L.DomEvent.stop);
            L.DomEvent.on(this.button, 'click', this._toggleSplitView, this);
            return container;
        },
        _toggleSplitView: function() {
            if (vistaDivididaActiva) {
                desactivarVistaDividida();
            } else {
                const datosDerecha = datosOrtoActivaIzquierda;
                let datosIzquierda = ortofotosDisponibles[ortofotosDisponibles.length - 1];
                if (datosIzquierda.fecha === datosDerecha.fecha) {
                    datosIzquierda = ortofotosDisponibles.length > 1 ? ortofotosDisponibles[ortofotosDisponibles.length - 2] : datosDerecha;
                }
                activarVistaDividida(datosIzquierda, datosDerecha);
            }
        }
    });
    splitViewControl = new L.Control.SplitView({ position: 'topleft' });
    splitViewControl.addTo(mapa);
}

function activarVistaDividida(datosIzquierda, datosDerecha) {
    if (vistaDivididaActiva) return;
    vistaDivididaActiva = true;
    mapContainer.classList.add('split-view');

    const centro = mapaIzquierdo.getCenter();
    const zoom = mapaIzquierdo.getZoom();
    
    mapaIzquierdo.remove();
    mapContainer.innerHTML = '';

    const containerIzquierdo = document.createElement('div');
    containerIzquierdo.id = 'mapa-izquierda-container';
    containerIzquierdo.className = 'map-container';
    mapContainer.appendChild(containerIzquierdo);

    const containerDerecho = document.createElement('div');
    containerDerecho.id = 'mapa-derecha-container';
    containerDerecho.className = 'map-container';
    mapContainer.appendChild(containerDerecho);

    // Inicializar mapa izquierdo
    mapaIzquierdo = L.map(containerIzquierdo.id, { attributionControl: false, zoomControl: false }).setView(centro, zoom);
    L.control.zoom({ position: 'topleft' }).addTo(mapaIzquierdo); // AÑADIR CONTROL DE ZOOM
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxNativeZoom: 19 }).addTo(mapaIzquierdo);
    mapaIzquierdo.capaOrtofoto = L.tileLayer(datosIzquierda.ruta, { minZoom: 15, maxZoom: 22, tms: false }).addTo(mapaIzquierdo);
    agregarControlDeMedida(mapaIzquierdo);
    renderizarMarcadoresParaMapa(mapaIzquierdo, datosGlobalesMarcadores);
    crearSuperposicionMapa(mapaIzquierdo, datosIzquierda, 'izquierda');
    
    // Inicializar mapa derecho
    mapaDerecho = L.map(containerDerecho.id, { attributionControl: false, zoomControl: false }).setView(centro, zoom);
    L.control.zoom({ position: 'topleft' }).addTo(mapaDerecho); // AÑADIR CONTROL DE ZOOM
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxNativeZoom: 19 }).addTo(mapaDerecho);
    mapaDerecho.capaOrtofoto = L.tileLayer(datosDerecha.ruta, { minZoom: 15, maxZoom: 22, tms: false }).addTo(mapaDerecho);
    agregarControlDeMedida(mapaDerecho);
    renderizarMarcadoresParaMapa(mapaDerecho, datosGlobalesMarcadores);
    crearSuperposicionMapa(mapaDerecho, datosDerecha, 'derecha');

    // Volver a añadir el control de vista dividida al mapa de la izquierda
    agregarControlVistaDividida(mapaIzquierdo);
    
    mapaIzquierdo.on('move zoom', sincronizarMapas);
    mapaDerecho.on('move zoom', sincronizarMapas);

    datosOrtoActivaIzquierda = datosIzquierda;
    actualizarBotonesTimeline();
}

function inicializarLineaDeTiempo() {
    timelineContainer.innerHTML = ''; // Limpiar por si se reinicializa
    ortofotosDisponibles.forEach(orto => {
        const boton = document.createElement('button');
        boton.className = 'timeline-button';
        boton.textContent = orto.fecha;

        boton.onclick = () => {
            if (vistaDivididaActiva) {
                alert("Para cambiar de mapa, use los selectores sobre cada vista o cierre la pantalla dividida.");
            } else {
                cargarOrtofoto(orto);
            }
        };

        boton.oncontextmenu = (e) => {
            e.preventDefault();
            if (vistaDivididaActiva || boton.textContent === datosOrtoActivaIzquierda.fecha) return;
            contextMenu.style.display = 'block';
            contextMenu.style.top = `${e.pageY - 10}px`;
            contextMenu.style.left = `${e.pageX}px`;

            splitViewOption.onclick = () => {
                contextMenu.style.display = 'none';
                activarVistaDividida(orto, datosOrtoActivaIzquierda);
            };
        };
        timelineContainer.appendChild(boton);
    });

    document.addEventListener('click', () => { if (contextMenu.style.display === 'block') contextMenu.style.display = 'none'; });
    if (ortofotosDisponibles.length > 0) {
        cargarOrtofoto(ortofotosDisponibles[ortofotosDisponibles.length - 1]);
    }
}

// MODIFICADO: Lógica de desactivación
function desactivarVistaDividida() {
    if (!vistaDivididaActiva) return;

    vistaDivididaActiva = false;
    mapContainer.classList.remove('split-view');

    mapaIzquierdo.remove();
    if(mapaDerecho) mapaDerecho.remove();
    mapaDerecho = null;
    
    // Re-inicializar el mapa principal y cargar la última ortofoto disponible
    inicializarMapaPrincipal();
    const ultimaOrtofoto = ortofotosDisponibles[ortofotosDisponibles.length - 1];
    cargarOrtofoto(ultimaOrtofoto);
    renderizarMarcadoresParaMapa(mapaIzquierdo, datosGlobalesMarcadores);
}

function sincronizarMapas(e) {
    const mapaIniciador = e.target;
    const mapaReceptor = (mapaIniciador === mapaIzquierdo) ? mapaDerecho : mapaIzquierdo;
    if (!mapaReceptor) return;

    mapaReceptor.off('move zoom', sincronizarMapas);
    mapaReceptor.setView(mapaIniciador.getCenter(), mapaIniciador.getZoom(), { animate: false });
    setTimeout(() => { mapaReceptor.on('move zoom', sincronizarMapas); }, 100);
}

function cargarOrtofoto(datosOrto) {
    if (mapaIzquierdo.capaOrtofoto) mapaIzquierdo.removeLayer(mapaIzquierdo.capaOrtofoto);
    mapaIzquierdo.capaOrtofoto = L.tileLayer(datosOrto.ruta, { minZoom: 15, maxZoom: 22, tms: false, attribution: 'REVER' }).addTo(mapaIzquierdo);
    datosOrtoActivaIzquierda = datosOrto;
    actualizarBotonesTimeline();
}

function actualizarBotonesTimeline() {
    document.querySelectorAll('.timeline-button').forEach(btn => {
        btn.classList.remove('active');
        if (!vistaDivididaActiva && btn.textContent === datosOrtoActivaIzquierda.fecha) {
            btn.classList.add('active');
        }
    });
}

async function cargarDatosDeMarcadores() {
    try {
        const response = await fetch('datos/marcadores.json');
        if (!response.ok) throw new Error('No se pudo cargar marcadores.json');
        datosGlobalesMarcadores = await response.json();
    } catch (error) {
        console.error("Error al cargar los marcadores:", error);
    }
}

function renderizarMarcadoresParaMapa(mapa, datosMarcadores) {
    mapa.misMarcadores = [];
    const colorPrincipal = '#100F2B'; const colorAcento = '#AF9A6B';
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
        if (zoomActual >= zoomMinimoMarcadores) { if (!mapa.hasLayer(marcador)) marcador.addTo(mapa); } 
        else { if (mapa.hasLayer(marcador)) marcador.removeFrom(mapa); }
    });
}

function ocultarTodosLosMarcadores(mapa) {
    if (!mapa || !mapa.misMarcadores) return;
    mapa.misMarcadores.forEach(marcador => { if (mapa.hasLayer(marcador)) marcador.removeFrom(mapa); });
}

function manejarClickMarcador(data) {
    if (data.usarIframe) abrirModal(data);
    else window.open(data.linkNuevaPestana, '_blank');
}

// MODIFICADO: Eliminado el span con el nombre de la fecha
function crearSuperposicionMapa(mapa, datosOrto, lado) {
    const container = mapa.getContainer();
    container.dataset.ortoFecha = datosOrto.fecha;

    const overlayDiv = document.createElement('div');
    overlayDiv.className = 'map-overlay';
    
    const closeButton = document.createElement('span');
    closeButton.className = 'map-close-button';
    closeButton.innerHTML = '×';
    closeButton.onclick = () => desactivarVistaDividida();

    const selector = document.createElement('select');
    ortofotosDisponibles.forEach(ortoOpcion => {
        const option = document.createElement('option');
        option.value = ortoOpcion.fecha;
        option.textContent = ortoOpcion.fecha;
        if (ortoOpcion.fecha === datosOrto.fecha) {
            option.selected = true;
        }
        selector.appendChild(option);
    });

    selector.onchange = (e) => {
        const nuevaOrtoFecha = e.target.value;
        const otrosMapasActivos = [];
        if(mapaIzquierdo) otrosMapasActivos.push(mapaIzquierdo.getContainer().dataset.ortoFecha);
        if(mapaDerecho) otrosMapasActivos.push(mapaDerecho.getContainer().dataset.ortoFecha);

        if(otrosMapasActivos.filter(f => f !== container.dataset.ortoFecha).includes(nuevaOrtoFecha)){
            alert('Esta fecha ya está seleccionada en la otra vista.');
            e.target.value = container.dataset.ortoFecha; // Revertir selección
            return;
        }

        const nuevosDatosOrto = ortofotosDisponibles.find(o => o.fecha === nuevaOrtoFecha);
        if (nuevosDatosOrto) {
            cambiarCapaOrtofoto(mapa, nuevosDatosOrto);
        }
    };
    
    overlayDiv.appendChild(selector);
    overlayDiv.appendChild(closeButton);
    container.appendChild(overlayDiv);
}

function cambiarCapaOrtofoto(mapa, nuevosDatosOrto) {
    if (mapa.capaOrtofoto) {
        mapa.removeLayer(mapa.capaOrtofoto);
    }
    mapa.capaOrtofoto = L.tileLayer(nuevosDatosOrto.ruta, { minZoom: 15, maxZoom: 22, tms: false }).addTo(mapa);
    mapa.getContainer().dataset.ortoFecha = nuevosDatosOrto.fecha;

    if (mapa === mapaIzquierdo) {
        datosOrtoActivaIzquierda = nuevosDatosOrto;
    }
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
    await cargarConfiguracionOrtofotos();
    await cargarDatosDeMarcadores();
    if (ortofotosDisponibles.length === 0) {
        console.error("No hay ortofotos para mostrar. Finalizando inicialización.");
        return; 
    }
    
    inicializarMapaPrincipal();
    inicializarLineaDeTiempo(); 

    if (datosGlobalesMarcadores.length > 0) {
        renderizarMarcadoresParaMapa(mapaIzquierdo, datosGlobalesMarcadores);
    }

    setTimeout(() => {
        mapaIzquierdo.invalidateSize();
    }, 100);
}

iniciarApp();