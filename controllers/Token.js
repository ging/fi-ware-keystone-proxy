var IDM = require("../lib/IDM.js").IDM,
	TokenDB = require("../db/TokenDB.js").TokenDB,
	UsersDB = require("../db/UsersDB.js").UsersDB,
	TenantMappingDB = require("../db/TenantMappingDB.js").TenantMappingDB,
    xmlParser = require('../xml2json'),
	config = require("../config.js");

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
	    if (tenant !== undefined) {
	        tenant._id = getKeystoneTenant(tenant._id);
	    }

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

	// It creates a new Keystone token from username and password.
	var createTokenFromCredentials = function(req, res) {

        var token = undefined;
        var tenantId = undefined;
        var body = JSON.parse(req.body);

        console.log('[CREDENTIALS AUTH] Checking token for user', body.auth.passwordCredentials.username);
        console.log("Req: ", body.auth);

        if (body.auth.tenantId !== undefined) {
        	tenantId = body.auth.tenantId;
        } else if (body.auth.tenantName !== undefined) {
            tenantId = body.auth.tenantName;
        }

        // This case the user is admin
        var isAdmin = false;
        // We first look into privileged user list.
        if (tenantId !== undefined && UsersDB.get(body.auth.passwordCredentials.username).password === body.auth.passwordCredentials.password) {
            isAdmin = UsersDB.get(body.auth.passwordCredentials.username).isAdmin;
        } else if (body.auth.passwordCredentials.username !== undefined && body.auth.passwordCredentials.password !== undefined) {
            // Retrieves OAuth access token from FI-Ware account by sending username/password
            IDM.authenticate(body.auth.passwordCredentials.username, body.auth.passwordCredentials.password, function(status, access_token) {
                if (body.auth.tenantName !== undefined || (body.auth.tenant !== undefined && body.auth.tenant.id !== undefined)) {
                    tenantId = body.auth.tenantName ||  body.auth.tenant.id;
                }
                // Return with access token. Now we get user info.
                IDM.getUserData(access_token, function (status, resp) {
                    var orgs = resp.organizations;
                    var myTenant = undefined;

                    if (tenantId !== undefined) {

                        for (var org in orgs) {

                            if (orgs[org].id == tenantId) {
                                myTenant = orgs[org];
                                break;
                            }
                        }
                        if (myTenant) {

                            var token = TokenDB.search(access_token, tenantId);

                            if (!token) {
                            	token = TokenDB.create(access_token, tenantId, false);
                                console.log('[TOKEN AUTH] Generating new token for user', access_token, 'and tenant ', tenantId, 'token: ', token);
                            }
                            //var tid = "6571e3422ad84f7d828ce2f30373b3d4";

                            var ten = {description: "Tenant from IDM", enabled: true, id: myTenant.id, name: myTenant.name}
                            var access = generateAccessResponse(token, ten, resp.nickName, resp.displayName, myTenant.roles);
                            res.send(JSON.stringify(access));
                        } else {
                            console.log('[TOKEN AUTH] Authentication error for ', access_token, 'and tenant ', tenantId);
                            res.send(401, 'User unathorized for this tenant');
                        }
                    } else {
                        var access = generateAccessResponse(access_token, undefined, resp.nickName, resp.displayName, undefined);
                        res.send(JSON.stringify(access));
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
                return;
            });
            return;

        }

        tenantId = tenantId || "96d9611e4b514c2a9804376a899103f1";

        var tenant = {"description": "Service tenant", "enabled": true, "name": "service", "id": tenantId};

        token = TokenDB.search(body.auth.passwordCredentials.username, body.auth.tenantName);

        if (!token) {
            token = TokenDB.create(undefined, tenantId, isAdmin);
            console.log('[CREDENTIALS AUTH] Generating new token for user', body.auth.passwordCredentials.username, 'token: ', token);
        }

        var resp = generateAccessResponse(
            token, 
            tenant, 
            "91c72f314d93470b90a7c1ba21d7e352", 
            body.auth.passwordCredentials.username, 
            [{"id": "8db87ccbca3b4d1ba4814c3bb0d63aaf", "name": "Member"},
             {"id": "09e95db0ea3f4495a64e95bfc64b0c56", "name": "admin"}
            ]);

        var userInfo = JSON.stringify(resp);
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        if (req.headers['accept'] === 'application/xml') {

            var ten = {"_enabled": true, "_id": tenantId, "_name": "service"};
            var resp = generateAccessResponseForXML(
                token, 
                ten, 
                "91c72f314d93470b90a7c1ba21d7e352", 
                body.auth.passwordCredentials.username, 
                [{"id": "8db87ccbca3b4d1ba4814c3bb0d63aaf", "name": "Member"},
                 {"id": "09e95db0ea3f4495a64e95bfc64b0c56", "name": "admin"}
                ]);


            userInfo = xmlParser.json2xml_str(resp);
            res.setHeader("Content-Type", "application/xml; charset=utf-8");
        }
        res.send(userInfo);
	};

	// It creates a token from an OAuth token
	var createTokenFromAccessToken = function(req, res) {
		// Create token from access_token
    	var body = JSON.parse(req.body);

        console.log('[TOKEN AUTH] Checking token for user', body.auth.token.id, 'and tenant ', body.auth.tenantId);

        IDM.getUserData(body.auth.token.id, function (status, resp) {

            var orgs = resp.organizations;
            var myTenant = undefined;

            for (var org in orgs) {

                if (orgs[org].id == body.auth.tenantId) {
                    myTenant = orgs[org];
                    break;
                }
            }

            if (myTenant) {

                var token = undefined;

                for (var t in TokenDB.list()) {
                    if (TokenDB.get(t).access_token === body.auth.token.id && TokenDB.get(t).tenant === body.auth.tenantId) {
                        token = t;
                        console.log('[TOKEN AUTH] Getting existing token user', body.auth.token.id, 'and tenant ', body.auth.tenantId, 'token: ', token);
                        break;
                    }
                }

                if (!token) {
                	token = TokenDB.create(body.auth.token.id, body.auth.tenantId, false);
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
                res.send(401, 'User token not authorized');
            } else {
                console.log('[VALIDATION] Error in IDM communication ', e);
                res.send(503, 'Error in IDM communication');
            }
        });
	};

	// Public functions

	// Token creation from username/password or from OAuth tokens
	var create = function(req, resp) {

		console.log("[AUTHENTICATION]", req.body);
		var body = JSON.parse(req.body);
        
        if (body.auth.passwordCredentials !== undefined) {
        	// Create token from password credentials
        	createTokenFromCredentials(req, resp);
        } else {
        	// Create token from OAuth access token
        	createTokenFromAccessToken(req, resp);
        }
	};

	// Token validation
	var validate = function(req, res) {
	    // Validate token
	    console.log('[VALIDATION] Validate user token', req.params.token, 'with auth token ', req.headers['x-auth-token']);

	    if (TokenDB.get(req.headers['x-auth-token'])) {
	        console.log('[VALIDATION] Authorization OK from service', TokenDB.get(req.headers['x-auth-token']).access_token);

	        var success = false;

	        if (TokenDB.get(req.params.token) && TokenDB.get(req.params.token).access_token === undefined) {

	        	// Is a token from the privileged user list
	        	console.log("[VALIDATION] User from privileged list");

	            var token = req.params.token;

	            var roles = [
	                {"id": "8db87ccbca3b4d1ba4814c3bb0d63aaf", "name": "Member"},
	                {"id": "09e95db0ea3f4495a64e95bfc64b0c56", "name": "admin"}
	            ];
	            var tenant = {"description": "tenant", "enabled": true, "name": "tenant " + TokenDB.get(token).tenant, "id": TokenDB.get(token).tenant};
	            var access = generateAccessResponse(token, tenant, "admin", "admin", roles);
	            delete access.access['serviceCatalog'];
	            var userInfo = JSON.stringify(access);
	            res.setHeader("Content-Type", "application/json; charset=utf-8");
	            if (req.headers['accept'] === 'application/xml') {
	                ten = {"_enabled": true, "_id": myTenant.id, "_name": myTenant.name};
	                access = generateAccessResponseForXML(token, ten, "admin", "admin", roles);
	                delete access.access['serviceCatalog'];

	                userInfo = xmlParser.json2xml_str(access);
	                res.setHeader("Content-Type", "application/xml; charset=utf-8");
	            }

	            console.log("[VALIDATION] User info: ", userInfo);

	            res.send(userInfo);

	        } else if(TokenDB.get(req.params.token)) {

	        	// Is a token obtained from OAuth access token
	        	console.log("[VALIDATION] Retrieving user info from IDM");
	            IDM.getUserData(TokenDB.get(req.params.token).access_token, function (status, resp) {

	                var orgs = resp.organizations;
	                var myTenant = undefined;

	                for (var org in orgs) {

	                    if (orgs[org].id == TokenDB.get(req.params.token).tenant) {
	                        myTenant = orgs[org];
	                        break;
	                    }
	                }
	                console.log("[VALIDATION] Tenant ", myTenant);

	                if (myTenant) {
	                    //var tid = "6571e3422ad84f7d828ce2f30373b3d4";
	                    var ten = {description: "Tenant from IDM", enabled: true, id: myTenant.id, name: myTenant.name};
	                    var access = generateAccessResponse(req.params.token, ten, resp.nickName, resp.displayName, myTenant.roles);

	                    delete access.access['serviceCatalog'];
	                    console.log('[VALIDATION] User token OK');

	                    var userInfo = JSON.stringify(access);
	                    res.setHeader("Content-Type", "application/json; charset=utf-8");
	                    if (req.headers['accept'] === 'application/xml') {
	                        ten = {"_enabled": true, "_id": myTenant.id, "_name": myTenant.name};
	                        access = generateAccessResponseForXML(req.params.token, ten, resp.nickName, resp.displayName, myTenant.roles);
	                        delete access.access['serviceCatalog'];

	                        userInfo = xmlParser.json2xml_str(access);
	                        res.setHeader("Content-Type", "application/xml; charset=utf-8");
	                    }

	                    console.log("[VALIDATION] User info: ", userInfo);

	                    res.send(userInfo);
	                } else {
	                    console.log('[VALIDATION] User token not authorized');
	                    res.send(404, 'User token not authorized');
	                }


	            }, function (status, e) {
	                if (status === 401) {
	                    delete TokenDB.get(req.params.token);
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

	var validatePEP = function(req, res) {
		// Validate token
	    console.log('[VALIDATION] Validate user access-token', req.params.token, 'with auth token ', req.headers['x-auth-token']);

	    if (TokenDB.get(req.headers['x-auth-token'])) {
	        console.log('[VALIDATION] Authorization OK from PEP proxy ', TokenDB.get(req.headers['x-auth-token']).access_token);

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
	};
	return {
		create: create,
		validate: validate,
		validatePEP: validatePEP
	}
})();

exports.Token = Token;
