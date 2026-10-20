# Local completion signal, explicitly requested by the user. No persistence,
# scheduled task or system configuration: Escape anywhere stops the process.
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class CompletionKeys {
    [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);
}
'@
$completionRate = 22050
$completionSamples = [int]($completionRate * 0.32)
$completionStream = New-Object System.IO.MemoryStream
$completionWriter = New-Object System.IO.BinaryWriter($completionStream)
$completionWriter.Write([Text.Encoding]::ASCII.GetBytes('RIFF'))
$completionWriter.Write([int](36 + $completionSamples * 2))
$completionWriter.Write([Text.Encoding]::ASCII.GetBytes('WAVEfmt '))
$completionWriter.Write([int]16)
$completionWriter.Write([int16]1)
$completionWriter.Write([int16]1)
$completionWriter.Write([int]$completionRate)
$completionWriter.Write([int]($completionRate * 2))
$completionWriter.Write([int16]2)
$completionWriter.Write([int16]16)
$completionWriter.Write([Text.Encoding]::ASCII.GetBytes('data'))
$completionWriter.Write([int]($completionSamples * 2))
for ($completionIndex = 0; $completionIndex -lt $completionSamples; $completionIndex++) {
    $completionEnvelope = [Math]::Min(1, [Math]::Min($completionIndex / 200.0, ($completionSamples - $completionIndex) / 400.0))
    $completionFrequency = if ($completionIndex -lt $completionSamples / 2) { 660 } else { 880 }
    $completionValue = [int16](6000 * $completionEnvelope * [Math]::Sin(2 * [Math]::PI * $completionFrequency * $completionIndex / $completionRate))
    $completionWriter.Write($completionValue)
}
$completionWriter.Flush()
$completionStream.Position = 0
$completionPlayer = New-Object System.Media.SoundPlayer($completionStream)
try {
    $completionPlayer.Load()
    while ($true) {
        if (([CompletionKeys]::GetAsyncKeyState(27) -band 0x8000) -ne 0) { break }
        $completionPlayer.Play()
        for ($completionPoll = 0; $completionPoll -lt 20; $completionPoll++) {
            if (([CompletionKeys]::GetAsyncKeyState(27) -band 0x8000) -ne 0) { return }
            Start-Sleep -Milliseconds 100
        }
    }
} finally {
    $completionPlayer.Stop()
    $completionPlayer.Dispose()
    $completionWriter.Dispose()
    $completionStream.Dispose()
}
