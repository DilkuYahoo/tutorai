import{j as e}from"./index-B6jaueEG.js";function c({label:s,id:a,error:t,helper:l,rows:r=4,className:x="",...o}){const n=t?"border-red-500 focus:border-red-400":"border-slate-700 focus:border-indigo-500";return e.jsxs("div",{className:`flex flex-col gap-1.5 ${x}`,children:[s&&e.jsx("label",{htmlFor:a,className:"text-xs font-semibold uppercase tracking-widest text-slate-400",children:s}),e.jsx("textarea",{id:a,rows:r,className:`
          w-full bg-slate-900 border rounded-xl px-4 py-2.5 text-sm text-white
          placeholder:text-slate-600 outline-none transition-colors duration-150 resize-none
          ${n}
        `,...o}),t&&e.jsx("p",{className:"text-xs text-red-400",children:t}),l&&!t&&e.jsx("p",{className:"text-xs text-slate-500",children:l})]})}export{c as B};
