const paths:Record<string,string>={
 music:'M9 18V5l12-2v13M9 9l12-2M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Zm12-2a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Z',
 dashboard:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
 library:'M4 4v16M9 4v16M14 4v16M18 5l3 14',
 model:'m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
 sliders:'M4 3v7m0 4v7M12 3v11m0 4v3M20 3v3m0 4v11M1 10h6M9 14h6M17 6h6',
 archive:'M3 3h18v5H3zM5 8v13h14V8M9 12h6',
 minus:'M5 12h14',plus:'M12 5v14M5 12h14',close:'m6 6 12 12M6 18 18 6',
 play:'m8 5 11 7-11 7V5Z',pause:'M8 5v14M16 5v14',next:'m5 5 10 7-10 7V5Zm13 0v14',
 restore:'M3 10a9 9 0 1 1 2 8M3 3v7h7',chevron:'m9 5 7 7-7 7',check:'m5 12 4 4L19 6'
};
export function icon(name:string){return `<svg class="ui-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]?`<path d="${paths[name]}"/>`:''}</svg>`;}
