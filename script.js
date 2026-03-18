// ─── STATE ───────────────────────────────────────────────
var subjects = [];
var activeSubject = null;
var words = [];
var categoryOrder = [];
var catData = {};

var queue = [], wrongQueue = [], historyBits = [];
var current = 0, sessionCorrect = 0, sessionTotal = 0;
var answered = false, activeCategory = null;

// ─── HELPERS ─────────────────────────────────────────────
function shuffle(arr){
  var a=arr.slice();
  for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}
  return a;
}

function showScreen(id){
  var ids=['screenSubject','screenPicker','screenQuiz','screenResults'];
  for(var i=0;i<ids.length;i++){
    document.getElementById(ids[i]).className='screen'+(ids[i]===id?' active':'');
  }
  document.getElementById('progressLabel').textContent='';
  document.getElementById('progressFill').style.width='0%';
  document.getElementById('scoreDisplay').textContent='0';
  // hide umlaut bar when leaving quiz
  if(id !== 'screenQuiz') document.getElementById('umlautBar').className='umlaut-bar';
}

// ─── UMLAUT BAR ──────────────────────────────────────────
var umlautBar = document.getElementById('umlautBar');
var answerInput = document.getElementById('answerInput');

// Show/hide bar based on active subject language
function updateUmlautBar(){
  if(activeSubject && activeSubject.lang === 'de'){
    umlautBar.className = 'umlaut-bar visible';
  } else {
    umlautBar.className = 'umlaut-bar';
  }
}

// Insert character at cursor position
umlautBar.addEventListener('mousedown', function(e){
  var btn = e.target.closest('.umlaut-btn');
  if(!btn) return;
  e.preventDefault(); // prevent input from losing focus
  var ch = btn.getAttribute('data-char');
  var start = answerInput.selectionStart;
  var end = answerInput.selectionEnd;
  var val = answerInput.value;
  answerInput.value = val.slice(0, start) + ch + val.slice(end);
  // move cursor after inserted char
  answerInput.selectionStart = answerInput.selectionEnd = start + ch.length;
  answerInput.focus();
});

// ─── LOAD subjects.json ───────────────────────────────────
function loadSubjects(){
  fetch('data/subjects.json')
    .then(function(r){ return r.json(); })
    .then(function(data){
      subjects = data;
      renderSubjectGrid();
    })
    .catch(function(){
      document.getElementById('subjectGrid').innerHTML =
        '<div class="error-msg">Nie można załadować subjects.json.<br>Upewnij się że plik istnieje w folderze data/.</div>';
    });
}

function renderSubjectGrid(){
  var html='';
  for(var i=0;i<subjects.length;i++){
    var s=subjects[i];
    html+='<button class="subject-btn" data-idx="'+i+'">'
        +'<span class="subject-emoji">'+s.emoji+'</span>'
        +'<span class="subject-info">'
        +'<span class="subject-name">'+s.name+'</span>'
        +'<span class="subject-desc">'+s.desc+'</span>'
        +'</span></button>';
  }
  var grid=document.getElementById('subjectGrid');
  grid.innerHTML=html;
  var btns=grid.querySelectorAll('.subject-btn');
  for(var i=0;i<btns.length;i++){
    btns[i].addEventListener('click',function(){
      loadSubject(parseInt(this.getAttribute('data-idx')));
    });
  }
}

// ─── LOAD a subject's words JSON ─────────────────────────
function loadSubject(idx){
  activeSubject = subjects[idx];
  document.getElementById('subjectGrid').innerHTML='<div class="loading">Ładowanie…</div>';

  fetch(activeSubject.file)
    .then(function(r){ return r.json(); })
    .then(function(data){
      words = data;
      buildCategoryData();
      showPicker();
    })
    .catch(function(){
      document.getElementById('subjectGrid').innerHTML=
        '<div class="error-msg">Nie można załadować '+activeSubject.file+'</div>';
      showScreen('screenSubject');
      renderSubjectGrid();
    });
}

