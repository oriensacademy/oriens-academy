$ErrorActionPreference = "Stop"

$AdminEmail = $env:ORIENS_LOCAL_ADMIN_EMAIL
$AdminPassword = $env:ORIENS_LOCAL_ADMIN_PASSWORD
$DisplayName = "Oriens Local Administrator"

if ([string]::IsNullOrWhiteSpace($AdminEmail) -or [string]::IsNullOrWhiteSpace($AdminPassword)) {
  throw "Set ORIENS_LOCAL_ADMIN_EMAIL and ORIENS_LOCAL_ADMIN_PASSWORD before creating the local administrator."
}

$strictPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$statusOutput = & npx.cmd supabase status -o json 2>$null | Out-String
$statusExitCode = $LASTEXITCODE
$ErrorActionPreference = $strictPreference
if ($statusExitCode -ne 0) {
  throw "Local Supabase is not running. Start it with: npx supabase start"
}
$status = $statusOutput | ConvertFrom-Json
$apiUri = [Uri]$status.API_URL
if ($apiUri.Scheme -ne "http" -or $apiUri.Host -notin @("127.0.0.1", "localhost") -or $apiUri.Port -ne 54321) {
  throw "Safety stop: Supabase API is not the expected local endpoint."
}
if ([string]::IsNullOrWhiteSpace($status.SERVICE_ROLE_KEY) -or [string]::IsNullOrWhiteSpace($status.ANON_KEY)) {
  throw "Local Supabase keys are unavailable."
}

$adminHeaders = @{
  apikey = $status.SERVICE_ROLE_KEY
  Authorization = "Bearer $($status.SERVICE_ROLE_KEY)"
  "Content-Type" = "application/json"
}
$usersResponse = Invoke-RestMethod -Uri "$($status.API_URL)/auth/v1/admin/users?page=1&per_page=1000" -Headers $adminHeaders -Method Get
$user = @($usersResponse.users) | Where-Object { $_.email -eq $AdminEmail } | Select-Object -First 1
$userBody = @{
  email = $AdminEmail
  password = $AdminPassword
  email_confirm = $true
  app_metadata = @{ role = "admin" }
  user_metadata = @{ display_name = $DisplayName }
} | ConvertTo-Json -Depth 5

if ($user) {
  $user = Invoke-RestMethod -Uri "$($status.API_URL)/auth/v1/admin/users/$($user.id)" -Headers $adminHeaders -Method Put -Body $userBody
  $operation = "updated"
} else {
  $user = Invoke-RestMethod -Uri "$($status.API_URL)/auth/v1/admin/users" -Headers $adminHeaders -Method Post -Body $userBody
  $operation = "created"
}
if (-not $user.id -or $user.app_metadata.role -ne "admin") {
  throw "Local Auth administrator creation failed."
}

$dbContainer = docker ps --format "{{.Names}}" | Where-Object { $_ -like "supabase_db_*" } | Select-Object -First 1
if (-not $dbContainer) {
  throw "Local Supabase database container was not found."
}
$profileSql = "insert into public.admin_profiles (user_id, display_name, role, active) values ('$($user.id)', '$DisplayName', 'admin', true) on conflict (user_id) do update set display_name = excluded.display_name, role = 'admin', active = true, updated_at = now();"
docker exec $dbContainer psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c $profileSql | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Local admin profile upsert failed."
}

$tokenHeaders = @{ apikey = $status.ANON_KEY; "Content-Type" = "application/json" }
$tokenBody = @{ email = $AdminEmail; password = $AdminPassword } | ConvertTo-Json
$token = Invoke-RestMethod -Uri "$($status.API_URL)/auth/v1/token?grant_type=password" -Headers $tokenHeaders -Method Post -Body $tokenBody
if (-not $token.access_token -or $token.user.app_metadata.role -ne "admin") {
  throw "Local administrator password sign-in verification failed."
}

$profileHeaders = @{ apikey = $status.ANON_KEY; Authorization = "Bearer $($token.access_token)" }
$profile = @(Invoke-RestMethod -Uri "$($status.API_URL)/rest/v1/admin_profiles?user_id=eq.$($user.id)&select=user_id,display_name,role,active" -Headers $profileHeaders -Method Get)
if ($profile.Count -ne 1 -or $profile[0].role -ne "admin" -or $profile[0].active -ne $true) {
  throw "Local administrator RLS/profile verification failed."
}

[pscustomobject]@{
  Environment = "local"
  ApiUrl = $status.API_URL
  Email = $AdminEmail
  AuthUser = $operation
  Role = $profile[0].role
  Active = $profile[0].active
  PasswordSignIn = "verified"
  ProfileRlsRead = "verified"
} | Format-List
