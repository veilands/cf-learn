# Read the current version
$versionFile = "src/version.json"
$versionContent = Get-Content $versionFile | ConvertFrom-Json
$currentVersion = $versionContent.version

# Split version into components
$versionParts = $currentVersion.Split('.')
$major = [int]$versionParts[0]
$minor = [int]$versionParts[1]
$patch = [int]$versionParts[2]

# Increment minor version
$newVersion = "$major.$($minor + 1).$patch"

# Update version.json
$newContent = @{
    version = $newVersion
} | ConvertTo-Json

Set-Content $versionFile $newContent

# Add the updated version file to git
git add $versionFile
