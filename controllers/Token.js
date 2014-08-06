var IDM = require("../lib/IDM.js").IDM,
    AC = require("../lib/AC.js").AC,
    TokenDB = require("../db/TokenDB.js").TokenDB,
    UsersDB = require("../db/UsersDB.js").UsersDB,
    TenantMappingDB = require("../db/TenantMappingDB.js").TenantMappingDB,
    xmlParser = require('../xml2json'),
    config = require("../config.js");
    tokens = {};

var Token = (function() {

    // Private functions

    var pad = function(number, length) {

        var str = '' + number;
        while (str.length < length) {
            str = '0' + str;
        }

        return str;

    };

    var getCatalogue = function (tenantId) {
        return JSON.parse(JSON.stringify(config.serviceCatalog).replace(/\$\(tenant_id\)s/g, tenantId));
    };

    var getKeystoneTenant = function (tenantId) {
        if (tenantId === undefined) return undefined;
        if (TenantMappingDB.get(tenantId)) {
            return TenantMappingDB.get(tenantId);
        } else {
            return pad(tenantId, 32);
        }
    };

    var generateToken = function () {
        return require('crypto').randomBytes(16).toString('hex');
    };

    var generateAccessResponse = function (token, tenant, user_id, user_name, roles) {
        if (tenant !== undefined) {
            tenant.id = getKeystoneTenant(tenant.id);
        }

        return {"access":
                {
                "token":
                {"expires": "2015-07-09T15:16:07Z",
                "id": token,
                "tenant": tenant
                }, 
                "serviceCatalog": ((tenant!==undefined)?getCatalogue(tenant.id):undefined),
                "user": {
                    "username": user_id,
                    "roles_links": [],
                    "id": user_id,
                    "roles": roles,
                    "name": user_name
                }
            }
        };
    };

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
                "serviceCatalog": ((tenant!==undefined)?getCatalogue(tenant.id):undefined),
                "user": {
                    "_username": user_id,
                    "roles_links": [],
                    "_id": user_id,
                    "roles": newRoles,
                    "_name": user_name
                }
            }
        };
    };

    var sendAccessResponse = function(token, tenant, user_id, user_name, roles, req, res, deleteCatalog) {
        var access = generateAccessResponse(token, tenant, user_id, user_name, roles);
        if (deleteCatalog === true) {
            delete access.access['serviceCatalog'];
        }
        var userInfo = JSON.stringify(access);
        try {        
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        if (req.headers['accept'] === 'application/xml') {
            var ten;
            if (tenant !== undefined) {
                ten = {"_enabled": true, "_id": tenant.id, "_name": tenant.name};
            }
            var resp = generateAccessResponseForXML(token, ten, user_id, user_name, roles);
            if (deleteCatalog === true) {
                delete resp.access['serviceCatalog'];
            }
            userInfo = xmlParser.json2xml_str(resp);
            res.setHeader("Content-Type", "application/xml; charset=utf-8");
        }
        res.send(userInfo);
	} catch (error) {
         console.log(error);
        }
    };

    var getTenantFromBody = function(body) {
        var tenantId;
        if (body === undefined || body.auth === undefined) return undefined;
        if (body.auth.tenant !== undefined && body.auth.tenant.id !== undefined) {
            tenantId = body.auth.tenant.id;
        } else if (body.auth.tenantId !== undefined) {
            tenantId = body.auth.tenantId;
        } else if (body.auth.tenantName !== undefined) {
            tenantId = body.auth.tenantName;
            if (tenantId === config.serviceTenantName) {
                tenantId = TenantMappingDB.getFromName(tenantId);
                if (tenantId === undefined) {
                    tenantId = body.auth.tenantName;
                }
            }

        }
        return getKeystoneTenant(tenantId);
    };

    // It creates a new Keystone token from username and password.
    var createTokenFromCredentials = function(req, res) {

        var token = undefined;
        var body = JSON.parse(req.body);
        var tenantId = getTenantFromBody(body);

        console.log('[CREDENTIALS AUTH] Checking user/pass for user', body.auth.passwordCredentials.username);


        // We first look into privileged user list. They all are admins and will be given access to the desired tenant.
        if (UsersDB.get(body.auth.passwordCredentials.username).password === body.auth.passwordCredentials.password) {
            console.log('[CREDENTIALS AUTH] User', body.auth.passwordCredentials.username, 'is on privileged list');
            
            var tenant, roles, name;
            var name = body.auth.passwordCredentials.username;

            if (tenantId !== undefined) {
                // We received a tenantId, so we also add it to the response.
                tenant = {description: "Tenant", enabled: true, id: tenantId, name: tenantId};
                roles = [{"id": "8db87ccbca3b4d1ba4814c3bb0d63aaf", "name": "Member"},
                        {"id": "09e95db0ea3f4495a64e95bfc64b0c56", "name": "admin"}];
            }

            // Now we check if the user already owns a token.
            TokenDB.searchByNameAndTenant(body.auth.passwordCredentials.username, tenantId, function (token) {

                if (token === undefined) {
                    // We have to create a new token, because it does not exist in our database.
                    TokenDB.create(undefined, tenantId, body.auth.passwordCredentials.username, function (t) {
                        sendAccessResponse(t, tenant, name, name, roles, req, res);
                        return;
                    });
                } else {
                    sendAccessResponse(token, tenant, name, name, roles, req, res);
                    return;
                }
            });
            
        } else if (body.auth.passwordCredentials.username !== undefined && body.auth.passwordCredentials.password !== undefined) {
            // Retrieves OAuth access token from FI-Ware account by sending username/password
            IDM.authenticate(body.auth.passwordCredentials.username, body.auth.passwordCredentials.password, function(status, access_token) {
                // Return with access token. Now we get user info.
                IDM.getUserData(access_token, function (status, resp) {
                    var orgs = resp.organizations;
                    var myTenant = undefined;

                    if (tenantId !== undefined) {
                        // If we received a tenantId we check if the user can access to it.
                        for (var org in orgs) {

                            if (getKeystoneTenant(orgs[org].id) == getKeystoneTenant(tenantId)) {
                                myTenant = orgs[org];
                                break;
                            }
                        }
                        if (myTenant) {

                            var ten = {description: "Tenant from IDM", enabled: true, id: myTenant.id, name: myTenant.name};

                            TokenDB.search(access_token, tenantId, function (token) {
                                if (token) {
                                    sendAccessResponse(token, ten, resp.nickName, resp.displayName, myTenant.roles, req, res);
                                    return;
                                } else {
                                    console.log('[TOKEN AUTH] Generating new token for user', body.auth.passwordCredentials.username, 'and tenant ', tenantId, 'token: ', token);
                                    TokenDB.create(access_token, tenantId, body.auth.passwordCredentials.username, function (token) {
                                        sendAccessResponse(token, ten, resp.nickName, resp.displayName, myTenant.roles, req, res);
                                        return;
                                    });
                                }
                            });
                        } else {
                            console.log('[TOKEN AUTH] Authentication error for ', body.auth.passwordCredentials.username, 'and tenant ', tenantId);
                            res.send(401, 'User unathorized for this tenant');
                        }
                    } else {
                        // If we don't received it we return the access token as a keystone token.
                        sendAccessResponse(access_token, undefined, resp.nickName, resp.displayName, undefined, req, res);
                    }
                    
                }, function (status, e) {
                    if (status === 401) {
                        console.log('[VALIDATION] User token not authorized');
                        res.send(401, 'User token not authorized');
                    } else {
                        console.log('[VALIDATION] Error in IDM communication ', e);
                        res.send(503, 'Error in IDM communication');
                    }
                });

            }, function(error, msg) {
                console.log('[VALIDATION] User credentials not authorized');
                res.send(401, 'User credentials not authorized');
            });
            return;

        } else {
            res.send(401, 'User credentials not authorized');
            return;
        }
    };

    // It creates a token from an OAuth token. If the OAuth token is not found it will search for a related token.
    var createTokenFromAccessToken = function(req, res) {
        // Create token from access_token
        var body = JSON.parse(req.body);

        var tenantId = getTenantFromBody(body);

        console.log('[TOKEN AUTH] Checking token', body.auth.token.id, 'and tenant ', tenantId);

        var accToken = body.auth.token.id;

        TokenDB.get(accToken, function (tok) {

            if (accToken !== undefined && tok !== undefined && tok.access_token === undefined) {
                // In this case we will search for the related Access Token, because we received a Keystone token.
                console.log('[TOKEN AUTH] The token was created by Keystone. Related OAuth token: ', tok["access_token"]);
                accToken = tok["access_token"];
            }

            if (tok !== undefined && accToken === undefined) {
                // This token was not created from IDM. The user belongs to the privileged list.
                TokenDB.searchByNameAndTenant(tok.name, tenantId, function (token) {
                    var roles = [{"id": "8db87ccbca3b4d1ba4814c3bb0d63aaf", "name": "Member"},
                                        {"id": "09e95db0ea3f4495a64e95bfc64b0c56", "name": "admin"}];

                    var ten = {description: "Tenant from IDM", enabled: true, id: tenantId, name: tenantId};

                    if (token === undefined) {
                        // The desired token does not exist in Database. We create a new one.
                        TokenDB.create(undefined, tenantId, tok.name, function (token) {
                            console.log('[TOKEN AUTH] Generating new token for user', tok.name, 'and tenant ', tenantId, 'token: ', token);
                            sendAccessResponse(token, ten, tok.name, tok.name, roles, req, res);
                            return;
                        });
                    } else {
                        sendAccessResponse(token, ten, tok.name, tok.name, roles, req, res);
                        return;
                    }
                });
            } else {
                // This token can be retrieved from IDM.
                IDM.getUserData(accToken, function (status, resp) {

                    var orgs = resp.organizations;
                    var myTenant = undefined;

                    for (var org in orgs) {

                        if (getKeystoneTenant(orgs[org].id) == getKeystoneTenant(tenantId)) {
                            myTenant = orgs[org];
                            break;
                        }
                    }

                    if (myTenant) {

                        var token = undefined;

                        TokenDB.list(function (list) {
                            for (var t in list) {
                                if (list[t].access_token === accToken && list[t].tenant === tenantId) {
                                    token = t;
                                    console.log('[TOKEN AUTH] Getting existing token user', accToken, 'and tenant ', tenantId, 'token: ', token);
                                    break;
                                }
                            }
                            //var tid = "6571e3422ad84f7d828ce2f30373b3d4";
                            var ten = {description: "Tenant from IDM", enabled: true, id: myTenant.id, name: myTenant.name};

                            if (!token) {
                                TokenDB.create(accToken, tenantId, resp.nickName, function (token) {
                                    console.log('[TOKEN AUTH] Generating new token for user', resp.nickName, 'and tenant ', tenantId, 'token: ', token);
                                    sendAccessResponse(token, ten, resp.nickName, resp.displayName, myTenant.roles, req, res);
                                    return;
                                });
                            } else {
                                sendAccessResponse(token, ten, resp.nickName, resp.displayName, myTenant.roles, req, res);
                                return;
                            }
                        });
                    } else {
                        console.log('[TOKEN AUTH] Authentication error for ', resp.nickName, 'and tenant ', tenantId);
                        res.send(401, 'User unathorized for this tenant');
                    }


                }, function (status, e) {
                    if (status === 401) {
                        console.log('[VALIDATION] User token not authorized');
                        res.send(401, 'User token not authorized');
                    } else {
                        console.log('[VALIDATION] Error in IDM communication ', e);
                        res.send(503, 'Error in IDM communication');
                    }
                });
            }
        });
    };

    // Public functions

    // Token creation from username/password or from OAuth tokens
    var create = function(req, resp) {

        var body = JSON.parse(req.body);
        
        if (body.auth.passwordCredentials !== undefined) {
            // Create token from password credentials
            createTokenFromCredentials(req, resp);
        } else {
            // Create token from OAuth access token
            createTokenFromAccessToken(req, resp);
        }
    };

    var log = function(type, data) {
        console.log("[", type, "] ", data);
    };

    var validateLog = function(status, service, user, token, msg) {
        log("VALIDATION", status + ": Service (" + service + ") - User (" + user + ") - Token (" + token + ") - " + msg);
    };

    var retrieveTokens = function(req, res, next) {
        req.params.token = req.params.token || req.headers['x-subject-token'];
        if (req.headers['x-subject-token'] !== undefined) {
            res.setHeader("X-Subject-Token", req.headers['x-subject-token']);
        }
        next();
    };

    // Token validation
    var validate = function(req, res) {
        // Validate token
        //console.log('[VALIDATION] Validate user token', req.params.token, 'with auth token ', req.headers['x-auth-token']);
        TokenDB.get(req.headers['x-auth-token'], function (t) {
            if (t) {
                //console.log('[VALIDATION] Authorization OK from service', TokenDB.get(req.headers['x-auth-token']).name);

                var success = false;

                TokenDB.get(req.params.token, function (t2) {
                    if (t2 && t2.access_token === undefined) {

                        TokenDB.get(req.headers['x-auth-token'], function (t3) {
                            // Is a token from the privileged user list
                            validateLog("Success", t3.name, t2.name, req.params.token, "");

                            var roles = [
                                {"id": "8db87ccbca3b4d1ba4814c3bb0d63aaf", "name": "Member"},
                                {"id": "09e95db0ea3f4495a64e95bfc64b0c56", "name": "admin"}
                            ];
                            var tenant = {"description": "tenant", "enabled": true, "name": "tenant " + t2.tenant, "id": t2.tenant};
                            sendAccessResponse(req.params.token, tenant, "admin", "admin", roles, req, res, true);
                            return;
                        });
                    } else if(t2) {

                        TokenDB.get(req.headers['x-auth-token'], function (t3) {
                            // Is a token obtained from OAuth access token
                            var sendData = function(status, resp) {
                                tokens[t2.access_token] = {status:status, resp: resp};
                                var orgs = resp.organizations;
                                var myTenant = undefined;

                                for (var org in orgs) {

                                    if (getKeystoneTenant(orgs[org].id) == getKeystoneTenant(t2.tenant)) {
                                        myTenant = orgs[org];
                                        break;
                                    }
                                }
                                //console.log("[VALIDATION] Tenant ", myTenant);

                                if (myTenant) {
                                    //var tid = "6571e3422ad84f7d828ce2f30373b3d4";
                                    var ten = {description: "Tenant from IDM", enabled: true, id: myTenant.id, name: myTenant.name};
                                    validateLog("Success", t3.name, resp.nickName, req.params.token, "");
                                    sendAccessResponse(t2, ten, resp.nickName, resp.displayName, myTenant.roles, req, res, true);
                                    return;
                                    
                                } else {
                                    validateLog("Error", t3.name, undefined, req.params.token, "User Token not authorized");
                                    res.send(404, 'User token not authorized');
                                }
                            };
                            var info = tokens[t2.access_token];
                            if (info !== undefined) 
                                sendData(info.status, info.resp);
                            else {
                            IDM.getUserData(t2.access_token,sendData, function (status, e) {
                                if (status === 401) {
                                    TokenDB.remove(req.params.token, function(){});
                                    validateLog("Error", t3.name, undefined, req.params.token, "OAuth token not found in IDM");
                                    res.send(404, 'User token not authorized');
                                } else {
                                    validateLog("Error", t3.name, undefined, req.params.token, "Error in IDM communication");
                                    res.send(503, 'Error in IDM communication');
                                }
                            });
                            }
                        });
                    } else {
                        TokenDB.get(req.headers['x-auth-token'], function (t3) {
                            validateLog("Error", t3.name, undefined, req.params.token, "User Token not found");
                            res.send(404, 'User token not found');
                        });
                    }
                });
            } else {
                validateLog("Error", undefined, undefined, req.headers['x-auth-token'], "Service unauthorized");
                res.send(401, 'Service not authorized');
            }
        });
    };

    var validatePEP = function(req, res) {
        // Validate token
        console.log('[VALIDATION] Validate user access-token', req.params.token, 'with auth token ', req.headers['x-auth-token']);

        TokenDB.get(req.headers['x-auth-token'], function (t) {

            if (t) {
                console.log('[VALIDATION] Authorization OK from PEP proxy ', t.access_token);

                IDM.getUserData(req.params.token, function (status, resp) {

                    console.log('[VALIDATION] User access-token OK');

                    var userInfo = JSON.stringify(resp);

                    if (req.headers['accept'] === 'application/xml') {
                        userInfo = xmlParser.json2xml_str(resp);
                    }
                    //console.log("Response: ", userInfo);
                    res.send(userInfo);

                }, function (status, e) {
                    if (status === 200) {
                        res.send(200, "{}");
                    } else if (status === 401) {
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
    };

    var authorizeRESTPEP = function(req, res) {
        // Validate token
        console.log('[VALIDATION] Validate user access-token', req.params.token, 'with auth token ', req.headers['x-auth-token']);

        TokenDB.get(req.headers['x-auth-token'], function (t) {

            if (t) {
                console.log('[VALIDATION] Authorization OK from PEP proxy ', t.access_token);

                IDM.getUserData(req.params.token, function (status, resp) {

                    console.log('[VALIDATION] User access-token OK');

                    var roles = [];
                    for (var orgIdx in resp.organizations) {
                        var org = resp.organizations[orgIdx];
                        console.log(org.name, org.roles);
                        for (var roleIdx in org.roles) {
                            var role = org.roles[roleIdx];
                            roles.push(role.id);
                        }
                    }

                    for (roleIdx in resp.roles) {
                        role = resp.roles[roleIdx];
                        roles.push(role.id);
                    }

                    var resource = req.headers['x-auth-resource'];
                    var action = req.headers['x-auth-action'];

                    AC.checkRESTPolicy(roles, resource, action, function(authorized) {
                            if (authorized) {
                                console.log("[AUTHORIZATION] User is authorized");
                                var userInfo = JSON.stringify(resp);
                                if (req.headers['accept'] === 'application/xml') {
                                    userInfo = xmlParser.json2xml_str(resp);
                                }
                                console.log("Response: ", userInfo);
                                res.send(userInfo);
                            } else {
                                console.log("[AUTHORIZATION] User is not authorized");
                                res.send(404, 'User token not authorized');
                            }
                        }, function() {
                            res.send(503, 'Error in AC communication');
                        });

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
    };

    var authorizeXACMLPEP = function(req, res) {
        // Validate token
        console.log('[VALIDATION] Validate user access-token', req.params.token, 'with auth token ', req.headers['x-auth-token']);

        TokenDB.get(req.headers['x-auth-token'], function (t) {

            if (t) {
                console.log('[VALIDATION] Authorization OK from PEP proxy ', t.access_token);
                var xacml = req.body;
                AC.getAccessTokenFromXACML(xacml, function(token) {
                    IDM.getUserData(token, function (status, resp) {

                        console.log('[VALIDATION] User access-token OK');

                        var roles = [];
                        for (var orgIdx in resp.organizations) {
                            var org = resp.organizations[orgIdx];
                            console.log(org.name, org.roles);
                            for (var roleIdx in org.roles) {
                                var role = org.roles[roleIdx];
                                roles.push(role.id);
                            }
                        }

                        for (roleIdx in resp.roles) {
                            role = resp.roles[roleIdx];
                            roles.push(role.id);
                        }

                        AC.checkPolicy(roles, xacml, function(authorized) {
                                if (authorized) {
                                    console.log("[AUTHORIZATION] User is authorized");
                                    var userInfo = JSON.stringify(resp);
                                    if (req.headers['accept'] === 'application/xml') {
                                        userInfo = xmlParser.json2xml_str(resp);
                                    }
                                    console.log("Response: ", userInfo);
                                    res.send(userInfo);
                                } else {
                                    console.log("[AUTHORIZATION] User is not authorized");
                                    res.send(404, 'User token not authorized');
                                }
                            }, function() {
                                res.send(503, 'Error in AC communication');
                            });

                    }, function (status, e) {
                        if (status === 401) {
                            console.log('[VALIDATION] User token not authorized');
                            res.send(404, 'User token not authorized');
                        } else {
                            console.log('[VALIDATION] Error in IDM communication ', e);
                            res.send(503, 'Error in IDM communication');
                        }
                    });
                });


            } else {
                console.log('[VALIDATION] Service unauthorized');
                res.send(401, 'Service not authorized');
            }
        });
    };

    return {
        create: create,
        validate: validate,
        validatePEP: validatePEP,
        authorizeRESTPEP: authorizeRESTPEP,
        authorizeXACMLPEP: authorizeXACMLPEP,
        retrieveTokens: retrieveTokens
    }
})();

exports.Token = Token;
