; Inno Setup script: builds dist/Redlark-Setup-<version>.exe from the PyInstaller output.
;   iscc /DVersion=2.0.0 packaging\installer.iss
#ifndef Version
  #define Version "2.0.0"
#endif

[Setup]
AppId={{7C2B6D2E-4C55-4E0B-9F1E-6B2D7A1C0002}
AppName=Redlark
AppVersion={#Version}
AppPublisher=Derek Schaper
DefaultDirName={localappdata}\Programs\Redlark v2
DefaultGroupName=Redlark
PrivilegesRequired=lowest
OutputDir=..\..\dist
OutputBaseFilename=Redlark-Setup-{#Version}
SetupIconFile=..\..\build\icon.ico
UninstallDisplayIcon={app}\Redlark.exe
Compression=lzma2
SolidCompression=yes

[Files]
Source: "..\dist\Redlark\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion

[Icons]
Name: "{group}\Redlark"; Filename: "{app}\Redlark.exe"
Name: "{userdesktop}\Redlark"; Filename: "{app}\Redlark.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked

[Run]
Filename: "{app}\Redlark.exe"; Description: "Launch Redlark"; Flags: nowait postinstall skipifsilent
