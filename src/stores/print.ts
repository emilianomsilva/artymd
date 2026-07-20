import { writable } from 'svelte/store';

const initialPaper = localStorage.getItem('printPaper') || 'A4';
const initialOrientation = localStorage.getItem('printOrientation') || 'portrait';
const initialMargin = parseInt(localStorage.getItem('printMargin') || '20');
const initialPageNumbers = localStorage.getItem('printPageNumbers') !== 'false';

export const printPaper = writable<string>(initialPaper);
export const printOrientation = writable<string>(initialOrientation);
export const printMargin = writable<number>(initialMargin);
export const printPageNumbers = writable<boolean>(initialPageNumbers);
export const showPrintDialog = writable<boolean>(false);

printPaper.subscribe(v => localStorage.setItem('printPaper', v));
printOrientation.subscribe(v => localStorage.setItem('printOrientation', v));
printMargin.subscribe(v => localStorage.setItem('printMargin', v.toString()));
printPageNumbers.subscribe(v => localStorage.setItem('printPageNumbers', v.toString()));
