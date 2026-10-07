$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Net.Http
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class OriensCredentialReader {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct Credential {
    public UInt32 Flags; public UInt32 Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize; public IntPtr CredentialBlob; public UInt32 Persist;
    public UInt32 AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
  }
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool CredRead(string target, uint type, int flags, out IntPtr credentialPtr);
  [DllImport("advapi32.dll", SetLastError=true)] static extern bool CredFree(IntPtr credentialPtr);
  public static byte[] Read(string target) {
    IntPtr ptr;
    if (!CredRead(target, 1, 0, out ptr)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    try {
      var credential = (Credential)Marshal.PtrToStructure(ptr, typeof(Credential));
      var bytes = new byte[credential.CredentialBlobSize];
      Marshal.Copy(credential.CredentialBlob, bytes, 0, (int)credential.CredentialBlobSize);
      return bytes;
    } finally { CredFree(ptr); }
  }
}
"@

$credentialBytes = [OriensCredentialReader]::Read("Supabase CLI:supabase")
$managementToken = [Text.Encoding]::UTF8.GetString($credentialBytes).Trim([char]0).Trim()
if (-not $managementToken.StartsWith("sbp_")) {
  $managementToken = [Text.Encoding]::Unicode.GetString($credentialBytes).Trim([char]0).Trim()
}
if (-not $managementToken.StartsWith("sbp_")) { throw "Cached Supabase management credential was not recognized." }

$managementClient = New-Object Net.Http.HttpClient
$managementClient.DefaultRequestHeaders.Authorization = New-Object Net.Http.Headers.AuthenticationHeaderValue("Bearer", $managementToken)
$disableUri = "https://api.supabase.com/v1/projects/mwbrlfmdpbkmdjroxhcc/api-keys/legacy?enabled=false"
$emptyBody = New-Object Net.Http.StringContent("", [Text.Encoding]::UTF8, "application/json")
$disableResponse = $managementClient.PutAsync($disableUri, $emptyBody).GetAwaiter().GetResult()
$disableBody = $disableResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
$disableStatus = [int]$disableResponse.StatusCode
# Supabase returns 422 when this idempotent request is repeated after legacy keys
# have already been disabled. The rejection check below is the source of truth.
if (-not $disableResponse.IsSuccessStatusCode -and $disableStatus -ne 422) {
  throw "Legacy-key disable failed with HTTP $disableStatus."
}

$proofPath = Join-Path $env:TEMP "oriens-compromised-legacy-key.dpapi"
$secureLegacy = ConvertTo-SecureString ([IO.File]::ReadAllText($proofPath))
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureLegacy)
try { $oldKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

$legacyClient = New-Object Net.Http.HttpClient
$null = $legacyClient.DefaultRequestHeaders.TryAddWithoutValidation("apikey", $oldKey)
$legacyClient.DefaultRequestHeaders.Authorization = New-Object Net.Http.Headers.AuthenticationHeaderValue("Bearer", $oldKey)
$legacyStatus = 0
for ($attempt = 1; $attempt -le 10; $attempt += 1) {
  $legacyResponse = $legacyClient.GetAsync("https://mwbrlfmdpbkmdjroxhcc.supabase.co/rest/v1/site_settings?select=key&limit=1").GetAwaiter().GetResult()
  $legacyStatus = [int]$legacyResponse.StatusCode
  if ($legacyStatus -eq 401) { break }
  if ($attempt -lt 10) { Start-Sleep -Seconds 5 }
}
if ($legacyStatus -ne 401) { throw "Compromised legacy credential was not rejected; HTTP $legacyStatus." }

$keysUri = "https://api.supabase.com/v1/projects/mwbrlfmdpbkmdjroxhcc/api-keys"
$keysResponse = $managementClient.GetAsync($keysUri).GetAwaiter().GetResult()
if (-not $keysResponse.IsSuccessStatusCode) {
  throw "Current API-key lookup failed with HTTP $([int]$keysResponse.StatusCode)."
}
$keyRecords = $keysResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
$publishableRecord = $keyRecords | Where-Object {
  $_.type -eq "publishable" -or ($_.api_key -is [string] -and $_.api_key.StartsWith("sb_publishable_"))
} | Select-Object -First 1
if (-not $publishableRecord) { throw "Current publishable key was not returned by Supabase." }
$publicKey = [string]$publishableRecord.api_key

$envPath = Join-Path (Get-Location) ".env.local"
$envRaw = [IO.File]::ReadAllText($envPath)
$publishablePattern = '(?m)^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\s*=\s*["'']?[^\r\n"'']+["'']?'
if (-not [regex]::IsMatch($envRaw, $publishablePattern)) { throw "Publishable key setting missing." }
$envRaw = [regex]::Replace($envRaw, $publishablePattern, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$publicKey", 1)
[IO.File]::WriteAllText($envPath, $envRaw, [Text.UTF8Encoding]::new($false))

$publicClient = New-Object Net.Http.HttpClient
$null = $publicClient.DefaultRequestHeaders.TryAddWithoutValidation("apikey", $publicKey)
$publicResponse = $publicClient.GetAsync("https://mwbrlfmdpbkmdjroxhcc.supabase.co/auth/v1/settings").GetAwaiter().GetResult()
if (-not $publicResponse.IsSuccessStatusCode) {
  throw "Publishable key smoke failed with HTTP $([int]$publicResponse.StatusCode)."
}

Remove-Item -LiteralPath $proofPath -Force
[Array]::Clear($credentialBytes, 0, $credentialBytes.Length)
$managementToken = $null; $oldKey = $null; $publicKey = $null; $envRaw = $null; $disableBody = $null
$managementClient.Dispose(); $legacyClient.Dispose(); $publicClient.Dispose()

Write-Output "LEGACY_KEYS=DISABLED"
Write-Output "COMPROMISED_KEY_HTTP=401"
Write-Output "PUBLISHABLE_KEY_MIGRATED=YES"
Write-Output "PUBLISHABLE_KEY_SMOKE=PASS"
Write-Output "DPAPI_PROOF_REMOVED=YES"
