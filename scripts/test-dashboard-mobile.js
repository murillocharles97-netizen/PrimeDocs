const fs = require("fs");
const vm = require("vm");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname,"..","js","dashboard-mobile.js"),"utf8");
const css = fs.readFileSync(path.join(__dirname,"..","css","dashboard-mobile.css"),"utf8");
const index = fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const sw = fs.readFileSync(path.join(__dirname,"..","service-worker.js"),"utf8");
let desktopCalls = 0;
const sandbox = {
    console,
    setTimeout: fn => fn(),
    clearTimeout(){},
    window: null,
    localStorage:{ getItem(){return null}, setItem(){} },
    document:{ getElementById(){return null}, querySelector(){return null}, querySelectorAll(){return []} },
    Utils:{ moeda:value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}) },
    DashboardPremium:{ render(){ desktopCalls++ } },
    Modal:{ abrir(){}, fechar(){} },
    Toast:{ show(){} }
};
sandbox.window = sandbox;
sandbox.window.innerWidth = 1200;
sandbox.window.matchMedia = () => ({ matches:false });
sandbox.window.addEventListener = () => {};
vm.createContext(sandbox);
vm.runInContext(source,sandbox);

let passed=0;
function test(name,fn){ try { fn(); passed++; console.log(`✓ ${name}`); } catch(error) { console.error(`✗ ${name}: ${error.message}`); process.exitCode=1; } }
function ok(value,message="condição não atendida"){ if(!value) throw new Error(message); }
const performance = sandbox.DashboardMobile.calcularPerformanceMensal;
const interval = { inicio:new Date(2026,6,1).getTime(), fim:new Date(2026,6,31,23,59,59,999).getTime() };
const calculate = (current,target,day=17) => performance({valorAtual:current,valorMeta:target,intervalo:interval,agora:new Date(2026,6,day,12)});

test("1. desktop continua usando o renderizador aprovado",()=>{sandbox.DashboardMobile.render();ok(desktopCalls===1)});
test("2. meta ausente não divide por zero",()=>{const p=calculate(100,0);ok(!p.disponivel&&Number.isFinite(p.mediaDiariaAtual)&&p.mensagemPrincipal.includes("não configurada"))});
test("3. percentual e média diária necessária estão corretos",()=>{const p=calculate(2198,5000);ok(Math.abs(p.percentualMeta-43.96)<.01);ok(Math.abs(p.mediaDiariaNecessaria-200.142857)<.01)});
test("4. dias restantes não incluem o dia atual",()=>ok(calculate(2198,5000).diasRestantes===14));
test("5. desempenho muito acima é classificado",()=>ok(calculate(4000,5000).classificacao==="muito_acima"));
test("6. desempenho um pouco abaixo é classificado",()=>ok(calculate(2500,5000).classificacao==="pouco_abaixo"));
test("7. desempenho muito abaixo é classificado",()=>ok(calculate(1000,5000).classificacao==="muito_abaixo"));
test("8. meta atingida zera a média necessária",()=>{const p=calculate(5000,5000);ok(p.classificacao==="atingida"&&p.mediaDiariaNecessaria===0)});
test("9. meta superada informa excedente",()=>{const p=calculate(6000,5000);ok(p.classificacao==="superada"&&p.mensagemPrincipal==="Meta superada")});
test("10. último dia permanece finito",()=>{const p=calculate(3000,5000,31);ok(p.diasRestantes===0&&Number.isFinite(p.mediaDiariaNecessaria)&&Number.isFinite(p.projecaoFechamento))});
test("11. arquitetura mobile possui render próprio",()=>ok(source.includes("function renderMobile()")&&source.includes("function buildData()")&&source.includes("desktopRender?.()")));
test("12. mobile não renderiza blocos operacionais",()=>ok(!source.includes("Produção agora")&&!source.includes("Ações rápidas")&&!source.includes("fila de produção")));
test("13. período oferece seis opções",()=>ok(["Hoje","Esta semana","Este mês","Mês anterior","Ano atual","Período personalizado"].every(label=>source.includes(label))));
test("14. rankings usam scroll-snap e largura de 86%",()=>ok(css.includes("scroll-snap-type: x mandatory")&&css.includes("flex: 0 0 86%")));
test("15. larguras compactas são cobertas sem mínimo artificial",()=>ok(css.includes("max-width: 335px")&&css.includes("max-width: 389px")&&css.includes("max-width: 767px")&&!css.includes("min-width: 430px")));
test("16. conteúdo respeita navegação e safe-area",()=>ok(css.includes("calc(104px + env(safe-area-inset-bottom))")));
test("17. tema escuro mobile é isolado",()=>ok(css.includes('html[data-theme="dark"] .mobilePerformanceCard')));
test("18. redução de movimento é respeitada",()=>ok(css.includes("prefers-reduced-motion: reduce")));
test("19. arquivos carregam depois do Dashboard desktop e antes do app",()=>ok(index.indexOf("dashboard-mobile.js")>index.indexOf("dashboard-premium.js")&&index.indexOf("dashboard-mobile.js")<index.indexOf("js/app.js")));
test("20. PWA mantém Dashboard mobile offline",()=>ok(sw.includes("primedocs-v58")&&sw.includes("dashboard-mobile.css")&&sw.includes("dashboard-mobile.js")));
test("21. CSS do desktop premium não foi modificado por esta camada",()=>ok(!css.includes(".premiumDashboard")&&!css.includes(".executiveDashboardHeader")));
test("22. cards clicáveis têm área mínima de toque",()=>ok(css.includes(".mobileDashboard button { min-height: 44px; }")));
test("23. estados loading, vazio e erro estão presentes",()=>ok(source.includes("renderSkeleton")&&source.includes("Não foi possível carregar o Dashboard")&&source.includes("Nenhuma venda em consignado")));

if(!process.exitCode) console.log(`\n${passed} verificações do Dashboard Mobile aprovadas.`);
