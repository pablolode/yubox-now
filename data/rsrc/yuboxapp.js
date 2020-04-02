$(document).ready(function () {
    setupWiFiTab();

    // Mostrar el tab preparado por omisión como activo
    $('ul#yuboxMainTab a.set-active').removeClass('set-active').tab('show');
});

function setupWiFiTab()
{
    var wifipane = $('div#yuboxMainTabContent > div.tab-pane#wifi');
    var data = {
        'wifiscan-template':
            wifipane.find('table#wifiscan > tbody > tr.template')
            .removeClass('template')
            .detach()
    }
    wifipane.data(data);

    // https://getbootstrap.com/docs/4.4/components/navs/#events
    $('ul#yuboxMainTab a#wifi-tab[data-toggle="tab"]').on('shown.bs.tab', function (e) {
/*
        // Información sobre la MAC (y red conectada?)
        $.getJSON(yuboxAPI('wificonfig')+'/info')
        .done(function (data) {
            var wifipane = $('div#yuboxMainTabContent > div.tab-pane#wifi');

            // Mostrar los datos de la configuración actual
            wifipane.find('input#wlanmac').val(data.MAC);
        });
*/
        scanWifiNetworks();
    });

    // Qué hay que hacer al hacer clic en una fila que representa la red
    $('div#yuboxMainTabContent > div.tab-pane#wifi table#wifiscan > tbody').on('click', 'tr', function(e) {
        var net = $(e.currentTarget).data();

        if (net.connected) {
            alert('DEBUG: diálogo para red conectada no implementado!');
        } else {
            var dlg_wificred = $('div#yuboxMainTabContent > div.tab-pane#wifi div#wifi-credentials');
            dlg_wificred.find('h5#wifi-credentials-title').text(net.ssid);
            dlg_wificred.find('input#ssid').val(net.ssid);
            dlg_wificred.find('input#key_mgmt').val(wifiauth_desc(net.authmode));
            dlg_wificred.find('input#authmode').val(net.authmode);
            dlg_wificred.find('div.form-group.wifi-auth').hide();
            dlg_wificred.find('div.form-group.wifi-auth input').val('');
            dlg_wificred.find('button[name=connect]').prop('disabled', true);
            if (net.authmode == 5) {
                // Autenticación WPA-ENTERPRISE
                dlg_wificred.find('div.form-group.wifi-auth-eap').show();
                dlg_wificred.find('div.form-group.wifi-auth-eap input#identity')
                    .val((net.identity != null) ? net.identity : '');
                dlg_wificred.find('div.form-group.wifi-auth-eap input#password')
                    .val((net.password != null) ? net.password : '')
                    .change();
            } else if (net.authmode > 0) {
                // Autenticación con contraseña
                dlg_wificred.find('div.form-group.wifi-auth-psk').show();
                dlg_wificred.find('div.form-group.wifi-auth-psk input#psk')
                    .val((net.psk != null) ? net.psk : '')
                    .change();
            } else {
                // Red sin autenticación, activar directamente opción de conectar
                dlg_wificred.find('button[name=connect]').prop('disabled', false);
            }
            dlg_wificred.modal({ focus: true });
        }
    });

    // Comportamiento de controles de diálogo de ingresar credenciales red
    var dlg_wificred = $('div#yuboxMainTabContent > div.tab-pane#wifi div#wifi-credentials');
    dlg_wificred.find('div.form-group.wifi-auth-eap input')
        .change(checkValidWifiCred_EAP)
        .keypress(checkValidWifiCred_EAP)
        .blur(checkValidWifiCred_EAP);
    dlg_wificred.find('div.form-group.wifi-auth-psk input')
        .change(checkValidWifiCred_PSK)
        .keypress(checkValidWifiCred_PSK)
        .blur(checkValidWifiCred_PSK);
    dlg_wificred.find('div.modal-footer button[name=connect]').click(function () {
        var dlg_wificred = $('div#yuboxMainTabContent > div.tab-pane#wifi div#wifi-credentials');
        var st = {
            url:    yuboxAPI('wificonfig')+'/connection',
            method: 'PUT',
            data:   {
                ssid:       dlg_wificred.find('input#ssid').val(),
                authmode:   parseInt(dlg_wificred.find('input#authmode').val())
            }
        };
        if ( st.data.authmode == 5 ) {
            // Autenticación WPA-ENTERPRISE
            st.data.identity = dlg_wificred.find('div.form-group.wifi-auth-eap input#identity').val();
            st.data.password = dlg_wificred.find('div.form-group.wifi-auth-eap input#password').val();
        } else if ( st.data.authmode > 0 ) {
            // Autenticación PSK
            st.data.psk = dlg_wificred.find('div.form-group.wifi-auth-psk input#psk').val();
        }
        $.ajax(st)
        .done(function (data) {
            // Credenciales aceptadas, se espera a que se conecte
            dlg_wificred.modal('hide');
        })
        .fail(function (e) {
            var msg;
            if (e.status == 0) {
                msg = 'Fallo al contactar dispositivo';
            } else if (e.responseJSON == undefined) {
                msg = 'Tipo de dato no esperado en respuesta';
            } else {
                msg = e.responseJSON.msg;
            }
            yuboxDlgMostrarAlertText(dlg_wificred.find('div.modal-body'), 'danger', msg, 2000);
        });
    });

/*
"{\"url\":\"/yubox-mockup/wificonfig.php/connection\",\"data\":{\"a\":\"gato\",\"b\":\"perro\"},\"method\":\"PUT\"}"
"{\"method\":\"DELETE\",\"url\":\"/yubox-mockup/wificonfig.php/connection\"}"
$.ajax(st).done(function (data) { console.log('DONE', data); }).fail(function (e) { console.log('FAIL', e); });
*/
}

