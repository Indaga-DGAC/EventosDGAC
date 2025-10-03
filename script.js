// CONFIGURACIÓN DE AUTENTICACIÓN
const AUTH_CONFIG = {
    users: {
        'admin': 'MINJUS2024@',
        'usuario1': 'eventos123',
        'supervisor': 'sistema2024'
    }
};

// CONFIGURACIÓN DE GOOGLE SHEETS
const GOOGLE_CONFIG = {
    clientId: 'AIzaSyCEc2Gxe8EB7b-eVslaV5w-cJkc2Ef3lbA',
    spreadsheetId: '1uU954WO3POXsvtlEcw70p1aQ62l-qR4Z'
};

// VARIABLES GLOBALES
let allData = [];
let processedData = {};
let dataLoaded = false;
let googleToken = null;
let dataSource = '';
let isAuthenticated = false;

// FUNCIONES DE AUTENTICACIÓN
function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    if (AUTH_CONFIG.users[username] && AUTH_CONFIG.users[username] === password) {
        isAuthenticated = true;
        document.getElementById('loginOverlay').style.display = 'none';
        errorDiv.style.display = 'none';
        console.log('Usuario autenticado:', username);
    } else {
        errorDiv.style.display = 'block';
        errorDiv.textContent = 'Usuario o contraseña incorrectos';
        document.getElementById('password').value = '';
    }
    
    return false;
}

function logout() {
    isAuthenticated = false;
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('loginError').style.display = 'none';
}

// FUNCIONES DE PROCESAMIENTO DE DATOS
function processExcelData(arrayBuffer, source) {
    try {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('No se encontraron hojas en el documento');
        }

        let allSheetData = [];
        let processedSheets = 0;

        console.log('Hojas encontradas:', workbook.SheetNames);

        workbook.SheetNames.forEach(function(sheetName, index) {
            try {
                console.log('Procesando hoja:', sheetName);
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (jsonData.length > 0) {
                    const headers = jsonData[0];
                    console.log('Encabezados encontrados:', headers);
                    
                    const dataObjects = [];
                    for (let i = 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        const obj = {};
                        for (let j = 0; j < headers.length; j++) {
                            if (j < row.length) {
                                obj[headers[j]] = row[j];
                            }
                        }
                        if (Object.keys(obj).length > 0) {
                            obj.AÑO_HOJA = sheetName;
                            obj.DATA_SOURCE = source;
                            dataObjects.push(obj);
                        }
                    }
                    
                    allSheetData = allSheetData.concat(dataObjects);
                    processedSheets++;
                    console.log('Datos procesados de hoja', sheetName + ':', dataObjects.length, 'registros');
                }
            } catch (sheetError) {
                console.warn('Error procesando hoja "' + sheetName + '":', sheetError);
            }
        });

        if (allSheetData.length === 0) {
            throw new Error('No se encontraron datos válidos en las hojas');
        }

        console.log('Total de datos procesados:', allSheetData);
        
        if (source === 'sheets') {
            processSheetsData(allSheetData);
        } else {
            processExcelDataStandard(allSheetData);
        }
        
        showStatus('Datos cargados exitosamente: ' + processedSheets + ' hojas, ' + allSheetData.length + ' registros', 'success');
    } catch (error) {
        console.error('Error procesando Excel:', error);
        showStatus('Error procesando datos: ' + error.message, 'error');
    }
}

function processSheetsData(data) {
    console.log('Procesando datos de Google Sheets con formato específico');
    
    allData = data;
    processedData = {};
    
    data.forEach(function(row, index) {
        const registro = cleanValue(row['N° REGISTRO'] || '');
        const dni = cleanValue(row['DNI'] || row['DOCUMENTO'] || '');
        const paterno = cleanValue(row['PATERNO'] || '');
        const materno = cleanValue(row['MATERNO'] || '');
        const nombres = cleanValue(row['NOMBRES'] || '');
        const evento = cleanValue(row['EVENTO'] || '');
        const fecha = cleanValue(row['FECHA'] || '');
        const condicion = cleanValue(row['CONDICIÓN'] || row['CONDICION'] || '');
        const año = cleanValue(row['AÑO'] || row.AÑO_HOJA || '');

        const personaId = generatePersonId(nombres, paterno, materno);
        
        if (personaId) {
            if (!processedData[personaId]) {
                processedData[personaId] = {
                    registro: registro,
                    dni: dni,
                    nombre: nombres,
                    paterno: paterno,
                    materno: materno,
                    events: []
                };
            }
            
            if (evento) {
                processedData[personaId].events.push({
                    evento: evento,
                    condicion: condicion,
                    fecha: fecha,
                    año: año
                });
            }
        }
    });

    console.log('Datos procesados de Google Sheets:', processedData);
    
    dataLoaded = true;
    updateStats();
    showTabs();
    updateFilters();
    updateDashboard();
    showStatus('Procesamiento completado: ' + Object.keys(processedData).length + ' personas encontradas en Google Sheets', 'success');
}

