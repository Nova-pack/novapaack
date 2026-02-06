const views = {
    auth: document.getElementById('auth-view'),
    dashboard: document.getElementById('dashboard-view'),
    // createModal: document.getElementById('create-modal'), // Removed as element no longer exists
    configModal: document.getElementById('config-modal')
};

const MASTER_ADMIN_USER = 'masteradmin'; // The only user who can delete/edit
const MASTER_ADMIN_EMAIL = 'admin@novapack.com';

const forms = {
    auth: document.getElementById('auth-form'),
    createTicket: document.getElementById('create-ticket-form')
};

const inputs = {
    username: document.getElementById('username'),
    password: document.getElementById('password'),
    config: document.getElementById('firebase-config-input')
};

// State
let currentUser = null;
let db = null;
let savedDestinations = []; // Cache for autocomplete
let isRegistering = false; // State for Auth View

// Safe Storage
function getSafeStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        console.warn("Storage access denied/failed", e);
        return null;
    }
}

// Global Error Handler
window.addEventListener('error', (event) => {
    document.body.innerHTML += `<div style="position:fixed;top:0;left:0;right:0;background:red;color:white;padding:20px;z-index:9999;">
        <h2>Error Crítico</h2>
        <p>${event.message}</p>
        <button onclick="localStorage.clear();location.reload()">Borrar Datos y Reiniciar</button>
    </div>`;
});

// Initialization
function init() {
    const configStr = getSafeStorage('novapack_firebase_config');

    // Check if firebase is loaded
    if (typeof firebase === 'undefined') {
        const errorMsg = "Error: Las librerías de Firebase no se han cargado. Comprueba tu conexión a internet.";
        console.error(errorMsg);
        document.body.innerHTML += `<div style="position:fixed;top:0;left:0;right:0;background:red;color:white;padding:20px;z-index:9999;">
            <h2>Error de Conexión</h2>
            <p>${errorMsg}</p>
        </div>`;
        return;
    }

    if (configStr) {
        try {
            const config = JSON.parse(configStr);
            console.log("Initializing Firebase with saved config...");
            if (!firebase.apps.length) {
                firebase.initializeApp(config);
            }
            db = firebase.firestore();

            // Setup Auth Listener
            firebase.auth().onAuthStateChanged((user) => {
                currentUser = user;
                if (user) {
                    showDashboard(user);
                } else {
                    showAuth();
                }
            });

        } catch (e) {
            console.error("Firebase Init Error:", e);
            alert("Error en la configuración de Firebase. Por favor revísala.");
            showConfig();
        }
    } else {
        // No config found
        console.log("No config found. Showing config modal.");
        showConfig();
    }
}
function hideAllViews() {
    Object.values(views).forEach(el => {
        if (el) el.classList.add('hidden');
    });
}

function showAuth() {
    hideAllViews();
    views.auth.classList.remove('hidden');
}

function showDashboard(user) {
    hideAllViews();
    views.dashboard.classList.remove('hidden');
    const username = user.email.split('@')[0];
    document.getElementById('user-display').textContent = username.charAt(0).toUpperCase() + username.slice(1);
    loadTickets();
    loadDestinations(); // Load addresses

    // Initialize Editor with correct defaults
    if (typeof setEditorMode === 'function') {
        setEditorMode('new');
    }
}

function showConfig() {
    views.configModal.classList.remove('hidden');
    const existing = getSafeStorage('novapack_firebase_config');
    if (existing) inputs.config.value = existing;
}

// Custom Lists Logic
const defaultWeights = "1kg, 2kg, 5kg, 10kg, 15kg, 20kg, +20kg";
const defaultSizes = "Sobre, Pequeño, Mediano, Grande, Extra Grande, Palet";

function loadSettings() {
    // Try to get from local first (simplified for now)
    const weights = getSafeStorage('novapack_weights') || defaultWeights;
    const sizes = getSafeStorage('novapack_sizes') || defaultSizes;

    // We just update dropdowns, no UI to change them anymore
    updateDropdowns(weights, sizes);
}

function updateDropdowns(weightsStr, sizesStr) {
    const weightSelect = document.getElementById('ticket-weight-select');
    const sizeSelect = document.getElementById('ticket-size');

    weightSelect.innerHTML = weightsStr.split(',').map(s => `<option value="${s.trim()}">${s.trim()}</option>`).join('') + '<option value="manual">Otro (Manual)</option>';
    sizeSelect.innerHTML = sizesStr.split(',').map(s => `<option value="${s.trim()}">${s.trim()}</option>`).join('');

    // Weight manual toggle
    weightSelect.addEventListener('change', (e) => {
        const manualInput = document.getElementById('ticket-weight-manual');
        if (e.target.value === 'manual') {
            manualInput.classList.remove('hidden');
            manualInput.focus();
        } else {
            manualInput.classList.add('hidden');
        }
    });
}

// Destinations Logic
async function loadDestinations() {
    if (!currentUser || !db) return;
    try {
        const snap = await db.collection('users').doc(currentUser.uid).collection('destinations').orderBy('name').get();
        savedDestinations = [];
        snap.forEach(doc => {
            savedDestinations.push({ id: doc.id, ...doc.data() });
        });

        // Populate Picker
        const picker = document.getElementById('client-picker');
        if (picker) {
            picker.innerHTML = '<option value="">-- Escribir nuevo o Buscar --</option>';
            savedDestinations.forEach(d => {
                picker.innerHTML += `<option value="${d.id}">${d.name}</option>`;
            });
        }
    } catch (e) {
        console.warn("Could not load destinations", e);
    }
}

