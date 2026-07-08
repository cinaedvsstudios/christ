(function(){
  function status(message){
    if(window.ResumeStudio && window.ResumeStudio.status) window.ResumeStudio.status(message);
    else console.log('[PhotoManager]', message);
  }

  function cssUrl(value){
    return 'url("' + String(value).replace(/"/g, '%22') + '")';
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
      if(window.ResumeStudio && window.ResumeStudio.pushHistoryState) window.ResumeStudio.pushHistoryState();
      status('Photo visible and saved into workspace data.');
      URL.revokeObjectURL(objectUrl);
    };
    reader.onerror = function(){
      if(window.ResumeStudio && window.ResumeStudio.pushHistoryState) window.ResumeStudio.pushHistoryState();
      status('Photo visible, but embedded copy failed. The preview is still applied.');
    };
    reader.readAsDataURL(file);
  }

  function bind(){
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
    if(window.ResumeStudio && window.ResumeStudio.pushHistoryState) window.ResumeStudio.pushHistoryState();
  }

  function duplicateBlock(button){
    var block = closestBlock(button);
    if(!block || !block.parentElement) return;
    var clone = block.cloneNode(true);
    clone.classList.remove('active-block-anchor');
    block.parentElement.insertBefore(clone, block.nextSibling);
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

  window.PhotoManager = { applyPhotoFile: applyPhotoFile, processLocalImage: processLocalImage };
  window.processLocalImage = processLocalImage;
  window.processLocalImageFile = processLocalImage;
  window.processGlobalPhotoFile = function(input){ processLocalImage(input); };
  window.updateBlockStyle = window.updateBlockStyle || updateBlockStyle;
  window.duplicateBlock = window.duplicateBlock || duplicateBlock;

  document.addEventListener('DOMContentLoaded', bind);
})();
