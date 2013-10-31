var express = require('express'),
    app = express(),
    XMLHttpRequest = require("./xmlhttprequest").XMLHttpRequest;

exports.getClientIp = function(req, headers) {
  var ipAddress = req.connection.remoteAddress;

  var forwardedIpsStr = req.header('x-forwarded-for');

  if (forwardedIpsStr) {
    // 'x-forwarded-for' header may return multiple IP addresses in
    // the format: "client IP, proxy 1 IP, proxy 2 IP" so take the
    // the first one
    forwardedIpsStr += "," + ipAddress;
  } else {
    forwardedIpsStr = "" + ipAddress;
  }

  headers['x-forwarded-for'] = forwardedIpsStr;

  return headers;
};


exports.sendData = function(port, options, data, res, callBackOK, callbackError) {
    var xhr, body, result;

    callbackError = callbackError || function(status, resp) {
        //console.log("Error: ", status, resp);
        res.statusCode = status;
        res.send(resp);
    };
    callBackOK = callBackOK || function(status, resp, headers) {
        res.statusCode = status;
        for (var idx in headers) {
            var header = headers[idx];
            res.setHeader(idx, headers[idx]);
        }
        //console.log("Response: ", status);
        //console.log(" Body: ", resp);
        res.send(resp);
    };

    var url = port+"://" + options.host + ((options.port) ? (":" + options.port):"") + options.path;
    xhr = new XMLHttpRequest();
    xhr.open(options.method, url, true);
    if (options.headers["content-type"]) {
        xhr.setRequestHeader("Content-Type", options.headers["content-type"]);
    }
    for (var headerIdx in options.headers) {
        switch (headerIdx) {
            // Unsafe headers
            case "host":
            case "connection":
            case "referer":
//            case "accept-encoding":
//            case "accept-charset":
//            case "cookie":
//            case "content-length":
            case "origin":
                break;
            default:
                xhr.setRequestHeader(headerIdx, options.headers[headerIdx]);
                break;
        }
    }

    xhr.onerror = function(error) {
    }
    xhr.onreadystatechange = function () {

        // This resolves an error with Zombie.js
        if (flag) {
            return;
        }

        if (xhr.readyState === 4) {
            flag = true;
            if (xhr.status < 400) {
                callBackOK(xhr.status, xhr.responseText, xhr.getAllResponseHeadersList());
            } else {
                callbackError(xhr.status, xhr.responseText);
            }
        }
    };

    var flag = false;
    //console.log("Sending ", options.method, " to: " + url);
    //console.log(" Headers: ", options.headers);
    //console.log(" Body: ", data);
    if (data !== undefined) {
        try {
            xhr.send(data);
        } catch (e) {
            //callbackError(e.message);
            return;
        }
    } else {
        try {
            xhr.send();
        } catch (e) {
            callbackError(e.message);
            return;
        }
    }
}