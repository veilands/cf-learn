# Get the commit message from git
$commitMessage = git log -1 HEAD --pretty=%B

# Read the current version
$versionFile = "src/version.json"
$versionContent = Get-Content $versionFile | ConvertFrom-Json
$currentVersion = $versionContent.version

# Split version into components
$versionParts = $currentVersion.Split('.')
$major = [int]$versionParts[0]
$minor = [int]$versionParts[1]
$patch = [int]$versionParts[2]

Write-Host "Analyzing commit message: $commitMessage"

# Determine version increment based on commit message
if ($commitMessage -match "^feat!:" -or $commitMessage -match "BREAKING CHANGE:") {
    # Major version bump
    $major++
    $minor = 0
    $patch = 0
    Write-Host "Breaking change detected - bumping major version"
} elseif ($commitMessage -match "^feat(\(.*\))?:" -or $commitMessage -match "^feature(\(.*\))?:") {
    # Minor version bump
    $minor++
    $patch = 0
    Write-Host "New feature detected - bumping minor version"
} else {
    # Patch version bump
    $patch++
    Write-Host "Patch update detected - bumping patch version"
}

# Create new version string
$newVersion = "$major.$minor.$patch"

# Update version.json
$newContent = @{
    version = $newVersion
} | ConvertTo-Json

Set-Content $versionFile $newContent

# Add the updated version file to git
git add $versionFile

Write-Host "Version updated from $currentVersion to $newVersion"
