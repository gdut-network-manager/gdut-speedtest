<?php

function checkRateLimit(string $scope, int $maxPerMinute): void
{
    if (!RATE_LIMIT_ENABLED) {
        return;
    }

    $clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
    if ($clientIp === '') {
        return;
    }

    $rateLimitDir = __DIR__ . '/rate_limit';
    if (!is_dir($rateLimitDir)) {
        mkdir($rateLimitDir, 0755, true);
    }

    $rateLimitFile = $rateLimitDir . '/' . sha1($clientIp . ':' . $scope) . '.json';
    $now = time();
    $window = 60;

    $data = ['timestamps' => []];
    if (file_exists($rateLimitFile)) {
        $content = @file_get_contents($rateLimitFile);
        if ($content !== false) {
            $decoded = json_decode($content, true);
            if (is_array($decoded) && isset($decoded['timestamps'])) {
                $data = $decoded;
            }
        }
    }

    $data['timestamps'] = array_values(array_filter(
        $data['timestamps'],
        fn($ts) => $now - $ts < $window
    ));

    if (count($data['timestamps']) >= $maxPerMinute) {
        http_response_code(429);
        header('Retry-After: 60');
        exit;
    }

    $data['timestamps'][] = $now;
    file_put_contents($rateLimitFile, json_encode($data), LOCK_EX);
}