function processExcelDataStandard(data) {
    console.log('Procesando datos de Excel con formato estándar');
    
    allData = data;
    processedData = {};
    
    data.forEach(function(row, index) {
        const keys = Object.keys(row);
        
        const registroKey = findColumn(keys, ['registro', 'n° registro', 'nro registro', 'numero registro']);
        const dniKey = findColumn(keys, ['dni', 'documento', 'doc', 'cedula', 'cédula']);
        const nombreKey = findColumn(keys, ['nombre', 'nombres', 'name', 'nombres']);
        const paternoKey = findColumn(keys, ['paterno', 'apellidopaterno', 'apellido_paterno', 'apepaterno', 'paterno']);
        const maternoKey = findColumn(keys, ['materno', 'apellidomaterno', 'apellido_materno', 'apematerno', 'materno']);
        const eventoKey = findColumn(keys, ['evento', 'event', 'actividad', 'curso', 'taller']);
        const fechaKey = findColumn(keys, ['fecha', 'date', 'fechaevento']);
        const condicionKey = findColumn(keys, ['condicion', 'condición', 'estado', 'status']);
        const añoKey = findColumn(keys, ['año', 'ano', 'year', 'año']);

        const registro = cleanValue(row[registroKey] || '');
        const dni = cleanValue(row[dniKey] || '');
        const nombres = cleanValue(row[nombreKey] || '');
        const paterno = cleanValue(row[paternoKey] || '');
        const materno = cleanValue(row[maternoKey] || '');
        const evento = cleanValue(row[eventoKey] || '');
        const fecha = cleanValue(row[fechaKey] || '');
        const condicion = cleanValue(row[condicionKey] || '');
        const año = cleanValue(row[añoKey] || row.AÑO_HOJA || '');

        const personaId = generatePersonId(nombres, paterno, materno);
        
        if (personaId) {
            if (!processedData[personaId]) {
                processedData[personaId] = {
                    registro: registro,
                    dni: dni,
                    nombre: nombres,
                    paterno: paterno,
                    materno: materno,
                    events: []
                };
            }
            
            if (evento) {
                processedData[personaId].events.push({
                    evento: evento,
                    condicion: condicion,
                    fecha: fecha,
                    año: año
                });
            }
        }
    });

    console.log('Datos procesados de Excel:', processedData);
    
    dataLoaded = true;
    updateStats();
    showTabs();
    updateFilters();
    updateDashboard();
    showStatus('Procesamiento completado: ' + Object.keys(processedData).length + ' personas encontradas en Excel', 'success');
}

// FUNCIONES AUXILIARES
function findColumn(columns, possibleNames) {
    for (let name of possibleNames) {
        for (let column of columns) {
            if (column && column.toString().toLowerCase().includes(name.toLowerCase())) {
                return column;
            }
        }
    }
    return '';
}

function cleanValue(value) {
    if (value === null || value === undefined) return '';
    return value.toString().trim();
}

function generatePersonId(nombre, paterno, materno) {
    return (nombre + '|' + paterno + '|' + materno).toLowerCase().trim();
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('statusMessage');
    const className = type === 'success' ? 'status-success' : 
                     type === 'error' ? 'status-error' : 'status-loading';
    
    statusDiv.innerHTML = '<div class="status-message ' + className + '">' + message + '</div>';
}

function showDocumentError(errorMessage) {
    const errorHtml = `
        <div style="background: #f8d7da; color: #721c24; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
            <h4 style="margin-bottom: 15px;">⚠ Error al acceder al documento</h4>
            <p style="margin-bottom: 15px;"><strong>Error:</strong> ${errorMessage}</p>
            <div style="background: #f5c6cb; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="margin: 0; font-size: 14px;">
                    <strong>Posibles soluciones:</strong><br>
                    1. Verifica que el documento sea público<br>
                    2. Asegúrate de tener permisos de lectura<br>
                    3. Intenta con un archivo Excel local
                </p>
            </div>
            <button onclick="showTab('upload')" 
                    style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                Volver a Cargar Datos
            </button>
        </div>
    `;
    
    document.getElementById('statusMessage').innerHTML = errorHtml;
}

// FUNCIONES PRINCIPALES DE CARGA DE DATOS
function loadFromGoogleSheets() {
    console.log('Iniciando carga desde Google Sheets');
    dataSource = 'sheets';
    showGoogleSignInInterface();
}

function showGoogleSignInInterface() {
    const signInHtml = `
        <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin: 20px 0; text-align: center;">
            <h3 style="color: #2c3e50; margin-bottom: 20px;">🔍 Autenticación con Google</h3>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 30px; text-align: left;">
                <h4 style="color: #495057; margin-bottom: 15px;">Para acceder a Google Sheets:</h4>
                <ul style="color: #495057; margin: 0; padding-left: 20px;">
                    <li>Necesitas una cuenta de Google</li>
                    <li>Debes tener acceso al documento</li>
                    <li>Selecciona la misma cuenta que tiene acceso al Sheets</li>
                </ul>
            </div>
            
            <div id="googleSignInStatus">
                <p style="color: #6c757d; margin-bottom: 20px;">Cargando opciones de autenticación...</p>
            </div>
            
            <div style="margin-top: 20px;">
                <button onclick="tryWithoutAuthentication()" 
                        style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px;">
                    Intentar sin autenticación (documento público)
                </button>
            </div>
            
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-top: 20px;">
                <small style="color: #1976d2;">
                    💡 <strong>Consejo:</strong> Si el documento es público, puedes usar la opción sin autenticación.
                </small>
            </div>
        </div>
    `;
    
    document.getElementById('statusMessage').innerHTML = signInHtml;
    setTimeout(() => { authenticateGoogle(); }, 100);
}

function authenticateGoogle() {
    console.log('Iniciando autenticación Google');
    showStatus('Iniciando autenticación...', 'loading');
    loadGoogleIdentityServices();
}

