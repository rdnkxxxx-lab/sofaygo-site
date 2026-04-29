$port = 3000
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".gif"  = "image/gif"
  ".webp" = "image/webp"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
$listener.Start()

Write-Host ""
Write-Host "  SoFaygo dev server running" -ForegroundColor Cyan
Write-Host "  --> http://localhost:$port/sofaygo.html" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

Start-Process "http://localhost:$port/sofaygo.html"

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()

    # Read request
    $buf = New-Object byte[] 4096
    $read = $stream.Read($buf, 0, $buf.Length)
    $request = [System.Text.Encoding]::UTF8.GetString($buf, 0, $read)

    # Parse path from first line
    $firstLine = ($request -split "`r`n")[0]
    $urlPath = ($firstLine -split " ")[1]
    if ($urlPath -eq "/" -or $urlPath -eq "") { $urlPath = "/sofaygo.html" }
    # Strip query string
    $urlPath = $urlPath.Split("?")[0]

    $filePath = Join-Path $root ($urlPath.TrimStart("/").Replace("/", "\"))

    $writer = [System.IO.StreamWriter]::new($stream)
    $writer.NewLine = "`r`n"
    $writer.AutoFlush = $false

    if (Test-Path $filePath -PathType Leaf) {
      $ext         = [System.IO.Path]::GetExtension($filePath).ToLower()
      $contentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
      $bytes       = [System.IO.File]::ReadAllBytes($filePath)

      $writer.WriteLine("HTTP/1.1 200 OK")
      $writer.WriteLine("Content-Type: $contentType")
      $writer.WriteLine("Content-Length: $($bytes.Length)")
      $writer.WriteLine("Connection: close")
      $writer.WriteLine("")
      $writer.Flush()
      $stream.Write($bytes, 0, $bytes.Length)

      Write-Host "  200  $urlPath" -ForegroundColor DarkGray
    } else {
      $body  = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
      $writer.WriteLine("HTTP/1.1 404 Not Found")
      $writer.WriteLine("Content-Type: text/plain")
      $writer.WriteLine("Content-Length: $($body.Length)")
      $writer.WriteLine("Connection: close")
      $writer.WriteLine("")
      $writer.Flush()
      $stream.Write($body, 0, $body.Length)

      Write-Host "  404  $urlPath" -ForegroundColor Yellow
    }

    $stream.Flush()
    $client.Close()
  }
} finally {
  $listener.Stop()
  Write-Host "`n  Server stopped." -ForegroundColor DarkGray
}
