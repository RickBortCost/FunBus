@echo off
dotnet restore
dotnet publish -c Release -r win-x64 -o publish
echo Eseguibile: publish\IndustrialProtocolsLab.exe