// Client Picker Listener
document.getElementById('client-picker').addEventListener('change', (e) => {
    const id = e.target.value;
    if (id) {
        const client = savedDestinations.find(d => d.id === id);
        if (client) {
            document.getElementById('ticket-receiver').value = client.name;
            document.getElementById('ticket-address').value = client.address;
        }
    } else {
        // Optional: clear fields or leave them? Let's leave them so user doesn't lose data accidentally
        // But maybe focus on receiver
        document.getElementById('ticket-receiver').focus();
    }
});

// Autocomplete Logic
const receiverInput = document.getElementById('ticket-receiver');
const suggestionsBox = document.getElementById('suggestions-box');

receiverInput.addEventListener('input', () => {
    const val = receiverInput.value.toLowerCase();
    suggestionsBox.innerHTML = '';

    if (val.length < 2) {
        suggestionsBox.style.display = 'none';
        return;
    }

    const matches = savedDestinations.filter(d => d.name.toLowerCase().includes(val));

    if (matches.length > 0) {
        suggestionsBox.style.display = 'block';
        matches.forEach(d => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = `${d.name} (${d.address})`;
            div.onclick = () => {
                receiverInput.value = d.name;
                document.getElementById('ticket-address').value = d.address;
                suggestionsBox.style.display = 'none';
            };
            suggestionsBox.appendChild(div);
        });
    } else {
        suggestionsBox.style.display = 'none';
    }
});

// Close suggestions on outside click
document.addEventListener('click', (e) => {
    if (e.target !== receiverInput && e.target !== suggestionsBox) {
        suggestionsBox.style.display = 'none';
    }
});

// Helper to check admin permission
function checkAdminPermission() {
    return currentUser && currentUser.email === MASTER_ADMIN_EMAIL;
}

// Data Operations
async function loadTickets(dateFilter = null) {
    if (!currentUser || !db) return;

    const list = document.getElementById('tickets-list');
    list.innerHTML = '<div class="card">Cargando...</div>';

    const isAdmin = checkAdminPermission();

    try {
        let query;

        if (isAdmin) {
            // Admin: Load ALL tickets from ALL users
            query = db.collectionGroup('tickets');
        } else {
            // Client: Load ONLY my tickets
            query = db.collection('users')
                .doc(currentUser.uid)
                .collection('tickets');
        }

        if (dateFilter) {
            // Filter by specific day
            const startOfDay = new Date(dateFilter);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(dateFilter);
            endOfDay.setHours(23, 59, 59, 999);

            query = query.where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(startOfDay))
                .where('createdAt', '<=', firebase.firestore.Timestamp.fromDate(endOfDay))
                .orderBy('createdAt', 'desc');
        } else {
            // Default: Recent 50
            query = query.orderBy('createdAt', 'desc').limit(50);
        }

        const snapshot = await query.get();

        list.innerHTML = '';

        if (snapshot.empty) {
            list.innerHTML = '<div class="card text-center">No hay albaranes encontrados.</div>';
            return;
        }

        let lastDateString = null;

        snapshot.forEach(doc => {
            const data = doc.data();
            const dateObj = data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date();
            const dateStr = dateObj.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            // Date Grouping Header
            if (dateStr !== lastDateString) {
                const header = document.createElement('div');
                header.className = 'date-header';
                header.style.cssText = "grid-column: 1/-1; background: #eee; padding: 0.5rem 1rem; border-radius: 8px; font-weight: bold; margin-top: 1rem; color: #555; text-transform: capitalize;";
                header.textContent = "📅 " + dateStr;
                list.appendChild(header);
                lastDateString = dateStr;
            }

            renderTicket(doc, list);
        });

        // Store data globally for access by ID, including ownerId (User UID) derived from ref
        window.ticketsCache = {};
        snapshot.forEach(doc => {
            window.ticketsCache[doc.id] = {
                id: doc.id,
                ownerId: doc.ref.parent.parent.id,
                ...doc.data()
            };
        });

    } catch (error) {
        console.error("Error loading tickets:", error);
        list.innerHTML = `<div class="card text-center text-primary">Error cargando datos: ${error.message}</div>`;
    }
}

// Date Filter Listener
document.getElementById('date-filter').addEventListener('change', (e) => {
    loadTickets(e.target.value);
});