function loadGoogleIdentityServices() {
    if (window.google && window.google.accounts) {
        console.log('Google Identity Services ya cargado');
        initializeGoogleSignIn();
        return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = function() {
        console.log('Google Identity Services cargado');
        initializeGoogleSignIn();
    };
    script.onerror = function() {
        console.error('Error cargando Google Identity Services');
        showStatus('Error cargando servicios de Google. Intentando método alternativo...', 'error');
        tryWithoutAuthentication();
    };
    document.head.appendChild(script);
}

function initializeGoogleSignIn() {
    console.log('Inicializando Google Sign-In');
    
    try {
        google.accounts.id.initialize({
            client_id: GOOGLE_CONFIG.clientId,
            callback: handleCredentialResponse,
            auto_select: false,
            context: 'signin'
        });

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'google-signin-container';
        buttonContainer.id = 'googleButtonContainer';
        
        document.getElementById('googleSignInStatus').innerHTML = '';
        document.getElementById('googleSignInStatus').appendChild(buttonContainer);

        google.accounts.id.renderButton(
            buttonContainer,
            {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'left'
            }
        );

        console.log('Botón de Google Sign-In renderizado correctamente');

    } catch (error) {
        console.error('Error inicializando Google Sign-In:', error);
        showStatus('Error configurando autenticación. Usando método público...', 'error');
        tryWithoutAuthentication();
    }
}

function handleCredentialResponse(response) {
    console.log('Respuesta de credenciales recibida');
    showStatus('Autenticación exitosa. Obteniendo datos...', 'loading');
    
    const responsePayload = parseJwt(response.credential);
    
    console.log('Usuario autenticado:', responsePayload.name);
    showUserAuthenticated(responsePayload);
    
    googleToken = response.credential;
    loadGoogleSheetsDataWithToken();
}

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('Error parsing JWT:', e);
        return { name: 'Usuario', email: 'usuario@example.com' };
    }
}

function showUserAuthenticated(profile) {
    const userHtml = `
        <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 15px;">
                <div style="width: 50px; height: 50px; border-radius: 50%; background: #28a745; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: bold;">
                    ${profile.name ? profile.name.charAt(0) : 'U'}
                </div>
                <div style="text-align: left;">
                    <div style="font-weight: 600; color: #155724; font-size: 18px;">${profile.name || 'Usuario'}</div>
                    <div style="color: #155724; font-size: 14px;">${profile.email || 'usuario@example.com'}</div>
                    <div style="color: #28a745; font-size: 12px; margin-top: 5px;">✓ Autenticado exitosamente</div>
                </div>
            </div>
            <p style="margin: 15px 0 0 0; color: #155724; text-align: center; font-size: 14px;">
                Cargando datos desde Google Sheets...
            </p>
        </div>
    `;
    
    document.getElementById('googleSignInStatus').innerHTML = userHtml;
}

function loadGoogleSheetsDataWithToken() {
    showStatus('Accediendo a Google Sheets con cuenta autenticada...', 'loading');
    console.log('Token recibido, usando método de exportación pública');
    tryWithoutAuthentication();
}

function tryWithoutAuthentication() {
    console.log('Intentando acceso sin autenticación');
    showStatus('Intentando acceso público al documento...', 'loading');
    
    const exportUrl = 'https://docs.google.com/spreadsheets/d/' + GOOGLE_CONFIG.spreadsheetId + '/export?format=xlsx';
    
    fetch(exportUrl)
        .then(function(response) {
            if (!response.ok) {
                throw new Error('Error ' + response.status + ': Documento no accesible');
            }
            showStatus('Documento encontrado. Descargando datos...', 'loading');
            return response.blob();
        })
        .then(function(blob) {
            return blob.arrayBuffer();
        })
        .then(function(arrayBuffer) {
            console.log('Datos descargados, procesando Excel...');
            processExcelData(arrayBuffer, 'sheets');
        })
        .catch(function(error) {
            console.error('Error:', error);
            showDocumentError(error.message);
        });
}

// FUNCIONES DE ESTADÍSTICAS Y NAVEGACIÓN
function updateStats() {
    if (!dataLoaded) return;

    let totalPersons = Object.keys(processedData).length;
    let totalEvents = 0;
    const years = new Set();

    Object.values(processedData).forEach(function(person) {
        totalEvents += person.events.length;
        person.events.forEach(function(event) {
            if (event.año) years.add(event.año);
        });
    });

    document.getElementById('totalPersons').textContent = totalPersons;
    document.getElementById('totalEvents').textContent = totalEvents;
    document.getElementById('totalYears').textContent = years.size;
    document.getElementById('stats').style.display = 'grid';
    document.getElementById('initialMessage').style.display = 'none';
}

function showTabs() {
    document.getElementById('searchTab').style.display = 'block';
    document.getElementById('dashboardTab').style.display = 'block';
    document.getElementById('exportTab').style.display = 'block';
}

function showTab(tabName) {
    const tabs = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('active');
    }
    
    const buttons = document.getElementsByClassName('tab-btn');
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].classList.remove('active');
    }
    
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
    
    if (tabName === 'search') {
        performSearch();
    } else if (tabName === 'dashboard') {
        updateDashboard();
    }
}

