# Reusable AWS Deployment Script for Sultan Sports Kadapa 3D Showroom
# Usage: powershell -ExecutionPolicy Bypass -File scripts/deploy-aws.ps1

$ErrorActionPreference = "Stop"
$Profile = "Lite_aws"
$Bucket = "sultan-sports-kadapa-796458433659"
$DistributionId = "E2DFA0FZU3IDXN"
$LiveUrl = "https://dfrehykajewwr.cloudfront.net"

Write-Host "1/4 Building production bundle (dist/)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed." }

Write-Host "2/4 Uploading assets & 3D models to private S3 bucket ($Bucket)..." -ForegroundColor Cyan
aws s3 sync dist/ "s3://$Bucket/" --delete --exclude "index.html" --exclude "models/*.glb" --cache-control "public, max-age=31536000, immutable" --profile $Profile
aws s3 sync dist/models/ "s3://$Bucket/models/" --content-type "model/gltf-binary" --cache-control "public, max-age=31536000, immutable" --profile $Profile
aws s3 cp dist/index.html "s3://$Bucket/index.html" --content-type "text/html; charset=utf-8" --cache-control "no-cache, no-store, must-revalidate" --profile $Profile

Write-Host "3/4 Clearing CloudFront cache for /index.html..." -ForegroundColor Cyan
aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/index.html" "/" --profile $Profile | Out-Null

Write-Host "4/4 Done! Live website: $LiveUrl" -ForegroundColor Green
