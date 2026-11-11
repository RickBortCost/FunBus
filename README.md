# IndustrialProtocolsLab
## Build
```
dotnet publish -c Release -r win-x64 -o publish
publish\IndustrialProtocolsLab.exe --export-content   # crea content\ modificabile senza ricompilare
```
L'exe è prodotto anche dalla GitHub Action `build-exe` (artifact).
