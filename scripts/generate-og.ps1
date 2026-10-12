param(
  [string]$OutputPath = (Join-Path $PSScriptRoot "..\site\og.png")
)

# Draws site/og.png, the 1200x630 sharing card, in the Tower WMS house design
# system: the stacked-plate lockup drawn as outlines, the paper/ink/marking-orange
# palette, and a "Company facts" record in the house object style. It is the company
# card, so it carries no interface capture, no plate, no figures and no prices.
#
# Windows only (System.Drawing). Run from the repository root:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-og.ps1
# then run `npm run check` and look at the image before committing it.

Add-Type -AssemblyName System.Drawing

$width = 1200
$height = 630
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$bitmap.SetResolution(96, 96)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$paper = [System.Drawing.ColorTranslator]::FromHtml("#f5f3ed")
$ink = [System.Drawing.ColorTranslator]::FromHtml("#142536")
$inkBody = [System.Drawing.ColorTranslator]::FromHtml("#2b3a47")
$inkMuted = [System.Drawing.ColorTranslator]::FromHtml("#4d5c68")
$orange = [System.Drawing.ColorTranslator]::FromHtml("#c2621f")
$orangeText = [System.Drawing.ColorTranslator]::FromHtml("#9a4a00")
$hairline = [System.Drawing.ColorTranslator]::FromHtml("#dcd5c6")

$paperBrush = New-Object System.Drawing.SolidBrush($paper)
$inkBrush = New-Object System.Drawing.SolidBrush($ink)
$bodyBrush = New-Object System.Drawing.SolidBrush($inkBody)
$mutedBrush = New-Object System.Drawing.SolidBrush($inkMuted)
$orangeBrush = New-Object System.Drawing.SolidBrush($orange)
$orangeTextBrush = New-Object System.Drawing.SolidBrush($orangeText)
$hairlinePen = New-Object System.Drawing.Pen($hairline, 1)
$inkPen = New-Object System.Drawing.Pen($ink, 1)

# Sizes in points on a 96 dpi canvas (1pt = 1.333px): the label 9pt = 12px, the
# record 10pt = 13px, the meta line 10.5pt = 14px, the lede 14pt = 19px, and the
# headline 31pt = 41px, the house card's display size.
$ui = "Segoe UI"
$mono = "Consolas"
$labelFont = New-Object System.Drawing.Font($mono, 9, [System.Drawing.FontStyle]::Bold)
$headlineFont = New-Object System.Drawing.Font($ui, 31, [System.Drawing.FontStyle]::Bold)
$ledeFont = New-Object System.Drawing.Font($ui, 14, [System.Drawing.FontStyle]::Regular)
$recordFont = New-Object System.Drawing.Font($mono, 10, [System.Drawing.FontStyle]::Regular)
$recordBoldFont = New-Object System.Drawing.Font($mono, 10, [System.Drawing.FontStyle]::Bold)
$metaFont = New-Object System.Drawing.Font($ui, 10.5, [System.Drawing.FontStyle]::Regular)

# Typographic metrics, so measured widths are glyph widths rather than GDI+'s padded
# default. MeasureTrailingSpaces keeps a space from measuring as zero.
$tight = [System.Drawing.StringFormat]::GenericTypographic.Clone()
$tight.FormatFlags = $tight.FormatFlags -bor [System.Drawing.StringFormatFlags]::MeasureTrailingSpaces

function Measure-Text([string]$Text, [System.Drawing.Font]$Font) {
  return $graphics.MeasureString($Text, $Font, [System.Drawing.PointF]::Empty, $tight).Width
}

