<?php

/*
 * This script detects the client's IP address and fetches ISP info from ipinfo.io, ip.sb, or ip-api.com.
 * Output from this script is a JSON string composed of:
 *  - processedString: combined IP, ISP, Country/Region/City, and optional distance.
 *  - rawIspInfo: the raw data from the selected IP service (empty string if disabled or on private IP).
 *
 * Supported services: ip.sb, ipinfo.io, ip-api.com
 */

require_once "./config.php";

error_reporting(0);

define('API_KEY_FILE', 'getIP_ipInfo_apikey.php');
define('SERVER_LOCATION_CACHE_FILE', 'getIP_serverLocation.php');

/**
 * @return string
 */
function getClientIp()
{
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
        $ip = $_SERVER['HTTP_CLIENT_IP'];
    } elseif (!empty($_SERVER['HTTP_X_REAL_IP'])) {
        $ip = $_SERVER['HTTP_X_REAL_IP'];
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ip = preg_replace('/,.*/', '', $_SERVER['HTTP_X_FORWARDED_FOR']); # hosts are comma-separated, client is first
    } else {
        $ip = $_SERVER['REMOTE_ADDR'];
    }
    return preg_replace('/^::ffff:/', '', $ip);
}

/**
 * @param string $ip
 * @return string|null
 */
function getLocalOrPrivateIpInfo($ip)
{
    if ('::1' === $ip) {
        return 'localhost IPv6 access';
    }
    if (stripos($ip, 'fe80:') === 0) {
        return 'link-local IPv6 access';
    }
    if (strpos($ip, '127.') === 0) {
        return 'localhost IPv4 access';
    }
    if (strpos($ip, '10.') === 0) {
        return 'private IPv4 access';
    }
    if (preg_match('/^172\.(1[6-9]|2\d|3[01])\./', $ip)) {
        return 'private IPv4 access';
    }
    if (strpos($ip, '192.168.') === 0) {
        return 'private IPv4 access';
    }
    if (strpos($ip, '169.254.') === 0) {
        return 'link-local IPv4 access';
    }
    return null;
}

/**
 * @return string
 */
function getIpInfoTokenString()
{
    if (!file_exists(API_KEY_FILE)) {
        return '';
    }
    require API_KEY_FILE;
    if (empty($IPINFO_APIKEY)) {
        return '';
    }
    return '?token=' . $IPINFO_APIKEY;
}

/**
 * @param string $ip
 * @param string $ipService
 * @return array|null
 */
function getIspInfo($ip, $ipService)
{
    $json = '';
    switch ($ipService) {
        case 'ip.sb':
            $json = @file_get_contents('https://api.ip.sb/geoip/' . $ip);
            break;
        case 'ipinfo.io':
            $json = @file_get_contents('https://ipinfo.io/' . $ip . '/json' . getIpInfoTokenString());
            break;
        case 'ip-api.com':
            // fetch fields including isp, org, lat, lon, regionName
            $json = @file_get_contents('http://ip-api.com/json/' . $ip . '?fields=status,message,country,regionName,city,zip,lat,lon,isp,org,as');
            break;
    }
    if (!is_string($json)) {
        return null;
    }
    $data = json_decode($json, true);
    if (!is_array($data) || (isset($data['status']) && $data['status'] !== 'success')) {
        return null;
    }
    return $data;
}

/**
 * @param array|null $rawIspInfo
 * @param string     $ipService
 * @return string
 */
function getIsp($rawIspInfo, $ipService)
{
    switch ($ipService) {
        case 'ip.sb':
            return (!empty($rawIspInfo['organization'])) ? $rawIspInfo['organization'] : 'Unknown';
        case 'ipinfo.io':
            if (!empty($rawIspInfo['org'])) {
                return preg_replace('/AS\d+\s/', '', $rawIspInfo['org']);
            }
            return 'Unknown';
        case 'ip-api.com':
            // return (!empty($rawIspInfo['isp'])) ? $rawIspInfo['isp'] : 'Unknown';
            if (!empty($rawIspInfo['as'])) {
                return preg_replace('/AS\d+\s/', '', $rawIspInfo['as']);
            }
            return 'Unknown';
        default:
            return 'Unknown';
    }
}

/**
 * @return string|null
 */
function getServerLocation()
{
    $serverLoc = null;
    if (file_exists(SERVER_LOCATION_CACHE_FILE)) {
        require SERVER_LOCATION_CACHE_FILE;
    }
    if (is_string($serverLoc) && $serverLoc !== '') {
        return $serverLoc;
    }
    $json = @file_get_contents('https://ipinfo.io/json' . getIpInfoTokenString());
    if (!is_string($json)) {
        return null;
    }
    $details = json_decode($json, true);
    if (empty($details['loc'])) {
        return null;
    }
    $serverLoc = $details['loc'];
    $cacheData = "<?php\n\n\$serverLoc = '" . addslashes($serverLoc) . "';\n";
    file_put_contents(SERVER_LOCATION_CACHE_FILE, $cacheData);
    return $serverLoc;
}

