// viewで表示
const observer=new IntersectionObserver(
  (entries,obs)=>{
    entries.forEach((entry)=>{
      if(entry.isIntersecting){
        entry.target.classList.add("in-view");
        obs.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.1,
    rootMargin: "0px 0px -10% 0px",
  }
);
// .reveal を監視
document.querySelectorAll(".reveal").forEach((el)=>observer.observe(el));

(function initSideParticles() {
  const left=document.querySelector(".side-particles.left");
  const right=document.querySelector(".side-particles.right");
  if (!left||!right) return;

  const prefersReduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isNarrow=window.matchMedia("(max-width: 900px)").matches;
  if (prefersReduced||isNarrow) return;

  createParticles(left,14);
  createParticles(right,14);

  function createParticles(container,count=12){
    for(let i=0;i<count;i++){
      const s=document.createElement("span");

      // 横位置
      const leftPos=10+Math.random()*80;
      s.style.left=`${leftPos}%`;

      // サイズ
      const size=4+Math.random()*8;
      s.style.width=`${size}px`;
      s.style.height=`${size}px`;

      // 速度
      const dur=10+Math.random()*14;
      s.style.setProperty("--dur",`${dur}s`);
      s.style.animationDelay=`${-Math.random()*24}s`;

      // たまにアクセントカラー
      if(Math.random()<0.35) s.classList.add("accent");

      container.appendChild(s);
    }
  }
})();

// img-ani終了まで非表示
(function syncDecorToHero(){
  const decor=document.querySelector(".decor");
  const img=document.querySelector(".profile-img");
  if(!decor||!img) return;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isNarrow=window.matchMedia("(max-width: 900px)").matches;
  if(isNarrow) return;
  const activate=()=>decor.classList.add("active");
  if(prefersReduced){
    decor.style.transition="none";
    activate();
    return;
  }
  let done=false;
  const once=()=>{
    if(done) return;
    done=true;
    activate();
  };
  img.addEventListener(
    "animationend",
    (e)=>{
      if(e.animationName==="spinPop") once();
    },
    {once: true}
  );

  //（1.5s + 0.3s ≒ 1.8s）
  setTimeout(once,1900);
})();

(function setCopyrightYear(){
  const y=document.getElementById('year');
  if (y) y.textContent=new Date().getFullYear();
})();