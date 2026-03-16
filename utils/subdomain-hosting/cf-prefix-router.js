function handler(event) {
    var request = event.request;
    var host = request.headers.host.value;

    if (host === "ba.advicegenie.com.au") {
        if (request.uri === "/") {
            request.uri = "/ba/index.html";
        } else {
            request.uri = "/ba" + request.uri;
        }
    }

    return request;
}