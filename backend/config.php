<?php

/**
 * 最多保存多少条测试记录
 */
const MAX_LOG_COUNT = 1000;

/**
 * IP运营商解析服务：(1) ip.sb | (2) ipinfo.io （如果1解析ip异常，请切换成2）
 */
const IP_SERVICE = 'ip.sb';

/**
 * 是否允许同一IP记录多条测速结果
 */
const SAME_IP_MULTI_LOGS = true;

/**
 * ipinfo.io API Key（如使用 ipinfo.io 且有付费计划，填入此处；留空则使用免费版）
 */
const IPINFO_APIKEY = '';

/**
 * 是否启用接口限流（防止恶意批量伪造测速记录、刷流量）
 */
const RATE_LIMIT_ENABLED = true;

/**
 * 报告接口（report.php）每个 IP 每分钟最多允许提交的次数
 */
const RATE_LIMIT_REPORT_PER_MINUTE = 5;

/**
 * 测速接口（garbage.php / empty.php / getIP.php）每个 IP 每分钟最多允许请求的次数
 * 注意：一次完整测速会多次请求 garbage.php 和 empty.php，建议设置较高值
 */
const RATE_LIMIT_SPEEDTEST_PER_MINUTE = 300;
