// Bottom sheet (#sheet): openSheet(innerHtml), closeSheet(), menuRow(). 'sheet-close' is a ready-made data-act.
import { $, reg } from '../state.js';

export const sheetHtml = inner => `<div class="scrim" data-act="sheet-close"></div><div class="sheetbox">${inner}</div>`;
export const openSheet = inner => { $('#sheet').innerHTML = sheetHtml(inner); };
export const closeSheet = () => { $('#sheet').innerHTML = ''; };
export const sheetOpen = () => !!$('#sheet').innerHTML;
/** A full-width row for sheet menus. attrs = extra attributes (e.g. data-plid="x"), style = extra inline css. */
export const menuRow = (act, label, attrs = '', style = '') => `<button class="row" data-act="${act}" ${attrs}><span class="lbl" style="font-size:17px;${style}">${label}</span></button>`;
reg({ 'sheet-close': closeSheet });
