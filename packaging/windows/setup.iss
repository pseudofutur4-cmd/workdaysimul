#ifndef AppVersion
  #error AppVersion is required
#endif
#ifndef Payload
  #error Payload is required
#endif

[Setup]
AppId=HCMPracticeLab
AppName=HCM Practice Lab
AppVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\HCM Practice Lab
DefaultGroupName=HCM Practice Lab
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
AppMutex=Local\HCMPracticeLabLauncher
OutputBaseFilename=HCM-Practice-Lab-{#AppVersion}-Windows-x64-Setup
Compression=lzma2/fast
SolidCompression=yes
UninstallDisplayIcon={app}\HCM Practice Lab.exe

[Files]
Source: "{#Payload}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\HCM Practice Lab"; Filename: "{app}\HCM Practice Lab.exe"

[Run]
Filename: "{app}\HCM Practice Lab.exe"; Description: "Open HCM Practice Lab"; Flags: postinstall nowait skipifsilent