# Tracked caps, as the site's .label (letter-spacing 0.08em): each glyph advances by
# its own width plus the tracking.
function Draw-Tracked([string]$Text, [System.Drawing.Font]$Font, [System.Drawing.Brush]$Brush, [float]$X, [float]$Y) {
  $tracking = $Font.SizeInPoints * 96 / 72 * 0.08
  foreach ($character in $Text.ToCharArray()) {
    $glyph = [string]$character
    $graphics.DrawString($glyph, $Font, $Brush, $X, $Y, $tight)
    $X += (Measure-Text $glyph $Font) + $tracking
  }
  return $X
}

$graphics.Clear($paper)
$graphics.FillRectangle($orangeBrush, 0, 0, $width, 6)

# The lockup: the same outline geometry as the #tower-lockup symbol in site/*.html,
# on the same 664x100 grid. It is drawn, never typeset. Each glyph is its own path,
# as each is its own <path> in the SVG, so the R's leg overlapping its stem cannot
# punch a hole under the alternate fill rule that gives the O and R their counters.
function New-Glyph {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.FillMode = [System.Drawing.Drawing2D.FillMode]::Alternate
  return , $path
}

function Add-Polygon([System.Drawing.Drawing2D.GraphicsPath]$Path, [int[]]$Points) {
  $vertices = for ($i = 0; $i -lt $Points.Length; $i += 2) {
    New-Object System.Drawing.PointF($Points[$i], $Points[$i + 1])
  }
  $Path.AddPolygon([System.Drawing.PointF[]]$vertices)
}

$glyphs = @()

# Stacked-plate mark: three left-aligned bars, widest at the base.
$bars = New-Glyph
$bars.AddRectangle((New-Object System.Drawing.RectangleF(0, 10, 48, 20)))
$bars.AddRectangle((New-Object System.Drawing.RectangleF(0, 40, 72, 20)))
$bars.AddRectangle((New-Object System.Drawing.RectangleF(0, 70, 96, 20)))
$glyphs += $bars

$t = New-Glyph
Add-Polygon $t @(136,0, 220,0, 220,18, 187,18, 187,100, 169,100, 169,18, 136,18)
$glyphs += $t

# O: outer ring and counter; the alternate fill makes the counter a hole.
$o = New-Glyph
$o.AddEllipse((New-Object System.Drawing.RectangleF(240, 0, 92, 100)))
$o.AddEllipse((New-Object System.Drawing.RectangleF(258, 18, 56, 64)))
$glyphs += $o

$w = New-Glyph
Add-Polygon $w @(352,0, 372,0, 386,62, 400,0, 420,0, 434,62, 448,0, 468,0, 444,100, 422,100, 409,44, 396,100, 374,100)
$glyphs += $w

$e = New-Glyph
Add-Polygon $e @(488,0, 566,0, 566,18, 506,18, 506,41, 560,41, 560,59, 506,59, 506,82, 566,82, 566,100, 488,100)
$glyphs += $e

$stem = New-Glyph
$stem.AddRectangle((New-Object System.Drawing.RectangleF(586, 0, 18, 100)))
$glyphs += $stem

# R bowl with its counter, one path as in the SVG.
$bowl = New-Glyph
$bowl.StartFigure()
$bowl.AddLine(604, 0, 630, 0)
$bowl.AddArc(600, 0, 60, 52, -90, 180)
$bowl.AddLine(630, 52, 604, 52)
$bowl.CloseFigure()
$bowl.StartFigure()
$bowl.AddLine(604, 18, 630, 18)
$bowl.AddArc(618, 18, 24, 16, -90, 180)
$bowl.AddLine(630, 34, 604, 34)
$bowl.CloseFigure()
$glyphs += $bowl

$leg = New-Glyph
Add-Polygon $leg @(600,52, 630,52, 664,100, 634,100)
$glyphs += $leg

# Place the 664x100 grid at 0.30 scale, so the lockup is 199x30 at (64, 58).
$lockupTransform = New-Object System.Drawing.Drawing2D.Matrix
$lockupTransform.Translate(64, 58)
$lockupTransform.Scale(0.30, 0.30)
foreach ($glyph in $glyphs) {
  $glyph.Transform($lockupTransform)
  $graphics.FillPath($inkBrush, $glyph)
}

