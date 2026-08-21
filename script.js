(function(){
'use strict';

let actx = null;
function getCtx(){
  if(!actx){
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    actx = new AC();
  }
  if(actx.state === 'suspended') actx.resume();
  return actx;
}

function unlockAudio(){ getCtx(); }

function playTone(ctx, {freq, type='sine', start=0, dur=0.15, gain=0.2, freqEnd=null, attack=0.006, release=0.09, detune=0}){
  const osc=ctx.createOscillator();
  const g=ctx.createGain();
  osc.type=type;
  osc.detune.value=detune;
  const t0=ctx.currentTime+start;
  osc.frequency.setValueAtTime(freq, t0);
  if(freqEnd!=null) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd,1), t0+dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0+attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0+dur+release);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0+dur+release+0.03);
}

function sfxTick(urgency){
  const ctx=getCtx(); if(!ctx) return;
  playTone(ctx,{freq:640+urgency*420, type:'square', dur:0.04, gain:0.10+urgency*0.06, release:0.03});
}

function sfxCriticalPulse(){
  const ctx=getCtx(); if(!ctx) return;
  playTone(ctx,{freq:92,  type:'sine',   dur:0.09, gain:0.38, release:0.42});
  playTone(ctx,{freq:184, type:'sine',   dur:0.06, gain:0.14, release:0.30});
  playTone(ctx,{freq:1500,type:'sine',   dur:0.02, gain:0.05, release:0.28, start:0.10});
}

function sfxCorrect(){
  const ctx=getCtx(); if(!ctx) return;
  [523.25,659.25,783.99,1046.50].forEach((f,i)=>
    playTone(ctx,{freq:f, type:'triangle', start:i*0.07, dur:0.11, gain:0.20, release:0.14}));
}

function sfxWrongFunny(){
  const ctx=getCtx(); if(!ctx) return;
  const notes=[329.63,293.66,261.63,220.00];
  notes.forEach((f,i)=>{
    const t0=ctx.currentTime+i*0.17;
    const osc=ctx.createOscillator(), g=ctx.createGain();
    osc.type='sawtooth';
    osc.frequency.setValueAtTime(f,t0);
    osc.frequency.exponentialRampToValueAtTime(f*0.82, t0+0.24);
    const lfo=ctx.createOscillator(), lfoGain=ctx.createGain();
    lfo.frequency.value=17; lfoGain.gain.value=9;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(t0); lfo.stop(t0+0.3);
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.linearRampToValueAtTime(i===notes.length-1?0.26:0.20, t0+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+0.32);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0); osc.stop(t0+0.36);
  });
}

function sfxTimeout(){
  const ctx=getCtx(); if(!ctx) return;
  [0,0.13,0.26].forEach(t=> playTone(ctx,{freq:170, type:'square', start:t, dur:0.10, gain:0.28, release:0.05}));
}

function sfxRoundOver(){
  const ctx=getCtx(); if(!ctx) return;
  [392.00,523.25,659.25,784.00].forEach((f,i)=>
    playTone(ctx,{freq:f, type:'triangle', start:i*0.1, dur:0.16, gain:0.18, release:0.2}));
}

function sfxSkip(){
  const ctx=getCtx(); if(!ctx) return;
  playTone(ctx,{freq:500, type:'sine', dur:0.09, gain:0.14, freqEnd:900, release:0.05});
}

