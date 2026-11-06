# Carga una clave nueva de OpenRouter (la que usa Ciro) en el Citify del VPS.
#
#   powershell -ExecutionPolicy Bypass -File deploy\configurar-openrouter.ps1
#
# Pide la clave sin mostrarla, le pregunta a OpenRouter si es valida y recien
# ahi la manda por SSH a deploy/configurar-mail.sh en el servidor, que la
# guarda en /etc/citify/app.env y reinicia Citify. La clave no queda en el
# historial, ni en un archivo, ni en la lista de procesos.
#
# Parametros opcionales:
#   -Vps root@2.25.185.242     servidor (default)
#   -SinVerificar              no consultar a OpenRouter antes de guardar

param(
  [string]$Vps = 'root@2.25.185.242',
  [switch]$SinVerificar
)

$ErrorActionPreference = 'Stop'
$script = '/home/citify/citify-aws/deploy/configurar-mail.sh'

$segura = Read-Host -Prompt 'Pega la clave de OpenRouter (sk-or-...) y Enter' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)
try {
  $clave = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim().Trim('"', "'")
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if (-not $clave.StartsWith('sk-or-')) {
  Write-Host 'La clave no empieza con "sk-or-": no se guardo nada.' -ForegroundColor Red
  exit 1
}

if (-not $SinVerificar) {
  Write-Host 'Verificando la clave con OpenRouter...'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  try {
    $r = Invoke-RestMethod -Uri 'https://openrouter.ai/api/v1/key' -Headers @{ Authorization = "Bearer $clave" } -TimeoutSec 20
    $limite = if ($null -eq $r.data.limit) { 'sin limite' } else { "limite $($r.data.limit) USD" }
    Write-Host "  OK: clave valida ($limite, usado $([math]::Round([double]$r.data.usage, 4)) USD)" -ForegroundColor Green
  } catch {
    $codigo = $_.Exception.Response.StatusCode.value__
    if ($codigo -eq 401) {
      Write-Host '  OpenRouter rechazo la clave (401): no se guardo nada. Revisa que la copiaste completa.' -ForegroundColor Red
    } else {
      Write-Host "  No se pudo verificar ($($_.Exception.Message)). Si estas seguro, volve a correr con -SinVerificar." -ForegroundColor Red
    }
    exit 1
  }
}

Write-Host "Guardando en $Vps y reiniciando Citify..."
"OPENROUTER_API_KEY=$clave" | ssh -o BatchMode=yes $Vps $script
$salida = $LASTEXITCODE
Remove-Variable clave, segura -ErrorAction SilentlyContinue

if ($salida -ne 0) {
  Write-Host "Fallo en el servidor (codigo $salida). Revisa el mensaje de arriba." -ForegroundColor Red
  exit $salida
}
Write-Host 'Listo. Proba a Ciro en citify.com.ar.' -ForegroundColor Green
