var express = require('express'),
    clientAPI = express(),
    adminAPI = express(),
    proxy = require('./HTTPClient.js'),
    xmlParser = require('./xml2json');

var idmHostName = 'idm.lab.fi-ware.eu';

//{token: {access_token: (service_name), tenant: }}
var authDataBase = {};

var parseBody = function(req, res, next) {
    var data='';
    req.setEncoding('utf8');
    req.on('data', function(chunk) {
       data += chunk;
    });

    req.on('end', function() {
        //console.log("Data");
        req.body = data;
        next();
    });
};

var serviceCatalog = [
    {"endpoints":
        [
        {"adminURL": "http://130.206.80.62:8774/v2/$(tenant_id)s",
        "region": "RegionOne",
        "internalURL": "http://130.206.80.62:8774/v2/$(tenant_id)s",
        "publicURL": "http://130.206.80.62:8774/v2/$(tenant_id)s"}
        ],
        "endpoints_links": [],
        "type": "compute",
        "name": "nova"
    },
    {"endpoints":
        [
        {"adminURL": "http://130.206.80.62:9292/v1",
        "region": "RegionOne",
        "internalURL": "http://130.206.80.62:9292/v1",
        "publicURL": "http://130.206.80.62:9292/v1"
        }
        ],
        "endpoints_links": [],
        "type": "image",
        "name": "glance"
    },
    {"endpoints": [
        {"adminURL": "http://130.206.80.62:8776/v1/$(tenant_id)s",
        "region": "RegionOne",
        "internalURL": "http://130.206.80.62:8776/v1/$(tenant_id)s",
        "publicURL": "http://130.206.80.62:8776/v1/$(tenant_id)s"
        }
        ],
        "endpoints_links": [],
        "type": "volume",
        "name": "volume"
    },
    {"endpoints": [
        {"adminURL": "http://130.206.80.62:8080/v1",
        "region": "RegionOne",
        "internalURL": "http://130.206.80.62:8080/v1/AUTH_$(tenant_id)s",
        "publicURL": "http://130.206.80.62:8080/v1/AUTH_$(tenant_id)s"
        }
        ],
        "endpoints_links": [],
        "type": "object-store",
        "name": "swift"
    },
    {"endpoints": [
        {"adminURL": "http://130.206.80.62:35357/v2.0",
        "region": "RegionOne",
        "internalURL": "http://130.206.80.62:5000/v2.0",
        "publicURL": "http://130.206.80.62:5000/v2.0"
        }
        ],
        "endpoints_links": [],
        "type": "identity",
        "name": "keystone"
    }
];

var getCatalogue = function (tenantId) {
    return JSON.parse(JSON.stringify(serviceCatalog).replace(/\$\(tenant_id\)s/g, tenantId));
}

var generateAccessResponse = function (token, tenant, user_id, user_name, roles) {

    return {"access":
            {
            "token":
            {"expires": "2015-07-09T15:16:07Z",
            "id": token,
            "tenant": tenant
            }, 
            "serviceCatalog": getCatalogue(tenant.actorId),
            "user": {
                "username": user_id,
                "roles_links": [],
                "id": user_id,
                "roles": roles,
                "name": user_name
            }
        }
    };
}

var generateAccessResponseForXML = function (token, tenant, user_id, user_name, roles) {

    var newRoles = [];
    for (var r in roles) {
        var nr = {"_name": roles[r].name, "_id": roles[r].id};
        newRoles.push(nr);
    }

    return {"access":
            {
            "_xmlns" : "http://docs.openstack.org/identity/api/v2.0",
            "token":
            {"_expires": "2015-07-09T15:16:07Z",
            "_id": token,
            "tenant": tenant
            }, 
            "serviceCatalog": getCatalogue(tenant.actorId),
            "user": {
                "_username": user_id,
                "roles_links": [],
                "_id": user_id,
                "roles": newRoles,
                "_name": user_name
            }
        }
    };
}

var generateToken = function () {
    return require('crypto').randomBytes(16).toString('hex');
}

var pad = function(number, length) {

    var str = '' + number;
    while (str.length < length) {
        str = '0' + str;
    }

    return str;

}

