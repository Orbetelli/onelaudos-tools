// ========================================
// GERADOR DE ASSINATURA
// ========================================

var uploadedImage   = null;
var processedImage  = null;
var uploadedImage2  = null;
var processedImage2 = null;
var originalImage   = null;  // imagem original (antes de remover o fundo)
var originalImage2  = null;

var adjustments = {
    contrast: 200,
    sharpness: 0,
    convertToBlack: false,
    cleanWeakPixels: false,
    autoCrop: false,
    applyPythonFilters: false
};

var professionState = {
    1: { type: 'medico', register: 'CRM', compacto: false, rqeCompacto: false },
    2: { type: 'medico', register: 'CRM', compacto: false, rqeCompacto: false }
};

// Flag: segunda assinatura em modo "modelo pronto"
var sig2ModoModelo = false;

// Atalhos de teclado Ctrl+Z / Ctrl+Y para undo/redo da assinatura dupla
window.addEventListener('keydown', function(e) {
    // Não rouba o Ctrl+Z de campos de texto nem age fora da tela de assinatura
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (!document.getElementById('previewCanvas')) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (sig1Pos) { dragDesfazer(); e.preventDefault(); }
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        if (sig1Pos) { dragRefazer(); e.preventDefault(); }
    }
});

function toggleSig2Modo(on) {
    sig2ModoModelo = on;
    var campos = document.getElementById('sig2CamposNormais');
    var hint   = document.getElementById('sig2ModeloHint');
    var label  = document.getElementById('fileInput2Label');
    if (campos) campos.style.display = on ? 'none' : 'block';
    if (hint)   hint.style.display   = on ? 'block' : 'none';
    if (label)  label.textContent    = on ? '📁 Selecionar Modelo Pronto (PNG)' : '📁 Selecionar Segunda Assinatura';
    // Limpa campos de nome/CRM para não influenciar validação
    if (on) {
        var n2 = document.getElementById('doctorName2');
        var c2 = document.getElementById('doctorCRM2');
        if (n2) n2.value = '';
        if (c2) c2.value = '';
    }
    sigRegenIfReady();
}

