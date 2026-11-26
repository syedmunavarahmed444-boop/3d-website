# Secure Helper: Attach Google OAuth to Your Amazon Cognito User Pool (ap-southeast-2)
# Follows aws-auth security best practices:
#   - Prompts securely for Client Secret (never logged or passed on CLI flags)
#   - Passes provider-details via a temporary JSON file that is deleted right after
#   - Performs read-modify-write on the App Client so existing auth flows & rotation are preserved
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/attach-google-oauth.ps1

$ErrorActionPreference = "Continue"
$Profile = "Lite_aws"
$Region = "ap-southeast-2"
$PoolId = "ap-southeast-2_eAwdsaCYa"
$ClientId = "5gbndef1junsp1gqke1e5dcftp"
$TempDir = "scripts/temp/aws_auth"

Write-Host ""
Write-Host "=== Attach Google OAuth to Sultan Sports Amazon Cognito ===" -ForegroundColor Cyan
Write-Host "In Google Cloud Console -> Credentials -> OAuth Client ID (Web application)," -ForegroundColor Yellow
Write-Host "make sure this Authorized Redirect URI is added:" -ForegroundColor Yellow
Write-Host "  https://sultan-sports-kadapa-auth.auth.ap-southeast-2.amazoncognito.com/oauth2/idpresponse" -ForegroundColor Green
Write-Host ""

$GoogleClientId = (Read-Host "Paste your Google OAuth Client ID").Trim()
$Sec = Read-Host "Paste your Google OAuth Client Secret (input hidden)" -AsSecureString
$Bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Sec)
$GoogleClientSecret = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($Bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr)

if (-not $GoogleClientId -or -not $GoogleClientSecret) {
  Write-Error "Both Google Client ID and Client Secret are required."
  exit 1
}

New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
$ProviderFile = "$PWD\$TempDir\google_provider_tmp.json"

try {
  $details = @{
    client_id = $GoogleClientId
    client_secret = $GoogleClientSecret
    authorize_scopes = "openid email profile"
  } | ConvertTo-Json -Compress
  [System.IO.File]::WriteAllText($ProviderFile, $details, (New-Object System.Text.UTF8Encoding $false))
  $GoogleClientSecret = $null

  Write-Host "1/3 Creating or updating Google Identity Provider in Cognito..." -ForegroundColor Cyan
  $listRaw = aws cognito-idp list-identity-providers --user-pool-id $PoolId --region $Region --profile $Profile --output json
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Could not reach AWS Cognito. Please run 'aws login --profile Lite_aws' and try again."
    exit 1
  }
  $providers = ($listRaw | ConvertFrom-Json).Providers
  $hasGoogle = $false
  if ($providers) {
    foreach ($p in $providers) {
      if ($p.ProviderName -eq "Google") { $hasGoogle = $true }
    }
  }

  if ($hasGoogle) {
    aws cognito-idp update-identity-provider `
      --user-pool-id $PoolId `
      --provider-name Google `
      --provider-details "file://$TempDir/google_provider_tmp.json" `
      --attribute-mapping "email=email,name=name" `
      --region $Region --profile $Profile | Out-Null
  } else {
    aws cognito-idp create-identity-provider `
      --user-pool-id $PoolId `
      --provider-name Google `
      --provider-type Google `
      --provider-details "file://$TempDir/google_provider_tmp.json" `
      --attribute-mapping "email=email,name=name" `
      --region $Region --profile $Profile | Out-Null
  }
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Cognito rejected the Google provider setup. Double-check your Client ID and Client Secret."
    exit 1
  }
} finally {
  if (Test-Path $ProviderFile) { Remove-Item $ProviderFile -Force }
}

Write-Host "2/3 Safely updating App Client (read-modify-write) to enable Google..." -ForegroundColor Cyan
$clientJson = aws cognito-idp describe-user-pool-client --user-pool-id $PoolId --client-id $ClientId --region $Region --profile $Profile --query "UserPoolClient" --output json
if ($LASTEXITCODE -ne 0) { exit 1 }
$clientObj = $clientJson | ConvertFrom-Json
$clientObj.PSObject.Properties.Remove("ClientSecret")
$clientObj.PSObject.Properties.Remove("CreationDate")
$clientObj.PSObject.Properties.Remove("LastModifiedDate")
$clientObj.PSObject.Properties.Remove("ClientType")
$clientObj.SupportedIdentityProviders = @("COGNITO", "Google")

$clientFile = "$PWD\$TempDir\client_updated.json"
[System.IO.File]::WriteAllText($clientFile, ($clientObj | ConvertTo-Json -Depth 10), (New-Object System.Text.UTF8Encoding $false))
aws cognito-idp update-user-pool-client --cli-input-json "file://$TempDir/client_updated.json" --region $Region --profile $Profile | Out-Null
$updCode = $LASTEXITCODE
Remove-Item $clientFile -Force -ErrorAction SilentlyContinue
if ($updCode -ne 0) {
  Write-Error "Failed to update App Client with Google provider."
  exit 1
}

Write-Host "3/3 Updating local .env (VITE_COGNITO_GOOGLE_ENABLED=true)..." -ForegroundColor Cyan
$envPath = "$PWD\.env"
if (Test-Path $envPath) {
  $content = Get-Content $envPath -Raw
  if ($content -match "VITE_COGNITO_GOOGLE_ENABLED=") {
    $content = $content -replace "VITE_COGNITO_GOOGLE_ENABLED=.*", "VITE_COGNITO_GOOGLE_ENABLED=true"
  } else {
    $content += "`nVITE_COGNITO_GOOGLE_ENABLED=true`n"
  }
  [System.IO.File]::WriteAllText($envPath, $content, (New-Object System.Text.UTF8Encoding $false))
} else {
  [System.IO.File]::WriteAllText($envPath, "VITE_COGNITO_GOOGLE_ENABLED=true`n", (New-Object System.Text.UTF8Encoding $false))
}

Write-Host ""
Write-Host "SUCCESS! Google OAuth is now live in Amazon Cognito." -ForegroundColor Green
Write-Host "Next: Run 'powershell -ExecutionPolicy Bypass -File scripts/deploy-aws.ps1' to publish 'Continue with Google' live!" -ForegroundColor Green