const grammars = [
  {
    id:0, name:'G₁', display:'S → a S b | ε',
    V:['S'], T:['a','b'], start:'S', P:['S → a S b','S → ε'],
    validate(str){
      if(str==='') return {valid:true};
      if(!/^[ab]+$/.test(str)) return {valid:false};
      let seenB=false;
      for(const ch of str){ if(ch==='b') seenB=true; else if(ch==='a' && seenB) return {valid:false}; }
      const a=(str.match(/a/g)||[]).length, b=(str.match(/b/g)||[]).length;
      return {valid:a===b};
    },
    buildTree(str){
      if(str==='') return {label:'ε',children:[],isTerminal:true,isEpsilon:true};
      const inner=str.slice(1,-1);
      return {label:'S',children:[
        {label:'a',children:[],isTerminal:true},
        this.buildTree(inner),
        {label:'b',children:[],isTerminal:true}
      ],isTerminal:false};
    },
    derive(str){
      const n=str.length/2, steps=['S'];
      for(let i=1;i<=n;i++) steps.push('a'.repeat(i)+'S'+'b'.repeat(i));
      steps.push('a'.repeat(n)+'b'.repeat(n));
      return steps;
    }
  },
  {
    id:1, name:'G₂', display:'S → a S | b',
    V:['S'], T:['a','b'], start:'S', P:['S → a S','S → b'],
    validate(str){
      if(str==='') return {valid:false};
      if(!/^[ab]+$/.test(str)) return {valid:false};
      return {valid:/^a*b$/.test(str)};
    },
    buildTree(str){
      if(str==='b') return {label:'S',children:[{label:'b',children:[],isTerminal:true}],isTerminal:false};
      return {label:'S',children:[
        {label:'a',children:[],isTerminal:true},
        this.buildTree(str.slice(1))
      ],isTerminal:false};
    },
    derive(str){
      const n=str.length-1, steps=['S'];
      let cur='';
      for(let i=1;i<=n;i++){ cur+='a'; steps.push(cur+'S'); }
      steps.push(cur+'b');
      return steps;
    }
  },
  {
    id:2, name:'G₃', display:'S → a S a | b S b | ε',
    V:['S'], T:['a','b'], start:'S', P:['S → a S a','S → b S b','S → ε'],
    validate(str){
      if(str==='') return {valid:true};
      if(!/^[ab]+$/.test(str)) return {valid:false};
      if(str.length%2!==0) return {valid:false};
      return {valid: str===str.split('').reverse().join('')};
    },
    buildTree(str){
      if(str==='') return {label:'ε',children:[],isTerminal:true,isEpsilon:true};
      const first=str[0], last=str[str.length-1], inner=str.slice(1,-1);
      return {label:'S',children:[
        {label:first,children:[],isTerminal:true},
        this.buildTree(inner),
        {label:last,children:[],isTerminal:true}
      ],isTerminal:false};
    },
    derive(str){
      const steps=['S']; let left='',right='',remaining=str;
      while(remaining.length>0){
        const f=remaining[0];
        left+=f; right=f+right;
        remaining=remaining.slice(1,-1);
        steps.push(left+'S'+right);
      }
      steps.push(left+right);
      return steps;
    }
  },
  {
    id:3, name:'G₄', display:'S → a S | b S | ε',
    V:['S'], T:['a','b'], start:'S', P:['S → a S','S → b S','S → ε'],
    validate(str){
      if(str==='') return {valid:true};
      return {valid:/^[ab]+$/.test(str)};
    },
    buildTree(str){
      if(str==='') return {label:'ε',children:[],isTerminal:true,isEpsilon:true};
      return {label:'S',children:[
        {label:str[0],children:[],isTerminal:true},
        this.buildTree(str.slice(1))
      ],isTerminal:false};
    },
    derive(str){
      const steps=['S']; let cur='';
      for(let i=0;i<str.length;i++){ cur+=str[i]; steps.push(cur+'S'); }
      steps.push(cur);
      return steps;
    }
  }
];

const DIFFS = {
  easy:   {label:'Easy',   nMin:1, nMax:3, hearts:5},
  medium: {label:'Medium', nMin:3, nMax:6, hearts:4},
  hard:   {label:'Hard',   nMin:6, nMax:9, hearts:3}
};
const QUESTIONS_PER_ROUND = 10;
const SKIPS_ALLOWED = 2;

