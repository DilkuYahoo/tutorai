import{j as l}from"./index-B6jaueEG.js";const e={primary:"bg-indigo-500 hover:bg-indigo-400 text-white",secondary:"bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700",ghost:"hover:bg-slate-800 text-slate-400 hover:text-slate-200",danger:"bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30"},t={sm:"px-3 py-1.5 text-xs",md:"px-4 py-2 text-sm",lg:"px-5 py-2.5 text-base"};function x({children:r,variant:o="primary",size:s="md",type:a="button",disabled:d=!1,onClick:n,className:i=""}){return l.jsx("button",{type:a,disabled:d,onClick:n,className:`
        inline-flex items-center justify-center gap-2 rounded-full font-semibold
        transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed
        ${e[o]??e.primary}
        ${t[s]??t.md}
        ${i}
      `,children:r})}export{x as B};
