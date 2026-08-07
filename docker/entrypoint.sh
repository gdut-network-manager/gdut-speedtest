#!/bin/bash

set -e
set -x

# Cleanup
#rm -rf /var/www/html/*

# Copy frontend files
cp -n /speedtest/*.js /var/www/html/
cp -n /speedtest/*.html /var/www/html/
cp -n /speedtest/.htaccess /var/www/html/.htaccess

cp -n -r /speedtest/backend/ /var/www/html/backend
cp -n -r /speedtest/chartjs/ /var/www/html/chartjs
cp -n -r /speedtest/echarts/ /var/www/html/echarts
cp -n -r /speedtest/leaflet/ /var/www/html/leaflet

ln -snf /var/www/html/backend/speedlogs /speedlogs

chown -R www-data /var/www/html/*

# Allow selection of Apache port for network_mode: host
if [ "$WEBPORT" != "80" ]; then
  sed -i "s/^Listen 80\$/Listen $WEBPORT/g" /etc/apache2/ports.conf
  sed -i "s/*:80>/*:$WEBPORT>/g" /etc/apache2/sites-available/000-default.conf
fi

if [ "$MAX_LOG_COUNT" != "100" ]; then
  sed -i "s/^const MAX_LOG_COUNT = 100/const MAX_LOG_COUNT = $MAX_LOG_COUNT/g" /var/www/html/backend/config.php
fi

if [ "$IP_SERVICE" != "ip.sb" ]; then
  sed -i "s/^const IP_SERVICE = 'ip.sb'/const IP_SERVICE = '$IP_SERVICE'/g" /var/www/html/backend/config.php
fi

if [ "$SAME_IP_MULTI_LOGS" != "false" ]; then
  sed -i "s/^const SAME_IP_MULTI_LOGS = false/const SAME_IP_MULTI_LOGS = $SAME_IP_MULTI_LOGS/g" /var/www/html/backend/config.php
fi

if [ -n "$IPINFO_APIKEY" ]; then
  sed -i "s/^const IPINFO_APIKEY = ''/const IPINFO_APIKEY = '$IPINFO_APIKEY'/g" /var/www/html/backend/config.php
fi

if [ "$TITLE" != "广东工业大学测速网站" ]; then
  sed -i "s/广东工业大学测速网站/$TITLE/g" /var/www/html/index.html
  sed -i "s/广东工业大学测速网站/$TITLE/g" /var/www/html/results.html
fi

echo "Done, Starting APACHE"

# This runs apache
apache2-foreground
