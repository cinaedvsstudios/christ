(function(){
  function status(message){
    if(window.ResumeStudio && window.ResumeStudio.status) window.ResumeStudio.status(message);
  }

  function cssUrl(value){
    return 'url("' + String(value).replace(/"/g, '%22') + '")';
  }

  function getFrame(block){
    return block ? block.querySelector('.profile-pic-frame') : null;
  }

  function applyPhotoFile(file){
    if(!file) return;
    if(!window.ResumeStudio || !window.ResumeStudio.ensurePhotoBlock){
      status('Photo manager error: editor API was not ready.');
      return;
    }

    var block = window.ResumeStudio.ensurePhotoBlock();
    var frame = getFrame(block);
    var img = block ? block.querySelector('.image-render-target') : null;

    if(!block || !frame){
      status('Photo manager error: no photo frame found.');
      return;
    }

    var objectUrl = URL.createObjectURL(file);
    frame.style.setProperty('background-image', cssUrl(objectUrl), 'important');
    frame.style.setProperty('background-size', 'cover', 'important');
    frame.style.setProperty('background-position', 'center', 'important');
    frame.setAttribute('data-photo-ready', 'true');
    frame.dataset.objectUrlApplied = 'true';
    block.classList.add('has-photo');

    if(img){
      img.style.display = 'none';
      img.removeAttribute('src');
    }

    window.ResumeStudio.selectBlock(block);
    window.ResumeStudio.applyPhotoShadow(block);
    status('Photo shown immediately. Embedding copy for saved JSON...');

    var reader = new FileReader();
    reader.onload = function(event){
      var dataUrl = event.target.result;
      frame.dataset.embeddedBg = dataUrl;
      frame.style.setProperty('background-image', cssUrl(dataUrl), 'important');
      if(img){
        img.dataset.embeddedSrc = dataUrl;
        img.removeAttribute('src');
        img.style.display = 'none';
      }
      if(window.ResumeStudio.pushHistoryState) window.ResumeStudio.pushHistoryState();
      status('Photo visible and saved into workspace data.');
      URL.revokeObjectURL(objectUrl);
    };
    reader.onerror = function(){
      if(window.ResumeStudio.pushHistoryState) window.ResumeStudio.pushHistoryState();
      status('Photo visible, but embedded copy failed. Save JSON may not keep it.');
    };
    reader.readAsDataURL(file);
  }

  function bind(){
    var button = document.getElementById('photoUploadButton');
    var input = document.getElementById('photoUploadInput');
    if(button && input){
      button.addEventListener('click', function(){ input.click(); });
      input.addEventListener('change', function(){
        var file = input.files && input.files[0];
        if(file) applyPhotoFile(file);
        input.value = '';
      });
    }
  }

  window.PhotoManager = { applyPhotoFile: applyPhotoFile };
  document.addEventListener('DOMContentLoaded', bind);
})();