var getUserData = function (access_token, callback, callbackError) {

    // Llamar al IDM

     var options = {
        host: idmHostName,
        port: 443,
        path: '/user?access_token=' + access_token,
        method: 'GET',
        headers: {}
    };

    proxy.sendData("https", options, undefined, undefined, function (status, resp) {

        var resp1 = JSON.parse(resp);
        console.log("Response from IDM: ", resp);

        for (var orgIdx in resp1.organizations) {
            var org = resp1.organizations[orgIdx];
            org.id = pad(org.id, 32);
            org.name = org.displayName;
        }

        var myOrg = {
               id: pad(resp1.actorId, 32),
               name: resp1.nickName,
               roles: [
                        {"id": "8db87ccbca3b4d1ba4814c3bb0d63aab", "name": "Member"}
                        //{"id": "09e95db0ea3f4495a64e95bfc64b0c55", "name": "admin"}
                    ]
            };

        if (resp1.organizations === undefined) {
            resp1.organizations = [];
        };

        resp1.organizations.push(myOrg);

/*
        resp1.organizations = [
            {
               id: '6571e3422ad84f7d828ce2f30373b3d4',
               name: "FIWARE",
               roles: [
                        {"id": "8db87ccbca3b4d1ba4814c3bb0d63aab", "name": "Member"},
                        {"id": "09e95db0ea3f4495a64e95bfc64b0c55", "name": "admin"}
                    ]
            },
            {
               id: '980ae4606f464bb8bc214999c596b158',
               name: "TESTI",
               roles: [
                        {"id": "8db87ccbca3b4d1ba4814c3bb0d63aab", "name": "Member"}
                    ]
            }
        ];
*/
        callback(status, resp1);

    }, callbackError);

}

var createToken = function () {
    return function(req, res) {
        console.log("[AUTHENTICATION]", req.body);
        var body = JSON.parse(req.body);
        //console.log(JSON.stringify(body, 4, 4));
        if (body.auth.passwordCredentials !== undefined) {

            console.log('[CREDENTIALS AUTH] Checking token for user', body.auth.passwordCredentials.username);

            var token = undefined;

            var tenantId = '96d9611e4b514c2a9804376a899103f1';

            for (var t in authDataBase) {
                if (authDataBase[t].access_token === body.auth.passwordCredentials.username) {
                    token = t;
                    console.log('[CREDENTIALS AUTH] Getting existing token for service', body.auth.passwordCredentials.username, 'token: ', token);
                    break;
                }
            }

            if (!token) {
                token = generateToken();
                console.log('[CREDENTIALS AUTH] Generating new token for service', body.auth.passwordCredentials.username, 'token: ', token);
            }

            // This case the user is admin
            var isAdmin = false;

            if (body.auth.tenantName !== undefined && body.auth.passwordCredentials.username == "admin" && body.auth.passwordCredentials.password == "openstack") {
                tenantId = body.auth.tenantName;
                isAdmin = true;
            }

            var resp =
                {"access":
                    {"token":
                        {"expires": "2015-07-09T15:16:07Z",
                        "id": token,
                        "tenant":
                            {"description": "Service tenant", "enabled": true, "name": "service", "id": tenantId}
                        },
                        "serviceCatalog": getCatalogue(tenantId),
                        "user": {
                            "username": body.auth.passwordCredentials.username,
                            "roles_links": [],
                            "id": "91c72f314d93470b90a7c1ba21d7e352",
                            "roles": [
                                {"id": "8db87ccbca3b4d1ba4814c3bb0d63aaf", "name": "Member"},
                                {"id": "09e95db0ea3f4495a64e95bfc64b0c56", "name": "admin"}
                            ],
                            "name": body.auth.passwordCredentials.username}
                        }
                    };
            authDataBase[token] = {access_token: body.auth.passwordCredentials.username, tenant: tenantId, isAdmin: isAdmin};

            var userInfo = JSON.stringify(resp);
            res.setHeader("Content-Type", "application/json");
            if (req.headers['accept'] === 'application/xml') {

                resp =
                    {"access":
                        {"token":
                            {"_expires": "2015-07-09T15:16:07Z",
                            "_id": token,
                            "tenant":
                                {"_enabled": true, "_name": "service", "_id": tenantId}
                            },
                            "user": {
                                "username": body.auth.passwordCredentials.username,
                                "roles_links": [],
                                "id": "91c72f314d93470b90a7c1ba21d7e352",
                                "roles": [
                                    {"id": "8db87ccbca3b4d1ba4814c3bb0d63aaf", "name": "Member"},
                                    {"id": "09e95db0ea3f4495a64e95bfc64b0c56", "name": "admin"}
                                ],
                                "name": body.auth.passwordCredentials.username}
                            }
                        };


                userInfo = xmlParser.json2xml_str(resp);
                res.setHeader("Content-Type", "application/xml");
            }

            res.send(userInfo);
        } else {

            console.log('[TOKEN AUTH] Checking token for user', body.auth.token.id, 'and tenant ', body.auth.tenantId);

            getUserData(body.auth.token.id, function (status, resp) {

                var orgs = resp.organizations;
                var myTenant = undefined;

                for (var org in orgs) {

                    if (orgs[org].id === body.auth.tenantId) {
                        myTenant = orgs[org];
                        break;
                    }
                }

                if (myTenant) {

                    var token = undefined;

                    for (var t in authDataBase) {
                        if (authDataBase[t].access_token === body.auth.token.id && authDataBase[t].tenant === body.auth.tenantId) {
                            token = t;
                            console.log('[TOKEN AUTH] Getting existing token user', body.auth.token.id, 'and tenant ', body.auth.tenantId, 'token: ', token);
                            break;
                        }
                    }

                    if (!token) {
                        token = generateToken();
                        authDataBase[token] = {access_token: body.auth.token.id, tenant: body.auth.tenantId, isAdmin: false};
                        console.log('[TOKEN AUTH] Generating new token for user', body.auth.token.id, 'and tenant ', body.auth.tenantId, 'token: ', token);
                    }
                    //var tid = "6571e3422ad84f7d828ce2f30373b3d4";

                    var ten = {description: "Tenant from IDM", enabled: true, id: myTenant.id, name: myTenant.name}
                    var access = generateAccessResponse(token, ten, resp.nickName, resp.displayName, myTenant.roles);

                    res.send(JSON.stringify(access));
                } else {
                    console.log('[TOKEN AUTH] Authentication error for ', body.auth.token.id, 'and tenant ', body.auth.tenantId);
                    res.send(401, 'User unathorized for this tenant');
                }


            }, function (status, e) {
                if (status === 401) {
                    console.log('[VALIDATION] User token not authorized');
                    res.send(404, 'User token not authorized');
                } else {
                    console.log('[VALIDATION] Error in IDM communication ', e);
                    res.send(503, 'Error in IDM communication');
                }
            });

        }
    }
}

