import{htmlToDocx as u,bookToXlsx as D,slidesToPptx as S,textPdf as A}from"./office-fEB3mEqN.js";import{r as B}from"./index-CEW0Hedf.js";const P=c=>`https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${c}.mp3`,w="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/",E=`Bienvenido a Sotos OS
=====================

Sotos es un ordenador completo que vive en tu navegador.
Todo lo que guardas aquí se queda en este navegador (IndexedDB)
y, cuando inicies sesión, se sincronizará con tu cuenta.

Algunas cosas que puedes probar:

  • Arrastra archivos desde tu PC a la ventana de Archivos o al escritorio.
  • Abre "Presupuesto marketing.xlsx": las fórmulas se recalculan solas.
  • Edita "Plan de negocio.docx" y descárgalo: es un Word de verdad.
  • En la Terminal escribe:  help
  • Ctrl+C / Ctrl+X / Ctrl+V, Supr y F2 funcionan en Archivos.
  • Clic derecho sobre una imagen → "Usar como fondo".

Sotos OS · © 2026 Sebastian Sotomontes
`,T=`# Roadmap de Sotos OS

- [x] Escritorio, ventanas, dock y widgets
- [x] Sistema de archivos real (IndexedDB)
- [x] Word, Excel y PowerPoint reales
- [x] Navegador con proxy propio
- [ ] Cuentas y sincronización en la nube
- [ ] Compartir con enlaces
- [ ] Mensajes en tiempo real
`,k=`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Mi web en Sotos</title>
  <link rel="stylesheet" href="estilos.css">
</head>
<body>
  <main>
    <h1>Hola desde Sotos 👋</h1>
    <p>Edita este archivo con Notas y pulsa <b>Vista previa</b>.</p>
    <button id="btn">Contar clics</button> <span id="n">0</span>
  </main>
  <script>
    let n = 0;
    document.getElementById("btn").onclick = () => document.getElementById("n").textContent = ++n;
  <\/script>
</body>
</html>
`,j=`body { font-family: system-ui, sans-serif; background: #f4f5f7; color: #1b1f24; }
main { max-width: 560px; margin: 60px auto; background: #fff; padding: 32px; border-radius: 12px; }
h1 { margin-top: 0; }
button { font: inherit; padding: 8px 14px; border-radius: 8px; border: 1px solid #ccd; cursor: pointer; }
`,O=`<h1>Plan de negocio</h1>
<p><i>Borrador · ${new Date().toLocaleDateString("es-ES",{month:"long",year:"numeric"})}</i></p>
<h2>1. Resumen</h2>
<p>Sotos ofrece un escritorio completo en el navegador: archivos, documentos, hojas de cálculo, presentaciones y comunicación en un solo lugar, sin instalar nada.</p>
<h2>2. Problema</h2>
<ul><li>Las herramientas de trabajo están dispersas en decenas de pestañas.</li><li>Los equipos pierden tiempo buscando archivos.</li><li>Los equipos compartidos o antiguos no pueden instalar software.</li></ul>
<h2>3. Propuesta</h2>
<p>Un único espacio de trabajo que sigue al usuario en cualquier dispositivo, con formatos estándar (<b>.docx</b>, <b>.xlsx</b>, <b>.pptx</b>) para no encerrar sus datos.</p>
<h2>4. Próximos pasos</h2>
<ol><li>Lanzar la beta pública.</li><li>Abrir cuentas y sincronización.</li><li>Medir uso y retención.</li></ol>`,I=`<h1>Acuerdo de colaboración</h1>
<p>Este acuerdo se establece entre las partes abajo firmantes con el objeto de regular la colaboración descrita en las siguientes cláusulas.</p>
<h2>I. Objeto</h2><p>Las partes colaborarán en el desarrollo y la difusión del proyecto, aportando cada una los recursos indicados en el anexo.</p>
<h2>II. Duración</h2><p>El acuerdo tendrá una vigencia de doce (12) meses desde su firma, prorrogables de mutuo acuerdo.</p>
<h2>III. Obligaciones</h2><ul><li>Mantener la confidencialidad de la información compartida.</li><li>Colaborar de buena fe en los objetivos comunes.</li><li>Revisar y aprobar los entregables en los plazos acordados.</li></ul>
<h2>IV. Disposiciones finales</h2><p>Cualquier modificación deberá constar por escrito y ser firmada por ambas partes.</p>`,R={sheets:[{name:"Presupuesto",cells:{A1:"Presupuesto de marketing",A3:"Categoría",B3:"Cantidad",C3:"Coste/ud.",D3:"Subtotal",A5:"Honorarios",B5:"2",C5:"2300",D5:"=B5*C5",A6:"Investigación web",B6:"1",C6:"1100",D6:"=B6*C6",A7:"Externa",B7:"3",C7:"300",D7:"=B7*C7",A9:"Total investigación",D9:"=SUM(D5:D7)",A11:"Comunicación",A12:"Folletos",B12:"5000",C12:"0.15",D12:"=B12*C12",A13:"Televisión",B13:"5",C13:"4000",D13:"=B13*C13",A15:"Total general",D15:"=D9+D12+D13",A17:"Promedio por partida",D17:"=ROUND(AVERAGE(D5:D7,D12:D13),2)"},fmt:{A1:{b:!0},A3:{b:!0},B3:{b:!0},C3:{b:!0},D3:{b:!0},A9:{b:!0},D9:{b:!0},A15:{b:!0},D15:{b:!0}},widths:{A:170}}]},q=`Fecha,Concepto,Importe
2026-05-04,Vuelo Bogotá - Medellín,320000
2026-05-04,Hotel (2 noches),410000
2026-05-05,Taxis,58000
2026-05-06,Comidas,126000
`,L=[{bg:"linear-gradient(135deg,#2b3a8c,#5b3a9e)",title:"Tendencias de marca 2026",sub:"Estrategia y dirección creativa",kicker:"SOTOS · EQUIPO PRODUCTO"},{bg:"#ffffff",dark:!0,title:"El reto",bullets:["Saturación visual en el sector","Audiencias más jóvenes y digitales","Necesidad de una identidad coherente"]},{bg:"#ffffff",dark:!0,title:"Tres pilares",bullets:["Claridad — menos es más","Calidez — humano y cercano","Movimiento — vivo y dinámico"]},{bg:"linear-gradient(135deg,#0f7f6b,#2bd4c4)",title:"Próximos pasos",sub:"Roadmap del trimestre",kicker:"Q3 2026"}];async function F({put:c,newId:l,typeOf:p}){const i=Date.now(),r=(a,e=[],t=l())=>({id:t,name:a,type:"folder",children:e,ctime:i,mtime:i}),o=async(a,e,t={})=>{const n=l();return e&&await c(n,e),{id:n,name:a,type:p(a),size:e?e.size:0,ctime:i,mtime:i,...t}},s=(a,e="text/plain")=>new Blob([a],{type:e}),d=[["Páramo.jpg","paramo"],["Cerros.jpg","cerros"],["Cafetal.jpg","cafetal"],["Caño.jpg","cano"],["Tatacoa.jpg","tatacoa"],["Caribe.jpg","caribe"]],m=()=>Promise.all(d.map(([,a])=>new Promise(e=>B(a,1600,1e3).toBlob(e,"image/jpeg",.88)))),[b,g,h,f,x]=await Promise.all([u(O,"Plan de negocio"),u(I,"Acuerdo de colaboración"),D(R),S(L,"Tendencias de marca"),m()]),v=A("Guía rápida de Sotos OS",["Sotos OS es un escritorio completo que funciona dentro del navegador. Tus archivos se guardan en este dispositivo y se sincronizarán con tu cuenta cuando inicies sesión.","Archivos: arrastra documentos desde tu PC, crea carpetas, usa Ctrl+C, Ctrl+X y Ctrl+V para copiar y mover, Supr para enviar a la papelera y F2 para renombrar.","Documentos, Hojas y Presentaciones abren y guardan archivos .docx, .xlsx y .pptx reales que puedes descargar y abrir en cualquier otro programa.","Terminal: escribe help para ver los comandos. Puedes navegar con cd, listar con ls, crear con mkdir y touch, y abrir archivos con open.","Sotos OS - (c) 2026 Sebastian Sotomontes."]),C=[["Brisa nocturna","Lumen","Horas azules"],["Reflejos","Aria Kael","Cristal"],["Estática suave","Lo-fi Coop","Sesiones"],["Corriente","Nimbo","Flujo"],["Atardecer 320","Vega","Órbita"],["Vidriera","Aria Kael","Cristal"]],y=[["Demo producto.mp4","ForBiggerBlazes.mp4"],["Big Buck Bunny.mp4","BigBuckBunny.mp4"],["Elephants Dream.mp4","ElephantsDream.mp4"],["For Bigger Fun.mp4","ForBiggerFun.mp4"]];return r("Sotos Drive",[r("Escritorio",[await o("Bienvenido.txt",s(E))],"desktop"),r("Documentos",[await o("Plan de negocio.docx",b),await o("Acuerdo de colaboración.docx",g),await o("Presupuesto marketing.xlsx",h),await o("Gastos de viaje.csv",s(q,"text/csv")),await o("Tendencias de marca.pptx",f),await o("Guía rápida de Sotos.pdf",v),await o("Notas reunión.txt",s(`Reunión de producto

- Revisar roadmap del trimestre
- Definir fecha de la beta
- Preparar demo para el portafolio
`))]),r("Imágenes",await Promise.all(d.map(([a],e)=>o(a,x[e])))),r("Música",await Promise.all(C.map(([a,e,t],n)=>o(`${a}.mp3`,null,{url:P(n+1),meta:{title:a,artist:e,album:t},online:!0})))),r("Vídeos",await Promise.all(y.map(([a,e])=>o(a,null,{url:w+e,online:!0})))),r("Proyectos",[r("web-sotos",[await o("index.html",s(k,"text/html")),await o("estilos.css",s(j,"text/css"))]),await o("Roadmap.md",s(T,"text/markdown"))]),r("Descargas",[])],"root")}export{F as buildSeed};
