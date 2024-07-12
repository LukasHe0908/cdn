'use strict';

const ASSET_URL = 'https://404.mise.eu.org/';

// CF proxy all, 一切给CF代理，true/false
const CFproxy = true;

/**
 * @param {any} body
 * @param {number} status
 * @param {Object<string, string>} headers
 */
function makeRes(body, status = 200, headers = {}) {
  headers['Access-Control-Allow-Methods'] = 'GET,HEAD,POST,PUT,DELETE,CONNECT,OPTIONS,TRACE,PATCH';
  headers['Access-Control-Allow-Headers'] = '*,Authorization';
  headers['Access-Control-Allow-Origin'] = '*';
  return new Response(body, { status, headers });
}

export default {
  async fetch(request, env) {
    return fetchHandler(request).catch(err => makeRes('Function Error:\n' + err.stack, 502));
  },
};

/**
 * @param {FetchRequest} request
 */
async function fetchHandler(request) {
  const urlStr = request.url;
  const urlObj = new URL(urlStr);
  if (urlObj.pathname == '/generate_204') {
    let out_response = new Response('', {
      status: 204,
    });
    return out_response;
  } else if (urlObj.pathname.startsWith('/http') || urlObj.pathname.startsWith('/;') || urlObj.pathname.startsWith('/:http')) {
    let path = urlObj.href.replace(urlObj.origin + '/', '');
    path = path.replace(/http:\/(?!\/)/g, 'http://');
    path = path.replace(/https:\/(?!\/)/g, 'https://');
    let referer = undefined;
    if (path.substring(0, 1) == ':') {
      let path_split = path.split(':');
      if (request.headers.get('referer')) {
        referer = request.headers.get('referer');
      }
      let array = [];
      for (let i = 0; i + 1 < path_split.length; i++) {
        array[i] = path_split[i + 1];
      }
      path = array.join(':');
    } else if (path.substring(0, 1) == ';') {
      let path_split = path.split(';');
      referer = path_split[1];
      let array = [];
      for (let i = 0; i + 2 < path_split.length; i++) {
        array[i] = path_split[i + 2];
      }
      path = array.join(';');
    }

    // Debug Request Info
    // console.log(
    //   `\n-----Request-----\nURL:             ${urlStr}\nOrigin Referer:  ${request.headers.get(
    //     'referer'
    //   )}\nChanged Referer: ${referer}\nProxy URL:       ${path}\n-----------------`
    // );
    // Debug Request Detail
    // console.log(request);

    return fetchAndApply(path, request, referer);
  } else {
    return fetch(ASSET_URL);
  }
}

async function fetchAndApply(host, request, referer) {
  let new_url = new URL(host);

  let response = null;
  if (!CFproxy) {
    response = await fetch(new_url, request);
  } else {
    let method = request.method;
    let body = request.body;
    let request_headers = request.headers;
    let new_request_headers = new Headers(request_headers);
    new_request_headers.set('Host', new_url.host);
    new_request_headers.delete('Origin');
    referer ? new_request_headers.set('Referer', referer) : new_request_headers.delete('Referer');

    response = await fetch(new_url.href, {
      method: method,
      body: body,
      headers: new_request_headers,
    });
  }

  let out_headers = new Headers(response.headers);
  if (out_headers.get('Content-Disposition') == 'attachment') out_headers.delete('Content-Disposition');
  let out_body = await response.body;

  out_headers.set('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,DELETE,CONNECT,OPTIONS,TRACE,PATCH');
  out_headers.set('Access-Control-Allow-Headers', '*,Authorization');
  out_headers.set('Access-Control-Allow-Origin', '*');
  out_headers.set('Access-Control-Max-Age', '86400');
  let out_response = new Response(out_body, {
    status: response.status,
    headers: out_headers,
  });

  return out_response;
}
