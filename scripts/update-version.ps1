# Get the commit message from git
$commitMessage = git log -1 --pretty=%B

# Read the current version
$versionFile = "src/version.json"
$versionContent = Get-Content $versionFile | ConvertFrom-Json
$currentVersion = $versionContent.version

# Split version into components
$versionParts = $currentVersion.Split('.')
$major = [int]$versionParts[0]
$minor = [int]$versionParts[1]
$patch = [int]$versionParts[2]

# Determine version increment based on commit message
if ($commitMessage -match "BREAKING CHANGE|!:") {
    # Major version bump
    $major++
    $minor = 0
    $patch = 0
} elseif ($commitMessage -match "feat:|feature:") {
    # Minor version bump
    $minor++
    $patch = 0
} else {
    # Patch version bump
    $patch++
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
