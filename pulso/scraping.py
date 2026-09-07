"""Puente sincrono entre el pipeline y el motor de Scrapy."""


def scrapear_medios(medios):
    """Devuelve (items_por_id, errores_por_id, ms_por_id) para una corrida."""
    if not medios:
        return {}, {}, {}

    try:
        from scrapy.crawler import CrawlerProcess
        from scrapy.settings import Settings
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Scrapy no esta instalado; ejecuta `python -m pip install -r requirements.txt`"
        ) from exc

    from . import scrapy_settings
    from .spiders.noticias import NoticiasSpider

    ajustes = Settings()
    ajustes.setmodule(scrapy_settings)
    proceso = CrawlerProcess(settings=ajustes, install_root_handler=False)
    crawler = proceso.create_crawler(NoticiasSpider)
    proceso.crawl(crawler, medios=medios)
    proceso.start(stop_after_crawl=True, install_signal_handlers=False)
    spider = crawler.spider
    return spider.resultados, spider.errores, spider.ms

