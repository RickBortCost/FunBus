// Euristica condivisa dai test: riconosce il testo italiano (lettere accentate e parole funzionali molto comuni).
// Non è un rilevatore di lingua: serve a segnalare le stringhe che hanno quasi certamente bisogno di una voce nel dizionario EN.
export const IT_RE = /[àèéìòù]|\b(il|lo|gli|una|del|della|dei|delle|degli|che|non(?!-)|con|sono|nessun[oa]?|quest[oaie]|ogni|tra|dal|dalla|alla|alle|agli|nel|nella|sul|sulla|viene|anche|quando|senza|dopo|oppure|quindi|scegli|clicca|trascina|verifica|guasto|cavo|nodo|passo|risposta|dati|rete|anello|linea|stella|albero|sicurezza|determinismo|topologi[ae]|confronto|dispositiv[oi]|protocoll[oi]|livello|tutti|tutte)\b/i;
// Testo inglese (o neutro) che l'euristica scambierebbe per italiano.
export const NOT_ITALIAN = [/^non real-time$/, /\bDel Notification\b/];
export const looksItalian = s => IT_RE.test(s) && !NOT_ITALIAN.some(r => r.test(s));
