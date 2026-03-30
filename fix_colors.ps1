$files = @(
    "components\UserManager.tsx",
    "components\SupportTicketManager.tsx",
    "components\KnowledgeBase.tsx",
    "components\Dashboard.tsx",
    "components\ExcelImportModal.tsx",
    "components\PpmCalculator.tsx",
    "App.tsx"
)

foreach ($f in $files) {
    $path = Join-Path "d:\PycharmProjects\techsupport-pro---equipment-management-system" $f
    if (Test-Path $path) {
        $content = [System.IO.File]::ReadAllText($path)
        $content = $content.Replace("[primary]", "primary")
        [System.IO.File]::WriteAllText($path, $content)
        Write-Host "Fixed: $f"
    }
}
Write-Host "Done."