function buildCategoryData(){
  categoryOrder=[];
  catData={};
  var seen={};
  for(var i=0;i<words.length;i++){
    var c=words[i].cat;
    if(!seen[c]){seen[c]=true;categoryOrder.push(c);}
  }
  for(var i=0;i<categoryOrder.length;i++){
    var c=categoryOrder[i];
    var total=0;
    for(var j=0;j<words.length;j++){if(words[j].cat===c)total++;}
    catData[c]={correct:0,total:total,done:false};
  }
}

// ─── CATEGORY PICKER ─────────────────────────────────────
function showPicker(){
  showScreen('screenPicker');
  document.getElementById('pickerTitle').textContent = activeSubject.name;
  document.getElementById('pickerSubtitle').textContent = activeSubject.desc;
  document.getElementById('cardHint').textContent = activeSubject.question;
  renderCatGrid();
}

function renderCatGrid(){
  var html='';
  for(var i=0;i<categoryOrder.length;i++){
    var cat=categoryOrder[i];
    var d=catData[cat];
    var pill=d.done?'<span class="cat-score-pill">'+d.correct+'/'+d.total+'</span>':'';
    html+='<button class="cat-btn'+(d.done?' done':'')+'" data-cat="'+i+'">'
        +'<span class="cat-name">'+cat+pill+'</span>'
        +'<span class="cat-meta">'+d.total+' słów'+(d.done?' · ukończone':'')+'</span>'
        +'</button>';
  }
  var grid=document.getElementById('catGrid');
  grid.innerHTML=html;
  var btns=grid.querySelectorAll('.cat-btn');
  for(var i=0;i<btns.length;i++){
    btns[i].addEventListener('click',function(){
      startQuiz(categoryOrder[parseInt(this.getAttribute('data-cat'))]);
    });
  }
}

document.getElementById('allBtn').addEventListener('click',function(){ startQuiz('__all__'); });
document.getElementById('backToSubjects').addEventListener('click',function(){
  showScreen('screenSubject');
  renderSubjectGrid();
});
document.getElementById('logoBtn').addEventListener('click',function(){
  showScreen('screenSubject');
  renderSubjectGrid();
});

// ─── QUIZ ─────────────────────────────────────────────────
function startQuiz(category){
  activeCategory=category;
  var pool=category==='__all__'?words:words.filter(function(w){return w.cat===category;});
  queue=shuffle(pool);
  wrongQueue=[];historyBits=[];
  current=0;sessionCorrect=0;sessionTotal=queue.length;answered=false;

  showScreen('screenQuiz');
  updateUmlautBar();
  document.getElementById('quizCatName').textContent=category==='__all__'?'Wszystkie':category;
  document.getElementById('roundBadge').style.display='none';
  renderQuestion();
}

function renderQuestion(){
  answered=false;
  var w=queue[current];

  var wd=document.getElementById('wordDisplay');
  wd.textContent=w.pl;
  wd.className='word-display'+(w.pl.length>16?' vlong':w.pl.length>10?' long':'');

  var inp=document.getElementById('answerInput');
  inp.value='';inp.className='answer-input';inp.disabled=false;
  document.getElementById('feedback').className='feedback';
  document.getElementById('nextBtn').className='next-btn';
  document.getElementById('backBtn').className='back-btn';
  document.getElementById('progressLabel').textContent=(current+1)+' / '+queue.length;
  document.getElementById('progressFill').style.width=(current/queue.length*100)+'%';
  document.getElementById('scoreDisplay').textContent=sessionCorrect;

  var html='';
  for(var i=0;i<queue.length;i++){
    var cls=i<current?(historyBits[i]?' c':' w'):'';
    html+='<div class="streak-dot'+cls+'"></div>';
  }
  document.getElementById('streaks').innerHTML=html;
  setTimeout(function(){document.getElementById('answerInput').focus();},80);
}

