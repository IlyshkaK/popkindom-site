(function(){
  if(window.__pdSupportWidgetLoaded)return;
  window.__pdSupportWidgetLoaded=true;

  function icon(name){return '<i data-lucide="'+name+'"></i>'}
  function refreshIcons(){if(window.lucide&&typeof window.lucide.createIcons==='function'){window.lucide.createIcons({attrs:{'stroke-width':2.3}})}}
  async function api(url,options={}){const response=await fetch(url,{credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||data.error||'Ошибка запроса.');return data}

  const widget=document.createElement('div');
  widget.className='pd-support-widget';
  widget.innerHTML='\
    <section class="pd-support-panel" aria-hidden="true">\
      <header class="pd-support-header">\
        <div class="pd-support-avatar">'+icon('messages-square')+'</div>\
        <div class="pd-support-header-copy"><b>Поддержка PopkinDom</b><span>Оставь сообщение администрации</span></div>\
        <button type="button" class="pd-support-close" aria-label="Закрыть чат">'+icon('x')+'</button>\
      </header>\
      <div class="pd-support-body">\
        <div class="pd-support-welcome">Привет! Опиши проблему — обращение сохранится на сайте и отправится администрации в Telegram.</div>\
        <form class="pd-support-form">\
          <div class="pd-support-form-row">\
            <div class="pd-support-field"><label>Ник</label><input name="username" maxlength="16" placeholder="Ник в Minecraft"></div>\
            <div class="pd-support-field"><label>Telegram</label><input name="telegramUsername" maxlength="64" placeholder="@username"></div>\
          </div>\
          <div class="pd-support-field"><label>Тема</label><input name="subject" maxlength="120" placeholder="Например: проблема со входом" required></div>\
          <div class="pd-support-field"><label>Сообщение</label><textarea name="message" maxlength="2000" placeholder="Расскажи подробнее, что произошло" required></textarea></div>\
          <button type="submit" class="pd-support-submit">'+icon('send')+'<span>Отправить</span></button>\
          <p class="pd-support-message"></p>\
        </form>\
        <div class="pd-support-success">\
          <div class="pd-support-success-icon">'+icon('check')+'</div>\
          <h3>Обращение отправлено</h3>\
          <p class="pd-support-success-text">Администрация получила сообщение.</p>\
        </div>\
      </div>\
    </section>\
    <button type="button" class="pd-support-toggle" aria-label="Открыть поддержку">'+icon('message-circle-more')+'</button>';
  document.body.appendChild(widget);

  const panel=widget.querySelector('.pd-support-panel');
  const toggle=widget.querySelector('.pd-support-toggle');
  const close=widget.querySelector('.pd-support-close');
  const form=widget.querySelector('.pd-support-form');
  const message=widget.querySelector('.pd-support-message');
  const submit=widget.querySelector('.pd-support-submit');
  const success=widget.querySelector('.pd-support-success');
  const successText=widget.querySelector('.pd-support-success-text');

  function open(){widget.classList.add('open');panel.setAttribute('aria-hidden','false');setTimeout(()=>form.querySelector('[name="subject"]')?.focus(),180)}
  function closePanel(){widget.classList.remove('open');panel.setAttribute('aria-hidden','true')}
  function resetSuccess(){success.classList.remove('show');form.classList.remove('hidden');message.textContent='';message.className='pd-support-message'}
  toggle.addEventListener('click',()=>{if(widget.classList.contains('open'))closePanel();else{resetSuccess();open()}});
  close.addEventListener('click',closePanel);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closePanel()});

  document.addEventListener('click',e=>{
    const link=e.target.closest('a[href="/support"],a[href="/support.html"],a[href^="/support?"]');
    if(!link)return;
    e.preventDefault();
    resetSuccess();
    open();
  });

  (async()=>{try{const me=await api('/api/me?summary=1');const input=form.querySelector('[name="username"]');if(me?.user?.username&&input)input.value=me.user.username}catch{}})();

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    message.textContent='Отправляем…';message.className='pd-support-message';submit.disabled=true;
    const fd=new FormData(form);
    const payload={username:String(fd.get('username')||'').trim(),telegramUsername:String(fd.get('telegramUsername')||'').trim(),subject:String(fd.get('subject')||'').trim(),message:String(fd.get('message')||'').trim(),contact:''};
    try{
      const data=await api('/api/support',{method:'POST',body:JSON.stringify(payload)});
      form.classList.add('hidden');success.classList.add('show');successText.textContent=(data.message||'Администрация получила сообщение.')+(data.ticketId?' Номер обращения: #'+data.ticketId+'.':'');
      form.querySelector('[name="subject"]').value='';form.querySelector('[name="message"]').value='';
      refreshIcons();
    }catch(error){message.textContent=error.message;message.className='pd-support-message error'}finally{submit.disabled=false}
  });

  if(new URLSearchParams(location.search).get('support')==='1'){setTimeout(open,250)}
  refreshIcons();
})();