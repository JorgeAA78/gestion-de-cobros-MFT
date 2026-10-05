Add-Type -AssemblyName System.Drawing

$srcPath = 'c:\Users\Jorge Altamirano\PROYECTOS\cobros-system-v2\frontend\public\escudo26.png'
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

function Resize-And-Center {
    param(
        [System.Drawing.Bitmap]$source,
        [int]$canvasSize,
        [double]$scaleFactor,
        [System.Drawing.Color]$bgColor,
        [bool]$isRound
    )

    $bmp = New-Object System.Drawing.Bitmap($canvasSize, $canvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    if ($bgColor -ne [System.Drawing.Color]::Transparent) {
        $brush = New-Object System.Drawing.SolidBrush($bgColor)
        if ($isRound) {
            $g.FillEllipse($brush, 1, 1, ($canvasSize - 2), ($canvasSize - 2))
        } else {
            $rect = New-Object System.Drawing.Rectangle(0, 0, $canvasSize, $canvasSize)
            $g.FillRectangle($brush, $rect)
        }
        $brush.Dispose()
    }

    $maxDim = $canvasSize * $scaleFactor
    $aspect = $source.Width / $source.Height
    if ($aspect -gt 1) {
        $drawW = [int]$maxDim
        $drawH = [int]($maxDim / $aspect)
    } else {
        $drawH = [int]$maxDim
        $drawW = [int]($maxDim * $aspect)
    }

    $drawX = [int](($canvasSize - $drawW) / 2)
    $drawY = [int](($canvasSize - $drawH) / 2)

    $destRect = New-Object System.Drawing.Rectangle($drawX, $drawY, $drawW, $drawH)
    $g.DrawImage($source, $destRect)
    $g.Dispose()

    return $bmp
}

$darkBg = [System.Drawing.ColorTranslator]::FromHtml('#0a120c')
$trans = [System.Drawing.Color]::Transparent

$resBase = 'c:\Users\Jorge Altamirano\PROYECTOS\cobros-system-v2\frontend\android\app\src\main\res'

$densities = @(
    @{ name = 'mipmap-mdpi'; iconSize = 48; fgSize = 108 },
    @{ name = 'mipmap-hdpi'; iconSize = 72; fgSize = 162 },
    @{ name = 'mipmap-xhdpi'; iconSize = 96; fgSize = 216 },
    @{ name = 'mipmap-xxhdpi'; iconSize = 144; fgSize = 324 },
    @{ name = 'mipmap-xxxhdpi'; iconSize = 192; fgSize = 432 }
)

foreach ($d in $densities) {
    $dir = Join-Path $resBase $d.name
    
    # 1. Foreground
    $fg = Resize-And-Center $src $d.fgSize 0.70 $trans $false
    $fgPath = Join-Path $dir 'ic_launcher_foreground.png'
    $fg.Save($fgPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $fg.Dispose()

    # 2. Launcher
    $icon = Resize-And-Center $src $d.iconSize 0.85 $darkBg $false
    $iconPath = Join-Path $dir 'ic_launcher.png'
    $icon.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $icon.Dispose()

    # 3. Round
    $round = Resize-And-Center $src $d.iconSize 0.80 $darkBg $true
    $roundPath = Join-Path $dir 'ic_launcher_round.png'
    $round.Save($roundPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $round.Dispose()

    Write-Host "Generated icons for $($d.name)"
}

# Update splash screens
$splashDirs = Get-ChildItem -Path $resBase -Directory -Filter 'drawable*'
foreach ($sDir in $splashDirs) {
    $splashFile = Join-Path $sDir.FullName 'splash.png'
    if (Test-Path $splashFile) {
        $origSplash = [System.Drawing.Bitmap]::FromFile($splashFile)
        $w = $origSplash.Width
        $h = $origSplash.Height
        $origSplash.Dispose()

        $sp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $sg = [System.Drawing.Graphics]::FromImage($sp)
        $sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $sg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $sg.Clear($darkBg)

        $minDim = [Math]::Min($w, $h) * 0.45
        $aspect = $src.Width / $src.Height
        if ($aspect -gt 1) {
            $sW = [int]$minDim
            $sH = [int]($minDim / $aspect)
        } else {
            $sH = [int]$minDim
            $sW = [int]($minDim * $aspect)
        }
        $sX = [int](($w - $sW) / 2)
        $sY = [int](($h - $sH) / 2)

        $sg.DrawImage($src, $sX, $sY, $sW, $sH)
        $sg.Dispose()
        $sp.Save($splashFile, [System.Drawing.Imaging.ImageFormat]::Png)
        $sp.Dispose()
        Write-Host "Updated splash in $($sDir.Name)"
    }
}

$src.Dispose()
Write-Host "All icons and splash screens generated successfully!"