function check(){
  if(answered)return;
  var inp=document.getElementById('answerInput');
  var val=inp.value.trim().toLowerCase();
  if(!val)return;
  answered=true;

  var correct=queue[current].en.toLowerCase();
  var variants=correct.split('/').map(function(v){return v.trim();});
  var isCorrect=variants.indexOf(val)!==-1;

  inp.disabled=true;
  var fb=document.getElementById('feedback');

  if(isCorrect){
    sessionCorrect++;historyBits[current]=true;
    inp.classList.add('correct');
    fb.className='feedback correct-fb show';
    fb.innerHTML='<span>✓</span> Świetnie! <b>'+queue[current].en+'</b>';
    document.getElementById('scoreDisplay').textContent=sessionCorrect;
  } else {
    historyBits[current]=false;wrongQueue.push(queue[current]);
    inp.classList.add('wrong');
    fb.className='feedback wrong-fb show';
    fb.innerHTML='<span>✗</span> Poprawna: <b>'+queue[current].en+'</b>';
  }
  document.getElementById('progressFill').style.width=((current+1)/queue.length*100)+'%';
  document.getElementById('nextBtn').className='next-btn show';
  document.getElementById('backBtn').className='back-btn show';
}

function next(){
  current++;
  if(current>=queue.length){
    if(wrongQueue.length>0) startRetryRound();
    else showResults();
  } else {
    renderQuestion();
  }
}

function startRetryRound(){
  queue=shuffle(wrongQueue);wrongQueue=[];
  current=0;answered=false;historyBits=[];
  document.getElementById('roundBadge').style.display='block';
  document.getElementById('feedback').className='feedback';
  document.getElementById('nextBtn').className='next-btn';
  document.getElementById('backBtn').className='back-btn';
  renderQuestion();
}

function showResults(){
  if(activeCategory!=='__all__'){
    catData[activeCategory].correct=sessionCorrect;
    catData[activeCategory].total=sessionTotal;
    catData[activeCategory].done=true;
  }
  showScreen('screenResults');
  var pct=Math.round(sessionCorrect/sessionTotal*100);
  document.getElementById('resultsEmoji').textContent=pct>=80?'🏆':pct>=50?'💪':'📚';
  document.getElementById('resultsCat').textContent=activeCategory==='__all__'?'Wszystkie słówka':activeCategory;
  document.getElementById('finalScore').textContent=sessionCorrect+' / '+sessionTotal;
  document.getElementById('resultsDetail').textContent='Wynik: '+pct+'% — '+(pct>=80?'Znakomity wynik! 🔥':pct>=50?'Nieźle, ćwicz dalej!':'Więcej nauki i do przodu!');

  var nextCat=null;
  if(activeCategory!=='__all__'){
    var idx=categoryOrder.indexOf(activeCategory);
    if(idx>=0&&idx<categoryOrder.length-1) nextCat=categoryOrder[idx+1];
  }

  var html='<button class="btn-primary" id="retryBtn">Powtórz</button>';
  if(nextCat) html+='<button class="btn-primary" id="nextCatBtn">'+nextCat+' →</button>';
  html+='<button class="btn-secondary" id="pickerBtn">← Kategorie</button>';
  document.getElementById('resultsActions').innerHTML=html;

  document.getElementById('retryBtn').addEventListener('click',function(){startQuiz(activeCategory);});
  if(nextCat) document.getElementById('nextCatBtn').addEventListener('click',function(){startQuiz(nextCat);});
  document.getElementById('pickerBtn').addEventListener('click',showPicker);
}

// ─── KEYBOARD ────────────────────────────────────────────
document.getElementById('submitBtn').addEventListener('click',check);
document.getElementById('nextBtn').addEventListener('click',next);
document.getElementById('backBtn').addEventListener('click',showPicker);

document.addEventListener('keydown',function(e){
  if(e.key!=='Enter')return;
  if(document.getElementById('screenQuiz').className.indexOf('active')===-1)return;
  e.preventDefault();
  if(answered){next();}else{check();}
});

// ─── INIT ─────────────────────────────────────────────────
loadSubjects();
