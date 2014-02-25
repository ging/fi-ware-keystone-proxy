var TokenDB = require("../db/TokenDB.js").TokenDB,
    TenantMappingDB = require("../db/TenantMappingDB.js").TenantMappingDB,
    config = require("../config.js");

var Endpoints = (function() {
    var temp = config.serviceCatalog;
    var endpoints = [];
    for (var idx in temp) {
        var end = temp[idx];
        var reg = end.endpoints;
        for (var region_idx in reg) {
            var region = reg[region_idx];
            var endpoint = {
                "adminURL":region.adminURL,
                "internalURL":region.internalURL,
                "publicURL":region.publicURL,
                "region":region.region,
                "name":end.name,
                "type":end.type
            };
            endpoints.push(endpoint);
        }
    }

    var pad = function(number, length) {

        var str = '' + number;
        while (str.length < length) {
            str = '0' + str;
        }

        return str;

    };

    var getKeystoneTenant = function (tenantId) {

        if (TenantMappingDB.get(tenantId)) {
            return TenantMappingDB.get(tenantId);
        } else {
            return pad(tenantId, 32);
        }
    };

    var list = function(req, res) {
        console.log('[ENDPOINT LIST] Getting service catalog');
        TokenDB.get(req.headers['x-auth-token'], function (tok) {
            if (tok) {
                TokenDB.get(req.params.token, function (token) {
                    if (token) {
                        var tenantId = getKeystoneTenant(token.tenant);

                        var serviceCatalog = JSON.parse(JSON.stringify(endpoints).replace(/\$\(tenant_id\)s/g, tenantId));
                        res.send(JSON.stringify(serviceCatalog,4,4));
                    } else {
                        console.log('[ENDPOINT LIST] Auth Token not authorized');
                        res.send(401, 'User unathorized');
                    }
                });
            } else {
                console.log('[ENDPOINT LIST] Auth Token not authorized');
                res.send(401, 'User unathorized');
            }
        });
    };
    return {
        list: list
    }
})();

exports.Endpoints = Endpoints;