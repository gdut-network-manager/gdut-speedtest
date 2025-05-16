<?php
header('Content-Type: application/javascript');
// 从环境变量中读取
$ipv4 = getenv('IPV4_URL') ?: '';
$ipv6 = getenv('IPV6_URL') ?: '';
// 输出成 JS 全局变量
echo 'window.IPV4_URL = ' . json_encode($ipv4) . ";\n";
echo 'window.IPV6_URL = ' . json_encode($ipv6) . ";\n";