function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function randStr(len){ let s=''; for(let i=0;i<len;i++) s+= Math.random()<0.5?'a':'b'; return s; }
function shuffle(arr){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

function makeG1(n){ return 'a'.repeat(n)+'b'.repeat(n); }
function makeG2(n){ return 'a'.repeat(n)+'b'; }
function makeG3(n){
  let half='';
  for(let i=0;i<n;i++) half += ((i+n)%2===0)?'a':'b';
  return half + half.split('').reverse().join('');
}
function makeG4(len){
  let s, tries=0;
  do{ s=randStr(Math.max(1,len)); tries++; }
  while(tries<60 && (grammars[0].validate(s).valid || grammars[1].validate(s).valid || grammars[2].validate(s).valid));
  return s;
}
function makeInvalid(len){
  let s=randStr(Math.max(1,len));
  const pos=randInt(0,s.length-1);
  const foreign=['c','d','x','y','z'];
  return s.slice(0,pos)+foreign[randInt(0,foreign.length-1)]+s.slice(pos+1);
}
function breakG1(str){ return str.length===0 ? 'a' : str.slice(0,-1); }
function breakG2(str){ return str==='b' ? 'a' : str.slice(0,-1); }
function breakG3(str){
  if(str.length===0) return 'a';
  const arr=str.split(''); arr[0]= arr[0]==='a' ? 'b':'a'; return arr.join('');
}

function buildIdentifyPool(diff){
  const {nMin,nMax}=diff, pool=[], seen=new Set();
  function add(str,correct){ if(seen.has(str)) return; seen.add(str); pool.push({string:str, correctGrammar:correct}); }
  for(let n=nMin;n<=nMax;n++){
    add(makeG1(n),0); add(makeG2(n),1); add(makeG3(n),2); add(makeG4(Math.max(1,n)),3);
  }
  for(let i=0;i<8;i++){
    const n=randInt(nMin,nMax);
    add(makeG1(n),0); add(makeG2(n),1); add(makeG3(n),2); add(makeG4(Math.max(1,n)),3);
  }
  for(let i=0;i<6;i++) add(makeInvalid(randInt(nMin+1,nMax+1)),-1);
  return pool;
}
function buildValidityPool(diff){
  const {nMin,nMax}=diff, pool=[], seen=new Set();
  function add(gIdx,str,isValid){ const k=gIdx+':'+str; if(seen.has(k)) return; seen.add(k); pool.push({grammarIndex:gIdx,string:str,isValid}); }
  for(let n=nMin;n<=nMax;n++){
    add(0, makeG1(n), true);       add(1, makeG2(n), true);       add(2, makeG3(n), true);       add(3, makeG4(Math.max(1,n)), true);
    add(0, breakG1(makeG1(n)), false); add(1, breakG2(makeG2(n)), false); add(2, breakG3(makeG3(n)), false); add(3, makeInvalid(Math.max(1,n)), false);
  }
  return pool;
}

let state = {
  mode:null, diffKey:null, diff:null,
  round:[], idx:0, totalQuestions:0, correct:0, wrong:0, hearts:0, maxHearts:0,
  timeLeft:0, timerId:null,
  answered:false, selectedType:null, skipsLeft:0
};

const el = {};
function cacheDom(){
  el.screenMenu=document.getElementById('screen-menu');
  el.screenGame=document.getElementById('screen-game');
  el.screenOver=document.getElementById('screen-over');
  el.modeGrid=document.getElementById('modeGrid');
  el.diffGrid=document.getElementById('diffGrid');
  el.startBtn=document.getElementById('startBtn');
  el.howToBtn=document.getElementById('howToBtn');
  el.howtoModal=document.getElementById('howtoModal');
  el.closeHowTo=document.getElementById('closeHowTo');

  el.heartsDisplay=document.getElementById('heartsDisplay');
  el.timerFill=document.getElementById('timerFill');
  el.timerNum=document.getElementById('timerNum');
  el.correctCount=document.getElementById('correctCount');
  el.wrongCount=document.getElementById('wrongCount');
  el.quitBtn=document.getElementById('quitBtn');
  el.progressDots=document.getElementById('progressDots');

  el.questionCounter=document.getElementById('questionCounter');
  el.modeLabel=document.getElementById('modeLabel');
  el.grammarDisplay=document.getElementById('grammarDisplay');
  el.currentString=document.getElementById('currentString');
  el.hintText=document.getElementById('hintText');
  el.skipBtn=document.getElementById('skipBtn');
  el.grammarGrid=document.getElementById('grammarGrid');
  el.grammarBtns=document.querySelectorAll('.grammar-select-btn');
  el.validityButtons=document.getElementById('validityButtons');
  el.validBtn=document.getElementById('validBtn');
  el.invalidBtn=document.getElementById('invalidBtn');
  el.resultPanel=document.getElementById('resultPanel');
  el.resultMsg=document.getElementById('resultMsg');
  el.feedbackMsg=document.getElementById('feedbackMsg');
  el.grammarDefBlock=document.getElementById('grammarDefBlock');
  el.derivationBlock=document.getElementById('derivationBlock');
  el.parseTreeDisplay=document.getElementById('parseTreeDisplay');
  el.nextBtn=document.getElementById('nextBtn');

  el.overGrade=document.getElementById('overGrade');
  el.overCorrect=document.getElementById('overCorrect');
  el.overWrong=document.getElementById('overWrong');
  el.overAcc=document.getElementById('overAcc');
  el.overHearts=document.getElementById('overHearts');
  el.overSettings=document.getElementById('overSettings');
  el.playAgainBtn=document.getElementById('playAgainBtn');
  el.menuBtn=document.getElementById('menuBtn');
}

function showScreen(name){
  [el.screenMenu, el.screenGame, el.screenOver].forEach(s=>s.classList.remove('active'));
  ({menu:el.screenMenu, game:el.screenGame, over:el.screenOver})[name].classList.add('active');
  window.scrollTo(0,0);
}

function initMenu(){
  el.modeGrid.querySelectorAll('.option-card').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      el.modeGrid.querySelectorAll('.option-card').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      state.mode = btn.dataset.mode;
      updateStartBtn();
    });
  });
  el.diffGrid.querySelectorAll('.option-card').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      el.diffGrid.querySelectorAll('.option-card').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      state.diffKey = btn.dataset.diff;
      updateStartBtn();
    });
  });
  el.startBtn.addEventListener('click', startGame);
  el.howToBtn.addEventListener('click', ()=> el.howtoModal.classList.add('open'));
  el.closeHowTo.addEventListener('click', ()=> el.howtoModal.classList.remove('open'));
  el.howtoModal.addEventListener('click', e=>{ if(e.target===el.howtoModal) el.howtoModal.classList.remove('open'); });
}
function updateStartBtn(){ el.startBtn.disabled = !(state.mode && state.diffKey); }