function renderTicket(doc, list, isAdmin = false) {
    const data = doc.data();
    const card = document.createElement('div');
    card.className = 'card ticket-card';
    card.dataset.id = doc.id;
    card.onclick = (e) => editTicket(doc.id); // Open in editor

    const date = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'Pendiente';

    // Compact Design
    card.innerHTML = `
        <div class="ticket-status-strip ${data.status === 'delivered' ? 'delivered' : 'pending'}"></div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
                <span class="ticket-id" style="font-size:0.8rem;">${doc.id.substring(0, 8).toUpperCase()}</span>
                ${!data.printed ? '<span style="background:red; color:white; font-size:0.6rem; padding:2px 4px; border-radius:4px; font-weight:bold;">NUEVO</span>' : ''}
            </div>
            <div style="text-align:right;">
                <span class="ticket-date" style="font-size:0.75rem;">${date}</span>
                ${isAdmin && data.clientUsername ? `<div style="font-size:0.7rem; color:var(--brand-primary); font-weight:bold;">User: ${data.clientUsername}</div>` : ''}
            </div>
        </div>
        
        <h4 style="margin:0.2rem 0; font-size:1rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(data.receiver)}</h4>
        <p style="font-size:0.8rem; color:#666; margin-bottom:0.5rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(data.address)}</p>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; font-size:0.8rem; border-top:1px solid #eee; padding-top:0.5rem; color:#444;">
            <div>📦 ${data.packages} | ${data.weight}</div>
            <div style="text-align:right;">${data.shippingType}</div>
            ${data.cod ? `<div style="color:#d35400; font-weight:bold;">💰 ${data.cod}€</div>` : ''}
        </div>
    `;
    list.appendChild(card);
}

// Selection State
let selectedIds = new Set();

function toggleSelection(id, cardElement) {
    if (selectedIds.has(id)) {
        selectedIds.delete(id);
        cardElement.classList.remove('selected-card');
    } else {
        selectedIds.add(id);
        cardElement.classList.add('selected-card');
    }
    updateContextToolbar();
}

function updateContextToolbar() {
    const toolbar = document.getElementById('context-toolbar');
    const countSpan = document.getElementById('selected-count');

    if (!toolbar) return; // Prevent crash if element is missing

    if (selectedIds.size > 0) {
        toolbar.classList.remove('hidden');
        if (countSpan) countSpan.textContent = `${selectedIds.size} marcado${selectedIds.size > 1 ? 's' : ''}`;

        // Update action listeners to current selection (or just use global Set)
        // We will use global selectedIds in action functions
    } else {
        toolbar.classList.add('hidden');
    }
}

// Global Action Handlers (Toolbar)
// Context Toolbar Actions (Disabled - Elements missing in HTML)
// document.getElementById('ctx-print-a4').onclick = () => processSelection('printA4');
// document.getElementById('ctx-print-label').onclick = () => processSelection('printLabel');
// document.getElementById('ctx-share-wa').onclick = () => processSelection('whatsapp');
// document.getElementById('ctx-share-email').onclick = () => processSelection('email');
// document.getElementById('ctx-edit').onclick = () => processSelection('edit');
// document.getElementById('ctx-delete').onclick = () => processSelection('delete');

function processSelection(action) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    // For single-item actions (edit), take the first one
    if (action === 'edit') {
        if (ids.length > 1) alert("Por favor, selecciona solo uno para editar.");
        else editTicket(ids[0]);
        return;
    }

    // For bulk actions (future proof), iterating for now
    ids.forEach(id => {
        if (action === 'printA4') printTicket(id);
        if (action === 'printLabel') printLabel(id);
        if (action === 'whatsapp') shareWhatsapp(id);
        if (action === 'email') shareEmail(id);
        if (action === 'delete') deleteTicket(id);
    });

    // Don't clear selection immediately for print/share, maybe yes for delete
    if (action === 'delete') {
        selectedIds.clear();
        updateContextToolbar();
    }
}

// Globals for editing
let editingId = null;

