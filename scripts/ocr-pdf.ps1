# Gera o arquivo acompanhante ".txt" de um PDF cuja camada de texto esta
# corrompida, usando o reconhecimento optico embutido no Windows. Nao requer
# instalacao: Windows.Data.Pdf renderiza as paginas e Windows.Media.Ocr
# reconhece o texto. Precisa do pacote de idioma correspondente instalado.
#
# Uso:
#   .\scripts\ocr-pdf.ps1 -Pdf docs-embrapa\arquivo.pdf -Saida docs-embrapa\arquivo.txt
#
# Limitacao: so roda no Windows. O resto da ingestao e multiplataforma.
#
# O OCR nao produz transcricao perfeita: sobrescritos e marcadores de rodape
# costumam sair errados (kg hL-1 vira "kg 111--1", por exemplo). Vale a pena
# quando a extracao do PDF esta totalmente ilegivel, nao quando ela esta boa.

param(
    [Parameter(Mandatory = $true)][string]$Pdf,
    [Parameter(Mandatory = $true)][string]$Saida,
    [string]$Idioma = 'pt-BR',
    [int]$Largura = 2200
)

Add-Type -AssemblyName System.Runtime.WindowsRuntime

[void][Windows.Storage.StorageFile, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime]
[void][Windows.Data.Pdf.PdfDocument, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime]
[void][Windows.Data.Pdf.PdfPageRenderOptions, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime]
[void][Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime]
[void][Windows.Media.Ocr.OcrEngine, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime]
[void][Windows.Globalization.Language, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime]

$metodos = [System.WindowsRuntimeSystemExtensions].GetMethods()
$asTaskGenerico = ($metodos | Where-Object {
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]
$asTaskSimples = ($metodos | Where-Object {
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'
    })[0]

function Esperar($op, $tipo) {
    $t = $asTaskGenerico.MakeGenericMethod($tipo).Invoke($null, @($op))
    $t.Wait(-1) | Out-Null
    $t.Result
}
function EsperarAcao($acao) {
    $t = $asTaskSimples.Invoke($null, @($acao))
    $t.Wait(-1) | Out-Null
}

$caminho = (Resolve-Path $Pdf).Path
$arquivo = Esperar ([Windows.Storage.StorageFile]::GetFileFromPathAsync($caminho)) ([Windows.Storage.StorageFile])
$doc = Esperar ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($arquivo)) ([Windows.Data.Pdf.PdfDocument])

$motor = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage((New-Object Windows.Globalization.Language $Idioma))
if (-not $motor) {
    $disponiveis = ([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | ForEach-Object { $_.LanguageTag }) -join ', '
    throw "Nao ha reconhecedor de OCR para '$Idioma'. Instalados: $disponiveis"
}

Write-Host "PDF com $($doc.PageCount) pagina(s). Reconhecendo em $Idioma a $Largura px de largura..."
$paginas = @()

for ($i = 0; $i -lt $doc.PageCount; $i++) {
    $pagina = $doc.GetPage($i)
    $fluxo = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
    $opcoes = New-Object Windows.Data.Pdf.PdfPageRenderOptions
    $opcoes.DestinationWidth = $Largura
    EsperarAcao ($pagina.RenderToStreamAsync($fluxo, $opcoes))

    $decodificador = Esperar ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($fluxo)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Esperar ($decodificador.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $resultado = Esperar ($motor.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

    $paginas += $resultado.Text
    Write-Host ("  pagina {0}: {1} caracteres" -f ($i + 1), $resultado.Text.Length)

    $bitmap.Dispose()
    $fluxo.Dispose()
    $pagina.Dispose()
}

# Form feed separa as paginas: a ingestao usa esse caractere para manter o
# numero da pagina correto no metadata de cada trecho.
[IO.File]::WriteAllText($Saida, ($paginas -join "`f"), (New-Object Text.UTF8Encoding($false)))
Write-Host "`nSalvo em: $Saida"
