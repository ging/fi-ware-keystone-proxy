var express = require('express'),
    clientAPI = express(),
    adminAPI = express(),
    http = require('http'),
    https = require('https'),
    proxy = require('./HTTPClient.js');

var hostname = '130.206.80.62';
var clientPort = 5000;
var adminPort = 35357;
var fakeToken = "46b97bc848e947f9b444f9ccf3a4762a";

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
            "serviceCatalog": getCatalogue(tenant.id),
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

var generateToken = function () {
    return require('crypto').randomBytes(16).toString('hex');
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

        callback(status, resp1);

    }, callbackError);

}

var createToken = function (port) {
    return function(req, res) {
        console.log("Authenticating", req.body);
        var body = JSON.parse(req.body);
        //console.log(JSON.stringify(body, 4, 4));
        if (body.auth.passwordCredentials !== undefined) {
            console.log('----------------Generating token for service', body.auth.passwordCredentials.username);
            var token = generateToken();

            var resp = 
                {"access": 
                    {"token": 
                        {"expires": "2015-07-09T15:16:07Z", 
                        "id": token, 
                        "tenant": 
                            {"description": "Service tenant", "enabled": true, "id": "96d9611e4b514c2a9804376a899103f1", "name": "service"}
                        }, 
                        "serviceCatalog": getCatalogue('96d9611e4b514c2a9804376a899103f1'), 
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
            authDataBase[token] = {access_token: body.auth.passwordCredentials.username, tenant: '96d9611e4b514c2a9804376a899103f1'};
            res.send(resp);
        } else {
            
            console.log('::::::::::::::..Checking token for user', body.auth.token.id, 'and tenant ', body.auth.tenantId);

            var token = undefined;
            var newToken = false;

            for (var t in authDataBase) {
                if (authDataBase[t].access_token === body.auth.token.id) {
                    token = t;
                    break;
                }
            }

            if (!token || authDataBase[token].tenant !== body.auth.tenantId) {
                console.log('::::::::::::::..Generating new token for user', body.auth.token.id, 'and tenant ', body.auth.tenantId);
                token = generateToken();
                newToken = true;
            }

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
                    var ten = {description: "Tenant from IDM", enabled: true, id: myTenant.id, name: myTenant.name}
                    var access = generateAccessResponse(token, ten, resp.nickName, resp.displayName, myTenant.roles);
                    if (newToken) {
                         authDataBase[token] = {access_token: body.auth.token.id, tenant: body.auth.tenantId};
                    }
                    res.send(JSON.stringify(access));
                } else {
                    res.send(401);
                }

                
            }, function (e) {
                console.log('ERROR ', e);
            });
           
        }
    }
}

clientAPI.use(parseBody);
adminAPI.use(parseBody);

clientAPI.use(function(req,res,next) {
    console.log("ClientAPI Received: ", req.method, req.url);
    next();
});

adminAPI.use(function(req,res,next) {
    console.log("AdminAPI Received: ", req.method, req.url);
    next();
});

adminAPI.post('/v2.0/tokens', createToken(adminPort));

clientAPI.post('/v2.0/tokens', createToken(clientPort));

adminAPI.get('/v2.0/tokens/:token', function(req, res) {
    // Validate token
    console.log('++++VALIDATE REQ ADMIN', req.params.token);

    var success = false;


    if(authDataBase[req.params.token]) {

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
                var ten = {description: "Tenant from IDM", enabled: true, id: myTenant.id, name: myTenant.name}
                var access = generateAccessResponse(req.params.token, ten, resp.nickName, resp.displayName, myTenant.roles);
                    
                delete access.access['serviceCatalog'];
                console.log('VALIDATED ');

                res.send(JSON.stringify(access));
            } else {
                res.send(401);
            }


        }, function (e) {
            console.log('ERROR ', e);
        });
        
    } else {
        console.log('Fail!!!!!!!!');
        res.send(404);
    }
    
});

clientAPI.get('/v2.0/tokens/:token', function(req, res) {
    // Validate token
    console.log('++++VALIDATE REQ ', req.params.token);
    res.send(JSON.stringify(userToken));
});

clientAPI.all('*', function(req, res) {
   console.log("////////////////////////Creating token in clientAPI");

});

adminAPI.all('*', function(req, res) {
    console.log("////////////////////////Creating token in clientAPI");

});

// Initialize the admin server
adminAPI.listen(process.env.PORT1 || 4731);

// Initialize the user server
clientAPI.listen(process.env.PORT2 || 4730);

console.log("Listening ");