var express = require('express'),
    clientAPI = express(),
    adminAPI = express(),
    config = require('./config.js'),
    Index = require('./controllers/Index').Index,
    Token = require('./controllers/Token').Token,
    Tenant = require('./controllers/Tenant').Tenant
    Endpoints = require('./controllers/Endpoints').Endpoints;

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

clientAPI.use(function(err, req, res, next) {
    if(!err) return next(); // you also need this line
    console.log("********* error!!!", err.stack);
    res.send(500, "Internal Server Error");
});

adminAPI.use(function(err, req, res, next) {
    if(!err) return next(); // you also need this line
    console.log("********* error!!!", err.stack);
    res.send(500, "Internal Server Error");
});

// Token creation
adminAPI.post('/v2.0/tokens', Token.create);
clientAPI.post('/v2.0/tokens', Token.create);

// Token validation from keystone-middlewares
adminAPI.get('/v2.0/tokens/:token', Token.retrieveTokens, Token.validate);
clientAPI.get('/v2.0/tokens/:token', Token.retrieveTokens, Token.validate);
adminAPI.get('/v3/auth/tokens', Token.retrieveTokens, Token.validate);
clientAPI.get('/v3/auth/tokens', Token.retrieveTokens, Token.validate);

// List Endpoints
adminAPI.get('/v2.0/tokens/:token/endpoints', Token.retrieveTokens, Endpoints.list);
clientAPI.get('/v2.0/tokens/:token/endpoints', Token.retrieveTokens, Endpoints.list);

// Token validation from PEP proxies (access-tokens)
adminAPI.get('/v2.0/access-tokens/:token', Token.validatePEP);

// List tenants for current user
clientAPI.get('/v2.0/tenants', Tenant.list);
adminAPI.get('/v2.0/tenants', Tenant.list);

adminAPI.get('/', Index.get);
clientAPI.get('/', Index.get);

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
