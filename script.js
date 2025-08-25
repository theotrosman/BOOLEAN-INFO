let currentExpr=""

document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".toolbar button[data-insert]").forEach(b=>{
    b.addEventListener("click",()=>{
      currentExpr+=b.getAttribute("data-insert")
      document.getElementById("expression").innerText=currentExpr
    })
  })
  document.getElementById("clearBtn").addEventListener("click",clearExpr)
  document.getElementById("btnTable").addEventListener("click",renderTruthTable)
  document.getElementById("btnSimplify").addEventListener("click",runSimplify)
})

function clearExpr(){
  currentExpr=""
  document.getElementById("expression").innerText=""
  document.getElementById("table-container").innerHTML=""
  document.getElementById("steps").innerHTML=""
}

function normalize(expr){
  return expr
    .replace(/¬/g," NOT ")
    .replace(/∧/g," AND ")
    .replace(/∨/g," OR ")
    .replace(/⊕/g," XOR ")
    .replace(/⊼/g," NAND ")
    .replace(/⊽/g," NOR ")
    .replace(/≡/g," XNOR ")
    .replace(/→/g," IMPLICA ")
    .replace(/↔/g," EQUIV ")
    .replace(/\s+/g," ")
    .trim()
    .toUpperCase()
}

function tokenize(expr){
  const t=[]
  const re=/\s*(AND|OR|NOT|XOR|NAND|NOR|XNOR|IMPLICA|EQUIV|[A-Z]|\(|\))\s*/g
  let m
  while((m=re.exec(expr))!==null)t.push(m[1])
  return t
}

function toRPN(tokens){
  const prec={NOT:5,AND:4,NAND:4,XOR:3,XNOR:3,OR:2,NOR:2,IMPLICA:1,EQUIV:1}
  const rightAssoc={NOT:true}
  const out=[],op=[]
  for(const tok of tokens){
    if(/^[A-Z]$/.test(tok)){out.push(tok);continue}
    if(tok==="("){op.push(tok);continue}
    if(tok===")"){
      while(op.length&&op[op.length-1]!=="(")out.push(op.pop())
      op.pop()
      continue
    }
    while(op.length){
      const top=op[op.length-1]
      if(top==="(")break
      const p1=prec[tok]||0
      const p2=prec[top]||0
      if((!rightAssoc[tok]&&p1<=p2)||(rightAssoc[tok]&&p1<p2))out.push(op.pop());else break
    }
    op.push(tok)
  }
  while(op.length)out.push(op.pop())
  return out
}

function evalRPN(rpn,env){
  const s=[]
  for(const tok of rpn){
    if(/^[A-Z]$/.test(tok)){s.push(!!env[tok]);continue}
    if(tok==="NOT"){const a=s.pop();s.push(!a);continue}
    const b=s.pop(),a=s.pop()
    if(tok==="AND")s.push(a&&b)
    else if(tok==="OR")s.push(a||b)
    else if(tok==="XOR")s.push(!!(a^b))
    else if(tok==="NAND")s.push(!(a&&b))
    else if(tok==="NOR")s.push(!(a||b))
    else if(tok==="XNOR")s.push(a===b)
    else if(tok==="IMPLICA")s.push((!a)||b)
    else if(tok==="EQUIV")s.push(a===b)
  }
  return s.pop()?1:0
}

function getVars(expr){
  return Array.from(new Set((expr.match(/[A-D]/gi)||[]))).sort()
}

function renderTruthTable(){
  const raw=currentExpr.trim()
  if(!raw){alert("No hay expresión");return}
  const norm=normalize(raw)
  const tokens=tokenize(norm)
  const rpn=toRPN(tokens)
  const vars=getVars(norm)
  if(vars.length===0){alert("Agregá variables");return}
  const rows=1<<vars.length
  let html="<table><thead><tr>"+vars.map(v=>`<th>${v}</th>`).join("")+`<th>${raw}</th></tr></thead><tbody>`
  for(let i=0;i<rows;i++){
    const env={}
    for(let j=0;j<vars.length;j++)env[vars[j]]=((i>>(vars.length-j-1))&1)===1
    const res=evalRPN(rpn,env)
    html+="<tr>"+vars.map(v=>`<td>${env[v]?1:0}</td>`).join("")+`<td class="${res? "true":"false"}">${res}</td></tr>`
  }
  html+="</tbody></table>"
  document.getElementById("table-container").innerHTML=html
}

