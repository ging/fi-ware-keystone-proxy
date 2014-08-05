var https = require('https'),
    x2js = require('xml2js'),
    fs = require('fs'),
    config = require('../config.js');

var roles = ['88946'];
var path = 'per';
var action = 'per';

var AC = (function() {

  var sendData = function(xml, success, error) {
    
    var options = {
      host: config.ac.host, 
      path: config.ac.path,
      method: 'POST',
      key: fs.readFileSync(config.ac.key),
      cert: fs.readFileSync(config.ac.cert),
      ca: fs.readFileSync(config.ac.ca)
    };

    var req = https.request(options, function(res) {
      //console.log("statusCode: ", res.statusCode);
      //console.log("headers: ", res.headers);

      var body = "";
      var parser = new x2js.Parser();

      res.on('data', function(d) {
        body += d;
        parser.parseString(body, function (err, result) {
          // Responses: ["Permit", "NotApplicable"]
          if (err) {
            error();
            console.log("Response from AC server for policy check: ", result.Response.Result[0].Decision[0]);  
          } else {
            if (result.Response.Result[0].Decision[0] === "Permit") {
              success(true);
            } else {
              success(false);
            }
          }
          
        });
        //process.stdout.write(d);
      });
    });
    req.write(xml);
    req.end();

    req.on('error', function(e) {
      console.error(e);
    });
  };

  var checkRESTPolicy = function (roles,path,action, success, error) {
    console.log("Checking authorization to roles", roles, "to do ", action, " on ", path);
    var XACMLPolicyString = {
          Request: {
           '$': {xmlns: 'urn:oasis:names:tc:xacml:2.0:context:schema:os' },
            Subject: [ { 
              '$': { SubjectCategory: 'urn:oasis:names:tc:xacml:1.0:subject-category:access-subject' },
              Attribute: [ {
                '$': { 
                  AttributeId:'urn:oasis:names:tc:xacml:2.0:subject:role',
                  //AttributeId:'urn:oasis:names:tc:xacml:1.0:resource:resource-id',
                  DataType:'http://www.w3.org/2001/XMLSchema#string' 
                }, 
                AttributeValue: []
              } ]
            } ],
            Resource: [ {
              Attribute: [ {
                '$': { 
                  AttributeId:'urn:oasis:names:tc:xacml:1.0:resource:resource-id',
                  //AttributeId:'urn:thales:xacml:2.0:resource:sub-resource-id',
                  DataType:'http://www.w3.org/2001/XMLSchema#string' 
                },
                AttributeValue: []
              } ]
            } ],
            Action: [ {
              Attribute: [ {
                '$': { 
                  AttributeId:'urn:oasis:names:tc:xacml:1.0:action:action-id',
                  DataType:'http://www.w3.org/2001/XMLSchema#string' 
                },
                AttributeValue: []
              } ]
            } ],
            Environment: {      
            }, 
          }
        };

    var subject = "";
    for (var i in roles) {
      XACMLPolicyString.Request.Subject[0].Attribute[0].AttributeValue[i] = roles[i]; 
    }
    XACMLPolicyString.Request.Resource[0].Attribute[0].AttributeValue[0] = path;
    XACMLPolicyString.Request.Action[0].Attribute[0].AttributeValue[0] = action;

    var js2xml = new x2js.Builder();
    xml = js2xml.buildObject(XACMLPolicyString);

    sendData(xml, success, error);

  };

  return {
      checkRESTPolicy: checkRESTPolicy
  }

})();

exports.AC = AC;