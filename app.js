(function(){
  var active = null;
  var historyStack = [];
  var redoStack = [];
  var fileHandle = null;
  var sidebarSortable = null;
  var mainSortable = null;
  var isATSMode = false;

  function $(id){ return document.getElementById(id); }

  function status(message){
    var box = $('statusAlert');
    if(!box) return;
    box.classList.remove('hidden');
    box.innerText = message;
    clearTimeout(box._timer);
    box._timer = setTimeout(function(){ box.classList.add('hidden'); }, 6500);
    console.log('[Resume Studio]', message);
  }

  function initSortables(){
    if(typeof Sortable === 'undefined'){
      status('Sortable did not load; dragging is disabled, but editing still works.');
      return;
    }
    if(sidebarSortable) sidebarSortable.destroy();
    if(mainSortable) mainSortable.destroy();
    sidebarSortable = new Sortable($('canvasSidebar'), { group:'resume', animation:150, handle:'.drag-handle', ghostClass:'sortable-ghost', onEnd:pushHistoryState });
    mainSortable = new Sortable($('canvasMain'), { group:'resume', animation:150, handle:'.drag-handle', ghostClass:'sortable-ghost', onEnd:pushHistoryState });
  }

  function selectBlock(block){
    if(!block) return;
    document.querySelectorAll('.resume-block').forEach(function(b){ b.classList.remove('active-block-anchor'); });
    block.classList.add('active-block-anchor');
    active = block;
    syncInspector(block);
  }

  function syncInspector(block){
    var panel = $('inspectorPanel');
    if(!panel) return;
    panel.classList.remove('hidden');
    $('inspectorBlockType').innerText = (block.dataset.type || 'block').toUpperCase();
    $('geomWidth').value = Math.round(block.getBoundingClientRect().width);
    $('geomHeight').value = Math.round(block.getBoundingClientRect().height);
    $('sidebarBlockBg').value = rgbToHex(getComputedStyle(block).backgroundColor) || '#ffffff';
    $('sidebarBlockBorder').value = rgbToHex(getComputedStyle(block).borderColor) || '#ffffff';
    $('boxShadowBlur').value = block.getAttribute('data-fx-box-blur') || '0';
    $('boxShadowOpacity').value = block.getAttribute('data-fx-box-opacity') || '40';
    $('boxShadowColor').value = block.getAttribute('data-fx-box-color') || '#000000';
    $('boxBlurDisplay').innerText = $('boxShadowBlur').value + 'px';
    $('boxOpacityDisplay').innerText = $('boxShadowOpacity').value + '%';
    $('enableTextShadow').checked = block.getAttribute('data-fx-text-enabled') === 'true';
    $('textShadowBlur').value = block.getAttribute('data-fx-text-blur') || '0';
    $('textShadowColor').value = block.getAttribute('data-fx-text-color') || '#000000';
    $('textBlurDisplay').innerText = $('textShadowBlur').value + 'px';
    $('bulletColor').value = (block.style.getPropertyValue('--bullet-color') || '#0ea5e9').trim();
    $('bulletSize').value = parseFloat(block.style.getPropertyValue('--bullet-size') || '1.2em') || 1.2;
    var handle = block.querySelector('.resize-handle');
    if(handle) $('sidebarHandleColor').value = rgbToHex(getComputedStyle(handle).borderColor) || '#7c3aed';
  }

  function createNewComponent(type, destination){
    var template = document.querySelector('#blueprintRepository [data-type="' + type + '"]');
    if(!template){ status('Missing component blueprint: ' + type); return null; }
    var block = template.cloneNode(true);
    var target = $(destination || 'canvasMain');
    if(active && $('visualWorkspace').contains(active) && active.parentElement){
      active.parentElement.insertBefore(block, active.nextSibling);
    } else {
      target.appendChild(block);
    }
    selectBlock(block);
    pushHistoryState();
    return block;
  }

  function seedDefaultBlocks(){
    var side = $('canvasSidebar');
    var main = $('canvasMain');
    var emptySide = !side.querySelector('.resume-block');
    var emptyMain = !main.querySelector('.resume-block');
    if(emptySide){
      active = null;
      createNewComponent('photo', 'canvasSidebar');
      active = null;
      createNewComponent('contact', 'canvasSidebar');
      active = null;
      createNewComponent('skills', 'canvasSidebar');
    }
    if(emptyMain){
      active = null;
      createNewComponent('name', 'canvasMain');
      active = null;
      createNewComponent('textBlock', 'canvasMain');
    }
    document.querySelectorAll('.resume-block').forEach(function(b){ b.classList.remove('active-block-anchor'); });
    active = null;
    $('inspectorPanel').classList.add('hidden');
    pushHistoryState();
  }

  function ensurePhotoBlock(){
    var block = active && active.dataset.type === 'photo' ? active : document.querySelector('#visualWorkspace [data-type="photo"]');
    if(!block) block = createNewComponent('photo','canvasSidebar');
    selectBlock(block);
    return block;
  }

  function getWorkspaceData(){
    document.querySelectorAll('.profile-pic-frame').forEach(function(frame){
      if(frame.dataset.embeddedBg){
        frame.style.setProperty('background-image', 'url("' + frame.dataset.embeddedBg + '")', 'important');
      }
    });
    return {
      version:'2.10',
      sidebarHTML:$('canvasSidebar').innerHTML,
      mainHTML:$('canvasMain').innerHTML,
      sidebarStyle:$('canvasSidebar').style.cssText,
      mainStyle:$('canvasMain').style.cssText
    };
  }

  function applyWorkspaceData(data){
    $('canvasSidebar').innerHTML = data.sidebarHTML || data.side || '';
    $('canvasMain').innerHTML = data.mainHTML || data.main || '';
    $('canvasSidebar').style.cssText = data.sidebarStyle || '';
    $('canvasMain').style.cssText = data.mainStyle || '';
    active = null;
    $('inspectorPanel').classList.add('hidden');
    initSortables();
    pushHistoryState();
  }

  function pushHistoryState(){
    var snapshot = getWorkspaceData();
    var encoded = JSON.stringify(snapshot);
    if(historyStack.length && JSON.stringify(historyStack[historyStack.length - 1]) === encoded) return;
    historyStack.push(snapshot);
    if(historyStack.length > 40) historyStack.shift();
    redoStack = [];
  }

  function undoState(){
    if(historyStack.length <= 1) return;
    redoStack.push(historyStack.pop());
    applyWorkspaceData(historyStack[historyStack.length - 1]);
  }

  function redoState(){
    if(!redoStack.length) return;
    var state = redoStack.pop();
    historyStack.push(state);
    applyWorkspaceData(state);
  }

  function updateActiveBlockGeometry(axis, value){
    if(!active || !value) return;
    active.style[axis] = value + 'px';
  }

  function applySelectionInlineStyle(command, value){
    document.execCommand(command, false, value || null);
    if(command !== 'fontSize' && command !== 'foreColor') pushHistoryState();
  }

  function applyListStyles(){
    if(!active) return;
    active.style.setProperty('--bullet-color', $('bulletColor').value);
    active.style.setProperty('--bullet-size', $('bulletSize').value + 'em');
    pushHistoryState();
  }

  function applyPhotoShadow(block){
    block = block || ensurePhotoBlock();
    var blur = Number(($('boxShadowBlur') && $('boxShadowBlur').value) || block.getAttribute('data-fx-box-blur') || 14);
    var opacityPct = Number(($('boxShadowOpacity') && $('boxShadowOpacity').value) || block.getAttribute('data-fx-box-opacity') || 38);
    var hex = (($('boxShadowColor') && $('boxShadowColor').value) || block.getAttribute('data-fx-box-color') || '#000000');
    applyPhotoCircleShadow(block, blur, opacityPct, hex, hexToRgba(hex, opacityPct / 100));
  }

  function applyDefaultPhotoShadow(){
    var block = ensurePhotoBlock();
    $('boxShadowBlur').value = '14';
    $('boxShadowOpacity').value = '38';
    $('boxShadowColor').value = '#000000';
    applyPhotoShadow(block);
    pushHistoryState();
  }

  function applyBlockEffectsMatrix(){
    if(!active) return;
    var boxBlur = Number($('boxShadowBlur').value || 0);
    var opacityPct = Number($('boxShadowOpacity').value || 0);
    var hex = $('boxShadowColor').value;
    var rgba = hexToRgba(hex, opacityPct / 100);
    $('boxBlurDisplay').innerText = boxBlur + 'px';
    $('boxOpacityDisplay').innerText = opacityPct + '%';
    active.setAttribute('data-fx-box-blur', String(boxBlur));
    active.setAttribute('data-fx-box-opacity', String(opacityPct));
    active.setAttribute('data-fx-box-color', hex);
    if(active.dataset.type === 'photo') applyPhotoCircleShadow(active, boxBlur, opacityPct, hex, rgba);
    else active.style.boxShadow = opacityPct === 0 ? 'none' : '0px ' + Math.round(boxBlur/3) + 'px ' + boxBlur + 'px ' + rgba;
    var textEnabled = $('enableTextShadow').checked;
    var textBlur = Number($('textShadowBlur').value || 0);
    var textHex = $('textShadowColor').value;
    $('textBlurDisplay').innerText = textBlur + 'px';
    active.setAttribute('data-fx-text-enabled', String(textEnabled));
    active.setAttribute('data-fx-text-blur', String(textBlur));
    active.setAttribute('data-fx-text-color', textHex);
    active.querySelectorAll('h1,h2,h3,p,div[contenteditable],li').forEach(function(el){
      el.style.textShadow = textEnabled ? '0px 1px ' + Math.max(2,textBlur) + 'px ' + hexToRgba(textHex,.8) : 'none';
    });
  }

  function applyPhotoCircleShadow(block, blur, opacityPct, hex, rgba){
    var frame = block.querySelector('.profile-pic-frame');
    var shell = block.querySelector('.photo-shadow-shell');
    if(!frame) return;
    if(opacityPct === 0 || blur === 0){
      frame.style.boxShadow = 'none';
      frame.style.filter = 'none';
      if(shell) shell.style.filter = 'none';
      return;
    }
    var realBlur = Math.max(6, Number(blur || 0));
    var y = Math.max(2, Math.round(realBlur / 3));
    var shadow = '0px ' + y + 'px ' + realBlur + 'px ' + rgba;
    var drop = 'drop-shadow(0px ' + y + 'px ' + realBlur + 'px ' + rgba + ')';
    frame.style.setProperty('box-shadow', shadow, 'important');
    frame.style.setProperty('filter', drop, 'important');
    if(shell) shell.style.setProperty('filter', drop, 'important');
    block.setAttribute('data-fx-box-blur', String(realBlur));
    block.setAttribute('data-fx-box-opacity', String(opacityPct));
    block.setAttribute('data-fx-box-color', hex);
  }

  function modifyActiveBlockShellStyle(property, value){
    if(!active || !value) return;
    if(property === 'bg') active.style.backgroundColor = value;
    if(property === 'border'){
      active.style.borderColor = value;
      active.style.borderWidth = '2px';
      active.style.borderStyle = 'solid';
    }
    if(property === 'handles'){
      active.querySelectorAll('.resize-handle').forEach(function(h){ h.style.setProperty('border-color', value, 'important'); });
    }
    pushHistoryState();
  }

  function restoreAutoContainerFlow(){
    if(!active) return;
    active.style.width = '100%';
    active.style.height = 'auto';
    syncInspector(active);
    pushHistoryState();
  }

  function duplicateActiveContainerBlock(){
    if(!active) return;
    var clone = active.cloneNode(true);
    clone.classList.remove('active-block-anchor');
    active.parentNode.insertBefore(clone, active.nextSibling);
    pushHistoryState();
  }

  function purgeActiveContainerBlock(){
    if(!active) return;
    active.remove();
    active = null;
    $('inspectorPanel').classList.add('hidden');
    pushHistoryState();
  }

  var resizing = null, startX = 0, startY = 0, startW = 0, startH = 0;
  document.addEventListener('mousedown', function(event){
    if(!event.target.classList.contains('resize-handle')) return;
    event.preventDefault();
    event.stopPropagation();
    resizing = { handle:event.target, block:event.target.closest('.resume-block') };
    startX = event.clientX;
    startY = event.clientY;
    startW = resizing.block.getBoundingClientRect().width;
    startH = resizing.block.getBoundingClientRect().height;
    document.addEventListener('mousemove', resizeMove);
    document.addEventListener('mouseup', resizeStop);
  });

  function resizeMove(event){
    if(!resizing) return;
    var dx = event.clientX - startX;
    var dy = event.clientY - startY;
    var w = startW;
    var h = startH;
    if(resizing.handle.classList.contains('handle-br')){ w = startW + dx; h = startH + dy; }
    if(resizing.handle.classList.contains('handle-bl')){ w = startW - dx; h = startH + dy; }
    if(resizing.handle.classList.contains('handle-tr')){ w = startW + dx; h = startH - dy; }
    if(resizing.handle.classList.contains('handle-tl')){ w = startW - dx; h = startH - dy; }
    resizing.block.style.width = Math.max(40, w) + 'px';
    resizing.block.style.height = Math.max(20, h) + 'px';
    $('geomWidth').value = Math.round(w);
    $('geomHeight').value = Math.round(h);
  }

  function resizeStop(){
    document.removeEventListener('mousemove', resizeMove);
    document.removeEventListener('mouseup', resizeStop);
    resizing = null;
    pushHistoryState();
  }

  function saveProjectWorkspace(){
    var blob = new Blob([JSON.stringify(getWorkspaceData(), null, 2)], {type:'application/json'});
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'resume_studio_workspace_v2_10.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function loadProjectWorkspace(event){
    var file = event.target.files && event.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(e){
      try{ applyWorkspaceData(JSON.parse(e.target.result)); fileHandle = null; status('Workspace loaded.'); }
      catch(err){ status('Could not load JSON workspace: ' + err.message); }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function diskOK(){ return !!(window.showOpenFilePicker && window.showSaveFilePicker); }

  async function openWorkspaceFromDisk(){
    try{
      if(!diskOK()){ status('Disk save API is not available in this browser. Use Chrome or Edge.'); return; }
      var handles = await window.showOpenFilePicker({types:[{description:'Resume Studio JSON', accept:{'application/json':['.json']}}], multiple:false});
      fileHandle = handles[0];
      var file = await fileHandle.getFile();
      applyWorkspaceData(JSON.parse(await file.text()));
      status('Opened disk file: ' + file.name + '. Save Over is active.');
    }catch(err){ if(err.name !== 'AbortError') status('Could not open disk file: ' + err.message); }
  }

  async function saveWorkspaceOverDisk(){
    try{
      if(!diskOK()){ saveProjectWorkspace(); status('Disk API unavailable, downloaded JSON instead.'); return; }
      if(!fileHandle){ await saveWorkspaceAsDisk(); return; }
      var writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(getWorkspaceData(), null, 2));
      await writable.close();
      status('Saved over opened disk file.');
    }catch(err){ if(err.name !== 'AbortError') status('Could not save over file: ' + err.message); }
  }

  async function saveWorkspaceAsDisk(){
    try{
      if(!diskOK()){ saveProjectWorkspace(); status('Disk API unavailable, downloaded JSON instead.'); return; }
      fileHandle = await window.showSaveFilePicker({suggestedName:'resume_studio_workspace_v2_10.json', types:[{description:'Resume Studio JSON', accept:{'application/json':['.json']}}]});
      var writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(getWorkspaceData(), null, 2));
      await writable.close();
      status('Saved as disk file. Future Save Over writes to that file.');
    }catch(err){ if(err.name !== 'AbortError') status('Could not save file: ' + err.message); }
  }

  function printNormalPdf(){
    if(isATSMode) toggleLayoutEngine();
    document.body.setAttribute('data-print-mode','visual');
    setTimeout(function(){ window.print(); }, 80);
  }

  function printAtsPdf(){
    if(!isATSMode) toggleLayoutEngine();
    document.body.setAttribute('data-print-mode','ats');
    setTimeout(function(){ window.print(); }, 80);
  }

  function toggleLayoutEngine(){
    var visual = $('visualWorkspace');
    var ats = $('atsWorkspace');
    var btn = $('atsToggleBtn');
    isATSMode = !isATSMode;
    if(isATSMode){
      buildATSWorkspace();
      visual.classList.add('hidden');
      ats.classList.remove('hidden');
      ats.classList.add('flex');
      btn.innerHTML = '<span>🎨</span> Return to Design Canvas';
      btn.className = 'w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 rounded-lg text-xs shadow flex items-center justify-center gap-1.5';
    } else {
      visual.classList.remove('hidden');
      ats.classList.add('hidden');
      ats.classList.remove('flex');
      btn.innerHTML = '<span>🤖</span> Generate ATS Text Engine';
      btn.className = 'w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg text-xs shadow flex items-center justify-center gap-1.5';
    }
  }

  function buildATSWorkspace(){
    var ats = $('atsWorkspace');
    ats.innerHTML = '';
    var nameBlock = document.querySelector('#visualWorkspace [data-type="name"]');
    if(nameBlock){
      ats.appendChild(makeEl('h1', clean(nameBlock.querySelector('h1') ? nameBlock.querySelector('h1').innerText : ''), 'font-size:26px;font-weight:bold;margin-bottom:2px;'));
      ats.appendChild(makeEl('p', clean(nameBlock.querySelector('p') ? nameBlock.querySelector('p').innerText : ''), 'font-size:14px;font-weight:bold;color:#4b5563;text-transform:uppercase;margin-bottom:12px;'));
    }
    var contact = document.querySelector('#visualWorkspace [data-type="contact"]');
    if(contact){
      ats.appendChild(makeEl('p', Array.from(contact.querySelectorAll('p')).map(function(p){ return clean(p.innerText); }).join(' | '), 'font-size:11px;color:#374151;margin-bottom:24px;border-bottom:1px solid #d1d5db;padding-bottom:8px;'));
    }
    ['canvasMain','canvasSidebar'].forEach(function(id){
      document.querySelectorAll('#' + id + ' [data-type="skills"], #' + id + ' [data-type="textBlock"]').forEach(function(block){
        var title = block.querySelector('h2,h3');
        var body = block.querySelector('.block-body, div[contenteditable]');
        var wrap = document.createElement('div');
        wrap.setAttribute('style','margin-bottom:20px;break-inside:avoid;');
        wrap.appendChild(makeEl('h2', clean(title ? title.innerText : 'Section'), 'font-size:12px;font-weight:bold;text-transform:uppercase;border-bottom:2px solid #111827;padding-bottom:2px;margin-bottom:6px;letter-spacing:.05em;'));
        wrap.appendChild(makeEl('div', clean(body ? body.innerText : ''), 'font-size:11px;line-height:1.6;color:#1f2937;white-space:pre-line;'));
        ats.appendChild(wrap);
      });
    });
  }

  function makeEl(tag, text, style){
    var el = document.createElement(tag);
    el.innerText = text || '';
    if(style) el.setAttribute('style', style);
    return el;
  }

  function initPdfIngest(){
    var input = $('fileInput');
    if(!input) return;
    input.addEventListener('change', function(event){
      var file = event.target.files && event.target.files[0];
      if(!file) return;
      var ext = file.name.split('.').pop().toLowerCase();
      var reader = new FileReader();
      status('Parsing file...');
      if(ext === 'pdf'){
        if(typeof pdfjsLib === 'undefined'){ status('PDF.js failed to load. Try TXT.'); return; }
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        reader.onload = function(e){
          var typed = new Uint8Array(e.target.result);
          pdfjsLib.getDocument(typed).promise.then(function(pdf){
            var jobs = [];
            for(var i = 1; i <= pdf.numPages; i++){
              jobs.push(pdf.getPage(i).then(function(page){ return page.getTextContent().then(function(text){ return text.items.map(function(item){ return item.str; }).join(' '); }); }));
            }
            Promise.all(jobs).then(function(pages){ populateFromText(pages.join(String.fromCharCode(10))); });
          }).catch(function(){ status('Could not parse PDF.'); });
        };
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = function(e){ populateFromText(e.target.result); };
        reader.readAsText(file);
      }
      event.target.value = '';
    });
  }

  function populateFromText(text){
    $('canvasSidebar').innerHTML = '';
    $('canvasMain').innerHTML = '';
    active = null;
    var lines = (text || '').replace(/\r/g,'').split(String.fromCharCode(10)).map(function(line){ return line.trim(); }).filter(Boolean);
    var photo = createNewComponent('photo','canvasSidebar');
    active = null;
    var name = createNewComponent('name','canvasMain');
    name.querySelector('h1').innerText = (lines[0] || 'Applicant Name').toUpperCase();
    name.querySelector('p').innerText = (lines[1] || 'Professional Title').toUpperCase();
    active = null;
    var contact = createNewComponent('contact','canvasSidebar');
    var contacts = [];
    (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).forEach(function(email){ contacts.push('Email: ' + email); });
    (text.match(/\+?\d[\d\s().-]{8,18}\d/g) || []).slice(0,2).forEach(function(phone){ contacts.push('Phone: ' + phone.trim()); });
    if(!contacts.length) contacts = ['Email: [email]','Phone: [phone]','Location: [location]'];
    contact.querySelector('.space-y-1').innerHTML = contacts.map(function(line){ return '<p contenteditable="true" class="focus:outline-none">' + escapeHTML(line) + '</p>'; }).join('');
    active = null;
    createNewComponent('skills','canvasSidebar');
    active = null;
    var textBlock = createNewComponent('textBlock','canvasMain');
    textBlock.querySelector('h2').innerText = 'Professional Experience';
    textBlock.querySelector('.block-body').innerText = (text || '').slice(0,900) + ((text || '').length > 900 ? '...' : '');
    document.querySelectorAll('.resume-block').forEach(function(block){ block.classList.remove('active-block-anchor'); });
    active = null;
    $('inspectorPanel').classList.add('hidden');
    pushHistoryState();
    status('Resume text imported into editable blocks.');
  }

  var stopwords = new Set(['and','the','with','for','from','that','this','you','your','our','are','will','all','can','into','within','have','has','was','were','they','their','but','not','job','role','team','work','about','more','less','been','being','who','what','when','where','why','how','over','under','also','such','any','each','per','via','using','use']);
  var priority = ['category operations','order management','supplier management','supplier communication','stakeholder management','process improvement','process automation','delivery tracking','po confirmation','article data','ean','gtin','jira','confluence','looker','retail operations','operational excellence','cross-functional','problem solving','data analysis','process optimization','inventory management'];

  function suggestKeywordsFromJobAd(){
    var job = $('jobAdInput').value || '';
    if(!job.trim()){ status('Paste a job ad first.'); return; }
    var cv = clean($('visualWorkspace').innerText).toLowerCase();
    var low = job.toLowerCase();
    var suggestions = [];
    priority.forEach(function(term){ if(low.indexOf(term) >= 0 && cv.indexOf(term) < 0) suggestions.push(term); });
    var counts = {};
    low.replace(/[^a-z0-9+#./\s-]/g,' ').split(/\s+/).forEach(function(word){ if(word.length > 2 && !stopwords.has(word)) counts[word] = (counts[word] || 0) + 1; });
    Object.entries(counts).filter(function(pair){ return pair[1] >= 2 && cv.indexOf(pair[0]) < 0; }).sort(function(a,b){ return b[1] - a[1]; }).forEach(function(pair){ if(suggestions.indexOf(pair[0]) < 0) suggestions.push(pair[0]); });
    renderKeywords(suggestions.slice(0,32));
  }

  function renderKeywords(words){
    var box = $('keywordSuggestions');
    box.innerHTML = '';
    if(!words.length){ box.innerHTML = '<p class="text-[10px] text-slate-500">No obvious missing repeated keywords found.</p>'; return; }
    words.forEach(function(word){
      var pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'keyword-pill';
      pill.innerText = word;
      pill.onclick = function(){ pill.classList.toggle('selected'); };
      box.appendChild(pill);
    });
  }

  function insertSelectedKeywordsBlock(){
    var terms = Array.from(document.querySelectorAll('#keywordSuggestions .keyword-pill.selected')).map(function(pill){ return pill.innerText.trim(); }).filter(Boolean);
    if(!terms.length){ status('Select the truthful keywords first.'); return; }
    var block = createNewComponent('skills','canvasSidebar');
    block.querySelector('h2').innerText = 'Relevant Skills & Keywords';
    block.querySelector('.block-body').innerText = terms.join(' · ');
    pushHistoryState();
  }

  function clean(text){ return (text || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,'').replace(/\s+/g,' ').trim(); }
  function rgbToHex(rgb){ if(!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return '#ffffff'; var m = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/); if(!m) return '#ffffff'; return '#' + [m[1],m[2],m[3]].map(function(x){ return ('0' + parseInt(x,10).toString(16)).slice(-2); }).join(''); }
  function hexToRgba(hex, alpha){ var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16); return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')'; }
  function escapeHTML(str){ return String(str).replace(/[&<>'"]/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]; }); }

  window.ResumeStudio = { status:status, selectBlock:selectBlock, ensurePhotoBlock:ensurePhotoBlock, applyPhotoShadow:applyPhotoShadow, pushHistoryState:pushHistoryState };
  window.undoState=undoState; window.redoState=redoState; window.updateActiveBlockGeometry=updateActiveBlockGeometry; window.applySelectionInlineStyle=applySelectionInlineStyle; window.applyListStyles=applyListStyles; window.applyBlockEffectsMatrix=applyBlockEffectsMatrix; window.applyDefaultPhotoShadow=applyDefaultPhotoShadow; window.modifyActiveBlockShellStyle=modifyActiveBlockShellStyle; window.restoreAutoContainerFlow=restoreAutoContainerFlow; window.duplicateActiveContainerBlock=duplicateActiveContainerBlock; window.purgeActiveContainerBlock=purgeActiveContainerBlock; window.createNewComponent=createNewComponent; window.adjustMasterColumnMatrix=function(id,prop,val){ var col=$(id); if(!col) return; if(prop==='bg') col.style.backgroundColor=val; if(prop==='border'){ col.style.borderColor=val; col.style.borderWidth='2px'; col.style.borderStyle='solid'; } }; window.saveProjectWorkspace=saveProjectWorkspace; window.loadProjectWorkspace=loadProjectWorkspace; window.openWorkspaceFromDisk=openWorkspaceFromDisk; window.saveWorkspaceOverDisk=saveWorkspaceOverDisk; window.saveWorkspaceAsDisk=saveWorkspaceAsDisk; window.printNormalPdf=printNormalPdf; window.printAtsPdf=printAtsPdf; window.toggleLayoutEngine=toggleLayoutEngine; window.suggestKeywordsFromJobAd=suggestKeywordsFromJobAd; window.insertSelectedKeywordsBlock=insertSelectedKeywordsBlock;

  document.addEventListener('DOMContentLoaded', function(){
    try{
      initSortables();
      seedDefaultBlocks();
      $('visualWorkspace').addEventListener('click', function(event){ var block = event.target.closest('.resume-block'); if(block) selectBlock(block); });
      initPdfIngest();
      status('v2.10 loaded. Default blocks seeded; photo manager remains isolated.');
    }catch(err){
      status('Startup error: ' + err.message);
      console.error(err);
    }
  });

  window.onerror = function(message, source, line, column){ status('JavaScript error: ' + message + ' at line ' + line + ':' + column); };
})();
