# Generate self-signed certificates for local HTTPS (development only)
$certDir = Join-Path $PSScriptRoot "certs"
New-Item -ItemType Directory -Force -Path $certDir | Out-Null

$keyPath = Join-Path $certDir "key.pem"
$certPath = Join-Path $certDir "cert.pem"

if (Get-Command openssl -ErrorAction SilentlyContinue) {
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
        -keyout $keyPath -out $certPath `
        -subj "/CN=localhost"
    Write-Host "Certificates created in $certDir"
} else {
    Write-Host "OpenSSL not found. Install OpenSSL or create certs manually."
    exit 1
}
