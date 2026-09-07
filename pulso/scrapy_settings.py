"""Configuracion conservadora de Scrapy para las portadas regionales."""

from . import VERSION

BOT_NAME = "pulso_n33"
SPIDER_MODULES = ["pulso.spiders"]
NEWSPIDER_MODULE = "pulso.spiders"

USER_AGENT = "PulsoN33/{} (+https://github.com/arturoreyes-ai/pulso-n33)".format(VERSION)
ROBOTSTXT_OBEY = True
COOKIES_ENABLED = False
TELNETCONSOLE_ENABLED = False

# Una portada por medio y una sola conexion por dominio. El retraso y
# AutoThrottle mantienen la cosecha muy por debajo de una navegacion humana.
CONCURRENT_REQUESTS = 4
CONCURRENT_REQUESTS_PER_DOMAIN = 1
DOWNLOAD_DELAY = 1.0
RANDOMIZE_DOWNLOAD_DELAY = True
DOWNLOAD_TIMEOUT = 25
RETRY_TIMES = 2
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 1.0
AUTOTHROTTLE_MAX_DELAY = 10.0
AUTOTHROTTLE_TARGET_CONCURRENCY = 0.5

FEED_EXPORT_ENCODING = "utf-8"
LOG_LEVEL = "WARNING"

