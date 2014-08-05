var https = require('https'),
    x2js = require('xml2js'),
    fs = require('fs');

var roles = ['TicketIssuer', 'TeamManager'];
var path = 'http://130.206.82.141:5000/new_issue/';
var action = 'POST';

//test
// var roles = ['Manager'];
// var path = 'http://130.206.82.141:5000/manage/';
// var action = 'PUT';

//var XACMLPolicyString = "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><Request xmlns='urn:oasis:names:tc:xacml:2.0:context:schema:os'><Subject SubjectCategory='urn:oasis:names:tc:xacml:1.0:subject-category:access-subject'><Attribute AttributeId='urn:oasis:names:tc:xacml:1.0:subject:subject-id' DataType='http://www.w3.org/2001/XMLSchema#string'><AttributeValue>joe</AttributeValue></Attribute><Attribute AttributeId='urn:oasis:names:tc:xacml:2.0:subject:role' DataType='http://www.w3.org/2001/XMLSchema#string'><AttributeValue>TicketIssuer</AttributeValue></Attribute></Subject><Resource><Attribute AttributeId='urn:oasis:names:tc:xacml:1.0:resource:resource-id' DataType='http://www.w3.org/2001/XMLSchema#string'><AttributeValue>http://130.206.82.141:5000/new_issue/</AttributeValue></Attribute></Resource><Action><Attribute AttributeId='urn:oasis:names:tc:xacml:1.0:action:action-id' DataType='http://www.w3.org/2001/XMLSchema#string'><AttributeValue>POST</AttributeValue></Attribute></Action><Environment/></Request>" 

function checkPolicy(roles,path,action) {


var XACMLPolicyString = {
      Request: {
       '$': {xmlns: 'urn:oasis:names:tc:xacml:2.0:context:schema:os' },
        Subject: [ { 
          '$': { SubjectCategory: 'urn:oasis:names:tc:xacml:1.0:subject-category:access-subject' },
          Attribute: [ {
            '$': { 
              AttributeId:'urn:oasis:names:tc:xacml:2.0:subject:role',
              DataType:'http://www.w3.org/2001/XMLSchema#string' 
            }, 
            AttributeValue: []
          } ]
        } ],
        Resource: [ {
          Attribute: [ {
            '$': { 
              AttributeId:'urn:oasis:names:tc:xacml:1.0:resource:resource-id',
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
    }

var options = {
  host: 'az.testbed.fi-ware.eu', 
  path: '/authzforce/domains/47bb8497-f8b0-11e2-8cc3-fa163e3515ad/pdp',
  method: 'POST',
  key: fs.readFileSync('taz-client-key.pem'),
  cert: fs.readFileSync('irena.trajkovska.proxy-taz-client.pem'),
  //put passphrase
  passphrase: '',
  ca: fs.readFileSync('taz-ca-cert.pem')
};

var subject = "";
for (var i in roles) {
  XACMLPolicyString.Request.Subject[0].Attribute[0].AttributeValue[i] = roles[i]; 
  console.log("jsonFromXML Subject "+[i], XACMLPolicyString.Request.Subject[0].Attribute[0].AttributeValue[i]);
}
XACMLPolicyString.Request.Resource[0].Attribute[0].AttributeValue[0] = path;
XACMLPolicyString.Request.Action[0].Attribute[0].AttributeValue[0] = action;
console.log("jsonFromXML Resource ", XACMLPolicyString.Request.Resource[0].Attribute[0].AttributeValue[0]);
console.log("jsonFromXML Action ", XACMLPolicyString.Request.Action[0].Attribute[0].AttributeValue[0]);


var js2xml = new x2js.Builder();
xml = js2xml.buildObject(XACMLPolicyString);
console.log("xml", xml);

sendData(options, xml);

}

function sendData(options, xml) {

  var req = https.request(options, function(res) {
    //console.log("statusCode: ", res.statusCode);
    //console.log("headers: ", res.headers);

    var body = "";
    var parser = new x2js.Parser();

    res.on('data', function(d) {
      body += d;
      parser.parseString(body, function (err, result) {
        // Responses: ["Permit", "NotApplicable"]
        console.log("Response from AC server for policy check: ", result.Response.Result[0].Decision[0]);
      });
      //process.stdout.write(d);
    });
  });
  req.write(xml);
  req.end();

  req.on('error', function(e) {
    console.error(e);
  });
}


checkPolicy(roles,path,action);