// FUNCIONES DE BÚSQUEDA MEJORADAS
function updateFilters() {
    if (!dataLoaded) return;

    const years = new Set();
    const events = new Set();
    const conditions = new Set();

    Object.values(processedData).forEach(function(person) {
        person.events.forEach(function(event) {
            if (event.año) years.add(event.año);
            if (event.evento) events.add(event.evento);
            if (event.condicion) conditions.add(event.condicion);
        });
    });

    const yearSelect = document.getElementById('filterYear');
    yearSelect.innerHTML = '<option value="">Todos los años</option>';
    Array.from(years).sort().reverse().forEach(function(year) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });

    const eventSelect = document.getElementById('filterEvent');
    eventSelect.innerHTML = '<option value="">Todos los eventos</option>';
    Array.from(events).sort().forEach(function(event) {
        const option = document.createElement('option');
        option.value = event;
        option.textContent = event;
        eventSelect.appendChild(option);
    });

    const conditionSelect = document.getElementById('filterCondition');
    conditionSelect.innerHTML = '<option value="">Todas las condiciones</option>';
    Array.from(conditions).sort().forEach(function(condition) {
        const option = document.createElement('option');
        option.value = condition;
        option.textContent = condition;
        conditionSelect.appendChild(option);
    });

    document.getElementById('searchRegistro').addEventListener('input', performSearch);
    document.getElementById('searchDNI').addEventListener('input', performSearch);
    document.getElementById('searchName').addEventListener('input', performSearch);
    document.getElementById('searchPaterno').addEventListener('input', performSearch);
    document.getElementById('searchMaterno').addEventListener('input', performSearch);
    document.getElementById('filterYear').addEventListener('change', performSearch);
    document.getElementById('filterEvent').addEventListener('change', performSearch);
    document.getElementById('filterCondition').addEventListener('change', performSearch);
}

function performSearch() {
    if (!dataLoaded) return;

    const searchRegistro = document.getElementById('searchRegistro').value.toLowerCase();
    const searchDNI = document.getElementById('searchDNI').value.toLowerCase();
    const searchName = document.getElementById('searchName').value.toLowerCase();
    const searchPaterno = document.getElementById('searchPaterno').value.toLowerCase();
    const searchMaterno = document.getElementById('searchMaterno').value.toLowerCase();
    const filterYear = document.getElementById('filterYear').value;
    const filterEvent = document.getElementById('filterEvent').value;
    const filterCondition = document.getElementById('filterCondition').value;

    const results = document.getElementById('results');
    
    // VERIFICAR SI HAY ALGÚN CRITERIO DE BÚSQUEDA
    const hasSearchCriteria = searchRegistro || searchDNI || searchName || searchPaterno || searchMaterno || 
                             filterYear || filterEvent || filterCondition;

    if (!hasSearchCriteria) {
        // MOSTRAR MENSAJE CUANDO NO HAY BÚSQUEDA
        results.innerHTML = `
            <div class="no-data">
                <div style="font-size: 4rem; margin-bottom: 20px;">🔍</div>
                <h3>Ingresa criterios de búsqueda</h3>
                <p>Escribe un apellido, nombre, DNI o usa los filtros para buscar personas</p>
                <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 10px;">
                    <h4>💡 Sugerencias de búsqueda:</h4>
                    <ul style="text-align: left; margin: 10px 0; padding-left: 20px;">
                        <li>Escribe un <strong>apellido paterno</strong> en el campo correspondiente</li>
                        <li>Busca por <strong>nombre</strong> o <strong>DNI</strong></li>
                        <li>Usa los filtros de <strong>año, evento o condición</strong></li>
                        <li>Puedes combinar varios criterios</li>
                    </ul>
                </div>
            </div>
        `;
        return;
    }

    results.innerHTML = '<div class="no-data"><div style="font-size: 2rem; margin-bottom: 10px;">⏳</div><p>Buscando...</p></div>';

    // Pequeño delay para que se vea el mensaje de "Buscando..."
    setTimeout(() => {
        const filteredPersons = Object.values(processedData).filter(function(person) {
            // Si hay búsqueda por texto, aplicar filtros
            if (searchRegistro && !person.registro.toLowerCase().includes(searchRegistro)) return false;
            if (searchDNI && !person.dni.toLowerCase().includes(searchDNI)) return false;
            if (searchName && !person.nombre.toLowerCase().includes(searchName)) return false;
            if (searchPaterno && !person.paterno.toLowerCase().includes(searchPaterno)) return false;
            if (searchMaterno && !person.materno.toLowerCase().includes(searchMaterno)) return false;

            // Filtrar eventos según los filtros seleccionados
            const filteredEvents = person.events.filter(function(event) {
                const yearMatch = !filterYear || event.año === filterYear;
                const eventMatch = !filterEvent || event.evento === filterEvent;
                const conditionMatch = !filterCondition || event.condicion === filterCondition;
                return yearMatch && eventMatch && conditionMatch;
            });

            return filteredEvents.length > 0;
        });

        if (filteredPersons.length === 0) {
            results.innerHTML = `
                <div class="no-data">
                    <div style="font-size: 4rem; margin-bottom: 20px;">🔍</div>
                    <h3>No se encontraron resultados</h3>
                    <p>Intenta con otros criterios de búsqueda</p>
                    <div style="margin-top: 15px; color: #6c757d; font-size: 0.9rem;">
                        <strong>Búsqueda realizada:</strong><br>
                        ${searchRegistro ? 'Registro: ' + searchRegistro + '<br>' : ''}
                        ${searchDNI ? 'DNI: ' + searchDNI + '<br>' : ''}
                        ${searchName ? 'Nombre: ' + searchName + '<br>' : ''}
                        ${searchPaterno ? 'Apellido Paterno: ' + searchPaterno + '<br>' : ''}
                        ${searchMaterno ? 'Apellido Materno: ' + searchMaterno + '<br>' : ''}
                        ${filterYear ? 'Año: ' + filterYear + '<br>' : ''}
                        ${filterEvent ? 'Evento: ' + filterEvent + '<br>' : ''}
                        ${filterCondition ? 'Condición: ' + filterCondition : ''}
                    </div>
                </div>
            `;
            return;
        }

        // MOSTRAR RESULTADOS
        results.innerHTML = `
            <div style="margin-bottom: 20px; padding: 15px; background: #e7f3ff; border-radius: 10px; border-left: 4px solid #007bff;">
                <strong>✅ Se encontraron ${filteredPersons.length} persona(s)</strong>
                <div style="font-size: 0.9rem; margin-top: 5px; color: #495057;">
                    ${searchRegistro ? 'Registro: ' + searchRegistro + ' • ' : ''}
                    ${searchDNI ? 'DNI: ' + searchDNI + ' • ' : ''}
                    ${searchName ? 'Nombre: ' + searchName + ' • ' : ''}
                    ${searchPaterno ? 'Paterno: ' + searchPaterno + ' • ' : ''}
                    ${searchMaterno ? 'Materno: ' + searchMaterno + ' • ' : ''}
                    ${filterYear ? 'Año: ' + filterYear + ' • ' : ''}
                    ${filterEvent ? 'Evento: ' + filterEvent + ' • ' : ''}
                    ${filterCondition ? 'Condición: ' + filterCondition : ''}
                </div>
            </div>
        `;

        filteredPersons.forEach(function(person) {
            const personCard = createPersonCard(person);
            results.appendChild(personCard);
        });

    }, 300); // Pequeño delay para mejor experiencia de usuario
}