function runSimplify(){
  const raw=currentExpr.trim()
  if(!raw){alert("No hay expresión");return}
  const steps=[]
  const norm=normalize(raw)
  const tokens=tokenize(norm)
  const rpn=toRPN(tokens)
  const vars=getVars(norm)
  if(vars.length===0){alert("Agregá variables");return}
  const minterms=[]
  const rows=1<<vars.length
  for(let i=0;i<rows;i++){
    const env={}
    for(let j=0;j<vars.length;j++)env[vars[j]]=((i>>(vars.length-j-1))&1)===1
    const res=evalRPN(rpn,env)
    if(res===1)minterms.push(i)
  }
  if(minterms.length===0){renderSteps([{title:"Resultado",method:"Constante 0",detail:"La función nunca vale 1."}]);return}
  if(minterms.length===rows){renderSteps([{title:"Resultado",method:"Constante 1",detail:"La función siempre vale 1."}]);return}

  steps.push({
    title:"Mínterms detectados",
    method:"Tabla de verdad",
    detail:`Variables: ${vars.join(", ")} · Mínterms: { ${minterms.join(", ")} }`
  })

  const qm=quineMcCluskeyPretty(minterms,vars.length,vars)
  steps.push(...qm.prettySteps)
  steps.push({title:"Resultado mínimo",method:"Cobertura mínima",detail:formatCoverPretty(qm.cover,vars)})

  renderSteps(steps)
}

function renderSteps(items){
  const box=document.getElementById("steps")
  box.innerHTML=items.map(s=>`
    <div class="step">
      <div class="tag">${s.title}</div>
      <div class="tag" style="background:#1b3a26;border-color:#284f36;color:#9be59f">${s.method}</div>
      <div style="margin-top:6px">${s.detail}</div>
    </div>
  `).join("")
}

function bin(n,w){let s=n.toString(2);while(s.length<w)s="0"+s;return s}

function combine(a,b){
  let diff=0,pos=-1
  for(let i=0;i<a.length;i++){
    if(a[i]!==b[i]){
      if(a[i]!=="-"&&b[i]!=="-"){diff++;pos=i}
    }
  }
  if(diff===1){let r=a.split("");r[pos]="-";return r.join("")}
  return null
}

function covers(pattern,m,varsCount){
  const b=bin(m,varsCount)
  for(let i=0;i<pattern.length;i++){if(pattern[i]==="-")continue;if(pattern[i]!==b[i])return false}
  return true
}

function termFromPattern(pat,vars){
  const out=[]
  for(let i=0;i<pat.length;i++){
    if(pat[i]==="1")out.push(vars[i])
    else if(pat[i]==="0")out.push("¬"+vars[i])
  }
  return out.length?out.join(" ∧ "):"1"
}

function formatCoverPretty(implicants,vars){
  if(!implicants.length)return "0"
  return implicants.map(p=>termFromPattern(p.pat,vars)).join(" ∨ ")
}

function groupSummary(groups){
  return Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.map(o=>o.pat)]))
}

function uniquePatterns(arr){
  const seen=new Set(),out=[]
  for(const p of arr){if(!seen.has(p.pat)){seen.add(p.pat);out.push(p)}}
  return out
}

