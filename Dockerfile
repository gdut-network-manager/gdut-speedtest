FROM registry.gdut.edu.cn/docker/library/php:7.4-apache

# Argument
ARG IMAGE_CREATED=1970-01-01T00:00:00Z
ARG IMAGE_VERSION=0.0.0
ARG IMAGE_REVISION=1

# Install extensions
RUN echo '# 默认注释了源码镜像以提高 apt update 速度，如有需要可自行取消注释 \n\
    deb http://mirrors.gdut.edu.cn/debian/ bullseye main contrib non-free \n\
    deb-src https://mirrors.gdut.edu.cn/debian/ bullseye main contrib non-free \n\
    deb http://mirrors.gdut.edu.cn/debian/ bullseye-updates main contrib non-free \n\
    deb-src https://mirrors.gdut.edu.cn/debian/ bullseye-updates main contrib non-free \n\
    # 以下安全更新软件源包含了官方源与镜像站配置，如有需要可自行修改注释切换 \n\
    #deb http://security.debian.org/debian-security bullseye-security main contrib non-free \n\
    #deb-src http://security.debian.org/debian-security bullseye-security main contrib non-free \n\
    ' | tee /etc/apt/sources.list \
    && apt-get update && apt-get install -y \
        libfreetype6-dev \
        libjpeg62-turbo-dev \
        libpng-dev \
    && docker-php-ext-install -j$(nproc) iconv \
    && docker-php-ext-configure gd --with-freetype=/usr/include/ --with-jpeg=/usr/include/ \
    && docker-php-ext-install -j$(nproc) gd

# Prepare files and folders

RUN mkdir -p /speedtest/

# Copy sources

COPY backend/ /speedtest/backend
COPY chartjs/ /speedtest/chartjs
COPY echarts/ /speedtest/echarts
COPY leaflet/ /speedtest/leaflet

COPY *.js /speedtest/
COPY *.html /speedtest/
COPY .htaccess /speedtest/.htaccess

COPY docker/entrypoint.sh /

ENV TIME_ZONE=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TIME_ZONE /etc/localtime && echo $TIME_ZONE > /etc/timezone
RUN printf '[PHP]\ndate.timezone = "Asia/Shanghai"\n' > /usr/local/etc/php/conf.d/tzone.ini

# Prepare environment variabiles defaults

ENV WEBPORT=80
ENV MAX_LOG_COUNT=1000
ENV IP_SERVICE="ip.sb"
ENV SAME_IP_MULTI_LOGS="false"
ENV TITLE="广东工业大学测速网站"
ENV IPINFO_APIKEY=""
ENV RATE_LIMIT_ENABLED="true"
ENV RATE_LIMIT_REPORT_PER_MINUTE=5
ENV RATE_LIMIT_SPEEDTEST_PER_MINUTE=300

VOLUME ["/speedlogs"]

# Final touches

EXPOSE 80
CMD ["bash", "/entrypoint.sh"]

# Create labels
LABEL org.opencontainers.image.created="${IMAGE_CREATED}" \
  org.opencontainers.image.authors="gregPerlinLi" \
  org.opencontainers.image.url="https://git.gdutnic.com/gregPerlinLi/gdutnic-speedtest-x" \
  org.opencontainers.image.documentation="https://git.gdutnic.com/gregPerlinLi/gdutnic-speedtest-x/-/blob/master/README.md" \
  org.opencontainers.image.source="https://git.gdutnic.com/gregPerlinLi/gdutnic-speedtest-x" \
  org.opencontainers.image.version="${IMAGE_VERSION}" \
  org.opencontainers.image.revision="${IMAGE_REVISION}" \
  org.opencontainers.image.vendor="gregPerlinLi" \
  org.opencontainers.image.licenses="LGPL-2.1" \
  org.opencontainers.image.title="广东工业大学测速网站" \
  org.opencontainers.image.description="本仓库为网管队测速网站项目，为 LibreSpeed 的延伸项目，LibreSpeed 是一个非常轻巧的网站测速工具。"
