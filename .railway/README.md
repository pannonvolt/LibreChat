# LibreChat + OpenRouter telepítés Railway-re

A `docker-compose.yml` Dockerhez/Coolifyhoz készült. A Railway Compose-importtal is képes szolgáltatásokat és volume-okat előkészíteni, de nem minden Compose-beállítást támogat; az importált forrásokat, változókat és hálózatot ellenőrizni kell. A teljes Railway környezetet az itt található `railway.ts` definiálja, a Railway CLI Infrastructure as Code funkciójával.

## Szolgáltatások

- **LibreChat**: a saját `pannonvolt/LibreChat` fork forráskódjából épül a `Dockerfile.railway` segítségével. A `librechat.yaml` a képfájl része; nem kell külön Raw URL.
- **mongodb**: hitelesített MongoDB, a beszélgetések és felhasználók tárolására.
- **meilisearch**: keresés a beszélgetésekben.
- **vectordb**: PostgreSQL 16 + pgvector.
- **rag-api**: helyi HuggingFace embedding modell, külön OpenAI-kulcs nélkül.
- **admin-panel**: a fork jelenlegi verziójának adminfelülete, külön szolgáltatásként.

Öt tartós volume őrzi az adatokat, feltöltéseket és modellcache-t. Az adatbázisok és a RAG belső hálózaton érhetők el. Az OpenRouter a beszélgetésekért tokenhasználat szerint számláz; a helyi embedding a Railway erőforrásait használja. A szolgáltatáslista nem ad automatikusan Code Interpreter futtatókörnyezetet vagy fizetős kereső API-kulcsot.

## Előkészítés

Node.js 22 vagy újabb és a legfrissebb Railway CLI szükséges (IaC minimum CLI 5.42.1). Windows PowerShellben is használhatók a következő parancsok:

```sh
npm install -g @railway/cli
git clone https://github.com/pannonvolt/LibreChat.git
cd LibreChat
npm --prefix .railway install
node .railway/setup.mjs
railway login
railway init
```

A `railway init` paranccsal **új, üres projektet** hozz létre, ne egy már adatokat tartalmazó template-projektet válassz. Meglévő projekt használata előtt az IaC tulajdonlását és a teljes erőforráslistát külön felül kell vizsgálni.

A Railway projekt **Shared Variables** részén hozz létre egy `OPENROUTER_KEY` változót a saját kulcsoddal. A `railway.ts` ennek a hivatkozását használja, a kulcsot nem olvassa GitHubból. Engedélyezd a Railway GitHub App számára a fork elérését.

## A teljes környezet létrehozása

```sh
railway config plan
railway config apply
```

A tervben hat szolgáltatás és öt volume létrehozását ellenőrizd. Az apply kér megerősítést a tervhez. A konfiguráció nem fut le automatikusan egy szokásos „Deploy from GitHub” műveletkor; a `config apply` hozza létre a teljes projektet. Ha az alkalmazás forráscsatolása után nincs aktív deploy, indítsd el a LibreChat szolgáltatás Deploy/Redeploy műveletét a Railway felületén.

A **LibreChat → Settings → Networking → Generate Domain** részen generálj publikus címet a **3080** portra. A DOMAIN_CLIENT és DOMAIN_SERVER ezt a Railway-domaint hivatkozza; a domain létrehozása után alkalmazd a változtatásokat / indíts új deployt, ha szükséges.

Várd meg, míg a RAG letölti az embedding modellt és minden szükséges szolgáltatás elindul. Nyisd meg a LibreChat címét, regisztrálj, válaszd az **OpenRouter** endpointot és egy modellt.

Ezután a `railway.ts` fájlban az `ALLOW_REGISTRATION` értékét írd át `'false'`-ra, majd futtasd újra a plan/apply parancsokat. Ha csak a Railway felületen állítod át, egy későbbi IaC apply visszaállíthatja a fájlban megadott értéket.