function pickRound(){
  const diff = DIFFS[state.diffKey];
  const identifyPool = buildIdentifyPool(diff);
  const validityPool = buildValidityPool(diff);
  if(state.mode==='identify') return shuffle(identifyPool).slice(0,QUESTIONS_PER_ROUND).map(q=>({type:'identify',...q}));
  if(state.mode==='validity') return shuffle(validityPool).slice(0,QUESTIONS_PER_ROUND).map(q=>({type:'validity',...q}));
  const half=QUESTIONS_PER_ROUND/2;
  const a=shuffle(identifyPool).slice(0,half).map(q=>({type:'identify',...q}));
  const b=shuffle(validityPool).slice(0,half).map(q=>({type:'validity',...q}));
  return shuffle([...a,...b]);
}

function startGame(){
  unlockAudio();
  state.diff = DIFFS[state.diffKey];

  state.round = pickRound();
  state.totalQuestions = state.round.length;
  state.idx=0; state.correct=0; state.wrong=0;
  state.skipsLeft = SKIPS_ALLOWED;
  state.hearts=state.diff.hearts; state.maxHearts=state.diff.hearts;
  el.correctCount.textContent='0'; el.wrongCount.textContent='0';
  renderHearts();
  renderProgressDots();
  showScreen('game');
  loadQuestion();
}

function renderHearts(){
  el.heartsDisplay.innerHTML='';
  for(let i=0;i<state.maxHearts;i++){
    const s=document.createElementNS('http://www.w3.org/2000/svg','svg');
    s.setAttribute('viewBox','0 0 24 24');
    s.setAttribute('class','heart-icon'+(i>=state.hearts?' lost':''));
    s.innerHTML='<path fill="currentColor" d="M12 21s-6.7-4.35-9.33-8.2C.86 10.1 1.1 6.9 3.5 5.1c2.1-1.58 4.9-1.13 6.5 1 .55.73 1.35 1.9 2 1.9s1.45-1.17 2-1.9c1.6-2.13 4.4-2.58 6.5-1 2.4 1.8 2.64 5 .83 7.7C18.7 16.65 12 21 12 21z"/>';
    el.heartsDisplay.appendChild(s);
  }
}
function loseHeart(){
  state.hearts=Math.max(0,state.hearts-1);
  renderHearts();
  el.heartsDisplay.classList.remove('shake'); void el.heartsDisplay.offsetWidth; el.heartsDisplay.classList.add('shake');
}
function updateTimerUI(){
  const total = state.timeTotal || 1;
  const pct=Math.max(0,Math.min(100,(state.timeLeft/total)*100));
  el.timerFill.style.width=pct+'%';
  el.timerNum.textContent=Math.max(0,Math.ceil(state.timeLeft));
  el.timerFill.classList.toggle('low', state.timeLeft<=total*0.35 && state.timeLeft>total*0.15);
  el.timerFill.classList.toggle('critical', state.timeLeft<=total*0.15);
}
function stopTimer(){ if(state.timerId){ clearInterval(state.timerId); state.timerId=null; } }

