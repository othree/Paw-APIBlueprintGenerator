(function () {
  var APIBlueprintGenerator;

  var Mustache = require('mustache.js');

  APIBlueprintGenerator = function () {
    this.response = function (exchange) {
      var body, body_indentation, has_body, has_headers, headers, is_json, key, ref, value;

      if (!exchange) {
        return null;
      }

      headers = [];
      is_json = false;
      ref = exchange.responseHeaders;

      for (key in ref) {
        value = ref[key];

        if (
          key === 'Content-Type' ||
          key === 'Connection' ||
          key === 'Date' ||
          key === 'Via' ||
          key === 'Server' ||
          key === 'Content-Length'
        ) {
          is_json = key === 'Content-Type' && value.search(/(json)/i) > -1;
          continue;
        }

        headers.push({
          key: key,
          value: value,
        });
      }

      has_headers = headers.length > 0;
      body = exchange.responseBody;
      has_body = body.length > 0;

      if (has_body) {
        if (is_json) {
          body = JSON.stringify(JSON.parse(body), null, 4);
        }

        body_indentation = '        ';

        if (has_headers) {
          body_indentation += '    ';
        }

        body = body.replace(/^/gm, body_indentation);
      }

      return {
        statusCode: exchange.responseStatusCode,
        contentType: exchange.responseHeaders['Content-Type'],
        'headers?': has_headers,
        headers: headers,
        'body?': has_headers && has_body,
        body: body,
      };
    };

    this.request = function (paw_request) {
      var body, body_indentation, has_body, has_headers, headers, is_json, key, ref, value;
      
      headers = [];
      is_json = false;
      ref = paw_request.headers;

      for (key in ref) {
        value = ref[key];

        if (key === 'Content-Type') {
          is_json = value.search(/(json)/i) > -1;
          continue;
        }

        headers.push({
          key: key,
          value: value,
        });
      }

      has_headers = headers.length > 0;
      body = paw_request.body;
      has_body = body.length > 0;

      if (has_body) {
        if (is_json) {
          body = JSON.stringify(JSON.parse(body), null, 4);
        }

        body_indentation = '        ';

        if (has_headers) {
          body_indentation += '    ';
        }

        body = body.replace(/^/gm, body_indentation);
      }

      if (has_headers || has_body || paw_request.headers['Content-Type']) {
        return {
          'headers?': has_headers,
          headers: headers,
          contentType: paw_request.headers['Content-Type'],
          'body?': has_headers && has_body,
          body: body,
        };
      }
    };

    /**
     * @typedef {Object} Variable
     * @property {string} id
     * @property {Object} request
     * @property {string} name
     * @property {DynamicString} value
     * @property {string} description
     * @property {bool} required
     * @property {Object} schema
     */

    this.varsMap = function (paw_request) {
      var paramsMap = {};

      for (var i in paw_request.variables) {        
        var variable = paw_request.variables[i];

        paramsMap[variable.id] = variable;
      }

      return paramsMap;
    };

    this.parameters = function (paw_request) {
      var params = [],
          urlParams = paw_request.getUrlParameters(true);

      for (var i in paw_request.variables) {
        var v = paw_request.variables[i];

        params.push({
          name: v.name,
          type: 'string',
          value: v.value.getEvaluatedString(),
          description: v.description || '',
          attribution: v.required ? 'required' : 'optional'
        });
      } 

      for (var i in urlParams) {        
        var v = urlParams[i],
            comp = v.components[0];

        if (!comp.variableUUID) {
          params.push({
            name: i,
            type: 'string',
            value: v.getEvaluatedString(),
          });
        }
      }


      return params;
    };

    /**
     * @typedef {Object} RequestVariableDynamicValuemicValue
     * @property {string} variableUUID
     */

    this.path = function (paw_request) {
      var url = '', path,
          urlFrags = paw_request.getUrlBase(true),
          urlParams = paw_request.getUrlParametersNames(),
          varsMap = this.varsMap(paw_request);

      for (var i in urlFrags.components) {
        var comp = urlFrags.components[i];

        if (typeof comp === 'string') {
          url += comp ;
        } else if (comp.variableUUID) {
          url += '{' + varsMap[comp.variableUUID].name + '}'
        } else if (comp.getEvaluatedString) {
          url += comp.getEvaluatedString();
        }
      }

      if (urlParams.length) {
        url += '{?' + urlParams.join(',') + '}';
      }

      path = url.replace(/^https?:\/\/[^\/]+/i, '')

      if (!path) {
        path = '/';
      }

      return path;
    };

    this.generate = function (context) {
      var paw_request, template, url, params;

      paw_request = context.getCurrentRequest();
      url = paw_request.url;
      params = this.parameters(paw_request);
      template = readFile('apiblueprint.mustache');

      return Mustache.render(template, {
        method: paw_request.method,
        path: this.path(paw_request),
        "parameters?": params.length > 0,
        parameters: params,
        request: this.request(paw_request),
        response: this.response(paw_request.getLastExchange()),
      });
    };
  };

  APIBlueprintGenerator.identifier = 'io.apiary.PawExtensions.APIBlueprintGenerator';
  APIBlueprintGenerator.title = 'API Blueprint Generator';
  APIBlueprintGenerator.fileExtension = 'md';

  registerCodeGenerator(APIBlueprintGenerator);
}.call(this));
