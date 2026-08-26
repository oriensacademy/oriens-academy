# ==============================================================================
# Oriens Academy — Secure PayTR Credentials Setup
# Target Supabase Project: mwbrlfmdpbkmdjroxhcc (Production)
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ORIENS ACADEMY — PAYTR SECURE CREDENTIAL SETUP" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target Supabase Project: mwbrlfmdpbkmdjroxhcc" -ForegroundColor Yellow
Write-Host "This script will securely upload your PayTR merchant secrets to Supabase." -ForegroundColor Gray
Write-Host ""

# 1. Prompt for PAYTR_MERCHANT_ID
$MerchantId = (Read-Host "Enter PAYTR_MERCHANT_ID").Trim()
if ([string]::IsNullOrWhiteSpace($MerchantId)) {
    throw "PAYTR_MERCHANT_ID cannot be empty."
}

# 2. Prompt for PAYTR_MERCHANT_KEY (Masked input)
$MerchantKeySecure = Read-Host "Enter PAYTR_MERCHANT_KEY" -AsSecureString
$BSTR_Key = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($MerchantKeySecure)
$MerchantKeyPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR_Key)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR_Key)

if ([string]::IsNullOrWhiteSpace($MerchantKeyPlain)) {
    throw "PAYTR_MERCHANT_KEY cannot be empty."
}

# 3. Prompt for PAYTR_MERCHANT_SALT (Masked input)
$MerchantSaltSecure = Read-Host "Enter PAYTR_MERCHANT_SALT" -AsSecureString
$BSTR_Salt = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($MerchantSaltSecure)
$MerchantSaltPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR_Salt)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR_Salt)

if ([string]::IsNullOrWhiteSpace($MerchantSaltPlain)) {
    throw "PAYTR_MERCHANT_SALT cannot be empty."
}

Write-Host ""
Write-Host "Setting production Supabase Edge Function secrets..." -ForegroundColor Cyan

$tempFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "paytr_secrets_$([System.Guid]::NewGuid().ToString('N')).env")

try {
    # Write UTF-8 without BOM to temporary file in $env:TEMP
    $envContent = "PAYTR_MERCHANT_ID=$MerchantId`nPAYTR_MERCHANT_KEY=$MerchantKeyPlain`nPAYTR_MERCHANT_SALT=$MerchantSaltPlain`n"
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($tempFile, $envContent, $utf8NoBom)

    # Execute Supabase CLI secrets set
    $prevErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & npx.cmd supabase secrets set --env-file "$tempFile"
    $setExitCode = $LASTEXITCODE
    $ErrorActionPreference = $prevErrorAction

    if ($setExitCode -ne 0) {
        throw "Supabase secrets set failed with exit code $setExitCode."
    }

    Write-Host "✓ PayTR secrets successfully updated on Supabase." -ForegroundColor Green
}
finally {
    # Immediately wipe and delete temporary file
    if (Test-Path $tempFile) {
        try {
            [System.IO.File]::WriteAllText($tempFile, "DELETED", [System.Text.Encoding]::ASCII)
            Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
        } catch {}
    }

    $stillExists = Test-Path $tempFile
    if ($stillExists) {
        Write-Warning "⚠️ Temporary file could not be deleted immediately: $tempFile"
    } else {
        Write-Host "✓ Temporary credential file securely removed from disk." -ForegroundColor Green
    }

    # Clear sensitive variables from memory
    $MerchantKeyPlain = $null
    $MerchantSaltPlain = $null
    $envContent = $null
    [System.GC]::Collect()
}

Write-Host ""
Write-Host "Verifying configured secret names on Supabase..." -ForegroundColor Cyan

$secretsOutput = & npx.cmd supabase secrets list -o json 2>$null | Out-String
$secretsData = $secretsOutput | ConvertFrom-Json

$configuredNames = @($secretsData.secrets | ForEach-Object { $_.name })

$hasId = $configuredNames -contains "PAYTR_MERCHANT_ID"
$hasKey = $configuredNames -contains "PAYTR_MERCHANT_KEY"
$hasSalt = $configuredNames -contains "PAYTR_MERCHANT_SALT"

Write-Host ""
Write-Host "SECRET VERIFICATION SUMMARY:" -ForegroundColor Cyan
Write-Host "  PAYTR_MERCHANT_ID   : $(if ($hasId) { 'CONFIGURED [✓]' } else { 'MISSING [✗]' })" -ForegroundColor $(if ($hasId) { 'Green' } else { 'Red' })
Write-Host "  PAYTR_MERCHANT_KEY  : $(if ($hasKey) { 'CONFIGURED [✓]' } else { 'MISSING [✗]' })" -ForegroundColor $(if ($hasKey) { 'Green' } else { 'Red' })
Write-Host "  PAYTR_MERCHANT_SALT : $(if ($hasSalt) { 'CONFIGURED [✓]' } else { 'MISSING [✗]' })" -ForegroundColor $(if ($hasSalt) { 'Green' } else { 'Red' })
Write-Host ""

if ($hasId -and $hasKey -and $hasSalt) {
    Write-Host "SUCCESS: All PayTR secrets are verified and active." -ForegroundColor Green
} else {
    Write-Warning "One or more secrets were not detected. Please verify your Supabase permissions."
}