const TIME_BY_TYPE = { validity:10, identify:12 };
function startTimer(){
  stopTimer();
  const q=state.round[0];
  state.timeTotal = TIME_BY_TYPE[q.type] || 12;
  state.timeLeft=state.timeTotal;
  updateTimerUI();
  state.timerId=setInterval(()=>{
    state.timeLeft -= 1;
    if(state.timeLeft<=0){ state.timeLeft=0; updateTimerUI(); stopTimer(); handleTimeUp(); return; }
    updateTimerUI();

    const urgency = 1 - (state.timeLeft/state.timeTotal);
    if(state.timeLeft<=state.timeTotal*0.15) sfxCriticalPulse();
    else sfxTick(urgency);
  },1000);
}

let resultsByIndex={};
function renderProgressDots(){
  let html='';
  for(let i=0;i<state.totalQuestions;i++) html+=`<span class="dot" data-i="${i}"></span>`;
  el.progressDots.innerHTML=html;
  resultsByIndex={};
  paintDots();
}
function paintDots(){
  el.progressDots.querySelectorAll('.dot').forEach((d,i)=>{
    d.classList.remove('current','done-correct','done-wrong');
    if(resultsByIndex[i]===true) d.classList.add('done-correct');
    else if(resultsByIndex[i]===false) d.classList.add('done-wrong');
    if(i===state.idx) d.classList.add('current');
  });
}

function colorizeString(str){
  if(str==='') return '<span style="opacity:.6">ε</span>';
  return str.split('').map(ch=> ch==='a' ? `<span class="token-a">a</span>` : ch==='b' ? `<span class="token-b">b</span>` : ch).join('');
}

function loadQuestion(){
  stopTimer();
  if(state.hearts<=0){ endRound(); return; }
  if(state.round.length===0){ endRound(); return; }

  const q=state.round[0];
  state.answered=false;

  el.questionCounter.textContent=`Question ${state.idx+1} of ${state.totalQuestions}`;
  el.resultPanel.classList.remove('show');
  el.grammarDefBlock.innerHTML=''; el.derivationBlock.innerHTML=''; el.parseTreeDisplay.innerHTML='';
  el.resultMsg.innerHTML=''; el.feedbackMsg.textContent='';
  el.nextBtn.disabled=true;

  el.skipBtn.style.display='inline-flex';
  el.skipBtn.disabled = state.round.length<=1 || state.skipsLeft<=0;
  el.skipBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M6 5v14l8.5-7L6 5zm10 0v14h2V5h-2z"/></svg> Skip (${state.skipsLeft} left)`;

  if(q.type==='identify'){
    el.modeLabel.innerHTML=`<svg class="icon" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Identify the Grammar`;
    el.grammarDisplay.style.display='none';
    el.grammarGrid.style.display='grid';
    el.validityButtons.style.display='none';
    el.hintText.textContent=`Select the grammar that generates "${q.string===''?'ε':q.string}" — or None if no grammar does.`;
    el.grammarBtns.forEach(btn=>{
      const gId=parseInt(btn.dataset.grammar,10);
      btn.className='grammar-select-btn'+(gId===-1?' none-btn':'');
      btn.style.pointerEvents='auto';
    });
  } else {
    el.modeLabel.innerHTML=`<svg class="icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg> Valid or Invalid`;
    el.grammarDisplay.style.display='block';
    el.grammarDisplay.textContent=grammars[q.grammarIndex].display;
    el.grammarGrid.style.display='none';
    el.validityButtons.style.display='grid';
    el.hintText.textContent=`Is "${q.string===''?'ε':q.string}" valid for ${grammars[q.grammarIndex].name}?`;
    el.validBtn.className='validity-btn valid-btn';
    el.invalidBtn.className='validity-btn invalid-btn';
    el.validBtn.disabled=false;
    el.invalidBtn.disabled=false;
    el.validBtn.style.pointerEvents='auto';
    el.invalidBtn.style.pointerEvents='auto';
  }

  el.currentString.innerHTML=colorizeString(q.string);
  el.correctCount.textContent=state.correct;
  el.wrongCount.textContent=state.wrong;
  paintDots();
  startTimer();
}

