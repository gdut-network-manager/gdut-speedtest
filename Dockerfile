FROM docker.m.ixdev.cn/library/php:7.4-apache

# Argument
ARG IMAGE_CREATED=1970-01-01T00:00:00Z
ARG IMAGE_VERSION=0.0.0
ARG IMAGE_REVISION=1

# Install extensions
RUN apt-get update && apt-get install -y \
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
COPY font/ /speedtest/font

COPY *.js /speedtest/
COPY *.html /speedtest/

COPY docker/entrypoint.sh /

ENV TIME_ZONE=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TIME_ZONE /etc/localtime && echo $TIME_ZONE > /etc/timezone
RUN printf '[PHP]\ndate.timezone = "Asia/Shanghai"\n' > /usr/local/etc/php/conf.d/tzone.ini

# Prepare environment variabiles defaults

ENV WEBPORT=80
ENV MAX_LOG_COUNT=100
ENV IP_SERVICE="ip.sb"
ENV SAME_IP_MULTI_LOGS="false"
ENV TITLE="GDUTNIC 测速网站"

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
  org.opencontainers.image.licenses="MIT" \
  org.opencontainers.image.title="GDUTNIC SpeedTest X" \
  org.opencontainers.image.description="本仓库为网管队测速网站项目，为 LibreSpeed 的延伸项目，LibreSpeed 是一个非常轻巧的网站测速工具。"