function quineMcCluskeyPretty(minterms,varsCount,vars){
  let steps=[]
  let groups={}
  for(const m of minterms){
    const bits=bin(m,varsCount)
    const ones=(bits.match(/1/g)||[]).length
    if(!groups[ones])groups[ones]=[]
    groups[ones].push({pat:bits,set:new Set([m]),used:false})
  }
  steps.push({title:"Agrupación inicial",method:"Quine–McCluskey",detail:`
    Por número de 1s: <code>${JSON.stringify(groupSummary(groups))}</code>
  `})

  let allPrimes=[]
  while(true){
    const keys=Object.keys(groups).map(Number).sort((a,b)=>a-b)
    const next={}
    let any=false
    let prettyComb=[]
    for(let i=0;i<keys.length-1;i++){
      for(const a of groups[keys[i]]){
        for(const b of groups[keys[i+1]]){
          const c=combine(a.pat,b.pat)
          if(c){
            any=true
            a.used=true;b.used=true
            const ones=(c.match(/1/g)||[]).length
            if(!next[ones])next[ones]=[]
            const existing=next[ones].find(x=>x.pat===c)
            if(existing){for(const x of b.set)existing.set.add(x);for(const x of a.set)existing.set.add(x)}
            else{const s=new Set([...a.set,...b.set]);next[ones].push({pat:c,set:s,used:false})}
            prettyComb.push(`${a.pat} + ${b.pat} → <b>${c}</b> (${termFromPattern(c,vars)})`)
          }
        }
      }
    }
    const primes=[]
    for(const k of keys){for(const g of groups[k]){if(!g.used)primes.push(g)}}
    if(primes.length)allPrimes.push(...primes)
    steps.push({
      title:any?"Combinación por adyacencia":"Sin más combinaciones",
      method:"QM – Paso de combinación",
      detail: any? prettyComb.map(x=>`<div>${x}</div>`).join(""):"No se pueden combinar más términos."
    })
    if(!any)break
    groups=next
  }

  const primeImplicants=uniquePatterns(allPrimes)
  steps.push({
    title:"Implicantes primos",
    method:"QM – Implicantes",
    detail: primeImplicants.map(p=>`<div><code>${p.pat}</code> → {${[...p.set].join(", ")}} · ${termFromPattern(p.pat,vars)}</div>`).join("")
  })

  const chart={}
  for(const m of minterms){chart[m]=[];for(const p of primeImplicants){if(covers(p.pat,m,varsCount))chart[m].push(p)}}
  const cover=new Set()
  const covered=new Set()
  for(const m of minterms){if(chart[m].length===1){cover.add(chart[m][0])}}
  if(cover.size){
    const picked=[...cover]
    steps.push({
      title:"Selección de esenciales",
      method:"QM – Esenciales",
      detail:picked.map(p=>`<div><code>${p.pat}</code> · ${termFromPattern(p.pat,vars)}</div>`).join("")
    })
    for(const p of picked){for(const mm of p.set)covered.add(mm)}
  }else{
    steps.push({title:"Selección de esenciales",method:"QM – Esenciales",detail:"No hay implicantes esenciales."})
  }

  const remaining=minterms.filter(m=>!covered.has(m))
  if(remaining.length){
    const options=remaining.map(m=>new Set(chart[m].map(p=>p)))
    const chosen=petrick(options,steps,vars)
    for(const p of chosen)cover.add(p)
  }else{
    steps.push({title:"Cobertura",method:"QM – Cobertura",detail:"Todos los mínterms quedaron cubiertos por los esenciales."})
  }
  return {cover:[...cover],prettySteps:steps}
}

function isSubset(a,b){
  for(const x of a){if(!b.has(x))return false}
  return true
}

function scoreTerm(set){
  let lits=0
  for(const p of set)lits+=p.pat.replace(/-/g,"").length
  return lits*10+set.size
}

function petrick(sets,steps,vars){
  let prod=[new Set()]
  for(const s of sets){
    const next=[]
    for(const term of prod){
      for(const opt of s){
        const u=new Set(term);u.add(opt);next.push(u)
      }
    }
    prod=next
  }
  let reduced=[]
  for(const t of prod){
    let skip=false
    for(const u of prod){if(t!==u&&isSubset(t,u)){skip=true;break}}
    if(!skip)reduced.push(t)
  }
  const scored=reduced.map(t=>({t,score:scoreTerm(t)})).sort((a,b)=>a.score-b.score)
  const bestScore=scored[0].score
  const best=scored.filter(x=>x.score===bestScore).map(x=>x.t)
  steps.push({
    title:"Selección adicional",
    method:"Método de Petrick",
    detail: best.map(s=>`<div>{ ${[...s].map(p=>`<code>${p.pat}</code> · ${termFromPattern(p.pat,vars)}`).join(" , ")} }</div>`).join("")
  })
  const chosen=new Set()
  for(const t of best){for(const p of t)chosen.add(p)}
  return chosen
}