function checkValidWifiCred_EAP()
{
    // Activar el botón de enviar credenciales si ambos valores son no-vacíos
    var dlg_wificred = $('div#yuboxMainTabContent > div.tab-pane#wifi div#wifi-credentials');
    var numLlenos = dlg_wificred
        .find('div.form-group.wifi-auth-eap input')
        .filter(function() { return ($(this).val() != ''); })
        .length;
    dlg_wificred.find('button[name=connect]').prop('disabled', !(numLlenos >= 2));
}

function checkValidWifiCred_PSK()
{
    // Activar el botón de enviar credenciales si la clave es de al menos 8 caracteres
    var dlg_wificred = $('div#yuboxMainTabContent > div.tab-pane#wifi div#wifi-credentials');
    var psk = dlg_wificred.find('div.form-group.wifi-auth-psk input#psk').val();
    dlg_wificred.find('button[name=connect]').prop('disabled', !(psk.length >= 8));
}

function scanWifiNetworks()
{
    if (!$('ul#yuboxMainTab a#wifi-tab[data-toggle="tab"]').hasClass('active')) {
        // El tab de WIFI ya no está visible, no se hace nada
        return;
    }

    $.get(yuboxAPI('wificonfig')+'/networks')
    .done(function (data) {
        data.sort(function (a, b) {
            if (a.connected || a.connfail) return -1;
            if (b.connected || b.connfail) return 1;
            return b.rssi - a.rssi;
        });

        var wifipane = $('div#yuboxMainTabContent > div.tab-pane#wifi');
        var tbody_wifiscan = wifipane.find('table#wifiscan > tbody');
        tbody_wifiscan.empty();
        data.forEach(function (net) {
            var tr_wifiscan = wifipane.data('wifiscan-template').clone();

            // Mostrar dibujo de intensidad de señal a partir de RSSI
            var svg_wifi = tr_wifiscan.find('td#rssi > svg.wifipower');
            var pwr = rssi2signalpercent(net.rssi);
            svg_wifi.removeClass('at-least-1bar at-least-2bars at-least-3bars at-least-4bars');
            if (pwr >= 80)
                svg_wifi.addClass('at-least-4bars');
            else if (pwr >= 60)
                svg_wifi.addClass('at-least-3bars');
            else if (pwr >= 40)
                svg_wifi.addClass('at-least-2bars');
            else if (pwr >= 20)
                svg_wifi.addClass('at-least-1bar');
            tr_wifiscan.children('td#rssi').attr('title', 'Intensidad de señal: '+pwr+'%');

            // Mostrar candado según si hay o no autenticación para la red
            tr_wifiscan.children('td#ssid').text(net.ssid);
            if (net.connected) {
                var sm_connlabel = $('<small class="form-text text-muted" />').text('Conectado');
                tr_wifiscan.addClass('table-success');
                tr_wifiscan.children('td#ssid').append(sm_connlabel);
            } else if (net.connfail) {
                var sm_connlabel = $('<small class="form-text text-muted" />').text('Ha fallado la conexión');
                tr_wifiscan.addClass('table-danger');
                tr_wifiscan.children('td#ssid').append(sm_connlabel);
            }
            tr_wifiscan.children('td#auth').attr('title',
                'Seguridad: ' + wifiauth_desc(net.authmode));
            tr_wifiscan.find('td#auth > svg.wifiauth > path.'+(net.authmode != 0 ? 'locked' : 'unlocked')).show();

            tr_wifiscan.data(net);
            tbody_wifiscan.append(tr_wifiscan);
        });

        // Volver a escanear redes si el tab sigue activo al recibir respuesta
        if ($('ul#yuboxMainTab a#wifi-tab[data-toggle="tab"]').hasClass('active')) {
            setTimeout(scanWifiNetworks, 5 * 1000);
        }
    });
}