async function createTicket(e) {
    e.preventDefault();
    if (!currentUser || !db) return;

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = editingId ? "Actualizando..." : "Guardando...";
    btn.disabled = true;

    const weightSelect = document.getElementById('ticket-weight-select');
    let finalWeight = weightSelect.value;
    if (finalWeight === 'manual') {
        finalWeight = document.getElementById('ticket-weight-manual').value + " kg";
    }

    try {
        const ticketData = {
            sender: document.getElementById('ticket-sender').value || "Remitente Desconocido",
            receiver: document.getElementById('ticket-receiver').value || "Destinatario Desconocido",
            address: document.getElementById('ticket-address').value || "Sin Dirección",
            packages: parseInt(document.getElementById('ticket-packages').value) || 1, // Fix NaN
            weight: finalWeight || "0kg",
            size: document.getElementById('ticket-size').value || "Estándar",
            shippingType: document.getElementById('ticket-shipping-type').value || "Pagados",
            cod: document.getElementById('ticket-cod').value || null,
            notes: document.getElementById('ticket-notes').value || "",
            status: 'pending' // No timestamp here, added later
        };

        // Handle Default Sender Save
        if (document.getElementById('save-default-sender').checked) {
            localStorage.setItem('novapack_default_sender', ticketData.sender);
        } else {
            // Optional: clear if unchecked? No, keep it simple.
        }

        // Determine target user (for Admin editing others)
        let targetUserUid = currentUser.uid;
        if (editingId) {
            const cached = window.ticketsCache[editingId];
            if (cached && cached.ownerId) {
                targetUserUid = cached.ownerId;
            }
        }

        if (editingId) {
            // Update
            await db.collection('users').doc(targetUserUid).collection('tickets').doc(editingId).update(ticketData);
        } else {
            // Create with Custom ID (Transaction)
            // Always create for currentUser (Admin creating for others is complex, assume Admin creates for self or switches login)
            // If we wanted Admin to create for others, we'd need a client picker. For now, create for self.
            targetUserUid = currentUser.uid; // Reset to self for new tickets

            const userRef = db.collection('users').doc(targetUserUid);
            const counterRef = userRef.collection('config').doc('counters'); // Ensure this path exists or is auto-created?
            // Firestore creates collections automatically, but we need the doc to exist for get().
            // Actually, transaction.get() on non-existent doc returns doc.exists=false, which we handle.

            await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                const counterDoc = await transaction.get(counterRef);

                // Determine Prefix (First 3 of username or default)
                let prefix = "NOV";
                if (userDoc.exists && userDoc.data().username) {
                    prefix = userDoc.data().username.substring(0, 3).toUpperCase();
                }

                // Determine Next Count
                let nextCount = 1;
                if (counterDoc.exists) {
                    nextCount = (counterDoc.data().current || 0) + 1;
                }

                // Format ID: PRE-00001
                const customId = `${prefix}-${String(nextCount).padStart(5, '0')}`;

                // Add Metadata
                ticketData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                ticketData.ticketNum = nextCount;
                ticketData.customId = customId;

                // Add Client Info for Admin (Denormalization)
                ticketData.clientId = targetUserUid;
                if (userDoc.exists && userDoc.data().username) {
                    ticketData.clientUsername = userDoc.data().username;
                }

                // 1. Create Data Doc (using customId as Doc ID)
                // IMPORTANT: Use set() not add() because we specify ID
                const ticketRef = userRef.collection('tickets').doc(customId);
                transaction.set(ticketRef, ticketData);

                // 2. Update Counter
                transaction.set(counterRef, { current: nextCount }, { merge: true });
            });

            // Handle Save Destination
            const saveDest = document.getElementById('save-destination-check').checked;
            if (saveDest) {
                const newDest = {
                    name: ticketData.receiver,
                    address: ticketData.address,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                const exists = savedDestinations.find(d => d.name.toLowerCase() === newDest.name.toLowerCase());
                if (!exists) {
                    await db.collection('users').doc(targetUserUid).collection('destinations').add(newDest);
                    loadDestinations();
                }
            }
        }

        // Close and Reset
        // closeCreateModal();
        loadTickets(document.getElementById('date-filter').value); // Refresh list

    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Actions
function checkAdminPermission() {
    if (!currentUser || !currentUser.email) return false;
    // Check if username starts with 'masteradmin' or exactly matches
    // Note: Since emails are constructed as username@novapack.com
    return currentUser.email === MASTER_ADMIN_EMAIL;
}

function deleteTicket(id) {
    if (!confirm("¿Seguro que quieres borrar este albarán permanentemente?")) return;

    let targetUserUid = currentUser.uid;
    const cached = window.ticketsCache[id];
    if (cached && cached.ownerId) {
        targetUserUid = cached.ownerId;
    }

    db.collection('users').doc(targetUserUid).collection('tickets').doc(id).delete()
        .then(() => {
            const dateVal = document.getElementById('date-filter').value;
            loadTickets(dateVal);
            // Also update editor state causing minimal disruption
            if (editingId === id) resetEditor();
        })
        .catch(e => alert("Error al borrar: " + e.message));
}

function editTicket(id) {
    const data = window.ticketsCache[id];
    if (!data) return;

    editingId = id; // Set Update Mode

    // Fill Form found in Sidebar Layout
    document.getElementById('ticket-receiver').value = data.receiver;
    document.getElementById('ticket-address').value = data.address;
    document.getElementById('ticket-packages').value = data.packages;
    document.getElementById('ticket-size').value = data.size || '';
    document.getElementById('ticket-shipping-type').value = data.shippingType || 'Pagados';
    document.getElementById('ticket-cod').value = data.cod || '';
    document.getElementById('ticket-notes').value = data.notes || '';

    // Sender if exists
    if (data.sender && document.getElementById('ticket-sender')) {
        document.getElementById('ticket-sender').value = data.sender;
    }

    // Handle Weight
    const w = data.weight || "";
    const select = document.getElementById('ticket-weight-select');
    let found = false;
    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === w) {
            select.selectedIndex = i;
            found = true;
            break;
        }
    }
    if (!found) {
        select.value = 'manual';
        document.getElementById('ticket-weight-manual').classList.remove('hidden');
        document.getElementById('ticket-weight-manual').value = parseFloat(w) || "";
    } else {
        document.getElementById('ticket-weight-manual').classList.add('hidden');
    }

    // UI Updates
    document.getElementById('editor-title').textContent = "IMPRESIÓN / EDICIÓN";
    document.getElementById('editor-status').textContent = "Editando " + id;
    document.getElementById('editor-actions').classList.remove('hidden'); // Show Print/Delete buttons

    // Bind context actions
    document.getElementById('action-print').onclick = () => printTicket(id);
    document.getElementById('action-share').onclick = () => shareTicketWA(id);
    document.getElementById('action-delete').onclick = () => deleteTicket(id);

    // Highlight sidebar item handled in loadTickets click listener
}

function resetEditor() {
    editingId = null;
    document.getElementById('create-ticket-form').reset();
    document.getElementById('editor-title').textContent = "Nuevo Albarán";
    document.getElementById('editor-status').textContent = "Borrador";
    document.getElementById('editor-actions').classList.add('hidden');

    // Reset sender default
    const inputSender = document.getElementById('ticket-sender');
    if (inputSender) {
        const savedSender = localStorage.getItem('novapack_default_sender');
        if (savedSender) {
            inputSender.value = savedSender;
        } else if (currentUser && currentUser.email) {
            // Default to User's Name
            let name = currentUser.email.split('@')[0];
            name = name.charAt(0).toUpperCase() + name.slice(1);
            inputSender.value = name;
        }
    }

    // Deselect list items
    const list = document.getElementById('tickets-list');
    Array.from(list.children).forEach(c => c.style.background = 'white');
}