function createPersonCard(person) {
    const card = document.createElement('div');
    card.className = 'person-card';
    
    const eventsCount = person.events.length;
    let summary = person.dni ? 'DNI: ' + person.dni + ' | ' : '';
    summary += person.registro ? 'Registro: ' + person.registro + ' | ' : '';
    summary += eventsCount + ' evento' + (eventsCount !== 1 ? 's' : '');
    
    card.innerHTML = `
        <button class="pdf-download-btn" onclick="event.stopPropagation(); generatePersonPDF(${JSON.stringify(person).replace(/"/g, '&quot;')})">
    📄 Descargar PDF
</button>
        <div class="person-name">${person.nombre} ${person.paterno} ${person.materno}</div>
        <div class="person-summary">${summary}</div>
        <div class="click-hint">Haz clic para ver detalles completos</div>
        <div class="person-details"></div>
    `;
    
    card.addEventListener('click', function() {
        const details = card.querySelector('.person-details');
        const isExpanded = card.classList.contains('expanded');
        
        if (isExpanded) {
            card.classList.remove('expanded');
            details.classList.remove('show');
            details.innerHTML = '';
        } else {
            card.classList.add('expanded');
            details.classList.add('show');
            details.innerHTML = createPersonDetails(person);
        }
    });
    
    return card;
}

