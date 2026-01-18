$deviceManager = New-Object -ComObject WIA.DeviceManager
$devices = @()

foreach ($deviceInfo in $deviceManager.DeviceInfos) {
    $device = @{
        id = $deviceInfo.DeviceID
        name = $deviceInfo.Properties.Item('Name').Value
        type = $deviceInfo.Type
    }
    $devices += $device
}

$devices | ConvertTo-Json -Compress