function selectGrammar(index){
  if(state.answered) return;
  const q=state.round[0];

  state.answered=true;
  stopTimer();
  el.skipBtn.style.display='none';

  if(index===q.correctGrammar){
    state.correct++;
    sfxCorrect();
    el.grammarBtns.forEach(b=>{
      const gId=parseInt(b.dataset.grammar,10);
      b.style.pointerEvents='none';
      if(gId===q.correctGrammar) b.classList.add('correct');
    });
    revealCorrect('identify', q, 'correct');
  } else {
    loseHeart();
    sfxWrongFunny();
    el.grammarBtns.forEach(b=>{
      const gId=parseInt(b.dataset.grammar,10);
      b.style.pointerEvents='none';
      if(gId===index) b.classList.add('wrong');
      if(gId===q.correctGrammar) b.classList.add('correct');
    });
    revealCorrect('identify', q, 'wrong');
  }
}

function selectValidity(userSaysValid){
  if(state.answered) return;
  const q=state.round[0];
  const actuallyValid=grammars[q.grammarIndex].validate(q.string).valid;

  state.answered=true;
  stopTimer();
  el.skipBtn.style.display='none';
  el.validBtn.disabled=true; el.invalidBtn.disabled=true;

  if(userSaysValid===actuallyValid){
    state.correct++;
    sfxCorrect();
    (actuallyValid?el.validBtn:el.invalidBtn).classList.add('correct');
    revealCorrect('validity', q, 'correct');
  } else {
    loseHeart();
    sfxWrongFunny();
    (userSaysValid?el.validBtn:el.invalidBtn).classList.add('wrong');
    (actuallyValid?el.validBtn:el.invalidBtn).classList.add('correct');
    revealCorrect('validity', q, 'wrong');
  }
}

function handleTimeUp(){
  if(state.answered) return;
  state.answered=true;
  el.skipBtn.style.display='none';
  loseHeart();
  sfxTimeout();
  const q=state.round[0];
  if(q.type==='identify'){
    el.grammarBtns.forEach(b=>{
      const gId=parseInt(b.dataset.grammar,10);
      b.style.pointerEvents='none';
      if(gId===q.correctGrammar) b.classList.add('correct');
    });
  } else {
    el.validBtn.disabled=true; el.invalidBtn.disabled=true;
    const actuallyValid=grammars[q.grammarIndex].validate(q.string).valid;
    (actuallyValid?el.validBtn:el.invalidBtn).classList.add('correct');
  }
  revealCorrect(q.type, q, 'timeout');
}

