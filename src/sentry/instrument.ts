import * as Sentry from "@sentry/node";

Sentry.init({
    dsn: "https://95116b90675147ac896f59f20bfa5059@glitchtip.lazyy.fr/2",
    // Adds request headers and IP for users, for more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/#sendDefaultPii
    sendDefaultPii: true,
});
