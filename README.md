# TeamRit — mobiel wedstrijdbeheer

## Gebruik

Open `/admin.html` op de TeamRit-site. Voer de beheercode in, kies een bestaande wedstrijd of tik op **Wedstrijd toevoegen**, vul de gegevens in en sla op. Datum, thuis/uit en tegenstander zijn verplicht. Lege wedstrijdtijd wordt **Tijd volgt**. Verzamelen is optioneel; zonder expliciete waarde blijft de oorspronkelijke berekening gelden als er een reistijd bekend is. Veldinformatie kan bij locatie of notitie.

De code blijft alleen in het geheugen van de geopende pagina. Na afsluiten of vernieuwen moet opnieuw worden ingelogd. Bewaar de code bij voorkeur in een wachtwoordmanager. Er is geen verwijderfunctie en geen compleet CMS.

## Eenmalige activering

1. Voer `supabase/migrations/20261018_matches.sql` uit in de **bestaande** Supabase-database. Dit voegt alleen `matches` toe en wijzigt geen oudergegevens of reacties.
2. Voeg in Netlify, project `wfhc-teamrit`, geheime servervariabelen toe:
   - `TEAMRIT_ADMIN_CODE`: een willekeurige geheime code van minimaal 20 tekens; geen korte pincode.
   - `SUPABASE_SERVICE_ROLE_KEY`: bestaande Supabase service-role sleutel. Alleen voor Functions, nooit in browsercode, Git of deze documentatie zetten.
   - Bestaande `SUPABASE_URL` en `SUPABASE_ANON_KEY` behouden.
3. Publiceer via de bestaande GitHub → Netlify-route. Variabelen toevoegen/wijzigen vereist opnieuw deployen.
4. Open `/admin.html`, sla een bestaande wedstrijd op en controleer de hoofdsite. Controleer ook dat een wijziging zonder beheercode 401 geeft, en direct schrijven met de anon-sleutel door Supabase wordt geweigerd.

De beheer-API weigert wijzigingen zolang bovenstaande geheimen ontbreken. Ook previewdeploys kunnen met dezelfde Supabase-database verbinden: stel de service-role sleutel en beheercode alleen voor de productiecontext in. Doe experimentele browsertests met `tests/serve.mjs`.

## Opslag en behoud van data

`matches-seed.json` bevat alle oorspronkelijke activiteiten plus de vijf najaarswedstrijden. Bestaande IDs (`a1`, `m0` t/m `m12`) blijven gelijk. Supabase bewaart alleen nieuwe wedstrijden en wijzigingen per ID. Nieuwe IDs worden eenmaal gegenereerd met `crypto.randomUUID()`. Het wijzigen van datum of tegenstander verandert nooit het ID. Reacties, fruit, coachstatus en bestaande rij-indelingen blijven aan hetzelfde ID gekoppeld.

`GET /api/matches` combineert seed en opslag. `PUT /api/admin/matches` schrijft precies één wedstrijd met controle van het versienummer. Een verouderde opslag of dubbele retry geeft 409 in plaats van onopgemerkt overschrijven. Als de database onbereikbaar is, toont de hoofdsite de seed met een zichtbare waarschuwing dat wijzigingen kunnen ontbreken. Beheer gebruikt bij storingen geen oude gegevens om op te slaan.

## Beveiliging en grenzen

- Servercontrole van een lange gedeelde beheercode; geen geheimen in URL, localStorage of frontend.
- Supabase RLS staat alleen lezen met de anon-sleutel toe. Alleen de server kan schrijven.
- Netlify begrenst beheer tot 20 verzoeken per minuut per IP/domein.
- Velden worden op de server gevalideerd en bij HTML-weergave ge-escaped.
- De beheerpagina heeft een strikte Content Security Policy en wordt niet geïndexeerd.
- Een gedeelde code heeft geen persoonlijke auditlog, rollen of MFA. Voor deze kleine pilot is dat bewust buiten scope. Wie de code heeft kan wedstrijden wijzigen; bij verlies: code in Netlify vervangen en opnieuw deployen.
- De service-role sleutel heeft brede databaserechten. Beperk hem tot productie-Functions; log of deel hem niet. De bestaande ouder-, fruit- en coach-API's zijn ongewijzigd en hebben hun bestaande toegangsmodel.
- Supabase Free kan bij inactiviteit pauzeren. Bewaak dit tijdens de pilot; deze wijziging voegt geen abonnement toe.

## Verificatie

Node 24: `node --test tests/matches.test.mjs`.

De tests controleren de afgesproken wedstrijden, validatie, HTML-escaping, auth, conflicten, dubbele retries, seedbehoud, vaste IDs, storingsgedrag en verzameltijden zonder reistijdberekening. De bestaande reactiefuncties worden niet gewijzigd. De geautomatiseerde reactietest bewijst dat de wedstrijd-API uitsluitend `matches` aanroept; productiebehoud moet aanvullend met een voor/na-vergelijking worden gecontroleerd.

