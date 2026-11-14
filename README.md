# FunBus

App didattica sui bus di campo e protocolli industriali (19 protocolli: PROFINET, PROFIBUS, S7, EtherCAT, ADS, MQTT, OPC UA client/server, OPC UA PubSub, OPC UA FX, EtherNet/IP, CIP, Modbus TCP/RTU, CANopen, IO-Link, AS-Interface, BACnet/IP, KNX, HART). Livelli Beginner e Professional, italiano e inglese; animazioni con diagramma a sequenza e guasti simulati, topologie interattive, confronto in tabella e grafici, test a punti e gioco «Costruisci la rete». Tutto simulato, nessun hardware.

## Test
```
node tests/validate.mjs                           # contenuti JSON, traduzioni, contrasti
node tests/i18n.mjs                               # ogni testo italiano (dati e interfaccia) ha la sua voce nel dizionario EN
NODE_PATH=$(npm root -g) node tests/smoke.mjs     # Playwright: pagine, lingue, livelli, desktop e 390 px
node tests/server.mjs                             # server C#: file incorporati, API, --export-content, cartella content (serve l'SDK .NET 8)
NODE_PATH=$(npm root -g) node tests/web.mjs       # versione web: sottocartella, nessuna chiamata al server, uso senza rete
npx prettier --check "wwwroot/js/**/*.js" "tests/**/*.mjs" "web/*.js" "web/*.mjs" eslint.config.mjs && npx eslint wwwroot/js tests web eslint.config.mjs   # formato e lint (prettier 3, eslint 10)
```

## Build
```
dotnet publish -c Release -r win-x64 -o publish
publish\FunBus.exe --export-content   # crea content\ modificabile senza ricompilare
```
La versione (es. `-p:Version=1.2.0`) compare nelle proprietà dell'exe e nel piè di pagina dell'app. Le release si creano con un tag `v*` (workflow `release`).

## Versione web (tablet, telefono, Chromebook)
La stessa app funziona senza exe, come sito statico: <https://rickbortcost.github.io/FunBus/>. Il workflow `pages` la pubblica a ogni modifica di `main`.

- **Attivazione, una volta sola**: *Settings → Pages → Source: «GitHub Actions»*, poi avviare il workflow `pages` (o attendere la modifica successiva).
- **Installazione sul dispositivo**: aprire il sito e scegliere «Aggiungi a schermata Home» (Safari su iPad/iPhone: pulsante Condividi) o «Installa app» (Chrome, Edge). Dopo la prima visita funziona anche senza rete.
- **Progressi**: restano nel browser del dispositivo. Per spostarli: *Profilo → Esporta progressi / Importa progressi*.
- **In locale**: `node web/build.mjs _site` crea la cartella da pubblicare su un qualsiasi server web statico (serve HTTPS per l'uso senza rete).

## Firma digitale dell'exe (facoltativa)
Senza firma Windows SmartScreen mostra un avviso al primo avvio. Il workflow `release` firma `FunBus.exe` (Authenticode, SHA-256, con marca temporale) se nel repository esistono due segreti in *Settings → Secrets and variables → Actions*:

- `SIGN_PFX_BASE64`: il certificato di firma del codice in formato `.pfx`, codificato in base64 (`base64 -w0 certificato.pfx`);
- `SIGN_PFX_PASSWORD`: la password del `.pfx`.

La variabile facoltativa `SIGN_TIMESTAMP_URL` cambia il server di marca temporale (predefinito `http://timestamp.digicert.com`). Se i segreti mancano, l'exe viene pubblicato non firmato come prima. Serve un certificato di firma del codice rilasciato da una CA riconosciuta da Windows: uno autofirmato non elimina l'avviso, e anche con un certificato valido la reputazione SmartScreen si costruisce con i download (subito solo con i certificati EV). I certificati conservati su token o HSM non si possono esportare in `.pfx`: in quel caso va usato il servizio di firma del fornitore.

I pittogrammi dei protocolli sono originali, non i loghi ufficiali (marchi dei rispettivi titolari).
