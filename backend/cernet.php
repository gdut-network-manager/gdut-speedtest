<?php

define('CERNET_RANGES_FILE', __DIR__ . '/cernet_ranges.php');
define('CERNET_WHOIS_CACHE_FILE', __DIR__ . '/cernet_whois_cache.php');
define('CERNIC_WHOIS_URL', 'https://web.nic.edu.cn/member-cgi/otherobj?query=');

function cernetCityEn($city)
{
    static $map = [
        '广州' => 'Guangzhou', '佛山' => 'Foshan', '深圳' => 'Shenzhen',
        '珠海' => 'Zhuhai', '汕头' => 'Shantou', '湛江' => 'Zhanjiang',
        '茂名' => 'Maoming', '肇庆' => 'Zhaoqing', '惠州' => 'Huizhou',
        '梅州' => 'Meizhou', '汕尾' => 'Shanwei', '河源' => 'Heyuan',
        '阳江' => 'Yangjiang', '清远' => 'Qingyuan', '韶关' => 'Shaoguan',
        '东莞' => 'Dongguan', '中山' => 'Zhongshan', '潮州' => 'Chaozhou',
        '揭阳' => 'Jieyang', '江门' => 'Jiangmen',
    ];
    return isset($map[$city]) ? $map[$city] : $city;
}

function ipInRange($ip, $range)
{
    if (strpos($range, '/') === false) {
        return $ip === $range;
    }
    list($subnet, $bits) = explode('/', $range);
    $ipBin = @inet_pton($ip);
    $subnetBin = @inet_pton($subnet);
    if ($ipBin === false || $subnetBin === false) {
        return false;
    }
    $maxBits = strlen($ipBin) * 8;
    if ($bits < 0 || $bits > $maxBits) {
        return false;
    }
    if (strlen($ipBin) !== strlen($subnetBin)) {
        return false;
    }
    if ($bits === 0) {
        return true;
    }
    $fullBytes = intdiv($bits, 8);
    $remBits = $bits % 8;
    if (substr($ipBin, 0, $fullBytes) !== substr($subnetBin, 0, $fullBytes)) {
        return false;
    }
    if ($remBits === 0) {
        return true;
    }
    $mask = 0xFF << (8 - $remBits) & 0xFF;
    return (ord($ipBin[$fullBytes]) & $mask) === (ord($subnetBin[$fullBytes]) & $mask);
}

function loadCernetConfig()
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }
    if (!file_exists(CERNET_RANGES_FILE)) {
        return $config = ['ranges' => [], 'prefixes' => []];
    }
    $data = require CERNET_RANGES_FILE;
    if (!is_array($data)) {
        return $config = ['ranges' => [], 'prefixes' => []];
    }
    return $config = [
        'ranges' => isset($data['ranges']) && is_array($data['ranges']) ? $data['ranges'] : [],
        'prefixes' => isset($data['prefixes']) && is_array($data['prefixes']) ? $data['prefixes'] : [],
    ];
}

function findLocalRange($ip)
{
    $config = loadCernetConfig();
    foreach ($config['ranges'] as $entry) {
        if (isset($entry['range']) && ipInRange($ip, $entry['range'])) {
            return [
                'isp' => isset($entry['name']) ? $entry['name'] : '中国教育网',
                'country' => 'China',
                'region' => 'Guangdong',
                'city' => isset($entry['city']) ? cernetCityEn($entry['city']) : '',
                'lat' => isset($entry['lat']) ? (string) $entry['lat'] : '',
                'lon' => isset($entry['lon']) ? (string) $entry['lon'] : '',
            ];
        }
    }
    return null;
}

function isCernetIp($ip)
{
    foreach (loadCernetConfig()['prefixes'] as $prefix) {
        if (ipInRange($ip, $prefix)) {
            return true;
        }
    }
    return false;
}

function queryCernicWhois($ip)
{
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        if (file_exists(CERNET_WHOIS_CACHE_FILE)) {
            $cached = require CERNET_WHOIS_CACHE_FILE;
            if (is_array($cached)) {
                $cache = $cached;
            }
        }
    }

    if (isset($cache[$ip])) {
        return $cache[$ip];
    }

    $ctx = stream_context_create(['http' => ['timeout' => 8]]);
    $raw = @file_get_contents(CERNIC_WHOIS_URL . urlencode($ip), false, $ctx);
    if ($raw === false) {
        return null;
    }
    $html = @iconv('GB2312', 'UTF-8//IGNORE', $raw);
    if ($html === false) {
        return null;
    }

    if (strpos($html, '没有找到') !== false || strpos($html, 'No match') !== false) {
        return $cache[$ip] = ['miss' => true];
    }

    $result = ['miss' => false];
    if (preg_match('/netname:\s*(.+)/i', $html, $m)) {
        $result['netname'] = trim($m[1]);
    }
    if (preg_match_all('/descr:\s*(.+)/i', $html, $m)) {
        $result['isp'] = trim($m[1][0]);
        $last = trim(end($m[1]));
        if (preg_match('/^(.+?),(.+?)(?:\s+Province)?$/u', $last, $cm)) {
            $result['city'] = preg_replace('/\s+\d{6}$/', '', trim($cm[1]));
            $region = trim(str_replace(' Province', '', $cm[2]));
            $result['region'] = preg_replace('/\s+Prov\.?$/', '', $region);
        }
    }
    if (!isset($result['isp']) && isset($result['netname'])) {
        $result['isp'] = $result['netname'];
    }
    if (!isset($result['isp'])) {
        return null;
    }
    $result['country'] = 'China';

    $cache[$ip] = $result;
    $export = "<?php\n\nreturn " . var_export($cache, true) . ";\n";
    @file_put_contents(CERNET_WHOIS_CACHE_FILE, $export, LOCK_EX);
    return $result;
}

function cernetLookup($ip)
{
    if (!filter_var($ip, FILTER_VALIDATE_IP)) {
        return null;
    }

    $local = findLocalRange($ip);
    if ($local !== null) {
        return $local;
    }

    if (!isCernetIp($ip)) {
        return null;
    }

    $whois = queryCernicWhois($ip);
    if ($whois === null || $whois['miss']) {
        return null;
    }

    return [
        'isp' => $whois['isp'],
        'country' => 'China',
        'region' => isset($whois['region']) && $whois['region'] !== '' && strcasecmp($whois['region'], 'China') !== 0 ? $whois['region'] : '',
        'city' => isset($whois['city']) ? $whois['city'] : '',
        'lat' => '',
        'lon' => '',
    ];
}