Voor geïsoleerd testen in de browser: `node tests/serve.mjs`, open `http://localhost:8766/admin.html`, code `local-test-only-code-12345`. Dit is uitsluitend een lokale testcode. De server gebruikt tijdelijke data in geheugen en maakt geen verbinding met Supabase. Stop de server na de test.

## Automatische verzameltijd

Nieuwe wedstrijden gebruiken standaard **Automatisch berekenen**. Thuis: één uur voor de wedstrijd. Uit: wedstrijdtijd min 45 minuten en de naar boven afgeronde autorijtijd; vervolgens verzameltijd naar beneden afronden op vijf minuten. Vertrekpunt is WFHC, Roskam 6, Zwaag. Vul een Nederlands adres in met straat, huisnummer en plaats; veldinformatie hoort bij Notitie.

PDOK controleert het adres; OSRM/FOSSGIS berekent de autoroute op OpenStreetMap-data. De schatting houdt geen rekening met actuele of voorspelde files. De dienst is geschikt voor het lage volume van deze pilot, heeft geen beschikbaarheidsgarantie en begrenst routes tot één aanvraag per seconde voor de hele site. Er is geen extra account of sleutel nodig. Bij storingen of een onduidelijk adres blijft automatische opslag geblokkeerd totdat de route is berekend, of je kiest **Handmatig instellen**. Lege wedstrijdtijd/adres geeft **Verzameltijd volgt**. Alleen het clubadres en routecoördinaten gaan naar de externe diensten; geen oudergegevens of beheercode.

Een bestaande expliciete verzameltijd blijft handmatig; kies zelf Automatisch berekenen om die om te zetten. Een automatische tijd wordt opnieuw berekend als wedstrijdtijd, thuis/uit of adres verandert. Herladen gebruikt de opgeslagen schatting. De server berekent de verzameltijd opnieuw uit tijd en reistijd; handmatig ingestelde afspraken blijven voorgaan. Dit verandert geen wedstrijd-ID of ouderreactie.

Alle controles: `node --test tests/*.test.mjs`.

## Rijders en reserves

Bij meer dan vier rij-aanmeldingen voor een uitwedstrijd kiest TeamRit vier gezinnen met de minste eerdere rij-opgaven bij uitwedstrijden vóór die wedstrijddatum. Bij gelijk aantal gaat de oudste laatste rij-opgave voor, daarna sorteert TeamRit op een vaste gezinscode. Twee gekoppelde ouders tellen als één gezin. Alleen wie nu **Ja** opgeeft, is kandidaat. Overige aangemelde ouders staan met naam als **Reserve** op de wedstrijdkaart en in het teamoverzicht. Tot en met vier aanmeldingen rijdt iedereen die Ja heeft opgegeven.

Dit is een verdeling op basis van bereidheid om te rijden, geen registratie van werkelijk gereden ritten. Nieuwe of gewijzigde aanmeldingen kunnen de voorlopige indeling veranderen. Bestaande handmatige indelingen (zoals Waterland) gaan voor; een afgemelde ingedeelde chauffeur wordt daar niet ongemerkt vervangen. Bij onbereikbare historie verschijnt geen verzonnen eerlijke indeling. De functie leest eerdere reacties en verandert geen ouderreacties of opgeslagen rij-indelingen.

## Binnen 48 uur

Na de beheerlogin toont de sectie **Binnen 48 uur** alleen wedstrijden met openstaande punten: geen fruitouder, minder dan vier beschikbare auto's bij uitwedstrijden, of gezinnen zonder reactie. Gekoppelde ouders tellen als één gezin; een reactie Nee telt ook als reactie. De bestaande `/api/overview` en `/api/fruit` worden uitsluitend gelezen. Er verandert niets aan reacties of coachgegevens.

De controle vernieuwt elke minuut zolang de beheerpagina zichtbaar is, bij terugkeer naar de pagina, na opslaan en via **Waarschuwingen vernieuwen**. Dit is een controle in de geopende beheerpagina, geen achtergrondmelding. Tijden worden geïnterpreteerd in Europe/Amsterdam. Bij onbekende wedstrijdtijd telt een wedstrijddag mee zodra die het komende 48-uursvenster raakt. Een fout bij het ophalen wordt expliciet getoond; onbekende status wordt niet als geregeld beschouwd.

**Maak WhatsApp-reminder** bereidt een bewerkbaar bericht met wedstrijdgegevens, openstaande punten en de publieke TeamRit-link voor. Pas na klikken op **Open WhatsApp met dit bericht** opent WhatsApp; de beheerder kiest zelf ontvangers en verstuurt zelf. Er wordt niets automatisch verzonden en geen coach ingeschakeld.