/**
 * Optimized algorithm from http://www.codexworld.com
 *
 * @param float $latitudeFrom
 * @param float $longitudeFrom
 * @param float $latitudeTo
 * @param float $longitudeTo
 * @return float [km]
 */
function distance($latitudeFrom, $longitudeFrom, $latitudeTo, $longitudeTo)
{
    $rad = M_PI / 180;
    $theta = $longitudeFrom - $longitudeTo;
    $dist = sin($latitudeFrom * $rad) * sin($latitudeTo * $rad)
        + cos($latitudeFrom * $rad) * cos($latitudeTo * $rad) * cos($theta * $rad);
    return acos($dist) / $rad * 60 * 1.853;
}

/**
 * @param array|null $rawIspInfo
 * @return string|null
 */
function getDistance($rawIspInfo)
{
    if (!is_array($rawIspInfo)
        || !isset($_GET['distance'])
        || !in_array($_GET['distance'], ['mi', 'km'], true)
    ) {
        return null;
    }
    $unit = $_GET['distance'];
    // determine clientLocation string "lat,lon"
    if (IP_SERVICE === 'ipinfo.io' && !empty($rawIspInfo['loc'])) {
        $clientLocation = $rawIspInfo['loc'];
    } elseif (IP_SERVICE === 'ip-api.com' && isset($rawIspInfo['lat'], $rawIspInfo['lon'])) {
        $clientLocation = $rawIspInfo['lat'] . ',' . $rawIspInfo['lon'];
    } else {
        return null;
    }
    $serverLocation = getServerLocation();
    if (!is_string($serverLocation)) {
        return null;
    }
    return calculateDistance($clientLocation, $serverLocation, $unit);
}

/**
 * @param string $clientLocation
 * @param string $serverLocation
 * @param string $unit
 * @return string|null
 */
function calculateDistance($clientLocation, $serverLocation, $unit)
{
    list($clientLat, $clientLon) = explode(',', $clientLocation);
    list($serverLat, $serverLon) = explode(',', $serverLocation);
    $distKm = distance($clientLat, $clientLon, $serverLat, $serverLon);

    if ($unit === 'mi') {
        $dist = round($distKm / 1.609344, -1);
        return (($dist < 15) ? '<15' : $dist) . ' mi';
    }
    // km
    $dist = round($distKm, -1);
    return (($dist < 20) ? '<20' : $dist) . ' km';
}

/**
 * @return void
 */
function sendHeaders()
{
    header('Content-Type: application/json; charset=utf-8');
    if (isset($_GET['cors'])) {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST');
    }
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0, s-maxage=0');
    header('Cache-Control: post-check=0, pre-check=0', false);
    header('Pragma: no-cache');
}

/**
 * @param string      $ip
 * @param string|null $ipInfo
 * @param array|null  $rawIspInfo
 * @return void
 */
function sendResponse($ip, $ipInfo = null, $rawIspInfo = null)
{
    $processedString = $ip;
    if (is_string($ipInfo)) {
        $processedString .= ' - ' . $ipInfo;
    }

    if (is_array($rawIspInfo) && !empty($rawIspInfo['country'])) {
        $region = $rawIspInfo['region'] ?? ($rawIspInfo['regionName'] ?? '');
        $city   = $rawIspInfo['city'] ?? '';
        $processedString .= ' - ' . $rawIspInfo['country'] . ',' . $region . ',' . $city;
    }

    // Normalize lat/lon from different IP services
    $lat = '';
    $lon = '';
    if (is_array($rawIspInfo)) {
        if (isset($rawIspInfo['latitude'])) {           // ip.sb
            $lat = $rawIspInfo['latitude'];
            $lon = $rawIspInfo['longitude'];
        } elseif (isset($rawIspInfo['lat'])) {           // ip-api.com
            $lat = $rawIspInfo['lat'];
            $lon = $rawIspInfo['lon'];
        } elseif (!empty($rawIspInfo['loc'])) {          // ipinfo.io "lat,lon"
            $parts = explode(',', $rawIspInfo['loc']);
            if (count($parts) === 2) {
                $lat = $parts[0];
                $lon = $parts[1];
            }
        }
    }

    sendHeaders();
    echo json_encode([
        'processedString' => $processedString,
        'rawIspInfo'      => $rawIspInfo ?: '',
        'lat'             => $lat,
        'lon'             => $lon,
    ]);
}

// -------------------------------------------------------------------

$ip           = getClientIp();
$localIpInfo  = getLocalOrPrivateIpInfo($ip);
if (is_string($localIpInfo)) {
    sendResponse($ip, $localIpInfo);
    exit;
}

if (!isset($_GET['isp'])) {
    sendResponse($ip);
    exit;
}

$rawIspInfo = getIspInfo($ip, IP_SERVICE);
$isp        = getIsp($rawIspInfo, IP_SERVICE);
//$distance = getDistance($rawIspInfo);

sendResponse($ip, $isp, $rawIspInfo);