// Bind New Button
document.getElementById('action-new').addEventListener('click', resetEditor);
// document.getElementById('new-ticket-btn').addEventListener('click', resetEditor);

function printTicket(id) {
    const data = window.ticketsCache[id];
    if (!data) return;

    const printArea = document.getElementById('print-area');
    const date = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';

    // Template for ONE ticket (half page)
    const ticketTemplate = `
        <div class="print-ticket">
            <div class="print-header">
                <div class="print-logo">NOVA<span>PACK</span></div>
                <div class="print-meta">
                    <strong>Nº Albarán:</strong> ${id.substring(0, 8).toUpperCase()}<br>
                    <strong>Fecha:</strong> ${date}
                </div>
            </div>
            
            <div class="print-row">
                <div class="print-label">Remitente:</div>
                <div class="print-value">NOVAPACK</div>
            </div>
            <div class="print-row">
                <div class="print-label">Destinatario:</div>
                <div class="print-value">
                    <strong>${data.receiver}</strong><br>
                    ${data.address}
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; margin-top:20px;">
                <div class="print-row" style="flex:1; border:none;">
                    <span class="print-label">Bultos:</span> ${data.packages}
                </div>
                 <div class="print-row" style="flex:1; border:none;">
                    <span class="print-label">Peso:</span> ${data.weight}
                </div>
                 <div class="print-row" style="flex:1; border:none;">
                    <span class="print-label">Tamaño:</span> ${data.size || '-'}
                </div>
            </div>

             <div class="print-row">
                <div class="print-label">Portes:</div>
                <div class="print-value">${data.shippingType || 'Pagados'}</div>
            </div>
            ${data.cod ? `
            <div class="print-row">
                <div class="print-label">REEMBOLSO:</div>
                <div class="print-value" style="font-size:14pt; font-weight:bold;">${data.cod} €</div>
            </div>` : ''}

            ${data.notes ? `
            <div class="print-row" style="margin-top:20px;">
                <div class="print-label">Notas:</div>
                <div class="print-value">${data.notes}</div>
            </div>` : ''}

            <div class="print-footer">
                Documento generado electrónicamente por Novapack
            </div>
        </div>
    `;

    // Put TWO copies on the page
    printArea.innerHTML = `
        <div class="print-page">
            ${ticketTemplate}
            <div style="height: 20px;"></div>
            ${ticketTemplate}
        </div>
    `;

    // Generate QRs
    // We need to wait for DOM to render the divs before drawing QR
    setTimeout(() => {
        // Collect all places where we need a QR
        // In this case, I didn't add the div in the template above yet. Let's fix that dynamically?
        // Actually best to re-write the template above to include the QR div.

        // Wait, I haven't added the QR container in the HTML string above.
        // Let's modify the standard printTicket function logic entirely in the next chunk.
    }, 100);
}

