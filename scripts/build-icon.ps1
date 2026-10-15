Add-Type -AssemblyName System.Drawing
$assetDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) 'assets'
New-Item -ItemType Directory -Path $assetDirectory -Force | Out-Null
$bitmap = New-Object System.Drawing.Bitmap(256, 256)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)
$shape = New-Object System.Drawing.Drawing2D.GraphicsPath
$shape.AddArc(8,8,80,80,180,90)
$shape.AddArc(168,8,80,80,270,90)
$shape.AddArc(168,168,80,80,0,90)
$shape.AddArc(8,168,80,80,90,90)
$shape.CloseFigure()
$backgroundBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#176b55'))
$graphics.FillPath($backgroundBrush, $shape)
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 9)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$points = [System.Drawing.PointF[]]@(
  [System.Drawing.PointF]::new(57,121),[System.Drawing.PointF]::new(98,103),
  [System.Drawing.PointF]::new(151,121),[System.Drawing.PointF]::new(197,103),
  [System.Drawing.PointF]::new(197,190),[System.Drawing.PointF]::new(151,207),
  [System.Drawing.PointF]::new(98,189),[System.Drawing.PointF]::new(57,207),
  [System.Drawing.PointF]::new(57,121))
$graphics.DrawLines($pen,$points)
$graphics.DrawLine($pen,98,145,98,189)
$graphics.DrawLine($pen,151,157,151,207)
$pinPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$pinPath.AddArc(94,46,68,68,180,180)
$pinPath.AddBezier(162,80,162,102,128,133,128,133)
$pinPath.AddBezier(128,133,128,133,94,102,94,80)
$pinPath.CloseFigure()
$graphics.FillPath($backgroundBrush,$pinPath)
$graphics.DrawPath($pen,$pinPath)
$graphics.DrawEllipse($pen,118,69,20,20)
$pngPath = Join-Path $assetDirectory 'reparto.png'
$bitmap.Save($pngPath,[System.Drawing.Imaging.ImageFormat]::Png)
$pngBytes = [System.IO.File]::ReadAllBytes($pngPath)
$stream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($stream)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
$writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
$writer.Write([uint16]1); $writer.Write([uint16]32)
$writer.Write([uint32]$pngBytes.Length); $writer.Write([uint32]22)
$writer.Write($pngBytes)
[System.IO.File]::WriteAllBytes((Join-Path $assetDirectory 'reparto.ico'),$stream.ToArray())
$writer.Dispose(); $stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose(); $pen.Dispose(); $backgroundBrush.Dispose(); $shape.Dispose(); $pinPath.Dispose()
