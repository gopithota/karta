import { useEffect, useRef, useState } from "react";
import { THEMES, SWATCHES, useTheme } from "./theme.js";

// ── Shared primitives ─────────────────────────────────────────────

function KartaLogo({ size = 36 }) {
  const cells = [
    ["#2a6040","#3a7a52","#4a9966"],
    ["#3a7a52","#4a9966","#5ab878"],
    ["#4a9966","#5ab878","#4ade80"],
    ["#235238","#4a9966","#22c55e"],
  ];
  const cell = size/4.2, gap = cell*0.18, r = cell*0.28;
  const totalW = 3*cell+2*gap, totalH = 4*cell+3*gap;
  const ox = (size-totalW)/2, oy = (size-totalH)/2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
      {cells.map((row,ri)=>row.map((fill,ci)=>(
        <rect key={`${ri}-${ci}`} x={ox+ci*(cell+gap)} y={oy+ri*(cell+gap)} width={cell} height={cell} rx={r} fill={fill}/>
      )))}
    </svg>
  );
}

const DEMO_TILES = [
  {t:"NVDA",p:4.82,w:18},{t:"AAPL",p:-0.43,w:14},{t:"MSFT",p:1.21,w:13},
  {t:"GOOGL",p:2.67,w:10},{t:"META",p:3.11,w:9},{t:"AMZN",p:-1.88,w:10},
  {t:"TSLA",p:-5.30,w:8},{t:"JPM",p:0.94,w:7},{t:"V",p:0.42,w:6},{t:"BRK.B",p:0.18,w:5},
];
function perfColor(p) {
  if(p===null||p===undefined||isNaN(p))return "#D1D5DB";
  if(Math.abs(p)<0.2)return "#E8EAED";
  const t=Math.max(-1,Math.min(1,p/8));
  if(t<0){const i=-t;return `rgb(${Math.round(252-87*i)},${Math.round(232-218*i)},${Math.round(230-216*i)})`;}
  return `rgb(${Math.round(230-211*t)},${Math.round(244-129*t)},${Math.round(234-183*t)})`;
}
function demoFg(p) {
  const s=p!=null&&Math.abs(p)>4;
  return {main:s?"rgba(255,255,255,0.95)":(p>=0?"#14532d":"#7f1d1d"),sub:s?"rgba(255,255,255,0.80)":(p>=0?"#166534":"#991b1b")};
}
function computeDemoTreemap(items,W,H) {
  if(!items.length||!W||!H)return [];
  const total=items.reduce((s,t)=>s+t.w,0);
  const nodes=items.map(t=>({...t,area:(t.w/total)*W*H}));
  function split(ns,x,y,w,h) {
    if(!ns.length)return [];
    if(ns.length===1)return [{...ns[0],rx:x,ry:y,rw:w,rh:h}];
    const sum=ns.reduce((s,n)=>s+n.area,0);
    let acc=0,si=1;
    for(let i=0;i<ns.length-1;i++){acc+=ns[i].area;si=i+1;if(acc>=sum/2)break;}
    const left=ns.slice(0,si),right=ns.slice(si);
    const r=left.reduce((s,n)=>s+n.area,0)/sum;
    return w>=h?[...split(left,x,y,w*r,h),...split(right,x+w*r,y,w*(1-r),h)]:[...split(left,x,y,w,h*r),...split(right,x,y+h*r,w,h*(1-r))];
  }
  return split(nodes,0,0,W,H);
}
function DemoHeatmap() {
  const [tiles,setTiles]=useState(DEMO_TILES);
  const containerRef=useRef(null);
  const [size,setSize]=useState({w:500,h:220});
  useEffect(()=>{
    if(!containerRef.current)return;
    const obs=new ResizeObserver(([e])=>setSize({w:e.contentRect.width,h:e.contentRect.height}));
    obs.observe(containerRef.current);
    return()=>obs.disconnect();
  },[]);
  useEffect(()=>{
    const id=setInterval(()=>setTiles(p=>p.map(t=>({...t,p:Math.max(-9,Math.min(9,t.p+(Math.random()-0.49)*0.5))}))),1400);
    return()=>clearInterval(id);
  },[]);
  const GAP=3;
  const rects=computeDemoTreemap(tiles,size.w,size.h);
  return (
    <div ref={containerRef} style={{position:"relative",width:"100%",height:"100%"}}>
      {rects.map(rect=>{
        const x=rect.rx+GAP,y=rect.ry+GAP,w=rect.rw-GAP*2,h=rect.rh-GAP*2;
        if(w<4||h<4)return null;
        const fg=demoFg(rect.p);
        return (
          <div key={rect.t} style={{position:"absolute",left:x,top:y,width:w,height:h,background:perfColor(rect.p),borderRadius:6,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",overflow:"hidden",transition:"background 1s ease",boxShadow:"inset 0 0 0 1px rgba(0,0,0,0.08)"}}>
            {w>28&&h>18&&<div style={{fontSize:Math.max(9,Math.min(14,w/5.5)),fontWeight:800,color:fg.main,lineHeight:1.1,letterSpacing:"-0.02em",fontFamily:"'JetBrains Mono',monospace"}}>{rect.t}</div>}
            {w>52&&h>36&&<div style={{fontSize:Math.max(8,Math.min(11,w/7)),fontWeight:600,color:fg.sub,lineHeight:1.3,fontFamily:"'JetBrains Mono',monospace"}}>{rect.p>=0?"+":""}{rect.p.toFixed(2)}%</div>}
          </div>
        );
      })}
    </div>
  );
}

const TICKER_ITEMS=[
  {sym:"AAPL",chg:+1.24},{sym:"NVDA",chg:+8.40},{sym:"TSLA",chg:-5.20},{sym:"MSFT",chg:+0.87},
  {sym:"META",chg:+3.11},{sym:"AMZN",chg:-1.88},{sym:"GOOGL",chg:+2.67},{sym:"JPM",chg:+0.94},
  {sym:"BRK.B",chg:+0.18},{sym:"V",chg:+0.42},{sym:"NFLX",chg:-2.14},{sym:"AMD",chg:+5.33},
];
function TickerTape({S}) {
  const items=[...TICKER_ITEMS,...TICKER_ITEMS];
  return (
    <div className="v3-ticker-wrap">
      <div className="v3-ticker-track">
        {items.map((item,i)=>(
          <span key={i} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"0 14px",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>
            <span style={{color:"rgba(74,222,128,0.9)",fontWeight:700}}>{item.sym}</span>
            <span style={{color:item.chg>=0?"#4ade80":"#f87171",fontWeight:600}}>{item.chg>=0?"+":""}{item.chg.toFixed(2)}%</span>
            <span style={{color:"rgba(255,255,255,0.15)"}}>|</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function useScrollReveal(count) {
  const refs=useRef([]);
  const [revealed,setRevealed]=useState(()=>Array(count).fill(false));
  useEffect(()=>{
    const obs=new IntersectionObserver((entries)=>{
      entries.forEach(e=>{if(e.isIntersecting){const i=refs.current.indexOf(e.target);if(i!==-1){setRevealed(p=>{const n=[...p];n[i]=true;return n;});obs.unobserve(e.target);}}});
    },{threshold:0.08});
    refs.current.forEach(el=>{if(el)obs.observe(el);});
    return()=>obs.disconnect();
  },[]);
  return [refs,revealed];
}

// ── Animated counter ──────────────────────────────────────────────
function AnimCounter({target, suffix=""}) {
  const [val, setVal] = useState(0);
  const posted = useRef(false);
  useEffect(() => {
    if (posted.current) return; posted.current = true;
    fetch("/api/counter", {method:"POST"}).then(r=>r.json()).then(d=>setVal(d.count)).catch(()=>setVal(target));
  }, [target]);
  useEffect(() => {
    const start = Math.max(0, val-50); let cur = start;
    const step = Math.max(1, Math.ceil((val-start)/30));
    const id = setInterval(()=>{cur=Math.min(val,cur+step);if(cur>=val)clearInterval(id);},36);
    return ()=>clearInterval(id);
  }, [val]);
  return <span>{val > 0 ? val.toLocaleString() : "—"}{suffix}</span>;
}

// ── Keyword pill ──────────────────────────────────────────────────
function KeywordPill({label, color="rgba(74,222,128,0.15)", textColor="#4ade80", delay=0, revealed}) {
  return (
    <div style={{
      display:"inline-flex", alignItems:"center", gap:6,
      padding:"6px 14px", borderRadius:99,
      background: color, border:`1px solid ${textColor}33`,
      fontSize:13, fontWeight:600, color:textColor,
      fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.02em",
      opacity: revealed ? 1 : 0,
      transform: revealed ? "translateY(0) scale(1)" : "translateY(12px) scale(0.95)",
      transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
    }}>
      {label}
    </div>
  );
}

// ── Tool strip card ───────────────────────────────────────────────
function ToolStrip({icon, name, desc, accent, S}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      style={{
        minWidth: 220, flexShrink:0,
        background: hovered ? `${accent}10` : "rgba(255,255,255,0.03)",
        border:`1px solid ${hovered ? accent+"44" : "rgba(255,255,255,0.08)"}`,
        borderRadius:14, padding:"20px 18px",
        display:"flex",flexDirection:"column",gap:10,
        transform:hovered?"translateY(-4px)":"none",
        transition:"all 0.2s ease",cursor:"default",
      }}>
      <div style={{fontSize:24}}>{icon}</div>
      <div style={{fontWeight:700,fontSize:15,color:"#fff"}}>{name}</div>
      <div style={{fontSize:13,color:"rgba(255,255,255,0.55)",lineHeight:1.6}}>{desc}</div>
      <div style={{width:32,height:2,background:accent,borderRadius:2,marginTop:4,transition:"width 0.2s",width:hovered?56:32}} />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function LandingV3() {
  const [theme, setTheme] = useTheme();
  const S = THEMES[theme];

  useEffect(() => { document.body.style.background = "#060d06"; }, []);

  const [scrolled, setScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [heroRevealed, setHeroRevealed] = useState(false);
  const [revealRefs, revealed] = useScrollReveal(5);

  useEffect(()=>{const t=setTimeout(()=>setHeroRevealed(true),100);return()=>clearTimeout(t);},[]);
  useEffect(()=>{const fn=()=>setScrolled(window.scrollY>24);window.addEventListener("scroll",fn);return()=>window.removeEventListener("scroll",fn);},[]);
  useEffect(()=>{const fn=()=>setIsMobile(window.innerWidth<768);window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);

  const ThemePicker = (
    <div style={{display:"flex",gap:5,alignItems:"center",padding:"4px 8px",borderRadius:20,border:"1px solid rgba(255,255,255,0.12)"}}>
      {SWATCHES.map(t=>(
        <button key={t.key} onClick={()=>setTheme(t.key)} title={t.label} style={{width:14,height:14,borderRadius:"50%",background:t.dot,border:theme===t.key?"2px solid #4ade80":"2px solid transparent",cursor:"pointer",padding:0,outline:"none",transition:"box-shadow 0.15s"}} />
      ))}
    </div>
  );

  return (
    <div style={{background:"#060d06",color:"#f0fdf4",minHeight:"100vh",fontFamily:"'Inter',system-ui,sans-serif"}}>

      {/* Animated background gradient */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
        <div className="v3-grad-1" />
        <div className="v3-grad-2" />
        <div className="v3-grad-3" />
      </div>
      {/* Subtle grid */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,backgroundImage:"linear-gradient(rgba(74,222,128,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(74,222,128,0.03) 1px,transparent 1px)",backgroundSize:"60px 60px"}} />

      {/* ── Nav ── */}
      <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:100,padding:isMobile?"0 16px":"0 32px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56,background:scrolled?"rgba(6,13,6,0.88)":"transparent",backdropFilter:scrolled?"blur(20px)":"none",borderBottom:scrolled?"1px solid rgba(74,222,128,0.1)":"none",transition:"all 0.3s"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <KartaLogo size={28} />
          <span style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:20,letterSpacing:"-0.01em",color:"#f0fdf4"}}>Karta</span>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {!isMobile && ThemePicker}
          <a href="/app" style={{padding:"6px 20px",borderRadius:8,background:"#4ade80",color:"#051a0a",fontSize:13,fontWeight:800,textDecoration:"none",transition:"all 0.2s",boxShadow:"0 0 20px rgba(74,222,128,0.25)"}} onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 0 32px rgba(74,222,128,0.4)";}} onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 0 20px rgba(74,222,128,0.25)";}}>Launch →</a>
        </div>
      </nav>

      {/* ── Hero: split layout ── */}
      <section style={{position:"relative",zIndex:1,minHeight:"100vh",display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:0,alignItems:"center",padding:isMobile?"88px 16px 60px":"0 0 0 6vw",maxWidth:1400,margin:"0 auto"}}>

        {/* Left: text */}
        <div style={{padding:isMobile?"0":"100px 0 60px",display:"flex",flexDirection:"column",gap:0}}>

          {/* Keyword pills */}
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:32}}>
            {[
              {label:"#analyze",color:"rgba(74,222,128,0.15)",textColor:"#4ade80",delay:0},
              {label:"#strategize",color:"rgba(34,211,238,0.12)",textColor:"#22d3ee",delay:80},
              {label:"#watchlists",color:"rgba(167,139,250,0.12)",textColor:"#a78bfa",delay:160},
              {label:"#air-gapped",color:"rgba(74,222,128,0.1)",textColor:"#4ade80",delay:240},
              {label:"#local-only",color:"rgba(251,191,36,0.1)",textColor:"#fbbf24",delay:320},
              {label:"#no-server",color:"rgba(248,113,113,0.1)",textColor:"#f87171",delay:400},
            ].map(p=><KeywordPill key={p.label} {...p} revealed={heroRevealed} />)}
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily:"'DM Serif Display',Georgia,serif",
            fontSize:"clamp(48px,6vw,82px)",
            fontWeight:400,lineHeight:1.0,letterSpacing:"-0.04em",
            color:"#f0fdf4",margin:"0 0 24px",
            opacity:heroRevealed?1:0,
            transform:heroRevealed?"none":"translateY(20px)",
            transition:"opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s",
          }}>
            Invest smarter.<br />
            <em style={{background:"linear-gradient(135deg,#4ade80,#22d3ee)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Privately.</em>
          </h1>

          {/* Sub */}
          <p style={{
            fontSize:isMobile?15:17,color:"rgba(240,253,244,0.6)",lineHeight:1.8,
            maxWidth:480,marginBottom:36,
            opacity:heroRevealed?1:0,
            transform:heroRevealed?"none":"translateY(16px)",
            transition:"opacity 0.6s ease 0.35s, transform 0.6s ease 0.35s",
          }}>
            The private finance platform for serious investors. Portfolio heatmaps, watchlists, correlation analysis — running entirely in your browser. Your holdings are structurally air-gapped from our servers.
          </p>

          {/* CTAs */}
          <div style={{
            display:"flex",gap:12,flexWrap:"wrap",marginBottom:40,
            opacity:heroRevealed?1:0,
            transform:heroRevealed?"none":"translateY(12px)",
            transition:"opacity 0.6s ease 0.5s, transform 0.6s ease 0.5s",
          }}>
            <a href="/app" style={{padding:"14px 32px",borderRadius:10,background:"linear-gradient(135deg,#4ade80,#16a34a)",color:"#051a0a",fontSize:15,fontWeight:800,textDecoration:"none",boxShadow:"0 0 48px rgba(74,222,128,0.3)",transition:"transform 0.2s,box-shadow 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 48px rgba(74,222,128,0.45)";}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 0 48px rgba(74,222,128,0.3)";}}>Open Platform →</a>
          </div>

          {/* Trust stats */}
          <div style={{
            display:"flex",gap:28,flexWrap:"wrap",
            opacity:heroRevealed?1:0,
            transition:"opacity 0.6s ease 0.65s",
          }}>
            {[
              {val:<AnimCounter target={312} />, label:"investors using Karta"},
              {val:"0 kb", label:"data sent to servers"},
            ].map((s,i)=>(
              <div key={i} style={{display:"flex",flexDirection:"column",gap:3}}>
                <div style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:"clamp(22px,3vw,32px)",fontWeight:400,color:"#f0fdf4",letterSpacing:"-0.02em"}}>{s.val}</div>
                <div style={{fontSize:11,color:"rgba(240,253,244,0.4)",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.04em"}}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: demo window */}
        {!isMobile && (
          <div style={{
            padding:"100px 6vw 60px 4vw",
            opacity:heroRevealed?1:0,
            transform:heroRevealed?"none":"translateX(30px)",
            transition:"opacity 0.7s ease 0.4s, transform 0.7s ease 0.4s",
          }}>
            <div style={{
              background:"rgba(10,20,10,0.95)",
              border:"1px solid rgba(74,222,128,0.15)",
              borderRadius:18,overflow:"hidden",
              boxShadow:"0 40px 120px rgba(0,0,0,0.7),0 0 60px rgba(74,222,128,0.08)",
              transform:"perspective(1000px) rotateY(-3deg) rotateX(2deg)",
            }}>
              <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(74,222,128,0.1)",display:"flex",alignItems:"center",gap:10,background:"rgba(0,0,0,0.4)"}}>
                <div style={{display:"flex",gap:6}}>{["#f87171","#fbbf24","#4ade80"].map(c=><div key={c} style={{width:10,height:10,borderRadius:"50%",background:c,opacity:0.7}} />)}</div>
                <div style={{flex:1,background:"rgba(255,255,255,0.05)",borderRadius:5,height:20,display:"flex",alignItems:"center",paddingLeft:10,gap:6}}>
                  <KartaLogo size={12} />
                  <span style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontFamily:"'JetBrains Mono',monospace"}}>getkarta.vercel.app</span>
                </div>
              </div>
              <div style={{padding:"8px 14px",borderBottom:"1px solid rgba(74,222,128,0.08)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <KartaLogo size={16} />
                  <span style={{fontWeight:700,fontSize:12,color:"#f0fdf4"}}>My Portfolio</span>
                  <span style={{fontSize:11,color:"#4ade80",fontWeight:700}}>▲ 1.24%</span>
                </div>
                <div style={{display:"flex",gap:4}}>
                  {["Heatmap","Watchlist","Corr"].map((t,i)=>(
                    <div key={t} style={{padding:"2px 8px",borderRadius:4,fontSize:10,color:i===0?"#4ade80":"rgba(255,255,255,0.35)",background:i===0?"rgba(74,222,128,0.12)":"transparent",border:`1px solid ${i===0?"rgba(74,222,128,0.3)":"rgba(255,255,255,0.08)"}`}}>{t}</div>
                  ))}
                </div>
              </div>
              <div style={{height:220}}><DemoHeatmap /></div>
            </div>
            <p style={{fontSize:11,color:"rgba(240,253,244,0.3)",marginTop:12,textAlign:"center",fontFamily:"'JetBrains Mono',monospace"}}>↑ live demo — values drift in real time</p>
          </div>
        )}

        {/* Mobile demo */}
        {isMobile && (
          <div style={{marginTop:32,background:"rgba(10,20,10,0.95)",border:"1px solid rgba(74,222,128,0.15)",borderRadius:16,overflow:"hidden"}}>
            <div style={{padding:"8px 12px",borderBottom:"1px solid rgba(74,222,128,0.1)",display:"flex",gap:6}}>{["#f87171","#fbbf24","#4ade80"].map(c=><div key={c} style={{width:9,height:9,borderRadius:"50%",background:c,opacity:0.7}} />)}</div>
            <div style={{height:180}}><DemoHeatmap /></div>
          </div>
        )}
      </section>

      {/* ── Ticker tape ── */}
      <div style={{position:"relative",zIndex:1}}>
        <TickerTape S={S} />
      </div>

      {/* ── Tools showcase ── */}
      <section ref={el=>revealRefs.current[0]=el} style={{position:"relative",zIndex:1,padding:isMobile?"48px 0":"80px 0",opacity:revealed[0]?1:0,transform:revealed[0]?"none":"translateY(28px)",transition:"opacity 0.7s ease, transform 0.7s ease"}}>
        <div style={{maxWidth:1200,margin:"0 auto",padding:"0 24px"}}>
          <div style={{marginBottom:40}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",color:"rgba(74,222,128,0.7)",fontFamily:"'JetBrains Mono',monospace",marginBottom:14}}>THE PLATFORM</div>
            <h2 style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:"clamp(28px,4vw,48px)",fontWeight:400,letterSpacing:"-0.03em",color:"#f0fdf4",margin:0}}>
              Every tool an investor needs.<br /><em style={{color:"rgba(240,253,244,0.5)"}}>All in one place.</em>
            </h2>
          </div>
          <div style={{display:"flex",gap:14,overflowX:"auto",paddingBottom:16,scrollbarWidth:"none"}}>
            {[
              {icon:"🟩",name:"Portfolio Heatmap",desc:"Color-coded tiles by position value. Spot winners and losers at a glance.",accent:"#4ade80"},
              {icon:"👁",name:"Watchlists",desc:"Track tickers you don't own yet. Full heatmap, correlations, and news.",accent:"#22d3ee"},
              {icon:"🔗",name:"Correlation Matrix",desc:"See which holdings move together. Cluster detection for real diversification insight.",accent:"#a78bfa"},
              {icon:"📈",name:"Portfolio History",desc:"Daily snapshots of your total portfolio value over time.",accent:"#fbbf24"},
              {icon:"📋",name:"Holdings Table",desc:"Sortable table: price, day %, YTD, 1Y, position weight.",accent:"#f87171"},
              {icon:"🔮",name:"Coming Soon",desc:"Options exposure, sector heatmaps, risk metrics — all local, always.",accent:"rgba(255,255,255,0.3)"},
            ].map(tool=>(
              <ToolStrip key={tool.name} {...tool} S={S} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Air-gap section ── */}
      <section ref={el=>revealRefs.current[1]=el} style={{position:"relative",zIndex:1,padding:isMobile?"48px 16px":"80px 24px",maxWidth:1100,margin:"0 auto",opacity:revealed[1]?1:0,transform:revealed[1]?"none":"translateY(28px)",transition:"opacity 0.7s ease, transform 0.7s ease"}}>
        <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(74,222,128,0.12)",borderRadius:24,padding:isMobile?"28px 20px":"56px",display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:48,alignItems:"center"}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",color:"#4ade80",fontFamily:"'JetBrains Mono',monospace",marginBottom:16}}>STRUCTURAL PRIVACY</div>
            <h2 style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:"clamp(26px,3.5vw,42px)",fontWeight:400,letterSpacing:"-0.03em",color:"#f0fdf4",lineHeight:1.15,margin:"0 0 20px"}}>
              Air-gapped by architecture,<br /><em>not just policy.</em>
            </h2>
            <p style={{color:"rgba(240,253,244,0.55)",fontSize:14,lineHeight:1.8,marginBottom:28}}>
              Most "privacy-first" apps mean "we pinky-promise not to sell your data." Karta means there is no server-side component that could receive your holdings even if it wanted to. Your portfolio data lives in browser localStorage — period.
            </p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[
                {icon:"💾",label:"localStorage only"},
                {icon:"🚫",label:"No account required"},
                {icon:"📡",label:"Browser → Finnhub direct"},
                {icon:"🔍",label:"Fully auditable"},
              ].map(item=>(
                <div key={item.label} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:9,background:"rgba(74,222,128,0.06)",border:"1px solid rgba(74,222,128,0.1)"}}>
                  <span style={{fontSize:16}}>{item.icon}</span>
                  <span style={{fontSize:12,color:"rgba(240,253,244,0.7)",fontWeight:600}}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Architecture diagram */}
          <div style={{display:"flex",flexDirection:"column",gap:0,alignItems:"center"}}>
            {[
              {label:"Your Browser",icon:"🌐",sub:"localStorage: your tickers, shares, API key",color:"rgba(74,222,128,0.12)",border:"rgba(74,222,128,0.3)",textColor:"#4ade80"},
              null,
              {label:"Finnhub API",icon:"📡",sub:"receives only: ticker symbol",color:"rgba(59,130,246,0.1)",border:"rgba(59,130,246,0.3)",textColor:"#60a5fa"},
              null,
              {label:"Karta Servers",icon:"🚫",sub:"not in the loop — never receives your data",color:"rgba(248,113,113,0.06)",border:"rgba(248,113,113,0.2)",textColor:"#f87171"},
            ].map((row,i)=>{
              if(!row) return (
                <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"6px 0"}}>
                  <div style={{width:1,height:12,background:"rgba(255,255,255,0.15)"}} />
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"'JetBrains Mono',monospace",padding:"2px 0"}}>{i===1?"prices only →":""}</div>
                  <div style={{width:1,height:12,background:"rgba(255,255,255,0.15)"}} />
                </div>
              );
              return (
                <div key={i} style={{width:"100%",background:row.color,border:`1px solid ${row.border}`,borderRadius:12,padding:"14px 18px",display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:20}}>{row.icon}</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:row.textColor,marginBottom:2}}>{row.label}</div>
                    <div style={{fontSize:11,color:"rgba(240,253,244,0.4)",fontFamily:"'JetBrains Mono',monospace"}}>{row.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section ref={el=>revealRefs.current[2]=el} style={{position:"relative",zIndex:1,padding:isMobile?"48px 16px":"80px 24px",maxWidth:700,margin:"0 auto",opacity:revealed[2]?1:0,transform:revealed[2]?"none":"translateY(28px)",transition:"opacity 0.7s ease, transform 0.7s ease"}}>
        <div style={{textAlign:"center",marginBottom:48}}>
          <h2 style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:"clamp(28px,4vw,46px)",fontWeight:400,letterSpacing:"-0.03em",color:"#f0fdf4",margin:0}}>
            Ready in<br /><em style={{color:"#4ade80"}}>under a minute.</em>
          </h2>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:0}}>
          {[
            {n:"01",title:"Grab a free API key",desc:"finnhub.io — no credit card, 60 req/min, handles any portfolio size."},
            {n:"02",title:"Add your holdings",desc:"Type tickers + shares, or bulk-paste from Excel/Google Sheets."},
            {n:"03",title:"Explore the platform",desc:"Heatmap fires up first. Then dive into watchlists, correlations, history."},
          ].map((step,i)=>(
            <div key={step.n} style={{display:"flex",gap:20,alignItems:"flex-start",paddingBottom:32,borderLeft:"1px solid rgba(74,222,128,0.15)",marginLeft:16,paddingLeft:28,position:"relative"}}>
              <div style={{position:"absolute",left:-14,top:0,width:28,height:28,borderRadius:"50%",background:"rgba(74,222,128,0.12)",border:"1px solid rgba(74,222,128,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:"#4ade80"}}>{step.n}</div>
              <div>
                <div style={{fontWeight:700,fontSize:15,color:"#f0fdf4",marginBottom:5}}>{step.title}</div>
                <div style={{fontSize:13,color:"rgba(240,253,244,0.5)",lineHeight:1.7}}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section ref={el=>revealRefs.current[3]=el} style={{position:"relative",zIndex:1,padding:isMobile?"48px 16px":"80px 24px",maxWidth:900,margin:"0 auto",opacity:revealed[3]?1:0,transform:revealed[3]?"none":"translateY(28px)",transition:"opacity 0.7s ease, transform 0.7s ease"}}>
        <div style={{position:"relative",borderRadius:24,overflow:"hidden",padding:isMobile?"40px 24px":"64px 56px",textAlign:"center",background:"linear-gradient(135deg,rgba(74,222,128,0.07),rgba(34,211,238,0.04))",border:"1px solid rgba(74,222,128,0.15)"}}>
          <div style={{position:"absolute",top:"-30%",left:"50%",transform:"translateX(-50%)",width:"60%",height:"60%",background:"radial-gradient(ellipse,rgba(74,222,128,0.12) 0%,transparent 70%)",pointerEvents:"none"}} />
          <div style={{display:"flex",justifyContent:"center",marginBottom:24}}><KartaLogo size={52} /></div>
          <h2 style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:"clamp(28px,4vw,48px)",fontWeight:400,letterSpacing:"-0.03em",color:"#f0fdf4",margin:"0 0 16px"}}>
            Your private finance platform.<br /><em style={{color:"rgba(240,253,244,0.5)"}}>Start today.</em>
          </h2>
          <p style={{color:"rgba(240,253,244,0.5)",fontSize:15,maxWidth:420,margin:"0 auto 40px",lineHeight:1.7}}>No account. No data leaving your browser.<br />Just a better way to understand your investments.</p>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
            <a href="/app" style={{padding:"15px 36px",borderRadius:10,background:"linear-gradient(135deg,#4ade80,#16a34a)",color:"#051a0a",fontSize:15,fontWeight:800,textDecoration:"none",boxShadow:"0 0 48px rgba(74,222,128,0.25)",transition:"transform 0.2s,box-shadow 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 56px rgba(74,222,128,0.4)";}} onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 0 48px rgba(74,222,128,0.25)";}}>Open Karta →</a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{position:"relative",zIndex:1,borderTop:"1px solid rgba(74,222,128,0.08)",padding:isMobile?"20px 16px":"24px 32px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <KartaLogo size={22} />
          <span style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:15,color:"rgba(240,253,244,0.8)"}}>Karta</span>
          <span style={{color:"rgba(240,253,244,0.3)",fontSize:12}}>— private finance platform</span>
        </div>
        <div style={{display:"flex",gap:16,alignItems:"center"}}>
          {isMobile && ThemePicker}
          {[["Finnhub","https://finnhub.io"],["Coffee","https://buymeacoffee.com/karta"]].map(([label,href])=>(
            <a key={label} href={href} target="_blank" rel="noreferrer" style={{fontSize:12,color:"rgba(240,253,244,0.3)",textDecoration:"none",transition:"color 0.2s"}} onMouseEnter={e=>e.currentTarget.style.color="rgba(240,253,244,0.8)"} onMouseLeave={e=>e.currentTarget.style.color="rgba(240,253,244,0.3)"}>{label}</a>
          ))}
        </div>
      </footer>

      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:#060d06!important;}
        ::selection{background:rgba(74,222,128,0.25);}

        .v3-grad-1{position:absolute;top:-20%;left:-10%;width:60vw;height:60vh;background:radial-gradient(ellipse,rgba(74,222,128,0.06) 0%,transparent 65%);animation:v3Drift1 18s ease-in-out infinite alternate;}
        .v3-grad-2{position:absolute;top:10%;right:-10%;width:50vw;height:50vh;background:radial-gradient(ellipse,rgba(34,211,238,0.04) 0%,transparent 65%);animation:v3Drift2 22s ease-in-out infinite alternate;}
        .v3-grad-3{position:absolute;bottom:-10%;left:30%;width:40vw;height:40vh;background:radial-gradient(ellipse,rgba(167,139,250,0.04) 0%,transparent 65%);animation:v3Drift3 26s ease-in-out infinite alternate;}
        @keyframes v3Drift1{0%{transform:translate(0,0);}100%{transform:translate(5vw,3vh);}}
        @keyframes v3Drift2{0%{transform:translate(0,0);}100%{transform:translate(-4vw,5vh);}}
        @keyframes v3Drift3{0%{transform:translate(0,0);}100%{transform:translate(3vw,-4vh);}}

        .v3-ticker-wrap{overflow:hidden;width:100%;mask-image:linear-gradient(to right,transparent 0%,black 6%,black 94%,transparent 100%);-webkit-mask-image:linear-gradient(to right,transparent 0%,black 6%,black 94%,transparent 100%);border-top:1px solid rgba(74,222,128,0.08);border-bottom:1px solid rgba(74,222,128,0.08);padding:8px 0;background:rgba(6,13,6,0.8);}
        .v3-ticker-track{display:inline-flex;align-items:center;animation:v3TickerScroll 28s linear infinite;will-change:transform;white-space:nowrap;}
        @keyframes v3TickerScroll{0%{transform:translateX(0);}100%{transform:translateX(-50%);}}

        .v3-tool-scroll{scrollbar-width:none;}
        .v3-tool-scroll::-webkit-scrollbar{display:none;}
      `}</style>
    </div>
  );
}
