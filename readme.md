Serve locally and build
```npm run all```

update functions

```firebase deploy --only functions```

Lead dashboard setup

```sh
firebase functions:secrets:set LEADS_DASHBOARD_PASSWORD
npm run build:sass
npx eleventy
firebase deploy --only functions,hosting
```

The private dashboard is available at `/leads/`. Its signed login session lasts
eight hours. Lead dates are read from `delivery.startTime` and grouped in the
`America/Los_Angeles` time zone.
