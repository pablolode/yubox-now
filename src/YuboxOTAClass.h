#ifndef _YUBOX_OTA_CLASS_H_
#define _YUBOX_OTA_CLASS_H_

#include <ESPAsyncWebServer.h>
#include "YuboxWebAuthClass.h"

#include "uzlib/uzlib.h"
extern "C" {
  #include "TinyUntar/untar.h" // https://github.com/dsoprea/TinyUntar
}

typedef enum
{
  OTA_IDLE,           // Código ocioso, o el archivo está siendo ignorado
  OTA_SPIFFS_WRITE,   // Se está escribiendo el archivo a SPIFFS
  OTA_FIRMWARE_FLASH  // Se está escribiendo a flash de firmware
} YuboxOTA_operationWithFile;

class YuboxOTAClass
{
private:
  // Rechazar el resto de los fragmentos de upload si primera revisión falla
  bool _uploadRejected;

  // Datos requeridos para manejar la descompresión gzip
  struct uzlib_uncomp _uzLib_decomp;    // Estructura de descompresión de uzlib
  unsigned char * _gz_srcdata;          // Memoria de búfer de datos comprimidos
  unsigned char * _gz_dstdata;          // Memoria de búfer de datos expandidos
  unsigned char * _gz_dict;             // Diccionario de símbolos gzip
  unsigned long _gz_actualExpandedSize; // Cuenta de bytes ya expandidos de gzip
  bool _gz_headerParsed;                // Bandera de si ya se parseó cabecera

  // Datos requeridos para manejar el parseo tar
  entry_callbacks_t _tarCB;             // Callbacks a llamar en cabecera, datos, final de archivos
  unsigned int _tar_offset;             // Offset al siguiente segmento a ofrecer a biblioteca tar
  unsigned int _tar_emptyChunk;         // Número de bloques de 512 bytes llenos de ceros contiguos
  bool _tar_eof;                        // Bandera de si se llegó a fin normal de tar

  // Descripción de errores posibles al subir el tar.gz
  bool _tgzupload_clientError;
  bool _tgzupload_serverError;
  String _tgzupload_responseMsg;

  // Operación de actualización en sí
  YuboxOTA_operationWithFile _tgzupload_currentOp;
  bool _tgzupload_foundFirmware;

  void _setupHTTPRoutes(AsyncWebServer &);

  void _routeHandler_yuboxAPI_yuboxOTA_tgzupload_POST(AsyncWebServerRequest *);
  void _routeHandler_yuboxAPI_yuboxOTA_tgzupload_handleUpload(AsyncWebServerRequest *,
    String filename, size_t index, uint8_t *data, size_t len, bool final);

  void _handle_tgzOTAchunk(size_t index, uint8_t *data, size_t len, bool final);

  const char * _updater_errstr(uint8_t);

  // Las siguientes funciones son llamadas por la correspondiente friend del mismo nombre
  int _tar_cb_feedFromBuffer(unsigned char *, size_t);
  int _tar_cb_gotEntryHeader(header_translated_t *, int);
  int _tar_cb_gotEntryData(header_translated_t *, int, unsigned char *, int);
  int _tar_cb_gotEntryEnd(header_translated_t *, int);

public:
  YuboxOTAClass(void);
  void begin(AsyncWebServer & srv);

  friend int _tar_cb_feedFromBuffer(unsigned char *, size_t);
  friend int _tar_cb_gotEntryHeader(header_translated_t *, int, void *);
  friend int _tar_cb_gotEntryData(header_translated_t *, int, void *, unsigned char *, int);
  friend int _tar_cb_gotEntryEnd(header_translated_t *, int, void *);
};

extern YuboxOTAClass YuboxOTA;

#endif