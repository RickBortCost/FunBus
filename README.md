# FunBus

App didattica sui bus di campo e protocolli industriali (19 protocolli: PROFINET, PROFIBUS, S7, EtherCAT, ADS, MQTT, OPC UA client/server, OPC UA PubSub, OPC UA FX, EtherNet/IP, CIP, Modbus TCP/RTU, CANopen, IO-Link, AS-Interface, BACnet/IP, KNX, HART). Livelli Beginner e Professional, italiano e inglese; animazioni con diagramma a sequenza e guasti simulati, topologie interattive, confronto in tabella e grafici, test a punti e gioco «Costruisci la rete». Tutto simulato, nessun hardware.

## Test
```
node tests/validate.mjs                           # contenuti JSON, traduzioni, contrasti
NODE_PATH=$(npm root -g) node tests/smoke.mjs     # Playwright: pagine, lingue, livelli, desktop e 390 px
```

## Build
```
dotnet publish -c Release -r win-x64 -o publish
publish\FunBus.exe --export-content   # crea content\ modificabile senza ricompilare
```
La versione (es. `-p:Version=1.2.0`) compare nelle proprietà dell'exe e nel piè di pagina dell'app. Le release si creano con un tag `v*` (workflow `release`).

I pittogrammi dei protocolli sono originali, non i loghi ufficiali (marchi dei rispettivi titolari).