function revealCorrect(type, q, status){
  resultsByIndex[state.idx] = status==='correct';
  if(status!=='correct') state.wrong++;
  el.correctCount.textContent=state.correct;
  el.wrongCount.textContent=state.wrong;
  paintDots();

  const roundIsOver = (state.idx >= state.totalQuestions - 1) || state.hearts<=0;
  if(roundIsOver){
    endRound();
    return;
  }

  let gIdx, str, isGenerated;
  if(type==='identify'){
    gIdx=q.correctGrammar; str=q.string; isGenerated = gIdx!==-1;
  } else {
    gIdx=q.grammarIndex; str=q.string; isGenerated = grammars[gIdx].validate(str).valid;
  }

  if(status==='timeout'){
    el.resultMsg.innerHTML=`<span class="bad-text"><svg class="icon" viewBox="0 0 24 24"><path d="M12 20a8 8 0 100-16 8 8 0 000 16zm0-18a10 10 0 110 20 10 10 0 010-20zm.5 5H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg> Time's up!</span>`;
    el.feedbackMsg.textContent = type==='identify'
      ? `"${str===''?'ε':str}" belongs to ${gIdx===-1?'None (invalid)':grammars[gIdx].name} — a heart was lost.`
      : `"${str===''?'ε':str}" is ${isGenerated?'valid':'invalid'} for ${grammars[gIdx].name} — a heart was lost.`;
  } else if(status==='wrong'){
    el.resultMsg.innerHTML=`<span class="bad-text"><svg class="icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg> Wrong!</span>`;
    el.feedbackMsg.textContent = type==='identify'
      ? `"${str===''?'ε':str}" belongs to ${gIdx===-1?'None (invalid)':grammars[gIdx].name} — a heart was lost.`
      : `"${str===''?'ε':str}" is ${isGenerated?'valid':'invalid'} for ${grammars[gIdx].name} — a heart was lost.`;
  } else {
    el.resultMsg.innerHTML=`<span class="ok-text"><svg class="icon" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Correct!</span>`;
    el.feedbackMsg.textContent = type==='identify'
      ? `"${str===''?'ε':str}" belongs to ${gIdx===-1?'None (invalid)':grammars[gIdx].name}.`
      : `"${str===''?'ε':str}" is ${isGenerated?'valid':'invalid'} for ${grammars[gIdx].name}.`;
  }

  el.grammarDefBlock.innerHTML='';
  el.derivationBlock.innerHTML='';
  el.parseTreeDisplay.innerHTML='';

  if(isGenerated){
    const g=grammars[gIdx];
    el.grammarDefBlock.innerHTML = renderGrammarDef(g);
    el.derivationBlock.innerHTML = renderDerivation(g, str);
    const wrap=document.createElement('div');
    wrap.innerHTML = `<div class="pt-title">Parse Tree</div>`;
    const treeHost=document.createElement('div');
    treeHost.className='tree-svg-wrap';
    treeHost.innerHTML = buildTreeSVG(g.buildTree(str));
    wrap.appendChild(treeHost);
    el.parseTreeDisplay.appendChild(wrap);
  } else {
    el.grammarDefBlock.innerHTML = `<div class="gdb-title">No Derivation</div><div class="gdb-row"><span class="gdb-val">"${str===''?'ε':str}" is not in the language of this grammar — there is no parse tree to show.</span></div>`;
  }

  el.resultPanel.classList.add('show');
  el.nextBtn.disabled=false;

}

function renderGrammarDef(g){
  const prods = g.P.map(p=>`<div>${p.replace('S','<span style="color:var(--red-bright)">S</span>')}</div>`).join('');
  return `
    <div class="gdb-title">Formal Grammar ${g.name}</div>
    <div class="gdb-row"><span class="gdb-key">V</span><span class="gdb-val">= { S } &nbsp;— non-terminals</span></div>
    <div class="gdb-row"><span class="gdb-key">T</span><span class="gdb-val">= { a, b } &nbsp;— terminals</span></div>
    <div class="gdb-row"><span class="gdb-key">S</span><span class="gdb-val">= S &nbsp;— start symbol</span></div>
    <div class="gdb-row"><span class="gdb-key">P</span><span class="gdb-val">= {</span></div>
    <div class="gdb-prod-list">${prods}</div>
    <div class="gdb-val">}</div>
    <div class="gdb-row" style="margin-top:.4rem;"><span class="gdb-key">G</span><span class="gdb-val">= (V, T, S, P)</span></div>
  `;
}
function renderDerivation(g, str){
  const steps = g.derive(str);
  const line = steps.map((s,i)=>{
    const display = s===''? 'ε' : s.split('').map(ch=> ch==='S' ? '<span class="nt">S</span>' : ch).join('');
    return `<span class="sform">${display}</span>` + (i<steps.length-1 ? '<span class="arrow">⇒</span>' : '');
  }).join('');
  return `<div class="gdb-title">Leftmost Derivation</div><div class="derivation-line">${line}</div>`;
}