// Sharing & Labels
function shareWhatsapp(id) {
    const data = window.ticketsCache[id];
    if (!data) return;

    const text = `*ALBARÁN NOVAPACK*\nRef: ${id}\n\nDestinatario: ${data.receiver}\nDirección: ${data.address}\nBultos: ${data.packages}\nPesa: ${data.weight}\n\nEstado: ${data.status}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

function shareEmail(id) {
    const data = window.ticketsCache[id];
    if (!data) return;

    const subject = `Albarán Novapack: ${data.receiver}`;
    const body = `Hola,\n\nAquí tienes los datos del envío:\n\nRef: ${id}\nDestinatario: ${data.receiver}\nDirección: ${data.address}\nBultos: ${data.packages}\nPaso: ${data.weight}\n\nUn saludo.`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function printLabel(id) {
    const data = window.ticketsCache[id];
    if (!data) return;
    const printArea = document.getElementById('print-area');

    // Label Template (10x15cm approx style)
    printArea.innerHTML = `
        <div class="print-label-page">
            <div class="label-header">
                <div style="font-size: 20pt; font-weight: bold;">NOVAPACK</div>
                <div style="font-size: 10pt;">URGENTE 24H</div>
            </div>
            
            <div class="label-address">
                <strong>${data.receiver}</strong><br>
                ${data.address}
            </div>

            <div style="display: flex; justify-content: space-between; border-top: 2px solid black; border-bottom: 2px solid black; padding: 10px 0; margin-top: 10px;">
                <div>
                     <span style="font-size: 10pt;">BULTOS</span><br>
                     <span class="label-big-text">${data.packages}</span>
                </div>
                <div>
                     <span style="font-size: 10pt;">PESO</span><br>
                     <span class="label-big-text">${data.weight}</span>
                </div>
                <div>
                     <span style="font-size: 10pt;">FECHA</span><br>
                     <span>${new Date().toLocaleDateString()}</span>
                </div>
            </div>

            <div class="label-qr" id="qr-label-${id}"></div>
            <div style="text-align: center; font-size: 0.8rem;">Ref: ${id}</div>

             ${data.cod ? `<div style="text-align: center; font-weight: bold; font-size: 1.5rem; margin-top: 10px; border: 2px solid black;">REEMBOLSO: ${data.cod}€</div>` : ''}
        </div>
    `;

    // Generate QR
    setTimeout(() => {
        new QRCode(document.getElementById(`qr-label-${id}`), {
            text: JSON.stringify({ id: id, receiver: data.receiver, address: data.address }),
            width: 128,
            height: 128
        });
        window.print();
    }, 200);
}

// Override printTicket to include QR
printTicket = function (id) {
    const data = window.ticketsCache[id];
    if (!data) return;

    const printArea = document.getElementById('print-area');
    const date = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';

    const ticketTemplate = (uniqueId, copyType) => `
        <div class="print-ticket">
            <div class="print-header">
                <div class="print-logo" style="display:flex; align-items:center; gap:10px;">
                    <div>NOVA<span>PACK</span></div>
                    <div id="qr-${uniqueId}" style="width: 64px; height: 64px;"></div>
                </div>
                <div class="print-meta">
                    <strong>Nº Albarán:</strong> ${id.substring(0, 8).toUpperCase()}<br>
                    <strong>Fecha:</strong> ${date}
                </div>
            </div>
            
            <div class="print-row">
                <div class="print-label">Remitente:</div>
                <div class="print-value">${data.sender || 'NOVAPACK'}</div>
            </div>
            <div class="print-row">
                <div class="print-label">Destinatario:</div>
                <div class="print-value">
                    <strong>${data.receiver}</strong><br>
                    ${data.address}
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; margin-top:20px;">
                <div class="print-row" style="flex:1; border:none;">
                    <span class="print-label">Bultos:</span> ${data.packages}
                </div>
                 <div class="print-row" style="flex:1; border:none;">
                    <span class="print-label">Peso:</span> ${data.weight}
                </div>
                 <div class="print-row" style="flex:1; border:none;">
                    <span class="print-label">Tamaño:</span> ${data.size || '-'}
                </div>
            </div>

             <div class="print-row">
                <div class="print-label">Portes:</div>
                <div class="print-value">${data.shippingType || 'Pagados'}</div>
            </div>
            ${data.cod ? `
            <div class="print-row">
                <div class="print-label">REEMBOLSO:</div>
                <div class="print-value" style="font-size:14pt; font-weight:bold;">${data.cod} €</div>
            </div>` : ''}

            ${data.notes ? `
            <div class="print-row" style="margin-top:20px;">
                <div class="print-label">Notas:</div>
                <div class="print-value">${data.notes}</div>
            </div>` : ''}

            <div style="margin-top: 20px; border-top: 1px dotted #ccc; padding-top: 10px; display: flex; justify-content: space-between; align-items: flex-end;">
                 <div style="font-size: 0.7rem; color: #666;">
                    Documento generado electrónicamente por Novapack
                 </div>
                 <div style="border: 1px solid #000; width: 150px; height: 60px; display: flex; justify-content: center; align-items: flex-start; padding-top: 5px; font-size: 0.7rem; font-weight: bold;">
                    FIRMA / SELLO
                 </div>
            </div>

            <div class="print-footer" style="text-align: center; font-size: 0.7rem; margin-top: 5px; font-weight: bold; text-transform: uppercase;">
                ${copyType}
            </div>
        </div>
    `;

    printArea.innerHTML = `
        <div class="print-page">
            ${ticketTemplate('copy1', 'EJEMPLAR PARA EL CLIENTE')}
            <div style="height: 10mm; border-bottom: 1px dashed #ccc; margin-bottom: 10mm;"></div>
            ${ticketTemplate('copy2', 'EJEMPLAR PARA ADMINISTRACIÓN')}
        </div>
    `;

    // Generate QRs for both copies
    setTimeout(() => {
        // Updated QR Data to include more specifics as a "digital image" of the data
        const qrPayload = {
            id: id,
            r: data.receiver,
            p: data.packages,
            w: data.weight,
            d: date,
            via: 'Novapack App'
        };
        const qrData = JSON.stringify(qrPayload);
        new QRCode(document.getElementById('qr-copy1'), { text: qrData, width: 64, height: 64 });
        new QRCode(document.getElementById('qr-copy2'), { text: qrData, width: 64, height: 64 });
        window.print();

        // Mark as Printed
        if (!data.printed) {
            db.collection('users').doc(currentUser.uid).collection('tickets').doc(id).update({
                printed: true
            }).then(() => {
                // Update UI without full reload if possible, or just let next reload handle it
                const badge = document.querySelector(`.ticket-card[data-id="${id}"] .ticket-id`);
                // Actually easier to just reload list or rely on reactivity if we had it.
                // For now, let's just update local cache and maybe re-render?
                // Simple: reload tickets to show status update
                // loadTickets(document.getElementById('date-filter').value); // Optional, might disrupt print flow
            });
        }
    }, 200);
}

// Registration logic removed. Only Admin Login supported by default.

// Event Listeners
// Event Listeners - Auth Tabs
document.getElementById('tab-login').addEventListener('click', () => toggleAuthMode(false));
document.getElementById('tab-register').addEventListener('click', () => toggleAuthMode(true));

function toggleAuthMode(registering) {
    isRegistering = registering;
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const submitBtn = document.getElementById('btn-auth-submit');
    const labelUser = document.getElementById('label-username');

    if (registering) {
        tabRegister.style.borderBottomColor = '#FF6600';
        tabRegister.style.color = 'black';
        tabLogin.style.borderBottomColor = 'transparent';
        tabLogin.style.color = '#999';
        submitBtn.textContent = "Registrar Cliente";
        labelUser.textContent = "Nombre de Usuario (será tu login)";
    } else {
        tabLogin.style.borderBottomColor = '#FF6600';
        tabLogin.style.color = 'black';
        tabRegister.style.borderBottomColor = 'transparent';
        tabRegister.style.color = '#999';
        submitBtn.textContent = "Entrar";
        labelUser.textContent = "Usuario / Email";
    }
}

forms.auth.addEventListener('submit', async (e) => {
    e.preventDefault();
    let username = inputs.username.value.trim();
    const password = inputs.password.value;
    const errorDiv = document.getElementById('auth-error');
    errorDiv.classList.add('hidden');

    if (!username || !password) return;

    // Smart email generation
    let email;
    if (username.includes('@')) {
        email = username;
    } else {
        const safeUser = username.replace(/[^a-zA-Z0-9.\-_]/g, '').toLowerCase();
        email = `${safeUser}@novapack.com`;
    }

    try {
        if (isRegistering) {
            // Sign Up Logic
            console.log("Registering new user:", email);
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            // Create initial User Doc (Optional, good for profile data)
            await db.collection('users').doc(userCredential.user.uid).set({
                username: username,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                role: 'client'
            });
            alert("¡Cliente registrado con éxito! Bienvenido.");
            // Auth state listener will handle redirection

        } else {
            // Sign In Logic
            console.log("Attempting login:", email);
            await firebase.auth().signInWithEmailAndPassword(email, password);
            // Auth state listener handles redirect
        }

    } catch (error) {
        console.error("Auth error:", error);

        // Auto-create ADMIN if not found (Legacy Logic preserved for stability)
        const isDefaultAdmin = email === 'admin@novapack.com';

        if (!isRegistering && error.code === 'auth/user-not-found' && isDefaultAdmin) {
            // ... existing admin creation logic if needed, or remove if strictly relying on new flow ...
            // Let's keep the existing nice error handling mostly.
            try {
                await firebase.auth().createUserWithEmailAndPassword(email, password);
                alert("¡Admin creado auto! (Legacy)");
            } catch (e) {
                errorDiv.textContent = "Error creando admin: " + e.message;
                errorDiv.classList.remove('hidden');
            }
            return;
        }

        let msg = "Error: " + error.message;
        if (error.code === 'auth/wrong-password') msg = "Contraseña incorrecta.";
        if (error.code === 'auth/user-not-found') msg = "El usuario no existe.";
        if (error.code === 'auth/email-already-in-use') msg = "Ese usuario ya está registrado.";
        if (error.code === 'auth/weak-password') msg = "La contraseña debe tener al menos 6 caracteres.";

        errorDiv.textContent = msg;
        errorDiv.classList.remove('hidden');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    firebase.auth().signOut();
});

// Event Listeners - UI


// Add New Size Logic


// Increment Packages Logic
document.getElementById('btn-add-package').addEventListener('click', () => {
    const input = document.getElementById('ticket-packages');
    let val = parseInt(input.value);
    if (isNaN(val)) val = 0;
    input.value = val + 1;
});

const closeCreate = () => closeCreateModal();
// document.getElementById('cancel-create').addEventListener('click', closeCreate);
// document.getElementById('cancel-create-header').addEventListener('click', closeCreate);

// WhatsApp Image Sharing Logic
// WhatsApp Sharing Logic (Simplified for Reliability)
function shareTicketWA(id) {
    if (!id && editingId) id = editingId;
    if (!id) return alert("Selecciona un albarán primero.");

    const data = window.ticketsCache[id];
    if (!data) return;

    // Use "customId" (e.g. NOV-0000X) if available, otherwise firestore ID
    const ref = data.customId || id;

    let text = `📦 *ALBARÁN NOVAPACK* 📦\n`;
    text += `*Ref:* ${ref}\n`;
    text += `*Fecha:* ${new Date().toLocaleDateString()}\n\n`;
    text += `👤 *Destinatario:* ${data.receiver}\n`;
    text += `📍 *Dirección:* ${data.address}\n\n`;
    text += `📦 *Bultos:* ${data.packages}\n`;
    text += `⚖️ *Peso:* ${data.weight}\n`;
    text += `🚚 *Portes:* ${data.shippingType}\n`;

    if (data.cod) {
        text += `💰 *REEMBOLSO:* ${data.cod}€ 💰\n`;
    }

    if (data.notes) {
        text += `📝 *Notas:* ${data.notes}\n`;
    }

    text += `\n------------------\n`;
    text += `Generado por Novapack App`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

// document.getElementById('ctx-share-wa').addEventListener('click', () => shareTicketWA());

// Bind the new sidebar button as well if it exists
if (document.getElementById('action-share')) {
    document.getElementById('action-share').addEventListener('click', () => shareTicketWA());
}

document.getElementById('show-config').addEventListener('click', (e) => {
    e.preventDefault();
    showConfig();
});

document.getElementById('close-config').addEventListener('click', () => {
    views.configModal.classList.add('hidden');
});

document.getElementById('save-config').addEventListener('click', () => {
    const val = inputs.config.value.trim();
    if (!val) return;

    try {
        // Attempt to find the object literal in the pasted text
        // This handles "const firebaseConfig = { ... };" or just "{ ... }"
        let configObj;

        // 1. Try strict JSON parse first
        try {
            configObj = JSON.parse(val);
        } catch (e) {
            // 2. If valid JSON fails, try to evaluate as a JS object
            // Use a safe-ish extraction of the object part
            const match = val.match(/{[\s\S]*}/);
            if (match) {
                // Determine if it's safe to eval (it's client side, user provided, so low risk)
                // usage of Function constructor to parse JS object literal
                const objectLiteral = match[0];
                configObj = new Function('return ' + objectLiteral)();
            } else {
                throw new Error("No se encontraron llaves { } de objeto.");
            }
        }

        if (!configObj || !configObj.apiKey) {
            throw new Error("El objeto no parece una configuración de Firebase válida (falta apiKey).");
        }

        localStorage.setItem('novapack_firebase_config', JSON.stringify(configObj));
        location.reload();

    } catch (e) {
        alert("Error al leer la configuración: " + e.message + "\n\nAsegúrate de copiar el bloque {...} completo.");
    }
});

// Tab Logic for Editor
const tabNew = document.getElementById('tab-mode-new');
const tabEdit = document.getElementById('tab-mode-edit');

function setEditorMode(mode) {
    // Reset styles
    [tabNew, tabEdit].forEach(t => {
        t.style.borderBottomColor = 'transparent';
        t.style.color = '#999';
    });

    // Header Actions are independent now

    const form = document.getElementById('create-ticket-form');
    const lblView = document.getElementById('labels-view');

    if (mode === 'new') {
        tabNew.style.borderBottomColor = 'var(--brand-primary)';
        tabNew.style.color = 'var(--brand-primary)';

        form.classList.remove('hidden');
        lblView.classList.add('hidden');

        resetEditor(); // Clears form
        document.querySelectorAll('.ticket-card').forEach(c => c.classList.remove('selected-card'));
        selectedIds.clear();
        updateContextToolbar();

    } else if (mode === 'edit') {
        tabEdit.style.borderBottomColor = 'var(--brand-primary)';
        tabEdit.style.color = 'var(--brand-primary)';

        form.classList.remove('hidden');
        lblView.classList.add('hidden');

        if (!editingId) {
            document.getElementById('editor-title').textContent = "Selecciona un albarán de la lista";
        }
    } else if (mode === 'labels') {
        // Just show the view, don't highlight any edit/new tab
        form.classList.add('hidden');
        lblView.classList.remove('hidden');
        updateLabelView();
    }
}

function updateLabelView() {
    const emptyMsg = document.getElementById('labels-empty');
    const content = document.getElementById('labels-content');

    if (!editingId) {
        emptyMsg.classList.remove('hidden');
        content.classList.add('hidden');
    } else {
        emptyMsg.classList.add('hidden');
        content.classList.remove('hidden');

        const data = window.ticketsCache[editingId];
        if (data) {
            document.getElementById('lbl-ref').textContent = data.customId || editingId;
            document.getElementById('lbl-dest').textContent = data.receiver;
        }
    }
}

if (tabNew) tabNew.addEventListener('click', () => setEditorMode('new'));
if (tabEdit) tabEdit.addEventListener('click', () => setEditorMode('edit'));

// Bind Header Label Button
if (document.getElementById('action-label')) {
    document.getElementById('action-label').addEventListener('click', () => setEditorMode('labels'));
}

if (document.getElementById('btn-print-labels')) {
    document.getElementById('btn-print-labels').addEventListener('click', () => {
        if (editingId) printLabel(editingId);
    });
}

// Hook into editTicket to auto-switch tab
const originalEditTicket = editTicket;
editTicket = function (id) {
    originalEditTicket(id);
    // Always default to Edit View when selecting from sidebar
    setEditorMode('edit');
};

// New Size Logic (Inline)
const btnToggleSize = document.getElementById('btn-toggle-new-size');
const containerNewSize = document.getElementById('new-size-container');
const inputNewSize = document.getElementById('new-size-input');
const btnSaveSize = document.getElementById('btn-save-new-size');

if (btnToggleSize) {
    btnToggleSize.addEventListener('click', () => {
        containerNewSize.classList.toggle('hidden');
        if (!containerNewSize.classList.contains('hidden')) inputNewSize.focus();
    });
}

if (btnSaveSize) {
    btnSaveSize.addEventListener('click', () => {
        const newSize = inputNewSize.value.trim();
        if (newSize) {
            const currentSizes = getSafeStorage('novapack_sizes') || defaultSizes;
            // Avoid duplicates
            if (!currentSizes.includes(newSize)) {
                const newSizesList = currentSizes + ", " + newSize;
                localStorage.setItem('novapack_sizes', newSizesList);
                loadSettings(); // Refresh dropdown
            }
            document.getElementById('ticket-size').value = newSize;
            inputNewSize.value = '';
            containerNewSize.classList.add('hidden');
        }
    });
}

forms.createTicket.addEventListener('submit', createTicket);

// Utilities
function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Reset Handler
document.getElementById('reset-app').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm("¿Seguro que quieres borrar la configuración y reiniciar?")) {
        localStorage.removeItem('novapack_firebase_config');
        location.reload();
    }
});

// Start
loadSettings();
init();
