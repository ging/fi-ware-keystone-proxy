var Index = (function() {

    var get = function(req, res) {
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

    };

    var v2 = function(req, res) {
        var resp = '';
        // if (req.headers['accept'] === 'application/xml') {
        //     resp = '<?xml version="1.0" encoding="UTF-8"?>'+
        //     '<versions xmlns="http://docs.openstack.org/identity/api/v2.0">'+
        //     '  <version status="stable" updated="2013-03-06T00:00:00Z" id="v3.0">'+
        //     '    <media-types>'+
        //     '      <media-type base="application/json" type="application/vnd.openstack.identity-v3+json"/>'+
        //     '      <media-type base="application/xml" type="application/vnd.openstack.identity-v3+xml"/>'+
        //     '    </media-types>'+
        //     '    <links>'+
        //     '      <link href="http://localhost:4731/v3/" rel="self"/>'+
        //     '    </links>'+
        //     '  </version>'+
        //     '  <version status="stable" updated="2013-03-06T00:00:00Z" id="v2.0">'+
        //     '    <media-types>'+
        //     '      <media-type base="application/json" type="application/vnd.openstack.identity-v2.0+json"/>'+
        //     '      <media-type base="application/xml" type="application/vnd.openstack.identity-v2.0+xml"/>'+
        //     '    </media-types>'+
        //     '    <links>'+
        //     '      <link href="http://localhost:4731/v2.0/" rel="self"/>'+
        //     '      <link href="http://docs.openstack.org/api/openstack-identity-service/2.0/content/" type="text/html" rel="describedby"/>'+
        //     '      <link href="http://docs.openstack.org/api/openstack-identity-service/2.0/identity-dev-guide-2.0.pdf" type="application/pdf" rel="describedby"/>'+
        //     '    </links>'+
        //     '  </version>'+
        //     '</versions>';
        //     res.setHeader("Content-Type", "application/xml");
        // } else {
            var json = {"version": {"status": "stable", "updated": "2014-04-17T00:00:00Z", "media-types": [{"base": "application/json", "type": "application/vnd.openstack.identity-v2.0+json"}, {"base": "application/xml", "type": "application/vnd.openstack.identity-v2.0+xml"}], "id": "v2.0", "links": [{"href": "http://cloud.lab.fiware.org:4730/v2.0/", "rel": "self"}, {"href": "http://docs.openstack.org/", "type": "text/html", "rel": "describedby"}]}};
            resp = JSON.stringify(json);
            res.setHeader("Content-Type", "application/json");
        // }
        res.send(resp, 300);

    };

    return {
        get: get,
        v2: v2
    }
})();

exports.Index = Index;