## Twee afzonderlijke omgevingen, één codebasis

Productkeuze: twee Netlify-sites vanuit dezelfde repository en dezelfde bronmap `teamrit`, met elk een eigen Supabase-project. Dit vervangt het eerdere voorstel om beide teams nu al binnen één database te beheren. Voor twee pilots geeft dit scheiding zonder een nieuw rechtenmodel te bouwen. Een teamkeuze in de browser kan nooit de andere database selecteren.

`netlify.toml` bouwt met `node scripts/build.mjs`, publiceert uitsluitend `dist/public` en bundelt Functions uit `dist/netlify/functions`. De build vereist een expliciete `TEAMRIT_ENVIRONMENT`; een ontbrekende of onbekende waarde stopt de build.

| Instelling | Bestaande hockeysite | Nieuwe zaalvoetbalsite |
|---|---|---|
| TEAMRIT_ENVIRONMENT | hockey | zaalvoetbal |
| SUPABASE_URL | Bestaande database | Nieuw, afzonderlijk Supabase-project |
| SUPABASE_ANON_KEY | Bestaande sleutel | Sleutel van nieuwe database |
| SUPABASE_SERVICE_ROLE_KEY | Bestaande geheime sleutel | Geheime sleutel van nieuwe database |
| TEAMRIT_ADMIN_CODE | Bestaande code | Eigen code van minimaal 20 tekens |

Gebruik geen hockeydatabase of hockeygeheimen voor zaalvoetbal, ook niet tijdelijk. Houd geheime waarden buiten de repository en beperk schrijfsleutels tot de productiecontext. Afzonderlijke deployments betekenen niet dat verkeerde database-instellingen automatisch worden herkend: controleer vóór activering dat de Supabase-projectadressen daadwerkelijk verschillen.

Beide sites kunnen onafhankelijk worden gedeployed en teruggezet. Koppeling aan dezelfde branch met automatische publicatie kan wel beide sites tegelijk laten bouwen; schakel automatische publicatie per site uit als iedere release bewust apart moet worden vrijgegeven. Er zijn geen twee bronversies nodig.

### Voorbereide instellingen

- `environments/hockey.json` bewaart de bestaande identiteit, fruitfunctie, wedstrijden en het vertrekpunt.
- `environments/zaalvoetbal.json` gebruikt voorlopig de naam Zaalvoetbal en een neutraal TeamRit-logo. Later hier naam en lokaal logobestand wijzigen; daarna alleen de zaalvoetbalsite opnieuw bouwen.
- Zaalvoetbal begint met een leeg wedstrijdprogramma. Hockeywedstrijden worden ook bij een storing niet als terugval gebruikt.
- Fruithap is voor zaalvoetbal uitgeschakeld in de deelnemerspagina, overzichten, beheerwaarschuwingen en de server-API. De fruit-API retourneert 404 zonder de database te benaderen.
- Het zaalvoetbalvertrekpunt is onbekend. Nieuwe wedstrijden gebruiken handmatig verzamelen; routeberekening weigert een aanvraag zolang `routeOrigin` null is. Vul later de eigen lengtegraad,breedtegraad in. De overige bestaande plannings- en vervoerregels blijven behouden.

### Nog nodig voor livegang

Deze wijziging maakt lokaal beide builds mogelijk en wijzigt geen bestaande cloudomgeving. Maak voor zaalvoetbal een aparte Netlify-site en Supabase-database aan. Het volledige oorspronkelijke databaseschema van `parents`, `responses`, `coach_status` en eventuele andere bestaande tabellen staat niet in deze bronmap. Haal daarom eerst een schema-export inclusief toegangsregels uit de bestaande database, zonder persoonsgegevens, en controleer die voor de nieuwe database. De aanwezige migratie maakt alleen `matches` aan en is geen volledige database-installatie. Voeg vervolgens uitsluitend de zaalvoetballeden toe.

Controleer vóór publicatie: beide sites tonen uitsluitend hun eigen leden en wedstrijden; een wijziging via de ene site raakt de andere database niet; beheer werkt met de eigen code; hockey houdt fruit; zaalvoetbal heeft geen fruitmeldingen en `/api/fruit` geeft 404. De lokale tests vervangen deze controle van de cloudconfiguratie niet.

Lokaal bouwen: `TEAMRIT_ENVIRONMENT=hockey node scripts/build.mjs` of `TEAMRIT_ENVIRONMENT=zaalvoetbal node scripts/build.mjs`. `dist` is gegenereerde uitvoer en hoeft niet in versiebeheer. Alle tests: `node --test tests/*.test.mjs`.
