(function(){
  var isATSMode = false;
  var lastActiveBlock = null;
  var historyStack = [];
  var redoStack = [];
  var workspaceFileHandle = null;
  var sidebarSortable = null;
  var mainSortable = null;

  var sortConfig = {
    group: 'document-grid-engine',
    animation: 150,
    handle: '.drag-handle',
    ghostClass: 'sortable-ghost',
    onEnd: function(){ pushHistoryState(); }
  };

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

  function initialiseSortable(){
    if(typeof Sortable === 'undefined'){
      status('Sortable library failed to load. Dragging is disabled.');
      return;
    }
    if(sidebarSortable) sidebarSortable.destroy();
    if(mainSortable) mainSortable.destroy();
    sidebarSortable = new Sortable($('canvasSidebar'), sortConfig);
    mainSortable = new Sortable($('canvasMain'), sortConfig);
  }

  function selectBlock(block){
    if(!block) return;
    document.querySelectorAll('.resume-block').forEach(function(b){ b.classList.remove('active-block-anchor'); });
    block.classList.add('active-block-anchor');
    lastActiveBlock = block;
    syncInspector(block);
  }

  function handleWorkspaceClick(event){
    var block = event.target.closest('.resume-block');
    if(block) selectBlock(block);
  }

  function syncInspector(block){
    var panel = $('inspectorPanel');
    if(!panel) return;
    panel.classList.remove('hidden');
    $('inspectorBlockType').innerText = (block.getAttribute('data-type') || 'block').toUpperCase();
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

  function getWorkspaceData(){
    document.querySelectorAll('.profile-pic-frame').forEach(function(frame){
      if(frame.dataset.embeddedBg){
        frame.style.setProperty('background-image', 'url("' + frame.dataset.embeddedBg + '")', 'important');
      }
    });
    return {
      version: '2.9',
      sidebarHTML: $('canvasSidebar').innerHTML,
      mainHTML: $('canvasMain').innerHTML,
      sidebarStyle: $('canvasSidebar').style.cssText,
      mainStyle: $('canvasMain').style.cssText
    };
  }

  function applyWorkspaceData(data){
    if(!data.sidebarHTML && !data.side) throw new Error('Missing workspace HTML');
    $('canvasSidebar').innerHTML = data.sidebarHTML || data.side || '';
    $('canvasMain').innerHTML = data.mainHTML || data.main || '';
    $('canvasSidebar').style.cssText = data.sidebarStyle || '';
    $('canvasMain').style.cssText = data.mainStyle || '';
    reinitializeBindings();
    pushHistoryState();
  }

  function pushHistoryState(){
    var state = getWorkspaceData();
    var encoded = JSON.stringify(state);
    if(historyStack.length && JSON.stringify(historyStack[historyStack.length - 1]) === encoded) return;
    historyStack.push(state);
    if(historyStack.length > 40) historyStack.shift();
    redoStack = [];
  }

  function undoState(){
    if(historyStack.length > 1){
      redoStack.push(historyStack.pop());
      applyWorkspaceData(historyStack[historyStack.length - 1]);
    }
  }

  function redoState(){
    if(redoStack.length){
      var state = redoStack.pop();
      historyStack.push(state);
      applyWorkspaceData(state);
    }
  }

  function reinitializeBindings(){
    initialiseSortable();
    lastActiveBlock = null;
    $('inspectorPanel').classList.add('hidden');
  }

  function createNewComponent(type, defaultDestination){
    var blueprint = document.querySelector('#blueprintRepository [data-type="' + type + '"]');
    if(!blueprint){ status('Missing component blueprint: ' + type); return null; }
    var clone = blueprint.cloneNode(true);
    if(lastActiveBlock && $('visualWorkspace').contains(lastActiveBlock)){
      lastActiveBlock.parentNode.insertBefore(clone, lastActiveBlock.nextSibling);
    } else {
      $(defaultDestination || 'canvasMain').appendChild(clone);
    }
    selectBlock(clone);
    pushHistoryState();
    return clone;
  }

  function ensurePhotoBlock(){
    var block = lastActiveBlock && lastActiveBlock.getAttribute('data-type') === 'photo'
      ? lastActiveBlock
      : document.querySelector('#visualWorkspace [data-type="photo"]');
    if(!block) block = createNewComponent('photo', 'canvasSidebar');
    selectBlock(block);
    return block;
  }

  function updateActiveBlockGeometry(axis, val){
    if(!lastActiveBlock || !val) return;
    lastActiveBlock.style[axis] = val + 'px';
  }

  function applySelectionInlineStyle(command, value){
    document.execCommand(command, false, value || null);
    if(command !== 'fontSize' && command !== 'foreColor') pushHistoryState();
  }

  function applyListStyles(){
    if(!lastActiveBlock) return;
    lastActiveBlock.style.setProperty('--bullet-color', $('bulletColor').value);
    lastActiveBlock.style.setProperty('--bullet-size', $('bulletSize').value + 'em');
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
    if(!lastActiveBlock) return;
    var boxBlur = Number($('boxShadowBlur').value || 0);
    var boxOpacityPct = Number($('boxShadowOpacity').value || 0);
    var boxHex = $('boxShadowColor').value;
    var rgbaBox = hexToRgba(boxHex, boxOpacityPct / 100);
    $('boxBlurDisplay').innerText = boxBlur + 'px';
    $('boxOpacityDisplay').innerText = boxOpacityPct + '%';
    lastActiveBlock.setAttribute('data-fx-box-blur', String(boxBlur));
    lastActiveBlock.setAttribute('data-fx-box-opacity', String(boxOpacityPct));
    lastActiveBlock.setAttribute('data-fx-box-color', boxHex);
    if(lastActiveBlock.getAttribute('data-type') === 'photo'){
      applyPhotoCircleShadow(lastActiveBlock, boxBlur, boxOpacityPct, boxHex, rgbaBox);
    } else {
      lastActiveBlock.style.boxShadow = boxOpacityPct === 0 ? 'none' : '0px ' + Math.round(boxBlur/3) + 'px ' + boxBlur + 'px ' + rgbaBox;
    }
    var textEnabled = $('enableTextShadow').checked;
    var textBlur = Number($('textShadowBlur').value || 0);
    var textHex = $('textShadowColor').value;
    $('textBlurDisplay').innerText = textBlur + 'px';
    lastActiveBlock.setAttribute('data-fx-text-enabled', String(textEnabled));
    lastActiveBlock.setAttribute('data-fx-text-blur', String(textBlur));
    lastActiveBlock.setAttribute('data-fx-text-color', textHex);
    lastActiveBlock.querySelectorAll('h1,h2,h3,p,div[contenteditable],li').forEach(function(el){
      el.style.textShadow = textEnabled ? '0px 1px ' + Math.max(2, textBlur) + 'px ' + hexToRgba(textHex, .8) : 'none';
    });
  }

  function applyPhotoCircleShadow(block, blur, opacityPct, hex, rgba){
    var shell = block.querySelector('.photo-shadow-shell');
    var frame = block.querySelector('.profile-pic-frame');
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

  function modifyActiveBlockShellStyle(property, val){
    if(!lastActiveBlock || !val) return;
    if(property === 'bg') lastActiveBlock.style.backgroundColor = val;
    if(property === 'border'){
      lastActiveBlock.style.borderColor = val;
      lastActiveBlock.style.borderWidth = '2px';
      lastActiveBlock.style.borderStyle = 'solid';
    }
    if(property === 'handles'){
      lastActiveBlock.querySelectorAll('.resize-handle').forEach(function(h){ h.style.setProperty('border-color', val, 'important'); });
    }
    pushHistoryState();
  }

  function restoreAutoContainerFlow(){
    if(!lastActiveBlock) return;
    lastActiveBlock.style.width = '100%';
    lastActiveBlock.style.height = 'auto';
    syncInspector(lastActiveBlock);
    status('Reset layout geometry to auto flow.');
    pushHistoryState();
  }

  function duplicateActiveContainerBlock(){
    if(!lastActiveBlock) return;
    var clone = lastActiveBlock.cloneNode(true);
    clone.classList.remove('active-block-anchor');
    lastActiveBlock.parentNode.insertBefore(clone, lastActiveBlock.nextSibling);
    pushHistoryState();
  }

  function purgeActiveContainerBlock(){
    if(!lastActiveBlock) return;
    lastActiveBlock.remove();
    lastActiveBlock = null;
    $('inspectorPanel').classList.add('hidden');
    pushHistoryState();
  }

  var currentResizer = null, resizeTargetBlock = null, rStartX = 0, rStartY = 0, rStartW = 0, rStartH = 0;
  document.addEventListener('mousedown', function(e){
    if(e.target.classList.contains('resize-handle')){
      e.preventDefault(); e.stopPropagation();
      currentResizer = e.target;
      resizeTargetBlock = currentResizer.closest('.resume-block');
      rStartX = e.clientX; rStartY = e.clientY;
      rStartW = resizeTargetBlock.getBoundingClientRect().width;
      rStartH = resizeTargetBlock.getBoundingClientRect().height;
      document.addEventListener('mousemove', processPointerResizeExecution);
      document.addEventListener('mouseup', terminatePointerResizeLoop);
    }
  });

  function processPointerResizeExecution(e){
    if(!resizeTargetBlock || !currentResizer) return;
    var dx = e.clientX - rStartX, dy = e.clientY - rStartY;
    var w = rStartW, h = rStartH;
    if(currentResizer.classList.contains('handle-br')){ w = rStartW + dx; h = rStartH + dy; }
    if(currentResizer.classList.contains('handle-bl')){ w = rStartW - dx; h = rStartH + dy; }
    if(currentResizer.classList.contains('handle-tr')){ w = rStartW + dx; h = rStartH - dy; }
    if(currentResizer.classList.contains('handle-tl')){ w = rStartW - dx; h = rStartH - dy; }
    resizeTargetBlock.style.width = Math.max(40, w) + 'px';
    resizeTargetBlock.style.height = Math.max(20, h) + 'px';
    $('geomWidth').value = Math.round(w);
    $('geomHeight').value = Math.round(h);
  }

  function terminatePointerResizeLoop(){
    document.removeEventListener('mousemove', processPointerResizeExecution);
    document.removeEventListener('mouseup', terminatePointerResizeLoop);
    currentResizer = null;
    resizeTargetBlock = null;
    pushHistoryState();
  }

  function saveProjectWorkspace(){
    var blob = new Blob([JSON.stringify(getWorkspaceData(), null, 2)], {type:'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'resume_studio_workspace_v2_9.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  function loadProjectWorkspace(evt){
    var file = evt.target.files && evt.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(e){
      try { applyWorkspaceData(JSON.parse(e.target.result)); workspaceFileHandle = null; status('Workspace loaded.'); }
      catch(err){ status('Could not load JSON workspace.'); }
    };
    reader.readAsText(file);
    evt.target.value = '';
  }

  function supportsDiskAPI(){ return !!(window.showOpenFilePicker && window.showSaveFilePicker); }

  async function openWorkspaceFromDisk(){
    try{
      if(!supportsDiskAPI()){ status('Disk save API is not available in this browser. Use Chrome or Edge.'); return; }
      var handles = await window.showOpenFilePicker({types:[{description:'Resume Studio JSON',accept:{'application/json':['.json']}}], multiple:false});
      workspaceFileHandle = handles[0];
      var file = await workspaceFileHandle.getFile();
      applyWorkspaceData(JSON.parse(await file.text()));
      status('Opened disk file: ' + file.name + '. Save Over is now enabled.');
    } catch(err){ if(err && err.name !== 'AbortError') status('Could not open disk file: ' + (err.message || err)); }
  }

  async function saveWorkspaceOverDisk(){
    try{
      if(!supportsDiskAPI()){ saveProjectWorkspace(); status('Disk API unavailable, downloaded JSON instead.'); return; }
      if(!workspaceFileHandle){ await saveWorkspaceAsDisk(); return; }
      var writable = await workspaceFileHandle.createWritable();
      await writable.write(JSON.stringify(getWorkspaceData(), null, 2));
      await writable.close();
      status('Saved over the opened workspace file.');
    } catch(err){ if(err && err.name !== 'AbortError') status('Could not save over file: ' + (err.message || err)); }
  }

  async function saveWorkspaceAsDisk(){
    try{
      if(!supportsDiskAPI()){ saveProjectWorkspace(); status('Disk API unavailable, downloaded JSON instead.'); return; }
      workspaceFileHandle = await window.showSaveFilePicker({suggestedName:'resume_studio_workspace_v2_9.json', types:[{description:'Resume Studio JSON', accept:{'application/json':['.json']}}]});
      var writable = await workspaceFileHandle.createWritable();
      await writable.write(JSON.stringify(getWorkspaceData(), null, 2));
      await writable.close();
      status('Saved workspace to chosen disk file.');
    } catch(err){ if(err && err.name !== 'AbortError') status('Could not save file: ' + (err.message || err)); }
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
    var visualWorkspace = $('visualWorkspace'), atsWorkspace = $('atsWorkspace'), toggleBtn = $('atsToggleBtn');
    isATSMode = !isATSMode;
    if(isATSMode){
      toggleBtn.innerHTML = '<span>🎨</span> Return to Design Canvas';
      toggleBtn.className = 'w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 rounded-lg text-xs shadow flex items-center justify-center gap-1.5';
      buildATSWorkspace();
      visualWorkspace.classList.add('hidden');
      atsWorkspace.classList.remove('hidden');
      atsWorkspace.classList.add('flex');
    } else {
      toggleBtn.innerHTML = '<span>🤖</span> Generate ATS Text Engine';
      toggleBtn.className = 'w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg text-xs shadow flex items-center justify-center gap-1.5';
      visualWorkspace.classList.remove('hidden');
      atsWorkspace.classList.add('hidden');
      atsWorkspace.classList.remove('flex');
    }
  }

  function buildATSWorkspace(){
    var ats = $('atsWorkspace'); ats.innerHTML = '';
    var nameBlock = document.querySelector('#visualWorkspace [data-type="name"]');
    if(nameBlock){
      ats.appendChild(makeEl('h1', cleanText(nameBlock.querySelector('h1') ? nameBlock.querySelector('h1').innerText : ''), 'font-size:26px;font-weight:bold;margin-bottom:2px;'));
      ats.appendChild(makeEl('p', cleanText(nameBlock.querySelector('p') ? nameBlock.querySelector('p').innerText : ''), 'font-size:14px;font-weight:bold;color:#4b5563;text-transform:uppercase;margin-bottom:12px;'));
    }
    var contactBlock = document.querySelector('#visualWorkspace [data-type="contact"]');
    if(contactBlock) ats.appendChild(makeEl('p', Array.from(contactBlock.querySelectorAll('p')).map(function(p){return cleanText(p.innerText);}).join(' | '), 'font-size:11px;color:#374151;margin-bottom:24px;border-bottom:1px solid #d1d5db;padding-bottom:8px;'));
    ['canvasMain','canvasSidebar'].forEach(function(id){
      document.querySelectorAll('#' + id + ' [data-type="skills"], #' + id + ' [data-type="textBlock"]').forEach(function(b){
        var titleEl = b.querySelector('h2,h3');
        var bodyEl = b.querySelector('.block-body, div[contenteditable]');
        var wrap = document.createElement('div');
        wrap.setAttribute('style','margin-bottom:20px;break-inside:avoid;');
        wrap.appendChild(makeEl('h2', cleanText(titleEl ? titleEl.innerText : 'Section'), 'font-size:12px;font-weight:bold;text-transform:uppercase;border-bottom:2px solid #111827;padding-bottom:2px;margin-bottom:6px;letter-spacing:.05em;'));
        wrap.appendChild(makeEl('div', cleanText(bodyEl ? bodyEl.innerText : ''), 'font-size:11px;line-height:1.6;color:#1f2937;white-space:pre-line;'));
        ats.appendChild(wrap);
      });
    });
  }

  function makeEl(tag, text, style){ var el = document.createElement(tag); el.innerText = text || ''; if(style) el.setAttribute('style', style); return el; }
  function cleanText(text){ return (text || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,'').replace(/\s+/g,' ').trim(); }

  function initialisePdfIngest(){
    var input = $('fileInput');
    if(!input) return;
    input.addEventListener('change', function(evt){
      var file = evt.target.files && evt.target.files[0];
      if(!file) return;
      var ext = file.name.split('.').pop().toLowerCase();
      status('Parsing file...');
      var reader = new FileReader();
      if(ext === 'pdf'){
        if(typeof pdfjsLib === 'undefined'){ status('PDF.js failed to load. Try TXT.'); return; }
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        reader.onload = function(e){
          var typedArray = new Uint8Array(e.target.result);
          pdfjsLib.getDocument(typedArray).promise.then(function(pdf){
            var jobs=[];
            for(var i=1;i<=pdf.numPages;i++){
              jobs.push(pdf.getPage(i).then(function(p){ return p.getTextContent().then(function(t){ return t.items.map(function(item){ return item.str; }).join(' '); }); }));
            }
            Promise.all(jobs).then(function(pagesText){ executeHeuristicPopulation(pagesText.join(String.fromCharCode(10))); });
          }).catch(function(){ status('Could not parse PDF.'); });
        };
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = function(e){ executeHeuristicPopulation(e.target.result); };
        reader.readAsText(file);
      }
      evt.target.value = '';
    });
  }

  function executeHeuristicPopulation(text){
    $('canvasSidebar').innerHTML=''; $('canvasMain').innerHTML=''; lastActiveBlock=null; $('inspectorPanel').classList.add('hidden');
    createNewComponent('photo','canvasSidebar');
    var lines=(text||'').replace(/\r/g,'').split(String.fromCharCode(10)).map(function(l){return l.trim();}).filter(Boolean);
    var name=lines[0]||'Applicant Name', title=lines[1]||'Professional Field Specialist';
    var nCard=createNewComponent('name','canvasMain'); nCard.querySelector('h1').innerText=name.toUpperCase(); nCard.querySelector('p').innerText=title.toUpperCase();
    var cCard=createNewComponent('contact','canvasSidebar');
    var contacts=[], emails=(text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)||[]); emails.forEach(function(e){contacts.push('Email: '+e);});
    var phones=(text.match(/\+?\d[\d\s().-]{8,18}\d/g)||[]); phones.slice(0,2).forEach(function(p){contacts.push('Phone: '+p.trim());});
    if(!contacts.length) contacts.push('Email: [email]','Phone: [phone]','Location: [location]');
    cCard.querySelector('.space-y-1').innerHTML=contacts.map(function(l){return '<p contenteditable="true" class="focus:outline-none">'+escapeHTML(l)+'</p>';}).join('');
    createNewComponent('skills','canvasSidebar');
    var jCard=createNewComponent('textBlock','canvasMain'); jCard.querySelector('h2').innerText='Professional Experience'; jCard.querySelector('.block-body').innerText=(text||'').slice(0,900)+((text||'').length>900?'...':'');
    document.querySelectorAll('.resume-block').forEach(function(b){b.classList.remove('active-block-anchor');}); lastActiveBlock=null; status('Resume text imported into editable blocks.'); pushHistoryState();
  }

  var stopwords = new Set(['and','the','with','for','from','that','this','you','your','our','are','will','all','can','into','within','have','has','was','were','they','their','but','not','job','role','team','work','about','more','less','been','being','who','what','when','where','why','how','over','under','also','such','any','each','per','via','using','use']);
  var priorityPhrases = ['category operations','order management','supplier management','supplier communication','stakeholder management','process improvement','process automation','delivery tracking','po confirmation','article data','ean','gtin','jira','confluence','looker','retail operations','operational excellence','cross-functional','problem solving','data analysis','process optimization','inventory management'];
  function suggestKeywordsFromJobAd(){
    var jobText=$('jobAdInput').value||''; if(!jobText.trim()){status('Paste a job ad first.');return;}
    var resumeText=getResumePlainText().toLowerCase(), lowerJob=jobText.toLowerCase(), suggestions=[];
    priorityPhrases.forEach(function(p){if(lowerJob.includes(p)&&!resumeText.includes(p))suggestions.push(p);});
    var counts={}; lowerJob.replace(/[^a-z0-9+#./\s-]/g,' ').split(/\s+/).forEach(function(w){if(w.length>2&&!stopwords.has(w))counts[w]=(counts[w]||0)+1;});
    Object.entries(counts).filter(function(pair){return pair[1]>=2&&!resumeText.includes(pair[0]);}).sort(function(a,b){return b[1]-a[1];}).forEach(function(pair){if(!suggestions.includes(pair[0]))suggestions.push(pair[0]);});
    renderKeywordSuggestions(suggestions.slice(0,32));
  }
  function renderKeywordSuggestions(words){
    var box=$('keywordSuggestions'); box.innerHTML='';
    if(!words.length){box.innerHTML='<p class="text-[10px] text-slate-500">No obvious missing repeated keywords found.</p>';return;}
    words.forEach(function(w){var pill=document.createElement('button');pill.type='button';pill.className='keyword-pill';pill.innerText=w;pill.onclick=function(){pill.classList.toggle('selected');};box.appendChild(pill);});
  }
  function insertSelectedKeywordsBlock(){
    var selected=Array.from(document.querySelectorAll('#keywordSuggestions .keyword-pill.selected')).map(function(p){return p.innerText.trim();}).filter(Boolean);
    if(!selected.length){status('Select the truthful keywords first.');return;}
    var block=createNewComponent('skills','canvasSidebar'); block.querySelector('h2').innerText='Relevant Skills & Keywords'; block.querySelector('.block-body').innerText=selected.join(' · '); status('Inserted visible keyword block.'); pushHistoryState();
  }
  function getResumePlainText(){ return cleanText($('visualWorkspace').innerText||''); }

  function rgbToHex(rgb){ if(!rgb||rgb==='rgba(0, 0, 0, 0)'||rgb==='transparent')return'#ffffff'; var m=rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/); if(!m)return'#ffffff'; return '#'+[m[1],m[2],m[3]].map(function(x){return('0'+parseInt(x,10).toString(16)).slice(-2);}).join(''); }
  function hexToRgba(hex,alpha){ var r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16); return 'rgba('+r+', '+g+', '+b+', '+alpha+')'; }
  function escapeHTML(str){ return String(str).replace(/[&<>'"]/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch];}); }

  window.ResumeStudio = {
    status: status,
    selectBlock: selectBlock,
    ensurePhotoBlock: ensurePhotoBlock,
    applyPhotoShadow: applyPhotoShadow,
    pushHistoryState: pushHistoryState
  };

  window.undoState=undoState; window.redoState=redoState; window.updateActiveBlockGeometry=updateActiveBlockGeometry; window.applySelectionInlineStyle=applySelectionInlineStyle; window.applyListStyles=applyListStyles; window.applyBlockEffectsMatrix=applyBlockEffectsMatrix; window.applyDefaultPhotoShadow=applyDefaultPhotoShadow; window.modifyActiveBlockShellStyle=modifyActiveBlockShellStyle; window.restoreAutoContainerFlow=restoreAutoContainerFlow; window.duplicateActiveContainerBlock=duplicateActiveContainerBlock; window.purgeActiveContainerBlock=purgeActiveContainerBlock; window.createNewComponent=createNewComponent; window.adjustMasterColumnMatrix=adjustMasterColumnMatrix; window.saveProjectWorkspace=saveProjectWorkspace; window.loadProjectWorkspace=loadProjectWorkspace; window.openWorkspaceFromDisk=openWorkspaceFromDisk; window.saveWorkspaceOverDisk=saveWorkspaceOverDisk; window.saveWorkspaceAsDisk=saveWorkspaceAsDisk; window.printNormalPdf=printNormalPdf; window.printAtsPdf=printAtsPdf; window.toggleLayoutEngine=toggleLayoutEngine; window.suggestKeywordsFromJobAd=suggestKeywordsFromJobAd; window.insertSelectedKeywordsBlock=insertSelectedKeywordsBlock;

  document.addEventListener('DOMContentLoaded', function(){
    initialiseSortable();
    pushHistoryState();
    $('visualWorkspace').addEventListener('click', handleWorkspaceClick);
    initialisePdfIngest();
    status('v2.9 loaded. Editor controls are in app.js; photo logic is isolated in photo-manager.js.');
  });

  window.onerror=function(message,source,lineno,colno){ status('JavaScript error: '+message+' at line '+lineno+':'+colno); };
})();
