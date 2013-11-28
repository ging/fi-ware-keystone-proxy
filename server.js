var express = require('express'),
    clientAPI = express(),
    adminAPI = express(),
    config = require('./config.js'),
    Token = require('./controllers/Token').Token,
    Tenant = require('./controllers/Tenant').Tenant;

//{token: {access_token: (service_name), tenant: }}

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

// Token creation
adminAPI.post('/v2.0/tokens', Token.create);
clientAPI.post('/v2.0/tokens', Token.create);

// Token validation from keystone-middlewares
adminAPI.get('/v2.0/tokens/:token', Token.retrieveTokens, Token.validate);
clientAPI.get('/v2.0/tokens/:token', Token.retrieveTokens, Token.validate);
adminAPI.get('/v3/auth/tokens', Token.retrieveTokens, Token.validate);
clientAPI.get('/v3/auth/tokens', Token.retrieveTokens, Token.validate);

// Token validation from PEP proxies (access-tokens)
adminAPI.get('/v2.0/access-tokens/:token', Token.validatePEP);

// List tenants for current user
clientAPI.get('/v2.0/tenants', Tenant.list);
adminAPI.get('/v2.0/tenants', Tenant.list);

adminAPI.get('/', function(req, res) {
    var resp = '';
    if (req.headers['accept'] === 'application/xml') {
        resp = '<?xml version="1.0" encoding="UTF-8"?>'+
        '<versions xmlns="http://docs.openstack.org/identity/api/v2.0">'+
        '  <version status="stable" updated="2013-03-06T00:00:00Z" id="v3.0">'+
        '    <media-types>'+
        '      <media-type base="application/json" type="application/vnd.openstack.identity-v3+json"/>'+
        '      <media-type base="application/xml" type="application/vnd.openstack.identity-v3+xml"/>'+
        '    </media-types>'+
        '    <links>'+
        '      <link href="http://localhost:4731/v3/" rel="self"/>'+
        '    </links>'+
        '  </version>'+
        '  <version status="stable" updated="2013-03-06T00:00:00Z" id="v2.0">'+
        '    <media-types>'+
        '      <media-type base="application/json" type="application/vnd.openstack.identity-v2.0+json"/>'+
        '      <media-type base="application/xml" type="application/vnd.openstack.identity-v2.0+xml"/>'+
        '    </media-types>'+
        '    <links>'+
        '      <link href="http://localhost:4731/v2.0/" rel="self"/>'+
        '      <link href="http://docs.openstack.org/api/openstack-identity-service/2.0/content/" type="text/html" rel="describedby"/>'+
        '      <link href="http://docs.openstack.org/api/openstack-identity-service/2.0/identity-dev-guide-2.0.pdf" type="application/pdf" rel="describedby"/>'+
        '    </links>'+
        '  </version>'+
        '</versions>';
        res.setHeader("Content-Type", "application/xml");
    } else {
        var json = {"versions": {"values": [{"status": "stable", "updated": "2013-03-06T00:00:00Z", "media-types": [{"base": "application/json", "type": "application/vnd.openstack.identity-v3+json"}, {"base": "application/xml", "type": "application/vnd.openstack.identity-v3+xml"}], "id": "v3.0", "links": [{"href": "http://localhost:4731/v3/", "rel": "self"}]}, {"status": "stable", "updated": "2013-03-06T00:00:00Z", "media-types": [{"base": "application/json", "type": "application/vnd.openstack.identity-v2.0+json"}, {"base": "application/xml", "type": "application/vnd.openstack.identity-v2.0+xml"}], "id": "v2.0", "links": [{"href": "http://localhost:4731/v2.0/", "rel": "self"}, {"href": "http://docs.openstack.org/api/openstack-identity-service/2.0/content/", "type": "text/html", "rel": "describedby"}, {"href": "http://docs.openstack.org/api/openstack-identity-service/2.0/identity-dev-guide-2.0.pdf", "type": "application/pdf", "rel": "describedby"}]}]}};
        resp = JSON.stringify(json);
        res.setHeader("Content-Type", "application/json");
    }
    res.send(resp, 300);

});

clientAPI.all('*', function(req, res) {
   console.log("////////////////////////Lost request in clientAPI", req.params, req.body);

});

adminAPI.all('*', function(req, res) {
    console.log("///////////////////////Lost request in adminAPI");

});

// Initialize the admin server
adminAPI.listen(process.env.PORT1 || 4731);

// Initialize the user server
clientAPI.listen(process.env.PORT2 || 4730);

console.log("Listening ");