# Left column: label, headline, lede.
[void](Draw-Tracked "THE COMPANY BEHIND TOWER WMS" $labelFont $mutedBrush 64 128)
$graphics.DrawString("Tower Software Systems", $headlineFont, $inkBrush, 62, 194, $tight)
$ledeRect = New-Object System.Drawing.RectangleF(64, 262, 620, 80)
$graphics.DrawString("Warehouse and logistics software for industrial-warehousing brokers.", $ledeFont, $bodyBrush, $ledeRect, $tight)

# Right column: the "Company facts" record, in the house object style: paper ground,
# 1px ink boundary, 4px marking-orange top rule, 24px padding, mono rows with the
# term muted on the left and the value in ink on the right.
$recordLeft = 760
$recordRight = 1136
$recordTop = 194
$padding = 24
$rows = @(
  @("Legal entity", "Moral Support Studios LLC", $false),
  @("Product", "Tower WMS", $false),
  @("Status", "Currently in early access", $true),
  @("Product site", "www.towerwms.com", $false)
)
$rowHeight = 21
$rowGap = 8
$headHeight = 12
$headGap = 16
$recordHeight = 4 + $padding + $headHeight + $headGap + ($rows.Count * $rowHeight) + (($rows.Count - 1) * $rowGap) + $padding
$graphics.FillRectangle($paperBrush, $recordLeft, $recordTop, ($recordRight - $recordLeft), $recordHeight)
$graphics.DrawRectangle($inkPen, $recordLeft, $recordTop, ($recordRight - $recordLeft - 1), ($recordHeight - 1))
$graphics.FillRectangle($orangeBrush, $recordLeft, $recordTop, ($recordRight - $recordLeft), 4)

$y = $recordTop + 4 + $padding
[void](Draw-Tracked "COMPANY FACTS" $labelFont $inkBrush ($recordLeft + $padding) $y)
$y += $headHeight + $headGap
foreach ($row in $rows) {
  $term = $row[0]
  $value = $row[1]
  $isStatus = $row[2]
  $valueFont = if ($isStatus) { $recordBoldFont } else { $recordFont }
  $valueBrush = if ($isStatus) { $orangeTextBrush } else { $inkBrush }
  $graphics.DrawString($term, $recordFont, $mutedBrush, ($recordLeft + $padding), ($y + 2), $tight)
  $valueWidth = Measure-Text $value $valueFont
  $graphics.DrawString($value, $valueFont, $valueBrush, ($recordRight - $padding - $valueWidth), ($y + 2), $tight)
  $y += $rowHeight + $rowGap
}

# Bottom row: the one hairline, the company address, the site's own host.
$graphics.DrawLine($hairlinePen, 64, 548, 1136, 548)
$graphics.DrawString("hello@towersoftwaresystems.com", $metaFont, $mutedBrush, 64, 570, $tight)
$siteHost = "towersoftwaresystems.com"
$siteHostWidth = Measure-Text $siteHost $metaFont
$graphics.DrawString($siteHost, $metaFont, $mutedBrush, (1136 - $siteHostWidth), 570, $tight)

$outputDirectory = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

$bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

foreach ($glyph in $glyphs) { $glyph.Dispose() }
$lockupTransform.Dispose()
$tight.Dispose()
$inkPen.Dispose()
$hairlinePen.Dispose()
$orangeTextBrush.Dispose()
$orangeBrush.Dispose()
$mutedBrush.Dispose()
$bodyBrush.Dispose()
$inkBrush.Dispose()
$paperBrush.Dispose()
$metaFont.Dispose()
$recordBoldFont.Dispose()
$recordFont.Dispose()
$ledeFont.Dispose()
$headlineFont.Dispose()
$labelFont.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Output "Generated $OutputPath ($width x $height)"
