param(
  [string]$SitemapUrl = 'https://chinosan.com/sitemap-index.xml',
  [string]$HostName = 'chinosan.com',
  [string]$Key = '4a17e6b09da0450eae59bc412dbe34cb',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$endpoint = 'https://api.indexnow.org/IndexNow'
$keyLocation = "https://$HostName/$Key.txt"

function Get-SitemapUrls {
  param([string]$Url)

  $response = Invoke-WebRequest -UseBasicParsing -Uri $Url
  [xml]$sitemap = $response.Content

  if ($null -ne $sitemap.sitemapindex) {
    foreach ($childSitemap in $sitemap.sitemapindex.sitemap) {
      Get-SitemapUrls -Url ([string]$childSitemap.loc)
    }
    return
  }

  if ($null -eq $sitemap.urlset) {
    throw "Unsupported sitemap format: $Url"
  }

  foreach ($entry in $sitemap.urlset.url) {
    [string]$entry.loc
  }
}

$urls = @(
  Get-SitemapUrls -Url $SitemapUrl |
    Where-Object {
      $uri = [System.Uri]$_
      $uri.Scheme -eq 'https' -and $uri.Host -eq $HostName
    } |
    Sort-Object -Unique
)

if ($urls.Count -eq 0) {
  throw "No URLs for $HostName were found in $SitemapUrl"
}

if ($urls.Count -gt 10000) {
  throw "IndexNow accepts at most 10,000 URLs per request; found $($urls.Count)."
}

$payload = @{
  host = $HostName
  key = $Key
  keyLocation = $keyLocation
  urlList = $urls
} | ConvertTo-Json -Depth 3

Write-Host "Found $($urls.Count) URLs for $HostName."

if ($DryRun) {
  Write-Host 'Dry run: no request was sent.'
  $payload
  return
}

$response = Invoke-WebRequest `
  -UseBasicParsing `
  -Method Post `
  -Uri $endpoint `
  -ContentType 'application/json; charset=utf-8' `
  -Body $payload

if ($response.StatusCode -eq 200) {
  Write-Host 'IndexNow submission succeeded (HTTP 200).'
} elseif ($response.StatusCode -eq 202) {
  Write-Warning 'IndexNow received the URLs, but key validation is still pending (HTTP 202).'
} else {
  Write-Warning "IndexNow returned HTTP $($response.StatusCode)."
}
