# Install HCM Practice Lab on Windows

The installer targets 64-bit Windows 10 and Windows 11. It installs for the current user and packages the Node.js runtime, application, and a fresh synthetic database. It uses the Windows .NET Framework 4.x for the launcher.

1. Download `HCM-Practice-Lab-0.1.0-Windows-x64-Setup.exe` and its `.sha256` file from the [GitHub release](https://github.com/pseudofutur4-cmd/workdaysimul/releases/tag/v0.1.0).
2. Verify the download in PowerShell with `Get-FileHash .\HCM-Practice-Lab-0.1.0-Windows-x64-Setup.exe -Algorithm SHA256`. Compare the hash with the one in the checksum file. The setup file is unsigned, so a checksum confirms the file matches the release asset but does not establish publisher identity.
3. Run setup, then open **HCM Practice Lab** from the Start menu. Keep the launcher window open while you practise. Select HR Administrator and enter the demo password `Practice123!`.
4. Choose **Stop and close** in the launcher when finished. The launcher uses a free local port. Use its **Open in browser** button if a bookmark points to an old port.

The browser and server run on the same PC. This installer is for individual practice using synthetic data. See [setup and operation](operations.md) to run the source version on a trusted LAN.

The installer creates `%LOCALAPPDATA%\HCM Practice Lab Data\practice.db` on first launch. It has its own database, separate from a source checkout. To back it up, close the launcher and copy the database. Uninstall the app from **Settings > Apps > Installed apps**. The uninstaller leaves practice data in place. Future releases that change the database schema will need an upgrade procedure.

## Build the installer

On Windows x64, install project dependencies from the lockfile and extract the official [Node.js Windows x64 distribution](https://nodejs.org/en/download) to a local folder. Use Node.js 24 for the build and bundle. Install [Inno Setup](https://jrsoftware.org/isdl.php), then run:

```powershell
pwsh -File ./packaging/windows/build.ps1 -NodeRuntime 'C:\path\to\node-win-x64' -InnoCompiler 'C:\path\to\ISCC.exe'
```

The script builds standalone Next.js output, seeds a dedicated template, compiles the launcher, and writes the setup executable and checksum under `outputs/windows-release`. The setup contains only the synthetic installer template. Package the source version corresponding to the release tag and check the installer on a separate Windows path before publishing.