function createPersonDetails(person) {
    let detailsHtml = `
        <div class="details-grid">
            <div class="detail-item">
                <span class="detail-label">N° REGISTRO</span>
                <span class="detail-value">${person.registro || 'No disponible'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">DNI</span>
                <span class="detail-value">${person.dni || 'No disponible'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">NOMBRES COMPLETOS</span>
                <span class="detail-value">${person.nombre} ${person.paterno} ${person.materno}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">TOTAL DE EVENTOS</span>
                <span class="detail-value">${person.events.length}</span>
            </div>
        </div>
    `;
    
    if (person.events.length > 0) {
        detailsHtml += `
            <div class="events-section">
                <div class="events-title">Eventos Participados:</div>
                ${person.events.map(event => `
                    <div class="event-item">
                        <strong>${event.evento || 'Evento no especificado'}</strong><br>
                        ${event.año ? 'Año: ' + event.año + ' | ' : ''}
                        ${event.fecha ? 'Fecha: ' + event.fecha + ' | ' : ''}
                        ${event.condicion ? 'Condición: ' + event.condicion : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    return detailsHtml;
}

// DASHBOARD MEJORADO CON GRÁFICOS AVANZADOS
function updateDashboard() {
    if (!dataLoaded) {
        document.getElementById('dashboardContent').innerHTML = `
            <div class="no-data">
                <div style="font-size: 4rem; margin-bottom: 20px;">📊</div>
                <h3>No hay datos cargados</h3>
                <p>Carga datos primero para ver el dashboard</p>
            </div>
        `;
        return;
    }

    const stats = getAdvancedStats();
    
    const dashboardHtml = `
        <div class="dashboard-header">
            <h2>📊 Dashboard Analítico</h2>
            <p>Análisis completo de participación en eventos del MINJUS</p>
        </div>
        
        <div class="dashboard-summary">
            <div class="summary-card">
                <div class="summary-icon">👥</div>
                <div class="summary-number">${stats.totalPersons}</div>
                <div class="summary-label">Total de Personas</div>
            </div>
            <div class="summary-card">
                <div class="summary-icon">🎯</div>
                <div class="summary-number">${stats.totalEvents}</div>
                <div class="summary-label">Total de Eventos</div>
            </div>
            <div class="summary-card">
                <div class="summary-icon">📅</div>
                <div class="summary-number">${stats.activeYears}</div>
                <div class="summary-label">Años Activos</div>
            </div>
            <div class="summary-card">
                <div class="summary-icon">📈</div>
                <div class="summary-number">${stats.avgEventsPerPerson}</div>
                <div class="summary-label">Eventos por Persona</div>
            </div>
        </div>

        <div class="dashboard-grid">
            <div class="chart-container">
                <div class="chart-title">📈 Tendencia Anual de Participación</div>
                <div class="chart-subtitle">Evolución del número de eventos por año</div>
                <div class="chart-wrapper">
                    <canvas id="yearTrendChart"></canvas>
                </div>
            </div>
            <div class="chart-container">
                <div class="chart-title">🎯 Distribución de Tipos de Eventos</div>
                <div class="chart-subtitle">Popularidad relativa de cada tipo de evento</div>
                <div class="chart-wrapper">
                    <canvas id="eventDistributionChart"></canvas>
                </div>
            </div>
            <div class="chart-container">
                <div class="chart-title">🔄 Estado de Participación</div>
                <div class="chart-subtitle">Condiciones de participación en eventos</div>
                <div class="chart-wrapper">
                    <canvas id="participationStatusChart"></canvas>
                </div>
            </div>
            <div class="chart-container">
                <div class="chart-title">📊 Análisis de Frecuencia</div>
                <div class="chart-subtitle">Distribución de personas por número de eventos</div>
                <div class="chart-wrapper">
                    <canvas id="frequencyAnalysisChart"></canvas>
                </div>
            </div>
        </div>
        
        <div class="chart-container" style="height: auto; margin-top: 25px;">
            <div class="chart-title">📋 Resumen Ejecutivo</div>
            <table class="advanced-table">
                <thead>
                    <tr>
                        <th>Métrica</th>
                        <th>Valor</th>
                        <th>Descripción</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Participación Promedio</strong></td>
                        <td>${stats.avgEventsPerPerson} eventos/persona</td>
                        <td>Número promedio de eventos por participante</td>
                    </tr>
                    <tr>
                        <td><strong>Año Más Activo</strong></td>
                        <td>${stats.mostActiveYear.year} (${stats.mostActiveYear.count} eventos)</td>
                        <td>Año con mayor número de eventos registrados</td>
                    </tr>
                    <tr>
                        <td><strong>Evento Más Popular</strong></td>
                        <td>${stats.mostPopularEvent.name}</td>
                        <td>${stats.mostPopularEvent.count} participaciones registradas</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    document.getElementById('dashboardContent').innerHTML = dashboardHtml;

    // Pequeño delay para que el DOM se renderice completamente
    setTimeout(() => {
        createYearTrendChart(stats.yearData);
        createEventDistributionChart(stats.eventData);
        createParticipationStatusChart(stats.conditionData);
        createFrequencyAnalysisChart(stats.frequencyData);
    }, 100);
}
function getAdvancedStats() {
    const totalPersons = Object.keys(processedData).length;
    let totalEvents = 0;
    const years = new Set();
    const yearData = {};
    const eventData = {};
    const conditionData = {};
    const monthlyData = {};
    const frequencyData = {};
    let topParticipants = [];

    Object.values(processedData).forEach(function(person) {
        const personEvents = person.events.length;
        totalEvents += personEvents;
        
        // Datos de frecuencia
        if (!frequencyData[personEvents]) {
            frequencyData[personEvents] = 0;
        }
        frequencyData[personEvents]++;
        
        // Top participantes
        topParticipants.push({
            name: `${person.nombre} ${person.paterno}`,
            events: personEvents
        });
        
        person.events.forEach(function(event) {
            if (event.año) {
                years.add(event.año);
                yearData[event.año] = (yearData[event.año] || 0) + 1;
            }
            
            if (event.evento) {
                eventData[event.evento] = (eventData[event.evento] || 0) + 1;
            }
            
            if (event.condicion) {
                conditionData[event.condicion] = (conditionData[event.condicion] || 0) + 1;
            }
            
            if (event.fecha) {
                const date = new Date(event.fecha);
                if (!isNaN(date)) {
                    const monthYear = date.getFullYear() + '-' + (date.getMonth() + 1).toString().padStart(2, '0');
                    monthlyData[monthYear] = (monthlyData[monthYear] || 0) + 1;
                }
            }
        });
    });

    // Ordenar top participantes
    topParticipants.sort((a, b) => b.events - a.events);
    topParticipants = topParticipants.slice(0, 10);
    
    // Calcular estadísticas adicionales
    const avgEventsPerPerson = (totalEvents / totalPersons).toFixed(1);
    
    const mostActiveYear = Object.entries(yearData).reduce((max, [year, count]) => 
        count > max.count ? {year, count} : max, {year: '', count: 0});
    
    const mostPopularEvent = Object.entries(eventData).reduce((max, [name, count]) => 
        count > max.count ? {name, count} : max, {name: '', count: 0});
    
    const mostCommonCondition = Object.entries(conditionData).reduce((max, [name, count]) => 
        count > max.count ? {name, count} : max, {name: '', count: 0});

    return {
        totalPersons,
        totalEvents,
        activeYears: years.size,
        avgEventsPerPerson,
        yearData,
        eventData,
        conditionData,
        monthlyData,
        frequencyData,
        topParticipants,
        mostActiveYear,
        mostPopularEvent,
        mostCommonCondition,
        topParticipant: topParticipants[0] || {name: 'N/A', events: 0}
    };
}

// FUNCIONES DE GRÁFICOS AVANZADOS
// FUNCIONES DE GRÁFICOS AVANZADOS - CORREGIDAS
function createYearTrendChart(data) {
    const ctx = document.getElementById('yearTrendChart');
    if (!ctx) return;
    
    const labels = Object.keys(data).sort();
    const values = labels.map(label => data[label]);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Eventos por Año',
                data: values,
                backgroundColor: 'rgba(220, 38, 38, 0.2)',
                borderColor: '#dc2626',
                borderWidth: 2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function createEventDistributionChart(data) {
    const ctx = document.getElementById('eventDistributionChart');
    if (!ctx) return;
    
    const labels = Object.keys(data).slice(0, 6);
    const values = labels.map(label => data[label]);
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d', '#16a34a'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}
function createParticipationStatusChart(data) {
    const ctx = document.getElementById('participationStatusChart');
    if (!ctx) return;
    
    const labels = Object.keys(data);
    const values = labels.map(label => data[label]);
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Participaciones',
                data: values,
                backgroundColor: '#667eea'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function createFrequencyAnalysisChart(data) {
    const ctx = document.getElementById('frequencyAnalysisChart');
    if (!ctx) return;
    
    const labels = Object.keys(data).sort((a, b) => parseInt(a) - parseInt(b));
    const values = labels.map(label => data[label]);
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Personas',
                data: values,
                backgroundColor: '#28a745'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function createMonthlyEvolutionChart(data) {
    const ctx = document.getElementById('monthlyEvolutionChart').getContext('2d');
    const labels = Object.keys(data).sort();
    const values = labels.map(label => data[label]);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Eventos Mensuales',
                data: values,
                backgroundColor: 'rgba(102, 126, 234, 0.2)',
                borderColor: '#667eea',
                borderWidth: 3,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Número de Eventos',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Mes-Año',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        font: {
                            size: 11,
                            weight: 'bold'
                        },
                        maxTicksLimit: 10
                    }
                }
            }
        }
    });
}

function createTopParticipantsChart(data) {
    const ctx = document.getElementById('topParticipantsChart').getContext('2d');
    const labels = data.map(p => p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name);
    const values = data.map(p => p.events);
    
    new Chart(ctx, {
        type: 'horizontalBar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Eventos Participados',
                data: values,
                backgroundColor: '#28a745',
                borderColor: '#20c997',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    labels: {
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Número de Eventos',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                },
                y: {
                    ticks: {
                        font: {
                            size: 11,
                            weight: 'bold'
                        }
                    }
                }
            }
        }
    });
}

// FUNCIONES DE EXPORTACIÓN
function exportToExcel() {
    if (!dataLoaded) {
        alert('No hay datos para exportar');
        return;
    }

    try {
        const exportData = [];
        
        Object.values(processedData).forEach(function(person) {
            person.events.forEach(function(event) {
                exportData.push({
                    'N° REGISTRO': person.registro || '',
                    'DNI': person.dni || '',
                    'NOMBRES': person.nombre || '',
                    'APELLIDO PATERNO': person.paterno || '',
                    'APELLIDO MATERNO': person.materno || '',
                    'EVENTO': event.evento || '',
                    'FECHA': event.fecha || '',
                    'AÑO': event.año || '',
                    'CONDICIÓN': event.condicion || ''
                });
            });
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Base_de_Datos');
        
        const fileName = 'base_datos_eventos_' + new Date().toISOString().split('T')[0] + '.xlsx';
        XLSX.writeFile(workbook, fileName);
        
        showStatus('Archivo exportado exitosamente: ' + fileName, 'success');
    } catch (error) {
        console.error('Error exportando Excel:', error);
        showStatus('Error al exportar: ' + error.message, 'error');
    }
}

// FUNCIÓN MEJORADA PARA GENERAR PDF

// FUNCIÓN CORREGIDA PARA GENERAR PDF - TEXTO QUE NO SE SALGA
function generatePersonPDF(person) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Configuración más conservadora
        const marginLeft = 15;
        const marginRight = 15;
        const marginTop = 20;
        const marginBottom = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const contentWidth = pageWidth - marginLeft - marginRight;
        
        let yPos = marginTop;
        
        // ENCABEZADO MÁS COMPACTO
        doc.setFillColor(220, 38, 38);
        doc.rect(0, 0, pageWidth, 30, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('REPÚBLICA DEL PERÚ', pageWidth/2, 12, { align: 'center' });
        doc.setFontSize(10);
        doc.text('Ministerio de Justicia y Derechos Humanos', pageWidth/2, 18, { align: 'center' });
        doc.text('Reporte Individual', pageWidth/2, 24, { align: 'center' });
        
        yPos = 40;
        
        // DATOS PERSONALES - MÁS COMPACTO
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('DATOS PERSONALES', marginLeft, yPos);
        yPos += 8;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        // Función mejorada para manejar texto largo
        function addTextLine(label, value, y) {
            const lineHeight = 5;
            
            // Verificar si necesita nueva página
            if (y > doc.internal.pageSize.getHeight() - marginBottom - 20) {
                doc.addPage();
                y = marginTop;
            }
            
            doc.setFont('helvetica', 'bold');
            const labelWidth = doc.getTextWidth(label + ': ');
            doc.text(label + ': ', marginLeft, y);
            
            doc.setFont('helvetica', 'normal');
            
            // Dividir el valor si es muy largo
            const maxValueWidth = contentWidth - labelWidth - 5;
            const lines = doc.splitTextToSize(value, maxValueWidth);
            
            if (lines.length > 1) {
                // Primera línea al lado de la etiqueta
                doc.text(lines[0], marginLeft + labelWidth, y);
                y += lineHeight;
                
                // Líneas siguientes indentadas
                for (let i = 1; i < lines.length; i++) {
                    if (y > doc.internal.pageSize.getHeight() - marginBottom - 10) {
                        doc.addPage();
                        y = marginTop;
                    }
                    doc.text(lines[i], marginLeft + 10, y);
                    y += lineHeight;
                }
                return y + 2;
            } else {
                doc.text(value, marginLeft + labelWidth, y);
                return y + lineHeight + 2;
            }
        }
        
        // Agregar datos personales con manejo seguro
        const fullName = `${person.nombre || ''} ${person.paterno || ''} ${person.materno || ''}`.trim();
        yPos = addTextLine('Nombre Completo', fullName, yPos);
        
        if (person.dni) yPos = addTextLine('DNI', person.dni.toString(), yPos);
        if (person.registro) yPos = addTextLine('N° Registro', person.registro.toString(), yPos);
        yPos = addTextLine('Total de Eventos', person.events.length.toString(), yPos);
        yPos = addTextLine('Fecha de Reporte', new Date().toLocaleDateString('es-PE'), yPos);
        
        yPos += 8;
        
        // EVENTOS - MEJOR FORMATEADO Y MÁS COMPACTO
        if (person.events.length > 0) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('HISTORIAL DE EVENTOS', marginLeft, yPos);
            yPos += 6;
            
            // Línea separadora
            doc.setDrawColor(200, 200, 200);
            doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
            yPos += 8;
            
            person.events.forEach((event, index) => {
                // Verificar espacio en página
                if (yPos > doc.internal.pageSize.getHeight() - marginBottom - 30) {
                    doc.addPage();
                    yPos = marginTop;
                }
                
                // Número de evento
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.text(`Evento ${index + 1}:`, marginLeft, yPos);
                yPos += 4;
                
                // Nombre del evento (puede ser largo)
                const eventName = event.evento || 'Evento no especificado';
                const eventLines = doc.splitTextToSize(eventName, contentWidth - 10);
                
                doc.setFont('helvetica', 'normal');
                eventLines.forEach(line => {
                    if (yPos > doc.internal.pageSize.getHeight() - marginBottom - 10) {
                        doc.addPage();
                        yPos = marginTop;
                    }
                    doc.text(line, marginLeft + 5, yPos);
                    yPos += 4;
                });
                
                // Detalles del evento en una línea compacta
                let eventDetails = [];
                if (event.año) eventDetails.push(`Año: ${event.año}`);
                if (event.fecha) {
                    // Limpiar formato de fecha si es número de Excel
                    let fecha = event.fecha;
                    if (!isNaN(fecha) && fecha > 40000) {
                        // Convertir número de Excel a fecha
                        const excelDate = new Date((fecha - 25569) * 86400 * 1000);
                        fecha = excelDate.toLocaleDateString('es-PE');
                    }
                    eventDetails.push(`Fecha: ${fecha}`);
                }
                if (event.condicion) eventDetails.push(`Condición: ${event.condicion}`);
                
                if (eventDetails.length > 0) {
                    const detailsText = eventDetails.join(' | ');
                    const detailLines = doc.splitTextToSize(detailsText, contentWidth - 10);
                    
                    detailLines.forEach(line => {
                        if (yPos > doc.internal.pageSize.getHeight() - marginBottom - 10) {
                            doc.addPage();
                            yPos = marginTop;
                        }
                        doc.text(line, marginLeft + 5, yPos);
                        yPos += 4;
                    });
                }
                
                yPos += 6; // Espacio entre eventos
                
                // Línea separadora entre eventos (excepto el último)
                if (index < person.events.length - 1) {
                    if (yPos > doc.internal.pageSize.getHeight() - marginBottom - 5) {
                        doc.addPage();
                        yPos = marginTop;
                    } else {
                        doc.setDrawColor(240, 240, 240);
                        doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
                        yPos += 8;
                    }
                }
            });
        }
        
        // PIE DE PÁGINA MEJORADO
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(128, 128, 128);
            
            // Línea superior del footer
            doc.setDrawColor(220, 220, 220);
            doc.line(marginLeft, doc.internal.pageSize.getHeight() - 15, 
                    pageWidth - marginRight, doc.internal.pageSize.getHeight() - 15);
            
            // Texto del footer
            doc.text(`Página ${i} de ${pageCount}`, 
                    pageWidth - marginRight, doc.internal.pageSize.getHeight() - 10, 
                    { align: 'right' });
            doc.text('Sistema de Gestión de Eventos - MINJUS', 
                    marginLeft, doc.internal.pageSize.getHeight() - 10);
        }
        
        // Descargar el PDF con nombre seguro
        const safeName = fullName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '_')
                                .replace(/\s+/g, '_')
                                .substring(0, 50);
        const fileName = `Reporte_${safeName}.pdf`;
        doc.save(fileName);
        
    } catch (error) {
        console.error('Error generando PDF:', error);
        // Fallback simple si hay error
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.text('Error al generar reporte detallado.', 10, 10);
            doc.text('Reporte básico para: ' + `${person.nombre} ${person.paterno}`, 10, 20);
            doc.text('Total de eventos: ' + person.events.length, 10, 30);
            doc.save(`Reporte_Basico_${person.nombre}_${person.paterno}.pdf`);
        } catch (simpleError) {
            alert('Error grave al generar PDF. Contacte al administrador.');
        }
    }
}


// INICIALIZACIÓN DEL SISTEMA
document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    dataSource = 'excel';
    showStatus('Leyendo archivo Excel...', 'loading');

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            processExcelData(e.target.result, 'excel');
        } catch (error) {
            console.error('Error procesando archivo:', error);
            showStatus('Error procesando archivo: ' + error.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
});

// Verificar autenticación al cargar la página
window.addEventListener('load', function() {
    if (!isAuthenticated) {
        document.getElementById('loginOverlay').style.display = 'flex';
    }
});

// Inicializar la aplicación
console.log('Sistema de Gestión de Base de Datos de Eventos con Autenticación inicializado');
console.log('Credenciales de prueba configuradas en AUTH_CONFIG');