function wifiauth_desc(authmode)
{
    var desc_authmode = [
        '(ninguna)',
        'WEP',
        'WPA-PSK',
        'WPA2-PSK',
        'WPA-WPA2-PSK',
        'WPA2-ENTERPRISE'
    ];

    return (authmode >= 0 && authmode < desc_authmode.length)
        ? desc_authmode[authmode]
        : '(desconocida)';
}

function rssi2signalpercent(rssi)
{
    // El YUBOX ha reportado hasta ahora valores de RSSI de entre -100 hasta 0.
    // Se usa esto para calcular el porcentaje de fuerza de señal
    if (rssi > 0) rssi = 0;
    if (rssi < -100) rssi = -100;
    return rssi + 100;
}

function yuboxAPI(s)
{
    var mockup =  window.location.pathname.startsWith('/yubox-mockup/');
    return mockup
        ? '/yubox-mockup/'+s+'.php'
        : '/yubox-api/'+s;
}

function yuboxMostrarAlertText(alertstyle, text, timeout)
{
    var content = $('<span/>').text(text);
    return yuboxMostrarAlert(alertstyle, content, timeout);
}

function yuboxMostrarAlert(alertstyle, content, timeout)
{
    yuboxDlgMostrarAlert('main > div.container', alertstyle, content, timeout);
}

function yuboxDlgMostrarAlertText(basesel, alertstyle, text, timeout)
{
    var content = $('<span/>').text(text);
    return yuboxDlgMostrarAlert(basesel, alertstyle, content, timeout);
}

function yuboxDlgMostrarAlert(basesel, alertstyle, content, timeout)
{
    var al = $(basesel).children('div.alert.yubox-alert-template')
        .clone()
        .removeClass('yubox-alert-template')
        .addClass('yubox-alert')
        .addClass('alert-'+alertstyle);
    al.find('button.close').before(content);

    $(basesel).children('div.yubox-alert').remove();
    $(basesel).children('div.alert.yubox-alert-template').after(al);
    if (timeout != undefined) {
        setTimeout(function() {
            al.remove();
        }, timeout);
    }
}