clientAPI.use(parseBody);
adminAPI.use(parseBody);

clientAPI.use(function(req,res,next) {
    //console.log("ClientAPI Received: ", req.method, req.url);
    next();
});

adminAPI.use(function(req,res,next) {
    //console.log("AdminAPI Received: ", req.method, req.url);
    next();
});

adminAPI.post('/v2.0/tokens', createToken());

clientAPI.post('/v2.0/tokens', createToken());

var validateToken = function(req, res) {
    // Validate token
    console.log('[VALIDATION] Validate user token', req.params.token, 'with auth token ', req.headers['x-auth-token']);

    if (authDataBase[req.headers['x-auth-token']]) {
        console.log('[VALIDATION] Authorization OK from service', authDataBase[req.headers['x-auth-token']].access_token);

        var success = false;

        if (authDataBase[req.params.token] && authDataBase[req.params.token].isAdmin) {
            var token = req.params.token;

            var roles = [
                {"id": "8db87ccbca3b4d1ba4814c3bb0d63aaf", "name": "Member"},
                {"id": "09e95db0ea3f4495a64e95bfc64b0c56", "name": "admin"}
            ];
            var tenant = {"description": "tenant", "enabled": true, "name": "tenant " + authDataBase[token].tenant, "id": authDataBase[token].tenant};
            var access = generateAccessResponse(token, tenant, authDataBase[token].access_token, authDataBase[token].access_token, roles);
            delete access.access['serviceCatalog'];
            var userInfo = JSON.stringify(access);
            res.setHeader("Content-Type", "application/json");
            if (req.headers['accept'] === 'application/xml') {
                ten = {"_enabled": true, "_id": myTenant.id, "_name": myTenant.name};
                access = generateAccessResponseForXML(token, tenant, authDataBase[token].access_token, authDataBase[token].access_token, roles);
                delete access.access['serviceCatalog'];

                userInfo = xmlParser.json2xml_str(access);
                res.setHeader("Content-Type", "application/xml");
            }

            console.log("[VALIDATION] User info: ", userInfo);

            res.send(userInfo);

        } else if(authDataBase[req.params.token]) {

            getUserData(authDataBase[req.params.token].access_token, function (status, resp) {

                var orgs = resp.organizations;
                var myTenant = undefined;

                for (var org in orgs) {

                    if (orgs[org].id === authDataBase[req.params.token].tenant) {
                        myTenant = orgs[org];
                        break;
                    }
                }

                if (myTenant) {
                    //var tid = "6571e3422ad84f7d828ce2f30373b3d4";
                    var ten = {description: "Tenant from IDM", enabled: true, id: myTenant.id, name: myTenant.name};
                    var access = generateAccessResponse(req.params.token, ten, resp.nickName, resp.displayName, myTenant.roles);

                    delete access.access['serviceCatalog'];
                    console.log('[VALIDATION] User token OK');

                    var userInfo = JSON.stringify(access);
                    res.setHeader("Content-Type", "application/json");
                    if (req.headers['accept'] === 'application/xml') {
                        ten = {"_enabled": true, "_id": myTenant.id, "_name": myTenant.name};
                        access = generateAccessResponseForXML(req.params.token, ten, resp.nickName, resp.displayName, myTenant.roles);
                        delete access.access['serviceCatalog'];

                        userInfo = xmlParser.json2xml_str(access);
                        res.setHeader("Content-Type", "application/xml");
                    }

                    console.log("[VALIDATION] User info: ", userInfo);

                    res.send(userInfo);
                } else {
                    console.log('[VALIDATION] User token not authorized');
                    res.send(404, 'User token not authorized');
                }


            }, function (status, e) {
                if (status === 401) {
                    delete authDataBase[req.params.token];
                    console.log('[VALIDATION] User token not authorized');
                    res.send(404, 'User token not authorized');
                } else {
                    console.log('[VALIDATION] Error in IDM communication ', e);
                    res.send(503, 'Error in IDM communication');
                }

            });

        } else {
            console.log('[VALIDATION] User token not found');
            res.send(404, 'User token not found');
        }
    } else {
        console.log('[VALIDATION] Service unauthorized');
        res.send(401, 'Service not authorized');
    }
};

