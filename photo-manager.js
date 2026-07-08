(function(){
  var VERSION = '2.13';
  var observerStarted = false;
  var cleanupTimer = null;

  function status(message){
    if(window.ResumeStudio && window.ResumeStudio.status) window.ResumeStudio.status(message);
    else console.log('[PhotoManager]', message);
  }

  function markVersion(){
    document.title = 'Resume Studio v' + VERSION;
    Array.from(document.querySelectorAll('span')).forEach(function(span){
      if(/^v\d+\.\d+$/.test((span.innerText || '').trim())) span.innerText = 'v' + VERSION;
    });
  }

  function cssUrl(value){
    return 'url("' + String(value).replace(/"/g, '%22') + '")';
  }

  function injectCleanupCss(){
    if(document.getElementById('resume-studio-cleanup-css')) return;
    var style = document.createElement('style');
    style.id = 'resume-studio-cleanup-css';
    style.textContent = '.resume-block li.rs-empty-li,.resume-block li:empty{display:none!important;margin:0!important;padding:0!important;height:0!important;min-height:0!important}.resume-block li.rs-empty-li::before,.resume-block li:empty::before{display:none!important;content:""!important}.resume-block li.rs-empty-li *{display:none!important}';
    document.head.appendChild(style);
  }

  function injectBulletSpacingCss(){
    if(document.getElementById('resume-studio-bullet-spacing-css')) return;
    var style = document.createElement('style');
    style.id = 'resume-studio-bullet-spacing-css';
    style.textContent = '.resume-block.rs-bullet-spacing-enabled li + li{margin-top:var(--bullet-section-spacing,8px)!important}.resume-block.rs-bullet-spacing-enabled li{line-height:inherit}.resume-block.rs-bullet-spacing-enabled p,.resume-block.rs-bullet-spacing-enabled div[contenteditable]{line-height:inherit}';
    document.head.appendChild(style);
  }

  function visibleText(node){
    return (node ? node.textContent : '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isEmptyListItem(li){
    if(!li) return false;
    var text = visibleText(li);
    if(text) return false;
    var meaningful = li.querySelector('img,svg,canvas,video,input,textarea,select,button');
    if(meaningful) return false;
    return true;
  }

  function cleanupEmptyListItems(root){
    root = root || document.getElementById('visualWorkspace') || document;
    var removed = 0;
    root.querySelectorAll('li').forEach(function(li){
      if(isEmptyListItem(li)){
        li.classList.add('rs-empty-li');
        li.remove();
        removed++;
      }
    });
    return removed;
  }

  function cleanupSoon(reason){
    clearTimeout(cleanupTimer);
    cleanupTimer = setTimeout(function(){
      var removed = cleanupEmptyListItems();
      if(removed) status('Removed ' + removed + ' empty bullet line' + (removed === 1 ? '' : 's') + '.');
    }, 80);
  }

  function startCleanupObserver(){
    if(observerStarted) return;
    observerStarted = true;
    injectCleanupCss();
    cleanupEmptyListItems();

    var workspace = document.getElementById('visualWorkspace');
    if(workspace){
      workspace.addEventListener('input', function(){ cleanupSoon('input'); }, true);
      var observer = new MutationObserver(function(){ cleanupSoon('mutation'); });
      observer.observe(workspace, { childList:true, subtree:true });
    }

    ['loadProjectWorkspace','openWorkspaceFromDisk','undoState','redoState','saveProjectWorkspace','saveWorkspaceOverDisk','saveWorkspaceAsDisk','printNormalPdf','printAtsPdf'].forEach(function(name){
      var original = window[name];
      if(typeof original !== 'function' || original._cleanupWrapped) return;
      var wrapped = function(){
        cleanupEmptyListItems();
        var result = original.apply(this, arguments);
        setTimeout(function(){ cleanupEmptyListItems(); syncBulletSpacingControls(); }, 150);
        setTimeout(function(){ cleanupEmptyListItems(); syncBulletSpacingControls(); }, 700);
        return result;
      };
      wrapped._cleanupWrapped = true;
      window[name] = wrapped;
    });
  }

  function findBulletOptionsPanel(){
    var labels = Array.from(document.querySelectorAll('p,h2,h3,div'));
    for(var i = 0; i < labels.length; i++){
      var text = (labels[i].innerText || labels[i].textContent || '').trim();
      if(text.indexOf('Bullet Options') >= 0){
        return labels[i].closest('.space-y-2') || labels[i].parentElement;
      }
    }
    return null;
  }

  function getActiveBlock(){
    return document.querySelector('#visualWorkspace .resume-block.active-block-anchor');
  }

  function setBulletSectionSpacing(enabled, px){
    var block = getActiveBlock();
    if(!block){
      status('Select the bullet/text block first, then adjust bullet section spacing.');
      syncBulletSpacingControls();
      return;
    }
    var value = Math.max(0, Math.min(40, Number(px || 0)));
    if(enabled){
      block.classList.add('rs-bullet-spacing-enabled');
      block.style.setProperty('--bullet-section-spacing', value + 'px');
      block.setAttribute('data-bullet-section-spacing-enabled', 'true');
      block.setAttribute('data-bullet-section-spacing', String(value));
    } else {
      block.classList.remove('rs-bullet-spacing-enabled');
      block.style.removeProperty('--bullet-section-spacing');
      block.setAttribute('data-bullet-section-spacing-enabled', 'false');
      block.removeAttribute('data-bullet-section-spacing');
    }
    cleanupEmptyListItems(block);
    if(window.ResumeStudio && window.ResumeStudio.pushHistoryState) window.ResumeStudio.pushHistoryState();
  }

  function syncBulletSpacingControls(){
    var toggle = document.getElementById('bulletSectionSpacingToggle');
    var range = document.getElementById('bulletSectionSpacingSlider');
    var value = document.getElementById('bulletSectionSpacingValue');
    if(!toggle || !range || !value) return;
    var block = getActiveBlock();
    var enabled = !!(block && (block.classList.contains('rs-bullet-spacing-enabled') || block.getAttribute('data-bullet-section-spacing-enabled') === 'true'));
    var px = block ? Number(block.getAttribute('data-bullet-section-spacing') || parseInt(block.style.getPropertyValue('--bullet-section-spacing'), 10) || 8) : 8;
    toggle.checked = enabled;
    range.value = String(px);
    range.disabled = !enabled;
    range.classList.toggle('opacity-40', !enabled);
    value.innerText = px + 'px';
  }

  function injectBulletSpacingControls(){
    injectBulletSpacingCss();
    if(document.getElementById('bulletSectionSpacingControls')) return;
    var panel = findBulletOptionsPanel();
    if(!panel) return;
    var box = document.createElement('div');
    box.id = 'bulletSectionSpacingControls';
    box.className = 'mt-2 pt-2 border-t border-slate-800 space-y-2';
    box.innerHTML = '<label class="flex items-center justify-between gap-2 text-slate-400 text-[10px]"><span>Space between bullet sections</span><input id="bulletSectionSpacingToggle" type="checkbox" class="accent-cyan-500"></label><div class="flex justify-between text-[10px] text-slate-400"><span>Section gap:</span><span id="bulletSectionSpacingValue" class="font-mono text-cyan-400">8px</span></div><input id="bulletSectionSpacingSlider" type="range" min="0" max="40" value="8" class="w-full accent-cyan-500 bg-slate-800 h-1 rounded opacity-40" disabled><p class="text-[9px] text-slate-500 leading-tight">Adds margin between bullet items only. It does not change normal wrapped text line spacing.</p>';
    panel.appendChild(box);

    var toggle = document.getElementById('bulletSectionSpacingToggle');
    var slider = document.getElementById('bulletSectionSpacingSlider');
    toggle.addEventListener('change', function(){
      slider.disabled = !toggle.checked;
      slider.classList.toggle('opacity-40', !toggle.checked);
      setBulletSectionSpacing(toggle.checked, slider.value);
      syncBulletSpacingControls();
    });
    slider.addEventListener('input', function(){
      document.getElementById('bulletSectionSpacingValue').innerText = slider.value + 'px';
      setBulletSectionSpacing(toggle.checked, slider.value);
    });
    syncBulletSpacingControls();
  }

  function startBulletSpacingManager(){
    injectBulletSpacingControls();
    document.addEventListener('click', function(){ setTimeout(syncBulletSpacingControls, 0); }, true);
    var workspace = document.getElementById('visualWorkspace');
    if(workspace){
      workspace.addEventListener('input', function(){ cleanupEmptyListItems(); }, true);
    }
  }

  function closestBlock(node){
    return node ? node.closest('.resume-block,[data-type="photo"]') : null;
  }

  function getPhotoBlock(explicitBlock){
    if(explicitBlock) return explicitBlock;
    if(window.ResumeStudio && window.ResumeStudio.ensurePhotoBlock){
      var ensured = window.ResumeStudio.ensurePhotoBlock();
      if(ensured) return ensured;
    }
    return document.querySelector('#visualWorkspace [data-type="photo"], [data-type="photo"]');
  }

  function findFrame(block){
    if(!block) return null;
    var modern = block.querySelector('.profile-pic-frame');
    if(modern) return modern;

    var img = block.querySelector('.image-render-target, img');
    if(img){
      var parent = img.parentElement;
      while(parent && parent !== block){
        var cls = parent.className || '';
        if(String(cls).indexOf('rounded-full') >= 0 || parent.style.borderRadius === '9999px') return parent;
        parent = parent.parentElement;
      }
      return img.parentElement;
    }
    return block.querySelector('.rounded-full') || block;
  }

  function findImage(block){
    return block ? block.querySelector('.image-render-target, img') : null;
  }

  function applyShadow(block, frame){
    if(!block || !frame) return;
    var blur = Number(block.getAttribute('data-fx-box-blur') || 14);
    var opacityPct = Number(block.getAttribute('data-fx-box-opacity') || 38);
    var color = block.getAttribute('data-fx-box-color') || '#000000';

    var blurInput = document.getElementById('boxShadowBlur');
    var opInput = document.getElementById('boxShadowOpacity');
    var colorInput = document.getElementById('boxShadowColor');
    if(blurInput && blurInput.value) blur = Number(blurInput.value);
    if(opInput && opInput.value) opacityPct = Number(opInput.value);
    if(colorInput && colorInput.value) color = colorInput.value;

    var rgba = hexToRgba(color, opacityPct / 100);
    if(!blur || !opacityPct){
      frame.style.setProperty('box-shadow', 'none', 'important');
      frame.style.setProperty('filter', 'none', 'important');
      return;
    }
    var realBlur = Math.max(6, blur);
    var y = Math.max(2, Math.round(realBlur / 3));
    var shadow = '0px ' + y + 'px ' + realBlur + 'px ' + rgba;
    frame.style.setProperty('box-shadow', shadow, 'important');
    frame.style.setProperty('filter', 'drop-shadow(' + shadow + ')', 'important');
    block.setAttribute('data-fx-box-blur', String(realBlur));
    block.setAttribute('data-fx-box-opacity', String(opacityPct));
    block.setAttribute('data-fx-box-color', color);
  }

  function applyPhotoFile(file, explicitBlock){
    if(!file) return;
    var block = getPhotoBlock(explicitBlock);
    var frame = findFrame(block);
    var img = findImage(block);

    if(!block || !frame){
      status('Photo error: no photo block/frame found. Add a Profile Photo Block and try again.');
      return;
    }

    var objectUrl = URL.createObjectURL(file);
    status('Photo selected: ' + file.name + '. Applying preview...');

    frame.style.setProperty('background-image', cssUrl(objectUrl), 'important');
    frame.style.setProperty('background-size', 'cover', 'important');
    frame.style.setProperty('background-position', 'center', 'important');
    frame.style.setProperty('background-repeat', 'no-repeat', 'important');
    frame.setAttribute('data-photo-ready', 'true');
    frame.dataset.objectUrlApplied = 'true';
    block.classList.add('has-photo');

    if(img){
      img.style.setProperty('display', 'none', 'important');
      img.removeAttribute('src');
    }

    if(window.ResumeStudio && window.ResumeStudio.selectBlock) window.ResumeStudio.selectBlock(block);
    applyShadow(block, frame);
    status('Photo is visible. Embedding copy for JSON save...');

    var reader = new FileReader();
    reader.onload = function(event){
      var dataUrl = event.target.result;
      frame.dataset.embeddedBg = dataUrl;
      frame.style.setProperty('background-image', cssUrl(dataUrl), 'important');
      if(img){
        img.dataset.embeddedSrc = dataUrl;
        img.removeAttribute('src');
        img.style.setProperty('display', 'none', 'important');
      }
      cleanupEmptyListItems();
      if(window.ResumeStudio && window.ResumeStudio.pushHistoryState) window.ResumeStudio.pushHistoryState();
      status('Photo visible and saved into workspace data.');
      URL.revokeObjectURL(objectUrl);
    };
    reader.onerror = function(){
      cleanupEmptyListItems();
      if(window.ResumeStudio && window.ResumeStudio.pushHistoryState) window.ResumeStudio.pushHistoryState();
      status('Photo visible, but embedded copy failed. The preview is still applied.');
    };
    reader.readAsDataURL(file);
  }

  function bind(){
    markVersion();
    startCleanupObserver();
    startBulletSpacingManager();
    var button = document.getElementById('photoUploadButton');
    var input = document.getElementById('photoUploadInput');
    if(button && input && !button.dataset.photoManagerBound){
      button.dataset.photoManagerBound = 'true';
      button.addEventListener('click', function(){ input.click(); });
      input.addEventListener('change', function(){
        var file = input.files && input.files[0];
        if(file) applyPhotoFile(file);
        input.value = '';
      });
    }
    status('Photo manager v' + VERSION + ' active. Bullet section spacing control enabled.');
  }

  function updateBlockStyle(input, kind){
    var block = closestBlock(input);
    if(!block) return;
    var val = input.value;
    if(kind === 'bg') block.style.backgroundColor = val;
    if(kind === 'border'){
      block.style.borderColor = val;
      block.style.borderWidth = '2px';
      block.style.borderStyle = 'solid';
    }
    if(kind === 'dividerLine'){
      var hr = block.querySelector('hr,.divider-target');
      if(hr) hr.style.borderColor = val;
    }
    cleanupEmptyListItems();
    if(window.ResumeStudio && window.ResumeStudio.pushHistoryState) window.ResumeStudio.pushHistoryState();
  }

  function duplicateBlock(button){
    var block = closestBlock(button);
    if(!block || !block.parentElement) return;
    var clone = block.cloneNode(true);
    clone.classList.remove('active-block-anchor');
    block.parentElement.insertBefore(clone, block.nextSibling);
    cleanupEmptyListItems();
    if(window.ResumeStudio && window.ResumeStudio.pushHistoryState) window.ResumeStudio.pushHistoryState();
  }

  function processLocalImage(input){
    var file = input.files && input.files[0];
    if(file) applyPhotoFile(file, closestBlock(input));
    input.value = '';
  }

  function hexToRgba(hex, alpha){
    if(!hex || !/^#[0-9a-f]{6}$/i.test(hex)) hex = '#000000';
    var r = parseInt(hex.slice(1,3),16);
    var g = parseInt(hex.slice(3,5),16);
    var b = parseInt(hex.slice(5,7),16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  }

  window.PhotoManager = { applyPhotoFile: applyPhotoFile, processLocalImage: processLocalImage, cleanupEmptyListItems: cleanupEmptyListItems, setBulletSectionSpacing: setBulletSectionSpacing };
  window.processLocalImage = processLocalImage;
  window.processLocalImageFile = processLocalImage;
  window.processGlobalPhotoFile = function(input){ processLocalImage(input); };
  window.updateBlockStyle = window.updateBlockStyle || updateBlockStyle;
  window.duplicateBlock = window.duplicateBlock || duplicateBlock;

  document.addEventListener('DOMContentLoaded', bind);
})();