Az adminfelülethez külön generálhatsz domaint az **admin-panel** szolgáltatás **3000** portjára; az infrastruktúra szolgáltatásokhoz ne generálj publikus domaint.

## Titkos kulcsok és mentések

A setup egyszer generálja a szükséges kulcsokat a `.railway/secrets.json` fájlba, és újabb futtatáskor megtartja őket. Ez és a Dockerhez készült `.env.openrouter` gitignore alatt áll. Ne töltsd fel őket GitHubra. Őrizd meg titkos biztonsági mentésben: elvesztésük és újragenerálásuk megváltoztatná az adatbázis-jelszavakat és a tárolt API-kulcsok titkosítását.

A GitHub forkban nincsenek éles API-kulcsok vagy jelszavak. Az IaC plan tartalmazhat titkos értékeket, ezért a kimenetét ne másold nyilvános helyre.

## Docker / Coolify

```sh
node .railway/setup.mjs
```

A `.env.openrouter` fájlban töltsd ki az `OPENROUTER_KEY` értékét, majd:

```sh
docker compose --env-file .env.openrouter config --quiet
docker compose --env-file .env.openrouter up -d --build
```

Chat: `http://localhost:3080`. Admin: `http://localhost:3000` (csak loopbackre kötve). Más hosztnév esetén a DOMAIN_CLIENT és DOMAIN_SERVER értékét is módosítsd. A feltöltések a `librechat-data` volume-ban maradnak. A `down -v` törölné a volume-okat és az adatokat.

## Ellenőrzés és korlátok

A konfiguráció szintaxisa és a Railway SDK-val való kompatibilitása ellenőrizhető helyben. Teljes Docker-build és Railway-telepítés szükséges a futás végső igazolásához. A fork főágának újabb kódja épül, míg a RAG verziója v0.8.0; egy későbbi upstream frissítésnél a kompatibilitást újra ellenőrizni kell. Az adminfelület upstream jelenleg `latest` képet használ.

Hivatalos útmutatók:
- https://docs.railway.com/infrastructure-as-code
- https://docs.railway.com/infrastructure-as-code/reference
- https://www.librechat.ai/docs/configuration/librechat_yaml/ai_endpoints/openrouter

## Coolify: telepítés helyi előkészítés nélkül

Új Git-alapú alkalmazás: `https://github.com/pannonvolt/LibreChat.git`, ág `main`, build pack Docker Compose, base directory `/`, Compose location `/docker-compose.coolify.yml`. Normál (nem Raw) Compose módot használj.

A Coolify a `SERVICE_HEX_*` változókból automatikusan generálja és megőrzi az adatbázis-jelszavakat és a megfelelő hosszúságú hexadecimális titkosítási kulcsokat. A `SERVICE_URL_API_3080` a chat domaint és belső 3080-as proxyportot adja. A szükséges kézi változó: `OPENROUTER_KEY`, a saját OpenRouter-kulcsod.

Mentés után ellenőrizd a generált változókat és az `api` szolgáltatás domainjét, majd Deploy. A DOMAIN_CLIENT és DOMAIN_SERVER ugyanazt a generált URL-t használja. Saját domain esetén a SERVICE_URL_API_3080 értékét is az alkalmazás tényleges nyilvános URL-jére állítsd. Az admin-panel külön domain nélkül belső szolgáltatás marad; szükség esetén rendelj hozzá domaint a 3000-as belső porton.

Regisztráció után állítsd az ALLOW_REGISTRATION változót false-ra és deployolj újra. A kulcsokhoz és volume-okhoz a Coolify mentéseit használd. Ezt a Coolify-specifikus Compose fájlt ne futtasd közvetlen Docker Compose-szal vagy Railway-importtal: a SERVICE_HEX és SERVICE_URL értékek generálását a Coolify végzi. Régebbi Coolify-verzióban a Git-alapú magic változók támogatása hiányozhat; ilyen esetben frissítés vagy kézi változómegadás szükséges.
