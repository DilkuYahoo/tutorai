/**
 * CloudFront Function — viewer-request (platform-monitor-spa-router)
 * Routes subdomain traffic to the correct S3 prefix within cognifylabs.ai bucket.
 *
 * coachgenie.cognifylabs.ai/* → /coachgenie/web/*
 * monitor.cognifylabs.ai/*   → /platform_monitor/web/*  (existing behaviour)
 *
 * SPA fallback: any request without a file extension (or to /) is rewritten to
 * the app's index.html so client-side routing works.
 */
function handler(event) {
    var request = event.request;
    var host = (request.headers.host && request.headers.host.value) || "";
    var uri = request.uri;

    var prefix = "";
    if (host.indexOf("coachgenie.") === 0) {
        prefix = "/coachgenie/web";
    } else if (host.indexOf("monitor.") === 0) {
        prefix = "/platform_monitor/web";
    }

    if (prefix) {
        // Determine if this looks like a static asset (has a file extension)
        var isAsset = /\.[a-zA-Z0-9]{1,8}$/.test(uri);

        if (!isAsset || uri === "/") {
            request.uri = prefix + "/index.html";
        } else {
            request.uri = prefix + uri;
        }
    }

    return request;
}
