# Lookup script: read manual-lookup.csv, query DuckDuckGo HTML, extract candidate URLs, write small-apply-generated.csv
param(
    [string]$InputCsv = "manual-lookup.csv",
    [string]$OutCsv = "small-apply-generated.csv",
    [int]$Max = 10
)

$rows = Import-Csv $InputCsv | Select-Object -First $Max
$out = @()
$blacklist = @('facebook.com','twitter.com','instagram.com','tripadvisor.com','yelp.com','google.com','bing.com','duckduckgo.com','wikipedia.org','yellowpages')

function IsBlacklisted($uri){
    try{ $h = ([uri]$uri).Host.ToLower() } catch { return $true }
    foreach($b in $blacklist){ if($h -like "*${b}*") { return $true } }
    return $false
}

foreach($r in $rows){
    $q = [uri]::EscapeDataString((($r.query) + ' Sydney'))
    $searchUrl = "https://duckduckgo.com/html?q=$q"
    Write-Host "Querying:" $r.id "->" $r.query
    try{
        $resp = Invoke-WebRequest -Uri $searchUrl -UseBasicParsing -Headers @{ 'User-Agent' = 'student-discounts-bot/1.0' } -ErrorAction Stop
        $html = $resp.Content
    } catch {
        Write-Warning "Fetch failed for $($r.id): $_"
        $html = ''
    }
    $found = $null
    if($html){
        # Prefer links extracted by Invoke-WebRequest
        $links = @()
        try{ $links = @($resp.Links | ForEach-Object { $_.href } ) } catch {}
        # look for uddg redirect link first
        $uddg = $links | Where-Object { $_ -and ($_ -match 'uddg=') } | Select-Object -First 1
        if($uddg){
            try{ $found = [uri]::UnescapeDataString(($uddg -split 'uddg=')[1]) } catch {}
        }
        if(-not $found){
            # fallback to first https link from the page that's not blacklisted
            foreach($u in $links){
                if(-not $u) { continue }
                $clean = $u -replace '&amp;','&'
                if($clean -like 'http*' -and -not (IsBlacklisted $clean)) { $found = $clean; break }
            }
        }
    }
    if($found){
        Write-Host "Found:" $found
        $out += [pscustomobject]@{ id = $r.id; new_link = $found }
    } else {
        Write-Host "No candidate for" $r.id
    }
    Start-Sleep -Milliseconds 700
}

if($out.Count -gt 0){
    $out | Select-Object id,new_link | Export-Csv $OutCsv -NoTypeInformation -Encoding UTF8
    Write-Host "Wrote" $OutCsv "rows=" $out.Count
} else {
    Write-Host "No mappings found; no output written."
}

# If we produced mappings, run the apply script to update deals.json
if(Test-Path $OutCsv){
    Write-Host "Applying" $OutCsv "to deals.json (this will create a backup)..."
    node .\tools\apply_links_csv.js $OutCsv
}