// Token validation from keystone-middlewares
adminAPI.get('/v2.0/tokens/:token', function(req, res) {
    validateToken(req, res);
});

clientAPI.get('/v2.0/tokens/:token', function(req, res) {
    validateToken(req, res);
});

// Token validation from PEP proxies (access-tokens)
adminAPI.get('/v2.0/access-tokens/:token', function(req, res) {
    // Validate token
    console.log('[VALIDATION] Validate user access-token', req.params.token, 'with auth token ', req.headers['x-auth-token']);

    if (authDataBase[req.headers['x-auth-token']]) {
        console.log('[VALIDATION] Authorization OK from PEP proxy ', authDataBase[req.headers['x-auth-token']].access_token);

        getUserData(req.params.token, function (status, resp) {

            console.log('[VALIDATION] User access-token OK');

            var userInfo = JSON.stringify(resp);

            if (req.headers['accept'] === 'application/xml') {
                userInfo = xmlParser.json2xml_str(resp);
            }
            console.log("Response: ", userInfo);
            res.send(userInfo);

        }, function (status, e) {
            if (status === 401) {
                console.log('[VALIDATION] User token not authorized');
                res.send(404, 'User token not authorized');
            } else {
                console.log('[VALIDATION] Error in IDM communication ', e);
                res.send(503, 'Error in IDM communication');
            }
        });


    } else {
        console.log('[VALIDATION] Service unauthorized');
        res.send(401, 'Service not authorized');
    }

});

clientAPI.all('*', function(req, res) {
   console.log("////////////////////////Lost request in clientAPI");

});

adminAPI.all('*', function(req, res) {
    console.log("///////////////////////Lost request in adminAPI");

});

// Initialize the admin server
adminAPI.listen(process.env.PORT1 || 4731);

// Initialize the user server
clientAPI.listen(process.env.PORT2 || 4730);

console.log("Listening ");
