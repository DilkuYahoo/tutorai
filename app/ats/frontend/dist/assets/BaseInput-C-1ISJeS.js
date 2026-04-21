import{j as e}from"./index-B6jaueEG.js";function d({label:s,id:l,error:t,helper:a,className:o="",...x}){const r=t?"border-red-500 focus:border-red-400":"border-slate-700 focus:border-indigo-500";return e.jsxs("div",{className:`flex flex-col gap-1.5 ${o}`,children:[s&&e.jsx("label",{htmlFor:l,className:"text-xs font-semibold uppercase tracking-widest text-slate-400",children:s}),e.jsx("input",{id:l,className:`
          w-full bg-slate-900 border rounded-xl px-4 py-2.5 text-sm text-white
          placeholder:text-slate-600 outline-none transition-colors duration-150
          ${r}
        `,...x}),t&&e.jsx("p",{className:"text-xs text-red-400",children:t}),a&&!t&&e.jsx("p",{className:"text-xs text-slate-500",children:a})]})}export{d as B};
