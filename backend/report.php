<?php

require_once "./SleekDB/SleekDB.php";
require_once "./config.php";

function maskLastSegment($ip) {
    $ipaddr = inet_pton($ip);
    if (strlen($ipaddr) == 4) {
        $ipaddr[3] = chr(0);
    } elseif (strlen($ipaddr) == 16) {
        $ipaddr[14] = chr(0);
        $ipaddr[15] = chr(0);
    } else {
        return "";
    }
    return rtrim(inet_ntop($ipaddr),"0")."*";
}

$store = \SleekDB\SleekDB::store('speedlogs', './',[
    'auto_cache' => false,
    'timeout' => 120
]);

// LibreSpeed CLI sends ispinfo/dl/ul instead of ip/isp/addr/dspeed/uspeed
$isCliRequest = isset($_POST['ispinfo']) && !isset($_POST['dspeed']);

if ($isCliRequest) {
    $ispInfo = json_decode($_POST['ispinfo'], true);
    $processedString = is_array($ispInfo) && isset($ispInfo['processedString']) ? $ispInfo['processedString'] : '';

    // processedString format: "IP - ISP - Country,Region,City"
    $parts = explode(' - ', $processedString, 3);
    $ip = isset($parts[0]) ? trim($parts[0]) : '';
    $isp = isset($parts[1]) ? trim($parts[1]) : 'Unknown';
    $addr = isset($parts[2]) ? trim($parts[2]) : '';

    // Extract lat/lon from rawIspInfo inside ispinfo JSON
    $rawIspInfo = is_array($ispInfo) && isset($ispInfo['rawIspInfo']) ? $ispInfo['rawIspInfo'] : null;
    $lat = '';
    $lon = '';
    if (is_array($rawIspInfo)) {
        if (isset($rawIspInfo['latitude'])) {           // ip.sb
            $lat = $rawIspInfo['latitude'];
            $lon = $rawIspInfo['longitude'];
        } elseif (isset($rawIspInfo['lat'])) {           // ip-api.com
            $lat = $rawIspInfo['lat'];
            $lon = $rawIspInfo['lon'];
        } elseif (!empty($rawIspInfo['loc'])) {          // ipinfo.io
            $locParts = explode(',', $rawIspInfo['loc']);
            if (count($locParts) === 2) {
                $lat = $locParts[0];
                $lon = $locParts[1];
            }
        }
    }

    $reportData = [
        'key' => sha1($ip),
        'ip' => $ip,
        'isp' => $isp,
        'addr' => $addr,
        'dspeed' => (double) (isset($_POST['dl']) ? $_POST['dl'] : 0),
        'uspeed' => (double) (isset($_POST['ul']) ? $_POST['ul'] : 0),
        'ping' => (double) (isset($_POST['ping']) ? $_POST['ping'] : 0),
        'jitter' => (double) (isset($_POST['jitter']) ? $_POST['jitter'] : 0),
        'lat' => $lat,
        'lon' => $lon,
        'created' => date('Y-m-d H:i:s', time()),
    ];
} else {
    $reportData = [
        "key" => sha1(filter_var($_POST['key'], FILTER_SANITIZE_STRING)),
        "ip" => filter_var($_POST['ip'], FILTER_SANITIZE_STRING),
        "isp" => filter_var($_POST['isp'], FILTER_SANITIZE_STRING),
        "addr" => filter_var($_POST['addr'], FILTER_SANITIZE_STRING),
        "dspeed" => (double) filter_var($_POST['dspeed'], FILTER_SANITIZE_STRING),
        "uspeed" => (double) filter_var($_POST['uspeed'], FILTER_SANITIZE_STRING),
        "ping" => (double) filter_var($_POST['ping'], FILTER_SANITIZE_STRING),
        "jitter" => (double) filter_var($_POST['jitter'], FILTER_SANITIZE_STRING),
        "lat" => isset($_POST['lat']) ? $_POST['lat'] : '',
        "lon" => isset($_POST['lon']) ? $_POST['lon'] : '',
        "created" => date('Y-m-d H:i:s', time()),
    ];
}

if (empty($reportData['ip'])) exit;

if (SAME_IP_MULTI_LOGS) {
    $oldLog = $store->where('key', '=', $reportData['key'])->fetch();
} else {
    $oldLog = $store->where('ip', '=', $reportData['ip'])->orderBy( 'desc', '_id' )->fetch();
}

$recordId = 0;

if (is_array($oldLog) && empty($oldLog)) {
     $results = $store->insert($reportData);
     $recordId = $results['_id'];
     if ($results['_id'] > MAX_LOG_COUNT) {
         $store->where('_id', '=', $results['_id'] - MAX_LOG_COUNT)->delete();
     }
} else {
    $id = $oldLog[0]['_id'];
    if (SAME_IP_MULTI_LOGS) {
        $key = $reportData['key'];
        unset($reportData['key']);
        $store->where('_id', '=', $id)->update($reportData);
    } else {
        $ip = $reportData['ip'];
        unset($reportData['ip']);
        $store->where('_id', '=', $id)->update($reportData);
    }
    $recordId = $id;
}

// LibreSpeed CLI expects "id <number>" response for share link
if ($isCliRequest) {
    echo 'id ' . $recordId;
}
