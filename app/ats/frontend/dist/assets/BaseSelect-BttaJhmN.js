import{j as e}from"./index-B6jaueEG.js";function u({label:l,id:r,error:t,helper:a,options:i=[],placeholder:n,className:x="",...o}){const c=t?"border-red-500 focus:border-red-400":"border-slate-700 focus:border-indigo-500";return e.jsxs("div",{className:`flex flex-col gap-1.5 ${x}`,children:[l&&e.jsx("label",{htmlFor:r,className:"text-xs font-semibold uppercase tracking-widest text-slate-400",children:l}),e.jsxs("select",{id:r,className:`
          w-full bg-slate-900 border rounded-xl px-4 py-2.5 text-sm text-white
          outline-none transition-colors duration-150 cursor-pointer
          ${c}
        `,...o,children:[n&&e.jsx("option",{value:"",children:n}),i.map(s=>typeof s=="string"?e.jsx("option",{value:s,children:s},s):e.jsx("option",{value:s.value,children:s.label},s.value))]}),t&&e.jsx("p",{className:"text-xs text-red-400",children:t}),a&&!t&&e.jsx("p",{className:"text-xs text-slate-500",children:a})]})}export{u as B};
