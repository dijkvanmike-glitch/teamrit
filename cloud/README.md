# JO14-1: onafhankelijke cloudbrowserproef

Doel: exact de openbare KNHB-websiteclient in een schone GitHub-runner laten draaien en uitsluitend de gestructureerde HockeyWeerelt-teamresponse uitlezen. Geen HTML-scraping, cookies/login van de Mac, API-handtekeningen kopiëren of browserprofielen uploaden.

Concept-PR #11, branch codex/jo14-cloud-agent. Niet samengevoegd of live gezet. Ubuntu24.04 en Playwright1.58.2. Logs bevatten alleen aantallen/IDs bij succes, of status en headerNAMEN bij fout. Geen headers met waarden, HAR, cookies, persoonsgegevens of response-dumps.

22 nov 2026: eerste run45057275044 liep vóór websitelezing vast op de nieuwere ubuntu-latest-runner. Hersteld met expliciete ubuntu-24.04. Run45057349918 bereikte de website en de team-API, maar kreeg HTTP401. Vervolgproef45057502764 wacht op een geslaagde GET, zodat een initiële 401/OPTIONS niet onterecht als definitieve fout wordt behandeld.

Dit is een bronproef, geen werkende synchronisatie. Geen productie-writepad of periodieke cloudcontrole activeren zonder geslaagde bronproef. De bestaande organisatiegegevens worden niet gelezen of geschreven. Maandag/donderdag09:00 blijft het gewenste schema; bestaande lokale automation is niet gewijzigd.

Uitslag vervolgproef45057502764: daadwerkelijke GET401, gevolgd door website-eigen GET429. De x-hapi-authorization/signature/timestamp/version-headerNAMEN zijn aanwezig; geen waarden bekeken/opgeslagen. Na60sec geen HTTP200. Dit bewijst dat enkel dezelfde website naar een schone GitHub-browser verplaatsen nog geen werkende bronroute oplevert. Oorzaak van401/429 niet vastgesteld (niet als bewezen IP-blokkade benoemen). Verdere automatische bronproeven uitgezet; workflow alleen handmatig, geen periodieke cloud-sync of production-writepad. Respecteer de providerlimiet.
