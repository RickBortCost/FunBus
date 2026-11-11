# FunBus

App didattica sui bus di campo e protocolli industriali (Profinet, Profibus, S7, EtherCAT, ADS, MQTT, OPC UA, EtherNet/IP, Modbus TCP, CANopen, IO-Link). Livelli Beginner e Professional, animazioni, confronto e test a punti. Tutto simulato, nessun hardware.

## Build
```
dotnet publish -c Release -r win-x64 -o publish
publish\FunBus.exe --export-content   # crea content\ modificabile senza ricompilare
```
La versione (es. `-p:Version=1.2.0`) compare nelle proprietà dell'exe e nel piè di pagina dell'app. Le release si creano con un tag `v*` (workflow `release`).

I pittogrammi dei protocolli sono originali, non i loghi ufficiali (marchi dei rispettivi titolari).
