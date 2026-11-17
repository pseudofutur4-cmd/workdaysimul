param(
    [Parameter(Mandatory)][string]$NodeRuntime,
    [Parameter(Mandatory)][string]$InnoCompiler,
    [switch]$UseExistingBuild
)

$ErrorActionPreference = 'Stop'
$NodeRuntime = (Resolve-Path -LiteralPath $NodeRuntime).Path
$InnoCompiler = (Resolve-Path -LiteralPath $InnoCompiler).Path
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $repo
try {
    $version = (Get-Content package.json -Raw | ConvertFrom-Json).version
    $runtimeArch = & (Join-Path $NodeRuntime 'node.exe') -p process.arch
    if ($LASTEXITCODE -ne 0 -or $runtimeArch -ne 'x64') { throw 'Supply the official Windows x64 Node.js runtime.' }
    if (-not $UseExistingBuild) {
        $env:HCM_INSTALLER_BUILD = '1'
        $env:NEXT_DIST_DIR = '.next-installer'
        $env:DATABASE_URL = 'file:./installer-template.db'
        node scripts/migrate.mjs
        if ($LASTEXITCODE -ne 0) { throw 'Installer database migrations failed.' }
        node node_modules/tsx/dist/cli.mjs prisma/seed.ts
        if ($LASTEXITCODE -ne 0) { throw 'Installer database seed failed.' }
        node node_modules/next/dist/bin/next build --webpack
        if ($LASTEXITCODE -ne 0) { throw 'Standalone build failed.' }
    }

    $output = (New-Item -ItemType Directory -Force 'outputs/windows-release').FullName
    $payload = (New-Item -ItemType Directory (Join-Path $output ('payload-' + [guid]::NewGuid()))).FullName
    node (Join-Path $PSScriptRoot 'stage.mjs') $payload
    if ($LASTEXITCODE -ne 0) { throw 'Staging standalone application failed.' }
    Copy-Item -LiteralPath (Join-Path $NodeRuntime 'node.exe') -Destination $payload
    Copy-Item -LiteralPath (Join-Path $NodeRuntime 'LICENSE') -Destination (Join-Path $payload 'NODE-LICENSE.txt')
    Copy-Item -LiteralPath 'LICENSE','DISCLAIMER','THIRD_PARTY_NOTICES.md' -Destination $payload

    $compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
    $launcher = Join-Path $payload 'HCM Practice Lab.exe'
    & $compiler /nologo /target:winexe /platform:x64 /optimize+ "/out:$launcher" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll (Join-Path $PSScriptRoot 'Launcher.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }

    & $InnoCompiler "/DAppVersion=$version" "/DPayload=$payload" "/O$output" (Join-Path $PSScriptRoot 'setup.iss')
    if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }
    $name = "HCM-Practice-Lab-$version-Windows-x64-Setup.exe"
    $installer = Join-Path $output $name
    $hash = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
    Set-Content -LiteralPath "$installer.sha256" -Value "$hash  $name" -Encoding ascii
    Get-Item -LiteralPath $installer,"$installer.sha256"
} finally {
    Pop-Location
}