function layoutTree(root){
  let nextX=0; const H_GAP=78, V_GAP=88;
  function assign(node, depth){
    node.depth=depth; node.r = node.isTerminal ? 17 : 21;
    if(!node.children || node.children.length===0){ node.x=nextX*H_GAP; nextX++; }
    else{ node.children.forEach(c=>assign(c,depth+1)); const xs=node.children.map(c=>c.x); node.x=(Math.min(...xs)+Math.max(...xs))/2; }
    node.y=depth*V_GAP;
    return node;
  }
  return assign(root,0);
}
function collectNodesEdges(node,nodes,edges,parent){
  nodes.push(node);
  if(parent) edges.push({from:parent,to:node});
  (node.children||[]).forEach(c=>collectNodesEdges(c,nodes,edges,node));
}
function buildTreeSVG(root){
  layoutTree(root);
  const nodes=[], edges=[];
  collectNodesEdges(root,nodes,edges,null);
  const PAD=36;
  const maxX=Math.max(...nodes.map(n=>n.x));
  const maxY=Math.max(...nodes.map(n=>n.y));
  const width=maxX+PAD*2, height=maxY+PAD*2;
  let svg=`<svg class="tree-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  edges.forEach(e=>{
    const x1=e.from.x+PAD, y1=e.from.y+PAD+e.from.r, x2=e.to.x+PAD, y2=e.to.y+PAD-e.to.r;
    svg+=`<line class="tree-edge" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>`;
  });
  nodes.forEach(n=>{
    const cx=n.x+PAD, cy=n.y+PAD;
    const mods=[];
    if(n.isTerminal){ mods.push('terminal'); if(n.isEpsilon) mods.push('epsilon'); else if(n.label==='a') mods.push('tok-a'); else if(n.label==='b') mods.push('tok-b'); }
    else if(n.depth===0) mods.push('root');
    const cls=mods.length ? ' '+mods.join(' ') : '';
    svg+=`<circle class="tree-node-circle${cls}" cx="${cx}" cy="${cy}" r="${n.r}"></circle><text class="tree-node-text${cls}" x="${cx}" y="${cy}">${n.label}</text>`;
  });
  svg+=`</svg>`;
  return svg;
}

function skipQuestion(){
  if(state.answered) return;
  if(state.round.length<=1) return;
  if(state.skipsLeft<=0) return;
  stopTimer();
  sfxSkip();
  state.skipsLeft--;
  state.round.push(state.round.shift());
  loadQuestion();
}

function advance(){
  state.round.shift();
  state.idx++;
  loadQuestion();
}
function endRound(){
  stopTimer();
  const total=state.correct+state.wrong;
  const pct = total>0 ? Math.round((state.correct/total)*100) : 0;
  const grade = pct===100?'S': pct>=90?'A': pct>=75?'B': pct>=50?'C':'D';
  el.overGrade.textContent=grade;
  el.overCorrect.textContent=state.correct;
  el.overWrong.textContent=state.wrong;
  el.overAcc.textContent=pct+'%';
  el.overHearts.textContent=`${state.hearts} / ${state.maxHearts}`;
  const modeLabel = state.mode==='identify'?'Identify Grammar': state.mode==='validity'?'Valid or Invalid':'Mixed';
  el.overSettings.textContent=`${modeLabel} · ${DIFFS[state.diffKey].label}`;
  sfxRoundOver();
  showScreen('over');
}

function bindEvents(){
  el.grammarBtns.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(document.getElementById('screen-game').classList.contains('active') && el.grammarGrid.style.display!=='none'){
        selectGrammar(parseInt(btn.dataset.grammar,10));
      }
    });
  });
  el.validBtn.addEventListener('click', ()=> selectValidity(true));
  el.invalidBtn.addEventListener('click', ()=> selectValidity(false));
  el.skipBtn.addEventListener('click', skipQuestion);
  el.nextBtn.addEventListener('click', advance);
  el.quitBtn.addEventListener('click', ()=>{ stopTimer(); showScreen('menu'); });
  el.playAgainBtn.addEventListener('click', startGame);
  el.menuBtn.addEventListener('click', ()=> showScreen('menu'));

  document.addEventListener('keydown', e=>{
    if(!document.getElementById('screen-game').classList.contains('active')) return;
    if(e.key==='r' || e.key==='R'){ startGame(); return; }
    if(!state.answered){
      const q=state.round[0];
      if(e.key==='s'||e.key==='S'){ skipQuestion(); return; }
      if(q.type==='identify'){
        if(e.key>='1' && e.key<='4') selectGrammar(parseInt(e.key,10)-1);
        else if(e.key==='5' || e.key==='0') selectGrammar(-1);
      } else {
        if(e.key==='v'||e.key==='V') selectValidity(true);
        if(e.key==='i'||e.key==='I') selectValidity(false);
      }
    }
    if(e.key==='Enter' && !el.nextBtn.disabled) advance();
  });
}

function init(){
  cacheDom();
  initMenu();
  bindEvents();
}
window.addEventListener('load', init);
})();