function selectProfession(doctorIndex, btn) {
    professionState[doctorIndex].type     = btn.dataset.type;
    professionState[doctorIndex].register = btn.dataset.register;
    var selector = document.getElementById('professionSelector' + doctorIndex);
    selector.querySelectorAll('.profession-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    updateRegisterField(doctorIndex, btn.dataset.register);
    sigRegenIfReady();
}

function updateRegisterField(doctorIndex, register) {
    var suffix = doctorIndex === 1 ? '' : '2';
    var label  = document.getElementById('doctorCRMLabel' + suffix);
    var input  = document.getElementById('doctorCRM' + suffix);
    var placeholders = { CRM: 'Ex: CRM 12345/SP', CRMV: 'Ex: CRMV 98765/SP', CRO: 'Ex: CRO 12345/SP' };
    if (label) label.innerHTML = register + ' com Estado: <span class="register-badge">' + register + '</span>';
    if (input) input.placeholder = placeholders[register] || 'Ex: ' + register + ' 12345/SP';
    atualizarLabelsFormatoCRM(doctorIndex, register);
}

function atualizarLabelsFormatoCRM(doctorIndex, register) {
    var suffixSel = doctorIndex === 1 ? '1' : '2';
    var selector  = document.getElementById('crmFormatoSelector' + suffixSel);
    if (selector) {
        var btnPadrao   = selector.querySelector('[data-formato="padrao"]');
        var btnCompacto = selector.querySelector('[data-formato="compacto"]');
        if (btnPadrao)   btnPadrao.textContent   = 'Padrão (' + register + ': valor)';
        if (btnCompacto) btnCompacto.textContent = 'Compacto (' + register + '/RS 45534)';
    }
    var helper = document.getElementById('crmFormatoHelper' + suffixSel);
    if (helper) {
        var suffixInput = doctorIndex === 1 ? '' : '2';
        var exemplo = suffixInput === '' ? '12345/SP' : '67890/SP';
        helper.innerHTML = '💡 Padrão: digite "' + exemplo + '" → "' + register + ': ' + exemplo + '". Compacto: digite "RS 45534" (sem barra) → "' + register + '/RS 45534"';
    }
}

function selecionarFormatoCRM(doctorIndex, formato, btn) {
    professionState[doctorIndex].compacto = (formato === 'compacto');
    var suffix = doctorIndex === 1 ? '1' : '2';
    var selector = document.getElementById('crmFormatoSelector' + suffix);
    if (selector) selector.querySelectorAll('.profession-btn').forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    sigRegenIfReady();
}

function toggleAddRQE(doctorIndex, checked) {
    var suffixGroup = doctorIndex === 1 ? '1' : '2';   // rqeGroup1 / rqeGroup2
    var suffixInput = doctorIndex === 1 ? '' : '2';    // doctorRQE / doctorRQE2
    var group = document.getElementById('rqeGroup' + suffixGroup);
    if (group) group.classList.toggle('hidden', !checked);
    if (!checked) {
        var input = document.getElementById('doctorRQE' + suffixInput);
        if (input) input.value = '';
    }
    sigRegenIfReady();
}

function selecionarFormatoRQE(doctorIndex, formato, btn) {
    professionState[doctorIndex].rqeCompacto = (formato === 'compacto');
    var suffix = doctorIndex === 1 ? '1' : '2';
    var selector = document.getElementById('rqeFormatoSelector' + suffix);
    if (selector) selector.querySelectorAll('.profession-btn').forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    sigRegenIfReady();
}

function setupEventListeners() {
    function bind(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('change', fn); }
    function bindInput(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('input', fn); }

    bindInput('contrast', function(e) {
        adjustments.contrast = parseInt(e.target.value);
        document.getElementById('contrastValue').textContent = adjustments.contrast + '%';
    });
    bindInput('sharpness', function(e) {
        adjustments.sharpness = parseInt(e.target.value);
        document.getElementById('sharpnessValue').textContent = adjustments.sharpness;
    });
    bind('convertToBlack',    function(e) { adjustments.convertToBlack    = e.target.checked; });
    bind('cleanWeakPixels',   function(e) { adjustments.cleanWeakPixels   = e.target.checked; });
    bind('autoCrop',          function(e) { adjustments.autoCrop          = e.target.checked; });
    bind('applyPythonFilters', function(e) {
        adjustments.applyPythonFilters = e.target.checked;
        var mc = document.getElementById('manualControls');
        mc.style.opacity = e.target.checked ? '0.5' : '1';
        mc.style.pointerEvents = e.target.checked ? 'none' : 'auto';
        document.getElementById('contrast').disabled = e.target.checked;
        document.getElementById('sharpness').disabled = e.target.checked;
    });
    bind('addExtraPhrase', function(e) {
        ['extraPhraseGroup','extraPhrase2Group'].forEach(function(id) {
            document.getElementById(id).classList.toggle('hidden', !e.target.checked);
        });
        if (!e.target.checked) {
            document.getElementById('extraPhrase').value  = '';
            document.getElementById('extraPhrase2').value = '';
        }
    });
    bind('fileInput',  handleFileUpload);
    bind('fileInput2', handleFileUpload2);
    bind('enableSecondSignature', function(e) {
        document.getElementById('doctor2Section').classList.toggle('hidden', !e.target.checked);
        if (!e.target.checked) {
            uploadedImage2 = processedImage2 = null;
            ['doctorName2','doctorCRM2','doctorRQE2'].forEach(function(id) { document.getElementById(id).value = ''; });
            document.getElementById('fileName2').textContent = '';
            document.getElementById('imagePreviewContainer2').style.display = 'none';
            document.getElementById('removeBgBtn2').classList.add('hidden');
            professionState[2] = { type: 'medico', register: 'CRM', compacto: false, rqeCompacto: false };
            var sel2 = document.getElementById('professionSelector2');
            sel2.querySelectorAll('.profession-btn').forEach(function(b) { b.classList.remove('active'); });
            sel2.querySelector('[data-type="medico"]').classList.add('active');
            updateRegisterField(2, 'CRM');
            var crmSel2 = document.getElementById('crmFormatoSelector2');
            if (crmSel2) {
                crmSel2.querySelectorAll('.profession-btn').forEach(function(b) { b.classList.remove('active'); });
                crmSel2.querySelector('[data-formato="padrao"]').classList.add('active');
            }
            var rqeSel2 = document.getElementById('rqeFormatoSelector2');
            if (rqeSel2) {
                rqeSel2.querySelectorAll('.profession-btn').forEach(function(b) { b.classList.remove('active'); });
                rqeSel2.querySelector('[data-formato="padrao"]').classList.add('active');
            }
            var addRQE2cb = document.getElementById('addRQE2');
            if (addRQE2cb) addRQE2cb.checked = false;
            var rqeGroup2 = document.getElementById('rqeGroup2');
            if (rqeGroup2) rqeGroup2.classList.add('hidden');
            // Reseta o slider de tamanho da assinatura 2
            var sigSize2El = document.getElementById('sigSize2');
            if (sigSize2El) {
                sigSize2El.value = 100;
                var sigSize2ValEl = document.getElementById('sigSize2Val');
                if (sigSize2ValEl) sigSize2ValEl.textContent = '100%';
            }
            // Esconde undo/redo
            var undoWrap = document.getElementById('sig_undoredo_wrap');
            if (undoWrap) undoWrap.style.display = 'none';
            dragResetarHistorico();
            // Reseta modo modelo pronto
            sig2ModoModelo = false;
            var cb = document.getElementById('sig2ModeloPronto');
            if (cb) cb.checked = false;
            toggleSig2Modo(false);
        }
    });

    // ── Preview ao vivo: regenera a assinatura enquanto o usuário digita ──
    var previewDelay;
    function triggerLivePreview() {
        clearTimeout(previewDelay);
        previewDelay = setTimeout(function() { sigRegenIfReady(); }, 400);
    }
    ['doctorName', 'doctorCRM', 'doctorName2', 'doctorCRM2',
     'extraPhrase', 'extraPhrase2', 'doctorRQE', 'doctorRQE2'].forEach(function(id) {
        bindInput(id, triggerLivePreview);
    });
}

function handleFileUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    document.getElementById('fileName').textContent = 'Arquivo: ' + file.name;
    var reader = new FileReader();
    reader.onload = function(ev) {
        var img = new Image();
        img.onload = function() {
            uploadedImage = originalImage = img; processedImage = null;
            document.getElementById('imagePreview').src = ev.target.result;
            document.getElementById('imagePreviewContainer').style.display = 'block';
            document.getElementById('removeBgBtn').classList.remove('hidden');
            showMessage('Imagem carregada!', 'success');
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

function handleFileUpload2(e) {
    var file = e.target.files[0];
    if (!file) return;
    document.getElementById('fileName2').textContent = 'Arquivo: ' + file.name;
    var reader = new FileReader();
    reader.onload = function(ev) {
        var img = new Image();
        img.onload = function() {
            uploadedImage2 = originalImage2 = img; processedImage2 = null;
            document.getElementById('imagePreview2').src = ev.target.result;
            document.getElementById('imagePreviewContainer2').style.display = 'block';
            document.getElementById('removeBgBtn2').classList.remove('hidden');
            showMessage('Segunda imagem carregada!', 'success');
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

function showMessage(text, type) {
    var container = document.getElementById('messageContainer');
    if (!container) return;
    container.textContent = '';
    var msg = document.createElement('div');
    msg.className = 'message message-' + type;
    msg.textContent = text;
    container.appendChild(msg);
    setTimeout(function() { container.textContent = ''; }, 5000);
}

// ── Dados brutos para o slider de threshold ──────────────────────────────────
var bgRawData1 = null; // { lums, bgLum, origData, W, H }
var bgRawData2 = null;

function removeBgHelper(img, onDone, onRawReady) {
    var canvas = document.createElement('canvas');
    var ctx    = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = img.width; canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var data = imageData.data;
    var W = canvas.width, H = canvas.height;
    var total = W * H;

    // ── 1. Luminância perceptual de cada pixel (BT.601) ──────────────────────
    var lums = new Uint8Array(total);
    for (var i = 0; i < total; i++) {
        lums[i] = Math.round(0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2]);
    }

    // ── 2. Moda do histograma = cor do fundo ─────────────────────────────────
    var hist = new Int32Array(256);
    for (var i = 0; i < total; i++) hist[lums[i]]++;
    var histSmooth = new Float32Array(256);
    for (var v = 0; v < 256; v++) {
        var soma = 0, cnt = 0;
        for (var k = -2; k <= 2; k++) {
            var idx = v + k;
            if (idx >= 0 && idx < 256) { soma += hist[idx]; cnt++; }
        }
        histSmooth[v] = soma / cnt;
    }
    var bgLum = 0, maxFreq = 0;
    for (var v = 0; v < 256; v++) {
        if (histSmooth[v] > maxFreq) { maxFreq = histSmooth[v]; bgLum = v; }
    }

    // ── 3. Threshold automático (usado na primeira passada) ──────────────────
    var fundoEscuro = bgLum < 128;
    var inkLum = bgLum;
    if (fundoEscuro) {
        for (var v = 255; v > bgLum; v--) { if (hist[v] > total * 0.005) { inkLum = v; break; } }
    } else {
        for (var v = 0; v < bgLum; v++) { if (hist[v] > total * 0.005) { inkLum = v; break; } }
    }
    var range = Math.abs(bgLum - inkLum);
    var autoThreshold = Math.min(100, Math.max(12, Math.round(range * 0.35)));

    // ── 4. Salva dados originais (RGB) para o slider poder reaplicar ─────────
    var origData = new Uint8ClampedArray(data);
    if (onRawReady) onRawReady({ lums: lums, bgLum: bgLum, origData: origData, W: W, H: H, canvas: canvas, ctx: ctx });

    // ── 5. Aplica threshold automático na primeira vez ───────────────────────
    bgAplicarThreshold(data, lums, bgLum, autoThreshold);

    ctx.putImageData(imageData, 0, 0);
    var url    = canvas.toDataURL('image/png');
    var newImg = new Image();
    newImg.onload = function() { onDone(newImg, url, autoThreshold); };
    newImg.src = url;
}

// Aplica um threshold específico nos dados de pixel
function bgAplicarThreshold(data, lums, bgLum, threshold) {
    var fadeZone = Math.max(6, Math.round(threshold * 0.25));
    var total = lums.length;
    for (var i = 0; i < total; i++) {
        var diff = Math.abs(lums[i] - bgLum);
        if (diff <= threshold) {
            data[i*4+3] = 0;
        } else if (diff <= threshold + fadeZone) {
            var t = (diff - threshold) / fadeZone;
            data[i*4+3] = Math.round(t * 255);
        } else {
            data[i*4+3] = 255;
        }
    }
}

// Reaplicar threshold quando o slider é movido
function bgThresholdAtualizar(sig) {
    var raw       = sig === 1 ? bgRawData1 : bgRawData2;
    var sliderId  = sig === 1 ? 'bgThreshold'       : 'bgThreshold2';
    var labelId   = sig === 1 ? 'bgThresholdValue'  : 'bgThresholdValue2';
    var previewId = sig === 1 ? 'imagePreview'      : 'imagePreview2';
    if (!raw) return;

    var threshold = parseInt(document.getElementById(sliderId).value);
    document.getElementById(labelId).textContent = threshold;

    // Restaura dados originais e reaaplica novo threshold
    var newData = new Uint8ClampedArray(raw.origData);
    bgAplicarThreshold(newData, raw.lums, raw.bgLum, threshold);

    var imageData = new ImageData(newData, raw.W, raw.H);
    raw.ctx.putImageData(imageData, 0, 0);
    var url = raw.canvas.toDataURL('image/png');

    document.getElementById(previewId).src = url;

    // Atualiza a imagem processada em memória
    var newImg = new Image();
    newImg.onload = function() {
        if (sig === 1) { processedImage = uploadedImage = newImg; }
        else           { processedImage2 = uploadedImage2 = newImg; }
    };
    newImg.src = url;
}

function removeBackground() {
    if (!uploadedImage) { showMessage('Selecione uma imagem primeiro!', 'error'); return; }
    var btn  = document.getElementById('removeBgBtn');
    var prog = document.getElementById('modelProgress');
    var bar  = document.getElementById('progressBar');
    var pct  = document.getElementById('progressPercent');
    btn.disabled = true;
    prog.classList.remove('hidden');
    document.getElementById('progressText').textContent = 'Removendo fundo...';
    bar.style.width = '50%'; pct.textContent = '50%';
    try {
        removeBgHelper(originalImage,
            function(newImg, url, autoThreshold) {
                processedImage = uploadedImage = newImg;
                document.getElementById('imagePreview').src = url;
                document.getElementById('adjustmentSection').classList.remove('hidden');
                // Mostra e inicializa o slider
                var sec = document.getElementById('bgThresholdSection');
                if (sec) {
                    sec.classList.remove('hidden');
                    var sl = document.getElementById('bgThreshold');
                    sl.value = autoThreshold;
                    document.getElementById('bgThresholdValue').textContent = autoThreshold;
                }
                prog.classList.add('hidden');
                bar.style.width = '0%'; pct.textContent = '0%';
                showMessage('Fundo removido! Use o slider para ajustar.', 'success');
                btn.disabled = false;
            },
            function(raw) { bgRawData1 = raw; }
        );
    } catch(e) {
        prog.classList.add('hidden');
        showMessage('Erro: ' + e.message, 'error');
        btn.disabled = false;
    }
}

function removeBackground2() {
    if (!uploadedImage2) { showMessage('Selecione a segunda imagem primeiro!', 'error'); return; }
    var btn  = document.getElementById('removeBgBtn2');
    var prog = document.getElementById('modelProgress');
    var bar  = document.getElementById('progressBar');
    var pct  = document.getElementById('progressPercent');
    btn.disabled = true;
    prog.classList.remove('hidden');
    document.getElementById('progressText').textContent = 'Removendo fundo da segunda assinatura...';
    bar.style.width = '50%'; pct.textContent = '50%';
    try {
        removeBgHelper(originalImage2,
            function(newImg, url, autoThreshold) {
                processedImage2 = uploadedImage2 = newImg;
                document.getElementById('imagePreview2').src = url;
                // Mostra e inicializa o slider
                var sec = document.getElementById('bgThresholdSection2');
                if (sec) {
                    sec.classList.remove('hidden');
                    var sl = document.getElementById('bgThreshold2');
                    sl.value = autoThreshold;
                    document.getElementById('bgThresholdValue2').textContent = autoThreshold;
                }
                prog.classList.add('hidden');
                bar.style.width = '0%'; pct.textContent = '0%';
                showMessage('Fundo da segunda assinatura removido!', 'success');
                btn.disabled = false;
            },
            function(raw) { bgRawData2 = raw; }
        );
    } catch(e) {
        prog.classList.add('hidden');
        showMessage('Erro: ' + e.message, 'error');
        btn.disabled = false;
    }
}

function resetAdjustments() {
    adjustments = { contrast:200, sharpness:0, convertToBlack:false, cleanWeakPixels:false, autoCrop:false, applyPythonFilters:false };
    document.getElementById('contrast').value = 200;
    document.getElementById('sharpness').value = 0;
    document.getElementById('contrastValue').textContent  = '200%';
    document.getElementById('sharpnessValue').textContent = '0';
    ['convertToBlack','cleanWeakPixels','autoCrop','applyPythonFilters'].forEach(function(id) {
        document.getElementById(id).checked = false;
    });
    var mc = document.getElementById('manualControls');
    mc.style.opacity = '1'; mc.style.pointerEvents = 'auto';
    document.getElementById('contrast').disabled  = false;
    document.getElementById('sharpness').disabled = false;
    showMessage('Ajustes restaurados!', 'success');
}

function applyFiltersPreview() {
    if (!uploadedImage) { showMessage('Selecione uma imagem primeiro!', 'error'); return; }
    var loading = document.getElementById('loading');
    loading.style.display = 'block';
    document.getElementById('loadingText').textContent = 'Aplicando filtros...';
    setTimeout(function() {
        try {
            var canvas = document.createElement('canvas');
            var ctx    = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
            canvas.width = uploadedImage.width; canvas.height = uploadedImage.height;
            ctx.drawImage(uploadedImage, 0, 0);
            applyAllFilters(canvas, ctx);
            document.getElementById('imagePreview').src = canvas.toDataURL('image/png');
            showMessage('Filtros aplicados!', 'success');
        } catch(e) {
            showMessage('Erro: ' + e.message, 'error');
        } finally {
            loading.style.display = 'none';
        }
    }, 100);
}

function applyThreshold(imageData, threshold) {
    var data = imageData.data;
    threshold = threshold || 180;
    for (var i = 0; i < data.length; i += 4) {
        if (data[i+3] === 0) continue;
        var brilho = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
        if (brilho >= threshold) {
            data[i+3] = 0; // pixel claro → transparente
        }
    }
    return imageData;
}

function applyContrast(imageData, contrastValue) {
    var data = imageData.data, factor = contrastValue / 100;
    for (var i = 0; i < data.length; i += 4) {
        if (data[i+3] === 0) continue;
        data[i]   = Math.max(0, Math.min(255, ((data[i]   - 128) * factor) + 128));
        data[i+1] = Math.max(0, Math.min(255, ((data[i+1] - 128) * factor) + 128));
        data[i+2] = Math.max(0, Math.min(255, ((data[i+2] - 128) * factor) + 128));
    }
    return imageData;
}

function applySharpness(canvas, sharpnessValue) {
    if (sharpnessValue === 0) return canvas;
    var ctx = canvas.getContext('2d', { willReadFrequently: true }), W = canvas.width, H = canvas.height;
    var orig = ctx.getImageData(0, 0, W, H);
    var blur = document.createElement('canvas'); blur.width = W; blur.height = H;
    var bctx = blur.getContext('2d');
    bctx.filter = 'blur(' + (sharpnessValue > 10 ? '2px' : '1px') + ')';
    bctx.drawImage(canvas, 0, 0); bctx.filter = 'none';
    var blurData = bctx.getImageData(0, 0, W, H), amt = sharpnessValue / 3;
    for (var i = 0; i < orig.data.length; i += 4)
        for (var j = 0; j < 3; j++)
            orig.data[i+j] = Math.max(0, Math.min(255, orig.data[i+j] + (orig.data[i+j] - blurData.data[i+j]) * amt));
    ctx.putImageData(orig, 0, 0);
    return canvas;
}

// Amplifica o canal alpha dos pixels semi-transparentes da tinta
function boostAlpha(imageData) {
    var data = imageData.data;
    for (var i = 0; i < data.length; i += 4) {
        if (data[i+3] === 0) continue;
        data[i+3] = 255;
    }
    return imageData;
}

function convertToBlackPure(imageData) {
    var data = imageData.data;
    for (var i = 0; i < data.length; i += 4)
        if (data[i+3] > 0) { data[i] = 0; data[i+1] = 0; data[i+2] = 0; }
    return imageData;
}

function cleanWeakPixelsFn(imageData, threshold) {
    threshold = threshold || 15;
    var data = imageData.data;
    for (var i = 0; i < data.length; i += 4) if (data[i+3] < threshold) data[i+3] = 0;
    return imageData;
}

function autoCropCanvas(canvas, margin) {
    margin = margin || 15;
    var ctx = canvas.getContext('2d', { willReadFrequently: true }), W = canvas.width, H = canvas.height;
    var data = ctx.getImageData(0, 0, W, H).data;
    var minX = W, minY = H, maxX = 0, maxY = 0, has = false;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 0) {
        has = true;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (!has) return canvas;
    minX = Math.max(0, minX - margin); minY = Math.max(0, minY - margin);
    maxX = Math.min(W - 1, maxX + margin); maxY = Math.min(H - 1, maxY + margin);
    var cW = maxX - minX + 1, cH = maxY - minY + 1;
    var cc = document.createElement('canvas'); cc.width = cW; cc.height = cH;
    cc.getContext('2d').drawImage(canvas, minX, minY, cW, cH, 0, 0, cW, cH);
    return cc;
}

function applyAllFilters(canvas, ctx) {
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (adjustments.applyPythonFilters) {
        imageData = boostAlpha(imageData);
        imageData = applyContrast(imageData, 400);
        ctx.putImageData(imageData, 0, 0);
        applySharpness(canvas, 15);
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        imageData = applyThreshold(imageData, 160);
        imageData = convertToBlackPure(imageData);
        ctx.putImageData(imageData, 0, 0);
    } else {
        imageData = boostAlpha(imageData);

        if (adjustments.contrast !== 200) {
            imageData = applyContrast(imageData, adjustments.contrast);
        }
        ctx.putImageData(imageData, 0, 0);

        if (adjustments.sharpness > 0) applySharpness(canvas, adjustments.sharpness);

        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        imageData = applyThreshold(imageData, 230);
        ctx.putImageData(imageData, 0, 0);
    }

    if (adjustments.cleanWeakPixels) {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        imageData = cleanWeakPixelsFn(imageData, 15);
        ctx.putImageData(imageData, 0, 0);
    }

    if (adjustments.convertToBlack) {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        imageData = convertToBlackPure(imageData);
        ctx.putImageData(imageData, 0, 0);
    }

    if (adjustments.autoCrop) return autoCropCanvas(canvas, 15);
    return canvas;
}

function getSelectedFont() { var sel=document.getElementById('fontSelector'); return sel?sel.value:'Arial'; }

function getSigGap() { var sel=document.getElementById('sigGap'); return sel ? parseInt(sel.value) : 5; }

function buildSignatureText(name,regVal,regType,e1,e2,compacto,rqeVal,rqeCompacto) {
    var t = name;
    if(e2) t+='\n'+e2;
    if (compacto) {
        var valorLimpo = regVal.replace(/^\/+/, ''); // remove barra caso o usuário digite por engano
        t += '\n' + regType + '/' + valorLimpo;
    } else {
        t += '\n' + regType + ': ' + regVal;
    }
    if (rqeVal) {
        var rqeLimpo = rqeVal.replace(/^\/+/, '');
        t += '\n' + (rqeCompacto ? ('RQE/' + rqeLimpo) : ('RQE: ' + rqeVal));
    }
    if(e1) t+='\n'+e1;
    return t;
}

function generateSignature() {
    if (!uploadedImage) { showMessage('Selecione uma imagem primeiro!','error'); return; }
    var name=document.getElementById('doctorName').value.trim();
    var crm =document.getElementById('doctorCRM').value.trim();
    if (!name||!crm) { showMessage('Preencha nome e '+professionState[1].register+'!','error'); return; }
    var has2=document.getElementById('enableSecondSignature').checked;
    if (has2) {
        if (!uploadedImage2) { showMessage('Selecione a segunda imagem!','error'); return; }
        if (!sig2ModoModelo) {
            if (!document.getElementById('doctorName2').value.trim()||!document.getElementById('doctorCRM2').value.trim()) {
                showMessage('Preencha dados da segunda assinatura!','error'); return;
            }
        }
    }
    var loading=document.getElementById('loading'), btn=document.getElementById('generateBtn');
    loading.style.display='block'; document.getElementById('loadingText').textContent='Gerando...'; btn.disabled=true;
    try {
        has2?createDoubleSignature(name,crm):createFinalSignature(name,crm);
        showMessage('Assinatura gerada!','success');
        document.getElementById('downloadBtn').classList.remove('hidden');
    } catch(e) { showMessage('Erro: '+e.message,'error'); }
    finally { loading.style.display='none'; btn.disabled=false; }
}

function createFinalSignature(name,crm) {
    var fc=document.getElementById('previewCanvas'), ctx=fc.getContext('2d',{alpha:true});
    fc.width=600; fc.height=120; ctx.fillStyle='white'; ctx.fillRect(0,0,600,120);
    processImageAndDraw(uploadedImage,fc,ctx,name,crm);
}

function createDoubleSignature(name,crm) {
    var fc=document.getElementById('previewCanvas'), ctx=fc.getContext('2d',{alpha:true});
    fc.width=600; fc.height=120; ctx.fillStyle='white'; ctx.fillRect(0,0,600,120);
    processDoubleImages(uploadedImage,uploadedImage2,fc,ctx,name,crm);
}

function processImageAndDraw(src,fc,ctx,name,crm) {
    var tc=document.createElement('canvas'), tctx=tc.getContext('2d',{alpha:true,willReadFrequently:true});
    tc.width=src.width; tc.height=src.height; tctx.drawImage(src,0,0);
    var pc=applyAllFilters(tc,tctx);
    var sigScale = (document.getElementById('sigSize') ? parseInt(document.getElementById('sigSize').value) : 100) / 100;
    var W=fc.width,H=fc.height,mW=Math.floor(280*sigScale),mH=Math.floor(50*sigScale);
    var ratio=Math.min(mW/pc.width,mH/pc.height,1.0);
    var nW=Math.floor(pc.width*ratio), nH=Math.floor(pc.height*ratio);
    var addX=document.getElementById('addExtraPhrase').checked;
    var e1=addX?document.getElementById('extraPhrase').value.trim():'';
    var e2=addX?document.getElementById('extraPhrase2').value.trim():'';
    var addRQE1=document.getElementById('addRQE1').checked;
    var rqe1=addRQE1?document.getElementById('doctorRQE').value.trim():'';
    var text=buildSignatureText(name,crm,professionState[1].register,e1,e2,professionState[1].compacto,rqe1,professionState[1].rqeCompacto);
    var lines=text.split('\n'), mg=getSigGap(), hC=nH+mg+lines.length*13;
    var xS=Math.floor((W-nW)/2), yS=Math.floor((H-hC)/2);

    // Posição rastreável (permite arrastar mesmo com uma única assinatura)
    sig1Pos = { x: xS, y: yS, w: nW, h: nH, lines: lines, mg: mg };
    sig2Pos = null;

    doubleCtx  = ctx;
    doubleData = { fc: fc, pc1: pc, pc2: null, W: W, H: H, font: getSelectedFont() };

    drawSignatures();
    fc.style.display='block';

    var hint = document.getElementById('canvasDragHint');
    if (hint) hint.style.display = 'block';

    var undoWrap = document.getElementById('sig_undoredo_wrap');
    if (undoWrap) undoWrap.style.display = 'flex';
    dragResetarHistorico();

    fc.onmousedown  = onSigMouseDown;
    fc.onmousemove  = onSigMouseMove;
    fc.onmouseup    = onSigMouseUp;
    fc.onmouseleave = onSigMouseUp;
    fc.ontouchstart = onSigTouchStart;
    fc.ontouchmove  = onSigTouchMove;
    fc.ontouchend   = onSigMouseUp;
}

// ── Estado do drag & drop das assinaturas duplas ──
var dragState = {
    active: false,
    which: null,       // 1 ou 2
    offsetX: 0, offsetY: 0
};
var sig1Pos = null;    // { x, y, w, h } — posição atual da assinatura 1
var sig2Pos = null;    // { x, y, w, h } — posição atual da assinatura 2
var doubleCtx = null;  // contexto salvo para redesenho
var doubleData = null; // dados salvos para redesenho

// ── Histórico de undo/redo (posições do drag) ──
var dragHistorico  = [];
var dragFuturo     = [];
var DRAG_MAX_HIST  = 20;

function dragSalvarEstado() {
    if (!sig1Pos) return;
    dragHistorico.push({
        s1: { x: sig1Pos.x, y: sig1Pos.y },
        s2: sig2Pos ? { x: sig2Pos.x, y: sig2Pos.y } : null
    });
    if (dragHistorico.length > DRAG_MAX_HIST) dragHistorico.shift();
    dragFuturo = []; // limpa redo ao fazer nova ação
    dragAtualizarBotoes();
}

function dragDesfazer() {
    if (!dragHistorico.length || !sig1Pos) return;
    // Salva estado atual no futuro antes de desfazer
    dragFuturo.push({
        s1: { x: sig1Pos.x, y: sig1Pos.y },
        s2: sig2Pos ? { x: sig2Pos.x, y: sig2Pos.y } : null
    });
    var anterior = dragHistorico.pop();
    sig1Pos.x = anterior.s1.x; sig1Pos.y = anterior.s1.y;
    if (sig2Pos && anterior.s2) { sig2Pos.x = anterior.s2.x; sig2Pos.y = anterior.s2.y; }
    drawSignatures();
    dragAtualizarBotoes();
}

function dragRefazer() {
    if (!dragFuturo.length || !sig1Pos) return;
    dragHistorico.push({
        s1: { x: sig1Pos.x, y: sig1Pos.y },
        s2: sig2Pos ? { x: sig2Pos.x, y: sig2Pos.y } : null
    });
    var proximo = dragFuturo.pop();
    sig1Pos.x = proximo.s1.x; sig1Pos.y = proximo.s1.y;
    if (sig2Pos && proximo.s2) { sig2Pos.x = proximo.s2.x; sig2Pos.y = proximo.s2.y; }
    drawSignatures();
    dragAtualizarBotoes();
}

function dragAtualizarBotoes() {
    var btnU = document.getElementById('sig_undo_btn');
    var btnR = document.getElementById('sig_redo_btn');
    if (btnU) btnU.disabled = dragHistorico.length === 0;
    if (btnR) btnR.disabled = dragFuturo.length === 0;
}

function dragResetarHistorico() {
    dragHistorico = [];
    dragFuturo    = [];
    dragAtualizarBotoes();
}

function processDoubleImages(s1,s2,fc,ctx,n1,c1) {
    var mk=function(img){
        var tc=document.createElement('canvas'),tctx=tc.getContext('2d',{alpha:true,willReadFrequently:true});
        tc.width=img.width;tc.height=img.height;tctx.drawImage(img,0,0);return applyAllFilters(tc,tctx);
    };

    // ── Escala independente para cada assinatura ──
    // Assinatura 1 usa o slider "sigSize", assinatura 2 usa o slider "sigSize2".
    // Assim é possível aumentar/diminuir uma sem afetar a outra.
    var sigScale1 = (document.getElementById('sigSize')  ? parseInt(document.getElementById('sigSize').value)  : 100) / 100;
    var sigScale2 = (document.getElementById('sigSize2') ? parseInt(document.getElementById('sigSize2').value) : 100) / 100;

    var pc1=mk(s1),pc2=mk(s2),W=fc.width,H=fc.height;

    var mW1=Math.floor(240*sigScale1), mH1=Math.floor(50*sigScale1);
    var mW2=Math.floor(240*sigScale2), mH2=Math.floor(50*sigScale2);

    var r1=Math.min(mW1/pc1.width,mH1/pc1.height,1),nW1=Math.floor(pc1.width*r1),nH1=Math.floor(pc1.height*r1);
    var r2=Math.min(mW2/pc2.width,mH2/pc2.height,1),nW2=Math.floor(pc2.width*r2),nH2=Math.floor(pc2.height*r2);
    var n2=document.getElementById('doctorName2').value.trim();
    var c2=document.getElementById('doctorCRM2').value.trim();
    var addX=document.getElementById('addExtraPhrase').checked;
    var e1=addX?document.getElementById('extraPhrase').value.trim():'';
    var e2=addX?document.getElementById('extraPhrase2').value.trim():'';
    var addRQE1=document.getElementById('addRQE1').checked;
    var rqe1=addRQE1?document.getElementById('doctorRQE').value.trim():'';
    var addRQE2=document.getElementById('addRQE2')?document.getElementById('addRQE2').checked:false;
    var rqe2=addRQE2?document.getElementById('doctorRQE2').value.trim():'';
    var t1=buildSignatureText(n1,c1,professionState[1].register,e1,'',professionState[1].compacto,rqe1,professionState[1].rqeCompacto);
    var t2 = sig2ModoModelo ? '' : buildSignatureText(n2,c2,professionState[2].register,e2,'',professionState[2].compacto,rqe2,professionState[2].rqeCompacto);
    var l1=t1.split('\n'), l2= sig2ModoModelo ? [] : t2.split('\n'), mg=getSigGap();
    var hC1=nH1+mg+l1.length*13, hC2=nH2+(sig2ModoModelo?0:mg+l2.length*13);

    var totalW = nW1 + nW2;
    var gap    = Math.max(0, Math.floor((W - totalW) / 3));
    var x1 = gap;
    var x2 = gap + nW1 + gap;

    sig1Pos = { x: x1, y: Math.floor((H-hC1)/2), w: nW1, h: nH1, lines: l1, mg: mg };
    sig2Pos = { x: x2, y: Math.floor((H-hC2)/2), w: nW2, h: nH2, lines: l2, mg: mg };

    doubleCtx = ctx;
    doubleData = { fc: fc, pc1: pc1, pc2: pc2, W: W, H: H, font: getSelectedFont() };

    drawSignatures();
    fc.style.display='block';

    var hint = document.getElementById('canvasDragHint');
    if (hint) hint.style.display = 'block';

    var undoWrap = document.getElementById('sig_undoredo_wrap');
    if (undoWrap) undoWrap.style.display = 'flex';
    dragResetarHistorico();

    fc.onmousedown  = onSigMouseDown;
    fc.onmousemove  = onSigMouseMove;
    fc.onmouseup    = onSigMouseUp;
    fc.onmouseleave = onSigMouseUp;
    fc.ontouchstart = onSigTouchStart;
    fc.ontouchmove  = onSigTouchMove;
    fc.ontouchend   = onSigMouseUp;
}

function drawSignatures() {
    if (!doubleCtx || !doubleData || !sig1Pos) return;
    var ctx=doubleCtx, d=doubleData, W=d.W, H=d.H;
    var p1=sig1Pos;

    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='white'; ctx.fillRect(0,0,W,H);
    ctx.font='bold 11px "'+d.font+'"'; ctx.fillStyle='black'; ctx.textAlign='center';
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';

    ctx.drawImage(d.pc1,0,0,d.pc1.width,d.pc1.height, p1.x, p1.y, p1.w, p1.h);
    p1.lines.forEach(function(l,i){ ctx.fillText(l, p1.x+p1.w/2, p1.y+p1.h+p1.mg+11+(i*13)); });

    if (d.pc2 && sig2Pos) {
        var p2=sig2Pos;
        ctx.drawImage(d.pc2,0,0,d.pc2.width,d.pc2.height, p2.x, p2.y, p2.w, p2.h);
        p2.lines.forEach(function(l,i){ ctx.fillText(l, p2.x+p2.w/2, p2.y+p2.h+p2.mg+11+(i*13)); });
    }
}

function getSigAtPoint(x, y) {
    function hits(p) {
        var textH = p.lines.length * 13 + p.mg + 15;
        return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h + textH;
    }
    if (sig1Pos && hits(sig1Pos)) return 1;
    if (sig2Pos && hits(sig2Pos)) return 2;
    return null;
}

function getCanvasXY(fc, e) {
    var rect = fc.getBoundingClientRect();
    var scaleX = fc.width  / rect.width;
    var scaleY = fc.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top)  * scaleY
    };
}

function onSigMouseDown(e) {
    var pt = getCanvasXY(this, e);
    var which = getSigAtPoint(pt.x, pt.y);
    if (!which) return;
    var pos = which === 1 ? sig1Pos : sig2Pos;
    dragState.active  = true;
    dragState.which   = which;
    dragState.offsetX = pt.x - pos.x;
    dragState.offsetY = pt.y - pos.y;
    this.style.cursor = 'grabbing';
    if (e.preventDefault) e.preventDefault();
}

function onSigMouseMove(e) {
    if (!dragState.active) {
        var pt = getCanvasXY(this, e);
        this.style.cursor = getSigAtPoint(pt.x, pt.y) ? 'grab' : 'default';
        return;
    }
    var pt = getCanvasXY(this, e);
    var pos = dragState.which === 1 ? sig1Pos : sig2Pos;
    var W = doubleData ? doubleData.W : 600;
    var H = doubleData ? doubleData.H : 120;
    pos.x = Math.max(0, Math.min(W - pos.w, pt.x - dragState.offsetX));
    pos.y = Math.max(0, Math.min(H - pos.h - pos.lines.length*13 - pos.mg - 5, pt.y - dragState.offsetY));
    drawSignatures();
    if (e.preventDefault) e.preventDefault();
}

function onSigMouseUp() {
    if (dragState.active) dragSalvarEstado();
    dragState.active = false;
    dragState.which  = null;
    if (this && this.style) this.style.cursor = 'grab';
}

function onSigTouchStart(e) {
    if (e.touches.length !== 1) return;
    onSigMouseDown.call(this, e.touches[0]);
}

function onSigTouchMove(e) {
    if (e.touches.length !== 1) return;
    onSigMouseMove.call(this, e.touches[0]);
}

function sigRegenIfReady() {
    var canvas = document.getElementById('previewCanvas');
    if (!canvas || canvas.style.display === 'none' || !uploadedImage) return;
    var name = document.getElementById('doctorName').value.trim();
    var crm  = document.getElementById('doctorCRM').value.trim();
    if (!name || !crm) return;
    var has2 = document.getElementById('enableSecondSignature').checked;
    if (has2) {
        if (!uploadedImage2) return;
        if (!sig2ModoModelo) {
            if (!document.getElementById('doctorName2').value.trim()) return;
            if (!document.getElementById('doctorCRM2').value.trim()) return;
        }
        sig1Pos = null; sig2Pos = null;
        createDoubleSignature(name, crm);
    } else {
        createFinalSignature(name, crm);
    }
}

function downloadImage() {
    var canvas=document.getElementById('previewCanvas');
    var name=document.getElementById('doctorName').value.trim()||'Assinatura';
    canvas.toBlob(function(blob){
        var url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url; a.download='Assinatura - '+name+'.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showMessage('Download iniciado!','success');
    },'image/png');
}
// ========================================
// TELA (Onelaudos Tools)
// ========================================

function setupEventListenersExtras() {
    var atraso;
    function regen() { clearTimeout(atraso); atraso = setTimeout(sigRegenIfReady, 250); }
    [['sigSize', 'sigSizeVal'], ['sigSize2', 'sigSize2Val']].forEach(function (par) {
        var sl = document.getElementById(par[0]);
        if (!sl) return;
        sl.addEventListener('input', function () {
            document.getElementById(par[1]).textContent = sl.value + '%';
            regen();
        });
    });
    ['fontSelector', 'sigGap'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', sigRegenIfReady);
    });
}

// Ao abrir a aba, o HTML é recriado: o estado antigo precisa zerar junto
function sigResetEstado() {
    uploadedImage = processedImage = uploadedImage2 = processedImage2 = null;
    originalImage = originalImage2 = null;
    bgRawData1 = bgRawData2 = null;
    sig1Pos = sig2Pos = null;
    doubleCtx = doubleData = null;
    sig2ModoModelo = false;
    adjustments = { contrast: 200, sharpness: 0, convertToBlack: false, cleanWeakPixels: false, autoCrop: false, applyPythonFilters: false };
    professionState = {
        1: { type: 'medico', register: 'CRM', compacto: false, rqeCompacto: false },
        2: { type: 'medico', register: 'CRM', compacto: false, rqeCompacto: false }
    };
    dragState.active = false;
    dragResetarHistorico();
}

var SIG_MARKUP = `
<h1>Gerador de assinatura</h1>
<div id="messageContainer"></div>
<div id="modelProgress" class="hidden">
  <p class="tag" id="progressText"></p>
  <div class="progress"><div id="progressBar"></div></div>
  <span class="tag" id="progressPercent">0%</span>
</div>

<section class="card">
  <h3>Assinatura 1</h3>
  <div class="profession-selector" id="professionSelector1">
    <button type="button" class="profession-btn active" data-type="medico" data-register="CRM" onclick="selectProfession(1,this)">Médico</button>
    <button type="button" class="profession-btn" data-type="veterinario" data-register="CRMV" onclick="selectProfession(1,this)">Veterinário</button>
    <button type="button" class="profession-btn" data-type="dentista" data-register="CRO" onclick="selectProfession(1,this)">Dentista</button>
  </div>
  <div class="pw-grid">
    <div class="form-group"><label for="doctorName">Nome</label><input type="text" id="doctorName" placeholder="Ex: Dr. João da Silva"></div>
    <div class="form-group"><label for="doctorCRM" id="doctorCRMLabel">CRM</label><input type="text" id="doctorCRM" placeholder="Ex: CRM 12345/SP"></div>
  </div>
  <div class="profession-selector" id="crmFormatoSelector1">
    <button type="button" class="profession-btn active" data-formato="padrao" onclick="selecionarFormatoCRM(1,'padrao',this)"></button>
    <button type="button" class="profession-btn" data-formato="compacto" onclick="selecionarFormatoCRM(1,'compacto',this)"></button>
  </div>
  <p class="tag" id="crmFormatoHelper1"></p>
  <label class="pw-check"><input type="checkbox" id="addRQE1" onchange="toggleAddRQE(1,this.checked)"> Adicionar RQE</label>
  <div id="rqeGroup1" class="hidden">
    <input type="text" id="doctorRQE" placeholder="Ex: 12345">
    <div class="profession-selector" id="rqeFormatoSelector1">
      <button type="button" class="profession-btn active" data-formato="padrao" onclick="selecionarFormatoRQE(1,'padrao',this)">Padrão (RQE: valor)</button>
      <button type="button" class="profession-btn" data-formato="compacto" onclick="selecionarFormatoRQE(1,'compacto',this)">Compacto (RQE/valor)</button>
    </div>
  </div>
  <hr class="sep">
  <label class="btn sec" for="fileInput">📁 Selecionar assinatura</label>
  <input type="file" id="fileInput" accept="image/*" style="display:none">
  <span class="tag" id="fileName"></span>
  <div id="imagePreviewContainer" style="display:none;margin-top:10px"><img id="imagePreview" class="preview-img" alt="Prévia da assinatura"></div>
  <div class="pw-actions"><button type="button" id="removeBgBtn" class="hidden" onclick="removeBackground()">Remover fundo</button></div>
  <div id="bgThresholdSection" class="hidden">
    <label for="bgThreshold">Sensibilidade da remoção de fundo: <span id="bgThresholdValue">0</span></label>
    <input type="range" id="bgThreshold" min="1" max="150" value="30" oninput="bgThresholdAtualizar(1)">
  </div>
  <label for="sigSize">Tamanho da assinatura: <span id="sigSizeVal">100%</span></label>
  <input type="range" id="sigSize" min="50" max="150" value="100">
</section>

<section class="card">
  <label class="pw-check"><input type="checkbox" id="enableSecondSignature"> Adicionar segunda assinatura</label>
  <div id="doctor2Section" class="hidden">
    <h3>Assinatura 2</h3>
    <label class="pw-check"><input type="checkbox" id="sig2ModeloPronto" onchange="toggleSig2Modo(this.checked)"> Usar modelo pronto (PNG que já tem nome e registro)</label>
    <p class="tag" id="sig2ModeloHint" style="display:none">Modo modelo pronto: só a imagem é posicionada ao lado da assinatura 1, sem texto adicional.</p>
    <div id="sig2CamposNormais">
      <div class="profession-selector" id="professionSelector2">
        <button type="button" class="profession-btn active" data-type="medico" data-register="CRM" onclick="selectProfession(2,this)">Médico</button>
        <button type="button" class="profession-btn" data-type="veterinario" data-register="CRMV" onclick="selectProfession(2,this)">Veterinário</button>
        <button type="button" class="profession-btn" data-type="dentista" data-register="CRO" onclick="selectProfession(2,this)">Dentista</button>
      </div>
      <div class="pw-grid">
        <div class="form-group"><label for="doctorName2">Nome</label><input type="text" id="doctorName2"></div>
        <div class="form-group"><label for="doctorCRM2" id="doctorCRMLabel2">CRM</label><input type="text" id="doctorCRM2" placeholder="Ex: CRM 67890/SP"></div>
      </div>
      <div class="profession-selector" id="crmFormatoSelector2">
        <button type="button" class="profession-btn active" data-formato="padrao" onclick="selecionarFormatoCRM(2,'padrao',this)"></button>
        <button type="button" class="profession-btn" data-formato="compacto" onclick="selecionarFormatoCRM(2,'compacto',this)"></button>
      </div>
      <p class="tag" id="crmFormatoHelper2"></p>
      <label class="pw-check"><input type="checkbox" id="addRQE2" onchange="toggleAddRQE(2,this.checked)"> Adicionar RQE</label>
      <div id="rqeGroup2" class="hidden">
        <input type="text" id="doctorRQE2" placeholder="Ex: 12345">
        <div class="profession-selector" id="rqeFormatoSelector2">
          <button type="button" class="profession-btn active" data-formato="padrao" onclick="selecionarFormatoRQE(2,'padrao',this)">Padrão (RQE: valor)</button>
          <button type="button" class="profession-btn" data-formato="compacto" onclick="selecionarFormatoRQE(2,'compacto',this)">Compacto (RQE/valor)</button>
        </div>
      </div>
    </div>
    <hr class="sep">
    <label class="btn sec" id="fileInput2Label" for="fileInput2">📁 Selecionar Segunda Assinatura</label>
    <input type="file" id="fileInput2" accept="image/*" style="display:none">
    <span class="tag" id="fileName2"></span>
    <div id="imagePreviewContainer2" style="display:none;margin-top:10px"><img id="imagePreview2" class="preview-img" alt="Prévia da segunda assinatura"></div>
    <div class="pw-actions"><button type="button" id="removeBgBtn2" class="hidden" onclick="removeBackground2()">Remover fundo</button></div>
    <div id="bgThresholdSection2" class="hidden">
      <label for="bgThreshold2">Sensibilidade da remoção de fundo: <span id="bgThresholdValue2">0</span></label>
      <input type="range" id="bgThreshold2" min="1" max="150" value="30" oninput="bgThresholdAtualizar(2)">
    </div>
    <label for="sigSize2">Tamanho da assinatura 2: <span id="sigSize2Val">100%</span></label>
    <input type="range" id="sigSize2" min="50" max="150" value="100">
  </div>
</section>

<section class="card hidden" id="adjustmentSection">
  <h3>Ajustes da imagem</h3>
  <label class="pw-check"><input type="checkbox" id="applyPythonFilters"> Filtros automáticos (contraste 400%, nitidez e preto puro)</label>
  <div id="manualControls">
    <label for="contrast">Contraste: <span id="contrastValue">200%</span></label>
    <input type="range" id="contrast" min="100" max="600" step="10" value="200">
    <label for="sharpness">Nitidez: <span id="sharpnessValue">0</span></label>
    <input type="range" id="sharpness" min="0" max="20" value="0">
  </div>
  <label class="pw-check"><input type="checkbox" id="convertToBlack"> Converter tinta para preto</label>
  <label class="pw-check"><input type="checkbox" id="cleanWeakPixels"> Limpar pixels fracos</label>
  <label class="pw-check"><input type="checkbox" id="autoCrop"> Recorte automático</label>
  <div class="pw-actions">
    <button type="button" class="sec" onclick="applyFiltersPreview()">Ver prévia dos filtros</button>
    <button type="button" class="sec" onclick="resetAdjustments()">Restaurar ajustes</button>
  </div>
</section>

<section class="card">
  <label class="pw-check"><input type="checkbox" id="addExtraPhrase"> Adicionar frase extra</label>
  <div id="extraPhraseGroup" class="hidden">
    <label for="extraPhrase">Frase extra (final do texto da assinatura 1)</label>
    <input type="text" id="extraPhrase" placeholder="Ex: Radiologista">
  </div>
  <div id="extraPhrase2Group" class="hidden">
    <label for="extraPhrase2">Frase extra 2 (logo abaixo do nome; na assinatura dupla vira o final do texto da assinatura 2)</label>
    <input type="text" id="extraPhrase2">
  </div>
  <div class="pw-grid" style="margin-top:12px">
    <div class="form-group"><label for="fontSelector">Fonte</label>
      <select id="fontSelector">
        <option value="Arial">Arial</option><option value="Calibri">Calibri</option>
        <option value="Times New Roman">Times New Roman</option><option value="Verdana">Verdana</option>
        <option value="Georgia">Georgia</option><option value="Tahoma">Tahoma</option>
        <option value="Courier New">Courier New</option>
      </select></div>
    <div class="form-group"><label for="sigGap">Espaço entre imagem e texto</label>
      <select id="sigGap">
        <option value="0">0 px</option><option value="3">3 px</option><option value="5" selected>5 px</option>
        <option value="8">8 px</option><option value="12">12 px</option>
      </select></div>
  </div>
</section>

<div class="pw-actions">
  <button type="button" id="generateBtn" onclick="generateSignature()">Gerar assinatura</button>
  <button type="button" id="downloadBtn" class="sec hidden" onclick="downloadImage()">Baixar PNG</button>
</div>
<div id="loading" style="display:none" class="tag"><span id="loadingText"></span></div>
<p id="canvasDragHint" class="tag" style="display:none">Arraste a assinatura para reposicionar. Ctrl+Z / Ctrl+Y desfaz e refaz.</p>
<div id="sig_undoredo_wrap" class="pw-actions" style="display:none">
  <button type="button" id="sig_undo_btn" class="sec" onclick="dragDesfazer()" disabled>↶ Desfazer</button>
  <button type="button" id="sig_redo_btn" class="sec" onclick="dragRefazer()" disabled>↷ Refazer</button>
</div>
<canvas id="previewCanvas" width="600" height="120" style="display:none"></canvas>
`;

const Assinatura = {
    render: function (el) {
        sigResetEstado();
        el.innerHTML = SIG_MARKUP;
        setupEventListeners();
        setupEventListenersExtras();
        updateRegisterField(1, 'CRM');
        updateRegisterField(2, 'CRM');
    }
};