#include <WiFi.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include "SPIFFS.h"
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>

#define ARDUINOJSON_USE_LONG_LONG 1

#include "AsyncJson.h"
#include "ArduinoJson.h"

String mDNS_hostname;

// TODO: esto debe reemplazarse por el mecanismo de cargar credenciales desde preferencias
const char * wifi_ssid = "Claro_VILLACIS0000299908";
const char * wifi_password = "6432411767344";

bool wifiInit = false;
bool wifiConectado = false;

TimerHandle_t wifiReconnectTimer;

AsyncWebServer server(80);
void setupAsyncServerHTTP(void);

void setupMDNS(String &);
String generarHostnameMAC(void);
void iniciarWifi(void);

void setup()
{
  mDNS_hostname = generarHostnameMAC();

  // La siguiente demora es sólo para comodidad de desarrollo para enchufar el USB
  // y verlo en gtkterm. No es en lo absoluto necesaria como algoritmo requerido.
  delay(3000);
  Serial.begin(115200);

  Serial.println("Inicializando SPIFFS...");
  if (!SPIFFS.begin(true)){
    Serial.println("Ha ocurrido un error al montar SPIFFS");
    return;
  }

  wifiReconnectTimer = xTimerCreate(
    "wifiTimer",
    pdMS_TO_TICKS(2000),
    pdFALSE,
    (void*)0,
    reinterpret_cast<TimerCallbackFunction_t>(iniciarWifi));

  WiFi.onEvent(WiFiEvent);
  iniciarWifi();
}

void loop()
{
}

void iniciarServiciosRed(void);
void WiFiEvent(WiFiEvent_t event)
{
    Serial.printf("[WiFi-event] event: %d\r\n", event);
    switch(event) {
    case SYSTEM_EVENT_STA_GOT_IP:
        wifiConectado = true;

        Serial.println("Conectado al WiFi.");
        Serial.println("Dirección IP: ");
        Serial.println(WiFi.localIP());
        iniciarServiciosRed();
        break;
    case SYSTEM_EVENT_STA_DISCONNECTED:
        wifiConectado = false;

        Serial.println("Se perdió conexión WiFi.");
        xTimerStart(wifiReconnectTimer, 0);
        break;
    }
}

void iniciarWifi(void)
{
  Serial.println("Iniciando conexión a WiFi...");

  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(mDNS_hostname.c_str());
  WiFi.begin(wifi_ssid, wifi_password);
}

void iniciarServiciosRed(void)
{
  if (wifiInit) return;

  setupMDNS(mDNS_hostname);
  setupAsyncServerHTTP();
/*
  // NOTA: este es un bucle bloqueante. Debería implementárselo de otra manera.
  Serial.print("Pidiendo hora de red vía NTP...");
  timeClient.begin();
  while(!timeClient.update()) {
    timeClient.forceUpdate();
    Serial.print(".");
  }
  Serial.print(timeClient.getFormattedTime()); Serial.println(" UTC");
*/
  wifiInit = true;
}

void notFound(AsyncWebServerRequest *request) {
    request->send(404, "text/plain", "Not found");
}

// TODO: mover estas rutinas a bibliotecas separadas
void setupHTTPRoutes_WiFi(AsyncWebServer & srv);

void setupAsyncServerHTTP(void)
{
  server.serveStatic("/", SPIFFS, "/");

  // Rutinas que instalan componentes del api de Yubox Framework
  setupHTTPRoutes_WiFi(server);

  server.onNotFound(notFound);

  server.begin();
}


void routeHandler_yuboxAPI_wificonfig_networks_GET(AsyncWebServerRequest *request);
void routeHandler_yuboxAPI_wificonfig_connection_GET(AsyncWebServerRequest *request);
void routeHandler_yuboxAPI_wificonfig_connection_PUT(AsyncWebServerRequest *request);
void routeHandler_yuboxAPI_wificonfig_connection_DELETE(AsyncWebServerRequest *request);

void setupHTTPRoutes_WiFi(AsyncWebServer & srv)
{
  srv.on("/yubox-api/wificonfig/networks", HTTP_GET, routeHandler_yuboxAPI_wificonfig_networks_GET);
  //srv.on("/yubox-api/wificonfig/connection", HTTP_GET, routeHandler_yuboxAPI_wificonfig_connection_GET);
  //srv.on("/yubox-api/wificonfig/connection", HTTP_PUT, routeHandler_yuboxAPI_wificonfig_connection_PUT);
  //srv.on("/yubox-api/wificonfig/connection", HTTP_DELETE, routeHandler_yuboxAPI_wificonfig_connection_DELETE);
}

void routeHandler_yuboxAPI_wificonfig_networks_GET(AsyncWebServerRequest *request)
{
  AsyncResponseStream *response = request->beginResponseStream("application/json");
  DynamicJsonDocument json_doc(JSON_OBJECT_SIZE(10));

  response->print("[");
  int16_t n = WiFi.scanComplete();
  if (n == WIFI_SCAN_FAILED) {
    WiFi.scanNetworks(true);
  } else if (n > 0) {
    for (int i = 0; i < n; i++) {
      if (i > 0) response->print(",");

      String temp_bssid = WiFi.BSSIDstr(i);
      String temp_ssid = WiFi.SSID(i);

      json_doc["bssid"] = temp_bssid.c_str();
      json_doc["ssid"] = temp_ssid.c_str();
      json_doc["channel"] = WiFi.channel(i);
      json_doc["rssi"] = WiFi.RSSI(i);
      json_doc["authmode"] = (uint8_t)WiFi.encryptionType(i);

      // TODO: actualizar estado de bandera de conexión exitosa
      json_doc["connected"] = false;
      json_doc["connfail"] = false;

      // TODO: asignar clave conocida desde NVRAM si está disponible
      json_doc["psk"] = (char *)NULL;
      json_doc["identity"] = (char *)NULL;
      json_doc["password"] = (char *)NULL;

      serializeJson(json_doc, *response);
    }

    WiFi.scanDelete();
    if (WiFi.scanComplete() == WIFI_SCAN_FAILED) {
      WiFi.scanNetworks(true);
    }
  }

  response->print("]");

  request->send(response);

}

void setupMDNS(String & mdnsHostname)
{
  if (!MDNS.begin(mdnsHostname.c_str())) {
    Serial.println("ERROR: no se puede iniciar mDNS para anunciar hostname!");
    return;
  }
  Serial.print("Iniciando mDNS con nombre de host: ");
  Serial.print(mdnsHostname);
  Serial.println(".local");

  MDNS.addService("http", "tcp", 80);
}

String generarHostnameMAC(void)
{
  byte maccopy[6];
  memset(maccopy, 0, sizeof(maccopy));
  WiFi.macAddress(maccopy);

  String hostname = "YUBOX-";
  for (auto i = 0; i < sizeof(maccopy); i++) {
    String octet = String(maccopy[i], 16);
    octet.toUpperCase();
    hostname += octet;
  }
  return hostname;
}

